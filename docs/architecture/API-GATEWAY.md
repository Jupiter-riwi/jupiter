# API Gateway — El cerebro que coordina todo

> **Para la presentación.** Este documento explica el **API Gateway** (FastAPI):
> qué hace, cómo conecta el frontend con la IA y con los datos, y por qué es la
> pieza más interesante de la arquitectura.
>
> **El "wow" en una frase:**
> **un solo servicio coordina tiempo real y procesamiento asíncrono — sin bloquearse.**

---

## 1. ¿Qué es?

El API Gateway es el **único punto de entrada** de Apex Vision. Todo lo que hace
el usuario pasa por acá. No es "una API más": es el **director de orquesta** que
conecta tres mundos que normalmente no se hablan entre sí:

```
        ┌─────────────┐
        │  FRONTEND   │  (vendedor / admin / landing)
        └──────┬──────┘
               │  HTTPS + WebSocket
        ┌──────▼───────────────────────────────────────┐
        │              API GATEWAY (FastAPI)            │
        │  El cerebro: autentica, coordina, orquesta    │
        └──┬─────────┬─────────┬──────────┬─────────────┘
           │         │         │          │
     ┌─────▼──┐ ┌────▼───┐ ┌───▼────┐ ┌───▼─────────────┐
     │Postgres│ │ MinIO  │ │RabbitMQ│ │ APIs de IA en   │
     │ (datos │ │(videos)│ │(colas) │ │ vivo: Groq /    │
     │  + RLS)│ │        │ │        │ │ DeepSeek /      │
     └────────┘ └────────┘ └───┬────┘ │ ElevenLabs      │
                                │      └─────────────────┘
                        ┌───────▼────────┐
                        │   AI WORKERS    │  pose · whisper ·
                        │  (asíncronos)   │  prosody · scoring
                        └────────────────┘
```

**Stack:** FastAPI + Uvicorn · psycopg2 (Postgres) · MinIO SDK · pika (RabbitMQ) ·
PyJWT · bcrypt · httpx. Código en `api-gateway/app/main.py` + `app/live/` + `app/billing/`.

---

## 2. Las 5 responsabilidades del cerebro

### 2.1 🔐 Autenticación con JWT
- Login/registro con contraseñas hasheadas con **bcrypt** (nunca se guardan en texto).
- Emite un par de tokens: **access** (15 min) + **refresh** (7 días), firmados con `JWT_SECRET` (HS256).
- Cada request protegido valida el token (`_decode_token`) y extrae quién es y a qué empresa pertenece.
- Endpoints: `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /api/me`.

### 2.2 🏢 Multi-tenant (aislamiento por empresa)
- El JWT lleva el `tenant_id` (la empresa) además del `user_id` y el `role`.
- Antes de cada query, el gateway hace `SELECT set_tenant_id('<uuid>')` en Postgres.
- Postgres aplica **Row-Level Security (RLS)**: una empresa **físicamente no puede
  ver** los datos de otra, aunque haya un bug en el código. El aislamiento vive en
  la base, no solo en la app.
- Endpoints admin (`/api/admin/evaluations`) exigen `role == admin`.

### 2.3 📋 CRUD de evaluaciones
El ciclo de vida completo de una evaluación:
- `POST /api/evaluations` — crea la evaluación (estado `pending`).
- `PUT /api/evaluations/{id}/upload` — devuelve una **URL prefirmada** para subir el video.
- `POST /api/evaluations/{id}/complete` — dispara el procesamiento de IA.
- `GET /api/evaluations` / `GET /api/evaluations/{id}` — consulta resultados.
- `POST /api/evaluations/{id}/coach/chat` — chat de coaching sobre el resultado.

### 2.4 🎬 URLs prefirmadas para subir el video (el video NO pasa por el gateway)
- El gateway **no recibe el archivo de video** — eso lo saturaría.
- En su lugar genera una **presigned URL** de MinIO (`_presigned_upload_url`, válida 15 min):
  el navegador sube el video **directo a MinIO/S3**, sin pasar por el gateway.
- El gateway solo guarda la *referencia* (`video_key`). Escala sin convertirse en cuello de botella.

### 2.5 ⚡ El orquestador del WebSocket en vivo (lo más vistoso)
El agente conversacional en tiempo real: el usuario presenta y un comprador con IA
le responde con voz, en vivo. Endpoint `WS /api/live/ws` → clase `LiveSession`
(`app/live/orchestrator.py`). El loop por turno:

```
🎤 audio del usuario
   → Groq Whisper (STT)        "¿qué dijo?"
   → DeepSeek (LLM en personaje) "¿qué responde el comprador?"  [streaming]
   → ElevenLabs Flash (TTS)     "convertir a voz"  [frase por frase]
   → 🔊 audio de vuelta al navegador
```

