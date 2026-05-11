# from typing import List
# from ..models.schemas import PoseFrame, FormFeedback, Exercise, JointAngle
# from .pose_engine import PoseEngine

# # ── Angle targets per exercise ────────────────────────────────────────────────
# EXERCISE_RULES = {
#     Exercise.SQUAT: {
#         "phases": {
#             "descent": {"knee_angle": (70, 100), "hip_angle": (60, 100)},
#             "bottom":  {"knee_angle": (70, 95),  "hip_angle": (50, 90)},
#             "ascent":  {"knee_angle": (100, 170), "hip_angle": (90, 170)},
#         },
#         "errors": {
#             "knee_cave":   "Knees caving inward — push them out",
#             "forward_lean":"Excessive forward lean — chest up",
#             "heel_rise":   "Heels rising — keep feet flat",
#         }
#     },
#     Exercise.DEADLIFT: {
#         "phases": {
#             "setup":   {"hip_angle": (90, 130), "back_angle": (20, 50)},
#             "pull":    {"hip_angle": (110, 160), "knee_angle": (130, 170)},
#             "lockout": {"hip_angle": (170, 185), "knee_angle": (170, 185)},
#         },
#         "errors": {
#             "rounded_back": "Back rounding — brace and hinge from hips",
#             "bar_drift":    "Bar drifting away — keep it over mid-foot",
#             "early_hip":    "Hips rising before bar — leg drive first",
#         }
#     },
#     Exercise.BENCH_PRESS: {
#         "phases": {
#             "descent": {"elbow_angle": (60, 90),  "shoulder_angle": (50, 75)},
#             "bottom":  {"elbow_angle": (80, 100), "shoulder_angle": (60, 80)},
#             "ascent":  {"elbow_angle": (90, 170), "shoulder_angle": (70, 110)},
#         },
#         "errors": {
#             "flared_elbows": "Elbows flaring — tuck slightly",
#             "bar_path":      "Bar path inconsistent — press in arc",
#             "wrist_bend":    "Wrists bending — keep them straight",
#         }
#     },
# }

# class FormAnalyser:
#     def __init__(self, engine: PoseEngine):
#         self.engine = engine
#         self._rep_counter = 0
#         self._last_phase = ""
#         self._phase_history: List[str] = []

#     # In form_analyser.py, replace the analyse() method

#     def analyse(self, pose: PoseFrame, exercise: Exercise) -> FormFeedback:
#         # Fallback for exercises not yet in EXERCISE_RULES
#         # Use sport_catalogue rules if available, else return basic feedback
#         angles = self._compute_angles_generic(pose, exercise)
#         phase  = self._detect_phase_generic(angles, exercise)
#         errors, warnings = self._check_rules(angles, phase, exercise)
#         score  = self._score(errors, warnings, angles)

#         if self._last_phase in ("bottom", "setup") and \
#         phase in ("ascent", "pull", "lockout", "top", "standing"):
#             self._rep_counter += 1
#         self._last_phase = phase

#         return FormFeedback(
#             exercise=exercise,
#             rep_count=self._rep_counter,
#             phase=phase,
#             joint_angles=angles,
#             errors=errors,
#             warnings=warnings,
#             score=score,
#         )

#     def _compute_angles_generic(self, pose: PoseFrame, exercise: Exercise) -> List[JointAngle]:
#         """Routes to exercise-specific or catalogue-based angle computation."""
#         from ..services.sport_catalogue import get_sport, SPORT_CATALOGUE

#         ex_key = exercise.value if hasattr(exercise, "value") else str(exercise)

#     # Try sport catalogue first
#         spec = get_sport(ex_key)
#         if spec.joint_rules:
#             g = lambda name: self.engine.get_landmark(pose, name)
#             results = []
#             for rule in spec.joint_rules:
#                 a = g(rule.point_a)
#                 b = g(rule.point_b)
#                 c = g(rule.point_c)
#                 if not all([a, b, c]):
#                     continue
#                 angle = self.engine.calc_angle(a, b, c)
#                 status = ("error" if angle < rule.target_min or angle > rule.target_max + 20
#                           else "warning" if angle > rule.target_max
#                           else "good")
#                 results.append(JointAngle(
#                     name=rule.joint_name, angle=round(angle, 1),
#                     status=status, target_min=rule.target_min, target_max=rule.target_max,
#                 ))
#             return results

