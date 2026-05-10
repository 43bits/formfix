"""
Unified rule catalogue for 14 sports / exercise types.
Each sport defines:
  - key_joints:      which angles to compute
  - phase_map:       phase detection thresholds
  - error_rules:     feedback messages
  - rep_phases:      which phases mark bottom and top of a rep
"""

from dataclasses import dataclass, field
from typing import Callable
from ..models.schemas import Exercise

# Extend Exercise enum dynamically for new sports
SPORT_LABELS = {
    # Gym
    "squat":          "Squat",
    "deadlift":       "Deadlift",
    "bench_press":    "Bench press",
    "shoulder_press": "Shoulder press",
    "lunge":          "Lunge",
    "pushup":         "Push-up",
    "pullup":         "Pull-up",
    "row":            "Bent-over row",
    # Cardio / sport
    "running":        "Running",
    "cycling":        "Cycling",
    "jump_rope":      "Jump rope",
    "burpee":         "Burpee",
    "box_jump":       "Box jump",
    "unknown":        "Unknown",
}


@dataclass
class JointRule:
    joint_name: str
    point_a: str
    point_b: str
    point_c: str
    target_min: float
    target_max: float
    error_msg: str
    warning_msg: str = ""


@dataclass
class SportSpec:
    key:         str
    label:       str
    joint_rules: list[JointRule]
    bottom_phases: list[str]
    top_phases:    list[str]
    phase_detector: Callable       # (angle_map: dict) -> str
    cues: list[str] = field(default_factory=list)


def _phase_squat(a: dict) -> str:
    k = a.get("left_knee", 180)
    if k > 160: return "lockout"
    if k > 120: return "ascent"
    if k > 90:  return "descent"
    return "bottom"

def _phase_deadlift(a: dict) -> str:
    h = a.get("left_hip", 180)
    if h > 165: return "lockout"
    if h > 130: return "pull"
    return "setup"

def _phase_bench(a: dict) -> str:
    e = a.get("left_elbow", 180)
    if e > 155: return "lockout"
    if e < 100: return "bottom"
    return "descent"

def _phase_shoulder_press(a: dict) -> str:
    e = a.get("left_elbow", 180)
    if e > 155: return "lockout"
    if e < 90:  return "bottom"
    return "descent"

def _phase_lunge(a: dict) -> str:
    k = a.get("left_knee", 180)
    if k > 155: return "standing"
    if k < 100: return "bottom"
    return "descent"

def _phase_pushup(a: dict) -> str:
    e = a.get("left_elbow", 180)
    if e > 155: return "top"
    if e < 95:  return "bottom"
    return "descent"

def _phase_pullup(a: dict) -> str:
    e = a.get("left_elbow", 180)
    if e < 80:  return "top"
    if e > 150: return "bottom"
    return "ascent"

def _phase_running(a: dict) -> str:
    k = a.get("left_knee", 180)
    if k < 90:  return "drive"
    if k > 155: return "extension"
    return "float"

def _phase_cycling(a: dict) -> str:
    k = a.get("left_knee", 180)
    if k < 90:  return "power"
    if k > 155: return "recovery"
    return "transition"

def _phase_generic(a: dict) -> str:
    return "active"


