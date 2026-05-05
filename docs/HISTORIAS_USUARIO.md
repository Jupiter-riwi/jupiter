# Historias de Usuario — Jupiter Sales Evaluator

> Relación con `TEAM.md`: cada historia de usuario (HU) se asigna al Dev dueño del dominio correspondiente. Prioridades: **P0** (bootstrap, bloquea a otros), **P1** (MVP), **P2** (post-MVP).

---

## Dev 1 — AI Workers: Vision & Speech

### HU-1.1 Procesar lenguaje corporal desde video (Pose Worker)

**Como** vendedor que sube una grabación de práctica,  
**quiero** que el sistema analice mi lenguaje corporal (postura, gestos, contacto visual)  
**para** recibir feedback objetivo sobre mi comunicación no verbal.

**Criterios de aceptación:**
- [ ] El worker consume jobs de la cola `pose.jobs` con `video_url` en S3/MinIO.
- [ ] Extrae features por segmento de N segundos: postura, gestos de manos, contacto visual estimado, variabilidad.
- [ ] Publica resultado en `features.results` y persiste en tabla `features` con `kind='pose'`.
- [ ] Procesa un video de 2 minutos en < 60 segundos.
- [ ] Maneja errores: video corrupto, duración > 10 min (rechaza con mensaje claro).
- [ ] 3 tests unitarios con fixtures de video (short, long, edge-case).
- [ ] Dockerfile y entrada en `docker-compose.yml` funcionales.

**Prioridad:** P1

---

### HU-1.2 Transcribir audio del video (Whisper Worker)

**Como** vendedor que sube una grabación de práctica,  
**quiero** que el sistema transcriba mi discurso palabra por palabra con timestamps  
**para** poder revisar qué dije y cómo lo dije en cada momento.

**Criterios de aceptación:**
- [ ] El worker consume jobs de la cola `whisper.jobs`, extrae audio con `ffmpeg`.
- [ ] Llama a OpenAI Whisper API (`whisper-1`) con `response_format=verbose_json`.
- [ ] Publica transcript completo + segmentos con timestamps en `features.results` (`kind='transcript'`).
- [ ] Procesa audio de 2 minutos en < 30 segundos.
- [ ] Maneja errores: audio mudo o corrupto (reporta sin crashear).
- [ ] 3 tests unitarios con fixtures de audio.
- [ ] Dockerfile y entrada en `docker-compose.yml` funcionales.

**Prioridad:** P1

---

## Dev 2 — AI Workers: Prosody & Scoring

### HU-2.1 Analizar cualidades vocales (Prosody Worker)

**Como** vendedor que quiere mejorar su forma de hablar,  
**quiero** que el sistema analice mi tono, velocidad, volumen y pausas  
**para** saber si hablo muy rápido, muy bajo o con demasiadas muletillas.

**Criterios de aceptación:**
- [ ] El worker consume `prosody.jobs` con archivo de audio.
- [ ] Calcula con `librosa`: pitch (mediana, varianza), energía/volumen, words-per-minute.
- [ ] Calcula ratio de pausas (silencios > 500ms / duración total).
- [ ] Detecta muletillas básicas sobre el transcript de Whisper.
- [ ] Persiste en tabla `features` con `kind='prosody'`.
- [ ] Tests con fixtures de audio variados (voz rápida, lenta, normal).

**Prioridad:** P1

---

### HU-2.2 Generar score agregado con IA (Scoring Worker)

**Como** vendedor (o admin de cliente),  
**quiero** que el sistema consolide todos los features (pose, transcripción, prosodia) en un puntaje único con recomendaciones  
**para** obtener una evaluación integral y accionable de mi desempeño.

**Criterios de aceptación:**
- [ ] Se dispara cuando los 3 features están listos (fan-in vía `features.results` o counter).
- [ ] Lee los 3 features desde la tabla, arma el prompt y llama a GPT-4o con `response_format={"type": "json_schema"}`.
- [ ] Valida la respuesta JSON con `pydantic`; si es inválida, retry con backoff (máx. 2).
- [ ] Persiste en tabla `scores` y publica `score.ready` en WebSocket.
- [ ] Prompt versionado en `ai-workers/scoring/prompts/v1.md` (cambios = PRs revisables).
- [ ] Logging de costo por evaluación (tokens in/out).
- [ ] Tests: dado un set de features de ejemplo, el score cae en rango esperado.

**Prioridad:** P1

---

## Dev 3 — API Gateway + Infra

### HU-3.1 Autenticación y autorización multi-tenant

**Como** usuario del sistema,  
**quiero** poder registrarme e iniciar sesión con email/contraseña  
**para** acceder de forma segura y que mis datos estén aislados por empresa.

**Criterios de aceptación:**
- [ ] Endpoints `POST /auth/login` y `POST /auth/refresh` con JWT (claims: `tenant_id`, `role`).
- [ ] Endpoint `GET /me` retorna datos del usuario autenticado.
- [ ] Middleware multi-tenant: cada query agrega `WHERE tenant_id = $current_tenant`.
- [ ] Tokens expiran y se refrescan correctamente.
- [ ] Test E2E: registro → login → acceso a recurso propio → rechazo de recurso ajeno.

