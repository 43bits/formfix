"""
Signal-based rep counter.
Tracks primary joint Y-position as a motion signal.
Uses zero-crossing with hysteresis — works for all 22 exercises.
No angle thresholds, no phase labels needed.
"""

from collections import deque
from typing import Optional
import numpy as np

# Primary tracking joints per exercise
# Y-axis movement of these joints = the rep signal
SIGNAL_MAP: dict[str, list[str]] = {
    "squat":               ["LEFT_HIP",      "RIGHT_HIP"],
    "deadlift":            ["LEFT_HIP",      "RIGHT_HIP"],
    "romanian_deadlift":   ["LEFT_HIP",      "RIGHT_HIP"],
    "hip_thrust":          ["LEFT_HIP",      "RIGHT_HIP"],
    "lunge":               ["LEFT_HIP",      "RIGHT_HIP"],
    "bench_press":         ["LEFT_WRIST",    "RIGHT_WRIST"],
    "incline_bench_press": ["LEFT_WRIST",    "RIGHT_WRIST"],
    "decline_bench_press": ["LEFT_WRIST",    "RIGHT_WRIST"],
    "chest_fly_machine":   ["LEFT_WRIST",    "RIGHT_WRIST"],
    "shoulder_press":      ["LEFT_WRIST",    "RIGHT_WRIST"],
    "lateral_raise":       ["LEFT_WRIST",    "RIGHT_WRIST"],
    "barbell_biceps_curl": ["LEFT_WRIST",    "RIGHT_WRIST"],
    "hammer_curl":         ["LEFT_WRIST",    "RIGHT_WRIST"],
    "tricep_dips":         ["LEFT_SHOULDER", "RIGHT_SHOULDER"],
    "tricep_pushdown":     ["LEFT_WRIST",    "RIGHT_WRIST"],
    "lat_pulldown":        ["LEFT_WRIST",    "RIGHT_WRIST"],
    "t_bar_row":           ["LEFT_WRIST",    "RIGHT_WRIST"],
    "pullup":              ["LEFT_SHOULDER", "RIGHT_SHOULDER"],
    "pushup":              ["LEFT_SHOULDER", "RIGHT_SHOULDER"],
    "leg_extension":       ["LEFT_ANKLE",    "RIGHT_ANKLE"],
    "leg_raises":          ["LEFT_ANKLE",    "RIGHT_ANKLE"],
    "russian_twist":       ["LEFT_WRIST",    "RIGHT_WRIST"],
    "plank":               ["LEFT_HIP",      "RIGHT_HIP"],
    "running":             ["LEFT_KNEE",     "RIGHT_KNEE"],
    "cycling":             ["LEFT_KNEE",     "RIGHT_KNEE"],
    "jump_rope":           ["LEFT_ANKLE",    "RIGHT_ANKLE"],
    "burpee":              ["LEFT_HIP",      "RIGHT_HIP"],
    "box_jump":            ["LEFT_HIP",      "RIGHT_HIP"],
}

_DEFAULT_JOINTS = ["LEFT_HIP", "RIGHT_HIP"]

BUFFER_SIZE     = 90      # frames kept in rolling window
SMOOTH_WINDOW   = 7       # rolling average smoothing
HYSTERESIS      = 0.20    # 20% of range — prevents noise triggering
MIN_RANGE       = 0.015   # minimum Y movement to consider "active"
CALIBRATE_AFTER = 25      # frames before enabling counting


class RepCounter:
    """
    One instance per session / per WebSocket connection.
    Call update() on every pose frame.
    """

    def __init__(self, exercise: str = "unknown"):
        self.exercise  = exercise
        self._joints   = SIGNAL_MAP.get(exercise, _DEFAULT_JOINTS)

        self._raw: deque[float] = deque(maxlen=BUFFER_SIZE)
        self._smooth: list[float] = []

        self._count  = 0
        self._state  = "neutral"   # "high" | "low" | "neutral"
        self._frame  = 0

        self._range_min =  float("inf")
        self._range_max = -float("inf")

        @property
        def _threshold(self) -> float:
            return (self._range_min + self._range_max) / 2.0

    def update(self, pose_frame) -> tuple[int, str]:
        """
        Returns (rep_count, phase_label).
        phase_label: "up" | "down" | "calibrating" | "still"
        """
        self._frame += 1
        val = self._extract(pose_frame)
        if val is None:
            return self._count, "no_pose"

        self._raw.append(val)
        self._update_range(val)

        if self._frame < CALIBRATE_AFTER:
            return self._count, "calibrating"

        motion_range = self._range_max - self._range_min
        if motion_range < MIN_RANGE:
            return self._count, "still"

        # Smooth signal
        raw_list = list(self._raw)
        w = min(SMOOTH_WINDOW, len(raw_list))
        smoothed = float(np.convolve(raw_list, np.ones(w) / w, mode="same")[-1])

        # Hysteresis thresholds
        mid  = (self._range_min + self._range_max) / 2.0
        band = motion_range * HYSTERESIS
        high = mid + band
        low  = mid - band

        prev_state = self._state

        if self._state == "neutral":
            if smoothed >= high:
                self._state = "high"
            elif smoothed <= low:
                self._state = "low"

        elif self._state == "high":
            if smoothed <= low:
                self._state = "low"
                self._count += 1   # high→low = one rep

        elif self._state == "low":
            if smoothed >= high:
                self._state = "high"
                self._count += 1   # low→high = one rep (for pulling movements)

        # Determine display label
        if self._state == "high":
            phase = "up"
        elif self._state == "low":
            phase = "down"
        else:
            phase = "neutral"

        return self._count, phase

    def reset(self):
        self._raw.clear()
        self._count   = 0
        self._state   = "neutral"
        self._frame   = 0
        self._range_min =  float("inf")
        self._range_max = -float("inf")

    def set_exercise(self, exercise: str):
        self.exercise = exercise
        self._joints  = SIGNAL_MAP.get(exercise, _DEFAULT_JOINTS)
        self.reset()

    # ── Internals ──────────────────────────────────────────────────────────

    def _extract(self, pose_frame) -> Optional[float]:
        kp_map = {kp.name: kp for kp in pose_frame.keypoints}
        vals = []
        for name in self._joints:
            kp = kp_map.get(name)
            if kp and kp.visibility > 0.35:
                vals.append(kp.y)
        return float(np.mean(vals)) if vals else None

    def _update_range(self, val: float):
        if val < self._range_min:
            self._range_min = val
        if val > self._range_max:
            self._range_max = val