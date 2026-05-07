# ═══════════════════════════════════════════════════════════════════════════════
# Apex Vision MVP — Startup script (Windows PowerShell)
# ═══════════════════════════════════════════════════════════════════════════════
# Uso: .\scripts\start-mvp.ps1
#
# Lo que hace:
#   1. Crea .env desde .env.example si no existe
#   2. Detiene contenedores previos
#   3. Construye y levanta todos los servicios
#   4. Espera a que esten saludables
#   5. Ejecuta seed (tenant + usuarios demo + preguntas)
#   6. Muestra URLs, credenciales y comandos de prueba
# ═══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Set-Location -LiteralPath $repoRoot

# ── 0. Verificar Docker ────────────────────────────────────────────────────────

$dockerOk = $false
try {
    $null = docker info 2>&1
    $dockerOk = ($LASTEXITCODE -eq 0)
} catch { }

if (-not $dockerOk) {
    Write-Host "[FAIL] Docker no esta corriendo. Abri Docker Desktop y espera a que este listo (icono verde)." -ForegroundColor Red
    exit 1
}
Write-Host "[info] Docker detectado correctamente." -ForegroundColor Cyan

# ── 1. .env ───────────────────────────────────────────────────────────────────

if (-not (Test-Path -LiteralPath ".env")) {
    Write-Host "[info] Copiando .env.example → .env" -ForegroundColor Cyan
    Copy-Item -LiteralPath ".env.example" -Destination ".env"
    Write-Host "[WARN] Edita .env y pone tu OPENAI_API_KEY antes de continuar." -ForegroundColor Yellow
    Write-Host "       Sin la key, Whisper y Scoring no funcionaran." -ForegroundColor Yellow
    Write-Host "       Presiona ENTER cuando este listo, o Ctrl+C para salir." -ForegroundColor Yellow
    Read-Host
} else {
    Write-Host "[info] .env ya existe, se usara el actual" -ForegroundColor Cyan
}

# ── 2. Detener contenedores previos ────────────────────────────────────────────

Write-Host "[step] Deteniendo contenedores previos..." -ForegroundColor Yellow
try { docker compose down 2>&1 | Out-Null } catch { }
Write-Host "       Listo." -ForegroundColor Green

# ── 3. Construir y levantar ────────────────────────────────────────────────────

Write-Host "[step] Construyendo imagenes y levantando servicios..." -ForegroundColor Yellow
try { docker compose up -d --build 2>&1 | Out-Null } catch { }
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] docker compose up fallo. Revisa que Docker Desktop este corriendo." -ForegroundColor Red
    exit 1
}

# ── 4. Esperar servicios ──────────────────────────────────────────────────────

Write-Host "[step] Esperando a que todos los servicios esten saludables..." -ForegroundColor Yellow
$maxWait = 120
$elapsed = 0
$gatewayPort = if ($env:GATEWAY_PORT) { $env:GATEWAY_PORT } else { "8080" }
$frontendPort = if ($env:FRONTEND_PORT) { $env:FRONTEND_PORT } else { "5173" }

do {
    Start-Sleep -Seconds 3
    $elapsed += 3

    try {
        $gateway = Invoke-WebRequest -Uri "http://localhost:${gatewayPort}/health" -TimeoutSec 2 -UseBasicParsing
        $gatewayOk = $gateway.StatusCode -eq 200
    } catch {
        $gatewayOk = $false
    }

    $statusMsg = "       Gateway: $(if ($gatewayOk) {'OK'} else {'...'})"
    Write-Host $statusMsg -NoNewline
    Write-Host ("  (${elapsed}s)" )
} until ($gatewayOk -or $elapsed -ge $maxWait)

if (-not $gatewayOk) {
    Write-Host "[FAIL] El gateway no respondio en ${maxWait}s. Revisa: docker compose logs gateway" -ForegroundColor Red
    exit 1
}

# ── 5. Seed ────────────────────────────────────────────────────────────────────

Write-Host "[step] Ejecutando seed (tenant + usuarios demo + preguntas)..." -ForegroundColor Yellow
try { docker compose run --rm gateway ./seed 2>&1 | Out-Null } catch { }
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] El seed fallo. Revisa los logs." -ForegroundColor Red
    exit 1
}

# ── 6. Mostrar resumen ─────────────────────────────────────────────────────────

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║         MVP Apex Vision — Listo en localhost                 ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  URLs:" -ForegroundColor White
Write-Host "    Frontend (vendedor)  → http://localhost:${frontendPort}/Apex%20Vision%20Vendedor.html"
Write-Host "    Frontend (admin)     → http://localhost:${frontendPort}/Apex%20Vision%20Console.html"
Write-Host "    API Gateway          → http://localhost:${gatewayPort}"
Write-Host "    API Docs (OpenAPI)   → http://localhost:${gatewayPort}/docs"
Write-Host "    RabbitMQ UI          → http://localhost:15672  (guest / guest)"
Write-Host "    MinIO Console        → http://localhost:9001   (minioadmin / minioadmin)"
Write-Host ""
Write-Host "  Credenciales demo:" -ForegroundColor White
Write-Host "    Vendedor: seller.demo@jupiter.local / Demo1234!"
Write-Host "    Admin:    admin.demo@jupiter.local  / Demo1234!"
Write-Host ""
Write-Host "  Probar login:" -ForegroundColor White
Write-Host "    curl -X POST http://localhost:${gatewayPort}/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"seller.demo@jupiter.local\",\"password\":\"Demo1234!\"}'"
Write-Host ""
Write-Host "  Comandos utiles:" -ForegroundColor White
Write-Host "    docker compose ps          # estado de servicios"
Write-Host "    docker compose logs -f     # logs en vivo"
Write-Host "    make health                # verificacion rapida"
Write-Host "    docker compose down        # detener todo"
Write-Host ""
