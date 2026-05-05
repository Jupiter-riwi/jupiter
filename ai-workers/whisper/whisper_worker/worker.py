from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pika
from openai import APIError
from pydantic import ValidationError

from whisper_worker.audio import AudioConfig, AudioExtractionError, AudioExtractor
from whisper_worker.config import Settings
from whisper_worker.contracts import WhisperJob, parse_whisper_job
from whisper_worker.openai_client import WhisperClient, WhisperTranscriptionError
from whisper_worker.rabbitmq import create_connection, declare_queues, publish_json
from whisper_worker.repository import DatabaseConfig, FeatureRepository, RepositoryError
from whisper_worker.storage import DownloadError, StorageConfig, VideoDownloader

logger = logging.getLogger(__name__)


class SilentAudioError(RuntimeError):
    """Raised when the transcript is empty and audio is effectively silent."""


class WhisperWorker:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.downloader = VideoDownloader(StorageConfig.from_settings(settings))
        self.audio = AudioExtractor(
            AudioConfig(
                ffmpeg_bin=settings.ffmpeg_bin,
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
        del properties

        video_path: Path | None = None
        audio_path: Path | None = None
        job_hint = self._extract_job_hint(body)

        try:
            job = parse_whisper_job(body)
            job_hint = {
                "job_id": job.job_id,
                "evaluation_id": job.evaluation_id,
                "tenant_id": job.tenant_id,
            }

            logger.info(
                "Processing whisper job job_id=%s evaluation_id=%s",
                job.job_id,
                job.evaluation_id,
            )

            video_path = self.downloader.download(job.video_url)
            audio_path = self.audio.extract(video_path)

            if self.audio.is_silent(audio_path):
                raise SilentAudioError("Audio is silent or below energy threshold")

            transcript = self.transcriber.transcribe(
                audio_path,
                language=job.language_override(),
                prompt=job.prompt(),
            )

            if not str(transcript.get("text", "")).strip():
                raise SilentAudioError("Audio is silent or contains no speech")

            payload = self._build_payload(job, transcript)

            self.repository.save_transcript(
                evaluation_id=job.evaluation_id,
                tenant_id=job.tenant_id,
                payload=payload,
            )

            event = self._build_ready_event(job, payload)
            publish_json(
                channel,
                queue_name=self.settings.features_results_queue,
                payload=event,
            )

            logger.info("Job job_id=%s completed", job.job_id)
        except Exception as exc:
            code, message = self._map_error(exc)
            logger.error("Whisper job failed code=%s message=%s", code, message)
            event = self._build_error_event(job_hint, code, message)
            try:
                publish_json(
                    channel,
                    queue_name=self.settings.features_results_queue,
                    payload=event,
                )
            except Exception as publish_exc:  # pragma: no cover
                logger.error("Could not publish error event: %s", publish_exc)
        finally:
            self.audio.cleanup(audio_path)
            self.downloader.cleanup(video_path)
            channel.basic_ack(delivery_tag=method.delivery_tag)

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
        if isinstance(exc, SilentAudioError):
            return "AUDIO_SILENT", str(exc)
        if isinstance(exc, WhisperTranscriptionError):
            return "OPENAI_ERROR", str(exc)
        if isinstance(exc, RepositoryError):
            return "DB_WRITE_ERROR", str(exc)
        if isinstance(exc, APIError):
            return "OPENAI_ERROR", str(exc)
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
