console.log("JS cargado correctamente");

const inputCancion = document.getElementById("cancion");
const resultadosDiv = document.getElementById("spotify-resultados");
const tituloCancionInput = document.querySelector("input[name='titulo_cancion']");
const artistaInput = document.querySelector("input[name='artista']");
const spotifyUrlInput = document.querySelector("input[name='spotify_url']");
const portadaInput = document.querySelector("input[name='portada']");
const previewUrlInput = document.querySelector("input[name='preview_url']");
const cancionSeleccionada = document.getElementById("cancion-seleccionada");
const nuevoRecuerdoBtn = document.getElementById("nuevo-recuerdo-btn");
const nuevoRecuerdoPanel = document.getElementById("nuevo-recuerdo-panel");
const panelBackdrop = document.getElementById("panel-backdrop");
const entrarRecuerdosBtn = document.getElementById("entrar-recuerdos-btn");
const zonaRecuerdos = document.getElementById("zona-recuerdos");
const entradaNocturna = document.getElementById("entrada-nocturna");
const formNuevoRecuerdo = nuevoRecuerdoPanel?.querySelector("form");
const params = new URLSearchParams(window.location.search);
const isCrearMode = params.get("crear") === "1";

let timeout = null;

function abrirPanelNuevoRecuerdo() {
    if (!nuevoRecuerdoPanel) return;
    nuevoRecuerdoPanel.classList.add("abierto");
    document.body.classList.add("panel-abierto");
    nuevoRecuerdoBtn?.setAttribute("aria-expanded", "true");
    nuevoRecuerdoPanel.setAttribute("aria-hidden", "false");

    if (panelBackdrop) {
        panelBackdrop.classList.add("activo");
        panelBackdrop.setAttribute("aria-hidden", "false");
    }

    inputCancion?.focus();
}

function cerrarPanelNuevoRecuerdo() {
    if (!nuevoRecuerdoPanel) return;
    nuevoRecuerdoPanel.classList.remove("abierto");
    document.body.classList.remove("panel-abierto");
    nuevoRecuerdoBtn?.setAttribute("aria-expanded", "false");
    nuevoRecuerdoPanel.setAttribute("aria-hidden", "true");

    if (panelBackdrop) {
        panelBackdrop.classList.remove("activo");
        panelBackdrop.setAttribute("aria-hidden", "true");
    }

    // Si entramos en modo crear por URL (?crear=1), al cerrar fuera
    // volvemos a biblioteca para no mostrar la vista antigua de "Ecos".
    if (document.body.classList.contains("modo-crear") && !document.body.classList.contains("modo-crear-guardando")) {
        window.location.href = "/biblioteca";
    }
}

function limpiarCancionSeleccionada() {
    if (!cancionSeleccionada) return;
    cancionSeleccionada.hidden = true;
    cancionSeleccionada.innerHTML = "";
}

function mostrarCancionSeleccionada(track) {
    if (!cancionSeleccionada) return;
    cancionSeleccionada.innerHTML = `
        <div class="cancion-seleccionada-contenido">
            ${track.portada ? `<img src="${track.portada}" alt="Portada de ${track.titulo}" class="cancion-seleccionada-portada">` : ""}
            <div class="cancion-seleccionada-info">
                <strong>${track.titulo}</strong>
                <span>${track.artista || "Artista desconocido"}</span>
                ${track.preview_url ? `<audio class="spotify-preview" controls preload="none" src="${track.preview_url}"></audio>` : ""}
            </div>
        </div>
    `;
    cancionSeleccionada.hidden = false;
}

if (params.get("guardado") === "1") {
    const recuerdoNuevo = document.querySelector(".timeline-item.nuevo");
    if (recuerdoNuevo) {
        requestAnimationFrame(() => {
            recuerdoNuevo.scrollIntoView({ behavior: "smooth", block: "center" });
        });
    }
    params.delete("guardado");
    const query = params.toString();
    const nuevaUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState({}, "", nuevaUrl);
}

if (nuevoRecuerdoBtn && nuevoRecuerdoPanel) {
    nuevoRecuerdoBtn.addEventListener("click", () => {
        const abierto = nuevoRecuerdoPanel.classList.contains("abierto");
        if (abierto) {
            cerrarPanelNuevoRecuerdo();
        } else {
            abrirPanelNuevoRecuerdo();
        }
    });
}

if (panelBackdrop && nuevoRecuerdoPanel) {
    panelBackdrop.addEventListener("click", () => {
        cerrarPanelNuevoRecuerdo();
    });
}

if (entrarRecuerdosBtn && zonaRecuerdos) {
    entrarRecuerdosBtn.addEventListener("click", () => {
        zonaRecuerdos.scrollIntoView({ behavior: "smooth", block: "start" });
    });
}

