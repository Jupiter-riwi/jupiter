# Estado de integracion con Frontend

> Objetivo: dejar claro que ya esta implementado en el proyecto, que falta para integrar correctamente con frontend y cual es el plan de cierre tecnico.

---

## 1. Resumen ejecutivo

Estado actual: **parcialmente listo** para integracion con frontend.

- Hay avances fuertes en API Gateway, migraciones, colas e infraestructura local.
- El frontend aun no esta conectado al flujo real end-to-end del MVP.
- Existen inconsistencias de contratos entre documentacion, backend, workers y frontend.

**Conclusion:** todavia **no** esta listo para integrar frontend productivo sin una fase corta de alineacion tecnica.

---

## 2. Lo que ya esta implementado

## 2.1 API Gateway

Implementado en Go con rutas base funcionales:

- `GET /health`
- `GET /docs` (OpenAPI JSON)
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /me`
- `POST /evaluations`
- `POST /evaluations/:id/complete`
- `GET /evaluations/:id`
- `GET /evaluations`
- `GET /evaluations/:id/stream`
- `GET /questions`

Referencia: `api-gateway/cmd/api/main.go`.

## 2.2 Persistencia y multi-tenant

- Migracion inicial de tablas (`tenants`, `users`, `questions`, `evaluations`, `features`, `scores`).
- Migracion de RLS por `tenant_id` con funciones helper.

Referencias:

- `infra/migrations/versions/20260507_0001_initial_schema.py`
- `infra/migrations/versions/20260507_0002_rls_by_tenant.py`

## 2.3 Infraestructura local

- `docker-compose.yml` raiz con `postgres`, `rabbitmq`, `minio`, `gateway`, `workers`, `frontend`, `migrate`.
- `Makefile` con `up/down/logs/seed/health`.
- `.env.example` para entorno local.

Referencias:

- `docker-compose.yml`
- `Makefile`
- `.env.example`

## 2.4 Workers y scoring

Hay dos lineas de implementacion coexistiendo:

1. **Linea avanzada por dominio**
   - `ai-workers/pose/pose_worker/*`
   - `ai-workers/whisper/whisper_worker/*`
   - `ai-workers/prosody/*`
   - `ai-workers/scoring/*`

2. **Linea base/stub unificada**
   - `ai-workers/app/main.py`
   - `ai-workers/workers/*`

Actualmente el compose principal apunta a la linea base/stub.

## 2.5 Frontend

- Proyecto Vite + React + TS levantado.
- Existen pantallas base (`Login`, `Dashboard`) y cliente Axios.

Referencias:

- `frontend/src/pages/Login/index.tsx`
- `frontend/src/pages/Dashboard/index.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/App.tsx`

---

## 3. Brecha contra la planificacion (docs)

Segun `docs/ARCHITECTURE.md`, `docs/TEAM.md` y `docs/HISTORIAS_USUARIO.md`, faltan cierres para cumplir el MVP integrado.

## 3.1 Desalineaciones de arquitectura

- Documentacion: API Gateway migrado a FastAPI.
- Codigo actual: API Gateway en Go.

Impacto: rompe consistencia de stack y contratos esperados por el equipo.

## 3.2 Desalineaciones de contratos API/Frontend

- Frontend usa `baseURL = http://localhost:8080/api`.
- Gateway expone rutas sin prefijo `/api`.

Impacto: requests del frontend fallan por rutas incorrectas.

## 3.3 Desalineaciones DB/Workers

- `ai-workers/db.py` usa columna `features.data`, pero migracion define `features.payload`.
- `ai-workers/shared/db.py` inserta `scores.overall/dimensions/recommendations`, pero migracion define `scores.value/breakdown`.

Impacto: errores de escritura/lectura en runtime.

## 3.4 Eventos de progreso inconsistentes

- Documentacion define eventos de negocio: `feature.ready`, `score.ready`, `error`.
- Gateway WS hoy emite `connected`, `status_changed`, `completed`, `error`.

Impacto: el frontend no puede confiar en un contrato unico de seguimiento.

## 3.5 Estado real frontend

- `App.tsx` sigue plantilla Vite.
- Login/Dashboard no estan cableados al flujo end-to-end documentado (pregunta -> grabacion -> upload -> complete -> progreso -> score).

Impacto: no existe vertical slice funcional desde UI.

---

## 4. Bloqueos criticos para integracion frontend

1. Definir y congelar arquitectura efectiva de gateway (Go o FastAPI).
2. Congelar contrato de rutas para frontend (con o sin prefijo `/api`).
3. Unificar una sola implementacion de workers en compose (evitar doble linea).
4. Corregir contrato de tabla `features` (`payload`) en todos los writers.
5. Corregir contrato de tabla `scores` para que coincida entre migraciones y workers.
6. Estandarizar eventos de progreso (WS o Realtime) y documentarlos.
7. Conectar frontend al flujo real con autenticacion y manejo de errores.

---

## 5. Plan tecnico recomendado (orden de ejecucion)

## Fase 1 - Alineacion de contratos (1-2 dias)

- Decidir stack final del gateway y actualizar docs canonicas.
- Definir contrato API final consumido por frontend.
- Definir contrato de eventos en vivo (WS/realtime).
- Definir contrato DB final para `features` y `scores`.

Entregable: documento de contrato congelado + OpenAPI versionada.

## Fase 2 - Endurecer backend para frontend (2-4 dias)

- Ajustar gateway y workers al contrato final.
- Alinear migrations/modelos/repositorios.
- Validar fan-in real a scoring.
- Garantizar `POST /evaluations`, upload presigned, `complete`, `GET /evaluations/:id`.

Entregable: backend estable consumible por UI.

## Fase 3 - Integracion frontend real (2-4 dias)

- Implementar flujo UI completo:
  - login
  - obtener pregunta
  - grabar video
  - upload directo
  - complete
  - pantalla de progreso
  - resultado final
- Consumir eventos reales del backend.

Entregable: vertical slice funcionando de punta a punta.

## Fase 4 - QA de integracion y release gate (1-2 dias)

- Pruebas E2E con 3 corridas consecutivas exitosas.
- Validacion multi-tenant basica (2 tenants).
- Verificacion de latencia, errores y trazabilidad por `evaluation_id`.

Entregable: decision formal de pasar `features -> developer`.

---

## 6. Checklist de "listo para integrar frontend"

- [ ] Contrato API estable y publicado.
- [ ] Frontend apunta a baseURL correcta y rutas reales.
- [ ] Flujo `evaluations/create -> upload -> complete` operativo.
- [ ] Pipeline de workers escribe features y score sin errores de esquema.
- [ ] Evento de progreso recibido en frontend durante procesamiento.
- [ ] Dashboard renderiza score y recomendaciones desde datos reales.
- [ ] Manejo de errores de permisos (camara/mic), upload y procesamiento.
- [ ] Smoke E2E validado por al menos 2 miembros del equipo.

---

## 7. Decision actual

Con el estado actual del repositorio, **no se recomienda** declarar integracion frontend finalizada.

Si se ejecuta el plan de cierre de este documento, el proyecto puede quedar en condicion de integracion frontend en un sprint tecnico corto.
