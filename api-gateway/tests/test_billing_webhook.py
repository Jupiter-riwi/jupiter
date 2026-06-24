"""Tests for the Stripe webhook receiver.

These exercise the handlers directly with synthetic event payloads, plus they
verify the signature path via Stripe's own `Webhook.construct_event` helper
with a known secret.
"""

from __future__ import annotations

import hmac
import hashlib
import json
import os
import time
from unittest.mock import patch

import pytest
import stripe

from app.billing import webhooks as W


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

WEBHOOK_SECRET = "whsec_test_local_only"


def _signed_payload(payload: dict) -> tuple[bytes, str]:
    """Build a payload + the Stripe-Signature header value, the same way Stripe
    does it (so `stripe.Webhook.construct_event` accepts it)."""
    body = json.dumps(payload).encode("utf-8")
    ts = str(int(time.time()))
    signed = f"{ts}.{body.decode()}".encode("utf-8")
    sig = hmac.new(WEBHOOK_SECRET.encode(), signed, hashlib.sha256).hexdigest()
    header = f"t={ts},v1={sig}"
    return body, header


@pytest.fixture(autouse=True)
def _webhook_env():
    """Set up the webhook secret and stub a few env vars for the duration of
    each test, then restore."""
    saved = {k: os.environ.get(k) for k in ["STRIPE_WEBHOOK_SECRET",
                                            "STRIPE_PRICE_STARTER",
                                            "STRIPE_PRICE_GROWTH",
                                            "STRIPE_PRICE_TOPUP_S",
                                            "STRIPE_PRICE_TOPUP_M"]}
    os.environ["STRIPE_WEBHOOK_SECRET"] = WEBHOOK_SECRET
    os.environ["STRIPE_PRICE_STARTER"] = "price_starter_test"
    os.environ["STRIPE_PRICE_GROWTH"] = "price_growth_test"
    os.environ["STRIPE_PRICE_TOPUP_S"] = "price_topup_s_test"
    os.environ["STRIPE_PRICE_TOPUP_M"] = "price_topup_m_test"
    yield
    for k, v in saved.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v


# ---------------------------------------------------------------------------
# Signature verification
# ---------------------------------------------------------------------------

def test_verify_event_accepts_valid_signature():
    body, sig = _signed_payload({"id": "evt_1", "type": "ping", "data": {"object": {}}})
    event = W._verify_event(body, sig)
    assert event["id"] == "evt_1"


def test_verify_event_rejects_wrong_signature():
    body, _ = _signed_payload({"id": "evt_1", "type": "ping", "data": {"object": {}}})
    with pytest.raises(Exception) as exc_info:
        W._verify_event(body, "t=1,v1=deadbeef")
    # FastAPI HTTPException with status 400
    assert getattr(exc_info.value, "status_code", None) == 400


def test_verify_event_rejects_missing_signature():
    body, _ = _signed_payload({"id": "evt_1", "type": "ping", "data": {"object": {}}})
    with pytest.raises(Exception) as exc_info:
        W._verify_event(body, "")
    assert getattr(exc_info.value, "status_code", None) == 400


# ---------------------------------------------------------------------------
# Idempotency (_try_record_event)
# ---------------------------------------------------------------------------

def test_try_record_event_is_true_on_first_arrival(fake_conn):
    ok = W._try_record_event(fake_conn, {"id": "evt_x", "type": "ping", "data": {"object": {}}})
    assert ok is True
    assert "evt_x" in fake_conn.payment_events


def test_try_record_event_is_false_on_duplicate(fake_conn):
    e = {"id": "evt_dup", "type": "ping", "data": {"object": {}}}
    assert W._try_record_event(fake_conn, e) is True
    assert W._try_record_event(fake_conn, e) is False


# ---------------------------------------------------------------------------
# Handler: top-up credits AT correctly
# ---------------------------------------------------------------------------

def test_handle_topup_credits_purchased(fake_conn, tenant_a):
    session = {
        "id": "cs_test_1",
        "client_reference_id": tenant_a,
        "metadata": {"tenant_id": tenant_a, "kind": "topup", "pack": "m"},
    }
    W.handle_checkout_completed(fake_conn, session, event_id="evt_topup_1")
    bal = fake_conn.wallets[tenant_a]
    assert bal["purchased_remaining"] == 350  # M pack = 350 AT
    # Ledger written
    assert any(e["reason"] == "topup" and e["delta"] == 350 for e in fake_conn.ledger)


def test_handle_topup_ignores_subscription_kind(fake_conn, tenant_a):
    session = {"id": "cs_test_2", "metadata": {"tenant_id": tenant_a, "kind": "subscription"}}
    W.handle_checkout_completed(fake_conn, session, event_id="evt_sub_via_checkout")
    # No wallet should be created from this codepath
    assert tenant_a not in fake_conn.wallets or fake_conn.wallets[tenant_a]["purchased_remaining"] == 0


def test_handle_topup_skips_when_no_tenant(fake_conn):
    session = {"id": "cs_test_3", "metadata": {"kind": "topup", "pack": "s"}}
    W.handle_checkout_completed(fake_conn, session, event_id="evt_no_tenant")
    # No crash, no credit
    assert not fake_conn.ledger


# ---------------------------------------------------------------------------
# Dispatch routing
# ---------------------------------------------------------------------------

def test_dispatch_covers_required_events():
    required = {
        "checkout.session.completed",
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "invoice.paid",
        "invoice.payment_failed",
    }
    assert required.issubset(W.DISPATCH.keys())


# ---------------------------------------------------------------------------
# Plans mapping
# ---------------------------------------------------------------------------

def test_plan_at_quotas_match_financial_plan():
    from app.billing.plans import PLAN_AT_QUOTA, TOPUP_AT
    assert PLAN_AT_QUOTA == {"starter": 200, "growth": 650, "pro": 1800, "scale": 5000}
    assert TOPUP_AT == {"s": 120, "m": 350, "l": 800}


def test_price_id_reverse_lookup_works():
    from app.billing.plans import plan_for_price_id, topup_for_price_id
    assert plan_for_price_id("price_starter_test") == "starter"
    assert plan_for_price_id("price_unknown_xyz") is None
    assert topup_for_price_id("price_topup_s_test") == "s"
    assert topup_for_price_id("price_topup_xyz") is None
