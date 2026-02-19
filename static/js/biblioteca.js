const modal = document.getElementById("detalle");
const cerrar = document.getElementById("detalleCerrar");
const coverEl = document.getElementById("detalleCover");
const fechaEl = document.getElementById("detalleFecha");
const cancionEl = document.getElementById("detalleCancion");
const notaEl = document.getElementById("detalleNota");
const audioEl = document.getElementById("detalleAudio");
const toastEl = document.getElementById("toastMsg");

const searchInput = document.getElementById("bibliotecaSearch");
const filtroFavoritos = document.getElementById("filtroFavoritos");
const filtroFoto = document.getElementById("filtroFoto");
const filtroAnio = document.getElementById("filtroAnio");
const ordenSelect = document.getElementById("bibliotecaOrden");
const vistaSelect = document.getElementById("vistaBiblioteca");
const limpiarBtn = document.getElementById("bibliotecaLimpiar");
const moodEl = document.getElementById("bibMood");
const bibliotecaMain = document.querySelector(".biblioteca-secciones");

const secciones = document.querySelectorAll(".seccion-balda");
const vacioEl = document.getElementById("bibEmpty");
const favoritosSection = document.getElementById("favoritosSection");
const favoritosShelf = document.getElementById("favoritosShelf");

const editarTitulo = document.getElementById("editarTitulo");
const editarCancion = document.getElementById("editarCancion");
const editarArtista = document.getElementById("editarArtista");
const editarNota = document.getElementById("editarNota");
const editarFoto = document.getElementById("editarFoto");
const detallePreviewCover = document.getElementById("detallePreviewCover");
const guardarCambiosBtn = document.getElementById("guardarCambiosBtn");
const borrarRecuerdoBtn = document.getElementById("borrarRecuerdoBtn");
const toggleEditorBtn = document.getElementById("toggleEditorBtn");
const detalleEditor = document.getElementById("detalleEditor");

let recuerdoActivoId = null;
let toastTimer = null;

function showToast(msg, tipo = "ok") {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.dataset.tipo = tipo;
  toastEl.hidden = false;
  toastEl.classList.add("visible");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("visible");
    toastEl.hidden = true;
  }, 2400);
}

