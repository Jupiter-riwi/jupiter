from __future__ import annotations

import json
import logging

import pika

from whisper_worker.config import Settings

logger = logging.getLogger(__name__)


def create_connection(settings: Settings) -> pika.BlockingConnection:
    credentials = pika.PlainCredentials(settings.rabbitmq_user, settings.rabbitmq_pass)
    parameters = pika.ConnectionParameters(
        host=settings.rabbitmq_host,
        port=settings.rabbitmq_port,
        virtual_host=settings.rabbitmq_vhost,
        credentials=credentials,
        heartbeat=60,
        blocked_connection_timeout=300,
    )
    return pika.BlockingConnection(parameters)


def declare_queues(channel: pika.adapters.blocking_connection.BlockingChannel, settings: Settings) -> None:
    channel.queue_declare(queue=settings.whisper_jobs_queue, durable=True)
    channel.queue_declare(queue=settings.features_results_queue, durable=True)


def publish_json(
    channel: pika.adapters.blocking_connection.BlockingChannel,
    *,
    queue_name: str,
    payload: dict,
) -> None:
    body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
    channel.basic_publish(
        exchange="",
        routing_key=queue_name,
        body=body,
        properties=pika.BasicProperties(
            delivery_mode=2,
            content_type="application/json",
        ),
    )
    logger.debug("Published event to %s", queue_name)
