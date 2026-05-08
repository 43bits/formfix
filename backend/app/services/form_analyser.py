from typing import List
from ..models.schemas import PoseFrame, FormFeedback, Exercise, JointAngle
from .pose_engine import PoseEngine

# ── Angle targets per exercise ────────────────────────────────────────────────
EXERCISE_RULES = {
    Exercise.SQUAT: {
        "phases": {
            "descent": {"knee_angle": (70, 100), "hip_angle": (60, 100)},
            "bottom":  {"knee_angle": (70, 95),  "hip_angle": (50, 90)},
            "ascent":  {"knee_angle": (100, 170), "hip_angle": (90, 170)},
        },
        "errors": {
            "knee_cave":   "Knees caving inward — push them out",
            "forward_lean":"Excessive forward lean — chest up",
            "heel_rise":   "Heels rising — keep feet flat",
        }
    },
    Exercise.DEADLIFT: {
        "phases": {
            "setup":   {"hip_angle": (90, 130), "back_angle": (20, 50)},
            "pull":    {"hip_angle": (110, 160), "knee_angle": (130, 170)},
            "lockout": {"hip_angle": (170, 185), "knee_angle": (170, 185)},
        },
        "errors": {
            "rounded_back": "Back rounding — brace and hinge from hips",
            "bar_drift":    "Bar drifting away — keep it over mid-foot",
            "early_hip":    "Hips rising before bar — leg drive first",
        }
    },
    Exercise.BENCH_PRESS: {
        "phases": {
            "descent": {"elbow_angle": (60, 90),  "shoulder_angle": (50, 75)},
            "bottom":  {"elbow_angle": (80, 100), "shoulder_angle": (60, 80)},
            "ascent":  {"elbow_angle": (90, 170), "shoulder_angle": (70, 110)},
        },
        "errors": {
            "flared_elbows": "Elbows flaring — tuck slightly",
            "bar_path":      "Bar path inconsistent — press in arc",
            "wrist_bend":    "Wrists bending — keep them straight",
        }
    },
}

class FormAnalyser:
    def __init__(self, engine: PoseEngine):
        self.engine = engine
        self._rep_counter = 0
        self._last_phase = ""
        self._phase_history: List[str] = []

    def analyse(self, pose: PoseFrame, exercise: Exercise) -> FormFeedback:
        angles = self._compute_angles(pose, exercise)
        phase = self._detect_phase(angles, exercise)
        errors, warnings = self._check_rules(angles, phase, exercise)
        score = self._score(errors, warnings, angles)

        # Simple rep counter: bottom → ascent transition
        if self._last_phase in ("bottom", "setup") and phase in ("ascent", "pull", "lockout"):
            self._rep_counter += 1
        self._last_phase = phase

        return FormFeedback(
            exercise=exercise,
            rep_count=self._rep_counter,
            phase=phase,
            joint_angles=angles,
            errors=errors,
            warnings=warnings,
            score=score,
        )

    def reset(self):
        self._rep_counter = 0
        self._last_phase = ""

    # ── Internals ──────────────────────────────────────────────────────────────

    def _compute_angles(self, pose: PoseFrame, exercise: Exercise) -> List[JointAngle]:
        g = lambda name: self.engine.get_landmark(pose, name)
        results = []

        def add(joint_name: str, a_name: str, b_name: str, c_name: str,
                target_min: float, target_max: float):
            a, b, c = g(a_name), g(b_name), g(c_name)
            if not all([a, b, c]):
                return
            angle = self.engine.calc_angle(a, b, c)
            if angle < target_min:
                status = "error"
            elif angle > target_max:
                status = "warning"
            else:
                status = "good"
            results.append(JointAngle(
                name=joint_name, angle=round(angle, 1),
                status=status, target_min=target_min, target_max=target_max,
            ))

        if exercise == Exercise.SQUAT:
            add("left_knee",  "LEFT_HIP",  "LEFT_KNEE",  "LEFT_ANKLE",  70, 170)
            add("right_knee", "RIGHT_HIP", "RIGHT_KNEE", "RIGHT_ANKLE", 70, 170)
            add("left_hip",   "LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE", 50, 185)
        elif exercise == Exercise.DEADLIFT:
            add("left_hip",   "LEFT_SHOULDER",  "LEFT_HIP",  "LEFT_KNEE",  80, 185)
            add("right_hip",  "RIGHT_SHOULDER", "RIGHT_HIP", "RIGHT_KNEE", 80, 185)
            add("left_knee",  "LEFT_HIP",  "LEFT_KNEE",  "LEFT_ANKLE",  120, 185)
        elif exercise == Exercise.BENCH_PRESS:
            add("left_elbow",  "LEFT_SHOULDER",  "LEFT_ELBOW",  "LEFT_WRIST",  60, 170)
            add("right_elbow", "RIGHT_SHOULDER", "RIGHT_ELBOW", "RIGHT_WRIST", 60, 170)

        return results

    def _detect_phase(self, angles: List[JointAngle], exercise: Exercise) -> str:
        angle_map = {a.name: a.angle for a in angles}

        if exercise == Exercise.SQUAT:
            knee = angle_map.get("left_knee", 180)
            if knee > 150: return "lockout"
            if knee > 110: return "ascent"
            if knee <= 110: return "bottom"
            return "descent"

        if exercise == Exercise.DEADLIFT:
            hip = angle_map.get("left_hip", 180)
            if hip > 165: return "lockout"
            if hip > 120: return "pull"
            return "setup"

        if exercise == Exercise.BENCH_PRESS:
            elbow = angle_map.get("left_elbow", 180)
            if elbow > 150: return "lockout"
            if elbow < 100: return "bottom"
            if elbow > 100: return "ascent"
            return "descent"

        return "unknown"

    def _check_rules(self, angles: List[JointAngle], phase: str, exercise: Exercise):
        errors, warnings = [], []
        for a in angles:
            if a.status == "error":
                errors.append(f"{a.name.replace('_', ' ').title()}: {a.angle}° (target {a.target_min}–{a.target_max}°)")
            elif a.status == "warning":
                warnings.append(f"{a.name.replace('_', ' ').title()}: {a.angle}° slightly off range")
        return errors, warnings

    def _score(self, errors, warnings, angles) -> float:
        base = 100.0
        base -= len(errors) * 15
        base -= len(warnings) * 5
        return max(0.0, min(100.0, base))