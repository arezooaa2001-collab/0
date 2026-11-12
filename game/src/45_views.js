/* ============================ CHASE LEVELS IN 2D AND PSEUDO-3D ============================ */
// Both views draw the same Run3D simulation (same course, obstacles, giants) on the 2D canvas.
const css = n => '#' + (n >>> 0).toString(16).padStart(6, '0');
function runColors(run) {
  if (run.c2 && run.c2.ver === PAL.ver) return run.c2;
  const TH = THEMES3[run.def.theme] || THEMES3.dusk;
  const c = run.c2 = { ver: PAL.ver,
    sky: TH.sky.map(css), fog: css(TH.fog), ground: css(TH.ground), road: colSet('road') ? colOf('road') : css(TH.road), side: css(TH.side),
    edge: colSet('moss') ? colOf('moss') : css(TH.edge), mtn: css(TH.mtn), tree: css(TH.treeC), trunk: css(TH.trunk),
    obst: colSet('obstacle') ? colOf('obstacle') : '#ffd36e', hazard: colSet('hazard') ? colOf('hazard') : '#d8dcf2',
    giant: colSet('giant') ? colOf('giant') : css(TH.giant[0]), eye: css(TH.eye), lava: !!TH.mistGlow };
  c.roadDark = mixHex(c.road, '#000000', .25); c.roadLite = mixHex(c.road, '#ffffff', .12); c.groundDark = mixHex(c.ground, '#000000', .18);
  c.wall = mixHex(c.side, '#ffffff', .12); c.wallTop = mixHex(c.side, '#ffffff', .3);
  // a giant formation for the 2D views (the 3D view builds its own)
  if (!run.form2) { const r = srand(run.def.seed * 17 + 3); run.form2 = [{ x: 0, z: 0, k: 1.05, ph: 0 }]; for (let i = 1; i < run.def.giants; i++) { const ring = Math.ceil(i / 6); run.form2.push({ x: (i % 2 ? -1 : 1) * (9 + r() * 10 + ring * 4.5), z: 4 + ring * 5 + r() * 8, k: .8 + r() * .45, ph: r() * 6.28 }); } }
  return c;
}
const moverC = (run, o) => Math.sin(run.time * o.om + o.ph) * o.amp;

/* a stylised giant; (x,y) = feet on screen, u = pixels per metre */
function drawGiant2D(x, y, u, ph, body, eye, reach, side) {
  const lg = Math.sin(ph) * .5;
  ctx.save(); ctx.translate(x, y); ctx.scale(u, u);
  const dark = mixHex(body, '#000000', .3);
  ctx.fillStyle = dark;
  ctx.save(); ctx.translate(-1.3, -6.6); ctx.rotate(lg * side); ctx.fillRect(-.85, 0, 1.7, 6.2); ctx.fillRect(-1.1, 5.6, 2.6 * side, 1); ctx.restore();
  ctx.fillStyle = body;
  ctx.save(); ctx.translate(1.3, -6.6); ctx.rotate(-lg * side); ctx.fillRect(-.85, 0, 1.7, 6.2); ctx.fillRect(-1.1, 5.6, 2.6 * side, 1); ctx.restore();
  ctx.beginPath(); ctx.ellipse(0, -10.4, 3.3, 3.9, 0, 0, 7); ctx.fill();
  ctx.fillStyle = mixHex(body, '#ffffff', .12); ctx.beginPath(); ctx.ellipse(-.9 * side, -11.6, 1.4, 1.8, 0, 0, 7); ctx.fill();
  const arm = (sx, a) => { ctx.save(); ctx.translate(sx * 3.4, -12.8); ctx.rotate(a); ctx.fillStyle = sx < 0 ? dark : body; ctx.fillRect(-.65, 0, 1.3, 6.2); ctx.beginPath(); ctx.arc(0, 6.4, .95, 0, 7); ctx.fill(); ctx.restore(); };
  arm(-1, lerp(-lg * .8, -1.4 * side, reach)); arm(1, lerp(lg * .8, -1.5 * side, reach));
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, -15.6, 1.9, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8dcc8'; ctx.beginPath(); ctx.moveTo(-1.2, -16.8); ctx.lineTo(-2.2, -19.2); ctx.lineTo(-.5, -17.3); ctx.fill(); ctx.beginPath(); ctx.moveTo(1.2, -16.8); ctx.lineTo(2.2, -19.2); ctx.lineTo(.5, -17.3); ctx.fill();
  ctx.fillStyle = eye; ctx.beginPath(); ctx.arc(-.65 + side * .4, -15.8, .36, 0, 7); ctx.arc(.65 + side * .4, -15.8, .36, 0, 7); ctx.fill();
  ctx.restore();
}

