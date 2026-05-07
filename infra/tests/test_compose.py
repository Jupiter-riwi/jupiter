"""
Structural tests for docker-compose.yml.
No Docker daemon required — validates YAML structure and service definitions.
"""

import os
import yaml
import pytest

COMPOSE_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "docker-compose.yml")

REQUIRED_SERVICES = [
    "postgres", "rabbitmq", "minio",
    "migrate", "gateway",
    "worker-pose", "worker-whisper", "worker-prosody", "worker-scoring",
    "frontend",
]

INFRA_SERVICES    = ["postgres", "rabbitmq", "minio"]
WORKER_SERVICES   = ["worker-pose", "worker-whisper", "worker-prosody", "worker-scoring"]


@pytest.fixture(scope="module")
def compose():
    with open(COMPOSE_PATH) as f:
        return yaml.safe_load(f)


# --- Service presence ---

def test_all_required_services_present(compose):
    services = compose["services"]
    for svc in REQUIRED_SERVICES:
        assert svc in services, f"Missing service: {svc}"


def test_exactly_four_workers(compose):
    workers = [s for s in compose["services"] if s.startswith("worker-")]
    assert len(workers) == 4, f"Expected 4 workers, got {len(workers)}: {workers}"


# --- Healthchecks ---

def test_infra_services_have_healthchecks(compose):
    for svc in INFRA_SERVICES:
        assert "healthcheck" in compose["services"][svc], \
            f"{svc} is missing a healthcheck"


def test_gateway_has_healthcheck(compose):
    assert "healthcheck" in compose["services"]["gateway"]


def test_workers_have_healthchecks(compose):
    for svc in WORKER_SERVICES:
        assert "healthcheck" in compose["services"][svc], \
            f"{svc} is missing a healthcheck"


def test_frontend_has_healthcheck(compose):
    assert "healthcheck" in compose["services"]["frontend"]


# --- Dependencies ---

def test_gateway_depends_on_infra(compose):
    deps = compose["services"]["gateway"].get("depends_on", {})
    for svc in ["postgres", "rabbitmq", "minio", "migrate"]:
        assert svc in deps, f"gateway missing dependency: {svc}"


def test_migrate_depends_on_postgres(compose):
    deps = compose["services"]["migrate"].get("depends_on", {})
    assert "postgres" in deps


def test_workers_depend_on_rabbitmq(compose):
    for svc in WORKER_SERVICES:
        deps = compose["services"][svc].get("depends_on", {})
        assert "rabbitmq" in deps, f"{svc} missing rabbitmq dependency"


def test_frontend_depends_on_gateway(compose):
    deps = compose["services"]["frontend"].get("depends_on", {})
    assert "gateway" in deps


# --- Environment variables ---

def test_gateway_has_required_env_vars(compose):
    env = compose["services"]["gateway"].get("environment", {})
    env_str = str(env)
    for var in ["DB_HOST", "DB_USER", "DB_PASSWORD", "JWT_SECRET",
                "RABBITMQ_URL", "MINIO_ENDPOINT"]:
        assert var in env_str, f"gateway missing env var: {var}"


def test_workers_have_queue_name_env(compose):
    for svc in WORKER_SERVICES:
        env = compose["services"][svc].get("environment", {})
        assert "QUEUE_NAME" in env or "QUEUE_NAME" in str(env), \
            f"{svc} missing QUEUE_NAME env var"


def test_each_worker_has_different_queue(compose):
    queues = set()
    for svc in WORKER_SERVICES:
        env = compose["services"][svc].get("environment", {})
        queue = env.get("QUEUE_NAME", "")
        assert queue not in queues, f"Duplicate QUEUE_NAME '{queue}' in {svc}"
        queues.add(queue)
    assert len(queues) == 4


# --- Ports ---

def test_postgres_exposes_port(compose):
    ports = str(compose["services"]["postgres"].get("ports", []))
    assert "5432" in ports


def test_rabbitmq_exposes_amqp_and_ui(compose):
    ports = str(compose["services"]["rabbitmq"].get("ports", []))
    assert "5672" in ports, "RabbitMQ AMQP port missing"
    assert "15672" in ports, "RabbitMQ management UI port missing"


def test_minio_exposes_api_and_console(compose):
    ports = str(compose["services"]["minio"].get("ports", []))
    assert "9000" in ports, "MinIO API port missing"
    assert "9001" in ports, "MinIO console port missing"


def test_gateway_exposes_8080(compose):
    ports = str(compose["services"]["gateway"].get("ports", []))
    assert "8080" in ports


def test_frontend_exposes_5173(compose):
    ports = str(compose["services"]["frontend"].get("ports", []))
    assert "5173" in ports


# --- Volumes ---

def test_persistent_volumes_defined(compose):
    volumes = compose.get("volumes", {})
    for vol in ["postgres_data", "rabbitmq_data", "minio_data"]:
        assert vol in volumes, f"Missing volume: {vol}"


def test_postgres_uses_persistent_volume(compose):
    vols = str(compose["services"]["postgres"].get("volumes", []))
    assert "postgres_data" in vols


# --- Migrate service ---

def test_migrate_runs_alembic_upgrade(compose):
    cmd = str(compose["services"]["migrate"].get("command", ""))
    assert "alembic upgrade head" in cmd


def test_migrate_does_not_restart(compose):
    restart = compose["services"]["migrate"].get("restart", "")
    assert restart == "no", "migrate service should not restart automatically"
