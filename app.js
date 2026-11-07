/* =========================================
   PULSO — MOTOR PRINCIPAL
   PARTE 1 DE 4
========================================= */

"use strict";

/* =========================================
   ELEMENTOS PRINCIPALES
========================================= */

const $ = (id) => document.getElementById(id);

const playerScreen = $("playerScreen");
const secondaryScreen = $("secondaryScreen");
const screenTitle = $("screenTitle");

const audioPlayer = $("audioPlayer");
const musicFileInput = $("musicFileInput");

const playBtn = $("playBtn");
const nextBtn = $("nextBtn");
const prevBtn = $("previousBtn");

const progressBar = $("progressBar");
const currentTime = $("currentTime");
const totalTime = $("duration");

const songTitle = $("songTitle");
const songArtist = $("songArtist");

const screenContent = $("screenContent");
const libraryCount = $("libraryCount");

const addMusicBtn = $("addMusicBtn");
const scanMusicBtn = $("scanMusicBtn");
const libraryBackBtn = $("libraryBackBtn");

const libraryTabs = document.querySelectorAll("[data-library-tab]");

/* =========================================
   ESTADO DE LA APLICACIÓN
========================================= */

let musicLibrary = [];
let currentTrackIndex = -1;
let playbackQueue = [];
let playbackHistory = [];

let currentScreen = "inicio";
let currentLibraryTab = "canciones";

let isPlaying = false;
let isShuffle = false;
let repeatMode = 0;

let audioContext = null;
let analyser = null;
let audioSource = null;
let frequencyData = null;
let equalizerFilters = [];
const equalizerValues = [0, 0, 0, 0, 0];
const equalizerBands = [
    { label: "Graves", frequency: 60, type: "lowshelf" },
    { label: "Medios bajos", frequency: 250, type: "peaking" },
    { label: "Medios", frequency: 1000, type: "peaking" },
    { label: "Medios altos", frequency: 4000, type: "peaking" },
    { label: "Agudos", frequency: 10000, type: "highshelf" }
];

let animationFrame = null;

const audioSupported = Boolean(
    audioPlayer &&
    musicFileInput
);

/* =========================================
   UTILIDADES
========================================= */

