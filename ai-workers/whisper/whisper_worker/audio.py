from __future__ import annotations

import math
import subprocess
import struct
import uuid
import wave
from dataclasses import dataclass
from pathlib import Path


class AudioExtractionError(RuntimeError):
    """Raised when ffmpeg fails to extract audio."""


@dataclass(frozen=True)
class AudioConfig:
    ffmpeg_bin: str
    temp_dir: Path
    audio_format: str


class AudioExtractor:
    def __init__(self, config: AudioConfig):
        self.config = config
        self.config.temp_dir.mkdir(parents=True, exist_ok=True)

    def extract(self, video_path: Path) -> Path:
        destination = self._build_destination()
        command = [
            self.config.ffmpeg_bin,
            "-y",
            "-i",
            str(video_path),
            "-ac",
            "1",
            "-ar",
            "16000",
            "-vn",
            str(destination),
        ]

        try:
            subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except subprocess.CalledProcessError as exc:
            raise AudioExtractionError("ffmpeg failed to extract audio") from exc

        if not destination.exists():
            raise AudioExtractionError("ffmpeg did not produce the audio file")

        return destination

    def cleanup(self, path: Path | None) -> None:
        if path is None:
            return
        try:
            if path.exists():
                path.unlink()
        except OSError:
            pass

    def is_silent(self, audio_path: Path, *, rms_threshold: float = 120.0) -> bool:
        try:
            with wave.open(str(audio_path), "rb") as handle:
                sample_width = handle.getsampwidth()
                if sample_width != 2:
                    return False

                total_samples = 0
                total_power = 0.0

                while True:
                    chunk = handle.readframes(4096)
                    if not chunk:
                        break

                    count = len(chunk) // 2
                    if count == 0:
                        continue

                    samples = struct.unpack(f"<{count}h", chunk[: count * 2])
                    total_power += sum(sample * sample for sample in samples)
                    total_samples += count

                if total_samples == 0:
                    return True

                rms = math.sqrt(total_power / total_samples)
                return rms < rms_threshold
        except wave.Error:
            return False

    def _build_destination(self) -> Path:
        suffix = f".{self.config.audio_format.lstrip('.')}"
        filename = f"whisper-audio-{uuid.uuid4().hex}{suffix}"
        return self.config.temp_dir / filename
