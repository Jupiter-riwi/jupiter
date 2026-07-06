import base64
import io
import json
import os
import re
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any

import logging
import bcrypt
logger = logging.getLogger("jupiter.gateway")
import httpx
import jwt
import pika
import psycopg2
from dotenv import load_dotenv
from fastapi import Body, FastAPI, Header, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from minio import Minio
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

load_dotenv()


# ---------------------------------------------------------------------------
# MinIO helpers
# ---------------------------------------------------------------------------

def _minio_client() -> Minio:
    endpoint = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    access_key = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    secret_key = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    secure = os.getenv("MINIO_USE_SSL", "false").lower() == "true"
    return Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)


def _minio_client_public() -> Minio:
    endpoint = os.getenv("MINIO_PUBLIC_ENDPOINT", os.getenv("MINIO_ENDPOINT", "localhost:9000"))
    access_key = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    secret_key = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    secure = os.getenv("MINIO_PUBLIC_USE_SSL", os.getenv("MINIO_USE_SSL", "false")).lower() == "true"
    return Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)


def _minio_bucket() -> str:
    return os.getenv("MINIO_BUCKET", "jupiter-videos")


def _minio_public_endpoint() -> str:
    return os.getenv("MINIO_PUBLIC_ENDPOINT", os.getenv("MINIO_ENDPOINT", "localhost:9000"))


def _ensure_bucket() -> None:
    client = _minio_client()
    bucket = _minio_bucket()
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)


def _presigned_upload_url(object_key: str, expires: timedelta = timedelta(minutes=15)) -> str:
    client = _minio_client()
    url = client.presigned_put_object(_minio_bucket(), object_key, expires=expires)
    public = _minio_public_endpoint()
    if public:
        from urllib.parse import urlparse, urlunparse
        parsed = list(urlparse(url))
        parsed[1] = public
        url = urlunparse(parsed)
    return url


# ---------------------------------------------------------------------------
# RabbitMQ helpers
# ---------------------------------------------------------------------------

def _rabbitmq_url() -> str:
    return os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")


def _publish_job(routing_key: str, body: dict[str, Any]) -> None:
    try:
        params = pika.URLParameters(_rabbitmq_url())
        connection = pika.BlockingConnection(params)
        channel = connection.channel()
        channel.basic_publish(
            exchange="",
            routing_key=routing_key,
            body=json.dumps(body),
            properties=pika.BasicProperties(
                delivery_mode=2,  # persistent
            ),
        )
        connection.close()
    except Exception as exc:
        print(f"[rabbitmq] publish failed (non-fatal): {exc}")


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

app = FastAPI(title="Jupiter API Gateway", version="0.2.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Keep a direct reference to the FastAPI ASGI app *before* middlewares wrap it.
# The _WSBypass middleware uses this to route WebSocket connections directly to
# the router, skipping CORSMiddleware (which rejects WS from unknown origins).
_fastapi_app = app


class _WSBypass:
    """ASGI middleware: routes WebSocket scopes directly to FastAPI, bypassing CORS."""

    def __init__(self, app):
        self.app = app  # the full middleware chain (CORS → … → FastAPI)

    async def __call__(self, scope, receive, send):
        if scope["type"] == "websocket":
            logger.info("WS bypass CORS → path=%s", scope.get("path"))
        # Forward downstream (router side). Re-invoking the full app here would
        # re-enter this very middleware and recurse forever (RecursionError /
        # HTTP 500 on the WS handshake). Starlette's CORSMiddleware already
        # passes websocket scopes through untouched, so no special routing is
        # needed — just hand off to the next app in the chain.
        await self.app(scope, receive, send)


app.add_middleware(_WSBypass)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip()
                   for origin in os.getenv("CORS_ALLOW_ORIGIN", "http://localhost:5173").split(",")
                   if origin.strip()],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Live conversational agent (real-time STT -> LLM -> TTS over WebSocket).
from app.live.router import router as live_router  # noqa: E402

app.include_router(live_router)

# Billing (Stripe subscriptions + AT top-ups + webhook).
from app.billing.routes import router as billing_router  # noqa: E402
from app.billing.webhooks import router as billing_webhook_router  # noqa: E402
from app.billing.wallet import InsufficientBalance  # noqa: E402

