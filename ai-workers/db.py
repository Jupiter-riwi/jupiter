"""PostgreSQL connection helpers for AI workers."""

import os
import psycopg2
import psycopg2.extras


def get_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5432)),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        dbname=os.getenv("DB_NAME", "jupiter"),
    )


def save_feature(conn, evaluation_id: str, kind: str, data: dict) -> None:
    """Insert one feature row for an evaluation."""
    import json, uuid

    with conn.cursor() as cur:
        cur.execute("SELECT tenant_id FROM evaluations WHERE id = %s", (evaluation_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError(f"evaluation not found: {evaluation_id}")
        tenant_id = str(row[0])

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO features (id, evaluation_id, tenant_id, kind, payload, created_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
            """,
            (str(uuid.uuid4()), evaluation_id, tenant_id, kind, json.dumps(data)),
        )
    conn.commit()


ALL_KINDS = {"pose", "transcript", "prosody"}


def check_and_trigger_scoring(conn, mq_channel, evaluation_id: str, tenant_id: str, video_key: str) -> bool:
    """
    Atomically check if all three features are persisted.
    If yes, publish to jupiter.scoring and update evaluation status to 'scoring'.
    Returns True if scoring was triggered.
    """
    import json, time, uuid
    from psycopg2 import sql

    with conn.cursor() as cur:
        # Lock the evaluation row to serialise concurrent workers.
        cur.execute(
            "SELECT status FROM evaluations WHERE id = %s FOR UPDATE",
            (evaluation_id,),
        )
        row = cur.fetchone()
        if not row or row[0] != "processing":
            return False

        # Count distinct feature kinds present.
        cur.execute(
            "SELECT COUNT(DISTINCT kind) FROM features WHERE evaluation_id = %s AND kind = ANY(%s)",
            (evaluation_id, list(ALL_KINDS)),
        )
        count = cur.fetchone()[0]

        if count < len(ALL_KINDS):
            return False

        # Transition to 'scoring' before publishing (idempotent guard).
        cur.execute(
            "UPDATE evaluations SET status = 'scoring', updated_at = NOW() WHERE id = %s",
            (evaluation_id,),
        )

    conn.commit()

    # Publish scoring job outside the transaction (broker call should not be inside TX).
    msg = json.dumps({
        "job_id": str(uuid.uuid4()),
        "evaluation_id": evaluation_id,
        "tenant_id": tenant_id,
        "video_key": video_key,
        "job_type": "scoring",
        "issued_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })
    import pika
    mq_channel.basic_publish(
        exchange="",
        routing_key="jupiter.scoring",
        body=msg.encode(),
        properties=pika.BasicProperties(
            delivery_mode=2,        # persistent
            content_type="application/json",
        ),
    )
    return True


def mark_failed(conn, evaluation_id: str, reason: str) -> None:
    """Set evaluation status to failed unless it is already completed or failed."""
    import json
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE evaluations
            SET status = 'failed',
                features = %s,
                updated_at = NOW()
            WHERE id = %s
              AND status NOT IN ('completed', 'failed')
            """,
            (json.dumps({"error": reason}), evaluation_id),
        )
    conn.commit()
