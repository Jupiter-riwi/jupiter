"""row level security by tenant_id

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-07 00:02:00.000000 UTC

Strategy
--------
- A session variable `app.current_tenant_id` is set by the API Gateway before
  any query (e.g. SET LOCAL app.current_tenant_id = '<uuid>').
- Each tenant-scoped table gets RLS enabled + a policy that allows rows only
  where tenant_id matches the session variable.
- FORCE ROW LEVEL SECURITY ensures the table owner is also subject to policies.
- A helper function `set_tenant_id(uuid)` is provided for convenience.
"""

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

# Tables that are scoped per tenant
TENANT_SCOPED_TABLES = ["users", "questions", "evaluations", "features", "scores"]


def upgrade() -> None:
    conn = op.get_bind()

    # Helper function: called by the app before running queries
    conn.execute(sa.text("""
        CREATE OR REPLACE FUNCTION set_tenant_id(tenant_id uuid)
        RETURNS void
        LANGUAGE sql
        AS $$
            SELECT set_config('app.current_tenant_id', tenant_id::text, true);
        $$;
    """))

    # Helper function: returns the current tenant UUID from session config
    conn.execute(sa.text("""
        CREATE OR REPLACE FUNCTION current_tenant_id()
        RETURNS uuid
        LANGUAGE sql
        STABLE
        AS $$
            SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
        $$;
    """))

    for table in TENANT_SCOPED_TABLES:
        # Enable RLS
        conn.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;"))

        # Force RLS even for the table owner (superusers bypass by default)
        conn.execute(sa.text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;"))

        # SELECT policy
        conn.execute(sa.text(f"""
            CREATE POLICY {table}_tenant_isolation_select
            ON {table}
            FOR SELECT
            USING (tenant_id = current_tenant_id());
        """))

        # INSERT policy
        conn.execute(sa.text(f"""
            CREATE POLICY {table}_tenant_isolation_insert
            ON {table}
            FOR INSERT
            WITH CHECK (tenant_id = current_tenant_id());
        """))

        # UPDATE policy
        conn.execute(sa.text(f"""
            CREATE POLICY {table}_tenant_isolation_update
            ON {table}
            FOR UPDATE
            USING (tenant_id = current_tenant_id())
            WITH CHECK (tenant_id = current_tenant_id());
        """))

        # DELETE policy
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

    conn.execute(sa.text("DROP FUNCTION IF EXISTS current_tenant_id();"))
    conn.execute(sa.text("DROP FUNCTION IF EXISTS set_tenant_id(uuid);"))
