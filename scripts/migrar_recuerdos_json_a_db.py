#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app import create_app, db
from app.models import Memory, User

LEGACY_JSON_PATH = os.path.join(BASE_DIR, "data", "backup", "recuerdos_legacy.json")
LEGACY_JSON_OLD_PATH = os.path.join(BASE_DIR, "data", "recuerdos.json")


def parse_fecha(fecha_raw: str | None) -> tuple[str, datetime]:
    fecha = (fecha_raw or "").strip()
    if not fecha:
        now = datetime.utcnow()
        return now.strftime("%d/%m/%Y %H:%M"), now
    try:
        dt = datetime.strptime(fecha, "%d/%m/%Y %H:%M")
        return fecha, dt
    except ValueError:
        return fecha[:20], datetime.utcnow()


def load_legacy_recuerdos(path: str) -> list[dict]:
    if path == LEGACY_JSON_PATH and not os.path.exists(path) and os.path.exists(LEGACY_JSON_OLD_PATH):
        path = LEGACY_JSON_OLD_PATH
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError):
        return []
    return data if isinstance(data, list) else []


def resolve_user(email: str | None, user_id: int | None) -> User | None:
    if email:
        return User.query.filter_by(email=email.strip().lower()).first()
    if user_id:
        return User.query.get(user_id)
    return None


def migrate_for_user(target_user: User, legacy_recuerdos: list[dict], dry_run: bool) -> tuple[int, int]:
    inserted = 0
    skipped = 0

    for raw in legacy_recuerdos:
        if not isinstance(raw, dict):
            skipped += 1
            continue

        titulo = (raw.get("titulo") or "").strip()
        cancion = (raw.get("cancion") or "").strip()
        nota = (raw.get("nota") or "").strip()
        if not titulo or not cancion or not nota:
            skipped += 1
            continue

        memory_id = (raw.get("id") or "").strip()[:32] or uuid.uuid4().hex
        if Memory.query.filter_by(id=memory_id).first():
            skipped += 1
            continue

        fecha, created_at = parse_fecha(raw.get("fecha"))
        record = Memory(
            id=memory_id,
            user_id=target_user.id,
            titulo=titulo[:255],
            cancion=cancion[:255],
            artista=((raw.get("artista") or "").strip() or None),
            spotify_url=((raw.get("spotify_url") or "").strip() or None),
            portada=((raw.get("portada") or "").strip() or None),
            preview_url=((raw.get("preview_url") or "").strip() or None),
            nota=nota,
            foto_personal=((raw.get("foto_personal") or "").strip() or None),
            fecha=fecha[:20],
            favorito=bool(raw.get("favorito")),
            created_at=created_at,
        )
        db.session.add(record)
        inserted += 1

    if dry_run:
        db.session.rollback()
    else:
        db.session.commit()

    return inserted, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description="Migra JSON legacy de recuerdos a tabla Memory para una cuenta concreta.")
    parser.add_argument("--email", help="Email de la cuenta destino.")
    parser.add_argument("--user-id", type=int, help="ID numérico de la cuenta destino.")
    parser.add_argument(
        "--json-path",
        default=LEGACY_JSON_PATH,
        help="Ruta del JSON legacy (por defecto data/backup/recuerdos_legacy.json).",
    )
    parser.add_argument("--dry-run", action="store_true", help="Simula la migración sin guardar cambios.")
    args = parser.parse_args()

    if not args.email and not args.user_id:
        parser.error("Debes indicar --email o --user-id.")

    app = create_app()
    with app.app_context():
        user = resolve_user(args.email, args.user_id)
        if not user:
            print("Usuario no encontrado.")
            return 1

        recuerdos = load_legacy_recuerdos(args.json_path)
        if not recuerdos:
            print(f"No hay recuerdos para migrar en {args.json_path}.")
            return 0

        inserted, skipped = migrate_for_user(user, recuerdos, args.dry_run)
        mode = "SIMULACION" if args.dry_run else "OK"
        print(f"[{mode}] Usuario destino: {user.email} (id={user.id})")
        print(f"[{mode}] Insertados: {inserted}")
        print(f"[{mode}] Omitidos: {skipped}")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
