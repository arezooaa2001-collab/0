// Procedural closed-circuit generator + fast spatial queries used by physics, AI and rendering.
// Pure JavaScript (no three.js) so it can be unit-tested in Node.

import { RNG, TAU, clamp, smoothstep, lerp } from '../core/utils.js';

const SPACING = 2; // metres between samples along the centre line
const GRAVITY = 9.81;

function catmullRomClosed(ctrl, perSegment) {
  const n = ctrl.length;
  const out = [];
  const pt = (i) => ctrl[((i % n) + n) % n];
  const knot = (a, b) => Math.sqrt(Math.max(1e-6, Math.hypot(b[0] - a[0], b[1] - a[1])));
  for (let i = 0; i < n; i++) {
    const p0 = pt(i - 1), p1 = pt(i), p2 = pt(i + 1), p3 = pt(i + 2);
    const t0 = 0;
    const t1 = t0 + knot(p0, p1);
    const t2 = t1 + knot(p1, p2);
    const t3 = t2 + knot(p2, p3);
    for (let k = 0; k < perSegment; k++) {
      const t = lerp(t1, t2, k / perSegment);
      const res = [0, 0];
      for (let c = 0; c < 2; c++) {
        const a1 = ((t1 - t) / (t1 - t0)) * p0[c] + ((t - t0) / (t1 - t0)) * p1[c];
        const a2 = ((t2 - t) / (t2 - t1)) * p1[c] + ((t - t1) / (t2 - t1)) * p2[c];
        const a3 = ((t3 - t) / (t3 - t2)) * p2[c] + ((t - t2) / (t3 - t2)) * p3[c];
        const b1 = ((t2 - t) / (t2 - t0)) * a1 + ((t - t0) / (t2 - t0)) * a2;
        const b2 = ((t3 - t) / (t3 - t1)) * a2 + ((t - t1) / (t3 - t1)) * a3;
        res[c] = ((t2 - t) / (t2 - t1)) * b1 + ((t - t1) / (t2 - t1)) * b2;
      }
      out.push(res);
    }
  }
  return out;
}

/** Resamples a closed polyline so consecutive points are exactly `spacing` apart (arc length). */
function resampleClosed(poly, spacing) {
  const n = poly.length;
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const length = cum[n];
  const count = Math.max(64, Math.round(length / spacing));
  const step = length / count;
  const out = [];
  let seg = 0;
  for (let k = 0; k < count; k++) {
    const s = k * step;
    while (seg < n - 1 && cum[seg + 1] < s) seg++;
    const a = poly[seg], b = poly[(seg + 1) % n];
    const segLen = cum[seg + 1] - cum[seg] || 1;
    const t = (s - cum[seg]) / segLen;
    out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]);
  }
  return out;
}

function smoothClosed(poly, passes, strength = 0.5) {
  let cur = poly;
  const n = poly.length;
  for (let p = 0; p < passes; p++) {
    const next = new Array(n);
    for (let i = 0; i < n; i++) {
      const a = cur[(i - 1 + n) % n], b = cur[i], c = cur[(i + 1) % n];
      next[i] = [
        b[0] + strength * ((a[0] + c[0]) * 0.5 - b[0]),
        b[1] + strength * ((a[1] + c[1]) * 0.5 - b[1]),
      ];
    }
    cur = next;
  }
  return cur;
}

export class Track {
  /**
   * @param {object} stage  stage definition from config.STAGES
   */
  constructor(stage) {
    const tp = stage.track;
    this.stage = stage;
    this.width = tp.width;
    this.halfWidth = tp.width / 2;
    this.shoulder = 7.5;
    this.wallDist = this.halfWidth + this.shoulder;
    this.curbWidth = 1.3;
    this.minRadius = this.wallDist + 8;
    this.#generate(stage);
    this.#computeCurbs();
    this.#buildGrid();
  }

