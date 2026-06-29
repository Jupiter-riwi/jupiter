# start-local.ps1
# This script deploys the Apex Vision project locally without Docker.

$ErrorActionPreference = "Stop"

function Write-Host-Color {
    param([string]$Message, [ConsoleColor]$Color)
    Write-Host $Message -ForegroundColor $Color
}

# 0. Check Disk Space
$freeSpace = (Get-PSDrive C).Free / 1GB
if ($freeSpace -lt 2) {
    Write-Host-Color "CRITICAL ERROR: No tienes suficiente espacio en el disco C: ($([math]::Round($freeSpace, 2)) GB libres)." "Red"
    Write-Host-Color "Necesitas al menos 2 GB libres para que funcione Docker o para poder descargar Postgres/RabbitMQ/MinIO." "Red"
    Write-Host-Color "Por favor libera espacio en C: o mueve este proyecto a D: y vuelve a intentar." "Red"
    exit 1
}

# 1. Prerequisites Check & Install
$missingPrereqs = @()
if (!(Get-Command "winget" -ErrorAction SilentlyContinue)) { $missingPrereqs += "winget" }
if ($missingPrereqs.Contains("winget")) {
    Write-Host-Color "Error: winget is not installed. Please install App Installer from the Microsoft Store." "Red"
    exit 1
}

$tools = @{
    "go" = "GoLang.Go"
    "node" = "OpenJS.NodeJS"
    "python" = "Python.Python.3.12"
}

$pathNeedsRefresh = $false
foreach ($tool in $tools.Keys) {
    if (!(Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Host-Color "$tool is missing. Installing via winget..." "Yellow"
        winget install $tools[$tool] -e --silent
        $pathNeedsRefresh = $true
    }
}

if ($pathNeedsRefresh) {
    Write-Host-Color "Refreshing environment variables..." "Cyan"
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# 2. Install PostgreSQL (if not running)
$postgresRunning = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", 5432)
    $postgresRunning = $true
    $tcp.Close()
} catch {}

if (!$postgresRunning) {
    Write-Host-Color "PostgreSQL is not running on port 5432. Attempting to install via winget..." "Yellow"
    Write-Host-Color "Note: If prompted by UAC, please accept the installation." "Yellow"
    winget install PostgreSQL.PostgreSQL.16 -e --silent --override "--unattendedmodeui none --mode unattended --superpassword postgres --serverport 5432"
    Start-Sleep -Seconds 10
} else {
    Write-Host-Color "PostgreSQL is already running." "Green"
}

# 3. Install Erlang and RabbitMQ (if not running)
$rabbitRunning = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", 5672)
    $rabbitRunning = $true
    $tcp.Close()
} catch {}

if (!$rabbitRunning) {
    Write-Host-Color "RabbitMQ is not running on port 5672. Attempting to install via winget..." "Yellow"
    winget install Erlang.ErlangOTP -e --silent
    Write-Host-Color "Please install RabbitMQ manually from https://github.com/rabbitmq/rabbitmq-server/releases/download/v3.13.2/rabbitmq-server-3.13.2.exe" "Red"
    Start-Sleep -Seconds 10
} else {
    Write-Host-Color "RabbitMQ is already running." "Green"
}

# 4. Setup MinIO
$minioDir = "$PSScriptRoot\.bin"
if (!(Test-Path $minioDir)) {
    New-Item -ItemType Directory -Path $minioDir | Out-Null
}

$minioExe = "$minioDir\minio.exe"
if ((Test-Path $minioExe) -and (Get-Item $minioExe).Length -lt 10MB) {
    Remove-Item $minioExe -Force
}
if (!(Test-Path $minioExe)) {
    Write-Host-Color "Downloading MinIO standalone..." "Yellow"
    Invoke-WebRequest -Uri "https://dl.min.io/server/minio/release/windows-amd64/minio.exe" -OutFile $minioExe
}

$minioData = "$minioDir\minio-data"
if (!(Test-Path $minioData)) {
    New-Item -ItemType Directory -Path $minioData | Out-Null
}

Write-Host-Color "Starting MinIO in background..." "Cyan"
$env:MINIO_ROOT_USER = "minioadmin"
$env:MINIO_ROOT_PASSWORD = "minioadmin"
Start-Process -FilePath $minioExe -ArgumentList "server $minioData --console-address :9001" -WindowStyle Minimized

