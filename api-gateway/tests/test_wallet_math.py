"""Tests for app.billing.wallet — pure AT bookkeeping."""

from __future__ import annotations

import pytest

from app.billing import wallet as W


# --- Balance basics -------------------------------------------------------

def test_get_balance_empty_creates_wallet_implicitly(fake_conn, tenant_a):
    b = W.get_balance(fake_conn, tenant_a)
    assert b == {"included_remaining": 0, "purchased_remaining": 0, "total": 0}
    assert tenant_a in fake_conn.wallets


# --- Credit (top-ups) -----------------------------------------------------

def test_credit_adds_to_purchased(fake_conn, tenant_a):
    total = W.credit(fake_conn, tenant_a, 100, "topup", "stripe_event", "evt_1")
    assert total == 100
    b = W.get_balance(fake_conn, tenant_a)
    assert b["included_remaining"] == 0
    assert b["purchased_remaining"] == 100


def test_credit_rejects_nonpositive(fake_conn, tenant_a):
    with pytest.raises(ValueError):
        W.credit(fake_conn, tenant_a, 0, "topup")
    with pytest.raises(ValueError):
        W.credit(fake_conn, tenant_a, -5, "topup")


def test_credit_writes_ledger_entry(fake_conn, tenant_a):
    W.credit(fake_conn, tenant_a, 50, "topup", "stripe_event", "evt_xyz")
    assert len(fake_conn.ledger) == 1
    e = fake_conn.ledger[0]
    assert e["delta"] == 50
    assert e["reason"] == "topup"
    assert e["ref_id"] == "evt_xyz"
    assert e["balance_after"] == 50


# --- Reset included (subscription renewal) --------------------------------

def test_reset_included_replaces_not_adds(fake_conn, tenant_a):
    W.reset_included(fake_conn, tenant_a, 200, ref_id="evt_a")
    W.reset_included(fake_conn, tenant_a, 200, ref_id="evt_b")
    b = W.get_balance(fake_conn, tenant_a)
    # Renewing twice with the same quota must NOT stack to 400 — it replaces.
    assert b["included_remaining"] == 200


def test_reset_included_does_not_touch_purchased(fake_conn, tenant_a):
    W.credit(fake_conn, tenant_a, 50, "topup")
    W.reset_included(fake_conn, tenant_a, 200)
    b = W.get_balance(fake_conn, tenant_a)
    assert b["included_remaining"] == 200
    assert b["purchased_remaining"] == 50
    assert b["total"] == 250


def test_reset_included_ledger_delta_is_diff_to_previous(fake_conn, tenant_a):
    W.reset_included(fake_conn, tenant_a, 100)            # delta = 100
    W.reset_included(fake_conn, tenant_a, 250)            # delta = +150 (was 100)
    deltas = [e["delta"] for e in fake_conn.ledger if e["reason"] == "subscription_renewal"]
    assert deltas == [100, 150]


# --- assert_enough --------------------------------------------------------

def test_assert_enough_passes_when_balance_covers(fake_conn, tenant_a):
    W.credit(fake_conn, tenant_a, 10, "topup")
    W.assert_enough(fake_conn, tenant_a, 10)  # no raise


def test_assert_enough_raises_402_when_short(fake_conn, tenant_a):
    W.credit(fake_conn, tenant_a, 5, "topup")
    with pytest.raises(W.InsufficientBalance) as exc:
        W.assert_enough(fake_conn, tenant_a, 10)
    assert exc.value.needed == 10
    assert exc.value.available == 5


def test_assert_enough_zero_is_noop(fake_conn, tenant_a):
    W.assert_enough(fake_conn, tenant_a, 0)  # no error even on empty wallet


# --- Charge (included first, then purchased) ------------------------------

