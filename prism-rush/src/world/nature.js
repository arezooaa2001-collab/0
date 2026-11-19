// Vegetation (instanced, sectored, wind-animated), GPU grass + flowers, rocks, ocean / river / lava / waterfall shaders, clouds.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, clamp, lerp } from '../util.js';
import { noise2 } from '../noise.js';
import { WORLD, REGIONS, RIVER, FLATS, heightAt, normalAt, regionAt, waterLevelAt, heightTexture, riverSurfaceAtParam } from './terrain.js';
import { G } from '../game.js';

const windUniforms = { uTime: { value: 0 }, uWind: { value: 0.3 } };
function windify(mat, amount = 0.05) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windUniforms.uTime; sh.uniforms.uWind = windUniforms.uWind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 ip = vec3(0.0);
      #endif
      float sw = sin(uTime*1.6 + ip.x*0.13 + ip.z*0.11) + 0.5*sin(uTime*3.1 + ip.z*0.3);
      float hgt = max(0.0, position.y);
      transformed.x += sw * (0.3+uWind) * ${amount.toFixed(3)} * hgt;
      transformed.z += sw * (0.3+uWind) * ${(amount * 0.6).toFixed(3)} * hgt;`);
  };
  return mat;
}
function colorGeo(g, hex) {
  const c = new THREE.Color(hex); const n = g.attributes.position.count; const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const v = 0.85 + ((i * 7919) % 100) / 100 * 0.3; a[i * 3] = c.r * v; a[i * 3 + 1] = c.g * v; a[i * 3 + 2] = c.b * v; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const nonIndexed = (g) => (g.index ? g.toNonIndexed() : g);

// ---- vegetation geometry library (detail-scaled) ----
function lib(q) {
  const s = q < 0.3 ? 0 : q < 0.8 ? 1 : 2;
  const seg = [5, 7, 10][s], det = [0, 1, 1][s];
  const L = {};
  const trunk = (h, r) => colorGeo(new THREE.CylinderGeometry(r * 0.7, r, h, seg).translate(0, h / 2, 0), 0x6b4a2e);
  const blob = (r, x, y, z, col) => colorGeo(nonIndexed(new THREE.IcosahedronGeometry(r, det)).scale(1, 0.85, 1).translate(x, y, z), col);
  L.round = { parts: [[trunk(3.2, 0.32), 'bark'], [mergeGeometries([blob(2.2, 0, 4.4, 0, 0x4f9a35), blob(1.6, 1.2, 3.8, 0.4, 0x5cab3d), blob(1.5, -1.0, 4.0, -0.6, 0x468c2f)]), 'leaf']], r: 0.45, h: 6 };
  L.pine = { parts: [[trunk(2.2, 0.28), 'bark'], [mergeGeometries([0, 1, 2].map((i) => colorGeo(nonIndexed(new THREE.ConeGeometry(2.3 - i * 0.6, 3.0, seg + 1)).translate(0, 2.6 + i * 1.6, 0), [0x2c5e2a, 0x34692e, 0x3d7533][i]))), 'leaf']], r: 0.4, h: 7 };
  L.snowpine = { parts: [[trunk(2.2, 0.28), 'bark'], [mergeGeometries([0, 1, 2].flatMap((i) => [colorGeo(nonIndexed(new THREE.ConeGeometry(2.3 - i * 0.6, 3.0, seg + 1)).translate(0, 2.6 + i * 1.6, 0), 0x2f5a3a), colorGeo(nonIndexed(new THREE.ConeGeometry(1.6 - i * 0.45, 1.3, seg + 1)).translate(0, 3.6 + i * 1.6, 0), 0xf2f6ff)])), 'leaf']], r: 0.4, h: 7 };
  const palmTrunk = []; for (let i = 0; i < 6; i++) palmTrunk.push(colorGeo(new THREE.CylinderGeometry(0.22, 0.28, 1.2, seg).translate(i * 0.12, 0.6 + i * 1.1, 0), i % 2 ? 0x8a6a42 : 0x7a5a36));
  const fronds = []; for (let i = 0; i < 7; i++) { const g = new THREE.ConeGeometry(0.5, 3.6, 3).rotateZ(Math.PI / 2 + 0.5).translate(1.7, 6.4, 0).rotateY((i / 7) * Math.PI * 2); fronds.push(colorGeo(nonIndexed(g), 0x3f9a3a)); }
  L.palm = { parts: [[mergeGeometries(palmTrunk), 'bark'], [mergeGeometries(fronds), 'leaf']], r: 0.35, h: 7 };
  const cac = [colorGeo(new THREE.CylinderGeometry(0.42, 0.48, 4, seg).translate(0, 2, 0), 0x4b8a45), colorGeo(new THREE.CylinderGeometry(0.28, 0.3, 1.6, seg).translate(0, 0.8, 0).rotateZ(-0.0).translate(0.9, 1.6, 0), 0x52914a), colorGeo(new THREE.CylinderGeometry(0.26, 0.28, 1.3, seg).translate(-0.85, 2.3, 0), 0x52914a), colorGeo(new THREE.BoxGeometry(0.9, 0.22, 0.22).translate(0.45, 1.5, 0), 0x4b8a45), colorGeo(new THREE.BoxGeometry(0.85, 0.2, 0.2).translate(-0.42, 2.0, 0), 0x4b8a45)];
  L.cactus = { parts: [[mergeGeometries(cac.map(nonIndexed)), 'plain']], r: 0.5, h: 4 };
  const dead = [trunk(3.4, 0.25)]; for (let i = 0; i < 4; i++) dead.push(colorGeo(new THREE.CylinderGeometry(0.06, 0.12, 1.6, 4).translate(0, 0.8, 0).rotateZ(0.9).rotateY(i * 1.7).translate(0, 2 + i * 0.4, 0), 0x3a2a22));
  L.dead = { parts: [[mergeGeometries(dead.map(nonIndexed)), 'bark']], r: 0.3, h: 4 };
  L.crystal = { parts: [[mergeGeometries([0, 1, 2, 3].map((i) => colorGeo(nonIndexed(new THREE.OctahedronGeometry(0.8, 0)).scale(0.6, 2.4 - i * 0.3, 0.6).rotateZ((i - 1.5) * 0.35).rotateY(i * 1.6).translate(Math.cos(i * 1.6) * 0.5, 1.6, Math.sin(i * 1.6) * 0.5), [0x7cf3ff, 0xb38cff, 0x6ad8ff, 0xd59cff][i]))), 'crystal']], r: 0.8, h: 3.5 };
  L.bush = { parts: [[mergeGeometries([blob(1.1, 0, 0.8, 0, 0x3f8c32), blob(0.9, 0.8, 0.6, 0.3, 0x4a9a3a), blob(0.8, -0.7, 0.6, -0.2, 0x3a7f2e)]), 'leaf']], r: 0, h: 1.6 };
  L.column = { parts: [[mergeGeometries([colorGeo(new THREE.CylinderGeometry(0.75, 0.85, 7, seg + 3).translate(0, 3.5, 0), 0xcfc6a8), colorGeo(new THREE.BoxGeometry(2, 0.5, 2).translate(0, 7.2, 0), 0xbdb496), colorGeo(new THREE.BoxGeometry(2, 0.5, 2).translate(0, 0.25, 0), 0xbdb496)].map(nonIndexed)), 'stone']], r: 0.95, h: 7.5 };
  const rk = nonIndexed(new THREE.DodecahedronGeometry(1.6, det)); const rp = rk.attributes.position;
  for (let i = 0; i < rp.count; i++) { const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i); const n = 1 + noise2(x * 1.3 + z, y * 1.3) * 0.22; rp.setXYZ(i, x * n * 1.2, y * n * 0.75, z * n); }
  rk.computeVertexNormals();
  L.rock = { parts: [[colorGeo(rk, 0x8b857a), 'stone']], r: 1.4, h: 2 };
  return L;
}

const REGION_VEG = {
  meadow: [['round', 0.55], ['bush', 0.35], ['rock', 0.1]],
  forest: [['pine', 0.55], ['round', 0.3], ['bush', 0.25], ['rock', 0.08]],
  desert: [['cactus', 0.4], ['rock', 0.35], ['palm', 0.04]],
  snow: [['snowpine', 0.6], ['rock', 0.3]],
  volcano: [['dead', 0.35], ['rock', 0.55]],
  coast: [['palm', 0.6], ['bush', 0.2], ['rock', 0.15]],
  city: [['round', 0.05]],
  ruins: [['column', 0.18], ['round', 0.3], ['rock', 0.35], ['bush', 0.2]],
  canyon: [['crystal', 0.3], ['rock', 0.55], ['dead', 0.1]],
  fortress: [['rock', 0.2]],
};
const REGION_DENSITY = { meadow: 1, forest: 3.2, desert: 0.5, snow: 1.3, volcano: 0.6, coast: 1.1, city: 0.05, ruins: 0.9, canyon: 0.8, fortress: 0.1 };

const SECT = 12, SECT_SIZE = (WORLD.half * 2) / SECT;

export class Nature {
  constructor(scene, preset, physics) {
    this.scene = scene; this.physics = physics; this.group = new THREE.Group(); this.group.name = 'nature'; scene.add(this.group);
    this.sectors = []; this.colliders = [];
    this.buildWater(preset);
    this.setPreset(preset, true);
  }
  materials(p) {
    const M = p.mat === 0 ? THREE.MeshLambertMaterial : THREE.MeshStandardMaterial;
    const opt = (o) => (p.mat === 0 ? { vertexColors: true, ...o, roughness: undefined, metalness: undefined, emissiveIntensity: o.emissiveIntensity } : { vertexColors: true, roughness: 0.85, ...o });
    const clean = (o) => { for (const k in o) if (o[k] === undefined) delete o[k]; return o; };
    return {
      bark: new M(clean(opt({}))),
      leaf: windify(new M(clean(opt({ roughness: 0.75 }))), 0.035),
      plain: new M(clean(opt({}))),
      stone: new M(clean(opt({ roughness: 0.95 }))),
      crystal: new M(clean(opt({ roughness: 0.15, metalness: 0.1, emissive: new THREE.Color(0x3a5cff), emissiveIntensity: 0.45, transparent: true, opacity: 0.9 }))),
    };
  }
  setPreset(p, first) {
    this.p = p;
    // clear previous
    for (const s of this.sectors) for (const m of s.meshes) { this.group.remove(m); m.dispose(); }
    this.sectors = [];
    if (this.mats) for (const k in this.mats) this.mats[k].dispose();
    this.mats = this.materials(p);
    const L = lib(p.charQ);
    const r = rng(2024);
    const buckets = new Map(); // sectorIndex -> type -> matrices
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), nrm = new THREE.Vector3();
    const total = Math.floor(9000 * p.veg);
    const addCol = first && this.colliders.length === 0;
    for (let i = 0; i < total; i++) {
      const x = (r() * 2 - 1) * (WORLD.half - 40), z = (r() * 2 - 1) * (WORLD.half - 40);
      const reg = regionAt(x, z); const dens = REGION_DENSITY[reg.id] || 0.5;
      if (r() > dens / 3.2) continue;
      const h = heightAt(x, z); if (h < waterLevelAt(x, z) + 1.2) continue;
      normalAt(x, z, nrm); if (nrm.y < 0.8) continue;
      let skip = false; for (const f of FLATS) if (Math.hypot(x - f.x, z - f.z) < f.r + 6) { skip = true; break; }
      if (skip) continue;
      if (Math.hypot(x, z) < 70) continue;
      // keep a clear corridor along the river
      const opts = REGION_VEG[reg.id]; let roll = r(), type = null;
      for (const [t, w] of opts) { if (roll < w) { type = t; break; } roll -= w; }
      if (!type) continue;
      const s = (0.75 + r() * 0.6) * (type === 'rock' ? 0.6 + r() * 1.4 : 1);
      q.setFromAxisAngle(up, r() * Math.PI * 2);
      if (type === 'rock') q.multiply(new THREE.Quaternion().setFromUnitVectors(up, nrm));
      pos.set(x, h - 0.15, z); sc.set(s, s * (0.85 + r() * 0.3), s);
      m4.compose(pos, q, sc);
      const si = Math.min(SECT - 1, Math.floor((x + WORLD.half) / SECT_SIZE)) + Math.min(SECT - 1, Math.floor((z + WORLD.half) / SECT_SIZE)) * SECT;
      let b = buckets.get(si); if (!b) buckets.set(si, (b = {}));
      (b[type] ||= []).push(m4.clone());
      if (addCol && L[type].r > 0) this.colliders.push(this.physics.addCyl({ x, y: h + L[type].h * s * 0.4, z, r: L[type].r * s, hy: L[type].h * s * 0.45, kind: 'solid', tag: 'veg' }));
    }
    for (const [si, b] of buckets) {
      const sx = -WORLD.half + ((si % SECT) + 0.5) * SECT_SIZE, sz = -WORLD.half + (Math.floor(si / SECT) + 0.5) * SECT_SIZE;
      const sector = { x: sx, z: sz, meshes: [] };
      for (const type in b) {
        const mats = b[type];
        for (const [geo, matKey] of L[type].parts) {
          const im = new THREE.InstancedMesh(geo, this.mats[matKey], mats.length);
          mats.forEach((mm, k) => im.setMatrixAt(k, mm));
          im.castShadow = p.shadow > 0 && type !== 'bush'; im.receiveShadow = p.mat > 0;
          im.computeBoundingSphere(); im.instanceMatrix.needsUpdate = true;
          this.group.add(im); sector.meshes.push(im);
        }
      }
      this.sectors.push(sector);
    }
    this.buildGrass(p);
    this.buildClouds(p);
    this.waterQuality(p);
  }

  // ---------- GPU grass + flowers ----------
  buildGrass(p) {
    if (this.grass) { this.scene.remove(this.grass); this.grass.geometry.dispose(); this.grass.material.dispose(); this.grass = null; }
    if (this.flowers) { this.scene.remove(this.flowers); this.flowers.geometry.dispose(); this.flowers.material.dispose(); this.flowers = null; }
    if (!p.grass) return;
    if (!this.hTex) this.hTex = heightTexture();
    const count = Math.floor(22000 * p.grass);
    const R = lerp(60, 120, clamp((p.grass - 0.35) / 2.8, 0, 1));
    const mkField = (n, blade, isFlower) => {
      const g = new THREE.InstancedBufferGeometry(); g.index = blade.index; g.attributes = blade.attributes;
      const off = new Float32Array(n * 4); const r = rng(isFlower ? 9 : 8);
      for (let i = 0; i < n; i++) { off[i * 4] = r(); off[i * 4 + 1] = r(); off[i * 4 + 2] = r() * Math.PI * 2; off[i * 4 + 3] = 0.6 + r() * 0.8; }
      g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4)); g.instanceCount = n;
      const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, vertexColors: false });
      const u = this.grassU || (this.grassU = { uH: { value: this.hTex }, uCenter: { value: new THREE.Vector3() }, uR: { value: R }, uN: { value: WORLD.N + 1 }, uHalf: { value: WORLD.half }, uCell: { value: WORLD.cell }, uPlayer: { value: new THREE.Vector3(1e5, 0, 0) } });
      u.uR.value = R;
      mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, u, { uTime: windUniforms.uTime, uWind: windUniforms.uWind });
        sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
          attribute vec4 aOff; uniform sampler2D uH; uniform vec3 uCenter, uPlayer; uniform float uR, uN, uHalf, uCell, uTime, uWind; varying vec3 vGC; varying float vTip;
          vec4 hs(vec2 w){ vec2 f = (w + uHalf)/uCell; vec2 i = floor(f); vec2 t = f - i;
            vec4 a = texelFetch(uH, ivec2(i), 0), b = texelFetch(uH, ivec2(i)+ivec2(1,0), 0), c = texelFetch(uH, ivec2(i)+ivec2(0,1), 0), d = texelFetch(uH, ivec2(i)+ivec2(1,1), 0);
            return mix(mix(a,b,t.x), mix(c,d,t.x), t.y); }`)
          .replace('#include <begin_vertex>', `
          vec2 base = uCenter.xz - uR*0.5 + mod(aOff.xy*uR - (uCenter.xz - uR*0.5), uR);
          vec4 hh = hs(base);
          float dens = hh.y;
          float dist = length(base - uCenter.xz);
          float fade = smoothstep(uR*0.5, uR*0.32, dist);
          float keep = step(fract(aOff.w*13.7), dens) * fade;
          float s = aOff.w * keep ${isFlower ? '* 0.8' : '* (0.75 + 0.5*dens)'};
          float c = cos(aOff.z), sn = sin(aOff.z);
          vec3 lp = position * s;
          lp.xz = mat2(c,-sn,sn,c) * lp.xz;
          vTip = position.y;
          float sw = sin(uTime*2.2 + base.x*0.35 + base.y*0.27)*(0.25+uWind*0.9);
          vec2 away = base - uPlayer.xz; float pd = length(away);
          vec2 push = pd < 2.2 ? normalize(away + 1e-4) * (2.2 - pd) * 0.45 : vec2(0.0);
          lp.xz += (vec2(sw, sw*0.6)*0.25 + push) * position.y;
          vec3 transformed = vec3(base.x, hh.x - 0.05, base.y) + lp;
          vGC = vec3(hh.z, hh.w, hh.z*0.35);`)
          .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0,1.0,0.0);');
        sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', 'float faceDirection = 1.0; vec3 normal = normalize(vNormal); vec3 nonPerturbedNormal = normal;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGC; varying float vTip;')
          .replace('#include <color_fragment>', isFlower ? '#include <color_fragment>' : '#include <color_fragment>\n diffuseColor.rgb = vGC * mix(0.6, 1.3, clamp(vTip/0.46,0.0,1.0)) * vec3(0.95,1.08,0.85);');
      };
      if (isFlower) mat.color.set(0xffffff);
      const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.name = isFlower ? 'flowers' : 'grass';
      return mesh;
    };
    // blade: tapered strip
    const blade = new THREE.BufferGeometry();
    blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.06, 0, 0, 0.06, 0, 0, -0.04, 0.22, 0.015, 0.04, 0.22, 0.015, 0, 0.46, 0.04], 3));
    blade.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
    this.grass = mkField(count, blade, false); this.scene.add(this.grass);
    // flowers: small coloured crosses
    const fl = new THREE.BufferGeometry(); const fp = [], fc = [], fi = [];
    const cols = [new THREE.Color(0xffe14a), new THREE.Color(0xff6fa8), new THREE.Color(0xffffff), new THREE.Color(0x9f7bff)];
    for (let k = 0; k < 2; k++) { const a = k * Math.PI / 2; const cx = Math.cos(a) * 0.12, cz = Math.sin(a) * 0.12; const b = fp.length / 3;
      fp.push(-cx, 0.2, -cz, cx, 0.2, cz, cx, 0.36, cz, -cx, 0.36, -cz); fi.push(b, b + 1, b + 2, b, b + 2, b + 3); }
    fl.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fl.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(fp.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); fl.setIndex(fi);
    this.flowers = mkField(Math.floor(count * 0.06), fl, true);
    this.flowers.material.color = cols[1];
    this.scene.add(this.flowers);
  }

  // ---------- clouds (billboard puffs) ----------
  buildClouds(p) {
    if (this.clouds) { this.scene.remove(this.clouds); this.clouds.geometry.dispose(); this.clouds.material.dispose(); this.clouds = null; }
    if (!p.clouds) return;
    const tex = (this.cloudTex ||= (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      for (let i = 0; i < 18; i++) { const x = 30 + Math.random() * 68, y = 40 + Math.random() * 48, r = 16 + Math.random() * 26; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })());
    const n = p.clouds; const g = new THREE.InstancedBufferGeometry(); const q = new THREE.PlaneGeometry(1, 1);
    g.index = q.index; g.attributes = q.attributes;
    const a = new Float32Array(n * 4); const r = rng(44);
    for (let i = 0; i < n; i++) { a[i * 4] = (r() * 2 - 1) * 1600; a[i * 4 + 1] = 260 + r() * 220; a[i * 4 + 2] = (r() * 2 - 1) * 1600; a[i * 4 + 3] = 120 + r() * 200; }
    g.setAttribute('aC', new THREE.InstancedBufferAttribute(a, 4)); g.instanceCount = n;
    this.cloudU = { uTex: { value: tex }, uTime: windUniforms.uTime, uCol: { value: new THREE.Color(1, 1, 1) }, uOp: { value: 0.6 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.cloudU, transparent: true, depthWrite: false, fog: false,
      vertexShader: `attribute vec4 aC; uniform float uTime; varying vec2 vUv; void main(){ vUv = uv; vec3 c = aC.xyz; c.x = mod(c.x + uTime*3.0 + 1600.0, 3200.0) - 1600.0; vec4 mv = viewMatrix * vec4(c,1.0); mv.xy += position.xy * aC.w * vec2(1.6,0.8); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uTex; uniform vec3 uCol; uniform float uOp; varying vec2 vUv; void main(){ vec4 t = texture2D(uTex, vUv); gl_FragColor = vec4(uCol, t.a*uOp);
#include <colorspace_fragment>\n }`,
    });
    this.clouds = new THREE.Mesh(g, mat); this.clouds.frustumCulled = false; this.clouds.renderOrder = -5; this.scene.add(this.clouds);
  }

  // ---------- water / lava / waterfalls ----------
  buildWater(p) {
    const nt = waterNormalTex();
    this.waterNormal = nt;
    this.waterU = { uTime: { value: 0 } };
    // ocean: camera-following grid
    const og = new THREE.PlaneGeometry(2400, 2400, 96, 96).rotateX(-Math.PI / 2);
    this.ocean = new THREE.Mesh(og, null); this.ocean.name = 'ocean'; this.ocean.receiveShadow = false; this.scene.add(this.ocean);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000, 1, 1).rotateX(-Math.PI / 2), null); far.position.y = -0.4; this.oceanFar = far; this.scene.add(far);
    // river ribbon
    const pts = []; for (let i = 0; i < RIVER.length - 1; i++) for (let k = 0; k < 20; k++) { const t = k / 20; pts.push([lerp(RIVER[i][0], RIVER[i + 1][0], t), lerp(RIVER[i][1], RIVER[i + 1][1], t), (i + t)]); }
    const pos = [], uv = [], idx = []; let acc = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x, z, s] = pts[i]; const n = pts[Math.min(i + 1, pts.length - 1)], pv = pts[Math.max(i - 1, 0)];
      let dx = n[0] - pv[0], dz = n[1] - pv[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      const y = riverSurfaceAtParam(s); if (i > 0) acc += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
      pos.push(x - dz * 11, y, z + dx * 11, x + dz * 11, y, z - dx * 11); uv.push(0, acc / 20, 1, acc / 20);
      if (i < pts.length - 1) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); rg.setIndex(idx); rg.computeVertexNormals();
    this.river = new THREE.Mesh(rg, null); this.river.name = 'river'; this.scene.add(this.river);
    // lava (volcano crater)
    this.lavaU = Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { uTime: this.waterU.uTime });
    const lava = new THREE.Mesh(new THREE.CircleGeometry(84, 48).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: this.lavaU, fog: true,
      vertexShader: `varying vec2 vP;
#include <fog_pars_vertex>\n void main(){ vP = position.xz; vec4 mvPosition = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mvPosition;
#include <fog_vertex>\n }`,
      fragmentShader: `uniform float uTime; varying vec2 vP;
#include <fog_pars_fragment>\n
        float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);} float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
        void main(){ vec2 p = vP*0.06; float t = uTime*0.15; float v = n(p*2.0+vec2(t,-t))*0.5 + n(p*4.3-vec2(t*1.3,t*0.7))*0.3 + n(p*9.0+t)*0.2;
          float crack = smoothstep(0.42,0.5,v)*smoothstep(0.62,0.5,v);
          vec3 c = mix(vec3(0.25,0.03,0.0), vec3(1.8,0.55,0.08), smoothstep(0.35,0.75,v)) + vec3(2.5,1.2,0.3)*crack;
          gl_FragColor = vec4(c,1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>\n }`,
    }));
    lava.position.set(430, 104.5, 690); lava.name = 'lava'; this.scene.add(lava); this.lava = lava;
    this.lavaLight = new THREE.PointLight(0xff6a20, 0, 260, 1.4); this.lavaLight.position.set(430, 120, 690); this.scene.add(this.lavaLight);
    // waterfalls
    this.falls = [];
    this.fallTex = fallTexture();
  }
  addWaterfall(x, y0, y1, z, yaw, width) {
    const h = y0 - y1;
    const g = new THREE.PlaneGeometry(width, h, 1, 8); g.translate(0, -h / 2, 0);
    const t = this.fallTex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(width / 8, h / 10);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, color: 0xcfefff }));
    m.position.set(x, y0, z); m.rotation.y = yaw; this.scene.add(m); this.falls.push({ m, t, x, y: y1, z, width });
    return m;
  }
  waterQuality(p) {
    const q = p.water;
    const mk = (opacity) => {
      if (q === 0) return new THREE.MeshLambertMaterial({ color: 0x1f7fae, transparent: true, opacity });
      const m = new THREE.MeshStandardMaterial({ color: 0x1b6f9c, roughness: 0.08, metalness: 0.0, transparent: true, opacity, normalMap: this.waterNormal, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 1.4 });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = this.waterU.uTime;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec2 vWP;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            vec4 wpp = modelMatrix * vec4(transformed,1.0); vWP = wpp.xz;
            ${q >= 2 ? 'float wv = sin(wpp.x*0.05 + uTime*1.2)*0.35 + sin(wpp.z*0.07 + uTime*0.9)*0.25 + sin((wpp.x+wpp.z)*0.13 + uTime*2.1)*0.12; transformed.y += wv * (modelMatrix[3][1] < 1.0 ? 1.0 : 0.15);' : ''}`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec2 vWP;')
          .replace('#include <normal_fragment_maps>', `
            vec3 n1 = texture2D(normalMap, vWP*0.035 + vec2(uTime*0.012, uTime*0.008)).xyz*2.0-1.0;
            vec3 n2 = texture2D(normalMap, vWP*0.09 - vec2(uTime*0.02, -uTime*0.015)).xyz*2.0-1.0;
            vec3 mapN = normalize(vec3((n1.xy+n2.xy)*normalScale, 1.0));
            normal = normalize( tbn * mapN );`);
      };
      return m;
    };
    if (this.ocean.material) this.ocean.material.dispose();
    this.ocean.material = mk(0.82); this.oceanFar.material = this.ocean.material;
    // river uses uv-based flow
    const rm = mk(0.8);
    if (q > 0) {
      const prev = rm.onBeforeCompile;
      rm.onBeforeCompile = (sh) => { prev(sh); sh.fragmentShader = sh.fragmentShader.replace('vWP*0.035 + vec2(uTime*0.012, uTime*0.008)', 'vec2(vWP.x*0.05, vWP.y*0.05) + vec2(0.0, -uTime*0.25)'); };
      rm.customProgramCacheKey = () => 'river';
    }
    if (this.river.material) this.river.material.dispose();
    this.river.material = rm;
    if (this.ocean.material.customProgramCacheKey) this.ocean.material.customProgramCacheKey = () => 'ocean';
    this.ocean.geometry.dispose();
    const seg = q >= 2 ? 160 : q === 1 ? 64 : 8;
    this.ocean.geometry = new THREE.PlaneGeometry(2400, 2400, seg, seg).rotateX(-Math.PI / 2);
  }
  update(dt, cam, player, sky, weather) {
    windUniforms.uTime.value += dt; windUniforms.uWind.value = weather ? weather.cur.wind : 0.3;
    this.waterU.uTime.value += dt;
    const step = 2400 / 64;
    this.ocean.position.set(Math.round(cam.position.x / step) * step, 0, Math.round(cam.position.z / step) * step);
    this.oceanFar.position.set(cam.position.x, -0.6, cam.position.z);
    const dd = Math.min(this.p.draw, this.p.vegDist) + SECT_SIZE * 0.7;
    for (const s of this.sectors) { const vis = Math.hypot(cam.position.x - s.x, cam.position.z - s.z) < dd; for (const m of s.meshes) m.visible = vis; }
    if (this.grassU) { this.grassU.uCenter.value.set(cam.position.x * 0.5 + player.x * 0.5, 0, cam.position.z * 0.5 + player.z * 0.5); this.grassU.uPlayer.value.copy(player); }
    for (const f of this.falls) f.t.offset.y += dt * 1.6;
    if (this.clouds) { this.cloudU.uCol.value.copy(sky.uniforms.uHorizon.value).lerp(new THREE.Color(1, 1, 1), 0.6).multiplyScalar(1 - sky.uniforms.uNight.value * 0.8); this.cloudU.uOp.value = 0.25 + sky.uniforms.uCloud.value * 0.6; }
    const nearLava = Math.hypot(player.x - 430, player.z - 690) < 400;
    this.lavaLight.intensity = nearLava && this.p.lights > 0 ? 900 * (0.9 + 0.1 * Math.sin(G.time * 6)) : 0;
  }
}

function waterNormalTex() {
  const s = 256; const c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d'); const img = g.createImageData(s, s);
  const hgt = new Float32Array(s * s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const a = x / s * Math.PI * 2, b = y / s * Math.PI * 2; hgt[y * s + x] = noise2(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + Math.cos(b) * 2) * 0.6 + noise2(Math.cos(a) * 5, Math.sin(b) * 5 + 3) * 0.4; }
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = hgt[y * s + ((x + 1) % s)] - hgt[y * s + ((x - 1 + s) % s)], dy = hgt[((y + 1) % s) * s + x] - hgt[((y - 1 + s) % s) * s + x];
    const L = Math.hypot(dx * 4, dy * 4, 1); const o = (y * s + x) * 4;
    img.data[o] = (-dx * 4 / L * 0.5 + 0.5) * 255; img.data[o + 1] = (-dy * 4 / L * 0.5 + 0.5) * 255; img.data[o + 2] = (1 / L * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; return t;
}
function fallTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = 'rgba(200,235,255,0.5)'; g.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.6})`; g.fillRect(Math.random() * 64, Math.random() * 128, 1 + Math.random() * 3, 10 + Math.random() * 40); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
