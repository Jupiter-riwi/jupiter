import json
import logging
import threading
import time
from datetime import datetime, timezone

import pika

from prosody.analyzer import analyze_audio, ProsodyFeatures
from prosody.rabbitmq import (
    QUEUE_NAME,
    get_connection,
    get_channel,
)
from shared.db import insert_features

logger = logging.getLogger(__name__)

# Exchange for publishing results (matches contract in TEAM.md)
RESULTS_EXCHANGE = "features"
RESULT_ROUTING_KEY = "features.results"


# ---------------------------------------------------------------------------
# Callback for each message on prosody.jobs
# ---------------------------------------------------------------------------

def on_prosody_job(channel, method, properties, body: bytes) -> None:
    delivery_tag = method.delivery_tag
    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds") + "Z"

    try:
        payload = json.loads(body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        logger.error("[%s] JSON inválido | delivery_tag=%s | error=%s",
                     timestamp, delivery_tag, exc)
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
        return

    job_id = payload.get("job_id", "unknown")
    evaluation_id = payload.get("evaluation_id", "unknown")
    tenant_id = payload.get("tenant_id", "unknown")
    audio_url = payload.get("audio_url", "")

    logger.info(
        "[%s] Job recibido | job_id=%s | evaluation_id=%s | audio=%s",
        timestamp, job_id, evaluation_id, audio_url[:80],
    )

    if not audio_url:
        logger.error("Job sin audio_url — descartando | job_id=%s", job_id)
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
        return

    try:
        features = analyze_audio(audio_url, transcript=payload.get("transcript"))
    except FileNotFoundError:
        logger.error("Audio no encontrado | path=%s", audio_url)
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
        return
    except Exception as exc:
        logger.exception("Error en análisis prosódico | job_id=%s", job_id)
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
        return

    try:
        feature_id = insert_features(
            evaluation_id=evaluation_id,
            tenant_id=tenant_id,
            kind="prosody",
            payload=features.to_dict(),
        )
    except Exception as exc:
        logger.exception("Error persistiendo features en Postgres | job_id=%s", job_id)
        channel.basic_nack(delivery_tag=delivery_tag, requeue=True)
        return

    result_body = json.dumps({
        "job_id": job_id,
        "evaluation_id": evaluation_id,
        "feature_id": feature_id,
        "tenant_id": tenant_id,
        "kind": "prosody",
        "payload": features.to_dict(),
        "processed_at": timestamp,
    })

    try:
        conn = get_connection()
        pub_channel = get_channel(conn)
        pub_channel.exchange_declare(
            exchange=RESULTS_EXCHANGE, exchange_type="topic", durable=True
        )
        pub_channel.basic_publish(
            exchange=RESULTS_EXCHANGE,
            routing_key=RESULT_ROUTING_KEY,
            body=result_body.encode("utf-8"),
            properties=pika.BasicProperties(
                delivery_mode=2,
                content_type="application/json",
            ),
        )
        logger.info("Publicado en %s/%s | evaluation_id=%s",
                     RESULTS_EXCHANGE, RESULT_ROUTING_KEY, evaluation_id)
        conn.close()
    except Exception as exc:
        logger.error("Error publicando resultado: %s", exc)

    channel.basic_ack(delivery_tag=delivery_tag)
    logger.info("Job completado | job_id=%s", job_id)


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
                queue=QUEUE_NAME,
                on_message_callback=on_prosody_job,
                auto_ack=False,
            )

            logger.info("Prosody consumer iniciado. Esperando mensajes en '%s'...", QUEUE_NAME)
            channel.start_consuming()

        except pika.exceptions.AMQPConnectionError as exc:
            logger.error("Conexión perdida con RabbitMQ: %s. Reintentando en 5 s...", exc)
            time.sleep(5)

        except Exception as exc:
            logger.exception("Error inesperado en el consumer: %s. Reintentando en 5 s...", exc)
            time.sleep(5)


def start_consumer() -> None:
    thread = threading.Thread(
        target=_blocking_consume,
        name="prosody-consumer",
        daemon=True,
    )
    thread.start()
    logger.info("Hilo del consumer de prosody iniciado (daemon=True).")
