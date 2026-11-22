// ساخت پیست مسابقه واقعی و طولانی برای هر مرحله (تولید رویه‌ای با بذر ثابت)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32, makeNoise2D, clamp, lerp, smoothstep, mergeGeos, TAU, optimizeStatic, fillAttr } from './utils.js';
import * as T from './textures.js';
import { createCrowd, buildHuman, patternMaterial } from './human.js';

export const DS = 2; // فاصله نمونه‌ها (متر)
export const TEAM_COLORS = ['fire', '#1e6bff', '#19c25a', '#8e3bff', '#00c2c7', '#ff3fa4', '#eef2f6'];
export const TEAM_NAMES = ['قهرمان', 'آبی', 'سبز', 'بنفش', 'فیروزه‌ای', 'صورتی', 'سفید'];
const TRACK_NAMES = ['پیست البرز', 'پیست دماوند', 'پیست خلیج', 'پیست کویر', 'پیست زاگرس', 'پیست ستاره', 'پیست طلایی', 'پیست کوهستان', 'پیست جنگل', 'پیست ساحل', 'پیست شاهین', 'پیست مروارید'];

// ---------------- تولید شکل پیست ----------------
function tryLayout(rng, diff) {
  const S = rng.range(700, 950) + diff * 200;
  const n = 6 + Math.floor(diff * 6) + rng.int(0, 3);
  const R0 = rng.range(560, 720) + diff * 380;
  const ex = rng.range(1.0, 1.35);
  const pts = [new THREE.Vector2(-S / 2, -R0 * 0.78), new THREE.Vector2(S / 2, -R0 * 0.78)];
  const a1 = Math.atan2(pts[1].y, pts[1].x), a0 = Math.atan2(pts[0].y, pts[0].x) + TAU;
  for (let k = 1; k <= n; k++) {
    const a = a1 + (a0 - a1) * (k / (n + 1)) + (rng() - 0.5) * ((a0 - a1) / (n + 1)) * 0.5;
    const pull = rng() < 0.18 + diff * 0.2 ? rng.range(0.35, 0.55) : rng.range(0.7, 1.08);
    const r = R0 * pull;
    pts.push(new THREE.Vector2(Math.cos(a) * r * ex, Math.sin(a) * r));
  }
  // گوشه‌ها با قوس (شعاع ثابت) گرد می‌شوند
  const N = pts.length;
  const corners = [];
  for (let i = 0; i < N; i++) {
    const P = pts[(i - 1 + N) % N], V = pts[i], Q = pts[(i + 1) % N];
    const d1 = V.clone().sub(P), d2 = Q.clone().sub(V);
    const l1 = d1.length(), l2 = d2.length(); d1.normalize(); d2.normalize();
    const cross = d1.x * d2.y - d1.y * d2.x; const dot = clamp(d1.dot(d2), -1, 1);
    const th = Math.atan2(cross, dot);
    if (Math.abs(th) > 2.75) return null;
    let r = lerp(150, 55, diff) * rng.range(0.55, 1.5);
    if (rng() < 0.15 + diff * 0.2) r = rng.range(24, 40);
    let lim = 0.46 * Math.min(l1, l2);
    if (i <= 1) lim = Math.min(lim, S * 0.22);
    let t = Math.abs(th) > 0.02 ? r * Math.tan(Math.abs(th) / 2) : 0;
    if (t > lim) { t = lim; r = t / Math.tan(Math.abs(th) / 2); }
    if (Math.abs(th) > 0.02 && r < 22) return null;
    corners.push({ V, d1, d2, th, r, t });
  }
  // ساخت خط شکسته متراکم
  const poly = [];
  let mainA = 0, mainB = 0;
  const pushLine = (a, b) => { const len = a.distanceTo(b); const k = Math.max(1, Math.ceil(len / 4)); for (let j = 1; j <= k; j++) poly.push(a.clone().lerp(b, j / k)); };
  let last = null;
  const lengthOf = () => { let L = 0; for (let j = 1; j < poly.length; j++) L += poly[j].distanceTo(poly[j - 1]); return L; };
  for (let i = 0; i < N; i++) {
    const c = corners[i];
    const T1 = c.V.clone().sub(c.d1.clone().multiplyScalar(c.t));
    const T2 = c.V.clone().add(c.d2.clone().multiplyScalar(c.t));
    if (last) pushLine(last, T1); else poly.push(T1.clone());
    if (i === 1) mainB = lengthOf();
    if (c.t > 0) {
      const sgn = Math.sign(c.th);
      const nrm = new THREE.Vector2(-c.d1.y, c.d1.x).multiplyScalar(sgn);
      const C = T1.clone().add(nrm.multiplyScalar(c.r));
      const a0 = Math.atan2(T1.y - C.y, T1.x - C.x);
      const steps = Math.max(2, Math.ceil(Math.abs(c.th) / (2 * Math.PI / 180)));
      for (let j = 1; j <= steps; j++) { const a = a0 + c.th * (j / steps); poly.push(new THREE.Vector2(C.x + Math.cos(a) * c.r, C.y + Math.sin(a) * c.r)); }
    }
    if (i === 0) mainA = lengthOf();
    last = T2;
  }
  pushLine(last, poly[0]);
  poly.pop();
  // بازنمونه‌گیری یکنواخت
  const cum = [0];
  for (let j = 1; j <= poly.length; j++) cum.push(cum[j - 1] + poly[j % poly.length].distanceTo(poly[j - 1]));
  const total = cum[cum.length - 1];
  const ns = Math.round(total / DS);
  const res = [];
  let seg = 0;
  for (let k = 0; k < ns; k++) {
    const s = (k / ns) * total;
    while (cum[seg + 1] < s) seg++;
    const f = (s - cum[seg]) / (cum[seg + 1] - cum[seg]);
    res.push(poly[seg].clone().lerp(poly[(seg + 1) % poly.length], f));
  }
  // نرم کردن اتصال‌ها (منحنی انتقالی)
  for (let pass = 0; pass < 3; pass++) {
    const cp = res.map((p) => p.clone());
    for (let k = 0; k < ns; k++) {
      const acc = new THREE.Vector2(); for (let o = -3; o <= 3; o++) acc.add(cp[(k + o + ns) % ns]);
      res[k] = acc.multiplyScalar(1 / 7);
    }
  }
  const startS = mainA + 0.62 * (mainB - mainA);
  return { pts: res, total: ns * DS, startS, mainA, mainB };
}

function validate(pts) {
  const n = pts.length;
  const cell = 70; const grid = new Map();
  for (let i = 0; i < n; i += 2) { const k = Math.floor(pts[i].x / cell) + ',' + Math.floor(pts[i].y / cell); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
  for (let i = 0; i < n; i += 2) {
    const cx = Math.floor(pts[i].x / cell), cy = Math.floor(pts[i].y / cell);
    for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) {
      const l = grid.get((cx + gx) + ',' + (cy + gy)); if (!l) continue;
      for (const j of l) {
        let di = Math.abs(i - j); di = Math.min(di, n - di);
        if (di * DS < 260) continue;
        if (pts[i].distanceToSquared(pts[j]) < 72 * 72) return false;
      }
    }
  }
  // حداقل شعاع پیچ
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 3 + n) % n], b = pts[i], c = pts[(i + 3) % n];
    const h1 = Math.atan2(b.y - a.y, b.x - a.x), h2 = Math.atan2(c.y - b.y, c.x - b.x);
    let dh = h2 - h1; while (dh > Math.PI) dh -= TAU; while (dh < -Math.PI) dh += TAU;
    if (Math.abs(dh) / (6 * DS) > 1 / 18) return false;
  }
  return true;
}

function fallbackLayout() {
  const res = []; const L = 4200; const ns = L / DS;
  for (let k = 0; k < ns; k++) {
    const s = k / ns * TAU; res.push(new THREE.Vector2(Math.cos(s) * 900, Math.sin(s) * 420));
  }
  return { pts: res, total: L, startS: 0, mainA: 0, mainB: 300 };
}

export function generateLayout(level) {
  const diff = clamp((level - 1) / 999, 0, 1);
  for (let attempt = 0; attempt < 60; attempt++) {
    const rng = mulberry32(level * 9973 + attempt * 7919 + 17);
    const lay = tryLayout(rng, diff);
    if (lay && lay.total > 3000 && lay.total < 9500 && validate(lay.pts)) return { ...lay, attempt };
  }
  return fallbackLayout();
}

// ---------------- کلاس پیست ----------------
export class Track {
  constructor(level, opts = {}) {
    this.level = level;
    this.opts = { quality: 'high', fanFill: 0.6, trees: 1, bossTeam: -1, ...opts };
    this.diff = clamp((level - 1) / 999, 0, 1);
    this.rng = mulberry32(level * 31 + 5);
    this.name = TRACK_NAMES[(level - 1) % TRACK_NAMES.length] + ' ' + ['', 'شمالی', 'جنوبی', 'شرقی', 'غربی'][Math.floor((level - 1) / TRACK_NAMES.length) % 5];
    this.group = new THREE.Group();
    this.crowds = [];
    this.flags = [];
    this.lamps = [];
    this.updaters = [];
    this.makeSamples();
  }

