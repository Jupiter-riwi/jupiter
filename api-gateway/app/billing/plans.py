"""Static maps plan/pack -> AT quota and helpers to read Stripe Price IDs from env.

These maps are the *source of truth* for crediting AT. The Stripe dashboard can
have whatever metadata, but the gateway only credits based on this constant.
This keeps the credit lookup safe from dashboard edits and from forged metadata.
"""

from __future__ import annotations

import os

# Subscription plans -> AT included per billing cycle.
PLAN_AT_QUOTA: dict[str, int] = {
    "starter": 200,
    "growth": 650,
    "pro": 1800,
    "scale": 5000,
}

# One-time top-up packs -> AT credited to purchased_remaining.
TOPUP_AT: dict[str, int] = {
    "s": 120,
    "m": 350,
    "l": 800,
}


def price_id_for_plan(plan: str) -> str:
    """Read the Stripe price id for a subscription plan from env. Raises KeyError
    if the plan is unknown and ValueError if the env var is missing."""
    env_var = {
        "starter": "STRIPE_PRICE_STARTER",
        "growth": "STRIPE_PRICE_GROWTH",
        "pro": "STRIPE_PRICE_PRO",
        "scale": "STRIPE_PRICE_SCALE",
    }[plan]
    value = os.getenv(env_var, "").strip()
    if not value:
        raise ValueError(f"{env_var} is not configured")
    return value


def price_id_for_topup(pack: str) -> str:
    env_var = {
        "s": "STRIPE_PRICE_TOPUP_S",
        "m": "STRIPE_PRICE_TOPUP_M",
        "l": "STRIPE_PRICE_TOPUP_L",
    }[pack]
    value = os.getenv(env_var, "").strip()
    if not value:
        raise ValueError(f"{env_var} is not configured")
    return value


def plan_for_price_id(price_id: str) -> str | None:
    """Reverse lookup used by the webhook to decide which plan was just paid."""
    for plan in PLAN_AT_QUOTA:
        try:
            if price_id_for_plan(plan) == price_id:
                return plan
        except ValueError:
            continue
    return None


def topup_for_price_id(price_id: str) -> str | None:
    for pack in TOPUP_AT:
        try:
            if price_id_for_topup(pack) == price_id:
                return pack
        except ValueError:
            continue
    return None
