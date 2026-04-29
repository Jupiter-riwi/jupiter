---
description: Júpiter - Políticas de Control de Versiones (skill-git)
---

# 🪐 Júpiter - Políticas de Control de Versiones (skill-git)

Este documento define el estándar oficial de colaboración para el proyecto Júpiter. Todo el equipo debe adherirse a estas reglas para garantizar la estabilidad del ecosistema.

## 1. Estrategia de Ramificación
* Utilizamos **GitHub Flow**.
* La rama `main` es sagrada y representa el estado actual de producción en Azure.
* Todo el código en `main` debe ser estable y funcional.

## 2. 🛡️ La Regla de Oro (Protección de main)
* **Prohibición de Push Directo**: Ningún desarrollador (Dairon, Valentina, Samuel, Julian) tiene permisos para hacer *commit* o *push* directamente a la rama `main`.
* **Exclusividad del Team Leader**: **Juanes (Estka)** es el único autorizado para realizar el Code Review final, aprobar y hacer *merge* de los Pull Requests hacia la rama `main`.

## 3. Nomenclatura de Ramas
Toda nueva tarea debe realizarse en una rama derivada de `main` con nombres en minúsculas:
* `feature/nombre-de-la-tarea` (Ej: `feature/login-ui`)
* `bugfix/descripcion-del-error` (Ej: `bugfix/jwt-token-error`)
* `hotfix/descripcion-urgente` (Para errores críticos en producción).

## 4. Convención de Commits
Se debe seguir la convención de "Conventional Commits":
* `feat:` (Nueva característica)
* `fix:` (Corrección de un bug)
* `chore:` (Tareas de mantenimiento o configuración inicial)
* `docs:` (Documentación técnica)

## 5. Flujo de Trabajo para Desarrolladores
1.  **Sincronizar**: `git checkout main` y `git pull origin main`.
2.  **Crear Rama**: `git checkout -b feature/nombre-tarea`.
3.  **Desarrollar**: Hacer commits claros y descriptivos.
4.  **Subir**: `git push origin feature/nombre-tarea`.
5.  **Pull Request**: Abrir un PR en GitHub hacia `main` y etiquetar a Juanes para revisión.
