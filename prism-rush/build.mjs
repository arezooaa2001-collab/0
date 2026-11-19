// Builds one self-contained HTML file (all JS, CSS and generated assets inline; three.js bundled in).
import { build, transform } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bungee&family=Lalezar&family=Vazirmatn:wght@400;600;800&display=swap">';
const res = await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: true, target: 'es2020', charset: 'utf8', write: false, loader: { '.json': 'json' }, legalComments: 'none', define: { 'process.env.NODE_ENV': '"production"' } });
let js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = (await transform(readFileSync('src/style.css', 'utf8'), { loader: 'css', minify: true })).code;
const body = readFileSync('src/body.html', 'utf8');
const head = `${fonts}\n<style>${css}</style>`;
const tpl = readFileSync('src/index.html', 'utf8');
const full = tpl.replace('<!--HEAD-->', () => head).replace('<!--BODY-->', () => `${body}\n<script>${js}</script>`);
writeFileSync('prism-rush.html', full);
// Artifact variant: no document skeleton (the host adds it); title + style first.
mkdirSync('dist', { recursive: true });
const art = `<title>Prism Rush</title>\n${head}\n${body}\n<script>${js}</script>\n`;
writeFileSync('dist/artifact.html', art);
console.log('prism-rush.html', (full.length / 1024).toFixed(0) + ' KB');
