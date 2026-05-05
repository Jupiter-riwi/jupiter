# OpenPose - Plataforma de Análisis de Postura y Presentaciones

> Sistema integral para captura, análisis y evaluación de presentaciones con detección de postura corporal y características faciales en tiempo real.

**Estado del proyecto**: 🚧 En desarrollo | **Licencia**: MIT | **Python 3.12** | **Node.js 18+**

## 🎯 Descripción General

OpenPose es una plataforma bidireccional que combina:

- **Frontend React (UI)**: Interfaz moderna de captura de video y análisis en tiempo real
- **Backend Python**: Motor de visión por computadora con MediaPipe para pose y facial landmarks

```
┌─────────────────────────────────────────────────────┐
│            OPENPOSE ARCHITECTURE                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────┐    ┌──────────────────┐    │
│  │   FRONTEND          │◄──►│  BACKEND         │    │
│  │  React + TypeScript │    │  Python + ML     │    │
│  │                     │    │                  │    │
│  │ • Grabación video   │    │ • Pose detection │    │
│  │ • Stream en vivo    │    │ • Facial markers │    │
│  │ • Interfaz UI       │    │ • JSON export    │    │
│  └─────────────────────┘    └──────────────────┘    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

##  Tabla de Contenidos
## � Tabla de Contenidos

- [🚀 Inicio Rápido](#-inicio-rápido)
- [📁 Estructura del Proyecto](#-estructura-del-proyecto)
- [🏗️ Arquitectura](#-arquitectura)
- [📋 Requisitos](#-requisitos)
- [🔧 Instalación](#-instalación)
- [💻 Uso](#-uso)
- [📖 Documentación](#-documentación)
- [🤝 Contribuir](#-contribuir)
- [📝 Licencia](#-licencia)

## 🚀 Inicio Rápido

**Para empezar en 5 minutos**, ver [QUICK_START.md](QUICK_START.md)

```powershell
# Terminal 1: Backend
cd backend && .\.venv\Scripts\Activate.ps1 && python main.py --source 0
cd body-cam && .\.venv\Scripts\Activate.ps1 && python main.py --source 0

# Terminal 2: Frontend
npm run dev
```

✅ Accede a `http://localhost:5173`

## 📁 Estructura del Proyecto

```
OpenPose/
│
├── 📂 src/                   ⭐ FRONTEND - Componentes React
│   ├── components/
│   │   ├── EvaluationRoom.tsx
│   │   ├── common/
│   │   └── ...
├── 📂 UI/                    ⭐ FRONTEND - UI de captura
│   ├── EvaluationRoom.tsx
│   ├── EvaluationPage.tsx
│   ├── README.md
│   └── ...
│
├── 📂 src/                   ⭐ FRONTEND - Componentes React
│   ├── components/
│   ├── pages/
│   ├── README.md
│   └── ...
│
├── 📂 backend/              ⭐ BACKEND - Visión por computadora
├── 📂 body-cam/              ⭐ BACKEND - Visión por computadora
│   ├── main.py
│   ├── pose_detector.py
│   ├── config.py
│   ├── README.md
│   └── ...
│
├── README.md                 ← Portal principal (este archivo)
├── QUICK_START.md            ← Guía de inicio rápido
├── ARCHITECTURE.md           ← Detalles técnicos (próximamente)
└── package.json, tsconfig.json, etc.
```

**Ver detalles en**: [STRUCTURE.md](STRUCTURE.md)

## 🏗️ Arquitectura

El proyecto está dividido en dos módulos independientes:

