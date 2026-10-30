'use strict';
/*
 * Exact collision. Every static piece of a world (each box, cylinder, sphere... that the
 * world was built from) becomes a solid with its real outline seen from above, so people touch
 * things exactly where they are: no invisible margin, no walking into them. Low pieces (mats,
 * platforms, steps up to SOLID.step high) are stood on instead: feet rest on their top.
 * A person is a capsule as wide as the shoulders and as deep as the body.
 */

const SOLID = { low: 0.025, high: 1.9, step: 0.42, cell: 4 };
// the core of the body (always inside the real body); arms, legs and head touch things by their real surface
const BODY = { half: 0.12, r: 0.1 };
const EXT_DIRS = (() => {
  const d = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) { const L = Math.hypot(x, y, z); d.push([x / L, y / L, z / L]); }
  return d;
})();
const EXT_DIRS_LITE = EXT_DIRS.filter((d) => d.filter((v) => v !== 0).length <= 2 && !(d[1] !== 0 && (d[0] !== 0 || d[2] !== 0)));

/** For each bone, the outermost points of its part of the body (bone space). */
function bodyExtremes(ch, lite) {
  const g = ch.mesh.geometry;
  const key = lite ? 'extLite' : 'ext';
  if (g.userData[key]) return g.userData[key];
  const P = g.attributes.position;
  const SI = g.attributes.skinIndex;
  const inv = ch.mesh.skeleton.boneInverses;
  const byBone = new Map();
  for (let i = 0; i < P.count; i++) {
    const b = SI.getX(i);
    let a = byBone.get(b);
    if (!a) byBone.set(b, (a = []));
    a.push(i);
  }
  const out = [];
  const v = new THREE.Vector3();
  for (const [b, list] of byBone) {
    const picks = new Set();
    for (const d of lite ? EXT_DIRS_LITE : EXT_DIRS) {
      let best = -Infinity, bi = -1;
      for (const i of list) {
        const t = P.getX(i) * d[0] + P.getY(i) * d[1] + P.getZ(i) * d[2];
        if (t > best) { best = t; bi = i; }
      }
      picks.add(bi);
    }
    if (!lite) {
      // the whole surface, one point every few centimetres (the outermost in each little cube)
      let cx = 0, cy = 0, cz = 0;
      for (const i of list) { cx += P.getX(i); cy += P.getY(i); cz += P.getZ(i); }
      cx /= list.length; cy /= list.length; cz /= list.length;
      const vox = new Map();
      for (const i of list) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
        const k = Math.floor(x / 0.04) + ',' + Math.floor(y / 0.04) + ',' + Math.floor(z / 0.04);
        const d = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
        const o = vox.get(k);
        if (!o || d > o[1]) vox.set(k, [i, d]);
      }
      for (const [i] of vox.values()) picks.add(i);
    }
    const pts = [];
    for (const i of picks) { v.fromBufferAttribute(P, i).applyMatrix4(inv[b]); pts.push(v.x, v.y, v.z); }
    out.push({ bone: b, pts: Float32Array.from(pts) });
  }
  g.userData[key] = out;
  return out;
}

/** How far to slide a point (x, y, z) sideways to get it out of a solid, or null if it isn't inside. */
function pointPush(s, x, y, z) {
  if (y < s.bottom || y > s.top || x < s.x1 || x > s.x2 || z < s.z1 || z > s.z2) return null;
  if (s.planes) {
    const P = s.planes;
    let best = Infinity, bx = 0, bz = 0;
    for (let k = 0; k < P.length; k += 4) {
      const d = P[k] * x + P[k + 1] * y + P[k + 2] * z + P[k + 3];
      if (d > 0) return null;
      const h = Math.hypot(P[k], P[k + 2]);
      if (h < 0.2) continue;
      const need = -d / h;
      if (need < best) { best = need; bx = P[k] / h; bz = P[k + 2] / h; }
    }
    if (best === Infinity) return null;
    return [bx * (best + 1e-4), bz * (best + 1e-4)];
  }
  if (!pointInSolid(s, x, z)) return null;
  return pushOut(s, x, z, 1e-4);
}
const _lm = new THREE.Vector3();
const BODY_OFFS = [-1, -0.5, 0, 0.5, 1];
/** Andrew's monotone chain; returns counter-clockwise points (x, z) seen from above. */
function hull2d(pts) {
  if (pts.length < 3) return pts.slice();
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-9) lo.pop(); lo.push(p); }
  const up = [];
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 1e-9) up.pop(); up.push(p); }
  up.pop(); lo.pop();
  return lo.concat(up);
}

