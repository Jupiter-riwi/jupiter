import json
import pytest

from scoring.models import ScoreResult, DimensionScore, Recommendation, ScoringJob
from scoring.llm import load_prompt, build_prompt, _score_result_json_schema


def rec(priority: str = "high", area: str = "ritmo_voz") -> dict:
    return {
        "priority": priority,
        "area": area,
        "problem": "WPM 185, por encima del rango recomendado.",
        "impact": "El prospecto puede perder partes clave del mensaje.",
        "tip": "Reduce velocidad y marca pausas entre ideas.",
        "drill": "Graba el mismo pitch 3 veces intentando llegar a 150 WPM.",
        "success_metric": "WPM entre 130 y 160 durante al menos 80% del pitch.",
    }


def recommendations() -> list[dict]:
    return [
        rec("high", "ritmo_voz"),
        rec("high", "escucha_activa"),
        rec("medium", "claridad"),
    ]


# ---------------------------------------------------------------------------
# Tests: Pydantic models
# ---------------------------------------------------------------------------

class TestModels:
    def test_score_result_valid(self):
        data = {
            "overall": 78,
            "dimensions": {
                "confianza": {"score": 82, "evidence": "postura erguida"},
                "claridad": {"score": 75, "evidence": "discurso estructurado"},
                "lenguaje_corporal": {"score": 70, "evidence": "gestos moderados"},
                "ritmo_voz": {"score": 80, "evidence": "WPM 140"},
                "escucha_activa": {"score": 65, "evidence": "pocas preguntas"},
            },
            "recommendations": recommendations(),
        }
        result = ScoreResult.model_validate(data)
        assert result.overall == 78
        assert result.dimensions["confianza"].score == 82
        assert len(result.recommendations) == 3
        assert result.recommendations[0].success_metric

    def test_score_result_missing_dimension_raises(self):
        data = {
            "overall": 78,
            "dimensions": {
                "confianza": {"score": 82, "evidence": "ok"},
            },
            "recommendations": recommendations(),
        }
        with pytest.raises(ValueError):
            ScoreResult.model_validate(data)

    def test_score_result_extra_dimension_raises(self):
        data = {
            "overall": 78,
            "dimensions": {
                "confianza": {"score": 82, "evidence": "ok"},
                "claridad": {"score": 75, "evidence": "ok"},
                "lenguaje_corporal": {"score": 70, "evidence": "ok"},
                "ritmo_voz": {"score": 80, "evidence": "ok"},
                "escucha_activa": {"score": 65, "evidence": "ok"},
                "extra": {"score": 50, "evidence": "no"},
            },
            "recommendations": recommendations(),
        }
        with pytest.raises(ValueError):
            ScoreResult.model_validate(data)

    def test_score_out_of_range_raises(self):
        data = {
            "overall": 150,
            "dimensions": {
                "confianza": {"score": 82, "evidence": "ok"},
                "claridad": {"score": 75, "evidence": "ok"},
                "lenguaje_corporal": {"score": 70, "evidence": "ok"},
                "ritmo_voz": {"score": 80, "evidence": "ok"},
                "escucha_activa": {"score": 65, "evidence": "ok"},
            },
            "recommendations": recommendations(),
        }
        with pytest.raises(ValueError):
            ScoreResult.model_validate(data)

    def test_invalid_priority_raises(self):
        data = {
            "overall": 78,
            "dimensions": {
                "confianza": {"score": 82, "evidence": "ok"},
                "claridad": {"score": 75, "evidence": "ok"},
                "lenguaje_corporal": {"score": 70, "evidence": "ok"},
                "ritmo_voz": {"score": 80, "evidence": "ok"},
                "escucha_activa": {"score": 65, "evidence": "ok"},
            },
            "recommendations": [
                rec("urgent"),
                rec("medium", "claridad"),
                rec("low", "confianza"),
            ],
        }
        with pytest.raises(ValueError):
            ScoreResult.model_validate(data)

    def test_scoring_job_model(self):
        data = {
            "job_id": "uuid-123",
            "evaluation_id": "eval-456",
            "tenant_id": "tenant-789",
        }
        job = ScoringJob.model_validate(data)
        assert job.job_id == "uuid-123"
        assert job.evaluation_id == "eval-456"

    def test_dimension_score_range(self):
        DimensionScore(score=0, evidence="min")
        DimensionScore(score=100, evidence="max")
        with pytest.raises(ValueError):
            DimensionScore(score=-1, evidence="neg")
        with pytest.raises(ValueError):
            DimensionScore(score=101, evidence="over")


