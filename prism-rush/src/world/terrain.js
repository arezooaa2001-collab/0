// Open-world terrain: 10 blended regions on one continuous heightfield, river, flatten zones, chunked LOD meshes.
import * as THREE from 'three';
import { noise2, fbm, ridged } from '../noise.js';
import { clamp, lerp, smooth, rng } from '../util.js';

export const WORLD = { half: 1200, N: 512, water: 0 };
WORLD.cell = (WORLD.half * 2) / WORLD.N;
const N1 = WORLD.N + 1;

const ss = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const REGIONS = [
  { id: 'meadow', c: [0, 0], s: 330, ground: 'grass', music: 'meadow', tier: 1, weather: ['clear', 'clear', 'cloudy', 'lightRain', 'clear', 'storm'], col: [0x56b43c, 0x74c64e, 0x3f9230], fog: 0xcde8ff },
  { id: 'forest', c: [-600, -240], s: 300, ground: 'grass', music: 'forest', tier: 2, weather: ['clear', 'mist', 'lightRain', 'heavyRain', 'fog'], col: [0x2f7029, 0x41812f, 0x5c4a2a], fog: 0xa9c9b0 },
  { id: 'desert', c: [640, 80], s: 320, ground: 'sand', music: 'desert', tier: 2, weather: ['clear', 'clear', 'sandstorm', 'clear'], col: [0xe6c47e, 0xd9b068, 0xc69a52], fog: 0xf0dcb0 },
  { id: 'snow', c: [-400, 640], s: 300, ground: 'snow', music: 'snow', tier: 3, weather: ['snow', 'clear', 'blizzard', 'snow', 'fog'], col: [0xe3ebf5, 0xf7faff, 0x8c9db2], fog: 0xdfe8f5 },
  { id: 'volcano', c: [430, 690], s: 260, ground: 'rock', music: 'volcano', tier: 4, weather: ['clear', 'ash', 'clear'], col: [0x3b312d, 0x4b3c34, 0x6e2a1a], fog: 0x8a6a5a },
  { id: 'coast', c: [-80, -760], s: 320, ground: 'sand', music: 'coast', tier: 1, weather: ['clear', 'clear', 'lightRain', 'storm', 'cloudy'], col: [0x5fc153, 0xf0dca2, 0x3f9a45], fog: 0xd2f0ff },
  { id: 'city', c: [680, -560], s: 260, ground: 'metal', music: 'city', tier: 3, weather: ['clear', 'lightRain', 'heavyRain', 'fog', 'clear'], col: [0x6b7280, 0x5a606b, 0x8890a0], fog: 0xb8c0d8 },
  { id: 'ruins', c: [-760, 300], s: 250, ground: 'rock', music: 'ruins', tier: 3, weather: ['clear', 'mist', 'lightRain', 'clear'], col: [0x8f9c62, 0xa6a77c, 0x7b7b60], fog: 0xd6dcc0 },
  { id: 'canyon', c: [-660, -760], s: 260, ground: 'rock', music: 'canyon', tier: 3, weather: ['clear', 'sandstorm', 'clear', 'cloudy'], col: [0xbb5c3b, 0xcc7a4f, 0x8f3f2a], fog: 0xe9b99a },
  { id: 'fortress', c: [40, 960], s: 220, ground: 'metal', music: 'fortress', tier: 5, weather: ['storm', 'cloudy', 'heavyRain', 'clear'], col: [0x4b515b, 0x3d434c, 0x8a3a2a], fog: 0x7d7f90 },
];
export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r, i) => [r.id, Object.assign(r, { index: i })]));
// Off-terrain zones (handled by level.js): sky isles, moon base, special stage
export const ZONES = {
  sky: { c: [180, 260, -160], r: 260 },
  moon: { c: [-1750, 650, 0], r: 420, gravity: 0.38 },
  special: { c: [0, 1900, -1600], r: 260 },
};

export const RIVER = [[-430, 560], [-340, 430], [-250, 270], [-185, 100], [-160, -110], [-130, -330], [-100, -560], [-70, -840], [-60, -1120]];

