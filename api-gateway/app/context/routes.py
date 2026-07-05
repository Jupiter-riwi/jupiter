"""Session-context REST endpoints under /api/contexts.

Create/list/get are open to any authenticated user (on-the-fly creation from
the Live Room). Deactivation is admin-only: reusable vacantes/productos are a
tenant-level asset managed from the admin panel.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

from app.billing.db import tenant_scope

from .compiler import CompileError, compile_brief

logger = logging.getLogger("jupiter.gateway.context.routes")

router = APIRouter(prefix="/api/contexts", tags=["contexts"])


class CreateContextRequest(BaseModel):
    kind: str = Field(pattern=r"^(puesto|producto)$")
    title: str = Field(min_length=3, max_length=200)
    raw_text: str = Field(min_length=30, max_length=20000)


def _require_user(authorization: str | None) -> tuple[str, str]:
    from app.main import _require_user as _ru  # lazy: avoids circular import
    return _ru(authorization)


def _require_admin(authorization: str | None) -> tuple[str, str]:
    from app.main import _require_admin as _ra  # lazy: avoids circular import
    return _ra(authorization)


def _db_conn():
    from app.main import db_conn as _dc  # lazy: avoids circular import
    return _dc()


def _row_to_summary(row: Any) -> dict[str, Any]:
    return {
        "id": str(row[0]),
        "kind": row[1],
        "title": row[2],
        "created_at": row[3].isoformat() if hasattr(row[3], "isoformat") else str(row[3]),
    }


@router.post("")
def create_context(
    body: CreateContextRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    user_id, tenant_id = _require_user(authorization)

    try:
        brief = compile_brief(body.kind, body.raw_text)
    except CompileError as exc:
        logger.warning("brief compile failed: %s", exc)
        raise HTTPException(status_code=502, detail="context_compile_failed")

    with _db_conn() as conn:
        with tenant_scope(conn, tenant_id):
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO session_contexts
                        (tenant_id, created_by, kind, title, raw_text, brief)
                    VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s::jsonb)
                    RETURNING id;
                    """,
                    (tenant_id, user_id, body.kind, body.title.strip(),
                     body.raw_text.strip(), json.dumps(brief.model_dump(), ensure_ascii=False)),
                )
                context_id = str(cur.fetchone()[0])

    return {"id": context_id, "kind": body.kind, "title": body.title.strip(),
            "brief": brief.model_dump()}


@router.get("")
def list_contexts(
    authorization: str | None = Header(default=None),
    kind: str | None = Query(default=None, pattern=r"^(puesto|producto)$"),
) -> dict[str, list[dict[str, Any]]]:
    _user_id, tenant_id = _require_user(authorization)
    with _db_conn() as conn:
        with tenant_scope(conn, tenant_id):
            with conn.cursor() as cur:
                if kind:
                    cur.execute(
                        "SELECT id, kind, title, created_at FROM session_contexts "
                        "WHERE tenant_id = %s::uuid AND is_active AND kind = %s "
                        "ORDER BY created_at DESC LIMIT 100;",
                        (tenant_id, kind),
                    )
                else:
                    cur.execute(
                        "SELECT id, kind, title, created_at FROM session_contexts "
                        "WHERE tenant_id = %s::uuid AND is_active "
                        "ORDER BY created_at DESC LIMIT 100;",
                        (tenant_id,),
                    )
                rows = cur.fetchall()
    return {"data": [_row_to_summary(r) for r in rows]}


@router.get("/{context_id}")
def get_context(
    context_id: str,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _user_id, tenant_id = _require_user(authorization)
    with _db_conn() as conn:
        with tenant_scope(conn, tenant_id):
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, kind, title, raw_text, brief, created_at "
                    "FROM session_contexts "
                    "WHERE id = %s::uuid AND tenant_id = %s::uuid AND is_active;",
                    (context_id, tenant_id),
                )
                row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="context not found")
    brief = row[4] if isinstance(row[4], dict) else json.loads(row[4])
    return {
        "id": str(row[0]), "kind": row[1], "title": row[2],
        "raw_text": row[3], "brief": brief,
        "created_at": row[5].isoformat() if hasattr(row[5], "isoformat") else str(row[5]),
    }


@router.delete("/{context_id}")
def deactivate_context(
    context_id: str,
    authorization: str | None = Header(default=None),
) -> dict[str, str]:
    _user_id, tenant_id = _require_admin(authorization)
    with _db_conn() as conn:
        with tenant_scope(conn, tenant_id):
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE session_contexts SET is_active = false "
                    "WHERE id = %s::uuid AND tenant_id = %s::uuid RETURNING id;",
                    (context_id, tenant_id),
                )
                row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="context not found")
    return {"status": "deactivated", "id": context_id}


def load_brief_for_session(conn, tenant_id: str, context_id: str) -> dict[str, Any] | None:
    """Used by the live router: fetch kind+title+brief for a session, or None.
    Caller must already be inside tenant_scope."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT kind, title, brief FROM session_contexts "
            "WHERE id = %s::uuid AND tenant_id = %s::uuid AND is_active;",
            (context_id, tenant_id),
        )
        row = cur.fetchone()
    if not row:
        return None
    brief = row[2] if isinstance(row[2], dict) else json.loads(row[2])
    return {"kind": row[0], "title": row[1], **brief}
