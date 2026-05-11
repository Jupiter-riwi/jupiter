"""
Test de integración: carga fixtures realistas y verifica que el prompt se construye correctamente.

Los fixtures incluyen expected_overall_range para validar que el LLM produce
scores dentro del rango esperado cuando se pruebe con GPT-4o real.
"""

import json
from pathlib import Path

import pytest

from scoring.llm import build_prompt, load_prompt
from scoring.models import ScoreResult

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> dict:
    path = FIXTURES_DIR / name
    assert path.exists(), f"Fixture no encontrado: {path}"
    return json.loads(path.read_text(encoding="utf-8"))


class TestFixturesLoad:
    def test_all_fixtures_exist(self):
        fixtures = list(FIXTURES_DIR.glob("*.json"))
        assert len(fixtures) >= 3, f"Se esperaban al menos 3 fixtures, hay {len(fixtures)}"

    def test_vendedor_solido_has_all_sections(self):
        data = load_fixture("vendedor_solido.json")
        assert "pose" in data
        assert "transcript" in data
        assert "prosody" in data
        assert "expected_overall_range" in data

    def test_vendedor_nervioso_has_all_sections(self):
        data = load_fixture("vendedor_nervioso.json")
        assert "pose" in data
        assert "transcript" in data
        assert "prosody" in data

    def test_vendedor_monotono_has_all_sections(self):
        data = load_fixture("vendedor_monotono.json")
        assert "pose" in data
        assert "transcript" in data
        assert "prosody" in data


class TestPromptWithFixtures:
    def test_build_prompt_from_vendedor_solido(self):
        data = load_fixture("vendedor_solido.json")
        prompt = build_prompt(
            pose_features=data["pose"],
            transcript_features=data["transcript"],
            prosody_features=data["prosody"],
        )
        assert "{{pose_features}}" not in prompt
        assert "{{transcript_features}}" not in prompt
        assert "{{prosody_features}}" not in prompt
        assert "posture_openness" in prompt
        assert "words_per_minute" in prompt
        assert "Muy buenos días" in prompt
        assert len(prompt) > 500

    def test_build_prompt_from_vendedor_nervioso(self):
        data = load_fixture("vendedor_nervioso.json")
        prompt = build_prompt(
            pose_features=data["pose"],
            transcript_features=data["transcript"],
            prosody_features=data["prosody"],
        )
        assert "filler_words" in prompt
        assert "vendedor_nervioso" not in prompt

    def test_build_prompt_from_vendedor_monotono(self):
        data = load_fixture("vendedor_monotono.json")
        prompt = build_prompt(
            pose_features=data["pose"],
            transcript_features=data["transcript"],
            prosody_features=data["prosody"],
        )
        assert "pitch" in prompt
        assert "variance" in prompt


class TestFixturePayloadsValidForScoreResult:
    def test_vendedor_solido_prosody_valid(self):
        data = load_fixture("vendedor_solido.json")
        prosody = data["prosody"]
        assert "pitch" in prosody
        assert "median" in prosody["pitch"]
        assert "variance" in prosody["pitch"]
        assert "energy" in prosody
        assert "words_per_minute" in prosody
        assert prosody["words_per_minute"] > 0