// Flat areas for arenas, loops, race starts and the hub. h:null = keep natural height at centre
export const FLATS = [
  { id: 'hub', x: 0, z: 0, r: 46, b: 40, h: null },
  { id: 'titan', x: 300, z: -230, r: 95, b: 60, h: null },
  { id: 'vexArena', x: -330, z: -420, r: 70, b: 50, h: null },
  { id: 'crater', x: 430, z: 690, r: 78, b: 22, h: 100 },
  { id: 'fortress', x: 40, z: 960, r: 135, b: 50, h: 30 },
  { id: 'city', x: 680, z: -560, r: 230, b: 70, h: 16 },
  { id: 'loop1', x: 120, z: 150, r: 22, b: 30, h: null },
  { id: 'loop2', x: 560, z: 40, r: 22, b: 30, h: null },
  { id: 'loop3', x: -520, z: -140, r: 22, b: 30, h: null },
  { id: 'loop4', x: -120, z: -560, r: 22, b: 30, h: null },
  { id: 'raceMeadow', x: -60, z: 140, r: 20, b: 30, h: null },
  { id: 'raceDesert', x: 520, z: 260, r: 20, b: 30, h: null },
  { id: 'shrine', x: -820, z: 380, r: 40, b: 30, h: null },
  { id: 'waterfall', x: -660, z: 120, r: 58, b: 26, h: null },
  { id: 'oasis', x: 720, z: 200, r: 22, b: 30, h: -3 },
  { id: 'labPit', x: 150, z: 1010, r: 34, b: 10, h: 9 },
  { id: 'moonPad', x: -60, z: 1000, r: 14, b: 10, h: 30 },
  { id: 'kraken', x: -80, z: -1000, r: 70, b: 40, h: -9 },
];

let H, NX, NZ, C, RG, RIV; // height, normals, colours, region index, river surface
let flatTargets = [];
let riverProfile = null; // cumulative-min surface per river vertex

function regionHeight(r, x, z) {
  switch (r.id) {
    case 'meadow': return 9 + 15 * fbm(x / 210, z / 210, 4) + 3 * noise2(x / 45, z / 45);
    case 'forest': return 13 + 22 * fbm(x / 170 + 40, z / 170, 4) + 5 * noise2(x / 50, z / 50);
    case 'desert': { const d = Math.sin((x * 0.8 + z * 0.45) / 38 + 2.2 * noise2(x / 260, z / 260)); return 7 + 9 * (1 - Math.abs(d)) + 10 * fbm(x / 320, z / 320, 3); }
    case 'snow': return 32 + 125 * Math.pow(ridged(x / 300, z / 300, 5), 1.7) + 6 * noise2(x / 60, z / 60);
    case 'volcano': {
      const rr = Math.hypot(x - r.c[0], z - r.c[1]);
      let h = 18 + 150 * Math.pow(Math.max(0, 1 - rr / 340), 1.7) + 6 * fbm(x / 80, z / 80, 3);
      if (rr < 80) h -= 50 * Math.pow(1 - rr / 80, 0.6);
      return h;
    }
    case 'coast': return -7 + 17 * fbm(x / 180, z / 180, 4) + 7 * Math.max(0, noise2(x / 90, z / 90));
    case 'city': return 15 + 1.5 * fbm(x / 300, z / 300, 2);
    case 'ruins': { const h = 22 + 15 * fbm(x / 160, z / 160, 3); const f = h / 5, fl = Math.floor(f); return (fl + ss(0.3, 0.7, f - fl)) * 5; }
    case 'canyon': { const v = Math.abs(noise2(x / 240, z / 240)); const ch = ss(0.17, 0.02, v); return 44 + 10 * fbm(x / 150, z / 150, 3) - 38 * ch; }
    case 'fortress': return 28 + fbm(x / 200, z / 200, 2);
  }
  return 0;
}

