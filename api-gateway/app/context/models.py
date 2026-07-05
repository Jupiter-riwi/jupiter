"""Pydantic contract for the compiled context brief.

Same philosophy as ai-workers/scoring/models.py: the LLM must fill THIS mold;
anything that doesn't validate is rejected before touching the DB.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class ContextBrief(BaseModel):
    """Structured brief compiled once from the raw pasted text (JD/CV/product)."""

    summary: str = Field(..., min_length=10, max_length=600)
    competencies: list[str] = Field(..., min_length=3, max_length=8)
    seed_questions: list[str] = Field(..., min_length=8, max_length=12)
    red_flags: list[str] = Field(..., min_length=2, max_length=6)
    success_criteria: list[str] = Field(..., min_length=3, max_length=6)
    vocabulary: list[str] = Field(default_factory=list, max_length=15)

    @field_validator("competencies", "seed_questions", "red_flags", "success_criteria")
    @classmethod
    def no_empty_items(cls, v: list[str]) -> list[str]:
        cleaned = [item.strip() for item in v]
        if any(not item for item in cleaned):
            raise ValueError("list items must be non-empty")
        return cleaned
