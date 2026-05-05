# Documentación Técnica — AI Workers (Dev 2)

> **Owner:** Dev 2 — Prosody & Scoring Workers  
> **Última actualización:** 2026-05-05  
> **Dependencias:** Dev 1 (pose, transcript schemas), Dev 3 (Postgres, RabbitMQ tópicos, WebSocket)

---

## 1. Arquitectura de Workers (Dev 2)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        RabbitMQ (pika)                                │
│                                                                       │
│  prosody.jobs ──────────► Prosody Worker (:8001)                      │
│  scoring.jobs ──────────► Scoring Worker (:8002)                      │
│                                                                       │
│  ◄── features.results (topic exchange "features")                     │
│  ◄── score.ready      (topic exchange "scores")                       │
└──────────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
   ┌──────────┐                  ┌──────────────┐
   │ librosa  │                  │ OpenAI GPT-4o│
   │ (local)  │                  │ (API HTTP)   │
   └──────────┘                  └──────────────┘
```

Ambos workers siguen el mismo patrón del template `ai-workers/`:
- **FastAPI** con `lifespan` que arranca un hilo daemon de consumo RabbitMQ
- **pika** BlockingConnection en hilo secundario (no interfiere con el event loop de uvicorn)
- **ACK manual** con `basic_ack` / `basic_nack` para control granular de errores
- **prefetch_count=1** (fair dispatch, un mensaje a la vez por worker)
- **Exchange `topic`** para publicación de resultados (no colas directas)

---

## 2. Prosody Worker — `ai-workers/prosody/`

### 2.1 Estructura de archivos

```
prosody/
├── __init__.py          # package marker
├── analyzer.py          # Core: extracción de features con librosa
├── worker.py            # Consumer: loop RabbitMQ + callback on_prosody_job
├── rabbitmq.py          # Conexión pika (cola prosody.jobs)
├── main.py              # App FastAPI + lifespan + /health
├── Dockerfile           # Imagen Python 3.12-slim + libsndfile + ffmpeg
└── tests/
    ├── __init__.py
    └── test_analyzer.py # 9 tests unitarios con audio sintético
```

### 2.2 Flujo de procesamiento

```
[JSON en prosody.jobs]
       │
       ▼
  on_prosody_job()
       │
       ├── 1. Decodifica JSON del body
       ├── 2. Extrae: job_id, evaluation_id, tenant_id, audio_url, transcript (opcional)
       ├── 3. Llama a analyze_audio(audio_path, transcript, lang)
       │        │
       │        ├── 3a. librosa.load() → señal y + sample rate
       │        ├── 3b. librosa.pyin() → pitch F0 (rango C2-C7)
       │        │        └── mediana y varianza sobre frames voiced
       │        ├── 3c. librosa.feature.rms() → energía RMS
       │        │        └── mediana y pico máximo
       │        ├── 3d. librosa.effects.split(top_db=30) → segmentos no-silentes
       │        │        └── gaps > 500ms → silent_duration acumulado
       │        │        └── pause_ratio = silent_duration / total_duration
       │        ├── 3e. Si hay transcript:
       │        │        └── WPM = (word_count / duration_seconds) * 60
       │        │        └── detect_filler_words(transcript, lang)
       │        │              ├── Tokenización: split por espacios
       │        │              ├── Match contra diccionario FILLER_WORDS[lang]
       │        │              └── Frases multi-palabra: count de ocurrencias en texto
       │        └── 3f. Retorna dataclass ProsodyFeatures
       │
       ├── 4. persist_features() → genera UUID, loggea payload (stub)
       ├── 5. Publica resultado en exchange "features" routing_key "features.results"
       └── 6. basic_ack()
