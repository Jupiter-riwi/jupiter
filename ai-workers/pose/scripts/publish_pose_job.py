from __future__ import annotations

import argparse
import json
import uuid

import pika


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Publica un job de prueba en pose.jobs")
    parser.add_argument("--video-url", required=True, help="s3://..., https://... o ruta local")
    parser.add_argument("--evaluation-id", required=True)
    parser.add_argument("--tenant-id", required=True)
    parser.add_argument("--job-id", default=None)
    parser.add_argument("--segment-seconds", type=int, default=5)
    parser.add_argument("--queue", default="pose.jobs")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=5672)
    parser.add_argument("--user", default="guest")
    parser.add_argument("--password", default="guest")
    parser.add_argument("--vhost", default="/")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    job_id = args.job_id or str(uuid.uuid4())

    payload = {
        "job_id": job_id,
        "evaluation_id": args.evaluation_id,
        "tenant_id": args.tenant_id,
        "video_url": args.video_url,
        "options": {
            "segment_seconds": args.segment_seconds,
        },
    }

    credentials = pika.PlainCredentials(args.user, args.password)
    parameters = pika.ConnectionParameters(
        host=args.host,
        port=args.port,
        virtual_host=args.vhost,
        credentials=credentials,
    )
    connection = pika.BlockingConnection(parameters)
    channel = connection.channel()
    channel.queue_declare(queue=args.queue, durable=True)
    channel.basic_publish(
        exchange="",
        routing_key=args.queue,
        body=json.dumps(payload).encode("utf-8"),
        properties=pika.BasicProperties(delivery_mode=2, content_type="application/json"),
    )
    connection.close()

    print(f"Job publicado en {args.queue}: {json.dumps(payload, ensure_ascii=True)}")


if __name__ == "__main__":
    main()
