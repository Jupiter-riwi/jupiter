from __future__ import annotations

import argparse
import json
import uuid

import pika


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Publish a test job to whisper.jobs")
    parser.add_argument("--video-url", required=True, help="Video URL or local path")
    parser.add_argument("--evaluation-id", required=True)
    parser.add_argument("--tenant-id", required=True)
    parser.add_argument("--job-id", default=None)
    parser.add_argument("--queue", default="whisper.jobs")
    parser.add_argument("--language", help="Language override")
    parser.add_argument("--prompt", help="Optional prompt for Whisper")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=5672)
    parser.add_argument("--user", default="guest")
    parser.add_argument("--password", default="guest")
    parser.add_argument("--vhost", default="/")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    job_id = args.job_id or str(uuid.uuid4())

    options = {}
    if args.language:
        options["language"] = args.language
    if args.prompt:
        options["prompt"] = args.prompt

    payload = {
        "job_id": job_id,
        "evaluation_id": args.evaluation_id,
        "tenant_id": args.tenant_id,
        "video_url": args.video_url,
        "options": options,
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

    print(f"Published job {job_id} to {args.queue}")


if __name__ == "__main__":
    main()
