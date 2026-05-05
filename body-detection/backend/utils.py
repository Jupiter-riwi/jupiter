import json
from pathlib import Path
from typing import Any

import cv2


def build_frame_payload(frame_number: int, people: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "frame": frame_number,
        "people": people,
    }


def export_json(payload: list[dict[str, Any]], output_path: Path) -> None:
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def draw_person_debug(frame, person: dict[str, Any]) -> None:
    left = tuple(person["shoulder_left"])
    right = tuple(person["shoulder_right"])
    color = (0, 200, 0) if person["posture"] == "open" else (0, 0, 255)

    cv2.circle(frame, left, 6, color, -1)
    cv2.circle(frame, right, 6, color, -1)
    cv2.line(frame, left, right, color, 2)

    anchor_x = min(left[0], right[0])
    anchor_y = max(min(left[1], right[1]) - 10, 20)
    cv2.putText(
        frame,
        f"P{person['id']}: {person['posture']} | move {person.get('movement_px', 0.0):.2f}px",
        (anchor_x, anchor_y),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        color,
        2,
        cv2.LINE_AA,
    )


def draw_frame_debug(frame, people: list[dict[str, Any]], backend: str) -> None:
    for person in people:
        draw_person_debug(frame, person)

    cv2.putText(
        frame,
        f"People: {len(people)} | Backend: {backend}",
        (10, 30),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )
