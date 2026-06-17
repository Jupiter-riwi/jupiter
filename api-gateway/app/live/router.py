"""WebSocket endpoint that drives a live conversational session.

Browsers can't set Authorization headers on a WebSocket, so the JWT is passed as
a `token` query param. Persona is selected via `role`/`level`/`scenario` query
params in Phase 1 (Phase 2 will resolve a `persona_id` from the DB).
"""

from __future__ import annotations

import logging
import os

import jwt
from fastapi import APIRouter, Header, HTTPException, WebSocket, WebSocketDisconnect

from . import store
from .orchestrator import LiveSession
from .persona import get_persona, list_personas

logger = logging.getLogger("jupiter.gateway.live.router")

router = APIRouter()


@router.get("/api/live/personas")
def live_personas() -> dict:
    """Catalog of available products/personas for the live-room selector."""
    return {"modes": list_personas()}


@router.get("/api/live/sessions")
def live_sessions(authorization: str | None = Header(default=None)) -> dict:
    """History of the user's scored live sessions."""
    token = (authorization or "")[7:].strip() if (authorization or "").lower().startswith("bearer ") else ""
    claims = _decode(token)
    if not claims:
        raise HTTPException(status_code=401, detail="invalid or expired token")
    return {"data": store.list_sessions(user_id=claims.get("user_id", ""), tenant_id=claims.get("tenant_id", ""))}


def _decode(token: str) -> dict | None:
    secret = os.getenv("JWT_SECRET", "change-me-insecure-dev-only")
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


@router.websocket("/api/live/ws")
async def live_ws(ws: WebSocket) -> None:
    token = ws.query_params.get("token", "")
    claims = _decode(token)
    if not claims:
        await ws.close(code=4401)  # unauthorized
        return

    mode = ws.query_params.get("mode", "presentacion")
    role = ws.query_params.get("role", "cliente")
    level = ws.query_params.get("level", "neutral")
    lang = ws.query_params.get("lang", "es")
    scenario = ws.query_params.get("scenario") or None
    persona = get_persona(mode, role, level, lang, scenario)

    await ws.accept()
    session = LiveSession(
        ws, persona,
        user_id=claims.get("user_id", ""),
        tenant_id=claims.get("tenant_id", ""),
        scenario=scenario,
    )
    logger.info(
        "live session start user=%s persona=%s",
        claims.get("user_id"), persona.key,
    )
    try:
        await session.start()
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                break
            if msg.get("bytes") is not None:
                await session.on_user_audio(msg["bytes"])
            elif msg.get("text") is not None:
                import json

                try:
                    data = json.loads(msg["text"])
                except json.JSONDecodeError:
                    continue
                kind = data.get("type")
                if kind == "barge_in":
                    await session.barge_in()
                elif kind == "finish":
                    # score + persist, then keep the socket open so the client
                    # can show the results card before it closes.
                    await session.finish()
                elif kind == "end":
                    break
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # pragma: no cover
        logger.warning("live session error: %s", exc)
    finally:
        await session.close()
        logger.info("live session end user=%s", claims.get("user_id"))
        try:
            await ws.close()
        except Exception:
            pass
