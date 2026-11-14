/* ============================ LEVEL EDITOR ============================ */
// Build your own troll level on a grid (1 to 5 screens wide, 18 rows), play-test it, let the robot try it,
// keep it in a save slot and share it with friends as a text code.
const ED_R = 18, ED_SW = 32, ED_MAXS = 5, ED_KEY = 'telezar_edit';
const EDT = [
  // [code, emoji (fallback icon), name, what it does]
  ['g', '🧱', 'زمین', 'زمین و دیوار سفت'],
  ['p', '➖', 'تخته', 'از زیرش رد می‌شی و می‌پری روش'],
  ['i', '❄️', 'یخ', 'زمین لیز!'],
  ['m', '↔️', 'سکوی متحرک', 'سه خونه به راست می‌ره و برمی‌گرده'],
  ['c', '💢', 'سکوی ترک‌دار', 'یه لحظه بعد از اینکه روش وایستی می‌ریزه'],
  ['f', '👻', 'زمین قلابی', 'شبیه زمینه ولی ازش رد می‌شی و می‌افتی 😈'],
  ['d', '⬇️', 'زمین ریزشی', 'تا پات رو روش بذاری می‌افته'],
  ['n', '❔', 'بلوک نامرئی', 'دیده نمی‌شه؛ وقتی از زیر سرت بهش بخوره ظاهر می‌شه'],
  ['S', '🔺', 'خار', 'بهش بخوری می‌میری'],
  ['V', '🔻', 'خار سقفی', 'خار رو به پایین'],
  ['h', '🙈', 'خار پنهان', 'وقتی نزدیکش بشی یهو بیرون میاد'],
  ['r', '☄️', 'خار ریزان', 'وقتی به زیرش برسی می‌افته'],
  ['w', '⚙️', 'اره', 'اره‌ی چرخون'],
  ['W', '🔁', 'اره‌ی متحرک', 'دو خونه چپ و راست می‌ره'],
  ['z', '🔴', 'لیزر', 'از این خونه تا زمین؛ روشن و خاموش می‌شه'],
  ['L', '🌋', 'گدازه', 'داغه!'],
  ['j', '⏫', 'فنر', 'پرتت می‌کنه بالا'],
  ['b', '🟣', 'بالشتک پرشی', 'روش بری خیلی بلند پرت می‌شی'],
  ['<', '⬅️', 'نوار نقاله به چپ', 'تو رو به سمت چپ می‌بره'],
  ['>', '➡️', 'نوار نقاله به راست', 'تو رو به سمت راست می‌بره'],
  ['q', '🩷', 'بلوک صورتی', 'با هر پرش، بلوک‌های صورتی و آبی جاشون عوض می‌شه (اول صورتی سفته)'],
  ['Q', '🩵', 'بلوک آبی', 'با هر پرش، بلوک‌های صورتی و آبی جاشون عوض می‌شه (اول آبی خالیه)'],
  ['t', '🌀', 'تله‌پورت ورودی', 'تو رو می‌بره به خروجی هم‌شماره‌اش (اولین ورودی به اولین خروجی و…)'],
  ['T', '🎯', 'تله‌پورت خروجی', 'جایی که از تله‌پورت ورودی سر در میاری'],
  ['u', '🌬️', 'باد رو به بالا', 'یه ستون باد که تو رو بالا می‌بره'],
  ['a', '🏹', 'تیرانداز', 'پشت سر هم به سمت چپ تیر می‌زنه'],
  ['o', '🌀', 'گوی جاذبه', 'جاذبه رو برعکس می‌کنه'],
  ['e', '💎', 'جواهر', 'برای جمع کردن (جواهرهای مرحله‌های ساختنی به حساب فروشگاه نمی‌رن)'],
  ['P', '🙂', 'شروع', 'جای شروع بازیکن (فقط یکی)'],
  ['D', '🚪', 'در خروج', 'رسیدن به این در یعنی بردن (فقط یکی)'],
  ['F', '🎭', 'در قلابی', 'شبیه در خروجه ولی… 😈'],
  ['K', '🚩', 'چک‌پوینت', 'بعد از مرگ از اینجا شروع می‌کنی؛ هر چک‌پوینت یه اتاق تازه‌ست'],
  [' ', '❌', 'پاک‌کن', 'پاک کردن خونه‌ها'],
];
const EDC = new Set(EDT.map(t => t[0]));
const edTool = c => EDT.find(t => t[0] === c);
const ED_HAZ = new Set(['f', 'd', 'n', 'S', 'V', 'h', 'r', 'w', 'W', 'z', 'L', 'F', 'c', 'a', 'q', 'Q']);
const ED_SOLID = 'gibq<>dQcmpa';   // cells you can stand on (for "test from here" and arrow walls)

