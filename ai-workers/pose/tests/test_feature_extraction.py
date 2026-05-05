from __future__ import annotations

from pose_worker.feature_extraction import FrameSignal, PoseFeatureExtractor


def _signal(*, hand_motion: float = 0.0, opening: float = 0.2) -> FrameSignal:
    return FrameSignal(
        posture_opening=opening,
        shoulder_tilt_deg=2.0,
        torso_tilt_deg=1.0,
        hand_motion=hand_motion,
        hand_amplitude=0.3,
        eye_contact=0.8,
        head_yaw=0.05,
        head_pitch=-0.6,
        landmarks_vector=[0.5, 0.2, 0.4, 0.4, 0.6, 0.4, 0.45, 0.7, 0.55, 0.7, 0.5, 0.45],
    )


def test_builds_segments_by_seconds() -> None:
    extractor = PoseFeatureExtractor(
        segment_seconds=2,
        fps=10.0,
        shoulder_open_threshold=0.16,
        hand_motion_threshold=0.08,
    )

    for frame_idx in range(25):
        extractor.add_frame(frame_idx, _signal(opening=0.22))

    payload = extractor.build_payload(
        {
            "fps": 10.0,
            "frame_count": 25,
            "processed_frames": 25,
            "duration_seconds": 2.5,
            "width": 1280,
            "height": 720,
        }
    )

    assert payload["summary"]["segments_count"] == 2
    assert payload["segments"][0]["frames_total"] == 20
    assert payload["segments"][1]["frames_total"] == 5
    assert payload["segments"][0]["posture"]["clasificacion"] == "open"


def test_segment_without_detection_is_unknown() -> None:
    extractor = PoseFeatureExtractor(
        segment_seconds=1,
        fps=10.0,
        shoulder_open_threshold=0.16,
        hand_motion_threshold=0.08,
    )

    for frame_idx in range(10):
        extractor.add_frame(frame_idx, None)

    payload = extractor.build_payload(
        {
            "fps": 10.0,
            "frame_count": 10,
            "processed_frames": 10,
            "duration_seconds": 1.0,
            "width": 640,
            "height": 480,
        }
    )

    assert payload["segments"][0]["posture"]["clasificacion"] == "unknown"
    assert payload["segments"][0]["frames_detected"] == 0
    assert payload["summary"]["detection_ratio"] == 0.0


def test_gesture_frequency_uses_motion_transitions() -> None:
    extractor = PoseFeatureExtractor(
        segment_seconds=1,
        fps=10.0,
        shoulder_open_threshold=0.16,
        hand_motion_threshold=0.1,
    )

    motions = [0.0, 0.2, 0.2, 0.0, 0.3, 0.0, 0.2, 0.0, 0.0, 0.0]
    for frame_idx, motion in enumerate(motions):
        extractor.add_frame(frame_idx, _signal(hand_motion=motion))

    payload = extractor.build_payload(
        {
            "fps": 10.0,
            "frame_count": 10,
            "processed_frames": 10,
            "duration_seconds": 1.0,
            "width": 640,
            "height": 480,
        }
    )

    frecuencia = payload["segments"][0]["hand_gestures"]["frecuencia_hz"]
    assert frecuencia == 3.0
