"""
Tests for migration chain reversibility.
Verifies that upgrade/downgrade are symmetric and the revision chain is valid.
Uses a mock op context — no live database required.
"""

import importlib.util
import inspect
import os
from unittest.mock import MagicMock, call, patch

import pytest

VERSIONS_DIR = os.path.join(os.path.dirname(__file__), "..", "versions")


def load_migration(filename):
    path = os.path.join(VERSIONS_DIR, filename)
    spec = importlib.util.spec_from_file_location(filename, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


M0001 = "20260507_0001_initial_schema.py"
M0002 = "20260507_0002_rls_by_tenant.py"

# --- Revision chain integrity ---

def test_migration_chain_is_linked():
    """0001 has no parent; 0002 points to 0001."""
    m1 = load_migration(M0001)
    m2 = load_migration(M0002)

    assert m1.down_revision is None, "0001 must be the base migration"
    assert m2.down_revision == m1.revision, \
        f"0002.down_revision should be {m1.revision!r}, got {m2.down_revision!r}"


def test_all_migrations_have_unique_revision_ids():
    m1 = load_migration(M0001)
    m2 = load_migration(M0002)
    assert m1.revision != m2.revision, "Revision IDs must be unique"


def test_all_migrations_have_upgrade_and_downgrade():
    for fname in [M0001, M0002]:
        m = load_migration(fname)
        assert callable(m.upgrade), f"{fname}: missing upgrade()"
        assert callable(m.downgrade), f"{fname}: missing downgrade()"


# --- 0001 reversibility: create_table → drop_table ---

def test_0001_upgrade_creates_tables_in_correct_order():
    """Tables with FK deps must be created after their parents."""
    m = load_migration(M0001)
    source = inspect.getsource(m.upgrade)

    tenants_pos = source.index('"tenants"')
    users_pos = source.index('"users"')
    questions_pos = source.index('"questions"')
    evaluations_pos = source.index('"evaluations"')
    features_pos = source.index('"features"')
    scores_pos = source.index('"scores"')

    assert tenants_pos < users_pos, "tenants must be created before users"
    assert tenants_pos < questions_pos, "tenants must be created before questions"
    assert users_pos < evaluations_pos, "users must be created before evaluations"
    assert evaluations_pos < features_pos, "evaluations must be created before features"
    assert evaluations_pos < scores_pos, "evaluations must be created before scores"


def test_0001_downgrade_drops_tables_in_reverse_fk_order():
    m = load_migration(M0001)
    source = inspect.getsource(m.downgrade)

    scores_pos = source.index("scores")
    features_pos = source.index("features")
    evaluations_pos = source.index("evaluations")
    users_pos = source.index("users")
    tenants_pos = source.index("tenants")

    assert scores_pos < features_pos < evaluations_pos < users_pos < tenants_pos, \
        "downgrade must drop tables in reverse FK dependency order"


def test_0001_upgrade_downgrade_table_symmetry():
    """Every table created in upgrade must be dropped in downgrade."""
    m = load_migration(M0001)
    upgrade_src = inspect.getsource(m.upgrade)
    downgrade_src = inspect.getsource(m.downgrade)

    tables = ["tenants", "users", "questions", "evaluations", "features", "scores"]
    for table in tables:
        assert f'"{table}"' in upgrade_src or table in upgrade_src, \
            f"upgrade missing: {table}"
        assert table in downgrade_src, f"downgrade missing drop: {table}"


# --- 0001 mock execution ---

def test_0001_upgrade_calls_create_table_six_times():
    m = load_migration(M0001)
    mock_op = MagicMock()
    with patch.dict("sys.modules", {"alembic.op": mock_op}):
        with patch(f"{m.__name__}.op", mock_op):
            m.upgrade()
    create_calls = [c for c in mock_op.create_table.call_args_list]
    assert len(create_calls) == 6, f"expected 6 create_table calls, got {len(create_calls)}"


def test_0001_downgrade_calls_drop_table_six_times():
    m = load_migration(M0001)
    mock_op = MagicMock()
    with patch(f"{m.__name__}.op", mock_op):
        m.downgrade()
    drop_calls = mock_op.drop_table.call_args_list
    assert len(drop_calls) == 6, f"expected 6 drop_table calls, got {len(drop_calls)}"


def test_0001_downgrade_drops_correct_table_names():
    m = load_migration(M0001)
    mock_op = MagicMock()
    with patch(f"{m.__name__}.op", mock_op):
        m.downgrade()
    dropped = [c.args[0] for c in mock_op.drop_table.call_args_list]
    assert set(dropped) == {"tenants", "users", "questions", "evaluations", "features", "scores"}


# --- 0002 reversibility: RLS enable → disable ---

def test_0002_downgrade_disables_rls_for_all_tables():
    m = load_migration(M0002)
    source = inspect.getsource(m.downgrade)
    for table in m.TENANT_SCOPED_TABLES:
        assert f"DISABLE ROW LEVEL SECURITY" in source
        assert table in source


def test_0002_upgrade_downgrade_policy_symmetry():
    """Every policy created in upgrade must be dropped in downgrade."""
    m = load_migration(M0002)
    upgrade_src = inspect.getsource(m.upgrade)
    downgrade_src = inspect.getsource(m.downgrade)

    for table in m.TENANT_SCOPED_TABLES:
        for direction in ["select", "insert", "update", "delete"]:
            policy = f"{table}_tenant_isolation_{direction}"
            assert policy in upgrade_src, f"upgrade missing policy: {policy}"
            assert policy in downgrade_src, f"downgrade missing DROP POLICY: {policy}"


def test_0002_downgrade_drops_functions_last():
    """Helper functions must be dropped after policies."""
    m = load_migration(M0002)
    source = inspect.getsource(m.downgrade)

    last_table_disable = max(
        source.index(f"ALTER TABLE {t} DISABLE") for t in m.TENANT_SCOPED_TABLES
    )
    drop_fn_pos = source.index("DROP FUNCTION IF EXISTS current_tenant_id")
    assert drop_fn_pos > last_table_disable, \
        "Helper functions must be dropped after disabling RLS on all tables"


# --- Full chain simulation ---

def test_full_upgrade_downgrade_chain_order():
    """
    Simulates: base → 0001 → 0002 → downgrade to 0001 → downgrade to base.
    Verifies revision IDs form a valid linked list.
    """
    m1 = load_migration(M0001)
    m2 = load_migration(M0002)

    # Upgrade chain
    chain = []
    current = m1
    while current:
        chain.append(current.revision)
        if current == m1:
            current = m2
        else:
            break

    assert chain == ["0001", "0002"], f"unexpected upgrade chain: {chain}"

    # Downgrade chain
    down_chain = []
    current = m2
    while current:
        down_chain.append(current.revision)
        if current.down_revision is None:
            break
        current = m1 if current.down_revision == m1.revision else None

    assert down_chain == ["0002", "0001"], f"unexpected downgrade chain: {down_chain}"
