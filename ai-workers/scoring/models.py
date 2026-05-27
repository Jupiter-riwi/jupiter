from pydantic import BaseModel, Field, field_validator


class DimensionScore(BaseModel):
    score: int = Field(..., ge=0, le=100)
    evidence: str


class Recommendation(BaseModel):
    priority: str = Field(...)
    area: str
    problem: str
    impact: str
    tip: str
    drill: str
    success_metric: str

    @field_validator("priority")
    @classmethod
    def valid_priority(cls, v: str) -> str:
        if v not in {"high", "medium", "low"}:
            raise ValueError(f"priority must be high/medium/low, got: {v}")
        return v


class ScoreResult(BaseModel):
    overall: int = Field(..., ge=0, le=100)
    dimensions: dict[str, DimensionScore]
    recommendations: list[Recommendation] = Field(..., min_length=3, max_length=5)

    @field_validator("dimensions")
    @classmethod
    def has_five_dimensions(cls, v: dict) -> dict:
        required = {"confianza", "claridad", "lenguaje_corporal", "ritmo_voz", "escucha_activa"}
        missing = required - set(v.keys())
        extra = set(v.keys()) - required
        if missing:
            raise ValueError(f"Missing dimensions: {missing}")
        if extra:
            raise ValueError(f"Unexpected dimensions: {extra}")
        return v

    @field_validator("recommendations")
    @classmethod
    def recommendations_are_actionable(cls, v: list[Recommendation]) -> list[Recommendation]:
        for rec in v:
            fields = {
                "area": rec.area,
                "problem": rec.problem,
                "impact": rec.impact,
                "tip": rec.tip,
                "drill": rec.drill,
                "success_metric": rec.success_metric,
            }
            empty = [name for name, value in fields.items() if not value.strip()]
            if empty:
                raise ValueError(f"Recommendation has empty fields: {empty}")
        return v


class ScoringJob(BaseModel):
    job_id: str
    evaluation_id: str
    tenant_id: str
