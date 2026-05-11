# Pose Worker (`ai-workers/pose`)

Worker de procesamiento de lenguaje corporal para Jupiter.

Refactor principal del detector original: `pose_worker/pose_detector.py`.

## Que hace

1. Consume jobs de RabbitMQ en `pose.jobs`.
2. Descarga el video desde `s3://...`, URL HTTP(s) o archivo local.
3. Procesa el video frame a frame con MediaPipe Pose.
4. Extrae features por segmentos de `N` segundos:
   - postura (apertura, inclinacion de hombros, inclinacion de torso),
   - gestos de manos (frecuencia y amplitud),
   - contacto visual estimado (yaw/pitch de cabeza),
   - variabilidad de pose.
5. Publica el resultado en `features.results`.
6. Persiste el JSON en tabla `public.features` con `kind='pose'`.

## Contrato de entrada (`pose.jobs`)

```json
{
  "job_id": "uuid",
  "evaluation_id": "uuid",
  "tenant_id": "uuid",
  "video_url": "s3://videos/tenant/evaluation.webm",
  "options": {
    "segment_seconds": 5
  }
}
```

## Contrato de salida (`features.results`)

```json
{
  "event": "feature.ready",
  "status": "ok",
  "worker": "pose-worker",
  "job_id": "...",
  "evaluation_id": "...",
  "tenant_id": "...",
  "kind": "pose",
  "generated_at": "2026-05-05T19:14:10.901297+00:00",
  "payload": {
    "schema_version": "1.0.0",
    "kind": "pose",
    "segment_seconds": 5,
    "video": { "fps": 30.0, "duration_seconds": 61.2, "width": 1280, "height": 720, "frame_count": 1836, "processed_frames": 1836 },
    "segments": [],
    "summary": {}
  }
}
```

En caso de error, publica:

```json
{
  "event": "feature.error",
  "status": "error",
  "worker": "pose-worker",
  "kind": "pose",
  "error": { "code": "VIDEO_CORRUPT", "message": "..." }
}
```

## Variables de entorno

### RabbitMQ
- `RABBITMQ_HOST` (default: `localhost`)
- `RABBITMQ_PORT` (default: `5672`)
- `RABBITMQ_USER` (default: `guest`)
- `RABBITMQ_PASS` (default: `guest`)
- `RABBITMQ_VHOST` (default: `/`)
- `POSE_JOBS_QUEUE` (default: `pose.jobs`)
- `FEATURES_RESULTS_QUEUE` (default: `features.results`)

### Base de datos
- `DATABASE_URL` (obligatoria)

### Storage (S3/MinIO)
- `S3_ENDPOINT_URL` (vacia para AWS S3)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (default: `us-east-1`)

### Pose
- `POSE_SEGMENT_SECONDS` (default: `5`)
- `POSE_MAX_VIDEO_SECONDS` (default: `600`)
- `POSE_SHOULDER_OPEN_THRESHOLD` (default: `0.16`)
- `POSE_DETECTION_CONFIDENCE` (default: `0.5`)
- `POSE_TRACKING_CONFIDENCE` (default: `0.5`)
- `POSE_EYE_CONTACT_YAW_THRESHOLD` (default: `0.35`)
- `POSE_HAND_MOTION_THRESHOLD` (default: `0.08`)

## Ejecucion local

```bash
cd ai-workers/pose
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m pose_worker.main
```

## Tests

```bash
cd ai-workers/pose
python -m pytest tests -v
```

## Scripts utiles

- Procesar un video local sin RabbitMQ/DB:

```bash
cd ai-workers/pose
python scripts/run_local_pose.py --video /ruta/video.webm --output pose_output.json
```

- Publicar un job de prueba en `pose.jobs`:

```bash
cd ai-workers/pose
python scripts/publish_pose_job.py \
  --video-url /ruta/video.webm \
  --evaluation-id 11111111-1111-1111-1111-111111111111 \
  --tenant-id 22222222-2222-2222-2222-222222222222
```

- Leer 1 mensaje de `features.results`:

```bash
cd ai-workers/pose
python scripts/read_feature_result.py --ack
```
