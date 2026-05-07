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

        # Stub: return synthetic transcript metrics with realistic variance
        return {
            "word_count": random.randint(10, 400),
            "speaking_rate_wpm": random.randint(60, 220),
            "filler_word_ratio": round(random.uniform(0.0, 0.18), 3),
            "vocabulary_richness": round(random.uniform(0.2, 0.9), 3),
            "transcript_snippet": "Demostración — texto sintético para evaluación del modelo de scoring.",
            "sentence_count": random.randint(1, 20),
            "avg_sentence_length": random.randint(3, 40),
        }
