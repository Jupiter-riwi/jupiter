"""Shared fixtures for billing tests.

Provides a small in-memory fake of the psycopg2 connection/cursor surface that
`app/billing/wallet.py` uses. Enough to verify the SQL flow and the math
without spinning up Postgres.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
import uuid

import pytest

# Ensure `api-gateway/` is importable as the root so `from app.billing...` works.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


class FakeCursor:
    def __init__(self, conn: "FakeConn"):
        self.conn = conn
        self._result: list[tuple] = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    # --- minimal SQL router ---------------------------------------------------
    def execute(self, sql: str, params: tuple | None = None) -> None:
        sql_n = " ".join(sql.split()).lower()
        p = params or ()
        if "set_tenant_id" in sql_n:
            self.conn.current_tenant = str(p[0]) if p else None
            self._result = [(None,)]
        elif "billing_tenant_for_customer" in sql_n:
            cust = str(p[0]) if p else ""
            mapped = self.conn.customer_to_tenant.get(cust)
            self._result = [(mapped,)] if mapped else [(None,)]
        elif "insert into at_wallets" in sql_n and "on conflict" in sql_n:
            tenant = str(p[0])
            self.conn.wallets.setdefault(
                tenant, {"included_remaining": 0, "purchased_remaining": 0}
            )
            self._result = []
        elif "select included_remaining, purchased_remaining from at_wallets" in sql_n and "for update" in sql_n:
            tenant = str(p[0])
            w = self.conn.wallets.get(tenant, {"included_remaining": 0, "purchased_remaining": 0})
            self._result = [(w["included_remaining"], w["purchased_remaining"])]
        elif "select included_remaining, purchased_remaining from at_wallets" in sql_n:
            tenant = str(p[0])
            w = self.conn.wallets.get(tenant, {"included_remaining": 0, "purchased_remaining": 0})
            self._result = [(w["included_remaining"], w["purchased_remaining"])]
        elif "update at_wallets set purchased_remaining =" in sql_n:
            new_pur, tenant = int(p[0]), str(p[1])
            if new_pur < 0:
                raise ValueError("ck_wallet_purchased_nonneg violated")
            w = self.conn.wallets.setdefault(
                tenant, {"included_remaining": 0, "purchased_remaining": 0}
            )
            w["purchased_remaining"] = new_pur
            self._result = []
        elif "update at_wallets set included_remaining =" in sql_n and "purchased_remaining =" in sql_n:
            new_inc, new_pur, tenant = int(p[0]), int(p[1]), str(p[2])
            if new_inc < 0 or new_pur < 0:
                raise ValueError("nonneg constraint violated")
            w = self.conn.wallets.setdefault(
                tenant, {"included_remaining": 0, "purchased_remaining": 0}
            )
            w["included_remaining"] = new_inc
            w["purchased_remaining"] = new_pur
            self._result = []
        elif "update at_wallets set included_remaining =" in sql_n:
            new_inc, tenant = int(p[0]), str(p[1])
            if new_inc < 0:
                raise ValueError("ck_wallet_included_nonneg violated")
            w = self.conn.wallets.setdefault(
                tenant, {"included_remaining": 0, "purchased_remaining": 0}
            )
            w["included_remaining"] = new_inc
            self._result = []
        elif "insert into at_ledger" in sql_n:
            tenant, delta, reason, ref_type, ref_id, balance_after = p
            self.conn.ledger.append({
                "id": str(uuid.uuid4()),
                "tenant_id": str(tenant),
                "delta": int(delta),
                "reason": reason,
                "ref_type": ref_type,
                "ref_id": ref_id,
                "balance_after": int(balance_after),
                "created_at": datetime.now(timezone.utc),
            })
            self._result = []
        elif "select delta, reason, ref_type, ref_id, balance_after, created_at from at_ledger" in sql_n:
            tenant, limit = str(p[0]), int(p[1])
            rows = [e for e in self.conn.ledger if e["tenant_id"] == tenant]
            rows.sort(key=lambda r: r["created_at"], reverse=True)
            self._result = [
                (r["delta"], r["reason"], r["ref_type"], r["ref_id"], r["balance_after"], r["created_at"])
                for r in rows[:limit]
            ]
        elif "insert into payment_events" in sql_n:
            event_id, type_, payload_json = p
            if event_id in self.conn.payment_events:
                from psycopg2.errors import UniqueViolation  # type: ignore
                raise UniqueViolation(f"duplicate event {event_id}")
            self.conn.payment_events[event_id] = {"type": type_, "payload": payload_json}
            self._result = []
        elif "select 1 from payment_events" in sql_n:
            event_id = str(p[0])
            self._result = [(1,)] if event_id in self.conn.payment_events else []
        else:
            # Unknown SQL — surface clearly so tests catch missing routes.
            raise NotImplementedError(f"FakeCursor: no route for SQL: {sql_n[:120]}")

    def fetchone(self):
        return self._result[0] if self._result else None

    def fetchall(self):
        return list(self._result)


class FakeConn:
    def __init__(self):
        self.wallets: dict[str, dict[str, int]] = {}
        self.ledger: list[dict] = []
        self.payment_events: dict[str, dict] = {}
        self.customer_to_tenant: dict[str, str] = {}
        self.current_tenant: str | None = None
        self.committed = False
        self.rolled_back = False

    def cursor(self) -> FakeCursor:
        return FakeCursor(self)

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        pass


@pytest.fixture
def fake_conn() -> FakeConn:
    return FakeConn()


@pytest.fixture
def tenant_a() -> str:
    return "11111111-1111-1111-1111-111111111111"


@pytest.fixture
def tenant_b() -> str:
    return "22222222-2222-2222-2222-222222222222"
