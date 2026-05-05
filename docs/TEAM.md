# División de trabajo — Jupiter Sales Evaluator

Equipo de **4 desarrolladores** trabajando en paralelo. Cada uno tiene un dominio claro con entregables propios y dependencias mínimas, alineadas con las feature branches que ya existen en el repo.

> Antes de leer esto: revisar `ARCHITECTURE.md` para entender el sistema completo. Esta tabla solo divide el trabajo.

---

## Resumen rápido

| Dev | Dominio | Branches base | Carpetas que posee |
|---|---|---|---|
| **Dev 1 (yo)** | AI Workers — Vision & Speech | `ai-workers/feature/ai-vision-setup`, `ai-workers/feature/ai-audio-setup` | `ai-workers/pose/`, `ai-workers/whisper/` |
| **Dev 2** | AI Workers — Prosody & Scoring | `ai-workers/feature/core-ai-worker` (rebase) | `ai-workers/prosody/`, `ai-workers/scoring/` |
| **Dev 3** | API Gateway + Infra | `api-gateway/feature/gateway-core-setup`, `api-gateway/feature/sprint2-auth-endpoints`, `api-gateway/feature/database-models` | `api-gateway/`, `infra/`, `docker-compose.yml` |
| **Dev 4** | Frontend | `frontend/feature/frontend-base`, `frontend/feature/login-ui-components`, `frontend/feature/routing-setup` | `frontend/` |

---

## Dev 1 — AI Workers: Vision & Speech (yo)

**Objetivo**: extraer features de lenguaje corporal y transcripción del video.

### Entregables

1. **Pose Worker** (`ai-workers/pose/`)
   - Refactor de `Body-Detection/.../pose_detector.py` para procesar archivos de video (no cámara en vivo).
   - Consume jobs de RabbitMQ (`pose.jobs`), descarga video desde MinIO/S3.
   - Extrae features por segmento de N segundos:
     - Postura (apertura, inclinación, hombros)
     - Gestos de manos (frecuencia, amplitud)
     - Contacto visual estimado (orientación de cabeza)
     - Variabilidad de pose
   - Publica resultado en `features.results` con esquema acordado (ver "Contrato de features").
   - Persiste también el JSON en tabla `features` (`kind='pose'`).

2. **Whisper Worker** (`ai-workers/whisper/`)
   - Consume `whisper.jobs`, extrae audio del video con `ffmpeg`.
   - Llama a OpenAI Whisper API (`whisper-1`) con `response_format=verbose_json` para obtener timestamps por segmento.
   - Publica transcript completo + segmentos en `features.results` (`kind='transcript'`).

### Acceptance criteria

- [ ] Procesa un video de 2 minutos en < 60s (pose) y < 30s (whisper).
- [ ] Maneja errores: video corrupto, audio mudo, longitud > 10 min (rechaza con mensaje claro).
- [ ] Tests unitarios sobre fixtures de video (3 ejemplos: short, long, edge-case).
- [ ] Dockerfile y entry en `docker-compose.yml` listos.

### Dependencias

- **Dev 3**: contrato de la cola RabbitMQ + bucket de MinIO + acceso a tabla `features`.
- **Dev 2**: acuerdo del schema de salida de pose (porque Dev 2 lo consume en scoring).

---

## Dev 2 — AI Workers: Prosody & Scoring

**Objetivo**: análisis de voz y agregación final con LLM.

### Entregables

1. **Prosody Worker** (`ai-workers/prosody/`)
   - Consume `prosody.jobs` con archivo de audio extraído (puede compartir el extracto que generó Dev 1, o re-extraer).
   - Usa `librosa` para calcular:
     - Pitch (mediana, varianza)
     - Energía / volumen (mediana, picos)
     - Words-per-minute (usa transcript de Whisper si está)
     - Ratio de pausas (silencios > 500ms / duración total)
     - Detección de muletillas básica (sobre el transcript)
   - Persiste en `features` (`kind='prosody'`).

