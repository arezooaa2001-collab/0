import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { makePersona, replyOffline, replyAI, QUICK, NPC_CHAT, norm } from './dialog.js';

/* ============================================================
   Utilities
   ============================================================ */
const $ = id => document.getElementById(id);
const V3 = THREE.Vector3, V2 = THREE.Vector2;
const IS_TOUCH = matchMedia('(pointer: coarse)').matches;
const LOW = IS_TOUCH;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function makeRng(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let R = makeRng(20261015);
const rr = (a, b) => a + (b - a) * R();
const ri = (a, b) => Math.floor(a + (b - a + 1) * R());
const pick = a => a[Math.floor(R() * a.length)];
const mpick = a => a[Math.floor(Math.random() * a.length)];
const fa = s => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

/* ============================================================
   City layout constants
   ============================================================ */
const N = 5;            // blocks per side
const B = 76;           // spacing between road centre lines
const RH = 8.5;         // road half width
const SW = 4;           // sidewalk width
const LANE = 3;         // lane centre offset
const PARKOFF = 6.9;    // parking strip offset
const CURB = 0.15;
const HALF = N * B / 2;
const LOT = B / 2 - RH - SW;      // half size of a lot (25.5)
const OUTER = HALF + RH + SW;
const BOUND = OUTER + 34;
const RING = B / 2 - RH - SW / 2;  // pedestrian ring half size (27.5)
const roadX = i => -HALF + i * B;
const blockC = i => -HALF + (i + 0.5) * B;
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const STREET_V = ['خیابان حافظ', 'خیابان سعدی', 'خیابان فردوسی', 'خیابان مولوی', 'خیابان نظامی', 'خیابان عطار'];
const STREET_H = ['خیابان بهار', 'خیابان یاس', 'خیابان نسترن', 'خیابان اقاقیا', 'خیابان صنوبر', 'خیابان سپیدار'];

function nearestRoad(v) { const k = clamp(Math.round((v + HALF) / B), 0, N); return { k, d: Math.abs(v - roadX(k)) }; }
function onRoad(x, z) {
  const ex = HALF + RH;
  return (Math.abs(z) <= ex && nearestRoad(x).d < RH) || (Math.abs(x) <= ex && nearestRoad(z).d < RH);
}
function groundH(x, z) {
  if (Math.abs(x) > OUTER || Math.abs(z) > OUTER) return 0;
  return onRoad(x, z) ? 0 : CURB;
}

/* ============================================================
   Renderer & scenes
   ============================================================ */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
let pixelRatio = Math.min(window.devicePixelRatio || 1, LOW ? 1.5 : 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
$('game').appendChild(renderer.domElement);
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
const interiorScene = new THREE.Scene();
interiorScene.background = new THREE.Color(0x0d0d10);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1400);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});

/* ============================================================
   Procedural textures
   ============================================================ */
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
function toTex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, MAX_ANISO); t.needsUpdate = true; return t;
}
function wrap9(s, fn) { for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) fn(ox, oy); }
function speckle(g, s, n, cols, a, b, alpha) {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * (0.35 + Math.random() * 0.65); g.fillStyle = cols[(Math.random() * cols.length) | 0];
    const r = a + Math.random() * (b - a); g.fillRect(Math.random() * s, Math.random() * s, r, r);
  }
  g.globalAlpha = 1;
}
function blobs(g, s, n, colA, colB, rmin, rmax) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * s, y = Math.random() * s, r = rmin + Math.random() * (rmax - rmin), col = Math.random() < 0.5 ? colA : colB;
    wrap9(s, (ox, oy) => { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r); });
  }
}
function normalFrom(c, strength) {
  const w = c.width, h = c.height, src = c.getContext('2d').getImageData(0, 0, w, h).data;
  const out = mkCanvas(w, h), og = out.getContext('2d'), img = og.createImageData(w, h), d = img.data;
  const H = (x, y) => { x = (x + w) % w; y = (y + h) % h; const i = (y * w + x) * 4; return (src[i] + src[i + 1] + src[i + 2]) / 765; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  og.putImageData(img, 0, 0); return toTex(out, false);
}
const T = {};
function makeTextures() {
  let c, g;
  // asphalt
  c = mkCanvas(512); g = c.getContext('2d'); g.fillStyle = '#46484c'; g.fillRect(0, 0, 512, 512);
  blobs(g, 512, 36, 'rgba(28,28,30,0.28)', 'rgba(120,120,122,0.12)', 30, 110);
  speckle(g, 512, 26000, ['#2b2d30', '#5d6064', '#6e7175', '#393b3f', '#83868a'], 1, 2.4, 0.9);
  g.strokeStyle = 'rgba(18,18,20,0.5)'; g.lineWidth = 1.3;
  for (let i = 0; i < 6; i++) { let x = 40 + Math.random() * 430, y = 40 + Math.random() * 430; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 10; k++) { x += (Math.random() - 0.5) * 34; y += (Math.random() - 0.5) * 34; g.lineTo(x, y); } g.stroke(); }
  T.asphalt = toTex(c); T.asphaltN = normalFrom(c, 2.2);
  // sidewalk tiles (4 m per texture, 1 m tiles)
  c = mkCanvas(512); g = c.getContext('2d'); g.fillStyle = '#bcb7ad'; g.fillRect(0, 0, 512, 512);
  for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) { const v = Math.random() * 18 - 9; g.fillStyle = `rgb(${190 + v},${185 + v},${175 + v})`; g.fillRect(tx * 128 + 2, ty * 128 + 2, 124, 124); }
  speckle(g, 512, 14000, ['#9d988f', '#d2cdc3', '#a8a39a', '#8a867e'], 1, 2, 0.55);
  g.fillStyle = '#77736b'; for (let k = 0; k <= 4; k++) { g.fillRect(k * 128 - 2, 0, 4, 512); g.fillRect(0, k * 128 - 2, 512, 4); }
  T.sidewalk = toTex(c); T.sidewalkN = normalFrom(c, 3);
  // grass
  c = mkCanvas(512); g = c.getContext('2d'); g.fillStyle = '#4b6f2c'; g.fillRect(0, 0, 512, 512);
  blobs(g, 512, 40, 'rgba(110,150,60,0.22)', 'rgba(40,70,25,0.25)', 30, 90);
  g.lineWidth = 1;
  for (let i = 0; i < 20000; i++) { g.globalAlpha = 0.55; g.strokeStyle = ['#5b8a36', '#3f6324', '#6e9a40', '#4f7a2e', '#7aa64a', '#355a20'][(Math.random() * 6) | 0]; const x = Math.random() * 512, y = Math.random() * 512; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y - 3 - Math.random() * 4); g.stroke(); }
  g.globalAlpha = 1; T.grass = toTex(c);
  // plaster
  c = mkCanvas(256); g = c.getContext('2d'); g.fillStyle = '#ece8e1'; g.fillRect(0, 0, 256, 256);
  blobs(g, 256, 14, 'rgba(200,195,185,0.12)', 'rgba(255,255,255,0.15)', 15, 50);
  speckle(g, 256, 6000, ['#d6d1c8', '#f7f4ef', '#cbc6bd'], 1, 2, 0.5);
  T.plaster = toTex(c); T.plasterN = normalFrom(c, 1.4);
  // brick
  c = mkCanvas(512); g = c.getContext('2d'); const hc = mkCanvas(512), hg = hc.getContext('2d');
  g.fillStyle = '#cbc2b4'; g.fillRect(0, 0, 512, 512); hg.fillStyle = '#000'; hg.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 32; row++) for (let k = -1; k < 9; k++) {
    const x = k * 64 + (row % 2) * 32 + 2, y = row * 16 + 2; const v = Math.random() * 30 - 15;
    g.fillStyle = `rgb(${160 + v},${84 + v * 0.6},${58 + v * 0.4})`; g.fillRect(x, y, 61, 13);
    hg.fillStyle = `rgb(${200 + v},${200 + v},${200 + v})`; hg.fillRect(x, y, 61, 13);
  }
  speckle(g, 512, 9000, ['#7a3b28', '#b8735a', '#5e2c1e', '#c99c86'], 1, 2, 0.5);
  T.brick = toTex(c); T.brickN = normalFrom(hc, 4);
  // roof tiles
  c = mkCanvas(512); g = c.getContext('2d'); g.fillStyle = '#d8d4cf'; g.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 16; row++) for (let k = -1; k < 12; k++) {
    const x = k * 48 + (row % 2) * 24, y = row * 32; const gr = g.createLinearGradient(0, y, 0, y + 32);
    gr.addColorStop(0, '#f2efea'); gr.addColorStop(0.75, '#cfcac3'); gr.addColorStop(1, '#8f8a83');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x + 2, y); g.lineTo(x + 46, y); g.lineTo(x + 46, y + 26); g.quadraticCurveTo(x + 24, y + 33, x + 2, y + 26); g.closePath(); g.fill();
  }
  speckle(g, 512, 5000, ['#bdb7af', '#ffffff'], 1, 2, 0.4);
  T.roof = toTex(c); T.roofN = normalFrom(c, 3);
  // wood floor
  c = mkCanvas(512); g = c.getContext('2d');
  for (let row = 0; row < 16; row++) {
    let x = -Math.random() * 200; while (x < 512) { const len = 140 + Math.random() * 220; g.fillStyle = ['#9b6b43', '#8a5d38', '#a87650', '#7d5432', '#946642'][(Math.random() * 5) | 0]; g.fillRect(x, row * 32, len, 32); g.fillStyle = 'rgba(40,20,10,0.6)'; g.fillRect(x, row * 32, 2, 32); x += len; }
    g.fillStyle = 'rgba(40,20,10,0.55)'; g.fillRect(0, row * 32, 512, 2);
    g.strokeStyle = 'rgba(60,35,18,0.25)'; for (let k = 0; k < 5; k++) { g.beginPath(); const y = row * 32 + 4 + Math.random() * 24; g.moveTo(0, y); for (let x2 = 0; x2 <= 512; x2 += 32) g.lineTo(x2, y + Math.sin(x2 * 0.05 + k) * 2); g.stroke(); }
  }
  T.wood = toTex(c);
  // floor tiles
  c = mkCanvas(512); g = c.getContext('2d'); g.fillStyle = '#b3ab9d'; g.fillRect(0, 0, 512, 512);
  for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) { const v = Math.random() * 10 - 5; g.fillStyle = `rgb(${232 + v},${226 + v},${214 + v})`; g.fillRect(tx * 128 + 2, ty * 128 + 2, 124, 124); }
  speckle(g, 512, 4000, ['#d9d2c4', '#f3efe6'], 1, 3, 0.5);
  T.tile = toTex(c);
  // door
  c = mkCanvas(128, 256); g = c.getContext('2d'); g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, 128, 256);
  const panel = (x, y, w, h) => { g.fillStyle = '#bdbdbd'; g.fillRect(x, y, w, h); g.fillStyle = '#f4f4f4'; g.fillRect(x + 4, y + 4, w - 8, h - 8); g.fillStyle = '#d0d0d0'; g.fillRect(x + 8, y + 8, w - 16, h - 16); };
  panel(14, 16, 44, 96); panel(70, 16, 44, 96); panel(14, 132, 44, 104); panel(70, 132, 44, 104);
  g.fillStyle = '#d4af37'; g.beginPath(); g.arc(108, 128, 6, 0, Math.PI * 2); g.fill();
  T.door = toTex(c); T.door.wrapS = T.door.wrapT = THREE.ClampToEdgeWrapping;
  // radial glow
  c = mkCanvas(64); g = c.getContext('2d'); let gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); T.glow = toTex(c); T.glow.wrapS = T.glow.wrapT = THREE.ClampToEdgeWrapping;
  c = mkCanvas(128); g = c.getContext('2d'); gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,214,150,0.9)'); gr.addColorStop(0.5, 'rgba(255,190,110,0.3)'); gr.addColorStop(1, 'rgba(255,180,90,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); T.pool = toTex(c); T.pool.wrapS = T.pool.wrapT = THREE.ClampToEdgeWrapping;
  // leaf clusters (alpha cut-out)
  c = mkCanvas(256); g = c.getContext('2d');
  for (let i = 0; i < 70; i++) {
    const x = 20 + Math.random() * 216, y = 20 + Math.random() * 216, r = 9 + Math.random() * 12, a = Math.random() * Math.PI;
    if (Math.hypot(x - 128, y - 128) > 112) continue;
    const v = Math.random() * 60; g.fillStyle = `rgb(${150 + v},${190 + v * 0.6},${120 + v * 0.5})`;
    g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, r, r * 0.45, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(60,80,40,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0); g.stroke(); g.restore();
  }
  T.leaf = toTex(c); T.leaf.wrapS = T.leaf.wrapT = THREE.ClampToEdgeWrapping;
  c = mkCanvas(512, 128); g = c.getContext('2d'); g.fillStyle = '#1d4f91'; g.fillRect(0, 0, 512, 128); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(8, 8, 496, 112);
  g.fillStyle = '#fff'; g.font = '64px Lalezar, Vazirmatn, Tahoma'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillText('ایستگاه اتوبوس', 256, 70);
  T.bus = toTex(c); T.bus.wrapS = T.bus.wrapT = THREE.ClampToEdgeWrapping;
  // taxi roof sign
  c = mkCanvas(256, 64); g = c.getContext('2d'); g.fillStyle = '#ffd23a'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#1b1b1b'; g.font = '44px Lalezar, Vazirmatn, Tahoma'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillText('تاکسی', 128, 36);
  T.taxi = toTex(c);
}

/* ============================================================
   Materials
   ============================================================ */
