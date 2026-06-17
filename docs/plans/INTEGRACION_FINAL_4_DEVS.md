# Guia de integracion tecnica final (4 devs)

> Objetivo: integrar el trabajo de Dev 1, Dev 2, Dev 3 y Dev 4 en un solo flujo estable de punta a punta (login -> grabacion -> procesamiento multimodal -> score -> dashboard), con criterios tecnicos de aceptacion, pruebas y release.

---

## 1) Alcance de la integracion

Esta guia se ejecuta cuando los 4 dominios ya estan implementados en sus ramas de feature:

- Dev 1: `ai-workers/pose/` y `ai-workers/whisper/`
- Dev 2: `ai-workers/prosody/` y `ai-workers/scoring/`
- Dev 3: `api-gateway/` (FastAPI), migraciones, auth, colas, storage, `infra/`
- Dev 4: `frontend/` (auth, evaluacion, dashboard, websocket/realtime)

La integracion se valida sobre `developer` (via `features` y `fix`), nunca directo en `main`.

---

## 2) Definicion de listo para integrar (DoI)

Cada dominio debe llegar a integracion cumpliendo todo:

1. PR aprobado y mergeado en la rama de acumulacion correcta (`features` o `fix`).
2. Tests del dominio en verde.
3. Contratos compartidos congelados y versionados:
   - API/OpenAPI gateway
   - payloads RabbitMQ
   - esquema `features`/`scores`
   - contrato JSON de scoring
4. Dockerfile y variables de entorno documentadas en `.env.example`.
5. Logging estructurado minimo por `evaluation_id`, `tenant_id`, `job_id`.

Si un punto falla, no entra al corte de integracion.

---

## 3) Orden de integracion recomendado (critico)

Orden obligatorio para minimizar bloqueos:

1. **Base plataforma (Dev 3)**
   - Gateway FastAPI operativo
   - DB/migraciones aplicadas
   - RabbitMQ + topologia de colas/exchanges
   - Storage y flujo presigned URL
2. **Flujo usuario (Dev 4)**
   - Login
   - Grabacion + upload + complete
   - Vista estado procesamiento
3. **Workers de features (Dev 1 + Dev 2 prosody)**
   - Pose
   - Whisper
   - Prosody
4. **Agregacion final (Dev 2 scoring + coordinacion Dev 3)**
   - Fan-in de 3 features
   - Trigger a `scoring.jobs`
   - Persistencia `scores`
   - Notificacion final `score.ready`

---

## 4) Congelamiento de contratos (Integration Contract Freeze)

Antes del merge final a `developer`, realizar una sesion de 60-90 min y dejar cerrados estos contratos.

### 4.1 API Gateway (Dev 3, consumidores Dev 4)

Endpoints minimos:

- `POST /auth/login`
- `POST /auth/refresh`
- `GET /me`
- `GET /questions`
- `POST /evaluations`
- `POST /evaluations/{id}/complete`
- `GET /evaluations/{id}`
- `GET /evaluations`
- `WS /evaluations/{id}/stream` (o equivalente realtime decidido)

Reglas:

- OpenAPI publicada y versionada.
- No breaking changes sin PR de contrato.
- Campos de respuesta usados por frontend marcados como estables.

### 4.2 RabbitMQ (Dev 3 owner, Dev 1/2 consumidores)

Entradas:

- `pose.jobs`
- `whisper.jobs`
- `prosody.jobs`
- `scoring.jobs`

Salidas:

- `features.results`
- `score.ready`

Reglas:

- Mensajes con `job_id`, `evaluation_id`, `tenant_id` siempre presentes.
- Colas durables y ACK manual en workers.
- `prefetch_count=1` al menos en primera integracion.

### 4.3 Base de datos (Dev 3 owner, Dev 1/2/4 consumidores)

Tablas minimas:

- `tenants`, `users`, `questions`, `evaluations`, `features`, `scores`

Reglas:

- `features.kind` restringido a `pose|transcript|prosody`.
- `scores` ligado 1:1 logico con `evaluation_id`.
- RLS/multi-tenant activa antes de QA final.

### 4.4 Contrato de scoring (Dev 2 owner)

Debe incluir exactamente:

- `overall` (0-100)
- `dimensions` con 5 claves:
  - `confianza`
  - `claridad`
  - `lenguaje_corporal`
  - `ritmo_voz`
  - `escucha_activa`
- `recommendations` con `priority` en `high|medium|low`

---

## 5) Plan de integracion por fases (operativo)

### Fase A - Preparacion de entorno

1. Actualizar ramas base:
   - `features`, `fix`, `developer`
2. Ejecutar migraciones y seed inicial.
3. Levantar stack local completo (gateway + 4 workers + rabbitmq + db + storage + frontend).
4. Verificar healthchecks de todos los servicios.

Checklist tecnico:

- `.env` completo (sin secretos hardcodeados)
- puertos sin colision
- acceso a OpenAI para whisper/scoring
- acceso a storage para upload y lectura de media

### Fase B - Integracion backend sin UI

Objetivo: validar pipeline con requests y jobs, sin navegador.

1. Crear evaluacion via API.
2. Simular upload (o usar fixture ya subido).
3. Llamar `complete` para disparar jobs.
4. Verificar consumo en `pose`, `whisper`, `prosody`.
5. Confirmar `features` persistidos.
6. Confirmar trigger de fan-in hacia `scoring.jobs`.
7. Confirmar insercion en `scores`.
8. Confirmar evento `score.ready`.

Salida esperada:

- 1 fila en `evaluations`
- 3 filas en `features`
- 1 fila en `scores`
- estado final de evaluacion consistente (ej. `completed`)