2. **Scoring Worker** (`ai-workers/scoring/`)
   - Consume `scoring.jobs` (se dispara cuando los 3 features están listos — ver "Coordinación" abajo).
   - Hace fan-in: lee `features` de pose, transcript y prosody.
   - Llama a **OpenAI GPT-4o** con `response_format={"type": "json_schema", ...}` para forzar el contrato definido en `ARCHITECTURE.md` sección 5.
   - Persiste en tabla `scores`.
   - Publica `score.ready` para que el gateway notifique al frontend vía WebSocket.

### Acceptance criteria

- [ ] Prompt de scoring versionado en el repo (`ai-workers/scoring/prompts/v1.md`) — los cambios al prompt son PRs revisables.
- [ ] Schema JSON de respuesta validado con `pydantic`. Si OpenAI devuelve algo inválido, retry con backoff (max 2).
- [ ] Tests con fixtures: dado un set de features de ejemplo, el score cae en un rango esperado.
- [ ] Tracking de costo por evaluación (logging de tokens in/out).

### Dependencias

- **Dev 1**: schema de pose features.
- **Dev 3**: tablas `features` y `scores`, acceso a las colas.

---

## Dev 3 — API Gateway + Infra

**Objetivo**: orquestación, persistencia, multi-tenancy y devops.

### Entregables

1. **API Gateway en FastAPI** (`api-gateway/`) — reemplaza el esqueleto en Go.
   - Auth JWT con `tenant_id` y `role` en claims.
   - Endpoints:
     - `POST /auth/login`, `POST /auth/refresh`
     - `GET /me`
     - `GET /questions` (filtra por tenant)
     - `POST /evaluations` → crea registro + presigned URL para upload directo a MinIO
     - `POST /evaluations/{id}/complete` → publica jobs en RabbitMQ
     - `GET /evaluations/{id}` → trae score + features
     - `GET /evaluations` → lista por user/tenant
     - `WS /evaluations/{id}/stream` → notifica avance de los workers
   - Middleware multi-tenant: cada query agrega `WHERE tenant_id = $current_tenant`.

2. **Modelo de datos** (`api-gateway/migrations/`)
   - Migraciones con Alembic: `tenants`, `users`, `questions`, `evaluations`, `features`, `scores`.
   - RLS (Row Level Security) en Postgres por `tenant_id`.

3. **Infraestructura local** (`infra/` + `docker-compose.yml`)
   - Servicios: Postgres 16, RabbitMQ (con management UI), MinIO, gateway, los 4 workers, frontend dev server.
   - Script `make up` / `make down` / `make seed` (siembra tenant demo).
   - Variables de entorno via `.env.example`.

4. **Coordinación entre workers**
   - Definir el "fan-in" para scoring: cuando los 3 features están persistidos, publicar `scoring.jobs`. Opciones a decidir con el equipo:
     - (a) Counter en Redis / Postgres + último worker que completa dispara scoring.
     - (b) Un worker orquestador que escucha `features.results` y agrupa.

### Acceptance criteria

- [ ] `docker compose up` levanta todo y `curl /health` responde en cada servicio.
- [ ] Postman/Insomnia collection con flujo completo (login → upload → ver score) commiteada.
- [ ] OpenAPI spec auto-generada accesible en `/docs`.
- [ ] Test E2E que ejercite login + upload de fixture + espera de score con worker stub.

### Dependencias

- Bloquea a Dev 1, 2 y 4 (todos necesitan endpoints, schema y colas). **Prioridad: Fase 0/1.**

---

## Dev 4 — Frontend

**Objetivo**: experiencia del vendedor y dashboard del admin.

### Entregables

1. **Auth y perfil** (`frontend/src/pages/auth/`, `frontend/src/pages/profile/`)
   - Login, refresh token automático en interceptor de axios.
   - Vista de perfil: datos del vendedor, historial de evaluaciones.

