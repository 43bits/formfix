# import asyncio
# import base64
# import cv2
# import json
# import numpy as np
# import os
# import tempfile
# from fastapi import APIRouter, UploadFile, File, Form, WebSocket, WebSocketDisconnect
# from fastapi.responses import JSONResponse

# from ..models.schemas import Exercise, FramePayload
# from ..services.pose_engine import PoseEngine
# from ..services.form_analyser import FormAnalyser
# from ..services.rep_segmenter import RepSegmenter
# from ..config import settings

# router = APIRouter(prefix="/api", tags=["analysis"])

# SAMPLE_EVERY   = 2
# THUMB_INTERVAL = 2.0


# # ── Lazy sport detector — won't crash startup if YOLO fails ──────────────────
# def _make_detector():
#     try:
#         from ..services.sport_detector import SportDetector
#         return SportDetector()
#     except Exception as e:
#         print(f"[analysis] SportDetector unavailable: {e}")
#         return None


# # ── WebSocket stream ─────────────────────────────────────────────────────────
# @router.websocket("/ws/stream")
# async def websocket_stream(websocket: WebSocket):
#     await websocket.accept()

#     engine   = PoseEngine()
#     analyser = FormAnalyser(engine)
#     detector = _make_detector()

#     try:
#         while True:
#             raw = await websocket.receive_text()
#             try:
#                 data = json.loads(raw)
#             except Exception:
#                 await websocket.send_json({"error": "bad json"})
#                 continue

#             frame_b64 = data.get("frame_b64", "")
#             exercise  = data.get("exercise", "unknown")

#             try:
#                 img_bytes = base64.b64decode(frame_b64)
#                 arr   = np.frombuffer(img_bytes, np.uint8)
#                 frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
#             except Exception:
#                 await websocket.send_json({"error": "invalid frame"})
#                 continue

#             if frame is None:
#                 await websocket.send_json({"error": "invalid frame"})
#                 continue

#             # Sport detection (optional — skipped if YOLO unavailable)
#             detected_ex = exercise
#             if detector and exercise == "unknown":
#                 try:
#                     ex, meta = detector.detect_frame(frame)
#                     detector.accumulate_vote(ex)
#                     detected_ex = detector.majority_exercise()
#                     if meta["detections"]:
#                         frame = detector.draw_detections(frame, meta)
#                 except Exception:
#                     pass

#             pose, annotated = engine.process_frame(frame)
#             if pose is None:
#                 await websocket.send_json({
#                     "error": "no pose detected",
#                     "detected_exercise": detected_ex,
#                 })
#                 continue

#             # Use Exercise enum if it matches, else pass through as string
#             try:
#                 ex_enum = Exercise(detected_ex)
#             except ValueError:
#                 ex_enum = Exercise.UNKNOWN

#             feedback = analyser.analyse(pose, ex_enum)

#             _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 72])
#             annotated_b64 = base64.b64encode(buf).decode()

#             await websocket.send_json({
#                 "feedback":          feedback.model_dump(),
#                 "annotated_frame":   annotated_b64,
#                 "detected_exercise": detected_ex,
#             })

#     except WebSocketDisconnect:
#         pass
#     except Exception as e:
#         print(f"[stream] unexpected error: {e}")
#     finally:
#         engine.close()


# # ── Video upload ─────────────────────────────────────────────────────────────
# @router.post("/analyse-video")
# async def analyse_video(
#     file:     UploadFile = File(...),
#     exercise: str        = Form("unknown"),
# ):
#     if file.size and file.size > settings.max_video_mb * 1024 * 1024:
#         return JSONResponse(status_code=413, content={"error": "File too large"})

#     file_bytes = await file.read()

#     try:
#         result = await asyncio.get_event_loop().run_in_executor(
#             None, _process_video_sync, file_bytes, exercise
#         )
#         return result
#     except Exception as e:
#         return JSONResponse(status_code=500, content={"error": str(e)})


# def _process_video_sync(file_bytes: bytes, exercise_hint: str) -> dict:
#     engine    = PoseEngine()
#     detector  = _make_detector()
#     analyser  = FormAnalyser(engine)
#     segmenter = RepSegmenter()

#     all_feedback = []
#     thumbnails   = []
#     last_thumb_s = -THUMB_INTERVAL

#     with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
#         tmp.write(file_bytes)
#         tmp_path = tmp.name

