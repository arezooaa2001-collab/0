// End-to-end browser tests (Playwright + Chromium software GL).
// Usage: node tests/e2e.cjs [baseUrl]   (serve the racing/ folder first, e.g. python3 -m http.server 4180)
const { chromium, devices } = require('playwright');
const assert = require('node:assert/strict');

const BASE = process.argv[2] || 'http://localhost:4180/index.html';
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const KEY = 'shetab-racing-save-v1';
const OPEN = [];

async function openGame(browser, { tier = 0, save = {}, context = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, ...context });
  OPEN.push(ctx);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`${e.message}\n${e.stack}`));
  await page.addInitScript(([k, s]) => { if (!sessionStorage.getItem('init')) { localStorage.setItem(k, JSON.stringify(s)); sessionStorage.setItem('init', '1'); } }, [KEY, { ...save, settings: { graphics: tier, ...(save.settings || {}) } }]);
  await page.goto(BASE);
  await page.waitForFunction(() => document.body.dataset.screen === 'menu', null, { timeout: 90000 });
  return { ctx, page, errors };
}

async function startRace(page, stage) {
  await page.evaluate((s) => window.__shetab.startRace(s), stage);
  await page.waitForFunction(() => window.__shetabRace && window.__shetabRace.state !== 'loading', null, { timeout: 180000 });
}

