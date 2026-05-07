"""
Unit tests for the fan-in coordinator (db.py).

All DB calls are patched with an in-memory sqlite3 connection so no live
Postgres or RabbitMQ is needed.
"""

import json
import sqlite3
import sys
import types
import uuid
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Create a fake psycopg2 module backed by sqlite3 so db.py can be imported
# without a real Postgres driver.
# ---------------------------------------------------------------------------

_sqlite_connections: list = []


class _FakeCursor:
    def __init__(self, sqlite_conn):
        self._cur = sqlite_conn.cursor()
        self._rows = []

    def execute(self, sql, params=()):
        # Translate Postgres-style %s placeholders to sqlite3 ? placeholders.
        sql = sql.replace("%s", "?")
        # Translate Postgres RETURNING / ON CONFLICT syntax just enough for tests.
        if "ON CONFLICT" in sql.upper():
            # sqlite3 supports INSERT OR REPLACE, but we just need idempotence.
            sql = sql.split("ON CONFLICT")[0].strip().rstrip(",")
        self._cur.execute(sql, params)
        self._rows = self._cur.fetchall()

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return self._rows

    def __enter__(self):
        return self

    def __exit__(self, *_):
        pass


class _FakeConn:
    def __init__(self, sqlite_conn):
        self._conn = sqlite_conn

    def cursor(self):
        return _FakeCursor(self._conn)

    def commit(self):
        self._conn.commit()

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *_):
        pass


def _make_fake_psycopg2():
    mod = types.ModuleType("psycopg2")
    mod.connect = lambda **_: None   # not used directly; tests pass _FakeConn
    mod.extras = types.ModuleType("psycopg2.extras")
    sys.modules["psycopg2"] = mod
    sys.modules["psycopg2.extras"] = mod.extras
    return mod


_make_fake_psycopg2()

# Now we can safely import db
import db  # noqa: E402  (must be after fake psycopg2)


# ---------------------------------------------------------------------------
# SQLite fixture
# ---------------------------------------------------------------------------

SCHEMA = """
CREATE TABLE IF NOT EXISTS evaluations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    user_id TEXT,
    title TEXT,
    video_key TEXT,
    status TEXT DEFAULT 'pending',
    score REAL,
    features TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS features (
    id TEXT PRIMARY KEY,
    evaluation_id TEXT,
    kind TEXT,
    data TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE (evaluation_id, kind)
);
"""


@pytest.fixture
def sqlite_conn():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.commit()
    yield _FakeConn(conn)
    conn.close()


def _insert_eval(sqlite_conn, eval_id: str, status: str = "processing"):
    sqlite_conn._conn.execute(
        "INSERT INTO evaluations (id, tenant_id, user_id, title, video_key, status) VALUES (?, ?, ?, ?, ?, ?)",
        (eval_id, str(uuid.uuid4()), str(uuid.uuid4()), "Test", "key/file.mp4", status),
    )
    sqlite_conn._conn.commit()


def _insert_feature(sqlite_conn, eval_id: str, kind: str, data: dict = None):
    sqlite_conn._conn.execute(
        "INSERT OR REPLACE INTO features (id, evaluation_id, kind, data) VALUES (?, ?, ?, ?)",
        (str(uuid.uuid4()), eval_id, kind, json.dumps(data or {})),
    )
    sqlite_conn._conn.commit()


# ---------------------------------------------------------------------------
# save_feature tests
# ---------------------------------------------------------------------------

def test_save_feature_inserts_row(sqlite_conn):
    eval_id = str(uuid.uuid4())
    _insert_eval(sqlite_conn, eval_id)

    with patch("db.get_connection", return_value=sqlite_conn):
        db.save_feature(sqlite_conn, eval_id, "pose", {"score": 0.9})

    rows = sqlite_conn._conn.execute(
        "SELECT * FROM features WHERE evaluation_id = ?", (eval_id,)
    ).fetchall()
    assert len(rows) == 1
    assert rows[0]["kind"] == "pose"


def test_save_feature_is_idempotent(sqlite_conn):
    eval_id = str(uuid.uuid4())
    _insert_eval(sqlite_conn, eval_id)

    for _ in range(3):
        db.save_feature(sqlite_conn, eval_id, "pose", {"score": 0.9})

    rows = sqlite_conn._conn.execute(
        "SELECT * FROM features WHERE evaluation_id = ?", (eval_id,)
    ).fetchall()
    assert len(rows) == 1


