from pydantic import BaseModel, Field, field_validator
from typing import Optional


class DimensionScore(BaseModel):
    score: int = Field(..., ge=0, le=100)
    evidence: str


class Recommendation(BaseModel):
    priority: str = Field(...)
    tip: str
    drill: str

    @field_validator("priority")
    @classmethod
    def valid_priority(cls, v: str) -> str:
        if v not in {"high", "medium", "low"}:
            raise ValueError(f"priority must be high/medium/low, got: {v}")
        return v


class ScoreResult(BaseModel):
    overall: int = Field(..., ge=0, le=100)
    dimensions: dict[str, DimensionScore]
    recommendations: list[Recommendation]

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


class ScoringJob(BaseModel):
    job_id: str
    evaluation_id: str
    tenant_id: str
