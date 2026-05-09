# Plan Financiero — Apex Vision Sales Evaluator

Modelo **Pay-as-you-go** basado en recargas prepago y tokenización del consumo.
Núcleo de inteligencia: **GPT-4.1 con fine-tuning propietario y escalonado** entrenado sobre evaluaciones de ventas reales.

---

## 1. Modelo de Negocio

Apex Vision **no opera como SaaS de suscripción mensual fija**.
Funciona como un servicio de consumo medido, similar a la API de OpenAI o AWS:

1. El cliente crea su cuenta en la plataforma.
2. Recarga saldo (USD) cuando lo necesita.
3. Cada evaluación de audio/video descuenta **Apex Tokens (AT)** de su saldo.
4. El sistema muestra consumo en tiempo real y notifica cuando el saldo está bajo.
5. Sin recarga = sin servicio. Sin compromisos mensuales. Sin facturación recurrente forzada.

**Ventajas del modelo:**
- Cobro siempre por adelantado → cero cuentas por cobrar.
- El cliente paga solo lo que usa → bajo fricción de entrada.
- Margen sostenido por unidad → escalable sin riesgo de pérdida.
- Caja positiva desde el día 1.

---

## 2. Tokenizador (Apex Token — AT)

La unidad de consumo se llama **Apex Token (AT)**.

**Definición base:**
> 1 AT = 1 minuto de audio/video procesado y evaluado.

**Cómo se calcula el consumo de una evaluación:**

```
AT_consumidos = ceil(duración_en_minutos) + recargo_por_complejidad
```

- Recargo por complejidad (opcional, configurable):
  - Análisis estándar: +0 AT
  - Análisis con coaching/insights detallados: +1 AT por evaluación
  - Multi-idioma o audio de baja calidad: +0.5 AT

**Ejemplos:**
| Llamada | Duración | AT consumidos |
|---|---|---|
| Llamada corta de prospección | 3 min | 3 AT |
| Llamada de cierre estándar | 8 min | 8 AT |
| Llamada larga + coaching detallado | 12 min | 13 AT |

El cliente ve en su dashboard:
- Saldo actual en USD y AT equivalentes.
- Histórico de consumo por día/usuario/equipo.
- Alertas automáticas al 20% y 5% de saldo restante.

---

## 3. Stack Técnico de Inteligencia

**Pipeline por evaluación:**

```
Audio/Video → Whisper (transcripción) → GPT-4.1 fine-tuneado (scoring) → Output estructurado
```

| Componente | Modelo | Por qué |
|---|---|---|
| Transcripción | Whisper API ($0.006/min) | Multi-idioma, robusto, barato |
| Análisis y scoring | **GPT-4.1 fine-tuneado** | Mejor que GPT-4o en instrucciones estructuradas, 8× más barato de entrenar, 20% más barato en inferencia, contexto 1M tokens |
| Generación de feedback | GPT-4.1 fine-tuneado (mismo modelo) | Coherencia con el scoring |

**Por qué GPT-4.1 vs alternativas:**
- vs GPT-4o: 8× más barato de entrenar, 20% más barato en inferencia, 1M de contexto vs 128K, instrucciones estructuradas más fiables.
- vs Claude Sonnet 4.6: Claude no permite fine-tuning público → no defendible como activo propietario.
- vs Gemini 3.1 Pro: opción válida y más barata, pero ecosistema OpenAI tiene mejor tooling para iteración rápida en early stage.

---

## 4. Estrategia de Fine-Tuning Escalonada

Se invierte en fine-tuning **proporcional a la fase y al ingreso real**, no al revés. La defensibilidad se construye con datos reales de clientes, no con un dataset masivo prematuro.

### Nivel 1 — MVP de Fine-Tune (Fase 1, validación)
- **Dataset:** 200–500 ejemplos (50% sintéticos generados + 50% reales etiquetados internamente).
- **Iteraciones:** 1–2 corridas para calibrar rúbrica.
- **Compute:** $30 – $90.
- **Etiquetado:** $0 si lo hace el fundador / experto interno; $400 – $1,500 si se contrata.
- **Inversión total:** **$30 – $1,600**.
- **Calidad esperada:** 70–80% de un fine-tune profesional. Suficiente para validar willingness-to-pay.

### Nivel 2 — Producto Defendible (Fase 2, tracción)
- **Dataset:** 2,000–3,000 ejemplos (60% reales de clientes con consentimiento + 40% sintéticos validados).
- **Iteraciones:** 3–5 corridas con A/B testing entre versiones.
- **Compute:** $200 – $500.
- **Etiquetado:** $1,500 – $6,000.
- **Inversión total:** **$1,700 – $6,500**.
- **Calidad esperada:** producto claramente superior, defendible vs. competidores que solo usen prompting.

