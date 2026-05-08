import cv2
import mediapipe as mp
import numpy as np
from typing import Optional, Tuple
from ..models.schemas import Keypoint, PoseFrame

mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils

LANDMARK_NAMES = [lm.name for lm in mp_pose.PoseLandmark]

class PoseEngine:
    def __init__(self):
        self.pose = mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,         # 0=lite, 1=full, 2=heavy
            smooth_landmarks=True,
            enable_segmentation=False,
            min_detection_confidence=0.6,
            min_tracking_confidence=0.6,
        )

    def process_frame(self, frame_bgr: np.ndarray) -> Tuple[Optional[PoseFrame], np.ndarray]:
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        results = self.pose.process(rgb)
        rgb.flags.writeable = True

        if not results.pose_landmarks:
            return None, frame_bgr

        h, w = frame_bgr.shape[:2]
        keypoints = []
        for i, lm in enumerate(results.pose_landmarks.landmark):
            keypoints.append(Keypoint(
                name=LANDMARK_NAMES[i],
                x=lm.x * w,
                y=lm.y * h,
                z=lm.z,
                visibility=lm.visibility,
            ))

        pose_frame = PoseFrame(
            keypoints=keypoints,
            timestamp_ms=0,
        )

        # Draw skeleton on frame (returns annotated copy)
        annotated = frame_bgr.copy()
        mp_drawing.draw_landmarks(
            annotated,
            results.pose_landmarks,
            mp_pose.POSE_CONNECTIONS,
            landmark_drawing_spec=mp_drawing.DrawingSpec(color=(0, 255, 120), thickness=2, circle_radius=3),
            connection_drawing_spec=mp_drawing.DrawingSpec(color=(255, 255, 255), thickness=2),
        )
        return pose_frame, annotated

    def get_landmark(self, pose: PoseFrame, name: str) -> Optional[Keypoint]:
        for kp in pose.keypoints:
            if kp.name == name:
                return kp
        return None

    @staticmethod
    def calc_angle(a: Keypoint, b: Keypoint, c: Keypoint) -> float:
        """Angle at joint B formed by segments BA and BC."""
        ba = np.array([a.x - b.x, a.y - b.y])
        bc = np.array([c.x - b.x, c.y - b.y])
        cos_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
        return float(np.degrees(np.arccos(np.clip(cos_angle, -1.0, 1.0))))

    def close(self):
        self.pose.close()