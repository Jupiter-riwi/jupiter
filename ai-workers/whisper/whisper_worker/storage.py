from __future__ import annotations

import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

import boto3
import requests

from whisper_worker.config import Settings


class DownloadError(RuntimeError):
    """Raised when the video file cannot be downloaded."""


@dataclass(frozen=True)
class StorageConfig:
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str
    s3_endpoint_url: str
    temp_dir: Path

    @classmethod
    def from_settings(cls, settings: Settings) -> "StorageConfig":
        return cls(
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            aws_region=settings.aws_region,
            s3_endpoint_url=settings.s3_endpoint_url,
            temp_dir=settings.temp_dir,
        )


class VideoDownloader:
    def __init__(self, config: StorageConfig):
        self.config = config
        self.config.temp_dir.mkdir(parents=True, exist_ok=True)

    def download(self, video_url: str) -> Path:
        if video_url.startswith("s3://"):
            return self._download_s3(video_url)
        if video_url.startswith("http://") or video_url.startswith("https://"):
            return self._download_http(video_url)
        if video_url.startswith("file://"):
            return self._copy_local(Path(video_url.removeprefix("file://")))

        local = Path(video_url)
        if local.exists():
            return self._copy_local(local)

        raise DownloadError(f"Unsupported video URL: {video_url}")

    def cleanup(self, path: Path | None) -> None:
        if path is None:
            return
        try:
            if path.exists():
                path.unlink()
        except OSError:
            pass

    @staticmethod
    def parse_s3_url(video_url: str) -> tuple[str, str]:
        parsed = urlparse(video_url)
        bucket = parsed.netloc
        key = parsed.path.lstrip("/")
        if not bucket or not key:
            raise DownloadError(f"Invalid S3 URL: {video_url}")
        return bucket, key

    def _download_s3(self, video_url: str) -> Path:
        bucket, key = self.parse_s3_url(video_url)
        destination = self._dest_for_key(key)

        try:
            client = boto3.client(
                "s3",
                endpoint_url=self.config.s3_endpoint_url or None,
                region_name=self.config.aws_region,
                aws_access_key_id=self.config.aws_access_key_id or None,
                aws_secret_access_key=self.config.aws_secret_access_key or None,
            )
            client.download_file(bucket, key, str(destination))
            return destination
        except Exception as exc:  # pragma: no cover
            raise DownloadError(f"Could not download {video_url} from S3") from exc

    def _download_http(self, video_url: str) -> Path:
        destination = self._dest_for_key(urlparse(video_url).path)
        try:
            response = requests.get(video_url, stream=True, timeout=120)
            response.raise_for_status()
            with destination.open("wb") as output:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        output.write(chunk)
            return destination
        except Exception as exc:
            raise DownloadError(f"Could not download {video_url} via HTTP") from exc

    def _copy_local(self, source: Path) -> Path:
        if not source.exists() or not source.is_file():
            raise DownloadError(f"Local video not found: {source}")
        destination = self._dest_for_key(source.name)
        shutil.copy2(source, destination)
        return destination

    def _dest_for_key(self, key: str) -> Path:
        suffix = Path(key).suffix or ".mp4"
        filename = f"whisper-video-{uuid.uuid4().hex}{suffix}"
        return self.config.temp_dir / filename