# ---------------------------------------------------------------------------
# check_and_trigger_scoring tests
# ---------------------------------------------------------------------------

def _mock_channel():
    ch = MagicMock()
    ch.basic_publish = MagicMock()
    return ch


def test_trigger_not_fired_with_two_features(sqlite_conn):
    eval_id = str(uuid.uuid4())
    _insert_eval(sqlite_conn, eval_id, status="processing")
    _insert_feature(sqlite_conn, eval_id, "pose")
    _insert_feature(sqlite_conn, eval_id, "transcript")

    ch = _mock_channel()
    result = db.check_and_trigger_scoring(sqlite_conn, ch, eval_id, "tenant-1", "key.mp4")

    assert result is False
    ch.basic_publish.assert_not_called()


def test_trigger_fires_when_all_three_present(sqlite_conn):
    eval_id = str(uuid.uuid4())
    _insert_eval(sqlite_conn, eval_id, status="processing")
    _insert_feature(sqlite_conn, eval_id, "pose")
    _insert_feature(sqlite_conn, eval_id, "transcript")
    _insert_feature(sqlite_conn, eval_id, "prosody")

    ch = _mock_channel()
    result = db.check_and_trigger_scoring(sqlite_conn, ch, eval_id, "tenant-1", "key.mp4")

    assert result is True
    ch.basic_publish.assert_called_once()
    call_kwargs = ch.basic_publish.call_args
    assert call_kwargs.kwargs["routing_key"] == "jupiter.scoring"
    body = json.loads(call_kwargs.kwargs["body"].decode())
    assert body["evaluation_id"] == eval_id


def test_trigger_idempotent_second_call(sqlite_conn):
    eval_id = str(uuid.uuid4())
    _insert_eval(sqlite_conn, eval_id, status="processing")
    _insert_feature(sqlite_conn, eval_id, "pose")
    _insert_feature(sqlite_conn, eval_id, "transcript")
    _insert_feature(sqlite_conn, eval_id, "prosody")

    ch = _mock_channel()
    db.check_and_trigger_scoring(sqlite_conn, ch, eval_id, "t", "k")

    # After first call status = 'scoring'; second call should be a no-op.
    ch2 = _mock_channel()
    result = db.check_and_trigger_scoring(sqlite_conn, ch2, eval_id, "t", "k")

    assert result is False
    ch2.basic_publish.assert_not_called()


def test_trigger_skips_non_processing_status(sqlite_conn):
    ch = _mock_channel()
    for status in ("completed", "failed", "pending"):
        eval_id = str(uuid.uuid4())
        _insert_eval(sqlite_conn, eval_id, status=status)
        _insert_feature(sqlite_conn, eval_id, "pose")
        _insert_feature(sqlite_conn, eval_id, "transcript")
        _insert_feature(sqlite_conn, eval_id, "prosody")

        result = db.check_and_trigger_scoring(sqlite_conn, ch, eval_id, "t", "k")
        assert result is False, f"Should not trigger for status={status}"

    ch.basic_publish.assert_not_called()


# ---------------------------------------------------------------------------
# mark_failed tests
# ---------------------------------------------------------------------------

def test_mark_failed_sets_status(sqlite_conn):
    eval_id = str(uuid.uuid4())
    _insert_eval(sqlite_conn, eval_id, status="processing")

    db.mark_failed(sqlite_conn, eval_id, "pose model OOM")

    row = sqlite_conn._conn.execute(
        "SELECT status, features FROM evaluations WHERE id = ?", (eval_id,)
    ).fetchone()
    assert row["status"] == "failed"
    assert "pose model OOM" in row["features"]


def test_mark_failed_does_not_overwrite_completed(sqlite_conn):
    eval_id = str(uuid.uuid4())
    _insert_eval(sqlite_conn, eval_id, status="completed")

    db.mark_failed(sqlite_conn, eval_id, "late error")

    row = sqlite_conn._conn.execute(
        "SELECT status FROM evaluations WHERE id = ?", (eval_id,)
    ).fetchone()
    assert row["status"] == "completed"


def test_mark_failed_does_not_overwrite_failed(sqlite_conn):
    eval_id = str(uuid.uuid4())
    _insert_eval(sqlite_conn, eval_id, status="failed")

    db.mark_failed(sqlite_conn, eval_id, "second error")

    # Should remain failed without double-write error.
    row = sqlite_conn._conn.execute(
        "SELECT status FROM evaluations WHERE id = ?", (eval_id,)
    ).fetchone()
    assert row["status"] == "failed"