function normalizar(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function parseFechaRecuerdo(fechaStr) {
  if (!fechaStr) return 0;
  const match = String(fechaStr).match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return 0;
  const [, dd, mm, yyyy, hh = "00", min = "00"] = match;
  const fecha = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
  const ts = fecha.getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function aplicarCoverEnVinilo(vinilo) {
  const cover = vinilo?.dataset.cover || "";
  vinilo?.style.setProperty("--cover-url", cover ? `url('${cover}')` : "none");
}

function reconstruirSeparadores(estanteria) {
  if (!estanteria) return;
  estanteria.querySelectorAll(".estanteria-separador").forEach((sep) => sep.remove());
  const items = Array.from(estanteria.querySelectorAll(".vinilo-lomo"));
  items.forEach((item, idx) => {
    if ((idx + 1) % 10 === 0) {
      const sep = document.createElement("div");
      sep.className = "estanteria-separador balda";
      sep.setAttribute("aria-hidden", "true");
      item.insertAdjacentElement("afterend", sep);
    }
  });
}

function obtenerComparador() {
  const orden = ordenSelect?.value || "date_desc";
  if (orden === "date_asc") return (a, b) => parseFechaRecuerdo(a.dataset.fecha) - parseFechaRecuerdo(b.dataset.fecha);
  if (orden === "title_asc") return (a, b) => normalizar(a.dataset.titulo).localeCompare(normalizar(b.dataset.titulo), "es");
  return (a, b) => parseFechaRecuerdo(b.dataset.fecha) - parseFechaRecuerdo(a.dataset.fecha);
}

function ordenarEstanteria(estanteria) {
  if (!estanteria) return;
  const vinilos = Array.from(estanteria.querySelectorAll(".vinilo-lomo"));
  vinilos.sort(obtenerComparador());
  vinilos.forEach((v) => estanteria.appendChild(v));
  reconstruirSeparadores(estanteria);
}

function ordenarTodasLasEstanterias() {
  document.querySelectorAll(".estanteria").forEach((estanteria) => ordenarEstanteria(estanteria));
}

function actualizarFavoritoEnVista(recuerdoId, favorito) {
  document.querySelectorAll(`.vinilo-lomo[data-id="${recuerdoId}"]`).forEach((vinilo) => {
    vinilo.dataset.favorito = favorito ? "1" : "0";
    const estrella = vinilo.querySelector("[data-fav-toggle]");
    if (estrella) {
      estrella.classList.toggle("es-favorito", !!favorito);
      estrella.setAttribute("aria-pressed", favorito ? "true" : "false");
    }
  });
}

function insertarEnFavoritos(recuerdoId, origen) {
  if (!favoritosShelf || favoritosShelf.querySelector(`.vinilo-lomo[data-id="${recuerdoId}"]`)) return;
  const base = origen || document.querySelector(`.vinilo-lomo[data-id="${recuerdoId}"]`);
  if (!base) return;

  const nuevo = base.cloneNode(true);
  nuevo.dataset.favorito = "1";
  aplicarCoverEnVinilo(nuevo);
  const estrella = nuevo.querySelector("[data-fav-toggle]");
  if (estrella) {
    estrella.classList.add("es-favorito");
    estrella.setAttribute("aria-pressed", "true");
  }

  favoritosShelf.prepend(nuevo);
  ordenarEstanteria(favoritosShelf);
  if (favoritosSection) favoritosSection.hidden = false;
}

function quitarDeFavoritos(recuerdoId) {
  if (!favoritosShelf) return;
  favoritosShelf.querySelectorAll(`.vinilo-lomo[data-id="${recuerdoId}"]`).forEach((v) => v.remove());
  reconstruirSeparadores(favoritosShelf);
  if (favoritosSection && favoritosShelf.querySelectorAll(".vinilo-lomo").length === 0) {
    favoritosSection.hidden = true;
  }
}

function aplicarFiltroYBusqueda() {
  const query = normalizar(searchInput?.value || "");
  const soloFav = !!filtroFavoritos?.checked;
  const soloFoto = !!filtroFoto?.checked;
  const anio = filtroAnio?.value || "";

  let totalVisibles = 0;
  document.querySelectorAll(".vinilo-lomo").forEach((btn) => {
    const indiceBusqueda = normalizar([btn.dataset.nota, btn.dataset.titulo, btn.dataset.cancion, btn.dataset.artista].join(" "));
    const cumpleBusqueda = !query || indiceBusqueda.includes(query);
    const cumpleFav = !soloFav || btn.dataset.favorito === "1";
    const cumpleFoto = !soloFoto || btn.dataset.foto === "1";
    const cumpleAnio = !anio || btn.dataset.year === anio;

    const visible = cumpleBusqueda && cumpleFav && cumpleFoto && cumpleAnio;
    btn.style.display = visible ? "" : "none";
    if (visible) totalVisibles += 1;
  });

  secciones.forEach((seccion) => {
    if (seccion.hidden) return;
    const visiblesEnSeccion = Array.from(seccion.querySelectorAll(".vinilo-lomo")).filter((v) => v.style.display !== "none").length;
    seccion.style.display = visiblesEnSeccion > 0 ? "" : "none";
    seccion.querySelectorAll(".estanteria-separador").forEach((sep) => {
      sep.style.display = query ? "none" : "";
    });
  });

  if (vacioEl) vacioEl.hidden = totalVisibles > 0;
}

function refrescarVistaBiblioteca() {
  ordenarTodasLasEstanterias();
  aplicarFiltroYBusqueda();
}

function setVista(tipo) {
  if (!bibliotecaMain) return;
  bibliotecaMain.classList.toggle("vista-tarjetas", tipo === "cards");
  try {
    localStorage.setItem("eco_biblioteca_vista", tipo);
  } catch (_) {}
}

function abrirDetalleDesdeVinilo(btn) {
  if (!btn) return;
  recuerdoActivoId = btn.dataset.id || null;

  const cover = btn.dataset.cover || "";
  const cancion = btn.dataset.cancion || "";
  const artista = btn.dataset.artista || "";
  const fecha = btn.dataset.fecha || "";

  coverEl.style.backgroundImage = cover ? `url('${cover}')` : "none";
  fechaEl.textContent = fecha ? `Anotado: ${fecha}` : "Anotado sin fecha";
  cancionEl.textContent = artista ? `${cancion} · ${artista}` : cancion;
  notaEl.textContent = btn.dataset.nota || "";

  editarTitulo.value = btn.dataset.titulo || "";
  editarCancion.value = cancion;
  editarArtista.value = artista;
  editarNota.value = btn.dataset.nota || "";
  if (editarFoto) editarFoto.value = "";
  if (detallePreviewCover) detallePreviewCover.style.backgroundImage = cover ? `url('${cover}')` : "none";

  const preview = btn.dataset.preview || "";
  audioEl.src = preview;
  audioEl.style.display = preview ? "block" : "none";

  if (detalleEditor) detalleEditor.hidden = true;
  toggleEditorBtn?.setAttribute("aria-expanded", "false");

  modal.classList.add("abierto");
  modal.setAttribute("aria-hidden", "false");
}

function cerrarModal() {
  modal.classList.remove("abierto");
  modal.setAttribute("aria-hidden", "true");
  audioEl.pause();
  audioEl.src = "";
  recuerdoActivoId = null;
  if (detalleEditor) detalleEditor.hidden = true;
  toggleEditorBtn?.setAttribute("aria-expanded", "false");
}

function actualizarRecuerdoEnDOM(recuerdo) {
  document.querySelectorAll(`.vinilo-lomo[data-id="${recuerdo.id}"]`).forEach((vinilo) => {
    vinilo.dataset.titulo = recuerdo.titulo || "";
    vinilo.dataset.cancion = recuerdo.cancion || "";
    vinilo.dataset.artista = recuerdo.artista || "";
    vinilo.dataset.nota = recuerdo.nota || "";
    vinilo.dataset.fecha = recuerdo.fecha || "";
    if (recuerdo.foto_personal) {
      vinilo.dataset.foto = "1";
      if (recuerdo.foto_url) {
        vinilo.dataset.cover = recuerdo.foto_url;
      }
    }
    aplicarCoverEnVinilo(vinilo);

    const lomoMomento = vinilo.querySelector(".lomo-momento");
    if (lomoMomento) lomoMomento.textContent = recuerdo.nota || recuerdo.titulo || "";
  });
}

async function toggleFavorito(recuerdoId) {
  const resp = await fetch("/biblioteca/favorito", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: recuerdoId })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || "No se pudo actualizar favorito");
  return data;
}