  makeSamples() {
    const lay = generateLayout(this.level);
    const n = lay.pts.length;
    const off = Math.round(lay.startS / DS);
    const pts = []; for (let k = 0; k < n; k++) pts.push(lay.pts[(k + off) % n]);
    this.n = n; this.length = n * DS;
    const mainStart = ((Math.round(lay.mainA / DS) - off) % n + n) % n;
    const mainEnd = ((Math.round(lay.mainB / DS) - off) % n + n) % n;
    this.mainBack = (n - mainStart) % n; // تعداد نمونه قبل از خط شروع روی صاف اصلی
    this.mainFwd = mainEnd; // تعداد نمونه بعد از خط شروع
    const A = (k) => new Float32Array(k);
    this.px = A(n); this.py = A(n); this.pz = A(n); this.tx = A(n); this.tz = A(n); this.ty = A(n);
    this.kappa = A(n); this.ks = A(n); this.hw = A(n); this.wallL = A(n); this.wallR = A(n);
    this.kerbL = new Uint8Array(n); this.kerbR = new Uint8Array(n); this.surfL = new Uint8Array(n); this.surfR = new Uint8Array(n);
    this.barL = new Uint8Array(n); this.barR = new Uint8Array(n); this.rl = A(n); this.heading = A(n);
    for (let i = 0; i < n; i++) { this.px[i] = pts[i].x; this.pz[i] = pts[i].y; }
    // ارتفاع (تپه و دره) با صاف بودن صاف اصلی
    const rng = mulberry32(this.level * 77 + 3);
    const amp = 3 + this.diff * 24 + rng() * 6;
    const waves = []; for (let k = 1; k <= 4; k++) waves.push({ k, a: amp * rng.range(0.3, 1) / k, ph: rng() * TAU });
    const L = this.length;
    for (let i = 0; i < n; i++) {
      const s = i * DS; let h = 0;
      for (const w of waves) h += w.a * Math.sin(TAU * w.k * s / L + w.ph);
      const dStart = Math.min(i, n - i) * DS;
      const inMain = i <= this.mainFwd || i >= n - this.mainBack;
      const flat = inMain ? 0 : smoothstep(0, 250, Math.min(Math.abs(i - this.mainFwd), Math.abs((n - this.mainBack) - i)) * DS);
      this.py[i] = h * flat + 0 * dStart;
    }
    // هموارسازی ارتفاع
    for (let pass = 0; pass < 4; pass++) { const c = this.py.slice(); for (let i = 0; i < n; i++) { let a = 0; for (let o = -6; o <= 6; o++) a += c[(i + o + n) % n]; this.py[i] = a / 13; } }
    for (let i = 0; i < n; i++) {
      const a = (i - 1 + n) % n, b = (i + 1) % n;
      let dx = this.px[b] - this.px[a], dz = this.pz[b] - this.pz[a]; const l = Math.hypot(dx, dz);
      this.tx[i] = dx / l; this.tz[i] = dz / l; this.ty[i] = (this.py[b] - this.py[a]) / (2 * DS);
      this.heading[i] = Math.atan2(this.tx[i], this.tz[i]);
    }
    for (let i = 0; i < n; i++) {
      const a = (i - 2 + n) % n, b = (i + 2) % n;
      let dh = this.heading[b] - this.heading[a]; while (dh > Math.PI) dh -= TAU; while (dh < -Math.PI) dh += TAU;
      this.kappa[i] = dh / (4 * DS);
    }
    // انحنای هموار
    for (let i = 0; i < n; i++) { let a = 0; for (let o = -10; o <= 10; o++) a += this.kappa[(i + o + n) % n]; this.ks[i] = a / 21; }
    // عرض پیست، دیوارها، کرب‌ها، سطوح ایمنی
    const baseHW = lerp(7.2, 5.8, this.diff);
    const crng = mulberry32(this.level * 13 + 1);
    const cornerType = new Uint8Array(n); let ct = crng() < 0.5 ? 1 : 2;
    let inCorner = false;
    const wl = new Float32Array(n), wr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const inMain = i <= this.mainFwd || i >= n - this.mainBack;
      this.hw[i] = baseHW + (inMain ? 1.2 : 0);
      const k = this.ks[i]; const ak = Math.abs(k);
      const corner = ak > 1 / 260;
      if (corner && !inCorner) ct = crng() < 0.55 ? 1 : 2;
      inCorner = corner; cornerType[i] = corner ? ct : 0;
      const out = 9 + 22 * clamp(ak * 70, 0, 1), inn = 6;
      const r = 1 / Math.max(ak, 1e-4);
      // k>0 پیچ به چپ: بیرون = راست
      wl[i] = k > 0 ? Math.min(inn, r * 0.55) : out; wr[i] = k > 0 ? out : Math.min(inn, r * 0.55);
      if (!corner) { wl[i] = 7; wr[i] = 7; }
    }
    // گسترش و هموارسازی دیوارها
    const dilate = (src) => { const o = new Float32Array(n); for (let i = 0; i < n; i++) { let m = 0; for (let k = -30; k <= 30; k++) m = Math.max(m, src[(i + k + n) % n]); o[i] = m; } return o; };
    const smooth = (src, w) => { const o = new Float32Array(n); for (let i = 0; i < n; i++) { let a = 0; for (let k = -w; k <= w; k++) a += src[(i + k + n) % n]; o[i] = a / (2 * w + 1); } return o; };
    const wl2 = smooth(dilate(wl), 15), wr2 = smooth(dilate(wr), 15);
    for (let i = 0; i < n; i++) {
      const r = 1 / Math.max(Math.abs(this.ks[i]), 1e-4);
      let L2 = Math.min(wl2[i], 28), R2 = Math.min(wr2[i], 28);
      if (this.ks[i] > 0) L2 = Math.min(L2, r * 0.55 + 2); else R2 = Math.min(R2, r * 0.55 + 2);
      this.wallL[i] = this.hw[i] + 1.3 + Math.max(3.5, L2);
      this.wallR[i] = this.hw[i] + 1.3 + Math.max(3.5, R2);
      const inMain = i <= this.mainFwd + 10 || i >= n - this.mainBack - 10;
      if (inMain) { this.wallL[i] = this.hw[i] + 4.5; this.wallR[i] = this.hw[i] + 3.0; }
      const corner = Math.abs(this.ks[i]) > 1 / 300;
      this.kerbL[i] = this.kerbR[i] = corner ? 1 : 0;
      const outsideIsLeft = this.ks[i] < 0;
      const t = cornerType[i] || 0;
      this.surfL[i] = outsideIsLeft && t ? t : 0; this.surfR[i] = !outsideIsLeft && t ? t : 0;
      // نوع مانع: ۰ گاردریل، ۱ دیوار لاستیکی، ۲ دیوار بتنی با توری
      this.barL[i] = inMain ? 2 : (outsideIsLeft && Math.abs(this.ks[i]) > 1 / 180 ? 1 : 0);
      this.barR[i] = inMain ? 2 : (!outsideIsLeft && Math.abs(this.ks[i]) > 1 / 180 ? 1 : 0);
    }
    // گسترش کرب‌ها
    const kl = this.kerbL.slice();
    for (let i = 0; i < n; i++) { let f = 0; for (let k = -8; k <= 8; k++) f |= kl[(i + k + n) % n]; this.kerbL[i] = this.kerbR[i] = f; }
    const bl = this.barL.slice(), br = this.barR.slice();
    for (let i = 0; i < n; i++) { let a = 0, b = 0; for (let k = -20; k <= 20; k++) { a = Math.max(a, bl[(i + k + n) % n]); b = Math.max(b, br[(i + k + n) % n]); } this.barL[i] = a; this.barR[i] = b; }
    // خط مسابقه (بیرون-داخل-بیرون)
    const rl0 = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const inside = clamp(this.ks[i] * 110, -1, 1);
      const ahead = clamp(this.ks[(i + 30) % n] * 110, -1, 1);
      rl0[i] = clamp(inside - ahead * 0.75 * (1 - Math.abs(inside)), -1, 1);
    }
    const rl1 = smooth(rl0, 12);
    for (let i = 0; i < n; i++) this.rl[i] = rl1[i];
    // جدول مکانی برای جستجو
    this.cell = 40; this.grid = new Map();
    for (let i = 0; i < n; i++) { const k = Math.floor(this.px[i] / this.cell) + ',' + Math.floor(this.pz[i] / this.cell); if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(i); }
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (let i = 0; i < n; i++) { minX = Math.min(minX, this.px[i]); maxX = Math.max(maxX, this.px[i]); minZ = Math.min(minZ, this.pz[i]); maxZ = Math.max(maxZ, this.pz[i]); }
    this.bounds = { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
    this.corners = [];
    let cs = -1;
    for (let i = 0; i < n; i++) {
      const c = Math.abs(this.ks[i]) > 1 / 200;
      if (c && cs < 0) cs = i;
      if (!c && cs >= 0) { let best = cs, bk = 0; for (let j = cs; j < i; j++) if (Math.abs(this.ks[j]) > bk) { bk = Math.abs(this.ks[j]); best = j; } this.corners.push({ i: best, k: this.ks[best], start: cs, end: i }); cs = -1; }
    }
  }

  // ---------- پرس‌وجو ----------
  idx(i) { return ((i % this.n) + this.n) % this.n; }
  locate(x, z, hint = -1, out = {}) {
    const n = this.n; let best = -1, bd = 1e18;
    if (hint >= 0) {
      for (let k = -30; k <= 30; k++) { const i = (hint + k + n) % n; const dx = this.px[i] - x, dz = this.pz[i] - z; const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
      if (bd > 45 * 45) best = -1;
    }
    if (best < 0) {
      bd = 1e18;
      const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
      for (let gx = -2; gx <= 2; gx++) for (let gz = -2; gz <= 2; gz++) {
        const l = this.grid.get((cx + gx) + ',' + (cz + gz)); if (!l) continue;
        for (const i of l) { const dx = this.px[i] - x, dz = this.pz[i] - z; const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
      }
      if (best < 0) for (let i = 0; i < n; i += 4) { const dx = this.px[i] - x, dz = this.pz[i] - z; const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
    }
    // تصویر روی پاره‌خط
    let i = best; const j = (i + 1) % n;
    let f = ((x - this.px[i]) * this.tx[i] + (z - this.pz[i]) * this.tz[i]) / DS;
    if (f < 0) { i = (i - 1 + n) % n; f += 1; }
    f = clamp(f, 0, 1);
    const i2 = (i + 1) % n;
    const cx = lerp(this.px[i], this.px[i2], f), cz = lerp(this.pz[i], this.pz[i2], f);
    const lx = this.tz[i], lz = -this.tx[i];
    out.i = i; out.f = f; out.s = (i + f) * DS;
    out.d = (x - cx) * lx + (z - cz) * lz;
    out.y = lerp(this.py[i], this.py[i2], f);
    out.hw = this.hw[i]; out.wallL = lerp(this.wallL[i], this.wallL[i2], f); out.wallR = lerp(this.wallR[i], this.wallR[i2], f);
    out.tx = this.tx[i]; out.tz = this.tz[i]; out.lx = lx; out.lz = lz; out.slope = this.ty[i];
    return out;
  }
  // موقعیت جهانی از (s, d)
  pointAt(s, d, out = new THREE.Vector3()) {
    const L = this.length; s = ((s % L) + L) % L;
    const fi = s / DS; const i = Math.floor(fi) % this.n; const f = fi - Math.floor(fi); const j = (i + 1) % this.n;
    const x = lerp(this.px[i], this.px[j], f), z = lerp(this.pz[i], this.pz[j], f), y = lerp(this.py[i], this.py[j], f);
    const lx = lerp(this.tz[i], this.tz[j], f), lz = -lerp(this.tx[i], this.tx[j], f);
    return out.set(x + lx * d, y, z + lz * d);
  }
  headingAt(s) { const L = this.length; s = ((s % L) + L) % L; const fi = s / DS; const i = Math.floor(fi) % this.n; const j = (i + 1) % this.n; const f = fi - Math.floor(fi); let a = this.heading[i], b = this.heading[j]; let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return a + d * f; }

  // ---------------- ساخت همه اجزای سه‌بعدی ----------------
  build() {
    const q = this.opts.quality;
    this.buildRoad();
    this.buildKerbs();
    this.buildShoulders();
    this.buildBarriers();
    this.buildTerrain();
    this.buildStartArea();
    this.buildStands();
    this.buildPit();
    this.buildBillboards();
    this.buildTowers();
    this.buildBridge();
    this.buildTrees();
    this.buildMountains();
    this.buildMarshals();
    return this.group;
  }

  // ریبون عمومی در طول پیست
  ribbon(i0, i1, profile, opts = {}) {
    const n = this.n; const pos = [], uv = [], idx = [], col = [];
    const count = i1 - i0; if (count < 1) return null;
    let rows = 0; let np = 0;
    for (let k = 0; k <= count; k++) {
      const i = (i0 + k) % n;
      const prof = profile(i);
      if (!prof) continue;
      np = prof.length;
      const lx = this.tz[i], lz = -this.tx[i];
      for (const p of prof) {
        const d = p[0], h = p[1];
        const x = this.px[i] + lx * d, z = this.pz[i] + lz * d, y = this.py[i] + h;
        pos.push(x, y, z);
        if (opts.worldUV) uv.push(x / opts.worldUV, z / opts.worldUV); else uv.push(p[2] ?? d / (opts.uScale || 4), (i0 + k) * DS / (opts.vScale || 4));
        if (opts.colors) col.push(...(p[3] || [1, 1, 1]));
      }
      rows++;
    }
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < np - 1; c++) {
      const a = r * np + c, b = a + np;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (opts.colors) g.setAttribute('color', new THREE.Float32BufferAttribute(col, opts.alpha ? 4 : 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  roadMaterial() {
    const a = T.asphalt();
    const mat = new THREE.MeshStandardMaterial({ map: a.map, normalMap: a.normal, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: a.rough, roughness: 1.0, metalness: 0.0, color: 0xc8c8cc });
    const macro = T.macroNoise();
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.tMacro = { value: macro };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform sampler2D tMacro;')
        .replace('#include <map_fragment>', '#include <map_fragment>\nfloat mn = texture2D(tMacro, vWP.xz / 90.0).r; float mn2 = texture2D(tMacro, vWP.xz / 17.0 + 0.3).r;\ndiffuseColor.rgb *= 0.78 + 0.32 * mn + 0.12 * (mn2 - 0.5);');
    };
    return mat;
  }

  buildRoad() {
    const n = this.n;
    const prof = (i) => { const w = this.hw[i]; return [[-w - 0.3, 0.0], [-w, 0.02], [-w * 0.5, 0.035], [0, 0.04], [w * 0.5, 0.035], [w, 0.02], [w + 0.3, 0.0]]; };
    const road = new THREE.Mesh(this.ribbon(0, n, prof, { uScale: 4, vScale: 4 }), this.roadMaterial());
    road.receiveShadow = true; this.group.add(road);
    // خطوط سفید کناری
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const sd of [1, -1]) {
      const g = this.ribbon(0, n, (i) => { const w = this.hw[i]; const a = sd * (w - 0.45), b = sd * (w - 0.25); return sd > 0 ? [[a, 0.028], [b, 0.026]] : [[b, 0.026], [a, 0.028]]; });
      const m = new THREE.Mesh(g, lineMat); m.receiveShadow = true; this.group.add(m);
    }
    // اثر لاستیک روی خط مسابقه
    const rubberG = this.ribbon(0, n, (i) => {
      const c = this.rl[i] * (this.hw[i] - 2); const a = clamp(0.1 + Math.abs(this.ks[i]) * 25, 0.1, 0.35);
      const brake = clamp(Math.abs(this.ks[(i + 25) % n]) * 30 - Math.abs(this.ks[i]) * 10, 0, 0.25);
      const al = a + brake;
      return [[c - 1.6, 0.045, 0, [0, 0, 0, 0]], [c - 0.9, 0.045, 0, [0, 0, 0, al]], [c + 0.9, 0.045, 0, [0, 0, 0, al]], [c + 1.6, 0.045, 0, [0, 0, 0, 0]]];
    }, { colors: true, alpha: true });
    const rubber = new THREE.Mesh(rubberG, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    this.group.add(rubber);
  }

  buildKerbs() {
    const n = this.n; const pos = [], col = [], idx = [];
    const red = new THREE.Color(0xd8141c).convertSRGBToLinear(), white = new THREE.Color(0xf4f4f4).convertSRGBToLinear();
    for (const sd of [1, -1]) {
      const flag = sd > 0 ? this.kerbL : this.kerbR;
      for (let i = 0; i < n; i++) {
        if (!flag[i] || !flag[(i + 1) % n]) continue;
        const c = Math.floor((i * DS) / 3) % 2 ? red : white;
        const prof = [[0, 0.02], [0.18, 0.075], [1.05, 0.075], [1.3, 0.02]];
        const base = pos.length / 3;
        for (const ii of [i, (i + 1) % n]) {
          const w = this.hw[ii]; const lx = this.tz[ii], lz = -this.tx[ii];
          for (const [dd, h] of prof) {
            const d = sd * (w + dd);
            pos.push(this.px[ii] + lx * d, this.py[ii] + h, this.pz[ii] + lz * d); col.push(c.r, c.g, c.b);
          }
        }
        for (let k = 0; k < 3; k++) { const a = base + k, b = base + 4 + k; if (sd > 0) idx.push(a, b, a + 1, a + 1, b, b + 1); else idx.push(a, a + 1, b, a + 1, b + 1, b); }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }));
    m.receiveShadow = true; this.group.add(m);
  }

  buildShoulders() {
    const n = this.n;
    const g = T.grass(), gr = T.gravel(), a = T.asphalt();
    const buckets = { 0: [], 1: [], 2: [] };
    const push = (type, i, d0, d1, h0, h1) => {
      const j = (i + 1) % n; const b = buckets[type];
      const verts = [];
      for (const ii of [i, j]) {
        const lx = this.tz[ii], lz = -this.tx[ii];
        for (const [d, h] of [[d0(ii), h0], [d1(ii), h1]]) verts.push([this.px[ii] + lx * d, this.py[ii] + h, this.pz[ii] + lz * d]);
      }
      b.push(verts);
    };
    for (let i = 0; i < n; i++) {
      for (const sd of [1, -1]) {
        const kerb = (sd > 0 ? this.kerbL : this.kerbR)[i];
        const surf = (sd > 0 ? this.surfL : this.surfR)[i];
        const wall = (ii) => (sd > 0 ? this.wallL : this.wallR)[ii];
        const din = (ii) => sd * (this.hw[ii] + 0.3);
        const dmid = (ii) => sd * Math.min(this.hw[ii] + (kerb ? 3.5 : 2.5), wall(ii) - 0.5);
        const dwall = (ii) => sd * (wall(ii) + 0.6);
        const dout = (ii) => sd * (wall(ii) + 16);
        const fix = (f1, f2) => (sd > 0 ? [f1, f2] : [f2, f1]);
        const [a1, b1] = fix(din, dmid); push(surf === 2 ? 2 : 0, i, a1, b1, 0, 0);
        const [a2, b2] = fix(dmid, dwall); push(surf, i, a2, b2, 0, 0);
        const [a3, b3] = fix(dwall, dout); push(0, i, a3, b3, sd > 0 ? 0 : -0.9, sd > 0 ? -0.9 : 0);
      }
    }
    const make = (list) => {
      const pos = [], uv = [], idx = [];
      for (const q of list) {
        const b = pos.length / 3;
        for (const v of q) { pos.push(...v); uv.push(v[0] / 6, v[2] / 6); }
        idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
      return geo;
    };
    const grassMat = this.grassMaterial();
    const gravelMat = new THREE.MeshStandardMaterial({ map: gr.map, normalMap: gr.normal, roughness: 1, color: 0xe0d6c0 });
    const runMat = new THREE.MeshStandardMaterial({ map: a.map, normalMap: a.normal, roughness: 0.95, color: 0x9aa7bd });
    const mats = { 0: grassMat, 1: gravelMat, 2: runMat };
    for (const k of [0, 1, 2]) {
      if (!buckets[k].length) continue;
      const m = new THREE.Mesh(make(buckets[k]), mats[k]); m.receiveShadow = true; m.material.side = THREE.DoubleSide; this.group.add(m);
    }
  }

  grassMaterial() {
    if (this._grassMat) return this._grassMat;
    const g = T.grass(); const macro = T.macroNoise();
    const mat = new THREE.MeshStandardMaterial({ map: g.map, normalMap: g.normal, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.95, color: 0xd8e8c8 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.tMacro = { value: macro };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform sampler2D tMacro;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          float m1 = texture2D(tMacro, vWP.xz / 260.0).r; float m2 = texture2D(tMacro, vWP.xz / 45.0 + 0.5).r;
          float stripe = step(0.5, fract((vWP.x * 0.7 + vWP.z * 0.7) / 14.0));
          diffuseColor.rgb *= vec3(0.86 + 0.3 * m1, 0.92 + 0.18 * m1, 0.85 + 0.2 * m2) * (0.95 + 0.06 * stripe);`);
    };
    this._grassMat = mat; return mat;
  }

  buildBarriers() {
    const n = this.n;
    const segments = (flagArr, type) => { const out = []; let st = -1; for (let i = 0; i <= n; i++) { const on = i < n && flagArr[i] === type; if (on && st < 0) st = i; if (!on && st >= 0) { out.push([st, i]); st = -1; } } return out; };
    const steel = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, metalness: 0.85, roughness: 0.35 });
    const conc = T.concrete(); const ad = T.adWall();
    const concMat = new THREE.MeshStandardMaterial({ map: conc, color: 0xe8e8e8, roughness: 0.9 });
    const adMat = new THREE.MeshStandardMaterial({ map: ad, roughness: 0.6 });
    const tireMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
    const fenceMat = new THREE.MeshStandardMaterial({ map: T.chainLink(), alphaTest: 0.4, transparent: false, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5, color: 0xdddddd });
    fenceMat.map.repeat.set(1, 1);
    const postPos = [];
    for (const sd of [1, -1]) {
      const bar = sd > 0 ? this.barL : this.barR; const wall = sd > 0 ? this.wallL : this.wallR;
      const P = (dd, h) => (i) => [sd * (wall[i] + dd), h];
      const side = (a, b) => (sd > 0 ? [a, b] : [b, a]);
      // گاردریل دو ردیفه
      for (const [a, b] of segments(bar, 0)) {
        for (const hy of [0.5, 0.82]) {
          // پروفیل W
          const g2 = this.ribbon(a, b, (i) => { const w = wall[i]; const pts = [[w + 0.0, hy - 0.17], [w - 0.06, hy - 0.06], [w - 0.02, hy], [w - 0.06, hy + 0.06], [w + 0.0, hy + 0.17]]; const r = pts.map(([d, h], k) => [sd * d, h, k / 4]); return sd > 0 ? r : r.reverse(); });
          const m = new THREE.Mesh(g2, steel); m.castShadow = true; m.receiveShadow = true; m.material.side = THREE.DoubleSide; this.group.add(m);
        }
        for (let i = a; i < b; i += 2) { const ii = i % n; postPos.push([this.px[ii] + this.tz[ii] * sd * (wall[ii] + 0.12), this.py[ii], this.pz[ii] - this.tx[ii] * sd * (wall[ii] + 0.12), 1.0]); }
      }
      // دیوار لاستیکی با روکش نوار نقاله
      for (const [a, b] of segments(bar, 1)) {
        const red = [0.75, 0.03, 0.03], white = [0.92, 0.92, 0.92], dark = [0.03, 0.03, 0.035];
        const g = this.ribbon(a, b, (i) => {
          const w = wall[i]; const c = Math.floor(i * DS / 4) % 2 ? red : white;
          const r = [[sd * w, -0.1, 0, c], [sd * (w - 0.03), 1.05, 0, c], [sd * (w + 0.1), 1.12, 0, dark], [sd * (w + 1.1), 1.12, 0, dark], [sd * (w + 1.15), -0.1, 0, dark]];
          return sd > 0 ? r : r.reverse();
        }, { colors: true });
        const m = new THREE.Mesh(g, tireMat); m.castShadow = true; m.receiveShadow = true; m.material.side = THREE.DoubleSide; this.group.add(m);
      }
      // دیوار بتنی با تبلیغات و توری
      for (const [a, b] of segments(bar, 2)) {
        const g = this.ribbon(a, b, (i) => { const w = wall[i]; const r = [[sd * w, -0.1, 0], [sd * w, 1.1, 1], [sd * (w + 0.35), 1.1, 1], [sd * (w + 0.35), -0.1, 0]]; return sd > 0 ? r : r.reverse(); }, { vScale: 8 });
        const m = new THREE.Mesh(g, concMat); m.castShadow = true; m.receiveShadow = true; m.material.side = THREE.DoubleSide; this.group.add(m);
        const adG = this.ribbon(a, b, (i) => { const w = wall[i] - 0.01; const r = [[sd * w, 0.1, sd > 0 ? 0 : 1], [sd * w, 1.0, sd > 0 ? 1 : 0]]; return sd > 0 ? r : r.reverse(); }, { vScale: 64 });
        // uv: u ارتفاع، v طول؛ تبدیل به (v,u) برای تبلیغ افقی
        const uvA = adG.attributes.uv; for (let k = 0; k < uvA.count; k++) { const u = uvA.getX(k), v = uvA.getY(k); uvA.setXY(k, v, u); }
        const am = new THREE.Mesh(adG, adMat); am.material.side = THREE.DoubleSide; this.group.add(am);
        const fG = this.ribbon(a, b, (i) => { const w = wall[i] + 0.15; const r = [[sd * w, 1.1, 0], [sd * w, 4.3, 1.5]]; return sd > 0 ? r : r.reverse(); }, { vScale: 1.5 });
        const uvF = fG.attributes.uv; for (let k = 0; k < uvF.count; k++) { const u = uvF.getX(k), v = uvF.getY(k); uvF.setXY(k, v, u); }
        this.group.add(new THREE.Mesh(fG, fenceMat));
        for (let i = a; i < b; i += 2) { const ii = i % n; postPos.push([this.px[ii] + this.tz[ii] * sd * (wall[ii] + 0.15), this.py[ii] + 1.1, this.pz[ii] - this.tx[ii] * sd * (wall[ii] + 0.15), 3.3]); }
      }
    }
    // پایه‌ها (Instanced)
    const postG = new THREE.CylinderGeometry(0.05, 0.05, 1, 6); postG.translate(0, 0.5, 0);
    const posts = new THREE.InstancedMesh(postG, steel, postPos.length);
    const m4 = new THREE.Matrix4();
    postPos.forEach((p, k) => { m4.makeScale(1, p[3], 1); m4.setPosition(p[0], p[1], p[2]); posts.setMatrixAt(k, m4); });
    posts.computeBoundingSphere(); this.group.add(posts);
  }

  terrainHeight(x, z) {
    const r = this.locate(x, z, -1, this._th || (this._th = {}));
    const ex = Math.hypot(this.px[r.i] - x, this.pz[r.i] - z);
    const dist = Math.max(Math.abs(r.d), ex);
    const wall = r.d > 0 ? r.wallL : r.wallR;
    const near = wall + 15;
    const nz = this.noise || (this.noise = makeNoise2D(this.level * 3 + 1));
    const hills = nz.fbm(x / 600, z / 600, 4) * (30 + 40 * this.diff) + nz.fbm(x / 140, z / 140, 3) * 6;
    const t = smoothstep(near, near + 180, dist);
    return lerp(r.y - 0.9, r.y + hills * 0.9 + (dist - near) * 0.02, t);
  }

  buildTerrain() {
    const b = this.bounds; const margin = 900;
    const size = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) + margin * 2;
    this.terrainSize = size;
    const N = { low: 120, medium: 170, high: 220, ultra: 260 }[this.opts.quality] || 200;
    const geo = new THREE.PlaneGeometry(size, size, N, N); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position; const uv = geo.attributes.uv;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k) + b.cx, z = pos.getZ(k) + b.cz;
      pos.setXYZ(k, x, this.terrainHeight(x, z) - 0.05, z);
      uv.setXY(k, x / 6, z / 6);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, this.grassMaterial()); m.receiveShadow = true; this.group.add(m);
  }

  // تبدیل (i، d، h) به موقعیت جهانی
  wp(i, d, h = 0) { i = this.idx(i); return new THREE.Vector3(this.px[i] + this.tz[i] * d, this.py[i] + h, this.pz[i] - this.tx[i] * d); }
  yawToTrack(i, sd) { i = this.idx(i); const fx = -sd * this.tz[i], fz = sd * this.tx[i]; return Math.atan2(fx, fz); }

  buildStartArea() {
    const n = this.n; const hw = this.hw[0];
    // خط شروع شطرنجی
    const chk = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 1.6), new THREE.MeshStandardMaterial({ map: T.checker(16, 2), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -4 }));
    chk.position.copy(this.wp(0, 0, 0.05)); this.group.add(chk);
    chk.rotation.set(-Math.PI / 2, 0, 0); chk.rotateZ(this.heading[0]);
    // جای ماشین‌ها روی خط استارت
    const gridMat = new THREE.MeshBasicMaterial({ color: 0xf0f0f0, polygonOffset: true, polygonOffsetFactor: -3 });
    this.gridSlots = [];
    for (let k = 0; k < 7; k++) {
      const s = -8 - k * 9; const d = (k % 2 ? -1 : 1) * hw * 0.42;
      const i = this.idx(Math.round(s / DS));
      this.gridSlots.push({ s, d });
      const g = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.18), gridMat); bar.rotation.x = -Math.PI / 2; bar.position.set(0, 0, 2.6); g.add(bar);
      for (const sx of [1, -1]) { const side = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 1.2), gridMat); side.rotation.x = -Math.PI / 2; side.position.set(sx * 1.05, 0, 2.0); g.add(side); }
      g.position.copy(this.wp(i, d, 0.055)); g.rotation.y = this.heading[i]; this.group.add(g);
    }
    // دروازه استارت با چراغ‌ها
    const gantry = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0x2a2f38, metalness: 0.7, roughness: 0.35 });
    const span = hw + 2.2;
    for (const sx of [1, -1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.6), steel); p.position.set(sx * span, 4, 0); p.castShadow = true; gantry.add(p); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(span * 2 + 0.6, 1.4, 0.9), steel); beam.position.y = 7.6; beam.castShadow = true; gantry.add(beam);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(span * 1.6, 1.1), new THREE.MeshStandardMaterial({ map: T.signText('شروع  •  پایان', '#0d1b2a', '#ffd400', 1024, 128, 90), emissive: 0xffffff, emissiveIntensity: 0.25, emissiveMap: null }));
    sign.material.emissiveMap = sign.material.map; sign.position.set(0, 7.6, -0.46); sign.rotation.y = Math.PI; gantry.add(sign);
    const sign2 = sign.clone(); sign2.position.z = 0.46; sign2.rotation.y = 0; gantry.add(sign2);
    this.startLights = [];
    for (let k = 0; k < 3; k++) {
      const pod = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.9, 0.5, 2, 0.1), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4 }));
      pod.position.set((k - 1) * 1.6, 6.3, -0.2); gantry.add(pod);
      const lamps = [];
      for (const lx of [-0.25, 0.25]) {
        const lm = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff0000, emissiveIntensity: 0.02, roughness: 0.2 });
        const l = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), lm); l.position.set((k - 1) * 1.6 + lx, 6.3, -0.46); l.rotation.y = Math.PI; gantry.add(l); lamps.push(lm);
      }
      this.startLights.push(lamps);
    }
    gantry.position.copy(this.wp(0, 0, 0)); gantry.rotation.y = this.heading[0];
    this.group.add(gantry);
    // صفحه نمایش بزرگ
    const scr = T.makeCanvasTexture(512, 256);
    this.screen = scr;
    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false })); this.screenMesh = screenMesh; this.screenPos = null;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(16.8, 8.8, 0.6), steel);
    const sg = new THREE.Group(); sg.add(frame); screenMesh.position.z = 0.31; sg.add(screenMesh);
    for (const sx of [-5, 5]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 10, 0.6), steel); leg.position.set(sx, -9, 0); sg.add(leg); }
    const si = this.idx(Math.round(60 / DS));
    sg.position.copy(this.wp(si, -(this.wallR[si] + 20), 14)); sg.rotation.y = this.yawToTrack(si, -1);
    this.group.add(sg);
    this.drawScreen([]);
  }

  drawScreen(rows, title = '') {
    const { ctx, tex } = this.screen;
    ctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#071425'); g.addColorStop(1, '#0d2440');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = '#ffd400'; ctx.font = `900 56px ${T.FONT}`; ctx.textAlign = 'center'; ctx.direction = 'rtl';
    ctx.fillText(title || this.name, 512, 70);
    ctx.font = `700 40px ${T.FONT}`;
    rows.slice(0, 7).forEach((r, k) => {
      const y = 130 + k * 54;
      ctx.fillStyle = r.player ? 'rgba(255,90,0,0.45)' : 'rgba(255,255,255,0.06)'; ctx.fillRect(60, y - 38, 904, 48);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.fillText(`${r.pos}. ${r.name}`, 940, y);
      ctx.textAlign = 'left'; ctx.fillStyle = '#9fd3ff'; ctx.fillText(r.info || '', 90, y);
    });
    tex.needsUpdate = true;
  }

  // ادغام نهایی همه قطعات ثابت پیست (کاهش شدید draw call)
  optimize() {
    const skip = (o) => o === this.screenMesh || o.userData.keep;
    optimizeStatic(this.group, { cell: 280, skip });
  }

  setStartLights(state) { // state: 0..3 قرمز، 4 سبز، -1 خاموش
    this.startLights.forEach((lamps, k) => lamps.forEach((m) => {
      if (state === 4) { m.color.setHex(0x002200); m.emissive.setHex(0x22ff44); m.emissiveIntensity = 3; }
      else if (state > k) { m.color.setHex(0x220000); m.emissive.setHex(0xff1010); m.emissiveIntensity = 3.5; }
      else { m.emissive.setHex(0xff0000); m.emissiveIntensity = 0.02; }
    }));
  }

  // ---------- جایگاه تماشاگران ----------
  standSection({ i, sd, offset, rows, width, team, reserve = null }) {
    const grp = new THREE.Group();
    const rowD = 0.85, rowH = 0.45, base = 1.4;
    const conc = T.concrete();
    const cm = this._standMat || (this._standMat = new THREE.MeshStandardMaterial({ map: conc, color: 0xcfd2d6, roughness: 0.9 }));
    const geos = [];
    for (let r = 0; r < rows; r++) { const g = new THREE.BoxGeometry(width, base + r * rowH, rowD); g.translate(0, (base + r * rowH) / 2, -r * rowD - rowD / 2); geos.push(g); }
    const back = new THREE.BoxGeometry(width, base + rows * rowH + 2.2, 0.4); back.translate(0, (base + rows * rowH + 2.2) / 2, -rows * rowD - 0.2); geos.push(back);
    const mesh = new THREE.Mesh(mergeGeos(geos), cm); mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh);
    // سقف
    const roofY = base + rows * rowH + 2.6;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, 0.25, rows * rowD + 2.5), this._roofMat || (this._roofMat = new THREE.MeshStandardMaterial({ color: 0xeef1f4, metalness: 0.5, roughness: 0.4 })));
    roof.position.set(0, roofY, -rows * rowD / 2 + 0.6); roof.rotation.x = -0.06; roof.castShadow = true; grp.add(roof);
    for (const sx of [-width / 2 + 0.3, width / 2 - 0.3]) { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, roofY, 8), this._roofMat); col.position.set(sx, roofY / 2, -rows * rowD - 0.1); grp.add(col); }
    // نرده جلو
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, width, 8), this._roofMat); rail.rotation.z = Math.PI / 2; rail.position.set(0, base + 1.0, 0.05); grp.add(rail);
    // بنر تیم
    const tc = TEAM_COLORS[team];
    const bTex = team === 0 ? T.fireBanner('طرفداران قهرمان') : T.banner('طرفداران تیم ' + TEAM_NAMES[team], tc);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.4, 1.0), new THREE.MeshStandardMaterial({ map: bTex, roughness: 0.6 }));
    banner.position.set(0, base * 0.5, 0.02); grp.add(banner);
    // پرچم‌های روی سقف
    for (const fx of [-width / 3, width / 3]) this.addFlag(grp, new THREE.Vector3(fx, roofY + 0.1, -rows * rowD / 2), team);
    // صندلی‌ها و تماشاگران
    const seatPts = []; const fans = [];
    const spacing = 0.56; const perRow = Math.floor((width - 0.6) / spacing);
    const fill = this.opts.fanFill;
    for (let r = 0; r < rows; r++) for (let k = 0; k < perRow; k++) {
      const x = -width / 2 + 0.3 + spacing * (k + 0.5); const y = base + r * rowH; const z = -r * rowD - 0.6;
      seatPts.push([x, y, z]);
      const isRes = reserve && r === reserve.row && k === Math.floor(perRow / 2);
      if (isRes) { grp.updateMatrixWorld(); this.reservedSeat = { local: new THREE.Vector3(x, y, z), group: grp, rowStart: new THREE.Vector3(-width / 2 - 0.4, y, z + 0.25), rowZ: z }; continue; }
      if (this.rng() < fill) fans.push({ local: new THREE.Vector3(x, y, z) });
    }
    grp.userData.seats = seatPts; grp.userData.fans = fans; grp.userData.team = team;
    const p = this.wp(i, sd * offset, 0);
    p.y = this.terrainHeight(p.x, p.z) + 0.05;
    grp.position.copy(p); grp.rotation.y = this.yawToTrack(i, sd);
    return grp;
  }

  // پرچم با موج در شیدر (بدون هزینه پردازنده)؛ متریال مشترک برای هر تیم
  flagMaterial(team) {
    this._flagMats = this._flagMats || {};
    if (this._flagMats[team]) return this._flagMats[team];
    const mat = team === 0 ? patternMaterial('fire', { side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ color: TEAM_COLORS[team], side: THREE.DoubleSide, roughness: 0.7 });
    const prev = mat.onBeforeCompile;
    const u = this.flagTime || (this.flagTime = { value: 0 });
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(mat, sh, r);
      sh.uniforms.uFlagT = u;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uFlagT;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float fx = uv.x * 2.0; float ph = position.x * 0.37 + position.z * 0.23;
          transformed += normalize(normal) * (sin(fx * 2.4 - uFlagT * 6.0 + ph) * 0.18 * fx + sin(uv.y * 3.6 + uFlagT * 3.0) * 0.04 * fx);`);
    };
    mat.customProgramCacheKey = () => 'flag-' + (team === 0 ? 'fire' : 'solid');
    this._flagMats[team] = mat;
    return mat;
  }

  addFlag(parent, pos, team) {
    const pole = new THREE.Mesh(this._poleG || (this._poleG = new THREE.CylinderGeometry(0.04, 0.05, 4, 6)), this._roofMat || new THREE.MeshStandardMaterial({ color: 0xdddddd }));
    pole.position.copy(pos).add(new THREE.Vector3(0, 2, 0)); parent.add(pole);
    if (!this._flagG) { this._flagG = new THREE.PlaneGeometry(2.0, 1.2, 10, 4); this._flagG.translate(1.0, 0, 0); }
    const flag = new THREE.Mesh(this._flagG, this.flagMaterial(team));
    flag.position.copy(pos).add(new THREE.Vector3(0.05, 3.4, 0));
    parent.add(flag);
  }

  buildStands() {
    const n = this.n; const hasBoss = this.opts.bossTeam >= 0;
    const stands = [];
    // جایگاه اصلی کنار خط پایان
    const secW = 12; const mainSecs = { low: 6, medium: 8, high: 10, ultra: 12 }[this.opts.quality] || 10;
    const firstOff = -Math.floor(mainSecs / 2);
    let bossDone = false; let rivalK = 0;
    for (let k = 0; k < mainSecs; k++) {
      const s = (firstOff + k + 0.5) * secW;
      const i = this.idx(Math.round(s / DS));
      const center = Math.abs(firstOff + k + 0.5) < 2.2;
      const team = center ? 0 : 1 + ((rivalK++) % 6);
      let reserve = null;
      if (hasBoss && !bossDone && team === this.opts.bossTeam && (team !== 0 || k === Math.floor(mainSecs / 2))) { reserve = { row: 1 }; bossDone = true; }
      stands.push(this.standSection({ i, sd: 1, offset: this.wallL[i] + 2.5, rows: 12, width: secW - 0.4, team, reserve }));
    }
    if (hasBoss && !bossDone) { // در صورت نبودن، یک بخش ویژه بساز
      const i = this.idx(Math.round((firstOff - 1.5) * secW / DS));
      stands.push(this.standSection({ i, sd: 1, offset: this.wallL[i] + 2.5, rows: 12, width: secW - 0.4, team: this.opts.bossTeam, reserve: { row: 1 } }));
    }
    // جایگاه‌های پیچ‌ها
    const cands = this.corners.filter((c) => c.i > this.mainFwd + 60 && c.i < n - this.mainBack - 60).sort((a, b) => Math.abs(b.k) - Math.abs(a.k));
    const chosen = [];
    for (const c of cands) { if (chosen.every((o) => Math.abs(o.i - c.i) > 300)) chosen.push(c); if (chosen.length >= ({ low: 1, medium: 2, high: 3, ultra: 4 }[this.opts.quality] || 3)) break; }
    let tcount = 0;
    for (const c of chosen) {
      const sd = c.k > 0 ? -1 : 1;
      const nsec = 5;
      for (let k = 0; k < nsec; k++) {
        const i = this.idx(c.i + Math.round(((k - nsec / 2 + 0.5) * secW) / DS));
        const wall = sd > 0 ? this.wallL[i] : this.wallR[i];
        // بررسی تداخل با بخش‌های دیگر پیست
        const probe = this.wp(i, sd * (wall + 14), 0);
        const loc = this.locate(probe.x, probe.z, -1, {});
        if (Math.abs(this.idx(loc.i - i)) > 20 && Math.abs(this.idx(i - loc.i)) > 20) continue;
        const team = k < 2 ? 0 : 1 + ((tcount++) % 6);
        stands.push(this.standSection({ i, sd, offset: wall + 3, rows: 8, width: secW - 0.4, team }));
      }
    }
    // ساخت جمعیت برای هر بخش
    const seatG = mergeGeos([(() => { const g = new THREE.BoxGeometry(0.46, 0.06, 0.42); g.translate(0, 0.42, 0); return g; })(), (() => { const g = new THREE.BoxGeometry(0.46, 0.45, 0.05); g.translate(0, 0.66, -0.2); g.rotateX(-0.08); return g; })(), (() => { const g = new THREE.BoxGeometry(0.06, 0.42, 0.3); g.translate(0, 0.21, 0); return g; })()]);
    const allSeats = [];
    for (const st of stands) {
      this.group.add(st); st.updateMatrixWorld(true);
      for (const sp of st.userData.seats) allSeats.push({ p: new THREE.Vector3(...sp).applyMatrix4(st.matrixWorld), yaw: st.rotation.y, team: st.userData.team });
      const fans = st.userData.fans;
      if (!fans.length) continue;
      const team = st.userData.team; const yaw = st.rotation.y;
      const placements = fans.map((f) => ({ pos: f.local.clone().applyMatrix4(st.matrixWorld), yaw }));
      const tc = TEAM_COLORS[team];
      const crowd = createCrowd(placements, {
        rng: mulberry32(placements.length * 7 + team), qualityHi: this.opts.quality !== 'low',
        shirtFn: (p, r) => team === 0 ? '#ff3a1a' : (r() < 0.85 ? tc : '#ffffff'),
        patternFn: (p, r) => team === 0 ? 1 : (r() < 0.2 ? 2 : 0)
      });
      crowd.team = team; crowd.stand = st;
      this.group.add(crowd.group); this.crowds.push(crowd);
    }
    // صندلی‌ها (Instanced) با رنگ تیم، گروه‌بندی مکانی برای حذف خارج از دید
    const seatMat = new THREE.MeshStandardMaterial({ roughness: 0.45 });
    const cells = new Map();
    for (const st of allSeats) { const k = Math.floor(st.p.x / 200) + ':' + Math.floor(st.p.z / 200); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(st); }
    const m4 = new THREE.Matrix4(); const qq = new THREE.Quaternion(); const col = new THREE.Color(); const one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    for (const [, list] of cells) {
      const seatMesh = new THREE.InstancedMesh(seatG, seatMat, list.length);
      list.forEach((st, k) => { qq.setFromAxisAngle(up, st.yaw); m4.compose(st.p, qq, one); seatMesh.setMatrixAt(k, m4); col.set(st.team === 0 ? '#e63312' : TEAM_COLORS[st.team]); seatMesh.setColorAt(k, col); });
      seatMesh.computeBoundingSphere(); this.group.add(seatMesh);
    }
    if (this.reservedSeat) {
      const rs = this.reservedSeat; rs.world = rs.local.clone().applyMatrix4(rs.group.matrixWorld); rs.yaw = rs.group.rotation.y;
      rs.startWorld = rs.rowStart.clone().applyMatrix4(rs.group.matrixWorld);
    }
  }

  // ---------- ساختمان پیت ----------
  buildPit() {
    const n = this.n;
    const a = -Math.min(this.mainBack - 15, 70), b = Math.min(this.mainFwd - 15, 110);
    const i0 = this.idx(a), cnt = b - a; if (cnt < 40) return;
    const hw = (i) => this.hw[i];
    // مسیر پیت (آسفالت)
    const pitG = this.ribbon(i0, i0 + cnt, (i) => { const w = this.wallR[i]; return [[-(w + 16), 0.02], [-(w + 0.4), 0.02]]; }, { uScale: 4, vScale: 4 });
    const pit = new THREE.Mesh(pitG, this.roadMaterial()); pit.receiveShadow = true; this.group.add(pit);
    const lineM = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const plG = this.ribbon(i0, i0 + cnt, (i) => { const w = this.wallR[i]; return [[-(w + 4.2), 0.04], [-(w + 4.0), 0.04]]; });
    this.group.add(new THREE.Mesh(plG, lineM));
    // ساختمان
    const len = cnt * DS - 20; const im = this.idx(Math.round((a + b) / 2));
    const bld = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe9edf2, roughness: 0.6, metalness: 0.1 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x223344, metalness: 0.9, roughness: 0.05, envMapIntensity: 1.5 });
    const lower = new THREE.Mesh(new THREE.BoxGeometry(len, 5, 16), wallMat); lower.position.set(0, 2.5, -8); lower.castShadow = true; lower.receiveShadow = true; bld.add(lower);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(len, 4.2, 14), glassMat); upper.position.set(0, 7.1, -8); upper.castShadow = true; bld.add(upper);
    const roofB = new THREE.Mesh(new THREE.BoxGeometry(len + 2, 0.5, 18), wallMat); roofB.position.set(0, 9.45, -7.5); roofB.castShadow = true; bld.add(roofB);
    this.windowMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffe3a0, emissiveIntensity: 0.0 }); this.windowMat.userData.noMerge = true;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(len - 1, 0.3, 0.05), this.windowMat); strip.position.set(0, 8.6, -0.95); bld.add(strip);
    // درهای گاراژ با رنگ تیم‌ها
    const nGar = Math.floor(len / 13);
    for (let k = 0; k < nGar; k++) {
      const x = -len / 2 + 6.5 + k * 13;
      const tc = TEAM_COLORS[k % 7] === 'fire' ? '#ff5a00' : TEAM_COLORS[k % 7];
      const door = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.8), new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.8 })); door.position.set(x, 1.95, 0.01); bld.add(door);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.4, 0.2), new THREE.MeshStandardMaterial({ color: tc, roughness: 0.4 })); frame.position.set(x, 4.1, 0.08); bld.add(frame);
      const num = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: T.roundel(k + 1, tc) })); num.position.set(x, 4.65, 0.06); bld.add(num);
    }
    const pitSign = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.2), new THREE.MeshStandardMaterial({ map: T.signText('PIT  •  پیت', '#d40f1f', '#ffffff', 1024, 160, 110), roughness: 0.5 }));
    pitSign.position.set(0, 10.6, -1); bld.add(pitSign);
    const p = this.wp(im, -(this.wallR[im] + 17), 0); p.y = this.py[im];
    bld.position.copy(p); bld.rotation.y = this.yawToTrack(im, -1);
    this.group.add(bld);
    // گروه‌های تیم روی دیوار پیت (کانوپی)
    for (let k = 0; k < 6; k++) {
      const ii = this.idx(Math.round(a + 10 + k * (cnt - 20) / 6));
      const st = new THREE.Group();
      const deck = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 2), new THREE.MeshStandardMaterial({ color: 0x333a44, metalness: 0.5, roughness: 0.4 })); deck.position.y = 3.2; st.add(deck);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.2, 0.15), deck.material); leg.position.y = 1.6; st.add(leg);
      st.position.copy(this.wp(ii, -(this.wallR[ii] + 1.4), 0)); st.rotation.y = this.yawToTrack(ii, -1); this.group.add(st);
    }
  }

  buildBillboards() {
    const n = this.n; const rng = mulberry32(this.level * 5 + 9);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.6, roughness: 0.4 });
    for (let i = 40; i < n - 40; i += Math.round(140 / DS)) {
      if (Math.abs(this.ks[i]) > 1 / 250) continue;
      if (i < this.mainFwd + 20 || i > n - this.mainBack - 20) continue;
      const sd = rng() < 0.5 ? 1 : -1; const wall = sd > 0 ? this.wallL[i] : this.wallR[i];
      const g = new THREE.Group();
      const bi = rng.int(0, T.brandCount - 1);
      this._bbMats = this._bbMats || {};
      if (!this._bbMats[bi]) { const bm = new THREE.MeshStandardMaterial({ map: T.billboard(bi), roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0 }); bm.emissiveMap = bm.map; this._bbMats[bi] = bm; this.lamps.push({ mat: bm, night: 0.35 }); }
      const board = new THREE.Mesh(this._bbG || (this._bbG = new THREE.PlaneGeometry(10, 2.5)), this._bbMats[bi]);
      board.position.y = 3.6; g.add(board);
      const backB = new THREE.Mesh(new THREE.BoxGeometry(10.2, 2.7, 0.2), postMat); backB.position.set(0, 3.6, -0.12); g.add(backB);
      for (const x of [-3.5, 3.5]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.6, 0.25), postMat); post.position.set(x, 1.8, -0.15); g.add(post); }
      g.position.copy(this.wp(i, sd * (wall + 4), 0)); g.position.y = this.terrainHeight(g.position.x, g.position.z);
      g.rotation.y = this.yawToTrack(i, sd); g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.group.add(g);
    }
    // تابلوهای فاصله قبل از پیچ‌های اصلی
    for (const c of this.corners) {
      if (Math.abs(c.k) < 1 / 110) continue;
      const sd = c.k > 0 ? -1 : 1;
      for (const dist of [300, 200, 100]) {
        const i = this.idx(c.start - Math.round(dist / DS)); const wall = sd > 0 ? this.wallL[i] : this.wallR[i];
        const b = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshStandardMaterial({ map: T.distanceBoard(dist), roughness: 0.6 }));
        b.position.copy(this.wp(i, sd * (wall - 0.6), 1.5)); b.rotation.y = this.headingAt(i * DS) + Math.PI; this.group.add(b);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), postMat); post.position.copy(b.position).add(new THREE.Vector3(0, -1.1, 0)); this.group.add(post);
      }
    }
  }

  buildTowers() {
    const n = this.n; const step = Math.round(150 / DS);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 0.7, roughness: 0.4 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xfff4d0, emissiveIntensity: 0.0 });
    this.lamps.push({ mat: lampMat, night: 6 });
    const poleG = new THREE.CylinderGeometry(0.18, 0.3, 18, 8); poleG.translate(0, 9, 0);
    const headG = new THREE.BoxGeometry(3, 1.4, 0.4); headG.translate(0, 18.2, 0);
    const pts = [];
    for (let i = 0; i < n; i += step) { const sd = (i / step) % 2 ? 1 : -1; const wall = sd > 0 ? this.wallL[i] : this.wallR[i]; const p = this.wp(i, sd * (wall + 7), 0); p.y = this.terrainHeight(p.x, p.z); pts.push({ p, yaw: this.yawToTrack(i, sd) }); }
    const poles = new THREE.InstancedMesh(poleG, poleMat, pts.length); const heads = new THREE.InstancedMesh(headG, lampMat, pts.length);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion();
    pts.forEach((t, k) => { qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.yaw); m4.compose(t.p, qq, new THREE.Vector3(1, 1, 1)); poles.setMatrixAt(k, m4); heads.setMatrixAt(k, m4); });
    poles.castShadow = true; poles.computeBoundingSphere(); heads.computeBoundingSphere();
    this.group.add(poles, heads);
  }

  buildBridge() {
    const n = this.n;
    let best = -1;
    for (let i = Math.round(n * 0.3); i < n * 0.8; i++) { if (Math.abs(this.ks[i]) < 1 / 900 && Math.abs(this.ks[this.idx(i + 15)]) < 1 / 900 && Math.abs(this.ks[this.idx(i - 15)]) < 1 / 900) { best = i; break; } }
    if (best < 0) return;
    const i = best; const L = this.wallL[i] + 4, R = this.wallR[i] + 4;
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.5, metalness: 0.3 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(L + R, 0.6, 3.2), mat); deck.position.set((L - R) / 2, 6.8, 0); deck.castShadow = true; g.add(deck);
    for (const x of [L, -R]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1, 7, 3.4), mat); p.position.set(x, 3.5, 0); p.castShadow = true; g.add(p); }
    for (const sz of [1, -1]) {
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(L + R - 2, 1.6), new THREE.MeshStandardMaterial({ map: T.billboard(this.level % T.brandCount), roughness: 0.6 }));
      ban.position.set((L - R) / 2, 7.9, sz * 1.62); if (sz < 0) ban.rotation.y = Math.PI; g.add(ban);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(L + R, 1.2, 0.08), new THREE.MeshStandardMaterial({ color: 0x88aacc, transparent: true, opacity: 0.4, metalness: 0.8, roughness: 0.1 })); rail.position.set((L - R) / 2, 7.7, sz * 1.55); g.add(rail);
    }
    g.position.copy(this.wp(i, 0, 0)); g.rotation.y = this.heading[i]; // محور x محلی = سمت چپ پیست
    this.group.add(g);
  }

  buildTrees() {
    const count = Math.round(({ low: 450, medium: 900, high: 1700, ultra: 2800 }[this.opts.quality] || 1500) * Math.min(1, this.opts.trees));
    const rng = mulberry32(this.level * 17 + 2); const nz = makeNoise2D(this.level + 99);
    const size = this.terrainSize * 0.85; const b = this.bounds;
    const types = [
      { trunk: [0.18, 0.28, 3.2], fol: () => { const g = []; for (let k = 0; k < 3; k++) { const c = new THREE.ConeGeometry(2.4 - k * 0.55, 3.2, 7, 1, true); c.translate(0, 3.2 + k * 1.8, 0); g.push(c); } return mergeGeos(g); }, color: 0x1f4d2a },
      { trunk: [0.2, 0.32, 3.0], fol: () => { const g = []; for (const [x, y, z, r] of [[0, 4.6, 0, 2.3], [1.2, 4.0, 0.3, 1.6], [-1.1, 4.1, -0.4, 1.7], [0.2, 5.6, 0.6, 1.5], [-0.3, 4.2, 1.1, 1.4]]) { const s = new THREE.IcosahedronGeometry(r, 0); s.translate(x, y, z); g.push(s); } return mergeGeos(g); }, color: 0x3d7a2c },
      { trunk: [0.12, 0.2, 2.4], fol: () => { const s = new THREE.SphereGeometry(1.3, 7, 6); s.scale(1, 3.2, 1); s.translate(0, 5.6, 0); return s; }, color: 0x2e6b31 }
    ];
    const lists = types.map(() => []);
    let tries = 0;
    while (lists.reduce((a, l) => a + l.length, 0) < count && tries < count * 8) {
      tries++;
      const x = b.cx + (rng() - 0.5) * size, z = b.cz + (rng() - 0.5) * size;
      const dens = nz.fbm(x / 300, z / 300, 3);
      if (dens < -0.05 && rng() < 0.8) continue;
      const r = this.locate(x, z, -1, {});
      const far = Math.hypot(this.px[r.i] - x, this.pz[r.i] - z);
      const wall = r.d > 0 ? r.wallL : r.wallR;
      if (Math.max(far, Math.abs(r.d)) < wall + 22) continue;
      // دور از ساختمان‌ها و جایگاه‌ها
      if (Math.max(far, Math.abs(r.d)) < wall + 60 && (r.i < this.mainFwd + 40 || r.i > this.n - this.mainBack - 40)) continue;
      const y = this.terrainHeight(x, z);
      const t = rng() < 0.45 ? 0 : rng() < 0.75 ? 1 : 2;
      lists[t].push({ x, y, z, s: rng.range(0.75, 1.45), rot: rng() * TAU, tint: rng() });
    }
    // تنه و شاخ و برگ در یک هندسه با رنگ رأسی؛ هر ناحیه یک InstancedMesh (حذف خارج از دید)
    const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    const shadows = this.opts.quality === 'ultra';
    const trunkC = new THREE.Color(0x4a3423);
    types.forEach((ty, k) => {
      const list = lists[k]; if (!list.length) return;
      const tg = new THREE.CylinderGeometry(ty.trunk[0], ty.trunk[1], ty.trunk[2], 5, 1, true); tg.translate(0, ty.trunk[2] / 2, 0);
      const fg = ty.fol(); const fc = new THREE.Color(ty.color);
      const tg2 = tg.index ? tg : tg; fillAttr(tg2, 'color', [trunkC.r, trunkC.g, trunkC.b]);
      const fg2 = new THREE.BufferGeometry(); fg2.setAttribute('position', fg.attributes.position); fg2.setAttribute('normal', fg.attributes.normal); if (fg.index) fg2.setIndex(fg.index);
      fillAttr(fg2, 'color', [fc.r, fc.g, fc.b]);
      const geo = mergeGeos([tg2, fg2], ['position', 'normal', 'color']);
      const cells = new Map();
      for (const t of list) { const key = Math.floor(t.x / 450) + ':' + Math.floor(t.z / 450); if (!cells.has(key)) cells.set(key, []); cells.get(key).push(t); }
      const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), sc = new THREE.Vector3();
      for (const [, cl] of cells) {
        const im = new THREE.InstancedMesh(geo, treeMat, cl.length);
        cl.forEach((t, j) => {
          qq.setFromAxisAngle(up, t.rot); m4.compose(pos.set(t.x, t.y - 0.2, t.z), qq, sc.set(t.s, t.s * (0.9 + t.tint * 0.3), t.s));
          im.setMatrixAt(j, m4); const v = 0.85 + t.tint * 0.3; c.setRGB(v * (0.95 + t.tint * 0.1), v, v * 0.95); im.setColorAt(j, c);
        });
        im.castShadow = shadows; im.receiveShadow = false; im.computeBoundingSphere();
        this.group.add(im);
      }
    });
  }

  buildMountains() {
    const R = this.terrainSize * 0.62; const segs = 256, rows = 10;
    const nz = makeNoise2D(this.level * 7 + 3);
    const pos = [], col = [], idx = [];
    const cLow = new THREE.Color(0x3c5a3a), cMid = new THREE.Color(0x6a6d6a), cTop = new THREE.Color(0xf2f4f8);
    for (let r = 0; r <= rows; r++) for (let k = 0; k <= segs; k++) {
      const a = (k / segs) * TAU; const t = r / rows;
      const hN = (nz.fbm(Math.cos(a) * 3, Math.sin(a) * 3, 5) * 0.5 + 0.5);
      const H = (120 + hN * 520) * Math.pow(Math.sin(t * Math.PI * 0.5), 1.2);
      const rr = R + t * 900 + nz(Math.cos(a) * 8, Math.sin(a) * 8 + t) * 120;
      const y = (r === 0 ? -30 : H) - 10;
      pos.push(this.bounds.cx + Math.cos(a) * rr, y, this.bounds.cz + Math.sin(a) * rr);
      const c = y > 380 ? cTop : y > 160 ? cMid.clone().lerp(cTop, (y - 160) / 220 * 0.4) : cLow.clone().lerp(cMid, y / 160);
      col.push(c.r, c.g, c.b);
    }
    for (let r = 0; r < rows; r++) for (let k = 0; k < segs; k++) { const a = r * (segs + 1) + k, b = a + segs + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide, flatShading: false }));
    this.group.add(m);
  }

  buildMarshals() {
    // پست مارشال‌ها و تماشاگران ایستاده کنار پیچ‌ها
    const placements = [];
    const postMat = new THREE.MeshStandardMaterial({ color: 0xff7a00, roughness: 0.6 });
    let c = 0;
    for (const cr of this.corners) {
      if (c++ % 2) continue;
      const sd = cr.k > 0 ? -1 : 1; const i = cr.i;
      const wall = sd > 0 ? this.wallL[i] : this.wallR[i];
      const hut = new THREE.Mesh(new RoundedBoxGeometry(2, 2.4, 2, 2, 0.1), postMat); hut.position.copy(this.wp(i, sd * (wall + 3), 1.2)); hut.rotation.y = this.yawToTrack(i, sd); hut.castShadow = true; this.group.add(hut);
      // تماشاگران ایستاده روی تپه
      if (this.opts.quality === 'low') continue;
      const cnt = Math.round(30 * this.opts.fanFill);
      for (let k = 0; k < cnt; k++) {
        const ii = this.idx(i + Math.round((k - cnt / 2) * 1.4 / DS * 1.5));
        const ww = sd > 0 ? this.wallL[ii] : this.wallR[ii];
        const p = this.wp(ii, sd * (ww + 8 + this.rng() * 6), 0); p.y = this.terrainHeight(p.x, p.z);
        const lc = this.locate(p.x, p.z, -1, {}); if (Math.abs(this.idx(lc.i - ii)) > 15 && Math.abs(this.idx(ii - lc.i)) > 15) continue;
        placements.push({ pos: p, yaw: this.yawToTrack(ii, sd) + (this.rng() - 0.5) * 0.6 });
      }
    }
    if (placements.length) {
      const crowd = createCrowd(placements, { pose: 'stand', rng: mulberry32(11), qualityHi: true, shirtFn: (p, r) => ['#ff3a1a', '#1e6bff', '#19c25a', '#ffffff', '#ffd400', '#8e3bff'][(r() * 6) | 0], patternFn: () => 0 });
      crowd.team = -1; this.group.add(crowd.group); this.crowds.push(crowd);
    }
  }

  setNight(on) {
    for (const l of this.lamps) l.mat.emissiveIntensity = on ? l.night : 0;
    if (this.windowMat) this.windowMat.emissiveIntensity = on ? 2 : 0;
  }

  // به‌روزرسانی تماشاگران و پرچم‌ها
  update(time, cars, camPos, playerCar) {
    for (const c of this.crowds) {
      // نزدیک‌ترین ماشین به این جایگاه
      if (camPos.distanceToSquared(c.center) > 450 * 450) { c.update(time, 0, c.center, camPos); continue; }
      let best = null, bd = 1e9;
      for (const car of cars) { const d = car.pos.distanceToSquared(c.center); if (d < bd) { bd = d; best = car; } }
      const dist = Math.sqrt(bd);
      let ex = clamp(1 - (dist - 25) / 220, 0, 1) * 0.75;
      if (c.team >= 0) {
        const own = cars.find((k) => k.team === c.team);
        if (own) { const od = own.pos.distanceTo(c.center); ex = Math.max(ex, clamp(1 - (od - 20) / 260, 0, 1)); if (own.place === 1) ex = Math.max(ex, 0.45); if (own.finished) ex = 1; }
      } else ex = Math.max(ex, 0.25);
      c.excite = lerp(c.excite || 0, ex, 0.05);
      c.update(time, c.excite, best ? best.pos : c.center, camPos);
    }
    if (this.flagTime) this.flagTime.value = time;
  }
}
