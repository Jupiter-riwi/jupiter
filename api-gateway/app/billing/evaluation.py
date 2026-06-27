"""Hooks that connect the AT wallet to evaluations and live sessions.

These are called from main.py (`complete_evaluation`) and from whoever wires
the `score.ready` consumer (charge_evaluation) and the failure path
(refund_evaluation). Live sessions call `at_cost_for_live` and `charge_live`.
"""

from __future__ import annotations

import math
import os
from typing import Any

from . import wallet


def billing_enforced() -> bool:
    """Whether wallet enforcement is active.

    Billing only makes sense when Stripe is configured: without a secret key
    there is no way to top up a wallet, so enforcing a balance would lock the
    app out of its own features. In that case (local/dev) prechecks and charges
    become no-ops. In production, where STRIPE_SECRET_KEY is set, full
    enforcement applies. An explicit BILLING_ENFORCED=0/1 overrides the default.
    """
    override = os.getenv("BILLING_ENFORCED", "").strip().lower()
    if override in ("0", "false", "no", "off"):
        return False
    if override in ("1", "true", "yes", "on"):
        return True
    return bool(os.getenv("STRIPE_SECRET_KEY", "").strip())


# Minimum AT a tenant must have available before we even accept the job.
# Picked as 1 AT (1 minute) so we never start a job for a tenant with empty
# wallet. The real charge happens when the score arrives.
MIN_AT_TO_START_EVALUATION = 1


def at_cost_for_evaluation(duration_seconds: float, *, detailed_coaching: bool = False) -> int:
    """1 AT per minute (ceil) + optional +1 for detailed coaching. Min 1 AT."""
    minutes = max(1, math.ceil(max(0.0, duration_seconds) / 60.0))
    extra = 1 if detailed_coaching else 0
    return minutes + extra


def at_cost_for_live(duration_seconds: float) -> int:
    """1 minute of live = 3 AT. Always at least 3."""
    minutes = max(1, math.ceil(max(0.0, duration_seconds) / 60.0))
    return minutes * 3


# ---------------------------------------------------------------------------
# Wallet hooks
# ---------------------------------------------------------------------------

def precheck_evaluation_balance(conn: Any, tenant_id: str) -> None:
    """Called from POST /evaluations/:id/complete. Refuses with InsufficientBalance
    (mapped to HTTP 402) when the tenant has no AT at all."""
    if not billing_enforced():
        return
    wallet.assert_enough(conn, tenant_id, MIN_AT_TO_START_EVALUATION)


def charge_evaluation(
    conn: Any,
    tenant_id: str,
    evaluation_id: str,
    duration_seconds: float,
    *,
    detailed_coaching: bool = False,
) -> int:
    """Called when the score arrives. Debits the real cost. Returns balance_after."""
    if not billing_enforced():
        return 0
    cost = at_cost_for_evaluation(duration_seconds, detailed_coaching=detailed_coaching)
    return wallet.charge(
        conn, tenant_id, cost,
        reason="evaluation", ref_type="evaluation", ref_id=evaluation_id,
    )


def refund_evaluation(
    conn: Any,
    tenant_id: str,
    evaluation_id: str,
    amount: int,
) -> int:
    """Called when an evaluation is marked failed by Apex (auto-refund policy)."""
    return wallet.refund(
        conn, tenant_id, amount,
        ref_type="evaluation", ref_id=evaluation_id,
    )


# ---------------------------------------------------------------------------
# Live hooks
# ---------------------------------------------------------------------------

# Minimum AT a tenant must have to start a live session: 1 minute = 3 AT.
MIN_AT_TO_START_LIVE = 3


def precheck_live_balance(conn: Any, tenant_id: str) -> None:
    if not billing_enforced():
        return
    wallet.assert_enough(conn, tenant_id, MIN_AT_TO_START_LIVE)


def charge_live(
    conn: Any,
    tenant_id: str,
    session_id: str,
    duration_seconds: float,
) -> int:
    if not billing_enforced():
        return 0
    cost = at_cost_for_live(duration_seconds)
    return wallet.charge(
        conn, tenant_id, cost,
        reason="live", ref_type="live_session", ref_id=session_id,
    )