### Nivel 3 — State-of-the-Art (Fase 3, escala)
- **Dataset:** 10,000+ ejemplos, dataset propietario actualizado continuamente.
- **Iteraciones:** Re-tuning trimestral con datos nuevos.
- **Compute acumulado:** $1,500 – $4,000.
- **Etiquetado:** $5,000 – $20,000 (con synthetic + active learning).
- **Inversión total acumulada:** **$6,500 – $24,000**.
- **Calidad esperada:** modelo como activo estratégico defensible, superior a cualquier competidor sin pipeline de datos.

### Costos de re-training continuo (recurrentes)
- Fase 1: ~$0/mes (modelo inicial, sin re-tunes).
- Fase 2: $100 – $250/mes (re-tune cada 2 meses).
- Fase 3: $300 – $800/mes (re-tune mensual con dataset incremental).

---

## 5. Costos Internos por AT (con GPT-4.1 fine-tuneado)

Componentes por minuto de audio procesado y evaluado:

| Componente | Costo por AT | Notas |
|---|---|---|
| Transcripción (Whisper API) | $0.006 | $0.006/minuto de audio |
| Input tokens (GPT-4.1 FT) | $0.005 – $0.007 | ~1,800–2,200 tokens × $3.00/1M |
| Output tokens (GPT-4.1 FT) | $0.006 – $0.009 | ~500–750 tokens × $12.00/1M |
| Infraestructura (CPU, colas, DB, storage) | $0.003 – $0.004 | |
| Amortización fine-tuning | $0.001 – $0.002 | Distribuido sobre AT consumidos |

**Costo total por AT:** $0.021 – $0.028
**Promedio de trabajo:** **$0.024 / AT**

> Frente a GPT-4o fine-tuneado (~$0.028/AT), ahorras ~14% por evaluación. En 75,000 AT/mes (Escenario C) son ~$300/mes menos en costos variables.

---

## 6. Costos Fijos Mensuales

**Infraestructura base**
- VPS / cloud (workers + API + DB): $40 – $120
- RabbitMQ (managed o self-host): $0 – $30
- Storage (videos + datasets): $20 – $80
- Pasarela de pagos (costo fijo): $0 – $20

**ML ops (varía por fase)**
- Fase 1: $0
- Fase 2: $100 – $250
- Fase 3: $300 – $800

**Otros**
- Dominio / herramientas / misc: ~$10 – $20

**Totales por fase:**
- **Fase 1 (validación):** $70 – $250 / mes
- **Fase 2 (tracción):** $170 – $500 / mes
- **Fase 3 (escala):** $370 – $1,050 / mes

---

## 7. Tarifas al Cliente — Tarjeta de Precios

### Pay-as-you-go (sin recarga)
- **$0.20 por AT** — precio base para usuarios sin paquete.

### Paquetes de Recarga (con bonificación por volumen)

| Paquete | Pago | AT incluidos | Precio efectivo / AT | Bonus vs PAYG |
|---|---|---|---|---|
| **Starter** | $20 | 120 AT | $0.167 | 17% |
| **Growth** | $50 | 350 AT | $0.143 | 29% |
| **Pro** | $100 | 800 AT | $0.125 | 38% |
| **Scale** | $300 | 2,700 AT | $0.111 | 45% |
| **Enterprise** | $1,000 | 10,000 AT | $0.100 | 50% |

**Reglas del saldo:**
- Vigencia de los AT: 12 meses desde la última recarga.
- Saldo no usado no se reembolsa, pero se acumula con nuevas recargas.
- Recargas mayores a $1,000 → tarifa negociada (mínimo $0.085/AT).

**Bonus de adquisición:** primeros 20 AT gratis al registrarse (costo real $0.48 por usuario).

---

## 8. Margen Bruto por AT

| Tarifa | Precio venta | Costo interno | Margen unit. | % Margen |
|---|---|---|---|---|
| PAYG | $0.200 | $0.024 | $0.176 | 88% |
| Starter | $0.167 | $0.024 | $0.143 | 86% |
| Growth | $0.143 | $0.024 | $0.119 | 83% |
| Pro | $0.125 | $0.024 | $0.101 | 81% |
| Scale | $0.111 | $0.024 | $0.087 | 78% |
| Enterprise | $0.100 | $0.024 | $0.076 | 76% |