const W = new Float32Array(REGIONS.length);
function baseHeight(x, z, outDominant) {
  let sw = 0, best = 0, bi = 0;
  for (let i = 0; i < REGIONS.length; i++) {
    const r = REGIONS[i]; const dx = x - r.c[0], dz = z - r.c[1];
    const w = Math.exp(-(dx * dx + dz * dz) / (r.s * r.s));
    W[i] = w; sw += w; if (w > best) { best = w; bi = i; }
  }
  let h = 0, tw = 0;
  for (let i = 0; i < REGIONS.length; i++) {
    const w = W[i] / sw; if (w < 0.004) continue;
    h += w * regionHeight(REGIONS[i], x, z); tw += w;
  }
  h /= tw;
  const R = Math.hypot(x, z);
  h = lerp(h, -32, ss(1060, 1190, R));
  if (outDominant) outDominant.i = bi;
  return h;
}

function distToRiver(x, z) {
  let best = 1e9, bs = 0;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1];
    const vx = bx - ax, vz = bz - az; const L2 = vx * vx + vz * vz;
    const t = clamp(((x - ax) * vx + (z - az) * vz) / L2, 0, 1);
    const px = ax + vx * t - x, pz = az + vz * t - z; const d = px * px + pz * pz;
    if (d < best) { best = d; bs = i + t; }
  }
  return [Math.sqrt(best), bs];
}
function buildRiverProfile() {
  // sample natural height along the river and make it monotonic downstream
  const pts = [];
  for (let i = 0; i < RIVER.length - 1; i++) for (let k = 0; k < 20; k++) {
    const t = k / 20; const x = lerp(RIVER[i][0], RIVER[i + 1][0], t), z = lerp(RIVER[i][1], RIVER[i + 1][1], t);
    pts.push(baseHeight(x, z) - 2.2);
  }
  pts.push(-1);
  for (let i = 1; i < pts.length; i++) pts[i] = Math.min(pts[i], pts[i - 1]);
  for (let i = 0; i < pts.length; i++) pts[i] = Math.max(pts[i], 0.25);
  riverProfile = pts;
}
export function riverSurfaceAtParam(s) { const f = clamp(s * 20, 0, riverProfile.length - 1); const i = Math.floor(f); const t = f - i; return lerp(riverProfile[i], riverProfile[Math.min(i + 1, riverProfile.length - 1)], t); }

function fullHeight(x, z, dom) {
  let h = baseHeight(x, z, dom);
  // river carve
  const [dr, s] = distToRiver(x, z);
  let riv = -1e9;
  if (dr < 26) {
    const surf = riverSurfaceAtParam(s);
    const bed = surf - 1.6;
    const t = ss(7, 26, dr);
    h = lerp(Math.min(h, bed), h, t);
    if (dr < 10.5) riv = surf;
  }
  // flatten zones
  for (const f of flatTargets) {
    const d = Math.hypot(x - f.x, z - f.z); if (d > f.r + f.b) continue;
    const w = 1 - ss(f.r, f.r + f.b, d);
    h = lerp(h, f.h, w);
    if (f.id === 'crater' && d < f.r) riv = Math.max(riv, -1e9);
  }
  return [h, riv];
}

export async function generateTerrain(onProgress) {
  buildRiverProfile();
  flatTargets = FLATS.map((f) => ({ ...f, h: f.h === null ? baseHeight(f.x, f.z) : f.h }));
  const n = N1 * N1;
  H = new Float32Array(n); RG = new Uint8Array(n); RIV = new Float32Array(n);
  const dom = { i: 0 };
  for (let j = 0; j < N1; j++) {
    const z = -WORLD.half + j * WORLD.cell;
    for (let i = 0; i < N1; i++) {
      const x = -WORLD.half + i * WORLD.cell;
      const [h, rv] = fullHeight(x, z, dom);
      const k = j * N1 + i; H[k] = h; RG[k] = dom.i; RIV[k] = rv;
    }
    if ((j & 15) === 0) { onProgress && onProgress(j / N1); await new Promise((r) => setTimeout(r, 0)); }
  }
  computeNormalsColors();
  return true;
}

