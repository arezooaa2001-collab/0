/* ============================ TEXTURES ============================ */
const TEX = {};
function mkC(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
function srand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function patScale(p) { try { p.setTransform(new DOMMatrix().scaleSelf(0.5, 0.5)); } catch (e) {} return p; }
function buildTextures(ctx) {
  const R = srand(7);
  const [bh0, bs0, bl0] = hexHsl(PAL.block);
  // stone bricks: 160px texture = 80x80 world
  { const c = mkC(160, 160), g = c.getContext('2d');
    g.fillStyle = hslHex(bh0, bs0 * .6, bl0 * .45); g.fillRect(0, 0, 160, 160);
    const bh = 40;
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 40 : 0;
      for (let col = -1; col < 3; col++) {
        const x = col * 80 + off, y = row * bh;
        g.fillStyle = hslHex(bh0 - 7 + R() * 14, clamp(bs0 * .75 + R() * .08, 0, 1), clamp(bl0 * .7 + R() * .09, 0, 1));
        g.beginPath(); g.roundRect ? g.roundRect(x + 3, y + 3, 74, bh - 6, 6) : g.rect(x + 3, y + 3, 74, bh - 6); g.fill();
        g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x + 6, y + 4, 68, 3);
        g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + 6, y + bh - 8, 68, 4);
        for (let k = 0; k < 14; k++) { g.fillStyle = R() < .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.14)'; g.fillRect(x + 6 + R() * 66, y + 6 + R() * (bh - 14), 2 + R() * 3, 2 + R() * 2); }
        if (R() < .3) { g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.5; g.beginPath(); let px = x + 20 + R() * 40, py = y + 6; g.moveTo(px, py); for (let k = 0; k < 3; k++) { px += R() * 12 - 6; py += 8; g.lineTo(px, py); } g.stroke(); }
      }
    }
    TEX.stone = patScale(ctx.createPattern(c, 'repeat'));
  }
  // glowing top edge (moss / ice), 160x40 texture = 80x20 world
  const topTex = (base, deco) => {
    const c = mkC(160, 40), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 10, 0, 40); gr.addColorStop(0, rgbaHex(base, .55)); gr.addColorStop(1, rgbaHex(base, 0));
    g.fillStyle = gr; g.fillRect(0, 12, 160, 28);
    g.fillStyle = base; g.fillRect(0, 12, 160, 7);
    g.fillStyle = mixHex(base, '#ffffff', .6); g.fillRect(0, 12, 160, 2.5);
    for (let i = 0; i < 26; i++) { const x = R() * 160, h = 4 + R() * 9; g.fillStyle = R() < .5 ? mixHex(base, '#ffffff', .25) : base; g.beginPath(); g.moveTo(x - 3, 14); g.lineTo(x + R() * 4 - 2, 14 - h); g.lineTo(x + 3, 14); g.fill(); }
    if (deco) for (let i = 0; i < 6; i++) { const x = R() * 160; g.fillStyle = R() < .5 ? '#ffd36e' : '#ff8fb8'; g.beginPath(); g.arc(x, 9 + R() * 3, 2.2, 0, 7); g.fill(); }
    return patScale(ctx.createPattern(c, 'repeat-x'));
  };
  TEX.moss = topTex(PAL.moss, true);
  TEX.ice = topTex('#bdf2ff', false);
  // conveyor chevrons
  { const c = mkC(80, 24), g = c.getContext('2d'); g.fillStyle = '#2a2236'; g.fillRect(0, 0, 80, 24); g.fillStyle = '#ffb347';
    for (let x = -20; x < 100; x += 40) { g.beginPath(); g.moveTo(x, 2); g.lineTo(x + 14, 2); g.lineTo(x + 26, 12); g.lineTo(x + 14, 22); g.lineTo(x, 22); g.lineTo(x + 12, 12); g.fill(); }
    TEX.convC = c; }
  // spike sprites (4 directions + darker back copies for 2.5D), 80x80 tex
  { const hz = PAL.hazard, base = mkC(80, 80), g = base.getContext('2d');
    g.beginPath(); g.moveTo(8, 80); g.lineTo(40, 6); g.lineTo(40, 80); g.closePath();
    let gr = g.createLinearGradient(8, 0, 40, 0); gr.addColorStop(0, mixHex(hz, '#000000', .3)); gr.addColorStop(1, mixHex(hz, '#ffffff', .75)); g.fillStyle = gr; g.fill();
    g.beginPath(); g.moveTo(40, 6); g.lineTo(72, 80); g.lineTo(40, 80); g.closePath();
    gr = g.createLinearGradient(40, 0, 72, 0); gr.addColorStop(0, mixHex(hz, '#000000', .15)); gr.addColorStop(1, mixHex(hz, '#000000', .6)); g.fillStyle = gr; g.fill();
    g.beginPath(); g.moveTo(40, 6); g.lineTo(31, 27); g.lineTo(49, 27); g.closePath(); g.fillStyle = '#ff5d8a'; g.fill();
    g.strokeStyle = 'rgba(20,10,40,.6)'; g.lineWidth = 2.5; g.lineJoin = 'round'; g.beginPath(); g.moveTo(8, 79); g.lineTo(40, 6); g.lineTo(72, 79); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(38, 15, 2, 0, 7); g.fill();
    const rot = (src, ang) => { const c = mkC(80, 80), q = c.getContext('2d'); q.translate(40, 40); q.rotate(ang); q.drawImage(src, -40, -40); return c; };
    const dark = src => { const c = mkC(80, 80), q = c.getContext('2d'); q.drawImage(src, 0, 0); q.globalCompositeOperation = 'source-atop'; q.fillStyle = 'rgba(8,4,20,.62)'; q.fillRect(0, 0, 80, 80); return c; };
    TEX.spike = { up: base, right: rot(base, Math.PI / 2), down: rot(base, Math.PI), left: rot(base, -Math.PI / 2) };
    TEX.spikeDark = { up: dark(TEX.spike.up), right: dark(TEX.spike.right), down: dark(TEX.spike.down), left: dark(TEX.spike.left) };
  }
  // saw (+ dark copy)
  { const sc = PAL.saw, SZ = 200, c = mkC(SZ, SZ), g = c.getContext('2d'), r = 80; g.translate(SZ / 2, SZ / 2);
    g.beginPath(); const n = 16;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, a2 = (i + .5) / n * Math.PI * 2; g.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); g.lineTo(Math.cos(a2 - 0.08) * r * 1.12, Math.sin(a2 - 0.08) * r * 1.12); }
    g.closePath(); let gr = g.createRadialGradient(-20, -20, 10, 0, 0, r * 1.1); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.5, sc); gr.addColorStop(1, mixHex(sc, '#000000', .55));
    g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(20,10,40,.6)'; g.lineWidth = 3; g.stroke();
    g.beginPath(); g.arc(0, 0, r * .55, 0, 7); g.fillStyle = mixHex(sc, '#000000', .3); g.fill();
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * r * .33, Math.sin(a) * r * .33, r * .1, 0, 7); g.fillStyle = '#2d2a48'; g.fill(); }
    g.beginPath(); g.arc(0, 0, r * .16, 0, 7); g.fillStyle = '#ff5d8a'; g.fill(); g.beginPath(); g.arc(-3, -3, r * .06, 0, 7); g.fillStyle = '#fff'; g.fill();
    TEX.saw = c;
    const d = mkC(SZ, SZ), q = d.getContext('2d'); q.drawImage(c, 0, 0); q.globalCompositeOperation = 'source-atop'; q.fillStyle = 'rgba(8,4,20,.6)'; q.fillRect(0, 0, SZ, SZ); TEX.sawDark = d;
  }
  // soft glow sprite + tinted copies
  { const c = mkC(128, 128), g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); TEX.glow = c; }
  const tint = (col) => { const c = mkC(128, 128), g = c.getContext('2d'); g.drawImage(TEX.glow, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, 128, 128); return c; };
  TEX.gGold = tint('#ffc766'); TEX.gMint = tint(PAL.moss); TEX.gRose = tint('#ff5d8a'); TEX.gViolet = tint('#b18cff'); TEX.gWarm = tint(mixHex(PAL.bodyTop, '#ffe2b0', .5)); TEX.gDoor = tint(PAL.door); TEX.gCyan = tint('#6ff3ff');
  // 2.5D face colours
  const [mh, ms, ml] = hexHsl(PAL.moss);
  PAL.f25top = mixHex(hslHex(mh, ms * .7, Math.min(.5, ml * .7)), PAL.block, .45);
  PAL.f25side = hslHex(bh0, bs0 * .6, bl0 * .55); PAL.f25bot = hslHex(bh0, bs0 * .6, bl0 * .32); PAL.f25edge = rgbaHex(PAL.moss, .55);
}