#     try:
#         cap = cv2.VideoCapture(tmp_path)
#         fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
#         total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
#         duration_s = total / fps

#         # ── Auto-detect exercise from first 90 frames ────────────────────────
#         detected_exercise = exercise_hint
#         if exercise_hint in ("unknown", "") and detector:
#             for _ in range(min(90, total)):
#                 ret, frame = cap.read()
#                 if not ret:
#                     break
#                 ex, meta = detector.detect_frame(frame)
#                 detector.accumulate_vote(ex)
#                 # Also use pose heuristic
#                 pose, _ = engine.process_frame(frame)
#                 if pose:
#                     refined = detector.detect_from_pose(
#                         None, None, None, set(meta.get("equipment", []))
#                     )
#                     if refined != "unknown":
#                         detector.accumulate_vote(refined)
#             detected_exercise = detector.majority_exercise()
#             cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

#         # ── Main analysis pass ───────────────────────────────────────────────
#         frame_idx = 0
#         try:
#             ex_enum = Exercise(detected_exercise)
#         except ValueError:
#             ex_enum = Exercise.UNKNOWN

#         while cap.isOpened():
#             ret, frame = cap.read()
#             if not ret:
#                 break
#             frame_idx += 1
#             if frame_idx % SAMPLE_EVERY != 0:
#                 continue

#             timestamp_s = frame_idx / fps
#             pose, annotated = engine.process_frame(frame)
#             if pose is None:
#                 continue

#             feedback = analyser.analyse(pose, ex_enum)
#             all_feedback.append(feedback)
#             completed_rep = segmenter.ingest(feedback)

#             if completed_rep or (timestamp_s - last_thumb_s >= THUMB_INTERVAL):
#                 _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 55])
#                 thumbnails.append({
#                     "timestamp_s": round(timestamp_s, 2),
#                     "frame_b64":   base64.b64encode(buf).decode(),
#                     "rep_number":  completed_rep.rep_number if completed_rep else None,
#                     "score":       round(feedback.score, 1),
#                 })
#                 last_thumb_s = timestamp_s

#         segmenter.flush()
#         cap.release()

#     finally:
#         os.unlink(tmp_path)
#         engine.close()

#     summary = segmenter.summary()
#     summary["exercise"]              = detected_exercise
#     summary["duration_s"]            = round(duration_s, 1)
#     summary["total_frames_analysed"] = len(all_feedback)
#     summary["thumbnails"]            = thumbnails[:20]
#     return summary


# # ── Single-frame exercise detection ─────────────────────────────────────────
# @router.post("/detect-exercise")
# async def detect_exercise_from_frame(file: UploadFile = File(...)):
#     contents = await file.read()
#     arr   = np.frombuffer(contents, np.uint8)
#     frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
#     if frame is None:
#         return JSONResponse(status_code=400, content={"error": "invalid image"})

#     detector = _make_detector()
#     if detector is None:
#         return {"exercise": "unknown", "detections": []}

#     exercise, meta = detector.detect_frame(frame)
#     return {"exercise": exercise, "detections": meta["detections"]}




# import asyncio
# import base64
# import cv2
# import json
# import numpy as np
# import os
# import tempfile
# from fastapi import APIRouter, UploadFile, File, Form, WebSocket, WebSocketDisconnect
# from fastapi.responses import JSONResponse

# from ..models.schemas import Exercise, FramePayload
# from ..services.pose_engine import PoseEngine
# from ..services.form_analyser import FormAnalyser
# from ..services.rep_segmenter import RepSegmenter
# from ..services.model_loader import get_model_loader, CONFIDENCE_MIN
# from ..config import settings

# router = APIRouter(prefix="/api", tags=["analysis"])
# SAMPLE_EVERY   = 2
# THUMB_INTERVAL = 2.0


# def _make_detector():
#     try:
#         from ..services.sport_detector import SportDetector
#         return SportDetector()
#     except Exception as e:
#         print(f"[analysis] SportDetector unavailable: {e}")
#         return None


# def _resolve_exercise(model_ex: str, user_ex: str, confidence: float) -> str:
#     """
#     If user picked a specific exercise, use it.
#     If user set 'unknown', use model prediction only if confident enough.
#     """
#     if user_ex not in ("unknown", ""):
#         return user_ex
#     if confidence >= CONFIDENCE_MIN and model_ex != "unknown":
#         return model_ex
#     return "unknown"