function computeNormalsColors() {
  const n = N1 * N1; NX = new Float32Array(n * 3); C = new Float32Array(n * 3);
  const c = WORLD.cell; const col = new THREE.Color(), tmp = new THREE.Color(), rock = new THREE.Color();
  const pal = REGIONS.map((r) => r.col.map((h) => new THREE.Color(h)));
  const snowC = new THREE.Color(0xf2f6ff), sandC = new THREE.Color(0xe9d7a0), wetSand = new THREE.Color(0xb8a16c), lavaRock = new THREE.Color(0x2a1f1c);
  const r = rng(77);
  for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) {
    const k = j * N1 + i;
    const hl = H[j * N1 + Math.max(0, i - 1)], hr = H[j * N1 + Math.min(N1 - 1, i + 1)];
    const hd = H[Math.max(0, j - 1) * N1 + i], hu = H[Math.min(N1 - 1, j + 1) * N1 + i];
    let nx = hl - hr, ny = 2 * c, nz = hd - hu; const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
    NX[k * 3] = nx; NX[k * 3 + 1] = ny; NX[k * 3 + 2] = nz;
    const x = -WORLD.half + i * c, z = -WORLD.half + j * c, h = H[k];
    const reg = REGIONS[RG[k]]; const p = pal[RG[k]];
    const v = noise2(x / 23, z / 23) * 0.5 + 0.5, v2 = noise2(x / 90 + 7, z / 90) * 0.5 + 0.5;
    col.copy(p[0]).lerp(p[1], v);
    if (reg.id === 'canyon') { const band = Math.sin(h * 0.55) * 0.5 + 0.5; col.lerp(p[2], band * 0.55); }
    else col.lerp(p[2], Math.max(0, v2 - 0.55) * 1.6);
    if (reg.id === 'coast' && h < 3.2) col.copy(sandC).lerp(p[1], 0.2);
    if (h < 1.0 && reg.id !== 'volcano') col.copy(wetSand);
    // blend toward neighbouring region colours (soft biome borders)
    let sw = 0; for (let q = 0; q < REGIONS.length; q++) { const rr = REGIONS[q]; const dx = x - rr.c[0], dz = z - rr.c[1]; W[q] = Math.exp(-(dx * dx + dz * dz) / (rr.s * rr.s)); sw += W[q]; }
    tmp.setRGB(0, 0, 0);
    for (let q = 0; q < REGIONS.length; q++) { const w = W[q] / sw; if (w < 0.02) continue; tmp.r += pal[q][0].r * w; tmp.g += pal[q][0].g * w; tmp.b += pal[q][0].b * w; }
    col.lerp(tmp, 0.35);
    // slopes become rock
    const rk = reg.id === 'snow' ? 0x8a96a8 : reg.id === 'canyon' ? 0x9a4b32 : reg.id === 'volcano' ? 0x2e2623 : reg.id === 'desert' ? 0xb48b55 : 0x7d7466;
    rock.setHex(rk);
    col.lerp(rock, ss(0.84, 0.66, ny));
    if ((reg.id === 'snow' && h > 70) || h > 135) col.lerp(snowC, ss(0.62, 0.8, ny) * ss(60, 95, h));
    if (reg.id === 'volcano' && Math.hypot(x - 430, z - 690) < 95) col.lerp(lavaRock, 0.7);
    if (RIV[k] > -1e8) col.lerp(wetSand, 0.4);
    const jit = 0.94 + r() * 0.1; C[k * 3] = col.r * jit; C[k * 3 + 1] = col.g * jit; C[k * 3 + 2] = col.b * jit;
  }
}

