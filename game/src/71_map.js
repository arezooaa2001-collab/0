/* ============================ WORLD MAP (level select) ============================ */
// The 42 levels as stops on a winding road through their own landscapes. Drag (or wheel) to scroll, tap a stop to
// play. Stars, grades, 3D/race/boss/rest marks are shown on the stops; the hero waits on the next level to play.
const MAP = { on: false, x: 0, vx: 0, drag: null, t0: 0, sel: -1, raf: 0, view: (() => { try { return localStorage.getItem('telezar_lvview') || 'map'; } catch (e) { return 'map'; } })() };
const MAP_STEP = 150, MAP_H = 300;
const mapNode = i => ({ x: 110 + i * MAP_STEP, y: 150 + Math.sin(i * .8) * 62 + Math.cos(i * .33) * 18 });
const MAP_DECO = { mountains: '🏔️', forest: '🌲', dunes: '🌵', crystals: '💎', volcano: '🌋', mushrooms: '🍄', waves: '🌊', candy: '🍭', ruins: '🏛️', spires: '🗼', hills: '⛰️', city: '🏙️',
  sakura: '🌸', jungle: '🌴', factory: '🏭', islands: '🏝️', pyramids: '🐪', swamp: '🐸', domes: '🛰️' };
function mapBiome(i) { const d = LEVELS[i], b = BIOMES[biomeOf(d)] || BIOMES[d.biome]; if (b) return b; const t = THEMES3[d.theme] || THEMES3.dusk; return { sky: '#' + (t.sky ? t.sky[1] : 0x3a1c5e).toString(16).padStart(6, '0'), block: '#2f2858', moss: '#7af7ff', scen: 'hills' }; }
function mapCurrent() { return clamp(app.completed >= LEVELS.length ? 0 : app.unlocked - 1, 0, LEVELS.length - 1); }
function mapDraw(t) {
  const c = $('mapCv'); if (!c) return; const r = c.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1), cw2 = Math.round(r.width * d), ch2 = Math.round(r.height * d);
  if (c.width !== cw2 || c.height !== ch2) { c.width = cw2; c.height = ch2; }
  const g = c.getContext('2d'), k = ch2 / MAP_H, vw = cw2 / k, total = mapNode(LEVELS.length - 1).x + 120;
  MAP.x = clamp(MAP.x, 0, Math.max(0, total - vw));
  g.setTransform(k, 0, 0, k, -MAP.x * k, 0);
  // sky: the colours of every level's look, side by side
  const x0 = MAP.x - 20, x1 = MAP.x + vw + 20, sky = g.createLinearGradient(0, 0, total, 0);
  LEVELS.forEach((_, i) => { const n = mapNode(i); sky.addColorStop(clamp(n.x / total, 0, 1), mixHex(mapBiome(i).sky, '#000000', .25)); });
  g.fillStyle = sky; g.fillRect(x0, 0, x1 - x0, MAP_H);
  const shade = g.createLinearGradient(0, 0, 0, MAP_H); shade.addColorStop(0, 'rgba(8,4,24,.55)'); shade.addColorStop(.55, 'rgba(8,4,24,0)'); shade.addColorStop(1, 'rgba(8,4,24,.35)'); g.fillStyle = shade; g.fillRect(x0, 0, x1 - x0, MAP_H);
  // drifting clouds and far hills
  g.fillStyle = 'rgba(255,255,255,.07)';
  for (let i = 0; i < 18; i++) { const cx = ((i * 431 + t * 9) % (total + 200)) - 100, cy = 30 + (i * 37) % 70; if (cx < x0 - 80 || cx > x1 + 80) continue; g.beginPath(); g.ellipse(cx, cy, 46, 12, 0, 0, 7); g.ellipse(cx + 26, cy - 6, 30, 10, 0, 0, 7); g.fill(); }
  const hills = g.createLinearGradient(0, 0, total, 0); LEVELS.forEach((_, i) => hills.addColorStop(clamp(mapNode(i).x / total, 0, 1), mapBiome(i).block));
  g.fillStyle = hills; g.beginPath(); g.moveTo(x0, MAP_H);
  for (let x = x0; x <= x1; x += 20) g.lineTo(x, 236 + Math.sin(x * .011) * 16 + Math.sin(x * .031) * 7);
  g.lineTo(x1, MAP_H); g.closePath(); g.fill();
  // the road
  const cur = mapCurrent(), done = app.completed || 0;
  for (let i = 0; i < LEVELS.length - 1; i++) {
    const a = mapNode(i), b = mapNode(i + 1); if (b.x < x0 - 40 || a.x > x1 + 40) continue;
    g.lineCap = 'round'; g.strokeStyle = 'rgba(10,6,24,.55)'; g.lineWidth = 12; g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 26, b.x, b.y); g.stroke();
    g.strokeStyle = i < done ? '#ffd36e' : 'rgba(255,255,255,.35)'; g.lineWidth = 4; g.setLineDash(i < done ? [] : [8, 10]); g.stroke(); g.setLineDash([]);
  }
  // landscape marks
  g.textAlign = 'center'; g.textBaseline = 'middle';
  LEVELS.forEach((_, i) => { const n = mapNode(i); if (n.x < x0 - 60 || n.x > x1 + 60) return; const e = MAP_DECO[mapBiome(i).scen] || '✨';
    g.globalAlpha = .75; g.font = '26px sans-serif'; g.fillText(e, n.x + 52, n.y > 150 ? n.y - 58 : n.y + 62); g.font = '18px sans-serif'; g.globalAlpha = .5; g.fillText(e, n.x - 48, n.y > 150 ? n.y + 46 : n.y - 50); g.globalAlpha = 1; });
  // the stops
  const pr = progOf(app.diff), stars = pr.stars || {}, grade = pr.grade || {};
  LEVELS.forEach((L, i) => {
    const n = mapNode(i); if (n.x < x0 - 50 || n.x > x1 + 50) return;
    const open = i < app.unlocked, b = mapBiome(i), R = L.kind === '3d' ? 27 : 25, sel = i === MAP.sel;
    if (i === cur) { const pul = 1 + Math.sin(t * 4) * .12; g.strokeStyle = 'rgba(255,211,110,.8)'; g.lineWidth = 3; g.beginPath(); g.arc(n.x, n.y, R * 1.35 * pul, 0, 7); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(n.x, n.y + R * .9, R * .9, R * .3, 0, 0, 7); g.fill();
    const gr = g.createRadialGradient(n.x - R * .35, n.y - R * .4, 2, n.x, n.y, R); gr.addColorStop(0, open ? mixHex(b.moss, '#ffffff', .45) : '#6a6488'); gr.addColorStop(1, open ? mixHex(b.moss, '#000000', .35) : '#2a2640');
    g.fillStyle = gr; g.beginPath();
    if (L.kind === '3d') { for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; g.lineTo(n.x + Math.cos(a) * R, n.y + Math.sin(a) * R); } g.closePath(); } else g.arc(n.x, n.y, R, 0, 7);
    g.fill(); g.lineWidth = sel ? 4 : 2.5; g.strokeStyle = sel ? '#fff' : stars[i] ? '#ffd36e' : 'rgba(255,255,255,.55)'; g.stroke();
    g.fillStyle = open ? '#140c26' : '#b9b0d9'; g.font = '900 20px Vazirmatn, Tahoma, sans-serif'; g.fillText(open ? faNum(i + 1) : '🔒', n.x, n.y + 1);
    if (stars[i]) { g.font = '12px sans-serif'; g.fillStyle = '#ffd36e'; g.fillText('★'.repeat(stars[i]), n.x, n.y + R + 11); }
    if (grade[i]) { g.font = '900 13px Vazirmatn, sans-serif'; g.fillStyle = 'rgba(10,6,24,.75)'; g.beginPath(); g.arc(n.x - R * .8, n.y - R * .8, 9, 0, 7); g.fill(); g.fillStyle = GRADE_COL[grade[i]]; g.fillText(grade[i], n.x - R * .8, n.y - R * .8 + 1); }
    const tag = L.rest ? '🌿' : L.final ? '🏔️' : BOSS_LV[i] ? '🗿' : RIVAL_LV.has(i) ? '🏁' : i === PORTAL_LEVEL ? '🌀' : L.kind === '3d' ? '🏃' : '';
    if (tag) { g.font = '16px sans-serif'; g.fillText(tag, n.x + R * .85, n.y - R * .8); }
  });
  // the hero waits on the next stop
  { const n = mapNode(cur), hop = Math.abs(Math.sin(t * 3)) * 10, main = ctx; ctx = g;
    try { g.save(); g.translate(n.x, n.y - 30 - hop); g.scale(1.1, 1.1); drawHero(t, 1, hop < 2, 0, hop > 2 ? 200 : 0, t * 6, Math.sin(t * 1.7) > .97 ? -1 : 1, false); g.restore(); } catch (e) {} finally { ctx = main; } }
  // the selected stop's name
  const s = MAP.sel >= 0 ? MAP.sel : cur, L = LEVELS[s];
  $('mapInfo').innerHTML = `<b>${faNum(s + 1)}. ${esc(L.name)}</b> · ${L.kind === '3d' ? '🏃 فرار سه‌بعدی' : `🚪 ${faNum(L.rooms || 1)} اتاق`}${stars[s] ? ' · <span style="color:var(--gold)">' + '★'.repeat(stars[s]) + '</span>' : ''}${grade[s] ? ` · رتبه <b style="color:${GRADE_COL[grade[s]]}">${grade[s]}</b>` : ''}${s >= app.unlocked ? ' · 🔒 هنوز قفله' : ''}`;
}
function mapLoop() {
  if (!MAP.on || app.screen !== 'sLevels') { MAP.on = false; return; }
  const t = performance.now() / 1000;
  if (!MAP.drag && Math.abs(MAP.vx) > .1) { MAP.x -= MAP.vx; MAP.vx *= .92; }
  mapDraw(t); MAP.raf = requestAnimationFrame(mapLoop);
}
function mapShow() {
  const map = MAP.view === 'map';
  $('lvMapBox').hidden = !map; $('lvGrid').hidden = map;
  for (const b of document.querySelectorAll('[data-lvview]')) b.classList.toggle('on', b.dataset.lvview === MAP.view);
  if (map && !MAP.on) {
    MAP.on = true; MAP.sel = -1;
    const c = $('mapCv'), k = c.getBoundingClientRect().height / MAP_H || 1; MAP.x = mapNode(mapCurrent()).x - (c.getBoundingClientRect().width / k) / 2;
    MAP.raf = requestAnimationFrame(mapLoop);
  }
}
function mapPick(ev) {
  const c = $('mapCv'), r = c.getBoundingClientRect(), k = r.height / MAP_H, x = (ev.clientX - r.left) / k + MAP.x, y = (ev.clientY - r.top) / k;
  let best = -1, bd = 40; LEVELS.forEach((_, i) => { const n = mapNode(i), d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = i; } });
  return best;
}
$('mapCv').addEventListener('pointerdown', e => { MAP.drag = { x: e.clientX, mx: MAP.x, moved: 0, last: e.clientX }; MAP.vx = 0; try { $('mapCv').setPointerCapture(e.pointerId); } catch (_) {} });
$('mapCv').addEventListener('pointermove', e => {
  if (!MAP.drag) { const i = mapPick(e); $('mapCv').style.cursor = i >= 0 ? 'pointer' : 'grab'; return; }
  const k = $('mapCv').getBoundingClientRect().height / MAP_H, dx = e.clientX - MAP.drag.x; MAP.drag.moved = Math.max(MAP.drag.moved, Math.abs(dx));
  MAP.x = MAP.drag.mx - dx / k; MAP.vx = (e.clientX - MAP.drag.last) / k; MAP.drag.last = e.clientX;
});
$('mapCv').addEventListener('pointerup', e => {
  const D = MAP.drag; MAP.drag = null; if (!D || D.moved > 8) return;
  const i = mapPick(e); if (i < 0) return; Sound.init();
  if (MAP.sel !== i) { MAP.sel = i; Sound.play('click'); if (i >= app.unlocked) return; return; }
  if (i >= app.unlocked) { Sound.play('die'); return; }
  Sound.play('click'); app.runStart = performance.now(); app.deaths = 0; app.startLevel(i);
});
$('mapCv').addEventListener('wheel', e => { e.preventDefault(); MAP.x += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * .8; }, { passive: false });
$('mapPlay').onclick = () => { const i = MAP.sel >= 0 ? MAP.sel : mapCurrent(); if (i >= app.unlocked) { Sound.play('die'); return; } Sound.play('click'); app.runStart = performance.now(); app.deaths = 0; app.startLevel(i); };
document.querySelectorAll('[data-lvview]').forEach(b => b.onclick = () => { Sound.play('click'); MAP.view = b.dataset.lvview; try { localStorage.setItem('telezar_lvview', MAP.view); } catch (e) {} MAP.on = false; mapShow(); });

