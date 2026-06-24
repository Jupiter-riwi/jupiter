# Plan de cierre para integracion Frontend (por responsables)

> Horizonte: sprint tecnico corto (7 dias habiles). Objetivo: dejar el flujo MVP end-to-end estable para pasar a integracion en `developer`.

Estado de este plan: **actualizado al corte actual del repositorio**.

---

## 1) Objetivo de salida

Al final del plan debe funcionar de punta a punta:

1. Login.
2. Crear evaluacion.
3. Subir video por URL presignada.
4. Disparar procesamiento.
5. Recibir progreso en vivo.
6. Ver score y recomendaciones en dashboard.

---

## 2) Responsables por frente

- **Dev 1:** pose + whisper (pipeline de features de video/audio).
- **Dev 2:** prosody + scoring (fan-in final y score consistente).
- **Dev 3:** gateway + contratos API/WS + DB/migraciones + compose.
- **Dev 4:** frontend (auth, evaluacion, progreso, dashboard real).

---

## 3) Plan por dias (7 dias)

Nota: varias tareas de backend ya estan adelantadas; los dias aqui se deben tomar como bloques de trabajo pendientes, no como fechas historicas.

## Dia 1 - Congelamiento de contratos (todos)

Responsable principal: **Dev 3**. Soporte: Dev 1/2/4.

- Definir contrato final de rutas (incluyendo prefijo `/api` o sin prefijo, uno solo).
- Definir contrato final de eventos de progreso (`feature.ready`, `score.ready`, `error` o alternativa final).
- Definir contrato final de `features` y `scores` en DB.
- Actualizar docs canonicas para que no haya contradicciones.

Entregable:

- Contrato firmado en PR de docs + OpenAPI consistente.

## Dia 2 - Alineacion backend (gateway + DB)

Responsable principal: **Dev 3**.

- Alinear modelos/repositorios con migraciones reales.
- Asegurar compatibilidad de `POST /evaluations`, `POST /evaluations/{id}/complete`, `GET /evaluations/{id}`, `GET /questions`.
- Cerrar huecos de multi-tenant y estado de evaluaciones.

Entregable:

- Backend compila/arranca y responde contrato acordado.

## Dia 3 - Alineacion workers de features

Responsables: **Dev 1 + Dev 2**.

- Elegir una sola linea de workers para produccion local (evitar duplicidad stub vs avanzada).
- Ajustar writer de features al esquema final (`payload`/tipos/metadata).
- Validar que pose, whisper y prosody publiquen/persistan consistentemente.

Entregable:

- 3 features listas por evaluacion en DB.

## Dia 4 - Fan-in y scoring final

Responsables: **Dev 2 + Dev 3**.

- Garantizar trigger unico a scoring cuando esten las 3 features.
- Corregir inconsistencias del worker de scoring y persistencia en `scores`.
- Publicar evento final de score listo.

Entregable:

- 1 score por evaluacion, idempotente, con payload valido.

## Dia 5 - Integracion frontend funcional

Responsable principal: **Dev 4**. Soporte: Dev 3.

- Conectar login real al backend.
- Implementar flujo create/upload/complete.
- Consumir progreso en vivo.
- Renderizar resultado final real (score + recomendaciones).

Entregable:

- Vertical slice completo funcionando desde UI.

---

## 3.1 Estado actual (corte tecnico)

### Avance confirmado

- Gateway expone rutas necesarias y soporta prefijo `/api`.
- CORS y presigned upload estan alineados para navegador local.
- Flujo base frontend ya invoca login/create/upload/complete/get.

### Brechas bloqueantes que siguen abiertas

1. **Frontend no esta en estructura Vite completa**
   - En `frontend/` faltan archivos esperados de build (`package.json`, `vite.config`, `index.html`, `src/main.tsx`).
   - Impacto: `docker-compose` y build de frontend no son ejecutables hoy.

2. **Seed no crea usuarios de login**
   - `api-gateway/seed.py` siembra tenant y preguntas, pero no usuarios.
   - Impacto: no hay credenciales de entrada para validar flujo E2E de frontend sin registro manual.

3. **Progreso en vivo no esta integrado por WebSocket en frontend**
   - El frontend actual usa polling de `GET /evaluations/{id}` cada 3s.
   - Impacto: no cumple completamente el objetivo de seguimiento en vivo definido en plan/docs.

4. **Contrato de eventos WS requiere cierre funcional**
   - Existe endpoint stream en backend, pero falta consumo efectivo desde UI y validacion de UX de estados.

---

## 3.2 Plan ajustado de cierre (pendiente)

### Estrategia vigente (sin cambiar frontend)

