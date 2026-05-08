from pydantic import BaseModel
from typing import Optional, List
from enum import Enum

class Exercise(str, Enum):
    DEADLIFT = "deadlift"
    SQUAT = "squat"
    BENCH_PRESS = "bench_press"
    UNKNOWN = "unknown"

class JointAngle(BaseModel):
    name: str
    angle: float
    status: str  # "good" | "warning" | "error"
    target_min: float
    target_max: float

class Keypoint(BaseModel):
    name: str
    x: float
    y: float
    z: float
    visibility: float

class PoseFrame(BaseModel):
    keypoints: List[Keypoint]
    timestamp_ms: int

class FormFeedback(BaseModel):
    exercise: Exercise
    rep_count: int
    phase: str          # "descent" | "bottom" | "ascent" | "lockout"
    joint_angles: List[JointAngle]
    errors: List[str]
    warnings: List[str]
    score: float        # 0-100
    overlay_points: Optional[List[dict]] = None

class FramePayload(BaseModel):
    frame_b64: str
    exercise: Exercise = Exercise.UNKNOWN
    timestamp_ms: int = 0