function showMessage(message) {
    let toast = $("pulsoToast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "pulsoToast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showMessage.timer);

    showMessage.timer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return "0:00";
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function cleanFileName(fileName) {
    return fileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getTrackName(file) {
    return cleanFileName(file.name) || "Canción desconocida";
}

/* =========================================
   NAVEGACIÓN ENTRE PANTALLAS
========================================= */

function navigate(screen) {
    currentScreen = screen;

    if (playerScreen) {
        playerScreen.hidden = screen !== "inicio";
    }

    if (secondaryScreen) {
        secondaryScreen.hidden = screen === "inicio";
    }

    if (screenTitle) {
        const titles = {
            biblioteca: "Mi biblioteca",
            favoritos: "Mis favoritos",
            ajustes: "Configuración",
            configuracion: "Configuración",
            cola: "Cola de reproducción",
            listas: "Mis listas",
            carpetas: "Carpetas",
            ecualizador: "Ecualizador",
            albumes: "Álbumes",
            artistas: "Artistas"
        };
        screenTitle.textContent = titles[screen] || "PULSO";
    }

    if (screen === "biblioteca") {
        renderLibrary();
    }

    if (screen === "cola") {
        renderQueue();
    }

    if (screen === "favoritos") {
        renderFavorites();
    }

    if (screen === "albumes" || screen === "artistas") {
        renderLibraryCategory(screen);
    }

    if (screen === "ajustes" || screen === "configuracion") {
        renderSettings();
    }

    if (screen === "ecualizador") {
        renderEqualizer();
    }

    if (screen === "listas") {
        renderQueue();
    }

    if (screen === "carpetas") {
        renderSimpleScreen("Carpetas", "La exploración automática de carpetas estará disponible con la integración Android de PULSO.");
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

/* =========================================
   CARGAR ARCHIVOS DE MÚSICA
========================================= */

function addMusicFiles(files) {
    const selectedFiles = Array.from(files || []);

    const audioFiles = selectedFiles.filter(file =>
        file.type.startsWith("audio/") ||
        /\.(mp3|wav|ogg|m4a|aac|flac|opus|webm)$/i.test(file.name)
    );

    if (audioFiles.length === 0) {
        showMessage("No se encontraron archivos de audio.");
        return;
    }

    let added = 0;

    audioFiles.forEach(file => {
        const alreadyAdded = musicLibrary.some(track =>
            track.file === file
        );

        if (alreadyAdded) {
            return;
        }

        musicLibrary.push({
            id: `${Date.now()}-${Math.random()}`,
            file: file,
            name: getTrackName(file),
            artist: "Artista desconocido",
            duration: 0,
            url: URL.createObjectURL(file),
            favorite: false
        });

        playbackQueue.push(musicLibrary.length - 1);
        added++;
    });

    updateLibraryCount();
    renderQueuePanel();

    if (added > 0) {
        showMessage(
            added === 1
                ? "Canción agregada a PULSO."
                : `${added} canciones agregadas a PULSO.`
        );
    } else {
        showMessage("Esos archivos ya están en la biblioteca.");
    }

    if (currentScreen === "biblioteca") {
        renderLibrary();
    }
}

/* =========================================
   ACTUALIZAR CONTADOR
========================================= */

function updateLibraryCount() {
    if (libraryCount) {
        const total = musicLibrary.length;

        libraryCount.textContent =
            `${total} ${total === 1 ? "canción" : "canciones"}`;
    }
}

/* =========================================
   PREPARAR REPRODUCCIÓN
========================================= */

function loadTrack(index, autoplay = false) {
    if (!audioPlayer || musicLibrary.length === 0) {
        showMessage("Primero agrega música a tu biblioteca.");
        return;
    }

    if (index < 0 || index >= musicLibrary.length) {
        return;
    }

    currentTrackIndex = index;

    const track = musicLibrary[index];

    audioPlayer.src = track.url;
    audioPlayer.load();

    if (songTitle) {
        songTitle.textContent = track.name;
    }

    if (songArtist) {
        songArtist.textContent = track.artist;
    }

    if (currentTime) {
        currentTime.textContent = "0:00";
    }

    if (totalTime) {
        totalTime.textContent = "0:00";
    }

    if (progressBar) {
        progressBar.value = 0;
    }

    updatePlayButton();
    renderQueuePanel();

    if (autoplay) {
        playCurrentTrack();
    }
}

/* =========================================
   REPRODUCIR Y PAUSAR
========================================= */

async function playCurrentTrack() {
    if (!audioPlayer) {
        return;
    }

    if (currentTrackIndex === -1) {
        if (musicLibrary.length === 0) {
            showMessage("Agrega canciones para comenzar.");
            return;
        }

        loadTrack(0, false);
    }

    try {
        setupAudioAnalyser();

        await audioPlayer.play();
    } catch (error) {
        console.error("Error al reproducir:", error);
        showMessage("No se pudo reproducir este archivo.");
    }
}

function togglePlayback() {
    if (!audioPlayer) {
        return;
    }

    if (audioPlayer.paused) {
        playCurrentTrack();
    } else {
        audioPlayer.pause();
    }
}

function updatePlayButton() {
    if (!playBtn) {
        return;
    }

    playBtn.textContent = isPlaying ? "Ⅱ" : "▶";
    playBtn.setAttribute(
        "aria-label",
        isPlaying ? "Pausar" : "Reproducir"
    );
}

/* =========================================
   SIGUIENTE Y ANTERIOR
========================================= */

function playNextTrack() {
    if (!musicLibrary.length) return;

    let nextIndex = -1;
    if (isShuffle && musicLibrary.length > 1) {
        const candidates = musicLibrary.map((_, i) => i).filter(i => i !== currentTrackIndex);
        nextIndex = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
        const position = playbackQueue.indexOf(currentTrackIndex);
        if (position >= 0 && position < playbackQueue.length - 1) {
            nextIndex = playbackQueue[position + 1];
        } else if (repeatMode === 1 && playbackQueue.length) {
            nextIndex = playbackQueue[0];
        }
    }

    if (nextIndex < 0) {
        audioPlayer.pause();
        showMessage("No hay más canciones en la cola.");
        return;
    }
    if (currentTrackIndex >= 0) playbackHistory.push(currentTrackIndex);
    loadTrack(nextIndex, true);
    renderQueuePanel();
}

function playPreviousTrack() {
    if (!audioPlayer || currentTrackIndex < 0) return;
    if (audioPlayer.currentTime > 3) {
        audioPlayer.currentTime = 0;
        return;
    }
    let previousIndex = playbackHistory.length ? playbackHistory.pop() : -1;
    if (previousIndex < 0) {
        const position = playbackQueue.indexOf(currentTrackIndex);
        if (position > 0) previousIndex = playbackQueue[position - 1];
    }
    if (previousIndex < 0) {
        showMessage("No hay una canción anterior.");
        return;
    }
    loadTrack(previousIndex, true);
    renderQueuePanel();
}

/* =========================================
   BIBLIOTECA DE MÚSICA
   PARTE 2 DE 4
========================================= */

/* =========================================
   MOSTRAR CANCIONES
========================================= */

function renderLibrary() {
    if (!screenContent) {
        return;
    }

    updateLibraryCount();

    if (currentLibraryTab !== "canciones") {
        renderLibraryCategory(currentLibraryTab);
        return;
    }

    screenContent.innerHTML = "";

    if (musicLibrary.length === 0) {
        screenContent.innerHTML = `
            <div class="library-empty">
                <div class="library-empty-icon">♫</div>
                <h3>Tu biblioteca está vacía</h3>
                <p>Agrega canciones desde tu dispositivo para comenzar a escuchar música en PULSO.</p>
            </div>
        `;
        return;
    }

    const list = document.createElement("div");
    list.className = "library-list";

    musicLibrary.forEach((track, index) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "library-track";

        const cover = document.createElement("span");
        cover.className = "library-track-cover";
        cover.textContent = "♫";

        const info = document.createElement("span");
        info.className = "library-track-info";

        const title = document.createElement("span");
        title.className = "library-track-title";
        title.textContent = track.name;

        const artist = document.createElement("span");
        artist.className = "library-track-artist";
        artist.textContent = track.artist;

        info.append(title, artist);

        const duration = document.createElement("span");
        duration.className = "library-track-duration";
        duration.textContent = formatTime(track.duration);

        item.append(cover, info, duration);

        item.addEventListener("click", () => {
            navigate("inicio");
            loadTrack(index, true);
        });

        list.appendChild(item);
    });

    screenContent.appendChild(list);
}

/* =========================================
   ÁLBUMES Y ARTISTAS
========================================= */

function renderLibraryCategory(category) {
    if (!screenContent) {
        return;
    }

    screenContent.innerHTML = "";

    const empty = document.createElement("div");
    empty.className = "library-empty";

    const icon = document.createElement("div");
    icon.className = "library-empty-icon";
    icon.textContent = category === "albumes" ? "▣" : "♙";

    const heading = document.createElement("h3");
    const message = document.createElement("p");

    if (category === "albumes") {
        heading.textContent = "Álbumes";
        message.textContent = musicLibrary.length
            ? "La organización por álbumes estará disponible cuando integremos los metadatos de las canciones."
            : "Agrega música para comenzar a organizar tus álbumes.";
    } else {
        heading.textContent = "Artistas";
        message.textContent = musicLibrary.length
            ? "La organización por artistas estará disponible cuando integremos los metadatos de las canciones."
            : "Agrega música para comenzar a organizar tus artistas.";
    }

    empty.append(icon, heading, message);
    screenContent.appendChild(empty);
}

/* =========================================
   PESTAÑAS DE LA BIBLIOTECA
========================================= */

function selectLibraryTab(tab) {
    currentLibraryTab = tab;

    libraryTabs.forEach(button => {
        const active = button.dataset.libraryTab === tab;
        button.classList.toggle("active", active);
    });

    if (tab === "canciones") {
        renderLibrary();
    } else {
        renderLibraryCategory(tab);
    }
}

/* =========================================
   COLA DE REPRODUCCIÓN
========================================= */

function renderQueue() {
    if (!screenContent) {
        return;
    }

    screenContent.innerHTML = "";

    if (musicLibrary.length === 0) {
        const empty = document.createElement("div");
        empty.className = "library-empty";
        empty.innerHTML = `
            <div class="library-empty-icon">♫</div>
            <h3>Cola vacía</h3>
            <p>Agrega canciones a tu biblioteca para reproducirlas.</p>
        `;

        screenContent.appendChild(empty);
        return;
    }

    const list = document.createElement("div");
    list.className = "library-list";

    musicLibrary.forEach((track, index) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "library-track";

        const cover = document.createElement("span");
        cover.className = "library-track-cover";
        cover.textContent = index === currentTrackIndex ? "▶" : "♫";

        const info = document.createElement("span");
        info.className = "library-track-info";

        const title = document.createElement("span");
        title.className = "library-track-title";
        title.textContent = track.name;

        const artist = document.createElement("span");
        artist.className = "library-track-artist";
        artist.textContent = track.artist;

        info.append(title, artist);
        item.append(cover, info);

        item.addEventListener("click", () => {
            navigate("inicio");
            loadTrack(index, true);
        });

        list.appendChild(item);
    });

    screenContent.appendChild(list);
}

/* =========================================
   FAVORITOS
========================================= */

function renderFavorites() {
    if (!screenContent) {
        return;
    }

    screenContent.innerHTML = "";

    const favorites = musicLibrary
        .map((track, index) => ({ track, index }))
        .filter(item => item.track.favorite);

    if (favorites.length === 0) {
        screenContent.innerHTML = `
            <div class="library-empty">
                <div class="library-empty-icon">♡</div>
                <h3>Aún no tienes favoritos</h3>
                <p>Cuando agreguemos los controles de favoritos podrás guardar aquí tus canciones preferidas.</p>
            </div>
        `;
        return;
    }

    const list = document.createElement("div");
    list.className = "library-list";

    favorites.forEach(({ track, index }) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "library-track";

        const cover = document.createElement("span");
        cover.className = "library-track-cover";
        cover.textContent = "♥";

        const info = document.createElement("span");
        info.className = "library-track-info";

        const title = document.createElement("span");
        title.className = "library-track-title";
        title.textContent = track.name;

        const artist = document.createElement("span");
        artist.className = "library-track-artist";
        artist.textContent = track.artist;

        info.append(title, artist);
        item.append(cover, info);

        item.addEventListener("click", () => {
            navigate("inicio");
            loadTrack(index, true);
        });

        list.appendChild(item);
    });

    screenContent.appendChild(list);
}

/* =========================================
   AJUSTES
========================================= */

function renderSettings() {
    if (!screenContent) {
        return;
    }

    screenContent.innerHTML = `
        <div class="settings-section">
            <h3>Visualizador</h3>
            <div class="visualizer-options">
                <button class="visualizer-option" data-visual-mode="circular">Circular</button>
                <button class="visualizer-option" data-visual-mode="bars">Barras</button>
                <button class="visualizer-option" data-visual-mode="wave">Olas</button>
                <button class="visualizer-option" data-visual-mode="mirror">Simétrico</button>
            </div>
        </div>

        <div class="settings-section">
            <h3>Acerca de PULSO</h3>
            <div class="settings-option">
                <div>
                    <span>PULSO</span>
                    <small>Reproductor de música local</small>
                </div>
            </div>
            <div class="settings-option">
                <div>
                    <span>Desarrollado por LYQENTRA</span>
                    <small>Tu música, tu espacio.</small>
                </div>
            </div>
        </div>
    `;

    const modeButtons = screenContent.querySelectorAll("[data-visual-mode]");

    modeButtons.forEach(button => {
        button.addEventListener("click", () => {
            setVisualizerMode(button.dataset.visualMode);

            modeButtons.forEach(option => {
                option.classList.toggle(
                    "active",
                    option === button
                );
            });
        });
    });
}

/* =========================================
   VISUALIZADOR DE AUDIO
   PARTE 3 DE 4
========================================= */

/* =========================================
   CONFIGURAR AUDIO ANALYSER
========================================= */

function setupAudioAnalyser() {
    const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass || !audioPlayer) {
        return;
    }

    try {
        if (!audioContext) {
            audioContext = new AudioContextClass();
        }

        if (!analyser) {
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.78;

            audioSource = audioContext.createMediaElementSource(audioPlayer);

            let previousNode = audioSource;
            equalizerFilters = equalizerBands.map(band => {
                const filter = audioContext.createBiquadFilter();
                filter.type = band.type;
                filter.frequency.value = band.frequency;
                filter.Q.value = 1;
                filter.gain.value = equalizerValues[equalizerFilters.length] || 0;
                previousNode.connect(filter);
                previousNode = filter;
                return filter;
            });

            previousNode.connect(analyser);
            analyser.connect(audioContext.destination);

            frequencyData = new Uint8Array(analyser.frequencyBinCount);
        }

        if (audioContext.state === "suspended") {
            audioContext.resume();
        }
    } catch (error) {
        console.error("Error del visualizador:", error);
    }
}