# # ── WebSocket stream ──────────────────────────────────────────────────────────
# @router.websocket("/ws/stream")
# async def websocket_stream(websocket: WebSocket):
#     await websocket.accept()

#     engine   = PoseEngine()
#     analyser = FormAnalyser(engine)
#     detector = _make_detector()
#     loader   = get_model_loader()   # shared singleton — no reload per connection

#     try:
#         while True:
#             raw = await websocket.receive_text()
#             try:
#                 data = json.loads(raw)
#             except Exception:
#                 await websocket.send_json({"error": "bad json"})
#                 continue

#             frame_b64 = data.get("frame_b64", "")
#             user_ex   = data.get("exercise", "unknown")

#             try:
#                 img_bytes = base64.b64decode(frame_b64)
#                 arr   = np.frombuffer(img_bytes, np.uint8)
#                 frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
#             except Exception:
#                 await websocket.send_json({"error": "invalid frame"})
#                 continue

#             if frame is None:
#                 await websocket.send_json({"error": "invalid frame"})
#                 continue

#             # ── Pose detection ───────────────────────────────────────────────
#             pose, annotated = engine.process_frame(frame)
#             if pose is None:
#                 await websocket.send_json({
#                     "error": "no pose detected",
#                     "detected_exercise": user_ex,
#                 })
#                 continue

#             # ── Model-based exercise classification ──────────────────────────
#             model_result = loader.push_frame(pose)
#             majority_ex, majority_conf = loader.majority_exercise()
#             detected_ex  = _resolve_exercise(majority_ex, user_ex, majority_conf)

#             # ── YOLO equipment detection (only when auto-detect) ─────────────
#             if detector and user_ex == "unknown" and detected_ex == "unknown":
#                 try:
#                     yolo_ex, meta = detector.detect_frame(frame)
#                     detector.accumulate_vote(yolo_ex)
#                     yolo_majority = detector.majority_exercise()
#                     if yolo_majority != "unknown":
#                         detected_ex = yolo_majority
#                         annotated = detector.draw_detections(annotated, meta)
#                 except Exception:
#                     pass

#             # ── Form analysis ────────────────────────────────────────────────
#             try:
#                 ex_enum = Exercise(detected_ex)
#             except ValueError:
#                 ex_enum = Exercise.UNKNOWN

#             feedback = analyser.analyse(pose, ex_enum)

#             # ── Encode annotated frame ───────────────────────────────────────
#             _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 72])
#             annotated_b64 = base64.b64encode(buf).decode()

#             await websocket.send_json({
#                 "feedback":          feedback.model_dump(),
#                 "annotated_frame":   annotated_b64,
#                 "detected_exercise": detected_ex,
#                 "model_confidence":  round(majority_conf, 3),
#                 "model_top":         model_result.get("all_probs", {}),
#             })

#     except WebSocketDisconnect:
#         pass
#     except Exception as e:
#         print(f"[stream] error: {e}")
#     finally:
#         engine.close()


# # ── Video upload ──────────────────────────────────────────────────────────────
# @router.post("/analyse-video")
# async def analyse_video(
#     file:     UploadFile = File(...),
#     exercise: str        = Form("unknown"),
# ):
#     if file.size and file.size > settings.max_video_mb * 1024 * 1024:
#         return JSONResponse(status_code=413, content={"error": "File too large"})
#     file_bytes = await file.read()
#     try:
#         result = await asyncio.get_event_loop().run_in_executor(
#             None, _process_video_sync, file_bytes, exercise
#         )
#         return result
#     except Exception as e:
#         import traceback
#         traceback.print_exc()
#         return JSONResponse(status_code=500, content={"error": str(e)})


# def _process_video_sync(file_bytes: bytes, exercise_hint: str) -> dict:
#     engine    = PoseEngine()
#     loader    = ModelLoader_local()   # fresh loader per upload (not shared)
#     analyser  = FormAnalyser(engine)
#     segmenter = RepSegmenter()
#     thumbnails, all_feedback = [], []
#     last_thumb_s = -THUMB_INTERVAL

#     with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
#         tmp.write(file_bytes)
#         tmp_path = tmp.name

#     try:
#         cap       = cv2.VideoCapture(tmp_path)
#         fps       = cap.get(cv2.CAP_PROP_FPS) or 30.0
#         total_f   = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
#         duration  = total_f / fps

