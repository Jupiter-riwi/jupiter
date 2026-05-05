from __future__ import annotations

import json
import logging
import time
from typing import Any

import pika
from pydantic import ValidationError

from pose_worker.config import Settings
from pose_worker.contracts import build_feature_error, build_feature_ready, parse_pose_job
from pose_worker.pose_detector import (
    DetectorConfig,
    InvalidVideoError,
    PoseDetector,
    PoseProcessingError,
    VideoTooLongError,
)
from pose_worker.rabbitmq import create_connection, declare_queues, publish_json
from pose_worker.repository import DatabaseConfig, FeatureRepository, RepositoryError
from pose_worker.storage import DownloadError, StorageConfig, VideoDownloader

logger = logging.getLogger(__name__)


class PoseWorker:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.downloader = VideoDownloader(StorageConfig.from_settings(settings))
        self.repository = FeatureRepository(DatabaseConfig.from_settings(settings))
        self.analyzer = PoseDetector(DetectorConfig.from_settings(settings))

    def run(self) -> None:
        while True:
            connection = None
            try:
                connection = create_connection(self.settings)
                channel = connection.channel()
                declare_queues(channel, self.settings)
                channel.basic_qos(prefetch_count=1)
                channel.basic_consume(
                    queue=self.settings.pose_jobs_queue,
                    on_message_callback=self._on_message,
                    auto_ack=False,
                )
                logger.info(
                    "Pose worker escuchando cola '%s' y publicando en '%s'",
                    self.settings.pose_jobs_queue,
                    self.settings.features_results_queue,
                )
                channel.start_consuming()
            except pika.exceptions.AMQPConnectionError as exc:
                logger.error("Conexion a RabbitMQ fallo: %s. Reintento en 5s", exc)
                time.sleep(5)
            except Exception as exc:  # pragma: no cover - defensivo de runtime.
                logger.exception("Error inesperado en pose worker: %s. Reintento en 5s", exc)
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

        temp_video = None
        job_hint = self._extract_job_hint(body)

        try:
            job = parse_pose_job(body)
            job_hint = {
                "job_id": job.job_id,
                "evaluation_id": job.evaluation_id,
                "tenant_id": job.tenant_id,
            }

            logger.info(
                "Procesando job_id=%s evaluation_id=%s",
                job.job_id,
                job.evaluation_id,
            )

            temp_video = self.downloader.download(job.video_url)
            payload = self.analyzer.process_video(
                temp_video,
                segment_seconds=job.segment_seconds(self.settings.segment_seconds),
            )
            payload["evaluation_id"] = job.evaluation_id
            payload["tenant_id"] = job.tenant_id
            payload["job_id"] = job.job_id

            self.repository.save_pose_feature(
                evaluation_id=job.evaluation_id,
                tenant_id=job.tenant_id,
                payload=payload,
            )

            event = build_feature_ready(
                job=job,
                worker_name=self.settings.worker_name,
                payload=payload,
            )
            publish_json(
                channel,
                queue_name=self.settings.features_results_queue,
                payload=event,
            )

            logger.info("Job job_id=%s finalizado OK", job.job_id)
        except Exception as exc:
            code, message = self._map_error(exc)
            logger.error("Error en job pose: code=%s message=%s", code, message)
            event = build_feature_error(
                job_hint=job_hint,
                worker_name=self.settings.worker_name,
                code=code,
                message=message,
            )
            try:
                publish_json(
                    channel,
                    queue_name=self.settings.features_results_queue,
                    payload=event,
                )
            except Exception as publish_exc:  # pragma: no cover - runtime de broker.
                logger.error("No se pudo publicar evento de error: %s", publish_exc)
        finally:
            self.downloader.cleanup(temp_video)
            channel.basic_ack(delivery_tag=method.delivery_tag)

    @staticmethod
    def _map_error(exc: Exception) -> tuple[str, str]:
        if isinstance(exc, json.JSONDecodeError):
            return "INVALID_JOB_JSON", "El mensaje no contiene JSON valido"
        if isinstance(exc, ValidationError):
            return "INVALID_JOB_PAYLOAD", "El payload del job no cumple el contrato"
        if isinstance(exc, DownloadError):
            return "VIDEO_DOWNLOAD_ERROR", str(exc)
        if isinstance(exc, VideoTooLongError):
            return "VIDEO_TOO_LONG", str(exc)
        if isinstance(exc, InvalidVideoError):
            return "VIDEO_CORRUPT", str(exc)
        if isinstance(exc, RepositoryError):
            return "DB_WRITE_ERROR", str(exc)
        if isinstance(exc, PoseProcessingError):
            return "POSE_PROCESSING_ERROR", str(exc)
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
