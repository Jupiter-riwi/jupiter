#!/usr/bin/env python3
"""Seed script: creates demo tenant, users and questions."""

from __future__ import annotations

import os
import uuid

import bcrypt
import psycopg2


DEFAULT_DEMO_AT_CREDITS = 200


def _conn():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "postgres"),
        port=os.getenv("DB_PORT", "5432"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        dbname=os.getenv("DB_NAME", "jupiter"),
    )


def _demo_at_credits() -> int:
    raw = os.getenv("SEED_DEMO_AT_CREDITS", str(DEFAULT_DEMO_AT_CREDITS)).strip()
    try:
        value = int(raw)
    except ValueError:
        value = DEFAULT_DEMO_AT_CREDITS
    return max(0, value)


def main() -> None:
    seller_email = os.getenv("SEED_DEMO_SELLER_EMAIL", "seller.demo@jupiter.local")
    seller_pass = os.getenv("SEED_DEMO_SELLER_PASSWORD", "Demo1234!")
    admin_email = os.getenv("SEED_DEMO_ADMIN_EMAIL", "admin.demo@jupiter.local")
    admin_pass = os.getenv("SEED_DEMO_ADMIN_PASSWORD", "Demo1234!")
    tenant_id = os.getenv("SEED_TENANT_ID") or str(uuid.uuid4())

    conn = _conn()
    try:
        with conn.cursor() as cur:
            # ── Tenant ──────────────────────────────────────────────────
            cur.execute(
                "INSERT INTO tenants (id, name, domain) VALUES (%s::uuid, %s, %s) "
                "ON CONFLICT (name) DO UPDATE SET domain = EXCLUDED.domain RETURNING id",
                (tenant_id, "Demo Company", "demo.jupiter.local"),
            )
            tenant_id = str(cur.fetchone()[0])

            # ── Seller user ─────────────────────────────────────────────
            seller_hash = bcrypt.hashpw(seller_pass.encode(), bcrypt.gensalt()).decode()
            cur.execute(
                "INSERT INTO users (tenant_id, email, password_hash, role) "
                "VALUES (%s::uuid, %s, %s, 'member') ON CONFLICT (tenant_id, email) DO NOTHING",
                (tenant_id, seller_email, seller_hash),
            )

            # ── Admin user ──────────────────────────────────────────────
            admin_hash = bcrypt.hashpw(admin_pass.encode(), bcrypt.gensalt()).decode()
            cur.execute(
                "INSERT INTO users (tenant_id, email, password_hash, role) "
                "VALUES (%s::uuid, %s, %s, 'admin') ON CONFLICT (tenant_id, email) DO NOTHING",
                (tenant_id, admin_email, admin_hash),
            )

            # ── Questions ───────────────────────────────────────────────
            questions = [
                ("Vendeme este producto como si estuvieras en una llamada de cold-calling de 90 segundos.", "sales", 90),
                ("Explica las 3 funcionalidades principales de nuestro producto estrella.", "product", 120),
                ("Cerrame la venta. El cliente duda del precio. Convencelo en 60 segundos.", "sales", 60),
                ("Maneja esta objecion: 'Ya tengo proveedor y estoy contento'.", "objection_handling", 45),
                ("Hace un elevator pitch de 30 segundos sobre vos y la empresa.", "communication", 30),
                ("Convencé a un cliente escéptico de que implemente nuestra solución en su empresa.", "sales", 90),
            ]
            for text, category, duration in questions:
                cur.execute(
                    "INSERT INTO questions (tenant_id, text, category, expected_duration_sec) "
                    "VALUES (%s::uuid, %s, %s, %s) ON CONFLICT DO NOTHING",
                    (tenant_id, text, category, duration),
                )

        conn.commit()

        demo_credits = _demo_at_credits()
        if demo_credits > 0:
            from app.billing import wallet
            from app.billing.db import tenant_scope

            with tenant_scope(conn, tenant_id):
                balance = wallet.get_balance(conn, tenant_id)
                missing = demo_credits - int(balance["total"])
                if missing > 0:
                    wallet.credit(
                        conn,
                        tenant_id,
                        missing,
                        "adjustment",
                        "seed",
                        "demo-at",
                    )
        print(f"Seed OK — tenant={tenant_id}")
        print(f"  Seller: {seller_email} / {seller_pass}")
        print(f"  Admin:  {admin_email} / {admin_pass}")
        print(f"  Questions: {len(questions)} created")
        print(f"  Demo AT balance floor: {demo_credits}")
    except Exception as exc:
        conn.rollback()
        print(f"Seed FAILED: {exc}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
