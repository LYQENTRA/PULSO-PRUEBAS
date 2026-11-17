/* PULSO Skin Engine — catálogo temporal de una sola carátula.
 * Red Neon queda como único tema mientras se desarrolla y prueba como skin completa.
 * Este motor solo cambia la apariencia; no reinicia ni modifica el motor de audio.
 */
(function (global) {
  'use strict';
  const STORAGE_KEY = 'pulso.activeSkin';
  const skin = {
    id: 'red',
    name: 'Red Neon',
    description: 'Negro profundo, estructura industrial y luz roja.',
    access: 'free',
    preview: 'assets/skins/red-neon.svg',
    accent: '#FF2638',
    accentSecondary: '#FF6673',
    accentRgb: '255,38,56',
    secondaryRgb: '255,102,115',
    background: '#080304',
    surface: '#16090b',
    panel: '#210d10',
    text: '#fff7f7',
    muted: '#c5aeb1'
  };
  let premiumUnlocked = false;

  function apply(id) {
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
      global.localStorage.removeItem('pulso.activeSkin');
    } catch (_) {}
    global.dispatchEvent(new CustomEvent('pulso:skin-changed', { detail: { skin } }));
    return { applied: true, skin: { ...skin } };
  }

  global.PulsoSkins = Object.freeze({
    list: () => [{ ...skin }],
    get: () => ({ ...skin }),
    current: () => ({ ...skin }),
    apply,
    setPremiumStatus: value => { premiumUnlocked = Boolean(value); global.PULSO_PREMIUM = premiumUnlocked; },
    initialize: () => apply('red')
  });
})(window);
