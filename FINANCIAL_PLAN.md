# Plan Financiero — Apex Vision Sales Evaluator

Modelo **SaaS híbrido**: suscripción mensual fija (acceso a la plataforma) **+** consumo medido en **Apex Tokens (AT)** sobre el saldo del plan, con overage por unidad al superar la cuota incluida.

> **Actualización:** este plan refleja el **stack real implementado** en el proyecto (no un diseño hipotético). Precios de proveedores expresados como estimaciones a 2026 USD; ver §3 para fuentes. El producto evolucionó: ahora son **dos flujos** — (1) evaluación asíncrona de video y (2) **agente conversacional en vivo** (roleplay de ventas en tiempo real).

---

## 1. Modelo de Negocio (SaaS híbrido)

Apex Vision opera como **SaaS B2B con suscripción mensual + consumo medido**:

1. El cliente contrata un **plan mensual** (Starter / Growth / Pro / Scale / Enterprise).
2. Cada plan incluye acceso a la plataforma (dashboard multi-tenant, histórico, equipo) **y una cuota mensual de Apex Tokens (AT)**.
3. El consumo de evaluaciones y minutos de agente en vivo **descuenta AT** de la cuota.
4. Al superar la cuota, se cobra **overage** por AT (o se sube de plan / se recarga).
5. La suscripción genera **MRR recurrente**; el overage captura a los power users.

**Ventajas del modelo híbrido:**
- **MRR predecible** desde la suscripción base → valuación SaaS clásica.
- **Cobro adelantado** (mensual) → caja positiva, baja cuenta por cobrar.
- **Captura de valor** del consumo intensivo vía AT/overage → margen sostenido por unidad.
- **Baja fricción de entrada** (Starter accesible) + upsell natural por cuota agotada.

> Diferencia con el plan anterior (pago-por-consumo puro): ahora hay un **fee fijo mensual** que ancla el ingreso recurrente; los AT dejan de ser el único motor de ingreso y pasan a medir el consumo dentro/sobre la cuota.

---

## 2. Tokenizador (Apex Token — AT)

La unidad de consumo se llama **Apex Token (AT)**. Como hay dos flujos con costo distinto, el AT se consume a **tasas diferentes** según el tipo de uso:

**Definiciones base:**
> **Evaluación asíncrona:** 1 AT = 1 minuto de audio/video procesado y evaluado.
> **Agente en vivo:** 1 minuto de conversación en vivo = **3 AT** (refleja el mayor costo de TTS en tiempo real, ver §3 y §5).

**Cálculo del consumo:**

```
AT_evaluación = ceil(duración_min) + recargo_complejidad
AT_live       = ceil(duración_min) × 3
```

- Recargo por complejidad en evaluación (configurable):
  - Análisis estándar: +0 AT
  - Coaching/insights detallados: +1 AT por evaluación
  - Multi-idioma o audio de baja calidad: +0.5 AT

**Ejemplos:**

| Uso | Duración | AT consumidos |
|---|---|---|
| Evaluación corta de prospección | 3 min | 3 AT |
| Evaluación de cierre + coaching | 8 min | 9 AT |
| Sesión de roleplay en vivo | 10 min | 30 AT |

El cliente ve en su dashboard: cuota mensual de AT y consumo, desglose async vs. live, histórico por usuario/equipo, alertas al 20% y 5% de cuota restante, y proyección de overage.

---

## 3. Stack Técnico de Inteligencia (real)

El sistema tiene **dos pipelines** con servicios distintos. Pose y prosodia corren **localmente** (sin costo de API).

### 3.1 Evaluación asíncrona (subir video → score)

```
Video → Groq Whisper (transcripción) ─┐
         MediaPipe (pose, local) ──────┼─► GPT-4o (scoring multimodal) → Output estructurado
         librosa (prosodia, local) ────┘     (fallback: Groq Llama-3.1-8b)
```

| Componente | Servicio real | Precio aprox. (2026) | Notas |
|---|---|---|---|
| Transcripción | **Groq Whisper large-v3** | ~$0.111/h ≈ **$0.002/min** | ~10× más barato que Whisper API de OpenAI ($0.006/min) |
| Lenguaje corporal | **MediaPipe (local)** | costo de CPU/infra | sin API; se procesa en el worker `pose` |
| Prosodia / voz | **librosa (local)** | costo de CPU/infra | pitch, RMS, pausas, muletillas; worker `prosody` |
| Scoring + feedback | **OpenAI GPT-4o** | $2.50/1M in · $10/1M out | ~2.5k tokens in / ~1.2k out por evaluación → **~$0.02/eval** |
| Fallback de scoring | **Groq Llama-3.1-8b-instant** | ~$0.05/1M in · $0.08/1M out | resiliencia si OpenAI falla; costo despreciable |