```

### 2.3 Modelo de salida: `ProsodyFeatures`

```python
@dataclass
class ProsodyFeatures:
    pitch_median: float           # Hz (mediana de F0 en frames voiced)
    pitch_variance: float         # Hz² (varianza de F0)
    energy_median: float          # RMS normalizado (0.0 - 1.0 típicamente)
    energy_peak: float            # RMS máximo en el segmento
    words_per_minute: float       # 0.0 si no hay transcript
    pause_ratio: float            # 0.0 - 1.0, proporción de silencio >500ms
    filler_word_count: int        # total de muletillas encontradas
    filler_words: list[str]       # lista plana de palabras/frases detectadas
    duration_seconds: float       # duración real del audio
    transcript_word_count: int    # 0 si no hay transcript
    sample_rate: int              # Hz del audio cargado
```

**Formato JSON de salida** (vía `to_dict()`):

```json
{
  "pitch": {"median": 185.42, "variance": 1250.33},
  "energy": {"median": 0.0231, "peak": 0.4512},
  "words_per_minute": 142.5,
  "pause_ratio": 0.083,
  "filler_words": {"count": 4, "words": ["eh", "mmm", "este", "o sea"]},
  "duration_seconds": 45.32,
  "transcript_word_count": 108,
  "sample_rate": 22050
}
```

### 2.4 Detección de muletillas

**Algoritmo:** Búsqueda exacta sobre texto lowercase tokenizado.

```python
FILLER_WORDS = {
    "es": {"eh", "este", "mmm", "ah", "bueno", "pues", "entonces",
           "digamos", "o sea", "como que", "realmente", "básicamente", "sabes"},
    "en": {"um", "uh", "like", "you know", "i mean", "so", "actually",
           "basically", "right", "well", "hmm", "er"},
}
```

- **Palabras simples**: token-match directo contra `set` del idioma
- **Frases multi-palabra** (ej: `"o sea"`): búsqueda con `str.count()` sobre el texto completo (no tokenizado) para capturar bigramas contiguos
- Si `transcript` no se provee en el job, `filler_word_count = 0` y `wpm = 0`

### 2.5 Parámetros de análisis (hardcodeados)

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `fmin` / `fmax` | C2 (65.4 Hz) / C7 (2093 Hz) | Rango de pitch humano |
| `top_db` | 30 | Umbral para split silencio/voz |
| `hop_length` | 512 samples | Ventana de análisis (23 ms @ 22 kHz) |
| `threshold_silence` | 500 ms | Mínimo para contar como pausa |
| `sr` | None (nativo) | librosa.load conserva sample rate original |

### 2.6 Contratos RabbitMQ

**Cola de entrada:** `prosody.jobs` (durable)

```json
{
  "job_id": "uuid",
  "evaluation_id": "uuid",
  "tenant_id": "uuid",
  "audio_url": "s3://bucket/path.wav",
  "transcript": "texto completo opcional...",
  "options": {}
}
```

**Exchange de salida:** `features` (topic, durable)  
**Routing key:** `features.results`

```json
{
  "job_id": "uuid",
  "evaluation_id": "uuid",
  "feature_id": "uuid",
  "tenant_id": "uuid",
  "kind": "prosody",
  "payload": { ... },
  "processed_at": "2026-05-05T12:00:00Z"
}
```

### 2.7 Manejo de errores

| Error | Comportamiento |
|-------|---------------|
| JSON inválido en body | `basic_nack(requeue=False)` — descarta |
| `audio_url` vacío | `basic_nack(requeue=False)` — descarta |
| `FileNotFoundError` (audio no existe) | `basic_nack(requeue=False)` — no reintenta |
| Error durante `analyze_audio()` | `basic_nack(requeue=False)`, loggea traceback completo |
| Error publicando resultado | Loggea warning, pero el job se considera completado (ACK) |
| `AMQPConnectionError` en consumer loop | Reintenta conexión cada 5s, reconexión infinita |

---

## 3. Scoring Worker — `ai-workers/scoring/`

### 3.1 Estructura de archivos

```
scoring/
├── __init__.py          # package marker
├── models.py            # Pydantic: ScoreResult, DimensionScore, Recommendation, ScoringJob
├── llm.py               # Cliente GPT-4o + prompt builder + retry
├── worker.py            # Consumer: loop RabbitMQ + callback on_scoring_job
├── rabbitmq.py          # Conexión pika (cola scoring.jobs, exchange scores)
├── main.py              # App FastAPI + lifespan + /health
├── Dockerfile           # Imagen Python 3.12-slim
├── prompts/
│   └── v1.md            # Prompt versionado (template con placeholders {{...}})
└── tests/
    ├── __init__.py
    └── test_scoring.py  # 11 tests: modelos, prompts, edge cases
