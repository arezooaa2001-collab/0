// Test harness: boots the game in headless Chromium and steps frames by hand.
//   const { browser, page, ev, st, shot } = await boot(800, 450);
//   await ev(() => step(60));        // 60 frames of 1/60 s
//   await ev(() => step(600, () => game.rides.state === 'idle'));  // until cond
import pw from '/opt/node-tools/node_modules/playwright/index.js';
import fs from 'fs';
const { chromium } = pw;
const SHOTS = new URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(SHOTS, { recursive: true });

export async function boot(w = 800, h = 450, opts = {}) {
  const port = process.env.PORT || 8765;
  const url = opts.url || process.env.URL || `http://localhost:${port}/index.html`;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const st = { errors: 0, logs: [] };
  page.on('pageerror', (e) => {
    st.errors++;
    console.log('PAGEERROR', e.message, (e.stack || '').slice(0, 600));
  });
  page.on('console', (m) => {
    if (m.type() === 'error') {
      st.logs.push(m.text());
      if (process.env.VERBOSE) console.log('console.error', m.text());
    }
  });
  // the web font is optional and its request can hang here; screenshots wait for fonts
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const quality = process.env.QUALITY || 'low';
  await page.addInitScript((q) => {
    try {
      if (!localStorage.getItem('taxiCity.settings.v1')) localStorage.setItem('taxiCity.settings.v1', JSON.stringify({ quality: q }));
    } catch (e) {}
  }, quality);
  await page.goto(url);
  await page.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 240000 });
  if (!opts.menu) await page.click('#menuStart');
  await page.evaluate(() => {
    const g = window.game;
    g.renderer.setAnimationLoop(null);
    g.clock.getDelta = () => window.__dt || 1 / 60;
    // only the last frame of a step is drawn: the emulated GPU would otherwise have to
    // rasterise every simulated frame afterwards (minutes for a few hundred frames)
    const post = g.post, realRender = post.render;
    window.step = (n = 1, cond) => {
      if (window.__drawAll) {
        for (let i = 0; i < n; i++) {
          g.frame();
          if (cond && cond()) return i + 1;
        }
        return n;
      }
      post.render = () => {};
      try {
        for (let i = 0; i < n; i++) {
          if (i === n - 1) post.render = realRender;
          g.frame();
          if (cond && cond()) {
            if (post.render !== realRender) realRender.call(post, g.state === 'jail' ? g.police.jail.scene : g.scene, g.state === 'jail' ? g.police.jail.camera : g.camera);
            return i + 1;
          }
        }
      } finally {
        post.render = realRender;
      }
      return n;
    };
  });
  const ev = (f, a) => page.evaluate(f, a);
  const shot = async (name) => {
    await page.evaluate(() => window.step(1));
    await page.screenshot({ path: SHOTS + name + '.png' });
  };
  return { browser, page, ev, st, shot };
}
