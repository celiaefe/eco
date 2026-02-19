from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

import requests
from flask import Blueprint, jsonify, make_response, redirect, render_template, request, url_for
from flask_login import current_user, login_required
from werkzeug.exceptions import HTTPException
from werkzeug.utils import secure_filename

from . import db
from .capsules import can_create_capsule, open_capsule_or_403
from .models import Capsule, Memory


main_bp = Blueprint("main", __name__)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "static", "uploads")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}
MAX_IMAGE_BYTES = 6 * 1024 * 1024


def anio_desde_fecha(fecha_str: str) -> str:
    fecha_str = (fecha_str or "").strip()
    if not fecha_str:
        return "Sin año"
    try:
        return datetime.strptime(fecha_str, "%d/%m/%Y %H:%M").strftime("%Y")
    except ValueError:
        return fecha_str[6:10] if len(fecha_str) >= 10 else "Sin año"


def get_spotify_token() -> str | None:
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    if not client_id or not client_secret:
        return None

    auth_response = requests.post(
        "https://accounts.spotify.com/api/token",
        data={"grant_type": "client_credentials"},
        auth=(client_id, client_secret),
        timeout=8,
    )
    auth_data = auth_response.json()
    return auth_data.get("access_token")


def buscar_preview_itunes(titulo: str, artista: str) -> str | None:
    if not titulo:
        return None

    term = " ".join(filter(None, [titulo, artista]))
    try:
        response = requests.get(
            "https://itunes.apple.com/search",
            params={"term": term, "entity": "song", "limit": 1},
            timeout=5,
        )
        data = response.json()
        items = data.get("results", [])
        if not items:
            return None
        return items[0].get("previewUrl")
    except Exception:
        return None


def buscar_canciones(query: str) -> list[dict]:
    token = get_spotify_token()
    if not token or not query:
        return []

    headers = {"Authorization": f"Bearer {token}"}
    params = {"q": query, "type": "track", "limit": 5}
    response = requests.get("https://api.spotify.com/v1/search", headers=headers, params=params, timeout=8)
    data = response.json()
    tracks = data.get("tracks", {}).get("items", [])

    resultados = []
    for t in tracks:
        imagenes = t.get("album", {}).get("images", [])
        portada = imagenes[0]["url"] if imagenes else None
        artistas = ", ".join(a.get("name", "") for a in t.get("artists", []))
        primer_artista = t.get("artists", [{}])[0].get("name", "")
        preview_url = buscar_preview_itunes(t.get("name", ""), primer_artista)
        resultados.append(
            {
                "titulo": t.get("name"),
                "artista": artistas,
                "portada": portada,
                "spotify_url": t.get("external_urls", {}).get("spotify"),
                "preview_url": preview_url,
            }
        )

    return resultados


