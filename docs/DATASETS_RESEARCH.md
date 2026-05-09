# Dataset Research · Jupiter Apex Vision

> Fecha: 2026-05-08
> Objetivo: identificar datasets para fine-tuning del scorer multimodal (audio + video) orientado a evaluación de pitches comerciales.

## 1. Criterios de evaluación

| Criterio | Mínimo aceptable |
|---|---|
| Licencia | Permisiva (MIT, Apache 2.0, CC-BY, CC0). Se descartan non-commercial / research-only. |
| Modalidad | Audio, video o multimodal alineado con caso de uso |
| Idioma | Español (prioritario) o multilingüe que incluya español |
| Tamaño | ≥ 1.000 muestras etiquetadas (tareas específicas) / ≥ 10.000 (generales) |
| Etiquetado | Etiquetas claras y consistentes (no solo transcripción) |
| Relevancia | Presentaciones, discursos, comunicación interpersonal, coaching |
| Documentación | Dataset card completa con origen, recolección y limitaciones |
| Sesgo | Sin sesgos evidentes que perjudiquen al público objetivo |

## 2. Tabla comparativa de candidatos en HuggingFace

| Dataset | Modalidad | Idioma | Muestras | Licencia | Cumple criterios |
|---|---|---|---|---|---|
| **MLCommons/peoples_speech** | audio + transcripción | inglés mayoritario | 30k+ horas | CC-BY-SA 4.0 | ⚠️ multimodal parcial · sin etiquetas de evaluación · idioma off-target |
| **ud-nlp/spanish-speech-recognition-dataset** | audio + transcripción | español | 488 horas / 600 hablantes | CC-BY 4.0 | ⚠️ solo ASR · sin etiquetas de calidad de comunicación |
| **UniDataPro/spanish-speech-recognition-dataset** | audio + transcripción | español | 300 horas | comercial paga | ❌ licencia no permisiva |
| **Macgence/general-utterances-speech-datasets-in-spanish** | audio | español | n/d | comercial paga | ❌ licencia no permisiva |
| **Nexdata/multi_language_conversation** | audio | multilingüe (incl. español) | 12k horas | comercial paga | ❌ licencia no permisiva |
| **AxonData/multilingual-call-center-speech-dataset** | audio + transcripción | 7 idiomas | 10k horas | comercial paga | ❌ licencia no permisiva |
| **declare-lab/MELD** | audio + video + texto | inglés | 13k utterances · 1.4k diálogos | GPL-3.0 / non-commercial restricciones | ❌ licencia restrictiva |
| **ajyy/MELD_audio** | audio | inglés | mismo MELD | misma restricción | ❌ |
| **FBK-MT/Speech-MASSIVE** | audio + intent | multilingüe (incl. español) | ~500k utterances | CC-BY-NC 4.0 | ❌ non-commercial |
| **FBK-MT/MCIF** | speech + vision + texto | en/de/it/zh | n/d | CC-BY-NC 4.0 | ❌ non-commercial · sin español |
| **Anthropic/persuasion** | texto (claims + arguments) | inglés | n/d | CC-BY 4.0 | ⚠️ sin audio/video · solo texto · útil como referencia para etiquetado |
| **ylacombe/google-chilean-spanish** | audio + transcripción | español (Chile) | n/d | CC-BY 4.0 | ⚠️ solo ASR · sin etiquetas de evaluación |
| **DataProvenanceInitiative/commercial_licenses** | metadata | n/a | n/a | CC-BY 4.0 | 📚 herramienta para validar licencias de otros datasets |

## 3. Conclusión

**Ningún dataset cumple los 8 criterios simultáneamente** para nuestro caso de uso (pitch comercial en español con etiquetas de calidad de comunicación + multimodalidad audio/video + licencia comercial).

### 3.1 Brechas detectadas
- Datasets de ASR español existen pero **no traen etiquetas de calidad** de comunicación (score, dimensiones, recomendaciones).
- Datasets multimodales de comunicación (MELD, MCIF) tienen licencia restrictiva o están en otros idiomas.
- No hay un dataset open de pitches comerciales evaluados.

## 4. Plan: dataset propio

Procedemos a crear un dataset propio versionado.

### 4.1 Esquema del dataset

```yaml
sample_id: uuid
input:
  audio_path: s3://...mp3
  video_path: s3://...mp4
  transcript: string
  pose_features: { posture, movement, eye_contact, ... }
  prosody_features: { pace_wpm, energy, clarity, ... }
metadata:
  scenario: enum [product-pitch, cold-opening, executive, objection, free]
  duration_seconds: float
  consent: boolean
  language: es | en
labels:
  overall_score: int 0-100
  dimensions:
    communication: int 0-100
    body_language: int 0-100
    prosody: int 0-100
    objection_handling: int 0-100
    confidence: int 0-100
  expected_recommendations:
    - { area: string, tip: string }
  rater_id: uuid
  rater_consensus: float 0-1
```

### 4.2 Metodología de etiquetado

- **Doble etiquetado** por dos coaches senior independientes.
- **Tercer árbitro** si la diferencia >15 puntos en overall.
- **Rúbrica común** publicada en este repo (`docs/SCORING_MODEL.md`).
- Métrica de consenso: Cohen's kappa ≥ 0.7 antes de aceptar muestra.

### 4.3 Cobertura objetivo (v1)

| Bucket | # muestras | Notas |
|---|---|---|
| Pitches sólidos (score ≥ 75) | 200 | distribuidos en los 5 escenarios |
| Pitches medios (50–74) | 200 | con variedad de problemas comunes |
| Pitches deficientes (25–49) | 200 | falta estructura / muletillas / corto |
| Casos límite (<25) | 100 | audio silente, sin persona en cámara, video solo música, etc. |
| **Total v1** | **700** | |

### 4.4 Privacidad y ética

- Consentimiento informado obligatorio antes de grabar.
- Anonimización de PII en transcripts.
- Opción de borrado a 30 días por defecto.
- No se reentrenan modelos sin consentimiento explícito.

### 4.5 Versionado

`apex-vision-pitches-es` versionado como:
- `v0.1` — bootstrap interno (50 muestras)
- `v0.2` — ampliación (300 muestras)
- `v1.0` — release pública (700 muestras, doble etiquetado)

Sources:
- [MLCommons/peoples_speech · HuggingFace](https://huggingface.co/datasets/MLCommons/peoples_speech)
- [ud-nlp/spanish-speech-recognition-dataset · HuggingFace](https://huggingface.co/datasets/ud-nlp/spanish-speech-recognition-dataset)
- [declare-lab/MELD · HuggingFace](https://huggingface.co/datasets/declare-lab/MELD)
- [Anthropic/persuasion · HuggingFace](https://huggingface.co/datasets/Anthropic/persuasion)
- [FBK-MT/MCIF · HuggingFace](https://huggingface.co/datasets/FBK-MT/MCIF)
- [DataProvenanceInitiative/commercial_licenses · HuggingFace](https://huggingface.co/datasets/DataProvenanceInitiative/commercial_licenses)
- [HuggingFace Licenses Documentation](https://huggingface.co/docs/hub/repositories-licenses)
