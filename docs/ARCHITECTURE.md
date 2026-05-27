# Arquitectura MVP — Apex Vision Sales Evaluator

> Plataforma web multi-tenant para evaluar habilidades de equipos de ventas mediante análisis multimodal (video + audio) con OpenAI.

---

## 1. Flujo funcional del MVP

```
1. Vendedor inicia sesión (perfil ya creado por su admin de cliente).
2. La web le muestra una pregunta de evaluación (ej: "Presentá el producto X a un cliente").
3. El navegador graba video + audio (MediaRecorder API, getUserMedia).
4. Al finalizar, sube el archivo al backend.
5. Backend encola un job de análisis y responde "procesando".
6. Workers procesan en paralelo:
     - Pose/lenguaje corporal (MediaPipe local)
     - Transcripción (OpenAI Whisper)
     - Análisis prosódico (librosa)
7. Worker de scoring agrega features + transcript → llama a OpenAI GPT-4o con prompt estructurado → JSON con score objetivo y recomendaciones accionables.
8. Resultado se persiste y se notifica al frontend (WebSocket o polling).
9. Vendedor ve su evaluación en el dashboard de su perfil.
10. Admin del cliente consulta las evaluaciones reales del tenant y ve agregados por vendedor, dimensiones, actividad y recomendaciones.
```

---

## 2. Diagrama de arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                            │
│  - Login / Perfil                                                        │
│  - Pantalla de evaluación: pregunta + grabación (MediaRecorder)          │
│  - Dashboard: historial, score, recomendaciones                          │
│  - WebSocket client para resultados en vivo                              │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ HTTPS (REST + WS)
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY (FastAPI)                     │
│  - Auth JWT + tenant_id en claims                                        │
│  - POST /evaluations  (crea registro + presigned URL)                    │
│  - PUT  <storage>/...  (upload directo del cliente)                      │
│  - POST /evaluations/{id}/complete  (notifica fin de upload)             │
│  - GET  /evaluations/{id}                                                │
│  - GET  /admin/evaluations  (admin: evaluaciones del tenant)             │
│  - WS   /evaluations/{id}/stream                                         │
└──────────┬──────────────────────────────┬──────────────────────────────┘
           │ publish job                  │ read/write
           ▼                              ▼
   ┌──────────────┐              ┌──────────────────┐
   │  RabbitMQ    │              │   Postgres       │
   │  - jobs      │              │  - tenants       │
   │  - results   │              │  - users         │
   └──────┬───────┘              │  - questions     │
          │                      │  - evaluations   │
          │                      │  - scores        │
          │                      └──────────────────┘
          │
          ▼                              ┌──────────────────┐
