from __future__ import annotations

import logging

from pose_worker.config import Settings
from pose_worker.worker import PoseWorker


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )


def main() -> None:
    settings = Settings.from_env()
    configure_logging(settings.log_level)

    worker = PoseWorker(settings)
    worker.run()


if __name__ == "__main__":
    main()
