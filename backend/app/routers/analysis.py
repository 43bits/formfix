import base64
from fastapi import APIRouter, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
import json
import cv2
import numpy as np
from ..models.schemas import Exercise, FramePayload
from ..services.video_processor import VideoProcessor
from ..services.pose_engine import PoseEngine
from ..services.form_analyser import FormAnalyser
from ..services.sport_detector import SportDetector
from ..config import settings

router = APIRouter(prefix="/api", tags=["analysis"])


@router.post("/analyse-video")
async def analyse_video(
    file: UploadFile = File(...),
    exercise: Exercise = Form(Exercise.UNKNOWN),
):
    if file.size and file.size > settings.max_video_mb * 1024 * 1024:
        return JSONResponse(status_code=413, content={"error": "File too large"})

    file_bytes = await file.read()
    processor = VideoProcessor()
    try:
        result = await processor.process_file(file_bytes, exercise)
    finally:
        processor.close()

    return result


@router.post("/detect-exercise")
async def detect_exercise_from_frame(file: UploadFile = File(...)):
    """
    Accepts a single JPEG frame and returns the detected exercise.
    Frontend calls this on first camera frame to auto-select exercise.
    """
    contents = await file.read()
    arr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        return JSONResponse(status_code=400, content={"error": "invalid image"})

    detector = SportDetector()
    exercise, meta = detector.detect_frame(frame)
    return {"exercise": exercise.value, "detections": meta["detections"]}


@router.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    """
    Real-time stream endpoint.
    Accepts: { frame_b64, exercise, timestamp_ms }
    Returns: { feedback, annotated_frame, detected_exercise }
    """
    await websocket.accept()
    engine   = PoseEngine()
    analyser = FormAnalyser(engine)
    detector = SportDetector()

    try:
        while True:
            raw = await websocket.receive_text()
            payload = FramePayload(**json.loads(raw))

            img_bytes = base64.b64decode(payload.frame_b64)
            arr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is None:
                await websocket.send_json({"error": "invalid frame"})
                continue

            # Sport detection (runs every 5 frames for perf)
            detected_ex = payload.exercise
            if payload.exercise == Exercise.UNKNOWN:
                ex, meta = detector.detect_frame(frame)
                detector.accumulate_vote(ex)
                detected_ex = detector.majority_exercise()
                frame = detector.draw_detections(frame, meta)

            pose, annotated = engine.process_frame(frame)
            if pose is None:
                await websocket.send_json({"error": "no pose detected",
                                           "detected_exercise": detected_ex.value})
                continue

            feedback = analyser.analyse(pose, detected_ex)

            _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 75])
            annotated_b64 = base64.b64encode(buf).decode()

            await websocket.send_json({
                "feedback": feedback.model_dump(),
                "annotated_frame": annotated_b64,
                "detected_exercise": detected_ex.value,
            })

    except WebSocketDisconnect:
        pass
    finally:
        engine.close()