def test_charge_consumes_included_before_purchased(fake_conn, tenant_a):
    W.reset_included(fake_conn, tenant_a, 100)
    W.credit(fake_conn, tenant_a, 50, "topup")
    # Charge 70 -> should fully drain included? No: take 70 from included.
    W.charge(fake_conn, tenant_a, 70, "evaluation", "evaluation", "eval_1")
    b = W.get_balance(fake_conn, tenant_a)
    assert b["included_remaining"] == 30
    assert b["purchased_remaining"] == 50


def test_charge_spans_included_and_purchased_when_needed(fake_conn, tenant_a):
    W.reset_included(fake_conn, tenant_a, 30)
    W.credit(fake_conn, tenant_a, 50, "topup")
    # Charge 60 -> take 30 from included, 30 from purchased.
    W.charge(fake_conn, tenant_a, 60, "evaluation", "evaluation", "eval_x")
    b = W.get_balance(fake_conn, tenant_a)
    assert b["included_remaining"] == 0
    assert b["purchased_remaining"] == 20


def test_charge_refuses_to_go_negative(fake_conn, tenant_a):
    W.reset_included(fake_conn, tenant_a, 5)
    with pytest.raises(W.InsufficientBalance):
        W.charge(fake_conn, tenant_a, 10, "evaluation", "evaluation", "eval_y")
    # Wallet must remain unchanged
    b = W.get_balance(fake_conn, tenant_a)
    assert b["included_remaining"] == 5
    assert b["purchased_remaining"] == 0


def test_charge_writes_negative_delta_ledger(fake_conn, tenant_a):
    W.credit(fake_conn, tenant_a, 100, "topup")
    W.charge(fake_conn, tenant_a, 25, "live", "live_session", "sess_42")
    last = fake_conn.ledger[-1]
    assert last["delta"] == -25
    assert last["reason"] == "live"
    assert last["ref_type"] == "live_session"
    assert last["ref_id"] == "sess_42"
    assert last["balance_after"] == 75


# --- Refund ---------------------------------------------------------------

def test_refund_returns_at_to_purchased(fake_conn, tenant_a):
    W.credit(fake_conn, tenant_a, 50, "topup")
    W.charge(fake_conn, tenant_a, 30, "evaluation", "evaluation", "eval_z")
    W.refund(fake_conn, tenant_a, 30, "evaluation", "eval_z")
    b = W.get_balance(fake_conn, tenant_a)
    # Net: credit 50, charge -30, refund +30 -> 50
    assert b["total"] == 50
    assert b["purchased_remaining"] == 50


def test_refund_logs_with_refund_reason(fake_conn, tenant_a):
    W.credit(fake_conn, tenant_a, 30, "topup")
    W.refund(fake_conn, tenant_a, 10, "evaluation", "eval_q")
    refunds = [e for e in fake_conn.ledger if e["reason"] == "refund"]
    assert len(refunds) == 1
    assert refunds[0]["delta"] == 10


# --- Multi-tenant isolation in the fake -----------------------------------

def test_tenant_balances_are_isolated(fake_conn, tenant_a, tenant_b):
    W.credit(fake_conn, tenant_a, 100, "topup")
    W.credit(fake_conn, tenant_b, 200, "topup")
    assert W.get_balance(fake_conn, tenant_a)["total"] == 100
    assert W.get_balance(fake_conn, tenant_b)["total"] == 200


# --- Ledger query ---------------------------------------------------------

def test_list_ledger_returns_recent_first(fake_conn, tenant_a):
    W.credit(fake_conn, tenant_a, 100, "topup", "stripe_event", "evt_a")
    W.charge(fake_conn, tenant_a, 10, "evaluation", "evaluation", "eval_b")
    entries = W.list_ledger(fake_conn, tenant_a, limit=10)
    assert len(entries) == 2
    # newest first
    assert entries[0]["reason"] == "evaluation"
    assert entries[1]["reason"] == "topup"


def test_list_ledger_respects_limit(fake_conn, tenant_a):
    for i in range(5):
        W.credit(fake_conn, tenant_a, 1, "topup", "stripe_event", f"evt_{i}")
    entries = W.list_ledger(fake_conn, tenant_a, limit=3)
    assert len(entries) == 3