- El frontend actual se mantiene tal como esta (composicion publica en HTML + JSX).
- El backend debe exponer contratos y comportamiento compatibles para cuando la UI consuma datos reales, sin exigir refactor de frontend.
- Cualquier ajuste de integracion se hace del lado backend/infra/seed.

### Bloque A - Recuperar runtime frontend (P0)

Owner: **Dev 4**

- Restaurar estructura ejecutable de app frontend (Vite + TS).
- Confirmar que `docker-compose` levanta frontend sin errores.

Nota: este bloque no implica rediseñar UI ni cambiar composicion funcional; solo asegurar runtime.

### Bloque B - Flujo de acceso de prueba (P0)

Owners: **Dev 3 + Dev 4**

- Definir estrategia de acceso para QA:
  - registro desde UI, o
  - seed de usuario demo con password conocida.
- Documentar credenciales y pasos en `docs/`.

Nota: prioridad alta porque el frontend no debe modificarse para poder iniciar pruebas.

### Bloque C - Progreso en vivo real (P1)

Owner: **Dev 4** (con soporte Dev 3)

- Integrar WS `/api/evaluations/{id}/stream` en frontend.
- Mantener polling como fallback solo si WS falla.

Si el frontend no se toca en esta fase, al menos se debe dejar backend listo y estable para WS con contrato congelado.

### Bloque D - QA de integracion (P1)

Owners: **Todos**

- 3 corridas E2E con evidencia.
- Verificar estados y score final en dashboard.
- Cierre de bugs P0/P1.

## Dia 6 - QA de integracion

Responsable principal: **Dev 4**. Soporte: todos.

- Smoke E2E (3 corridas).
- Pruebas de error: permiso camara/mic, upload fallido, worker fallido.
- Validacion basica multi-tenant (2 tenants).

Entregable:

- Evidencia de pruebas + lista de bugs priorizada.

## Dia 7 - Cierre tecnico y gate de merge

Responsable principal: **Tech Lead / Dev 3**.

- Corregir bugfixes criticos P0/P1.
- Confirmar checklist final de integracion.
- Preparar PR `features -> developer` con evidencia.

Entregable:

- Decision de merge con criterio tecnico objetivo.

---

## 4) Matriz RACI simplificada

| Tarea | R | A | C | I |
|---|---|---|---|---|
| Contrato API/WS/DB | Dev 3 | Dev 3 | Dev 1, Dev 2, Dev 4 | Todos |
| Pipeline pose/whisper | Dev 1 | Dev 1 | Dev 3 | Dev 2, Dev 4 |
| Pipeline prosody/scoring | Dev 2 | Dev 2 | Dev 3 | Dev 1, Dev 4 |
| Fan-in y estado evaluacion | Dev 3 | Dev 3 | Dev 2 | Dev 1, Dev 4 |
| Flujo UI end-to-end | Dev 4 | Dev 4 | Dev 3 | Dev 1, Dev 2 |
| QA E2E + release gate | Dev 4 | Dev 3 | Dev 1, Dev 2 | Todos |

---

## 5) Criterios de exito (Definition of Done)

- [ ] Frontend consume API real sin mocks.
- [ ] Se crean evaluaciones y suben videos correctamente.
- [ ] Los 3 features se generan y persisten por evaluacion.
- [ ] Scoring se dispara automaticamente y persiste resultado.
- [ ] Frontend recibe progreso y estado final en vivo.
- [ ] Dashboard muestra score/recomendaciones reales.
- [ ] 3 corridas E2E consecutivas en verde.
- [ ] Sin bugs P0/P1 abiertos.

---

## 6) Riesgos y mitigacion

- **Riesgo:** divergencia de contratos entre equipos.
  - **Mitigacion:** no codear cambios de contrato sin PR de docs + OpenAPI.

- **Riesgo:** doble implementacion de workers genera confusion operativa.
  - **Mitigacion:** declarar una ruta oficial y desactivar la alternativa en compose.

- **Riesgo:** integracion tarde por desalineacion frontend/backend.
  - **Mitigacion:** daily corto backend-frontend con checklist de endpoints.

---

## 7) Comandos de validacion sugeridos

```bash
# Infra completa
make up
make health

# Gateway tests
# (ejecutar donde este disponible Go)
go test ./...

# Workers tests
# (ejecutar donde este disponible Python)
python -m pytest prosody/tests/ scoring/tests/ -v

# Frontend
npm install
npm run build
```

Si un entorno no tiene toolchain instalado (Go/Python/Node), registrar esa limitacion en el acta de QA y validar en CI o en la maquina del owner del dominio.

Checklist operativo detallado:

- `docs/CHECKLIST_E2E_BACKEND_FRONTEND_SIN_CAMBIAR_UI.md`
