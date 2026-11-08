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
const PulsoNative = window.Capacitor?.Plugins?.PulsoMedia || null;
const isNativeAndroid = Boolean(PulsoNative);
let nativeStateTimer = null;
let nativeVisualizerTimer = null;
let nativeFrequencyData = new Uint8Array(64);
let nativeStateBusy = false;
let nativeVisualizerBusy = false;
let nativePlayRequestedAt = 0;
let nativeVisualizerGranted = true;
let nativeVisualizerActive = true;
let nativeInactiveSince = 0;
const barLevels = [];
let progressDragging = false;
const nativeNoticeShown = {};

// Verdadero solo cuando la canción actual suena por el servicio nativo de Android.
function isNativeTrack() {
    return isNativeAndroid && Boolean(musicLibrary[currentTrackIndex]?.native);
}
let librarySearchTerm = "";

const audioSupported = Boolean(
    audioPlayer &&
    musicFileInput
);

const PULSO_STORAGE_KEY = "pulso_local_state_v1";
let restoredPulsoState = {};
try { restoredPulsoState = JSON.parse(localStorage.getItem(PULSO_STORAGE_KEY) || "{}"); } catch (_) { restoredPulsoState = {}; }

function savePulsoState() {
    try {
        const nativeTracks = musicLibrary.filter(t => t.native);
        localStorage.setItem(PULSO_STORAGE_KEY, JSON.stringify({
            favorites: musicLibrary.filter(t => t.favorite).map(t => t.url).filter(Boolean),
            queue: playbackQueue.map(i => musicLibrary[i]?.url).filter(Boolean),
            current: musicLibrary[currentTrackIndex]?.url || "",
            shuffle: isShuffle,
            repeat: repeatMode,
            visualMode: document.querySelector(".visual-stage")?.dataset.visualMode || "circular",
            savedAt: Date.now()
        }));
    } catch (error) { console.warn("No se pudo guardar el estado local de PULSO", error); }
}

function restorePulsoState() {
    isShuffle = !!restoredPulsoState.shuffle;
    repeatMode = Number.isInteger(restoredPulsoState.repeat) ? restoredPulsoState.repeat : 0;
}


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
        renderLibraryCategory("carpetas");
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
    savePulsoState();

    if (added > 0) {
        showMessage(
            added === 1
                ? "Canción agregada a PULSO."
                : `${added} canciones agregadas a PULSO.`
        );
    } else {
        showMessage("Esos archivos ya están en la biblioteca.");
    }

    if (currentScreen === "biblioteca") renderLibrary();
    if (currentScreen === "cola" || currentScreen === "listas") renderQueue();
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

    if (!playbackQueue.includes(index)) playbackQueue.unshift(index);
    currentTrackIndex = index;

    const track = musicLibrary[index];

    if (!track.native) { audioPlayer.src = track.url; audioPlayer.load(); } else { audioPlayer.removeAttribute("src"); audioPlayer.load(); }

    if (isNativeAndroid) {
        if (track.native) {
            startNativeStatePolling();
        } else {
            pauseNativeIfPlaying();
            stopNativeStatePolling();
        }
    }

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

    savePulsoState();
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
        if (isNativeAndroid && musicLibrary[currentTrackIndex]?.native) {
            const track = musicLibrary[currentTrackIndex];
            await ensureNativePermissions();
            nativePlayRequestedAt = Date.now();
            await PulsoNative.playInBackground({ uri: track.url, title: track.name, artist: track.artist });
            isPlaying = true; updatePlayButton(); updateVinylRotation(); startNativeStatePolling(); return;
        }
        setupAudioAnalyser();
        await audioPlayer.play();
    } catch (error) {
        console.error("Error al reproducir:", error);
        showMessage("No se pudo reproducir este archivo.");
    }
}

