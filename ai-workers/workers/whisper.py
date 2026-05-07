"""
Whisper worker — consumes from jupiter.whisper.

Transcribes audio from the uploaded video and extracts speech features.
In production, replaces the stub with an actual OpenAI Whisper pipeline.
"""

import logging
import random

from workers.base import BaseWorker

logger = logging.getLogger(__name__)


class WhisperWorker(BaseWorker):
    queue = "jupiter.whisper"
    feature_kind = "transcript"

    def process(self, job: dict) -> dict:
        evaluation_id = job["evaluation_id"]
        video_key = job.get("video_key", "")
        logger.info("[%s] Processing transcript for video_key=%s", evaluation_id, video_key)

        # Stub: return synthetic transcript metrics.
        return {
            "word_count": random.randint(80, 300),
            "speaking_rate_wpm": random.randint(100, 180),
            "filler_word_ratio": round(random.uniform(0.01, 0.1), 3),
            "vocabulary_richness": round(random.uniform(0.5, 0.9), 3),
            "transcript_snippet": "Demo transcript — replace with real Whisper output.",
        }
