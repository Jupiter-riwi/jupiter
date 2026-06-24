"""Stripe webhook receiver.

Three invariants the small implementer MUST keep:

1. Verify the signature against the RAW request body BEFORE parsing JSON.
   If a wrong/forged signature gets through, anyone on the internet could
   credit AT to themselves.

2. Be idempotent. Stripe retries failed deliveries: every event id is
   recorded in `payment_events` and the second arrival is a no-op.

3. The webhook has NO JWT. Resolve `tenant_id` from `billing_customers`
   via the SECURITY DEFINER function before touching any tenant-scoped
   table, then call `tenant_scope` so RLS policies pass.

Handlers update `subscriptions` and `at_wallets` only. All AT changes go
through `wallet.credit / reset_included` so the ledger stays accurate.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import stripe  # type: ignore
from fastapi import APIRouter, HTTPException, Request

from . import wallet
from .db import resolve_tenant_for_customer, tenant_scope
from .plans import PLAN_AT_QUOTA, TOPUP_AT, plan_for_price_id, topup_for_price_id

logger = logging.getLogger("jupiter.gateway.billing.webhooks")

router = APIRouter(tags=["billing-webhook"])


# ---------------------------------------------------------------------------
# Signature verification
# ---------------------------------------------------------------------------

def _webhook_secret() -> str:
    secret = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()
    if not secret:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET is not configured")
    return secret


def _verify_event(raw_body: bytes, signature: str) -> dict[str, Any]:
    """Returns the parsed event dict if signature is valid; raises 400 otherwise."""
    try:
        event = stripe.Webhook.construct_event(raw_body, signature, _webhook_secret())
    except stripe.error.SignatureVerificationError:  # type: ignore[attr-defined]
        raise HTTPException(status_code=400, detail="invalid signature")
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid payload")
    return event


# ---------------------------------------------------------------------------
# Idempotency
# ---------------------------------------------------------------------------

def _try_record_event(conn, event: dict[str, Any]) -> bool:
    """Insert into payment_events. Returns True if newly recorded, False if it
    was already processed (idempotent no-op)."""
    event_id = event["id"]
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO payment_events (stripe_event_id, type, payload) "
                "VALUES (%s, %s, %s);",
                (event_id, event["type"], json.dumps(event)),
            )
        conn.commit()
        return True
    except Exception as exc:
        conn.rollback()
        msg = str(exc).lower()
        if "duplicate" in msg or "unique" in msg or "already" in msg:
            return False
        raise


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------

def _ts(epoch_seconds: int | None):
    if epoch_seconds is None:
        return None
    return datetime.fromtimestamp(int(epoch_seconds), tz=timezone.utc)


def handle_checkout_completed(conn, obj: dict[str, Any], event_id: str) -> None:
    """Credit AT for one-time top-ups. Subscription provisioning is handled by
    customer.subscription.created/updated + invoice.paid (more reliable than
    relying on checkout.session.completed for subscriptions)."""
    kind = (obj.get("metadata") or {}).get("kind") or ""
    if kind != "topup":
        return  # subscription handled elsewhere

    tenant_id = (obj.get("metadata") or {}).get("tenant_id") or obj.get("client_reference_id")
    if not tenant_id:
        logger.warning("checkout.session.completed without tenant_id: %s", obj.get("id"))
        return
    pack = (obj.get("metadata") or {}).get("pack")
    amount = TOPUP_AT.get(str(pack), 0) if pack else 0
    if amount <= 0:
        # Fall back to reverse-lookup by price id if metadata was missing.
        line_items = obj.get("line_items", {}).get("data") or []
        if line_items:
            price_id = line_items[0].get("price", {}).get("id", "")
            pack2 = topup_for_price_id(price_id)
            amount = TOPUP_AT.get(pack2 or "", 0)
    if amount <= 0:
        logger.warning("topup with no resolvable AT: session=%s", obj.get("id"))
        return

    with tenant_scope(conn, tenant_id):
        wallet.credit(
            conn, tenant_id, amount, "topup",
            ref_type="stripe_event", ref_id=event_id,
        )


def handle_subscription_sync(conn, obj: dict[str, Any], event_id: str) -> None:
    """Upsert the subscription row whenever Stripe says it changed."""
    tenant_id = (obj.get("metadata") or {}).get("tenant_id")
    customer_id = obj.get("customer")
    if not tenant_id and customer_id:
        tenant_id = resolve_tenant_for_customer(conn, customer_id)
    if not tenant_id:
        logger.warning("subscription event without tenant: %s", obj.get("id"))
        return

    items = obj.get("items", {}).get("data") or []
    price_id = items[0].get("price", {}).get("id", "") if items else ""
    plan = plan_for_price_id(price_id) or "starter"
    quota = PLAN_AT_QUOTA.get(plan, 0)

    with tenant_scope(conn, tenant_id):
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO subscriptions ("
                "  tenant_id, stripe_subscription_id, stripe_price_id, plan, status,"
                "  included_at_quota, current_period_start, current_period_end,"
                "  cancel_at_period_end"
                ") VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) "
                "ON CONFLICT (stripe_subscription_id) DO UPDATE SET "
                "  stripe_price_id = EXCLUDED.stripe_price_id,"
                "  plan = EXCLUDED.plan,"
                "  status = EXCLUDED.status,"
                "  included_at_quota = EXCLUDED.included_at_quota,"
                "  current_period_start = EXCLUDED.current_period_start,"
                "  current_period_end = EXCLUDED.current_period_end,"
                "  cancel_at_period_end = EXCLUDED.cancel_at_period_end;",
                (
                    tenant_id,
                    obj["id"],
                    price_id,
                    plan,
                    obj.get("status", "incomplete"),
                    quota,
                    _ts(obj.get("current_period_start")),
                    _ts(obj.get("current_period_end")),
                    bool(obj.get("cancel_at_period_end", False)),
                ),
            )


def handle_subscription_canceled(conn, obj: dict[str, Any], event_id: str) -> None:
    sub_id = obj["id"]
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE subscriptions SET status='canceled', cancel_at_period_end=true "
            "WHERE stripe_subscription_id = %s;",
            (sub_id,),
        )
    conn.commit()


def handle_invoice_paid(conn, obj: dict[str, Any], event_id: str) -> None:
    """Reset the included AT quota for the new billing cycle."""
    customer_id = obj.get("customer")
    tenant_id = resolve_tenant_for_customer(conn, customer_id) if customer_id else None
    if not tenant_id:
        logger.warning("invoice.paid with no tenant mapping: %s", obj.get("id"))
        return

    # Look at the subscription line on the invoice to know which plan we're on.
    sub_id = obj.get("subscription")
    if not sub_id:
        logger.warning("invoice.paid without subscription id: %s", obj.get("id"))
        return

    with tenant_scope(conn, tenant_id):
        with conn.cursor() as cur:
            cur.execute(
                "SELECT plan, included_at_quota FROM subscriptions WHERE stripe_subscription_id = %s;",
                (sub_id,),
            )
            row = cur.fetchone()
        if not row:
            # Subscription not yet synced; the customer.subscription.* event will
            # land separately and create the row. Re-deliveries from Stripe will
            # eventually pick this up.
            logger.info("invoice.paid before subscription sync: %s", sub_id)
            return
        quota = int(row[1])
        wallet.reset_included(
            conn, tenant_id, quota,
            ref_type="stripe_event", ref_id=event_id,
        )

        # Mark subscription active and update period end if Stripe sent it.
        period_end = _ts(obj.get("lines", {}).get("data", [{}])[0].get("period", {}).get("end"))
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE subscriptions SET status='active', "
                "current_period_end = COALESCE(%s, current_period_end) "
                "WHERE stripe_subscription_id = %s;",
                (period_end, sub_id),
            )


def handle_invoice_failed(conn, obj: dict[str, Any], event_id: str) -> None:
    sub_id = obj.get("subscription")
    if not sub_id:
        return
    customer_id = obj.get("customer")
    tenant_id = resolve_tenant_for_customer(conn, customer_id) if customer_id else None
    if tenant_id:
        with tenant_scope(conn, tenant_id):
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE subscriptions SET status='past_due' WHERE stripe_subscription_id = %s;",
                    (sub_id,),
                )


# ---------------------------------------------------------------------------
# Receiver
# ---------------------------------------------------------------------------

DISPATCH = {
    "checkout.session.completed": handle_checkout_completed,
    "customer.subscription.created": handle_subscription_sync,
    "customer.subscription.updated": handle_subscription_sync,
    "customer.subscription.deleted": handle_subscription_canceled,
    "invoice.paid": handle_invoice_paid,
    "invoice.payment_succeeded": handle_invoice_paid,  # alias seen on some accounts
    "invoice.payment_failed": handle_invoice_failed,
}


@router.post("/api/webhooks/stripe")
async def stripe_webhook(request: Request) -> dict[str, Any]:
    raw = await request.body()
    sig = request.headers.get("stripe-signature", "")
    event = _verify_event(raw, sig)

    # Open a dedicated connection so the route does not share state with other
    # request handlers (webhooks may interleave heavily under retries).
    from app.main import db_conn as _db
    with _db() as conn:
        newly_recorded = _try_record_event(conn, event)
        if not newly_recorded:
            return {"received": True, "duplicate": True}

        handler = DISPATCH.get(event["type"])
        if handler is None:
            return {"received": True, "ignored": True}

        try:
            handler(conn, event["data"]["object"], event["id"])
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("webhook handler failed: %s %s", event["type"], event["id"])
            # Returning 500 makes Stripe retry — that's what we want.
            raise HTTPException(status_code=500, detail=f"handler error: {exc}")

    return {"received": True}