// ---------- queries ----------
export function heightAt(x, z) {
  let fx = (x + WORLD.half) / WORLD.cell, fz = (z + WORLD.half) / WORLD.cell;
  fx = clamp(fx, 0, WORLD.N - 0.0001); fz = clamp(fz, 0, WORLD.N - 0.0001);
  const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * N1 + i;
  const a = H[k], b = H[k + 1], c = H[k + N1], d = H[k + N1 + 1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}
export function normalAt(x, z, out) {
  let fx = (x + WORLD.half) / WORLD.cell, fz = (z + WORLD.half) / WORLD.cell;
  fx = clamp(fx, 0, WORLD.N - 0.0001); fz = clamp(fz, 0, WORLD.N - 0.0001);
  const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j;
  const k = (j * N1 + i) * 3, k2 = k + 3, k3 = k + N1 * 3, k4 = k3 + 3;
  const w1 = (1 - tx) * (1 - tz), w2 = tx * (1 - tz), w3 = (1 - tx) * tz, w4 = tx * tz;
  out.set(NX[k] * w1 + NX[k2] * w2 + NX[k3] * w3 + NX[k4] * w4, NX[k + 1] * w1 + NX[k2 + 1] * w2 + NX[k3 + 1] * w3 + NX[k4 + 1] * w4, NX[k + 2] * w1 + NX[k2 + 2] * w2 + NX[k3 + 2] * w3 + NX[k4 + 2] * w4);
  return out.normalize();
}
function idx(x, z) { const i = clamp(Math.round((x + WORLD.half) / WORLD.cell), 0, WORLD.N), j = clamp(Math.round((z + WORLD.half) / WORLD.cell), 0, WORLD.N); return j * N1 + i; }
export function regionAt(x, z) { return REGIONS[RG[idx(x, z)]]; }
export function waterLevelAt(x, z) {
  const rv = RIV[idx(x, z)];
  return rv > 0 ? rv : WORLD.water;
}
export function lavaAt(x, z) { return Math.hypot(x - 430, z - 690) < 76 ? 104.5 : -1e9; }
export function surfaceAt(x, z, ny) {
  const k = idx(x, z); const h = H[k];
  if (RIV[k] > -1e8 && h < RIV[k]) return 'water';
  const reg = REGIONS[RG[k]];
  if (h < 0.8) return 'sand';
  if (ny !== undefined && ny < 0.75 && reg.ground !== 'snow') return 'rock';
  if (reg.id === 'coast') return h < 3.5 ? 'sand' : 'grass';
  if ((reg.id === 'snow' && h > 60) || h > 135) return 'snow';
  return reg.ground;
}
export function inWorld(x, z) { return Math.abs(x) < WORLD.half && Math.abs(z) < WORLD.half; }

// ---------- meshes ----------
const CH = 16, CELLS = WORLD.N / CH; // 32 cells per chunk
export class TerrainMesh {
  constructor(scene, preset) {
    this.scene = scene; this.group = new THREE.Group(); this.group.name = 'terrain'; scene.add(this.group);
    this.uniforms = { uSnow: { value: 0 }, uWet: { value: 0 }, uTime: { value: 0 } };
    this.chunks = [];
    for (let cz = 0; cz < CH; cz++) for (let cx = 0; cx < CH; cx++) {
      const x = -WORLD.half + (cx + 0.5) * CELLS * WORLD.cell, z = -WORLD.half + (cz + 0.5) * CELLS * WORLD.cell;
      this.chunks.push({ cx, cz, x, z, lods: [null, null, null], mesh: null, lod: -1 });
    }
    this.setPreset(preset);
  }
  makeMaterial(p) {
    const tex = detailTexture(p.detailTex); tex.anisotropy = p.aniso;
    let m;
    if (p.mat === 0) m = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex });
    else {
      m = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.93, metalness: 0.0 });
      if (p.mat >= 1) { m.normalMap = detailNormal(p.detailTex); m.normalScale = new THREE.Vector2(0.55, 0.55); m.normalMap.anisotropy = p.aniso; }
    }
    m.color.setScalar(1.12);
    const u = this.uniforms;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWN;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvWN = normalize((modelMatrix*vec4(objectNormal,0.0)).xyz);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWN; uniform float uSnow; uniform float uWet;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93,0.96,1.0), uSnow*smoothstep(0.55,0.85,vWN.y));\n diffuseColor.rgb *= 1.0 - uWet*0.32;');
      if (sh.fragmentShader.includes('#include <roughnessmap_fragment>'))
        sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.28, uWet*smoothstep(0.5,0.9,vWN.y));');
    };
    return m;
  }
  setPreset(p) {
    this.p = p;
    if (this.material) this.material.dispose();
    this.material = this.makeMaterial(p);
    this.lod0 = p.chunkLod; this.lod1 = p.chunkLod * 2.1; this.drawDist = p.draw;
    this.baseStep = p.index === 0 ? 2 : 1;
    for (const ch of this.chunks) { for (const g of ch.lods) g && g.dispose(); ch.lods = [null, null, null]; if (ch.mesh) { this.group.remove(ch.mesh); ch.mesh = null; } ch.lod = -1; }
  }
  geometryFor(ch, lod) {
    if (ch.lods[lod]) return ch.lods[lod];
    const step = this.baseStep * (lod === 0 ? 1 : lod === 1 ? 2 : 4);
    const seg = CELLS / step, v = seg + 1;
    const i0 = ch.cx * CELLS, j0 = ch.cz * CELLS;
    const skirt = 4 * v;
    const pos = new Float32Array((v * v + skirt) * 3), nor = new Float32Array((v * v + skirt) * 3), col = new Float32Array((v * v + skirt) * 3), uv = new Float32Array((v * v + skirt) * 2);
    let p = 0;
    const put = (i, j, drop) => {
      const k = j * N1 + i; const x = -WORLD.half + i * WORLD.cell, z = -WORLD.half + j * WORLD.cell;
      pos[p * 3] = x; pos[p * 3 + 1] = H[k] - drop; pos[p * 3 + 2] = z;
      nor[p * 3] = NX[k * 3]; nor[p * 3 + 1] = NX[k * 3 + 1]; nor[p * 3 + 2] = NX[k * 3 + 2];
      col[p * 3] = C[k * 3]; col[p * 3 + 1] = C[k * 3 + 1]; col[p * 3 + 2] = C[k * 3 + 2];
      uv[p * 2] = x / 7; uv[p * 2 + 1] = z / 7; p++;
    };
    for (let b = 0; b < v; b++) for (let a = 0; a < v; a++) put(i0 + a * step, j0 + b * step, 0);
    const idxs = [];
    for (let b = 0; b < seg; b++) for (let a = 0; a < seg; a++) {
      const q = b * v + a; idxs.push(q, q + v, q + 1, q + 1, q + v, q + v + 1);
    }
    // skirts (hide LOD cracks)
    const edges = [[0, 0, 1, 0], [seg, 0, 0, 1], [seg, seg, -1, 0], [0, seg, 0, -1]];
    for (const [sa, sb, da, db] of edges) {
      const start = p;
      for (let s = 0; s < v; s++) { const a = sa + da * s, b = sb + db * s; put(i0 + a * step, j0 + b * step, 5); }
      for (let s = 0; s < seg; s++) {
        const a = sa + da * s, b = sb + db * s, a2 = a + da, b2 = b + db;
        const t0 = b * v + a, t1 = b2 * v + a2, s0 = start + s, s1 = start + s + 1;
        idxs.push(t0, s0, t1, t1, s0, s1, t0, t1, s0, t1, s1, s0);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idxs); g.computeBoundingSphere(); g.computeBoundingBox();
    ch.lods[lod] = g; return g;
  }
  update(camPos, dt, drawScale = 1) {
    this.uniforms.uTime.value += dt;
    const dd = this.drawDist * drawScale;
    for (const ch of this.chunks) {
      const d = Math.max(0, Math.hypot(camPos.x - ch.x, camPos.z - ch.z) - 106);
      let lod = d < this.lod0 ? 0 : d < this.lod1 ? 1 : d < dd ? 2 : -1;
      if (lod === ch.lod) continue;
      if (lod === -1) { if (ch.mesh) ch.mesh.visible = false; ch.lod = -1; continue; }
      const g = this.geometryFor(ch, lod);
      if (!ch.mesh) { ch.mesh = new THREE.Mesh(g, this.material); ch.mesh.receiveShadow = true; ch.mesh.matrixAutoUpdate = false; ch.mesh.updateMatrix(); this.group.add(ch.mesh); }
      ch.mesh.geometry = g; ch.mesh.material = this.material; ch.mesh.visible = true; ch.lod = lod;
    }
  }
}

