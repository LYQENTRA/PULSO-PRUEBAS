/* =====================================================
   PULSO — LYQENTRA
   MOTOR DE INTERFAZ PREMIUM
   IDENTIDAD FIJA VERDE NEÓN
===================================================== */

"use strict";

/* =====================================================
   ELEMENTOS PRINCIPALES
===================================================== */

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

const queueToggle = $("queueToggle");
const queueList = $("queueList");
const queueBtn = $("queueBtn");
const queuePanel = $("queuePanel");

const playBtn = $("playBtn");
const favoriteBtn = $("favoriteBtn");

const progressBar = $("progressBar");

/* =====================================================
   ESTADO DE LA APLICACIÓN
===================================================== */

let currentVisual = "circle";
let visualFrame = 0;

let isPlaying = false;
let isFavorite = false;
let isQueueOpen = true;
let isSearchOpen = false;

let animationId = null;

/* =====================================================
   MENÚ LATERAL
===================================================== */

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
  if (drawer.classList.contains("open")) {
    closeMenu();
  } else {
    openMenu();
  }
});

overlay.addEventListener("click", closeMenu);

/* Cerrar menú y ventanas con Escape */

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenu();

    if (!settingsModal.hidden) {
      settingsModal.hidden = true;
    }
  }
});

/* =====================================================
   NAVEGACIÓN
===================================================== */

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
    item.classList.toggle(
      "active",
      item.dataset.screen === screen
    );
  });

  if (screen === "configuracion") {
    settingsModal.hidden = false;
    return;
  }

  if (screen === "inicio") {
    $("playerScreen").hidden = false;
    $("secondaryScreen").hidden = true;
    return;
  }

  $("playerScreen").hidden = true;
  $("secondaryScreen").hidden = false;

  $("screenTitle").textContent =
    screenNames[screen] || "PULSO";

  const content = $("screenContent");
  content.innerHTML = "";

  const message = document.createElement("p");

  if (screen === "biblioteca") {
    message.textContent =
      "Aquí aparecerán las canciones de tu teléfono cuando conectemos la biblioteca musical.";
  } else {
    message.textContent =
      "Esta sección estará disponible al implementar el módulo correspondiente.";
  }

  content.appendChild(message);
}

menuItems.forEach((item) => {
  item.addEventListener("click", () => {
    navigate(item.dataset.screen);
  });
});

/* =====================================================
   BUSCADOR
===================================================== */

searchBtn.addEventListener("click", () => {
  isSearchOpen = !isSearchOpen;
  searchPanel.hidden = !isSearchOpen;

  if (isSearchOpen) {
    searchInput.focus();
  } else {
    searchInput.value = "";
  }
});

/* =====================================================
   CONFIGURACIÓN
===================================================== */

function openSettings() {
  closeMenu();
  settingsModal.hidden = false;
}

$("moreBtn").addEventListener("click", openSettings);

$("closeSettings").addEventListener("click", () => {
  settingsModal.hidden = true;
});

settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) {
    settingsModal.hidden = true;
  }
});

/* =====================================================
   VISUALIZADORES
===================================================== */

function createBars() {
  visualizerBars.innerHTML = "";

  const total = 56;

  for (let i = 0; i < total; i++) {
    const bar = document.createElement("div");

    bar.className = "visual-bar";
    bar.dataset.index = i;

    const angle = (360 / total) * i;

    bar.style.setProperty(
      "--angle",
      `${angle}deg`
    );

    visualizerBars.appendChild(bar);
  }
}

function selectVisual(type) {
  const validTypes = [
    "circle",
    "bars",
    "wave",
    "mirror"
  ];

  if (!validTypes.includes(type)) {
    return;
  }

  currentVisual = type;

  visualizer.classList.remove(
    "mode-bars",
    "mode-wave",
    "mode-mirror"
  );

  if (type !== "circle") {
    visualizer.classList.add(`mode-${type}`);
  }

  document.querySelectorAll("[data-visual]").forEach((button) => {
    button.classList.toggle(
      "selected",
      button.dataset.visual === type
    );
  });

  try {
    localStorage.setItem("pulso_visual", type);
  } catch (error) {
    console.warn("No se pudo guardar el visualizador.");
  }

  createBars();
}

