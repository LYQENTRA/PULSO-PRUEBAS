/* =====================================================
   PULSO — LYQENTRA
   MOTOR MUSICAL LOCAL — FASE 1
   Biblioteca, reproducción y cola
===================================================== */

"use strict";

const $ = (id) => document.getElementById(id);

const menuBtn = $("menuBtn");
const drawer = $("drawer");
const overlay = $("drawerOverlay");
const searchBtn = $("searchBtn");
const searchPanel = $("searchPanel");
const searchInput = $("searchInput");
const settingsModal = $("settingsModal");
const visualizer = $("visualizerCircle");
const visualizerBars = $("visualizerBars");
const visualStage = document.querySelector(".visual-stage");
const albumArt = $("albumArt");
const queueToggle = $("queueToggle");
const queueList = $("queueList");
const queueBtn = $("queueBtn");
const queuePanel = $("queuePanel");
const playBtn = $("playBtn");
const favoriteBtn = $("favoriteBtn");
const progressBar = $("progressBar");
const audioPlayer = $("audioPlayer");
const musicFileInput = $("musicFileInput");

let currentVisual = "circle";
let visualFrame = 0;
let isFavorite = false;
let isQueueOpen = true;
let isSearchOpen = false;
let playlist = [];
let currentIndex = -1;
let repeatMode = "off";
let shuffleEnabled = false;
let audioContext = null;
let analyser = null;
let frequencyData = null;
let animationId = null;
let currentObjectUrl = null;

/* MENÚ LATERAL */

function openMenu() {
  drawer.classList.add("open");
  overlay.classList.add("show");
  menuBtn.setAttribute("aria-expanded", "true");
}

function closeMenu() {
  drawer.classList.remove("open");
  overlay.classList.remove("show");
  menuBtn.setAttribute("aria-expanded", "false");
}

menuBtn.addEventListener("click", () => {
  drawer.classList.contains("open") ? closeMenu() : openMenu();
});

overlay.addEventListener("click", closeMenu);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenu();
    if (!settingsModal.hidden) settingsModal.hidden = true;
  }
});

/* NAVEGACIÓN */

const menuItems = document.querySelectorAll(".menu-item");

const screenNames = {
  inicio: "Inicio",
  biblioteca: "Biblioteca",
  albumes: "Álbumes",
  artistas: "Artistas",
  carpetas: "Carpetas",
  favoritos: "Favoritos",
  listas: "Listas de reproducción",
  ecualizador: "Ecualizador",
  configuracion: "Configuración"
};

function navigate(screen) {
  closeMenu();

  menuItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.screen === screen);
  });

  if (screen === "configuracion") {
    settingsModal.hidden = false;
    return;
  }

  $("playerScreen").hidden = false;
  $("secondaryScreen").hidden = screen === "inicio";

  if (screen === "inicio") return;

  $("screenTitle").textContent = screenNames[screen] || "PULSO";
  const content = $("screenContent");
  content.innerHTML = "";

  if (screen === "biblioteca") {
    renderLibrary(content);
  } else {
    const message = document.createElement("p");
    message.textContent = "Esta sección se habilitará en una siguiente etapa.";
    content.appendChild(message);
  }
}

menuItems.forEach((item) => {
  item.addEventListener("click", () => navigate(item.dataset.screen));
});

/* BUSCADOR */

searchBtn.addEventListener("click", () => {
  isSearchOpen = !isSearchOpen;
  searchPanel.hidden = !isSearchOpen;
  if (isSearchOpen) searchInput.focus();
  else searchInput.value = "";
});

searchInput.addEventListener("input", () => {
  if (!$("secondaryScreen").hidden &&
      $("screenTitle").textContent === "Biblioteca") {
    renderLibrary($("screenContent"), searchInput.value);
  }
});

/* CONFIGURACIÓN */

function openSettings() {
  closeMenu();
  settingsModal.hidden = false;
}

$("moreBtn").addEventListener("click", openSettings);

$("closeSettings").addEventListener("click", () => {
  settingsModal.hidden = true;
});

settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) settingsModal.hidden = true;
});

/* VISUALIZADORES */

function createBars() {
  visualizerBars.innerHTML = "";

  for (let i = 0; i < 56; i++) {
    const bar = document.createElement("div");
    bar.className = "visual-bar";
    bar.dataset.index = i;
    bar.style.setProperty("--angle", `${(360 / 56) * i}deg`);
    visualizerBars.appendChild(bar);
  }
}

