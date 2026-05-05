# 🤝 Contribuir a OpenPose

Gracias por tu interés en contribuir a OpenPose. Esta guía te ayudará a entender cómo hacerlo.

---

## 📋 Código de Conducta

- Sé respetuoso con otros contribuidores
- Acepta crítica constructiva
- Enfócate en lo mejor para la comunidad
- Reporta comportamiento inapropiado a los mantenedores

---

## 🚀 Cómo Contribuir

### 1. Fork y Clona

```bash
# Fork el repositorio en GitHub

# Clona tu fork
git clone https://github.com/tu-usuario/OpenPose.git
cd OpenPose

# Agrega upstream
git remote add upstream https://github.com/original-usuario/OpenPose.git
```

### 2. Crea una Rama de Feature

```bash
# Actualiza main
git fetch upstream
git checkout main
git merge upstream/main

# Crea tu rama
git checkout -b feature/tu-feature-nombre
```

**Convenciones de nombres:**
- `feature/descripcion-corta` - Nuevas características
- `fix/descripcion-corta` - Bug fixes
- `docs/descripcion-corta` - Documentación
- `refactor/descripcion-corta` - Cambios de código sin funcionalidad nueva

### 3. Desarrolla tu Cambio

```bash
# Realiza tus cambios
# Prueba localmente

# Si es frontend
npm run dev
npm test

# Si es backend
cd backend
pytest tests/
```

### 4. Commit y Push

```bash
# Commit con mensaje descriptivo
git commit -m "feat: agregar nueva feature X"
# o
git commit -m "fix: corregir bug en Y"

# Push a tu fork
git push origin feature/tu-feature-nombre
```

**Formato de commits:**
```
<tipo>: <descripción corta>

<descripción detallada opcional>

Fixes #123
```

Tipos válidos:
- `feat` - Nueva característica
- `fix` - Bug fix
- `docs` - Cambios en documentación
- `style` - Cambios de formato (no afectan lógica)
- `refactor` - Refactorización de código
- `test` - Agregar/actualizar tests
- `chore` - Cambios de build, deps, etc.

### 5. Envía un Pull Request

1. Ve a GitHub y crea Pull Request
2. Completa el template del PR
3. Describe los cambios claramente
4. Referencia issues relacionados: `Fixes #123`
5. Espera revisión

---

## 📝 Directrices de Código

### Frontend (TypeScript/React)

✅ **Requerido:**
- Type safety con TypeScript
- Componentes funcionales con hooks
- Props interfaces
- JSDoc comments en componentes complejos

✅ **Ejemplo:**
```typescript
/**
 * Componente de grabación de video
 * @param onRecord - Callback cuando se inicia grabación
 */
interface EvaluationRoomProps {
  onRecord?: (blob: Blob) => void;
}

export function EvaluationRoom({ onRecord }: EvaluationRoomProps) {
  // implementación
}
```

✅ **Convenciones:**
- Componentes en `PascalCase`: `MyComponent.tsx`
- Props interfaces con sufijo `Props`: `MyComponentProps`
- Estilos en el mismo componente o archivo `.css` separado
- Archivos comunes en `src/components/common/`

### Backend (Python)

✅ **Requerido:**
- Type hints en funciones
- Docstrings en módulos y funciones
- Snake_case para funciones y variables
- PascalCase para clases

✅ **Ejemplo:**
```python
from typing import Optional

def detect_pose(frame: np.ndarray, min_confidence: float = 0.5) -> Optional[Dict]:
    """
    Detecta postura corporal en un frame.
    
    Args:
        frame: Imagen de entrada (numpy array)
        min_confidence: Confianza mínima para landmarks
        
    Returns:
        Diccionario con puntos clave o None si no se detecta
    """
    # implementación
```

✅ **Convenciones:**
- Módulos en `snake_case`: `pose_detector.py`
- Clases en `PascalCase`: `PoseDetector`
- Constantes en `UPPER_SNAKE_CASE`: `MAX_FRAMES`

### Documentación

✅ **En archivos .md:**
- Usa headings jerárquicamente (#, ##, ###, etc.)
- Include ejemplos de código cuando sea posible
- Mantén líneas < 100 caracteres
- Usa links relativos: `[texto](ruta/archivo.md)`

---

## 🧪 Testing

### Frontend

```bash
# Ejecutar todos los tests
npm test

# Con cobertura
npm run test:coverage

# Watch mode
npm run test:watch
```

### Backend

```bash
cd backend
cd body-cam

# Ejecutar todos los tests
python -m pytest tests/ -v

# Con cobertura
pytest tests/ --cov=.

# Test específico
python -m pytest tests/test_vision.py::test_pose_detection
```

**Requerimiento:** Mantener cobertura > 80%

---

## 📚 Estructura de Carpetas

Cuando agregues nuevas características, mantén la estructura:

```
# Frontend
src/
├── components/
│   ├── common/              # Componentes reutilizables
│   │   └── YourComponent.tsx
│   └── YourPage/
│       ├── YourPage.tsx
│       ├── YourPage.css
│       └── YourPage.test.tsx
└── pages/
    └── YourPage/

# Backend
body-cam/
├── app/
│   └── services/
│       └── your_service.py
├── models/                  # Modelos ML
├── tests/
│   └── test_your_feature.py
└── your_module.py
```

---

## 🔄 Proceso de Revisión

1. Los mantenedores revisarán tu PR
2. Se pueden solicitar cambios
3. Una vez aprobado, será mergeado
4. Tu rama será eliminada

**Tiempo estimado:** 1-2 semanas

---

## 📦 Preparar una Release

(Solo para mantenedores)

```bash
# Crear tag
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push tag
git push origin v1.0.0
```

---

## 🆘 Ayuda

- **Issues**: Abre un issue para reportar bugs o sugerir features
- **Discussions**: Usa discussions para preguntas generales
- **Docs**: Lee [README.md](README.md) y [INDEX.md](INDEX.md)

---

## 📝 Licencia

Al contribuir, aceptas que tu código será licenciado bajo MIT License.

---

**¡Gracias por contribuir! 🎉**