/* ---------- "2D": side view, forward = right, lateral position = depth on screen ---------- */
function drawRun2D(run, t, dt) {
  const c = runColors(run), p = run.p;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const { k, kl, kh, px0, yc } = geo2D();     // px per metre: forward, lateral, height
  const X = s => px0 + (s - p.s) * k, Yg = x => yc + x * kl, sMin = p.s - px0 / k - 2, sMax = p.s + (cw - px0) / k + 2;
  // sky + parallax hills
  let g = ctx.createLinearGradient(0, 0, 0, ch); g.addColorStop(0, c.sky[0]); g.addColorStop(.45, c.sky[1]); g.addColorStop(.62, c.sky[2]); ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = c.mtn; ctx.beginPath(); ctx.moveTo(0, yc - 5.6 * kl);
  for (let i = 0; i <= 24; i++) { const xx = i / 24 * cw, w = (i + p.s * k * .02 / cw * 24); ctx.lineTo(xx, yc - 5.6 * kl - (Math.sin(w * 1.7) * .5 + .5) * ch * .16 - (Math.sin(w * .63) * .5 + .5) * ch * .08); }
  ctx.lineTo(cw, yc - 5.6 * kl); ctx.fill();
  ctx.fillStyle = c.ground; ctx.fillRect(0, yc - 5.6 * kl, cw, ch);
  // far trees (tops above the road)
  for (let s = Math.floor(sMin / 7) * 7; s < sMax; s += 7) { const h = (Math.sin(s * 12.9898) * .5 + .5); const x = X(s + h * 3), y = yc - 6.5 * kl; ctx.fillStyle = c.trunk; ctx.fillRect(x - .2 * k, y - 1.2 * kh, .4 * k, 1.2 * kh); ctx.fillStyle = c.tree; ctx.beginPath(); ctx.moveTo(x - 1.6 * k, y - 1 * kh); ctx.lineTo(x, y - (4 + h * 2) * kh); ctx.lineTo(x + 1.6 * k, y - 1 * kh); ctx.fill(); }
  // chasms under bridge zones
  for (const b of run.bridges) if (b.s1 > sMin && b.s0 < sMax) { ctx.fillStyle = c.lava ? '#7a1a08' : '#0a0716'; ctx.fillRect(X(b.s0), yc - 5.6 * kl, (b.s1 - b.s0) * k + 1, ch); }
  // road
  for (const [a, b] of run.roads) {
    if (b < sMin || a > sMax) continue;
    const x0 = X(Math.max(a, sMin)), x1 = X(Math.min(b, sMax));
    ctx.fillStyle = c.road; ctx.fillRect(x0, Yg(-5), x1 - x0, 10 * kl);
    ctx.fillStyle = c.roadDark; ctx.fillRect(x0, Yg(5), x1 - x0, .8 * kh);
    ctx.strokeStyle = c.roadDark; ctx.lineWidth = Math.max(1, k * .05); ctx.beginPath();
    for (let s = Math.ceil(Math.max(a, sMin) / 2) * 2; s < Math.min(b, sMax); s += 2) { ctx.moveTo(X(s), Yg(-5)); ctx.lineTo(X(s), Yg(5)); }
    ctx.stroke();
    ctx.fillStyle = c.edge; ctx.fillRect(x0, Yg(-5) - 2, x1 - x0, 3); ctx.fillRect(x0, Yg(5) - 1, x1 - x0, 3);
  }
  for (const b of run.bridges) { if (b.s1 < sMin || b.s0 > sMax) continue; const y0 = Yg(b.cx - b.w / 2), y1 = Yg(b.cx + b.w / 2); ctx.fillStyle = c.road; ctx.fillRect(X(b.s0), y0, (b.s1 - b.s0) * k, y1 - y0); ctx.fillStyle = c.roadDark; ctx.fillRect(X(b.s0), y1, (b.s1 - b.s0) * k, .8 * kh); ctx.fillStyle = c.edge; ctx.fillRect(X(b.s0), y0 - 1, (b.s1 - b.s0) * k, 2); ctx.fillRect(X(b.s0), y1 - 1, (b.s1 - b.s0) * k, 2); }
  for (const gp of run.gaps) { if (gp.s1 < sMin || gp.s0 > sMax) continue; ctx.fillStyle = c.lava ? '#ff5a14' : '#05030a'; ctx.fillRect(X(gp.s0), Yg(-5) - 1, (gp.s1 - gp.s0) * k, 10 * kl + .8 * kh + 2); }
  // checkpoints + goal portal
  for (const ck of run.arches) if (ck > sMin && ck < sMax) { ctx.strokeStyle = c.edge; ctx.lineWidth = k * .25; ctx.beginPath(); ctx.moveTo(X(ck), Yg(-5)); ctx.lineTo(X(ck), Yg(-5) - 5.4 * kh); ctx.lineTo(X(ck) + .01, Yg(5) - 5.4 * kh); ctx.lineTo(X(ck), Yg(5)); ctx.stroke(); }
  // collect drawables sorted far-to-near by lateral position
  const items = [];
  for (const o of run.obs) {
    if (o.type === 'gap' || o.s1 < sMin || o.s0 > sMax) continue;
    let x0 = o.x0, x1 = o.x1; if (o.type === 'mover') { const m = moverC(run, o); x0 = m - o.w / 2; x1 = m + o.w / 2; }
    items.push({ z: x1, f: () => drawBox2D(o, x0, x1) });
  }
  for (const q of run.picks) if (!q.got && q.s > sMin && q.s < sMax) items.push({ z: q.x + .1, f: () => drawPick2D(X(q.s), Yg(q.x) - q.y * kh, k, q.k, t) });
  const gap = run.gapNow(), reach = clamp(1 - (gap - 3) / 9, 0, 1), n = Math.min(run.def.giants, GFX.giants);
  for (let i = n - 1; i >= 0; i--) { const f = run.form2[i], s = run.gS - f.z, gx = i === 0 ? p.x * .6 : f.x; if (s < sMin - 12 || s > sMax) continue; items.push({ z: gx - 30, f: () => drawGiant2D(X(s), Yg(gx), kh * .55 * f.k, run.gPhase + f.ph, c.giant, c.eye, i === 0 ? reach : 0, 1) }); }
  for (const r of run.rivals || []) if ((r.state === 'run' || r.state === 'fall') && r.s > sMin && r.s < sMax) items.push({ z: r.x + .2, f: () => drawRival2D(r, X(r.s), Yg(r.x) - Math.max(-3, r.y) * kh, k * 1.45 / 38, t) });
  items.push({ z: p.x + .2, f: () => {
    if (run.state === 'dead' && run.cause === 'caught') return;
    const sx = px0, gy = Yg(p.x), hy = gy - Math.max(-3, p.y) * kh;
    if (run.supportAt(p.s, p.x) && !p.falling) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(sx, gy, .55 * k / (1 + Math.max(0, p.y) * .3), .2 * k, 0, 0, 7); ctx.fill(); }
    if (p.inv > 0 && Math.floor(t * 20) % 2) return;
    ctx.save(); ctx.translate(sx, hy); const s2 = k * 1.45 / 38; ctx.scale(s2 * p.sq ** -.3, s2 * p.sq); drawHero(t, 1, p.ground, run.state === 'run' ? 300 : 0, p.vy * 30, p.phase * 2.2, 1, false); ctx.restore();
    if (p.shield) { ctx.strokeStyle = 'rgba(120,190,255,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, hy - .8 * kh, 1.1 * k, 0, 7); ctx.stroke(); }
  } });
  items.sort((a, b) => a.z - b.z); for (const it of items) it.f();
  // goal portal
  if (run.len < sMax + 10) { const gx = X(run.len), gy = Yg(0); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .7; ctx.drawImage(TEX.gDoor, gx - 5 * k, gy - 9 * kh, 10 * k, 10 * kh); ctx.restore(); ctx.strokeStyle = PAL.door; ctx.lineWidth = k * .4; ctx.beginPath(); ctx.ellipse(gx, gy - 4.2 * kh, 1.2 * k, 4.2 * kh, 0, 0, 7); ctx.stroke(); }
  // off-screen giants indicator
  // foreground: bushes and rocks sliding past faster than the road (parallax), filling the lower screen
  { const fy = Yg(5) + .8 * kh + 4, step = 6;
    g = ctx.createLinearGradient(0, fy, 0, ch); g.addColorStop(0, c.groundDark); g.addColorStop(1, mixHex(c.ground, '#000000', .45)); ctx.fillStyle = g; ctx.fillRect(0, fy, cw, ch - fy);
    for (let s = Math.floor((p.s * 1.35 - 10) / step) * step; s < p.s * 1.35 + cw / k + 10; s += step) {
      const h = Math.sin(s * 7.31) * .5 + .5, x = px0 + (s - p.s * 1.35) * k, y = fy + (.25 + h * .55) * (ch - fy);
      if (h > .55) { ctx.fillStyle = c.tree; ctx.beginPath(); ctx.ellipse(x, y, (1.4 + h) * k, (.8 + h * .6) * k, 0, Math.PI, 0); ctx.fill(); }
      else { ctx.fillStyle = mixHex(c.ground, '#ffffff', .1); ctx.beginPath(); ctx.ellipse(x, y, (.6 + h) * k, (.4 + h * .4) * k, 0, Math.PI, 0); ctx.fill(); }
    } }
  const gs = X(run.gS); if (gs < 0) { ctx.fillStyle = 'rgba(255,61,113,.9)'; ctx.beginPath(); ctx.moveTo(8 * dpr, yc); ctx.lineTo(26 * dpr, yc - 14 * dpr); ctx.lineTo(26 * dpr, yc + 14 * dpr); ctx.fill(); }
  CAMX = 0; drawWeather2D(null, t, dt, 0, 0);
  runOverlays(run, t);
}
const geo2D = () => { const k = clamp(Math.min(cw / 56, ch / 24), 8, 60); return { k, kl: k * .5, kh: k * .82, px0: cw * .44, yc: ch * .56 }; };
function drawBox2D(o, x0, x1) {
  const run = app.run, c = run.c2, p = run.p, { k, kl, kh, px0, yc } = geo2D();
  const X = s => px0 + (s - p.s) * k, Yg = x => yc + x * kl;
  if (X3[o.type]) return drawX3Side(o, X, Yg, k, kh, c, run.time);
  const a = X(o.s0), b = Math.max(X(o.s1), a + k * .5), h = o.y1 * kh;
  const top = fill => { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(a, Yg(x0) - h); ctx.lineTo(b, Yg(x0) - h); ctx.lineTo(b, Yg(x1) - h); ctx.lineTo(a, Yg(x1) - h); ctx.fill(); };
  if (o.type === 'wall' || o.type === 'mover') {
    top(c.wallTop); ctx.fillStyle = c.wall; ctx.fillRect(a, Yg(x1) - h, b - a, h);
    ctx.fillStyle = o.type === 'mover' ? '#ffd36e' : '#ff5d8a'; ctx.fillRect(a, Yg(x1) - h, b - a, Math.max(2, k * .12));
  } else if (o.type === 'bar') {
    const y = Yg(x1); ctx.fillStyle = '#2a2540'; ctx.fillRect(a, y - h, k * .2, h);
    top(mixHex(c.obst, '#ffffff', .3)); ctx.fillStyle = c.obst; ctx.fillRect(a, y - h, b - a, h * .4);
  } else if (o.type === 'spikes') {
    ctx.fillStyle = c.hazard; const n = Math.max(2, Math.round((x1 - x0) * 1.4));
    for (let i = 0; i < n; i++) { const yy = Yg(x0 + (x1 - x0) * (i + .5) / n); for (let j = 0; j < 3; j++) { const xx = a + (b - a) * (j + .5) / 3; ctx.beginPath(); ctx.moveTo(xx - k * .25, yy); ctx.lineTo(xx, yy - h); ctx.lineTo(xx + k * .25, yy); ctx.fill(); } }
  } else if (o.type === 'roller') {
    top('#9a6a3a'); ctx.fillStyle = '#7a4a2a'; ctx.fillRect(a, Yg(x1) - h, b - a, h);
    ctx.fillStyle = '#5a321a'; ctx.beginPath(); ctx.ellipse((a + b) / 2, Yg(x1) - h / 2, (b - a) / 2, h / 2, 0, 0, 7); ctx.fill();
  }
}
function drawPick2D(x, y, k, kind, t) {
  const r = k * (kind === 'gem' ? .32 : .5), bob = Math.sin(t * 3 + x * .01) * k * .12;
  if (kind === 'gem') { ctx.fillStyle = '#7af7ff'; ctx.beginPath(); ctx.moveTo(x, y - r * 1.4 + bob); ctx.lineTo(x + r, y + bob); ctx.lineTo(x, y + r * 1.4 + bob); ctx.lineTo(x - r, y + bob); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x - r * .2, y - r * .6 + bob, r * .3, r * .5); return; }
  const col = { shield: '#4aa8ff', boost: '#ffd36e', freeze: '#9ef9ff' }[kind], ic = { shield: '🛡', boost: '⚡', freeze: '❄' }[kind];
  ctx.fillStyle = rgbaHex(col, .35); ctx.beginPath(); ctx.arc(x, y + bob, r * 1.6, 0, 7); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y + bob, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#10142a'; ctx.font = `${Math.round(r * 1.3)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ic, x, y + bob + 1);
}
function runOverlays(run, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (run.flash > 0) { ctx.fillStyle = `rgba(255,40,80,${run.flash * .25})`; ctx.fillRect(0, 0, cw, ch); }
  if (run.freezeT > 0) { ctx.fillStyle = `rgba(160,240,255,${Math.min(.18, run.freezeT * .08)})`; ctx.fillRect(0, 0, cw, ch); }
  if (run.state === 'intro') { const a = clamp(run.introT / run.introMax, 0, 1); ctx.fillStyle = `rgba(7,5,26,${a * .5})`; ctx.fillRect(0, 0, cw, ch); }
  drawTransition();
}

