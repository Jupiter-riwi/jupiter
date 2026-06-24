# Plan de Implementación — Pasarela de Pagos (Stripe)

> **Propósito:** este documento es una guía paso a paso para que **cualquier agente (incluso de menor capacidad) pueda implementar la pasarela de pagos de Apex Vision sin tomar decisiones de arquitectura.** Todas las decisiones ya están cerradas. El agente ejecutor solo debe seguir las tareas en orden, copiar los contratos y cumplir los criterios de aceptación.

---

## 0. Antes de empezar (setup del agente ejecutor)

### 0.1 Instala la skill oficial de Stripe (muy recomendado)

El agente que implemente esto debe instalar la skill **oficial de Stripe** para seguir las mejores prácticas de API:

```bash
npx skills add https://github.com/stripe/ai --skill stripe-best-practices
```

- **Fuente:** `stripe/ai` — repositorio **oficial de Stripe**, ~1,600★ en GitHub, mantenido activamente.
- **Qué cubre:** qué API usar (Checkout Sessions vs PaymentIntents vs Setup Intents), Billing, suscripciones, webhooks, Connect.
- Skill complementaria opcional para webhooks robustos: `npx skills add https://github.com/hookdeck/webhook-skills` (verificación de firma y manejo de eventos; 73★).

> Si `npx skills add` está bloqueado por permisos, pídele al humano que lo apruebe o que lo corra él. La skill es solo guía de referencia; **no es obligatoria** para seguir este plan, pero mejora la calidad.

### 0.2 Contexto del proyecto (lee esto una vez)

- **Gateway:** FastAPI en `api-gateway/app/main.py`. Auth con JWT (`_decode_token`, `_build_token`). Conexión DB vía `db_conn()` (psycopg2) en la línea ~211.
- **DB:** PostgreSQL multi-tenant. Todas las tablas tenant-scoped tienen columna `tenant_id` y **RLS activado**: el gateway hace `SELECT set_tenant_id('<uuid>')` antes de cada query (ver `infra/migrations/versions/20260507_0002_rls_by_tenant.py`).
- **Migraciones:** Alembic en `infra/migrations/versions/`. Última revisión = `0002`. La nueva migración será `0003`.
- **Modelo de negocio** (ver `FINANCIAL_PLAN.md`): SaaS híbrido = suscripción mensual + **Apex Tokens (AT)** de consumo + overage. 1 AT = 1 min de evaluación; 1 min de live = 3 AT.

---

## 1. Decisiones cerradas (NO cambiar)

| Decisión | Valor | Razón |
|---|---|---|
| **Proveedor** | **Stripe** | Mejor soporte para suscripciones + overage + webhooks; skill oficial; PCI delegado. |
| **PCI / tarjetas** | **Nunca tocamos datos de tarjeta** | Solo guardamos IDs de Stripe. Stripe Checkout aloja el formulario de pago. |
| **Suscripción base** | Stripe **Billing Subscriptions** (1 Price por plan) | Genera el MRR recurrente. |
| **Cuota incluida de AT** | Se **recarga cada ciclo** al renovar (evento `invoice.paid`) | Refleja "AT/mes incluidos" del plan. |
| **Overage** | **Recargas prepago de AT** vía Checkout one-time | Más simple que metered billing; el agente junior no maneja usage records. |
| **Wallet de AT** | Tabla `at_wallets` + `at_ledger` (libro mayor) | Saldo + auditoría por disputa (FINANCIAL_PLAN §15). |
| **Idempotencia webhooks** | Tabla `payment_events` (stripe_event_id UNIQUE) | Stripe reintenta; nunca procesar dos veces. |
| **Cobro de AT** | Débito en `complete` de evaluación y al cerrar sesión live | Pre-chequeo de saldo: 402 si insuficiente. |
| **Auto-refund** | Evaluación fallida por error de Apex devuelve AT | Política FINANCIAL_PLAN §14. |

**Planes y Prices (crear en Stripe Dashboard, modo test primero):**

