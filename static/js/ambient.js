(() => {
  const audio = document.getElementById("ecoAmbientAudio");
  const toggle = document.getElementById("ambientToggle");
  if (!audio || !toggle) return;

  const STORAGE_KEY = "eco_ambient_enabled";
  const VOLUME = 0.18;
  const stateLabel = toggle.querySelector(".ambient-toggle-state");
  const pathname = window.location.pathname;
  let enabled = false;
  let blockedByMedia = false;

  const routeAllowsAmbient = () => {
    if (pathname === "/") return true;
    if (pathname === "/biblioteca") return true;
    if (pathname === "/capsulas/panel") return true;
    if (/^\/capsulas\/\d+\/ritual\/?$/.test(pathname)) return true;
    return false;
  };

  const pageTemporarilyBlocksAmbient = () => {
    if (!routeAllowsAmbient()) return true;
    if (document.body.classList.contains("modal-open")) return true;
    const editor = document.getElementById("detalleEditor");
    if (editor && !editor.hidden) return true;
    const capsuleForm = document.getElementById("capsulaFormulario");
    if (capsuleForm && !capsuleForm.hidden) return true;
    return blockedByMedia;
  };

  const updateToggle = () => {
    const playing = enabled && !audio.paused && !pageTemporarilyBlocksAmbient();
    toggle.classList.toggle("is-active", playing);
    toggle.classList.toggle("is-enabled", enabled);
    toggle.classList.toggle("is-unavailable", !routeAllowsAmbient());
    toggle.setAttribute("aria-pressed", enabled ? "true" : "false");
    toggle.setAttribute("aria-label", enabled ? "Desactivar melodía ambiental" : "Activar melodía ambiental");
    if (stateLabel) stateLabel.textContent = playing ? "On" : (enabled ? "En pausa" : "Off");
  };

  const pauseAmbient = () => {
    audio.pause();
    updateToggle();
  };

  const tryPlayAmbient = async () => {
    if (!enabled || pageTemporarilyBlocksAmbient()) {
      pauseAmbient();
      return;
    }
    audio.volume = VOLUME;
    try {
      await audio.play();
    } catch (_) {
      // El navegador puede exigir una interacción o el MP3 puede no estar aún instalado.
    }
    updateToggle();
  };

  const syncFromPageState = () => {
    if (pageTemporarilyBlocksAmbient()) {
      pauseAmbient();
    } else {
      tryPlayAmbient();
    }
  };

  try {
    enabled = localStorage.getItem(STORAGE_KEY) === "true";
  } catch (_) {}

  audio.volume = VOLUME;
  updateToggle();
  syncFromPageState();

  toggle.addEventListener("click", () => {
    enabled = !enabled;
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
    } catch (_) {}
    syncFromPageState();
  });

  document.addEventListener("play", (event) => {
    const media = event.target;
    if (!(media instanceof HTMLMediaElement) || media === audio) return;
    blockedByMedia = true;
    pauseAmbient();
  }, true);

  const releaseMediaBlock = () => {
    const otherMediaPlaying = Array.from(document.querySelectorAll("audio, video"))
      .some((media) => media !== audio && !media.paused && !media.ended);
    blockedByMedia = otherMediaPlaying;
    syncFromPageState();
  };

  document.addEventListener("pause", (event) => {
    if (event.target instanceof HTMLMediaElement && event.target !== audio) {
      window.setTimeout(releaseMediaBlock, 0);
    }
  }, true);

  document.addEventListener("ended", (event) => {
    if (event.target instanceof HTMLMediaElement && event.target !== audio) {
      window.setTimeout(releaseMediaBlock, 0);
    }
  }, true);

  const bodyObserver = new MutationObserver(syncFromPageState);
  bodyObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"]
  });

  ["detalleEditor", "capsulaFormulario"].forEach((id) => {
    const blocker = document.getElementById(id);
    if (!blocker) return;
    const blockerObserver = new MutationObserver(syncFromPageState);
    blockerObserver.observe(blocker, {
      attributes: true,
      attributeFilter: ["hidden"]
    });
  });

  window.addEventListener("pageshow", syncFromPageState);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseAmbient();
    else syncFromPageState();
  });
})();