/* ---------- grid -> level ---------- */
// All the level's things are built by its last section (so the door is kept); the other sections only give the
// checkpoints: a section starts at every 🚩 column.
function edBuild(P, G, ox) {
  const R = G.length, C = G[0].length, at = (x, y) => (G[y] || '')[x] || ' ';
  let n = 0; const id = () => 'e' + n++, X = x => x - ox, dyn = e => { if (e) e.dyn = true; return e; };
  // solid ground: big rectangles (rows are joined while they match), so only real top edges get grass
  for (const [ch, o] of [['g', {}], ['i', { ice: true }], ['f', { ghost: true }]]) {
    const used = G.map(() => new Uint8Array(C));
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
      if (at(x, y) !== ch || used[y][x]) continue;
      let w = 1; while (x + w < C && at(x + w, y) === ch && !used[y][x + w]) w++;
      let h = 1; const rowOk = yy => { for (let k = 0; k < w; k++) if (at(x + k, yy) !== ch || used[yy][x + k]) return false; return true; };
      while (y + h < R && rowOk(y + h)) h++;
      for (let yy = y; yy < y + h; yy++) for (let k = 0; k < w; k++) used[yy][x + k] = 1;
      P.block(null, X(x), y, w, h, Object.assign({}, o));
    }
  }
  // horizontal runs of one kind
  const runs = (ch, fn) => { for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (at(x, y) === ch) { let w = 1; while (at(x + w, y) === ch) w++; fn(x, y, w); x += w - 1; } };
  runs('p', (x, y, w) => P.block(null, X(x), y, w, .3, { oneway: true }));
  runs('m', (x, y, w) => dyn(P.block(id(), X(x), y, w, .45, { patrol: [[X(x), y], [X(x) + 3, y]], speed: 2 })));
  runs('S', (x, y, w) => P.spikes(null, X(x), y, w, 'up'));
  runs('V', (x, y, w) => P.spikes(null, X(x), y, w, 'down'));
  runs('h', (x, y, w) => { const k = id(); dyn(P.spikes(k, X(x), y, w, 'up', { hidden: true })); P.trig(X(x) - 1.3, y - 3, w + 2.6, 4, () => P.pop(k)); });
  runs('L', (x, y, w) => P.block(null, X(x), y + .3, w, Math.max(.7, R - y - .3), { lava: true, ghost: true }));
  runs('b', (x, y, w) => P.block(null, X(x), y, w, 1, { bounce: 22 }));
  runs('<', (x, y, w) => P.block(null, X(x), y, w, 1, { conv: -2.5 }));
  runs('>', (x, y, w) => P.block(null, X(x), y, w, 1, { conv: 2.5 }));
  runs('q', (x, y, w) => dyn(P.block(null, X(x), y, w, 1, { tog: 0 })));
  runs('Q', (x, y, w) => dyn(P.block(null, X(x), y, w, 1, { tog: 1 })));
  // teleporters: the n-th entrance (left to right) leads to the n-th exit
  const tin = edFind(G, 't').sort((a, b) => a[0] - b[0] || a[1] - b[1]), tout = edFind(G, 'T').sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  tout.forEach(([x, y], i) => P.tele('tx' + i, X(x) + .05, y - .6));
  tin.forEach(([x, y], i) => P.tele('tn' + i, X(x) + .05, y - .6, i < tout.length ? 'tx' + i : undefined));
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
    const c = at(x, y), lx = X(x);
    if (c === 'c') dyn(P.block(id(), lx, y, 1, .5, { crumble: .45 }));
    else if (c === 'd') { const k = id(); dyn(P.block(k, lx, y, 1, 1, { fallV: 60 })); P.trig(lx + .05, y - 1, .9, 1, () => P.fall(k, .18), { ground: true }); }
    else if (c === 'n') { const k = id(); dyn(P.block(k, lx, y, 1, 1, { hidden: true })); P.trig(lx - .2, y + 1, 1.4, .7, () => P.pop(k), { rising: true }); }
    else if (c === 'r') { const k = id(); dyn(P.spikes(k, lx, y, 1, 'down')); P.trig(lx - 1.2, y + 1, 3.4, R - y, () => P.fall(k, .05)); }
    else if (c === 'w') dyn(P.saw(null, lx + .5, y + .5, .6));
    else if (c === 'W') dyn(P.saw(null, lx + .5, y + .5, .6, { patrol: [[lx - 1.5, y + .5], [lx + 2.5, y + .5]], speed: 3 }));
    else if (c === 'z') { let len = 1; while (y + len < R && !'gi'.includes(at(x, y + len))) len++; dyn(P.laser(id(), lx + .5 - 5 / T, y, len, 'v', { on: 1.1, off: 1.4 })); }
    else if (c === 'j') dyn(P.spring(null, lx, y));
    else if (c === 'u') { const top = Math.max(0, y - 9); P.zone(id(), 'wind', lx, top, 1, y + 1 - top, { fy: -18 }); }
    else if (c === 'a') {
      P.block(null, lx, y + .15, 1, .85);
      let x1 = x - 1; while (x1 > Math.max(-1, x - 16) && !ED_SOLID.includes(at(x1, y))) x1--;
      const end = X(x1 + 1); if (end < lx - 1) dyn(P.spikes(id(), lx - 1, y, 1, 'left', { arrow: true, pjump: true, patrol: [[lx - 1, y], [end, y]], speed: 7 }));
    }
    else if (c === 'o') dyn(P.orb(id(), lx + .5, y + .5));
    else if (c === 'e') P.gem(lx + .5, y + .5);
    else if (c === 'D') dyn(P.door(lx - .2, y - 1));
    else if (c === 'F') { const k = id(); dyn(P.spikes(k + 's', lx - 1, y, 3, 'up', { hidden: true })); dyn(P.add(k, { type: 'door', fake: k + 's', x: (lx - .2) * T, y: (y - 1) * T, w: 1.4 * T, h: 2 * T })); }
  }
}
function edFind(G, ch) { const out = []; G.forEach((row, y) => { for (let x = row.indexOf(ch); x >= 0; x = row.indexOf(ch, x + 1)) out.push([x, y]); }); return out; }
function edDef(lv) {
  const G = lv.g, C = G[0].length, P = edFind(G, 'P')[0] || [2, 14];
  const ks = edFind(G, 'K').filter(k => k[0] > P[0] && k[0] < C - 1).sort((a, b) => a[0] - b[0]).filter((k, i, a) => !i || k[0] !== a[i - 1][0]);
  const cuts = [{ x: 0, spawn: [P[0], P[1]], t0: P[1] + 1 }].concat(ks.map(k => ({ x: k[0], spawn: [0, k[1]], t0: k[1] + 1 })));
  const secs = cuts.map((c, i) => ({ edit: true, w: (i + 1 < cuts.length ? cuts[i + 1].x : C) - c.x, t0: c.t0, spawn: c.spawn, build() {} }));
  const lastX = cuts[cuts.length - 1].x; secs[secs.length - 1].build = Pb => edBuild(Pb, G, lastX);
  let nObs = 0; for (const row of G) for (const c of row) if (ED_HAZ.has(c)) nObs++;
  const def = { custom: true, noRun: true, name: lv.name || 'مرحله‌ی من', biome: BIOMES[lv.biome] ? lv.biome : 'dusk', spawn: P, secs, nObs, rooms: secs.length, edId: lv.id };
  def.relayout = () => { let x = 0; for (const s of def.secs) { s.x0 = x; x += s.w; } def.width = x; };
  def.relayout();
  return def;
}

