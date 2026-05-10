"""
Tracks mood × performance correlation over a workout session.
Stores rolling snapshots and computes impact analysis.
"""

from dataclasses import dataclass, field
from typing import List, Optional
import time


@dataclass
class MoodSnapshot:
    timestamp: float
    emotion: str
    valence: float
    form_score: float
    rep_number: int
    exercise: str


class SessionTracker:
    def __init__(self):
        self._snapshots: List[MoodSnapshot] = []
        self._session_start = time.time()

    def record(
        self,
        emotion: str,
        valence: float,
        form_score: float,
        rep_number: int = 0,
        exercise: str = "unknown",
    ):
        self._snapshots.append(MoodSnapshot(
            timestamp=time.time() - self._session_start,
            emotion=emotion,
            valence=valence,
            form_score=form_score,
            rep_number=rep_number,
            exercise=exercise,
        ))

    def get_correlation_analysis(self) -> dict:
        if len(self._snapshots) < 5:
            return {"status": "insufficient_data", "snapshots": len(self._snapshots)}

        snaps = self._snapshots
        valences    = [s.valence    for s in snaps]
        form_scores = [s.form_score for s in snaps]

        # Pearson correlation
        correlation = self._pearson(valences, form_scores)

        # Emotion breakdown
        emotion_perf: dict[str, list[float]] = {}
        for s in snaps:
            emotion_perf.setdefault(s.emotion, []).append(s.form_score)

        emotion_summary = {
            em: {
                "avg_form_score": round(sum(scores) / len(scores), 1),
                "sample_count":   len(scores),
            }
            for em, scores in emotion_perf.items()
        }

        # Best and worst mood windows
        best_mood_snap  = max(snaps, key=lambda s: s.valence)
        worst_mood_snap = min(snaps, key=lambda s: s.valence)

        # Trend: is mood improving through session?
        mid = len(snaps) // 2
        early_val = sum(valences[:mid])  / max(mid, 1)
        late_val  = sum(valences[mid:])  / max(len(snaps) - mid, 1)
        trend = "improving" if late_val > early_val + 0.1 else \
                "declining"  if late_val < early_val - 0.1 else "stable"

        return {
            "status":           "ok",
            "duration_s":       round(snaps[-1].timestamp, 1),
            "total_snapshots":  len(snaps),
            "mood_form_correlation": round(correlation, 3),
            "correlation_label": self._correlation_label(correlation),
            "mood_trend":       trend,
            "early_avg_valence": round(early_val, 3),
            "late_avg_valence":  round(late_val, 3),
            "emotion_performance": emotion_summary,
            "best_mood_moment":  {
                "emotion":    best_mood_snap.emotion,
                "valence":    best_mood_snap.valence,
                "form_score": best_mood_snap.form_score,
                "timestamp":  round(best_mood_snap.timestamp, 1),
            },
            "worst_mood_moment": {
                "emotion":    worst_mood_snap.emotion,
                "valence":    worst_mood_snap.valence,
                "form_score": worst_mood_snap.form_score,
                "timestamp":  round(worst_mood_snap.timestamp, 1),
            },
            "insight": self._generate_insight(correlation, trend, emotion_summary),
            "timeline": [
                {"t": round(s.timestamp, 1), "valence": s.valence,
                 "form": s.form_score, "emotion": s.emotion}
                for s in snaps[-50:]   # last 50 for chart
            ],
        }

    def reset(self):
        self._snapshots.clear()
        self._session_start = time.time()

    @staticmethod
    def _pearson(x: list[float], y: list[float]) -> float:
        n = len(x)
        if n < 2:
            return 0.0
        mx, my = sum(x) / n, sum(y) / n
        num = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y))
        den = (sum((xi - mx) ** 2 for xi in x) *
               sum((yi - my) ** 2 for yi in y)) ** 0.5
        return num / den if den > 1e-9 else 0.0

    @staticmethod
    def _correlation_label(r: float) -> str:
        if r > 0.6:   return "strong positive — better mood → better form"
        if r > 0.3:   return "moderate positive — mood helps performance"
        if r > -0.3:  return "weak correlation — mood has little effect"
        if r > -0.6:  return "moderate negative — frustration drives performance"
        return "strong negative — you perform best under tension"

    @staticmethod
    def _generate_insight(correlation: float, trend: str, perf: dict) -> str:
        best_em  = max(perf, key=lambda e: perf[e]["avg_form_score"], default="neutral")
        worst_em = min(perf, key=lambda e: perf[e]["avg_form_score"], default="neutral")
        trend_str = {"improving": "your mood lifted as the session progressed",
                     "declining": "mood dipped later in the session",
                     "stable":    "your mood was consistent throughout"}.get(trend, "")
        return (f"Your form score is highest when feeling {best_em} "
                f"and lowest when feeling {worst_em}. Overall, {trend_str}. "
                f"Mood-performance correlation: {correlation:+.2f}.")