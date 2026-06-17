# Despliegue en Supabase

Proyecto: **Jupiter Sales Evaluator**
Supabase project ref: `YOUR_SUPABASE_PROJECT_REF`
URL: `https://YOUR_SUPABASE_PROJECT_REF.supabase.co`

---

## Qué usamos de Supabase

| Servicio | Para qué |
|---|---|
| **PostgreSQL** | Base de datos principal (tenants, users, evaluations, scores) |
| **Auth** | Autenticación de vendedores y admins (JWT automático) |
| **Storage** | Bucket `videos` para las grabaciones de los vendedores |
| **Realtime** | Notificaciones al frontend cuando el score está listo |
| **Row Level Security** | Aislamiento de datos por tenant |

---

## MCP configurado

El MCP de Supabase está configurado en `.mcp.json` a nivel de proyecto:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=YOUR_SUPABASE_PROJECT_REF"
    }
  }
}
```

Esto permite que Claude Code interactúe directamente con el proyecto Supabase (leer tablas, ejecutar SQL, inspeccionar schema, crear buckets, etc.) **sin salir del editor**.

Para activarlo: reiniciar Claude Code después de hacer `git pull` en `developer`.

---

## Aplicar el schema inicial

### Opción A — Desde Claude Code (recomendado con MCP activo)

Una vez que el MCP esté cargado, pedirle a Claude:
```
"aplicá la migración supabase/migrations/20260505000000_initial_schema.sql al proyecto"
```

### Opción B — Desde el dashboard de Supabase

1. Ir a [supabase.com/dashboard](https://supabase.com/dashboard) → proyecto `YOUR_SUPABASE_PROJECT_REF`
2. **SQL Editor** → New query
3. Pegar el contenido de `supabase/migrations/20260505000000_initial_schema.sql`
4. Ejecutar

### Opción C — Supabase CLI

```bash
# Instalar CLI (si no está)
brew install supabase/tap/supabase

# Login
supabase login

# Linkear al proyecto remoto
supabase link --project-ref YOUR_SUPABASE_PROJECT_REF

# Aplicar migraciones
supabase db push
```

---

## Seed de datos demo

Después de aplicar el schema, correr el seed para tener datos de prueba:

```bash
# Desde el SQL Editor del dashboard o via CLI:
supabase db reset  # (solo en dev — resetea y aplica seed)

# O manualmente desde el dashboard:
# SQL Editor → pegar supabase/seed.sql → ejecutar
```

---

## Variables de entorno necesarias

Ver `.env.example`. Las claves están en:
**Dashboard → Settings → API**

| Variable | Dónde obtenerla |
|---|---|
| `SUPABASE_ANON_KEY` | Settings → API → Project API keys → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → Project API keys → service_role |
| `DATABASE_URL` | Settings → Database → Connection string → URI |

> El `SERVICE_ROLE_KEY` solo va en los workers y el gateway (backend). **Nunca en el frontend.**

---

## Storage — bucket `videos`

El bucket `videos` se crea automáticamente al aplicar la migración (está en el SQL). Configuración:

- **Privado**: los videos solo son accesibles via signed URLs (no públicos)
- **Tamaño máximo**: 500 MB por archivo
- **Tipos permitidos**: `video/webm`, `video/mp4`, `video/quicktime`

Para generar una signed URL desde el gateway:
```python
# Python (supabase-py)
from supabase import create_client

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
signed = supabase.storage.from_("videos").create_signed_upload_url(f"{user_id}/{evaluation_id}.webm")
```

---

## Autenticación

Supabase Auth maneja el login. El flujo con el frontend:

```
1. Frontend llama supabase.auth.signInWithPassword({ email, password })
2. Supabase devuelve JWT con el user.id (auth.uid())
3. Cada request al gateway incluye el JWT en Authorization: Bearer <token>
4. Gateway verifica el JWT con SUPABASE_JWT_SECRET o via Supabase API
5. Para obtener el tenant_id: SELECT tenant_id FROM profiles WHERE id = auth.uid()
```

---

## Realtime — notificaciones de score

Supabase Realtime permite que el frontend reciba el score sin polling:

```typescript
// Frontend (supabase-js)
const channel = supabase
  .channel('evaluation-updates')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'scores',
    filter: `evaluation_id=eq.${evaluationId}`
  }, (payload) => {
    console.log('Score listo:', payload.new)
  })
  .subscribe()
```

Esto reemplaza el WebSocket custom que teníamos planificado en el gateway.

---

## Estructura de archivos Supabase en el repo

```
supabase/
├── migrations/
│   └── 20260505000000_initial_schema.sql   ← schema completo + RLS + storage
└── seed.sql                                 ← datos demo (tenant + preguntas)
```

Cada vez que se modifique el schema, crear un nuevo archivo de migración con timestamp:
```
supabase/migrations/YYYYMMDDHHMMSS_descripcion.sql
```
Nunca editar una migración que ya fue aplicada al proyecto.

---

## Decisiones tomadas con Supabase

| Decisión | Resultado |
|---|---|
| Auth | Supabase Auth — reemplaza JWT custom del gateway |
| WebSocket para score | Supabase Realtime — reemplaza WS custom |
| Storage de videos | Supabase Storage (bucket `videos`) — reemplaza MinIO |
| DB local (docker-compose) | Se mantiene para desarrollo offline |
| RLS | Habilitado en todas las tablas públicas |