#         detected_exercise = exercise_hint
#         frame_idx = 0

#         while cap.isOpened():
#             ret, frame = cap.read()
#             if not ret:
#                 break
#             frame_idx += 1
#             if frame_idx % SAMPLE_EVERY != 0:
#                 continue

#             timestamp_s = frame_idx / fps
#             pose, annotated = engine.process_frame(frame)
#             if pose is None:
#                 continue

#             # Use model for exercise detection on first 90 analysed frames
#             if detected_exercise in ("unknown", "") and frame_idx <= 90 * SAMPLE_EVERY:
#                 loader.push_frame(pose)
#                 m_ex, m_conf = loader.majority_exercise()
#                 if m_conf >= CONFIDENCE_MIN and m_ex != "unknown":
#                     detected_exercise = m_ex

#             try:
#                 ex_enum = Exercise(detected_exercise)
#             except ValueError:
#                 ex_enum = Exercise.UNKNOWN

#             feedback = analyser.analyse(pose, ex_enum)
#             all_feedback.append(feedback)
#             completed_rep = segmenter.ingest(feedback)

#             if completed_rep or (timestamp_s - last_thumb_s >= THUMB_INTERVAL):
#                 _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 55])
#                 thumbnails.append({
#                     "timestamp_s": round(timestamp_s, 2),
#                     "frame_b64":   base64.b64encode(buf).decode(),
#                     "rep_number":  completed_rep.rep_number if completed_rep else None,
#                     "score":       round(feedback.score, 1),
#                 })
#                 last_thumb_s = timestamp_s

#         segmenter.flush()
#         cap.release()
#     finally:
#         os.unlink(tmp_path)
#         engine.close()

#     summary = segmenter.summary()
#     summary["exercise"]              = detected_exercise
#     summary["duration_s"]            = round(duration, 1)
#     summary["total_frames_analysed"] = len(all_feedback)
#     summary["thumbnails"]            = thumbnails[:20]
#     return summary


# def ModelLoader_local():
#     """Fresh non-singleton loader for video upload (avoids polluting live session buffer)."""
#     from ..services.model_loader import ModelLoader
#     return ModelLoader()


# # ── Single frame detection ────────────────────────────────────────────────────
# @router.post("/detect-exercise")
# async def detect_exercise_from_frame(file: UploadFile = File(...)):
#     contents = await file.read()
#     arr   = np.frombuffer(contents, np.uint8)
#     frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
#     if frame is None:
#         return JSONResponse(status_code=400, content={"error": "invalid image"})

#     engine = PoseEngine()
#     pose, _ = engine.process_frame(frame)
#     engine.close()

#     if pose is None:
#         return {"exercise": "unknown", "confidence": 0.0}

#     loader = get_model_loader()
#     # Push the same frame 60 times to fill buffer for a single-frame prediction
#     for _ in range(SEQUENCE_LENGTH := 60):
#         loader.push_frame(pose)
#     ex, conf = loader.majority_exercise()
#     loader.reset()
#     return {"exercise": ex, "confidence": round(conf, 3)}



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
from ..services.model_loader import get_model_loader, CONFIDENCE_MIN
from ..config import settings

router = APIRouter(prefix="/api", tags=["analysis"])
SAMPLE_EVERY   = 2
THUMB_INTERVAL = 2.0


def _make_detector():
    try:
        from ..services.sport_detector import SportDetector
        return SportDetector()
    except Exception as e:
        print(f"[analysis] SportDetector unavailable: {e}")
        return None


def _resolve_exercise(model_ex: str, user_ex: str, confidence: float) -> str:
    """
    If user picked a specific exercise, use it.
    If user set 'unknown', use model prediction only if confident enough.
    """
    if user_ex not in ("unknown", ""):
        return user_ex
    if confidence >= CONFIDENCE_MIN and model_ex != "unknown":
        return model_ex
    return "unknown"


