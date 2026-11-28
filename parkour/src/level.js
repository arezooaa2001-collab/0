// سازندهٔ رویه‌ای مراحل: هر بار پارکور جدید، سختی بر اساس شمارهٔ مرحله
import { mulberry32, hashInts, clamp, lerp } from './util.js';
import { PHYS, jumpReach, themeForLevel, MAX_LEVEL } from './config.js';

export function difficulty(level) {
  return clamp(Math.log(1 + level / 8) / Math.log(1 + MAX_LEVEL / 8), 0, 1);
}

// سگمنت‌ها و حداقل مرحله برای ظاهر شدن
const SEGMENTS = [
  { id: 'hop', min: 1, w: 10 },
  { id: 'stairs', min: 1, w: 5 },
  { id: 'pillars', min: 2, w: 6 },
  { id: 'turn', min: 1, w: 4 },
  { id: 'moverX', min: 3, w: 6 },
  { id: 'beam', min: 4, w: 5 },
  { id: 'moverZ', min: 6, w: 4 },
  { id: 'crumble', min: 7, w: 5 },
  { id: 'elevator', min: 8, w: 3 },
  { id: 'bounce', min: 9, w: 4 },
  { id: 'slidebar', min: 10, w: 4 },
  { id: 'wallrun', min: 12, w: 5 },
  { id: 'sweeper', min: 15, w: 4 },
  { id: 'conveyor', min: 18, w: 3 },
  { id: 'lasers', min: 20, w: 4 },
  { id: 'blink', min: 22, w: 4 },
  { id: 'hammers', min: 25, w: 4 },
  { id: 'spinner', min: 28, w: 3 },
  { id: 'ice', min: 35, w: 3 },
  { id: 'gauntlet', min: 45, w: 3 },
];

