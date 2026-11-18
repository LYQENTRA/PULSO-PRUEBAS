(function (global) {
  'use strict';
  const STORAGE_KEY = 'pulso.activeSkin';
  const skins = [
    {
      id: 'classic',
      name: 'Classic Green',
      description: 'Identidad original de PULSO.',
      access: 'free',
      preview: 'assets/skins/classic-green.svg',
      accent: '#39FF14',
      accentSecondary: '#00E65A',
      accentRgb: '57,255,20',
      secondaryRgb: '0,230,90',
      background: '#030504',
      surface: '#0b100e',
      panel: '#101713',
      text: '#ffffff',
      muted: '#a8b3ad'
    },
    {
      id: 'red',
      name: 'Red Neon',
      description: 'Consola industrial negra con iluminación roja.',
      access: 'free',
      preview: 'assets/skins/red-neon-preview.jpg',
      accent: '#FF2638',
      accentSecondary: '#FF6673',
      accentRgb: '255,38,56',
      secondaryRgb: '255,102,115',
      background: '#080304',
      surface: '#16090b',
      panel: '#210d10',
      text: '#fff7f7',
      muted: '#c5aeb1'
    }
  ];
  let premiumUnlocked = false;
  const findSkin = id => skins.find(item => item.id === id) || skins[0];

  function currentId() {
    try {
      return findSkin(global.localStorage.getItem(STORAGE_KEY)).id;
    } catch (_) {
      return 'classic';
    }
  }

  function apply(id) {
    const skin = findSkin(id);
    const root = global.document.documentElement;
    root.dataset.pulsoSkin = skin.id;
    const vars = {
      '--neon': skin.accent,
      '--neon-secondary': skin.accentSecondary,
      '--neon-rgb': skin.accentRgb,
      '--neon-secondary-rgb': skin.secondaryRgb,
      '--bg': skin.background,
      '--surface': skin.surface,
      '--theme-surface': skin.surface,
      '--theme-panel': skin.panel,
      '--theme-text': skin.text,
      '--theme-muted': skin.muted,
      '--text': skin.text,
      '--muted': skin.muted,
      '--gray': skin.muted,
      '--white': skin.text,
      '--border': `color-mix(in srgb, ${skin.accent} 22%, transparent)`,
      '--theme-border': `color-mix(in srgb, ${skin.accent} 22%, transparent)`,
      '--green': skin.accent,
      '--glow': `0 0 20px rgba(${skin.accentRgb},.38)`,
      '--theme-header': `color-mix(in srgb, ${skin.background} 92%, ${skin.panel})`,
      '--theme-control-bg': `color-mix(in srgb, ${skin.panel} 82%, ${skin.background})`
    };
    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
    try {
      global.localStorage.setItem(STORAGE_KEY, skin.id);
      global.localStorage.setItem('pulso.skin.catalog.v3', '1');
    } catch (_) {}
    global.dispatchEvent(new CustomEvent('pulso:skin-changed', { detail: { skin } }));
    return { applied: true, skin: { ...skin } };
  }

  global.PulsoSkins = Object.freeze({
    list: () => skins.map(item => ({ ...item })),
    get: id => ({ ...findSkin(id) }),
    current: () => ({ ...findSkin(currentId()) }),
    apply,
    setPremiumStatus: value => {
      premiumUnlocked = Boolean(value);
      global.PULSO_PREMIUM = premiumUnlocked;
    },
    initialize: () => {
      try {
        if (global.localStorage.getItem('pulso.skin.catalog.v3') !== '1') {
          global.localStorage.setItem(STORAGE_KEY, 'classic');
          global.localStorage.setItem('pulso.skin.catalog.v3', '1');
        }
      } catch (_) {}
      return apply(currentId());
    }
  });
})(window);
