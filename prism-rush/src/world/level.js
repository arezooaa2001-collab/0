// Level systems: instanced rings (+magnet / scatter / moving), springs, dash pads, speed hoops, item capsules, checkpoints,
// cannons, portals, rails, loops / corkscrews / speed tubes, moving / rotating / vanishing / collapsing platforms, switches,
// pressure plates, timed doors, energy barriers, breakables, critter cages, collectibles, giant rings, homing balloons, zones.
import * as THREE from 'three';
import { G, bus } from '../game.js';
import { clamp, lerp, rng, canvasTex, UP } from '../util.js';
import { heightAt, normalAt, regionAt, REGION_BY_ID, ZONES } from './terrain.js';
import { addXP } from '../progress.js';

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), m4 = new THREE.Matrix4(), q1 = new THREE.Quaternion();
const RCELL = 16;
const rkey = (x, z) => ((Math.floor(x / RCELL) + 4096) << 13) | (Math.floor(z / RCELL) + 4096);

// ---------------------------------------------------------------- spline helper (rails & rides)
export class Path {
  constructor(points, ups, step = 1.2) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const L = curve.getLength(); const n = Math.max(2, Math.ceil(L / step));
    this.pts = curve.getSpacedPoints(n); this.ups = null;
    if (ups) { this.ups = []; for (let i = 0; i <= n; i++) { const f = (i / n) * (ups.length - 1); const a = Math.floor(f), b = Math.min(ups.length - 1, a + 1); this.ups.push(ups[a].clone().lerp(ups[b], f - a).normalize()); } }
    this.lens = [0]; for (let i = 1; i < this.pts.length; i++) this.lens.push(this.lens[i - 1] + this.pts[i].distanceTo(this.pts[i - 1]));
    this.length = this.lens[this.lens.length - 1]; this.seg = this.length / (this.pts.length - 1);
  }
  _i(s) { const f = clamp(s / this.seg, 0, this.pts.length - 1.0001); const i = Math.floor(f); return [i, f - i]; }
  pointAt(s, out) { const [i, t] = this._i(s); return out.copy(this.pts[i]).lerp(this.pts[i + 1], t); }
  tangentAt(s, out) { const [i] = this._i(s); return out.copy(this.pts[i + 1]).sub(this.pts[i]).normalize(); }
  upAt(s, out) { if (!this.ups) return out.set(0, 1, 0); const [i, t] = this._i(s); return out.copy(this.ups[i]).lerp(this.ups[i + 1], t).normalize(); }
  nearest(p) {
    let best = 1e9, bs = 0;
    for (let i = 0; i < this.pts.length - 1; i++) {
      const a = this.pts[i], b = this.pts[i + 1]; v1.copy(b).sub(a); const L2 = v1.lengthSq();
      const t = clamp(v2.copy(p).sub(a).dot(v1) / L2, 0, 1); v3.copy(a).addScaledVector(v1, t);
      const d = v3.distanceToSquared(p); if (d < best) { best = d; bs = this.lens[i] + t * Math.sqrt(L2); }
    }
    return { s: bs, d: Math.sqrt(best) };
  }
}