function detailTexture(size) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  const img = g.createImageData(size, size); const r = rng(5);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    // tileable noise via torus mapping
    const a = u * Math.PI * 2, b = v * Math.PI * 2;
    const n = fbm(Math.cos(a) * 1.6 + 10, Math.sin(a) * 1.6 + Math.cos(b) * 1.6, 4) * 0.5 + noise2(Math.sin(b) * 6 + 3, Math.cos(a) * 6) * 0.25;
    const val = clamp(0.86 + n * 0.22 + (r() - 0.5) * 0.06, 0.55, 1);
    const o = (y * size + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = val * 255; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true;
  detailTexture.last = c; return t;
}
function detailNormal(size) {
  const src = detailTexture.last; const g0 = src.getContext('2d').getImageData(0, 0, size, size).data;
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); const img = g.createImageData(size, size);
  const at = (x, y) => g0[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x - 1, y) - at(x + 1, y)) * 3, dy = (at(x, y - 1) - at(x, y + 1)) * 3;
    const L = Math.hypot(dx, dy, 1); const o = (y * size + x) * 4;
    img.data[o] = (dx / L * 0.5 + 0.5) * 255; img.data[o + 1] = (dy / L * 0.5 + 0.5) * 255; img.data[o + 2] = (1 / L * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; return t;
}

