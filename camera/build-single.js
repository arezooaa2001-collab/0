// Builds Camera.html: the whole app (HTML, CSS, JS, mp4-muxer, icon, enhancer engine)
// in one self-contained file that can be opened or hosted anywhere.
//   node camera/build-single.js
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const read = (p) => fs.readFileSync(path.join(dir, p), 'utf8');

// Module order matters: each module may only import from modules listed before it.
const MODULES = ['ui', 'renderer', 'storage', 'encoder', 'enhancer', 'app'];

function bundleModule(name) {
  let src = read(`js/${name}.js`);
  // import { a, b as c } from './x.js';  ->  const { a, b: c } = __m.x;
  src = src.replace(/import\s*\{([^}]*)\}\s*from\s*'\.\/([\w-]+)\.js';/g, (_, names, mod) => {
    const list = names.split(',').map((n) => n.trim()).filter(Boolean).map((n) => n.replace(/\s+as\s+/, ': '));
    return `const { ${list.join(', ')} } = __m['${mod}'];`;
  });
  const exported = [];
  src = src.replace(/^export\s+(async\s+function|function|class|const|let)\s+([\w$]+)/gm, (_, kind, id) => {
    exported.push(id);
    return `${kind} ${id}`;
  });
  if (/^\s*(import|export)\s/m.test(src)) throw new Error(`unhandled import/export in ${name}.js`);
  if (src.includes('import.meta')) {
    // Only reachable when window.__ENHANCE_CORE_URL is missing, which never happens here.
    src = src.replace(/import\.meta\.url/g, 'location.href');
  }
  return `__m['${name}'] = (() => {\n${src}\nreturn { ${exported.join(', ')} };\n})();\n`;
}

const safe = (code) => {
  if (/<\/script/i.test(code)) throw new Error('script contains </script');
  return code;
};

const iconData = `data:image/svg+xml;base64,${Buffer.from(read('icons/icon.svg')).toString('base64')}`;
let html = read('index.html');
html = html
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${iconData}" type="image/svg+xml">`)
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
  .replace(/src="icons\/icon\.svg"/g, `src="${iconData}"`)
  .replace('<link rel="stylesheet" href="css/style.css">', `<style>\n${read('css/style.css')}</style>`);

const scripts = [
  `<script>window.__CAMERA_SINGLE_FILE = true;</script>`,
  `<script>\n${safe(read('vendor/mp4-muxer.js'))}\n</script>`,
  `<script type="text/plain" id="enhance-core-src">\n${safe(read('js/enhance-core.js'))}\n</script>`,
  `<script>
(() => {
  'use strict';
  const core = document.getElementById('enhance-core-src').textContent;
  window.__ENHANCE_CORE_URL = URL.createObjectURL(new Blob([core], { type: 'text/javascript' }));
  const __m = {};
${safe(MODULES.map(bundleModule).join('\n'))}
})();
</script>`,
].join('\n  ');

const tags = '<script src="vendor/mp4-muxer.js"></script>\n  <script type="module" src="js/app.js"></script>';
if (!html.includes(tags)) throw new Error('script tags not found in index.html');
html = html.replace(tags, scripts);

const out = path.join(dir, 'Camera.html');
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
