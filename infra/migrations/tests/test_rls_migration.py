"""
Tests for the RLS migration structure.
Run without a live database — verify correctness of SQL generation.
"""

import importlib.util
import inspect
import os

MIGRATION_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "versions",
    "20260507_0002_rls_by_tenant.py",
)

TENANT_SCOPED_TABLES = ["users", "questions", "evaluations", "features", "scores"]


def load_migration():
    spec = importlib.util.spec_from_file_location("migration_0002", MIGRATION_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# --- Metadata ---

def test_revision_chained_from_0001():
    m = load_migration()
    assert m.revision == "0002"
    assert m.down_revision == "0001"


def test_upgrade_and_downgrade_exist():
    m = load_migration()
    assert callable(m.upgrade)
    assert callable(m.downgrade)


# --- Helper functions ---

def test_upgrade_creates_set_tenant_id_function():
    m = load_migration()
    source = inspect.getsource(m.upgrade)
    assert "set_tenant_id" in source


def test_upgrade_creates_current_tenant_id_function():
    m = load_migration()
    source = inspect.getsource(m.upgrade)
    assert "current_tenant_id" in source


def test_current_tenant_id_reads_session_config():
    m = load_migration()
    source = inspect.getsource(m.upgrade)
    assert "app.current_tenant_id" in source


# --- RLS per table ---

def test_rls_enabled_for_all_tenant_tables():
    m = load_migration()
    source = inspect.getsource(m.upgrade)
    for table in TENANT_SCOPED_TABLES:
        assert f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY" in source, \
            f"RLS not enabled for table: {table}"


def test_force_rls_for_all_tenant_tables():
    m = load_migration()
    source = inspect.getsource(m.upgrade)
    for table in TENANT_SCOPED_TABLES:
        assert f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY" in source, \
            f"FORCE RLS not set for table: {table}"


def test_select_policy_for_all_tables():
    m = load_migration()
    source = inspect.getsource(m.upgrade)
    for table in TENANT_SCOPED_TABLES:
        assert f"{table}_tenant_isolation_select" in source, \
            f"SELECT policy missing for: {table}"


def test_insert_policy_for_all_tables():
    m = load_migration()
    source = inspect.getsource(m.upgrade)
    for table in TENANT_SCOPED_TABLES:
        assert f"{table}_tenant_isolation_insert" in source, \
            f"INSERT policy missing for: {table}"


def test_update_policy_for_all_tables():
    m = load_migration()
    source = inspect.getsource(m.upgrade)
    for table in TENANT_SCOPED_TABLES:
        assert f"{table}_tenant_isolation_update" in source, \
            f"UPDATE policy missing for: {table}"


def test_delete_policy_for_all_tables():
    m = load_migration()
    source = inspect.getsource(m.upgrade)
    for table in TENANT_SCOPED_TABLES:
        assert f"{table}_tenant_isolation_delete" in source, \
            f"DELETE policy missing for: {table}"


def test_policies_use_current_tenant_id_function():
    m = load_migration()
    source = inspect.getsource(m.upgrade)
    # All USING/WITH CHECK clauses must reference current_tenant_id()
    assert source.count("current_tenant_id()") >= len(TENANT_SCOPED_TABLES) * 2, \
        "Not all policies reference current_tenant_id()"


# --- Downgrade ---

def test_downgrade_drops_all_policies():
    m = load_migration()
    source = inspect.getsource(m.downgrade)
    for table in TENANT_SCOPED_TABLES:
        for op in ["select", "insert", "update", "delete"]:
            assert f"{table}_tenant_isolation_{op}" in source, \
                f"downgrade missing DROP POLICY {table}_{op}"


def test_downgrade_disables_rls_on_all_tables():
    m = load_migration()
    source = inspect.getsource(m.downgrade)
    for table in TENANT_SCOPED_TABLES:
        assert f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY" in source, \
            f"downgrade missing DISABLE RLS for: {table}"


def test_downgrade_drops_helper_functions():
    m = load_migration()
    source = inspect.getsource(m.downgrade)
    assert "DROP FUNCTION IF EXISTS current_tenant_id" in source
    assert "DROP FUNCTION IF EXISTS set_tenant_id" in source


def test_tenant_scoped_tables_constant_matches_migration():
    m = load_migration()
    assert set(m.TENANT_SCOPED_TABLES) == set(TENANT_SCOPED_TABLES), \
        "TENANT_SCOPED_TABLES in migration differs from test expectation"
