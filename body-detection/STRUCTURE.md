# 📊 Estructura del Proyecto OpenPose

Mapa detallado y completo de la organización del proyecto.

---

## 🏗️ Árbol de Directorios

```
OpenPose/
│
├── 📄 Archivos de Configuración
│   ├── package.json                    # Dependencias Node.js y scripts
│   ├── tsconfig.json                   # Configuración TypeScript
│   ├── tsconfig.node.json              # Config TS para Vite
│   ├── vite.config.ts                  # Configuración Vite
│   ├── index.html                      # HTML entry point
│   └── .gitignore                      # Archivos ignorados por Git
│
├── 📚 Documentación Principal
│   ├── README.md                       ⭐ PUNTO DE ENTRADA
│   ├── QUICK_START.md                 🚀 Inicio en 5 min
│   ├── INDEX.md                        📰 Índice de navegación
│   ├── STRUCTURE.md                    📊 Este archivo
│   ├── CONTRIBUTING.md                 🤝 Cómo contribuir
│   ├── ARCHITECTURE.md                 🏗️ Detalles técnicos
│   └── LICENSE                         📄 MIT License (futuro)
│
├── 📁 UI/ (⭐ INTERFAZ DE USUARIO)
│   ├── EvaluationRoom.tsx              # Componente de grabación
│   ├── EvaluationRoom.css              # Estilos de grabación
│   ├── EvaluationPage.tsx              # Página wrapper
│   └── README.md                       # Documentación UI
│
├── 📁 src/ (⭐ FRONTEND REACT)
│   ├── App.tsx                         # Root app component
│   ├── index.css                       # Global styles
│   ├── main.tsx                        # React DOM render
│   ├── README.md                       # Documentación src
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx              # Botón reutilizable
│   │   │   │   └── Props: variant, fullWidth, className
│   │   │   └── Input.tsx               # Input reutilizable
│   │   │       └── Props: label, error, icon, className
│   │   │
│   │   ├── EvaluationRoom.tsx          # ⚠️ DEPRECATED → usar UI/
│   │   └── EvaluationRoom.css          # ⚠️ DEPRECATED → usar UI/
│   │
│   └── pages/
│       ├── Login/
│       │   ├── Login.tsx               # Página login
│       │   ├── LoginForm.tsx           # Formulario
│       │   ├── Login.css               # Estilos
│       │   ├── jupiter-login-v2.html   # Versión HTML alternativa
│       │   ├── jupiter-login-v2.css    # v2 Styles
│       │   └── logic.js                # v2 Logic
│       │
│       └── Evaluation/
│           └── EvaluationPage.tsx      # ⚠️ DEPRECATED → usar UI/
│
├── 📁 body-cam/ (⭐ BACKEND PYTHON)
│   ├── main.py                         # Script principal
│   ├── pose_detector.py                # Clase PoseDetector
│   ├── config.py                       # Constantes globales
│   ├── utils.py                        # Helper functions
│   ├── output.json                     # Salida de ejemplo
│   ├── requirements.txt                # pip dependencies
│   ├── README.md                       # Documentación backend
│   │
│   ├── app/
│   │   └── services/
│   │       └── vision_service.py       # VisionService class
│   │
│   ├── models/
│   │   ├── face_landmarker.task        # Modelo MediaPipe facial
│   │   └── pose_landmarker_full.task   # Modelo MediaPipe pose
│   │
│   ├── tests/
│   │   └── test_vision.py              # Unit tests
│   │
│   ├── .venv/                          # Virtual environment
│   ├── .git/                           # Git repository
│   ├── .gitignore                      # Git ignore
│   └── __pycache__/                    # Python cache
│
└── 📁 UI/ (Duplicado temporalmente - Ver UI carpeta arriba)
    ├── EvaluationPage.tsx
    ├── EvaluationRoom.tsx
    ├── EvaluationRoom.css
    └── README.md
```

---

## 🎯 Mapeo: Características → Archivos

