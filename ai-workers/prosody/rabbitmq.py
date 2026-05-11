import os
import logging

RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "localhost")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", 5672))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "guest")
RABBITMQ_PASS = os.getenv("RABBITMQ_PASS", "guest")
RABBITMQ_VHOST = os.getenv("RABBITMQ_VHOST", "/")

QUEUE_NAME = os.getenv("PROSODY_QUEUE", "prosody.jobs")

logger = logging.getLogger(__name__)


def get_connection() -> "pika.BlockingConnection":
    import pika

    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
    parameters = pika.ConnectionParameters(
        host=RABBITMQ_HOST,
        port=RABBITMQ_PORT,
        virtual_host=RABBITMQ_VHOST,
        credentials=credentials,
        heartbeat=60,
        blocked_connection_timeout=300,
    )
    connection = pika.BlockingConnection(parameters)
    logger.info("Conexión RabbitMQ establecida en %s:%s", RABBITMQ_HOST, RABBITMQ_PORT)
    return connection


def get_channel(connection: "pika.BlockingConnection") -> "pika.adapters.blocking_connection.BlockingChannel":
    import pika

    channel = connection.channel()
    channel.queue_declare(queue=QUEUE_NAME, durable=True)
    logger.info("Canal listo. Cola '%s' declarada.", QUEUE_NAME)
    return channel
