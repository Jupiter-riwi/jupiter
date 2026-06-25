#!/usr/bin/env python3
"""
Apex Vision — setup local (multiplataforma).

Reemplaza a scripts/setup-local.ps1 y scripts/setup-local.sh con un único script
de Python que corre igual en Windows, macOS y Linux.

Qué hace:
  1. Verifica herramientas base (python, npm, docker — docker es opcional).
  2. Crea .env desde .env.example (raíz y api-gateway) si no existen.
  3. Crea un venv por cada proyecto Python e instala sus requirements.
  4. Instala dependencias Node donde haya package.json.
  5. (Opcional) valida los docker-compose si docker está disponible.

Uso:
  python scripts/setup.py                  # todo
  python scripts/setup.py --skip-install   # solo validar herramientas + env
  python scripts/setup.py --skip-node       # no instalar dependencias de Node
  python scripts/setup.py --skip-docker     # no validar los compose
  python scripts/setup.py --skip-env        # no tocar archivos .env

Después de esto:
  python scripts/run.py                     # levanta todos los servicios
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# (nombre, ruta_proyecto, ruta_requirements) — relativos a REPO_ROOT.
PYTHON_PROJECTS = [
    ("api-gateway",     "api-gateway",              "api-gateway/requirements.txt"),
    ("ai-workers",      "ai-workers",               "ai-workers/requirements.txt"),
    ("pose worker",     "ai-workers/pose",          "ai-workers/pose/requirements.txt"),
    ("whisper worker",  "ai-workers/whisper",       "ai-workers/whisper/requirements.txt"),
    ("infra migrations","infra/migrations",         "infra/migrations/requirements.txt"),
    ("infra tests",     "infra/tests",              "infra/tests/requirements.txt"),
    ("github-mcp",      "github-mcp",               "github-mcp/requirements.txt"),
]

NODE_PROJECTS = [
    ("body-detection", "body-detection"),
    ("frontend",       "frontend"),
]

# (archivo .env.example, archivo .env destino) — relativos a REPO_ROOT.
ENV_FILES = [
    (".env.example", ".env"),
    ("api-gateway/.env.example", "api-gateway/.env"),
]


# ---------------------------------------------------------------------------
# Salida con color (degradado a texto plano si la terminal no lo soporta)
# ---------------------------------------------------------------------------

_USE_COLOR = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


def _c(code: str, text: str) -> str:
    if not _USE_COLOR:
        return text
    return f"\033[{code}m{text}\033[0m"


def step(msg: str) -> None:
    print()
    print(_c("36;1", f"[step] {msg}"))


def ok(msg: str) -> None:
    print(_c("32", f"[ok]   {msg}"))


def warn(msg: str) -> None:
    print(_c("33", f"[warn] {msg}"))


def fail(msg: str) -> None:
    print(_c("31;1", f"[fail] {msg}"))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def have(cmd: str) -> bool:
    return shutil.which(cmd) is not None


def venv_python(project_dir: Path) -> Path:
    """Ruta al intérprete dentro del venv del proyecto (según plataforma)."""
    if os.name == "nt":
        return project_dir / ".venv" / "Scripts" / "python.exe"
    return project_dir / ".venv" / "bin" / "python"


def base_python_cmd() -> list[str]:
    """Comando del Python base para crear venvs. Prefiere el launcher `py -3.12`
    en Windows si existe, si no usa el intérprete actual."""
    if os.name == "nt" and have("py"):
        return ["py", "-3.12"]
    return [sys.executable]


def run(cmd: list[str], cwd: Path | None = None) -> None:
    """Ejecuta un comando y lanza excepción si falla."""
    printable = " ".join(str(c) for c in cmd)
    print(_c("90", f"       $ {printable}"))
    subprocess.run(cmd, cwd=str(cwd) if cwd else None, check=True)


# ---------------------------------------------------------------------------
# Pasos
# ---------------------------------------------------------------------------

def check_tools() -> dict[str, bool]:
    step("Verificando herramientas base")
    tools = {
        "python": True,  # ya estamos corriendo en python
        "npm": have("npm"),
        "docker": have("docker"),
    }
    ok(f"python detectado ({sys.version.split()[0]})")
    if tools["npm"]:
        ok("npm detectado")
    else:
        warn("npm NO detectado — se omitirán dependencias de Node (instala Node.js LTS).")
    if tools["docker"]:
        ok("docker detectado")
    else:
        warn("docker NO detectado — podrás correr la infra de otra forma (ver run.py).")
    return tools


def prepare_env() -> None:
    step("Preparando archivos .env")
    for example_rel, target_rel in ENV_FILES:
        example = REPO_ROOT / example_rel
        target = REPO_ROOT / target_rel
        if not example.exists():
            continue
        if target.exists():
            ok(f"{target_rel} ya existe")
        else:
            shutil.copyfile(example, target)
            warn(f"creado {target_rel} desde {example_rel} — completa las API keys.")


def setup_python_project(name: str, project_rel: str, req_rel: str) -> None:
    project_dir = REPO_ROOT / project_rel
    req_path = REPO_ROOT / req_rel
    if not req_path.exists():
        warn(f"{name}: omitido (no existe {req_rel})")
        return

    py = venv_python(project_dir)
    if not py.exists():
        print(f"       creando venv para {name}")
        run(base_python_cmd() + ["-m", "venv", ".venv"], cwd=project_dir)
    else:
        print(f"       reusando venv de {name}")

    if not py.exists():
        raise RuntimeError(f"no se encontró el python del venv: {py}")

    run([str(py), "-m", "pip", "install", "--upgrade", "pip", "--quiet"], cwd=project_dir)
    run([str(py), "-m", "pip", "install", "-r", str(req_path), "--quiet"], cwd=project_dir)
    ok(f"{name}: dependencias instaladas")


def setup_node_project(name: str, project_rel: str) -> None:
    project_dir = REPO_ROOT / project_rel
    if not (project_dir / "package.json").exists():
        warn(f"{name}: omitido (no existe package.json)")
        return
    run(["npm", "install"], cwd=project_dir)
    ok(f"{name}: dependencias Node instaladas")


def validate_compose(docker_ok: bool) -> None:
    step("Validando docker-compose (opcional)")
    if not docker_ok:
        warn("docker no disponible — se omite la validación de compose.")
        return
    for compose_rel in ("docker-compose.yml", "ai-workers/docker-compose.yml"):
        compose = REPO_ROOT / compose_rel
        if not compose.exists():
            continue
        try:
            subprocess.run(
                ["docker", "compose", "-f", str(compose), "config", "--quiet"],
                check=True,
            )
            ok(f"{compose_rel} es válido")
        except subprocess.CalledProcessError:
            warn(f"{compose_rel}: la validación falló (no bloquea el setup).")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Setup local de Apex Vision.")
    parser.add_argument("--skip-install", action="store_true", help="No instalar dependencias Python.")
    parser.add_argument("--skip-node", action="store_true", help="No instalar dependencias Node.")
    parser.add_argument("--skip-docker", action="store_true", help="No validar los docker-compose.")
    parser.add_argument("--skip-env", action="store_true", help="No crear archivos .env.")
    args = parser.parse_args()

    print(_c("37;1", "Apex Vision — setup local"))
    print(f"Repo: {REPO_ROOT}")

    tools = check_tools()

    if not args.skip_env:
        prepare_env()

    if not args.skip_install:
        step("Instalando dependencias Python (un venv por proyecto)")
        failures: list[str] = []
        for name, project_rel, req_rel in PYTHON_PROJECTS:
            try:
                setup_python_project(name, project_rel, req_rel)
            except (subprocess.CalledProcessError, RuntimeError) as exc:
                fail(f"{name}: {exc}")
                failures.append(name)

        if not args.skip_node:
            step("Instalando dependencias Node")
            if tools["npm"]:
                for name, project_rel in NODE_PROJECTS:
                    try:
                        setup_node_project(name, project_rel)
                    except subprocess.CalledProcessError as exc:
                        fail(f"{name}: {exc}")
                        failures.append(name)
            else:
                warn("npm no disponible — se omiten dependencias Node.")

        if failures:
            warn(f"Proyectos con error: {', '.join(failures)}")
    else:
        warn("Instalación omitida por --skip-install")

    if not args.skip_docker:
        validate_compose(tools["docker"])

    step("Resumen")
    print("  Levantar todo:    python scripts/run.py")
    print("  Solo infra Docker: python scripts/run.py --infra docker --no-workers --no-frontend")
    print("  URLs cuando corra: http://localhost:5173/  ·  http://localhost:8080/docs")
    ok("Setup local finalizado")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