/* ============================ TITLE DEMO ============================ */
// Behind the menus the robot plays level 1 (its run is searched once in the background while you are on the title
// screen and kept, so later visits replay it straight away).
const ATTRACT = { acts: null, i: 0, n: 0, job: null, started: false, w: null, endT: 0 };
const attractSig = () => 'v1:' + LEVELS[0].secs.map(s => (s.keys || []).join(',') + '|' + (s.seed || 0)).join(';');
// level 1's run, found by the robot ahead of time (used while the level stays the same; otherwise searched again here)
const ATTRACT_RUN = { sig: "v1:dropFloor,kickGap,lavaPit,trampGap,plateDoor|100;acidPool,wallSpring,onewayStairs,springLeap,hiddenLanding|101;sawFloor,movingBridge,togDoor,hiddenPop,gapDown|102;dropLanding,stairsDown,togBridge,pillarHop,islands|103;|0",
  acts: '44444422444440000044222314400022212244222222221444444452255332200114444444454222002223444444444444522244444411122222512222444444554203333444222222222222442443300000004444440555524444455322522245222222440044444223000024442211144422200100444444244422222244000000000022222225222044444444444055552221441444555002244433444440444444002202222225222222144444424422234340005552200000533330444555555524400005110222344442222111500503222222444445444444444444003222222242222255444444403442222002254444444441111154402222252222222222225544500022444522000004432242222444400440000000022222555544444400052222200054444440000000422222242400444444400034224440444230442554222244444551111444442222322222444444212222111022222222224444555222444455234444244444400044455522200002222222233334444444444444' };