document.querySelectorAll("[data-visual]").forEach((button) => {
  button.addEventListener("click", () => {
    selectVisual(button.dataset.visual);
  });
});

/* =====================================================
   ANIMACIÓN DEMOSTRATIVA DEL VISUALIZADOR
===================================================== */

/*
  Esta animación sirve únicamente para comprobar
  la apariencia y el movimiento de la interfaz.

  Todavía NO analiza la música.

  Cuando conectemos el motor de audio, sustituiremos
  estos valores matemáticos por datos reales de
  frecuencias mediante Web Audio API / Audio Analyser.
*/

function animateVisualizer() {
  const bars = visualizerBars.children;
  const total = bars.length;

  for (let i = 0; i < total; i++) {
    const bar = bars[i];

    let position = i;

    if (currentVisual === "mirror") {
      position = Math.min(i, total - 1 - i);
    }

    const wave1 = Math.sin(
      position * 0.35 + visualFrame * 0.08
    );

    const wave2 = Math.cos(
      position * 0.18 - visualFrame * 0.05
    );

    const wave3 = Math.sin(
      position * 0.12 + visualFrame * 0.035
    );

    const value =
      Math.abs(wave1 * 45 + wave2 * 25 + wave3 * 15) + 8;

    if (currentVisual === "circle") {
      const height = 12 + value * 0.45;
      bar.style.height = `${height}px`;
    } else {
      let height = 10 + value * 0.8;

      if (currentVisual === "mirror") {
        height *= 1.05;
      }

      bar.style.setProperty(
        "--level",
        `${height}%`
      );
    }
  }

  visualFrame++;

  animationId = requestAnimationFrame(
    animateVisualizer
  );
}

/* =====================================================
   COLA DE REPRODUCCIÓN
===================================================== */

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
   CONTROLES VISUALES DE DEMOSTRACIÓN
===================================================== */

/*
  IMPORTANTE:
  Estos controles todavía son de demostración.
  El motor de reproducción local se implementará
  en una fase posterior.
*/

playBtn.addEventListener("click", () => {
  isPlaying = !isPlaying;

  playBtn.textContent =
    isPlaying ? "Ⅱ" : "▶";

  playBtn.setAttribute(
    "aria-label",
    isPlaying ? "Pausar" : "Reproducir"
  );
});

/* Repetición */

$("repeatBtn").addEventListener("click", (event) => {
  event.currentTarget.classList.toggle("selected");
});

/* Aleatorio */

$("shuffleBtn").addEventListener("click", (event) => {
  event.currentTarget.classList.toggle("selected");
});

/* Botones anterior y siguiente */

$("previousBtn").addEventListener("click", () => {
  console.log(
    "PULSO: canción anterior pendiente del motor musical."
  );
});

$("nextBtn").addEventListener("click", () => {
  console.log(
    "PULSO: canción siguiente pendiente del motor musical."
  );
});

/* =====================================================
   PROGRESO DE DEMOSTRACIÓN
===================================================== */

progressBar.addEventListener("input", () => {
  /*
    La barra todavía no controla una canción real.
    Su funcionamiento se conectará al motor de audio.
  */
});

/* =====================================================
   CARGA DE PREFERENCIAS
===================================================== */

function loadPreferences() {
  let savedVisual = null;

  try {
    savedVisual = localStorage.getItem("pulso_visual");
  } catch (error) {
    console.warn("No se pudieron leer las preferencias.");
  }

  selectVisual(
    [
      "circle",
      "bars",
      "wave",
      "mirror"
    ].includes(savedVisual)
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

  animateVisualizer();

  queueList.hidden = false;

  queueToggle.textContent = "⌃";

  queueToggle.setAttribute(
    "aria-expanded",
    "true"
  );

  console.log(
    "PULSO: interfaz premium inicializada correctamente."
  );
}

/* INICIAR APLICACIÓN */

initializePulso();
