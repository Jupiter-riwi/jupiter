# src - Componentes React y Páginas

Carpeta principal con la estructura del frontend React (componentes compartidos y páginas).

## 📁 Estructura

```
src/
├── components/
│   ├── common/
│   │   ├── Button.tsx          # Componente Button reutilizable
│   │   └── Input.tsx           # Componente Input reutilizable
│   ├── EvaluationRoom.tsx      # [DEPRECATED - Usar UI/EvaluationRoom.tsx]
│   └── EvaluationRoom.css      # [DEPRECATED - Usar UI/EvaluationRoom.css]
│
├── pages/
│   ├── Login/
│   │   ├── Login.tsx           # Página de login principal
│   │   ├── LoginForm.tsx       # Formulario de login
│   │   ├── Login.css           # Estilos de login
│   │   ├── jupiter-login-v2.html
│   │   ├── jupiter-login-v2.css
│   │   └── logic.js
│   │
│   ├── Evaluation/
│   │   ├── EvaluationPage.tsx  # [DEPRECATED - Usar UI/EvaluationPage.tsx]
│   │   └── [README.md debe estar en UI/]
│   
└── README.md                    # Este archivo
```

## 🎯 Componentes Comunes (src/components/common/)

### Button.tsx
Componente botón reutilizable con múltiples variantes.

**Props:**
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  className?: string;
  fullWidth?: boolean;
}
```

**Variantes:**
- `primary`: Gradiente cyan, sombra azulada
- `secondary`: Fondo oscuro, borde cyan
- `outline`: Transparente, borde cyan

**Uso:**
```tsx
<Button variant="primary" onClick={() => console.log('Click')}>
  Iniciar
</Button>
```

### Input.tsx
Componente input reutilizable con validación.

**Props:**
```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  className?: string;
}
```

**Uso:**
```tsx
<Input 
  type="email" 
  placeholder="tu@email.com"
  label="Correo"
  error={validationError}
/>
```

## 📄 Páginas

### Login/
Página y componentes de autenticación del usuario.

**Archivos:**
- `Login.tsx`: Componente página principal
- `LoginForm.tsx`: Formulario de login
- `Login.css`: Estilos
- `jupiter-login-v2.html/css/js`: Versión alternativa en HTML puro

### Evaluation/
Página de sala de evaluación (ver archivo en `/UI/README.md` para más detalles).

## ⚠️ MIGRACIÓN: Archivos Renovados

**Los siguientes archivos han sido movidos a la carpeta `/UI/`:**

| Archivo Antiguo | Nueva Ubicación | Razón |
|---|---|---|
| `src/components/EvaluationRoom.tsx` | `UI/EvaluationRoom.tsx` | Organización de estructura |
| `src/components/EvaluationRoom.css` | `UI/EvaluationRoom.css` | Organización de estructura |
| `src/pages/Evaluation/EvaluationPage.tsx` | `UI/EvaluationPage.tsx` | Centralizar UI pública |

**Acciones requeridas:**
1. Actualizar imports en tu App.tsx o router:

```tsx
// ANTES (antiguo)
import EvaluationPage from './pages/Evaluation/EvaluationPage';

// DESPUÉS (nuevo)
import EvaluationPage from '../UI/EvaluationPage';
```

2. Limpiar archivos antiguos en `src/components/` si ya no se usan

3. Usar siempre importe desde `/UI/` para nuevos componentes

## 🎨 Tema y Estilos

### Colores Principales
```css
Primary: #00c8db, #00e8ff (Cyan/Turquoise)
Background: #040e1a, #0a1520 (Dark Navy)
Text: #ffffff, #a0b0c0 (White/Gray)
Success: #4caf50 (Green)
Error: #ff4343 (Red)
Warning: #ffc107 (Amber)
```

### Tipografía
- **Familia:** 'DM_Sans', sans-serif
- **Pesos:** 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

### Espaciado / Padding
- xs: 0.25rem
- sm: 0.5rem
- md: 1rem
- lg: 1.5rem
- xl: 2rem
- 2xl: 2rem

## 🔧 Configuración

### Cómo agregar un nuevo componente común

1. Crear archivo en `src/components/common/MiComponente.tsx`
2. Expotar interface Props
3. Exportar componente default

```tsx
// src/components/common/MiComponente.tsx
import React from 'react';

export interface MiComponenteProps {
  // Props aquí
}

const MiComponente: React.FC<MiComponenteProps> = ({ }) => {
  return <div>Mi Componente</div>;
};

export default MiComponente;
```

### Cómo agregar una nueva página

1. Crear carpeta en `src/pages/MiPagina/`
2. Crear archivo `MiPagina.tsx`
3. Importar en router

```tsx
// src/pages/MiPagina/MiPagina.tsx
import React from 'react';
import './MiPagina.css';

const MiPagina: React.FC = () => {
  return <div>Mi Página</div>;
};

export default MiPagina;
```

## 📦 Dependencias

- react >= 17.0.0
- react-dom >= 17.0.0
- typescript >= 4.5.0

## 🚀 Próximos Pasos

1. ✅ Completar componentes comunes (Button, Input)
2. ✅ Estructura de páginas (Login, Evaluation)
3. ⏳ Sistema de routing (React Router v6)
4. ⏳ State management (Redux/Zustand/Context)
5. ⏳ API integration
6. ⏳ Autenticación
7. ⏳ Tests unitarios

---

**Versión:** 1.0.0  
**Última actualización:** April 13, 2026