### Fase C - Integracion frontend end-to-end

Objetivo: validar experiencia real de usuario.

1. Login con usuario vendedor.
2. Abrir pantalla de evaluacion y obtener pregunta.
3. Grabar video (fixture manual 15-45s).
4. Upload por presigned URL.
5. Enviar `complete`.
6. Observar progreso (WS/realtime):
   - pose listo
   - transcript listo
   - prosody listo
   - scoring listo
7. Ver score renderizado en dashboard con dimensiones y recomendaciones.

### Fase D - Hardening de integracion

1. Casos de error:
   - video corrupto
   - sin audio
   - media > limite permitido
   - timeout OpenAI
   - caida temporal RabbitMQ
2. Reintentos esperados por componente.
3. Confirmar que errores quedan trazables por `evaluation_id`.

---

## 6) Matriz de pruebas de integracion (obligatoria)

### 6.1 Pruebas funcionales

1. Flujo feliz completo (vendedor).
2. Flujo admin con listado/historico.
3. Multi-tenant: aislamiento total de datos.

### 6.2 Pruebas de contrato

1. Validacion del schema de jobs RabbitMQ.
2. Validacion del schema de `features.payload` por `kind`.
3. Validacion del schema de salida scoring (Pydantic/JSON schema).

### 6.3 Pruebas de resiliencia

1. Requeue controlado cuando faltan features para scoring.
2. Retry LLM en respuesta invalida.
3. NACK sin requeue para payloads malformados.

### 6.4 Pruebas de performance basica (MVP)

Objetivos recomendados (alinear con TEAM.md):

- Pose < 60s para video de 2 minutos
- Whisper < 30s para video de 2 minutos
- Scoring < 15s (sin colas saturadas)
- Latencia E2E objetivo < 120s en entorno local limpio

---

## 7) Runbook de debugging inter-equipo

Si falla una evaluacion, seguir este orden:

1. Buscar `evaluation_id` en gateway logs.
2. Validar que `complete` haya publicado jobs iniciales.
3. Revisar colas RabbitMQ:
   - profundidad de cola
   - mensajes unacked
4. Revisar logs de cada worker por `job_id`.
5. Confirmar inserts en `features`.
6. Verificar logica fan-in hacia `scoring.jobs`.
7. Revisar llamada OpenAI y validacion de esquema.
8. Confirmar persistencia en `scores`.
9. Confirmar evento final y recepcion en frontend.

Si un paso falla, abrir issue etiquetado por dominio owner:

- `owner:dev1`
- `owner:dev2`
- `owner:dev3`
- `owner:dev4`

---

## 8) Definicion de listo para release (DoR de integracion)

No se promueve `developer -> main` hasta cumplir todo:

1. Flujo E2E verde al menos 3 corridas consecutivas.
2. Sin errores bloqueantes P0/P1 abiertos.
3. Checklist de seguridad minima completo:
   - JWT/Auth valida
   - RLS activo
   - no leakage cross-tenant
4. Costos y latencias observadas y documentadas.
5. PR de release aprobada por los 4 devs (o representante por dominio).

---

## 9) Checklist final (copiar en PR de integracion)

- [ ] Gateway FastAPI completo y OpenAPI estable
- [ ] Frontend consume endpoints finales (sin mocks)
- [ ] Pose/Whisper/Prosody escriben en `features`
- [ ] Trigger fan-in publica `scoring.jobs` correctamente
- [ ] Scoring escribe en `scores` y publica `score.ready`
- [ ] WebSocket/Realtime actualiza UI en vivo
- [ ] Multi-tenant validado con 2 tenants de prueba
- [ ] Logs correlacionables por `evaluation_id`
- [ ] Pruebas E2E documentadas (pasos + evidencia)
- [ ] Riesgos remanentes registrados para siguiente sprint

---

## 10) Responsabilidad operativa por dominio durante integracion

- **Dev 1:** salud de `pose`/`whisper`, tiempos de procesamiento de media, calidad de features.
- **Dev 2:** salud de `prosody`/`scoring`, validez de salida LLM, estrategia de retries.
- **Dev 3:** gateway, auth, multi-tenant, DB/colas/storage, orquestacion fan-in.
- **Dev 4:** UX de captura/subida, consumo de estados en vivo, render de score y errores.

Regla de oro: cada incidente tiene un owner primario y un owner secundario del componente acoplado mas cercano.

---

## 11) Secuencia de validacion tecnica (comandos base)

> Ejecutar por dominio para confirmar que nada rompe en integracion.

```bash
# 1) AI workers (desde ai-workers/)
python -m pytest prosody/tests/ scoring/tests/ -v

# 2) API Gateway (ajustar comando final cuando Dev 3 cierre migracion)
# FastAPI esperado: uvicorn app.main:app --reload --port 8000

# 3) Frontend (desde frontend/)
npm install
npm run lint
npm run build
```

Checks operativos recomendados:

```bash
# Health endpoints
curl http://localhost:8000/health
curl http://localhost:8001/health
curl http://localhost:8002/health
```

Si se usan puertos distintos al cerrar integracion, actualizar esta seccion en el mismo PR.

---

## 12) Recomendacion de ceremonia de cierre tecnico

1. Integracion dry-run en entorno local compartido.
2. Correccion rapida de hallazgos criticos (max 24h).
3. Segundo run completo con evidencia (logs + capturas + payloads).
4. Aprobacion cruzada entre dominios.
5. PR `developer -> main` con changelog de integracion.

Con esto, el equipo llega a un release reproducible, trazable y mantenible, evitando el clasico problema de "cada modulo funciona solo" pero falla al integrarse.
