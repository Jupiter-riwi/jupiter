# Checklist E2E (backend adaptado al frontend actual)

> Este checklist valida la integracion sin modificar la composicion del frontend.

---

## 1) Preparar entorno

```bash
make up
make seed
make health
```

Resultado esperado:

- Gateway responde `200` en `/health`.
- MinIO y RabbitMQ arriba.
- Datos demo creados (tenant + usuarios + preguntas).

Credenciales demo por defecto (ajustables por env):

- `seller.demo@jupiter.local` / `Demo1234!`
- `admin.demo@jupiter.local` / `Demo1234!`

---

## 2) Validar login y token

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seller.demo@jupiter.local","password":"Demo1234!"}'
```

Resultado esperado:

- Respuesta con `access_token` y `refresh_token`.

---

## 3) Validar flujo de evaluacion

1. `POST /api/evaluations` con bearer token.
2. Subir video con `PUT` a `upload_url` presignada.
3. `POST /api/evaluations/{id}/complete`.
4. Polling `GET /api/evaluations/{id}` hasta `completed` o `failed`.

Resultado esperado:

- Estado transiciona: `pending` -> `processing` -> `scoring` -> `completed`.
- Se genera score final o error trazable.

---

## 4) Validar preguntas y listado

- `GET /api/questions` retorna preguntas del tenant.
- `GET /api/evaluations` lista historial del usuario autenticado.

---

## 5) Validar compatibilidad con frontend actual

Sin tocar frontend, confirmar que backend ya soporta:

- Prefijo de rutas `/api`.
- CORS para `http://localhost:5173`.
- URLs presignadas utilizables desde navegador (`MINIO_PUBLIC_ENDPOINT`).

---

## 6) Criterio de pase

Integracion backend/frontend lista para MVP cuando:

- [ ] Login demo funciona.
- [ ] Create/upload/complete funciona.
- [ ] Evaluacion llega a estado final.
- [ ] Preguntas e historial responden correctamente.
- [ ] No hay errores P0/P1 de contrato API.
