"""
Structural tests for the billing/webhook routes in the embedded OpenAPI spec.
These run alongside test_openapi_spec.py — same SPEC_PATH, no live API needed.
"""

import json
import os

import pytest

SPEC_PATH = os.path.join(
    os.path.dirname(__file__),
    "..", "..", "api-gateway", "internal", "apidocs", "openapi.json",
)

BILLING_PATHS = [
    "/api/billing/checkout/subscription",
    "/api/billing/checkout/topup",
    "/api/billing/portal",
    "/api/billing/subscription",
    "/api/billing/balance",
    "/api/billing/ledger",
]

WEBHOOK_PATH = "/api/webhooks/stripe"

REQUIRED_SCHEMAS = [
    "CheckoutResponse",
    "CheckoutSubscriptionRequest",
    "CheckoutTopupRequest",
    "BillingBalance",
    "SubscriptionInfo",
    "LedgerEntry",
    "InsufficientBalance",
]


@pytest.fixture(scope="module")
def spec():
    with open(SPEC_PATH, encoding="utf-8") as f:
        return json.load(f)


# --- Paths ---

def test_all_billing_paths_present(spec):
    for p in BILLING_PATHS:
        assert p in spec["paths"], f"missing billing path: {p}"


def test_webhook_path_present(spec):
    assert WEBHOOK_PATH in spec["paths"]


def test_billing_endpoints_require_bearer_auth(spec):
    for p in BILLING_PATHS:
        ops = spec["paths"][p]
        method = next(iter(ops))  # get/post
        assert ops[method].get("security") == [{"BearerAuth": []}], p


def test_webhook_does_not_require_bearer_auth(spec):
    """External webhook: no JWT. Auth is via Stripe-Signature header."""
    op = spec["paths"][WEBHOOK_PATH]["post"]
    assert "security" not in op


def test_webhook_declares_signature_header(spec):
    op = spec["paths"][WEBHOOK_PATH]["post"]
    params = {p["name"]: p for p in op.get("parameters", [])}
    assert "Stripe-Signature" in params
    assert params["Stripe-Signature"].get("required") is True


# --- Schemas ---

def test_billing_schemas_defined(spec):
    schemas = spec["components"]["schemas"]
    for name in REQUIRED_SCHEMAS:
        assert name in schemas, f"missing schema: {name}"


def test_checkout_subscription_request_enum_matches_plans(spec):
    enum = spec["components"]["schemas"]["CheckoutSubscriptionRequest"]["properties"]["plan"]["enum"]
    assert set(enum) == {"starter", "growth", "pro", "scale"}


def test_topup_request_enum_matches_packs(spec):
    enum = spec["components"]["schemas"]["CheckoutTopupRequest"]["properties"]["pack"]["enum"]
    assert set(enum) == {"s", "m", "l"}


def test_balance_schema_has_three_fields(spec):
    props = spec["components"]["schemas"]["BillingBalance"]["properties"]
    assert set(props.keys()) == {"included_remaining", "purchased_remaining", "total"}


def test_ledger_entry_has_reason_enum(spec):
    enum = spec["components"]["schemas"]["LedgerEntry"]["properties"]["reason"]["enum"]
    for required in ("subscription_renewal", "topup", "evaluation", "live", "refund"):
        assert required in enum, required


def test_insufficient_balance_shape(spec):
    s = spec["components"]["schemas"]["InsufficientBalance"]
    assert s["required"] == ["detail", "needed", "available"]
    assert "insufficient_at_balance" in s["properties"]["detail"]["enum"]


# --- Tags ---

def test_billing_and_webhook_tags_declared(spec):
    names = {t["name"] for t in spec.get("tags", [])}
    assert "Billing" in names
    assert "Webhooks" in names
