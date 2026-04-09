import logging
import os
from contextlib import asynccontextmanager

import pika
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.consumer import start_consumer
from app.rabbitmq import QUEUE_NAME, get_channel, get_connection

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan: arranca el consumer al iniciar y lo detiene al cerrar
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando aplicación…")
    start_consumer()          # lanza el hilo de RabbitMQ
    yield
    logger.info("Apagando aplicación…")


# ---------------------------------------------------------------------------
# Instancia de FastAPI
# ---------------------------------------------------------------------------

app = FastAPI(
    title="FastAPI + RabbitMQ",
    description="Servidor base con health check y consumer de telemetría.",
    version="1.0.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health", tags=["Monitoring"])
def health_check():
    """
    Verifica el estado del servicio y la conectividad con RabbitMQ.

    Retorna:
        200 – servicio y broker operativos
        503 – no se puede alcanzar RabbitMQ
    """
    rabbitmq_status = "ok"
    try:
        conn = get_connection()
        ch = get_channel(conn)
        queue_info = ch.queue_declare(queue=QUEUE_NAME, durable=True, passive=True)
        message_count = queue_info.method.message_count
        conn.close()
    except Exception as exc:
        logger.warning("Health check – RabbitMQ no disponible: %s", exc)
        rabbitmq_status = f"error: {exc}"

    status_code = 200 if rabbitmq_status == "ok" else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ok" if status_code == 200 else "degraded",
            "service": "fastapi-rabbitmq",
            "rabbitmq": rabbitmq_status,
            "queue": QUEUE_NAME,
            "messages_in_queue": message_count if rabbitmq_status == "ok" else None,
        },
    )