```

### 3.2 Flujo de procesamiento

```
[JSON en scoring.jobs]
       │
       ▼
  on_scoring_job()
       │
       ├── 1. Decodifica JSON, valida con ScoringJob (Pydantic)
       ├── 2. fetch_features(evaluation_id) → dict con pose + transcript + prosody
       │        └── [STUB] Retorna diccionarios placeholder
       │        └── [PENDIENTE] Leer de Postgres features WHERE evaluation_id + kind
       ├── 3. build_prompt(pose, transcript, prosody)
       │        └── Carga v1.md del disco
       │        └── Reemplaza {{pose_features}}, {{transcript_features}}, {{prosody_features}}
       │        └── Cada placeholder se reemplaza con JSON.dumps(features, indent=2)
       ├── 4. call_gpt4o(prompt)
       │        │
       │        ├── 4a. POST https://api.openai.com/v1/chat/completions
       │        │        └── model: gpt-4o
       │        │        └── response_format: {"type": "json_object"}
       │        │        └── temperature: 0.3
       │        │        └── max_tokens: 2000
       │        │        └── system: "Eres un coach de ventas. Responde solo con JSON válido."
       │        │
       │        ├── 4b. Si HTTP 200:
       │        │        └── Extrae content de choices[0].message.content
       │        │        └── json.loads() → dict
       │        │        └── ScoreResult.model_validate(dict) → validación Pydantic
       │        │        └── Loggea tokens in/out desde usage
       │        │
       │        └── 4c. Si falla (HTTP error, JSON inválido, validación Pydantic):
       │                 └── Retry con backoff: 2s, luego 4s (máx. 2 reintentos)
       │                 └── Si agotados los 3 intentos totales → lanza excepción
       │
       ├── 5. persist_score() → genera UUID, loggea payload (stub)
       ├── 6. publish_score_ready() → exchange "scores", routing_key "score.ready"
       └── 7. basic_ack()
```

### 3.3 Modelos Pydantic (validación estricta)

```python
class DimensionScore(BaseModel):
    score: int = Field(ge=0, le=100)     # validación de rango automática
    evidence: str

class Recommendation(BaseModel):
    priority: str                          # validado en field_validator
    tip: str
    drill: str
    # priority solo acepta: "high", "medium", "low"

class ScoreResult(BaseModel):
    overall: int = Field(ge=0, le=100)
    dimensions: dict[str, DimensionScore] # exactamente 5 keys requeridas
    recommendations: list[Recommendation]
    # dimensiones requeridas: confianza, claridad, lenguaje_corporal,
    #                         ritmo_voz, escucha_activa

class ScoringJob(BaseModel):
    job_id: str
    evaluation_id: str
    tenant_id: str
```

**Validaciones implementadas en `field_validator`:**
- `DimensionScore.score`: 0 ≤ score ≤ 100 (automático por `ge=0, le=100`)
- `Recommendation.priority`: rechaza cualquier valor fuera de {high, medium, low}
- `ScoreResult.dimensions`: rechaza si faltan o sobran dimensiones de las 5 requeridas
- `ScoringJob`: rechaza si falta `evaluation_id` o `tenant_id` (campos required)

### 3.4 Estrategia de reintentos (`llm.py`)

```
Intento 1 ──► ¿excepción? ──SÍ──► esperar 2s ──► Intento 2
                                        │
                                      ¿excepción?
                                        │
                                  SÍ ───┴──► esperar 4s ──► Intento 3
                                        │                      │
                                      NO                      │
                                       │                ¿excepción?
                                    return                   │
                                                        SÍ ──► raise
