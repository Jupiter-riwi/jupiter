"""
Structural tests for the Insomnia collection.
Validates that the collection covers the full API flow.
"""

import json
import os
import pytest

COLLECTION_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "docs", "jupiter.insomnia.json"
)


@pytest.fixture(scope="module")
def collection():
    with open(COLLECTION_PATH) as f:
        return json.load(f)


@pytest.fixture(scope="module")
def requests(collection):
    return [r for r in collection["resources"] if r["_type"] == "request"]


@pytest.fixture(scope="module")
def folders(collection):
    return [r for r in collection["resources"] if r["_type"] == "request_group"]


@pytest.fixture(scope="module")
def environment(collection):
    envs = [r for r in collection["resources"] if r["_type"] == "environment"]
    return envs[0] if envs else {}


# --- Collection structure ---

def test_collection_is_valid_json(collection):
    assert "_type" in collection
    assert collection["_type"] == "export"


def test_workspace_exists(collection):
    workspaces = [r for r in collection["resources"] if r["_type"] == "workspace"]
    assert len(workspaces) == 1
    assert workspaces[0]["name"] == "Jupiter API"


def test_environment_has_required_vars(environment):
    data = environment.get("data", {})
    for var in ["base_url", "access_token", "refresh_token", "tenant_id", "evaluation_id"]:
        assert var in data, f"Environment missing variable: {var}"


def test_environment_base_url_is_localhost(environment):
    assert "localhost:8080" in environment["data"]["base_url"]


# --- Folders ---

def test_auth_folder_exists(folders):
    names = [f["name"] for f in folders]
    assert any("Auth" in n for n in names), "Missing Auth folder"


def test_questions_folder_exists(folders):
    names = [f["name"] for f in folders]
    assert any("Question" in n for n in names), "Missing Questions folder"


def test_evaluations_folder_exists(folders):
    names = [f["name"] for f in folders]
    assert any("Evaluation" in n for n in names), "Missing Evaluations folder"


def test_health_folder_exists(folders):
    names = [f["name"] for f in folders]
    assert any("Health" in n for n in names), "Missing Health folder"


# --- Auth requests ---

def test_register_request_exists(requests):
    urls = [r["url"] for r in requests]
    assert any("/auth/register" in u for u in urls), "Missing POST /auth/register"


def test_login_request_exists(requests):
    urls = [r["url"] for r in requests]
    assert any("/auth/login" in u for u in urls), "Missing POST /auth/login"


def test_refresh_request_exists(requests):
    urls = [r["url"] for r in requests]
    assert any("/auth/refresh" in u for u in urls), "Missing POST /auth/refresh"


def test_me_request_exists(requests):
    urls = [r["url"] for r in requests]
    assert any("/me" in u for u in urls), "Missing GET /me"


def test_auth_requests_use_bearer_token(requests):
    protected = [r for r in requests if "/me" in r["url"]]
    for req in protected:
        headers = {h["name"]: h["value"] for h in req.get("headers", [])}
        assert "Authorization" in headers
        assert "Bearer" in headers["Authorization"]


# --- Questions requests ---

def test_questions_list_request_exists(requests):
    urls = [r["url"] for r in requests]
    assert any("/questions" in u for u in urls), "Missing GET /questions"


def test_questions_category_filter_request_exists(requests):
    urls = [r["url"] for r in requests]
    assert any("category=" in u for u in urls), "Missing category filter request"


# --- Evaluation flow ---

def test_create_evaluation_request_exists(requests):
    posts = [r for r in requests if r["method"] == "POST" and "/evaluations" in r["url"]
             and "complete" not in r["url"]]
    assert len(posts) >= 1, "Missing POST /evaluations"


def test_complete_evaluation_request_exists(requests):
    completes = [r for r in requests if "complete" in r["url"]]
    assert len(completes) >= 1, "Missing POST /evaluations/{id}/complete"


def test_get_evaluation_request_exists(requests):
    gets = [r for r in requests if r["method"] == "GET"
            and "evaluation_id" in r["url"] and "stream" not in r["url"] and "complete" not in r["url"]]
    assert len(gets) >= 1, "Missing GET /evaluations/{id}"


def test_list_evaluations_request_exists(requests):
    lists = [r for r in requests if r["method"] == "GET"
             and r["url"].endswith("/evaluations") or r["url"].endswith("?page=1&limit=10")]
    assert len(lists) >= 1, "Missing GET /evaluations list"


def test_websocket_stream_request_exists(requests):
    streams = [r for r in requests if "stream" in r["url"]]
    assert len(streams) >= 1, "Missing WebSocket stream request"


def test_websocket_uses_ws_protocol(requests):
    streams = [r for r in requests if "stream" in r["url"]]
    assert any(r["url"].startswith("ws://") for r in streams), \
        "WebSocket request should use ws:// protocol"


# --- Health requests ---

def test_gateway_health_request_exists(requests):
    assert any("/health" in r["url"] for r in requests), "Missing /health request"


def test_rabbitmq_ui_request_exists(requests):
    assert any("15672" in r["url"] for r in requests), "Missing RabbitMQ UI request"


def test_minio_console_request_exists(requests):
    assert any("9001" in r["url"] for r in requests), "Missing MinIO console request"


# --- Full flow coverage ---

def test_full_flow_order_documented(requests):
    """Verify that request names suggest a numbered flow for evaluations."""
    eval_requests = [r for r in requests if r.get("parentId") == "fld_evaluations"]
    numbered = [r for r in eval_requests if r["name"][0].isdigit()]
    assert len(numbered) >= 4, "Evaluation flow should have at least 4 numbered steps"
