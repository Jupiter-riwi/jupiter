#!/usr/bin/env python3
"""
Apex Vision — levantar todos los servicios (multiplataforma, sin depender de
Docker para el código Python).

Reemplaza a scripts/start-mvp.ps1. Levanta cada servicio como proceso nativo
usando el venv que creó scripts/setup.py, multiplexa los logs con prefijos de
color, y los deja corriendo hasta que pulses Ctrl+C (apaga todo de forma limpia).

La infraestructura (postgres, rabbitmq, minio) se maneja aparte porque no es
código nuestro:

  --infra docker     (default) intenta `docker compose up -d` solo de la infra.
  --infra external   asume que ya está corriendo (instalación local, nube,
                     Supabase, etc.) — solo verifica conectividad.
  --infra none       no toca la infra.

Servicios Python que se levantan nativos:
  gateway   (uvicorn app.main:app                 :8080)
  pose      (python -m pose_worker.main)
  whisper   (python -m whisper_worker.main)
  prosody   (uvicorn prosody.main:app             :8001)
  scoring   (uvicorn scoring.main:app             :8002)
  frontend  (python -m http.server                :5173)

Uso:
  python scripts/run.py
  python scripts/run.py --infra external          # infra ya corriendo afuera
  python scripts/run.py --no-workers              # solo gateway + frontend
  python scripts/run.py --no-frontend --no-seed
  python scripts/run.py --gateway-port 8080 --frontend-port 5173
"""

from __future__ import annotations

import argparse
import os
import signal
import socket
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

_USE_COLOR = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None
# Colores ANSI rotados por servicio para distinguir los logs.
_PREFIX_COLORS = ["36", "32", "33", "35", "34", "31", "92", "94"]


def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _USE_COLOR else text


def info(msg: str) -> None:
    print(_c("36;1", f"[run] {msg}"))


def warn(msg: str) -> None:
    print(_c("33", f"[run] {msg}"))


def err(msg: str) -> None:
    print(_c("31;1", f"[run] {msg}"))


# ---------------------------------------------------------------------------
# .env
# ---------------------------------------------------------------------------

def load_env_file(path: Path) -> dict[str, str]:
    """Parser minimalista de .env (KEY=VALUE, ignora comentarios y comillas)."""
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key:
            out[key] = val
    return out


def build_env() -> dict[str, str]:
    """Variables base para los procesos nativos. Todo apunta a localhost porque
    no estamos dentro de la red de docker-compose. Los valores de .env (raíz +
    api-gateway) sobreescriben los defaults, y los del entorno actual ganan."""
    file_env: dict[str, str] = {}
    file_env.update(load_env_file(REPO_ROOT / ".env"))
    file_env.update(load_env_file(REPO_ROOT / "api-gateway" / ".env"))

    db_user = file_env.get("DB_USER", "postgres")
    db_pass = file_env.get("DB_PASSWORD", "postgres")
    db_name = file_env.get("DB_NAME", "jupiter")
    db_host = file_env.get("DB_HOST", "localhost")
    db_port = file_env.get("DB_PORT", "5432")
    rmq_user = file_env.get("RABBITMQ_USER", "guest")
    rmq_pass = file_env.get("RABBITMQ_PASS", "guest")
    minio_key = file_env.get("MINIO_ACCESS_KEY", "minioadmin")
    minio_secret = file_env.get("MINIO_SECRET_KEY", "minioadmin")

    defaults = {
        "DB_HOST": db_host,
        "DB_PORT": db_port,
        "DB_USER": db_user,
        "DB_PASSWORD": db_pass,
        "DB_NAME": db_name,
        "DATABASE_URL": f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}",
        "RABBITMQ_URL": f"amqp://{rmq_user}:{rmq_pass}@localhost:5672/",
        "RABBITMQ_HOST": "localhost",
        "RABBITMQ_PORT": "5672",
        "RABBITMQ_USER": rmq_user,
        "RABBITMQ_PASS": rmq_pass,
        "MINIO_ENDPOINT": "localhost:9000",
        "MINIO_PUBLIC_ENDPOINT": "localhost:9000",
        "MINIO_ACCESS_KEY": minio_key,
        "MINIO_SECRET_KEY": minio_secret,
        "MINIO_BUCKET": file_env.get("MINIO_BUCKET", "jupiter-videos"),
        "MINIO_USE_SSL": "false",
        "S3_ENDPOINT_URL": "http://localhost:9000",
        "AWS_ACCESS_KEY_ID": minio_key,
        "AWS_SECRET_ACCESS_KEY": minio_secret,
        "AWS_REGION": "us-east-1",
        "JWT_SECRET": file_env.get("JWT_SECRET", "change_me_in_production"),
        "POSE_JOBS_QUEUE": "pose.jobs",
        "WHISPER_JOBS_QUEUE": "whisper.jobs",
        "PROSODY_QUEUE": "prosody.jobs",
        "SCORING_QUEUE": "scoring.jobs",
        "FEATURES_RESULTS_QUEUE": "features.results",
        "CORS_ALLOW_ORIGIN": file_env.get("CORS_ALLOW_ORIGIN", "http://localhost:5173"),
    }

    env = dict(os.environ)
    for key, value in defaults.items():
        env.setdefault(key, value)
    # Las API keys y demás del .env se propagan tal cual.
    for key, value in file_env.items():
        env.setdefault(key, value)
    env["PYTHONUNBUFFERED"] = "1"
    return env