| Componente | Tecnología | Propósito |
|-----------|-----------|-----------|
| **UI/** | React + TypeScript | Componentes e interfaz de captura |
| **src/** | React + TypeScript | Componentes reutilizables (Button, Input, etc.) |
| **backend/** | Python 3.12 + MediaPipe | Detección de postura y landmarks faciales |
| **UI/** | React + TypeScript + Tailwind | Captura de video y streaming en tiempo real |
| **src/** | React + TypeScript | Componentes reutilizables (Button, Input, etc.) |
| **body-cam/** | Python 3.12 + MediaPipe | Detección de postura y landmarks faciales |

**Flujo de datos:**
```
🎥 Input (Cámara)
  ↓
📊 Frontend UI (React)
  ├─ Captura y visualiza video
  ├─ Envía frames al backend
  └─ Recibe análisis JSON
⚙️ Backend (Python)
  ├─ Procesa frames con ML
  ├─ Detecta pose + facial
  └─ Retorna análisis
📈 Output (Resultado)
```

## 📋 Requisitos

### Minimum
- **Node.js** 18+ (para React)
- **Python** 3.12 (para backend ML)
- **npm** o **yarn** (gestor de paquetes)
- **Navegador** moderno (Chrome, Edge, Firefox)

### Recomendado
- GPU NVIDIA (CUDA 11.8+) para mejor performance
- 8+ GB RAM
- SSD para almacenamiento de videos

## 🔧 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/usuario/OpenPose.git
cd OpenPose
```

### 2. Configurar Backend (Python)

```powershell
cd backend
cd body-cam

# Crear virtual environment con UV (recomendado)
uv venv --python 3.12 .venv

# O con venv estándar
python -m venv .venv

# Activar
.\.venv\Scripts\Activate.ps1

# Instalar dependencias
pip install -r requirements.txt
```

### 3. Configurar Frontend (React)

```powershell
# Volver a raíz
cd ..

# Instalar dependencias
npm install

# O con yarn
yarn install
```

# Activar
.\.venv\Scripts\Activate.ps1

# Instalar dependencias
python -m pip install -r requirements.txt

# (Opcional) Test local
python tests/test_vision.py
```

### 2. Configurar Frontend (React)

```powershell
# Navegar a raíz (donde esté package.json)
cd ..

# Instalar dependencias
npm install

# O con yarn
yarn install
```

### 3. Iniciar Desarrollo

**Terminal 1 - Backend:**
```powershell
cd backend
cd body-cam
.\.venv\Scripts\Activate.ps1
python main.py --source 0
```

**Terminal 2 - Frontend:**
```powershell
# En la raíz del proyecto
npm run dev
# o
yarn dev
```

Accede a `http://localhost:5173` (Vite) o `http://localhost:3000` (Create React App)

## 📋 Convenciones de Proyecto

### Rutas y Navegación

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/` | Login | Página de autenticación |
| `/evaluation` | EvaluationPage | Sala de grabación y evaluación |
| `/analysis` | (Future) | Análisis de grabación |

### Estructura de Archivos

- **Componentes reutilizables**: `src/components/common/`
- **Páginas completas**: `src/pages/`
- **UI features**: `src/components/` y `src/pages/` (nuevos componentes principales)
- **Backend logic**: `backend/` (Python)
- **UI features aisladas**: `UI/` (nuevos componentes principales)
- **Backend logic**: `body-cam/` (Python)

### Convenciones de Código

**TypeScript/React:**
- ✅ Componentes como `PascalCase`
- ✅ Props interfaces con sufijo `Props`
- ✅ Tipos en archivos separados si son complejos
- ✅ Exportaciones default para componentes

**Python:**
- ✅ Funciones en `snake_case`
- ✅ Clases en `PascalCase`
- ✅ Módulos en `snake_case`
- ✅ Constants en `UPPER_SNAKE_CASE`

## 🎯 Casos de Uso

### 1. Grabación de Presentación
```
Usuario → Login → EvaluationRoom → Inicia grabación → Finaliza → Descarga video
```

### 2. Análisis de Postura (Futuro)
```
Video sube a backend → Pose detection → Face analysis → JSON results → Frontend muestra métricas
```

### 3. Evaluación Integral
```
Video + Pose + Face + Audio → Metrics dashboard → Reporte final
```

## 🔧 Configuración Global

### Frontend (TypeScript/React)

**Temas disponibles:**
- `dark` (default)
- `light` (en desarrollo)

**Tipografía:**
- Fuente: `DM Sans`
- Pesos: 400, 500, 600, 700

**Paleta:**
- Primario: `#00c8db` (Cyan)
- Secundario: `#0a1520` (Dark Navy)
- Éxito: `#4caf50` (Green)
- Error: `#ff4343` (Red)

### Backend (Python)

<<<<<<< feature/add-documentation
**Variables de Backend en `backend/config.py`:****
=======
**Variables de Backend en `body-cam/config.py`:**
>>>>>>> main
```python
POSE_BACKEND = 'openpose'  # o 'mediapipe'
OUTPUT_WIDTH = 1280
OUTPUT_HEIGHT = 720
TARGET_FPS = 30
```

## 📦 Stack Tecnológico

### Frontend
- **React 18+**: Framework UI
- **TypeScript**: Type safety
- **Tailwind CSS**: Utility-first CSS
- **React Router**: Navegación
- **Vite**: Build tool (recomendado)

### Backend
- **Python 3.12**: Lenguaje
- **OpenPose**: Detección de pose (principal)
- **MediaPipe**: Detección facial + respaldo
- **OpenCV**: Procesamiento de video
- **NumPy**: Operaciones numéricas

### DevOps
- **Git Flow**: Modelo de ramas
- **GitHub**: Repositorio
- **Docker**: (próximo paso)

## 🤝 Sistema de Integración

### API Bridge (Futuro)

```
Frontend (React)
    ↓ POST /api/upload
Backend (FastAPI/Flask)
    ↓ Process video
    ↓ Detect pose + face
<<<<<<< feature/add-documentation
Backend (backend)
=======
Backend (body-cam)
>>>>>>> main
    ↓ Return JSON
Frontend (React)
    ↓ Display metrics
```

**Formato esperado:**
```json
{
  "success": true,
  "frames": [
    {
      "frame": 1,
      "pose": {...},
      "face": {...},
      "metrics": {...}
    }
  ]
}
```

## 📊 Flujo de Datos

```
1. Captura
   └─ EvaluationRoom.tsx → navigator.mediaDevices.getUserMedia()

2. Grabación
   └─ MediaRecorder API → Blob WebM

3. Exportación
   ├─ Download local (actual)
   └─ Upload backend (futuro)

4. Procesamiento Backend
   ├─ Frame extraction
   ├─ Pose detection (OpenPose)
   ├─ Face landmarks (MediaPipe)
   └─ JSON export

5. Análisis Frontend
   ├─ Parse metrics
   ├─ Visualize graphs
   └─ Mostrar reporte
```

## 🧪 Testing

### Frontend
```bash
npm test
npm run test:watch
npm run test:coverage
```

### Backend
```bash
cd backend
cd body-cam
python -m pytest tests/ -v
python tests/test_vision.py
```

## 📚 Documentación Detallada

- **UI Components**: Ver [src/README.md](src/README.md)
- **React Components**: Ver [src/README.md](src/README.md)
- **Backend & Vision**: Ver [backend/README.md](backend/README.md)
- **UI Components**: Ver [UI/README.md](UI/README.md)
- **React Components**: Ver [src/README.md](src/README.md)
- **Backend & Vision**: Ver [body-cam/README.md](body-cam/README.md)

## 🐛 Solución de Problemas

### "Cámara no encontrada"
→ Verificar permisos del navegador en OS
→ Probar con otro navegador

### "Permisos denegados"
→ Ir a Settings del navegador → Privacy → Camera/Microphone
→ Confirmar permisos para localhost

### "Backend no responde"
→ Verificar que Python está corriendo en Terminal 1
→ Check `backend/` está activado `.venv`
→ Check `body-cam/` está activado `.venv`

### "Videos no descargan"
→ Verificar config de descarga del navegador
→ Intentar en navegador diferente

## 📝 Contribución

### Workflow Git

1. **Fork** o trabajar en rama local
2. **Feature branches**: `feature/nombre-feature`
3. **Commit messages**: `feat: descripción` o `fix: descripción`
4. **Pull Requests**: A `main` después de tests
5. **Code Review**: Al menos 1 aprobación

### Código

- ✅ Type safety (TypeScript + Python typing)
- ✅ Comments en lógica compleja
- ✅ Tests unitarios
- ✅ Seguir convenciones de proyecto

## 🗺️ Roadmap

### Q2 2026
- [x] Captura de video básica
- [x] UI de grabación
- [x] Backend pose detection
- [ ] Integración API REST

### Q3 2026
- [ ] Dashboard de análisis
- [ ] Reportes PDF
- [ ] Gravación multi-persona
- [ ] Análisis de emociones

### Q4 2026
- [ ] Machine learning personalizado
- [ ] Video streaming en vivo
- [ ] Mobile app
- [ ] Integraciones de terceros

## 📞 Soporte

- **Issues**: GitHub Issues
- **Docs**: `/README.md` en cada carpeta
- **Email**: aponteapps@gmail.com

## 📄 Licencia

MIT License - Ver LICENSE file

---

## 📊 Estadísticas del Proyecto

| Métrica | Valor |
|---------|-------|
| **Lenguajes** | TypeScript, Python |
| **Componentes** | 10+ |
| **Modelos ML** | 2 (Face, Pose) |
| **APIs** | WebRTC, MediaRecorder, MediaPipe Tasks |
| **Performance** | 30+ FPS (GPU) |

---

**versión:** 1.0.2 MVP  
**Última actualización:** April 13, 2026  
