from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from pose_worker.storage import DownloadError, StorageConfig, VideoDownloader


def _downloader(tmp_path: Path) -> VideoDownloader:
    return VideoDownloader(
        StorageConfig(
            aws_access_key_id="",
            aws_secret_access_key="",
            aws_region="us-east-1",
            s3_endpoint_url="",
            temp_dir=tmp_path,
        )
    )


def test_parse_s3_url() -> None:
    bucket, key = VideoDownloader.parse_s3_url("s3://videos/tenant/demo.webm")
    assert bucket == "videos"
    assert key == "tenant/demo.webm"


def test_parse_s3_url_invalid() -> None:
    with pytest.raises(DownloadError):
        VideoDownloader.parse_s3_url("s3://videos")


def test_local_file_is_copied_to_temp_dir() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        tmp_path = Path(temp_dir)
        source = tmp_path / "sample.webm"
        source.write_bytes(b"fake-video")

        downloader = _downloader(tmp_path)
        downloaded = downloader.download(str(source))

        assert downloaded.exists()
        assert downloaded != source
        assert downloaded.read_bytes() == b"fake-video"