Detalles que lo hacen "vivo":
- **Streaming + pipelining de frases:** apenas el LLM termina una oración, ya se
  sintetiza y se manda — el agente empieza a hablar antes de terminar de "pensar".
- **Barge-in:** si el usuario interrumpe, se cancela la respuesta en curso (`asyncio.Task.cancel()`).
- Al cerrar la sesión, el gateway puntúa la conversación y la persiste.

---

## 3. El "wow": tiempo real + asíncrono en un solo servicio, sin bloquearse

Acá está lo que vale la pena explicar. El gateway maneja **dos paradigmas opuestos
al mismo tiempo** y ninguno frena al otro:

### Camino A — Procesamiento asíncrono (evaluación grabada)
Cuando llega `POST /complete`, el gateway **no espera** a que la IA termine
(eso tarda segundos/minutos). Hace *fire-and-forget*: publica **4 trabajos** en
RabbitMQ y responde **202 Accepted al instante**:

```python
_publish_job("pose.jobs",    {...})   # análisis de lenguaje corporal
_publish_job("whisper.jobs", {...})   # transcripción
_publish_job("prosody.jobs", {...})   # análisis de voz
_publish_job("scoring.jobs", {...})   # puntaje final (espera a los 3 anteriores)
```

Los **AI workers** consumen esas colas en segundo plano y trabajan en paralelo.
El gateway ya quedó libre para atender a otro usuario. **Desacople total.**

### Camino B — Tiempo real (agente en vivo)
La misma instancia atiende WebSockets con **asyncio**: I/O no bloqueante para
hablar simultáneamente con Groq, DeepSeek y ElevenLabs mientras transmite audio.
Decenas de conversaciones a la vez, sin hilos por conexión.

### ¿Por qué no se bloquean entre sí?
- El **WebSocket en vivo** corre sobre el event loop async de Uvicorn (no bloqueante).
- Las **publicaciones a RabbitMQ** son disparar-y-olvidar: el gateway nunca se queda
  esperando a la IA pesada — delega a los workers vía colas.
- El consumo de mensajes de RabbitMQ (cuando aplica) corre en un **hilo daemon aparte**,
  sin tocar el event loop de las peticiones web.

> **Frase para la diapo:** *"Un mismo servicio sostiene una charla en vivo con tres
> IAs y, a la vez, despacha pipelines de procesamiento pesado a una flota de workers
> — y nunca se traba, porque lo rápido va por async y lo pesado va por colas."*

---

## 4. Cómo conecta con cada servicio

| Conecta con | Cómo | Para qué |
|---|---|---|
| **Frontend** | HTTPS (REST) + WebSocket | Sirve toda la app: auth, evaluaciones, agente en vivo. |
| **Postgres** | `psycopg2` + `set_tenant_id` (RLS) | Usuarios, evaluaciones, scores, billing — aislados por empresa. |
| **MinIO / S3** | SDK MinIO, **URLs prefirmadas** | El navegador sube/baja video directo; el gateway solo guarda la referencia. |
| **RabbitMQ** | `pika`, publica en `*.jobs` | Despacha los 4 trabajos de IA sin bloquearse (camino asíncrono). |
| **AI Workers** | Indirecto, vía las colas | pose / whisper / prosody consumen; scoring junta todo y publica `score.ready`. |
| **Groq · DeepSeek · ElevenLabs** | `httpx` async (streaming) | STT + LLM + TTS del agente en vivo (camino tiempo real). |
| **Stripe** | SDK Stripe + webhook | Suscripciones, recargas de Apex Tokens y consumo (`app/billing/`). |

---

## 5. Mapa de endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/health` | Health check (lo usa Docker/Caddy). |
| POST | `/api/auth/login` · `/api/auth/refresh` | Login y renovación de token (JWT). |
| GET | `/api/me` | Datos del usuario autenticado. |
| GET | `/api/questions` | Catálogo de preguntas/escenarios del tenant. |
| POST | `/api/evaluations` | Crea una evaluación. |
| PUT | `/api/evaluations/{id}/upload` | Devuelve la URL prefirmada para subir el video. |
| POST | `/api/evaluations/{id}/complete` | **Dispara el pipeline de IA** (publica a las 4 colas). |
| GET | `/api/evaluations` · `/api/evaluations/{id}` | Lista / detalle de evaluaciones. |
| GET | `/api/admin/evaluations` | Vista de equipo (solo rol admin). |
| POST | `/api/evaluations/{id}/coach/chat` | Chat de coaching sobre el resultado. |
| GET | `/api/live/personas` · `/api/live/sessions` | Catálogo de personajes y el historial de sesiones en vivo. |
| **WS** | `/api/live/ws` | **El orquestador en vivo** (STT → LLM → TTS). |
| — | `/api/billing/*` · `/api/webhooks/stripe` | Suscripciones, recargas y webhook de pagos. |