async function guardarEdicionRecuerdo(recuerdoId, payload) {
  const resp = await fetch(`/recuerdos/${encodeURIComponent(recuerdoId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || "No se pudo guardar");
  return data;
}

async function subirFotoRecuerdo(recuerdoId, file) {
  const form = new FormData();
  form.append("foto_personal", file);
  const resp = await fetch(`/recuerdos/${encodeURIComponent(recuerdoId)}/foto`, {
    method: "POST",
    body: form
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || "No se pudo subir la foto");
  return data;
}

async function borrarRecuerdo(recuerdoId) {
  const resp = await fetch(`/recuerdos/${encodeURIComponent(recuerdoId)}`, { method: "DELETE" });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || "No se pudo borrar");
  return data;
}

async function manejarToggleFavorito(estrella) {
  const vinilo = estrella.closest(".vinilo-lomo");
  if (!vinilo) return;
  const recuerdoId = vinilo.dataset.id;
  if (!recuerdoId) return;

  estrella.style.pointerEvents = "none";
  try {
    const data = await toggleFavorito(recuerdoId);
    actualizarFavoritoEnVista(recuerdoId, data.favorito);
    if (data.favorito) {
      insertarEnFavoritos(recuerdoId, vinilo);
      showToast("Marcado como favorito");
    } else {
      quitarDeFavoritos(recuerdoId);
      showToast("Quitado de favoritos");
    }
    refrescarVistaBiblioteca();
  } catch (err) {
    showToast(err.message || "No se pudo actualizar favorito", "error");
  } finally {
    estrella.style.pointerEvents = "";
  }
}

document.addEventListener("click", (e) => {
  const estrella = e.target.closest("[data-fav-toggle]");
  if (estrella) {
    e.stopPropagation();
    manejarToggleFavorito(estrella);
    return;
  }

  const vinilo = e.target.closest(".vinilo-lomo");
  if (vinilo) abrirDetalleDesdeVinilo(vinilo);
});

document.addEventListener("keydown", (e) => {
  const estrella = e.target.closest?.("[data-fav-toggle]");
  if (!estrella) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    manejarToggleFavorito(estrella);
  }
});

editarFoto?.addEventListener("change", () => {
  const file = editarFoto.files?.[0];
  if (!file || !detallePreviewCover) return;
  const tmpUrl = URL.createObjectURL(file);
  detallePreviewCover.style.backgroundImage = `url('${tmpUrl}')`;
});

guardarCambiosBtn?.addEventListener("click", async () => {
  if (!recuerdoActivoId) return;
  guardarCambiosBtn.disabled = true;

  try {
    const payload = {
      titulo: editarTitulo.value,
      cancion: editarCancion.value,
      artista: editarArtista.value,
      nota: editarNota.value
    };

    const editRes = await guardarEdicionRecuerdo(recuerdoActivoId, payload);
    if (!editRes?.ok || !editRes.recuerdo) return;

    if (editarFoto?.files?.[0]) {
      const fotoRes = await subirFotoRecuerdo(recuerdoActivoId, editarFoto.files[0]);
      editRes.recuerdo.foto_personal = fotoRes.foto_personal;
      editRes.recuerdo.foto_url = fotoRes.foto_url;
      showToast("Recuerdo y foto actualizados");
    } else {
      showToast("Recuerdo actualizado");
    }

    actualizarRecuerdoEnDOM(editRes.recuerdo);
    const actualizado = document.querySelector(`.vinilo-lomo[data-id="${recuerdoActivoId}"]`);
    abrirDetalleDesdeVinilo(actualizado);
    refrescarVistaBiblioteca();
  } catch (err) {
    showToast(err.message || "No se pudo guardar", "error");
  } finally {
    guardarCambiosBtn.disabled = false;
  }
});

borrarRecuerdoBtn?.addEventListener("click", async () => {
  if (!recuerdoActivoId) return;
  const confirmar = window.confirm("¿Seguro que quieres borrar este recuerdo?");
  if (!confirmar) return;

  borrarRecuerdoBtn.disabled = true;
  try {
    const data = await borrarRecuerdo(recuerdoActivoId);
    document.querySelectorAll(`.vinilo-lomo[data-id="${data.id}"]`).forEach((v) => v.remove());

    if (favoritosShelf) reconstruirSeparadores(favoritosShelf);
    if (favoritosSection && favoritosShelf && favoritosShelf.querySelectorAll(".vinilo-lomo").length === 0) {
      favoritosSection.hidden = true;
    }

    cerrarModal();
    refrescarVistaBiblioteca();
    showToast("Recuerdo borrado");
  } catch (err) {
    showToast(err.message || "No se pudo borrar", "error");
  } finally {
    borrarRecuerdoBtn.disabled = false;
  }
});

cerrar?.addEventListener("click", cerrarModal);
modal?.addEventListener("click", (e) => {
  if (e.target === modal) cerrarModal();
});

searchInput?.addEventListener("input", aplicarFiltroYBusqueda);
filtroFavoritos?.addEventListener("change", aplicarFiltroYBusqueda);
filtroFoto?.addEventListener("change", aplicarFiltroYBusqueda);
filtroAnio?.addEventListener("change", aplicarFiltroYBusqueda);
ordenSelect?.addEventListener("change", refrescarVistaBiblioteca);
vistaSelect?.addEventListener("change", () => setVista(vistaSelect.value));

limpiarBtn?.addEventListener("click", () => {
  if (searchInput) searchInput.value = "";
  if (filtroFavoritos) filtroFavoritos.checked = false;
  if (filtroFoto) filtroFoto.checked = false;
  if (filtroAnio) filtroAnio.value = "";
  if (ordenSelect) ordenSelect.value = "date_desc";
  if (vistaSelect) vistaSelect.value = "spines";
  setVista("spines");
  refrescarVistaBiblioteca();
});

toggleEditorBtn?.addEventListener("click", () => {
  if (!detalleEditor) return;
  const abierto = detalleEditor.hidden;
  detalleEditor.hidden = !abierto;
  toggleEditorBtn.setAttribute("aria-expanded", abierto ? "true" : "false");
});

const frasesMood = [
  "Cada lomo guarda un latido.",
  "Hoy también puedes volver a un eco.",
  "Tus canciones sostienen memoria.",
  "Respira: aquí los recuerdos suenan suave."
];

function refrescarMood() {
  if (!moodEl) return;
  moodEl.textContent = frasesMood[Math.floor(Math.random() * frasesMood.length)];
}

try {
  const vistaGuardada = localStorage.getItem("eco_biblioteca_vista");
  if (vistaGuardada && vistaSelect) {
    vistaSelect.value = vistaGuardada;
  }
} catch (_) {}

setVista(vistaSelect?.value || "spines");
document.querySelectorAll(".vinilo-lomo").forEach(aplicarCoverEnVinilo);
refrescarMood();
window.setInterval(refrescarMood, 12000);
refrescarVistaBiblioteca();