// ---------------------------------------------------------------- materials / geometries
function mats(p) {
  const S = (o) => (p.mat === 0 ? new THREE.MeshLambertMaterial(o) : new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.5, metalness: 0.2 }, o)));
  const chevron = canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#ff9a1a'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffe14a'; for (let i = 0; i < 2; i++) { g.beginPath(); const y = i * 64 + 10; g.moveTo(8, y + 40); g.lineTo(32, y + 8); g.lineTo(56, y + 40); g.lineTo(46, y + 48); g.lineTo(32, y + 26); g.lineTo(18, y + 48); g.fill(); } }, { repeat: true });
  return {
    ring: p.mat === 0 ? new THREE.MeshLambertMaterial({ color: 0xffc21a, emissive: 0x6a4a00 }) : new THREE.MeshStandardMaterial({ color: 0xffc83a, metalness: 1, roughness: 0.22, emissive: 0x7a5200, emissiveIntensity: 0.55 }),
    red: S({ color: 0xff2a4a, emissive: 0x8a0018, emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.25 }),
    springBase: S({ color: 0x3a3f4a, metalness: 0.7 }), springTop: S({ color: 0xff3b30, emissive: 0x400000 }), springTopY: S({ color: 0xffd21a, emissive: 0x403000 }), coil: S({ color: 0xc8ced8, metalness: 0.9, roughness: 0.3 }),
    pad: S({ map: chevron, emissive: 0xff7a00, emissiveIntensity: 0.6, emissiveMap: chevron }), padTex: chevron,
    hoop: S({ color: 0x3ab0ff, emissive: 0x0a4cff, emissiveIntensity: 0.9, metalness: 0.5 }),
    metal: S({ color: 0x8a919c, metalness: 0.8, roughness: 0.35 }), dark: S({ color: 0x30343c, metalness: 0.6 }),
    rail: S({ color: 0xd8dee8, metalness: 1, roughness: 0.18 }),
    track: S({ color: 0xe6e9ef, metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide, map: canvasTex(64, 64, (g) => { g.fillStyle = '#e8ebf0'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#2a8cff'; g.fillRect(0, 0, 8, 64); g.fillRect(56, 0, 8, 64); g.fillStyle = '#ffcc33'; g.fillRect(28, 0, 8, 32); }, { repeat: true }) }),
    tube: new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
    plat: S({ color: 0xd8c9a8, roughness: 0.8 }), platMove: S({ color: 0x5ac8ff, emissive: 0x0a3a6a, emissiveIntensity: 0.6 }), platVanish: S({ color: 0xb07cff, emissive: 0x3a1a6a, emissiveIntensity: 0.7, transparent: true }),
    platCollapse: S({ color: 0xc8a27a, roughness: 0.9 }), stone: S({ color: 0xbdb496, roughness: 0.9 }), wood: S({ color: 0xa8743a, roughness: 0.8 }), cage: S({ color: 0x9aa3ae, metalness: 0.8 }),
    barrier: new THREE.MeshBasicMaterial({ color: 0xff3a5a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    glowCyan: new THREE.MeshBasicMaterial({ color: 0x6af0ff }), glowGreen: new THREE.MeshBasicMaterial({ color: 0x4aff8a }), glowRed: new THREE.MeshBasicMaterial({ color: 0xff4a4a }), glowGold: new THREE.MeshBasicMaterial({ color: 0xffe14a }),
    capsule: S({ color: 0xffffff, transparent: true, opacity: 0.4, metalness: 0.1, roughness: 0.05 }),
    shard: p.mat === 0 ? new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x777777 }) : new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transmission: p.index >= 2 ? 0.5 : 0, thickness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.35 }),
    gold: S({ color: 0xffcc33, metalness: 1, roughness: 0.25 }), crystal: S({ color: 0x7cf3ff, emissive: 0x2a6aff, emissiveIntensity: 0.8, roughness: 0.1 }),
    building: S({ color: 0x9aa4b8, metalness: 0.5, roughness: 0.4 }),
    portal: new THREE.ShaderMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, uniforms: { uTime: { value: 0 }, uC: { value: new THREE.Color(0x9a6aff) } }, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ', fragmentShader: 'uniform float uTime; uniform vec3 uC; varying vec2 vUv; void main(){ vec2 p = vUv-0.5; float r = length(p)*2.0; float a = atan(p.y,p.x); float s = sin(a*5.0 - uTime*4.0 + r*12.0)*0.5+0.5; float al = smoothstep(1.0,0.6,r)*(0.35+0.65*s); gl_FragColor = vec4(uC*(1.2+s), al); }' }),
  };
}

const ICONS = { speed: '»', magnet: 'U', invinc: '✶', ringx2: '×2', xpx2: 'XP', slowmo: '◷', lowgrav: '⇡', shield: '◯', elecShield: 'ϟ', fireShield: '♨', waterShield: '≈', energy: '⚡', rings10: '◎' };
const ICON_COL = { speed: '#ff6a2a', magnet: '#ff3a8a', invinc: '#ffd21a', ringx2: '#ffc21a', xpx2: '#5aff8a', slowmo: '#9a8aff', lowgrav: '#7ad8ff', shield: '#7fd8ff', elecShield: '#ffe85a', fireShield: '#ff7a2a', waterShield: '#3a9bff', energy: '#5ae8ff', rings10: '#ffc21a' };

export class Level {
  constructor(scene, physics, preset) {
    this.scene = scene; this.physics = physics; this.group = new THREE.Group(); this.group.name = 'level'; scene.add(this.group);
    this.M = mats(preset); this.p = preset;
    this.rings = []; this.ringGrid = new Map(); this.objects = []; this.objGrid = new Map(); this.rails = []; this.rides = []; this.dynamic = [];
    this.gravityZones = []; this.checkpoint = null; this.collectibles = {}; this.homing = []; this.cages = [];
    this.time = 0; this.iconTex = {};
    // ring rendering
    this.bins = new Map(); this.always = new THREE.Group(); this.group.add(this.always);
    this.ringGeo = this.ringGeometry(preset);
    this.ringU = { uTime: { value: 0 } };
    const rm = this.M.ring; rm.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.ringU.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n#ifdef USE_INSTANCING\n float ra = uTime*3.0 + instanceMatrix[3][0]*0.21; float rc = cos(ra), rs = sin(ra); objectNormal.xz = mat2(rc,-rs,rs,rc)*objectNormal.xz;\n#endif')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n transformed.xz = mat2(rc,-rs,rs,rc)*transformed.xz;\n#endif');
    };
    this.flying = []; for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(this.ringGeo, rm); m.visible = false; this.group.add(m); this.flying.push({ m, active: false }); }
    this.scatter = []; for (let i = 0; i < 32; i++) { const m = new THREE.Mesh(this.ringGeo, rm); m.visible = false; this.group.add(m); this.scatter.push({ m, active: false, p: new THREE.Vector3(), v: new THREE.Vector3(), t: 0 }); }
    this.moving = [];
  }

  // ================================================================== rings
  addRing(x, y, z, opts = {}) {
    const r = { x, y, z, alive: true, t: 0, i: this.rings.length, move: opts.move || null, bx: x, by: y, bz: z };
    this.rings.push(r);
    if (r.move) this.moving.push(r);
    const k = rkey(x, z); let a = this.ringGrid.get(k); if (!a) this.ringGrid.set(k, (a = [])); a.push(r);
    return r;
  }
  ringLine(a, b, n, lift = 1.1, onTerrain = true) {
    for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); const x = lerp(a[0], b[0], t), z = lerp(a[a.length - 1], b[b.length - 1], t); const y = onTerrain ? heightAt(x, z) + lift : lerp(a[1], b[1], t) + lift; this.addRing(x, y, z); }
  }
  ringArc(a, b, n, height) { for (let i = 0; i < n; i++) { const t = i / (n - 1); const x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t); const y = lerp(heightAt(a[0], a[1]), heightAt(b[0], b[1]), t) + 1.2 + Math.sin(t * Math.PI) * height; this.addRing(x, y, z); } }
  ringCircle(cx, cy, cz, r, n, vertical = false, yaw = 0) {
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; if (vertical) this.addRing(cx + Math.cos(yaw) * Math.cos(a) * r, cy + Math.sin(a) * r, cz - Math.sin(yaw) * Math.cos(a) * r); else this.addRing(cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r); }
  }
  ringGeometry(p) { const lv = p.index === 0 ? [5, 10] : p.index === 1 ? [6, 16] : p.index < 9 ? [8, 20] : [10, 24]; return new THREE.TorusGeometry(0.55, 0.11, lv[0], lv[1]); }
  buildRingMesh() {
    if (this.ringMeshes) for (const im of this.ringMeshes) { this.group.remove(im); im.dispose(); }
    this.ringMeshes = []; const sect = new Map();
    for (const r of this.rings) { const k = Math.floor(r.bx / 100) + ':' + Math.floor(r.bz / 100) + ':' + Math.floor(r.by / 150); let a = sect.get(k); if (!a) sect.set(k, (a = [])); a.push(r); }
    for (const list of sect.values()) {
      const im = new THREE.InstancedMesh(this.ringGeo, this.M.ring, list.length); let cx = 0, cy = 0, cz = 0;
      list.forEach((r, k) => { r.m = im; r.k = k; m4.makeTranslation(r.x, r.y, r.z); im.setMatrixAt(k, m4); cx += r.bx; cy += r.by; cz += r.bz; });
      im.userData.c = new THREE.Vector3(cx / list.length, cy / list.length, cz / list.length); let rad = 0; for (const r of list) rad = Math.max(rad, Math.hypot(r.bx - im.userData.c.x, r.by - im.userData.c.y, r.bz - im.userData.c.z)); im.userData.r = rad + 12;
      for (const r of list) if (!r.alive) this.hideRing(r);
      im.castShadow = false; im.frustumCulled = false; im.instanceMatrix.needsUpdate = true; this.group.add(im); this.ringMeshes.push(im);
    }
  }
  hideRing(r) { m4.makeScale(0, 0, 0); r.m.setMatrixAt(r.k, m4); r.m.instanceMatrix.needsUpdate = true; }
  showRing(r) { m4.makeTranslation(r.x, r.y, r.z); r.m.setMatrixAt(r.k, m4); r.m.instanceMatrix.needsUpdate = true; }
  // spatial bins for distance culling (environmental LOD)
  place(o) {
    let c = o.position, r = 3;
    if (o.geometry) { const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); c = v3.copy(g.boundingSphere.center).add(o.position); r = g.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z); }
    if (r > 70) { this.always.add(o); return; }
    const k = Math.floor(c.x / 100) + ':' + Math.floor(c.z / 100) + ':' + Math.floor(c.y / 150);
    let b = this.bins.get(k);
    if (!b) { b = new THREE.Group(); b.userData = { s: new THREE.Vector3(), n: 0, c: new THREE.Vector3(), r: 0, pts: [] }; this.bins.set(k, b); this.group.add(b); }
    const u = b.userData; u.s.add(c); u.n++; u.c.copy(u.s).divideScalar(u.n); u.pts.push([c.x, c.y, c.z, r]);
    let rad = 0; for (const q of u.pts) rad = Math.max(rad, Math.hypot(q[0] - u.c.x, q[1] - u.c.y, q[2] - u.c.z) + q[3]); u.r = rad;
    b.add(o);
  }
  setPreset(p) {
    this.p = p; this.ringGeo.dispose(); this.ringGeo = this.ringGeometry(p);
    for (const f of this.flying) f.m.geometry = this.ringGeo; for (const s of this.scatter) s.m.geometry = this.ringGeo;
    this.buildRingMesh(); this.cullT = 0;
    const cs = p.shadow > 0 && p.index >= 2; for (const bn of this.bins.values()) bn.traverse((o) => { if (o.isMesh && o.userData.noShadow !== true) o.castShadow = cs; });
  }
  cull(cam) {
    const od = this.p.objDist, rd = this.p.ringDist;
    for (const b of this.bins.values()) b.visible = cam.distanceTo(b.userData.c) - b.userData.r < od;
    for (const im of this.ringMeshes) im.visible = cam.distanceTo(im.userData.c) - im.userData.r < rd;
  }
  takeRing(r, pl, fly) {
    r.alive = false; r.t = 75; this.hideRing(r);
    if (fly) { const f = this.flying.find((x) => !x.active); if (f) { f.active = true; f.m.visible = true; f.m.position.set(r.x, r.y, r.z); f.t = 0; return; } }
    this.gotRing(pl, v1.set(r.x, r.y, r.z));
  }
  gotRing(pl, pos) {
    pl.addRings(1, pos); G.fx.ringSparkle(pos);
    this.ringPan = -(this.ringPan || 1);
    G.audio.play('ring', { pan: this.ringPan * 0.35, pitch: 1 + Math.min(pl.combo, 40) * 0.004 });
  }
  collectRings(pl, h) {
    const p = pl.pos; const R = 1.35; const mag = pl.power.magnet > 0 || pl.shield === 'elec' ? 9 : pl.stats.magnet;
    const rr = Math.max(R, mag);
    const x0 = Math.floor((p.x - rr) / RCELL), x1 = Math.floor((p.x + rr) / RCELL), z0 = Math.floor((p.z - rr) / RCELL), z1 = Math.floor((p.z + rr) / RCELL);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const a = this.ringGrid.get(((ix + 4096) << 13) | (iz + 4096)); if (!a) continue;
      for (const r of a) {
        if (!r.alive) continue;
        const dx = r.x - p.x, dy = r.y - (p.y + 0.7), dz = r.z - p.z; const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < R * R) this.takeRing(r, pl, false); else if (d2 < mag * mag) this.takeRing(r, pl, true);
      }
    }
    // scattered rings can be recollected
    for (const s of this.scatter) if (s.active && s.t > 0.45 && s.p.distanceTo(v1.copy(p).setY(p.y + 0.6)) < 1.6) { s.active = false; s.m.visible = false; this.gotRing(pl, s.p); }
  }
  collectRingsAt(p, R) {
    const k = rkey(p.x, p.z); const a = this.ringGrid.get(k); if (!a) return;
    for (const r of a) if (r.alive && Math.abs(r.x - p.x) < R && Math.abs(r.z - p.z) < R && Math.abs(r.y - p.y - 0.7) < 2) this.takeRing(r, G.player, true);
  }
  scatterRings(p, n) {
    let k = 0;
    for (const s of this.scatter) {
      if (k >= n) break; if (s.active) continue; k++;
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.3, sp = 6 + Math.random() * 5;
      s.active = true; s.m.visible = true; s.t = 0; s.p.copy(p).y += 1; s.v.set(Math.cos(a) * sp, 8 + Math.random() * 6, Math.sin(a) * sp);
    }
  }

  // ================================================================== object registry
  addObj(o) {
    o.alive = o.alive !== false; o.r = o.r || 1.5; this.objects.push(o);
    const k = rkey(o.pos.x, o.pos.z); let a = this.objGrid.get(k); if (!a) this.objGrid.set(k, (a = [])); a.push(o);
    if (o.update) this.dynamic.push(o);
    return o;
  }
  near(p, R, out) {
    out.length = 0; const x0 = Math.floor((p.x - R) / RCELL), x1 = Math.floor((p.x + R) / RCELL), z0 = Math.floor((p.z - R) / RCELL), z1 = Math.floor((p.z + R) / RCELL);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) { const a = this.objGrid.get(((ix + 4096) << 13) | (iz + 4096)); if (a) for (const o of a) out.push(o); }
    return out;
  }
  mesh(geo, mat, x, y, z, opts = {}) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (opts.yaw) m.rotation.y = opts.yaw; if (opts.rot) m.rotation.copy(opts.rot);
    m.castShadow = opts.shadow !== false && this.p.shadow > 0 && this.p.index >= 2; m.receiveShadow = this.p.mat > 0; if (opts.parent) opts.parent.add(m); else this.place(m); return m;
  }
  icon(kind) {
    if (this.iconTex[kind]) return this.iconTex[kind];
    const t = canvasTex(128, 128, (g) => { g.fillStyle = ICON_COL[kind] || '#fff'; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ICONS[kind] || '?', 64, 68); });
    return (this.iconTex[kind] = t);
  }

  // ---------------------------------------------------------------- springs / pads / hoops
  spring(x, y, z, dir = [0, 1, 0], power = 26, opts = {}) {
    const d = new THREE.Vector3(...dir).normalize(); const g = new THREE.Group(); g.position.set(x, y, z);
    g.quaternion.setFromUnitVectors(UP, d); this.place(g);
    this.mesh(this.cyl(0.9, 0.9, 0.3, 16), this.M.springBase, 0, 0.15, 0, { parent: g });
    const coil = this.mesh(this.cyl(0.55, 0.55, 0.6, 10, true), this.M.coil, 0, 0.6, 0, { parent: g });
    const top = this.mesh(this.cyl(0.85, 0.85, 0.22, 16), power > 30 ? this.M.springTop : this.M.springTopY, 0, 0.95, 0, { parent: g });
    const pos = new THREE.Vector3(x, y, z).addScaledVector(d, 1);
    return this.addObj({ type: 'spring', pos, r: 1.4, dir: d, power, top, coil, g, cd: 0, lock: opts.lock ?? 0.4, update(dt) { this.cd -= dt; const k = clamp(this.cd * 4, 0, 1); this.top.position.y = 0.95 + Math.sin(k * Math.PI) * 0.5; }, hit(pl) { if (this.cd > 0) return; this.cd = 0.3; pl.pos.copy(this.pos); pl.spring(this.dir, this.power, this.lock); G.audio.play('spring'); G.fx.ring(this.pos, 0xffffff, 1.2); bus.emit('spring'); } });
  }
  dashPad(x, z, yaw, speed = 60, y) {
    y = y ?? heightAt(x, z);
    normalAt(x, z, v1); const m = this.mesh(new THREE.BoxGeometry(2.6, 0.12, 4), this.M.pad, x, y + 0.06, z);
    m.quaternion.setFromUnitVectors(UP, v1).multiply(q1.setFromAxisAngle(UP, yaw));
    const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    return this.addObj({ type: 'dashPad', pos: new THREE.Vector3(x, y, z), r: 2.1, dir, speed, cd: 0, update(dt) { this.cd -= dt; }, hit(pl) { if (this.cd > 0 || pl.mode !== 'ground') return; this.cd = 0.25; pl.dashPad(this.dir, this.speed); G.audio.play('dashPad'); G.fx.sonicBoom(pl.pos, this.dir, 0.5); G.level.chain(pl); bus.emit('dashPad'); } });
  }
  hoop(x, y, z, yaw, pitch = 0, speed = 55) {
    const m = this.mesh(new THREE.TorusGeometry(2.6, 0.22, 10, 36), this.M.hoop, x, y, z); m.rotation.set(pitch, yaw, 0, 'YXZ');
    const dir = new THREE.Vector3(0, 0, 1).applyEuler(m.rotation);
    return this.addObj({ type: 'hoop', pos: new THREE.Vector3(x, y, z), r: 2.7, dir, speed, m, cd: 0, update(dt) { this.cd -= dt; this.m.material.emissiveIntensity = 0.7 + 0.3 * Math.sin(G.time * 6); },
      hit(pl) { if (this.cd > 0) return; this.cd = 0.5; pl.vel.copy(this.dir).multiplyScalar(Math.max(this.speed, pl.vel.length())); if (pl.mode !== 'ride' && pl.mode !== 'rail') pl.setMode('air'); pl.springLock = 0.25; pl.ball = false; G.level.chain(pl); G.audio.play('dashPad', { pitch: 1.3 }); G.fx.sonicBoom(this.pos, this.dir, 0.8); bus.emit('hoop'); } });
  }
  chain(pl) {
    if (!pl.boosting) { pl.boostChain = 0; return; }
    pl.boostChain = G.time - (pl.lastChain ?? -9) < 4 ? pl.boostChain + 1 : 1; pl.lastChain = G.time;
    if (pl.boostChain >= 2) { pl.energy = Math.min(pl.stats.boostCap, pl.energy + 8 + pl.boostChain * 2); addXP(pl.boostChain * 2); G.hud.toast('boost_chain', 'good', { n: pl.boostChain }); }
  }
  bouncePad(x, z, power = 20) {
    const y = heightAt(x, z); const m = this.mesh(this.cyl(1.6, 1.8, 0.35, 20), this.M.platMove, x, y + 0.17, z);
    return this.addObj({ type: 'bounce', pos: new THREE.Vector3(x, y + 0.3, z), r: 1.9, power, m, cd: 0, update(dt) { this.cd -= dt; }, hit(pl) { if (this.cd > 0 || pl.vel.y > 2) return; this.cd = 0.25; pl.vel.y = this.power + Math.max(0, -pl.vel.y * 0.5); pl.setMode('air'); pl.ball = true; pl.jumps = 1; G.audio.play('bounce'); G.fx.ring(this.pos, 0x5ac8ff, 2); bus.emit('bounce'); } });
  }
  balloon(x, y, z) {
    const m = this.mesh(new THREE.SphereGeometry(0.9, 16, 12), this.M.springTop, x, y, z);
    const o = this.addObj({ type: 'balloon', pos: new THREE.Vector3(x, y, z), r: 1.2, m, dead: false, t: 0, update(dt) { if (this.dead) { this.t -= dt; if (this.t <= 0) { this.dead = false; this.m.visible = true; } } else this.m.position.y = this.pos.y + Math.sin(G.time * 2 + this.pos.x) * 0.3; },
      hit: null, yOff: 0 });
    o.homingHit = () => { if (o.dead) return; o.dead = true; o.t = 6; o.m.visible = false; G.audio.play('bounce', { pitch: 1.4 }); G.fx.burst(o.pos, 0xff3b30, 12, 6); return true; };
    this.homing.push(o); return o;
  }
  cyl(rt, rb, h, seg, open) { return new THREE.CylinderGeometry(rt, rb, h, Math.max(6, Math.round(seg * (this.p.index === 0 ? 0.6 : 1))), 1, !!open); }

  // ---------------------------------------------------------------- items / checkpoints
  capsule(x, y, z, kind) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.place(g);
    this.mesh(this.cyl(0.75, 0.75, 1.3, 6), this.M.capsule, 0, 0, 0, { parent: g, shadow: false });
    this.mesh(this.cyl(0.8, 0.8, 0.12, 6), this.M.metal, 0, -0.7, 0, { parent: g }); this.mesh(this.cyl(0.8, 0.8, 0.12, 6), this.M.metal, 0, 0.7, 0, { parent: g });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.icon(kind), depthWrite: false })); sp.scale.set(0.9, 0.9, 1); g.add(sp);
    return this.addObj({ type: 'capsule', pos: new THREE.Vector3(x, y, z), r: 1.3, kind, g, dead: 0, update(dt) { if (this.dead > 0) { this.dead -= dt; if (this.dead <= 0) this.g.visible = true; } this.g.rotation.y += dt * 1.2; this.g.position.y = this.pos.y + Math.sin(G.time * 2.5 + this.pos.x) * 0.15; },
      hit(pl) { if (this.dead > 0) return; this.dead = 60; this.g.visible = false; pl.givePower(this.kind); G.fx.burst(this.pos, 0xffffff, 16, 7); G.audio.play('itemPickup'); G.hud.toast('item_' + this.kind, 'good'); if (pl.mode === 'air') pl.bounceOff(); bus.emit('capsule', this.kind); } });
  }
  checkpointPost(x, z, yaw = 0, y) {
    y = y ?? heightAt(x, z);
    this.mesh(this.cyl(0.12, 0.15, 2.6, 8), this.M.metal, x, y + 1.3, z);
    const orb = this.mesh(new THREE.SphereGeometry(0.22, 12, 10), this.M.glowRed, x, y + 2.7, z);
    const o = this.addObj({ type: 'checkpoint', pos: new THREE.Vector3(x, y, z), r: 2.2, yaw, orb, on: false,
      hit(pl) { if (this.on && G.level.checkpoint === this.cp) return; G.level.setCheckpoint(this); } });
    o.cp = { pos: o.pos.clone(), yaw }; return o;
  }
  setCheckpoint(o) {
    for (const c of this.objects) if (c.type === 'checkpoint' && c !== o && c.on) { c.on = false; c.orb.material = this.M.glowRed; }
    o.on = true; o.orb.material = this.M.glowGreen; this.checkpoint = o.cp;
    G.save.checkpoint = { pos: o.pos.toArray(), yaw: o.yaw };
    G.audio.play('checkpoint'); G.fx.ring(o.pos, 0x4aff8a, 2.2); G.hud.toast('checkpoint', 'info'); bus.emit('checkpoint', o);
  }
  cannon(x, z, target, opts = {}) {
    const y = opts.y ?? heightAt(x, z); const tgt = new THREE.Vector3(...target);
    const g = new THREE.Group(); g.position.set(x, y, z); this.place(g);
    this.mesh(this.cyl(1.6, 1.9, 1.2, 16), this.M.dark, 0, 0.6, 0, { parent: g });
    const barrel = new THREE.Group(); barrel.position.y = 1.6; g.add(barrel);
    this.mesh(this.cyl(0.85, 1.05, 3.6, 16, true), this.M.metal, 0, 1.4, 0, { parent: barrel });
    this.mesh(new THREE.TorusGeometry(0.95, 0.15, 8, 20).rotateX(Math.PI / 2), this.M.springTopY, 0, 3.2, 0, { parent: barrel });
    const flight = opts.flight ?? clamp(tgt.distanceTo(g.position) / 55, 1.6, 6);
    const grav = 34 * (opts.grav ?? 1);
    const vel = new THREE.Vector3().subVectors(tgt, g.position).divideScalar(flight); vel.y += 0.5 * grav * flight * 1.12 * 0.89;
    const dir = vel.clone().normalize(); barrel.quaternion.setFromUnitVectors(UP, dir);
    const mouth = g.position.clone().add(new THREE.Vector3(0, 1.6, 0)).addScaledVector(dir, 3.3);
    return this.addObj({ type: 'cannon', pos: g.position.clone(), r: 3, interact: 'prompt_cannon', vel, flight, mouth,
      use(pl) { pl.cannon = { mouth: this.mouth.clone(), t: 0.6, launchVel: this.vel.clone(), flight: this.flight }; pl.setMode('cannon'); pl.container.visible = false; G.audio.play('switch'); bus.emit('cannon'); } });
  }
  portal(a, b, color = 0x9a6aff) {
    const mk = (p, other) => {
      const m = this.mesh(new THREE.CircleGeometry(2.2, 32), this.M.portal, p[0], p[1] + 2.3, p[2], { shadow: false }); m.rotation.y = p[3] || 0;
      this.mesh(new THREE.TorusGeometry(2.25, 0.18, 8, 32), this.M.metal, p[0], p[1] + 2.3, p[2], { yaw: p[3] || 0 });
      return this.addObj({ type: 'portal', pos: new THREE.Vector3(p[0], p[1] + 1, p[2]), r: 1.8, yaw: p[3] || 0, cd: 0, update(dt) { this.cd -= dt; },
        hit(pl) { if (this.cd > 0) return; const o = this.other; o.cd = 1.2; this.cd = 1.2; const f = new THREE.Vector3(Math.sin(o.yaw), 0, Math.cos(o.yaw));
          pl.pos.copy(o.pos).addScaledVector(f, 3).y -= 0.8; pl.prevPos.copy(pl.pos); const s = Math.max(pl.hSpeed(), 12); pl.vel.set(f.x * s, 2, f.z * s); pl.facing.copy(f); pl.setMode('air'); G.cam.snapBehind(pl); G.audio.play('teleport'); G.fx.burst(pl.pos, 0x9a6aff, 24, 8); bus.emit('portal'); } });
    };
    const A = mk(a), B = mk(b); A.other = B; B.other = A; return [A, B];
  }

  // ---------------------------------------------------------------- rails & rides
  railFrom(points, opts = {}) {
    const pts = points.map((p) => new THREE.Vector3(p[0], p.length > 3 ? p[1] : heightAt(p[0], p[p.length - 1]) + (opts.lift ?? 3), p[p.length - 1]));
    if (points[0].length === 3) for (let i = 0; i < pts.length; i++) pts[i].y = points[i][1];
    const path = new Path(pts, null, 1.0);
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path.pts.filter((_, i) => i % 2 === 0)), Math.ceil(path.length / 2), 0.11, this.p.index === 0 ? 5 : 8, false);
    this.mesh(tube, this.M.rail, 0, 0, 0);
    // supports
    for (let s = 6; s < path.length; s += opts.supportEvery ?? 14) {
      path.pointAt(s, v1); const gy = heightAt(v1.x, v1.z); const h = v1.y - gy - 0.15;
      if (h > 0.6 && h < 60 && !opts.noSupports) this.mesh(this.cyl(0.12, 0.16, h, 6), this.M.dark, v1.x, gy + h / 2, v1.z);
    }
    path.kind = 'rail'; this.rails.push(path);
    if (opts.rings !== false) for (let s = 4; s < path.length - 2; s += 4) { path.pointAt(s, v1); this.addRing(v1.x, v1.y + 1.2, v1.z); }
    return path;
  }
  findRail(p, vel) {
    let best = null, bd = 1.25;
    for (const r of this.rails) {
      const bb = r.bb || (r.bb = new THREE.Box3().setFromPoints(r.pts).expandByScalar(3));
      if (!bb.containsPoint(p)) continue;
      const n = r.nearest(p);
      if (n.d < bd) { r.pointAt(n.s, v1); if (p.y >= v1.y - 0.7 && (vel.y <= 3)) { bd = n.d; best = { rail: r, s: n.s }; } }
    }
    return best;
  }
  findParallelRail(p, side, cur) {
    let best = null, bd = 9;
    for (const r of this.rails) {
      if (r === cur) continue; const bb = r.bb; if (!bb || !bb.distanceToPoint(p) < 10) { /* fallthrough */ }
      const n = r.nearest(p); if (n.d > bd) continue; r.pointAt(n.s, v1); v2.copy(v1).sub(p);
      if (v2.dot(side) > 1.5 && Math.abs(v2.y) < 4) { bd = n.d; best = { rail: r, s: n.s }; }
    }
    return best;
  }
  addRide(path, kind, opts = {}) {
    path.kind = kind; path.minSpeed = opts.minSpeed ?? 18; path.autoSpeed = opts.autoSpeed || 0;
    path.entry = path.pts[0].clone(); path.entryDir = new THREE.Vector3().subVectors(path.pts[2], path.pts[0]).normalize();
    Object.assign(path, opts.extra || {});
    // ribbon mesh along the path using its up vectors
    if (kind !== 'tube') {
      const pos = [], uv = [], idx = []; const w = opts.width ?? 2.4; const t = new THREE.Vector3(), u = new THREE.Vector3(), s = new THREE.Vector3();
      for (let i = 0; i < path.pts.length; i++) {
        const P = path.pts[i]; path.tangentAt(path.lens[i], t); path.upAt(path.lens[i], u); s.crossVectors(t, u).normalize();
        const Q = P.clone().addScaledVector(u, -0.08);
        pos.push(Q.x - s.x * w, Q.y - s.y * w, Q.z - s.z * w, Q.x + s.x * w, Q.y + s.y * w, Q.z + s.z * w); uv.push(0, path.lens[i] / 4, 1, path.lens[i] / 4);
        if (i < path.pts.length - 1) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      this.mesh(g, this.M.track, 0, 0, 0);
    } else {
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path.pts.filter((_, i) => i % 3 === 0)), Math.ceil(path.length / 3), 2.6, 12, false);
      this.mesh(tube, this.M.tube, 0, 0, 0, { shadow: false });
      for (let d = 0; d < path.length; d += 9) { path.pointAt(d, v1); path.tangentAt(d, v2); const r = this.mesh(new THREE.TorusGeometry(2.7, 0.12, 6, 24), this.M.glowCyan, v1.x, v1.y, v1.z, { shadow: false }); r.lookAt(v1.clone().add(v2)); }
    }
    if (opts.rings !== false) for (let d = 6; d < path.length - 4; d += 5) { path.pointAt(d, v1); path.upAt(d, v2); this.addRing(v1.x + v2.x * 1.1, v1.y + v2.y * 1.1, v1.z + v2.z * 1.1); }
    this.rides.push(path); return path;
  }
  loop(x, z, yaw, radius = 9) {
    const y = heightAt(x, z); const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const pts = [], ups = []; const base = new THREE.Vector3(x, y, z).addScaledVector(f, -radius - 10);
    for (let i = 0; i <= 4; i++) { pts.push(base.clone().addScaledVector(f, i * 2.5)); ups.push(UP.clone()); }
    const c0 = base.clone().addScaledVector(f, 10); const center = c0.clone().add(new THREE.Vector3(0, radius, 0));
    const N = 48;
    for (let i = 1; i <= N; i++) { const a = (i / N) * Math.PI * 2; const p = c0.clone().addScaledVector(f, Math.sin(a) * radius).add(new THREE.Vector3(0, radius * (1 - Math.cos(a)), 0)).addScaledVector(side, (i / N) * 5.5); pts.push(p); ups.push(center.clone().addScaledVector(side, (i / N) * 5.5).sub(p).normalize()); }
    const exit = pts[pts.length - 1].clone(); for (let i = 1; i <= 5; i++) { pts.push(exit.clone().addScaledVector(f, i * 2.5)); ups.push(UP.clone()); }
    const path = new Path(pts, ups, 0.8);
    this.dashPad(base.x - f.x * 9, base.z - f.z * 9, yaw, 52);
    return this.addRide(path, 'loop', { minSpeed: 22, extra: { center: center.clone().addScaledVector(side, 2.75), side, radius } });
  }
  corkscrew(a, b, radius = 6, turns = 1) {
    const A = new THREE.Vector3(a[0], heightAt(a[0], a[1]), a[1]), B = new THREE.Vector3(b[0], heightAt(b[0], b[1]), b[1]);
    const axisDir = B.clone().sub(A); const L = axisDir.length(); axisDir.normalize();
    const side = new THREE.Vector3().crossVectors(axisDir, UP).normalize(); const up2 = new THREE.Vector3().crossVectors(side, axisDir).normalize();
    const pts = [], ups = []; const N = Math.ceil(L / 1.5);
    for (let i = 0; i <= N; i++) {
      const t = i / N; const phi = t * Math.PI * 2 * turns;
      const axis = A.clone().addScaledVector(axisDir, t * L).addScaledVector(up2, radius);
      const off = side.clone().multiplyScalar(Math.sin(phi) * radius).addScaledVector(up2, -Math.cos(phi) * radius);
      const p = axis.clone().add(off); pts.push(p); ups.push(off.clone().negate().normalize());
    }
    return this.addRide(new Path(pts, ups, 0.9), 'corkscrew', { minSpeed: 20 });
  }
  tubeRide(points, autoSpeed = 62) {
    const pts = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    return this.addRide(new Path(pts, null, 1.2), 'tube', { minSpeed: 0, autoSpeed });
  }
  findRide(p, heading, speed) {
    for (const r of this.rides) {
      if (Math.abs(r.entry.x - p.x) > 3.2 || Math.abs(r.entry.z - p.z) > 3.2 || Math.abs(r.entry.y - p.y) > 2.5) continue;
      if (heading.dot(r.entryDir) < 0.6) continue;
      if (speed < r.minSpeed) { if (!this._slowWarn || G.time - this._slowWarn > 3) { this._slowWarn = G.time; G.hud.toast('need_speed', 'info'); } continue; }
      return r;
    }
    return null;
  }

  // ---------------------------------------------------------------- platforms & puzzles
  box(x, y, z, sx, sy, sz, mat, opts = {}) {
    const m = this.mesh(new THREE.BoxGeometry(sx, sy, sz), mat || this.M.plat, x, y, z, { yaw: opts.yaw, shadow: opts.shadow });
    const c = this.physics.addBox({ x, y, z, hx: sx / 2, hy: sy / 2, hz: sz / 2, yaw: opts.yaw || 0, kind: opts.kind || 'solid', dynamic: !!opts.dynamic, surface: opts.surface || 'metal' });
    c.mesh = m; return c;
  }
  movingPlatform(a, b, size = [5, 0.8, 5], period = 6, opts = {}) {
    const c = this.box(a[0], a[1], a[2], size[0], size[1], size[2], this.M.platMove, { dynamic: true });
    return this.addObj({ type: 'movePlat', pos: new THREE.Vector3(...a), r: 0, c, a: new THREE.Vector3(...a), b: new THREE.Vector3(...b), period, phase: opts.phase || 0,
      update(dt) { const t = (Math.sin((G.time / this.period + this.phase) * Math.PI * 2) + 1) / 2; v1.lerpVectors(this.a, this.b, t); G.physics.moveTo(this.c, v1.x, v1.y, v1.z, undefined, dt); this.c.mesh.position.copy(v1); } });
  }
  rotatingPlatform(x, y, z, size = [12, 0.8, 3], speed = 0.6) {
    const c = this.box(x, y, z, size[0], size[1], size[2], this.M.platMove, { dynamic: true });
    return this.addObj({ type: 'rotPlat', pos: new THREE.Vector3(x, y, z), r: 0, c, speed, yaw: 0,
      update(dt) { this.yaw += this.speed * dt; G.physics.moveTo(this.c, this.pos.x, this.pos.y, this.pos.z, this.yaw, dt); this.c.mesh.rotation.y = this.yaw; } });
  }
  vanishPlatform(x, y, z, on = 2.5, off = 1.5, phase = 0) {
    const c = this.box(x, y, z, 4, 0.6, 4, this.M.platVanish.clone());
    return this.addObj({ type: 'vanish', pos: new THREE.Vector3(x, y, z), r: 0, c, on, off, phase,
      update() { const t = (G.time + this.phase) % (this.on + this.off); const vis = t < this.on; const warn = t > this.on - 0.6 && vis; this.c.active = vis; this.c.mesh.visible = vis; this.c.mesh.material.opacity = warn ? 0.4 + 0.4 * Math.sin(G.time * 30) : 0.95; } });
  }
  collapsePlatform(x, y, z) {
    const c = this.box(x, y, z, 4.5, 0.7, 4.5, this.M.platCollapse, { dynamic: true });
    return this.addObj({ type: 'collapse', pos: new THREE.Vector3(x, y, z), r: 0, c, t: -1, fall: 0,
      update(dt) {
        const pl = G.player;
        if (this.t < 0 && pl.groundC === this.c) { this.t = 0.6; G.audio.play('break', { vol: 0.4, pitch: 1.4 }); }
        if (this.t > 0) { this.t -= dt; this.c.mesh.position.x = this.pos.x + (Math.random() - 0.5) * 0.1; if (this.t <= 0) this.fall = 0.01; }
        if (this.fall > 0) { this.fall += dt; const y = this.pos.y - this.fall * this.fall * 14; G.physics.moveTo(this.c, this.pos.x, y, this.pos.z, undefined, dt); this.c.mesh.position.set(this.pos.x, y, this.pos.z); if (this.fall > 4) { this.fall = 0; this.t = -1; G.physics.moveTo(this.c, this.pos.x, this.pos.y, this.pos.z, undefined, 0); this.c.mesh.position.copy(this.pos); } }
      } });
  }
  door(x, z, yaw, w = 6, h = 7, opts = {}) {
    const y = opts.y ?? heightAt(x, z);
    const c = this.box(x, y + h / 2, z, w, h, 0.8, opts.barrier ? this.M.barrier : this.M.stone, { yaw, dynamic: true, shadow: !opts.barrier });
    const o = this.addObj({ type: opts.barrier ? 'barrier' : 'door', pos: new THREE.Vector3(x, y, z), r: 0, c, open: 0, target: 0, h, timer: 0, timed: opts.timed || 0, base: y + h / 2,
      update(dt) {
        if (this.timer > 0) { this.timer -= dt; if (this.timer <= 0 && this.timed) { this.target = 0; G.audio.play('doorOpen', { pitch: 0.7 }); } }
        this.open = lerp(this.open, this.target, 1 - Math.exp(-4 * dt));
        if (this.type === 'barrier') { this.c.active = this.open < 0.5; this.c.mesh.visible = this.open < 0.95; this.c.mesh.material.opacity = 0.35 * (1 - this.open); }
        else { const yy = this.base + this.open * (this.h + 0.2); G.physics.moveTo(this.c, this.pos.x, yy, this.pos.z, undefined, dt); this.c.mesh.position.y = yy; }
      },
      setOpen(v, time) { if (this.target !== (v ? 1 : 0)) G.audio.play('doorOpen'); this.target = v ? 1 : 0; this.timer = time || this.timed || 0; } });
    if (opts.interact) { o.interact = 'prompt_door'; o.r = 4; o.pos2 = o.pos; o.use = () => o.setOpen(true); }
    return o;
  }
  switchPost(x, z, onToggle, opts = {}) {
    const y = opts.y ?? heightAt(x, z);
    this.mesh(this.cyl(0.4, 0.5, 1.2, 10), this.M.dark, x, y + 0.6, z);
    const btn = this.mesh(new THREE.SphereGeometry(0.42, 14, 10), this.M.glowRed, x, y + 1.35, z);
    const o = this.addObj({ type: 'switch', pos: new THREE.Vector3(x, y + 1.2, z), r: 1.5, on: false, btn, cd: 0, yOff: 0, update(dt) { this.cd -= dt; },
      hit(pl) { if (this.cd > 0 || !pl.isAttacking()) return; this.toggle(pl); }, toggle(pl) { this.cd = 0.8; this.on = !this.on; this.btn.material = this.on ? G.level.M.glowGreen : G.level.M.glowRed; G.audio.play('switch'); onToggle && onToggle(this.on, this); bus.emit('switch', this); if (pl && pl.mode === 'air') pl.bounceOff(); } });
    o.homingHit = () => { o.toggle(G.player); return false; };
    this.homing.push(o); return o;
  }
  pressurePlate(x, z, onChange, opts = {}) {
    const y = opts.y ?? heightAt(x, z);
    const m = this.mesh(this.cyl(1.5, 1.6, 0.2, 18), this.M.metal, x, y + 0.1, z);
    const light = this.mesh(new THREE.TorusGeometry(1.2, 0.08, 6, 24).rotateX(Math.PI / 2), this.M.glowRed, x, y + 0.22, z, { shadow: false });
    return this.addObj({ type: 'plate', pos: new THREE.Vector3(x, y, z), r: 1.6, pressed: false, latched: false, m, light, stay: 0,
      update(dt) { this.stay -= dt; const was = this.pressed; this.pressed = this.stay > 0 || this.latched; if (was !== this.pressed) { this.light.material = this.pressed ? G.level.M.glowGreen : G.level.M.glowRed; this.m.position.y = this.pos.y + (this.pressed ? 0.02 : 0.1); onChange && onChange(this.pressed, this); if (this.pressed) G.audio.play('switch', { pitch: 0.8 }); } },
      hit(pl) { if (pl.mode === 'ground' || pl.mode === 'stomp') this.stay = 0.15; } });
  }
  breakable(x, z, kind = 'crate', opts = {}) {
    const y = opts.y ?? heightAt(x, z); const s = kind === 'rock' ? 3 : 1.4;
    const c = this.box(x, y + s / 2, z, s, s, s, kind === 'rock' ? this.M.stone : this.M.wood, { surface: kind === 'rock' ? 'rock' : 'grass' });
    if (kind === 'rock') { c.mesh.geometry.dispose(); c.mesh.geometry = new THREE.DodecahedronGeometry(s * 0.75, 0); }
    const o = this.addObj({ type: 'breakable', kind, pos: new THREE.Vector3(x, y + s / 2, z), r: s * 0.9, c, broken: false, reward: opts.reward,
      hit(pl) { if (this.broken) return; const ok = this.kind === 'rock' ? (pl.mode === 'stomp' || pl.prism || pl.boosting && pl.stats.special === 'climb') : pl.isAttacking(); if (ok) this.smash(pl); },
      smash(pl) { this.broken = true; this.c.active = false; this.c.mesh.visible = false; G.audio.play('break'); G.fx.burst(this.pos, this.kind === 'rock' ? 0x9a9088 : 0xc8904a, 22, 8, 0.4, 0.9, 20); addXP(3); bus.emit('break', this.kind);
        if (this.reward) G.level.spawnReward(this.reward, this.pos); else for (let i = 0; i < 3; i++) G.level.addTempRing(this.pos, i); } });
    return o;
  }
  smash(p, R, pl) { const list = this.near(p, R + 2, this._sm || (this._sm = [])); for (const o of list) if (o.type === 'breakable' && !o.broken && o.pos.distanceTo(p) < R + o.r) o.smash(pl); for (const o of list) if (o.type === 'cage' && !o.open && o.pos.distanceTo(p) < R + 1.5) o.free(); }
  addTempRing(p, i) { const s = this.scatter.find((x) => !x.active); if (!s) return; s.active = true; s.m.visible = true; s.t = 0.2; s.p.copy(p); s.v.set(Math.cos(i * 2.1) * 3, 7, Math.sin(i * 2.1) * 3); }
  spawnReward(r, p) { if (r === 'energy') G.player.givePower('energy'); else G.player.givePower(r); }
  cage(x, z, opts = {}) {
    const y = opts.y ?? heightAt(x, z); const g = new THREE.Group(); g.position.set(x, y, z); this.place(g);
    this.mesh(new THREE.BoxGeometry(1.6, 0.2, 1.6), this.M.dark, 0, 0.1, 0, { parent: g }); this.mesh(new THREE.BoxGeometry(1.6, 0.2, 1.6), this.M.dark, 0, 1.9, 0, { parent: g });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; this.mesh(this.cyl(0.05, 0.05, 1.8, 4), this.M.cage, Math.cos(a) * 0.72, 1, Math.sin(a) * 0.72, { parent: g }); }
    const critter = this.mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshStandardMaterial({ color: [0xffd84a, 0x7ad8ff, 0xff8ab0, 0x9aff7a][Math.floor(Math.random() * 4)] }), 0, 0.6, 0, { parent: g });
    const o = this.addObj({ type: 'cage', pos: new THREE.Vector3(x, y + 1, z), r: 1.4, g, critter, open: false, tag: opts.tag, fly: 0, yOff: 0,
      update(dt) { if (this.open && this.fly < 3) { this.fly += dt; this.critter.position.y = 0.6 + this.fly * 4; this.critter.position.x = Math.sin(this.fly * 6) * 0.6; if (this.fly >= 3) this.critter.visible = false; } else if (!this.open) this.critter.position.y = 0.6 + Math.abs(Math.sin(G.time * 4 + this.pos.x)) * 0.25; },
      hit(pl) { if (!this.open && pl.isAttacking()) { this.free(); if (pl.mode === 'air') pl.bounceOff(); } },
      free() { if (this.open) return; this.open = true; this.g.children.forEach((c) => { if (c !== this.critter) c.visible = false; }); G.audio.play('critterFree'); G.fx.burst(this.pos, 0xffffff, 16, 6); G.save.stats.critters++; addXP(15); bus.emit('critter', this); },
      reset() { this.open = false; this.fly = 0; this.critter.visible = true; this.g.children.forEach((c) => (c.visible = true)); } });
    o.homingHit = () => { o.free(); return true; };
    this.cages.push(o); this.homing.push(o); return o;
  }
  // unique collectible (saved): shard | red | key | crystal | token | chest | map
  collectible(kind, id, x, y, z, opts = {}) {
    const key = kind + '_' + id; this.collectibles[key] = { kind, x, y, z };
    if (G.save.found[key]) return null;
    let m;
    if (kind === 'red') m = this.mesh(new THREE.TorusGeometry(0.8, 0.16, 10, 28), this.M.red, x, y, z);
    else if (kind === 'shard') { m = this.mesh(new THREE.OctahedronGeometry(0.8, 0).scale(0.7, 1.3, 0.7), this.M.shard.clone(), x, y, z); m.material.emissive = new THREE.Color([0xff4a6a, 0xffa53a, 0xffe14a, 0x4aff8a, 0x3ad0ff, 0x6a7aff, 0xd06aff][id % 7]); }
    else if (kind === 'key') { m = new THREE.Group(); m.position.set(x, y, z); this.place(m); this.mesh(new THREE.TorusGeometry(0.35, 0.09, 8, 16), this.M.gold, 0, 0.45, 0, { parent: m }); this.mesh(new THREE.BoxGeometry(0.14, 0.8, 0.14), this.M.gold, 0, -0.1, 0, { parent: m }); this.mesh(new THREE.BoxGeometry(0.3, 0.12, 0.12), this.M.gold, 0.1, -0.35, 0, { parent: m }); }
    else if (kind === 'crystal') m = this.mesh(new THREE.OctahedronGeometry(0.45, 0).scale(0.6, 1.4, 0.6), this.M.crystal, x, y, z);
    else if (kind === 'token') m = this.mesh(this.cyl(0.6, 0.6, 0.12, 24).rotateX(Math.PI / 2), this.M.springTop, x, y, z);
    else if (kind === 'map') m = this.mesh(this.cyl(0.25, 0.25, 1.2, 10).rotateZ(Math.PI / 2), this.M.wood, x, y, z);
    else if (kind === 'chest') {
      m = new THREE.Group(); m.position.set(x, y, z); this.place(m);
      this.mesh(new THREE.BoxGeometry(1.4, 0.8, 0.9), this.M.wood, 0, 0.4, 0, { parent: m }); const lid = this.mesh(new THREE.BoxGeometry(1.45, 0.3, 0.95), opts.locked ? this.M.gold : this.M.wood, 0, 0.95, 0, { parent: m }); m.lid = lid;
      this.physics.addBox({ x, y: y + 0.5, z, hx: 0.75, hy: 0.5, hz: 0.5 });
    }
    const o = this.addObj({ type: 'collect', kind, key, pos: new THREE.Vector3(x, y, z), r: kind === 'chest' ? 2.5 : 1.3, m, got: false, opts, interact: kind === 'chest' ? (opts.locked ? 'prompt_chest_locked' : 'prompt_chest') : null,
      update(dt) { if (this.got) return; if (this.kind !== 'chest') { this.m.rotation.y += dt * 2; this.m.position.y = this.pos.y + Math.sin(G.time * 2 + this.pos.x) * 0.2; } },
      hit(pl) { if (this.kind === 'chest' || this.got) return; G.level.grab(this, pl); },
      use(pl) { if (this.got) return; if (this.opts.locked) { if (G.save.keys <= 0) { G.hud.toast('need_key', 'warn'); return; } G.save.keys--; } this.m.lid.rotation.x = -1.2; this.m.lid.position.z = -0.4; G.level.grab(this, pl); } });
    return o;
  }
  grab(o, pl) {
    o.got = true; G.save.found[o.key] = Date.now(); if (o.kind !== 'chest') o.m.visible = false;
    const k = o.kind;
    if (k === 'red') { G.save.wallet += 100; G.audio.play('shardGet', { pitch: 1.3 }); }
    else if (k === 'shard') { G.audio.play('shardGet'); G.fx.explosion(o.pos, 0xffffff, 1); pl.celebrate('celebrate', 2); }
    else if (k === 'key') { G.save.keys++; G.audio.play('itemPickup'); }
    else if (k === 'crystal') { G.save.crystals++; G.save.wallet += 50; G.audio.play('shardGet', { pitch: 1.6, vol: 0.6 }); }
    else if (k === 'token') { G.save.tokens++; G.audio.play('itemPickup', { pitch: 1.2 }); }
    else if (k === 'map') { const reg = regionAt(o.pos.x, o.pos.z); G.save.maps[reg.id] = 1; G.audio.play('itemPickup'); }
    else if (k === 'chest') { const amt = o.opts.locked ? 1000 : 300; G.save.wallet += amt; G.audio.play('achievement'); G.fx.burst(o.pos, 0xffd21a, 30, 8); G.hud.toast('chest_reward', 'good', { n: amt }); }
    addXP(k === 'shard' ? 200 : k === 'chest' ? 80 : 30);
    G.hud.toast('got_' + k, 'good', { n: G.progress.countFound(k) });
    bus.emit('collect', { kind: k, key: o.key });
    G.progress.checkAchievements(); G.progress.tryUnlocks();
  }
  award(kind, id) {
    const key = kind + '_' + id; this.collectibles[key] = this.collectibles[key] || { kind };
    if (G.save.found[key]) return;
    const o = { kind, key, pos: G.player.pos.clone(), opts: {}, m: { visible: true } };
    this.grab(o, G.player);
  }
  giantRing(x, y, z, id) {
    const m = this.mesh(new THREE.TorusGeometry(3.6, 0.5, 12, 40), this.M.ring, x, y, z);
    const o = this.addObj({ type: 'giant', pos: new THREE.Vector3(x, y, z), r: 3.4, m, id, cd: 0, update(dt) { this.cd -= dt; this.m.rotation.y += dt * 1.5; if (Math.random() < 0.1) G.fx.ringSparkle(v1.copy(this.pos).add(v2.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, 0))); },
      hit(pl) { if (this.cd > 0) return; this.cd = 3; bus.emit('giantRing', this); } });
    return o;
  }
  gravityZone(x, y, z, r, mul) { const m = this.mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshBasicMaterial({ color: 0xb07cff, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.BackSide }), x, y, z, { shadow: false }); this.gravityZones.push({ p: new THREE.Vector3(x, y, z), r, mul, m }); }
  gravityAt(p) { for (const z of this.gravityZones) if (p.distanceTo(z.p) < z.r) return z.mul; return 1; }
  sign(x, z, yaw, color = '#ff3a8a') {
    const y = heightAt(x, z);
    const tex = canvasTex(256, 64, (g) => { g.fillStyle = '#101624'; g.fillRect(0, 0, 256, 64); g.fillStyle = color; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(i * 36, 10); g.lineTo(i * 36 + 20, 32); g.lineTo(i * 36, 54); g.lineTo(i * 36 + 10, 54); g.lineTo(i * 36 + 30, 32); g.lineTo(i * 36 + 10, 10); g.fill(); } }, { repeat: true });
    this.mesh(this.cyl(0.12, 0.12, 4, 6), this.M.metal, x - Math.cos(yaw) * 1.6, y + 2, z + Math.sin(yaw) * 1.6); this.mesh(this.cyl(0.12, 0.12, 4, 6), this.M.metal, x + Math.cos(yaw) * 1.6, y + 2, z - Math.sin(yaw) * 1.6);
    const m = this.mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }), x, y + 3.6, z, { yaw, shadow: false });
    this.addObj({ type: 'sign', pos: new THREE.Vector3(x, y, z), r: 0, tex, update(dt) { this.tex.offset.x -= dt * 0.8; } });
    return m;
  }
  gear(x, y, z, r, speed, axis = 'z', hurt = false) {
    const g = new THREE.Group(); g.position.set(x, y, z); this.place(g);
    this.mesh(this.cyl(r, r, 0.8, 20).rotateX(Math.PI / 2), this.M.metal, 0, 0, 0, { parent: g });
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; this.mesh(new THREE.BoxGeometry(r * 0.3, r * 0.3, 0.8), this.M.metal, Math.cos(a) * r, Math.sin(a) * r, 0, { parent: g }).rotation.z = a; }
    this.addObj({ type: 'gear', pos: g.position.clone(), r: hurt ? r : 0, g, speed, axis, update(dt) { this.g.rotation[this.axis] += this.speed * dt; }, hit: hurt ? (pl) => pl.hurt(g.position) : null });
  }
  piston(x, z, y0, h, period = 3, phase = 0) {
    const c = this.box(x, y0 + h, z, 4, 1.2, 4, this.M.dark, { dynamic: true });
    this.mesh(this.cyl(0.5, 0.5, h + 4, 10), this.M.metal, x, y0 + h + 2, z);
    return this.addObj({ type: 'piston', pos: new THREE.Vector3(x, y0, z), r: 2.6, c, y0, h, period, phase,
      update(dt) { const t = ((G.time + this.phase) % this.period) / this.period; const k = t < 0.15 ? 1 - t / 0.15 : t < 0.55 ? 0 : (t - 0.55) / 0.45; const y = this.y0 + 0.6 + k * this.h; G.physics.moveTo(this.c, this.pos.x, y, this.pos.z, undefined, dt); this.c.mesh.position.y = y; this.down = t < 0.15 && this.c.vy < -5; },
      hit(pl) { if (this.down && pl.pos.y < this.c.y && pl.pos.y > this.y0 - 0.5 && Math.abs(pl.pos.x - this.pos.x) < 2.2 && Math.abs(pl.pos.z - this.pos.z) < 2.2) pl.hurt(this.pos); } });
  }
  homingTargets(list) { for (const o of this.homing) if (!o.dead && !o.open && o.pos.distanceTo(G.player.pos) < 30) list.push(o.__t || (o.__t = { pos: o.pos, yOff: 0, get dead() { return o.dead || o.open; }, hit: () => o.homingHit() })); }

  // ================================================================== per step / per frame
  triggers(pl, h) {
    const list = this.near(pl.pos, 6, this._tl || (this._tl = []));
    let prompt = null, pd = 1e9;
    for (const o of list) {
      if (!o.alive) continue;
      const d = o.pos.distanceTo(v1.copy(pl.pos).setY(pl.pos.y + 0.6));
      if (o.hit && d < o.r) o.hit(pl);
      if (o.interact && !o.got && d < (o.r || 3) + 1.5 && d < pd) { pd = d; prompt = o; }
    }
    this.promptObj = prompt;
  }
  interact(pl) {
    if (G.missions && G.missions.interact(pl)) return;
    const o = this.promptObj; if (o && o.use) { o.use(pl); G.audio.play('uiClick'); }
  }
  update(dt, pl) {
    this.time += dt; this.ringU.uTime.value = G.time;
    this.cullT = (this.cullT || 0) - dt; if (this.cullT <= 0) { this.cullT = 0.15; this.cull(G.camera.position); }
    for (const o of this.dynamic) o.update(dt);
    if (this.M.portal) this.M.portal.uniforms.uTime.value = G.time;
    this.M.padTex.offset.y -= dt * 1.5;
    // ring respawn
    this.respawnT = (this.respawnT || 0) - dt;
    if (this.respawnT <= 0) {
      this.respawnT = 1;
      for (const r of this.rings) if (!r.alive) { r.t -= 1; if (r.t <= 0 && Math.hypot(r.x - pl.pos.x, r.z - pl.pos.z) > 50) { r.alive = true; this.showRing(r); } }
    }
    // moving rings
    for (const r of this.moving) {
      const m = r.move; const t = G.time * m.speed + m.phase;
      r.x = r.bx + Math.sin(t) * m.ax; r.y = r.by + Math.sin(t * 1.3) * m.ay; r.z = r.bz + Math.cos(t) * m.az;
      if (r.alive) this.showRing(r);
    }
    // flying (magnet) rings
    for (const f of this.flying) {
      if (!f.active) continue; f.t += dt;
      v1.copy(pl.container.position).y += 0.7; v2.copy(v1).sub(f.m.position); const d = v2.length();
      f.m.position.addScaledVector(v2.normalize(), Math.min(d, (18 + f.t * 40) * dt));
      if (d < 0.8 || f.t > 1.5) { f.active = false; f.m.visible = false; this.gotRing(pl, f.m.position); }
    }
    // scattered rings bounce
    for (const s of this.scatter) {
      if (!s.active) continue; s.t += dt; s.v.y -= 30 * dt; s.p.addScaledVector(s.v, dt);
      const th = heightAt(s.p.x, s.p.z) + 0.5; if (s.p.y < th) { s.p.y = th; s.v.y = Math.abs(s.v.y) * 0.55; s.v.x *= 0.8; s.v.z *= 0.8; }
      s.m.position.copy(s.p); s.m.rotation.y += dt * 8; s.m.visible = s.t < 3.5 || Math.floor(s.t * 12) % 2 === 0;
      if (s.t > 5) { s.active = false; s.m.visible = false; }
    }
    // region / zone detection
    let reg = null;
    for (const k in ZONES) { const z = ZONES[k]; if (v1.fromArray(z.c).distanceTo(pl.pos) < z.r * 1.4 && pl.pos.y > z.c[1] - 120) { reg = { id: k, zone: true, music: k === 'special' ? 'special' : k, weather: k === 'moon' ? ['clear'] : ['clear', 'cloudy'], fog: k === 'moon' ? 0x05060c : 0xcde8ff, tier: 3 }; break; } }
    if (!reg) reg = regionAt(pl.pos.x, pl.pos.z);
    if (!G.region || G.region.id !== reg.id) {
      G.region = reg; if (!reg.zone && !G.save.regions[reg.id]) { G.save.regions[reg.id] = Date.now(); bus.emit('regionDiscovered', reg); addXP(100); }
      bus.emit('regionEnter', reg);
    }
    if (G.sky) G.sky.space = clamp((pl.pos.y - 450) / 250, 0, 1);
    if (G.hud) G.hud.setPrompt(this.promptObj ? this.promptObj.interact : null);
  }
  totals() {
    const c = { shard: 0, red: 0, chest: 0, key: 0, token: 0, crystal: 0, map: 0 };
    for (const k in this.collectibles) c[this.collectibles[k].kind]++;
    return c;
  }
}
