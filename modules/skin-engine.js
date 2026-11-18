(function (global) {
  "use strict";

  const STORAGE_KEY = "pulso.activeSkin";
  const INSTALLED_KEY = "pulso.installedSkins.v1";
  const CATALOG_VERSION_KEY = "pulso.skin.catalog.v4";

  const builtInSkins = [
    {
      id: "classic",
      name: "Classic Green",
      description: "Identidad original de PULSO.",
      access: "free",
      preview: "assets/skins/classic-green.svg",
      layout: "classic",
      accent: "#39FF14",
      accentSecondary: "#00E65A",
      accentRgb: "57,255,20",
      secondaryRgb: "0,230,90",
      background: "#030504",
      surface: "#0b100e",
      panel: "#101713",
      text: "#ffffff",
      muted: "#a8b3ad",
      positions: {}
    },
    {
      id: "red",
      name: "Red Neon",
      description: "Consola industrial negra con iluminación roja.",
      access: "free",
      preview: "assets/skins/red-neon-pack/preview.jpg",
      layout: "red-console",
      accent: "#FF2638",
      accentSecondary: "#FF6673",
      accentRgb: "255,38,56",
      secondaryRgb: "255,102,115",
      background: "#080304",
      surface: "#16090b",
      panel: "#210d10",
      text: "#fff7f7",
      muted: "#c5aeb1",
      positions: {}
    }
  ];

  const actionNames = new Set([
    "playback.toggle",
    "playback.previous",
    "playback.next",
    "playback.shuffle",
    "playback.repeat",
    "playback.favorite",
    "playback.seek",
    "playback.volume",
    "navigation.menu",
    "navigation.search",
    "navigation.queue",
    "navigation.equalizer",
    "navigation.library",
    "navigation.settings"
  ]);

  const safeId = value => typeof value === "string" && /^[a-z0-9][a-z0-9-]{1,39}$/.test(value);
  const safeColor = value => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
  const readInstalled = () => {
    try {
      const value = JSON.parse(global.localStorage.getItem(INSTALLED_KEY) || "[]");
      return Array.isArray(value) ? value.filter(item => item && safeId(item.id)) : [];
    } catch (_) {
      return [];
    }
  };

  let premiumUnlocked = false;
  let installedSkins = readInstalled();

  function allSkins() {
    return builtInSkins.concat(installedSkins);
  }

  function findSkin(id) {
    return allSkins().find(item => item.id === id) || builtInSkins[0];
  }

  function currentId() {
    try {
      return global.localStorage.getItem(STORAGE_KEY) || "classic";
    } catch (_) {
      return "classic";
    }
  }

  function apply(id) {
    const skin = findSkin(id);
    if (skin.access === "premium" && !premiumUnlocked) {
      return { applied: false, reason: "premium-required" };
    }

    const root = global.document.documentElement;
    root.dataset.pulsoSkin = skin.id;
    root.dataset.pulsoLayout = skin.layout || "classic";

    const vars = {
      "--neon": skin.accent,
      "--neon-secondary": skin.accentSecondary,
      "--neon-rgb": skin.accentRgb,
      "--neon-secondary-rgb": skin.secondaryRgb,
      "--bg": skin.background,
      "--surface": skin.surface,
      "--theme-surface": skin.surface,
      "--theme-panel": skin.panel,
      "--theme-text": skin.text,
      "--theme-muted": skin.muted,
      "--text": skin.text,
      "--muted": skin.muted,
      "--gray": skin.muted,
      "--white": skin.text,
      "--border": "color-mix(in srgb, " + skin.accent + " 22%, transparent)",
      "--theme-border": "color-mix(in srgb, " + skin.accent + " 22%, transparent)",
      "--green": skin.accent,
      "--glow": "0 0 20px rgba(" + skin.accentRgb + ",.38)",
      "--theme-header": "color-mix(in srgb, " + skin.background + " 92%, " + skin.panel + ")",
      "--theme-control-bg": "color-mix(in srgb, " + skin.panel + " 82%, " + skin.background + ")"
    };

    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));

    try {
      global.localStorage.setItem(STORAGE_KEY, skin.id);
      global.localStorage.setItem(CATALOG_VERSION_KEY, "4");
    } catch (_) {}

    global.dispatchEvent(new CustomEvent("pulso:skin-changed", { detail: { skin } }));
    return { applied: true, skin: Object.assign({}, skin) };
  }

  function validateManifest(manifest) {
    if (!manifest || manifest.format !== "pulso-skin" || manifest.formatVersion !== 1) {
      throw new Error("Formato de skin no compatible.");
    }
    if (!safeId(manifest.id) || builtInSkins.some(item => item.id === manifest.id)) {
      throw new Error("Identificador de skin no permitido.");
    }
    if (!manifest.theme || !safeColor(manifest.theme.accent) || !safeColor(manifest.theme.accentSecondary)) {
      throw new Error("La paleta de colores no es válida.");
    }
    const actions = Array.isArray(manifest.actions) ? manifest.actions : [];
    if (actions.some(action => !actionNames.has(action))) {
      throw new Error("La skin contiene una acción no permitida.");
    }
    if (manifest.security && (
      manifest.security.scriptsAllowed ||
      manifest.security.networkAllowed ||
      manifest.security.nativeAccessAllowed
    )) {
      throw new Error("Las skins no pueden ejecutar scripts ni acceder a funciones nativas.");
    }
    return {
      id: manifest.id,
      name: String(manifest.name || manifest.id).slice(0, 48),
      description: String(manifest.description || "").slice(0, 180),
      version: String(manifest.version || "1.0.0").slice(0, 24),
      author: String(manifest.author || "").slice(0, 48),
      preview: typeof manifest.preview === "string" ? manifest.preview : "",
      layout: safeId(manifest.layout) ? manifest.layout : "classic",
      access: manifest.access === "premium" ? "premium" : "free",
      accent: manifest.theme.accent,
      accentSecondary: manifest.theme.accentSecondary,
      accentRgb: manifest.theme.accentRgb || "255,38,56",
      secondaryRgb: manifest.theme.secondaryRgb || "255,102,115",
      background: safeColor(manifest.theme.background) ? manifest.theme.background : "#080304",
      surface: safeColor(manifest.theme.surface) ? manifest.theme.surface : "#16090b",
      panel: safeColor(manifest.theme.panel) ? manifest.theme.panel : "#210d10",
      text: safeColor(manifest.theme.text) ? manifest.theme.text : "#ffffff",
      muted: safeColor(manifest.theme.muted) ? manifest.theme.muted : "#aaaaaa",
      positions: manifest.positions && typeof manifest.positions === "object" ? manifest.positions : {},
      manifest: manifest
    };
  }

  function persistInstalled() {
    global.localStorage.setItem(INSTALLED_KEY, JSON.stringify(installedSkins));
  }

  function install(manifest) {
    const skin = validateManifest(manifest);
    installedSkins = installedSkins.filter(item => item.id !== skin.id);
    installedSkins.push(skin);
    persistInstalled();
    global.dispatchEvent(new CustomEvent("pulso:skin-catalog-changed"));
    return { installed: true, skin: Object.assign({}, skin) };
  }

  function uninstall(id) {
    if (builtInSkins.some(item => item.id === id)) {
      throw new Error("No se puede eliminar una skin incluida de fábrica.");
    }
    installedSkins = installedSkins.filter(item => item.id !== id);
    persistInstalled();
    if (currentId() === id) apply("classic");
    global.dispatchEvent(new CustomEvent("pulso:skin-catalog-changed"));
    return { removed: true, id };
  }

  global.PulsoSkins = Object.freeze({
    list: () => allSkins().map(item => Object.assign({}, item)),
    get: id => Object.assign({}, findSkin(id)),
    current: () => Object.assign({}, findSkin(currentId())),
    apply,
    install,
    uninstall,
    validateManifest,
    getActions: () => Array.from(actionNames),
    setPremiumStatus: value => {
      premiumUnlocked = Boolean(value);
      global.PULSO_PREMIUM = premiumUnlocked;
    },
    initialize: () => {
      try {
        const saved = global.localStorage.getItem(STORAGE_KEY);
        const valid = allSkins().some(item => item.id === saved);
        if (!valid) global.localStorage.setItem(STORAGE_KEY, "classic");
        global.localStorage.setItem(CATALOG_VERSION_KEY, "4");
      } catch (_) {}
      return apply(currentId());
    }
  });
})(window);