async function togglePlayback() {
    if (isNativeTrack()) {
        if (isPlaying) {
            PulsoNative.playbackControl({ action: "pause" });
            isPlaying = false; updatePlayButton(); updateVinylRotation();
            return;
        }
        // Si el servicio ya no tiene la canción cargada (Android cerró la app), se inicia de nuevo.
        let state = null;
        try { state = await PulsoNative.getPlaybackState(); } catch (_) {}
        if (!state || !(Number(state.duration) > 0)) { playCurrentTrack(); return; }
        nativePlayRequestedAt = Date.now();
        PulsoNative.playbackControl({ action: "resume" });
        isPlaying = true; updatePlayButton(); updateVinylRotation();
        startNativeStatePolling();
        return;
    }
    if (!audioPlayer) return;
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

    const currentPosition = playbackQueue.indexOf(currentTrackIndex);
    let nextIndex = -1;

    if (isShuffle) {
        const candidates = playbackQueue.filter(index => index !== currentTrackIndex);
        if (candidates.length) {
            nextIndex = candidates[Math.floor(Math.random() * candidates.length)];
        }
    } else if (currentPosition >= 0 && currentPosition < playbackQueue.length - 1) {
        nextIndex = playbackQueue[currentPosition + 1];
    } else if (currentPosition < 0 && playbackQueue.length) {
        nextIndex = playbackQueue[0];
    } else if (repeatMode === 1 && playbackQueue.length) {
        nextIndex = playbackQueue[0];
    }

    if (nextIndex < 0 || !musicLibrary[nextIndex]) {
        if (isNativeAndroid && musicLibrary[currentTrackIndex]?.native) PulsoNative.playbackControl({ action: "pause" }); else audioPlayer.pause();
        showMessage("La cola terminó. Agrega más canciones para continuar.");
        return;
    }

    if (currentTrackIndex >= 0) playbackHistory.push(currentTrackIndex);
    loadTrack(nextIndex, true);
    renderQueue();
    renderQueuePanel();
}

async function playPreviousTrack() {
    if (currentTrackIndex < 0) return;

    if (isNativeAndroid && musicLibrary[currentTrackIndex]?.native) {
        try {
            const state = await PulsoNative.getPlaybackState();
            if ((state.position || 0) > 3000) { PulsoNative.playbackControl({ action: "seek", position: 0 }); return; }
        } catch (e) {}
    } else if (audioPlayer.currentTime > 3) {
        audioPlayer.currentTime = 0; return;
    }
    let previousIndex = playbackHistory.length ? playbackHistory.pop() : -1;

    if (previousIndex < 0) {
        const position = playbackQueue.indexOf(currentTrackIndex);
        if (position > 0) previousIndex = playbackQueue[position - 1];
    }

    if (previousIndex < 0 || !musicLibrary[previousIndex]) {
        showMessage("No hay una canción anterior.");
        return;
    }

    loadTrack(previousIndex, true);
    renderQueue();
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
    if (!screenContent) return;

    updateLibraryCount();

    if (currentLibraryTab !== "canciones") {
        renderLibraryCategory(currentLibraryTab);
        return;
    }

    screenContent.innerHTML = "";

    if (!musicLibrary.length) {
        screenContent.innerHTML = `
            <div class="library-empty">
                <div class="library-empty-icon">♫</div>
                <h3>Tu biblioteca está vacía</h3>
                <p>Agrega canciones desde tu dispositivo para comenzar a escuchar música en PULSO.</p>
            </div>`;
        return;
    }

    const list = document.createElement("div");
    list.className = "library-list";

    musicLibrary.forEach((track, index) => {
        const haystack = `${track.name} ${track.artist} ${track.album || ""} ${track.folder || ""}`.toLocaleLowerCase();
        if (librarySearchTerm && !haystack.includes(librarySearchTerm)) return;
        const item = document.createElement("div");
        item.className = "library-track";

        const play = document.createElement("button");
        play.type = "button";
        play.className = "library-track-play";
        play.setAttribute("aria-label", `Reproducir ${track.name}`);

        const cover = document.createElement("span");
        cover.className = "library-track-cover";
        cover.textContent = currentTrackIndex === index && isPlaying ? "Ⅱ" : "♫";
        play.appendChild(cover);

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

        const add = document.createElement("button");
        add.type = "button";
        add.className = "queue-add-btn";
        add.textContent = playbackQueue.includes(index) ? "✓" : "＋";
        add.title = playbackQueue.includes(index) ? "Ya está en la cola" : "Agregar a la cola";
        add.disabled = playbackQueue.includes(index);
        add.setAttribute("aria-label", add.title);

        play.appendChild(info);
        play.appendChild(duration);

        play.addEventListener("click", () => {
            if (!playbackQueue.includes(index)) playbackQueue.push(index);
            navigate("inicio");
            loadTrack(index, true);
            renderQueuePanel();
        });

        add.addEventListener("click", () => {
            addToQueue(index);
        });

        item.append(play, add);
        list.appendChild(item);
    });

    screenContent.appendChild(list);
}

/* =========================================
   ÁLBUMES Y ARTISTAS
========================================= */

