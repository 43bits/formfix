import cv2
import numpy as np
from typing import Optional, Tuple

GYM_CLASSES = {"barbell", "dumbbell", "bench", "person", "bottle"}

EQUIPMENT_TO_EXERCISE = {
    "bench":    "bench_press",
    "barbell":  "deadlift",
    "dumbbell": "shoulder_press",
}

# Singleton YOLO model — loaded once, shared across all requests
_yolo_model = None
_yolo_available = False


def _get_yolo():
    global _yolo_model, _yolo_available
    if _yolo_model is not None:
        return _yolo_model

    try:
        # PyTorch 2.6 safe globals patch
        import torch
        try:
            from ultralytics.nn.tasks import DetectionModel, SegmentationModel
            torch.serialization.add_safe_globals([DetectionModel, SegmentationModel])
        except Exception:
            pass

        from ultralytics import YOLO
        _yolo_model = YOLO("yolov8n.pt")
        _yolo_model.fuse()
        _yolo_available = True
        print("[SportDetector] YOLO loaded OK")
    except Exception as e:
        print(f"[SportDetector] YOLO unavailable ({e}) — using pose-only detection")
        _yolo_available = False
        _yolo_model = None

    return _yolo_model


class SportDetector:
    def __init__(self):
        self._model = _get_yolo()
        self._frame_votes: list = []
        self._window = 30

    def detect_frame(
        self, frame_bgr: np.ndarray, conf_threshold: float = 0.4
    ) -> Tuple[str, dict]:
        """
        Returns (exercise_key, metadata).
        Falls back to {"exercise": "unknown"} if YOLO unavailable.
        """
        if self._model is None:
            return "unknown", {"detections": [], "equipment": []}

        try:
            results = self._model(frame_bgr, verbose=False, conf=conf_threshold)[0]
        except Exception as e:
            print(f"[SportDetector] inference error: {e}")
            return "unknown", {"detections": [], "equipment": []}

        equipment_found: set = set()
        detections = []

        for box in results.boxes:
            cls_id = int(box.cls[0])
            label  = self._model.names[cls_id]
            conf   = float(box.conf[0])
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            detections.append({"label": label, "conf": round(conf, 2),
                                "bbox": [x1, y1, x2, y2]})
            if label in GYM_CLASSES:
                equipment_found.add(label)

        exercise = self._equipment_to_exercise(equipment_found)
        return exercise, {"detections": detections, "equipment": list(equipment_found)}

    def detect_from_pose(
        self,
        hip_angle: Optional[float],
        knee_angle: Optional[float],
        elbow_angle: Optional[float],
        equipment: set,
    ) -> str:
        if "bench" in equipment:
            return "bench_press"
        if hip_angle is not None and knee_angle is not None:
            if knee_angle < 110 and hip_angle < 120:
                return "squat"
            if hip_angle < 130 and knee_angle > 130:
                return "deadlift"
        if elbow_angle is not None and elbow_angle < 110:
            return "bench_press"
        return "unknown"

    def accumulate_vote(self, exercise: str):
        self._frame_votes.append(exercise)
        if len(self._frame_votes) > self._window:
            self._frame_votes.pop(0)

    def majority_exercise(self) -> str:
        if not self._frame_votes:
            return "unknown"
        counts: dict = {}
        for v in self._frame_votes:
            counts[v] = counts.get(v, 0) + 1
        return max(counts, key=lambda k: counts[k])

    def draw_detections(self, frame: np.ndarray, metadata: dict) -> np.ndarray:
        out = frame.copy()
        for d in metadata.get("detections", []):
            x1, y1, x2, y2 = d["bbox"]
            label = d["label"]
            conf  = d["conf"]
            color = (0, 200, 100) if label in GYM_CLASSES else (180, 180, 180)
            cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)
            cv2.putText(out, f"{label} {conf:.0%}", (x1, max(y1 - 6, 12)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1, cv2.LINE_AA)
        return out

    @staticmethod
    def _equipment_to_exercise(equipment: set) -> str:
        for eq, ex in EQUIPMENT_TO_EXERCISE.items():
            if eq in equipment:
                return ex
        return "unknown"