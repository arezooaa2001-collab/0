// ساخت شهر آزاد: خیابان‌ها، پیاده‌روها، خانه‌ها (با فضای داخلی)، برج‌ها، میدان، وسایل خیابانی، برخورد و تعامل
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32, makeNoise2D, clamp, lerp, mergeGeos, optimizeStatic, fillAttr, vertexPBRMaterial, TAU } from './utils.js';
import * as T from './textures.js';
import { F, mat } from './furniture.js';
import { buildPark } from './park.js';
import { buildHuman } from './human.js';

export const CITY = { N: 6, BLOCK: 100, ROAD: 16, WALK: 4 };
const STEP = CITY.BLOCK + CITY.ROAD;
const SPAN = CITY.N * STEP + CITY.ROAD;
const ORIGIN = -SPAN / 2;
export const roadCenter = (i) => ORIGIN + CITY.ROAD / 2 + i * STEP;
export const blockRect = (bx, bz) => ({ x0: roadCenter(bx) + CITY.ROAD / 2, x1: roadCenter(bx + 1) - CITY.ROAD / 2, z0: roadCenter(bz) + CITY.ROAD / 2, z1: roadCenter(bz + 1) - CITY.ROAD / 2 });

// ---------------- برخورد ----------------
export class Colliders {
  constructor(cell = 12) { this.cell = cell; this.grid = new Map(); }
  _cells(minX, minZ, maxX, maxZ, fn) { const c = this.cell; for (let x = Math.floor(minX / c); x <= Math.floor(maxX / c); x++) for (let z = Math.floor(minZ / c); z <= Math.floor(maxZ / c); z++) fn(x + ',' + z); }
  _ins(o, minX, minZ, maxX, maxZ) { o.cells = []; this._cells(minX, minZ, maxX, maxZ, (k) => { if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(o); o.cells.push(k); }); return o; }
  box(minX, minZ, maxX, maxZ, mask = 3, maxY = 99) { return this._ins({ t: 0, minX, minZ, maxX, maxZ, mask, maxY }, minX, minZ, maxX, maxZ); }
  circle(x, z, r, mask = 3, maxY = 99) { return this._ins({ t: 1, x, z, r, mask, maxY }, x - r, z - r, x + r, z + r); }
  // جعبه چرخیده (برای وسایل داخل خانه)
  obox(cx, cz, hw, hd, yaw, mask = 3) {
    const c = Math.cos(yaw), s = Math.sin(yaw); const ex = Math.abs(c) * hw + Math.abs(s) * hd, ez = Math.abs(s) * hw + Math.abs(c) * hd;
    return this.box(cx - ex, cz - ez, cx + ex, cz + ez, mask);
  }
  remove(o) { if (!o || !o.cells) return; for (const k of o.cells) { const l = this.grid.get(k); if (l) { const i = l.indexOf(o); if (i >= 0) l.splice(i, 1); } } o.cells = null; }
  // راندن یک دایره (بازیکن یا ماشین) به بیرون از موانع؛ برمی‌گرداند نرمال برخورد
  resolve(p, r, mask = 1, y = 0, out = null) {
    const c = this.cell; let hit = null;
    for (let gx = Math.floor((p.x - r) / c); gx <= Math.floor((p.x + r) / c); gx++) for (let gz = Math.floor((p.z - r) / c); gz <= Math.floor((p.z + r) / c); gz++) {
      const l = this.grid.get(gx + ',' + gz); if (!l) continue;
      for (const o of l) {
        if (!(o.mask & mask) || y > o.maxY) continue;
        let nx, nz, d;
        if (o.t === 0) {
          const qx = clamp(p.x, o.minX, o.maxX), qz = clamp(p.z, o.minZ, o.maxZ);
          nx = p.x - qx; nz = p.z - qz; d = Math.hypot(nx, nz);
          if (d === 0) { // داخل جعبه: کمترین مسیر خروج
            const dl = p.x - o.minX, dr = o.maxX - p.x, db = p.z - o.minZ, df = o.maxZ - p.z; const m = Math.min(dl, dr, db, df);
            if (m === dl) { nx = -1; nz = 0; d = -dl; } else if (m === dr) { nx = 1; nz = 0; d = -dr; } else if (m === db) { nx = 0; nz = -1; d = -db; } else { nx = 0; nz = 1; d = -df; }
            p.x += nx * (r - d); p.z += nz * (r - d); hit = hit || { nx, nz }; continue;
          }
        } else { nx = p.x - o.x; nz = p.z - o.z; d = Math.hypot(nx, nz) - o.r; const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L; if (d < r) { p.x += nx * (r - d); p.z += nz * (r - d); hit = hit || { nx, nz }; } continue; }
        if (d < r) { nx /= d; nz /= d; p.x += nx * (r - d); p.z += nz * (r - d); hit = hit || { nx, nz }; }
      }
    }
    return hit;
  }
  inside(x, z, mask = 1) { const l = this.grid.get(Math.floor(x / this.cell) + ',' + Math.floor(z / this.cell)); if (!l) return false; for (const o of l) { if (!(o.mask & mask)) continue; if (o.t === 0 ? (x > o.minX && x < o.maxX && z > o.minZ && z < o.maxZ) : Math.hypot(x - o.x, z - o.z) < o.r) return true; } return false; }
}

// ---------------- تعامل ----------------
export class Interactions {
  constructor(cell = 10) { this.cell = cell; this.grid = new Map(); this.all = new Set(); }
  add(o) { o.r = o.r || 1.6; const k = Math.floor(o.pos.x / this.cell) + ',' + Math.floor(o.pos.z / this.cell); if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(o); o.key = k; this.all.add(o); return o; }
  remove(o) { if (!o || !o.key) return; const l = this.grid.get(o.key); if (l) { const i = l.indexOf(o); if (i >= 0) l.splice(i, 1); } this.all.delete(o); o.key = null; }
  move(o, pos) { this.remove(o); o.pos.copy(pos); this.add(o); }
  nearest(p, dir, game) {
    let best = null, bs = 1e9; const c = this.cell;
    for (let gx = Math.floor(p.x / c) - 1; gx <= Math.floor(p.x / c) + 1; gx++) for (let gz = Math.floor(p.z / c) - 1; gz <= Math.floor(p.z / c) + 1; gz++) {
      const l = this.grid.get(gx + ',' + gz); if (!l) continue;
      for (const o of l) {
        if (o.cond && !o.cond(game)) continue;
        const dx = o.pos.x - p.x, dz = o.pos.z - p.z, dy = Math.abs(o.pos.y - p.y - 0.9);
        const d = Math.hypot(dx, dz); if (d > o.r || dy > (o.ry || 2.2)) continue;
        const facing = d > 0.01 ? (dx * dir.x + dz * dir.z) / d : 1;
        const sc = d - facing * 0.6 - (o.pri || 0);
        if (sc < bs) { bs = sc; best = o; }
      }
    }
    return best;
  }
}

// ---------------- دسته‌های Instanced برای وسایل خیابانی ----------------
function vc(geo, hex, metal = 0, rough = 0.6) { const c = new THREE.Color(hex); const g = geo.index ? geo : geo; fillAttr(g, 'color', [c.r, c.g, c.b]); fillAttr(g, 'aMR', [metal, rough]); return g; }
const at = (g, x, y, z) => { g.translate(x, y, z); return g; };
class Batch {
  constructor(world, geo, material, { cast = true, color = false } = {}) { this.world = world; this.geo = geo; this.mat = material; this.items = []; this.cast = cast; this.color = color; }
  add(pos, yaw = 0, scale = 1, color = null) { const m = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(scale, scale, scale)); this.items.push({ m, color }); return this.items.length - 1; }
  build(parent) {
    if (!this.items.length) return null;
    const im = new THREE.InstancedMesh(this.geo, this.mat, this.items.length);
    this.items.forEach((it, i) => { im.setMatrixAt(i, it.m); if (this.color) im.setColorAt(i, new THREE.Color(it.color ?? 0xffffff)); });
    im.castShadow = this.cast; im.receiveShadow = true; im.computeBoundingSphere();
    parent.add(im); this.mesh = im; return im;
  }
  setMatrix(i, m) { this.items[i].m.copy(m); if (this.mesh) { this.mesh.setMatrixAt(i, m); this.mesh.instanceMatrix.needsUpdate = true; } }
  setColor(i, hex) { if (this.mesh) { this.mesh.setColorAt(i, new THREE.Color(hex)); this.mesh.instanceColor.needsUpdate = true; } }
}

// دیوار با سوراخ واقعی برای در و پنجره
function wallGeo(w, h, holes, thick = 0.2) {
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, h); sh.lineTo(-w / 2, h); sh.lineTo(-w / 2, 0);
  for (const o of holes) { const p = new THREE.Path(); p.moveTo(o.x0, o.y0); p.lineTo(o.x0, o.y1); p.lineTo(o.x1, o.y1); p.lineTo(o.x1, o.y0); p.lineTo(o.x0, o.y0); sh.holes.push(p); }
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false }); g.translate(0, 0, -thick / 2);
  return g;
}

export class CityWorld {
  constructor(opts = {}) {
    this.q = opts.quality || 'high';
    this.rng = mulberry32(opts.seed || 1234);
    this.group = new THREE.Group();
    this.colliders = new Colliders();
    this.inter = new Interactions();
    this.houses = []; this.updaters = []; this.rides = [];
    this.lamps = []; this.windowMats = [];
    this.trashSpots = []; this.bins = [];
    this.parkedSpots = [];
    this.ramps = [];
    this.rnd = (a, b) => a + (b - a) * this.rng();
  }

  build() {
    const N = CITY.N;
    this.types = {};
    for (let bx = 0; bx < N; bx++) for (let bz = 0; bz < N; bz++) this.types[bx + ',' + bz] = 'res';
    for (const k of ['3,3', '3,4', '4,3', '4,4']) this.types[k] = 'park';
    this.types['1,1'] = 'plaza'; this.types['5,0'] = 'stunt';
    for (const k of ['2,2', '2,3', '1,3', '3,2', '2,1', '4,2', '3,1', '1,4']) this.types[k] = 'com';
    this.buildGround();
    this.buildRoads();
    this.props = this.makePropBatches();
    for (let bx = 0; bx < N; bx++) for (let bz = 0; bz < N; bz++) {
      const t = this.types[bx + ',' + bz]; const r = blockRect(bx, bz);
      if (t !== 'park' && t !== 'stunt') this.buildSidewalkBlock(r, t);
      if (t === 'res') this.buildResidential(r, bx, bz);
      else if (t === 'com') this.buildCommercial(r, bx, bz);
      else if (t === 'plaza') this.buildPlaza(r);
      else if (t === 'stunt') this.buildStunt(r);
    }
    const p0 = blockRect(3, 3), p1 = blockRect(4, 4);
    this.parkRect = { x0: p0.x0, z0: p0.z0, x1: p1.x1, z1: p1.z1 };
    this.park = buildPark(this, this.parkRect);
    this.buildStreetProps();
    this.buildTrees();
    this.buildLaneGraph();
    this.buildWalkerLoops();
    for (const b of Object.values(this.props)) b.build(this.group);
    optimizeStatic(this.group, { cell: 150, mapCell: 0, skip: (o) => o.userData.keep });
    this.buildMinimap();
    this.spawn = { pos: new THREE.Vector3(blockRect(1, 1).x1 - 2.2, 0, (blockRect(1, 1).z0 + blockRect(1, 1).z1) / 2), yaw: Math.PI / 2 };
    this.vehicleSpawn = { pos: new THREE.Vector3(roadCenter(2) - 6.2, 0, this.spawn.pos.z + 5), yaw: 0 };
    return this.group;
  }

