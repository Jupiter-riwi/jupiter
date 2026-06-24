"""Tests for app.billing.evaluation — AT cost math and wallet hooks."""

from __future__ import annotations

import pytest

from app.billing import evaluation as E
from app.billing import wallet as W


# ---------------------------------------------------------------------------
# Cost math
# ---------------------------------------------------------------------------

def test_cost_for_evaluation_rounds_up_to_minute():
    assert E.at_cost_for_evaluation(0) == 1
    assert E.at_cost_for_evaluation(1) == 1
    assert E.at_cost_for_evaluation(60) == 1
    assert E.at_cost_for_evaluation(61) == 2
    assert E.at_cost_for_evaluation(479) == 8       # 7 min 59 s -> 8 AT (would be ~8 min)
    assert E.at_cost_for_evaluation(480) == 8       # exactly 8 min


def test_cost_for_evaluation_detailed_adds_one():
    assert E.at_cost_for_evaluation(180, detailed_coaching=True) == 4  # 3 min + 1 extra


def test_cost_for_live_is_three_at_per_minute():
    assert E.at_cost_for_live(0) == 3
    assert E.at_cost_for_live(60) == 3
    assert E.at_cost_for_live(61) == 6
    assert E.at_cost_for_live(600) == 30  # 10 min -> 30 AT


# ---------------------------------------------------------------------------
# Pre-checks
# ---------------------------------------------------------------------------

def test_precheck_evaluation_refuses_with_402_when_empty(fake_conn, tenant_a):
    with pytest.raises(W.InsufficientBalance):
        E.precheck_evaluation_balance(fake_conn, tenant_a)


def test_precheck_evaluation_passes_with_any_at(fake_conn, tenant_a):
    W.credit(fake_conn, tenant_a, 1, "topup")
    E.precheck_evaluation_balance(fake_conn, tenant_a)  # no raise


def test_precheck_live_needs_three_at(fake_conn, tenant_a):
    W.credit(fake_conn, tenant_a, 2, "topup")
    with pytest.raises(W.InsufficientBalance):
        E.precheck_live_balance(fake_conn, tenant_a)
    W.credit(fake_conn, tenant_a, 1, "topup")
    E.precheck_live_balance(fake_conn, tenant_a)  # 3 AT total -> ok


# ---------------------------------------------------------------------------
# Charge + refund roundtrip
# ---------------------------------------------------------------------------

def test_charge_evaluation_debits_and_ledger(fake_conn, tenant_a):
    W.credit(fake_conn, tenant_a, 100, "topup")
    bal = E.charge_evaluation(fake_conn, tenant_a, "eval_42", duration_seconds=180)
    assert bal == 97  # 100 - 3 (3 min)
    last = fake_conn.ledger[-1]
    assert last["reason"] == "evaluation"
    assert last["ref_type"] == "evaluation"
    assert last["ref_id"] == "eval_42"
    assert last["delta"] == -3


def test_charge_evaluation_then_refund_restores_balance(fake_conn, tenant_a):
    W.credit(fake_conn, tenant_a, 100, "topup")
    bal_after_charge = E.charge_evaluation(fake_conn, tenant_a, "eval_x", duration_seconds=300)
    assert bal_after_charge == 95
    bal_after_refund = E.refund_evaluation(fake_conn, tenant_a, "eval_x", amount=5)
    assert bal_after_refund == 100


def test_charge_live_uses_3x_minutes(fake_conn, tenant_a):
    W.credit(fake_conn, tenant_a, 100, "topup")
    bal = E.charge_live(fake_conn, tenant_a, "sess_7", duration_seconds=120)  # 2 min -> 6 AT
    assert bal == 94
    last = fake_conn.ledger[-1]
    assert last["reason"] == "live"
    assert last["delta"] == -6
    assert last["ref_id"] == "sess_7"
