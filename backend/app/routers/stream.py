import asyncio
import base64
import cv2
import json
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..models.schemas import Exercise, FramePayload
from ..services.pose_engine import PoseEngine
from ..services.form_analyser import FormAnalyser

router = APIRouter(prefix="/ws", tags=["stream"])

@router.websocket("/stream")
async def websocket_stream(websocket: WebSocket):
    await websocket.accept()
    engine = PoseEngine()
    analyser = FormAnalyser(engine)

    try:
        while True:
            raw = await websocket.receive_text()
            payload = FramePayload(**json.loads(raw))

            # Decode base64 frame
            img_bytes = base64.b64decode(payload.frame_b64)
            arr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)

            if frame is None:
                await websocket.send_json({"error": "invalid frame"})
                continue

            pose, annotated = engine.process_frame(frame)

            if pose is None:
                await websocket.send_json({"error": "no pose detected"})
                continue

            feedback = analyser.analyse(pose, payload.exercise)

            # Encode annotated frame back
            _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 75])
            annotated_b64 = base64.b64encode(buf).decode()

            await websocket.send_json({
                "feedback": feedback.model_dump(),
                "annotated_frame": annotated_b64,
            })

    except WebSocketDisconnect:
        pass
    finally:
        engine.close()