/* =========================================
   OBTENER NIVEL DE FRECUENCIA
========================================= */

function getAudioLevel(start, end) {
    if (!analyser || !frequencyData || !isPlaying) {
        return 0;
    }

    analyser.getByteFrequencyData(frequencyData);

    const first = Math.max(0, start);
    const last = Math.min(frequencyData.length, end);

    let total = 0;
    let count = 0;

    for (let i = first; i < last; i++) {
        total += frequencyData[i];
        count++;
    }

    return count ? total / count / 255 : 0;
}

function renderSimpleScreen(title, description) {
    if (!screenContent) return;
    screenContent.innerHTML = "";
    const panel = document.createElement("div");
    panel.className = "library-empty";
    const heading = document.createElement("h3");
    heading.textContent = title;
    const text = document.createElement("p");
    text.textContent = description;
    panel.append(heading, text);
    screenContent.appendChild(panel);
}

function renderEqualizer() {
    if (!screenContent) return;
    screenContent.innerHTML = "";
    const panel = document.createElement("section");
    panel.className = "settings-section equalizer-panel";
    const heading = document.createElement("h3");
    heading.textContent = "Ecualizador de 5 bandas";
    panel.appendChild(heading);

    const note = document.createElement("p");
    note.className = "equalizer-note";
    note.textContent = "Ajusta el sonido mientras se reproduce tu música.";
    panel.appendChild(note);

    equalizerBands.forEach((band, index) => {
        const row = document.createElement("label");
        row.className = "equalizer-band";
        const name = document.createElement("span");
        name.textContent = band.label;
        const range = document.createElement("input");
        range.type = "range";
        range.min = "-12";
        range.max = "12";
        range.step = "1";
        range.value = String(equalizerFilters[index]?.gain.value ?? equalizerValues[index] ?? 0);
        range.setAttribute("aria-label", band.label);
        const value = document.createElement("output");
        value.textContent = `${range.value} dB`;
        range.addEventListener("input", () => {
            const gain = Number(range.value);
            equalizerValues[index] = gain;
            if (equalizerFilters[index]) equalizerFilters[index].gain.value = gain;
            value.textContent = `${gain} dB`;
        });
        row.append(name, range, value);
        panel.appendChild(row);
    });

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "library-add-btn equalizer-reset";
    reset.textContent = "Restablecer ecualizador";
    reset.addEventListener("click", () => {
        equalizerFilters.forEach(filter => filter.gain.value = 0);
        equalizerValues.fill(0);
        panel.querySelectorAll("input[type=range]").forEach(input => input.value = "0");
        panel.querySelectorAll("output").forEach(output => output.textContent = "0 dB");
    });
    panel.appendChild(reset);
    screenContent.appendChild(panel);
    if (!audioContext) showMessage("Reproduce una canción para activar los controles de sonido.");
}

