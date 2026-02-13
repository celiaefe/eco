import os
import requests
from dotenv import load_dotenv
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")

def get_spotify_token():
    auth_response = requests.post(
        "https://accounts.spotify.com/api/token",
        data={
            "grant_type": "client_credentials"
        },
        auth=(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET)
    )

    auth_data = auth_response.json()
    return auth_data.get("access_token")

app = Flask(__name__)

recuerdos_guardados = []

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/recuerdos", methods=["GET", "POST"])
def recuerdos():
    resultados = []

    if request.method == "POST":
        titulo = request.form.get("titulo")
        cancion = request.form.get("cancion")
        artista = request.form.get("artista")
        portada = request.form.get("portada")
        nota = request.form.get("nota")

        if request.form.get("buscar"):
            consulta = " ".join(filter(None, [cancion, artista]))
            token = get_spotify_token()

            if token and consulta:
                headers = {
                    "Authorization": f"Bearer {token}"
                }
                params = {
                    "q": consulta,
                    "type": "track",
                    "limit": 5
                }
                response = requests.get(
                    "https://api.spotify.com/v1/search",
                    headers=headers,
                    params=params
                )
                data = response.json()
                tracks = data.get("tracks", {}).get("items", [])

                for t in tracks:
                    imagenes = t.get("album", {}).get("images", [])
                    portada_track = imagenes[0]["url"] if imagenes else None
                    artistas_track = ", ".join(a.get("name", "") for a in t.get("artists", []))

                    resultados.append({
                        "titulo": t.get("name"),
                        "artista": artistas_track,
                        "portada": portada_track,
                        "spotify_url": t.get("external_urls", {}).get("spotify")
                    })

            return render_template(
                "recuerdos.html",
                recuerdos=recuerdos_guardados[::-1],
                resultados=resultados
            )

        recuerdos_guardados.append({
            "titulo": titulo,
            "cancion": cancion,
            "artista": artista,
            "portada": portada,
            "nota": nota,
            "fecha": datetime.now().strftime("%d/%m/%Y %H:%M")
        })

        return redirect(url_for("recuerdos"))

    return render_template(
        "recuerdos.html",
        recuerdos=recuerdos_guardados[::-1],
        resultados=resultados
    )

@app.route("/test_spotify")
def test_spotify():
    token = get_spotify_token()

    headers = {
        "Authorization": f"Bearer {token}"
    }

    params = {
        "q": "Robe El hombre pajaro",
        "type": "track",
        "limit": 5
    }

    response = requests.get(
        "https://api.spotify.com/v1/search",
        headers=headers,
        params=params
    )

    data = response.json()
    tracks = data.get("tracks", {}).get("items", [])

    resultado = []
    for t in tracks:
        imagenes = t.get("album", {}).get("images", [])
        portada = imagenes[0]["url"] if imagenes else None
        artistas = ", ".join(a.get("name", "") for a in t.get("artists", []))

        resultado.append({
            "titulo": t.get("name"),
            "artista": artistas,
            "portada": portada,
            "spotify_url": t.get("external_urls", {}).get("spotify")
        })

    return {"resultados": resultado}

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5051, debug=True)
