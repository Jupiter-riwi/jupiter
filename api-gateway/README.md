# API Gateway — Apex Vision

FastAPI gateway que expone Auth + Evaluations + Live agent + **Billing (Stripe)**.

```
api-gateway/
├── app/
│   ├── main.py                # FastAPI app, auth (JWT), DB, evaluations
│   ├── live/                  # WebSocket conversational agent
│   └── billing/               # Stripe gateway (see "Billing setup" below)
├── internal/apidocs/openapi.json   # embedded OpenAPI spec served at /docs
├── tests/                     # wallet + webhook + evaluation hooks
└── seed.py                    # tenants/questions seed
```

## Quick start

```bash
pip install -r requirements.txt
cp .env.example .env            # fill in DB + JWT + Stripe (see below)
uvicorn app.main:app --reload --port 8080
```

The gateway is also packaged as a Docker image (see `Dockerfile` + root `docker-compose.yml`).

## Billing setup (Stripe)

Apex Vision uses a **SaaS-hybrid** pricing model (see `FINANCIAL_PLAN.md`):
monthly subscription + Apex Tokens (AT) for usage, with overage via prepaid
top-ups. The full implementation plan is in `docs/plans/PASARELA_PAGOS_PLAN.md`.

### 1. Database migration

```bash
cd infra/migrations
alembic upgrade head     # applies 0003_billing.py (5 tables + RLS)
```

### 2. Stripe Dashboard (test mode first)

1. **Products** → create 4 subscription plans and 3 one-time top-ups:

   | Product | Pricing | env var |
   |---|---|---|
   | Starter | $29/mo recurring | `STRIPE_PRICE_STARTER` |
   | Growth  | $79/mo recurring | `STRIPE_PRICE_GROWTH` |
   | Pro     | $199/mo recurring | `STRIPE_PRICE_PRO` |
   | Scale   | $499/mo recurring | `STRIPE_PRICE_SCALE` |
   | Top-up S | $20 one-time | `STRIPE_PRICE_TOPUP_S` |
   | Top-up M | $50 one-time | `STRIPE_PRICE_TOPUP_M` |
   | Top-up L | $100 one-time | `STRIPE_PRICE_TOPUP_L` |

2. **Developers → Webhooks** → add endpoint
   `https://<gateway-host>/api/webhooks/stripe`, subscribe to events:
   `checkout.session.completed`, `customer.subscription.created/updated/deleted`,
   `invoice.paid`, `invoice.payment_failed`. Copy the **Signing secret**
   (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.

3. Paste keys + Price IDs into `.env` (see `.env.example`).

### 3. Local webhook testing with Stripe CLI

```bash
stripe login
stripe listen --forward-to http://localhost:8080/api/webhooks/stripe
# copy the printed whsec_ into STRIPE_WEBHOOK_SECRET
stripe trigger checkout.session.completed
stripe trigger invoice.paid
```

Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

### 4. Endpoints

All under **/api/billing** (JWT required), plus the Stripe webhook.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/billing/checkout/subscription` | Start Stripe Checkout for a plan |
| POST | `/api/billing/checkout/topup` | Start Stripe Checkout for an AT top-up |
| POST | `/api/billing/portal` | Open Stripe Billing Portal |
| GET  | `/api/billing/subscription` | Current subscription info |
| GET  | `/api/billing/balance` | AT wallet balance (`{included_remaining, purchased_remaining, total}`) |
| GET  | `/api/billing/ledger?limit=50` | Recent wallet movements |
| POST | `/api/webhooks/stripe` | Stripe webhook receiver (signature-verified, idempotent) |

Full spec at `internal/apidocs/openapi.json` (served at **GET /docs**).

### 5. AT cost model

- **Evaluation:** `ceil(duration_min) + complexity_extra` AT
  (debited when the score arrives; auto-refunded on Apex-side failure).
- **Live agent:** `ceil(duration_min) * 3` AT (debited when the WS closes).

The wallet uses `SELECT ... FOR UPDATE` to prevent overselling under
concurrent evaluations.

### 6. Insufficient balance → HTTP 402

Routes that consume AT (`POST /api/evaluations/{id}/complete`, the
live WebSocket handshake) return:

```json
{"detail": "insufficient_at_balance", "needed": 3, "available": 1}
```

The frontend reads `needed` and `available` to surface "Top up to continue".

## Tests

```bash
# from the repo root
py -m pytest api-gateway/tests/ -q
py -m pytest infra/migrations/tests/test_migration_0003_billing.py -q
py -m pytest infra/tests/test_openapi_billing_routes.py -q
```

## References

- Implementation plan: [docs/plans/PASARELA_PAGOS_PLAN.md](../docs/plans/PASARELA_PAGOS_PLAN.md)
- Pricing model: [FINANCIAL_PLAN.md](../FINANCIAL_PLAN.md)
- Stripe agent skill (recommended for engineers extending this): `npx skills add https://github.com/stripe/ai --skill stripe-best-practices`
