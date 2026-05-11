# Plan Financiero — Apex Vision Sales Evaluator

Estimaciones prácticas para operar y vender el producto desde MVP hasta escala temprana.

---

## 1. Costos por Evaluación

Componentes por cada audio/video procesado:

- Transcripción (Whisper/API): $0.006 – $0.02
- LLM scoring (GPT-4o o similar): $0.02 – $0.06
- Infra (CPU, colas, DB): $0.005 – $0.02

**Total estimado:** $0.03 – $0.10  
**Promedio de trabajo:** **$0.05 / evaluación**

---

## 2. Costos Fijos Mensuales (MVP)

**Infraestructura**
- VPS / cloud (workers + API + DB): $40 – $120
- RabbitMQ (managed o self-host): $0 – $30
- Storage (videos): $10 – $50

**Otros**
- Dominio / misc: ~$10

**Total infra:** **$60 – $200 / mes**

---

## 3. Escenarios de Costo Total

### Escenario A — 10 clientes (validación)
- Uso: 1,000 evaluaciones/mes
- Variable: 1,000 × $0.05 = $50
- Infra: ~$100

**Total:** **~$150 / mes**

### Escenario B — 50 clientes
- Uso: 10,000 evaluaciones/mes
- Variable: $500
- Infra: $150 – $300

**Total:** **~$650 – $800 / mes**

### Escenario C — 200 clientes
- Uso: 60,000 evaluaciones/mes
- Variable: $3,000
- Infra: $300 – $600

**Total:** **~$3,300 – $3,600 / mes**

---

## 4. Modelo de Ingresos (SaaS)

**Pricing sugerido**
- Starter: $39 / usuario / mes
- Growth: $89 / usuario / mes

---

## 5. Escenarios de Ingresos

### 10 clientes
- Ingreso: ~$500 / mes
- Costos: ~$150

**Profit:** **~$350**

### 50 clientes
- Ingreso: ~$3,500 / mes
- Costos: ~$700

**Profit:** **~$2,800**

### 200 clientes
- Ingreso: ~$16,000 / mes
- Costos: ~$3,500

**Profit:** **~$12,500**

---

## 6. Unit Economics

- ARPU: ~$70
- Costo por usuario: $5 – $15
- Margen bruto: **80% – 90%**

---

## 7. Punto de Equilibrio

Costos fijos: $150 – $300 / mes

**Break-even:** ~5–8 clientes pagos

---

## 8. Plan por Fases

### Fase 1 — Validación (0–20 clientes)
- Duración: 2–4 semanas
- Objetivo: cerrar primeros pagos
- Inversión: $100 – $300

**KPI clave:** alguien paga

---

### Fase 2 — Tracción (20–100 clientes)
- Duración: 1–3 meses
- Acciones:
  - Automatizar flujo
  - Mejorar UI
  - Añadir feedback útil

**Ingresos esperados:** $2k – $7k / mes

---

### Fase 3 — Escala (100–500 clientes)
- Duración: 3–9 meses
- Expansión:
  - Coaching AI
  - API
  - Integraciones

**Ingresos:** $10k – $40k / mes

---

## 9. Costos Ocultos

- Tiempo de desarrollo
- Iteración de prompts
- Soporte al cliente
- Manejo de errores en audio/video
- Latencia del pipeline

---

## 10. Riesgos Financieros

- Uso alto sin control → reduce margen
- Churn en clientes pequeños
- Bajo valor percibido

---

## 11. Estrategia de Pricing

Dos enfoques:

**A. Volumen (low ticket)**
- Más clientes
- Más soporte

**B. Premium (high ticket)**
- Menos clientes
- Más valor

**Recomendación:**
Empezar low-ticket → evolucionar a premium (coaching + insights)

---

## 12. Resumen Ejecutivo

- Costo por evaluación: ~$0.05
- Break-even: ~5 clientes
- Margen: 80% – 90%
- Potencial: alto si se valida el valor percibido
