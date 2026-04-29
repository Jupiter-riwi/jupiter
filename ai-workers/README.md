# FastAPI + RabbitMQ — Servicio de Telemetría

Servidor base con **FastAPI**, **uvicorn** y **pika** que consume mensajes de la cola `telemetry_queue`.

## Estructura

```
fastapi-rabbitmq/
├── app/
│   ├── __init__.py
│   ├── main.py          # Servidor FastAPI + lifespan
│   ├── rabbitmq.py      # Conexión y canal pika
│   └── consumer.py      # Consumer asíncrono (hilo daemon)
├── .env.example
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

## Inicio rápido (local)

```bash
# 1. Clonar / ubicarse en el directorio
cd fastapi-rabbitmq

# 2. Entorno virtual
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# 3. Dependencias
pip install -r requirements.txt

# 4. Variables de entorno (opcional, los defaults apuntan a localhost)
cp .env.example .env

# 5. RabbitMQ local con Docker
docker run -d --name rabbitmq \
  -p 5672:5672 -p 15672:15672 \
  rabbitmq:3.13-management-alpine

# 6. Arrancar el servidor
uvicorn app.main:app --reload
```

## Inicio con Docker Compose (todo en uno)

```bash
docker compose up --build
```

## Endpoints

| Método | Ruta      | Descripción                                      |
|--------|-----------|--------------------------------------------------|
| GET    | `/health` | Estado del servicio y conectividad con RabbitMQ  |
| GET    | `/docs`   | Swagger UI interactivo                           |

### Ejemplo de respuesta `/health`

```json
{
  "status": "ok",
  "service": "fastapi-rabbitmq",
  "rabbitmq": "ok",
  "queue": "telemetry_queue",
  "messages_in_queue": 0
}
```

## Publicar un mensaje de prueba

```bash
python - <<'EOF'
import pika, json

conn = pika.BlockingConnection(pika.ConnectionParameters("localhost"))
ch = conn.channel()
ch.queue_declare(queue="telemetry_queue", durable=True)
ch.basic_publish(
    exchange="",
    routing_key="telemetry_queue",
    body=json.dumps({"sensor": "temp-01", "value": 23.5}),
    properties=pika.BasicProperties(delivery_mode=2),
)
print("Mensaje enviado ✓")
conn.close()
EOF
```

El consumer imprimirá en consola:

```
2024-05-01T12:00:00 | INFO     | app.consumer | [2024-05-01T12:00:00Z] 📨 Mensaje recibido | queue=telemetry_queue | delivery_tag=1 | payload={"sensor": "temp-01", "value": 23.5}
```