# ── WebSocket stream ──────────────────────────────────────────────────────────
@router.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    await websocket.accept()

    engine   = PoseEngine()
    analyser = FormAnalyser(engine)
    detector = _make_detector()
    loader   = get_model_loader()   # shared singleton — no reload per connection

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except Exception:
                await websocket.send_json({"error": "bad json"})
                continue

            frame_b64 = data.get("frame_b64", "")
            user_ex   = data.get("exercise", "unknown")

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

            # ── Pose detection ───────────────────────────────────────────────
            pose, annotated = engine.process_frame(frame)
            if pose is None:
                await websocket.send_json({
                    "error": "no pose detected",
                    "detected_exercise": user_ex,
                })
                continue

            # ── Exercise resolution with lock-in ─────────────────────────────
            # Push frame to model buffer
            model_result = loader.push_frame(pose)
            majority_ex, majority_conf = loader.majority_exercise()

            # Resolve: user selection beats model; model beats "unknown"
            if user_ex not in ("unknown", ""):
                detected_ex = user_ex
            elif majority_conf >= CONFIDENCE_MIN and majority_ex != "unknown":
                detected_ex = majority_ex
            else:
                detected_ex = "unknown"

            # ── YOLO equipment detection (only when still unresolved) ─────────
            if detector and detected_ex == "unknown":
                try:
                    yolo_ex, meta = detector.detect_frame(frame)
                    detector.accumulate_vote(yolo_ex)
                    yolo_majority = detector.majority_exercise()
                    if yolo_majority != "unknown":
                        detected_ex = yolo_majority
                        annotated = detector.draw_detections(annotated, meta)
                except Exception:
                    pass

            # ── Form analysis ─────────────────────────────────────────────────
            try:
                ex_enum = Exercise(detected_ex)
            except ValueError:
                ex_enum = Exercise.UNKNOWN

            # Notify analyser of resolved exercise — FormAnalyser.set_exercise
            # guards internally so mid-set switching is debounced/locked.
            analyser.set_exercise(detected_ex)
            feedback = analyser.analyse(pose, ex_enum)

            # ── Encode annotated frame ───────────────────────────────────────
            _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 72])
            annotated_b64 = base64.b64encode(buf).decode()

            await websocket.send_json({
                "feedback":          feedback.model_dump(),
                "annotated_frame":   annotated_b64,
                "detected_exercise": detected_ex,
                "model_confidence":  round(majority_conf, 3),
                "model_top":         model_result.get("all_probs", {}),
            })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[stream] error: {e}")
    finally:
        engine.close()


# ── Video upload ──────────────────────────────────────────────────────────────
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
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


def _process_video_sync(file_bytes: bytes, exercise_hint: str) -> dict:
    engine    = PoseEngine()
    loader    = ModelLoader_local()   # fresh loader per upload (not shared)
    analyser  = FormAnalyser(engine)
    segmenter = RepSegmenter()
    thumbnails, all_feedback = [], []
    last_thumb_s = -THUMB_INTERVAL

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        cap       = cv2.VideoCapture(tmp_path)
        fps       = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_f   = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration  = total_f / fps

        detected_exercise = exercise_hint
        frame_idx = 0

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

            # Use model for exercise detection on first 90 analysed frames
            if detected_exercise in ("unknown", "") and frame_idx <= 90 * SAMPLE_EVERY:
                loader.push_frame(pose)
                m_ex, m_conf = loader.majority_exercise()
                if m_conf >= CONFIDENCE_MIN and m_ex != "unknown":
                    detected_exercise = m_ex

            try:
                ex_enum = Exercise(detected_exercise)
            except ValueError:
                ex_enum = Exercise.UNKNOWN

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
    summary["duration_s"]            = round(duration, 1)
    summary["total_frames_analysed"] = len(all_feedback)
    summary["thumbnails"]            = thumbnails[:20]
    return summary


def ModelLoader_local():
    """Fresh non-singleton loader for video upload (avoids polluting live session buffer)."""
    from ..services.model_loader import ModelLoader
    return ModelLoader()


# ── Single frame detection ────────────────────────────────────────────────────
@router.post("/detect-exercise")
async def detect_exercise_from_frame(file: UploadFile = File(...)):
    contents = await file.read()
    arr   = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        return JSONResponse(status_code=400, content={"error": "invalid image"})

    engine = PoseEngine()
    pose, _ = engine.process_frame(frame)
    engine.close()

    if pose is None:
        return {"exercise": "unknown", "confidence": 0.0}

    loader = get_model_loader()
    # Push the same frame 60 times to fill buffer for a single-frame prediction
    for _ in range(SEQUENCE_LENGTH := 60):
        loader.push_frame(pose)
    ex, conf = loader.majority_exercise()
    loader.reset()
    return {"exercise": ex, "confidence": round(conf, 3)}