SPORT_CATALOGUE: dict[str, SportSpec] = {

    "squat": SportSpec(
        key="squat", label="Squat",
        joint_rules=[
            JointRule("left_knee",  "LEFT_HIP",  "LEFT_KNEE",  "LEFT_ANKLE", 65, 175, "Left knee too deep or not bending"),
            JointRule("right_knee", "RIGHT_HIP", "RIGHT_KNEE", "RIGHT_ANKLE",65, 175, "Right knee asymmetry detected"),
            JointRule("left_hip",   "LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE", 45, 185,"Excessive forward lean — chest up"),
        ],
        bottom_phases=["bottom"], top_phases=["lockout"],
        phase_detector=_phase_squat,
        cues=["Brace your core", "Drive knees out", "Keep chest tall"],
    ),

    "deadlift": SportSpec(
        key="deadlift", label="Deadlift",
        joint_rules=[
            JointRule("left_hip",  "LEFT_SHOULDER",  "LEFT_HIP",  "LEFT_KNEE",  70, 185, "Back rounding — hinge from hips"),
            JointRule("right_hip", "RIGHT_SHOULDER", "RIGHT_HIP", "RIGHT_KNEE", 70, 185, "Hip asymmetry detected"),
            JointRule("left_knee", "LEFT_HIP",  "LEFT_KNEE",  "LEFT_ANKLE",  120, 185, "Knees too bent — drive through heels"),
        ],
        bottom_phases=["setup"], top_phases=["lockout"],
        phase_detector=_phase_deadlift,
        cues=["Bar close to body", "Lat tension before pull", "Lock hips at top"],
    ),

    "bench_press": SportSpec(
        key="bench_press", label="Bench press",
        joint_rules=[
            JointRule("left_elbow",  "LEFT_SHOULDER",  "LEFT_ELBOW",  "LEFT_WRIST",  55, 175, "Elbow flare — tuck 30–45°"),
            JointRule("right_elbow", "RIGHT_SHOULDER", "RIGHT_ELBOW", "RIGHT_WRIST", 55, 175, "Right elbow asymmetry"),
        ],
        bottom_phases=["bottom"], top_phases=["lockout"],
        phase_detector=_phase_bench,
        cues=["Retract scapula", "Arch naturally", "Drive feet into floor"],
    ),

    "shoulder_press": SportSpec(
        key="shoulder_press", label="Shoulder press",
        joint_rules=[
            JointRule("left_elbow",  "LEFT_SHOULDER",  "LEFT_ELBOW",  "LEFT_WRIST",  60, 180, "Elbow dropping — press vertically"),
            JointRule("right_elbow", "RIGHT_SHOULDER", "RIGHT_ELBOW", "RIGHT_WRIST", 60, 180, "Right side lagging"),
            JointRule("left_hip",    "LEFT_SHOULDER",  "LEFT_HIP",    "LEFT_KNEE",  155, 195, "Excessive lower back arch"),
        ],
        bottom_phases=["bottom"], top_phases=["lockout"],
        phase_detector=_phase_shoulder_press,
        cues=["Neutral spine", "Full lockout overhead", "Breathe out on press"],
    ),

    "lunge": SportSpec(
        key="lunge", label="Lunge",
        joint_rules=[
            JointRule("left_knee",  "LEFT_HIP",  "LEFT_KNEE",  "LEFT_ANKLE",  80, 180, "Knee past toe — step longer"),
            JointRule("right_knee", "RIGHT_HIP", "RIGHT_KNEE", "RIGHT_ANKLE", 80, 180, "Rear knee too high off floor"),
        ],
        bottom_phases=["bottom"], top_phases=["standing"],
        phase_detector=_phase_lunge,
        cues=["Torso upright", "Front knee tracks over second toe"],
    ),

    "pushup": SportSpec(
        key="pushup", label="Push-up",
        joint_rules=[
            JointRule("left_elbow",  "LEFT_SHOULDER",  "LEFT_ELBOW",  "LEFT_WRIST",  60, 185, "Elbow flaring — tuck elbows in"),
            JointRule("left_hip",    "LEFT_SHOULDER",  "LEFT_HIP",    "LEFT_KNEE",  155, 200, "Hips sagging — plank position"),
        ],
        bottom_phases=["bottom"], top_phases=["top"],
        phase_detector=_phase_pushup,
        cues=["Rigid plank", "Chest touches floor", "Full lockout at top"],
    ),

    "pullup": SportSpec(
        key="pullup", label="Pull-up",
        joint_rules=[
            JointRule("left_elbow",  "LEFT_SHOULDER",  "LEFT_ELBOW",  "LEFT_WRIST",  50, 185, "Incomplete range of motion"),
            JointRule("left_shoulder","LEFT_ELBOW","LEFT_SHOULDER","LEFT_HIP",       40, 100,  "Shoulder not depressed — pack shoulders"),
        ],
        bottom_phases=["bottom"], top_phases=["top"],
        phase_detector=_phase_pullup,
        cues=["Dead hang at bottom", "Chin over bar", "No kipping"],
    ),

    "running": SportSpec(
        key="running", label="Running",
        joint_rules=[
            JointRule("left_knee",  "LEFT_HIP",  "LEFT_KNEE",  "LEFT_ANKLE",  70, 175, "Over-striding — shorten step"),
            JointRule("left_hip",   "LEFT_SHOULDER","LEFT_HIP","LEFT_KNEE",   100, 185, "Anterior pelvic tilt — engage core"),
        ],
        bottom_phases=["drive"], top_phases=["extension"],
        phase_detector=_phase_running,
        cues=["Cadence 170–180 spm", "Forward lean from ankles", "Relaxed shoulders"],
    ),

    "cycling": SportSpec(
        key="cycling", label="Cycling",
        joint_rules=[
            JointRule("left_knee",  "LEFT_HIP",  "LEFT_KNEE",  "LEFT_ANKLE",  70, 160, "Knee over-extension — raise saddle"),
            JointRule("left_hip",   "LEFT_SHOULDER","LEFT_HIP","LEFT_KNEE",  110, 160, "Hip rocking — lower saddle"),
        ],
        bottom_phases=["power"], top_phases=["recovery"],
        phase_detector=_phase_cycling,
        cues=["Smooth pedal stroke", "3 o'clock max power", "Knee over pedal axle"],
    ),

    "jump_rope": SportSpec(
        key="jump_rope", label="Jump rope",
        joint_rules=[
            JointRule("left_knee",  "LEFT_HIP",  "LEFT_KNEE",  "LEFT_ANKLE",  140, 185, "Landing too stiff — soften knees"),
            JointRule("left_elbow", "LEFT_SHOULDER","LEFT_ELBOW","LEFT_WRIST", 140, 185, "Arms too wide — elbows in"),
        ],
        bottom_phases=["active"], top_phases=["active"],
        phase_detector=_phase_generic,
        cues=["Wrist rotation only", "Ball of foot landing", "Tight core"],
    ),

    "burpee": SportSpec(
        key="burpee", label="Burpee",
        joint_rules=[
            JointRule("left_hip",  "LEFT_SHOULDER","LEFT_HIP","LEFT_KNEE", 60, 200, "Hips sagging in plank"),
            JointRule("left_knee", "LEFT_HIP","LEFT_KNEE","LEFT_ANKLE",   60, 200, "Jump landing — absorb with knees"),
        ],
        bottom_phases=["active"], top_phases=["active"],
        phase_detector=_phase_generic,
        cues=["Full hip extension at jump", "Chest to floor", "Land softly"],
    ),

    "box_jump": SportSpec(
        key="box_jump", label="Box jump",
        joint_rules=[
            JointRule("left_knee",  "LEFT_HIP","LEFT_KNEE","LEFT_ANKLE",   60, 180, "Landing mechanics — land in squat"),
            JointRule("left_hip",   "LEFT_SHOULDER","LEFT_HIP","LEFT_KNEE", 60, 200, "Hip not extending at takeoff"),
        ],
        bottom_phases=["active"], top_phases=["active"],
        phase_detector=_phase_generic,
        cues=["Triple extension at takeoff", "Soft landing", "Stand fully on box"],
    ),
    "barbell_biceps_curl": SportSpec(
        key="barbell_biceps_curl", label="Barbell biceps curl",
        joint_rules=[
            JointRule("left_elbow",  "LEFT_SHOULDER",  "LEFT_ELBOW",  "LEFT_WRIST",  20, 160, "Full range — extend fully at bottom"),
            JointRule("right_elbow", "RIGHT_SHOULDER", "RIGHT_ELBOW", "RIGHT_WRIST", 20, 160, "Asymmetry detected — match both arms"),
        ],
        bottom_phases=["bottom"], top_phases=["top"],
        phase_detector=lambda a: "top" if a.get("left_elbow", 180) < 60 else "bottom",
        cues=["Elbows fixed at sides", "Squeeze at top", "Controlled negative"],
    ),

    "hammer_curl": SportSpec(
        key="hammer_curl", label="Hammer curl",
        joint_rules=[
            JointRule("left_elbow", "LEFT_SHOULDER", "LEFT_ELBOW", "LEFT_WRIST", 20, 160, "Full ROM — extend at bottom"),
        ],
        bottom_phases=["bottom"], top_phases=["top"],
        phase_detector=lambda a: "top" if a.get("left_elbow", 180) < 70 else "bottom",
        cues=["Neutral grip throughout", "No shoulder swing"],
    ),

    "hip_thrust": SportSpec(
        key="hip_thrust", label="Hip thrust",
        joint_rules=[
            JointRule("left_hip",  "LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE",  155, 200, "Full hip extension — squeeze glutes at top"),
            JointRule("left_knee", "LEFT_HIP",      "LEFT_KNEE","LEFT_ANKLE",  80, 110, "Knee angle off — feet placement"),
        ],
        bottom_phases=["bottom"], top_phases=["top"],
        phase_detector=lambda a: "top" if a.get("left_hip", 0) > 160 else "bottom",
        cues=["Drive hips to ceiling", "Neutral spine at top", "Chin tucked"],
    ),

    "lat_pulldown": SportSpec(
        key="lat_pulldown", label="Lat pulldown",
        joint_rules=[
            JointRule("left_elbow",   "LEFT_SHOULDER",  "LEFT_ELBOW",  "LEFT_WRIST",  40, 185, "Full extension overhead"),
            JointRule("left_shoulder","LEFT_HIP","LEFT_SHOULDER","LEFT_ELBOW",         30, 90,  "Lean back slightly — not excessively"),
        ],
        bottom_phases=["bottom"], top_phases=["top"],
        phase_detector=lambda a: "bottom" if a.get("left_elbow", 180) < 80 else "top",
        cues=["Depress scapula before pulling", "Elbows to hips", "Full stretch at top"],
    ),

    "lateral_raise": SportSpec(
        key="lateral_raise", label="Lateral raise",
        joint_rules=[
            JointRule("left_elbow",  "LEFT_SHOULDER", "LEFT_ELBOW",  "LEFT_WRIST", 140, 185, "Slight elbow bend — don't lock out"),
            JointRule("left_shoulder","LEFT_HIP","LEFT_SHOULDER","LEFT_ELBOW",       70, 100, "Raise to shoulder height only"),
        ],
        bottom_phases=["bottom"], top_phases=["top"],
        phase_detector=lambda a: "top" if a.get("left_shoulder", 0) > 75 else "bottom",
        cues=["Lead with elbows", "Slow eccentric", "No shrugging"],
    ),

    "leg_extension": SportSpec(
        key="leg_extension", label="Leg extension",
        joint_rules=[
            JointRule("left_knee", "LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE", 80, 185, "Full extension at top"),
        ],
        bottom_phases=["bottom"], top_phases=["top"],
        phase_detector=lambda a: "top" if a.get("left_knee", 0) > 160 else "bottom",
        cues=["Full lockout at top", "Controlled descent", "Toes neutral"],
    ),

    "leg_raises": SportSpec(
        key="leg_raises", label="Leg raises",
        joint_rules=[
            JointRule("left_hip", "LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE", 50, 185, "Full ROM — lower legs fully"),
        ],
        bottom_phases=["bottom"], top_phases=["top"],
        phase_detector=lambda a: "top" if a.get("left_hip", 180) < 80 else "bottom",
        cues=["No swinging", "Lower back pressed down", "Controlled lower"],
    ),

    "plank": SportSpec(
        key="plank", label="Plank",
        joint_rules=[
            JointRule("left_hip",  "LEFT_SHOULDER", "LEFT_HIP",  "LEFT_KNEE",  155, 200, "Hips sagging — raise hips"),
            JointRule("right_hip", "RIGHT_SHOULDER","RIGHT_HIP", "RIGHT_KNEE", 155, 200, "Hip rotation detected — stay square"),
        ],
        bottom_phases=["active"], top_phases=["active"],
        phase_detector=_phase_generic,
        cues=["Neutral spine", "Squeeze glutes", "Breathe steadily"],
    ),

    "romanian_deadlift": SportSpec(
        key="romanian_deadlift", label="Romanian deadlift",
        joint_rules=[
            JointRule("left_hip",  "LEFT_SHOULDER",  "LEFT_HIP",  "LEFT_KNEE", 60, 185, "Back rounding — hinge from hips"),
            JointRule("left_knee", "LEFT_HIP",       "LEFT_KNEE", "LEFT_ANKLE",150, 185, "Knees too bent — this is an RDL not deadlift"),
        ],
        bottom_phases=["bottom"], top_phases=["top"],
        phase_detector=lambda a: "top" if a.get("left_hip", 0) > 165 else "bottom",
        cues=["Soft knee bend", "Bar close to legs", "Feel hamstring stretch"],
    ),

    "russian_twist": SportSpec(
        key="russian_twist", label="Russian twist",
        joint_rules=[
            JointRule("left_hip", "LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE", 80, 130, "Lean back 45° — not too upright or flat"),
        ],
        bottom_phases=["active"], top_phases=["active"],
        phase_detector=_phase_generic,
        cues=["Feet off floor for harder variation", "Rotate from core not arms"],
    ),

    "chest_fly_machine": SportSpec(
        key="chest_fly_machine", label="Chest fly machine",
        joint_rules=[
            JointRule("left_elbow",  "LEFT_SHOULDER",  "LEFT_ELBOW",  "LEFT_WRIST", 140, 185, "Slight bend — don't hyperextend"),
            JointRule("left_shoulder","LEFT_HIP","LEFT_SHOULDER","LEFT_ELBOW",        60, 120, "Control the stretch — don't overextend"),
        ],
        bottom_phases=["bottom"], top_phases=["top"],
        phase_detector=lambda a: "top" if a.get("left_shoulder", 0) < 70 else "bottom",
        cues=["Squeeze chest at close", "Controlled stretch", "No shoulder pain"],
    ),

    "decline_bench_press": SportSpec(
        key="decline_bench_press", label="Decline bench press",
        joint_rules=[
            JointRule("left_elbow",  "LEFT_SHOULDER",  "LEFT_ELBOW",  "LEFT_WRIST", 55, 175, "Elbow angle off"),
            JointRule("right_elbow", "RIGHT_SHOULDER", "RIGHT_ELBOW", "RIGHT_WRIST",55, 175, "Asymmetry"),
        ],
        bottom_phases=["bottom"], top_phases=["lockout"],
        phase_detector=_phase_bench,
        cues=["Decline targets lower chest", "Full lockout", "Control the descent"],
    ),

    "incline_bench_press": SportSpec(
        key="incline_bench_press", label="Incline bench press",
        joint_rules=[
            JointRule("left_elbow",  "LEFT_SHOULDER",  "LEFT_ELBOW",  "LEFT_WRIST", 55, 175, "Elbow angle off"),
        ],
        bottom_phases=["bottom"], top_phases=["lockout"],
        phase_detector=_phase_bench,
        cues=["Targets upper chest", "Bar to upper chest", "Retract scapula"],
    ),

    "t_bar_row": SportSpec(
        key="t_bar_row", label="T-bar row",
        joint_rules=[
            JointRule("left_hip",   "LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE", 100, 145, "Torso angle — lean 45°"),
            JointRule("left_elbow", "LEFT_SHOULDER", "LEFT_ELBOW","LEFT_WRIST", 40, 185, "Full row — elbows past torso"),
        ],
        bottom_phases=["bottom"], top_phases=["top"],
        phase_detector=lambda a: "top" if a.get("left_elbow", 180) < 80 else "bottom",
        cues=["Chest to pad", "Elbows close to body", "Squeeze mid-back"],
    ),

    "tricep_dips": SportSpec(
        key="tricep_dips", label="Tricep dips",
        joint_rules=[
            JointRule("left_elbow", "LEFT_SHOULDER", "LEFT_ELBOW", "LEFT_WRIST", 60, 185, "Full lockout at top"),
            JointRule("left_shoulder","LEFT_HIP","LEFT_SHOULDER","LEFT_ELBOW",    50, 120, "Forward lean — stay upright for triceps"),
        ],
        bottom_phases=["bottom"], top_phases=["top"],
        phase_detector=lambda a: "top" if a.get("left_elbow", 0) > 155 else "bottom",
        cues=["Elbows back not flared", "Upright torso", "Full lockout"],
    ),

    "tricep_pushdown": SportSpec(
        key="tricep_pushdown", label="Tricep pushdown",
        joint_rules=[
            JointRule("left_elbow", "LEFT_SHOULDER", "LEFT_ELBOW", "LEFT_WRIST", 20, 185, "Full extension at bottom"),
        ],
        bottom_phases=["bottom"], top_phases=["top"],
        phase_detector=lambda a: "bottom" if a.get("left_elbow", 180) < 40 else "top",
        cues=["Elbows pinned to sides", "Full lockout", "Slow return"],
    ),

    "unknown": SportSpec(
        key="unknown", label="Unknown",
        joint_rules=[],
        bottom_phases=[], top_phases=[],
        phase_detector=_phase_generic,
    ),
}


def get_sport(key: str) -> SportSpec:
    return SPORT_CATALOGUE.get(key, SPORT_CATALOGUE["unknown"])


def list_sports() -> list[dict]:
    return [{"key": k, "label": v.label, "cues": v.cues}
            for k, v in SPORT_CATALOGUE.items() if k != "unknown"]