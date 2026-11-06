
/* =====================================
   PULSO - LYQENTRA
   Interfaz y personalización
===================================== */

const $ = (id) => document.getElementById(id);

// ELEMENTOS PRINCIPALES
const menuBtn = $("menuBtn");
const drawer = $("drawer");
const overlay = $("drawerOverlay");
const searchBtn = $("searchBtn");
const searchPanel = $("searchPanel");
const searchInput = $("searchInput");
const settingsModal = $("settingsModal");
const visualizer = $("visualizerCircle");
const visualizerBars = $("visualizerBars");
const vinyl = $("vinyl");

// ESTILOS DE VISUALIZADORES
const visualStyles = document.createElement("style");

visualStyles.textContent = `
.visualizer-circle.mode-bars {
  width: 100%;
  height: 145px;
  border: none;
  border-radius: 0;
  box-shadow: none;
  align-self: end;
  margin-bottom: 10px;
}

.mode-bars .album-center,
.mode-wave .album-center,
.mode-mirror .album-center {
  display: none;
}

.mode-bars .visualizer-bars,
.mode-wave .visualizer-bars,
.mode-mirror .visualizer-bars {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border-radius: 0;
}

.mode-bars .visual-bar {
  position: relative;
  left: auto;
  top: auto;
  margin: 0;
  width: 4px;
  height: var(--level, 25%);
  min-height: 5px;
  border-radius: 5px;
  transform: none;
  transition: height .08s linear;
}

.mode-wave .visual-bar {
  position: relative;
  left: auto;
  top: auto;
  margin: 0;
  width: 5px;
  height: var(--level, 20%);
  min-height: 5px;
  border-radius: 50%;
  transform: none;
  transition: height .08s linear;
}

.mode-mirror .visual-bar {
  position: relative;
  left: auto;
  top: auto;
  margin: 0;
  width: 4px;
  height: var(--level, 20%);
  min-height: 5px;
  border-radius: 4px;
  transform: none;
  transition: height .08s linear;
}

.visualizer-circle.mode-wave {
  border: none;
  box-shadow: none;
}

.visualizer-circle.mode-mirror {
  border: none;
  box-shadow: none;
}

.visualizer-circle.mode-wave .visualizer-bars {
  filter: drop-shadow(0 0 7px var(--neon));
}

.visualizer-circle.mode-mirror .visualizer-bars {
  filter: drop-shadow(0 0 7px var(--neon));
}

.drawer, .drawer-overlay {
  touch-action: pan-y;
}

.menu-item:focus-visible,
.icon-btn:focus-visible,
button:focus-visible {
  outline: 2px solid var(--neon);
  outline-offset: 3px;
}
`;

document.head.appendChild(visualStyles);

// TEMAS NEÓN
const themes = {
  green: {
    primary: "#39FF14",
    secondary: "#00E65A"
  },
  red: {
    primary: "#FF1744",
    secondary: "#FF668A"
  },
  blue: {
    primary: "#1677FF",
    secondary: "#66B5FF"
  },
  cyan: {
    primary: "#00D9FF",
    secondary: "#72EDFF"
  },
  purple: {
    primary: "#B026FF",
    secondary: "#D58AFF"
  },
  pink: {
    primary: "#FF00A8",
    secondary: "#FF70CE"
  },
  orange: {
    primary: "#FF6D00",
    secondary: "#FFAD55"
  },
  yellow: {
    primary: "#F5FF00",
    secondary: "#FFFF72"
  }
};

// ESTADO
let currentVisual = "circle";
let currentTheme = "green";
let visualFrame = 0;
let animationId = null;

// MENÚ DESPLEGABLE
function openMenu() {
  drawer.classList.add("open");
  overlay.classList.add("show");
}

function closeMenu() {
  drawer.classList.remove("open");
  overlay.classList.remove("show");
}

menuBtn.addEventListener("click", openMenu);
overlay.addEventListener("click", closeMenu);