2. **Pantalla de evaluación** (`frontend/src/pages/evaluation/`)
   - Pide pregunta al backend.
   - Solicita permisos de cámara y micrófono.
   - Graba con `MediaRecorder` (codec `video/webm;codecs=vp9,opus`).
   - Preview pre-envío + opción de regrabar.
   - Sube directo a MinIO con la presigned URL (PUT).
   - Notifica `complete` al backend.
   - Pantalla de "procesando" con WebSocket que muestra avance: pose ✓ / transcript ✓ / scoring ✓.

3. **Dashboard de resultados** (`frontend/src/pages/dashboard/`)
   - **Vendedor**: su historial, score por evaluación, recomendaciones, tendencia.
   - **Admin de cliente**: vista de equipo, comparativas, drill-down por vendedor.
   - Render del JSON de score: gráfico radar de dimensiones + lista de tips priorizados.

4. **Estado global**
   - Cliente API con tipos compartidos (idealmente generados desde el OpenAPI de Dev 3).

### Acceptance criteria

- [ ] Funciona en Chrome y Edge desktop (Firefox best-effort). Mobile fuera de scope MVP.
- [ ] Manejo claro de errores de permisos (cámara/mic denegados).
- [ ] Bundle < 500KB gzipped.
- [ ] Componentes principales con tests de Vitest + React Testing Library.

### Dependencias

- **Dev 3**: OpenAPI spec, presigned URLs, WebSocket endpoint.

---

## Contratos compartidos (acordar día 1, antes de codear)

### 1. Schema de jobs en RabbitMQ

```json
// Cola: pose.jobs / whisper.jobs / prosody.jobs
{
  "job_id": "uuid",
  "evaluation_id": "uuid",
  "tenant_id": "uuid",
  "video_url": "s3://bucket/path.webm",
  "audio_url": "s3://bucket/path.wav",  // sólo en whisper/prosody
  "options": {}
}
```

### 2. Tabla `features`

```sql
features (
  id uuid primary key,
  evaluation_id uuid references evaluations(id),
  tenant_id uuid not null,
  kind text not null check (kind in ('pose', 'transcript', 'prosody')),
  payload jsonb not null,
  created_at timestamptz default now()
)
```

### 3. Salida de scoring

Definida en `ARCHITECTURE.md` sección 5. Cualquier cambio se discute en PR.

### 4. Eventos WebSocket

```json
{ "type": "feature.ready", "evaluation_id": "...", "kind": "pose" }
{ "type": "score.ready",   "evaluation_id": "...", "score": {...} }
{ "type": "error",         "evaluation_id": "...", "stage": "whisper", "message": "..." }
```

---

## Cadencia y proceso

- **Daily async** (Slack, 10 min): qué hice / qué hago / blockers.
- **Sync semanal** (1h): demo de lo que avanzó cada uno + decisiones abiertas.
- **PRs**: review obligatorio de al menos 1 dev fuera del dominio. PRs chicos (< 400 líneas).
- **Branches**: seguir el patrón existente `<area>/feature/<descripción>`.
- **Decisiones de arquitectura**: cualquier cambio en contratos compartidos → PR a `ARCHITECTURE.md` antes de implementar. Usar la skill `/generate-arch` para mantener el doc consistente.

---

## Roadmap por fase (alineado con ARCHITECTURE.md sección 7)

| Fase | Foco | Owners principales |
|---|---|---|
| **0 — Bootstrap** | docker-compose, schema, CI | Dev 3 |
| **1 — Vertical slice** | Login + grabación + worker dummy + dashboard básico | Dev 3 + Dev 4 (+ Dev 1/2 con stubs) |
| **2 — Workers reales** | Pose, Whisper, Prosody, Scoring | Dev 1 + Dev 2 |
| **3 — Multi-tenant + dashboard** | RLS, vistas admin | Dev 3 + Dev 4 |
| **4 — Endurecimiento** | Retries, observabilidad, privacidad | Todos |