### 3.2 Agente conversacional en vivo (roleplay tiempo real)

```
Audio usuario → Groq Whisper turbo (STT) → DeepSeek (LLM en personaje) → ElevenLabs Flash v2.5 (TTS) → audio
```

| Componente | Servicio real | Precio aprox. (2026) | Notas |
|---|---|---|---|
| STT | **Groq Whisper large-v3-turbo** | ~$0.04/h | por turno de usuario; despreciable |
| LLM conversacional | **DeepSeek (deepseek-chat)** | ~$0.27/1M in · $1.10/1M out | streaming, máx 220 tokens/turno; muy barato |
| TTS | **ElevenLabs Flash v2.5** | ~0.5 créditos/char (~$0.0001–0.0002/char) | **driver de costo del live** (~$0.04/min de habla) |
| Coaching post-evaluación | **DeepSeek** | igual que arriba | chat de coaching sobre el resultado |

**Por qué este stack (vs el plan anterior que asumía GPT-4.1 fine-tuneado):**
- **No hay fine-tuning hoy.** El producto usa **GPT-4o de stock + prompts versionados** (`scoring/prompts/v2.md`) con `response_format: json_schema` y validación Pydantic estricta. Ya entrega scoring multimodal defendible sin entrenar modelo.
- **Groq** abarata radicalmente la transcripción y da fallback de scoring casi gratis.
- **DeepSeek** hace el agente en vivo viable a bajo costo; el cuello de costo es **ElevenLabs TTS**.
- El fine-tuning queda como **roadmap opcional de Fase 3** (ver §4), no como costo presente.

---

## 4. Fine-Tuning como Roadmap Opcional (no es costo presente)

El producto **no requiere** fine-tuning para operar: GPT-4o + prompts curados ya producen el contrato de scoring. El fine-tuning se evalúa **solo si** en Fase 2–3 los datos propietarios justifican un modelo más barato/defendible.

| Nivel | Cuándo | Dataset | Inversión | Beneficio |
|---|---|---|---|---|
| **0 — Stock (actual)** | Fases 1–2 | — | $0 | GPT-4o + prompt v2, ya operativo |
| **1 — FT exploratorio** | Fin de Fase 2 | 500–1,500 evals reales | $200 – $1,500 | bajar costo de inferencia y latencia |
| **2 — FT defendible** | Fase 3 | 3,000–10,000 evals | $2,000 – $8,000 | activo propietario + margen extra |

> Regla: **cada nivel se paga con caja del anterior**. No se invierte en fine-tuning antes de validar willingness-to-pay con el stack de stock.

---

## 5. Costo Interno por AT

### 5.1 Evaluación asíncrona — costo por AT (1 min de video)

| Componente | Costo por AT | Notas |
|---|---|---|
| Transcripción (Groq Whisper) | $0.002 | $0.002/min |
| Pose (MediaPipe, CPU local) | $0.003 | compute en worker |
| Prosodia (librosa, CPU local) | $0.001 | compute en worker |
| Scoring (GPT-4o, amortizado /min) | $0.003 – $0.004 | ~$0.02/eval ÷ ~5–6 min promedio |
| Infra (DB, colas, storage) | $0.002 | |

**Costo total por AT-evaluación:** **$0.011 – $0.013** · promedio **~$0.012/AT**

### 5.2 Agente en vivo — costo por minuto (= 3 AT)

| Componente | Costo / min de live | Notas |
|---|---|---|
| STT (Groq turbo) | $0.0005 | por turno de usuario |
| LLM (DeepSeek) | $0.0015 | ~3 turnos/min, 220 tok máx |
| TTS (ElevenLabs Flash) | $0.040 | ~300–500 chars de habla/min |
| Infra / WebSocket | $0.003 | |

**Costo total por minuto de live:** **~$0.045** → sobre 3 AT = **~$0.015/AT-live**

> **Costo interno promedio ponderado:** **~$0.013 / AT** (frente a $0.024/AT del plan anterior basado en Whisper API + GPT-4.1 FT). El ahorro viene de Groq, scoring once-per-eval y cero amortización de fine-tuning.

---

## 6. Costos Fijos Mensuales (infra real)

El stack corre vía `docker-compose`: **Postgres + MinIO + RabbitMQ + workers (pose/whisper/prosody/scoring) + API Gateway (FastAPI) + frontend**.

