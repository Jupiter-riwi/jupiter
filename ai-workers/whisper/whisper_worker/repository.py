from __future__ import annotations

import json
from dataclasses import dataclass

import psycopg

from whisper_worker.config import Settings


class RepositoryError(RuntimeError):
    """Raised when persisting the transcript fails."""


@dataclass(frozen=True)
class DatabaseConfig:
    database_url: str

    @classmethod
    def from_settings(cls, settings: Settings) -> "DatabaseConfig":
        return cls(database_url=settings.database_url)


class FeatureRepository:
    def __init__(self, config: DatabaseConfig):
        if not config.database_url:
            raise RepositoryError("DATABASE_URL is required to persist transcripts")
        self.database_url = config.database_url

    def save_transcript(
        self,
        *,
        evaluation_id: str,
        tenant_id: str,
        payload: dict,
    ) -> None:
        query = """
            insert into public.features (evaluation_id, tenant_id, kind, payload)
            values (%s::uuid, %s::uuid, 'transcript', %s::jsonb)
        """

        data = json.dumps(payload, separators=(",", ":"))

        try:
            with psycopg.connect(self.database_url) as connection:
                with connection.cursor() as cursor:
                    cursor.execute(query, (evaluation_id, tenant_id, data))
                connection.commit()
        except Exception as exc:  # pragma: no cover
            raise RepositoryError("Failed to insert transcript payload") from exc
