const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const name of ['index.html', 'style.css', 'app.js', 'assets']) {
  const src = path.join(root, name);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, name), { recursive: true });
}
console.log('PULSO web assets preparados en www/');

// Configuración de anuncios (AdMob). Por defecto usa los anuncios de PRUEBA de Google.
const adsConfig = {
  enabled: (process.env.ADMOB_ENABLED || 'true') !== 'false',
  bannerId: process.env.ADMOB_BANNER_ID || 'ca-app-pub-3940256099942544/6300978111',
  useTestAds: (process.env.ADMOB_USE_TEST_ADS || 'true') !== 'false'
};
fs.writeFileSync(path.join(out, 'ads-config.js'), 'window.PULSO_ADS = ' + JSON.stringify(adsConfig) + ';\n');
console.log('Anuncios: ' + (adsConfig.enabled ? (adsConfig.useTestAds ? 'activados (modo prueba)' : 'activados (reales)') : 'desactivados'));
