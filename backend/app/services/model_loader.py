"""
ONNX Runtime inference — no tensorflow required in server venv.
Looks for: ml/models/form_classifier.onnx
Falls back to heuristic if model not found.
"""

import os
import numpy as np
from typing import Optional
from ..config import settings

EXERCISE_NAMES = [
    "barbell_biceps_curl",  # 0
    "bench_press",          # 1
    "chest_fly_machine",    # 2
    "deadlift",             # 3
    "decline_bench_press",  # 4
    "hammer_curl",          # 5
    "hip_thrust",           # 6
    "incline_bench_press",  # 7
    "lat_pulldown",         # 8
    "lateral_raise",        # 9
    "leg_extension",        # 10
    "leg_raises",           # 11
    "plank",                # 12
    "pullup",               # 13
    "pushup",               # 14
    "romanian_deadlift",    # 15
    "russian_twist",        # 16
    "shoulder_press",       # 17
    "squat",                # 18
    "t_bar_row",            # 19
    "tricep_dips",          # 20
    "tricep_pushdown",      # 21
]

SEQUENCE_LENGTH = 60
FEATURE_DIM     = 48


class ModelLoader:
    def __init__(self):
        self._session   = None
        self._input_name = None
        self._mode       = "heuristic"
        self._load()

    def _load(self):
        onnx_path = os.path.join(settings.model_dir, "form_classifier.onnx")

        if not os.path.exists(onnx_path):
            print(f"[ModelLoader] No ONNX model at {onnx_path} — heuristic mode")
            return

        try:
            import onnxruntime as ort

            # Prefer CPU provider to avoid GPU driver issues on dev machines
            providers = ["CPUExecutionProvider"]
            try:
                if "CUDAExecutionProvider" in ort.get_available_providers():
                    providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
            except Exception:
                pass

            opts = ort.SessionOptions()
            opts.intra_op_num_threads = 4
            opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

            self._session    = ort.InferenceSession(onnx_path,
                                                    sess_options=opts,
                                                    providers=providers)
            self._input_name = self._session.get_inputs()[0].name
            self._mode       = "onnx"
            print(f"[ModelLoader] ONNX model loaded from {onnx_path}")
            print(f"[ModelLoader] Providers: {self._session.get_providers()}")

        except ImportError:
            print("[ModelLoader] onnxruntime not installed — heuristic mode")
        except Exception as e:
            print(f"[ModelLoader] ONNX load failed: {e} — heuristic mode")

    def predict(self, sequence: np.ndarray) -> dict:
        """
        sequence: np.ndarray shape (SEQUENCE_LENGTH, FEATURE_DIM)
        Returns: {"exercise": str, "exercise_confidence": float, "quality_score": float}
        """
        if self._mode != "onnx" or self._session is None:
            return {
                "exercise": "unknown",
                "exercise_confidence": 0.0,
                "quality_score": 0.5,
                "source": "heuristic",
            }

        if sequence.shape != (SEQUENCE_LENGTH, FEATURE_DIM):
            return {
                "exercise": "unknown",
                "exercise_confidence": 0.0,
                "quality_score": 0.5,
                "source": "heuristic",
            }

        inp = sequence[np.newaxis].astype(np.float32)  # (1, 60, 48)

        try:
            outputs = self._session.run(None, {self._input_name: inp})
        except Exception as e:
            print(f"[ModelLoader] inference error: {e}")
            return {"exercise": "unknown", "exercise_confidence": 0.0,
                    "quality_score": 0.5, "source": "error"}

        # Outputs order depends on how tf2onnx exported the model:
        # Usually [exercise_probs (1, N), quality_score (1, 1)]
        ex_probs   = None
        q_score    = 0.5

        for out in outputs:
            if out.shape[-1] == len(EXERCISE_NAMES):
                ex_probs = out[0]
            elif out.shape[-1] == 1:
                q_score = float(out[0][0])

        if ex_probs is None and len(outputs) > 0:
            ex_probs = outputs[0][0]

        if ex_probs is None:
            return {"exercise": "unknown", "exercise_confidence": 0.0,
                    "quality_score": q_score, "source": "onnx"}

        idx = int(np.argmax(ex_probs))
        name = EXERCISE_NAMES[idx] if idx < len(EXERCISE_NAMES) else "unknown"

        return {
            "exercise":            name,
            "exercise_confidence": round(float(ex_probs[idx]), 3),
            "quality_score":       round(q_score, 3),
            "source":              "onnx",
        }

    @property
    def has_model(self) -> bool:
        return self._mode == "onnx"


# Singleton
_loader: Optional[ModelLoader] = None

def get_model_loader() -> ModelLoader:
    global _loader
    if _loader is None:
        _loader = ModelLoader()
    return _loader