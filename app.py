from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for

app = Flask(__name__)

recuerdos_guardados = []

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/recuerdos", methods=["GET", "POST"])
def recuerdos():
    if request.method == "POST":
        titulo = request.form.get("titulo")
        cancion = request.form.get("cancion")
        artista = request.form.get("artista")
        nota = request.form.get("nota")

        recuerdos_guardados.append({
            "titulo": titulo,
            "cancion": cancion,
            "artista": artista,
            "nota": nota,
            "fecha": datetime.now().strftime("%d/%m/%Y %H:%M")
        })

        return redirect(url_for("recuerdos"))

    return render_template("recuerdos.html", recuerdos=recuerdos_guardados[::-1])

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)
