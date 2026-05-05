# 🏗️ Arquitectura de OpenPose

Documento técnico detallado sobre la arquitectura del proyecto.

---

## 📐 Arquitectura General

```
┌────────────────────────────────────────────────────────────────┐
│                    OPENPOSE SYSTEM                             │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────┐    ┌──────────────────────────┐  │
│  │   CLIENT LAYER           │    │   SERVER LAYER           │  │
│  │  (React + TypeScript)    │    │  (Python + MediaPipe)    │  │
│  │                          │    │                          │  │
│  │  ┌────────────────────┐  │    │  ┌──────────────────────┐   │
│  │  │ EvaluationRoom    │  │    │  │ Vision Service        │   │
│  │  │ - Capture         │  │    │  │ - Pose Detection      │   │
│  │  │ - Stream          │  │    │  │ - Face Detection      │   │
│  │  │ - Download        │  │    │  │ - Process JSON        │   │
│  │  └────────────────────┘  │    │  └──────────────────────┘   │
│  │                          │    │         │                   │
│  │  ┌────────────────────┐  │    │  ┌──────▼──────────────┐    │
│  │  │ UI Components     │  │    │  │ MediaPipe Models     │    │
│  │  │ - Button          │  │    │  │ - face_landmarker    │    │
│  │  │ - Input           │  │    │  │ - pose_landmarker    │    │
│  │  │ - Pages           │  │    │  └────────────────────┘      │
│  │  └────────────────────┘  │    │                             │
│  └──────────────────────────┘    └──────────────────────────┘
│         │                                    │                 │
│         │      WebRTC/HTTP                   │                 │
│         └────────────────────────────────────┘                 │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  STORAGE LAYER                                         │    │
│  │  - Local Downloads (WebM)                              │    │
│  │  - JSON Output Files                                   │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Componentes Principales

### 1. Frontend (React + TypeScript)

#### Estructura de Carpetas

```
src/
├── App.tsx                          # Root app component
├── main.tsx                         # React DOM render
├── index.css                        # Global styles
│
├── components/
│   ├── common/
│   │   ├── Button.tsx              # Reusable button
│   │   ├── Input.tsx               # Reusable input
│   │   └── ...
│   ├── EvaluationRoom.tsx          # [DEPRECATED]
│   └── EvaluationRoom.css          # [DEPRECATED]
│
├── pages/
│   ├── Login/
│   │   ├── Login.tsx               # Login page
│   │   ├── LoginForm.tsx           # Login form
│   │   ├── Login.css               # Styles
│   │   └── ...
│   └── Evaluation/                 # Página de evaluación
│   └── Evaluation/                 # [DEPRECATED - use UI/]
│
└── README.md
```

#### Flujo de Datos (Frontend)

```
User Interaction (Click)
    ↓
React Event Handler
    ↓
State Update (useState)
    ↓
Component Re-render
    ↓
DOM Updated
```

#### EvaluationRoom Componente

```typescript
Interface EvaluationRoomState:
  - recordingState: 'idle' | 'recording' | 'paused'
  - duration: number (seconds)
  - isLoading: boolean
  - error?: string
  - videoRef: HTMLVideoElement
  - streamRef: MediaStream
```

#### Media Recording Flow

```
1. getUserMedia()           → Request camera/microphone access
2. Create MediaRecorder     → Initialize recorder with stream
3. Start Recording          → Start capturing
4. onDataAvailable Event    → Collect chunks
5. Stop Recording           → Finalize blob
6. Create Download Link     → Trigger file download
```

### 2. Backend (Python + MediaPipe)

#### Estructura de Carpetas

```
backend/
body-cam/
├── main.py                          # Entry point
├── pose_detector.py                 # Pose detector class
├── config.py                        # Configuration constants
├── utils.py                         # Helper functions
├── requirements.txt                 # Dependencies
│
├── app/
│   └── services/
│       └── vision_service.py        # Vision service (isolated)
│
├── models/
│   ├── face_landmarker.task        # MediaPipe face model
│   └── pose_landmarker_full.task   # MediaPipe pose model
│
├── tests/
│   └── test_vision.py              # Unit tests
│
└── .venv/                           # Virtual environment
```

#### Vision Processing Pipeline

```
Frame (Input)
    ↓
(Optional) Resize/Normalize
    ↓
MediaPipe PoseLandmarker
    ├─ Detect body keypoints (33 landmarks)
    ├─ Filter by confidence threshold
    └─ Return normalized coordinates
    ↓
MediaPipe FaceLandmarker
    ├─ Detect face mesh (478 landmarks)
    ├─ Extract blend shapes
    └─ Return facial features
    ↓
Post-processing
    ├─ Classify pose (open/closed)
    ├─ Calculate movement
    ├─ Aggregate metrics
    └─ Format JSON
    ↓
