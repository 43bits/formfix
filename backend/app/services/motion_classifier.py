"""
Temporal motion pattern classifier.
Analyses velocity and acceleration of keypoints over a rolling window
to distinguish sports when YOLO equipment detection is ambiguous.
"""

import numpy as np
from collections import deque
from typing import Optional
from ..models.schemas import PoseFrame

WINDOW = 20    # frames
JOINT_INDICES_FOR_MOTION = [
    "LEFT_KNEE", "RIGHT_KNEE", "LEFT_HIP", "RIGHT_HIP",
    "LEFT_WRIST", "RIGHT_WRIST", "LEFT_ANKLE", "RIGHT_ANKLE",
]


class MotionClassifier:
    def __init__(self):
        self._history: deque[np.ndarray] = deque(maxlen=WINDOW)

    def update(self, pose: PoseFrame):
        """Push a new pose frame into the rolling window."""
        vec = self._pose_to_vec(pose)
        if vec is not None:
            self._history.append(vec)

    def classify(self) -> tuple[str, float]:
        """
        Returns (sport_key, confidence) using motion statistics.
        Requires at least 10 frames.
        """
        if len(self._history) < 10:
            return "unknown", 0.0

        frames = np.stack(self._history)          # (N, J*2)
        vel    = np.diff(frames, axis=0)           # (N-1, J*2)
        speed  = np.abs(vel)

        # Per-joint mean speed
        j = len(JOINT_INDICES_FOR_MOTION)
        speed_r  = speed.reshape(len(vel), j, 2)
        mean_spd = speed_r.mean(axis=0).mean(axis=1)  # (J,)

        wrist_speed = mean_spd[4:6].mean()   # wrists
        knee_speed  = mean_spd[0:2].mean()   # knees
        ankle_speed = mean_spd[6:8].mean()   # ankles
        hip_speed   = mean_spd[2:4].mean()   # hips

        # Vertical oscillation (y-variance of hips)
        hip_y_var = frames[:, 6].var() + frames[:, 7].var()  # LEFT/RIGHT_HIP y

        # Heuristic decision tree
        if ankle_speed > 0.015 and hip_y_var > 0.0008:
            return "running", 0.75
        if wrist_speed > 0.020 and knee_speed < 0.005:
            return "jump_rope", 0.70
        if knee_speed > 0.010 and wrist_speed < 0.008:
            return "cycling", 0.65
        if knee_speed > 0.008 and hip_speed > 0.006:
            if frames[-1][4] < 0.5:   # wrist y high → overhead movement
                return "shoulder_press", 0.60
            return "squat", 0.55
        if wrist_speed > 0.008 and knee_speed < 0.004:
            return "bench_press", 0.55

        return "unknown", 0.3

    def _pose_to_vec(self, pose: PoseFrame) -> Optional[np.ndarray]:
        kp_map = {kp.name: kp for kp in pose.keypoints}
        vec = []
        for name in JOINT_INDICES_FOR_MOTION:
            kp = kp_map.get(name)
            if kp is None or kp.visibility < 0.3:
                return None
            vec.extend([kp.x, kp.y])
        return np.array(vec, dtype=np.float32)

    def reset(self):
        self._history.clear()