app.include_router(billing_router)
app.include_router(billing_webhook_router)

# Session contexts (job/product briefs that steer the live agent).
from app.context.routes import router as context_router  # noqa: E402

app.include_router(context_router)


@app.exception_handler(InsufficientBalance)
async def _insufficient_balance_handler(_request, exc: InsufficientBalance):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=402,
        content={
            "detail": "insufficient_at_balance",
            "needed": exc.needed,
            "available": exc.available,
        },
    )

COACH_SYSTEM_PROMPT = """You are Apex Voice Coach, an executive bilingual (Spanish/English) sales coach.
Default language is Spanish unless the user asks otherwise.

Your tasks:
1) FIRST: read the "transcript" field in the evaluation context — this is exactly what the user said. 
2) Analyze what they said: structure, clarity, persuasiveness, and delivery.
3) Write a CORRECTED version of their pitch that fixes the problems you identified. 
   The corrected_pitch MUST be a rewritten, improved version of their original words — NOT a generic template.
   Keep their core message but make it sharper, more confident and persuasive.
4) Provide 3-6 concrete coaching points based on their actual transcript.

CRITICAL RULES:
- NEVER say the presenter didn't speak if there IS a transcript. Always work with what they said.
- The corrected_pitch must sound like an improved version of THEIR pitch, not a completely different one.
- If the transcript is very short or empty, acknowledge it and give general advice for a first pitch.

Output format (always):
analysis:
<short diagnosis referencing what they actually said>

original_transcript:
<repeat the transcript you analyzed>

corrected_pitch:
<rewritten, improved pitch based on their words — ready to say out loud>

coaching_points:
- <3-6 concrete, specific actions addressing weaknesses in their actual transcript>
"""


class CoachChatRequest(BaseModel):
    message: str = Field(min_length=2, max_length=3000)


class CoachChatResponse(BaseModel):
    reply: str
    audio_base64_mp3: str | None = None
    transcript: str | None = None


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=1, max_length=200)


class RegisterRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=6, max_length=200)
    code: str = Field(min_length=8, max_length=50)

    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        import re
        if not re.search(r'[a-z]', v):
            raise ValueError('password must contain at least one lowercase letter')
        if not re.search(r'[A-Z]', v):
            raise ValueError('password must contain at least one uppercase letter')
        if not re.search(r'[^a-zA-Z0-9]', v):
            raise ValueError('password must contain at least one special character')
        return v


LoginRequest.model_rebuild()
RegisterRequest.model_rebuild()


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str


def _jwt_secret() -> str:
    return os.getenv("JWT_SECRET", "change-me-insecure-dev-only")


def _build_token(user_id: str, tenant_id: str, role: str, token_type: str, expires_in: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "role": role,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_in).timestamp()),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm="HS256")


def _decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, _jwt_secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="invalid or expired token")


def _parse_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="authorization header required")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="authorization header required")
    return token


@contextmanager
def db_conn():
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        dbname=os.getenv("DB_NAME", "jupiter"),
    )
    try:
        yield conn
    finally:
        conn.close()


