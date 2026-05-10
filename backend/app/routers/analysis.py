import asyncio
import base64
import cv2
import json
import numpy as np
import os
import tempfile
from fastapi import APIRouter, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from ..models.schemas import Exercise, FramePayload
from ..services.pose_engine import PoseEngine
from ..services.form_analyser import FormAnalyser
from ..services.rep_segmenter import RepSegmenter
from ..config import settings

router = APIRouter(prefix="/api", tags=["analysis"])

SAMPLE_EVERY   = 2
THUMB_INTERVAL = 2.0


# ── Lazy sport detector — won't crash startup if YOLO fails ──────────────────
def _make_detector():
    try:
        from ..services.sport_detector import SportDetector
        return SportDetector()
    except Exception as e:
        print(f"[analysis] SportDetector unavailable: {e}")
        return None


# ── WebSocket stream ─────────────────────────────────────────────────────────
@router.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    await websocket.accept()

    engine   = PoseEngine()
    analyser = FormAnalyser(engine)
    detector = _make_detector()

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except Exception:
                await websocket.send_json({"error": "bad json"})
                continue

            frame_b64 = data.get("frame_b64", "")
            exercise  = data.get("exercise", "unknown")

            try:
                img_bytes = base64.b64decode(frame_b64)
                arr   = np.frombuffer(img_bytes, np.uint8)
                frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            except Exception:
                await websocket.send_json({"error": "invalid frame"})
                continue

            if frame is None:
                await websocket.send_json({"error": "invalid frame"})
                continue

            # Sport detection (optional — skipped if YOLO unavailable)
            detected_ex = exercise
            if detector and exercise == "unknown":
                try:
                    ex, meta = detector.detect_frame(frame)
                    detector.accumulate_vote(ex)
                    detected_ex = detector.majority_exercise()
                    if meta["detections"]:
                        frame = detector.draw_detections(frame, meta)
                except Exception:
                    pass

            pose, annotated = engine.process_frame(frame)
            if pose is None:
                await websocket.send_json({
                    "error": "no pose detected",
                    "detected_exercise": detected_ex,
                })
                continue

            # Use Exercise enum if it matches, else pass through as string
            try:
                ex_enum = Exercise(detected_ex)
            except ValueError:
                ex_enum = Exercise.UNKNOWN

            feedback = analyser.analyse(pose, ex_enum)

            _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 72])
            annotated_b64 = base64.b64encode(buf).decode()

            await websocket.send_json({
                "feedback":          feedback.model_dump(),
                "annotated_frame":   annotated_b64,
                "detected_exercise": detected_ex,
            })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[stream] unexpected error: {e}")
    finally:
        engine.close()


# ── Video upload ─────────────────────────────────────────────────────────────
@router.post("/analyse-video")
async def analyse_video(
    file:     UploadFile = File(...),
    exercise: str        = Form("unknown"),
):
    if file.size and file.size > settings.max_video_mb * 1024 * 1024:
        return JSONResponse(status_code=413, content={"error": "File too large"})

    file_bytes = await file.read()

    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None, _process_video_sync, file_bytes, exercise
        )
        return result
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


def _process_video_sync(file_bytes: bytes, exercise_hint: str) -> dict:
    engine    = PoseEngine()
    detector  = _make_detector()
    analyser  = FormAnalyser(engine)
    segmenter = RepSegmenter()

    all_feedback = []
    thumbnails   = []
    last_thumb_s = -THUMB_INTERVAL

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration_s = total / fps

        # ── Auto-detect exercise from first 90 frames ────────────────────────
        detected_exercise = exercise_hint
        if exercise_hint in ("unknown", "") and detector:
            for _ in range(min(90, total)):
                ret, frame = cap.read()
                if not ret:
                    break
                ex, meta = detector.detect_frame(frame)
                detector.accumulate_vote(ex)
                # Also use pose heuristic
                pose, _ = engine.process_frame(frame)
                if pose:
                    refined = detector.detect_from_pose(
                        None, None, None, set(meta.get("equipment", []))
                    )
                    if refined != "unknown":
                        detector.accumulate_vote(refined)
            detected_exercise = detector.majority_exercise()
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

        # ── Main analysis pass ───────────────────────────────────────────────
        frame_idx = 0
        try:
            ex_enum = Exercise(detected_exercise)
        except ValueError:
            ex_enum = Exercise.UNKNOWN

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            frame_idx += 1
            if frame_idx % SAMPLE_EVERY != 0:
                continue

            timestamp_s = frame_idx / fps
            pose, annotated = engine.process_frame(frame)
            if pose is None:
                continue

            feedback = analyser.analyse(pose, ex_enum)
            all_feedback.append(feedback)
            completed_rep = segmenter.ingest(feedback)

            if completed_rep or (timestamp_s - last_thumb_s >= THUMB_INTERVAL):
                _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 55])
                thumbnails.append({
                    "timestamp_s": round(timestamp_s, 2),
                    "frame_b64":   base64.b64encode(buf).decode(),
                    "rep_number":  completed_rep.rep_number if completed_rep else None,
                    "score":       round(feedback.score, 1),
                })
                last_thumb_s = timestamp_s

        segmenter.flush()
        cap.release()

    finally:
        os.unlink(tmp_path)
        engine.close()

    summary = segmenter.summary()
    summary["exercise"]              = detected_exercise
    summary["duration_s"]            = round(duration_s, 1)
    summary["total_frames_analysed"] = len(all_feedback)
    summary["thumbnails"]            = thumbnails[:20]
    return summary


# ── Single-frame exercise detection ─────────────────────────────────────────
@router.post("/detect-exercise")
async def detect_exercise_from_frame(file: UploadFile = File(...)):
    contents = await file.read()
    arr   = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        return JSONResponse(status_code=400, content={"error": "invalid image"})

    detector = _make_detector()
    if detector is None:
        return {"exercise": "unknown", "detections": []}

    exercise, meta = detector.detect_frame(frame)
    return {"exercise": exercise, "detections": meta["detections"]}