¿Dónde está cada feature?

| Característica | Ubicación | Archivo | Dev |
|---|---|---|---|
| ✅ Grabación de video | UI | EvaluationRoom.tsx | Frontend |
| ✅ Streaming en vivo | UI | EvaluationRoom.tsx | Frontend |
| ✅ Controles (botones) | UI | EvaluationRoom.tsx | Frontend |
| ✅ Estilos responsivos | UI | EvaluationRoom.css | Frontend |
| ✅ Página wrapper | UI | EvaluationPage.tsx | Frontend |
| ✅ Botón reutilizable | src | components/common/Button.tsx | Frontend |
| ✅ Input reutilizable | src | components/common/Input.tsx | Frontend |
| ✅ Sistema de login | src | pages/Login/ | Frontend |
| 🔍 Detección de postura | body-cam | pose_detector.py | Backend |
| 🔍 Detección facial | body-cam | app/services/vision_service.py | Backend |
| ⚙️ Configuración global | body-cam | config.py | Backend |
| 🎨 Utilidades visuales | body-cam | utils.py | Backend |

---

## 📦 Por Función

### Archivos Principales del Proyecto

```
🎨 UI (Interfaz de Usuario)
  ├─ EvaluationRoom.tsx        [Main component - Grabación]
  ├─ EvaluationPage.tsx        [Wrapper page]
  └─ EvaluationRoom.css        [Styles]

⚛️ SRC (Componentes React)
  ├─ components/common/
  │  ├─ Button.tsx             [Reusable button]
  │  ├─ Input.tsx              [Reusable input]
  ├─ pages/Login/
  │  ├─ Login.tsx              [Login page]
  │  └─ LoginForm.tsx          [Login form]

🐍 BODY-CAM (Backend ML)
  ├─ main.py                   [Entry point]
  ├─ pose_detector.py          [Pose detection]
  ├─ config.py                 [Configuration]
  ├─ utils.py                  [Utils]
  └─ app/services/
     └─ vision_service.py      [Vision service]
```

---

## 🔄 Flujos de Datos

### Captura de Video

```
User clicks "Start"
  ↓
navigator.mediaDevices.getUserMedia()
  ↓
MediaRecorder API captures
  ↓
Chunks agregados a Blob
  ↓
User clicks "Stop"
  ↓
Blob descargado como WebM
```

### Detección de Postura (Backend)

```
Frame (imagen)
  ↓
Resize/normalize
  ↓
MediaPipe PoseLandmarker.detect()
  ↓
Extract coordinates
  ↓
Filter by confidence
  ↓
JSON output
```

---

## 📋 Convenciones de Nombres

### Carpetas

- **Minúsculas**: `body-cam`, `src`, `ui` (estándar)
- **PascalCase**: No usar para carpetas

### Archivos Componentes React

- **PascalCase**: `EvaluationRoom.tsx`, `Button.tsx`
- **Sufijo .tsx**: Componentes React
- **Sufijo .css**: Estilos asociados

### Archivos Python

- **snake_case**: `pose_detector.py`, `vision_service.py`
- **PascalCase para clases**: `PoseDetector`, `VisionService`
- **UPPER_SNAKE_CASE para constantes**: `MAX_FRAMES`, `CONFIDENCE_THRESHOLD`

---

## ⚠️ Archivos Deprecados

Los siguientes archivos serán removidos en futuras versiones:

```
src/components/EvaluationRoom.tsx     → Reemplazado por UI/EvaluationRoom.tsx
src/components/EvaluationRoom.css     → Reemplazado por UI/EvaluationRoom.css
src/pages/Evaluation/                 → Reemplazado por UI/
```

**Acción requerida:**
- Importar desde `UI/` en lugar de `src/components/`

---

## 🧪 Estructura de Tests

```
body-cam/
└── tests/
    ├── test_vision.py              # Tests para VisionService
    ├── test_pose_detector.py       # (Futuro) Tests para PoseDetector
    └── test_utils.py               # (Futuro) Tests para utils
```

