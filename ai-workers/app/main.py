"""
AI Workers — FastAPI entrypoint.

Selects the correct worker class based on the WORKER_TYPE environment variable,
starts it in a daemon thread, and exposes a /health endpoint for Docker health
checks.

WORKER_TYPE values: pose | whisper | prosody | scoring
"""

import logging
import os
import sys
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

WORKER_TYPE = os.getenv("WORKER_TYPE", "pose")


def _build_worker():
    if WORKER_TYPE == "pose":
        from workers.pose import PoseWorker
        return PoseWorker()
    elif WORKER_TYPE == "whisper":
        from workers.whisper import WhisperWorker
        return WhisperWorker()
    elif WORKER_TYPE == "prosody":
        from workers.prosody import ProsodyWorker
        return ProsodyWorker()
    elif WORKER_TYPE == "scoring":
        from workers.scoring import ScoringWorker
        return ScoringWorker()
    else:
        logger.error("Unknown WORKER_TYPE=%r — must be pose|whisper|prosody|scoring", WORKER_TYPE)
        sys.exit(1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    worker = _build_worker()
    thread = threading.Thread(target=worker.run, name=f"worker-{WORKER_TYPE}", daemon=True)
    thread.start()
    logger.info("Worker thread started for WORKER_TYPE=%s", WORKER_TYPE)
    yield
    logger.info("Shutting down %s worker", WORKER_TYPE)


app = FastAPI(
    title=f"Jupiter Worker — {WORKER_TYPE}",
    description="AI feature extraction worker with fan-in coordinator.",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health", tags=["Monitoring"])
def health_check():
    return JSONResponse(
        status_code=200,
        content={"status": "ok", "worker_type": WORKER_TYPE},
    )
