from __future__ import annotations

import argparse
from pathlib import Path

import cv2

from config import (
    DEFAULT_BACKEND,
    DEFAULT_CAMERA_INDEX,
    DEFAULT_DETECTION_CONFIDENCE,
    DEFAULT_MAX_FRAMES,
    DEFAULT_MAX_PEOPLE,
    DEFAULT_SHOULDER_THRESHOLD,
    DEFAULT_TRACKING_CONFIDENCE,
    OUTPUT_PATH,
    WINDOW_NAME,
)
from pose_detector import DetectorConfig, PoseDetector
from utils import build_frame_payload, draw_frame_debug, export_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="MVP de deteccion de postura para Jupiter")
    parser.add_argument("--source", default=str(DEFAULT_CAMERA_INDEX), help="Indice de webcam o ruta de video")
    parser.add_argument("--output", default=str(OUTPUT_PATH), help="Ruta del JSON de salida")
    parser.add_argument("--backend", default=DEFAULT_BACKEND, choices=["auto", "openpose", "mediapipe"])
    parser.add_argument("--max-frames", type=int, default=DEFAULT_MAX_FRAMES)
    parser.add_argument("--max-people", type=int, default=DEFAULT_MAX_PEOPLE)
    parser.add_argument("--shoulder-threshold", type=float, default=DEFAULT_SHOULDER_THRESHOLD)
    parser.add_argument("--detection-confidence", type=float, default=DEFAULT_DETECTION_CONFIDENCE)
    parser.add_argument("--tracking-confidence", type=float, default=DEFAULT_TRACKING_CONFIDENCE)
    parser.add_argument("--no-display", action="store_true", help="Ejecuta sin ventana de depuracion")
    return parser.parse_args()


def resolve_source(raw_source: str):
    return int(raw_source) if raw_source.isdigit() else raw_source


def capture_video(source):
    capture = cv2.VideoCapture(source)
    if not capture.isOpened():
        raise RuntimeError(f"No se pudo abrir la fuente de video: {source}")
    return capture


def main() -> None:
    args = parse_args()
    detector = PoseDetector(
        DetectorConfig(
            backend=args.backend,
            max_people=args.max_people,
            shoulder_threshold=args.shoulder_threshold,
            detection_confidence=args.detection_confidence,
            tracking_confidence=args.tracking_confidence,
        )
    )

    source = resolve_source(args.source)
    capture = capture_video(source)
    output_path = Path(args.output)
    frames_payload = []
    frame_number = 0

    try:
        while frame_number < args.max_frames:
            ok, frame = capture.read()
            if not ok:
                break

            annotated_frame, people = detector.process_frame(frame, timestamp_ms=frame_number * 33)
            frame_payload = build_frame_payload(frame_number, people)
            frames_payload.append(frame_payload)

            if not args.no_display:
                draw_frame_debug(annotated_frame, people, detector.backend)
                cv2.imshow(WINDOW_NAME, annotated_frame)
                key = cv2.waitKey(1) & 0xFF
                if key in (27, ord("q")):
                    break

            frame_number += 1
    finally:
        capture.release()
        cv2.destroyAllWindows()

    export_json(frames_payload, output_path)
    print(f"Frames procesados: {frame_number}")
    print(f"Backend activo: {detector.backend}")
    print(f"JSON generado en: {output_path.resolve()}")


if __name__ == "__main__":
    main()