| Plan | Precio mensual | AT/mes incluidos | Price ID (env var) |
|---|---|---|---|
| Starter | $29 | 200 | `STRIPE_PRICE_STARTER` |
| Growth | $79 | 650 | `STRIPE_PRICE_GROWTH` |
| Pro | $199 | 1,800 | `STRIPE_PRICE_PRO` |
| Scale | $499 | 5,000 | `STRIPE_PRICE_SCALE` |

**Packs de recarga (overage, one-time Prices):**

| Pack | Precio | AT | Price ID (env var) |
|---|---|---|---|
| Top-up S | $20 | 120 | `STRIPE_PRICE_TOPUP_S` |
| Top-up M | $50 | 350 | `STRIPE_PRICE_TOPUP_M` |
| Top-up L | $100 | 800 | `STRIPE_PRICE_TOPUP_L` |

> La cantidad de AT por plan/pack se define en código (mapa `PLAN_AT_QUOTA` y `TOPUP_AT`), **no** se confía en metadata editable del dashboard para la lógica de crédito (se valida contra el Price ID).

---

## 2. Arquitectura y flujo

```
┌─────────────┐   1. POST /api/billing/checkout/*   ┌──────────────────┐
│  Frontend   │ ──────────────────────────────────► │  API Gateway      │
│  (React)    │ ◄── url de Stripe Checkout ──────── │  (FastAPI)        │
└─────────────┘                                      └──────────────────┘
       │ 2. redirect a Stripe Checkout                        │
       ▼                                                      │
┌─────────────┐   3. paga (tarjeta)                           │
│   Stripe    │                                               │
│  Checkout   │   4. webhook event ──────────────────────────►│ POST /api/webhooks/stripe
└─────────────┘                                               │   - verifica firma
       │ 5. redirect success_url                              │   - idempotencia
       ▼                                                      │   - provisiona/credita AT
┌─────────────┐                                               ▼
│  Frontend   │ ◄── GET /api/billing/balance ──────  Postgres (at_wallets, at_ledger,
│  dashboard  │                                       subscriptions, billing_customers)
└─────────────┘
```

**Flujo de suscripción:**
1. Usuario elige plan → frontend llama `POST /api/billing/checkout/subscription {plan}`.
2. Gateway crea Stripe Customer (si no existe) + Checkout Session (mode=`subscription`) → devuelve `url`.
3. Usuario paga en Stripe.
4. Stripe envía `checkout.session.completed` + `customer.subscription.created` + `invoice.paid`.
5. Webhook crea/actualiza `subscriptions` y **resetea la cuota de AT incluida** en `at_wallets`.

**Flujo de recarga (overage):**
1. `POST /api/billing/checkout/topup {pack}` → Checkout mode=`payment` → `url`.
2. Stripe envía `checkout.session.completed` con metadata `kind=topup, pack=...`.
3. Webhook **acredita AT comprados** en `at_wallets` y escribe `at_ledger`.

**Flujo de consumo:**
- Antes de iniciar una evaluación/live: `assert_enough_at(tenant_id, costo)` → si no alcanza, HTTP **402**.
- Al completar: `charge_at(tenant_id, costo, reason, ref)` debita (primero cuota incluida, luego comprados) y escribe ledger.

---

## 3. Modelo de datos — Migración Alembic `0003`

Crear `infra/migrations/versions/20260610_0003_billing.py`. **Sigue exactamente el patrón de `0001` (tablas) y `0002` (RLS).**

### 3.1 Tablas (todas tenant-scoped salvo `payment_events`)