const M = {};
const windUniform = { value: 0 };
function stdMat(o) { return new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true }, o)); }
function makeMaterials() {
  M.asphalt = stdMat({ map: T.asphalt, normalMap: T.asphaltN, roughness: 0.93 });
  M.sidewalk = stdMat({ map: T.sidewalk, normalMap: T.sidewalkN, roughness: 0.86 });
  M.grass = stdMat({ map: T.grass, roughness: 1 });
  M.plaster = stdMat({ map: T.plaster, normalMap: T.plasterN, roughness: 0.9 });
  M.brick = stdMat({ map: T.brick, normalMap: T.brickN, roughness: 0.88 });
  M.roof = stdMat({ map: T.roof, normalMap: T.roofN, roughness: 0.72 });
  M.trim = stdMat({ roughness: 0.62 });
  M.metal = stdMat({ roughness: 0.38, metalness: 0.8 });
  M.wood = stdMat({ roughness: 0.68 });
  M.fabric = stdMat({ roughness: 1 });
  M.bark = stdMat({ roughness: 0.95 });
  M.hedge = stdMat({ map: T.grass, roughness: 1 });
  M.glass = stdMat({ roughness: 0.06, metalness: 0.65, envMapIntensity: 1.3 });
  M.glassLit = stdMat({ roughness: 0.2, metalness: 0.1, emissive: 0xffc77a, emissiveIntensity: 0 });
  M.paint = stdMat({ roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.emissive = stdMat({ emissive: 0xffe7b8, emissiveIntensity: 0, roughness: 0.4 });
  M.lampOn = stdMat({ emissive: 0xfff0d2, emissiveIntensity: 2.2, roughness: 0.4 });
  M.screen = stdMat({ emissive: 0x6fb6ff, emissiveIntensity: 1.2, roughness: 0.2 });
  M.fridge = stdMat({ emissive: 0xdff2ff, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.2 });
  M.woodFloor = stdMat({ map: T.wood, roughness: 0.55 });
  M.tileFloor = stdMat({ map: T.tile, roughness: 0.35 });
  M.winView = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xcfe6ff });
  M.leaves = stdMat({ map: T.leaf, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.82 });
  M.busSign = stdMat({ map: T.bus, emissive: 0xffffff, emissiveMap: T.bus, emissiveIntensity: 0.1, roughness: 0.4 });
  M.foliage = stdMat({ roughness: 0.85, flatShading: true });
  M.leaves.onBeforeCompile = M.foliage.onBeforeCompile = sh => {
    sh.uniforms.uTime = windUniform;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float hw = max(position.y - 1.6, 0.0);
      transformed.x += sin(uTime * 1.6 + position.x * 0.35 + position.z * 0.21) * 0.055 * hw;
      transformed.z += cos(uTime * 1.25 + position.z * 0.33 + position.x * 0.1) * 0.045 * hw;`);
  };
}
const NO_CAST = new Set(['busSign', 'asphalt', 'sidewalk', 'grass', 'paint', 'glass', 'glassLit', 'winView', 'woodFloor', 'tileFloor']);

/* ============================================================
   Geometry batching (merges static meshes by material + chunk)
   ============================================================ */
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new V3(), _s = new V3(), _col = new THREE.Color();
class Batch {
  constructor(cs) { this.cs = cs; this.groups = new Map(); }
  add(mat, geo, x = 0, y = 0, z = 0, ry = 0, color = 0xffffff, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _m4.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
    g.applyMatrix4(_m4);
    const n = g.attributes.position.count;
    _col.set(color);
    const ca = new Float32Array(n * 3); for (let i = 0; i < n; i++) { ca[i * 3] = _col.r; ca[i * 3 + 1] = _col.g; ca[i * 3 + 2] = _col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    let key = mat + '|0';
    if (this.cs) { g.computeBoundingBox(); const bb = g.boundingBox; key = mat + '|' + Math.floor((bb.min.x + bb.max.x) / 2 / this.cs) + ',' + Math.floor((bb.min.z + bb.max.z) / 2 / this.cs); }
    let arr = this.groups.get(key); if (!arr) { arr = []; this.groups.set(key, arr); } arr.push(g);
  }
  build(parent) {
    for (const [key, arr] of this.groups) {
      const mat = key.split('|')[0]; let total = 0; for (const g of arr) total += g.attributes.position.count;
      const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2), col = new Float32Array(total * 3);
      let o = 0;
      for (const g of arr) { const a = g.attributes; pos.set(a.position.array, o * 3); nor.set(a.normal.array, o * 3); uv.set(a.uv.array, o * 2); col.set(a.color.array, o * 3); o += a.position.count; g.dispose(); }
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      bg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); bg.setAttribute('color', new THREE.BufferAttribute(col, 3));
      bg.computeBoundingSphere();
      const mesh = new THREE.Mesh(bg, M[mat]); mesh.castShadow = !NO_CAST.has(mat); mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix(); mesh.userData.disposable = true; parent.add(mesh);
    }
    this.groups.clear();
  }
}
function boxGeo(w, h, d, ts) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ts) { const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / ts, uv.getY(i) * dims[f][1] / ts); } }
  return g;
}
function quadUp(x0, z0, x1, z1, y, ts) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / ts, -p.getZ(i) / ts);
  return g;
}
function planeGeo(w, h) { return new THREE.PlaneGeometry(w, h); }
function scaleUV(g, s) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s); return g; }

/* ============================================================
   Colliders (spatial hash of AABBs and cylinders)
   ============================================================ */
class Colliders {
  constructor() { this.cell = 6; this.map = new Map(); this.stamp = 0; }
  add(c) {
    c._s = 0; const cs = this.cell;
    for (let i = Math.floor(c.minX / cs); i <= Math.floor(c.maxX / cs); i++) for (let j = Math.floor(c.minZ / cs); j <= Math.floor(c.maxZ / cs); j++) {
      const k = (i + 500) * 1000 + (j + 500); let a = this.map.get(k); if (!a) { a = []; this.map.set(k, a); } a.push(c);
    }
    return c;
  }
  box(minX, maxX, minZ, maxZ, minY, maxY) { return this.add({ t: 0, minX, maxX, minZ, maxZ, minY, maxY }); }
  circle(x, z, r, minY, maxY) { return this.add({ t: 1, x, z, r, minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r, minY, maxY }); }
  query(minX, maxX, minZ, maxZ, out) {
    out.length = 0; const s = ++this.stamp, cs = this.cell;
    for (let i = Math.floor(minX / cs); i <= Math.floor(maxX / cs); i++) for (let j = Math.floor(minZ / cs); j <= Math.floor(maxZ / cs); j++) {
      const a = this.map.get((i + 500) * 1000 + (j + 500)); if (!a) continue;
      for (const c of a) { if (c._s === s) continue; c._s = s; if (c.maxX >= minX && c.minX <= maxX && c.maxZ >= minZ && c.minZ <= maxZ) out.push(c); }
    }
    return out;
  }
}

/* ============================================================
   Build helpers (local frames rotated in 90° steps)
   ============================================================ */
let BT, CL;           // current batch and collider set
const world = { col: new Colliders(), benches: [], doors: [], signMats: [], foot: [], gates: [], glow: [], pools: [], parks: [], parking: [], fountains: [] };
function mkFrame(x, z, a) { return { x, z, a, c: Math.cos(a), s: Math.sin(a) }; }
function fw(F, lx, lz) { return [F.x + lx * F.c + lz * F.s, F.z - lx * F.s + lz * F.c]; }
function fBox(F, mat, lx, ly, lz, w, h, d, color, o = {}) {
  const [x, z] = fw(F, lx, lz); const ry = F.a + (o.ry || 0);
  BT.add(mat, boxGeo(w, h, d, o.ts || 0), x, ly, z, ry, color, o.rx || 0, o.rz || 0);
  if (o.col) { const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), hx = c * w / 2 + s * d / 2, hz = s * w / 2 + c * d / 2; CL.box(x - hx, x + hx, z - hz, z + hz, o.minY ?? ly - h / 2, o.maxY ?? ly + h / 2); }
}
function fGeo(F, mat, geo, lx, ly, lz, color, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) { const [x, z] = fw(F, lx, lz); BT.add(mat, geo, x, ly, z, F.a + ry, color, rx, rz, sx, sy, sz); }
function darker(hex, f = 0.7) { const c = new THREE.Color(hex); c.multiplyScalar(f); return c.getHex(); }
const GEO = {};
function jitterIco(seedv) {
  const g0 = new THREE.IcosahedronGeometry(1, 1), g = g0.index ? g0.toNonIndexed() : g0, p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seedv) * 43758.5453; const f = 1 + ((h - Math.floor(h)) - 0.5) * 0.34; p.setXYZ(i, x * f, y * f * 0.92, z * f); }
  g.computeVertexNormals(); return g;
}
function initGeo() {
  GEO.ico = [0, 1, 2, 3, 4].map(k => jitterIco(k * 7.3));
  GEO.trunk = new THREE.CylinderGeometry(0.16, 0.26, 1, 7);
  GEO.cone = new THREE.ConeGeometry(1, 1, 8);
  GEO.cyl = new THREE.CylinderGeometry(1, 1, 1, 12);
  GEO.cyl16 = new THREE.CylinderGeometry(1, 1, 1, 20);
  GEO.sphere = new THREE.SphereGeometry(1, 12, 8);
}
const FOLIAGE = [0x3f6b2a, 0x4d7a30, 0x5a8a35, 0x36602a, 0x6a8f3a, 0x557f2f];

function tree(x, z, s = 1, kind = 'round', collide = true, baseY = CURB) {
  if (kind === 'pine') {
    BT.add('bark', GEO.trunk, x, baseY + 0.8 * s, z, 0, 0x4a3828, 0, 0, s, 1.6 * s, s);
    const col = pick([0x2f5a2c, 0x274d27, 0x35633a]);
    for (let k = 0; k < 3; k++) BT.add('foliage', GEO.cone, x, baseY + (1.8 + k * 1.15) * s, z, R() * 6, col, 0, 0, (1.7 - k * 0.42) * s, 2.0 * s, (1.7 - k * 0.42) * s);
  } else {
    const h = rr(2.4, 3.0) * s;
    BT.add('bark', GEO.trunk, x, baseY + h / 2, z, 0, 0x5b4636, 0, 0, s, h, s);
    const base = R() < 0.06 ? pick([0xb5652b, 0xc79a2e]) : pick(FOLIAGE);
    const n = ri(4, 6), cy = baseY + h + 0.9 * s;
    // branches
    for (let k = 0; k < 3; k++) { const a = R() * 6.28; BT.add('bark', GEO.trunk, x + Math.cos(a) * 0.35 * s, baseY + h - 0.1, z + Math.sin(a) * 0.35 * s, a, 0x5b4636, Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0.35 * s, 1.3 * s, 0.35 * s); }
    BT.add('foliage', pick(GEO.ico), x, cy, z, R() * 6, darker(base, 0.55), 0, 0, 1.25 * s, 1.1 * s, 1.25 * s);
    leafCluster(x, cy + 0.2 * s, z, 1.7 * s, base, x, cy - 0.4 * s, z);
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + R(), r = rr(0.8, 1.25) * s; const c = new THREE.Color(base).offsetHSL(rr(-0.02, 0.02), 0, rr(-0.07, 0.07)).getHex();
      const lx = x + Math.cos(a) * r, ly = baseY + h + rr(0.1, 1.4) * s, lz = z + Math.sin(a) * r;
      BT.add('foliage', pick(GEO.ico), lx, ly, lz, R() * 6, darker(c, 0.6), 0, 0, 0.7 * s, 0.6 * s, 0.7 * s);
      leafCluster(lx, ly, lz, rr(1.0, 1.35) * s, c, x, cy - 0.4 * s, z);
    }
    (world.treeSpots || (world.treeSpots = [])).push([x, z]);
  }
  if (collide) CL.circle(x, z, 0.3 * s, 0, 4 * s);
}
const _lq = new THREE.Quaternion(), _le = new THREE.Euler(), _lm = new THREE.Matrix4(), _lp = new V3(), _ls = new V3(1, 1, 1), _lv2 = new V3();
function leafCluster(x, y, z, s, color, ox, oy, oz) {
  // three crossed leaf cards with normals bent outward from the crown centre so the canopy shades softly
  for (let k = 0; k < 3; k++) {
    const g = new THREE.PlaneGeometry(1.7 * s, 1.7 * s);
    _le.set(R() * Math.PI, R() * Math.PI, R() * Math.PI); _lq.setFromEuler(_le); _lm.compose(_lp.set(x, y, z), _lq, _ls); g.applyMatrix4(_lm);
    const p = g.attributes.position, nr = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { _lv2.set(p.getX(i) - ox, (p.getY(i) - oy) * 1.3, p.getZ(i) - oz).normalize(); nr.setXYZ(i, _lv2.x, _lv2.y, _lv2.z); }
    BT.add('leaves', g, 0, 0, 0, 0, color);
  }
}
function bush(x, z, s, y = CURB, col) {
  BT.add('foliage', pick(GEO.ico), x, y + 0.45 * s, z, R() * 6, col ?? pick(FOLIAGE), 0, 0, 0.75 * s, 0.6 * s, 0.75 * s);
  CL.circle(x, z, 0.6 * s, 0, 0.9 * s);
}
function bench(x, z, ry, y = CURB, pub = true, roofed = false) {
  const F = mkFrame(x, z, ry);
  if (pub) world.benches.push({ x, z, ry, y, taken: null, roofed });
  fBox(F, 'wood', 0, y + 0.45, 0.02, 1.8, 0.06, 0.46, 0x8a5a33);
  fBox(F, 'wood', 0, y + 0.78, -0.22, 1.8, 0.36, 0.05, 0x8a5a33, { rx: -0.12 });
  for (const sx of [-0.78, 0.78]) { fBox(F, 'metal', sx, y + 0.22, 0, 0.07, 0.45, 0.5, 0x2a2d31); fBox(F, 'metal', sx, y + 0.65, -0.22, 0.06, 0.5, 0.06, 0x2a2d31); }
  for (const sx of [-0.6, 0, 0.6]) { const [cx, cz] = fw(F, sx, 0); CL.circle(cx, cz, 0.3, 0, y + 0.48); }
}
function streetLamp(x, z, dx, dz) {
  const a = Math.atan2(dx, dz), F = mkFrame(x, z, a);
  BT.add('metal', GEO.cyl, x, CURB + 0.25, z, 0, 0x24282d, 0, 0, 0.2, 0.5, 0.2);
  BT.add('metal', GEO.cyl, x, CURB + 3.3, z, 0, 0x2b2f35, 0, 0, 0.09, 6.4, 0.09);
  fBox(F, 'metal', 0, CURB + 6.45, 0.85, 0.08, 0.08, 1.8, 0x2b2f35);
  fBox(F, 'metal', 0, CURB + 6.4, 1.7, 0.36, 0.16, 0.7, 0x2b2f35);
  fBox(F, 'emissive', 0, CURB + 6.31, 1.7, 0.28, 0.04, 0.56, 0xffffff);
  const [hx, hz] = fw(F, 0, 1.7);
  world.glow.push([hx, CURB + 6.15, hz, 1.0, 0.86, 0.62, 3.2]); world.pools.push([hx, hz, 5.5]);
  CL.circle(x, z, 0.18, 0, 6.6);
}
function parkLamp(x, z) {
  BT.add('metal', GEO.cyl, x, CURB + 1.8, z, 0, 0x2b2f35, 0, 0, 0.07, 3.6, 0.07);
  BT.add('emissive', GEO.sphere, x, CURB + 3.8, z, 0, 0xffffff, 0, 0, 0.26, 0.26, 0.26);
  world.glow.push([x, CURB + 3.8, z, 1.0, 0.88, 0.7, 2.4]); world.pools.push([x, z, 4]);
  CL.circle(x, z, 0.14, 0, 4);
}
function streetSignMat(name) {
  const c = mkCanvas(512, 132), g = c.getContext('2d'); g.fillStyle = '#1d4f91'; g.fillRect(0, 0, 512, 132); g.strokeStyle = '#ffffff'; g.lineWidth = 7; g.strokeRect(9, 9, 494, 114);
  g.fillStyle = '#fff'; g.font = '62px Lalezar, Vazirmatn, Tahoma'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillText(name, 256, 72, 470);
  const t = toTex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return stdMat({ map: t, roughness: 0.45, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.06 });
}
function busStop(x, z, a) {
  const F = mkFrame(x, z, a);
  fBox(F, 'roof', 0, CURB + 2.55, 0.1, 3.4, 0.1, 1.7, 0x2f3a46);
  fBox(F, 'glass', 0, CURB + 1.3, -0.62, 3.2, 1.9, 0.03, 0xa9c0cf, { col: true, minY: 0, maxY: 2.4 });
  for (const sx of [-1.6, 1.6]) { fBox(F, 'glass', sx, CURB + 1.3, -0.1, 0.03, 1.9, 1.05, 0xa9c0cf, { col: true, minY: 0, maxY: 2.4 }); fBox(F, 'metal', sx, CURB + 1.27, -0.62, 0.08, 2.55, 0.08, 0x30343a); fBox(F, 'metal', sx, CURB + 1.27, 0.85, 0.08, 2.55, 0.08, 0x30343a, { col: true, minY: 0, maxY: 2.6 }); }
  fGeo(F, 'busSign', planeGeo(1.5, 0.38), 0, CURB + 2.83, 0.92, 0xffffff); fGeo(F, 'busSign', planeGeo(1.5, 0.38), 0, CURB + 2.83, 0.9, 0xffffff, Math.PI);
  fBox(F, 'metal', 0, CURB + 2.83, 0.91, 1.6, 0.46, 0.02, 0x1d2024);
  const [bx, bz] = fw(F, 0, -0.25); bench(bx, bz, a, CURB, true, true);
}
function motorbike(x, z, a) {
  const F = mkFrame(x, z, a), col = pick([0xb3161b, 0x1e4fa3, 0x15171b, 0xd9a03a, 0x2f6b3a]);
  for (const lz of [-0.62, 0.62]) { fGeo(F, 'metal', new THREE.TorusGeometry(0.27, 0.07, 8, 18), 0, CURB + 0.34, lz, 0x161616, Math.PI / 2); fGeo(F, 'metal', new THREE.CylinderGeometry(0.12, 0.12, 0.06, 10), 0, CURB + 0.34, lz, 0x9a9da2, 0, 0, Math.PI / 2); }
  fBox(F, 'trim', 0, CURB + 0.66, 0.05, 0.26, 0.3, 0.75, col); fBox(F, 'fabric', 0, CURB + 0.86, -0.25, 0.24, 0.1, 0.55, 0x1a1a1a);
  fBox(F, 'metal', 0, CURB + 0.82, 0.6, 0.06, 0.6, 0.06, 0x2a2a2a, { rx: -0.35 }); fBox(F, 'metal', 0, CURB + 1.08, 0.66, 0.66, 0.035, 0.035, 0x2a2a2a);
  fBox(F, 'emissive', 0, CURB + 0.95, 0.74, 0.14, 0.1, 0.06, 0xffffff);
  CL.circle(x, z, 0.55, 0, CURB + 1.05);
}
function hydrant(x, z) {
  BT.add('metal', GEO.cyl, x, CURB + 0.3, z, 0, 0xb3261e, 0, 0, 0.12, 0.6, 0.12);
  BT.add('metal', GEO.sphere, x, CURB + 0.62, z, 0, 0xb3261e, 0, 0, 0.13, 0.1, 0.13);
  BT.add('metal', GEO.cyl, x, CURB + 0.38, z, Math.PI / 2, 0xb3261e, Math.PI / 2, 0, 0.05, 0.36, 0.05);
  CL.circle(x, z, 0.18, 0, CURB + 0.7);
}
function bin(x, z) {
  BT.add('metal', GEO.cyl, x, CURB + 0.45, z, 0, 0x2f5a3f, 0, 0, 0.28, 0.9, 0.28);
  BT.add('metal', GEO.cyl, x, CURB + 0.92, z, 0, 0x22252a, 0, 0, 0.3, 0.05, 0.3);
  CL.circle(x, z, 0.3, 0, CURB + 0.95);
}
function fenceLine(x0, z0, x1, z1, gap, color, iron) {
  const alongX = Math.abs(z1 - z0) < 0.01; const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
  const c = alongX ? z0 : x0; const segs = gap == null ? [[a0, a1]] : [[a0, gap - 0.85], [gap + 0.85, a1]];
  const mat = iron ? 'metal' : 'trim';
  for (const [s0, s1] of segs) {
    const L = s1 - s0; if (L < 0.3) continue; const mid = (s0 + s1) / 2;
    const P = (u) => alongX ? [u, c] : [c, u];
    const n = Math.max(1, Math.ceil(L / 1.9));
    for (let k = 0; k <= n; k++) { const [px, pz] = P(s0 + L * k / n); BT.add(mat, boxGeo(0.1, 1.05, 0.1), px, CURB + 0.52, pz, 0, color); }
    const [mx, mz] = P(mid);
    for (const yy of [0.35, 0.85]) BT.add(mat, alongX ? boxGeo(L, 0.07, 0.05) : boxGeo(0.05, 0.07, L), mx, CURB + yy, mz, 0, color);
    if (!iron) { const m = Math.floor(L / 0.32); for (let k = 0; k < m; k++) { const [px, pz] = P(s0 + 0.16 + k * 0.32); BT.add(mat, boxGeo(alongX ? 0.08 : 0.025, 0.9, alongX ? 0.025 : 0.08), px, CURB + 0.5, pz, 0, color); } }
    else { const m = Math.floor(L / 0.16); for (let k = 0; k < m; k++) { const [px, pz] = P(s0 + 0.08 + k * 0.16); BT.add(mat, boxGeo(0.025, 0.9, 0.025), px, CURB + 0.5, pz, 0, color); } }
    if (alongX) CL.box(s0, s1, c - 0.09, c + 0.09, 0, CURB + 1.05); else CL.box(c - 0.09, c + 0.09, s0, s1, 0, CURB + 1.05);
  }
}

/* window: lies in local plane facing direction r */
function addWin(F, lx, ly, lz, r, ww, wh, o = {}) {
  const lit = R() < (o.litP ?? 0.42);
  const c = Math.cos(r), s = Math.sin(r);
  const P = (x, z) => [lx + x * c + z * s, lz - x * s + z * c];
  let [px, pz] = P(0, 0.03);
  fGeo(F, 'trim', boxGeo(ww + 0.18, wh + 0.18, 0.1), px, ly, pz, o.frame ?? 0xf4f1ea, r);
  [px, pz] = P(0, 0.085);
  fGeo(F, lit ? 'glassLit' : 'glass', planeGeo(ww, wh), px, ly, pz, lit ? 0x4a3c2a : (o.tint ?? 0x8da3b3), r);
  if (o.mullion) {
    [px, pz] = P(0, 0.095); fGeo(F, 'trim', boxGeo(0.05, wh, 0.03), px, ly, pz, o.frame ?? 0xf4f1ea, r);
    fGeo(F, 'trim', boxGeo(ww, 0.05, 0.03), px, ly + wh * 0.18, pz, o.frame ?? 0xf4f1ea, r);
  }
  if (o.sill !== false) { [px, pz] = P(0, 0.12); fGeo(F, 'trim', boxGeo(ww + 0.32, 0.07, 0.25), px, ly - wh / 2 - 0.12, pz, o.sillCol ?? 0xe6e1d7, r); }
  if (o.ac && R() < o.ac) { [px, pz] = P(0.3, 0.22); fGeo(F, 'metal', boxGeo(0.82, 0.52, 0.42), px, ly - wh / 2 - 0.5, pz, 0xdcdfe2, r); [px, pz] = P(0.3, 0.44); fGeo(F, 'metal', boxGeo(0.62, 0.38, 0.02), px, ly - wh / 2 - 0.5, pz, 0x4a4d52, r); }
  if (o.shutter) for (const sx of [-1, 1]) { [px, pz] = P(sx * (ww / 2 + 0.33), 0.06); fGeo(F, 'trim', boxGeo(0.44, wh + 0.1, 0.04), px, ly, pz, o.shutter, r); }
}
function faceWindows(F, w, d, ly, ww, wh, spacing, skip, o) {
  const faces = [[0, d / 2, w], [Math.PI, d / 2, w], [Math.PI / 2, w / 2, d], [-Math.PI / 2, w / 2, d]];
  for (const [r, half, len] of faces) {
    if (o.faces && !o.faces.includes(r)) continue;
    const n = Math.max(1, Math.floor((len - 1) / spacing));
    for (let k = 0; k < n; k++) {
      const u = -len / 2 + (k + 0.5) * len / n;
      if (skip && skip(r, u)) continue;
      addWin(F, Math.sin(r) * half + u * Math.cos(r), ly, Math.cos(r) * half - u * Math.sin(r), r, ww, wh, o);
    }
  }
}

/* ============================================================
   Doors and signs
   ============================================================ */
const doorGeo = new THREE.BoxGeometry(1.04, 2.28, 0.07); doorGeo.translate(0.52, 1.14, 0);
const doorMats = new Map();
function doorMat(color) { let m = doorMats.get(color); if (!m) { m = new THREE.MeshStandardMaterial({ map: T.door, color, roughness: 0.5 }); doorMats.set(color, m); } return m; }
function makeDoor(F, lx, fl, lz, color, kind, name, sub) {
  const [hx, hz] = fw(F, lx - 0.52, lz);
  const pivot = new THREE.Group(); pivot.position.set(hx, fl, hz); pivot.rotation.y = F.a; scene.add(pivot);
  const inner = new THREE.Group(); pivot.add(inner);
  const m = new THREE.Mesh(doorGeo, doorMat(color)); m.castShadow = true; m.receiveShadow = true; inner.add(m);
  fGeo(F, 'trim', planeGeo(1.02, 2.26), lx, fl + 1.13, lz - 0.005, 0x0b0b0c);
  const [x, z] = fw(F, lx, lz);
  world.doors.push({ x, z, nx: F.s, nz: F.c, y: fl, inner, open: 0, kind, name, sub, seed: (Math.abs(Math.round(x * 131 + z * 977)) + 7) | 0, pivot });
}
function makeSign(F, lx, ly, lz, text, w, bg, fg) {
  const c = mkCanvas(1024, 256), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 8; g.strokeRect(14, 14, 996, 228);
  g.fillStyle = fg; g.font = '150px Lalezar, Vazirmatn, Tahoma, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillText(text, 512, 140, 940);
  const tex = toTex(c); tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.05, roughness: 0.45 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), mat);
  const [x, z] = fw(F, lx, lz); mesh.position.set(x, ly, z); mesh.rotation.y = F.a; scene.add(mesh);
  fBox(F, 'metal', lx, ly, lz - 0.06, w + 0.2, w / 4 + 0.2, 0.1, 0x22252a);
  world.signMats.push(mat);
}

/* ============================================================
   Buildings
   ============================================================ */
const HOUSE_COLS = [0xefe3cf, 0xe6d2b5, 0xd9e2e4, 0xf2e7dc, 0xe8c9a8, 0xcfd8c4, 0xf0d9c8, 0xd8cbb9, 0xe9dccb];
const ROOF_COLS = [0x8a3b2a, 0x6e4a3a, 0x4b5258, 0x7a2e24, 0x5a4136, 0x3d4a52, 0x8d5a3c];
const DOOR_COLS = [0x6b4423, 0x2f4a3a, 0x24375a, 0x7a2a22, 0x3b3b3b, 0x8a6a3c, 0x1f5f5f];
const APT_COLS = [0xd8c7ad, 0xc9b8a0, 0xe2d6c3, 0xb9a58c, 0xd4c4b4, 0xa9b0b3, 0xcdb9a2, 0xe0cfb8, 0xbfc6c0];
const SHOPS = [['نانوایی سنگک', '#7a3b1e'], ['سوپرمارکت ستاره', '#1f5f8b'], ['کافه نارنج', '#c2561a'], ['داروخانه شفا', '#1f7a4d'], ['کتاب‌فروشی پرسه', '#4b2a6b'], ['گل‌فروشی یاس', '#a33b6b'],
  ['میوه‌فروشی باغ', '#3d7a1f'], ['شیرینی‌پزی گلستان', '#8b2a3a'], ['لوازم‌التحریر رنگین', '#22557a'], ['عینک‌سازی نور', '#2a2a2a'], ['ابزار فروشی آهن', '#6b4a1f'], ['پوشاک آرمان', '#3a3a6b'],
  ['بستنی‌فروشی برف', '#2a7a8b'], ['آجیل‌فروشی تاجیک', '#7a5a1f'], ['ساعت‌سازی زمان', '#4a4a4a'], ['نقاشی و قاب رنگ', '#8b4a1f'], ['کافه کتاب', '#5a3a2a'], ['لبنیات کوهستان', '#2a5a8b'],
  ['قنادی شیرین', '#a3456b'], ['موبایل‌فروشی پیام', '#1f4a6b'], ['کفش‌فروشی گام', '#6b2a2a'], ['خشکشویی سپید', '#2a6b6b'], ['آرایشگاه آینه', '#4a2a5a'], ['چای‌خانه سنتی', '#6b3a1f'],
  ['کتابخانه محله', '#2a4a3a'], ['اسباب‌بازی شادی', '#b0451f'], ['عطاری گلپر', '#3a5a2a'], ['نانوایی بربری', '#7a4a2a'], ['سبزی‌فروشی تازه', '#2f6b2f'], ['کافه بهار', '#8b5a2a'], ['دفتر پست', '#1f3a6b'], ['بانک شهر', '#1f2f4a']];
let plate = 11, shopIdx = 0;

function buildHouse(cx, cz, qx, qz) {
  const facesX = R() < 0.5; const nx = facesX ? qx : 0, nz = facesX ? 0 : qz;
  const a = Math.atan2(nx, nz);
  const qcx = cx + qx * LOT / 2, qcz = cz + qz * LOT / 2;
  const w = rr(9.5, 12.5), d = rr(8, 10), floors = R() < 0.62 ? 2 : 1, fh = 3.0, H = floors * fh;
  const off = LOT / 2 - 4.8 - d / 2;
  const F = mkFrame(qcx + nx * off, qcz + nz * off, a);
  const brick = R() < 0.33, wallCol = brick ? 0xffffff : pick(HOUSE_COLS), roofCol = pick(ROOF_COLS), trimCol = pick([0xf4f1ea, 0xece4d6, 0xffffff]);
  const fl = CURB + 0.3, rh = rr(1.8, 2.6);
  fBox(F, 'trim', 0, CURB + 0.15, 0, w + 0.3, 0.3, d + 0.3, 0x8d8579);
  fBox(F, brick ? 'brick' : 'plaster', 0, fl + H / 2, 0, w, H, d, wallCol, { ts: 3 });
  { const [x, z] = fw(F, 0, 0); const c = Math.abs(F.c), s = Math.abs(F.s), hx = c * (w + 0.3) / 2 + s * (d + 0.3) / 2, hz = s * (w + 0.3) / 2 + c * (d + 0.3) / 2; CL.box(x - hx, x + hx, z - hz, z + hz, 0, fl + H + rh + 0.3); world.foot.push([x - hx, z - hz, x + hx, z + hz, brick ? '#a35b40' : '#d9cbb3']); }
  if (floors === 2) fBox(F, 'trim', 0, fl + fh, 0, w + 0.12, 0.18, d + 0.12, trimCol);
  fBox(F, 'trim', 0, fl + H + 0.06, 0, w + 0.16, 0.12, d + 0.16, trimCol);
  // gable roof (ridge along local x)
  const y0 = fl + H + 0.12, o = 0.55, hd = d / 2 + o, k = rh / (d / 2), eaveY = y0 - k * o;
  const len = Math.hypot(hd, rh + k * o), th = Math.atan2(rh + k * o, hd), cy = (y0 + rh + eaveY) / 2;
  fGeo(F, 'roof', boxGeo(w + 0.8, 0.14, len, 3), 0, cy, hd / 2, roofCol, 0, th);
  fGeo(F, 'roof', boxGeo(w + 0.8, 0.14, len, 3), 0, cy, -hd / 2, roofCol, 0, -th);
  const sh = new THREE.Shape([new V2(-d / 2, 0), new V2(d / 2, 0), new V2(0, rh)]);
  const gg = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false }); gg.translate(0, 0, -w / 2); gg.rotateY(Math.PI / 2); scaleUV(gg, 1 / 3);
  fGeo(F, brick ? 'brick' : 'plaster', gg, 0, y0, 0, wallCol);
  fBox(F, 'roof', 0, y0 + rh + 0.05, 0, w + 0.85, 0.16, 0.32, darker(roofCol));
  if (R() < 0.7) { const chx = rr(-w / 2 + 1.5, w / 2 - 1.5); fBox(F, 'brick', chx, y0 + rh * 0.75, -d / 4, 0.7, rh * 1.1, 0.7, 0xffffff, { ts: 3 }); fBox(F, 'trim', chx, y0 + rh * 1.32, -d / 4, 0.85, 0.12, 0.85, 0x6b6560); }
  // door
  const doorX = pick([0, -w / 2 + 2.2, w / 2 - 2.2]), dz = d / 2;
  fBox(F, 'trim', doorX, fl + 1.2, dz + 0.02, 1.4, 2.48, 0.12, trimCol);
  fBox(F, 'trim', doorX, CURB + 0.15, dz + 0.55, 1.9, 0.3, 1.0, 0xa59d90, { col: true });
  fBox(F, 'roof', doorX, fl + 2.78, dz + 0.6, 2.1, 0.12, 1.2, roofCol);
  for (const sx of [-0.9, 0.9]) fBox(F, 'trim', doorX + sx, fl + 2.6, dz + 0.3, 0.08, 0.3, 0.6, trimCol);
  fBox(F, 'emissive', doorX + 1.0, fl + 2.1, dz + 0.1, 0.16, 0.26, 0.14, 0xffffff);
  { const [gx, gz] = fw(F, doorX + 1.0, dz + 0.3); world.glow.push([gx, fl + 2.1, gz, 1, 0.82, 0.55, 1.4]); }
  makeDoor(F, doorX, fl, dz + 0.09, pick(DOOR_COLS), 'house', 'خانهٔ پلاک ' + fa(plate), 'به خانه خوش آمدی');
  plate += ri(1, 3);
  // windows
  const shutter = R() < 0.45 ? pick([0x2f5a3f, 0x24375a, 0x6b2a22, 0x5a4a3a, 0x3f5f6f]) : 0;
  for (let f = 0; f < floors; f++) {
    faceWindows(F, w, d, fl + f * fh + 1.55, 1.15, 1.35, 2.7, (r, u) => f === 0 && r === 0 && Math.abs(u - doorX) < 1.6, { mullion: true, shutter, frame: trimCol });
  }
  // yard: fence, path, mailbox, plants
  const fz = LOT / 2 - off - 0.3;
  const [gx, gz] = fw(F, doorX, fz);
  world.gates.push([gx, gz]); { const [ddx, ddz] = fw(F, doorX, dz); (world.paths || (world.paths = [])).push([gx, gz, ddx, ddz]); }
  const iron = R() < 0.35, fcol = iron ? 0x24272b : pick([0xf1eee8, 0xe8dcc8, 0xcdbb9e]);
  const ex = cx + qx * (LOT - 0.3), ez = cz + qz * (LOT - 0.3);
  const lotX0 = Math.min(cx, cx + qx * LOT), lotX1 = Math.max(cx, cx + qx * LOT), lotZ0 = Math.min(cz, cz + qz * LOT), lotZ1 = Math.max(cz, cz + qz * LOT);
  fenceLine(ex, lotZ0 + 0.5, ex, lotZ1 - 0.5, facesX ? gz : null, fcol, iron);
  fenceLine(lotX0 + 0.5, ez, lotX1 - 0.5, ez, facesX ? null : gx, fcol, iron);
  fBox(F, 'sidewalk', doorX, CURB + 0.012, (dz + 1.05 + fz) / 2, 1.3, 0.02, fz - dz - 1.05, 0xd8d2c8, { ts: 4 });
  fBox(F, 'metal', doorX + 1.3, CURB + 0.55, fz - 0.45, 0.08, 1.1, 0.08, 0x2a2d31);
  fBox(F, 'trim', doorX + 1.3, CURB + 1.18, fz - 0.45, 0.3, 0.26, 0.46, pick([0x1f3f6b, 0x8b1f1f, 0x2a2a2a, 0x2f5a3f]));
  { const [mx, mz] = fw(F, doorX + 1.3, fz - 0.45); CL.circle(mx, mz, 0.2, 0, CURB + 1.3); }
  const side = R() < 0.5 ? 1 : -1, tx = side * Math.min(w / 2 + rr(2.5, 4.5), LOT / 2 - 1.6), tz = rr(-d / 2, d / 2 + 2.2);
  { const [x, z] = fw(F, tx, tz); tree(x, z, rr(0.9, 1.25), R() < 0.2 ? 'pine' : 'round'); }
  for (let k = 0; k < 4; k++) { const bx = -w / 2 + 0.8 + k * (w - 1.6) / 3; if (Math.abs(bx - doorX) < 1.4) continue; const [x, z] = fw(F, bx, dz + 0.75); bush(x, z, rr(0.7, 1.0), CURB, R() < 0.25 ? pick([0x7a3b6b, 0xb04a5a, 0xd9a03a]) : undefined); }
  if (R() < 0.5) { const [x, z] = fw(F, -side * (w / 2 + 2), -d / 2 + 1); bench(x, z, F.a, CURB, false); }
}

function buildApartment(cx, cz, qx, qz) {
  const facesX = R() < 0.5; const nx = facesX ? qx : 0, nz = facesX ? 0 : qz;
  const a = Math.atan2(nx, nz);
  const qcx = cx + qx * LOT / 2, qcz = cz + qz * LOT / 2;
  const w = rr(17, 21), d = rr(13, 16), floors = ri(LOW ? 3 : 4, LOW ? 6 : 8), gfh = 4.2, ufh = 3.1, H = gfh + (floors - 1) * ufh;
  const off = LOT / 2 - 1.2 - d / 2;
  const F = mkFrame(qcx + nx * off, qcz + nz * off, a);
  const brick = R() < 0.38, wallCol = brick ? 0xffffff : pick(APT_COLS), band = pick([0xeee8de, 0xd9d2c6, 0x8f877c]);
  fBox(F, brick ? 'brick' : 'plaster', 0, CURB + H / 2, 0, w, H, d, wallCol, { ts: 3 });
  { const [x, z] = fw(F, 0, 0); const c = Math.abs(F.c), s = Math.abs(F.s), hx = c * (w + 0.3) / 2 + s * (d + 0.3) / 2, hz = s * (w + 0.3) / 2 + c * (d + 0.3) / 2; CL.box(x - hx, x + hx, z - hz, z + hz, 0, CURB + H + 3); world.foot.push([x - hx, z - hz, x + hx, z + hz, '#b9ad9c']); }
  fBox(F, 'trim', 0, CURB + gfh / 2, 0, w + 0.14, gfh, d + 0.14, 0x6f685f);
  // storefront
  const shopW = w - 5.2, shopX = -w / 2 + 0.8 + shopW / 2;
  fGeo(F, 'glassLit', planeGeo(shopW, 2.9), shopX, CURB + 1.75, d / 2 + 0.1, 0x2d2a26);
  for (let k = 0; k <= Math.round(shopW / 1.8); k++) fBox(F, 'metal', shopX - shopW / 2 + k * shopW / Math.round(shopW / 1.8), CURB + 1.75, d / 2 + 0.12, 0.08, 2.95, 0.06, 0x2a2d31);
  fBox(F, 'metal', shopX, CURB + 3.22, d / 2 + 0.12, shopW + 0.1, 0.1, 0.07, 0x2a2d31);
  const shopDoorX = shopX - shopW / 2 + 2.2;
  const [shopName, shopCol] = SHOPS[shopIdx++ % SHOPS.length];
  fBox(F, 'metal', shopDoorX, CURB + 1.2, d / 2 + 0.11, 1.35, 2.45, 0.1, 0x1f2226);
  makeDoor(F, shopDoorX, CURB, d / 2 + 0.17, 0x9aa3ab, 'shop', shopName, 'خوش آمدید');
  const awn = new THREE.Color(shopCol).lerp(new THREE.Color(0xffffff), 0.1).getHex();
  fBox(F, 'fabric', shopX, CURB + 3.5, d / 2 + 0.85, shopW + 0.3, 0.08, 1.7, awn, { rx: 0.3 });
  fBox(F, 'fabric', shopX, CURB + 3.1, d / 2 + 1.64, shopW + 0.3, 0.3, 0.04, darker(awn, 0.85));
  makeSign(F, shopX, CURB + 4.0 + 0.55, d / 2 + 0.2, shopName, Math.min(shopW * 0.8, 6.8), shopCol, '#fff6e6');
  // residential entrance
  const enX = w / 2 - 2.0;
  fBox(F, 'trim', enX, CURB + 1.25, d / 2 + 0.1, 1.6, 2.6, 0.12, 0xd9d2c6);
  fBox(F, 'trim', enX, CURB + 2.85, d / 2 + 0.7, 2.3, 0.14, 1.4, 0xd9d2c6);
  fBox(F, 'emissive', enX - 1.0, CURB + 2.3, d / 2 + 0.12, 0.16, 0.24, 0.12, 0xffffff);
  { const [gx, gz] = fw(F, enX - 1.0, d / 2 + 0.35); world.glow.push([gx, CURB + 2.3, gz, 1, 0.82, 0.55, 1.4]); }
  makeDoor(F, enX, CURB, d / 2 + 0.17, pick(DOOR_COLS), 'apt', 'ساختمان ' + fa(plate) + ' — واحد ' + fa(ri(1, floors * 2)), 'آپارتمان');
  plate += ri(1, 3);
  // upper floors
  const balcony = R() < 0.55;
  for (let f = 1; f < floors; f++) {
    const fy = CURB + gfh + (f - 1) * ufh;
    fBox(F, 'trim', 0, fy, 0, w + 0.1, 0.16, d + 0.1, band);
    faceWindows(F, w, d, fy + 1.55, 1.35, 1.6, 3.0, null, { sill: true, frame: 0xf2efe8, litP: 0.38, ac: 0.2 });
    if (balcony) {
      const n = Math.max(1, Math.floor((w - 1) / 3.0));
      for (let k = 1; k < n; k += 2) {
        const u = -w / 2 + (k + 0.5) * w / n;
        fBox(F, 'trim', u, fy + 0.02, d / 2 + 0.6, 2.5, 0.16, 1.2, band);
        fBox(F, 'glass', u, fy + 0.6, d / 2 + 1.18, 2.4, 0.9, 0.03, 0x9fb4c2);
        fBox(F, 'metal', u, fy + 1.07, d / 2 + 1.18, 2.5, 0.05, 0.06, 0x2a2d31);
        for (const sx of [-1.22, 1.22]) fBox(F, 'metal', u + sx, fy + 0.6, d / 2 + 0.6, 0.05, 0.95, 1.2, 0x2a2d31);
      }
    }
  }
  // ground-floor side windows
  faceWindows(F, w, d, CURB + 2.0, 1.4, 1.5, 3.4, null, { faces: [Math.PI / 2, -Math.PI / 2, Math.PI], sill: false, frame: 0x3a3631, litP: 0.5 });
  // roof
  fBox(F, 'trim', 0, CURB + H + 0.1, 0, w + 0.35, 0.22, d + 0.35, band);
  for (const [lx, lz, ww, dd] of [[0, d / 2, w + 0.35, 0.25], [0, -d / 2, w + 0.35, 0.25], [w / 2, 0, 0.25, d], [-w / 2, 0, 0.25, d]]) fBox(F, 'trim', lx, CURB + H + 0.6, lz, ww, 0.8, dd, band);
  for (let k = 0; k < ri(2, 4); k++) fBox(F, 'metal', rr(-w / 2 + 2, w / 2 - 2), CURB + H + 0.55, rr(-d / 2 + 2, d / 2 - 2), 1.1, 0.9, 0.8, 0xb7bbbf);
  { const [x, z] = fw(F, rr(-w / 3, w / 3), -d / 4); BT.add('metal', GEO.cyl16, x, CURB + H + 1.1, z, 0, 0xc9cdd1, 0, 0, 0.75, 1.6, 0.75); }
  fBox(F, 'plaster', -w / 4, CURB + H + 1.3, -d / 4, 3, 2.6, 3, wallCol, { ts: 3 });
  for (let k = 0; k < ri(1, 3); k++) { const [x, z] = fw(F, rr(-w / 2 + 1.5, w / 2 - 1.5), rr(0, d / 2 - 1.2)); BT.add('metal', GEO.cyl, x, CURB + H + 0.45, z, 0, 0x6a6e72, 0, 0, 0.04, 0.7, 0.04); BT.add('metal', new THREE.SphereGeometry(0.45, 14, 6, 0, Math.PI * 2, 0, 0.85), x, CURB + H + 0.85, z, R() * 6, 0xe8e8e6, -1.1); }
  { const [x, z] = fw(F, w / 3, 0); BT.add('metal', GEO.cyl, x, CURB + H + 2.5, z, 0, 0x30343a, 0, 0, 0.04, 4.2, 0.04); }
  // planters at the front
  for (const sx of [-w / 2 + 0.6, shopX + shopW / 2 + 0.7]) { fBox(F, 'trim', sx, CURB + 0.3, d / 2 + 0.9, 0.9, 0.6, 0.9, 0x6f685f, { col: true }); const [x, z] = fw(F, sx, d / 2 + 0.9); BT.add('foliage', pick(GEO.ico), x, CURB + 0.95, z, 0, pick(FOLIAGE), 0, 0, 0.5, 0.45, 0.5); }
}

function buildPark(cx, cz) {
  BT.add('sidewalk', quadUp(cx - LOT, cz - 1.7, cx + LOT, cz + 1.7, CURB + 0.008, 4));
  BT.add('sidewalk', quadUp(cx - 1.7, cz - LOT, cx + 1.7, cz + LOT, CURB + 0.009, 4));
  BT.add('sidewalk', scaleUV(new THREE.CylinderGeometry(8, 8, 0.02, 56), 4), cx, CURB + 0.012, cz);
  // fountain
  BT.add('trim', GEO.cyl16, cx, CURB + 0.3, cz, 0, 0xd8d2c6, 0, 0, 3.35, 0.6, 3.35);
  BT.add('trim', GEO.cyl16, cx, CURB + 0.64, cz, 0, 0xefe9de, 0, 0, 3.5, 0.1, 3.5);
  BT.add('trim', GEO.cyl, cx, CURB + 1.4, cz, 0, 0xd8d2c6, 0, 0, 0.4, 1.6, 0.4);
  BT.add('trim', new THREE.CylinderGeometry(1.3, 0.45, 0.4, 24), cx, CURB + 2.35, cz, 0, 0xefe9de);
  BT.add('trim', GEO.sphere, cx, CURB + 2.75, cz, 0, 0xd8d2c6, 0, 0, 0.18, 0.3, 0.18);
  CL.circle(cx, cz, 3.5, 0, CURB + 0.69); CL.circle(cx, cz, 0.5, 0, CURB + 2.8);
  world.fountains.push({ x: cx, z: cz });
  world.parks.push([cx - LOT, cz - LOT, cx + LOT, cz + LOT]);
  for (let k = 0; k < 4; k++) { const ang = Math.PI / 4 + k * Math.PI / 2; bench(cx + Math.sin(ang) * 9.6, cz + Math.cos(ang) * 9.6, ang + Math.PI, CURB); }
  const FL = [0xd8435a, 0xf2c14e, 0x9b5de5, 0xff8fab, 0xffffff, 0xf3722c];
  for (let k = 0; k < 64; k++) { const ang = k / 64 * Math.PI * 2; if (Math.abs(Math.sin(ang * 2)) < 0.22) continue; const r = 8.6 + R() * 0.6; BT.add('foliage', pick(GEO.ico), cx + Math.sin(ang) * r, CURB + 0.2, cz + Math.cos(ang) * r, 0, R() < 0.55 ? pick(FL) : 0x3f7a2a, 0, 0, 0.28, 0.25, 0.28); }
  let placed = 0, tries = 0;
  while (placed < (LOW ? 16 : 24) && tries++ < 300) {
    const x = cx + rr(-LOT + 2, LOT - 2), z = cz + rr(-LOT + 2, LOT - 2);
    if (Math.abs(x - cx) < 3.5 || Math.abs(z - cz) < 3.5 || Math.hypot(x - cx, z - cz) < 11.5) continue;
    tree(x, z, rr(0.9, 1.4), R() < 0.25 ? 'pine' : 'round'); placed++;
  }
  for (const [dx, dz] of [[11, 2.5], [-11, -2.5], [2.5, -11], [-2.5, 11], [20, 2.5], [-20, -2.5], [2.5, -20], [-2.5, 20]]) parkLamp(cx + dx, cz + dz);
  // perimeter hedge with gaps for the paths
  for (const s of [-1, 1]) {
    for (const [a0, a1] of [[-LOT + 0.5, -2.6], [2.6, LOT - 0.5]]) {
      const L = a1 - a0, m = (a0 + a1) / 2;
      BT.add('hedge', boxGeo(L, 0.8, 0.7, 2), cx + m, CURB + 0.4, cz + s * (LOT - 0.5), 0, 0x9cc47a); CL.box(cx + a0, cx + a1, cz + s * (LOT - 0.5) - 0.35, cz + s * (LOT - 0.5) + 0.35, 0, CURB + 0.8);
      BT.add('hedge', boxGeo(0.7, 0.8, L, 2), cx + s * (LOT - 0.5), CURB + 0.4, cz + m, 0, 0x9cc47a); CL.box(cx + s * (LOT - 0.5) - 0.35, cx + s * (LOT - 0.5) + 0.35, cz + a0, cz + a1, 0, CURB + 0.8);
    }
  }
}

/* ============================================================
   Traffic signals
   ============================================================ */
const signals = []; const sigOff = [];
let sigMesh = null;
function lightState(i, j, axis) {
  const t = (simTime + sigOff[i * (N + 1) + j]) % 28;
  if (axis === 0) return t < 10 ? 0 : t < 12.5 ? 1 : 2;
  return (t >= 14 && t < 24) ? 0 : (t >= 24 && t < 26.5) ? 1 : 2;
}
function buildSignals() {
  const pos = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    sigOff[i * (N + 1) + j] = Math.random() * 28;
    const cx = roadX(i), cz = roadX(j);
    for (let d = 0; d < 4; d++) {
      const [dx, dz] = DIRS[d]; const pi = i - dx, pj = j - dz; if (pi < 0 || pi > N || pj < 0 || pj > N) continue;
      const rx = -dz, rz = dx; // right of travel direction
      const px = cx - dx * (RH + 1.0) + rx * (RH + 1.0), pz = cz - dz * (RH + 1.0) + rz * (RH + 1.0);
      BT.add('metal', GEO.cyl, px, CURB + 2.6, pz, 0, 0x2b2f35, 0, 0, 0.1, 5.2, 0.1);
      const armL = RH + 1.0 - LANE + 0.4, ax = px - rx * armL / 2, az = pz - rz * armL / 2;
      BT.add('metal', boxGeo(0.09, 0.09, armL), ax, CURB + 5.1, az, Math.atan2(rx, rz), 0x2b2f35);
      const hx = px - rx * (RH + 1.0 - LANE), hz = pz - rz * (RH + 1.0 - LANE);
      const face = Math.atan2(-dx, -dz);
      BT.add('metal', boxGeo(0.4, 1.12, 0.3), hx, CURB + 4.45, hz, face, 0x1d2024);
      BT.add('metal', boxGeo(0.55, 1.3, 0.04), hx + dx * 0.17, CURB + 4.45, hz + dz * 0.17, face, 0x111316);
      CL.circle(px, pz, 0.16, 0, 5.3);
      const s = { i, j, axis: dx !== 0 ? 1 : 0, base: pos.length, st: -1 };
      for (let k = 0; k < 3; k++) pos.push([hx - dx * 0.16, CURB + 4.8 - k * 0.35, hz - dz * 0.16, face]);
      signals.push(s);
    }
  }
  const g = new THREE.CircleGeometry(0.13, 18);
  sigMesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ toneMapped: false }), pos.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  pos.forEach((p, k) => { q.setFromAxisAngle(new V3(0, 1, 0), p[3]); m.compose(new V3(p[0], p[1], p[2]), q, new V3(1, 1, 1)); sigMesh.setMatrixAt(k, m); sigMesh.setColorAt(k, new THREE.Color(0x222222)); });
  scene.add(sigMesh);
}
const SIG_ON = [new THREE.Color(4, 0.25, 0.2), new THREE.Color(3.2, 2.0, 0.2), new THREE.Color(0.2, 3.0, 1.0)];
const SIG_OFF = [new THREE.Color(0.18, 0.04, 0.04), new THREE.Color(0.16, 0.12, 0.03), new THREE.Color(0.03, 0.14, 0.07)];
function updateSignals() {
  let dirty = false;
  for (const s of signals) {
    const st = lightState(s.i, s.j, s.axis); if (st === s.st) continue; s.st = st; dirty = true;
    const lamp = st === 2 ? 0 : st === 1 ? 1 : 2;
    for (let k = 0; k < 3; k++) sigMesh.setColorAt(s.base + k, k === lamp ? SIG_ON[k] : SIG_OFF[k]);
  }
  if (dirty) sigMesh.instanceColor.needsUpdate = true;
}

/* ============================================================
   City
   ============================================================ */
function mark(x, z, len, wid, ry, color) { const g = new THREE.PlaneGeometry(wid, len); g.rotateX(-Math.PI / 2); BT.add('paint', g, x, 0.03, z, ry, color); }
function buildCity() {
  BT = new Batch(150); CL = world.col;
  const gg = new THREE.PlaneGeometry(1800, 1800, 48, 48); gg.rotateX(-Math.PI / 2); gg.translate(0, -0.04, 0);
  { const p = gg.attributes.position, uv = gg.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 7, -p.getZ(i) / 7); }
  BT.add('grass', gg);
  for (let i = 0; i <= N; i++) {
    const x = roadX(i);
    BT.add('asphalt', quadUp(x - RH, -HALF - RH, x + RH, HALF + RH, 0.012, 9));
    BT.add('asphalt', quadUp(-HALF - RH, x - RH, HALF + RH, x + RH, 0.01, 9));
  }
  const S = B - 2 * RH;
  for (let bi = 0; bi < N; bi++) for (let bj = 0; bj < N; bj++) BT.add('sidewalk', boxGeo(S, CURB, S, 4), blockC(bi), CURB / 2, blockC(bj), 0, 0xffffff);
  const E = HALF + RH, L2 = 2 * OUTER;
  for (const s of [-1, 1]) { BT.add('sidewalk', boxGeo(L2, CURB, SW, 4), 0, CURB / 2, s * (E + SW / 2)); BT.add('sidewalk', boxGeo(SW, CURB, L2, 4), s * (E + SW / 2), CURB / 2, 0); }
  // road markings
  const Y = 0xe8b923, W = 0xf2f2ee;
  for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) {
    const X = roadX(i), z0 = roadX(j) + RH + 4.6, z1 = roadX(j + 1) - RH - 4.6, mz = (z0 + z1) / 2, L = z1 - z0;
    for (const o of [-0.16, 0.16]) { mark(X + o, mz, L, 0.12, 0, Y); mark(mz, X + o, L, 0.12, Math.PI / 2, Y); }
    for (const o of [-5.3, 5.3]) { mark(X + o, mz, L, 0.14, 0, W); mark(mz, X + o, L, 0.14, Math.PI / 2, W); }
  }
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const cx = roadX(i), cz = roadX(j);
    for (let d = 0; d < 4; d++) {
      const [dx, dz] = DIRS[d]; if (i + dx < 0 || i + dx > N || j + dz < 0 || j + dz > N) continue;
      const px = -dz, pz = dx; // perpendicular
      for (let t = -RH + 1.0; t <= RH - 1.0; t += 1.15) mark(cx + dx * (RH + 2.3) + px * t, cz + dz * (RH + 2.3) + pz * t, 3, 0.55, Math.atan2(dx, dz), W);
      // stop line for traffic arriving from this arm (travelling -d)
      const rx = dz, rz = -dx; // right of -d
      mark(cx + dx * (RH + 4.3) + rx * 2.75, cz + dz * (RH + 4.3) + rz * 2.75, 5, 0.4, Math.atan2(rx, rz), W);
    }
  }
  // lots
  for (let bi = 0; bi < N; bi++) for (let bj = 0; bj < N; bj++) {
    const cx = blockC(bi), cz = blockC(bj);
    const type = (bi === 2 && bj === 2) ? 'park' : (bi >= 1 && bi <= 3 && bj >= 1 && bj <= 3) ? 'commercial' : 'residential';
    if (type !== 'commercial') { BT.add('grass', quadUp(cx - LOT, cz - LOT, cx + LOT, cz + LOT, CURB + 0.004, 7)); (world.grassAreas || (world.grassAreas = [])).push([cx, cz, type]); }
    if (type === 'park') buildPark(cx, cz);
    else if (type === 'residential') {
      for (const qx of [-1, 1]) for (const qz of [-1, 1]) buildHouse(cx, cz, qx, qz);
      BT.add('hedge', boxGeo(0.9, 1.3, 2 * LOT - 1, 2), cx, CURB + 0.65, cz, 0, 0x8fbc6c); CL.box(cx - 0.45, cx + 0.45, cz - LOT, cz + LOT, 0, CURB + 1.3);
      BT.add('hedge', boxGeo(2 * LOT - 1, 1.3, 0.9, 2), cx, CURB + 0.65, cz, 0, 0x8fbc6c); CL.box(cx - LOT, cx + LOT, cz - 0.45, cz + 0.45, 0, CURB + 1.3);
    } else {
      for (const qx of [-1, 1]) for (const qz of [-1, 1]) buildApartment(cx, cz, qx, qz);
      tree(cx + 2, cz - 2, 1.2); bench(cx - 2.5, cz + 2.5, Math.PI / 4); bin(cx + 3, cz + 3);
    }
    // street furniture on the four sidewalks
    for (let s = 0; s < 4; s++) {
      const [ox, oz] = DIRS[s];           // outward normal toward road
      const tx = -oz, tz = ox;            // tangent
      const edge = B / 2 - RH;            // curb distance from block centre
      for (const t of [-20, 0, 20]) { const x = cx + ox * (edge - 0.6) + tx * t, z = cz + oz * (edge - 0.6) + tz * t; streetLamp(x, z, ox, oz); }
      for (const t of [-10, 10]) {
        const x = cx + ox * (edge - 0.65) + tx * t, z = cz + oz * (edge - 0.65) + tz * t;
        if (world.gates.some(g => Math.hypot(g[0] - x, g[1] - z) < 6)) continue;
        BT.add('trim', boxGeo(1.4, 0.02, 1.4), x, CURB + 0.006, z, 0, 0x3a2e24); tree(x, z, rr(0.85, 1.1));
      }
      if (type === 'commercial') { for (const t of [-15, 15]) { const x = cx + ox * (edge - 1.0) + tx * t, z = cz + oz * (edge - 1.0) + tz * t; bench(x, z, Math.atan2(-ox, -oz)); } const bx = cx + ox * (edge - 0.7) + tx * 5, bz = cz + oz * (edge - 0.7) + tz * 5; bin(bx, bz); }
      if (R() < 0.5) hydrant(cx + ox * (edge - 0.5) + tx * -4, cz + oz * (edge - 0.5) + tz * -4);
      if (type === 'commercial' && s === (bi + bj) % 4) busStop(cx + ox * (LOT + 0.9) + tx * 6, cz + oz * (LOT + 0.9) + tz * 6, Math.atan2(ox, oz));
      if (type === 'commercial' && R() < 0.55) motorbike(cx + ox * (edge - 1.3) + tx * -7.5, cz + oz * (edge - 1.3) + tz * -7.5, Math.atan2(tx, tz) + rr(-0.3, 0.3));
    }
  }
  buildSignals();
  // manholes and Persian street-name signs
  for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) for (const sgn of [-1, 1]) {
    const X = roadX(i) + sgn * 1.6, z = roadX(j) + B / 2 + rr(-15, 15), g = new THREE.CircleGeometry(0.42, 18); g.rotateX(-Math.PI / 2);
    BT.add('paint', g, X, 0.006, z, 0, 0x2b2c2e); const g2 = new THREE.CircleGeometry(0.42, 18); g2.rotateX(-Math.PI / 2); BT.add('paint', g2, z, 0.006, roadX(i) - sgn * 1.6, 0, 0x2b2c2e);
  }
  STREET_V.forEach((n, i) => { M['sv' + i] = streetSignMat(n); }); STREET_H.forEach((n, i) => { M['sh' + i] = streetSignMat(n); });
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const px = roadX(i) - (RH + 2.4) * (i === 0 ? -1 : 1), pz = roadX(j) - (RH + 2.4) * (j === 0 ? -1 : 1);
    BT.add('metal', GEO.cyl, px, CURB + 1.5, pz, 0, 0x30343a, 0, 0, 0.05, 3.0, 0.05); CL.circle(px, pz, 0.08, 0, 3);
    for (const fc of [0, Math.PI]) { BT.add('sv' + i, planeGeo(1.4, 0.36), px + Math.sin(fc) * 0.03, CURB + 2.85, pz + Math.cos(fc) * 0.03, fc); BT.add('sh' + j, planeGeo(1.4, 0.36), px + Math.sin(fc + Math.PI / 2) * 0.03, CURB + 2.45, pz + Math.cos(fc + Math.PI / 2) * 0.03, fc + Math.PI / 2); }
  }
  // parking spots along every segment
  for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) {
    const X = roadX(i), z0 = roadX(j) + RH + 14, z1 = roadX(j + 1) - RH - 14;
    for (let z = z0; z <= z1; z += 7.5) {
      world.parking.push({ x: X - PARKOFF, z, h: 0 }); world.parking.push({ x: X + PARKOFF, z, h: Math.PI });
      world.parking.push({ x: z, z: X + PARKOFF, h: Math.PI / 2 }); world.parking.push({ x: z, z: X - PARKOFF, h: -Math.PI / 2 });
    }
  }
  // outskirts: field trees, boundary wall, forest
  let k = 0;
  while (k < (LOW ? 26 : 44)) {
    const x = rr(-BOUND + 4, BOUND - 4), z = rr(-BOUND + 4, BOUND - 4);
    if (Math.abs(x) < OUTER + 3 && Math.abs(z) < OUTER + 3) continue;
    tree(x, z, rr(1, 1.6), R() < 0.4 ? 'pine' : 'round', true, 0); k++;
  }
  for (const s of [-1, 1]) {
    BT.add('trim', boxGeo(2 * BOUND + 1.2, 1.4, 0.6, 3), 0, 0.7, s * BOUND, 0, 0x8a8378); CL.box(-BOUND - 1, BOUND + 1, s * BOUND - 0.3, s * BOUND + 0.3, 0, 1.4);
    BT.add('trim', boxGeo(0.6, 1.4, 2 * BOUND + 1.2, 3), s * BOUND, 0.7, 0, 0, 0x8a8378); CL.box(s * BOUND - 0.3, s * BOUND + 0.3, -BOUND - 1, BOUND + 1, 0, 1.4);
  }
  k = 0;
  while (k < (LOW ? 70 : 150)) {
    const x = rr(-BOUND - 45, BOUND + 45), z = rr(-BOUND - 45, BOUND + 45);
    if (Math.abs(x) < BOUND + 3 && Math.abs(z) < BOUND + 3) continue;
    tree(x, z, rr(1.2, 2.0), R() < 0.65 ? 'pine' : 'round', false, 0); k++;
  }
  BT.build(scene);
  buildGrass();
  buildGlow(); buildPools(); buildMountains(); buildFountainFX();
}

/* instanced grass tufts with wind, one mesh per block for culling */
let grassMat = null;
function buildGrass() {
  const per = { high: 2600, medium: 900, low: 0 }[settings.quality] ?? 900; if (!per) return;
  const blade = [], col = [];
  for (let b = 0; b < 5; b++) {
    const a = b / 5 * Math.PI + Math.random() * 0.4, h = 0.24 + Math.random() * 0.22, w = 0.035, lean = (Math.random() - 0.5) * 0.25, ox = (Math.random() - 0.5) * 0.12, oz = (Math.random() - 0.5) * 0.12;
    const c = Math.cos(a), sn = Math.sin(a), tipX = ox + lean * c, tipZ = oz + lean * sn;
    const v = [[ox - c * w, 0, oz - sn * w], [ox + c * w, 0, oz + sn * w], [tipX, h, tipZ]];
    for (const q of v) blade.push(...q);
    col.push(0.22, 0.34, 0.12, 0.22, 0.34, 0.12, 0.66, 0.8, 0.4);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(blade, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  { const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * 0.3, 1, n.getZ(i) * 0.3); n.needsUpdate = true; }
  grassMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.95 });
  grassMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = windUniform;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 gp = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
      float sway = position.y * position.y * 5.0;
      transformed.x += (sin(uTime*2.1 + gp.x*0.35 + gp.z*0.2) * 0.07 + sin(uTime*5.3 + gp.x*1.7) * 0.015) * sway;
      transformed.z += cos(uTime*1.7 + gp.z*0.3) * 0.05 * sway;`);
  };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new V3(), sc = new V3(), cc = new THREE.Color();
  for (const [cx, cz, type] of world.grassAreas) {
    const n = type === 'park' ? per * 1.6 | 0 : per; const mesh = new THREE.InstancedMesh(g, grassMat, n); let k = 0, tries = 0;
    while (k < n && tries++ < n * 6) {
      const x = cx + (Math.random() - 0.5) * 2 * (LOT - 0.4), z = cz + (Math.random() - 0.5) * 2 * (LOT - 0.4);
      if (type === 'park' && (Math.abs(x - cx) < 2 || Math.abs(z - cz) < 2 || Math.hypot(x - cx, z - cz) < 8.4)) continue;
      world.col.query(x - 0.12, x + 0.12, z - 0.12, z + 0.12, _near);
      if (_near.some(c => c.maxY > CURB + 0.2 && (c.t === 0 || Math.hypot(x - c.x, z - c.z) < c.r + 0.1))) continue;
      if (world.paths && world.paths.some(([ax, az, bx, bz]) => { const t = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2 || 1), 0, 1); return Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t) < 0.85; })) continue;
      const s_ = 0.6 + Math.random() * 0.5; e.set(0, Math.random() * 6.28, 0); q.setFromEuler(e); m4.compose(v.set(x, CURB, z), q, sc.set(s_, s_ * (0.8 + Math.random() * 0.5), s_));
      mesh.setMatrixAt(k, m4); cc.setHSL(0.22 + Math.random() * 0.07, 0.5 + Math.random() * 0.2, 0.42 + Math.random() * 0.2); mesh.setColorAt(k, cc); k++;
    }
    mesh.count = k; mesh.receiveShadow = true; mesh.castShadow = false; mesh.computeBoundingSphere(); scene.add(mesh);
  }
}
/* glow sprites for lamps & lamp light pools */
let glowPts, poolMesh, carGlow;
function buildGlow() {
  const n = world.glow.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  world.glow.forEach((g, i) => { pos.set([g[0], g[1], g[2]], i * 3); col.set([g[3], g[4], g[5]], i * 3); size[i] = g[6]; });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  glowPts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.6, map: T.glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false }));
  glowPts.frustumCulled = false; scene.add(glowPts);
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(400 * 3), 3)); cg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(400 * 3), 3));
  carGlow = new THREE.Points(cg, new THREE.PointsMaterial({ size: 1.1, map: T.glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false }));
  carGlow.frustumCulled = false; scene.add(carGlow);
}
function buildPools() {
  const n = world.pools.length, pos = [], uv = [], idx = [];
  world.pools.forEach(([x, z, r], i) => {
    const y = groundH(x, z) + 0.035;
    pos.push(x - r, y, z - r, x + r, y, z - r, x + r, y, z + r, x - r, y, z + r); uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    const b = i * 4; idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  poolMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: T.pool, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4 }));
  poolMesh.renderOrder = 2; scene.add(poolMesh);
}
let mountains;
function buildMountains() {
  // two rings of ridgelines around the horizon, tinted to the sky each frame
  mountains = new THREE.Group(); mountains.userData.mats = [];
  for (const [rad, hmin, hmax, shade, seed] of [[880, 40, 150, 0.62, 1.3], [760, 20, 85, 0.45, 4.1]]) {
    const n = 220, pos = [], idx = [];
    const ridge = a => { let h = 0, amp = 1, f = 1; for (let o = 0; o < 5; o++) { h += amp * (Math.sin(a * 3 * f + seed * (o + 1)) * 0.5 + 0.5) * (Math.sin(a * 7.3 * f + seed * 2.1 * o) * 0.35 + 0.65); amp *= 0.5; f *= 2.1; } return h / 1.6; };
    for (let k = 0; k <= n; k++) { const a = k / n * Math.PI * 2, h = hmin + (hmax - hmin) * ridge(a); pos.push(Math.sin(a) * rad, -20, Math.cos(a) * rad, Math.sin(a) * rad, h, Math.cos(a) * rad); if (k < n) { const b = k * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ color: 0x6a7a8a, fog: false, side: THREE.DoubleSide });
    mat.userData.shade = shade; mountains.userData.mats.push(mat);
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = -1; mountains.add(m);
  }
  scene.add(mountains);
}
let waterMeshes = [], spray;
function buildFountainFX() {
  const wm = new THREE.MeshStandardMaterial({ color: 0x3f7f9a, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.88 });
  for (const f of world.fountains) {
    const g = new THREE.CircleGeometry(3.1, 48, 0, Math.PI * 2); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, wm); m.position.set(f.x, CURB + 0.6, f.z); m.receiveShadow = true; scene.add(m); waterMeshes.push(m);
    const g2 = new THREE.CircleGeometry(1.22, 32); g2.rotateX(-Math.PI / 2); const m2 = new THREE.Mesh(g2, wm); m2.position.set(f.x, CURB + 2.5, f.z); scene.add(m2);
    const n = 320, pos = new Float32Array(n * 3), st = [];
    for (let i = 0; i < n; i++) st.push({ t: Math.random() * 1.3, a: Math.random() * Math.PI * 2, v: 1.3 + Math.random() * 0.5, up: 2.2 + Math.random() * 0.6 });
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    spray = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xd8f0ff, size: 0.09, transparent: true, opacity: 0.8, depthWrite: false }));
    spray.userData = { st, f }; spray.frustumCulled = false; scene.add(spray);
  }
}
function updateFountain(dt) {
  if (!spray) return;
  const { st, f } = spray.userData, p = spray.geometry.attributes.position.array;
  st.forEach((s, i) => {
    s.t += dt; let y = CURB + 2.8 + s.up * s.t - 4.9 * s.t * s.t;
    const r = Math.min(s.v * s.t + 0.1, 2.9);
    if (y < CURB + 0.6) { s.t = 0; y = CURB + 2.8; }
    p[i * 3] = f.x + Math.cos(s.a) * r; p[i * 3 + 1] = y; p[i * 3 + 2] = f.z + Math.sin(s.a) * r;
  });
  spray.geometry.attributes.position.needsUpdate = true;
}