/* ============================ RENDERER ============================ */
const cv = document.getElementById('c');
let ctx = cv.getContext('2d', { alpha: false });
let cw = 0, ch = 0, dpr = 1, S = 1, OX = 0, OY = 0, EXT = { l: 0, r: 0, t: 0, b: 0 };
let CAMX = 0, LW = W; // camera left edge and level width (world px) of the level being drawn
const BG = {};
const motes = Array.from({ length: 200 }, () => ({ x: rand(-200, W + 200), y: rand(0, H), s: rand(1, 3), sp: rand(6, 22), ph: rand(0, 7), c: Math.random() < .6 ? 'gMint' : 'gGold' }));
const glowK = () => GFX.glow * (CFG.glow / 100) * (Perf.fxDrop ? .6 : 1);

function resize() {
  dpr = targetPR(2);
  cw = Math.round(innerWidth * dpr); ch = Math.round(innerHeight * dpr);
  if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
  S = Math.min(cw / W, ch / H); OX = (cw - W * S) / 2; OY = (ch - H * S) / 2;
  EXT = { l: OX / S + 4, r: OX / S + 4, t: OY / S + 4, b: OY / S + 4 };
  ctx.imageSmoothingEnabled = true;
  buildBackground();
  layoutTouch();
}
function layoutTouch() {
  // fit touch buttons inside the floor strip so they never hide the player or the door
  const cssH = innerHeight, sc = Math.min(innerWidth / W, innerHeight / H), floorTop = ((innerHeight - H * sc) / 2 + 15 * T * sc), band = cssH - floorTop;
  const k = (CFG.tsize || 100) / 100;
  const bs = clamp(Math.round((band - 10) * k), 46, 120), js = clamp(Math.round((band + 6) * k), 54, 140);
  const st = tLayer.style;
  st.setProperty('--bs', bs + 'px'); st.setProperty('--js', js + 'px');
  st.setProperty('--bb', Math.max(4, Math.round((band - bs) / 2)) + 'px'); st.setProperty('--jb', Math.max(3, Math.round((band - js) / 2)) + 'px');
  st.setProperty('--top', (CFG.topac / 100).toFixed(2));
  checkRotate();
}
function buildBackground() {
  const R = srand(11), sk = PAL.skyCol;
  STT.tiles.clear();
  // sky
  const sky = mkC(cw, ch), g = sky.getContext('2d');
  let gr = g.createLinearGradient(0, 0, 0, ch);
  [['#07061c', 0], ['#191247', .38], ['#46205f', .7], ['#7c2e5f', .9], ['#a0405b', 1]].forEach(([c, o]) => gr.addColorStop(o, sk(c)));
  g.fillStyle = gr; g.fillRect(0, 0, cw, ch);
  const stars = GFXK === 'go' ? 110 : 260;
  for (let i = 0; i < stars; i++) { const x = R() * cw, y = R() * ch * .65, r = (R() * 1.2 + .3) * dpr; g.globalAlpha = R() * .8 + .2; g.fillStyle = R() < .15 ? '#ffd9a8' : '#fff'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  const mx = OX + W * S * .78, my = OY + H * S * .2, mr = 46 * S;
  gr = g.createRadialGradient(mx, my, mr * .5, mx, my, mr * 5); gr.addColorStop(0, 'rgba(255,200,170,.35)'); gr.addColorStop(1, 'rgba(255,200,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, cw, ch);
  gr = g.createRadialGradient(mx - mr * .3, my - mr * .3, mr * .1, mx, my, mr); gr.addColorStop(0, '#fff6e6'); gr.addColorStop(1, '#ffc9a0');
  g.fillStyle = gr; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill();
  g.fillStyle = 'rgba(200,120,110,.25)'; [[.3, -.2, .18], [-.35, .25, .12], [.1, .4, .1]].forEach(([a, b, r]) => { g.beginPath(); g.arc(mx + a * mr, my + b * mr, r * mr, 0, 7); g.fill(); });
  // mountain ranges: seamless strips that wrap around, so they can scroll forever with the camera (parallax)
  const P = Math.ceil(cw + 240 * dpr);
  const layer = (col, base, amp, rough, seed, fog) => {
    const c = mkC(P, ch), q = c.getContext('2d'), r = srand(seed), n = Math.ceil(P / (18 * dpr)), ys = [];
    let y = base;
    for (let i = 0; i <= n; i++) { y += (r() - .5) * rough * dpr; y = clamp(y, base - amp, base + amp * .4); ys.push(y); }
    const d = ys[n] - ys[0]; for (let i = 0; i <= n; i++) ys[i] -= d * i / n;
    q.fillStyle = sk(col); q.beginPath(); q.moveTo(0, ch);
    for (let i = 0; i <= n; i++) q.lineTo(i * P / n, OY + ys[i] * S);
    q.lineTo(P, ch); q.closePath(); q.fill();
    if (fog) { const fg = q.createLinearGradient(0, OY + (base - amp) * S, 0, ch); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, fog); q.globalCompositeOperation = 'source-atop'; q.fillStyle = fg; q.fillRect(0, 0, c.width, ch); }
    return c;
  };
  const far = layer('#33205a', 420, 170, 60, 3, rgbaHex(sk('#a04678'), .55));
  const mid = layer('#211541', 520, 120, 46, 5, rgbaHex(sk('#6e285a'), .5));
  const near = layer('#140d2c', 610, 70, 34, 9, rgbaHex(sk('#280f32'), .6));
  // one opaque back picture (sky + far range) and two thin strips cropped to where the nearer ranges are
  const back = mkC(cw, ch), bg2 = back.getContext('2d', { alpha: false }); bg2.drawImage(sky, 0, 0); bg2.drawImage(far, -120 * dpr, 0);
  const strip = (src, top) => { const y0 = Math.max(0, Math.floor(OY + top * S)), c = mkC(src.width, ch - y0); c.getContext('2d').drawImage(src, 0, -y0); c.y0 = y0; return c; };
  BG.far = back; BG.mid = strip(mid, 520 - 125); BG.near = strip(near, 610 - 75);
  // hidden realm: neon void with a perspective grid
  { const rc = BG.realm = mkC(cw, ch), q = rc.getContext('2d', { alpha: false }), r2 = srand(23);
    const gg = q.createLinearGradient(0, 0, 0, ch); gg.addColorStop(0, '#03010c'); gg.addColorStop(.55, '#170636'); gg.addColorStop(1, '#3a0a52'); q.fillStyle = gg; q.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 180; i++) { q.globalAlpha = r2() * .8 + .2; q.fillStyle = r2() < .5 ? '#7af7ff' : '#ff7af0'; q.fillRect(r2() * cw, r2() * ch * .6, dpr * 1.3, dpr * 1.3); }
    q.globalAlpha = 1; const hy = OY + H * S * .58, vx = cw / 2;
    const sun = q.createRadialGradient(vx, hy, 0, vx, hy, 260 * S); sun.addColorStop(0, 'rgba(255,60,200,.55)'); sun.addColorStop(1, 'rgba(255,60,200,0)'); q.fillStyle = sun; q.fillRect(0, 0, cw, ch);
    q.strokeStyle = 'rgba(0,255,230,.35)'; q.lineWidth = 1.5 * dpr;
    for (let i = -16; i <= 16; i++) { q.beginPath(); q.moveTo(vx + i * 12 * S, hy); q.lineTo(vx + i * 160 * S, ch); q.stroke(); }
    for (let k = 1; k < 14; k++) { const yy = hy + (ch - hy) * Math.pow(k / 13, 2.2); q.globalAlpha = .25 + k / 20; q.beginPath(); q.moveTo(0, yy); q.lineTo(cw, yy); q.stroke(); }
    q.globalAlpha = 1; }
  BG.dark = mkC(Math.ceil(cw / 4), Math.ceil(ch / 4)); BG.darkG = BG.dark.getContext('2d');
  // high tiers: a drifting mist band (wraps around) and moonlight rays
  { const P2 = Math.ceil(cw * 1.4), hh = Math.ceil(260 * S), c = mkC(P2, hh), q = c.getContext('2d'), r = srand(31);
    for (let i = 0; i < 26; i++) { const x = r() * P2, y = hh * (.3 + r() * .5), rad = (60 + r() * 140) * S;
      for (const ox of [x, x - P2, x + P2]) { const gm = q.createRadialGradient(ox, y, 0, ox, y, rad); gm.addColorStop(0, rgbaHex(sk('#d9c8ff'), .10 + r() * .05)); gm.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = gm; q.fillRect(ox - rad, y - rad, rad * 2, rad * 2); } }
    c.y0 = Math.floor(OY + 400 * S); BG.mist = c; }
  { const c = mkC(cw, ch), q = c.getContext('2d'), mx = OX + W * S * .78, my = OY + H * S * .2;
    q.translate(mx, my); for (let i = 0; i < 9; i++) { const a = 1.75 + (i - 4) * .16 + (i % 2) * .05, len = (900 + (i % 3) * 200) * S, wd = .05 + (i % 3) * .02;
      const gr2 = q.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len); gr2.addColorStop(0, 'rgba(255,225,190,.16)'); gr2.addColorStop(1, 'rgba(255,225,190,0)');
      q.fillStyle = gr2; q.beginPath(); q.moveTo(0, 0); q.lineTo(Math.cos(a - wd) * len, Math.sin(a - wd) * len); q.lineTo(Math.cos(a + wd) * len, Math.sin(a + wd) * len); q.closePath(); q.fill(); }
    BG.rays = c; }
}
const METEORS = [];
function drawSkyExtras(dx, dy) {
  const tt = performance.now() / 1000;
  if (gtier(2) && BG.rays) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .6 + Math.sin(tt * .6) * .2; ctx.drawImage(BG.rays, dx, dy); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  if (gtier(8)) {
    if (METEORS.length < 2 && Math.random() < .006) METEORS.push({ x: cw * (.2 + Math.random() * .7), y: ch * Math.random() * .25, vx: -(500 + Math.random() * 400) * dpr, vy: (180 + Math.random() * 160) * dpr, life: 1, t0: tt });
    ctx.globalCompositeOperation = 'lighter';
    for (let i = METEORS.length - 1; i >= 0; i--) {
      const m = METEORS[i], age = tt - m.t0; if (age > .9) { METEORS.splice(i, 1); continue; }
      const x = m.x + m.vx * age, y = m.y + m.vy * age, a = 1 - age / .9, tail = .12;
      const g2 = ctx.createLinearGradient(x, y, x - m.vx * tail, y - m.vy * tail); g2.addColorStop(0, `rgba(255,245,220,${a})`); g2.addColorStop(1, 'rgba(255,245,220,0)');
      ctx.strokeStyle = g2; ctx.lineWidth = 2.2 * dpr; ctx.beginPath(); ctx.moveTo(x + dx, y + dy); ctx.lineTo(x - m.vx * tail + dx, y - m.vy * tail + dy); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (gtier(1) && BG.mist) { const P = BG.mist.width, o = ((CAMX * S * .3 + tt * 14 * dpr) % P + P) % P; ctx.globalAlpha = .7; ctx.drawImage(BG.mist, dx - o, BG.mist.y0 + dy); if (P - o < cw) ctx.drawImage(BG.mist, dx - o + P, BG.mist.y0 + dy); ctx.globalAlpha = 1; }
}
// sky + scrolling mountain strips; scroll = extra horizontal shift in device px (2.5D vanishing point)
function drawBack(world, sx, sy, scroll = 0) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dx = Math.round(sx * S), dy = Math.round(sy * S);
  if (dx || dy) { ctx.fillStyle = '#07061c'; ctx.fillRect(0, 0, cw, ch); }
  if (realmMode) { ctx.drawImage(BG.realm, dx - scroll * .04 - 4 * dpr, dy, cw + 8 * dpr, ch); return; }
  ctx.drawImage(BG.far, dx, dy);
  const strip = (c, k) => { const P = c.width, o = ((CAMX * S * k + scroll * k) % P + P) % P; ctx.drawImage(c, dx - o, c.y0 + dy); if (P - o < cw) ctx.drawImage(c, dx - o + P, c.y0 + dy); };
  strip(BG.mid, .1);
  if (GFX.tier) drawSkyExtras(dx, dy);
  strip(BG.near, .2);
}

/* Static layer cache: blocks/spikes that are not moving are drawn once into tiles 640 world px wide. Only the
   tiles on screen are drawn each frame; a tile is redrawn only when it scrolls into view or its statics change. */
const STT = { tiles: new Map(), tw: 640, renders: 0 };
let levelUid = 0;
function isStaticEnt(e) {
  if (e.gone || e.hidden || e.par || e.falling || e.moves.length || e.patrol || e.conv || e.orbit || e.pend || e.blink || e.sinking) return false;
  if (e.type === 'block') return e.appear >= 1 && !e.shake;
  if (e.type === 'spike') return e.pop >= 1;
  return false;
}
function statKey(world, a, b) {
  let h = world.lv.uid * 7919 + (hints ? 3 : 0) + PAL.ver * 104729 + (realmMode ? 5 : 0);
  const ents = world.lv.ents;
  for (let i = 0; i < ents.length; i++) { const e = ents[i]; if (e.x > b || e.x + e.w < a || !isStaticEnt(e)) continue; h = (Math.imul(h, 31) + i * 97 + (e.y | 0)) | 0; }
  return h;
}
function getTile(world, ti) {
  const tw = STT.tw, a = ti * tw, b = a + tw, key = statKey(world, a - 60, b + 60), wpx = Math.ceil(tw * S) + 2;
  let tl = STT.tiles.get(ti);
  if (tl && tl.key === key && tl.c.width === wpx && tl.c.height === ch) return tl;
  if (!tl || tl.c.width !== wpx || tl.c.height !== ch) { tl = { c: mkC(wpx, ch) }; tl.g = tl.c.getContext('2d'); STT.tiles.set(ti, tl); }
  STT.renders++;
  const g = tl.g; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, wpx, ch);
  let y0 = H, y1 = 0;
  const main = ctx; ctx = g; ctx.setTransform(S, 0, 0, S, -a * S, OY);
  for (const e of world.lv.ents) if (e.type === 'spike' && e.x < b + 60 && e.x + e.w > a - 60 && isStaticEnt(e)) { drawSpike(e); y0 = Math.min(y0, e.y); y1 = Math.max(y1, e.y + e.h); }
  for (const e of world.lv.ents) if (e.type === 'block' && e.x < b + 60 && e.x + e.w > a - 60 && isStaticEnt(e)) { drawBlock(e, 0); const [, by, , bh] = blockRect(e); y0 = Math.min(y0, by - 12); y1 = Math.max(y1, by + bh); }
  ctx = main;
  tl.key = key; tl.y0 = clamp(Math.floor(OY + y0 * S) - 2, 0, ch); tl.y1 = clamp(Math.ceil(OY + y1 * S) + 2, 0, ch);
  return tl;
}
function drawCaves(world, sx, sy, t) {
  if (!world) return;
  for (const e of world.lv.ents) {
    if (e.type !== 'zone' || e.kind !== 'cave' || e.x > CAMX + W + EXT.r || e.x + e.w < CAMX - EXT.l) continue;
    worldTransform(sx, sy);
    const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#120a14'); gr.addColorStop(.6, '#22141f'); gr.addColorStop(1, '#2c1a22');
    ctx.fillStyle = gr; ctx.fillRect(e.x, 0, e.w, H + EXT.b);
    ctx.globalAlpha = .18; ctx.fillStyle = TEX.stone; ctx.fillRect(e.x, 0, e.w, H + EXT.b); ctx.globalAlpha = 1;
    // fading cave mouth on both ends
    for (const [x0, d] of [[e.x, 1], [e.x + e.w, -1]]) { const g2 = ctx.createLinearGradient(x0, 0, x0 + d * 70, 0); g2.addColorStop(0, 'rgba(0,0,0,.45)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g2; ctx.fillRect(d > 0 ? x0 : x0 - 70, 0, 70, H + EXT.b); }
    // torches on the wall
    for (let x = e.x + 150; x < e.x + e.w - 60; x += 320) {
      ctx.fillStyle = '#3a2618'; ctx.fillRect(x - 3, 330, 6, 26);
      const f = 1 + Math.sin(t * 13 + x) * .12 + Math.sin(t * 29 + x) * .06;
      if (glowK() > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .7; ctx.drawImage(TEX.gGold, x - 60 * f, 270 - 60 * f, 120 * f, 120 * f); ctx.restore(); }
      ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.ellipse(x, 322, 5 * f, 10 * f, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fff1b0'; ctx.beginPath(); ctx.ellipse(x, 325, 2.5, 5, 0, 0, 7); ctx.fill();
    }
  }
}
function drawStatics(world, sx, sy) {
  if (!world) return;
  const tw = STT.tw, x0 = CAMX - OX / S, x1 = x0 + cw / S, t0 = Math.floor(x0 / tw), t1 = Math.floor(x1 / tw);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let ti = t0; ti <= t1; ti++) {
    const tl = getTile(world, ti), h = tl.y1 - tl.y0; if (h <= 0) continue;
    ctx.drawImage(tl.c, 0, tl.y0, tl.c.width, h, Math.round(OX + (ti * tw - CAMX + sx) * S), tl.y0 + Math.round(sy * S), tl.c.width, h);
  }
  // pre-draw the next tile in the running direction while nothing else is being drawn into a tile this frame
  const ahead = world.p.face >= 0 ? t1 + 1 : t0 - 1;
  if (ahead >= 0 && ahead * tw < (world.lw || W) && !STT.tiles.has(ahead)) getTile(world, ahead);
  if (STT.tiles.size > 8) for (const k of [...STT.tiles.keys()]) if (k < t0 - 2 || k > t1 + 2) STT.tiles.delete(k);
}

function worldTransform(sx, sy) { ctx.setTransform(S, 0, 0, S, OX + (sx - CAMX) * S, OY + sy * S); }

let hints = false, realmMode = false;
function drawHint(e) {
  ctx.save(); ctx.globalAlpha = 0.28 + Math.sin(performance.now() / 300) * 0.08;
  if (e.type === 'spike') { const k = e.pop; e.pop = 1; drawSpike(e); e.pop = k; }
  else { ctx.setLineDash([6, 6]); ctx.strokeStyle = PAL.moss; ctx.lineWidth = 2; ctx.strokeRect(e.x + 2, e.y + 2, e.w - 4, e.h - 4); }
  ctx.restore();
}
function blockRect(e) {
  let x = e.x, y = e.y, w = e.w, h = e.h;
  if (e.x <= 0.5) { x = -EXT.l; w = e.x + e.w + EXT.l; }
  if (e.x + e.w >= LW - 0.5) w = LW + EXT.r - x;
  if (e.y + e.h >= H - 0.5 && !e.falling) h = H + EXT.b - y;
  if (e.y <= 0.5 && !e.falling) { h = e.y + e.h + EXT.t; y = -EXT.t; }
  return [x, y, w, h];
}
function drawLava(e, t) {
  const y = e.y; if (y > H + EXT.b) return;
  const x = Math.max(e.x <= .5 ? -EXT.l : e.x, CAMX - EXT.l - 30), x1 = Math.min(e.x + e.w >= LW - .5 ? LW + EXT.r : e.x + e.w, CAMX + W + EXT.r + 30), w = x1 - x;
  if (w <= 0) return;
  ctx.save();
  const gr = ctx.createLinearGradient(0, y, 0, y + 260);
  if (e.acid) { gr.addColorStop(0, '#e8ff8a'); gr.addColorStop(.06, '#7cff3a'); gr.addColorStop(.45, '#1e9a2a'); gr.addColorStop(1, '#062a0a'); }
  else { gr.addColorStop(0, '#ffe08a'); gr.addColorStop(.06, '#ff7a1a'); gr.addColorStop(.45, '#b8240e'); gr.addColorStop(1, '#3a0606'); }
  ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x, y + 900);
  for (let xx = x; xx <= x + w + 20; xx += 20) ctx.lineTo(xx, y + Math.sin(xx * .05 + t * 3) * 4 + Math.sin(xx * .013 - t * 2) * 3);
  ctx.lineTo(x + w + 20, y + 900); ctx.closePath(); ctx.fill();
  if (glowK() > 0) { ctx.globalCompositeOperation = 'lighter'; const g2 = ctx.createLinearGradient(0, y - 90, 0, y + 10); g2.addColorStop(0, e.acid ? 'rgba(90,255,40,0)' : 'rgba(255,90,20,0)'); g2.addColorStop(1, e.acid ? 'rgba(120,255,60,.3)' : 'rgba(255,120,30,.35)'); ctx.fillStyle = g2; ctx.fillRect(x, y - 90, w, 100); }
  ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(255,230,150,.7)';
  for (let i = 0; i < 9; i++) { const bx = x + ((i * 157 + t * 40 * (i % 3 + 1)) % (w + 80)) - 40, ph = (t * 1.3 + i * .37) % 1; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.arc(bx, y + 6 - ph * 18, 3 + i % 3, 0, 7); ctx.fill(); }
  ctx.restore();
}
function drawBlock(e, t) {
  if (e.lava) return drawLava(e, t);
  const [x, y, w, h] = blockRect(e);
  if (e.blink && e.off) { ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = rgbaHex(PAL.moss, .45); ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4); ctx.restore(); return; }
  if (e.oneway) {
    // wooden plank you can jump through from below
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#8a5a3a'; ctx.fillRect(0, 0, w, 10); ctx.fillStyle = '#b07a4e'; ctx.fillRect(0, 0, w, 3);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; for (let i = 18; i < w; i += 22) ctx.fillRect(i, 2, 2, 8);
    ctx.strokeStyle = 'rgba(255,220,170,.5)'; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(w, 12); ctx.stroke(); ctx.restore(); return;
  }
  if (e.rock) {
    // cave ceiling: dark rock with a jagged lower edge
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = TEX.stone; ctx.fillRect(0, 0, w, h); ctx.fillStyle = 'rgba(12,6,10,.55)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1a1018'; ctx.beginPath(); ctx.moveTo(0, h); for (let i = 0; i <= w; i += 16) ctx.lineTo(i, h + 4 + Math.abs(Math.sin((e.x + i) * .21)) * 9); ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    ctx.restore(); return;
  }
  if (e.blink && e.warn && Math.floor(t * 14) % 2) { ctx.save(); ctx.globalAlpha = .45; }
  const ceil = e.ceil || (e.y <= 0.5 && !e.moves.length && !e.falling);
  let sx = 0, sy = 0;
  if (e.shake) { sx = rand(-2.5, 2.5); sy = rand(-1.5, 1.5); }
  ctx.save();
  ctx.translate(x + sx, y + sy);
  if (e.ghost && hints) ctx.globalAlpha = 0.42;
  if (e.appear < 1) { const a = e.appear, k = 1 - Math.pow(1 - a, 3); ctx.globalAlpha = a; ctx.translate(w / 2, h / 2); ctx.scale(k, k); ctx.translate(-w / 2, -h / 2); }
  ctx.fillStyle = TEX.stone; ctx.fillRect(0, 0, w, h);
  const gr = ctx.createLinearGradient(0, 0, 0, Math.max(h, 1));
  gr.addColorStop(0, 'rgba(150,130,255,.10)'); gr.addColorStop(Math.min(1, 120 / Math.max(h, 1)), 'rgba(10,6,30,.15)'); gr.addColorStop(1, 'rgba(4,2,16,.55)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
  if (realmMode) { ctx.fillStyle = 'rgba(70,0,140,.35)'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = 'rgba(0,255,230,.55)'; ctx.lineWidth = 1.5; ctx.strokeRect(1, 1, w - 2, h - 2); }
  if (e.ice) { ctx.fillStyle = 'rgba(170,230,255,.32)'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = 'rgba(255,255,255,.22)'; for (let i = 8; i < w; i += 26) ctx.fillRect(i, 4, 2, Math.min(h - 8, 18)); }
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, h - 3, w, 3); ctx.fillRect(w - 2, 0, 2, h);
  ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(0, 0, 2, h);
  if (e.conv) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, 12); ctx.clip();
    if (e.conv < 0) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    const off = ((t * Math.abs(e.conv) * T) % 40 + 40) % 40;
    for (let xx = -40 + off; xx < w + 40; xx += 40) ctx.drawImage(TEX.convC, xx, 0, 40, 12);
    ctx.restore();
  } else if (!ceil) { ctx.translate(0, -7); ctx.fillStyle = e.ice || realmMode ? TEX.ice : TEX.moss; ctx.fillRect(0, 0, w, 20); }
  else { ctx.fillStyle = rgbaHex(PAL.moss, .35); ctx.fillRect(0, h - 3, w, 2); }
  if (e.bounce) { ctx.fillStyle = '#ff5dbb'; ctx.fillRect(0, -2, w, 9); ctx.fillStyle = '#ffd0ef'; ctx.fillRect(0, -2, w, 2); ctx.fillStyle = 'rgba(80,0,60,.4)'; for (let i = 6; i < w; i += 14) ctx.fillRect(i, 2, 6, 4); }
  if (e.sink) { ctx.fillStyle = 'rgba(120,200,255,.25)'; ctx.fillRect(0, 0, w, h); }
  ctx.restore();
  if (e.blink && e.warn && Math.floor(t * 14) % 2) ctx.restore();
}

