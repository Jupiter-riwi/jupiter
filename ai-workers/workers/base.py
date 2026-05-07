"""
BaseWorker: abstract consumer for Jupiter AI workers.

Subclass it and implement `process(job) -> dict` to build a concrete worker.
The base handles:
  - RabbitMQ connection + reconnection loop
  - ACK on success / NACK + requeue=False on failure
  - Saving the feature result to PostgreSQL (via db.save_feature)
  - Fan-in check: after saving, calls db.check_and_trigger_scoring
  - Error path: calls db.mark_failed and does NOT trigger scoring
"""

import json
import logging
import os
import time

import pika

import db

logger = logging.getLogger(__name__)


class BaseWorker:
    queue: str = ""           # override in subclass
    feature_kind: str = ""    # "pose" | "transcript" | "prosody" | "scoring"

    def process(self, job: dict) -> dict:
        """
        Do the actual work.  Return a dict that will be stored as the feature
        data in the database.  Raise an exception on failure.
        """
        raise NotImplementedError

    # ------------------------------------------------------------------

    def _get_mq_channel(self):
        url = os.getenv("RABBITMQ_URL") or (
            f"amqp://{os.getenv('RABBITMQ_USER','guest')}:"
            f"{os.getenv('RABBITMQ_PASS','guest')}@"
            f"{os.getenv('RABBITMQ_HOST','rabbitmq')}:"
            f"{os.getenv('RABBITMQ_PORT','5672')}/"
        )
        conn = pika.BlockingConnection(pika.URLParameters(url))
        ch = conn.channel()
        for q in ["jupiter.pose", "jupiter.whisper", "jupiter.prosody", "jupiter.scoring"]:
            ch.queue_declare(queue=q, durable=True)
        ch.basic_qos(prefetch_count=1)
        return conn, ch

    def on_message(self, channel, method, _properties, body: bytes) -> None:
        try:
            job = json.loads(body.decode())
        except Exception as exc:
            logger.error("Cannot parse message body: %s — discarding", exc)
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
            return

        evaluation_id = job.get("evaluation_id", "")
        tenant_id = job.get("tenant_id", "")
        video_key = job.get("video_key", "")

        pg_conn = None
        try:
            result = self.process(job)

            pg_conn = db.get_connection()
            if self.feature_kind and self.feature_kind != "scoring":
                db.save_feature(pg_conn, evaluation_id, self.feature_kind, result)
                triggered = db.check_and_trigger_scoring(
                    pg_conn, channel, evaluation_id, tenant_id, video_key
                )
                if triggered:
                    logger.info("[%s] All features ready — scoring job published", evaluation_id)

            channel.basic_ack(delivery_tag=method.delivery_tag)
            logger.info("[%s] %s feature saved OK", evaluation_id, self.feature_kind)

        except Exception as exc:
            logger.exception("[%s] Worker failed: %s", evaluation_id, exc)
            if pg_conn:
                try:
                    db.mark_failed(pg_conn, evaluation_id, str(exc))
                except Exception:
                    logger.exception("Could not mark evaluation as failed")
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

        finally:
            if pg_conn:
                pg_conn.close()

    def run(self) -> None:
        logger.info("%s worker starting on queue=%s", self.__class__.__name__, self.queue)
        while True:
            try:
                mq_conn, ch = self._get_mq_channel()
                ch.basic_consume(
                    queue=self.queue,
                    on_message_callback=self.on_message,
                    auto_ack=False,
                )
                ch.start_consuming()
            except pika.exceptions.AMQPConnectionError as exc:
                logger.error("RabbitMQ connection lost: %s — retrying in 5s", exc)
                time.sleep(5)
            except Exception as exc:
                logger.exception("Unexpected error: %s — retrying in 5s", exc)
                time.sleep(5)