/* ============================================================
   Sky, lights, time of day
   ============================================================ */
const skyUniforms = {
  uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color(0x3a4030) },
  uSunDir: { value: new V3(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uNight: { value: 0 }, uTime: { value: 0 }, uCloud: { value: 0.25 }, uFlash: { value: 0 }
};
const skyMat = new THREE.ShaderMaterial({
  uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
  fragmentShader: `uniform vec3 uZenith,uHorizon,uGround,uSunDir,uSunColor; uniform float uNight,uTime,uCloud,uFlash; varying vec3 vDir;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
    float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }
    void main(){
      vec3 d = normalize(vDir); float h = d.y;
      vec3 col = mix(uHorizon, uZenith, pow(clamp(h,0.,1.),0.42));
      col = mix(col, uGround, smoothstep(0.0,-0.12,h));
      float sd = max(dot(d,uSunDir),0.);
      float clear = 1.0 - smoothstep(0.55,0.95,uCloud);
      col = mix(col, vec3(dot(col,vec3(0.3,0.4,0.3)))*0.85, smoothstep(0.4,1.0,uCloud)*0.75);
      col += uSunColor*(pow(sd,1400.)*14.*clear + pow(sd,90.)*0.6*clear + pow(sd,8.)*0.22*(0.4+0.6*clear)) * smoothstep(-0.08,0.02,h);
      if(h>0.){
        vec2 uv = d.xz/(h+0.1)*0.9 + vec2(uTime*0.006,uTime*0.003);
        float cov = mix(0.6, 0.18, uCloud);
        float n1 = fbm(uv*1.3), c = smoothstep(cov, cov+0.3, n1);
        float shade = mix(1.0, 0.5, smoothstep(0.5,1.0,uCloud)) * (0.75 + 0.25*smoothstep(cov, cov+0.5, fbm(uv*1.3+vec2(0.04,0.03))));
        vec3 cc = mix(vec3(1.0), uHorizon, 0.35) * shade * mix(1.0, 0.16, uNight) + uSunColor*pow(sd,5.)*0.6*clear;
        col = mix(col, cc, c*smoothstep(0.0,0.3,h)*mix(0.8,0.97,uCloud));
      }
      col += uFlash*vec3(0.75,0.8,1.0)*(0.5+0.5*h);
      gl_FragColor = vec4(col,1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), skyMat); sky.frustumCulled = false; scene.add(sky);
const envScene = new THREE.Scene(); const envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat); envScene.add(envSky);
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null, envTod = -99, envCloud = 0;
let stars;
{
  const n = 1600, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, y = Math.abs(u) * 0.95 + 0.05, r = Math.sqrt(1 - y * y); p.set([Math.cos(a) * r * 900, y * 900, Math.sin(a) * r * 900], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  stars.frustumCulled = false; scene.add(stars);
}
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true; sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
{ const c = sun.shadow.camera; c.left = -46; c.right = 46; c.top = 46; c.bottom = -46; c.near = 1; c.far = 420; }
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xbcd4ff, 0x5a4a3a, 1.0); scene.add(hemi);
scene.fog = new THREE.Fog(0xbcd9f0, 90, 520);

let tod = 17.2, night = 0, dayF = 1;
const DAY_SPEED = 24 / 720; // 12 minutes per day
const C = (h) => new THREE.Color(h);
const SKY = { dayZ: C(0x2f6fc4), dayH: C(0xb9d6ef), setZ: C(0x3b4f8a), setH: C(0xf39a55), nightZ: C(0x03060d), nightH: C(0x131b2e) };
const sunDir = new V3(), _c1 = new THREE.Color(), _c2 = new THREE.Color();
function updateTimeOfDay() {
  const ang = (tod - 6) / 24 * Math.PI * 2;
  sunDir.set(Math.cos(ang), Math.sin(ang) * 0.92, 0.38).normalize();
  const elev = sunDir.y;
  dayF = smooth(-0.14, 0.22, elev); night = 1 - dayF;
  const golden = smooth(-0.16, 0.04, elev) * (1 - smooth(0.06, 0.42, elev));
  _c1.copy(SKY.nightZ).lerp(SKY.dayZ, dayF).lerp(SKY.setZ, golden * 0.6);
  _c2.copy(SKY.nightH).lerp(SKY.dayH, dayF).lerp(SKY.setH, golden * 0.85);
  skyUniforms.uZenith.value.copy(_c1); skyUniforms.uHorizon.value.copy(_c2);
  skyUniforms.uGround.value.copy(_c2).multiplyScalar(0.45);
  const moon = elev < -0.06;
  if (!moon) { skyUniforms.uSunDir.value.copy(sunDir); skyUniforms.uSunColor.value.setRGB(1, 0.85 - golden * 0.35, 0.65 - golden * 0.45).multiplyScalar(dayF * 1.4 + 0.2); }
  else { skyUniforms.uSunDir.value.set(-sunDir.x, -sunDir.y, sunDir.z * 0.6).normalize(); skyUniforms.uSunColor.value.setRGB(0.55, 0.6, 0.75).multiplyScalar(0.35); }
  skyUniforms.uNight.value = night;
  scene.fog.color.copy(_c2);
  const ld = moon ? skyUniforms.uSunDir.value : sunDir;
  sun.userData.dir = ld;
  sun.color.setRGB(1, 0.93 - golden * 0.3, 0.84 - golden * 0.45); if (moon) sun.color.setRGB(0.62, 0.72, 1);
  const cl = smooth(0.3, 1.0, weather.cloud), wet = weather.wet;
  skyUniforms.uCloud.value = weather.cloud; skyUniforms.uFlash.value = weather.flash * (Math.random() < 0.7 ? 1 : 0.3);
  _c2.lerp(C(0x8a929c).multiplyScalar(0.25 + 0.75 * dayF), cl * 0.55); scene.fog.color.copy(_c2);
  scene.fog.near = lerp(90, 20, weather.rain); scene.fog.far = lerp(520, 190, weather.rain);
  sun.intensity = (moon ? 0.35 * smooth(-0.06, -0.3, elev) : 3.1 * smooth(-0.04, 0.12, elev)) * (1 - 0.8 * cl);
  hemi.color.copy(_c1).lerp(C(0xffffff), 0.35).lerp(C(0xb8c0c8), cl * 0.6); hemi.groundColor.setRGB(0.32, 0.27, 0.21).multiplyScalar(0.4 + 0.6 * dayF);
  hemi.intensity = (0.28 + 0.75 * dayF) * (1 - 0.15 * cl) + weather.flash * 2.5;
  M.asphalt.roughness = lerp(0.93, 0.18, wet); M.asphalt.color.setScalar(lerp(1, 0.55, wet)); M.asphalt.envMapIntensity = lerp(1, 1.8, wet);
  M.sidewalk.roughness = lerp(0.86, 0.38, wet); M.sidewalk.color.setScalar(lerp(1, 0.75, wet)); M.roof.roughness = lerp(0.72, 0.3, wet); M.paint.roughness = lerp(0.55, 0.2, wet);
  renderer.toneMappingExposure = 1.0 + night * 0.12;
  stars.material.opacity = smooth(0.4, 0.95, night) * (1 - cl);
  M.glassLit.emissiveIntensity = night * 0.85;
  M.emissive.emissiveIntensity = night * 2.4 + 0.02;
  for (const m of world.signMats) m.emissiveIntensity = 0.05 + night * 0.9;
  if (glowPts) { glowPts.material.opacity = night * 0.5; poolMesh.material.opacity = night * 0.5; carGlow.material.opacity = 0.1 + night * 0.5; }
  if (mountains) for (const m of mountains.userData.mats) m.color.copy(_c2).lerp(_c1, 0.25).lerp(C(0x56677a), 0.45).multiplyScalar(m.userData.shade * (0.5 + 0.55 * dayF) + 0.25);
  M.winView.color.setRGB(0.75, 0.88, 1).multiplyScalar(0.12 + 0.95 * dayF).lerp(_c2, 0.25);
  if (CarMats.head) CarMats.head.emissiveIntensity = 0.3 + night * 2.2;
  if (Math.abs(tod - envTod) > 0.35 || envTod < 0 || Math.abs(weather.cloud - (envCloud ?? 0)) > 0.12) {
    envTod = tod; envCloud = weather.cloud; const rt = pmrem.fromScene(envScene, 0, 0.1, 1000);
    if (envRT) envRT.dispose(); envRT = rt; scene.environment = rt.texture; interiorScene.environment = rt.texture;
  }
  const hh = Math.floor(tod), mm = Math.floor((tod - hh) * 60);
  $('clock').textContent = fa(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'));
}
function cycleTime() { const pre = [7, 12.5, 17.6, 21.5]; let next = pre.find(p => p > tod + 0.1); if (next == null) next = pre[0]; tod = next; envTod = -99; }

/* ============================================================
   Weather, particles, skid marks, birds
   ============================================================ */
const weather = { state: 'clear', target: 'clear', cloud: 0.25, rain: 0, wet: 0, timer: 150 + Math.random() * 120, flash: 0, nextBolt: 8 };
const WEATHER_LABEL = { auto: 'هوا: خودکار', clear: 'هوا: آفتابی', cloudy: 'هوا: ابری', rain: 'هوا: بارانی' };
function applyWeatherSetting() { if (settings.weather !== 'auto') weather.target = settings.weather; $('btn-weather').textContent = WEATHER_LABEL[settings.weather]; }
let rainLines = null;
function buildRain() {
  const n = LOW ? 1000 : 2400, pos = new Float32Array(n * 6), st = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { st[i * 3] = (Math.random() - 0.5) * 50; st[i * 3 + 1] = Math.random() * 22; st[i * 3 + 2] = (Math.random() - 0.5) * 50; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  rainLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xc8d4e2, transparent: true, opacity: 0, depthWrite: false }));
  rainLines.frustumCulled = false; rainLines.userData.st = st; scene.add(rainLines);
}
function updateWeather(dt) {
  if (settings.weather === 'auto') { weather.timer -= dt; if (weather.timer < 0) { const r = Math.random(); weather.target = r < 0.5 ? 'clear' : r < 0.75 ? 'cloudy' : 'rain'; weather.timer = 120 + Math.random() * 200; } }
  const tc = { clear: 0.22, cloudy: 0.72, rain: 0.96 }[weather.target];
  weather.cloud = damp(weather.cloud, tc, 0.12, dt);
  weather.rain = damp(weather.rain, weather.target === 'rain' ? smooth(0.7, 0.92, weather.cloud) : 0, 0.25, dt);
  weather.wet = clamp(weather.wet + (weather.rain > 0.2 ? dt * 0.06 : -dt * 0.01), 0, 1);
  weather.state = weather.rain > 0.3 ? 'rain' : weather.cloud > 0.55 ? 'cloudy' : 'clear';
  if (weather.rain > 0.65) { weather.nextBolt -= dt; if (weather.nextBolt < 0) { weather.flash = 1; weather.nextBolt = 7 + Math.random() * 16; Audio.thunder(0.6 + Math.random() * 2.5); } }
  weather.flash = Math.max(0, weather.flash - dt * 2.5);
  Audio.rain(weather.rain * (player && player.where === 'in' ? 0.3 : 1));
  // rain streaks around the camera
  if (!rainLines) return;
  const show = weather.rain > 0.02 && player && player.where === 'out';
  rainLines.visible = show; if (!show) return;
  rainLines.material.opacity = 0.33 * weather.rain;
  const st = rainLines.userData.st, p = rainLines.geometry.attributes.position.array, cp = camera.position, n = st.length / 3, sp = 17 * dt;
  const active = Math.floor(n * weather.rain);
  for (let i = 0; i < n; i++) {
    let y = st[i * 3 + 1] - sp; if (y < -4) { y += 26; st[i * 3] = (Math.random() - 0.5) * 50; st[i * 3 + 2] = (Math.random() - 0.5) * 50; }
    st[i * 3 + 1] = y;
    const x = cp.x + st[i * 3], z = cp.z + st[i * 3 + 2], yy = cp.y - 6 + y, o = i * 6;
    if (i >= active) { p[o] = p[o + 3] = x; p[o + 1] = p[o + 4] = -100; p[o + 2] = p[o + 5] = z; continue; }
    p[o] = x; p[o + 1] = yy; p[o + 2] = z; p[o + 3] = x + 0.04; p[o + 4] = yy + 0.55; p[o + 5] = z + 0.02;
  }
  rainLines.geometry.attributes.position.needsUpdate = true;
  for (let k = 0; k < weather.rain * 6; k++) { const x = cp.x + (Math.random() - 0.5) * 24, z = cp.z + (Math.random() - 0.5) * 24; FX.emit(x, groundH(x, z) + 0.03, z, 0, 0.6, 0, 0.18, 0.08, 0.22, 0xdfe8f2, 0.5, 2); }
}

/* soft particle system (smoke, dust, splashes) */
const FX = {
  n: 0, max: LOW ? 500 : 900, pts: null, data: null,
  init() {
    const m = this.max, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(m * 3), 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(m), 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(m), 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(m * 3), 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: innerHeight * 0.5 }, uLight: { value: 1 } }, transparent: true, depthWrite: false, fog: false,
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying float vA; varying vec3 vC; uniform float uScale;
        void main(){ vA = aAlpha; vC = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / max(-mv.z, 0.1); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; varying vec3 vC; uniform float uLight;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d)*4.0; if(r>1.0) discard; float a = vA * (1.0-r) * (1.0-r); gl_FragColor = vec4(vC*uLight, a); }`
    });
    this.pts = new THREE.Points(g, mat); this.pts.frustumCulled = false; this.pts.renderOrder = 3; scene.add(this.pts);
    this.data = []; for (let i = 0; i < m; i++) this.data.push({ life: 0 });
  },
  emit(x, y, z, vx, vy, vz, life, s0, s1, color, alpha, grav = -0.3) {
    if (!this.data) return; const p = this.data[this.n]; this.n = (this.n + 1) % this.max;
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.life = p.max = life; p.s0 = s0; p.s1 = s1; p.a = alpha; p.g = grav; _col.set(color); p.r = _col.r; p.gg = _col.g; p.b = _col.b;
  },
  burst(x, y, z, n, color, alpha) { for (let i = 0; i < n; i++) this.emit(x, y, z, (Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3, 0.8 + Math.random() * 0.8, 0.3, 1.6, color, alpha, 3); },
  splash(x, y, z) { for (let i = 0; i < 4; i++) this.emit(x + (Math.random() - 0.5) * 0.2, y + 0.04, z + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.8, 0.9 + Math.random(), (Math.random() - 0.5) * 0.8, 0.3, 0.05, 0.1, 0xdbe6f0, 0.6, 9); },
  update(dt) {
    if (!this.pts) return;
    const g = this.pts.geometry, P = g.attributes.position.array, S = g.attributes.aSize.array, A = g.attributes.aAlpha.array, C = g.attributes.aColor.array;
    for (let i = 0; i < this.max; i++) {
      const p = this.data[i];
      if (p.life <= 0) { A[i] = 0; S[i] = 0; continue; }
      p.life -= dt; const t = 1 - Math.max(p.life, 0) / p.max;
      p.vy -= p.g * dt; const drag = Math.exp(-1.6 * dt); p.vx *= drag; p.vz *= drag; p.vy *= p.g > 0 ? 1 : drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z; S[i] = lerp(p.s0, p.s1, t); A[i] = p.a * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
      C[i * 3] = p.r; C[i * 3 + 1] = p.gg; C[i * 3 + 2] = p.b;
    }
    g.attributes.position.needsUpdate = g.attributes.aSize.needsUpdate = g.attributes.aAlpha.needsUpdate = g.attributes.aColor.needsUpdate = true;
    this.pts.material.uniforms.uLight.value = 0.35 + 0.65 * dayF; this.pts.material.uniforms.uScale.value = renderer.domElement.height * 0.5;
  }
};
/* tyre marks */
const Skids = {
  max: 1400, mesh: null, i: 0,
  init() {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.max * 18), 3));
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x0c0c0c, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 1; scene.add(this.mesh);
  },
  add(ax, az, bx, bz, y, w) {
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w, nz = dx / l * w, p = this.mesh.geometry.attributes.position.array, o = this.i * 18;
    const v = [ax + nx, y, az + nz, ax - nx, y, az - nz, bx + nx, y, bz + nz, bx + nx, y, bz + nz, ax - nx, y, az - nz, bx - nx, y, bz - nz];
    for (let k = 0; k < 18; k++) p[o + k] = v[k];
    this.i = (this.i + 1) % this.max; this.mesh.geometry.attributes.position.needsUpdate = true;
  }
};
function carEffects(c, dt) {
  const t = c.T, s = Math.sin(c.h), co = Math.cos(c.h), d = Math.hypot(c.x - camera.position.x, c.z - camera.position.z);
  if (d > 90) return;
  const slipping = c.slip > 2.4 && Math.abs(c.vf) > 2.5 || (c.inHand && Math.abs(c.vf) > 5);
  c.wpos = c.wpos || [null, null];
  for (let k = 0; k < 2; k++) {
    const lx = (k ? -1 : 1) * (t.wid / 2 - 0.1), lz = -t.wb / 2, wx = c.x + lx * co + lz * s, wz = c.z - lx * s + lz * co;
    if (slipping) {
      const lp = c.wpos[k]; if (lp && Math.hypot(wx - lp[0], wz - lp[1]) > 0.3) { Skids.add(lp[0], lp[1], wx, wz, groundH(wx, wz) + 0.022, 0.11); c.wpos[k] = [wx, wz]; } else if (!lp) c.wpos[k] = [wx, wz];
      if (Math.random() < 0.5 && weather.wet < 0.5) FX.emit(wx, c.y + 0.25, wz, (Math.random() - 0.5) * 1.5, 0.5, (Math.random() - 0.5) * 1.5, 1.6, 0.6, 3.2, 0xdedad4, 0.32, -0.25);
      if (weather.wet > 0.3 && Math.random() < 0.6) FX.emit(wx, c.y + 0.1, wz, (Math.random() - 0.5) * 2, 1.2, (Math.random() - 0.5) * 2, 0.5, 0.15, 0.5, 0xc8d4de, 0.4, 6);
    } else c.wpos[k] = null;
  }
  // spray from wet roads
  if (weather.wet > 0.4 && Math.abs(c.vf) > 7 && Math.random() < 0.5) { const lz = -t.wb / 2 - 0.3; FX.emit(c.x + lz * s, c.y + 0.2, c.z + lz * co, -c.vx * 0.1, 0.8, -c.vz * 0.1, 0.6, 0.3, 1.4, 0xcfd8e0, 0.25, 1); }
  // exhaust and engine smoke
  c.smokeAcc += dt;
  const ex = c.x + (-t.wid / 2 + 0.35) * co + (t.rear - 0.05) * s, ez = c.z - (-t.wid / 2 + 0.35) * s + (t.rear - 0.05) * co;
  if ((c.hasDriver || c.player) && c.smokeAcc > 0.22 && c.health > 0) { c.smokeAcc = 0; FX.emit(ex, c.y + 0.3, ez, -Math.sin(c.h) * 0.6, 0.25, -Math.cos(c.h) * 0.6, 1.2, 0.12, 0.7, 0xb8b8b8, Math.abs(c.inThrottle) > 0.5 ? 0.22 : 0.1, -0.35); }
  if (c.health < 45 && Math.random() < (c.health < 15 ? 0.7 : 0.3)) { const hz = t.front - 0.8; FX.emit(c.x + hz * s, c.y + t.beltY, c.z + hz * co, (Math.random() - 0.5) * 0.4, 0.9, (Math.random() - 0.5) * 0.4, 2.2, 0.4, 2.6, c.health < 15 ? 0x2a2a2a : 0x8a8a8a, 0.35, -0.5); }
}
/* birds circling over the city during the day */
let birds = null;
function buildBirds() {
  const n = 3 * 11, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.09, 0.42, 0.02, -0.04, 0, 0, -0.1], 3)); g.computeVertexNormals();
  const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0x2a2a2e, side: THREE.DoubleSide, roughness: 0.9 }), n * 2);
  m.frustumCulled = false; scene.add(m);
  birds = { m, list: [] };
  for (let f = 0; f < 3; f++) { const cx = (Math.random() - 0.5) * 260, cz = (Math.random() - 0.5) * 260, r = 30 + Math.random() * 40, h = 28 + Math.random() * 18, sp = (Math.random() < 0.5 ? 1 : -1) * (0.15 + Math.random() * 0.1); for (let k = 0; k < 11; k++) birds.list.push({ cx, cz, r: r + (Math.random() - 0.5) * 10, h: h + (Math.random() - 0.5) * 5, sp, a: Math.random() * 0.8 + f, ph: Math.random() * 6, off: Math.random() * 6 }); }
}
const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _be = new THREE.Euler(), _bp = new V3(), _bs = new V3();
function updateBirds(dt) {
  if (!birds) return; const vis = dayF > 0.35 && weather.rain < 0.4 && player.where === 'out'; birds.m.visible = vis; if (!vis) return;
  birds.list.forEach((b, i) => {
    b.a += b.sp * dt; b.ph += dt * (9 + Math.sin(simTime * 0.7 + b.off) * 4);
    const x = b.cx + Math.cos(b.a) * b.r + Math.sin(simTime * 0.3 + b.off) * 4, z = b.cz + Math.sin(b.a) * b.r, y = b.h + Math.sin(simTime * 0.5 + b.off) * 2, yaw = Math.atan2(-Math.sin(b.a) * b.sp, Math.cos(b.a) * b.sp);
    const flap = Math.sin(b.ph) * 0.7;
    for (const sd of [1, -1]) {
      _be.set(0, yaw, sd * flap, 'YXZ'); _bq.setFromEuler(_be); _bm.compose(_bp.set(x, y, z), _bq, _bs.set(sd, 1, 1)); birds.m.setMatrixAt(i * 2 + (sd > 0 ? 0 : 1), _bm);
    }
  });
  birds.m.instanceMatrix.needsUpdate = true;
  if (Math.random() < dt * 0.25) { const tr = world.treeSpots && world.treeSpots.length ? mpick(world.treeSpots) : null; if (tr) Audio.chirp(tr[0], tr[1]); }
}

/* ============================================================
   Characters
   ============================================================ */
const HG = {};
function initHumanGeo() {
  HG.torso = new THREE.CapsuleGeometry(0.155, 0.27, 4, 12);
  HG.pelvis = new THREE.CapsuleGeometry(0.13, 0.1, 4, 12); HG.pelvis.rotateZ(Math.PI / 2);
  HG.neck = new THREE.CylinderGeometry(0.05, 0.058, 0.13, 10);
  HG.head = new THREE.SphereGeometry(0.112, 18, 12);
  HG.hair = new THREE.SphereGeometry(0.121, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  { const g0 = new THREE.IcosahedronGeometry(0.126, 1), g = g0.index ? g0.toNonIndexed() : g0, p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const f = 1 + 0.09 * Math.sin(x * 140) * Math.sin(y * 150) * Math.sin(z * 130); p.setXYZ(i, x * f, y * f, z * f); } g.computeVertexNormals(); HG.curly = g; }
  HG.hairLong = new THREE.BoxGeometry(0.21, 0.36, 0.08);
  HG.scarf = new THREE.SphereGeometry(0.136, 14, 9, Math.PI * 0.75, Math.PI * 1.5, 0, Math.PI * 0.7);
  HG.drape = new THREE.ConeGeometry(0.21, 0.32, 16, 1, true);
  HG.coat = new THREE.CylinderGeometry(0.19, 0.27, 0.62, 18, 1, true);
  HG.beard = new THREE.SphereGeometry(0.118, 10, 4, 0, Math.PI, Math.PI * 0.5, Math.PI * 0.32);
  HG.cap = new THREE.SphereGeometry(0.125, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42);
  HG.brim = new THREE.BoxGeometry(0.2, 0.02, 0.13);
  HG.eyeW = new THREE.SphereGeometry(0.019, 8, 6);
  HG.pupil = new THREE.SphereGeometry(0.011, 6, 4);
  HG.brow = new THREE.BoxGeometry(0.042, 0.009, 0.012);
  HG.nose = new THREE.SphereGeometry(0.019, 6, 5);
  HG.mouth = new THREE.BoxGeometry(0.046, 0.013, 0.012);
  HG.ear = new THREE.SphereGeometry(0.03, 6, 5);
  HG.glasses = new THREE.BoxGeometry(0.125, 0.034, 0.01);
  HG.upper = new THREE.CapsuleGeometry(0.052, 0.2, 3, 8);
  HG.fore = new THREE.CapsuleGeometry(0.045, 0.19, 3, 8);
  HG.hand = new THREE.SphereGeometry(0.05, 8, 6);
  HG.thigh = new THREE.CapsuleGeometry(0.074, 0.3, 3, 10);
  HG.shin = new THREE.CapsuleGeometry(0.058, 0.32, 3, 8);
  HG.foot = new THREE.BoxGeometry(0.11, 0.08, 0.26); HG.foot.translate(0, 0, 0.05);
  HG.umb = new THREE.ConeGeometry(0.58, 0.24, 10, 1, true);
  HG.stick = new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6);
}
const SKIN = ['#f1c9a5', '#e0ac83', '#c68863', '#8d5a3b', '#f5d6bc', '#d9a27a'];
const HAIR = ['#1b1410', '#3b2516', '#6b4423', '#a37a4c', '#2a2a2a', '#8c8c8c'];
const SHIRT = ['#c0392b', '#2e86de', '#27ae60', '#f39c12', '#8e44ad', '#ecf0f1', '#34495e', '#d35400', '#16a085', '#7f8c8d', '#e84393', '#2d3436', '#f6e58d', '#6ab04c', '#b33939', '#40407a'];
const PANTS = ['#24324a', '#2b2b2b', '#6b5d4a', '#1f3b2e', '#444444', '#3d4f6b', '#5a4632'];
const SHOES = ['#111111', '#5a3a22', '#eeeeee', '#2b2b2b', '#7a2a2a'];
const SCARF = ['#1d1d1d', '#6b2a3a', '#2a3a6b', '#8a6a4a', '#3a5a3a', '#b0896a', '#5a2a5a'];
const COAT = ['#1d1d1d', '#3a3a4a', '#5a4632', '#2a3a5a', '#6b3a3a', '#4a4a3a', '#7a6a5a'];
const UMB = ['#1d1d1d', '#8b1f2a', '#1f4f8b', '#2f6b3a', '#d9a03a', '#5a2a6b'];
function randomLook() {
  const style = Math.random() < 0.3 ? 'scarf' : Math.random() < 0.3 ? 'long' : Math.random() < 0.15 ? 'curly' : Math.random() < 0.08 ? 'bald' : 'short';
  const female = style === 'scarf' || style === 'long';
  return { skin: mpick(SKIN), hair: mpick(HAIR), shirt: mpick(SHIRT), pants: female && Math.random() < 0.4 ? mpick(['#2b2b2b', '#3a2a4a', '#24324a']) : mpick(PANTS), shoes: mpick(SHOES),
    style, scarf: mpick(SCARF), sleeves: Math.random() < 0.5 || style === 'scarf', h: (female ? 0.92 : 0.97) + Math.random() * 0.1, female,
    coat: style === 'scarf' && Math.random() < 0.75 ? mpick(COAT) : null, beard: !female && Math.random() < 0.3, glasses: Math.random() < 0.18,
    iris: mpick(['#3a2414', '#2a1a10', '#4a6a3a', '#3a5a7a', '#5a3a1a']), umb: mpick(UMB), umbrella: Math.random() < 0.55, build: 0.92 + Math.random() * 0.18 };
}
/* Every body part of every person is one instance of a shared InstancedMesh,
   so a crowd costs a fixed handful of draw calls. */
