# 🪐 Júpiter - AI Workers Core (Python)

Microservicio encargado del procesamiento multimodal (Voz, Rostro y Lenguaje) mediante FastAPI.

## Stack Técnico

- **Lenguaje:** Python 3.10+
- **Framework:** FastAPI
- **Visión Asistida:** MediaPipe
- **Procesamiento de Audio:** Whisper
- **Cola de Mensajes:** Pika (RabbitMQ)

## Estructura del Proyecto

A continuación, la división del core para inteligencia artificial:

- `app/models/`: Encargado de empaquetar, almacenar y disponibilizar la capa lógica de Modelos de IA (MediaPipe, Whisper, LLMs).
- `app/services/`: Capa transaccional. Lógica para procesar y consumir audio/video y comunicación constante de colas con RabbitMQ.
- `app/api/`: Capa dedicada exclusivamente a exponer Endpoints seguros orientados tanto a la funcionalidad misma como a telemetría celular y salud del worker.

## Guía de Instalación

1. **Creación de entorno virtual:**
   ```bash
   python -m venv venv
   ```

2. **Activación de entorno virtual:**
   ```bash
   source venv/bin/activate
   ```

3. **Instalación de dependencias:**
   ```bash
   pip install -r requirements.txt
   ```

## Reglas de Contribución

Todo el equipo se acoge a las directrices delineadas en el archivo principal de `skill-git.md`. Puntualmente para el worker de AI, tener en consideración que todas las tareas en desarrollo, fix y chore de IA deben desarrollarse de manera aislada en ramas `feature/`.