```

**Política de reintentos:**
- Solo se reintenta si OpenAI responde pero el JSON no valida con Pydantic
- Si `OPENAI_API_KEY` no está configurada → `ValueError` directo, sin reintentos
- Si OpenAI devuelve HTTP error → `RuntimeError`, sin reintentos (error de API, no de contenido)
- Máximo 3 intentos totales (intento original + 2 retries)

### 3.5 Cliente OpenAI (`_call_openai_json`)

Implementado con `urllib.request` de la stdlib (sin dependencia `openai`):
- Endpoint: `POST https://api.openai.com/v1/chat/completions`
- Timeout: 60 segundos
- No usa streaming
- `response_format: {"type": "json_object"}` garantiza que GPT-4o devuelva JSON sintácticamente válido
- Los tokens usados se extraen de `response["usage"]` y se loggean

### 3.6 Prompt versionado

**Ubicación:** `scoring/prompts/v1.md`  
**Sistema de versionado:** Archivos markdown en directorio `prompts/`.  
**Cambios al prompt:** Requieren PR revisable (criterio de aceptación HU-2.2).

**Estructura del prompt:**
1. Rol: "Eres un coach de ventas experto"
2. Contexto: Describe los 3 tipos de features que recibe
3. Tarea: Evalúa 5 dimensiones (0-100 cada una) con evidence
4. Formato de salida: Ejemplo JSON exacto que debe seguir
5. Placeholders: `{{pose_features}}`, `{{transcript_features}}`, `{{prosody_features}}`

**5 dimensiones definidas:**

| Dimensión | Qué mide | Features que consulta |
|-----------|----------|----------------------|
| `confianza` | Seguridad, autoridad | Energía vocal, postura, pausas, muletillas |
| `claridad` | Estructura, comprensión | WPM, organización del transcript |
| `lenguaje_corporal` | Gestos, presencia | Movimiento manos, cabeza, variabilidad pose |
| `ritmo_voz` | Fluidez, velocidad | WPM, ratio pausas, varianza pitch |
| `escucha_activa` | Empatía, preguntas | Preguntas en transcript, pausas |

### 3.7 Contratos RabbitMQ

**Cola de entrada:** `scoring.jobs` (durable)

```json
{
  "job_id": "uuid",
  "evaluation_id": "uuid",
  "tenant_id": "uuid"
}
```

**Exchange de salida:** `scores` (topic, durable)  
**Routing key:** `score.ready`

```json
{
  "type": "score.ready",
  "evaluation_id": "uuid",
  "tenant_id": "uuid",
  "score_id": "uuid",
  "overall": 78,
  "dimensions": {
    "confianza": {"score": 82, "evidence": "postura erguida y voz firme"},
    "claridad": {"score": 75, "evidence": "estructura AIDA en introducción"},
    "lenguaje_corporal": {"score": 70, "evidence": "gestos moderados, contacto visual intermitente"},
    "ritmo_voz": {"score": 80, "evidence": "WPM 140, pausas bien distribuidas"},
    "escucha_activa": {"score": 65, "evidence": "solo 1 pregunta en toda la presentación"}
  },
  "recommendations": [
    {"priority": "high", "tip": "Incrementa el contacto visual", "drill": "Grábate mirando a la cámara 2 min/día"},
    {"priority": "medium", "tip": "Añade preguntas abiertas", "drill": "Prepara 3 preguntas antes de cada presentación"}
  ],
  "completed_at": "2026-05-05T12:00:00Z"
}
```

### 3.8 Manejo de errores

| Error | Comportamiento |
|-------|---------------|
| JSON inválido en body | `basic_nack(requeue=False)` |
| Falta `evaluation_id` o `tenant_id` | `basic_nack(requeue=False)` |
| `OPENAI_API_KEY` no configurada | `basic_nack(requeue=False)` — no reintenta |
| OpenAI devuelve HTTP error | `basic_nack(requeue=False)` — error de API, no de datos |
| JSON de OpenAI no valida con Pydantic | Hasta 2 retries con backoff; si falla → `basic_nack(requeue=False)` |
| Error publicando `score.ready` | Se loggea, pero el score ya está persistido (ACK igual) |
| `AMQPConnectionError` en loop | Reconexión cada 5s, infinita |