const PARTS = {
  pelvis: ['pelvis', 0.9, 1], torso: ['torso', 0.85, 1], neck: ['neck', 0.6, 1], head: ['head', 0.55, 1], hair: ['hair', 0.85, 1], curly: ['curly', 0.9, 1], hairLong: ['hairLong', 0.85, 1],
  scarf: ['scarf', 0.95, 1, true], drape: ['drape', 0.95, 1, true], coat: ['coat', 0.9, 1, true], beard: ['beard', 0.95, 1], cap: ['cap', 0.8, 1], brim: ['brim', 0.8, 1],
  eyeW: ['eyeW', 0.2, 2, false, true], pupil: ['pupil', 0.1, 2, false, true], brow: ['brow', 0.9, 2, false, true], nose: ['nose', 0.6, 1, false, true], mouth: ['mouth', 0.5, 1, false, true],
  ear: ['ear', 0.6, 2, false, true], glasses: ['glasses', 0.15, 1, false, true],
  upper: ['upper', 0.85, 2], fore: ['fore', 0.8, 2], hand: ['hand', 0.6, 2], thigh: ['thigh', 0.9, 2], shin: ['shin', 0.9, 2], foot: ['foot', 0.55, 2],
  umb: ['umb', 0.5, 1, true], stick: ['stick', 0.4, 1]
};
const _zeroM = new THREE.Matrix4().makeScale(0, 0, 0), _hc = new THREE.Color();
class HumanPool {
  constructor(parent, cap) {
    this.parent = parent; this.cap = cap; this.free = []; for (let i = cap - 1; i >= 0; i--) this.free.push(i); this.people = new Set(); this.meshes = {};
    for (const [name, [geo, rough, per, dbl, noShadow]] of Object.entries(PARTS)) {
      const m = new THREE.InstancedMesh(HG[geo], new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: rough, side: dbl ? THREE.DoubleSide : THREE.FrontSide }), cap * per);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.castShadow = !noShadow; m.receiveShadow = true; m.frustumCulled = false; m.userData.keep = true; m.userData.per = per;
      for (let i = 0; i < cap * per; i++) { m.setMatrixAt(i, _zeroM); m.setColorAt(i, _hc.set(0xffffff)); }
      parent.add(m); this.meshes[name] = m;
    }
  }
  attach(p) {
    if (p.pool) p.pool.detach(p);
    this.free.sort((a, b) => b - a); const slot = this.free.pop(); if (slot === undefined) return false;
    p.pool = this; p.slot = slot; this.people.add(p);
    const used = {};
    for (const e of p.H.slots) { const m = this.meshes[e.part], k = used[e.part] = (used[e.part] ?? -1) + 1; e.idx = slot * m.userData.per + k; m.setColorAt(e.idx, _hc.set(e.color)); m.instanceColor.needsUpdate = true; }
    p.H.shown = true; return true;
  }
  detach(p) {
    if (p.pool !== this) return;
    for (const e of p.H.slots) { const m = this.meshes[e.part]; m.setMatrixAt(e.idx, _zeroM); m.instanceMatrix.needsUpdate = true; }
    this.people.delete(p); this.free.push(p.slot); p.pool = null;
  }
  update() {
    for (const p of this.people) {
      const H = p.H;
      if (!H.visible) { if (H.shown) { for (const e of H.slots) this.meshes[e.part].setMatrixAt(e.idx, _zeroM); H.shown = false; } continue; }
      H.root.updateMatrixWorld(true); H.shown = true;
      for (const e of H.slots) this.meshes[e.part].setMatrixAt(e.idx, (e.umb && !H.umb.visible) ? _zeroM : e.obj.matrixWorld);
    }
    let top = -1; for (const p of this.people) top = Math.max(top, p.slot);
    for (const m of Object.values(this.meshes)) { m.count = (top + 1) * m.userData.per; m.instanceMatrix.needsUpdate = true; }
  }
}
function makeHuman(look, detail) {
  const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);
  const slots = [];
  const add = (parent, part, color, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Object3D(); o.position.set(x, y, z); o.scale.set(sx, sy, sz); parent.add(o); slots.push({ part, obj: o, color, idx: 0 }); return o; };
  const hips = new THREE.Group(); hips.position.y = 0.95; rig.add(hips);
  const b = look.build || 1;
  add(hips, 'pelvis', look.pants, 0, 0.02, 0, b, 1, 0.78 * b);
  if (look.coat) add(hips, 'coat', look.coat, 0, -0.12, 0, 1.0 * b, 1, 0.82 * b);
  const spine = new THREE.Group(); spine.position.y = 0.05; hips.add(spine);
  add(spine, 'torso', look.coat || look.shirt, 0, 0.27, 0, 1.12 * b, 1, 0.72 * b);
  add(spine, 'neck', look.skin, 0, 0.56, 0.0);
  const head = new THREE.Group(); head.position.y = 0.64; spine.add(head);
  add(head, 'head', look.skin, 0, 0, 0, 1, 1.1, 1.04);
  const face = {};
  face.eyes = [-1, 1].map(s => add(head, 'eyeW', '#f2f0ea', s * 0.039, 0.02, 0.098));
  face.pupils = [-1, 1].map(s => add(head, 'pupil', look.iris || '#2a1d14', s * 0.039, 0.02, 0.112));
  face.brows = [-1, 1].map(s => add(head, 'brow', look.style === 'scarf' ? '#2a1d14' : look.hair, s * 0.04, 0.052, 0.106));
  add(head, 'nose', look.skin, 0, -0.008, 0.115, 0.85, 1.25, 1.1);
  face.mouth = add(head, 'mouth', '#8a3b3b', 0, -0.056, 0.104);
  for (const s of [-1, 1]) add(head, 'ear', look.skin, s * 0.11, 0.0, -0.01, 0.45, 1, 0.75);
  if (look.glasses) add(head, 'glasses', '#141414', 0, 0.022, 0.118);
  if (look.style === 'scarf') {
    add(head, 'scarf', look.scarf, 0, 0.0, -0.005, 1, 1.12, 1.06);
    add(head, 'drape', look.scarf, 0, -0.18, -0.02, 1.05, 1, 0.9);
  } else if (look.style !== 'bald') {
    if (look.style === 'curly') add(head, 'curly', look.hair, 0, 0.035, -0.02, 1, 0.92, 1.02);
    else add(head, 'hair', look.hair, 0, 0.012, -0.008, 1.02, 1.08, 1.06).rotation.x = -0.38;
    if (look.style === 'long') add(head, 'hairLong', look.hair, 0, -0.15, -0.08);
    if (look.cap) { add(head, 'cap', look.cap, 0, 0.03, 0, 1.03, 1.1, 1.05).rotation.x = -0.15; add(head, 'brim', look.cap, 0, 0.065, 0.13); }
  }
  if (look.beard) add(head, 'beard', look.hair, 0, -0.004, 0.006, 1, 1.05, 1.02);
  const sh = [], el = [], hp = [], kn = [], an = [], hd = [];
  let umb = null;
  for (const side of [1, -1]) {
    const s = new THREE.Group(); s.position.set(side * 0.215 * b, 0.47, 0); spine.add(s);
    add(s, 'upper', look.coat || look.shirt, 0, -0.14, 0, b, 1, b);
    const e = new THREE.Group(); e.position.y = -0.29; s.add(e);
    add(e, 'fore', look.sleeves || look.coat ? (look.coat || look.shirt) : look.skin, 0, -0.12, 0);
    const hand = new THREE.Group(); hand.position.y = -0.27; e.add(hand);
    add(hand, 'hand', look.skin, 0, 0, 0.01, 1, 1.15, 0.8);
    if (side === -1) { umb = new THREE.Group(); umb.position.set(0, -0.02, 0.02); umb.rotation.x = Math.PI / 2; hand.add(umb); add(umb, 'stick', '#2a2a2a', 0, 0.42, 0); add(umb, 'umb', look.umb || '#1d1d1d', 0, 0.86, 0); umb.visible = false; }
    sh.push(s); el.push(e); hd.push(hand);
    const h = new THREE.Group(); h.position.set(side * 0.095, 0, 0); hips.add(h);
    add(h, 'thigh', look.pants, 0, -0.22, 0, b, 1, b);
    const k = new THREE.Group(); k.position.y = -0.45; h.add(k);
    add(k, 'shin', look.pants, 0, -0.21, 0);
    const a = new THREE.Group(); a.position.y = -0.455; k.add(a);
    add(a, 'foot', look.shoes, 0, 0, 0);
    hp.push(h); kn.push(k); an.push(a);
  }
  // child objects of the umbrella group carry the visibility flag used by the pool
  for (const e of slots) if (umb && (e.obj.parent === umb)) e.umb = true;
  root.scale.setScalar(look.h || 1);
  return { root, rig, hips, spine, head, sh, el, hp, kn, an, hd, face, umb, slots, visible: true, shown: false };
}
let outdoorPool, interiorPool;
function makePerson(look, detail) {
  const p = { look, H: makeHuman(look, detail), pos: new V3(), vel: new V3(), facing: 0, onGround: true, radius: 0.3, height: 1.75,
    anim: { phase: Math.random() * 6, air: 0, airT: 0, land: 0, walkB: 0, runB: 0, knock: 0, look: 0, lookX: 0, blink: 2 + Math.random() * 3, talk: 0, talkT: 0, gesture: 0, special: null, sw: 0, seed: Math.random() * 100, idleKind: mpick(['breathe', 'breathe', 'look', 'phone', 'crossed', 'hips']), prep: 0, getup: 0 },
    standCar: null, mode: 'walk', timer: 0, bumpCD: 0, knockT: 0 };
  p.persona = makePersona(look, look.female);
  return p;
}
/* ---------- layered procedural animation ---------- */
const JK = ['hipY', 'hipX', 'hipZ', 'hipRy', 'spX', 'spY', 'spZ', 'hdX', 'hdY', 'hdZ', 'shLx', 'shLy', 'shLz', 'shRx', 'shRy', 'shRz', 'elL', 'elR', 'thLx', 'thLz', 'thRx', 'thRz', 'knL', 'knR', 'anL', 'anR', 'rigX', 'rigY', 'rigZ'];
const _P = {}, _Q = {};
function mixPose(w, Q) { if (w <= 0.001) return; for (const k in Q) _P[k] += (Q[k] - _P[k]) * w; }
function clearQ() { for (const k in _Q) delete _Q[k]; return _Q; }
function poseHuman(p, dt, t) {
  const H = p.H, a = p.anim, sd = a.seed;
  const raining = typeof weather !== 'undefined' && weather.rain > 0.3;
  const sp = Math.hypot(p.vel.x, p.vel.z) * (p.onGround ? 1 : 0.3);
  a.walkB = damp(a.walkB, clamp(sp / 1.1, 0, 1), 10, dt);
  a.runB = damp(a.runB, clamp((sp - 2.6) / 2.6, 0, 1), 6, dt);
  const stride = lerp(1.35, 2.5, a.runB);
  if (p.onGround) a.phase += sp * dt / stride * Math.PI * 2;
  a.air = damp(a.air, p.onGround ? 0 : 1, 12, dt); a.airT = p.onGround ? 0 : a.airT + dt;
  a.land = Math.max(0, a.land - dt * 4); a.prep = Math.max(0, a.prep - dt);
  const s = Math.sin(a.phase), c = Math.cos(a.phase), wB = a.walkB, rB = a.runB, iB = 1 - wB;
  // --- locomotion + idle base ---
  const legA = lerp(0.42, 0.85, rB) * wB, kneeA = lerp(0.7, 1.4, rB) * wB, armA = lerp(0.3, 0.85, rB) * wB;
  _P.thLx = -s * legA - 0.08 * rB; _P.thRx = s * legA - 0.08 * rB;
  _P.knL = 0.05 + kneeA * Math.max(0, c) + 0.18 * rB; _P.knR = 0.05 + kneeA * Math.max(0, -c) + 0.18 * rB;
  _P.anL = -(_P.thLx + _P.knL) * 0.65 * wB + 0.3 * Math.max(0, s) * wB; _P.anR = -(_P.thRx + _P.knR) * 0.65 * wB + 0.3 * Math.max(0, -s) * wB;
  _P.thLz = 0.02; _P.thRz = -0.02;
  _P.shLx = s * armA; _P.shRx = -s * armA; _P.shLy = 0; _P.shRy = 0;
  _P.shLz = 0.08 + 0.025 * Math.sin(t * 1.6 + sd) * iB; _P.shRz = -_P.shLz;
  _P.elL = -(0.2 + 1.0 * rB) - 0.12 * Math.max(0, -s) * wB - 0.05 * iB; _P.elR = -(0.2 + 1.0 * rB) - 0.12 * Math.max(0, s) * wB - 0.05 * iB;
  _P.spX = 0.03 + 0.22 * rB + Math.sin(t * 1.7 + sd) * 0.014 * iB; _P.spY = -s * 0.18 * wB; _P.spZ = 0;
  _P.hipY = 0.95 + lerp(0.025, 0.06, rB) * wB * (Math.abs(c) - 0.6) - rB * 0.04;
  _P.hipX = 0; _P.hipZ = s * 0.035 * wB + Math.sin(t * 0.35 + sd) * 0.035 * iB; _P.hipRy = s * 0.12 * wB;
  _P.hdX = -_P.spX * 0.6; _P.hdY = a.look; _P.hdZ = 0; _P.rigX = 0; _P.rigY = 0; _P.rigZ = 0;
  // weight shift while idle
  if (iB > 0.01) { const ws = Math.sin(t * 0.35 + sd); _P.thLz += ws * 0.03 * iB; _P.thRz += ws * 0.03 * iB; _P.knL += Math.max(0, ws) * 0.12 * iB; _P.knR += Math.max(0, -ws) * 0.12 * iB; }
  // idle variations
  const idleW = iB * (a.special || a.talk > 0.05 ? 0 : 1) * (p.npc ? 1 : 0.5);
  if (idleW > 0.01) {
    const Q = clearQ();
    switch (a.idleKind) {
      case 'look': Q.hdY = Math.sin(t * 0.45 + sd) * 0.7; Q.hdX = Math.sin(t * 0.31 + sd) * 0.12; break;
      case 'phone': Q.shRx = -0.95; Q.shRz = -0.18; Q.elR = -1.55; Q.shLx = -0.75; Q.elL = -1.5; Q.shLz = 0.25; Q.hdX = 0.4; break;
      case 'crossed': Q.shLx = -0.45; Q.shRx = -0.45; Q.shLy = 0.6; Q.shRy = -0.6; Q.elL = -1.85; Q.elR = -1.85; Q.shLz = 0.25; Q.shRz = -0.25; break;
      case 'hips': Q.shLz = 0.55; Q.shRz = -0.55; Q.elL = -1.6; Q.elR = -1.6; Q.shLy = -0.5; Q.shRy = 0.5; Q.shLx = 0.1; Q.shRx = 0.1; break;
    }
    mixPose(idleW, Q);
  }
  // umbrella in the rain (left hand)
  const holdUmb = raining && p.look.umbrella && p.npc && !a.special && p.mode !== 'down' && p.mode !== 'sit';
  if (H.umb) H.umb.visible = holdUmb;
  if (holdUmb) { const Q = clearQ(); Q.shRx = -0.4; Q.shRz = 0.05; Q.elR = -1.17; mixPose(1, Q); }
  // talking gestures
  if (a.talk > 0.01) {
    const Q = clearQ(), g = t * 2.2 + sd;
    Q.shRx = -0.55 - 0.25 * Math.sin(g); Q.shRz = -0.2 - 0.1 * Math.sin(g * 1.3); Q.elR = -1.2 + 0.35 * Math.sin(g * 1.7);
    Q.shLx = -0.25 - 0.2 * Math.max(0, Math.sin(g * 0.7 + 1)); Q.elL = -0.6 - 0.4 * Math.max(0, Math.sin(g * 0.7 + 1));
    Q.hdX = 0.06 * Math.sin(t * 5 + sd) - 0.05; Q.hdZ = 0.06 * Math.sin(t * 1.3);
    mixPose(a.talk * (holdUmb ? 0.4 : 1), Q);
  }
  // specials: wave / dance / sit / drive / laugh
  const sp_ = a.special;
  if (sp_) {
    a.sw = Math.min(1, a.sw + dt * 4);
    const Q = clearQ();
    if (sp_ === 'wave') { Q.shRz = -2.55; Q.shRx = -0.25; Q.elR = -0.5 + 0.45 * Math.sin(t * 11); Q.hdZ = 0.08; }
    else if (sp_ === 'laugh') { Q.spX = 0.25 + 0.06 * Math.sin(t * 14); Q.hdX = -0.2; Q.shLx = -0.3; Q.shRx = -0.3; Q.elL = -1.6; Q.elR = -1.6; Q.shLy = 0.4; Q.shRy = -0.4; }
    else if (sp_ === 'dance') {
      const d = t * 6.3 + sd;
      Q.hipZ = Math.sin(d) * 0.14; Q.hipY = 0.93 - Math.abs(Math.sin(d)) * 0.07; Q.hipRy = Math.sin(d * 0.5) * 0.3; Q.spY = -Math.sin(d * 0.5) * 0.45; Q.spZ = -Math.sin(d) * 0.15;
      Q.shLz = 1.6 + Math.sin(d) * 0.7; Q.shRz = -1.6 + Math.sin(d) * 0.7; Q.elL = -0.9 - 0.5 * Math.sin(d * 2); Q.elR = -0.9 + 0.5 * Math.sin(d * 2); Q.shLx = -0.4; Q.shRx = -0.4;
      Q.knL = 0.25 + Math.max(0, Math.sin(d)) * 0.6; Q.knR = 0.25 + Math.max(0, -Math.sin(d)) * 0.6; Q.thLx = -Math.max(0, Math.sin(d)) * 0.5; Q.thRx = -Math.max(0, -Math.sin(d)) * 0.5;
      Q.hdZ = Math.sin(d) * 0.15; Q.hdX = Math.sin(d * 2) * 0.1;
    } else if (sp_ === 'sit') {
      Q.hipY = 0.5; Q.thLx = -1.5; Q.thRx = -1.5; Q.knL = 1.45; Q.knR = 1.45; Q.anL = 0.05; Q.anR = 0.05; Q.thLz = 0.06; Q.thRz = -0.06;
      Q.spX = -0.06 + Math.sin(t * 1.5 + sd) * 0.015; Q.shLx = -0.4; Q.shRx = -0.4; Q.elL = -0.7; Q.elR = -0.7; Q.shLz = 0.12; Q.shRz = -0.12;
      if (a.idleKind === 'phone') { Q.shRx = -0.75; Q.elR = -1.9; Q.shLx = -0.7; Q.elL = -1.7; Q.hdX = 0.45; }
    } else if (sp_ === 'sitGround') {
      Q.hipY = 0.14; Q.thLx = -1.45; Q.thRx = -1.45; Q.knL = 0.3; Q.knR = 0.5; Q.thLz = 0.12; Q.thRz = -0.12; Q.spX = -0.28; Q.shLx = 0.55; Q.shRx = 0.55; Q.elL = -0.1; Q.elR = -0.1; Q.shLz = 0.3; Q.shRz = -0.3;
    } else if (sp_ === 'drive') {
      const st = p.steer || 0;
      Q.hipY = 0.18; Q.thLx = -1.35; Q.thRx = -1.35; Q.knL = 1.1; Q.knR = 1.1; Q.anL = 0.2; Q.anR = 0.2; Q.spX = -0.2; Q.hdX = 0.12;
      Q.shLx = -1.15 + st * 0.25; Q.shRx = -1.15 - st * 0.25; Q.shLz = 0.25; Q.shRz = -0.25; Q.elL = -0.55; Q.elR = -0.55; Q.hdY = -st * 0.25;
    }
    mixPose(a.sw, Q);
  } else a.sw = Math.max(0, a.sw - dt * 4);
  // jumping, falling, landing
  if (a.prep > 0) { const Q = clearQ(); Q.hipY = 0.8; Q.knL = 0.9; Q.knR = 0.9; Q.thLx = -0.45; Q.thRx = -0.45; Q.anL = 0.3; Q.anR = 0.3; Q.spX = 0.3; Q.shLx = 0.5; Q.shRx = 0.5; mixPose(1, Q); }
  if (a.air > 0.01) {
    const Q = clearQ(), fall = clamp((a.airT - 0.55) * 2, 0, 1);
    Q.thLx = -0.95; Q.thRx = -0.2; Q.knL = 1.45; Q.knR = 0.6; Q.shLx = -0.5; Q.shRx = -0.5; Q.shLz = 0.75; Q.shRz = -0.75; Q.elL = -0.7; Q.elR = -0.7; Q.anL = 0.3; Q.anR = 0.2;
    if (fall > 0) { Q.shLz = lerp(0.75, 1.6 + Math.sin(t * 13) * 0.6, fall); Q.shRz = lerp(-0.75, -1.6 + Math.sin(t * 13 + 1) * 0.6, fall); Q.thLx = lerp(-0.95, -0.3 + Math.sin(t * 9) * 0.4, fall); Q.thRx = lerp(-0.2, -0.3 - Math.sin(t * 9) * 0.4, fall); Q.spX = -0.15 * fall; }
    mixPose(a.air, Q);
  }
  if (a.land > 0) { const ld = a.land; _P.hipY -= ld * 0.18; _P.knL += ld * 0.8; _P.knR += ld * 0.8; _P.thLx -= ld * 0.42; _P.thRx -= ld * 0.42; _P.spX += ld * 0.28; _P.anL += ld * 0.3; _P.anR += ld * 0.3; }
  // knocked down / getting up
  const kn = a.knock;
  if (kn > 0.001) {
    const Q = clearQ();
    const flail = p.onGround ? 0 : 1;
    Q.rigX = -Math.PI / 2; Q.rigY = 0.13; Q.thLx = -0.15 + Math.sin(t * 15) * 0.5 * flail; Q.thRx = 0.1 - Math.sin(t * 13) * 0.5 * flail; Q.thLz = 0.25; Q.thRz = -0.25;
    Q.knL = 0.3; Q.knR = 0.1; Q.shLz = 1.4 + Math.sin(t * 12) * 0.5 * flail; Q.shRz = -1.4 - Math.sin(t * 11) * 0.5 * flail; Q.shLx = -0.3; Q.shRx = 0.2; Q.elL = -0.4; Q.elR = -0.5; Q.spX = -0.08; Q.hdX = -0.1; Q.hdY = 0.4;
    mixPose(kn, Q);
  }
  if (a.getup > 0) { // crouch-to-stand recovery
    const g = a.getup, Q = clearQ();
    Q.hipY = 0.45; Q.thLx = -1.6; Q.thRx = -0.4; Q.knL = 1.9; Q.knR = 2.0; Q.anL = 0.3; Q.anR = -0.5; Q.spX = 0.55; Q.shLx = -0.6; Q.shRx = 0.25; Q.elL = -0.6; Q.elR = -0.3; Q.shLz = 0.3; Q.shRz = -0.4;
    mixPose(g, Q);
  }
  // apply with smoothing
  const k = 1 - Math.exp(-20 * dt);
  const R_ = (o, ax, v) => { o.rotation[ax] += (v - o.rotation[ax]) * k; };
  R_(H.hp[0], 'x', _P.thLx); R_(H.hp[1], 'x', _P.thRx); R_(H.hp[0], 'z', _P.thLz); R_(H.hp[1], 'z', _P.thRz);
  R_(H.kn[0], 'x', _P.knL); R_(H.kn[1], 'x', _P.knR); R_(H.an[0], 'x', _P.anL); R_(H.an[1], 'x', _P.anR);
  R_(H.sh[0], 'x', _P.shLx); R_(H.sh[1], 'x', _P.shRx); R_(H.sh[0], 'y', _P.shLy); R_(H.sh[1], 'y', _P.shRy); R_(H.sh[0], 'z', _P.shLz); R_(H.sh[1], 'z', _P.shRz);
  R_(H.el[0], 'x', _P.elL); R_(H.el[1], 'x', _P.elR);
  R_(H.spine, 'x', _P.spX); R_(H.spine, 'y', _P.spY); R_(H.spine, 'z', _P.spZ);
  R_(H.hips, 'y', _P.hipRy); R_(H.hips, 'z', _P.hipZ); R_(H.hips, 'x', _P.hipX);
  R_(H.head, 'x', _P.hdX); R_(H.head, 'y', _P.hdY); R_(H.head, 'z', _P.hdZ);
  H.hips.position.y += (_P.hipY - H.hips.position.y) * k;
  const kr = 1 - Math.exp(-(kn > 0.5 ? 9 : 14) * dt);
  H.rig.rotation.x += (_P.rigX - H.rig.rotation.x) * kr; H.rig.position.y += (_P.rigY - H.rig.position.y) * kr;
  // face: blinking and lip movement
  a.blink -= dt;
  const bl = a.blink < 0.12 ? 0.12 : 1; if (a.blink < 0) a.blink = 2 + Math.random() * 4;
  for (const e of H.face.eyes) e.scale.y = bl; for (const e of H.face.pupils) e.scale.y = bl;
  a.talkT = Math.max(0, a.talkT - dt); a.talk = damp(a.talk, a.talkT > 0 ? 1 : 0, 6, dt);
  H.face.mouth.scale.y = a.talkT > 0 ? 1 + 2.4 * Math.abs(Math.sin(t * 17 + Math.sin(t * 7) * 2)) : (a.special === 'laugh' ? 3 : 1);
  for (const e of H.face.brows) e.position.y = 0.052 + (p.persona && p.persona.rel < -1 ? -0.006 : 0) + (a.talkT > 0 ? 0.004 * Math.sin(t * 6) : 0);
}

/* ============================================================
   Car models
   ============================================================ */
const CAR_TYPES = {
  sedan: { len: 4.5, wid: 1.84, wb: 2.7, wr: 0.34, mass: 1350, engine: 8.6, vmax: 52, roofY: 1.45, beltY: 0.98, cab: [-0.95, 0.2], headY: 0.68, tailY: 0.82, front: 2.27, rear: -2.27,
    body: [[-2.22, 0.3], [2.18, 0.3], [2.28, 0.52], [2.2, 0.8], [1.0, 0.97], [-1.4, 0.99], [-2.18, 0.94], [-2.28, 0.66]],
    cabin: [[-1.48, 0.94], [0.98, 0.94], [0.2, 1.42], [-0.92, 1.43]] },
  hatch: { len: 3.95, wid: 1.76, wb: 2.5, wr: 0.32, mass: 1100, engine: 8.2, vmax: 46, roofY: 1.47, beltY: 0.97, cab: [-1.6, 0.05], headY: 0.68, tailY: 0.86, front: 1.98, rear: -1.98,
    body: [[-1.95, 0.3], [1.92, 0.3], [2.0, 0.52], [1.92, 0.78], [0.85, 0.95], [-1.88, 0.99], [-1.98, 0.62]],
    cabin: [[-1.88, 0.94], [0.85, 0.93], [0.05, 1.46], [-1.65, 1.47], [-1.9, 1.15]] },
  suv: { len: 4.7, wid: 1.94, wb: 2.85, wr: 0.4, mass: 1900, engine: 8.0, vmax: 47, roofY: 1.8, beltY: 1.18, cab: [-2.0, 0.35], headY: 0.92, tailY: 1.02, front: 2.37, rear: -2.37,
    body: [[-2.32, 0.42], [2.28, 0.42], [2.38, 0.68], [2.3, 1.05], [1.1, 1.17], [-2.28, 1.2], [-2.38, 0.78]],
    cabin: [[-2.26, 1.15], [1.08, 1.14], [0.38, 1.76], [-2.05, 1.78], [-2.26, 1.52]] },
};
const CAR_COLS = [0xe9ebee, 0x15171b, 0xa9adb3, 0xb3161b, 0x1e4fa3, 0x1f4d3a, 0xc9b48a, 0x1b2a4a, 0xd9661f, 0x2a8c8c, 0x6b6f75, 0x7a1f3d];
const CarMats = {};
const carGeoCache = {};
function initCarMats() {
  CarMats.glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1118, roughness: 0.03, metalness: 0.2, envMapIntensity: 1.6, transparent: true, opacity: 0.55, clearcoat: 1, clearcoatRoughness: 0.02 });
  CarMats.chrome = new THREE.MeshStandardMaterial({ color: 0xd8dce1, roughness: 0.16, metalness: 1 });
  CarMats.tire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.93 });
  CarMats.black = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.55 });
  CarMats.interior = new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.85 });
  CarMats.head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dc, emissiveIntensity: 0.3, roughness: 0.05, metalness: 0.3 });
  CarMats.taxiSign = new THREE.MeshStandardMaterial({ map: T.taxi, emissive: 0xffffff, emissiveMap: T.taxi, emissiveIntensity: 0.6 });
}
const PLATE_L = ['ب', 'ج', 'د', 'س', 'ص', 'ط', 'ق', 'ل', 'م', 'ن', 'و', 'ه', 'ی'];
function plateTexture() {
  const c = mkCanvas(512, 112), g = c.getContext('2d');
  g.fillStyle = '#f7f7f2'; g.fillRect(0, 0, 512, 112); g.strokeStyle = '#111'; g.lineWidth = 6; g.strokeRect(3, 3, 506, 106);
  g.fillStyle = '#1f3f9a'; g.fillRect(6, 6, 62, 100);
  for (const [i, col] of ['#239f40', '#ffffff', '#da0000'].entries()) { g.fillStyle = col; g.fillRect(16, 14 + i * 12, 42, 12); }
  g.fillStyle = '#fff'; g.font = 'bold 18px Arial'; g.textAlign = 'center'; g.fillText('I.R.', 37, 74); g.fillText('IRAN', 37, 96);
  const d = () => Math.floor(Math.random() * 9 + 1);
  g.fillStyle = '#111'; g.font = '78px Vazirmatn, Tahoma, sans-serif'; g.textBaseline = 'middle'; g.direction = 'ltr';
  g.fillText(fa(`${d()}${d()}`), 120, 62); g.fillText(mpick(PLATE_L), 205, 58); g.fillText(fa(`${d()}${d()}${d()}`), 315, 62);
  g.fillRect(408, 6, 5, 100); g.font = '26px Vazirmatn, Tahoma, sans-serif'; g.fillText('ایران', 460, 30); g.font = '56px Vazirmatn, Tahoma, sans-serif'; g.fillText(fa(`${d()}${d()}`), 460, 74);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function mergeGeos(list) {
  const gs = list.map(([g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0]) => { const n = g.index ? g.toNonIndexed() : g.clone(); n.applyMatrix4(new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(1, 1, 1))); return n; });
  let total = 0; for (const g of gs) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2); let o = 0;
  for (const g of gs) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; g.dispose(); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.computeBoundingSphere(); return out;
}
function carGeos(type) {
  if (carGeoCache[type]) return carGeoCache[type];
  const t = CAR_TYPES[type], out = {};
  const ext = (pts, depth, bev, bs, segs = 4) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new V2(x, y))), { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bs, bevelSegments: segs, curveSegments: 6 }); g.translate(0, 0, -depth / 2); g.rotateY(-Math.PI / 2); g.computeVertexNormals(); return g; };
  const roofL = t.cab[1] - t.cab[0] + 0.1, B3 = (w, h, d) => new THREE.BoxGeometry(w, h, d), W = t.wid, cm = (t.cab[0] + t.cab[1]) / 2;
  out.paint = mergeGeos([[ext(t.body, W - 0.2, 0.1, 0.08, 5)], [B3(W - 0.24, 0.05, roofL), 0, t.roofY + 0.04, cm],
    [B3(0.08, 0.1, 0.2), W / 2 + 0.08, t.beltY + 0.07, t.cab[1] + 0.55], [B3(0.08, 0.1, 0.2), -W / 2 - 0.08, t.beltY + 0.07, t.cab[1] + 0.55]]);
  out.cabin = ext(t.cabin, W - 0.34, 0.05, 0.03);
  const cyl = (r, h, s = 12) => { const g = new THREE.CylinderGeometry(r, r, h, s); g.rotateX(Math.PI / 2); return g; };
  out.black = mergeGeos([[B3(W - 0.06, 0.24, 0.24), 0, 0.42, t.front - 0.05], [B3(W - 0.06, 0.24, 0.24), 0, 0.42, t.rear + 0.05],
    [B3(W * 0.46, 0.17, 0.06), 0, t.headY - 0.01, t.front - 0.0], [B3(0.04, 0.08, t.len * 0.62), W / 2 + 0.035, 0.42, 0], [B3(0.04, 0.08, t.len * 0.62), -W / 2 - 0.035, 0.42, 0],
    [B3(0.04, 0.42, 0.05), W / 2 - 0.12, t.beltY + 0.2, cm + 0.05, 0.12], [B3(0.04, 0.42, 0.05), -W / 2 + 0.12, t.beltY + 0.2, cm + 0.05, 0.12]]);
  out.chrome = mergeGeos([[B3(0.025, 0.025, roofL + 0.9), W / 2 - 0.09, t.beltY + 0.02, cm], [B3(0.025, 0.025, roofL + 0.9), -W / 2 + 0.09, t.beltY + 0.02, cm],
    [B3(W * 0.44, 0.018, 0.02), 0, t.headY + 0.04, t.front + 0.03], [B3(W * 0.44, 0.018, 0.02), 0, t.headY - 0.02, t.front + 0.03], [B3(W * 0.44, 0.018, 0.02), 0, t.headY - 0.07, t.front + 0.03],
    [cyl(0.035, 0.18), -W / 2 + 0.35, 0.3, t.rear - 0.02]]);
  out.interior = mergeGeos([[B3(W - 0.3, 0.22, 0.4), 0, t.beltY - 0.1, t.cab[1] + 0.32], [B3(0.5, 0.5, 0.12), W / 2 - 0.5, t.beltY - 0.15, cm - 0.35, -0.2], [B3(0.5, 0.5, 0.12), -W / 2 + 0.5, t.beltY - 0.15, cm - 0.35, -0.2],
    [B3(W - 0.3, 0.45, 0.12), 0, t.beltY - 0.12, t.cab[0] + 0.25, -0.15], [new THREE.TorusGeometry(0.17, 0.025, 6, 18), W / 2 - 0.5, t.beltY + 0.02, t.cab[1] + 0.1, -0.35]]);
  const arch = new THREE.CylinderGeometry(t.wr + 0.07, t.wr + 0.07, 0.02, 24); arch.rotateZ(Math.PI / 2);
  out.black2 = mergeGeos([[arch, W / 2 + 0.005, t.wr, t.wb / 2], [arch, -W / 2 - 0.005, t.wr, t.wb / 2], [arch, W / 2 + 0.005, t.wr, -t.wb / 2], [arch, -W / 2 - 0.005, t.wr, -t.wb / 2]]);
  const pl = new THREE.PlaneGeometry(0.52, 0.114);
  out.plateF = mergeGeos([[pl, 0, 0.44, t.front + 0.075]]); out.plateR = mergeGeos([[pl, 0, 0.52, t.rear - 0.075, 0, Math.PI]]);
  out.heads = mergeGeos([[B3(0.38, 0.13, 0.12), W / 2 - 0.3, t.headY, t.front - 0.04], [B3(0.38, 0.13, 0.12), -W / 2 + 0.3, t.headY, t.front - 0.04]]);
  out.tails = mergeGeos([[B3(0.36, 0.13, 0.1), W / 2 - 0.27, t.tailY, t.rear + 0.05], [B3(0.36, 0.13, 0.1), -W / 2 + 0.27, t.tailY, t.rear + 0.05], [B3(W * 0.36, 0.03, 0.06), 0, t.tailY + 0.04, t.rear + 0.04]]);
  out.blinkL = mergeGeos([[B3(0.1, 0.06, 0.08), W / 2 - 0.08, t.headY - 0.08, t.front - 0.03], [B3(0.1, 0.06, 0.08), W / 2 - 0.1, t.tailY - 0.1, t.rear + 0.04], [B3(0.03, 0.03, 0.08), W / 2 + 0.11, t.beltY + 0.07, t.cab[1] + 0.55]]);
  out.blinkR = mergeGeos([[B3(0.1, 0.06, 0.08), -W / 2 + 0.08, t.headY - 0.08, t.front - 0.03], [B3(0.1, 0.06, 0.08), -W / 2 + 0.1, t.tailY - 0.1, t.rear + 0.04], [B3(0.03, 0.03, 0.08), -W / 2 - 0.11, t.beltY + 0.07, t.cab[1] + 0.55]]);
  out.tire = new THREE.CylinderGeometry(t.wr, t.wr, 0.24, 28); out.tire.rotateZ(Math.PI / 2);
  { const g = new THREE.TorusGeometry(t.wr - 0.06, 0.06, 8, 28); g.rotateY(Math.PI / 2); out.tire = mergeGeos([[out.tire], [g, 0.11], [g, -0.11]]); }
  const rim = new THREE.CylinderGeometry(t.wr * 0.64, t.wr * 0.64, 0.252, 24); rim.rotateZ(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(t.wr * 0.18, t.wr * 0.18, 0.27, 12); hub.rotateZ(Math.PI / 2);
  const spoke = new THREE.BoxGeometry(0.262, 0.05, t.wr * 1.2);
  out.rim = mergeGeos([[rim], [hub], ...[0, 1, 2, 3, 4].map(k => [spoke, 0, 0, 0, k * Math.PI / 5])]);
  carGeoCache[type] = out; return out;
}
const _bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const _lv = new V3();
class Car {
  constructor(type, color, x, z, h, opts = {}) {
    this.type = type; this.T = CAR_TYPES[type]; this.taxi = !!opts.taxi;
    this.x = x; this.z = z; this.h = h; this.y = 0; this.vx = 0; this.vz = 0; this.av = 0; this.vf = 0; this.steer = 0; this.aiSteer = 0; this.accel = 0;
    this.inThrottle = 0; this.inSteer = 0; this.inHand = !opts.ai; this.braking = false; this.slip = 0;
    this.wheelRot = 0; this.pitch = 0; this.roll = 0; this.door = 0; this.doorT = 0; this.hasDriver = !!opts.ai;
    this.mass = this.T.mass; this.ai = null; this.player = false; this.bump = 0; this.health = 100; this.dents = 0; this.blink = null; this.blinkT = 0; this.hazardT = 0;
    this.smokeAcc = 0; this.driverP = null; this.owner = null;
    const t = this.T, G = carGeos(type);
    const paint = LOW ? new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.6 }) : new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.04 });
    this.paint = paint; this.G = G;
    this.tail = new THREE.MeshStandardMaterial({ color: 0x5a0a0a, emissive: 0xff1a12, emissiveIntensity: 0.4, roughness: 0.2 });
    this.bL = new THREE.MeshStandardMaterial({ color: 0x8a5a10, emissive: 0xffa21a, emissiveIntensity: 0, roughness: 0.3 });
    this.bR = new THREE.MeshStandardMaterial({ color: 0x8a5a10, emissive: 0xffa21a, emissiveIntensity: 0, roughness: 0.3 });
    const plate = new THREE.MeshStandardMaterial({ map: plateTexture(), roughness: 0.45 });
    const grp = this.group = new THREE.Group(); scene.add(grp);
    const body = this.body = new THREE.Group(); grp.add(body);
    const mk = (geo, mat, px = 0, py = 0, pz = 0, parent = body, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; };
    this.paintMesh = mk(G.paint, paint); mk(G.cabin, CarMats.glass, 0, 0, 0, body, false); mk(G.black, CarMats.black, 0, 0, 0, body, false);
    const near = this.lodNear = [], mid = this.lodMid = [];
    near.push(mk(G.chrome, CarMats.chrome, 0, 0, 0, body, false), mk(G.interior, CarMats.interior, 0, 0, 0, body, false),
      mk(G.plateF, plate, 0, 0, 0, body, false), mk(G.plateR, plate, 0, 0, 0, body, false), mk(G.blinkL, this.bL, 0, 0, 0, body, false), mk(G.blinkR, this.bR, 0, 0, 0, body, false));
    mid.push(mk(G.heads, CarMats.head, 0, 0, 0, body, false), mk(G.tails, this.tail, 0, 0, 0, body, false), mk(G.black2, CarMats.black, 0, 0, 0, grp, false));
    if (this.taxi) mk(_bx(0.62, 0.2, 0.26), CarMats.taxiSign, 0, t.roofY + 0.17, (t.cab[0] + t.cab[1]) / 2);
    // driver-side door (left = +x)
    const dp = this.doorPivot = new THREE.Group(); dp.position.set(t.wid / 2 + 0.02, t.beltY - 0.33, t.cab[1] + 0.62); body.add(dp);
    mid.push(mk(_bx(0.045, 0.6, 1.08), paint, 0.0, 0, -0.54, dp, false)); near.push(mk(_bx(0.03, 0.03, 0.16), CarMats.chrome, 0.03, 0.2, -0.86, dp, false), mk(_bx(0.02, 0.4, 0.9), CarMats.glass, -0.01, 0.52, -0.5, dp, false));
    this.wheels = [];
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const st = new THREE.Group(); st.position.set(sx * (t.wid / 2 - 0.1), t.wr, sz * t.wb / 2); grp.add(st);
      const sp = new THREE.Group(); st.add(sp);
      mk(G.tire, CarMats.tire, 0, 0, 0, sp); const r = mk(G.rim, CarMats.chrome, 0, 0, 0, sp, false); r.scale.x = sx; mid.push(r);
      this.wheels.push({ st, sp, front: sz > 0, sx, sz, susp: 0 });
    }
    this.lights = null;
    if (opts.ai) { this.ai = new CarAI(this, opts.ai.i, opts.ai.j, opts.ai.d); this.setDriver(makePerson(randomLook(), false)); this.owner = this.driverP; }
    this.sync(0);
  }
  setDriver(p) {
    if (this.driverP && this.driverP !== p && !this.driverP.isPlayer) outdoorPool.detach(this.driverP);
    this.driverP = p || null;
    if (p) { p.inCar = this; if (!p.pool) outdoorPool.attach(p); p.anim.special = 'drive'; p.anim.sw = 1; p.H.visible = true; }
  }
  seatPose(p) {
    const t = this.T, s = Math.sin(this.h), c = Math.cos(this.h), lx = t.wid / 2 - 0.5, lz = (t.cab[0] + t.cab[1]) / 2 - 0.08;
    const by = this.y + this.body.position.y + t.roofY - 0.1 - 0.965 * (p.look.h || 1);
    p.H.root.position.set(this.x + lx * c + lz * s, by, this.z - lx * s + lz * c);
    p.H.root.rotation.set(this.pitch, this.h, this.roll, 'YXZ');
    p.steer = this.steer * 2;
  }
  topAt(lf) { const t = this.T; return (lf >= t.cab[0] - 0.15 && lf <= t.cab[1] + 0.1) ? t.roofY + 0.06 : t.beltY - (lf > 0 ? 0.12 : 0); }
  damage(px, pz, py, nx, nz, s) {
    if (s < 3) return;
    this.health = Math.max(0, this.health - s * 1.6);
    if (this.dents > 40) return; this.dents++;
    if (!this.paintMesh.userData.own) { this.paintMesh.geometry = this.paintMesh.geometry.clone(); this.paintMesh.userData.own = true; }
    const g = this.paintMesh.geometry, pos = g.attributes.position;
    const c = Math.cos(this.h), sn = Math.sin(this.h);
    const dx = px - this.x, dz = pz - this.z, lx = dx * c - dz * sn, lz = dx * sn + dz * c; // world -> local
    const lnx = nx * c - nz * sn, lnz = nx * sn + nz * c;
    const amt = Math.min(0.16, s * 0.012), R2 = 0.85;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i), d = Math.hypot(vx - lx, (vy - (py ?? 0.7)) * 0.8, vz - lz);
      if (d > R2) continue; const f = (1 - d / R2) ** 2 * amt * (0.7 + 0.6 * Math.sin(vx * 37 + vz * 23));
      pos.setXYZ(i, vx + lnx * f, vy - f * 0.25, vz + lnz * f);
    }
    pos.needsUpdate = true; g.computeVertexNormals();
  }
  integrate(dt) {
    const t = this.T; const fx = Math.sin(this.h), fz = Math.cos(this.h), rx = -fz, rz = fx;
    let vf = this.vx * fx + this.vz * fz, vl = this.vx * rx + this.vz * rz;
    const power = this.health <= 0 ? 0 : this.health < 25 ? 0.55 : 1;
    const thr = this.inThrottle; let acc = 0, braking = false;
    if (thr > 0.02) { if (vf < -0.5) { acc = 13 * thr; braking = true; } else acc = power * t.engine * thr * Math.max(0, 1 - Math.max(0, vf) / t.vmax) * (vf < 10 ? 1.2 : 1); }
    else if (thr < -0.02) { if (vf > 0.5) { acc = 13 * thr; braking = true; } else acc = vf > -9 ? power * t.engine * 0.55 * thr : 0; }
    else acc = -Math.sign(vf) * Math.min(Math.abs(vf) / dt, 1.3);
    if (this.inHand) { acc += -Math.sign(vf) * Math.min(Math.abs(vf) / dt, 7.5); braking = true; }
    const wetGrip = 1 - weather.wet * 0.25;
    acc -= vf * Math.abs(vf) * 0.0021;
    const nvf = vf + acc * dt; vf = (braking && vf !== 0 && Math.sign(nvf) !== Math.sign(vf)) ? 0 : nvf;
    this.braking = braking && Math.abs(thr) > 0.02 || (this.inHand && this.hasDriver);
    const maxSt = 0.62 / (1 + Math.abs(vf) * 0.045);
    const tgt = this.ai ? clamp(this.aiSteer, -0.62, 0.62) : this.inSteer * maxSt;
    this.steer = damp(this.steer, tgt, 9, dt);
    const grip = (this.inHand ? 2.8 : 14 * wetGrip) * dt;
    const pvl = vl; vl += clamp(-vl, -grip, grip);
    this.slip = Math.abs(pvl) > 1.2 ? Math.abs(pvl) : 0;
    if (braking && Math.abs(vf) > 9 && Math.abs(thr) > 0.7) this.slip = Math.max(this.slip, 2.5);
    let yawT = -vf / t.wb * Math.tan(this.steer); if (this.inHand && Math.abs(vf) > 4) yawT *= 1.35;
    this.av = damp(this.av, yawT, 8, dt);
    this.h += this.av * dt;
    const sh = Math.sin(this.h), ch = Math.cos(this.h);
    this.vx = sh * vf - ch * vl; this.vz = ch * vf + sh * vl;
    this.x += this.vx * dt; this.z += this.vz * dt;
    this.vf = vf; this.accel = acc;
  }
  sync(dt) {
    const t = this.T;
    const gy = Math.max(groundH(this.x + Math.sin(this.h) * t.wb / 2, this.z + Math.cos(this.h) * t.wb / 2), groundH(this.x - Math.sin(this.h) * t.wb / 2, this.z - Math.cos(this.h) * t.wb / 2));
    this.y = dt ? damp(this.y, gy, 14, dt) : gy;
    this.group.position.set(this.x, this.y, this.z); this.group.rotation.y = this.h;
    this.wheelRot += this.vf * dt / t.wr;
    const lat = this.vf * this.av;
    this.roll = damp(this.roll, clamp(lat * 0.012, -0.075, 0.075), 6, dt || 1);
    this.pitch = damp(this.pitch, clamp(-this.accel * 0.0085, -0.055, 0.055), 6, dt || 1);
    this.bump = damp(this.bump, 0, 5, dt || 1);
    const road = Math.sin(simTime * 23 + this.x * 0.7) * Math.min(Math.abs(this.vf), 20) * 0.0005;
    this.body.rotation.set(this.pitch + this.bump * 0.3 + road * 2, 0, this.roll);
    this.body.position.y = 0.01 + road + this.bump * 0.05;
    for (const w of this.wheels) {
      w.sp.rotation.x = this.wheelRot; if (w.front) w.st.rotation.y = -this.steer;
      // suspension: wheels stay on the ground while the body pitches and rolls
      const comp = -(this.pitch * w.sz * t.wb / 2) + this.roll * w.sx * t.wid / 2;
      w.st.position.y = t.wr + clamp(comp, -0.06, 0.06) * 0.3;
    }
    this.door = damp(this.door, this.doorT, 7, dt || 1);
    this.doorPivot.rotation.y = -this.door * 1.15;
    const on = this.hasDriver || this.player;
    this.tail.emissiveIntensity = on ? (this.braking ? 3.2 : 0.4 + night * 1.0) : 0.15;
    // indicators
    this.blinkT += dt || 0; this.hazardT = Math.max(0, this.hazardT - (dt || 0));
    const mode = this.hazardT > 0 ? 'H' : this.blink; const ph = (this.blinkT % 0.8) < 0.4;
    this.bL.emissiveIntensity = (mode === 'L' || mode === 'H') && ph ? 3.5 : 0;
    this.bR.emissiveIntensity = (mode === 'R' || mode === 'H') && ph ? 3.5 : 0;
    if (this.player && mode && ph !== this._ph) { this._ph = ph; if (ph) Audio.tick(); }
    if (this.driverP) this.seatPose(this.driverP);
  }
  corners() { const t = this.T, fx = Math.sin(this.h), fz = Math.cos(this.h); return { fx, fz, rx: -fz, rz: fx, hl: t.len / 2, hw: t.wid / 2 }; }
}

