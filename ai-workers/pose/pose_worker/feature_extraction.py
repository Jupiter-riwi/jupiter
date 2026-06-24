from __future__ import annotations

from dataclasses import dataclass, field
from statistics import pstdev
from typing import Any


def _mean(values: list[float]) -> float:
    return float(sum(values) / len(values)) if values else 0.0


def _std(values: list[float]) -> float:
    return float(pstdev(values)) if len(values) >= 2 else 0.0


def _ratio(values: list[float]) -> float:
    """Mean of a list of 0/1 flags."""
    return _mean(values)


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
    # posture
    posture_open: float          # 0..~1 normalized openness (arm/elbow spread vs shoulders)
    slouch: float                # 0..1 (1 = head juts forward / shoulders hunched)
    lean_deg: float              # torso lean from vertical
    shoulder_tilt_deg: float
    arms_crossed: float          # 0/1
    # head / gaze
    head_yaw_deg: float
    head_pitch_deg: float
    looking_at_camera: float     # 0/1
    # gestures
    left_hand_motion: float
    right_hand_motion: float
    gesture_amplitude: float     # max wrist excursion from torso (per frame)
    hands_visible: float         # 0,1,2
    # facial expression (0 if no face)
    face_detected: float         # 0/1
    smile: float
    brow_raise: float
    eye_open: float
    jaw_open: float
    expressiveness: float
    landmarks_vector: list[float]


