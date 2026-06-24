"""
Structural tests for the billing migration (0003). Run without a live database
— verify the migration module is correctly formed.
"""

import importlib.util
import inspect
import os

MIGRATION_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "versions",
    "20260610_0003_billing.py",
)

EXPECTED_TABLES = [
    "billing_customers",
    "subscriptions",
    "at_wallets",
    "at_ledger",
    "payment_events",
]

TENANT_SCOPED = ["billing_customers", "subscriptions", "at_wallets", "at_ledger"]


def load_migration():
    spec = importlib.util.spec_from_file_location("migration_0003", MIGRATION_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# --- Metadata ---

def test_revision_id_is_0003():
    m = load_migration()
    assert m.revision == "0003"


def test_down_revision_chained_from_0002():
    m = load_migration()
    assert m.down_revision == "0002"


def test_upgrade_and_downgrade_exist():
    m = load_migration()
    assert callable(m.upgrade)
    assert callable(m.downgrade)


# --- Table coverage ---

def test_upgrade_creates_all_billing_tables():
    m = load_migration()
    source = inspect.getsource(m.upgrade)
    for table in EXPECTED_TABLES:
        assert f'"{table}"' in source, f"upgrade() missing table: {table}"


def test_downgrade_drops_all_billing_tables():
    m = load_migration()
    source = inspect.getsource(m.downgrade)
    for table in EXPECTED_TABLES:
        assert table in source, f"downgrade() missing drop for table: {table}"


def test_downgrade_drops_tables_in_reverse_fk_order():
    """payment_events first, then leaf tables, then billing_customers last."""
    m = load_migration()
    source = inspect.getsource(m.downgrade)
    # billing_customers is referenced by FKs nowhere in this migration, but
    # at_wallets / subscriptions / at_ledger / billing_customers all reference
    # tenants only; the drop order just needs to be the inverse of create order.
    positions = {t: source.index(f"drop_table(\"{t}\")") for t in EXPECTED_TABLES}
    assert positions["payment_events"] < positions["at_ledger"]
    assert positions["at_ledger"] < positions["at_wallets"]
    assert positions["at_wallets"] < positions["subscriptions"]
    assert positions["subscriptions"] < positions["billing_customers"]


# --- RLS coverage ---

def test_rls_enabled_on_all_tenant_scoped_tables():
    """RLS is applied via a `for table in TENANT_SCOPED_TABLES` loop in the
    migration. We assert the loop's templates exist and that the constant
    contains every expected table — same pattern check as 0002."""
    m = load_migration()
    source = inspect.getsource(m.upgrade)
    assert "TENANT_SCOPED_TABLES" in source
    assert "ENABLE ROW LEVEL SECURITY" in source
    assert "FORCE ROW LEVEL SECURITY" in source
    for table in TENANT_SCOPED:
        assert table in m.TENANT_SCOPED_TABLES, f"missing from constant: {table}"


def test_rls_policies_for_each_op():
    m = load_migration()
    source = inspect.getsource(m.upgrade)
    for op_name in ("select", "insert", "update", "delete"):
        assert f"_tenant_isolation_{op_name}" in source, op_name
    # Sanity: the policy is templated against {table}, not hardcoded — same as 0002.
    assert "tenant_id = current_tenant_id()" in source


def test_payment_events_is_not_tenant_scoped():
    """payment_events is a global idempotency log — no RLS, no tenant_id column."""
    m = load_migration()
    source = inspect.getsource(m.upgrade)
    # No RLS toggle for payment_events
    assert "ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY" not in source
    # No tenant_id column on payment_events block
    pe_idx = source.index('"payment_events"')
    pe_block = source[pe_idx:pe_idx + 600]
    assert "tenant_id" not in pe_block


# --- SECURITY DEFINER helper for webhook ---

def test_billing_tenant_for_customer_function_is_security_definer():
    m = load_migration()
    src = inspect.getsource(m.upgrade)
    assert "billing_tenant_for_customer" in src
    assert "SECURITY DEFINER" in src


def test_downgrade_drops_security_definer_function():
    m = load_migration()
    src = inspect.getsource(m.downgrade)
    assert "DROP FUNCTION IF EXISTS billing_tenant_for_customer" in src


# --- Wallet integrity constraints ---

def test_wallet_balances_have_nonneg_check():
    m = load_migration()
    src = inspect.getsource(m.upgrade)
    assert "ck_wallet_included_nonneg" in src
    assert "ck_wallet_purchased_nonneg" in src


def test_ledger_reasons_constrained():
    m = load_migration()
    src = inspect.getsource(m.upgrade)
    assert "ck_ledger_reason" in src
    for reason in ("subscription_renewal", "topup", "evaluation", "live", "refund"):
        assert reason in src


def test_subscription_plans_constrained():
    m = load_migration()
    src = inspect.getsource(m.upgrade)
    assert "ck_subscriptions_plan" in src
    for plan in ("starter", "growth", "pro", "scale"):
        assert plan in src


# --- Idempotency table ---

def test_payment_events_has_stripe_event_id_pk():
    m = load_migration()
    src = inspect.getsource(m.upgrade)
    # The primary_key=True is on stripe_event_id column inside the payment_events block
    pe_idx = src.index('"payment_events"')
    pe_block = src[pe_idx:pe_idx + 600]
    assert "stripe_event_id" in pe_block
    assert "primary_key=True" in pe_block
