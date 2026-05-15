import json
import logging
import os
import tempfile
import threading
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

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


def _download_from_s3(s3_url: str) -> str:
    import boto3
    import subprocess

    parsed = urlparse(s3_url)
    bucket = parsed.netloc
    key = parsed.path.lstrip("/")

    endpoint = os.getenv("S3_ENDPOINT_URL", "http://minio:9000")
    access_key = os.getenv("AWS_ACCESS_KEY_ID", "minioadmin")
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY", "minioadmin")
    region = os.getenv("AWS_REGION", "us-east-1")

    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
    )

    suffix = os.path.splitext(key)[1] or ".mp4"
    fd, video_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    s3.download_file(bucket, key, video_path)

    # Extract audio to WAV for librosa compatibility
    fd, audio_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", video_path, "-vn", "-acodec", "pcm_s16le",
             "-ar", "16000", "-ac", "1", audio_path],
            capture_output=True,
            timeout=30,
            check=True,
        )
    finally:
        os.unlink(video_path)

    return audio_path


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
    video_url = payload.get("video_url", "")

    logger.info(
        "[%s] Job recibido | job_id=%s | evaluation_id=%s",
        timestamp, job_id, evaluation_id,
    )

    if not audio_url and not video_url:
        logger.error("Job sin audio_url ni video_url — descartando | job_id=%s", job_id)
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
        return

    tmp_path = None
    source_path = audio_url

    if video_url.startswith("s3://"):
        try:
            tmp_path = _download_from_s3(video_url)
            source_path = tmp_path
        except Exception as exc:
            logger.exception("Error descargando video desde S3 | video_url=%s", video_url)
            channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
            return

    try:
        features = analyze_audio(source_path, transcript=payload.get("transcript"))
    except FileNotFoundError:
        logger.error("Audio no encontrado | path=%s", source_path)
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
        return
    except Exception as exc:
        logger.exception("Error en análisis prosódico | job_id=%s", job_id)
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
        return
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

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
