"""Persistence for live sessions (history of scored conversations).

Follows the gateway's runtime `CREATE TABLE IF NOT EXISTS` convention
(see ensure_*_table helpers in main.py) instead of an Alembic migration.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import psycopg2

logger = logging.getLogger("jupiter.gateway.live.store")


def _conn():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        dbname=os.getenv("DB_NAME", "jupiter"),
    )


_DDL = """
CREATE TABLE IF NOT EXISTS live_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    mode TEXT NOT NULL,
    role_type TEXT NOT NULL,
    level TEXT NOT NULL,
    lang TEXT NOT NULL,
    persona_name TEXT,
    scenario TEXT,
    transcript JSONB,
    score JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_live_sessions_user_created
    ON live_sessions (user_id, created_at DESC);
"""


def save_session(
    *, tenant_id: str, user_id: str, mode: str, role_type: str, level: str, lang: str,
    persona_name: str, scenario: str | None, transcript: list[dict], score: dict | None,
) -> str | None:
    try:
        conn = _conn()
        try:
            with conn.cursor() as cur:
                cur.execute(_DDL)
                cur.execute(
                    """
                    INSERT INTO live_sessions
                        (tenant_id, user_id, mode, role_type, level, lang, persona_name, scenario, transcript, score)
                    VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb)
                    RETURNING id
                    """,
                    (tenant_id, user_id, mode, role_type, level, lang, persona_name, scenario,
                     json.dumps(transcript, ensure_ascii=False),
                     json.dumps(score, ensure_ascii=False) if score is not None else None),
                )
                sid = cur.fetchone()[0]
            conn.commit()
            return str(sid)
        finally:
            conn.close()
    except Exception as exc:  # pragma: no cover
        logger.warning("save_session failed (non-fatal): %s", exc)
        return None


def list_sessions(*, user_id: str, tenant_id: str, limit: int = 50) -> list[dict[str, Any]]:
    try:
        conn = _conn()
        try:
            with conn.cursor() as cur:
                cur.execute(_DDL)
                cur.execute(
                    """
                    SELECT id, mode, role_type, level, lang, persona_name, scenario, score, created_at
                    FROM live_sessions
                    WHERE user_id = %s::uuid AND tenant_id = %s::uuid
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (user_id, tenant_id, limit),
                )
                rows = cur.fetchall()
            out = []
            for r in rows:
                out.append({
                    "id": str(r[0]), "mode": r[1], "role_type": r[2], "level": r[3], "lang": r[4],
                    "persona_name": r[5], "scenario": r[6], "score": r[7],
                    "created_at": r[8].isoformat() if r[8] else None,
                })
            return out
        finally:
            conn.close()
    except Exception as exc:  # pragma: no cover
        logger.warning("list_sessions failed: %s", exc)
        return []
