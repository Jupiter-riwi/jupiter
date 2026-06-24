"""Billing REST endpoints under /api/billing/*.

Auth: every endpoint here requires a valid JWT (reuses helpers from main.py).
The webhook route lives in webhooks.py because it does NOT use JWT.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

from . import wallet, service
from .db import tenant_scope

logger = logging.getLogger("jupiter.gateway.billing.routes")

router = APIRouter(prefix="/api/billing", tags=["billing"])


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class CheckoutSubscriptionRequest(BaseModel):
    plan: str = Field(pattern=r"^(starter|growth|pro|scale)$")


class CheckoutTopupRequest(BaseModel):
    pack: str = Field(pattern=r"^(s|m|l)$")


class CheckoutResponse(BaseModel):
    url: str


# ---------------------------------------------------------------------------
# Dependencies — imported lazily so tests can patch them without circular imports
# ---------------------------------------------------------------------------

def _require_user(authorization: str | None) -> tuple[str, str]:
    """Re-export of main._require_user via lazy import (avoids circular imports
    if main imports this module at startup)."""
    from app.main import _require_user as _ru  # noqa: WPS433
    return _ru(authorization)


def _db_conn():
    from app.main import db_conn as _dc  # noqa: WPS433
    return _dc()


def _user_email_from_db(conn, user_id: str) -> str:
    with conn.cursor() as cur:
        cur.execute("SELECT email FROM users WHERE id = %s;", (user_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="user not found")
    return str(row[0])


def _tenant_name_from_db(conn, tenant_id: str) -> str | None:
    with conn.cursor() as cur:
        cur.execute("SELECT name FROM tenants WHERE id = %s;", (tenant_id,))
        row = cur.fetchone()
    return str(row[0]) if row else None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/checkout/subscription", response_model=CheckoutResponse)
def checkout_subscription(
    body: CheckoutSubscriptionRequest,
    authorization: str | None = Header(default=None),
) -> CheckoutResponse:
    user_id, tenant_id = _require_user(authorization)
    with _db_conn() as conn:
        with tenant_scope(conn, tenant_id):
            email = _user_email_from_db(conn, user_id)
            name = _tenant_name_from_db(conn, tenant_id)
            url = service.create_subscription_checkout(
                conn,
                tenant_id=tenant_id,
                user_email=email,
                plan=body.plan,
                tenant_name=name,
            )
    return CheckoutResponse(url=url)


@router.post("/checkout/topup", response_model=CheckoutResponse)
def checkout_topup(
    body: CheckoutTopupRequest,
    authorization: str | None = Header(default=None),
) -> CheckoutResponse:
    user_id, tenant_id = _require_user(authorization)
    with _db_conn() as conn:
        with tenant_scope(conn, tenant_id):
            email = _user_email_from_db(conn, user_id)
            name = _tenant_name_from_db(conn, tenant_id)
            url = service.create_topup_checkout(
                conn,
                tenant_id=tenant_id,
                user_email=email,
                pack=body.pack,
                tenant_name=name,
            )
    return CheckoutResponse(url=url)


@router.post("/portal", response_model=CheckoutResponse)
def billing_portal(
    authorization: str | None = Header(default=None),
) -> CheckoutResponse:
    user_id, tenant_id = _require_user(authorization)
    with _db_conn() as conn:
        with tenant_scope(conn, tenant_id):
            email = _user_email_from_db(conn, user_id)
            name = _tenant_name_from_db(conn, tenant_id)
            url = service.create_portal_session(
                conn,
                tenant_id=tenant_id,
                user_email=email,
                tenant_name=name,
            )
    return CheckoutResponse(url=url)


@router.get("/subscription")
def get_subscription(
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _user_id, tenant_id = _require_user(authorization)
    with _db_conn() as conn:
        with tenant_scope(conn, tenant_id):
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT plan, status, current_period_start, current_period_end, "
                    "       cancel_at_period_end, included_at_quota "
                    "FROM subscriptions "
                    "WHERE tenant_id = %s AND status IN ('active','trialing','past_due') "
                    "ORDER BY updated_at DESC LIMIT 1;",
                    (tenant_id,),
                )
                row = cur.fetchone()
    if not row:
        return {"plan": None, "status": "none"}
    return {
        "plan": row[0],
        "status": row[1],
        "current_period_start": row[2].isoformat() if row[2] else None,
        "current_period_end": row[3].isoformat() if row[3] else None,
        "cancel_at_period_end": bool(row[4]),
        "included_at_quota": int(row[5]),
    }


@router.get("/balance")
def get_balance(
    authorization: str | None = Header(default=None),
) -> dict[str, int]:
    _user_id, tenant_id = _require_user(authorization)
    with _db_conn() as conn:
        with tenant_scope(conn, tenant_id):
            return wallet.get_balance(conn, tenant_id)


@router.get("/ledger")
def get_ledger(
    authorization: str | None = Header(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict[str, Any]]:
    _user_id, tenant_id = _require_user(authorization)
    with _db_conn() as conn:
        with tenant_scope(conn, tenant_id):
            return wallet.list_ledger(conn, tenant_id, limit=limit)
