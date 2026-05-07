# Plan de cierre para integracion Frontend (por responsables)

> Horizonte: sprint tecnico corto (7 dias habiles). Objetivo: dejar el flujo MVP end-to-end estable para pasar a integracion en `developer`.

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