/* ============================================================
   Traffic AI
   ============================================================ */
const laneOff = d => ({ x: -DIRS[d][1] * LANE, z: DIRS[d][0] * LANE });
function approachPt(i, j, d) { const lo = laneOff(d); return { x: roadX(i) - DIRS[d][0] * (RH + 5.5) + lo.x, z: roadX(j) - DIRS[d][1] * (RH + 5.5) + lo.z }; }
function exitPt(i, j, d) { const lo = laneOff(d); return { x: roadX(i) + DIRS[d][0] * (RH + 3) + lo.x, z: roadX(j) + DIRS[d][1] * (RH + 3) + lo.z }; }
const inGrid = (i, j) => i >= 0 && i <= N && j >= 0 && j <= N;
function projT(a, b, x, z) { const abx = b.x - a.x, abz = b.z - a.z, L2 = abx * abx + abz * abz || 1e-6; return ((x - a.x) * abx + (z - a.z) * abz) / L2; }
const segLen = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
class CarAI {
  constructor(car, i, j, d) { this.car = car; this.cruise = 9 + Math.random() * 4; this.stuck = 0; this.rev = 0; this.blockT = 0; this.waitT = 0; this.ignore = 0; this.reset(i, j, d); }
  reset(i, j, d) {
    this.i = i; this.j = j; this.d = d; this.k = 0;
    const A = approachPt(i, j, d);
    this.path = [{ x: this.car.x, z: this.car.z }, { x: A.x, z: A.z, stop: { i, j, axis: DIRS[d][0] !== 0 ? 1 : 0 } }];
    this.plan(); this.plan();
  }
  resetFromPos() {
    const c = this.car; let d = Math.round(((Math.atan2(Math.sin(c.h), Math.cos(c.h)) / (Math.PI / 2)) % 4 + 4)) % 4;
    // heading h: 0 => +z (d0), PI/2 => +x (d1)
    let i, j;
    if (DIRS[d][0] === 0) { i = nearestRoad(c.x).k; j = DIRS[d][1] > 0 ? Math.floor((c.z + HALF) / B) + 1 : Math.ceil((c.z + HALF) / B) - 1; }
    else { j = nearestRoad(c.z).k; i = DIRS[d][0] > 0 ? Math.floor((c.x + HALF) / B) + 1 : Math.ceil((c.x + HALF) / B) - 1; }
    if (!inGrid(i, j)) { d = (d + 2) % 4; i = clamp(i, 0, N); j = clamp(j, 0, N); }
    this.reset(clamp(i, 0, N), clamp(j, 0, N), d);
  }
  plan() {
    const { i, j, d } = this; const opts = [];
    for (const [nd, w] of [[d, 0.5], [(d + 1) % 4, 0.25], [(d + 3) % 4, 0.25]]) if (inGrid(i + DIRS[nd][0], j + DIRS[nd][1])) opts.push([nd, w]);
    let nd = (d + 2) % 4;
    if (opts.length) { let tot = opts.reduce((s, o) => s + o[1], 0), r = Math.random() * tot; for (const o of opts) { r -= o[1]; if (r <= 0) { nd = o[0]; break; } } if (r > 0) nd = opts[opts.length - 1][0]; }
    const last = this.path[this.path.length - 1]; last.turn = nd !== d; last.turnDir = nd === (d + 3) % 4 ? 'R' : nd === (d + 1) % 4 ? 'L' : null;
    const E = exitPt(i, j, nd);
    if (nd !== d) {
      const lo1 = laneOff(d), lo2 = laneOff(nd), P1 = { x: roadX(i) + lo1.x + lo2.x, z: roadX(j) + lo1.z + lo2.z };
      if (nd === (d + 2) % 4) { P1.x = roadX(i) + DIRS[d][0] * 4; P1.z = roadX(j) + DIRS[d][1] * 4; }
      for (let t = 0.2; t < 0.99; t += 0.2) { const u = 1 - t; this.path.push({ x: u * u * last.x + 2 * u * t * P1.x + t * t * E.x, z: u * u * last.z + 2 * u * t * P1.z + t * t * E.z, curve: true }); }
    }
    this.path.push({ x: E.x, z: E.z, curve: nd !== d });
    const ni = i + DIRS[nd][0], nj = j + DIRS[nd][1]; const A = approachPt(ni, nj, nd);
    this.path.push({ x: A.x, z: A.z, stop: { i: ni, j: nj, axis: DIRS[nd][0] !== 0 ? 1 : 0 } });
    this.i = ni; this.j = nj; this.d = nd;
  }
  update(dt, obstacles) {
    const c = this.car, p = this.path;
    while (this.k < p.length - 2 && projT(p[this.k], p[this.k + 1], c.x, c.z) >= 1) this.k++;
    if (this.k >= p.length - 4) this.plan();
    if (this.k > 8) { p.splice(0, this.k - 1); this.k = 1; }
    const a = p[this.k], b = p[this.k + 1];
    const t0 = clamp(projT(a, b, c.x, c.z), 0, 1), px = a.x + (b.x - a.x) * t0, pz = a.z + (b.z - a.z) * t0;
    if (Math.hypot(px - c.x, pz - c.z) > 22) { this.resetFromPos(); return; }
    // lookahead target
    let Ld = 3.6 + Math.abs(c.vf) * 0.42, tx = b.x, tz = b.z;
    const rem = segLen(a, b) * (1 - t0);
    if (Ld <= rem) { const f = Ld / Math.max(segLen(a, b), 1e-4); tx = px + (b.x - a.x) * f; tz = pz + (b.z - a.z) * f; }
    else { Ld -= rem; let idx = this.k + 1; while (idx < p.length - 1) { const L = segLen(p[idx], p[idx + 1]); if (Ld <= L) { const f = Ld / Math.max(L, 1e-4); tx = p[idx].x + (p[idx + 1].x - p[idx].x) * f; tz = p[idx].z + (p[idx + 1].z - p[idx].z) * f; break; } Ld -= L; idx++; tx = p[idx].x; tz = p[idx].z; } }
    const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -fz, rz = fx;
    const dx = tx - c.x, dz = tz - c.z, lf = dx * fx + dz * fz, lr = dx * rx + dz * rz;
    c.aiSteer = lf > 0 ? Math.atan2(2 * c.T.wb * lr, Math.max(dx * dx + dz * dz, 1)) : (lr >= 0 ? 0.62 : -0.62);
    // speed planning
    let target = this.cruise, dist = segLen({ x: px, z: pz }, b), found = null;
    for (let ii = this.k + 1; ii < p.length; ii++) { if (p[ii].stop) { found = p[ii]; break; } if (ii + 1 < p.length) dist += segLen(p[ii], p[ii + 1]); }
    if (a.curve || b.curve) target = Math.min(target, 6.5);
    let byLight = false;
    if (found) {
      if (found.turn && dist < 24) target = Math.min(target, 5.5 + dist * 0.3);
      const st = lightState(found.stop.i, found.stop.j, found.stop.axis);
      if (st === 2 || (st === 1 && dist > 8)) { const v = Math.max(0, dist - 1.2) * 0.75; if (v < target) { target = v; byLight = true; } }
    }
    let blocked = false;
    if (this.ignore > 0) this.ignore -= dt;
    else for (const o of obstacles) {
      if (o.ref === c) continue; const ox = o.x - c.x, oz = o.z - c.z; if (ox * ox + oz * oz > 900) continue;
      const of = ox * fx + oz * fz, orr = ox * rx + oz * rz;
      if (of > 0 && of < 30 && Math.abs(orr) < 1.3 + o.r * 0.55) {
        const gap = of - c.T.len / 2 - o.r, v = Math.max(0, (gap - 2.4) * 0.9);
        if (v < target) { target = v; blocked = true; if (o.player && gap < 5) this.blockT += dt; }
      }
    }
    if (blocked && c.vf < 0.5 && !byLight) { this.waitT += dt; if (this.waitT > 7) { this.ignore = 1.6; this.waitT = 0; } } else this.waitT = 0;
    if (this.blockT > 2.2) { this.blockT = -5; Audio.honk(c.x, c.z); }
    if (!blocked) this.blockT = Math.max(0, this.blockT - dt);
    if (this.rev > 0) { this.rev -= dt; c.inThrottle = -0.7; c.aiSteer = -c.aiSteer; c.inHand = false; return; }
    c.blink = (found && found.turnDir && dist < 34) ? found.turnDir : (a.curve || b.curve) ? c.blink : null;
    c.inThrottle = clamp((target - c.vf) * 0.55, -1, 1);
    c.inHand = target < 0.25 && c.vf < 0.6; if (c.inHand) c.inThrottle = 0;
    if (c.inThrottle > 0.4 && Math.abs(c.vf) < 0.3) { this.stuck += dt; if (this.stuck > 2.5) { this.rev = 1.4; this.stuck = 0; } } else this.stuck = Math.max(0, this.stuck - dt);
  }
}

/* ============================================================
   Collision maths
   ============================================================ */
const _near = [], _nearC = [], _rayNear = [];
const _axes = [[0, 0], [0, 0], [0, 0], [0, 0]];
function satCarAABB(car, c) {
  const { fx, fz, rx, rz, hl, hw } = car.corners();
  const bx = (c.minX + c.maxX) / 2, bz = (c.minZ + c.maxZ) / 2, ex = (c.maxX - c.minX) / 2, ez = (c.maxZ - c.minZ) / 2;
  const dx = car.x - bx, dz = car.z - bz; let best = 1e9, nx = 0, nz = 0;
  _axes[0][0] = 1; _axes[0][1] = 0; _axes[1][0] = 0; _axes[1][1] = 1; _axes[2][0] = fx; _axes[2][1] = fz; _axes[3][0] = rx; _axes[3][1] = rz;
  for (const [ax, az] of _axes) {
    const rA = hl * Math.abs(fx * ax + fz * az) + hw * Math.abs(rx * ax + rz * az), rB = ex * Math.abs(ax) + ez * Math.abs(az), d = dx * ax + dz * az;
    const o = rA + rB - Math.abs(d); if (o <= 0) return null;
    if (o < best) { best = o; const s = d < 0 ? -1 : 1; nx = ax * s; nz = az * s; }
  }
  const sf = (nx * fx + nz * fz) > 0 ? -1 : 1, sr = (nx * rx + nz * rz) > 0 ? -1 : 1;
  return { nx, nz, depth: best, px: car.x + sf * hl * fx + sr * hw * rx, pz: car.z + sf * hl * fz + sr * hw * rz };
}
function satCarCar(a, b) {
  const A = a.corners(), Bc = b.corners(); const dx = a.x - b.x, dz = a.z - b.z; let best = 1e9, nx = 0, nz = 0;
  const axes = [[A.fx, A.fz], [A.rx, A.rz], [Bc.fx, Bc.fz], [Bc.rx, Bc.rz]];
  for (const [ax, az] of axes) {
    const rA = A.hl * Math.abs(A.fx * ax + A.fz * az) + A.hw * Math.abs(A.rx * ax + A.rz * az);
    const rB = Bc.hl * Math.abs(Bc.fx * ax + Bc.fz * az) + Bc.hw * Math.abs(Bc.rx * ax + Bc.rz * az);
    const d = dx * ax + dz * az, o = rA + rB - Math.abs(d); if (o <= 0) return null;
    if (o < best) { best = o; const s = d < 0 ? -1 : 1; nx = ax * s; nz = az * s; }
  }
  const sf = (nx * Bc.fx + nz * Bc.fz) > 0 ? 1 : -1, sr = (nx * Bc.rx + nz * Bc.rz) > 0 ? 1 : -1;
  return { nx, nz, depth: best, px: b.x + sf * Bc.hl * Bc.fx + sr * Bc.hw * Bc.rx, pz: b.z + sf * Bc.hl * Bc.fz + sr * Bc.hw * Bc.rz };
}
function carCircle(car, cx, cz, r) {
  const { fx, fz, rx, rz, hl, hw } = car.corners();
  const dx = cx - car.x, dz = cz - car.z, lf = dx * fx + dz * fz, lr = dx * rx + dz * rz;
  const qf = clamp(lf, -hl, hl), qr = clamp(lr, -hw, hw); const ddf = lf - qf, ddr = lr - qr, d2 = ddf * ddf + ddr * ddr;
  if (d2 > r * r) return null;
  let nf, nr, depth;
  if (d2 > 1e-9) { const d = Math.sqrt(d2); nf = ddf / d; nr = ddr / d; depth = r - d; }
  else { const ox = hl - Math.abs(lf), oy = hw - Math.abs(lr); if (ox < oy) { nf = Math.sign(lf) || 1; nr = 0; depth = ox + r; } else { nf = 0; nr = Math.sign(lr) || 1; depth = oy + r; } }
  return { nx: -(nf * fx + nr * rx), nz: -(nf * fz + nr * rz), depth, px: car.x + qf * fx + qr * rx, pz: car.z + qf * fz + qr * rz, lf };
}
function carImpulse(car, nx, nz, depth, px, pz) {
  car.x += nx * depth; car.z += nz * depth;
  const vn = car.vx * nx + car.vz * nz;
  if (vn < 0) {
    const j = -(1.28) * vn; car.vx += j * nx; car.vz += j * nz;
    const tx = -nz, tz = nx, vt = car.vx * tx + car.vz * tz; car.vx -= vt * 0.12 * tx; car.vz -= vt * 0.12 * tz;
    const rxp = px - car.x, rzp = pz - car.z; car.av += (rzp * (j * nx) - rxp * (j * nz)) * 0.1;
    if (-vn > 2.2) onImpact(car, -vn, px, pz, nx, nz);
  }
}
function carCarResolve(a, b, r) {
  const ma = a.mass, mb = b.mass, sa = mb / (ma + mb), sb = ma / (ma + mb);
  a.x += r.nx * r.depth * sa; a.z += r.nz * r.depth * sa; b.x -= r.nx * r.depth * sb; b.z -= r.nz * r.depth * sb;
  const vn = (a.vx - b.vx) * r.nx + (a.vz - b.vz) * r.nz;
  if (vn < 0) {
    const j = -(1.3) * vn / (1 / ma + 1 / mb);
    a.vx += j / ma * r.nx; a.vz += j / ma * r.nz; b.vx -= j / mb * r.nx; b.vz -= j / mb * r.nz;
    const ax = r.px - a.x, az = r.pz - a.z, bx = r.px - b.x, bz = r.pz - b.z;
    a.av += (az * (j * r.nx) - ax * (j * r.nz)) / ma * 0.12; b.av -= (bz * (j * r.nx) - bx * (j * r.nz)) / mb * 0.12;
    if (-vn > 2) { onImpact(a, -vn * sa * 2, r.px, r.pz, r.nx, r.nz, b); onImpact(b, -vn * sb * 2, r.px, r.pz, -r.nx, -r.nz, a); if (b.ai && -vn > 4) b.ai.ignore = 0; }
  }
}
function carStatic(car) {
  const r = car.T.len / 2 + 0.6;
  world.col.query(car.x - r, car.x + r, car.z - r, car.z + r, _nearC);
  for (const c of _nearC) {
    if (c.maxY < 0.4 + car.y || c.minY > 1.5 + car.y) continue;
    const res = c.t === 0 ? satCarAABB(car, c) : carCircle(car, c.x, c.z, c.r);
    if (res) carImpulse(car, res.nx, res.nz, res.depth, res.px, res.pz);
  }
}
function onImpact(car, s, px, pz, nx, nz, other) {
  car.bump = Math.min(1, s * 0.12);
  if (car.player) { cam.shake = Math.min(0.6, cam.shake + s * 0.05); }
  if (s > 2.5) { Audio.crash(s, px, pz); FX.burst(px, car.y + 0.6, pz, Math.min(14, s * 1.5), 0xb8b2a8, 0.5); }
  if (nx !== undefined) car.damage(px, pz, car.y + 0.6, nx, nz, s);
  if (s > 3.5 && car.ai) {
    car.hazardT = 6; car.ai.waitT = 0;
    if (car.driverP && (!car.shoutCD || simTime > car.shoutCD)) { car.shoutCD = simTime + 6; say(car.driverP, mpick(['هوی! حواست کجاست؟!', 'چیکار می‌کنی؟!', 'ماشینم داغون شد!', 'مگه کوری؟!', 'یواش‌تر برو!'])); if (other && other.player) logEvent('یکی با ماشین زد به ماشین یه راننده تو ' + streetAt(px, pz) + '.'); }
    setTimeout(() => car.ai && Audio.honk(car.x, car.z), 500);
  }
}

/* character vs world */
const GRAV = 19, STEP = 0.36;
function stepCharacter(p, col, dt, outdoor) {
  if (p.standCar) { const c = p.standCar; const dx = p.pos.x - c.x, dz = p.pos.z - c.z, a = c.av * dt, ca = Math.cos(a), sa = Math.sin(a); p.pos.x = c.x + dx * ca + dz * sa + c.vx * dt; p.pos.z = c.z - dx * sa + dz * ca + c.vz * dt; p.facing += a; }
  p.vel.y -= GRAV * dt;
  p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;
  const r = p.radius; p.hitWall = false;
  for (let it = 0; it < 2; it++) {
    col.query(p.pos.x - r - 0.1, p.pos.x + r + 0.1, p.pos.z - r - 0.1, p.pos.z + r + 0.1, _near);
    for (const c of _near) {
      if (c.maxY <= p.pos.y + STEP || c.minY >= p.pos.y + p.height) continue;
      let nx, nz, pen;
      if (c.t === 0) {
        const qx = clamp(p.pos.x, c.minX, c.maxX), qz = clamp(p.pos.z, c.minZ, c.maxZ), dx = p.pos.x - qx, dz = p.pos.z - qz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-9) { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; pen = r - d; }
        else { const l = p.pos.x - c.minX, rt = c.maxX - p.pos.x, bt = p.pos.z - c.minZ, tp = c.maxZ - p.pos.z, m = Math.min(l, rt, bt, tp); if (m === l) { nx = -1; nz = 0; pen = l + r; } else if (m === rt) { nx = 1; nz = 0; pen = rt + r; } else if (m === bt) { nx = 0; nz = -1; pen = bt + r; } else { nx = 0; nz = 1; pen = tp + r; } }
      } else {
        const dx = p.pos.x - c.x, dz = p.pos.z - c.z, d = Math.hypot(dx, dz), R2 = r + c.r; if (d >= R2) continue;
        if (d > 1e-6) { nx = dx / d; nz = dz / d; } else { nx = 1; nz = 0; } pen = R2 - d;
      }
      p.pos.x += nx * pen; p.pos.z += nz * pen; const vn = p.vel.x * nx + p.vel.z * nz; if (vn < 0) { p.vel.x -= vn * nx; p.vel.z -= vn * nz; } p.hitWall = true;
    }
  }
  // cars as solid obstacles
  let standCar = null, carTop = -1;
  if (outdoor) for (const car of cars) {
    const dx = car.x - p.pos.x, dz = car.z - p.pos.z; if (dx * dx + dz * dz > 16) continue;
    const res = carCircle(car, p.pos.x, p.pos.z, r);
    if (!res) continue;
    const top = car.y + car.topAt(res.lf);
    if (p.pos.y >= top - STEP) { if (top > carTop) { carTop = top; standCar = car; } continue; }
    // push the person out (normal from person toward car)
    p.pos.x -= res.nx * res.depth; p.pos.z -= res.nz * res.depth;
    // only the car's own motion toward the person can knock them over
    const cvn = -(car.vx * res.nx + car.vz * res.nz), vn = -(p.vel.x * res.nx + p.vel.z * res.nz);
    if (cvn > 4.2 && p.mode !== 'down') knockDown(p, car, cvn);
    else if (cvn > vn) { p.vel.x += -res.nx * (cvn - vn); p.vel.z += -res.nz * (cvn - vn); }
  }
  // ground
  let g = outdoor ? groundH(p.pos.x, p.pos.z) : 0;
  const fr = r * 0.6;
  col.query(p.pos.x - fr, p.pos.x + fr, p.pos.z - fr, p.pos.z + fr, _near);
  for (const c of _near) {
    if (c.maxY > p.pos.y + STEP + 0.01 || c.maxY <= g) continue;
    if (c.t === 0) { if (p.pos.x + fr < c.minX || p.pos.x - fr > c.maxX || p.pos.z + fr < c.minZ || p.pos.z - fr > c.maxZ) continue; }
    else if (Math.hypot(p.pos.x - c.x, p.pos.z - c.z) > c.r + fr) continue;
    g = c.maxY;
  }
  p.standCar = null;
  if (standCar && carTop > g) { g = carTop; p.standCar = standCar; }
  p.pos.y += p.vel.y * dt;
  if (p.pos.y <= g) { if (p.vel.y < -6) p.anim.land = Math.min(1, -p.vel.y / 14); p.pos.y = g; if (p.vel.y < 0) p.vel.y = 0; p.onGround = true; }
  else if (p.onGround && p.pos.y - g < 0.42 && p.vel.y <= 0) { p.pos.y = g; p.vel.y = 0; }
  else { p.onGround = false; p.standCar = null; }
  if (!outdoor && p.pos.y + p.height > 3.05) { p.pos.y = 3.05 - p.height; if (p.vel.y > 0) p.vel.y = 0; }
}
function separatePeople(list) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j]; const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, R2 = a.radius + b.radius, d2 = dx * dx + dz * dz;
    if (d2 >= R2 * R2 || d2 < 1e-8 || Math.abs(a.pos.y - b.pos.y) > 1.4) continue;
    const d = Math.sqrt(d2), pen = R2 - d, nx = dx / d, nz = dz / d;
    const wa = a.isPlayer ? 0.25 : b.isPlayer ? 0.75 : 0.5;
    a.pos.x -= nx * pen * wa; a.pos.z -= nz * pen * wa; b.pos.x += nx * pen * (1 - wa); b.pos.z += nz * pen * (1 - wa);
    if (a.isPlayer || b.isPlayer) {
      const pl = a.isPlayer ? a : b, o = a.isPlayer ? b : a;
      const sp = Math.hypot(pl.vel.x, pl.vel.z);
      if (o.npc && o.bumpCD <= 0 && sp > 2.2 && o.mode !== 'down') { o.bumpCD = 4; say(o, mpick(['هی! حواست کجاست؟', 'ببخشید!', 'آرام‌تر!', 'مواظب باش!', 'اوه!'])); o.vel.x += nx * (a.isPlayer ? 1 : -1) * sp * 0.5; o.vel.z += nz * (a.isPlayer ? 1 : -1) * sp * 0.5; o.anim.look = 0; }
    }
  }
}
function knockDown(p, car, imp) {
  p.mode = 'down'; p.knockT = 0; p.onGround = false; p.standCar = null;
  p.vel.set(car.vx * 0.85, 2.5 + imp * 0.22, car.vz * 0.85);
  p.facing = Math.atan2(-car.vx, -car.vz);
  car.vx *= 0.93; car.vz *= 0.93;
  Audio.thud(imp, p.pos.x, p.pos.z);
  if (p.npc) say(p, mpick(['آخ!', 'کمک!', 'آی کمرم!', 'مگه کوری؟!']));
  if (p.isPlayer) cam.shake = 0.5;
}
function rayCast(col, ox, oy, oz, dx, dy, dz, maxD, minR = 0.45) {
  let tmin = maxD; const ex = ox + dx * maxD, ez = oz + dz * maxD;
  col.query(Math.min(ox, ex) - 0.2, Math.max(ox, ex) + 0.2, Math.min(oz, ez) - 0.2, Math.max(oz, ez) + 0.2, _rayNear);
  for (const c of _rayNear) {
    if (c.t === 0) {
      let t0 = 0, t1 = tmin, ok = true;
      for (const [o, d, mn, mx] of [[ox, dx, c.minX, c.maxX], [oy, dy, c.minY, c.maxY], [oz, dz, c.minZ, c.maxZ]]) {
        if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) { ok = false; break; } continue; }
        let ta = (mn - o) / d, tb = (mx - o) / d; if (ta > tb) { const s = ta; ta = tb; tb = s; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 > 0.02 && t0 < tmin) tmin = t0;
    } else if (c.r > minR) {
      const fx = ox - c.x, fz = oz - c.z, a = dx * dx + dz * dz; if (a < 1e-9) continue;
      const b = 2 * (fx * dx + fz * dz), cc = fx * fx + fz * fz - c.r * c.r, disc = b * b - 4 * a * cc; if (disc < 0) continue;
      const t = (-b - Math.sqrt(disc)) / (2 * a); if (t > 0.02 && t < tmin) { const y = oy + dy * t; if (y >= c.minY && y <= c.maxY) tmin = t; }
    }
  }
  return tmin;
}

/* ============================================================
   Speech bubbles
   ============================================================ */
const bubbles = [];
function say(p, text, dur = 2.6) {
  let b = bubbles.find(b => b.p === p);
  if (!b) { if (bubbles.length > 6) { const o = bubbles.shift(); o.el.remove(); } const el = document.createElement('div'); el.className = 'bubble'; $('bubbles').appendChild(el); b = { el, p }; bubbles.push(b); }
  b.el.textContent = text; b.t = dur; b.el.style.opacity = '1';
}
const _pv = new V3();
function updateBubbles(dt) {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i]; b.t -= dt;
    const vis = b.p.pool && b.p.pool.parent === (player.where === 'in' ? interiorScene : scene) && b.p.H.visible;
    if (b.t <= 0 || !vis) { b.el.remove(); bubbles.splice(i, 1); continue; }
    _pv.set(b.p.pos.x, b.p.pos.y + 2.05, b.p.pos.z).project(camera);
    if (_pv.z > 1) { b.el.style.opacity = '0'; continue; }
    b.el.style.opacity = b.t < 0.4 ? String(b.t / 0.4) : '1';
    b.el.style.transform = `translate(${(_pv.x * 0.5 + 0.5) * innerWidth}px,${(-_pv.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-100%)`;
  }
}

/* ============================================================
   NPCs
   ============================================================ */
