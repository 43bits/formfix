"""
Real-time emotion detection from face crops.
Uses DeepFace with RetinaFace backend for best accuracy.
Falls back to a lighter haar-cascade detector if DeepFace fails.
"""

import cv2
import numpy as np
from typing import Optional
from dataclasses import dataclass

EMOTIONS = ["angry", "disgust", "fear", "happy", "sad", "surprise", "neutral"]

# Mood score mapping: 1.0 = very positive, -1.0 = very negative
EMOTION_VALENCE = {
    "happy":    1.0,
    "surprise": 0.4,
    "neutral":  0.0,
    "fear":    -0.5,
    "sad":     -0.7,
    "angry":   -0.8,
    "disgust": -0.9,
}

# Music BPM recommendations per mood range
MUSIC_RECOMMENDATIONS = [
    {"range": (0.7,  1.0),  "genre": "High-energy EDM / Hip-hop", "bpm": "140–170",
     "reason": "You're in peak mood — match the intensity"},
    {"range": (0.3,  0.7),  "genre": "Upbeat Pop / Rock",          "bpm": "120–140",
     "reason": "Good energy — keep the momentum"},
    {"range": (-0.1, 0.3),  "genre": "Motivational / Trap",        "bpm": "100–130",
     "reason": "Neutral mood — pump it up"},
    {"range": (-0.5, -0.1), "genre": "Aggressive Metal / Hardcore", "bpm": "150–180",
     "reason": "Channel frustration into fuel"},
    {"range": (-1.0, -0.5), "genre": "Ambient / Lo-fi",            "bpm": "60–90",
     "reason": "Low mood detected — start slow, build up"},
]


@dataclass
class EmotionResult:
    dominant: str
    scores: dict[str, float]
    valence: float          # -1 to 1
    face_detected: bool
    face_bbox: Optional[list[int]] = None  # [x, y, w, h]

    def to_dict(self) -> dict:
        return {
            "dominant":     self.dominant,
            "scores":       self.scores,
            "valence":      round(self.valence, 3),
            "face_detected": self.face_detected,
            "face_bbox":    self.face_bbox,
        }


class EmotionEngine:
    def __init__(self):
        self._deepface_ok = self._check_deepface()
        if not self._deepface_ok:
            print("[EmotionEngine] DeepFace unavailable — using Haar fallback")
            self._face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            )

    def _check_deepface(self) -> bool:
        try:
            from deepface import DeepFace   # noqa: F401
            return True
        except ImportError:
            return False

    def analyse_frame(self, frame_bgr: np.ndarray) -> EmotionResult:
        if self._deepface_ok:
            return self._deepface_analyse(frame_bgr)
        return self._haar_fallback(frame_bgr)

    def _deepface_analyse(self, frame: np.ndarray) -> EmotionResult:
        from deepface import DeepFace
        try:
            results = DeepFace.analyze(
                frame,
                actions=["emotion"],
                detector_backend="opencv",   # fastest; swap to "retinaface" for accuracy
                enforce_detection=False,
                silent=True,
            )
            r = results[0] if isinstance(results, list) else results
            scores   = {k: round(v / 100.0, 3) for k, v in r["emotion"].items()}
            dominant = r["dominant_emotion"]
            region   = r.get("region", {})
            bbox     = [region.get("x", 0), region.get("y", 0),
                        region.get("w", 0), region.get("h", 0)]
            valence  = EMOTION_VALENCE.get(dominant, 0.0)
            return EmotionResult(
                dominant=dominant, scores=scores, valence=valence,
                face_detected=True, face_bbox=bbox,
            )
        except Exception:
            return EmotionResult(dominant="neutral", scores={e: 0.0 for e in EMOTIONS},
                                 valence=0.0, face_detected=False)

    def _haar_fallback(self, frame: np.ndarray) -> EmotionResult:
        gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self._face_cascade.detectMultiScale(gray, 1.1, 4, minSize=(60, 60))
        if len(faces) == 0:
            return EmotionResult(dominant="neutral", scores={e: 0.0 for e in EMOTIONS},
                                 valence=0.0, face_detected=False)
        # Can't classify emotions without a model — return neutral with bbox
        x, y, w, h = faces[0]
        return EmotionResult(dominant="neutral", scores={"neutral": 1.0},
                             valence=0.0, face_detected=True, face_bbox=[int(x), int(y), int(w), int(h)])

    @staticmethod
    def get_music_recommendation(valence: float) -> dict:
        for rec in MUSIC_RECOMMENDATIONS:
            lo, hi = rec["range"]
            if lo <= valence <= hi:
                return rec
        return MUSIC_RECOMMENDATIONS[2]   # neutral default