# 5. Database Setup (Migrations via alembic in python)
Write-Host-Color "Setting up database migrations..." "Cyan"
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/jupiter"

# Create jupiter database if it doesn't exist
try {
    $env:PGPASSWORD = "postgres"
    & psql -U postgres -h localhost -c "CREATE DATABASE jupiter;" 2>$null
} catch {}

# Use python alembic to run migrations
Push-Location "$PSScriptRoot\infra\migrations"
python -m pip install -q -r requirements.txt
python -m alembic upgrade head
Pop-Location

# 6. Build and Start Gateway (Go)
Write-Host-Color "Starting API Gateway..." "Cyan"
Push-Location "$PSScriptRoot\api-gateway"
$env:DB_HOST="localhost"
$env:DB_PORT="5432"
$env:DB_USER="postgres"
$env:DB_PASSWORD="postgres"
$env:DB_NAME="jupiter"
$env:PORT="8080"
$env:JWT_SECRET="change_me_in_production"
$env:JWT_EXPIRY_MINUTES="15"
$env:JWT_REFRESH_EXPIRY_HOURS="168"
$env:RABBITMQ_URL="amqp://guest:guest@localhost:5672/"
$env:MINIO_ENDPOINT="localhost:9000"
$env:MINIO_PUBLIC_ENDPOINT="localhost:9000"
$env:MINIO_ACCESS_KEY="minioadmin"
$env:MINIO_SECRET_KEY="minioadmin"
$env:MINIO_BUCKET="jupiter-videos"
$env:MINIO_USE_SSL="false"
$env:MINIO_PUBLIC_USE_SSL="false"
$env:CORS_ALLOW_ORIGIN="http://localhost:5173"

go mod tidy
go build -o gateway.exe cmd/api/main.go
go build -o seed.exe cmd/seed/main.go

Write-Host-Color "Running Seed..." "Cyan"
.\seed.exe

Start-Process -FilePath ".\gateway.exe" -WindowStyle Minimized
Pop-Location

# 7. Start AI Workers (Python)
Write-Host-Color "Starting AI Workers..." "Cyan"
Push-Location "$PSScriptRoot\ai-workers"
$env:RABBITMQ_HOST="localhost"
$env:RABBITMQ_PORT="5672"
$env:RABBITMQ_USER="guest"
$env:RABBITMQ_PASS="guest"
$env:S3_ENDPOINT_URL="http://localhost:9000"
$env:AWS_ACCESS_KEY_ID="minioadmin"
$env:AWS_SECRET_ACCESS_KEY="minioadmin"
$env:AWS_REGION="us-east-1"
$env:POSE_JOBS_QUEUE="pose.jobs"
$env:FEATURES_RESULTS_QUEUE="features.results"
$env:WHISPER_JOBS_QUEUE="whisper.jobs"
$env:PROSODY_QUEUE="prosody.jobs"
$env:SCORING_QUEUE="scoring.jobs"
# Please set OPENAI_API_KEY manually before running this if needed, or in the terminal

python -m pip install -q -r requirements.txt

# Start each worker in a minimized window
Start-Process -FilePath "python" -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8003" -WorkingDirectory "pose" -WindowStyle Minimized
Start-Process -FilePath "python" -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8004" -WorkingDirectory "whisper" -WindowStyle Minimized
Start-Process -FilePath "python" -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8001" -WorkingDirectory "prosody" -WindowStyle Minimized
Start-Process -FilePath "python" -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8002" -WorkingDirectory "scoring" -WindowStyle Minimized
Pop-Location

# 8. Start Frontend
Write-Host-Color "Starting Frontend..." "Cyan"
Push-Location "$PSScriptRoot\frontend"
$env:VITE_API_URL="http://localhost:8080"
npm install --silent
Start-Process -FilePath "npm" -ArgumentList "run dev" -WindowStyle Minimized
Pop-Location

Write-Host-Color "=== Local Deployment Started ===" "Green"
Write-Host-Color "Services:" "White"
Write-Host-Color "- Gateway:  http://localhost:8080" "White"
Write-Host-Color "- Frontend: http://localhost:5173" "White"
Write-Host-Color "- MinIO:    http://localhost:9001" "White"
Write-Host-Color "- RabbitMQ: http://localhost:15672" "White"
Write-Host-Color "Note: Multiple terminal windows have been opened for the background services. Close them to stop the services." "Yellow"
