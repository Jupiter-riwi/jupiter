from __future__ import annotations

import logging

from whisper_worker.config import Settings
from whisper_worker.worker import WhisperWorker


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )


def main() -> None:
    settings = Settings.from_env()
    configure_logging(settings.log_level)

    worker = WhisperWorker(settings)
    worker.run()


if __name__ == "__main__":
    main()
