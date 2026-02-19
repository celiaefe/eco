let navegando = false;
const audioToggleBtn = document.getElementById("ritualAudioToggle");
let sonidoRitual = true;

try {
  const guardado = localStorage.getItem("eco_ritual_sound");
  if (guardado === "off") sonidoRitual = false;
} catch (_) {}

function refrescarAudioToggle() {
  if (!audioToggleBtn) return;
  audioToggleBtn.textContent = `Sonido: ${sonidoRitual ? "ON" : "OFF"}`;
  audioToggleBtn.setAttribute("aria-pressed", sonidoRitual ? "true" : "false");
}

function reproducirClickRitual() {
  if (!sonidoRitual) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try {
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 440;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.04, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.start(now);
    osc.stop(now + 0.2);
    window.setTimeout(() => ctx.close(), 260);
  } catch (_) {
    // Silencioso si el navegador bloquea audio.
  }
}

function navegarConTransicion(destino) {
  if (navegando) return;
  navegando = true;

  document.body.classList.add("inicio-saliendo");
  window.setTimeout(() => {
    window.location.href = destino;
  }, 260);
}

audioToggleBtn?.addEventListener("click", () => {
  sonidoRitual = !sonidoRitual;
  reproducirClickRitual();
  refrescarAudioToggle();
  try {
    localStorage.setItem("eco_ritual_sound", sonidoRitual ? "on" : "off");
  } catch (_) {}
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
    return;
  }
  navegando = false;
  document.body.classList.remove("inicio-saliendo");
});

refrescarAudioToggle();
