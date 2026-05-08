import cv2
import numpy as np
from typing import Optional, Tuple
from ultralytics import YOLO
from ..models.schemas import Exercise

# ── Equipment → exercise mapping ─────────────────────────────────────────────
# Maps COCO class names (from YOLOv8) to probable exercise context
EQUIPMENT_MAP: dict[str, list[Exercise]] = {
    "barbell":    [Exercise.DEADLIFT, Exercise.SQUAT, Exercise.BENCH_PRESS],
    "dumbbell":   [Exercise.SQUAT, Exercise.BENCH_PRESS],
    "bench":      [Exercise.BENCH_PRESS],
    "person":     [],   # always present, not discriminative alone
    "sports ball": [],
}

# Human-readable COCO labels relevant to gym context
GYM_CLASSES = {"barbell", "dumbbell", "bench", "person", "chair", "bottle"}


class SportDetector:
    """
    Two-stage sport/exercise detector:
      1. YOLOv8n object detection → identify equipment
      2. Pose-based heuristics → disambiguate exercise from body position
    """

    def __init__(self, model_path: str = "yolov8n.pt"):
        # yolov8n.pt downloads automatically on first run (~6 MB)
        self.model = YOLO(model_path)
        self.model.fuse()  # fuse conv+bn for faster inference
        self._frame_votes: list[Exercise] = []
        self._window = 30   # vote over last N frames

    def detect_frame(
        self, frame_bgr: np.ndarray, conf_threshold: float = 0.4
    ) -> Tuple[Exercise, dict]:
        """
        Returns (detected_exercise, metadata_dict).
        metadata contains bboxes and confidence for UI overlay.
        """
        results = self.model(frame_bgr, verbose=False, conf=conf_threshold)[0]
        detections = []

        equipment_found: set[str] = set()
        for box in results.boxes:
            cls_id = int(box.cls[0])
            label = self.model.names[cls_id]
            conf = float(box.conf[0])
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            detections.append({"label": label, "conf": round(conf, 2),
                                "bbox": [x1, y1, x2, y2]})
            if label in GYM_CLASSES:
                equipment_found.add(label)

        exercise = self._vote_exercise(equipment_found)
        return exercise, {"detections": detections, "equipment": list(equipment_found)}

    def detect_from_pose(
        self,
        hip_angle: Optional[float],
        knee_angle: Optional[float],
        elbow_angle: Optional[float],
        equipment: set[str],
    ) -> Exercise:
        """
        Heuristic fallback when YOLO confidence is low.
        Uses joint angles + equipment as context.
        """
        if "bench" in equipment:
            return Exercise.BENCH_PRESS

        if hip_angle is not None and knee_angle is not None:
            # Deep knee bend → squat
            if knee_angle < 110 and hip_angle < 120:
                return Exercise.SQUAT
            # Hip hinge with straighter knee → deadlift
            if hip_angle < 130 and knee_angle > 130:
                return Exercise.DEADLIFT

        if elbow_angle is not None and elbow_angle < 110:
            return Exercise.BENCH_PRESS

        return Exercise.UNKNOWN

    def accumulate_vote(self, exercise: Exercise):
        """Call per frame to build a rolling majority vote."""
        self._frame_votes.append(exercise)
        if len(self._frame_votes) > self._window:
            self._frame_votes.pop(0)

    def majority_exercise(self) -> Exercise:
        if not self._frame_votes:
            return Exercise.UNKNOWN
        counts: dict[Exercise, int] = {}
        for v in self._frame_votes:
            counts[v] = counts.get(v, 0) + 1
        return max(counts, key=lambda k: counts[k])

    def draw_detections(self, frame: np.ndarray, metadata: dict) -> np.ndarray:
        out = frame.copy()
        for d in metadata.get("detections", []):
            x1, y1, x2, y2 = d["bbox"]
            label = d["label"]
            conf = d["conf"]
            color = (0, 200, 100) if label in GYM_CLASSES else (180, 180, 180)
            cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)
            cv2.putText(out, f"{label} {conf:.0%}", (x1, y1 - 6),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)
        return out

    # ── Internal ──────────────────────────────────────────────────────────────

    def _vote_exercise(self, equipment: set[str]) -> Exercise:
        if "bench" in equipment:
            return Exercise.BENCH_PRESS
        if "barbell" in equipment or "dumbbell" in equipment:
            # Can't distinguish squat vs deadlift from equipment alone
            # Will be refined by pose heuristic in real-time pipeline
            return Exercise.DEADLIFT  # default, overridden by pose
        return Exercise.UNKNOWN