/* PULSO Skin Engine — temas globales.
 * Cambia apariencia; nunca toca ni reinicia el motor de audio.
 */
(function (global) {
  'use strict';
  const STORAGE_KEY = 'pulso.activeSkin';
  const skins = [
    { id:'classic', name:'Classic Green', description:'Identidad original de PULSO.', access:'free',
      accent:'#39FF14', accentSecondary:'#00E65A', accentRgb:'57,255,20', secondaryRgb:'0,230,90',
      background:'#030504', surface:'#0b100e', panel:'#101713', text:'#ffffff', muted:'#a8b3ad' },
    { id:'red', name:'Red Neon', description:'Negro profundo con rojo intenso.', access:'premium',
      accent:'#FF2638', accentSecondary:'#FF6673', accentRgb:'255,38,56', secondaryRgb:'255,102,115',
      background:'#080304', surface:'#16090b', panel:'#210d10', text:'#fff7f7', muted:'#c5aeb1' },
    { id:'equalizer', name:'Equalizer Purple', description:'Experiencia centrada en el sonido.', access:'premium',
      accent:'#B45CFF', accentSecondary:'#F052D6', accentRgb:'180,92,255', secondaryRgb:'240,82,214',
      background:'#08040d', surface:'#120b1b', panel:'#1c1028', text:'#fffaff', muted:'#b9a9c7' },
    { id:'silver', name:'Silver Edition', description:'Estilo minimalista en plata.', access:'premium',
      accent:'#D5E0E8', accentSecondary:'#8EA5B5', accentRgb:'213,224,232', secondaryRgb:'142,165,181',
      background:'#080b0e', surface:'#11171c', panel:'#1a232b', text:'#f6f9fb', muted:'#aebbc4' }
  ];
  let premiumUnlocked = false;
  const findSkin = id => skins.find(s => s.id === id) || skins[0];
  function getCurrentId() {
    try { return findSkin(global.localStorage.getItem(STORAGE_KEY)).id; }
    catch (_) { return 'classic'; }
  }
  function setPremiumStatus(value) {
    premiumUnlocked = Boolean(value);
    global.PULSO_PREMIUM = premiumUnlocked;
    if (findSkin(getCurrentId()).access === 'premium' && !premiumUnlocked) apply('classic');
  }
  function apply(id, options) {
    const skin = findSkin(id);
    const allowPreview = Boolean(options && options.allowLockedPreview);
    if (skin.access === 'premium' && !premiumUnlocked && !allowPreview) {
      return { applied:false, reason:'premium_required', skin };
    }
    const root = global.document.documentElement;
    root.dataset.pulsoSkin = skin.id;
    const vars = {
      '--neon':skin.accent, '--neon-secondary':skin.accentSecondary,
      '--neon-rgb':skin.accentRgb, '--neon-secondary-rgb':skin.secondaryRgb,
      '--bg':skin.background, '--surface':skin.surface, '--theme-surface':skin.surface,
      '--theme-panel':skin.panel, '--theme-text':skin.text, '--theme-muted':skin.muted, '--gray':skin.muted
    };
    Object.entries(vars).forEach(([key,value]) => root.style.setProperty(key,value));
    try { global.localStorage.setItem(STORAGE_KEY,skin.id); } catch (_) {}
    global.dispatchEvent(new CustomEvent('pulso:skin-changed',{detail:{skin}}));
    return { applied:true, skin };
  }
  global.PulsoSkins = Object.freeze({
    list:() => skins.map(s => ({...s})),
    get:id => ({...findSkin(id)}),
    current:() => ({...findSkin(getCurrentId())}),
    apply, setPremiumStatus,
    initialize:() => apply(getCurrentId())
  });
})(window);
