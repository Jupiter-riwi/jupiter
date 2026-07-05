"""session contexts (job/product briefs for the live agent)

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-04 00:01:00.000000 UTC

Strategy
--------
- One table for both products: kind='puesto' (interview vacancy / CV) and
  kind='producto' (sales pitch product/deal context).
- raw_text is what the admin/user pasted; brief is the LLM-compiled structured
  JSON (competencies, seed questions, red flags, success criteria, vocabulary)
  produced once at creation time so live sessions pay no extra latency.
- Same per-tenant RLS pattern as 0002/0003.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    op.create_table(
        "session_contexts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("raw_text", sa.Text, nullable=False),
        sa.Column("brief", JSONB, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.CheckConstraint("kind IN ('puesto','producto')", name="ck_session_contexts_kind"),
    )
    op.create_index("ix_session_contexts_tenant_id", "session_contexts", ["tenant_id"])
    op.create_index(
        "ix_session_contexts_tenant_kind_active",
        "session_contexts",
        ["tenant_id", "kind", "is_active"],
    )

    # --- RLS: same pattern as 0002/0003 ---
    table = "session_contexts"
    conn.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;"))
    conn.execute(sa.text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;"))
    conn.execute(sa.text(f"""
        CREATE POLICY {table}_tenant_isolation_select
        ON {table} FOR SELECT
        USING (tenant_id = current_tenant_id());
    """))
    conn.execute(sa.text(f"""
        CREATE POLICY {table}_tenant_isolation_insert
        ON {table} FOR INSERT
        WITH CHECK (tenant_id = current_tenant_id());
    """))
    conn.execute(sa.text(f"""
        CREATE POLICY {table}_tenant_isolation_update
        ON {table} FOR UPDATE
        USING (tenant_id = current_tenant_id())
        WITH CHECK (tenant_id = current_tenant_id());
    """))
    conn.execute(sa.text(f"""
        CREATE POLICY {table}_tenant_isolation_delete
        ON {table} FOR DELETE
        USING (tenant_id = current_tenant_id());
    """))


def downgrade() -> None:
    op.drop_index("ix_session_contexts_tenant_kind_active", table_name="session_contexts")
    op.drop_index("ix_session_contexts_tenant_id", table_name="session_contexts")
    op.drop_table("session_contexts")
