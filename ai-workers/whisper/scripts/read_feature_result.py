from __future__ import annotations

import argparse

import pika


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Read a message from features.results")
    parser.add_argument("--queue", default="features.results")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=5672)
    parser.add_argument("--user", default="guest")
    parser.add_argument("--password", default="guest")
    parser.add_argument("--vhost", default="/")
    parser.add_argument("--ack", action="store_true", help="Ack the message instead of requeue")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
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

    method, properties, body = channel.basic_get(queue=args.queue, auto_ack=False)
    del properties

    if method is None:
        print("No messages available")
        connection.close()
        return

    print(body.decode("utf-8", errors="replace"))
    if args.ack:
        channel.basic_ack(delivery_tag=method.delivery_tag)
    else:
        channel.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

    connection.close()


if __name__ == "__main__":
    main()
