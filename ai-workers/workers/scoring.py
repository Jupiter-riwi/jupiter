"""
Scoring worker — consumes from jupiter.scoring.

Aggregates pose + transcript + prosody features into a final evaluation score
and writes the result back to the evaluations table.
"""

import json
import logging

import db
from workers.base import BaseWorker

logger = logging.getLogger(__name__)


class ScoringWorker(BaseWorker):
    queue = "jupiter.scoring"
    feature_kind = "scoring"  # sentinel — base class skips save_feature for this kind

    def process(self, job: dict) -> dict:
        evaluation_id = job["evaluation_id"]
        logger.info("[%s] Scoring evaluation", evaluation_id)

        pg_conn = db.get_connection()
        try:
            features = self._load_features(pg_conn, evaluation_id)
            score = self._aggregate(features)
            self._persist_result(pg_conn, evaluation_id, score, features)
            logger.info("[%s] Score persisted: %.3f", evaluation_id, score)
            return {"score": score}
        finally:
            pg_conn.close()

    # ── private ──────────────────────────────────────────────────────────────

    def _load_features(self, conn, evaluation_id: str) -> dict:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT kind, payload FROM features WHERE evaluation_id = %s",
                (evaluation_id,),
            )
            return {row[0]: row[1] for row in cur.fetchall()}

    def _aggregate(self, features: dict) -> float:
        """
        Weighted average of sub-scores extracted from each feature blob.
        Weights: pose=0.3, transcript=0.3, prosody=0.4.
        Returns a float in [0.0, 1.0].
        """
        def _score_pose(data: dict) -> float:
            return (
                data.get("posture_score", 0.5) * 0.4
                + data.get("eye_contact_ratio", 0.5) * 0.4
                + data.get("stillness_score", 0.5) * 0.2
            )

        def _score_transcript(data: dict) -> float:
            filler_penalty = max(0.0, 1.0 - data.get("filler_word_ratio", 0.05) * 5)
            return data.get("vocabulary_richness", 0.5) * 0.5 + filler_penalty * 0.5

        def _score_prosody(data: dict) -> float:
            return (
                data.get("energy_mean", 0.5) * 0.4
                + (1.0 - data.get("pause_ratio", 0.1)) * 0.3
                + data.get("pitch_variability", 0.2) * 0.3
            )

        pose_raw = features.get("pose") or {}
        transcript_raw = features.get("transcript") or {}
        prosody_raw = features.get("prosody") or {}

        # data may be stored as bytes (JSONB) or already decoded to dict
        def ensure_dict(v):
            if isinstance(v, (bytes, memoryview)):
                return json.loads(bytes(v))
            if isinstance(v, str):
                return json.loads(v)
            return v or {}

        pose_data = ensure_dict(pose_raw)
        transcript_data = ensure_dict(transcript_raw)
        prosody_data = ensure_dict(prosody_raw)

        score = (
            _score_pose(pose_data) * 0.3
            + _score_transcript(transcript_data) * 0.3
            + _score_prosody(prosody_data) * 0.4
        )
        return round(min(max(score, 0.0), 1.0), 4)

    def _persist_result(self, conn, evaluation_id: str, score: float, features: dict) -> None:
        import json
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE evaluations
                SET status    = 'completed',
                    score     = %s,
                    features  = %s,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (score, json.dumps(features), evaluation_id),
            )
        conn.commit()

    # Override run so the base class fan-in logic is skipped entirely;
    # scoring worker handles DB writes directly inside process().
    def on_message(self, channel, method, _properties, body: bytes) -> None:
        try:
            job = json.loads(body.decode())
        except Exception as exc:
            logger.error("Cannot parse scoring message: %s", exc)
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
            return

        evaluation_id = job.get("evaluation_id", "")
        try:
            self.process(job)
            channel.basic_ack(delivery_tag=method.delivery_tag)
        except Exception as exc:
            logger.exception("[%s] Scoring failed: %s", evaluation_id, exc)
            try:
                pg_conn = db.get_connection()
                db.mark_failed(pg_conn, evaluation_id, str(exc))
                pg_conn.close()
            except Exception:
                logger.exception("Could not mark evaluation as failed after scoring error")
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
