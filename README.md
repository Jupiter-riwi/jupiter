# 🪐 Júpiter - API Gateway (Golang)

Orquestador central de tráfico, autenticación y comunicación asíncrona con Workers.

## Stack Técnico

- **Lenguaje:** Go 1.21+
- **Framework Web:** Gin / Fiber
- **ORM:** GORM (PostgreSQL)
- **WebSockets:** Gorilla WebSocket
- **Colas:** RabbitMQ

## Guía de Inicio

1. **Resolver dependencias:**
   ```bash
   go mod tidy
   ```

2. **Correr servidor en desarrollo:**
   ```bash
   go run cmd/api/main.go
   ```

## Especificaciones del Sistema

Por defecto, la API se despliega y expone sus servicios REST y WebSockets en el puerto: **8080**

## Reglas de Git y Flujo de Trabajo

Todo el equipo se acoge a las directrices delineadas en el archivo principal de `skill-git.md`. Puntualmente para el desarrollo, tener en consideración que las tareas de Gateway deben desarrollarse en ramas `feature/`.
* **Nota importante para el equipo:** Solo **Juanes (Estka)** tiene el permiso de Code Review y para probar/mergear hacia la rama productiva `main`.
