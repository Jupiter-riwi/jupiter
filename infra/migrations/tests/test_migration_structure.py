"""
Tests for migration structure and reversibility.
These run without a live database — they verify the migration module is
correctly formed and that upgrade/downgrade are both defined.
"""

import importlib.util
import os
import sys
import types

import pytest

MIGRATION_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "versions",
    "20260507_0001_initial_schema.py",
)


def load_migration():
    spec = importlib.util.spec_from_file_location("migration_0001", MIGRATION_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# --- Metadata ---

def test_revision_id_is_set():
    m = load_migration()
    assert m.revision == "0001"


def test_down_revision_is_none_for_initial():
    m = load_migration()
    assert m.down_revision is None


# --- Functions ---

def test_upgrade_function_exists():
    m = load_migration()
    assert callable(m.upgrade)


def test_downgrade_function_exists():
    m = load_migration()
    assert callable(m.downgrade)


# --- Table coverage ---

EXPECTED_TABLES = ["tenants", "users", "questions", "evaluations", "features", "scores"]


def test_upgrade_references_all_tables():
    import inspect
    m = load_migration()
    source = inspect.getsource(m.upgrade)
    for table in EXPECTED_TABLES:
        assert f'"{table}"' in source, f"upgrade() missing table: {table}"


def test_downgrade_drops_all_tables():
    import inspect
    m = load_migration()
    source = inspect.getsource(m.downgrade)
    for table in EXPECTED_TABLES:
        assert table in source, f"downgrade() missing drop for table: {table}"


def test_downgrade_order_respects_fk(  ):
    """scores and features must be dropped before evaluations, which before users/tenants."""
    import inspect
    m = load_migration()
    source = inspect.getsource(m.downgrade)

    order = [source.index(t) for t in ["scores", "features", "evaluations", "questions", "users", "tenants"]]
    assert order == sorted(order), "downgrade() table drop order violates FK constraints"


# --- Column coverage ---

def test_features_table_has_required_columns():
    import inspect
    m = load_migration()
    source = inspect.getsource(m.upgrade)

    # Find the features block
    features_block = source[source.index('"features"'):]
    for col in ["evaluation_id", "tenant_id", "kind", "payload"]:
        assert col in features_block, f"features table missing column: {col}"


def test_features_kind_check_constraint():
    import inspect
    m = load_migration()
    source = inspect.getsource(m.upgrade)
    assert "pose" in source and "transcript" in source and "prosody" in source, \
        "features.kind CHECK constraint missing pose/transcript/prosody"


def test_scores_table_has_required_columns():
    import inspect
    m = load_migration()
    source = inspect.getsource(m.upgrade)

    scores_block = source[source.index('"scores"'):]
    for col in ["evaluation_id", "tenant_id", "value", "breakdown"]:
        assert col in scores_block, f"scores table missing column: {col}"


def test_all_tables_have_uuid_pk():
    import inspect
    m = load_migration()
    source = inspect.getsource(m.upgrade)
    assert source.count("gen_random_uuid()") == len(EXPECTED_TABLES), \
        "not all tables have UUID primary key with gen_random_uuid()"


def test_tenant_fk_present_in_all_tables():
    """Every table except tenants must reference tenant_id."""
    import inspect
    m = load_migration()
    source = inspect.getsource(m.upgrade)

    tables_needing_tenant = ["users", "questions", "evaluations", "features", "scores"]
    for table in tables_needing_tenant:
        block_start = source.index(f'"{table}"')
        next_table = min(
            (source.index(f'"{t}"') for t in EXPECTED_TABLES if f'"{t}"' in source[block_start + 1:]),
            default=len(source),
        )
        block = source[block_start:block_start + next_table]
        assert "tenant_id" in block, f"{table} is missing tenant_id FK"