const npcs = [];
function ringPoint(rg, s, off) {
  const H = RING, P = 8 * H; s = ((s % P) + P) % P; const side = Math.floor(s / (2 * H)), t = s - side * 2 * H;
  let x, z, nx, nz;
  if (side === 0) { x = -H + t; z = -H; nx = 0; nz = -1; } else if (side === 1) { x = H; z = -H + t; nx = 1; nz = 0; }
  else if (side === 2) { x = H - t; z = H; nx = 0; nz = 1; } else { x = -H; z = H - t; nx = -1; nz = 0; }
  return { x: rg.x + x - nx * off, z: rg.z + z - nz * off };
}
function ringParam(rg, x, z) {
  const H = RING, lx = clamp(x - rg.x, -H, H), lz = clamp(z - rg.z, -H, H);
  if (Math.abs(z - rg.z) >= Math.abs(x - rg.x)) return (z - rg.z) < 0 ? lx + H : 4 * H + (H - lx);
  return (x - rg.x) > 0 ? 2 * H + (lz + H) : 6 * H + (H - lz);
}
function nearestRing(x, z) { const bi = clamp(Math.floor((x + HALF) / B), 0, N - 1), bj = clamp(Math.floor((z + HALF) / B), 0, N - 1); return { x: blockC(bi), z: blockC(bj) }; }
function spawnNPC(x, z, look) {
  const n = makePerson(look || randomLook(), false); n.npc = true;
  n.pos.set(x, groundH(x, z), z); n.ring = nearestRing(x, z); n.s = ringParam(n.ring, x, z);
  n.dir = Math.random() < 0.5 ? 1 : -1; n.off = -0.9 + Math.random() * 1.4; n.spd = 1.05 + Math.random() * 0.45; n.mode = 'walk'; n.timer = 5 + Math.random() * 15;
  n.cornerCD = 0; n.decideT = 3 + Math.random() * 5;
  outdoorPool.attach(n); npcs.push(n); return n;
}
function setSpecial(n, kind, dur) { n.anim.special = kind; n.specialT = dur; }
function npcAct(n, action) {
  switch (action) {
    case 'wave': setSpecial(n, 'wave', 2.2); break;
    case 'laugh': setSpecial(n, 'laugh', 1.6); break;
    case 'dance': setSpecial(n, 'dance', 9); n.afterTalk = 'dance'; break;
    case 'sit': { const b = freeBench(n.pos.x, n.pos.z, 18); if (b && n.npc && player.where === 'out') { n.afterTalk = 'goSit'; n.bench = b; b.taken = n; } else setSpecial(n, 'sitGround', 12); break; }
    case 'follow': n.afterTalk = 'follow'; break;
    case 'stop': if (n.mode === 'follow' || n.afterTalk === 'follow') n.afterTalk = 'idle'; break;
    case 'leave': n.afterTalk = 'leave'; break;
  }
}
function freeBench(x, z, r) { let best = null, bd = r; for (const b of world.benches) { if (b.taken) continue; const d = Math.hypot(b.x - x, b.z - z); if (d < bd) { bd = d; best = b; } } return best; }
function finishMode(n) { // what to do after a conversation or a special action
  const a = n.afterTalk; n.afterTalk = null;
  if (a === 'follow') { n.mode = 'follow'; n.timer = 120; }
  else if (a === 'goSit' && n.bench) { n.mode = 'goSit'; n.timer = 25; }
  else if (a === 'leave') { n.mode = 'flee'; n.timer = 2.5; const ax = n.pos.x - player.pos.x, az = n.pos.z - player.pos.z, l = Math.hypot(ax, az) || 1; n.fx = ax / l; n.fz = az / l; n.fleeSpd = 1.7; }
  else { n.mode = n.ring ? 'idle' : (n.spots ? 'wander' : 'stand'); n.timer = 2 + Math.random() * 2; }
}
let hornEvent = null;
function updateNPC(n, dt, outdoor, col) {
  n.timer -= dt; n.bumpCD -= dt; n.cornerCD -= dt; n.decideT -= dt;
  if (n.specialT !== undefined && n.anim.special && n.anim.special !== 'sit') { n.specialT -= dt; if (n.specialT <= 0) n.anim.special = null; }
  let desired = 0, dx = 0, dz = 0;
  const pl = player, plHere = pl.where === (outdoor ? 'out' : 'in'), pd = plHere ? Math.hypot(pl.pos.x - n.pos.x, pl.pos.z - n.pos.z) : 99;
  const rainK = outdoor && weather.rain > 0.3 ? 1.3 : 1;
  const faceTo = (x, z, k = 6) => { n.facing += angDiff(n.facing, Math.atan2(x - n.pos.x, z - n.pos.z)) * Math.min(1, k * dt); };
  switch (n.mode) {
    case 'walk': {
      const tg = ringPoint(n.ring, n.s, n.off); if (Math.hypot(tg.x - n.pos.x, tg.z - n.pos.z) < 1.8) n.s += n.dir * n.spd * rainK * dt * 1.05;
      const la = ringPoint(n.ring, n.s + n.dir * 1.8, n.off); dx = la.x - n.pos.x; dz = la.z - n.pos.z; desired = n.spd * rainK;
      // reached a block corner: maybe cross the street at the crosswalk
      const lx = n.pos.x - n.ring.x, lz = n.pos.z - n.ring.z;
      if (n.cornerCD <= 0 && Math.abs(lx) > RING - 1.3 && Math.abs(lz) > RING - 1.3) {
        n.cornerCD = 10;
        if (Math.random() < 0.45) {
          const sx = Math.sign(lx), sz = Math.sign(lz), bi = Math.round((n.ring.x + HALF) / B - 0.5), bj = Math.round((n.ring.z + HALF) / B - 0.5);
          const Ix = n.ring.x + sx * B / 2, Iz = n.ring.z + sz * B / 2, ii = Math.round((Ix + HALF) / B), jj = Math.round((Iz + HALF) / B);
          const opts = [];
          if (bi + sx >= 0 && bi + sx < N) opts.push({ a: [Ix - sx * 10.3, Iz - sz * (RH + 2.3)], b: [Ix + sx * 10.3, Iz - sz * (RH + 2.3)], axis: 0, ring: { x: n.ring.x + sx * B, z: n.ring.z } });
          if (bj + sz >= 0 && bj + sz < N) opts.push({ a: [Ix - sx * (RH + 2.3), Iz - sz * 10.3], b: [Ix - sx * (RH + 2.3), Iz + sz * 10.3], axis: 1, ring: { x: n.ring.x, z: n.ring.z + sz * B } });
          if (opts.length) { n.cross = mpick(opts); n.cross.i = ii; n.cross.j = jj; n.mode = 'toCross'; n.timer = 15; }
        }
      }
      if (n.decideT < 0) {
        n.decideT = 4 + Math.random() * 6; const r = Math.random();
        if (r < 0.12) { const b = freeBench(n.pos.x, n.pos.z, 11); if (b) { n.bench = b; b.taken = n; n.mode = 'goSit'; n.timer = 25; } }
        else if (r < 0.2) { const d = world.doors.find(d => d.kind !== 'house' && Math.hypot(d.x - n.pos.x, d.z - n.pos.z) < 7); if (d) { n.door = d; n.mode = 'toDoor'; n.timer = 15; } }
        else if (r < 0.42) { n.mode = 'idle'; n.timer = 3 + Math.random() * 5; n.anim.idleKind = mpick(['breathe', 'look', 'phone', 'crossed', 'hips']); }
        else if (r < 0.5) n.dir *= -1;
      }
      break;
    }
    case 'idle': {
      if (n.timer < 0) { n.mode = 'walk'; break; }
      if (!n.partner && Math.random() < dt * 0.5) for (const o of npcs) {
        if (o === n || o.mode !== 'idle' || o.partner) continue;
        if (Math.hypot(o.pos.x - n.pos.x, o.pos.z - n.pos.z) < 3.2) { n.partner = o; o.partner = n; n.mode = o.mode = 'chat'; n.timer = o.timer = 9 + Math.random() * 10; n.chatTurn = 0; break; }
      }
      break;
    }
    case 'chat': {
      const o = n.partner;
      if (!o || o.mode !== 'chat' || n.timer < 0) { if (o) { o.partner = null; if (o.mode === 'chat') { o.mode = 'walk'; } } n.partner = null; n.mode = 'walk'; break; }
      faceTo(o.pos.x, o.pos.z); const d = Math.hypot(o.pos.x - n.pos.x, o.pos.z - n.pos.z); if (d > 1.6) { dx = o.pos.x - n.pos.x; dz = o.pos.z - n.pos.z; desired = 0.8; }
      n.chatTurn -= dt;
      if (n.chatTurn < 0 && o.anim.talkT <= 0) { n.chatTurn = 2.5 + Math.random() * 2; n.anim.talkT = 1.8 + Math.random(); if (pd < 22 && Math.random() < 0.35) say(n, mpick(NPC_CHAT), 2.6); if (Math.random() < 0.15) setSpecial(o, 'laugh', 1.2); }
      break;
    }
    case 'toCross': {
      const [ax, az] = n.cross.a; dx = ax - n.pos.x; dz = az - n.pos.z; desired = n.spd * rainK;
      if (Math.hypot(dx, dz) < 0.5 || n.timer < 0) { n.mode = 'waitCross'; n.timer = 60; }
      break;
    }
    case 'waitCross': {
      const [bx, bz] = n.cross.b; faceTo(bx, bz, 4);
      const st = lightState(n.cross.i, n.cross.j, n.cross.axis);
      const carNear = cars.some(c => Math.abs(c.vf) > 2 && Math.hypot(c.x - n.pos.x, c.z - n.pos.z) < 9);
      if ((st === 2 && !carNear) || n.timer < 0) { n.mode = 'cross'; n.timer = 25; }
      break;
    }
    case 'cross': {
      const [bx, bz] = n.cross.b; dx = bx - n.pos.x; dz = bz - n.pos.z;
      const st = lightState(n.cross.i, n.cross.j, n.cross.axis); desired = (st === 2 ? 1.45 : 2.6) * rainK;
      if (Math.hypot(dx, dz) < 0.6 || n.timer < 0) { n.ring = n.cross.ring; n.s = ringParam(n.ring, n.pos.x, n.pos.z); n.mode = 'walk'; n.cornerCD = 12; n.cross = null; }
      break;
    }
    case 'goSit': {
      const b = n.bench; if (!b) { n.mode = 'goto'; break; }
      const tx = b.x + Math.sin(b.ry) * 0.75, tz = b.z + Math.cos(b.ry) * 0.75; dx = tx - n.pos.x; dz = tz - n.pos.z; desired = 1.3;
      if (Math.hypot(dx, dz) < 0.45) { n.mode = 'sit'; n.timer = 18 + Math.random() * 35; n.anim.special = 'sit'; n.anim.idleKind = Math.random() < 0.35 ? 'phone' : 'breathe'; }
      else if (n.timer < 0) { b.taken = null; n.bench = null; n.mode = 'goto'; }
      break;
    }
    case 'sit': {
      const b = n.bench; n.vel.set(0, 0, 0);
      n.pos.x = damp(n.pos.x, b.x + Math.sin(b.ry) * 0.08, 6, dt); n.pos.z = damp(n.pos.z, b.z + Math.cos(b.ry) * 0.08, 6, dt); n.pos.y = b.y;
      n.facing += angDiff(n.facing, b.ry) * Math.min(1, 6 * dt);
      if (n.timer < 0 || (weather.rain > 0.5 && !b.roofed)) { n.anim.special = null; b.taken = null; n.bench = null; n.pos.x = b.x + Math.sin(b.ry) * 0.8; n.pos.z = b.z + Math.cos(b.ry) * 0.8; n.mode = 'goto'; }
      n.anim.look = pd < 6 ? clamp(angDiff(n.facing, Math.atan2(pl.pos.x - n.pos.x, pl.pos.z - n.pos.z)), -1.1, 1.1) : Math.sin(simTime * 0.3 + n.anim.seed) * 0.4;
      return;
    }
    case 'toDoor': {
      const d = n.door, tx = d.x + d.nx * 0.55, tz = d.z + d.nz * 0.55; dx = tx - n.pos.x; dz = tz - n.pos.z; desired = n.spd;
      if (Math.hypot(dx, dz) < 0.9) d.npcOpen = 1.6;
      if (Math.hypot(dx, dz) < 0.45) { n.mode = 'inside'; n.timer = 20 + Math.random() * 50; n.H.visible = false; n.pos.set(tx, n.pos.y, tz); }
      else if (n.timer < 0) n.mode = 'goto';
      break;
    }
    case 'inside': n.H.visible = false; n.vel.set(0, 0, 0); if (n.timer < 0) { n.door.npcOpen = 1.6; n.H.visible = true; n.facing = Math.atan2(n.door.nx, n.door.nz); n.mode = 'goto'; } return;
    case 'flee': desired = n.fleeSpd || 5.0; dx = n.fx; dz = n.fz; if (n.timer < 0) { n.fleeSpd = 0; n.mode = 'goto'; } break;
    case 'goto': {
      n.ring = nearestRing(n.pos.x, n.pos.z); const s = ringParam(n.ring, n.pos.x, n.pos.z), tg = ringPoint(n.ring, s, n.off);
      dx = tg.x - n.pos.x; dz = tg.z - n.pos.z; desired = 1.6; if (Math.hypot(dx, dz) < 1.2) { n.mode = 'walk'; n.s = s; n.timer = 5; }
      break;
    }
    case 'talk': if (plHere) faceTo(pl.pos.x, pl.pos.z, 5); break;
    case 'follow': {
      if (pl.state === 'car' || !plHere || n.timer < 0 || pd > 45) { n.mode = 'goto'; say(n, mpick(['خب، من دیگه برم.', 'منتظرت نمی‌مونم!', 'بعداً می‌بینمت!'])); break; }
      const bx = pl.pos.x - Math.sin(pl.facing) * 1.6, bz = pl.pos.z - Math.cos(pl.facing) * 1.6; dx = bx - n.pos.x; dz = bz - n.pos.z;
      const d = Math.hypot(dx, dz); desired = d > 6 ? 6.2 : d > 2.2 ? 2.6 + d * 0.3 : 0; if (desired === 0) faceTo(pl.pos.x, pl.pos.z, 3);
      if (n.onGround && pl.pos.y - n.pos.y > 0.5 && d < 2) { n.vel.y = 6.2; n.onGround = false; }
      break;
    }
    case 'down': n.knockT += dt; if (n.onGround) { n.vel.x *= Math.exp(-5 * dt); n.vel.z *= Math.exp(-5 * dt); } if (n.knockT > 3.2) { n.mode = 'getup'; n.timer = 1.3; } break;
    case 'getup': if (n.timer < 0) { n.mode = 'flee'; n.timer = 1.8; const a = Math.random() * 6.28; n.fx = Math.sin(a); n.fz = Math.cos(a); n.fleeSpd = 4; } break;
    case 'wander': {
      if (!n.tgt || n.timer < 0) { n.tgt = mpick(n.spots); n.timer = 6 + Math.random() * 6; }
      dx = n.tgt[0] - n.pos.x; dz = n.tgt[1] - n.pos.z; const d = Math.hypot(dx, dz); desired = d > 0.4 ? 1.0 : 0; break;
    }
    case 'stand': break;
  }
  n.anim.knock = damp(n.anim.knock, n.mode === 'down' ? 1 : 0, n.mode === 'down' ? 7 : 2.2, dt);
  n.anim.getup = damp(n.anim.getup, n.mode === 'getup' ? 1 : 0, 6, dt);
  // danger from cars, and reaction to the horn
  if (outdoor && n.mode !== 'down' && n.mode !== 'getup' && n.mode !== 'talk') {
    for (const c of cars) {
      const sp = Math.abs(c.vf); if (sp < 4) continue; const ox = n.pos.x - c.x, oz = n.pos.z - c.z; if (ox * ox + oz * oz > 220) continue;
      const fx = Math.sin(c.h), fz = Math.cos(c.h), lf = (ox * fx + oz * fz) * Math.sign(c.vf), lr = ox * -fz + oz * fx;
      if (lf > 0 && lf < 4 + sp * 0.7 && Math.abs(lr) < 2.4) { if (n.mode === 'chat' && n.partner) { n.partner.partner = null; n.partner = null; } n.mode = 'flee'; n.timer = 1.1; n.fleeSpd = 5; const s = lr >= 0 ? 1 : -1; n.fx = -fz * s; n.fz = fx * s; if (Math.random() < 0.03) say(n, mpick(['آی!', 'یواش!', 'هوی!'])); break; }
    }
    if (hornEvent && simTime - hornEvent.t < 0.2) {
      const ox = n.pos.x - hornEvent.x, oz = n.pos.z - hornEvent.z, d = Math.hypot(ox, oz);
      if (d < 16) {
        const lf = ox * Math.sin(hornEvent.h) + oz * Math.cos(hornEvent.h), lr = ox * -Math.cos(hornEvent.h) + oz * Math.sin(hornEvent.h);
        if (lf > 0 && Math.abs(lr) < 3 && onRoad(n.pos.x, n.pos.z)) { n.mode = 'flee'; n.timer = 1.4; n.fleeSpd = 3.5; const s = lr >= 0 ? 1 : -1; n.fx = -Math.cos(hornEvent.h) * s; n.fz = Math.sin(hornEvent.h) * s; }
        if (!n.hornCD || simTime > n.hornCD) { n.hornCD = simTime + 8; n.anim.look = 0; if (Math.random() < 0.3) say(n, mpick(['چه خبرته؟!', 'بوق نزن!', 'آروم باش!', 'اوه!'])); }
      }
    }
  }
  if (desired > 0 && n.mode !== 'down') { const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; }
  if (n.mode !== 'down') {
    const k = n.onGround ? 8 : 1; n.vel.x = damp(n.vel.x, dx * desired, k, dt); n.vel.z = damp(n.vel.z, dz * desired, k, dt);
    if (desired > 0.1) n.facing += angDiff(n.facing, Math.atan2(dx, dz)) * Math.min(1, 7 * dt);
    else if (pd < 4 && (n.mode === 'idle' || n.mode === 'stand' || n.mode === 'wander')) faceTo(pl.pos.x, pl.pos.z, 3);
  }
  n.anim.look = pd < 5 && n.mode !== 'down' && n.mode !== 'chat' ? clamp(angDiff(n.facing, Math.atan2(pl.pos.x - n.pos.x, pl.pos.z - n.pos.z)), -1.1, 1.1) : 0;
  stepCharacter(n, col, dt, outdoor);
}

/* ============================================================
   Interiors
   ============================================================ */
const interior = { col: null, door: null, npcs: [], W: 12, D: 10 };
function buildInterior(door) {
  for (const n of interior.npcs) interiorPool.detach(n); interior.npcs = []; interior.fan = interior.clock = interior.tv = null;
  for (let i = interiorScene.children.length - 1; i >= 0; i--) { const o = interiorScene.children[i]; if (o.userData.keep) continue; interiorScene.remove(o); if (o.userData.disposable) o.geometry.dispose(); }
  const prevR = R, prevBT = BT, prevCL = CL; R = makeRng(door.seed); BT = new Batch(0); CL = new Colliders();
  const shop = door.kind === 'shop';
  const W = shop ? 14 : 12, D = shop ? 11 : 10, H = 3.1, F0 = mkFrame(0, 0, 0);
  const wallCol = shop ? 0xf1eee8 : pick([0xefe6d8, 0xe3ece6, 0xf2e3d3, 0xdfe4ee, 0xeadfcf, 0xe9d7c9]);
  BT.add(shop ? 'tileFloor' : 'woodFloor', quadUp(-W / 2, -D / 2, W / 2, D / 2, 0, shop ? 2 : 3), 0, 0, 0, 0, shop ? 0xffffff : pick([0xffffff, 0xe8d8c8, 0xd0b8a0]));
  BT.add('trim', boxGeo(W + 0.4, 0.2, D + 0.4), 0, H + 0.1, 0, 0, 0xf6f4f0);
  const wall = (x, z, w, d, y = H / 2, h = H) => { BT.add('plaster', boxGeo(w, h, d, 3), x, y, z, 0, wallCol); CL.box(x - w / 2, x + w / 2, z - d / 2, z + d / 2, -1, 10); };
  wall(0, -D / 2 - 0.1, W + 0.4, 0.2); wall(-W / 2 - 0.1, 0, 0.2, D); wall(W / 2 + 0.1, 0, 0.2, D);
  const sideW = W / 2 - 0.65; wall(-(0.65 + sideW / 2), D / 2 + 0.1, sideW, 0.2); wall(0.65 + sideW / 2, D / 2 + 0.1, sideW, 0.2);
  BT.add('plaster', boxGeo(1.3, H - 2.35, 0.2, 3), 0, 2.35 + (H - 2.35) / 2, D / 2 + 0.1, 0, wallCol);
  CL.box(-0.65, 0.65, D / 2 - 0.05, D / 2 + 0.3, -1, 10);
  for (const [x, z, w, d] of [[0, -D / 2 + 0.02, W, 0.04], [-W / 2 + 0.02, 0, 0.04, D], [W / 2 - 0.02, 0, 0.04, D], [-(0.65 + sideW / 2), D / 2 - 0.02, sideW, 0.04], [0.65 + sideW / 2, D / 2 - 0.02, sideW, 0.04]]) BT.add('trim', boxGeo(w, 0.12, d), x, 0.06, z, 0, 0xf8f6f2);
  // exit door (closed, inside face)
  const ed = new THREE.Mesh(doorGeo, doorMat(door.kind === 'shop' ? 0x9aa3ab : 0x7a5230)); ed.position.set(-0.52, 0, D / 2 - 0.02); ed.receiveShadow = true; interiorScene.add(ed);
  BT.add('trim', boxGeo(1.42, 2.46, 0.1), 0, 1.2, D / 2 - 0.02, 0, 0xf4f1ea);
  // windows that look outside
  const winAt = (x, z, r) => { const F = mkFrame(x, z, r); fBox(F, 'trim', 0, 1.7, 0.0, 1.5, 1.5, 0.08, 0xf4f1ea); fBox(F, 'winView', 0, 1.7, 0.05, 1.3, 1.3, 0.02, 0xffffff); fBox(F, 'trim', 0, 1.7, 0.07, 0.05, 1.3, 0.02, 0xf4f1ea); fBox(F, 'trim', 0, 0.92, 0.14, 1.7, 0.06, 0.25, 0xece6dc); const cc = shop ? 0xd9d2c6 : pick([0x7a3b3b, 0x3b5a7a, 0xb59a6a, 0x4a6a4a, 0xe8dcc8]); for (const sx of [-0.95, 0.95]) fBox(F, 'fabric', sx, 1.55, 0.14, 0.4, 2.3, 0.06, cc); };
  // ceiling lamps
  const lamp = (x, z) => { BT.add('lampOn', GEO.cyl, x, H - 0.03, z, 0, 0xffffff, 0, 0, 0.32, 0.04, 0.32); BT.add('metal', GEO.cyl, x, H - 0.02, z, 0, 0xdddddd, 0, 0, 0.36, 0.02, 0.36); };
  const plant = (x, z, s = 1) => { BT.add('trim', GEO.cyl, x, 0.22 * s, z, 0, 0x8a5a3a, 0, 0, 0.22 * s, 0.44 * s, 0.22 * s); for (let k = 0; k < 4; k++) BT.add('foliage', pick(GEO.ico), x + rr(-0.15, 0.15), (0.6 + k * 0.18) * s, z + rr(-0.15, 0.15), R() * 6, pick(FOLIAGE), 0, 0, 0.3 * s, 0.35 * s, 0.3 * s); CL.circle(x, z, 0.28 * s, 0, 0.5 * s); };
  const picture = (F, lx, ly, w, h) => { fBox(F, 'wood', lx, ly, 0.03, w + 0.1, h + 0.1, 0.04, 0x3a2a1a); const cols = [pick([0xd9a05b, 0x5b8ad9, 0xd95b6a, 0x6ad9a0]), pick([0x2a3a5a, 0xe8d8b8, 0x7a4a2a, 0x3a6a4a]), pick([0xf2e3c6, 0x9a5a8a, 0x5a7a9a])]; for (let k = 0; k < 3; k++) fBox(F, 'fabric', lx, ly - h / 2 + h * (k + 0.5) / 3, 0.055, w, h / 3, 0.01, cols[k]); };
  const lights = [];
  if (!shop) {
    const fab = pick([0x4a5a7a, 0x7a4a3a, 0x5a6a4a, 0x8a7a6a, 0x3a3a4a, 0x9a5a3a]), woodC = pick([0x6b4a2a, 0x8a6a4a, 0x4a3020]);
    // rug + living
    BT.add('fabric', boxGeo(3.4, 0.015, 2.4), -3.0, 0.008, 1.8, 0, pick([0x8a3a3a, 0x3a4a6a, 0x9a7a4a, 0x5a3a5a]));
    BT.add('fabric', boxGeo(3.0, 0.017, 2.0), -3.0, 0.01, 1.8, 0, pick([0xc9a46a, 0xd8c8a8, 0xa86a5a]));
    // TV
    let F = mkFrame(-W / 2 + 0.3, 1.8, Math.PI / 2);
    fBox(F, 'wood', 0, 0.25, 0, 1.9, 0.5, 0.45, woodC, { col: true });
    fBox(F, 'metal', 0, 1.25, -0.2, 1.5, 0.86, 0.06, 0x111111);
    { const c = mkCanvas(256, 144), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; const tv = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.78), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      const [x, z] = fw(F, 0, -0.165); tv.position.set(x, 1.25, z); tv.rotation.y = F.a; interiorScene.add(tv); interior.tv = { g: c.getContext('2d'), tex, t: 0 }; }
    // sofa facing the TV
    F = mkFrame(-1.5, 1.8, -Math.PI / 2);
    fBox(F, 'fabric', 0, 0.22, 0, 2.2, 0.44, 0.9, fab); fBox(F, 'fabric', 0, 0.5, 0.06, 2.0, 0.14, 0.78, new THREE.Color(fab).multiplyScalar(1.15).getHex());
    fBox(F, 'fabric', 0, 0.72, -0.36, 2.2, 0.56, 0.2, fab); for (const sx of [-1.02, 1.02]) fBox(F, 'fabric', sx, 0.42, 0, 0.2, 0.42, 0.9, fab);
    { const [x, z] = fw(F, 0, 0); CL.box(x - 0.45, x + 0.45, z - 1.1, z + 1.1, 0, 0.57); CL.box(x + 0.25, x + 0.46, z - 1.1, z + 1.1, 0, 1.0); }
    // coffee table
    BT.add('wood', boxGeo(0.62, 0.05, 1.1), -3.2, 0.42, 1.8, 0, woodC); for (const [ax, az] of [[-0.26, -0.5], [0.26, -0.5], [-0.26, 0.5], [0.26, 0.5]]) BT.add('wood', boxGeo(0.05, 0.4, 0.05), -3.2 + ax, 0.2, 1.8 + az, 0, woodC);
    CL.box(-3.52, -2.88, 1.25, 2.35, 0, 0.45); BT.add('trim', GEO.cyl, -3.15, 0.5, 1.6, 0, 0xffffff, 0, 0, 0.05, 0.1, 0.05);
    // floor lamp
    BT.add('metal', GEO.cyl, -0.9, 0.8, 3.5, 0, 0x222222, 0, 0, 0.02, 1.6, 0.02); BT.add('lampOn', new THREE.CylinderGeometry(0.16, 0.24, 0.3, 14), -0.9, 1.65, 3.5, 0, 0xfff1d8); CL.circle(-0.9, 3.5, 0.2, 0, 1.8);
    lights.push([-0.9, 1.5, 3.5, 0xffd9a0, 6]);
    // bed
    F = mkFrame(-3.6, -D / 2 + 1.15, 0);
    fBox(F, 'wood', 0, 0.2, 0, 1.75, 0.36, 2.15, woodC); fBox(F, 'fabric', 0, 0.48, 0.02, 1.62, 0.22, 2.0, 0xf4f4f0);
    fBox(F, 'fabric', 0, 0.6, 0.35, 1.66, 0.06, 1.35, pick([0x3a5a8a, 0x8a3a4a, 0xd8b86a, 0x5a8a6a, 0x6a5a8a]));
    for (const sx of [-0.4, 0.4]) fBox(F, 'fabric', sx, 0.66, -0.75, 0.62, 0.14, 0.38, 0xffffff);
    fBox(F, 'wood', 0, 0.65, -1.05, 1.85, 1.1, 0.1, woodC);
    CL.box(-3.6 - 0.88, -3.6 + 0.88, -D / 2 + 0.05, -D / 2 + 2.25, 0, 0.62);
    for (const sx of [-1.25, 1.25]) { fBox(F, 'wood', sx, 0.25, -0.85, 0.5, 0.5, 0.45, woodC, { col: true }); fBox(F, 'lampOn', sx, 0.68, -0.85, 0.22, 0.3, 0.22, 0xfff0d8); }
    picture(mkFrame(-3.6, -D / 2, 0), 0, 1.9, 1.2, 0.7);
    // wardrobe
    F = mkFrame(-W / 2 + 0.32, -1.2, Math.PI / 2); fBox(F, 'wood', 0, 1.05, 0, 1.6, 2.1, 0.6, woodC, { col: true }); fBox(F, 'metal', -0.06, 1.05, 0.31, 0.02, 0.3, 0.03, 0xd0d0d0); fBox(F, 'metal', 0.06, 1.05, 0.31, 0.02, 0.3, 0.03, 0xd0d0d0);
    // kitchen
    const kc = pick([0xf2efe8, 0x2f4a5a, 0x6a7a5a, 0xd8c8a8, 0x3a3a3a]);
    BT.add('wood', boxGeo(3.8, 0.88, 0.62), 2.7, 0.44, -D / 2 + 0.31, 0, kc); CL.box(0.8, 4.6, -D / 2, -D / 2 + 0.62, 0, 0.92);
    BT.add('trim', boxGeo(3.86, 0.04, 0.66), 2.7, 0.9, -D / 2 + 0.33, 0, pick([0x2a2a2a, 0xe8e4dc, 0x7a6a5a]));
    BT.add('metal', boxGeo(0.6, 0.02, 0.4), 1.6, 0.92, -D / 2 + 0.33, 0, 0xc0c4c8);
    BT.add('metal', boxGeo(0.62, 0.02, 0.55), 3.6, 0.925, -D / 2 + 0.33, 0, 0x111111);
    for (const [ax, az] of [[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]]) BT.add('metal', GEO.cyl, 3.6 + ax, 0.94, -D / 2 + 0.33 + az, 0, 0x333333, 0, 0, 0.08, 0.01, 0.08);
    BT.add('wood', boxGeo(1.8, 0.7, 0.35), 3.7, 1.95, -D / 2 + 0.18, 0, kc);
    BT.add('metal', boxGeo(0.9, 1.9, 0.72), 5.4, 0.95, -D / 2 + 0.37, 0, pick([0xe8e8e8, 0xb8bcc0])); CL.box(4.95, 5.85, -D / 2, -D / 2 + 0.74, 0, 1.9);
    BT.add('metal', boxGeo(0.03, 0.5, 0.04), 5.0, 1.2, -D / 2 + 0.75, 0, 0x888888);
    winAt(1.6, -D / 2 + 0.02, 0);
    // dining
    BT.add('wood', boxGeo(1.6, 0.05, 0.9), 3.0, 0.75, -0.6, 0, woodC); for (const [ax, az] of [[-0.72, -0.38], [0.72, -0.38], [-0.72, 0.38], [0.72, 0.38]]) BT.add('wood', boxGeo(0.06, 0.73, 0.06), 3.0 + ax, 0.37, -0.6 + az, 0, woodC);
    CL.box(2.2, 3.8, -1.05, -0.15, 0, 0.78);
    for (const [cx, cz, r] of [[2.6, -1.25, 0], [3.4, -1.25, 0], [2.6, 0.05, Math.PI], [3.4, 0.05, Math.PI]]) { F = mkFrame(cx, cz, r); fBox(F, 'wood', 0, 0.46, 0, 0.44, 0.05, 0.44, woodC); fBox(F, 'wood', 0, 0.75, -0.2, 0.44, 0.55, 0.04, woodC); for (const [ax, az] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) fBox(F, 'wood', ax, 0.23, az, 0.04, 0.46, 0.04, woodC); CL.circle(cx, cz, 0.28, 0, 0.48); }
    BT.add('metal', GEO.cyl, 3.0, H - 0.5, -0.6, 0, 0x222222, 0, 0, 0.01, 1.0, 0.01); BT.add('lampOn', new THREE.ConeGeometry(0.3, 0.25, 18, 1, true), 3.0, H - 1.1, -0.6, 0, 0xfff0d8);
    BT.add('trim', GEO.sphere, 3.2, 0.85, -0.6, 0, 0xe8d8b8, 0, 0, 0.16, 0.08, 0.16);
    // bookshelf
    F = mkFrame(W / 2 - 0.2, 2.8, -Math.PI / 2); fBox(F, 'wood', 0, 1.0, 0, 1.3, 2.0, 0.36, woodC, { col: true });
    for (let sh = 0; sh < 4; sh++) { let x = -0.58; while (x < 0.55) { const bw = rr(0.04, 0.08), bh = rr(0.24, 0.36); fBox(F, 'fabric', x + bw / 2, 0.12 + sh * 0.48 + bh / 2, 0.06, bw, bh, 0.24, pick([0x8a2a2a, 0x2a4a8a, 0x2a6a3a, 0xd8b84a, 0x5a3a6a, 0xe8e0d0, 0x3a3a3a])); x += bw + 0.005; } }
    winAt(W / 2 - 0.02, -1.0, -Math.PI / 2); winAt(-W / 2 + 0.02, -3.4, Math.PI / 2);
    picture(mkFrame(W / 2, 0.9, -Math.PI / 2), 0, 1.8, 0.9, 0.6); picture(mkFrame(-1.4, D / 2, Math.PI), 0, 1.7, 0.8, 1.0);
    plant(-W / 2 + 0.5, D / 2 - 0.5, 1.3); plant(W / 2 - 0.5, D / 2 - 0.5, 1.1); plant(0.4, -D / 2 + 0.5, 1.0);
    lamp(-3.6, -3); lamp(3, 2.5); lamp(3.2, -3.6);
    { // ceiling fan over the living room
      const fan = new THREE.Group(); fan.position.set(-3, H - 0.35, 1.8); const fm = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.6 });
      fan.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.18, 16), new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.6, roughness: 0.3 })));
      for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.02, 0.16), fm); b.position.set(Math.cos(k * Math.PI / 2) * 0.45, -0.04, Math.sin(k * Math.PI / 2) * 0.45); b.rotation.y = -k * Math.PI / 2; b.castShadow = true; fan.add(b); }
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), fm); rod.position.y = 0.2; fan.add(rod);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshStandardMaterial({ emissive: 0xfff0d2, emissiveIntensity: 2 })); bulb.position.y = -0.13; fan.add(bulb);
      interiorScene.add(fan); interior.fan = fan; }
    { // wall clock that shows the game time
      const c = mkCanvas(128), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const ck = new THREE.Mesh(new THREE.CircleGeometry(0.28, 28), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 })); ck.position.set(1.0, 2.25, -D / 2 + 0.03); interiorScene.add(ck);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.025, 8, 28), new THREE.MeshStandardMaterial({ color: 0x3a2a1a })); rim.position.copy(ck.position); interiorScene.add(rim);
      interior.clock = { g: c.getContext('2d'), tex, last: -1 }; }
    lights.push([-3, H - 0.4, 1.5, 0xffe0b8, 26], [3, H - 0.4, -1.5, 0xffe0b8, 26]);
    const res = makePerson(randomLook(), false); res.npc = true; res.mode = 'wander'; res.spots = [[0, 3], [1.2, 1.2], [-0.2, -1.5], [1.6, -2.8], [-1.8, -2.4], [0.5, 0.3]];
    res.pos.set(1.2, 0, 1.2); interiorPool.attach(res); interior.npcs.push(res);
    say(res, mpick(['سلام! خوش اومدی', 'به به! بفرما داخل', 'سلام همسایه!', 'چای می‌خوری؟']), 3);
  } else {
    // shop
    const tag = pick([0x1f5f8b, 0xc2561a, 0x1f7a4d, 0x8b2a3a]);
    for (const sx of [-4.6, -1.6, 1.4]) {
      BT.add('metal', boxGeo(0.62, 1.8, 5.2), sx, 0.9, -0.8, 0, 0xe6e8ea); CL.box(sx - 0.31, sx + 0.31, -3.4, 1.8, 0, 1.8);
      for (let lv = 0; lv < 4; lv++) {
        BT.add('metal', boxGeo(0.95, 0.03, 5.2), sx, 0.18 + lv * 0.45, -0.8, 0, 0xcfd3d7);
        for (const side of [-1, 1]) { let z = -3.3; while (z < 1.7) { const w = rr(0.12, 0.28), h = rr(0.16, 0.36); const geo = R() < 0.3 ? GEO.cyl : null; if (geo) BT.add('fabric', geo, sx + side * 0.36, 0.2 + lv * 0.45 + h / 2, z + w / 2, 0, pick([0xd94a3a, 0x3a8ad9, 0xf2c14e, 0x4ab04a, 0xffffff, 0xe87a2a, 0x8a4ab0]), 0, 0, w / 2.2, h, w / 2.2); else BT.add('fabric', boxGeo(0.22, h, w), sx + side * 0.36, 0.2 + lv * 0.45 + h / 2, z + w / 2, 0, pick([0xd94a3a, 0x3a8ad9, 0xf2c14e, 0x4ab04a, 0xffffff, 0xe87a2a, 0x8a4ab0, 0x2a2a2a])); z += w + 0.03; } }
      }
      BT.add('fabric', boxGeo(0.64, 0.25, 0.04), sx, 2.05, 1.82, 0, tag);
    }
    for (let k = 0; k < 6; k++) { const x = -5.6 + k * 1.95; BT.add('metal', boxGeo(1.85, 2.1, 0.75), x, 1.05, -D / 2 + 0.38, 0, 0x30363c); BT.add('fridge', boxGeo(1.6, 1.8, 0.02), x, 1.05, -D / 2 + 0.76, 0, 0xffffff); for (let lv = 0; lv < 4; lv++) for (let b = 0; b < 8; b++) BT.add('fabric', GEO.cyl, x - 0.7 + b * 0.2, 0.3 + lv * 0.45, -D / 2 + 0.6, 0, pick([0xd94a3a, 0x3aa0d9, 0xf2c14e, 0x4ab04a, 0xe8e8e8]), 0, 0, 0.05, 0.28, 0.05); }
    CL.box(-W / 2, W / 2, -D / 2, -D / 2 + 0.78, 0, 2.1);
    BT.add('wood', boxGeo(2.8, 1.0, 0.7), 4.9, 0.5, 3.3, 0, 0x5a3a2a); BT.add('trim', boxGeo(2.9, 0.05, 0.78), 4.9, 1.02, 3.3, 0, 0x2a2a2a); CL.box(3.5, 6.3, 2.95, 3.65, 0, 1.05);
    BT.add('metal', boxGeo(0.4, 0.25, 0.35), 4.4, 1.17, 3.3, 0, 0x1a1a1a); BT.add('screen', boxGeo(0.32, 0.2, 0.02), 4.4, 1.38, 3.2, 0, 0xffffff);
    for (const [x, z] of [[-5.4, 3.4], [-4.0, 3.4]]) { BT.add('wood', boxGeo(1.1, 0.6, 0.8), x, 0.3, z, 0, 0x8a6a3a); CL.box(x - 0.55, x + 0.55, z - 0.4, z + 0.4, 0, 0.62); const fc = pick([0xd94a3a, 0xf2a03a, 0x8ac24a, 0xf2d14a]); for (let k = 0; k < 14; k++) BT.add('foliage', pick(GEO.ico), x + rr(-0.42, 0.42), 0.66 + R() * 0.08, z + rr(-0.3, 0.3), 0, fc, 0, 0, 0.09, 0.09, 0.09); }
    for (const x of [-4, 0, 4]) for (const z of [-3, 1.5]) BT.add('lampOn', boxGeo(1.6, 0.05, 0.4), x, H - 0.03, z, 0, 0xffffff);
    winAt(-3.5, D / 2 - 0.02, Math.PI); winAt(3.0, D / 2 - 0.02, Math.PI);
    plant(-W / 2 + 0.5, D / 2 - 0.5, 1.2);
    lights.push([-3, H - 0.4, -1, 0xf2f6ff, 30], [3, H - 0.4, -1, 0xf2f6ff, 30], [0, H - 0.4, 3, 0xf2f6ff, 18]);
    const ck = makePerson(randomLook(), false); ck.npc = true; ck.mode = 'stand'; ck.pos.set(4.9, 0, 4.25); ck.facing = Math.PI; interiorPool.attach(ck); interior.npcs.push(ck);
    say(ck, mpick(['خوش آمدید!', 'بفرمایید، چی لازم دارید؟', 'سلام! امروز تخفیف داریم']), 3);
  }
  BT.build(interiorScene);
  const hl = new THREE.HemisphereLight(0xfff4e6, 0x6b5a48, 0.9); interiorScene.add(hl);
  for (const [x, y, z, c, i] of lights) { const pl = new THREE.PointLight(c, i, 14, 2); pl.position.set(x, y, z); interiorScene.add(pl); }
  const dl = new THREE.DirectionalLight(0xfff0dd, 1.3); dl.position.set(2.5, 9, 3); dl.castShadow = true; dl.shadow.mapSize.set(1024, 1024);
  const sc = dl.shadow.camera; sc.left = -W / 2 - 1; sc.right = W / 2 + 1; sc.top = D / 2 + 1; sc.bottom = -D / 2 - 1; sc.near = 1; sc.far = 20; dl.shadow.bias = -0.0006; dl.shadow.normalBias = 0.02;
  interiorScene.add(dl, dl.target);
  interior.col = CL; interior.W = W; interior.D = D; interior.door = door;
  R = prevR; BT = prevBT; CL = prevCL;
}

