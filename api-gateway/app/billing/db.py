"""DB helpers shared by routes and webhook.

Why this module: `main.py:db_conn()` yields a raw psycopg2 connection without
applying RLS. Every billing query that touches tenant-scoped tables must run
inside a transaction with `SELECT set_tenant_id(...)` first. This module wraps
that for us so callers can't forget.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator


@contextmanager
def tenant_scope(conn, tenant_id: str) -> Iterator:
    """Apply the per-session tenant id so RLS policies see it. Commits on exit
    if no exception, rolls back otherwise. Closing the connection is the
    caller's responsibility (or the outer context manager that opened it)."""
    if not tenant_id:
        raise ValueError("tenant_id is required for tenant_scope")
    with conn.cursor() as cur:
        cur.execute("SELECT set_tenant_id(%s);", (tenant_id,))
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def resolve_tenant_for_customer(conn, stripe_customer_id: str) -> str | None:
    """Webhook helper: look up tenant_id from a Stripe customer id via the
    SECURITY DEFINER function created in migration 0003. Returns None if
    no mapping exists."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT billing_tenant_for_customer(%s);",
            (stripe_customer_id,),
        )
        row = cur.fetchone()
    if not row or row[0] is None:
        return None
    return str(row[0])
