<#
Local setup helper for Apex Vision.

Usage:
  powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
  powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -SkipInstall
  powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -SkipDockerCheck
#>

[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$SkipDockerCheck,
    [switch]$SkipEnv
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Set-Location -LiteralPath $repoRoot

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "[step] $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "[ok] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[warn] $Message" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Message)
    Write-Host "[fail] $Message" -ForegroundColor Red
}

function Assert-Command {
    param(
        [string]$Name,
        [string]$InstallHint
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Write-Fail "$Name no esta instalado o no esta en PATH."
        Write-Host "       $InstallHint"
        return $false
    }

    Write-Ok "$Name detectado"
    return $true
}

function Invoke-Logged {
    param(
        [string]$Command,
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )

    Push-Location -LiteralPath $WorkingDirectory
    try {
        Write-Host "       $Command $($Arguments -join ' ')"
        & $Command @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Comando fallo con codigo $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Resolve-PythonCommand {
    if (Get-Command "py" -ErrorAction SilentlyContinue) {
        return [pscustomobject]@{ Command = "py"; VenvArgs = @("-3.12", "-m", "venv", ".venv") }
    }

    if (Get-Command "python" -ErrorAction SilentlyContinue) {
        return [pscustomobject]@{ Command = "python"; VenvArgs = @("-m", "venv", ".venv") }
    }

    return $null
}

function Initialize-PythonEnv {
    param(
        [string]$ProjectName,
        [string]$ProjectPath,
        [string]$RequirementsPath
    )

    $absoluteProjectPath = Join-Path $repoRoot $ProjectPath
    $absoluteRequirementsPath = Join-Path $repoRoot $RequirementsPath
    $venvPath = Join-Path $absoluteProjectPath ".venv"
    $pythonExe = Join-Path $venvPath "Scripts\python.exe"

    if (-not (Test-Path -LiteralPath $absoluteRequirementsPath)) {
        Write-Warn "$ProjectName omitido: no existe $RequirementsPath"
        return
    }

    if (-not (Test-Path -LiteralPath $venvPath)) {
        Write-Host "       Creando venv para $ProjectName"
        Invoke-Logged -Command $script:Python.Command -Arguments $script:Python.VenvArgs -WorkingDirectory $absoluteProjectPath
    }
    else {
        Write-Host "       Reusando venv de $ProjectName"
    }

    if (-not (Test-Path -LiteralPath $pythonExe)) {
        throw "No se encontro Python del venv: $pythonExe"
    }

    Invoke-Logged -Command $pythonExe -Arguments @("-m", "pip", "install", "--upgrade", "pip") -WorkingDirectory $absoluteProjectPath
    Invoke-Logged -Command $pythonExe -Arguments @("-m", "pip", "install", "-r", $absoluteRequirementsPath) -WorkingDirectory $absoluteProjectPath
    Write-Ok "$ProjectName dependencies instaladas"
}

function Initialize-NodeProject {
    param(
        [string]$ProjectName,
        [string]$ProjectPath
    )

    $absoluteProjectPath = Join-Path $repoRoot $ProjectPath
    $packageJson = Join-Path $absoluteProjectPath "package.json"

    if (-not (Test-Path -LiteralPath $packageJson)) {
        Write-Warn "$ProjectName omitido: no existe package.json"
        return
    }

    Invoke-Logged -Command "npm" -Arguments @("install") -WorkingDirectory $absoluteProjectPath
    Write-Ok "$ProjectName dependencies instaladas"
}

function Test-ComposeFile {
    param([string]$ComposePath)

    $absoluteComposePath = Join-Path $repoRoot $ComposePath
    if (-not (Test-Path -LiteralPath $absoluteComposePath)) {
        Write-Warn "No existe $ComposePath"
        return
    }

    Write-Host "       Validando $ComposePath"
    & docker compose -f $absoluteComposePath config --quiet
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose config fallo para $ComposePath"
    }

    Write-Ok "$ComposePath es valido"
}

function Test-DockerfileReferences {
    param([string]$ComposePath)

    $absoluteComposePath = Join-Path $repoRoot $ComposePath
    if (-not (Test-Path -LiteralPath $absoluteComposePath)) {
        return
    }

    $composeContent = Get-Content -Raw -LiteralPath $absoluteComposePath
    $composeDir = Split-Path -Parent $absoluteComposePath
    $contexts = @()
    $currentContext = $null

    foreach ($line in ($composeContent -split "`r?`n")) {
        if ($line -match "^\s+context:\s+(.+?)\s*$") {
            $currentContext = $Matches[1].Trim().Trim('"').Trim("'")
        }
        elseif ($line -match "^\s+dockerfile:\s+(.+?)\s*$") {
            $dockerfile = $Matches[1].Trim().Trim('"').Trim("'")
            if ($currentContext) {
                $contexts += [pscustomobject]@{ Context = $currentContext; Dockerfile = $dockerfile }
            }
        }
    }

    foreach ($entry in $contexts) {
        $dockerfilePath = Join-Path (Join-Path $composeDir $entry.Context) $entry.Dockerfile
        if (-not (Test-Path -LiteralPath $dockerfilePath)) {
            throw "Compose referencia un Dockerfile inexistente: $dockerfilePath"
        }
        Write-Ok "Dockerfile encontrado: $($entry.Context)/$($entry.Dockerfile)"
    }
}

Write-Host "Apex Vision local setup" -ForegroundColor White
Write-Host "Repo: $repoRoot"

Write-Step "Verificando herramientas base"
$script:Python = Resolve-PythonCommand
$pythonOk = $null -ne $script:Python
if ($pythonOk) {
    Write-Ok "$($script:Python.Command) detectado"
}
else {
    Write-Fail "Python no esta instalado o no esta en PATH."
    Write-Host "       Instala Python 3.12 desde https://www.python.org/downloads/."
}
$npmOk = Assert-Command -Name "npm" -InstallHint "Instala Node.js LTS desde https://nodejs.org/."
$dockerOk = Assert-Command -Name "docker" -InstallHint "Instala Docker Desktop y abrelo antes de correr compose."

if (-not $pythonOk -and -not $SkipInstall) {
    throw "Falta Python para instalar dependencias."
}

if (-not $SkipEnv) {
    Write-Step "Preparando variables locales"
    if (-not (Test-Path -LiteralPath ".env") -and (Test-Path -LiteralPath ".env.example")) {
        Copy-Item -LiteralPath ".env.example" -Destination ".env"
        Write-Warn "Se creo .env desde .env.example. Completa las API keys antes de levantar workers de IA."
    }
    elseif (Test-Path -LiteralPath ".env") {
        Write-Ok ".env ya existe"
    }
    else {
        Write-Warn "No se encontro .env.example para crear .env"
    }
}

if (-not $SkipInstall) {
    Write-Step "Instalando dependencias Python"
    Initialize-PythonEnv -ProjectName "api-gateway" -ProjectPath "api-gateway" -RequirementsPath "api-gateway\requirements.txt"
    Initialize-PythonEnv -ProjectName "ai-workers" -ProjectPath "ai-workers" -RequirementsPath "ai-workers\requirements.txt"
    Initialize-PythonEnv -ProjectName "pose worker" -ProjectPath "ai-workers\pose" -RequirementsPath "ai-workers\pose\requirements.txt"
    Initialize-PythonEnv -ProjectName "whisper worker" -ProjectPath "ai-workers\whisper" -RequirementsPath "ai-workers\whisper\requirements.txt"
    Initialize-PythonEnv -ProjectName "infra migrations" -ProjectPath "infra\migrations" -RequirementsPath "infra\migrations\requirements.txt"
    Initialize-PythonEnv -ProjectName "infra tests" -ProjectPath "infra\tests" -RequirementsPath "infra\tests\requirements.txt"
    Initialize-PythonEnv -ProjectName "github-mcp" -ProjectPath "github-mcp" -RequirementsPath "github-mcp\requirements.txt"

    Write-Step "Instalando dependencias Node"
    if ($npmOk) {
        Initialize-NodeProject -ProjectName "body-detection" -ProjectPath "body-detection"
        Initialize-NodeProject -ProjectName "frontend" -ProjectPath "frontend"
    }
    else {
        Write-Warn "Se omiten dependencias Node porque npm no esta disponible."
    }
}
else {
    Write-Warn "Instalacion omitida por -SkipInstall"
}

if (-not $SkipDockerCheck) {
    Write-Step "Revisando dockerizacion"
    if ($dockerOk) {
        Test-ComposeFile -ComposePath "docker-compose.yml"
        Test-DockerfileReferences -ComposePath "docker-compose.yml"
        Test-ComposeFile -ComposePath "ai-workers\docker-compose.yml"
        Test-DockerfileReferences -ComposePath "ai-workers\docker-compose.yml"
    }
    else {
        Write-Warn "Chequeo Docker omitido porque docker no esta disponible."
    }
}
else {
    Write-Warn "Chequeo Docker omitido por -SkipDockerCheck"
}

Write-Step "Resumen"
Write-Host "Frontend actual: servido como archivos estaticos por nginx en docker-compose.yml."
Write-Host "Frontend npm: no se instala si frontend/package.json no existe."
Write-Host "Arranque completo: .\scripts\start-mvp.ps1 o docker compose up -d --build"
Write-Host "URLs: http://localhost:5173/Apex%20Vision%20Vendedor.html y http://localhost:8080/docs"
Write-Ok "Setup local finalizado"