#     # Generic fallback — always compute these 4 angles
#         return self._compute_angles(pose, Exercise.SQUAT)

#     def _detect_phase_generic(self, angles: List[JointAngle], exercise: Exercise) -> str:
#         from ..services.sport_catalogue import get_sport
#         ex_key = exercise.value if hasattr(exercise, "value") else str(exercise)
#         spec   = get_sport(ex_key)
#         angle_map = {a.name: a.angle for a in angles}
#         try:
#             return spec.phase_detector(angle_map)
#         except Exception:
#             return "active"

#     def reset(self):
#         self._rep_counter = 0
#         self._last_phase = ""

#     # ── Internals ──────────────────────────────────────────────────────────────

#     def _compute_angles(self, pose: PoseFrame, exercise: Exercise) -> List[JointAngle]:
#         g = lambda name: self.engine.get_landmark(pose, name)
#         results = []

#         def add(joint_name: str, a_name: str, b_name: str, c_name: str,
#                 target_min: float, target_max: float):
#             a, b, c = g(a_name), g(b_name), g(c_name)
#             if not all([a, b, c]):
#                 return
#             angle = self.engine.calc_angle(a, b, c)
#             if angle < target_min:
#                 status = "error"
#             elif angle > target_max:
#                 status = "warning"
#             else:
#                 status = "good"
#             results.append(JointAngle(
#                 name=joint_name, angle=round(angle, 1),
#                 status=status, target_min=target_min, target_max=target_max,
#             ))

#         if exercise == Exercise.SQUAT:
#             add("left_knee",  "LEFT_HIP",  "LEFT_KNEE",  "LEFT_ANKLE",  70, 170)
#             add("right_knee", "RIGHT_HIP", "RIGHT_KNEE", "RIGHT_ANKLE", 70, 170)
#             add("left_hip",   "LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE", 50, 185)
#         elif exercise == Exercise.DEADLIFT:
#             add("left_hip",   "LEFT_SHOULDER",  "LEFT_HIP",  "LEFT_KNEE",  80, 185)
#             add("right_hip",  "RIGHT_SHOULDER", "RIGHT_HIP", "RIGHT_KNEE", 80, 185)
#             add("left_knee",  "LEFT_HIP",  "LEFT_KNEE",  "LEFT_ANKLE",  120, 185)
#         elif exercise == Exercise.BENCH_PRESS:
#             add("left_elbow",  "LEFT_SHOULDER",  "LEFT_ELBOW",  "LEFT_WRIST",  60, 170)
#             add("right_elbow", "RIGHT_SHOULDER", "RIGHT_ELBOW", "RIGHT_WRIST", 60, 170)

#         return results

#     def _detect_phase(self, angles: List[JointAngle], exercise: Exercise) -> str:
#         angle_map = {a.name: a.angle for a in angles}

#         if exercise == Exercise.SQUAT:
#             knee = angle_map.get("left_knee", 180)
#             if knee > 150: return "lockout"
#             if knee > 110: return "ascent"
#             if knee <= 110: return "bottom"
#             return "descent"

#         if exercise == Exercise.DEADLIFT:
#             hip = angle_map.get("left_hip", 180)
#             if hip > 165: return "lockout"
#             if hip > 120: return "pull"
#             return "setup"

#         if exercise == Exercise.BENCH_PRESS:
#             elbow = angle_map.get("left_elbow", 180)
#             if elbow > 150: return "lockout"
#             if elbow < 100: return "bottom"
#             if elbow > 100: return "ascent"
#             return "descent"

#         return "unknown"

