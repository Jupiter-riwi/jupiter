# Deployment — Apex Vision on a Hetzner VPS

Single-origin deploy: the **entire stack runs on the VPS** behind one Caddy
reverse proxy that terminates TLS. The frontend is served from the same origin
as the API.

## Why not Vercel for the frontend?

The product needs a **persistent WebSocket** (`/api/live/ws`) for the real-time
agent, the browser needs **HTTPS** for camera/mic (`getUserMedia`) and **WSS**
for the socket, and **Stripe** posts webhooks to a public HTTPS URL. Vercel
hosts static/serverless frontends but **cannot host the long-lived WebSocket
backend** — that has to live on the VPS regardless.

Putting the frontend on Vercel too would split origins, forcing cross-origin
CORS + WSS to `api.yourdomain` and a separate MinIO origin — more moving parts
for zero benefit, since the VPS already serves static files trivially through
nginx+Caddy. **Recommendation: serve the frontend from the VPS (single origin).**
Use Vercel only if you later want a separate marketing site.

```
                         ┌───────────── VPS (Hetzner) ─────────────┐
  Browser ── HTTPS ──►  Caddy :443  ─/────────► frontend (nginx)
          ── WSS  ──►   (auto-TLS)  ─/api/───► gateway :8080 ──► postgres / rabbitmq / minio
  Browser ── HTTPS ──►  storage.<domain> ────► minio :9000   ──► AI workers (pose/whisper/prosody/scoring)
```

## Prerequisites

- A domain with two A records → the VPS public IP:
  - `apex.example.com`
  - `storage.apex.example.com`
- Docker + Docker Compose plugin on the VPS.
- Ports 80 and 443 open.

## Steps

```bash
# 1. Clone
git clone <repo> && cd jupiter
git checkout features        # or your release branch

# 2. Configure
cp .env.prod.example .env.prod
#   edit .env.prod: APEX_DOMAIN, strong DB/JWT/MinIO secrets, AI keys,
#   MINIO_PUBLIC_ENDPOINT=storage.<domain>, Stripe keys (optional).
openssl rand -hex 32         # use for JWT_SECRET

# 3. Launch (base compose + prod overlay + prod env)
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
               --env-file .env.prod up -d --build

# 4. Seed the first tenant + admin/seller (once)
docker compose --env-file .env.prod run --rm gateway ./seed

# 5. Firewall: only expose the proxy. The base compose still publishes internal
#    host ports (5432, 9000/9001, 15672, 8001/8002) — block them externally.
ufw default deny incoming
ufw allow OpenSSH
ufw allow 80,443/tcp
ufw enable
```

Then open `https://apex.example.com/seller`.

## MinIO public bucket

Video upload uses presigned URLs the browser hits directly at
`https://storage.<domain>`. Make the bucket readable for playback if needed and
ensure the `jupiter-videos` bucket exists (the gateway creates it on first use;
verify in the MinIO console, reachable via SSH tunnel to `:9001`).

## Stripe (billing)

1. Create products/prices in the Stripe dashboard; put the price IDs in
   `.env.prod` (`STRIPE_PRICE_*`).
2. Add a webhook endpoint → `https://apex.example.com/api/billing/webhook`,
   copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
3. With `STRIPE_SECRET_KEY` set, wallet enforcement turns on automatically.
   Without it, the app runs billing-free (`BILLING_ENFORCED` overrides either way).

## TLS / HTTPS

Caddy obtains and renews Let's Encrypt certs automatically for both domains on
first boot — no manual certbot. Just make sure DNS resolves before `up`.

## Updating

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
               --env-file .env.prod up -d --build
```

## Notes

- `api-client.js` auto-selects the API base: `localhost:8080` in dev, **same
  origin** in production. Override with `window.APEX_API_BASE` only if you split
  origins.
- Camera/mic **require HTTPS** — they silently fail on plain HTTP. The Caddy
  setup covers this; don't test the live agent over `http://<ip>`.