/* ---------- storage + share codes ---------- */
const Ed = {
  list() { try { const v = JSON.parse(localStorage.getItem(ED_KEY)); if (Array.isArray(v)) return v.filter(edValid); } catch (e) {} return []; },
  store(list) { try { localStorage.setItem(ED_KEY, JSON.stringify(list.slice(0, 30))); return true; } catch (e) { return false; } },
  put(lv) { const L = this.list(), i = L.findIndex(x => x.id === lv.id); lv.t = Date.now(); if (i >= 0) L[i] = lv; else L.unshift(lv); return this.store(L); },
  del(id) { this.store(this.list().filter(x => x.id !== id)); },
  get(id) { return this.list().find(x => x.id === id) || null; },
};
function edValid(lv) {
  if (!lv || !Array.isArray(lv.g) || lv.g.length !== ED_R) return false;
  const C = lv.g[0] && lv.g[0].length; if (!(C >= ED_SW && C <= ED_SW * ED_MAXS)) return false;
  return lv.g.every(r => typeof r === 'string' && r.length === C && [...r].every(c => EDC.has(c)));
}
function edNew(screens = 2) {
  const C = ED_SW * screens, g = [];
  for (let y = 0; y < ED_R; y++) g.push((y >= 15 ? 'g' : ' ').repeat(C));
  const set = (x, y, c) => { g[y] = g[y].slice(0, x) + c + g[y].slice(x + 1); };
  set(2, 14, 'P'); set(C - 4, 14, 'D');
  return { id: 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name: 'مرحله‌ی من', biome: 'dusk', g, ok: false, mine: true, t: Date.now() };
}
// run-length rows ("_" = empty), joined with "/", packed as UTF-8 base64 (URL-safe)
function edCode(lv) {
  const rle = lv.g.map(r => { let s = ''; for (let i = 0; i < r.length;) { let j = i; while (j < r.length && r[j] === r[i]) j++; const c = r[i] === ' ' ? '_' : r[i]; s += (j - i > 1 ? j - i : '') + c; i = j; } return s; }).join('/');
  const json = JSON.stringify({ v: 1, n: (lv.name || '').slice(0, 40), b: lv.biome, g: rle });
  const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '.').replace(/=+$/, '');
  return 'TZ1-' + b64;
}
function edDecode(code) {
  try {
    const m = String(code).replace(/\s+/g, '').match(/TZ1-([A-Za-z0-9\-._]+)/); if (!m) return null;
    let b = m[1].replace(/-/g, '+').replace(/\./g, '/'); while (b.length % 4) b += '=';
    const o = JSON.parse(decodeURIComponent(escape(atob(b))));
    const g = String(o.g).split('/').map(s => { let r = ''; s.replace(/(\d*)(\D)/g, (_, n, c) => { r += (c === '_' ? ' ' : c).repeat(n ? Math.min(+n, 200) : 1); return ''; }); return r; });
    const lv = { id: 'i' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name: String(o.n || 'مرحله‌ی دوستم').slice(0, 40), biome: BIOMES[o.b] ? o.b : 'dusk', g, ok: false, mine: false, t: Date.now() };
    return edValid(lv) ? lv : null;
  } catch (e) { return null; }
}

/* ---------- sample levels (also show what the tools can do) ---------- */
const ED_SAMPLES = [
  { name: 'نمونه: خوش اومدی 😈', biome: 'forest', rows: [
    '                                                                ',
    '                                                                ',
    '                                                                ',
    '                                                                ',
    '                                                                ',
    '                                                                ',
    '                                         r   r                  ',
    '                                                                ',
    '                     n                                          ',
    '               e                    e        e                  ',
    '             ppppp           K                         e        ',
    '                        mm         ggggggg       ggg            ',
    '                                   g     g       g g      F   D ',
    '   e      j          e             g     g  w    g g            ',
    '  P     ggggg     hhh   e    e   ggg     gggggg  g g  ggggg  ggg',
    'gggggdddggggggffggggggggggccccggggg      gggggggggg   gggggggggg',
    'gggggggggggggg  gggggggggg    ggggg      gggggggggg   gggggggggg',
    'gggggggggggggg  gggggggggg    gggggLLLLLLgggggggggg   gggggggggg'] },
  { name: 'نمونه: آزمایشگاه جاذبه 🌀', biome: 'factory', rows: [
    '                         ggggggggggggggggggggg                  ',
    '                         ggggggggggggggggggggg                  ',
    '                                 VV    V    o                   ',
    '                                                                ',
    '                                                                ',
    '                              e     e     e                     ',
    '                                                                ',
    '                                                                ',
    '      z                                                         ',
    '                                                          e     ',
    '            e                                                   ',
    '    e                e                            e     W       ',
    '                                                                ',
    '          mm                                                    ',
    '  P               K  SS    o                   K    h  F     D  ',
    'ggggggggggLLLLLLggggggggggggLLLLLLLLLLLLLLLLLggggggggggggggggggg',
    'gggggggggg      gggggggggggg                 ggggggggggggggggggg',
    'gggggggggg      gggggggggggg                 ggggggggggggggggggg'] },
];
function edSample(i) {
  const s = ED_SAMPLES[i], C = s.rows[0].length;
  return { id: 'sample' + i, name: s.name, biome: s.biome, g: s.rows.map(r => (r + ' '.repeat(C)).slice(0, C)), ok: true, mine: false, sample: true, t: 0 };
}

/* ---------- editor state ---------- */
const ED = { lv: null, tool: 'g', cam: 0, undo: [], redo: [], world: null, need: true, hover: null, stroke: null, pan: false, ptrs: new Map(), icons: {}, iconBiome: null, botBest: null };
const edCols = () => ED.lv.g[0].length;
const edSnap = () => JSON.stringify(ED.lv.g);
function edSet(x, y, c) {
  const g = ED.lv.g; if (y < 0 || y >= ED_R || x < 0 || x >= edCols() || g[y][x] === c) return false;
  if (c === 'P' || c === 'D') for (const [px, py] of edFind(g, c)) g[py] = g[py].slice(0, px) + ' ' + g[py].slice(px + 1);
  g[y] = g[y].slice(0, x) + c + g[y].slice(x + 1); return true;
}
function edTouch() { ED.need = true; ED.lv.ok = false; ED.lv.bot = false; ED.botActs = null; ED.botBest = null; edSave(); }
let edSaveT = 0;
function edSave() { clearTimeout(edSaveT); edSaveT = setTimeout(() => { if (ED.lv && !ED.lv.sample) Ed.put(ED.lv); }, 400); }
function edRebuild() {
  if (!ED.lv) return;
  const w = new World(edDef(ED.lv), { silent: true, diff: 0 });
  w.camX = ED.cam; w.p.face = 1; ED.world = app.world = w; ED.need = false; app.dirty = true;
}
// the playfield sits between the two tool columns (it gets smaller, never covered)
function edLayout() {
  // the tool columns use the empty bars beside a wide screen when there are some (the playfield keeps its full height)
  const side = Math.round(clamp((innerWidth - innerHeight * W / H) / 2, 60, 96)) * dpr, avail = Math.max(100, cw - side * 2), z = ED.zoom || 1;
  S = Math.min(avail / (W * z), ch / H); OX = z > 1 ? side : side + (avail - W * S) / 2; OY = (ch - H * S) / 2;
  ED.vw = Math.min(avail / S, W * z);
  EXT = { l: OX / S + 4, r: (cw - OX) / S - W + 4, t: OY / S + 4, b: OY / S + 4 };
  STT.tiles.clear(); buildBackground(); app.dirty = true;
  document.documentElement.style.setProperty('--edSide', (side / dpr) + 'px');
}
function edCell(cx, cy) {
  const x = (cx * dpr - OX) / S + ED.cam, y = (cy * dpr - OY) / S;
  return { x: Math.floor(x / T), y: Math.floor(y / T), inside: y >= 0 && y < H && x >= ED.cam - 1 && x <= ED.cam + edVW() + 1 };
}
const edVW = () => ED.vw || W;   // how much of the level is visible (more when zoomed out)
function edScroll(dx) { ED.cam = clamp(ED.cam + dx, 0, Math.max(0, edCols() * T - edVW())); if (ED.world) ED.world.camX = ED.cam; app.dirty = true; edMini(); }

