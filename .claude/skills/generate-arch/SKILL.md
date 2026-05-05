---
name: generate-arch
description: Genera o actualiza un ARCHITECTURE.md en la raíz de un proyecto, en español, con flujo funcional, diagrama ASCII, modelo de datos, stack, fases de construcción, MCPs/skills útiles y riesgos. Usar cuando el usuario pida "documentar la arquitectura", "armar la arquitectura", "generar ARCHITECTURE.md", "actualizar el doc de arquitectura", o describa un MVP/sistema y quiera plasmarlo en un documento canónico. También aplica si el usuario menciona que cerró una decisión arquitectónica y quiere reflejarla en el doc, o si está iterando sobre un MVP y necesita mantener el documento sincronizado con el estado actual del proyecto.
---

# generate-arch

Esta skill produce un `ARCHITECTURE.md` en la raíz del proyecto que captura el diseño de un MVP de forma consistente y accionable. Sirve tanto para crear el documento desde cero como para actualizarlo a medida que el proyecto evoluciona.

## Por qué existe

Los docs de arquitectura tienden a desincronizarse del código y de las decisiones. Esta skill impone una estructura fija de 9 secciones, distingue decisiones **cerradas** de **abiertas**, y preserva el contexto histórico cuando ya existe el archivo. La idea es que el doc sea una fuente de verdad útil para onboarding, planning y revisión, no un PDF que nadie lee.

## Workflow

### 1. Detectar si es creación o actualización

Buscá `docs/ARCHITECTURE.md` en el proyecto (path estándar del repo). Si existe, **leelo entero antes de hacer cualquier cambio**. Fallback: si no existe la carpeta `docs/`, buscalo en la raíz. El doc existente puede tener decisiones cerradas que no hay que pisar (ver "Reglas de preservación" más abajo).

### 2. Reunir inputs

Necesitás claridad sobre:

- **Flujo funcional**: ¿qué hace el sistema, paso a paso, desde la perspectiva del usuario final?
- **Stack**: ¿qué tecnologías están definidas? ¿cuáles hay que recomendar?
- **Servicios externos**: APIs (OpenAI, Stripe, etc.), storage, DBs
- **Código existente reutilizable**: ¿hay un repo previo? ¿qué piezas se reciclan?
- **Multi-tenancy / auth**: ¿hay aislamiento por cliente?

Si la conversación actual ya tiene esta info (típico cuando el usuario viene de discutir el MVP), **usala directamente sin preguntar de nuevo**. Si falta algo crítico, preguntá una sola vez de forma agrupada — no hagas un interrogatorio.

Si una pieza no está definida y el usuario no la menciona, **no la inventes**: listala en la sección 9 como "decisión abierta".

### 3. Generar el documento

Escribí el archivo con exactamente estas 9 secciones, en este orden, en español. Cada una tiene un propósito específico — no las renombres ni reordenes.

#### Sección 1 — Flujo funcional del MVP

Lista numerada paso a paso, desde que el usuario entra al sistema hasta que ve un resultado. Que sea narrativo, no técnico. El lector debería entender el producto sin saber nada del stack.

#### Sección 2 — Diagrama de arquitectura

ASCII art mostrando los componentes principales y cómo se comunican. Incluí:
- Frontend, gateway, workers, cola, DB, storage, servicios externos
- Flechas con el tipo de comunicación (HTTP, WS, publish/consume, read/write)
- Anotaciones cortas en cada componente (stack, rol)

El diagrama debe ser consistente con la sección 6 (stack). Si el stack dice FastAPI, el diagrama no puede decir Go.

#### Sección 3 — Reutilización de código existente

Tabla con columnas: **Componente repo actual | Destino MVP | Acción**. Una fila por pieza relevante del repo previo. Indicá explícitamente qué se recicla, qué se refactoriza, y qué se descarta.

Si no hay repo previo, omití la tabla y poné una nota: "_No hay código previo; todo se construye desde cero._"

#### Sección 4 — Modelo de datos

SQL mínimo viable (solo `CREATE TABLE` o equivalente, sin índices ni constraints exhaustivos). Enfocate en las entidades que aparecen en el flujo de la sección 1. Si hay multi-tenancy, mostrá `tenant_id` en cada tabla y mencioná RLS o la estrategia equivalente.

#### Sección 5 — Contrato de respuesta del LLM

Solo si el sistema usa un LLM. Mostrá un JSON ejemplo de la salida estructurada que se espera del LLM, con los campos que el resto del sistema consume. Mencioná si se usa JSON mode / structured output / function calling.

Si no hay LLM, omití la sección y renumerá.

#### Sección 6 — Stack tecnológico recomendado