**Infraestructura base**
- VPS / cloud (workers CPU-intensivos por MediaPipe/librosa + API + DB): $40 – $300
- Postgres (Supabase free → managed): $0 – $100
- Object storage (MinIO self-host → S3): $5 – $80
- RabbitMQ (self-host → CloudAMQP): $0 – $50
- **ElevenLabs (suscripción TTS para el live):** $22 (Creator) → $99 (Pro) → $330 (Scale)
- Pasarela de pagos (costo fijo): $0 – $20
- Dominio / monitoreo / misc: $20 – $80

**Totales por fase:**
- **Fase 1 (validación):** $70 – $160 / mes
- **Fase 2 (tracción):** $250 – $450 / mes
- **Fase 3 (escala):** $700 – $1,200 / mes

> El TTS de ElevenLabs es el costo fijo+variable que más crece con el uso del agente en vivo. Si el live se vuelve dominante, conviene negociar plan Business o evaluar TTS alternativos (Cartesia, Deepgram Aura) como mitigación.

---

## 7. Tarifas al Cliente — Planes (suscripción + AT incluidos)

| Plan | Mensual | AT/mes incluidos | $/AT efectivo | Overage $/AT | Asientos | Live |
|---|---|---|---|---|---|---|
| **Free Trial** | $0 | 20 (one-time) | — | — | 1 | demo |
| **Starter** | $29 | 200 | $0.145 | $0.18 | 3 | ✓ |
| **Growth** | $79 | 650 | $0.122 | $0.16 | 10 | ✓ |
| **Pro** | $199 | 1,800 | $0.111 | $0.14 | 25 | ✓ |
| **Scale** | $499 | 5,000 | $0.100 | $0.12 | 75 | ✓ |
| **Enterprise** | desde $1,000 | 12,000+ | ≤ $0.083 | negociado | ilimitado | ✓ + API |

**Reglas del saldo:**
- Los AT incluidos **se renuevan cada mes** (no se acumulan salvo plan anual).
- Recargas de overage prepago disponibles; vigencia 12 meses.
- Pay-as-you-go sin plan: **$0.20/AT** (precio ancla para uso esporádico).
- Enterprise > $1,000 → tarifa negociada (mínimo **$0.083/AT**), SSO, API pública, SLA.

**Bonus de adquisición:** 20 AT gratis al registrarse (costo real ~$0.26 por usuario).

---

## 8. Margen Bruto por AT

| Tarifa | Precio venta/AT | Costo interno/AT | Margen unit. | % Margen |
|---|---|---|---|---|
| PAYG | $0.200 | $0.013 | $0.187 | 94% |
| Starter | $0.145 | $0.013 | $0.132 | 91% |
| Growth | $0.122 | $0.013 | $0.109 | 89% |
| Pro | $0.111 | $0.013 | $0.098 | 88% |
| Scale | $0.100 | $0.013 | $0.087 | 87% |
| Enterprise | $0.083 | $0.013 | $0.070 | 84% |

**Margen bruto promedio esperado:** **87% – 91%**
(Descontando ~3.5% de pasarela: **84% – 88% margen real.**)

> El margen sube vs el plan anterior (era 76–88%) gracias a Groq + sin fine-tuning. El uso intensivo de **live** comprime un poco el margen por su TTS, pero al cobrarse a 3 AT/min se mantiene rentable (~70% margen en minutos de live puro).

---

## 9. Escenarios de Negocio (MRR + overage)

> Supuesto: cada cliente paga su suscripción mensual y consume ~80–110% de su cuota (algunos generan overage).

### Escenario A — 10 clientes (Fase 1, validación)
- Mix: 6 Starter + 3 Growth + 1 Pro
- **MRR suscripción:** $174 + $237 + $199 = **$610**
- Overage estimado: ~$40 → **Ingreso bruto: ~$650/mes**
- Pasarela (~3.5%): -$23 → **Neto: $627**
- AT consumidos: ~2,800 · Costo variable: ~$37
- Fijos: ~$110
- **Profit: ~$480 / mes**

### Escenario B — 50 clientes (Fase 2, tracción)
- Mix: 25 Starter + 18 Growth + 6 Pro + 1 Scale
- **MRR suscripción:** $725 + $1,422 + $1,194 + $499 = **$3,840**
- Overage estimado: ~$400 → **Ingreso bruto: ~$4,240/mes**
- Pasarela: -$148 → **Neto: $4,092**
- AT consumidos: ~22,000 · Costo variable: ~$290
- Fijos: ~$370
- **Profit: ~$3,430 / mes**