```python
"""billing tables

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

TENANT_SCOPED = ["billing_customers", "subscriptions", "at_wallets", "at_ledger"]

def upgrade() -> None:
    # --- billing_customers (1 por tenant) ---
    op.create_table(
        "billing_customers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("stripe_customer_id", sa.String(64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_billing_customers_tenant_id", "billing_customers", ["tenant_id"])

    # --- subscriptions ---
    op.create_table(
        "subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stripe_subscription_id", sa.String(64), nullable=False, unique=True),
        sa.Column("plan", sa.String(20), nullable=False),          # starter|growth|pro|scale
        sa.Column("status", sa.String(20), nullable=False),         # active|past_due|canceled|trialing
        sa.Column("included_at_quota", sa.Integer, nullable=False, server_default="0"),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_at_period_end", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_subscriptions_tenant_id", "subscriptions", ["tenant_id"])

    # --- at_wallets (saldo actual) ---
    op.create_table(
        "at_wallets",
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("included_remaining", sa.Integer, nullable=False, server_default="0"),   # cuota del ciclo
        sa.Column("purchased_remaining", sa.Integer, nullable=False, server_default="0"),  # recargas prepago
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.CheckConstraint("included_remaining >= 0", name="ck_wallet_included_nonneg"),
        sa.CheckConstraint("purchased_remaining >= 0", name="ck_wallet_purchased_nonneg"),
    )

    # --- at_ledger (auditoría: cada crédito/débito) ---
    op.create_table(
        "at_ledger",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("delta", sa.Integer, nullable=False),            # + crédito, - débito
        sa.Column("reason", sa.String(40), nullable=False),         # subscription_renewal|topup|evaluation|live|refund
        sa.Column("ref_type", sa.String(20), nullable=True),        # evaluation|live_session|stripe_event
        sa.Column("ref_id", sa.String(64), nullable=True),
        sa.Column("balance_after", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_at_ledger_tenant_id", "at_ledger", ["tenant_id"])
    op.create_index("ix_at_ledger_created_at", "at_ledger", ["created_at"])

    # --- payment_events (idempotencia webhooks; NO tenant-scoped) ---
    op.create_table(
        "payment_events",
        sa.Column("stripe_event_id", sa.String(64), primary_key=True),
        sa.Column("type", sa.String(60), nullable=False),
        sa.Column("payload", JSONB, nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # --- RLS: mismo patrón que 0002 ---
    for table in TENANT_SCOPED:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")
        op.execute(f"CREATE POLICY {table}_tenant_isolation_select ON {table} FOR SELECT USING (tenant_id = current_tenant_id());")
        op.execute(f"CREATE POLICY {table}_tenant_isolation_insert ON {table} FOR INSERT WITH CHECK (tenant_id = current_tenant_id());")
        op.execute(f"CREATE POLICY {table}_tenant_isolation_update ON {table} FOR UPDATE USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());")
        op.execute(f"CREATE POLICY {table}_tenant_isolation_delete ON {table} FOR DELETE USING (tenant_id = current_tenant_id());")

def downgrade() -> None:
    for table in reversed(TENANT_SCOPED):
        for op_name in ("select", "insert", "update", "delete"):
            op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation_{op_name} ON {table};")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;")
    op.drop_table("payment_events")
    op.drop_table("at_ledger")
    op.drop_table("at_wallets")
    op.drop_table("subscriptions")
    op.drop_table("billing_customers")
```

> ⚠️ **El webhook NO tiene JWT ni tenant en sesión.** Para escribir en tablas tenant-scoped desde el webhook, el handler debe primero resolver `tenant_id` (vía `billing_customers.stripe_customer_id`) y luego `SELECT set_tenant_id('<uuid>')` en la misma conexión antes de insertar. Ese lookup inicial (`billing_customers` por `stripe_customer_id`) necesita una conexión **sin RLS** o una función `SECURITY DEFINER`. **Decisión cerrada:** crea en la migración una función `billing_tenant_for_customer(text) RETURNS uuid SECURITY DEFINER` que busca el tenant sin pasar por RLS:

```python
    op.execute("""
        CREATE OR REPLACE FUNCTION billing_tenant_for_customer(cust text)
        RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
            SELECT tenant_id FROM billing_customers WHERE stripe_customer_id = cust;
        $$;
    """)
```
(y su `DROP FUNCTION IF EXISTS billing_tenant_for_customer(text);` en `downgrade`).

---

## 4. Variables de entorno y setup de Stripe

Agregar a `api-gateway/.env.example` y al `docker-compose.yml` del gateway:

```env
STRIPE_SECRET_KEY=sk_test_...          # backend (modo test al inicio)
STRIPE_WEBHOOK_SECRET=whsec_...         # del endpoint de webhook
STRIPE_PUBLISHABLE_KEY=pk_test_...      # lo consume el frontend
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_GROWTH=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_SCALE=price_...
STRIPE_PRICE_TOPUP_S=price_...
STRIPE_PRICE_TOPUP_M=price_...
STRIPE_PRICE_TOPUP_L=price_...
BILLING_SUCCESS_URL=https://app.apexvision.com/billing/success
BILLING_CANCEL_URL=https://app.apexvision.com/billing/cancel
```

**Setup manual en Stripe Dashboard (modo test):**
1. Crear 4 Products (planes) con su Price recurrente mensual → copiar Price IDs.
2. Crear 3 Products (top-ups) con Price one-time → copiar Price IDs.
3. Developers → Webhooks → Add endpoint `https://<gateway>/api/webhooks/stripe`, seleccionar eventos:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed` → copiar `whsec_...`.

**Dependencia Python:** agregar `stripe>=9` a `api-gateway/requirements.txt`.

---

## 5. Endpoints del Gateway (contratos exactos)

Crear `api-gateway/app/billing/` con `__init__.py`, `routes.py`, `service.py`, `webhooks.py`, `wallet.py`. Montar el router en `main.py` (`app.include_router(billing.router)`).

Todos los endpoints (salvo el webhook) requieren JWT (reusar el patrón de `_decode_token` + `set_tenant_id`).

| Método | Ruta | Body | Respuesta | Descripción |
|---|---|---|---|---|
| POST | `/api/billing/checkout/subscription` | `{ "plan": "starter\|growth\|pro\|scale" }` | `{ "url": "https://checkout.stripe.com/..." }` | Crea Checkout de suscripción. |
| POST | `/api/billing/checkout/topup` | `{ "pack": "s\|m\|l" }` | `{ "url": "..." }` | Crea Checkout de recarga AT. |
| POST | `/api/billing/portal` | — | `{ "url": "..." }` | Stripe Billing Portal (gestionar/cancelar). |
| GET | `/api/billing/subscription` | — | `{ plan, status, current_period_end, cancel_at_period_end }` | Estado de la suscripción. |
| GET | `/api/billing/balance` | — | `{ included_remaining, purchased_remaining, total }` | Saldo de AT. |
| GET | `/api/billing/ledger?limit=50` | — | `[{ delta, reason, ref_type, balance_after, created_at }]` | Historial de consumo/créditos. |
| POST | `/api/webhooks/stripe` | raw Stripe payload | `200 {received:true}` | Receptor de webhooks (ver §6). |

**Reglas de los endpoints de checkout:**
- Resolver/crear `billing_customers` para el tenant (idempotente; un Customer por tenant).
- Pasar `client_reference_id = tenant_id` y `metadata = {tenant_id, kind, plan/pack}` en la Checkout Session.
- Usar **Idempotency-Key** de Stripe al crear la sesión (`stripe.checkout.Session.create(..., idempotency_key=...)`).
- `success_url`/`cancel_url` desde env.

---

## 6. Webhook `/api/webhooks/stripe` (lógica detallada)

```python
# api-gateway/app/billing/webhooks.py  (esqueleto guía)
import stripe, os, json
from fastapi import APIRouter, Request, HTTPException

router = APIRouter()
WEBHOOK_SECRET = os.environ["STRIPE_WEBHOOK_SECRET"]

