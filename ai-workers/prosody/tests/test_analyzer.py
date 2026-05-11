import os
import json
import tempfile

import numpy as np
import soundfile as sf
import pytest

from prosody.analyzer import (
    analyze_audio,
    detect_filler_words,
    ProsodyFeatures,
    FILLER_WORDS,
)


# ---------------------------------------------------------------------------
# Helpers: generate synthetic audio for tests
# ---------------------------------------------------------------------------

def generate_sine_audio(
    path: str,
    frequency: float = 440.0,
    duration: float = 3.0,
    sample_rate: int = 22050,
    amplitude: float = 0.5,
) -> None:
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    audio = amplitude * np.sin(2 * np.pi * frequency * t)
    sf.write(path, audio, sample_rate)


def generate_silence(path: str, duration: float = 3.0, sample_rate: int = 22050) -> None:
    audio = np.zeros(int(sample_rate * duration))
    sf.write(path, audio, sample_rate)


def generate_speech_like_audio(
    path: str,
    duration: float = 5.0,
    sample_rate: int = 22050,
) -> None:
    total_samples = int(sample_rate * duration)
    audio = np.zeros(total_samples)

    segment_length = int(sample_rate * 0.3)
    gap_length = int(sample_rate * 0.7)

    pos = 0
    frequencies = [200, 300, 400, 250, 350]
    for freq in frequencies:
        if pos + segment_length > total_samples:
            break
        t = np.linspace(0, 0.3, segment_length, endpoint=False)
        audio[pos:pos + segment_length] = 0.3 * np.sin(2 * np.pi * freq * t)

        gap_start = pos + segment_length
        gap_end = min(gap_start + gap_length, total_samples)
        pos = gap_end

    sf.write(path, audio, sample_rate)


# ---------------------------------------------------------------------------
# Tests: filler word detection
# ---------------------------------------------------------------------------

class TestFillerWords:
    def test_detect_spanish_fillers(self):
        transcript = "Este es un producto, eh, que realmente, mmm, soluciona todo"
        found = detect_filler_words(transcript, lang="es")
        assert "este" in found
        assert "eh" in found
        assert "realmente" in found
        assert "mmm" in found

    def test_detect_english_fillers(self):
        transcript = "Um, I think like, you know, basically it works"
        found = detect_filler_words(transcript, lang="en")
        assert "um" in found
        assert "like" in found
        assert "basically" in found

    def test_no_fillers_returns_empty(self):
        transcript = "El producto tiene excelentes características técnicas"
        found = detect_filler_words(transcript, lang="es")
        assert found == []

    def test_multi_word_fillers(self):
        transcript = "o sea que digamos no es así como que sí"
        found = detect_filler_words(transcript, lang="es")
        assert "o sea" in found
        assert "digamos" in found
        assert "como que" in found


# ---------------------------------------------------------------------------
# Tests: prosody analysis
# ---------------------------------------------------------------------------

class TestAnalyzeAudio:
    def test_analyze_short_sine(self):
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            path = f.name
        try:
            generate_sine_audio(path, duration=3.0)
            result = analyze_audio(path)
            assert isinstance(result, ProsodyFeatures)
            assert 2.5 < result.duration_seconds < 3.5
            assert result.words_per_minute == 0.0
            assert result.transcript_word_count == 0
        finally:
            os.unlink(path)

    def test_analyze_with_transcript(self):
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            path = f.name
        try:
            generate_sine_audio(path, duration=3.0)
            transcript = "bueno vamos a ver este producto"
            result = analyze_audio(path, transcript=transcript)
            assert result.transcript_word_count == 6
            assert result.words_per_minute > 0
            assert result.filler_word_count >= 2
        finally:
            os.unlink(path)

    def test_analyze_silence(self):
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            path = f.name
        try:
            generate_silence(path, duration=3.0)
            result = analyze_audio(path)
            assert isinstance(result, ProsodyFeatures)
            assert result.energy_peak < 0.001
        finally:
            os.unlink(path)

    def test_analyze_speech_like_expects_pause_ratio(self):
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            path = f.name
        try:
            generate_speech_like_audio(path, duration=5.0)
            result = analyze_audio(path)
            assert result.pause_ratio > 0
        finally:
            os.unlink(path)


# ---------------------------------------------------------------------------
# Tests: output contract
# ---------------------------------------------------------------------------

class TestOutputContract:
    def test_to_dict_has_required_keys(self):
        features = ProsodyFeatures(
            pitch_median=200.5,
            pitch_variance=50.2,
            energy_median=0.01,
            energy_peak=0.5,
            words_per_minute=120.0,
            pause_ratio=0.1,
            filler_word_count=3,
            filler_words=["eh", "mmm", "este"],
            duration_seconds=60.0,
            transcript_word_count=150,
            sample_rate=22050,
        )
        d = features.to_dict()
        assert "pitch" in d
        assert "median" in d["pitch"]
        assert "variance" in d["pitch"]
        assert "energy" in d
        assert "median" in d["energy"]
        assert "peak" in d["energy"]
        assert d["words_per_minute"] == 120.0
        assert "pause_ratio" in d
        assert "filler_words" in d
        assert d["filler_words"]["count"] == 3
        assert len(d["filler_words"]["words"]) == 3

    def test_to_dict_is_json_serializable(self):
        features = ProsodyFeatures(
            pitch_median=200.5, pitch_variance=50.2,
            energy_median=0.01, energy_peak=0.5,
            words_per_minute=120.0, pause_ratio=0.1,
            filler_word_count=0, filler_words=[],
            duration_seconds=60.0, transcript_word_count=150,
            sample_rate=22050,
        )
        json.dumps(features.to_dict())


# ---------------------------------------------------------------------------
# Tests: file not found
# ---------------------------------------------------------------------------

class TestErrorHandling:
    def test_missing_file_raises(self):
        with pytest.raises(FileNotFoundError):
            analyze_audio("/tmp/nonexistent_audio_12345.wav")