### Escenario C — 200 clientes (Fase 3, escala temprana)
- Mix: 80 Starter + 80 Growth + 30 Pro + 9 Scale + 1 Enterprise
- **MRR suscripción:** $2,320 + $6,320 + $5,970 + $4,491 + $1,000 = **$20,101**
- Overage estimado: ~$2,500 → **Ingreso bruto: ~$22,600/mes**
- Pasarela: -$791 → **Neto: $21,809**
- AT consumidos: ~140,000 · Costo variable: ~$1,850
- Fijos: ~$950
- **Profit: ~$19,000 / mes**

### Escenario D — 500 clientes + Enterprise
- ARPU mezclado ~$130/mes → **MRR ~$65,000** + overage ~$7,000 = **~$72,000 bruto/mes**
- Pasarela: -$2,520
- AT consumidos: ~450,000 · Costo variable: ~$6,000
- Fijos: ~$1,500
- **Profit: ~$62,000 / mes**

---

## 10. Unit Economics

- **ARPU promedio esperado:** $40 – $130 según mix de planes (sube vs el modelo PAYG por el fee fijo).
- **Costo variable por cliente:** $4 – $16.
- **Margen de contribución por cliente:** 86% – 92%.
- **CAC objetivo (early stage):** < $40 por cliente.
- **Payback CAC:** < 1.5 meses (la suscripción acelera el retorno vs PAYG).
- **LTV estimado (churn ~5%/mes → vida ~20 meses):** $800 – $2,600 por cliente.
- **LTV/CAC objetivo:** > 5×.

> El componente de suscripción mejora todas las métricas SaaS (MRR, payback, predictibilidad) frente al modelo de pura recarga.

---

## 11. Punto de Equilibrio por Fase

| Fase | Costos fijos / mes | Break-even (clientes activos) |
|---|---|---|
| **Fase 1 (validación)** | $70 – $160 | **~2 – 4** |
| **Fase 2 (tracción)** | $250 – $450 | **~5 – 9** |
| **Fase 3 (escala)** | $700 – $1,200 | **~10 – 20** |

> Con MRR recurrente y margen ~88%, el break-even se alcanza con muy pocos clientes y se mantiene estable bajo ~20 incluso en escala.

---

## 12. Inversión Inicial Requerida (Pre-MVP + MVP)

Sin fine-tuning de arranque, la inversión inicial **baja respecto al plan anterior**.

### Lo mínimo para lanzar (recomendado)
| Concepto | Inversión |
|---|---|
| Infraestructura primeros 3 meses | $210 – $480 |
| Créditos prepago de APIs (OpenAI + Groq + DeepSeek + ElevenLabs) | $100 – $250 |
| Pasarela + dominio + monitoreo | $150 |
| Buffer de bonus de bienvenida (50 usuarios) | $30 |
| **Total inversión inicial mínima** | **$490 – $910** |

### Inversión escalada por fase (acumulada)
| Hito | Inversión acumulada |
|---|---|
| Lanzar MVP (stock GPT-4o, sin FT) | $500 – $900 |
| Llegar a Fase 2 con producto sólido | $1,500 – $3,500 |
| Fine-tuning opcional como activo (Fase 3) | $3,500 – $11,000 |

> **El MVP no necesita capital externo**: arranca con stock de modelos y se autofinancia con MRR. El fine-tuning es una decisión de Fase 3, no un requisito.

---

## 13. Plan por Fases

### Fase 1 — Validación (0–20 clientes, 2–4 semanas)
- **Objetivo:** primeras suscripciones pagas + retención al segundo mes (no-churn).
- **Producto:** evaluación async (pose+prosodia+scoring GPT-4o) + agente en vivo básico, dashboard de cuota de AT, planes Starter/Growth.
- **Inversión:** $500 – $900.
- **KPI clave:** ≥ 5 clientes renuevan al mes 2; NRR > 90%.

### Fase 2 — Tracción (20–100 clientes, 1–3 meses)
- **Objetivo:** repetibilidad de MRR + activar Pro/Scale + overage.
- **Producto:** dashboard avanzado, auto-recarga de overage, multi-idioma (prompt v2_en), integraciones básicas.
- **Ingresos esperados:** $3k – $6k MRR.
- **KPI clave:** ARPU > $50, churn < 6%, NPS > 40, NRR > 100%.