function makeSolid(pts, top, bottom, tris) {
  let h = hull2d(pts);
  if (h.length < 3) {
    // a flat wall of zero thickness seen from above: give it a hair of depth
    const [a, b] = h.length === 2 ? h : [h[0], [h[0][0] + 1e-3, h[0][1]]];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L * 0.002;
    const nz = dx / L * 0.002;
    h = hull2d([[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [a[0] - nx, a[1] - nz], [b[0] - nx, b[1] - nz]]);
    if (h.length < 3) return null;
  }
  const n = h.length;
  const nx = new Float64Array(n);
  const nz = new Float64Array(n);
  let x1 = Infinity, z1 = Infinity, x2 = -Infinity, z2 = -Infinity;
  for (let i = 0; i < n; i++) {
    const a = h[i];
    const b = h[(i + 1) % n];
    const ex = b[0] - a[0];
    const ez = b[1] - a[1];
    const L = Math.hypot(ex, ez) || 1;
    // counter-clockwise in (x, z): outward normal is (ez, -ex)
    nx[i] = ez / L; nz[i] = -ex / L;
    x1 = Math.min(x1, a[0]); x2 = Math.max(x2, a[0]); z1 = Math.min(z1, a[1]); z2 = Math.max(z2, a[1]);
  }
  // a level top (a mat, a box) needs no triangles to know its height
  const flat = !!(tris && tris.length && tris.every((t) => t.every((v) => Math.abs(v[1] - top) < 1e-3)));
  return { pts: h, nx, nz, x1, z1, x2, z2, top, bottom, step: top <= SOLID.step, tris, flat };
}

const _sv = new THREE.Vector3();

/** Solids for one part {geo, matrix}: convex pieces as they are, other shapes split into clumps. */
function partSolids(part, out) {
  const P = part.geo.attributes.position;
  const verts = [];
  let top = -Infinity;
  let bottom = Infinity;
  for (let i = 0; i < P.count; i++) {
    _sv.fromBufferAttribute(P, i).applyMatrix4(part.matrix);
    verts.push([_sv.x, _sv.y, _sv.z]);
    if (_sv.y > top) top = _sv.y;
    if (_sv.y < bottom) bottom = _sv.y;
  }
  if (top < SOLID.low || bottom > SOLID.high) return;
  const stepTris = (vs) => {
    // upward faces, to know how high the surface is under a foot
    const idx = part.geo.index;
    const tris = [];
    const n = idx ? idx.count : P.count;
    for (let i = 0; i < n; i += 3) {
      const a = verts[idx ? idx.getX(i) : i];
      const b = verts[idx ? idx.getX(i + 1) : i + 1];
      const c = verts[idx ? idx.getX(i + 2) : i + 2];
      if (vs && !(vs.has(a) && vs.has(b) && vs.has(c))) continue;
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const ny = uz * vx - ux * vz;
      const len = Math.hypot(uy * vz - uz * vy, ny, ux * vy - uy * vx);
      if (len < 1e-9 || ny / len < 0.3) continue;
      tris.push([a, b, c]);
    }
    return tris;
  };
  // the part of it inside the body's height range: corners in range plus edges cut at its limits
  let use = verts;
  if (top > SOLID.high || bottom < SOLID.low) {
    use = verts.filter((v) => v[1] >= SOLID.low && v[1] <= SOLID.high);
    const idx = part.geo.index;
    const n = idx ? idx.count : P.count;
    const at = (i) => verts[idx ? idx.getX(i) : i];
    for (let i = 0; i < n; i += 3) {
      for (let e = 0; e < 3; e++) {
        const a = at(i + e);
        const b = at(i + (e + 1) % 3);
        for (const yc of [SOLID.low, SOLID.high]) {
          if ((a[1] - yc) * (b[1] - yc) >= 0) continue;
          const t = (yc - a[1]) / (b[1] - a[1]);
          use.push([a[0] + (b[0] - a[0]) * t, yc, a[2] + (b[2] - a[2]) * t]);
        }
      }
    }
    if (use.length < 2) return;
  }
  if (part.geo.userData.convex) {
    const s = makeSolid(use.map((v) => [v[0], v[2]]), Math.min(top, 9), bottom, top <= SOLID.step ? stepTris(null) : null);
    if (s) { s.planes = convexPlanes(part.geo, verts); out.push(s); }
    return;
  }
  // any other shape (rings, arches, strips): clumps of nearby points, one outline each
  const G = 0.25;
  const cells = new Map();
  for (const v of use) {
    const k = Math.floor(v[0] / G) + ',' + Math.floor(v[2] / G);
    let c = cells.get(k);
    if (!c) cells.set(k, (c = []));
    c.push(v);
  }
  const seen = new Set();
  for (const key of cells.keys()) {
    if (seen.has(key)) continue;
    const group = [];
    const stack = [key];
    seen.add(key);
    while (stack.length) {
      const k = stack.pop();
      group.push(...cells.get(k));
      const [cx, cz] = k.split(',').map(Number);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const nk = (cx + dx) + ',' + (cz + dz);
          if (!seen.has(nk) && cells.has(nk)) { seen.add(nk); stack.push(nk); }
        }
      }
    }
    let gt = -Infinity, gb = Infinity;
    for (const v of group) { if (v[1] > gt) gt = v[1]; if (v[1] < gb) gb = v[1]; }
    if (gt < SOLID.low) continue;
    const s = makeSolid(group.map((v) => [v[0], v[2]]), gt, gb, gt <= SOLID.step ? stepTris(new Set(group)) : null);
    if (s) out.push(s);
  }
}

