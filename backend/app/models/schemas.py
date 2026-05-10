from pydantic import BaseModel
from typing import Optional, List
from enum import Enum

class Exercise(str, Enum):
    BARBELL_BICEPS_CURL  = "barbell_biceps_curl"
    BENCH_PRESS          = "bench_press"
    CHEST_FLY_MACHINE    = "chest_fly_machine"
    DEADLIFT             = "deadlift"
    DECLINE_BENCH_PRESS  = "decline_bench_press"
    HAMMER_CURL          = "hammer_curl"
    HIP_THRUST           = "hip_thrust"
    INCLINE_BENCH_PRESS  = "incline_bench_press"
    LAT_PULLDOWN         = "lat_pulldown"
    LATERAL_RAISE        = "lateral_raise"
    LEG_EXTENSION        = "leg_extension"
    LEG_RAISES           = "leg_raises"
    PLANK                = "plank"
    PULLUP               = "pullup"
    PUSHUP               = "pushup"
    ROMANIAN_DEADLIFT    = "romanian_deadlift"
    RUSSIAN_TWIST        = "russian_twist"
    SHOULDER_PRESS       = "shoulder_press"
    SQUAT                = "squat"
    T_BAR_ROW            = "t_bar_row"
    TRICEP_DIPS          = "tricep_dips"
    TRICEP_PUSHDOWN      = "tricep_pushdown"
    # Cardio / sport
    RUNNING              = "running"
    CYCLING              = "cycling"
    JUMP_ROPE            = "jump_rope"
    BURPEE               = "burpee"
    BOX_JUMP             = "box_jump"
    UNKNOWN              = "unknown"

# Keep rest of schemas.py unchanged below this line
class JointAngle(BaseModel):
    name: str
    angle: float
    status: str
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
    phase: str
    joint_angles: List[JointAngle]
    errors: List[str]
    warnings: List[str]
    score: float
    overlay_points: Optional[List[dict]] = None

class FramePayload(BaseModel):
    frame_b64: str
    exercise: str = "unknown"
    timestamp_ms: int = 0