/* =========================================
   ACTIVAR MODO DEL VISUALIZADOR
========================================= */

function setVisualizerMode(mode) {
    const visualizer = $("visualizerCircle");

    if (!visualizer) {
        return;
    }

    const validModes = [
        "circular",
        "bars",
        "wave",
        "mirror"
    ];

    if (!validModes.includes(mode)) {
        mode = "circular";
    }

    visualizer.classList.remove(
        "mode-circular",
        "mode-bars",
        "mode-wave",
        "mode-mirror"
    );

    visualizer.classList.add(`mode-${mode}`);
    const stage = document.querySelector(".visual-stage");
    if (stage) stage.dataset.visualMode = mode;

    createVisualizerBars();
}

/* =========================================
   CREAR BARRAS
========================================= */

function createVisualizerBars() {
    const visualizer = $("visualizerCircle");
    const barContainer = $("visualizerBars");

    if (!visualizer || !barContainer) {
        return;
    }

    barContainer.querySelectorAll(".visual-bar").forEach(bar => {
        bar.remove();
    });

    const total = 56;

    for (let i = 0; i < total; i++) {
        const bar = document.createElement("div");

        bar.className = "visual-bar";
        bar.dataset.index = String(i);

        barContainer.appendChild(bar);
    }

    animateVisualizer();
}

/* =========================================
   ANIMAR VISUALIZADOR
========================================= */

function animateVisualizer() {
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }

    const visualizer = $("visualizerCircle");

    if (!visualizer) {
        return;
    }

    const bars = $("visualizerBars")?.querySelectorAll(".visual-bar") || [];

    function draw() {
        const mode = Array.from(visualizer.classList)
            .find(name => name.startsWith("mode-")) || "mode-circular";

        const barMode = mode.replace("mode-", "");

        bars.forEach((bar, index) => {
            const frequencyIndex = Math.floor(
                index / bars.length * (frequencyData?.length || 64)
            );

            let level = getAudioLevel(
                frequencyIndex,
                frequencyIndex + 3
            );

            if (isPlaying && level < 0.025) {
                level = 0.025;
            }

            const height = isPlaying
                ? 8 + level * 85
                : 8;

            if (barMode === "circular") {
                const angle = (index / bars.length) * 360;

                bar.style.left = "50%";
                bar.style.top = "50%";
                bar.style.bottom = "auto";
                bar.style.height = `${height}px`;
                bar.style.transform =
                    `translate(-50%, -50%) rotate(${angle}deg) translateY(-112px)`;
                bar.style.transformOrigin = "center";
            } else {
                bar.style.top = "auto";
                bar.style.left =
                    `${(index / (bars.length - 1)) * 100}%`;
                bar.style.bottom = "50%";
                bar.style.height = `${height}px`;
                bar.style.transform = "translateX(-50%)";

                if (barMode === "mirror") {
                    bar.style.bottom = "50%";
                    bar.style.transform =
                        `translateX(-50%) scaleY(${index % 2 === 0 ? 1 : -1})`;
                }

                if (barMode === "wave") {
                    const wave = Math.sin(
                        (index / bars.length) * Math.PI * 4
                    );

                    bar.style.height =
                        `${Math.max(5, height + wave * 12)}px`;
                }
            }
        });

        animationFrame = requestAnimationFrame(draw);
    }

    draw();
}

/* =========================================
   ROTACIÓN DEL VINILO
========================================= */

function updateVinylRotation() {
    const vinyl = $("vinyl");

    if (!vinyl) {
        return;
    }

    vinyl.classList.toggle("playing", isPlaying);
}

/* =========================================
   ESTADO DE REPRODUCCIÓN
========================================= */

if (audioPlayer) {
    audioPlayer.addEventListener("loadedmetadata", () => {
        const duration = audioPlayer.duration;

        if (totalTime) {
            totalTime.textContent = formatTime(duration);
        }

        if (currentTrackIndex >= 0) {
            musicLibrary[currentTrackIndex].duration = duration;
        }
    });

    audioPlayer.addEventListener("playing", () => {
        isPlaying = true;
        updatePlayButton();
        updateVinylRotation();
        setupAudioAnalyser();
    });

    audioPlayer.addEventListener("pause", () => {
        isPlaying = false;
        updatePlayButton();
        updateVinylRotation();
    });

    audioPlayer.addEventListener("ended", () => {
        if (repeatMode === 2) {
            audioPlayer.currentTime = 0;
            playCurrentTrack();
        } else {
            playNextTrack();
        }
    });

    audioPlayer.addEventListener("timeupdate", () => {
        if (currentTime) {
            currentTime.textContent =
                formatTime(audioPlayer.currentTime);
        }

        if (
            progressBar &&
            Number.isFinite(audioPlayer.duration) &&
            audioPlayer.duration > 0
        ) {
            progressBar.value =
                (audioPlayer.currentTime / audioPlayer.duration) * 100;
        }
    });

    audioPlayer.addEventListener("error", () => {
        if (audioPlayer.src) {
            showMessage("No se pudo leer este archivo de audio.");
        }
    });
}

/* =========================================
   CONTROL DE PROGRESO
========================================= */

if (progressBar) {
    progressBar.addEventListener("input", () => {
        if (
            audioPlayer &&
            Number.isFinite(audioPlayer.duration) &&
            audioPlayer.duration > 0
        ) {
            audioPlayer.currentTime =
                (Number(progressBar.value) / 100) *
                audioPlayer.duration;
        }
    });
}

/* =========================================
   FAVORITO DE LA CANCIÓN ACTUAL
========================================= */

function toggleFavorite() {
    if (currentTrackIndex < 0) {
        showMessage("Primero selecciona una canción.");
        return;
    }

    const track = musicLibrary[currentTrackIndex];

    track.favorite = !track.favorite;

    const favoriteBtn = $("favoriteBtn");

    if (favoriteBtn) {
        favoriteBtn.textContent = track.favorite ? "♥" : "♡";
        favoriteBtn.classList.toggle("active", track.favorite);
    }

    showMessage(
        track.favorite
            ? "Agregada a favoritos."
            : "Eliminada de favoritos."
    );
}

/* =========================================
   ALEATORIO Y REPETICIÓN
========================================= */

function toggleShuffle() {
    isShuffle = !isShuffle;

    const button = $("shuffleBtn");

    if (button) {
        button.classList.toggle("active", isShuffle);
    }

    showMessage(
        isShuffle
            ? "Reproducción aleatoria activada."
            : "Reproducción aleatoria desactivada."
    );
}

function toggleRepeat() {
    repeatMode = (repeatMode + 1) % 3;

    const button = $("repeatBtn");

    if (button) {
        button.classList.toggle("active", repeatMode > 0);

        button.textContent =
            repeatMode === 2 ? "↻¹" : "↻";
    }

    const messages = [
        "Repetición desactivada.",
        "Repetir toda la lista.",
        "Repetir canción actual."
    ];

    showMessage(messages[repeatMode]);
}

/* =========================================
   EVENTOS Y CONTROLES
   PARTE 4 DE 4
========================================= */

/* =========================================
   BOTONES DEL REPRODUCTOR
========================================= */

if (playBtn) {
    playBtn.addEventListener("click", togglePlayback);
}

if (nextBtn) {
    nextBtn.addEventListener("click", playNextTrack);
}

if (prevBtn) {
    prevBtn.addEventListener("click", playPreviousTrack);
}

const favoriteBtn = $("favoriteBtn");

if (favoriteBtn) {
    favoriteBtn.addEventListener("click", toggleFavorite);
}

const shuffleBtn = $("shuffleBtn");

if (shuffleBtn) {
    shuffleBtn.addEventListener("click", toggleShuffle);
}

const repeatBtn = $("repeatBtn");

if (repeatBtn) {
    repeatBtn.addEventListener("click", toggleRepeat);
}

/* =========================================
   AGREGAR MÚSICA
========================================= */

if (addMusicBtn && musicFileInput) {
    addMusicBtn.addEventListener("click", () => {
        musicFileInput.click();
    });
}

if (musicFileInput) {
    musicFileInput.addEventListener("change", event => {
        addMusicFiles(event.target.files);

        // Permite volver a seleccionar el mismo archivo.
        event.target.value = "";
    });
}

/* =========================================
   ESCANEO AUTOMÁTICO
========================================= */

if (scanMusicBtn) {
    scanMusicBtn.addEventListener("click", () => {
        showMessage(
            "El escaneo automático del teléfono se integrará en la versión Android de PULSO."
        );
    });
}

/* =========================================
   VOLVER AL REPRODUCTOR
========================================= */

if (libraryBackBtn) {
    libraryBackBtn.addEventListener("click", () => {
        navigate("inicio");
    });
}

/* =========================================
   PESTAÑAS DE LA BIBLIOTECA
========================================= */

libraryTabs.forEach(button => {
    button.addEventListener("click", () => {
        selectLibraryTab(button.dataset.libraryTab);
    });
});

/* =========================================
   MENÚ DE NAVEGACIÓN
========================================= */

document.querySelectorAll("[data-screen]").forEach(button => {
    button.addEventListener("click", () => {
        const screen = button.dataset.screen;

        if (!screen) {
            return;
        }

        navigate(screen);

        const drawer = $("drawer");
        const overlay = $("drawerOverlay");

        if (drawer) {
            drawer.classList.remove("open");
        }

        if (overlay) {
            overlay.classList.remove("show");
        }
    });
});

/* =========================================
   ABRIR Y CERRAR MENÚ
========================================= */

const menuBtn = $("menuBtn");
const drawer = $("drawer");
const drawerOverlay = $("drawerOverlay");
const closeDrawerBtn = $("closeDrawerBtn");

function openDrawer() {
    if (drawer) {
        drawer.classList.add("open");
    }

    if (drawerOverlay) {
        drawerOverlay.classList.add("show");
    }
}

function closeDrawer() {
    if (drawer) {
        drawer.classList.remove("open");
    }

    if (drawerOverlay) {
        drawerOverlay.classList.remove("show");
    }
}

if (menuBtn) {
    menuBtn.addEventListener("click", openDrawer);
}

if (closeDrawerBtn) {
    closeDrawerBtn.addEventListener("click", closeDrawer);
}

if (drawerOverlay) {
    drawerOverlay.addEventListener("click", closeDrawer);
}

/* =========================================
   TECLADO
========================================= */

document.addEventListener("keydown", event => {
    if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
    ) {
        return;
    }

    if (event.code === "Space") {
        event.preventDefault();
        togglePlayback();
    }

    if (event.code === "ArrowRight" && audioPlayer) {
        audioPlayer.currentTime = Math.min(
            audioPlayer.duration || 0,
            audioPlayer.currentTime + 5
        );
    }

    if (event.code === "ArrowLeft" && audioPlayer) {
        audioPlayer.currentTime = Math.max(
            0,
            audioPlayer.currentTime - 5
        );
    }

    if (event.key === "Escape") {
        closeDrawer();

        if (currentScreen !== "inicio") {
            navigate("inicio");
        }
    }
});


/* CONTROLES DE ESTILO DEL MODAL ORIGINAL */
document.querySelectorAll("[data-visual]").forEach(button => {
    button.addEventListener("click", () => {
        const map = { circle: "circular", bars: "bars", wave: "wave", mirror: "mirror" };
        setVisualizerMode(map[button.dataset.visual] || "circular");
        document.querySelectorAll("[data-visual]").forEach(item => item.classList.toggle("selected", item === button));
    });
});

const settingsModal = $("settingsModal");
const closeSettings = $("closeSettings");
const moreBtn = $("moreBtn");
if (moreBtn && settingsModal) moreBtn.addEventListener("click", () => { settingsModal.hidden = false; });
if (closeSettings && settingsModal) closeSettings.addEventListener("click", () => { settingsModal.hidden = true; });
if (settingsModal) settingsModal.addEventListener("click", event => { if (event.target === settingsModal) settingsModal.hidden = true; });

function renderQueuePanel() {
    const list = $("queueList");
    if (!list) return;
    list.innerHTML = "";
    const upcoming = playbackQueue.filter(index => index !== currentTrackIndex);
    if (!upcoming.length) {
        list.innerHTML = '<div class="empty-queue">Agrega canciones para formar tu cola.</div>';
        return;
    }
    upcoming.forEach(index => {
        const track = musicLibrary[index];
        if (!track) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "queue-track";
        button.textContent = track.name;
        button.addEventListener("click", () => { loadTrack(index, true); renderQueuePanel(); });
        list.appendChild(button);
    });
}

const queueBtn = $("queueBtn");
if (queueBtn) queueBtn.addEventListener("click", () => {
    const panel = $("queuePanel");
    if (panel) panel.scrollIntoView({ behavior: "smooth", block: "center" });
});
const queueToggle = $("queueToggle");
if (queueToggle) queueToggle.addEventListener("click", () => {
    const list = $("queueList");
    if (!list) return;
    list.hidden = !list.hidden;
    queueToggle.setAttribute("aria-expanded", String(!list.hidden));
    queueToggle.textContent = list.hidden ? "⌄" : "⌃";
});

/* =========================================
   INICIALIZACIÓN
========================================= */

function initializePulso() {
    navigate("inicio");

    updateLibraryCount();

    updatePlayButton();

    updateVinylRotation();

    createVisualizerBars();
    setVisualizerMode("circular");

    const visualizer = $("visualizerCircle");

    if (visualizer) {
        visualizer.classList.add("mode-circular");
    }

    console.log("PULSO iniciado correctamente.");
}

initializePulso();

/* =========================================
   FIN DEL ARCHIVO
========================================= */
