import logging
import tempfile
import os
from typing import Optional
from dataclasses import dataclass, asdict

import numpy as np
import librosa

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Output model
# ---------------------------------------------------------------------------

@dataclass
class ProsodyFeatures:
    pitch_median: float
    pitch_variance: float
    energy_median: float
    energy_peak: float
    words_per_minute: float
    pause_ratio: float
    filler_word_count: int
    filler_words: list[str]
    duration_seconds: float
    transcript_word_count: int
    sample_rate: int

    def to_dict(self) -> dict:
        return {
            "pitch": {
                "median": round(self.pitch_median, 2),
                "variance": round(self.pitch_variance, 2),
            },
            "energy": {
                "median": round(self.energy_median, 4),
                "peak": round(self.energy_peak, 4),
            },
            "words_per_minute": round(self.words_per_minute, 1),
            "pause_ratio": round(self.pause_ratio, 3),
            "filler_words": {
                "count": self.filler_word_count,
                "words": self.filler_words,
            },
            "duration_seconds": round(self.duration_seconds, 2),
            "transcript_word_count": self.transcript_word_count,
            "sample_rate": self.sample_rate,
        }


# ---------------------------------------------------------------------------
# Filler word detection (Spanish + English)
# ---------------------------------------------------------------------------

FILLER_WORDS = {
    "es": {"eh", "este", "mmm", "ah", "bueno", "pues", "entonces", "digamos",
           "o sea", "como que", "realmente", "básicamente", "sabes"},
    "en": {"um", "uh", "like", "you know", "i mean", "so", "actually",
           "basically", "right", "well", "hmm", "er"},
}


def detect_filler_words(transcript: str, lang: str = "es") -> list[str]:
    words_lower = transcript.lower().split()
    fillers = FILLER_WORDS.get(lang, FILLER_WORDS["es"])

    found: list[str] = []
    for word in words_lower:
        if word in fillers:
            found.append(word)

    for phrase in fillers:
        if " " in phrase and phrase in transcript.lower():
            count = transcript.lower().count(phrase)
            found.extend([phrase] * count)

    return found


# ---------------------------------------------------------------------------
# Core analysis
# ---------------------------------------------------------------------------

def analyze_audio(
    audio_path: str,
    transcript: Optional[str] = None,
    lang: str = "es",
) -> ProsodyFeatures:
    logger.info("Cargando audio desde %s", audio_path)
    y, sr = librosa.load(audio_path, sr=None)

    duration = librosa.get_duration(y=y, sr=sr)
    logger.info("Audio cargado: %.2f s, sr=%d Hz", duration, sr)

    # --- Pitch (F0) using librosa.pyin ---
    f0, voiced_flag, _ = librosa.pyin(
        y,
        fmin=librosa.note_to_hz("C2"),
        fmax=librosa.note_to_hz("C7"),
        sr=sr,
    )
    f0_valid = f0[voiced_flag] if voiced_flag is not None else f0[~np.isnan(f0)]
    pitch_median = float(np.median(f0_valid)) if len(f0_valid) > 0 else 0.0
    pitch_variance = float(np.var(f0_valid)) if len(f0_valid) > 0 else 0.0

    # --- Energy (RMS) ---
    rms = librosa.feature.rms(y=y)[0]
    energy_median = float(np.median(rms))
    energy_peak = float(np.max(rms))

    # --- Pause detection (silence > 500ms) ---
    hop_length = 512
    non_silent = librosa.effects.split(y, top_db=30, hop_length=hop_length)
    silent_duration = 0.0
    last_end = 0.0
    for start, end in non_silent:
        gap = (start * hop_length) / sr - last_end
        if gap > 0.5:
            silent_duration += gap
        last_end = (end * hop_length) / sr
    pause_ratio = silent_duration / duration if duration > 0 else 0.0

    # --- Words per minute & filler detection (requires transcript) ---
    word_count = 0
    wpm = 0.0
    filler_words: list[str] = []

    if transcript:
        words = transcript.split()
        word_count = len(words)
        wpm = (word_count / duration) * 60 if duration > 0 else 0.0
        filler_words = detect_filler_words(transcript, lang)

    result = ProsodyFeatures(
        pitch_median=pitch_median,
        pitch_variance=pitch_variance,
        energy_median=energy_median,
        energy_peak=energy_peak,
        words_per_minute=wpm,
        pause_ratio=pause_ratio,
        filler_word_count=len(filler_words),
        filler_words=filler_words,
        duration_seconds=duration,
        transcript_word_count=word_count,
        sample_rate=sr,
    )

    logger.info("Análisis prosódico completado: wpm=%.1f, pauses=%.3f, fillers=%d",
                wpm, pause_ratio, len(filler_words))
    return result