function renderLibraryCategory(category) {
    if (!screenContent) return;
    screenContent.innerHTML = "";
    const field = category === "albumes" ? "album" : category === "artistas" ? "artist" : "folder";
    const groups = new Map();
    musicLibrary.forEach((track, index) => {
        const searchHaystack = `${track.name} ${track.artist} ${track.album || ""} ${track.folder || ""}`.toLocaleLowerCase();
        if (librarySearchTerm && !searchHaystack.includes(librarySearchTerm)) return;
        const label = (track[field] || (field === "folder" ? "Almacenamiento interno" : "Desconocido")).trim();
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(index);
    });
    if (!groups.size) {
        const empty = document.createElement("div"); empty.className = "library-empty";
        const h = document.createElement("h3"); h.textContent = category === "albumes" ? "Álbumes" : category === "artistas" ? "Artistas" : "Carpetas";
        const p = document.createElement("p"); p.textContent = "Actualiza la biblioteca para encontrar tu música."; empty.append(h,p); screenContent.appendChild(empty); return;
    }
    const list = document.createElement("div"); list.className = "library-list";
    [...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([label, indexes]) => {
        const row = document.createElement("button"); row.type = "button"; row.className = "library-track library-group";
        const info = document.createElement("span"); info.className = "library-track-info";
        const title = document.createElement("span"); title.className = "library-track-title"; title.textContent = label.split("/").filter(Boolean).pop() || label;
        const sub = document.createElement("span"); sub.className = "library-track-artist"; sub.textContent = `${indexes.length} ${indexes.length === 1 ? "canción" : "canciones"}`; info.append(title,sub);
        const arrow = document.createElement("span"); arrow.textContent = "›"; row.append(info,arrow);
        row.addEventListener("click",()=>{
            const selected = indexes; screenContent.innerHTML = "";
            const back = document.createElement("button"); back.className="library-back-btn"; back.textContent="← Volver"; back.addEventListener("click",()=>renderLibraryCategory(category)); screenContent.appendChild(back);
            const songs = document.createElement("div"); songs.className="library-list";
            selected.forEach(i=>{const t=musicLibrary[i]; const b=document.createElement("button");b.className="library-track";b.textContent=`♫  ${t.name} — ${t.artist}`;b.addEventListener("click",()=>{if(!playbackQueue.includes(i))playbackQueue.push(i);navigate("inicio");loadTrack(i,true);});songs.appendChild(b);}); screenContent.appendChild(songs);
        }); list.appendChild(row);
    }); screenContent.appendChild(list);
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

function createQueueItem(index, position, total, compact = false) {
    const track = musicLibrary[index];
    if (!track) return null;

    const row = document.createElement("div");
    row.className = "queue-item";

    const play = document.createElement("button");
    play.type = "button";
    play.className = "queue-track";
    play.textContent = track.name;
    play.addEventListener("click", () => {
        loadTrack(index, true);
        renderQueue();
        renderQueuePanel();
    });

    const actions = document.createElement("div");
    actions.className = "queue-item-actions";

    const up = document.createElement("button");
    up.type = "button";
    up.className = "queue-action-btn";
    up.textContent = "↑";
    up.title = "Mover arriba";
    up.disabled = position <= 0;
    up.addEventListener("click", () => moveQueueItem(position, -1));

    const down = document.createElement("button");
    down.type = "button";
    down.className = "queue-action-btn";
    down.textContent = "↓";
    down.title = "Mover abajo";
    down.disabled = position >= total - 1;
    down.addEventListener("click", () => moveQueueItem(position, 1));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "queue-action-btn remove";
    remove.textContent = "×";
    remove.title = "Quitar de la cola";
    remove.addEventListener("click", () => removeFromQueue(index));

    actions.append(up, down, remove);
    row.append(play, actions);
    return row;
}

function getUpcomingQueueEntries() {
    const currentPosition = playbackQueue.indexOf(currentTrackIndex);
    const start = currentPosition >= 0 ? currentPosition + 1 : 0;
    return playbackQueue
        .map((trackIndex, queuePosition) => ({ trackIndex, queuePosition }))
        .slice(start)
        .filter(item => Boolean(musicLibrary[item.trackIndex]));
}

function renderQueue() {
    if (!screenContent) return;

    screenContent.innerHTML = "";

    const current = document.createElement("section");
    current.className = "queue-current-section";

    const currentHeading = document.createElement("h3");
    currentHeading.textContent = "Reproduciendo ahora";
    current.appendChild(currentHeading);

    if (currentTrackIndex >= 0 && musicLibrary[currentTrackIndex]) {
        const currentTrack = document.createElement("div");
        currentTrack.className = "queue-current-track";
        currentTrack.textContent = `▶  ${musicLibrary[currentTrackIndex].name}`;
        current.appendChild(currentTrack);
    } else {
        const emptyCurrent = document.createElement("p");
        emptyCurrent.className = "queue-screen-empty";
        emptyCurrent.textContent = "Todavía no hay una canción reproduciéndose.";
        current.appendChild(emptyCurrent);
    }

    const heading = document.createElement("h3");
    heading.className = "queue-upcoming-heading";
    const upcoming = getUpcomingQueueEntries();
    heading.textContent = `A continuación (${upcoming.length})`;

    const list = document.createElement("div");
    list.className = "queue-screen-list";

    if (!upcoming.length) {
        const empty = document.createElement("div");
        empty.className = "library-empty";
        empty.innerHTML = `
            <div class="library-empty-icon">♫</div>
            <h3>Tu cola está vacía</h3>
            <p>Agrega canciones desde tu biblioteca para preparar lo que sigue.</p>`;
        list.appendChild(empty);
    } else {
        upcoming.forEach(({ trackIndex, queuePosition }) => {
            const item = createQueueItem(
                trackIndex,
                queuePosition,
                playbackQueue.length
            );
            if (item) list.appendChild(item);
        });
    }

    const addMore = document.createElement("button");
    addMore.type = "button";
    addMore.className = "library-add-btn queue-add-more";
    addMore.textContent = "＋ Agregar canciones desde biblioteca";
    addMore.addEventListener("click", () => navigate("biblioteca"));

    screenContent.append(current, heading, list, addMore);
}

function addToQueue(index) {
    if (!musicLibrary[index]) return;

    if (playbackQueue.includes(index)) {
        showMessage("Esa canción ya está en la cola.");
        return;
    }

    playbackQueue.push(index);
    savePulsoState();
    renderQueue();
    renderQueuePanel();
    if (currentScreen === "biblioteca") renderLibrary();
    showMessage("Canción agregada a la cola.");
}

function removeFromQueue(index) {
    const position = playbackQueue.indexOf(index);
    if (position < 0) return;

    if (index === currentTrackIndex) {
        showMessage("No puedes quitar la canción que está sonando.");
        return;
    }

    playbackQueue.splice(position, 1);
    savePulsoState();
    renderQueue();
    renderQueuePanel();
    if (currentScreen === "biblioteca") renderLibrary();
    showMessage("Canción quitada de la cola.");
}

function moveQueueItem(position, direction) {
    const target = position + direction;
    if (position < 0 || target < 0 || target >= playbackQueue.length) return;

    // La canción actual permanece en su sitio; solo se reordenan las pendientes.
    if (playbackQueue[position] === currentTrackIndex ||
        playbackQueue[target] === currentTrackIndex) return;

    [playbackQueue[position], playbackQueue[target]] =
        [playbackQueue[target], playbackQueue[position]];
    savePulsoState();

    renderQueue();
    renderQueuePanel();
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

        ${isNativeAndroid ? `
        <div class="settings-section">
            <h3>Segundo plano</h3>
            <button type="button" class="library-add-btn" id="openNotifSettings">Abrir ajustes de notificaciones</button>
            <p class="equalizer-note">Si la música se corta con la pantalla apagada, en los ajustes de Android pon la batería de PULSO en «Sin restricciones».</p>
        </div>` : ""}

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

    const notifSettingsBtn = screenContent.querySelector("#openNotifSettings");
    if (notifSettingsBtn) {
        notifSettingsBtn.addEventListener("click", () => {
            PulsoNative.openNotificationSettings().catch(() => showMessage("No se pudieron abrir los ajustes."));
        });
    }

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

    // En la app Android la música sale por el servicio nativo. Pasar el audio por
    // Web Audio dentro del WebView provoca estática cuando la app queda en segundo plano.
    if (isNativeAndroid || !AudioContextClass || !audioPlayer) {
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
            if (isNativeAndroid) PulsoNative.setEqualizer({ bands: equalizerValues });
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
        if (isNativeAndroid) PulsoNative.setEqualizer({ bands: equalizerValues });
        panel.querySelectorAll("input[type=range]").forEach(input => input.value = "0");
        panel.querySelectorAll("output").forEach(output => output.textContent = "0 dB");
    });
    panel.appendChild(reset);
    screenContent.appendChild(panel);
    if (!audioContext && !isNativeAndroid) showMessage("Reproduce una canción para activar los controles de sonido.");
}