**Margen bruto promedio esperado:** **80% – 86%**
(Descontando ~3.5% de pasarela de pago: **77% – 83% margen real.**)

---

## 9. Escenarios de Negocio

> Supuesto: cada cliente activo recarga aproximadamente cada mes y consume todo o casi todo su saldo.

### Escenario A — 10 clientes (Fase 1, validación)
- Mix: 6 Starter ($20) + 3 Growth ($50) + 1 Pro ($100)
- **Ingreso bruto:** $370 / mes
- Comisión pasarela (~3.5%): -$13
- **Ingreso neto:** $357
- AT consumidos: ~2,400
- Costo variable: ~$58
- Infra + ML ops: ~$100 (Fase 1, sin re-training)
- **Profit: ~$199 / mes**

### Escenario B — 50 clientes (Fase 2, tracción)
- Mix: 25 Starter + 18 Growth + 6 Pro + 1 Scale
- **Ingreso bruto:** $2,000 / mes
- Comisión pasarela: -$70
- **Ingreso neto:** $1,930
- AT consumidos: ~14,000
- Costo variable: ~$336
- Infra + ML ops: ~$350 (Fase 2, re-tune cada 2 meses)
- **Profit: ~$1,244 / mes**

### Escenario C — 200 clientes (Fase 3, escala temprana)
- Mix: 80 Starter + 80 Growth + 30 Pro + 9 Scale + 1 Enterprise
- **Ingreso bruto:** $11,300 / mes
- Comisión pasarela: -$395
- **Ingreso neto:** $10,905
- AT consumidos: ~80,000
- Costo variable: ~$1,920
- Infra + ML ops: ~$700 (Fase 3, re-tune mensual)
- **Profit: ~$8,285 / mes**

### Escenario D — 500 clientes + Enterprise
- ARPU mezclado ~$120 / mes
- **Ingreso bruto:** ~$60,000 / mes
- AT consumidos: ~480,000
- Costo variable: ~$11,500
- Infra + ML ops: ~$1,200
- Pasarela: -$2,100
- **Profit: ~$45,200 / mes**

---

## 10. Unit Economics

- **ARPU promedio esperado:** $40 – $120 según mix de paquetes.
- **Costo variable por cliente:** $5 – $18.
- **Margen contribución por cliente:** 78% – 86%.
- **CAC objetivo (early stage):** < $35 por cliente.
- **Payback CAC:** < 1 mes.
- **LTV estimado (12 meses, churn 5%):** $300 – $900 por cliente.

> El fine-tuning de GPT-4.1 sostiene márgenes altos sin sacrificar calidad. La defensibilidad se construye en Fase 2–3 con datos propietarios de clientes reales.

---

## 11. Punto de Equilibrio por Fase

| Fase | Costos fijos / mes | Break-even (clientes activos) |
|---|---|---|
| **Fase 1 (validación)** | $70 – $250 | **~3 – 6** |
| **Fase 2 (tracción)** | $170 – $500 | **~6 – 15** |
| **Fase 3 (escala)** | $370 – $1,050 | **~12 – 30** |

> Los costos fijos suben con la fase, pero el ingreso por cliente y el volumen suben más rápido. Break-even nunca se aleja más allá de ~30 clientes.

---

## 12. Inversión Inicial Requerida (Pre-MVP + MVP)

### Lo mínimo para arrancar (recomendado)
| Concepto | Inversión |
|---|---|
| Fine-tuning Nivel 1 (compute) | $30 – $90 |
| Etiquetado interno (sin contratar) | $0 |
| Infraestructura primeros 3 meses | $210 – $750 |
| Pasarela + dominio + misc | $200 |
| Buffer de bonus de bienvenida (50 usuarios) | $24 |
| **Total inversión inicial mínima** | **$464 – $1,064** |

### Inversión escalada por fase (acumulada)
| Hito | Inversión acumulada |
|---|---|
| Lanzar MVP (Nivel 1 fine-tune) | $500 – $1,600 |
| Llegar a Fase 2 con producto sólido (Nivel 2) | $2,200 – $8,000 |
| Construir activo defendible (Nivel 3) | $9,000 – $32,000 |

> **Cada nivel se paga con caja generada por el anterior**, no requiere capital de afuera si ejecutas las fases en orden.

---

## 13. Plan por Fases

### Fase 1 — Validación (0–20 clientes, 2–4 semanas)
- **Objetivo:** primera recarga real + segunda recarga del mismo cliente (señal de retención).
- **Producto:** GPT-4.1 con fine-tune Nivel 1 (200–500 ejemplos), tokenizador funcional, dashboard básico de consumo.
- **Paquetes activos:** Starter, Growth.
- **Inversión:** $500 – $1,600.
- **KPI clave:** ≥ 5 clientes recargan al menos 2 veces.

