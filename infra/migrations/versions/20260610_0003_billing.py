"""billing tables (Stripe gateway)

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-10 00:01:00.000000 UTC

Strategy
--------
- Adds the five billing tables: billing_customers, subscriptions, at_wallets,
  at_ledger, payment_events.
- Reuses the RLS pattern from 0002 (per-tenant policies + FORCE ROW LEVEL
  SECURITY) for the four tenant-scoped tables. payment_events is global
  (idempotency log; lookup by stripe_event_id PK).
- Provides a SECURITY DEFINER helper `billing_tenant_for_customer(text)` so
  the Stripe webhook (which has no JWT context) can resolve tenant_id from a
  Stripe customer id without disabling RLS.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

# Tables that get per-tenant RLS (same pattern as 0002).
TENANT_SCOPED_TABLES = ["billing_customers", "subscriptions", "at_wallets", "at_ledger"]


def upgrade() -> None:
    conn = op.get_bind()

    # --- billing_customers (1 row per tenant) ---
    op.create_table(
        "billing_customers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("stripe_customer_id", sa.String(64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_billing_customers_tenant_id", "billing_customers", ["tenant_id"])

    # --- subscriptions ---
    op.create_table(
        "subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stripe_subscription_id", sa.String(64), nullable=False, unique=True),
        sa.Column("stripe_price_id", sa.String(64), nullable=False),
        sa.Column("plan", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("included_at_quota", sa.Integer, nullable=False, server_default="0"),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_at_period_end", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "plan IN ('starter','growth','pro','scale')",
            name="ck_subscriptions_plan",
        ),
        sa.CheckConstraint(
            "status IN ('active','past_due','canceled','trialing','incomplete','unpaid')",
            name="ck_subscriptions_status",
        ),
    )
    op.create_index("ix_subscriptions_tenant_id", "subscriptions", ["tenant_id"])
    op.create_index("ix_subscriptions_status", "subscriptions", ["status"])

    # --- at_wallets (current balance per tenant) ---
    op.create_table(
        "at_wallets",
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("included_remaining", sa.Integer, nullable=False, server_default="0"),
        sa.Column("purchased_remaining", sa.Integer, nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.CheckConstraint("included_remaining >= 0", name="ck_wallet_included_nonneg"),
        sa.CheckConstraint("purchased_remaining >= 0", name="ck_wallet_purchased_nonneg"),
    )

    # --- at_ledger (every credit/debit recorded for audit and disputes) ---
    op.create_table(
        "at_ledger",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("delta", sa.Integer, nullable=False),
        sa.Column("reason", sa.String(40), nullable=False),
        sa.Column("ref_type", sa.String(20), nullable=True),
        sa.Column("ref_id", sa.String(64), nullable=True),
        sa.Column("balance_after", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "reason IN ('subscription_renewal','topup','evaluation','live','refund','adjustment')",
            name="ck_ledger_reason",
        ),
    )
    op.create_index("ix_at_ledger_tenant_id", "at_ledger", ["tenant_id"])
    op.create_index("ix_at_ledger_created_at", "at_ledger", ["created_at"])

    # --- payment_events (webhook idempotency log — NOT tenant-scoped) ---
    op.create_table(
        "payment_events",
        sa.Column("stripe_event_id", sa.String(64), primary_key=True),
        sa.Column("type", sa.String(60), nullable=False),
        sa.Column("payload", JSONB, nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_payment_events_type", "payment_events", ["type"])

    # --- SECURITY DEFINER helper for webhook tenant resolution ---
    conn.execute(sa.text("""
        CREATE OR REPLACE FUNCTION billing_tenant_for_customer(cust text)
        RETURNS uuid
        LANGUAGE sql
        SECURITY DEFINER
        STABLE
        AS $$
            SELECT tenant_id FROM billing_customers WHERE stripe_customer_id = cust;
        $$;
    """))

    # --- RLS: same pattern as 0002 ---
    for table in TENANT_SCOPED_TABLES:
        conn.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;"))
        conn.execute(sa.text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;"))

        conn.execute(sa.text(f"""
            CREATE POLICY {table}_tenant_isolation_select
            ON {table}
            FOR SELECT
            USING (tenant_id = current_tenant_id());
        """))
        conn.execute(sa.text(f"""
            CREATE POLICY {table}_tenant_isolation_insert
            ON {table}
            FOR INSERT
            WITH CHECK (tenant_id = current_tenant_id());
        """))
        conn.execute(sa.text(f"""
            CREATE POLICY {table}_tenant_isolation_update
            ON {table}
            FOR UPDATE
            USING (tenant_id = current_tenant_id())
            WITH CHECK (tenant_id = current_tenant_id());
        """))
        conn.execute(sa.text(f"""
            CREATE POLICY {table}_tenant_isolation_delete
            ON {table}
            FOR DELETE
            USING (tenant_id = current_tenant_id());
        """))


def downgrade() -> None:
    conn = op.get_bind()

    for table in reversed(TENANT_SCOPED_TABLES):
        conn.execute(sa.text(f"DROP POLICY IF EXISTS {table}_tenant_isolation_select ON {table};"))
        conn.execute(sa.text(f"DROP POLICY IF EXISTS {table}_tenant_isolation_insert ON {table};"))
        conn.execute(sa.text(f"DROP POLICY IF EXISTS {table}_tenant_isolation_update ON {table};"))
        conn.execute(sa.text(f"DROP POLICY IF EXISTS {table}_tenant_isolation_delete ON {table};"))
        conn.execute(sa.text(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;"))
        conn.execute(sa.text(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;"))

    conn.execute(sa.text("DROP FUNCTION IF EXISTS billing_tenant_for_customer(text);"))

    op.drop_table("payment_events")
    op.drop_table("at_ledger")
    op.drop_table("at_wallets")
    op.drop_table("subscriptions")
    op.drop_table("billing_customers")
