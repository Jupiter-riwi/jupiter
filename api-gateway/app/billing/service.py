"""Stripe-side actions: Customer, Checkout Session, Billing Portal.

These functions touch *only* Stripe + the `billing_customers` table. Everything
else (wallet credit, subscription state) is done by the webhook handler when
Stripe confirms the payment — never here.
"""

from __future__ import annotations

import logging
import os
import uuid
from typing import Any

import stripe  # type: ignore

from .plans import price_id_for_plan, price_id_for_topup

logger = logging.getLogger("jupiter.gateway.billing.service")


def _init_stripe() -> None:
    key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    if not key:
        raise RuntimeError("STRIPE_SECRET_KEY is not configured")
    stripe.api_key = key


def _success_url() -> str:
    return os.getenv("BILLING_SUCCESS_URL", "http://localhost:5173/billing/success")


def _cancel_url() -> str:
    return os.getenv("BILLING_CANCEL_URL", "http://localhost:5173/billing/cancel")


# ---------------------------------------------------------------------------
# billing_customers row (tenant <-> Stripe Customer mapping)
# ---------------------------------------------------------------------------

def get_or_create_customer(
    conn: Any,
    *,
    tenant_id: str,
    user_email: str,
    tenant_name: str | None = None,
) -> str:
    """Return the Stripe Customer ID for the tenant, creating one if missing.

    Idempotent: two concurrent callers may race; the UNIQUE(tenant_id) on
    `billing_customers` ensures only one row survives. We retry on conflict.
    """
    _init_stripe()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT stripe_customer_id FROM billing_customers WHERE tenant_id = %s;",
            (tenant_id,),
        )
        row = cur.fetchone()
    if row:
        return str(row[0])

    # Create on Stripe with idempotency-key derived from tenant_id so retries
    # don't create duplicates on Stripe's side either.
    idem = f"customer-create-{tenant_id}"
    customer = stripe.Customer.create(
        email=user_email,
        name=tenant_name or user_email,
        metadata={"tenant_id": tenant_id},
        idempotency_key=idem,
    )
    stripe_customer_id = customer["id"]

    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO billing_customers (tenant_id, stripe_customer_id) "
            "VALUES (%s, %s) "
            "ON CONFLICT (tenant_id) DO UPDATE "
            "SET stripe_customer_id = EXCLUDED.stripe_customer_id "
            "RETURNING stripe_customer_id;",
            (tenant_id, stripe_customer_id),
        )
        out = cur.fetchone()
    return str(out[0])


# ---------------------------------------------------------------------------
# Checkout Sessions
# ---------------------------------------------------------------------------

def create_subscription_checkout(
    conn: Any,
    *,
    tenant_id: str,
    user_email: str,
    plan: str,
    tenant_name: str | None = None,
) -> str:
    """Return the Checkout Session URL the frontend should redirect to."""
    if plan not in {"starter", "growth", "pro", "scale"}:
        raise ValueError(f"unknown plan: {plan}")
    customer_id = get_or_create_customer(
        conn, tenant_id=tenant_id, user_email=user_email, tenant_name=tenant_name
    )
    price_id = price_id_for_plan(plan)

    idem = f"checkout-sub-{tenant_id}-{plan}-{uuid.uuid4().hex[:8]}"
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": price_id, "quantity": 1}],
        client_reference_id=tenant_id,
        metadata={"tenant_id": tenant_id, "kind": "subscription", "plan": plan},
        subscription_data={
            "metadata": {"tenant_id": tenant_id, "plan": plan},
        },
        success_url=_success_url() + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=_cancel_url(),
        allow_promotion_codes=True,
        idempotency_key=idem,
    )
    return session["url"]


def create_topup_checkout(
    conn: Any,
    *,
    tenant_id: str,
    user_email: str,
    pack: str,
    tenant_name: str | None = None,
) -> str:
    if pack not in {"s", "m", "l"}:
        raise ValueError(f"unknown topup pack: {pack}")
    customer_id = get_or_create_customer(
        conn, tenant_id=tenant_id, user_email=user_email, tenant_name=tenant_name
    )
    price_id = price_id_for_topup(pack)

    idem = f"checkout-topup-{tenant_id}-{pack}-{uuid.uuid4().hex[:8]}"
    session = stripe.checkout.Session.create(
        mode="payment",
        customer=customer_id,
        line_items=[{"price": price_id, "quantity": 1}],
        client_reference_id=tenant_id,
        metadata={"tenant_id": tenant_id, "kind": "topup", "pack": pack},
        payment_intent_data={
            "metadata": {"tenant_id": tenant_id, "pack": pack},
        },
        success_url=_success_url() + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=_cancel_url(),
        idempotency_key=idem,
    )
    return session["url"]


# ---------------------------------------------------------------------------
# Billing Portal
# ---------------------------------------------------------------------------

def create_portal_session(
    conn: Any,
    *,
    tenant_id: str,
    user_email: str,
    return_url: str | None = None,
    tenant_name: str | None = None,
) -> str:
    customer_id = get_or_create_customer(
        conn, tenant_id=tenant_id, user_email=user_email, tenant_name=tenant_name
    )
    portal = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url or _success_url(),
    )
    return portal["url"]