/* ---------- icons: the real game pieces drawn small (falls back to the emoji) ---------- */
function edIcon(code) {
  if (code === ' ') return null;
  const c = mkC(72, 72), g = c.getContext('2d'), main = ctx, cm = CAMX, lw = LW, hi = hints;
  try {
    const fw = { d: 0, D: DIFFS[0], silent: true, burst() {}, sfx() {}, shake() {}, say() {} };
    const L = new Level({ build() {} }, fw); L.ents = []; L.byId = {}; L.trigs = [];
    const P = secBuilder(L, { x0: 0, spawn: [0, 0] }, 0, true);
    const grid = Array.from({ length: 4 }, () => '    '.split(''));
    grid[2][1] = code === 'P' || code === 'K' ? ' ' : code;
    if ('mpSVLb<>qQ'.includes(code)) grid[2][2] = code;
    if (code === 'a') { grid[2][2] = code; grid[2][1] = ' '; }
    edBuild(P, grid.map(r => r.join('')), 0); P.done(); L.link(0);
    ctx = g; CAMX = 0; LW = 1e6; hints = true;
    const tall = code === 'D' || code === 'F' || code === 'K' || code === 'P' || code === 't' || code === 'T', wide = grid[2][2] !== ' ';
    const span = tall ? 2.6 : wide ? 2.4 : 1.6, k = 72 / (span * T), cx = (wide ? 2 : 1.5) * T, cy = tall ? 1.95 * T : 2.5 * T;
    g.setTransform(k, 0, 0, k, 36 - cx * k, 36 - cy * k);
    for (const e of L.ents) {
      if (e.type === 'block') { if (e.hidden) { ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = '#9ef9dc'; ctx.lineWidth = 3; ctx.strokeRect(e.x + 2, e.y + 2, e.w - 4, e.h - 4); ctx.restore(); } else drawBlock(e, 0); }
      else if (e.type === 'spike') { ctx.save(); if (e.hidden) ctx.globalAlpha = .5; const p = e.pop; e.pop = 1; if (e.arrow) drawSpike(e); else drawSpikeRaw(e); e.pop = p; ctx.restore(); }
      else if (e.type === 'saw') drawSaw(e, 0);
      else if (e.type === 'spring') drawSpringRaw(e);
      else if (e.type === 'orb') drawOrb(e, 0);
      else if (e.type === 'gem') drawGem(e, 0);
      else if (e.type === 'door') drawDoor(e, 0, null);
      else if (e.type === 'laser') { e.act = true; drawLaser(e, 0); }
      else if (e.type === 'tele') drawTele(e, 0);
      else if (e.type === 'zone' && e.kind === 'wind') { ctx.save(); ctx.fillStyle = 'rgba(158,249,255,.25)'; ctx.fillRect(e.x, e.y + e.h - 1.6 * T, e.w, 1.6 * T); ctx.restore(); }
    }
    if (code === 'K') drawFlag({ x: 1.4 * T, y: 1.1 * T, h: 2.4 * T, on: true, wave: 0 }, 0);
    if (code === 'P') { ctx.save(); ctx.translate(1.5 * T, 3 * T); ctx.scale(1.5, 1.5); drawHero(0, 1, true, 0, 0, 0, 2, false); ctx.restore(); }
    if (code === 'W' || code === 'm') { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.fillText('⟷', 4, 18); }
    if ('drchfu<>'.includes(code)) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.font = '20px sans-serif'; ctx.fillText(edTool(code)[1], 44, 22); }
  } catch (e) { return null; }
  finally { ctx = main; CAMX = cm; LW = lw; hints = hi; }
  return c;
}
function edPalette() {
  if (ED.iconBiome !== BIOME) { ED.iconBiome = BIOME; ED.icons = {}; for (const t of EDT) ED.icons[t[0]] = edIcon(t[0]); }
  const box = $('edTools'); box.innerHTML = '';
  for (const t of EDT) {
    const b = document.createElement('button'); b.className = 'edT' + (t[0] === ED.tool && !ED.pan ? ' on' : ''); b.dataset.t = t[0]; b.title = t[2] + ' — ' + t[3];
    const ic = ED.icons[t[0]]; if (ic) { const cc = mkC(72, 72); cc.getContext('2d').drawImage(ic, 0, 0); b.appendChild(cc); } else { const s = document.createElement('i'); s.textContent = t[1]; b.appendChild(s); }
    const l = document.createElement('small'); l.textContent = t[2]; b.appendChild(l);
    box.appendChild(b);
  }
}
function edTip(text) { const el = $('edTip'); el.textContent = text; el.classList.add('on'); clearTimeout(edTip.t); edTip.t = setTimeout(() => el.classList.remove('on'), 3200); }
function edMini() {
  const n = edCols() / ED_SW, k = ED.cam / Math.max(1, edCols() * T - edVW());
  $('edPage').textContent = `${faNum(n)} صفحه`;
  $('edPos').style.setProperty('--k', n > 1 ? k.toFixed(3) : '0'); $('edPos').style.setProperty('--n', n);
}

/* ---------- enter / leave ---------- */
function edOpen(lv, back) {
  mutApply(false); app.teardown(); app.custom = null; app.demo = null; app.rush = null; Ghost.stop(); app.rivals2 = null; app.endless = null;
  if (!back) { ED.undo = []; ED.redo = []; ED.cam = 0; ED.botBest = null; ED.botActs = null; }
  ED.lv = lv; ED.cam = clamp(ED.cam, 0, Math.max(0, edCols() * T - edVW())); ED.pan = false; $('edPan').classList.remove('on');
  app.state = 'edit'; app.kind = 'plat'; app.view = 'p2'; app.def = null; app.show(null);
  cv.style.display = 'block'; $('c3').style.display = 'none'; $('hud').classList.remove('on'); tLayer.classList.remove('on'); $('r3hud').classList.remove('on'); $('fade').classList.remove('on');
  setBiome(lv.biome); edLayout(); edRebuild(); edPalette(); edMini();
  $('edUI').classList.add('on'); $('edName').textContent = lv.name;
  if (!back) edTip(lv.sample ? 'این یه نمونه‌ست؛ هر تغییری بدی یه نسخه‌ی تازه برای خودت ساخته می‌شه' : 'یه ابزار از ستون راست انتخاب کن و روی صفحه بکش');
}
function edClose(to = 'sMy') {
  $('edUI').classList.remove('on'); edBotStop();
  if (ED.lv && !ED.lv.sample) Ed.put(ED.lv);
  app.state = 'title'; resize(); STT.tiles.clear(); setBiome(LEVELS[0].biome); app.world = new World(0, { silent: true });
  if (to === 'sMy') { renderMy(); app.show('sMy'); } else app.menu();
}
// the first change to a sample level makes it your own copy
function edOwn() { if (!ED.lv.sample) return; const c = JSON.parse(JSON.stringify(ED.lv)); c.id = 'm' + Date.now().toString(36); c.sample = false; c.mine = true; c.name = c.name.replace('نمونه: ', '') + ' (کپی)'; ED.lv = c; $('edName').textContent = c.name; }