def ensure_evaluations_table(conn: Any) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS evaluations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL,
                user_id UUID NOT NULL,
                title TEXT NOT NULL,
                video_key TEXT,
                status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'uploading', 'processing', 'scoring', 'completed', 'failed')),
                score REAL,
                features JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_evaluations_user_status
                ON evaluations (user_id, status, created_at DESC);
            """
        )
    conn.commit()


def _require_claims(authorization: str | None) -> dict[str, Any]:
    token = _parse_bearer(authorization)
    payload = _decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="invalid token type")
    return payload


def _require_user(authorization: str | None) -> tuple[str, str]:
    payload = _require_claims(authorization)
    user_id = str(payload.get("user_id", ""))
    tenant_id = str(payload.get("tenant_id", ""))
    if not user_id or not tenant_id:
        raise HTTPException(status_code=401, detail="invalid token")
    return user_id, tenant_id


def _require_admin(authorization: str | None) -> tuple[str, str]:
    payload = _require_claims(authorization)
    user_id = str(payload.get("user_id", ""))
    tenant_id = str(payload.get("tenant_id", ""))
    role = str(payload.get("role", ""))
    if not user_id or not tenant_id:
        raise HTTPException(status_code=401, detail="invalid token")
    if role != "admin":
        raise HTTPException(status_code=403, detail="admin role required")
    return user_id, tenant_id


def _row_to_evaluation(row: Any) -> dict[str, Any]:
    features: Any = None
    try:
        raw = row[7] if row[7] is not None else None
        if raw is not None:
            features = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        features = None
    score = row[6]
    return {
        "id": str(row[0]),
        "tenant_id": str(row[1]),
        "user_id": str(row[2]),
        "title": row[3],
        "video_key": row[4],
        "status": row[5],
        "score": float(score) if score is not None else None,
        "features": features,
        "created_at": row[8].isoformat() if hasattr(row[8], "isoformat") else str(row[8]),
        "updated_at": row[9].isoformat() if hasattr(row[9], "isoformat") else str(row[9]),
    }


def _row_to_admin_evaluation(row: Any) -> dict[str, Any]:
    item = _row_to_evaluation(row[:10])
    item["seller_email"] = row[10]
    item["seller_role"] = row[11]
    return item


def ensure_coach_history_table(conn: Any) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS coach_messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                evaluation_id UUID NOT NULL,
                user_id TEXT,
                role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_coach_messages_eval_user_created
                ON coach_messages (evaluation_id, user_id, created_at DESC);
            """
        )
    conn.commit()


def ensure_registration_codes_table(conn: Any) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS registration_codes (
                code TEXT PRIMARY KEY,
                tenant_id UUID NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                used_at TIMESTAMPTZ NULL,
                used_by_user_id UUID NULL
            )
            """
        )
    conn.commit()


def fetch_evaluation_context(conn: Any, evaluation_id: str) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id::text, tenant_id::text, title, status::text, video_key,
                   score, COALESCE(features::text, '{}')
            FROM evaluations
            WHERE id = %s::uuid
            LIMIT 1
            """,
            (evaluation_id,),
        )
        row = cur.fetchone()
    if not row:
        return None

    features: Any = {}
    try:
        features = json.loads(row[6] or "{}")
    except Exception:
        features = {}

    # Fetch transcript text from features table
    transcript_text = ""
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT payload->>'text' FROM features WHERE evaluation_id = %s::uuid AND kind = 'transcript' LIMIT 1",
                (evaluation_id,),
            )
            trow = cur.fetchone()
            if trow and trow[0]:
                transcript_text = str(trow[0])
    except Exception:
        pass

    return {
        "evaluation_id": row[0],
        "tenant_id": row[1],
        "title": row[2],
        "status": row[3],
        "video_key": row[4],
        "score": float(row[5]) * 100.0 if row[5] is not None and float(row[5]) <= 1 else row[5],
        "features": features,
        "transcript": transcript_text,
    }


def load_history(conn: Any, evaluation_id: str, user_id: str | None, limit: int = 12) -> list[dict[str, str]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT role, content
            FROM coach_messages
            WHERE evaluation_id = %s::uuid AND (%s IS NULL OR user_id = %s)
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (evaluation_id, user_id, user_id, limit),
        )
        rows = cur.fetchall()
    rows.reverse()
    return [{"role": r[0], "content": r[1]} for r in rows]


