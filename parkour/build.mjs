// ساخت یک فایل HTML مستقل (برای مرورگر، APK و محیط Claude)
import { build, context } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const watch = process.argv.includes('--watch');
mkdirSync('dist', { recursive: true });

const opts = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020', 'chrome90', 'safari15', 'firefox90'],
  minify: true,
  write: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'eof',
  logLevel: 'info',
};

function assemble(js) {
  const css = readFileSync('src/styles.css', 'utf8');
  const body = readFileSync('src/template.html', 'utf8');
  const font = readFileSync('node_modules/vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2').toString('base64');
  const fontCss = `@font-face{font-family:'Vazirmatn';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900;font-style:normal;font-display:swap}`;
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  const title = '<title>پارکور اوج</title>';
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><meta name="theme-color" content="#07060f"><meta name="description" content="پارکور اوج — بازی پارکور سه‌بعدی با ۱۰۰۰ مرحله، سه حالت، رقبای زنده و چت">`;
  const full = `<!doctype html><html lang="fa" dir="rtl"><head>${head}${title}<style>${css}</style><style>${fontCss}</style></head><body>${body}<script>${safeJs}</script></body></html>`;
  // نسخهٔ Artifact: بدون اسکلت؛ عنوان در ابتدای فایل
  const artifact = `${title}<style>${css}</style><style>${fontCss}</style>${body}<script>${safeJs}</script>`;
  writeFileSync('dist/index.html', full);
  mkdirSync('artifact', { recursive: true });
  writeFileSync('artifact/parkour-ouj.html', artifact);
  console.log(`dist/index.html ${(full.length / 1024).toFixed(0)} KB`);
}

if (watch) {
  const ctx = await context({ ...opts, plugins: [{ name: 'out', setup(b) { b.onEnd((r) => r.outputFiles && assemble(r.outputFiles[0].text)); } }] });
  await ctx.watch();
} else {
  const r = await build(opts);
  assemble(r.outputFiles[0].text);
}
