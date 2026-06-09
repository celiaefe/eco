(() => {
  const audio = document.getElementById("ecoAmbientAudio");
  const toggle = document.getElementById("ambientToggle");
  if (!audio || !toggle) return;

  const STORAGE_KEY = "eco_ambient_enabled";
  const NORMAL_VOLUME = 0.16;
  const DUCKED_VOLUME = 0.04;
  const FADE_STEP = 0.01;
  const FADE_INTERVAL_MS = 35;
  const stateLabel = toggle.querySelector(".ambient-toggle-state");
  let enabled = false;
  let fadeTimer = null;

  const otherAudioIsPlaying = () => Array.from(document.querySelectorAll("audio"))
    .some((media) => media !== audio && !media.paused && !media.ended);

  const updateToggle = () => {
    const playing = enabled && !audio.paused;
    const ducked = playing && otherAudioIsPlaying();
    toggle.classList.toggle("is-active", playing);
    toggle.classList.toggle("is-enabled", enabled);
    toggle.classList.toggle("is-ducked", ducked);
    toggle.setAttribute("aria-pressed", enabled ? "true" : "false");
    toggle.setAttribute("aria-label", enabled ? "Desactivar melodía ambiental" : "Activar melodía ambiental");
    if (stateLabel) stateLabel.textContent = ducked ? "Suave" : (playing ? "On" : "Off");
  };

  const stopFade = () => {
    if (fadeTimer === null) return;
    window.clearInterval(fadeTimer);
    fadeTimer = null;
  };

  const fadeAmbientVolume = (targetVolume) => {
    stopFade();
    const target = Math.max(0, Math.min(1, targetVolume));
    if (Math.abs(audio.volume - target) < FADE_STEP) {
      audio.volume = target;
      updateToggle();
      return;
    }

    fadeTimer = window.setInterval(() => {
      const direction = audio.volume < target ? 1 : -1;
      const nextVolume = audio.volume + (FADE_STEP * direction);
      const reachedTarget = direction > 0 ? nextVolume >= target : nextVolume <= target;
      audio.volume = reachedTarget ? target : Math.max(0, Math.min(1, nextVolume));
      if (reachedTarget) {
        stopFade();
        updateToggle();
      }
    }, FADE_INTERVAL_MS);
  };

  const syncAmbientVolume = () => {
    if (!enabled || audio.paused) {
      updateToggle();
      return;
    }
    fadeAmbientVolume(otherAudioIsPlaying() ? DUCKED_VOLUME : NORMAL_VOLUME);
    updateToggle();
  };

  const pauseAmbient = () => {
    stopFade();
    audio.pause();
    updateToggle();
  };

  const tryPlayAmbient = async () => {
    if (!enabled) {
      pauseAmbient();
      return;
    }

    audio.volume = otherAudioIsPlaying() ? DUCKED_VOLUME : NORMAL_VOLUME;
    try {
      await audio.play();
    } catch (_) {
      // El navegador puede exigir una interacción antes de permitir audio.
    }
    syncAmbientVolume();
  };

  try {
    enabled = localStorage.getItem(STORAGE_KEY) === "true";
  } catch (_) {}

  audio.volume = otherAudioIsPlaying() ? DUCKED_VOLUME : NORMAL_VOLUME;
  updateToggle();
  tryPlayAmbient();

  toggle.addEventListener("click", () => {
    enabled = !enabled;
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
    } catch (_) {}
    if (enabled) tryPlayAmbient();
    else pauseAmbient();
  });

  document.addEventListener("play", (event) => {
    if (event.target instanceof HTMLAudioElement && event.target !== audio) {
      syncAmbientVolume();
    }
  }, true);

  const restoreAmbientAudioIfNeeded = (event) => {
    if (!(event.target instanceof HTMLAudioElement) || event.target === audio) return;
    window.setTimeout(syncAmbientVolume, 0);
  };

  document.addEventListener("pause", restoreAmbientAudioIfNeeded, true);
  document.addEventListener("ended", restoreAmbientAudioIfNeeded, true);
  document.addEventListener("emptied", restoreAmbientAudioIfNeeded, true);
  document.addEventListener("abort", restoreAmbientAudioIfNeeded, true);

  const audioTreeObserver = new MutationObserver((mutations) => {
    const audioTreeChanged = mutations.some((mutation) =>
      [...mutation.addedNodes, ...mutation.removedNodes].some((node) =>
        node instanceof HTMLAudioElement || node.querySelector?.("audio")
      )
    );
    if (audioTreeChanged) window.setTimeout(syncAmbientVolume, 0);
  });
  audioTreeObserver.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("pageshow", tryPlayAmbient);
})();
