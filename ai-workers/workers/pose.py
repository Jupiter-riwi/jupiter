"""
Pose worker — consumes from jupiter.pose.

Extracts posture and body-language features from the uploaded video.
In production, replaces the stub with an actual MediaPipe / OpenCV pipeline.
"""

import logging
import random

from workers.base import BaseWorker

logger = logging.getLogger(__name__)


class PoseWorker(BaseWorker):
    queue = "jupiter.pose"
    feature_kind = "pose"

    def process(self, job: dict) -> dict:
        evaluation_id = job["evaluation_id"]
        video_key = job.get("video_key", "")
        logger.info("[%s] Processing pose for video_key=%s", evaluation_id, video_key)

        # Stub: return synthetic pose metrics with realistic variance (0.1 to 1.0)
        return {
            "posture_score": round(random.uniform(0.15, 0.98), 3),
            "eye_contact_ratio": round(random.uniform(0.1, 0.95), 3),
            "gesture_frequency": round(random.uniform(0.02, 0.75), 3),
            "stillness_score": round(random.uniform(0.05, 0.95), 3),
            "shoulder_alignment": round(random.uniform(0.2, 0.95), 3),
            "head_orientation_variability": round(random.uniform(0.05, 0.6), 3),
        }