export function generateLevel(level, mode, salt = 0) {
  const seed = hashInts(level, mode.length * 131 + mode.charCodeAt(0), salt);
  const rng = mulberry32(seed);
  const d = difficulty(level);
  const theme = themeForLevel(level, mode);
  const L = {
    level, mode, seed, d, theme,
    platforms: [], hazards: [], coins: [], route: [], checkpoints: [], segments: [],
    start: null, finish: null, tower: null,
  };

  const speed = PHYS.baseSpeed;
  const reachK = lerp(0.42, 0.8, Math.pow(d, 0.85)); // چقدر به حد توانایی نزدیک شویم
  const sizeK = lerp(1, 0.38, Math.pow(d, 0.8)); // کوچک‌شدن سکوها
  const moveK = lerp(0.7, 1.9, d);
  const segCount = Math.min(36, 7 + Math.floor(level * 0.22) + (level > 200 ? 3 : 0));

  // مکان‌نما: خروجی آخرین سکو
  const cur = { x: 0, y: 0, z: 0, yaw: 0, plat: -1, seg: 0 };
  if (mode === 'down') cur.y = 30 + segCount * 3.8;
  if (mode === 'up') {
    cur.x = 0; cur.z = -26; cur.yaw = Math.PI / 2;
    L.tower = { x: 0, z: 0, r: 10 };
  }

  const dir = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
  const right = (yaw) => ({ x: Math.cos(yaw), z: -Math.sin(yaw) });
  let order = 0;

  function addPlat(p) {
    p.id = L.platforms.length;
    p.order = order++;
    p.seg = cur.seg;
    p.shape = p.shape || 'box';
    p.yaw = p.yaw ?? cur.yaw;
    p.kind = p.kind || 'static';
    L.platforms.push(p);
    return p;
  }
  // سکو با نقطهٔ شروع، طول، عرض
  function placeAhead(gap, dh, len, wid, lat = 0, extra = {}) {
    const f = dir(cur.yaw), r = right(cur.yaw);
    const top = cur.y + dh;
    const th = extra.th ?? (len > 6 ? 1.2 : 0.9);
    const cx = cur.x + f.x * (gap + len / 2) + r.x * lat;
    const cz = cur.z + f.z * (gap + len / 2) + r.z * lat;
    return addPlat({ x: cx, y: top - th / 2, z: cz, sx: wid, sy: th, sz: len, top, ...extra });
  }
  function exitOf(p, latKeep = true) {
    const f = dir(p.yaw);
    const half = p.shape === 'cyl' ? p.r : p.sz / 2;
    cur.x = p.x + f.x * half;
    cur.z = p.z + f.z * half;
    cur.y = p.top;
    cur.plat = p.id;
  }
  // مسیر ربات‌ها
  const anchor = (p, lx, lz) => ({ p: p.id, lx, lz });
  const entryZ = (p) => (p.shape === 'cyl' ? -p.r * 0.35 : -p.sz / 2 + Math.min(1.1, p.sz * 0.3));
  const exitZ = (p) => (p.shape === 'cyl' ? p.r * 0.35 : p.sz / 2 - Math.min(0.5, p.sz * 0.15));
  function routeJump(to, opts = {}) {
    L.route.push({ type: opts.type || 'jump', b: anchor(to, opts.lx ?? 0, opts.lz ?? entryZ(to)), h: opts.h ?? 1, hard: opts.hard ?? 0.3, wall: opts.wall });
  }
  function routeRun(p, opts = {}) {
    L.route.push({ type: opts.type || 'run', a: anchor(p, opts.ax ?? 0, opts.az ?? entryZ(p)), b: anchor(p, opts.bx ?? 0, opts.bz ?? exitZ(p)), hop: opts.hop, wait: opts.wait, hard: opts.hard ?? 0.05 });
  }

  // محاسبهٔ فاصلهٔ مجاز پرش
  function gapFor(dh, k = reachK) {
    const reach = jumpReach(dh, speed);
    return Math.max(1.0, reach * k - 0.35);
  }
  function rndDh() {
    if (mode === 'down') return -rng.range(0.8, 2.4 + d * 2.6);
    if (mode === 'up') return rng.range(0.35, 0.9 + d * 0.45);
    // رو به جلو: بالا و پایین ملایم با بازگشت به ارتفاع پایه
    const pull = -cur.y * 0.08;
    return clamp(rng.range(-0.9, 0.9) + pull, -1.6, 1.1);
  }
  function steer() {
    if (mode === 'up') {
      // مارپیچ دور برج مرکزی
      const ang = Math.atan2(cur.x, cur.z);
      const dist = Math.hypot(cur.x, cur.z);
      const targetR = 24 + Math.sin(cur.seg * 0.7) * 5;
      const tangent = ang + Math.PI / 2;
      const corr = clamp((dist - targetR) * 0.05, -0.5, 0.5);
      cur.yaw = tangent + corr + rng.range(-0.12, 0.12);
    } else {
      const lim = mode === 'down' ? 1.0 : 0.85;
      cur.yaw = clamp(cur.yaw + rng.range(-0.22, 0.22), -lim, lim);
    }
  }
  function coinArc(from, to, n = 3) {
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      L.coins.push({ x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) + 1.2 + Math.sin(t * Math.PI) * 1.4, z: lerp(from.z, to.z, t) });
    }
  }
  function coinsOn(p, n = 3) {
    const f = dir(p.yaw);
    const len = p.shape === 'cyl' ? 0 : p.sz * 0.6;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      L.coins.push({ x: p.x + f.x * len * t, y: p.top + 1.0, z: p.z + f.z * len * t });
    }
  }
  const lastPlat = () => L.platforms[cur.plat];
  const pos = () => ({ x: cur.x, y: cur.y, z: cur.z });

  // ---------- شروع ----------
  const start = placeAhead(0, 0, 14, 16, 0, { kind: 'start', th: 2 });
  {
    const f0 = dir(start.yaw);
    L.start = { x: start.x - f0.x * 3, y: start.top, z: start.z - f0.z * 3, yaw: start.yaw, plat: start.id };
  }
  exitOf(start);
  routeRun(start, { az: -3, bz: exitZ(start) });

  // ---------- سگمنت‌ها ----------
  const BUILD = makeBuilders();
  const pool = SEGMENTS.filter((s) => level >= s.min && !(mode === 'up' && s.id === 'stairs' && false));
  let sinceCheckpoint = 0;
  const cpEvery = level < 10 ? 4 : level < 60 ? 5 : level < 300 ? 6 : 7;
  let lastSeg = '';

  for (let s = 0; s < segCount; s++) {
    cur.seg = s + 1;
    steer();
    // انتخاب سگمنت وزنی (بدون تکرار پشت‌سرهم)
    let tot = 0;
    const cands = pool.filter((p) => p.id !== lastSeg).map((p) => {
      let w = p.w;
      if (mode === 'up' && (p.id === 'elevator' || p.id === 'bounce' || p.id === 'stairs')) w *= 2.2;
      if (mode === 'down' && (p.id === 'stairs' || p.id === 'hop')) w *= 1.6;
      if (mode === 'up' && (p.id === 'moverZ' || p.id === 'conveyor')) w *= 0.5;
      // سگمنت‌های تازه‌باز کمی بیشتر
      if (level - p.min < 6) w *= 1.6;
      tot += w;
      return [p, w];
    });
    let r = rng() * tot, seg = cands[0][0];
    for (const [p, w] of cands) {
      r -= w;
      if (r <= 0) { seg = p; break; }
    }
    lastSeg = seg.id;
    L.segments.push(seg.id);
    BUILD[seg.id]();

    sinceCheckpoint++;
    if (sinceCheckpoint >= cpEvery && s < segCount - 2) {
      sinceCheckpoint = 0;
      cur.seg = s + 1;
      const dh = mode === 'down' ? -1.5 : mode === 'up' ? 0.6 : 0;
      const gap = gapFor(dh, 0.5);
      const from = pos();
      const cp = placeAhead(gap, dh, 6, 6.5, 0, { kind: 'checkpoint', th: 1.4 });
      L.checkpoints.push(cp.id);
      routeJump(cp, { lz: -1.5 });
      L.route.push({ type: 'checkpoint', p: cp.id });
      routeRun(cp, { az: -1.5, bz: exitZ(cp) });
      coinArc(from, { x: cp.x, y: cp.top, z: cp.z }, 2);
      exitOf(cp);
    }
  }

  // ---------- پایان ----------
  cur.seg++;
  {
    const dh = mode === 'down' ? -2 : mode === 'up' ? 0.8 : 0;
    const gap = gapFor(dh, 0.55);
    const fin = placeAhead(gap, dh, 16, 16, 0, { kind: 'finish', th: 2 });
    routeJump(fin, { lz: -fin.sz / 2 + 2 });
    L.route.push({ type: 'finish', p: fin.id });
    L.finish = { x: fin.x, y: fin.top, z: fin.z, yaw: fin.yaw, plat: fin.id };
  }

  // ستون/ساختمان زیر سکوهای ثابت بزرگ (جز حالت بالا رونده)
  if (mode !== 'up') {
    for (const p of L.platforms) {
      if (p.kind !== 'static' && p.kind !== 'start' && p.kind !== 'finish' && p.kind !== 'checkpoint') continue;
      if (p.shape === 'cyl') { p.column = true; continue; }
      const area = p.sx * p.sz;
      if (area < 4) continue;
      // اگر سکوی پایین‌تری زیرش است، ستون نگذار
      let blocked = false;
      for (const q of L.platforms) {
        if (q === p || q.top >= p.top - 0.5) continue;
        const dx = Math.abs(q.x - p.x), dz = Math.abs(q.z - p.z);
        const qr = q.shape === 'cyl' ? q.r : Math.max(q.sx, q.sz) / 2;
        const pr = Math.max(p.sx, p.sz) / 2;
        if (dx < pr + qr + 1.5 && dz < pr + qr + 1.5) { blocked = true; break; }
      }
      if (!blocked) p.column = true;
    }
  }

  // ارتفاع مرگ برای هر سگمنت: پایین‌ترین سکوی سگمنت‌های جاری و بعدی
  const segMin = [];
  for (const p of L.platforms) segMin[p.seg] = Math.min(segMin[p.seg] ?? Infinity, p.top - (p.kind === 'elevator' ? p.amp * 2 : 0));
  L.killY = [];
  for (let i = 0; i < segMin.length; i++) {
    let m = Infinity;
    for (let j = Math.max(0, i - 1); j <= Math.min(segMin.length - 1, i + 2); j++) if (segMin[j] !== undefined) m = Math.min(m, segMin[j]);
    L.killY[i] = m - (mode === 'down' ? 10 : 9);
  }

  // مرزها برای مناظر
  let minY = Infinity, maxY = -Infinity, sx = 0, sz = 0;
  const points = [];
  for (const p of L.platforms) {
    minY = Math.min(minY, p.top);
    maxY = Math.max(maxY, p.top);
    sx += p.x; sz += p.z;
    points.push({ x: p.x, y: p.top, z: p.z });
  }
  const center = { x: sx / L.platforms.length, z: sz / L.platforms.length };
  let radius = 0;
  for (const p of points) radius = Math.max(radius, Math.hypot(p.x - center.x, p.z - center.z));
  L.bounds = { minY, maxY, center, radius, points };
  return L;

  // ================= سگمنت‌ها =================
  function buildHop(n = rng.int(2, 3), kOverride) {
    for (let i = 0; i < n; i++) {
      const dh = rndDh();
      const gap = gapFor(dh, kOverride) * rng.range(0.75, 1);
      const len = Math.max(1.4, rng.range(2.5, 5) * sizeK + 0.6);
      const wid = Math.max(1.3, rng.range(2.5, 4.5) * sizeK + 0.5);
      const lat = rng.range(-1.2, 1.2) * (1 - d * 0.3);
      const from = pos();
      const p = placeAhead(gap, dh, len, wid, lat, {});
      routeJump(p, { lx: 0 });
      routeRun(p);
      if (rng.chance(0.55)) coinArc(from, { x: p.x, y: p.top, z: p.z }, 3);
      exitOf(p);
    }
  }
  function makeBuilders() {
  const B = {
    hop: () => buildHop(),
    stairs: () => {
      const n = rng.int(3, 5);
      const step = mode === 'down' ? -rng.range(1.2, 2.2) : mode === 'up' ? rng.range(0.7, 1.15) : rng.sign() * rng.range(0.5, 0.9);
      for (let i = 0; i < n; i++) {
        const gap = gapFor(step, 0.6) * rng.range(0.6, 0.85);
        const s = Math.max(1.5, 2.6 * sizeK + 0.7);
        const p = placeAhead(gap, step, s, s, (i % 2 ? 1 : -1) * rng.range(0.4, 1.4), {});
        routeJump(p);
        routeRun(p);
        if (i === n - 1) coinsOn(p, 1);
        exitOf(p);
      }
    },
    pillars: () => {
      const n = rng.int(3, 5);
      for (let i = 0; i < n; i++) {
        const dh = rndDh() * 0.7;
        const rr = Math.max(0.65, rng.range(1.0, 1.7) * sizeK + 0.35);
        const gap = gapFor(dh) * rng.range(0.7, 0.95);
        const f = dir(cur.yaw), rt = right(cur.yaw);
        const lat = (i % 2 ? 1 : -1) * rng.range(0.8, 2.2);
        const cx = cur.x + f.x * (gap + rr) + rt.x * lat, cz = cur.z + f.z * (gap + rr) + rt.z * lat;
        const top = cur.y + dh;
        const p = addPlat({ shape: 'cyl', x: cx, y: top - 0.6, z: cz, r: rr, sy: 1.2, top });
        routeJump(p, { lz: 0 });
        if (rng.chance(0.4)) coinsOn(p, 1);
        cur.x = cx + f.x * rr; cur.z = cz + f.z * rr; cur.y = top; cur.plat = p.id;
      }
    },
    turn: () => {
      const dh = mode === 'down' ? -1.4 : mode === 'up' ? 0.6 : rndDh() * 0.5;
      const gap = gapFor(dh, 0.6);
      const s = Math.max(3, 5 * sizeK + 1.5);
      const p = placeAhead(gap, dh, s, s, 0, {});
      routeJump(p, { lz: -s / 2 + 1 });
      coinsOn(p, 2);
      // چرخش مسیر
      const turn = (mode === 'up' ? 0.3 : rng.sign() * rng.range(0.4, 0.9));
      const newYaw = mode === 'up' ? cur.yaw : clamp(cur.yaw + turn, -1.1, 1.1);
      // خروجی در لبهٔ سمت جدید
      const f2 = dir(newYaw);
      const localYaw = newYaw - p.yaw;
      L.route.push({ type: 'run', a: anchor(p, 0, -s / 2 + 1), b: anchor(p, Math.sin(localYaw) * s * 0.4, Math.cos(localYaw) * s * 0.4), hard: 0.02 });
      cur.x = p.x + f2.x * s * 0.5; cur.z = p.z + f2.z * s * 0.5; cur.y = p.top; cur.plat = p.id;
      cur.yaw = newYaw;
    },
    beam: () => {
      const dh = rndDh() * 0.4;
      const gap = gapFor(dh, 0.55);
      const len = rng.range(7, 12);
      const wid = Math.max(0.42, lerp(0.95, 0.42, d));
      const p = placeAhead(gap, dh, len, wid, 0, { th: 0.5, beam: true });
      routeJump(p, { lz: -len / 2 + 0.8 });
      routeRun(p, { az: -len / 2 + 0.8, hard: 0.08 + d * 0.1 });
      coinsOn(p, 4);
      exitOf(p);
      if (rng.chance(0.5)) {
        // تیر دوم با زاویه
        cur.yaw = clamp(cur.yaw + rng.sign() * rng.range(0.3, 0.6), -1.1, 1.1);
        const p2 = placeAhead(gapFor(0, 0.45), 0, rng.range(5, 9), wid, 0, { th: 0.5, beam: true });
        routeJump(p2, { lz: -p2.sz / 2 + 0.8 });
        routeRun(p2, { az: -p2.sz / 2 + 0.8, hard: 0.1 });
        exitOf(p2);
      }
    },
    moverX: () => {
      const n = rng.int(1, 2 + (d > 0.4 ? 1 : 0));
      for (let i = 0; i < n; i++) {
        const dh = rndDh() * 0.6;
        const gap = gapFor(dh) * rng.range(0.7, 0.95);
        const s = Math.max(1.7, 3.2 * sizeK + 0.6);
        const p = placeAhead(gap, dh, s, s, 0, { kind: 'mover' });
        const rt = right(cur.yaw);
        p.axis = { x: rt.x, y: 0, z: rt.z };
        p.amp = rng.range(2, 3.2 + d * 2.5);
        p.period = rng.range(3.6, 5.6) / moveK;
        p.phase = rng() * Math.PI * 2;
        routeJump(p, { lz: 0, hard: 0.4 });
        exitOf(p);
        // خروجی از مرکز مسیر محاسبه می‌شود (سکو حرکت می‌کند)
        const f = dir(cur.yaw);
        cur.x = p.x + f.x * s / 2; cur.z = p.z + f.z * s / 2;
      }
    },
    moverZ: () => {
      const dh = rndDh() * 0.3;
      const longGap = gapFor(dh, 1) + rng.range(4, 8);
      const s = Math.max(2.2, 3.4 * sizeK + 0.8);
      const f = dir(cur.yaw);
      // سکوی رفت‌وبرگشتی بین دو لبه
      const span = longGap;
      const p = placeAhead(span / 2 - s / 2, dh, s, s, 0, { kind: 'mover' });
      p.axis = { x: f.x, y: 0, z: f.z };
      p.amp = Math.max(0.5, span / 2 - s / 2 - 0.3);
      p.period = rng.range(4.5, 6.5) / moveK;
      p.phase = rng() * Math.PI * 2;
      routeJump(p, { lz: 0, hard: 0.35, ride: true });
      L.route.push({ type: 'ride', p: p.id, hard: 0.05 });
      cur.x = p.x + f.x * (span / 2); cur.z = p.z + f.z * (span / 2); cur.y = p.top; cur.plat = p.id;
      const land = placeAhead(gapFor(0, 0.45), 0, 3.5, 3.5, 0, {});
      routeJump(land);
      routeRun(land);
      coinsOn(land, 2);
      exitOf(land);
    },
    elevator: () => {
      const rise = mode === 'down' ? -rng.range(4, 7) : mode === 'up' ? rng.range(4, 8) : rng.range(3, 6) * (cur.y > 6 ? -1 : 1);
      const gap = gapFor(0, 0.6);
      const s = Math.max(2.2, 3 * sizeK + 1);
      const base = Math.min(0, rise);
      const p = placeAhead(gap, base, s, s, 0, { kind: 'elevator' });
      p.axis = { x: 0, y: 1, z: 0 };
      p.amp = Math.abs(rise) / 2;
      p.y += p.amp; p.top += p.amp; // مرکز حرکت
      p.period = rng.range(4, 6) / Math.sqrt(moveK);
      p.phase = rng() * Math.PI * 2;
      routeJump(p, { lz: 0, hard: 0.35 });
      L.route.push({ type: 'ride', p: p.id, until: rise > 0 ? 'top' : 'bottom', hard: 0.05 });
      cur.x = p.x + dir(cur.yaw).x * s / 2; cur.z = p.z + dir(cur.yaw).z * s / 2;
      cur.y = p.top + (rise > 0 ? p.amp : -p.amp) - 0.1;
      cur.plat = p.id;
      const land = placeAhead(gapFor(-0.2, 0.5), -0.2, 3.6, 3.6, 0, {});
      routeJump(land);
      routeRun(land);
      coinsOn(land, 2);
      exitOf(land);
    },
    crumble: () => {
      const n = rng.int(3, 4 + Math.floor(d * 3));
      for (let i = 0; i < n; i++) {
        const dh = rndDh() * 0.5;
        const gap = gapFor(dh, 0.55) * rng.range(0.6, 0.9);
        const s = Math.max(1.5, 2.6 * sizeK + 0.6);
        const p = placeAhead(gap, dh, s, s, rng.range(-0.8, 0.8), { kind: 'crumble' });
        routeJump(p, { hard: 0.3 });
        routeRun(p, { hard: 0.02 });
        if (i % 2) coinsOn(p, 1);
        exitOf(p);
      }
    },
    blink: () => {
      const n = rng.int(3, 5);
      const period = lerp(3.4, 2.2, d);
      for (let i = 0; i < n; i++) {
        const dh = rndDh() * 0.5;
        const gap = gapFor(dh, 0.6) * rng.range(0.7, 0.9);
        const s = Math.max(1.6, 2.8 * sizeK + 0.7);
        const p = placeAhead(gap, dh, s, s, rng.range(-0.6, 0.6), { kind: 'blink' });
        p.period = period;
        p.phase = (i * 0.5) % 1;
        p.onFrac = 0.62;
        routeJump(p, { hard: 0.35, waitBlink: true });
        routeRun(p);
        exitOf(p);
      }
    },
    bounce: () => {
      const rise = mode === 'down' ? rng.range(0.5, 2) : mode === 'up' ? rng.range(5, 7.5) : rng.range(3, 6);
      const gap = gapFor(0, 0.6);
      const pad = placeAhead(gap, mode === 'down' ? -1 : 0, 2.6, 2.6, 0, { kind: 'bounce' });
      routeJump(pad, { lz: 0 });
      exitOf(pad);
      const from = pos();
      const hi = placeAhead(rng.range(3, 5.5), rise, 4.5, 4, 0, {});
      L.route.push({ type: 'bounce', b: anchor(hi, 0, entryZ(hi)), hard: 0.1 });
      routeRun(hi);
      coinArc(from, { x: hi.x, y: hi.top + 3, z: hi.z }, 4);
      exitOf(hi);
    },
    slidebar: () => {
      const dh = rndDh() * 0.3;
      const gap = gapFor(dh, 0.55);
      const len = rng.range(10, 15);
      const wid = Math.max(2.2, 3.4 * sizeK + 1);
      const p = placeAhead(gap, dh, len, wid, 0, {});
      routeJump(p, { lz: -len / 2 + 1 });
      const nb = rng.int(1, 2 + Math.floor(d * 2));
      for (let i = 0; i < nb; i++) {
        const lz = -len / 2 + 3 + (i + 0.5) * ((len - 4) / nb);
        L.hazards.push({ type: 'bar', p: p.id, lz, w: wid + 0.6, y0: 1.05, y1: 3.4 });
      }
      routeRun(p, { az: -len / 2 + 1, type: 'slide' });
      coinsOn(p, 3);
      exitOf(p);
    },
    wallrun: () => {
      const dh = rndDh() * 0.3;
      const span = jumpReach(0, speed) * 1.15 + rng.range(2, 5);
      const f = dir(cur.yaw), rt = right(cur.yaw);
      const side = rng.sign();
      // دیوار در کنار شکاف
      const wl = span + 2;
      const wx = cur.x + f.x * (span / 2) + rt.x * side * 2.3;
      const wz = cur.z + f.z * (span / 2) + rt.z * side * 2.3;
      const wall = addPlat({ kind: 'wall', x: wx, y: cur.y + 1.6, z: wz, sx: 0.6, sy: 4.4, sz: wl, top: cur.y + 3.8, yaw: cur.yaw, wallSide: side });
      const from = pos();
      const land = placeAhead(span, dh, 4, 3.6, 0, {});
      L.route.push({ type: 'wallrun', wall: wall.id, side, b: anchor(land, 0, entryZ(land)), hard: 0.25 });
      routeRun(land);
      coinArc({ x: from.x + rt.x * side * 1.3, y: from.y + 0.5, z: from.z + rt.z * side * 1.3 }, { x: land.x + rt.x * side * 1.3, y: land.top, z: land.z + rt.z * side * 1.3 }, 4);
      exitOf(land);
    },
    sweeper: () => {
      const dh = rndDh() * 0.4;
      const gap = gapFor(dh, 0.6);
      const rr = Math.max(3.2, 4.2 * sizeK + 2);
      const f = dir(cur.yaw);
      const cx = cur.x + f.x * (gap + rr), cz = cur.z + f.z * (gap + rr);
      const top = cur.y + dh;
      const p = addPlat({ shape: 'cyl', x: cx, y: top - 0.6, z: cz, r: rr, sy: 1.2, top });
      L.hazards.push({ type: 'sweeper', p: p.id, len: rr * 2 + 0.6, h: 0.55, speed: lerp(1.3, 2.6, d) * rng.sign(), phase: rng() * 6 });
      routeJump(p, { lz: -rr * 0.6 });
      L.route.push({ type: 'run', a: anchor(p, 0, -rr * 0.6), b: anchor(p, 0, rr * 0.6), hop: true, hard: 0.15 });
      coinsOn(p, 1);
      cur.x = cx + f.x * rr; cur.z = cz + f.z * rr; cur.y = top; cur.plat = p.id;
    },
    conveyor: () => {
      const dh = rndDh() * 0.3;
      const gap = gapFor(dh, 0.55);
      const len = rng.range(8, 13);
      const wid = Math.max(1.8, 3 * sizeK + 0.8);
      const back = rng.chance(0.6);
      const p = placeAhead(gap, dh, len, wid, 0, { kind: 'conveyor' });
      p.belt = back ? { x: 0, z: -1 } : { x: rng.sign(), z: 0 };
      p.beltSpeed = lerp(2.2, 4.8, d);
      routeJump(p, { lz: -len / 2 + 1 });
      routeRun(p, { az: -len / 2 + 1, hard: 0.08 });
      coinsOn(p, 3);
      exitOf(p);
    },
    lasers: () => {
      const dh = rndDh() * 0.3;
      const gap = gapFor(dh, 0.55);
      const len = rng.range(11, 16);
      const wid = Math.max(2.4, 3.6 * sizeK + 1);
      const p = placeAhead(gap, dh, len, wid, 0, {});
      routeJump(p, { lz: -len / 2 + 1 });
      const nl = rng.int(2, 3 + Math.floor(d * 2));
      const period = lerp(3.2, 2.0, d);
      for (let i = 0; i < nl; i++) {
        const lz = -len / 2 + 3 + (i + 0.5) * ((len - 4.5) / nl);
        L.hazards.push({ type: 'laser', p: p.id, lz, w: wid, period, phase: (i * 0.35) % 1, onFrac: lerp(0.45, 0.6, d), low: rng.chance(0.3) });
      }
      routeRun(p, { az: -len / 2 + 1, wait: 'laser', hard: 0.05 });
      coinsOn(p, 2);
      exitOf(p);
    },
    hammers: () => {
      const dh = rndDh() * 0.3;
      const gap = gapFor(dh, 0.55);
      const len = rng.range(10, 15);
      const wid = Math.max(1.6, 2.4 * sizeK + 0.8);
      const p = placeAhead(gap, dh, len, wid, 0, {});
      routeJump(p, { lz: -len / 2 + 1 });
      const nh = rng.int(2, 3 + Math.floor(d * 2));
      for (let i = 0; i < nh; i++) {
        const lz = -len / 2 + 2.5 + (i + 0.5) * ((len - 4) / nh);
        L.hazards.push({ type: 'hammer', p: p.id, lz, arm: 5.2, amp: 1.15, speed: lerp(1.6, 2.6, d) * (0.9 + rng() * 0.2), phase: i * 1.7 + rng() });
      }
      routeRun(p, { az: -len / 2 + 1, hop: false, wait: 'hammer', hard: 0.12 });
      coinsOn(p, 3);
      exitOf(p);
    },
    spinner: () => {
      const dh = rndDh() * 0.3;
      const gap = gapFor(dh, 0.6);
      const len = rng.range(9, 13);
      const wid = Math.max(1.4, 2 * sizeK + 0.7);
      const f = dir(cur.yaw);
      const cx = cur.x + f.x * (gap + len / 2), cz = cur.z + f.z * (gap + len / 2);
      const top = cur.y + dh;
      const p = addPlat({ kind: 'spinner', x: cx, y: top - 0.4, z: cz, sx: wid, sy: 0.8, sz: len, top, yaw: cur.yaw });
      p.spin = lerp(0.35, 0.8, d) * rng.sign();
      p.period = (Math.PI * 2) / Math.abs(p.spin);
      routeJump(p, { lz: 0, hard: 0.4, spinWait: true });
      // خروج در امتداد مسیر اصلی
      cur.x = cx + f.x * (len / 2); cur.z = cz + f.z * (len / 2); cur.y = top; cur.plat = p.id;
      const land = placeAhead(gapFor(0, 0.4), 0, 3.6, 3.6, 0, {});
      routeJump(land, { fromSpin: true });
      routeRun(land);
      exitOf(land);
    },
    ice: () => {
      const n = rng.int(2, 3);
      for (let i = 0; i < n; i++) {
        const dh = rndDh() * 0.4;
        const gap = gapFor(dh, 0.6) * rng.range(0.7, 0.95);
        const p = placeAhead(gap, dh, rng.range(5, 8), Math.max(2, 3 * sizeK + 0.8), rng.range(-0.8, 0.8), { kind: 'ice' });
        routeJump(p, { hard: 0.3 });
        routeRun(p);
        coinsOn(p, 2);
        exitOf(p);
      }
    },
    gauntlet: () => {
      // ترکیب: سکوی متحرک + فروریزنده + پرش بلند
      B.moverX();
      B.crumble();
      buildHop(1, Math.min(0.92, reachK + 0.08));
    },
  };
  return B;
  }
}

