from dataclasses import dataclass, field
from typing import List, Optional
from ..models.schemas import FormFeedback, Exercise

@dataclass
class Rep:
    rep_number: int
    start_frame: int
    end_frame: int
    frames: List[FormFeedback] = field(default_factory=list)
    peak_error_frame: Optional[int] = None

    @property
    def avg_score(self) -> float:
        if not self.frames:
            return 0.0
        return sum(f.score for f in self.frames) / len(self.frames)

    @property
    def all_errors(self) -> List[str]:
        seen = set()
        out = []
        for f in self.frames:
            for e in f.errors:
                if e not in seen:
                    seen.add(e)
                    out.append(e)
        return out

    @property
    def worst_angles(self):
        """Return the angle snapshot with most errors."""
        worst = None
        worst_count = -1
        for f in self.frames:
            c = len(f.errors)
            if c > worst_count:
                worst_count = c
                worst = f.joint_angles
        return worst or []

    def to_dict(self) -> dict:
        return {
            "rep_number": self.rep_number,
            "start_frame": self.start_frame,
            "end_frame": self.end_frame,
            "avg_score": round(self.avg_score, 1),
            "errors": self.all_errors,
            "worst_angles": [a.model_dump() for a in self.worst_angles],
            "frame_count": len(self.frames),
        }


class RepSegmenter:
    """
    Segments a stream of FormFeedback frames into individual reps.
    Uses phase transitions to detect rep boundaries.
    """

    BOTTOM_PHASES = {"bottom", "setup"}
    TOP_PHASES    = {"lockout", "ascent"}

    # Minimum frames to count as a valid rep (avoids noise)
    MIN_REP_FRAMES = 8

    def __init__(self):
        self._reps: List[Rep] = []
        self._current_rep: Optional[Rep] = None
        self._last_phase: str = ""
        self._frame_idx: int = 0
        self._in_bottom: bool = False

    def ingest(self, feedback: FormFeedback) -> Optional[Rep]:
        """
        Feed one frame. Returns a completed Rep object when a rep ends, else None.
        """
        phase = feedback.phase
        completed: Optional[Rep] = None

        # Start a new rep on descent / setup
        if self._current_rep is None and phase not in self.TOP_PHASES:
            self._current_rep = Rep(
                rep_number=len(self._reps) + 1,
                start_frame=self._frame_idx,
                end_frame=self._frame_idx,
            )

        if self._current_rep is not None:
            self._current_rep.frames.append(feedback)
            self._current_rep.end_frame = self._frame_idx

            if phase in self.BOTTOM_PHASES:
                self._in_bottom = True

            # Rep completes when we return to top after having been at bottom
            if self._in_bottom and phase in self.TOP_PHASES and \
               self._last_phase not in self.TOP_PHASES:
                if len(self._current_rep.frames) >= self.MIN_REP_FRAMES:
                    self._reps.append(self._current_rep)
                    completed = self._current_rep
                self._current_rep = None
                self._in_bottom = False

        self._last_phase = phase
        self._frame_idx += 1
        return completed

    def flush(self) -> Optional[Rep]:
        """Call at end of video to capture an incomplete final rep."""
        if self._current_rep and len(self._current_rep.frames) >= self.MIN_REP_FRAMES:
            self._reps.append(self._current_rep)
            r = self._current_rep
            self._current_rep = None
            return r
        return None

    @property
    def reps(self) -> List[Rep]:
        return self._reps

    def summary(self) -> dict:
        if not self._reps:
            return {"total_reps": 0, "avg_score": 0, "reps": []}
        avg = sum(r.avg_score for r in self._reps) / len(self._reps)
        return {
            "total_reps": len(self._reps),
            "avg_score": round(avg, 1),
            "reps": [r.to_dict() for r in self._reps],
        }