  #generate(stage) {
    const tp = stage.track;
    let poly = null;
    for (let attempt = 0; attempt < 120 && !poly; attempt++) {
      const rng = new RNG(stage.seed + attempt * 7919);
      const candidate = this.#candidate(rng, tp, attempt);
      if (this.#validate(candidate)) poly = candidate;
    }
    if (!poly) {
      // Guaranteed-valid fallback: a rounded rectangle-ish ellipse.
      const ctrl = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        ctrl.push([Math.cos(a) * tp.radius * 1.4, Math.sin(a) * tp.radius * 0.8]);
      }
      poly = resampleClosed(smoothClosed(resampleClosed(catmullRomClosed(ctrl, 40), SPACING), 30), SPACING);
      this.fallback = true;
    }
    this.#store(poly, new RNG(stage.seed ^ 0x5bd1e995), tp);
  }

  #candidate(rng, tp, attempt) {
    const n = tp.controlPoints + (attempt % 3);
    const rough = Math.max(0.2, tp.roughness - attempt * 0.004);
    const stretch = rng.range(1.0, 1.45);
    const rot = rng.range(0, TAU);
    const ctrl = [];
    for (let j = 0; j < n; j++) {
      const a = (j / n) * TAU + rng.range(-0.3, 0.3) * (TAU / n);
      let r = tp.radius * (1 - rough * 0.5 + rng.next() * rough);
      if (rng.chance(0.18)) r *= 0.62; // occasional tight complex
      const x = Math.cos(a) * r * stretch;
      const y = Math.sin(a) * r;
      ctrl.push([x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    if (rng.chance(0.5)) ctrl.reverse();
    let poly = resampleClosed(catmullRomClosed(ctrl, 48), SPACING);
    poly = smoothClosed(poly, 24, 0.5);
    return resampleClosed(poly, SPACING);
  }

  #validate(poly) {
    const n = poly.length;
    if (n < 300) return false;
    // curvature check
    for (let i = 0; i < n; i++) {
      const a = poly[(i - 3 + n) % n], b = poly[i], c = poly[(i + 3) % n];
      const k = curvature3(a, b, c);
      if (Math.abs(k) > 1 / this.minRadius) return false;
    }
    // separation check between non-neighbouring parts of the loop (spatial hash)
    const minSep = 2 * this.wallDist + 14;
    const cell = minSep;
    const map = new Map();
    for (let i = 0; i < n; i++) {
      const key = `${Math.floor(poly[i][0] / cell)},${Math.floor(poly[i][1] / cell)}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(i);
    }
    const arcSkip = Math.ceil((Math.PI * minSep) / SPACING);
    for (let i = 0; i < n; i += 2) {
      const cx = Math.floor(poly[i][0] / cell), cy = Math.floor(poly[i][1] / cell);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const list = map.get(`${cx + ox},${cy + oy}`);
        if (!list) continue;
        for (const j of list) {
          let di = Math.abs(i - j);
          di = Math.min(di, n - di);
          if (di < arcSkip) continue;
          if (Math.hypot(poly[i][0] - poly[j][0], poly[i][1] - poly[j][1]) < minSep) return false;
        }
      }
    }
    return true;
  }

  #store(poly, rng, tp) {
    let n = poly.length;
    // pick start line in the middle of the straightest section (grid needs ~110 m behind it)
    const kap = new Float64Array(n);
    for (let i = 0; i < n; i++) kap[i] = Math.abs(curvature3(poly[(i - 3 + n) % n], poly[i], poly[(i + 3) % n]));
    let bestI = 0, bestScore = Infinity;
    const back = Math.round(120 / SPACING), fwd = Math.round(70 / SPACING);
    for (let i = 0; i < n; i += 2) {
      let sc = 0;
      for (let k = -back; k <= fwd; k++) sc += kap[(i + k + n) % n];
      if (sc < bestScore) { bestScore = sc; bestI = i; }
    }
    poly = poly.slice(bestI).concat(poly.slice(0, bestI));
    n = poly.length;

    this.n = n;
    this.px = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.py = new Float32Array(n);
    this.tx = new Float32Array(n);
    this.tz = new Float32Array(n);
    this.nx = new Float32Array(n);
    this.nz = new Float32Array(n);
    this.kappa = new Float32Array(n);
    let len = 0;
    for (let i = 0; i < n; i++) {
      this.px[i] = poly[i][0];
      this.pz[i] = poly[i][1];
      const nb = poly[(i + 1) % n];
      len += Math.hypot(nb[0] - poly[i][0], nb[1] - poly[i][1]);
    }
    this.length = len;
    this.ds = len / n;
    for (let i = 0; i < n; i++) {
      const a = poly[(i - 1 + n) % n], c = poly[(i + 1) % n];
      let dx = c[0] - a[0], dz = c[1] - a[1];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      this.tx[i] = dx; this.tz[i] = dz;
      // left normal (three.js: heading θ, forward=(sinθ,cosθ), left=(cosθ,-sinθ))
      this.nx[i] = dz; this.nz[i] = -dx;
    }
    // signed curvature (+ = turning left), smoothed
    const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) raw[i] = curvature3(poly[(i - 3 + n) % n], poly[i], poly[(i + 3) % n]);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = -3; k <= 3; k++) s += raw[(i + k + n) % n];
      this.kappa[i] = s / 7;
    }
    // elevation profile: periodic sines, flattened around the start grid, max grade ~6.5%
    const amp = tp.hills;
    if (amp > 0) {
      const k1 = rng.int(1, 3), k2 = rng.int(3, 6);
      const p1 = rng.range(0, TAU), p2 = rng.range(0, TAU);
      for (let i = 0; i < n; i++) {
        const s = i / n;
        const fromStart = Math.min(i, n - i) * this.ds;
        const flat = smoothstep(60, 260, fromStart);
        this.py[i] = amp * flat * (0.6 * Math.sin(TAU * k1 * s + p1) + 0.4 * Math.sin(TAU * k2 * s + p2));
      }
      let maxGrade = 0;
      for (let i = 0; i < n; i++) maxGrade = Math.max(maxGrade, Math.abs(this.py[(i + 1) % n] - this.py[i]) / this.ds);
      if (maxGrade > 0.065) {
        const f = 0.065 / maxGrade;
        for (let i = 0; i < n; i++) this.py[i] *= f;
      }
    }
    this.bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (let i = 0; i < n; i++) {
      this.bounds.minX = Math.min(this.bounds.minX, this.px[i]);
      this.bounds.maxX = Math.max(this.bounds.maxX, this.px[i]);
      this.bounds.minZ = Math.min(this.bounds.minZ, this.pz[i]);
      this.bounds.maxZ = Math.max(this.bounds.maxZ, this.pz[i]);
    }
    this.center = [(this.bounds.minX + this.bounds.maxX) / 2, (this.bounds.minZ + this.bounds.maxZ) / 2];
    this.extent = Math.max(this.bounds.maxX - this.bounds.minX, this.bounds.maxZ - this.bounds.minZ);
  }

  #computeCurbs() {
    const n = this.n;
    this.curb = new Int8Array(n); // 0 none, 1 = curbs present
    for (let i = 0; i < n; i++) if (Math.abs(this.kappa[i]) > 1 / 110) this.curb[i] = 1;
    // dilate so curbs start a little before and end after corners
    const dil = new Int8Array(n);
    const r = 8;
    for (let i = 0; i < n; i++) if (this.curb[i]) for (let k = -r; k <= r; k++) dil[(i + k + n) % n] = 1;
    this.curb = dil;
  }

  #buildGrid() {
    // coarse spatial hash of samples for global nearest queries (used when a car is "lost")
    this.cell = 40;
    this.grid = new Map();
    for (let i = 0; i < this.n; i++) {
      const key = this.#key(this.px[i], this.pz[i]);
      let list = this.grid.get(key);
      if (!list) this.grid.set(key, (list = []));
      list.push(i);
    }
  }

  #key(x, z) {
    return Math.floor(x / this.cell) * 73856093 ^ Math.floor(z / this.cell) * 19349663;
  }

  wrap(i) {
    const n = this.n;
    return ((i % n) + n) % n;
  }

  /** Nearest sample index searching the whole track (grid accelerated). */
  nearestGlobal(x, z) {
    let best = 0, bestD = Infinity;
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    for (let r = 0; r < 6 && bestD === Infinity; r++) {
      for (let ox = -r; ox <= r; ox++) for (let oz = -r; oz <= r; oz++) {
        if (Math.max(Math.abs(ox), Math.abs(oz)) !== r) continue;
        const list = this.grid.get(((cx + ox) * 73856093) ^ ((cz + oz) * 19349663));
        if (!list) continue;
        for (const i of list) {
          const d = (this.px[i] - x) ** 2 + (this.pz[i] - z) ** 2;
          if (d < bestD) { bestD = d; best = i; }
        }
      }
    }
    if (bestD === Infinity) {
      for (let i = 0; i < this.n; i++) {
        const d = (this.px[i] - x) ** 2 + (this.pz[i] - z) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    return best;
  }

  /**
   * Projects a world point onto the centre line, searching around `hint`.
   * Writes into `out` = { index, t, s, d, height, grade, tx, tz, nx, nz }.
   */
  project(x, z, hint, out) {
    const n = this.n;
    let best = -1, bestD = Infinity;
    if (hint >= 0) {
      for (let k = -14; k <= 14; k++) {
        const i = this.wrap(hint + k);
        const d = (this.px[i] - x) ** 2 + (this.pz[i] - z) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    if (best < 0 || bestD > (this.wallDist * 2.5) ** 2) best = this.nearestGlobal(x, z);
    let i = best;
    let j = this.wrap(i + 1);
    let ex = this.px[j] - this.px[i], ez = this.pz[j] - this.pz[i];
    let t = ((x - this.px[i]) * ex + (z - this.pz[i]) * ez) / (ex * ex + ez * ez || 1);
    if (t < 0) {
      i = this.wrap(i - 1);
      j = this.wrap(i + 1);
      ex = this.px[j] - this.px[i];
      ez = this.pz[j] - this.pz[i];
      t = ((x - this.px[i]) * ex + (z - this.pz[i]) * ez) / (ex * ex + ez * ez || 1);
    }
    t = clamp(t, 0, 1);
    const cx = this.px[i] + ex * t, cz = this.pz[i] + ez * t;
    let nxv = lerp(this.nx[i], this.nx[j], t), nzv = lerp(this.nz[i], this.nz[j], t);
    const nl = Math.hypot(nxv, nzv) || 1;
    nxv /= nl; nzv /= nl;
    out.index = i;
    out.t = t;
    out.s = (i + t) * this.ds;
    out.d = (x - cx) * nxv + (z - cz) * nzv;
    out.height = lerp(this.py[i], this.py[j], t);
    out.grade = (this.py[j] - this.py[i]) / this.ds;
    out.nx = nxv;
    out.nz = nzv;
    out.tx = -nzv;
    out.tz = nxv;
    out.curb = this.curb[i];
    out.kappa = this.kappa[i];
    if (out.s >= this.length) out.s -= this.length;
    return out;
  }

  /** World position at arc length `s` and lateral offset `d` (+ = left). */
  pointAt(s, d, out = {}) {
    const f = ((s / this.ds) % this.n + this.n) % this.n;
    const i = Math.floor(f);
    const j = this.wrap(i + 1);
    const t = f - i;
    const x = lerp(this.px[i], this.px[j], t);
    const z = lerp(this.pz[i], this.pz[j], t);
    let nxv = lerp(this.nx[i], this.nx[j], t), nzv = lerp(this.nz[i], this.nz[j], t);
    const l = Math.hypot(nxv, nzv) || 1;
    nxv /= l; nzv /= l;
    out.x = x + nxv * d;
    out.z = z + nzv * d;
    out.y = lerp(this.py[i], this.py[j], t);
    out.heading = Math.atan2(-nzv, nxv); // heading of tangent (tx,tz)=(-nz,nx): atan2(tx, tz)
    out.index = i;
    return out;
  }

  /** Starting grid slot k (0 = pole): staggered two-wide grid behind the start line. */
  gridSlot(k) {
    const row = Math.floor(k / 2);
    const side = k % 2 === 0 ? 1 : -1;
    const s = this.length - 9 - row * 10 - (side < 0 ? 4 : 0);
    return { s, d: side * Math.min(3.4, this.halfWidth - 2), back: this.length - s };
  }

  /**
   * Minimum-curvature racing line by iterative relaxation inside the track limits.
   * Returns lateral offsets (+ = left) per sample, cached.
   */
  racingLine() {
    if (this._line) return this._line;
    const n = this.n;
    const lim = this.halfWidth - 1.6;
    const off = new Float32Array(n);
    const X = new Float32Array(n), Z = new Float32Array(n);
    const update = (span, iters) => {
      for (let it = 0; it < iters; it++) {
        for (let i = 0; i < n; i++) {
          X[i] = this.px[i] + this.nx[i] * off[i];
          Z[i] = this.pz[i] + this.nz[i] * off[i];
        }
        for (let i = 0; i < n; i++) {
          const a = (i - span + n) % n, b = (i + span) % n;
          const mx = (X[a] + X[b]) * 0.5, mz = (Z[a] + Z[b]) * 0.5;
          const target = (mx - this.px[i]) * this.nx[i] + (mz - this.pz[i]) * this.nz[i];
          off[i] = clamp(lerp(off[i], target, 0.6), -lim, lim);
        }
      }
    };
    update(12, 120);
    update(6, 120);
    update(3, 80);
    // curvature of the line itself
    const kl = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      X[i] = this.px[i] + this.nx[i] * off[i];
      Z[i] = this.pz[i] + this.nz[i] * off[i];
    }
    for (let i = 0; i < n; i++) {
      const a = (i - 3 + n) % n, b = (i + 3) % n;
      kl[i] = curvature3([X[a], Z[a]], [X[i], Z[i]], [X[b], Z[b]]);
    }
    const ks = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = -4; k <= 4; k++) s += kl[(i + k + n) % n];
      ks[i] = s / 9;
    }
    this._line = { offset: off, kappa: ks };
    return this._line;
  }

  /**
   * Target speed (m/s) along the racing line for a car with friction coefficient `mu`,
   * downforce coefficient `clAOverM` (0.5·ρ·ClA/m) and braking deceleration `brakeDecel`.
   */
  speedProfile(mu, clAOverM, brakeDecel, vCap = 140) {
    const { kappa } = this.racingLine();
    const n = this.n;
    const v = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const k = Math.abs(kappa[i]);
      const denom = k - mu * clAOverM;
      v[i] = denom <= 1e-5 ? vCap : Math.min(vCap, Math.sqrt((mu * GRAVITY) / denom));
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let i = n - 1; i >= 0; i--) {
        const nxt = v[(i + 1) % n];
        const lim = Math.sqrt(nxt * nxt + 2 * brakeDecel * this.ds);
        if (v[i] > lim) v[i] = lim;
      }
    }
    return v;
  }
}

/** Signed curvature through three points (+ = turning left with our heading convention). */
export function curvature3(a, b, c) {
  const abx = b[0] - a[0], abz = b[1] - a[1];
  const bcx = c[0] - b[0], bcz = c[1] - b[1];
  const acx = c[0] - a[0], acz = c[1] - a[1];
  // cross of (ab, bc) in x/z; with left=(tz,-tx) a left turn gives negative 2D cross(x,z)
  const cross = abx * bcz - abz * bcx;
  const la = Math.hypot(abx, abz), lb = Math.hypot(bcx, bcz), lc = Math.hypot(acx, acz);
  const denom = la * lb * lc;
  return denom < 1e-9 ? 0 : (-2 * cross) / denom;
}