Output (JSON)
```

#### Data Structure (JSON Output)

```json
{
  "success": true,
  "video_info": {
    "fps": 30,
    "resolution": [1280, 720],
    "duration_seconds": 60
  },
  "frames": [
    {
      "frame_id": 0,
      "timestamp": 0.0,
      "pose": {
        "landmarks": [
          {
            "x": 0.5,
            "y": 0.3,
            "z": 0.0,
            "confidence": 0.98,
            "label": "nose"
          }
        ],
        "classification": "open",
        "movement_pixels": 15.3
      },
      "face": {
        "detected": true,
        "landmarks_count": 478,
        "blend_shapes": {
          "jawOpen": 0.1,
          "eyeWideLeft": 0.05
        }
      }
    }
  ]
}
```

#### MediaPipe Models

**Face Landmarker:**
- 468 face mesh landmarks
- 10 blend shapes per frame
- Detects: face position, rotation, orientation
- Output: normalized coordinates (0-1)

**Pose Landmarker (Full):**
- 33 body keypoints
- Includes: head, shoulders, arms, hip, legs
- Confidence per landmark
- Output: normalized coordinates (0-1)

---

## 🔄 Integración Frontend-Backend

### Actual (Local)

```
Frontend (http://localhost:5173)
    ├─ Record video locally
    ├─ Save as WebM blob
    └─ Download to user device

Backend (http://localhost:8000)
    ├─ Process local video files
    └─ Output JSON to file system
```

### Futuro (REST API)

```
Frontend (http://localhost:5173)
    ├─ Record video
    ├─ POST /api/upload
    └─ GET /api/results/{id}

REST Server (FastAPI)
    ├─ Receive video
    ├─ Queue processing
    └─ Return results

Backend Worker
    ├─ Process video
    ├─ Save results
    └─ Update status
```

---

## 📦 Dependencias Clave

### Frontend

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| React | 18+ | UI framework |
| TypeScript | 5+ | Type safety |
| Vite | 5+ | Build tool |
| Tailwind CSS | 3+ | Styling (opcional) |
| React Router | 6+ | Routing |

### Backend

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| Python | 3.12 | Language runtime |
| MediaPipe | 0.10+ | ML inference |
| OpenCV | 4.8+ | Video processing |
| NumPy | 1.24+ | Numerical computing |

---

## ⚙️ Configuración

### Frontend (vite.config.ts)

```typescript
- Base URL: /
- Dev server: localhost:5173
- Build output: dist/
- Plugins: React
```

### Backend (config.py)

```python
POSE_MODEL = "pose_landmarker_full.task"
FACE_MODEL = "face_landmarker.task"
CONFIDENCE_THRESHOLD = 0.5
OUTPUT_FORMAT = "json"
```

---

## 🔐 Seguridad

### Frontend
- ✅ HTTPS en producción
- ✅ Content Security Policy headers
- ✅ Input validation

### Backend
- ✅ Validate input files
- ✅ Limit file size
- ✅ Sanitize JSON output
- ✅ Error handling (no stack traces in production)

---

## 🚀 Performance

### Frontend
- ✅ Code splitting (lazy loading)
- ✅ Image optimization
- ✅ CSS minification
- Target: < 3s First Contentful Paint

### Backend
- ✅ GPU acceleration (if available)
- ✅ Frame batching (process multiple frames)
- ✅ Model caching in memory
- Target: 30+ FPS on GPU, 15+ FPS on CPU

---

## 🧪 Testing Strategy

### Unit Tests

**Frontend:**
- Component rendering tests
- Event handler tests
- State management tests

**Backend:**
- Vision service tests
- JSON output validation
- Model loading tests

### Integration Tests

- End-to-end recording flow
- Backend API calls
- File I/O operations

### Performance Tests

- FPS measurement
- Memory usage profiling
- Load testing

---

## 📊 Monitoring & Logging

### Frontend
- Console logs (development only)
- Error tracking (future: Sentry)
- Performance metrics (future: Web Vitals)

### Backend
- Python logging module
- Performance metrics (FPS, latency)
- Error logs with timestamps

---

## 🔮 Arquitectura Futura

### Phase 2: Cloud Integration

```
Frontend
    ├─ WebSocket connection
    └─ Real-time updates

REST API Server (FastAPI/Flask)
    ├─ Video storage (S3)
    ├─ Job queue (Celery)
    └─ Database (PostgreSQL)

Worker Nodes
    ├─ Process videos in parallel
    ├─ Scale horizontally
    └─ Distribute load
```

### Phase 3: Advanced Features

- [ ] Multi-person pose detection
- [ ] Real-time streaming analysis
- [ ] Custom ML models
- [ ] Mobile app (React Native)
- [ ] Analytics dashboard
- [ ] Video annotations

---

## 📈 Scalability Considerations

1. **Rate Limiting**: Limit API requests per user
2. **Caching**: Cache model in memory
3. **Load Balancing**: Distribute across workers
4. **Database Indexing**: For future database layer
5. **CDN**: For static assets

---

**Última actualización:** April 14, 2026