---

## 4. Configuración de despliegue

### 4.1 Docker Compose (`ai-workers/docker-compose.yml`)

Tres servicios:
1. **rabbitmq** — RabbitMQ 3.13 con management UI en `:15672`
2. **prosody** — Puerto `:8001`, Dockerfile en `prosody/Dockerfile`
3. **scoring** — Puerto `:8002`, Dockerfile en `scoring/Dockerfile`, requiere `OPENAI_API_KEY`

**Build context:** `ai-workers/` (raíz del monorepo de workers) para todos los Dockerfiles, porque comparten `requirements.txt` y código de paquete.

### 4.2 Variables de entorno

| Variable | Default | Usada por | Descripción |
|----------|---------|-----------|-------------|
| `RABBITMQ_HOST` | `localhost` | Ambos | Host del broker |
| `RABBITMQ_PORT` | `5672` | Ambos | Puerto AMQP |
| `RABBITMQ_USER` | `guest` | Ambos | Usuario RabbitMQ |
| `RABBITMQ_PASS` | `guest` | Ambos | Password RabbitMQ |
| `RABBITMQ_VHOST` | `/` | Ambos | Virtual host |
| `PROSODY_QUEUE` | `prosody.jobs` | Prosody | Nombre de la cola de entrada |
| `SCORING_QUEUE` | `scoring.jobs` | Scoring | Nombre de la cola de entrada |
| `OPENAI_API_KEY` | — | Scoring | API key de OpenAI (requerida) |

### 4.3 Health checks

**Prosody Worker** (`GET :8001/health`):
```json
{
  "status": "ok",
  "service": "apex-vision-prosody-worker",
  "rabbitmq": "ok",
  "queue": "prosody.jobs",
  "messages_in_queue": 3
}
```

**Scoring Worker** (`GET :8002/health`):
```json
{
  "status": "ok",
  "service": "apex-vision-scoring-worker",
  "rabbitmq": "ok",
  "queue": "scoring.jobs",
  "messages_in_queue": 0
}
```

Ambos endpoints verifican conectividad con RabbitMQ (abren conexión, declaran cola en modo pasivo, consultan `message_count`). Si RabbitMQ no responde → HTTP 503 con `status: "degraded"`.

### 4.4 Comandos de arranque

```bash
# Desde ai-workers/
docker compose up --build

# Sin Docker (desarrollo local, requiere RabbitMQ corriendo en localhost:5672)
pip install -r requirements.txt
export OPENAI_API_KEY="sk-..."

# Terminal 1: Prosody Worker
uvicorn prosody.main:app --reload --port 8001

# Terminal 2: Scoring Worker
uvicorn scoring.main:app --reload --port 8002
```

---

## 5. Tests

### 5.1 Prosody Worker — 9 tests en `prosody/tests/test_analyzer.py`

**Framework:** pytest  
**Fixtures:** Audio sintético generado con `numpy` + `soundfile` (sin archivos externos)

| Clase | Test | Qué verifica |
|-------|------|-------------|
| `TestFillerWords` | `test_detect_spanish_fillers` | Detecta "eh", "mmm", "este", "realmente" en texto ES |
| | `test_detect_english_fillers` | Detecta "um", "like", "basically" en texto EN |
| | `test_no_fillers_returns_empty` | Transcript limpio → lista vacía |
| | `test_multi_word_fillers` | Detecta frases: "o sea", "como que" |
| `TestAnalyzeAudio` | `test_analyze_short_sine` | Audio senoidal 440 Hz: verifica duración, wpm=0 |
| | `test_analyze_with_transcript` | Con transcript: verifica word_count, wpm>0, fillers≥2 |
| | `test_analyze_silence` | Silencio puro: energy_peak < 0.001 |
| | `test_analyze_speech_like_expects_pause_ratio` | Audio con gaps: pause_ratio > 0 |
| `TestOutputContract` | `test_to_dict_has_required_keys` | Verifica estructura JSON: pitch, energy, wpm, pause_ratio, filler_words |
| | `test_to_dict_is_json_serializable` | `json.dumps()` no lanza excepción |
| `TestErrorHandling` | `test_missing_file_raises` | `FileNotFoundError` con path inexistente |

