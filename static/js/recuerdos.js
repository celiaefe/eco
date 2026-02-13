const STORAGE_KEY = "eco_recuerdos";

const form = document.getElementById("recuerdo-form");
const tituloInput = document.getElementById("titulo");
const cancionInput = document.getElementById("cancion");
const artistaInput = document.getElementById("artista");
const portadaInput = document.getElementById("portada");
const notaInput = document.getElementById("nota");
const buscarBtn = document.getElementById("buscar-btn");
const resultadosEl = document.getElementById("resultados");
const timelineEl = document.getElementById("timeline");

function loadRecuerdos() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (_error) {
    return [];
  }
}

function saveRecuerdos(recuerdos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recuerdos));
}

function formatNow() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function clearNode(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function createTextDiv(className, text) {
  const div = document.createElement("div");
  div.className = className;
  div.textContent = text || "";
  return div;
}

function renderRecuerdos() {
  const recuerdos = loadRecuerdos().slice().reverse();
  clearNode(timelineEl);

  if (!recuerdos.length) {
    const empty = document.createElement("p");
    empty.className = "spotify-vacio";
    empty.textContent = "Todavia no hay recuerdos guardados en este navegador.";
    timelineEl.appendChild(empty);
    return;
  }

  recuerdos.forEach((r, index) => {
    const item = document.createElement("div");
    item.className = `timeline-item${index === 0 ? " nuevo" : ""}`;

    const dot = document.createElement("div");
    dot.className = "timeline-dot";
    item.appendChild(dot);

    const content = document.createElement("div");
    content.className = "timeline-content";

    const header = document.createElement("div");
    header.className = "recuerdo-header";

    const title = document.createElement("strong");
    title.className = "recuerdo-titulo";
    title.textContent = r.titulo || "";

    const fecha = document.createElement("small");
    fecha.className = "recuerdo-fecha";
    fecha.textContent = r.fecha || "";

    header.appendChild(title);
    header.appendChild(fecha);
    content.appendChild(header);

    const song = document.createElement("div");
    song.className = "recuerdo-cancion";

    const icon = document.createElement("div");
    icon.className = "cancion-icono";
    icon.textContent = "♪";
    song.appendChild(icon);

    if (r.portada) {
      const cover = document.createElement("img");
      cover.className = "cancion-portada";
      cover.alt = `Portada de ${r.cancion || "cancion"}`;
      cover.src = r.portada;
      song.appendChild(cover);
    }

    const songInfo = document.createElement("div");
    songInfo.className = "cancion-info";
    songInfo.appendChild(createTextDiv("cancion-titulo", r.cancion || ""));
    if (r.artista) {
      songInfo.appendChild(createTextDiv("cancion-artista", r.artista));
    }
    song.appendChild(songInfo);
    content.appendChild(song);

    const note = document.createElement("p");
    note.className = "recuerdo-nota";
    note.textContent = r.nota || "";
    content.appendChild(note);

    item.appendChild(content);
    timelineEl.appendChild(item);
  });
}

function setResultsMessage(message) {
  clearNode(resultadosEl);
  const p = document.createElement("p");
  p.className = "spotify-vacio";
  p.textContent = message;
  resultadosEl.appendChild(p);
}

async function buscarCanciones() {
  const query = [cancionInput.value.trim(), artistaInput.value.trim()]
    .filter(Boolean)
    .join(" ");

  if (!query) {
    setResultsMessage("Escribe cancion o artista para buscar.");
    return;
  }

  setResultsMessage("Buscando...");

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("search_failed");
    }

    const data = await response.json();
    const items = Array.isArray(data.results) ? data.results : [];
    clearNode(resultadosEl);

    if (!items.length) {
      setResultsMessage("No se encontraron canciones.");
      return;
    }

    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "spotify-item";

      const img = document.createElement("img");
      img.className = "spotify-portada";
      img.src = item.artworkUrl100 || "";
      img.alt = item.trackName || "Portada";
      row.appendChild(img);

      const info = document.createElement("div");
      info.className = "spotify-info";
      info.appendChild(createTextDiv("spotify-titulo", item.trackName || ""));
      info.appendChild(createTextDiv("spotify-artista", item.artistName || ""));
      row.appendChild(info);

      row.addEventListener("click", () => {
        cancionInput.value = item.trackName || "";
        artistaInput.value = item.artistName || "";
        portadaInput.value = item.artworkUrl100 || "";
      });

      resultadosEl.appendChild(row);
    });
  } catch (_error) {
    setResultsMessage("No se pudo buscar. Puedes completar los campos manualmente.");
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const titulo = tituloInput.value.trim();
  if (!titulo) {
    return;
  }

  const recuerdos = loadRecuerdos();
  recuerdos.push({
    titulo,
    cancion: cancionInput.value.trim(),
    artista: artistaInput.value.trim(),
    portada: portadaInput.value.trim(),
    nota: notaInput.value.trim(),
    fecha: formatNow()
  });
  saveRecuerdos(recuerdos);

  form.reset();
  setResultsMessage("Todavia no hay resultados.");
  renderRecuerdos();
});

buscarBtn.addEventListener("click", buscarCanciones);

setResultsMessage("Todavia no hay resultados.");
renderRecuerdos();
