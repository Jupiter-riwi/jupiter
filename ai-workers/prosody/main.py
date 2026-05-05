import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from prosody.worker import start_consumer
from prosody.rabbitmq import QUEUE_NAME, get_connection, get_channel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando Prosody Worker…")
    start_consumer()
    yield
    logger.info("Apagando Prosody Worker…")


app = FastAPI(
    title="Apex Vision — Prosody Worker",
    description="Analiza cualidades vocales (pitch, energia, pausas, muletillas) desde audio.",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health", tags=["Monitoring"])
def health_check():
    rabbitmq_status = "ok"
    message_count = None
    try:
        conn = get_connection()
        ch = get_channel(conn)
        queue_info = ch.queue_declare(queue=QUEUE_NAME, durable=True, passive=True)
        message_count = queue_info.method.message_count
        conn.close()
    except Exception as exc:
        logger.warning("Health check — RabbitMQ no disponible: %s", exc)
        rabbitmq_status = f"error: {exc}"

    status_code = 200 if rabbitmq_status == "ok" else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ok" if status_code == 200 else "degraded",
            "service": "apex-vision-prosody-worker",
            "rabbitmq": rabbitmq_status,
            "queue": QUEUE_NAME,
            "messages_in_queue": message_count,
        },
    )
