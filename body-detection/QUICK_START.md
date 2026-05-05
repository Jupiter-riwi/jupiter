# 🚀 Quick Start - OpenPose

Inicia OpenPose en **5 minutos** con dos terminales.

---

## ⚡ Pasos

### 1️⃣ Abre dos terminales

**Terminal 1: Backend (Python)**

*Para Windows:*
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python main.py --source 0
```

*Para macOS / Linux:*
```bash
cd backend
source .venv/bin/activate
python3 main.py --source 0
```

**Terminal 2: Frontend (React)**
```bash
npm run dev
```

### 2️⃣ Abre en el navegador

```
http://localhost:5173
```

---

## ✅ Verificar que funciona

### Prueba 1: Captura de video
1. Ve a `/evaluation` en el navegador
2. Presiona **"Iniciar Grabación"**
3. Presiona **"Finalizar"** → Se descarga video

### Prueba 2: Backend (Pose Detection)

*Para Windows:*
```powershell
cd backend
python tests/test_vision.py
```

*Para macOS / Linux:*
```bash
cd backend
python3 tests/test_vision.py
```

---

## 📚 Documentación Completa

| Documento | Propósito |
|-----------|-----------|
| [README.md](README.md) | Visión general y arquitectura |
| [STRUCTURE.md](STRUCTURE.md) | Estructura detallada del proyecto |
| [src/README.md](src/README.md) | Componentes React comunes |
| [backend/README.md](backend/README.md) | Backend de visión |
| [UI/README.md](UI/README.md) | Componentes de captura |
| [src/README.md](src/README.md) | Componentes React comunes |
| [body-cam/README.md](body-cam/README.md) | Backend de visión |

---

## 🔧 ¿Problemas?

| Problema | Solución |
|----------|----------|
| Cámara no funciona | Verificar permisos del navegador |
| Permisos denegados | Settings → Privacy → Camera/Microphone |
| Backend no responde | Verificar que pytest está activado en Terminal 1 |
| Videos no descargan | Verificar config de descarga del navegador |

---

**¿Necesitas más ayuda?** Lee [README.md](README.md) → [Solución de Problemas](#-solución-de-problemas)

```powershell
npm init -y
npm install react react-dom
npm install --save-dev typescript @types/react vite
```

### Si no existe venv en backend

```powershell
cd backend
### Si no existe venv en body-cam

```powershell
cd body-cam
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## 🎬 Flujo de Uso Típico

```
1. Abro http://localhost:5173
   ↓
2. Navego a /evaluation
   ↓
3. Veo cámara en vivo (EvaluationRoom)
   ↓
4. Presiono "Iniciar Grabación"
   ↓
5. Video se graba (MediaRecorder API)
   ↓
6. Presiono "Finalizar"
   ↓
7. Video descarga como: recording-{timestamp}.webm
   ↓
8. (Futuro) Video sube a backend → Análisis de postura
```

---

## ⚡ Comandos Útiles

### Frontend

```powershell
# Iniciar desarrollo
npm run dev

# Build para producción
npm run build

# Vista previa de build
npm run preview

# Tests (si existen)
npm test
```

### Backend

```powershell
# Activar venv
cd backend
cd body-cam
.\.venv\Scripts\Activate.ps1

# Ejecutar con webcam
python main.py --source 0

# Tests
python tests/test_vision.py

# Usar video file en lugar de webcam
python main.py --source "video.mp4"
```

---

## 🐛 Solución Rápida de Problemas

| Problema | Solución |
|----------|----------|
| "Cámara no encontrada" | Verifica permisos en Windows Settings → Privacy |
| "Permisos denegados" | Abre localhost en navegador diferente |
| "Python no reconocido" | Activa .venv: `.\ backend\.venv\Scripts\Activate.ps1` |
| "Python no reconocido" | Activa .venv: `.\body-cam\.venv\Scripts\Activate.ps1` |
| "npm command not found" | Reinstala Node.js |
| "Port 5173 already in use" | Cambia puerto: `npm run dev -- --port 5174` |

---

## 📊 Estado del Proyecto

✅ **Completado:**
- Componente EvaluationRoom (grabación)
- Estilos CSS profesionales
- Documentación completa
- Estructura de 3 carpetas

⏳ **Próximas Tareas:**
- [ ] Crear App.tsx con React Router
- [ ] Implementar API REST backend
- [ ] Integración video → pose detection
- [ ] Dashboard de métricas

---

## 💡 Tips

**Tip 1:** Comienza por la documentación en [README.md](README.md)

**Tip 2:** Revisa [STRUCTURE.md](STRUCTURE.md) para entender dónde está cada cosa

**Tip 3:** Cada carpeta tiene su propio README.md con detalles específicos

**Tip 4:** EvaluationRoom es un componente standalone → Úsalo en cualquier página

**Tip 5:** Todos los estilos son personalizables en `src/components/EvaluationRoom.css`
**Tip 5:** Todos los estilos son personalizables en `UI/EvaluationRoom.css`

---

## 🎓 Escalabilidad

Esta estructura está lista para:
- ✅ Múltiples componentes de UI
- ✅ Múltiples páginas React
- ✅ Servicios backend adicionales
- ✅ Tests unitarios
- ✅ CI/CD pipeline

---

## 📞 Contacto / Preguntas

Ver secciones específicas en:
- `src/README.md` - Preguntas sobre componentes React
- `src/README.md` - Preguntas sobre componentes
- `backend/README.md` - Preguntas sobre pose detection
- `UI/README.md` - Preguntas sobre grabación/video
- `src/README.md` - Preguntas sobre componentes
- `body-cam/README.md` - Preguntas sobre pose detection

---

**¡Listo para empezar!** 🚀

Próximo paso: Lee [README.md](README.md)

---

**Fecha:** April 13, 2026  
**Versión:** 1.0.0
