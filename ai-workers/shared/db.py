"""
Persistencia compartida para todos los AI Workers.

Proporciona funciones para leer/escribir en las tablas `features` y `scores`
definidas en el contrato de TEAM.md.

Uso:
    from shared.db import get_connection, insert_features, fetch_features_by_evaluation, insert_score

Las funciones aceptan un `connection` opcional para permitir transacciones.
Si no se provee, abren/cierran su propia conexión.

Variables de entorno:
    DATABASE_URL — postgresql://user:pass@host:port/dbname
"""

import json
import logging
import os
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://apex_vision:apex_vision@localhost:5432/apex_vision",
)


def _parse_dsn(url: str) -> dict:
    from urllib.parse import urlparse

    parsed = urlparse(url)
    return {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 5432,
        "dbname": parsed.path.lstrip("/") or "apex_vision",
        "user": parsed.username or "apex_vision",
        "password": parsed.password or "apex_vision",
    }


def get_connection():
    import psycopg2

    dsn = _parse_dsn(DATABASE_URL)
    conn = psycopg2.connect(**dsn)
    logger.debug("Conexión Postgres establecida en %s:%s/%s",
                 dsn["host"], dsn["port"], dsn["dbname"])
    return conn


@contextmanager
def _ensure_connection(conn=None):
    if conn is not None:
        yield conn
        return
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


# =============================================================================
# Features (tabla features)
# =============================================================================

def insert_features(
    evaluation_id: str,
    tenant_id: str,
    kind: str,
    payload: dict,
    conn=None,
) -> str:
    feature_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    with _ensure_connection(conn) as c:
        with c.cursor() as cur:
            cur.execute(
                """
                INSERT INTO features (id, evaluation_id, tenant_id, kind, payload, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    feature_id,
                    evaluation_id,
                    tenant_id,
                    kind,
                    json.dumps(payload, ensure_ascii=False),
                    now,
                ),
            )
        c.commit()

    logger.info(
        "INSERT features | id=%s | evaluation_id=%s | kind=%s",
        feature_id, evaluation_id, kind,
    )
    return feature_id


def fetch_features_by_evaluation(
    evaluation_id: str,
    conn=None,
) -> dict[str, dict]:
    with _ensure_connection(conn) as c:
        with c.cursor() as cur:
            cur.execute(
                """
                SELECT kind, payload
                FROM features
                WHERE evaluation_id = %s
                ORDER BY created_at
                """,
                (evaluation_id,),
            )
            rows = cur.fetchall()

    result: dict[str, dict] = {}
    for kind, payload in rows:
        result[kind] = payload if isinstance(payload, dict) else json.loads(payload)

    logger.info(
        "SELECT features | evaluation_id=%s | kinds_found=%s",
        evaluation_id, list(result.keys()),
    )
    return result


def all_features_ready(evaluation_id: str, conn=None) -> bool:
    required = {"transcript"}
    found = fetch_features_by_evaluation(evaluation_id, conn)
    return required.issubset(set(found.keys()))


# =============================================================================
# Scores (tabla scores)
# =============================================================================

def insert_score(
    evaluation_id: str,
    tenant_id: str,
    overall: int,
    dimensions: dict,
    recommendations: list[dict],
    conn=None,
) -> str:
    score_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    breakdown = {
        "overall": overall,
        "dimensions": dimensions,
        "recommendations": recommendations,
    }

    with _ensure_connection(conn) as c:
        with c.cursor() as cur:
            cur.execute(
                """
                INSERT INTO scores (id, evaluation_id, tenant_id, value, breakdown, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    score_id,
                    evaluation_id,
                    tenant_id,
                    overall,
                    json.dumps(breakdown, ensure_ascii=False),
                    now,
                    now,
                ),
            )
        c.commit()

    logger.info(
        "INSERT scores | id=%s | evaluation_id=%s | overall=%d",
        score_id, evaluation_id, overall,
    )
    return score_id


def update_evaluation_status(
    evaluation_id: str,
    status: str,
    score: float | None = None,
    features: dict | None = None,
    conn=None,
) -> None:
    with _ensure_connection(conn) as c:
        with c.cursor() as cur:
            cur.execute(
                """
                UPDATE evaluations
                SET status = %s,
                    score = %s,
                    features = %s,
                    updated_at = %s
                WHERE id = %s
                """,
                (
                    status,
                    score,
                    json.dumps(features, ensure_ascii=False) if features else None,
                    datetime.now(timezone.utc),
                    evaluation_id,
                ),
            )
        c.commit()