#     def _check_rules(self, angles: List[JointAngle], phase: str, exercise: Exercise):
#         errors, warnings = [], []
#         for a in angles:
#             if a.status == "error":
#                 errors.append(f"{a.name.replace('_', ' ').title()}: {a.angle}° (target {a.target_min}–{a.target_max}°)")
#             elif a.status == "warning":
#                 warnings.append(f"{a.name.replace('_', ' ').title()}: {a.angle}° slightly off range")
#         return errors, warnings

#     def _score(self, errors, warnings, angles) -> float:
#         base = 100.0
#         base -= len(errors) * 15
#         base -= len(warnings) * 5
#         return max(0.0, min(100.0, base))

from typing import List, Tuple
from ..models.schemas import PoseFrame, FormFeedback, Exercise, JointAngle
from .pose_engine import PoseEngine
from .rep_counter import RepCounter

# Per-exercise ideal joint angles (tighter ranges = more sensitive scoring)
ANGLE_SPECS: dict[str, list[dict]] = {
    "squat": [
        {"name": "left_knee",  "a": "LEFT_HIP",      "b": "LEFT_KNEE",   "c": "LEFT_ANKLE",
         "ideal": 90,  "min": 65,  "max": 170, "error": "Knee angle out of range"},
        {"name": "right_knee", "a": "RIGHT_HIP",     "b": "RIGHT_KNEE",  "c": "RIGHT_ANKLE",
         "ideal": 90,  "min": 65,  "max": 170, "error": "Right knee asymmetry"},
        {"name": "hip_hinge",  "a": "LEFT_SHOULDER", "b": "LEFT_HIP",    "c": "LEFT_KNEE",
         "ideal": 90,  "min": 50,  "max": 170, "error": "Excessive forward lean — chest up"},
    ],
    "deadlift": [
        {"name": "hip_hinge",  "a": "LEFT_SHOULDER", "b": "LEFT_HIP",    "c": "LEFT_KNEE",
         "ideal": 130, "min": 70,  "max": 185, "error": "Back rounding — hinge at hips"},
        {"name": "left_knee",  "a": "LEFT_HIP",      "b": "LEFT_KNEE",   "c": "LEFT_ANKLE",
         "ideal": 160, "min": 120, "max": 185, "error": "Knees too bent — push through heels"},
    ],
    "romanian_deadlift": [
        {"name": "hip_hinge",  "a": "LEFT_SHOULDER", "b": "LEFT_HIP",    "c": "LEFT_KNEE",
         "ideal": 120, "min": 60,  "max": 185, "error": "Back rounding — hinge at hips"},
        {"name": "knee_bend",  "a": "LEFT_HIP",      "b": "LEFT_KNEE",   "c": "LEFT_ANKLE",
         "ideal": 170, "min": 150, "max": 185, "error": "Too much knee bend — this is an RDL"},
    ],
    "bench_press": [
        {"name": "left_elbow", "a": "LEFT_SHOULDER", "b": "LEFT_ELBOW",  "c": "LEFT_WRIST",
         "ideal": 90,  "min": 55,  "max": 170, "error": "Elbow angle off — check grip width"},
        {"name": "right_elbow","a": "RIGHT_SHOULDER","b": "RIGHT_ELBOW", "c": "RIGHT_WRIST",
         "ideal": 90,  "min": 55,  "max": 170, "error": "Right elbow asymmetry"},
    ],
    "incline_bench_press": [
        {"name": "left_elbow", "a": "LEFT_SHOULDER", "b": "LEFT_ELBOW",  "c": "LEFT_WRIST",
         "ideal": 90,  "min": 55,  "max": 170, "error": "Elbow angle off"},
    ],
    "decline_bench_press": [
        {"name": "left_elbow", "a": "LEFT_SHOULDER", "b": "LEFT_ELBOW",  "c": "LEFT_WRIST",
         "ideal": 90,  "min": 55,  "max": 170, "error": "Elbow angle off"},
    ],
    "shoulder_press": [
        {"name": "left_elbow", "a": "LEFT_SHOULDER", "b": "LEFT_ELBOW",  "c": "LEFT_WRIST",
         "ideal": 90,  "min": 60,  "max": 180, "error": "Press vertically — elbow angle off"},
        {"name": "back_arch",  "a": "LEFT_SHOULDER", "b": "LEFT_HIP",    "c": "LEFT_KNEE",
         "ideal": 180, "min": 155, "max": 195, "error": "Excessive lower back arch"},
    ],
    "barbell_biceps_curl": [
        {"name": "left_elbow", "a": "LEFT_SHOULDER", "b": "LEFT_ELBOW",  "c": "LEFT_WRIST",
         "ideal": 60,  "min": 20,  "max": 155, "error": "Full ROM — extend fully at bottom"},
        {"name": "right_elbow","a": "RIGHT_SHOULDER","b": "RIGHT_ELBOW", "c": "RIGHT_WRIST",
         "ideal": 60,  "min": 20,  "max": 155, "error": "Asymmetry — match both arms"},
    ],
    "hammer_curl": [
        {"name": "left_elbow", "a": "LEFT_SHOULDER", "b": "LEFT_ELBOW",  "c": "LEFT_WRIST",
         "ideal": 60,  "min": 20,  "max": 160, "error": "Full ROM — extend at bottom"},
    ],
    "lateral_raise": [
        {"name": "shoulder_abduction", "a": "LEFT_HIP", "b": "LEFT_SHOULDER", "c": "LEFT_ELBOW",
         "ideal": 85,  "min": 65,  "max": 100, "error": "Raise to shoulder height only"},
    ],
    "lat_pulldown": [
        {"name": "left_elbow", "a": "LEFT_SHOULDER", "b": "LEFT_ELBOW",  "c": "LEFT_WRIST",
         "ideal": 60,  "min": 40,  "max": 185, "error": "Full stretch at top"},
    ],
    "pullup": [
        {"name": "left_elbow", "a": "LEFT_SHOULDER", "b": "LEFT_ELBOW",  "c": "LEFT_WRIST",
         "ideal": 60,  "min": 50,  "max": 185, "error": "Full ROM — dead hang at bottom"},
    ],
    "pushup": [
        {"name": "left_elbow", "a": "LEFT_SHOULDER", "b": "LEFT_ELBOW",  "c": "LEFT_WRIST",
         "ideal": 90,  "min": 60,  "max": 185, "error": "Elbow flaring — tuck elbows"},
        {"name": "body_line",  "a": "LEFT_SHOULDER", "b": "LEFT_HIP",    "c": "LEFT_KNEE",
         "ideal": 180, "min": 155, "max": 200, "error": "Hips sagging — rigid plank position"},
    ],
    "tricep_dips": [
        {"name": "left_elbow", "a": "LEFT_SHOULDER", "b": "LEFT_ELBOW",  "c": "LEFT_WRIST",
         "ideal": 90,  "min": 60,  "max": 185, "error": "Full lockout at top"},
    ],
    "tricep_pushdown": [
        {"name": "left_elbow", "a": "LEFT_SHOULDER", "b": "LEFT_ELBOW",  "c": "LEFT_WRIST",
         "ideal": 40,  "min": 20,  "max": 185, "error": "Full extension at bottom"},
    ],
    "hip_thrust": [
        {"name": "hip_ext",    "a": "LEFT_SHOULDER", "b": "LEFT_HIP",    "c": "LEFT_KNEE",
         "ideal": 180, "min": 155, "max": 200, "error": "Full hip extension — squeeze glutes"},
        {"name": "knee_angle", "a": "LEFT_HIP",      "b": "LEFT_KNEE",   "c": "LEFT_ANKLE",
         "ideal": 90,  "min": 80,  "max": 110, "error": "Knee angle off — adjust foot position"},
    ],
    "lunge": [
        {"name": "front_knee", "a": "LEFT_HIP",      "b": "LEFT_KNEE",   "c": "LEFT_ANKLE",
         "ideal": 90,  "min": 75,  "max": 120, "error": "Knee past toe — step longer"},
    ],
    "leg_extension": [
        {"name": "left_knee",  "a": "LEFT_HIP",      "b": "LEFT_KNEE",   "c": "LEFT_ANKLE",
         "ideal": 150, "min": 80,  "max": 185, "error": "Full extension at top"},
    ],
    "leg_raises": [
        {"name": "hip_flex",   "a": "LEFT_SHOULDER", "b": "LEFT_HIP",    "c": "LEFT_KNEE",
         "ideal": 90,  "min": 50,  "max": 185, "error": "Full ROM — lower legs fully"},
    ],
    "chest_fly_machine": [
        {"name": "shoulder",   "a": "LEFT_HIP",      "b": "LEFT_SHOULDER","c": "LEFT_ELBOW",
         "ideal": 90,  "min": 60,  "max": 120, "error": "Control the stretch — don't overextend"},
    ],
    "t_bar_row": [
        {"name": "torso_angle","a": "LEFT_SHOULDER", "b": "LEFT_HIP",    "c": "LEFT_KNEE",
         "ideal": 120, "min": 100, "max": 145, "error": "Torso angle off — lean 45°"},
        {"name": "left_elbow", "a": "LEFT_SHOULDER", "b": "LEFT_ELBOW",  "c": "LEFT_WRIST",
         "ideal": 60,  "min": 40,  "max": 185, "error": "Full row — elbows past torso"},
    ],
    "russian_twist": [
        {"name": "trunk_lean", "a": "LEFT_SHOULDER", "b": "LEFT_HIP",    "c": "LEFT_KNEE",
         "ideal": 105, "min": 80,  "max": 130, "error": "Lean back 45° — not too upright"},
    ],
    "plank": [
        {"name": "body_line",  "a": "LEFT_SHOULDER", "b": "LEFT_HIP",    "c": "LEFT_KNEE",
         "ideal": 180, "min": 155, "max": 200, "error": "Hips sagging — raise them"},
    ],
}