function selectVisual(type) {
  const valid = ["circle", "bars", "wave", "mirror"];
  if (!valid.includes(type)) return;

  currentVisual = type;
  visualStage.classList.toggle("cover-background", type === "bars");

  if (albumArt && albumArt.src) {
    visualStage.style.setProperty(
      "--current-cover",
      `url("${albumArt.src}")`
    );
  }

  visualizer.classList.remove("mode-bars", "mode-wave", "mode-mirror");
  if (type !== "circle") visualizer.classList.add(`mode-${type}`);

  document.querySelectorAll("[data-visual]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.visual === type);
  });

  try {
    localStorage.setItem("pulso_visual", type);
  } catch (error) {
    console.warn("No se pudo guardar el visualizador.");
  }

  createBars();
}

document.querySelectorAll("[data-visual]").forEach((button) => {
  button.addEventListener("click", () => selectVisual(button.dataset.visual));
});

/* =====================================================
   BIBLIOTECA MUSICAL LOCAL
===================================================== */

function addMusicFiles(files) {
  const audioFiles = Array.from(files).filter((file) =>
    file.type.startsWith("audio/") ||
    /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|webm)$/i.test(file.name)
  );

  if (!audioFiles.length) {
    alert("No se encontraron archivos de audio compatibles.");
    return;
  }

  const known = new Set(
    playlist.map((track) =>
      `${track.file.name}_${track.file.size}_${track.file.lastModified}`
    )
  );

  audioFiles.forEach((file) => {
    const key = `${file.name}_${file.size}_${file.lastModified}`;

    if (known.has(key)) return;

    playlist.push({
      file,
      title: cleanTitle(file.name),
      artist: "Artista desconocido",
      url: null
    });

    known.add(key);
  });

  renderQueue();

  if (currentIndex === -1 && playlist.length) {
    loadTrack(0, false);
  }

  if (
    !$("secondaryScreen").hidden &&
    $("screenTitle").textContent === "Biblioteca"
  ) {
    renderLibrary($("screenContent"));
  }
}

function cleanTitle(filename) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

musicFileInput.addEventListener("change", (event) => {
  addMusicFiles(event.target.files);
  event.target.value = "";
});

/* =====================================================
   MOSTRAR BIBLIOTECA
===================================================== */

function renderLibrary(container, filter = "") {
  container.innerHTML = "";

  const addButton = document.createElement("button");

  addButton.className = "play-btn";
  addButton.type = "button";
  addButton.textContent = "＋ Agregar música";

  addButton.addEventListener("click", () => {
    musicFileInput.click();
  });

  container.appendChild(addButton);

  const heading = document.createElement("p");

  heading.textContent = playlist.length
    ? `${playlist.length} canción(es) agregada(s) en esta sesión`
    : "Todavía no has agregado canciones.";

  container.appendChild(heading);

  const query = filter.trim().toLowerCase();

  playlist.forEach((track, index) => {
    if (
      query &&
      !`${track.title} ${track.artist}`
        .toLowerCase()
        .includes(query)
    ) {
      return;
    }

    const row = document.createElement("button");

    row.type = "button";
    row.className = "library-track";
    row.textContent = `${index + 1}. ${track.title}`;

    row.addEventListener("click", () => {
      loadTrack(index, true);
    });

    container.appendChild(row);
  });
}

/* =====================================================
   REPRODUCTOR DE AUDIO
===================================================== */

function loadTrack(index, autoplay = true) {
  if (index < 0 || index >= playlist.length) return;

  const track = playlist[index];

  currentIndex = index;

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
  }

  currentObjectUrl = URL.createObjectURL(track.file);
  track.url = currentObjectUrl;

  audioPlayer.src = currentObjectUrl;
  audioPlayer.load();

  $("songTitle").textContent = track.title;
  $("songArtist").textContent = track.artist;

  $("currentTime").textContent = "0:00";
  $("duration").textContent = "0:00";

  progressBar.value = 0;

  isFavorite = false;

  favoriteBtn.textContent = "♡";
  favoriteBtn.style.color = "var(--white)";
  favoriteBtn.setAttribute("aria-pressed", "false");

  if (autoplay) {
    const promise = audioPlayer.play();

    if (promise && promise.catch) {
      promise.catch(() => {
        setPlayingState(false);

        alert(
          "El navegador no pudo reproducir este archivo. Prueba con MP3, M4A, WAV u OGG."
        );
      });
    }
  } else {
    setPlayingState(false);
  }

  renderQueue();
  updateCoverBackground();
}

