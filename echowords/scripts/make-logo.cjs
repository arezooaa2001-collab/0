// Draws the AMIR ABC logo (a clean, straightened version of the family's hand-drawn sketch)
// and renders every size the app needs.
//   NODE_PATH=$(npm root -g) node scripts/make-logo.cjs
//
// Outputs:
//   src/brand/mark.svg                     the rainbow mark (used inside the app)
//   android/res/mipmap-*/ic_launcher.png   Android launcher icons
//   public/logo.png                        512 px icon (favicon / manifest)
//   docs/logo.png                          1080 px full logo with the titles
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const FONTS = path.join(ROOT, 'node_modules/@fontsource/vazirmatn/files');
const font = (f) => fs.readFileSync(path.join(FONTS, f)).toString('base64');

// ── Geometry: the sketch's three panels C, B, A with straight edges ─────────
// (corners measured from the hand drawing, then straightened and tidied)
const P = {
  L: [110, 560], // left corner
  T1: [560, 110], // top
  T2: [700, 180], // top right
  V: [470, 470], // inner corner where the panels meet
  R: [900, 450], // right tip
  B0: [470, 900], // bottom
};
const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
P.P1 = lerp(P.L, P.T1, 0.45); // C | B split on the left edge
P.P2 = lerp(P.B0, P.L, 0.57); // B | A split on the bottom edge
const pts = (...ks) => ks.map((k) => P[k].map((n) => n.toFixed(1)).join(',')).join(' ');

