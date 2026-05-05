from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from whisper_worker.audio import AudioConfig, AudioExtractor
from whisper_worker.config import Settings
from whisper_worker.openai_client import WhisperClient


def _build_segments(transcript: dict) -> list[dict]:
    segments = []
    for segment in transcript.get("segments", []):
        segments.append(
            {
                "id": segment.get("id"),
                "start": segment.get("start"),
                "end": segment.get("end"),
                "text": segment.get("text", ""),
                "words": segment.get("words", []),
            }
        )
    return segments


def _estimate_words(text: str) -> int:
    tokens = re.findall(r"\b\w+\b", text or "")
    return len(tokens)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Whisper transcription on a local video")
    parser.add_argument("--video", required=True, help="Video file to transcribe")
    parser.add_argument("--output", default="whisper_output.json", help="Output JSON path")
    parser.add_argument("--language", help="Force language code (overrides settings)")
    parser.add_argument("--prompt", help="Optional prompt for Whisper")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = Settings.from_env()

    video_path = Path(args.video).expanduser().resolve()
    if not video_path.exists() or not video_path.is_file():
        raise FileNotFoundError(f"Video not found: {video_path}")

    extractor = AudioExtractor(
        AudioConfig(
            ffmpeg_bin=settings.ffmpeg_bin,
            temp_dir=settings.temp_dir,
            audio_format=settings.audio_format,
        )
    )

    transcriber = WhisperClient(
        api_key=settings.openai_api_key,
        api_base=settings.openai_api_base,
        model=settings.whisper_model,
        temperature=settings.whisper_temperature,
        default_language=settings.whisper_language,
    )

    audio_path = extractor.extract(video_path)
    try:
        transcript = transcriber.transcribe(
            audio_path,
            language=args.language,
            prompt=args.prompt,
        )
    finally:
        extractor.cleanup(audio_path)

    segments = _build_segments(transcript)
    payload = {
        "schema_version": "1.0.0",
        "kind": "transcript",
        "text": transcript.get("text", ""),
        "language": transcript.get("language"),
        "duration_seconds": transcript.get("duration"),
        "segments": segments,
        "summary": {
            "segments_count": len(segments),
            "words_total": sum(len(item.get("words", [])) for item in segments)
            or _estimate_words(transcript.get("text", "")),
        },
    }

    output_path = Path(args.output).expanduser().resolve()
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Transcript saved to: {output_path}")


if __name__ == "__main__":
    main()
