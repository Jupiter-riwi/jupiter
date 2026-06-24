"""Billing package — Stripe gateway, wallet, webhook and routes.

The package is split so that small agents can work on one piece at a time:
  - wallet.py      : pure AT bookkeeping (no Stripe, no HTTP)
  - service.py     : Stripe-side actions (Customer, Checkout, Portal)
  - webhooks.py    : Stripe webhook receiver with signature + idempotency
  - routes.py      : FastAPI router mounted under /api/billing/*
  - plans.py       : static mapping plan/pack -> AT
"""