if (ATTRACT_RUN.sig === attractSig()) ATTRACT.acts = ATTRACT_RUN.acts;
try { const v = JSON.parse(localStorage.getItem('telezar_attract') || 'null'); if (!ATTRACT.acts && v && v.sig === attractSig() && typeof v.acts === 'string') ATTRACT.acts = v.acts; } catch (e) {}
function attractStart() {
  if (ATTRACT.acts || ATTRACT.started || app.state !== 'title') return;
  ATTRACT.started = true;
  const S = solveDef(LEVELS[0], 1, { totalMs: 30000, sliceMs: 6 }); ATTRACT.job = S.job;
  S.promise.then(r => { ATTRACT.job = null; if (r.ok) { ATTRACT.acts = r.acts; try { localStorage.setItem('telezar_attract', JSON.stringify({ sig: attractSig(), acts: r.acts })); } catch (e) {} } else ATTRACT.started = false; });
}
// the search only runs while the title screen is open
setInterval(() => { if (ATTRACT.job && app.state !== 'title') { ATTRACT.job.stop = true; ATTRACT.job = null; ATTRACT.started = false; } else if (app.state === 'title' && !ATTRACT.acts && !ATTRACT.started) attractStart(); }, 1500);
// one input per robot step; a finished (or broken) run starts over on a fresh copy of the level
function attractInput(w) {
  const A = ATTRACT; if (!A.acts || CFG.demo === false) return ED_ACTS[0];
  if (A.w !== w) { A.w = w; A.i = 0; A.n = 0; A.endT = 0; }
  if (w.state !== 'play' || A.i >= A.acts.length) { A.endT += STEP; if (A.endT > 2.2) { app.world = new World(0, { silent: true }); A.w = app.world; A.i = 0; A.n = 0; A.endT = 0; } return ED_ACTS[0]; }
  const a = A.acts.charCodeAt(A.i) - 48; if (++A.n >= 8) { A.n = 0; A.i++; }
  return ED_ACTS[a] || ED_ACTS[0];
}
