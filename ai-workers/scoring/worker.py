import json
import logging
import threading
import time
from datetime import datetime, timezone

import pika

from scoring.rabbitmq import (
    SCORING_QUEUE,
    SCORE_READY_EXCHANGE,
    SCORE_READY_ROUTING_KEY,
    get_connection,
    get_channel,
)
from scoring.llm import call_gpt4o, load_prompt, build_prompt
from scoring.models import ScoreResult, ScoringJob
from shared.db import fetch_features_by_evaluation, all_features_ready, insert_score

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Score ready publisher
def publish_score_ready(
    evaluation_id: str,
    tenant_id: str,
    score: ScoreResult,
    score_id: str,
) -> None:
    conn = get_connection()
    pub_channel = get_channel(conn)
    pub_channel.exchange_declare(
        exchange=SCORE_READY_EXCHANGE, exchange_type="topic", durable=True
    )
    body = json.dumps({
        "type": "score.ready",
        "evaluation_id": evaluation_id,
        "tenant_id": tenant_id,
        "score_id": score_id,
        "overall": score.overall,
        "dimensions": score.model_dump()["dimensions"],
        "recommendations": score.model_dump()["recommendations"],
        "completed_at": datetime.now(timezone.utc).isoformat(timespec="seconds") + "Z",
    })
    pub_channel.basic_publish(
        exchange=SCORE_READY_EXCHANGE,
        routing_key=SCORE_READY_ROUTING_KEY,
        body=body.encode("utf-8"),
        properties=pika.BasicProperties(delivery_mode=2, content_type="application/json"),
    )
    logger.info("score.ready publicado | evaluation_id=%s", evaluation_id)
    conn.close()


# ---------------------------------------------------------------------------
# Callback
# ---------------------------------------------------------------------------

def on_scoring_job(channel, method, properties, body: bytes) -> None:
    delivery_tag = method.delivery_tag
    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds") + "Z"

    try:
        payload = json.loads(body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        logger.error("[%s] JSON inválido | delivery_tag=%s", timestamp, delivery_tag)
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
        return

    try:
        job = ScoringJob(
            job_id=payload.get("job_id", "unknown"),
            evaluation_id=payload["evaluation_id"],
            tenant_id=payload["tenant_id"],
        )
    except KeyError as exc:
        logger.error("Job mal formado, falta campo: %s", exc)
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
        return

    logger.info(
        "[%s] Scoring job recibido | job_id=%s | evaluation_id=%s",
        timestamp, job.job_id, job.evaluation_id,
    )

    try:
        features = fetch_features_by_evaluation(job.evaluation_id)

        if not all_features_ready(job.evaluation_id):
            logger.warning(
                "Features incompletos para evaluation_id=%s — reintentando | "
                "encontrados=%s",
                job.evaluation_id, list(features.keys()),
            )
            channel.basic_nack(delivery_tag=delivery_tag, requeue=True)
            return

        score = call_gpt4o(
            prompt=build_prompt(
                pose_features=features.get("pose", {}),
                transcript_features=features.get("transcript", {}),
                prosody_features=features.get("prosody", {}),
            ),
        )
    except ValueError as exc:
        logger.error("OPENAI_API_KEY no configurada — descartando job | %s", exc)
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
        return
    except Exception as exc:
        logger.exception("Error en scoring | job_id=%s", job.job_id)
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
        return

    try:
        score_id = insert_score(
            evaluation_id=job.evaluation_id,
            tenant_id=job.tenant_id,
            overall=score.overall,
            dimensions=score.model_dump()["dimensions"],
            recommendations=score.model_dump()["recommendations"],
        )
    except Exception as exc:
        logger.exception("Error persistiendo score en Postgres | job_id=%s", job.job_id)
        channel.basic_nack(delivery_tag=delivery_tag, requeue=True)
        return

    try:
        publish_score_ready(job.evaluation_id, job.tenant_id, score, score_id)
    except Exception as exc:
        logger.error("Error publicando score.ready: %s", exc)

    channel.basic_ack(delivery_tag=delivery_tag)
    logger.info("Scoring job completado | job_id=%s | overall=%d", job.job_id, score.overall)


# ---------------------------------------------------------------------------
# Consumer loop
# ---------------------------------------------------------------------------

def _blocking_consume() -> None:
    while True:
        try:
            connection = get_connection()
            channel = get_channel(connection)
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(
                queue=SCORING_QUEUE,
                on_message_callback=on_scoring_job,
                auto_ack=False,
            )
            logger.info("Scoring consumer iniciado en '%s'", SCORING_QUEUE)
            channel.start_consuming()

        except pika.exceptions.AMQPConnectionError as exc:
            logger.error("Conexión RabbitMQ perdida: %s. Reintentando en 5 s...", exc)
            time.sleep(5)
        except Exception as exc:
            logger.exception("Error en consumer: %s. Reintentando en 5 s...", exc)
            time.sleep(5)


def start_consumer() -> None:
    thread = threading.Thread(
        target=_blocking_consume,
        name="scoring-consumer",
        daemon=True,
    )
    thread.start()
    logger.info("Hilo del consumer de scoring iniciado (daemon=True).")