# ---------------------------------------------------------------------------
# venv / comandos
# ---------------------------------------------------------------------------

def venv_python(project_rel: str) -> str:
    """Python del venv del proyecto si existe; si no, el intérprete actual."""
    project_dir = REPO_ROOT / project_rel
    if os.name == "nt":
        candidate = project_dir / ".venv" / "Scripts" / "python.exe"
    else:
        candidate = project_dir / ".venv" / "bin" / "python"
    return str(candidate) if candidate.exists() else sys.executable


# ---------------------------------------------------------------------------
# Conectividad de infra
# ---------------------------------------------------------------------------

def tcp_open(host: str, port: int, timeout: float = 1.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def infra_ports(env: dict[str, str]) -> dict[str, int]:
    """Puertos reales de la infra según .env (con defaults de docker-compose)."""
    return {
        "postgres": int(env.get("DB_PORT", "5432")),
        "rabbitmq": int(env.get("RABBITMQ_PORT", "5672")),
        "minio": int(str(env.get("MINIO_ENDPOINT", "localhost:9000")).rsplit(":", 1)[-1] or "9000"),
    }


def infra_status(ports: dict[str, int]) -> dict[str, bool]:
    return {name: tcp_open("localhost", port) for name, port in ports.items()}


def ensure_infra(mode: str, env: dict[str, str]) -> bool:
    """Devuelve True si la infra mínima (al menos postgres) está disponible."""
    ports = infra_ports(env)
    status = infra_status(ports)
    info("Infra: " + ", ".join(
        f"{n}={'up' if status[n] else 'down'} (:{ports[n]})" for n in ports
    ))

    pg_port = ports["postgres"]

    if mode == "none":
        return status["postgres"]

    if mode == "external":
        if not status["postgres"]:
            warn(f"postgres no responde en localhost:{pg_port} — arráncalo (instalación local / nube) antes de seguir.")
        return status["postgres"]

    # mode == "docker": levantar solo los servicios de infra
    missing = [n for n, up in status.items() if not up]
    if not missing:
        return True

    compose = REPO_ROOT / "docker-compose.yml"
    if not (compose.exists() and _has_docker()):
        warn("docker no disponible; no se pudo levantar infra. Usa --infra external con servicios propios.")
        return status["postgres"]

    info(f"Levantando infra vía Docker: {', '.join(missing)}")
    try:
        subprocess.run(
            ["docker", "compose", "-f", str(compose), "up", "-d", "postgres", "rabbitmq", "minio"],
            cwd=str(REPO_ROOT), env=env, check=True,
        )
    except subprocess.CalledProcessError as exc:
        err(f"docker compose up de infra falló: {exc}")
        warn("Si Docker no funciona, corre postgres/rabbitmq/minio por tu cuenta y usa --infra external.")
        return tcp_open("localhost", pg_port)

    # Esperar a que postgres acepte conexiones
    info("Esperando a que la infra esté lista…")
    for _ in range(40):
        if tcp_open("localhost", pg_port):
            break
        time.sleep(2)
    final = infra_status(ports)
    info("Infra: " + ", ".join(f"{n}={'up' if final[n] else 'down'}" for n in ports))
    return final["postgres"]


def _has_docker() -> bool:
    try:
        subprocess.run(["docker", "info"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


# ---------------------------------------------------------------------------
# Migraciones / seed (one-shot, bloqueantes)
# ---------------------------------------------------------------------------

def run_migrations(env: dict[str, str]) -> bool:
    info("Aplicando migraciones (alembic upgrade head)…")
    py = venv_python("infra/migrations")
    try:
        subprocess.run(
            [py, "-m", "alembic", "upgrade", "head"],
            cwd=str(REPO_ROOT / "infra" / "migrations"), env=env, check=True,
        )
        info("Migraciones aplicadas.")
        return True
    except subprocess.CalledProcessError as exc:
        err(f"Las migraciones fallaron: {exc}")
        return False


def run_seed(env: dict[str, str]) -> None:
    seed = REPO_ROOT / "api-gateway" / "seed.py"
    if not seed.exists():
        warn("seed.py no encontrado — se omite el seed.")
        return
    info("Sembrando datos demo (tenant + usuarios + preguntas)…")
    py = venv_python("api-gateway")
    try:
        subprocess.run([py, "seed.py"], cwd=str(REPO_ROOT / "api-gateway"), env=env, check=True)
        info("Seed completado.")
    except subprocess.CalledProcessError as exc:
        warn(f"El seed falló (no bloquea): {exc}")


# ---------------------------------------------------------------------------
# Servicios de larga duración
# ---------------------------------------------------------------------------

@dataclass
class Service:
    name: str
    cmd: list[str]
    cwd: Path
    color: str
    proc: subprocess.Popen | None = field(default=None)


def build_services(args, env: dict[str, str]) -> list[Service]:
    gw_py = venv_python("api-gateway")
    workers_py = venv_python("ai-workers")
    pose_py = venv_python("ai-workers/pose")
    whisper_py = venv_python("ai-workers/whisper")

    services: list[Service] = []
    ci = 0

    def add(name: str, cmd: list[str], cwd: Path) -> None:
        nonlocal ci
        services.append(Service(name, cmd, cwd, _PREFIX_COLORS[ci % len(_PREFIX_COLORS)]))
        ci += 1

    add(
        "gateway",
        [gw_py, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", str(args.gateway_port)],
        REPO_ROOT / "api-gateway",
    )

    if not args.no_workers:
        add("prosody", [workers_py, "-m", "uvicorn", "prosody.main:app", "--host", "0.0.0.0", "--port", "8001"], REPO_ROOT / "ai-workers")
        add("scoring", [workers_py, "-m", "uvicorn", "scoring.main:app", "--host", "0.0.0.0", "--port", "8002"], REPO_ROOT / "ai-workers")
        add("pose", [pose_py, "-m", "pose_worker.main"], REPO_ROOT / "ai-workers" / "pose")
        add("whisper", [whisper_py, "-m", "whisper_worker.main"], REPO_ROOT / "ai-workers" / "whisper")

    if not args.no_frontend:
        add(
            "frontend",
            [sys.executable, "-m", "http.server", str(args.frontend_port), "--directory", "frontend"],
            REPO_ROOT,
        )

    return services


def _pump_output(svc: Service) -> None:
    """Lee stdout del proceso y lo imprime con prefijo de color por servicio."""
    assert svc.proc and svc.proc.stdout
    prefix = _c(svc.color, f"{svc.name:>8} │ ")
    for line in svc.proc.stdout:
        sys.stdout.write(prefix + line)
    sys.stdout.flush()


def start_services(services: list[Service], env: dict[str, str]) -> None:
    for svc in services:
        info(f"Iniciando {svc.name}: {' '.join(str(c) for c in svc.cmd)}")
        svc.proc = subprocess.Popen(
            svc.cmd,
            cwd=str(svc.cwd),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        threading.Thread(target=_pump_output, args=(svc,), daemon=True).start()


def stop_services(services: list[Service]) -> None:
    info("Apagando servicios…")
    for svc in reversed(services):
        if svc.proc and svc.proc.poll() is None:
            try:
                svc.proc.terminate()
            except Exception:
                pass
    deadline = time.time() + 10
    for svc in reversed(services):
        if not svc.proc:
            continue
        remaining = max(0.1, deadline - time.time())
        try:
            svc.proc.wait(timeout=remaining)
        except subprocess.TimeoutExpired:
            try:
                svc.proc.kill()
            except Exception:
                pass
    info("Todo detenido.")


def wait_gateway(port: int, timeout: int = 60) -> bool:
    info("Esperando a que el gateway responda /health…")
    deadline = time.time() + timeout
    while time.time() < deadline:
        if tcp_open("localhost", port):
            # puerto abierto; intentamos el health real
            try:
                import urllib.request
                with urllib.request.urlopen(f"http://localhost:{port}/health", timeout=2) as r:
                    if r.status == 200:
                        return True
            except Exception:
                pass
        time.sleep(2)
    return False


def print_summary(args) -> None:
    line = "═" * 60
    print()
    print(_c("32;1", "╔" + line + "╗"))
    print(_c("32;1", "║  Apex Vision — corriendo en localhost".ljust(61) + " ║"))
    print(_c("32;1", "╚" + line + "╝"))
    print()
    print("  URLs:")
    print(f"    Frontend (vendedor) → http://localhost:{args.frontend_port}/Apex%20Vision%20Vendedor.html")
    print(f"    Frontend (admin)    → http://localhost:{args.frontend_port}/Apex%20Vision%20Console.html")
    print(f"    API Gateway         → http://localhost:{args.gateway_port}")
    print(f"    API Docs (OpenAPI)  → http://localhost:{args.gateway_port}/docs")
    if not args.no_workers:
        print("    Prosody worker      → http://localhost:8001/health")
        print("    Scoring worker      → http://localhost:8002/health")
    print("    RabbitMQ UI         → http://localhost:15672  (guest / guest)")
    print("    MinIO Console       → http://localhost:9001   (minioadmin / minioadmin)")
    print()
    print("  Credenciales demo:")
    print("    Vendedor: seller.demo@jupiter.local / Demo1234!")
    print("    Admin:    admin.demo@jupiter.local  / Demo1234!")
    print()
    print(_c("33", "  Ctrl+C para detener todo."))
    print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Levanta todos los servicios de Apex Vision.")
    parser.add_argument("--infra", choices=["docker", "external", "none"], default="docker",
                        help="Cómo proveer postgres/rabbitmq/minio (default: docker).")
    parser.add_argument("--no-workers", action="store_true", help="No levantar los AI workers.")
    parser.add_argument("--no-frontend", action="store_true", help="No servir el frontend.")
    parser.add_argument("--no-seed", action="store_true", help="No sembrar datos demo.")
    parser.add_argument("--skip-migrate", action="store_true", help="No correr migraciones.")
    parser.add_argument("--gateway-port", type=int, default=8080)
    parser.add_argument("--frontend-port", type=int, default=5173)
    args = parser.parse_args()

    print(_c("37;1", "Apex Vision — run local"))
    print(f"Repo: {REPO_ROOT}")
    env = build_env()

    # 1. Infra
    if not ensure_infra(args.infra, env):
        err("postgres no está disponible. Levanta la infra y reintenta "
            "(--infra docker, o --infra external con tu propia base).")
        return 1

    # 2. Migraciones
    if not args.skip_migrate:
        if not run_migrations(env):
            warn("Continuo de todos modos; el gateway puede fallar si el esquema no existe.")

    # 3. Servicios de larga duración
    services = build_services(args, env)
    stopping = threading.Event()

    def handle_signal(_signum, _frame):
        if not stopping.is_set():
            stopping.set()

    signal.signal(signal.SIGINT, handle_signal)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handle_signal)

    start_services(services, env)

    # 4. Seed cuando el gateway esté arriba
    if wait_gateway(args.gateway_port):
        info("Gateway OK.")
        if not args.no_seed:
            run_seed(env)
    else:
        warn("El gateway no respondió a tiempo — revisa sus logs arriba.")

    print_summary(args)

    # 5. Loop hasta Ctrl+C o muerte de un proceso
    try:
        while not stopping.is_set():
            for svc in services:
                if svc.proc and svc.proc.poll() is not None:
                    warn(f"El servicio '{svc.name}' terminó (código {svc.proc.returncode}).")
                    stopping.set()
                    break
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        stop_services(services)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
