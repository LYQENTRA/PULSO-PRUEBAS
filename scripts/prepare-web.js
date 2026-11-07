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
