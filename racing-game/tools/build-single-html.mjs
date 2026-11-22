// ساخت یک فایل HTML تکی و بدون نیاز به اینترنت (Three.js، کد بازی، CSS و فونت وزیرمتن داخل فایل)
// استفاده: npm install  &&  npm run build:html   → خروجی: dist/ghahreman-pist.html
import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = process.argv[2] || path.join(root, 'dist', 'ghahreman-pist.html');

const res = await build({
  entryPoints: [path.join(root, 'js', 'main.js')], bundle: true, format: 'iife', minify: true, write: false,
  target: ['es2020'], legalComments: 'none', absWorkingDir: root, nodePaths: [path.join(process.cwd(), 'node_modules')]
});
let js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const fontPath = path.join(path.dirname(require.resolve('vazirmatn/package.json')), 'fonts', 'webfonts', 'Vazirmatn[wght].woff2');
const font = fs.readFileSync(fontPath).toString('base64');
const css = `@font-face{font-family:'Vazirmatn';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900;font-style:normal;font-display:block}\n` + fs.readFileSync(path.join(root, 'style.css'), 'utf8');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="preconnect"[^>]*>\n?/g, '')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\n?/, '')
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}\n</style>`)
  .replace(/<script type="importmap">[\s\S]*?<\/script>\n?/, '')
  .replace('<script type="module" src="js/main.js"></script>', () => `<script>\n${js}\n</script>`)
  .replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024 / 1024).toFixed(2) + ' MB');
