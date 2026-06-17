"""Live conversational agent: real-time STT -> LLM -> TTS loop over WebSocket.

Phase 1 ships the transport + loop with a single hardcoded persona.
Phase 2 swaps `persona.py` to load tenant-scoped personas from the database.
"""