// NAVEGACIÓN
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

  menuItems.forEach(item => {
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

  $("screenTitle").textContent = screenNames[screen];

  const content = $("screenContent");
  content.innerHTML = "";

  const message = document.createElement("p");
  message.textContent =
    screen === "biblioteca"
      ? "Aquí aparecerán las canciones de tu teléfono."
      : "Esta sección estará disponible al conectar la biblioteca musical.";

  content.appendChild(message);
}

menuItems.forEach(item => {
  item.addEventListener("click", () => {
    navigate(item.dataset.screen);
  });
});

// BUSCADOR
searchBtn.addEventListener("click", () => {
  searchPanel.hidden = !searchPanel.hidden;

  if (!searchPanel.hidden) {
    searchInput.focus();
  } else {
    searchInput.value = "";
  }
});

// OPCIONES
$("moreBtn").addEventListener("click", () => {
  settingsModal.hidden = false;
});

// CERRAR CONFIGURACIÓN
$("closeSettings").addEventListener("click", () => {
  settingsModal.hidden = true;
});

settingsModal.addEventListener("click", event => {
  if (event.target === settingsModal) {
    settingsModal.hidden = true;
  }
});

// VISUALIZADORES
function createBars() {
  visualizerBars.innerHTML = "";

  const total = 48;

  for (let i = 0; i < total; i++) {
    const bar = document.createElement("div");

    bar.className = "visual-bar";
    bar.dataset.index = i;

    const angle = (360 / total) * i;

    bar.style.setProperty("--angle", `${angle}deg`);

    visualizerBars.appendChild(bar);
  }
}

function selectVisual(type) {
  currentVisual = type;

  visualizer.classList.remove(
    "mode-bars",
    "mode-wave",
    "mode-mirror"
  );

  if (type !== "circle") {
    visualizer.classList.add(`mode-${type}`);
  }

  document.querySelectorAll("[data-visual]").forEach(button => {
    button.classList.toggle(
      "selected",
      button.dataset.visual === type
    );
  });

  localStorage.setItem("pulso_visual", type);
  createBars();
}

document.querySelectorAll("[data-visual]").forEach(button => {
  button.addEventListener("click", () => {
    selectVisual(button.dataset.visual);
  });
});

// COLORES
function applyTheme(name) {
  const theme = themes[name];

  if (!theme) return;

  currentTheme = name;

  document.documentElement.style.setProperty(
    "--neon",
    theme.primary
  );

  document.documentElement.style.setProperty(
    "--neon-secondary",
    theme.secondary
  );

  document.documentElement.style.setProperty(
    "--glow",
    `0 0 18px ${theme.primary}70`
  );

  document.querySelectorAll("[data-color]").forEach(button => {
    button.classList.toggle(
      "selected",
      button.dataset.color === name
    );
  });

  localStorage.setItem("pulso_theme", name);
}

const colorButtons = document.querySelectorAll("[data-color]");

colorButtons.forEach(button => {
  const theme = themes[button.dataset.color];

  button.style.setProperty(
    "--color",
    theme.primary
  );

  button.addEventListener("click", () => {
    applyTheme(button.dataset.color);
  });
});

// COLA DE REPRODUCCIÓN
const queueToggle = $("queueToggle");
const queueList = $("queueList");

queueToggle.addEventListener("click", () => {
  const collapsed = queueList.hidden;

  queueList.hidden = !collapsed;
  queueToggle.textContent = collapsed ? "⌃" : "⌄";
});

// FAVORITOS - INTERFAZ
let isFavorite = false;

$("favoriteBtn").addEventListener("click", () => {
  isFavorite = !isFavorite;

  $("favoriteBtn").textContent =
    isFavorite ? "♥" : "♡";

  $("favoriteBtn").style.color =
    isFavorite
      ? "var(--neon)"
      : "var(--white)";
});

// CONTROLES VISUALES DE DEMOSTRACIÓN
let isPlaying = false;

$("playBtn").addEventListener("click", () => {
  isPlaying = !isPlaying;

  $("playBtn").textContent =
    isPlaying ? "Ⅱ" : "▶";

  vinyl.style.animationPlayState =
    "running";
});

// REPETICIÓN Y ALEATORIO - ESTADO VISUAL
$("repeatBtn").addEventListener("click", event => {
  event.currentTarget.classList.toggle("selected");
});

$("shuffleBtn").addEventListener("click", event => {
  event.currentTarget.classList.toggle("selected");
});

// ANIMACIÓN DEMOSTRATIVA
function animateVisualizer() {
  const bars = visualizerBars.children;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];

    const wave =
      Math.sin((i * 0.35) + visualFrame * 0.08);

    const wave2 =
      Math.cos((i * 0.18) - visualFrame * 0.05);

    const value =
      Math.abs(wave * 45 + wave2 * 25) + 8;

    if (currentVisual === "circle") {
      bar.style.height = `${12 + value * 0.45}px`;
    } else {
      const height = 10 + value * 0.8;

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

// PREFERENCIAS GUARDADAS
function loadPreferences() {
  const savedTheme =
    localStorage.getItem("pulso_theme");

  const savedVisual =
    localStorage.getItem("pulso_visual");

  applyTheme(
    themes[savedTheme] ? savedTheme : "green"
  );

  selectVisual(
    ["circle", "bars", "wave", "mirror"].includes(savedVisual)
      ? savedVisual
      : "circle"
  );
}

// INICIAR
createBars();
loadPreferences();
animateVisualizer();

console.log("PULSO: interfaz inicial cargada.");
