# Jupiter Sales Evaluator

Plataforma web multi-tenant que evalúa habilidades de equipos de ventas analizando lenguaje corporal y audio. Un vendedor responde una pregunta grabándose desde el navegador; el sistema procesa el video con MediaPipe (pose), OpenAI Whisper (transcripción) y librosa (prosodia), agrega los features y los envía a OpenAI GPT-4o para producir un **score** y **recomendaciones** accionables que se muestran en el perfil del vendedor.

## Documentación principal

| Documento | Para qué sirve |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Arquitectura completa del MVP: flujo, diagrama, modelo de datos, stack, fases, riesgos |
| [`TEAM.md`](./TEAM.md) | División de trabajo entre los 4 desarrolladores, contratos compartidos, cadencia |

Esos dos documentos son la fuente de verdad. Si encontrás una contradicción entre código y doc, abrí un PR para alinearlos.

## Estructura del repo

```
jupiter/
├── ARCHITECTURE.md          ← arquitectura del sistema
├── TEAM.md                  ← división de trabajo y contratos
├── README.md                ← este archivo
├── api-gateway/             ← FastAPI gateway (auth, multi-tenant, presigned URLs, WS)
├── ai-workers/              ← workers de IA (pose, whisper, prosody, scoring)
├── frontend/                ← React + Vite + Tailwind (grabación + dashboard)
└── .claude/
    └── skills/
        └── generate-arch/   ← skill personal para mantener ARCHITECTURE.md
```

## Cómo arrancar (cuando Fase 0 esté lista)

```bash
docker compose up -d        # levanta Postgres, RabbitMQ, MinIO, gateway, workers, frontend
make seed                   # crea tenant demo + usuarios + preguntas
open http://localhost:5173  # frontend
```

Ver detalle por servicio en cada subcarpeta (`api-gateway/README.md`, `ai-workers/README.md`, `frontend/README.md`).

---

## Skill incluida: `generate-arch`

En este repo viene una **skill de Claude Code** llamada [`generate-arch`](./.claude/skills/generate-arch/SKILL.md) que ayuda a mantener `ARCHITECTURE.md` sincronizado con el estado real del proyecto a medida que tomamos decisiones.

### Qué hace

Genera o **actualiza** el `ARCHITECTURE.md` del proyecto preservando las decisiones que ya están cerradas. Estructura el documento en 9 secciones fijas (flujo funcional, diagrama, reutilización de código, modelo de datos, contrato del LLM, stack, fases, MCPs/skills, riesgos) y mantiene consistencia cruzada entre ellas — si cambia el stack, también se actualiza el diagrama; si se cierra una decisión abierta, queda marcada con tachado + "resuelto" para preservar el historial.

### Cuándo se activa

La skill se dispara automáticamente cuando le pedís a Claude Code cosas como:

- _"actualizá el ARCHITECTURE.md, ya cerramos que el gateway va en FastAPI"_
- _"documentá la arquitectura de este nuevo módulo"_
- _"generá el doc de arquitectura para este MVP"_
- _"cerramos esta decisión, reflejala en el doc"_

También podés invocarla explícitamente con `/generate-arch`.

### Cómo se usa en el equipo

Cualquier cambio en contratos compartidos (schema de DB, schema de jobs, contrato del LLM, decisiones de stack) tiene que pasar por una actualización de `ARCHITECTURE.md` antes de implementarse. La skill se encarga de:

1. **Leer el doc actual** y entender qué decisiones ya están cerradas (no las pisa).
2. **Aplicar el cambio** en las secciones afectadas.
3. **Verificar consistencia** entre secciones (diagrama vs stack vs flujo).
4. **Marcar el nuevo estado** de la decisión: `(decidido)`, `(sugerido)`, o `pendiente` en la sección 9.

### Ubicación

- En el repo: [`.claude/skills/generate-arch/SKILL.md`](./.claude/skills/generate-arch/SKILL.md) — versionada con el equipo.
- Para uso personal en cualquier proyecto: copiala a `~/.claude/skills/generate-arch/`.

### Anti-patrones que evita

- Inventar fechas o features no pedidas
- Boilerplate genérico (SOLID, "buenas prácticas universales")
- Pisar decisiones cerradas
- Diagramas con UML pesado (default es ASCII)

---

## Contribuir

1. Branch siguiendo el patrón `<area>/feature/<descripción>` (ver branches existentes).
2. PRs chicos (< 400 líneas idealmente).
3. Review obligatorio de al menos 1 dev fuera del dominio.
4. Si tu cambio toca un contrato compartido (ver `TEAM.md`), actualizá `ARCHITECTURE.md` en el mismo PR usando `/generate-arch`.