const TV_NEWS = ['اخبار شهر آزاد: فوارهٔ پارک مرکزی امشب نورپردازی می‌شود', 'هواشناسی: احتمال بارش باران در ساعات آینده', 'ترافیک سنگین در خیابان حافظ گزارش شد', 'افتتاح کافهٔ جدید در خیابان سعدی', 'مسابقهٔ فوتبال محله فردا عصر برگزار می‌شود'];
function updateInterior(dt) {
  if (interior.fan) interior.fan.rotation.y += dt * 5;
  const ck = interior.clock;
  if (ck) { const m = Math.floor(tod * 60); if (m !== ck.last) { ck.last = m; const g = ck.g; g.fillStyle = '#f6f1e6'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#222'; g.font = '14px Vazirmatn, Tahoma'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 1; k <= 12; k++) { const a = k / 12 * Math.PI * 2; g.fillText(fa(k), 64 + Math.sin(a) * 50, 64 - Math.cos(a) * 50); }
    const hand = (a, l, w) => { g.lineWidth = w; g.strokeStyle = '#222'; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.sin(a) * l, 64 - Math.cos(a) * l); g.stroke(); };
    hand((tod % 12) / 12 * Math.PI * 2, 30, 5); hand((tod % 1) * Math.PI * 2, 44, 3); ck.tex.needsUpdate = true; } }
  const tv = interior.tv;
  if (tv) { tv.t += dt; if (tv.t > 0.08) { tv.t = 0; const g = tv.g, T_ = simTime; const gr = g.createLinearGradient(0, 0, 256, 144); gr.addColorStop(0, `hsl(${(T_ * 20) % 360},55%,35%)`); gr.addColorStop(1, `hsl(${(T_ * 20 + 120) % 360},55%,22%)`); g.fillStyle = gr; g.fillRect(0, 0, 256, 144);
    for (let k = 0; k < 5; k++) { g.fillStyle = `hsla(${k * 70},80%,65%,0.8)`; g.beginPath(); g.arc(128 + Math.sin(T_ * (0.7 + k * 0.3) + k) * 90, 60 + Math.cos(T_ * (0.9 + k * 0.2)) * 30, 12 + k * 3, 0, 7); g.fill(); }
    g.fillStyle = '#b3161b'; g.fillRect(0, 112, 256, 32); g.fillStyle = '#fff'; g.font = '18px Vazirmatn, Tahoma'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.textAlign = 'left';
    const msg = TV_NEWS[Math.floor(T_ / 9) % TV_NEWS.length]; g.fillText(msg, ((T_ * 60) % 700) - 400, 128); tv.tex.needsUpdate = true; } }
}
/* ============================================================
   Audio (synthesised)
   ============================================================ */
const Audio = {
  ctx: null, on: true,
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const c = this.ctx; this.master = c.createGain(); this.master.gain.value = 0.7; this.master.connect(c.destination);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; d[i] = w; } this.noise = buf;
    const bb = c.createBuffer(1, len, c.sampleRate), bd = bb.getChannelData(0); for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; } this.brown = bb;
    // engine
    this.eg = c.createGain(); this.eg.gain.value = 0; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; this.elp = lp;
    this.o1 = c.createOscillator(); this.o1.type = 'sawtooth'; this.o2 = c.createOscillator(); this.o2.type = 'square';
    const g2 = c.createGain(); g2.gain.value = 0.5; this.o1.connect(lp); this.o2.connect(g2); g2.connect(lp); lp.connect(this.eg); this.eg.connect(this.master); this.o1.start(); this.o2.start();
    // ambience
    const amb = c.createBufferSource(); amb.buffer = this.brown; amb.loop = true; const al = c.createBiquadFilter(); al.type = 'lowpass'; al.frequency.value = 500; this.ag = c.createGain(); this.ag.gain.value = 0.05; amb.connect(al); al.connect(this.ag); this.ag.connect(this.master); amb.start();
    // tyre squeal
    const ts = c.createBufferSource(); ts.buffer = this.noise; ts.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 4; this.tg = c.createGain(); this.tg.gain.value = 0; ts.connect(bp); bp.connect(this.tg); this.tg.connect(this.master); ts.start();
    // rain
    const rs = c.createBufferSource(); rs.buffer = this.noise; rs.loop = true; const rh = c.createBiquadFilter(); rh.type = 'highpass'; rh.frequency.value = 900; const rl = c.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 6000;
    this.rg = c.createGain(); this.rg.gain.value = 0; rs.connect(rh); rh.connect(rl); rl.connect(this.rg); this.rg.connect(this.master); rs.start();
    // horn
    this.hg = c.createGain(); this.hg.gain.value = 0; const hl = c.createBiquadFilter(); hl.type = 'lowpass'; hl.frequency.value = 2200; this.hg.connect(hl); hl.connect(this.master);
    for (const f of [370, 466]) { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(this.hg); o.start(); }
  },
  rain(a) { if (this.ctx) this.rg.gain.setTargetAtTime(clamp(a, 0, 1) * 0.12, this.ctx.currentTime, 0.3); },
  thunder(dist) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + dist, s = c.createBufferSource(); s.buffer = this.brown; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.15); g.gain.exponentialRampToValueAtTime(0.001, t + 3.5); s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + 3.6);
  },
  tick() { this.burst(0.05, 3500, 0.025, 'bandpass', 6); },
  start() { if (!this.ctx) return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(30, t); o.frequency.linearRampToValueAtTime(70, t + 0.5); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.1); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; o.connect(f); f.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.75); },
  chirp(x, z) {
    if (!this.ctx) return; const v = this.vol(x, z) * 0.03; if (v < 0.002) return; const c = this.ctx, t = c.currentTime;
    for (let k = 0; k < 3; k++) { const o = c.createOscillator(), g = c.createGain(), t0 = t + k * 0.11; o.frequency.setValueAtTime(3200 + Math.random() * 1200, t0); o.frequency.exponentialRampToValueAtTime(2200, t0 + 0.08); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09); o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + 0.1); }
  },
  setMute(m) { this.on = !m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05); },
  engine(on, rpm, load) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.eg.gain.setTargetAtTime(on ? 0.06 + load * 0.06 : 0, t, 0.08);
    this.o1.frequency.setTargetAtTime(38 + rpm * 120, t, 0.05); this.o2.frequency.setTargetAtTime(19 + rpm * 60, t, 0.05);
    this.elp.frequency.setTargetAtTime(500 + rpm * 1400 + load * 600, t, 0.05);
  },
  tyre(a) { if (this.ctx) this.tg.gain.setTargetAtTime(clamp(a, 0, 1) * 0.07, this.ctx.currentTime, 0.05); },
  horn(on) { if (this.ctx) this.hg.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.02); },
  vol(x, z) { const d = Math.hypot(x - camera.position.x, z - camera.position.z); return clamp(1 - d / 70, 0, 1); },
  burst(gain, freq, dur, type = 'lowpass', q = 1) {
    if (!this.ctx || gain < 0.005) return; const c = this.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain();
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },
  crash(s, x, z) { const v = this.vol(x, z); this.burst(Math.min(0.9, s * 0.07) * v, 700, 0.5); this.burst(Math.min(0.5, s * 0.04) * v, 3200, 0.25, 'bandpass', 2); },
  thud(s, x, z) { this.burst(0.5 * this.vol(x, z), 260, 0.3); },
  step(run) { this.burst(run ? 0.07 : 0.04, 900, 0.07, 'bandpass', 1.5); },
  door() {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.18); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.3); this.burst(0.08, 1800, 0.06, 'bandpass', 2);
  },
  honk(x, z) {
    if (!this.ctx) return; const v = this.vol(x, z) * 0.05; if (v < 0.003) return; const c = this.ctx, t = c.currentTime, g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.02); g.gain.setValueAtTime(v, t + 0.35); g.gain.linearRampToValueAtTime(0, t + 0.4); g.connect(this.master);
    for (const f of [415, 523]) { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + 0.42); }
  }
};

/* ============================================================
   Input
   ============================================================ */
const input = { mx: 0, my: 0, run: false, runToggle: false, jumpQ: false, actQ: false, horn: false, hand: false, jx: 0, jy: 0, steer: 0, cGas: false, cBrake: false, cLeft: false, cRight: false };
const keys = new Set();
const typing = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); };
addEventListener('keydown', e => {
  if (!started || typing()) return;
  if (e.code === 'Escape' && chat.open) { closeChat(); return; }
  keys.add(e.code);
  if (e.code === 'Space') { input.jumpQ = true; e.preventDefault(); }
  if (!e.repeat && (e.code === 'KeyE' || e.code === 'KeyF' || e.code === 'Enter')) input.actQ = true;
  if (!e.repeat && e.code === 'KeyT') cycleTime();
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
function readKeys(dt = 1 / 60) {
  const k = c => keys.has(c);
  const kx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
  const ky = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
  if (player && player.state === 'car') {
    // pedals on the left edge, steering on the right edge; steering eases in like a real wheel
    const sx = clamp(kx + (input.cRight ? 1 : 0) - (input.cLeft ? 1 : 0), -1, 1);
    input.steer += clamp(sx - input.steer, -(sx ? 3.2 : 6) * dt, (sx ? 3.2 : 6) * dt);
    input.mx = input.steer; input.my = clamp(ky + (input.cGas ? 1 : 0) - (input.cBrake ? 1 : 0), -1, 1);
  } else { input.steer = 0; input.mx = clamp(kx + input.jx, -1, 1); input.my = clamp(ky + input.jy, -1, 1); }
  input.run = k('ShiftLeft') || k('ShiftRight') || input.runToggle;
  input.horn = k('KeyH') || input.hornBtn;
  input.hand = k('Space') || input.handBtn;
}
const cv = renderer.domElement;
let joyId = null, joyX = 0, joyY = 0, lookId = null, lookX = 0, lookY = 0, touchUI = false;
const JR = 54;
function showTouchUI() { if (touchUI) return; touchUI = true; syncTouchUI(true); }
let lastUiMode = '';
function syncTouchUI(force) {
  if (!touchUI) return;
  const mode = chat.open ? 'chat' : player && (player.state === 'car' || player.state === 'entering') ? 'car' : 'foot';
  if (mode === lastUiMode && !force) return; lastUiMode = mode;
  $('pad').hidden = mode !== 'foot'; $('joy-hint').hidden = mode !== 'foot'; if (mode !== 'foot') { $('joy').hidden = true; joyId = null; input.jx = input.jy = 0; }
  for (const id of ['drive-l', 'drive-r', 'drive-x']) $(id).hidden = mode !== 'car';
  if (mode !== 'car') { input.cGas = input.cBrake = input.cLeft = input.cRight = false; input.hornBtn = input.handBtn = false; for (const b of document.querySelectorAll('.dbtn')) b.classList.remove('down'); }
}
cv.addEventListener('pointerdown', e => {
  if (!started) return; Audio.init();
  if (typing()) document.activeElement.blur();
  if (e.pointerType !== 'mouse') {
    showTouchUI();
    const foot = player.state === 'foot' && !chat.open;
    if (foot && e.clientX < innerWidth * 0.45 && joyId === null) { joyId = e.pointerId; joyX = e.clientX; joyY = e.clientY; const j = $('joy'); j.style.left = joyX + 'px'; j.style.top = joyY + 'px'; j.hidden = false; $('joy-hint').hidden = true; $('joy-knob').style.transform = ''; }
    else if (lookId === null) { lookId = e.pointerId; lookX = e.clientX; lookY = e.clientY; }
  } else { lookId = e.pointerId; lookX = e.clientX; lookY = e.clientY; }
  try { cv.setPointerCapture(e.pointerId); } catch (_) { }
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId === joyId) {
    let dx = e.clientX - joyX, dy = e.clientY - joyY; const l = Math.hypot(dx, dy); if (l > JR) { dx *= JR / l; dy *= JR / l; }
    input.jx = dx / JR; input.jy = -dy / JR; $('joy-knob').style.transform = `translate(${dx}px,${dy}px)`;
  } else if (e.pointerId === lookId) {
    const s = e.pointerType === 'mouse' ? 0.0042 : 0.0062;
    cam.yaw -= (e.clientX - lookX) * s; cam.pitch = clamp(cam.pitch + (e.clientY - lookY) * s, -0.3, 1.25); cam.lastLook = simTime;
    lookX = e.clientX; lookY = e.clientY;
  }
});
const endPtr = e => {
  if (e.pointerId === joyId) { joyId = null; input.jx = input.jy = 0; $('joy').hidden = true; if (player.state === 'foot' && !chat.open) $('joy-hint').hidden = false; }
  if (e.pointerId === lookId) lookId = null;
};
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('wheel', e => { cam.zoom = clamp(cam.zoom * (1 + e.deltaY * 0.001), 0.55, 1.9); e.preventDefault(); }, { passive: false });
cv.addEventListener('contextmenu', e => e.preventDefault());
function holdBtn(id, on, off) {
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Audio.init(); try { b.setPointerCapture(e.pointerId); } catch (_) { } b.classList.add('down'); on(); if (navigator.vibrate) try { navigator.vibrate(8); } catch (_) { } });
  const up = () => { if (!b.classList.contains('down')) return; b.classList.remove('down'); off && off(); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  b.addEventListener('keydown', e => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); e.stopPropagation(); on(); setTimeout(() => off && off(), 120); } });
}
holdBtn('b-jump', () => { input.jumpQ = true; });
holdBtn('b-run', () => { input.runToggle = !input.runToggle; $('b-run').classList.toggle('on', input.runToggle); });
holdBtn('b-act', () => { input.actQ = true; });
holdBtn('b-exit', () => { input.actQ = true; });
holdBtn('b-horn', () => { input.hornBtn = true; }, () => { input.hornBtn = false; });
holdBtn('b-hand', () => { input.handBtn = true; }, () => { input.handBtn = false; });
holdBtn('c-gas', () => { input.cGas = true; }, () => { input.cGas = false; });
holdBtn('c-brake', () => { input.cBrake = true; }, () => { input.cBrake = false; });
holdBtn('c-left', () => { input.cLeft = true; }, () => { input.cLeft = false; });
holdBtn('c-right', () => { input.cRight = true; }, () => { input.cRight = false; });
$('btn-time').addEventListener('click', () => cycleTime());
$('btn-sound').addEventListener('click', () => { Audio.init(); Audio.setMute(Audio.on); $('btn-sound').textContent = Audio.on ? 'صدا: روشن' : 'صدا: خاموش'; });
$('btn-weather').addEventListener('click', () => { const order = ['auto', 'clear', 'cloudy', 'rain']; settings.weather = order[(order.indexOf(settings.weather) + 1) % 4]; saveSettings(); applyWeatherSetting(); });
$('btn-settings').addEventListener('click', () => openSettings());
$('chat-close').addEventListener('click', () => closeChat());
$('chat-form').addEventListener('submit', e => { e.preventDefault(); sendChat($('chat-input').value); });
for (const id of ['chat', 'settings']) for (const ev of ['pointerdown', 'touchstart']) $(id).addEventListener(ev, e => e.stopPropagation(), { passive: true });
{
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) $('chat-mic').hidden = true;
  else $('chat-mic').addEventListener('click', () => {
    try {
      const r = new SR(); r.lang = 'fa-IR'; r.interimResults = false; r.maxAlternatives = 1;
      $('chat-mic').classList.add('on'); r.onresult = ev => { const t = ev.results[0][0].transcript; sendChat(t); };
      r.onend = () => $('chat-mic').classList.remove('on'); r.onerror = () => { $('chat-mic').classList.remove('on'); addMsg('sys', 'میکروفون در دسترس نیست؛ لطفاً تایپ کن.'); };
      r.start();
    } catch (_) { addMsg('sys', 'میکروفون در دسترس نیست؛ لطفاً تایپ کن.'); }
  });
}
function openSettings() {
  const s = $('settings'); s.hidden = false;
  $('set-quality').value = settings.quality; $('set-voice').checked = settings.voice; $('set-key').value = settings.aiKey || '';
}
$('set-close').addEventListener('click', () => {
  settings.quality = $('set-quality').value; settings.voice = $('set-voice').checked; settings.aiKey = $('set-key').value.trim();
  saveSettings(); applyQuality(); $('settings').hidden = true;
});
$('set-form').addEventListener('submit', e => { e.preventDefault(); $('set-close').click(); });

/* ============================================================
   Player, cars, camera
   ============================================================ */
let simTime = 0, started = false;
const cars = [];
const playerLook = { skin: '#e0ac83', hair: '#2a1b12', shirt: '#e07a2e', pants: '#2a3a55', shoes: '#f2f2f2', style: 'short', cap: '#1f2a3a', sleeves: true, h: 1 };
let player;
const cam = { yaw: Math.PI, pitch: 0.32, dist: 4.6, cur: 4.6, zoom: 1, target: new V3(), shake: 0, lastLook: -9, fov: 60 };
function spawnTraffic() {
  // a guaranteed car next to the spawn point
  const pc = new Car('sedan', 0xb3161b, -1, roadX(2) + PARKOFF, Math.PI / 2); cars.push(pc);
  const spots = world.parking.filter(s => Math.hypot(s.x - pc.x, s.z - pc.z) > 9).sort(() => Math.random() - 0.5);
  const nParked = LOW ? 10 : 18;
  for (let k = 0; k < nParked && k < spots.length; k++) { const s = spots[k]; cars.push(new Car(mpick(['sedan', 'hatch', 'suv', 'sedan']), mpick(CAR_COLS), s.x, s.z, s.h)); }
  const nAI = LOW ? 9 : 15; let tries = 0;
  while (cars.filter(c => c.ai).length < nAI && tries++ < 400) {
    const i = Math.floor(Math.random() * (N + 1)), j = Math.floor(Math.random() * (N + 1)), d = Math.floor(Math.random() * 4);
    const pi = i - DIRS[d][0], pj = j - DIRS[d][1]; if (!inGrid(pi, pj)) continue;
    const E = exitPt(pi, pj, d), A = approachPt(i, j, d), t = 0.15 + Math.random() * 0.7, x = E.x + (A.x - E.x) * t, z = E.z + (A.z - E.z) * t;
    if (cars.some(c => Math.hypot(c.x - x, c.z - z) < 11)) continue;
    const taxi = Math.random() < 0.22;
    const c = new Car(taxi ? 'sedan' : mpick(['sedan', 'hatch', 'suv', 'hatch']), taxi ? 0xf2c12e : mpick(CAR_COLS), x, z, Math.atan2(DIRS[d][0], DIRS[d][1]), { ai: { i, j, d }, taxi });
    c.vx = Math.sin(c.h) * 8; c.vz = Math.cos(c.h) * 8; cars.push(c);
  }
}
function spawnPeople() {
  const n = LOW ? 16 : 30;
  for (let k = 0; k < n; k++) {
    const bi = Math.floor(Math.random() * N), bj = Math.floor(Math.random() * N), rg = { x: blockC(bi), z: blockC(bj) };
    const p = ringPoint(rg, Math.random() * RING * 8, 0); spawnNPC(p.x, p.z);
  }
}
function setupPlayer() {
  player = makePerson(playerLook, true); player.anim.idleKind = 'breathe'; player.isPlayer = true; player.state = 'foot'; player.where = 'out'; player.car = null; player.pushT = 0; player.stepPh = 0;
  player.pos.set(-3, CURB, roadX(2) + RH + 2.2); player.facing = Math.PI;
  outdoorPool.attach(player);
  cam.yaw = Math.PI * 0.82; cam.target.set(player.pos.x, player.pos.y + 1.45, player.pos.z);
}
function nearestCar(maxD) {
  let best = null, bd = maxD;
  for (const c of cars) { const r = carCircle(c, player.pos.x, player.pos.z, 3); if (!r) continue; const d = 3 - r.depth; if (d < bd) { bd = d; best = c; } }
  return best;
}
function nearestDoor() {
  let best = null, bd = 2.2;
  for (const d of world.doors) {
    const dx = player.pos.x - d.x, dz = player.pos.z - d.z, dn = dx * d.nx + dz * d.nz, lat = Math.abs(dx * -d.nz + dz * d.nx);
    if (dn < -0.2 || lat > 0.9 || Math.abs(player.pos.y - d.y) > 1.2) continue; const dd = Math.hypot(dx, dz); if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}
function nearestNPC(list, maxD) { let best = null, bd = maxD; for (const n of list) { if (n.mode === 'down') continue; const d = Math.hypot(n.pos.x - player.pos.x, n.pos.z - player.pos.z); if (d < bd) { bd = d; best = n; } } return best; }

function enterBuilding(door) {
  if (fading) return;
  fadeTo(() => {
    buildInterior(door);
    player.where = 'in'; interiorPool.attach(player);
    player.pos.set(0, 0, interior.D / 2 - 2.3); player.vel.set(0, 0, 0); player.facing = Math.PI; player.standCar = null;
    cam.yaw = Math.PI; cam.pitch = 0.42; cam.cur = 2.0; cam.target.set(0, 1.45, interior.D / 2 - 2.3);
    banner(door.name, door.sub || '');
  });
  Audio.door();
}
function exitBuilding() {
  if (fading) return; const d = interior.door;
  fadeTo(() => {
    player.where = 'out'; outdoorPool.attach(player);
    player.pos.set(d.x + d.nx * 1.3, groundH(d.x + d.nx * 1.3, d.z + d.nz * 1.3), d.z + d.nz * 1.3); player.vel.set(0, 0, 0); player.facing = Math.atan2(d.nx, d.nz);
    if (d.kind === 'house') player.pos.y = Math.max(player.pos.y, d.y - 0.01);
    cam.yaw = Math.atan2(d.nx, d.nz); cam.pitch = 0.3; cam.cur = 2.5; cam.target.set(player.pos.x, player.pos.y + 1.45, player.pos.z);
    d.open = 1;
    for (const n of interior.npcs) interiorPool.detach(n); interior.npcs = [];
  });
  Audio.door();
}
let fading = false;
function fadeTo(fn) {
  fading = true; $('fade').style.opacity = '1';
  setTimeout(() => { fn(); $('fade').style.opacity = '0'; setTimeout(() => { fading = false; }, 330); }, 340);
}
let bannerT = null;
function banner(t, s) { $('banner-t').textContent = t; $('banner-s').textContent = s; $('banner').classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => $('banner').classList.remove('show'), 2600); }

function ejectDriver(car, flee) {
  const n = car.driverP; if (!n || n.isPlayer) return null;
  car.driverP = null; car.hasDriver = false; n.inCar = null; n.anim.special = null; n.anim.sw = 0;
  const t = car.T, sx = Math.sin(car.h), cx = Math.cos(car.h);
  const ox = car.x + cx * (t.wid / 2 + 0.7), oz = car.z - sx * (t.wid / 2 + 0.7);
  n.npc = true; n.pos.set(ox, groundH(ox, oz), oz); n.vel.set(0, 0, 0); n.facing = car.h - Math.PI / 2; n.ring = nearestRing(ox, oz); n.s = ringParam(n.ring, ox, oz);
  n.dir = 1; n.off = -0.5; n.spd = 1.2; n.cornerCD = 5; n.decideT = 5; n.H.visible = true; npcs.push(n);
  if (flee) { n.mode = 'flee'; n.timer = 3; n.fleeSpd = 5; const ax = n.pos.x - player.pos.x, az = n.pos.z - player.pos.z, l = Math.hypot(ax, az) || 1; n.fx = ax / l; n.fz = az / l; }
  else n.mode = 'goto';
  return n;
}
function doorPoint(car, out = 0.55) { const t = car.T, sx = Math.sin(car.h), cx = Math.cos(car.h), lz = (t.cab[0] + t.cab[1]) / 2; return [car.x + cx * (t.wid / 2 + out) + sx * lz, car.z - sx * (t.wid / 2 + out) + cx * lz]; }
function enterCar(car) {
  if (car.health <= 0) { setPrompt('این ماشین خراب شده و روشن نمی‌شود.', '', 2); return; }
  player.state = 'entering'; player.car = car; player.enterT = 0; car.doorT = 1; car.inHand = true; Audio.door();
  if (car.ai) {
    car.ai = null; car.inThrottle = 0; car.hazardT = 0; car.blink = null;
    const n = ejectDriver(car, true);
    if (n) { n.persona.mem.carTaken = true; n.persona.rel -= 3; n.persona.mood = 0.2; say(n, mpick(['ماشینم!', 'دزد! دزد!', 'هی! اون ماشین منه!', 'کمک! ماشینمو بردن!']), 3); logEvent(`یکی ماشین ${n.persona.name} رو تو ${streetAt(car.x, car.z)} دزدید!`); }
  }
}
function exitCar() {
  const car = player.car, t = car.T, sx = Math.sin(car.h), cx = Math.cos(car.h);
  const cands = [[cx * (t.wid / 2 + 0.6), -sx * (t.wid / 2 + 0.6)], [-cx * (t.wid / 2 + 0.6), sx * (t.wid / 2 + 0.6)], [sx * (t.len / 2 + 0.7), cx * (t.len / 2 + 0.7)], [-sx * (t.len / 2 + 0.7), -cx * (t.len / 2 + 0.7)]];
  let spot = null, k = 0;
  for (const [ox, oz] of cands) {
    const x = car.x + ox, z = car.z + oz; world.col.query(x - 0.35, x + 0.35, z - 0.35, z + 0.35, _near);
    const gy = groundH(x, z); const blocked = _near.some(c => c.maxY > gy + STEP && (c.t === 0 ? (x + 0.32 > c.minX && x - 0.32 < c.maxX && z + 0.32 > c.minZ && z - 0.32 < c.maxZ) : Math.hypot(x - c.x, z - c.z) < c.r + 0.32)) || cars.some(o => o !== car && carCircle(o, x, z, 0.35));
    if (!blocked) { spot = [x, z, k]; break; } k++;
  }
  car.player = false; car.driverP = null; car.hasDriver = false; car.inThrottle = 0; car.inSteer = 0; car.inHand = true; car.blink = null;
  player.inCar = null; Audio.engine(false, 0, 0); Audio.tyre(0); Audio.horn(false);
  if (car.lights) car.lights.forEach(l => l.visible = false);
  if (spot && spot[2] === 0) { player.state = 'exiting'; player.exitT = 0; player.exitTo = spot; car.doorT = 1; Audio.door(); return; }
  if (!spot) { spot = [car.x, car.z]; player.pos.y = car.y + car.T.roofY + 0.1; } else player.pos.y = groundH(spot[0], spot[1]);
  player.pos.x = spot[0]; player.pos.z = spot[1]; player.vel.set(car.vx * 0.5, 0, car.vz * 0.5); player.facing = car.h + Math.PI / 2;
  player.anim.special = null; player.state = 'foot'; player.car = null;
}
function addCarLights(car) {
  if (car.lights) { car.lights.forEach(l => l.visible = true); return; }
  car.lights = [];
  for (const sx of [-0.55, 0.55]) {
    const s = new THREE.SpotLight(0xfff1d6, 0, 70, 0.45, 0.5, 1.5); s.position.set(sx, car.T.headY, car.T.front);
    const tg = new THREE.Object3D(); tg.position.set(sx * 1.5, 0, car.T.front + 18); car.body.add(s, tg); s.target = tg; car.lights.push(s);
  }
}

/* ---------- conversation with people ---------- */
const chat = { open: false, npc: null, busy: false };
const settings = { quality: LOW ? 'medium' : 'high', voice: false, aiKey: '', weather: 'auto' };
try { Object.assign(settings, JSON.parse(localStorage.getItem('shahr-settings') || '{}')); } catch (_) { }
function saveSettings() { try { localStorage.setItem('shahr-settings', JSON.stringify(settings)); } catch (_) { } }
const events = [];
function logEvent(t) { events.push(t); if (events.length > 10) events.shift(); }
function streetAt(x, z) {
  if (Math.abs(x) > OUTER + 2 || Math.abs(z) > OUTER + 2) return 'حومهٔ شهر';
  if (world.parks.some(p => x > p[0] && x < p[2] && z > p[1] && z < p[3])) return 'پارک مرکزی';
  const a = nearestRoad(x), b = nearestRoad(z); return a.d < b.d ? STREET_V[a.k] : STREET_H[b.k];
}
const SYN = [['نانوایی', 'نون نان نانوایی بربری سنگک'], ['سوپرمارکت', 'سوپر سوپرمارکت خرید بقالی مغازه خوراکی'], ['کافه', 'کافه قهوه کافی'], ['داروخانه', 'دارو داروخانه قرص دکتر'], ['کتاب', 'کتاب کتابفروشی'],
  ['گل', 'گل گلفروشی'], ['میوه', 'میوه'], ['شیرینی', 'شیرینی کیک قنادی'], ['قنادی', 'شیرینی کیک قنادی'], ['بستنی', 'بستنی'], ['پوشاک', 'لباس پوشاک'], ['کفش', 'کفش'], ['موبایل', 'موبایل گوشی'], ['بانک', 'بانک پول عابر'],
  ['پست', 'پست نامه'], ['آرایشگاه', 'آرایشگاه سلمونی'], ['چای', 'چای چایخانه قلیون'], ['لبنیات', 'ماست شیر پنیر لبنیات'], ['عطاری', 'عطاری گیاه'], ['ابزار', 'ابزار آچار'], ['عینک', 'عینک'], ['ساعت', 'ساعت'], ['آجیل', 'آجیل تخمه'],
  ['اسباب', 'اسباب بازی'], ['خشکشویی', 'خشکشویی'], ['کتابخانه', 'کتابخانه'], ['نقاشی', 'نقاشی قاب'], ['لوازم', 'لوازم التحریر دفتر مداد'], ['سبزی', 'سبزی']];
