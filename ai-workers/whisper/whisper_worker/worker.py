from __future__ import annotations

import json
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pika
from pydantic import ValidationError

from whisper_worker.audio import AudioChunk, AudioConfig, AudioExtractionError, AudioExtractor
from whisper_worker.config import Settings
from whisper_worker.contracts import WhisperJob, parse_whisper_job
from whisper_worker.openai_client import WhisperClient, WhisperTranscriptionError
from whisper_worker.rabbitmq import create_connection, declare_queues, publish_json
from whisper_worker.repository import DatabaseConfig, FeatureRepository, RepositoryError
from whisper_worker.storage import DownloadError, StorageConfig, VideoDownloader

logger = logging.getLogger(__name__)

_MAX_RETRY_COUNT = 10


class SilentAudioError(RuntimeError):
    """Raised when the transcript is empty and audio is effectively silent."""


class VideoTooLongError(RuntimeError):
    """Raised when a video exceeds the configured max duration."""


class WhisperWorker:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.downloader = VideoDownloader(StorageConfig.from_settings(settings))
        self.audio = AudioExtractor(
            AudioConfig(
                ffmpeg_bin=settings.ffmpeg_bin,
                ffprobe_bin=settings.ffprobe_bin,
                temp_dir=settings.temp_dir,
                audio_format=settings.audio_format,
            )
        )
        self.repository = FeatureRepository(DatabaseConfig.from_settings(settings))
        self.transcriber = WhisperClient(
            api_key=settings.openai_api_key,
            api_base=settings.openai_api_base,
            model=settings.whisper_model,
            temperature=settings.whisper_temperature,
            default_language=settings.whisper_language,
            include_word_timestamps=settings.whisper_word_timestamps,
        )

    def run(self) -> None:
        while True:
            connection = None
            try:
                connection = create_connection(self.settings)
                channel = connection.channel()
                declare_queues(channel, self.settings)
                channel.basic_qos(prefetch_count=1)
                channel.basic_consume(
                    queue=self.settings.whisper_jobs_queue,
                    on_message_callback=self._on_message,
                    auto_ack=False,
                )
                logger.info(
                    "Whisper worker listening on '%s' and publishing to '%s'",
                    self.settings.whisper_jobs_queue,
                    self.settings.features_results_queue,
                )
                channel.start_consuming()
            except pika.exceptions.AMQPConnectionError as exc:
                logger.error("RabbitMQ connection failed: %s. Retrying in 5s", exc)
                time.sleep(5)
            except Exception as exc:  # pragma: no cover
                logger.exception("Unexpected error in whisper worker: %s. Retrying in 5s", exc)
                time.sleep(5)
            finally:
                if connection is not None and connection.is_open:
                    connection.close()

    def _on_message(
        self,
        channel: pika.adapters.blocking_connection.BlockingChannel,
        method: pika.spec.Basic.Deliver,
        properties: pika.spec.BasicProperties,
        body: bytes,
    ) -> None:
        delivery_tag = method.delivery_tag
        video_path: Path | None = None
        audio_path: Path | None = None
        job_hint = self._extract_job_hint(body)

        # ── Step 1: Parse job payload ──
        try:
            job = parse_whisper_job(body)
            job_hint = {
                "job_id": job.job_id,
                "evaluation_id": job.evaluation_id,
                "tenant_id": job.tenant_id,
            }
        except (json.JSONDecodeError, ValidationError) as exc:
            self._fail_step(channel, delivery_tag, job_hint, exc, requeue=False)
            return

        logger.info(
            "Processing whisper job job_id=%s evaluation_id=%s",
            job.job_id,
            job.evaluation_id,
        )

        # ── Step 2: Download video ──
        try:
            video_path = self.downloader.download(job.video_url)
        except DownloadError as exc:
            self._fail_step(channel, delivery_tag, job_hint, exc, requeue=False)
            return

        # ── Step 3: Extract audio & validate ──
        try:
            video_duration = self.audio.probe_duration_seconds(video_path)
            if video_duration > self.settings.whisper_max_video_seconds:
                raise VideoTooLongError(
                    f"Video duration {video_duration:.2f}s exceeds max of "
                    f"{self.settings.whisper_max_video_seconds}s"
                )
            audio_path = self.audio.extract(video_path)
            audio_duration = self.audio.probe_duration_seconds(audio_path)
            if self.audio.is_silent(audio_path):
                raise SilentAudioError("Audio is silent or below energy threshold")
        except Exception as exc:
            self._cleanup(audio_path, video_path)
            self._fail_step(channel, delivery_tag, job_hint, exc, requeue=False)
            return

        # ── Step 4: Transcribe audio ──
        try:
            language = job.language_override()
            prompt = job.prompt()
            if audio_duration > self.settings.whisper_chunk_seconds:
                transcript = self._transcribe_in_chunks(
                    audio_path,
                    duration_seconds=audio_duration,
                    language=language,
                    prompt=prompt,
                )
            else:
                transcript = self.transcriber.transcribe(
                    audio_path,
                    language=language,
                    prompt=prompt,
                )

            if not str(transcript.get("text", "")).strip():
                raise SilentAudioError("Audio is silent or contains no speech")
        except WhisperTranscriptionError as exc:
            self._cleanup(audio_path, video_path)
            if exc.retryable:
                self._retry_or_fail(channel, delivery_tag, job, properties, body, exc)
            else:
                self._try_mark_failed(job.evaluation_id, str(exc))
                self._publish_error(channel, job_hint, "OPENAI_ERROR", str(exc))
                channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
            return
        except SilentAudioError as exc:
            self._cleanup(audio_path, video_path)
            self._fail_step(channel, delivery_tag, job_hint, exc, requeue=False)
            return
        except Exception as exc:
            self._cleanup(audio_path, video_path)
            self._fail_step(channel, delivery_tag, job_hint, exc, requeue=False)
            return

        # ── Step 5: Persist to DB ──
        try:
            payload = self._build_payload(job, transcript)
            self.repository.save_transcript(
                evaluation_id=job.evaluation_id,
                tenant_id=job.tenant_id,
                payload=payload,
            )
        except RepositoryError as exc:
            self._cleanup(audio_path, video_path)
            self._fail_step(channel, delivery_tag, job_hint, exc, requeue=True)
            return
        except Exception as exc:
            self._cleanup(audio_path, video_path)
            self._fail_step(channel, delivery_tag, job_hint, exc, requeue=False)
            return

        # ── Step 6: Publish success event (best-effort) ──
        try:
            event = self._build_ready_event(job, payload)
            publish_json(
                channel,
                queue_name=self.settings.features_results_queue,
                payload=event,
            )
        except Exception as publish_exc:
            logger.error("Could not publish success event: %s", publish_exc)

        self._cleanup(audio_path, video_path)
        channel.basic_ack(delivery_tag=delivery_tag)
        logger.info("Job job_id=%s completed", job.job_id)

    # ── Error handling helpers ──────────────────────────────────────────────────

    def _fail_step(
        self,
        channel: pika.adapters.blocking_connection.BlockingChannel,
        delivery_tag: int,
        job_hint: dict[str, str],
        exc: Exception,
        *,
        requeue: bool,
    ) -> None:
        code, message = self._map_error(exc)
        logger.error("Whisper job failed code=%s message=%s", code, message)
        self._publish_error(channel, job_hint, code, message)
        channel.basic_nack(delivery_tag=delivery_tag, requeue=requeue)

    def _retry_or_fail(
        self,
        channel: pika.adapters.blocking_connection.BlockingChannel,
        delivery_tag: int,
        job: WhisperJob,
        properties: pika.spec.BasicProperties,
        body: bytes,
        exc: WhisperTranscriptionError,
    ) -> None:
        retry_count = self._get_retry_count(properties)
        if retry_count >= _MAX_RETRY_COUNT:
            logger.error(
                "Max retries (%d) exhausted for evaluation_id=%s — marking as failed",
                _MAX_RETRY_COUNT,
                job.evaluation_id,
            )
            self._try_mark_failed(job.evaluation_id, str(exc))
            channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
        else:
            logger.warning(
                "Transient OpenAI error — retrying (%d/%d): %s",
                retry_count + 1,
                _MAX_RETRY_COUNT,
                exc,
            )
            self._republish_with_retry(channel, body, retry_count + 1)
            channel.basic_ack(delivery_tag=delivery_tag)

    def _try_mark_failed(self, evaluation_id: str, reason: str) -> None:
        try:
            self.repository.mark_evaluation_failed(
                evaluation_id=evaluation_id,
                reason=reason,
            )
        except Exception as exc:
            logger.error("Could not mark evaluation %s as failed: %s", evaluation_id, exc)

    def _publish_error(
        self,
        channel: pika.adapters.blocking_connection.BlockingChannel,
        job_hint: dict[str, str],
        code: str,
        message: str,
    ) -> None:
        event = self._build_error_event(job_hint, code, message)
        try:
            publish_json(
                channel,
                queue_name=self.settings.features_results_queue,
                payload=event,
            )
        except Exception as publish_exc:  # pragma: no cover
            logger.error("Could not publish error event: %s", publish_exc)

    @staticmethod
    def _get_retry_count(properties: pika.spec.BasicProperties) -> int:
        headers = getattr(properties, "headers", None) or {}
        count = headers.get("x-retry-count", 0) if isinstance(headers, dict) else 0
        try:
            return int(count)
        except (TypeError, ValueError):
            return 0

    def _republish_with_retry(
        self,
        channel: pika.adapters.blocking_connection.BlockingChannel,
        body: bytes,
        retry_count: int,
    ) -> None:
        channel.basic_publish(
            exchange="",
            routing_key=self.settings.whisper_jobs_queue,
            body=body,
            properties=pika.BasicProperties(
                delivery_mode=2,
                content_type="application/json",
                headers={"x-retry-count": retry_count},
            ),
        )

    def _cleanup(self, audio_path: Path | None, video_path: Path | None) -> None:
        self.audio.cleanup(audio_path)
        self.downloader.cleanup(video_path)

    # ── Payload builders ───────────────────────────────────────────────────────

    def _build_payload(self, job: WhisperJob, transcript: dict[str, Any]) -> dict[str, Any]:
        segments = []
        raw_segments = transcript.get("segments") or []
        for segment in raw_segments:
            segments.append(
                {
                    "id": segment.get("id"),
                    "start": segment.get("start"),
                    "end": segment.get("end"),
                    "text": segment.get("text", ""),
                    "words": segment.get("words", []),
                }
            )

        words_total = sum(len(item.get("words", [])) for item in segments)
        if words_total == 0:
            words_total = self._estimate_words(transcript.get("text", ""))

        payload = {
            "schema_version": "1.0.0",
            "kind": "transcript",
            "job_id": job.job_id,
            "evaluation_id": job.evaluation_id,
            "tenant_id": job.tenant_id,
            "text": transcript.get("text", ""),
            "language": transcript.get("language"),
            "duration_seconds": transcript.get("duration"),
            "segments": segments,
            "summary": {
                "segments_count": len(segments),
                "words_total": words_total,
            },
        }
        return payload

    def _transcribe_in_chunks(
        self,
        audio_path: Path,
        *,
        duration_seconds: float,
        language: str | None,
        prompt: str | None,
    ) -> dict[str, Any]:
        chunk_seconds = max(1, self.settings.whisper_chunk_seconds)
        chunks = self.audio.split_audio(
            audio_path,
            chunk_seconds=chunk_seconds,
            duration_seconds=duration_seconds,
        )
        chunk_paths = [item.path for item in chunks]

        try:
            max_workers = max(1, min(self.settings.whisper_parallel_requests, len(chunks)))
            futures = {}
            results: dict[int, dict[str, Any]] = {}

            with ThreadPoolExecutor(max_workers=max_workers) as pool:
                for chunk in chunks:
                    future = pool.submit(
                        self.transcriber.transcribe,
                        chunk.path,
                        language=language,
                        prompt=prompt,
                    )
                    futures[future] = chunk

                for future, chunk in futures.items():
                    results[chunk.index] = future.result()

            return self._merge_chunk_transcripts(
                chunks,
                results=results,
                duration_seconds=duration_seconds,
            )
        finally:
            self.audio.cleanup_many(chunk_paths)

    def _merge_chunk_transcripts(
        self,
        chunks: list[AudioChunk],
        *,
        results: dict[int, dict[str, Any]],
        duration_seconds: float,
    ) -> dict[str, Any]:
        text_parts: list[str] = []
        merged_segments: list[dict[str, Any]] = []
        language: str | None = None
        segment_id = 0

        for chunk in sorted(chunks, key=lambda item: item.index):
            transcript = results.get(chunk.index, {})
            if language is None:
                raw_lang = transcript.get("language")
                if isinstance(raw_lang, str) and raw_lang:
                    language = raw_lang

            text_part = str(transcript.get("text", "")).strip()
            if text_part:
                text_parts.append(text_part)

            raw_segments = transcript.get("segments") or []
            if not raw_segments and text_part:
                merged_segments.append(
                    {
                        "id": segment_id,
                        "start": round(chunk.start_sec, 3),
                        "end": round(min(chunk.end_sec, duration_seconds), 3),
                        "text": text_part,
                        "words": [],
                    }
                )
                segment_id += 1
                continue

            for raw_segment in raw_segments:
                start = self._safe_float(raw_segment.get("start"), 0.0) + chunk.start_sec
                end = self._safe_float(raw_segment.get("end"), start) + chunk.start_sec
                if end < start:
                    end = start

                words = self._shift_words(
                    raw_segment.get("words", []),
                    offset=chunk.start_sec,
                    duration_seconds=duration_seconds,
                )

                merged_segments.append(
                    {
                        "id": segment_id,
                        "start": round(min(start, duration_seconds), 3),
                        "end": round(min(end, duration_seconds), 3),
                        "text": raw_segment.get("text", ""),
                        "words": words,
                    }
                )
                segment_id += 1

        return {
            "text": " ".join(text_parts).strip(),
            "language": language,
            "duration": duration_seconds,
            "segments": merged_segments,
        }

    @staticmethod
    def _safe_float(value: Any, default: float) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def _shift_words(
        self,
        raw_words: Any,
        *,
        offset: float,
        duration_seconds: float,
    ) -> list[dict[str, Any]]:
        if not isinstance(raw_words, list):
            return []

        shifted: list[dict[str, Any]] = []
        for raw in raw_words:
            if not isinstance(raw, dict):
                continue

            start = self._safe_float(raw.get("start"), 0.0) + offset
            end = self._safe_float(raw.get("end"), start) + offset
            if end < start:
                end = start

            shifted.append(
                {
                    "word": raw.get("word"),
                    "start": round(min(start, duration_seconds), 3),
                    "end": round(min(end, duration_seconds), 3),
                }
            )
        return shifted

    @staticmethod
    def _estimate_words(text: str) -> int:
        tokens = re.findall(r"\b\w+\b", text or "")
        return len(tokens)

    def _build_ready_event(self, job: WhisperJob, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "event": "feature.ready",
            "status": "ok",
            "worker": self.settings.worker_name,
            "job_id": job.job_id,
            "evaluation_id": job.evaluation_id,
            "tenant_id": job.tenant_id,
            "kind": "transcript",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "payload": payload,
        }

    def _build_error_event(
        self,
        job_hint: dict[str, str],
        code: str,
        message: str,
    ) -> dict[str, Any]:
        return {
            "event": "feature.error",
            "status": "error",
            "worker": self.settings.worker_name,
            "job_id": job_hint.get("job_id"),
            "evaluation_id": job_hint.get("evaluation_id"),
            "tenant_id": job_hint.get("tenant_id"),
            "kind": "transcript",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "error": {
                "code": code,
                "message": message,
            },
        }

    @staticmethod
    def _map_error(exc: Exception) -> tuple[str, str]:
        if isinstance(exc, json.JSONDecodeError):
            return "INVALID_JOB_JSON", "Malformed job payload"
        if isinstance(exc, ValidationError):
            return "INVALID_JOB_PAYLOAD", "Job payload does not match schema"
        if isinstance(exc, DownloadError):
            return "VIDEO_DOWNLOAD_ERROR", str(exc)
        if isinstance(exc, AudioExtractionError):
            return "AUDIO_EXTRACTION_ERROR", str(exc)
        if isinstance(exc, VideoTooLongError):
            return "VIDEO_TOO_LONG", str(exc)
        if isinstance(exc, SilentAudioError):
            return "AUDIO_SILENT", str(exc)
        if isinstance(exc, WhisperTranscriptionError):
            return "OPENAI_ERROR", str(exc)
        if isinstance(exc, RepositoryError):
            return "DB_WRITE_ERROR", str(exc)
        return "INTERNAL_ERROR", str(exc)

    @staticmethod
    def _extract_job_hint(body: bytes) -> dict[str, str]:
        try:
            payload: dict[str, Any] = json.loads(body.decode("utf-8"))
        except Exception:
            return {}

        hint: dict[str, str] = {}
        for key in ("job_id", "evaluation_id", "tenant_id"):
            value = payload.get(key)
            if isinstance(value, str):
                hint[key] = value
        return hint
