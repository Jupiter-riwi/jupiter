from __future__ import annotations

import json
from dataclasses import dataclass

import psycopg

from pose_worker.config import Settings


class RepositoryError(RuntimeError):
    """No se pudo persistir el feature en base de datos."""


@dataclass(frozen=True)
class DatabaseConfig:
    database_url: str

    @classmethod
    def from_settings(cls, settings: Settings) -> "DatabaseConfig":
        return cls(database_url=settings.database_url)


class FeatureRepository:
    def __init__(self, config: DatabaseConfig):
        if not config.database_url:
            raise RepositoryError(
                "DATABASE_URL no esta definido. No se puede persistir en tabla features."
            )
        self._database_url = config.database_url

    def save_pose_feature(
        self,
        *,
        evaluation_id: str,
        tenant_id: str,
        payload: dict,
    ) -> None:
        query = """
            insert into public.features (evaluation_id, tenant_id, kind, payload)
            values (%s::uuid, %s::uuid, 'pose', %s::jsonb)
        """

        payload_json = json.dumps(payload, separators=(",", ":"))

        try:
            with psycopg.connect(self._database_url) as connection:
                with connection.cursor() as cursor:
                    cursor.execute(query, (evaluation_id, tenant_id, payload_json))
                connection.commit()
        except Exception as exc:  # pragma: no cover - depende de BD externa.
            raise RepositoryError("Error insertando payload de pose en tabla features") from exc
