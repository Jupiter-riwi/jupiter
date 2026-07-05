"""evaluations: context_id + difficulty columns

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-04 00:02:00.000000 UTC

Strategy
--------
- context_id: optional link to session_contexts so the async scoring worker can
  grade against the same compiled brief the live agent used.
- difficulty: first-class column replacing the "nivel:<x>" tag smuggled inside
  the evaluation title (the worker keeps the title regex as fallback for old
  rows).
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "evaluations",
        sa.Column(
            "context_id",
            UUID(as_uuid=True),
            sa.ForeignKey("session_contexts.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "evaluations",
        sa.Column("difficulty", sa.String(10), nullable=True),
    )
    op.create_check_constraint(
        "ck_evaluations_difficulty",
        "evaluations",
        "difficulty IS NULL OR difficulty IN ('accesible','neutral','exigente')",
    )
    op.create_index("ix_evaluations_context_id", "evaluations", ["context_id"])


def downgrade() -> None:
    op.drop_index("ix_evaluations_context_id", table_name="evaluations")
    op.drop_constraint("ck_evaluations_difficulty", "evaluations", type_="check")
    op.drop_column("evaluations", "difficulty")
    op.drop_column("evaluations", "context_id")