/* =========================================
   ACTIVAR MODO DEL VISUALIZADOR
========================================= */

function setVisualizerMode(mode) {
    const visualizer = $("visualizerCircle");
    const stage = document.querySelector(".visual-stage");
    if (!visualizer || !stage) return;

    const validModes = ["circular", "bars", "wave", "mirror"];
    if (!validModes.includes(mode)) mode = "circular";

    visualizer.classList.remove("mode-circular", "mode-bars", "mode-wave", "mode-mirror");
    visualizer.classList.add(`mode-${mode}`);
    stage.dataset.visualMode = mode;

    createVisualizerBars();
}

function createVisualizerBars() {
    const barContainer = $("visualizerBars");
    if (!barContainer) return;

    barContainer.replaceChildren();
    const stage = document.querySelector(".visual-stage");
    const mode = stage?.dataset.visualMode || "circular";
    // Barras y Olas usan menos columnas para evitar una cola de frecuencias casi inmóviles.
    const total = (mode === "bars" || mode === "wave") ? 36 : 48;

    for (let i = 0; i < total; i++) {
        const bar = document.createElement("div");
        bar.className = "visual-bar";
        bar.dataset.index = String(i);
        barContainer.appendChild(bar);
    }

    animateVisualizer();
}

function animateVisualizer() {
    if (animationFrame) cancelAnimationFrame(animationFrame);

    const stage = document.querySelector(".visual-stage");
    const container = $("visualizerBars");
    if (!stage || !container) return;

    const bars = Array.from(container.querySelectorAll(".visual-bar"));

    function draw() {
        const mode = stage.dataset.visualMode || "circular";
        const count = bars.length;

        const usingNative = isNativeTrack();
        if (!usingNative && analyser && frequencyData && isPlaying) { analyser.getByteFrequencyData(frequencyData); }

        bars.forEach((bar, index) => {
            const isMirror = mode === "mirror";
            const pairIndex = isMirror ? index % (count / 2) : index;
            const samplePosition = isMirror
                ? pairIndex / Math.max(1, count / 2 - 1)
                : index / Math.max(1, count - 1);

            let level = 0;
            if (usingNative && isPlaying && nativeFrequencyData.length) {
                const bin = Math.min(nativeFrequencyData.length - 1, Math.floor(samplePosition * (nativeFrequencyData.length - 1)));
                level = Math.pow((nativeFrequencyData[bin] || 0) / 255, 0.78);
            } else if (analyser && frequencyData && isPlaying) {
                // Repartimos las barras entre las frecuencias que contienen energía musical útil.
                // Evita asignar las últimas columnas a agudos casi siempre silenciosos.
                const usableBins = Math.max(8, Math.floor(frequencyData.length * 0.62));
                const curvedPosition = Math.pow(samplePosition, 1.18);
                const centerBin = Math.min(
                    usableBins - 1,
                    Math.floor(curvedPosition * (usableBins - 1))
                );
                const firstBin = Math.max(0, centerBin - 1);
                const lastBin = Math.min(usableBins - 1, centerBin + 1);
                let totalEnergy = 0;
                let samples = 0;
                for (let bin = firstBin; bin <= lastBin; bin++) {
                    totalEnergy += frequencyData[bin] || 0;
                    samples++;
                }
                const rawLevel = samples ? totalEnergy / samples / 255 : 0;
                level = Math.pow(rawLevel, 0.78);
            }

            // Subida rápida y caída suave: las barras siguen el golpe de la música sin temblar.
            const previousLevel = barLevels[index] || 0;
            level = level > previousLevel
                ? previousLevel + (level - previousLevel) * 0.65
                : previousLevel + (level - previousLevel) * 0.2;
            barLevels[index] = level;

            const base = mode === "circular" ? 9 : 18;
            const amplitude = mode === "circular" ? 62 : 125;
            const height = isPlaying ? base + level * amplitude : base;
            bar.style.height = `${height}px`;

            if (mode === "circular") {
                const angle = (index / count) * 360;
                bar.style.left = "50%";
                bar.style.top = "50%";
                bar.style.bottom = "auto";
                bar.style.transform =
                    `translate(-50%, -50%) rotate(${angle}deg) translateY(-132px)`;
                bar.style.transformOrigin = "center center";
            } else {
                const positionIndex = isMirror ? pairIndex : index;
                const positionCount = isMirror ? count / 2 : count;
                const left = 3 + (positionIndex / Math.max(1, positionCount - 1)) * 94;
                const lowerHalf = isMirror && index >= count / 2;

                bar.style.left = `${left}%`;
                bar.style.top = "auto";
                bar.style.bottom = "50%";
                bar.style.transformOrigin = "center bottom";
                bar.style.transform = lowerHalf
                    ? "translateX(-50%) scaleY(-1)"
                    : "translateX(-50%)";

                if (mode === "wave") {
                    const wave = (Math.sin(positionIndex * 0.34) + 1) / 2;
                    bar.style.height =
                        `${Math.max(24, height * (0.65 + wave * 0.75))}px`;
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
        renderQueuePanel();
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
        if (isNativeAndroid && musicLibrary[currentTrackIndex]?.native) {
            const durationMs = (musicLibrary[currentTrackIndex].duration || 0) * 1000;
            PulsoNative.playbackControl({ action: "seek", position: Math.round(durationMs * Number(progressBar.value) / 100) }); return;
        }
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

if (progressBar) {
    progressBar.addEventListener("pointerdown", () => { progressDragging = true; });
    ["pointerup", "pointercancel", "change", "blur"].forEach(name =>
        progressBar.addEventListener(name, () => { progressDragging = false; }));
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
    savePulsoState();

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
    savePulsoState();

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
    savePulsoState();

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
        // En la app Android la música se lee de la biblioteca del teléfono para que suene en
        // segundo plano y con controles en la notificación. El selector de archivos solo se usa en la web.
        if (isNativeAndroid) { scanNativeLibrary(); return; }
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

async function scanNativeLibrary() {
    if (!isNativeAndroid) { showMessage("El escaneo completo requiere la aplicación Android instalada."); return; }
    try {
        const permission = await PulsoNative.requestAudioPermission();
        if (!permission.granted) { showMessage("Necesitamos permiso para leer tu música."); return; }
        try { await PulsoNative.requestNotificationPermission(); } catch (_) {}
        const result = await PulsoNative.scanAudio();
        const oldByUri = new Map(musicLibrary.filter(t=>t.native).map(t=>[t.url,t]));
        const savedFavorites = new Set(restoredPulsoState.favorites || []);
        musicLibrary.forEach(t=>{if(t.url && t.url.startsWith("blob:"))URL.revokeObjectURL(t.url);});
        musicLibrary = (result.tracks || []).map(t=>{
            const uri=t.uri, old=oldByUri.get(uri);
            return { id:t.id, name:t.title || "Canción desconocida", artist:t.artist && t.artist !== "<unknown>" ? t.artist : "Artista desconocido", album:t.album && t.album !== "<unknown>" ? t.album : "Álbum desconocido", folder:t.folder || "Almacenamiento interno", duration:(Number(t.duration)||0)/1000, url:uri, native:true, favorite:!!(old?.favorite || savedFavorites.has(uri)) };
        });
        const savedQueue = restoredPulsoState.queue || [];
        playbackQueue = savedQueue.length ? savedQueue.map(uri=>musicLibrary.findIndex(t=>t.url===uri)).filter(i=>i>=0) : musicLibrary.map((_,i)=>i);
        if (!playbackQueue.length) playbackQueue = musicLibrary.map((_,i)=>i);
        currentTrackIndex = restoredPulsoState.current ? musicLibrary.findIndex(t=>t.url===restoredPulsoState.current) : -1;
        if (currentTrackIndex >= 0) {
            const restoredTrack = musicLibrary[currentTrackIndex];
            if (songTitle) songTitle.textContent = restoredTrack.name;
            if (songArtist) songArtist.textContent = restoredTrack.artist;
            if (totalTime) totalTime.textContent = formatTime(restoredTrack.duration);
            if (currentTime) currentTime.textContent = "0:00";
        }
        updateLibraryCount(); renderLibrary(); renderQueuePanel(); savePulsoState();
        showMessage(`${musicLibrary.length} canciones encontradas y biblioteca sincronizada.`);
    } catch(error) { console.error(error); showMessage("No se pudo escanear la música. Revisa los permisos."); }
}
if (scanMusicBtn) scanMusicBtn.addEventListener("click", scanNativeLibrary);

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


/* BÚSQUEDA DE BIBLIOTECA */
const searchBtn = $("searchBtn"), searchPanel = $("searchPanel"), searchInput = $("searchInput");
if (searchBtn && searchPanel) searchBtn.addEventListener("click",()=>{searchPanel.hidden=!searchPanel.hidden;if(!searchPanel.hidden)searchInput?.focus();});
if (searchInput) searchInput.addEventListener("input",()=>{librarySearchTerm=searchInput.value.trim().toLocaleLowerCase();if(currentScreen!=="biblioteca")navigate("biblioteca");else renderLibrary();});

async function ensureNativePermissions() {
    try {
        const notifications = await PulsoNative.requestNotificationPermission();
        if (notifications?.granted === false && !nativeNoticeShown.notifications) {
            nativeNoticeShown.notifications = true;
            showMessage("Activa las notificaciones de PULSO (Menú → Ajustes) para ver los controles en la barra y en la pantalla de bloqueo.");
        }
    } catch (_) {}
    try {
        const visualizer = await PulsoNative.requestVisualizerPermission();
        nativeVisualizerGranted = visualizer?.granted !== false;
    } catch (_) {}
}

function pauseNativeIfPlaying() {
    if (!isNativeAndroid) return;
    PulsoNative.getPlaybackState().then(state => {
        if (state?.playing) PulsoNative.playbackControl({ action: "pause" });
    }).catch(() => {});
}

async function syncNativeState() {
    if (nativeStateBusy || !isNativeTrack()) return;
    nativeStateBusy = true;
    try {
        const state = await PulsoNative.getPlaybackState();
        if (!isNativeTrack()) return;
        const track = musicLibrary[currentTrackIndex];
        const playingNow = Boolean(state.playing);
        const justRequested = Date.now() - nativePlayRequestedAt < 2500;

        // Mientras Android prepara la canción, no se devuelve el botón a "Reproducir".
        if (playingNow || !justRequested) {
            if (isPlaying !== playingNow) {
                isPlaying = playingNow;
                updatePlayButton();
                updateVinylRotation();
            }
        }

        const total = Number(state.duration) > 0 ? Number(state.duration) : (track.duration || 0) * 1000;
        const position = Math.max(0, Number(state.position) || 0);
        if (currentTime && (playingNow || !justRequested)) currentTime.textContent = formatTime(position / 1000);
        if (totalTime) totalTime.textContent = formatTime(total / 1000);
        if (progressBar && total > 0 && !progressDragging) progressBar.value = Math.min(100, (position / total) * 100);
    } catch (error) {
        console.warn("No se pudo leer el estado de reproducción:", error);
    } finally {
        nativeStateBusy = false;
    }
}

async function offerVisualizerFix() {
    if (nativeNoticeShown.vizFix) return;
    nativeNoticeShown.vizFix = true;
    const hadPermission = nativeVisualizerGranted;
    let granted = false;
    try { granted = (await PulsoNative.requestVisualizerPermission())?.granted === true; } catch (_) {}
    nativeVisualizerGranted = granted;
    if (!granted) {
        const open = window.confirm("Para que las barras se muevan con la música, Android pide el permiso de Micrófono. PULSO no graba audio: solo lo usa para leer el sonido que reproduce.\n\n¿Abrir los ajustes para activarlo?");
        if (open) PulsoNative.openAppSettings().catch(() => {});
    } else if (!hadPermission) {
        showMessage("Permiso concedido. Vuelve a reproducir la canción para activar las barras.");
    } else {
        showMessage("Este teléfono no permite leer el sonido para el visualizador.");
    }
}

async function syncNativeSpectrum() {
    if (nativeVisualizerBusy || !isNativeTrack() || !isPlaying) return;
    nativeVisualizerBusy = true;
    try {
        const result = await PulsoNative.getVisualizerData();
        nativeVisualizerActive = result?.active !== false;
        if (nativeVisualizerActive) nativeInactiveSince = 0;
        else if (!nativeInactiveSince) nativeInactiveSince = Date.now();
        else if (Date.now() - nativeInactiveSince > 2500) offerVisualizerFix();
        const values = result?.spectrum || [];
        if (values.length) {
            nativeFrequencyData = Uint8Array.from(values, value => Math.max(0, Math.min(255, Number(value) || 0)));
        }
    } catch (_) {
    } finally {
        nativeVisualizerBusy = false;
    }
}

function startNativeStatePolling() {
    if (!isNativeAndroid) return;
    if (!nativeStateTimer) nativeStateTimer = setInterval(syncNativeState, 250);
    if (!nativeVisualizerTimer) nativeVisualizerTimer = setInterval(syncNativeSpectrum, 50);
}

function stopNativeStatePolling() {
    clearInterval(nativeStateTimer);
    clearInterval(nativeVisualizerTimer);
    nativeStateTimer = null;
    nativeVisualizerTimer = null;
    nativeFrequencyData = new Uint8Array(64);
}

// Con la app en segundo plano no hace falta consultar el estado; al volver se sincroniza de inmediato.
document.addEventListener("visibilitychange", () => {
    if (!isNativeAndroid) return;
    if (document.hidden) {
        stopNativeStatePolling();
    } else if (isNativeTrack()) {
        startNativeStatePolling();
        syncNativeState();
    }
});

if (isNativeAndroid) {
    PulsoNative.addListener("mediaNext", playNextTrack);
    PulsoNative.addListener("mediaPrevious", playPreviousTrack);
    PulsoNative.addListener("mediaEnded", () => { if (repeatMode === 2) playCurrentTrack(); else playNextTrack(); });
    PulsoNative.addListener("mediaError", () => {
        isPlaying = false; updatePlayButton(); updateVinylRotation();
        showMessage("No se pudo reproducir esta canción. Prueba con otra o actualiza la biblioteca.");
    });
}

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

    if (event.code === "ArrowRight" && isNativeAndroid && musicLibrary[currentTrackIndex]?.native) { PulsoNative.playbackControl({action:"seek",position:Math.min((musicLibrary[currentTrackIndex].duration||0)*1000, (Number(progressBar?.value||0)/100)*(musicLibrary[currentTrackIndex].duration||0)*1000+5000)}); }
    else if (event.code === "ArrowRight" && audioPlayer) {
        audioPlayer.currentTime = Math.min(
            audioPlayer.duration || 0,
            audioPlayer.currentTime + 5
        );
    }

    if (event.code === "ArrowLeft" && isNativeAndroid && musicLibrary[currentTrackIndex]?.native) { PulsoNative.playbackControl({action:"seek",position:Math.max(0,(Number(progressBar?.value||0)/100)*(musicLibrary[currentTrackIndex].duration||0)*1000-5000)}); }
    else if (event.code === "ArrowLeft" && audioPlayer) {
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

    const upcoming = getUpcomingQueueEntries().map(item => item.trackIndex);

    if (!upcoming.length) {
        list.innerHTML = '<div class="empty-queue">Agrega canciones para formar tu cola.</div>';
        return;
    }

    upcoming.forEach(index => {
        const track = musicLibrary[index];
        if (!track) return;

        const row = document.createElement("div");
        row.className = "queue-panel-row";

        const play = document.createElement("button");
        play.type = "button";
        play.className = "queue-track";
        play.textContent = track.name;
        play.addEventListener("click", () => {
            loadTrack(index, true);
            renderQueuePanel();
            renderQueue();
        });

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "queue-action-btn remove";
        remove.textContent = "×";
        remove.title = "Quitar de la cola";
        remove.addEventListener("click", () => removeFromQueue(index));

        row.append(play, remove);
        list.appendChild(row);
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

/* =========================================
   ANUNCIOS (GOOGLE ADMOB)
========================================= */

function setAdSpace(height) {
    const value = Math.max(0, Math.round(Number(height) || 0));
    document.documentElement.style.setProperty("--ad-space", `${value}px`);
}

async function initAds() {
    const config = window.PULSO_ADS;
    const AdMob = window.Capacitor?.Plugins?.AdMob;
    if (!config?.enabled || !config.bannerId || !isNativeAndroid || !AdMob) return;

    try {
        try {
            const consent = await AdMob.requestConsentInfo();
            if (consent?.isConsentFormAvailable && consent.status === "REQUIRED") {
                await AdMob.showConsentForm();
            }
        } catch (error) {
            console.warn("Consentimiento de anuncios:", error);
        }

        await AdMob.initialize({ initializeForTesting: Boolean(config.useTestAds) });
        let adSizeKnown = false;
        let adFailed = false;
        AdMob.addListener("bannerAdSizeChanged", size => { adSizeKnown = true; setAdSpace(size?.height); });
        AdMob.addListener("bannerAdFailedToLoad", () => { adFailed = true; setAdSpace(0); });
        await AdMob.showBanner({
            adId: config.bannerId,
            adSize: "ADAPTIVE_BANNER",
            position: "BOTTOM_CENTER",
            margin: 0,
            isTesting: Boolean(config.useTestAds)
        });
        // Si el plugin no informa la altura, se reserva un espacio estándar para el banner.
        setTimeout(() => { if (!adSizeKnown && !adFailed) setAdSpace(60); }, 3000);
    } catch (error) {
        console.warn("No se pudo mostrar el anuncio:", error);
        setAdSpace(0);
    }
}

function initializePulso() {
    restorePulsoState();
    navigate("inicio");

    updateLibraryCount();

    updatePlayButton();

    updateVinylRotation();

    createVisualizerBars();
    const allowedModes = ["circular", "bars", "wave", "mirror"];
    setVisualizerMode(allowedModes.includes(restoredPulsoState.visualMode) ? restoredPulsoState.visualMode : "circular");

    const visualizer = $("visualizerCircle");

    if (visualizer) {
        visualizer.classList.add("mode-circular");
    }

    console.log("PULSO iniciado correctamente.");
    if (isNativeAndroid) {
        startNativeStatePolling();
        initAds();
        const visualStage = document.querySelector(".visual-stage");
        if (visualStage) {
            visualStage.addEventListener("click", () => {
                if (isNativeTrack() && isPlaying && !nativeVisualizerActive) {
                    nativeNoticeShown.vizFix = false;
                    offerVisualizerFix();
                }
            });
        }
        PulsoNative.hasAudioPermission().then(result => {
            if (result?.granted) scanNativeLibrary();
        }).catch(() => {});
    }
}

initializePulso();

/* =========================================
   FIN DEL ARCHIVO
========================================= */