### 5.2 Scoring Worker — 11 tests en `scoring/tests/test_scoring.py`

| Clase | Test | Qué verifica |
|-------|------|-------------|
| `TestModels` | `test_score_result_valid` | ScoreResult con 5 dimensiones y 2 recomendaciones |
| | `test_score_result_missing_dimension_raises` | Falta dimensión → ValueError |
| | `test_score_result_extra_dimension_raises` | Dimensión extra → ValueError |
| | `test_score_out_of_range_raises` | overall=150 → ValueError |
| | `test_invalid_priority_raises` | priority="urgent" → ValueError |
| | `test_scoring_job_model` | ScoringJob con campos requeridos |
| | `test_dimension_score_range` | score=-1 y score=101 → ValueError |
| `TestPrompt` | `test_load_prompt_v1_exists` | Carga v1.md, verifica contenido |
| | `test_load_prompt_nonexistent_raises` | v999.md → FileNotFoundError |
| | `test_build_prompt_replaces_placeholders` | Placeholders reemplazados por JSON real |
| `TestSerialization` | `test_score_result_model_dump_is_json_serializable` | model_dump() → json.dumps() sin error |
| `TestEdgeCases` | `test_empty_recommendations` | recommendations=[] → válido |
| | `test_boundary_scores` | overall=0 y overall=100 → ambos válidos |

### 5.3 Tests de fixtures — 7 tests en `scoring/tests/test_fixtures.py`

| Clase | Test | Qué verifica |
|-------|------|-------------|
| `TestFixturesLoad` | `test_all_fixtures_exist` | Al menos 3 archivos JSON en `fixtures/` |
| | `test_vendedor_solido_has_all_sections` | JSON tiene pose, transcript, prosody, expected_overall_range |
| | `test_vendedor_nervioso_has_all_sections` | JSON tiene las 3 secciones de features |
| | `test_vendedor_monotono_has_all_sections` | JSON tiene las 3 secciones de features |
| `TestPromptWithFixtures` | `test_build_prompt_from_vendedor_solido` | Prompt > 500 chars, contiene datos reales del fixture |
| | `test_build_prompt_from_vendedor_nervioso` | Prompt contiene filler_words del fixture |
| | `test_build_prompt_from_vendedor_monotono` | Prompt contiene pitch del fixture |
| `TestFixturePayloadsValidForScoreResult` | `test_vendedor_solido_prosody_valid` | Prosody del fixture tiene estructura correcta |

**Total tests: 9 (prosody) + 11 (scoring models) + 7 (fixtures) = 27 tests**

### 5.4 Script de evaluación de prompts (`scripts/prompt_eval.py`)

Script standalone para probar el prompt de scoring contra GPT-4o real usando los fixtures.

```bash
# Desde ai-workers/, requiere OPENAI_API_KEY
python scripts/prompt_eval.py                              # fixture por defecto: vendedor_solido
python scripts/prompt_eval.py --fixture vendedor_nervioso  # fixture específico
python scripts/prompt_eval.py --fixture vendedor_monotono --output result.json
```

El script:
1. Carga el fixture JSON
2. Construye el prompt con `build_prompt()`
3. Llama a GPT-4o con `call_gpt4o()`
4. Imprime el resultado en consola
5. Compara el `overall` obtenido contra `expected_overall_range` del fixture
6. Opcionalmente guarda a archivo con `--output`

### 5.5 Ejecución de tests

```bash
# Todos los tests
cd ai-workers
python -m pytest prosody/tests/ scoring/tests/ -v

# Solo prosody
python -m pytest prosody/tests/ -v

# Solo scoring
python -m pytest scoring/tests/ -v
```

---

## 6. Dependencias Python

