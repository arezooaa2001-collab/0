/* ============================ ATMOSPHERE & HERO LIFE (2D views) ============================ */
// Ambient particles that fit the level's look (embers, snow, fireflies, petals, leaves, bubbles, spores, sand, sparks,
// crystal glints), soft light shafts, a shadow under the hero, and the hero's face: the eyes watch the nearest trap,
// it gets scared next to one, smiles at gems, wobbles at ledges and falls asleep when you leave it alone.
const AMB = { kind: null, ps: [] };
function ambKind() {
  const b = BIOME; if (!b || realmMode) return 'motes';
  if (b.top === 'embers' || b.scen === 'volcano') return 'embers';
  if (b.top === 'snow' || b.bs === 'iceblock') return 'snow';
  if (b.top === 'petals' || b.scen === 'sakura') return 'petals';
  if (b.top === 'leaves') return 'leaves';
  if (b.scen === 'waves') return 'bubbles';
  if (b.top === 'slime' || b.scen === 'mushrooms' || b.scen === 'swamp') return 'spores';
  if (b.scen === 'dunes' || b.scen === 'pyramids') return 'sand';
  if (b.scen === 'factory' || b.scen === 'city' || b.scen === 'domes' || b.top === 'neon' || b.top === 'hazard') return 'sparks';
  if (b.scen === 'crystals' || b.top === 'crystal') return 'glints';
  if (b.scen === 'forest' || b.scen === 'jungle' || b.scen === 'hills') return 'fireflies';
  return 'motes';
}
function ambReset(kind) {
  AMB.kind = kind; AMB.ps = Array.from({ length: 120 }, (_, i) => ambNew(kind, true, i));
}
function ambNew(k, any, i) {
  const r = Math.random, span = W + 400;
  const q = { x: r() * span - 200, y: any ? r() * H : (k === 'embers' || k === 'bubbles' || k === 'spores' ? H + 20 : -20), ph: r() * 7, s: .6 + r() * .9, rot: r() * 7, i };
  if (k === 'embers') { q.vy = -(30 + r() * 50); q.vx = (r() - .5) * 20; q.col = r() < .5 ? '#ff8a3d' : '#ffd36e'; }
  else if (k === 'snow') { q.vy = 18 + r() * 34; q.vx = -6 + r() * 12; }
  else if (k === 'petals') { q.vy = 22 + r() * 26; q.vx = 10 + r() * 20; q.col = r() < .5 ? '#ffb0d8' : '#ffd6ea'; }
  else if (k === 'leaves') { q.vy = 30 + r() * 30; q.vx = 6 + r() * 26; q.col = ['#ff9a3a', '#e8642a', '#ffc44a', '#b8552a'][(r() * 4) | 0]; }
  else if (k === 'bubbles') { q.vy = -(18 + r() * 36); q.vx = 0; }
  else if (k === 'spores') { q.vy = -(4 + r() * 10); q.vx = (r() - .5) * 8; q.col = r() < .6 ? '#c6ff3a' : '#7af7c8'; }
  else if (k === 'sand') { q.vx = 90 + r() * 120; q.vy = (r() - .5) * 10; }
  else if (k === 'sparks') { q.vy = 140 + r() * 160; q.vx = (r() - .5) * 60; q.col = r() < .5 ? '#ffd36e' : '#7af7ff'; q.life = r() * 1.5; }
  else if (k === 'fireflies') { q.vx = 0; q.vy = 0; q.cx = q.x; q.cy = H * (.25 + r() * .5); }
  return q;
}
// replaces the plain drifting dust for most looks
function drawAmbient(t, dt, n) {
  const k = ambKind(); if (k !== AMB.kind) ambReset(k);
  const span = W + 400, par = k === 'sand' ? .9 : k === 'fireflies' ? .55 : .4, off = CAMX * par, gk = glowK() > 0;
  ctx.save(); ctx.setTransform(S, 0, 0, S, OX, OY);
  for (let j = 0; j < n && j < AMB.ps.length; j++) {
    const q = AMB.ps[j];
    q.ph += dt;
    if (k === 'fireflies') { q.x = q.cx + Math.sin(q.ph * .7 + q.i) * 60; q.y = q.cy + Math.sin(q.ph * 1.1 + q.i * 2) * 40; }
    else { q.x += (q.vx + (k === 'snow' || k === 'petals' || k === 'leaves' ? Math.sin(q.ph * 1.6 + q.i) * 22 : 0)) * dt; q.y += q.vy * dt; q.rot += dt * (k === 'leaves' ? 2.4 : 1.4); }
    if (k === 'sparks') { q.life -= dt; if (q.life <= 0 || q.y > H + 20) Object.assign(q, ambNew(k, false, q.i), { y: Math.random() * H * .4, life: .4 + Math.random() * .9 }); }
    else if (q.y < -30 || q.y > H + 30) Object.assign(q, ambNew(k, false, q.i));
    const x = ((q.x - off) % span + span) % span - 200, y = q.y; if (x < -EXT.l - 20 || x > W + EXT.r + 20) continue;
    if (k === 'embers') { const f = .6 + Math.sin(q.ph * 9 + q.i) * .4; ctx.globalAlpha = f; if (gk) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(TEX.gGold, x - 8 * q.s, y - 8 * q.s, 16 * q.s, 16 * q.s); ctx.globalCompositeOperation = 'source-over'; } ctx.fillStyle = q.col; ctx.fillRect(x - 1.2 * q.s, y - 1.2 * q.s, 2.4 * q.s, 2.4 * q.s); }
    else if (k === 'snow') { ctx.globalAlpha = .85; ctx.fillStyle = '#f4fbff'; ctx.beginPath(); ctx.arc(x, y, 1.6 * q.s + .6, 0, 7); ctx.fill(); }
    else if (k === 'petals' || k === 'leaves') { ctx.globalAlpha = .9; ctx.fillStyle = q.col; ctx.save(); ctx.translate(x, y); ctx.rotate(q.rot); ctx.scale(1, Math.abs(Math.sin(q.rot * .7)) * .7 + .3); ctx.beginPath(); ctx.ellipse(0, 0, (k === 'leaves' ? 5 : 4) * q.s, (k === 'leaves' ? 2.6 : 2.2) * q.s, 0, 0, 7); ctx.fill(); if (k === 'leaves') { ctx.strokeStyle = 'rgba(60,20,10,.5)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-5 * q.s, 0); ctx.lineTo(5 * q.s, 0); ctx.stroke(); } ctx.restore(); }
    else if (k === 'bubbles') { ctx.globalAlpha = .55; ctx.strokeStyle = '#bff8ff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x + Math.sin(q.ph * 2 + q.i) * 3, y, 2 + 3 * q.s, 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(x - 1, y - 2 * q.s, 1.5, 1.5); }
    else if (k === 'spores') { ctx.globalAlpha = .5 + Math.sin(q.ph * 2 + q.i) * .3; if (gk) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(TEX.gMint, x - 7, y - 7, 14, 14); ctx.globalCompositeOperation = 'source-over'; } ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(x, y, 1.4 * q.s, 0, 7); ctx.fill(); }
    else if (k === 'sand') { ctx.globalAlpha = .35; ctx.fillStyle = '#ffe0a0'; ctx.fillRect(x, y, 3 * q.s, 1); }
    else if (k === 'sparks') { ctx.globalAlpha = Math.min(1, q.life * 2); ctx.strokeStyle = q.col; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - q.vx * .03, y - q.vy * .03); ctx.stroke(); }
    else if (k === 'fireflies') { const b = Math.max(0, Math.sin(q.ph * 2.2 + q.i * 1.7)); ctx.globalAlpha = b; if (gk) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(TEX.gMint, x - 12, y - 12, 24, 24); ctx.globalCompositeOperation = 'source-over'; } ctx.fillStyle = '#e8ff8a'; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 7); ctx.fill(); }
    else if (k === 'glints') { const b = Math.max(0, Math.sin(q.ph * 1.5 + q.i * 2.3)) ** 3; if (b < .05) continue; ctx.globalAlpha = b; ctx.fillStyle = '#e8d8ff'; const s = 5 * q.s * b; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * .25, y - s * .25); ctx.lineTo(x + s, y); ctx.lineTo(x + s * .25, y + s * .25); ctx.lineTo(x, y + s); ctx.lineTo(x - s * .25, y + s * .25); ctx.lineTo(x - s, y); ctx.lineTo(x - s * .25, y - s * .25); ctx.closePath(); ctx.fill(); }
  }
  ctx.restore();
}
// soft slanted light shafts from the sky (sunny and leafy looks)
function drawRays(t) {
  const b = BIOME; if (!b || glowK() <= 0 || realmMode || !(b.cel === 'sun' || ['forest', 'jungle', 'waves', 'sakura', 'hills', 'islands'].includes(b.scen))) return;
  ctx.save(); ctx.setTransform(S, 0, 0, S, OX, OY); ctx.globalCompositeOperation = 'lighter';
  const col = b.scen === 'waves' ? '160,240,255' : '255,240,200', off = -CAMX * .08;
  for (let i = 0; i < 4; i++) {
    const x = ((i * 380 + off) % (W + 600) + W + 600) % (W + 600) - 300 + Math.sin(t * .2 + i) * 40, w = 90 + i * 25, a = .05 + Math.sin(t * .5 + i * 1.7) * .025;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(${col},${(a * 1.6).toFixed(3)})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, -EXT.t); ctx.lineTo(x + w, -EXT.t); ctx.lineTo(x + w + 260, H); ctx.lineTo(x + 260, H); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// a soft shadow on the floor under the hero (or on the ceiling when gravity is flipped)
function drawHeroShadow(world) {
  const p = world.p; if (world.state === 'dead' || world.state === 'win') return;
  const cx = p.x + PW / 2, g = p.g, foot = g > 0 ? p.y + PHT : p.y; let best = null;
  for (const e of VIEW_ENTS) {
    if (e.type !== 'block' || e.hidden || e.gone || e.ghost || e.lava || e.off) continue;
    if (cx < e.x || cx > e.x + e.w) continue;
    const top = g > 0 ? e.y : e.y + e.h, d = g > 0 ? top - foot : foot - top;
    if (d >= -2 && d < 320 && (best == null || d < best.d)) best = { d, top };
  }
  if (!best) return;
  const k = 1 - best.d / 320; ctx.save(); ctx.globalAlpha = .32 * k; ctx.fillStyle = '#05030e';
  ctx.beginPath(); ctx.ellipse(cx, best.top + (g > 0 ? 1 : -1), 15 * (.45 + .55 * k), 4 * (.5 + .5 * k), 0, 0, 7); ctx.fill(); ctx.restore();
}
// the hero's mood and where it looks (set just before the player is drawn, read by drawHero)
let HERO_FX = null;
const HFX = { still: 0, lastT: 0, zT: 0 };
function heroMood(world, t) {
  const p = world.p, cx = p.x + PW / 2, cy = p.y + PHT / 2; let near = null, nd = 1e9;
  for (const e of VIEW_ENTS) {
    if (e.gone || e.hidden) continue;
    let x, y;
    if (e.type === 'saw') { x = e.x; y = e.y; }
    else if ((e.type === 'spike' && e.pop > .6 && !e.fake && !e.off) || (e.type === 'laser' && e.act) || e.type === 'boss' || (e.type === 'block' && e.lava)) { x = clamp(cx, e.x, e.x + e.w); y = clamp(cy, e.y, e.y + e.h); }
    else continue;
    const d = Math.hypot(x - cx, y - cy); if (d < nd) { nd = d; near = [x, y]; }
  }
  const dt = Math.min(.1, Math.max(0, t - HFX.lastT)); HFX.lastT = t;
  const moving = Math.abs(p.vx) > 20 || !p.onGround; HFX.still = moving || world.state !== 'play' ? 0 : HFX.still + dt;
  const fx = { lx: 0, ly: 0, mood: null };
  if (near && nd < 180) { fx.lx = clamp((near[0] - cx) / Math.max(1, nd), -1, 1); fx.ly = clamp((near[1] - cy) / Math.max(1, nd), -1, 1) * p.g; if (nd < 95) fx.mood = 'scared'; }
  if (world.combo && world.time - world.combo.t < .6) fx.mood = 'happy';
  // standing right at the edge of a ledge
  const gr = p.ground;
  if (!fx.mood && p.onGround && gr && Math.abs(p.vx) < 30 && p.g > 0) { const tip = cx + p.face * 13; if (tip < gr.x - 2 || tip > gr.x + gr.w + 2) fx.mood = 'teeter'; }
  if (!fx.mood && HFX.still > 7) { fx.mood = 'sleep'; HFX.zT -= dt; if (HFX.zT <= 0 && !world.silent) { HFX.zT = 1.1; world.parts.push({ x: cx + 8, y: p.y - 6, vx: 14, vy: -26, life: 1.4, max: 1.4, size: 0, col: '#cfd8ff', g: 0, drag: 0, txt: 'z' }); } }
  if (p.starT > 0) fx.mood = 'happy';
  return fx;
}

/* ---------- grass that sways and bends away when the hero walks through it ---------- */
const GRASS_TOP = new Set(['grass', 'vines', 'leaves', 'petals']);
function drawGrass(world, t) {
  if (!BIOME || realmMode || !GRASS_TOP.has(BIOME.top) || GFX.fx < .8 || Perf.fxK < .7) return;
  const p = world.p, px = p.x + PW / 2, pf = p.y + PHT, x0 = CAMX - EXT.l - 20, x1 = CAMX + W + EXT.r + 20;
  ctx.save(); ctx.strokeStyle = BIOME.top === 'petals' ? mixHex(PAL.moss, '#5fbf6a', .6) : mixHex(PAL.moss, '#ffffff', .1); ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();
  for (const e of VIEW_ENTS) {
    if (e.type !== 'block' || e.hidden || e.ghost || e.lava || e.oneway || e.ceil || e.rock || e.tog != null || e.off || e.conv || e.bounce || e.ice || e.appear < 1 || e.y < 40 || e.w < 20 || e.falling) continue;
    const a = Math.max(e.x + 4, x0), b = Math.min(e.x + e.w - 4, x1), top = e.y + 1;
    for (let x = Math.ceil(a / 13) * 13; x < b; x += 13) {
      const hsh = Math.abs(Math.sin(x * 12.9898)) , h = 6 + hsh * 6;
      let bend = Math.sin(t * 2.2 + x * .07) * .22;
      const dx = x - px; if (Math.abs(dx) < 28 && Math.abs(pf - e.y) < 14) bend += Math.sign(dx || 1) * (1 - Math.abs(dx) / 28) * 1.1;
      for (const o of [-2, 2]) { const bb = bend + o * .08; ctx.moveTo(x + o, top); ctx.quadraticCurveTo(x + o + Math.sin(bb) * h * .5, top - h * .6, x + o + Math.sin(bb) * h, top - Math.cos(bb) * h); }
    }
  }
  ctx.stroke(); ctx.restore();
}
/* ---------- slow clouds in the sky ---------- */
function drawClouds(t) {
  const b = BIOME; if (!b || realmMode || GFX.fx < .6) return;
  ctx.save(); ctx.setTransform(S, 0, 0, S, OX, OY);
  const span = W + 600, off = CAMX * .06, col = mixHex(b.sky, '#ffffff', .55);
  ctx.fillStyle = col;
  for (let i = 0; i < 6; i++) {
    const x = ((i * 397 + t * (6 + i * 1.5) - off) % span + span) % span - 300, y = 60 + ((i * 61) % 170), s = .7 + (i % 3) * .3;
    ctx.globalAlpha = .07 + (i % 2) * .04;
    ctx.beginPath(); ctx.ellipse(x, y, 70 * s, 16 * s, 0, 0, 7); ctx.ellipse(x + 40 * s, y - 10 * s, 46 * s, 14 * s, 0, 0, 7); ctx.ellipse(x - 38 * s, y - 4 * s, 40 * s, 12 * s, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}
/* ---------- the hero breaks into pieces (the classic death) ---------- */
function heroPieces(world, cx, cy) {
  const [top, bot] = heroCols(world.time || 0), R = (a, b) => a + Math.random() * (b - a);
  const add = (piece, o) => world.parts.push(Object.assign({ x: cx, y: cy, vx: R(-220, 220), vy: R(-520, -260), life: 1.3, max: 1.3, size: 0, col: top, g: 1500, drag: .6, piece, vr: R(-9, 9), top, bot }, o));
  add('half', { vx: R(-260, -120), side: -1 }); add('half', { vx: R(120, 260), side: 1 });
  add('eye', { vx: R(-160, -40) }); add('eye', { vx: R(40, 160) }); add('leaf', { vy: R(-640, -420), col: PAL.moss });
}
function drawPiece(q) {
  if (q.piece === 'half') { const g = ctx.createLinearGradient(0, -12, 0, 12); g.addColorStop(0, q.top); g.addColorStop(1, q.bot); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 13, q.side < 0 ? Math.PI * .5 : -Math.PI * .5, q.side < 0 ? Math.PI * 1.5 : Math.PI * .5); ctx.closePath(); ctx.fill(); ctx.fillStyle = PAL.scarf; ctx.fillRect(q.side < 0 ? -13 : 0, 2, 13, 4); }
  else if (q.piece === 'eye') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, 4.3, 5.2, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#231536'; ctx.beginPath(); ctx.arc(1, 0, 2.3, 0, 7); ctx.fill(); }
  else if (q.piece === 'leaf') { ctx.fillStyle = q.col; ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.6, 0, 0, 7); ctx.fill(); ctx.strokeStyle = q.col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-11, 3); ctx.stroke(); }
}
/* ---------- a short zoom on big hits (the canvas is scaled by CSS, nothing has to be redrawn) ---------- */
let punchT = 0;
function punch(k) {
  if (CFG.shake === 0) return; const r = document.documentElement.style; r.setProperty('--pz', k.toFixed(3));
  clearTimeout(punchT); punchT = setTimeout(() => r.setProperty('--pz', '1'), 70);
}