async function main() {
  const browser = await chromium.launch({ args: GL_ARGS });
  const t0 = Date.now();
  let failures = 0;
  const open = [];
  const test = async (name, fn) => {
    if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
    const ts = Date.now();
    try {
      await fn(open);
      console.log(`✔ ${name} (${((Date.now() - ts) / 1000).toFixed(1)}s)`);
    } catch (e) {
      failures++;
      console.log(`✘ ${name}\n  ${e.stack || e}`);
    } finally {
      while (OPEN.length) await OPEN.pop().close().catch(() => {});
    }
  };

  await test('full race on autopilot pays the correct coin reward', async () => {
    const { ctx, page, errors } = await openGame(browser, { tier: 0 });
    await startRace(page, 0);
    const before = await page.evaluate(() => window.__shetab.profile.data.coins);
    await page.evaluate(() => { window.__shetabRace.setAutopilot(true); window.__shetab.fastForward(400); });
    await page.waitForFunction(() => !document.getElementById('modal-results').hidden, null, { timeout: 30000 });
    const r = await page.evaluate(() => {
      const res = window.__shetabRace.results;
      return { rank: res.rank, coins: res.reward.coins, points: res.reward.points, rows: res.rows.length, after: window.__shetab.profile.data.coins, unlocked: window.__shetab.profile.data.unlocked };
    });
    const expected = [100, 50, 10, 5, 2][r.rank - 1] ?? 0;
    console.log('   rank', r.rank, 'coins', r.coins);
    assert.ok(r.rank <= 10, `a good driver should be in the top half on stage 1 (got ${r.rank})`);
    assert.equal(r.coins, expected);
    assert.equal(r.after, before + expected);
    assert.equal(r.rows, 20);
    if (r.rank <= 3) assert.equal(r.unlocked, 2);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `${process.env.SHOTS || '/tmp'}/results.png` });
  });

  await test('garage: buy car, upgrade, paint and persistence', async () => {
    const { ctx, page, errors } = await openGame(browser, { tier: 1, save: { coins: 1000 } });
    await page.click('[data-go="garage"]');
    await page.click('[data-car="toofan"]');
    await page.click('#car-action'); // buy (200)
    let d = await page.evaluate(() => window.__shetab.profile.data);
    assert.ok(d.owned.includes('toofan'));
    assert.equal(d.coins, 800);
    await page.click('[data-gtab="upgrades"]');
    await page.click('[data-up="engine"]');
    d = await page.evaluate(() => window.__shetab.profile.data);
    assert.equal(d.upgrades.toofan.engine, 1);
    assert.ok(d.coins < 800);
    await page.click('[data-gtab="paint"]');
    await page.click('[data-paint="#18b38a"]');
    await page.click('[data-gtab="stats"]');
    await page.click('#car-action'); // select
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.screen === 'menu', null, { timeout: 90000 });
    d = await page.evaluate(() => window.__shetab.profile.data);
    assert.equal(d.selected, 'toofan');
    assert.equal(d.paint.toofan, '#18b38a');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `${process.env.SHOTS || '/tmp'}/garage.png` });
  });

  await test('every graphics preset (0..25) builds and renders a race without errors', async () => {
    const { page, errors } = await openGame(browser, { tier: 0, context: { viewport: { width: 240, height: 136 } } });
    await page.evaluate(() => { window.__shetab.renderPaused = true; });
    for (let tier = 0; tier < 26; tier++) {
      await page.evaluate((t) => { window.__shetab.profile.setSetting('graphics', t); window.__shetab.onSettingChanged('graphics'); }, tier);
      const stage = [0, 7, 12, 17, 22, 27][tier % 6];
      const t1 = Date.now();
      await startRace(page, stage);
      const build = Date.now() - t1;
      await page.evaluate(() => window.__shetab.fastForward(5));
      const info = await page.evaluate((heavy) => {
        const r = window.__shetabRace;
        if (heavy) {
          // Software GL (SwiftShader) cannot draw 8K shadow maps / huge probes in reasonable time;
          // their shaders were already compiled by the race build, so skip just that GPU work here.
          r.env.sun.castShadow = false;
          r.cubeCam = null;
        }
        const f = window.__shetab.debugRender(1);
        return { ...f, state: r.state, hz: r.tier.physicsHz, name: r.tier.nameEn };
      }, tier > 5);
      console.log(`   tier ${tier} ${info.name}: stage ${stage + 1} build ${build}ms ${info.state} calls=${info.calls} tris=${info.triangles} programs=${info.programs} physics=${info.hz}Hz`);
      assert.ok(['countdown', 'racing', 'intro'].includes(info.state));
      assert.ok(info.calls > 10, 'nothing rendered');
      if (tier === 4 || tier === 25) {
        const url = await page.evaluate(() => { window.__shetab.debugRender(1); return window.__shetab.gfx.renderer.domElement.toDataURL('image/png'); });
        require('fs').writeFileSync(`${process.env.SHOTS || '/tmp'}/tier${tier}.png`, Buffer.from(url.split(',')[1], 'base64'));
      }
    }
    assert.deepEqual(errors, []);
  });

  await test('mobile touch: pedals, slide steering, wheel and buttons drive the car', async () => {
    const { ctx, page, errors } = await openGame(browser, { tier: 0, context: { ...devices['Pixel 7 landscape'] } });
    await startRace(page, 0);
    await page.evaluate(() => { const r = window.__shetabRace; r.update(3); r.update(0.1); while (r.state !== 'racing') r.update(0.1); });
    const gas = await page.locator('.pedal.gas').boundingBox();
    const area = await page.locator('.steer-area').boundingBox();
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    const g = { x: gas.x + gas.width / 2, y: gas.y + gas.height * 0.3, id: 1 };
    const s0 = { x: area.x + area.width * 0.5, y: area.y + area.height * 0.6, id: 2 };
    await touch('touchStart', [g]);
    await touch('touchStart', [g, s0]);
    await touch('touchMove', [g, { ...s0, x: s0.x + 70 }]);
    await page.waitForTimeout(200);
    let c = await page.evaluate(() => { const r = window.__shetabRace; r.update(0.05); return { ...window.__shetab.input.out }; });
    assert.ok(c.throttle > 0.2, `throttle ${c.throttle}`);
    assert.ok(c.steer > 0.3, `steer right ${c.steer}`);
    await touch('touchMove', [g, { ...s0, x: s0.x - 90 }]);
    for (let i = 0; i < 6; i++) await page.evaluate(() => window.__shetabRace.update(0.05));
    c = await page.evaluate(() => ({ ...window.__shetab.input.out }));
    assert.ok(c.steer < -0.3, `steer left ${c.steer}`);
    await touch('touchEnd', []);
    // slide from gas to brake
    const brake = await page.locator('.pedal.brake').boundingBox();
    await touch('touchStart', [{ x: g.x, y: g.y, id: 3 }]);
    await touch('touchMove', [{ x: brake.x + brake.width / 2, y: brake.y + brake.height / 2, id: 3 }]);
    for (let i = 0; i < 4; i++) await page.evaluate(() => window.__shetabRace.update(0.05));
    c = await page.evaluate(() => ({ ...window.__shetab.input.out }));
    assert.ok(c.brake > 0.3 && c.throttle < 0.5, `slid to brake ${JSON.stringify(c)}`);
    await touch('touchEnd', []);
    // virtual wheel mode
    await page.evaluate(() => { window.__shetab.profile.setSetting('controlMode', 'wheel'); window.__shetab.onSettingChanged('controlMode'); });
    const wheel = await page.locator('.steer-wheel').boundingBox();
    const cx = wheel.x + wheel.width / 2, cy = wheel.y + wheel.height / 2;
    await touch('touchStart', [{ x: cx, y: cy - wheel.height * 0.4, id: 4 }]);
    await touch('touchMove', [{ x: cx + wheel.width * 0.4, y: cy, id: 4 }]);
    for (let i = 0; i < 6; i++) await page.evaluate(() => window.__shetabRace.update(0.05));
    c = await page.evaluate(() => ({ ...window.__shetab.input.out }));
    assert.ok(c.steer > 0.3, `wheel steer ${c.steer}`);
    await touch('touchEnd', []);
    // buttons mode
    await page.evaluate(() => { window.__shetab.profile.setSetting('controlMode', 'buttons'); window.__shetab.onSettingChanged('controlMode'); });
    const left = await page.locator('.tbtn[data-act="left"]').boundingBox();
    await touch('touchStart', [{ x: left.x + 20, y: left.y + 20, id: 5 }]);
    for (let i = 0; i < 10; i++) await page.evaluate(() => window.__shetabRace.update(0.05));
    c = await page.evaluate(() => ({ ...window.__shetab.input.out }));
    assert.ok(c.steer < -0.3, `button steer ${c.steer}`);
    await touch('touchEnd', []);
    await page.screenshot({ path: `${process.env.SHOTS || '/tmp'}/mobile.png` });
    assert.deepEqual(errors, []);
  });

  await test('pause, settings from pause, quit to menu', async () => {
    const { ctx, page, errors } = await openGame(browser, { tier: 0 });
    await startRace(page, 3);
    await page.evaluate(() => window.__shetab.togglePause());
    assert.equal(await page.isVisible('#modal-pause'), true);
    await page.click('[data-pause="settings"]');
    await page.click('[data-stab="controls"]');
    await page.click('[data-back]');
    assert.equal(await page.isVisible('#modal-pause'), true);
    await page.click('[data-pause="quit"]');
    await page.waitForFunction(() => document.body.dataset.screen === 'menu');
    assert.equal(await page.evaluate(() => window.__shetabRace), null);
    assert.deepEqual(errors, []);
  });

  await browser.close();
  console.log(`\n${failures ? `${failures} test(s) FAILED` : 'ALL E2E TESTS PASSED'} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