def save_message(conn: Any, evaluation_id: str, user_id: str | None, role: str, content: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO coach_messages (evaluation_id, user_id, role, content)
            VALUES (%s::uuid, %s, %s, %s)
            """,
            (evaluation_id, user_id, role, content),
        )
        # 30 days retention
        cur.execute("DELETE FROM coach_messages WHERE created_at < NOW() - INTERVAL '30 days'")
    conn.commit()


async def call_deepseek(
    history: list[dict[str, str]],
    user_message: str,
    context_payload: dict[str, Any],
    transcript: str = "",
) -> str:
    key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=424, detail="Missing DEEPSEEK_API_KEY")

    messages = [{"role": "system", "content": COACH_SYSTEM_PROMPT}]
    messages.append({"role": "system", "content": "Evaluation context JSON:\n" + json.dumps(context_payload, ensure_ascii=False)})
    messages.extend(history)

    # Inject transcript directly into the user message so the coach can't miss it
    enriched_message = user_message
    if transcript:
        enriched_message = (
            f'ORIGINAL TRANSCRIPT (exact words the user said):\n"""\n{transcript}\n"""\n\n'
            f'USER MESSAGE: {user_message}'
        )

    messages.append(
        {
            "role": "user",
            "content": enriched_message
            + "\n\nRemember: return analysis, original_transcript, corrected_pitch and coaching_points. Keep it actionable and concise.",
        }
    )

    payload = {
        "model": "deepseek-chat",
        "messages": messages,
        "temperature": 0.6,
        "max_tokens": 1200,
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.deepseek.com/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json=payload,
        )
    if resp.status_code >= 300:
        raise HTTPException(status_code=502, detail=f"DeepSeek error: {resp.status_code}")
    data = resp.json()
    try:
        reply = data["choices"][0]["message"]["content"].strip()
    except Exception:
        raise HTTPException(status_code=502, detail="DeepSeek response parse error")
    if not reply:
        raise HTTPException(status_code=502, detail="DeepSeek returned empty response")
    return reply


def extract_corrected_pitch(reply: str) -> str:
    m = re.search(r"corrected_pitch\s*:\s*(.*?)(?:\n\s*coaching_points\s*:|\Z)", reply, flags=re.IGNORECASE | re.DOTALL)
    if not m:
        return reply
    text = m.group(1).strip()
    return text or reply


async def synthesize_elevenlabs(text: str) -> str | None:
    key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not key:
        logger.warning("ELEVENLABS_API_KEY not configured — TTS disabled")
        return None

    voice_id = os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL").strip()
    model_id = os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2").strip()
    payload = {
        "text": text,
        "model_id": model_id,
        "voice_settings": {
            "stability": 0.45,
            "similarity_boost": 0.75,
            "style": 0.2,
            "use_speaker_boost": True,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                headers={
                    "xi-api-key": key,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg",
                },
                json=payload,
            )
        if resp.status_code >= 300:
            body = resp.text[:200]
            logger.warning("ElevenLabs TTS failed: status=%s body=%s", resp.status_code, body)
            return None
        audio_b64 = base64.b64encode(resp.content).decode("utf-8")
        logger.info("ElevenLabs TTS OK: %d bytes → %d base64 chars", len(resp.content), len(audio_b64))
        return audio_b64
    except Exception as exc:
        logger.warning("ElevenLabs TTS error: %s", exc)
        return None


def parse_user_id_from_auth(authorization: str | None) -> str | None:
    if not authorization:
        return None
    if not authorization.lower().startswith("bearer "):
        return None
    try:
        payload = _decode_token(authorization[7:].strip())
    except HTTPException:
        return None
    return str(payload.get("user_id", ""))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.on_event("startup")
def _startup() -> None:
    _ensure_bucket()
    with db_conn() as conn:
        ensure_evaluations_table(conn)
        ensure_coach_history_table(conn)
        ensure_registration_codes_table(conn)


@app.post("/api/auth/register", response_model=TokenPair)
def auth_register(req: RegisterRequest) -> TokenPair:
    hashed = bcrypt.hashpw(req.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    code_norm = req.code.strip().upper()
    with db_conn() as conn:
        with conn.cursor() as cur:
            # Race condition safe lookup with FOR UPDATE
            cur.execute(
                "SELECT tenant_id::text FROM registration_codes WHERE code = %s AND used_at IS NULL FOR UPDATE",
                (code_norm,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=400, detail="invalid or already used registration code")
            tenant_id = row[0]

            cur.execute("SELECT id FROM users WHERE email = %s", (req.email,))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="already registered")

            user_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO users (id, tenant_id, email, password_hash, role)
                VALUES (%s, %s::uuid, %s, %s, 'member')
                """,
                (user_id, tenant_id, req.email, hashed)
            )

            cur.execute(
                """
                UPDATE registration_codes
                SET used_at = CURRENT_TIMESTAMP, used_by_user_id = %s::uuid
                WHERE code = %s AND used_at IS NULL
                """,
                (user_id, code_norm)
            )
            conn.commit()

    access = _build_token(user_id, tenant_id, "member", "access", timedelta(minutes=15))
    refresh = _build_token(user_id, tenant_id, "member", "refresh", timedelta(days=7))
    return TokenPair(access_token=access, refresh_token=refresh)