/* ---------- drawing on the grid ---------- */
function edPaint(x, y) {
  edOwn();
  const c = ED.tool;
  if (edSet(x, y, c)) { edTouch(); if (c === 'P' || c === 'D') Sound.play('click'); }
}
function edLine(a, b) {
  let { x, y } = a; const dx = Math.abs(b.x - x), dy = -Math.abs(b.y - y), sx = x < b.x ? 1 : -1, sy = y < b.y ? 1 : -1; let err = dx + dy;
  for (let n = 0; n < 400; n++) { edPaint(x, y); if (x === b.x && y === b.y) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x += sx; } if (e2 <= dx) { err += dx; y += sy; } }
}
function edPush() { ED.undo.push(edSnap()); if (ED.undo.length > 80) ED.undo.shift(); ED.redo = []; }
function edUndo(redo) {
  const from = redo ? ED.redo : ED.undo, to = redo ? ED.undo : ED.redo; if (!from.length) return Sound.play('click');
  to.push(edSnap()); ED.lv.g = JSON.parse(from.pop()); edTouch(); Sound.play('click');
}
cv.addEventListener('pointerdown', e => {
  if (app.state !== 'edit') return;
  e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  ED.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ED.ptrs.size > 1 || ED.pan || e.button === 1 || e.button === 2) {
    // a second finger: the first one was not drawing but moving the view
    if (ED.stroke) { if (edSnap() !== ED.stroke.before) { ED.lv.g = JSON.parse(ED.stroke.before); edTouch(); } ED.undo.pop(); ED.stroke = null; }
    ED.panX = e.clientX; return;
  }
  const c = edCell(e.clientX, e.clientY); if (!c.inside) return;
  edPush(); const before = edSnap(); ED.stroke = { last: c, before }; edPaint(c.x, c.y);
});
cv.addEventListener('pointermove', e => {
  if (app.state !== 'edit') return;
  const c = edCell(e.clientX, e.clientY); ED.hover = c.inside ? c : null; app.dirty = true;
  if (!ED.ptrs.has(e.pointerId)) return;
  if (ED.ptrs.size > 1 || ED.pan || !ED.stroke) { if (ED.panX != null) { edScroll(-(e.clientX - ED.panX) * dpr / S / (ED.ptrs.size > 1 ? ED.ptrs.size : 1)); ED.panX = e.clientX; } return; }
  if (c.x !== ED.stroke.last.x || c.y !== ED.stroke.last.y) { edLine(ED.stroke.last, c); ED.stroke.last = c; }
});
const edUp = e => {
  if (!ED.ptrs.delete(e.pointerId)) return;
  if (ED.stroke && ED.ptrs.size === 0) { if (edSnap() === ED.stroke.before) ED.undo.pop(); ED.stroke = null; }
  if (ED.ptrs.size === 0) ED.panX = null;
};
cv.addEventListener('pointerup', edUp); cv.addEventListener('pointercancel', edUp);
cv.addEventListener('pointerleave', () => { if (app.state === 'edit') { ED.hover = null; app.dirty = true; } });
cv.addEventListener('contextmenu', e => { if (app.state === 'edit') e.preventDefault(); });
cv.addEventListener('wheel', e => { if (app.state !== 'edit') return; e.preventDefault(); edScroll((Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 1.2); }, { passive: false });
addEventListener('keydown', e => {
  if (app.state !== 'edit' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') edScroll(T * 4); else if (e.code === 'ArrowLeft' || e.code === 'KeyA') edScroll(-T * 4);
  else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') edUndo(e.shiftKey); else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') edUndo(true);
  else if (e.code === 'Escape') edClose(); else if (e.code === 'Enter') edTest();
});

/* ---------- what the editor draws over the level ---------- */
const ED_MARK = { d: '⬇️', c: '💢', r: '☄️', f: '👻', m: '⟷', h: '🙈', n: '❔', F: '🎭', u: '🌬️', '<': '⬅️', '>': '➡️', a: '🏹' };
function edOverlay(t) {
  if (!ED.lv || !ED.world) return;
  if (ED.need) edRebuild();
  const G = ED.lv.g, C = edCols(), x0 = Math.max(0, Math.floor(ED.cam / T) - 1), x1 = Math.min(C, Math.ceil((ED.cam + edVW()) / T) + 1);
  worldTransform(0, 0);
  ctx.save();
  // the grid
  ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = x0; x <= x1; x++) { ctx.moveTo(x * T, 0); ctx.lineTo(x * T, H); }
  for (let y = 0; y <= ED_R; y++) { ctx.moveTo(x0 * T, y * T); ctx.lineTo(x1 * T, y * T); }
  ctx.stroke();
  // screen borders
  ctx.strokeStyle = 'rgba(255,211,110,.35)'; ctx.lineWidth = 3; ctx.setLineDash([12, 10]); ctx.beginPath();
  for (let x = ED_SW; x < C; x += ED_SW) { ctx.moveTo(x * T, 0); ctx.lineTo(x * T, H); } ctx.stroke(); ctx.setLineDash([]);
  // marks for the things that look harmless in the picture
  ctx.font = '17px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let y = 0; y < ED_R; y++) for (let x = x0; x < x1; x++) {
    const c = G[y][x];
    if (ED_MARK[c]) { ctx.globalAlpha = .85; ctx.fillText(ED_MARK[c], x * T + T * .72, y * T + T * .3); }
    else if (c === 'K' && x <= (edFind(G, 'P')[0] || [2])[0]) { ctx.globalAlpha = .6; ctx.fillText('🚩', x * T + T / 2, y * T + T / 2); }
  }
  ctx.globalAlpha = 1;
  // teleporter pairs are numbered
  ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#fff';
  for (const [ch, col] of [['t', '#c59bff'], ['T', '#7af7ff']]) edFind(G, ch).sort((a, b) => a[0] - b[0] || a[1] - b[1]).forEach(([x, y], i) => { ctx.fillStyle = col; ctx.fillText(faNum(i + 1), x * T + T / 2, (y - .9) * T); });
  // the robot's best try when it could not finish
  if (ED.botBest) { const b = ED.botBest; ctx.fillStyle = 'rgba(255,61,113,.25)'; ctx.fillRect(b.x - 4, 0, 8, H); ctx.font = '26px sans-serif'; ctx.fillText('🤖', b.x, Math.max(30, b.y - 30)); }
  // cursor
  if (ED.hover && !ED.pan) { const h = ED.hover; ctx.strokeStyle = ED.tool === ' ' ? '#ff5d8a' : '#6ff3c4'; ctx.lineWidth = 3; ctx.strokeRect(h.x * T + 1.5, h.y * T + 1.5, T - 3, T - 3); }
  ctx.restore();
}