Tabla con columnas: **Capa | Tecnología | Razón**. Cubrí: frontend, gateway, workers, cola/bus, DB, storage, auth, servicios externos. Marcá decisiones cerradas vs sugeridas:
- "(decidido)" — cerrado, no se discute
- "(sugerido)" — recomendación abierta a discusión

#### Sección 7 — Plan de construcción por fases

Fases numeradas (típicamente 4-5), cada una con duración aproximada y entregable concreto. Empezá por un **vertical slice** mínimo (Fase 0 o 1) que ejercite todo el stack extremo a extremo, aunque sea con stubs. Las fases siguientes agregan profundidad, no amplitud.

No des fechas absolutas. Sí estimaciones relativas (días/semanas).

#### Sección 8 — MCPs y Skills útiles para construir esto

Dos sub-secciones:

**MCPs ya disponibles en el entorno** que aporten al proyecto. Una tabla con: **MCP | Para qué sirve en este proyecto**. Solo listá MCPs que realmente apliquen — no todos, no inventes.

**Skills útiles** (built-in y custom propuestas). Tabla similar. Para skills custom, describí qué scaffolding o automatización aportarían.

#### Sección 9 — Riesgos y decisiones abiertas

Lista numerada. Para cada ítem:
- **Decisión abierta**: qué hay que decidir + opciones a considerar
- **Riesgo**: qué puede salir mal + mitigación

Marcá explícitamente cuando una decisión previamente abierta se haya cerrado: `~~Texto original~~ → **resuelto: X**`. Esto preserva la trazabilidad.

### 4. Reglas de preservación (cuando actualizás un doc existente)

Estas reglas son las que hacen útil iterar el doc en lugar de regenerarlo:

1. **No pisar decisiones cerradas.** Si el doc existente dice "(decidido)" o "**resuelto:**" en algún punto, mantenelo. La única forma de cambiar una decisión cerrada es que el usuario lo pida explícitamente en el turno actual.
2. **Mover, no borrar.** Cuando una decisión abierta se cierra, marcala con tachado + "resuelto" en lugar de eliminarla. El historial de decisiones es valioso.
3. **Consistencia cruzada.** Después de actualizar una sección, releé las otras. Si cambiaste el stack, actualizá el diagrama. Si agregaste una entidad al modelo de datos, asegurate de que aparezca en el flujo funcional.
4. **Conservar el tono.** Si el doc existente usa cierta terminología (ej: "vendedor" vs "usuario"), seguila.

### 5. Verificación final

Antes de cerrar, releé el doc completo y chequeá:

- [ ] Las 9 secciones están en orden (o las que aplican, si omitiste sección 5).
- [ ] El diagrama, el stack y el flujo cuentan la misma historia.
- [ ] No hay invenciones: cada componente está justificado por algo en la conversación.
- [ ] Decisiones cerradas marcadas como "decidido"; abiertas listadas en sección 9.
- [ ] Si hay multi-tenancy, está reflejada en modelo de datos, gateway y diagrama.

Mostrale al usuario el path del archivo escrito y un resumen de 2-3 líneas de qué cambió (si fue actualización) o qué decisiones quedaron abiertas (si fue creación).

## Anti-patrones a evitar

- **Sobre-especificar.** No agregues secciones de "patrones de diseño", "principios SOLID", o boilerplate genérico. El doc es sobre **este** sistema, no sobre buenas prácticas universales.
- **Inventar plazos.** No pongas "Q2 2026" o fechas concretas a menos que el usuario las haya dado.
- **Diagramas con UML pesado.** ASCII simple gana siempre. Si el usuario explícitamente pide Mermaid, usalo, pero el default es ASCII.
- **Tablas de 10 columnas.** Si una tabla no entra cómoda en pantalla, partila o convertila en lista.
- **"Recomendaciones" sin razón.** Cada elección de stack tiene una columna "Razón" que se llena con una frase concreta sobre **este** proyecto, no genérica.

## Ejemplo de invocación

Usuario: _"Ya cerramos que el gateway va en FastAPI. Actualizá la arquitectura."_

Pasos:
1. Leer `ARCHITECTURE.md` actual.
2. Buscar todas las menciones de Go / decisión Go-vs-Python.
3. En sección 6, cambiar la fila del gateway a "FastAPI (decidido)" y actualizar la "Razón".
4. En sección 3, marcar la fila del gateway Go como reemplazada.
5. En sección 9, tachar el ítem "API Gateway Go vs Python" y marcarlo como `**resuelto: FastAPI**`.
6. Actualizar el diagrama si decía "Go" en el componente gateway.
7. Reportar al usuario: "Actualicé secciones 3, 6, 9 y el diagrama para reflejar la decisión de FastAPI."