/** Face planes (outward normal n, offset c: n·p + c <= 0 inside) of a convex piece. */
function convexPlanes(geo, verts) {
  const idx = geo.index;
  const n = idx ? idx.count : verts.length;
  let cx = 0, cy = 0, cz = 0;
  for (const v of verts) { cx += v[0]; cy += v[1]; cz += v[2]; }
  cx /= verts.length; cy /= verts.length; cz /= verts.length;
  const planes = [];
  for (let i = 0; i < n; i += 3) {
    const a = verts[idx ? idx.getX(i) : i];
    const b = verts[idx ? idx.getX(i + 1) : i + 1];
    const c = verts[idx ? idx.getX(i + 2) : i + 2];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz);
    if (L < 1e-12) continue;
    nx /= L; ny /= L; nz /= L;
    let d = -(nx * a[0] + ny * a[1] + nz * a[2]);
    if (nx * cx + ny * cy + nz * cz + d > 0) { nx = -nx; ny = -ny; nz = -nz; d = -d; }
    let dup = false;
    for (let k = 0; k < planes.length; k += 4) {
      if (Math.abs(planes[k] - nx) < 1e-4 && Math.abs(planes[k + 1] - ny) < 1e-4 && Math.abs(planes[k + 2] - nz) < 1e-4 && Math.abs(planes[k + 3] - d) < 1e-4) { dup = true; break; }
    }
    if (!dup) planes.push(nx, ny, nz, d);
  }
  return Float64Array.from(planes);
}

function pointInSolid(s, x, z) {
  if (x < s.x1 || x > s.x2 || z < s.z1 || z > s.z2) return false;
  const p = s.pts;
  for (let i = 0; i < p.length; i++) if ((x - p[i][0]) * s.nx[i] + (z - p[i][1]) * s.nz[i] > 0) return false;
  return true;
}