# Exercises where "going up" = rep complete (pulling movements)
PULLING_EXERCISES = {
    "pullup", "lat_pulldown", "barbell_biceps_curl", "hammer_curl",
    "t_bar_row", "leg_extension", "leg_raises",
}


class FormAnalyser:
    # def __init__(self, engine: PoseEngine, exercise: str = "unknown"):
    #     self.engine   = engine
    #     self.exercise = exercise
    #     self._rep_counter = RepCounter(exercise)

    # def set_exercise(self, exercise: str):
    #     if exercise != self.exercise:
    #         self.exercise = exercise
    #         self._rep_counter.set_exercise(exercise)
    def __init__(self, engine: PoseEngine, exercise: str = "unknown"):
        self.engine    = engine
        self.exercise  = exercise
        self._rep_counter = RepCounter(exercise)
    # Lock-in: once confirmed, don't reset on every frame
        self._exercise_lock  = False
        self._lock_threshold = 8   # frames with same prediction before locking

    def set_exercise(self, exercise: str):
        """
        Only resets the rep counter when exercise changes AND isn't locked.
        Once locked, ignores further changes from auto-detection noise.
        """
        if exercise == self.exercise:
            return
        # Never override a locked exercise with "unknown"
        if self._exercise_lock and exercise == "unknown":
            return
        self.exercise = exercise
        self._rep_counter.set_exercise(exercise)
        if exercise != "unknown":
            self._exercise_lock = True   # lock once we have a real exercise

    def analyse(self, pose: PoseFrame, exercise) -> FormFeedback:
        ex_key = exercise.value if hasattr(exercise, "value") else str(exercise)
        self.set_exercise(ex_key)

        angles              = self._compute_angles(pose, ex_key)
        errors, warnings    = self._check_angles(angles)
        score               = self._score(angles, errors, warnings)
        rep_count, phase    = self._rep_counter.update(pose)

        return FormFeedback(
            exercise=exercise,
            rep_count=rep_count,
            phase=phase,
            joint_angles=angles,
            errors=errors,
            warnings=warnings,
            score=score,
        )

    def reset(self):
        self._rep_counter.reset()

    # ── Internals ──────────────────────────────────────────────────────────

    def _compute_angles(self, pose: PoseFrame, ex_key: str) -> List[JointAngle]:
        specs = ANGLE_SPECS.get(ex_key, [])
        if not specs:
            # Generic fallback — compute 4 core angles
            specs = [
                {"name": "left_knee",  "a": "LEFT_HIP",  "b": "LEFT_KNEE",  "c": "LEFT_ANKLE",
                 "ideal": 150, "min": 60, "max": 185, "error": ""},
                {"name": "right_knee", "a": "RIGHT_HIP", "b": "RIGHT_KNEE", "c": "RIGHT_ANKLE",
                 "ideal": 150, "min": 60, "max": 185, "error": ""},
                {"name": "left_elbow", "a": "LEFT_SHOULDER","b": "LEFT_ELBOW","c": "LEFT_WRIST",
                 "ideal": 150, "min": 20, "max": 185, "error": ""},
                {"name": "hip",        "a": "LEFT_SHOULDER","b": "LEFT_HIP", "c": "LEFT_KNEE",
                 "ideal": 160, "min": 50, "max": 200, "error": ""},
            ]

        kp_map = {kp.name: kp for kp in pose.keypoints}
        results = []

        for s in specs:
            a = kp_map.get(s["a"])
            b = kp_map.get(s["b"])
            c = kp_map.get(s["c"])
            if not all([a, b, c]):
                continue
            if min(a.visibility, b.visibility, c.visibility) < 0.3:
                continue

            angle = self.engine.calc_angle(a, b, c)

            if angle < s["min"]:
                status = "error"
            elif angle > s["max"]:
                status = "error"
            else:
                # Within range — warn if more than 30% from ideal
                ideal  = s["ideal"]
                half   = max(s["max"] - s["min"], 1) / 2
                dev    = abs(angle - ideal) / half
                status = "warning" if dev > 0.6 else "good"

            results.append(JointAngle(
                name=s["name"], angle=round(angle, 1),
                status=status,
                target_min=s["min"], target_max=s["max"],
            ))

        return results

    def _check_angles(self, angles: List[JointAngle]) -> Tuple[List[str], List[str]]:
        errors, warnings = [], []
        # Map angle name → spec to get error message
        # We rebuild from ANGLE_SPECS since JointAngle doesn't store the message
        ex_specs = {s["name"]: s for s in ANGLE_SPECS.get(self.exercise, [])}

        for a in angles:
            spec = ex_specs.get(a.name, {})
            msg_base = spec.get("error", a.name.replace("_", " "))
            if a.status == "error":
                errors.append(f"{msg_base} ({a.angle}° — target {a.target_min}–{a.target_max}°)")
            elif a.status == "warning":
                warnings.append(f"{msg_base.split('—')[0].strip()} slightly off ({a.angle}°)")

        return errors, warnings

    def _score(self, angles: List[JointAngle], errors: list, warnings: list) -> float:
        """
        Deviation-based score: how close are angles to ideal, not just binary in/out.
        """
        if not angles:
            return 50.0   # no data — neutral

        specs = {s["name"]: s for s in ANGLE_SPECS.get(self.exercise, [])}
        total_dev, total_w = 0.0, 0.0

        for a in angles:
            s     = specs.get(a.name)
            ideal = s["ideal"] if s else (a.target_min + a.target_max) / 2
            rng   = max(a.target_max - a.target_min, 1)
            # Normalised deviation: 0 = perfect, 1 = at range edge, >1 = outside range
            dev   = abs(a.angle - ideal) / (rng / 2)
            total_dev += min(dev, 2.0)
            total_w   += 1.0

        if total_w == 0:
            return 50.0

        avg_dev = total_dev / total_w
        # avg_dev 0 → score 100, avg_dev 2 → score 0
        score = (1.0 - avg_dev / 2.0) * 100.0

        # Additional penalty for rule violations
        score -= len(errors)   * 8.0
        score -= len(warnings) * 3.0

        return round(max(0.0, min(100.0, score)), 1)