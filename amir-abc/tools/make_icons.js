// Render the Android launcher icons (adaptive layers + legacy PNGs) with Chromium.
// Usage: node tools/make_icons.js     (run from the amir-abc folder)
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const RES = path.join(ROOT, "android/app/src/main/res");
const font = (f) => "data:font/woff2;base64," + fs.readFileSync(path.join(ROOT, "assets/fonts", f)).toString("base64");

const css = `
@font-face { font-family: "Russo One"; src: url("${font("russo-one-latin.woff2")}") format("woff2"); }
html, body { margin: 0; width: 100%; height: 100%; background: transparent; }
.bg { position: absolute; inset: 0;
  background: radial-gradient(90% 80% at 50% 0%, #26307a 0%, transparent 70%),
              radial-gradient(80% 60% at 50% 115%, #2a1660 0%, transparent 70%), #0b0e2b; }
.mark { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
  justify-content: center; font-family: "Russo One", sans-serif; line-height: 1; }
.amir { color: #fff; letter-spacing: .14em; padding-left: .14em;
  text-shadow: 0 0 .25em rgba(255,200,61,.95), 0 0 .7em rgba(255,200,61,.5); }
.abc { color: #5ec1f5; -webkit-text-stroke: .1em #2f67f0; paint-order: stroke fill;
  text-shadow: 0 0 .14em rgba(47,103,240,.85), 0 0 .5em rgba(47,103,240,.45); letter-spacing: .02em; }
canvas { position: absolute; inset: 0; }
`;

function page({ size, bg, mark, scale, shape }) {
  const radius = shape === "round" ? "50%" : shape === "squircle" ? "22%" : "0";
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}
    .frame { position: absolute; inset: 0; border-radius: ${radius}; overflow: hidden; }
  </style></head><body style="width:${size}px;height:${size}px">
  <div class="frame">
    ${bg ? '<div class="bg"></div><canvas id="c" width="' + size + '" height="' + size + '"></canvas>' : ""}
    ${mark ? `<div class="mark" style="gap:${0.035 * size * scale}px">
      <span class="amir" style="font-size:${0.095 * size * scale}px">AMIR</span>
      <span class="abc" style="font-size:${0.23 * size * scale}px">ABC</span></div>` : ""}
  </div>
  <script>
    const c = document.getElementById("c");
    if (c) { const x = c.getContext("2d"); let s = 7;
      const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 46; i++) { x.globalAlpha = r() * .6 + .2; x.fillStyle = "#e8ecff";
        x.beginPath(); x.arc(r() * ${size}, Math.pow(r(), 1.3) * ${size}, (r() * 1.2 + .4) * ${size} / 432, 0, 7); x.fill(); } }
  </script></body></html>`;
}

async function shot(browser, opts, out) {
  const p = await browser.newPage({ viewport: { width: opts.size, height: opts.size }, deviceScaleFactor: 1 });
  await p.setContent(page(opts), { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await p.screenshot({ path: out, omitBackground: true });
  await p.close();
}

(async () => {
  const browser = await chromium.launch();
  // adaptive icon layers: 108dp at xxxhdpi = 432px; the mark stays inside the 66dp safe zone
  await shot(browser, { size: 432, bg: true, mark: false }, path.join(RES, "drawable-xxxhdpi/ic_launcher_background.png"));
  await shot(browser, { size: 432, bg: false, mark: true, scale: 1 }, path.join(RES, "drawable-xxxhdpi/ic_launcher_foreground.png"));
  // legacy icons for Android 7.x
  const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, s] of Object.entries(sizes)) {
    await shot(browser, { size: s, bg: true, mark: true, scale: 1.45, shape: "squircle" }, path.join(RES, `mipmap-${d}/ic_launcher.png`));
    await shot(browser, { size: s, bg: true, mark: true, scale: 1.35, shape: "round" }, path.join(RES, `mipmap-${d}/ic_launcher_round.png`));
  }
  // a preview of how a launcher masks the adaptive icon
  await shot(browser, { size: 432, bg: true, mark: true, scale: 1, shape: "squircle" }, path.join(ROOT, "android/build/icon-preview.png"));
  await browser.close();
  console.log("icons written");
})();
