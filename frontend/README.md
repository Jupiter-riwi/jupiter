# 🪐 Júpiter - Portal Multimodal (React + Vite)

Interfaz de usuario para la evaluación de oradores, visualización de métricas de IA en tiempo real y gestión de perfiles de Riwers.

## Stack Técnico

- **Librería UI:** React 18
- **Lenguaje:** TypeScript
- **Bundler:** Vite
- **Estilos:** Tailwind CSS
- **Peticiones HTTP:** Axios
- **Iconografía:** Lucide React

## Características Principales

- **Dashboard de métricas**: Telemetría de IA en tiempo real.
- **Módulo de evaluación**: Herramientas integradas con captura de streaming (audio/video).
- **Seguridad**: Autenticación segura mediante JSON Web Tokens (JWT).

## Guía de Inicio Rápido

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Correr en desarrollo:**
   ```bash
   npm run dev
   ```

3. **Construir para producción:**
   ```bash
   npm run build
   ```

## Conexión al Backend

Por defecto, la instancia del servicio base de axios (`src/services/api.ts`) está configurada para apuntar al API Gateway corriendo localmente bajo el puerto protegido:
`http://localhost:8080`

## Reglas de Git y Flujo de Trabajo

* Por lineamientos estrictos (acorde a nuestro archivo `skill-git.md`), el desarrollo y características nuevas requieren aislarse.
* **Nota importante para el equipo:** Solo **Juanes (Tech Lead)** tiene permiso para aprobar Pull Requests y hacer merges finales hacia la rama vital `main`.