// موقعیت جهانی یک لنگر روی سکو در زمان t
export function platTransform(p, t, out = { x: 0, y: 0, z: 0, yaw: 0 }) {
  let x = p.x, y = p.y, z = p.z, yaw = p.yaw;
  if (p.kind === 'mover' || p.kind === 'elevator') {
    const s = Math.sin((t / p.period) * Math.PI * 2 + p.phase) * p.amp;
    x += p.axis.x * s; y += p.axis.y * s; z += p.axis.z * s;
  } else if (p.kind === 'spinner') {
    yaw += t * p.spin;
  }
  out.x = x; out.y = y; out.z = z; out.yaw = yaw;
  return out;
}

export function anchorWorld(L, a, t, out = { x: 0, y: 0, z: 0 }) {
  const p = L.platforms[a.p];
  const tr = platTransform(p, t);
  const c = Math.cos(tr.yaw), s = Math.sin(tr.yaw);
  out.x = tr.x + c * a.lx + s * a.lz;
  out.z = tr.z - s * a.lx + c * a.lz;
  out.y = tr.y + (p.top - p.y);
  return out;
}

export function blinkOn(p, t) {
  const f = ((t / p.period + p.phase) % 1 + 1) % 1;
  return f < p.onFrac;
}
export function laserOn(h, t) {
  const f = ((t / h.period + h.phase) % 1 + 1) % 1;
  return f < h.onFrac;
}
