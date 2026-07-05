import json
import logging
import re
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
from scoring.llm import call_llm, load_prompt, build_prompt
from scoring.models import ScoreResult, ScoringJob
from shared.db import (
    fetch_features_by_evaluation,
    all_features_ready,
    get_evaluation_status,
    get_evaluation_title,
    get_evaluation_scoring_context,
    insert_score,
    update_evaluation_status,
    mark_evaluation_failed,
)

logger = logging.getLogger(__name__)

_LEVEL_RE = re.compile(r"nivel:\s*(accesible|neutral|exigente)", re.IGNORECASE)


def _difficulty_from_title(evaluation_id: str) -> str:
    try:
        m = _LEVEL_RE.search(get_evaluation_title(evaluation_id) or "")
        return m.group(1).lower() if m else "neutral"
    except Exception:
        return "neutral"


def _classify_scoring_error(exc: Exception) -> tuple[str, str, str]:
    detail = str(exc)
    text = detail.lower()

    if "groq_api_key no configurada" in text:
        return (
            "GROQ_CONFIG_ERROR",
            "GROQ_API_KEY no esta configurada en el worker de scoring.",
            detail,
        )

    if "groq" in text or "api" in text:
        if (
            "insufficient_quota" in text
            or "billing_hard_limit_reached" in text
            or "insufficient quota" in text
            or "rate_limit" in text
            or "rate limit" in text
        ):
            return (
                "GROQ_RATE_LIMIT",
                "Limite de tasa o saldo insuficiente en Groq.",
                detail,
            )

        if "invalid_api_key" in text or "incorrect api key" in text or "api key" in text or "authentication" in text:
            return (
                "GROQ_AUTH_ERROR",
                "La API key de Groq es invalida o expiro.",
                detail,
            )

        return (
            "GROQ_ERROR",
            "Error llamando a Groq durante el scoring.",
            detail,
        )

    return (
        "SCORING_ERROR",
        "Error interno durante el calculo del score.",
        detail,
    )


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
            required = {"pose", "transcript", "prosody"}
            missing = sorted(required - set(features.keys()))

            headers = properties.headers or {} if properties else {}
            retry_count = headers.get("x-retry-count", 0) if isinstance(headers, dict) else 0

            if retry_count >= 30:
                logger.error(
                    "Max retries alcanzado para evaluation_id=%s — marcando como failed | "
                    "faltantes=%s", job.evaluation_id, missing,
                )
                try:
                    update_evaluation_status(job.evaluation_id, status="failed")
                except Exception as exc:
                    logger.error("No se pudo actualizar status a failed: %s", exc)
                channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
                return

            logger.warning(
                "Features incompletos — reintentando (%d/30) | faltantes=%s",
                retry_count + 1, missing,
            )
            time.sleep(5)
            # Republish with incremented retry count, then ack original
            from scoring.rabbitmq import SCORING_QUEUE
            channel.basic_publish(
                exchange="",
                routing_key=SCORING_QUEUE,
                body=body,
                properties=pika.BasicProperties(
                    delivery_mode=2,
                    content_type="application/json",
                    headers={"x-retry-count": retry_count + 1},
                ),
            )
            channel.basic_ack(delivery_tag=delivery_tag)
            return

        # Difficulty/context: first-class columns (migration 0005); the title
        # regex remains as fallback for rows created before it.
        try:
            col_difficulty, context_brief = get_evaluation_scoring_context(job.evaluation_id)
        except Exception:
            col_difficulty, context_brief = None, None
        difficulty = col_difficulty or _difficulty_from_title(job.evaluation_id)
        logger.info("scoring difficulty=%s context=%s | evaluation_id=%s",
                    difficulty, bool(context_brief), job.evaluation_id)
        score = call_llm(
            prompt=build_prompt(
                pose_features=features.get("pose", {}),
                transcript_features=features.get("transcript", {}),
                prosody_features=features.get("prosody", {}),
                difficulty=difficulty,
                context_brief=context_brief,
            ),
        )
    except Exception as exc:
        logger.exception("Error en scoring | job_id=%s", job.job_id)
        error_code, error_message, error_detail = _classify_scoring_error(exc)
        try:
            mark_evaluation_failed(
                evaluation_id=job.evaluation_id,
                error_code=error_code,
                error_message=error_message,
                error_detail=error_detail[:1200],
            )
        except Exception:
            logger.exception("No se pudo marcar evaluation como failed | evaluation_id=%s", job.evaluation_id)
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
        update_evaluation_status(
            evaluation_id=job.evaluation_id,
            status="completed",
            score=float(score.overall) / 100.0,
            features={
                "overall": score.overall,
                "dimensions": score.model_dump()["dimensions"],
                "recommendations": score.model_dump()["recommendations"],
            },
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
