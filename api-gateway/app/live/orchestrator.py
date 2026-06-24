"""Per-connection live session orchestrator.

Owns the dialogue state and runs the STT -> LLM -> TTS loop for one WebSocket.
Agent generation runs as a cancellable task so a new user turn or an explicit
barge-in interrupts the agent mid-sentence.

Wire protocol (server -> client):
  JSON  {"type":"ready"}
  JSON  {"type":"state","value":"listening|thinking|speaking"}
  JSON  {"type":"user_transcript","text": "..."}
  JSON  {"type":"agent_text","delta":"...","done":false}
  BINARY  <mp3 bytes>                      # one sentence of agent audio
  JSON  {"type":"agent_done"}
  JSON  {"type":"error","detail":"..."}

Wire protocol (client -> server):
  BINARY  <wav bytes>                      # one complete user turn (VAD-segmented)
  JSON  {"type":"barge_in"}                # user started talking over the agent
  JSON  {"type":"end"}                     # end the session
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from fastapi import WebSocket

from . import llm, scoring, stt, store, tts
from .persona import Persona, greeting_instruction

logger = logging.getLogger("jupiter.gateway.live.orchestrator")

MAX_HISTORY_TURNS = 24  # keep the last N messages to bound prompt size


class LiveSession:
    def __init__(
        self, ws: WebSocket, persona: Persona, *,
        user_id: str = "", tenant_id: str = "", scenario: str | None = None,
    ) -> None:
        self.ws = ws
        self.persona = persona
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.scenario = scenario
        self.history: list[dict[str, str]] = []
        self._agent_task: asyncio.Task | None = None
        self._scored = False

    # ── outbound helpers ────────────────────────────────────────────────
    async def _send_json(self, payload: dict[str, Any]) -> None:
        try:
            await self.ws.send_json(payload)
        except Exception:
            pass

    async def _send_audio(self, audio: bytes) -> None:
        try:
            await self.ws.send_bytes(audio)
        except Exception:
            pass

    async def _state(self, value: str) -> None:
        await self._send_json({"type": "state", "value": value})

    # ── lifecycle ───────────────────────────────────────────────────────
    async def start(self) -> None:
        """Greet the seller in character to open the conversation."""
        await self._send_json({"type": "ready", "persona": self.persona.name})
        self._spawn_agent(opener=True)

    async def on_user_audio(self, audio_wav: bytes) -> None:
        """A complete user turn arrived. Cancel any in-flight agent reply, transcribe, respond."""
        await self.cancel_agent()
        await self._state("thinking")
        t0 = time.monotonic()
        text = await stt.transcribe_turn(audio_wav, language=self.persona.lang)
        logger.info("STT %.0fms -> %r", (time.monotonic() - t0) * 1000, text[:80])
        if not text:
            await self._state("listening")
            return
        await self._send_json({"type": "user_transcript", "text": text})
        self._append("user", text)
        self._spawn_agent(opener=False)

    async def barge_in(self) -> None:
        await self.cancel_agent()
        await self._state("listening")

    async def cancel_agent(self) -> None:
        if self._agent_task and not self._agent_task.done():
            self._agent_task.cancel()
            try:
                await self._agent_task
            except (asyncio.CancelledError, Exception):
                pass
        self._agent_task = None

    async def finish(self) -> None:
        """Score the conversation, send the result, and persist it."""
        if self._scored:
            return
        self._scored = True
        await self.cancel_agent()
        await self._send_json({"type": "scoring"})
        result = await scoring.score_session(
            mode=self.persona.mode, lang=self.persona.lang,
            persona_name=self.persona.name, history=self.history,
            level=self.persona.level,
        )
        await self._send_json({"type": "session_score", "data": result})
        if self.user_id and self.tenant_id:
            store.save_session(
                tenant_id=self.tenant_id, user_id=self.user_id,
                mode=self.persona.mode, role_type=self.persona.role_type,
                level=self.persona.level, lang=self.persona.lang,
                persona_name=self.persona.name, scenario=self.scenario,
                transcript=self.history, score=result,
            )

    async def close(self) -> None:
        await self.cancel_agent()

    # ── agent generation ────────────────────────────────────────────────
    def _spawn_agent(self, *, opener: bool) -> None:
        self._agent_task = asyncio.create_task(self._generate_and_speak(opener=opener))

    async def _generate_and_speak(self, *, opener: bool) -> None:
        try:
            if opener:
                history = [{"role": "user", "content": greeting_instruction(self.persona)}]
            else:
                history = self.history[-MAX_HISTORY_TURNS:]

            full_text = ""
            buffer = ""
            spoke_any = False
            t0 = time.monotonic()

            async for delta in llm.stream_reply(self.persona.base_prompt, history):
                full_text += delta
                buffer += delta
                await self._send_json({"type": "agent_text", "delta": delta, "done": False})

                sentences, buffer = tts.take_sentences(buffer)
                for sentence in sentences:
                    audio = await tts.synthesize(sentence, voice_id=self.persona.voice_id)
                    if audio:
                        if not spoke_any:
                            await self._state("speaking")
                            logger.info("first audio %.0fms", (time.monotonic() - t0) * 1000)
                            spoke_any = True
                        await self._send_audio(audio)

            # flush trailing partial sentence
            tail = buffer.strip()
            if tail:
                audio = await tts.synthesize(tail, voice_id=self.persona.voice_id)
                if audio:
                    if not spoke_any:
                        await self._state("speaking")
                        spoke_any = True
                    await self._send_audio(audio)

            if full_text.strip():
                self._append("assistant", full_text.strip())
            await self._send_json({"type": "agent_text", "delta": "", "done": True, "text": full_text.strip()})
            await self._send_json({"type": "agent_done"})
            await self._state("listening")
        except asyncio.CancelledError:
            # Interrupted by barge-in or a new user turn — drop this reply quietly.
            raise
        except Exception as exc:  # pragma: no cover
            logger.warning("agent generation error: %s", exc)
            await self._send_json({"type": "error", "detail": "agent_failed"})
            await self._state("listening")

    # ── state ────────────────────────────────────────────────────────────
    def _append(self, role: str, content: str) -> None:
        self.history.append({"role": role, "content": content})
        if len(self.history) > MAX_HISTORY_TURNS * 2:
            self.history = self.history[-MAX_HISTORY_TURNS * 2 :]