/** The rainbow mark. `id` keeps gradient ids unique; `letters` are equal-size, original orange. */
function markSvg({ id = 'ew', size = 1000 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="60 60 890 890" width="${size}" height="${size}" role="img" aria-label="AMIR ABC">
  <defs>
    <linearGradient id="${id}-rb" gradientUnits="userSpaceOnUse" x1="110" y1="900" x2="900" y2="110">
      <stop offset="0" stop-color="#ff3b6b"/>
      <stop offset="0.2" stop-color="#ff8c1a"/>
      <stop offset="0.4" stop-color="#ffd60a"/>
      <stop offset="0.6" stop-color="#22d39b"/>
      <stop offset="0.8" stop-color="#3a86ff"/>
      <stop offset="1" stop-color="#a855f7"/>
    </linearGradient>
    <linearGradient id="${id}-fa" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".30"/><stop offset="1" stop-color="#ff7eb6" stop-opacity=".18"/></linearGradient>
    <linearGradient id="${id}-fb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".28"/><stop offset="1" stop-color="#5ab8ff" stop-opacity=".18"/></linearGradient>
    <linearGradient id="${id}-fc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".32"/><stop offset="1" stop-color="#7dffb2" stop-opacity=".18"/></linearGradient>
  </defs>
  <g stroke="url(#${id}-rb)" stroke-width="34" stroke-linejoin="round" stroke-linecap="round">
    <polygon points="${pts('P2', 'V', 'R', 'B0')}" fill="url(#${id}-fa)"/>
    <polygon points="${pts('L', 'P1', 'V', 'P2')}" fill="url(#${id}-fb)"/>
    <polygon points="${pts('P1', 'T1', 'T2', 'V')}" fill="url(#${id}-fc)"/>
  </g>
  <g font-family="Vazirmatn, 'Arial Black', sans-serif" font-weight="900" font-size="150" text-anchor="middle" dominant-baseline="central"
     fill="#ff8f00" stroke="#ffffff" stroke-width="12" paint-order="stroke" stroke-linejoin="round">
    <text x="530" y="295">C</text>
    <text x="300" y="535">B</text>
    <text x="575" y="640">A</text>
  </g>
</svg>`;
}

const BACKGROUND = `
  radial-gradient(circle at 50% 42%, rgba(255,120,220,.45) 0, rgba(255,120,220,0) 38%),
  radial-gradient(circle at 18% 12%, rgba(90,184,255,.55) 0, rgba(90,184,255,0) 30%),
  radial-gradient(circle at 85% 88%, rgba(255,184,0,.35) 0, rgba(255,184,0,0) 32%),
  linear-gradient(160deg, #190a4a 0%, #3b0f78 45%, #7a1ea1 75%, #c2185b 100%)`;

function stars(n, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  let out = '';
  for (let i = 0; i < n; i++) {
    const r = 0.6 + rnd() * 2.2;
    out += `<circle cx="${(rnd() * 100).toFixed(2)}%" cy="${(rnd() * 100).toFixed(2)}%" r="${r.toFixed(1)}" fill="#fff" opacity="${(0.35 + rnd() * 0.6).toFixed(2)}"/>`;
  }
  return `<svg class="stars" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">${out}</svg>`;
}

const AMIR = [
  ['A', '#ff5459'],
  ['M', '#ff8a40'],
  ['I', '#00e676'],
  ['R', '#c6ff00'],
];

function page(body, w, h) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:Vazirmatn;font-weight:900;src:url(data:font/woff2;base64,${font('vazirmatn-arabic-900-normal.woff2')}) format('woff2');unicode-range:U+0600-06FF,U+200C-200E,U+FB50-FDFF,U+FE70-FEFF}
  @font-face{font-family:Vazirmatn;font-weight:900;src:url(data:font/woff2;base64,${font('vazirmatn-latin-900-normal.woff2')}) format('woff2')}
  html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
  .bg{position:relative;width:${w}px;height:${h}px;background:${BACKGROUND};font-family:Vazirmatn,sans-serif}
  .stars{position:absolute;inset:0}
  .center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .glow{filter:drop-shadow(0 0 ${w / 40}px rgba(255,255,255,.35)) drop-shadow(0 ${w / 90}px ${w / 60}px rgba(0,0,0,.35))}
  .fa{font-weight:900;color:#5ec2f7;-webkit-text-stroke:${w / 270}px #2563eb;paint-order:stroke fill;text-shadow:0 0 ${w / 50}px rgba(94,194,247,.9);direction:rtl}
  .amir{font-weight:900;display:flex;gap:.1em;line-height:1}
  .amir span{display:inline-block}
  .gold{background:linear-gradient(90deg,#fbe9c0,#e2b866);-webkit-background-clip:text;color:transparent}
  </style></head><body>${body}</body></html>`;
}

function amirAbcHtml(px) {
  const letters = AMIR.map(([c, col]) => `<span style="color:${col}">${c}</span>`).join('');
  const abc = ['A', 'B', 'C'].map((c) => `<span class="gold">${c}</span>`).join('');
  return `<div class="amir" style="font-size:${px}px">${letters}<span style="width:.35em"></span>${abc}</div>`;
}

(async () => {
  const mark = markSvg({ id: 'ewm' });
  fs.writeFileSync(path.join(ROOT, 'src/brand/mark.svg'), mark);

  const browser = await chromium.launch();
  const shot = async (html, w, h, out) => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.setContent(html);
    await p.evaluate(() => document.fonts.ready);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await p.screenshot({ path: out });
    await p.close();
  };

  // Launcher icons: the mark on the night-sky background (no small text: it would be unreadable).
  const iconHtml = (px) =>
    page(`<div class="bg">${stars(Math.round(px / 6))}<div class="center glow">${markSvg({ id: 'i', size: Math.round(px * 0.86) })}</div></div>`, px, px);
  for (const [dir, px] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
    await shot(iconHtml(px), px, px, path.join(ROOT, `android/res/mipmap-${dir}/ic_launcher.png`));
  }
  await shot(iconHtml(512), 512, 512, path.join(ROOT, 'public/logo.png'));

  // Full logo with the titles.
  const W = 1080;
  await shot(
    page(
      `<div class="bg">${stars(160)}<div class="center" style="gap:26px">
        <div class="glow">${markSvg({ id: 'f', size: 560 })}</div>
        <div class="fa" style="font-size:96px">گنجینه صدای من</div>
        ${amirAbcHtml(120)}
      </div></div>`,
      W,
      W,
    ),
    W,
    W,
    path.join(ROOT, 'docs/logo.png'),
  );
  await browser.close();
  console.log('logo written');
})();
