"""
ONNX Runtime inference for the trained workout model.
Model: form_classifier.onnx
  Input:  'pose_sequence'  (1, 60, 48) — 60 frames × 12 joints × 4 features
  Output: 'exercise'       (1, 22)     — softmax over 22 classes
  Output: 'quality'        (1, 1)      — IGNORED (trained with all-ones → always 1.0)

Joint extraction order MUST match dataset_builder.py:
  LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_ELBOW, RIGHT_ELBOW,
  LEFT_WRIST, RIGHT_WRIST, LEFT_HIP, RIGHT_HIP,
  LEFT_KNEE, RIGHT_KNEE, LEFT_ANKLE, RIGHT_ANKLE
"""

import os
import numpy as np
from collections import deque
from typing import Optional
from ..config import settings

# ── Exact class order from sorted(os.listdir(dataset_dir)) ────────────────────
EXERCISE_NAMES = [
    "barbell_biceps_curl",   # 0
    "bench_press",           # 1
    "chest_fly_machine",     # 2
    "deadlift",              # 3
    "decline_bench_press",   # 4
    "hammer_curl",           # 5
    "hip_thrust",            # 6
    "incline_bench_press",   # 7
    "lat_pulldown",          # 8
    "lateral_raise",         # 9
    "leg_extension",         # 10
    "leg_raises",            # 11
    "plank",                 # 12
    "pull_up",               # 13  (folder: "pull Up")
    "push_up",               # 14  (folder: "push-up")
    "romanian_deadlift",     # 15
    "russian_twist",         # 16
    "shoulder_press",        # 17
    "squat",                 # 18
    "t_bar_row",             # 19
    "tricep_pushdown",       # 20  (folder: "tricep Pushdown")
    "tricep_dips",           # 21
]

# ── Feature extraction — MUST match dataset_builder.py ───────────────────────
JOINT_ORDER = [
    "LEFT_SHOULDER", "RIGHT_SHOULDER",
    "LEFT_ELBOW",    "RIGHT_ELBOW",
    "LEFT_WRIST",    "RIGHT_WRIST",
    "LEFT_HIP",      "RIGHT_HIP",
    "LEFT_KNEE",     "RIGHT_KNEE",
    "LEFT_ANKLE",    "RIGHT_ANKLE",
]

SEQUENCE_LENGTH = 60
FEATURE_DIM     = 48   # 12 joints × 4 (x, y, z, visibility)
MIN_VISIBILITY  = 0.3
CONFIDENCE_MIN  = 0.55  # below this, don't override user selection


class ModelLoader:
    """
    Buffers 60 pose frames, runs exercise classification every time
    the buffer is full, then slides by 10 frames.
    """

    def __init__(self):
        self._session    = None
        self._mode       = "heuristic"
        self._frame_buf: deque = deque(maxlen=SEQUENCE_LENGTH)
        self._votes: deque     = deque(maxlen=15)   # rolling majority vote
        self._last_result: dict = {
            "exercise": "unknown",
            "confidence": 0.0,
            "all_probs": {},
        }
        self._frames_since_inference = 0
        self._infer_every = 10  # slide window by 10 frames
        self._load()

    # ── Public API ────────────────────────────────────────────────────────────

    def push_frame(self, pose_frame) -> dict:
        """
        Feed one PoseFrame. Returns classification result.
        Only re-infers every `_infer_every` frames once buffer is full.
        """
        vec = self._extract_features(pose_frame)
        if vec is None:
            return self._last_result

        self._frame_buf.append(vec)
        self._frames_since_inference += 1

        if (len(self._frame_buf) == SEQUENCE_LENGTH and
                self._frames_since_inference >= self._infer_every):
            self._frames_since_inference = 0
            result = self._infer()
            if result:
                self._last_result = result

        return self._last_result

    def majority_exercise(self) -> tuple[str, float]:
        """Returns (exercise_key, confidence) from rolling vote window."""
        if not self._votes:
            return "unknown", 0.0
        counts: dict[str, float] = {}
        for ex, conf in self._votes:
            counts[ex] = counts.get(ex, 0.0) + conf
        best = max(counts, key=lambda k: counts[k])
        total = sum(counts.values())
        return best, counts[best] / total if total > 0 else 0.0

    @property
    def has_model(self) -> bool:
        return self._mode == "onnx"

    def reset(self):
        self._frame_buf.clear()
        self._votes.clear()
        self._frames_since_inference = 0
        self._last_result = {"exercise": "unknown", "confidence": 0.0, "all_probs": {}}

    # ── Internals ─────────────────────────────────────────────────────────────

    def _load(self):
        onnx_path = os.path.join(settings.model_dir, "form_classifier.onnx")
        if not os.path.exists(onnx_path):
            print(f"[ModelLoader] No model at {onnx_path} — heuristic mode")
            return
        try:
            import onnxruntime as ort
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = 2
            opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            self._session = ort.InferenceSession(
                onnx_path,
                sess_options=opts,
                providers=["CPUExecutionProvider"],
            )
            self._mode = "onnx"
            print(f"[ModelLoader] Loaded {onnx_path}")
            print(f"[ModelLoader] Input: {self._session.get_inputs()[0].shape}")
            print(f"[ModelLoader] Classes: {len(EXERCISE_NAMES)}")
        except Exception as e:
            print(f"[ModelLoader] Load failed: {e}")

    def _infer(self) -> Optional[dict]:
        if self._session is None:
            return None
        seq = np.stack(list(self._frame_buf)).astype(np.float32)  # (60, 48)
        inp = seq[np.newaxis]                                       # (1, 60, 48)
        try:
            outs = self._session.run(None, {"pose_sequence": inp})
        except Exception as e:
            print(f"[ModelLoader] inference error: {e}")
            return None

        # outs[0] = exercise probs (1, 22)
        # outs[1] = quality (1, 1) — ALWAYS ~1.0, we ignore it
        ex_probs = outs[0][0]  # (22,)
        idx      = int(np.argmax(ex_probs))
        conf     = float(ex_probs[idx])
        name     = EXERCISE_NAMES[idx] if idx < len(EXERCISE_NAMES) else "unknown"

        # Accumulate vote
        self._votes.append((name, conf))

        all_probs = {
            EXERCISE_NAMES[i]: round(float(p), 4)
            for i, p in enumerate(ex_probs)
            if float(p) > 0.01
        }

        return {"exercise": name, "confidence": round(conf, 3), "all_probs": all_probs}

    def _extract_features(self, pose_frame) -> Optional[np.ndarray]:
        """Build 48-feature vector in EXACT training order."""
        kp_map = {kp.name: kp for kp in pose_frame.keypoints}
        vec = []
        for joint_name in JOINT_ORDER:
            kp = kp_map.get(joint_name)
            if kp and kp.visibility >= MIN_VISIBILITY:
                vec.extend([kp.x, kp.y, kp.z, kp.visibility])
            else:
                vec.extend([0.0, 0.0, 0.0, 0.0])  # zero-pad invisible joints
        return np.array(vec, dtype=np.float32)  # (48,)


# ── Singleton ──────────────────────────────────────────────────────────────────
_loader: Optional[ModelLoader] = None

def get_model_loader() -> ModelLoader:
    global _loader
    if _loader is None:
        _loader = ModelLoader()
    return _loader