### Fase 2 — Tracción (20–100 clientes, 1–3 meses)
- **Objetivo:** validar repetibilidad y escalar a paquetes mayores.
- **Producto:** Fine-tune Nivel 2, dashboard avanzado, auto-recarga opcional, paquetes Pro y Scale habilitados.
- **Re-tuning:** cada 2 meses con datos nuevos.
- **Ingresos esperados:** $1.5k – $5k / mes.
- **KPI clave:** ARPU > $40, churn < 8%, NPS > 40.

### Fase 3 — Escala (100–500 clientes, 3–9 meses)
- **Objetivo:** fine-tuning continuo como activo estratégico + integraciones.
- **Producto:** Fine-tune Nivel 3, API pública (cobrada en AT), integraciones (CRM, Twilio, Zoom, Meet), Enterprise.
- **Re-tuning:** mensual con dataset incremental de clientes.
- **Ingresos esperados:** $10k – $60k / mes.
- **KPI clave:** ≥ 1 cliente Enterprise, retención > 90% anual.

---

## 14. Costos Ocultos

- Tiempo de desarrollo del tokenizador y dashboard de saldo.
- Curaduría y etiquetado de ejemplos para fine-tune (especialmente en Niveles 2–3).
- Iteración de prompts y rúbricas de scoring.
- Soporte al cliente (especialmente sobre disputas de AT).
- Manejo de errores en audio/video (¿se cobra una evaluación fallida?).
- Latencia del pipeline.
- Reembolsos por errores del sistema → reservar ~2% de ingresos.

**Política sugerida:** evaluaciones fallidas por error de Apex no consumen AT (auto-refund).

---

## 15. Riesgos Financieros y Mitigaciones

| Riesgo | Mitigación |
|---|---|
| Cliente recarga grande pero no consume | Pasivo contable; reservar saldo no consumido. |
| Abuso del PAYG con costos en pico | Rate limiting + cap diario de consumo. |
| Cliente disputa cobros en pasarela | Logs detallados de cada AT consumido + ToS clara. |
| OpenAI sube precio de GPT-4.1 o lo deprecia | Cláusula de ajuste de tarifas c/90 días + plan de migración a GPT-5 / Gemini 3.1 Pro. |
| Cliente prueba 1 vez y no vuelve | Onboarding fuerte + bonus de bienvenida (20 AT gratis). |
| Saldo bajo → cliente se va | Alertas automáticas + auto-recarga opcional. |
| Fine-tune sale flojo en Nivel 1 | Iterar rápido con feedback de primeros 5 clientes antes de comprometer Nivel 2. |
| Datos sensibles de clientes en re-training | Consentimiento explícito + anonimización + opt-out. |

---

## 16. Estrategia de Pricing

**Filosofía:** *paga por valor consumido, no por sillas vacías*.

- Entrada baja (Starter $20) → fricción mínima para probar.
- Bonificación creciente por volumen → incentiva paquetes grandes.
- Sin contratos → confianza y diferenciación vs SaaS tradicional.
- Premium opcional vía coaching AI cobrado en AT extras.

**Recomendación:** lanzar con Starter + Growth + Pro. Habilitar Scale y Enterprise una vez se valide consumo > 1,000 AT/mes en al menos 5 clientes.

---

## 17. Resumen Ejecutivo

- **Modelo de negocio:** prepago por consumo, tokenizado en Apex Tokens (AT).
- **Stack técnico:** Whisper + **GPT-4.1 fine-tuneado** (8× más barato de entrenar y 20% más barato de operar que GPT-4o).
- **Costo interno por AT:** ~$0.024.
- **Precio cliente por AT:** $0.10 – $0.20 según paquete.
- **Margen bruto:** **80% – 86%** (77% – 83% neto post-pasarela).
- **Inversión mínima para arrancar:** **$500 – $1,600** (Nivel 1 fine-tune + infra primeros 3 meses).
- **Break-even Fase 1:** ~3–6 clientes activos.
- **Caja:** positiva desde el día 1 (cobro adelantado).
- **Defensibilidad:** se construye en Fases 2–3 con datos propietarios de clientes reales (re-training continuo).
- **Escalabilidad:** 200 clientes activos → ~$8.3k profit/mes; 500 clientes → ~$45k profit/mes.
- **Potencial:** alto, especialmente si Fase 1 valida willingness-to-pay con < $1,600 invertidos antes de comprometer Nivel 2.