**Para correr tests:**
```bash
cd backend
cd body-cam
pytest tests/ -v
```

---

## 🔐 Archivos de Configuración

| Archivo | Propósito |
|---------|-----------|
| `package.json` | Node.js dependencies y npm scripts |
| `tsconfig.json` | TypeScript compiler options |
| `vite.config.ts` | Vite build configuration |
| `backend/config.py` | Backend constants y configuration |
| `backend/requirements.txt` | Python dependencies |
| `body-cam/config.py` | Backend constants y configuration |
| `body-cam/requirements.txt` | Python dependencies |

---

## 📦 Dependencias

### Frontend (package.json)
- React 18+
- TypeScript 5+
- Vite 5+
- Tailwind CSS 3+ (opcional)

### Backend (requirements.txt)
- Python 3.12
- mediapipe 0.10+
- opencv-python 4.8+
- numpy 1.24+

---

## 🚀 Scripts npm (package.json)

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm test             # Run tests
npm run lint         # Run linter
```

---

## 📚 Referencias Cruzadas

- Para inicio rápido → [QUICK_START.md](QUICK_START.md)
- Para documentación componentes UI → [src/README.md](src/README.md)
- Para documentación src → [src/README.md](src/README.md)
- Para documentación backend → [backend/README.md](backend/README.md)
- Para contribuir → [CONTRIBUTING.md](CONTRIBUTING.md)
- Para arquitectura → [ARCHITECTURE.md](ARCHITECTURE.md)

---

**Última actualización:** April 14, 2026

```
Inicio → Estado: Listo
    ↓
Usuario presiona "Iniciar" → Estado: Grabando (REC indicator)
    ↓
    ├─ Usuario presiona "Pausar" → Estado: En pausa (PAUSADO indicator)
    │   ├─ Usuario presiona "Reanudar" → Estado: Grabando
    │   └─ Usuario presiona "Finalizar" → Descarga video
    │
    └─ Usuario presiona "Finalizar" → Descarga video
```

### Backend Analysis (Futuro)

```
Video Upload
    ↓
backend/main.py
body-cam/main.py
    ↓ (frame extraction)
pose_detector.py ←→ MediaPipe/OpenPose models
    ↓ (pose keypoints)
app/services/vision_service.py
    ↓ (facial landmarks)
utils.py
    ↓ (JSON serialization)
output.json
    ↓
API Response → Frontend
    ↓
Metrics Dashboard
```

## 🎨 Tema y Organización Visual

### Color Scheme
```css
/* Definido en EvaluationRoom.css */
Primary Cyan:     #00c8db, #00e8ff
Dark Navy:        #040e1a, #0a1520
Text Light:       #ffffff
Text Secondary:   #a0b0c0
Success Green:    #4caf50
Error Red:        #ff4343
```

### Componentes por Variante

**Button Component** (`src/components/common/Button.tsx`)
- `variant="primary"`:   Gradiente cyan + sombra
- `variant="secondary"`: Fondo oscuro + borde cyan
- `variant="outline"`:   Transparente + borde cyan

**Input Component** (`src/components/common/Input.tsx`)
- Tema oscuro
- Validación inline
- Soporte para iconos

## 📚 Jerarquía de Documentación

```
1. README.md (raíz)
   └─ Overview general del proyecto
      ├─ Quick start
      ├─ Stack tecnológico
      └─ Roadmap

   ├─ src/README.md
   ├─ UI/README.md
   │  └─ Componente EvaluationRoom
   │     ├─ Props y estados
   │     ├─ Configuración MediaRecorder
   │     ├─ Integración backend
   │     └─ Ejemplos de uso

   │
   ├─ src/README.md
   │  └─ Componentes React comunes
   │     ├─ Button.tsx
   │     ├─ Input.tsx
   │     ├─ Estructura de páginas
   │     └─ Convenciones de código

   └─ backend/README.md
   │
   └─ body-cam/README.md
      └─ Backend Python
         ├─ Instalación
         ├─ Configuración (config.py)
         ├─ Uso (main.py)
         ├─ VisionService API
         ├─ Formato JSON output
         └─ Troubleshooting
