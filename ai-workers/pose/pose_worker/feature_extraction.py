from __future__ import annotations

from dataclasses import dataclass, field
from statistics import pstdev
from typing import Any


def _mean(values: list[float]) -> float:
    if not values:
        return 0.0
    return float(sum(values) / len(values))


def _std(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    return float(pstdev(values))


def _count_motion_events(motions: list[float], threshold: float) -> int:
    events = 0
    was_active = False
    for value in motions:
        is_active = value > threshold
        if is_active and not was_active:
            events += 1
        was_active = is_active
    return events


@dataclass(frozen=True)
class FrameSignal:
    posture_opening: float
    shoulder_tilt_deg: float
    torso_tilt_deg: float
    hand_motion: float
    hand_amplitude: float
    eye_contact: float
    head_yaw: float
    head_pitch: float
    landmarks_vector: list[float]


@dataclass
class SegmentAccumulator:
    index: int
    start_sec: float
    end_sec: float
    frames_total: int = 0
    frames_detected: int = 0
    posture_openings: list[float] = field(default_factory=list)
    shoulder_tilts: list[float] = field(default_factory=list)
    torso_tilts: list[float] = field(default_factory=list)
    hand_motions: list[float] = field(default_factory=list)
    hand_amplitudes: list[float] = field(default_factory=list)
    eye_contacts: list[float] = field(default_factory=list)
    head_yaws: list[float] = field(default_factory=list)
    head_pitches: list[float] = field(default_factory=list)
    landmarks_vectors: list[list[float]] = field(default_factory=list)


class PoseFeatureExtractor:
    def __init__(
        self,
        *,
        segment_seconds: int,
        fps: float,
        shoulder_open_threshold: float,
        hand_motion_threshold: float,
    ) -> None:
        self.segment_seconds = max(1, segment_seconds)
        self.fps = max(1.0, fps)
        self.shoulder_open_threshold = shoulder_open_threshold
        self.hand_motion_threshold = hand_motion_threshold
        self._segments: dict[int, SegmentAccumulator] = {}

    def add_frame(self, frame_index: int, signal: FrameSignal | None) -> None:
        second = frame_index / self.fps
        segment_index = int(second // self.segment_seconds)
        start_sec = float(segment_index * self.segment_seconds)
        end_sec = float((segment_index + 1) * self.segment_seconds)

        segment = self._segments.get(segment_index)
        if segment is None:
            segment = SegmentAccumulator(
                index=segment_index,
                start_sec=start_sec,
                end_sec=end_sec,
            )
            self._segments[segment_index] = segment

        segment.frames_total += 1

        if signal is None:
            return

        segment.frames_detected += 1
        segment.posture_openings.append(signal.posture_opening)
        segment.shoulder_tilts.append(signal.shoulder_tilt_deg)
        segment.torso_tilts.append(signal.torso_tilt_deg)
        segment.hand_motions.append(signal.hand_motion)
        segment.hand_amplitudes.append(signal.hand_amplitude)
        segment.eye_contacts.append(signal.eye_contact)
        segment.head_yaws.append(signal.head_yaw)
        segment.head_pitches.append(signal.head_pitch)
        segment.landmarks_vectors.append(signal.landmarks_vector)

    def build_payload(self, video_meta: dict[str, Any]) -> dict[str, Any]:
        duration_seconds = float(video_meta["duration_seconds"])
        segments = [
            self._build_segment_payload(
                self._segments[index],
                duration_seconds=duration_seconds,
            )
            for index in sorted(self._segments.keys())
        ]

        detected_total = sum(item["frames_detected"] for item in segments)
        frames_total = sum(item["frames_total"] for item in segments)
        open_weight = sum(
            item["posture"]["open_ratio"] * item["frames_detected"] for item in segments
        )

        if detected_total == 0:
            dominant_posture = "unknown"
        else:
            dominant_posture = "open" if (open_weight / detected_total) >= 0.5 else "closed"

        summary = {
            "segments_count": len(segments),
            "frames_total": frames_total,
            "frames_detected": detected_total,
            "detection_ratio": round((detected_total / frames_total), 4) if frames_total else 0.0,
            "postura_dominante": dominant_posture,
            "contacto_visual_promedio": round(
                _mean([item["eye_contact_estimate"]["ratio"] for item in segments]),
                4,
            ),
            "gestos_frecuencia_promedio_hz": round(
                _mean([item["hand_gestures"]["frecuencia_hz"] for item in segments]),
                4,
            ),
            "variabilidad_global": round(
                _mean([item["pose_variability"]["score"] for item in segments]),
                4,
            ),
        }

        return {
            "schema_version": "1.0.0",
            "kind": "pose",
            "segment_seconds": self.segment_seconds,
            "video": {
                "fps": round(float(video_meta["fps"]), 4),
                "frame_count": int(video_meta["frame_count"]),
                "processed_frames": int(video_meta["processed_frames"]),
                "duration_seconds": round(duration_seconds, 4),
                "width": int(video_meta["width"]),
                "height": int(video_meta["height"]),
            },
            "segments": segments,
            "summary": summary,
        }

    def _build_segment_payload(
        self,
        segment: SegmentAccumulator,
        *,
        duration_seconds: float,
    ) -> dict[str, Any]:
        start_sec = segment.start_sec
        end_sec = min(segment.end_sec, duration_seconds)
        span_seconds = max(end_sec - start_sec, 1.0 / self.fps)

        if segment.frames_detected == 0:
            return {
                "index": segment.index,
                "start_sec": round(start_sec, 4),
                "end_sec": round(end_sec, 4),
                "frames_total": segment.frames_total,
                "frames_detected": 0,
                "detection_ratio": 0.0,
                "posture": {
                    "clasificacion": "unknown",
                    "apertura_media": 0.0,
                    "apertura_std": 0.0,
                    "open_ratio": 0.0,
                    "inclinacion_hombros_media_deg": 0.0,
                    "inclinacion_torso_media_deg": 0.0,
                },
                "hand_gestures": {
                    "frecuencia_hz": 0.0,
                    "amplitud_media": 0.0,
                    "amplitud_max": 0.0,
                    "energia_movimiento": 0.0,
                },
                "eye_contact_estimate": {
                    "ratio": 0.0,
                    "yaw_medio": 0.0,
                    "pitch_medio": 0.0,
                },
                "pose_variability": {
                    "score": 0.0,
                    "landmark_std": 0.0,
                },
            }

        open_ratio = sum(
            1.0 for value in segment.posture_openings if value >= self.shoulder_open_threshold
        ) / segment.frames_detected

        posture_class = "open" if open_ratio >= 0.5 else "closed"
        gesture_events = _count_motion_events(segment.hand_motions, self.hand_motion_threshold)

        coordinate_stds = self._coordinate_stds(segment.landmarks_vectors)
        landmark_std = _mean(coordinate_stds)
        variability_score = min(1.0, landmark_std / 0.12)

        return {
            "index": segment.index,
            "start_sec": round(start_sec, 4),
            "end_sec": round(end_sec, 4),
            "frames_total": segment.frames_total,
            "frames_detected": segment.frames_detected,
            "detection_ratio": round((segment.frames_detected / segment.frames_total), 4)
            if segment.frames_total
            else 0.0,
            "posture": {
                "clasificacion": posture_class,
                "apertura_media": round(_mean(segment.posture_openings), 6),
                "apertura_std": round(_std(segment.posture_openings), 6),
                "open_ratio": round(open_ratio, 6),
                "inclinacion_hombros_media_deg": round(_mean(segment.shoulder_tilts), 6),
                "inclinacion_torso_media_deg": round(_mean(segment.torso_tilts), 6),
            },
            "hand_gestures": {
                "frecuencia_hz": round((gesture_events / span_seconds), 6),
                "amplitud_media": round(_mean(segment.hand_amplitudes), 6),
                "amplitud_max": round(max(segment.hand_amplitudes), 6),
                "energia_movimiento": round(sum(segment.hand_motions), 6),
            },
            "eye_contact_estimate": {
                "ratio": round(_mean(segment.eye_contacts), 6),
                "yaw_medio": round(_mean(segment.head_yaws), 6),
                "pitch_medio": round(_mean(segment.head_pitches), 6),
            },
            "pose_variability": {
                "score": round(variability_score, 6),
                "landmark_std": round(landmark_std, 6),
            },
        }

    @staticmethod
    def _coordinate_stds(vectors: list[list[float]]) -> list[float]:
        if not vectors:
            return []
        coordinates = list(zip(*vectors, strict=False))
        return [_std(list(values)) for values in coordinates]
