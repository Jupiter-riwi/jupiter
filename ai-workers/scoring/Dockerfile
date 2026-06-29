FROM python:3.12-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --timeout=600 --retries=10 -r requirements.txt

COPY . .

EXPOSE 8002

CMD ["uvicorn", "scoring.main:app", "--host", "0.0.0.0", "--port", "8002"]