**Prioridad:** P0

---

### HU-3.2 Subir y gestionar evaluaciones

**Como** vendedor,  
**quiero** poder crear una evaluación, subir mi video y lanzar el análisis  
**para** obtener un score de mi desempeño.

**Criterios de aceptación:**
- [ ] `POST /evaluations` crea registro + genera presigned URL para upload directo a MinIO.
- [ ] `POST /evaluations/{id}/complete` publica jobs en las colas RabbitMQ (pose, whisper, prosody).
- [ ] `GET /evaluations/{id}` retorna score + features cuando están listos.
- [ ] `GET /evaluations` lista evaluaciones del usuario/tenant con paginación.
- [ ] `WS /evaluations/{id}/stream` notifica avance vía WebSocket (`feature.ready`, `score.ready`, `error`).
- [ ] Formato de eventos WebSocket estandarizado (ver contrato en TEAM.md).

**Prioridad:** P1

---

### HU-3.3 Preguntas de práctica por tenant

**Como** vendedor,  
**quiero** ver las preguntas de práctica asignadas a mi empresa  
**para** saber sobre qué tema debo grabar mi evaluación.

**Criterios de aceptación:**
- [ ] `GET /questions` retorna preguntas filtradas por `tenant_id`.
- [ ] Las preguntas incluyen: texto, categoría, duración esperada.
- [ ] Siembra de preguntas demo en `make seed`.

**Prioridad:** P1

---

### HU-3.4 Modelo de datos y migraciones

**Como** desarrollador del equipo,  
**quiero** tener un schema de base de datos versionado con migraciones  
**para** que todos los servicios compartan la misma estructura de datos.

**Criterios de aceptación:**
- [ ] Migraciones Alembic para tablas: `tenants`, `users`, `questions`, `evaluations`, `features`, `scores`.
- [ ] Row Level Security (RLS) en Postgres por `tenant_id`.
- [ ] Tabla `features` con schema: `id uuid`, `evaluation_id`, `tenant_id`, `kind` (pose|transcript|prosody), `payload jsonb`.
- [ ] Migraciones reversibles (`upgrade` / `downgrade`).

**Prioridad:** P0

---

### HU-3.5 Infraestructura local con Docker Compose

**Como** desarrollador del equipo,  
**quiero** levantar todo el sistema con un solo comando  
**para** poder desarrollar y probar localmente sin depender de servicios externos.

**Criterios de aceptación:**
- [ ] `docker compose up` levanta: Postgres 16, RabbitMQ (con UI), MinIO, gateway, 4 workers, frontend dev server.
- [ ] `curl /health` responde 200 en cada servicio.
- [ ] Scripts `make up`, `make down`, `make seed` (siembra tenant demo + preguntas).
- [ ] Variables de entorno documentadas en `.env.example`.
- [ ] Postman/Insomnia collection con flujo completo commiteada.
- [ ] OpenAPI spec auto-generada en `/docs`.

**Prioridad:** P0

---

### HU-3.6 Coordinación de workers (fan-in para scoring)

**Como** sistema,  
**quiero** que el scoring worker se dispare automáticamente cuando los 3 features estén listos  
**para** que el usuario reciba su resultado sin intervención manual.

**Criterios de aceptación:**
- [ ] Mecanismo de fan-in definido y funcionando (counter en Redis/Postgres, o worker orquestador).
- [ ] Cuando pose, transcript y prosody están persistidos para una evaluación, se publica `scoring.jobs`.
- [ ] Si un worker falla, no se dispara scoring; se notifica error vía WebSocket.
- [ ] Test E2E: subir video → workers procesan → scoring se dispara automáticamente.

**Prioridad:** P1

---

## Dev 4 — Frontend

### HU-4.1 Inicio de sesión y perfil de usuario

**Como** vendedor,  
**quiero** poder iniciar sesión y ver mi perfil con mi historial  
**para** acceder a mis evaluaciones pasadas y hacer seguimiento de mi progreso.

**Criterios de aceptación:**
- [ ] Pantalla de login con email/contraseña.
- [ ] Refresh token automático en interceptor de axios (sin re-login manual).
- [ ] Vista de perfil: nombre, email, empresa, historial de evaluaciones.
- [ ] Manejo de errores: credenciales inválidas, sesión expirada, sin conexión.
- [ ] Tests con Vitest + React Testing Library para componentes de auth.

**Prioridad:** P0

---

### HU-4.2 Grabar y subir una evaluación

**Como** vendedor,  
**quiero** grabar mi respuesta a una pregunta de práctica directamente desde el navegador  
**para** practicar mis habilidades de venta cuando quiera, sin instalar nada.

