import asyncio
import base64
import cv2
import numpy as np
import os
import tempfile
from typing import AsyncGenerator, Optional
from ..models.schemas import Exercise, FormFeedback
from .pose_engine import PoseEngine
from .form_analyser import FormAnalyser
from .rep_segmenter import RepSegmenter
from .sport_detector import SportDetector


class VideoProcessor:
    """
    Full pipeline: video file → frames → pose → form analysis → rep segmentation.
    Supports both file-based and streaming operation.
    """

    SAMPLE_EVERY_N_FRAMES = 2   # process every 2nd frame for speed
    THUMBNAIL_INTERVAL_S  = 2.0 # extract thumbnail every 2 seconds

    def __init__(self):
        self.engine   = PoseEngine()
        self.detector = SportDetector()

    async def process_file(
        self,
        file_bytes: bytes,
        exercise_hint: Exercise = Exercise.UNKNOWN,
    ) -> dict:
        """
        Full analysis of an uploaded video file.
        Returns summary with per-rep breakdown and thumbnails.
        """
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        try:
            return await asyncio.get_event_loop().run_in_executor(
                None, self._process_sync, tmp_path, exercise_hint
            )
        finally:
            os.unlink(tmp_path)

    def _process_sync(self, video_path: str, exercise_hint: Exercise) -> dict:
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration_s = total_frames / fps

        analyser  = FormAnalyser(self.engine)
        segmenter = RepSegmenter()

        all_feedback: list[FormFeedback] = []
        thumbnails: list[dict] = []   # [{timestamp_s, frame_b64, rep_number}]
        frame_idx = 0
        last_thumb_s = -self.THUMBNAIL_INTERVAL_S

        # Auto-detect exercise from first 60 frames if hint is UNKNOWN
        detected_exercise = exercise_hint
        if exercise_hint == Exercise.UNKNOWN:
            detected_exercise = self._detect_exercise_from_video(cap, fps)
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # rewind

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            if frame_idx % self.SAMPLE_EVERY_N_FRAMES != 0:
                continue

            timestamp_s = frame_idx / fps

            pose, annotated = self.engine.process_frame(frame)
            if pose is None:
                continue

            feedback = analyser.analyse(pose, detected_exercise)
            feedback_with_ts = feedback
            all_feedback.append(feedback_with_ts)

            completed_rep = segmenter.ingest(feedback)

            # Capture thumbnail at rep completion or on interval
            if completed_rep or (timestamp_s - last_thumb_s >= self.THUMBNAIL_INTERVAL_S):
                _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 60])
                thumbnails.append({
                    "timestamp_s": round(timestamp_s, 2),
                    "frame_b64": base64.b64encode(buf).decode(),
                    "rep_number": completed_rep.rep_number if completed_rep else None,
                    "score": round(feedback.score, 1),
                })
                last_thumb_s = timestamp_s

        # Flush any in-progress rep
        segmenter.flush()
        cap.release()

        summary = segmenter.summary()
        summary["exercise"]    = detected_exercise.value
        summary["duration_s"]  = round(duration_s, 1)
        summary["total_frames_analysed"] = len(all_feedback)
        summary["thumbnails"]  = thumbnails[:20]  # cap at 20 thumbs

        return summary

    def _detect_exercise_from_video(self, cap, fps: float) -> Exercise:
        """Sample first ~2 seconds for YOLO-based exercise detection."""
        sample_frames = int(fps * 2)
        for i in range(sample_frames):
            ret, frame = cap.read()
            if not ret:
                break
            ex, meta = self.detector.detect_frame(frame)
            self.detector.accumulate_vote(ex)
            # Refine with pose heuristic
            pose, _ = self.engine.process_frame(frame)
            if pose:
                hip = next((a.angle for a in []), None)  # populated later
                refined = self.detector.detect_from_pose(None, None, None,
                    set(meta.get("equipment", [])))
                if refined != Exercise.UNKNOWN:
                    self.detector.accumulate_vote(refined)

        return self.detector.majority_exercise()

    def close(self):
        self.engine.close()