function drawArrow(e) {
  const vert = e.dir === 'up' || e.dir === 'down', cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate({ left: 0, right: Math.PI, up: Math.PI / 2, down: -Math.PI / 2 }[e.dir]);
  ctx.strokeStyle = '#d8c39a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-T * .45, 0); ctx.lineTo(T * .5, 0); ctx.stroke();
  ctx.fillStyle = PAL.hazard; ctx.beginPath(); ctx.moveTo(-T * .55, 0); ctx.lineTo(-T * .25, -8); ctx.lineTo(-T * .25, 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff5d8a'; ctx.beginPath(); ctx.moveTo(T * .3, 0); ctx.lineTo(T * .55, -7); ctx.lineTo(T * .5, 0); ctx.lineTo(T * .55, 7); ctx.closePath(); ctx.fill();
  ctx.restore(); if (vert) return;
}
function drawSpike(e) {
  if (e.arrow) return drawArrow(e);
  const spr = TEX.spike[e.dir]; const k = e.pop < 1 ? e.pop : 1;
  if (k <= 0) return;
  if (e.fake && hints) { ctx.save(); ctx.globalAlpha = .4; }
  let sx = e.shake ? rand(-2.5, 2.5) : 0;
  for (let i = 0; i < e.n; i++) {
    let x = e.x + sx, y = e.y;
    if (e.dir === 'up') ctx.drawImage(spr, x + i * T, y + T * (1 - k), T, T * k);
    else if (e.dir === 'down') ctx.drawImage(spr, x + i * T, y, T, T * k);
    else if (e.dir === 'right') ctx.drawImage(spr, x, y + i * T, T * k, T);
    else ctx.drawImage(spr, x + T * (1 - k), y + i * T, T * k, T);
  }
  if (e.fake && hints) ctx.restore();
}

function archPath(r, top, h, inset) { ctx.beginPath(); ctx.moveTo(-r - inset, h / 2); ctx.lineTo(-r - inset, top + r); ctx.arc(0, top + r, r + inset, Math.PI, 0); ctx.lineTo(r + inset, h / 2); ctx.closePath(); }
function drawGate(e, t, world, col, glowTex, scale) {
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2, gk = glowK();
  if (gk > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const pul = (1 + Math.sin(t * 3) * .06) * scale;
    ctx.globalAlpha = .55 * Math.min(1, gk); ctx.drawImage(glowTex, cx - 110 * pul, cy - 110 * pul, 220 * pul, 220 * pul);
    ctx.restore();
  }
  ctx.save(); ctx.translate(cx, cy); if (e.flip) ctx.scale(1, -1); ctx.scale(scale, scale);
  const w = e.w, h = e.h, top = -h / 2, r = w / 2;
  archPath(r, top, h, 5); ctx.fillStyle = '#3a2f5c'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
  ctx.save(); archPath(r, top, h, -2); ctx.clip();
  const gr = ctx.createRadialGradient(0, 4, 2, 0, 4, h * .7); gr.addColorStop(0, '#fffbe8'); gr.addColorStop(.25, col); gr.addColorStop(.6, mixHex(col, '#7a1f4f', .55)); gr.addColorStop(1, mixHex(col, '#120018', .8));
  ctx.fillStyle = gr; ctx.fillRect(-r, top, w, h);
  ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 2.2;
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(255,240,220,${.35 - i * .06})`; ctx.beginPath();
    for (let a = 0; a < 9; a += .25) { const rr = a * 3.2 + i * 2, an = a - t * 3 + i * 1.6; const px = Math.cos(an) * rr * .8, py = 4 + Math.sin(an) * rr; a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-5, top - 6); ctx.lineTo(5, top - 6); ctx.lineTo(3, top + 4); ctx.lineTo(-3, top + 4); ctx.fill();
  ctx.restore();
  if (world && !world.silent && Math.random() < .25 * GFX.fx * Perf.fxK) world.parts.push({ x: cx + rand(-18, 18), y: cy + rand(-20, 30), vx: rand(-10, 10), vy: rand(-50, -20) * (e.flip ? -1 : 1), life: 1, max: 1, size: rand(1.2, 2.4), col: mixHex(col, '#ffffff', .5), g: 0, drag: 0, add: true });
}
function drawDoor(e, t, world) { if (e.fake && hints) { ctx.save(); ctx.globalAlpha = .55; drawGate(e, t, null, '#ff5d8a', TEX.gRose, 1); ctx.restore(); return; } drawGate(e, t, world, PAL.door, TEX.gDoor, 1); }
function drawPortal(e, t, world) {
  if (e.open <= 0) {
    if (hints) { ctx.save(); ctx.globalAlpha = .25 + Math.sin(t * 4) * .1; ctx.strokeStyle = '#c59bff'; ctx.setLineDash([5, 5]); ctx.lineWidth = 2; ctx.strokeRect(e.x, e.y, e.w, e.h); ctx.restore(); }
    return;
  }
  const k = 1 - Math.pow(1 - e.open, 3);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .4 * k; const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  ctx.translate(cx, cy); ctx.rotate(t * 1.5); ctx.drawImage(TEX.gViolet, -130, -130, 260, 260); ctx.restore();
  drawGate(e, t * 1.7, world, '#c59bff', TEX.gViolet, k);
}

function drawMace(e, t) {
  const r = e.r;
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.rot * .25);
  ctx.fillStyle = PAL.hazard; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a - .22) * r * .8, Math.sin(a - .22) * r * .8); ctx.lineTo(Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45); ctx.lineTo(Math.cos(a + .22) * r * .8, Math.sin(a + .22) * r * .8); ctx.fill(); }
  const gr = ctx.createRadialGradient(-r * .3, -r * .3, 2, 0, 0, r); gr.addColorStop(0, '#9a94b8'); gr.addColorStop(1, '#2a2547');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.fillStyle = '#ff5d8a'; ctx.beginPath(); ctx.arc(0, 0, r * .25, 0, 7); ctx.fill();
  ctx.restore();
}
function drawSaw(e, t) {
  if (e.mace) return drawMace(e, t);
  const gk = glowK();
  if (gk > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .35 * Math.min(1, gk); ctx.drawImage(TEX.gRose, e.x - e.r * 2, e.y - e.r * 2, e.r * 4, e.r * 4); ctx.restore(); }
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.rot); const s = e.r * 2.5; ctx.drawImage(TEX.saw, -s / 2, -s / 2, s, s); ctx.restore();
}
function drawTrack(e) {
  ctx.save(); ctx.strokeStyle = 'rgba(20,12,40,.75)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  if (e.pend) {   // chain from the pivot
    const cx = e.type === 'saw' ? e.x : e.x + e.w / 2, cy = e.type === 'saw' ? e.y : e.y;
    ctx.lineWidth = 3; ctx.strokeStyle = '#8a86a8'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(e.pcx + (e.type === 'saw' ? 0 : e.w / 2), e.pcy); ctx.lineTo(cx, cy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#2a2547'; ctx.beginPath(); ctx.arc(e.pcx + (e.type === 'saw' ? 0 : e.w / 2), e.pcy, 7, 0, 7); ctx.fill(); ctx.restore(); return;
  }
  if (e.orbit && e.type === 'block') { ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(138,134,168,.6)'; ctx.beginPath(); ctx.moveTo(e.ocx + e.w / 2, e.ocy); ctx.lineTo(e.x + e.w / 2, e.y); ctx.stroke(); ctx.fillStyle = '#2a2547'; ctx.beginPath(); ctx.arc(e.ocx + e.w / 2, e.ocy, 8, 0, 7); ctx.fill(); ctx.restore(); return; }
  if (e.orbit) { ctx.beginPath(); ctx.arc(e.ocx, e.ocy, e.orbit.rad * T, 0, 7); ctx.stroke(); ctx.strokeStyle = 'rgba(255,93,138,.35)'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#2a2547'; ctx.beginPath(); ctx.arc(e.ocx, e.ocy, 7, 0, 7); ctx.fill(); }
  else if (e.patrol0) { const p = e.patrol0.pts; ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (const q of p) ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.strokeStyle = 'rgba(255,93,138,.35)'; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
}
function drawSpring(e) {
  const k = e.anim > 0 ? Math.sin((1 - e.anim) * Math.PI * 3) * e.anim : 0;
  const x = e.x + (e.shake ? rand(-2, 2) : 0), by = e.y + e.h, hgt = 12 - k * 8 + (e.anim > .5 ? 10 * (e.anim - .5) : 0);
  ctx.fillStyle = '#2a2547'; ctx.fillRect(x + 4, by - 4, T - 8, 4);
  ctx.strokeStyle = '#c8cbe6'; ctx.lineWidth = 2.5; ctx.beginPath();
  for (let i = 0; i <= 4; i++) { const yy = by - 4 - (hgt * i / 4); ctx.lineTo(x + (i % 2 ? T - 11 : 11), yy); } ctx.stroke();
  const ty = by - 4 - hgt - 6;
  ctx.fillStyle = '#ff5d8a'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x + 3, ty, T - 6, 7, 3) : ctx.rect(x + 3, ty, T - 6, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x + 6, ty + 1, T - 12, 2);
}
function drawOrb(e, t) {
  const pul = 1 + Math.sin(t * 5 + e.x) * .1, a = e.cd > 0 ? .4 : 1;
  if (glowK() > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .7 * a; const gs = e.r * 5 * pul; ctx.drawImage(TEX.gViolet, e.x - gs / 2, e.y - gs / 2, gs, gs); ctx.restore(); }
  ctx.save(); ctx.translate(e.x, e.y); ctx.globalAlpha = a;
  const gr = ctx.createRadialGradient(-4, -4, 1, 0, 0, e.r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.4, '#d7b8ff'); gr.addColorStop(1, '#7b3fe0');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, e.r * pul * .85, 0, 7); ctx.fill();
  ctx.rotate(t * 2); ctx.strokeStyle = 'rgba(230,210,255,.8)'; ctx.lineWidth = 2; ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.arc(0, 0, e.r * 1.25, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  ctx.rotate(-t * 2); ctx.fillStyle = '#4b1f9a'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, -2); ctx.lineTo(-5, -2); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(5, 2); ctx.lineTo(-5, 2); ctx.fill();
  ctx.restore();
}
function drawLaser(e, t) {
  const h = e.dir === 'h', x0 = e.x, y0 = e.y, x1 = h ? e.x + e.len : e.x, y1 = h ? e.y : e.y + e.len;
  ctx.save(); ctx.lineCap = 'round';
  if (e.act) {
    if (glowK() > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,50,90,.35)'; ctx.lineWidth = 16 + Math.sin(t * 40) * 3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = '#ff3d71'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = '#fff3f6'; ctx.lineWidth = 2.5; ctx.stroke();
  } else {
    ctx.strokeStyle = e.warn && Math.floor(t * 18) % 2 ? 'rgba(255,61,113,.85)' : 'rgba(255,61,113,.18)'; ctx.lineWidth = e.warn ? 2.5 : 1.5; ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
  }
  // emitters
  ctx.fillStyle = '#2a2547'; ctx.strokeStyle = e.act ? '#ff3d71' : '#6a5a8a'; ctx.lineWidth = 2;
  for (const [x, y] of [[x0, y0], [x1, y1]]) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 8, y - 8, 16, 16, 4) : ctx.rect(x - 8, y - 8, 16, 16); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}

function drawPlayer(world, t) {
  const p = world.p; if (world.state === 'dead') return;
  const g = p.g, cx = p.x + PW / 2, feet = g > 0 ? p.y + PHT : p.y;
  if (glowK() > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (.28 * p.winS + .05) * Math.min(1, glowK()); ctx.drawImage(TEX.gWarm, cx - 70, p.y + PHT / 2 - 70, 140, 140); ctx.restore(); }
  ctx.save();
  ctx.translate(cx, feet); if (g < 0) ctx.scale(1, -1);
  if (world.state === 'win') { ctx.translate(0, -16); ctx.rotate(p.rot); ctx.scale(p.winS, p.winS); ctx.translate(0, 16); }
  ctx.scale(p.sx, p.sy);
  drawHero(t, p.face, p.onGround, p.vx, p.vy * g, p.runPhase, p.blink, world.dj && !p.air2 && !p.onGround);
  ctx.restore();
}
/* the character itself, drawn at the origin (feet at 0,0). Also used by the 2D chase views. */
function drawHero(t, f, onGround, vx, vyUp, ph, blinkT, djReady) {
  const air = !onGround, run = onGround && Math.abs(vx) > 40;
  const speed = clamp(Math.abs(vx) / PH.run, 0, 1), vyN = clamp(vyUp / 800, -1, 1);
  ctx.strokeStyle = PAL.scarf; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const ax = -f * 9, ay = -15;
  ctx.beginPath(); ctx.moveTo(ax, ay);
  for (let i = 1; i <= 5; i++) {
    const xx = ax - f * i * (2.6 + speed * 3.6), yy = ay + i * (1.6 - speed * 1.2) + vyN * i * 1.8 + Math.sin(t * 14 - i * .9) * (0.5 + speed * 1.6) * i * .35;
    ctx.lineTo(xx, yy);
  }
  ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = PAL.scarfHi; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#3b2a52';
  const l1 = run ? Math.sin(ph) * 5 : air ? -3 : -1, l2 = run ? -Math.sin(ph) * 5 : air ? 4 : 1;
  const ly1 = run ? -Math.max(0, Math.cos(ph)) * 3 : air ? -3 : 0, ly2 = run ? -Math.max(0, -Math.cos(ph)) * 3 : air ? -1 : 0;
  ctx.beginPath(); ctx.ellipse(-5 + l1, -3 + ly1, 5, 3.6, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(5 + l2, -3 + ly2, 5, 3.6, 0, 0, 7); ctx.fill();
  const bob = run ? Math.abs(Math.sin(ph)) * 1.6 : Math.sin(t * 3) * .6;
  ctx.translate(0, -bob);
  const gr = ctx.createLinearGradient(0, -34, 0, -4); gr.addColorStop(0, PAL.bodyTop); gr.addColorStop(1, PAL.bodyBot);
  ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-14, -34, 28, 30, 12) : ctx.rect(-14, -34, 28, 30); ctx.fill();
  ctx.strokeStyle = 'rgba(90,40,50,.45)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = PAL.moss; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(f * 2, -34); ctx.quadraticCurveTo(f * 3, -41, f * 7 - Math.sin(t * 4) * 1.5, -42); ctx.stroke();
  ctx.fillStyle = djReady ? '#9ef9ff' : mixHex(PAL.moss, '#ffffff', .25); ctx.beginPath(); ctx.ellipse(f * 7 - Math.sin(t * 4) * 1.5, -42, 4, 2.4, -f * .5, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.scarf; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-14.5, -17, 29, 6, 3) : ctx.rect(-14.5, -17, 29, 6); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-12, -16, 24, 1.5);
  ctx.fillStyle = 'rgba(255,110,120,.45)'; ctx.beginPath(); ctx.ellipse(-8 + f * 3, -20.5, 3, 1.8, 0, 0, 7); ctx.ellipse(8 + f * 3, -20.5, 3, 1.8, 0, 0, 7); ctx.fill();
  const blink = blinkT < 0 ? .15 : 1, ex = f * 3.5, look = clamp(vyUp / 900, -1, 1) * 1.6;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-5 + ex, -25, 4.3, 5.2 * blink, 0, 0, 7); ctx.ellipse(5 + ex, -25, 4.3, 5.2 * blink, 0, 0, 7); ctx.fill();
  if (blink > .5) {
    ctx.fillStyle = '#231536'; ctx.beginPath(); ctx.ellipse(-5 + ex + f * 1.4, -25 + look, 2.4, 3.1, 0, 0, 7); ctx.ellipse(5 + ex + f * 1.4, -25 + look, 2.4, 3.1, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-4 + ex + f * 1.4, -26.5 + look, .9, 0, 7); ctx.arc(6 + ex + f * 1.4, -26.5 + look, .9, 0, 7); ctx.fill();
  }
}

function drawParticles(world) {
  const lim = Math.max(20, Math.round(400 * GFX.fx * Perf.fxK)), arr = world.parts, start = Math.max(0, arr.length - lim);
  for (let i = start; i < arr.length; i++) {
    const q = arr[i], a = q.life / q.max;
    if (q.ring) { const r = (1 - a) * 90; ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = q.col === '#fff' ? '#ffd9b0' : q.col; ctx.lineWidth = 4 * a + 1; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, 7); ctx.stroke(); ctx.restore(); continue; }
    ctx.globalAlpha = Math.min(1, a * 1.5);
    if (q.add) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.5 + a * .5), 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    else if (q.sq) { ctx.fillStyle = q.col; const s = q.size * (0.6 + a * .4); ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s); }
    else { ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.4 + a * .6), 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

function drawMotes(t, dt) {
  const n = Math.min(motes.length, Math.round(GFX.motes * Perf.fxK)); if (!n) return;
  // screen-space dust that drifts slower than the camera (parallax)
  ctx.save(); ctx.setTransform(S, 0, 0, S, OX, OY); ctx.globalCompositeOperation = 'lighter';
  const span = W + EXT.l + EXT.r + 40, off = CAMX * .35;
  for (let i = 0; i < n; i++) {
    const m = motes[i];
    m.x += m.sp * dt * .4; m.y += Math.sin(t * .8 + m.ph) * .25 - m.sp * dt * .25;
    if (m.y < -20) { m.y = H + 20; } if (m.x > W + EXT.r + 20) m.x = -EXT.l - 20;
    const mx = ((m.x - off + EXT.l + 20) % span + span) % span - EXT.l - 20;
    const s = m.s * 6 * (0.75 + Math.sin(t * 2 + m.ph) * .25);
    ctx.globalAlpha = .55; ctx.drawImage(TEX[m.c], mx - s, m.y - s, s * 2, s * 2);
  }
  ctx.restore();
}

// entities near the camera (long levels can hold a thousand of them)
function viewEnts(world) {
  const a = CAMX - EXT.l - 160, b = CAMX + W + EXT.r + 160, out = [];
  for (const e of world.lv.ents) {
    if (e.gone) continue;
    let x0, x1;
    if (e.type === 'saw') { const r = e.r + (e.orbit ? e.orbit.rad * T : 0); x0 = (e.orbit ? e.ocx : e.x) - r; x1 = (e.orbit ? e.ocx : e.x) + r;
      if (e.patrol0) for (const q of e.patrol0.pts) { x0 = Math.min(x0, q[0] - e.r); x1 = Math.max(x1, q[0] + e.r); } }
    else if (e.type === 'laser') { x0 = e.x - 10; x1 = e.x + (e.dir === 'h' ? e.len : 0) + 10; }
    else { x0 = e.x; x1 = e.x + (e.w || 0); }
    if (x1 > a && x0 < b) out.push(e);
  }
  return out;
}
function drawZone(e, t) {
  if (e.kind === 'shade') return;
  const on = e.act;
  ctx.save(); ctx.beginPath(); ctx.rect(e.x, e.y, e.w, e.h); ctx.clip();
  if (e.kind === 'wind') {
    const up = Math.abs(e.fy || 0) > Math.abs(e.fx || 0), sgn = up ? Math.sign(e.fy || -1) : Math.sign(e.fx || 1);
    ctx.fillStyle = on ? 'rgba(160,240,255,.10)' : (e.warn && Math.floor(t * 10) % 2 ? 'rgba(160,240,255,.08)' : 'rgba(160,240,255,.03)'); ctx.fillRect(e.x, e.y, e.w, e.h);
    if (on) { ctx.strokeStyle = 'rgba(210,250,255,.55)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 12; i++) { const r1 = (i * 97.3) % 1, sp = 260, len = 26;
        if (up) { const x = e.x + ((i * 53) % e.w), y = e.y + e.h - (((t * sp + i * 61) % (e.h + len))); ctx.moveTo(x, sgn < 0 ? y : e.y + e.h - y + e.y); ctx.lineTo(x, (sgn < 0 ? y : e.y + e.h - y + e.y) + len * -sgn); }
        else { const y = e.y + ((i * 37) % e.h), x0 = (t * sp + i * 71) % (e.w + len); const x = sgn > 0 ? e.x + x0 : e.x + e.w - x0; ctx.moveTo(x, y); ctx.lineTo(x - len * sgn, y); } }
      ctx.stroke(); }
  } else if (e.kind === 'float') {
    ctx.fillStyle = 'rgba(170,140,255,.11)'; ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = 'rgba(220,200,255,.45)'; for (let i = 0; i < 14; i++) { const x = e.x + ((i * 67) % e.w), y = e.y + e.h - ((t * 30 + i * 47) % e.h); ctx.beginPath(); ctx.arc(x + Math.sin(t * 2 + i) * 6, y, 2.5 + (i % 3), 0, 7); ctx.fill(); }
  }
  ctx.restore();
}
function drawTele(e, t) {
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2, exit = !e.to, col = exit ? '#c59bff' : '#7af7ff';
  if (glowK() > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5; ctx.drawImage(exit ? TEX.gViolet : TEX.gCyan, cx - 60, cy - 60, 120, 120); ctx.restore(); }
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 1.6);
  for (let i = 0; i < 3; i++) { ctx.strokeStyle = rgbaHex(col, .9 - i * .25); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 14 - i * 4, t * (3 + i) * (exit ? -1 : 1), t * (3 + i) * (exit ? -1 : 1) + 4.6); ctx.stroke(); }
  ctx.restore();
}
function drawDash(e, t) {
  ctx.save();
  if (glowK() > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .45; ctx.drawImage(TEX.gGold, e.x - 20, e.y - 40, e.w + 40, 70); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  ctx.fillStyle = '#2a2236'; ctx.fillRect(e.x, e.y, e.w, e.h); ctx.fillStyle = '#ffb347'; ctx.fillRect(e.x, e.y, e.w, 2);
  for (let i = 0; i < 4; i++) { const a = (Math.sin(t * 9 - i * 1.2) + 1) / 2; ctx.fillStyle = `rgba(255,${190 + a * 60 | 0},90,${.5 + a * .5})`; const x = e.x + 6 + i * 18, y = e.y - 14;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 10, y + 6); ctx.lineTo(x, y + 12); ctx.lineTo(x + 4, y + 6); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function drawGem(e, t) {
  const y = e.y + Math.sin(t * 3 + e.ph) * 4, s = 11;
  if (glowK() > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55; ctx.drawImage(TEX.gCyan, e.x - 34, y - 34, 68, 68); ctx.restore(); }
  ctx.save(); ctx.translate(e.x, y); ctx.scale(Math.cos(t * 2.5 + e.ph) * .35 + .75, 1);
  ctx.fillStyle = '#7af7ff'; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * .8, 0); ctx.lineTo(0, s); ctx.lineTo(-s * .8, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * .35, -1); ctx.lineTo(0, 2); ctx.lineTo(-s * .35, -1); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawFlag(e, t) {
  const x = e.x, top = e.y, h = e.h, on = e.on, wv = e.wave || 0;
  if (on && glowK() > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (.35 + wv * .5) * Math.min(1, glowK()); ctx.drawImage(TEX.gMint, x - 46, top - 30, 110, 110); ctx.restore(); }
  ctx.fillStyle = '#2a2547'; ctx.fillRect(x - 5, top + h - 6, 14, 6);
  ctx.fillStyle = '#d8d2ee'; ctx.fillRect(x, top, 4, h - 4);
  ctx.fillStyle = on ? PAL.moss : '#ff5d8a'; ctx.beginPath(); ctx.moveTo(x + 4, top + 2);
  for (let i = 0; i <= 6; i++) { const u = i / 6; ctx.lineTo(x + 4 + u * 30, top + 2 + Math.sin(t * 6 + u * 4) * 3 * u * (1 + wv * 2)); }
  for (let i = 6; i >= 0; i--) { const u = i / 6; ctx.lineTo(x + 4 + u * 30, top + 20 - u * 4 + Math.sin(t * 6 + u * 4) * 3 * u * (1 + wv * 2)); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + 6, top + 5, 12, 2);
  ctx.fillStyle = '#ffd36e'; ctx.beginPath(); ctx.arc(x + 2, top - 2, 4, 0, 7); ctx.fill();
}
function drawDynamic(world, t, dt, depth) {
  const ents = VIEW_ENTS = viewEnts(world);
  for (const e of ents) if (e.type === 'zone') drawZone(e, t);
  for (const e of ents) if (e.type === 'flag') drawFlag(e, t);
  for (const e of ents) if (e.type === 'dash') drawDash(e, t);
  for (const e of ents) if (e.type === 'gem') drawGem(e, t);
  for (const e of ents) if (e.type === 'block' && !e.gone && !e.hidden && (e.pend || e.orbit)) drawTrack(e);
  if (hints) for (const e of ents) if (!e.gone && e.hidden && (e.type === 'spike' || e.type === 'block')) drawHint(e);
  for (const e of ents) if (!e.gone && !e.hidden && e.type === 'saw' && (e.patrol0 || e.orbit || e.pend)) drawTrack(e);
  for (const e of ents) if (!e.gone && e.type === 'laser') drawLaser(e, t);
  for (const e of ents) if (!e.gone && !e.hidden && e.type === 'saw') { if (depth) drawSawBack(e, depth); drawSaw(e, t); }
  for (const e of ents) if (!e.gone && !e.hidden && e.type === 'spike' && !isStaticEnt(e)) drawSpike(e);
  for (const e of ents) if (!e.gone && !e.hidden && e.type === 'block' && !isStaticEnt(e)) drawBlock(e, t);
  for (const e of ents) if (!e.gone && e.type === 'spring') drawSpring(e);
  for (const e of ents) if (!e.gone && e.type === 'orb') drawOrb(e, t);
  for (const e of ents) if (!e.gone && e.type === 'tele') drawTele(e, t);
  for (const e of ents) if (!e.gone && e.type === 'door') drawDoor(e, t, world);
  for (const e of ents) if (!e.gone && e.type === 'portal') drawPortal(e, t, world);
  drawPlayer(world, t);
  drawParticles(world);
  if (world.dark || world.shade || world.cave) drawDark(world, t);
}
function drawOverlays(world, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (world && world.flash > 0) { ctx.fillStyle = `rgba(255,60,100,${world.flash * .22})`; ctx.fillRect(0, 0, cw, ch); }
  if (world && world.rev) {
    const a = 0.35 + Math.sin(t * 6) * 0.15, b = 26 * dpr;
    ctx.fillStyle = `rgba(197,155,255,${a})`; ctx.fillRect(0, 0, cw, b * .35); ctx.fillRect(0, ch - b * .35, cw, b * .35); ctx.fillRect(0, 0, b * .35, ch); ctx.fillRect(cw - b * .35, 0, b * .35, ch);
  }
  if (world && world.lightning > 0) { ctx.fillStyle = `rgba(210,200,255,${world.lightning * .12})`; ctx.fillRect(0, 0, cw, ch); }
  drawTransition();
}
const shakeOf = world => world ? world.shakeA * (CFG.shake / 100) : 0;

/* classic flat 2D */
function render(world, t, dt) {
  const sh = shakeOf(world);
  const sx = sh ? rand(-sh, sh) * .6 : 0, sy = sh ? rand(-sh, sh) * .6 : 0;
  hints = !!(world && world.D.hints); realmMode = !!(world && world.def.realm);
  CAMX = world ? world.camX || 0 : 0; LW = world ? world.lw || W : W;
  drawBack(world, sx, sy);
  drawCaves(world, sx, sy, t);
  drawStatics(world, sx, sy);
  worldTransform(sx, sy);
  drawMotes(t, dt);
  if (world) drawDynamic(world, t, dt, null);
  drawWeather2D(world, t, dt, sx, sy);
  drawOverlays(world, t);
}

/* "2D that imitates 3D": blocks are extruded towards a vanishing point that follows the player, with parallax layers */
function render25(world, t, dt) {
  if (!BG.far || !BG.mid) buildBackground();
  const sh = shakeOf(world), sx = sh ? rand(-sh, sh) * .6 : 0, sy = sh ? rand(-sh, sh) * .6 : 0;
  hints = !!world.D.hints; realmMode = !!world.def.realm;
  CAMX = world.camX || 0; LW = world.lw || W;
  // vanishing point follows the player on screen (screen-relative), expressed in world coordinates
  const p = world.p, px = p.x + PW / 2 - CAMX, py = p.y + PHT / 2;
  const cam = world.cam25 || (world.cam25 = { x: px, y: py });
  cam.x = lerp(cam.x, px, Math.min(1, dt * 3)); cam.y = lerp(cam.y, py, Math.min(1, dt * 3));
  const vp = { x: CAMX + W * .5 + (cam.x - W * .5) * .55, y: H * .3 + (cam.y - H * .5) * .2, k: .885 };
  drawBack(world, sx, sy, (cam.x - W * .5) * .55 * S);
  drawCaves(world, sx, sy, t);
  worldTransform(sx, sy);
  drawMotes(t, dt);
  // depth faces (faces hidden behind a touching neighbour block are skipped)
  ctx.lineJoin = 'round';
  const near = viewEnts(world);
  vp.blocks = near.filter(e => e.type === 'block' && !e.hidden && !e.lava && e.appear >= 1);
  for (const e of near) {
    if (e.hidden) continue;
    if (e.type === 'block' && !e.lava && !(e.ghost && hints) && !(e.blink && e.off)) drawExtrude(e, vp);
    else if (e.type === 'spike' && e.pop > 0) drawSpikeBack(e, vp);
  }
  drawStatics(world, sx, sy);
  worldTransform(sx, sy);
  drawDynamic(world, t, dt, vp);
  drawWeather2D(world, t, dt, sx, sy);
  drawOverlays(world, t);
}
function drawExtrude(e, vp) {
  const [x0, y0, w, h] = blockRect(e), x1 = x0 + w, y1 = y0 + h, k = vp.k;
  if (e.appear < 1) return;
  const bx = x => vp.x + (x - vp.x) * k, by = y => vp.y + (y - vp.y) * k;
  const BX0 = bx(x0), BX1 = bx(x1), BY0 = by(y0), BY1 = by(y1);
  const quad = (ax, ay, bx_, by_, cx, cy, dx, dy, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx_, by_); ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); ctx.closePath(); ctx.fill(); };
  const ceil = e.ceil || (e.y <= 0.5);
  const cov = (side) => vp.blocks.some(b => b !== e && (
    side === 'l' ? Math.abs(b.x + b.w - e.x) < 1 && b.y <= e.y + 1 && b.y + b.h >= e.y + e.h - 1 :
    side === 'r' ? Math.abs(b.x - e.x - e.w) < 1 && b.y <= e.y + 1 && b.y + b.h >= e.y + e.h - 1 :
    side === 't' ? Math.abs(b.y + b.h - e.y) < 1 && b.x <= e.x + 1 && b.x + b.w >= e.x + e.w - 1 :
                   Math.abs(b.y - e.y - e.h) < 1 && b.x <= e.x + 1 && b.x + b.w >= e.x + e.w - 1));
  if (vp.y < y0 && !cov('t')) { quad(x0, y0, x1, y0, BX1, BY0, BX0, BY0, ceil ? PAL.f25side : (e.ice ? '#8fd8f0' : e.conv ? '#3a2e44' : PAL.f25top)); if (!ceil && !e.conv) { ctx.strokeStyle = PAL.f25edge; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(BX0, BY0); ctx.lineTo(BX1, BY0); ctx.stroke(); } }
  if (vp.y > y1 && !cov('b')) quad(x0, y1, x1, y1, BX1, BY1, BX0, BY1, PAL.f25bot);
  if (vp.x < x0 && !cov('l')) quad(x0, y0, x0, y1, BX0, BY1, BX0, BY0, PAL.f25side);
  if (vp.x > x1 && !cov('r')) quad(x1, y0, x1, y1, BX1, BY1, BX1, BY0, PAL.f25side);
}
function drawSpikeBack(e, vp) {
  const k = vp.k, spr = TEX.spikeDark[e.dir], pk = Math.min(1, e.pop);
  for (let i = 0; i < e.n; i++) {
    const vert = e.dir === 'up' || e.dir === 'down';
    let x = e.x + (vert ? i * T : 0), y = e.y + (vert ? 0 : i * T);
    const X = vp.x + (x - vp.x) * k, Y = vp.y + (y - vp.y) * k, s = T * k;
    if (e.dir === 'up') ctx.drawImage(spr, X, Y + s * (1 - pk), s, s * pk);
    else if (e.dir === 'down') ctx.drawImage(spr, X, Y, s, s * pk);
    else ctx.drawImage(spr, X, Y, s, s);
  }
}
function drawSawBack(e, vp) {
  const k = vp.k; ctx.save();
  for (const kk of [k, (1 + k) / 2]) { const X = vp.x + (e.x - vp.x) * kk, Y = vp.y + (e.y - vp.y) * kk, s = e.r * 2.5 * kk; ctx.save(); ctx.translate(X, Y); ctx.rotate(e.rot); ctx.drawImage(TEX.sawDark, -s / 2, -s / 2, s, s); ctx.restore(); }
  ctx.restore();
}

function drawDark(world, t) {
  const c = BG.dark, g = BG.darkG, q = c.width / cw;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, c.width, c.height);
  const base = world.dark || world.shade ? .95 : .7;   // caves are dim, not pitch black
  g.fillStyle = `rgba(3,2,12,${base - world.lightning * .8})`; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a) => { const sx = (OX + (x - CAMX) * S) * q, sy = (OY + y * S) * q, rr = r * S * q; if (sx + rr < 0 || sx - rr > c.width) return; g.globalAlpha = a; g.drawImage(TEX.glow, sx - rr, sy - rr, rr * 2, rr * 2); };
  const p = world.p; const fl = 1 + Math.sin(t * 9) * .03 + Math.sin(t * 23) * .02;
  if (world.state !== 'dead') hole(p.x + PW / 2, p.y + PHT / 2, 230 * fl, 1);
  for (const e of viewEnts(world)) {
    if (e.type === 'flag' && e.on) hole(e.x + 10, e.y + 20, 70, .6);
    if (e.type === 'door' || (e.type === 'portal' && e.open > 0)) hole(e.x + e.w / 2, e.y + e.h / 2, 120, .9);
    if (e.type === 'saw') hole(e.x, e.y, 80, .55);
    if (e.type === 'laser' && e.act) { const n = Math.max(1, Math.round(e.len / 80)); for (let i = 0; i <= n; i++) hole(e.x + (e.dir === 'h' ? e.len * i / n : 0), e.y + (e.dir === 'v' ? e.len * i / n : 0), 60, .45); }
  }
  for (const pt of world.parts) if (pt.add) hole(pt.x, pt.y, 18, .3);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(c, 0, 0, cw, ch); ctx.restore();
  worldTransform(0, 0);
}

/* transition: circular wipe */
let trans = null;
function startTrans(dir, dur, cb, cx, cy) { trans = { dir, t: 0, dur, cb, cx, cy }; }
function drawTransition() {
  if (!trans) return;
  const k = clamp(trans.t / trans.dur, 0, 1);
  const e = trans.dir === 'close' ? 1 - k * k : k * (2 - k);
  const cx = OX + ((trans.cx ?? CAMX + W / 2) - CAMX) * S, cy = OY + (trans.cy ?? H / 2) * S;
  const maxR = Math.hypot(Math.max(cx, cw - cx), Math.max(cy, ch - cy));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#07051a'; ctx.beginPath(); ctx.rect(0, 0, cw, ch); ctx.arc(cx, cy, Math.max(0.01, e * maxR), 0, Math.PI * 2, true); ctx.fill();
}
