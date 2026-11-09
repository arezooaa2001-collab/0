// Builds one self-contained HTML file (all JS, CSS and three.js inlined) that runs by simply
// opening it in a browser — no web server needed.
//
// Usage:  npm install --no-save esbuild   (once)
//         node tools/build-single.mjs [output.html]

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'dist', 'shetab-racing.html'));

// resolve "three" and "three/addons/*" to the vendored copy (same mapping as the import map)
const vendorThree = {
  name: 'vendor-three',
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: path.join(root, 'vendor/three/build/three.module.min.js') }));
    b.onResolve({ filter: /^three\/addons\// }, (a) => ({
      path: path.join(root, 'vendor/three/examples/jsm', a.path.slice('three/addons/'.length)),
    }));
  },
};

const result = await build({
  entryPoints: [path.join(root, 'js/main.js')],
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  minify: true,
  legalComments: 'none',
  write: false,
  plugins: [vendorThree],
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(path.join(root, 'css/game.css'), 'utf8');
let html = readFileSync(path.join(root, 'index.html'), 'utf8');

const replaceOnce = (from, to) => {
  if (!html.includes(from)) throw new Error(`build-single: marker not found: ${from}`);
  html = html.replace(from, () => to);
};
replaceOnce('<link rel="stylesheet" href="css/game.css">', `<style>\n${css}\n</style>`);
html = html.replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '');
replaceOnce('<script type="module" src="js/main.js"></script>', `<script type="module">\n${js}\n</script>`);

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, html);
const license = readFileSync(path.join(root, 'vendor/three/LICENSE'), 'utf8').split('\n')[0];
console.log(`wrote ${path.relative(process.cwd(), out)} (${(html.length / 1024).toFixed(0)} KB) — includes three.js r170 (${license})`);
