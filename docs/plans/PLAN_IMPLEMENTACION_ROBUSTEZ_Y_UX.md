# Plan de implementacion, robustez y experiencia de usuario

_Fecha: 2026-06-03_

## 1) Estado actual del proyecto (revision rapida)

### 1.1 Lo que ya esta funcionando

- **API Gateway en FastAPI con flujo base de evaluaciones**: login, refresh, `/api/me`, create/upload/complete/get/list y endpoint admin (`api-gateway/app/main.py`).
- **Pipeline AI por workers especializados**: pose, whisper, prosody y scoring con colas RabbitMQ y persistencia en Postgres (`ai-workers/pose`, `ai-workers/whisper`, `ai-workers/prosody`, `ai-workers/scoring`).
- **Infra local unificada**: `docker-compose.yml` raiz con Postgres, RabbitMQ, MinIO, gateway, workers y frontend.
- **Migraciones iniciales + RLS** en `infra/migrations/versions`.
- **Cobertura de pruebas en workers clave** (pose, whisper, prosody, scoring) y tests de infraestructura en `infra/tests`.

### 1.2 Brechas tecnicas detectadas (prioridad alta)

1. **Desalineacion entre documentacion y codigo real**
   - `docs/ARCHITECTURE.md` declara decisiones que no estan cerradas en codigo (por ejemplo, Supabase), mientras el entorno real actual usa Postgres + MinIO + RabbitMQ local.

2. **Doble implementacion en API Gateway (Go y Python)**
   - Existe `api-gateway/cmd/api/main.go` con referencias a paquetes internos no presentes y tambien `api-gateway/app/main.py` operativo.
   - Esto agrega deuda tecnica y confusion para onboarding, CI y soporte.

3. **Contrato Frontend/API incompleto**
   - Frontend consume `GET /api/questions` (`frontend/src/services/api.ts`) pero el endpoint no existe en FastAPI actual.
   - El frontend mezcla dos lineas: UI estatica (`frontend/*.html`, `seller-*.jsx`) y app TS (`frontend/src/*`) sin empaquetador configurado en la carpeta (no hay `package.json` en `frontend/`).

4. **Manejo de errores no estandarizado extremo a extremo**
   - Hay buen manejo en workers (clasificacion/reintentos), pero falta un contrato de error unico y consistente para API + workers + frontend.

5. **Observabilidad y calidad de release todavia basicas**
   - CI actual en subproyectos es un stub (`echo "Basic CI Step"`), sin gates reales de lint/tests/build/e2e.

## 2) Implementaciones a seguir (roadmap recomendado)

## Fase 0 - Alineacion de contratos (1-2 dias)

- Congelar **stack efectivo del MVP actual** (evitar contradiccion doc vs runtime).
- Definir contrato unico para:
  - rutas API (request/response),
  - eventos de procesamiento,
  - errores normalizados (`code`, `message`, `retryable`, `trace_id`).
- Publicar OpenAPI versionada y ejemplos de payload de jobs/eventos.
- Resultado esperado: documento de contrato unico para frontend, gateway y workers.

## Fase 1 - Cierre del vertical slice real (3-5 dias)

- Implementar `GET /api/questions` en gateway FastAPI (alineado con frontend actual).
- Dejar **una sola linea frontend oficial**:
  - o SPA Vite/React completa,
  - o app estatica modular,
  - pero no ambas en paralelo para produccion.
- Completar flujo real UI: login -> create -> upload -> complete -> progreso -> resultado.
- Resultado esperado: demo E2E estable en local con datos reales.

## Fase 2 - Robustez operativa (4-6 dias)

- Agregar idempotencia y deduplicacion por `evaluation_id` en jobs.
- Incorporar DLQ por worker (`pose.dlq`, `whisper.dlq`, `prosody.dlq`, `scoring.dlq`).
- Estandarizar retries con backoff exponencial + jitter.
- Persistir `processing_timeline` por evaluacion (eventos y tiempos por etapa).
- Resultado esperado: sistema tolerante a fallas transitorias y facil de recuperar.

## Fase 3 - Endurecimiento de calidad y seguridad (3-5 dias)

