# Sistema de Tokens · Jupiter Apex Vision

> Versión: **1.0** · Fecha: 2026-05-08

## Conversión

**1 token = $0.01 USD**

## Costos por acción

| Acción | Tokens | USD | Razón |
|---|---|---|---|
| Evaluación de pitch | 5 | $0.05 | Whisper + Pose + Prosody + GPT-4.1 + infra |
| Plan de coaching IA | 20 | $0.20 | Análisis del equipo completo con GPT-4.1 |
| Reporte PDF / CSV | 0 | gratis | Sin consumo de IA |

## Planes (basado en `docs/business/FINANCIAL_PLAN.md`)

| Plan | Precio/mes | Tokens incluidos | Equivalente |
|---|---|---|---|
| Starter | $39 USD | 600 tokens | ~120 evaluaciones |
| Growth | $89 USD | 2.000 tokens | ~400 evaluaciones + coaching IA |
| Enterprise | A medida | Pool dedicado / ilimitado | — |

**Recarga adicional:** $10 USD = 1.000 tokens, sin vencimiento.

## Persistencia

Saldo persiste en `localStorage`:
- Clave: `apex_tokens` (admin)
- Default: 500 tokens

## UI

- Pill verde en header del admin con saldo actual + botón `+500` para recargar.
- Tooltip explica el costo de cada acción.
- Botón `Generar plan de coaching` se deshabilita si saldo < 20.
- Pantalla de resultados del seller muestra desglose: `Whisper (1) + Pose (1) + Prosodia (1) + GPT-4.1 (2) = 5 tokens · $0.05 USD`.

## Margen

Costo real por evaluación ≈ $0.05 USD · Precio token = $0.05 USD → margen 0% en uso puro.
Margen real proviene de tokens incluidos no consumidos por el cliente:
- Plan Starter: ARPU $39 · costo medio uso real $5.85 → margen ≈ 85%.
- Plan Growth: ARPU $89 · costo medio uso real $13 → margen ≈ 85%.
