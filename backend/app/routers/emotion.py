import asyncio
import base64
import cv2
import json
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..services.emotion_engine import EmotionEngine
from ..services.session_tracker import SessionTracker

router = APIRouter(prefix="/api/emotion", tags=["emotion"])

# One tracker per server process (extend to per-session with Redis later)
_session_tracker = SessionTracker()


@router.websocket("/ws")
async def emotion_stream(websocket: WebSocket):
    """
    Accepts: { frame_b64, form_score, rep_number, exercise }
    Returns: { emotion, valence, scores, music, face_bbox }
    Processes every frame but only analyses emotion every 5th (CPU cost).
    """
    await websocket.accept()
    engine = EmotionEngine()
    frame_count = 0

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)

            img_bytes = base64.b64decode(data["frame_b64"])
            arr   = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)

            if frame is None:
                await websocket.send_json({"error": "invalid frame"})
                continue

            frame_count += 1
            if frame_count % 5 != 0:
                continue   # throttle — emotion doesn't change frame-to-frame

            result = await asyncio.get_event_loop().run_in_executor(
                None, engine.analyse_frame, frame
            )

            form_score = float(data.get("form_score", 50.0))
            rep_number = int(data.get("rep_number", 0))
            exercise   = data.get("exercise", "unknown")

            _session_tracker.record(
                emotion=result.dominant,
                valence=result.valence,
                form_score=form_score,
                rep_number=rep_number,
                exercise=exercise,
            )

            music = EmotionEngine.get_music_recommendation(result.valence)

            await websocket.send_json({
                **result.to_dict(),
                "music": music,
            })

    except WebSocketDisconnect:
        pass


@router.get("/session-analysis")
async def get_session_analysis():
    return _session_tracker.get_correlation_analysis()


@router.post("/session-reset")
async def reset_session():
    _session_tracker.reset()
    return {"status": "reset"}