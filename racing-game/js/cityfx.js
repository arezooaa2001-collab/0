// جزئیات زنده شهر آزاد: پرنده‌ها، کبوترها، پروانه‌ها، نور چراغ‌ها در شب، سکه‌های جمع‌کردنی،
// دود دودکش، فواره، آتش‌بازی، نور جلوی ماشین‌ها و سایه نرم زیر عابرها. همه با Instancing و کمترین هزینه.
import * as THREE from 'three';
import { mulberry32, TAU, clamp, lerp, damp, toFa } from './utils.js';
import { Particles, Rain } from './effects.js';
import * as T from './textures.js';

export const WIND = { uTime: { value: 0 } };

// تکان خوردن درخت‌ها با باد (در شیدر، بدون هزینه CPU)
export function windify(mat, amt = 0.14, height = 6) {
  const prev = mat.onBeforeCompile; const key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : 'std';
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    sh.uniforms.uWindT = WIND.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWindT;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { float hh = max(0.0, position.y - 1.4) / ${height.toFixed(1)}; hh *= hh; float ph = 0.0;
          #ifdef USE_INSTANCING
          ph = instanceMatrix[3].x * 0.071 + instanceMatrix[3].z * 0.053;
          #endif
          float w = sin(uWindT * 1.25 + ph) * 0.65 + sin(uWindT * 2.9 + ph * 1.7 + position.x * 1.3) * 0.3;
          transformed.x += w * ${amt.toFixed(3)} * hh; transformed.z += cos(uWindT * 1.05 + ph * 1.3) * ${(amt * 0.6).toFixed(3)} * hh; }`);
  };
  mat.customProgramCacheKey = () => key + '-wind';
  mat.needsUpdate = true;
}

// هندسه بال‌دار (پرنده، کبوتر، پروانه): بال‌ها در شیدر بال می‌زنند
function wingGeo(kind) {
  const pos = [], wing = [], col = [];
  const tri = (a, b, c, wa, wb, wc, cc) => { pos.push(...a, ...b, ...c); wing.push(wa, wb, wc); for (let k = 0; k < 3; k++) col.push(...cc); };
  if (kind === 'butterfly') {
    const c1 = [1, 1, 1], c2 = [0.85, 0.85, 0.85];
    for (const s of [1, -1]) { tri([0, 0, 0.03], [s * 0.11, 0, 0.09], [s * 0.13, 0, -0.01], 0, s, s, c1); tri([0, 0, -0.01], [s * 0.1, 0, -0.02], [s * 0.07, 0, -0.09], 0, s, s, c2); }
    tri([0, 0.006, 0.05], [0.008, 0, -0.06], [-0.008, 0, -0.06], 0, 0, 0, [0.1, 0.1, 0.1]);
  } else {
    const body = kind === 'pigeon' ? [0.62, 0.64, 0.7] : [0.18, 0.18, 0.2]; const wc = kind === 'pigeon' ? [0.55, 0.57, 0.63] : [0.14, 0.14, 0.16];
    const L = kind === 'pigeon' ? 0.17 : 0.28, Wd = kind === 'pigeon' ? 0.26 : 0.42;
    // بدن (منشور ساده)
    const b = [[0, 0.04, L], [0.04, 0, 0], [-0.04, 0, 0], [0, 0.05, -L * 0.6], [0, -0.035, 0]];
    tri(b[0], b[1], b[3], 0, 0, 0, body); tri(b[0], b[3], b[2], 0, 0, 0, body); tri(b[0], b[2], b[4], 0, 0, 0, body); tri(b[0], b[4], b[1], 0, 0, 0, body); tri(b[1], b[4], b[3], 0, 0, 0, body); tri(b[2], b[3], b[4], 0, 0, 0, body);
    // سر
    tri([0, 0.07, L + 0.03], [0.03, 0.03, L - 0.02], [-0.03, 0.03, L - 0.02], 0, 0, 0, kind === 'pigeon' ? [0.35, 0.5, 0.45] : body);
    // بال‌ها و دم
    for (const s of [1, -1]) { tri([s * 0.03, 0.03, L * 0.35], [s * Wd, 0.02, -L * 0.05], [s * 0.03, 0.03, -L * 0.3], 0, s, 0, wc); tri([s * Wd, 0.02, -L * 0.05], [s * Wd * 0.55, 0.02, -L * 0.45], [s * 0.03, 0.03, -L * 0.3], s, s * 0.6, 0, wc); }
    tri([0, 0.04, -L * 0.5], [0.06, 0.03, -L * 1.1], [-0.06, 0.03, -L * 1.1], 0, 0, 0, wc);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals(); return g;
}
function wingMaterial(flapSpeed, amp, fold) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
  const u = { uT: WIND.uTime };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = u.uT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aWing; attribute float iFly; uniform float uT;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3;
          float fl = iFly; float a = sin(uT * ${flapSpeed.toFixed(1)} * (0.85 + fract(ph) * 0.3) + ph) * ${amp.toFixed(2)} * fl;
          float wv = abs(aWing);
          transformed.x *= mix(1.0, mix(${fold.toFixed(2)}, 1.0, fl), wv);
          transformed.y += wv * a * abs(transformed.x) * 1.3;
        }`);
  };
  m.customProgramCacheKey = () => 'wing' + flapSpeed + amp + fold;
  return m;
}
export class Flock {
  constructor(scene, n, kind, { flap = 14, amp = 0.9, fold = 1, scale = 1 } = {}) {
    this.n = n; this.geo = wingGeo(kind); this.fly = new Float32Array(n).fill(1);
    this.geo.setAttribute('iFly', new THREE.InstancedBufferAttribute(this.fly, 1));
    this.mesh = new THREE.InstancedMesh(this.geo, wingMaterial(flap, amp, fold), n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.castShadow = false;
    if (kind === 'butterfly') { const c = new THREE.Color(); const cols = [0xff8c1a, 0xffd23f, 0x5aa9ff, 0xff5fa2, 0xffffff, 0x9b5de5]; for (let i = 0; i < n; i++) this.mesh.setColorAt(i, c.setHex(cols[i % cols.length])); }
    scene.add(this.mesh);
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(0, 0, 0, 'YXZ'); this.s = new THREE.Vector3(scale, scale, scale);
  }
  set(i, p, yaw, pitch = 0, roll = 0) { this.e.set(pitch, yaw, roll); this.q.setFromEuler(this.e); this.m4.compose(p, this.q, this.s); this.mesh.setMatrixAt(i, this.m4); }
  done() { this.mesh.instanceMatrix.needsUpdate = true; this.geo.attributes.iFly.needsUpdate = true; }
}

export class CityFX {
  constructor(game) {
    this.g = game; const W = game.world; const scene = game.scene; const q = game.app.engine.qualityName;
    this.q = q; this.rng = mulberry32(2024); const rng = this.rng; this.t = 0;
    const lite = q === 'low';
    // ---------- پرنده‌های آسمان ----------
    this.birds = new Flock(scene, lite ? 14 : 36, 'bird', { flap: 11, amp: 0.8 });
    this.birdData = Array.from({ length: this.birds.n }, (_, i) => ({ c: new THREE.Vector3((rng() - 0.5) * 500, 0, (rng() - 0.5) * 500), R: 25 + rng() * 60, h: 28 + rng() * 40, a: rng() * TAU, sp: (0.25 + rng() * 0.3) * (rng() < 0.5 ? 1 : -1), glide: rng() * 10 }));
    // ---------- کبوترهای میدان (با نزدیک شدن پرواز می‌کنند) ----------
    const plaza = W.fountain ? W.fountain.pos : new THREE.Vector3();
    this.pigeons = new Flock(scene, lite ? 10 : 24, 'pigeon', { flap: 18, amp: 1.1, fold: 0.25 });
    this.pigeonData = Array.from({ length: this.pigeons.n }, () => { const a = rng() * TAU, r = 9 + rng() * 9; const home = new THREE.Vector3(plaza.x + Math.cos(a) * r, 0.15, plaza.z + Math.sin(a) * r); return { home, p: home.clone(), yaw: rng() * TAU, state: 'ground', t: rng() * 3, peck: rng() * 6, v: new THREE.Vector3(), fly: 0 }; });
    // ---------- پروانه‌ها در شهربازی و باغچه‌ها ----------
    const pc = W.park ? W.park.center : plaza;
    this.butterflies = new Flock(scene, lite ? 10 : 30, 'butterfly', { flap: 26, amp: 1.4 });
    this.bfData = Array.from({ length: this.butterflies.n }, (_, i) => { const base = i % 3 === 0 ? plaza : pc; const a = rng() * TAU, r = rng() * 9; return { c: new THREE.Vector3(base.x + Math.cos(a) * r, 0.8, base.z + Math.sin(a) * r), ph: rng() * 20, sp: 0.6 + rng() * 0.6 }; });
    // ---------- نور زیر چراغ‌های خیابان در شب ----------
    const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.35, 'rgba(255,190,110,0.55)'); gr.addColorStop(1, 'rgba(255,170,80,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    this.glowTex = glowTex;
    const lamps = W.lamps; const nL = lamps.length;
    const pool = new THREE.PlaneGeometry(1, 1); pool.rotateX(-Math.PI / 2);
    this.pools = new THREE.InstancedMesh(pool, new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -4 }), nL);
    const cone = new THREE.ConeGeometry(1, 1, 18, 1, true); cone.translate(0, -0.5, 0);
    const coneMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uC: { value: new THREE.Color(0xffd29a) } },
      vertexShader: 'varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uC; varying vec2 vUv; varying float vF; void main(){ float a = pow(vF, 2.5) * pow(1.0 - vUv.y, 1.4) * 0.16; gl_FragColor = vec4(uC * a, a); }' });
    this.cones = new THREE.InstancedMesh(cone, coneMat, nL);
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3();
    lamps.forEach((l, i) => {
      const gy = W.groundAt(l.pos.x, l.pos.z) + 0.03;
      m4.compose(new THREE.Vector3(l.pos.x, gy, l.pos.z), q4.identity(), s4.set(10, 1, 10)); this.pools.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(l.pos.x, l.h + 0.02, l.pos.z), q4.identity(), s4.set(3.2, l.h - 0.1, 3.2)); this.cones.setMatrixAt(i, m4);
    });
    for (const im of [this.pools, this.cones]) { im.frustumCulled = false; im.renderOrder = 3; im.visible = false; scene.add(im); }
    this.lampState = lamps.map(() => true);
    // ---------- سکه‌های جمع‌کردنی ----------
    const coinG = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 28); coinG.rotateX(Math.PI / 2);
    const rimG = new THREE.TorusGeometry(0.42, 0.045, 8, 28);
    const coinGeo = (() => { const a = coinG.toNonIndexed(), b = rimG.toNonIndexed(); const g = new THREE.BufferGeometry(); const pa = [...a.attributes.position.array, ...b.attributes.position.array], na = [...a.attributes.normal.array, ...b.attributes.normal.array]; g.setAttribute('position', new THREE.Float32BufferAttribute(pa, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(na, 3)); return g; })();
    const spots = [];
    for (const lp of W.walkLoops) { const k = (rng() * lp.length) | 0; const a = lp[k], b = lp[(k + 1) % lp.length]; const u = 0.2 + rng() * 0.6; spots.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u), 5]); }
    for (const r of W.ramps) spots.push([r.x + Math.sin(r.yaw) * (r.l / 2 + 5), r.z + Math.cos(r.yaw) * (r.l / 2 + 5), 25, r.h + 2.2]);
    for (let k = 0; k < 10; k++) { const a = rng() * TAU; spots.push([pc.x + Math.cos(a) * 61, pc.z + Math.sin(a) * 61, 5]); }
    this.coins = spots.map(([x, z, val, hy]) => ({ p: new THREE.Vector3(x, (hy || 0) + W.groundAt(x, z) + 1.0, z), val, on: true, t: 0 }));
    this.coinMesh = new THREE.InstancedMesh(coinGeo, new THREE.MeshStandardMaterial({ color: 0xf5c518, metalness: 1, roughness: 0.22, emissive: 0x5a3c00, emissiveIntensity: 0.6 }), this.coins.length);
    this.coinMesh.castShadow = !lite; this.coinMesh.frustumCulled = false; this.coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(this.coinMesh);
    // ---------- دود دودکش‌ها، فواره، آتش‌بازی ----------
    this.chimney = new Particles(scene, lite ? 120 : 260, { drag: 0.4, grow: 0.7 });
    this.chimneyT = 0; this.nearHouses = [];
    this.fountainT = 0; this.fwT = 4;
    // ---------- سایه نرم زیر عابرها ----------
    const blob = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const bg = new THREE.PlaneGeometry(0.9, 0.9); bg.rotateX(-Math.PI / 2);
    this.blobs = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), game.peds.length);
    this.blobs.frustumCulled = false; this.blobs.renderOrder = 2; this.blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(this.blobs);
    // ---------- نور جلوی ماشین‌های ترافیک در شب ----------
    const beam = new THREE.ConeGeometry(2.6, 16, 14, 1, true); beam.rotateX(-Math.PI / 2); beam.translate(0, 0.65, 10.2);
    this.beams = new THREE.InstancedMesh(beam, new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), game.traffic.length + 2);
    this.beams.frustumCulled = false; this.beams.visible = false; this.beams.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(this.beams);
    // راهنمای چشمک‌زن ماشین‌ها هنگام پیچیدن
    this.blink = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffa21a, toneMapped: false }), game.traffic.length * 2);
    this.blink.frustumCulled = false; this.blink.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(this.blink);
    this._v = new THREE.Vector3(); this._v2 = new THREE.Vector3(); this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(1, 1, 1); this._c = new THREE.Color();
  }

  scare(p, r = 9) { for (const d of this.pigeonData) if (d.state === 'ground' && d.p.distanceTo(p) < r) this.flyOff(d, p); }
  flyOff(d, from) { d.state = 'fly'; d.t = 0; const dx = d.p.x - from.x, dz = d.p.z - from.z; const L = Math.hypot(dx, dz) || 1; d.v.set(dx / L * 6, 5 + Math.random() * 2, dz / L * 6); d.yaw = Math.atan2(dx, dz); if (Math.random() < 0.3) this.g.sfx('whoosh'); }

  update(dt, t) {
    const g = this.g; const W = g.world; this.t += dt; WIND.uTime.value = t;
    const pl = g.playerWorldPos(this._v2); const night = g.night;
    // پرنده‌ها
    const B = this.birds;
    this.birdData.forEach((d, i) => {
      d.a += d.sp * dt; const x = d.c.x + Math.cos(d.a) * d.R, z = d.c.z + Math.sin(d.a) * d.R; const y = d.h + Math.sin(t * 0.4 + i) * 3;
      const yaw = Math.atan2(-Math.sin(d.a) * d.sp, Math.cos(d.a) * d.sp);
      B.fly[i] = (Math.sin(t * 0.3 + d.glide) > 0.3) ? 0.15 : 1;
      B.set(i, this._v.set(x, y, z), yaw, 0, -Math.sign(d.sp) * 0.35);
    });
    B.done();
    // کبوترها
    const P = this.pigeons; const speedy = g.state === 'drive' ? Math.abs(g.veh.vf) > 3 : g.p.speed > 3.2;
    this.pigeonData.forEach((d, i) => {
      d.t += dt;
      if (d.state === 'ground') {
        const dist = d.p.distanceTo(pl);
        if (dist < (speedy ? 7 : 2.6)) this.flyOff(d, pl);
        d.peck += dt; const pk = Math.max(0, Math.sin(d.peck * 4)) ** 6;
        if (Math.random() < dt * 0.4) d.yaw += (Math.random() - 0.5) * 1.6;
        if (Math.random() < dt * 0.25) { d.p.x += Math.sin(d.yaw) * 0.25; d.p.z += Math.cos(d.yaw) * 0.25; }
        d.fly = damp(d.fly, 0, 8, dt); P.fly[i] = d.fly;
        P.set(i, this._v.set(d.p.x, d.p.y + Math.abs(Math.sin(d.peck * 9)) * 0.01, d.p.z), d.yaw, pk * 0.7);
      } else {
        d.fly = 1; P.fly[i] = 1;
        if (d.t < 2.2) { d.v.y = Math.max(0.5, d.v.y - dt * 1.5); d.p.addScaledVector(d.v, dt); }
        else { // دور زدن و برگشتن به خانه
          const to = this._v.copy(d.home).sub(d.p); const L = to.length();
          if (d.t > 12 && L < 0.6) { d.state = 'ground'; d.p.copy(d.home); d.t = 0; }
          else { const want = d.t > 12 ? to.normalize().multiplyScalar(Math.min(5, L * 1.5)) : this._v.set(Math.cos(t * 0.6 + i) * 5, Math.sin(t + i) * 0.5 + (d.p.y < 8 ? 1 : -0.3), Math.sin(t * 0.6 + i) * 5); d.v.lerp(want, Math.min(1, dt * 2)); d.p.addScaledVector(d.v, dt); if (d.t > 12 && L < 3) d.p.y = Math.max(d.home.y, d.p.y - dt * 2); }
        }
        d.yaw = Math.atan2(d.v.x, d.v.z);
        P.set(i, d.p, d.yaw, -clamp(d.v.y * 0.08, -0.4, 0.4));
      }
    });
    P.done();
    // پروانه‌ها
    const BF = this.butterflies;
    this.bfData.forEach((d, i) => {
      const tt = t * d.sp + d.ph; const x = d.c.x + Math.sin(tt * 0.7) * 2.2 + Math.sin(tt * 1.9) * 0.6, z = d.c.z + Math.cos(tt * 0.6) * 2.2 + Math.cos(tt * 2.3) * 0.5;
      const y = d.c.y + Math.sin(tt * 1.3) * 0.4 + Math.abs(Math.sin(tt * 6)) * 0.08;
      const yaw = Math.atan2(Math.cos(tt * 0.7), -Math.sin(tt * 0.6));
      BF.set(i, this._v.set(x, y, z), yaw);
    });
    BF.done();
    // سکه‌ها: چرخش و جمع کردن
    const cm = this.coinMesh;
    this.coins.forEach((c, i) => {
      if (!c.on) { c.t -= dt; if (c.t <= 0) c.on = true; this._m.makeScale(0, 0, 0); cm.setMatrixAt(i, this._m); return; }
      const d = Math.hypot(c.p.x - pl.x, c.p.z - pl.z), dy = Math.abs(c.p.y - (pl.y + 1));
      if (d < (g.state === 'drive' ? 2.6 : 1.4) && dy < 2.2) { c.on = false; c.t = 120; g.addCoins(c.val, c.val > 5 ? `سکه طلایی ویژه! +${toFa(c.val)} سکه 🌟` : `+${toFa(c.val)} سکه 🪙`); g.burstSparkle(c.p); }
      this._q.setFromAxisAngle(this._v.set(0, 1, 0), t * 2.4 + i); this._m.compose(this._v.set(c.p.x, c.p.y + Math.sin(t * 2 + i) * 0.15, c.p.z), this._q, this._s.set(c.val > 5 ? 1.6 : 1, c.val > 5 ? 1.6 : 1, c.val > 5 ? 1.6 : 1)); cm.setMatrixAt(i, this._m);
    });
    cm.instanceMatrix.needsUpdate = true;
    // نور چراغ‌ها در شب
    this.pools.visible = this.cones.visible = night;
    if (night) {
      let ch = false;
      W.lamps.forEach((l, i) => { if (l.on !== this.lampState[i]) { this.lampState[i] = l.on; ch = true; const gy = W.groundAt(l.pos.x, l.pos.z) + 0.03; const k = l.on ? 1 : 0; this._m.compose(this._v.set(l.pos.x, gy, l.pos.z), this._q.identity(), this._s.set(10 * k, 1, 10 * k)); this.pools.setMatrixAt(i, this._m); this._m.compose(this._v.set(l.pos.x, l.h + 0.02, l.pos.z), this._q.identity(), this._s.set(3.2 * k, (l.h - 0.1) * (k || 0.001), 3.2 * k)); this.cones.setMatrixAt(i, this._m); } });
      if (ch) { this.pools.instanceMatrix.needsUpdate = true; this.cones.instanceMatrix.needsUpdate = true; }
    }
    // نور جلوی ماشین‌ها
    this.beams.visible = night;
    if (night) { let k = 0; for (const c of g.traffic) { if (!c.model.root.visible) { this._m.makeScale(0, 0, 0); } else { c.model.root.updateMatrix(); this._m.copy(c.model.root.matrix); } this.beams.setMatrixAt(k++, this._m); } for (const v of g.vehicles) { if (k >= this.beams.count) break; if (v === g.veh && !v.isBike) { v.model.root.updateMatrix(); this._m.copy(v.model.root.matrix); } else this._m.makeScale(0, 0, 0); this.beams.setMatrixAt(k++, this._m); } while (k < this.beams.count) { this._m.makeScale(0, 0, 0); this.beams.setMatrixAt(k++, this._m); } this.beams.instanceMatrix.needsUpdate = true; }
    // راهنما: سمت پیچ با چشمک نارنجی
    { const on = Math.sin(t * 9) > 0; let k = 0;
      for (const c of g.traffic) {
        const tr = c.turn; let side = 0;
        if (tr && !tr.straight && on && c.model.root.visible) { const a0 = Math.atan2(tr.p1.x - tr.p0.x, tr.p1.z - tr.p0.z), a1 = Math.atan2(tr.p2.x - tr.p1.x, tr.p2.z - tr.p1.z); let da = a1 - a0; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; side = da > 0 ? 1 : -1; }
        const sh = c.model.shape; const fx = Math.sin(c.heading), fz = Math.cos(c.heading), lx = Math.cos(c.heading), lz = -Math.sin(c.heading);
        for (const zz of [1, -1]) {
          if (side) { const off = side * (sh.W / 2 - 0.05); this._m.compose(this._v.set(c.pos.x + fx * zz * (sh.L / 2 - 0.08) + lx * off, 0.72, c.pos.z + fz * zz * (sh.L / 2 - 0.08) + lz * off), this._q.identity(), this._s.set(1, 1, 1)); }
          else this._m.makeScale(0, 0, 0);
          this.blink.setMatrixAt(k++, this._m);
        }
      }
      this.blink.instanceMatrix.needsUpdate = true; }
    // سایه نرم زیر عابرها
    const bl = this.blobs;
    g.peds.forEach((w, i) => { this._m.compose(this._v.set(w.pos.x, w.pos.y + 0.02, w.pos.z), this._q.identity(), this._s.set(1, 1, 1)); bl.setMatrixAt(i, this._m); });
    bl.instanceMatrix.needsUpdate = true;
    // دود دودکش‌های نزدیک
    this.chimneyT -= dt;
    if (this.chimneyT <= 0) { this.chimneyT = 1.5; this.nearHouses = W.houses.filter((h) => !h.busy && Math.hypot(h.cx - pl.x, h.cz - pl.z) < 150 && h.id % 3 !== 1).slice(0, 8); }
    for (const h of this.nearHouses) if (Math.random() < dt * 2.2) { const p = h.toWorld(3.2, 6.35, -1.5); const gc = (night ? 0.35 : 0.82) + Math.random() * 0.08; this.chimney.emit(p, this._v.set(0.35 + (Math.random() - 0.5) * 0.3, 0.8 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3), this._c.setRGB(gc, gc, gc), 0.7, 5 + Math.random() * 2, 0.28); }
    this.chimney.update(dt, g.app.engine.renderer.domElement.height);
    // فواره میدان
    const f = W.fountain;
    if (f && f.pos.distanceTo(pl) < 150) {
      const wc = this._c.setRGB(0.82, 0.92, 1);
      for (let k = 0; k < 3; k++) g.fx.water.emit(this._v.set(f.pos.x, f.pos.y + 0.25, f.pos.z), this._v2.set((Math.random() - 0.5) * 0.5, 6.5 + Math.random() * 0.8, (Math.random() - 0.5) * 0.5), wc, 0.16, 1.45, 0.6);
      if (Math.random() < 0.9) { const a = Math.random() * TAU; const R = f.r - 0.4; g.fx.water.emit(this._v.set(f.pos.x + Math.cos(a) * R, 0.75, f.pos.z + Math.sin(a) * R), this._v2.set(-Math.cos(a) * 2.2, 3.2, -Math.sin(a) * 2.2), wc, 0.12, 1.2, 0.5); }
      g.playerWorldPos(this._v2);
    }
    // آتش‌بازی شبانه بالای شهربازی
    if (night && W.park && W.park.center.distanceTo(pl) < 650) {
      this.fwT -= dt;
      if (this.fwT <= 0) { this.fwT = 2.5 + Math.random() * 4; const c = W.park.center; const p = new THREE.Vector3(c.x + (Math.random() - 0.5) * 80, 55 + Math.random() * 35, c.z + (Math.random() - 0.5) * 80); g.effects.firework(p); const d = p.distanceTo(pl); g.timers.push({ t: d / 340, fn: () => { g.app.audio.thump(clamp(0.6 - d / 1400, 0.1, 0.5)); g.app.audio.pop(); } }); }
    }
  }
}