@app.post("/api/auth/login", response_model=TokenPair)
@limiter.limit("5/minute")
def auth_login(request: Request, req: LoginRequest = Body(...)) -> TokenPair:
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id::text, tenant_id::text, email, password_hash, role::text
                FROM users
                WHERE email = %s
                LIMIT 1
                """,
                (req.email,),
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="invalid credentials")

    user_id, tenant_id, _email, password_hash, role = row
    if not bcrypt.checkpw(req.password.encode("utf-8"), password_hash.encode("utf-8")):
        raise HTTPException(status_code=401, detail="invalid credentials")

    access = _build_token(user_id, tenant_id, role, "access", timedelta(minutes=15))
    refresh = _build_token(user_id, tenant_id, role, "refresh", timedelta(days=7))
    return TokenPair(access_token=access, refresh_token=refresh)


@app.post("/api/auth/refresh", response_model=TokenPair)
def auth_refresh(req: RefreshRequest) -> TokenPair:
    payload = _decode_token(req.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="invalid token type")
    user_id = str(payload.get("user_id", ""))
    tenant_id = str(payload.get("tenant_id", ""))
    role = str(payload.get("role", "member"))
    if not user_id or not tenant_id:
        raise HTTPException(status_code=401, detail="invalid token")

    access = _build_token(user_id, tenant_id, role, "access", timedelta(minutes=15))
    refresh = _build_token(user_id, tenant_id, role, "refresh", timedelta(days=7))
    return TokenPair(access_token=access, refresh_token=refresh)


@app.get("/api/me")
def me(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    token = _parse_bearer(authorization)
    payload = _decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="invalid token type")
    user_id = str(payload.get("user_id", ""))
    tenant_id = str(payload.get("tenant_id", ""))

    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id::text, tenant_id::text, email, role::text
                FROM users
                WHERE id = %s::uuid AND tenant_id = %s::uuid
                LIMIT 1
                """,
                (user_id, tenant_id),
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="user not found")

    return {
        "id": row[0],
        "tenant_id": row[1],
        "email": row[2],
        "role": row[3],
    }


# ---------------------------------------------------------------------------
# Evaluations CRUD
# ---------------------------------------------------------------------------


class CreateEvaluationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    context_id: str | None = None
    difficulty: str | None = Field(default=None, pattern=r"^(accesible|neutral|exigente)$")


class EvaluationCreateResponse(BaseModel):
    evaluation: dict[str, Any]
    upload_url: str
    expires_in_sec: int = 900


