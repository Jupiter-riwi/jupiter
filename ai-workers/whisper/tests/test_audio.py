from __future__ import annotations

import subprocess
from pathlib import Path
from unittest import mock
import wave
import struct
import math

import pytest

from whisper_worker.audio import AudioConfig, AudioExtractionError, AudioExtractor


def test_extract_audio_invokes_ffmpeg(tmp_path: Path) -> None:
    extractor = AudioExtractor(
        AudioConfig(
            ffmpeg_bin="ffmpeg",
            ffprobe_bin="ffprobe",
            temp_dir=tmp_path,
            audio_format="wav",
        ),
    )

    video_path = tmp_path / "video.mp4"
    video_path.write_bytes(b"video")

    with mock.patch("subprocess.run") as run_mock:
        run_mock.return_value = mock.Mock()
        with mock.patch.object(Path, "exists", return_value=True):
            output = extractor.extract(video_path)

    run_mock.assert_called_once()
    assert output.suffix == ".wav"


def test_extract_audio_raises_on_failure(tmp_path: Path) -> None:
    extractor = AudioExtractor(
        AudioConfig(
            ffmpeg_bin="ffmpeg",
            ffprobe_bin="ffprobe",
            temp_dir=tmp_path,
            audio_format="wav",
        ),
    )

    video_path = tmp_path / "video.mp4"
    video_path.write_bytes(b"video")

    error = subprocess.CalledProcessError(returncode=1, cmd=["ffmpeg"])
    with mock.patch("subprocess.run", side_effect=error):
        with pytest.raises(AudioExtractionError):
            extractor.extract(video_path)


def test_is_silent_detects_silent_wav(tmp_path: Path) -> None:
    extractor = AudioExtractor(
        AudioConfig(
            ffmpeg_bin="ffmpeg",
            ffprobe_bin="ffprobe",
            temp_dir=tmp_path,
            audio_format="wav",
        ),
    )

    silent_path = tmp_path / "silent.wav"
    with wave.open(str(silent_path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(16000)
        handle.writeframes(b"\x00\x00" * 16000)

    assert extractor.is_silent(silent_path)


def test_is_silent_detects_non_silent_wav(tmp_path: Path) -> None:
    extractor = AudioExtractor(
        AudioConfig(
            ffmpeg_bin="ffmpeg",
            ffprobe_bin="ffprobe",
            temp_dir=tmp_path,
            audio_format="wav",
        ),
    )

    active_path = tmp_path / "voice.wav"
    frames: list[int] = []
    for idx in range(16000):
        sample = int(1500 * math.sin((2 * math.pi * 440 * idx) / 16000))
        frames.append(sample)

    packed = struct.pack("<" + "h" * len(frames), *frames)

    with wave.open(str(active_path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(16000)
        handle.writeframes(packed)

    assert not extractor.is_silent(active_path)


def test_probe_duration_seconds_parses_ffprobe_output(tmp_path: Path) -> None:
    extractor = AudioExtractor(
        AudioConfig(
            ffmpeg_bin="ffmpeg",
            ffprobe_bin="ffprobe",
            temp_dir=tmp_path,
            audio_format="wav",
        ),
    )

    with mock.patch("subprocess.run") as run_mock:
        run_mock.return_value = mock.Mock(stdout="68.8\n")
        duration = extractor.probe_duration_seconds(tmp_path / "video.mp4")

    assert duration == 68.8


def test_split_audio_creates_chunks(tmp_path: Path) -> None:
    extractor = AudioExtractor(
        AudioConfig(
            ffmpeg_bin="ffmpeg",
            ffprobe_bin="ffprobe",
            temp_dir=tmp_path,
            audio_format="wav",
        ),
    )

    with mock.patch("subprocess.run"):
        with mock.patch.object(Path, "exists", return_value=True):
            chunks = extractor.split_audio(
                tmp_path / "audio.wav",
                chunk_seconds=30,
                duration_seconds=65.0,
            )

    assert len(chunks) == 3
    assert chunks[0].start_sec == 0.0
    assert chunks[1].start_sec == 30.0
    assert chunks[2].start_sec == 60.0