// Height texture for GPU grass (half float) + grass density mask
export function heightTexture() {
  const n = N1 * N1; const data = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) {
    const reg = REGIONS[RG[k]]; const ny = NX[k * 3 + 1]; const h = H[k];
    let g = 0;
    if (reg.id === 'meadow') g = 1; else if (reg.id === 'forest') g = 0.85; else if (reg.id === 'ruins') g = 0.6; else if (reg.id === 'coast') g = h > 3.5 ? 0.9 : 0;
    else if (reg.id === 'snow' || reg.id === 'desert') g = 0.05;
    if (h < 1 || ny < 0.8 || RIV[k] > -1e8) g = 0;
    for (const f of FLATS) if (f.id !== 'hub' && f.id !== 'shrine' && Math.hypot(-WORLD.half + (k % N1) * WORLD.cell - f.x, -WORLD.half + Math.floor(k / N1) * WORLD.cell - f.z) < f.r * 0.8 && /loop|race|titan|vex/.test(f.id)) g *= 0.4;
    data[k * 4] = h; data[k * 4 + 1] = g; data[k * 4 + 2] = C[k * 3]; data[k * 4 + 3] = C[k * 3 + 1];
  }
  const t = new THREE.DataTexture(data, N1, N1, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}

// Top-down map image (for minimap + world map)
export function mapCanvas(size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); const img = g.createImageData(size, size);
  const col = new THREE.Color();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const wx = -WORLD.half + (x + 0.5) / size * WORLD.half * 2, wz = -WORLD.half + (y + 0.5) / size * WORLD.half * 2;
    const k = idx(wx, wz); const h = H[k];
    col.setRGB(C[k * 3], C[k * 3 + 1], C[k * 3 + 2]);
    let r = col.r, gg = col.g, b = col.b;
    const shade = clamp(0.55 + NX[k * 3] * -0.9 + NX[k * 3 + 2] * -0.5 + 0.45, 0.5, 1.35);
    r *= shade; gg *= shade; b *= shade;
    const wl = RIV[k] > -1e8 ? RIV[k] : 0;
    if (h < wl) { const d = clamp((wl - h) / 25, 0, 1); r = lerp(0.25, 0.03, d); gg = lerp(0.55, 0.18, d); b = lerp(0.75, 0.45, d); }
    const o = (y * size + x) * 4;
    // linear -> sRGB-ish
    img.data[o] = Math.pow(clamp(r, 0, 1), 1 / 2.2) * 255; img.data[o + 1] = Math.pow(clamp(gg, 0, 1), 1 / 2.2) * 255; img.data[o + 2] = Math.pow(clamp(b, 0, 1), 1 / 2.2) * 255; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
export function worldToMap(x, z, size) { return [(x + WORLD.half) / (WORLD.half * 2) * size, (z + WORLD.half) / (WORLD.half * 2) * size]; }
