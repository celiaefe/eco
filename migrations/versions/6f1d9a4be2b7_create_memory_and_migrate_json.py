"""create memory and migrate recuerdos json

Revision ID: 6f1d9a4be2b7
Revises: ad6552dfeec1
Create Date: 2026-02-18 00:00:00.000000

"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "6f1d9a4be2b7"
down_revision = "ad6552dfeec1"
branch_labels = None
depends_on = None


def _parse_fecha(fecha_raw: str | None) -> tuple[str, datetime]:
    fecha = (fecha_raw or "").strip()
    if not fecha:
        now = datetime.utcnow()
        return now.strftime("%d/%m/%Y %H:%M"), now
    try:
        dt = datetime.strptime(fecha, "%d/%m/%Y %H:%M")
        return fecha, dt
    except ValueError:
        now = datetime.utcnow()
        return fecha, now


def _load_legacy_recuerdos() -> list[dict]:
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    json_path = os.path.join(base_dir, "data", "recuerdos.json")
    if not os.path.exists(json_path):
        return []
    try:
        with open(json_path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
            return data if isinstance(data, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def upgrade():
    op.create_table(
        "memory",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("titulo", sa.String(length=255), nullable=False),
        sa.Column("cancion", sa.String(length=255), nullable=False),
        sa.Column("artista", sa.String(length=255), nullable=True),
        sa.Column("spotify_url", sa.String(length=500), nullable=True),
        sa.Column("portada", sa.String(length=500), nullable=True),
        sa.Column("preview_url", sa.String(length=500), nullable=True),
        sa.Column("nota", sa.Text(), nullable=False),
        sa.Column("foto_personal", sa.String(length=500), nullable=True),
        sa.Column("fecha", sa.String(length=20), nullable=False),
        sa.Column("favorito", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_memory_user_id"), "memory", ["user_id"], unique=False)

    bind = op.get_bind()
    users = bind.execute(sa.text("SELECT id FROM user ORDER BY created_at ASC, id ASC")).fetchall()
    if not users:
        return

    default_user_id = users[0][0]
    recuerdos = _load_legacy_recuerdos()
    if not recuerdos:
        return

    memory_table = sa.table(
        "memory",
        sa.column("id", sa.String(length=32)),
        sa.column("user_id", sa.Integer()),
        sa.column("titulo", sa.String(length=255)),
        sa.column("cancion", sa.String(length=255)),
        sa.column("artista", sa.String(length=255)),
        sa.column("spotify_url", sa.String(length=500)),
        sa.column("portada", sa.String(length=500)),
        sa.column("preview_url", sa.String(length=500)),
        sa.column("nota", sa.Text()),
        sa.column("foto_personal", sa.String(length=500)),
        sa.column("fecha", sa.String(length=20)),
        sa.column("favorito", sa.Boolean()),
        sa.column("created_at", sa.DateTime()),
    )

    rows = []
    for raw in recuerdos:
        if not isinstance(raw, dict):
            continue
        titulo = (raw.get("titulo") or "").strip()
        cancion = (raw.get("cancion") or "").strip()
        nota = (raw.get("nota") or "").strip()
        if not titulo or not cancion or not nota:
            continue

        fecha, created_at = _parse_fecha(raw.get("fecha"))
        memory_id = (raw.get("id") or "").strip() or uuid.uuid4().hex
        rows.append(
            {
                "id": memory_id[:32],
                "user_id": default_user_id,
                "titulo": titulo[:255],
                "cancion": cancion[:255],
                "artista": ((raw.get("artista") or "").strip() or None),
                "spotify_url": ((raw.get("spotify_url") or "").strip() or None),
                "portada": ((raw.get("portada") or "").strip() or None),
                "preview_url": ((raw.get("preview_url") or "").strip() or None),
                "nota": nota,
                "foto_personal": ((raw.get("foto_personal") or "").strip() or None),
                "fecha": fecha[:20],
                "favorito": bool(raw.get("favorito")),
                "created_at": created_at,
            }
        )

    if rows:
        op.bulk_insert(memory_table, rows)


def downgrade():
    op.drop_index(op.f("ix_memory_user_id"), table_name="memory")
    op.drop_table("memory")
