# Migration runner for Apex Vision.
#
# Deps are installed at BUILD time (not on every `docker compose up`), so the
# migrate service starts in seconds instead of re-running pip over the network
# each time — which is what used to hang the whole stack when Docker's network
# was flaky.
#
# The alembic project (alembic.ini, env.py, versions/) is bind-mounted at
# runtime via docker-compose, so adding a new migration does NOT require
# rebuilding this image — only a change to requirements.txt does.

FROM python:3.12-slim

WORKDIR /migrations

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

CMD ["alembic", "upgrade", "head"]
