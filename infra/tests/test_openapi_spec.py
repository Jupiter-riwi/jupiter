"""
Structural tests for the embedded OpenAPI spec.
Validates that the spec is valid OpenAPI 3.0 JSON and covers all required paths.
"""

import json
import os

import pytest

SPEC_PATH = os.path.join(
    os.path.dirname(__file__),
    "..", "..", "api-gateway", "internal", "apidocs", "openapi.json"
)

REQUIRED_PATHS = [
    "/health",
    "/auth/register",
    "/auth/login",
    "/auth/refresh",
    "/me",
    "/questions",
    "/evaluations",
    "/evaluations/{id}",
    "/evaluations/{id}/complete",
    "/evaluations/{id}/stream",
]

REQUIRED_TAGS = {"Health", "Auth", "Questions", "Evaluations"}


@pytest.fixture(scope="module")
def spec():
    with open(SPEC_PATH) as f:
        return json.load(f)


# --- Top-level structure ---

def test_spec_is_openapi_3(spec):
    assert spec.get("openapi", "").startswith("3."), \
        f"Expected OpenAPI 3.x, got: {spec.get('openapi')}"


def test_spec_has_info(spec):
    assert "info" in spec
    assert "title" in spec["info"]
    assert "version" in spec["info"]


def test_spec_title_is_jupiter(spec):
    assert spec["info"]["title"] == "Jupiter API"


def test_spec_has_servers(spec):
    assert "servers" in spec
    assert len(spec["servers"]) >= 1


def test_spec_localhost_server(spec):
    urls = [s["url"] for s in spec["servers"]]
    assert any("localhost" in u for u in urls), "No localhost server defined"


def test_spec_has_components(spec):
    assert "components" in spec


def test_spec_has_security_schemes(spec):
    schemes = spec.get("components", {}).get("securitySchemes", {})
    assert "BearerAuth" in schemes, "Missing BearerAuth security scheme"


def test_bearer_auth_is_http_bearer(spec):
    scheme = spec["components"]["securitySchemes"]["BearerAuth"]
    assert scheme["type"] == "http"
    assert scheme["scheme"] == "bearer"


# --- Paths coverage ---

def test_spec_has_paths(spec):
    assert "paths" in spec
    assert len(spec["paths"]) > 0


@pytest.mark.parametrize("path", REQUIRED_PATHS)
def test_required_path_exists(spec, path):
    assert path in spec["paths"], f"Missing path: {path}"


def test_health_has_get(spec):
    assert "get" in spec["paths"]["/health"]


def test_auth_register_has_post(spec):
    assert "post" in spec["paths"]["/auth/register"]


def test_auth_login_has_post(spec):
    assert "post" in spec["paths"]["/auth/login"]


def test_auth_refresh_has_post(spec):
    assert "post" in spec["paths"]["/auth/refresh"]


def test_me_has_get_with_security(spec):
    op = spec["paths"]["/me"]["get"]
    assert "security" in op, "/me should require authentication"


def test_evaluations_has_get_and_post(spec):
    path = spec["paths"]["/evaluations"]
    assert "get" in path, "Missing GET /evaluations"
    assert "post" in path, "Missing POST /evaluations"


def test_evaluation_by_id_has_get(spec):
    assert "get" in spec["paths"]["/evaluations/{id}"]


def test_complete_has_post(spec):
    assert "post" in spec["paths"]["/evaluations/{id}/complete"]


def test_stream_has_get(spec):
    assert "get" in spec["paths"]["/evaluations/{id}/stream"]


def test_stream_returns_101(spec):
    responses = spec["paths"]["/evaluations/{id}/stream"]["get"]["responses"]
    assert "101" in responses, "WebSocket stream should document 101 Upgrade"


# --- Schemas ---

def test_schemas_include_evaluation(spec):
    schemas = spec.get("components", {}).get("schemas", {})
    assert "Evaluation" in schemas


def test_evaluation_schema_has_status(spec):
    schema = spec["components"]["schemas"]["Evaluation"]
    assert "status" in schema.get("properties", {}), \
        "Evaluation schema should have a 'status' property"


def test_evaluation_status_enum(spec):
    status_prop = spec["components"]["schemas"]["Evaluation"]["properties"]["status"]
    enum = status_prop.get("enum", [])
    for expected in ["pending", "processing", "completed", "failed"]:
        assert expected in enum, f"Status enum missing: {expected}"


def test_token_pair_schema_exists(spec):
    schemas = spec.get("components", {}).get("schemas", {})
    assert "TokenPair" in schemas


def test_token_pair_has_access_and_refresh(spec):
    props = spec["components"]["schemas"]["TokenPair"].get("properties", {})
    assert "access_token" in props
    assert "refresh_token" in props


# --- Tags ---

def test_spec_has_tags(spec):
    tags = {t["name"] for t in spec.get("tags", [])}
    for expected in REQUIRED_TAGS:
        assert expected in tags, f"Missing tag: {expected}"


# --- Protected routes use security ---

@pytest.mark.parametrize("path,method", [
    ("/me", "get"),
    ("/evaluations", "get"),
    ("/evaluations", "post"),
    ("/evaluations/{id}", "get"),
    ("/evaluations/{id}/complete", "post"),
    ("/questions", "get"),
])
def test_protected_routes_have_security(spec, path, method):
    op = spec["paths"][path][method]
    assert "security" in op, f"{method.upper()} {path} should declare security"
