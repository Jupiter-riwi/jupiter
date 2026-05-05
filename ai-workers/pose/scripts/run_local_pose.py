from __future__ import annotations

import argparse
import json
from pathlib import Path

from pose_worker.config import Settings
from pose_worker.pose_detector import DetectorConfig, PoseDetector


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Procesa un video local con el pose worker")
    parser.add_argument("--video", required=True, help="Ruta local del video")
    parser.add_argument("--output", default="pose_output.json", help="Ruta JSON de salida")
    parser.add_argument(
        "--segment-seconds",
        type=int,
        default=None,
        help="Duracion del segmento en segundos (opcional)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = Settings.from_env()
    analyzer = PoseDetector(DetectorConfig.from_settings(settings))

    payload = analyzer.process_video(
        Path(args.video),
        segment_seconds=args.segment_seconds,
    )

    output_path = Path(args.output)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Output generado en: {output_path.resolve()}")


if __name__ == "__main__":
    main()