@router.post("/api/webhooks/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()                      # RAW bytes, NO json parseado
    sig = request.headers.get("stripe-signature", "")
    # 1) Verificar firma — si falla, 400
    try:
        event = stripe.Webhook.construct_event(payload, sig, WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid signature")

    # 2) Idempotencia: INSERT en payment_events; si ya existe, return 200 sin reprocesar
    if already_processed(event["id"]):
        return {"received": True}
    record_event(event["id"], event["type"], event["data"])

    # 3) Despachar por tipo
    t = event["type"]
    obj = event["data"]["object"]
    if t == "checkout.session.completed":
        handle_checkout_completed(obj)      # suscripción o topup según metadata.kind
    elif t in ("customer.subscription.created", "customer.subscription.updated"):
        handle_subscription_sync(obj)       # upsert subscriptions + included_at_quota
    elif t == "customer.subscription.deleted":
        handle_subscription_canceled(obj)   # status=canceled
    elif t == "invoice.paid":
        handle_invoice_paid(obj)            # RESET included_remaining = included_at_quota
    elif t == "invoice.payment_failed":
        handle_invoice_failed(obj)          # status=past_due + notificar
    return {"received": True}
```

**Reglas críticas:**
1. **Firma obligatoria.** Usar el cuerpo **crudo** (no `await request.json()` antes de verificar).
2. **Idempotencia primero.** `payment_events.stripe_event_id` es PK; si el INSERT choca → ya procesado → 200.
3. **Resolver tenant** con `billing_tenant_for_customer(stripe_customer_id)` y `set_tenant_id` antes de tocar tablas tenant-scoped.
4. **Crédito de AT siempre vía `wallet.credit(...)`** (escribe `at_ledger`). Nunca UPDATE directo sin ledger.
5. **`invoice.paid` resetea la cuota incluida** del ciclo: `included_remaining = subscription.included_at_quota` (no suma; reemplaza). Los AT comprados (`purchased_remaining`) NO se tocan.
6. Mapear Price ID → plan/AT con los mapas en código (`PLAN_AT_QUOTA`, `TOPUP_AT`), validando contra el Price ID recibido.
7. Responder **200 rápido**; trabajo pesado puede ir async, pero para MVP es síncrono y simple.

---

## 7. Integración con el consumo de AT

Crear `api-gateway/app/billing/wallet.py` con estas funciones (todas reciben un cursor/conn con `set_tenant_id` ya aplicado):

```python
def get_balance(conn, tenant_id) -> dict          # {included_remaining, purchased_remaining, total}
def credit(conn, tenant_id, amount, reason, ref_type=None, ref_id=None) -> int   # suma a purchased_remaining; escribe ledger
def reset_included(conn, tenant_id, quota) -> None  # included_remaining = quota; ledger reason='subscription_renewal'
def assert_enough(conn, tenant_id, cost) -> None    # lanza HTTP 402 si total < cost
def charge(conn, tenant_id, cost, reason, ref_type, ref_id) -> int
    # debita primero included_remaining, luego purchased_remaining; escribe ledger; devuelve balance_after
def refund(conn, tenant_id, amount, ref_type, ref_id) -> int   # reason='refund'
```

**Puntos de integración en `main.py` (decisión cerrada):**

1. **Pre-chequeo al crear/completar evaluación** (`POST /api/evaluations/{id}/complete`, línea ~699):
   - Calcular `costo = ceil(duracion_min) + recargo` (AT).
   - `assert_enough(conn, tenant_id, costo)` → si no, **402 Payment Required** con `{detail:"saldo_at_insuficiente", needed, available}`.
   - Tras encolar el job, **NO debitar aún** (se debita cuando el score queda listo, para poder auto-refund si falla).
2. **Débito al completar el score** (donde se persiste `score.ready` / status `completed`):
   - `charge(conn, tenant_id, costo, "evaluation", "evaluation", eval_id)`.
3. **Auto-refund si la evaluación falla por error de Apex** (status `failed`):
   - Si ya se debitó, `refund(conn, tenant_id, costo, "evaluation", eval_id)`.
4. **Live agent** (al cerrar la sesión en `app/live/orchestrator.py`):
   - `costo_live = ceil(minutos) * 3`.
   - Pre-chequeo `assert_enough` al iniciar la sesión; `charge(... "live", "live_session", session_id)` al cerrar.

> **Concurrencia:** los UPDATE de `at_wallets` deben usar `SELECT ... FOR UPDATE` sobre la fila del tenant dentro de la transacción para evitar condiciones de carrera (dos evaluaciones simultáneas). Patrón ya recomendado en la skill de Postgres del repo (`.agents/skills/supabase-postgres-best-practices`).

---

## 8. Seguridad y cumplimiento (checklist obligatorio)

- [ ] **Nunca** se guardan PAN/CVV/datos de tarjeta. Solo IDs de Stripe.
- [ ] `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` solo en env del backend, nunca en frontend ni en git (ya cubierto por `.gitignore`).
- [ ] El frontend solo usa `STRIPE_PUBLISHABLE_KEY`.
- [ ] Webhook **verifica firma** siempre; rechaza payloads sin firma válida (400).
- [ ] Webhook es **idempotente** (tabla `payment_events`).
- [ ] Todas las tablas de billing tienen **RLS por tenant** (migración 0003).
- [ ] El lookup tenant↔customer usa función `SECURITY DEFINER` controlada, no se desactiva RLS globalmente.
- [ ] Endpoints de checkout usan **Idempotency-Key** de Stripe.
- [ ] Cada movimiento de AT queda en `at_ledger` (auditoría para disputas).
- [ ] Saldo nunca puede quedar negativo (CHECK constraints + `assert_enough`).
- [ ] Evaluaciones fallidas por error de Apex no cobran AT (auto-refund).

---

## 9. Frontend (mínimo viable)

En `frontend/` (React + Vite), añadir una vista de Billing que:
1. Lea `STRIPE_PUBLISHABLE_KEY` de env del frontend.
2. Muestre los 4 planes y los 3 packs de recarga con botones.
3. Al hacer clic, llame al endpoint correspondiente y **redirija** a `response.url` (Stripe Checkout).
4. Tenga páginas `/billing/success` y `/billing/cancel`.
5. Muestre saldo de AT (`GET /api/billing/balance`) e historial (`GET /api/billing/ledger`).
6. Botón "Gestionar suscripción" → `POST /api/billing/portal` → redirige al portal.

> No se integra Stripe Elements en MVP: Checkout alojado por Stripe es más simple y PCI-friendly.

---

## 10. Plan de pruebas

### 10.1 Local con Stripe CLI
```bash
stripe login
stripe listen --forward-to localhost:8080/api/webhooks/stripe   # imprime el whsec_ para STRIPE_WEBHOOK_SECRET
# en otra terminal, disparar eventos de prueba:
stripe trigger checkout.session.completed
stripe trigger invoice.paid
```
Tarjeta de prueba: `4242 4242 4242 4242`, cualquier fecha futura, CVC 3 dígitos.

### 10.2 Tests automatizados (seguir el estilo de `infra/tests/` y `scoring/tests/`)
- `test_billing_webhook_signature.py`: payload sin firma → 400; con firma válida → 200.
- `test_billing_idempotency.py`: mismo `event_id` dos veces → segundo no duplica crédito.
- `test_wallet_math.py`: `charge` debita included antes que purchased; nunca negativo; `assert_enough` lanza 402.
- `test_invoice_paid_resets_quota.py`: `invoice.paid` deja `included_remaining == included_at_quota` sin tocar `purchased_remaining`.
- `test_refund.py`: evaluación fallida devuelve los AT debitados.
- `test_migration_0003_structure.py`: las 5 tablas existen, RLS activo, FKs a tenants (espejo de `test_migration_structure.py`).
- `test_openapi_billing_routes.py`: las rutas `/api/billing/*` y `/api/webhooks/stripe` existen en el spec.

---

## 11. Desglose de tareas (ejecutar EN ORDEN)

Cada tarea es atómica y tiene criterio de aceptación. Hacer una, verificar, commitear, siguiente.

| # | Tarea | Criterio de aceptación |
|---|---|---|
| **T1** | Crear migración `0003` (tablas + RLS + función SECURITY DEFINER) | `alembic upgrade head` corre sin error; `alembic downgrade -1` también; `test_migration_0003_structure.py` verde. |
| **T2** | Agregar `stripe>=9` a requirements + env vars a `.env.example` y compose | El gateway levanta con las nuevas env; `import stripe` funciona. |
| **T3** | `wallet.py`: get_balance/credit/reset_included/assert_enough/charge/refund + tests | `test_wallet_math.py` y `test_refund.py` verdes. |
| **T4** | `service.py`: crear/obtener Stripe Customer + Checkout (subscription y topup) + Portal | Llamadas a Stripe en modo test devuelven `url`; idempotency-key presente. |
| **T5** | `routes.py`: los 6 endpoints REST (sin webhook) + montar router en `main.py` | `GET /api/billing/balance` y `subscription` responden; checkout devuelve url; `test_openapi_billing_routes.py` verde. |
| **T6** | `webhooks.py`: receptor con firma + idempotencia + handlers | `stripe trigger` provisiona/credita correctamente; `test_billing_webhook_signature.py`, `test_billing_idempotency.py`, `test_invoice_paid_resets_quota.py` verdes. |
| **T7** | Integrar consumo de AT en evaluaciones (pre-chequeo 402, débito al score, auto-refund) | Evaluación sin saldo → 402; con saldo → debita y aparece en ledger; fallida → refund. |
| **T8** | Integrar consumo de AT en live (3 AT/min) | Sesión live debita 3×min al cerrar; pre-chequeo al iniciar. |
| **T9** | Frontend: vista de billing (planes, packs, saldo, portal, success/cancel) | Flujo completo en test mode: suscribirse, recargar, ver saldo actualizado. |
| **T10** | Documentar en `docs/` + actualizar OpenAPI spec embebido | Spec incluye rutas billing; README de gateway menciona setup de Stripe. |

---

## 12. Definition of Done

- [ ] T1–T10 completas con sus tests verdes.
- [ ] `make test` (o `pytest -q`) pasa en `infra/`, `api-gateway/` y workers sin regresiones.
- [ ] Un flujo E2E en **modo test de Stripe** funciona: registrar → suscribirse (Starter) → ver 200 AT → consumir evaluación → ver débito en ledger → recargar pack → ver saldo sumado.
- [ ] Webhook verificado con `stripe listen` sin errores ni doble procesamiento.
- [ ] Ningún secreto en git; `.env.example` documentado.
- [ ] RLS validado: un tenant no ve billing de otro.

---

## 13. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Webhook procesa dos veces (Stripe reintenta) | Idempotencia con `payment_events` (PK = event_id). |
| Carrera entre dos evaluaciones simultáneas debitan mal | `SELECT ... FOR UPDATE` sobre `at_wallets` en la transacción. |
| Firma de webhook mal verificada (usar JSON parseado) | Usar cuerpo crudo (`await request.body()`) antes de cualquier parseo. |
| Tenant equivocado en webhook (sin JWT) | Resolver tenant solo vía `billing_customers` + función SECURITY DEFINER. |
| Cuota incluida se suma en vez de resetear | `invoice.paid` hace `included_remaining = quota` (reemplaza), nunca `+=`. |
| Secretos filtrados | Solo en env backend; verificar `.gitignore`; rotar si se exponen. |
| Stripe sube comisión / cambia API | Versionar API de Stripe; usar skill `upgrade-stripe`; cláusula de ajuste de tarifas (FINANCIAL_PLAN §15). |

---

## 14. Referencias

- **FINANCIAL_PLAN.md** — modelo de negocio, planes, precios, AT, política de auto-refund (§14) y disputas (§15).
- **Skill oficial Stripe:** `stripe/ai` → `stripe-best-practices` (`npx skills add https://github.com/stripe/ai --skill stripe-best-practices`).
- **Skill webhooks:** `hookdeck/webhook-skills`.
- **Esquema actual:** `infra/migrations/versions/20260507_0001_initial_schema.py` y `0002_rls_by_tenant.py`.
- **Gateway:** `api-gateway/app/main.py` (auth JWT, `db_conn`, `set_tenant_id`).
- **Stripe docs:** https://docs.stripe.com/billing/subscriptions/build-subscriptions , https://docs.stripe.com/webhooks , https://docs.stripe.com/payments/checkout