### Fase 3 — Escala (100–500 clientes, 3–9 meses)
- **Objetivo:** API pública (cobrada en AT), Enterprise, fine-tuning opcional como activo.
- **Producto:** SSO, integraciones (CRM, Zoom, Meet, Twilio), SLA, modelo fine-tuneado si los datos lo justifican.
- **Ingresos esperados:** $15k – $70k MRR.
- **KPI clave:** ≥ 1 Enterprise, retención > 90% anual, LTV/CAC > 5×.

---

## 14. Costos Ocultos

- Tiempo de desarrollo del dashboard de cuota/overage y facturación recurrente.
- Latencia y calidad del **agente en vivo** (TTS es lo más sensible a UX).
- Curaduría de prompts y rúbricas de scoring (iteración con `scripts/prompt_eval.py`).
- Soporte al cliente (disputas de consumo de AT, evaluaciones fallidas).
- **Costo de TTS si el live escala** (ElevenLabs por char) → monitorear y topar.
- Manejo de errores en audio/video: evaluación fallida por error de Apex **no consume AT** (auto-refund).
- Reembolsos / dunning de suscripciones falladas → reservar ~2% de ingresos.

---

## 15. Riesgos Financieros y Mitigaciones

| Riesgo | Mitigación |
|---|---|
| Cliente paga plan pero no usa (bajo engagement) | Onboarding fuerte + reportes de valor + alertas de cuota sin usar. |
| Abuso de live (TTS caro) en planes bajos | Cap de minutos de live por tier + cobro a 3 AT/min + rate limiting. |
| ElevenLabs sube precio de TTS | Plan de migración a Cartesia/Deepgram Aura + cláusula de ajuste c/90 días. |
| OpenAI sube/deprecia GPT-4o | Fallback Groq ya implementado + portabilidad de prompt a Gemini/Claude. |
| Churn temprano (probó 1 mes y se va) | Bonus de bienvenida + onboarding + plan anual con descuento. |
| Overage sorprende y molesta al cliente | Alertas 20%/5% + auto-upgrade sugerido + tope configurable de gasto. |
| Disputa de cobros en pasarela | Logs detallados por AT + ToS clara + facturación transparente. |
| Datos sensibles en futuro fine-tuning | Consentimiento explícito + anonimización + opt-out. |

---

## 16. Estrategia de Pricing

**Filosofía:** *suscripción por acceso al valor recurrente + pago por consumo intensivo*.

- **Ancla baja** (Starter $29) → fricción mínima para entrar al SaaS.
- **Cuota incluida** → percepción de valor "todo incluido" para uso normal.
- **Overage + upgrade** → captura a los power users sin penalizar al usuario promedio.
- **Live cobrado a 3 AT/min** → protege el margen del componente más caro.
- **Sin contratos forzados** (mensual cancelable) → confianza; plan anual con 2 meses gratis para retención.

**Recomendación de lanzamiento:** Starter + Growth + Pro. Habilitar Scale/Enterprise tras validar consumo > 1,000 AT/mes en ≥ 5 clientes y demanda de live sostenida.

---

## 17. Resumen Ejecutivo

- **Modelo de negocio:** SaaS híbrido — suscripción mensual (MRR) + consumo en Apex Tokens (AT) con overage.
- **Stack real:** Groq Whisper + MediaPipe + librosa + **GPT-4o** (scoring, fallback Groq) para evaluación; Groq STT + **DeepSeek** + **ElevenLabs Flash** para el agente en vivo. **Sin fine-tuning** (opcional en Fase 3).
- **Costo interno por AT:** **~$0.013** (≈45% menos que el plan anterior, por Groq + sin FT).
- **Precio cliente por AT:** $0.083 – $0.20 según plan; planes desde **$29/mes**.
- **Margen bruto:** **87% – 91%** (84% – 88% neto post-pasarela).
- **Inversión mínima para arrancar:** **$490 – $910** (sin fine-tuning; autofinanciable con MRR).
- **Break-even Fase 1:** ~2–4 clientes activos.
- **Caja:** positiva desde el día 1 (suscripción cobrada por adelantado).
- **Escalabilidad:** 200 clientes → ~$19k profit/mes; 500 clientes → ~$62k profit/mes.
- **Diferencial nuevo:** agente conversacional en vivo (roleplay) además de la evaluación async — dos motores de consumo de AT.
- **Defensibilidad:** prompts curados + datos propietarios; fine-tuning como activo opcional de Fase 3 cuando el volumen lo justifique.

> **Nota sobre precios:** las tarifas de proveedores (Groq, OpenAI, DeepSeek, ElevenLabs) son estimaciones a 2026 y deben revalidarse trimestralmente; la cláusula de ajuste de tarifas c/90 días cubre cambios de costo aguas arriba.