/* ---------- robot: searches inputs that beat the level (same search the game's own levels were checked with) ---------- */
const ED_ACTS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 0, 1], [0, 1, 1], [0, 0, 1]].map(a => ({ left: !!a[0], right: !!a[1], jump: !!a[2] }));
let edBotJob = null, edBotLast = null;
function edBotStop() { if (edBotJob) { edBotJob.stop = true; edBotJob = null; } $('edBot').classList.remove('on'); }
function edBotStart() {
  if (!edReady()) return;
  edBotStop();
  const def = edDef(ED.lv), diff = app.diff, w = new World(def, { silent: true, diff }), nSec = def.secs.length;
  const dynIdx = []; w.lv.ents.forEach((e, i) => { if (e.dyn || !(e.type === 'block' || e.type === 'spike')) dynIdx.push(i); });
  const STEPS = 8, dtS = w.D.speed / 120;
  const job = edBotJob = edBotLast = { stop: false, acts: [], sec: 0, t0: performance.now(), secT0: performance.now(), iters: 0, marks: [] };
  let rs = 12345; const Rn = () => { rs = (rs * 1664525 + 1013904223) % 4294967296; return rs / 4294967296; };
  const doorOf = () => w.lv.ents.find(e => e.type === 'door' && !e.fake && !e.gone);
  const goalX = s => s < nSec - 1 ? (def.secs[s + 1].x0 + .45) * T : null;
  // a room counts as passed once you stand on the ground after its flag (so the next room never starts from a doomed jump)
  const done = s => s < nSec - 1 ? w.ck > s && w.p.onGround && w.state === 'play' : w.state === 'win';
  const key = () => {
    const p = w.p; let fs = ''; for (const t of w.lv.trigs) fs += t.fired ? '1' : '0';
    let mq = ''; for (const e of w.act) { if (Math.abs(e.x - p.x) > 280 || e.gone) continue; if (e.patrol) mq += ((e.x / 80) | 0) + '.' + ((e.y / 80) | 0) + e.patrol.i + ';'; if (e.type === 'laser') mq += e.act ? 'L' : 'l'; }
    return ((p.x / 24) | 0) + ',' + ((p.y / 24) | 0) + ',' + p.g + (p.onGround ? 'g' : 'a') + (w.tog ? 't' : '') + fs + mq;
  };
  const score = s => { const p = w.p, gx = goalX(s); if (gx != null) return -Math.abs(gx - p.x) - .15 * Math.abs(p.y - 560); const d = doorOf(); return d ? -(Math.abs(p.x - d.x) + .8 * Math.abs(p.y - d.y)) : 0; };
  const snap = () => w.save(dynIdx), load = sn => w.load(sn, dynIdx);
  const run = a => { for (let i = 0; i < STEPS; i++) { w.step(dtS, ED_ACTS[a]); if (w.state !== 'play') break; } };
  let arch, list, root;
  const begin = () => { root = { snap: snap(), parent: null, acts: [], depth: 0, visits: 0, score: score(job.sec) }; arch = new Map([[key(), root]]); list = [root]; job.secT0 = performance.now(); };
  begin();
  $('edBot').classList.add('on'); $('edBotTxt').textContent = '🤖 ربات داره راه رد شدن رو پیدا می‌کنه…'; $('edBotGo').hidden = true; $('edBotBar').style.transform = 'scaleX(0)';
  // a room gets a share of the minute (at least 9 s); the archive of reached places is capped so phones keep enough memory
  const TOTAL_MS = 60000, SEC_MS = clamp(TOTAL_MS / nSec, 9000, 30000), CAP = 7000;
  const slice = () => {
    if (job.stop) return;
    const until = performance.now() + 22; let found = null;
    while (!found && performance.now() < until) {
      job.iters++;
      let e; if (Rn() < .5) { e = list[(Rn() * list.length) | 0]; for (let k = 0; k < 6; k++) { const c = list[(Rn() * list.length) | 0]; if (c.visits < e.visits) e = c; } }
      else { e = list[(Rn() * list.length) | 0]; for (let k = 0; k < 8; k++) { const c = list[(Rn() * list.length) | 0]; if (c.score > e.score) e = c; } }
      e.visits++; load(e.snap);
      let parent = e, a = (Rn() * 6) | 0; const len = 2 + ((Rn() * 14) | 0); let seq = [];
      for (let i = 0; i < len; i++) {
        if (Rn() < .3) a = (Rn() * 6) | 0;
        run(a); seq.push(a);
        if (w.state === 'dead') break;
        if (done(job.sec)) { found = { parent, seq: seq.slice() }; break; }
        if (w.state !== 'play') break;
        const k = key(), cur = arch.get(k), depth = parent.depth + seq.length;
        if (!cur || depth < cur.depth) {
          const ent = { snap: snap(), parent, acts: seq.slice(), depth, visits: cur ? cur.visits : 0, score: score(job.sec) };
          arch.set(k, ent); if (!cur) list.push(ent); else list[list.indexOf(cur)] = ent;
          parent = ent; seq = [];
        }
        if (list.length > CAP) break;
      }
    }
    const el = performance.now() - job.secT0;
    $('edBotBar').style.transform = `scaleX(${clamp((job.sec + Math.min(1, el / SEC_MS)) / nSec, 0, 1).toFixed(3)})`;
    if (found) {
      const chain = [found.seq]; for (let n = found.parent; n && n.parent; n = n.parent) chain.push(n.acts);
      job.acts.push(...chain.reverse().flat()); job.sec++; job.marks.push({ n: job.acts.length, x: w.p.x, y: w.p.y, ck: w.ck, t: w.time });
      if (job.sec >= nSec) return edBotDone(job, true);
      // the next room starts from where this one was finished (so the whole run can be replayed in one go)
      begin(); $('edBotTxt').textContent = `🤖 اتاق ${faNum(job.sec)} از ${faNum(nSec)} رد شد…`;
    } else if (el > SEC_MS || performance.now() - job.t0 > TOTAL_MS || list.length > CAP) {
      let bx = list[0]; for (const x of list) if (x.score > bx.score) bx = x;
      return edBotDone(job, false, { x: bx.snap.p.x + PW / 2, y: bx.snap.p.y });
    }
    requestAnimationFrame(slice);
  };
  requestAnimationFrame(slice);
}
function edBotDone(job, ok, best) {
  if (job !== edBotJob) return;
  $('edBotBar').style.transform = 'scaleX(1)';
  if (ok) {
    // check the whole run once more on a fresh world, exactly as it will be replayed
    const v = new World(edDef(ED.lv), { silent: true, diff: app.diff }), dtS = v.D.speed / 120;
    for (let i = 0; i < job.acts.length && v.state === 'play'; i++) for (let j = 0; j < 8; j++) { v.step(dtS, ED_ACTS[job.acts[i]]); if (v.state !== 'play') break; }
    ok = v.state === 'win';
  }
  if (ok) {
    ED.lv.bot = true; ED.botActs = job.acts.join(''); ED.botDiff = app.diff; if (!ED.lv.sample) Ed.put(ED.lv);
    $('edBotTxt').textContent = `✅ ربات ردش کرد! (${faNum((job.acts.length * 8 / 120).toFixed(1))} ثانیه)`; $('edBotGo').hidden = false; Sound.play('win'); unlockAch('robot');
  } else {
    ED.botBest = best || null; app.dirty = true;
    $('edBotTxt').textContent = '😵 ربات نتونست ردش کنه. جایی که گیر کرد رو با 🤖 نشون دادم؛ شاید راهی نداره یا خیلی سخته.'; Sound.play('die');
  }
  edBotJob = null;
}
// the level needs a start and a door before it can be played
function edReady() {
  const g = ED.lv.g;
  if (!edFind(g, 'D').length) { edTip('اول یه 🚪 در خروج بذار!'); Sound.play('die'); return false; }
  if (!edFind(g, 'P').length) { edTip('اول جای 🙂 شروع رو مشخص کن!'); Sound.play('die'); return false; }
  return true;
}
// here: start from the part of the level you are looking at (a quick try; it does not count as beating the level)
function edTest(demo, here) {
  if (!edReady()) return;
  let lv = ED.lv;
  if (here) {
    const G = lv.g, C = edCols(), x0 = clamp(Math.floor(ED.cam / T) + 2, 0, C - 1); let spot = null;
    for (let x = x0; x < Math.min(C, x0 + 24) && !spot; x++) for (let y = ED_R - 2; y >= 1; y--) if (' e'.includes(G[y][x]) && ' e'.includes(G[y - 1][x]) && ED_SOLID.includes(G[y + 1][x])) { spot = [x, y]; break; }
    if (!spot) { edTip('اینجا جایی برای وایستادن پیدا نکردم؛ یه کم جابه‌جا شو'); Sound.play('die'); return; }
    lv = JSON.parse(JSON.stringify(lv)); lv.partial = true;
    lv.g = lv.g.map(r => r.replace(/P/g, ' ').replace(/K/g, (m, i) => i <= spot[0] ? ' ' : 'K'));
    lv.g[spot[1]] = lv.g[spot[1]].slice(0, spot[0]) + 'P' + lv.g[spot[1]].slice(spot[0] + 1);
  }
  edBotStop(); $('edUI').classList.remove('on'); if (!ED.lv.sample) Ed.put(ED.lv);
  app.state = 'test'; resize(); STT.tiles.clear();
  app.startCustom(lv, { test: true, demo: demo ? ED.botActs : null });
}