| Paquete | Versión | Propósito | Worker |
|---------|---------|-----------|--------|
| `fastapi` | 0.111.0 | Framework web + /health | Ambos |
| `uvicorn[standard]` | 0.29.0 | Servidor ASGI | Ambos |
| `pika` | 1.3.2 | Cliente RabbitMQ (Bloqueante) | Ambos |
| `librosa` | 0.10.2 | Análisis de audio (pitch, RMS, split) | Prosody |
| `numpy` | ≥1.26, <2 | Operaciones numéricas (median, var) | Prosody |
| `soundfile` | ≥0.12 | Lectura/escritura de WAV (tests) | Prosody |
| `audioread` | ≥0.3 | Fallback de carga de audio | Prosody |
| `pydantic` | ≥2.0 | Validación de modelos JSON | Scoring |
| `psycopg2-binary` | ≥2.9 | Persistencia en Postgres (features, scores) | Ambos |
| `pytest` | ≥8.0 | Framework de testing | Ambos |

**Dependencias del sistema (Docker):**
- `libsndfile1` — Requerido por `soundfile` para leer/escribir WAV
- `ffmpeg` — Requerido por `audioread` como backend de decodificación

**Sin dependencias externas:** El cliente OpenAI usa `urllib.request` de stdlib — no requiere `openai` pip package.

---

## 7. Pendientes (integración con otros Devs)

### 7.1 Bloqueados por Dev 3

| Item | Estado actual | Qué falta |
|------|---------------|-----------|
| Tabla `features` en Postgres | Código listo (`shared/db.py:40 — insert_features`) | Dev 3 debe ejecutar migraciones Alembic para crear la tabla |
| Tabla `scores` en Postgres | Código listo (`shared/db.py:103 — insert_score`) | Dev 3 debe ejecutar migraciones Alembic para crear la tabla |
| Consumir `score.ready` | Scoring worker publica en exchange `scores`, routing key `score.ready` | Dev 3 debe escuchar y forwardear por WebSocket al frontend |
| Fan-in trigger | Scoring worker hace `requeue=True` si features incompletos | Dev 3 debe implementar el trigger que publica `scoring.jobs` (counter u orquestador) |

### 7.2 Bloqueados por Dev 1

| Item | Descripción |
|------|-------------|
| Schema de `pose_features` | El prompt de scoring y los fixtures asumen campos como `posture_openness`, `hand_gesture_frequency`, etc. — Dev 1 debe definir el contrato real |
| Schema de `transcript_features` | El prompt asume `full_text`, `segments[].text`, `word_count`, `questions_asked` — Dev 1 debe confirmar o ajustar |

### 7.3 Mejoras futuras (fuera de MVP)

- **Prompt multilingüe**: Actualmente el prompt está en español. Si el producto es multi-idioma, crear `v1_en.md`, `v1_pt.md`, etc.
- **Calibración con feedback humano**: Iterar el prompt contra evaluaciones reales usando `scripts/prompt_eval.py` con los 3 fixtures
- **Métricas de costo**: El tracking de tokens ya está implementado (logging en `llm.py:50-55`), pero no se persiste en DB. Agregar campo `cost_tokens` a tabla `scores`
- **Paralelismo**: Si el volumen crece, los consumers pueden escalarse horizontalmente (múltiples instancias del mismo worker compitiendo por la misma cola con `prefetch_count=1`)

---

## 8. Infraestructura compartida

### 8.1 Módulo de persistencia — `shared/db.py`

Ubicación: `ai-workers/shared/db.py`  
Importado por ambos workers: `from shared.db import insert_features, fetch_features_by_evaluation, insert_score`

**Funciones públicas:**

| Función | Parámetros | Retorna | Descripción |
|---------|-----------|---------|-------------|
| `get_connection()` | — | `psycopg2.connection` | Abre conexión a Postgres usando `DATABASE_URL` |
| `insert_features(evaluation_id, tenant_id, kind, payload, conn?)` | `str, str, str, dict, Optional[conn]` | `feature_id: uuid` | INSERT en tabla `features`, genera UUID automático |
| `fetch_features_by_evaluation(evaluation_id, conn?)` | `str, Optional[conn]` | `dict[str, dict]` | SELECT de `features` WHERE evaluation_id, retorna `{kind: payload}` |
| `all_features_ready(evaluation_id, conn?)` | `str, Optional[conn]` | `bool` | True si pose, transcript Y prosody existen para esa evaluación |
| `insert_score(evaluation_id, tenant_id, overall, dimensions, recommendations, conn?)` | `str, str, int, dict, list[dict], Optional[conn]` | `score_id: uuid` | INSERT en tabla `scores` |