┌──────────────────────────────┐         │  Object Storage  │
│      AI WORKERS (Python)      │◀──────▶│  (S3 / GCS /     │
│                               │  read  │   MinIO local)   │
│  ┌─────────────────────────┐ │  video │  - raw videos    │
│  │ 1. Pose Worker          │ │        │  - audio extract │
│  │    MediaPipe + OpenCV   │ │        │  - thumbnails    │
│  │    → features.json      │ │        └──────────────────┘
│  └─────────────────────────┘ │
│  ┌─────────────────────────┐ │        ┌──────────────────┐
│  │ 2. Audio Worker         │ │        │   OpenAI API     │
│  │    ffmpeg + librosa     │ │───────▶│  - Whisper       │
│  │    + Whisper (OpenAI)   │ │        │  - GPT-4o        │
│  │    → transcript +       │ │        └──────────────────┘
│  │      prosody.json       │ │
│  └─────────────────────────┘ │
│  ┌─────────────────────────┐ │
│  │ 3. Scoring Worker       │ │
│  │    fan-in: pose +       │ │
│  │    transcript + prosody │ │
│  │    → GPT-4o (JSON      │ │
│  │      schema)            │ │
│  │    → score + coaching   │ │
│  └─────────────────────────┘ │
└──────────────────────────────┘
```

---

## 3. Reutilización del código existente

| Componente repo actual | Destino MVP | Acción |
|---|---|---|
| `Body-Detection/.../pose_detector.py` | Pose Worker | Refactor: convertir el loop de cámara en función `process_video(path) → features` |
| `apex-vision/ai-workers` (FastAPI + RabbitMQ consumer) | Template para los 3 workers | Clonar 3 veces, una por worker |
| `apex-vision/api-gateway` (Go) | ~~API Gateway~~ → reemplazar por FastAPI | Decidido: se migra a Python para unificar stack |
| `apex-vision/frontend` (React+Vite+Tailwind) | Frontend | Reciclar layout; agregar grabación + dashboard |

---

## 4. Modelo de datos (Postgres, mínimo viable)

```sql
tenants        (id, name, plan, created_at)
users          (id, tenant_id, email, role, name, created_at)
questions      (id, tenant_id, prompt, category, target_skill)
evaluations    (id, tenant_id, user_id, question_id, video_url, status, created_at)
features       (id, evaluation_id, kind ['pose'|'prosody'|'transcript'], payload jsonb)
scores         (id, evaluation_id, overall numeric, dimensions jsonb, recommendations jsonb)
```

`tenant_id` en cada tabla → row-level security en Postgres para multi-tenancy.

El dashboard admin consume `GET /api/admin/evaluations`, que retorna evaluaciones del tenant con `seller_email` y `seller_role`; el frontend agrupa por vendedor y calcula score promedio, dimensiones, tendencias, actividad reciente y recomendaciones desde `features.recommendations`.

---

## 5. Contrato de scoring y recomendaciones (salida de GPT-4o)

```json
{
  "overall": 78,
  "dimensions": {
    "confianza":       { "score": 82, "evidence": "..." },
    "claridad":        { "score": 75, "evidence": "..." },
    "lenguaje_corporal": { "score": 70, "evidence": "..." },
    "ritmo_voz":       { "score": 80, "evidence": "..." },
    "escucha_activa":  { "score": 65, "evidence": "..." }
  },
  "recommendations": [
    {
      "priority": "high",
      "area": "ritmo_voz",
      "problem": "Hablas a 185 WPM, por encima del rango recomendado.",
      "impact": "El prospecto puede percibir ansiedad y perder partes clave.",
      "tip": "Reduce velocidad y marca pausas entre ideas.",
      "drill": "Graba el mismo pitch 3 veces intentando llegar a 150 WPM.",
      "success_metric": "WPM entre 130 y 160 durante al menos 80% del pitch."
    }
  ]
}
```

GPT-4o se llama con `response_format: { type: "json_schema" }` y el resultado se valida con Pydantic antes de persistir. El prompt por defecto es `ai-workers/scoring/prompts/v2.md`; `SCORING_PROMPT_VERSION` permite cambiar de versión.

---

## 6. Stack tecnológico recomendado

| Capa | Tecnología | Razón |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind (ya existe) | Reciclable |
| Grabación | `MediaRecorder` + `getUserMedia` | Nativo navegador, sin libs externas |
| API Gateway | **FastAPI** (decidido — se migra desde Go) | Unifica stack en Python; el código Go actual era ~5% (solo `/health`) |
| Cola | RabbitMQ (ya existe) | Reciclable |
| Workers | Python 3.12 + FastAPI lifespan | Reciclable template |
| Pose | MediaPipe (ya existe) | Reciclable |
| ASR | OpenAI Whisper API | Pedido del usuario |
| LLM | OpenAI GPT-4o (JSON mode) | Pedido del usuario |
| DB | **Supabase (PostgreSQL 15)** (decidido) | Postgres hosteado + RLS + Realtime + Auth integrados |
| Storage | **Supabase Storage** bucket `videos` (decidido) | Reemplaza MinIO/S3; signed URLs, políticas por tenant |
| Auth | **Supabase Auth** (decidido) | Reemplaza JWT custom; JWT generado automáticamente |
| Realtime | **Supabase Realtime** (decidido) | Reemplaza WebSocket custom del gateway; notifica score listo |
| DB local (dev) | Postgres 16 en docker-compose | Para desarrollo offline sin depender de Supabase |

---

## 7. Plan de construcción por fases

**Fase 0 — Bootstrap (2-3 días)**
- Aplicar schema en Supabase (`supabase/migrations/20260505000000_initial_schema.sql`).
- Docker Compose: RabbitMQ + workers + gateway (Supabase reemplaza Postgres + MinIO).
- Variables de entorno (`.env` desde `.env.example`).
- CI básico (lint + tests).

**Fase 1 — Vertical slice (1 semana)**
- Login + perfil + grabación de video + upload a MinIO.
- Worker dummy que sólo escribe "ok" en `scores`.
- Frontend muestra el resultado.

**Fase 2 — Workers reales (1-2 semanas)**
- Pose worker (reutilizando `pose_detector.py`).
- Audio worker (ffmpeg → Whisper API → librosa).
- Scoring worker (GPT-4o con JSON schema).

**Fase 3 — Multi-tenant + dashboard (1 semana)**
- RLS en Postgres, claims JWT.
- Vistas de admin de cliente vs vendedor.
- Histórico, comparativas, tendencias.

**Fase 4 — Endurecimiento (1 semana)**
- Rate limiting, retries, dead-letter queues.
- Observabilidad (logs estructurados, métricas).
- Privacidad: cifrado en reposo, retención configurable, consent banner.

---

## 8. MCPs y Skills útiles para construir esto

### MCPs (Model Context Protocol servers)

Ya conectados en este entorno:

| MCP | Para qué sirve en este proyecto |
|---|---|
| **Supabase** ✅ | Interactuar directo con el proyecto: ejecutar SQL, inspeccionar schema, gestionar storage y auth — sin salir del editor. Config en `.mcp.json` |
| **Claude_Preview** | Levantar el frontend en preview, ver consola/errores, screenshots |
| **Claude_in_Chrome** | Testear el flujo real (grabar, subir, ver resultado) en Chrome con permisos de cámara/mic |
| **mcp-registry** | Buscar y agregar nuevos MCPs según necesidad |
| **scheduled-tasks** | Cleanup de videos viejos, reportes periódicos por cliente |

Ver detalle de uso del MCP de Supabase en `docs/SUPABASE.md`.

### Skills (Claude Code)

| Skill | Cuándo usarla |
|---|---|
| **skill-creator** | Crear skills custom del proyecto (ver propuestas abajo) |
| **simplify** | Pasar después de cada feature para limpiar duplicación / overengineering |
| **claude-api** | Si en el futuro agregamos un fallback con Claude (además de OpenAI) |
| **update-config** | Configurar hooks de Claude Code (ej: ejecutar tests automáticamente al editar workers) |
| **schedule** / **anthropic-skills:schedule** | Agentes recurrentes (ej: revisar prompts del scoring worker semanalmente con sample real) |
| **anthropic-skills:pdf** | Exportar reportes de evaluación en PDF para los clientes |
| **anthropic-skills:xlsx** | Exportar métricas agregadas del equipo de ventas |
| **anthropic-skills:docx** | Reportes ejecutivos para el admin del cliente |
| **anthropic-skills:pptx** | Presentaciones con resultados (sales coaching review) |
| **anthropic-skills:consolidate-memory** | Mantener limpia la memoria del proyecto a medida que evoluciona |

### Skills custom propuestas (a crear con `skill-creator`)

1. **`generate-arch`** — Toma el MVP definido y genera/actualiza este `ARCHITECTURE.md`.
2. **`new-worker`** — Scaffolding de un nuevo worker basado en el template de `ai-workers/` (cola, handler, tests, Dockerfile).
3. **`prompt-eval`** — Corre el prompt del scoring worker contra un set de evaluaciones de prueba y compara salidas.
4. **`tenant-seed`** — Crea un tenant + usuarios + preguntas de demo para testing manual del flujo.
5. **`recording-smoke-test`** — Vía Claude_in_Chrome: abre la web, hace login, graba 10s, verifica que llegue el resultado.

---

## 9. Riesgos y decisiones abiertas

1. **Privacidad**: video de empleados es dato sensible. Definir política de retención, consentimiento, y posible procesamiento on-premise para clientes regulados.
2. **Costo OpenAI**: Whisper + GPT-4o por video puede sumar. Estimar costo por evaluación y considerar caching/batching.
3. **Latencia**: si el cliente espera resultado en <30s, hay que optimizar (pose en streaming, Whisper con archivos chicos, GPT-4o-mini para scoring).
4. **Calibración del scoring y coaching**: el prompt necesita iteración con feedback humano. La skill `prompt-eval` ayuda y debe revisar que las recomendaciones incluyan problema, impacto, drill y métrica.
5. **Idioma**: ¿multi-idioma desde día uno o sólo español? Whisper lo soporta nativamente; el prompt del scoring debe ser idioma-agnóstico.
6. ~~API Gateway Go vs Python~~ → **resuelto: FastAPI**.