/* ---------- "2D that imitates 3D": pseudo-3D road with projected sprites + rear-view mirror ---------- */
function drawRunPseudo(run, t, dt) {
  const c = runColors(run), p = run.p;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const shk = run.shake * .5 * (CFG.shake / 100);
  const intro = run.state === 'intro' ? clamp(run.introT / run.introMax, 0, 1) : 0;
  const cam = { x: p.x * .55 + (Math.random() - .5) * shk * .05, y: 3.3 + Math.max(0, p.y) * .35 + intro * 3, s: p.s - 6.6 - intro * 6, hz: ch * (.42 - intro * .06), f: ch * .95, cx: cw / 2 + (Math.random() - .5) * shk };
  pseudoScene(run, c, cam, 0, 0, cw, ch, t, false);
  // rear-view mirror drawn on the canvas, framed by the HUD mirror box
  if (GFX.mir && run.state !== 'intro' && !mutScr()) {
    const m = run.mirrorRect && run.mirrorRect.call(run); const el = $('mirror');
    if (m) { const mx = m.x * dpr, my = m.y * dpr, mw = m.w * dpr, mh = m.h * dpr;
      ctx.save(); ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
      pseudoScene(run, c, { x: p.x * .5, y: 3.0, s: p.s + 2.5, hz: my + mh * .62, f: mh * 1.1, cx: mx + mw / 2, back: true }, mx, my, mw, mh, t, true);
      ctx.restore(); }
    if (el.classList.contains('hide')) el.classList.remove('hide');
  }
  CAMX = 0; drawWeather2D(null, t, dt, 0, 0);
  runOverlays(run, t);
}
function pseudoScene(run, c, cam, rx, ry, rw, rh, t, back) {
  const p = run.p, dir = back ? -1 : 1;
  const proj = (x, y, s) => { const dz = (s - cam.s) * dir; if (dz < .4) return null; const k = cam.f / dz; return [cam.cx + (x - cam.x) * k * dir, cam.hz + (cam.y - y) * k, k]; };
  // sky & horizon
  let g = ctx.createLinearGradient(0, ry, 0, cam.hz); g.addColorStop(0, c.sky[0]); g.addColorStop(.7, c.sky[1]); g.addColorStop(1, c.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(rx, ry, rw, cam.hz - ry + 1);
  ctx.fillStyle = c.mtn; ctx.beginPath(); ctx.moveTo(rx, cam.hz);
  const off = (p.x * 4 + (back ? 500 : 0));
  for (let i = 0; i <= 20; i++) { const xx = rx + i / 20 * rw, w = i * .9 + off * .01; ctx.lineTo(xx, cam.hz - (Math.sin(w * 1.3) * .5 + .5) * rh * .1 - (Math.sin(w * .41 + 2) * .5 + .5) * rh * .06); }
  ctx.lineTo(rx + rw, cam.hz); ctx.fill();
  ctx.fillStyle = c.ground; ctx.fillRect(rx, cam.hz, rw, ry + rh - cam.hz);
  // road strips from far to near
  const far = back ? 70 : 170, ds = 1.6;
  const s0 = back ? cam.s - far : cam.s + .5;
  const sA = back ? cam.s - .5 : cam.s + far;
  for (let i = 0, n = Math.ceil(far / ds); i < n; i++) {
    const sa = back ? s0 + i * ds : sA - (i + 1) * ds, sb = sa + ds;
    const near = back ? sb : sa, farS = back ? sa : sb;
    const A = proj(0, 0, near), B = proj(0, 0, farS); if (!A || !B) continue;
    const band = Math.floor((sa + 1000) / 4) % 2;
    // ground band shading for speed feel
    if (band) { ctx.fillStyle = c.groundDark; ctx.fillRect(rx, B[1], rw, A[1] - B[1] + 1); }
    const mid = (sa + sb) / 2;
    let x0, x1, col = band ? c.road : c.roadLite;
    if (run.roadAt(mid)) { x0 = -5; x1 = 5; }
    else { const b = run.bridgeAt(mid); if (b) { x0 = b.cx - b.w / 2; x1 = b.cx + b.w / 2; ctx.fillStyle = c.lava ? '#5a1406' : '#0a0716'; ctx.fillRect(rx, B[1], rw, A[1] - B[1] + 1); } else { const a0 = proj(-5, 0, near), a1 = proj(5, 0, near), b0 = proj(-5, 0, farS), b1 = proj(5, 0, farS); if (a0 && b0) { ctx.fillStyle = c.lava ? '#ff5a14' : '#05030a'; quad4(a0, a1, b1, b0); } continue; } }
    const a0 = proj(x0, 0, near), a1 = proj(x1, 0, near), b0 = proj(x0, 0, farS), b1 = proj(x1, 0, farS);
    ctx.fillStyle = col; quad4(a0, a1, b1, b0);
    const e0 = proj(x0 - .2, 0, near), e1 = proj(x1 + .2, 0, near), f0 = proj(x0 - .2, 0, farS), f1 = proj(x1 + .2, 0, farS);
    ctx.fillStyle = c.edge; quad4(e0, a0, b0, f0); quad4(a1, e1, f1, b1);
  }
  // fog towards the horizon
  g = ctx.createLinearGradient(0, cam.hz - rh * .05, 0, cam.hz + rh * .18); g.addColorStop(0, rgbaHex(c.fog, .85)); g.addColorStop(1, rgbaHex(c.fog, 0));
  ctx.fillStyle = g; ctx.fillRect(rx, cam.hz - rh * .05, rw, rh * .23);
  // sprites far → near
  const items = [], inRange = s => back ? (s < cam.s - .4 && s > cam.s - far) : (s > cam.s + .4 && s < cam.s + far);
  if (!back) {
    for (const o of run.obs) { if (o.type === 'gap' || !inRange(o.s0)) continue; let x0 = o.x0, x1 = o.x1; if (o.type === 'mover') { const m = moverC(run, o); x0 = m - o.w / 2; x1 = m + o.w / 2; } items.push({ d: o.s0, f: () => pseudoBox(o, x0, x1, proj, c, cam) }); }
    for (const q of run.picks) if (!q.got && inRange(q.s)) items.push({ d: q.s, f: () => { const P = proj(q.x, q.y, q.s); if (P) drawPick2D(P[0], P[1], P[2], q.k, t); } });
    for (let s = Math.ceil(cam.s / 9) * 9; s < cam.s + far; s += 9) { const h = Math.sin(s * 12.9898) * .5 + .5; for (const side of [-1, 1]) { const xx = side * (9 + h * 14); items.push({ d: s, f: () => { const P = proj(xx, 0, s); if (!P) return; const k = P[2]; ctx.fillStyle = c.trunk; ctx.fillRect(P[0] - .3 * k, P[1] - 2 * k, .6 * k, 2 * k); ctx.fillStyle = c.tree; ctx.beginPath(); ctx.moveTo(P[0] - 2 * k, P[1] - 1.6 * k); ctx.lineTo(P[0], P[1] - (6 + h * 3) * k); ctx.lineTo(P[0] + 2 * k, P[1] - 1.6 * k); ctx.fill(); } }); } }
    for (const ck of run.arches) if (inRange(ck)) items.push({ d: ck, f: () => { const L = proj(-5.4, 0, ck), R = proj(5.4, 0, ck); if (!L) return; ctx.strokeStyle = c.edge; ctx.lineWidth = Math.max(2, L[2] * .3); ctx.beginPath(); ctx.moveTo(L[0], L[1]); ctx.lineTo(L[0], L[1] - 5.4 * L[2]); ctx.lineTo(R[0], R[1] - 5.4 * R[2]); ctx.lineTo(R[0], R[1]); ctx.stroke(); } });
    if (inRange(run.len)) items.push({ d: run.len, f: () => { const P = proj(0, 4.2, run.len); if (!P) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(TEX.gDoor, P[0] - 9 * P[2], P[1] - 9 * P[2], 18 * P[2], 18 * P[2]); ctx.restore(); ctx.strokeStyle = PAL.door; ctx.lineWidth = .5 * P[2]; ctx.beginPath(); ctx.arc(P[0], P[1], 4.2 * P[2], 0, 7); ctx.stroke(); } });
  }
  const gap = run.gapNow(), reach = clamp(1 - (gap - 3) / 9, 0, 1), n = Math.min(run.def.giants, GFX.giants);
  for (let i = 0; i < n; i++) { const f = run.form2[i], s = run.gS - f.z, gx = i === 0 ? p.x * .6 : f.x; if (!inRange(s)) continue; items.push({ d: s, f: () => { const P = proj(gx, 0, s); if (P) drawGiant2D(P[0], P[1], P[2] * f.k, run.gPhase + f.ph, c.giant, c.eye, i === 0 ? reach : 0, -dir); } }); }
  if (!back) for (const r of run.rivals || []) if ((r.state === 'run' || r.state === 'fall') && inRange(r.s)) items.push({ d: r.s, f: () => { const P = proj(r.x, Math.max(-3, r.y), r.s); if (P) drawRival2D(r, P[0], P[1], P[2] * 1.5 / 38, t); } });
  if (!back && !(run.state === 'dead' && run.cause === 'caught')) items.push({ d: p.s, f: () => {
    const G = proj(p.x, 0, p.s), P = proj(p.x, Math.max(-3, p.y), p.s); if (!P) return;
    if (run.supportAt(p.s, p.x) && !p.falling) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(G[0], G[1], .6 * G[2], .22 * G[2], 0, 0, 7); ctx.fill(); }
    if (p.inv > 0 && Math.floor(t * 20) % 2) return;
    ctx.save(); ctx.translate(P[0], P[1]); const s2 = P[2] * 1.5 / 38; ctx.scale(s2, s2 * p.sq); drawHero(t, 1, p.ground, run.state === 'run' ? 300 : 0, p.vy * 30, p.phase * 2.2, 1, false); ctx.restore();
    if (p.shield) { ctx.strokeStyle = 'rgba(120,190,255,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(P[0], P[1] - .8 * P[2], 1.2 * P[2], 0, 7); ctx.stroke(); }
  } });
  items.sort((a, b) => back ? a.d - b.d : b.d - a.d); for (const it of items) it.f();
}
function quad4(a, b, c2, d) { if (!a || !b || !c2 || !d) return; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill(); }
function pseudoBox(o, x0, x1, proj, c, cam) {
  if (X3[o.type]) return drawX3Pseudo(o, proj, c, cam, app.run.time);
  const y1 = o.y1, s0 = o.s0, s1 = Math.max(o.s1, o.s0 + .3);
  const f00 = proj(x0, 0, s0), f10 = proj(x1, 0, s0), f11 = proj(x1, y1, s0), f01 = proj(x0, y1, s0);
  if (!f00 || !f10) return;
  const b01 = proj(x0, y1, s1), b11 = proj(x1, y1, s1), b00 = proj(x0, 0, s1), b10 = proj(x1, 0, s1);
  if (o.type === 'spikes') { ctx.fillStyle = c.hazard; const n = Math.max(2, Math.round((x1 - x0) / .55)); for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) { const P = proj(x0 + (i + .5) * (x1 - x0) / n, 0, s0 + j * .65 + .3); if (!P) continue; const k = P[2]; ctx.beginPath(); ctx.moveTo(P[0] - .22 * k, P[1]); ctx.lineTo(P[0], P[1] - .7 * k); ctx.lineTo(P[0] + .22 * k, P[1]); ctx.fill(); } return; }
  const front = o.type === 'bar' ? c.obst : o.type === 'roller' ? '#7a4a2a' : c.wall, topC = o.type === 'bar' ? mixHex(c.obst, '#ffffff', .3) : o.type === 'roller' ? '#9a6a3a' : c.wallTop, sideC = mixHex(front, '#000000', .3);
  if (o.type === 'bar') { const k = f00[2]; ctx.fillStyle = '#2a2540'; ctx.fillRect(f00[0], f01[1], .22 * k, f00[1] - f01[1]); ctx.fillRect(f10[0] - .22 * k, f11[1], .22 * k, f10[1] - f11[1]); const by = f01[1] + (f00[1] - f01[1]) * .0, bh = (f00[1] - f01[1]) * .4; ctx.fillStyle = front; ctx.fillRect(f00[0], by, f10[0] - f00[0], bh); ctx.fillStyle = 'rgba(0,0,0,.35)'; const nS = 6; for (let i = 0; i < nS; i += 2) ctx.fillRect(f00[0] + (f10[0] - f00[0]) * i / nS, by, (f10[0] - f00[0]) / nS, bh); return; }
  if (cam.y > y1 && b01) { ctx.fillStyle = topC; quad4(f01, f11, b11, b01); }
  if (cam.x < x0 && b00) { ctx.fillStyle = sideC; quad4(f00, f01, b01, b00); }
  if (cam.x > x1 && b10) { ctx.fillStyle = sideC; quad4(f10, f11, b11, b10); }
  ctx.fillStyle = front; quad4(f00, f10, f11, f01);
  if (o.type === 'wall' || o.type === 'mover') { ctx.fillStyle = o.type === 'mover' ? '#ffd36e' : '#ff5d8a'; ctx.fillRect(f01[0], f01[1], f11[0] - f01[0], Math.max(2, f00[2] * .12)); }
}