**Conexión:**
- `DATABASE_URL` se parsea con `urllib.parse.urlparse` — soporta formato `postgresql://user:pass@host:port/dbname`
- Las funciones aceptan `conn` opcional para transacciones; si no se provee, abren/cierran su propia conexión
- Default si no hay `DATABASE_URL`: `postgresql://apex_vision:apex_vision@localhost:5432/apex_vision`

### 8.2 Variables de entorno — `.env.example`

Ubicación: `ai-workers/.env.example`

| Variable | Default | Usada por |
|----------|---------|-----------|
| `RABBITMQ_HOST` | `localhost` | Ambos workers |
| `RABBITMQ_PORT` | `5672` | Ambos workers |
| `RABBITMQ_USER` | `guest` | Ambos workers |
| `RABBITMQ_PASS` | `guest` | Ambos workers |
| `RABBITMQ_VHOST` | `/` | Ambos workers |
| `PROSODY_QUEUE` | `prosody.jobs` | Prosody Worker |
| `SCORING_QUEUE` | `scoring.jobs` | Scoring Worker |
| `DATABASE_URL` | `postgresql://apex_vision:apex_vision@localhost:5432/apex_vision` | `shared/db.py` |
| `OPENAI_API_KEY` | — | Scoring Worker (requerido) |
| `S3_ENDPOINT` | `http://localhost:9000` | Futuro: descarga de audio/video |
| `S3_ACCESS_KEY` | `minioadmin` | Futuro |
| `S3_SECRET_KEY` | `minioadmin` | Futuro |
| `S3_BUCKET` | `apex-vision-videos` | Futuro |
| `S3_REGION` | `us-east-1` | Futuro |

### 8.3 `.gitignore` raíz

Ubicación: `.gitignore` (raíz del repo)  
Cubre: Python (`__pycache__/`, `.venv/`, `*.pyc`), Node (`node_modules/`), secrets (`.env`, `*.pem`), IDE (`.vscode/`, `.idea/`), OS (`.DS_Store`, `Thumbs.db`), Docker (`docker-compose.override.yml`), logs/temp.

### 8.4 Fixtures de scoring

Ubicación: `ai-workers/scoring/tests/fixtures/`

| Archivo | Escenario | Expected overall |
|---------|-----------|-----------------|
| `vendedor_solido.json` | Buen ritmo, postura abierta, pocas muletillas, 3 preguntas | 75 – 90 |
| `vendedor_nervioso.json` | 12 muletillas, postura cerrada, WPM 195, sin pausas | 35 – 55 |
| `vendedor_monotono.json` | Sin gestos, pitch plano, sin preguntas, discurso técnico | 40 – 60 |

Cada fixture contiene las 3 secciones (`pose`, `transcript`, `prosody`) con datos realistas que alimentan el prompt de scoring. Usar con `scripts/prompt_eval.py` para validar que GPT-4o produce scores dentro del rango esperado.

---

## 9. Referencias

- **Contratos compartidos:** `docs/TEAM.md` líneas 179-218
- **Arquitectura general:** `docs/ARCHITECTURE.md`
- **Historias de usuario:** `docs/HISTORIAS_USUARIO.md` (HU-2.1, HU-2.2)
- **Prompt de scoring:** `ai-workers/scoring/prompts/v1.md`
- **GitHub Issues:** [#4 HU-2.1](https://github.com/Jupiter-riwi/jupiter/issues/4), [#5 HU-2.2](https://github.com/Jupiter-riwi/jupiter/issues/5) (org/repo será renombrado a APEX-VISION/apex-vision)
