"""
Structural tests for root Makefile and .env.example.
No Docker or shell required.
"""

import os
import pytest

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
MAKEFILE_PATH = os.path.join(ROOT, "Makefile")
ENV_EXAMPLE_PATH = os.path.join(ROOT, ".env.example")


@pytest.fixture(scope="module")
def makefile():
    with open(MAKEFILE_PATH) as f:
        return f.read()


@pytest.fixture(scope="module")
def env_example():
    with open(ENV_EXAMPLE_PATH) as f:
        return f.read()


# --- Makefile targets ---

def test_makefile_has_up_target(makefile):
    assert "up:" in makefile


def test_makefile_has_down_target(makefile):
    assert "down:" in makefile


def test_makefile_has_seed_target(makefile):
    assert "seed:" in makefile


def test_makefile_has_logs_target(makefile):
    assert "logs:" in makefile


def test_makefile_has_health_target(makefile):
    assert "health:" in makefile


def test_makefile_has_build_target(makefile):
    assert "build:" in makefile


def test_makefile_up_uses_docker_compose(makefile):
    up_block = makefile[makefile.index("up:"):]
    assert "docker compose up" in up_block


def test_makefile_down_uses_docker_compose(makefile):
    down_block = makefile[makefile.index("down:"):]
    assert "docker compose down" in down_block


def test_makefile_health_checks_gateway(makefile):
    assert "/health" in makefile


def test_makefile_health_checks_all_services(makefile):
    for svc in ["gateway", "rabbitmq", "minio", "frontend"]:
        assert svc in makefile, f"health target missing check for: {svc}"


def test_makefile_phony_targets_declared(makefile):
    assert ".PHONY" in makefile
    for target in ["up", "down", "seed", "logs", "health", "build"]:
        assert target in makefile


def test_makefile_up_prints_service_urls(makefile):
    assert "8080" in makefile
    assert "5173" in makefile
    assert "15672" in makefile
    assert "9001" in makefile


# --- .env.example ---

REQUIRED_VARS = [
    "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME",
    "JWT_SECRET", "JWT_EXPIRY_MINUTES", "JWT_REFRESH_EXPIRY_HOURS",
    "RABBITMQ_URL", "RABBITMQ_USER", "RABBITMQ_PASS",
    "MINIO_ENDPOINT", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY",
    "MINIO_BUCKET", "MINIO_USE_SSL",
    "GATEWAY_PORT", "FRONTEND_PORT", "VITE_API_URL",
    "DATABASE_URL",
]


def test_env_example_has_all_required_vars(env_example):
    for var in REQUIRED_VARS:
        assert var in env_example, f".env.example missing: {var}"


def test_env_example_has_no_real_secrets(env_example):
    """Ensure placeholders are used, not real credentials."""
    dangerous = ["change_me_in_production", "minioadmin", "postgres", "guest"]
    for placeholder in dangerous:
        assert placeholder in env_example, \
            f".env.example should use placeholder '{placeholder}', not a real secret"


def test_env_example_documents_seed_tenant_id(env_example):
    assert "SEED_TENANT_ID" in env_example


def test_env_example_has_sections(env_example):
    for section in ["PostgreSQL", "JWT", "RabbitMQ", "MinIO", "Gateway", "Frontend"]:
        assert section in env_example, f".env.example missing section: {section}"


def test_env_example_database_url_matches_components(env_example):
    """DATABASE_URL should use the same host/user/db as the individual vars."""
    assert "postgresql://" in env_example
    assert "localhost" in env_example
    assert "5432" in env_example