// پرنده‌های آسمان برای پیست مسابقه
export function skyBirds(scene, n, center, spread = 600) {
  const rng = mulberry32(77); const F = new Flock(scene, n, 'bird', { flap: 11, amp: 0.8 }); const v = new THREE.Vector3();
  const data = Array.from({ length: n }, () => ({ c: new THREE.Vector3(center.x + (rng() - 0.5) * spread, 0, center.z + (rng() - 0.5) * spread), R: 30 + rng() * 70, h: 35 + rng() * 45, a: rng() * TAU, sp: (0.2 + rng() * 0.3) * (rng() < 0.5 ? 1 : -1), gl: rng() * 10 }));
  return { mesh: F.mesh, update(t, dt) { data.forEach((d, i) => { d.a += d.sp * dt; F.fly[i] = Math.sin(t * 0.3 + d.gl) > 0.3 ? 0.15 : 1; F.set(i, v.set(d.c.x + Math.cos(d.a) * d.R, d.h + Math.sin(t * 0.4 + i) * 3, d.c.z + Math.sin(d.a) * d.R), Math.atan2(-Math.sin(d.a) * d.sp, Math.cos(d.a) * d.sp), 0, -Math.sign(d.sp) * 0.35); }); F.done(); } };
}

// آب و هوا: باران یا طوفان با رعد و برق، آسمان ابری و نور کمتر
export class Weather {
  constructor(app, scene, outdoor, kind) {
    this.app = app; this.kind = kind; this.outdoor = outdoor; this.flash = 0; this.on = kind === 'rain' || kind === 'storm';
    if (!this.on) return;
    const lite = app.engine.qualityName === 'low';
    this.rain = new Rain(scene, (kind === 'storm' ? 2600 : 1600) * (lite ? 0.5 : 1) | 0);
    this.rain.wind = kind === 'storm' ? 5 : 1.6;
    this.scene = scene; this.applyLook();
    if (kind === 'storm') this.rain.flashT = 4;
  }
  // بعد از هر تغییر نور (مثلاً شب شدن) دوباره هوا را ابری و تاریک‌تر می‌کند
  applyLook() {
    if (!this.on) return; const o = this.outdoor; const kind = this.kind;
    const u = o.sky.material.uniforms; u.cloudAmt.value = kind === 'storm' ? 1.7 : 1.3; u.cloudBright.value = 0.5; u.sunColor.value.multiplyScalar(kind === 'storm' ? 0.12 : 0.3); u.topColor.value.lerp(new THREE.Color(0x5a636d), 0.6); u.horizonColor.value.lerp(new THREE.Color(0x8a939c), 0.6);
    o.sun.intensity *= kind === 'storm' ? 0.22 : 0.38; o.hemi.intensity *= 0.8; this.hemiBase = o.hemi.intensity;
    const f = this.scene.fog; f.color.lerp(new THREE.Color(0x8d969e), 0.5); f.near *= 0.5; f.far *= 0.45;
    this.app.engine.renderer.toneMappingExposure *= 0.88;
  }
  update(dt, cam, ground) {
    if (!this.on) return;
    this.rain.update(dt, cam.position, ground, () => { this.flash = 1; this.app.audio.thunder(); if (this.kind === 'storm') this.rain.flashT *= 0.5; });
    this.flash = Math.max(0, this.flash - dt * 3.5);
    const fl = this.flash > 0.6 || (this.flash > 0.2 && this.flash < 0.35) ? this.flash : 0;
    this.outdoor.hemi.intensity = this.hemiBase + fl * 3;
    this.app.engine.finalPass.uniforms.uFlash.value = Math.max(this.app.engine.finalPass.uniforms.uFlash.value, fl * 0.45);
    this.app.audio.setRain(this.kind === 'storm' ? 1 : 0.7);
  }
  dispose() { this.rain?.dispose(); this.app.audio.setRain(0); }
}
