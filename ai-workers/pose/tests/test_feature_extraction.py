from __future__ import annotations

from pose_worker.feature_extraction import FrameSignal, PoseFeatureExtractor


def _signal(
    *,
    left_motion: float = 0.0,
    right_motion: float = 0.0,
    posture_open: float = 0.2,
    face: bool = True,
) -> FrameSignal:
    return FrameSignal(
        posture_open=posture_open,
        slouch=0.0,
        lean_deg=1.0,
        shoulder_tilt_deg=2.0,
        arms_crossed=0.0,
        head_yaw_deg=5.0,
        head_pitch_deg=-4.0,
        looking_at_camera=1.0,
        left_hand_motion=left_motion,
        right_hand_motion=right_motion,
        gesture_amplitude=0.3,
        hands_visible=2.0,
        face_detected=1.0 if face else 0.0,
        smile=0.4,
        brow_raise=0.1,
        eye_open=0.9,
        jaw_open=0.2,
        expressiveness=0.5,
        landmarks_vector=[0.5, 0.2, 0.4, 0.4, 0.6, 0.4, 0.45, 0.7, 0.55, 0.7, 0.5, 0.45, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    )


def _extractor(segment_seconds: int = 2, fps: float = 10.0, hand_threshold: float = 0.08) -> PoseFeatureExtractor:
    return PoseFeatureExtractor(
        segment_seconds=segment_seconds,
        fps=fps,
        shoulder_open_threshold=0.16,
        hand_motion_threshold=hand_threshold,
    )


def test_builds_segments_by_seconds() -> None:
    fps = 10.0
    extractor = _extractor(segment_seconds=2, fps=fps)
    for frame_idx in range(25):
        extractor.add_frame(frame_idx / fps, _signal(posture_open=0.22))

    payload = extractor.build_payload(
        {"fps": fps, "analysis_fps": fps, "frame_count": 25, "processed_frames": 25, "duration_seconds": 2.5, "width": 1280, "height": 720}
    )

    assert payload["schema_version"] == "2.0.0"
    assert payload["summary"]["segments_count"] == 2
    assert payload["segments"][0]["frames_total"] == 20
    assert payload["segments"][1]["frames_total"] == 5
    assert payload["segments"][0]["posture"]["clasificacion"] == "open"
    # expression + new posture metrics present
    assert "expression" in payload["segments"][0]
    assert "slouch_ratio" in payload["segments"][0]["posture"]
    assert payload["summary"]["sonrisa_promedio"] > 0.0


def test_segment_without_detection_is_unknown() -> None:
    fps = 10.0
    extractor = _extractor(segment_seconds=1, fps=fps)
    for frame_idx in range(10):
        extractor.add_frame(frame_idx / fps, None)

    payload = extractor.build_payload(
        {"fps": fps, "analysis_fps": fps, "frame_count": 10, "processed_frames": 10, "duration_seconds": 1.0, "width": 640, "height": 480}
    )

    assert payload["segments"][0]["posture"]["clasificacion"] == "unknown"
    assert payload["segments"][0]["frames_detected"] == 0
    assert payload["summary"]["detection_ratio"] == 0.0


def test_gesture_frequency_counts_both_hands() -> None:
    fps = 10.0
    extractor = _extractor(segment_seconds=1, fps=fps, hand_threshold=0.1)
    # right hand: 3 rising edges over the threshold
    motions = [0.0, 0.2, 0.2, 0.0, 0.3, 0.0, 0.2, 0.0, 0.0, 0.0]
    for frame_idx, motion in enumerate(motions):
        extractor.add_frame(frame_idx / fps, _signal(right_motion=motion))

    payload = extractor.build_payload(
        {"fps": fps, "analysis_fps": fps, "frame_count": 10, "processed_frames": 10, "duration_seconds": 1.0, "width": 640, "height": 480}
    )

    assert payload["segments"][0]["hand_gestures"]["frecuencia_hz"] == 3.0