if (entradaNocturna && zonaRecuerdos && !isCrearMode) {
    document.body.classList.add("js-scroll-intro");

    const actualizarTransicionEntrada = () => {
        const alturaEntrada = entradaNocturna.offsetHeight || window.innerHeight;
        const scrollActual = Math.max(0, window.scrollY);
        const progreso = Math.min(1, scrollActual / (alturaEntrada * 0.75));

        entradaNocturna.style.setProperty("--entrada-progreso", progreso.toFixed(3));
        zonaRecuerdos.classList.toggle("visible", progreso > 0.18);
    };

    actualizarTransicionEntrada();
    window.addEventListener("scroll", actualizarTransicionEntrada, { passive: true });
    window.addEventListener("resize", actualizarTransicionEntrada);
}

if (isCrearMode) {
    document.body.classList.add("modo-crear");
    document.body.classList.remove("js-scroll-intro");
    abrirPanelNuevoRecuerdo();
}

if (isCrearMode && formNuevoRecuerdo) {
    formNuevoRecuerdo.addEventListener("submit", (e) => {
        if (document.body.classList.contains("modo-crear-guardando")) return;
        e.preventDefault();
        document.body.classList.add("modo-crear-guardando");
        const submitBtn = formNuevoRecuerdo.querySelector("button[type='submit']");
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Guardando...";
        }
        window.setTimeout(() => formNuevoRecuerdo.submit(), 240);
    });
}

if (zonaRecuerdos) {
    const observerRecuerdos = new IntersectionObserver(
        (entradas) => {
            entradas.forEach((entrada) => {
                if (entrada.isIntersecting) {
                    zonaRecuerdos.classList.add("en-pantalla");
                    observerRecuerdos.disconnect();
                }
            });
        },
        { threshold: 0.2 }
    );

    observerRecuerdos.observe(zonaRecuerdos);
}

const previewsRecuerdos = document.querySelectorAll(".recuerdo-preview");
previewsRecuerdos.forEach((audio) => {
    const tarjetaRecuerdo = audio.closest(".recuerdo");
    if (!tarjetaRecuerdo) return;

    audio.addEventListener("play", () => {
        tarjetaRecuerdo.classList.add("sonando");
    });

    const quitarEfecto = () => {
        tarjetaRecuerdo.classList.remove("sonando");
    };

    audio.addEventListener("pause", quitarEfecto);
    audio.addEventListener("ended", quitarEfecto);
});

inputCancion.addEventListener("input", function () {
    clearTimeout(timeout);

    // Si el usuario vuelve a escribir, limpiamos una seleccion previa.
    tituloCancionInput.value = "";
    artistaInput.value = "";
    spotifyUrlInput.value = "";
    portadaInput.value = "";
    previewUrlInput.value = "";
    limpiarCancionSeleccionada();

    const query = this.value.trim();

    if (query.length < 3) {
        resultadosDiv.innerHTML = "";
        return;
    }

    timeout = setTimeout(() => {
        fetch(`/buscar_spotify?q=${encodeURIComponent(query)}`)
            .then((res) => res.json())
            .then((data) => {
                resultadosDiv.innerHTML = "";
                if (!Array.isArray(data.resultados) || data.resultados.length === 0) {
                    resultadosDiv.innerHTML = '<div class="spotify-vacio">Sin resultados para esa búsqueda.</div>';
                    return;
                }

                data.resultados.forEach((item) => {
                    const track = {
                        titulo: item.titulo || item.nombre || "",
                        artista: item.artista || "",
                        portada: item.portada || "",
                        spotify_url: item.spotify_url || "",
                        preview_url: item.preview_url || ""
                    };

                    const resultado = document.createElement("div");
                    resultado.classList.add("spotify-item");
                    const tarjeta = resultado;

                    resultado.innerHTML = `
                        <img src="${track.portada}" class="spotify-portada">
                        <div>
                            <strong>${track.titulo}</strong><br>
                            <span>${track.artista}</span>
                            ${track.preview_url
                                ? `<audio class="spotify-preview" controls preload="none" src="${track.preview_url}"></audio>`
                                : `<div class="spotify-vacio">Sin preview</div>`}
                        </div>
                    `;

                    const audio = resultado.querySelector("audio");
                    if (audio) {
                        audio.addEventListener("play", () => {
                            tarjeta.classList.add("sonando");
                        });

                        audio.addEventListener("pause", () => {
                            tarjeta.classList.remove("sonando");
                        });

                        audio.addEventListener("click", (e) => {
                            e.stopPropagation();
                        });
                    }

                    resultado.addEventListener("click", () => {
                        tituloCancionInput.value = track.titulo;
                        artistaInput.value = track.artista;
                        spotifyUrlInput.value = track.spotify_url;
                        portadaInput.value = track.portada;
                        previewUrlInput.value = track.preview_url;
                        inputCancion.value = `${track.titulo} - ${track.artista}`;
                        resultadosDiv.innerHTML = "";
                        mostrarCancionSeleccionada(track);
                    });

                    resultadosDiv.appendChild(resultado);
                });
            })
            .catch(() => {
                resultadosDiv.innerHTML = "";
            });
    }, 300);
});