def extension_permitida(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def guardar_foto_personal(file_storage):
    if not file_storage or not file_storage.filename:
        return None, None

    filename = secure_filename(file_storage.filename)
    if not filename or not extension_permitida(filename):
        return None, "Formato de imagen no permitido. Usa png/jpg/jpeg/webp/gif."

    try:
        file_storage.stream.seek(0, os.SEEK_END)
        size = file_storage.stream.tell()
        file_storage.stream.seek(0)
    except Exception:
        size = 0

    if size and size > MAX_IMAGE_BYTES:
        return None, "La imagen es demasiado grande (máx 6 MB)."

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = filename.rsplit(".", 1)[1].lower()
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    save_path = os.path.join(UPLOAD_DIR, unique_name)
    file_storage.save(save_path)
    return f"uploads/{unique_name}", None


def borrar_foto_personal(path_relativo: str | None) -> None:
    if not path_relativo:
        return
    normalizado = os.path.normpath(path_relativo).replace("\\", "/")
    if not normalizado.startswith("uploads/"):
        return
    ruta_absoluta = os.path.join(BASE_DIR, "static", normalizado)
    try:
        if os.path.exists(ruta_absoluta):
            os.remove(ruta_absoluta)
    except OSError:
        pass


def memory_to_dict(memory: Memory) -> dict:
    return {
        "id": memory.id,
        "titulo": memory.titulo,
        "cancion": memory.cancion,
        "artista": memory.artista,
        "spotify_url": memory.spotify_url,
        "portada": memory.portada,
        "preview_url": memory.preview_url,
        "nota": memory.nota,
        "foto_personal": memory.foto_personal,
        "fecha": memory.fecha,
        "favorito": memory.favorito,
    }


def capsule_to_dict(capsule: Capsule) -> dict:
    now = datetime.utcnow()
    return {
        "id": capsule.id,
        "spotify_id": capsule.spotify_id,
        "title": capsule.title,
        "artist": capsule.artist,
        "cover_url": capsule.cover_url,
        "message": capsule.message,
        "open_date": capsule.open_date.isoformat() + "Z",
        "opened_at": capsule.opened_at.isoformat() + "Z" if capsule.opened_at else None,
        "created_at": capsule.created_at.isoformat() + "Z",
        "is_opened": capsule.opened_at is not None,
        "is_unlockable_now": now >= capsule.open_date,
    }


def parse_open_date(raw_value: str) -> datetime | None:
    value = (raw_value or "").strip()
    if not value:
        return None

    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def obtener_recuerdo_usuario(recuerdo_id: str) -> Memory | None:
    return Memory.query.filter_by(id=recuerdo_id, user_id=current_user.id).first()


def cargar_recuerdos(user_id: int) -> list[Memory]:
    return Memory.query.filter_by(user_id=user_id).order_by(Memory.created_at.desc()).all()


def obtener_capsula_usuario(capsule_id: int) -> Capsule | None:
    return Capsule.query.filter_by(id=capsule_id, user_id=current_user.id).first()


@main_bp.after_app_request
def evitar_cache_html(response):
    content_type = (response.content_type or "").lower()
    if content_type.startswith("text/html"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


@main_bp.route("/")
def index():
    response = make_response(render_template("index.html"))
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@main_bp.route("/recuerdos", methods=["GET", "POST"])
@login_required
def recuerdos():
    resultados = []
    error = request.args.get("error", "").strip()
    crear_mode = request.args.get("crear") == "1"

    if request.method == "POST":
        titulo = request.form.get("titulo")
        cancion = request.form.get("cancion")
        titulo_cancion = request.form.get("titulo_cancion")
        artista = request.form.get("artista")
        spotify_url = request.form.get("spotify_url")
        portada = request.form.get("portada")
        preview_url = request.form.get("preview_url")
        nota = (request.form.get("nota") or "").strip()
        foto_personal, foto_error = guardar_foto_personal(request.files.get("foto_personal"))
        titulo_final = (titulo or titulo_cancion or cancion or "").strip()
        cancion_final = (titulo_cancion or cancion or "").strip()

        if not titulo_final or not cancion_final:
            return redirect(url_for("main.recuerdos", crear=1, error="Debes indicar al menos una canción y un título."))
        if not nota:
            return redirect(url_for("main.recuerdos", crear=1, error="La nota del recuerdo no puede quedar vacía."))
        if len(nota) > 1200:
            return redirect(url_for("main.recuerdos", crear=1, error="La nota es demasiado larga (máx 1200 caracteres)."))
        if foto_error:
            return redirect(url_for("main.recuerdos", crear=1, error=foto_error))

        recuerdo = Memory(
            user_id=current_user.id,
            titulo=titulo_final,
            cancion=cancion_final,
            artista=(artista or "").strip() or None,
            spotify_url=(spotify_url or "").strip() or None,
            portada=(portada or "").strip() or None,
            preview_url=(preview_url or "").strip() or None,
            nota=nota,
            foto_personal=foto_personal,
            fecha=datetime.now().strftime("%d/%m/%Y %H:%M"),
            favorito=False,
        )
        db.session.add(recuerdo)
        db.session.commit()

        return redirect(url_for("main.biblioteca"))

    recuerdos_guardados = cargar_recuerdos(current_user.id)
    if not crear_mode:
        return redirect(url_for("main.biblioteca"), code=308)

    return render_template(
        "recuerdos.html",
        recuerdos=recuerdos_guardados,
        resultados=resultados,
        error=error,
    )


@main_bp.route("/biblioteca")
@login_required
def biblioteca():
    recuerdos_ordenados = cargar_recuerdos(current_user.id)
    ultimos = recuerdos_ordenados[:24]
    favoritos = [r for r in recuerdos_ordenados if r.favorito]

    por_ano = {}
    for r in recuerdos_ordenados:
        ano = anio_desde_fecha(r.fecha)
        por_ano.setdefault(ano, []).append(r)

    anos_numericos = sorted([a for a in por_ano.keys() if a.isdigit()], reverse=True)
    anos_otros = sorted([a for a in por_ano.keys() if not a.isdigit()])
    anos = anos_numericos + anos_otros

    return render_template(
        "biblioteca.html",
        recuerdos=recuerdos_ordenados,
        ultimos=ultimos,
        favoritos=favoritos,
        por_ano=por_ano,
        anos=anos,
    )


@main_bp.route("/biblioteca/favorito", methods=["POST"])
@login_required
def toggle_favorito():
    payload = request.get_json(silent=True) or {}
    recuerdo_id = payload.get("id")
    if not recuerdo_id:
        return jsonify({"ok": False, "error": "id requerido"}), 400

    recuerdo = obtener_recuerdo_usuario(recuerdo_id)
    if recuerdo:
        recuerdo.favorito = not bool(recuerdo.favorito)
        db.session.commit()
        return jsonify({"ok": True, "id": recuerdo_id, "favorito": recuerdo.favorito})

    return jsonify({"ok": False, "error": "recuerdo no encontrado"}), 404


@main_bp.route("/capsulas", methods=["GET"])
@login_required
def listar_capsulas():
    capsulas = Capsule.query.filter_by(user_id=current_user.id).order_by(Capsule.created_at.desc()).all()
    abiertas = [capsule_to_dict(c) for c in capsulas if c.opened_at is not None]
    cerradas = [capsule_to_dict(c) for c in capsulas if c.opened_at is None]
    return jsonify({"ok": True, "abiertas": abiertas, "cerradas": cerradas, "total": len(capsulas)})


@main_bp.route("/capsulas/panel")
@login_required
def capsulas_panel():
    return render_template("capsulas.html")


@main_bp.route("/capsulas/<int:capsule_id>/ritual")
@login_required
def capsula_ritual(capsule_id: int):
    capsule = obtener_capsula_usuario(capsule_id)
    if capsule is None:
        return redirect(url_for("main.capsulas_panel"))

    now = datetime.utcnow()
    unlockable = (capsule.opened_at is not None) or (now >= capsule.open_date)
    return render_template("capsula_ritual.html", capsule=capsule, unlockable=unlockable)


@main_bp.route("/capsulas", methods=["POST"])
@login_required
def crear_capsula():
    if not can_create_capsule():
        return jsonify({"ok": False, "error": "Plan Free: solo una cápsula cerrada activa."}), 403

    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()
    message = (payload.get("message") or "").strip()
    open_date_raw = payload.get("open_date")

    if not title:
        return jsonify({"ok": False, "error": "title es obligatorio"}), 400
    if not open_date_raw:
        return jsonify({"ok": False, "error": "open_date es obligatorio"}), 400

    open_date = parse_open_date(str(open_date_raw))
    if open_date is None:
        return jsonify({"ok": False, "error": "open_date debe ser ISO-8601 válido"}), 400
    if open_date <= datetime.utcnow():
        return jsonify({"ok": False, "error": "open_date debe ser futura"}), 400

    capsule = Capsule(
        user_id=current_user.id,
        spotify_id=(payload.get("spotify_id") or "").strip() or None,
        title=title,
        artist=(payload.get("artist") or "").strip() or None,
        cover_url=(payload.get("cover_url") or "").strip() or None,
        message=message or None,
        open_date=open_date,
    )
    db.session.add(capsule)
    db.session.commit()
    return jsonify({"ok": True, "capsula": capsule_to_dict(capsule)}), 201


@main_bp.route("/capsulas/<int:capsule_id>/abrir", methods=["POST"])
@login_required
def abrir_capsula(capsule_id: int):
    capsule = obtener_capsula_usuario(capsule_id)
    if capsule is None:
        return jsonify({"ok": False, "error": "capsula no encontrada"}), 404

    try:
        open_capsule_or_403(capsule)
    except HTTPException:
        return jsonify({"ok": False, "error": "Esta cápsula aún no puede abrirse."}), 403

    return jsonify({"ok": True, "capsula": capsule_to_dict(capsule)})


@main_bp.route("/recuerdos/<recuerdo_id>", methods=["PATCH"])
@login_required
def editar_recuerdo(recuerdo_id):
    recuerdo = obtener_recuerdo_usuario(recuerdo_id)
    if not recuerdo:
        return jsonify({"ok": False, "error": "recuerdo no encontrado"}), 404

    payload = request.get_json(silent=True) or {}
    titulo = (payload.get("titulo") or "").strip()
    cancion = (payload.get("cancion") or "").strip()
    artista = (payload.get("artista") or "").strip()
    nota = (payload.get("nota") or "").strip()
    fecha = (payload.get("fecha") or "").strip()

    nuevo_titulo = titulo or (recuerdo.titulo or "")
    nuevo_cancion = cancion or (recuerdo.cancion or "")
    if not nuevo_titulo.strip() or not nuevo_cancion.strip():
        return jsonify({"ok": False, "error": "Título y canción no pueden quedar vacíos."}), 400
    if not nota:
        return jsonify({"ok": False, "error": "La nota no puede quedar vacía."}), 400
    if len(nota) > 1200:
        return jsonify({"ok": False, "error": "La nota es demasiado larga (máx 1200 caracteres)."}), 400

    recuerdo.titulo = nuevo_titulo.strip()
    recuerdo.cancion = nuevo_cancion.strip()
    recuerdo.artista = artista or None
    recuerdo.nota = nota
    if fecha:
        recuerdo.fecha = fecha

    db.session.commit()
    return jsonify({"ok": True, "recuerdo": memory_to_dict(recuerdo)})


@main_bp.route("/recuerdos/<recuerdo_id>/foto", methods=["POST"])
@login_required
def cambiar_foto_recuerdo(recuerdo_id):
    recuerdo = obtener_recuerdo_usuario(recuerdo_id)
    if not recuerdo:
        return jsonify({"ok": False, "error": "recuerdo no encontrado"}), 404

    foto_personal, foto_error = guardar_foto_personal(request.files.get("foto_personal"))
    if foto_error:
        return jsonify({"ok": False, "error": foto_error}), 400
    if not foto_personal:
        return jsonify({"ok": False, "error": "Debes seleccionar una imagen."}), 400

    if recuerdo.foto_personal:
        borrar_foto_personal(recuerdo.foto_personal)
    recuerdo.foto_personal = foto_personal
    db.session.commit()

    return jsonify(
        {
            "ok": True,
            "id": recuerdo_id,
            "foto_personal": recuerdo.foto_personal,
            "foto_url": url_for("static", filename=recuerdo.foto_personal),
        }
    )


@main_bp.route("/recuerdos/<recuerdo_id>", methods=["DELETE"])
@login_required
def borrar_recuerdo(recuerdo_id):
    recuerdo = obtener_recuerdo_usuario(recuerdo_id)
    if recuerdo is None:
        return jsonify({"ok": False, "error": "recuerdo no encontrado"}), 404

    borrar_foto_personal(recuerdo.foto_personal)
    db.session.delete(recuerdo)
    db.session.commit()
    return jsonify({"ok": True, "id": recuerdo_id})


@main_bp.route("/buscar_spotify")
@login_required
def buscar_spotify_api():
    query = request.args.get("q")
    if not query:
        return {"resultados": []}

    resultados = buscar_canciones(query)
    return {"resultados": resultados}


@main_bp.route("/test_spotify")
@login_required
def test_spotify():
    resultado = buscar_canciones("Robe El hombre pajaro")
    return {"resultados": resultado}
