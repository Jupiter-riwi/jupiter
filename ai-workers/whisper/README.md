# Whisper Worker (`ai-workers/whisper`)

Worker responsable de transcribir videos usando OpenAI Whisper.

## Flujo

1. Consume jobs de RabbitMQ (`whisper.jobs`).
2. Descarga el video desde S3/MinIO o URL HTTP.
3. Valida duracion maxima (8 minutos por defecto).
4. Extrae el audio con `ffmpeg` a WAV 16 kHz mono.
5. Si el audio supera `WHISPER_CHUNK_SECONDS`, lo divide en chunks y transcribe en paralelo.
6. Llama a OpenAI Whisper (`whisper-1`) con `response_format=verbose_json`.
7. Publica el resultado en `features.results` (`kind='transcript'`).
8. Persiste el JSON en la tabla `public.features` (`kind='transcript'`).

## Contrato de entrada (`whisper.jobs`)

```json
{
  "job_id": "uuid",
  "evaluation_id": "uuid",
  "tenant_id": "uuid",
  "video_url": "s3://videos/tenant/evaluation.webm",
  "options": {
    "language": "es",
    "prompt": "palabras clave del guion"
  }
}
```

## Contrato de salida (`features.results`)

```json
{
  "event": "feature.ready",
  "status": "ok",
  "worker": "whisper-worker",
  "job_id": "...",
  "evaluation_id": "...",
  "tenant_id": "...",
  "kind": "transcript",
  "generated_at": "2026-05-05T20:31:10.123456+00:00",
  "payload": {
    "schema_version": "1.0.0",
    "kind": "transcript",
    "text": "texto completo",
    "language": "es",
    "duration_seconds": 120.5,
    "segments": [
      {
        "id": 0,
        "start": 0.0,
        "end": 5.1,
        "text": "hola a todos",
        "words": [
          {"word": "hola", "start": 0.0, "end": 0.6},
          {"word": "a", "start": 0.6, "end": 0.7}
        ]
      }
    ],
    "summary": {
      "segments_count": 12,
      "words_total": 180
    }
  }
}
```

Errores se notifican como `feature.error` con `kind='transcript'`.

Codigos de error relevantes:

- `AUDIO_SILENT`: el audio extraido no tiene energia suficiente (sin voz).
- `AUDIO_EXTRACTION_ERROR`: `ffmpeg` no pudo extraer audio (archivo corrupto/no valido).
- `VIDEO_TOO_LONG`: la duracion excede `WHISPER_MAX_VIDEO_SECONDS`.

## Variables de entorno

- `OPENAI_API_KEY` (obligatoria)
- `OPENAI_API_BASE` (opcional, para proxies)
- `WHISPER_MODEL` (`whisper-1` por defecto)
- `WHISPER_LANGUAGE` (default: detecta automaticamente)
- `WHISPER_TEMPERATURE` (default: 0.0)
- `FFMPEG_BIN` (default: `ffmpeg` en el PATH)
- `WHISPER_AUDIO_FORMAT` (default: `wav`)
- `WHISPER_TEMP_DIR` (default: `/tmp/jupiter-whisper`)
- `WHISPER_MAX_VIDEO_SECONDS` (default: `600` = 10 min)
- `WHISPER_CHUNK_SECONDS` (default: `120`)
- `WHISPER_PARALLEL_REQUESTS` (default: `2`)
- `WHISPER_WORD_TIMESTAMPS` (default: `false`, mejora latencia)
- RabbitMQ / Postgres / S3: mismos valores que otros workers.

## Ejecutar localmente

```bash
cd ai-workers/whisper
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export OPENAI_API_KEY=tu_key
python scripts/run_local_whisper.py --video /ruta/video.mp4 --output transcript.json
```

## Tests

```bash
cd ai-workers/whisper
python -m pytest tests -v
```

## Scripts

- `scripts/run_local_whisper.py`: procesa un video local y genera un JSON con el transcript.
- `scripts/publish_whisper_job.py`: publica un job en la cola `whisper.jobs`.
- `scripts/read_feature_result.py`: lee un mensaje de `features.results` (util para smoke tests locales).

Nota sobre conteo de palabras:

- Si Whisper no devuelve `segments[].words`, `words_total` se estima desde `text` para evitar cero falso.
