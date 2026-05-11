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
    ffprobe_bin: str
    temp_dir: Path
    audio_format: str


@dataclass(frozen=True)
class AudioChunk:
    index: int
    start_sec: float
    end_sec: float
    path: Path


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

    def cleanup_many(self, paths: list[Path]) -> None:
        for path in paths:
            self.cleanup(path)

    def probe_duration_seconds(self, media_path: Path) -> float:
        raw = self._probe_field(media_path, "format=duration")
        if raw and raw != "N/A":
            try:
                return float(raw)
            except ValueError:
                pass
        raw = self._probe_field(media_path, "stream=duration")
        if raw and raw != "N/A":
            try:
                vals = [float(v) for v in raw.split("\n") if v and v != "N/A"]
                if vals:
                    return max(vals)
            except ValueError:
                pass
        return 0.0

    def _probe_field(self, media_path: Path, entry: str) -> str:
        command = [
            self.config.ffprobe_bin, "-v", "error",
            "-show_entries", entry,
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(media_path),
        ]
        try:
            result = subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            return result.stdout.strip()
        except Exception:
            return ""

    def split_audio(self, audio_path: Path, *, chunk_seconds: int, duration_seconds: float) -> list[AudioChunk]:
        if chunk_seconds <= 0:
            raise ValueError("chunk_seconds must be > 0")

        chunks: list[AudioChunk] = []
        index = 0
        start = 0.0

        while start < duration_seconds:
            end = min(start + float(chunk_seconds), duration_seconds)
            chunk_path = self._build_chunk_destination(index=index)
            command = [
                self.config.ffmpeg_bin,
                "-y",
                "-ss",
                f"{start:.3f}",
                "-t",
                f"{max(end - start, 0.001):.3f}",
                "-i",
                str(audio_path),
                "-acodec",
                "copy",
                str(chunk_path),
            ]

            try:
                subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            except subprocess.CalledProcessError as exc:
                raise AudioExtractionError("ffmpeg failed to split audio") from exc

            if not chunk_path.exists():
                raise AudioExtractionError("ffmpeg did not produce chunked audio")

            chunks.append(
                AudioChunk(
                    index=index,
                    start_sec=start,
                    end_sec=end,
                    path=chunk_path,
                )
            )
            index += 1
            start = end

        return chunks

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

    def _build_chunk_destination(self, *, index: int) -> Path:
        suffix = f".{self.config.audio_format.lstrip('.')}"
        filename = f"whisper-chunk-{index}-{uuid.uuid4().hex}{suffix}"
        return self.config.temp_dir / filename
