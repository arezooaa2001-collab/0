// Collision world: oriented boxes (yaw), vertical cylinders, one-way platforms, moving platforms; capsule resolution + raycasts.
import * as THREE from 'three';
import { heightAt } from './world/terrain.js';

const CELL = 32;
const key = (ix, iz) => ((ix + 2048) << 12) | (iz + 2048);

export class Physics {
  constructor() { this.grid = new Map(); this.dynamic = []; this.all = []; this.stamp = 1; }
  _reg(c) {
    const r = c.type === 'box' ? Math.hypot(c.hx, c.hz) : c.r;
    c.br = r;
    if (c.dynamic) { this.dynamic.push(c); return; }
    const x0 = Math.floor((c.x - r) / CELL), x1 = Math.floor((c.x + r) / CELL), z0 = Math.floor((c.z - r) / CELL), z1 = Math.floor((c.z + r) / CELL);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) { const k = key(ix, iz); let a = this.grid.get(k); if (!a) this.grid.set(k, (a = [])); a.push(c); }
  }
  addBox(o) {
    const c = Object.assign({ type: 'box', yaw: 0, kind: 'solid', active: true, vx: 0, vy: 0, vz: 0, dyaw: 0, _s: 0 }, o);
    c.cos = Math.cos(c.yaw); c.sin = Math.sin(c.yaw);
    this._reg(c); this.all.push(c); return c;
  }
  addCyl(o) { const c = Object.assign({ type: 'cyl', kind: 'solid', active: true, vx: 0, vy: 0, vz: 0, dyaw: 0, _s: 0 }, o); this._reg(c); this.all.push(c); return c; }
  // move a dynamic collider, recording its velocity for platform inheritance
  moveTo(c, x, y, z, yaw, dt) {
    if (dt > 0) { c.vx = (x - c.x) / dt; c.vy = (y - c.y) / dt; c.vz = (z - c.z) / dt; c.dyaw = yaw !== undefined ? (yaw - c.yaw) : 0; }
    c.px = c.x; c.py = c.y; c.pz = c.z;
    c.x = x; c.y = y; c.z = z;
    if (yaw !== undefined) { c.yaw = yaw; c.cos = Math.cos(yaw); c.sin = Math.sin(yaw); }
  }
  query(x, z, r, out) {
    out.length = 0; const s = ++this.stamp;
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL), z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const a = this.grid.get(key(ix, iz)); if (!a) continue;
      for (const c of a) if (c._s !== s && c.active) { c._s = s; if (Math.abs(c.x - x) < r + c.br && Math.abs(c.z - z) < r + c.br) out.push(c); }
    }
    for (const c of this.dynamic) if (c.active && Math.abs(c.x - x) < r + c.br && Math.abs(c.z - z) < r + c.br) out.push(c);
    return out;
  }

  /**
   * Resolve a vertical capsule (feet at pos.y) against colliders. Mutates pos & vel.
   * Returns contact info in `res`: ground (normal, collider), wall normal, ceiling.
   */
  resolveCapsule(pos, vel, radius, height, res, opts = {}) {
    const cands = this.query(pos.x, pos.z, radius + 1.5, this._q || (this._q = []));
    const step = opts.step ?? 0.5;
    for (let iter = 0; iter < 3; iter++) {
      let any = false;
      for (const c of cands) {
        if (c.kind === 'trigger') continue;
        const y0 = pos.y + radius, y1 = pos.y + height - radius;
        let lx, lz, by0, by1, qx, qz;
        const dx = pos.x - c.x, dz = pos.z - c.z;
        if (c.type === 'box') {
          lx = dx * c.cos - dz * c.sin; lz = dx * c.sin + dz * c.cos;
          if (Math.abs(lx) > c.hx + radius || Math.abs(lz) > c.hz + radius) continue;
          by0 = c.y - c.hy; by1 = c.y + c.hy;
          qx = Math.max(-c.hx, Math.min(c.hx, lx)); qz = Math.max(-c.hz, Math.min(c.hz, lz));
        } else {
          lx = dx; lz = dz; const dh = Math.hypot(dx, dz);
          if (dh > c.r + radius) continue;
          by0 = c.y - c.hy; by1 = c.y + c.hy;
          if (dh > c.r) { qx = dx / dh * c.r; qz = dz / dh * c.r; } else { qx = lx; qz = lz; }
        }
        if (y0 - radius > by1 + 0.02 || y1 + radius < by0) continue;
        if (c.kind === 'oneway') { if ((opts.prevY ?? pos.y) < by1 - 0.35 || vel.y > 0.5) continue; }
        let segY, boxY;
        if (y1 < by0) { segY = y1; boxY = by0; } else if (y0 > by1) { segY = y0; boxY = by1; } else { segY = boxY = Math.max(y0, Math.min(y1, by1)); }
        let nx = lx - qx, ny = segY - boxY, nz = lz - qz;
        let d = Math.hypot(nx, ny, nz), depth;
        const toTop = by1 - pos.y;
        if (d > 1e-5) {
          if (d >= radius) continue;
          nx /= d; ny /= d; nz /= d; depth = radius - d;
          if (ny < 0.5 && ny > -0.5 && toTop > -0.02 && toTop < step && opts.grounded) { nx = 0; ny = 1; nz = 0; depth = toTop; }
        } else {
          // axis inside the shape: pick the cheapest exit
          const ex = c.type === 'box' ? c.hx - Math.abs(lx) + radius : c.r - Math.hypot(lx, lz) + radius;
          const ez = c.type === 'box' ? c.hz - Math.abs(lz) + radius : 1e9;
          const eu = toTop, ed = y1 - by0 + radius;
          let m = Math.min(ex, ez, eu, ed);
          if (eu < step + 0.2) m = eu;
          if (m === eu) { nx = 0; ny = 1; nz = 0; depth = eu; }
          else if (m === ed) { nx = 0; ny = -1; nz = 0; depth = ed; }
          else if (m === ex) { if (c.type === 'box') { nx = Math.sign(lx) || 1; ny = 0; nz = 0; } else { const h = Math.hypot(lx, lz) || 1; nx = lx / h; nz = lz / h; ny = 0; } depth = ex; }
          else { nx = 0; ny = 0; nz = Math.sign(lz) || 1; depth = ez; }
        }
        // back to world space
        let wx = nx, wz = nz;
        if (c.type === 'box') { wx = nx * c.cos + nz * c.sin; wz = -nx * c.sin + nz * c.cos; }
        pos.x += wx * depth; pos.y += ny * depth; pos.z += wz * depth;
        const vn = vel.x * wx + vel.y * ny + vel.z * wz;
        if (vn < 0) { vel.x -= wx * vn; vel.y -= ny * vn; vel.z -= wz * vn; }
        any = true;
        if (ny > 0.6) { res.ground = true; res.gnx = wx; res.gny = ny; res.gnz = wz; res.gc = c; res.gy = pos.y; }
        else if (ny < -0.6) res.ceiling = true;
        else { res.wall = true; res.wnx = wx; res.wnz = wz; res.wc = c; }
        if (c.onTouch) c.onTouch(c, res);
      }
      if (!any) break;
    }
    return res;
  }

  // Ray vs colliders + terrain. Returns distance or Infinity. out.normal set when hit.
  raycast(o, d, max, out = {}, terrain = true) {
    let best = max; out.c = null;
    const steps = Math.ceil(max / 24);
    const seen = ++this.stamp;
    const tmp = this._rq || (this._rq = []);
    for (let s = 0; s <= steps; s++) {
      const t = Math.min(max, s * 24);
      this.query(o.x + d.x * t, o.z + d.z * t, 14, tmp);
      for (const c of tmp) {
        if (c._r === seen || c.kind === 'trigger') continue; c._r = seen;
        const h = c.type === 'box' ? rayBox(o, d, c) : rayCyl(o, d, c);
        if (h < best) { best = h; out.c = c; }
      }
    }
    if (terrain) {
      // march terrain
      let prev = 0; const stepLen = Math.max(1, best / 40);
      for (let t = stepLen; t <= best; t += stepLen) {
        const y = o.y + d.y * t; if (y < heightAt(o.x + d.x * t, o.z + d.z * t)) {
          let a = prev, b = t; for (let i = 0; i < 6; i++) { const m = (a + b) / 2; if (o.y + d.y * m < heightAt(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; }
          best = a; out.c = 'terrain'; break;
        }
        prev = t;
      }
    }
    out.dist = best; return best;
  }
}

function rayBox(o, d, c) {
  const dx = o.x - c.x, dz = o.z - c.z;
  const lox = dx * c.cos - dz * c.sin, loz = dx * c.sin + dz * c.cos, loy = o.y - c.y;
  const ldx = d.x * c.cos - d.z * c.sin, ldz = d.x * c.sin + d.z * c.cos, ldy = d.y;
  let tmin = -Infinity, tmax = Infinity;
  for (const [p, v, h] of [[lox, ldx, c.hx], [loy, ldy, c.hy], [loz, ldz, c.hz]]) {
    if (Math.abs(v) < 1e-8) { if (p < -h || p > h) return Infinity; continue; }
    let t1 = (-h - p) / v, t2 = (h - p) / v; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return Infinity;
  }
  if (tmax < 0) return Infinity;
  return tmin > 0 ? tmin : Infinity; // ignore if origin inside
}
function rayCyl(o, d, c) {
  const ox = o.x - c.x, oz = o.z - c.z;
  const a = d.x * d.x + d.z * d.z, b = 2 * (ox * d.x + oz * d.z), cc = ox * ox + oz * oz - c.r * c.r;
  let t = Infinity;
  if (a > 1e-8) { const disc = b * b - 4 * a * cc; if (disc >= 0) { const t1 = (-b - Math.sqrt(disc)) / (2 * a); if (t1 > 0) { const y = o.y + d.y * t1; if (y > c.y - c.hy && y < c.y + c.hy) t = t1; } } }
  if (Math.abs(d.y) > 1e-6) {
    for (const yy of [c.y + c.hy, c.y - c.hy]) { const tc = (yy - o.y) / d.y; if (tc > 0 && tc < t) { const x = ox + d.x * tc, z = oz + d.z * tc; if (x * x + z * z < c.r * c.r) t = tc; } }
  }
  return t;
}

// Debug visualisation of colliders near a point
export function debugColliders(phys, scene, center, group) {
  if (!group) { group = new THREE.Group(); group.name = 'colDebug'; scene.add(group); }
  while (group.children.length) { const m = group.children.pop(); m.geometry.dispose(); }
  const mat = debugColliders.mat || (debugColliders.mat = new THREE.MeshBasicMaterial({ color: 0x00ffaa, wireframe: true, depthTest: false, transparent: true, opacity: 0.6 }));
  const list = phys.query(center.x, center.z, 70, []);
  for (const c of list) {
    const g = c.type === 'box' ? new THREE.BoxGeometry(c.hx * 2, c.hy * 2, c.hz * 2) : new THREE.CylinderGeometry(c.r, c.r, c.hy * 2, 16);
    const m = new THREE.Mesh(g, mat); m.position.set(c.x, c.y, c.z); m.rotation.y = c.yaw || 0; m.renderOrder = 999; group.add(m);
  }
  return group;
}
