# Modelo Financiero Operativo — Apex Vision

Plantilla práctica para Excel/Google Sheets + escenarios de simulación.

---

## 1. Inputs (editables)

```
Clientes
Usuarios_por_cliente
Evaluaciones_por_usuario
Precio_por_usuario
Costo_por_evaluacion
Infra_fija_mensual
```

Valores sugeridos iniciales:

```
Clientes = 10
Usuarios_por_cliente = 2
Evaluaciones_por_usuario = 100
Precio_por_usuario = 70
Costo_por_evaluacion = 0.05
Infra_fija_mensual = 150
```

---

## 2. Cálculos (fórmulas)

```
Usuarios_totales = Clientes * Usuarios_por_cliente

Evaluaciones_totales = Usuarios_totales * Evaluaciones_por_usuario

Ingresos = Usuarios_totales * Precio_por_usuario

Costo_variable = Evaluaciones_totales * Costo_por_evaluacion

Costo_total = Costo_variable + Infra_fija_mensual

Profit = Ingresos - Costo_total

Margen = Profit / Ingresos
```

---

## 3. Ejemplo completo

```
Clientes = 20
Usuarios_por_cliente = 3
Evaluaciones_por_usuario = 150

Usuarios_totales = 60
Evaluaciones_totales = 9,000

Ingresos = 4,200
Costo_variable = 450
Costo_total = 600

Profit = 3,600
Margen = 85%
```

---

## 4. Escenarios

### Early (validación)

```
Clientes: 5
Usuarios: 2
Evaluaciones: 80
Precio: 50
```

Resultado:
- Ingresos: ~500
- Costos: ~130
- Profit: ~370

---

### PMF inicial

```
Clientes: 25
Usuarios: 3
Evaluaciones: 120
Precio: 70
```

Resultado:
- Ingresos: ~5,250
- Costos: ~800
- Profit: ~4,400

---

### Crecimiento

```
Clientes: 100
Usuarios: 4
Evaluaciones: 200
Precio: 80
```

Resultado:
- Ingresos: ~32,000
- Costos: ~4,000
- Profit: ~28,000

---

### Riesgo (uso alto sin control)

```
Clientes: 30
Usuarios: 5
Evaluaciones: 500
Precio: 50
```

Resultado:
- Ingresos: ~7,500
- Costos: ~4,000
- Profit: ~3,500

Insight: limitar evaluaciones o ajustar pricing.

---

## 5. Métricas clave

- Margen (>70% objetivo)
- Costo por usuario
- Evaluaciones por cliente (driver de costo)
- Profit mensual

---

## 6. Reglas operativas

- No ofrecer ilimitado sin límites internos
- Revisar uso por cliente semanalmente
- Ajustar pricing si el costo por usuario sube

---

## 7. Uso semanal

1. Actualizar inputs reales
2. Revisar margen y profit
3. Decidir: pricing, límites, optimización

---

## 8. Extensiones futuras

- Churn (%)
- Crecimiento mensual (%)
- CAC (costo de adquisición)
- LTV por cliente