```

## 🚀 Orquestación de Servicios

### En Desarrollo Local

**Terminal 1: Backend Python**
```powershell
cd backend
cd body-cam
.\.venv\Scripts\Activate.ps1
python main.py --source 0
```
→ Escucha en: `localhost:5000` (cuando se implemente API)

**Terminal 2: Frontend React**
```powershell
npm run dev    # Vite
# or yarn dev
```
→ Abierto en: `localhost:5173` (Vite) o `localhost:3000` (CRA)

### Integración Esperada

```
https://localhost:5173
    ↓ (usuario)
EvaluationPage (UI/EvaluationPage.tsx)
    ↓ (proporciona video)
EvaluationRoom (UI/EvaluationRoom.tsx)
    ├─ Captura → recording.webm
    ├─ POST /api/upload/video → backend API
    │
    └─ backend/main.py
    ├─ POST /api/upload/video → body-cam backend
    │
    └─ body-cam/main.py
        ├─ Extract frames
        ├─ pose_detector.py → OpenPose/MediaPipe
        ├─ vision_service.py → Face landmarks
        ├─ utils.py → JSON export
        └─ return metrics.json
    
    ├─ Parse response
    └─ Show metrics dashboard
```

## 🔐 Dependencias Externas

### Frontend (npm/yarn)

```json
{
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "typescript": "^4.5.0",
    "vite": "^latest"
  }
}
```

### Backend (Python)

```txt
opencv-python==4.x.x        # Captura y procesamiento video
mediapipe==0.x.x            # Face landmarks y pose
numpy==1.x.x                # Operaciones numéricas
```

## ✅ Checklist de Estructura

- [x] Carpeta UI creada (/UI/)
- [x] EvaluationRoom.tsx movido a /UI/
- [x] EvaluationRoom.css movido a /UI/
- [x] EvaluationPage.tsx creado en /UI/
- [x] README.md creado en /UI/
- [x] README.md creado en /src/
- [x] README.md actualizado en /backend/
- [x] README.md actualizado en /body-cam/
- [x] README.md creado en raíz
- [x] STRUCTURE.md creado (este archivo)
- [x] Archivos deprecated marcados en src/

## 📝 Próximas Tareas

### Inmediatas
- [ ] Crear package.json en raíz (si no existe)
- [ ] Crear App.tsx router con rutas
- [ ] Implementar React Router v6
- [ ] Conectar EvaluationPage a ruta `/evaluation`

### Corto Plazo
- [ ] Crear API REST backend (FastAPI/Express)
- [ ] Integrar upload de video desde UI a backend
- [ ] Implementar procesamiento de pose
- [ ] Crear dashboard de métricas

### Mediano Plazo
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Docker containerization
- [ ] Tests unitarios e integración
- [ ] Performance optimization

## 🎯 Consideraciones de Scalabilidad

### Estructura Escalable

```
OpenPose/
├── UI/                 # Componentes de propósito único
├── src/                # Frontend React centralizado
├── backend/           # Backend modular
├── body-cam/           # Backend modular
└── services/ (Future)  # Microservicios adicionales
    ├── auth-service/   # Autenticación
    ├── api-gateway/    # API REST
    └── ml-service/     # ML Models
```

### Por Qué Esta Estructura

✅ **Separación clara**: UI → src → backend  
✅ **Separación clara**: UI → src → body-cam  
✅ **Fácil de escalar**: Agregar más servicios sin tocar existentes  
✅ **Reutilizable**: Componentes en src/common/ para futuras features  
✅ **Mantenible**: README en cada carpeta documenta su propósito  
✅ **Escalable**: Backend preparado para múltiples modelos ML  

---

**Última actualización:** April 13, 2026  
**Versión de Estructura:** 1.0.0 MVP