**Criterios de aceptación:**
- [ ] Solicita pregunta al backend y la muestra en pantalla.
- [ ] Solicita permisos de cámara y micrófono; si se deniegan, muestra mensaje claro con instrucciones.
- [ ] Graba video con `MediaRecorder` (codec `video/webm;codecs=vp9,opus`).
- [ ] Preview del video grabado + botón de regrabar.
- [ ] Subida directa a MinIO usando presigned URL (PUT).
- [ ] Notifica `POST /evaluations/{id}/complete` al backend para iniciar procesamiento.
- [ ] Pantalla de "procesando" con WebSocket: indicadores de avance (pose ✓, transcript ✓, scoring ✓).
- [ ] Compatible con Chrome y Edge desktop. Firefox best-effort.

**Prioridad:** P1

---

### HU-4.3 Dashboard de resultados del vendedor

**Como** vendedor,  
**quiero** ver mis resultados de evaluación de forma visual e intuitiva  
**para** entender mis fortalezas, debilidades y cómo voy mejorando.

**Criterios de aceptación:**
- [ ] Historial de evaluaciones con score por cada una.
- [ ] Gráfico radar de dimensiones del score (claridad, persuasión, lenguaje corporal, etc.).
- [ ] Lista de recomendaciones / tips priorizados desde el JSON de scoring.
- [ ] Tendencia de mejora entre evaluaciones.
- [ ] Componentes con tests unitarios.
- [ ] Bundle total < 500 KB gzipped.

**Prioridad:** P1

---

### HU-4.4 Dashboard de administrador de cliente

**Como** admin de una empresa cliente,  
**quiero** ver el desempeño de todo mi equipo de ventas  
**para** identificar quién necesita coaching y en qué áreas.

**Criterios de aceptación:**
- [ ] Vista de equipo: lista de vendedores con score promedio.
- [ ] Comparativas entre vendedores (radar superpuesto).
- [ ] Drill-down por vendedor: ver su historial completo.
- [ ] Filtros por período, pregunta, categoría.
- [ ] Componentes con tests unitarios.

**Prioridad:** P2

---

### HU-4.5 Cliente API y tipos compartidos

**Como** desarrollador frontend,  
**quiero** tener un cliente API tipado generado desde el OpenAPI del backend  
**para** evitar errores de integración y acelerar el desarrollo.

**Criterios de aceptación:**
- [ ] Tipos TypeScript generados desde el OpenAPI spec de Dev 3.
- [ ] Cliente axios/ky preconfigurado con base URL, auth interceptor y manejo de errores.
- [ ] Tipos para: User, Evaluation, Question, Score, Features, WebSocket events.

**Prioridad:** P1

---

## Resumen de prioridades

| Prioridad | Historias | Owner |
|-----------|-----------|-------|
| **P0** — Bootstrap | HU-3.1 Auth, HU-3.4 Migraciones, HU-3.5 Infra, HU-4.1 Login/Perfil | Dev 3 + Dev 4 |
| **P1** — MVP | HU-1.1 Pose, HU-1.2 Whisper, HU-2.1 Prosody, HU-2.2 Scoring, HU-3.2 Evaluaciones, HU-3.3 Preguntas, HU-3.6 Coordinación, HU-4.2 Grabación, HU-4.3 Dashboard vendedor, HU-4.5 Cliente API | Todos |
| **P2** — Post-MVP | HU-4.4 Dashboard admin | Dev 4 |

---

## Mapa de dependencias entre historias

```
HU-3.1 (Auth) ─────────────────────────────────────────────────────────┐
HU-3.4 (Migraciones) ──────────────────────────────────────────────────┤
HU-3.5 (Infra Docker) ─────────────────────────────────────────────────┤
                                                                        ▼
HU-4.1 (Login/Perfil) ◄── depende de ── HU-3.1, HU-3.5                │
HU-4.5 (Cliente API)  ◄── depende de ── HU-3.1, HU-3.4                │
                                                                        │
HU-3.3 (Preguntas)    ◄── depende de ── HU-3.4, HU-3.5                │
HU-3.2 (Evaluaciones) ◄── depende de ── HU-3.4, HU-3.5, HU-3.1        │
                                                                        │
HU-1.1 (Pose)         ◄── depende de ── HU-3.2, HU-3.5                │
HU-1.2 (Whisper)      ◄── depende de ── HU-3.2, HU-3.5                │
HU-2.1 (Prosody)      ◄── depende de ── HU-3.2, HU-3.5, HU-1.2        │
                                                                        │
HU-3.6 (Coordinación) ◄── depende de ── HU-1.1, HU-1.2, HU-2.1        │
HU-2.2 (Scoring)      ◄── depende de ── HU-1.1, HU-1.2, HU-2.1, HU-3.6│
                                                                        │
HU-4.2 (Grabación)    ◄── depende de ── HU-3.2, HU-3.3, HU-4.5        │
HU-4.3 (Dashboard)    ◄── depende de ── HU-2.2, HU-3.2, HU-4.5        │
HU-4.4 (Admin)        ◄── depende de ── HU-4.3                         │
```