/** Push a circle (c, r) out of a convex solid. Returns [dx, dz] or null. */
function pushOut(s, x, z, r) {
  if (x < s.x1 - r || x > s.x2 + r || z < s.z1 - r || z > s.z2 + r) return null;
  const p = s.pts;
  const n = p.length;
  let inside = true;
  let best = -Infinity;
  let bi = 0;
  for (let i = 0; i < n; i++) {
    const d = (x - p[i][0]) * s.nx[i] + (z - p[i][1]) * s.nz[i];
    if (d > 0) inside = false;
    if (d > best) { best = d; bi = i; }
  }
  if (inside) return [s.nx[bi] * (r - best), s.nz[bi] * (r - best)];
  if (best >= r) return null;
  // nearest point on the outline
  let md = Infinity, qx = 0, qz = 0;
  for (let i = 0; i < n; i++) {
    const a = p[i];
    const b = p[(i + 1) % n];
    const ex = b[0] - a[0];
    const ez = b[1] - a[1];
    const L2 = ex * ex + ez * ez || 1e-12;
    const t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / L2, 0, 1);
    const cx = a[0] + ex * t;
    const cz = a[1] + ez * t;
    const d = (x - cx) * (x - cx) + (z - cz) * (z - cz);
    if (d < md) { md = d; qx = cx; qz = cz; }
  }
  if (md >= r * r) return null;
  const d = Math.sqrt(md);
  if (d < 1e-9) return [s.nx[bi] * r, s.nz[bi] * r];
  return [(x - qx) / d * (r - d), (z - qz) / d * (r - d)];
}

const _origFinish = WorldBase.prototype.finishBatches;

