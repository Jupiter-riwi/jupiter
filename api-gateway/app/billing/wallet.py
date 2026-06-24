"""Pure AT wallet bookkeeping.

All functions take an already-open psycopg2 connection and assume:
  - The connection has `SELECT set_tenant_id('<tenant>')` set (so RLS is honored).
  - The caller manages the transaction (commit/rollback).

Charging order: included_remaining is consumed first (it expires at next renewal),
then purchased_remaining. This protects the customer from "wasted" included AT.

Concurrency: every mutation locks the wallet row with SELECT ... FOR UPDATE so
two concurrent evaluations on the same tenant cannot oversell the balance.
"""

from __future__ import annotations

from typing import Any


class InsufficientBalance(Exception):
    """Raised by assert_enough / charge when balance < cost. The caller (route
    handler) maps this to HTTP 402 Payment Required."""

    def __init__(self, needed: int, available: int):
        self.needed = needed
        self.available = available
        super().__init__(f"need {needed} AT, have {available}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ensure_wallet(conn: Any, tenant_id: str) -> None:
    """Insert an empty wallet row if it doesn't exist. Idempotent."""
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO at_wallets (tenant_id, included_remaining, purchased_remaining) "
            "VALUES (%s, 0, 0) "
            "ON CONFLICT (tenant_id) DO NOTHING;",
            (tenant_id,),
        )


def _lock_wallet(conn: Any, tenant_id: str) -> tuple[int, int]:
    """SELECT FOR UPDATE the wallet row. Returns (included_remaining, purchased_remaining)."""
    _ensure_wallet(conn, tenant_id)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT included_remaining, purchased_remaining FROM at_wallets "
            "WHERE tenant_id = %s FOR UPDATE;",
            (tenant_id,),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("wallet row vanished after upsert")
    return int(row[0]), int(row[1])


def _record_ledger(
    conn: Any,
    tenant_id: str,
    delta: int,
    reason: str,
    ref_type: str | None,
    ref_id: str | None,
    balance_after: int,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO at_ledger (tenant_id, delta, reason, ref_type, ref_id, balance_after) "
            "VALUES (%s, %s, %s, %s, %s, %s);",
            (tenant_id, delta, reason, ref_type, ref_id, balance_after),
        )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_balance(conn: Any, tenant_id: str) -> dict[str, int]:
    _ensure_wallet(conn, tenant_id)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT included_remaining, purchased_remaining FROM at_wallets WHERE tenant_id = %s;",
            (tenant_id,),
        )
        row = cur.fetchone()
    inc, pur = (int(row[0]), int(row[1])) if row else (0, 0)
    return {"included_remaining": inc, "purchased_remaining": pur, "total": inc + pur}


def credit(
    conn: Any,
    tenant_id: str,
    amount: int,
    reason: str,
    ref_type: str | None = None,
    ref_id: str | None = None,
) -> int:
    """Add AT to purchased_remaining (top-up). Returns balance_after (total).

    `reason` must be one of the CHECK-constrained values in at_ledger (e.g. 'topup').
    """
    if amount <= 0:
        raise ValueError("credit amount must be positive")
    inc, pur = _lock_wallet(conn, tenant_id)
    new_pur = pur + amount
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE at_wallets SET purchased_remaining = %s WHERE tenant_id = %s;",
            (new_pur, tenant_id),
        )
    total = inc + new_pur
    _record_ledger(conn, tenant_id, amount, reason, ref_type, ref_id, total)
    return total


def reset_included(
    conn: Any,
    tenant_id: str,
    quota: int,
    ref_type: str | None = "stripe_event",
    ref_id: str | None = None,
) -> int:
    """Replace included_remaining with `quota` (subscription renewal). Does NOT
    touch purchased_remaining. Writes a `subscription_renewal` ledger entry
    with delta = (quota - previous_included)."""
    if quota < 0:
        raise ValueError("quota cannot be negative")
    inc, pur = _lock_wallet(conn, tenant_id)
    delta = quota - inc
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE at_wallets SET included_remaining = %s WHERE tenant_id = %s;",
            (quota, tenant_id),
        )
    total = quota + pur
    _record_ledger(conn, tenant_id, delta, "subscription_renewal", ref_type, ref_id, total)
    return total


def assert_enough(conn: Any, tenant_id: str, cost: int) -> None:
    """Raise InsufficientBalance if the wallet cannot cover `cost`."""
    if cost <= 0:
        return
    bal = get_balance(conn, tenant_id)
    if bal["total"] < cost:
        raise InsufficientBalance(needed=cost, available=bal["total"])


def charge(
    conn: Any,
    tenant_id: str,
    cost: int,
    reason: str,
    ref_type: str,
    ref_id: str,
) -> int:
    """Debit `cost` AT. Consumes included_remaining first, then purchased.
    Returns total balance_after. Raises InsufficientBalance if cost > total."""
    if cost <= 0:
        raise ValueError("charge cost must be positive")
    inc, pur = _lock_wallet(conn, tenant_id)
    if inc + pur < cost:
        raise InsufficientBalance(needed=cost, available=inc + pur)
    take_from_included = min(inc, cost)
    take_from_purchased = cost - take_from_included
    new_inc = inc - take_from_included
    new_pur = pur - take_from_purchased
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE at_wallets "
            "SET included_remaining = %s, purchased_remaining = %s "
            "WHERE tenant_id = %s;",
            (new_inc, new_pur, tenant_id),
        )
    total = new_inc + new_pur
    _record_ledger(conn, tenant_id, -cost, reason, ref_type, ref_id, total)
    return total


def refund(
    conn: Any,
    tenant_id: str,
    amount: int,
    ref_type: str,
    ref_id: str,
) -> int:
    """Return AT to purchased_remaining (e.g. failed evaluation by Apex)."""
    if amount <= 0:
        raise ValueError("refund amount must be positive")
    inc, pur = _lock_wallet(conn, tenant_id)
    new_pur = pur + amount
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE at_wallets SET purchased_remaining = %s WHERE tenant_id = %s;",
            (new_pur, tenant_id),
        )
    total = inc + new_pur
    _record_ledger(conn, tenant_id, amount, "refund", ref_type, ref_id, total)
    return total


def list_ledger(conn: Any, tenant_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """Return the most recent ledger entries for the tenant."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT delta, reason, ref_type, ref_id, balance_after, created_at "
            "FROM at_ledger WHERE tenant_id = %s "
            "ORDER BY created_at DESC LIMIT %s;",
            (tenant_id, int(limit)),
        )
        rows = cur.fetchall()
    return [
        {
            "delta": int(r[0]),
            "reason": r[1],
            "ref_type": r[2],
            "ref_id": r[3],
            "balance_after": int(r[4]),
            "created_at": r[5].isoformat() if r[5] else None,
        }
        for r in rows
    ]