Especificación completa servida en `GET /docs` (OpenAPI).

---

## 6. Resumen para cerrar la presentación

- El API Gateway es **el cerebro**: el frontend nunca habla con la base, las colas
  ni la IA directamente — **todo pasa por él**.
- Hace 5 cosas: **autentica** (JWT), **aísla por empresa** (multi-tenant + RLS),
  maneja el **CRUD de evaluaciones**, genera **URLs prefirmadas** para el video, y
  **orquesta el WebSocket en vivo**.
- Lo memorable: **coordina tiempo real (async) y procesamiento pesado (colas) en un
  solo servicio, sin bloquearse.** Lo rápido fluye; lo pesado se delega.

---

## 7. Qué archivo hace qué (mapa del servicio)

Todo el servicio vive en `api-gateway/`. Estos son los archivos y su rol:

### Núcleo
| Archivo | Qué hace |
|---|---|
| `app/main.py` | **El corazón (~945 líneas).** La app FastAPI: auth JWT, multi-tenant (`set_tenant_id` + RLS), CRUD de evaluaciones, URLs prefirmadas de MinIO, publicación de jobs a RabbitMQ, chat de coaching y endpoints admin. Monta los routers de `live` y `billing`. |
| `Dockerfile` | Imagen del gateway (Python 3.12 + uvicorn). |
| `requirements.txt` | Dependencias (fastapi, uvicorn, psycopg2, pika, minio, PyJWT, bcrypt, httpx, stripe). |
| `Makefile` | Atajos: `make run` (uvicorn), `make seed`, `make test`. |
| `seed.py` | Siembra datos demo (tenant + usuarios + preguntas) — idempotente. |
| `internal/apidocs/openapi.json` | Especificación OpenAPI que sirve `GET /docs`. |
| `README.md` | Cómo levantar el gateway + setup de Stripe. |

### `app/live/` — el agente conversacional en vivo (WebSocket)
| Archivo | Qué hace |
|---|---|
| `live/router.py` | Los endpoints del live: `WS /api/live/ws`, `GET /api/live/personas`, `GET /api/live/sessions`. Valida el JWT (viene por query param en el WS). |
| `live/orchestrator.py` | **`LiveSession`: el orquestador.** El loop por turno STT→LLM→TTS, streaming, pipelining de frases, barge-in y cierre con puntaje. |
| `live/stt.py` | Speech-to-text con **Groq Whisper** (transcribe cada turno del usuario). |
| `live/llm.py` | LLM en personaje con **DeepSeek** (streaming de la respuesta del comprador IA). |
| `live/tts.py` | Text-to-speech con **ElevenLabs Flash** (voz, frase por frase, baja latencia). |
| `live/persona.py` | Catálogo de personajes: roles (cliente, director, técnico…), niveles de exigencia y sus prompts. |
| `live/scoring.py` | Puntúa la conversación en vivo al terminar. |
| `live/store.py` | Persiste y lista el historial de sesiones en vivo. |

### `app/billing/` — pasarela de pagos (Stripe + Apex Tokens)
| Archivo | Qué hace |
|---|---|
| `billing/routes.py` | Los 6 endpoints REST `/api/billing/*` (checkout, portal, saldo, historial). |
| `billing/webhooks.py` | Receptor `/api/webhooks/stripe`: verifica firma, idempotencia y despacha eventos. |
| `billing/service.py` | Acciones del lado Stripe: crear Customer, Checkout y Billing Portal. |
| `billing/wallet.py` | Contabilidad de Apex Tokens (saldo, débito/crédito, con `FOR UPDATE`). |
| `billing/evaluation.py` | Hooks que cobran AT por evaluación (1 AT/min) y por live (3 AT/min); se desactivan si no hay Stripe. |
| `billing/plans.py` | Mapa plan/pack → AT (fuente de verdad para acreditar). |
| `billing/db.py` | Helper de conexión con RLS + resolución de tenant para el webhook. |

### `tests/` — pruebas del gateway
| Archivo | Qué verifica |
|---|---|
| `tests/test_wallet_math.py` | La aritmética del wallet (débitos, créditos, sin negativos). |
| `tests/test_billing_webhook.py` | Firma del webhook + idempotencia + acreditación de recargas. |
| `tests/test_evaluation_hooks.py` | El cálculo de costo en AT y los hooks de cobro/reembolso. |
| `tests/conftest.py` | Conexión falsa in-memory para correr los tests sin base real. |

> **En una frase para la diapo:** `main.py` es el corazón; `app/live/` es el tiempo
> real (STT→LLM→TTS); `app/billing/` es la monetización — todo bajo un mismo servicio.