Object.assign(WorldBase.prototype, {
  finishBatches() {
    this.solidParts = [...this.matte.parts, ...this.metal.parts, ...this.glow.parts];
    this.solids = null;
    _origFinish.call(this);
  },

  /** Built on first use, after everything (statues, placed pieces) is in. */
  ensureSolids() {
    if (this.solids) return;
    const list = [];
    for (const part of this.solidParts || []) partSolids(part, list);
    // other solid things in the scene (portals, rings, goals...): not people, effects or see-through things
    this.scene.updateMatrixWorld(true);
    const walk = (o) => {
      if (!o.visible || o.userData.noSolid || o.isSprite || o.isPoints || o.isLine) return;
      if (o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && o.geometry && o.geometry.attributes.position) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const fx = mats.some((m) => !m || (m.transparent && m.opacity < 0.95) || m.blending === THREE.AdditiveBlending || m.side === THREE.BackSide || m.depthWrite === false || m.wireframe);
        const n = o.geometry.attributes.position.count;
        if (!fx && n <= 40000) {
          const g = o.geometry;
          if (g.userData.convex == null) g.userData.convex = /^(Box|Sphere|Cylinder|Cone|Capsule|Plane|Circle|Icosahedron|Octahedron|Dodecahedron|Tetrahedron)Geometry$/.test(g.type);
          partSolids({ geo: g, matrix: o.matrixWorld }, list);
        }
      }
      for (const c of o.children) walk(c);
    };
    for (const c of this.scene.children) walk(c);
    if (this.placed) for (const p of this.placed.values()) for (const part of p.solidParts || []) partSolids(part, list);
    this.solids = list;
    const C = SOLID.cell;
    this.solidGrid = new Map();
    for (const s of list) {
      // registered a little beyond its outline, so anything reaching into it from the next cell finds it
      const M = 0.7;
      for (let gx = Math.floor((s.x1 - M) / C); gx <= Math.floor((s.x2 + M) / C); gx++) {
        for (let gz = Math.floor((s.z1 - M) / C); gz <= Math.floor((s.z2 + M) / C); gz++) {
          const k = gx * 100003 + gz;
          let a = this.solidGrid.get(k);
          if (!a) this.solidGrid.set(k, (a = []));
          a.push(s);
        }
      }
    }
    // hand-made boxes that the real shapes already cover are dropped (they were only approximations);
    // the rest stay (water, things not built from pieces)
    this.activeColliders = this.colliders.filter((c) => {
      const w = c.x2 - c.x1;
      const d = c.z2 - c.z1;
      const nx = clamp(Math.ceil(w / 0.1), 2, 30);
      const nz = clamp(Math.ceil(d / 0.1), 2, 30);
      let hit = 0;
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          const x = c.x1 + (i + 0.5) * w / nx;
          const z = c.z1 + (j + 0.5) * d / nz;
          if (this.solidsNear(x, z).some((s) => pointInSolid(s, x, z))) hit++;
        }
      }
      // anything real there at all: the real shape is the wall, the box would only add a margin
      if (hit > 0) return false;
      for (const s of this.solidsNear((c.x1 + c.x2) / 2, (c.z1 + c.z2) / 2)) {
        if (s.x2 > c.x1 && s.x1 < c.x2 && s.z2 > c.z1 && s.z1 < c.z2) return false;
      }
      return true;
    }).map((c) => makeSolid([[c.x1, c.z1], [c.x2, c.z1], [c.x2, c.z2], [c.x1, c.z2]], 2, 0, null));
  },

  solidsNear(x, z) {
    const C = SOLID.cell;
    return this.solidGrid.get(Math.floor(x / C) * 100003 + Math.floor(z / C)) || [];
  },

  /** Height of whatever low surface (mat, platform, step) is under this spot. */
  groundAt(x, z, rr = 0.1, minSize = 0) {
    this.ensureSolids();
    let h = 0;
    for (const s of this.solidsNear(x, z)) {
      if (!s.step || s.top <= h || !s.tris) continue;
      if (minSize && Math.min(s.x2 - s.x1, s.z2 - s.z1) < minSize) continue;
      if (x < s.x1 - rr || x > s.x2 + rr || z < s.z1 - rr || z > s.z2 + rr) continue;
      for (const [px, pz] of [[x, z], [x + rr, z], [x - rr, z], [x, z + rr], [x, z - rr]]) {
        if (!pointInSolid(s, px, pz)) continue;
        if (s.flat) { h = s.top; break; }
        for (const [a, b, c] of s.tris) {
          const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
          if (Math.abs(d) < 1e-12) continue;
          const l1 = ((b[2] - c[2]) * (px - c[0]) + (c[0] - b[0]) * (pz - c[2])) / d;
          const l2 = ((c[2] - a[2]) * (px - c[0]) + (a[0] - c[0]) * (pz - c[2])) / d;
          const l3 = 1 - l1 - l2;
          if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
          const y = l1 * a[1] + l2 * b[1] + l3 * c[1];
          if (y > h) h = y;
        }
      }
    }
    return h;
  },

  /** Push one circle (x, z, r) at height y out of every solid it overlaps. */
  pushCircle(pos, ox, oz, r, y) {
    let moved = false;
    const x = pos.x + ox;
    const z = pos.z + oz;
    const near = this.solidsNear(x, z);
    for (let k = 0; k < near.length + this.activeColliders.length; k++) {
      const s = k < near.length ? near[k] : this.activeColliders[k - near.length];
      if (s.step || s.bottom > y + SOLID.high || s.top < y + SOLID.low) continue;
      const p = pushOut(s, pos.x + ox, pos.z + oz, r);
      if (p) { pos.x += p[0]; pos.z += p[1]; moved = true; }
    }
    return moved;
  },

  /** A round thing of radius r (a ball, a pet, an old caller). */
  resolve(pos, r) {
    this.ensureSolids();
    this.clampBounds(pos, r);
    for (let it = 0; it < 3; it++) if (!this.pushCircle(pos, 0, 0, r, pos.y || 0)) break;
    this.clampBounds(pos, r);
  },

  /** A person: a capsule across the shoulders, turned with the body. */
  resolveBody(pos, yaw) {
    this.ensureSolids();
    const sx = Math.cos(yaw) * BODY.half;
    const sz = -Math.sin(yaw) * BODY.half;
    this.clampBounds(pos, BODY.r);
    for (let it = 0; it < 4; it++) {
      let moved = false;
      for (const o of BODY_OFFS) if (this.pushCircle(pos, sx * o, sz * o, BODY.r, pos.y || 0)) moved = true;
      if (!moved) break;
    }
    this.clampBounds(pos, BODY.r);
  },

  clampBounds(pos, r) {
    const B = this.bounds;
    if (B.extra) {
      // several rooms: fine inside any of them, otherwise back into the nearest
      const rects = [[-B.rect[0], -B.rect[1], B.rect[0], B.rect[1]], ...B.extra];
      let best = null, bd = Infinity;
      for (const [x1, z1, x2, z2] of rects) {
        const cx = clamp(pos.x, x1 + r, x2 - r);
        const cz = clamp(pos.z, z1 + r, z2 - r);
        const d = (cx - pos.x) ** 2 + (cz - pos.z) ** 2;
        if (d < bd) { bd = d; best = [cx, cz]; }
      }
      pos.x = best[0];
      pos.z = best[1];
      return;
    }
    if (B.circle) {
      const d = Math.hypot(pos.x, pos.z);
      const lim = B.circle - r;
      if (d > lim) { pos.x *= lim / d; pos.z *= lim / d; }
    } else {
      pos.x = clamp(pos.x, -B.rect[0] + r, B.rect[0] - r);
      pos.z = clamp(pos.z, -B.rect[1] + r, B.rect[1] - r);
    }
  },

  /** Stand on whatever is underneath, stepping up and down smoothly. */
  settleY(pos, dt) {
    const g = this.groundAt(pos.x, pos.z, 0.2);
    const y = pos.y || 0;
    if (g > y) pos.y = g;
    else pos.y = Math.max(g, y - Math.max(0.02, 6 * dt));
  },

  /**
   * After the pose is set: no part of the body (hands, feet, head, shoulders...) may be inside
   * anything. Whatever pokes in slides the whole person out, by exactly as much as it poked in.
   */
  limbPush(ch, pos, lite) {
    this.ensureSolids();
    // nothing solid near: nothing to do
    let near = false;
    for (const [dx, dz] of [[0, 0], [0.7, 0.7], [0.7, -0.7], [-0.7, 0.7], [-0.7, -0.7]]) {
      for (const s of this.solidsNear(pos.x + dx, pos.z + dz)) if (!(s.step && s.top <= pos.y + 0.01) && pos.x > s.x1 - 1.3 && pos.x < s.x2 + 1.3 && pos.z > s.z1 - 1.3 && pos.z < s.z2 + 1.3) { near = true; break; }
      if (near) break;
    }
    if (!near && this.activeColliders.length) for (const s of this.activeColliders) if (pos.x > s.x1 - 1.3 && pos.x < s.x2 + 1.3 && pos.z > s.z1 - 1.3 && pos.z < s.z2 + 1.3) { near = true; break; }
    if (!near) return;
    ch.root.updateMatrixWorld(true);
    const ext = bodyExtremes(ch, lite);
    let ox = 0, oz = 0;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const e of ext) {
        const m = ch.bones[e.bone].matrixWorld;
        const pts = e.pts;
        for (let i = 0; i < pts.length; i += 3) {
          _lm.set(pts[i], pts[i + 1], pts[i + 2]).applyMatrix4(m);
          const x = _lm.x + ox;
          const z = _lm.z + oz;
          const y = _lm.y;
          const list = this.solidsNear(x, z);
          for (let k = 0; k < list.length + this.activeColliders.length; k++) {
            const s = k < list.length ? list[k] : this.activeColliders[k - list.length];
            if (s.step && s.top <= pos.y + 0.01) continue;
            const p = pointPush(s, x + 0, y, z);
            if (p && Math.hypot(p[0], p[1]) < 0.6) { ox += p[0]; oz += p[1]; moved = true; break; }
          }
        }
      }
      if (!moved) break;
    }
    if (ox || oz) { pos.x += ox; pos.z += oz; }
  },

  /** Where feet go on a machine: its own height, or the top of the mat or platform under it. */
  stationY(s) {
    if (s.y != null) return s.y;
    if (s.gy == null || s.gyFor !== this.solids) {
      this.ensureSolids();
      // a mat or platform under it, not a bar of the machine itself
      s.gy = this.groundAt(s.x, s.z, 0, 0.6);
      s.gyFor = this.solids;
    }
    return s.gy;
  },

  /** Is this spot clear for a person to stand? */
  spotFree(x, z, m = 0.4) {
    this.ensureSolids();
    for (const s of [...this.solidsNear(x, z), ...this.activeColliders]) {
      if (s.step) continue;
      if (pushOut(s, x, z, m)) return false;
    }
    return true;
  },
});
