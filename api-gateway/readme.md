# 🚀 Configuración e Instalación - GORM + PostgreSQL

## 📦 Requisitos

* Go 1.22+
* PostgreSQL instalado

---

## 🐘 Instalación de PostgreSQL (Ubuntu)

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib -y
```

### Iniciar servicio

```bash
sudo service postgresql start
```

### Acceder a PostgreSQL

```bash
sudo -u postgres psql
```

### Configurar extensión UUID

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Configurar contraseña del usuario postgres

```sql
ALTER USER postgres WITH PASSWORD 'postgres';
```

Salir:

```sql
\q
```

---

## 📁 Inicializar proyecto Go

```bash
go mod init github.com/Jeskaai/jupiter-api-gateway
```

---

## 📦 Instalación de dependencias

```bash
go get gorm.io/gorm
go get gorm.io/driver/postgres
go get github.com/google/uuid
go mod tidy
```

---

## 🗂️ Estructura del proyecto

```
jupiter-api-gateway/
│
├── cmd/
│   └── api/
│       └── main.go
│
├── internal/
│   └── database/
│       └── db.go
│
├── pkg/
│   └── models/
│       └── user.go
│
├── go.mod

## ▶️ Ejecutar el proyecto

Desde la raíz del proyecto:

```bash
go run cmd/api/main.go
```

---

## ✅ Resultado esperado

```bash
Conectado a PostgreSQL correctamente
```

---

## 🧪 Verificar tabla en PostgreSQL

```bash
sudo -u postgres psql
```

```sql
\c postgres
\dt
```

Deberías ver:

```
users
```

---

## 🎯 Objetivo cumplido

* Conexión a PostgreSQL con GORM ✅
* Modelo `User` definido correctamente ✅
* Auto-Migración implementada ✅
* Tabla creada automáticamente ✅

---