function setPlayingState(playing) {
  isPlaying = playing;

  playBtn.textContent = playing ? "Ⅱ" : "▶";

  playBtn.setAttribute(
    "aria-label",
    playing ? "Pausar" : "Reproducir"
  );
}

playBtn.addEventListener("click", async () => {
  if (currentIndex === -1) {
    musicFileInput.click();
    return;
  }

  if (audioPlayer.paused) {
    try {
      await setupAudioAnalyser();
      await audioPlayer.play();
    } catch (error) {
      console.warn("No se pudo iniciar la reproducción:", error);
    }
  } else {
    audioPlayer.pause();
  }
});

audioPlayer.addEventListener("play", () => {
  setPlayingState(true);
});

audioPlayer.addEventListener("pause", () => {
  setPlayingState(false);
});

/* =====================================================
   DURACIÓN Y PROGRESO
===================================================== */

audioPlayer.addEventListener("loadedmetadata", () => {
  durationLabel.textContent = formatTime(audioPlayer.duration);

  progressBar.max = Number.isFinite(audioPlayer.duration)
    ? audioPlayer.duration
    : 0;
});

audioPlayer.addEventListener("timeupdate", () => {
  if (!progressBar.matches(":active")) {
    progressBar.value = audioPlayer.currentTime;
  }

  currentTimeLabel.textContent =
    formatTime(audioPlayer.currentTime);
});

