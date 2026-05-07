# Productización — Apex Vision Sales Evaluator

Este documento aterriza varias formas de convertir el sistema en producto real (negocio + ejecución).

---

## 1. SaaS de Evaluación de Ventas (Core)

**Qué vendes**  
Evaluación automática de llamadas/videos de ventas con scoring claro y repetible.

**Cliente ideal (ICP)**  
- Startups B2B con 3–20 vendedores  
- Equipos de ventas remotos

**Pricing**  
- Starter: $39/usuario/mes (50 evals)  
- Growth: $89/usuario/mes (300 evals)  
- Team: $199+/mes (ilimitado soft)

**Unidad económica**  
- Costo: $0.02–0.08 por evaluación  
- Margen alto si hay recurrencia

**MVP vendible (2–4 semanas)**  
- Subida/grabación  
- Score + breakdown  
- Historial simple

**Cómo venderlo**  
- Demo con video real del cliente  
- “Te doy feedback objetivo en 2 minutos”

**Riesgo**  
Sin recomendaciones → percibido como dashboard genérico

---

## 2. Sales Coaching AI (Upsell)

**Qué vendes**  
Entrenamiento automático basado en evaluaciones.

**Pricing**  
- Add-on: +$50–$100/usuario/mes

**Valor**  
- Sustituye parcialmente coach humano  
- Mejora métricas reales

**MVP**  
- 3–5 recomendaciones accionables por evaluación  
- Feedback en lenguaje natural

**Roadmap**  
- Tracking de mejora  
- Simulación (roleplay)

**Go-to-market**  
- Upsell a usuarios activos del SaaS

**Riesgo**  
Feedback genérico si prompts no están afinados

---

## 3. API de Evaluación (Infra B2B)

**Qué vendes**  
Motor de scoring como servicio.

**Cliente ideal**  
- CRMs  
- Call centers  
- EdTech

**Pricing**  
- $0.05–$0.20 por evaluación  
- Descuento por volumen

**MVP**  
- `POST /evaluate`  
- Respuesta JSON

**Requisitos clave**  
- API keys  
- Async + webhooks

**Go-to-market**  
- Outreach a startups  
- Docs tipo Stripe

**Riesgo**  
Requiere alta confiabilidad (SLA)

---

## 4. Hiring Tool (Reclutamiento)

**Qué vendes**  
Evaluación automática de candidatos en ventas.

**Cliente ideal**  
- Recruiters  
- Startups en hiring activo

**Pricing**  
- $3–$10 por candidato

**MVP**  
- Link → grabación → score  
- Ranking básico

**Valor**  
- Reduce tiempo de screening

**Riesgo**  
Tema legal/ética en evaluaciones automatizadas

---

## 5. Plugin para CRM

**Qué vendes**  
Análisis automático dentro del CRM.

**Cliente ideal**  
- Equipos ya usando HubSpot/Salesforce

**Pricing**  
- $50–$200/mes por workspace

**MVP**  
- Ingesta de llamadas  
- Score visible en CRM

**Requisitos**  
- OAuth  
- Webhooks  
- Sync datos

**Riesgo**  
Dependencia de APIs externas

---

## 6. Plataforma Educativa

**Qué vendes**  
Entrenamiento de ventas con evaluación automática.

**Cliente ideal**  
- Bootcamps  
- Universidades

**Pricing**  
- $1k–$10k/año por institución

**MVP**  
- Prácticas + evaluación automática

**Riesgo**  
Ventas lentas (B2G / educación)

---

## Estrategia Recomendada

1. SaaS (validar rápido)
2. Coaching (subir ticket)
3. API (escala)

**Ejecución realista**
- Semana 1–2: vender con demos manuales  
- Semana 3–6: construir SaaS básico  
- Semana 6+: añadir coaching

---

## Insight Clave

El valor no es el scoring, es:
- Qué haces con ese scoring
- Qué decisiones permite tomar

Si no genera acción → no se paga.