- CI real por subproyecto: lint + tests + build + smoke contract test.
- Validaciones de seguridad:
  - limites de upload (tamano, extension, mime),
  - expiracion de URL firmada,
  - rotacion de secretos y `.env` hardening.
- Politica de retencion de videos/audio/features y borrado seguro.
- Resultado esperado: release gate tecnico minimo para pasar a entorno compartido.

## Fase 4 - UX y producto (4-7 dias)

- Estado de procesamiento por etapas para el usuario (cola, analizando audio, analizando postura, scoring).
- Errores accionables en UI (no solo "fallo"): causa probable + siguiente accion.
- Dashboard con foco en coaching:
  - score global + dimensiones,
  - recomendaciones priorizadas,
  - tendencia por sesiones.
- Resultado esperado: experiencia clara, confiable y orientada a mejora del vendedor.

## 3) Robustez del proyecto (lineamientos concretos)

1. **Confiabilidad**
   - Healthchecks profundos (DB, RabbitMQ, storage, dependencias LLM).
   - Circuit breaker para proveedores externos (OpenAI/Groq).

2. **Consistencia de datos**
   - Contratos versionados para `features.payload` y `scores.breakdown`.
   - Migraciones forward-only + tests de compatibilidad con workers.

3. **Observabilidad**
   - Logs estructurados JSON con `evaluation_id`, `tenant_id`, `job_id`, `trace_id`.
   - Metricas minimas: throughput, p95/p99 por etapa, errores por codigo, tasa de retry, tasa de DLQ.

4. **Operacion**
   - Runbooks para incidentes frecuentes (atasco en processing, fallo de proveedor, cola acumulada).
   - Job de "sentinel" con politicas y alertas claras, no solo como parche silencioso.

## 4) Manejo de errores (estandar sugerido)

Definir envelope unico para API y eventos internos:

```json
{
  "error": {
    "code": "VIDEO_TOO_LONG",
    "message": "El video supera la duracion permitida",
    "retryable": false,
    "stage": "whisper",
    "trace_id": "trc_123",
    "details": {
      "max_seconds": 480,
      "actual_seconds": 612
    }
  }
}
```

Checklist minimo:

- Catalogo unico de codigos de error compartido entre backend, workers y frontend.
- Distincion obligatoria `retryable=true/false`.
- Mensaje tecnico en logs + mensaje amigable para usuario.
- Reintentos solo para errores transitorios (timeout, 429, red, broker).
- Registro de causa raiz al marcar `evaluation.status = failed`.

## 5) Experiencia de usuario (UX) prioritaria

1. **Feedback inmediato**
   - Confirmar subida correcta y mostrar progreso real de procesamiento.

2. **Transparencia del estado**
   - Mostrar en que etapa esta la evaluacion y tiempo estimado.

3. **Recuperacion ante error**
   - Botones de reintento (`re-subir`, `reprocesar`) cuando sea seguro.
   - Mensajes por escenario: permisos camara/microfono, red, video invalido, timeout.

4. **Valor de negocio visible**
   - Recomendaciones accionables con prioridad y metrica de mejora sugerida.

5. **Accesibilidad y usabilidad base**
   - Formularios con validacion clara, foco visible, estados disabled/loading y textos consistentes.

## 6) Backlog inmediato sugerido (sprint tecnico)

- [ ] Definir y publicar contrato unico API + eventos + errores.
- [ ] Implementar `/api/questions` en FastAPI y testear contrato.
- [ ] Elegir y consolidar una sola aplicacion frontend oficial para build/deploy.
- [ ] Estandarizar errores en gateway y workers con catalogo comun.
- [ ] Activar CI real (lint + tests + build) en `api-gateway`, `ai-workers`, `frontend`.
- [ ] Agregar dashboard de salud operativa con metricas minimas.
- [ ] Actualizar documentacion canonica para reflejar el estado real sin contradicciones.

## 7) Criterio de salida: "listo para siguiente etapa"

El proyecto se considera robusto para avanzar cuando cumpla:

- Vertical slice E2E estable (3 corridas consecutivas exitosas).
- Contrato de errores unificado funcionando en backend/workers/frontend.
- CI obligatoria en verde para merge.
- Trazabilidad completa por `evaluation_id` de punta a punta.
- UX con estados de progreso y recuperacion de errores implementados.
