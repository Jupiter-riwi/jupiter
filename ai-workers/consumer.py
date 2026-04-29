import asyncio
import logging
import threading
from datetime import datetime

import pika

from app.rabbitmq import QUEUE_NAME, get_channel, get_connection

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Callback que se ejecuta por cada mensaje recibido
# ---------------------------------------------------------------------------

def on_message(channel, method, properties, body: bytes) -> None:
    """
    Callback invocado por pika cada vez que llega un mensaje a telemetry_queue.

    Parámetros:
        channel   – canal pika activo
        method    – metadatos de entrega (routing key, delivery tag, etc.)
        properties – propiedades AMQP del mensaje
        body      – payload del mensaje en bytes
    """
    timestamp = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    try:
        payload = body.decode("utf-8")
    except UnicodeDecodeError:
        payload = repr(body)

    logger.info(
        "[%s] 📨 Mensaje recibido | queue=%s | delivery_tag=%s | payload=%s",
        timestamp,
        QUEUE_NAME,
        method.delivery_tag,
        payload,
    )

    # ACK manual: le indica a RabbitMQ que el mensaje fue procesado correctamente
    channel.basic_ack(delivery_tag=method.delivery_tag)


# ---------------------------------------------------------------------------
# Lógica de consumo que corre en un hilo dedicado
# ---------------------------------------------------------------------------

def _blocking_consume() -> None:
    """
    Bucle bloqueante de pika que consume mensajes de telemetry_queue.
    Se ejecuta en un hilo secundario para no bloquear el event loop de asyncio.
    """
    while True:
        try:
            connection = get_connection()
            channel = get_channel(connection)

            # Un solo mensaje a la vez por worker (fair dispatch)
            channel.basic_qos(prefetch_count=1)

            channel.basic_consume(
                queue=QUEUE_NAME,
                on_message_callback=on_message,
                auto_ack=False,  # ACK manual dentro del callback
            )

            logger.info("Consumer iniciado. Esperando mensajes en '%s'...", QUEUE_NAME)
            channel.start_consuming()

        except pika.exceptions.AMQPConnectionError as exc:
            logger.error("Conexión perdida con RabbitMQ: %s. Reintentando en 5 s...", exc)
            import time
            time.sleep(5)

        except Exception as exc:
            logger.exception("Error inesperado en el consumer: %s. Reintentando en 5 s...", exc)
            import time
            time.sleep(5)


# ---------------------------------------------------------------------------
# API pública: iniciar el consumer de forma no bloqueante
# ---------------------------------------------------------------------------

def start_consumer() -> None:
    """
    Lanza _blocking_consume en un hilo daemon para que conviva con uvicorn.
    """
    thread = threading.Thread(
        target=_blocking_consume,
        name="rabbitmq-consumer",
        daemon=True,  # el hilo muere automáticamente cuando termina el proceso principal
    )
    thread.start()
    logger.info("Hilo del consumer de RabbitMQ iniciado (daemon=True).")
