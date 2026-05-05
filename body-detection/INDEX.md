# 📰 Índice del Proyecto OpenPose

Guía de navegación rápida por la documentación del proyecto.

---

## 🎯 Por Experiencia

### 🔰 Soy nuevo en el proyecto
1. Lee [README.md](README.md) (5 min)
2. Lee [QUICK_START.md](QUICK_START.md) (5 min)
3. Prueba según [QUICK_START.md](QUICK_START.md)

### 👨‍💻 Voy a trabajar en Frontend (React)
1. Lee [src/README.md](src/README.md)
2. Lee [src/README.md](src/README.md)
3. Explora `src/components/` y `src/pages/`

### 🐍 Voy a trabajar en Backend (Python)
1. Lee [backend/README.md](backend/README.md)
2. Explora `backend/pose_detector.py` y `config.py`
2. Lee [UI/README.md](UI/README.md)
3. Explora `src/components/` y `UI/`

### 🐍 Voy a trabajar en Backend (Python)
1. Lee [body-cam/README.md](body-cam/README.md)
2. Explora `body-cam/pose_detector.py` y `config.py`
3. Corre tests: `python tests/test_vision.py`

### 🤝 Voy a contribuir
1. Lee [CONTRIBUTING.md](CONTRIBUTING.md) (cuando exista)
2. Crea feature branch: `feature/tu-feature`
3. Sigue convenciones en [README.md](README.md#-convenciones-de-proyecto)

---

## 📁 Carpetas Principales

| Carpeta | Propósito | Tech | README |
|---------|-----------|------|--------|
| **src/components/** | Componentes React | React + TypeScript | [src/README.md](src/README.md) |
| **src/** | Componentes comunes | React + TypeScript | [src/README.md](src/README.md) |
| **backend/** | Visión por computadora | Python + MediaPipe | [backend/README.md](backend/README.md) |
| **UI/** | Interfaz de captura | React + TypeScript | [UI/README.md](UI/README.md) |
| **src/** | Componentes comunes | React + TypeScript | [src/README.md](src/README.md) |
| **body-cam/** | Visión por computadora | Python + MediaPipe | [body-cam/README.md](body-cam/README.md) |

---

## 📚 Documentación Central

| Documento | Contenido |
|-----------|-----------|
| [README.md](README.md) | Visión general, instalación, arquitectura |
| **[QUICK_START.md](QUICK_START.md)** | **Cómo iniciar en 5 min** ⭐ |
| [STRUCTURE.md](STRUCTURE.md) | Árbol completo de archivos |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Cómo contribuir (próximamente) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Detalles técnicos profundos (próximamente) |

---

## 🗺️ Por Tarea

### "Quiero capturar video"
→ [src/components/EvaluationRoom.tsx](src/components/EvaluationRoom.tsx) + [src/README.md](src/README.md)
→ [UI/EvaluationRoom.tsx](UI/EvaluationRoom.tsx) + [UI/README.md](UI/README.md)

### "Quiero crear un botón"
→ [src/components/common/Button.tsx](src/components/common/Button.tsx) + [src/README.md](src/README.md)

### "Quiero detectar postura"
→ [backend/pose_detector.py](backend/pose_detector.py) + [backend/README.md](backend/README.md)
→ [body-cam/pose_detector.py](body-cam/pose_detector.py) + [body-cam/README.md](body-cam/README.md)

### "Necesito entender la integración"
→ [README.md](README.md#--flujo-de-datos) → [ARCHITECTURE.md](ARCHITECTURE.md) (próximamente)

### "No sé por dónde empezar"
→ **[QUICK_START.md](QUICK_START.md)** ⭐

---

## 🚀 Enlace Rápido

**¿Quieres empezar en 5 minutos?** → [QUICK_START.md](QUICK_START.md)

### Caso 6: "Quiero ver cómo integrar frontend + backend"
→ [README.md](README.md#-integración-con-frontend-react)

---

## 📚 Documentación Disponible

| Archivo | Propósito | Lectura |
|---------|-----------|---------|
| 📖 [README.md](README.md) | Visión general del proyecto | 10 min |
| ⚡ [QUICK_START.md](QUICK_START.md) | Guía de 5 minutos | 5 min |
| 🗺️ [STRUCTURE.md](STRUCTURE.md) | Mapa completo de archivos | 15 min |
| 📍 INDEX.md | Este archivo (navegación) | 5 min |
| 🎨 [src/README.md](src/README.md) | Documentación EvaluationRoom | 10 min |
| ⚛️ [src/README.md](src/README.md) | Documentación componentes React | 10 min |
| 🐍 [backend/README.md](backend/README.md) | Documentación backend Python | 15 min |
| 🎨 [UI/README.md](UI/README.md) | Documentación EvaluationRoom | 10 min |
| ⚛️ [src/README.md](src/README.md) | Documentación componentes React | 10 min |
| 🐍 [body-cam/README.md](body-cam/README.md) | Documentación backend Python | 15 min |

**Total estimado: 1 hora para documentación completa**

---

## 🎯 Mapa Mental de la Arquitectura

```
USUARIO
  ↓
http://localhost:5173/evaluation
  ↓
EvaluationPage (src/pages/Evaluation/)
  ↓
EvaluationRoom (src/components/EvaluationRoom.tsx)
EvaluationRoom (UI/EvaluationRoom.tsx)
  ├─ Video stream (getUserMedia) ←→ Cámara
  ├─ Grabación (MediaRecorder) ← Control buttons
  └─ Descarga .webm ← Finalizar
  
  ↓ (Futuro: upload)
  
http://localhost:5000/api/upload
  ↓
backend/main.py
body-cam/main.py
  ├─ pose_detector.py (OpenPose/MediaPipe)
  ├─ vision_service.py (Face landmarks)
  └─ utils.py (JSON export)
  
  ↓
output.json
  ↓
Envío al frontend
  ↓
Mostrar métricas
```

---

## 🔄 Flujos de Trabajo Típicos

### Workflow 1: Desarrollo de UI
```
1. Abre src/components/EvaluationRoom.tsx
1. Abre UI/EvaluationRoom.tsx
2. Modifica componente/estilos
3. npm run dev verá cambios en vivo
4. Test en http://localhost:5173
```

### Workflow 2: Agregar Componente React
```
1. Crea archivo en src/components/
2. Importa en página deseada
3. Exporta desde index.tsx (si existe)
4. Usa en páginas
```

### Workflow 3: Desarrollo Backend
```
1. Abre backend/pose_detector.py
1. Abre body-cam/pose_detector.py
2. Modifica lógica de pose detection
3. python main.py --source 0 para testing
4. Verifica output.json
```

### Workflow 4: Integración Completa
```
1. Frontend carga src/components/EvaluationRoom
1. Frontend carga UI/EvaluationRoom
2. Usuario graba video
3. Video sube a backend (futuro: API)
4. Backend procesa y retorna JSON
5. Frontend muestra métricas
```

---

## 🚀 Comandos Principales

### Frontend
```bash
npm run dev          # Iniciar desarrollo (Vite)
npm run build        # Build producción
npm test             # Ejecutar tests
```

### Backend
```bash
cd backend
cd body-cam
.\.venv\Scripts\Activate.ps1  # Activar virtual env
python main.py --source 0      # Ejecutar con webcam
python tests/test_vision.py    # Tests
```

---

## 🎓 Para Aprender...

| Tema | Recurso | Ubicación |
|------|---------|-----------|
| React | [React Docs](https://react.dev) | Web |
| TypeScript | [TS Handbook](https://www.typescriptlang.org/docs/) | Web |
| MediaRecorder API | [MDN Docs](https://developer.mozilla.org/docs/Web/API/MediaRecorder) | Web |
| MediaPipe | [MediaPipe Docs](https://google.github.io/mediapipe/) | Web |
| OpenPose | [OpenPose Paper](https://arxiv.org/abs/1611.08408) | Web |
| getUserMedia | [MDN API](https://developer.mozilla.org/docs/Web/API/MediaDevices/getUserMedia) | Web |

---

## ⚠️ Archivos Deprecated

Los siguientes archivos están **DEPRECATED** y no deberían usarse:
- ❌ `src/components/EvaluationRoom.tsx`
- ❌ `src/components/EvaluationRoom.css`
- ❌ `src/pages/Evaluation/EvaluationPage.tsx`

**Usar en su lugar:**
- ✅ `src/components/EvaluationRoom.tsx`
- ✅ `src/components/EvaluationRoom.css`
- ✅ `src/pages/Evaluation/EvaluationPage.tsx`
- ✅ `UI/EvaluationRoom.tsx`
- ✅ `UI/EvaluationRoom.css`
- ✅ `UI/EvaluationPage.tsx`

---

## 📞 Dónde Encontrar Ayuda

| Pregunta | Dónde buscar |  |
|----------|---|--|
| "¿Cómo uso EvaluationRoom?" | [src/README.md](src/README.md) | 👉 |
| "¿Cómo creo un componente React?" | [src/README.md](src/README.md) | 👉 |
| "¿Cómo funciona pose detection?" | [backend/README.md](backend/README.md) | 👉 |
| "¿Cómo uso EvaluationRoom?" | [UI/README.md](UI/README.md) | 👉 |
| "¿Cómo creo un componente React?" | [src/README.md](src/README.md) | 👉 |
| "¿Cómo funciona pose detection?" | [body-cam/README.md](body-cam/README.md) | 👉 |
| "¿Por dónde empiezo?" | [QUICK_START.md](QUICK_START.md) | 👉 |
| "¿Cuál es la estructura?" | [STRUCTURE.md](STRUCTURE.md) | 👉 |
| "¿Cómo integro todo?" | [README.md](README.md) | 👉 |

---

## 🎉 Estado Actual

✅ **Completado:**
- Componente EvaluationRoom
- Documentación estructura 3 carpetas
- README para cada carpeta
- Guías de inicio rápido

⏳ **Próximos pasos:**
- [ ] Crear App.tsx con router
- [ ] Implementar API REST
- [ ] Integración completa
- [ ] Dashboard de métricas

---

## 📊 Estadísticas del Proyecto

| Métrica | Valor |
|---------|-------|
| Líneas de documentación | 2000+ |
| README files | 6 |
| Componentes React | 3+ |
| Archivos Python | 5+ |
| Setup time | 5 minutos |
| Curva de aprendizaje | Baja (bien documentado) |

---

## 🎯 Objetivo Overall

Proporcionar una **plataforma integrada** para:
1. ✅ Capturar presentaciones en video
2. ✅ Analizar postura corporal
3. ✅ Extraer características faciales
4. ✅ Generar reportes de performance

---

**¿Listo?** → Comienza con [QUICK_START.md](QUICK_START.md) 🚀

---

**Versión:** 1.0.0  
**Última actualización:** April 13, 2026  
**Mantenedor:** Development Team
