from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from whisper_worker.storage import DownloadError, StorageConfig, VideoDownloader


def _make_downloader(tmp_path: Path) -> VideoDownloader:
    return VideoDownloader(
        StorageConfig(
            aws_access_key_id="",
            aws_secret_access_key="",
            aws_region="us-east-1",
            s3_endpoint_url="",
            temp_dir=tmp_path,
        )
    )


def test_parse_s3_url_valid() -> None:
    bucket, key = VideoDownloader.parse_s3_url("s3://videos/path/file.mp4")
    assert bucket == "videos"
    assert key == "path/file.mp4"


def test_parse_s3_url_invalid() -> None:
    with pytest.raises(DownloadError):
        VideoDownloader.parse_s3_url("s3://videos")


def test_copy_local_creates_temp_file(tmp_path: Path) -> None:
    source = tmp_path / "sample.mp4"
    source.write_bytes(b"fake data")

    downloader = _make_downloader(tmp_path)
    result = downloader.download(str(source))

    assert result.exists()
    assert result != source
    assert result.read_bytes() == b"fake data"
