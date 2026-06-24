"""One-shot script to inject the billing + webhook paths into the embedded
OpenAPI spec at api-gateway/internal/apidocs/openapi.json. Idempotent: re-running
overwrites the billing definitions but leaves unrelated paths untouched.

Run from repo root:  py scripts/inject_billing_openapi.py
"""

from __future__ import annotations

import json
from pathlib import Path

SPEC = Path("api-gateway/internal/apidocs/openapi.json")


def main() -> None:
    spec = json.loads(SPEC.read_text(encoding="utf-8"))

    # --- Tags ---
    tags = spec.setdefault("tags", [])
    have = {t.get("name") for t in tags}
    if "Billing" not in have:
        tags.append({"name": "Billing", "description": "Stripe subscriptions, AT top-ups and wallet."})
    if "Webhooks" not in have:
        tags.append({"name": "Webhooks", "description": "External webhooks (no JWT)."})

    # --- Schemas ---
    schemas = spec.setdefault("components", {}).setdefault("schemas", {})

    schemas["CheckoutResponse"] = {
        "type": "object",
        "required": ["url"],
        "properties": {
            "url": {"type": "string", "format": "uri", "description": "Stripe-hosted URL to redirect to."},
        },
    }
    schemas["CheckoutSubscriptionRequest"] = {
        "type": "object",
        "required": ["plan"],
        "properties": {"plan": {"type": "string", "enum": ["starter", "growth", "pro", "scale"]}},
    }
    schemas["CheckoutTopupRequest"] = {
        "type": "object",
        "required": ["pack"],
        "properties": {"pack": {"type": "string", "enum": ["s", "m", "l"]}},
    }
    schemas["BillingBalance"] = {
        "type": "object",
        "required": ["included_remaining", "purchased_remaining", "total"],
        "properties": {
            "included_remaining": {"type": "integer", "minimum": 0},
            "purchased_remaining": {"type": "integer", "minimum": 0},
            "total": {"type": "integer", "minimum": 0},
        },
    }
    schemas["SubscriptionInfo"] = {
        "type": "object",
        "properties": {
            "plan": {"type": "string", "nullable": True},
            "status": {
                "type": "string",
                "enum": ["none", "active", "past_due", "canceled", "trialing", "incomplete", "unpaid"],
            },
            "current_period_start": {"type": "string", "format": "date-time", "nullable": True},
            "current_period_end": {"type": "string", "format": "date-time", "nullable": True},
            "cancel_at_period_end": {"type": "boolean"},
            "included_at_quota": {"type": "integer", "minimum": 0},
        },
    }
    schemas["LedgerEntry"] = {
        "type": "object",
        "required": ["delta", "reason", "balance_after", "created_at"],
        "properties": {
            "delta": {"type": "integer", "description": "Positive = credit, negative = debit."},
            "reason": {
                "type": "string",
                "enum": ["subscription_renewal", "topup", "evaluation", "live", "refund", "adjustment"],
            },
            "ref_type": {"type": "string", "nullable": True},
            "ref_id": {"type": "string", "nullable": True},
            "balance_after": {"type": "integer"},
            "created_at": {"type": "string", "format": "date-time"},
        },
    }
    schemas["InsufficientBalance"] = {
        "type": "object",
        "required": ["detail", "needed", "available"],
        "properties": {
            "detail": {"type": "string", "enum": ["insufficient_at_balance"]},
            "needed": {"type": "integer"},
            "available": {"type": "integer"},
        },
    }

    # --- Paths ---
    paths = spec.setdefault("paths", {})

    bearer = [{"BearerAuth": []}]
    err_unauth = {"description": "Unauthorized"}
    err_402 = {
        "description": "Insufficient AT balance",
        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/InsufficientBalance"}}},
    }

    checkout_response = {
        "description": "Checkout URL",
        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/CheckoutResponse"}}},
    }

    paths["/api/billing/checkout/subscription"] = {
        "post": {
            "summary": "Start a Stripe Checkout for a subscription",
            "description": "Creates a Stripe Checkout Session (mode=subscription). The client must redirect to the returned URL.",
            "tags": ["Billing"],
            "security": bearer,
            "requestBody": {
                "required": True,
                "content": {"application/json": {"schema": {"$ref": "#/components/schemas/CheckoutSubscriptionRequest"}}},
            },
            "responses": {"200": checkout_response, "401": err_unauth},
        }
    }
    paths["/api/billing/checkout/topup"] = {
        "post": {
            "summary": "Start a Stripe Checkout for an AT top-up",
            "description": "Creates a Stripe Checkout Session (mode=payment). Adds purchased AT on webhook confirmation.",
            "tags": ["Billing"],
            "security": bearer,
            "requestBody": {
                "required": True,
                "content": {"application/json": {"schema": {"$ref": "#/components/schemas/CheckoutTopupRequest"}}},
            },
            "responses": {"200": checkout_response, "401": err_unauth},
        }
    }
    paths["/api/billing/portal"] = {
        "post": {
            "summary": "Open the Stripe Billing Portal",
            "description": "Returns a Customer Portal URL where the user can manage payment method or cancel subscription.",
            "tags": ["Billing"],
            "security": bearer,
            "responses": {"200": checkout_response, "401": err_unauth},
        }
    }
    paths["/api/billing/subscription"] = {
        "get": {
            "summary": "Get the active subscription for the current tenant",
            "tags": ["Billing"],
            "security": bearer,
            "responses": {
                "200": {
                    "description": "Subscription info",
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/SubscriptionInfo"}}},
                },
                "401": err_unauth,
            },
        }
    }
    paths["/api/billing/balance"] = {
        "get": {
            "summary": "Get the AT wallet balance for the current tenant",
            "tags": ["Billing"],
            "security": bearer,
            "responses": {
                "200": {
                    "description": "Balance",
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/BillingBalance"}}},
                },
                "401": err_unauth,
            },
        }
    }
    paths["/api/billing/ledger"] = {
        "get": {
            "summary": "List recent wallet movements (credits and debits)",
            "tags": ["Billing"],
            "security": bearer,
            "parameters": [
                {
                    "name": "limit",
                    "in": "query",
                    "schema": {"type": "integer", "default": 50, "minimum": 1, "maximum": 200},
                }
            ],
            "responses": {
                "200": {
                    "description": "Ledger entries",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "array",
                                "items": {"$ref": "#/components/schemas/LedgerEntry"},
                            }
                        }
                    },
                },
                "401": err_unauth,
            },
        }
    }
    paths["/api/webhooks/stripe"] = {
        "post": {
            "summary": "Stripe webhook receiver",
            "description": (
                "External webhook; signed by Stripe, no JWT. Body must be the RAW Stripe event; "
                "the `Stripe-Signature` header is verified server-side."
            ),
            "tags": ["Webhooks"],
            "parameters": [
                {
                    "name": "Stripe-Signature",
                    "in": "header",
                    "required": True,
                    "schema": {"type": "string"},
                    "description": "Stripe webhook signature header.",
                }
            ],
            "requestBody": {
                "required": True,
                "description": "Raw Stripe event payload.",
                "content": {"application/json": {"schema": {"type": "object"}}},
            },
            "responses": {
                "200": {"description": "Event accepted (idempotent: duplicate=true if already processed)."},
                "400": {"description": "Invalid signature or payload."},
                "500": {"description": "Handler error (Stripe will retry)."},
            },
        }
    }

    SPEC.write_text(json.dumps(spec, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("done. billing paths:")
    for p in sorted(paths):
        if "/billing/" in p or "/webhooks/" in p:
            print(" ", p)


if __name__ == "__main__":
    main()