/* ---------- "my levels" screen ---------- */
function edStats(lv) { let n = 0, gem = 0; for (const r of lv.g) for (const c of r) { if (ED_HAZ.has(c)) n++; if (c === 'e') gem++; } return { screens: lv.g[0].length / ED_SW, n, gem, rooms: edDef(lv).secs.length }; }
function renderMy() {
  const L = Ed.list(), all = L.concat(ED_SAMPLES.map((_, i) => edSample(i)));
  $('myList').innerHTML = all.length ? all.map(lv => { const s = edStats(lv);
    return `<div class="myLv${lv.sample ? ' smp' : ''}"><div class="mt"><b>${esc(lv.name)}</b><small>${faNum(s.screens)} صفحه · ${faNum(s.rooms)} اتاق · ${faNum(s.n)} تله${s.gem ? ` · 💎${faNum(s.gem)}` : ''}${lv.mine ? '' : lv.sample ? ' · نمونه' : ' · از یه دوست'}</small>
      <small class="${lv.ok || lv.bot ? 'ok' : 'no'}">${lv.ok ? '✅ خودت ردش کردی' : lv.bot ? '🤖 ربات ردش کرده' : lv.mine ? '⚠️ هنوز تستش نکردی' : '❓ هنوز ردش نکردی'}</small></div>
      <div class="ma"><button class="btn primary" data-play="${lv.id}">▶</button><button class="btn" data-edit="${lv.id}">✏️</button>${lv.sample ? '' : `<button class="btn" data-share="${lv.id}">📤</button><button class="btn" data-del="${lv.id}">🗑</button>`}</div></div>`; }).join('') : '';
}
const edById = id => id.startsWith('sample') ? edSample(+id.slice(6)) : Ed.get(id);
function edCodeBox(mode, lv) {
  const box = $('edCode'); box.classList.add('on'); box.dataset.mode = mode;
  const ta = $('edCodeTa'); ta.readOnly = mode === 'share';
  if (mode === 'share') {
    const okd = lv.ok || lv.bot;
    $('edCodeH').textContent = okd ? `📤 کد «${lv.name}»` : '⚠️ اول خودت (یا ربات) ردش کن';
    $('edCodeP').textContent = okd ? 'این کد رو کپی کن و برای دوستات بفرست. اونا توی «سازنده‌ی مرحله» با «📥 وارد کردن کد» بازیش می‌کنن.' : 'مرحله‌ای که هیچ‌کس نتونسته ردش کنه رو نمی‌شه فرستاد. توی سازنده با ▶ یا 🤖 امتحانش کن.';
    ta.value = okd ? edCode(lv) : ''; ta.hidden = !okd; $('edCodeCopy').hidden = !okd; $('edCodeAdd').hidden = true;
    $('edCodeSend').hidden = !okd || !(window.TelezarApp || navigator.share);
    if (okd) unlockAch('share');
  } else {
    $('edCodeH').textContent = '📥 وارد کردن کد مرحله'; $('edCodeP').textContent = 'کدی که دوستت فرستاده (با TZ1- شروع می‌شه) رو اینجا بچسبون.';
    ta.value = ''; ta.hidden = false; $('edCodeCopy').hidden = true; $('edCodeSend').hidden = true; $('edCodeAdd').hidden = false; setTimeout(() => ta.focus(), 50);
  }
}
$('myList').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; Sound.play('click');
  if (b.dataset.play) { const lv = edById(b.dataset.play); if (lv) app.startCustom(lv, {}); }
  else if (b.dataset.edit) { const lv = edById(b.dataset.edit); if (lv) edOpen(lv); }
  else if (b.dataset.share) { const lv = Ed.get(b.dataset.share); if (lv) edCodeBox('share', lv); }
  else if (b.dataset.del) { const lv = Ed.get(b.dataset.del); if (lv && confirm(`«${lv.name}» پاک بشه؟`)) { Ed.del(lv.id); renderMy(); } }
});
$('bEdNew').onclick = () => { Sound.play('click'); const lv = edNew(2); Ed.put(lv); edOpen(lv); };
$('bEdImp').onclick = () => { Sound.play('click'); edCodeBox('import'); };
$('edCodeX').onclick = () => { Sound.play('click'); $('edCode').classList.remove('on'); };
$('edCodeCopy').onclick = () => {
  const ta = $('edCodeTa'), txt = ta.value; ta.select();
  const ok = () => { $('edCodeCopy').textContent = '✔ کپی شد'; setTimeout(() => $('edCodeCopy').textContent = '📋 کپی', 1500); };
  try {
    if (window.TelezarApp) { TelezarApp.copy(txt); ok(); }
    else if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(ok, () => { document.execCommand('copy'); ok(); });
    else { document.execCommand('copy'); ok(); }
  } catch (e) {}
};
const edShareMsg = txt => 'یه مرحله توی بازی تله‌زار ساختم، ببینم می‌تونی ردش کنی! 😈\nکد مرحله (توی «سازنده‌ی مرحله» ← «وارد کردن کد»):\n' + txt;
$('edCodeSend').onclick = () => {
  const txt = edShareMsg($('edCodeTa').value);
  try { if (window.TelezarApp) TelezarApp.share(txt); else if (navigator.share) navigator.share({ text: txt }).catch(() => {}); } catch (e) {}
};
$('edCodeAdd').onclick = () => {
  const lv = edDecode($('edCodeTa').value);
  if (!lv) { Sound.play('die'); $('edCodeP').textContent = '❌ این کد درست نیست. مطمئن شو کامل کپی شده.'; return; }
  Ed.put(lv); Sound.play('win'); $('edCode').classList.remove('on'); renderMy(); unlockAch('import');
  app.taunt(`📥 «${lv.name}» اضافه شد!`, '#9ef9ff');
};

