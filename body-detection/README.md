# body-detection (código fuente / referencia)

> **Esta carpeta es el POC original de detección de postura. NO es código de producción.**
>
> El código de producción va en:
> - `ai-workers/pose/` — Pose Worker (refactor de `backend/pose_detector.py`)
> - `ai-workers/whisper/` — Whisper Worker
>
> Ver `docs/TEAM.md` → Dev 1 para los entregables concretos.

---

## Qué hay acá

| Carpeta/archivo | Descripción |
|---|---|
| `backend/pose_detector.py` | Detector de postura con MediaPipe — **base para `ai-workers/pose/`** |
| `backend/config.py` | Configuración (thresholds, backends, FPS) |
| `backend/utils.py` | Utilidades de procesamiento de frames |
| `backend/main.py` | Entry point del servidor (loop de cámara en vivo) |
| `src/` | Componentes React (EvaluationRoom, EvaluationPage) — referencia para `frontend/` |
| `models/` | Modelo MediaPipe `.task` — **no versionado**, descargar abajo |

## Cómo descargar el modelo

```bash
cd body-detection/backend/models/
curl -O https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task
```

## POC vs Worker de producción

| POC (este código) | Worker de producción (`ai-workers/pose/`) |
|---|---|
| Lee de cámara en vivo (`cv2.VideoCapture(0)`) | Recibe path/URL de video desde RabbitMQ |
| Loop interactivo | Worker consumidor sin estado interactivo |
| Sin integración con DB/cola | Persiste en Postgres, publica en RabbitMQ |
| Sin multi-tenancy | Incluye `tenant_id` en cada operación |
