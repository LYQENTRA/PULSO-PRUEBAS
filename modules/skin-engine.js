/* PULSO Skin Engine
 * Primera base del sistema de carátulas. No controla ni reinicia el audio.
 * Las skins describen apariencia; el reproductor sigue siendo único.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'pulso.activeSkin';
  const skins = [
    {
      id: 'classic',
      name: 'Classic Green',
      description: 'La identidad clásica de PULSO.',
      access: 'free',
      layout: 'classic',
      accent: '#39FF14',
      accentSecondary: '#00E65A',
      background: '#030504'
    },
    {
      id: 'red',
      name: 'Red Neon',
      description: 'Negro profundo con acentos rojos intensos.',
      access: 'premium',
      layout: 'red',
      accent: '#FF2638',
      accentSecondary: '#FF5262',
      background: '#080304'
    },
    {
      id: 'equalizer',
      name: 'Equalizer Studio',
      description: 'Una experiencia centrada en los controles de audio.',
      access: 'premium',
      layout: 'equalizer',
      accent: '#A855F7',
      accentSecondary: '#D946EF',
      background: '#07040B'
    }
  ];

  function findSkin(id) {
    return skins.find((skin) => skin.id === id) || skins[0];
  }

  function getCurrentId() {
    try {
      const saved = global.localStorage.getItem(STORAGE_KEY);
      return findSkin(saved).id;
    } catch (_) {
      return 'classic';
    }
  }

  let premiumUnlocked = false;

  function setPremiumStatus(value) {
    premiumUnlocked = Boolean(value);
    global.PULSO_PREMIUM = premiumUnlocked;
    const current = findSkin(getCurrentId());
    if (current.access === 'premium' && !premiumUnlocked) apply('classic');
  }

  function apply(id, options) {
    const skin = findSkin(id);
    const settings = options || {};
    const isPremium = premiumUnlocked || Boolean(global.PULSO_PREMIUM === true);

    if (skin.access === 'premium' && !isPremium && !settings.allowLockedPreview) {
      return { applied: false, reason: 'premium_required', skin };
    }

    const root = document.documentElement;
    root.dataset.pulsoSkin = skin.id;
    root.style.setProperty('--neon', skin.accent);
    root.style.setProperty('--neon-secondary', skin.accentSecondary);
    root.style.setProperty('--bg', skin.background);

    try {
      global.localStorage.setItem(STORAGE_KEY, skin.id);
    } catch (_) {}

    const detail = { skin };
    global.dispatchEvent(new CustomEvent('pulso:skin-changed', { detail }));
    return { applied: true, skin };
  }

  global.PulsoSkins = Object.freeze({
    list: () => skins.map((skin) => ({ ...skin })),
    get: (id) => ({ ...findSkin(id) }),
    current: () => ({ ...findSkin(getCurrentId()) }),
    apply,
    setPremiumStatus,
    initialize: () => apply(getCurrentId())
  });
})(window);