/* ---------- editor buttons ---------- */
$('edTools').addEventListener('click', e => {
  const b = e.target.closest('[data-t]'); if (!b) return; Sound.play('click');
  ED.tool = b.dataset.t; ED.pan = false; $('edPan').classList.remove('on');
  for (const x of $('edTools').children) x.classList.toggle('on', x === b);
  const t = edTool(ED.tool); edTip(`${t[2]}: ${t[3]}`);
});
$('edUI').addEventListener('click', e => {
  const b = e.target.closest('[data-ed]'); if (!b) return; Sound.play('click');
  const a = b.dataset.ed, lv = ED.lv;
  if (a === 'exit') edClose();
  else if (a === 'test') edTest();
  else if (a === 'bot') edBotStart();
  else if (a === 'undo') edUndo(false);
  else if (a === 'redo') edUndo(true);
  else if (a === 'pan') { ED.pan = !ED.pan; b.classList.toggle('on', ED.pan); for (const x of $('edTools').children) x.classList.toggle('on', !ED.pan && x.dataset.t === ED.tool); edTip(ED.pan ? '✋ حالا با کشیدن روی صفحه، مرحله رو جابه‌جا کن' : 'دوباره می‌تونی بکشی'); }
  else if (a === 'left') edScroll(-edVW() / 2);
  else if (a === 'right') edScroll(edVW() / 2);
  else if (a === 'zoom') { ED.zoom = ED.zoom > 1 ? 1 : 2; b.classList.toggle('on', ED.zoom > 1); edLayout(); edScroll(0); edTip(ED.zoom > 1 ? '🔍 نمای دور: دو برابر بیشتر از مرحله رو می‌بینی' : '🔍 نمای عادی'); }
  else if (a === 'here') edTest(false, true);
  else if (a === 'more' || a === 'less') {
    edOwn(); const C = edCols(), n = C / ED_SW + (a === 'more' ? 1 : -1);
    if (n < 1 || n > ED_MAXS) return edTip(n < 1 ? 'کمتر از یه صفحه نمی‌شه' : `حداکثر ${faNum(ED_MAXS)} صفحه`);
    edPush();
    if (a === 'more') lv.g = lv.g.map((r, y) => r + (y >= 15 ? 'g' : ' ').repeat(ED_SW));
    else { const cut = lv.g.map(r => r.slice(n * ED_SW)); lv.g = lv.g.map(r => r.slice(0, n * ED_SW)); if (cut.some(r => r.includes('D'))) edSet(n * ED_SW - 3, 14, 'D'); if (cut.some(r => r.includes('P'))) edSet(2, 14, 'P'); }
    edScroll(a === 'more' ? 1e9 : 0); edTouch(); edMini(); edTip(`${faNum(n)} صفحه`);
  }
  else if (a === 'name') { edOwn(); const v = prompt('اسم مرحله:', lv.name); if (v != null && v.trim()) { lv.name = v.trim().slice(0, 40); $('edName').textContent = lv.name; edSave(); } }
  else if (a === 'theme') {
    edOwn(); const i = BIOME_ORDER.indexOf(lv.biome); lv.biome = BIOME_ORDER[(i + 1) % BIOME_ORDER.length];
    setBiome(lv.biome); STT.tiles.clear(); edPalette(); edRebuild(); edSave(); edTip(`🎨 ظاهر: ${BIOMES[lv.biome].n || lv.biome}`);
  }
  else if (a === 'clear') { if (confirm('همه‌چیز پاک بشه و از اول شروع کنی؟')) { edOwn(); edPush(); const f = edNew(edCols() / ED_SW); lv.g = f.g; edTouch(); } }
  else if (a === 'help') edTip('🖌 ابزار رو از ستون راست بردار و روی صفحه بکش · ✋ یا دو انگشت = جابه‌جایی · ▶ تست · 🤖 ربات امتحانش می‌کنه · هر 🚩 یه اتاق تازه می‌سازه');
});
$('edBotX').onclick = () => { Sound.play('click'); edBotStop(); };
$('edBotGo').onclick = () => { Sound.play('click'); $('edBot').classList.remove('on'); edTest(true); };
$('bEditor').onclick = () => { Sound.init(); Sound.play('click'); renderMy(); app.open('sMy'); };