  // ارتفاع زمین (پیاده‌رو، کف خانه، رمپ‌ها)
  groundAt(x, z) {
    for (const r of this.ramps) {
      const lx = (x - r.x) * r.c + (z - r.z) * r.s, lz = -(x - r.x) * r.s + (z - r.z) * r.c;
      if (Math.abs(lx) < r.w / 2 && lz > -r.l / 2 && lz < r.l / 2) return r.h * (lz + r.l / 2) / r.l;
    }
    const fx = (x - ORIGIN) / STEP, fz = (z - ORIGIN) / STEP;
    const bx = Math.floor(fx), bz = Math.floor(fz);
    const ox = x - (ORIGIN + bx * STEP), oz = z - (ORIGIN + bz * STEP);
    if (bx < 0 || bz < 0 || bx >= CITY.N || bz >= CITY.N || ox < CITY.ROAD || oz < CITY.ROAD) return 0;
    const t = this.types[bx + ',' + bz]; if (t === 'stunt') return 0;
    const list = this.houseRects;
    if (list) for (const h of list) if (x > h.minX && x < h.maxX && z > h.minZ && z < h.maxZ) return h.y(x, z);
    return 0.15;
  }

  buildGround() {
    const g = T.grass();
    const gm = new THREE.MeshStandardMaterial({ map: g.map.clone(), normalMap: g.normal.clone(), roughness: 0.95, color: 0xcfe3bd });
    gm.map.needsUpdate = true; gm.normalMap.needsUpdate = true;
    // زمین بیرون شهر با سوراخ به اندازه شهر (هیچ هم‌پوشانی با خیابان‌ها ندارد)
    const outer = new THREE.Shape(); outer.moveTo(-2000, -2000); outer.lineTo(2000, -2000); outer.lineTo(2000, 2000); outer.lineTo(-2000, 2000); outer.lineTo(-2000, -2000);
    const hs = SPAN / 2 - 0.05; const hole = new THREE.Path(); hole.moveTo(-hs, -hs); hole.lineTo(-hs, hs); hole.lineTo(hs, hs); hole.lineTo(hs, -hs); hole.lineTo(-hs, -hs); outer.holes.push(hole);
    const gg = new THREE.ShapeGeometry(outer); gg.rotateX(-Math.PI / 2); { const uv = gg.attributes.uv, p = gg.attributes.position; for (let k = 0; k < uv.count; k++) uv.setXY(k, p.getX(k) / 10, p.getZ(k) / 10); }
    const ground = new THREE.Mesh(gg, gm); ground.position.y = -0.01; ground.receiveShadow = true; ground.userData.keep = true; this.group.add(ground);
    this.grassMat = new THREE.MeshStandardMaterial({ map: T.grass().map.clone(), roughness: 0.95, color: 0xd5e8c6 }); this.grassMat.map.needsUpdate = true;
    // کوه‌های دوردست
    const nz = makeNoise2D(9); const pos = [], col = [], idx = []; const R = 1500, segs = 160, rows = 6;
    for (let r = 0; r <= rows; r++) for (let k = 0; k <= segs; k++) { const a = k / segs * TAU, t = r / rows; const H = (80 + (nz.fbm(Math.cos(a) * 3, Math.sin(a) * 3, 4) * 0.5 + 0.5) * 300) * Math.sin(t * Math.PI / 2); const rr = R + t * 500; pos.push(Math.cos(a) * rr, r ? H : -40, Math.sin(a) * rr); const c = new THREE.Color(0x4b6b48).lerp(new THREE.Color(0xe8ecf0), clamp((H - 180) / 150, 0, 1)); col.push(c.r, c.g, c.b); }
    for (let r = 0; r < rows; r++) for (let k = 0; k < segs; k++) { const a = r * (segs + 1) + k, b = a + segs + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); mg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); mg.setIndex(idx); mg.computeVertexNormals();
    const mm = new THREE.Mesh(mg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide })); mm.userData.keep = true; this.group.add(mm);
  }

  buildRoads() {
    const N = CITY.N, R = CITY.ROAD;
    const roadMat = new THREE.MeshStandardMaterial({ map: T.cityRoad(), roughness: 0.92 });
    const interMat = new THREE.MeshStandardMaterial({ map: T.asphalt().map, roughness: 0.92 });
    const segs = [], inters = [], cross = [];
    const inPark = (i, j) => i === 4 && j === 4;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      if (inPark(i, j)) continue;
      const x = roadCenter(i), z = roadCenter(j);
      const sq = new THREE.PlaneGeometry(R, R); sq.rotateX(-Math.PI / 2); sq.translate(x, 0.02, z);
      const uv = sq.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 4, uv.getY(k) * 4); inters.push(sq);
      // خط عابر پیاده
      for (const [dx, dz, rot] of [[0, -R / 2 - 1.6, 0], [0, R / 2 + 1.6, 0], [-R / 2 - 1.6, 0, Math.PI / 2], [R / 2 + 1.6, 0, Math.PI / 2]]) { const c = new THREE.PlaneGeometry(R - 1, 3); c.rotateX(-Math.PI / 2); c.rotateY(rot); c.translate(x + dx, 0.04, z + dz); cross.push(c); }
      // راه‌های افقی و عمودی
      if (i < N && !(j === 4 && (i === 3 || i === 4))) { const L = STEP - R; const g = new THREE.PlaneGeometry(R, L); g.rotateX(-Math.PI / 2); g.rotateY(Math.PI / 2); g.translate(x + R / 2 + L / 2, 0.02, z); const u = g.attributes.uv; for (let k = 0; k < u.count; k++) u.setXY(k, u.getX(k), u.getY(k) * L / 16); segs.push(g); }
      if (j < N && !(i === 4 && (j === 3 || j === 4))) { const L = STEP - R; const g = new THREE.PlaneGeometry(R, L); g.rotateX(-Math.PI / 2); g.translate(x, 0.02, z + R / 2 + L / 2); const u = g.attributes.uv; for (let k = 0; k < u.count; k++) u.setXY(k, u.getX(k), u.getY(k) * L / 16); segs.push(g); }
    }
    const rm = new THREE.Mesh(mergeGeos(segs), roadMat); rm.receiveShadow = true; this.group.add(rm);
    const im = new THREE.Mesh(mergeGeos(inters), interMat); im.receiveShadow = true; this.group.add(im);
    const cm = new THREE.Mesh(mergeGeos(cross), new THREE.MeshStandardMaterial({ map: T.crosswalk(), transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 })); cm.userData.keep = true; this.group.add(cm);
    // محدوده شهر برای ماشین
    const lim = SPAN / 2 + 60;
    this.colliders.box(-lim - 5, -lim - 5, lim + 5, -lim, 3); this.colliders.box(-lim - 5, lim, lim + 5, lim + 5, 3);
    this.colliders.box(-lim - 5, -lim, -lim, lim, 3); this.colliders.box(lim, -lim, lim + 5, lim, 3);
  }

  buildSidewalkBlock(r, type) {
    const W = CITY.WALK; const h = 0.15;
    const walkMat = this._walkMat || (this._walkMat = (() => { const m = new THREE.MeshStandardMaterial({ map: T.sidewalk().clone(), roughness: 0.9 }); m.map.repeat.set(0.25, 0.25); m.map.needsUpdate = true; return m; })());
    const curbMat = this._curbMat || (this._curbMat = new THREE.MeshStandardMaterial({ color: 0xbab6ad, roughness: 0.8 }));
    const geos = [];
    const add = (x0, z0, x1, z1) => { const g = new THREE.BoxGeometry(x1 - x0, h, z1 - z0); g.translate((x0 + x1) / 2, h / 2, (z0 + z1) / 2); const uv = g.attributes.uv, p = g.attributes.position; for (let k = 0; k < uv.count; k++) uv.setXY(k, p.getX(k) + (x0 + x1) / 2, p.getZ(k) + (z0 + z1) / 2); geos.push(g); };
    add(r.x0, r.z0, r.x1, r.z0 + W); add(r.x0, r.z1 - W, r.x1, r.z1); add(r.x0, r.z0 + W, r.x0 + W, r.z1 - W); add(r.x1 - W, r.z0 + W, r.x1, r.z1 - W);
    const m = new THREE.Mesh(mergeGeos(geos), walkMat); m.receiveShadow = true; this.group.add(m);
    // لبه جدول
    const cg = []; for (const [x0, z0, x1, z1] of [[r.x0, r.z0, r.x1, r.z0 + 0.25], [r.x0, r.z1 - 0.25, r.x1, r.z1], [r.x0, r.z0, r.x0 + 0.25, r.z1], [r.x1 - 0.25, r.z0, r.x1, r.z1]]) { const g = new THREE.BoxGeometry(x1 - x0, 0.17, z1 - z0); g.translate((x0 + x1) / 2, 0.085, (z0 + z1) / 2); cg.push(g); }
    this.group.add(new THREE.Mesh(mergeGeos(cg), curbMat));
    // چمن داخل بلوک
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0 - 2 * W, r.z1 - r.z0 - 2 * W), type === 'com' || type === 'plaza' ? walkMat : this.grassMat);
    lawn.rotation.x = -Math.PI / 2; lawn.position.set((r.x0 + r.x1) / 2, h - 0.005, (r.z0 + r.z1) / 2); lawn.receiveShadow = true;
    if (type !== 'com' && type !== 'plaza') { const uv = lawn.geometry.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 20, uv.getY(k) * 20); }
    else { const uv = lawn.geometry.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (r.x1 - r.x0) / 4, uv.getY(k) * (r.z1 - r.z0) / 4); }
    this.group.add(lawn);
  }

  // ---------------- خانه‌ها ----------------
  buildResidential(r, bx, bz) {
    const cz0 = r.z0 + 16, cz1 = r.z1 - 16;
    const lots = [[r.x0 + 27, cz0, Math.PI], [r.x0 + 73, cz0, Math.PI], [r.x0 + 27, cz1, 0], [r.x0 + 73, cz1, 0]];
    for (const [x, z, rot] of lots) this.buildHouse(x, z, rot);
    // حیاط پشتی: استخر و درخت
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    if (this.rng() < 0.6) this.buildPool(cx + this.rnd(-20, 20), cz);
  }

  buildPool(x, z) {
    const w = 8, d = 4.5;
    const border = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.25, d + 1), mat(0xeae6dc, 0.7)); border.position.set(x, 0.15, z); this.group.add(border);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0x2aa7d9, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85 }));
    water.rotation.x = -Math.PI / 2; water.position.set(x, 0.3, z); water.userData.keep = true; this.group.add(water);
    this.updaters.push((dt, t) => { water.material.color.setHSL(0.55, 0.7, 0.45 + Math.sin(t * 1.5) * 0.02); });
    this.colliders.box(x - w / 2 - 0.5, z - d / 2 - 0.5, x + w / 2 + 0.5, z + d / 2 + 0.5, 2);
    this.inter.add({ pos: new THREE.Vector3(x, 0.4, z + d / 2 + 0.3), r: 2.5, label: 'پریدن در استخر 🏊', act: (g) => g.act('jump', 1.2, { text: 'شالاپ! آب استخر خیلی خنک بود 💦', splash: new THREE.Vector3(x, 0.3, z) }) });
  }

  buildHouse(cx, cz, rot) {
    const rng = this.rng;
    const walls = [0xf2e8d5, 0xe9f1f7, 0xf6dfe0, 0xeee4c9, 0xdfeee2, 0xf5f0e6][Math.floor(rng() * 6)];
    const roofC = ['#b8452a', '#6e5a48', '#6f8094', '#93393a'][Math.floor(rng() * 4)];
    const brickHouse = rng() < 0.3;
    const g = new THREE.Group(); g.position.set(cx, 0.15, cz); g.rotation.y = rot; this.group.add(g);
    g.updateMatrixWorld(true);
    const wallMat = brickHouse ? this._brickMat || (this._brickMat = (() => { const m = new THREE.MeshStandardMaterial({ map: T.brick('#a4492f').clone(), roughness: 0.85 }); m.map.repeat.set(0.8, 0.8); m.map.needsUpdate = true; return m; })())
      : this._plasterMat || (this._plasterMat = (() => { const m = new THREE.MeshStandardMaterial({ map: T.plaster().clone(), vertexColors: true, roughness: 0.9 }); m.map.repeat.set(0.4, 0.4); m.map.needsUpdate = true; return m; })());
    const H = 3, base = 0.3, hw = 6, hd = 5, th = 0.2;
    // رنگ دیوار و سقف در رأس‌ها: همه خانه‌ها با یک متریال (draw call کمتر)
    const wallC = new THREE.Color(walls), roofCol = new THREE.Color(roofC);
    const add = (geo, m, x = 0, y = 0, z = 0, ry = 0) => {
      if (m.vertexColors) { const c = m === this._roofMat ? roofCol : wallC; fillAttr(geo, 'color', [c.r, c.g, c.b]); }
      const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.rotation.y = ry; me.castShadow = true; me.receiveShadow = true; g.add(me); return me;
    };
    add(new THREE.BoxGeometry(hw * 2 + 0.4, base, hd * 2 + 0.4), mat(0x9a948a, 0.9), 0, base / 2, 0);
    // دیوارها با سوراخ در و پنجره
    const win = (x0, x1) => ({ x0, x1, y0: 0.9, y1: 2.2 });
    const front = [{ x0: -3.05, x1: -1.95, y0: 0, y1: 2.2 }, win(0.8, 2.2), win(3.4, 4.8)];
    const back = [win(-4.6, -3.2), win(-1.2, 0.2), win(2.4, 3.6), win(4.2, 5.2)];
    const side = [win(-3.6, -2.2), win(1.6, 3.0)];
    add(wallGeo(hw * 2, H, front, th), wallMat, 0, base, hd - th / 2);
    add(wallGeo(hw * 2, H, back.map((o) => ({ ...o, x0: -o.x1, x1: -o.x0 })), th), wallMat, 0, base, -hd + th / 2, Math.PI);
    add(wallGeo(hd * 2 - th * 2, H, side, th), wallMat, -hw + th / 2, base, 0, -Math.PI / 2);
    add(wallGeo(hd * 2 - th * 2, H, side, th), wallMat, hw - th / 2, base, 0, Math.PI / 2);
    // پنجره‌ها: قاب، شیشه، لبه
    const frameM = mat(0xfafafa, 0.5); const glassM = this._glass || (this._glass = new THREE.MeshStandardMaterial({ color: 0x9fc7e0, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.32, depthWrite: false }));
    const winGeo = (o, z, ry, x0off = 0) => {
      const w = o.x1 - o.x0, h = o.y1 - o.y0, cxw = (o.x0 + o.x1) / 2;
      const grp = new THREE.Group(); grp.position.set(0, 0, 0); grp.rotation.y = ry; g.add(grp);
      const fr = (ww, hh, xx, yy) => { const m = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, 0.26), frameM); m.position.set(xx, yy, z); grp.add(m); };
      fr(w + 0.12, 0.08, cxw, base + o.y1); fr(w + 0.12, 0.08, cxw, base + o.y0); fr(0.08, h, o.x0, base + (o.y0 + o.y1) / 2); fr(0.08, h, o.x1, base + (o.y0 + o.y1) / 2); fr(0.05, h, cxw, base + (o.y0 + o.y1) / 2);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.06, 0.4), frameM); sill.position.set(cxw, base + o.y0 - 0.04, z + 0.08); grp.add(sill);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassM); gl.position.set(cxw, base + (o.y0 + o.y1) / 2, z); grp.add(gl);
    };
    for (const o of front.slice(1)) winGeo(o, hd - th / 2, 0);
    for (const o of back) winGeo(o, hd - th / 2, Math.PI);
    for (const o of side) { winGeo(o, hw - th / 2, Math.PI / 2); winGeo(o, hw - th / 2, -Math.PI / 2); }
    // سقف شیروانی
    const roofMat = this._roofMat || (this._roofMat = (() => { const m = new THREE.MeshStandardMaterial({ map: T.roofTiles('#d9d9d9').clone(), vertexColors: true, roughness: 0.75 }); m.map.repeat.set(3, 2); m.map.needsUpdate = true; return m; })());
    const ridge = base + H + 2.2, eave = base + H - 0.1, run = hd + 0.6; const ang = Math.atan2(ridge - eave, run); const slab = Math.hypot(run, ridge - eave);
    for (const sz of [1, -1]) { const s = add(new THREE.BoxGeometry(hw * 2 + 0.8, 0.14, slab), roofMat, 0, (ridge + eave) / 2 + 0.05, sz * run / 2); s.rotation.x = sz * ang; }
    const tri = new THREE.Shape(); tri.moveTo(-hd, 0); tri.lineTo(hd, 0); tri.lineTo(0, ridge - base - H); tri.lineTo(-hd, 0);
    for (const sx of [1, -1]) { const tg = new THREE.ExtrudeGeometry(tri, { depth: th, bevelEnabled: false }); tg.translate(0, 0, -th / 2); add(tg, wallMat, sx * (hw - th / 2), base + H, 0, Math.PI / 2); }
    add(new THREE.BoxGeometry(hw * 2, 0.05, hd * 2), mat(0xf7f5f0, 0.9), 0, base + H, 0).castShadow = false;
    add(new THREE.BoxGeometry(0.8, 2, 0.8), brickHouse ? wallMat : mat(0x8d5a44, 0.8), 3.2, ridge - 0.4, -1.5);
    // ورودی: پله، سایبان، مسیر
    add(new THREE.BoxGeometry(2.2, 0.15, 1.0), mat(0xb5b0a6, 0.85), -2.5, 0.075, hd + 0.5);
    add(new THREE.BoxGeometry(2.4, 0.08, 1.4), roofMat, -2.5, base + 2.55, hd + 0.55).rotation.x = 0.12;
    for (const sx of [-3.55, -1.45]) add(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8), frameM, sx, base + 1.25, hd + 1.15);
    for (let k = 0; k < 6; k++) { const sl = add(new THREE.BoxGeometry(1.2, 0.05, 0.8), mat(0xc9c2b4, 0.9), -2.5, 0.02, hd + 1.6 + k * 1.05); sl.castShadow = false; }
    // نرده چوبی جلوی حیاط
    const fz = hd + 7.6; const fenceM = mat(0xf4f1ea, 0.7); const fg = [];
    for (let x = -hw - 1.5; x <= hw + 1.5; x += 0.22) { if (Math.abs(x + 2.5) < 0.8) continue; const p = new THREE.BoxGeometry(0.08, 0.9, 0.04); p.translate(x, 0.45, fz); fg.push(p); }
    for (const y of [0.3, 0.7]) for (const [x0, x1] of [[-hw - 1.5, -3.3], [-1.7, hw + 1.5]]) { const rl = new THREE.BoxGeometry(x1 - x0, 0.06, 0.03); rl.translate((x0 + x1) / 2, y, fz - 0.03); fg.push(rl); }
    add(mergeGeos(fg), fenceM);
    // بوته‌ها
    for (const x of [-5, -0.5, 1.5, 4.8]) { const b = add(new THREE.IcosahedronGeometry(0.6, 1), mat(0x2e7d32, 0.9), x, 0.4, hd + 0.7); b.scale.set(1, 0.8, 0.8); }
    // در خانه (Instanced)
    const hinge = new THREE.Vector3(-3.05, base, hd - 0.05).applyMatrix4(g.matrixWorld);
    const doorIdx = this.props.door.add(hinge, rot, 1, [0x7a2e1a, 0x1d3557, 0x2d6a4f, 0x6d597a, 0x8a5a33][Math.floor(rng() * 5)]);
    const W = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(g.matrixWorld);
    const house = { g, cx, cz, rot, doorIdx, hinge, doorA: 0, doorOpen: false, interior: null, wallMat, id: this.houses.length, center: W(0, 0, 0), front: W(-2.5, 0.45, hd + 1.4), safe: W(-2.5, 0.15, hd + 9) };
    house.toWorld = W;
    { const a = W(-3.05, 0, hd - 0.12), b = W(-1.95, 0, hd + 0.02); house.doorBox = [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)]; }
    this.houses.push(house);
    this.inter.add({ pos: W(2.5, 0.8, fz - 0.4), r: 1.6, label: 'تکیه دادن به نرده و تماشای خیابان', act: (gm) => gm.act('idle', 2.5, { text: 'چه محله آرام و قشنگی! 🏡' }) });
    this.inter.add({ pos: W(1.5, 1.2, hd + 0.5), r: 1.4, label: 'نگاه کردن از پنجره به داخل خانه', act: (gm) => gm.act('reach', 1.4, { text: ['داخل خانه خیلی مرتب است 🛋️', 'یک گربه پشت پنجره خوابیده 🐈', 'چراغ‌های خانه روشن است 💡'][Math.floor(Math.random() * 3)] }) });
    this.inter.add({ pos: W(4.8, 0.8, hd + 1.0), r: 1.3, label: 'آب دادن به بوته‌های حیاط', act: (gm) => gm.act('water', 2.2, { text: 'بوته‌ها آب خوردند 🌿' }) });
    // برخورد: دیوارها برای بازیکن (با فاصله در)، کل خانه برای ماشین
    const c = this.colliders; const wb = (x0, z0, x1, z1) => { const a = W(x0, 0, z0), b = W(x1, 0, z1); c.box(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z), 1); };
    wb(-hw, hd - th, -3.05, hd); wb(-1.95, hd - th, hw, hd); wb(-hw, -hd, hw, -hd + th); wb(-hw, -hd, -hw + th, hd); wb(hw - th, -hd, hw, hd);
    { const a = W(-hw - 0.2, 0, -hd - 0.2), b = W(hw + 0.2, 0, hd + 0.2); c.box(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z), 2); }
    { const a = W(-hw - 1.5, 0, fz - 0.1), b = W(-3.3, 0, fz + 0.1); c.box(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z), 3); const a2 = W(-1.7, 0, fz - 0.1), b2 = W(hw + 1.5, 0, fz + 0.1); c.box(Math.min(a2.x, b2.x), Math.min(a2.z, b2.z), Math.max(a2.x, b2.x), Math.max(a2.z, b2.z), 3); }
    // کف خانه و پله‌ها برای ارتفاع زمین
    const a = W(-hw - 0.2, 0, -hd - 0.2), b = W(hw + 0.2, 0, hd + 1.0);
    (this.houseRects = this.houseRects || []).push({ minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z), y: (x, z) => { const lz = (x - cx) * Math.sin(rot) + (z - cz) * Math.cos(rot); return lz > hd + 0.2 ? 0.3 : 0.45; } });
    // تعامل: در، زنگ، صندوق پست
    this.inter.add({ pos: W(-2.5, 1.4, hd + 0.3), r: 1.8, pri: 0.5, label: () => (house.doorOpen ? 'بستن در' : 'باز کردن در و ورود'), act: (gm) => { house.doorOpen = !house.doorOpen; house.manual = true; gm.act('press', 0.5, {}); gm.sfx?.('door'); } });
    this.inter.add({ pos: W(-1.6, 1.4, hd + 0.3), r: 1.4, label: 'زدن زنگ در', act: (gm) => { gm.act('press', 0.5, { text: ['دینگ دانگ! 🔔 «کیه؟»', 'دینگ دانگ! صاحب‌خانه گفت: «بفرمایید داخل!»'][Math.floor(Math.random() * 2)] }); gm.sfx?.('bell'); } });
    const mb = W(-4, 0, fz - 0.6);
    this.props.mailbox.add(mb.clone().setY(0.15), rot, 1);
    this.inter.add({ pos: mb.clone().setY(1), r: 1.5, label: 'نگاه کردن به صندوق پست', act: (gm) => gm.act('reach', 1.2, { text: ['یک نامه از مادربزرگ رسیده 💌', 'قبض آب آمده 🧾', 'یک کارت دعوت به جشن 🎉', 'صندوق خالی بود'][Math.floor(Math.random() * 4)] }) });
    this.colliders.circle(mb.x, mb.z, 0.25, 3);
    this.trashSpots.push({ pos: W(0, 0.15, hd + 4), house });
  }

  // ساخت فضای داخلی وقتی بازیکن نزدیک است
  buildInterior(house) {
    if (house.interior) return house.interior;
    const g = new THREE.Group(); g.position.copy(house.g.position); g.rotation.y = house.rot; this.group.add(g); g.updateMatrixWorld(true);
    const base = 0.3, H = 3;
    const it = { g, colliders: [], inter: [], updates: [], pieces: [] };
    const add = (geo, m, x = 0, y = 0, z = 0, ry = 0) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.rotation.y = ry; me.receiveShadow = true; g.add(me); return me; };
    // کف اتاق‌ها
    const wood = this._woodMat || (this._woodMat = (() => { const m = new THREE.MeshStandardMaterial({ map: T.woodFloor().clone(), roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); m.map.repeat.set(0.35, 0.35); m.map.needsUpdate = true; return m; })());
    const tile = this._tileMat || (this._tileMat = (() => { const m = new THREE.MeshStandardMaterial({ map: T.tiles('#e8e4dc').clone(), roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); m.map.repeat.set(0.6, 0.6); m.map.needsUpdate = true; return m; })());
    const floor = (x0, z0, x1, z1, m) => { const p = new THREE.PlaneGeometry(x1 - x0, z1 - z0); p.rotateX(-Math.PI / 2); const uv = p.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (x1 - x0), uv.getY(k) * (z1 - z0)); add(p, m, (x0 + x1) / 2, base + 0.02, (z0 + z1) / 2); };
    floor(-5.8, 0, 1, 4.8, wood); floor(1, 0, 5.8, 4.8, tile); floor(-5.8, -4.8, 1, 0, wood); floor(1, -4.8, 5.8, 0, tile);
    // دیوارهای داخلی با درگاه
    const inner = mat(0xf3efe6, 0.9);
    const part = (len, holes, x, z, ry) => { const m = add(wallGeo(len, H, holes, 0.12), inner, x, base, z, ry); m.castShadow = false; };
    part(11.6, [{ x0: -2.6, x1: -1.6, y0: 0, y1: 2.2 }, { x0: 3.5, x1: 4.5, y0: 0, y1: 2.2 }], 0.0, 0, 0);
    part(4.8, [{ x0: -0.4, x1: 0.6, y0: 0, y1: 2.2 }], 1, 2.4, Math.PI / 2);
    part(4.8, [], 1, -2.4, Math.PI / 2);
    const W = (x, z) => new THREE.Vector3(x, 0, z).applyMatrix4(g.matrixWorld);
    const cbox = (x0, z0, x1, z1) => { const a = W(x0, z0), b = W(x1, z1); it.colliders.push(this.colliders.box(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z), 1)); };
    cbox(-5.8, -0.06, -2.6, 0.06); cbox(-1.6, -0.06, 3.5, 0.06); cbox(4.5, -0.06, 5.8, 0.06); cbox(0.94, 0, 1.06, 1.9); cbox(0.94, 2.9, 1.06, 4.8); cbox(0.94, -4.8, 1.06, 0);
    // وسایل
    const rng = mulberry32(house.id * 17 + 3);
    const sofaC = [0x6b7c93, 0x8c4a3a, 0x3d5a40, 0x4a4e69][Math.floor(rng() * 4)];
    const place = (piece, x, z, yaw = 0, y = 0) => {
      const o = piece; o.group.position.set(x, base + y, z); o.group.rotation.y = yaw; g.add(o.group); o.group.updateMatrixWorld(true);
      for (const [x0, z0, x1, z1] of o.box || []) {
        const cxl = (x0 + x1) / 2, czl = (z0 + z1) / 2; const c = new THREE.Vector3(cxl, 0, czl).applyMatrix4(o.group.matrixWorld);
        it.colliders.push(this.colliders.obox(c.x, c.z, (x1 - x0) / 2, (z1 - z0) / 2, house.rot + yaw, 1));
      }
      for (const iv of o.inter || []) {
        const p = new THREE.Vector3(...iv.at).applyMatrix4(o.group.matrixWorld);
        it.inter.push(this.inter.add({ pos: p, r: 1.7, ry: 2.5, label: iv.label, act: (gm) => iv.act(gm, o), indoor: true }));
      }
      if (o.update) it.updates.push(o.update);
      it.pieces.push(o);
      return o;
    };
    // اتاق نشیمن
    place(F.rug(), -3.8, 2.0); place(F.sofa(sofaC), -3.8, 0.6, 0); place(F.coffeeTable(), -3.8, 2.0);
    place(F.tv(), -3.8, 4.45, Math.PI); place(F.armchair(sofaC + 0x101010), -1.1, 1.5, -Math.PI * 0.7); place(F.floorLamp(), -5.4, 0.45);
    place(F.bookshelf(), -5.6, 3.1, Math.PI / 2); place(F.plant(), 0.4, 4.4);
    const pt = place(F.painting(house.id % 7 + 1), -3.8, 0.08, 0, 1.9);
    place(F.curtain(1.4), -5.75, -2.9 + 5.8, Math.PI / 2, 0.9);
    // آشپزخانه
    place(F.fridge(), 5.4, 0.5, -Math.PI / 2); place(F.counter(1.6), 5.45, 1.85, -Math.PI / 2); place(F.sink(false), 5.45, 3.05, -Math.PI / 2); place(F.stove(), 5.42, 4.2, -Math.PI / 2);
    place(F.microwave(), 5.5, 1.5, -Math.PI / 2, 0.91); place(F.kettle(), 5.5, 2.2, -Math.PI / 2, 0.91);
    place(F.diningTable(), 3.0, 2.6); for (const [x, z, yw] of [[2.4, 1.85, 0], [3.6, 1.85, 0], [2.4, 3.35, Math.PI], [3.6, 3.35, Math.PI]]) place(F.chair(), x, z, yw);
    place(F.trashCan(), 1.45, 0.45);
    // اتاق خواب
    place(F.bed(), -3.5, -3.75); place(F.nightstand(), -4.75, -4.5); place(F.nightstand(), -2.25, -4.5);
    place(F.wardrobe(), -5.45, -1.4, Math.PI / 2); place(F.desk(), 0.5, -3.2, -Math.PI / 2); place(F.chair(0x2b2b30), -0.2, -3.2, Math.PI / 2);
    place(F.mirror(), -1.0, -0.08, Math.PI, 1.6); place(F.rug(0x2a4d69), -3.5, -1.6);
    // حمام
    place(F.bathtub(), 4.7, -4.2); place(F.toilet(), 1.7, -4.4, 0); place(F.sink(true), 5.5, -1.6, -Math.PI / 2); place(F.mirror(), 5.75, -1.6, -Math.PI / 2, 1.6);
    place(F.washer(), 1.5, -1.6, Math.PI / 2); place(F.towel(), 3.2, -4.75, 0, 1.3);
    for (const [x, z] of [[-2.4, 2.4], [3.4, 2.4], [-2.4, -2.4], [3.4, -2.4]]) { const l = F.ceilingLamp(); l.group.position.set(x, base + H - 0.03, z); g.add(l.group); }
    const sw = mat(0xf5f5f5, 0.4);
    for (const [x, z, ry] of [[-2.9, 4.75, Math.PI], [0.85, 1.6, -Math.PI / 2], [-2.95, -0.1, Math.PI], [1.15, -0.3, Math.PI / 2]]) {
      const plate = add(new THREE.BoxGeometry(0.08, 0.12, 0.02), sw, x, base + 1.25, z, ry); plate.castShadow = false;
      const p = new THREE.Vector3(x, base + 1.25, z).applyMatrix4(g.matrixWorld);
      it.inter.push(this.inter.add({ pos: p.setY(p.y - 0.3), r: 1.5, ry: 2.5, label: (gm) => (gm.roomLightOn ? 'خاموش کردن چراغ اتاق 💡' : 'روشن کردن چراغ اتاق 💡'), act: (gm) => { gm.roomLight(!gm.roomLightOn); gm.act('press', 0.5, { text: gm.roomLightOn ? 'چراغ روشن شد' : 'چراغ خاموش شد' }); gm.sfx('click'); } }));
    }
    // ادغام قطعات ثابت داخل خانه برای سرعت
    optimizeStatic(g, { skip: (o) => o.userData.dynamic });
    // نور خورشید به داخل خانه نمی‌رسد: وسایل داخل سایه نمی‌اندازند (سبک‌تر)
    g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    house.interior = it;
    return it;
  }
  disposeInterior(house) {
    const it = house.interior; if (!it) return;
    for (const c of it.colliders) this.colliders.remove(c);
    for (const i of it.inter) this.inter.remove(i);
    this.group.remove(it.g); it.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    house.interior = null;
  }

  // ---------------- برج‌های تجاری ----------------
  buildCommercial(r, bx, bz) {
    const rng = this.rng; const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const n = rng() < 0.5 ? 1 : 2;
    const cols = ['#8aa0b8', '#b8a88a', '#9cb3a6', '#a69cb8', '#c9b9a6'];
    for (let k = 0; k < n; k++) {
      const w = n === 1 ? 46 : 34, d = n === 1 ? 46 : 60, h = 22 + Math.floor(rng() * 6) * 8;
      const x = n === 1 ? cx : cx + (k ? 22 : -22), z = cz;
      const col = cols[Math.floor(rng() * cols.length)];
      const fm = (this._facades = this._facades || {})[col] || (this._facades[col] = (() => { const day = T.facade(col).clone(); const night = T.facade(col, true).clone(); day.wrapS = day.wrapT = night.wrapS = night.wrapT = THREE.RepeatWrapping; const m = new THREE.MeshStandardMaterial({ map: day, emissiveMap: night, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4, metalness: 0.3 }); this.windowMats.push(m); return m; })());
      const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv, p = g.attributes.position, nrm = g.attributes.normal;
      for (let i = 0; i < uv.count; i++) { const ny = Math.abs(nrm.getY(i)); const horiz = Math.abs(nrm.getX(i)) > 0.5 ? p.getZ(i) : p.getX(i); uv.setXY(i, ny > 0.5 ? 0 : (horiz + w) / 16, ny > 0.5 ? 0 : (p.getY(i) + h / 2 - 5) / 16); }
      const me = new THREE.Mesh(g, fm); me.position.set(x, h / 2 + 0.15, z); me.castShadow = true; me.receiveShadow = true; this.group.add(me);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.6, d + 0.6), mat(0x3b3f46, 0.6)); roof.position.set(x, h + 0.45, z); this.group.add(roof);
      // طبقه همکف: ویترین مغازه، سایبان و در
      const shops = [['کافه قهرمان', 'یک قهوه داغ خریدی ☕', 'drink'], ['شیرینی‌فروشی', 'یک کیک شکلاتی خریدی 🍰', 'eat'], ['کتاب‌فروشی', 'یک کتاب داستان خریدی 📕', 'read'], ['فروشگاه لوازم ماشین', 'یک واکس براق برای ماشین خریدی ✨', 'reach'], ['بستنی‌فروشی', 'یک بستنی قیفی خریدی 🍦', 'eat'], ['گل‌فروشی', 'یک دسته گل زیبا خریدی 💐', 'reach']];
      for (const sd of [1, -1]) {
        const shop = shops[Math.floor(rng() * shops.length)];
        const fzz = z + sd * (d / 2 + 0.05);
        const sm = (this._signM = this._signM || {})[shop[0]] || (this._signM[shop[0]] = (() => { const tx = T.signText(shop[0], '#1d2733', '#ffd166', 1024, 160, 90); return new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: 0.25 }); })());
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.4), sm); sign.position.set(x, 5.6, fzz + sd * 0.05); sign.rotation.y = sd > 0 ? 0 : Math.PI; this.group.add(sign);
        const ac = ['#d62828', '#2a9d8f', '#1d3557'][Math.floor(rng() * 3)]; const awnM = (this._awn = this._awn || {})[ac] || (this._awn[ac] = new THREE.MeshStandardMaterial({ map: T.stripes(ac, '#ffffff', 16), roughness: 0.8 })); const awn = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.15, 2.2), awnM);
        awn.position.set(x, 4.4, fzz + sd * 1.1); awn.rotation.x = sd * 0.15; this.group.add(awn);
        const door = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.8, 0.1), mat(0x1d2733, 0.2, 0.6)); door.position.set(x, 1.55, fzz + sd * 0.02); this.group.add(door);
        this.inter.add({ pos: new THREE.Vector3(x, 1.4, fzz + sd * 0.9), r: 2.2, label: 'خرید از ' + shop[0], act: (gm) => gm.act(shop[2], 2.4, { text: shop[1] }) });
      }
      this.colliders.box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 3);
    }
    // جای پارک کنار خیابان
    this.parkedSpots.push({ pos: new THREE.Vector3(r.x0 - 5.8, 0, cz + 20), yaw: 0 }, { pos: new THREE.Vector3(r.x1 + 5.8, 0, cz - 20), yaw: Math.PI });
    this.trashSpots.push({ pos: new THREE.Vector3(cx, 0.15, r.z0 + 2), area: true });
  }

  // ---------------- میدان شهر ----------------
  buildPlaza(r) {
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const stone = mat(0xd9d2c3, 0.6);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.4, 0.7, 40, 1, true), stone); basin.position.set(cx, 0.5, cz); basin.material.side = THREE.DoubleSide; this.group.add(basin);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(7.1, 0.25, 8, 48), stone); rim.rotation.x = Math.PI / 2; rim.position.set(cx, 0.85, cz); this.group.add(rim);
    const water = new THREE.Mesh(new THREE.CircleGeometry(7, 40), new THREE.MeshStandardMaterial({ color: 0x3fa8d8, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 })); water.rotation.x = -Math.PI / 2; water.position.set(cx, 0.65, cz); water.userData.keep = true; this.group.add(water);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.0, 3, 16), stone); col.position.set(cx, 1.6, cz); this.group.add(col);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(1.8, 24, 10, 0, TAU, Math.PI / 2, Math.PI / 2), stone); bowl.position.set(cx, 3.3, cz); bowl.material.side = THREE.DoubleSide; this.group.add(bowl);
    this.fountain = { pos: new THREE.Vector3(cx, 3.4, cz), r: 7 };
    this.colliders.circle(cx, cz, 7.5, 3);
    this.inter.add({ pos: new THREE.Vector3(cx, 1, cz + 7.8), r: 2.5, label: 'انداختن سکه در فواره و آرزو کردن', act: (gm) => gm.act('throw', 1.2, { text: 'یک سکه انداختی و آرزو کردی ✨', coinToss: new THREE.Vector3(cx, 0.7, cz + 4) }) });
    // مجسمه طلایی قهرمان
    const ped = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), mat(0x8d8a84, 0.7)); ped.position.set(cx, 1.15, cz - 22); this.group.add(ped);
    const gold = new THREE.MeshStandardMaterial({ color: 0xd4a531, metalness: 1, roughness: 0.25 });
    const statue = buildHuman({ detail: 'mid', shirtMat: gold, pantsMat: gold, skin: 0xd4a531, hair: 0xc9a227 });
    statue.root.traverse((o) => { if (o.isMesh) o.material = gold; });
    statue.pose('stand'); statue.j.shoulderR.rotation.x = -2.9; statue.j.shoulderR.rotation.z = -0.2;
    statue.root.position.set(cx, 2.15, cz - 22); statue.root.scale.setScalar(1.5); this.group.add(statue.root);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.05, 0.3, 16), gold); statue.j.wristR.add(cup); cup.position.set(0, -0.2, 0);
    this.colliders.box(cx - 1.6, cz - 23.6, cx + 1.6, cz - 20.4, 3);
    this.inter.add({ pos: new THREE.Vector3(cx, 1, cz - 20), r: 2.6, label: 'عکس گرفتن با مجسمه قهرمان 📸', act: (gm) => gm.act('wave', 2, { text: 'عکس یادگاری گرفتی! 📸', flash: true }) });
    // نیمکت‌ها، میزهای کافه و گل‌ها
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + 0.2; this.addBench(cx + Math.cos(a) * 12, cz + Math.sin(a) * 12, -a - Math.PI / 2); }
    for (const [x, z] of [[cx + 28, cz + 25], [cx - 28, cz + 25], [cx + 28, cz - 25]]) this.addCafeTable(x, z);
    for (const [x, z] of [[cx - 30, cz - 30], [cx + 30, cz - 30], [cx - 30, cz + 30], [cx + 30, cz + 30]]) this.addPlanter(x, z);
    this.trashSpots.push({ pos: new THREE.Vector3(cx + 18, 0.15, cz + 18), area: true, big: true });
  }

  // ---------------- زمین پرش با رمپ ----------------
  buildStunt(r) {
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const asphaltM = new THREE.MeshStandardMaterial({ map: T.asphalt().map, roughness: 0.9 });
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), asphaltM); pad.rotation.x = -Math.PI / 2; pad.position.set(cx, 0.02, cz); pad.receiveShadow = true;
    const uv = pad.geometry.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 25, uv.getY(k) * 25); this.group.add(pad);
    const rampM = new THREE.MeshStandardMaterial({ map: T.stripes('#ff7a00', '#1a1a1a', 10), roughness: 0.6 });
    for (const [x, z, yaw, h, l, w] of [[cx - 25, cz - 20, 0, 1.6, 9, 6], [cx + 10, cz - 25, Math.PI / 2, 2.6, 12, 7], [cx + 25, cz + 15, Math.PI, 3.4, 14, 8], [cx - 20, cz + 25, -Math.PI / 2, 2.0, 10, 6]]) {
      const sh = new THREE.Shape(); sh.moveTo(-l / 2, 0); sh.lineTo(l / 2, 0); sh.lineTo(l / 2, h); sh.lineTo(-l / 2, 0);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false }); geo.translate(0, 0, -w / 2); geo.rotateY(-Math.PI / 2);
      const m = new THREE.Mesh(geo, rampM); m.position.set(x, 0, z); m.rotation.y = yaw; m.castShadow = true; m.receiveShadow = true; this.group.add(m);
      this.ramps.push({ x, z, c: Math.cos(-yaw), s: Math.sin(-yaw), w, l, h, yaw });
      this.inter.add({ pos: new THREE.Vector3(x - Math.sin(yaw) * (l / 2 + 0.8), 0.9, z - Math.cos(yaw) * (l / 2 + 0.8)), r: 2.4, label: 'دویدن روی رمپ پرش 🏃', act: (gm) => gm.path({ pts: [new THREE.Vector3(x - Math.sin(yaw) * (l / 2 + 0.6), 0, z - Math.cos(yaw) * (l / 2 + 0.6)), new THREE.Vector3(x, h / 2, z), new THREE.Vector3(x + Math.sin(yaw) * (l / 2 - 0.3), h, z + Math.cos(yaw) * (l / 2 - 0.3)), new THREE.Vector3(x + Math.sin(yaw) * (l / 2 + 1.5), h * 0.6, z + Math.cos(yaw) * (l / 2 + 1.5)), new THREE.Vector3(x + Math.sin(yaw) * (l / 2 + 2.6), 0, z + Math.cos(yaw) * (l / 2 + 2.6))], dur: 2.6, climb: 3, text: 'پریدی! 🤸' }) });
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.4), new THREE.MeshStandardMaterial({ map: T.signText('زمین پرش 🏁', '#111', '#ff7a00', 1024, 176, 120) }));
    sign.position.set(cx, 5, r.z0 + 1); sign.rotation.y = Math.PI; this.group.add(sign);
  }

  // ---------------- وسایل خیابانی ----------------
  makePropBatches() {
    const P = {};
    const vp = vertexPBRMaterial();
    const merge = (list) => mergeGeos(list, ['position', 'normal', 'uv', 'color', 'aMR']);
    // در خانه
    { const g = []; g.push(at(vc(new THREE.BoxGeometry(1.1, 2.2, 0.06), 0xffffff, 0, 0.5), 0.55, 1.1, 0)); for (const y of [0.55, 1.6]) g.push(at(vc(new THREE.BoxGeometry(0.85, 0.75, 0.02), 0xdddddd, 0, 0.5), 0.55, y, 0.04)); g.push(at(vc(new THREE.SphereGeometry(0.04, 10, 8), 0xd4a531, 1, 0.2), 0.95, 1.05, 0.07));
      P.door = new Batch(this, merge(g), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), { color: true }); }
    // تیر چراغ برق
    { const g = [at(vc(new THREE.CylinderGeometry(0.08, 0.12, 6.5, 8), 0x2f3338, 0.7, 0.4), 0, 3.25, 0), vc(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 6.3, 0), new THREE.Vector3(0, 6.9, 0.5), new THREE.Vector3(0, 6.8, 1.6)]), 10, 0.05, 6), 0x2f3338, 0.7, 0.4), at(vc(new THREE.BoxGeometry(0.3, 0.14, 0.6), 0x2f3338, 0.7, 0.4), 0, 6.75, 1.65)];
      P.lamp = new Batch(this, merge(g), vp); P.lampHead = new Batch(this, at(new THREE.BoxGeometry(0.24, 0.04, 0.5), 0, 6.67, 1.65), new THREE.MeshBasicMaterial({ color: 0xffffff }), { cast: false, color: true }); }
    // نیمکت
    { const g = []; for (let k = 0; k < 4; k++) g.push(at(vc(new THREE.BoxGeometry(1.8, 0.04, 0.1), 0x8a5a33, 0, 0.6), 0, 0.46, -0.18 + k * 0.12)); for (let k = 0; k < 3; k++) g.push(at(vc(new THREE.BoxGeometry(1.8, 0.1, 0.035), 0x8a5a33, 0, 0.6), 0, 0.62 + k * 0.13, -0.27).rotateX(-0.1));
      for (const x of [-0.75, 0.75]) { g.push(at(vc(new THREE.BoxGeometry(0.06, 0.45, 0.45), 0x26282c, 0.8, 0.4), x, 0.22, 0)); g.push(at(vc(new THREE.BoxGeometry(0.06, 0.45, 0.06), 0x26282c, 0.8, 0.4), x, 0.68, -0.27)); }
      P.bench = new Batch(this, merge(g), vp); }
    // سطل زباله چرخ‌دار واقعی (بدنه و درب جدا)
    { const body = new THREE.CylinderGeometry(0.42, 0.34, 1.0, 4, 1); body.rotateY(Math.PI / 4); body.scale(1, 1, 1.15); const g = [at(vc(body, 0xffffff, 0, 0.55), 0, 0.56, 0)];
      for (let k = 0; k < 3; k++) g.push(at(vc(new THREE.BoxGeometry(0.5, 0.04, 0.03), 0xdddddd, 0, 0.55), 0, 0.35 + k * 0.25, 0.43));
      for (const x of [-0.3, 0.3]) g.push(at(vc(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 14).rotateZ(Math.PI / 2), 0x111111, 0, 0.9), x, 0.1, -0.32));
      g.push(at(vc(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 8).rotateZ(Math.PI / 2), 0x222222, 0.3, 0.5), 0, 1.0, -0.42));
      P.bin = new Batch(this, merge(g), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }), { color: true });
      const lid = new THREE.BoxGeometry(0.66, 0.06, 0.84); lid.translate(0, 0.03, 0.4); const lg = merge([vc(lid, 0xffffff, 0, 0.5), at(vc(new THREE.BoxGeometry(0.4, 0.04, 0.06), 0xdddddd, 0, 0.5), 0, 0.05, 0.82)]);
      P.binLid = new Batch(this, lg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), { color: true }); }
    // شیر آتش‌نشانی
    { const g = [at(vc(new THREE.CylinderGeometry(0.13, 0.15, 0.7, 12), 0xc1121f, 0.3, 0.45), 0, 0.35, 0), at(vc(new THREE.SphereGeometry(0.14, 12, 8, 0, TAU, 0, Math.PI / 2), 0xc1121f, 0.3, 0.45), 0, 0.7, 0), at(vc(new THREE.CylinderGeometry(0.05, 0.05, 0.36, 8).rotateZ(Math.PI / 2), 0xd8d8d8, 0.8, 0.3), 0, 0.5, 0)];
      P.hydrant = new Batch(this, merge(g), vp); }
    // صندوق پست
    { const g = [at(vc(new THREE.BoxGeometry(0.06, 1.0, 0.06), 0x333333, 0.5, 0.5), 0, 0.5, 0), at(vc(new RoundedBoxGeometry(0.3, 0.3, 0.5, 2, 0.08), 0x1d5bbf, 0.2, 0.4), 0, 1.15, 0), at(vc(new THREE.BoxGeometry(0.02, 0.15, 0.08), 0xd62828, 0, 0.5), 0.16, 1.25, -0.12)];
      P.mailbox = new Batch(this, merge(g), vp); }
    // چراغ راهنمایی
    { const g = [at(vc(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 8), 0x2b2d31, 0.6, 0.4), 0, 2.1, 0), at(vc(new THREE.BoxGeometry(0.4, 1.1, 0.35), 0x1a1a1d, 0.3, 0.5), 0, 3.7, 0.12)];
      P.tlight = new Batch(this, merge(g), vp);
      P.tlens = new Batch(this, at(new THREE.CircleGeometry(0.12, 14), 0, 0, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff }), { cast: false, color: true }); }
    // ایستگاه اتوبوس
    { const g = [at(vc(new THREE.BoxGeometry(4, 0.1, 1.6), 0x2b2d31, 0.6, 0.4), 0, 2.6, 0)]; for (const x of [-1.9, 1.9]) g.push(at(vc(new THREE.BoxGeometry(0.08, 2.6, 0.08), 0x2b2d31, 0.6, 0.4), x, 1.3, -0.7)); g.push(at(vc(new THREE.BoxGeometry(3.6, 0.06, 0.45), 0x8a5a33, 0, 0.6), 0, 0.5, -0.45)); g.push(at(vc(new THREE.BoxGeometry(3.8, 2.2, 0.04), 0xbfd8e6, 0.5, 0.1), 0, 1.4, -0.78));
      P.busstop = new Batch(this, merge(g), vp); }
    // دستگاه فروش نوشیدنی
    { const g = [at(vc(new RoundedBoxGeometry(1.0, 1.9, 0.8, 2, 0.05), 0xd62828, 0.3, 0.4), 0, 0.95, 0), at(vc(new THREE.BoxGeometry(0.6, 1.2, 0.02), 0x1d3557, 0.5, 0.1), -0.12, 1.15, 0.41)]; for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) g.push(at(vc(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8), [0xffd166, 0x06d6a0, 0xef476f, 0xffffff][(r + k) % 4], 0.3, 0.3), -0.33 + k * 0.14, 0.7 + r * 0.25, 0.38));
      P.vending = new Batch(this, merge(g), vp); }
    // باجه تلفن
    { const g = []; for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) g.push(at(vc(new THREE.BoxGeometry(0.08, 2.4, 0.08), 0xc1121f, 0.2, 0.4), x, 1.2, z)); g.push(at(vc(new THREE.BoxGeometry(1.05, 0.2, 1.05), 0xc1121f, 0.2, 0.4), 0, 2.45, 0)); for (const [x, z, ry] of [[0, -0.47, 0], [-0.47, 0, Math.PI / 2], [0.47, 0, Math.PI / 2]]) g.push(at(vc(new THREE.BoxGeometry(0.9, 2.1, 0.03).rotateY(ry), 0xbfd8e6, 0.5, 0.1), x, 1.2, z)); g.push(at(vc(new THREE.BoxGeometry(0.25, 0.35, 0.12), 0x222222, 0.3, 0.4), 0, 1.4, -0.38));
      P.phone = new Batch(this, merge(g), vp); }
    // گلدان بزرگ خیابانی
    { const g = [at(vc(new THREE.BoxGeometry(2, 0.6, 2), 0x9a948a, 0, 0.8), 0, 0.3, 0)]; const rng = mulberry32(3); for (let k = 0; k < 14; k++) g.push(at(vc(new THREE.SphereGeometry(0.15, 6, 5), [0xe63946, 0xffbe0b, 0xff70a6, 0xffffff, 0x8338ec][k % 5], 0, 0.8), (rng() - 0.5) * 1.6, 0.72 + rng() * 0.2, (rng() - 0.5) * 1.6)); g.push(at(vc(new THREE.BoxGeometry(1.8, 0.1, 1.8), 0x2e7d32, 0, 0.9), 0, 0.62, 0));
      P.planter = new Batch(this, merge(g), vp); }
    // میز کافه با چتر
    { const g = [at(vc(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 16), 0xffffff, 0.2, 0.4), 0, 0.75, 0), at(vc(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8), 0x888888, 0.8, 0.3), 0, 1.2, 0), at(vc(new THREE.ConeGeometry(1.4, 0.5, 12, 1, true), 0xe63946, 0, 0.8), 0, 2.4, 0)];
      for (let k = 0; k < 4; k++) { const a = k / 4 * TAU; g.push(at(vc(new THREE.BoxGeometry(0.42, 0.04, 0.42), 0x26282c, 0.6, 0.4), Math.cos(a) * 0.85, 0.46, Math.sin(a) * 0.85)); }
      P.cafe = new Batch(this, merge(g), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide })); }
    return P;
  }

  addBench(x, z, yaw) {
    this.props.bench.add(new THREE.Vector3(x, 0.15, z), yaw);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    this.colliders.obox(x, z, 0.95, 0.3, yaw, 3);
    const seat = new THREE.Vector3(x + s * 0.15, 0.15, z + c * 0.15);
    this.inter.add({ pos: new THREE.Vector3(x + s * 0.5, 0.9, z + c * 0.5), r: 1.7, label: 'نشستن روی نیمکت', act: (g) => g.sit({ world: seat.clone().setY(0.15 + 0.46), yaw }) });
  }
  addCafeTable(x, z) {
    this.props.cafe.add(new THREE.Vector3(x, 0.15, z), 0); this.colliders.circle(x, z, 0.5, 3);
    this.inter.add({ pos: new THREE.Vector3(x + 0.85, 0.9, z), r: 1.6, label: 'نشستن پشت میز کافه', act: (g) => g.sit({ world: new THREE.Vector3(x + 0.85, 0.63, z), yaw: -Math.PI / 2 }) });
  }
  addPlanter(x, z) {
    this.props.planter.add(new THREE.Vector3(x, 0.15, z), 0); this.colliders.box(x - 1, z - 1, x + 1, z + 1, 3);
    this.inter.add({ pos: new THREE.Vector3(x, 0.9, z + 1.1), r: 1.8, label: 'بوییدن گل‌ها 🌸', act: (g) => g.act('reach', 2, { text: 'گل‌ها بوی خیلی خوبی می‌دهند 🌸' }) });
  }
  // سطل زباله: درب جدا متحرک
  addBin(x, z, yaw, color = 0x2e7d32, opts = {}) {
    const pos = new THREE.Vector3(x, 0.15, z);
    this.props.bin.add(pos, yaw, 1, color);
    const lidPos = new THREE.Vector3(x - Math.sin(yaw) * 0.42, 1.08, z - Math.cos(yaw) * 0.42);
    const li = this.props.binLid.add(lidPos, yaw, 1, color);
    this.colliders.circle(x, z, 0.45, 3);
    const bin = { pos, yaw, li, lidPos, open: 0, t: 0, count: 0, mission: !!opts.mission };
    bin.inter = this.inter.add({ pos: new THREE.Vector3(x + Math.sin(yaw) * 0.6, 1, z + Math.cos(yaw) * 0.6), r: 1.8, pri: 0.4, label: (g) => (g.holding ? 'انداختن آشغال در سطل 🗑️' : 'باز کردن درب سطل زباله'), act: (g) => g.useBin(bin) });
    this.bins.push(bin);
    return bin;
  }

  buildStreetProps() {
    const N = CITY.N, R = CITY.ROAD;
    const isPark = (bx, bz) => this.types[bx + ',' + bz] === 'park';
    const rng = this.rng;
    // چراغ‌ها و درخت‌ها در امتداد پیاده‌روها
    for (let bx = 0; bx < N; bx++) for (let bz = 0; bz < N; bz++) {
      const t = this.types[bx + ',' + bz]; if (t === 'park' || t === 'stunt') continue;
      const r = blockRect(bx, bz);
      const edges = [[r.x0, r.z0 + 1.2, r.x1, r.z0 + 1.2, 0], [r.x0, r.z1 - 1.2, r.x1, r.z1 - 1.2, Math.PI], [r.x0 + 1.2, r.z0, r.x0 + 1.2, r.z1, Math.PI / 2], [r.x1 - 1.2, r.z0, r.x1 - 1.2, r.z1, -Math.PI / 2]];
      edges.forEach(([x0, z0, x1, z1, ang], ei) => {
        const len = Math.hypot(x1 - x0, z1 - z0);
        for (let s = 10; s < len - 8; s += 30) {
          const x = lerp(x0, x1, s / len), z = lerp(z0, z1, s / len);
          const yaw = ang + Math.PI; // بازوی چراغ به سمت خیابان
          const li = this.props.lamp.add(new THREE.Vector3(x, 0.15, z), yaw); this.props.lampHead.add(new THREE.Vector3(x, 0.15, z), yaw, 1, 0x555555);
          const lamp = { i: li, on: false, user: null }; this.lamps.push(lamp);
          this.colliders.circle(x, z, 0.2, 3);
          this.inter.add({ pos: new THREE.Vector3(x, 1, z), r: 1.4, label: () => (lamp.on ? 'خاموش کردن چراغ خیابان' : 'روشن کردن چراغ خیابان'), act: (g) => { lamp.user = !lamp.on; lamp.on = !lamp.on; this.props.lampHead.setColor(li, lamp.on ? 0xfff0c8 : 0x555555); g.act('press', 0.5, { text: lamp.on ? 'چراغ خیابان روشن شد 💡' : 'چراغ خیابان خاموش شد' }); } });
          // درخت بین چراغ‌ها
          const tx = lerp(x0, x1, (s + 15) / len), tz = lerp(z0, z1, (s + 15) / len);
          if (s + 15 < len - 8) (this.treeSpots = this.treeSpots || []).push([tx, tz, 0.8 + rng() * 0.3]);
        }
      });
      // وسایل گوشه‌های بلوک
      const corners = [[r.x0 + 2.2, r.z0 + 2.2], [r.x1 - 2.2, r.z0 + 2.2], [r.x0 + 2.2, r.z1 - 2.2], [r.x1 - 2.2, r.z1 - 2.2]];
      corners.forEach(([x, z], k) => {
        const kind = (bx * 7 + bz * 3 + k) % 6;
        if (kind === 0) this.addBin(x, z, k * Math.PI / 2, [0x2e7d32, 0x1d4ed8, 0x4b5563][(bx + bz) % 3]);
        else if (kind === 1) { this.props.hydrant.add(new THREE.Vector3(x, 0.15, z), 0); this.colliders.circle(x, z, 0.2, 3); this.inter.add({ pos: new THREE.Vector3(x, 0.7, z), r: 1.4, label: 'باز کردن شیر آتش‌نشانی 💦', act: (g) => g.act('reach', 1, { text: 'آب با فشار بیرون زد! 💦', fountain: new THREE.Vector3(x, 0.8, z) }) }); }
        else if (kind === 2) { const yaw = k * Math.PI / 2; this.props.mailbox.add(new THREE.Vector3(x, 0.15, z), yaw); this.colliders.circle(x, z, 0.25, 3); this.inter.add({ pos: new THREE.Vector3(x, 1, z), r: 1.4, label: 'انداختن نامه در صندوق پست 📮', act: (g) => g.act('reach', 1, { text: 'نامه‌ات پست شد 📮' }) }); }
        else if (kind === 3 && t !== 'com') { const yaw = [Math.PI, Math.PI, 0, 0][k] ; this.props.vending.add(new THREE.Vector3(x, 0.15, z), yaw); this.colliders.circle(x, z, 0.6, 3); this.inter.add({ pos: new THREE.Vector3(x, 1, z), r: 1.7, label: 'خرید نوشیدنی از دستگاه 🥤', act: (g) => g.act('drink', 2.4, { text: 'یک نوشابه خنک خریدی و خوردی 🥤' }) }); }
        else if (kind === 4) { this.props.phone.add(new THREE.Vector3(x, 0.15, z), [Math.PI, Math.PI, 0, 0][k]); this.colliders.box(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 3); this.inter.add({ pos: new THREE.Vector3(x, 1, z), r: 1.6, label: 'تلفن زدن از باجه ☎️', act: (g) => g.act('phone', 3, { text: ['به دوستت زنگ زدی ☎️', 'به مادرت زنگ زدی و حالش را پرسیدی 💛'][Math.floor(Math.random() * 2)] }) }); }
        else this.addBin(x, z, k * Math.PI / 2, 0x4b5563);
      });
    }
    // چراغ‌های راهنمایی در تقاطع‌ها
    this.tlights = [];
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      if (i === 4 && j === 4) continue;
      if (i === 0 || j === 0 || i === N || j === N) { if ((i + j) % 2) continue; }
      const x = roadCenter(i), z = roadCenter(j); const o = R / 2 + 1.2;
      const lights = [];
      for (const [dx, dz, yaw, axis] of [[o, o, Math.PI, 0], [-o, -o, 0, 0], [o, -o, -Math.PI / 2, 1], [-o, o, Math.PI / 2, 1]]) {
        const px = x + dx, pz = z + dz;
        if (this.colliders.inside(px, pz, 2)) continue;
        this.props.tlight.add(new THREE.Vector3(px, 0.15, pz), yaw);
        const lenses = [0, 1, 2].map((k) => { const lp = new THREE.Vector3(px + Math.sin(yaw) * 0.12, 0.15 + 4.05 - k * 0.33, pz + Math.cos(yaw) * 0.12); return this.props.tlens.add(lp, yaw, 1, 0x222222); });
        lights.push({ lenses, axis });
        this.colliders.circle(px, pz, 0.15, 3);
        this.inter.add({ pos: new THREE.Vector3(px, 1, pz), r: 1.3, label: 'زدن دکمه عبور عابر پیاده 🚦', act: (g) => { tl.t = Math.max(tl.t, tl.period - 1.5); g.act('press', 0.5, { text: 'چراغ برای عبور عابر سبز می‌شود 🚶' }); } });
      }
      const tl = { lights, t: (i * 3 + j * 5) % 16, period: 16, state: 0 };
      this.tlights.push(tl); (this.tlMap = this.tlMap || new Map()).set(i + ',' + j, tl);
    }
    this.updaters.push((dt) => {
      for (const tl of this.tlights) {
        tl.t = (tl.t + dt) % (tl.period * 2);
        const phase = tl.t < tl.period - 2 ? 0 : tl.t < tl.period ? 1 : tl.t < tl.period * 2 - 2 ? 2 : 3;
        if (phase === tl.state) continue; tl.state = phase;
        for (const L of tl.lights) {
          // محور ۰: سبز در فاز ۰، زرد در فاز ۱، قرمز در فاز ۲ و ۳
          const ph = L.axis === 0 ? phase : (phase + 2) % 4;
          const col = ph === 0 ? 2 : ph === 1 ? 1 : 0;
          L.lenses.forEach((li, k) => this.props.tlens.setColor(li, k === col ? [0xff2020, 0xffb000, 0x20ff60][k] : 0x202020));
        }
      }
    });
    // ایستگاه‌های اتوبوس
    for (const [bx, bz] of [[0, 2], [2, 5], [5, 3], [3, 0]]) {
      const r = blockRect(bx, bz); const x = (r.x0 + r.x1) / 2 - 20, z = r.z0 + 2.4;
      if (this.types[bx + ',' + bz] === 'park') continue;
      this.props.busstop.add(new THREE.Vector3(x, 0.15, z), Math.PI); this.colliders.box(x - 2, z - 0.3, x + 2, z + 0.9, 3);
      this.inter.add({ pos: new THREE.Vector3(x, 1, z + 0.3), r: 2.2, label: 'نشستن در ایستگاه اتوبوس 🚌', act: (g) => g.sit({ world: new THREE.Vector3(x, 0.15 + 0.48, z + 0.45), yaw: Math.PI, text: 'منتظر اتوبوس نشستی 🚌' }) });
    }
  }

  buildTrees() {
    const spots = this.treeSpots || [];
    // درخت‌های حیاط پشتی و اطراف شهر
    const rng = this.rng;
    for (let k = 0; k < 220; k++) { const a = rng() * TAU, d = SPAN / 2 + 70 + rng() * 300; spots.push([Math.cos(a) * d, Math.sin(a) * d, 0.9 + rng() * 0.8]); }
    for (let bx = 0; bx < CITY.N; bx++) for (let bz = 0; bz < CITY.N; bz++) if (this.types[bx + ',' + bz] === 'res') { const r = blockRect(bx, bz); for (let k = 0; k < 4; k++) spots.push([lerp(r.x0 + 12, r.x1 - 12, rng()), lerp(r.z0 + 30, r.z1 - 30, rng()), 0.9 + rng() * 0.5]); }
    const trunk = new THREE.CylinderGeometry(0.16, 0.26, 3.2, 6, 1, true); trunk.translate(0, 1.6, 0);
    const fol = []; const det = this.q === 'low' ? 0 : 1; for (const [x, y, z, r] of [[0, 4.4, 0, 2.0], [1.0, 3.9, 0.4, 1.4], [-1.0, 4.0, -0.3, 1.5], [0.2, 5.3, 0.4, 1.3], [-0.3, 4.1, 1.0, 1.3]]) { const s = new THREE.IcosahedronGeometry(r, det); s.translate(x, y, z); fol.push(s); }
    const geo = mergeGeos([vc(trunk, 0x4a3423, 0, 0.95), ...fol.map((f) => vc(f, 0x3d7a2c, 0, 0.85))], ['position', 'normal', 'uv', 'color', 'aMR']);
    const cells = new Map();
    for (const s of spots) { const k = Math.floor(s[0] / 400) + ':' + Math.floor(s[1] / 400); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(s); }
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
    const tm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    tm.onBeforeCompile = vertexPBRMaterial().onBeforeCompile; tm.customProgramCacheKey = () => 'vpbr-tree';
    for (const [, list] of cells) {
      const im = new THREE.InstancedMesh(geo, tm, list.length);
      list.forEach(([x, z, s], i) => { const y = this.groundAt(x, z); mtx.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, rng() * TAU), new THREE.Vector3(s, s * (0.9 + rng() * 0.3), s)); im.setMatrixAt(i, mtx); const v = 0.85 + rng() * 0.3; im.setColorAt(i, c.setRGB(v * 0.95, v, v * 0.9)); if (Math.hypot(x, z) < SPAN / 2) this.colliders.circle(x, z, 0.35 * s, 3); });
      im.castShadow = true; im.computeBoundingSphere(); this.group.add(im);
      this.inter.add({ pos: new THREE.Vector3(list[0][0], 1, list[0][1]), r: 1.6, label: 'تکان دادن درخت 🌳', act: (g) => g.act('shake', 1.6, { text: 'چند برگ از درخت افتاد 🍃', leaves: new THREE.Vector3(list[0][0], 4, list[0][1]) }) });
    }
    for (const [x, z] of spots) if (Math.hypot(x, z) < SPAN / 2) this.inter.add({ pos: new THREE.Vector3(x, 1, z), r: 1.5, label: 'تکان دادن درخت 🌳', act: (g) => g.act('shake', 1.6, { text: 'چند برگ از درخت افتاد 🍃', leaves: new THREE.Vector3(x, 4, z) }) });
  }

  // ---------------- مسیر ماشین‌ها و عابرها ----------------
  buildLaneGraph() {
    const N = CITY.N; const nodes = new Map(); const edges = [];
    const key = (i, j) => i + ',' + j;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) if (!(i === 4 && j === 4)) nodes.set(key(i, j), { i, j, x: roadCenter(i), z: roadCenter(j), out: [] });
    const link = (a, b) => { if (!a || !b) return; const e1 = { a, b }, e2 = { a: b, b: a }; a.out.push(e1); b.out.push(e2); edges.push(e1, e2); };
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const n = nodes.get(key(i, j)); if (!n) continue;
      if (i < N && !(j === 4 && (i === 3 || i === 4))) link(n, nodes.get(key(i + 1, j)));
      if (j < N && !(i === 4 && (j === 3 || j === 4))) link(n, nodes.get(key(i, j + 1)));
    }
    this.lane = { nodes, edges };
  }
  buildWalkerLoops() {
    this.walkLoops = [];
    for (let bx = 0; bx < CITY.N; bx++) for (let bz = 0; bz < CITY.N; bz++) {
      const t = this.types[bx + ',' + bz]; if (t === 'park' || t === 'stunt') continue;
      const r = blockRect(bx, bz); const o = 2.4;
      this.walkLoops.push([[r.x0 + o, r.z0 + o], [r.x1 - o, r.z0 + o], [r.x1 - o, r.z1 - o], [r.x0 + o, r.z1 - o]]);
    }
    if (this.park?.paths) this.walkLoops.push(...this.park.paths);
  }

  buildMinimap() {
    const S = 1024; const c = document.createElement('canvas'); c.width = S; c.height = S; const ctx = c.getContext('2d');
    const lim = SPAN / 2 + 40; const sc = S / (lim * 2);
    this.mm = { sc, off: lim, S, canvas: c };
    const X = (x) => (x + lim) * sc, Z = (z) => (z + lim) * sc;
    ctx.fillStyle = '#5f8f4e'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#3d3f44'; ctx.fillRect(X(-SPAN / 2), Z(-SPAN / 2), SPAN * sc, SPAN * sc);
    for (let bx = 0; bx < CITY.N; bx++) for (let bz = 0; bz < CITY.N; bz++) {
      const r = blockRect(bx, bz); const t = this.types[bx + ',' + bz];
      ctx.fillStyle = { res: '#cfd9b8', com: '#b9c0cc', plaza: '#e3d8c3', stunt: '#5a5d63', park: '#7cc46a' }[t];
      ctx.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc);
    }
    const pr = this.parkRect; ctx.fillStyle = '#7cc46a'; ctx.fillRect(X(pr.x0), Z(pr.z0), (pr.x1 - pr.x0) * sc, (pr.z1 - pr.z0) * sc);
    ctx.fillStyle = '#c0634a'; for (const h of this.houseRects || []) ctx.fillRect(X(h.minX), Z(h.minZ), (h.maxX - h.minX) * sc, (h.maxZ - h.minZ) * sc);
    ctx.fillStyle = '#fff'; ctx.font = "700 30px 'Vazirmatn', sans-serif"; ctx.textAlign = 'center';
    ctx.fillText('شهربازی', X((pr.x0 + pr.x1) / 2), Z((pr.z0 + pr.z1) / 2));
  }

  update(dt, t, focus) {
    for (const u of this.updaters) u(dt, t);
    // درهای خانه: باز شدن خودکار وقتی بازیکن نزدیک است
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    let built = false;
    for (const h of this.houses) {
      const d = h.front.distanceTo(focus);
      if (!h.manual) h.doorOpen = d < 2.6;
      if (h.manual && d > 8) h.manual = false;
      const target = h.doorOpen ? -1.6 : 0;
      if (Math.abs(h.doorA - target) > 0.001) {
        h.doorA += (target - h.doorA) * Math.min(1, dt * 5);
        m.compose(h.hinge, q.setFromAxisAngle(up, h.rot + h.doorA), one); this.props.door.setMatrix(h.doorIdx, m);
      }
      // در بسته مانع عبور است
      const closed = h.doorA > -0.3;
      if (closed && !h.doorCol) h.doorCol = this.colliders.box(...h.doorBox, 1); else if (!closed && h.doorCol) { this.colliders.remove(h.doorCol); h.doorCol = null; }
      // فضای داخلی فقط برای خانه‌های نزدیک (ساخت تدریجی و نگه‌داری چند خانه آخر)
      const dc = Math.hypot(h.cx - focus.x, h.cz - focus.z);
      if (dc < 34 && !h.interior && this.canBuild !== false && !built) { this.buildInterior(h); built = true; this.lru = (this.lru || []).filter((x) => x !== h); this.lru.push(h); }
      if (h.interior) {
        const vis = (dc < 30 && !(this.insideHouse && this.insideHouse !== h)) || h.lockInterior; if (h.interior.g.visible !== vis) h.interior.g.visible = vis;
        if (vis) for (const u of h.interior.updates) u(dt, t);
      }
    }
    if (this.lru && this.lru.length > 8) { const old = this.lru.find((h) => !h.lockInterior && Math.hypot(h.cx - focus.x, h.cz - focus.z) > 60); if (old) { this.disposeInterior(old); this.lru.splice(this.lru.indexOf(old), 1); } }
    for (const b of this.bins) {
      if (b.t > 0) b.t -= dt;
      const target = b.t > 0 ? -1.9 : 0;
      if (Math.abs(b.open - target) > 0.001) { b.open += (target - b.open) * Math.min(1, dt * 8); m.compose(b.lidPos, q.setFromEuler(new THREE.Euler(b.open, b.yaw, 0, 'YXZ')), one); this.props.binLid.setMatrix(b.li, m); }
    }
  }
  setNight(on) {
    for (const m of this.windowMats) m.emissiveIntensity = on ? 1.4 : 0;
    for (const l of this.lamps) { if (l.user !== null) continue; l.on = on; this.props.lampHead.setColor(l.i, on ? 0xfff0c8 : 0x555555); }
  }
}
