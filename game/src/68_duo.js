/* ============================ TWO PLAYERS (split screen) ============================ */
// Two people race through the same level on one device. Each player has a copy of the level (own traps, own
// checkpoints) and half of the screen; the first one through the door wins the round.
// Keyboard: left player A / D and W or Space, right player ← / → and ↑. Touch: three buttons on each side.
const DUO_COL = ['#ffd36e', '#7af7ff'], DUO_NAME = ['بازیکن ۱', 'بازیکن ۲'];
let duoScore = [0, 0];
const duoTouch = [{ left: false, right: false, jump: false }, { left: false, right: false, jump: false }];
function duoInput(k) {
  const t = duoTouch[k];
  return k === 0 ? { left: !!(keys.KeyA || t.left), right: !!(keys.KeyD || t.right), jump: !!(keys.KeyW || keys.Space || t.jump) }
    : { left: !!(keys.ArrowLeft || t.left), right: !!(keys.ArrowRight || t.right), jump: !!(keys.ArrowUp || keys.Enter || keys.NumpadEnter || t.jump) };
}
// both halves use the full height of the screen
function duoLayout() {
  S = ch / H; OY = 0; OX = 0;
  EXT = { l: cw / S, r: cw / S, t: 4, b: 4 };
  STT.tiles.clear(); if (app.duo) for (const m of app.duo.tiles) m.clear();
  buildBackground(); app.dirty = true;
}
function duoCam(D, k, dt) {
  const w = D.w[k], VW = (cw / 2) / S, p = w.p, m = w.minX || 0;
  const tgt = clamp(p.x + PW / 2 - VW * .4 + w.look * .5, m, Math.max(m, w.lw - VW));
  D.cam[k] = D.cam[k] == null || Math.abs(D.cam[k] - tgt) > VW * 1.5 ? tgt : lerp(D.cam[k], tgt, Math.min(1, dt * 7));
}
function duoSim(dt) {
  const D = app.duo; if (!D) return;
  for (let k = 0; k < 2; k++) duoCam(D, k, dt);
  if (D.count > -.5) {
    const before = Math.ceil(D.count - .6); D.count -= dt; const after = Math.ceil(D.count - .6);
    if (after !== before && after >= 0) Sound.play(after > 0 ? 'click' : 'spawn');
    if (D.count > .6) { acc = 0; return; }
  }
  acc += dt * (mutOn('fast') ? 1.25 : 1); let n = 0;
  const inp = [duoInput(0), duoInput(1)], sp = D.w[0].D.speed;
  while (acc >= STEP && n < 14) {
    for (let k = 0; k < 2; k++) if (D.won < 0 || D.won === k) D.w[k].step(STEP * sp, inp[k]);
    acc -= STEP; n++;
    // the first one to touch the door wins (checked every step so a tie goes to who really was first)
    if (D.won < 0) for (let k = 0; k < 2; k++) if (D.w[k].state === 'win') { duoDecide(k); break; }
  }
  if (n >= 14) acc = 0;
  if (D.won < 0) { app.levelT += dt * (mutOn('fast') ? 1.25 : 1); ST.time += dt; }
}
function duoDecide(k) {
  const D = app.duo; D.won = k; D.time = app.levelT; duoScore[k]++;
  unlockAch('duo'); if (duoScore[k] >= 5) unlockAch('duo5');
  app.taunt(`🏆 ${DUO_NAME[k]} برد!`, DUO_COL[k]); if (CFG.vib && navigator.vibrate) navigator.vibrate([40, 30, 80]);
  const w = D.w[1 - k]; w.flash = .6; w.shake(10);
  // photo finish: the other one was nearly at the door too
  const d = w.lv.ents.find(e => e.type === 'door' && !e.fake); if (d && w.state === 'play' && Math.abs(w.p.x - d.x) < 3 * T && Math.abs(w.p.y - d.y) < 3 * T) setTimeout(() => app.taunt('📸 عکس پایان! فقط یه قدم فاصله بود', '#ffffff'), 900);
}
function duoRender(t, dt) {
  const D = app.duo; if (!D) return;
  const half = Math.floor(cw / 2), tiles0 = STT.tiles, ox0 = OX, wx0 = WX.lastCam;
  for (let k = 0; k < 2; k++) {
    const w = D.w[k], c0 = w.camX;
    ctx.save(); ctx.beginPath(); ctx.rect(k * half, 0, k ? cw - half : half, ch); ctx.clip();
    OX = k * half; STT.tiles = D.tiles[k]; WX.lastCam = D.wx[k]; w.camX = D.cam[k] ?? c0; HERO_OVR = k ? DUO_COL[1] : null;
    try { render(w, t, k ? 0 : dt); }
    finally { D.wx[k] = WX.lastCam; w.camX = c0; HERO_OVR = null; ctx.restore(); }
  }
  OX = ox0; STT.tiles = tiles0; WX.lastCam = wx0;
  // divider, names, rooms and deaths, countdown, winner
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const gr = ctx.createLinearGradient(half - 6 * dpr, 0, half + 6 * dpr, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.5, 'rgba(8,4,24,.95)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr; ctx.fillRect(half - 6 * dpr, 0, 12 * dpr, ch); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(half - dpr, 0, 2 * dpr, ch);
  const f = Math.round(clamp(ch / 26, 12 * dpr, 22 * dpr));
  ctx.textBaseline = 'top'; ctx.direction = 'rtl';
  for (let k = 0; k < 2; k++) {
    const w = D.w[k], n = w.secs ? w.secs.length : 1, x0 = k * half, cx = x0 + half / 2;
    const txt = `${DUO_NAME[k]} · 🚪 ${faNum(w.ck + 1)}/${faNum(n)} · 💀 ${faNum(D.deaths[k])}`;
    ctx.font = `800 ${f}px Vazirmatn, Tahoma, sans-serif`; ctx.textAlign = 'center';
    const tw = ctx.measureText(txt).width + f * 1.4, y = Math.round(ch * .1);
    ctx.fillStyle = 'rgba(10,6,28,.62)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx - tw / 2, y, tw, f * 1.7, f * .85) : ctx.rect(cx - tw / 2, y, tw, f * 1.7); ctx.fill();
    ctx.fillStyle = DUO_COL[k]; ctx.fillText(txt, cx, y + f * .32);
    // progress bar along the level
    const pk = clamp((w.p.x + PW) / w.lw, 0, 1), bw = half * .5, by = y + f * 1.95;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(cx - bw / 2, by, bw, 4 * dpr); ctx.fillStyle = DUO_COL[k]; ctx.fillRect(cx - bw / 2, by, bw * pk, 4 * dpr);
    if (D.won >= 0) {
      ctx.font = `900 ${f * 2.4}px Vazirmatn, Tahoma, sans-serif`; ctx.fillStyle = D.won === k ? '#ffd36e' : 'rgba(255,255,255,.75)';
      ctx.fillText(D.won === k ? '🏆 بردی!' : '😵 باختی!', cx, ch * .36);
    }
  }
  if (D.count > -.5) {
    const n = Math.ceil(D.count - .6), s = n > 0 ? faNum(n) : 'برو!', k = D.count - Math.floor(D.count), sc = 1 + (n > 0 ? k * .5 : 0);
    ctx.font = `900 ${Math.round(f * 4.5 * sc)}px Vazirmatn, Tahoma, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = n > 0 ? .95 : clamp((D.count + .5) * 2, 0, 1);
    for (let j = 0; j < 2; j++) { const cx = j * half + half / 2; ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillText(s, cx + 4 * dpr, ch * .6 + 4 * dpr); ctx.fillStyle = n > 0 ? '#fff6d8' : '#6ff3c4'; ctx.fillText(s, cx, ch * .6); }
    ctx.globalAlpha = 1;
  }
  ctx.direction = 'inherit'; ctx.textBaseline = 'alphabetic';
}

/* ---------- picking the level ---------- */
function duoLevels() {
  const out = [];
  LEVELS.forEach((L, i) => { if (L.kind !== '3d' && !L.rest && i < Math.max(app.unlocked, 7)) out.push({ key: 'L' + i, n: faNum(i + 1), name: L.name, rooms: L.rooms || 1 }); });
  return out;
}
function renderDuo() {
  $('duoScoreTop').textContent = duoScore[0] + duoScore[1] ? `امتیاز: ${DUO_NAME[0]} ${faNum(duoScore[0])} — ${faNum(duoScore[1])} ${DUO_NAME[1]}` : '';
  $('duoGrid').innerHTML = duoLevels().map(l => `<button class="lv" data-duo="${l.key}" title="${esc(l.name)}">${l.n}<span class="rs">🚪${faNum(l.rooms)}</span></button>`).join('');
  const cust = Ed.list().concat(ED_SAMPLES.map((_, i) => edSample(i)));
  $('duoCustom').innerHTML = cust.map(lv => `<button class="chip" data-duo="C:${lv.id}">🛠️ ${esc(lv.name)}</button>`).join('');
}
function duoSrc(key) {
  if (key === 'rand') { const l = duoLevels().filter(x => x.rooms <= 10); key = (l.length ? l : duoLevels())[Math.floor(Math.random() * (l.length || duoLevels().length))].key; }
  if (key.startsWith('L')) { const i = +key.slice(1); return { key, idx: i, def: LEVELS[i], name: `مرحله ${faNum(i + 1)}: ${LEVELS[i].name}` }; }
  const lv = edById(key.slice(2)); return lv ? { key, def: edDef(lv), name: `🛠️ ${lv.name}` } : null;
}
// next round: the next platformer level after this one
function duoNextKey(src) {
  if (!src || src.idx == null) return 'rand';
  const l = duoLevels(), i = l.findIndex(x => x.key === src.key); return (l[i + 1] || l[0]).key;
}
$('bDuo').onclick = () => { Sound.init(); Sound.play('click'); duoScore = [0, 0]; renderDuo(); app.open('sDuo'); };
$('sDuo').addEventListener('click', e => { const b = e.target.closest('[data-duo]'); if (!b) return; Sound.play('click'); const s = duoSrc(b.dataset.duo); if (s) app.startDuo(s); });
$('bDuoAgain').onclick = () => { Sound.play('click'); if (app.duo) app.startDuo(app.duo.src); };
$('bDuoNext').onclick = () => { Sound.play('click'); if (app.duo) { const s = duoSrc(duoNextKey(app.duo.src)); if (s) app.startDuo(s); } };
$('bDuoPick').onclick = () => { Sound.play('click'); app.menu('sDuo'); renderDuo(); };
$('bDuoMenu').onclick = () => { Sound.play('click'); app.menu(); };

/* ---------- touch: three buttons for each player on their own side ---------- */
const t2Layer = $('touch2'), t2Btns = [...t2Layer.querySelectorAll('.tb2')], t2Ptrs = new Map();
function t2Pick(x, y, keepJump) {
  const side = x < innerWidth / 2 ? 0 : 1; let best = null, bd = 1e9;
  for (const b of t2Btns) { if (+b.dataset.p !== side || (keepJump && b.dataset.k === 'jump')) continue; const r = b.getBoundingClientRect(), d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y); if (d < bd) { bd = d; best = b; } }
  return best;
}
function t2Refresh() {
  for (const t of duoTouch) t.left = t.right = t.jump = false;
  for (const b of t2Btns) b.classList.remove('p');
  for (const b of t2Ptrs.values()) { duoTouch[+b.dataset.p][b.dataset.k] = true; b.classList.add('p'); }
}
t2Layer.addEventListener('pointerdown', e => {
  e.preventDefault(); Sound.init(); try { t2Layer.setPointerCapture(e.pointerId); } catch (_) {}
  const b = t2Pick(e.clientX, e.clientY); if (b) { t2Ptrs.set(e.pointerId, b); t2Refresh(); if (CFG.vib && navigator.vibrate) navigator.vibrate(6); }
});
t2Layer.addEventListener('pointermove', e => {
  const b = t2Ptrs.get(e.pointerId); if (!b || b.dataset.k === 'jump') return;
  const nb = t2Pick(e.clientX, e.clientY, true); if (nb && nb !== b && nb.dataset.p === b.dataset.p) { t2Ptrs.set(e.pointerId, nb); t2Refresh(); }
});
const t2End = e => { if (t2Ptrs.delete(e.pointerId)) t2Refresh(); };
t2Layer.addEventListener('pointerup', t2End); t2Layer.addEventListener('pointercancel', t2End); t2Layer.addEventListener('lostpointercapture', t2End);
t2Layer.addEventListener('contextmenu', e => e.preventDefault());
function duoTouchOff() { t2Ptrs.clear(); t2Refresh(); t2Layer.classList.remove('on'); }