progressBar.addEventListener("input", () => {
  if (Number.isFinite(audioPlayer.duration)) {
    audioPlayer.currentTime = Number(progressBar.value);
  }
});

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";

  const mins = Math.floor(seconds / 60);

  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${mins}:${secs}`;
}

/* =====================================================
   SIGUIENTE Y ANTERIOR
===================================================== */

function playNext() {
  if (!playlist.length) return;

  let next;

  if (shuffleEnabled && playlist.length > 1) {
    do {
      next = Math.floor(Math.random() * playlist.length);
    } while (next === currentIndex);
  } else {
    next = currentIndex + 1;
  }

  if (next >= playlist.length) {
    if (repeatMode === "all") {
      next = 0;
    } else {
      setPlayingState(false);
      return;
    }
  }

  loadTrack(next, true);
}

function playPrevious() {
  if (!playlist.length) return;

  if (audioPlayer.currentTime > 3) {
    audioPlayer.currentTime = 0;
    return;
  }

  let previous = currentIndex - 1;

  if (previous < 0) {
    previous = repeatMode === "all"
      ? playlist.length - 1
      : 0;
  }

  loadTrack(previous, true);
}

$("previousBtn").addEventListener("click", playPrevious);
$("nextBtn").addEventListener("click", playNext);

/* =====================================================
   REPETICIÓN AUTOMÁTICA
===================================================== */

audioPlayer.addEventListener("ended", () => {
  if (repeatMode === "one") {
    audioPlayer.currentTime = 0;
    audioPlayer.play();
  } else {
    playNext();
  }
});

/* =====================================================
   COLA DE REPRODUCCIÓN
===================================================== */

function renderQueue() {
  queueList.innerHTML = "";

  if (!playlist.length) {
    const empty = document.createElement("div");

    empty.className = "empty-queue";
    empty.textContent = "Tu próxima música aparecerá aquí.";

    queueList.appendChild(empty);
    return;
  }

  playlist.forEach((track, index) => {
    const row = document.createElement("button");

    row.type = "button";
    row.className = "queue-track";

    if (index === currentIndex) {
      row.classList.add("active");
    }

    row.textContent =
      `${index === currentIndex ? "▶ " : ""}${track.title}`;

    row.addEventListener("click", () => {
      loadTrack(index, true);
    });

    queueList.appendChild(row);
  });
}

function toggleQueue() {
  isQueueOpen = !isQueueOpen;

  queueList.hidden = !isQueueOpen;

  queueToggle.textContent =
    isQueueOpen ? "⌃" : "⌄";

  queueToggle.setAttribute(
    "aria-expanded",
    String(isQueueOpen)
  );
}

queueToggle.addEventListener("click", toggleQueue);

queueBtn.addEventListener("click", () => {
  queuePanel.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });

  if (!isQueueOpen) {
    toggleQueue();
  }
});

/* =====================================================
   FAVORITOS
===================================================== */

favoriteBtn.addEventListener("click", () => {
  isFavorite = !isFavorite;

  favoriteBtn.textContent =
    isFavorite ? "♥" : "♡";

  favoriteBtn.style.color =
    isFavorite ? "var(--neon)" : "var(--white)";

  favoriteBtn.setAttribute(
    "aria-pressed",
    String(isFavorite)
  );
});

/* =====================================================
   REPETICIÓN Y MODO ALEATORIO
===================================================== */

$("repeatBtn").addEventListener("click", (event) => {
  repeatMode =
    repeatMode === "off"
      ? "all"
      : repeatMode === "all"
        ? "one"
        : "off";

  event.currentTarget.classList.toggle(
    "selected",
    repeatMode !== "off"
  );

  event.currentTarget.setAttribute(
    "aria-label",
    `Repetir: ${repeatMode}`
  );
});

$("shuffleBtn").addEventListener("click", (event) => {
  shuffleEnabled = !shuffleEnabled;

  event.currentTarget.classList.toggle(
    "selected",
    shuffleEnabled
  );
});

/* =====================================================
   ANALIZADOR DE AUDIO REAL
===================================================== */

async function setupAudioAnalyser() {
  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass || analyser) return;

  audioContext = new AudioContextClass();

  const source =
    audioContext.createMediaElementSource(audioPlayer);

  analyser = audioContext.createAnalyser();

  analyser.fftSize = 128;
  analyser.smoothingTimeConstant = 0.82;

  source.connect(analyser);
  analyser.connect(audioContext.destination);

  frequencyData =
    new Uint8Array(analyser.frequencyBinCount);

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

/* Activar el analizador también cuando una canción
   comienza desde la biblioteca o desde la cola. */

audioPlayer.addEventListener("playing", () => {
  setupAudioAnalyser().catch((error) => {
    console.warn("Analizador de audio no disponible:", error);
  });
});

/* =====================================================
   ANIMACIÓN DEL VISUALIZADOR
===================================================== */

function animateVisualizer() {
  const bars = visualizerBars.children;
  const total = bars.length;

  if (analyser && frequencyData && isPlaying) {
    analyser.getByteFrequencyData(frequencyData);
  }

  for (let i = 0; i < total; i++) {
    const bar = bars[i];

    let value;

    if (analyser && frequencyData && isPlaying) {
      const bin = Math.floor(
        (i / total) * frequencyData.length
      );

      value = frequencyData[bin] / 255 * 100;
    } else {
      const position =
        currentVisual === "mirror"
          ? Math.min(i, total - 1 - i)
          : i;

      const wave1 = Math.sin(
        position * 0.35 + visualFrame * 0.045
      );

      const wave2 = Math.cos(
        position * 0.18 - visualFrame * 0.03
      );

      value = isPlaying
        ? Math.abs(wave1 * 38 + wave2 * 24) + 8
        : 5 + Math.abs(wave1 * 5);
    }

    if (currentVisual === "circle") {
      bar.style.height =
        `${12 + value * 0.45}px`;
    } else {
      bar.style.setProperty(
        "--level",
        `${Math.max(4, 10 + value * 0.8)}%`
      );
    }
  }

  visualFrame++;

  animationId = requestAnimationFrame(
    animateVisualizer
  );
}

/* =====================================================
   FONDO DE CARÁTULA
===================================================== */

function updateCoverBackground() {
  if (albumArt && albumArt.src) {
    visualStage.style.setProperty(
      "--current-cover",
      `url("${albumArt.src}")`
    );
  }
}

/* =====================================================
   CARGAR PREFERENCIAS
===================================================== */

function loadPreferences() {
  let savedVisual = null;

  try {
    savedVisual = localStorage.getItem("pulso_visual");
  } catch (error) {
    console.warn("No se pudieron leer las preferencias.");
  }

  selectVisual(
    ["circle", "bars", "wave", "mirror"].includes(savedVisual)
      ? savedVisual
      : "circle"
  );
}

/* =====================================================
   INICIALIZACIÓN
===================================================== */

function initializePulso() {
  createBars();

  loadPreferences();

  renderQueue();

  setPlayingState(false);

  animateVisualizer();

  queueList.hidden = false;

  queueToggle.textContent = "⌃";

  queueToggle.setAttribute(
    "aria-expanded",
    "true"
  );

  console.log(
    "PULSO: motor musical local inicializado."
  );
}

/* INICIAR APLICACIÓN */

initializePulso();

/*
  IMPORTANTE:
  Los archivos seleccionados se conservan durante
  esta sesión del navegador.

  La biblioteca permanente, los metadatos y la
  extracción de carátulas se implementarán después
  en la versión nativa de Android.
*/