@app.post("/api/evaluations", status_code=201)
def create_evaluation(
    req: CreateEvaluationRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    user_id, tenant_id = _require_user(authorization)
    eval_id = str(uuid.uuid4())
    video_key = f"{tenant_id}/{eval_id}/original.mp4"

    with db_conn() as conn:
        ensure_evaluations_table(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO evaluations (id, tenant_id, user_id, title, video_key, status,
                                         context_id, difficulty)
                VALUES (%s::uuid, %s::uuid, %s::uuid, %s, %s, 'pending', %s::uuid, %s)
                RETURNING id::text, tenant_id::text, user_id::text, title, video_key,
                          status::text, score, features::text, created_at, updated_at
                """,
                (eval_id, tenant_id, user_id, req.title, video_key,
                 req.context_id, req.difficulty),
            )
            row = cur.fetchone()
        conn.commit()

    evaluation = _row_to_evaluation(row)
    upload_url = _presigned_upload_url(video_key)

    return {
        "evaluation": evaluation,
        "upload_url": upload_url,
        "expires_in_sec": 900,
    }


@app.put("/api/evaluations/{evaluation_id}/upload")
async def upload_video(
    evaluation_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_user(authorization)

    with db_conn() as conn:
        ensure_evaluations_table(conn)
        context = fetch_evaluation_context(conn, evaluation_id)
        if not context:
            raise HTTPException(status_code=404, detail="evaluation not found")

    video_key = context.get("video_key") or f"{context.get('tenant_id', 'unknown')}/{evaluation_id}/original.mp4"
    body = await request.body()

    try:
        client = _minio_client()
        client.put_object(
            _minio_bucket(),
            video_key,
            data=io.BytesIO(body),
            length=len(body),
            content_type=request.headers.get("content-type", "video/webm"),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"storage write failed: {exc}")

    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE evaluations SET status = 'uploading', video_key = %s, updated_at = NOW() WHERE id = %s::uuid",
                (video_key, evaluation_id),
            )
        conn.commit()

    return {"status": "uploaded", "evaluation_id": evaluation_id}


@app.post("/api/evaluations/{evaluation_id}/complete", status_code=202)
def complete_evaluation(
    evaluation_id: str,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    user_id, tenant_id = _require_user(authorization)

    with db_conn() as conn:
        ensure_evaluations_table(conn)
        # Billing pre-check: refuse the job if the tenant has no AT. Mapped to
        # HTTP 402 by the InsufficientBalance exception handler in main.
        from app.billing.evaluation import precheck_evaluation_balance  # noqa: WPS433
        from app.billing.db import tenant_scope  # noqa: WPS433
        with tenant_scope(conn, tenant_id):
            precheck_evaluation_balance(conn, tenant_id)

        with conn.cursor() as cur:
            cur.execute(
                "SELECT status::text FROM evaluations WHERE id = %s::uuid FOR UPDATE",
                (evaluation_id,),
            )
            row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="evaluation not found")
        if row[0] not in ("pending", "uploading"):
            raise HTTPException(status_code=400, detail="evaluation already in progress or completed")

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE evaluations SET status = 'processing', updated_at = NOW() WHERE id = %s::uuid "
                "RETURNING id::text, tenant_id::text, user_id::text, title, video_key, "
                "status::text, score, features::text, created_at, updated_at",
                (evaluation_id,),
            )
            updated_row = cur.fetchone()
        conn.commit()

    _publish_job("pose.jobs", {
        "job_id": f"{evaluation_id}-pose",
        "evaluation_id": evaluation_id,
        "tenant_id": tenant_id,
        "video_url": f"s3://{_minio_bucket()}/{tenant_id}/{evaluation_id}/original.mp4",
    })
    _publish_job("whisper.jobs", {
        "job_id": f"{evaluation_id}-whisper",
        "evaluation_id": evaluation_id,
        "tenant_id": tenant_id,
        "video_url": f"s3://{_minio_bucket()}/{tenant_id}/{evaluation_id}/original.mp4",
    })
    _publish_job("prosody.jobs", {
        "job_id": f"{evaluation_id}-prosody",
        "evaluation_id": evaluation_id,
        "tenant_id": tenant_id,
        "video_url": f"s3://{_minio_bucket()}/{tenant_id}/{evaluation_id}/original.mp4",
    })
    _publish_job("scoring.jobs", {
        "job_id": f"{evaluation_id}-scoring",
        "evaluation_id": evaluation_id,
        "tenant_id": tenant_id,
    })

    return _row_to_evaluation(updated_row)


@app.get("/api/evaluations/{evaluation_id}")
def get_evaluation(
    evaluation_id: str,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_user(authorization)

    with db_conn() as conn:
        ensure_evaluations_table(conn)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id::text, tenant_id::text, user_id::text, title, video_key, "
                "status::text, score, features::text, created_at, updated_at "
                "FROM evaluations WHERE id = %s::uuid",
                (evaluation_id,),
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="evaluation not found")
    return _row_to_evaluation(row)


@app.get("/api/evaluations")
def list_evaluations(
    authorization: str | None = Header(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
) -> dict[str, Any]:
    user_id, _tenant_id = _require_user(authorization)

    with db_conn() as conn:
        ensure_evaluations_table(conn)
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM evaluations WHERE user_id = %s::uuid", (user_id,))
            total = cur.fetchone()[0]

            offset = (page - 1) * limit
            cur.execute(
                "SELECT id::text, tenant_id::text, user_id::text, title, video_key, "
                "status::text, score, features::text, created_at, updated_at "
                "FROM evaluations WHERE user_id = %s::uuid "
                "ORDER BY created_at DESC LIMIT %s OFFSET %s",
                (user_id, limit, offset),
            )
            rows = cur.fetchall()

    return {
        "data": [_row_to_evaluation(r) for r in rows],
        "page": page,
        "limit": limit,
        "total": total,
    }


@app.get("/api/admin/evaluations")
def list_tenant_evaluations(
    authorization: str | None = Header(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, Any]:
    _admin_id, tenant_id = _require_admin(authorization)

    with db_conn() as conn:
        ensure_evaluations_table(conn)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM evaluations WHERE tenant_id = %s::uuid",
                (tenant_id,),
            )
            total = cur.fetchone()[0]

            offset = (page - 1) * limit
            cur.execute(
                """
                SELECT e.id::text, e.tenant_id::text, e.user_id::text, e.title, e.video_key,
                       e.status::text, e.score, e.features::text, e.created_at, e.updated_at,
                       u.email, u.role::text
                FROM evaluations e
                LEFT JOIN users u
                  ON u.id = e.user_id AND u.tenant_id = e.tenant_id
                WHERE e.tenant_id = %s::uuid
                ORDER BY e.created_at DESC
                LIMIT %s OFFSET %s
                """,
                (tenant_id, limit, offset),
            )
            rows = cur.fetchall()

    return {
        "data": [_row_to_admin_evaluation(r) for r in rows],
        "page": page,
        "limit": limit,
        "total": total,
    }


# ---------------------------------------------------------------------------
# Coach
# ---------------------------------------------------------------------------


@app.post("/api/evaluations/{evaluation_id}/coach/chat", response_model=CoachChatResponse)
async def coach_chat(evaluation_id: str, req: CoachChatRequest, authorization: str | None = Header(default=None)) -> CoachChatResponse:
    user_id = parse_user_id_from_auth(authorization)
    with db_conn() as conn:
        ensure_coach_history_table(conn)
        context_payload = fetch_evaluation_context(conn, evaluation_id)
        if not context_payload:
            raise HTTPException(status_code=404, detail="evaluation not found")
        history = load_history(conn, evaluation_id, user_id, limit=12)
        save_message(conn, evaluation_id, user_id, "user", req.message)

        reply = await call_deepseek(history, req.message, context_payload, context_payload.get("transcript", ""))
        save_message(conn, evaluation_id, user_id, "assistant", reply)

    corrected_pitch = extract_corrected_pitch(reply)
    audio_b64 = await synthesize_elevenlabs(corrected_pitch)
    transcript = context_payload.get("transcript", "")
    return CoachChatResponse(reply=reply, audio_base64_mp3=audio_b64, transcript=transcript if transcript else None)


@app.get("/api/evaluations/{evaluation_id}/coach/history")
def coach_history(evaluation_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user_id = parse_user_id_from_auth(authorization)
    with db_conn() as conn:
        ensure_coach_history_table(conn)
        if not fetch_evaluation_context(conn, evaluation_id):
            raise HTTPException(status_code=404, detail="evaluation not found")
        messages = load_history(conn, evaluation_id, user_id, limit=30)
    return {
        "evaluation_id": evaluation_id,
        "messages": messages,
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/admin/registration-codes")
def generate_registration_code(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    admin_id, tenant_id = _require_admin(authorization)
    import secrets
    rand_part1 = "".join(secrets.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") for _ in range(4))
    rand_part2 = "".join(secrets.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") for _ in range(4))
    code = f"APEX-{rand_part1}-{rand_part2}"

    with db_conn() as conn:
        ensure_registration_codes_table(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO registration_codes (code, tenant_id)
                VALUES (%s, %s::uuid)
                """,
                (code, tenant_id)
            )
            conn.commit()

    return {"code": code, "tenant_id": tenant_id}


@app.get("/api/admin/registration-codes")
def list_registration_codes(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    admin_id, tenant_id = _require_admin(authorization)
    with db_conn() as conn:
        ensure_registration_codes_table(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT rc.code, rc.tenant_id::text, rc.created_at, rc.used_at, rc.used_by_user_id::text, u.email
                FROM registration_codes rc
                LEFT JOIN users u ON rc.used_by_user_id::text = u.id::text
                WHERE rc.tenant_id = %s::uuid
                ORDER BY rc.created_at DESC
                """,
                (tenant_id,)
            )
            rows = cur.fetchall()

    return {
        "codes": [
            {
                "code": r[0],
                "tenant_id": r[1],
                "created_at": r[2].isoformat() if r[2] else None,
                "used_at": r[3].isoformat() if r[3] else None,
                "used_by_user_id": r[4],
                "used_by_email": r[5],
            }
            for r in rows
        ]
    }