# ---------------------------------------------------------------------------
# Tests: prompt loading and building
# ---------------------------------------------------------------------------

class TestPrompt:
    def test_load_prompt_v1_exists(self):
        prompt = load_prompt("v1")
        assert "coach de ventas" in prompt
        assert "{{pose_features}}" in prompt
        assert "confianza" in prompt.lower()

    def test_load_prompt_v2_is_default_contract(self):
        prompt = load_prompt("v2")
        assert "Scoring y Coaching" in prompt
        assert "success_metric" in prompt
        assert "no insultes" in prompt

    def test_load_prompt_nonexistent_raises(self):
        with pytest.raises(FileNotFoundError):
            load_prompt("v999")

    def test_build_prompt_replaces_placeholders(self):
        prompt = build_prompt(
            pose_features={"posture": "good"},
            transcript_features={"text": "Hola, buenos dias"},
            prosody_features={"wpm": 140},
        )
        assert "{{pose_features}}" not in prompt
        assert "{{transcript_features}}" not in prompt
        assert "{{prosody_features}}" not in prompt
        assert '"posture": "good"' in prompt
        assert '"wpm": 140' in prompt

    def test_openai_schema_is_closed(self):
        schema = _score_result_json_schema()
        assert schema["additionalProperties"] is False
        assert schema["properties"]["dimensions"]["additionalProperties"] is False
        assert set(schema["properties"]["dimensions"]["required"]) == {
            "confianza",
            "claridad",
            "lenguaje_corporal",
            "ritmo_voz",
            "escucha_activa",
        }
        rec_schema = schema["properties"]["recommendations"]["items"]
        assert rec_schema["additionalProperties"] is False
        assert "success_metric" in rec_schema["required"]


# ---------------------------------------------------------------------------
# Tests: ScoreResult serialization
# ---------------------------------------------------------------------------

class TestSerialization:
    def test_score_result_model_dump_is_json_serializable(self):
        data = {
            "overall": 78,
            "dimensions": {
                "confianza": {"score": 82, "evidence": "postura firme"},
                "claridad": {"score": 75, "evidence": "bien estructurado"},
                "lenguaje_corporal": {"score": 70, "evidence": "movimientos controlados"},
                "ritmo_voz": {"score": 80, "evidence": "velocidad adecuada"},
                "escucha_activa": {"score": 65, "evidence": "formula preguntas"},
            },
            "recommendations": recommendations(),
        }
        score = ScoreResult.model_validate(data)
        dumped = score.model_dump()
        json.dumps(dumped)
        assert dumped["overall"] == 78
        assert len(dumped["dimensions"]) == 5


# ---------------------------------------------------------------------------
# Tests: edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    def test_empty_recommendations_are_invalid(self):
        data = {
            "overall": 50,
            "dimensions": {
                "confianza": {"score": 50, "evidence": "n/a"},
                "claridad": {"score": 50, "evidence": "n/a"},
                "lenguaje_corporal": {"score": 50, "evidence": "n/a"},
                "ritmo_voz": {"score": 50, "evidence": "n/a"},
                "escucha_activa": {"score": 50, "evidence": "n/a"},
            },
            "recommendations": [],
        }
        with pytest.raises(ValueError):
            ScoreResult.model_validate(data)

    def test_boundary_scores(self):
        data = {
            "overall": 0,
            "dimensions": {
                "confianza": {"score": 0, "evidence": "min"},
                "claridad": {"score": 0, "evidence": "min"},
                "lenguaje_corporal": {"score": 0, "evidence": "min"},
                "ritmo_voz": {"score": 0, "evidence": "min"},
                "escucha_activa": {"score": 0, "evidence": "min"},
            },
            "recommendations": recommendations(),
        }
        ScoreResult.model_validate(data)

        data["overall"] = 100
        for dim in data["dimensions"].values():
            dim["score"] = 100
        ScoreResult.model_validate(data)