@dataclass
class SegmentAccumulator:
    index: int
    start_sec: float
    end_sec: float
    frames_total: int = 0
    frames_detected: int = 0
    posture_opens: list[float] = field(default_factory=list)
    slouches: list[float] = field(default_factory=list)
    leans: list[float] = field(default_factory=list)
    shoulder_tilts: list[float] = field(default_factory=list)
    arms_crossed: list[float] = field(default_factory=list)
    head_yaws: list[float] = field(default_factory=list)
    head_pitches: list[float] = field(default_factory=list)
    looking: list[float] = field(default_factory=list)
    left_motions: list[float] = field(default_factory=list)
    right_motions: list[float] = field(default_factory=list)
    gesture_amps: list[float] = field(default_factory=list)
    hands_visible: list[float] = field(default_factory=list)
    # face
    face_frames: int = 0
    smiles: list[float] = field(default_factory=list)
    brows: list[float] = field(default_factory=list)
    eye_opens: list[float] = field(default_factory=list)
    jaw_opens: list[float] = field(default_factory=list)
    expressives: list[float] = field(default_factory=list)
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
        self.open_threshold = shoulder_open_threshold
        self.hand_motion_threshold = hand_motion_threshold
        self._segments: dict[int, SegmentAccumulator] = {}

    def add_frame(self, second: float, signal: FrameSignal | None) -> None:
        segment_index = int(second // self.segment_seconds)
        seg = self._segments.get(segment_index)
        if seg is None:
            seg = SegmentAccumulator(
                index=segment_index,
                start_sec=float(segment_index * self.segment_seconds),
                end_sec=float((segment_index + 1) * self.segment_seconds),
            )
            self._segments[segment_index] = seg

        seg.frames_total += 1
        if signal is None:
            return

        seg.frames_detected += 1
        seg.posture_opens.append(signal.posture_open)
        seg.slouches.append(signal.slouch)
        seg.leans.append(signal.lean_deg)
        seg.shoulder_tilts.append(signal.shoulder_tilt_deg)
        seg.arms_crossed.append(signal.arms_crossed)
        seg.head_yaws.append(signal.head_yaw_deg)
        seg.head_pitches.append(signal.head_pitch_deg)
        seg.looking.append(signal.looking_at_camera)
        seg.left_motions.append(signal.left_hand_motion)
        seg.right_motions.append(signal.right_hand_motion)
        seg.gesture_amps.append(signal.gesture_amplitude)
        seg.hands_visible.append(signal.hands_visible)
        seg.landmarks_vectors.append(signal.landmarks_vector)
        if signal.face_detected >= 0.5:
            seg.face_frames += 1
            seg.smiles.append(signal.smile)
            seg.brows.append(signal.brow_raise)
            seg.eye_opens.append(signal.eye_open)
            seg.jaw_opens.append(signal.jaw_open)
            seg.expressives.append(signal.expressiveness)

    def build_payload(self, video_meta: dict[str, Any]) -> dict[str, Any]:
        duration_seconds = float(video_meta["duration_seconds"])
        segments = [
            self._build_segment_payload(self._segments[i], duration_seconds=duration_seconds)
            for i in sorted(self._segments.keys())
        ]

        detected = sum(s["frames_detected"] for s in segments)
        frames_total = sum(s["frames_total"] for s in segments)

        def w(path_a: str, path_b: str) -> float:
            # frames_detected-weighted mean of a nested metric
            num = sum(s[path_a][path_b] * s["frames_detected"] for s in segments)
            return round(num / detected, 4) if detected else 0.0

        open_weight = sum(s["posture"]["open_ratio"] * s["frames_detected"] for s in segments)
        dominant = "unknown" if detected == 0 else ("open" if (open_weight / detected) >= 0.5 else "closed")

        summary = {
            "segments_count": len(segments),
            "frames_total": frames_total,
            "frames_detected": detected,
            "detection_ratio": round(detected / frames_total, 4) if frames_total else 0.0,
            "postura_dominante": dominant,
            # posture
            "apertura_promedio": w("posture", "apertura_media"),
            "slouch_ratio": w("posture", "slouch_ratio"),
            "lean_promedio_deg": w("posture", "lean_media_deg"),
            "brazos_cruzados_ratio": w("posture", "arms_crossed_ratio"),
            # gaze / eye contact
            "contacto_visual_promedio": w("eye_contact_estimate", "looking_ratio"),
            "estabilidad_cabeza": w("eye_contact_estimate", "head_stability"),
            # gestures
            "gestos_frecuencia_promedio_hz": w("hand_gestures", "frecuencia_hz"),
            "gestos_amplitud_promedio": w("hand_gestures", "amplitud_media"),
            "gestos_dos_manos_ratio": w("hand_gestures", "two_handed_ratio"),
            # expression
            "sonrisa_promedio": w("expression", "smile_ratio"),
            "expresividad_promedio": w("expression", "expresividad_media"),
            "habla_ratio": w("expression", "talking_ratio"),
            "variabilidad_global": w("pose_variability", "score"),
        }

        return {
            "schema_version": "2.0.0",
            "kind": "pose",
            "segment_seconds": self.segment_seconds,
            "video": {
                "fps": round(float(video_meta["fps"]), 4),
                "analysis_fps": round(float(video_meta.get("analysis_fps", video_meta["fps"])), 4),
                "frame_count": int(video_meta["frame_count"]),
                "processed_frames": int(video_meta["processed_frames"]),
                "duration_seconds": round(duration_seconds, 4),
                "width": int(video_meta["width"]),
                "height": int(video_meta["height"]),
            },
            "segments": segments,
            "summary": summary,
        }

    def _build_segment_payload(self, seg: SegmentAccumulator, *, duration_seconds: float) -> dict[str, Any]:
        start_sec = seg.start_sec
        end_sec = min(seg.end_sec, duration_seconds)
        span = max(end_sec - start_sec, 1.0 / self.fps)

        if seg.frames_detected == 0:
            return _empty_segment(seg, start_sec, end_sec)

        open_ratio = _ratio([1.0 if v >= self.open_threshold else 0.0 for v in seg.posture_opens])
        posture_class = "open" if open_ratio >= 0.5 else "closed"

        left_events = _count_motion_events(seg.left_motions, self.hand_motion_threshold)
        right_events = _count_motion_events(seg.right_motions, self.hand_motion_threshold)
        gesture_freq = (left_events + right_events) / span
        two_handed = _ratio([1.0 if v >= 2 else 0.0 for v in seg.hands_visible])

        yaw_std = _std(seg.head_yaws)
        head_stability = max(0.0, 1.0 - min(1.0, yaw_std / 25.0))  # 0=very shaky, 1=steady

        coord_stds = self._coordinate_stds(seg.landmarks_vectors)
        landmark_std = _mean(coord_stds)
        variability = min(1.0, landmark_std / 0.12)

        face_ok = seg.face_frames > 0
        return {
            "index": seg.index,
            "start_sec": round(start_sec, 4),
            "end_sec": round(end_sec, 4),
            "frames_total": seg.frames_total,
            "frames_detected": seg.frames_detected,
            "detection_ratio": round(seg.frames_detected / seg.frames_total, 4) if seg.frames_total else 0.0,
            "posture": {
                "clasificacion": posture_class,
                "apertura_media": round(_mean(seg.posture_opens), 4),
                "open_ratio": round(open_ratio, 4),
                "slouch_ratio": round(_ratio(seg.slouches), 4),
                "lean_media_deg": round(_mean(seg.leans), 4),
                "inclinacion_hombros_media_deg": round(_mean(seg.shoulder_tilts), 4),
                "arms_crossed_ratio": round(_ratio(seg.arms_crossed), 4),
            },
            "hand_gestures": {
                "frecuencia_hz": round(gesture_freq, 4),
                "amplitud_media": round(_mean(seg.gesture_amps), 4),
                "amplitud_max": round(max(seg.gesture_amps), 4),
                "energia_movimiento": round(sum(seg.left_motions) + sum(seg.right_motions), 4),
                "two_handed_ratio": round(two_handed, 4),
            },
            "eye_contact_estimate": {
                "looking_ratio": round(_ratio(seg.looking), 4),
                "yaw_medio_deg": round(_mean(seg.head_yaws), 4),
                "pitch_medio_deg": round(_mean(seg.head_pitches), 4),
                "head_stability": round(head_stability, 4),
            },
            "expression": {
                "face_detected_ratio": round(seg.face_frames / seg.frames_detected, 4),
                "smile_ratio": round(_mean(seg.smiles), 4) if face_ok else 0.0,
                "brow_media": round(_mean(seg.brows), 4) if face_ok else 0.0,
                "eye_open_media": round(_mean(seg.eye_opens), 4) if face_ok else 0.0,
                "talking_ratio": round(_ratio([1.0 if j > 0.15 else 0.0 for j in seg.jaw_opens]), 4) if face_ok else 0.0,
                "expresividad_media": round(_mean(seg.expressives), 4) if face_ok else 0.0,
            },
            "pose_variability": {
                "score": round(variability, 4),
                "landmark_std": round(landmark_std, 4),
            },
        }

    @staticmethod
    def _coordinate_stds(vectors: list[list[float]]) -> list[float]:
        if not vectors:
            return []
        # vectors may have varying length if some frames lacked hands; pad/truncate to min len
        min_len = min(len(v) for v in vectors)
        cols = list(zip(*[v[:min_len] for v in vectors], strict=False))
        return [_std(list(c)) for c in cols]


def _empty_segment(seg: SegmentAccumulator, start_sec: float, end_sec: float) -> dict[str, Any]:
    return {
        "index": seg.index,
        "start_sec": round(start_sec, 4),
        "end_sec": round(end_sec, 4),
        "frames_total": seg.frames_total,
        "frames_detected": 0,
        "detection_ratio": 0.0,
        "posture": {"clasificacion": "unknown", "apertura_media": 0.0, "open_ratio": 0.0, "slouch_ratio": 0.0, "lean_media_deg": 0.0, "inclinacion_hombros_media_deg": 0.0, "arms_crossed_ratio": 0.0},
        "hand_gestures": {"frecuencia_hz": 0.0, "amplitud_media": 0.0, "amplitud_max": 0.0, "energia_movimiento": 0.0, "two_handed_ratio": 0.0},
        "eye_contact_estimate": {"looking_ratio": 0.0, "yaw_medio_deg": 0.0, "pitch_medio_deg": 0.0, "head_stability": 0.0},
        "expression": {"face_detected_ratio": 0.0, "smile_ratio": 0.0, "brow_media": 0.0, "eye_open_media": 0.0, "talking_ratio": 0.0, "expresividad_media": 0.0},
        "pose_variability": {"score": 0.0, "landmark_std": 0.0},
    }
