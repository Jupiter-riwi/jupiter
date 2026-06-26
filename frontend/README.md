# Apex Vision - Frontend

Este directorio contiene el frontend de la aplicación **Apex Vision**. Dado que la aplicación se ejecuta de manera independiente para fines de demostración y evaluación, cuenta con una arquitectura de "Mock Backend" completamente integrada en el cliente.

## Estructura de Archivos

- **`api-client.js`**: Este es el núcleo de las comunicaciones y la seguridad. Actúa como un interceptor y simula el backend directamente en el navegador. Gestiona la creación de usuarios, la validación de credenciales (hasheo), la emisión de tokens JWT simulados (Access Token de 15 minutos y Refresh Token de 7 días) y almacena todos los datos en `localStorage` (usuarios, métricas, tokens y evaluaciones).
- **`admin-app.jsx`**: Panel de control de administración. Cuenta con una capa de autenticación que protege las rutas. Desde aquí, los directores pueden visualizar las métricas del equipo, el score promedio, las evaluaciones recientes y descontar tokens de IA para generar "Planes de Coaching" automatizados.
- **`seller-app.jsx`**: Aplicación para el vendedor/usuario. Permite iniciar sesión, registrar una nueva cuenta y ejecutar simulaciones de venta que descuentan saldo global de IA y se registran dinámicamente en el panel de administrador.
- **`*.html`**: Puntos de entrada principales (`Apex Vision Console.html` para admin y `Apex Vision Vendedor.html` para vendedores). Utilizan Babel Standalone para compilar React/JSX en tiempo de ejecución.
- **`styles.css` / `styles-admin.css` / `styles-seller.css`**: Hojas de estilo que proveen el diseño visual premium, dark mode y layout de componentes tipo glassmorphism.

## Seguridad Implementada (Mock)

A pesar de ser una aplicación puramente frontend en este repositorio, cuenta con seguridad implementada a nivel lógico:
1. **Hasheo de Contraseñas:** Las contraseñas de los usuarios no se guardan en texto plano. Se procesan usando `crypto.subtle.digest('SHA-256')` nativo del navegador antes de almacenarse en `localStorage`.
2. **Tokens de Sesión (JWT Mock):**
   - El sistema emite un **Access Token** corto que expira en 15 minutos.
   - El sistema también emite un **Refresh Token** de larga duración.
   - Si el *Access Token* caduca, el cliente automáticamente usa el *Refresh Token* para obtener una sesión fresca sin interrumpir al usuario.
3. **Control de Roles:** Un usuario tipo "SELLER" no puede iniciar sesión en la consola del administrador. Se requiere el rol "ADMIN".

## Uso y Métricas
- Los botones de acciones como exportar PDF y generar CSV son funcionales en el Admin App, compilando datos directamente del estado local.
- Las evaluaciones realizadas en `seller-app.jsx` reducen los tokens de IA (saldo almacenado en `apex_tokens`) y las interacciones se comparten de forma global con el admin usando `apex_db_evaluations`.

## Consideraciones
* Esta arquitectura está diseñada para evaluación y prueba (demo mode). En un entorno de producción real, toda la lógica de validación criptográfica, emisión de JWT y verificación debe trasladarse al backend (API Gateway).
