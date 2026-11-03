// Bundles the game (three.js included) into one self-contained ../city-game.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = await build({
  entryPoints: [path.join(here, 'main.js')], bundle: true, format: 'esm', minify: true, write: false,
  target: 'es2020', legalComments: 'none', charset: 'utf8', external: ['https://*'],
});
const code = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = readFileSync(path.join(here, 'index.template.html'), 'utf8');
const html = tpl.replace('/*__BUNDLE__*/', () => code);
writeFileSync(path.join(here, '..', 'city-game.html'), html);
console.log('city-game.html', (html.length / 1024).toFixed(0) + ' KB');