function routeText(x, z) {
  const P = player, fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), rx = -fz, rz = fx;
  const dx = x - P.pos.x, dz = z - P.pos.z, f = dx * fx + dz * fz, r = dx * rx + dz * rz, d = Math.hypot(dx, dz);
  const m = v => fa(Math.max(10, Math.round(Math.abs(v) / 10) * 10)) + ' متر';
  const st = streetAt(x, z);
  if (d < 15) return 'همین‌جاست، چند قدم اون‌طرف‌تر';
  if (Math.abs(r) < Math.abs(f) * 0.35) return f > 0 ? `مستقیم برو جلو، حدود ${m(f)}، تو ${st}` : `برگرد عقب، حدود ${m(f)}، تو ${st}`;
  if (Math.abs(f) < Math.abs(r) * 0.35) return `از سمت ${r > 0 ? 'راست' : 'چپ'} برو، حدود ${m(r)}، تو ${st}`;
  return `${f > 0 ? 'حدود ' + m(f) + ' جلو برو' : 'حدود ' + m(f) + ' برگرد عقب'} بعد بپیچ سمت ${r > 0 ? 'راست' : 'چپ'}، حدود ${m(r)} دیگه، تو ${st}`;
}
function places() {
  const out = [];
  for (const d of world.doors) {
    if (d.kind !== 'shop') continue;
    const keys = d.name.split(/\s+/).filter(w => w.length > 2).map(w => norm(w));
    for (const [k, syn] of SYN) if (d.name.includes(k)) keys.push(...syn.split(' '));
    out.push({ name: d.name, keys, x: d.x, z: d.z, dist: Math.hypot(d.x - player.pos.x, d.z - player.pos.z) });
  }
  for (const f of world.fountains) out.push({ name: 'پارک مرکزی', keys: ['پارک', 'فواره', 'حوض', 'باغ'], x: f.x, z: f.z, dist: Math.hypot(f.x - player.pos.x, f.z - player.pos.z) });
  STREET_V.forEach((n, i) => out.push({ name: n, keys: [norm(n), norm(n.replace('خیابان ', ''))], x: roadX(i), z: clamp(player.pos.z, -HALF, HALF), dist: Math.abs(roadX(i) - player.pos.x) }));
  STREET_H.forEach((n, i) => out.push({ name: n, keys: [norm(n), norm(n.replace('خیابان ', ''))], x: clamp(player.pos.x, -HALF, HALF), z: roadX(i), dist: Math.abs(roadX(i) - player.pos.z) }));
  const cd = cars.filter(c => c.taxi && c.ai).sort((a, b) => Math.hypot(a.x - player.pos.x, a.z - player.pos.z) - Math.hypot(b.x - player.pos.x, b.z - player.pos.z))[0];
  if (cd) out.push({ name: 'یه تاکسی', keys: ['تاکسی'], x: cd.x, z: cd.z, dist: Math.hypot(cd.x - player.pos.x, cd.z - player.pos.z) });
  for (const p of out) p.how = routeText(p.x, p.z);
  out.sort((a, b) => a.dist - b.dist);
  return out;
}
function dialogCtx(n) {
  const hh = Math.floor(tod), mm = Math.floor((tod - hh) * 60);
  return { hour: tod, timeStr: fa(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0')), weather: weather.state, place: player.where === 'in' ? interior.door.name : streetAt(player.pos.x, player.pos.z),
    home: n.ring ? streetAt(n.ring.x + RING, n.ring.z) : (interior.door ? interior.door.name : STREET_H[1]), events, places: places() };
}
function addMsg(who, text) {
  const el = document.createElement('div'); el.className = 'msg ' + who; el.textContent = text; $('chat-log').appendChild(el); $('chat-log').scrollTop = 1e6; return el;
}
function openChat(n) {
  chat.open = true; chat.npc = n; n.prevMode = n.mode; n.mode = 'talk'; n.vel.set(0, 0, 0); n.anim.special = n.anim.special === 'sit' ? 'sit' : null;
  if (n.partner) { n.partner.partner = null; n.partner = null; }
  const p = n.persona; $('chat-name').textContent = `${p.name} ${p.family}`; $('chat-sub').textContent = `${p.job}، ${fa(p.age)} ساله`;
  $('chat-log').innerHTML = ''; $('chat').hidden = false; $('pad').hidden = true; $('joy').hidden = true; $('joy-hint').hidden = true; setPrompt('', '');
  const chips = $('chat-chips'); chips.innerHTML = '';
  for (const q of QUICK) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip-q'; b.textContent = q; b.addEventListener('click', () => sendChat(q)); chips.appendChild(b); }
  const open = p.mem.carTaken ? 'باز تویی؟! ماشینمو پس بده!' : p.mem.hitByPlayer ? 'تویی که با ماشین زدی به من! چی می‌خوای؟' : p.met ? `${p.mem.playerName ? p.mem.playerName + '! ' : ''}باز هم سلام!` : mpick(['بله؟ کاری داشتی؟', 'سلام! چیزی می‌خواستی؟', 'جانم؟', 'سلام، بفرمایید.']);
  npcSpeak(n, open);
  $('chat-ai').textContent = settings.aiKey ? 'گفتگو با هوش مصنوعی Claude' : 'گفتگوی آفلاین';
  if (!touchUI) setTimeout(() => $('chat-input').focus(), 50);
}
function closeChat() {
  if (!chat.open) return; chat.open = false; $('chat').hidden = true; $('chat-input').blur();
  const n = chat.npc; chat.npc = null; if (window.speechSynthesis) speechSynthesis.cancel();
  if (n && n.mode === 'talk') finishMode(n);
  if (touchUI) { $('pad').hidden = false; $('joy-hint').hidden = false; }
}
function npcSpeak(n, text) {
  addMsg('npc', text); say(n, text, clamp(text.length * 0.07, 2.5, 7)); n.anim.talkT = clamp(text.length * 0.055, 1.2, 6);
  if (settings.voice && window.speechSynthesis) {
    try {
      speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'fa-IR';
      const v = speechSynthesis.getVoices().find(v => /^fa/i.test(v.lang)); if (v) u.voice = v;
      u.pitch = n.persona.female ? 1.25 : 0.85; u.rate = 1.02; speechSynthesis.speak(u);
    } catch (_) { }
  }
}
async function sendChat(text) {
  text = (text || '').trim(); const n = chat.npc;
  if (!n || chat.busy || !text) return;
  $('chat-input').value = ''; addMsg('me', text); chat.busy = true; player.anim.talkT = clamp(text.length * 0.06, 1, 4);
  const typing = addMsg('npc typing', '…');
  const ctx = dialogCtx(n); let res = null, note = '';
  const t0 = performance.now();
  if (settings.aiKey) { try { res = await replyAI(n, text, ctx, settings.aiKey); } catch (e) { note = 'اتصال به Claude برقرار نشد؛ پاسخ آفلاین داده شد.'; } }
  if (!res) res = replyOffline(n, text, ctx);
  const wait = Math.max(0, 450 + Math.min(900, res.reply.length * 12) - (performance.now() - t0));
  await new Promise(r => setTimeout(r, wait));
  typing.remove(); chat.busy = false;
  if (note) addMsg('sys', note);
  if (chat.npc !== n) return;
  npcSpeak(n, res.reply);
  if (res.action) npcAct(n, res.action);
  if (res.guide) setWaypoint(res.guide);
  if (res.end) setTimeout(() => { if (chat.npc === n) closeChat(); }, 1600);
}
/* waypoint marker that a person can set for you */
let waypoint = null, wpMesh = null;
function setWaypoint(pl) {
  waypoint = { name: pl.name, x: pl.x, z: pl.z };
  if (!wpMesh) {
    wpMesh = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 60, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb340, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    beam.position.y = 30; wpMesh.add(beam);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.08, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffc66e, toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.25; wpMesh.add(ring);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshStandardMaterial({ color: 0xffb340, emissive: 0xff9a20, emissiveIntensity: 1.6 })); gem.position.y = 3.2; wpMesh.add(gem); wpMesh.userData.gem = gem;
    scene.add(wpMesh);
  }
  wpMesh.visible = true; wpMesh.position.set(pl.x, groundH(pl.x, pl.z), pl.z);
  banner('مقصد: ' + pl.name, 'علامت نارنجی را روی نقشه و در شهر دنبال کن');
}

function updatePlayer(dt) {
  const P = player, outdoor = P.where === 'out', col = outdoor ? world.col : interior.col;
  if (waypoint && Math.hypot(waypoint.x - P.pos.x, waypoint.z - P.pos.z) < 7) { banner('رسیدی!', waypoint.name); waypoint = null; if (wpMesh) wpMesh.visible = false; }
  if (P.state === 'foot' || P.state === 'down') {
    let mx = input.mx, my = input.my; if (chat.open) { mx = 0; my = 0; input.jumpQ = false; }
    const mag = Math.min(1, Math.hypot(mx, my));
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), rx = -Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
    let dx = fx * my + rx * mx, dz = fz * my + rz * mx; const dl = Math.hypot(dx, dz); if (dl > 0) { dx /= dl; dz /= dl; }
    if (P.mode === 'down') {
      if (chat.open) closeChat();
      P.knockT += dt; if (P.onGround) { P.vel.x *= Math.exp(-5 * dt); P.vel.z *= Math.exp(-5 * dt); }
      P.anim.knock = damp(P.anim.knock, P.knockT < 2.2 ? 1 : 0, P.knockT < 2.2 ? 7 : 2.5, dt);
      P.anim.getup = damp(P.anim.getup, P.knockT > 2.2 && P.knockT < 3.2 ? 1 : 0, 6, dt);
      if (P.knockT > 3.4) { P.mode = 'walk'; P.state = 'foot'; }
      stepCharacter(P, col, dt, outdoor); input.jumpQ = false; input.actQ = false; return;
    }
    P.anim.knock = damp(P.anim.knock, 0, 5, dt); P.anim.getup = damp(P.anim.getup, 0, 6, dt);
    const running = input.run || (touchUI && mag > 0.93);
    const tsp = mag * (running ? 6.6 : 2.5);
    const k = P.onGround ? 12 : 2.5;
    P.vel.x = damp(P.vel.x, dx * tsp, k, dt); P.vel.z = damp(P.vel.z, dz * tsp, k, dt);
    if (tsp > 0.1) P.facing += angDiff(P.facing, Math.atan2(dx, dz)) * Math.min(1, 12 * dt);
    else if (chat.open && chat.npc) P.facing += angDiff(P.facing, Math.atan2(chat.npc.pos.x - P.pos.x, chat.npc.pos.z - P.pos.z)) * Math.min(1, 6 * dt);
    if (input.jumpQ && P.onGround && P.anim.prep <= 0) { P.anim.prep = 0.09; P.jumpAt = simTime + 0.09; }
    input.jumpQ = false;
    if (P.jumpAt && simTime >= P.jumpAt) { P.jumpAt = 0; if (P.onGround) { P.vel.y = 6.6; P.onGround = false; P.standCar = null; Audio.step(true); } }
    stepCharacter(P, col, dt, outdoor);
    if (P.onGround) { const ph = Math.floor(P.anim.phase / Math.PI); if (ph !== P.stepPh) { P.stepPh = ph; if (Math.hypot(P.vel.x, P.vel.z) > 0.8) { Audio.step(running); if (outdoor && weather.wet > 0.4) FX.splash(P.pos.x, P.pos.y, P.pos.z); } } }
    if (chat.open) { input.actQ = false; if (!chat.npc || Math.hypot(chat.npc.pos.x - P.pos.x, chat.npc.pos.z - P.pos.z) > 5 || chat.npc.mode === 'down') closeChat(); return; }
    // interactions
    let promptTxt = '', actLabel = '';
    const key = touchUI ? '' : '<b>E</b> — ';
    if (outdoor) {
      const door = nearestDoor();
      if (door) {
        const dn = (P.pos.x - door.x) * door.nx + (P.pos.z - door.z) * door.nz;
        const pushing = dl > 0 && (dx * -door.nx + dz * -door.nz) > 0.6 && dn < 0.95;
        P.pushT = pushing ? P.pushT + dt : 0;
        promptTxt = `<b>${door.name}</b> — به در بچسب یا ${touchUI ? 'دکمهٔ «ورود»' : '<b>E</b>'} را بزن`; actLabel = 'ورود';
        if (P.pushT > 0.25 || input.actQ) { input.actQ = false; P.pushT = 0; enterBuilding(door); }
      } else {
        P.pushT = 0;
        const n = nearestNPC(npcs, 2.6), car = nearestCar(1.6);
        if (n && (!car || Math.hypot(n.pos.x - P.pos.x, n.pos.z - P.pos.z) < 1.8)) {
          actLabel = 'حرف بزن'; promptTxt = `${key}با <b>${n.persona.name}</b> حرف بزن`;
          if (input.actQ) { input.actQ = false; openChat(n); }
        } else if (car) {
          promptTxt = car.ai ? `${key}راننده را پیاده کن و پشت فرمان بنشین` : car.health <= 0 ? 'این ماشین خراب شده است' : `${key}سوار ماشین شو`; actLabel = 'سوار شو';
          if (input.actQ) { input.actQ = false; enterCar(car); }
        }
      }
    } else {
      const ex = interior.D / 2, dn = ex - P.pos.z, lat = Math.abs(P.pos.x);
      if (dn < 2.0 && lat < 0.9) {
        promptTxt = `به در بچسب یا ${touchUI ? '«خروج»' : '<b>E</b>'} را بزن تا بیرون بروی`; actLabel = 'خروج';
        const pushing = dl > 0 && dz > 0.6 && dn < 0.9; P.pushT = pushing ? P.pushT + dt : 0;
        if (P.pushT > 0.25 || input.actQ) { input.actQ = false; P.pushT = 0; exitBuilding(); }
      } else {
        P.pushT = 0;
        const n = nearestNPC(interior.npcs, 2.8);
        if (n) { actLabel = 'حرف بزن'; promptTxt = `${key}با <b>${n.persona.name}</b> حرف بزن`; if (input.actQ) { input.actQ = false; openChat(n); } }
      }
    }
    input.actQ = false;
    setPrompt(promptTxt, actLabel);
  } else if (P.state === 'entering') {
    const car = P.car; P.enterT += dt; const [tx, tz] = doorPoint(car, 0.55);
    if (P.enterT < 0.55) { P.vel.set((tx - P.pos.x) * 5, 0, (tz - P.pos.z) * 5); P.pos.x = damp(P.pos.x, tx, 9, dt); P.pos.z = damp(P.pos.z, tz, 9, dt); P.pos.y = groundH(P.pos.x, P.pos.z); P.facing += angDiff(P.facing, car.h - Math.PI / 2) * Math.min(1, 10 * dt); }
    else if (!P.inCar) { P.vel.set(0, 0, 0); P.anim.special = 'drive'; P.anim.sw = 0; car.setDriver(P); car.hasDriver = true; car.player = true; }
    if (P.enterT > 1.25) { car.doorT = 0; P.state = 'car'; addCarLights(car); car.inHand = false; Audio.door(); Audio.start(); }
    setPrompt('', '');
  } else if (P.state === 'exiting') {
    const car = P.car; P.exitT += dt; const [tx, tz] = P.exitTo;
    if (P.exitT < 0.35) { car.seatPose(P); P.anim.special = 'drive'; }
    else { P.anim.special = null; P.pos.x = damp(P.pos.x, tx, 10, dt); P.pos.z = damp(P.pos.z, tz, 10, dt); P.pos.y = groundH(tx, tz); P.facing += angDiff(P.facing, car.h + Math.PI / 2) * Math.min(1, 8 * dt); P.vel.set(0, 0, 0); }
    if (P.exitT >= 0.35 && P.exitT - dt < 0.35) { const [sx, sz] = doorPoint(car, -0.3); P.pos.set(sx, car.y + 0.2, sz); }
    if (P.exitT > 0.9) { P.state = 'foot'; car.closeT = 0.3; P.car = null; }
  } else if (P.state === 'car') {
    const car = P.car;
    car.inThrottle = input.my; car.inSteer = input.mx; car.inHand = input.hand;
    P.pos.set(car.x, car.y + 0.6, car.z);
    const kmh = Math.abs(car.vf) * 3.6;
    if (input.actQ) { input.actQ = false; if (kmh < 12) exitCar(); else setPrompt('برای پیاده شدن اول سرعت را کم کن', 'پیاده شو', 1.2); }
    else if (promptHold <= 0) setPrompt(car.health <= 0 ? 'ماشین خراب شد! پیاده شو و یه ماشین دیگه پیدا کن.' : car.health < 30 ? 'موتور آسیب دیده و دود می‌کند.' : '', 'پیاده شو');
    if (input.horn && !P.hornOn) hornEvent = { x: car.x, z: car.z, h: car.h, t: simTime };
    P.hornOn = input.horn; Audio.horn(input.horn);
    car.blink = Math.abs(car.steer) > 0.25 && Math.abs(car.vf) > 1 ? (car.steer > 0 ? 'R' : 'L') : null;
    if (car.lights) { const on = night > 0.3 || weather.rain > 0.5; car.lights.forEach(l => l.intensity = on ? 90 : 0); }
  }
}
let promptHold = 0, lastPrompt = '', lastAct = '';
function setPrompt(txt, act, hold) {
  if (hold) promptHold = hold;
  if (txt !== lastPrompt) { lastPrompt = txt; const p = $('prompt'); p.hidden = !txt; p.innerHTML = txt; }
  if (act !== lastAct) { lastAct = act; const b = $('b-act'); b.textContent = act || '—'; b.style.opacity = act ? '1' : '0.4'; }
}

function updateCamera(dt) {
  const P = player;
  const outdoor = P.where === 'out';
  let tx, ty, tz, desired;
  if (P.state === 'car') {
    const c = P.car; tx = c.x; ty = c.y + 1.55; tz = c.z;
    desired = (6.4 + c.T.len * 0.35) * cam.zoom;
    if (simTime - cam.lastLook > 1.3 && Math.abs(c.vf) > 1) { const back = c.vf >= -0.5 ? c.h : c.h + Math.PI; cam.yaw += angDiff(cam.yaw, back) * Math.min(1, dt * (1.2 + Math.abs(c.vf) * 0.12)); cam.pitch = damp(cam.pitch, 0.22, 1.5, dt); }
    cam.target.set(tx, damp(cam.target.y, ty, 8, dt), tz);
  } else if (chat.open && chat.npc) {
    // over-the-shoulder conversation framing
    const n = chat.npc, mx = lerp(P.pos.x, n.pos.x, 0.6), mz = lerp(P.pos.z, n.pos.z, 0.6);
    const base = Math.atan2(n.pos.x - P.pos.x, n.pos.z - P.pos.z), col0 = outdoor ? world.col : interior.col;
    if (!chat.side || simTime > chat.sideT) { chat.sideT = simTime + 1.5; let best = -0.42, bd = -1; for (const off of [-0.42, 0.42, -0.9, 0.9]) { const y = base + off, d = rayCast(col0, mx, n.pos.y + 1.5, mz, -Math.sin(y) * 0.99, 0.1, -Math.cos(y) * 0.99, 3.2, 0.1); if (d > bd + 0.2) { bd = d; best = off; } } chat.side = best; }
    const yawT = base + chat.side;
    cam.yaw += angDiff(cam.yaw, yawT) * Math.min(1, 3 * dt); cam.pitch = damp(cam.pitch, 0.1, 3, dt);
    cam.target.x = damp(cam.target.x, mx, 5, dt); cam.target.z = damp(cam.target.z, mz, 5, dt); cam.target.y = damp(cam.target.y, n.pos.y + 1.55 * (n.look.h || 1), 5, dt);
    desired = 2.6;
  } else {
    tx = P.pos.x; ty = P.pos.y + 1.45 - P.anim.knock * 1.0; tz = P.pos.z;
    if (P.state === 'entering' || P.state === 'exiting') { tx = P.car.x; tz = P.car.z; ty = P.car.y + 1.4; }
    desired = (outdoor ? 4.6 : 3.1) * cam.zoom;
    cam.target.x = damp(cam.target.x, tx, 18, dt); cam.target.z = damp(cam.target.z, tz, 18, dt); cam.target.y = damp(cam.target.y, ty, 9, dt);
  }
  const cp = Math.cos(cam.pitch), dx = -Math.sin(cam.yaw) * cp, dy = Math.sin(cam.pitch), dz = -Math.cos(cam.yaw) * cp;
  const col = outdoor ? world.col : interior.col;
  const hit = rayCast(col, cam.target.x, cam.target.y, cam.target.z, dx, dy, dz, desired + 0.3, chat.open ? 0.1 : 0.45) - 0.3;
  const want = Math.max(0.6, Math.min(desired, hit));
  cam.cur = want < cam.cur ? want : damp(cam.cur, want, 3, dt);
  let px = cam.target.x + dx * cam.cur, py = cam.target.y + dy * cam.cur, pz = cam.target.z + dz * cam.cur;
  if (outdoor) py = Math.max(py, groundH(px, pz) + 0.35); else py = clamp(py, 0.4, 2.9);
  if (cam.shake > 0) { px += (Math.random() - 0.5) * cam.shake * 0.4; py += (Math.random() - 0.5) * cam.shake * 0.4; pz += (Math.random() - 0.5) * cam.shake * 0.4; cam.shake = Math.max(0, cam.shake - dt * 1.6); }
  camera.position.set(px, py, pz); camera.lookAt(cam.target);
  const off = chat.open && innerWidth > innerHeight * 1.25 ? innerWidth * 0.2 : 0;
  cam.voff = damp(cam.voff || 0, off, 5, dt);
  if (cam.voff > 1) camera.setViewOffset(innerWidth, innerHeight, cam.voff, 0, innerWidth, innerHeight); else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  const fovT = 60 + (P.state === 'car' ? clamp(Math.abs(P.car.vf) * 0.32, 0, 14) : 0);
  cam.fov = damp(cam.fov, fovT, 3, dt); if (Math.abs(camera.fov - cam.fov) > 0.05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
}

/* ============================================================
   Minimap
   ============================================================ */
let mapBase = null; const MAPW = 560;
function buildMapBase() {
  const c = mkCanvas(1024), g = c.getContext('2d'), s = 1024 / MAPW, X = v => (v + MAPW / 2) * s;
  g.fillStyle = '#3c5a2f'; g.fillRect(0, 0, 1024, 1024);
  g.fillStyle = '#9a958c'; g.fillRect(X(-OUTER), X(-OUTER), 2 * OUTER * s, 2 * OUTER * s);
  g.fillStyle = '#4c4f55';
  for (let i = 0; i <= N; i++) { const x = roadX(i); g.fillRect(X(x - RH), X(-HALF - RH), 2 * RH * s, (2 * HALF + 2 * RH) * s); g.fillRect(X(-HALF - RH), X(x - RH), (2 * HALF + 2 * RH) * s, 2 * RH * s); }
  for (let bi = 0; bi < N; bi++) for (let bj = 0; bj < N; bj++) { const cx = blockC(bi), cz = blockC(bj); g.fillStyle = '#6f8a55'; g.fillRect(X(cx - LOT), X(cz - LOT), 2 * LOT * s, 2 * LOT * s); }
  for (const p of world.parks) { g.fillStyle = '#4f8a3e'; g.fillRect(X(p[0]), X(p[1]), (p[2] - p[0]) * s, (p[3] - p[1]) * s); }
  for (const f of world.foot) { g.fillStyle = f[4]; g.fillRect(X(f[0]), X(f[1]), (f[2] - f[0]) * s, (f[3] - f[1]) * s); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5; g.strokeRect(X(f[0]), X(f[1]), (f[2] - f[0]) * s, (f[3] - f[1]) * s); }
  for (const f of world.fountains) { g.fillStyle = '#5aa6d6'; g.beginPath(); g.arc(X(f.x), X(f.z), 3.4 * s, 0, 7); g.fill(); }
  mapBase = c;
}
function drawMap() {
  const cvm = $('minimap'), g = cvm.getContext('2d'), W = cvm.width, s = 1024 / MAPW, zoom = 1.25;
  const px = player.where === 'out' ? (player.state === 'car' ? player.car.x : player.pos.x) : interior.door.x, pz = player.where === 'out' ? (player.state === 'car' ? player.car.z : player.pos.z) : interior.door.z;
  const rot = -Math.PI / 2 - Math.atan2(Math.cos(cam.yaw), Math.sin(cam.yaw));
  g.save(); g.fillStyle = '#2a3a24'; g.fillRect(0, 0, W, W);
  g.translate(W / 2, W / 2); g.rotate(rot); g.scale(zoom, zoom); g.translate(-(px + MAPW / 2) * s, -(pz + MAPW / 2) * s);
  g.drawImage(mapBase, 0, 0);
  const X = v => (v + MAPW / 2) * s;
  for (const c of cars) { if (c.player) continue; g.save(); g.translate(X(c.x), X(c.z)); g.rotate(-c.h); g.fillStyle = c.taxi ? '#ffd23a' : c.ai ? '#e8e8e8' : '#9fb4c8'; g.fillRect(-c.T.wid * s / 2, -c.T.len * s / 2, c.T.wid * s, c.T.len * s); g.restore(); }
  g.fillStyle = '#ffcf7a'; for (const n of npcs) { if (n.mode === 'inside') continue; g.beginPath(); g.arc(X(n.pos.x), X(n.pos.z), 2.2, 0, 7); g.fill(); }
  if (waypoint) { g.strokeStyle = '#ffb340'; g.lineWidth = 4; g.setLineDash([10, 7]); g.beginPath(); g.moveTo(X(px), X(pz)); g.lineTo(X(waypoint.x), X(waypoint.z)); g.stroke(); g.setLineDash([]); g.fillStyle = '#ffb340'; g.strokeStyle = '#1b1208'; g.lineWidth = 3; g.beginPath(); g.arc(X(waypoint.x), X(waypoint.z), 10, 0, 7); g.fill(); g.stroke(); }
  g.restore();
  const head = player.state === 'car' ? player.car.h : player.facing;
  g.save(); g.translate(W / 2, W / 2); g.rotate(rot - head + Math.PI);
  g.fillStyle = '#ffb340'; g.strokeStyle = '#1b1208'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -16); g.lineTo(11, 12); g.lineTo(0, 6); g.lineTo(-11, 12); g.closePath(); g.fill(); g.stroke(); g.restore();
}

/* ============================================================
   Main loop
   ============================================================ */
const _obs = [];
let frameAcc = 0, frameN = 0, perfT = 0, mapTick = 0;
let composer = null, renderPass = null, bloomPass = null;
function setupComposer() {
  if (composer) { composer.dispose?.(); composer = null; }
  if (settings.quality === 'low') return;
  const size = renderer.getDrawingBufferSize(new V2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
  composer = new EffectComposer(renderer, rt);
  renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
  bloomPass = new UnrealBloomPass(new V2(innerWidth, innerHeight), 0.3, 0.45, 1.0); composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  composer.setPixelRatio(pixelRatio); composer.setSize(innerWidth, innerHeight);
}
function applyQuality() {
  const q = settings.quality;
  pixelRatio = Math.min(window.devicePixelRatio || 1, q === 'high' ? (LOW ? 1.6 : 2) : q === 'medium' ? 1.25 : 1);
  renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth, innerHeight);
  const sm = q === 'high' ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== sm) { sun.shadow.mapSize.set(sm, sm); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  renderer.shadowMap.type = q === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  setupComposer();
}
addEventListener('resize', () => { if (composer) { composer.setPixelRatio(pixelRatio); composer.setSize(innerWidth, innerHeight); } if (FX.pts) FX.pts.material.uniforms.uScale.value = renderer.domElement.height * 0.5; });
function updateWorld(dt) {
  simTime += dt; windUniform.value = simTime; skyUniforms.uTime.value = simTime;
  tod = (tod + dt * DAY_SPEED) % 24;
  updateWeather(dt);
  // obstacles for AI drivers
  _obs.length = 0;
  for (const c of cars) _obs.push({ x: c.x, z: c.z, r: c.T.len / 2 - 0.6, ref: c });
  if (player.where === 'out' && player.state !== 'car') _obs.push({ x: player.pos.x, z: player.pos.z, r: 0.5, player: true });
  for (const n of npcs) if (onRoad(n.pos.x, n.pos.z)) _obs.push({ x: n.pos.x, z: n.pos.z, r: 0.5 });
  for (const c of cars) {
    if (c.ai) c.ai.update(dt, _obs);
    else if (!c.player) { c.inThrottle = 0; c.inSteer = 0; c.inHand = true; }
    if (c.closeT > 0) { c.closeT -= dt; if (c.closeT <= 0) { c.doorT = 0; Audio.door(); } }
  }
  const sub = 3, sdt = dt / sub;
  for (let s = 0; s < sub; s++) {
    for (const c of cars) { c.integrate(sdt); carStatic(c); }
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) { const a = cars[i], b = cars[j]; const dx = a.x - b.x, dz = a.z - b.z, rs = (a.T.len + b.T.len) / 2; if (dx * dx + dz * dz > rs * rs) continue; const r = satCarCar(a, b); if (r) carCarResolve(a, b, r); }
  }
  for (const c of cars) {
    if (Math.abs(c.x) > BOUND + 5 || Math.abs(c.z) > BOUND + 5) { c.x = clamp(c.x, -BOUND + 3, BOUND - 3); c.z = clamp(c.z, -BOUND + 3, BOUND - 3); c.vx = c.vz = 0; }
    c.sync(dt); if (player.where === 'out') carEffects(c, dt);
  }
  updatePlayer(dt);
  for (const n of npcs) updateNPC(n, dt, true, world.col);
  if (player.where === 'in') { for (const n of interior.npcs) updateNPC(n, dt, false, interior.col); updateInterior(dt); }
  const people = player.where === 'out' ? (player.state === 'foot' ? [player, ...npcs] : npcs) : [player, ...interior.npcs];
  separatePeople(people.filter(p => p.mode !== 'sit' && p.mode !== 'inside'));
  updateSignals(); updateFountain(dt); FX.update(dt); updateBirds(dt);
  // doors swing open for the player and for people walking in or out
  if (player.where === 'out') for (const d of world.doors) {
    if (d.npcOpen > 0) d.npcOpen -= dt;
    const dx = player.pos.x - d.x, dz = player.pos.z - d.z; if ((Math.abs(dx) > 30 || Math.abs(dz) > 30) && !(d.npcOpen > 0)) { if (d.open > 0.001) { d.open = damp(d.open, 0, 3, dt); d.inner.rotation.y = d.open * 1.25; } continue; }
    const dn = dx * d.nx + dz * d.nz, lat = Math.abs(dx * -d.nz + dz * d.nx), want = ((player.state === 'foot' && dn > 0 && dn < 2.0 && lat < 1.2) || d.npcOpen > 0) ? 0.75 : 0;
    d.open = damp(d.open, want, want ? 4 : 2, dt); d.inner.rotation.y = d.open * 1.25;
  }
  for (const w of waterMeshes) w.material.roughness = 0.04 + Math.sin(simTime * 3) * 0.02;
  if (wpMesh && wpMesh.visible) { wpMesh.userData.gem.rotation.y += dt * 2; wpMesh.userData.gem.position.y = 3.2 + Math.sin(simTime * 2.5) * 0.3; }
}
function syncVisuals(dt) {
  const camPos = camera.position;
  const showPeople = (p, outdoor) => {
    const H = p.H; const d = Math.hypot(p.pos.x - camPos.x, p.pos.z - camPos.z);
    if (outdoor) H.visible = d < 170 && p.mode !== 'inside';
    H.root.position.set(p.pos.x, p.pos.y, p.pos.z); H.root.rotation.set(0, p.facing, 0);
    if (H.visible && d < 85) poseHuman(p, dt, simTime);
  };
  for (const c of cars) {
    const cd = Math.hypot(c.x - camPos.x, c.z - camPos.z), lod = cd < 40 ? 0 : cd < 110 ? 1 : 2;
    c.group.visible = cd < 230;
    if (lod !== c.lod) { c.lod = lod; for (const m of c.lodNear) m.visible = lod === 0; for (const m of c.lodMid) m.visible = lod <= 1; }
    const dp = c.driverP; if (dp && !dp.isPlayer) { dp.H.visible = c.group.visible && player.where === 'out'; if (dp.H.visible && Math.hypot(c.x - camPos.x, c.z - camPos.z) < 70) poseHuman(dp, dt, simTime); }
  }
  for (const n of npcs) showPeople(n, true);
  if (player.where === 'in') for (const n of interior.npcs) showPeople(n, false);
  const P = player, seated = P.inCar || (P.state === 'exiting' && P.exitT < 0.35);
  if (!seated) { P.H.root.position.copy(P.pos); P.H.root.rotation.set(0, P.facing, 0); }
  P.H.visible = true; poseHuman(P, dt, simTime);
  outdoorPool.update(); interiorPool.update();
  // car glow sprites
  const gp = carGlow.geometry.attributes.position.array, gc = carGlow.geometry.attributes.color.array; let k = 0;
  for (const c of cars) {
    if (k > 390) break; const t = c.T, sx = Math.sin(c.h), cx = Math.cos(c.h); const on = c.hasDriver || c.player;
    for (const s of [-1, 1]) {
      const lx = s * (t.wid / 2 - 0.3);
      gp[k * 3] = c.x + lx * cx + (t.front + 0.15) * sx; gp[k * 3 + 1] = c.y + t.headY; gp[k * 3 + 2] = c.z - lx * sx + (t.front + 0.15) * cx;
      const hb = on ? Math.max(night, weather.rain * 0.6) : 0; gc[k * 3] = hb; gc[k * 3 + 1] = hb * 0.95; gc[k * 3 + 2] = hb * 0.8; k++;
      gp[k * 3] = c.x + lx * cx + (t.rear - 0.1) * sx; gp[k * 3 + 1] = c.y + t.tailY; gp[k * 3 + 2] = c.z - lx * sx + (t.rear - 0.1) * cx;
      const tb = on ? (c.braking ? 1 : 0.35 * night) : 0; gc[k * 3] = tb; gc[k * 3 + 1] = tb * 0.08; gc[k * 3 + 2] = tb * 0.05; k++;
    }
  }
  for (; k < 400; k++) { gc[k * 3] = gc[k * 3 + 1] = gc[k * 3 + 2] = 0; }
  carGlow.geometry.attributes.position.needsUpdate = true; carGlow.geometry.attributes.color.needsUpdate = true;
  // sun shadow follows the camera target, snapped to texels
  const tgt = cam.target, dir = sun.userData.dir || sunDir, snap = 92 / sun.shadow.mapSize.x;
  const sx = Math.round(tgt.x / snap) * snap, sz = Math.round(tgt.z / snap) * snap;
  sun.target.position.set(sx, 0, sz); sun.position.set(sx + dir.x * 180, Math.max(dir.y, 0.08) * 180, sz + dir.z * 180);
  sky.position.copy(camPos); stars.position.copy(camPos); mountains.position.set(camPos.x, 0, camPos.z);
  if (bloomPass) bloomPass.strength = 0.16 + night * 0.3 + weather.wet * 0.06;
}
function updateHUD(dt) {
  promptHold -= dt;
  const P = player;
  const inCar = P.state === 'car';
  $('speedo').hidden = !inCar;
  if (inCar) { const kmh = Math.round(Math.abs(P.car.vf) * 3.6); $('spd').textContent = fa(kmh); $('gear').textContent = P.car.vf < -0.5 ? 'R' : P.car.inHand ? 'P' : 'D'; $('health').style.width = P.car.health + '%'; $('health').style.background = P.car.health > 50 ? '#5fd3c3' : P.car.health > 20 ? '#ffb340' : '#ff5b4e'; }
  syncTouchUI();
  let label;
  if (P.where === 'in') label = interior.door.name;
  else label = streetAt(inCar ? P.car.x : P.pos.x, inCar ? P.car.z : P.pos.z);
  if ($('street').textContent !== label) $('street').textContent = label;
  const wp = $('wp');
  if (waypoint) { const d = Math.hypot(waypoint.x - P.pos.x, waypoint.z - P.pos.z); wp.hidden = false; wp.textContent = `${waypoint.name} · ${fa(Math.round(d))} متر`; } else wp.hidden = true;
  if (++mapTick % 2 === 0 && mapBase) drawMap();
  if (inCar) { const c = P.car; const rpm = (Math.abs(c.vf) % 14) / 14 * 0.6 + Math.abs(c.vf) / c.T.vmax * 0.6 + Math.abs(c.inThrottle) * 0.15; Audio.engine(c.health > 0, rpm, Math.max(0, c.inThrottle)); Audio.tyre((c.slip - 1.5) / 5 + (c.inHand && Math.abs(c.vf) > 3 ? 0.4 : 0)); }
}
function render() {
  const sc = player && player.where === 'in' ? interiorScene : scene;
  if (composer) { renderPass.scene = sc; composer.render(); } else renderer.render(sc, camera);
}

let last = performance.now(), demoA = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!player) return;
  if (!started) {
    demoA += dt * 0.05; simTime += dt; windUniform.value = simTime; skyUniforms.uTime.value = simTime;
    updateWorldDemo(dt);
    const r = 60, cx = 0, cz = -10; camera.position.set(cx + Math.sin(demoA) * r, 24, cz + Math.cos(demoA) * r); camera.lookAt(cx, 6, cz);
    cam.target.set(cx, 0, cz); syncVisuals(dt); updateTimeOfDay(); FX.update(dt); updateBirds(dt);
    render(); return;
  }
  readKeys(dt);
  updateWorld(dt);
  updateCamera(dt);
  updateTimeOfDay();
  syncVisuals(dt);
  updateBubbles(dt);
  updateHUD(dt);
  render();
  // adaptive resolution
  frameAcc += dt; frameN++; perfT += dt;
  if (perfT > 2.5) { const avg = frameAcc / frameN; if (avg > 0.036 && pixelRatio > 0.8) { pixelRatio = Math.max(0.8, pixelRatio - 0.15); renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth, innerHeight); if (composer) { composer.setPixelRatio(pixelRatio); composer.setSize(innerWidth, innerHeight); } } frameAcc = 0; frameN = 0; perfT = 0; }
}
function updateWorldDemo(dt) {
  tod = 17.6; _obs.length = 0; for (const c of cars) _obs.push({ x: c.x, z: c.z, r: c.T.len / 2 - 0.6, ref: c });
  for (const c of cars) if (c.ai) c.ai.update(dt, _obs);
  for (let s = 0; s < 2; s++) { for (const c of cars) { c.integrate(dt / 2); carStatic(c); } for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) { const a = cars[i], b = cars[j]; const dx = a.x - b.x, dz = a.z - b.z, rs = (a.T.len + b.T.len) / 2; if (dx * dx + dz * dz > rs * rs) continue; const r = satCarCar(a, b); if (r) carCarResolve(a, b, r); } }
  for (const c of cars) c.sync(dt);
  for (const n of npcs) updateNPC(n, dt, true, world.col);
  updateSignals(); updateFountain(dt); updateWeather(dt);
}

/* ============================================================
   Boot
   ============================================================ */
async function boot(data) {
  try { await Promise.race([Promise.all([document.fonts.load('40px Lalezar'), document.fonts.load('20px Vazirmatn')]), new Promise(r => setTimeout(r, 2500))]); } catch (_) { }
  await new Promise(r => setTimeout(r, 30));
  makeTextures(); makeMaterials(); initGeo(); initHumanGeo(); initCarMats();
  outdoorPool = new HumanPool(scene, LOW ? 40 : 64); interiorPool = new HumanPool(interiorScene, 4);
  buildCity(); buildMapBase();
  FX.init(); Skids.init(); buildRain(); buildBirds();
  setupPlayer(); spawnTraffic(); spawnPeople();
  if (data && typeof data.tod === 'number') tod = data.tod;
  applyWeatherSetting(); applyQuality();
  updateTimeOfDay();
  $('load').textContent = 'شهر آماده است.';
  $('play').disabled = false;
  window.__city = { scene, cars, npcs, player, world, camera, renderer, interior, chat, weather, settings, openChat, sendChat, closeChat, setWaypoint, places,
    step(n, dt = 1 / 30) { for (let i = 0; i < n; i++) { readKeys(dt); updateWorld(dt); updateCamera(dt); updateTimeOfDay(); syncVisuals(dt); updateBubbles(dt); updateHUD(dt); } }, render, get tod() { return tod; }, set tod(v) { tod = v; envTod = -99; } };
}
$('play').addEventListener('click', () => {
  Audio.init(); started = true; $('start').classList.add('gone'); setTimeout(() => $('start').hidden = true, 650);
  $('minimap').hidden = false; $('topbar').hidden = false; if (IS_TOUCH) showTouchUI();
  try { if (IS_TOUCH && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { }); } catch (_) { }
  cam.yaw = Math.PI * 0.82; cam.target.set(player.pos.x, player.pos.y + 1.45, player.pos.z);
  tod = 17.2; envTod = -99;
  banner('شهر آزاد', 'به هر کسی نزدیک شو و با او حرف بزن · ماشین قرمز روبه‌رویت است');
});
window.claude?.hot?.snapshot?.(() => ({ tod }));
$(IS_TOUCH ? 'ctrl-keys' : 'ctrl-touch').hidden = true;
requestAnimationFrame(frame);
Promise.resolve().then(() => window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {})).catch(err => { $('load').textContent = 'خطا در ساختن شهر: ' + err.message; console.error(err); });
