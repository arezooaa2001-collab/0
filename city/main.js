import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
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
const angWrap = a => Math.atan2(Math.sin(a), Math.cos(a));
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
  // polished mall floor: large stone tiles with soft veins
  c = mkCanvas(512); g = c.getContext('2d'); g.fillStyle = '#d8d2c8'; g.fillRect(0, 0, 512, 512);
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) { const v = Math.random() * 12 - 6; g.fillStyle = `rgb(${236 + v},${232 + v},${224 + v})`; g.fillRect(tx * 256 + 2, ty * 256 + 2, 252, 252);
    g.strokeStyle = 'rgba(160,150,140,0.18)'; g.lineWidth = 1.5; for (let k = 0; k < 5; k++) { g.beginPath(); let x = tx * 256 + Math.random() * 256, y = ty * 256 + Math.random() * 256; g.moveTo(x, y); for (let j = 0; j < 8; j++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.3) * 40; g.lineTo(x, y); } g.stroke(); } }
  T.mallTile = toTex(c);
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
  // mall interiors glow softly with their own lighting (emissive scaled by the surface colour)
  const litMat = (o, k) => { const m = stdMat(Object.assign({ emissive: 0xffffff, emissiveIntensity: k }, o)); m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= diffuseColor.rgb;'); }; m.userData.lit = k; mallMats.push(m); return m; };
  M.mallFloor = litMat({ map: T.mallTile, roughness: 0.18, envMapIntensity: 0.55, color: 0xe4ded4 }, 0.1);
  M.mallWall = litMat({ map: T.plaster, roughness: 0.85, color: 0xe8e2d8 }, 0.14);
  M.mallTrim = litMat({ roughness: 0.55 }, 0.13);
  M.mallCeil = litMat({ roughness: 0.6 }, 0.13);
  M.mallMetal = litMat({ roughness: 0.3, metalness: 0.8 }, 0.12);
  M.mallGloss = litMat({ roughness: 0.12, metalness: 0.1 }, 0.14);
  M.mallWood = litMat({ map: T.wood, roughness: 0.55 }, 0.12);
  M.mallFabric = litMat({ roughness: 1 }, 0.14);
  M.neon = litMat({ roughness: 0.3 }, 1.8); M.neon.userData.lit = -1;
  M.mallLamp = stdMat({ emissive: 0xfff6e8, emissiveIntensity: 2.0, roughness: 0.4 });
  M.lampOn2 = stdMat({ emissive: 0xf4f8ff, emissiveIntensity: 2.2, roughness: 0.4 });
  M.clearGlass = stdMat({ transparent: true, opacity: 0.2, roughness: 0.04, metalness: 0.3, depthWrite: false, envMapIntensity: 1.6, side: THREE.DoubleSide });
  M.leaves.onBeforeCompile = M.foliage.onBeforeCompile = sh => {
    sh.uniforms.uTime = windUniform;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float hw = max(position.y - 1.6, 0.0);
      transformed.x += sin(uTime * 1.6 + position.x * 0.35 + position.z * 0.21) * 0.055 * hw;
      transformed.z += cos(uTime * 1.25 + position.z * 0.33 + position.x * 0.1) * 0.045 * hw;`);
  };
}
const NO_CAST = new Set(['busSign', 'asphalt', 'sidewalk', 'grass', 'paint', 'glass', 'glassLit', 'winView', 'woodFloor', 'tileFloor', 'clearGlass', 'mallFloor', 'mallLamp', 'neon', 'lampOn2', 'mallTrim', 'mallWood', 'mallFabric', 'mallMetal', 'mallGloss', 'mallWall']);
const mallMats = [];

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
      const k = (i + 32768) * 65536 + (j + 32768); let a = this.map.get(k); if (!a) { a = []; this.map.set(k, a); } a.push(c);
    }
    return c;
  }
  box(minX, maxX, minZ, maxZ, minY, maxY) { return this.add({ t: 0, minX, maxX, minZ, maxZ, minY, maxY }); }
  circle(x, z, r, minY, maxY) { return this.add({ t: 1, x, z, r, minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r, minY, maxY }); }
  // a box turned by angle a about its centre (axis-aligned when a is a quarter turn)
  obb(x, z, hx, hz, a, minY, maxY) {
    const c = Math.cos(a), s = Math.sin(a);
    if (Math.abs(s) < 1e-4 || Math.abs(c) < 1e-4) { const sw = Math.abs(s) > 0.5, ex = sw ? hz : hx, ez = sw ? hx : hz; return this.box(x - ex, x + ex, z - ez, z + ez, minY, maxY); }
    const ex = Math.abs(c) * hx + Math.abs(s) * hz, ez = Math.abs(s) * hx + Math.abs(c) * hz;
    return this.add({ t: 2, x, z, c, s, hx, hz, minX: x - ex, maxX: x + ex, minZ: z - ez, maxZ: z + ez, minY, maxY });
  }
  query(minX, maxX, minZ, maxZ, out) {
    out.length = 0; const s = ++this.stamp, cs = this.cell;
    for (let i = Math.floor(minX / cs); i <= Math.floor(maxX / cs); i++) for (let j = Math.floor(minZ / cs); j <= Math.floor(maxZ / cs); j++) {
      const a = this.map.get((i + 32768) * 65536 + (j + 32768)); if (!a) continue;
      for (const c of a) { if (c._s === s) continue; c._s = s; if (c.maxX >= minX && c.minX <= maxX && c.maxZ >= minZ && c.minZ <= maxZ) out.push(c); }
    }
    return out;
  }
}

// push a circle (x, z, r) out of a collider's footprint: normal and depth land in _push
const _push = { nx: 0, nz: 0, pen: 0 };
function colPush(c, x, z, r) {
  if (c.t === 1) { const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), R2 = r + c.r; if (d >= R2) return false; if (d > 1e-6) { _push.nx = dx / d; _push.nz = dz / d; } else { _push.nx = 1; _push.nz = 0; } _push.pen = R2 - d; return true; }
  let px = x, pz = z, mnX = c.minX, mxX = c.maxX, mnZ = c.minZ, mxZ = c.maxZ;
  if (c.t === 2) { const dx = x - c.x, dz = z - c.z; px = dx * c.c - dz * c.s; pz = dx * c.s + dz * c.c; mnX = -c.hx; mxX = c.hx; mnZ = -c.hz; mxZ = c.hz; }
  const qx = clamp(px, mnX, mxX), qz = clamp(pz, mnZ, mxZ), dx = px - qx, dz = pz - qz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  let nx, nz, pen;
  if (d2 > 1e-9) { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; pen = r - d; }
  else { const l = px - mnX, rt = mxX - px, bt = pz - mnZ, tp = mxZ - pz, m = Math.min(l, rt, bt, tp); if (m === l) { nx = -1; nz = 0; pen = l + r; } else if (m === rt) { nx = 1; nz = 0; pen = rt + r; } else if (m === bt) { nx = 0; nz = -1; pen = bt + r; } else { nx = 0; nz = 1; pen = tp + r; } }
  if (c.t === 2) { const wx = nx * c.c + nz * c.s, wz = -nx * c.s + nz * c.c; nx = wx; nz = wz; }
  _push.nx = nx; _push.nz = nz; _push.pen = pen; return true;
}
// is (x, z) on the collider's footprint grown by m
function colOver(c, x, z, m) {
  if (c.t === 1) return Math.hypot(x - c.x, z - c.z) < c.r + m;
  if (c.t === 2) { const dx = x - c.x, dz = z - c.z, lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c; return Math.abs(lx) < c.hx + m && Math.abs(lz) < c.hz + m; }
  return x > c.minX - m && x < c.maxX + m && z > c.minZ - m && z < c.maxZ + m;
}

/* ============================================================
   Build helpers (local frames rotated in 90° steps)
   ============================================================ */
let BT, CL;           // current batch and collider set
const world = { col: new Colliders(), benches: [], doors: [], signMats: [], foot: [], gates: [], glow: [], pools: [], parks: [], parking: [], fountains: [], portals: [], uses: [], newPlaces: [], lamps: [], busStops: [] };
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
  world.glow.push([hx, CURB + 6.15, hz, 1.0, 0.86, 0.62, 3.2]); world.pools.push([hx, hz, 5.5]); world.lamps.push({ x, z });
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
  const F = mkFrame(x, z, a); world.busStops.push({ x, z, a });
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
  const [x, z] = fw(F, lx, lz);
  { const [px, pz] = fw(F, lx, lz - 0.005); world.portals.push({ x: px, z: pz, y: fl, rx: F.c, rz: -F.s, nx: F.s, nz: F.c, kind: kind === 'shop' ? 1 : kind === 'apt' ? 2 : 0, seed: (Math.abs(Math.round(px * 131 + pz * 977)) % 997) / 997 }); }
  world.doors.push({ x, z, nx: F.s, nz: F.c, y: fl, inner, open: 0, want: 0, closeT: 0, kind, name, sub, seed: (Math.abs(Math.round(x * 131 + z * 977)) + 7) | 0, pivot });
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

/* every doorway shows a believable lit hallway behind it (interior mapping: a ray-box test per pixel),
   so an opened door looks into a real room instead of a black hole */
let portalMat = null;
function buildPortals() {
  const L = world.portals, n = L.length; if (!n) return;
  const pos = new Float32Array(n * 18), loc = new Float32Array(n * 12), rgt = new Float32Array(n * 18), inw = new Float32Array(n * 18), inf = new Float32Array(n * 12);
  L.forEach((d, i) => {
    const corners = [[-0.51, 0], [0.51, 0], [0.51, 2.26], [-0.51, 0], [0.51, 2.26], [-0.51, 2.26]];
    corners.forEach(([u, v], k) => {
      const o = i * 6 + k; pos[o * 3] = d.x + d.rx * u; pos[o * 3 + 1] = d.y + v; pos[o * 3 + 2] = d.z + d.rz * u;
      loc[o * 2] = u; loc[o * 2 + 1] = v; rgt[o * 3] = d.rx; rgt[o * 3 + 2] = d.rz; inw[o * 3] = -d.nx; inw[o * 3 + 2] = -d.nz; inf[o * 2] = d.seed; inf[o * 2 + 1] = d.kind;
    });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aLocal', new THREE.BufferAttribute(loc, 2));
  g.setAttribute('aRight', new THREE.BufferAttribute(rgt, 3)); g.setAttribute('aIn', new THREE.BufferAttribute(inw, 3)); g.setAttribute('aInfo', new THREE.BufferAttribute(inf, 2));
  g.computeBoundingSphere();
  portalMat = new THREE.ShaderMaterial({
    uniforms: { uCam: { value: new V3() }, uLamp: { value: 1 }, uDay: { value: 1 } },
    vertexShader: `attribute vec2 aLocal; attribute vec3 aRight; attribute vec3 aIn; attribute vec2 aInfo;
      varying vec2 vLocal; varying vec3 vWorld; varying vec3 vRight; varying vec3 vIn; varying vec2 vInfo;
      void main() { vLocal = aLocal; vRight = aRight; vIn = aIn; vInfo = aInfo; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uCam; uniform float uLamp; uniform float uDay;
      varying vec2 vLocal; varying vec3 vWorld; varying vec3 vRight; varying vec3 vIn; varying vec2 vInfo;
      float h1(float n) { return fract(sin(n * 127.1 + 3.7) * 43758.5453); }
      void main() {
        vec3 V = normalize(vWorld - uCam);
        vec3 d = vec3(dot(V, vRight), V.y, max(dot(V, vIn), 0.02));
        vec3 o = vec3(vLocal, 0.0);
        const float HW = 1.35; const float H = 2.75; const float D = 4.6;
        float tx = d.x > 0.0 ? (HW - o.x) / max(d.x, 1e-4) : (-HW - o.x) / min(d.x, -1e-4);
        float ty = d.y > 0.0 ? (H - o.y) / max(d.y, 1e-4) : (-o.y) / min(d.y, -1e-4);
        float tz = D / d.z;
        float t = min(tx, min(ty, tz));
        vec3 p = o + d * t;
        float s = vInfo.x * 91.0, kind = vInfo.y;
        vec3 wall = mix(vec3(0.88, 0.82, 0.72), vec3(0.78, 0.85, 0.83), h1(s));
        if (kind > 1.5) wall = vec3(0.82, 0.8, 0.76);
        vec3 col = wall;
        if (t == ty && d.y < 0.0) {
          if (kind > 0.5) { vec2 g = floor(p.xz * 1.7); col = mix(vec3(0.86, 0.84, 0.8), vec3(0.72, 0.7, 0.66), mod(g.x + g.y, 2.0)); }
          else {
            float row = floor(p.x * 5.0), j = h1(row + s);
            col = mix(vec3(0.45, 0.29, 0.16), vec3(0.6, 0.41, 0.24), j) * (0.82 + 0.18 * step(0.04, fract(p.x * 5.0))) * (0.9 + 0.1 * step(0.02, fract(p.z * 0.6 + j)));
            if (abs(p.x) < 0.8 && p.z > 0.8 && p.z < 3.5) { vec3 rug = mix(vec3(0.58, 0.14, 0.12), vec3(0.16, 0.22, 0.42), h1(s + 3.0)); float b = step(0.09, min(0.8 - abs(p.x), min(p.z - 0.8, 3.5 - p.z))); col = mix(vec3(0.86, 0.74, 0.48), rug, b); }
          }
        } else if (t == ty) {
          col = vec3(0.94, 0.93, 0.9) * 0.85; float l = length(vec2(p.x, p.z - 2.0)); col += vec3(1.8, 1.5, 1.1) * (1.0 - smoothstep(0.15, 0.2, l)) * uLamp;
        } else if (t == tx) {
          if (kind > 0.5 && kind < 1.5 && p.y > 0.2 && p.y < 2.15 && p.z > 0.4 && p.z < 4.4) {
            float r = floor(p.y * 2.4), slot = floor(p.z * 7.0) + r * 13.0 + sign(p.x) * 7.0;
            col = fract(p.y * 2.4) < 0.1 ? vec3(0.78) : vec3(h1(slot), h1(slot + 1.3), h1(slot + 2.7)) * 0.75 + 0.12;
          } else if (p.x > 0.0 && p.y > 1.2 && p.y < 2.0 && abs(p.z - 2.3) < 0.48) {
            vec2 q = vec2(p.z - 2.3, p.y - 1.6);
            col = (abs(q.x) > 0.42 || abs(q.y) > 0.34) ? vec3(0.3, 0.2, 0.1) : mix(vec3(0.3, 0.5, 0.72), vec3(0.88, 0.66, 0.35), smoothstep(-0.25, 0.25, q.y + 0.12 * sin(q.x * 9.0 + s)));
          } else if (p.x < 0.0 && p.z > 1.1 && p.z < 2.0 && p.y < 2.08) col = vec3(0.46, 0.3, 0.18) * (0.9 + 0.1 * step(0.05, abs(p.z - 1.55)));
          if (p.y < 0.12) col = vec3(0.95);
        } else {
          if (abs(p.x) < 0.5 && p.y < 2.1) col = wall * 0.25;
          if (kind > 0.5 && kind < 1.5 && abs(p.x) > 0.62 && p.y > 0.3 && p.y < 2.05) col = vec3(0.85, 0.93, 1.0) * (0.55 + 0.45 * h1(floor(p.x * 6.0) + floor(p.y * 2.3) * 11.0));
          if (kind > 1.5 && abs(p.x) < 0.5 && p.y < 2.1) col = vec3(0.6, 0.58, 0.55) * (0.6 + 0.4 * step(0.5, fract(p.y * 5.0)));
          if (p.y < 0.12 && abs(p.x) > 0.5) col = vec3(0.95);
        }
        col = pow(col, vec3(2.2));
        vec3 L = vec3(0.0, 2.6, 2.0) - p;
        float li = uLamp * 2.1 / (1.0 + dot(L, L) * 0.3) + 0.2 + uDay * 0.45 * (1.0 - p.z / D);
        li *= 0.7 + 0.3 * smoothstep(0.0, 0.35, min(min(p.y, H - p.y), HW - abs(p.x)));
        gl_FragColor = vec4(col * li, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const m = new THREE.Mesh(g, portalMat); m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m);
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

/* the city garage: two open bays with car lifts, tools and mechanics */
const garage = { bays: [], job: null, mechs: [] };
function buildGarage(cx, cz) {
  const F = mkFrame(cx, cz, Math.PI / 2); // local +z faces the street (world +x)
  garage.F = F; garage.cx = cx; garage.cz = cz;
  const wallC = 0xe4dccb, H = 6.2, z0 = 2.5, z1 = 17.5;
  fBox(F, 'sidewalk', 0, CURB + 0.006, 13.5, 51, 0.012, 24, 0x8d8a85, { ts: 4 });
  for (let k = 0; k < 9; k++) { const g = new THREE.CircleGeometry(rr(0.3, 0.9), 16); g.rotateX(-Math.PI / 2); const [x, z] = fw(F, rr(-11, 11), rr(4, 22)); BT.add('paint', g, x, CURB + 0.02, z, 0, 0x2a2826); }
  fBox(F, 'plaster', 0, CURB + H / 2, z0, 24.6, H, 0.3, wallC, { ts: 3, col: true, minY: 0, maxY: 7 });
  for (const sx of [-1, 1]) fBox(F, 'plaster', sx * 12.15, CURB + H / 2, (z0 + z1) / 2, 0.3, H, z1 - z0, wallC, { ts: 3, col: true, minY: 0, maxY: 7 });
  for (const [x, w] of [[-10.525, 3.55], [0, 5.5], [10.525, 3.55]]) fBox(F, 'plaster', x, CURB + H / 2, z1, w, H, 0.3, wallC, { ts: 3, col: true, minY: 0, maxY: 7 });
  for (const bx of [-5.75, 5.75]) {
    fBox(F, 'plaster', bx, CURB + 4.6 + (H - 4.6) / 2, z1, 6.1, H - 4.6, 0.3, wallC, { ts: 3 });
    for (const sx of [-3.05, 3.05]) for (let k = 0; k < 6; k++) fBox(F, 'paint', bx + sx, CURB + 0.38 + k * 0.76, z1 + 0.16, 0.12, 0.38, 0.02, k % 2 ? 0x111111 : 0xf2c12e);
  }
  fBox(F, 'trim', 0, CURB + 0.6, z0 + 0.16, 24.3, 1.2, 0.04, 0x5a6a7a);
  fBox(F, 'roof', 0, CURB + H + 0.15, (z0 + z1) / 2, 25.2, 0.3, 15.6, 0x4b5258, { ts: 3 });
  makeSign(F, 0, CURB + 5.35, z1 + 0.2, 'تعمیرگاه مرکزی شهر', 7.5, '#c2561a', '#fff6e6');
  // two bays with lifts
  for (const bx of [-5.75, 5.75]) {
    for (const sx of [-1.8, 1.8]) { fBox(F, 'metal', bx + sx, CURB + 1.7, 10, 0.34, 3.4, 0.34, 0x1f4f9a); const [x, z] = fw(F, bx + sx, 10); CL.circle(x, z, 0.22, 0, 3.6); }
    fBox(F, 'metal', bx, CURB + 3.5, 10, 4, 0.2, 0.3, 0x1f4f9a);
    const arms = new THREE.Group(); const am = new THREE.MeshStandardMaterial({ color: 0x2a5aa8, roughness: 0.5, metalness: 0.4 });
    for (const sx of [-1, 1]) for (const sz of [-1.1, 1.1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.14), am); m.position.set(sx * 1.05, 0, sz); m.rotation.y = sx * sz * 0.25; m.castShadow = true; arms.add(m); }
    const [ax, az] = fw(F, bx, 10); arms.position.set(ax, CURB + 0.2, az); arms.rotation.y = F.a; scene.add(arms);
    const [hx, hz] = fw(F, bx, 10); garage.bays.push({ x: hx, z: hz, arms, lift: 0, car: null, h: F.a + Math.PI, lx: bx });
    fBox(F, 'lampOn', bx, CURB + H - 0.3, 10, 0.3, 0.06, 4.5, 0xffffff);
  }
  // workshop details along the walls
  const cab = (lx, lz, col) => { fBox(F, 'metal', lx, CURB + 0.55, lz, 1.2, 1.1, 0.55, col, { col: true }); for (let k = 0; k < 5; k++) fBox(F, 'metal', lx, CURB + 0.2 + k * 0.2, lz + 0.28, 1.1, 0.02, 0.01, 0x222222); };
  cab(-10, 3.2, 0xb3161b); cab(-8.6, 3.2, 0xb3161b); cab(9.6, 3.2, 0x1f4f9a);
  fBox(F, 'wood', 0, CURB + 0.9, 3.3, 3.2, 0.08, 0.9, 0x6b4a2a, { col: true, minY: 0, maxY: CURB + 0.95 }); for (const sx of [-1.5, 1.5]) fBox(F, 'metal', sx, CURB + 0.45, 3.3, 0.08, 0.9, 0.8, 0x2a2d31);
  fBox(F, 'metal', 0.9, CURB + 1.05, 3.4, 0.25, 0.22, 0.2, 0x3a3d42);
  fBox(F, 'wood', 0, CURB + 2.0, 2.68, 3.4, 1.4, 0.04, 0xc9b28a);
  for (let k = 0; k < 14; k++) fBox(F, 'metal', -1.5 + k * 0.23, CURB + rr(1.6, 2.4), 2.72, 0.05, rr(0.2, 0.45), 0.03, pick([0x9aa0a6, 0xb3161b, 0x2a2d31, 0xd9a03a]));
  for (const [lx, lz] of [[11, 5], [11, 7.5], [-11, 15.5]]) { for (let k = 0; k < 4; k++) fGeo(F, 'metal', new THREE.TorusGeometry(0.3, 0.12, 8, 16), lx, CURB + 0.12 + k * 0.24, lz, 0x151515, 0, Math.PI / 2); const [x, z] = fw(F, lx, lz); CL.circle(x, z, 0.45, 0, CURB + 1); }
  for (const [lx, lz, c] of [[-11.2, 9, 0x1f4f9a], [-11.2, 10, 0xb3161b], [-10.4, 9.5, 0x2f6b3a], [11.2, 13, 0x1f4f9a]]) { const [x, z] = fw(F, lx, lz); BT.add('metal', GEO.cyl16, x, CURB + 0.45, z, 0, c, 0, 0, 0.3, 0.9, 0.3); CL.circle(x, z, 0.32, 0, CURB + 0.9); }
  { const [x, z] = fw(F, 9.5, 15.8); BT.add('metal', GEO.cyl16, x, CURB + 0.55, z, 0, 0xc2561a, Math.PI / 2, 0, 0.35, 1.3, 0.35); CL.circle(x, z, 0.7, 0, CURB + 1.0); }
  world.foot.push([cx + z0 - 0.2, cz - 12.3, cx + z1 + 0.2, cz + 12.3, '#c2561a']);
  garage.mechSpots = [fw(F, -1.2, 4.4), fw(F, 1.2, 4.4)];
  garage.depot = { x: fw(F, 18.5, 12)[0], z: fw(F, 18.5, 12)[1], h: F.a };
  garage.road = { x: roadX(1) - LANE, z: 0 };
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
  const gg = new THREE.PlaneGeometry(3400, 3400, 80, 80); gg.rotateX(-Math.PI / 2); gg.translate(0, -0.04, 0);
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
    const type = (bi === 0 && bj === 2) ? 'garage' : (bi === 2 && bj === 2) ? 'park' : (bi >= 1 && bi <= 3 && bj >= 1 && bj <= 3) ? 'commercial' : 'residential';
    const place = NEW_PLACES[bi + ',' + bj]; if (place) world.newPlaces.push([place, cx, cz]);
    if (type === 'garage') buildGarage(cx, cz);
    if (type !== 'commercial' && type !== 'garage' && !place) { BT.add('grass', quadUp(cx - LOT, cz - LOT, cx + LOT, cz + LOT, CURB + 0.004, 7)); (world.grassAreas || (world.grassAreas = [])).push([cx, cz, type]); }
    if (type === 'park') buildPark(cx, cz);
    else if (type === 'residential') {
      if (place) dryRun(() => { for (const qx of [-1, 1]) for (const qz of [-1, 1]) buildHouse(cx, cz, qx, qz); });
      else {
      for (const qx of [-1, 1]) for (const qz of [-1, 1]) buildHouse(cx, cz, qx, qz);
      BT.add('hedge', boxGeo(0.9, 1.3, 2 * LOT - 1, 2), cx, CURB + 0.65, cz, 0, 0x8fbc6c); CL.box(cx - 0.45, cx + 0.45, cz - LOT, cz + LOT, 0, CURB + 1.3);
      BT.add('hedge', boxGeo(2 * LOT - 1, 1.3, 0.9, 2), cx, CURB + 0.65, cz, 0, 0x8fbc6c); CL.box(cx - LOT, cx + LOT, cz - 0.45, cz + 0.45, 0, CURB + 1.3);
      }
    } else if (type === 'commercial') {
      const build = () => { for (const qx of [-1, 1]) for (const qz of [-1, 1]) buildApartment(cx, cz, qx, qz); tree(cx + 2, cz - 2, 1.2); bench(cx - 2.5, cz + 2.5, Math.PI / 4); bin(cx + 3, cz + 3); };
      if (place) dryRun(build); else build();
    }
    // street furniture on the four sidewalks
    for (let s = 0; s < 4; s++) {
      const [ox, oz] = DIRS[s];           // outward normal toward road
      const tx = -oz, tz = ox;            // tangent
      const edge = B / 2 - RH;            // curb distance from block centre
      const drive = type === 'garage' && s === 1; // keep the garage driveway clear
      for (const t of drive ? [-20, 20] : [-20, 0, 20]) { const x = cx + ox * (edge - 0.6) + tx * t, z = cz + oz * (edge - 0.6) + tz * t; streetLamp(x, z, ox, oz); }
      for (const t of drive ? [] : [-10, 10]) {
        const x = cx + ox * (edge - 0.65) + tx * t, z = cz + oz * (edge - 0.65) + tz * t;
        if (world.gates.some(g => Math.hypot(g[0] - x, g[1] - z) < 6)) continue;
        maybeDry(x, z, () => { BT.add('trim', boxGeo(1.4, 0.02, 1.4), x, CURB + 0.006, z, 0, 0x3a2e24); tree(x, z, rr(0.85, 1.1)); });
      }
      if (type === 'commercial') { for (const t of [-15, 15]) { const x = cx + ox * (edge - 1.0) + tx * t, z = cz + oz * (edge - 1.0) + tz * t; bench(x, z, Math.atan2(-ox, -oz)); } const bx = cx + ox * (edge - 0.7) + tx * 5, bz = cz + oz * (edge - 0.7) + tz * 5; bin(bx, bz); }
      if (R() < 0.5 && !drive) { const hx = cx + ox * (edge - 0.5) + tx * -4, hz = cz + oz * (edge - 0.5) + tz * -4; maybeDry(hx, hz, () => hydrant(hx, hz)); }
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
    { const s1 = rr(1, 1.6), kind = R() < 0.4 ? 'pine' : 'round'; maybeDry(x, z, () => tree(x, z, s1, kind, true, 0)); } k++;
  }
  for (const s of [-1, 1]) {
    if (s < 0) { for (const sx of [-1, 1]) { const a = 8, b = BOUND + 0.6; BT.add('trim', boxGeo(b - a, 1.4, 0.6, 3), sx * (a + b) / 2, 0.7, s * BOUND, 0, 0x8a8378); CL.box(sx > 0 ? a : -b, sx > 0 ? b : -a, s * BOUND - 0.3, s * BOUND + 0.3, 0, 1.4); BT.add('trim', boxGeo(1.2, 3.2, 1.2, 3), sx * a, 1.6, s * BOUND, 0, 0x6a6358); } }
    else { BT.add('trim', boxGeo(2 * BOUND + 1.2, 1.4, 0.6, 3), 0, 0.7, s * BOUND, 0, 0x8a8378); CL.box(-BOUND - 1, BOUND + 1, s * BOUND - 0.3, s * BOUND + 0.3, 0, 1.4); }
    BT.add('trim', boxGeo(0.6, 1.4, 2 * BOUND + 1.2, 3), s * BOUND, 0.7, 0, 0, 0x8a8378); CL.box(s * BOUND - 0.3, s * BOUND + 0.3, -BOUND - 1, BOUND + 1, 0, 1.4);
  }
  k = 0;
  while (k < (LOW ? 70 : 150)) {
    const x = rr(-BOUND - 45, BOUND + 45), z = rr(-BOUND - 45, BOUND + 45);
    if (Math.abs(x) < BOUND + 3 && Math.abs(z) < BOUND + 3) continue;
    { const s1 = rr(1.2, 2.0), kind = R() < 0.65 ? 'pine' : 'round'; maybeDry(x, z, () => tree(x, z, s1, kind, false, 0)); } k++;
  }
  // the new places use their own random stream so the rest of the city stays exactly as it was
  { const keep = R; R = makeRng(4242);
    buildRbExterior();
    for (const [pl, cx, cz] of world.newPlaces) ({ mall: buildMall, gas: buildGasStation, mosque: buildMosque, school: buildSchool, hospital: buildHospital })[pl](cx, cz);
    R = keep; }
  BT.build(scene);
  buildGrass();
  buildGlow(); buildPools(); buildMountains(); buildFountainFX(); buildPortals(); buildCables();
  world.parking = world.parking.filter(p => !world.busStops.some(s => Math.hypot(s.x - p.x, s.z - p.z) < 18)); // keep bus bays free
}
const NEW_PLACES = { '3,2': 'mall', '4,2': 'gas', '2,4': 'mosque', '2,0': 'school', '4,0': 'hospital' };
const CLEAR = [[119, -17.5, 127, -3.2, 152], [119, 3.2, 127, 17.5, 152], [-14, -(BOUND + 62), 14, -(HALF + RH)], [-44, -(BOUND + 64), 44, -(BOUND + 34)]]; // petrol station driveways, road to the rainbow building
function maybeDry(x, z, fn) { if (CLEAR.some(c => x > c[0] && x < c[2] && z > c[1] && z < c[3])) dryRun(fn); else fn(); }
// run a builder without keeping anything it makes (but its random draws and door slots stay)
function dryRun(fn) {
  const bt = BT, cl = CL, lens = {}; for (const k in world) if (Array.isArray(world[k])) lens[k] = world[k].length;
  const nScene = scene.children.length, nDoors = world.doors.length;
  BT = new Batch(150); CL = new Colliders();
  fn();
  for (const d of world.doors.slice(nDoors)) { d.dead = true; scene.remove(d.pivot); }
  for (const k in lens) if (k !== 'doors' && k !== 'gates') world[k].length = lens[k]; // gates steer later tree placement, so they stay
  for (const o of scene.children.slice(nScene)) scene.remove(o);
  BT.groups.clear(); BT = bt; CL = cl;
}

/* instanced grass tufts with wind, one mesh per block for culling */
let grassMat = null;
function buildGrass() {
  const per = LOW ? 900 : 2600;
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
    mesh.count = k; mesh.receiveShadow = true; mesh.castShadow = false; mesh.computeBoundingSphere(); scene.add(mesh); (world.grassMeshes || (world.grassMeshes = [])).push(mesh);
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
let envTod = -99, envKey = -1, bakingEnv = false; const envCache = [];
function bakeEnvironments() {
  const t0 = tod, c0 = weather.cloud; bakingEnv = true;
  [[2, 0.22], [2, 0.95], [18.4, 0.22], [18.4, 0.95], [12, 0.22], [12, 0.95]].forEach(([t, c], k) => { tod = t; weather.cloud = c; updateTimeOfDay(); envCache[k] = pmrem.fromScene(envScene, 0, 0.1, 1000); });
  tod = t0; weather.cloud = c0; bakingEnv = false; envKey = -1;
}
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
  { const cp = camera.position, inM = inMall(cp.x, cp.z, -0.3) && cp.y < mall.yR - 0.3;
    if (inM) hemi.intensity = Math.max(hemi.intensity, 0.85);
    for (const m of mallMats) m.emissiveIntensity = m.userData.lit < 0 ? 1.8 : m.userData.lit * (inM ? 1.0 : 0.7) * (1 + night * 0.4);
    M.lampOn2.emissiveIntensity = 1.2 + night * 1.6; }
  stars.material.opacity = smooth(0.4, 0.95, night) * (1 - cl);
  M.glassLit.emissiveIntensity = night * 0.85;
  M.emissive.emissiveIntensity = night * 2.4 + 0.02;
  for (const m of world.signMats) m.emissiveIntensity = 0.05 + night * 0.9;
  if (glowPts) { glowPts.material.opacity = night * 0.5; poolMesh.material.opacity = night * 0.5; carGlow.material.opacity = 0.1 + night * 0.5; }
  if (mountains) for (const m of mountains.userData.mats) m.color.copy(_c2).lerp(_c1, 0.25).lerp(C(0x56677a), 0.45).multiplyScalar(m.userData.shade * (0.5 + 0.55 * dayF) + 0.25);
  M.winView.color.setRGB(0.75, 0.88, 1).multiplyScalar(0.12 + 0.95 * dayF).lerp(_c2, 0.25);
  if (CarMats.head) CarMats.head.emissiveIntensity = 0.3 + night * 2.2;
  if (!bakingEnv) {
    // reflections come from a few pre-baked skies, so the frame never stalls rebuilding them
    const band = dayF < 0.25 ? 0 : golden > 0.35 ? 1 : 2, key = band * 2 + (weather.cloud > 0.6 ? 1 : 0);
    if (key !== envKey && envCache[key]) { envKey = key; scene.environment = envCache[key].texture; interiorScene.environment = envCache[key].texture; }
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
  Audio.rain(weather.rain * (player && player.where !== 'out' ? (player.where === 'in' ? 0.3 : 0) : 1));
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
    this.pts.material.uniforms.uLight.value = 0.35 + 0.65 * dayF; if (rb.extLit) { rbUniforms.uTime.value = simTime; rb.extLit.value = 0.16 + 0.84 * dayF; } this.pts.material.uniforms.uScale.value = renderer.domElement.height * 0.5;
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
/* soft contact shadows under every car and person (grounds them even with shadows off) */
let blobSh = null;
function buildBlobs() {
  const c = mkCanvas(64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c), geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
  blobSh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 160);
  blobSh.frustumCulled = false; blobSh.renderOrder = 1; scene.add(blobSh);
}
const _blm = new THREE.Matrix4(), _blq = new THREE.Quaternion(), _blp = new V3(), _bls = new V3(), _bly = new V3(0, 1, 0);
function updateBlobs() {
  if (!blobSh) return; let k = 0; const cp = camera.position, max = 160;
  blobSh.material.opacity = qLevel === 0 ? 0.62 : 0.42;
  for (const c of cars) { if (k >= max || !c.group.visible || c.carriedBy) continue; if (Math.abs(c.x - cp.x) + Math.abs(c.z - cp.z) > 120) continue; _blq.setFromAxisAngle(_bly, c.h); _blm.compose(_blp.set(c.x, c.y + 0.03, c.z), _blq, _bls.set(c.T.wid * 1.25, 1, c.T.len * 1.1)); blobSh.setMatrixAt(k++, _blm); }
  for (const n of allPeople()) { if (k >= max || !n.H.visible || n.inCar) continue; if (Math.abs(n.pos.x - cp.x) + Math.abs(n.pos.z - cp.z) > 60) continue; const s = 0.85 * (n.look.h || 1) * (1 - n.anim.knock * 0) + n.anim.knock * 0.9; _blm.compose(_blp.set(n.pos.x, n.pos.y + 0.02, n.pos.z), _blq.identity(), _bls.set(s, 1, s + n.anim.knock * 1.2)); blobSh.setMatrixAt(k++, _blm); }
  if (player.where === 'out' && !player.inCar) { _blm.compose(_blp.set(player.pos.x, groundH(player.pos.x, player.pos.z) + 0.02, player.pos.z), _blq.identity(), _bls.set(0.85, 1, 0.85)); blobSh.setMatrixAt(k++, _blm); }
  blobSh.count = k; blobSh.instanceMatrix.needsUpdate = true;
}
/* pigeons around the fountain: they peck, hop, and burst into flight when you get close */
let pigeons = null;
function buildPigeons() {
  const f = world.fountains[0]; if (!f) return;
  const body = new THREE.SphereGeometry(0.11, 10, 8); body.scale(0.85, 0.8, 1.4);
  const geo = mergeGeos([[body, 0, 0.13, 0], [new THREE.SphereGeometry(0.055, 8, 6), 0, 0.24, 0.13], [new THREE.BoxGeometry(0.1, 0.02, 0.14), 0, 0.15, -0.17], [new THREE.ConeGeometry(0.015, 0.04, 6), 0, 0.23, 0.19, Math.PI / 2]]);
  const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.8 }), 16);
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.08, 0.28, 0.01, -0.03, 0, 0, -0.1], 3)); wg.computeVertexNormals();
  const w = new THREE.InstancedMesh(wg, new THREE.MeshStandardMaterial({ color: 0x6f7480, side: THREE.DoubleSide, roughness: 0.9 }), 32);
  m.castShadow = true; m.frustumCulled = w.frustumCulled = false; scene.add(m, w);
  const list = []; for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28, r = 4.5 + Math.random() * 3; list.push({ x: f.x + Math.cos(a) * r, z: f.z + Math.sin(a) * r, y: CURB, h: Math.random() * 6.28, mode: 'walk', t: Math.random() * 3, vx: 0, vy: 0, vz: 0, ph: Math.random() * 6 }); }
  pigeons = { m, w, list, f };
}
function updatePigeons(dt) {
  if (!pigeons || player.where !== 'out') return; const { m, w, list, f } = pigeons, cp = camera.position;
  if (Math.abs(f.x - cp.x) + Math.abs(f.z - cp.z) > 120) return;
  const threat = player.state === 'foot' ? player.pos : null;
  list.forEach((p, i) => {
    p.t -= dt; p.ph += dt;
    if (p.mode === 'walk') {
      const pd = threat ? Math.hypot(threat.x - p.x, threat.z - p.z) : 99;
      if (p.scare && p.t < 0.06 || pd < 1.8 || pd < 3.4 && Math.hypot(player.vel.x, player.vel.z) > 0.5 || cars.some(c => Math.abs(c.vf) > 3 && Math.hypot(c.x - p.x, c.z - p.z) < 6)) {
        p.scare = false; p.mode = 'fly'; p.t = 3 + Math.random() * 3; p.cruise = 2.5 + Math.random() * 3; p.land = null; const a = Math.atan2(p.x - (threat ? threat.x : f.x), p.z - (threat ? threat.z : f.z)) + (Math.random() - 0.5); p.vx = Math.sin(a) * 4; p.vz = Math.cos(a) * 4; p.vy = 3.5 + Math.random(); p.h = a;
        for (const o of list) if (o.mode === 'walk' && o !== p && Math.hypot(o.x - p.x, o.z - p.z) < 3.5) o.t = Math.min(o.t, 0.05 + Math.random() * 0.4), o.scare = true;
        if (i % 4 === 0) Audio.burst(0.05 * Audio.vol(p.x, p.z), 900, 0.35, 'lowpass', 1);
      } else if (p.t < 0) { p.t = 0.6 + Math.random() * 2.5; p.h += (Math.random() - 0.5) * 2; p.hop = 0.35; }
      if (p.hop > 0) { p.hop -= dt; p.x += Math.sin(p.h) * 0.6 * dt; p.z += Math.cos(p.h) * 0.6 * dt; }
      const r = Math.hypot(p.x - f.x, p.z - f.z); if (r < 3.8 || r > 8.5) p.h = Math.atan2(f.x - p.x, f.z - p.z) + (r < 3.8 ? Math.PI : 0);
      p.y = CURB;
    } else {
      // climb to a low cruise, swing round the plaza, then glide down to a fresh spot
      if (p.t > 1.6) { p.vy = damp(p.vy, (p.cruise - p.y) * 1.6, 3, dt); const a = Math.atan2(p.x - f.x, p.z - f.z) + 0.9, tx = f.x + Math.sin(a) * 9, tz = f.z + Math.cos(a) * 9; p.vx = damp(p.vx, (tx - p.x) * 0.9, 1.5, dt); p.vz = damp(p.vz, (tz - p.z) * 0.9, 1.5, dt); }
      else { if (!p.land) { const a = Math.random() * 6.28, r = 4.5 + Math.random() * 3; p.land = [f.x + Math.cos(a) * r, f.z + Math.sin(a) * r]; } p.vx = damp(p.vx, (p.land[0] - p.x) * 1.2, 3, dt); p.vz = damp(p.vz, (p.land[1] - p.z) * 1.2, 3, dt); p.vy = damp(p.vy, Math.max(-3, (CURB - p.y) * 1.8), 4, dt); }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (Math.hypot(p.vx, p.vz) > 0.3) p.h = Math.atan2(p.vx, p.vz);
      if (p.t < 0 && p.y <= CURB + 0.08) { p.y = CURB; p.mode = 'walk'; p.t = 1 + Math.random(); p.land = null; }
      else if (p.t < -4) { p.y = CURB; p.mode = 'walk'; p.land = null; }
      p.y = Math.max(p.y, CURB);
    }
    const peck = p.mode === 'walk' && !(p.hop > 0) ? Math.max(0, Math.sin(p.ph * 5)) * 0.5 : 0;
    _be.set(peck, p.h, 0, 'YXZ'); _bq.setFromEuler(_be); _bm.compose(_bp.set(p.x, p.y, p.z), _bq, _bs.set(1, 1, 1)); m.setMatrixAt(i, _bm);
    const fl = p.mode === 'fly' ? Math.sin(p.ph * 26) * 0.9 : 0, sc = p.mode === 'fly' ? 1 : 0;
    for (const sd of [1, -1]) { _be.set(0, p.h, sd * fl, 'YXZ'); _bq.setFromEuler(_be); _bm.compose(_bp.set(p.x, p.y + 0.15, p.z), _bq, _bs.set(sd * sc, sc, sc)); w.setMatrixAt(i * 2 + (sd > 0 ? 0 : 1), _bm); }
  });
  m.instanceMatrix.needsUpdate = w.instanceMatrix.needsUpdate = true;
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
const _hpm = new THREE.Matrix4();
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
  setOffset(x, z) { this.off = this.off || { x: 0, z: 0 }; this.off.x = x; this.off.z = z; for (const m of Object.values(this.meshes)) { m.position.set(x, 0, z); m.updateMatrix(); m.updateMatrixWorld(); } }
  update() {
    const off = this.off;
    for (const p of this.people) {
      const H = p.H;
      if (!H.visible) { if (H.shown) { for (const e of H.slots) this.meshes[e.part].setMatrixAt(e.idx, _zeroM); H.shown = false; } continue; }
      H.root.updateMatrixWorld(true); H.shown = true;
      for (const e of H.slots) { const hide = (e.umb && !H.umb.visible) || (e.head && H.hideHead) || (e.trunk && H.hideTrunk); if (hide || !off) { this.meshes[e.part].setMatrixAt(e.idx, hide ? _zeroM : e.obj.matrixWorld); continue; } _hpm.copy(e.obj.matrixWorld); _hpm.elements[12] -= off.x; _hpm.elements[14] -= off.z; this.meshes[e.part].setMatrixAt(e.idx, _hpm); }
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
  for (const e of slots) { if (umb && (e.obj.parent === umb)) e.umb = true; if (e.obj.parent === head || e.part === 'neck') e.head = true; if (['upper', 'torso', 'coat', 'drape', 'scarf', 'hairLong'].includes(e.part)) e.trunk = true; }
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
  const stride = lerp(1.35, 2.5, a.runB) * Math.max(1, sp / 7);
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
  if (sp > 7) { const k = Math.min(1, (sp - 7) / 15); _P.spX += 0.3 * k; _P.thLx *= 1 + 0.45 * k; _P.thRx *= 1 + 0.45 * k; _P.shLx *= 1 + 0.7 * k; _P.shRx *= 1 + 0.7 * k; _P.elL -= 0.25 * k; _P.elR -= 0.25 * k; _P.hdX = -_P.spX * 0.45; }
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
  const pHeld = p.isPlayer && typeof store !== 'undefined' ? store.held : null;
  const holdUmb = ((raining && p.look.umbrella && p.npc) || (pHeld === 'umbrella' && (raining || p.umbOpen))) && !a.special && p.mode !== 'down' && p.mode !== 'sit' && !p.inCar;
  if (pHeld && pHeld !== 'umbrella' && !a.special && !p.inCar) { const Q = clearQ(), m = ITEMS[pHeld].model; if (m === 'balloon') { Q.shRx = -1.6; Q.elR = -0.3; Q.shRz = -0.15; } else if (m === 'phone') { Q.shRx = -0.85; Q.shRz = -0.4; Q.elR = -2.0; Q.hdX = 0.25; } else if (m === 'skate') { Q.shRx = 0.05; Q.elR = -0.2; } else { Q.shRx = -0.42; Q.elR = -1.15; Q.shRz = -0.08; } mixPose(0.9, Q); }
  if (p.skate) { const Q = clearQ(), push = clamp(1 - sp / 4, 0, 1) * (p.onGround ? 1 : 0), ph = t * 6;
    Q.hipRy = 0.9; Q.spY = -0.75; Q.hdY = -0.15; Q.thLx = -0.25 - push * Math.max(0, Math.sin(ph)) * 0.6; Q.thRx = 0.2; Q.thLz = 0.18; Q.thRz = -0.18; Q.knL = 0.45 + push * Math.max(0, Math.sin(ph)) * 0.5; Q.knR = 0.45;
    Q.hipY = 0.88; Q.shLz = 0.75; Q.shRz = -0.75; Q.elL = -0.3; Q.elR = -0.3; Q.shLx = 0.1; Q.shRx = -0.1; Q.spX = 0.12; mixPose(1, Q); }
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
    } else if (sp_ === 'lie') {
      Q.rigX = -Math.PI / 2; Q.rigY = 0.12; Q.thLx = 0; Q.thRx = 0; Q.knL = 0.06; Q.knR = 0.12; Q.anL = -0.3; Q.anR = -0.3; Q.thLz = 0.05; Q.thRz = -0.05;
      Q.shLx = -0.35; Q.shRx = -0.35; Q.shLz = 0.12; Q.shRz = -0.12; Q.elL = -1.25; Q.elR = -1.25; Q.spX = 0; Q.hdX = -0.12 + Math.sin(t * 1.2) * 0.01; Q.hipY = 0.95; Q.hdY = 0;
    } else if (sp_ === 'read') {
      Q.shLx = -0.95; Q.shRx = -0.95; Q.elL = -1.25; Q.elR = -1.25; Q.shLz = 0.28; Q.shRz = -0.28; Q.hdX = 0.45 + Math.sin(t * 0.8) * 0.04;
    } else if (sp_ === 'drink') {
      Q.shRx = -1.15; Q.shRz = -0.35; Q.elR = -2.15; Q.hdX = -0.32; Q.shLx = 0.05;
    } else if (sp_ === 'phone') {
      Q.shRx = -0.85; Q.shRz = -0.4; Q.elR = -2.25; Q.hdZ = 0.16; Q.hdX = 0.08;
    } else if (sp_ === 'repair') {
      const w = t * 6 + sd;
      Q.hipY = 0.56; Q.thLx = -1.45; Q.thRx = -0.7; Q.knL = 2.0; Q.knR = 1.45; Q.anL = 0.4; Q.anR = 0.1; Q.spX = 0.5; Q.hdX = 0.25;
      Q.shLx = -1.05 + Math.sin(w) * 0.25; Q.shRx = -1.25 + Math.sin(w * 1.3 + 1) * 0.35; Q.elL = -0.6; Q.elR = -0.8 + Math.sin(w * 2) * 0.3; Q.shLz = 0.2; Q.shRz = -0.2;
    } else if (sp_ === 'repairUp') {
      const w = t * 5 + sd;
      Q.shLx = -2.5 + Math.sin(w) * 0.15; Q.shRx = -2.3 + Math.sin(w * 1.4 + 1) * 0.3; Q.elL = -0.45; Q.elR = -0.6 + Math.sin(w * 2.2) * 0.35; Q.hdX = -0.4; Q.spX = -0.08; Q.shLz = 0.25; Q.shRz = -0.25;
    } else if (sp_ === 'passenger') {
      Q.hipY = 0.18; Q.thLx = -1.35; Q.thRx = -1.35; Q.knL = 1.1; Q.knR = 1.1; Q.anL = 0.2; Q.anR = 0.2; Q.spX = -0.2; Q.shLx = -0.35; Q.shRx = -0.35; Q.elL = -0.95; Q.elR = -0.95; Q.hdY = Math.sin(t * 0.3) * 0.4;
    } else if (sp_ === 'sitGround') {
      Q.hipY = 0.14; Q.thLx = -1.45; Q.thRx = -1.45; Q.knL = 0.3; Q.knR = 0.5; Q.thLz = 0.12; Q.thRz = -0.12; Q.spX = -0.28; Q.shLx = 0.55; Q.shRx = 0.55; Q.elL = -0.1; Q.elR = -0.1; Q.shLz = 0.3; Q.shRz = -0.3;
    } else if (sp_ === 'eat') {
      const b = Math.max(0, Math.sin(t * 5)); Q.shRx = -0.9 - b * 0.3; Q.shRz = -0.3; Q.elR = -1.9 - b * 0.35; Q.hdX = 0.05 - b * 0.08; Q.shLx = -0.3; Q.elL = -0.9;
    } else if (sp_ === 'kick') {
      Q.thRx = -1.1; Q.knR = 0.2; Q.spX = -0.15; Q.shLz = 0.5; Q.shRz = -0.5; Q.shLx = 0.4;
    } else if (sp_ === 'fuel') {
      Q.shRx = -1.05; Q.shRz = -0.12; Q.elR = -0.35; Q.shLz = 0.15; Q.hdX = 0.18; Q.spX = 0.08;
    } else if (sp_ === 'arcade') {
      const w = t * 9 + sd; Q.shLx = -1.05 + Math.sin(w) * 0.08; Q.shRx = -1.0 + Math.sin(w * 1.7) * 0.12; Q.elL = -0.7; Q.elR = -0.75 + Math.sin(w * 2.3) * 0.15; Q.hdX = 0.12; Q.spX = 0.1;
    } else if (sp_ === 'swing') {
      const sa = a.swingA || 0;
      Q.hipY = 0.5; Q.thLx = -1.5 - sa * 0.6; Q.thRx = -1.5 - sa * 0.6; Q.knL = 1.45 + sa * 0.9; Q.knR = 1.45 + sa * 0.9; Q.spX = -0.1 + sa * 0.25;
      Q.shLx = -2.75; Q.shRx = -2.75; Q.elL = -0.25; Q.elR = -0.25; Q.shLz = 0.05; Q.shRz = -0.05; Q.hdX = -sa * 0.2;
    } else if (sp_ === 'count') {
      Q.shLx = -1.85; Q.shRx = -1.85; Q.elL = -2.25; Q.elR = -2.25; Q.shLz = 0.5; Q.shRz = -0.5; Q.shLy = -0.4; Q.shRy = 0.4; Q.hdX = 0.4; Q.spX = 0.18 + Math.sin(t * 2) * 0.02;
    } else if (sp_ === 'peek') {
      Q.spX = 0.55; Q.hdX = -0.35; Q.hdY = Math.sin(t * 2.4) * 0.7; Q.knL = 0.45; Q.knR = 0.45; Q.thLx = -0.3; Q.thRx = -0.3; Q.hipY = 0.86; Q.shLx = -0.7; Q.shRx = -0.5; Q.elL = -0.6; Q.elR = -0.9;
    } else if (sp_ === 'crouch') {
      Q.hipY = 0.42; Q.thLx = -1.75; Q.thRx = -1.65; Q.knL = 2.3; Q.knR = 2.2; Q.anL = 0.55; Q.anR = 0.5; Q.spX = 0.45; Q.hdX = -0.15 + Math.sin(t * 0.8) * 0.05; Q.shLx = -0.9; Q.shRx = -0.9; Q.elL = -1.3; Q.elR = -1.3; Q.shLz = 0.2; Q.shRz = -0.2;
    } else if (sp_ === 'cheer') {
      const b = Math.abs(Math.sin(t * 7)); Q.shLz = 2.7; Q.shRz = -2.7; Q.elL = -0.3; Q.elR = -0.3; Q.hipY = 0.95 + b * 0.08; Q.hdX = -0.2; Q.knL = 0.3 * (1 - b); Q.knR = 0.3 * (1 - b);
    } else if (sp_ === 'point') {
      Q.shRx = -1.55; Q.shRz = -0.1; Q.elR = -0.05; Q.hdX = -0.05; Q.shLz = 0.3; Q.elL = -1.4; Q.shLx = -0.3; Q.spX = 0.05;
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
CAR_TYPES.tow = { len: 7.3, wid: 2.3, wb: 4.3, wr: 0.48, mass: 6500, engine: 6.5, vmax: 30, roofY: 2.62, beltY: 1.62, cab: [1.5, 2.95], headY: 1.05, tailY: 1.0, front: 3.7, rear: -3.66,
  body: [[-3.6, 0.62], [3.55, 0.62], [3.68, 0.9], [3.62, 1.55], [1.45, 1.62], [1.45, 1.2], [-3.6, 1.2]],
  cabin: [[1.45, 1.6], [3.3, 1.6], [2.95, 2.55], [1.48, 2.6]] };
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
function fixNormals(g) { const n = g.attributes.normal.array; for (let i = 0; i < n.length; i += 3) { const l = n[i] * n[i] + n[i + 1] * n[i + 1] + n[i + 2] * n[i + 2]; if (!(l > 1e-8)) { n[i] = 0; n[i + 1] = 1; n[i + 2] = 0; } } g.attributes.normal.needsUpdate = true; }
const _lv = new V3();
class Car {
  constructor(type, color, x, z, h, opts = {}) {
    this.type = type; this.T = CAR_TYPES[type]; this.taxi = !!opts.taxi;
    this.x = x; this.z = z; this.h = h; this.y = 0; this.vx = 0; this.vz = 0; this.av = 0; this.vf = 0; this.steer = 0; this.aiSteer = 0; this.accel = 0;
    this.inThrottle = 0; this.inSteer = 0; this.inHand = !opts.ai; this.braking = false; this.slip = 0;
    this.wheelRot = 0; this.pitch = 0; this.roll = 0; this.door = 0; this.doorT = 0; this.hasDriver = !!opts.ai;
    this.mass = this.T.mass; this.ai = null; this.player = false; this.bump = 0; this.health = 100; this.dents = 0; this.blink = null; this.blinkT = 0; this.hazardT = 0;
    this.smokeAcc = 0; this.driverP = null; this.owner = null; this.fuel = opts.ai ? 100 : 35 + Math.random() * 65;
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
  seatPose(p, passenger) {
    const t = this.T, s = Math.sin(this.h), c = Math.cos(this.h), onBus = passenger && this.service === 'bus', lx = onBus ? -0.75 : (passenger ? -1 : 1) * (t.wid / 2 - 0.5), lz = onBus ? -1.5 : (t.cab[0] + t.cab[1]) / 2 - 0.08;
    const by = this.group.position.y + this.body.position.y + (onBus ? 0.87 : t.roofY - 0.1 - 0.965 * (p.look.h || 1));
    p.H.root.position.set(this.x + lx * c + lz * s, by, this.z - lx * s + lz * c);
    p.H.root.rotation.set(this.pitch, this.h, this.roll, 'YXZ');
    p.steer = this.steer * 2;
  }
  topAt(lf) { const t = this.T; return (lf >= t.cab[0] - 0.15 && lf <= t.cab[1] + 0.1) ? t.roofY + 0.06 : t.beltY - (lf > 0 ? 0.12 : 0); }
  damage(px, pz, py, nx, nz, s) {
    if (s < 3 || this.locked || this.service) return;
    this.health = Math.max(0, this.health - s * 1.6);
    const c = Math.cos(this.h), sn = Math.sin(this.h);
    const dx = px - this.x, dz = pz - this.z, lx = dx * c - dz * sn, lz = dx * sn + dz * c; // world -> local
    this.dent(lx, lz, (py ?? this.y + 0.7) - this.y, nx * c - nz * sn, nx * sn + nz * c, s);
  }
  dent(lx, lz, ly, lnx, lnz, s) {
    if (this.dents > 40) return; this.dents++; (this.dentLog || (this.dentLog = [])).push([+lx.toFixed(2), +lz.toFixed(2), +ly.toFixed(2), +lnx.toFixed(2), +lnz.toFixed(2), +s.toFixed(1)]);
    if (!this.paintMesh.userData.own) { this.paintMesh.geometry = this.paintMesh.geometry.clone(); this.paintMesh.userData.own = true; }
    const g = this.paintMesh.geometry, pos = g.attributes.position;
    const amt = Math.min(0.16, s * 0.012), R2 = 0.85;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i), d = Math.hypot(vx - lx, (vy - ly) * 0.8, vz - lz);
      if (d > R2) continue; const f = (1 - d / R2) ** 2 * amt * (0.7 + 0.6 * Math.sin(vx * 37 + vz * 23));
      pos.setXYZ(i, vx + lnx * f, vy - f * 0.25, vz + lnz * f);
    }
    pos.needsUpdate = true; g.computeVertexNormals(); fixNormals(g);
  }
  repairAll() {
    this.health = 100; this.dents = 0; this.dentLog = []; this.fuel = Math.max(this.fuel, 60);
    if (this.paintMesh.userData.own) { this.paintMesh.geometry.dispose(); this.paintMesh.geometry = this.G.paint; this.paintMesh.userData.own = false; }
  }
  integrate(dt) {
    const t = this.T; const fx = Math.sin(this.h), fz = Math.cos(this.h), rx = -fz, rz = fx;
    let vf = this.vx * fx + this.vz * fz, vl = this.vx * rx + this.vz * rz;
    const power = this.valet ? 0.45 : this.health <= 0 || this.fuel <= 0 ? 0 : this.health < 25 ? 0.55 : 1; // a dead car is rolled into the bay by hand
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
    if (!this.carriedBy && !this.glide) { this.y = dt ? damp(this.y, gy, 14, dt) : gy; this.carryPitch = 0; }
    this.group.position.set(this.x, this.y + (this.lift || 0), this.z); this.group.rotation.set(this.carryPitch || 0, this.h, 0, 'YXZ');
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
    if (this.passengerP) this.seatPose(this.passengerP, true);
    if (this.isTow) towVisuals(this, dt || 0);
    if (this.service) serviceVisuals(this, dt || 0);
  }
  corners() { const t = this.T, o = this._co || (this._co = {}); o.fx = Math.sin(this.h); o.fz = Math.cos(this.h); o.rx = -o.fz; o.rz = o.fx; o.hl = t.len / 2; o.hw = t.wid / 2; return o; }
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
  setDest(x, z) { this.dest = roadTarget(x, z); this.resetFromPos(); }
  clearDest() { this.dest = null; this.resetFromPos(); }
  reset(i, j, d) {
    this.i = i; this.j = j; this.d = d; this.k = 0; this.finalSet = false; this.arrived = false;
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
    if (this.finalSet) return;
    const { i, j, d } = this; const opts = [];
    for (const [nd, w] of [[d, 0.5], [(d + 1) % 4, 0.25], [(d + 3) % 4, 0.25]]) if (inGrid(i + DIRS[nd][0], j + DIRS[nd][1])) opts.push([nd, w]);
    let nd = (d + 2) % 4, final = false;
    if (this.dest) {
      const G = this.dest;
      if (i === G.A.i && j === G.A.j) { nd = G.d; final = true; }
      else { const b = bfsDir(i, j, d, G.A); if (b != null) nd = b; else if (opts.length) nd = opts[0][0]; }
    } else if (opts.length) { let tot = opts.reduce((s, o) => s + o[1], 0), r = Math.random() * tot; for (const o of opts) { r -= o[1]; if (r <= 0) { nd = o[0]; break; } } if (r > 0) nd = opts[opts.length - 1][0]; }
    const last = this.path[this.path.length - 1]; last.turn = nd !== d; last.turnDir = nd === (d + 3) % 4 ? 'R' : nd === (d + 1) % 4 ? 'L' : null;
    const E = exitPt(i, j, nd);
    if (nd !== d) {
      const lo1 = laneOff(d), lo2 = laneOff(nd), P1 = { x: roadX(i) + lo1.x + lo2.x, z: roadX(j) + lo1.z + lo2.z };
      if (nd === (d + 2) % 4) { P1.x = roadX(i) + DIRS[d][0] * 4; P1.z = roadX(j) + DIRS[d][1] * 4; }
      for (let t = 0.2; t < 0.99; t += 0.2) { const u = 1 - t; this.path.push({ x: u * u * last.x + 2 * u * t * P1.x + t * t * E.x, z: u * u * last.z + 2 * u * t * P1.z + t * t * E.z, curve: true }); }
    }
    this.path.push({ x: E.x, z: E.z, curve: nd !== d });
    if (final) { this.path.push({ x: this.dest.S.x, z: this.dest.S.z, final: true }); this.finalSet = true; return; }
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
    if (this.finalSet) {
      const L = p[p.length - 1], df = Math.hypot(L.x - c.x, L.z - c.z);
      target = Math.min(target, Math.max(0, df - 0.6) * 0.55 + (df > 4 ? 1.5 : 0));
      if (df < 2.2) { this.arrived = true; target = 0; }
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
    if (blocked && c.vf < 0.5 && !byLight) { this.waitT += dt; if (this.waitT > (c.sirenOn ? 1.2 : c.service === 'bus' ? 4 : 7)) { this.ignore = 1.6; this.waitT = 0; } } else this.waitT = 0;
    if (this.blockT > 2.2) { this.blockT = -5; Audio.honk(c.x, c.z); }
    if (!blocked) this.blockT = Math.max(0, this.blockT - dt);
    if (this.rev > 0) { this.rev -= dt; c.inThrottle = -0.7; c.aiSteer = -c.aiSteer; c.inHand = false; return; }
    c.blink = (found && found.turnDir && dist < 34) ? found.turnDir : (a.curve || b.curve) ? c.blink : null;
    c.inThrottle = clamp((target - c.vf) * 0.55, -1, 1);
    c.inHand = target < 0.25 && c.vf < 0.6; if (c.inHand) c.inThrottle = 0;
    if (c.inThrottle > 0.4 && Math.abs(c.vf) < 0.3) { this.stuck += dt; if (this.stuck > 2.5) { this.rev = 1.4; this.stuck = 0; } } else this.stuck = Math.max(0, this.stuck - dt);
  }
}

/* routing helpers for vehicles sent to a place (tow truck) */
function bfsDir(i, j, d, goal) {
  for (const allowBack of [false, true]) {
    const seen = new Set([i + ',' + j]), q = [];
    for (let nd = 0; nd < 4; nd++) { if (!allowBack && nd === (d + 2) % 4) continue; const ni = i + DIRS[nd][0], nj = j + DIRS[nd][1]; if (!inGrid(ni, nj)) continue; if (ni === goal.i && nj === goal.j) return nd; q.push([ni, nj, nd]); seen.add(ni + ',' + nj); }
    while (q.length) { const [ci, cj, f] = q.shift(); for (let nd = 0; nd < 4; nd++) { const ni = ci + DIRS[nd][0], nj = cj + DIRS[nd][1], k = ni + ',' + nj; if (!inGrid(ni, nj) || seen.has(k)) continue; if (ni === goal.i && nj === goal.j) return f; seen.add(k); q.push([ni, nj, f]); } }
  }
  return null;
}
function roadTarget(x, z, ahead = 7.5) {
  const a = nearestRoad(x), b = nearestRoad(z);
  if (a.d <= b.d) {
    const i = a.k, X = roadX(i), j0 = clamp(Math.floor((z + HALF) / B), 0, N - 1), plus = x < X, d = plus ? 0 : 2;
    const lo = roadX(j0) + RH + 7, hi = roadX(j0 + 1) - RH - 7;
    return { A: { i, j: plus ? j0 : j0 + 1 }, d, S: { x: X + laneOff(d).x, z: clamp(z + (plus ? ahead : -ahead), lo, hi) } };
  }
  const j = b.k, Z = roadX(j), i0 = clamp(Math.floor((x + HALF) / B), 0, N - 1), plus = z > Z, d = plus ? 1 : 3;
  const lo = roadX(i0) + RH + 7, hi = roadX(i0 + 1) - RH - 7;
  return { A: { i: plus ? i0 : i0 + 1, j }, d, S: { x: clamp(x + (plus ? ahead : -ahead), lo, hi), z: Z + laneOff(d).z } };
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
  const r = p.radius, ST = p.stepH || STEP; p.hitWall = false;
  for (let it = 0; it < 2; it++) {
    col.query(p.pos.x - r - 0.1, p.pos.x + r + 0.1, p.pos.z - r - 0.1, p.pos.z + r + 0.1, _near);
    for (const c of _near) {
      if (c.maxY <= p.pos.y + ST || c.minY >= p.pos.y + p.height) continue;
      if (!colPush(c, p.pos.x, p.pos.z, r)) continue;
      const nx = _push.nx, nz = _push.nz, pen = _push.pen;
      p.pos.x += nx * pen; p.pos.z += nz * pen; const vn = p.vel.x * nx + p.vel.z * nz; if (vn < 0) { p.vel.x -= vn * nx; p.vel.z -= vn * nz; } p.hitWall = true;
    }
  }
  // cars as solid obstacles
  let standCar = null, carTop = -1;
  if (outdoor) for (const car of cars) {
    const dx = car.x - p.pos.x, dz = car.z - p.pos.z; if (dx * dx + dz * dz > 16 || car.lift > 0.5 || car.carriedBy || car === p.inCar) continue;
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
  let g = outdoor ? groundH(p.pos.x, p.pos.z) : col === rb.col ? -60 : 0;
  const fr = r * 0.6;
  col.query(p.pos.x - fr, p.pos.x + fr, p.pos.z - fr, p.pos.z + fr, _near);
  for (const c of _near) {
    if (c.maxY > p.pos.y + ST + 0.01 || c.maxY <= g) continue;
    if (!colOver(c, p.pos.x, p.pos.z, fr)) continue;
    g = c.maxY;
  }
  p.standCar = null;
  if (standCar && carTop > g) { g = carTop; p.standCar = standCar; }
  p.pos.y += p.vel.y * dt;
  if (p.pos.y <= g) { if (p.vel.y < -6) p.anim.land = Math.min(1, -p.vel.y / 14); p.pos.y = g; if (p.vel.y < 0) p.vel.y = 0; p.onGround = true; }
  else if (p.onGround && p.pos.y - g < 0.42 && p.vel.y <= 0) { p.pos.y = g; p.vel.y = 0; }
  else { p.onGround = false; p.standCar = null; }
  if (!outdoor && col === interior.col && p.pos.y + p.height > 3.05) { p.pos.y = 3.05 - p.height; if (p.vel.y > 0) p.vel.y = 0; }
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
  if (p.npc && imp > 7) injure(p, imp);
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
    } else if (c.t === 2) {
      const rx = ox - c.x, rz = oz - c.z, lo = [rx * c.c - rz * c.s, oy, rx * c.s + rz * c.c], ld = [dx * c.c - dz * c.s, dy, dx * c.s + dz * c.c], mn = [-c.hx, c.minY, -c.hz], mx = [c.hx, c.maxY, c.hz];
      let t0 = 0, t1 = tmin, ok = true;
      for (let a = 0; a < 3; a++) { const o = lo[a], d = ld[a]; if (Math.abs(d) < 1e-9) { if (o < mn[a] || o > mx[a]) { ok = false; break; } continue; } let ta = (mn[a] - o) / d, tb = (mx[a] - o) / d; if (ta > tb) { const q = ta; ta = tb; tb = q; } t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) { ok = false; break; } }
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
    const vis = b.p.pool && b.p.pool.parent === zoneScene(player.where) && b.p.H.visible;
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
  else { n.mode = n.mech ? 'mech' : n.mallStaff ? 'stand' : n.mall ? 'mall' : n.school ? 'wander' : n.ring ? 'idle' : (n.spots ? 'wander' : 'stand'); n.timer = 2 + Math.random() * 2; n.path = null; }
}
let hornEvent = null;
function updateNPC(n, dt, outdoor, col) {
  n.timer -= dt; n.bumpCD -= dt; n.cornerCD -= dt; n.decideT -= dt;
  if (n.specialT !== undefined && n.anim.special && n.anim.special !== 'sit') { n.specialT -= dt; if (n.specialT <= 0) n.anim.special = null; }
  let desired = 0, dx = 0, dz = 0;
  const pl = player, plHere = pl.where === (outdoor ? 'out' : (n.zone || 'in')), pd = plHere ? Math.hypot(pl.pos.x - n.pos.x, pl.pos.z - n.pos.z) : 99;
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
    case 'flee': desired = n.fleeSpd || 5.0; dx = n.fx; dz = n.fz; if (n.timer < 0) { n.fleeSpd = 0; n.mode = n.mech ? 'mech' : 'goto'; } break;
    case 'mall': { const r = updateMallNPCMode(n, dt, faceTo); dx = r[0]; dz = r[1]; desired = r[2]; break; }
    case 'goto': {
      if (n.mall || n.mallStaff || n.school) { n.mode = n.mallStaff ? 'mall' : n.school ? 'wander' : 'mall'; if (n.mallStaff) n.path = [[n.home[0], n.home[2], 1]]; else n.path = null; break; }
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
    case 'down': n.knockT += dt; if (n.onGround) { n.vel.x *= Math.exp(-5 * dt); n.vel.z *= Math.exp(-5 * dt); }
      if (n.injured) { n.knockT = Math.min(n.knockT, 3); if (Math.random() < dt * 0.12 && pd < 25) say(n, mpick(['آخ...', 'کمک...', 'پام خیلی درد می‌کنه...', 'آمبولانس...']), 2.4); }
      if (n.knockT > 3.2) { n.mode = 'getup'; n.timer = 1.3; } break;
    case 'task': {
      const T = n.task; if (!T || (T.until && T.until())) { n.task = null; n.anim.special = null; finishMode(n); break; }
      dx = T.x - n.pos.x; dz = T.z - n.pos.z; const d = Math.hypot(dx, dz);
      if (d < 0.5) { desired = 0; T.done = true; if (T.look) faceTo(T.look.pos.x, T.look.pos.z, 5); if (T.anim) { n.anim.special = T.anim; n.specialT = 1; } if (T.idle) n.anim.idleKind = T.idle; }
      else { desired = T.spd || (T.run ? 3.4 : 1.4); T.done = false; if (n.anim.special === 'repair') n.anim.special = null; }
      break;
    }
    case 'getup': if (n.timer < 0) { n.mode = 'flee'; n.timer = 1.8; const a = Math.random() * 6.28; n.fx = Math.sin(a); n.fz = Math.cos(a); n.fleeSpd = 4; } break;
    case 'wander': {
      if (!n.tgt || n.timer < 0) { n.tgt = mpick(n.spots); n.timer = 6 + Math.random() * 6; }
      dx = n.tgt[0] - n.pos.x; dz = n.tgt[1] - n.pos.z; const d = Math.hypot(dx, dz); desired = d > 0.4 ? 1.0 : 0; break;
    }
    case 'stand': break;
    case 'valet': return;
    case 'mech': {
      const job = garage.job; let tx, tz, face = null;
      if (job && job.phase !== 'done') { [tx, tz] = job.spots[n.mechIdx]; face = job.bay; } else [tx, tz] = garage.mechSpots[n.mechIdx];
      dx = tx - n.pos.x; dz = tz - n.pos.z; const d = Math.hypot(dx, dz); desired = d > 0.35 ? 1.7 : 0;
      if (!desired) {
        if (face) faceTo(face.x, face.z, 4); else faceTo(garage.cx, n.pos.z, 2);
        n.anim.special = job && job.phase === 'work' ? (job.car.lift > 0.6 ? 'repairUp' : 'repair') : null;
      } else n.anim.special = null;
      break;
    }
  }
  n.anim.knock = damp(n.anim.knock, n.mode === 'down' ? 1 : 0, n.mode === 'down' ? 7 : 2.2, dt);
  n.anim.getup = damp(n.anim.getup, n.mode === 'getup' ? 1 : 0, 6, dt);
  // danger from cars, and reaction to the horn
  if (outdoor && n.mode !== 'down' && n.mode !== 'getup' && n.mode !== 'talk' && n.mode !== 'mech') {
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
/* the same resident lives in each house every visit (and after reloading) */
function residentFor(key, job) {
  let rs = store.residents[key];
  if (!rs) { const look = randomLook(); const persona = makePersona(look, look.female); if (job) { persona.job = job; persona.jobLine = 'خوش اومدید به مغازهٔ ما.'; } rs = store.residents[key] = { look, persona }; }
  const p = makePerson(rs.look, false); p.persona = rs.persona; p.npc = true; return p;
}
function buildInterior(door) {
  for (const n of interior.npcs) interiorPool.detach(n); interior.npcs = []; interior.fan = interior.clock = interior.tv = null; interior.items = [];
  const key = world.doors.indexOf(door); interior.key = key;
  const hs = store.homes[key] || (store.homes[key] = { lights: true, tv: true, stove: false, sink: false });
  interior.hs = hs;
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
  { const pv = new THREE.Group(); pv.position.set(-0.52, 0, D / 2 - 0.02); interiorScene.add(pv);
    const ed = new THREE.Mesh(doorGeo, doorMat(door.kind === 'shop' ? 0x9aa3ab : 0x7a5230)); ed.receiveShadow = true; ed.castShadow = true; pv.add(ed);
    interior.exitDoor = { pv, open: 0, want: 0, closeT: 0 };
    const view = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6), M.winView); view.position.set(0, 1.25, D / 2 + 0.35); view.rotation.y = Math.PI; interiorScene.add(view);
    BT.add('sidewalk', quadUp(-0.7, D / 2 + 0.05, 0.7, D / 2 + 0.36, 0.0, 4), 0, 0, 0, 0, 0xcfc8bc); }
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
    F = mkFrame(-W / 2 + 0.32, -1.2, Math.PI / 2); fBox(F, 'wood', 0, 1.05, -0.02, 1.6, 2.1, 0.56, woodC, { col: true }); fBox(F, 'fabric', 0, 1.05, 0.0, 1.5, 2.0, 0.5, 0x2a2420);
    for (let k = 0; k < 5; k++) fBox(F, 'fabric', -0.55 + k * 0.27, 1.25, 0.02, 0.22, 0.9, 0.06, pick([0x3a5a8a, 0x8a3a3a, 0xd8d0c0, 0x2a2a2a, 0x5a7a4a]));
    { const g = new THREE.Group(), [x, z] = fw(F, 0, 0.27); g.position.set(x, 0, z); g.rotation.y = F.a; interiorScene.add(g); const dm = new THREE.MeshStandardMaterial({ color: woodC, roughness: 0.6 }), hm = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.8, roughness: 0.3 });
      const doors = [-1, 1].map(sd => { const pv = new THREE.Group(); pv.position.set(sd * 0.8, 0, 0); g.add(pv); const m = new THREE.Mesh(new THREE.BoxGeometry(0.79, 2.06, 0.03), dm); m.position.set(-sd * 0.395, 1.05, 0); m.castShadow = true; pv.add(m); const h = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.03), hm); h.position.set(-sd * 0.72, 1.05, 0.03); pv.add(h); pv.userData.sd = sd; return pv; });
      interior.wardrobe = { doors, open: 0, target: 0 }; }
    // kitchen
    const kc = pick([0xf2efe8, 0x2f4a5a, 0x6a7a5a, 0xd8c8a8, 0x3a3a3a]);
    BT.add('wood', boxGeo(3.8, 0.88, 0.62), 2.7, 0.44, -D / 2 + 0.31, 0, kc); CL.box(0.8, 4.6, -D / 2, -D / 2 + 0.62, 0, 0.92);
    BT.add('trim', boxGeo(3.86, 0.04, 0.66), 2.7, 0.9, -D / 2 + 0.33, 0, pick([0x2a2a2a, 0xe8e4dc, 0x7a6a5a]));
    BT.add('metal', boxGeo(0.6, 0.02, 0.4), 1.6, 0.92, -D / 2 + 0.33, 0, 0xc0c4c8);
    BT.add('metal', boxGeo(0.62, 0.02, 0.55), 3.6, 0.925, -D / 2 + 0.33, 0, 0x111111);
    for (const [ax, az] of [[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]]) BT.add('metal', GEO.cyl, 3.6 + ax, 0.94, -D / 2 + 0.33 + az, 0, 0x333333, 0, 0, 0.08, 0.01, 0.08);
    BT.add('wood', boxGeo(1.8, 0.7, 0.35), 3.7, 1.95, -D / 2 + 0.18, 0, kc);
    const fcol = pick([0xe8e8e8, 0xb8bcc0]);
    BT.add('metal', boxGeo(0.9, 1.9, 0.68), 5.4, 0.95, -D / 2 + 0.35, 0, fcol); CL.box(4.95, 5.85, -D / 2, -D / 2 + 0.74, 0, 1.9);
    for (let lv = 0; lv < 3; lv++) for (let b = 0; b < 4; b++) BT.add('fabric', GEO.cyl, 5.1 + b * 0.18, 0.45 + lv * 0.45, -D / 2 + 0.55, 0, pick([0xd94a3a, 0x3aa0d9, 0xf2c14e, 0xffffff, 0x4ab04a]), 0, 0, 0.04, 0.24, 0.04);
    { const pv = new THREE.Group(); pv.position.set(4.96, 0, -D / 2 + 0.72); interiorScene.add(pv);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.88, 0.06), new THREE.MeshStandardMaterial({ color: fcol, roughness: 0.25, metalness: 0.6 })); m.position.set(0.45, 0.95, 0); m.castShadow = true; pv.add(m);
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.04), new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 })); h.position.set(0.84, 1.15, 0.05); pv.add(h);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.7), new THREE.MeshBasicMaterial({ color: 0xf2f8ff, transparent: true, opacity: 0.35, toneMapped: false })); glow.position.set(5.4, 0.95, -D / 2 + 0.66); glow.visible = false; interiorScene.add(glow);
      interior.fridge = { pv, glow, open: 0, target: 0 }; }
    // tap, sink water and stove burners
    BT.add('metal', GEO.cyl, 1.6, 1.08, -D / 2 + 0.1, 0, 0xd0d4d8, 0, 0, 0.02, 0.32, 0.02); BT.add('metal', boxGeo(0.03, 0.03, 0.2), 1.6, 1.23, -D / 2 + 0.2, 0, 0xd0d4d8);
    { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.65, roughness: 0.05 })); w.position.set(1.6, 1.07, -D / 2 + 0.29); w.visible = hs.sink; interiorScene.add(w); interior.water = w; }
    { const bm = new THREE.MeshBasicMaterial({ color: 0xff5a1a, toneMapped: false }), g = new THREE.Group(); for (const [ax, az] of [[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]]) { const c = new THREE.Mesh(new THREE.CircleGeometry(0.075, 18), bm); c.rotation.x = -Math.PI / 2; c.position.set(3.6 + ax, 0.947, -D / 2 + 0.33 + az); g.add(c); } g.visible = hs.stove; interiorScene.add(g); interior.burners = g; }
    BT.add('metal', GEO.cyl, 3.46, 1.02, -D / 2 + 0.45, 0, 0x8a8f96, 0, 0, 0.13, 0.15, 0.13);
    BT.add('trim', boxGeo(0.09, 0.13, 0.02), 1.1, 1.3, D / 2 - 0.02, 0, 0xf8f8f8);
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
    const res = residentFor(key); res.mode = 'wander'; res.spots = [[0, 3], [1.2, 1.2], [-0.2, -1.5], [1.6, -2.8], [-1.8, -2.4], [0.5, 0.3]];
    res.pos.set(1.2, 0, 1.2); interiorPool.attach(res); interior.npcs.push(res);
    const pp = res.persona; pp.met++;
    say(res, pp.mem.carTaken ? 'تو؟! تو خونهٔ من چیکار می‌کنی؟' : pp.met > 1 ? `${pp.mem.playerName ? pp.mem.playerName + '! ' : ''}باز هم اومدی؟ خوش اومدی!` : mpick([`سلام! من ${pp.name}م، خوش اومدی`, 'به به! بفرما داخل', 'سلام همسایه!', 'چای می‌خوری؟']), 3);
    // things in the house you can use
    const it = (id, x, z, r, label, use) => interior.items.push({ id, x, z, r, label, use });
    const bz = -D / 2 + 1.15;
    it('bed', -3.6, bz + 1.0, 1.3, () => 'دراز کشیدن روی تخت', () => startUse('lie', -3.6, 0.62, bz + 0.88, 0, -3.6, bz + 1.6));
    it('sofa', -1.75, 1.8, 1.4, () => 'نشستن روی مبل', () => startUse('sit', -1.6, 0, 1.8, -Math.PI / 2, -2.4, 1.8));
    [[2.6, -1.25, 0], [3.4, -1.25, 0], [2.6, 0.05, Math.PI], [3.4, 0.05, Math.PI]].forEach(([cx, cz, r], i) => it('chair' + i, cx, cz + (r ? 0.45 : -0.45), 0.8, () => 'نشستن پشت میز', () => startUse('sit', cx, 0.0, cz - Math.cos(r) * 0.02, r, cx, cz + (r ? 0.75 : -0.75))));
    it('tv', -W / 2 + 1.2, 1.8, 1.2, () => interior.hs.tv ? 'خاموش کردن تلویزیون' : 'روشن کردن تلویزیون', () => { interior.hs.tv = !interior.hs.tv; Audio.tick(); });
    it('fridge', 5.3, -D / 2 + 1.3, 1.0, () => 'یه نوشیدنی خنک از یخچال بردار', () => { interior.fridge.target = 1; startUse('drink', player.pos.x, 0, player.pos.z, player.facing, null, null, 2.6); Audio.door(); setTimeout(() => { if (interior.fridge) interior.fridge.target = 0; }, 2400); });
    it('stove', 3.6, -D / 2 + 1.25, 0.9, () => interior.hs.stove ? 'خاموش کردن اجاق گاز' : 'روشن کردن اجاق گاز', () => { interior.hs.stove = !interior.hs.stove; interior.burners.visible = interior.hs.stove; Audio.tick(); if (interior.hs.stove) say(player, 'یه چای بذارم...', 2); });
    it('sink', 1.6, -D / 2 + 1.25, 0.9, () => interior.hs.sink ? 'بستن شیر آب' : 'باز کردن شیر آب', () => { interior.hs.sink = !interior.hs.sink; interior.water.visible = interior.hs.sink; Audio.tick(); });
    it('light', 1.1, D / 2 - 0.6, 0.8, () => interior.hs.lights ? 'خاموش کردن چراغ‌ها' : 'روشن کردن چراغ‌ها', () => { interior.hs.lights = !interior.hs.lights; Audio.tick(); });
    it('wardrobe', -W / 2 + 1.25, -1.2, 1.1, () => interior.wardrobe.target ? 'بستن در کمد' : 'باز کردن در کمد', () => { interior.wardrobe.target = interior.wardrobe.target ? 0 : 1; Audio.door(); });
    it('book', W / 2 - 1.0, 2.8, 1.0, () => 'یه کتاب از کتابخونه بردار و بخون', () => { startUse('read', player.pos.x, 0, player.pos.z, Math.PI / 2 * 1 + Math.PI, null, null); say(player, mpick(['«الا یا ایها الساقی، ادر کأساً و ناولها»', '«بیا تا گل برافشانیم و می در ساغر اندازیم»', '«توانا بود هر که دانا بود»', '«بنی‌آدم اعضای یکدیگرند»']), 4); });
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
    const ck = residentFor(key, 'فروشنده'); ck.mode = 'stand'; ck.pos.set(4.9, 0, 4.25); ck.facing = Math.PI; interiorPool.attach(ck); interior.npcs.push(ck);
    const cat = catalogFor(door.name), sid = 'door:' + key;
    let ci = 0; for (const sx of [-4.6, -1.6, 1.4]) for (const sd of [-1, 1]) for (const lz of [-2.3, 0.4]) { const id = cat[ci++ % cat.length]; interior.items.push({ id: 'buy', x: sx + sd * 0.85, z: lz, r: 0.75, label: () => `${ITEMS[id].n} — <b>${fmtT(ITEMS[id].p)}</b> · بردار`, use: () => addToCart(id, sid) }); }
    interior.items.push({ id: 'pay', x: 4.9, z: 2.45, r: 1.1, label: () => { const it = store.cart.filter(c => c.shop === sid); return it.length ? `صندوق — ${fa(it.length)} قلم · <b>${fmtT(it.reduce((s, c) => s + ITEMS[c.id].p, 0))}</b> · پرداخت با کارت` : 'صندوق — اول از قفسه‌ها چیزی بردار'; }, use: () => payAt(sid, ck) });
    say(ck, mpick(['خوش آمدید!', 'بفرمایید، چی لازم دارید؟', 'سلام! امروز تخفیف داریم']), 3);
  }
  BT.build(interiorScene);
  const hl = new THREE.HemisphereLight(0xfff4e6, 0x6b5a48, 0.9); interiorScene.add(hl);
  interior.lights = []; interior.hemi = hl;
  for (const [x, y, z, c, i] of lights) { const pl = new THREE.PointLight(c, i, 14, 2); pl.position.set(x, y, z); pl.userData.base = i; interiorScene.add(pl); interior.lights.push(pl); }
  const dl = new THREE.DirectionalLight(0xfff0dd, 1.3); dl.position.set(2.5, 9, 3); dl.castShadow = true; dl.shadow.mapSize.set(1024, 1024);
  const sc = dl.shadow.camera; sc.left = -W / 2 - 1; sc.right = W / 2 + 1; sc.top = D / 2 + 1; sc.bottom = -D / 2 - 1; sc.near = 1; sc.far = 20; dl.shadow.bias = -0.0006; dl.shadow.normalBias = 0.02;
  interiorScene.add(dl, dl.target);
  interior.col = CL; interior.W = W; interior.D = D; interior.door = door;
  R = prevR; BT = prevBT; CL = prevCL;
}

function catalogFor(name) {
  const C = [['نانوایی', ['bread', 'cake']], ['سوپرمارکت', ['water', 'juice', 'soda', 'chips', 'choco', 'doogh', 'sandwich']], ['کافه', ['coffee', 'tea', 'cake', 'icecream']], ['چای', ['tea', 'cake', 'water']],
    ['داروخانه', ['vitamin', 'water']], ['کتاب', ['book', 'novel', 'notebook']], ['گل', ['flowers', 'tulips']], ['میوه', ['apple', 'juice']], ['سبزی', ['apple']], ['شیرینی', ['cake', 'choco']], ['قنادی', ['cake', 'choco']],
    ['لوازم‌التحریر', ['notebook', 'book']], ['عینک', ['sunglasses']], ['ابزار', ['flashlight', 'umbrella']], ['پوشاک', ['shirtBlue', 'shirtWhite', 'pantsJeans', 'jacket']], ['بستنی', ['icecream', 'juice']], ['آجیل', ['nuts', 'choco']],
    ['ساعت', ['watch']], ['موبایل', ['phone', 'headphones']], ['کفش', ['shoesWhite', 'shoesBlack']], ['اسباب', ['ball', 'balloon', 'skateboard']], ['عطاری', ['tea', 'vitamin']], ['لبنیات', ['doogh', 'water']], ['جایگاه', ['water', 'soda', 'chips', 'choco', 'sandwich', 'coffee']]];
  for (const [k, v] of C) if (name.includes(k)) return v;
  return ['water', 'juice', 'chips', 'choco', 'umbrella'];
}
const TV_NEWS = ['اخبار شهر آزاد: فوارهٔ پارک مرکزی امشب نورپردازی می‌شود', 'هواشناسی: احتمال بارش باران در ساعات آینده', 'ترافیک سنگین در خیابان حافظ گزارش شد', 'افتتاح کافهٔ جدید در خیابان سعدی', 'مسابقهٔ فوتبال محله فردا عصر برگزار می‌شود'];
function updateInterior(dt) {
  const hs = interior.hs || {};
  if (interior.fan) interior.fan.rotation.y += dt * 5 * (hs.lights === false ? 0.2 : 1);
  const lit = hs.lights !== false;
  for (const l of interior.lights || []) l.intensity = damp(l.intensity, lit ? l.userData.base : 0, 10, dt);
  if (interior.hemi) interior.hemi.intensity = damp(interior.hemi.intensity, lit ? 0.9 : 0.12 + 0.35 * dayF, 10, dt);
  M.lampOn.emissiveIntensity = lit ? 2.2 : 0;
  const fr = interior.fridge; if (fr) { fr.open = damp(fr.open, fr.target, 6, dt); fr.pv.rotation.y = -fr.open * 1.7; fr.glow.visible = fr.open > 0.1; }
  const ex = interior.exitDoor;
  if (ex) {
    if (ex.want) { const far = Math.hypot(player.pos.x, player.pos.z - interior.D / 2) > 2.6; ex.closeT = far ? ex.closeT + dt : 0; if (ex.closeT > 2.5) { ex.want = 0; Audio.door(); } }
    ex.open = damp(ex.open, ex.want, ex.want ? 3.2 : 2.4, dt); ex.pv.rotation.y = ex.open * 1.4;
  }
  const wd = interior.wardrobe; if (wd) { wd.open = damp(wd.open, wd.target, 5, dt); for (const d of wd.doors) d.rotation.y = d.userData.sd * wd.open * 1.7; }
  if (hs.sink && Math.random() < dt * 8) Audio.burst(0.025, 2500, 0.15, 'bandpass', 0.7);
  if (hs.stove && Math.random() < dt * 3) Audio.burst(0.015, 4000, 0.2, 'highpass', 1);
  const ck = interior.clock;
  if (ck) { const m = Math.floor(tod * 60); if (m !== ck.last) { ck.last = m; const g = ck.g; g.fillStyle = '#f6f1e6'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#222'; g.font = '14px Vazirmatn, Tahoma'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 1; k <= 12; k++) { const a = k / 12 * Math.PI * 2; g.fillText(fa(k), 64 + Math.sin(a) * 50, 64 - Math.cos(a) * 50); }
    const hand = (a, l, w) => { g.lineWidth = w; g.strokeStyle = '#222'; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.sin(a) * l, 64 - Math.cos(a) * l); g.stroke(); };
    hand((tod % 12) / 12 * Math.PI * 2, 30, 5); hand((tod % 1) * Math.PI * 2, 44, 3); ck.tex.needsUpdate = true; } }
  const tv = interior.tv;
  if (tv && hs.tv === false) { if (!tv.off) { tv.off = true; tv.g.fillStyle = '#050505'; tv.g.fillRect(0, 0, 256, 144); tv.tex.needsUpdate = true; } }
  else if (tv) { tv.off = false; tv.t += dt; if (tv.t > 0.08) { tv.t = 0; const g = tv.g, T_ = simTime; const gr = g.createLinearGradient(0, 0, 256, 144); gr.addColorStop(0, `hsl(${(T_ * 20) % 360},55%,35%)`); gr.addColorStop(1, `hsl(${(T_ * 20 + 120) % 360},55%,22%)`); g.fillStyle = gr; g.fillRect(0, 0, 256, 144);
    for (let k = 0; k < 5; k++) { g.fillStyle = `hsla(${k * 70},80%,65%,0.8)`; g.beginPath(); g.arc(128 + Math.sin(T_ * (0.7 + k * 0.3) + k) * 90, 60 + Math.cos(T_ * (0.9 + k * 0.2)) * 30, 12 + k * 3, 0, 7); g.fill(); }
    g.fillStyle = '#b3161b'; g.fillRect(0, 112, 256, 32); g.fillStyle = '#fff'; g.font = '18px Vazirmatn, Tahoma'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.textAlign = 'left';
    const msg = TV_NEWS[Math.floor(T_ / 9) % TV_NEWS.length]; g.fillText(msg, ((T_ * 60) % 700) - 400, 128); tv.tex.needsUpdate = true; } }
}
/* ============================================================
   Things you can buy, carry, wear and use
   ============================================================ */
// cat: food / drink (consumed), wear (changes how you look), hold (in your right hand), use (special)
const ITEMS = {
  water: { n: 'آب معدنی', p: 15000, cat: 'drink', model: 'bottle', col: '#8fd0ff', e: 8 },
  juice: { n: 'آب‌میوهٔ پرتقال', p: 45000, cat: 'drink', model: 'box', col: '#ff9a2a', e: 14 },
  soda: { n: 'نوشابه', p: 35000, cat: 'drink', model: 'can', col: '#d0242a', e: 10 },
  doogh: { n: 'دوغ', p: 30000, cat: 'drink', model: 'bottle', col: '#f4f4ee', e: 12 },
  coffee: { n: 'قهوهٔ لاته', p: 120000, cat: 'drink', model: 'cup', col: '#7a5236', e: 18 },
  tea: { n: 'چای', p: 40000, cat: 'drink', model: 'cup', col: '#b5482a', e: 12 },
  icecream: { n: 'بستنی قیفی', p: 60000, cat: 'food', model: 'cone', col: '#ffd0dc', e: 14 },
  chips: { n: 'چیپس', p: 40000, cat: 'food', model: 'bag', col: '#f2c84a', e: 10 },
  choco: { n: 'شکلات', p: 60000, cat: 'food', model: 'bar', col: '#5a3422', e: 12 },
  sandwich: { n: 'ساندویچ مرغ', p: 250000, cat: 'food', model: 'sandwich', col: '#e3b46a', e: 35 },
  pizza: { n: 'پیتزا مخصوص', p: 450000, cat: 'food', model: 'pizza', col: '#e7a23a', e: 45 },
  kebab: { n: 'چلوکباب', p: 600000, cat: 'food', model: 'plate', col: '#a85a2a', e: 55 },
  bread: { n: 'نان سنگک تازه', p: 25000, cat: 'food', model: 'bread', col: '#c98a46', e: 18 },
  cake: { n: 'کیک شکلاتی', p: 90000, cat: 'food', model: 'cake', col: '#6a3a22', e: 20 },
  apple: { n: 'سیب قرمز', p: 20000, cat: 'food', model: 'fruit', col: '#c8202a', e: 9 },
  nuts: { n: 'آجیل مخلوط', p: 180000, cat: 'food', model: 'bag', col: '#b88a4a', e: 20 },
  vitamin: { n: 'قرص جوشان ویتامین C', p: 70000, cat: 'drink', model: 'can', col: '#ff8a1a', e: 25 },
  shirtBlue: { n: 'پیراهن آبی', p: 1200000, cat: 'wear', slot: 'shirt', model: 'shirt', col: '#2b5c9e' },
  shirtWhite: { n: 'پیراهن سفید', p: 1100000, cat: 'wear', slot: 'shirt', model: 'shirt', col: '#f0efe9' },
  shirtGreen: { n: 'تی‌شرت سبز', p: 650000, cat: 'wear', slot: 'shirt', model: 'shirt', col: '#2f7a4a' },
  shirtRed: { n: 'تی‌شرت قرمز', p: 650000, cat: 'wear', slot: 'shirt', model: 'shirt', col: '#b8222a' },
  shirtBlack: { n: 'هودی مشکی', p: 1600000, cat: 'wear', slot: 'shirt', model: 'shirt', col: '#1d1e22' },
  shirtYellow: { n: 'تی‌شرت زرد', p: 650000, cat: 'wear', slot: 'shirt', model: 'shirt', col: '#e8b923' },
  jacket: { n: 'کاپشن قهوه‌ای', p: 3800000, cat: 'wear', slot: 'shirt', model: 'shirt', col: '#5a3a24' },
  pantsJeans: { n: 'شلوار جین', p: 1500000, cat: 'wear', slot: 'pants', model: 'pants', col: '#2a3f66' },
  pantsBlack: { n: 'شلوار پارچه‌ای مشکی', p: 1300000, cat: 'wear', slot: 'pants', model: 'pants', col: '#1b1c20' },
  pantsKhaki: { n: 'شلوار کتان کرم', p: 1300000, cat: 'wear', slot: 'pants', model: 'pants', col: '#b9a47a' },
  trackRed: { n: 'سویشرت ورزشی قرمز', p: 1700000, cat: 'wear', slot: 'shirt', model: 'shirt', col: '#c42a2a' },
  trackPants: { n: 'شلوار ورزشی', p: 1100000, cat: 'wear', slot: 'pants', model: 'pants', col: '#23262c' },
  shoesWhite: { n: 'کتانی سفید', p: 2800000, cat: 'wear', slot: 'shoes', model: 'shoes', col: '#f4f4f4' },
  shoesBlack: { n: 'کفش چرم مشکی', p: 3500000, cat: 'wear', slot: 'shoes', model: 'shoes', col: '#141414' },
  shoesRed: { n: 'کتانی قرمز', p: 2600000, cat: 'wear', slot: 'shoes', model: 'shoes', col: '#c8202a' },
  shoesBlue: { n: 'کتانی آبی', p: 2600000, cat: 'wear', slot: 'shoes', model: 'shoes', col: '#2a5aa8' },
  capRed: { n: 'کلاه کپ قرمز', p: 450000, cat: 'wear', slot: 'cap', model: 'cap', col: '#b8222a' },
  capBlack: { n: 'کلاه کپ مشکی', p: 450000, cat: 'wear', slot: 'cap', model: 'cap', col: '#1b1c20' },
  capWhite: { n: 'کلاه کپ سفید', p: 450000, cat: 'wear', slot: 'cap', model: 'cap', col: '#eeeeea' },
  sunglasses: { n: 'عینک آفتابی', p: 1800000, cat: 'wear', slot: 'glasses', model: 'glasses', col: '#151515' },
  watch: { n: 'ساعت مچی', p: 6500000, cat: 'wear', slot: 'watch', model: 'watch', col: '#c9a24a' },
  backpack: { n: 'کوله‌پشتی', p: 2200000, cat: 'wear', slot: 'bag', model: 'backpack', col: '#2f5a8a' },
  backpackRed: { n: 'کوله‌پشتی قرمز', p: 2200000, cat: 'wear', slot: 'bag', model: 'backpack', col: '#a8282a' },
  headphones: { n: 'هدفون بی‌سیم', p: 3500000, cat: 'wear', slot: 'ears', model: 'headphones', col: '#e8e8e8' },
  phone: { n: 'گوشی موبایل', p: 38000000, cat: 'hold', model: 'phone', col: '#18191c' },
  umbrella: { n: 'چتر', p: 650000, cat: 'hold', model: 'umbrella', col: '#1d3a6b' },
  flowers: { n: 'دستهٔ گل رز', p: 900000, cat: 'hold', model: 'flowers', col: '#c8202a' },
  tulips: { n: 'دستهٔ گل لاله', p: 750000, cat: 'hold', model: 'flowers', col: '#f2c12e' },
  ball: { n: 'توپ فوتبال', p: 1100000, cat: 'hold', model: 'ball', col: '#f4f4f4' },
  skateboard: { n: 'اسکیت‌برد', p: 4500000, cat: 'hold', model: 'skate', col: '#d9661f' },
  balloon: { n: 'بادکنک', p: 80000, cat: 'hold', model: 'balloon', col: '#e8303a' },
  balloonBlue: { n: 'بادکنک آبی', p: 80000, cat: 'hold', model: 'balloon', col: '#2a6ad8' },
  book: { n: 'کتاب دیوان حافظ', p: 380000, cat: 'hold', model: 'book', col: '#7a2a2a' },
  novel: { n: 'رمان «بوف کور»', p: 290000, cat: 'hold', model: 'book', col: '#2a3a5a' },
  notebook: { n: 'دفترچه یادداشت', p: 120000, cat: 'hold', model: 'book', col: '#3a7a5a' },
  flashlight: { n: 'چراغ‌قوه', p: 750000, cat: 'hold', model: 'flashlight', col: '#2a2a2a' },
  perfume: { n: 'ادکلن', p: 4200000, cat: 'hold', model: 'perfume', col: '#d9b0e8' }
};
const fmtT = n => Math.round(n).toLocaleString('fa-IR') + ' تومان';
const EAT_LINES = { food: ['به به! چه خوشمزه‌ست!', 'آخیش، سیر شدم!', 'عالی بود!', 'دستش درد نکنه!'], drink: ['آخیش، چسبید!', 'به به! خنک شدم!', 'چه می‌چسبه!'] };
// geometry for an item: used for shop shelves (batched) and for the thing in your hand
let shelfLod = false;
function itemParts(id) {
  const it = ITEMS[id], c = it.col, B = (w, h, d) => new THREE.BoxGeometry(w, h, d), Cy = (r1, r2, h, s = 12) => new THREE.CylinderGeometry(r1, r2, h, shelfLod ? Math.min(s, 6) : s), S = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, shelfLod ? 6 : w, shelfLod ? 4 : h);
  switch (it.model) {
    case 'bottle': return [[Cy(0.035, 0.035, 0.22), 0, 0.11, 0, c, 'glossy'], [Cy(0.016, 0.03, 0.05), 0, 0.245, 0, c, 'glossy'], [Cy(0.017, 0.017, 0.02), 0, 0.28, 0, '#2a6ad8']];
    case 'can': return [[Cy(0.033, 0.033, 0.12, 14), 0, 0.06, 0, c, 'glossy'], [Cy(0.03, 0.03, 0.01, 14), 0, 0.125, 0, '#c8c8c8', 'metal']];
    case 'box': return [[B(0.07, 0.18, 0.05), 0, 0.09, 0, c], [Cy(0.005, 0.005, 0.06, 6), 0.02, 0.2, 0, '#ffffff']];
    case 'cup': return [[Cy(0.042, 0.033, 0.11, 14), 0, 0.055, 0, '#f4f0e8'], [Cy(0.044, 0.044, 0.015, 14), 0, 0.115, 0, c], [B(0.09, 0.035, 0.002), 0, 0.06, 0.04, c]];
    case 'cone': return [[new THREE.ConeGeometry(0.038, 0.13, 12), 0, 0.065, 0, '#d9a45a', 'flipY'], [S(0.042), 0, 0.15, 0, c]];
    case 'bag': return [[B(0.15, 0.21, 0.06), 0, 0.105, 0, c], [B(0.152, 0.03, 0.062), 0, 0.2, 0, '#ffffff']];
    case 'bar': return [[B(0.15, 0.022, 0.06), 0, 0.011, 0, c], [B(0.1, 0.024, 0.062), 0.02, 0.011, 0, '#c8202a']];
    case 'sandwich': return [[B(0.18, 0.03, 0.09), 0, 0.015, 0, c], [B(0.17, 0.02, 0.085), 0, 0.04, 0, '#6fae3a'], [B(0.18, 0.03, 0.09), 0, 0.062, 0, c]];
    case 'pizza': return [[B(0.32, 0.04, 0.32), 0, 0.02, 0, '#e8dcc0'], [Cy(0.14, 0.14, 0.012, 18), 0, 0.046, 0, c]];
    case 'plate': return [[Cy(0.17, 0.15, 0.02, 18), 0, 0.01, 0, '#f4f4f0'], [S(0.1, 12, 6), 0, 0.03, 0.03, '#f8f4e8', 'flat'], [B(0.18, 0.03, 0.035), 0, 0.04, -0.07, c]];
    case 'bread': return [[B(0.42, 0.025, 0.2), 0, 0.012, 0, c]];
    case 'cake': return [[Cy(0.09, 0.09, 0.07, 18), 0, 0.035, 0, c], [Cy(0.092, 0.092, 0.015, 18), 0, 0.075, 0, '#f4d0d8']];
    case 'fruit': return [[S(0.045), 0, 0.045, 0, c, 'glossy'], [Cy(0.004, 0.004, 0.03, 4), 0, 0.095, 0, '#4a3020']];
    case 'shirt': return [[B(0.32, 0.06, 0.26), 0, 0.03, 0, c], [B(0.12, 0.062, 0.05), 0, 0.031, 0.1, darkHex(c)]];
    case 'pants': return [[B(0.3, 0.07, 0.3), 0, 0.035, 0, c]];
    case 'shoes': return [[B(0.1, 0.08, 0.26), -0.06, 0.04, 0, c], [B(0.1, 0.08, 0.26), 0.06, 0.04, 0, c], [B(0.1, 0.02, 0.26), -0.06, 0.01, 0, '#e8e8e8'], [B(0.1, 0.02, 0.26), 0.06, 0.01, 0, '#e8e8e8']];
    case 'cap': return [[new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.0, 0, c], [B(0.17, 0.012, 0.1), 0, 0.006, 0.11, c]];
    case 'glasses': return [[B(0.15, 0.045, 0.012), 0, 0.03, 0, c, 'glossy'], [B(0.006, 0.006, 0.14), -0.074, 0.04, -0.07, c], [B(0.006, 0.006, 0.14), 0.074, 0.04, -0.07, c]];
    case 'watch': return [[new THREE.TorusGeometry(0.04, 0.008, 6, 16), 0, 0.04, 0, '#2a2a2a'], [Cy(0.022, 0.022, 0.012, 16), 0, 0.04, 0.04, c, 'metal', Math.PI / 2]];
    case 'backpack': return [[B(0.32, 0.42, 0.16), 0, 0.21, 0, c], [B(0.26, 0.18, 0.06), 0, 0.14, 0.1, darkHex(c)], [B(0.04, 0.4, 0.02), -0.1, 0.22, -0.09, '#1a1a1a'], [B(0.04, 0.4, 0.02), 0.1, 0.22, -0.09, '#1a1a1a']];
    case 'headphones': return [[new THREE.TorusGeometry(0.11, 0.012, 6, 20, Math.PI), 0, 0.02, 0, c], [Cy(0.045, 0.045, 0.035, 14), -0.11, 0.0, 0, '#202020', '', 0, 0, Math.PI / 2], [Cy(0.045, 0.045, 0.035, 14), 0.11, 0.0, 0, '#202020', '', 0, 0, Math.PI / 2]];
    case 'phone': return [[B(0.075, 0.15, 0.009), 0, 0.075, 0, c, 'glossy'], [B(0.068, 0.138, 0.002), 0, 0.075, 0.0055, '#3a7ad8', 'screen']];
    case 'umbrella': return [[Cy(0.045, 0.02, 0.62, 8), 0, 0.38, 0, c], [Cy(0.008, 0.008, 0.86, 6), 0, 0.43, 0, '#333333', 'metal'], [new THREE.TorusGeometry(0.04, 0.009, 6, 10, Math.PI), 0.04, 0.0, 0, '#3a2a1a']];
    case 'flowers': return [[new THREE.ConeGeometry(0.09, 0.32, 10, 1, true), 0, 0.12, 0, '#f4ece0', 'flipY'], [S(0.04), 0, 0.31, 0, c], [S(0.035), 0.05, 0.29, 0.02, c], [S(0.035), -0.05, 0.29, -0.01, c], [S(0.034), 0.01, 0.3, 0.05, c], [S(0.034), -0.02, 0.29, -0.05, c], [S(0.05, 6, 4), 0, 0.26, 0, '#3f7a2a', 'flat']];
    case 'ball': return [[new THREE.IcosahedronGeometry(0.11, 1), 0, 0.11, 0, c, 'flat'], [new THREE.IcosahedronGeometry(0.112, 0), 0, 0.11, 0, '#1a1a1a', 'wire']];
    case 'skate': return [[B(0.21, 0.025, 0.78), 0, 0.08, 0, c], [B(0.2, 0.004, 0.76), 0, 0.094, 0, '#1a1a1a'], ...[[-0.07, 0.27], [0.07, 0.27], [-0.07, -0.27], [0.07, -0.27]].map(([x, z]) => [Cy(0.028, 0.028, 0.03, 10), x, 0.03, z, '#f2e8c8', '', 0, 0, Math.PI / 2])];
    case 'balloon': return [[S(0.2, 14, 10), 0, 1.0, 0, c, 'glossy'], [Cy(0.003, 0.003, 0.8, 4), 0, 0.42, 0, '#eeeeee']];
    case 'book': return [[B(0.15, 0.22, 0.04), 0, 0.11, 0, c], [B(0.14, 0.21, 0.036), 0.006, 0.11, 0, '#f4ecd8']];
    case 'flashlight': return [[Cy(0.022, 0.018, 0.2, 10), 0, 0.1, 0, c, 'metal'], [Cy(0.03, 0.022, 0.05, 10), 0, 0.225, 0, '#3a3a3a', 'metal'], [Cy(0.026, 0.026, 0.004, 10), 0, 0.251, 0, '#fff8d8', 'screen']];
    case 'perfume': return [[B(0.06, 0.09, 0.035), 0, 0.045, 0, c, 'glossy'], [Cy(0.012, 0.012, 0.03, 8), 0, 0.105, 0, '#c9a24a', 'metal']];
  }
  return [[B(0.1, 0.1, 0.1), 0, 0.05, 0, c]];
}
function darkHex(c) { return '#' + new THREE.Color(c).multiplyScalar(0.6).getHexString(); }
// shelf display: merged into the static batch
function shelfItem(F, lx, ly, lz, id, ry = 0, sc = 1) {
  shelfLod = true; const parts = itemParts(id); shelfLod = false;
  for (const [g, x, y, z, col, kind, rx = 0, ry2 = 0, rz = 0] of parts) {
    if (kind === 'wire') continue;
    if (LOW && R() < 0.35 && sc < 1.05) return;
    if (kind === 'flipY') g.rotateX(Math.PI);
    const mat = kind === 'glossy' ? 'mallGloss' : kind === 'metal' ? 'mallMetal' : kind === 'screen' ? 'neon' : 'mallTrim';
    const [wx, wz] = fw(F, lx + (x * Math.cos(ry) + z * Math.sin(ry)) * sc, lz + (-x * Math.sin(ry) + z * Math.cos(ry)) * sc);
    BT.add(mat, g, wx, ly + y * sc, wz, F.a + ry + ry2, new THREE.Color(col).getHex(), rx, rz, sc, sc, sc);
  }
}
// a real mesh you hold or wear (re-used per item id)
const itemMeshCache = {};
const ItemMats = {};
function itemMesh(id) {
  if (itemMeshCache[id]) return itemMeshCache[id];
  if (!ItemMats.std) { ItemMats.std = new THREE.MeshStandardMaterial({ roughness: 0.6 }); ItemMats.glossy = new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0.1 }); ItemMats.metal = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.85 }); }
  const g = new THREE.Group();
  for (const [geo, x, y, z, col, kind, rx = 0, ry = 0, rz = 0] of itemParts(id)) {
    if (kind === 'flipY') geo.rotateX(Math.PI);
    let mat;
    if (kind === 'screen') mat = new THREE.MeshBasicMaterial({ color: col, toneMapped: false });
    else if (kind === 'wire') mat = new THREE.MeshStandardMaterial({ color: col, wireframe: true });
    else { mat = (ItemMats[kind] || ItemMats.std).clone(); mat.color.set(col); if (kind === 'flat') mat.flatShading = true; }
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m);
  }
  g.matrixAutoUpdate = false; itemMeshCache[id] = g; return g;
}

/* ---------- wallet, cart, bag and energy ---------- */
function addInv(id, n = 1) { store.inv[id] = (store.inv[id] || 0) + n; }
function takeInv(id) { if (!store.inv[id]) return false; if (--store.inv[id] <= 0) { delete store.inv[id]; for (const k in store.worn) if (store.worn[k] === id) delete store.worn[k]; if (store.held === id) store.held = null; } return true; }
function addToCart(id, shop) {
  store.cart.push({ id, shop }); Audio.tick();
  const n = store.cart.filter(c => c.shop === shop).length;
  toast(`«${ITEMS[id].n}» برداشتی (${fmtT(ITEMS[id].p)}) — ${fa(n)} قلم در سبد؛ برو صندوق حساب کن`); updateWalletHUD();
}
function payAt(shop, clerk) {
  const items = store.cart.filter(c => c.shop === shop);
  if (!items.length) { if (clerk) say(clerk, mpick(['چیزی انتخاب نکردی که! از قفسه‌ها بردار، بعد بیا اینجا.', 'هر چی خواستی بردار، من اینجام.']), 2.6); return; }
  const total = items.reduce((s, c) => s + ITEMS[c.id].p, 0);
  if (store.money < total) { if (clerk) say(clerk, 'ببخشید، موجودی کارتت کافی نیست!', 2.6); Audio.alarm(0.4); return; }
  store.money -= total; store.cart = store.cart.filter(c => c.shop !== shop);
  for (const c of items) addInv(c.id);
  Audio.beepPay(items.length);
  if (clerk) { say(clerk, mpick(['ممنون از خریدتون! مبارکه!', 'بفرمایید، رسیدتون. باز هم تشریف بیارید!', 'نوش جان! خوش اومدید.', 'کارتتون رو بکشید... تأیید شد. ممنون!']), 3); clerk.anim.talkT = 1.5; }
  banner('خرید انجام شد', `${fa(items.length)} قلم · ${fmtT(total)} — از «کیف» استفاده کن`);
  logEvent(`یکی ${items.map(c => ITEMS[c.id].n).join('، ')} خرید.`); store.stats.buys = (store.stats.buys || 0) + 1;
  updateWalletHUD(); saveGame();
}
let alarmCD = 0;
function shopAlarm(clerk) {
  if (simTime < alarmCD) return; alarmCD = simTime + 2.5;
  Audio.alarm(1); cam.shake = 0.15;
  if (clerk) { say(clerk, mpick(['آقا! لطفاً اول حساب کنید!', 'ببخشید! اجناس رو باید اول حساب کنید.', 'دزدگیر صدا داد! صندوق این طرفه.']), 3); clerk.anim.talkT = 1.4; }
  setPrompt('دزدگیر فروشگاه صدا داد! اول اجناس را در صندوق حساب کن.', '', 2.4);
}
// leaving a street shop through the door with unpaid things sets off the gate alarm
function cartBlocksExit() {
  if (interior.door && interior.door.kind === 'shop' && store.cart.some(c => c.shop === 'door:' + interior.key)) { shopAlarm(interior.npcs[0]); player.pos.z -= 0.4; player.vel.set(0, 0, -1); return true; }
  return false;
}

/* what you wear changes your actual look */
const WEAR_SLOTS = { shirt: 'پیراهن', pants: 'شلوار', shoes: 'کفش', cap: 'کلاه', glasses: 'عینک', watch: 'ساعت', bag: 'کوله', ears: 'هدفون' };
function computeLook() {
  const L = Object.assign({}, playerLook), w = store.worn;
  if (w.shirt) { L.shirt = ITEMS[w.shirt].col; L.coat = null; L.sleeves = w.shirt !== 'shirtGreen' && w.shirt !== 'shirtRed' && w.shirt !== 'shirtYellow'; }
  if (w.pants) L.pants = ITEMS[w.pants].col;
  if (w.shoes) L.shoes = ITEMS[w.shoes].col;
  if (w.cap) L.cap = ITEMS[w.cap].col; else if (store.capOff) L.cap = null;
  if (w.glasses) L.glasses = true;
  return L;
}
function rebuildPlayerLook() {
  const P = player, pool = P.pool, H0 = P.H; if (!pool) return;
  pool.detach(P); P.look = computeLook(); P.H = makeHuman(P.look, true); P.H.hideHead = H0.hideHead;
  P.H.root.position.copy(H0.root.position); P.H.root.rotation.copy(H0.root.rotation); pool.attach(P);
}
function wear(id) {
  const it = ITEMS[id]; if (!it || it.cat !== 'wear' || !store.inv[id]) return;
  const old = store.worn[it.slot]; store.worn[it.slot] = old === id ? undefined : id; if (!store.worn[it.slot]) delete store.worn[it.slot];
  if (it.slot === 'ears') Audio.music(!!store.worn.ears);
  rebuildPlayerLook(); Audio.cloth();
  say(player, store.worn[it.slot] ? mpick(['چطوره؟ بهم میاد؟', 'این خیلی قشنگه!', 'عالی شد!']) : 'درش آوردم.', 2);
  saveGame();
}

/* the thing in your hand and the things on your body follow the bones every frame */
const attach = { held: null, heldId: null, slots: {} };
const ATT = { // bone, offset, rotation
  bag: ['spine', [0, 0.26, -0.2], [0, Math.PI, 0]], ears: ['head', [0, 0.06, -0.005], [0, 0, 0]], watch: ['wrist', [0, 0.05, 0], [Math.PI / 2, 0, 0]]
};
const _am = new THREE.Matrix4(), _aq = new THREE.Quaternion(), _ae = new THREE.Euler(), _ap = new V3(), _as = new V3(1, 1, 1);
function boneOf(H, b) { return b === 'spine' ? H.spine : b === 'head' ? H.head : b === 'wrist' ? H.hd[0] : H.hd[1]; }
function placeAttach(obj, H, bone, off, rot, sc = 1) {
  _ae.set(rot[0], rot[1], rot[2]); _aq.setFromEuler(_ae); _am.compose(_ap.set(off[0], off[1], off[2]), _aq, _as.set(sc, sc, sc));
  obj.matrix.multiplyMatrices(boneOf(H, bone).matrixWorld, _am); obj.matrixWorldNeedsUpdate = true;
}
function heldPose(id) { // how each thing sits in the right hand
  const m = ITEMS[id] ? ITEMS[id].model : '';
  if (m === 'umbrella') return [[0, -0.04, 0.02], [Math.PI / 2, 0, 0]];
  if (m === 'balloon') return [[0, -0.05, 0], [0, 0, 0]];
  if (m === 'skate') return [[0.04, -0.05, 0.02], [0, 0, Math.PI / 2]];
  if (m === 'ball') return [[0, -0.16, 0.05], [0, 0, 0]];
  if (m === 'flowers' || m === 'cone' || m === 'flashlight') return [[0, -0.07, 0.03], [Math.PI / 2 - 0.2, 0, 0]];
  if (m === 'phone') return [[0, -0.08, 0.04], [Math.PI / 2 - 0.5, Math.PI, 0]];
  if (m === 'book') return [[0, -0.1, 0.06], [0.2, 0, 0]];
  return [[0, -0.09, 0.04], [Math.PI / 2 - 0.3, 0, 0]];
}
let flashLight = null, flashIn = null;
function updateAttachments() {
  const P = player, H = P.H, sc = zoneScene(P.where);
  const hideAll = P.state === 'car' || P.state === 'passenger' || P.state === 'entering' || P.state === 'exiting';
  // held item
  const hid = store.held && !hideAll && !(P.skate && ITEMS[store.held].model === 'skate') ? store.held : null;
  if (attach.heldId !== hid) { if (attach.held) attach.held.parent?.remove(attach.held); attach.held = hid ? itemMesh(hid) : null; attach.heldId = hid; }
  if (attach.held) {
    if (attach.held.parent !== sc) sc.add(attach.held);
    const [o, r] = heldPose(hid); placeAttach(attach.held, H, 'hand', o, r);
    attach.held.visible = !(hid === 'umbrella' && H.umb && H.umb.visible);
  }
  // worn accessories
  for (const slot of ['bag', 'ears', 'watch']) {
    const id = store.worn[slot] || null; let a = attach.slots[slot];
    if (!a || a.id !== id) { if (a && a.obj) a.obj.parent?.remove(a.obj); a = attach.slots[slot] = { id, obj: id ? itemMesh(id).clone() : null }; if (a.obj) a.obj.matrixAutoUpdate = false; }
    if (!a.obj) continue;
    if (a.obj.parent !== sc) sc.add(a.obj);
    a.obj.visible = !(slot === 'ears' && H.hideHead) && !(slot === 'bag' && hideAll);
    const [b, off, rot] = ATT[slot]; placeAttach(a.obj, H, b, off, rot);
  }
  // flashlight beam
  if (flashLight) { flashLight.intensity = 0; flashIn.intensity = 0; }
  if (hid === 'flashlight' && P.flashOn && flashLight) {
    const fl = P.where === 'in' ? flashIn : flashLight;
    fl.intensity = 60; _ap.setFromMatrixPosition(attach.held.matrix); fl.position.copy(_ap);
    const f = cam.fpOn ? cam.yaw : P.facing, pt = cam.fpOn ? cam.fpPitch : 0.25;
    fl.target.position.set(_ap.x + Math.sin(f) * Math.cos(pt) * 5, _ap.y - Math.sin(pt) * 5, _ap.z + Math.cos(f) * Math.cos(pt) * 5); fl.target.updateMatrixWorld();
  }
}

/* ---------- using things ---------- */
function consume(id) {
  const it = ITEMS[id]; if (!takeInv(id)) return;
  const drink = it.cat === 'drink';
  if (player.state === 'foot') startUse(drink ? 'drink' : 'eat', player.pos.x, player.pos.y, player.pos.z, player.facing, null, null, 2.6);
  player.useItem = id; player.useItemT = 2.6;
  store.energy = Math.min(100, store.energy + (it.e || 10));
  setTimeout(() => say(player, mpick(EAT_LINES[drink ? 'drink' : 'food']), 2), 1200);
  Audio.burst(0.05, drink ? 900 : 1600, 0.25, 'bandpass', 2);
  updateWalletHUD(); saveGame();
}
function hold(id) {
  if (store.held === id) { store.held = null; if (player.skate) stopSkate(); }
  else { store.held = id; if (player.skate && id !== 'skateboard') stopSkate(); }
  player.flashOn = false; Audio.cloth(); updateUseBtn(); saveGame();
}
function useHeld() {
  const id = store.held, P = player; if (!id) return;
  const m = ITEMS[id].model;
  if (m === 'phone') takePhoto();
  else if (m === 'book') { if (P.state === 'foot') startUse('read', P.pos.x, P.pos.y, P.pos.z, P.facing, null, null); say(P, mpick(['«الا یا ایها الساقی، ادر کأساً و ناولها...»', 'چه کتاب خوبیه!', 'یه فصل دیگه بخونم...']), 3); }
  else if (m === 'flashlight') { P.flashOn = !P.flashOn; Audio.tick(); }
  else if (m === 'ball') { dropBall(); }
  else if (m === 'balloon') { releaseBalloon(id); }
  else if (m === 'skate') { if (P.skate) stopSkate(); else startSkate(); }
  else if (m === 'perfume') { P.perfumeT = simTime + 90; for (let k = 0; k < 18; k++) FX.emit(P.pos.x + Math.sin(P.facing) * 0.3, P.pos.y + 1.3, P.pos.z + Math.cos(P.facing) * 0.3, (Math.random() - 0.5) * 0.6, 0.2 + Math.random() * 0.3, (Math.random() - 0.5) * 0.6, 1.2, 0.05, 0.5, 0xe8d0ff, 0.5, 0.1); Audio.burst(0.06, 4500, 0.4, 'highpass', 1); say(P, 'به به! چه بوی خوبی!', 2); }
  else if (m === 'umbrella') { P.umbOpen = !P.umbOpen; Audio.cloth(); }
  else if (m === 'flowers') { const n = nearestNPC(P.where === 'out' ? allPeople() : interior.npcs, 2.8); if (n) giveFlowers(n); else say(P, 'چه بوی خوبی می‌دن! اینو به یکی هدیه می‌دم.', 2.4); }
  updateUseBtn();
}
function useLabel() {
  const id = store.held; if (!id) return '';
  const m = ITEMS[id].model, P = player;
  return { phone: 'عکس بگیر', book: 'بخون', flashlight: P.flashOn ? 'خاموش' : 'روشن', ball: 'شوت', balloon: 'ولش کن', skate: P.skate ? 'پیاده شو' : 'اسکیت', perfume: 'بزن', umbrella: P.umbOpen ? 'ببند' : 'باز کن', flowers: 'هدیه بده' }[m] || '';
}
function updateUseBtn() { const l = useLabel(); const b = $('b-use'); if (b) { b.hidden = !l || !touchUI; b.textContent = l || ''; } }
function giveFlowers(n) {
  const id = store.held; takeInv(id); store.held = null;
  const pp = n.persona; pp.rel = (pp.rel || 0) + 3; pp.mood = Math.min(1, (pp.mood || 0.5) + 0.4);
  if (chat.open && chat.npc === n) npcSpeak(n, mpick(['وای! این برای منه؟ خیلی ممنونم! چقدر قشنگه!', 'چه گل‌های قشنگی! دستت درد نکنه، خیلی خوشحالم کردی!']));
  else say(n, mpick(['وای! برای منه؟ مرسی!', 'چه قشنگه! ممنونم!', 'خیلی لطف کردی!']), 3);
  setSpecial(n, 'laugh', 1.6); logEvent(`یکی به ${pp.name} گل هدیه داد!`); updateUseBtn(); saveGame();
}
/* phone camera: a real screenshot of the game */
const photos = [];
function takePhoto() {
  render();
  let url = null; try { url = renderer.domElement.toDataURL('image/jpeg', 0.85); } catch (_) { }
  const f = $('flash'); f.style.transition = 'none'; f.style.opacity = '0.9'; requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = '0'; });
  Audio.shutter(); if (url) { photos.unshift(url); if (photos.length > 8) photos.pop(); }
  toast('عکس گرفته شد — از «کیف» می‌تونی ذخیره‌اش کنی');
}
/* skateboard */
let skateMesh = null;
function startSkate() { const P = player; if (P.state !== 'foot' || P.where !== 'out') { say(P, 'اینجا نمی‌شه اسکیت سواری کرد!', 2); return; } P.skate = true; P.skateV = Math.hypot(P.vel.x, P.vel.z); Audio.cloth(); say(P, 'بزن بریم!', 1.5); }
function stopSkate() { const P = player; P.skate = false; if (skateMesh) skateMesh.visible = false; }
function updateSkate(dt) {
  const P = player; if (!P.skate) { if (skateMesh) skateMesh.visible = false; return; }
  if (!skateMesh) { skateMesh = itemMesh('skateboard').clone(); skateMesh.matrixAutoUpdate = true; scene.add(skateMesh); }
  skateMesh.visible = P.where === 'out' && P.state === 'foot';
  skateMesh.position.set(P.pos.x, P.pos.y - 0.02 + (P.onGround ? 0 : 0.1), P.pos.z); skateMesh.rotation.set(P.onGround ? 0 : -0.3, P.facing, 0);
  const sp = Math.hypot(P.vel.x, P.vel.z); Audio.roll(P.onGround ? sp : 0);
}
/* football: a real rolling, bouncing ball you can kick around */
const balls = [];
function dropBall() {
  const P = player; takeInv('ball'); store.held = null;
  const f = cam.fpOn ? cam.yaw : P.facing;
  const b = { x: P.pos.x + Math.sin(f) * 0.6, y: P.pos.y + 0.9, z: P.pos.z + Math.cos(f) * 0.6, vx: Math.sin(f) * 9 + P.vel.x, vy: 3.5, vz: Math.cos(f) * 9 + P.vel.z, mesh: itemMesh('ball').clone(), spin: 0, where: P.where };
  b.mesh.matrixAutoUpdate = true; b.mesh.children.forEach(c => c.position.y -= 0.11); zoneScene(P.where).add(b.mesh); balls.push(b);
  Audio.thud(4, P.pos.x, P.pos.z); setSpecial(P, 'kick', 0.5); updateUseBtn(); saveGame();
}
function updateBalls(dt) {
  for (const b of balls) {
    const col = zoneCol(b.where); if (b.where !== player.where) { b.mesh.visible = false; continue; } b.mesh.visible = true;
    b.vy -= GRAV * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    col.query(b.x - 0.12, b.x + 0.12, b.z - 0.12, b.z + 0.12, _near);
    let g = b.where === 'out' ? groundH(b.x, b.z) : 0;
    for (const c of _near) {
      if (c.maxY <= b.y + 0.05 - 0.11) { if (c.maxY > g && colOver(c, b.x, b.z, 0)) g = c.maxY; continue; }
      if (c.minY > b.y + 0.11) continue;
      if (colPush(c, b.x, b.z, 0.11)) { const nx = _push.nx, nz = _push.nz; b.x += nx * _push.pen; b.z += nz * _push.pen; const vn = b.vx * nx + b.vz * nz; if (vn < 0) { b.vx -= 1.7 * vn * nx; b.vz -= 1.7 * vn * nz; if (-vn > 2) Audio.thud(-vn * 0.5, b.x, b.z); } }
    }
    if (b.y - 0.11 < g) { b.y = g + 0.11; if (b.vy < -1.5) { b.vy = -b.vy * 0.55; if (b.vy > 1.2) Audio.burst(0.08 * Audio.vol(b.x, b.z), 300, 0.12); } else b.vy = 0; const fr = Math.exp(-1.1 * dt); b.vx *= fr; b.vz *= fr; }
    // kicked by anyone running into it, pushed by cars
    for (const p of b.where === 'out' ? [player, ...npcs, ...mall.npcs] : b.where === 'rb' ? [player, ...rb.people] : [player, ...interior.npcs]) {
      if (p.inCar || (p === player && p.state !== 'foot')) continue;
      const dx = b.x - p.pos.x, dz = b.z - p.pos.z, d = Math.hypot(dx, dz); if (d > 0.42 || Math.abs(b.y - p.pos.y - 0.2) > 0.5 || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d, sp = Math.max(2.5, Math.hypot(p.vel.x, p.vel.z) * 1.8); b.vx = nx * sp + p.vel.x * 0.4; b.vz = nz * sp + p.vel.z * 0.4; b.vy = Math.max(b.vy, sp * 0.35); b.x = p.pos.x + nx * 0.43; b.z = p.pos.z + nz * 0.43;
      Audio.thud(sp * 0.6, b.x, b.z); if (p.npc && p.look.kid && Math.random() < 0.5) say(p, mpick(['گل!!', 'پاس بده!', 'شوت!']), 1.4);
    }
    if (b.where === 'out') for (const c of cars) { const r = carCircle(c, b.x, b.z, 0.11); if (r && b.y < c.y + 1.5) { b.x -= r.nx * r.depth; b.z -= r.nz * r.depth; b.vx = c.vx * 1.3 - r.nx * 3; b.vz = c.vz * 1.3 - r.nz * 3; b.vy = 2.5; } }
    const sp = Math.hypot(b.vx, b.vz); b.spin += sp * dt / 0.11;
    b.mesh.position.set(b.x, b.y, b.z); b.mesh.rotation.set(b.spin, Math.atan2(b.vx, b.vz), 0, 'YXZ');
    if (Math.abs(b.x) > BOUND + 40 || Math.abs(b.z) > BOUND + 40) { b.x = player.pos.x; b.z = player.pos.z; b.y = player.pos.y + 2; }
  }
}
function nearestBall() { for (const b of balls) if (b.where === player.where && Math.hypot(b.x - player.pos.x, b.z - player.pos.z) < 1.3 && Math.abs(b.y - player.pos.y) < 1) return b; return null; }
function pickBall(b) { b.mesh.parent?.remove(b.mesh); balls.splice(balls.indexOf(b), 1); addInv('ball'); store.held = 'ball'; Audio.tick(); updateUseBtn(); saveGame(); }
/* balloon floats away when you let go */
const floaters = [];
function releaseBalloon(id) {
  takeInv(id); store.held = null; const m = itemMesh(id).clone(); m.matrixAutoUpdate = true;
  _ap.setFromMatrixPosition(attach.held ? attach.held.matrix : player.H.root.matrixWorld); m.position.copy(_ap);
  zoneScene(player.where).add(m); floaters.push({ m, t: 0, vx: (Math.random() - 0.5) * 0.6, vz: (Math.random() - 0.5) * 0.6, where: player.where });
  say(player, 'خداحافظ بادکنک!', 1.6); updateUseBtn(); saveGame();
}
function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i]; f.t += dt; f.m.position.x += (f.vx + Math.sin(f.t * 1.3) * 0.3) * dt; f.m.position.z += f.vz * dt; f.m.position.y += (f.where === 'in' ? 0.25 : 1.6) * dt * Math.min(1, f.t); f.m.rotation.z = Math.sin(f.t * 2) * 0.15;
    if (f.where === 'in') f.m.position.y = Math.min(f.m.position.y, 1.85);
    if (f.t > 40 || f.where !== player.where) { f.m.parent?.remove(f.m); floaters.splice(i, 1); }
  }
}
/* energy: you get tired, food and sleep bring you back */
function updateEnergy(dt) {
  const P = player; let drain = 0.004;
  if (P.state === 'foot') { const sp = Math.hypot(P.vel.x, P.vel.z); drain = sp > 4 ? (P.skate ? 0.015 : 0.06) : sp > 0.5 ? 0.012 : 0.004; }
  else if (P.state === 'car') drain = 0.006;
  else if (P.state === 'use' && (P.use.kind === 'sit' || P.use.kind === 'lie')) drain = -0.05;
  store.energy = clamp(store.energy - drain * dt, 0, 100);
  if (store.energy < 12 && !P.tiredSaid) { P.tiredSaid = true; say(P, 'خیلی خسته و گرسنه‌ام... یه چیزی بخورم.', 3); setPrompt('انرژی‌ات کم است: یه چیزی بخور یا بخواب (از مغازه‌ها و پاساژ خرید کن)', '', 3); }
  if (store.energy > 30) P.tiredSaid = false;
}
let walletShown = '';
function updateWalletHUD() {
  const t = fmtT(store.money); if (t !== walletShown) { walletShown = t; $('money').textContent = t; }
  const nc = store.cart.length; $('cart').hidden = !nc; if (nc) $('cart').textContent = `سبد: ${fa(nc)} قلم · ${fmtT(store.cart.reduce((s, c) => s + ITEMS[c.id].p, 0))}`;
  const e = $('energy-bar'); if (e) { e.style.width = store.energy + '%'; e.style.background = store.energy > 40 ? 'var(--teal)' : store.energy > 15 ? 'var(--amber)' : 'var(--red)'; }
  const cnt = Object.values(store.inv).reduce((s, n) => s + n, 0); $('btn-bag').textContent = cnt ? `کیف (${fa(cnt)})` : 'کیف';
}
/* the bag panel */
function toggleBag(force) {
  const el = $('bag'); const open = force ?? el.hidden; el.hidden = !open; if (open) renderBag();
}
function renderBag() {
  $('bag-money').textContent = fmtT(store.money); $('bag-energy').textContent = fa(Math.round(store.energy)) + '٪';
  const list = $('bag-list'); list.textContent = '';
  const ids = Object.keys(store.inv);
  if (!ids.length) { const p = document.createElement('p'); p.className = 'bag-empty'; p.textContent = 'کیفت خالیه. برو پاساژ آزادی یا مغازه‌های شهر و یه چیزی بخر!'; list.appendChild(p); }
  for (const id of ids) {
    const it = ITEMS[id], row = document.createElement('div'); row.className = 'bag-row';
    const sw = document.createElement('span'); sw.className = 'bag-sw'; sw.style.background = it.col; row.appendChild(sw);
    const nm = document.createElement('div'); nm.className = 'bag-nm'; nm.innerHTML = `<b></b><small></small>`; nm.firstChild.textContent = it.n + (store.inv[id] > 1 ? ` ×${fa(store.inv[id])}` : '');
    const worn = it.cat === 'wear' && store.worn[it.slot] === id; nm.lastChild.textContent = worn ? 'پوشیده‌ای' : store.held === id ? 'دستته' : fmtT(it.p); row.appendChild(nm);
    const btn = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'gm-btn bag-b'; b.textContent = label; b.addEventListener('click', () => { fn(); renderBag(); updateWalletHUD(); }); row.appendChild(b); };
    if (it.cat === 'food') btn('بخور', () => { toggleBag(false); consume(id); });
    else if (it.cat === 'drink') btn('بنوش', () => { toggleBag(false); consume(id); });
    else if (it.cat === 'wear') btn(worn ? 'دربیار' : 'بپوش', () => wear(id));
    else btn(store.held === id ? 'بذار تو کیف' : 'دست بگیر', () => hold(id));
    list.appendChild(row);
  }
  const ph = $('bag-photos'); ph.textContent = '';
  photos.forEach((u, i) => { const a = document.createElement('a'); a.href = u; a.download = `shahr-azad-photo-${i + 1}.jpg`; const im = document.createElement('img'); im.src = u; im.alt = 'عکس'; a.appendChild(im); ph.appendChild(a); });
  $('bag-photos-h').hidden = !photos.length;
  $('bag-cap').hidden = !(playerLook.cap && !store.worn.cap); $('bag-cap').textContent = store.capOff ? 'کلاه خودم رو بذار' : 'کلاه خودم رو بردار';
}

/* ============================================================
   Azadi shopping mall: two floors around a skylit atrium, escalators,
   sliding glass doors, fourteen shops, a food court and shoppers
   ============================================================ */
const mall = { x0: 58, x1: 100, z0: -22, z1: 22, y0: CURB, FH: 5, shops: [], npcs: [], staff: [], esc: [], doors: [], seats: [], nodes: [[], []], obs: [[], []], lamps: [] };
mall.yU = mall.y0 + mall.FH; mall.yR = mall.y0 + 2 * mall.FH + 0.2;
const UNIT = [58.2, 68.6, 79.0, 89.4, 99.8];
const MALL_SHOPS = [
  { id: 'hyper', name: 'هایپرمارکت آزادی', color: '#1f6f4a', floor: 0, side: 1, u: [0, 1], type: 'market', clerk: 'صندوقدار' },
  { id: 'flower', name: 'گل‌فروشی بهارنارنج', color: '#a33b6b', floor: 0, side: 1, u: [2], type: 'flowers', clerk: 'گل‌فروش' },
  { id: 'cafe', name: 'کافه آسمان', color: '#6b3a1f', floor: 0, side: 1, u: [3], type: 'cafe', clerk: 'باریستا' },
  { id: 'digi', name: 'دیجیتال پیام', color: '#1f4a6b', floor: 0, side: -1, u: [0], type: 'digital', clerk: 'فروشندهٔ موبایل' },
  { id: 'shoe', name: 'کفش گام نو', color: '#6b2a2a', floor: 0, side: -1, u: [1], type: 'shoes', clerk: 'فروشندهٔ کفش' },
  { id: 'cloth', name: 'پوشاک آرمان', color: '#3a3a6b', floor: 0, side: -1, u: [2], type: 'clothes', clerk: 'فروشندهٔ لباس' },
  { id: 'optic', name: 'عینک و ساعت زمان', color: '#2a2a2a', floor: 0, side: -1, u: [3], type: 'optic', clerk: 'فروشنده' },
  { id: 'toy', name: 'اسباب‌بازی و ورزشی شادی', color: '#b0451f', floor: 1, side: 1, u: [0], type: 'toys', clerk: 'فروشنده' },
  { id: 'book', name: 'شهر کتاب پرسه', color: '#4b2a6b', floor: 1, side: 1, u: [1], type: 'books', clerk: 'کتاب‌فروش' },
  { id: 'food', name: 'فودکورت', color: '#8b2a3a', floor: 1, side: 1, u: [2, 3], type: 'food', clerk: 'آشپز' },
  { id: 'hat', name: 'کلاه و کیف آوا', color: '#7a5a1f', floor: 1, side: -1, u: [0], type: 'hats', clerk: 'فروشنده' },
  { id: 'perfume', name: 'عطر رایحه', color: '#6b1f5a', floor: 1, side: -1, u: [1], type: 'perfume', clerk: 'فروشندهٔ عطر' },
  { id: 'sport', name: 'پوشاک ورزشی قهرمان', color: '#1f5f8b', floor: 1, side: -1, u: [2], type: 'sport', clerk: 'فروشنده' },
  { id: 'arcade', name: 'گیم‌سنتر ستاره', color: '#5a1f8b', floor: 1, side: -1, u: [3], type: 'arcade', clerk: 'مسئول گیم‌سنتر' }
];
function mBox(mat, x0, x1, y0, y1, z0, z1, color, col, o = {}) {
  BT.add(mat, boxGeo(x1 - x0, y1 - y0, z1 - z0, o.ts || 0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, color);
  if (col) CL.box(x0, x1, z0, z1, o.minY ?? y0, o.maxY ?? y1);
  if (o.obs !== undefined) mall.obs[o.obs].push([x0, z0, x1, z1]);
}
const inMall = (x, z, m = 0) => x > mall.x0 - m && x < mall.x1 + m && z > mall.z0 - m && z < mall.z1 + m;
const mallFloorAt = y => y > mall.y0 + mall.FH * 0.5 ? 1 : 0;
function adTexture(lines, bg, fg) {
  const c = mkCanvas(512, 768), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 768); gr.addColorStop(0, bg[0]); gr.addColorStop(1, bg[1]); g.fillStyle = gr; g.fillRect(0, 0, 512, 768);
  g.fillStyle = 'rgba(255,255,255,0.12)'; for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(Math.random() * 512, Math.random() * 768, 40 + Math.random() * 120, 0, 7); g.fill(); }
  g.fillStyle = fg; g.textAlign = 'center'; g.direction = 'rtl'; g.textBaseline = 'middle';
  lines.forEach(([t, sz], i) => { g.font = `${sz}px Lalezar, Vazirmatn, Tahoma`; g.fillText(t, 256, 200 + i * (sz + 40), 470); });
  const tex = toTex(c); tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; return tex;
}
function adPanel(x, y, z, a, w, h, tex) {
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35, roughness: 0.4 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = a; scene.add(m); world.signMats.push(mat); return m;
}
function buildMall() {
  const { x0, x1, z0, z1, y0, yU, yR } = mall, FT = 0.3;
  mall.cx = (x0 + x1) / 2;
  // floors and slabs
  BT.add('mallFloor', quadUp(x0, z0, x1, z1, y0 + 0.012, 3), 0, 0, 0, 0, 0xffffff);
  const slab = (ax0, ax1, az0, az1) => { mBox('mallCeil', ax0, ax1, yU - FT, yU - 0.01, az0, az1, 0xf2efe9, true, { maxY: yU }); BT.add('mallFloor', quadUp(ax0, az0, ax1, az1, yU, 3), 0, 0, 0, 0, 0xffffff); };
  slab(x0, x1, 5, z1); slab(x0, x1, z0, -5); slab(x0, 64, -5, 5); slab(92, x1, -5, 5);
  // void edges: fascia + glass balustrade + steel handrail
  const rail = (ax0, ax1, az0, az1) => { mBox('clearGlass', ax0, ax1, yU, yU + 1.05, az0, az1, 0xcfe8f0, true, { obs: 1 }); mBox('mallMetal', ax0 - 0.02, ax1 + 0.02, yU + 1.05, yU + 1.11, az0 - 0.03, az1 + 0.03, 0xc8ccd0); mBox('mallTrim', ax0, ax1, yU - 0.6, yU, az0, az1, 0xe8e2d8); };
  rail(64, 92, 4.95, 5.05); rail(64, 92, -5.05, -4.95); rail(91.95, 92.05, -5, 5); rail(63.95, 64.05, -5, -1.75); rail(63.95, 64.05, 1.75, 5);
  mall.obs[1].push([64, -5, 92, 5]);
  // roof with a skylight over the atrium
  const roof = (ax0, ax1, az0, az1) => mBox('mallCeil', ax0, ax1, yR - 0.35, yR, az0, az1, 0xf4f2ee);
  roof(x0, x1, 5, z1); roof(x0, x1, z0, -5); roof(x0, 64, -5, 5); roof(92, x1, -5, 5);
  BT.add('trim', boxGeo(x1 - x0 + 0.6, 0.6, 0.4), (x0 + x1) / 2, yR + 0.3, z1 + 0.1, 0, 0xd8d2c6); BT.add('trim', boxGeo(x1 - x0 + 0.6, 0.6, 0.4), (x0 + x1) / 2, yR + 0.3, z0 - 0.1, 0, 0xd8d2c6);
  BT.add('trim', boxGeo(0.4, 0.6, z1 - z0), x0 - 0.1, yR + 0.3, 0, 0, 0xd8d2c6); BT.add('trim', boxGeo(0.4, 0.6, z1 - z0), x1 + 0.1, yR + 0.3, 0, 0, 0xd8d2c6);
  BT.add('clearGlass', boxGeo(28, 0.04, 10), 78, yR - 0.05, 0, 0, 0xd8f0ff);
  for (let x = 64; x <= 92.01; x += 3.5) mBox('mallMetal', x - 0.06, x + 0.06, yR - 0.2, yR, -5, 5, 0x9aa2aa);
  for (const z of [-5, -2.5, 0, 2.5, 5]) mBox('mallMetal', 64, 92, yR - 0.16, yR - 0.04, z - 0.05, z + 0.05, 0x9aa2aa);
  for (let k = 0; k < 4; k++) BT.add('metal', boxGeo(1.4, 0.8, 1.1), rr(x0 + 3, x1 - 3), yR + 0.4, pick([-14, 14, -18, 18]), 0, 0xb7bbbf);
  // ceiling light panels on both floors
  for (const fy of [yU - FT - 0.02, yR - 0.37]) for (let x = 60.5; x < 99; x += 4.2) for (const z of [-17, -9.5, 9.5, 17]) { BT.add('mallLamp', boxGeo(1.6, 0.04, 0.5), x, fy, z, 0, 0xffffff); }
  for (let x = 60; x < 64; x += 2) for (const z of [-3, 0, 3]) BT.add('mallLamp', boxGeo(0.5, 0.04, 0.5), x + 1, yR - 0.37, z, 0, 0xffffff);
  // columns around the atrium
  for (const x of [64, 71, 78, 85, 92]) for (const z of [-5.4, 5.4]) { mBox('mallTrim', x - 0.3, x + 0.3, y0, yR - 0.35, z - 0.3, z + 0.3, 0xece8e0, true, { obs: 0 }); mall.obs[1].push([x - 0.3, z - 0.3, x + 0.3, z + 0.3]); }
  // outer walls (stone outside, lit plaster inside)
  const outer = (ax0, ax1, az0, az1, ins) => { mBox('plaster', ax0, ax1, 0, yR, az0, az1, 0xd9cdb8, true, { ts: 3 }); BT.add('mallWall', boxGeo(Math.max(0.02, ax1 - ax0 - (ins[0] ? 0.3 : 0)), yR - y0 - 0.4, Math.max(0.02, az1 - az0 - (ins[1] ? 0.3 : 0)), 3), (ax0 + ax1) / 2 + ins[0], y0 + (yR - y0 - 0.4) / 2, (az0 + az1) / 2 + ins[1], 0, 0xf1ece4); };
  outer(x0, x1, z1 - 0.3, z1, [0, -0.16]); outer(x0, x1, z0, z0 + 0.3, [0, 0.16]);
  for (const zz of [[13, z1 - 0.3], [z0 + 0.3, -13]]) { mBox('plaster', x0, x0 + 0.3, 0, yR, zz[0], zz[1], 0xd9cdb8, true); mBox('plaster', x1 - 0.3, x1, 0, yR, zz[0], zz[1], 0xd9cdb8, true); }
  for (const fx of [[x0, 1], [x1, -1]]) { // glass curtain walls with an entrance on each end
    const X = fx[0] + fx[1] * 0.15, inward = fx[1];
    for (const seg of [[-13, -2.3], [2.3, 13]]) { BT.add('clearGlass', boxGeo(0.06, yR - 0.4, seg[1] - seg[0]), X, (yR - 0.4) / 2, (seg[0] + seg[1]) / 2, 0, 0xcfe4ee); CL.box(X - 0.15, X + 0.15, seg[0], seg[1], 0, yR); }
    BT.add('clearGlass', boxGeo(0.06, yR - 3.1 - 0.4, 4.6), X, 3.1 + (yR - 3.5) / 2, 0, 0, 0xcfe4ee); CL.box(X - 0.15, X + 0.15, -2.3, 2.3, y0 + 2.75, yR);
    for (let z = -13; z <= 13.01; z += 2.6) BT.add('mallMetal', boxGeo(0.12, yR - 0.4, 0.1), X, (yR - 0.4) / 2, z, 0, 0x3a3f46);
    for (const y of [y0 + 2.8, yU - 0.15, yU + 2.6]) BT.add('mallMetal', boxGeo(0.14, 0.12, 26), X, y, 0, 0, 0x3a3f46);
    // canopy over the doors
    const cx = fx[0] - inward * 1.9;
    BT.add('mallMetal', boxGeo(3.8, 0.28, 8.5), cx, y0 + 3.35, 0, 0, 0x2f343a); BT.add('mallLamp', boxGeo(3.2, 0.03, 7.8), cx, y0 + 3.2, 0, 0, 0xffffff);
    for (const z of [-3.9, 3.9]) { BT.add('mallMetal', GEO.cyl, fx[0] - inward * 3.6, y0 + 1.7, z, 0, 0x2f343a, 0, 0, 0.1, 3.4, 0.1); CL.circle(fx[0] - inward * 3.6, z, 0.12, 0, 3.4); }
    // sliding doors
    const dm = new THREE.MeshStandardMaterial({ color: 0xcfe4ee, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.3, depthWrite: false }), fm = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.35, metalness: 0.8 });
    const panels = [-1, 1].map(s => { const g = new THREE.Group(); const gl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.55, 2.2), dm); gl.position.y = 1.35; g.add(gl); for (const yy of [0.06, 2.64]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 2.24), fm); b.position.y = yy; g.add(b); } for (const zz of [-1.08, 1.08]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.66, 0.07), fm); b.position.set(0, 1.35, zz); g.add(b); } g.position.set(X, y0, s * 1.1); scene.add(g); return g; });
    const col = CL.box(X - 0.15, X + 0.15, -2.3, 2.3, 0, y0 + 2.75);
    mall.doors.push({ x: X, panels, col, open: 0, inward });
    BT.add('fabric', boxGeo(2.4, 0.015, 3.6), fx[0] + inward * 1.6, y0 + 0.02, 0, 0, 0x3a3a3a);
  }
  // big facade signs and adverts
  for (const [x, a] of [[x0 - 0.2, -Math.PI / 2], [x1 + 0.2, Math.PI / 2]]) makeSign(mkFrame(x, 0, a), 0, yR - 1.4, 0, 'مرکز خرید آزادی', 15, '#14324f', '#ffd27a');
  adPanel(x0 - 0.18, yU + 1, 17.5, -Math.PI / 2, 6, 9, adTexture([['حراج بزرگ', 120], ['پاییزه', 120], ['تا ۵۰٪', 150], ['تخفیف', 110]], ['#c2341f', '#7a1410'], '#fff4d8'));
  adPanel(x0 - 0.18, yU + 1, -17.5, -Math.PI / 2, 6, 9, adTexture([['گوشی‌های', 96], ['جدید رسید!', 96], ['دیجیتال پیام', 110], ['طبقهٔ همکف', 70]], ['#1a3f6b', '#0c1f36'], '#e8f4ff'));
  adPanel(x1 + 0.18, yU + 1, 17.5, Math.PI / 2, 6, 9, adTexture([['فودکورت', 130], ['طبقهٔ اول', 90], ['پیتزا · کباب', 80], ['بستنی', 90]], ['#e8a23a', '#a85a1a'], '#2a1608'));
  adPanel(x1 + 0.18, yU + 1, -17.5, Math.PI / 2, 6, 9, adTexture([['گیم‌سنتر', 120], ['ستاره', 120], ['هر روز', 80], ['تا ساعت ۲۳', 80]], ['#5a1f8b', '#1f0a36'], '#ffd8ff'));
  world.foot.push([x0, z0, x1, z1, '#c9bba6']);
  // plaza in front: planters, bike rack, flag poles
  for (const side of [-1, 1]) {
    for (const z of [-9, 9]) { BT.add('trim', boxGeo(2.2, 0.6, 2.2), x0 - 4.8, y0 + 0.3, z, 0, 0x8a8378); CL.box(x0 - 5.9, x0 - 3.7, z - 1.1, z + 1.1, 0, y0 + 0.6); bush(x0 - 4.8, z, 1.0, y0 + 0.6); }
    const fx = side < 0 ? x0 - 6.5 : x1 + 6.5;
    for (const z of [-6, 0, 6]) { BT.add('metal', GEO.cyl, fx, y0 + 4, z + 14 * (side < 0 ? 1 : 0) - 7 * (side < 0 ? 1 : 0), 0, 0xd8d8d8, 0, 0, 0.05, 8, 0.05); }
  }
  for (let k = 0; k < 6; k++) { const z = -16 + k * 0.7; BT.add('metal', new THREE.TorusGeometry(0.35, 0.025, 6, 14, Math.PI), x0 - 2.2, y0 + 0.02, z, Math.PI / 2, 0x3a3f46); }
  // atrium features (ground floor): fountain with seating ring, planters, info kiosk, ATM
  { const fxx = 84, R0 = 2.4;
    BT.add('mallTrim', new THREE.CylinderGeometry(R0, R0 + 0.1, 0.5, 32), fxx, y0 + 0.25, 0, 0, 0xd8d0c4); CL.circle(fxx, 0, R0, 0, y0 + 0.5); mall.obs[0].push([fxx - R0, -R0, fxx + R0, R0]);
    const wm = new THREE.Mesh(new THREE.CircleGeometry(R0 - 0.15, 32), new THREE.MeshStandardMaterial({ color: 0x3a8ab8, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 })); wm.rotation.x = -Math.PI / 2; wm.position.set(fxx, y0 + 0.42, 0); scene.add(wm); waterMeshes.push(wm);
    BT.add('mallTrim', new THREE.CylinderGeometry(0.35, 0.5, 1.4, 16), fxx, y0 + 0.9, 0, 0, 0xe8e2d8); 
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + 0.2; mall.seats.push({ x: fxx + Math.cos(a) * (R0 + 0.1), z: Math.sin(a) * (R0 + 0.1), y: y0 + 0.04, ry: Math.atan2(Math.cos(a), Math.sin(a)), roofed: true, floor: 0, edge: true }); }
  }
  for (const [x, z] of [[61, 9], [61, -9], [97, 9], [97, -9]]) { BT.add('mallTrim', new THREE.CylinderGeometry(0.75, 0.6, 0.8, 18), x, y0 + 0.4, z, 0, 0x8a7a6a); CL.circle(x, z, 0.75, 0, y0 + 0.8); mall.obs[0].push([x - 0.8, z - 0.8, x + 0.8, z + 0.8]); for (let k = 0; k < 7; k++) BT.add('foliage', pick(GEO.ico), x + rr(-0.35, 0.35), y0 + 1.2 + k * 0.28, z + rr(-0.35, 0.35), R() * 6, pick(FOLIAGE), 0, 0, 0.55, 0.6, 0.55); BT.add('bark', GEO.cyl, x, y0 + 1.5, z, 0, 0x5a4030, 0, 0, 0.06, 1.6, 0.06); }
  for (const [x, z, fl] of [[80, 9.5, 1], [80, -9.5, 1], [96, 2.5, 1], [61, 2.5, 1]]) { const y = fl ? yU : y0; BT.add('mallTrim', new THREE.CylinderGeometry(0.45, 0.38, 0.7, 14), x, y + 0.35, z, 0, 0x6a5a4a); CL.circle(x, z, 0.45, y, y + 0.7); mall.obs[fl].push([x - 0.5, z - 0.5, x + 0.5, z + 0.5]); for (let k = 0; k < 5; k++) BT.add('foliage', pick(GEO.ico), x + rr(-0.2, 0.2), y + 0.9 + k * 0.17, z + rr(-0.2, 0.2), R() * 6, pick(FOLIAGE), 0, 0, 0.35, 0.4, 0.35); }
  // benches along the corridors
  for (const fl of [0, 1]) for (const [x, z] of [[67, 8.6], [74, -8.6], [88, 8.6], [95, -8.6]]) {
    const y = fl ? yU : y0, ry = z > 0 ? 0 : Math.PI;
    BT.add('mallWood', boxGeo(2.0, 0.08, 0.6), x, y + 0.45, z, ry, 0x8a5a32); BT.add('mallMetal', boxGeo(1.9, 0.4, 0.5), x, y + 0.2, z, ry, 0x30343a);
    CL.box(x - 1.0, x + 1.0, z - 0.3, z + 0.3, y, y + 0.5); mall.obs[fl].push([x - 1, z - 0.3, x + 1, z + 0.3]);
    for (const dx of [-0.5, 0.5]) mall.seats.push({ x: x + dx, z, y: y + 0.02, ry: z > 0 ? Math.PI : 0, roofed: true, floor: fl });
  }
  // info desk + ATM
  BT.add('mallWood', new THREE.CylinderGeometry(1.1, 1.1, 1.05, 24, 1, false, 0, Math.PI * 1.4), 97.2, y0 + 0.52, -2, 0, 0xe8e2d8); CL.circle(97.2, -2, 1.1, 0, y0 + 1.05); mall.obs[0].push([96, -3.2, 98.4, -0.8]);
  makeSign(mkFrame(97.2, -0.6, -Math.PI / 2), 0, y0 + 2.6, 0, 'اطلاعات', 2.2, '#1f4a6b', '#ffffff');
  BT.add('mallMetal', boxGeo(0.8, 1.9, 0.6), 99.4, y0 + 0.95, 4, 0, 0x2a3a4a); BT.add('neon', boxGeo(0.02, 0.35, 0.45), 99.0, y0 + 1.35, 4, 0, 0x6fb6ff); CL.box(99, 99.8, 3.7, 4.3, 0, y0 + 2);
  world.uses.push({ x: 98.6, y: y0, z: 4, r: 1.1, act: 'کارت', label: () => `عابربانک — موجودی کارتت: <b>${fmtT(store.money)}</b>`, use: () => { Audio.beepPay(1); toast('موجودی کارت: ' + fmtT(store.money)); } });
  buildEscalators();
  // shops
  for (const s of MALL_SHOPS) buildMallShop(s);
  // directory boards
  for (const [x, z, fl] of [[60.5, -4.5, 0], [96.5, 4.5, 1]]) { const y = fl ? yU : y0; BT.add('mallMetal', boxGeo(0.12, 2.0, 1.4), x, y + 1.0, z, 0, 0x2a2f36); const t = adTexture([['راهنمای پاساژ', 70], ['همکف: هایپرمارکت، کافه،', 34], ['گل، دیجیتال، کفش، لباس، عینک', 32], ['طبقهٔ اول: فودکورت، کتاب،', 34], ['اسباب‌بازی، کلاه، عطر، گیم‌سنتر', 32]], ['#16324f', '#0b1a2b'], '#ffffff'); adPanel(x + (fl ? -0.07 : 0.07), y + 1.1, z, fl ? -Math.PI / 2 : Math.PI / 2, 1.25, 1.85, t); CL.box(x - 0.1, x + 0.1, z - 0.7, z + 0.7, y, y + 2); }
  buildMallGraph();
}
/* two escalators: up (south lane) and down (north lane) between the atrium floor and the west gallery */
function buildEscalators() {
  const { y0, FH } = mall, xb = 73.66, xt = 65.0, run = xb - xt, ang = Math.atan2(FH, run), Ls = Math.hypot(run, FH);
  for (const [zc, dir] of [[-0.95, 1], [0.95, -1]]) {
    // ramp colliders (thin steps make a smooth slope you stand on)
    const n = 34; for (let i = 0; i < n; i++) { const xa = xt + run * i / n, xb2 = xt + run * (i + 1) / n, y = y0 + FH * (1 - (i + 0.5) / n); CL.box(xa, xb2, zc - 0.5, zc + 0.5, y - 0.35, y); }
    CL.box(xb, xb + 0.9, zc - 0.5, zc + 0.5, y0, y0 + 0.02); CL.box(xt - 1.0, xt, zc - 0.5, zc + 0.5, y0 + FH - 0.2, y0 + FH);
    // the space under the high end is the truss
    CL.box(xt, xt + run * 0.62, zc - 0.62, zc + 0.62, 0, y0 + FH * 0.36);
    for (const s of [-1, 1]) {
      const z = zc + s * 0.6;
      CL.box(xt - 0.9, xb + 0.9, z - 0.05, z + 0.05, -1, y0 + FH + 1.0);
      // balustrade glass, handrail, side skirt
      BT.add('clearGlass', boxGeo(Ls, 0.85, 0.03), (xt + xb) / 2, y0 + FH / 2 + 0.55, z, 0, 0xd8f0ff, 0, -ang);
      BT.add('trim', boxGeo(Ls + 0.4, 0.07, 0.09), (xt + xb) / 2, y0 + FH / 2 + 1.0, z, 0, 0x151515, 0, -ang);
      BT.add('mallMetal', boxGeo(Ls, 0.5, 0.08), (xt + xb) / 2, y0 + FH / 2 - 0.05, z, 0, 0xb8bec4, 0, -ang);
      for (const [x, y] of [[xb + 0.6, y0 + 0.55], [xt - 0.6, y0 + FH + 0.55]]) { BT.add('clearGlass', boxGeo(1.2, 0.85, 0.03), x, y, z, 0, 0xd8f0ff); BT.add('trim', boxGeo(1.25, 0.07, 0.09), x, y + 0.45, z, 0, 0x151515); }
    }
    BT.add('mallMetal', boxGeo(Ls, 0.9, 1.3), (xt + xb) / 2, y0 + FH / 2 - 0.62, zc, 0, 0xa8aeb4, 0, -ang);
    for (const [x, y] of [[xb + 0.45, y0 + 0.015], [xt - 0.5, y0 + FH + 0.015]]) BT.add('mallMetal', boxGeo(0.9, 0.02, 1.05), x, y, zc, 0, 0x8a9096);
    // moving steps
    const steps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.18, 1.0), new THREE.MeshStandardMaterial({ color: 0x55595e, roughness: 0.5, metalness: 0.7 }), 40);
    steps.castShadow = false; steps.receiveShadow = true; steps.frustumCulled = false; scene.add(steps);
    const yel = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.005, 1.0), new THREE.MeshBasicMaterial({ color: 0xe8c020 }), 40); yel.frustumCulled = false; scene.add(yel);
    mall.esc.push({ zc, dir, xb, xt, run, ang, Ls, steps, yel, t: 0 });
  }
  mall.obs[0].push([xt - 1.2, -1.75, xb + 1.0, 1.75]);
}
const ESC_SPEED = 0.55;
function escHeight(e, x) { const { y0, FH } = mall; if (x >= e.xb) return y0; if (x <= e.xt) return y0 + FH; return y0 + FH * (e.xb - x) / e.run; }
function updateEscalators(dt) {
  const m4 = _m4, cp = camera.position; if (Math.abs(cp.x - 79) > 150 || Math.abs(cp.z) > 150) return;
  for (const e of mall.esc) {
    e.t += dt * ESC_SPEED;
    const L = 1.0 + e.Ls + 1.0, gap = 0.42, n = Math.min(40, Math.floor(L / gap));
    for (let k = 0; k < n; k++) {
      let s = ((k * gap + e.t * e.dir) % L + L) % L; // distance from the bottom
      let x, y;
      if (s < 1.0) { x = e.xb + 1.0 - s; y = mall.y0 - 0.08; }
      else if (s < 1.0 + e.Ls) { const u = (s - 1.0) / e.Ls; x = e.xb - u * e.run; y = mall.y0 + u * mall.FH - 0.08; y = Math.max(mall.y0 - 0.08, y); }
      else { x = e.xt - (s - 1.0 - e.Ls); y = mall.y0 + mall.FH - 0.08; }
      m4.makeTranslation(x, y, e.zc); e.steps.setMatrixAt(k, m4); m4.makeTranslation(x - 0.18, y + 0.093, e.zc); e.yel.setMatrixAt(k, m4);
    }
    e.steps.count = e.yel.count = n; e.steps.instanceMatrix.needsUpdate = e.yel.instanceMatrix.needsUpdate = true;
  }
}
// standing on an escalator carries you along
function escalatorCarry(p, dt) {
  if (!p.onGround || p.pos.x < 63.5 || p.pos.x > 75 || Math.abs(p.pos.z) > 1.6) return null;
  for (const e of mall.esc) {
    if (Math.abs(p.pos.z - e.zc) > 0.5) continue;
    if (p.pos.x < e.xt - 1.0 || p.pos.x > e.xb + 0.95) continue;
    if (Math.abs(p.pos.y - escHeight(e, p.pos.x)) > 0.45) continue;
    p.pos.x += -e.dir * ESC_SPEED * dt * (e.dir > 0 ? 1 : 1); p.pos.z += (e.zc - p.pos.z) * Math.min(1, dt * 2);
    return e;
  }
  return null;
}
function updateMallDoors(dt) {
  for (const d of mall.doors) {
    let near = false;
    const chk = p => { if (Math.abs(p.pos.x - d.x) < 3.2 && Math.abs(p.pos.z) < 3.6 && p.pos.y < mall.y0 + 2) near = true; };
    if (player.where === 'out') chk(player); for (const n of mall.npcs) chk(n); for (const n of npcs) if (Math.abs(n.pos.x - d.x) < 4) chk(n);
    const was = d.open; d.open = damp(d.open, near ? 1 : 0, near ? 5 : 2.5, dt);
    if (was < 0.05 && d.open >= 0.05 && Math.abs(player.pos.x - d.x) < 30) Audio.slide();
    d.panels[0].position.z = -1.1 - d.open * 2.15; d.panels[1].position.z = 1.1 + d.open * 2.15;
    d.col.maxY = d.open > 0.7 ? -5 : mall.y0 + 2.75;
  }
}
/* ---------- the shops ---------- */
function buildMallShop(S) {
  const fy = S.floor ? mall.yU : mall.y0, ux0 = UNIT[S.u[0]], ux1 = UNIT[S.u[S.u.length - 1] + 1], w = ux1 - ux0, cxx = (ux0 + ux1) / 2;
  const zf = S.side * 13, zb = S.side * (mall.z1 - 0.32), d = Math.abs(zb - zf), a = S.side > 0 ? Math.PI : 0;
  const F = mkFrame(cxx, zf, a); S.F = F; S.w = w; S.d = d; S.fy = fy; S.cx = cxx;
  S.bounds = [Math.min(ux0, ux1), Math.min(zf, zb), Math.max(ux0, ux1), Math.max(zf, zb)];
  mall.shops.push(S);
  const ceil = (S.floor ? mall.yR - 0.35 : mall.yU - 0.3) - fy, open = S.type === 'food';
  // partitions
  for (const x of [ux0, ux1]) { mBox('mallWall', x - 0.1, x + 0.1, fy, fy + ceil, Math.min(zf, zb), Math.max(zf, zb), 0xf1ece4, true, { obs: S.floor }); }
  // storefront: glass with a wide opening, sign band above
  const sgn = (lx, ly, lz, ww, hh, dd, mat, color, col, o) => fBox(F, mat, lx, fy + ly, lz, ww, hh, dd, color, Object.assign({ col, minY: fy, maxY: fy + ly + hh / 2 }, o || {}));
  if (!open) {
    for (const [l0, l1] of [[-w / 2 + 0.1, -1.7], [1.7, w / 2 - 0.1]]) {
      sgn((l0 + l1) / 2, 1.6, 0, l1 - l0, 3.2, 0.05, 'clearGlass', 0xd8eef6, true);
      const [ax, az] = fw(F, l0, 0), [bx, bz] = fw(F, l1, 0); mall.obs[S.floor].push([Math.min(ax, bx), Math.min(az, bz) - 0.1, Math.max(ax, bx), Math.max(az, bz) + 0.1]);
      for (const l of [l0, l1]) sgn(l, 1.6, 0, 0.09, 3.2, 0.09, 'mallMetal', 0x2f343a);
    }
    sgn(0, 3.24, 0, w - 0.2, 0.08, 0.1, 'mallMetal', 0x2f343a);
    // security gates at the entrance
    for (const l of [-1.45, 1.45]) { sgn(l, 0.75, -0.6, 0.08, 1.5, 0.5, 'mallMetal', 0xd0d4d8, true); sgn(l, 1.42, -0.6, 0.1, 0.1, 0.52, 'neon', 0x6fb6ff); }
  }
  sgn(0, 3.28 + (ceil - 3.28) / 2, 0, w, ceil - 3.28, 0.25, 'mallWall', 0xf1ece4);
  makeSign(F, 0, fy + 3.95, 0.16, S.name, Math.min(w * 0.72, 7.5), S.color, '#fff6e6');
  // shop floor and ceiling lights
  const flCol = { market: 0xe8e8e8, cafe: 0xa87850, books: 0xb08860, food: 0xf0e8dc, arcade: 0x3a3a48, flowers: 0xe8e2d4 }[S.type] || 0xf4f0ea;
  { const [ax, az] = fw(F, -w / 2 + 0.1, -0.05), [bx, bz] = fw(F, w / 2 - 0.1, -d + 0.05); BT.add(S.type === 'cafe' || S.type === 'books' ? 'woodFloor' : 'mallFloor', quadUp(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), fy + 0.018, 2.5), 0, 0, 0, 0, flCol); }
  for (let lx = -w / 2 + 1.6; lx < w / 2 - 1; lx += 2.6) for (let lz = -1.8; lz > -d + 1; lz -= 2.4) sgn(lx, ceil - 0.03, lz, 1.0, 0.04, 1.0, 'mallLamp', 0xffffff);
  S.inside = []; S.spots = [];
  const ctx = { F, w, d, fy, S, sgn, spot: (lx, lz, id, ly = 0.9) => { const [x, z] = fw(F, lx, lz); const sp = { x, y: fy, z, r: 1.15, item: id, shop: S.id, ly }; S.spots.push(sp); world.uses.push({ x, y: fy, z, r: 1.0, act: 'بردار', label: () => `${ITEMS[id].n} — <b>${fmtT(ITEMS[id].p)}</b> · ${touchUI ? '«بردار»' : '<b>E</b>'} بردار`, use: () => addToCart(id, S.id) }); },
    node: (lx, lz, look) => { const [x, z] = fw(F, lx, lz); S.inside.push([x, z, look]); } };
  SHOP_BUILD[S.type](ctx);
  // cashier counter
  if (S.type !== 'food') {
    const cxl = w / 2 - 1.6, czl = -2.4;
    sgn(cxl, 0.52, czl, 1.9, 1.04, 0.7, 'mallWood', 0x6a4a32, true); sgn(cxl, 1.06, czl, 2.0, 0.05, 0.78, 'mallTrim', 0x1a1a1a);
    shelfItem(F, cxl - 0.5, fy + 1.09, czl, 'phone', 0.3, 1.6);
    sgn(cxl + 0.55, 1.23, czl, 0.35, 0.3, 0.05, 'neon', 0x3a7ad8);
    const [kx, kz] = fw(F, cxl, czl - 0.75), [px, pz] = fw(F, cxl, czl + 0.85);
    const clerk = mallStaff('mall:' + S.id, S.clerk, kx, fy, kz, F.a);
    S.clerk = clerk;
    world.uses.push({ x: px, y: fy, z: pz, r: 1.25, act: 'حساب کن', pri: 1, shop: S.id, label: () => { const it = store.cart.filter(c => c.shop === S.id); return it.length ? `صندوق — ${fa(it.length)} قلم · <b>${fmtT(it.reduce((s, c) => s + ITEMS[c.id].p, 0))}</b> · ${touchUI ? '«حساب کن»' : '<b>E</b>'} پرداخت با کارت` : 'صندوق — اول از قفسه‌ها چیزی بردار'; }, use: () => payAt(S.id, clerk) });
    const [ix, iz] = fw(F, 0, -1.2); S.inside.push([ix, iz, null]);
  }
  const [ex, ez] = fw(F, 0, 1.2), [ix, iz] = fw(F, 0, -1.0); S.entry = [ex, ez]; S.entryIn = [ix, iz];
}
function mallStaff(key, job, x, y, z, facing) {
  let rs = store.residents[key];
  if (!rs) { const look = randomLook(); look.umbrella = false; const persona = makePersona(look, look.female); persona.job = job; persona.jobLine = `من ${job} پاساژ آزادی‌ام. هر چی لازم داری بردار، بعد بیا صندوق.`; rs = store.residents[key] = { look, persona }; }
  const p = makePerson(rs.look, false); p.persona = rs.persona; p.npc = true; p.mode = 'stand'; p.mallStaff = true; p.pos.set(x, y, z); p.facing = facing; p.home = [x, y, z, facing];
  outdoorPool.attach(p); mall.staff.push(p); return p;
}
const SHOP_BUILD = {
  market(c) {
    const { F, w, d, sgn, spot, node } = c, goods = ['water', 'juice', 'soda', 'doogh', 'chips', 'choco', 'bread', 'apple', 'nuts', 'cake', 'sandwich', 'vitamin', 'icecream'];
    const extra = ['umbrella', 'flashlight'];
    let gi = 0;
    for (let lx = -w / 2 + 2.2; lx < w / 2 - 4.5; lx += 3.0) {
      sgn(lx, 0.8, -4.6, 0.7, 1.6, 4.8, 'mallMetal', 0xe6e8ea, true);
      for (let lv = 0; lv < 4; lv++) { sgn(lx, 0.15 + lv * 0.45, -4.6, 1.0, 0.03, 4.8, 'mallTrim', 0xcfd3d7); for (const sd of [-1, 1]) for (let lz = -6.7; lz < -2.4; lz += 0.34) shelfItem(F, lx + sd * 0.36, c.fy + 0.17 + lv * 0.45, lz, goods[(Math.floor(lz * 3) + lv * 5 + Math.round(lx) + 40) % goods.length], sd * Math.PI / 2, 0.95); }
      sgn(lx, 2.0, -2.15, 0.9, 0.3, 0.04, 'neon', 0x2a9a5a);
      for (const sd of [-1, 1]) for (const lz of [-3.2, -5.6]) spot(lx + sd * 0.95, lz, gi % 9 === 8 ? extra[gi++ % 2] : goods[gi++ % goods.length]);
      node(lx + 1.5, -4.6, null);
    }
    // fridges along the back
    for (let lx = -w / 2 + 1.2; lx < w / 2 - 1; lx += 1.9) { sgn(lx, 1.05, -d + 0.42, 1.8, 2.1, 0.75, 'mallMetal', 0x30363c, true); sgn(lx, 1.05, -d + 0.81, 1.6, 1.85, 0.02, 'fridge', 0xffffff); for (let lv = 0; lv < 4; lv++) for (let b = 0; b < 6; b++) shelfItem(F, lx - 0.65 + b * 0.26, c.fy + 0.25 + lv * 0.45, -d + 0.55, ['water', 'doogh', 'soda', 'juice'][(b + lv) % 4], 0, 0.9); }
    for (const [lx, id] of [[-3, 'doogh'], [1, 'soda'], [5, 'water'], [-7, 'juice']]) if (Math.abs(lx) < w / 2 - 1) spot(lx, -d + 1.5, id);
    // checkout lanes and carts
    for (const lx of [w / 2 - 4.6]) { sgn(lx, 0.45, -1.6, 0.7, 0.9, 2.2, 'mallMetal', 0x3a3f46, true); }
    for (let k = 0; k < 5; k++) { const [x, z] = fw(F, -w / 2 + 0.8 + k * 0.28, -1.0); BT.add('mallMetal', boxGeo(0.55, 0.5, 0.85), x, c.fy + 0.65, z, F.a, 0xb8bec4); }
    node(0, -7.3, null); node(-w / 2 + 3, -7.3, null);
  },
  flowers(c) {
    const { F, w, d, sgn, spot, node } = c;
    for (let i = 0; i < 9; i++) { const lx = -w / 2 + 1.4 + (i % 3) * 2.6, lz = -2.6 - Math.floor(i / 3) * 1.9, col = ['#c8202a', '#f2c12e', '#e85aa8', '#ffffff', '#ff8a2a', '#8a3ac8'][i % 6];
      sgn(lx, 0.25, lz, 0.6, 0.5, 0.6, 'mallMetal', 0x5a6068, true);
      const [x, z] = fw(F, lx, lz); for (let k = 0; k < 9; k++) { BT.add('foliage', GEO.sphere, x + rr(-0.22, 0.22), c.fy + 0.75 + rr(0, 0.3), z + rr(-0.22, 0.22), 0, new THREE.Color(col).getHex(), 0, 0, 0.09, 0.08, 0.09); BT.add('foliage', GEO.cyl, x + rr(-0.15, 0.15), c.fy + 0.6, z + rr(-0.15, 0.15), 0, 0x3f7a2a, 0, 0, 0.01, 0.35, 0.01); }
      if (i % 2 === 0) spot(lx + 0.9, lz, i % 4 === 0 ? 'flowers' : 'tulips'); }
    for (let k = 0; k < 4; k++) { const [x, z] = fw(F, -w / 2 + 0.6, -2 - k * 1.6); BT.add('mallTrim', GEO.cyl, x, c.fy + 0.3, z, 0, 0x8a5a3a, 0, 0, 0.3, 0.6, 0.3); for (let j = 0; j < 4; j++) BT.add('foliage', pick(GEO.ico), x, c.fy + 0.8 + j * 0.25, z, R() * 6, pick(FOLIAGE), 0, 0, 0.4, 0.45, 0.4); }
    node(0, -4.5, null); node(-1, -7, null);
  },
  cafe(c) {
    const { F, w, d, sgn, spot, node } = c;
    sgn(-1.0, 0.55, -d + 1.2, w - 3.0, 1.1, 0.8, 'mallWood', 0x4a2f1c, true); sgn(-1.0, 1.12, -d + 1.2, w - 2.9, 0.05, 0.86, 'mallTrim', 0xe8e4dc);
    sgn(-3, 1.35, -d + 1.0, 0.6, 0.45, 0.45, 'mallMetal', 0xc8ccd0); shelfItem(F, -1.5, c.fy + 1.15, -d + 1.1, 'cake', 0, 1.2); shelfItem(F, -0.8, c.fy + 1.15, -d + 1.1, 'coffee', 0, 1.3);
    { const t = adTexture([['منوی کافه', 80], ['لاته ۱۲۰', 60], ['چای ۴۰', 60], ['کیک ۹۰', 60], ['بستنی ۶۰', 60]], ['#3a2416', '#1e120a'], '#f4e2c8'); const [x, z] = fw(F, -1, -d + 0.05); adPanel(x, c.fy + 2.6, z, F.a + Math.PI, 2.4, 1.6, t); }
    spot(-2.5, -d + 2.2, 'coffee'); spot(-0.5, -d + 2.2, 'tea'); spot(1.3, -d + 2.2, 'cake'); spot(-4, -d + 2.2, 'icecream');
    for (const [lx, lz] of [[-3, -2.6], [0, -2.6], [-3, -5.2], [0, -5.2]]) cafeTable(c, lx, lz);
    node(-1.5, -3.9, null);
  },
  digital(c) {
    const { F, w, d, sgn, spot, node } = c;
    for (const [lx, lz] of [[-2.5, -3.2], [0.8, -3.2], [-2.5, -5.8]]) { sgn(lx, 0.45, lz, 1.8, 0.9, 0.9, 'mallTrim', 0xf4f4f4, true); for (let k = 0; k < 4; k++) shelfItem(F, lx - 0.6 + k * 0.4, c.fy + 0.92, lz, k % 2 ? 'headphones' : 'phone', -0.6, 1); spot(lx, lz + 0.9, 'phone'); spot(lx + 0.9, lz, 'headphones'); }
    for (let k = 0; k < 4; k++) { const lx = -w / 2 + 1.2 + k * 1.9; sgn(lx, 2.0, -d + 0.1, 1.7, 1.0, 0.06, 'neon', [0x3a7ad8, 0xd85a3a, 0x3ad87a, 0xd8c83a][k]); sgn(lx, 2.0, -d + 0.07, 1.8, 1.08, 0.04, 'trim', 0x111111); }
    node(-0.8, -4.6, null);
  },
  shoes(c) {
    const { F, w, d, sgn, spot, node } = c, ids = ['shoesWhite', 'shoesBlack', 'shoesRed', 'shoesBlue'];
    for (const s of [-1, 1]) { const lx = s * (w / 2 - 0.35); sgn(lx, 1.2, -4.5, 0.4, 2.4, 6.5, 'mallWood', 0xe8e0d0, true); for (let lv = 0; lv < 5; lv++) for (let k = 0; k < 9; k++) shelfItem(F, lx - s * 0.05, c.fy + 0.25 + lv * 0.45, -1.8 - k * 0.7, ids[(k + lv) % 4], s * -Math.PI / 2, 0.85); }
    ids.forEach((id, i) => spot((i % 2 ? 1 : -1) * (w / 2 - 1.2), -2.5 - Math.floor(i / 2) * 2.6, id));
    sgn(0, 0.22, -4.4, 2.2, 0.44, 0.55, 'mallFabric', 0x6a2a2a, true); mall.seats.push(Object.assign(sitAt(F, -0.5, -4.4, c.fy, 0), { floor: c.S.floor })); mall.seats.push(Object.assign(sitAt(F, 0.5, -4.4, c.fy, 0), { floor: c.S.floor }));
    { const [x, z] = fw(F, 0, -d + 0.08); BT.add('mallGloss', boxGeo(1.4, 2.0, 0.04), x, c.fy + 1.2, z, F.a, 0xd8e8f0); }
    node(0, -6.5, null);
  },
  clothes(c) { clothesShop(c, ['shirtBlue', 'shirtWhite', 'shirtGreen', 'shirtRed', 'shirtBlack', 'shirtYellow', 'jacket'], ['pantsJeans', 'pantsBlack', 'pantsKhaki']); },
  sport(c) { clothesShop(c, ['trackRed', 'shirtBlack', 'shirtYellow', 'shirtGreen'], ['trackPants', 'pantsBlack'], ['ball', 'shoesWhite', 'shoesBlue']); },
  optic(c) {
    const { F, w, d, sgn, spot, node } = c;
    for (const [lx, lz] of [[-2.6, -3], [0.6, -3], [-1, -5.8]]) { sgn(lx, 0.45, lz, 1.6, 0.9, 0.7, 'mallTrim', 0xf4f4f4, true); sgn(lx, 1.05, lz, 1.6, 0.3, 0.7, 'clearGlass', 0xe0f0f8); for (let k = 0; k < 4; k++) shelfItem(F, lx - 0.55 + k * 0.36, c.fy + 0.92, lz, k % 2 ? 'watch' : 'sunglasses', 0, 1); spot(lx, lz + 0.8, lz < -4 ? 'watch' : 'sunglasses'); }
    for (const s of [-1, 1]) { const lx = s * (w / 2 - 0.12); sgn(lx, 1.4, -4.5, 0.08, 1.8, 2.5, 'mallGloss', 0xd8e8f0); }
    node(-1, -4.4, null);
  },
  toys(c) {
    const { F, w, d, sgn, spot, node } = c;
    for (const lx of [-2.6, 0.6]) { sgn(lx, 0.8, -4.6, 0.7, 1.6, 4.4, 'mallMetal', 0xf2d8a8, true); for (let lv = 0; lv < 3; lv++) for (const sd of [-1, 1]) for (let lz = -6.4; lz < -2.6; lz += 0.6) shelfItem(F, lx + sd * 0.32, c.fy + 0.2 + lv * 0.5, lz, 'ball', 0, 0.8); }
    for (let k = 0; k < 12; k++) { const [x, z] = fw(F, rr(-w / 2 + 1, w / 2 - 1), rr(-d + 1, -1.5)); BT.add('mallGloss', GEO.sphere, x, c.fy + rr(3.2, 3.9), z, 0, pick([0xe8303a, 0x2a6ad8, 0xf2c12e, 0x3ab84a, 0xe85aa8]), 0, 0, 0.2, 0.25, 0.2); }
    for (let k = 0; k < 4; k++) shelfItem(F, -w / 2 + 0.2, c.fy + 0.6 + k * 0.45, -2.5 - k * 0.8, 'skateboard', Math.PI / 2, 1);
    spot(-2.6 - 0.95, -3.5, 'ball'); spot(0.6 + 0.95, -3.5, 'balloon'); spot(0.6 + 0.95, -5.5, 'balloonBlue'); spot(-w / 2 + 1.1, -3.8, 'skateboard');
    node(-1, -6.8, null);
  },
  books(c) {
    const { F, w, d, sgn, spot, node } = c, cols = [0x8a2a2a, 0x2a4a8a, 0x2a6a3a, 0xd8b84a, 0x5a3a6a, 0xe8e0d0, 0x3a3a3a];
    for (const s of [-1, 1]) { const lx = s * (w / 2 - 0.3); sgn(lx, 1.3, -4.5, 0.4, 2.6, 7.6, 'mallWood', 0x5a3a22, true); for (let lv = 0; lv < 5; lv++) { let lz = -0.9; while (lz > -8.1) { const bw = rr(0.04, 0.08), bh = rr(0.26, 0.38); sgn(lx - s * 0.05, 0.12 + lv * 0.5 + bh / 2, lz - bw / 2, 0.24, bh, bw, 'mallFabric', pick(cols)); lz -= bw + 0.005; } } }
    sgn(-1, 0.42, -4.6, 2.2, 0.84, 1.2, 'mallWood', 0x6a4a2a, true); for (let k = 0; k < 6; k++) shelfItem(F, -1.8 + k * 0.32, c.fy + 0.85, -4.6, ['book', 'novel', 'notebook'][k % 3], 0.3, 1);
    spot(-1, -3.6, 'book'); spot(0.6, -4.6, 'novel'); spot(-1, -5.6, 'notebook');
    for (const lz of [-6.6]) { mall.seats.push(Object.assign(sitAt(F, -2.4, lz, c.fy, Math.PI / 2), { floor: c.S.floor })); sgn(-2.4, 0.22, lz, 0.6, 0.45, 0.6, 'mallFabric', 0x7a2a2a, true); }
    node(0.6, -6.5, null);
  },
  hats(c) {
    const { F, w, d, sgn, spot, node } = c;
    sgn(0, 1.5, -d + 0.15, w - 1, 2.6, 0.12, 'mallWood', 0x8a6a4a); for (let k = 0; k < 14; k++) shelfItem(F, -w / 2 + 1 + k * 0.62, c.fy + 1.2 + (k % 2) * 0.7, -d + 0.35, ['capRed', 'capBlack', 'capWhite', 'backpack', 'backpackRed'][k % 5], Math.PI, 1);
    for (const [lx, lz] of [[-2.2, -3.4], [1.4, -3.4]]) { sgn(lx, 0.5, lz, 1.4, 1.0, 1.4, 'mallTrim', 0xf4f0ea, true); for (let k = 0; k < 3; k++) shelfItem(F, lx - 0.4 + k * 0.4, c.fy + 1.0, lz, ['capRed', 'capBlack', 'capWhite'][k], 0, 1); }
    spot(-2.2, -2.4, 'capRed'); spot(-1.0, -3.4, 'capBlack'); spot(1.4, -2.4, 'capWhite'); spot(-2, -d + 1.2, 'backpack'); spot(2, -d + 1.2, 'backpackRed');
    node(-0.4, -5.2, null);
  },
  perfume(c) {
    const { F, w, d, sgn, spot, node } = c;
    for (const s of [-1, 1]) { const lx = s * (w / 2 - 0.3); sgn(lx, 1.2, -4.5, 0.4, 2.4, 6.5, 'mallGloss', 0xf4f0f8, true); for (let lv = 0; lv < 5; lv++) for (let k = 0; k < 14; k++) shelfItem(F, lx - s * 0.05, c.fy + 0.2 + lv * 0.45, -1.6 - k * 0.45, 'perfume', 0, 0.9); }
    sgn(-0.8, 0.5, -4.2, 2.2, 1.0, 1.0, 'mallTrim', 0x1a1a1a, true); sgn(-0.8, 1.01, -4.2, 2.2, 0.02, 1.0, 'neon', 0xd8a8e8);
    spot(-0.8, -3.2, 'perfume'); spot(w / 2 - 1.2, -3.5, 'perfume');
    node(0.8, -6.2, null);
  },
  arcade(c) {
    const { F, w, d, sgn, node } = c;
    const games = [['ماشین‌سواری', 0xe8303a], ['فوتبال دستی', 0x3ab84a], ['جنگ ستارگان', 0x2a6ad8], ['بسکتبال', 0xf29a2a], ['جرثقیل عروسک', 0xe85aa8], ['رقص', 0xf2e12e]];
    games.forEach(([nm, col], i) => {
      const lx = -w / 2 + 1.0 + (i % 3) * 3.2, lz = i < 3 ? -d + 0.8 : -3.2, ry = i < 3 ? 0 : Math.PI;
      const F2 = mkFrame(...fw(F, lx, lz), F.a + ry);
      fBox(F2, 'mallTrim', 0, c.fy + 0.9, 0, 1.0, 1.8, 0.8, 0x1a1a22, { col: true }); fBox(F2, 'neon', 0, c.fy + 1.35, 0.38, 0.75, 0.55, 0.04, col); fBox(F2, 'neon', 0, c.fy + 1.92, 0.1, 1.0, 0.2, 0.6, col); fBox(F2, 'mallMetal', 0, c.fy + 0.95, 0.5, 0.9, 0.08, 0.3, 0x30343a);
      const [x, z] = fw(F2, 0, 1.0);
      world.uses.push({ x, y: c.fy, z, r: 0.9, act: 'بازی کن', label: () => `بازی «${nm}» — ${fmtT(50000)} · ${touchUI ? '«بازی کن»' : '<b>E</b>'}`, use: () => playArcade(nm, F2.a + Math.PI, x, c.fy, z) });
    });
    for (const s of [-1, 1]) sgn(s * (w / 2 - 0.12), 3.5, -4.5, 0.05, 0.08, 8.2, 'neon', s > 0 ? 0xe85aa8 : 0x2a8ad8);
    node(0, -5.2, null); node(-2, -2.2, null);
  },
  food(c) {
    const { F, w, d, sgn, node } = c;
    const counters = [['پیتزا ناپل', '#c2341f', ['pizza', 'soda']], ['کبابی سنتی شاندیز', '#7a4a1f', ['kebab', 'doogh']], ['بستنی و آبمیوه برف', '#2a8a9a', ['icecream', 'juice']]];
    counters.forEach(([nm, col, menu], i) => {
      const lx = -w / 2 + 3.4 + i * (w - 6.8) / 2, lz = -d + 1.3;
      sgn(lx, 0.55, lz, 4.2, 1.1, 1.0, 'mallTrim', new THREE.Color(col).getHex(), true); sgn(lx, 1.12, lz, 4.3, 0.05, 1.1, 'mallTrim', 0xe8e4dc);
      sgn(lx, 2.5, -d + 0.2, 4.2, 1.6, 0.1, 'mallTrim', 0x1a1a1a); makeSign(mkFrame(...fw(F, lx, -d + 0.27), F.a), 0, c.fy + 3.6, 0, nm, 3.8, col, '#ffffff');
      const t = adTexture([[nm, 64], ...menu.map(id => [`${ITEMS[id].n} ${fa(Math.round(ITEMS[id].p / 1000))}`, 52])], ['#20242a', '#0e1014'], '#ffe8b8');
      { const [x, z] = fw(F, lx, -d + 0.27); adPanel(x, c.fy + 2.5, z, F.a + Math.PI, 2.6, 1.5, t); }
      shelfItem(F, lx - 0.8, c.fy + 1.15, lz, menu[0], 0, 1.2);
      const [kx, kz] = fw(F, lx, lz - 0.95), [px, pz] = fw(F, lx, lz + 1.0);
      const cook = mallStaff('mall:food' + i, i === 1 ? 'کباب‌پز' : i === 0 ? 'پیتزاپز' : 'بستنی‌فروش', kx, c.fy, kz, F.a);
      for (const id of menu) {
        const [ox, oz] = fw(F, lx + (id === menu[0] ? -0.8 : 0.8), lz + 1.0);
        world.uses.push({ x: ox, y: c.fy, z: oz, r: 0.95, act: 'سفارش', label: () => `${nm}: ${ITEMS[id].n} — <b>${fmtT(ITEMS[id].p)}</b> · ${touchUI ? '«سفارش»' : '<b>E</b>'} سفارش و پرداخت`, use: () => { addToCart(id, 'food' + i); payAt('food' + i, cook); } });
      }
      node(lx, lz + 1.6, null);
    });
    for (let i = 0; i < 6; i++) { const lx = -w / 2 + 3 + (i % 3) * ((w - 6) / 2), lz = -3.2 - Math.floor(i / 3) * 2.6; cafeTable(c, lx, lz, 4); }
    node(0, -2, null); node(-w / 3, -4.5, null); node(w / 3, -4.5, null);
  }
};
function sitAt(F, lx, lz, y, ry) { const [x, z] = fw(F, lx, lz); return { x, z, y, ry: F.a + ry, roofed: true }; }
function cafeTable(c, lx, lz, n = 2) {
  const { F, sgn, fy, S } = c;
  sgn(lx, 0.74, lz, 0.8, 0.04, 0.8, 'mallWood', 0x8a6a4a); sgn(lx, 0.37, lz, 0.08, 0.72, 0.08, 'mallMetal', 0x30343a, true);
  const pos = n === 4 ? [[0, 0.75, Math.PI], [0, -0.75, 0], [0.75, 0, -Math.PI / 2], [-0.75, 0, Math.PI / 2]] : [[0, 0.75, Math.PI], [0, -0.75, 0]];
  for (const [ox, oz, ry] of pos) {
    const F2 = mkFrame(...fw(F, lx + ox, lz + oz), F.a + ry);
    fBox(F2, 'mallWood', 0, fy + 0.45, 0, 0.42, 0.05, 0.42, 0x6a4a2a); fBox(F2, 'mallWood', 0, fy + 0.72, -0.19, 0.42, 0.5, 0.04, 0x6a4a2a); fBox(F2, 'mallMetal', 0, fy + 0.22, 0, 0.36, 0.44, 0.36, 0x30343a);
    const s = { x: F2.x, z: F2.z, y: fy, ry: F2.a, roofed: true, floor: S.floor }; mall.seats.push(s);
  }
}
function clothesShop(c, tops, bottoms, extra = []) {
  const { F, w, d, sgn, spot, node } = c;
  // hanging racks
  [-2.4, 1.2].forEach((lx, ri) => {
    sgn(lx, 1.45, -4.2, 0.04, 0.04, 3.2, 'mallMetal', 0xc8ccd0); for (const lz of [-2.6, -5.8]) sgn(lx, 0.72, lz, 0.05, 1.45, 0.05, 'mallMetal', 0xc8ccd0, true);
    const set = ri ? bottoms : tops;
    for (let k = 0; k < 12; k++) { const id = set[k % set.length]; sgn(lx, 1.05, -2.8 - k * 0.24, 0.5, 0.7, 0.05, 'mallFabric', new THREE.Color(ITEMS[id].col).getHex()); }
    set.forEach((id, i) => spot(lx + (i % 2 ? 0.8 : -0.8), -2.8 - (i >> 1) * 1.3, id));
  });
  // mannequins
  for (const lx of [-w / 2 + 0.8, w / 2 - 0.8]) { const [x, z] = fw(F, lx, -1.0); BT.add('mallTrim', GEO.cyl, x, c.fy + 0.05, z, 0, 0x2a2a2a, 0, 0, 0.25, 0.1, 0.25); BT.add('mallTrim', GEO.cyl, x, c.fy + 0.8, z, 0, 0xe8e4dc, 0, 0, 0.03, 1.5, 0.03); BT.add('mallFabric', boxGeo(0.42, 0.6, 0.22), x, c.fy + 1.35, z, F.a, new THREE.Color(ITEMS[tops[0]].col).getHex()); BT.add('mallTrim', GEO.sphere, x, c.fy + 1.82, z, 0, 0xe8e4dc, 0, 0, 0.12, 0.15, 0.12); CL.circle(x, z, 0.3, c.fy, c.fy + 1.9); }
  // fitting room + mirror
  sgn(-w / 2 + 1.0, 1.1, -d + 1.0, 1.6, 2.2, 0.05, 'mallFabric', 0x6a2a3a); sgn(-w / 2 + 1.8, 1.1, -d + 0.55, 0.05, 2.2, 0.9, 'mallWall', 0xf1ece4, true);
  { const [x, z] = fw(F, w / 2 - 0.12, -6.4); BT.add('mallGloss', boxGeo(0.04, 1.9, 0.9), x, c.fy + 1.1, z, F.a, 0xd8e8f0); }
  extra.forEach((id, i) => { sgn(w / 2 - 3.2, 0.45, -6.5 + i * 0.9, 0.8, 0.9, 0.8, 'mallTrim', 0xf4f0ea, true); shelfItem(F, w / 2 - 3.2, c.fy + 0.92, -6.5 + i * 0.9, id, 0, 1); spot(w / 2 - 2.2, -6.5 + i * 0.9, id); });
  node(-0.6, -4.2, null); node(-0.6, -7, null);
}
function playArcade(nm, facing, x, y, z) {
  if (store.money < 50000) { toast('موجودی کارتت کافی نیست'); return; }
  store.money -= 50000; updateWalletHUD();
  startUse('arcade', player.pos.x, player.pos.y, player.pos.z, facing, null, null, 6); Audio.arcade();
  setTimeout(() => { const win = Math.random() < 0.35; if (win) { const prize = mpick(['balloon', 'ball', 'choco', 'balloonBlue']); addInv(prize); banner('بردی!', `جایزه: ${ITEMS[prize].n} — توی کیفته`); } else say(player, mpick(['ای بابا! دوباره!', 'نزدیک بود!', 'امتیازم بد نبود!']), 2.2); saveGame(); }, 6000);
}
/* ---------- shoppers walk a small navigation graph on each floor ---------- */
function segHitsBox(ax, az, bx, bz, b, m) {
  const x0 = b[0] - m, z0 = b[1] - m, x1 = b[2] + m, z1 = b[3] + m; let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
  for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dz, az - z0], [dz, z1 - az]]) { if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; } const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } }
  return true;
}
function buildMallGraph() {
  for (const fl of [0, 1]) {
    const N_ = mall.nodes[fl];
    for (const z of [-9, 9]) for (let x = 61; x <= 97; x += 6) N_.push({ x, z });
    if (fl === 0) { for (const [x, z] of [[60, 0], [77.5, -3.5], [77.5, 3.5], [84, -4.2], [84, 4.2], [91, 0], [95.5, 2.5], [99, 0], [59, 0], [76.2, -0.95], [76.2, 0.95]]) N_.push({ x, z }); }
    else { for (const [x, z] of [[61, -4], [61, 0], [61, 4], [96, -3], [96, 0], [96, 3], [62.8, -0.95], [62.8, 0.95]]) N_.push({ x, z }); }
    for (const S of mall.shops) if (S.floor === fl) { N_.push({ x: S.entry[0], z: S.entry[1], shop: S, door: true }); N_.push({ x: S.entryIn[0], z: S.entryIn[1], shop: S, door: true }); for (const [x, z, lk] of S.inside) N_.push({ x, z, shop: S, inside: true, look: lk }); }
    N_.forEach((n, i) => n.i = i);
    for (const a of N_) { a.nb = []; for (const b of N_) { if (a === b) continue; const dd = Math.hypot(a.x - b.x, a.z - b.z); if (dd > 15) continue;
      if (a.shop !== b.shop && (a.inside || b.inside)) continue;
      if (mall.obs[fl].some(o => segHitsBox(a.x, a.z, b.x, b.z, o, 0.32))) continue; a.nb.push([b, dd]); } }
  }
}
function mallPath(fl, from, to) {
  const N_ = mall.nodes[fl]; const near = (x, z) => { let best = null, bd = 1e9; for (const n of N_) { const d = Math.hypot(n.x - x, n.z - z); if (d < bd && !mall.obs[fl].some(o => segHitsBox(x, z, n.x, n.z, o, 0.2))) { bd = d; best = n; } } return best || N_[0]; };
  const a = near(from[0], from[1]), b = typeof to.i === 'number' ? to : near(to[0], to[1]);
  const dist = new Map([[a, 0]]), prev = new Map(), open = [a];
  while (open.length) { open.sort((p, q) => dist.get(p) - dist.get(q)); const u = open.shift(); if (u === b) break; for (const [v, w] of u.nb) { const nd = dist.get(u) + w; if (nd < (dist.get(v) ?? 1e9)) { dist.set(v, nd); prev.set(v, u); open.push(v); } } }
  const out = []; let u = b; while (u) { out.unshift([u.x, u.z]); u = prev.get(u); } return out;
}
const ESC_UP = { start: [75.6, -0.95], end: [63.2, -0.95] }, ESC_DOWN = { start: [63.2, 0.95], end: [75.6, 0.95] };
function mallPlan(n) {
  const fl = mallFloorAt(n.pos.y), r = Math.random();
  if (r < 0.2) { // change floor by escalator
    const e = fl === 0 ? ESC_UP : ESC_DOWN; const p = mallPath(fl, [n.pos.x, n.pos.z], e.start);
    n.path = [...p, [e.start[0], e.start[1], 1], [e.end[0], e.end[1], 1, 0.5]]; return;
  }
  if (r < 0.62) { const shops = mall.shops.filter(s => s.floor === fl); const S = mpick(shops); const ins = mpick(S.inside); const tgt = mall.nodes[fl].find(q => q.shop === S && q.inside && q.x === ins[0] && q.z === ins[1]);
    const p = mallPath(fl, [n.pos.x, n.pos.z], tgt || ins); if (p.length) { p[p.length - 1] = [...p[p.length - 1], 0, 5 + Math.random() * 9]; } n.path = p; n.shopVisit = S; return; }
  if (r < 0.78) { const seats = mall.seats.filter(s => s.floor === fl && !s.taken); if (seats.length) { const s = mpick(seats); const p = mallPath(fl, [n.pos.x, n.pos.z], [s.x + Math.sin(s.ry) * 0.7, s.z + Math.cos(s.ry) * 0.7]); p.push([s.x + Math.sin(s.ry) * 0.7, s.z + Math.cos(s.ry) * 0.7, 0, 0, s]); s.taken = n; n.path = p; return; } }
  const q = mpick(mall.nodes[fl].filter(q => !q.inside)); n.path = mallPath(fl, [n.pos.x, n.pos.z], q); if (n.path.length) n.path[n.path.length - 1] = [q.x, q.z, 0, 2 + Math.random() * 4];
}
function spawnMallShoppers() {
  const n = LOW ? 8 : 16;
  for (let k = 0; k < n; k++) {
    const fl = k % 2, N_ = mall.nodes[fl].filter(q => !q.inside), q = mpick(N_);
    const kid = Math.random() < 0.15, look = randomLook(); look.umbrella = false; if (kid) Object.assign(look, { h: 0.62 + Math.random() * 0.1, kid: true, coat: null, beard: false });
    const p = makePerson(look, false); p.npc = true; p.mall = true; p.mode = 'mall'; p.spd = 0.9 + Math.random() * 0.4; p.timer = Math.random() * 3; p.radius = kid ? 0.24 : 0.28;
    if (kid) { p.persona.age = 8 + Math.floor(Math.random() * 5); p.persona.job = 'دانش‌آموز'; }
    p.pos.set(q.x + rr(-0.5, 0.5), fl ? mall.yU : mall.y0, q.z + rr(-0.5, 0.5)); p.facing = Math.random() * 6.28;
    if (Math.random() < 0.4) p.carry = mpick(['backpack', 'flowers', 'icecream', 'coffee', 'phone', 'balloon']);
    outdoorPool.attach(p); mall.npcs.push(p);
  }
}
function updateMallNPCMode(n, dt, faceTo) {
  // returns [dx, dz, desired]
  if (!n.path || !n.path.length) { if (n.timer < 0) { n.timer = 0; mallPlan(n); } if (n.lookAt != null) n.facing += angDiff(n.facing, n.lookAt) * Math.min(1, 3 * dt); return [0, 0, 0]; }
  const tg = n.path[0], dx = tg[0] - n.pos.x, dz = tg[1] - n.pos.z, d = Math.hypot(dx, dz);
  const onEsc = n.onEsc;
  n.prog = (n.prog || 0) + dt; if (!n.lastP || Math.hypot(n.pos.x - n.lastP[0], n.pos.z - n.lastP[1]) > 0.5) { n.prog = 0; n.lastP = [n.pos.x, n.pos.z]; }
  if (n.prog > 5 && !onEsc) { n.prog = 0; n.path = null; n.timer = 1; return [0, 0, 0]; }
  if (d < (tg[2] ? 0.3 : 0.55)) {
    n.path.shift();
    if (tg[4]) { const s = tg[4]; n.bench = s; n.mode = 'sit'; n.timer = 12 + Math.random() * 30; n.anim.special = 'sit'; n.anim.idleKind = Math.random() < 0.5 ? 'phone' : 'breathe'; n.path = null; return [0, 0, 0]; }
    if (!n.path.length) { n.timer = tg[3] ?? 2; n.lookAt = n.shopVisit && n.shopVisit.F ? n.facing + (Math.random() - 0.5) * 2 : null; n.anim.idleKind = mpick(['look', 'breathe', 'phone', 'crossed']); if (n.shopVisit && Math.random() < 0.3) say(n, mpick(['این قشنگه!', 'قیمتش چنده؟', 'اینو بخرم؟', 'وای چه تخفیفی!']), 2.2); n.shopVisit = null; }
    return [0, 0, 0];
  }
  if (onEsc) return [dx, dz, 0.0001];
  return [dx, dz, n.spd * (d < 1.2 && n.path.length === 1 ? 0.7 : 1)];
}
function updateMall(dt) {
  const near = Math.abs(camera.position.x - mall.cx) < 140 && Math.abs(camera.position.z) < 140;
  updateMallDoors(dt); updateEscalators(dt);
  if (player.where === 'out' && player.state === 'foot') escalatorCarry(player, dt);
  for (let i = 0, L = mall.npcs.length + mall.staff.length; i < L; i++) {
    const n = i < mall.npcs.length ? mall.npcs[i] : mall.staff[i - mall.npcs.length];
    n.H.visible = near && player.where === 'out';
    if (!near) continue;
    n.onEsc = escalatorCarry(n, dt);
    if (n.mallStaff && n.mode === 'stand') { const [x, y, z, f] = n.home; if (Math.hypot(n.pos.x - x, n.pos.z - z) > 0.4) { n.mode = 'mall'; n.path = [[x, z, 1]]; } else n.facing += angDiff(n.facing, f) * Math.min(1, 3 * dt); }
    if (n.mallStaff && n.mode === 'mall' && (!n.path || !n.path.length)) { n.mode = 'stand'; }
    updateNPC(n, dt, true, world.col);
  }
  // shop alarm when you walk out with unpaid things
  if (player.where === 'out') {
    const P = player, S = shopAt(P.pos.x, P.pos.y, P.pos.z);
    if (P.inShop && P.inShop !== S && store.cart.some(c => c.shop === P.inShop.id)) {
      const prev = P.inShop, [ix, iz] = prev.entryIn;
      if (Math.hypot(P.pos.x - ix, P.pos.z - iz) > 9 || Math.abs(P.pos.y - prev.fy) > 2) { store.cart = store.cart.filter(c => c.shop !== prev.id); toast('اجناسِ حساب‌نشده سر جایشان در قفسه برگشت'); updateWalletHUD(); }
      else { shopAlarm(prev.clerk); P.pos.x = ix; P.pos.z = iz; P.vel.set(0, P.vel.y, 0); return; }
    }
    if (S !== P.inShop && S) banner(S.name, S.floor ? 'طبقهٔ اول پاساژ آزادی' : 'همکف پاساژ آزادی');
    P.inShop = S;
  }
}
function shopAt(x, y, z) { if (!inMall(x, z)) return null; const fl = mallFloorAt(y); for (const S of mall.shops) { const b = S.bounds; if (S.floor === fl && x > b[0] && x < b[2] && z > b[1] && z < b[3]) return S; } return null; }

/* ============================================================
   New city places: a petrol station, a mosque with a tiled dome, a primary school with a playground
   ============================================================ */
const FUEL_PRICE = 3000, TANK_L = 50;
const gas = { pumps: [] };
function buildGasStation(cx, cz) {
  const y = CURB, x0 = cx - LOT + 1, x1 = cx + LOT - 1;
  gas.cx = cx; gas.cz = cz;
  BT.add('asphalt', quadUp(cx - LOT, cz - LOT, cx + 6, cz + LOT, y + 0.012, 9), 0, 0, 0, 0, 0xc8c8c8);
  BT.add('sidewalk', quadUp(cx + 6, cz - LOT, cx + LOT, cz + LOT, y + 0.01, 4), 0, 0, 0, 0, 0xffffff);
  for (const z of [-16.5, 16.5]) { BT.add('trim', boxGeo(LOT + 6, 0.25, 0.5), cx - LOT / 2 + 3, y + 0.12, cz + z, 0, 0xb9b2a6); }
  // canopy on four columns, lit from below
  const C0 = cx - 18, C1 = cx - 2, Z = 11, H = 5.6;
  BT.add('trim', boxGeo(C1 - C0 + 2, 0.7, 2 * Z + 2), (C0 + C1) / 2, y + H, cz, 0, 0xf4f4f2);
  BT.add('trim', boxGeo(C1 - C0 + 2.04, 0.36, 2 * Z + 2.04), (C0 + C1) / 2, y + H + 0.1, cz, 0, 0x1f7a4a);
  BT.add('trim', boxGeo(C1 - C0 + 2.06, 0.08, 2 * Z + 2.06), (C0 + C1) / 2, y + H - 0.2, cz, 0, 0xe8b923);
  for (let x = C0 + 1; x < C1; x += 3.2) for (const z of [-7, 0, 7]) BT.add('lampOn2', boxGeo(1.2, 0.03, 1.2), x, y + H - 0.37, cz + z, 0, 0xffffff);
  for (const x of [C0 + 2, C1 - 2]) for (const z of [-4.5, 4.5]) { BT.add('trim', boxGeo(0.6, H, 0.6), x, y + H / 2, cz + z, 0, 0xe8e8e6); CL.box(x - 0.3, x + 0.3, cz + z - 0.3, cz + z + 0.3, 0, y + H); }
  makeSign(mkFrame(C0 - 1.05, cz, -Math.PI / 2), 0, y + H + 0.05, 0, 'جایگاه سوخت آزادی', 9, '#1f7a4a', '#ffffff');
  // pump islands
  for (const z of [-4.5, 4.5]) {
    BT.add('trim', boxGeo(C1 - C0 - 2, 0.22, 1.3), (C0 + C1) / 2, y + 0.11, cz + z, 0, 0xd8d2c6); CL.box(C0 + 1, C1 - 1, cz + z - 0.65, cz + z + 0.65, 0, y + 0.22);
    for (const x of [C0 + 4.5, C1 - 4.5]) {
      BT.add('metal', boxGeo(1.1, 1.9, 0.6), x, y + 0.22 + 0.95, cz + z, 0, 0xf2f2f2); BT.add('trim', boxGeo(1.14, 0.25, 0.64), x, y + 1.95, cz + z, 0, 0x1f7a4a);
      for (const s of [-1, 1]) { BT.add('neon', boxGeo(0.6, 0.35, 0.02), x, y + 1.45, cz + z + s * 0.31, 0, 0x3ad87a); BT.add('trim', boxGeo(0.08, 0.3, 0.1), x + 0.4, y + 1.0, cz + z + s * 0.33, 0, 0x1a1a1a); BT.add('metal', new THREE.TorusGeometry(0.22, 0.02, 6, 12, Math.PI), x + 0.4, y + 0.8, cz + z + s * 0.36, Math.PI / 2, 0x1a1a1a, Math.PI / 2); }
      CL.box(x - 0.55, x + 0.55, cz + z - 0.3, cz + z + 0.3, 0, y + 2.1);
      for (const s of [-1, 1]) { const px = x, pz = cz + z + s * 1.25; const pump = { x: px, z: pz, face: Math.atan2(0, -s) }; gas.pumps.push(pump);
        world.uses.push({ x: px, y, z: pz, r: 1.3, act: 'بنزین بزن', label: () => fuelLabel(pump), use: () => startFuel(pump) }); }
    }
  }
  // price pylon
  BT.add('trim', boxGeo(1.6, 7, 0.5), cx - LOT + 3, y + 3.5, cz - 19, 0, 0x1f7a4a); CL.box(cx - LOT + 2.2, cx - LOT + 3.8, cz - 19.25, cz - 18.75, 0, y + 7);
  { const t = adTexture([['بنزین معمولی', 70], [`لیتری ${fa((3000).toLocaleString('fa-IR'))}`, 80], ['تومان', 60], ['۲۴ ساعته', 70]], ['#1f7a4a', '#0e3f26'], '#ffffff'); adPanel(cx - LOT + 2.17, y + 4, cz - 19, -Math.PI / 2, 1.4, 2.1, t); }
  // convenience shop with a real door
  const S0 = cx + 6, S1 = cx + 20, SZ = 8, SH = 4.2;
  BT.add('plaster', boxGeo(S1 - S0, SH, 2 * SZ, 3), (S0 + S1) / 2, y + SH / 2, cz, 0, 0xeceae4); CL.box(S0 - 0.2, S1, cz - SZ, cz + SZ, 0, y + SH);
  BT.add('trim', boxGeo(S1 - S0 + 0.3, 0.5, 2 * SZ + 0.3), (S0 + S1) / 2, y + SH + 0.25, cz, 0, 0x1f7a4a);
  BT.add('glassLit', planeGeo(2 * SZ - 4, 2.6), S0 - 0.01, y + 1.6, cz - 1, -Math.PI / 2, 0x2d2a26);
  makeDoor(mkFrame(S0, cz, -Math.PI / 2), 6, y, 0.08, 0x9aa3ab, 'shop', 'فروشگاه جایگاه سوخت', 'خوراکی و نوشیدنی');
  makeSign(mkFrame(S0, cz, -Math.PI / 2), 0, y + 3.4, 0.12, 'فروشگاه ۲۴ ساعته', 6, '#e8b923', '#1a1a1a');
  // air & water post, bins
  BT.add('metal', boxGeo(0.5, 1.4, 0.4), cx - 24, y + 0.7, cz + 13, 0, 0x2a6ad8); CL.box(cx - 24.25, cx - 23.75, cz + 12.8, cz + 13.2, 0, y + 1.4);
  bin(cx - 1, cz - 12); bin(cx - 1, cz + 12);
  world.foot.push([S0, cz - SZ, S1, cz + SZ, '#e0dcd2'], [C0 - 1, cz - Z - 1, C1 + 1, cz + Z + 1, '#9aa2a8']);
}
function fuelCar(pump) {
  let best = null, bd = 6.5;
  for (const c of cars) { if (c.ai || c.isTow) continue; const d = Math.hypot(c.x - pump.x, c.z - pump.z); if (d < bd) { bd = d; best = c; } }
  return best;
}
function fuelLabel(pump) {
  const c = fuelCar(pump), k = touchUI ? '«بنزین بزن»' : '<b>E</b>';
  if (!c) return 'پمپ بنزین — ماشینت را کنار پمپ پارک کن، بعد پیاده شو و بنزین بزن';
  const L = Math.round((100 - c.fuel) / 100 * TANK_L);
  if (L < 1) return 'باک این ماشین پر است';
  return `سوخت‌گیری: ${fa(L)} لیتر · <b>${fmtT(L * FUEL_PRICE)}</b> · ${k}`;
}
function startFuel(pump) {
  const c = fuelCar(pump); if (!c) { say(player, 'اول باید ماشین رو بیارم کنار پمپ.', 2); return; }
  const L = Math.round((100 - c.fuel) / 100 * TANK_L); if (L < 1) { say(player, 'باکش پره!', 1.6); return; }
  if (store.money < L * FUEL_PRICE) { say(player, 'پولم کافی نیست!', 2); return; }
  const P = player, f = Math.atan2(c.x - P.pos.x, c.z - P.pos.z);
  startUse('fuel', P.pos.x, P.pos.y, P.pos.z, f, null, null, 1.5 + L * 0.09);
  P.use.onDone = () => { c.fuel = 100; store.money -= L * FUEL_PRICE; Audio.beepPay(1); banner('باک پر شد', `${fa(L)} لیتر بنزین · ${fmtT(L * FUEL_PRICE)}`); store.stats.fuel = (store.stats.fuel || 0) + L; updateWalletHUD(); saveGame(); };
  P.use.fuelL = L; say(P, 'یه باک پر لطفاً!', 1.6);
}
/* ---------- mosque ---------- */
function tileTexture(base, line, star) {
  const c = mkCanvas(512), g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  const S = 128;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const cx = x * S + S / 2, cy = y * S + S / 2;
    g.save(); g.translate(cx, cy);
    g.fillStyle = star; g.beginPath(); for (let k = 0; k < 16; k++) { const r = k % 2 ? 26 : 52, a = k / 16 * Math.PI * 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
    g.strokeStyle = line; g.lineWidth = 5; g.stroke();
    g.fillStyle = base; g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fill(); g.fillStyle = '#f4e8c8'; g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill();
    g.restore();
    g.strokeStyle = line; g.lineWidth = 3; g.beginPath(); g.moveTo(x * S, y * S + S / 2); g.lineTo(x * S + S / 2, y * S); g.lineTo(x * S + S, y * S + S / 2); g.lineTo(x * S + S / 2, y * S + S); g.closePath(); g.stroke();
  }
  speckle(g, 512, 3000, ['rgba(255,255,255,0.25)', 'rgba(0,0,0,0.2)'], 1, 2, 0.5);
  return toTex(c);
}
function pointedArch(w, h, depth, thick = 0.5) { // a frame-shaped pointed arch (Persian iwan outline)
  const s = new THREE.Shape(), hw = w / 2, sp = h - hw * 1.1;
  s.moveTo(-hw - thick, 0); s.lineTo(-hw - thick, h + thick); s.lineTo(hw + thick, h + thick); s.lineTo(hw + thick, 0); s.lineTo(hw, 0); s.lineTo(hw, sp);
  s.quadraticCurveTo(hw, h - hw * 0.25, 0, h); s.quadraticCurveTo(-hw, h - hw * 0.25, -hw, sp); s.lineTo(-hw, 0); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 }); g.translate(0, 0, -depth / 2); return g;
}
function buildMosque(cx, cz) {
  const y = CURB, n = cz < 0 ? 1 : -1; // the entrance faces the city centre
  M.tileBlue = stdMat({ map: tileTexture('#1e5f9a', '#f4e8c8', '#2bb3c0'), roughness: 0.35 });
  M.tileDome = stdMat({ map: tileTexture('#33b5c6', '#1b3f6b', '#f2d35a'), roughness: 0.3, metalness: 0.05 });
  M.tileDome.map.repeat.set(6, 3); M.tileDome.map.wrapS = M.tileDome.map.wrapT = THREE.RepeatWrapping;
  M.brickY = stdMat({ map: T.brick, normalMap: T.brickN, roughness: 0.85, color: 0xffe8c8 });
  const W = (lx, lz) => [cx + lx, cz + lz * -n]; // local z grows away from the entrance
  const box = (mat, lx, ly, lz, w, h, d, col, coll) => { const [x, z] = W(lx, lz); BT.add(mat, boxGeo(w, h, d, 3), x, ly, z, 0, col); if (coll) CL.box(x - w / 2, x + w / 2, z - d / 2, z + d / 2, 0, ly + h / 2); };
  // paving and garden
  BT.add('sidewalk', quadUp(cx - LOT + 1, cz - LOT + 1, cx + LOT - 1, cz + LOT - 1, y + 0.01, 4), 0, 0, 0, 0, 0xf2e8d8);
  // outer wall with the entrance portal (pishtaq)
  const L = LOT - 1.2, WH = 4.6;
  for (const s of [-1, 1]) { box('brickY', s * L, y + WH / 2, 0, 0.6, WH, 2 * L, 0xffffff, true); box('tileBlue', s * L, y + WH + 0.15, 0, 0.7, 0.3, 2 * L, 0xffffff); }
  box('brickY', 0, y + WH / 2, L, 2 * L, WH, 0.6, 0xffffff, true); box('tileBlue', 0, y + WH + 0.15, L, 2 * L, 0.3, 0.7, 0xffffff);
  for (const s of [-1, 1]) { box('brickY', s * (L + 3) / 2 + s * 1.5 / 2, y + WH / 2, -L, L - 3 - 1.5 + 0.6, WH, 0.6, 0xffffff, true); }
  { const [x, z] = W(0, -L); const g = pointedArch(4.2, 7.6, 2.2, 3.4); BT.add('tileBlue', g, x, y, z, n > 0 ? 0 : Math.PI, 0xffffff);
    for (const s of [-1, 1]) { CL.box(x + s * 2.1 - (s > 0 ? 0 : 3.4), x + s * 2.1 + (s > 0 ? 3.4 : 0), z - 1.1, z + 1.1, 0, y + 11); BT.add('trim', GEO.cyl, x + s * 5.6, y + 9.2, z, 0, 0x2bb3c0, 0, 0, 0.22, 2.4, 0.22); }
    BT.add('trim', boxGeo(11, 0.5, 2.4), x, y + 11.25, z, 0, 0xf4e8c8); }
  makeSign(mkFrame(...W(-9.5, -L - 0.35), n > 0 ? Math.PI : 0), 0, y + 2.9, 0, 'مسجد جامع شهر', 5, '#1e5f9a', '#f4e8c8');
  // courtyard: pool, cypresses, flower beds, benches
  { const [x, z] = W(0, -2); BT.add('tileBlue', boxGeo(9, 0.55, 5.2), x, y + 0.27, z, 0, 0xffffff); CL.box(x - 4.5, x + 4.5, z - 2.6, z + 2.6, 0, y + 0.55);
    const wm = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 4.6), new THREE.MeshStandardMaterial({ color: 0x2a7aa8, roughness: 0.04, metalness: 0.3, transparent: true, opacity: 0.88 })); wm.rotation.x = -Math.PI / 2; wm.position.set(x, y + 0.5, z); scene.add(wm); waterMeshes.push(wm); }
  for (const s of [-1, 1]) for (const lz of [-12, -7, 3, 8]) { const [x, z] = W(s * 7.5, lz); tree(x, z, 0.9, 'pine'); }
  for (const s of [-1, 1]) for (const lz of [-9.5, 5.5]) { const [x, z] = W(s * 11.5, lz); bench(x, z, s > 0 ? -Math.PI / 2 : Math.PI / 2); }
  for (const s of [-1, 1]) { const [x, z] = W(s * 4, -14.5); BT.add('trim', boxGeo(3, 0.35, 1.2), x, y + 0.18, z, 0, 0x8a8378); for (let k = 0; k < 7; k++) BT.add('foliage', GEO.sphere, x + rr(-1.3, 1.3), y + 0.45, z + rr(-0.45, 0.45), 0, pick([0xc8202a, 0xe85aa8, 0xf2c12e, 0xffffff]), 0, 0, 0.14, 0.12, 0.14); }
  // side arcades (riwaq)
  for (const s of [-1, 1]) {
    const lx = s * (L - 3.2);
    box('brickY', lx + s * 0.4, y + 2.6 + 0.6, 0, 3.4, 0.5, 2 * L - 14, 0xffffff);
    box('tileBlue', lx - s * 1.3, y + 3.0, 0, 0.4, 1.4, 2 * L - 14, 0xffffff);
    for (let lz = -L + 7.5; lz <= L - 7.5; lz += 3.2) { const [x, z] = W(lx - s * 1.3, lz); BT.add('brickY', boxGeo(0.6, 2.6, 0.6, 3), x, y + 1.3, z, 0, 0xffffff); CL.box(x - 0.3, x + 0.3, z - 0.3, z + 0.3, 0, y + 2.6); }
  }
  // prayer hall, iwan and the great dome
  const HZ = L - 6.5, HD = 11, HH = 9.5;
  box('brickY', 0, y + HH / 2, HZ, 2 * L - 2, HH, HD, 0xffffff, true); box('tileBlue', 0, y + HH + 0.2, HZ, 2 * L - 1.8, 0.4, HD + 0.2, 0xffffff);
  { const [x, z] = W(0, HZ - HD / 2 - 1.0); const g = pointedArch(6.5, 12.5, 2.0, 2.6); BT.add('tileBlue', g, x, y, z, n > 0 ? 0 : Math.PI, 0xffffff);
    BT.add('brickY', boxGeo(6.5, 13.6, 0.2), x, y + 6.8, z - n * -0.9, 0, 0xb89a72);
    BT.add('wood', boxGeo(2.6, 3.4, 0.12), x, y + 1.7, ...[z + n * 0.8].slice(0, 0), 0, 0x4a2a14);
    const [dx, dz] = W(0, HZ - HD / 2 - 0.15); BT.add('wood', boxGeo(2.6, 3.4, 0.12), dx, y + 1.7, dz, 0, 0x4a2a14); BT.add('metal', GEO.cyl, dx + 0.3, y + 1.6, dz, 0, 0xc9a24a, Math.PI / 2, 0, 0.04, 0.2, 0.04);
    CL.box(x - 6.1, x + 6.1, z - 1.0, z + 1.0, y + 0.0, y + 14); }
  { const [x, z] = W(0, HZ + 0.5); // drum + onion dome
    BT.add('brickY', new THREE.CylinderGeometry(7.2, 7.4, 6, 40, 1, true), x, y + HH + 3, z, 0, 0xffffff);
    BT.add('tileBlue', new THREE.CylinderGeometry(7.45, 7.45, 1.2, 40, 1, true), x, y + HH + 5.4, z, 0, 0xffffff);
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; BT.add('trim', boxGeo(0.6, 2.2, 0.2), x + Math.cos(a) * 7.45, y + HH + 2.6, z + Math.sin(a) * 7.45, -a + Math.PI / 2, 0x1b2a3a); }
    const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24, r = 7.3 * Math.sin(Math.PI * Math.pow(t, 0.85)) * (1 + 0.12 * Math.sin(Math.PI * t * 1.3)) * (1 - t * 0.15), yy = t * 12.5; pts.push(new V2(Math.max(0.05, r * (t > 0.92 ? (1 - t) / 0.08 * 0.6 : 1)), yy)); }
    const dg = new THREE.LatheGeometry(pts, 48); BT.add('tileDome', dg, x, y + HH + 6, z, 0, 0xffffff);
    BT.add('metal', GEO.cyl, x, y + HH + 19.3, z, 0, 0xd9b04a, 0, 0, 0.12, 1.6, 0.12); BT.add('metal', GEO.sphere, x, y + HH + 18.9, z, 0, 0xd9b04a, 0, 0, 0.35, 0.35, 0.35); BT.add('metal', GEO.sphere, x, y + HH + 19.9, z, 0, 0xd9b04a, 0, 0, 0.2, 0.2, 0.2); }
  // two minarets flanking the iwan
  for (const s of [-1, 1]) {
    const [x, z] = W(s * 7.2, HZ - HD / 2 - 0.5), MH = 31;
    BT.add('brickY', new THREE.CylinderGeometry(0.95, 1.2, MH, 20), x, y + MH / 2, z, 0, 0xffffff); CL.circle(x, z, 1.2, 0, y + MH);
    for (const hy of [6, 12, 18]) BT.add('tileBlue', new THREE.CylinderGeometry(1.1 - hy * 0.006, 1.12 - hy * 0.006, 1.4, 20, 1, true), x, y + hy, z, 0, 0xffffff);
    BT.add('trim', new THREE.CylinderGeometry(1.6, 1.0, 0.8, 20), x, y + MH - 3, z, 0, 0xf4e8c8);
    BT.add('metal', new THREE.CylinderGeometry(1.6, 1.6, 0.8, 20, 1, true), x, y + MH - 2.2, z, 0, 0x2a3a4a);
    BT.add('tileBlue', new THREE.CylinderGeometry(0.9, 0.9, 2.6, 20), x, y + MH + 0.4, z, 0, 0xffffff);
    BT.add('tileDome', new THREE.SphereGeometry(0.95, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), x, y + MH + 1.7, z, 0, 0xffffff);
    BT.add('metal', GEO.cyl, x, y + MH + 3.0, z, 0, 0xd9b04a, 0, 0, 0.06, 0.9, 0.06);
    world.glow.push([x, y + MH - 2, z, 0.5, 0.95, 0.75, 2.2]);
  }
  const [fx0, fz0] = W(-L, -L), [fx1, fz1] = W(L, L); world.foot.push([Math.min(fx0, fx1), Math.min(fz0, fz1), Math.max(fx0, fx1), Math.max(fz0, fz1), '#cdbb9a']);
  world.landmarks = world.landmarks || []; world.landmarks.push({ name: 'مسجد جامع شهر', keys: ['مسجد', 'نماز', 'گنبد', 'مناره'], x: W(0, -L)[0], z: W(0, -L - 3)[1] });
}
/* ---------- primary school with a schoolyard and playground ---------- */
const swings = [];
function buildSchool(cx, cz) {
  const y = CURB, n = cz < 0 ? 1 : -1; // yard opens toward the city centre
  const W = (lx, lz) => [cx + lx, cz + lz * -n];
  const L = LOT - 1.2;
  BT.add('asphalt', quadUp(cx - L, cz - L, cx + L, cz + L, y + 0.012, 9), 0, 0, 0, 0, 0xb8b8b8);
  // building at the back: two floors, blue window bands
  const BZ = L - 6, BD = 10, BH = 7.6, BW = 2 * L - 2;
  { const [x, z] = W(0, BZ); BT.add('plaster', boxGeo(BW, BH, BD, 3), x, y + BH / 2, z, 0, 0xf2e2b8); CL.box(x - BW / 2, x + BW / 2, z - BD / 2, z + BD / 2, 0, y + BH);
    BT.add('trim', boxGeo(BW + 0.3, 0.4, BD + 0.3), x, y + BH + 0.2, z, 0, 0xc2561a); BT.add('trim', boxGeo(BW + 0.12, 0.2, BD + 0.12), x, y + 3.8, z, 0, 0xffffff);
    world.foot.push([x - BW / 2, z - BD / 2, x + BW / 2, z + BD / 2, '#e8d8a8']); }
  const F = mkFrame(...W(0, BZ - BD / 2), n > 0 ? Math.PI : 0);
  faceWindows(F, BW, 0.01, y + 1.9, 1.5, 1.4, 3.2, (r, u) => Math.abs(u) < 2, { faces: [0], sill: true, frame: 0x2a5aa8, litP: 0.3 });
  faceWindows(F, BW, 0.01, y + 5.6, 1.5, 1.4, 3.2, null, { faces: [0], sill: true, frame: 0x2a5aa8, litP: 0.3 });
  fBox(F, 'trim', 0, y + 1.3, 0.1, 2.6, 2.6, 0.2, 0xffffff); fBox(F, 'wood', 0, y + 1.2, 0.2, 2.2, 2.4, 0.08, 0x2a5aa8);
  fBox(F, 'trim', 0, y + 2.9, 0.9, 3.6, 0.15, 1.8, 0xc2561a);
  makeSign(F, 0, y + 4.6, 0.12, 'دبستان دانش', 6.5, '#2a5aa8', '#ffffff');
  // flag pole
  { const [x, z] = W(-6, BZ - BD / 2 - 3); BT.add('metal', GEO.cyl, x, y + 4.5, z, 0, 0xd8d8d8, 0, 0, 0.05, 9, 0.05); CL.circle(x, z, 0.1, 0, 9);
    const fc = mkCanvas(96, 64), fg = fc.getContext('2d'); fg.fillStyle = '#239f40'; fg.fillRect(0, 0, 96, 21); fg.fillStyle = '#fff'; fg.fillRect(0, 21, 96, 22); fg.fillStyle = '#da0000'; fg.fillRect(0, 43, 96, 21);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2, 8, 1), new THREE.MeshStandardMaterial({ map: toTex(fc), side: THREE.DoubleSide, roughness: 0.8 })); flag.position.set(x + 0.9, y + 8.3, z); scene.add(flag); world.flags = world.flags || []; world.flags.push(flag); }
  // fence with a gate toward the street
  const fcol = 0x2a5aa8;
  for (const s of [-1, 1]) { const [ax, az] = W(s * L, -L), [bx, bz] = W(s * L, BZ - BD / 2); fenceLine(ax, az, bx, bz, null, fcol, true); }
  { const [ax, az] = W(-L, -L), [bx, bz] = W(L, -L); fenceLine(ax, az, bx, bz, cx, fcol, true); }
  // basketball court and football goals
  const court = (lx0, lz0, lx1, lz1) => { const [ax, az] = W(lx0, lz0), [bx, bz] = W(lx1, lz1), X0 = Math.min(ax, bx), X1 = Math.max(ax, bx), Z0 = Math.min(az, bz), Z1 = Math.max(az, bz);
    for (const [x, z, l, w, r] of [[(X0 + X1) / 2, Z0, X1 - X0, 0.1, Math.PI / 2], [(X0 + X1) / 2, Z1, X1 - X0, 0.1, Math.PI / 2], [X0, (Z0 + Z1) / 2, Z1 - Z0, 0.1, 0], [X1, (Z0 + Z1) / 2, Z1 - Z0, 0.1, 0], [(X0 + X1) / 2, (Z0 + Z1) / 2, X1 - X0, 0.1, Math.PI / 2]]) mark(x, z, l, w, r, 0xf2f2ee); };
  court(4, -L + 3, L - 2, BZ - BD / 2 - 4);
  for (const lz of [-L + 3.5, BZ - BD / 2 - 4.5]) { const [x, z] = W((4 + L - 2) / 2, lz), s = lz < 0 ? 1 : -1;
    BT.add('metal', GEO.cyl, x, y + 1.6, z - n * s * 0.4 * 0, 0, 0x30343a, 0, 0, 0.07, 3.2, 0.07); CL.circle(x, z, 0.1, 0, 3.2);
    BT.add('trim', boxGeo(1.8, 1.1, 0.06), x, y + 3.3, z + n * -s * -0.3, 0, 0xf4f4f4); BT.add('metal', new THREE.TorusGeometry(0.23, 0.02, 6, 18), x, y + 3.0, z + n * s * 0.6, 0, 0xe85a1a, Math.PI / 2); }
  for (const lz of [-L + 2, BZ - BD / 2 - 3]) { const [x, z] = W(-14, lz); for (const sx of [-1.5, 1.5]) { BT.add('metal', GEO.cyl, x + sx, y + 1, z, 0, 0xf4f4f4, 0, 0, 0.05, 2, 0.05); CL.circle(x + sx, z, 0.07, 0, 2); } BT.add('metal', GEO.cyl, x, y + 2, z, 0, 0xf4f4f4, 0, Math.PI / 2, 0.05, 3, 0.05); }
  // playground: swings, slide, seesaw, sandbox
  const PX = -14, PZ = 2;
  { const [x, z] = W(PX, PZ); BT.add('sidewalk', quadUp(x - 6, z - 5, x + 6, z + 5, y + 0.02, 3), 0, 0, 0, 0, 0xd8a868); }
  { // swing frame with two real swings
    const [x, z] = W(PX - 2.5, PZ + 2.5), top = y + 2.6;
    for (const sx of [-1.8, 1.8]) for (const sz of [-0.8, 0.8]) BT.add('metal', GEO.cyl, x + sx, y + 1.3, z + sz * 0.5, 0, 0xe8303a, sz * 0.32, 0, 0.05, 2.7, 0.05);
    BT.add('metal', GEO.cyl, x, top, z, 0, 0xe8303a, 0, Math.PI / 2, 0.06, 3.7, 0.06); for (const sx of [-1.8, 1.8]) CL.circle(x + sx, z, 0.1, 0, top);
    for (const sx of [-0.85, 0.85]) {
      const pv = new THREE.Group(); pv.position.set(x + sx, top, z); scene.add(pv);
      const cm = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.8, roughness: 0.4 });
      for (const cs of [-0.22, 0.22]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.0, 5), cm); ch.position.set(cs, -1.0, 0); pv.add(ch); }
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.24), new THREE.MeshStandardMaterial({ color: 0x2a5aa8, roughness: 0.6 })); seat.position.y = -2.0; seat.castShadow = true; pv.add(seat);
      const sw = { pv, x: x + sx, z, top, a: 0, v: 0, face: n > 0 ? Math.PI : 0, rider: null }; swings.push(sw);
      world.uses.push({ x: x + sx, y, z, r: 0.9, act: 'تاب بخور', label: () => sw.rider ? 'یکی روی تابه' : `${touchUI ? '«تاب بخور»' : '<b>E</b>'} روی تاب بشین و تاب بخور`, use: () => { if (!sw.rider) startSwing(sw); } });
    }
  }
  { // slide: ladder up to a platform, chute down
    const [x, z] = W(PX + 3, PZ - 1), top = y + 1.7;
    BT.add('metal', boxGeo(1.0, 0.08, 1.0), x, top, z, 0, 0xf2c12e); for (const [sx, sz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) BT.add('metal', GEO.cyl, x + sx, y + 1.0, z + sz, 0, 0x2a5aa8, 0, 0, 0.04, 2.0, 0.04);
    CL.box(x - 0.5, x + 0.5, z - 0.5, z + 0.5, top - 0.3, top);
    for (let k = 0; k < 6; k++) { const yy = y + (k + 1) * 0.27, zz = z + n * (0.6 + (5 - k) * 0.2); BT.add('metal', boxGeo(0.7, 0.04, 0.12), x, yy, zz, 0, 0xc0c4c8); CL.box(x - 0.35, x + 0.35, zz - 0.1, zz + 0.1, yy - 0.2, yy); }
    const len = 3.2, ang = Math.atan2(1.6, 2.7), [mx, mz] = [x, z - n * 1.85];
    BT.add('metal', boxGeo(0.7, 0.05, len), mx, y + 0.95, mz, 0, 0xe8303a, n * -ang); for (const sx of [-0.36, 0.36]) BT.add('metal', boxGeo(0.05, 0.2, len), mx + sx, y + 1.05, mz, 0, 0xe8303a, n * -ang);
    for (let k = 0; k < 14; k++) { const t = (k + 0.5) / 14, zz = z - n * (0.5 + t * 2.7), yy = top - t * 1.6; CL.box(x - 0.35, x + 0.35, zz - 0.1, zz + 0.1, yy - 0.25, yy); }
    world.slides = world.slides || []; world.slides.push({ x, z0: z - n * 0.5, z1: z - n * 3.2, dir: -n, y0: top, y1: y });
  }
  { const [x, z] = W(PX + 1, PZ + 3.5); BT.add('metal', boxGeo(0.3, 0.4, 0.3), x, y + 0.2, z, 0, 0x2a5aa8); BT.add('wood', boxGeo(0.3, 0.06, 3.2), x, y + 0.45, z, 0, 0xf2c12e, 0.12); CL.box(x - 0.2, x + 0.2, z - 0.2, z + 0.2, 0, y + 0.4); }
  { const [x, z] = W(PX - 3, PZ - 2.5); BT.add('wood', boxGeo(3, 0.3, 0.15), x, y + 0.15, z - 1.5, 0, 0x8a5a32); BT.add('wood', boxGeo(3, 0.3, 0.15), x, y + 0.15, z + 1.5, 0, 0x8a5a32); BT.add('wood', boxGeo(0.15, 0.3, 3), x - 1.5, y + 0.15, z, 0, 0x8a5a32); BT.add('wood', boxGeo(0.15, 0.3, 3), x + 1.5, y + 0.15, z, 0, 0x8a5a32); BT.add('trim', quadUp(x - 1.45, z - 1.45, x + 1.45, z + 1.45, y + 0.1, 2), 0, 0, 0, 0, 0xe8d0a0); }
  for (const lx of [-L + 1.5, L - 1.5]) for (const lz of [-6, 4]) { const [x, z] = W(lx, lz); bench(x, z, lx < 0 ? Math.PI / 2 : -Math.PI / 2); }
  for (const lx of [-L + 2, L - 2]) { const [x, z] = W(lx, -L + 2); tree(x, z, 1.0); }
  world.landmarks = world.landmarks || []; world.landmarks.push({ name: 'دبستان دانش و زمین بازی', keys: ['مدرسه', 'دبستان', 'تاب', 'سرسره', 'زمین بازی', 'بسکتبال'], x: cx, z: W(0, -L - 3)[1] });
  world.schoolYard = { cx, cz, spots: [] }; for (let k = 0; k < 10; k++) world.schoolYard.spots.push(W(rr(-L + 3, L - 3), rr(-L + 3, BZ - BD / 2 - 2)));
}
function startSwing(sw) {
  const P = player; sw.rider = P; P.swing = sw; sw.v = Math.max(sw.v, 0.6);
  startUse('swing', sw.x, sw.top - 2.0 - 0.47, sw.z, sw.face, sw.x + Math.sin(sw.face) * 0.9, sw.z + Math.cos(sw.face) * 0.9);
  say(P, mpick(['ووووی!', 'یادش بخیر بچگی!', 'بالاتر!']), 2);
}
function updateSwings(dt) {
  for (const sw of swings) {
    const riding = sw.rider && player.state === 'use' && player.use && player.use.kind === 'swing';
    if (sw.rider && !riding) { sw.rider = null; player.swing = null; }
    // pump when riding, otherwise friction lets it settle
    const gl = 9.8 / 2.0, amp = Math.acos(clamp(1 - (0.5 * sw.v * sw.v + gl * (1 - Math.cos(sw.a))) / gl, -1, 1));
    const pump = riding && amp < 0.75 ? Math.sign(sw.v || 1) : 0;
    sw.v += (-gl * Math.sin(sw.a) + pump * 0.9) * dt; sw.v *= Math.exp(-(riding ? 0.12 : 0.6) * dt); sw.a += sw.v * dt;
    sw.pv.rotation.x = sw.face === 0 ? -sw.a : sw.a;
    if (riding) { const P = player, r = 2.0; P.pos.set(sw.x + Math.sin(sw.face) * Math.sin(sw.a) * r, sw.top - Math.cos(sw.a) * r - 0.45, sw.z + Math.cos(sw.face) * Math.sin(sw.a) * r); P.anim.swingA = sw.a; }
  }
  for (const f of world.flags || []) { const p = f.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 0.9; p.setZ(i, Math.sin(simTime * 4 + x * 3) * 0.08 * x); } p.needsUpdate = true; }
}
function slideCarry(p, dt) {
  for (const s of world.slides || []) {
    if (Math.abs(p.pos.x - s.x) > 0.4) continue; const lo = Math.min(s.z0, s.z1), hi = Math.max(s.z0, s.z1); if (p.pos.z < lo || p.pos.z > hi) continue;
    if (p.pos.y < s.y1 + 0.2) continue; p.pos.z += s.dir * 3.2 * dt; p.vel.z = s.dir * 1.5; return true;
  }
  return false;
}
function spawnSchoolKids() {
  if (!world.schoolYard) return;
  for (let k = 0; k < (LOW ? 4 : 7); k++) {
    const [x, z] = mpick(world.schoolYard.spots), look = Object.assign(randomLook(), { h: 0.6 + Math.random() * 0.13, kid: true, coat: null, beard: false, glasses: false, umbrella: false, build: 0.9 });
    const p = spawnNPC(x, z, look); const pp = p.persona; pp.age = 7 + Math.floor(Math.random() * 5); pp.job = 'دانش‌آموز'; pp.jobLine = `کلاس ${fa(pp.age - 6)}م دبستان دانش هستم! الان زنگ تفریحه.`; pp.married = false; pp.kids = 0;
    p.mode = 'wander'; p.spots = world.schoolYard.spots; p.spd = 1.6; p.radius = 0.24; p.school = true;
  }
}

/* ============================================================
   Hospital & ambulance, the city bus line, overhead cables
   ============================================================ */
CAR_TYPES.van = { len: 5.3, wid: 2.02, wb: 3.3, wr: 0.36, mass: 2600, engine: 8.2, vmax: 40, roofY: 2.42, beltY: 1.22, cab: [0.8, 1.8], headY: 0.85, tailY: 1.0, front: 2.66, rear: -2.66,
  body: [[-2.6, 0.4], [2.55, 0.4], [2.66, 0.62], [2.62, 1.1], [2.15, 1.22], [1.12, 1.22], [1.1, 2.42], [-2.55, 2.44], [-2.64, 2.3], [-2.66, 0.6]],
  cabin: [[1.12, 1.18], [2.14, 1.18], [1.22, 2.3], [1.12, 2.3]] };
CAR_TYPES.bus = { len: 11.6, wid: 2.5, wb: 6.2, wr: 0.5, mass: 11000, engine: 4.6, vmax: 22, roofY: 3.05, beltY: 1.45, cab: [3.6, 4.9], headY: 0.75, tailY: 0.95, front: 5.82, rear: -5.82,
  body: [[-5.75, 0.45], [5.7, 0.45], [5.82, 0.7], [5.82, 1.45], [-5.8, 1.45], [-5.82, 0.7]],
  cabin: [[-5.62, 1.42], [5.76, 1.42], [5.72, 2.98], [-5.62, 2.98]] };
const hospital = { medics: [], queue: [], job: null };
let amb = null, bus = null;
function textTex(lines, w, h, bg, fg) {
  const c = mkCanvas(w, h), g = c.getContext('2d'); if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  lines.forEach(([t, sz, y]) => { g.font = `${sz}px Lalezar, Vazirmatn, Tahoma`; g.fillText(t, w / 2, y, w - 20); });
  const t = toTex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
function buildHospital(cx, cz) {
  const y = CURB, n = cz < 0 ? 1 : -1, a = n > 0 ? 0 : Math.PI;
  const W = (lx, lz) => [cx + lx, cz + lz * n];
  BT.add('sidewalk', quadUp(cx - LOT, cz - LOT, cx + LOT, cz + LOT, y + 0.01, 4), 0, 0, 0, 0, 0xe4e0d8);
  // main block: five floors, white panels and blue glass bands
  const BW = 40, BD = 15, FH_ = 3.5, FL = 5, BH = FH_ * FL, BZ = -LOT + 2 + BD / 2;
  const F = mkFrame(...W(0, BZ), a);
  fBox(F, 'plaster', 0, y + BH / 2, 0, BW, BH, BD, 0xf4f4f2, { ts: 3, col: true, minY: 0 });
  for (let f = 0; f < FL; f++) { fBox(F, 'trim', 0, y + f * FH_ + 0.1, 0, BW + 0.12, 0.2, BD + 0.12, 0xdadfe4); faceWindows(F, BW, BD, y + f * FH_ + 1.9, 1.7, 1.6, 2.6, (r, u) => f === 0 && Math.abs(u) < 5, { sill: false, frame: 0x2a5a8a, litP: 0.55 }); }
  fBox(F, 'trim', 0, y + BH + 0.3, 0, BW + 0.4, 0.6, BD + 0.4, 0x2a6ab0);
  makeSign(F, 0, y + BH - 1.6, BD / 2 + 0.12, 'بیمارستان شهر آزاد', 13, '#1f5fa8', '#ffffff');
  // big cross sign on the corner
  { const t = textTex([['H', 220, 128]], 256, 256, '#1f5fa8', '#ffffff'); adPanel(...(([x, z]) => [x, y + BH - 3, z])(fw(F, BW / 2 - 3, BD / 2 + 0.13)), F.a, 3.2, 3.2, t); }
  // glass lobby with a working door (the hospital pharmacy)
  fBox(F, 'glassLit', 0, y + 1.8, BD / 2 + 0.06, 9, 3.2, 0.06, 0x2d3a46);
  fBox(F, 'trim', 0, y + 3.8, BD / 2 + 1.8, 12, 0.3, 3.6, 0xf4f4f2); for (const sx of [-5.6, 5.6]) fBox(F, 'trim', sx, y + 1.9, BD / 2 + 3.4, 0.4, 3.8, 0.4, 0xdadfe4, { col: true });
  makeDoor(F, 0, y, BD / 2 + 0.12, 0x9aa3ab, 'shop', 'داروخانهٔ بیمارستان', 'داروخانه و پذیرش');
  // emergency bay with its own canopy and red sign
  const EX = BW / 2 - 5;
  fBox(F, 'trim', EX, y + 4.2, BD / 2 + 4, 9, 0.35, 8, 0xf4f4f2); fBox(F, 'neon', EX, y + 3.95, BD / 2 + 7.95, 9, 0.12, 0.08, 0xd8303a);
  for (const sx of [-4.2, 4.2]) fBox(F, 'trim', EX + sx, y + 2.1, BD / 2 + 7.6, 0.4, 4.2, 0.4, 0xdadfe4, { col: true });
  makeSign(F, EX, y + 4.95, BD / 2 + 8.1, 'اورژانس', 4.5, '#c8202a', '#ffffff');
  fBox(F, 'wood', EX, y + 1.3, BD / 2 + 0.08, 2.6, 2.6, 0.1, 0xd8dde2);
  // rooftop helipad
  { const [x, z] = fw(F, -8, 0); const hg = new THREE.CircleGeometry(5, 32); hg.rotateX(-Math.PI / 2); BT.add('paint', hg, x, y + BH + 0.62, z, 0, 0x3a3d42);
    const ht = textTex([['H', 230, 128]], 256, 256, null, '#ffffff'); const hm = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshStandardMaterial({ map: ht, transparent: true, roughness: 0.6 })); hm.rotation.x = -Math.PI / 2; hm.position.set(x, y + BH + 0.64, z); scene.add(hm); }
  // garden, benches, parking lines
  for (const lx of [-16, -10, 10, 16]) { const [x, z] = W(lx, LOT - 4); tree(x, z, 0.9); }
  for (const lx of [-13, 13]) { const [x, z] = W(lx, LOT - 7); bench(x, z, a); }
  for (let k = 0; k < 8; k++) { const [x, z] = W(-18 + k * 3, BZ + BD / 2 + 9); mark(x, z, 5, 0.12, 0, 0xf2f2ee); }
  world.foot.push((() => { const [x0, z0] = W(-BW / 2, BZ - BD / 2), [x1, z1] = W(BW / 2, BZ + BD / 2); return [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), '#e8eef4']; })());
  world.landmarks = world.landmarks || []; world.landmarks.push({ name: 'بیمارستان شهر آزاد (اورژانس)', keys: ['بیمارستان', 'اورژانس', 'دکتر', 'آمبولانس', 'درمانگاه', 'داروخانه'], x: cx, z: cz + n * (LOT + 2) });
  // ambulance waits on the street in front of the emergency bay
  const [ex] = fw(F, EX, 0), roadZ = cz + n * (B / 2);
  hospital.park = { x: ex, z: roadZ - n * PARKOFF, h: n > 0 ? -Math.PI / 2 : Math.PI / 2 };
  hospital.door = W(EX, BZ + BD / 2 + 1.5);
  world.parking = world.parking.filter(p => Math.hypot(p.x - hospital.park.x, p.z - hospital.park.z) > 9);
}
function addSirenParts(car) {
  const t = car.T, body = car.body;
  const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); body.add(m); return m; };
  car.sirR = new THREE.MeshStandardMaterial({ color: 0x5a0a0a, emissive: 0xff1a1a, emissiveIntensity: 0 }); car.sirB = new THREE.MeshStandardMaterial({ color: 0x0a1a5a, emissive: 0x2a5aff, emissiveIntensity: 0 });
  mk(new THREE.BoxGeometry(1.5, 0.08, 0.3), CarMats.black, 0, t.roofY + 0.08, 1.35);
  mk(new THREE.BoxGeometry(0.62, 0.14, 0.26), car.sirR, -0.4, t.roofY + 0.19, 1.35); mk(new THREE.BoxGeometry(0.62, 0.14, 0.26), car.sirB, 0.4, t.roofY + 0.19, 1.35);
  mk(new THREE.BoxGeometry(0.25, 0.12, 0.08), car.sirR, -0.7, t.roofY - 0.1, -2.67); mk(new THREE.BoxGeometry(0.25, 0.12, 0.08), car.sirB, 0.7, t.roofY - 0.1, -2.67);
  const red = new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: 0.5 });
  for (const sx of [-1, 1]) mk(new THREE.BoxGeometry(0.02, 0.22, 5.0), red, sx * (t.wid / 2 + 0.005), 1.0, -0.05);
  const tex = textTex([['اورژانس ۱۱۵', 64, 64]], 512, 128, null, '#c8202a'); const sm = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  for (const sx of [-1, 1]) { const m = mk(new THREE.PlaneGeometry(2.4, 0.6), sm, sx * (t.wid / 2 + 0.02), 1.65, -0.7); m.rotation.y = sx * Math.PI / 2; }
  const back = mk(new THREE.PlaneGeometry(1.4, 0.35), sm, 0, 1.75, -2.672); back.rotation.y = Math.PI;
}
function busParts(car) {
  const t = car.T, body = car.body, W = t.wid;
  const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; body.add(m); return m; };
  mk(new THREE.BoxGeometry(W - 0.05, 0.14, t.len - 0.15), car.paint, 0, t.roofY, 0);
  mk(new THREE.BoxGeometry(1.6, 0.3, 2.2), CarMats.black, 0, t.roofY + 0.2, -3.2);
  for (let z = -5.2; z < 5.3; z += 1.45) for (const sx of [-1, 1]) mk(new THREE.BoxGeometry(0.06, 1.56, 0.12), car.paint, sx * (W / 2 - 0.16), 2.2, z);
  const sign = textTex([['خط ۱ · پاساژ آزادی ⇄ میدان شهر', 44, 40]], 512, 80, '#120d02', '#ffb340');
  const sg = mk(new THREE.PlaneGeometry(2.0, 0.3), new THREE.MeshBasicMaterial({ map: sign, toneMapped: false }), 0, 2.78, 5.79);
  const ad = textTex([['شرکت واحد اتوبوسرانی', 46, 50], ['شهر آزاد', 64, 110]], 512, 160, null, '#ffffff'); const am = new THREE.MeshBasicMaterial({ map: ad, transparent: true });
  for (const sx of [-1, 1]) { const m = mk(new THREE.PlaneGeometry(3.6, 1.1), am, sx * (W / 2 + 0.01), 0.98, -1.5); m.rotation.y = sx * Math.PI / 2; }
  // two sliding doors on the kerb side (right = -x)
  car.busDoors = [3.9, -0.6].map(z => { const g = new THREE.Group(); g.position.set(-W / 2 - 0.01, 0, z); body.add(g); const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.35, 1.1), CarMats.glass); m.position.y = 1.65; g.add(m); const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.4, 0.06), CarMats.black); f.position.set(0, 1.65, 0.55); g.add(f); return g; });
  car.doorPivot.visible = false; car.busOpen = 0;
  // seats seen through the windows
  const seat = new THREE.MeshStandardMaterial({ color: 0x2a4a8a, roughness: 0.9 });
  for (let z = -5; z < 3; z += 0.9) for (const sx of [-0.75, 0.75]) mk(new THREE.BoxGeometry(0.8, 0.55, 0.12), seat, sx, 1.85, z);
}
function serviceVisuals(car, dt) {
  if (car.sirR) { const on = car.sirenOn, ph = (simTime * 2.4) % 1; car.sirR.emissiveIntensity = on ? (ph < 0.5 ? 5 : 0.2) : 0; car.sirB.emissiveIntensity = on ? (ph >= 0.5 ? 5 : 0.2) : 0; }
  if (car.busDoors) { car.busOpen = damp(car.busOpen, car.doorsOpen ? 1 : 0, 4, dt); for (const g of car.busDoors) g.position.x = -car.T.wid / 2 - 0.01 - car.busOpen * 0.08, g.children[0].position.z = car.busOpen * 0.55; }
}
const MEDIC_LOOK = () => Object.assign(randomLook(), { shirt: '#f2f4f6', pants: '#2a6a8a', coat: null, sleeves: true, umbrella: false, beard: Math.random() < 0.3, cap: null });
function medicFor(k) {
  let rs = store.residents['medic' + k];
  if (!rs) { const look = MEDIC_LOOK(); if (look.style === 'scarf') look.scarf = '#2a6a8a'; const persona = makePersona(look, look.female); persona.job = 'امدادگر اورژانس'; persona.jobLine = 'امدادگر اورژانس ۱۱۵ هستم. جون آدم‌ها برامون مهمه.'; rs = store.residents['medic' + k] = { look, persona }; }
  const p = makePerson(rs.look, false); p.persona = rs.persona; p.npc = true; p.medic = true; p.mode = 'stand'; return p;
}
function spawnServices() {
  if (hospital.park) {
    const P_ = hospital.park; amb = new Car('van', 0xf4f4f2, P_.x, P_.z, P_.h); amb.service = 'amb'; addSirenParts(amb); cars.push(amb);
    amb.inHand = true; const d = medicFor('D'); d.medic = false; amb.setDriver(d); amb.hasDriver = true;
  }
  // bus line through every bus stop, in a loop around the centre
  const stops = (world.busStops || []).slice().sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  if (stops.length >= 2) {
    const s0 = stops[0], rt = roadTarget(s0.x, s0.z, -14);
    bus = new Car('bus', 0x1f7a4a, rt.S.x, rt.S.z, Math.atan2(DIRS[rt.d][0], DIRS[rt.d][1]), { ai: { i: rt.A.i, j: rt.A.j, d: rt.d } });
    bus.service = 'bus'; busParts(bus); bus.ai.cruise = 8.5; bus.route = stops; bus.stopIdx = 0; bus.phase = 'drive'; busDest(bus, s0); cars.push(bus);
    const d = staffFor('busDriver', 'رانندهٔ اتوبوس', 'بیست ساله راننده اتوبوس خط یکم. همهٔ ایستگاه‌ها رو از حفظم!'); bus.setDriver(d); bus.owner = d;
  }
}
/* ---------- accidents ---------- */
function injure(p, imp) {
  if (!p.npc || p.injured || p.mallStaff || p.medic || p.mech) return;
  p.injured = true; p.injT = 0; hospital.queue.push(p);
  logEvent(`در ${streetAt(p.pos.x, p.pos.z)} یه تصادف شد و ${p.persona.name} زخمی شد.`);
  // people nearby rush over, some call 115
  let k = 0;
  for (const o of allPeople()) {
    if (o === p || o.mode === 'down' || o.inCar || o.mallStaff || o.mech || o.medic || k >= 4) continue;
    const d = Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z); if (d > 30 || Math.abs(o.pos.y - p.pos.y) > 2) continue;
    const ang = Math.random() * 6.28; o.mode = 'task'; o.task = { x: p.pos.x + Math.cos(ang) * 2.6, z: p.pos.z + Math.sin(ang) * 2.6, run: d > 8, look: p, until: () => !p.injured, idle: k % 2 ? 'phone' : 'crossed' }; k++;
    if (k === 1) setTimeout(() => say(o, mpick(['یکی زنگ بزنه اورژانس!', 'وای! حالت خوبه؟', 'تکون نخور، الان آمبولانس میاد!']), 3), 600);
    if (k === 2) setTimeout(() => { say(o, 'الو، اورژانس؟ اینجا یه تصادف شده!', 3); }, 1800);
  }
}
function updateAmbulance(dt) {
  if (!amb) return;
  serviceSiren();
  const J = hospital.job;
  if (!J) {
    hospital.queue = hospital.queue.filter(p => p.injured && npcs.includes(p));
    const p = hospital.queue[0]; if (!p) return; p.injT += dt; if (p.injT < 4) return;
    hospital.job = { p, phase: 'go', t: 0 };
    amb.ai = new CarAI(amb, 0, 0, 0); amb.ai.cruise = 15; amb.ai.setDest(p.pos.x, p.pos.z); amb.inHand = false; amb.sirenOn = true;
    if (Math.hypot(player.pos.x - p.pos.x, player.pos.z - p.pos.z) < 60) banner('آمبولانس در راه است', 'اورژانس ۱۱۵ برای کمک به مصدوم آمد');
    return;
  }
  J.t += dt; const p = J.p;
  if (J.phase === 'go') {
    if (amb.ai && J.t > 4 && Math.floor(J.t) % 5 === 0 && Math.floor(J.t - dt) % 5 !== 0) { const L = amb.ai.dest; if (L && Math.hypot(L.S.x - p.pos.x, L.S.z - p.pos.z) > 25) amb.ai.setDest(p.pos.x, p.pos.z); }
    if ((amb.ai && amb.ai.arrived) || (Math.hypot(amb.x - p.pos.x, amb.z - p.pos.z) < 9 && Math.abs(amb.vf) < 1) || J.t > 120) {
      if (J.t > 120 && !amb.ai.arrived) { const s = Math.sin(amb.h), c = Math.cos(amb.h); amb.x = p.pos.x + c * 4; amb.z = p.pos.z - s * 4; }
      amb.inHand = true; amb.ai = null; amb.inThrottle = 0; J.phase = 'treat'; J.t = 0; amb.hazardT = 999;
      const s = Math.sin(amb.h), c = Math.cos(amb.h);
      J.medics = [0, 1].map(k => { const m = medicFor(k); const rx = amb.x - s * 3.2 + c * (k ? 0.6 : -0.6), rz = amb.z - c * 3.2 - s * (k ? 0.6 : -0.6); m.pos.set(rx, groundH(rx, rz), rz); m.facing = amb.h + Math.PI; outdoorPool.attach(m); npcs.push(m);
        const side = k ? 1 : -1; m.mode = 'task'; m.task = { x: p.pos.x + side * 0.7, z: p.pos.z + 0.4, run: true, look: p, anim: 'repair' }; return m; });
      say(J.medics[0], mpick(['اورژانس! راه رو باز کنید لطفاً.', 'آروم باش، ما اینجاییم.', 'نفس عمیق بکش، چیزی نیست.']), 3);
    }
  } else if (J.phase === 'treat') {
    if (J.t > 9 && J.medics.every(m => m.task && m.task.done)) {
      J.phase = 'load'; J.t = 0; p.injured = false; p.mode = 'getup'; p.timer = 1.4; p.knockT = 0;
      say(p, mpick(['ممنونم... خیلی ممنون.', 'آخ پام... ممنون که اومدید.', 'خدا خیرتون بده.']), 3);
    }
  } else if (J.phase === 'load') {
    const s = Math.sin(amb.h), c = Math.cos(amb.h), rx = amb.x - s * 3.3, rz = amb.z - c * 3.3;
    if (J.t > 1.5 && p.mode !== 'task') { p.mode = 'task'; p.task = { x: rx, z: rz }; for (const m of J.medics) { m.task = { x: rx + c * 0.8, z: rz - s * 0.8 }; } }
    const atDoor = [p, ...J.medics].every(m => Math.hypot(m.pos.x - rx, m.pos.z - rz) < 1.6);
    if ((J.t > 2 && atDoor) || J.t > 25) {
      for (const m of [p, ...J.medics]) { outdoorPool.detach(m); const i = npcs.indexOf(m); if (i >= 0) npcs.splice(i, 1); }
      Audio.door(); J.phase = 'back'; J.t = 0; amb.hazardT = 0; amb.inHand = false;
      amb.ai = new CarAI(amb, 0, 0, 0); amb.ai.cruise = 12; amb.ai.setDest(hospital.park.x, hospital.park.z); amb.sirenOn = true;
      hospital.patients = hospital.patients || []; hospital.patients.push({ look: p.look, persona: p.persona, t: 0 });
      for (const o of npcs) if (o.mode === 'task' && o.task && o.task.look === p) { o.task = null; finishMode(o); }
    }
  } else if (J.phase === 'back') {
    if (J.t > 6) amb.sirenOn = false;
    if ((amb.ai && amb.ai.arrived && Math.abs(amb.vf) < 0.6) || J.t > 160) {
      const P_ = hospital.park; amb.ai = null; amb.x = P_.x; amb.z = P_.z; amb.h = P_.h; amb.vx = amb.vz = 0; amb.inHand = true; amb.sirenOn = false; hospital.job = null;
    }
  }
  // treated patients walk out of the hospital a while later
  for (const h of hospital.patients || []) {
    h.t += dt; if (h.t < 40 || h.done) continue; h.done = true;
    const [x, z] = hospital.door; const q = spawnNPC(x, z, h.look); q.persona = h.persona; q.persona.mem.hospital = true; q.mode = 'goto'; say(q, 'خداروشکر مرخص شدم!', 3);
  }
}
let sirenNodes = null;
function serviceSiren() {
  if (!Audio.ctx || !amb) return;
  const v = amb.sirenOn ? Audio.vol(amb.x, amb.z) * 0.06 : 0;
  if (!sirenNodes && v > 0) { const c = Audio.ctx, o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain(); o.type = 'square'; o.frequency.value = 780; lfo.frequency.value = 0.55; lg.gain.value = 230; lfo.connect(lg); lg.connect(o.frequency); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200; o.connect(f); f.connect(g); g.gain.value = 0; g.connect(Audio.master); o.start(); lfo.start(); sirenNodes = { g }; }
  if (sirenNodes) sirenNodes.g.gain.setTargetAtTime(v, Audio.ctx.currentTime, 0.1);
}
/* ---------- the bus line ---------- */
// the bus pulls into the kerb strip at a stop so traffic can pass it
function busDest(b, st) { const rt = roadTarget(st.x, st.z), lo = laneOff(rt.d), l = Math.hypot(lo.x, lo.z) || 1; rt.S = { x: rt.S.x + lo.x / l * (PARKOFF - LANE - 0.3), z: rt.S.z + lo.z / l * (PARKOFF - LANE - 0.3) }; b.ai.dest = rt; b.ai.resetFromPos(); }
function busDoorPos(b) { const s = Math.sin(b.h), c = Math.cos(b.h), lx = -(b.T.wid / 2 + 0.9), lz = 3.9; return [b.x + lx * c + lz * s, b.z - lx * s + lz * c]; }
const busRiders = [];
function updateBus(dt) {
  if (!bus) return;
  const b = bus;
  if (b.phase === 'drive') {
    b.doorsOpen = false;
    if (b.ai && b.ai.arrived && Math.abs(b.vf) < 0.5) { b.phase = 'stop'; b.t = 0; b.doorsOpen = true; b.inHand = true; Audio.burst(0.12 * Audio.vol(b.x, b.z), 500, 0.6, 'lowpass', 1); b.ai = null;
      // some riders get off, people waiting get on
      const [dx, dz] = busDoorPos(b);
      for (let k = busRiders.length - 1; k >= 0 && Math.random() < 0.6; k--) { const r = busRiders.splice(k, 1)[0]; const q = spawnNPC(dx, dz, r.look); q.persona = r.persona; q.mode = 'goto'; q.facing = b.h - Math.PI / 2; }
      for (const n of npcs) { if (n.mode !== 'sit' || !n.bench || !n.bench.roofed || Math.hypot(n.pos.x - dx, n.pos.z - dz) > 14 || Math.random() < 0.5) continue; n.anim.special = null; n.bench.taken = null; n.bench = null; n.mode = 'task'; n.task = { x: dx, z: dz, board: true }; }
    }
  } else if (b.phase === 'stop') {
    b.t += dt; b.vx *= 0.9; b.vz *= 0.9;
    const [dx, dz] = busDoorPos(b);
    for (let i = npcs.length - 1; i >= 0; i--) { const n = npcs[i]; if (n.mode === 'task' && n.task && n.task.board && Math.hypot(n.pos.x - dx, n.pos.z - dz) < 1.0) { outdoorPool.detach(n); npcs.splice(i, 1); busRiders.push({ look: n.look, persona: n.persona }); } }
    const waiting = npcs.some(n => n.mode === 'task' && n.task && n.task.board);
    if (b.t > 9 && !waiting && !(player.state === 'foot' && Math.hypot(player.pos.x - dx, player.pos.z - dz) < 2.5)) {
      b.doorsOpen = false; if (b.t > 10.2) { b.stopIdx = (b.stopIdx + 1) % b.route.length; const s = b.route[b.stopIdx]; b.ai = new CarAI(b, 0, 0, 0); b.ai.cruise = 8.5; busDest(b, s); b.inHand = false; b.phase = 'drive'; Audio.burst(0.08 * Audio.vol(b.x, b.z), 400, 0.4); }
    }
  }
  if (player.state === 'passenger' && player.car === b) { const s = b.route[b.phase === 'stop' ? b.stopIdx : b.stopIdx]; b.nextName = streetAt(s.x, s.z); }
}
function boardBus() {
  const P = player; if (store.money < 10000) { say(P, 'پول بلیت ندارم!', 2); return; }
  store.money -= 10000; updateWalletHUD(); Audio.beepPay(1);
  P.state = 'passenger'; P.car = bus; P.inCar = bus; bus.passengerP = P; P.anim.special = 'passenger'; P.anim.sw = 0; P.vel.set(0, 0, 0);
  say(bus.driverP, mpick(['بفرمایید، خوش اومدید.', 'سلام! کارت بلیتت رو بزن.', 'برید ته اتوبوس لطفاً.']), 2.5);
  banner('سوار اتوبوس خط ۱ شدی', 'بلیت: ' + fmtT(10000) + ' — هر ایستگاه که خواستی پیاده شو');
}
function leaveBus() {
  const P = player, b = bus, [dx, dz] = busDoorPos(b);
  b.passengerP = null; P.inCar = null; P.state = 'foot'; P.car = null; P.anim.special = null;
  P.pos.set(dx, groundH(dx, dz), dz); P.facing = b.h - Math.PI / 2; P.vel.set(0, 0, 0); Audio.door();
  say(b.driverP, 'به سلامت!', 1.6);
}
/* ---------- overhead power and phone lines between street lamps ---------- */
function buildCables() {
  const L = world.lamps || []; if (!L.length) return;
  const pts = [], used = new Set();
  for (let i = 0; i < L.length; i++) {
    const a = L[i]; let best = -1, bd = 26;
    for (let j = 0; j < L.length; j++) { if (i === j) continue; const b = L[j]; const same = Math.abs(a.x - b.x) < 0.6 || Math.abs(a.z - b.z) < 0.6; if (!same) continue; const d = Math.hypot(a.x - b.x, a.z - b.z); if (d > 6 && d < bd && !used.has(j + ',' + i)) { bd = d; best = j; } }
    if (best < 0) continue; used.add(i + ',' + best);
    const b = L[best];
    for (const [h, sag] of [[CURB + 5.4, 0.55], [CURB + 5.0, 0.7]]) {
      let px = a.x, py = h, pz = a.z;
      for (let k = 1; k <= 8; k++) { const t = k / 8, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = h - sag * 4 * t * (1 - t); pts.push(px, py, pz, x, y, z); px = x; py = y; pz = z; }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1a1c1f, transparent: true, opacity: 0.75 })); m.frustumCulled = true; g.computeBoundingSphere(); scene.add(m);
}

/* ============================================================
   Rainbow building: an 1100 m hall with animated rainbow walls,
   hundreds of things to hide in, 20 seekers, and a build mode
   ============================================================ */
const RB_W = 100000, RB_L = 100000, RB_H = 100000, RB_FH = 10, RB_FLOORS = RB_H / RB_FH, RB_CH = 50, RB_NI = RB_W / RB_CH, RB_NJ = RB_L / RB_CH, RB_WIN = 2, RB_DOOR_Z = -(BOUND + 60); // the facade toward the city
const RB_PALETTES = {
  classic: { n: 'رنگین‌کمان کلاسیک', c: ['#ff2a2a', '#ff8a1a', '#ffe02a', '#3ad83a', '#2a9aff', '#3a3aff', '#a03aff'] },
  pastel: { n: 'پاستیلی', c: ['#ffb3c6', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff'] },
  neon: { n: 'نئونی', c: ['#ff00a8', '#ff6a00', '#f5ff00', '#00ff6a', '#00e5ff', '#6a00ff'] },
  sunset: { n: 'غروب', c: ['#ff4e50', '#fc913a', '#f9d62e', '#eae374', '#e2f4c7', '#ff7aa2'] },
  ocean: { n: 'اقیانوس', c: ['#003f5c', '#2f9fd6', '#5ad8e6', '#a6f0e8', '#2fd6a8', '#1a6ad8'] },
  fire: { n: 'آتش', c: ['#ff0000', '#ff5a00', '#ff9a00', '#ffce00', '#ff7a2a'] }
};
const rb = { org: { x: 0, z: 0 }, lift: null, built: false, people: [], seekers: [], hiders: [], spots: [], objs: [], placed: [], game: null, build: null };
const rbUniforms = { uCols: { value: Array.from({ length: 8 }, () => new THREE.Color()) }, uN: { value: 7 }, uTime: { value: 0 }, uSpeed: { value: 0.05 }, uBand: { value: 90 }, uLit: { value: 1 } };
function rbSettings() { return store.rbSet || (store.rbSet = { pal: 'classic', custom: RB_PALETTES.classic.c.slice(), speed: 1, level: 1, minutes: 0 }); }
function applyRbPalette() {
  const s = rbSettings(), cols = s.pal === 'custom' ? s.custom : RB_PALETTES[s.pal].c;
  cols.forEach((c, i) => rbUniforms.uCols.value[i].set(c)); rbUniforms.uN.value = cols.length;
  rbUniforms.uSpeed.value = [0, 0.02, 0.05, 0.12][s.speed];
}
const RB_VERT = `varying vec3 vW; varying vec3 vN;
  #include <fog_pars_vertex>
  void main() { mat4 im = mat4(1.0);
  #ifdef USE_INSTANCING
  im = instanceMatrix;
  #endif
  vec4 lp = im * vec4(position, 1.0), w = modelMatrix * lp; vW = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(im) * normal); vec4 mvPosition = modelViewMatrix * lp; gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
  }`;
const RB_FRAG = `uniform vec3 uCols[8]; uniform int uN; uniform float uTime; uniform float uSpeed; uniform float uBand; uniform float uLit;
  varying vec3 vW; varying vec3 vN;
  #include <fog_pars_fragment>
  vec3 pal(float t) { float f = fract(t) * float(uN); int i = int(floor(f)); float k = smoothstep(0.0, 1.0, fract(f)); vec3 a = uCols[0], b = uCols[0];
    for (int j = 0; j < 8; j++) { if (j == i) a = uCols[j]; if (j == (i + 1 == uN ? 0 : i + 1)) b = uCols[j]; } return mix(a, b, k); }
  void main() {
    vec3 n = abs(vN); float u = n.x > 0.5 ? vW.z : vW.x; if (n.y > 0.5) u = vW.x + vW.z * 0.5;
    float t = (u * 0.6 + vW.y * 0.8) / uBand - uTime * uSpeed;
    vec3 c = pal(t);
    vec2 g = abs(fract(vec2(u, vW.y) / 22.0) - 0.5); float seam = smoothstep(0.485, 0.5, max(g.x, g.y));
    c = mix(c, c * 0.55, seam * 0.6);
    c *= 0.85 + 0.25 * smoothstep(400.0, 0.0, vW.y);
    c += 0.06 * sin(vW.y * 0.05 + uTime * 0.7);
    gl_FragColor = vec4(c * uLit, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;
function rbMaterial(side, fog, band) {
  const m = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]), vertexShader: RB_VERT, fragmentShader: RB_FRAG, side, fog });
  Object.assign(m.uniforms, rbUniforms); if (band) m.uniforms.uBand = { value: band }; return m;
}
/* the outside, seen from the city: a monumental rainbow block south of the wall */
function buildRbExterior() {
  const z1 = RB_DOOR_Z, zc = z1 - RB_L / 2;
  const box = new THREE.Mesh(new THREE.BoxGeometry(RB_W, RB_H, RB_L), rbMaterial(THREE.FrontSide, true)); box.material.uniforms.uLit = rb.extLit = { value: 1 };
  box.position.set(0, RB_H / 2 - 0.05, zc); box.matrixAutoUpdate = false; box.updateMatrix(); scene.add(box);
  CL.box(-80, 80, z1 - 4, z1, 0, 400);
  // a hedged forecourt between the city wall and the facade
  for (const sx of [-1, 1]) { const zA = -BOUND - 0.4, len = zA - z1; BT.add('hedge', boxGeo(1.2, 1.6, len, 2), sx * 46, 0.8, (zA + z1) / 2, 0, 0x4a7a3a); CL.box(sx * 46 - 0.6, sx * 46 + 0.6, z1, zA, 0, 1.6); }
  // entrance: a tall dark portal with a canopy and sign
  const door = new THREE.Mesh(new THREE.PlaneGeometry(8, 6.5), new THREE.MeshStandardMaterial({ color: 0x10121c, emissive: 0x6a4ad8, emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.3 }));
  door.position.set(0, 3.25, z1 + 0.06); scene.add(door);
  for (const [x, y, w, h] of [[-4.25, 3.4, 0.5, 6.8], [4.25, 3.4, 0.5, 6.8], [0, 6.75, 9, 0.5]]) BT.add('mallLamp', boxGeo(w, h, 0.3), x, y, z1 + 0.15, 0, 0xffffff);
  BT.add('metal', boxGeo(18, 0.6, 7), 0, 8.4, z1 + 3.5, 0, 0x2a2d33);
  BT.add('mallLamp', boxGeo(17, 0.05, 6.4), 0, 8.08, z1 + 3.5, 0, 0xffffff);
  for (const x of [-8.2, 8.2]) { BT.add('metal', GEO.cyl, x, 4.2, z1 + 6.6, 0, 0x2a2d33, 0, 0, 0.25, 8.4, 0.25); CL.circle(x, z1 + 6.6, 0.3, 0, 8.4); }
  makeSign(mkFrame(0, z1 + 0.2, 0), 0, 14.5, 0, 'ساختمان رنگین‌کمان', 26, '#14162a', '#ffffff');
  makeSign(mkFrame(0, z1 + 7.05, 0), 0, 9.3, 0, 'قایم‌موشک · ساخت‌وساز', 9, '#5a1f8b', '#ffe8ff');
  // the approach road from the city
  const zA = -(HALF + RH), w = 10;
  BT.add('asphalt', quadUp(-w / 2, z1 + 2, w / 2, zA, 0.012, 9), 0, 0, 0, 0, 0xffffff);
  for (let z = zA - 6; z > z1 + 6; z -= 8) mark(0, z, 3.5, 0.15, 0, 0xf2f2ee);
  for (const s of [-1, 1]) mark(s * (w / 2 - 0.4), (zA + z1) / 2, zA - z1 - 4, 0.12, 0, 0xf2f2ee);
  for (let z = zA - 12; z > z1 + 10; z -= 18) for (const s of [-1, 1]) streetLamp(s * (w / 2 + 1.2), z, -s, 0);
  BT.add('sidewalk', quadUp(-40, z1 + 2, 40, z1 + 22, 0.01, 4), 0, 0, 0, 0, 0xdcd6ff);
  rb.door = { x: 0, z: z1 + 3 };
  world.landmarks = world.landmarks || []; world.landmarks.push({ name: 'ساختمان رنگین‌کمان (قایم‌موشک)', keys: ['رنگین', 'کمان', 'قایم', 'موشک', 'بازی', 'ساخت'], x: 0, z: z1 + 6 });
}
/* ---------- objects you can hide in (procedural, instanced) ---------- */
function colGeo(parts) {
  const gs = parts.map(([g, x = 0, y = 0, z = 0, col = '#ffffff', rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1]) => {
    const n = g.index ? g.toNonIndexed() : g.clone(); n.applyMatrix4(new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(sx, sy, sz)));
    if (!n.attributes.normal) n.computeVertexNormals();
    const c = new THREE.Color(col), cnt = n.attributes.position.count, ca = new Float32Array(cnt * 3); for (let i = 0; i < cnt; i++) { ca[i * 3] = c.r; ca[i * 3 + 1] = c.g; ca[i * 3 + 2] = c.b; } n.setAttribute('color', new THREE.BufferAttribute(ca, 3)); return n; });
  let tot = 0; for (const g of gs) tot += g.attributes.position.count;
  const pos = new Float32Array(tot * 3), nor = new Float32Array(tot * 3), col = new Float32Array(tot * 3); let o = 0;
  for (const g of gs) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingBox(); out.computeBoundingSphere(); return out;
}
const Bx = (w, h, d) => new THREE.BoxGeometry(w, h, d), Cyl = (r1, r2, h, s = 16) => new THREE.CylinderGeometry(r1, r2, h, s), Sph = (r, a = 16, b = 12) => new THREE.SphereGeometry(r, a, b);
// size = footprint [w, h, d]; hide = [lx, lz, pose, conceal, kind]; tint = instance colours
const RB_TYPES = {
  wardrobe: { n: 'کمد لباس', cat: 'مبلمان', size: [2.0, 2.3, 0.7], hide: [[0, 0, 'stand', 0.9, 'in']], tint: ['#8a5a32', '#6a4024', '#a87a4a', '#e8e0d0', '#4a3a2a'], w: 6,
    geo: () => colGeo([[Bx(2, 2.2, 0.66), 0, 1.1, 0], [Bx(0.97, 2.0, 0.03), -0.5, 1.08, 0.34, '#f0ebe4'], [Bx(0.97, 2.0, 0.03), 0.5, 1.08, 0.34, '#f0ebe4'], [Bx(0.03, 0.3, 0.04), -0.06, 1.1, 0.37, '#c8c8c8'], [Bx(0.03, 0.3, 0.04), 0.06, 1.1, 0.37, '#c8c8c8'], [Bx(2.1, 0.1, 0.72), 0, 2.25, 0], [Bx(2.0, 0.08, 0.66), 0, 0.04, 0, '#3a2a1a']]) },
  crate: { n: 'جعبهٔ چوبی بزرگ', cat: 'انبار', size: [1.8, 1.8, 1.8], hide: [[0, -1.3, 'crouch', 0.55, 'behind'], [0, 1.3, 'crouch', 0.55, 'behind']], tint: ['#c8a46a', '#b08850', '#d8b884'], w: 9,
    geo: () => { const p = [[Bx(1.76, 1.76, 1.76), 0, 0.88, 0]]; for (const y of [0.1, 0.88, 1.66]) for (const s of [-1, 1]) { p.push([Bx(1.8, 0.14, 0.04), 0, y, s * 0.9, '#8a6a3a']); p.push([Bx(0.04, 0.14, 1.8), s * 0.9, y, 0, '#8a6a3a']); } p.push([Bx(0.06, 1.8, 0.06), 0, 0.9, 0.9, '#8a6a3a', 0, 0, 0.78]); return colGeo(p); } },
  sofa: { n: 'کاناپه', cat: 'مبلمان', size: [2.4, 0.9, 1.0], hide: [[0, -0.95, 'lie', 0.6, 'behind']], tint: ['#7a2a2a', '#2a4a7a', '#3a5a3a', '#8a7a6a', '#5a3a6a', '#c8b89a'], w: 7,
    geo: () => colGeo([[Bx(2.3, 0.42, 0.95), 0, 0.25, 0], [Bx(2.3, 0.6, 0.22), 0, 0.68, -0.38], [Bx(0.2, 0.62, 0.95), -1.12, 0.36, 0], [Bx(0.2, 0.62, 0.95), 1.12, 0.36, 0], [Bx(1.0, 0.14, 0.7), -0.52, 0.52, 0.08, '#f0f0f0'], [Bx(1.0, 0.14, 0.7), 0.52, 0.52, 0.08, '#f0f0f0'], [Cyl(0.04, 0.03, 0.08, 6), -1.05, 0.04, 0.4, '#2a2a2a'], [Cyl(0.04, 0.03, 0.08, 6), 1.05, 0.04, 0.4, '#2a2a2a'], [Cyl(0.04, 0.03, 0.08, 6), -1.05, 0.04, -0.4, '#2a2a2a'], [Cyl(0.04, 0.03, 0.08, 6), 1.05, 0.04, -0.4, '#2a2a2a']]) },
  clothTable: { n: 'میز با رومیزی بلند', cat: 'مبلمان', size: [2.2, 0.8, 1.2], hide: [[0, 0, 'lie', 0.8, 'in']], tint: ['#e8e2d8', '#c8202a', '#2a5aa8', '#f2c12e', '#3a8a5a'], w: 6,
    geo: () => colGeo([[Bx(2.2, 0.05, 1.2), 0, 0.78, 0], [Bx(2.22, 0.74, 0.02), 0, 0.4, 0.6], [Bx(2.22, 0.74, 0.02), 0, 0.4, -0.6], [Bx(0.02, 0.74, 1.2), 1.1, 0.4, 0], [Bx(0.02, 0.74, 1.2), -1.1, 0.4, 0], [Cyl(0.12, 0.1, 0.25, 12), 0.5, 0.93, 0, '#f4f4f4'], [Sph(0.12, 10, 8), 0.5, 1.1, 0, '#e8303a'], [Cyl(0.05, 0.05, 0.3, 8), -0.5, 0.95, 0.1, '#a8d8f0']]) },
  curtain: { n: 'پردهٔ نمایش', cat: 'نمایش', size: [3.0, 2.6, 0.5], hide: [[0, -0.55, 'stand', 0.65, 'behind']], tint: ['#8a1a2a', '#1a2a6a', '#2a5a2a', '#5a1a6a', '#c88a1a'], w: 5,
    geo: () => { const p = [[Cyl(0.03, 0.03, 3.1, 8), 0, 2.55, 0, '#c9a24a', 0, 0, Math.PI / 2], [Cyl(0.035, 0.035, 2.6, 8), -1.5, 1.3, 0, '#c9a24a'], [Cyl(0.035, 0.035, 2.6, 8), 1.5, 1.3, 0, '#c9a24a'], [Bx(0.6, 0.05, 0.4), -1.5, 0.03, 0, '#3a3a3a'], [Bx(0.6, 0.05, 0.4), 1.5, 0.03, 0, '#3a3a3a']]; for (let k = 0; k < 14; k++) p.push([Bx(0.2, 2.45, 0.08), -1.38 + k * 0.212, 1.27, Math.sin(k * 1.3) * 0.06]); return colGeo(p); } },
  barrels: { n: 'بشکه‌ها', cat: 'انبار', size: [2.0, 1.0, 1.6], hide: [[0, -1.2, 'crouch', 0.5, 'behind']], tint: ['#2a5aa8', '#c8202a', '#3a7a3a', '#e8a81a', '#6a6a6a'], w: 6,
    geo: () => { const p = []; for (const [x, z, y] of [[-0.5, 0.3, 0], [0.5, 0.3, 0], [0, -0.35, 0]]) { p.push([Cyl(0.42, 0.42, 0.95, 18), x, y + 0.48, z]); for (const yy of [0.2, 0.75]) p.push([Cyl(0.43, 0.43, 0.04, 18), x, y + yy, z, '#3a3a3a']); } return colGeo(p); } },
  bed: { n: 'تخت خواب', cat: 'مبلمان', size: [1.6, 0.9, 2.1], hide: [[0, 0, 'lie', 0.75, 'in']], tint: ['#6a4a2a', '#e8e0d0', '#3a2a1a'], w: 5,
    geo: () => colGeo([[Bx(1.6, 0.3, 2.1), 0, 0.3, 0], [Bx(1.5, 0.22, 2.0), 0, 0.56, 0.02, '#f4f4f0'], [Bx(1.54, 0.06, 1.4), 0, 0.68, 0.32, '#3a5a8a'], [Bx(0.6, 0.14, 0.38), -0.38, 0.72, -0.75, '#ffffff'], [Bx(0.6, 0.14, 0.38), 0.38, 0.72, -0.75, '#ffffff'], [Bx(1.7, 1.0, 0.1), 0, 0.6, -1.06], ...[[-0.75, -1], [0.75, -1], [-0.75, 1], [0.75, 1]].map(([x, z]) => [Bx(0.08, 0.15, 0.08), x, 0.075, z])]) },
  container: { n: 'کانتینر', cat: 'انبار', size: [6.1, 2.6, 2.44], hide: [[0, 0, 'stand', 0.92, 'in']], tint: ['#b8321f', '#1f5f8b', '#2f7a3a', '#c8a020', '#6a6a72'], w: 4,
    geo: () => { const p = [[Bx(6.06, 2.56, 2.4), 0, 1.28, 0]]; for (let x = -2.9; x <= 2.9; x += 0.3) for (const s of [-1, 1]) p.push([Bx(0.12, 2.3, 0.04), x, 1.28, s * 1.21]); p.push([Bx(0.04, 2.3, 1.1), 3.04, 1.28, -0.58, '#d8d8d8'], [Bx(0.04, 2.3, 1.1), 3.04, 1.28, 0.58, '#d8d8d8']); for (const z of [-0.8, -0.35, 0.35, 0.8]) p.push([Cyl(0.02, 0.02, 2.3, 6), 3.07, 1.28, z, '#555555']); return colGeo(p); } },
  tent: { n: 'چادر', cat: 'باغ', size: [2.6, 1.9, 2.6], hide: [[0, 0, 'crouch', 0.85, 'in']], tint: ['#e85a1a', '#2a8a4a', '#2a5ad8', '#e8c81a'], w: 5,
    geo: () => colGeo([[new THREE.ConeGeometry(1.75, 1.9, 4, 1, false), 0, 0.95, 0, '#ffffff', 0, Math.PI / 4], [Bx(0.7, 1.1, 0.02), 0, 0.55, 1.06, '#2a2a2a', -0.48], [Cyl(0.02, 0.02, 0.4, 6), 0, 2.0, 0, '#888888']]) },
  plant: { n: 'گلدان درختچه', cat: 'باغ', size: [1.2, 2.4, 1.2], hide: [[0, -1.0, 'crouch', 0.4, 'behind']], tint: ['#ffffff'], w: 7,
    geo: () => { const p = [[Cyl(0.55, 0.42, 0.75, 18), 0, 0.37, 0, '#b8643a'], [Cyl(0.5, 0.5, 0.05, 18), 0, 0.73, 0, '#4a3020'], [Cyl(0.06, 0.08, 0.9, 6), 0, 1.1, 0, '#5a4030']]; for (let k = 0; k < 9; k++) p.push([new THREE.IcosahedronGeometry(0.45, 0), Math.sin(k * 2.4) * 0.4, 1.5 + (k % 3) * 0.3, Math.cos(k * 2.4) * 0.4, ['#3f7a2a', '#4f8a32', '#2f6a22'][k % 3]]); return colGeo(p); } },
  oldcar: { n: 'ماشین قدیمی', cat: 'انبار', size: [4.5, 1.5, 1.9], hide: [[0, -0.3, 'sit', 0.7, 'in']], tint: ['#8a2a2a', '#2a4a6a', '#c8b88a', '#3a3a3a', '#6a8a6a'], w: 3,
    geo: () => { const G = carGeos('sedan'); return colGeo([[G.paint], [G.cabin, 0, 0, 0, '#1a2228'], ...[[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz]) => [Cyl(0.34, 0.34, 0.24, 16), sx * 0.82, 0.34, sz * 1.35, '#141414', 0, 0, Math.PI / 2])]); } },
  tube: { n: 'تونل بازی', cat: 'بازی', size: [1.8, 1.8, 4.2], hide: [[0, 0, 'crouch', 0.7, 'in']], tint: ['#e8303a', '#2a6ad8', '#f2c12e', '#3ab84a'], w: 5,
    geo: () => colGeo([[new THREE.CylinderGeometry(0.88, 0.88, 4.0, 24, 1, true), 0, 0.88, 0, '#ffffff', Math.PI / 2], [new THREE.TorusGeometry(0.88, 0.07, 8, 24), 0, 0.88, 2.0, '#f4f4f4'], [new THREE.TorusGeometry(0.88, 0.07, 8, 24), 0, 0.88, -2.0, '#f4f4f4'], [Bx(1.6, 0.06, 3.9), 0, 0.04, 0, '#c8c8c8']]) },
  bookshelf: { n: 'کتابخانه', cat: 'مبلمان', size: [2.0, 2.4, 0.45], hide: [[0, -0.65, 'stand', 0.5, 'behind']], tint: ['#5a3a22', '#8a6a4a', '#2a2420'], w: 5,
    geo: () => { const p = [[Bx(2.0, 2.4, 0.06), 0, 1.2, -0.2], [Bx(0.05, 2.4, 0.42), -0.98, 1.2, 0], [Bx(0.05, 2.4, 0.42), 0.98, 1.2, 0]]; for (let s = 0; s < 5; s++) { p.push([Bx(1.95, 0.04, 0.42), 0, 0.05 + s * 0.55, 0]); if (s < 4) { let x = -0.9; let k = 0; while (x < 0.88) { const bw = 0.05 + ((k * 37) % 5) * 0.012, bh = 0.32 + ((k * 13) % 7) * 0.025; p.push([Bx(bw, bh, 0.3), x + bw / 2, 0.07 + s * 0.55 + bh / 2, 0.02, ['#8a2a2a', '#2a4a8a', '#2a6a3a', '#d8b84a', '#5a3a6a', '#e8e0d0'][k % 6]]); x += bw + 0.01; k++; } } } return colGeo(p); } },
  boxes: { n: 'کارتن‌های روی هم', cat: 'انبار', size: [1.6, 1.9, 1.3], hide: [[0, -1.05, 'crouch', 0.55, 'behind']], tint: ['#c8a070', '#b89060'], w: 8,
    geo: () => colGeo([[Bx(0.75, 0.6, 0.6), -0.4, 0.3, 0.3], [Bx(0.75, 0.6, 0.6), 0.4, 0.3, 0.3], [Bx(0.75, 0.6, 0.6), -0.4, 0.3, -0.32], [Bx(0.75, 0.6, 0.6), 0.4, 0.3, -0.32], [Bx(0.8, 0.6, 0.62), -0.1, 0.9, 0], [Bx(0.7, 0.55, 0.55), 0.35, 1.48, 0.1], [Bx(0.5, 0.04, 0.62), -0.1, 1.21, 0, '#e8d8b0'], [Bx(0.76, 0.03, 0.08), -0.4, 0.61, 0.3, '#8a7050']]) },
  piano: { n: 'پیانو', cat: 'نمایش', size: [1.6, 1.3, 0.75], hide: [[0, -0.8, 'crouch', 0.5, 'behind']], tint: ['#141414', '#3a2214', '#f4f4f4'], w: 3,
    geo: () => { const p = [[Bx(1.55, 1.25, 0.6), 0, 0.62, -0.05], [Bx(1.5, 0.1, 0.3), 0, 0.75, 0.3], [Bx(1.45, 0.03, 0.18), 0, 0.81, 0.33, '#f8f8f0']]; for (let k = 0; k < 18; k++) p.push([Bx(0.03, 0.02, 0.1), -0.68 + k * 0.08, 0.83, 0.3, '#111111']); p.push([Bx(0.6, 0.45, 0.35), 0, 0.23, 0.7]); return colGeo(p); } },
  statue: { n: 'مجسمه', cat: 'نمایش', size: [1.4, 3.2, 1.4], hide: [[0, -1.0, 'stand', 0.35, 'behind']], tint: ['#e8e4dc', '#b8a070', '#8a9098'], w: 3,
    geo: () => colGeo([[Bx(1.3, 1.0, 1.3), 0, 0.5, 0, '#a8a49c'], [Cyl(0.3, 0.45, 1.3, 14), 0, 1.65, 0], [Sph(0.32), 0, 2.55, 0], [new THREE.TorusGeometry(0.45, 0.1, 10, 24), 0, 2.95, 0, '#ffffff', 0.5]]) },
  playhouse: { n: 'خانهٔ بازی', cat: 'بازی', size: [2.4, 2.7, 2.4], hide: [[0, 0, 'crouch', 0.85, 'in']], tint: ['#f2e8d0', '#ffd8e8', '#d8f0ff'], w: 4,
    geo: () => colGeo([[Bx(2.3, 1.7, 0.08), 0, 0.85, -1.15], [Bx(0.08, 1.7, 2.3), -1.15, 0.85, 0], [Bx(0.08, 1.7, 2.3), 1.15, 0.85, 0], [Bx(0.75, 1.7, 0.08), -0.78, 0.85, 1.15], [Bx(0.75, 1.7, 0.08), 0.78, 0.85, 1.15], [Bx(0.8, 0.4, 0.08), 0, 1.5, 1.15], [new THREE.ConeGeometry(1.85, 1.0, 4), 0, 2.2, 0, '#c8302a', 0, Math.PI / 4], [Bx(0.5, 0.5, 0.1), -0.7, 1.05, 1.17, '#9fd0f0']]) },
  hay: { n: 'بستهٔ کاه', cat: 'باغ', size: [1.5, 1.2, 2.4], hide: [[0, -1.25, 'crouch', 0.5, 'behind']], tint: ['#e8c870', '#d8b860'], w: 5,
    geo: () => { const p = [[Bx(1.45, 1.15, 2.35), 0, 0.58, 0]]; for (const z of [-0.6, 0.6]) p.push([Bx(1.47, 1.17, 0.04), 0, 0.58, z, '#8a6a3a']); return colGeo(p); } },
  fridge: { n: 'یخچال بزرگ', cat: 'مبلمان', size: [0.9, 1.9, 0.75], hide: [[0, -0.75, 'stand', 0.45, 'behind']], tint: ['#e8e8e8', '#b8bcc0', '#2a2a2a'], w: 3,
    geo: () => colGeo([[Bx(0.9, 1.88, 0.72), 0, 0.94, 0], [Bx(0.86, 0.02, 0.02), 0, 1.25, 0.37, '#8a8a8a'], [Bx(0.03, 0.5, 0.04), 0.36, 1.5, 0.38, '#c8c8c8'], [Bx(0.03, 0.4, 0.04), 0.36, 0.8, 0.38, '#c8c8c8']]) },
  ballpit: { n: 'استخر توپ', cat: 'بازی', size: [3.0, 0.9, 3.0], hide: [[0, 0, 'lie', 0.8, 'in']], tint: ['#2a6ad8', '#e8303a'], w: 3,
    geo: () => { const p = [[Bx(3, 0.9, 0.15), 0, 0.45, 1.42], [Bx(3, 0.9, 0.15), 0, 0.45, -1.42], [Bx(0.15, 0.9, 3), 1.42, 0.45, 0], [Bx(0.15, 0.9, 3), -1.42, 0.45, 0]]; for (let k = 0; k < 90; k++) p.push([Sph(0.1, 6, 4), ((k * 37) % 26) / 10 - 1.3, 0.55 + (k % 3) * 0.08, ((k * 53) % 26) / 10 - 1.3, ['#e8303a', '#2a6ad8', '#f2c12e', '#3ab84a', '#e85aa8'][k % 5]]); return colGeo(p); } },
  arcade: { n: 'دستگاه بازی', cat: 'بازی', size: [1.0, 1.9, 0.9], hide: [[0, -0.8, 'crouch', 0.45, 'behind']], tint: ['#1a1a2a', '#3a1a4a'], w: 3,
    geo: () => colGeo([[Bx(1.0, 1.85, 0.85), 0, 0.92, 0], [Bx(0.8, 0.55, 0.02), 0, 1.35, 0.43, '#3ab8ff'], [Bx(0.95, 0.12, 0.35), 0, 0.95, 0.55, '#c8202a'], [Bx(1.0, 0.2, 0.7), 0, 1.92, 0.05, '#ff5ad8']]) },
  // build-mode only shapes (also usable for hiding when big enough)
  wall: { n: 'دیوار', cat: 'ساختمانی', size: [4, 3, 0.3], hide: [[0, -0.6, 'stand', 0.55, 'behind']], tint: ['#e8e2d8', '#c8a080', '#8a8a92'], w: 0, geo: () => colGeo([[Bx(4, 3, 0.3), 0, 1.5, 0]]) },
  pillar: { n: 'ستون', cat: 'ساختمانی', size: [1, 4, 1], hide: [[0, -0.9, 'stand', 0.3, 'behind']], tint: ['#f4f0ea'], w: 0, geo: () => colGeo([[Cyl(0.5, 0.5, 4, 24), 0, 2, 0], [Bx(1.2, 0.2, 1.2), 0, 0.1, 0, '#d8d0c4'], [Bx(1.2, 0.2, 1.2), 0, 3.9, 0, '#d8d0c4']]) },
  platform: { n: 'سکو', cat: 'ساختمانی', size: [4, 0.5, 4], hide: [], tint: ['#8a9098', '#c8b090'], w: 0, geo: () => colGeo([[Bx(4, 0.5, 4), 0, 0.25, 0]]) },
  cube: { n: 'مکعب رنگی', cat: 'ساختمانی', size: [2, 2, 2], hide: [[0, -1.4, 'crouch', 0.5, 'behind']], tint: ['#e8303a', '#2a6ad8', '#f2c12e', '#3ab84a', '#ff8a1a', '#a03aff'], w: 0, geo: () => colGeo([[Bx(2, 2, 2), 0, 1, 0]]) },
  ballBig: { n: 'توپ بزرگ', cat: 'بازی', size: [2, 2, 2], hide: [[0, -1.4, 'crouch', 0.4, 'behind']], tint: ['#e8303a', '#2a6ad8', '#f2c12e'], w: 0, geo: () => colGeo([[Sph(1, 24, 16), 0, 1, 0]]) },
  tree: { n: 'درخت', cat: 'باغ', size: [3, 5, 3], hide: [[0, -1.0, 'stand', 0.35, 'behind']], tint: ['#ffffff'], w: 0, geo: () => { const p = [[Cyl(0.18, 0.25, 2.4, 8), 0, 1.2, 0, '#5a4030']]; for (let k = 0; k < 10; k++) p.push([new THREE.IcosahedronGeometry(1.0, 0), Math.sin(k * 2.4) * 0.9, 2.8 + (k % 3) * 0.6, Math.cos(k * 2.4) * 0.9, ['#3f7a2a', '#4f8a32', '#2f6a22'][k % 3]]); return colGeo(p); } },
  chair: { n: 'صندلی', cat: 'مبلمان', size: [0.5, 0.95, 0.5], hide: [], tint: ['#8a5a32', '#2a2a2a', '#c8202a'], w: 0, geo: () => colGeo([[Bx(0.46, 0.05, 0.46), 0, 0.46, 0], [Bx(0.46, 0.5, 0.04), 0, 0.72, -0.21], ...[[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].map(([x, z]) => [Bx(0.04, 0.45, 0.04), x, 0.22, z])]) },
  lamp: { n: 'چراغ پایه‌دار', cat: 'نمایش', size: [0.6, 2.0, 0.6], hide: [], tint: ['#fff4d8'], w: 0, geo: () => colGeo([[Cyl(0.2, 0.25, 0.05, 16), 0, 0.03, 0, '#2a2a2a'], [Cyl(0.025, 0.025, 1.7, 8), 0, 0.88, 0, '#2a2a2a'], [Cyl(0.18, 0.3, 0.35, 16, 1, true), 0, 1.8, 0]]) },
  stairs: { n: 'پله', cat: 'ساختمانی', size: [2, 2, 4], hide: [], tint: ['#c8c0b4'], w: 0, geo: () => { const p = []; for (let k = 0; k < 8; k++) p.push([Bx(2, 0.25 * (k + 1), 0.5), 0, 0.125 * (k + 1), 1.75 - k * 0.5]); return colGeo(p); }, steps: true }
};
const rbMats = {};
/* ---------- collision outlines that follow each object's real shape (object space):
   ['b', cx, cz, width, depth, y0, y1] boxes and ['c', cx, cz, radius, y0, y1] cylinders ---------- */
const RB_COLS = {
  wardrobe: [['b', 0, 0.01, 2.06, 0.72, 0, 2.3]],
  crate: [['b', 0, 0, 1.8, 1.8, 0, 1.8]],
  sofa: [['b', 0, 0.02, 2.3, 0.95, 0, 0.47], ['b', 0, -0.38, 2.3, 0.22, 0, 0.98], ['b', -1.12, 0, 0.2, 0.95, 0, 0.67], ['b', 1.12, 0, 0.2, 0.95, 0, 0.67]],
  clothTable: [['b', 0, 0, 2.22, 1.22, 0, 0.81]],
  curtain: [['b', 0, 0, 3.07, 0.3, 0, 2.58]],
  barrels: [['c', -0.5, 0.3, 0.43, 0, 0.96], ['c', 0.5, 0.3, 0.43, 0, 0.96], ['c', 0, -0.35, 0.43, 0, 0.96]],
  bed: [['b', 0, 0, 1.6, 2.1, 0, 0.75], ['b', 0, -1.06, 1.7, 0.1, 0, 1.1]],
  container: [['b', 0, 0, 6.12, 2.44, 0, 2.6]],
  tent: [['b', 0, 0, 2.47, 2.47, 0, 1.0], ['b', 0, 0, 1.2, 1.2, 1.0, 1.9]],
  plant: [['c', 0, 0, 0.55, 0, 0.76], ['c', 0, 0, 0.85, 1.05, 2.4]],
  tube: [['b', -0.9, 0, 0.16, 4.1, 0, 1.8], ['b', 0.9, 0, 0.16, 4.1, 0, 1.8], ['b', 0, 0, 1.96, 4.1, 1.55, 1.8]],
  bookshelf: [['b', 0, -0.02, 2.0, 0.46, 0, 2.4]],
  boxes: [['b', 0, -0.01, 1.55, 1.24, 0, 1.2], ['b', -0.1, 0, 0.8, 0.62, 1.2, 1.75]],
  piano: [['b', 0, -0.05, 1.55, 0.6, 0, 1.25], ['b', 0, 0.3, 1.5, 0.3, 0.7, 0.86], ['b', 0, 0.7, 0.6, 0.35, 0, 0.46]],
  statue: [['b', 0, 0, 1.3, 1.3, 0, 1.0], ['c', 0, 0, 0.45, 1.0, 2.9]],
  playhouse: [['b', 0, -1.15, 2.38, 0.08, 0, 1.7], ['b', -1.15, 0, 0.08, 2.38, 0, 1.7], ['b', 1.15, 0, 0.08, 2.38, 0, 1.7], ['b', -0.78, 1.15, 0.79, 0.08, 0, 1.7], ['b', 0.78, 1.15, 0.79, 0.08, 0, 1.7], ['b', 0, 1.15, 0.8, 0.08, 1.3, 1.7], ['b', 0, 0, 2.62, 2.62, 1.7, 2.7]],
  hay: [['b', 0, 0, 1.47, 2.36, 0, 1.17]],
  fridge: [['b', 0, 0.01, 0.9, 0.76, 0, 1.88]],
  ballpit: [['b', 0, 1.42, 3, 0.15, 0, 0.9], ['b', 0, -1.42, 3, 0.15, 0, 0.9], ['b', 1.42, 0, 0.15, 3, 0, 0.9], ['b', -1.42, 0, 0.15, 3, 0, 0.9]],
  arcade: [['b', 0, 0, 1.0, 0.86, 0, 2.02], ['b', 0, 0.55, 0.95, 0.35, 0.89, 1.01]],
  wall: [['b', 0, 0, 4, 0.3, 0, 3]],
  pillar: [['c', 0, 0, 0.5, 0, 4]],
  platform: [['b', 0, 0, 4, 4, 0, 0.5]],
  cube: [['b', 0, 0, 2, 2, 0, 2]],
  ballBig: [['c', 0, 0, 1.0, 0, 2]],
  tree: [['c', 0, 0, 0.25, 0, 2.4], ['c', 0, 0, 1.7, 1.85, 4.6]],
  chair: [['b', 0, -0.01, 0.48, 0.48, 0, 0.97]],
  lamp: [['c', 0, 0, 0.12, 0, 1.62], ['c', 0, 0, 0.3, 1.62, 1.98]],
  stairs: Array.from({ length: 8 }, (_, k) => ['b', 0, 1.75 - k * 0.5, 2, 0.5, 0, 0.25 * (k + 1)])
};
function rbShapes(type) {
  const T_ = RB_TYPES[type]; if (T_.shapes) return T_.shapes;
  let s = RB_COLS[type];
  if (!s) { if (!T_.g) T_.g = T_.geo(); const bb = T_.g.boundingBox; s = [['b', (bb.min.x + bb.max.x) / 2, (bb.min.z + bb.max.z) / 2, bb.max.x - bb.min.x, bb.max.z - bb.min.z, Math.max(0, bb.min.y), bb.max.y]]; }
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const q of s) { const hx = q[0] === 'b' ? q[3] / 2 : q[3], hz = q[0] === 'b' ? q[4] / 2 : q[3]; x0 = Math.min(x0, q[1] - hx); x1 = Math.max(x1, q[1] + hx); z0 = Math.min(z0, q[2] - hz); z1 = Math.max(z1, q[2] + hz); }
  T_.foot = [x0, x1, z0, z1]; T_.shapes = s; return s;
}
function rbAddObjCol(col, o) {
  const sx = o.sx || 1, sy = o.sy || 1, sz = o.sz || 1, y0 = o.y || 0, c = Math.cos(o.ry), s = Math.sin(o.ry);
  for (const q of rbShapes(o.type)) {
    const lx = q[1] * sx, lz = q[2] * sz, wx = o.x + lx * c + lz * s, wz = o.z - lx * s + lz * c;
    if (q[0] === 'c') { if (Math.abs(sx - sz) < 0.01) col.circle(wx, wz, q[3] * sx, y0 + q[4] * sy, y0 + q[5] * sy); else col.obb(wx, wz, q[3] * sx, q[3] * sz, o.ry, y0 + q[4] * sy, y0 + q[5] * sy); }
    else col.obb(wx, wz, q[3] / 2 * sx, q[4] / 2 * sz, o.ry, y0 + q[5] * sy, y0 + q[6] * sy);
  }
}
/* ---------- the hall: 10 km × 20 km floors, 10 000 of them, streamed in 50 m chunks around you ---------- */
const rbScene = new THREE.Scene(); rbScene.background = new THREE.Color(0x2a2140); rbScene.fog = new THREE.Fog(0x2a2140, 26, 100);
let rbPool = null, rbSun = null, rbHemi = null, rbGrid = null;
const rbCi = x => clamp(Math.floor((x + RB_W / 2) / RB_CH), 0, RB_NI - 1), rbCj = z => clamp(Math.floor((z + RB_L / 2) / RB_CH), 0, RB_NJ - 1);
const rbIsCore = (i, j) => i % 5 === 2 && j % 5 === 2;
const rbCoreXZ = (i, j) => [-RB_W / 2 + (i + 0.5) * RB_CH, -RB_L / 2 + (j + 0.5) * RB_CH];
const RBY = () => rb.floor * RB_FH;
function rbNearestCore(x, z) { const i = clamp(Math.round((rbCi(x) - 2) / 5) * 5 + 2, 2, RB_NI - 3), j = clamp(Math.round((rbCj(z) - 2) / 5) * 5 + 2, 2, RB_NJ - 3); const [cx, cz] = rbCoreXZ(i, j); return { i, j, x: cx, z: cz }; }
function rbInCore(x, z, m = 0.5) { for (const k of rb.cores) if (Math.abs(x - k.x) < 7 + m && z - k.z > -15.5 - m && z - k.z < 15.5 + m) return k; return null; }
const rbCache = new Map();
const RB_ZONES = [['wardrobe', 'sofa', 'clothTable', 'bed', 'bookshelf', 'fridge', 'piano'], ['crate', 'barrels', 'container', 'boxes', 'oldcar', 'crate'], ['tube', 'playhouse', 'ballpit', 'arcade', 'tent'], ['plant', 'hay', 'tent', 'statue', 'curtain', 'plant']];
// one 50 m square of one floor: always the same things in the same places (per level)
function rbChunk(f, i, j) {
  const key = f + ':' + i + ':' + j; let C = rbCache.get(key); if (C) return C;
  if (rbCache.size > 1200) for (const [k, v] of rbCache) { if (rbCache.size <= 900) break; if (!v.win && !v.spots.some(s => s.used)) rbCache.delete(k); }
  const L = rbSettings().level, rnd = makeRng((Math.imul(L + 1, 73856093) ^ Math.imul(f + 7, 19349663) ^ Math.imul(i + 3, 83492791) ^ Math.imul(j + 11, 40503)) >>> 0);
  const x0 = -RB_W / 2 + i * RB_CH, z0 = -RB_L / 2 + j * RB_CH, core = rbIsCore(i, j) ? rbCoreXZ(i, j) : null;
  const objs = [], spots = [], zone = RB_ZONES[Math.floor(rnd() * 4)], n = (LOW ? 9 : 12) + Math.floor(rnd() * (LOW ? 6 : 9));
  for (let t = 0; objs.length < n && t < n * 14; t++) {
    const big = rnd() < 0.05, type = big ? ['container', 'statue', 'tree', 'tent', 'hay'][Math.floor(rnd() * 5)] : rnd() < 0.8 ? zone[Math.floor(rnd() * zone.length)] : pickW(rnd);
    const T_ = RB_TYPES[type]; rbShapes(type); const sc = big ? 1.5 : 1, rot = Math.floor(rnd() * 4), [fx0, fx1, fz0, fz1] = T_.foot;
    const hw = (rot % 2 ? fz1 - fz0 : fx1 - fx0) * sc / 2, hd = (rot % 2 ? fx1 - fx0 : fz1 - fz0) * sc / 2;
    const x = x0 + 2 + hw + rnd() * Math.max(0, RB_CH - 4 - 2 * hw), z = z0 + 2 + hd + rnd() * Math.max(0, RB_CH - 4 - 2 * hd), r = Math.max(hw, hd);
    // keep clear: the pillars on the chunk corners, the stair core and its doors, the entrance, the outer walls
    if (Math.min(Math.hypot(x - x0, z - z0), Math.hypot(x - x0 - RB_CH, z - z0), Math.hypot(x - x0, z - z0 - RB_CH), Math.hypot(x - x0 - RB_CH, z - z0 - RB_CH)) < 3.2 + r) continue;
    if (core && x - core[0] > -12 - hw && x - core[0] < 10 + hw && z - core[1] > -18 - hd && z - core[1] < 23 + hd) continue;
    if (f === 0 && Math.abs(x) < 16 + hw && z > RB_L / 2 - 36 - hd) continue;
    if (objs.some(o => Math.abs(o.x - x) < o.hw + hw + 2.2 && Math.abs(o.z - z) < o.hd + hd + 2.2)) continue;
    objs.push({ type, x, z, y: 0, ry: rot * Math.PI / 2, sx: sc, sy: sc, sz: sc, tint: T_.tint[Math.floor(rnd() * T_.tint.length)], hw, hd, f });
  }
  for (const o of objs) rbObjSpots(o, spots);
  C = { key, f, i, j, objs, spots, core: core ? { x: core[0], z: core[1], i, j } : null, win: false }; rbCache.set(key, C); return C;
}
function rbObjSpots(o, out) {
  const T_ = RB_TYPES[o.type], sx = o.sx || 1, sy = o.sy || 1, sz = o.sz || 1, c = Math.cos(o.ry), s = Math.sin(o.ry), y0 = o.y || 0;
  for (const [lx, lz, pose, conceal, kind] of T_.hide) {
    const px = o.x + lx * sx * c + lz * sz * s, pz = o.z - lx * sx * s + lz * sz * c;
    out.push({ x: px, z: pz, y: y0, pose, conceal: Math.min(0.95, conceal * (kind === 'in' ? 1 : Math.min(1.3, Math.sqrt(sx * sy)))), kind, face: o.ry + (kind === 'behind' ? (lz < 0 ? Math.PI : 0) : 0), o, name: T_.n, used: null, checked: -99, fl: o.f || 0 });
  }
}
const rbPlacedSpots = new WeakMap();
const rbObjKey = o => [o.type, o.x, o.z, o.y, o.ry, o.sx, o.sy, o.sz].join('|');
function pickW(rnd) { const ks = Object.keys(RB_TYPES).filter(k => RB_TYPES[k].w > 0); let tot = 0; for (const k of ks) tot += RB_TYPES[k].w; let r = rnd() * tot; for (const k of ks) { r -= RB_TYPES[k].w; if (r <= 0) return k; } return ks[0]; }
function rbMat(type) { return rbMats[type] || (rbMats[type] = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: ['container', 'oldcar', 'fridge', 'arcade', 'piano'].includes(type) ? 0.35 : 0.75, metalness: ['container', 'oldcar', 'fridge'].includes(type) ? 0.35 : 0.02, side: type === 'tube' ? THREE.DoubleSide : THREE.FrontSide })); }
const _rm = new THREE.Matrix4(), _rq = new THREE.Quaternion(), _rv = new V3(), _rs = new V3(), _ry = new V3(0, 1, 0);
/* ---------- merged box geometry for the stair cores ---------- */
function rbBoxes(list) {
  const gs = [];
  for (const b of list) {
    let g;
    if (Array.isArray(b)) { const [x0, x1, y0, y1, z0, z1] = b; g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).toNonIndexed(); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); }
    else { g = new THREE.BoxGeometry(b.w, b.h, b.d).toNonIndexed(); g.rotateX(b.rx || 0); g.translate(b.x, b.y, b.z); }
    gs.push(g);
  }
  let tot = 0; for (const g of gs) tot += g.attributes.position.count;
  const pos = new Float32Array(tot * 3), nor = new Float32Array(tot * 3), uv = new Float32Array(tot * 2); let o = 0;
  for (const g of gs) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; g.dispose(); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.computeBoundingSphere(); return out;
}
/* a stair core: a switchback staircase (west half) and an up + a down escalator (east half),
   enclosed, with doors on the south face; built for the floor below, this floor and the one above */
const RB_ESC = { run: 17.3, zb: 12, speed: 1.5 };
function rbCoreTemplate() {
  const FH = RB_FH, W = [], C = [], Mt = [], Gl = [], Bl = [], Rl = [], Lp = [], col = [], doors = [], bars = [];
  const box = (arr, x0, x1, y0, y1, z0, z1, c = true) => { arr.push([x0, x1, y0, y1, z0, z1]); if (c) col.push([x0, x1, z0, z1, y0, y1]); };
  const ang = Math.atan2(FH, RB_ESC.run), Ls = Math.hypot(FH, RB_ESC.run), zt = RB_ESC.zb - RB_ESC.run, zm = (RB_ESC.zb + zt) / 2;
  for (let L = -1; L <= 1; L++) {
    const yb = L * FH, yt = yb + FH;
    // walls (the south face has a doorway for the stairs and one for the escalators)
    box(W, -7, -6.7, yb, yt, -15.5, -4.6); box(W, -7, -6.7, yb, yt, -2.2, 15.5); box(W, -7, -6.7, yb + 3, yt, -4.6, -2.2); box(W, 6.7, 7, yb, yt, -15.5, 15.5); box(W, -7, 7, yb, yt, -15.5, -15.2);
    box(W, -7, -4.6, yb, yt, 15.2, 15.5); box(W, -2.2, 4.3, yb, yt, 15.2, 15.5); box(W, 6.5, 7, yb, yt, 15.2, 15.5);
    box(W, -4.6, -2.2, yb + 3, yt, 15.2, 15.5); box(W, 4.3, 6.5, yb + 3, yt, 15.2, 15.5);
    box(W, -0.3, 0.3, yb, yt, -15.2, 15.2);
    // the elevator: a cabin behind a door in the west wall, solid masonry round it
    box(W, -6.7, -0.3, yb, yt, -15.2, -5.5); box(W, -3.7, -0.3, yb, yt, -5.5, -1); box(W, -6.7, -3.7, yb, yt, -1.3, -1);
    box(C, -6.7, -3.7, yb - 0.4, yb, -5.5, -1.3); box(W, -6.7, -3.7, yb + 3.2, yt, -5.5, -1.3);
    Lp.push([-6.2, -4.2, yb + 3.14, yb + 3.2, -4.8, -2.0], [-3.74, -3.7, yb + 1.45, yb + 1.62, -3.12, -2.58]); Mt.push([-3.78, -3.7, yb + 0.95, yb + 1.7, -3.2, -2.5]); for (let q = 0; q < 6; q++) Bl.push([-3.8, -3.77, yb + 1.05 + (q % 3) * 0.12, yb + 1.13 + (q % 3) * 0.12, -3.05 + (q >> 1 & 1) * 0.3, -2.95 + (q >> 1 & 1) * 0.3]);
    doors.push({ L, x: -3.4, y: yb, w: 2.4 }, { L, x: 5.4, y: yb, w: 2.2 }, { L, axis: 'z', z: -3.4, y: yb, w: 2.4 });
    // stairs: landing, flight 1 up the west lane, mid landing, flight 2 back up the east lane
    box(C, -6.7, -0.3, yb - 0.4, yb, 11, 15.2);
    for (let k = 0; k < 25; k++) { const t = yb + 0.2 * (k + 1); box(C, -6.7, -3.8, t - 0.45, t, 11 - 0.3 * (k + 1), 11 - 0.3 * k); }
    box(C, -6.7, -0.3, yb + 4.6, yb + 5, -1, 3.5);
    for (let k = 0; k < 25; k++) { const t = yb + 5 + 0.2 * (k + 1); box(C, -3.2, -0.3, t - 0.45, t, 3.5 + 0.3 * k, 3.5 + 0.3 * (k + 1)); }
    box(W, -3.8, -3.2, yb, yt, 3.5, 11);
    { const a = Math.atan2(5, 7.5), l = Math.hypot(5, 7.5) + 0.3; Rl.push({ w: 0.06, h: 0.06, d: l, x: -6.58, y: yb + 2.5 + 0.95, z: 7.25, rx: a }, { w: 0.06, h: 0.06, d: l, x: -0.42, y: yb + 7.5 + 0.95, z: 7.25, rx: -a }); }
    // escalator hall floor, with the openings where the escalators pass through
    // (the openings are long enough that a rider always has more than two metres over their head)
    const oA = 1.7, oB = 5.0;
    box(C, 0.3, 6.7, yb - 0.4, yb, -15.2, -5.3); box(C, 1.9, 6.7, yb - 0.4, yb, -5.3, oA); box(C, 0.3, 6.7, yb - 0.4, yb, oA, oB);
    box(C, 0.3, 2.3, yb - 0.4, yb, oB, 12); box(C, 3.9, 6.7, yb - 0.4, yb, oB, 12); box(C, 0.3, 6.7, yb - 0.4, yb, 12, 15.2);
    // guard rails round the openings
    box(Gl, 0.3, 1.9, yb, yb + 1.1, oA, oA + 0.15); box(Gl, 2.3, 3.9, yb, yb + 1.1, oB - 0.15, oB); box(Gl, 3.9, 4.1, yb, yb + 1.1, oB, 12);
    // escalator A goes up from this level, escalator B comes down into it from the level above
    const NS = 40;
    for (let k = 0; k < NS; k++) {
      const za = RB_ESC.zb - RB_ESC.run * (k + 1) / NS, zz = RB_ESC.zb - RB_ESC.run * k / NS, u = (k + 0.5) / NS, yA = yb + FH * u, yB = yb + FH * (1 - u);
      col.push([0.3, 1.9, za, zz, yA - 0.9 < yb + 2.2 ? yb : yA - 0.9, yA]);
      col.push([2.3, 3.9, za, zz, yB - 0.9 < yb + 2.2 ? yb : yB - 0.9, yB]);
      col.push([1.9, 2.3, za, zz, Math.min(yA, yB) - 0.9, Math.max(yA, yB) + 1.1]);
      col.push([3.9, 4.1, za, zz, yB - 0.9, yB + 1.1]);
      // side cladding where the escalator is too low to walk under
      if (yA - 0.9 < yb + 2.2) Mt.push([0.3, 1.9, yb, yA - 0.6, za, zz]);
      if (yB - 0.9 < yb + 2.2) Mt.push([2.3, 3.9, yb, yB - 0.6, za, zz]);
    }
    for (const [xc, a] of [[1.1, ang], [3.1, -ang]]) {
      Bl.push({ w: 1.5, h: 0.14, d: Ls + 0.2, x: xc, y: yb + FH / 2, z: zm, rx: a });
      Mt.push({ w: 1.5, h: 0.75, d: Ls, x: xc, y: yb + FH / 2 - 0.5 / Math.cos(ang), z: zm, rx: a });
      for (const s of [-1, 1]) { Gl.push({ w: 0.04, h: 0.9, d: Ls, x: xc + s * 0.78, y: yb + FH / 2 + 0.55, z: zm, rx: a }); Rl.push({ w: 0.09, h: 0.07, d: Ls + 0.4, x: xc + s * 0.78, y: yb + FH / 2 + 1.03, z: zm, rx: a }); }
    }
    // the bottom floor has nowhere further down, the top floor nowhere further up
    bars.push({ L, kind: 'down', b: [[-3.2, -0.3, yb, yb + 1.15, 10.6, 10.75], [2.3, 3.9, yb, yb + 1.15, 12.05, 12.2]] }, { L, kind: 'up', b: [[-6.7, -3.8, yb, yb + 1.15, 11.05, 11.2], [0.3, 1.9, yb, yb + 1.15, 12.05, 12.2]] });
  }
  return { W, C, Mt, Gl, Bl, Rl, Lp, col, doors, bars };
}
let rbCoreT = null; const rbCoreMeshes = [];
function rbCoreMats() {
  if (rbCoreMats.m) return rbCoreMats.m;
  const c = mkCanvas(64, 256), g = c.getContext('2d'); g.fillStyle = '#4a4e56'; g.fillRect(0, 0, 64, 256); g.fillStyle = '#2a2d33'; for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 64, 5); g.fillStyle = '#e8c020'; g.fillRect(0, 0, 4, 256); g.fillRect(60, 0, 4, 256);
  const bt = toTex(c); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(1, 10);
  return rbCoreMats.m = {
    wall: rbMaterial(THREE.FrontSide, true, 9), conc: new THREE.MeshStandardMaterial({ color: 0xd6d0e0, roughness: 0.82 }), metal: new THREE.MeshStandardMaterial({ color: 0xaab0ba, metalness: 0.6, roughness: 0.35 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.1, depthWrite: false }), rail: new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.5 }),
    belt: new THREE.MeshStandardMaterial({ map: bt, metalness: 0.45, roughness: 0.45 }), door: new THREE.MeshStandardMaterial({ color: 0x241c40, emissive: 0x6a4ad8, emissiveIntensity: 0.4, metalness: 0.4, roughness: 0.25 }),
    bar: new THREE.MeshStandardMaterial({ color: 0xffc020, roughness: 0.5 }), lamp: new THREE.MeshBasicMaterial({ color: 0xfff4e0 })
  };
}
const rbSignMats = [null, null, null]; let rbSignFloor = -1;
function rbSignTex(k, f) {
  const c = rbSignMats[k] ? rbSignMats[k].map.image : mkCanvas(512, 128), g = c.getContext('2d');
  g.fillStyle = '#14162a'; g.fillRect(0, 0, 512, 128); g.fillStyle = f < 0 || f >= RB_FLOORS ? '#555' : '#ffffff'; g.font = '72px Lalezar, Vazirmatn, Tahoma'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillText(f < 0 ? '—' : f >= RB_FLOORS ? 'بام' : 'طبقهٔ ' + fa(f), 256, 70, 480);
  if (!rbSignMats[k]) rbSignMats[k] = new THREE.MeshBasicMaterial({ map: toTex(c), toneMapped: false, fog: true }); else rbSignMats[k].map.needsUpdate = true;
}
function rbMakeCore() {
  if (!rbCoreT) rbCoreT = rbCoreTemplate();
  const T_ = rbCoreT, M_ = rbCoreMats(), grp = new THREE.Group();
  if (!rbMakeCore.g) rbMakeCore.g = { wall: rbBoxes(T_.W), conc: rbBoxes(T_.C), metal: rbBoxes(T_.Mt), glass: rbBoxes(T_.Gl), belt: rbBoxes(T_.Bl), rail: rbBoxes(T_.Rl), lamp: rbBoxes(T_.Lp) };
  for (const [k, geo] of Object.entries(rbMakeCore.g)) { const m = new THREE.Mesh(geo, M_[k]); m.receiveShadow = true; m.castShadow = false; m.frustumCulled = false; grp.add(m); }
  grp.userData.doors = T_.doors.map(d => { const ps = [-1, 1].map(s => { const m = d.axis === 'z' ? new THREE.Mesh(new THREE.BoxGeometry(0.08, 3, d.w / 2), M_.door) : new THREE.Mesh(new THREE.BoxGeometry(d.w / 2, 3, 0.08), M_.door); if (d.axis === 'z') m.position.set(-6.85, d.y + 1.5, d.z + s * d.w / 4); else m.position.set(d.x + s * d.w / 4, d.y + 1.5, 15.35); grp.add(m); return m; }); return Object.assign({ ps, open: 0 }, d); });
  grp.userData.bars = T_.bars.map(b => { const m = new THREE.Mesh(rbBoxes(b.b), M_.bar); grp.add(m); return Object.assign({ m }, b); });
  grp.userData.signs = [-1, 0, 1].map((L, k) => { if (!rbSignMats[k]) rbSignTex(k, 0); const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), rbSignMats[k]); m.position.set(1.2, L * RB_FH + 4.4, 15.56); grp.add(m); return m; });
  rbScene.add(grp); return grp;
}
function rbPlaceCores() {
  if (rbSignFloor !== rb.floor) { rbSignFloor = rb.floor; for (let k = 0; k < 3; k++) rbSignTex(k, rb.floor + k - 1); }
  rb.cores.forEach((k, idx) => {
    const g = rbCoreMeshes[idx] || (rbCoreMeshes[idx] = rbMakeCore()); g.visible = true; g.position.set(k.x, 0, k.z); g.updateMatrixWorld(true);
    for (const b of g.userData.bars) { const ab = rb.floor + b.L; b.m.visible = (b.kind === 'down' && ab === 0) || (b.kind === 'up' && ab === RB_FLOORS - 1); }
    k.g = g;
  });
  for (let i = rb.cores.length; i < rbCoreMeshes.length; i++) rbCoreMeshes[i].visible = false;
}
// doors slide open for whoever comes near on that level, and close behind them
function rbUpdateDoors(dt) {
  const P = player, who = [P]; for (const n of rb.people) if (n.H.visible) who.push(n);
  for (const k of rb.cores) {
    if (!k.g) continue;
    for (const d of k.g.userData.doors) {
      const ax = d.axis === 'z', dx = ax ? k.x - 6.85 : k.x + d.x, dz = ax ? k.z + d.z : k.z + 15.35; let want = 0;
      if (!(ax && rb.lift && rb.lift.k === k)) for (const p of who) if (Math.abs(p.pos.x - dx) < (ax ? 4.2 : 3.4) && Math.abs(p.pos.z - dz) < (ax ? 3.4 : 4.2) && Math.abs(p.pos.y - d.y) < 2.4) { want = 1; break; }
      d.open = clamp(d.open + (want ? 3 : -2) * dt, 0, 1); const e = d.open * d.open * (3 - 2 * d.open);
      if (ax) { d.ps[0].position.z = d.z - d.w / 4 - e * d.w * 0.48; d.ps[1].position.z = d.z + d.w / 4 + e * d.w * 0.48; }
      else { d.ps[0].position.x = d.x - d.w / 4 - e * d.w * 0.48; d.ps[1].position.x = d.x + d.w / 4 + e * d.w * 0.48; }
    }
  }
}
function rbInLift(p) { for (const k of rb.cores) { const lx = p.pos.x - k.x, lz = p.pos.z - k.z; if (lx > -6.7 && lx < -3.7 && lz > -5.5 && lz < -1.3 && Math.abs(p.pos.y) < 1.5) return k; } return null; }
function rbSetFloor(nf) { nf = clamp(Math.round(nf), 0, RB_FLOORS - 1); if (nf === rb.floor) return; for (const n of rb.people) if (!n.virt) rbToVirt(n); rb.floor = nf; rbBuildWindow(); rbUpdateDoors(0); }
function openLift() { $('lift-panel').hidden = false; $('lift-now').textContent = `الان طبقهٔ ${fa(rb.floor)} هستی · ساختمان ${fa(RB_FLOORS)} طبقه داره (۰ تا ${fa(RB_FLOORS - 1)})`; $('lift-in').value = ''; }
function rbLiftGo(to) {
  $('lift-panel').hidden = true; const k = rbInLift(player); to = clamp(Math.round(to), 0, RB_FLOORS - 1); if (!k || !isFinite(to)) return; if (to === rb.floor) { toast('همین طبقه‌ای!'); return; }
  rb.lift = { t: 0, from: rb.floor, to, dur: 2.4 + Math.min(6, Math.log10(1 + Math.abs(to - rb.floor)) * 1.5), k }; Audio.tick(); toast(`آسانسور به طبقهٔ ${fa(to)} می‌ره`);
}
function rbUpdateLift(dt) {
  const L = rb.lift; L.t += dt; const u = clamp((L.t - 0.9) / (L.dur - 0.9), 0, 1), e = u * u * (3 - 2 * u), cur = Math.round(L.from + (L.to - L.from) * e);
  setPrompt(`آسانسور ${L.to > L.from ? '▲' : '▼'} طبقهٔ <b>${fa(cur)}</b>`, ''); if (u > 0 && u < 1) cam.shake = Math.max(cam.shake, 0.025);
  if (L.t >= L.dur) { rb.lift = null; rbSetFloor(L.to); Audio.tick(); banner(`طبقهٔ ${fa(L.to)}`, 'درِ آسانسور باز شد'); }
}
// the camera must not slip through a closed core door
function rbDoorHit(ox, oy, oz, dx, dy, dz, maxD) {
  let t = maxD;
  for (const k of rb.cores) {
    if (!k.g) continue;
    if (Math.abs(dz) > 1e-6) { const tz = (k.z + 15.35 - oz) / dz; if (tz > 0 && tz < t) { const x = ox + dx * tz - k.x, y = oy + dy * tz; for (const d of k.g.userData.doors) if (!d.axis && d.open < 0.9 && Math.abs(x - d.x) < d.w / 2 && y > d.y && y < d.y + 3) t = tz; } }
    if (Math.abs(dx) > 1e-6) { const tx = (k.x - 6.85 - ox) / dx; if (tx > 0 && tx < t) { const z = oz + dz * tx - k.z, y = oy + dy * tx; for (const d of k.g.userData.doors) if (d.axis === 'z' && d.open < 0.9 && Math.abs(z - d.z) < d.w / 2 && y > d.y && y < d.y + 3) t = tx; } }
  }
  return t;
}
// standing on an escalator carries you along (both run toward -z: A climbs, B descends)
function rbEscCarry(p, dt) {
  if (!p.onGround) return false;
  for (const k of rb.cores) {
    const lx = p.pos.x - k.x, lz = p.pos.z - k.z; if (lx < 0.3 || lx > 3.9 || lx > 1.9 && lx < 2.3 || lz < -6.2 || lz > 12.4) continue;
    const u = clamp((RB_ESC.zb - lz) / RB_ESC.run, 0, 1);
    for (let L = -1; L <= 1; L++) { const y = L * RB_FH + RB_FH * (lx < 1.9 ? u : 1 - u); if (Math.abs(p.pos.y - y) < 0.5) { p.pos.z -= RB_ESC.speed * dt; return true; } }
  }
  return false;
}
/* ---------- the loaded window: chunks around you (or around the build camera) ---------- */
function rbFocus() { return rb.build && cam.free ? cam.free : player.pos; }
function rbWinStale() { const f = rbFocus(), W = rb.win; return !W || W.f !== rb.floor || W.i !== rbCi(f.x) || W.j !== rbCj(f.z); }
function rbBuildWindow() {
  const fp = rbFocus(), f = rb.floor, ci = rbCi(fp.x), cj = rbCj(fp.z);
  const i0 = Math.max(0, ci - RB_WIN), i1 = Math.min(RB_NI - 1, ci + RB_WIN), j0 = Math.max(0, cj - RB_WIN), j1 = Math.min(RB_NJ - 1, cj + RB_WIN);
  if (rb.win) for (const C of rb.win.chunks) C.win = false;
  rb.org.x = Math.round((-RB_W / 2 + (ci + 0.5) * RB_CH) / 4) * 4; rb.org.z = Math.round((-RB_L / 2 + (cj + 0.5) * RB_CH) / 4) * 4; if (rbPool) rbPool.setOffset(rb.org.x, rb.org.z);
  const W = rb.win = { f, i: ci, j: cj, i0, i1, j0, j1, x0: -RB_W / 2 + i0 * RB_CH, x1: -RB_W / 2 + (i1 + 1) * RB_CH, z0: -RB_L / 2 + j0 * RB_CH, z1: -RB_L / 2 + (j1 + 1) * RB_CH, chunks: [] };
  const objs = [], spots = [], cores = [];
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const C = rbChunk(f, i, j); C.win = true; W.chunks.push(C); for (const o of C.objs) objs.push(o); for (const s of C.spots) spots.push(s); if (C.core) cores.push(C.core); }
  const mine = [];
  for (const o of store.rbPlaced || []) { if ((o.f || 0) !== f) continue; mine.push(o); let ps = rbPlacedSpots.get(o); if (!ps || ps.key !== rbObjKey(o)) { ps = []; rbObjSpots(o, ps); ps.key = rbObjKey(o); rbPlacedSpots.set(o, ps); } for (const s of ps) spots.push(s); }
  W.objs = objs; rb.cores = cores;
  rbInstances(objs); rbPlaceCores(); rbSlabs(W); rbSyncPlaced(); rbPhysics(W, objs.concat(mine), spots);
}
function rbInstances(objs) {
  const byType = {}; for (const o of objs) (byType[o.type] || (byType[o.type] = [])).push(o);
  for (const type of Object.keys(RB_TYPES)) {
    const list = byType[type] || []; let im = rb.inst[type];
    if (!list.length) { if (im) im.count = 0; continue; }
    if (!im || im.userData.cap < list.length) {
      if (im) { rbScene.remove(im); im.dispose(); }
      const T_ = RB_TYPES[type]; if (!T_.g) T_.g = T_.geo(); const cap = Math.max(24, Math.ceil(list.length * 1.6));
      im = new THREE.InstancedMesh(T_.g, rbMat(type), cap); im.userData.cap = cap; im.castShadow = im.receiveShadow = true; im.frustumCulled = false; rbScene.add(im); rb.inst[type] = im;
    }
    im.position.set(rb.org.x, 0, rb.org.z); im.updateMatrix();
    list.forEach((o, k) => { _rq.setFromAxisAngle(_ry, o.ry); im.setMatrixAt(k, _rm.compose(_rv.set(o.x - rb.org.x, o.y || 0, o.z - rb.org.z), _rq, _rs.set(o.sx || 1, o.sy || 1, o.sz || 1))); im.setColorAt(k, _col.set(o.tint || '#ffffff')); });
    im.count = list.length; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }
}
// pillars on every chunk corner; floor and ceiling of the loaded area with holes where the cores go through
function rbSlabs(W) {
  W.pillars = [];
  for (let i = W.i0; i <= W.i1 + 1; i++) for (let j = W.j0; j <= W.j1 + 1; j++) { if (i <= 0 || j <= 0 || i >= RB_NI || j >= RB_NJ) continue; W.pillars.push([-RB_W / 2 + i * RB_CH, -RB_L / 2 + j * RB_CH]); }
  const ox = rb.org.x, oz = rb.org.z, pm = rb.pillars; pm.position.set(ox, 0, oz); pm.updateMatrix();
  W.pillars.forEach(([x, z], k) => pm.setMatrixAt(k, _rm.makeTranslation(x - ox, (RB_FH - 0.4) / 2, z - oz))); pm.count = W.pillars.length; pm.instanceMatrix.needsUpdate = true;
  const rects = [];
  for (const C of W.chunks) {
    const x0 = -RB_W / 2 + C.i * RB_CH, z0 = -RB_L / 2 + C.j * RB_CH, x1 = x0 + RB_CH, z1 = z0 + RB_CH, k = C.core;
    if (!k) { rects.push([x0, z0, x1, z1]); continue; }
    rects.push([x0, z0, x1, k.z - 15.5], [x0, k.z + 15.5, x1, z1], [x0, k.z - 15.5, k.x - 7, k.z + 15.5], [k.x + 7, k.z - 15.5, x1, k.z + 15.5]);
  }
  const quad = (y, up) => { const pos = new Float32Array(rects.length * 18), nor = new Float32Array(rects.length * 18), uv = new Float32Array(rects.length * 12); rects.forEach(([x0, z0, x1, z1], k) => { const v = up ? [[x0, z1], [x1, z1], [x1, z0], [x0, z1], [x1, z0], [x0, z0]] : [[x0, z0], [x1, z0], [x1, z1], [x0, z0], [x1, z1], [x0, z1]]; v.forEach(([x, z], q) => { pos.set([x - ox, y, z - oz], k * 18 + q * 3); nor.set([0, up ? 1 : -1, 0], k * 18 + q * 3); uv.set([(x - ox) / 4, (z - oz) / 4], k * 12 + q * 2); }); }); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeBoundingSphere(); return g; };
  W.rects = rects; rb.floorM.geometry.dispose(); rb.floorM.geometry = quad(0, true); rb.ceilM.geometry.dispose(); rb.ceilM.geometry = quad(RB_FH - 0.4, false);
  rb.floorM.position.set(ox, 0, oz); rb.ceilM.position.set(ox, 0, oz);
  // light panels in the ceiling
  const lp = rb.lights; lp.position.set(ox, 0, oz); lp.updateMatrix(); let nl = 0;
  for (const C of W.chunks) { const x0 = -RB_W / 2 + C.i * RB_CH, z0 = -RB_L / 2 + C.j * RB_CH; for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) { const x = x0 + 6.25 + a * 12.5, z = z0 + 6.25 + b * 12.5; if (C.core && Math.abs(x - C.core.x) < 9 && Math.abs(z - C.core.z) < 18) continue; if (nl < lp.userData.cap) lp.setMatrixAt(nl++, _rm.makeTranslation(x - ox, RB_FH - 0.43, z - oz)); } }
  lp.count = nl; lp.instanceMatrix.needsUpdate = true;
  rb.exitG.visible = rb.floor === 0;
}
function rbPhysics(W, objs, spots) {
  const col = new Colliders(), half = RB_W / 2, hl = RB_L / 2;
  // the outer walls, only where they meet the loaded area
  const cx0 = W.x0 - 4, cx1 = W.x1 + 4, cz0 = W.z0 - 4, cz1 = W.z1 + 4;
  if (cz0 < -hl) col.box(cx0, cx1, -hl - 2, -hl, -1, RB_FH); if (cz1 > hl) col.box(cx0, cx1, hl, hl + 2, -1, RB_FH); if (cx0 < -half) col.box(-half - 2, -half, cz0, cz1, -1, RB_FH); if (cx1 > half) col.box(half, half + 2, cz0, cz1, -1, RB_FH);
  for (const r of W.rects) col.box(r[0], r[2], r[1], r[3], -0.5, 0);
  for (const [x, z] of W.pillars) col.box(x - 0.8, x + 0.8, z - 0.8, z + 0.8, 0, RB_FH);
  for (const k of rb.cores) {
    for (const c of rbCoreT.col) col.box(k.x + c[0], k.x + c[1], k.z + c[2], k.z + c[3], c[4], c[5]);
    if (k.g) for (const b of k.g.userData.bars) if (b.m.visible) for (const c of b.b) col.box(k.x + c[0], k.x + c[1], k.z + c[4], k.z + c[5], c[2], c[3]);
  }
  for (const o of objs) rbAddObjCol(col, o);
  rb.col = col; rbGrid = null; rb.navDirty = true;
  // places to hide behind must be free floor
  rb.spots = spots.filter(sp => { if (sp.kind === 'in') return true; col.query(sp.x - 0.3, sp.x + 0.3, sp.z - 0.3, sp.z + 0.3, _near); return !_near.some(c => c.maxY > sp.y + 0.5 && c.minY < sp.y + 1.6 && colOver(c, sp.x, sp.z, 0.24)); });
}
// the walking grid for the seekers (floor level only; the cores are walked by their routes)
function rbNav() {
  if (!rb.navDirty) return rbGrid; rb.navDirty = false; const W = rb.win, col = rb.col; if (!W || !col) return null;
  const G = rbGrid = { x0: W.x0, z0: W.z0, cs: 1.25, nx: Math.ceil((W.x1 - W.x0) / 1.25), nz: Math.ceil((W.z1 - W.z0) / 1.25) }; G.b = new Uint8Array(G.nx * G.nz);
  const seen = new Set();
  for (const c of col.query(W.x0, W.x1, W.z0, W.z1, [])) {
    if (seen.has(c) || c.minY > 1.9 || c.maxY < 0.3) continue; seen.add(c);
    const i0 = Math.max(0, Math.floor((c.minX - 0.4 - G.x0) / G.cs)), i1 = Math.min(G.nx - 1, Math.floor((c.maxX + 0.4 - G.x0) / G.cs)), j0 = Math.max(0, Math.floor((c.minZ - 0.4 - G.z0) / G.cs)), j1 = Math.min(G.nz - 1, Math.floor((c.maxZ + 0.4 - G.z0) / G.cs));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (colOver(c, G.x0 + (i + 0.5) * G.cs, G.z0 + (j + 0.5) * G.cs, 0.38)) G.b[j * G.nx + i] = 1;
  }
  for (const k of rb.cores) { const i0 = Math.max(0, Math.floor((k.x - 7.4 - G.x0) / G.cs)), i1 = Math.min(G.nx - 1, Math.floor((k.x + 7.4 - G.x0) / G.cs)), j0 = Math.max(0, Math.floor((k.z - 15.9 - G.z0) / G.cs)), j1 = Math.min(G.nz - 1, Math.floor((k.z + 15.9 - G.z0) / G.cs)); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) G.b[j * G.nx + i] = 1; }
  return G;
}
/* A* on the window grid */
function rbPath(x0, z0, x1, z1) {
  const G = rbNav(); if (!G) return [[x1, z1]];
  const nx = G.nx, nz = G.nz, cell = (x, z) => [clamp(Math.floor((x - G.x0) / G.cs), 0, nx - 1), clamp(Math.floor((z - G.z0) / G.cs), 0, nz - 1)];
  let [si, sj] = cell(x0, z0), [gi, gj] = cell(x1, z1);
  const near = (ci, cj) => { if (!G.b[cj * nx + ci]) return [ci, cj]; let best = null, bd = 1e9; for (let di = -4; di <= 4; di++) for (let dj = -4; dj <= 4; dj++) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= nx || j >= nz || G.b[j * nx + i]) continue; const d = di * di + dj * dj; if (d < bd) { bd = d; best = [i, j]; } } return best || [ci, cj]; };
  [gi, gj] = near(gi, gj); [si, sj] = near(si, sj);
  const N = nx * nz, start = sj * nx + si, goal = gj * nx + gi;
  if (!G.g || G.g.length < N) { G.g = new Float32Array(N); G.came = new Int32Array(N); G.closed = new Uint8Array(N); }
  const g = G.g, came = G.came, closed = G.closed; g.fill(1e9, 0, N); came.fill(-1, 0, N); closed.fill(0, 0, N);
  const heap = [], push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } }, pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const h = k => { const i = k % nx, j = (k / nx) | 0; const dx = Math.abs(i - gi), dz = Math.abs(j - gj); return Math.max(dx, dz) + 0.41 * Math.min(dx, dz); };
  g[start] = 0; push(start, h(start)); let it = 0;
  while (heap.length && it++ < 45000) {
    const [, k] = pop(); if (closed[k]) continue; closed[k] = 1; if (k === goal) break;
    const i = k % nx, j = (k / nx) | 0;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { if (!di && !dj) continue; const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const kk = b * nx + a; if (G.b[kk] || closed[kk]) continue; if (di && dj && (G.b[j * nx + a] || G.b[b * nx + i])) continue; const ng = g[k] + (di && dj ? 1.414 : 1); if (ng < g[kk]) { g[kk] = ng; came[kk] = k; push(kk, ng + h(kk)); } }
  }
  if (came[goal] < 0 && goal !== start) return [[x1, z1]];
  const cells = []; for (let k = goal; k !== start && k >= 0; k = came[k]) cells.push(k); cells.reverse();
  const out = []; let pd = null;
  cells.forEach((k, idx) => { const i = k % nx, j = (k / nx) | 0, nk = cells[idx + 1]; const d = nk === undefined ? null : [(nk % nx) - i, ((nk / nx) | 0) - j].join(); if (d !== pd || nk === undefined) out.push([G.x0 + (i + 0.5) * G.cs, G.z0 + (j + 0.5) * G.cs]); pd = d; });
  if (!G.b[gj * nx + gi] && Math.hypot(out.length ? out[out.length - 1][0] - x1 : 9, out.length ? out[out.length - 1][1] - z1 : 9) > 0.1) { const [ex, ez] = [G.x0 + (gi + 0.5) * G.cs, G.z0 + (gj + 0.5) * G.cs]; if (Math.hypot(ex - x1, ez - z1) < 1.3) out.push([x1, z1]); }
  return out.length ? out : [[x1, z1]];
}
function rbFreeAt(p) { const G = rbNav(); if (!G) return; const i = clamp(Math.floor((p.x - G.x0) / G.cs), 0, G.nx - 1), j = clamp(Math.floor((p.z - G.z0) / G.cs), 0, G.nz - 1); if (!G.b[j * G.nx + i]) return; for (let r = 1; r <= 8; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= G.nx || b >= G.nz || G.b[b * G.nx + a]) continue; p.x = G.x0 + (a + 0.5) * G.cs; p.z = G.z0 + (b + 0.5) * G.cs; return; } }
/* ---------- building it ---------- */
function rbMigrate() {
  if (store.rbVer === 3) return; const dz = store.rbVer === 2 ? RB_L / 2 - 10000 : RB_L / 2 - 550;
  for (const o of store.rbPlaced || []) { o.z += dz; if (o.f === undefined) o.f = 0; }
  if (store.rbCam) { store.rbCam.z += dz; store.rbCam.f = store.rbCam.f || 0; store.rbCam.y = clamp(store.rbCam.y, 0.8, RB_FH - 1); }
  if (store.rbPos) store.rbPos.z += dz;
  store.rbVer = 3;
}
function buildRainbow() {
  if (rb.built) return; rb.built = true; rbMigrate();
  applyRbPalette(); rb.inst = {}; rb.floor = 0;
  // floor (glossy tiles) and ceiling (rainbow), rebuilt for the loaded area; the four outer walls
  const ft = T.mallTile.clone(); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.needsUpdate = true;
  rb.floorM = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.24, metalness: 0.05, color: 0xd8d4e4 })); rb.floorM.receiveShadow = true; rb.floorM.frustumCulled = false; rbScene.add(rb.floorM);
  rb.ceilM = new THREE.Mesh(new THREE.BufferGeometry(), rbMaterial(THREE.FrontSide, true, 16)); rb.ceilM.frustumCulled = false; rbScene.add(rb.ceilM);
  const wm = rbMaterial(THREE.FrontSide, true, 12);
  for (const [w, x, z, a] of [[RB_W, 0, -RB_L / 2, 0], [RB_W, 0, RB_L / 2, Math.PI], [RB_L, -RB_W / 2, 0, Math.PI / 2], [RB_L, RB_W / 2, 0, -Math.PI / 2]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, RB_FH), wm); m.position.set(x, RB_FH / 2, z); m.rotation.y = a; rbScene.add(m); }
  rb.lights = new THREE.InstancedMesh(new THREE.BoxGeometry(5.5, 0.06, 1.1), new THREE.MeshBasicMaterial({ color: 0xfff8ee }), 460); rb.lights.userData.cap = 460; rb.lights.frustumCulled = false; rbScene.add(rb.lights);
  rb.pillars = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, RB_FH - 0.4, 1.6), rbMaterial(THREE.FrontSide, true, 5), 64); rb.pillars.castShadow = true; rb.pillars.receiveShadow = true; rb.pillars.frustumCulled = false; rbScene.add(rb.pillars);
  rbHemi = new THREE.HemisphereLight(0xf4f0ff, 0x6a5a8a, 1.15); rbScene.add(rbHemi);
  rbSun = new THREE.DirectionalLight(0xffffff, 1.5); rbSun.castShadow = true; rbSun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
  const sc = rbSun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 220; rbSun.shadow.bias = -0.0005; rbSun.shadow.normalBias = 0.03;
  rbScene.add(rbSun, rbSun.target);
  { const es = new THREE.Scene(); const cols = rbUniforms.uCols.value; for (let k = 0; k < 8; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2), new THREE.MeshBasicMaterial({ color: cols[k % rbUniforms.uN.value] })); const a = k / 8 * Math.PI * 2; m.position.set(Math.cos(a) * 8, 2, Math.sin(a) * 8); es.add(m); } es.add(new THREE.Mesh(new THREE.BoxGeometry(40, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff })).translateY(12)); es.background = new THREE.Color(0x3a3050);
    const pm = new THREE.PMREMGenerator(renderer); rbScene.environment = pm.fromScene(es, 0.04).texture; pm.dispose(); }
  rbPool = new HumanPool(rbScene, 34);
  // the way out, on the ground floor's front wall
  rb.exitG = new THREE.Group(); rbScene.add(rb.exitG);
  const ex = new THREE.Mesh(new THREE.PlaneGeometry(8, 6.5), new THREE.MeshStandardMaterial({ color: 0x0a0c12, emissive: 0x6a8aff, emissiveIntensity: 0.45 })); ex.position.set(0, 3.25, RB_L / 2 - 0.05); ex.rotation.y = Math.PI; rb.exitG.add(ex);
  { const F = mkFrame(0, RB_L / 2 - 0.1, Math.PI); makeSignTo(rb.exitG, F, 0, 7.6, 0, 'خروج به شهر', 9, '#14162a', '#ffffff'); }
  spawnSeekers();
}
function makeSignTo(sc, F, lx, ly, lz, text, w, bg, fg) {
  const c = mkCanvas(1024, 256), g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 1024, 256); g.fillStyle = fg; g.font = '150px Lalezar, Vazirmatn, Tahoma'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillText(text, 512, 140, 940);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: toTex(c), toneMapped: false })); const [x, z] = fw(F, lx, lz); m.position.set(x, ly, z); m.rotation.y = F.a; sc.add(m);
}
function rbRegenerate() { rbCache.clear(); rb.win = null; for (const p of rb.people) { p.goal = null; p.route = null; p.rbPath = null; } if (player.where === 'rb') rbBuildWindow(); }
/* ---------- the 20 seekers ---------- */
const RB_NAMES = [['آرش', 'm'], ['سارا', 'f'], ['مهدی', 'm'], ['نگار', 'f'], ['کیان', 'm'], ['یاسمن', 'f'], ['بردیا', 'm'], ['ترانه', 'f'], ['امید', 'm'], ['پریا', 'f'], ['سینا', 'm'], ['مهسا', 'f'], ['رضا', 'm'], ['نیلوفر', 'f'], ['کامیار', 'm'], ['الناز', 'f'], ['پویا', 'm'], ['هستی', 'f'], ['دانیال', 'm'], ['شیدا', 'f']];
function rbHangout(n, x, z) { n.spots = Array.from({ length: 6 }, (_, k) => [x + Math.cos(k * 2.1 + n.rbIdx) * (4 + k * 1.4), z + Math.sin(k * 1.7 + n.rbIdx) * (4 + k)]); n.mode = 'wander'; n.task = null; }
function spawnSeekers() {
  RB_NAMES.forEach(([nm, sx], i) => {
    const key = 'rbSeeker' + i; let rs = store.residents[key];
    if (!rs) { let look; do { look = randomLook(); } while ((sx === 'f') !== !!look.female); look.umbrella = false; look.h = (look.female ? 0.93 : 0.98) + Math.random() * 0.09; const persona = makePersona(look, look.female); persona.name = nm; persona.job = 'بازیکن قایم‌موشک'; persona.jobLine = 'من تو تیم جوینده‌های ساختمان رنگین‌کمانم. هیچ‌جا از دستم در نمی‌ری!'; rs = store.residents[key] = { look, persona }; }
    const p = makePerson(rs.look, false); p.persona = rs.persona; p.persona.name = nm; p.npc = true; p.zone = 'rb'; p.seeker = true; p.rbIdx = i;
    // they hang out round the first pillar inside the entrance
    const a = i / 20 * Math.PI * 2; p.virt = true; p.vp = new V3(Math.cos(a) * 7, 0, RB_L / 2 - 50 + Math.sin(a) * 7); p.facing = a + Math.PI / 2; rbHangout(p, 0, RB_L / 2 - 50);
    rb.people.push(p); rb.seekers.push(p);
  });
}
function rbToVirt(n) { if (n.virt) return; n.virt = true; n.vp = n.vp || new V3(); n.vp.set(n.pos.x, RBY() + n.pos.y, n.pos.z); n.task = null; n.rbPath = null; if (n.mode !== 'wander') n.mode = 'stand'; }
function rbCanHall(n) { const v = n.vp, W = rb.win; return !!W && Math.abs(v.y - RBY()) < 0.35 && v.x > W.x0 + 3 && v.x < W.x1 - 3 && v.z > W.z0 + 3 && v.z < W.z1 - 3 && !rbInCore(v.x, v.z, 0.3) && !(n.route && n.route.length && (n.route[0][3] === 'c' || n.route[0][3] === 'e')); }
function rbToHall(n) { n.virt = false; n.pos.set(n.vp.x, 0, n.vp.z); rbFreeAt(n.pos); n.vel.set(0, 0, 0); n.onGround = true; n.route = null; n.rbPath = null; n.hallExit = null; }
// a route between floors: to a core, up or down its stairs or escalators, and on to the goal
function rbCoreSeq(out, k, f0, f1, esc) {
  const P_ = (x, y, z, s = 'c') => out.push([k.x + x, y, k.z + z, s]), dir = f1 > f0 ? 1 : -1;
  if (!esc) {
    P_(-3.4, f0 * RB_FH, 13.5);
    for (let f = f0; f !== f1; f += dir) { const Y = f * RB_FH;
      if (dir > 0) { P_(-5.25, Y, 12); P_(-5.25, Y, 11); P_(-5.25, Y + 5, 3.5); P_(-5.25, Y + 5, 1.2); P_(-1.75, Y + 5, 1.2); P_(-1.75, Y + 5, 3.5); P_(-1.75, Y + 10, 11); P_(-1.75, Y + 10, 12); }
      else { P_(-1.75, Y, 12); P_(-1.75, Y, 11); P_(-1.75, Y - 5, 3.5); P_(-1.75, Y - 5, 1.2); P_(-5.25, Y - 5, 1.2); P_(-5.25, Y - 5, 3.5); P_(-5.25, Y - 10, 11); P_(-5.25, Y - 10, 12); } }
    P_(-3.4, f1 * RB_FH, 13.5); P_(-3.4, f1 * RB_FH, 17.2, 'h');
  } else {
    P_(5.4, f0 * RB_FH, 13.5);
    for (let f = f0; f !== f1; f += dir) { const Y = f * RB_FH;
      if (dir > 0) { P_(1.1, Y, 13.2); P_(1.1, Y, 12); P_(1.1, Y + 10, -5.3); P_(1.1, Y + 10, -6.6); P_(5.4, Y + 10, -6.6); P_(5.4, Y + 10, 13.2); }
      else { P_(3.1, Y, 13.2); P_(3.1, Y, 12); P_(3.1, Y - 10, -5.3); P_(3.1, Y - 10, -6.6); P_(5.4, Y - 10, -6.6); P_(5.4, Y - 10, 13.2); } }
    P_(5.4, f1 * RB_FH, 17.2, 'h');
  }
}
// from just outside a core on floor f0 to just outside it on floor f1: stairs or escalators for a floor or two, the elevator for more
function rbCoreRoute(k, f0, f1) {
  const out = [];
  if (Math.abs(f1 - f0) > 2) { out.push([k.x - 8.8, f0 * RB_FH, k.z - 3.4, 'h'], [k.x - 5.2, f0 * RB_FH, k.z - 3.4, 'c'], [k.x - 5.2, f1 * RB_FH, k.z - 3.4, 'e'], [k.x - 8.8, f1 * RB_FH, k.z - 3.4, 'c']); return out; }
  const esc = Math.random() < 0.5; out.push([esc ? k.x + 5.4 : k.x - 3.4, f0 * RB_FH, k.z + 17.2, 'h']); rbCoreSeq(out, k, f0, f1, esc); return out;
}
function rbRoute(from, goal) {
  const f0 = Math.round(from.y / RB_FH); let out = [];
  if (goal.fl !== f0) out = rbCoreRoute(rbNearestCore(from.x, from.z), f0, goal.fl);
  out.push([goal.x, goal.fl * RB_FH, goal.z, 'h']); return out;
}
// follow a route without the physics (off the loaded area, on other floors, on the stairs)
function rbMoveVirt(n, dt, spd) {
  const R = n.route; if (!R || !R.length) { n.vel.set(0, 0, 0); return true; }
  const [tx, ty, tz, seg] = R[0], v = n.vp;
  if (seg === 'e') { n.vel.set(0, 0, 0); if (n.liftT === undefined) n.liftT = 2.5 + Math.min(4, Math.log10(1 + Math.abs(ty - v.y) / RB_FH) * 1.4); n.liftT -= dt; if (n.liftT <= 0) { v.set(tx, ty, tz); R.shift(); n.liftT = undefined; } return false; }
  const dx = tx - v.x, dy = ty - v.y, dz = tz - v.z, d = Math.hypot(dx, dy, dz), s = seg === 'c' ? Math.min(spd, n.H.visible ? 3.4 : 14) : spd;
  if (d <= s * dt) { v.set(tx, ty, tz); R.shift(); } else { const k = s * dt / d; v.x += dx * k; v.y += dy * k; v.z += dz * k; }
  const dh = Math.hypot(dx, dz); if (dh > 0.05) { n.facing += angDiff(n.facing, Math.atan2(dx, dz)) * Math.min(1, 10 * dt); n.vel.set(dx / dh * s * (dh / Math.max(d, 1e-6)), 0, dz / dh * s * (dh / Math.max(d, 1e-6))); } else n.vel.set(0, 0, 0);
  return false;
}
/* ---------- entering and leaving ---------- */
function enterRB(resume) {
  const P = player; if (P.state === 'car') exitCar();
  if (P.state !== 'foot') return;
  buildRainbow();
  if (P.where === 'in') return;
  P.rbFrom = { x: rb.door.x, z: rb.door.z + 3 };
  const rp = resume && store.rbPos; rb.floor = rp ? clamp(rp.f | 0, 0, RB_FLOORS - 1) : 0;
  P.where = 'rb'; rbPool.attach(P); P.pos.set(rp ? rp.x : 0, rp ? clamp(rp.y, 0, 3) : 0, rp ? rp.z : RB_L / 2 - 6); P.vel.set(0, 0, 0); P.facing = Math.PI; cam.yaw = Math.PI; cam.target.set(P.pos.x, P.pos.y + 1.45, P.pos.z); cam.cur = 3; P.turbo = false;
  for (const p of rb.people) { rbPool.attach(p); if (!p.virt) rbToVirt(p); }
  // invited friends come along
  for (const inv of store.invited || []) { const q = makePerson(inv.look, false); q.persona = deserPersona(inv.persona); q.npc = true; q.zone = 'rb'; q.invited = inv.role; q.mode = 'stand'; q.virt = true; q.vp = new V3(P.pos.x + (Math.random() - 0.5) * 6, RBY(), P.pos.z - 3 - Math.random() * 2); q.facing = Math.PI; q.rbIdx = 20 + rb.people.length; rbPool.attach(q); rb.people.push(q); if (inv.role === 'seek') rb.seekers.push(q); }
  rb.win = null; rbBuildWindow(); rbFreeAt(P.pos);
  waypoint = null; if (wpMesh) wpMesh.visible = false;
  banner('ساختمان رنگین‌کمان', rp ? `طبقهٔ ${fa(rb.floor)}` : '۱۰ کیلومتر در ۲۰ کیلومتر، ۱۰ هزار طبقه — پله‌ها و پله‌برقی‌ها توی برج‌های رنگی‌اند'); showRbHud(true); saveGame();
}
function leaveRB() {
  const P = player; if (P.where !== 'rb') return;
  if (rb.build) endBuild(); rbEndGame(true);
  for (const p of rb.people) rbToVirt(p);
  rbPool.detach(P); for (const p of rb.people) rbPool.detach(p);
  rb.people = rb.people.filter(p => !p.invited); rb.seekers = rb.seekers.filter(p => !p.invited);
  for (const inv of store.invited || []) { const q = spawnNPC(rb.door.x + (Math.random() - 0.5) * 6, rb.door.z + 6, inv.look); q.persona = deserPersona(inv.persona); q.mode = 'goto'; }
  store.invited = []; store.rbPos = null;
  P.where = 'out'; outdoorPool.attach(P); P.state = 'foot'; P.H.visible = true; P.turbo = false; const f = P.rbFrom || { x: 0, z: RB_DOOR_Z + 6 };
  P.pos.set(f.x, groundH(f.x, f.z), f.z); P.facing = 0; cam.yaw = 0; cam.target.set(P.pos.x, P.pos.y + 1.45, P.pos.z);
  showRbHud(false); $('rb-menu').hidden = true; saveGame();
}
// going up or down a whole floor: everything shifts by one storey and the new floor loads round you
function rbChangeFloor(d) {
  const P = player, nf = rb.floor + d; if (nf < 0 || nf >= RB_FLOORS) return;
  for (const n of rb.people) if (!n.virt) rbToVirt(n);
  rb.floor = nf; const dy = d * RB_FH;
  P.pos.y -= dy; camera.position.y -= dy; cam.target.y -= dy; cam.fpY -= dy; if (cam.free) cam.free.y -= dy;
  rbBuildWindow(); rbUpdateDoors(0);
  if (rb.game && rb.game.phase === 'seek') rb.game.moved = true;
}
/* ---------- hide and seek ---------- */
function rbStartGame(minutes) {
  const s = rbSettings(); s.minutes = minutes; buildRainbow();
  if (rb.build) endBuild();
  const P = player; if (P.state === 'hide') rbUnhide();
  const L = s.level, cnt = Math.max(10, 26 - L * 2);
  // they count at the pillar nearest to you
  const px = clamp(Math.round((P.pos.x + RB_W / 2) / RB_CH), 1, RB_NI - 1) * RB_CH - RB_W / 2, pz = clamp(Math.round((P.pos.z + RB_L / 2) / RB_CH), 1, RB_NJ - 1) * RB_CH - RB_L / 2;
  rb.game = { phase: 'count', t: cnt, count: cnt, left: minutes ? minutes * 60 : Infinity, level: L, findP: Math.min(0.85, 0.32 + L * 0.06), speed: 1 + L * 0.08, found: [], seen: 0, f0: rb.floor, sx: px, sz: pz, tSeek: 0, kf: rb.floor, kfT: 0, floorT: 0 };
  for (const C of rbCache.values()) for (const sp of C.spots) { sp.used = null; sp.checked = -99; }
  for (const sp of rb.spots) { sp.used = null; sp.checked = -99; }
  rb.seekers.forEach((n, i) => { const a = i / rb.seekers.length * Math.PI * 2; n.virt = false; n.pos.set(px + Math.cos(a) * 3.3, 0, pz + Math.sin(a) * 3.3); rbFreeAt(n.pos); n.vel.set(0, 0, 0); n.facing = Math.atan2(px - n.pos.x, pz - n.pos.z); n.mode = 'stand'; n.task = null; n.anim.special = 'count'; n.specialT = undefined; n.H.visible = true; n.rbPath = null; n.route = null; n.goal = null; n.hallExit = null; n.lastHeard = null; n.checking = 0; });
  for (const q of rb.people) if (q.invited === 'hide') {
    if (q.virt) rbToHall(q); const cand = rb.spots.filter(sp => !sp.used && Math.hypot(sp.x - px, sp.z - pz) > 14 && Math.hypot(sp.x - px, sp.z - pz) < 60); const sp = cand[Math.floor(Math.random() * cand.length)] || rb.spots.find(sp => !sp.used);
    if (sp) { q.hideSpot = sp; sp.used = q; q.rbPath = rbPath(q.pos.x, q.pos.z, sp.x, sp.z); } q.mode = 'task'; q.task = null; q.hidden = false; q.H.visible = true; q.anim.special = null;
  }
  if (Math.hypot(P.pos.x - px, P.pos.z - pz) > 40) { P.pos.set(px, 0, pz + 6); rbFreeAt(P.pos); P.vel.set(0, 0, 0); cam.target.set(P.pos.x, 1.45, P.pos.z); }
  $('rb-menu').hidden = true; $('rb-setup').hidden = true;
  say(rb.seekers[0], `یک... دو... سه... تا ${fa(cnt)} می‌شمریم، زود قایم شو!`, 3);
  banner('قایم‌موشک شروع شد!', `${fa(cnt)} ثانیه وقت داری قایم بشی — به هر وسیله نزدیک شو و «قایم شو» رو بزن · توربو: دکمهٔ «توربو» یا X`);
  Audio.arcade();
}
function nearestSpot(maxD) { const P = player; let best = null, bd = maxD; for (const sp of rb.spots) { if (sp.used && sp.used !== P) continue; const d = Math.hypot(sp.x - P.pos.x, sp.z - P.pos.z); if (d < bd && Math.abs(sp.y - P.pos.y) < 1.5) { bd = d; best = sp; } } return best; }
function rbHide(sp) {
  const P = player; P.state = 'hide'; P.hideSpot = sp; sp.used = P; P.vel.set(0, 0, 0); P.hideFrom = [P.pos.x, P.pos.z]; P.turbo = false;
  P.pos.set(sp.x, sp.y, sp.z); P.facing = sp.face + (sp.kind === 'in' ? Math.PI : 0);
  P.anim.special = sp.pose === 'stand' ? null : sp.pose; P.anim.sw = 0;
  P.H.visible = sp.kind !== 'in'; cam.hideYaw = sp.face; cam.hidePitch = 0.05;
  Audio.cloth(); toast(sp.kind === 'in' ? `داخل «${sp.name}» قایم شدی — با کشیدن انگشت دور و برت رو نگاه کن` : `پشت «${sp.name}» قایم شدی`);
}
function rbUnhide() {
  const P = player, sp = P.hideSpot; if (sp) sp.used = null;
  P.state = 'foot'; P.anim.special = null; P.H.visible = true; P.hideSpot = null;
  if (sp && sp.kind === 'in') { const a = sp.face, o = sp.o; let r = 1.6; if (o) { const T_ = RB_TYPES[o.type]; rbShapes(o.type); const [x0, x1, z0, z1] = T_.foot; r = Math.max(x1 - x0, z1 - z0) * Math.max(o.sx || 1, o.sz || 1) * 0.55 + 0.6; } P.pos.set(sp.x + Math.sin(a) * r, sp.y, sp.z + Math.cos(a) * r); if (rbGrid) rbFreeAt(P.pos); }
}
function rbFound(by, who) {
  const G = rb.game; if (!G || G.phase !== 'seek' && G.phase !== 'count') return;
  if (who !== player) { // an invited hider is caught
    who.hidden = false; who.H.visible = true; who.anim.special = null; if (who.hideSpot) who.hideSpot.used = null; G.found.push(who.persona.name);
    say(by, `${who.persona.name} پیدات کردم!`, 2.6); say(who, 'ای بابا! پیدام کردن!', 2.4); who.mode = 'stand'; banner(`${who.persona.name} پیدا شد`, 'هنوز تو مخفی هستی، تکون نخور!'); return;
  }
  G.phase = 'over'; G.result = 'found'; G.by = by;
  const P = player; if (P.state === 'hide') rbUnhide();
  if (by.virt && Math.abs(by.vp.y - RBY()) < 1) rbToHall(by);
  if (!by.virt) { by.vel.set(0, 0, 0); by.facing = Math.atan2(P.pos.x - by.pos.x, P.pos.z - by.pos.z); setSpecial(by, 'point', 3); by.mode = 'stand'; }
  say(by, mpick([`پیدات کردم!! من ${by.persona.name}م!`, 'سُک سُک! پیدات کردم!', 'دیدمت! بیا بیرون!']), 3);
  for (const n of rb.seekers) if (n !== by) { if (!n.virt) { setSpecial(n, 'cheer', 2.5); n.mode = 'stand'; } n.vel.set(0, 0, 0); n.route = null; }
  Audio.alarm(0.5); cam.shake = 0.2;
  G.menuT = 1.6;
}
function rbShowMenu(kind) {
  const G = rb.game, m = $('rb-menu'); m.hidden = false;
  $('rbm-title').textContent = kind === 'found' ? `${G.by.persona.name} پیدات کرد!` : 'بردی! هیچ‌کس پیدات نکرد 🎉';
  $('rbm-sub').textContent = kind === 'found' ? `مرحلهٔ ${fa(G.level)} · طبقهٔ ${fa(rb.floor)}${G.found.length ? ' · دوستانِ پیداشده: ' + G.found.join('، ') : ''}` : `مرحلهٔ ${fa(G.level)} رو بردی! جوینده‌ها توی مرحلهٔ بعد سریع‌تر و زرنگ‌ترن.`;
  if (kind === 'won') { store.stats.rbWins = (store.stats.rbWins || 0) + 1; }
  saveGame();
}
function rbEndGame(silent) {
  const G = rb.game; if (!G) return; rb.game = null;
  for (const n of rb.seekers) { n.anim.special = null; n.task = null; n.rbPath = null; n.route = null; n.goal = null; n.hallExit = null; const x = n.virt ? n.vp.x : n.pos.x, z = n.virt ? n.vp.z : n.pos.z; rbHangout(n, x, z); }
  for (const q of rb.people) if (q.invited) { q.hidden = false; q.H.visible = true; q.anim.special = null; q.mode = 'stand'; if (q.hideSpot) q.hideSpot.used = null; }
  if (player.state === 'hide') rbUnhide();
  if (!silent) $('rb-menu').hidden = true;
}
function rbNextLevel(same) {
  const s = rbSettings(); if (!same) { s.level++; rbRegenerate(); }
  rbEndGame(); rbStartGame(s.minutes);
}
// where to look next. They always know which floor you are on (a few seconds late) but not where on it;
// on the floor where they counted they sweep in on you and will find you in the end
function rbPickGoal(n) {
  const G = rb.game, P = player, L = G.level, fl = G.kf;
  let x, z, sp = null;
  if (fl === G.f0 && rb.floor === G.f0) {
    const R = Math.max(6, 80 - G.kfT * 1.3); let bd = 1e9;
    for (const s of rb.spots) { if (s.used && s.used.seeker) continue; if (simTime - s.checked < 25) continue; const d = Math.hypot(s.x - P.pos.x, s.z - P.pos.z); if (d > R) continue; const sc = d * 0.35 + Math.random() * R; if (sc < bd) { bd = sc; sp = s; } }
    if (!sp) { const a = Math.random() * 6.28, r = Math.random() * R; x = P.pos.x + Math.cos(a) * r; z = P.pos.z + Math.sin(a) * r; }
  } else {
    const R = Math.min(RB_W / 2, 45 + G.kfT * 5);
    if (fl === rb.floor && Math.random() < 0.02 + L * 0.006) { const a = Math.random() * 6.28, r = 3 + Math.random() * 25; x = P.pos.x + Math.cos(a) * r; z = P.pos.z + Math.sin(a) * r; }
    else { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * R; x = G.sx + Math.cos(a) * r; z = G.sz + Math.sin(a) * r; }
  }
  if (!sp) {
    x = clamp(x, -RB_W / 2 + 4, RB_W / 2 - 4); z = clamp(z, -RB_L / 2 + 4, RB_L / 2 - 4);
    const pool = fl === rb.floor && rb.win && x > rb.win.x0 && x < rb.win.x1 && z > rb.win.z0 && z < rb.win.z1 ? rb.spots : rbChunk(fl, rbCi(x), rbCj(z)).spots; let bd = 1e9;
    for (const s of pool) { if (simTime - s.checked < 40) continue; const d = Math.hypot(s.x - x, s.z - z) + Math.random() * 8; if (d < bd) { bd = d; sp = s; } }
  }
  n.goal = sp ? { fl: sp.fl, x: sp.x, z: sp.z, sp } : { fl, x, z, sp: null };
  n.route = null; n.rbPath = null; n.hallExit = null; n.run = Math.random() < 0.4;
}
function rbArrive(n) {
  const G = rb.game, P = player, sp = n.goal && n.goal.sp; n.goal = null; n.route = null; n.rbPath = null;
  n.checking = 1.4; n.vel.set(0, 0, 0);
  if (!n.virt) { setSpecial(n, 'peek', 1.4); n.mode = 'stand'; if (sp) n.facing = Math.atan2(sp.x - n.pos.x, sp.z - n.pos.z); }
  if (!sp) return; sp.checked = simTime;
  if (sp.used && sp.used.seeker !== true) { const hid = sp.used, careful = hid === P && G.kf === G.f0 && rb.floor === G.f0, chance = careful ? 1 : G.findP * (1 - sp.conceal * 0.55); if (Math.random() < chance) { rbFound(n, hid); return; } if (hid === P && !n.virt && Math.random() < 0.5) say(n, mpick(['هوم... اینجا نیست.', 'یه صدایی اومد...', 'نه، اینجا کسی نیست.']), 2); }
  else if (!n.virt && Math.random() < 0.08) say(n, mpick(['کجا قایم شدی؟', 'پیدات می‌کنم!', 'آماده باش، دارم میام!']), 2);
}
// hall mode: the walking grid inside the loaded area; to leave it (other floors, far away) walk to the edge or a core door
function rbPlanHall(n) {
  const g = n.goal, W = rb.win;
  if (g.fl === rb.floor && g.x > W.x0 + 2 && g.x < W.x1 - 2 && g.z > W.z0 + 2 && g.z < W.z1 - 2) { n.rbPath = rbPath(n.pos.x, n.pos.z, g.x, g.z); n.hallExit = null; return; }
  if (g.fl !== rb.floor && rb.cores.length) {
    let k = rb.cores[0], bd = 1e9; for (const c of rb.cores) { const d = Math.hypot(c.x - n.pos.x, c.z - n.pos.z); if (d < bd) { bd = d; k = c; } }
    const R = rbCoreRoute(k, rb.floor, g.fl), [ex, , ez] = R.shift(); n.rbPath = rbPath(n.pos.x, n.pos.z, ex, ez); R.push([g.x, g.fl * RB_FH, g.z, 'h']); n.hallExit = R; return;
  }
  const ex = clamp(g.x, W.x0 + 2.5, W.x1 - 2.5), ez = clamp(g.z, W.z0 + 2.5, W.z1 - 2.5); n.rbPath = rbPath(n.pos.x, n.pos.z, ex, ez); n.hallExit = [[g.x, g.fl * RB_FH, g.z, 'h']];
}
function rbSeekerThink(n, dt) {
  const G = rb.game;
  if (n.checking > 0) { n.checking -= dt; if (n.virt) n.vel.set(0, 0, 0); return; }
  if (!n.goal) rbPickGoal(n);
  const far = n.goal && (n.goal.fl !== Math.round((n.virt ? n.vp.y : RBY()) / RB_FH) || Math.hypot(n.goal.x - (n.virt ? n.vp.x : n.pos.x), n.goal.z - (n.virt ? n.vp.z : n.pos.z)) > 60);
  if (n.virt) {
    if (!n.route) n.route = rbRoute(n.vp, n.goal);
    if (rbCanHall(n)) rbToHall(n);
    else { const gd = Math.hypot(n.goal.x - n.vp.x, n.goal.z - n.vp.z); if (rbMoveVirt(n, dt, far ? Math.max(11 * G.speed, gd / 12) : (n.run ? 3.6 : 1.7) * G.speed)) rbArrive(n); return; }
  }
  if (!n.rbPath) rbPlanHall(n);
  if (!n.rbPath.length) { if (n.hallExit) { rbToVirt(n); n.route = n.hallExit; n.hallExit = null; } else rbArrive(n); return; }
  const [tx, tz] = n.rbPath[0], d = Math.hypot(tx - n.pos.x, tz - n.pos.z);
  if (d < (n.rbPath.length === 1 ? 1.1 : 0.9)) { n.rbPath.shift(); return; }
  n.mode = 'task'; n.task = { x: tx, z: tz, spd: (far ? 7 : n.run ? 3.6 : 1.7) * G.speed };
}
const _sv = new V3();
function rbCanSee(n, tgt, hidden) {
  const dx = tgt.pos.x - n.pos.x, dz = tgt.pos.z - n.pos.z, d = Math.hypot(dx, dz); if (d > (hidden ? 6 : 30) || Math.abs(tgt.pos.y - n.pos.y) > 2.5) return false;
  const fx = Math.sin(n.facing), fz = Math.cos(n.facing); if ((dx * fx + dz * fz) / (d || 1) < (hidden ? 0.55 : 0.3)) return false;
  const ey = n.pos.y + 1.55 * (n.look.h || 1), ty = tgt.pos.y + (hidden ? 0.6 : 1.2), dy = ty - ey, L = Math.hypot(dx, dy, dz);
  const hit = rayCast(rb.col, n.pos.x, ey, n.pos.z, dx / L, dy / L, dz / L, L, 0.05); return hit >= L - 0.4;
}
function updateRB(dt) {
  if (!rb.built) return;
  rbUniforms.uTime.value = simTime;
  if (rbWinStale()) rbBuildWindow();
  const P = player, G = rb.game, Y = RBY(), W = rb.win;
  const fp = rbFocus(); rbSun.target.position.set(fp.x, 0, fp.z); rbSun.position.set(fp.x + 40, 90, fp.z + 60); rbSun.target.updateMatrixWorld();
  if (rbCoreMats.m) rbCoreMats.m.belt.map.offset.y = (rbCoreMats.m.belt.map.offset.y - dt * RB_ESC.speed * 10 / (RB_ESC.run * 1.15)) % 1;
  if (G) {
    G.t -= dt;
    if (G.phase === 'over' && G.menuT > 0) { G.menuT -= dt; if (G.menuT <= 0) rbShowMenu(G.result); }
    if (G.phase === 'count') {
      const sec = Math.ceil(G.t); if (sec !== G.lastSec) { G.lastSec = sec; if (sec <= 10 || sec % 5 === 0) say(rb.seekers[sec % rb.seekers.length], fa(G.count - sec + 1) + '...', 0.9); }
      if (G.t <= 0) { G.phase = 'seek'; G.t = 0; for (const n of rb.seekers) { n.anim.special = null; n.rbPath = null; n.checking = Math.random() * 0.8; n.goal = null; } say(rb.seekers[0], 'آماده یا نه، دارم میام!!', 3); Audio.honk(G.sx, G.sz); }
    } else if (G.phase === 'seek') {
      G.tSeek += dt; G.kfT += dt;
      if (rb.floor !== G.kf) { G.floorT += dt; if (G.floorT > 6) { G.kf = rb.floor; G.kfT = 0; G.floorT = 0; for (const n of rb.seekers) { n.goal = null; n.route = null; n.rbPath = null; n.hallExit = null; n.checking = 0; } const n0 = rb.seekers.find(n => n.H.visible); if (n0) say(n0, rb.floor === G.f0 ? 'برگشت این طبقه! بگردین!' : `رفته طبقهٔ ${fa(rb.floor)}! بریم!`, 2.5); } } else G.floorT = 0;
      if (G.left !== Infinity) { G.left -= dt; if (G.left <= 0) { G.phase = 'over'; G.result = 'won'; for (const n of rb.seekers) { if (!n.virt) { setSpecial(n, 'laugh', 2); n.mode = 'stand'; } n.vel.set(0, 0, 0); } rbShowMenu('won'); } }
      G.seen += dt; const look = G.seen > 0.2; if (look) G.seen = 0;
      const hiding = P.state === 'hide', sp = P.hideSpot, spd = Math.hypot(P.vel.x, P.vel.z);
      for (const n of rb.seekers) {
        if (G.phase !== 'seek') break;
        rbSeekerThink(n, dt);
        if (!look || !n.H.visible) continue;
        // eyes: in the open you are caught for sure; behind cover only by chance; inside, only if they open it
        if (!hiding) { if (rbCanSee(n, P, false)) { rbFound(n, P); break; } }
        else if (sp.kind !== 'in' && rbCanSee(n, P, true) && Math.random() < 0.18 * (1 - sp.conceal) * G.findP * 2) { rbFound(n, P); break; }
        // ears: running footsteps (and the turbo even more) draw them over
        if (!hiding && spd > 4 && Math.abs(n.pos.y - P.pos.y) < 3 && Math.hypot(P.pos.x - n.pos.x, P.pos.z - n.pos.z) < (spd > 10 ? 32 : 14) && Math.random() < 0.3) { n.goal = { fl: rb.floor, x: P.pos.x, z: P.pos.z, sp: null }; n.route = null; n.rbPath = null; n.hallExit = null; n.run = true; n.checking = 0; }
        for (const q of rb.people) if (q.invited === 'hide' && q.hidden && !q.virt && q.hideSpot && q.hideSpot.kind !== 'in' && rbCanSee(n, q, true) && Math.random() < 0.05) rbFound(n, q);
      }
    }
    // invited hiders walk to their places, then disappear into them
    for (const q of rb.people) if (q.invited === 'hide' && !q.hidden && q.hideSpot && G.phase !== 'over') {
      const sp = q.hideSpot;
      if (q.virt) { if (!q.route) q.route = [[sp.x, sp.fl * RB_FH, sp.z, 'h']]; if (!rbMoveVirt(q, dt, 3.4)) continue; }
      else if (q.rbPath && q.rbPath.length) { const [tx, tz] = q.rbPath[0]; if (Math.hypot(tx - q.pos.x, tz - q.pos.z) < 0.9) q.rbPath.shift(); else { q.mode = 'task'; q.task = { x: tx, z: tz, spd: 3.4 }; } continue; }
      q.hidden = true; q.route = null; q.rbPath = null; if (q.virt) q.vp.set(sp.x, sp.fl * RB_FH + sp.y, sp.z); else q.pos.set(sp.x, sp.y, sp.z); q.facing = sp.face; q.anim.special = sp.pose === 'stand' ? null : sp.pose; q.mode = 'stand'; q.vel.set(0, 0, 0);
    }
  }
  // everyone: physical inside the loaded area of this floor, on rails elsewhere
  const hall = [];
  for (const n of rb.people) {
    if (!n.virt && W && (n.pos.x < W.x0 + 1 || n.pos.x > W.x1 - 1 || n.pos.z < W.z0 + 1 || n.pos.z > W.z1 - 1)) rbToVirt(n);
    if (n.virt) {
      if (!G && !n.hidden && rbCanHall(n)) { rbToHall(n); if (n.mode !== 'wander') rbHangout(n, n.pos.x, n.pos.z); }
      else {
        n.pos.set(n.vp.x, n.vp.y - Y, n.vp.z); n.onGround = true; if (!(G && G.phase === 'seek' && n.seeker) && !(n.invited === 'hide' && !n.hidden)) n.vel.set(0, 0, 0);
        n.H.visible = !(n.hidden && n.hideSpot && n.hideSpot.kind === 'in') && Math.abs(n.pos.y - 3) < 16 && Math.hypot(n.pos.x - P.pos.x, n.pos.z - P.pos.z) < 130;
        continue;
      }
    }
    n.H.visible = !(n.hidden && n.hideSpot && n.hideSpot.kind === 'in');
    if (n.hidden) { n.vel.set(0, 0, 0); continue; }
    if (G && G.phase === 'count' && n.seeker) { n.vel.set(0, 0, 0); n.facing += angDiff(n.facing, Math.atan2(G.sx - n.pos.x, G.sz - n.pos.z)) * Math.min(1, 4 * dt); n.anim.special = 'count'; stepCharacter(n, rb.col, dt, false); hall.push(n); continue; }
    updateNPC(n, dt, false, rb.col); rbEscCarry(n, dt); hall.push(n);
  }
  separatePeople(hall.filter(p => !p.hidden).concat(P.state === 'foot' ? [P] : []));
  rbUpdateDoors(dt);
  updateRbHud();
}
/* ---------- HUD bits ---------- */
function placeRbHud() { const tb = $('topbar').getBoundingClientRect(); $('rb-hud').style.top = Math.round(tb.bottom + 8) + 'px'; }
addEventListener('resize', () => { if (!$('rb-hud').hidden) placeRbHud(); });
function toggleTurbo() {
  const P = player; if (P.where !== 'rb') return; P.turbo = ((P.turbo || 0) + 1) % 3; const b = $('b-turbo');
  b.classList.toggle('on', !!P.turbo); b.classList.toggle('hyper', P.turbo === 2); b.textContent = P.turbo === 2 ? 'خیلی خیلی توربو' : P.turbo ? 'توربو ✓' : 'توربو';
  toast(P.turbo === 2 ? 'خیلی خیلی توربو! حدود ۸۰۰ کیلومتر بر ساعت — از روی وسیله‌ها می‌پری' : P.turbo ? 'توربو: حدود ۸۶ کیلومتر بر ساعت (یه بار دیگه بزن برای خیلی خیلی توربو)' : 'توربو خاموش شد');
}
function showRbHud(on) { $('rb-hud').hidden = !on; $('b-turbo').hidden = !on; if (!on) { player.turbo = 0; $('b-turbo').classList.remove('on', 'hyper'); $('b-turbo').textContent = 'توربو'; } if (on) requestAnimationFrame(placeRbHud); $('btn-rb').textContent = on ? 'خروج از رنگین‌کمان' : 'ساختمان رنگین‌کمان'; }
let rbHudKey = '';
function updateRbHud() {
  const G = rb.game; let t = '';
  if (rb.build) t = 'حالت ساخت‌وساز';
  else if (!G) t = 'قایم‌موشک: آماده';
  else if (G.phase === 'count') t = `جوینده‌ها دارن می‌شمرن: ${fa(Math.max(0, Math.ceil(G.t)))}`;
  else if (G.phase === 'seek') t = `${fa(rb.seekers.length)} نفر دنبالت می‌گردن · ${G.left === Infinity ? 'زمان: بی‌نهایت' : 'زمان: ' + fa(Math.floor(G.left / 60)) + ':' + fa(String(Math.floor(G.left % 60)).padStart(2, '0'))}`;
  else t = G.result === 'won' ? 'بردی!' : 'پیدات کردن!';
  t = `طبقهٔ ${fa(rb.floor)} · ` + t;
  if (t !== rbHudKey) { rbHudKey = t; $('rb-status').textContent = t; placeRbHud(); }
  $('rb-start').hidden = !!G || !!rb.build; $('rb-stop').hidden = !G || G.phase === 'over'; $('rb-build').hidden = !!G;
}

/* ---------- build mode: a free camera that stays where you leave it, and a catalogue of things to place ---------- */
const placedMeshes = [];
function placedMat(type, tint) { const k = type + '|' + tint; if (!rbMats[k]) { const m = rbMat(type).clone(); m.color.set(tint || '#ffffff'); rbMats[k] = m; } return rbMats[k]; }
function rbSyncPlaced() {
  const L = store.rbPlaced || (store.rbPlaced = []);
  while (placedMeshes.length > L.length) rbScene.remove(placedMeshes.pop());
  L.forEach((o, i) => {
    const T_ = RB_TYPES[o.type]; if (!T_.g) T_.g = T_.geo();
    let m = placedMeshes[i];
    if (!m || m.userData.type !== o.type) { if (m) rbScene.remove(m); m = new THREE.Mesh(T_.g, placedMat(o.type, o.tint)); m.castShadow = m.receiveShadow = true; m.userData.type = o.type; rbScene.add(m); placedMeshes[i] = m; }
    if (m.userData.tint !== o.tint) { m.material = placedMat(o.type, o.tint); m.userData.tint = o.tint; }
    m.position.set(o.x, o.y || 0, o.z); m.rotation.set(0, o.ry, 0); m.scale.set(o.sx, o.sy, o.sz); m.userData.idx = i; m.visible = (o.f || 0) === rb.floor;
  });
}
let physT = 0;
function rbDirty() { rbSyncPlaced(); physT = 0.35; saveSoon(); }
let saveSoonT = null; function saveSoon() { clearTimeout(saveSoonT); saveSoonT = setTimeout(saveGame, 1500); }
function startBuild() {
  if (player.where !== 'rb') return; if (rb.game) { toast('اول بازی قایم‌موشک رو تموم کن'); return; }
  const P = player; if (P.state === 'hide') rbUnhide();
  rb.build = { sel: -1, drag: false };
  const rc = store.rbCam; cam.free = rc && (rc.f || 0) === rb.floor && Math.hypot(rc.x - P.pos.x, rc.z - P.pos.z) < 300 ? Object.assign({}, rc) : { x: P.pos.x, y: 7.5, z: P.pos.z + 12, yaw: Math.PI, pitch: 0.42 };
  $('bd-ui').hidden = false; $('bd-obj').hidden = true; for (const id of ['topbar', 'minimap', 'rb-hud']) $(id).hidden = true; renderPalette(); toast('ساخت‌وساز: از فهرست یا جستجو یه وسیله انتخاب کن؛ با کشیدن انگشت دوربین رو بچرخون');
}
function endBuild() {
  if (!rb.build) return; store.rbCam = Object.assign({}, cam.free, { f: rb.floor }); rb.build = null; cam.free = null; selBox(null);
  $('bd-ui').hidden = true; $('topbar').hidden = false; $('minimap').hidden = false; showRbHud(player.where === 'rb'); rbBuildWindow(); saveGame();
}
function buildCatalog() { return Object.entries(RB_TYPES).map(([id, t]) => ({ id, n: t.n, cat: t.cat, col: t.tint[0] })); }
let bdCat = 'همه';
function renderPalette() {
  const q = norm($('bd-search').value || ''), list = $('bd-list'); list.textContent = '';
  const cats = ['همه', ...new Set(buildCatalog().map(c => c.cat))], cw = $('bd-cats'); cw.textContent = '';
  for (const c of cats) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip-q' + (c === bdCat ? ' on' : ''); b.textContent = c; b.addEventListener('click', () => { bdCat = c; renderPalette(); }); cw.appendChild(b); }
  for (const it of buildCatalog()) {
    if (bdCat !== 'همه' && it.cat !== bdCat) continue; if (q && !norm(it.n).includes(q) && !norm(it.cat).includes(q)) continue;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'bd-item'; b.innerHTML = '<span class="bag-sw"></span><span></span>'; b.firstChild.style.background = it.col; b.lastChild.textContent = it.n;
    b.addEventListener('click', () => placeNew(it.id)); list.appendChild(b);
  }
  if (!list.children.length) { const p = document.createElement('p'); p.className = 'bag-empty'; p.textContent = 'چیزی پیدا نشد'; list.appendChild(p); }
}
const _ray = new THREE.Raycaster(), _ndc = new V2(), _plane = new THREE.Plane(new V3(0, 1, 0), 0), _hitP = new V3();
function floorHit(nx, ny, y = 0) { _ndc.set(nx, ny); _ray.setFromCamera(_ndc, camera); _plane.constant = -y; return _ray.ray.intersectPlane(_plane, _hitP) && _hitP.distanceTo(camera.position) < 600 ? _hitP.clone() : null; }
function placeNew(type) {
  const L = store.rbPlaced || (store.rbPlaced = []); if (L.length >= 400) { toast('حداکثر ۴۰۰ وسیله می‌تونی بذاری'); return; }
  let p = floorHit(0, 0); if (!p) { const f = cam.free; p = new V3(f.x + Math.sin(f.yaw) * 12, 0, f.z + Math.cos(f.yaw) * 12); }
  const T_ = RB_TYPES[type]; L.push({ type, f: rb.floor, x: +p.x.toFixed(2), y: 0, z: +p.z.toFixed(2), ry: Math.round((cam.free.yaw + Math.PI) / (Math.PI / 2)) * Math.PI / 2, sx: 1, sy: 1, sz: 1, tint: T_.tint[0] });
  rbDirty(); select(L.length - 1); Audio.tick();
}
let selHelper = null;
function selBox(m) { if (selHelper) { rbScene.remove(selHelper); selHelper = null; } if (m) { selHelper = new THREE.BoxHelper(m, 0xffd23a); rbScene.add(selHelper); } }
function select(i) {
  rb.build.sel = i; const o = (store.rbPlaced || [])[i]; $('bd-obj').hidden = !o; selBox(o ? placedMeshes[i] : null);
  if (!o) return; $('bd-name').textContent = RB_TYPES[o.type].n;
  for (const k of ['sx', 'sy', 'sz']) $('bd-' + k).value = Math.round(Math.log(o[k]) / Math.log(30) * 100);
  const sw = $('bd-tints'); sw.textContent = '';
  for (const c of [...RB_TYPES[o.type].tint, '#ffffff', '#e8303a', '#2a6ad8', '#3ab84a', '#f2c12e', '#a03aff', '#1a1a1a']) { const b = document.createElement('button'); b.type = 'button'; b.className = 'bd-tint'; b.style.background = c; b.addEventListener('click', () => { o.tint = c; rbDirty(); }); sw.appendChild(b); }
}
function selObj() { return rb.build && rb.build.sel >= 0 ? (store.rbPlaced || [])[rb.build.sel] : null; }
function bdAct(a) {
  const o = selObj(); if (!o) return; const f = cam.free, fx = Math.sin(f.yaw), fz = Math.cos(f.yaw), step = 0.5;
  switch (a) {
    case 'left': o.x += -fz * -step; o.z += fx * -step; break; case 'right': o.x += -fz * step; o.z += fx * step; break;
    case 'fwd': o.x += fx * step; o.z += fz * step; break; case 'back': o.x -= fx * step; o.z -= fz * step; break;
    case 'up': o.y = Math.min(RB_FH - 1.2, (o.y || 0) + 0.25); break; case 'down': o.y = Math.max(0, (o.y || 0) - 0.25); break;
    case 'rotL': o.ry += Math.PI / 12; break; case 'rotR': o.ry -= Math.PI / 12; break;
    case 'big': for (const k of ['sx', 'sy', 'sz']) o[k] = Math.min(30, o[k] * 1.12); select(rb.build.sel); break;
    case 'small': for (const k of ['sx', 'sy', 'sz']) o[k] = Math.max(0.2, o[k] / 1.12); select(rb.build.sel); break;
    case 'dup': { const c = Object.assign({}, o, { x: o.x + 2, z: o.z + 2 }); store.rbPlaced.push(c); rbDirty(); select(store.rbPlaced.length - 1); return; }
    case 'del': store.rbPlaced.splice(rb.build.sel, 1); rbDirty(); select(-1); return;
    case 'done': select(-1); return;
  }
  rbDirty(); selBox(placedMeshes[rb.build.sel]);
}
function bdSlider(k, v) { const o = selObj(); if (!o) return; o[k] = Math.max(0.2, Math.pow(30, v / 100)); rbDirty(); selBox(placedMeshes[rb.build.sel]); }
// free camera: held buttons / keys move it, drag turns it, wheel dollies
const bdHold = {};
function updateBuild(dt) {
  if (!rb.build) return; const f = cam.free, k = c => keys.has(c), sp = (6 + f.y * 0.6) * dt;
  const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw);
  let mx = (bdHold.right || k('KeyD') || k('ArrowRight') ? 1 : 0) - (bdHold.left || k('KeyA') || k('ArrowLeft') ? 1 : 0), my = (bdHold.fwd || k('KeyW') || k('ArrowUp') ? 1 : 0) - (bdHold.back || k('KeyS') || k('ArrowDown') ? 1 : 0), my2 = (bdHold.up || k('KeyR') ? 1 : 0) - (bdHold.down || k('KeyF') ? 1 : 0);
  // forward along the view, sideways to the right of the view (right = (-fz, fx))
  f.x += (fx * my - fz * mx) * sp; f.z += (fz * my + fx * mx) * sp;
  f.x = clamp(f.x, -RB_W / 2 + 2, RB_W / 2 - 2); f.z = clamp(f.z, -RB_L / 2 + 2, RB_L / 2 - 2); f.y = clamp(f.y + my2 * sp, 0.6, RB_FH - 1.0);
  if (bdHold.zin || bdHold.zout) dolly((bdHold.zin ? 1 : -1) * sp * 1.6);
  if (physT > 0) { physT -= dt; if (physT <= 0) rbBuildWindow(); }
  if (selHelper) selHelper.update();
}
function dolly(d) { const f = cam.free, cp = Math.cos(f.pitch); f.x += Math.sin(f.yaw) * cp * d; f.z += Math.cos(f.yaw) * cp * d; f.y = clamp(f.y - Math.sin(f.pitch) * d, 0.6, RB_FH - 1.0); }
function updateCameraFree() {
  const f = cam.free, cp = Math.cos(f.pitch);
  camera.position.set(f.x, f.y, f.z); camera.lookAt(f.x + Math.sin(f.yaw) * cp, f.y - Math.sin(f.pitch), f.z + Math.cos(f.yaw) * cp);
  if (camera.view && camera.view.enabled) camera.clearViewOffset();
  if (Math.abs(camera.fov - 62) > 0.05) { camera.fov = cam.fov = 62; camera.updateProjectionMatrix(); }
}
// pointer: tap selects, drag on the selected object slides it on the floor, drag elsewhere turns the camera
let bdPtr = null;
function bdPointerDown(e) {
  const r = cv.getBoundingClientRect(), nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -((e.clientY - r.top) / r.height) * 2 + 1;
  _ndc.set(nx, ny); _ray.setFromCamera(_ndc, camera); const hits = _ray.intersectObjects(placedMeshes.filter(m => m.visible), false);
  bdPtr = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, obj: null };
  if (hits.length) { const i = hits[0].object.userData.idx; if (i === rb.build.sel) { bdPtr.obj = i; bdPtr.off = (() => { const o = selObj(), p = floorHit(nx, ny, o.y || 0); return p ? [o.x - p.x, o.z - p.z] : [0, 0]; })(); } bdPtr.hit = i; }
}
function bdPointerMove(e) {
  if (!bdPtr || e.pointerId !== bdPtr.id) return; const dx = e.clientX - bdPtr.x, dy = e.clientY - bdPtr.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) bdPtr.moved = true;
  if (bdPtr.obj !== null && bdPtr.obj !== undefined && bdPtr.moved) {
    const r = cv.getBoundingClientRect(), o = selObj(); const p = floorHit(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1, o.y || 0);
    if (p) { o.x = +(p.x + bdPtr.off[0]).toFixed(2); o.z = +(p.z + bdPtr.off[1]).toFixed(2); rbSyncPlaced(); physT = 0.35; }
  } else { const s = e.pointerType === 'mouse' ? 0.004 : 0.006; cam.free.yaw -= dx * s; cam.free.pitch = clamp(cam.free.pitch + dy * s, -1.4, 1.5); bdPtr.x = e.clientX; bdPtr.y = e.clientY; }
}
function bdPointerUp(e) {
  if (!bdPtr || e.pointerId !== bdPtr.id) return;
  if (!bdPtr.moved) select(bdPtr.hit !== undefined ? bdPtr.hit : -1);
  else if (bdPtr.obj !== null && bdPtr.obj !== undefined) saveSoon();
  bdPtr = null;
}

/* ============================================================
   Flying car: any top speed you choose (with a live preview),
   and an endless test ground (code 1818 there, 1717 back)
   ============================================================ */
const FLY_UNITS = { kmh: ['کیلومتر بر ساعت', 1 / 3.6], ms: ['متر بر ثانیه', 1], mmin: ['متر بر دقیقه', 1 / 60], kmmin: ['کیلومتر بر دقیقه', 1000 / 60], kms: ['کیلومتر بر ثانیه', 1000] };
const fly = { obj: null };
function flySet() { return store.fly || (store.fly = { val: 300, unit: 'kmh' }); }
const flyMs = () => { const f = flySet(); return clamp(f.val * FLY_UNITS[f.unit][1], 0.3, 60000); };
function fmtSpeed(ms) { const f = flySet(), v = ms / FLY_UNITS[f.unit][1]; return (v >= 100 ? Math.round(v) : v >= 1 ? Math.round(v * 10) / 10 : v > 0.0005 ? +v.toPrecision(2) : 0).toLocaleString('fa-IR', { maximumFractionDigits: 4 }); }
function makeFlyerMesh() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x1a2a4a, metalness: 0.75, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.5, metalness: 0.6 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a1220, metalness: 0.1, roughness: 0.02, transparent: true, opacity: 0.55, clearcoat: 1 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x5ae8ff, toneMapped: false }), red = new THREE.MeshBasicMaterial({ color: 0xff3040, toneMapped: false }), white = new THREE.MeshBasicMaterial({ color: 0xf4fbff, toneMapped: false });
  const shape = new THREE.Shape(); shape.moveTo(-2.3, 0.25); shape.lineTo(2.0, 0.25); shape.quadraticCurveTo(2.55, 0.32, 2.45, 0.55); shape.quadraticCurveTo(1.6, 0.85, 0.6, 0.95); shape.lineTo(-1.6, 1.0); shape.quadraticCurveTo(-2.3, 0.95, -2.35, 0.6); shape.closePath();
  const bg = new THREE.ExtrudeGeometry(shape, { depth: 1.7, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.12, bevelSegments: 4, curveSegments: 10 }); bg.translate(0, 0, -0.85); bg.rotateY(-Math.PI / 2);
  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, par = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; par.add(m); return m; };
  add(bg, paint);
  const can = new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2); add(can, glass, 0, 0.92, -0.1, 0, 0, 0).scale.set(0.72, 0.5, 1.35);
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(1.4, 0.06, 0.9), paint, sx * 1.35, 0.55, -0.9, 0, 0, sx * 0.08);
    for (const sz of [-1, 1]) { const pod = new THREE.Group(); pod.position.set(sx * 1.15, 0.28, sz * 1.45); body.add(pod); add(new THREE.CylinderGeometry(0.42, 0.48, 0.22, 24), dark, 0, 0, 0, 0, 0, 0, pod); add(new THREE.TorusGeometry(0.4, 0.05, 8, 28), glow, 0, -0.1, 0, Math.PI / 2, 0, 0, pod); add(new THREE.CircleGeometry(0.34, 24), glow, 0, -0.12, 0, Math.PI / 2, 0, 0, pod); }
    add(new THREE.BoxGeometry(0.34, 0.08, 0.04), white, sx * 0.62, 0.5, 2.5); add(new THREE.BoxGeometry(0.4, 0.07, 0.04), red, sx * 0.62, 0.62, -2.47);
  }
  add(new THREE.BoxGeometry(0.06, 0.45, 0.7), paint, 0, 1.15, -2.0, -0.35);
  const jets = [-0.38, 0.38].map(x => add(new THREE.ConeGeometry(0.2, 1.2, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x8ae8ff, transparent: true, opacity: 0.0, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }), x, 0.55, -3.0, -Math.PI / 2));
  g.userData = { body, jets };
  return g;
}
function spawnFlyer() {
  const P = player; if (P.where !== 'out' && P.where !== 'test') { toast('ماشین پرنده فقط بیرون و توی محیط آزمایشی ظاهر می‌شه'); return; }
  if (!fly.obj) fly.obj = { mesh: makeFlyerMesh(), x: 0, y: 0, z: 0, h: 0, v: 0, vy: 0, pitch: 0, roll: 0, where: null };
  const F = fly.obj, a = P.facing - Math.PI / 2; F.x = P.pos.x + Math.sin(a) * 2.9; F.z = P.pos.z + Math.cos(a) * 2.9; F.h = P.facing; F.v = F.vy = 0;
  F.y = (P.where === 'out' ? groundH(F.x, F.z) : 0) + 0.8; F.where = P.where; zoneScene(P.where).add(F.mesh);
  for (let k = 0; k < 16; k++) FX.emit(F.x + (Math.random() - 0.5) * 3, F.y, F.z + (Math.random() - 0.5) * 4, 0, 0.5, 0, 1.2, 0.1, 0.8, 0x8ae8ff, 0.5, 0.1);
  Audio.slide(); banner('ماشین پرنده آماده است', `حداکثر سرعت: ${fmtSpeed(flyMs())} ${FLY_UNITS[flySet().unit][0]} — نزدیکش شو و سوار شو`);
}
function boardFlyer() { const P = player; if (!fly.obj || fly.obj.where !== P.where) return; P.state = 'fly'; P.inCar = fly.obj; P.anim.special = 'drive'; P.anim.sw = 0; P.vel.set(0, 0, 0); Audio.door(); Audio.start(); cam.yaw = fly.obj.h; }
function leaveFlyer() {
  const P = player, F = fly.obj, ground = F.where === 'out' ? groundH(F.x, F.z) : 0;
  if (F.y - ground > 4 || Math.abs(F.v) > 12) { setPrompt('اول آروم کن و فرود بیا (دکمهٔ «پایین»)', 'پیاده شو', 1.5); return; }
  const a = F.h - Math.PI / 2; P.pos.set(F.x + Math.sin(a) * 2.2, ground, F.z + Math.cos(a) * 2.2); P.state = 'foot'; P.inCar = null; P.anim.special = null; P.vel.set(0, 0, 0); P.facing = F.h; F.v = 0; Audio.door(); Audio.engine(false, 0, 0);
}
const _fq = new THREE.Quaternion(), _fe = new THREE.Euler();
function updateFly(dt) {
  const P = player, F = fly.obj; if (!F) { P.state = 'foot'; return; }
  const vmax = flyMs(), acc = Math.max(14, vmax * 0.7), up = (keys.has('Space') || input.fUp ? 1 : 0) - (keys.has('KeyC') || keys.has('ControlLeft') || input.fDown ? 1 : 0);
  const thr = input.my, target = thr * vmax;
  F.v += clamp(target - F.v, -acc * (thr === 0 ? 0.6 : 1.4) * dt, acc * dt);
  F.h -= input.mx * Math.max(0.55, 1.9 / (1 + Math.abs(F.v) / 120)) * dt * (F.v < -0.5 ? -1 : 1);
  const vv = 6 + Math.min(vmax * 0.25, 400); F.vy = damp(F.vy, up * vv, 3, dt);
  F.x += Math.sin(F.h) * F.v * dt; F.z += Math.cos(F.h) * F.v * dt; F.y += F.vy * dt;
  let ground = 0;
  if (F.where === 'out') {
    ground = groundH(F.x, F.z);
    // roofs you are above become the ground; walls you fly into push you back (never lift you onto the roof)
    if (F.y < 90) { world.col.query(F.x - 2.2, F.x + 2.2, F.z - 2.2, F.z + 2.2, _near); for (const c of _near) { if (c.minY > F.y + 1.2 || c.maxY > 1200) continue; if (c.maxY <= F.y + 0.9) { if (colOver(c, F.x, F.z, 1.0)) ground = Math.max(ground, c.maxY); } else if (colPush(c, F.x, F.z, 1.8)) { F.x += _push.nx * _push.pen; F.z += _push.nz * _push.pen; if (Math.abs(F.v) > 20 && !(F.bumpT > 0)) { F.v *= 0.45; cam.shake = Math.min(0.5, Math.abs(F.v) / 150); Audio.thud(Math.min(20, Math.abs(F.v) / 8), F.x, F.z); F.bumpT = 0.5; } } } }
    if (Math.abs(F.x) > 1550 || Math.abs(F.z) > 1550) { F.x = clamp(F.x, -1550, 1550); F.z = clamp(F.z, -1550, 1550); F.v *= 0.5; }
    if (F.z < RB_DOOR_Z + 1.6 && Math.abs(F.x) < RB_W / 2 + 2) { const imp = Math.abs(F.v * Math.cos(F.h)); F.z = RB_DOOR_Z + 1.6; if (imp > 25 && !(F.bumpT > 0)) { F.v *= 0.35; cam.shake = Math.min(0.6, imp / 200); Audio.thud(Math.min(20, imp / 10), F.x, F.z); F.bumpT = 0.6; } }
    if (F.bumpT > 0) F.bumpT -= dt;
  } else testRecentre(F);
  if (F.y < ground + 0.7) { F.y = ground + 0.7; if (F.vy < 0) F.vy = 0; }
  F.y = Math.min(F.y, 4000);
  // body attitude and engine sound
  F.pitch = damp(F.pitch, -clamp(F.vy / vv, -1, 1) * 0.22 - clamp((target - F.v) / (acc + 1), -1, 1) * 0.06, 4, dt); F.roll = damp(F.roll, input.mx * 0.45 * Math.min(1, Math.abs(F.v) / 15), 4, dt);
  const rpm = Math.min(1.2, Math.abs(F.v) / Math.max(vmax, 1)) ; Audio.engine(true, 0.5 + rpm, Math.abs(thr) * 0.8);
  // you stay in the seat
  P.pos.set(F.x, F.y, F.z);
  const kmh = fmtSpeed(Math.abs(F.v)); $('speedo').hidden = false; $('spd').textContent = kmh; $('spdunit').textContent = FLY_UNITS[flySet().unit][0]; $('gear').textContent = 'F';
  $('health').style.width = Math.min(100, (F.y - ground) / 5) + '%'; $('fuel-row').hidden = true;
  if (promptHold <= 0) setPrompt(`ارتفاع ${fa(Math.round(F.y - ground))} متر · ${touchUI ? '«بالا/پایین»' : '<b>Space</b>/<b>C</b>'} بالا و پایین · ${touchUI ? '«پیاده شو»' : '<b>E</b>'} پیاده شو`, 'پیاده شو');
  if (input.actQ) { input.actQ = false; leaveFlyer(); }
  input.jumpQ = false;
}
function syncFlyer(dt) {
  const F = fly.obj; if (!F) return;
  const m = F.mesh, hover = Math.abs(F.v) < 3 ? Math.sin(simTime * 2.2) * 0.06 : 0;
  m.visible = F.where === player.where; m.position.set(F.x, F.y + hover - 0.55, F.z); _fe.set(F.pitch, F.h, F.roll, 'YXZ'); m.quaternion.setFromEuler(_fe);
  const jet = clamp(Math.abs(F.v) / 30, 0, 1); for (const j of m.userData.jets) { j.material.opacity = jet * 0.7; j.scale.set(1, 1 + jet * 2.5, 1); }
  if (player.state === 'fly') { m.updateMatrixWorld(true); const H = player.H; _rv.set(0, 0.42, -0.15).applyMatrix4(m.matrixWorld); H.root.position.copy(_rv); H.root.quaternion.copy(m.quaternion); H.root.scale.setScalar(player.look.h || 1); player.steer = input.mx; }
}
// speed lines that stream past the camera when you go fast
let streaks = null;
function updateStreaks(dt) {
  const P = player, flyOn = P.state === 'fly' && fly.obj && Math.abs(fly.obj.v) > 45, tsp = Math.hypot(P.vel.x, P.vel.z), tb = !flyOn && P.where === 'rb' && P.turbo && tsp > 12, on = flyOn || tb;
  if (!streaks) { const n = 260, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3)); streaks = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.5, toneMapped: false, depthWrite: false })); streaks.frustumCulled = false; streaks.userData.s = Array.from({ length: n }, () => [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 60]); }
  if (streaks.parent !== zoneScene(P.where)) zoneScene(P.where).add(streaks);
  streaks.visible = on; if (!on) return;
  const F = fly.obj, v = flyOn ? Math.abs(F.v) : tsp * 7, hh = flyOn ? F.h : Math.atan2(P.vel.x, P.vel.z), fx = Math.sin(hh), fz = Math.cos(hh), rx = -fz, rz = fx, a = streaks.geometry.attributes.position.array, len = clamp(v * 0.012, 0.6, 9);
  streaks.material.opacity = clamp((v - 45) / 200, 0.15, 0.6);
  streaks.userData.s.forEach((s, i) => { s[2] -= v * dt * 0.25; if (s[2] < -10) { s[2] = 60; s[0] = Math.random() * 2 - 1; s[1] = Math.random() * 2 - 1; } const r = 3 + Math.abs(s[0]) * 14; const x = camera.position.x + fx * s[2] + rx * s[0] * r, y = camera.position.y + s[1] * r * 0.6, z = camera.position.z + fz * s[2] + rz * s[0] * r; a.set([x, y, z, x - fx * len, y, z - fz * len], i * 6); });
  streaks.geometry.attributes.position.needsUpdate = true;
}
function updateCameraFly(dt) {
  const F = fly.obj, P = player;
  if (cam.fp) { _eye.set(0, 1.05, 0.15).applyMatrix4(F.mesh.matrixWorld); camera.position.copy(_eye); const cp = Math.cos(cam.fpPitch); camera.lookAt(_eye.x + Math.sin(F.h + cam.fpYaw) * cp, _eye.y - Math.sin(cam.fpPitch), _eye.z + Math.cos(F.h + cam.fpYaw) * cp); P.H.hideHead = true; }
  else {
    P.H.hideHead = false;
    if (simTime - cam.lastLook > 1.2) cam.yaw += angDiff(cam.yaw, F.v >= -0.5 ? F.h : F.h + Math.PI) * Math.min(1, dt * 3);
    const v = Math.abs(F.v), dist = (8 + Math.min(v * 0.015, 10)) * cam.zoom, cp = Math.cos(cam.pitch * 0.6);
    cam.target.set(F.x, F.y + 1.2, F.z);
    camera.position.set(F.x - Math.sin(cam.yaw) * dist * cp, F.y + 2 + Math.sin(cam.pitch * 0.6) * dist, F.z - Math.cos(cam.yaw) * dist * cp);
    const gy = F.where === 'out' ? groundH(camera.position.x, camera.position.z) : 0; camera.position.y = Math.max(camera.position.y, gy + 0.6);
    camera.lookAt(cam.target);
  }
  if (camera.view && camera.view.enabled) camera.clearViewOffset();
  const fovT = 68 + clamp(Math.log10(1 + Math.abs(F.v)) * 9, 0, 32); cam.fov = damp(cam.fov, fovT, 3, dt); camera.fov = cam.fov; camera.updateProjectionMatrix();
}
/* ---------- the endless test ground ---------- */
const testScene = new THREE.Scene(); let test = null, testPool = null;
function gridTexture(base, line, bold) {
  const c = mkCanvas(512), g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 512, 512); speckle(g, 512, 6000, ['rgba(255,255,255,0.08)', 'rgba(0,0,0,0.06)'], 1, 2, 0.5);
  g.strokeStyle = line; g.lineWidth = 2; for (let k = 0; k <= 10; k++) { g.beginPath(); g.moveTo(k * 51.2, 0); g.lineTo(k * 51.2, 512); g.stroke(); g.beginPath(); g.moveTo(0, k * 51.2); g.lineTo(512, k * 51.2); g.stroke(); }
  g.strokeStyle = bold; g.lineWidth = 6; g.strokeRect(0, 0, 512, 512); const t = toTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function buildTest() {
  if (test) return; test = { off: 0, offZ: 0, markers: [], col: new Colliders() };
  testScene.background = new THREE.Color(0x9ec8ef); testScene.fog = new THREE.Fog(0xcfe0f0, 400, 2600);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = mix(vec3(0.85,0.9,0.95), vec3(0.28,0.52,0.86), smoothstep(0.0, 0.5, h)); gl_FragColor = vec4(c,1.0);\n#include <colorspace_fragment>\n}' }));
  test.sky = sky; testScene.add(sky);
  test.ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ map: gridTexture('#e8e0d0', 'rgba(120,110,95,0.35)', 'rgba(90,80,70,0.7)'), roughness: 0.9 }));
  test.ground.material.map.repeat.set(60, 60); test.ground.rotation.x = -Math.PI / 2; test.ground.receiveShadow = true; testScene.add(test.ground);
  test.runway = new THREE.Mesh(new THREE.PlaneGeometry(6000, 40), new THREE.MeshStandardMaterial({ map: T.asphalt, roughness: 0.8, color: 0x8a8a8a })); test.runway.material.map = T.asphalt.clone(); test.runway.material.map.wrapS = test.runway.material.map.wrapT = THREE.RepeatWrapping; test.runway.material.map.repeat.set(600, 4); test.runway.material.map.needsUpdate = true;
  test.runway.rotation.x = -Math.PI / 2; test.runway.position.y = 0.02; test.runway.receiveShadow = true; testScene.add(test.runway);
  const hemi = new THREE.HemisphereLight(0xdfefff, 0x8a7a60, 1.2); testScene.add(hemi);
  test.sun = new THREE.DirectionalLight(0xfff4e0, 2.4); test.sun.castShadow = true; test.sun.shadow.mapSize.set(1024, 1024); const sc = test.sun.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.far = 300; testScene.add(test.sun, test.sun.target);
  // distance posts every 100 m along the runway (relabelled as you travel)
  for (let k = 0; k < 30; k++) {
    const c = mkCanvas(256, 128), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group(); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 8), new THREE.MeshStandardMaterial({ color: 0xe8303a })); post.position.y = 3; post.castShadow = true; g.add(post);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false })); sign.position.y = 7.2; g.add(sign);
    testScene.add(g); test.markers.push({ g, c, tex, v: null });
  }
  // rings to fly through, every 500 m
  test.rings = []; for (let k = 0; k < 8; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(9, 0.6, 12, 48), new THREE.MeshStandardMaterial({ color: 0xffb340, emissive: 0xff8a1a, emissiveIntensity: 0.8 })); r.rotation.y = Math.PI / 2; testScene.add(r); test.rings.push(r); }
  // far mountains
  for (let k = 0; k < 26; k++) { const a = k / 26 * Math.PI * 2, R_ = 2200 + Math.random() * 300, h = 160 + Math.random() * 260; const m = new THREE.Mesh(new THREE.ConeGeometry(260 + Math.random() * 200, h, 7), new THREE.MeshStandardMaterial({ color: 0x8a9aa8, flatShading: true, fog: true })); m.position.set(Math.cos(a) * R_, h / 2 - 5, Math.sin(a) * R_); m.userData.base = [Math.cos(a) * R_, Math.sin(a) * R_]; testScene.add(m); (test.mtn || (test.mtn = [])).push(m); }
  testPool = new HumanPool(testScene, 3);
}
// keep numbers small: shift the world back toward the origin, but remember how far you went
function testRecentre(F) {
  if (Math.abs(F.x) > 3000 || Math.abs(F.z) > 3000) { const sx = Math.round(F.x / 100) * 100, sz = Math.round(F.z / 100) * 100; F.x -= sx; F.z -= sz; test.off += sx; test.offZ += sz; player.pos.x -= sx; player.pos.z -= sz; cam.target.x -= sx; cam.target.z -= sz; camera.position.x -= sx; camera.position.z -= sz; }
}
function updateTest(dt) {
  if (!test) return; const P = player, cx = P.pos.x, cz = P.pos.z;
  test.sky.position.set(camera.position.x, 0, camera.position.z);
  test.ground.position.set(Math.round(cx / 100) * 100, 0, Math.round(cz / 100) * 100); test.ground.material.map.offset.set((test.ground.position.x + test.off) / 100 % 1, -((test.ground.position.z + test.offZ) / 100 % 1));
  test.runway.position.x = Math.round(cx / 10) * 10; test.runway.position.z = -test.offZ; test.runway.material.map.offset.x = ((test.runway.position.x + test.off) / 10) % 1;
  for (const m of test.mtn) m.position.set(camera.position.x + m.userData.base[0], m.position.y, camera.position.z + m.userData.base[1]);
  test.sun.target.position.set(cx, 0, cz); test.sun.position.set(cx + 80, 200, cz + 60); test.sun.target.updateMatrixWorld();
  const base = Math.floor((cx + test.off) / 100) - 8;
  test.markers.forEach((mk, i) => {
    const d = (base + i) * 100; mk.g.position.set(d - test.off, 0, 24 - test.offZ);
    if (mk.v !== d) { mk.v = d; const g = mk.c.getContext('2d'); g.fillStyle = '#14162a'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#ffffff'; g.font = 'bold 58px Vazirmatn, Tahoma'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(Math.abs(d) >= 1000 ? fa((d / 1000).toLocaleString('en', { maximumFractionDigits: 1 })) + ' کیلومتر' : fa(d) + ' متر', 128, 66); mk.tex.needsUpdate = true; }
  });
  const rb0 = Math.floor((cx + test.off) / 500) - 2; test.rings.forEach((r, i) => r.position.set((rb0 + i) * 500 - test.off, 30, -test.offZ));
}
function goTest() {
  const P = player; if (P.where === 'test') return;
  if (P.where === 'rb') leaveRB(); if (P.where === 'in') { toast('اول از ساختمان بیرون بیا'); return; }
  if (P.state === 'car') exitCar(); if (P.state === 'fly') { fly.obj.v = 0; }
  buildTest();
  P.testFrom = { x: P.pos.x, y: P.pos.y, z: P.pos.z, flying: P.state === 'fly' };
  P.where = 'test'; testPool.attach(P); test.off = 0; test.offZ = 0;
  if (fly.obj) { fly.obj.where = 'test'; testScene.add(fly.obj.mesh); fly.obj.x = 0; fly.obj.y = P.state === 'fly' ? 20 : 0.8; fly.obj.z = 0; fly.obj.h = Math.PI / 2; }
  if (P.state !== 'fly') { P.pos.set(-6, 0, 4); P.facing = Math.PI / 2; P.vel.set(0, 0, 0); if (!fly.obj) spawnFlyer(); }
  cam.yaw = Math.PI / 2; cam.target.set(P.pos.x, P.pos.y + 1.45, P.pos.z);
  banner('محیط آزمایشی', 'سوار ماشین پرنده شو و سرعتش رو امتحان کن · برای برگشت کد ۱۷۱۷');
}
function leaveTest() {
  const P = player; if (P.where !== 'test') { toast('الان توی محیط آزمایشی نیستی'); return; }
  const f = P.testFrom || { x: -3, y: CURB, z: roadX(2) + RH + 2.2 };
  P.where = 'out'; outdoorPool.attach(P);
  if (P.state === 'fly' && fly.obj) { fly.obj.where = 'out'; scene.add(fly.obj.mesh); fly.obj.x = f.x; fly.obj.z = f.z; fly.obj.y = Math.max(f.y, groundH(f.x, f.z)) + 6; fly.obj.v = 0; }
  else { P.state = 'foot'; P.pos.set(f.x, f.y, f.z); P.vel.set(0, 0, 0); if (fly.obj) { fly.obj.where = 'out'; scene.add(fly.obj.mesh); const a = P.facing - Math.PI / 2; fly.obj.x = f.x + Math.sin(a) * 4; fly.obj.z = f.z + Math.cos(a) * 4; fly.obj.y = groundH(fly.obj.x, fly.obj.z) + 0.8; } }
  cam.target.set(P.pos.x, P.pos.y + 1.45, P.pos.z); banner('برگشتی به شهر', ''); saveGame();
}
function runCode(c) {
  c = String(c || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, '');
  if (c === '1818') goTest(); else if (c === '1717') leaveTest(); else if (c === '1400') { if (player.where !== 'out') { toast('آتش‌بازی رو باید بیرون توی شهر ببینی'); return; } startFireworks(70); banner('آتش‌بازی!', 'به آسمون نگاه کن'); } else toast('کد نامعتبر است');
}
/* ---------- the speed panel with a live preview in its own little 3D view ---------- */
let prev = null;
const PREV_ENVS = [
  { n: 'بیابان', sky: 0xf2c88a, ground: '#d8b47a', line: 'rgba(120,80,40,0.3)', obj: 'cactus', fog: 0xf2d0a0 },
  { n: 'برفی', sky: 0xcfe4f8, ground: '#f4f8fc', line: 'rgba(120,140,170,0.35)', obj: 'pine', fog: 0xe8f0f8 },
  { n: 'جنگل', sky: 0x9ed0f0, ground: '#5a8a3a', line: 'rgba(30,60,20,0.35)', obj: 'tree', fog: 0xb8d8c8 },
  { n: 'شهر در شب', sky: 0x0a1020, ground: '#2a2c32', line: 'rgba(255,200,100,0.25)', obj: 'tower', fog: 0x101828 },
  { n: 'ساحل', sky: 0x8ad0f8, ground: '#e8d8a8', line: 'rgba(60,140,200,0.3)', obj: 'palm', fog: 0xbfe6ff }
];
function openFlyPanel() {
  const f = flySet(); $('fly-panel').hidden = false; $('fly-val').value = f.val; $('fly-unit').value = f.unit; syncFlyRange(); updateFlyInfo();
  const cvp = $('fly-prev'), env = PREV_ENVS[Math.floor(Math.random() * PREV_ENVS.length)];
  try {
    const r = new THREE.WebGLRenderer({ canvas: cvp, antialias: true, alpha: false, powerPreference: 'low-power' }); r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setSize(cvp.clientWidth || 360, cvp.clientHeight || 190, false);
    r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Scene(); sc.background = new THREE.Color(env.sky); sc.fog = new THREE.Fog(env.fog, 60, 420);
    const camP = new THREE.PerspectiveCamera(50, (cvp.clientWidth || 360) / (cvp.clientHeight || 190), 0.1, 1000);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, env.n === 'شهر در شب' ? 0.5 : 1.2)); const sun = new THREE.DirectionalLight(0xffffff, env.n === 'شهر در شب' ? 0.4 : 2); sun.position.set(30, 60, 20); sc.add(sun);
    const gt = gridTexture(env.ground, env.line, env.line); gt.repeat.set(100, 100);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 })); ground.rotation.x = -Math.PI / 2; sc.add(ground);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(2000, 8), new THREE.MeshStandardMaterial({ color: env.n === 'برفی' ? 0x8a9098 : 0x3a3c40, roughness: 0.7 })); road.rotation.x = -Math.PI / 2; road.position.y = 0.02; sc.add(road);
    const posts = [], labels = [];
    for (let k = 0; k < 14; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), new THREE.MeshStandardMaterial({ color: k % 5 ? 0xf4f4f4 : 0xe8303a, emissive: env.n === 'شهر در شب' ? 0x553300 : 0 })); p.position.set(0, 1.5, -5); sc.add(p); posts.push(p); }
    const props = []; for (let k = 0; k < 40; k++) { const o = prevProp(env.obj); o.userData.x = Math.random() * 600 - 300; o.position.z = (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 120); sc.add(o); props.push(o); }
    const car = makeFlyerMesh(); car.rotation.y = Math.PI / 2; car.position.set(0, 1.6, 0); sc.add(car);
    prev = { r, sc, camP, posts, props, car, dist: 0, last: performance.now(), env, gt };
    $('fly-env').textContent = 'محیط آزمایشی شانسی: ' + env.n;
    const loop = () => { if (!prev) return; prev.raf = requestAnimationFrame(loop); prevFrame(); }; loop();
  } catch (e) { $('fly-env').textContent = 'پیش‌نمایش زنده روی این دستگاه در دسترس نیست'; }
}
function prevProp(kind) {
  const g = new THREE.Group(), M_ = (c, e) => new THREE.MeshStandardMaterial({ color: c, emissive: e || 0, flatShading: true });
  if (kind === 'cactus') { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 4, 8), M_(0x3a7a3a)); m.position.y = 2; g.add(m); const a = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.6, 8), M_(0x3a7a3a)); a.position.set(0.7, 2.6, 0); g.add(a); }
  else if (kind === 'pine') { const t = new THREE.Mesh(new THREE.ConeGeometry(2, 6, 7), M_(0x2a5a3a)); t.position.y = 3.5; g.add(t); const s = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.6, 7), M_(0xffffff)); s.position.y = 6; g.add(s); }
  else if (kind === 'tree') { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3, 6), M_(0x5a4030)); t.position.y = 1.5; g.add(t); const c = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), M_(0x3f7a2a)); c.position.y = 4.5; g.add(c); }
  else if (kind === 'tower') { const h = 10 + Math.random() * 40; const t = new THREE.Mesh(new THREE.BoxGeometry(8, h, 8), M_(0x1a2030, 0x221a08)); t.position.y = h / 2; g.add(t); }
  else { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 6, 6), M_(0x8a6a4a)); t.position.y = 3; t.rotation.z = 0.15; g.add(t); for (let k = 0; k < 5; k++) { const l = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.6), M_(0x3a8a3a)); l.position.y = 6; l.rotation.y = k * 1.25; l.rotation.z = -0.3; g.add(l); } }
  return g;
}
function prevFrame() {
  const p = prev, now = performance.now(), dt = Math.min(0.05, (now - p.last) / 1000); p.last = now;
  const v = flyMs(); p.dist += v * dt;
  // post spacing adapts so a few go by every second at any speed
  const sp = Math.pow(10, Math.max(0, Math.ceil(Math.log10(Math.max(1, v * 0.35)))));
  p.posts.forEach((o, k) => { const idx = Math.floor(p.dist / sp) - 3 + k; o.position.x = idx * sp - p.dist; o.position.z = -5.5; o.visible = o.position.x < 400; o.material.color.set(idx % 10 === 0 ? 0xe8303a : 0xf4f4f4); o.scale.y = idx % 10 === 0 ? 1.6 : 1; });
  const period = 600; p.props.forEach(o => { const s = Math.abs(o.position.z) / 40 + 1; o.position.x = ((o.userData.x - p.dist / Math.min(s, 1.5)) % period + period * 1.5) % period - period / 2; });
  p.gt.offset.x = (p.dist / 20) % 1;
  p.car.position.y = 1.6 + Math.sin(now * 0.004) * 0.08; p.car.userData.jets.forEach(j => { j.material.opacity = Math.min(0.7, v / 40); j.scale.set(1, 1 + Math.min(3, v / 30), 1); });
  p.camP.position.set(-9, 3.4, 11); p.camP.lookAt(2, 1.4, 0);
  p.r.render(p.sc, p.camP);
  const lbl = $('fly-post'); const t = sp >= 1000 ? fa(sp / 1000) + ' کیلومتر' : fa(sp) + ' متر'; if (lbl.textContent !== t) lbl.textContent = 'فاصلهٔ هر تیرک: ' + t;
}
function closeFlyPanel() {
  $('fly-panel').hidden = true;
  if (prev) { cancelAnimationFrame(prev.raf); prev.sc.traverse(o => { if (o.geometry) o.geometry.dispose(); }); prev.r.dispose(); try { prev.r.forceContextLoss(); } catch (_) { } prev = null; }
}
function syncFlyRange() { const v = flyMs(); $('fly-range').value = Math.round(Math.log10(Math.max(1, v)) / Math.log10(60000) * 1000); }
function updateFlyInfo() {
  const v = flyMs(); const parts = [`هر ثانیه ${fa(Math.round(v).toLocaleString('en'))} متر`, `${(v * 3.6).toLocaleString('fa-IR', { maximumFractionDigits: 0 })} کیلومتر بر ساعت`, `${(v * 60 / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 2 })} کیلومتر بر دقیقه`];
  if (v >= 1000) parts.push(`${(v / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 2 })} کیلومتر بر ثانیه`);
  $('fly-info').textContent = parts.join(' · ');
}

/* ---------- glue for the extra areas (rainbow hall, test ground) ---------- */
function zoneScene(w) { return w === 'in' ? interiorScene : w === 'rb' ? rbScene : w === 'test' ? testScene : scene; }
function zoneCol(w) { return w === 'in' ? interior.col : w === 'rb' ? rb.col : w === 'test' ? test.col : world.col; }
function updatePlayerZone(dt) {
  const P = player, col = zoneCol(P.where), key = touchUI ? '' : '<b>E</b> — ';
  let promptTxt = '', actLabel = '';
  if (P.state === 'hide') {
    P.vel.set(0, 0, 0); input.jumpQ = false;
    const sp = P.hideSpot; promptTxt = `${sp.kind === 'in' ? 'داخلِ' : 'پشتِ'} «${sp.name}» قایم شدی · ${touchUI ? '«بیا بیرون»' : '<b>E</b>'} بیا بیرون`; actLabel = 'بیا بیرون';
    if (input.actQ) { input.actQ = false; rbUnhide(); }
    setPrompt(promptTxt, actLabel); return;
  }
  if (P.state === 'use') { const u = P.use; u.t += dt; P.vel.set(0, 0, 0); if (input.actQ || (Math.hypot(input.mx, input.my) > 0.5 && u.t > 0.6) || (u.dur && u.t > u.dur)) { input.actQ = false; endUse(); } setPrompt(u.dur ? '' : `${touchUI ? '«بلند شو»' : '<b>E</b>'} بلند شو`, 'بلند شو'); return; }
  if (P.state !== 'foot' && P.state !== 'down') { P.state = 'foot'; }
  if (P.where === 'rb' && rb.lift) { P.vel.x = P.vel.z = 0; input.actQ = false; input.jumpQ = false; stepCharacter(P, col, dt, false); rbUpdateLift(dt); return; }
  // walking, running and jumping on a flat floor
  let mx = input.mx, my = input.my; if (chat.open || rb.build) { mx = 0; my = 0; input.jumpQ = false; }
  const mag = Math.min(1, Math.hypot(mx, my)), fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), rx = -Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
  let dx = fx * my + rx * mx, dz = fz * my + rz * mx; const dl = Math.hypot(dx, dz); if (dl > 0) { dx /= dl; dz /= dl; }
  const inCore = P.where === 'rb' && rbInCore(P.pos.x, P.pos.z, 0.5), turbo = P.where === 'rb' && !rb.lift ? (P.turbo === 2 && inCore ? 1 : P.turbo || 0) : 0;
  const running = (input.run || (touchUI && mag > 0.93)) && store.energy > 8, tsp = mag * (turbo === 2 ? 220 : turbo ? 24 : running ? 6.6 : 2.5), k = P.onGround ? (turbo === 2 ? 2.2 : turbo ? 5 : 12) : 2.5;
  P.stepH = turbo === 2 ? 4.2 : 0;
  P.vel.x = damp(P.vel.x, dx * tsp, k, dt); P.vel.z = damp(P.vel.z, dz * tsp, k, dt);
  if (cam.fpOn && !chat.open) P.facing += angDiff(P.facing, cam.yaw) * Math.min(1, 18 * dt); else if (tsp > 0.1) P.facing += angDiff(P.facing, Math.atan2(dx, dz)) * Math.min(1, 12 * dt);
  if (input.jumpQ && P.onGround) { P.vel.y = 6.6; P.onGround = false; Audio.step(true); } input.jumpQ = false;
  const nSub = Math.min(48, Math.max(1, Math.ceil(Math.hypot(P.vel.x, P.vel.z) * dt / 0.2)));
  for (let q = 0; q < nSub; q++) stepCharacter(P, col, dt / nSub, false);
  if (P.onGround) { const ph = Math.floor(P.anim.phase / Math.PI); if (ph !== P.stepPh) { P.stepPh = ph; if (Math.hypot(P.vel.x, P.vel.z) > 0.8) Audio.step(running); } }
  if (P.where === 'rb') { rbEscCarry(P, dt); if (P.pos.y > 6.6) rbChangeFloor(1); else if (P.pos.y < -3.6) rbChangeFloor(-1); if (P.pos.y < -12) { P.pos.y = 0; P.vel.set(0, 0, 0); rbFreeAt(P.pos); } }
  else if (P.pos.y < -5) P.pos.set(0, 0, 0);
  if (chat.open) { input.actQ = false; if (!chat.npc || Math.hypot(chat.npc.pos.x - P.pos.x, chat.npc.pos.z - P.pos.z) > 5) closeChat(); return; }
  if (P.where === 'rb') {
    const G = rb.game, sp = G && G.phase !== 'over' ? nearestSpot(1.8) : null, n = nearestNPC(rb.people.filter(p => !p.hidden), 2.6);
    if (rb.floor === 0 && P.pos.z > RB_L / 2 - 9 && Math.abs(P.pos.x) < 13 && P.pos.y < 2 && !rb.lift) { promptTxt = `${key}خروج به شهر`; actLabel = 'خروج'; if (input.actQ) { input.actQ = false; leaveRB(); return; } if (P.pos.z > RB_L / 2 - 2.2) { leaveRB(); return; } }
    else if (rbInLift(P) && !rb.build) { promptTxt = `${key}آسانسور — انتخاب طبقه`; actLabel = 'آسانسور'; if (input.actQ) { input.actQ = false; openLift(); } }
    else if (sp && !rb.build) { promptTxt = `${key}${sp.kind === 'in' ? 'برو داخلِ' : 'قایم شو پشتِ'} «${sp.name}»`; actLabel = 'قایم شو'; if (input.actQ) { input.actQ = false; rbHide(sp); } }
    else if (n && !(G && G.phase !== 'over')) { promptTxt = `${key}با <b>${n.persona.name}</b> حرف بزن`; actLabel = 'حرف بزن'; if (input.actQ) { input.actQ = false; openChat(n); } }
  } else if (P.where === 'test') {
    if (fly.obj && fly.obj.where === 'test' && Math.hypot(fly.obj.x - P.pos.x, fly.obj.z - P.pos.z) < 3.4) { promptTxt = `${key}سوار ماشین پرنده شو`; actLabel = 'سوار شو'; if (input.actQ) { input.actQ = false; boardFlyer(); } }
    else promptTxt = 'محیط آزمایشی · برای برگشت به شهر کد ۱۷۱۷ را بزن';
  }
  input.actQ = false; setPrompt(rb.build ? '' : promptTxt, actLabel);
}
// inside a hiding place you peek out through the gap
function updateCameraHide(dt) {
  const P = player, sp = P.hideSpot, eh = sp.pose === 'lie' ? 0.35 : sp.pose === 'crouch' || sp.pose === 'sit' ? 0.85 : 1.5;
  const ex = sp.x + Math.sin(sp.face) * 0.2, ez = sp.z + Math.cos(sp.face) * 0.2, ey = sp.y + eh, yaw = cam.hideYaw ?? sp.face, pt = cam.hidePitch ?? 0, cp = Math.cos(pt);
  camera.position.set(ex, ey, ez); camera.lookAt(ex + Math.sin(yaw) * cp, ey - Math.sin(pt), ez + Math.cos(yaw) * cp);
  if (camera.view && camera.view.enabled) camera.clearViewOffset();
  cam.fov = damp(cam.fov, 70, 3, dt); camera.fov = cam.fov; camera.updateProjectionMatrix(); P.H.hideHead = false;
}
/* a 3D arrow over your head that points to wherever you're heading */
let guideArrow = null;
function updateGuide(dt) {
  const P = player, on = !!waypoint && P.where === 'out';
  if (!guideArrow) { const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0xffb340, toneMapped: false }); const head = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 16), m); head.rotation.x = Math.PI / 2; head.position.z = 0.55; const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 10), m); tail.rotation.x = Math.PI / 2; g.add(head, tail); scene.add(g); guideArrow = g; }
  guideArrow.visible = on; if (!on) return;
  const src = P.state === 'car' ? P.car : P.state === 'fly' && fly.obj ? fly.obj : null, x = src ? src.x : P.pos.x, y = src ? (src.y || 0) + 3.2 : P.pos.y + 2.55, z = src ? src.z : P.pos.z;
  guideArrow.position.set(x, y + Math.sin(simTime * 3) * 0.08, z); guideArrow.rotation.y = Math.atan2(waypoint.x - x, waypoint.z - z);
}
/* people you invited walk off toward the rainbow building */
function updateInvites(dt) {
  for (let i = npcs.length - 1; i >= 0; i--) { const n = npcs[i]; if (!n.invitedAway) continue; if (chat.open && chat.npc === n) continue; n.awayT = (n.awayT || 0) + dt; if (n.mode !== 'flee' && n.awayT < 0.2) { n.mode = 'flee'; n.timer = 4; n.fleeSpd = 1.6; n.fx = 0; n.fz = -1; } if (n.awayT > 4) { outdoorPool.detach(n); npcs.splice(i, 1); } }
}
function inviteNPC(n, role) {
  store.invited = store.invited || [];
  if (store.invited.length >= 5) { npcSpeak(n, 'ببخشید، اونجا دیگه جا نیست! پنج نفر دعوت کردی.'); return; }
  store.invited.push({ look: n.look, persona: serPersona(n.persona), role });
  npcSpeak(n, role === 'hide' ? mpick(['آخ جون! منم قایم می‌شم، ببینیم کی زرنگ‌تره!', 'باشه! با هم قایم می‌شیم، فقط بهم نخندی!']) : mpick(['باشه! من چشم می‌ذارم، هر جا قایم بشی پیدات می‌کنم!', 'من دنبالت می‌گردم! از دستم در نمی‌ری!']));
  n.persona.rel = (n.persona.rel || 0) + 1; n.invitedAway = true;
  banner(`${n.persona.name} دعوت رو قبول کرد`, `توی ساختمان رنگین‌کمان ${role === 'hide' ? 'با تو قایم می‌شه' : 'دنبالت می‌گرده'}`); saveGame();
}
function drawZoneMap() {
  const cvm = $('minimap'), g = cvm.getContext('2d'), W = cvm.width, P = player;
  if (P.where === 'test') { g.fillStyle = '#d8ccb0'; g.fillRect(0, 0, W, W); g.fillStyle = '#3a3c40'; g.fillRect(0, W / 2 - 8, W, 16); g.fillStyle = '#14162a'; g.font = 'bold 22px Vazirmatn, Tahoma'; g.textAlign = 'center'; g.fillText(fa(Math.round((P.pos.x + (test ? test.off : 0)) / 10) / 100) + ' کیلومتر', W / 2, W / 2 + 60); }
  else {
    const s = W / 200, ox = P.pos.x, oz = P.pos.z, Wn = rb.win; g.fillStyle = '#2a2440'; g.fillRect(0, 0, W, W);
    g.save(); g.translate(W / 2, W / 2); g.rotate(-Math.PI / 2 - Math.atan2(Math.cos(cam.yaw), Math.sin(cam.yaw)));
    if (Wn) {
      g.fillStyle = '#4a4068'; for (const o of Wn.objs) g.fillRect((o.x - o.hw - ox) * s, (o.z - o.hd - oz) * s, o.hw * 2 * s, o.hd * 2 * s);
      g.fillStyle = '#c8b8ff'; for (const [x, z] of Wn.pillars) g.fillRect((x - ox) * s - 1.5, (z - oz) * s - 1.5, 3, 3);
      for (const k of rb.cores) { g.fillStyle = '#ff9a3a'; g.fillRect((k.x - 7 - ox) * s, (k.z - 15.5 - oz) * s, 14 * s, 31 * s); g.fillStyle = '#ffffff'; g.fillRect((k.x - 4.6 - ox) * s, (k.z + 15 - oz) * s, 2.4 * s, 2); g.fillRect((k.x + 4.3 - ox) * s, (k.z + 15 - oz) * s, 2.2 * s, 2); }
      if (rb.floor === 0) { g.fillStyle = '#7fd8ff'; g.fillRect((-6 - ox) * s, (RB_L / 2 - 2 - oz) * s, 12 * s, 3); }
    }
    if (!rb.game || rb.game.phase === 'over') { g.fillStyle = '#ffcf7a'; for (const n of rb.people) if (n.H.visible) { g.beginPath(); g.arc((n.pos.x - ox) * s, (n.pos.z - oz) * s, 2.4, 0, 7); g.fill(); } }
    g.restore();
    g.fillStyle = 'rgba(10,8,20,.7)'; g.fillRect(W / 2 - 64, W - 40, 128, 30); g.fillStyle = '#ffffff'; g.font = 'bold 19px Vazirmatn, Tahoma'; g.textAlign = 'center'; g.fillText('طبقهٔ ' + fa(rb.floor), W / 2, W - 18);
    g.fillStyle = '#ffb340'; g.beginPath(); g.moveTo(W / 2, W / 2 - 14); g.lineTo(W / 2 + 10, W / 2 + 10); g.lineTo(W / 2 - 10, W / 2 + 10); g.closePath(); g.fill();
  }
}


/* ============================================================
   Sky life over the city: hot-air balloons by day, fireworks at night
   ============================================================ */
const balloons = [];
function buildBalloons() {
  const prof = [[0.01, 0], [1.6, 0.4], [3.6, 1.9], [5.6, 4.6], [6.6, 8], [6.3, 11.2], [4.9, 13.8], [2.6, 15.3], [0.01, 15.8]].map(([r, y]) => new V2(r, y));
  const sets = [['#e8303a', '#ffd23a'], ['#2a6ad8', '#ffffff'], ['#3ab84a', '#ffcf3a', '#e8303a'], ['#a03aff', '#ff8ad8'], ['#ff8a1a', '#2a2a2a'], ['#1fb8c8', '#f4f4f4', '#e8303a']];
  const ropeM = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 }), basketM = new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.95 });
  sets.forEach((cols, i) => {
    const g = new THREE.LatheGeometry(prof, 24).toNonIndexed(), p = g.attributes.position, ca = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let k = 0; k < p.count; k += 3) { const ax = (p.getX(k) + p.getX(k + 1) + p.getX(k + 2)) / 3, az = (p.getZ(k) + p.getZ(k + 1) + p.getZ(k + 2)) / 3; const gore = Math.floor(((Math.atan2(az, ax) / (Math.PI * 2) + 1) % 1) * 12); c.set(cols[gore % cols.length]); for (let q = 0; q < 3; q++) ca.set([c.r, c.g, c.b], (k + q) * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3)); g.computeVertexNormals();
    const grp = new THREE.Group(), env = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }));
    env.castShadow = true; grp.add(env);
    const basket = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.05, 1.5), basketM); basket.position.y = -4.6; grp.add(basket);
    for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 4.6, 4), ropeM); r.position.set(x * 1.05, -2.1, z * 1.05); r.rotation.set(z * 0.09, 0, -x * 0.09); grp.add(r); }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.3, 10), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, toneMapped: false })); flame.position.y = -2.9; grp.add(flame);
    const s = 1 + (i % 3) * 0.12; grp.scale.setScalar(s); scene.add(grp);
    balloons.push({ grp, flame, a: i / sets.length * Math.PI * 2, r: 160 + (i * 53) % 140, y: 95 + (i * 37) % 90, w: (i % 2 ? 1 : -1) * (0.006 + i * 0.0012), seed: i * 1.7, burn: 0 });
  });
}
function updateBalloons(dt) {
  if (!balloons.length) return;
  for (const b of balloons) {
    b.a += b.w * dt; b.burn = Math.max(0, b.burn - dt); if (Math.random() < dt * 0.15) b.burn = 1.2 + Math.random();
    const x = Math.cos(b.a) * b.r, z = Math.sin(b.a) * b.r * 0.8 - 40, y = b.y + Math.sin(simTime * 0.08 + b.seed) * 8 + (b.burn > 0 ? 1.5 : 0);
    b.grp.position.set(x, y, z); b.grp.rotation.set(Math.sin(simTime * 0.4 + b.seed) * 0.03, b.a * 0.3, Math.cos(simTime * 0.33 + b.seed) * 0.03);
    b.flame.visible = b.burn > 0; if (b.burn > 0) { b.flame.scale.set(1, 0.7 + Math.random() * 0.6, 1); }
  }
}
/* fireworks: rockets climb with a spark trail and burst into coloured shells, every night (and on code 1400) */
const fwk = { pts: null, data: [], rockets: [], n: 0, max: LOW ? 900 : 1600, t: 0, show: 0 };
function buildFireworks() {
  const m = fwk.max, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(m * 3), 3)); g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(m), 1));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(m), 1)); g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(m * 3), 3));
  const mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: innerHeight * 0.5 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying float vA; varying vec3 vC; uniform float uScale;
      void main(){ vA = aAlpha; vC = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = max(1.5, aSize * uScale / max(-mv.z, 0.1)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d)*4.0; if(r>1.0) discard; gl_FragColor = vec4(vC * (1.25 - r * 0.6), vA * (1.0 - r * r)); }` });
  fwk.pts = new THREE.Points(g, mat); fwk.pts.frustumCulled = false; fwk.pts.renderOrder = 4; scene.add(fwk.pts);
  for (let i = 0; i < m; i++) fwk.data.push({ life: 0 });
}
function fwEmit(x, y, z, vx, vy, vz, life, size, color, drag) { const p = fwk.data[fwk.n]; fwk.n = (fwk.n + 1) % fwk.max; Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, size, drag }); _col.set(color); p.r = _col.r; p.g = _col.g; p.b = _col.b; }
const FW_SITES = [[-120, -150], [130, -140], [-140, 120], [150, 130], [0, -190], [10, 170]], FW_COLS = ['#ff3a3a', '#ffd23a', '#3aff6a', '#3ab8ff', '#c43aff', '#ff8ad8', '#ffffff', '#ff9a2a'];
function startFireworks(sec) { fwk.show = Math.max(fwk.show, sec); }
function updateFireworks(dt) {
  if (!fwk.pts) return;
  const night = tod >= 20.2 || tod < 1.2, on = player.where === 'out' && (fwk.show > 0 || night); fwk.show = Math.max(0, fwk.show - dt);
  fwk.pts.visible = player.where === 'out';
  if (on) { fwk.t -= dt; if (fwk.t <= 0) { fwk.t = (fwk.show > 0 ? 0.35 : 1.1) + Math.random() * 1.2; const [sx, sz] = FW_SITES[Math.floor(Math.random() * FW_SITES.length)]; fwk.rockets.push({ x: sx + (Math.random() - 0.5) * 20, y: 2, z: sz + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 6, vy: 52 + Math.random() * 22, vz: (Math.random() - 0.5) * 6, fuse: 1.6 + Math.random() * 0.9 }); Audio.burst(0.05 * Audio.vol(sx, sz), 1800, 0.5, 'highpass', 1); } }
  for (let i = fwk.rockets.length - 1; i >= 0; i--) {
    const r = fwk.rockets[i]; r.fuse -= dt; r.vy -= 9.8 * dt; r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt;
    fwEmit(r.x, r.y, r.z, (Math.random() - 0.5) * 2, -2, (Math.random() - 0.5) * 2, 0.6, 1.6, '#ffcf7a', 1.5);
    if (r.fuse <= 0) {
      fwk.rockets.splice(i, 1); const c1 = FW_COLS[Math.floor(Math.random() * FW_COLS.length)], c2 = FW_COLS[Math.floor(Math.random() * FW_COLS.length)], n = LOW ? 70 : 120, sp = 18 + Math.random() * 14, ring = Math.random() < 0.3;
      for (let k = 0; k < n; k++) { let x, y, z; if (ring) { const a = k / n * Math.PI * 2; x = Math.cos(a); y = Math.sin(a) * 0.25; z = Math.sin(a); } else { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, q = Math.sqrt(1 - u * u); x = q * Math.cos(a); y = u; z = q * Math.sin(a); } const s = sp * (0.85 + Math.random() * 0.3); fwEmit(r.x, r.y, r.z, x * s, y * s, z * s, 1.6 + Math.random() * 1.1, 3.6 + Math.random() * 2.2, k % 3 ? c1 : c2, 1.1); }
      const v = Audio.vol(r.x, r.z); setTimeout(() => { Audio.burst(0.5 * v, 110, 1.4, 'lowpass', 1); Audio.burst(0.18 * v, 2600, 0.9, 'highpass', 1); }, Math.min(1500, Math.hypot(r.x - player.pos.x, r.z - player.pos.z) / 0.34));
    }
  }
  const g = fwk.pts.geometry, P = g.attributes.position.array, S = g.attributes.aSize.array, A = g.attributes.aAlpha.array, C = g.attributes.aColor.array; let any = false;
  for (let i = 0; i < fwk.max; i++) {
    const p = fwk.data[i]; if (p.life <= 0) { if (A[i]) { A[i] = 0; S[i] = 0; any = true; } continue; }
    any = true; p.life -= dt; const f = Math.exp(-p.drag * dt); p.vx *= f; p.vy = p.vy * f - 4.5 * dt; p.vz *= f; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const t = Math.max(0, p.life) / p.max; P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z; S[i] = p.size * (0.5 + t * 0.6); A[i] = Math.min(1, t * 1.6) * (0.75 + Math.random() * 0.25); C[i * 3] = p.r; C[i * 3 + 1] = p.g; C[i * 3 + 2] = p.b;
  }
  if (any) { g.attributes.position.needsUpdate = g.attributes.aSize.needsUpdate = g.attributes.aAlpha.needsUpdate = g.attributes.aColor.needsUpdate = true; }
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
  tone(f, t0, dur, gain, type = 'sine') { if (!this.ctx) return; const c = this.ctx, t = c.currentTime + t0, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05); },
  beepPay(n) { for (let k = 0; k < Math.min(n, 6); k++) this.tone(2400, k * 0.18, 0.09, 0.05, 'square'); this.tone(880, n * 0.18 + 0.05, 0.25, 0.06); this.tone(1320, n * 0.18 + 0.2, 0.35, 0.05); },
  alarm(v) { for (let k = 0; k < 6; k++) this.tone(k % 2 ? 1500 : 1900, k * 0.18, 0.16, 0.07 * v, 'square'); },
  cloth() { this.burst(0.05, 2400, 0.18, 'bandpass', 0.8); },
  shutter() { this.burst(0.12, 3000, 0.04, 'bandpass', 3); this.burst(0.08, 1800, 0.06, 'bandpass', 3); },
  slide() { this.burst(0.05, 600, 0.6, 'lowpass', 1); this.tone(1046, 0, 0.4, 0.015); },
  arcade() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, k) => this.tone(f, k * 0.12, 0.1, 0.04, 'square')); },
  roll(sp) { if (!this.ctx) return; if (!this.rollG) { const c = this.ctx, s = c.createBufferSource(); s.buffer = this.brown; s.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300; this.rollG = c.createGain(); this.rollG.gain.value = 0; s.connect(f); f.connect(this.rollG); this.rollG.connect(this.master); s.start(); } this.rollG.gain.setTargetAtTime(clamp(sp / 9, 0, 1) * 0.25, this.ctx.currentTime, 0.1); },
  music(on) {
    clearInterval(this.musT); if (!on || !this.ctx) return;
    const scale = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3], bass = [130.8, 98, 110, 87.3]; let step = 0;
    this.musT = setInterval(() => { if (!this.on) return; const b = bass[Math.floor(step / 8) % 4]; if (step % 4 === 0) this.tone(b, 0, 0.5, 0.03, 'triangle'); this.tone(scale[(step * 3 + Math.floor(step / 8)) % scale.length] * (step % 8 === 7 ? 2 : 1), 0, 0.22, 0.018, 'sine'); if (step % 2) this.tone(6000, 0, 0.03, 0.004, 'square'); step++; }, 210);
  },
  clank(x, z) { const v = this.vol(x, z); this.burst(0.18 * v, 2600 + Math.random() * 1500, 0.09, 'bandpass', 9); this.burst(0.08 * v, 5200, 0.05, 'bandpass', 12); },
  drill(x, z) { if (!this.ctx) return; const v = this.vol(x, z) * 0.05; if (v < 0.003) return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(320, t); o.frequency.linearRampToValueAtTime(480, t + 0.3); o.frequency.setValueAtTime(470, t + 0.9); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.05); g.gain.setValueAtTime(v, t + 0.9); g.gain.linearRampToValueAtTime(0, t + 1.1); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; o.connect(f); f.connect(g); g.connect(this.master); o.start(t); o.stop(t + 1.15); },
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
  if (!e.repeat && e.code === 'KeyG') input.ejectQ = true;
  if (!e.repeat && e.code === 'KeyV') toggleView();
  if (!e.repeat && e.code === 'KeyX' && player && player.where === 'rb') toggleTurbo();
  if (!e.repeat && e.code === 'KeyI') toggleBag();
  if (e.code === 'Escape' && !$('bag').hidden) toggleBag(false);
  if (!e.repeat && e.code === 'KeyQ') input.useQ = true;
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
function readKeys(dt = 1 / 60) {
  const k = c => keys.has(c);
  const kx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
  const ky = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
  if (player && (player.state === 'car' || player.state === 'fly')) {
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
  const mode = chat.open ? 'chat' : player && player.state === 'fly' ? 'fly' : player && rb.build ? 'build' : player && (player.state === 'car' || player.state === 'entering') ? 'car' : player && player.state === 'passenger' ? (player.car && player.car.service ? 'bus' : 'pass') : 'foot';
  if (mode === lastUiMode && !force) return; lastUiMode = mode;
  $('pad').hidden = mode !== 'foot'; $('joy-hint').hidden = mode !== 'foot'; updateUseBtn(); if (mode !== 'foot') { $('joy').hidden = true; joyId = null; input.jx = input.jy = 0; }
  for (const id of ['drive-l', 'drive-r']) $(id).hidden = mode !== 'car' && mode !== 'fly';
  $('fly-ud').hidden = mode !== 'fly'; if (mode === 'build') { $('pad').hidden = true; $('joy-hint').hidden = true; }
  $('drive-x').hidden = mode !== 'car' && mode !== 'pass' && mode !== 'bus' && mode !== 'fly'; $('b-hand').hidden = $('b-horn').hidden = mode !== 'car'; $('b-eject').hidden = mode !== 'pass'; $('b-horn').hidden = $('b-hand').hidden = mode !== 'car';
  if (mode !== 'car') { input.cGas = input.cBrake = input.cLeft = input.cRight = false; input.hornBtn = input.handBtn = false; for (const b of document.querySelectorAll('.dbtn')) b.classList.remove('down'); }
}
cv.addEventListener('pointerdown', e => {
  if (!started) return; Audio.init();
  if (typing()) document.activeElement.blur();
  if (rb.build) { bdPointerDown(e); try { cv.setPointerCapture(e.pointerId); } catch (_) { } return; }
  if (e.pointerType !== 'mouse') {
    showTouchUI();
    const foot = player.state === 'foot' && !chat.open;
    if (foot && e.clientX < innerWidth * 0.45 && joyId === null) { joyId = e.pointerId; joyX = e.clientX; joyY = e.clientY; const j = $('joy'); j.style.left = joyX + 'px'; j.style.top = joyY + 'px'; j.hidden = false; $('joy-hint').hidden = true; $('joy-knob').style.transform = ''; }
    else if (lookId === null) { lookId = e.pointerId; lookX = e.clientX; lookY = e.clientY; }
  } else { lookId = e.pointerId; lookX = e.clientX; lookY = e.clientY; }
  try { cv.setPointerCapture(e.pointerId); } catch (_) { }
});
cv.addEventListener('pointermove', e => {
  if (rb.build) { bdPointerMove(e); return; }
  if (e.pointerId === joyId) {
    let dx = e.clientX - joyX, dy = e.clientY - joyY; const l = Math.hypot(dx, dy); if (l > JR) { dx *= JR / l; dy *= JR / l; }
    input.jx = dx / JR; input.jy = -dy / JR; $('joy-knob').style.transform = `translate(${dx}px,${dy}px)`;
  } else if (e.pointerId === lookId) {
    const s = e.pointerType === 'mouse' ? 0.0042 : 0.0062, P_ = player, ddx = e.clientX - lookX, ddy = e.clientY - lookY;
    const hideIn = P_.state === 'hide' && P_.hideSpot && P_.hideSpot.kind === 'in', vehFP = (cam.fpOn && (P_.state === 'car' || P_.state === 'passenger')) || (P_.state === 'fly' && cam.fp);
    if (hideIn) { cam.hideYaw = angWrap((cam.hideYaw ?? P_.hideSpot.face) - ddx * s); cam.hidePitch = clamp((cam.hidePitch ?? 0) + ddy * s, -1.35, 1.35); }
    else if (vehFP) { cam.fpYaw = angWrap(cam.fpYaw - ddx * s); cam.fpPitch = clamp(cam.fpPitch + ddy * s, -1.3, 1.35); }
    else if (cam.fpOn) { cam.yaw -= ddx * s; cam.fpPitch = clamp(cam.fpPitch + ddy * s, -1.3, 1.35); }
    else { cam.yaw -= (e.clientX - lookX) * s; cam.pitch = clamp(cam.pitch + (e.clientY - lookY) * s, -0.3, 1.25); }
    cam.lastLook = simTime;
    lookX = e.clientX; lookY = e.clientY;
  }
});
const endPtr = e => {
  if (rb.build) { bdPointerUp(e); }
  if (e.pointerId === joyId) { joyId = null; input.jx = input.jy = 0; $('joy').hidden = true; if (player.state === 'foot' && !chat.open) $('joy-hint').hidden = false; }
  if (e.pointerId === lookId) lookId = null;
};
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('wheel', e => { if (rb.build && cam.free) { dolly(-e.deltaY * 0.02); e.preventDefault(); return; } cam.zoom = clamp(cam.zoom * (1 + e.deltaY * 0.001), 0.55, 1.9); e.preventDefault(); }, { passive: false });
cv.addEventListener('contextmenu', e => e.preventDefault());
// no browser menus on long press anywhere (copy, search, print, save image...), except in text boxes
{ const editable = t => t && t.closest && t.closest('input,textarea,select,[contenteditable]');
  for (const ev of ['contextmenu', 'selectstart', 'dragstart']) document.addEventListener(ev, e => { if (!editable(e.target)) e.preventDefault(); }, { capture: true });
  document.addEventListener('selectionchange', () => { if (editable(document.activeElement)) return; const sel = getSelection(); if (sel && sel.rangeCount && !sel.isCollapsed) sel.removeAllRanges(); }); }
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
holdBtn('b-eject', () => { input.ejectQ = true; });
holdBtn('b-use', () => { input.useQ = true; });
$('btn-view').addEventListener('click', () => toggleView());
$('btn-bag').addEventListener('click', () => toggleBag());
$('bag-close').addEventListener('click', () => toggleBag(false));
$('bag-cap').addEventListener('click', () => { store.capOff = !store.capOff; rebuildPlayerLook(); renderBag(); saveGame(); });
for (const ev of ['pointerdown', 'touchstart']) $('bag').addEventListener(ev, e => e.stopPropagation(), { passive: true });
$('btn-garage').addEventListener('click', () => { $('garage-menu').hidden = false; $('gm-status').textContent = garageStatus(); $('gm-msg').textContent = ''; });
$('gm-close').addEventListener('click', () => { $('garage-menu').hidden = true; });
$('gm-route').addEventListener('click', () => { $('gm-msg').textContent = goGarage('route'); });
$('gm-go').addEventListener('click', () => { const m = goGarage('go'); if (m) $('gm-msg').textContent = m; else $('garage-menu').hidden = true; });
$('gm-tow').addEventListener('click', () => { $('gm-msg').textContent = callTow(); });
for (const ev of ['pointerdown', 'touchstart']) $('garage-menu').addEventListener(ev, e => e.stopPropagation(), { passive: true });
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
/* ---------- buttons and panels for the rainbow building, build mode, flying car and codes ---------- */
$('btn-rb').addEventListener('click', () => { if (player.where === 'rb') { leaveRB(); return; } $('rb-go').hidden = false; });
$('rbg-route').addEventListener('click', () => { $('rb-go').hidden = true; setWaypoint({ name: 'ساختمان رنگین‌کمان', x: rb.door.x, z: rb.door.z + 4 }); toast('فلش نارنجیِ بالای سرت و خط روی نقشه راه رو نشون می‌دن'); });
$('rbg-go').addEventListener('click', () => {
  $('rb-go').hidden = true; const P = player;
  if (P.where === 'in') { toast('اول از ساختمان بیرون بیا'); return; } if (P.where === 'test') leaveTest();
  if (P.state === 'fly') leaveFlyerForce(); if (P.state === 'passenger') { if (P.car === bus) leaveBus(); else leaveTow(); }
  if (P.state === 'car') { const c = P.car; c.x = rb.door.x + 6; c.z = rb.door.z + 12; c.h = Math.PI; c.vx = c.vz = 0; c.sync(0); }
  else { P.state = 'foot'; P.pos.set(rb.door.x, CURB, rb.door.z + 6); P.vel.set(0, 0, 0); P.facing = Math.PI; }
  cam.yaw = Math.PI; cam.target.set(P.pos.x, P.pos.y + 1.45, P.pos.z); banner('جلوی ساختمان رنگین‌کمان', 'برو داخل در بزرگ');
});
$('rbg-close').addEventListener('click', () => { $('rb-go').hidden = true; });
function leaveFlyerForce() { const P = player, F = fly.obj; if (!F) return; F.v = 0; F.y = (F.where === 'out' ? groundH(F.x, F.z) : 0) + 0.8; P.state = 'foot'; P.inCar = null; P.anim.special = null; }
// hide and seek
$('rb-start').addEventListener('click', () => { $('rb-setup').hidden = false; $('rbs-level').textContent = fa(rbSettings().level); });
document.querySelectorAll('#rb-setup [data-min]').forEach(b => b.addEventListener('click', () => { const v = b.dataset.min === 'c' ? Math.max(1, Math.min(600, parseInt(String($('rbs-custom').value).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)), 10) || 5)) : +b.dataset.min; rbStartGame(v); }));
$('rbs-close').addEventListener('click', () => { $('rb-setup').hidden = true; });
$('rb-stop').addEventListener('click', () => { rbEndGame(); toast('بازی تموم شد'); });
$('rbm-next').addEventListener('click', () => rbNextLevel(false));
$('rbm-again').addEventListener('click', () => rbNextLevel(true));
$('rbm-exit').addEventListener('click', () => { $('rb-menu').hidden = true; leaveRB(); });
$('rbm-stay').addEventListener('click', () => { $('rb-menu').hidden = true; rbEndGame(); });
// rainbow colours
function renderColors() {
  const s = rbSettings(), w = $('rbc-presets'); w.textContent = '';
  for (const [k, p] of Object.entries(RB_PALETTES)) { const b = document.createElement('button'); b.type = 'button'; b.className = 'rbc-pre' + (s.pal === k ? ' on' : ''); b.style.background = `linear-gradient(90deg,${p.c.join(',')})`; b.textContent = p.n; b.addEventListener('click', () => { s.pal = k; s.custom = p.c.slice(); applyRbPalette(); renderColors(); saveSoon(); }); w.appendChild(b); }
  const cw = $('rbc-custom'); cw.textContent = '';
  s.custom.forEach((c, i) => { const inp = document.createElement('input'); inp.type = 'color'; inp.value = c; inp.addEventListener('input', () => { s.custom[i] = inp.value; s.pal = 'custom'; applyRbPalette(); saveSoon(); }); cw.appendChild(inp); });
  document.querySelectorAll('#rb-colors [data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === s.speed));
}
$('rb-colors-btn').addEventListener('click', () => { $('rb-colors').hidden = false; renderColors(); });
document.querySelectorAll('#rb-colors [data-speed]').forEach(b => b.addEventListener('click', () => { rbSettings().speed = +b.dataset.speed; applyRbPalette(); renderColors(); saveSoon(); }));
$('rbc-add').addEventListener('click', () => { const s = rbSettings(); if (s.custom.length < 8) { s.custom.push('#ffffff'); s.pal = 'custom'; applyRbPalette(); renderColors(); } });
$('rbc-del').addEventListener('click', () => { const s = rbSettings(); if (s.custom.length > 2) { s.custom.pop(); s.pal = 'custom'; applyRbPalette(); renderColors(); } });
$('rbc-close').addEventListener('click', () => { $('rb-colors').hidden = true; saveGame(); });
// build mode
$('rb-build').addEventListener('click', () => { if (rb.build) endBuild(); else startBuild(); });
$('bd-exit').addEventListener('click', () => endBuild());
$('bd-search').addEventListener('input', () => renderPalette());
$('bd-toggle').addEventListener('click', () => { $('bd-pal').classList.toggle('closed'); });
document.querySelectorAll('#bd-obj [data-a]').forEach(b => { let t = null; const go = () => bdAct(b.dataset.a); b.addEventListener('pointerdown', e => { e.preventDefault(); go(); if (['left', 'right', 'fwd', 'back', 'up', 'down', 'rotL', 'rotR', 'big', 'small'].includes(b.dataset.a)) t = setInterval(go, 120); }); const stop = () => { clearInterval(t); t = null; }; b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop); });
for (const k of ['sx', 'sy', 'sz']) $('bd-' + k).addEventListener('input', e => bdSlider(k, +e.target.value));
document.querySelectorAll('#bd-cam [data-c]').forEach(b => { const k = b.dataset.c; b.addEventListener('pointerdown', e => { e.preventDefault(); bdHold[k] = true; }); const up = () => { bdHold[k] = false; }; b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up); });
$('bd-camreset').addEventListener('click', () => { const P = player; cam.free = { x: P.pos.x, y: 9, z: P.pos.z + 14, yaw: Math.PI, pitch: 0.42 }; });
for (const id of ['bd-ui', 'rb-go', 'rb-setup', 'rb-menu', 'rb-colors', 'fly-panel', 'code-panel', 'rb-hud']) for (const ev of ['pointerdown', 'touchstart', 'wheel']) $(id).addEventListener(ev, e => e.stopPropagation(), { passive: true });
// flying car
$('btn-fly').addEventListener('click', () => openFlyPanel());
$('fly-val').addEventListener('input', () => { const v = parseFloat(String($('fly-val').value).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))); if (v > 0) { flySet().val = v; syncFlyRange(); updateFlyInfo(); } });
$('fly-unit').addEventListener('change', () => { const f = flySet(), ms = flyMs(); f.unit = $('fly-unit').value; f.val = +(ms / FLY_UNITS[f.unit][1]).toPrecision(4); $('fly-val').value = f.val; updateFlyInfo(); });
$('fly-range').addEventListener('input', () => { const ms = Math.pow(60000, +$('fly-range').value / 1000), f = flySet(); f.val = +(ms / FLY_UNITS[f.unit][1]).toPrecision(3); $('fly-val').value = f.val; updateFlyInfo(); });
$('fly-spawn').addEventListener('click', () => { closeFlyPanel(); if (player.state === 'fly') { toast('سرعت ماشین پرنده تنظیم شد'); return; } spawnFlyer(); saveGame(); });
$('fly-close').addEventListener('click', () => { closeFlyPanel(); saveGame(); });
holdBtn('f-up', () => { input.fUp = true; }, () => { input.fUp = false; });
$('b-turbo').addEventListener('click', () => toggleTurbo());
const liftNum = () => parseInt(String($('lift-in').value).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[^0-9]/g, ''), 10);
document.querySelectorAll('#lift-panel [data-df]').forEach(b => b.addEventListener('click', () => { const v = isFinite(liftNum()) ? liftNum() : rb.floor; $('lift-in').value = clamp(v + (+b.dataset.df), 0, RB_FLOORS - 1); }));
document.querySelectorAll('#lift-panel [data-fl]').forEach(b => b.addEventListener('click', () => { const f = b.dataset.fl; rbLiftGo(f === 'max' ? RB_FLOORS - 1 : f === 'rand' ? Math.floor(Math.random() * RB_FLOORS) : +f); }));
$('lift-form').addEventListener('submit', e => { e.preventDefault(); $('lift-in').blur(); const v = liftNum(); if (isFinite(v)) rbLiftGo(v); else toast('شمارهٔ طبقه رو بنویس'); });
$('lift-close').addEventListener('click', () => { $('lift-panel').hidden = true; });
for (const ev of ['pointerdown', 'touchstart', 'wheel']) $('lift-panel').addEventListener(ev, e => e.stopPropagation(), { passive: true });
holdBtn('f-down', () => { input.fDown = true; }, () => { input.fDown = false; });
// secret codes
$('btn-code').addEventListener('click', () => { $('code-panel').hidden = false; $('code-in').value = ''; setTimeout(() => $('code-in').focus(), 50); });
$('code-form').addEventListener('submit', e => { e.preventDefault(); $('code-panel').hidden = true; $('code-in').blur(); runCode($('code-in').value); });
$('code-close').addEventListener('click', () => { $('code-panel').hidden = true; });
let codeBuf = '';
addEventListener('keydown', e => { if (!started || typing()) return; const d = e.key && /^[0-9۰-۹]$/.test(e.key) ? e.key : null; if (!d) return; codeBuf = (codeBuf + d).slice(-4); if (/^(1818|1717|1400|۱۸۱۸|۱۷۱۷|۱۴۰۰)$/.test(codeBuf)) { runCode(codeBuf); codeBuf = ''; } });

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
$('newgame').addEventListener('click', () => {
  const b = $('newgame'); if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'مطمئنی؟ دوباره بزن تا همه چیز از اول شروع شود'; return; }
  try { localStorage.removeItem(SAVE_KEY); } catch (_) { } location.reload();
});
$('set-export').addEventListener('click', () => downloadSave());
$('set-import').addEventListener('click', () => $('set-file').click());
$('set-file').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return; const r = new FileReader();
  r.onload = () => { try { const o = JSON.parse(r.result); if (!o || o.v !== 1) throw 0; localStorage.setItem(SAVE_KEY, JSON.stringify(o)); location.reload(); } catch (_) { $('set-msg').textContent = 'این فایل ذخیرهٔ شهر آزاد نیست.'; } };
  r.readAsText(f);
});
$('set-wipe').addEventListener('click', () => {
  const b = $('set-wipe'); if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'مطمئنی؟ دوباره بزن'; return; }
  try { localStorage.removeItem(SAVE_KEY); } catch (_) { } started = false; location.reload();
});

/* ============================================================
   Player, cars, camera
   ============================================================ */
let simTime = 0, started = false;
const cars = [];
const playerLook = { skin: '#e0ac83', hair: '#2a1b12', shirt: '#e07a2e', pants: '#2a3a55', shoes: '#f2f2f2', style: 'short', cap: '#1f2a3a', sleeves: true, h: 1 };
let player;
const cam = { yaw: Math.PI, pitch: 0.32, dist: 4.6, cur: 4.6, zoom: 1, target: new V3(), shake: 0, lastLook: -9, fov: 60, fp: false, fpYaw: 0, fpPitch: 0.08, fpY: 0, fpOn: false };
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
    const p = ringPoint(rg, Math.random() * RING * 8, 0);
    if (Math.random() < 0.16) { // children
      const look = Object.assign(randomLook(), { h: 0.6 + Math.random() * 0.13, kid: true, coat: null, beard: false, glasses: false, umbrella: false, build: 0.9 });
      const n = spawnNPC(p.x, p.z, look); const pp = n.persona; pp.age = 8 + Math.floor(Math.random() * 5); pp.job = 'دانش‌آموز'; pp.jobLine = `کلاس ${fa(pp.age - 6)}م هستم! امروز مدرسه زود تعطیل شد.`; pp.married = false; pp.kids = 0; n.spd *= 1.2; n.radius = 0.24;
    } else spawnNPC(p.x, p.z);
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
    if (d.dead) continue;
    const dx = player.pos.x - d.x, dz = player.pos.z - d.z, dn = dx * d.nx + dz * d.nz, lat = Math.abs(dx * -d.nz + dz * d.nx);
    if (dn < -0.2 || lat > 0.9 || Math.abs(player.pos.y - d.y) > 1.2) continue; const dd = Math.hypot(dx, dz); if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}
const _allP = []; function allPeople() { _allP.length = 0; for (const n of npcs) _allP.push(n); for (const n of mall.npcs) _allP.push(n); for (const n of mall.staff) _allP.push(n); return _allP; }
function nearestUse() {
  const P = player; let best = null, bd = 9;
  for (const u of world.uses) { if (Math.abs(P.pos.y - u.y) > 1.2) continue; const d = Math.hypot(u.x - P.pos.x, u.z - P.pos.z); if (d < u.r && d + (u.pri ? -0.6 : 0) < bd) { bd = d; best = u; } }
  return best ? { u: best, d: bd, pri: best.pri && bd < best.r } : null;
}
function nearestSeat() {
  const P = player; let best = null, bd = 0.95;
  for (const s of (world.allSeats || (world.allSeats = mall.seats.concat(world.benches)))) { if (s.taken || Math.abs(P.pos.y - s.y) > 0.8) continue; const d = Math.hypot(s.x + Math.sin(s.ry) * 0.5 - P.pos.x, s.z + Math.cos(s.ry) * 0.5 - P.pos.z); if (d < bd) { bd = d; best = s; } }
  return best ? { s: best, d: bd } : null;
}
function nearestNPC(list, maxD) { let best = null, bd = maxD; for (const n of list) { if (n.mode === 'down') continue; const d = Math.hypot(n.pos.x - player.pos.x, n.pos.z - player.pos.z); if (d < bd) { bd = d; best = n; } } return best; }

function placeInside(door) {
  buildInterior(door);
  player.where = 'in'; interiorPool.attach(player);
  player.pos.set(0, 0, interior.D / 2 - 2.3); player.vel.set(0, 0, 0); player.facing = Math.PI; player.standCar = null;
  cam.yaw = Math.PI; cam.pitch = 0.42; cam.cur = 2.0; cam.target.set(0, 1.45, interior.D / 2 - 2.3);
}
function enterBuilding(door) {
  if (fading) return;
  fadeTo(() => { placeInside(door); banner(door.name, door.sub || ''); saveGame(); });
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
    saveGame();
  });
  Audio.door();
}
/* walk straight through an open door: the house is swapped in under your feet, camera and pace unchanged */
function doorRot(d) { return Math.PI - Math.atan2(-d.nx, -d.nz); }
function rotXZ(x, z, a) { const c = Math.cos(a), s = Math.sin(a); return [x * c + z * s, -x * s + z * c]; }
function enterThrough(door) {
  const P = player, a = doorRot(door);
  const [lx] = rotXZ(P.pos.x - door.x, P.pos.z - door.z, a), [vx, vz] = rotXZ(P.vel.x, P.vel.z, a), [tx, tz] = rotXZ(cam.target.x - door.x, cam.target.z - door.z, a);
  buildInterior(door);
  P.where = 'in'; interiorPool.attach(P); P.standCar = null; P.onGround = true;
  P.pos.set(clamp(lx, -0.35, 0.35), 0, interior.D / 2 - 0.45); P.vel.set(vx, 0, vz); P.facing += a;
  cam.yaw += a; cam.target.set(clamp(tx, -0.6, 0.6), 1.45, interior.D / 2 + Math.min(tz, 0) - 0.3); cam.cur = Math.min(cam.cur, 2.2);
  const ed = interior.exitDoor; ed.open = ed.want = 1; ed.closeT = 0; ed.pv.rotation.y = 1.4;
  door.want = 0; door.open = 0; door.inner.rotation.y = 0;
  Audio.door(); banner(door.name, door.sub || ''); saveGame();
}
function exitThrough() {
  const P = player, d = interior.door, a = -doorRot(d);
  if (cartBlocksExit()) return;
  const [ox, oz] = rotXZ(clamp(P.pos.x, -0.35, 0.35), 0.62, a), [vx, vz] = rotXZ(P.vel.x, P.vel.z, a);
  P.where = 'out'; outdoorPool.attach(P);
  const x = d.x + ox, z = d.z + oz;
  P.pos.set(x, groundH(x, z), z); if (d.kind === 'house') P.pos.y = Math.max(P.pos.y, d.y - 0.01);
  P.vel.set(vx, 0, vz); P.facing += a; cam.yaw += a; cam.target.set(P.pos.x, P.pos.y + 1.45, P.pos.z); cam.cur = Math.min(cam.cur, 2.2);
  d.want = 1; d.open = 1; d.closeT = 0; d.inner.rotation.y = -1.4;
  for (const n of interior.npcs) interiorPool.detach(n); interior.npcs = [];
  Audio.door(); saveGame();
}
let fading = false, resumeRB = false;
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
  player.state = 'entering'; player.car = car; player.lastCar = car; player.enterT = 0; car.doorT = 1; car.inHand = true; Audio.door();
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
  if (spot && spot[2] === 0) { player.state = 'exiting'; player.exitT = 0; player.exitTo = spot; car.doorT = 1; Audio.door(); return; }
  if (!spot) { spot = [car.x, car.z]; player.pos.y = car.y + car.T.roofY + 0.1; } else player.pos.y = groundH(spot[0], spot[1]);
  player.pos.x = spot[0]; player.pos.z = spot[1]; player.vel.set(car.vx * 0.5, 0, car.vz * 0.5); player.facing = car.h + Math.PI / 2;
  player.anim.special = null; player.state = 'foot'; player.car = null;
  if (cam.fpOn) cam.yaw = car.h + cam.fpYaw;
}
function addCarLights(car) { }
const headLights = [];
function initFixedLights() {
  for (const sx of [-0.55, 0.55]) { const s = new THREE.SpotLight(0xfff1d6, 0, 70, 0.45, 0.5, 1.5); s.target = new THREE.Object3D(); s.userData.sx = sx; scene.add(s, s.target); headLights.push(s); }
  flashLight = new THREE.SpotLight(0xfff4d8, 0, 32, 0.42, 0.45, 1.4); flashLight.target = new THREE.Object3D(); scene.add(flashLight, flashLight.target);
  flashIn = new THREE.SpotLight(0xfff4d8, 0, 20, 0.42, 0.45, 1.4); flashIn.target = new THREE.Object3D(); flashIn.userData.keep = flashIn.target.userData.keep = true; interiorScene.add(flashIn, flashIn.target);
}
function updateHeadLights() {
  const P = player, car = (P.state === 'car' || P.state === 'exiting') && P.car && P.where === 'out' ? P.car : null, on = car && (night > 0.3 || weather.rain > 0.5) && P.state === 'car';
  for (const s of headLights) {
    if (!on) { s.intensity = 0; continue; }
    car.body.updateMatrixWorld(true); s.intensity = 90;
    s.position.set(s.userData.sx, car.T.headY, car.T.front).applyMatrix4(car.body.matrixWorld); s.target.position.set(s.userData.sx * 1.5, 0, car.T.front + 18).applyMatrix4(car.body.matrixWorld); s.target.updateMatrixWorld();
  }
}

/* ---------- conversation with people ---------- */
const chat = { open: false, npc: null, busy: false };
const settings = { quality: 'auto', voice: false, aiKey: '', weather: 'auto' };
try { Object.assign(settings, JSON.parse(localStorage.getItem('shahr-settings') || '{}')); } catch (_) { }
function saveSettings() { try { localStorage.setItem('shahr-settings', JSON.stringify(settings)); } catch (_) { } }
const store = { residents: {}, homes: {}, stats: { repairs: 0, tows: 0, sleeps: 0 }, money: 100000000, inv: {}, worn: {}, held: null, energy: 100, cart: [], capOff: false };
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
    if (d.kind !== 'shop' || d.dead) continue;
    const keys = d.name.split(/\s+/).filter(w => w.length > 2).map(w => norm(w));
    for (const [k, syn] of SYN) if (d.name.includes(k)) keys.push(...syn.split(' '));
    out.push({ name: d.name, keys, x: d.x, z: d.z, dist: Math.hypot(d.x - player.pos.x, d.z - player.pos.z) });
  }
  out.push({ name: 'تعمیرگاه مرکزی شهر', keys: ['تعمیرگاه', 'مکانیک', 'تعمیر', 'یدک', 'جرثقیل', 'صافکاری'], x: roadX(1) - RH - 2, z: 0, dist: Math.hypot(roadX(1) - RH - 2 - player.pos.x, player.pos.z) });
  out.push({ name: 'پاساژ آزادی (مرکز خرید)', keys: ['پاساژ', 'مرکز خرید', 'مال', 'خرید', 'فروشگاه', 'هایپر', 'فودکورت', 'لباس', 'کفش', 'موبایل', 'گوشی'], x: mall.x0 - 3, z: 0, dist: Math.hypot(mall.x0 - 3 - player.pos.x, player.pos.z) });
  for (const S of mall.shops) out.push({ name: `${S.name} (پاساژ آزادی، ${S.floor ? 'طبقهٔ اول' : 'همکف'})`, keys: S.name.split(/\s+/).filter(w => w.length > 2).map(w => norm(w)), x: mall.x0 - 3, z: 0, dist: Math.hypot(mall.x0 - 3 - player.pos.x, player.pos.z) + 1 });
  if (gas.cx) out.push({ name: 'جایگاه سوخت (پمپ بنزین)', keys: ['پمپ', 'بنزین', 'سوخت', 'جایگاه', 'گازوئیل'], x: gas.cx - LOT + 2, z: gas.cz, dist: Math.hypot(gas.cx - LOT - player.pos.x, gas.cz - player.pos.z) });
  { let bs = null, bd = 1e9; for (const s of world.busStops || []) { const d = Math.hypot(s.x - player.pos.x, s.z - player.pos.z); if (d < bd) { bd = d; bs = s; } } if (bs) out.push({ name: 'ایستگاه اتوبوس خط ۱', keys: ['اتوبوس', 'ایستگاه', 'خط'], x: bs.x, z: bs.z, dist: bd }); }
  for (const l of world.landmarks || []) out.push({ name: l.name, keys: l.keys, x: l.x, z: l.z, dist: Math.hypot(l.x - player.pos.x, l.z - player.pos.z) });
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
  return { hour: tod, timeStr: fa(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0')), weather: weather.state, place: player.where === 'in' ? interior.door.name : player.where === 'rb' ? 'ساختمان رنگین‌کمان' : player.where === 'test' ? 'محیط آزمایشی' : streetAt(player.pos.x, player.pos.z),
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
  if (store.held && ITEMS[store.held].model === 'flowers') { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip-q'; b.style.background = 'rgba(200,32,42,.5)'; b.textContent = 'این گل برای توئه'; b.addEventListener('click', () => { addMsg('me', 'این گل برای توئه!'); giveFlowers(n); b.remove(); }); chips.appendChild(b); }
  if (player.where === 'out' && n.npc && !n.mallStaff && !n.mech && !n.medic && !n.invitedAway && !(store.invited || []).some(v => v.persona.name === n.persona.name && v.persona.family === n.persona.family)) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip-q'; b.style.background = 'linear-gradient(90deg,#ff2a2a88,#ffe02a88,#3ad83a88,#2a9aff88,#a03aff88)'; b.textContent = 'بیا بریم قایم‌موشک!';
    b.addEventListener('click', () => { addMsg('me', 'بیا بریم ساختمان رنگین‌کمان قایم‌موشک بازی کنیم!'); npcSpeak(n, mpick(['قایم‌موشک؟ عاشقشم! من قایم بشم یا چشم بذارم؟', 'آره بریم! نقش من چیه؟'])); b.remove();
      for (const [lbl, role] of [['با من قایم شو', 'hide'], ['تو دنبال من بگرد', 'seek']]) { const c = document.createElement('button'); c.type = 'button'; c.className = 'chip-q'; c.style.background = 'rgba(160,58,255,.45)'; c.textContent = lbl; c.addEventListener('click', () => { addMsg('me', lbl); inviteNPC(n, role); for (const x of chips.querySelectorAll('.inv')) x.remove(); }); c.classList.add('inv'); chips.prepend(c); } });
    chips.prepend(b);
  }
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
/* ---------- save system: everything you do is kept on this device ---------- */
const SAVE_KEY = 'shahr-azad-save-v1';
let lastSave = 0, restored = false;
const serPersona = p => ({ ...p, mem: { ...p.mem, used: [...(p.mem.used || [])] }, hist: (p.hist || []).slice(-10) });
const deserPersona = o => { o.mem = o.mem || {}; o.mem.used = new Set(o.mem.used || []); o.mem.facts = o.mem.facts || {}; o.hist = o.hist || []; return o; };
function snapshot() {
  const P = player, list = cars.filter(c => !c.isTow && !c.service);
  const r2 = v => Math.round(v * 100) / 100;
  return {
    v: 1, time: Date.now(), tod, weather: settings.weather, events, waypoint,
    stats: store.stats, homes: store.homes,
    residents: Object.fromEntries(Object.entries(store.residents).map(([k, r]) => [k, { look: r.look, persona: serPersona(r.persona) }])),
    player: P.where === 'rb' || P.where === 'test' ? { x: r2((P.where === 'rb' ? P.rbFrom : P.testFrom)?.x ?? -3), y: CURB, z: r2((P.where === 'rb' ? P.rbFrom : P.testFrom)?.z ?? roadX(2) + RH + 2.2), facing: 0, where: P.where === 'rb' ? 'rb' : 'out', door: -1, car: -1, lastCar: list.indexOf(P.lastCar) } : { x: r2(P.pos.x), y: r2(P.pos.y), z: r2(P.pos.z), facing: r2(P.facing), where: P.where, door: P.where === 'in' ? interior.key : -1, car: P.state === 'car' ? list.indexOf(P.car) : -1, lastCar: list.indexOf(P.lastCar) },
    ext: { invited: store.invited || [], rbSet: store.rbSet, rbPlaced: store.rbPlaced || [], rbCam: store.rbCam, fly: store.fly, rbVer: store.rbVer || 3, rbPos: P.where === 'rb' ? { f: rb.floor, x: r2(P.pos.x), y: r2(Math.max(0, P.pos.y)), z: r2(P.pos.z) } : null },
    shop: { money: store.money, inv: store.inv, worn: store.worn, held: store.held, energy: Math.round(store.energy), cart: store.cart, capOff: store.capOff },
    cars: list.map(c => ({ type: c.type, color: c.paint.color.getHex(), taxi: c.taxi, x: r2(c.x), z: r2(c.z), h: r2(c.h), health: Math.round(c.health), fuel: Math.round(c.fuel), dents: c.dentLog || [], ai: !!c.ai,
      driver: c.driverP && !c.driverP.isPlayer ? { look: c.driverP.look, persona: serPersona(c.driverP.persona) } : null })),
    npcs: npcs.filter(n => !n.mech && !n.school).map(n => ({ look: n.look, persona: serPersona(n.persona), x: r2(n.pos.x), z: r2(n.pos.z) }))
  };
}
function saveGame() {
  if (!started || !player) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot())); lastSave = simTime; const el = $('saved'); el.hidden = false; el.style.opacity = '1'; clearTimeout(saveGame.t); saveGame.t = setTimeout(() => { el.style.opacity = '0'; }, 1400); } catch (e) { }
}
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return s && s.v === 1 ? s : null; } catch (_) { return null; } }
function restoreFromSave(sv) {
  tod = sv.tod ?? tod; if (sv.weather) settings.weather = sv.weather;
  if (sv.shop) Object.assign(store, sv.shop);
  if (sv.ext) { if (!sv.ext.rbVer) store.rbVer = 1; for (const k of ['invited', 'rbSet', 'rbPlaced', 'rbCam', 'fly', 'rbVer', 'rbPos']) if (sv.ext[k] !== undefined && sv.ext[k] !== null) store[k] = sv.ext[k]; }
  if (sv.player && sv.player.where === 'rb') resumeRB = true;
  events.push(...(sv.events || []).slice(-10)); Object.assign(store.stats, sv.stats || {}); Object.assign(store.homes, sv.homes || {});
  for (const [k, r] of Object.entries(sv.residents || {})) store.residents[k] = { look: r.look, persona: deserPersona(r.persona) };
  const made = [];
  for (const c of sv.cars || []) {
    const car = new Car(c.type, c.color, c.x, c.z, c.h, c.ai ? { ai: { i: 0, j: 0, d: 0 }, taxi: c.taxi } : { taxi: c.taxi });
    if (c.ai) { car.ai.resetFromPos(); if (c.driver) { const d = makePerson(c.driver.look, false); d.persona = deserPersona(c.driver.persona); car.setDriver(d); car.owner = d; } }
    for (const d of c.dents || []) car.dent(...d);
    car.health = c.health ?? 100; car.fuel = c.fuel ?? car.fuel; cars.push(car); made.push(car);
    if (inMall(car.x, car.z, 2) || world.newPlaces.some(([pl, cx, cz]) => pl !== 'gas' && Math.abs(car.x - cx) < LOT && Math.abs(car.z - cz) < LOT)) { const sp = mpick(world.parking); car.x = sp.x; car.z = sp.z; car.h = sp.h; }
  }
  for (const n of sv.npcs || []) { const p = spawnNPC(n.x, n.z, n.look); p.persona = deserPersona(n.persona); }
  if (sv.waypoint) waypoint = sv.waypoint;
  const P = player, sp = sv.player || {};
  P.pos.set(sp.x ?? P.pos.x, sp.y ?? P.pos.y, sp.z ?? P.pos.z); P.facing = sp.facing ?? P.facing;
  if (sp.lastCar >= 0) P.lastCar = made[sp.lastCar];
  if (sp.where !== 'in') { world.col.query(P.pos.x - 0.3, P.pos.x + 0.3, P.pos.z - 0.3, P.pos.z + 0.3, _near); if (_near.some(c => c.maxY > P.pos.y + STEP && c.minY < P.pos.y + 1.6 && (c.t === 1 || (P.pos.x > c.minX && P.pos.x < c.maxX && P.pos.z > c.minZ && P.pos.z < c.maxZ)))) { P.pos.set(-3, CURB, roadX(2) + RH + 2.2); } }
  if (sp.where === 'in' && world.doors[sp.door] && !world.doors[sp.door].dead) placeInside(world.doors[sp.door]);
  else if (sp.car >= 0 && made[sp.car]) { const car = made[sp.car]; car.setDriver(P); car.hasDriver = true; car.player = true; car.inHand = false; P.state = 'car'; P.car = car; addCarLights(car); }
  cam.yaw = P.state === 'car' ? P.car.h : P.facing; restored = true;
}
function downloadSave() {
  try { saveGame(); const blob = new Blob([localStorage.getItem(SAVE_KEY) || JSON.stringify(snapshot())], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'shahr-azad-save.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); } catch (_) { }
}
addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
addEventListener('pagehide', () => saveGame());

/* using furniture: lie on the bed, sit, read, drink */
function startUse(kind, x, y, z, facing, exitX, exitZ, dur) {
  const P = player; if (chat.open) closeChat();
  P.state = 'use'; P.use = { kind, exitX: exitX ?? P.pos.x, exitZ: exitZ ?? P.pos.z, exitY: y ?? P.pos.y, t: 0, dur: dur || 0 };
  P.pos.set(x, y, z); P.vel.set(0, 0, 0); if (facing != null) P.facing = facing;
  P.anim.special = kind; P.anim.sw = 0;
  if (kind === 'lie') say(P, mpick(['آخیش... چه تخت نرمی!', 'یه کم استراحت...', 'چقدر خسته بودم!']), 2);
  if (kind === 'drink') setTimeout(() => say(P, mpick(['آخیش، خنک شدم!', 'به به، دوغ تازه!', 'چه آب‌میوهٔ خوبی!']), 2), 1300);
}
function endUse() {
  const P = player, u = P.use; if (!u) return;
  P.state = 'foot'; P.anim.special = null; P.pos.set(u.exitX, u.kind === 'lie' ? 0 : u.exitY, u.exitZ); P.vel.set(0, 0, 0); P.use = null; P.onGround = true;
  if (u.seat) u.seat.taken = null; if (u.kind === 'swing' && P.swing) { P.swing.rider = null; P.swing = null; }
}
function sleep() {
  fadeTo(() => { const nightTime = tod >= 20 || tod < 6; tod = nightTime ? 7 : (tod + 2) % 24; envTod = -99; store.stats.sleeps++; banner(nightTime ? 'صبح بخیر!' : 'یه چرت حسابی زدی', nightTime ? 'ساعت ۷ صبح است و حسابی سرحالی' : 'دو ساعت گذشت'); saveGame(); });
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
  const P = player;
  if (P.state === 'fly') { updateFly(dt); return; }
  if (P.where === 'rb' || P.where === 'test') { updatePlayerZone(dt); return; }
  const outdoor = P.where === 'out', col = outdoor ? world.col : interior.col;
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
    const running = (input.run || (touchUI && mag > 0.93)) && (store.energy > 8 || P.skate);
    const tsp = mag * (P.skate ? (running ? 10.5 : 7.5) : running ? 6.6 : 2.5);
    const k = P.skate ? (P.onGround ? (mag > 0.1 ? 1.5 : 0.45) : 0.3) : P.onGround ? 12 : 2.5;
    if (input.useQ) { input.useQ = false; useHeld(); }
    P.vel.x = damp(P.vel.x, dx * tsp, k, dt); P.vel.z = damp(P.vel.z, dz * tsp, k, dt);
    if (cam.fpOn && !chat.open) P.facing += angDiff(P.facing, cam.yaw) * Math.min(1, 18 * dt);
    else if (tsp > 0.1) P.facing += angDiff(P.facing, Math.atan2(dx, dz)) * Math.min(1, 12 * dt);
    else if (chat.open && chat.npc) P.facing += angDiff(P.facing, Math.atan2(chat.npc.pos.x - P.pos.x, chat.npc.pos.z - P.pos.z)) * Math.min(1, 6 * dt);
    if (input.jumpQ && P.onGround && P.anim.prep <= 0) { P.anim.prep = 0.09; P.jumpAt = simTime + 0.09; }
    input.jumpQ = false;
    if (P.jumpAt && simTime >= P.jumpAt) { P.jumpAt = 0; if (P.onGround) { P.vel.y = 6.6; P.onGround = false; P.standCar = null; Audio.step(true); } }
    stepCharacter(P, col, dt, outdoor);
    if (outdoor) slideCarry(P, dt);
    if (P.onGround && !P.skate) { const ph = Math.floor(P.anim.phase / Math.PI); if (ph !== P.stepPh) { P.stepPh = ph; if (Math.hypot(P.vel.x, P.vel.z) > 0.8) { Audio.step(running); if (outdoor && weather.wet > 0.4) FX.splash(P.pos.x, P.pos.y, P.pos.z); } } }
    if (chat.open) { input.actQ = false; if (!chat.npc || Math.hypot(chat.npc.pos.x - P.pos.x, chat.npc.pos.z - P.pos.z) > 5 || chat.npc.mode === 'down') closeChat(); return; }
    // interactions
    let promptTxt = '', actLabel = '';
    const key = touchUI ? '' : '<b>E</b> — ';
    if (outdoor) {
      const door = nearestDoor();
      if (door) {
        const ox = P.pos.x - door.x, oz = P.pos.z - door.z, dn = ox * door.nx + oz * door.nz, lat = Math.abs(ox * -door.nz + oz * door.nx);
        const into = dl > 0 && (dx * -door.nx + dz * -door.nz) > 0.5;
        if (!door.want) {
          P.pushT = into && dn < 0.95 ? P.pushT + dt : 0;
          promptTxt = `<b>${door.name}</b> — ${touchUI ? '«باز کن»' : '<b>E</b>'} در را باز کن`; actLabel = 'باز کن';
          if (P.pushT > 0.4 || input.actQ) { input.actQ = false; P.pushT = 0; door.want = 1; door.closeT = 0; Audio.door(); }
        } else {
          P.pushT = 0;
          promptTxt = `<b>${door.name}</b> — در باز است، برو داخل` + ` · ${touchUI ? '«ببند»' : '<b>E</b>'} بستن در`; actLabel = 'ببند';
          if (input.actQ) { input.actQ = false; door.want = 0; Audio.door(); }
          else if (door.open > 0.55 && into && dn < 0.66 && lat < 0.6) { enterThrough(door); return; }
        }
      } else {
        P.pushT = 0;
        const n = nearestNPC(allPeople(), 2.6), car = nearestCar(1.6), us = nearestUse(), ball = nearestBall(), seat = !us && !car ? nearestSeat() : null;
        const nd = n ? Math.hypot(n.pos.x - P.pos.x, n.pos.z - P.pos.z) : 99;
        if (us && (us.pri || us.d < nd || nd > 1.2 || us.d < 0.6)) { actLabel = us.u.act; promptTxt = us.u.label(); if (input.actQ) { input.actQ = false; us.u.use(); } }
        else if (ball && nd > 1.4) { actLabel = 'بردار'; promptTxt = `${key}توپ رو بردار`; if (input.actQ) { input.actQ = false; pickBall(ball); } }
        else if (seat && seat.d < nd) { actLabel = 'بشین'; promptTxt = `${key}بشین و یه کم استراحت کن`; if (input.actQ) { input.actQ = false; const s = seat.s; startUse('sit', s.x + Math.sin(s.ry) * 0.06, s.y, s.z + Math.cos(s.ry) * 0.06, s.ry, s.x + Math.sin(s.ry) * 0.75, s.z + Math.cos(s.ry) * 0.75); P.use.seat = s; s.taken = P; } }
        else if (n && (!car || Math.hypot(n.pos.x - P.pos.x, n.pos.z - P.pos.z) < 1.8)) {
          actLabel = 'حرف بزن'; promptTxt = `${key}با <b>${n.persona.name}</b> حرف بزن`;
          if (input.actQ) { input.actQ = false; openChat(n); }
        } else if (fly.obj && fly.obj.where === 'out' && Math.hypot(fly.obj.x - P.pos.x, fly.obj.z - P.pos.z) < 3.4 && Math.abs(fly.obj.y - P.pos.y) < 3) {
          promptTxt = `${key}سوار ماشین پرنده شو`; actLabel = 'سوار شو'; if (input.actQ) { input.actQ = false; boardFlyer(); }
        } else if (rb.door && P.state === 'foot' && Math.abs(P.pos.x - rb.door.x) < 5 && P.pos.z < rb.door.z + 3.5 && P.pos.z > rb.door.z - 4.5) {
          promptTxt = `${key}ورود به ساختمان رنگین‌کمان`; actLabel = 'برو داخل';
          if (input.actQ || (P.pos.z < rb.door.z - 1.9 && Math.abs(P.pos.x - rb.door.x) < 3.2)) { input.actQ = false; enterRB(); }
        } else if (bus && bus.phase === 'stop' && bus.doorsOpen && Math.hypot(busDoorPos(bus)[0] - P.pos.x, busDoorPos(bus)[1] - P.pos.z) < 2.6) {
          promptTxt = `${key}سوار اتوبوس خط ۱ شو (بلیت ${fmtT(10000)})`; actLabel = 'سوار شو';
          if (input.actQ) { input.actQ = false; boardBus(); }
        } else if (car && car.service) {
          promptTxt = car.service === 'bus' ? 'اتوبوس فقط در ایستگاه، از درِ کنار پیاده‌رو سوار می‌کند' : 'آمبولانس اورژانس — کاری باهاش نداشته باش!';
        } else if (car && car.isTow && car.driverP && !car.player) {
          promptTxt = `${key}کنار رانندهٔ یدک‌کش سوار شو`; actLabel = 'سوار شو';
          if (input.actQ) { input.actQ = false; boardTow(); }
        } else if (car) {
          promptTxt = car.ai ? `${key}راننده را پیاده کن و پشت فرمان بنشین` : car.health <= 0 ? 'این ماشین خراب شده است' : `${key}سوار ماشین شو`; actLabel = 'سوار شو';
          if (input.actQ) { input.actQ = false; enterCar(car); }
        }
      }
    } else {
      const ex = interior.D / 2, dn = ex - P.pos.z, lat = Math.abs(P.pos.x);
      const ed = interior.exitDoor;
      if (dn < 2.0 && lat < 0.9) {
        const out = dl > 0 && dz > 0.5;
        if (!ed.want) {
          P.pushT = out && dn < 0.9 ? P.pushT + dt : 0;
          promptTxt = `${touchUI ? '«باز کن»' : '<b>E</b>'} در را باز کن تا بیرون بروی`; actLabel = 'باز کن';
          if (P.pushT > 0.4 || input.actQ) { input.actQ = false; P.pushT = 0; ed.want = 1; ed.closeT = 0; Audio.door(); }
        } else {
          P.pushT = 0; promptTxt = `در باز است، برو بیرون · ${touchUI ? '«ببند»' : '<b>E</b>'} بستن در`; actLabel = 'ببند';
          if (input.actQ) { input.actQ = false; ed.want = 0; Audio.door(); }
          else if (ed.open > 0.55 && out && dn < 0.62 && lat < 0.6) { exitThrough(); return; }
        }
      } else {
        P.pushT = 0;
        const n = nearestNPC(interior.npcs, 2.8);
        let item = null, bd = 9;
        for (const it of interior.items || []) { const d = Math.hypot(it.x - P.pos.x, it.z - P.pos.z); if (d < it.r && d < bd) { bd = d; item = it; } }
        const nd = n ? Math.hypot(n.pos.x - P.pos.x, n.pos.z - P.pos.z) : 99;
        if (item && bd < nd) { actLabel = 'استفاده'; promptTxt = `${key}${item.label()}`; if (input.actQ) { input.actQ = false; item.use(); } }
        else if (n) { actLabel = 'حرف بزن'; promptTxt = `${key}با <b>${n.persona.name}</b> حرف بزن`; if (input.actQ) { input.actQ = false; openChat(n); } }
      }
    }
    input.actQ = false;
    setPrompt(promptTxt, actLabel);
  } else if (P.state === 'passenger' && P.car.service === 'bus') {
    const t = P.car; P.pos.set(t.x, t.y + 0.6, t.z);
    setPrompt(t.phase === 'stop' ? `ایستگاه ${streetAt(t.x, t.z)} — ${touchUI ? '«پیاده شو»' : '<b>E</b>'} پیاده شو` : `اتوبوس خط ۱ · ایستگاه بعد: ${t.nextName || ''} · وقتی ایستاد پیاده شو`, 'پیاده شو');
    if (input.ejectQ) { input.ejectQ = false; say(t.driverP, 'آقا! رانندهٔ اتوبوس رو که نمی‌شه انداخت پایین!', 2.5); }
    else if (input.actQ) { input.actQ = false; if (t.phase === 'stop') leaveBus(); else setPrompt('صبر کن اتوبوس به ایستگاه برسه', 'پیاده شو', 1.2); }
  } else if (P.state === 'passenger') {
    const t = P.car; P.pos.set(t.x, t.y + 0.6, t.z);
    setPrompt(`${touchUI ? '«پیاده شو»' : '<b>E</b>'} پیاده شو · ${touchUI ? '«بنداز پایین»' : '<b>G</b>'} راننده رو بنداز پایین و خودت برون!`, 'پیاده شو');
    if (input.ejectQ) { input.ejectQ = false; throwDriver(); }
    else if (input.actQ) { input.actQ = false; if (Math.abs(t.vf) < 2) leaveTow(); else setPrompt('صبر کن یدک‌کش وایسه', 'پیاده شو', 1.2); }
  } else if (P.state === 'use') {
    const u = P.use; u.t += dt; P.vel.set(0, 0, 0);
    const moving = Math.hypot(input.mx, input.my) > 0.5 && u.t > 0.6;
    if (u.kind === 'lie') { setPrompt(`${touchUI ? '«بلند شو»' : '<b>E</b>'} بلند شو · ${touchUI ? '«بخواب»' : '<b>Space</b>'} بخواب ${tod >= 20 || tod < 6 ? 'تا صبح' : 'یه کم'}`, 'بلند شو'); if (input.jumpQ) { input.jumpQ = false; sleep(); } }
    else if (u.kind === 'fuel') setPrompt(`در حال بنزین زدن… ${fa(Math.min(u.fuelL, Math.round(u.t / u.dur * u.fuelL)))} از ${fa(u.fuelL)} لیتر`, 'بس کن');
    else if (u.kind === 'swing') setPrompt(`${touchUI ? '«پیاده شو»' : '<b>E</b>'} از تاب پیاده شو`, 'پیاده شو');
    else if (u.kind === 'arcade') setPrompt('در حال بازی…', '');
    else if (!u.dur) setPrompt(`${touchUI ? '«بلند شو»' : '<b>E</b>'} ${u.kind === 'read' ? 'کتاب رو بذار سر جاش' : 'بلند شو'}`, 'بلند شو');
    else setPrompt('', '');
    input.jumpQ = false;
    if (u.kind === 'swing' && P.swing) { /* the swing moves you */ }
    if (input.actQ || (moving && u.kind !== 'swing') || (u.dur && u.t > u.dur)) { input.actQ = false; const done = u.dur && u.t > u.dur; endUse(); if (done && u.onDone) u.onDone(); else if (!done && u.kind === 'fuel') toast('سوخت‌گیری نیمه‌کاره ماند'); }
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
    if (!car.isTow) { const f0 = car.fuel; car.fuel = Math.max(0, car.fuel - (Math.abs(car.vf) * 0.0045 + Math.max(0, car.inThrottle) * 0.006) * dt);
      if (f0 > 12 && car.fuel <= 12) { banner('بنزین رو به اتمام است', 'برو جایگاه سوخت (علامت «ب» روی نقشه)'); }
      if (f0 > 0 && car.fuel <= 0) { banner('بنزین تمام شد!', 'ماشین را تا پمپ هل بده یا یدک‌کش خبر کن'); Audio.engine(false, 0, 0); } }
    if (input.actQ) { input.actQ = false; if (kmh < 12) exitCar(); else setPrompt('برای پیاده شدن اول سرعت را کم کن', 'پیاده شو', 1.2); }
    else if (promptHold <= 0) setPrompt(car.health <= 0 ? 'ماشین خراب شد! پیاده شو و یه ماشین دیگه پیدا کن.' : car.fuel <= 0 ? 'بنزین تمام شده! از منوی تعمیرگاه یدک‌کش خبر کن.' : car.health < 30 ? 'موتور آسیب دیده و دود می‌کند.' : car.fuel < 12 ? 'بنزین کم است — جایگاه سوخت «ب» روی نقشه' : '', 'پیاده شو');
    if (input.horn && !P.hornOn) hornEvent = { x: car.x, z: car.z, h: car.h, t: simTime };
    P.hornOn = input.horn; Audio.horn(input.horn);
    car.blink = Math.abs(car.steer) > 0.25 && Math.abs(car.vf) > 1 ? (car.steer > 0 ? 'R' : 'L') : null;

  }
}
let promptHold = 0, lastPrompt = '', lastAct = '';
function setPrompt(txt, act, hold) {
  if (hold) promptHold = hold;
  if (txt !== lastPrompt) { lastPrompt = txt; const p = $('prompt'); p.hidden = !txt; p.innerHTML = txt; }
  if (act !== lastAct) { lastAct = act; const b = $('b-act'); b.textContent = act || '—'; b.style.opacity = act ? '1' : '0.4'; }
}

/* first person: eyes in the head (or in the driver's seat); the head itself is hidden */
function fpWanted() {
  const P = player;
  return cam.fp && P.state !== 'entering' && P.state !== 'exiting' && P.mode !== 'down' && !(P.state === 'use' && (P.use.kind === 'lie' || P.use.kind === 'swing'));
}
function setView(fp) {
  cam.fp = fp; settings.view = fp ? 'first' : 'third'; saveSettings();
  cam.fpPitch = 0.08; cam.fpYaw = 0; if (!fp && player) player.H.hideHead = false;
  $('btn-view').textContent = fp ? 'دید: اول شخص' : 'دید: سوم شخص'; $('btn-view').classList.toggle('on', fp);
}
function toggleView() { setView(!cam.fp); toast(cam.fp ? 'دید اول شخص — با کشیدن انگشت یا موس اطرافت را نگاه کن' : 'دید سوم شخص'); }
const _eye = new V3(), _look = new V3();
/* a cockpit for the car you drive in first person: dashboard, live gauges, wheel that turns, seats, mirror */
let cockpit = null;
function makeCockpit(car) {
  const t = car.T, W = t.wid, g = new THREE.Group(), side = 1, dx = side * (W / 2 - 0.5), z1 = t.cab[1];
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.85 }), soft = new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: 1 }), chrome = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.9, roughness: 0.25 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  const by = t.beltY + 0.09;
  add(new THREE.BoxGeometry(W - 0.12, 0.012, t.cab[1] - t.cab[0] + 1.1), soft, 0, by + 0.012, (t.cab[0] + z1) / 2 + 0.25);
  add(new THREE.BoxGeometry(W - 0.16, 0.2, 0.55), dark, 0, by + 0.1, z1 + 0.5);
  add(new THREE.BoxGeometry(W - 0.16, 0.05, 0.42), dark, 0, by + 0.22, z1 + 0.42, -0.12);
  add(new THREE.BoxGeometry(0.42, 0.1, 0.12), dark, dx, by + 0.24, z1 + 0.2);
  add(new THREE.BoxGeometry(0.28, 0.24, 0.5), dark, 0, by + 0.0, z1 - 0.05);
  for (const sx of [-1, 1]) { add(new THREE.BoxGeometry(0.06, 0.16, t.cab[1] - t.cab[0] + 0.7), soft, sx * (W / 2 - 0.1), by + 0.05, (t.cab[0] + z1) / 2 + 0.1); add(new THREE.BoxGeometry(0.5, 0.62, 0.12), soft, sx * (W / 2 - 0.5), by + 0.3, (t.cab[0] + z1) / 2 - 0.5, -0.12); add(new THREE.BoxGeometry(0.28, 0.2, 0.1), soft, sx * (W / 2 - 0.5), by + 0.72, (t.cab[0] + z1) / 2 - 0.55); }
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.07, 0.06, 0.85), dark, sx * (W / 2 - 0.16), (by + t.roofY) / 2 + 0.02, z1 + 0.1, 0.95);
  add(new THREE.BoxGeometry(0.26, 0.07, 0.025), dark, 0.05, t.roofY - 0.13, z1 - 0.02); add(new THREE.BoxGeometry(0.23, 0.055, 0.005), chrome, 0.05, t.roofY - 0.13, z1 - 0.034);
  const c = mkCanvas(256, 96), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const cl = add(new THREE.PlaneGeometry(0.36, 0.135), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), dx, by + 0.215, z1 + 0.145, -0.25, Math.PI);
  const wheel = new THREE.Group(); wheel.position.set(dx, by + 0.1, z1 + 0.02); wheel.rotation.x = -1.15; g.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 8, 28), dark); wheel.add(rim);
  for (const a of [0, 2.2, -2.2]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.17, 0.02), dark); sp.position.set(Math.sin(a) * 0.085, Math.cos(a) * 0.085, 0); sp.rotation.z = -a; wheel.add(sp); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 14), chrome); hub.rotation.x = Math.PI / 2; wheel.add(hub);
  g.userData = { car, wheel, ctx: c.getContext('2d'), tex, last: '' };
  return g;
}
function updateCockpit() {
  const P = player, want = cam.fpOn && P.state === 'car' && P.car && !P.car.isTow;
  if (!want) { if (cockpit) cockpit.visible = false; return; }
  if (!cockpit || cockpit.userData.car !== P.car) { if (cockpit) cockpit.parent?.remove(cockpit); cockpit = makeCockpit(P.car); P.car.body.add(cockpit); }
  cockpit.visible = true; const u = cockpit.userData, c = P.car;
  u.wheel.rotation.z = -c.steer * 2.6;
  const kmh = Math.round(Math.abs(c.vf) * 3.6), key = kmh + '|' + Math.round(c.fuel) + '|' + (c.vf < -0.5 ? 'R' : c.inHand ? 'P' : 'D');
  if (key !== u.last) { u.last = key; const g = u.ctx; g.fillStyle = '#05070a'; g.fillRect(0, 0, 256, 96);
    g.fillStyle = '#9fe8ff'; g.font = 'bold 54px Vazirmatn, Tahoma'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(fa(kmh), 128, 44);
    g.font = '15px Vazirmatn, Tahoma'; g.fillStyle = '#7a8a96'; g.fillText('کیلومتر بر ساعت', 128, 82);
    g.fillStyle = '#ffb340'; g.font = 'bold 26px Vazirmatn, Tahoma'; g.fillText(key.split('|')[2], 30, 44);
    g.fillStyle = '#333'; g.fillRect(206, 18, 14, 60); g.fillStyle = c.fuel > 20 ? '#ffb340' : '#ff5b4e'; const h = 60 * c.fuel / 100; g.fillRect(206, 78 - h, 14, h);
    u.tex.needsUpdate = true; }
}
function updateCameraFP(dt) {
  const P = player, inCar = P.state === 'car' || P.state === 'passenger';
  let yaw, pitch = cam.fpPitch;
  if (inCar) {
    const c = P.car, t = c.T, side = P.state === 'passenger' ? -1 : 1;
    c.group.updateMatrixWorld(true);
    if (c.service === 'bus' && side < 0) _eye.set(-0.75, 2.12, -1.4).applyMatrix4(c.body.matrixWorld);
    else _eye.set(side * (t.wid / 2 - 0.5), t.roofY - (c.isTow ? 0.42 : 0.26), (t.cab[0] + t.cab[1]) / 2 - 0.22).applyMatrix4(c.body.matrixWorld);
    if (P.state === 'car' && simTime - cam.lastLook > 4 && Math.abs(c.vf) > 3) { cam.fpYaw = damp(cam.fpYaw, 0, 2, dt); cam.fpPitch = damp(cam.fpPitch, 0.05, 2, dt); }
    yaw = c.h + cam.fpYaw + (c.vf < -1 && simTime - cam.lastLook > 1.6 ? 0 : 0); pitch = cam.fpPitch - c.pitch;
    cam.fpY = _eye.y;
  } else {
    const h = P.look.h || 1, u = P.state === 'use' ? P.use.kind : '';
    let eh = 1.6 * h; if (u === 'sit' || P.anim.special === 'sit') eh = 1.12 * h; if (P.anim.special === 'repair') eh = 1.05 * h;
    const spd = Math.hypot(P.vel.x, P.vel.z), bob = P.onGround ? -Math.abs(Math.cos(P.anim.phase)) * Math.min(1, spd / 3) * 0.045 : 0;
    const ty = P.pos.y + eh + bob - P.anim.land * 0.25 - P.anim.prep * 0.6;
    cam.fpY = Math.abs(cam.fpY - ty) > 1.2 ? ty : damp(cam.fpY, ty, P.onGround ? 22 : 40, dt);
    _eye.set(P.pos.x + Math.sin(P.facing) * 0.09, cam.fpY, P.pos.z + Math.cos(P.facing) * 0.09);
    if (chat.open && chat.npc) {
      const n = chat.npc, hy = n.pos.y + 1.55 * (n.look.h || 1);
      cam.yaw += angDiff(cam.yaw, Math.atan2(n.pos.x - _eye.x, n.pos.z - _eye.z)) * Math.min(1, 4 * dt);
      cam.fpPitch = damp(cam.fpPitch, Math.atan2(_eye.y - hy, Math.hypot(n.pos.x - _eye.x, n.pos.z - _eye.z)), 4, dt);
    }
    yaw = cam.yaw; pitch = cam.fpPitch;
    if (cam.shake > 0) { _eye.x += (Math.random() - 0.5) * cam.shake * 0.15; _eye.y += (Math.random() - 0.5) * cam.shake * 0.15; cam.shake = Math.max(0, cam.shake - dt * 1.6); }
  }
  const cp = Math.cos(pitch);
  _look.set(_eye.x + Math.sin(yaw) * cp, _eye.y - Math.sin(pitch), _eye.z + Math.cos(yaw) * cp);
  camera.position.copy(_eye); camera.lookAt(_look);
  cam.target.set(P.pos.x, P.pos.y + 1.45, P.pos.z);
  if (camera.view && camera.view.enabled) camera.clearViewOffset();
  const fovT = (inCar ? 66 + clamp(Math.abs(P.car.vf) * 0.25, 0, 12) : 72);
  cam.fov = damp(cam.fov, fovT, 3, dt); if (Math.abs(camera.fov - cam.fov) > 0.05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
}
function updateCamera(dt) {
  const P = player;
  if (P.state === 'fly' && fly.obj) { cam.fpOn = false; syncFlyer(0); updateCameraFly(dt); return; }
  if (P.where === 'rb' && rb.build && cam.free) { cam.fpOn = false; P.H.hideHead = false; updateCameraFree(); return; }
  if (P.state === 'hide' && P.hideSpot && P.hideSpot.kind === 'in') { cam.fpOn = false; updateCameraHide(dt); return; }
  const fpNow = fpWanted();
  if (fpNow && !cam.fpOn) { cam.fpPitch = 0.08; cam.fpYaw = 0; cam.fpY = P.pos.y + 1.6; }
  if (!fpNow && cam.fpOn && (P.state === 'car' || P.state === 'passenger')) cam.yaw = P.car.h + cam.fpYaw;
  cam.fpOn = fpNow; P.H.hideHead = fpNow; P.H.hideTrunk = fpNow && (P.state === 'car' || P.state === 'passenger');
  if (fpNow) { updateCameraFP(dt); return; }
  const outdoor = P.where === 'out';
  let tx, ty, tz, desired;
  if (P.state === 'car' || P.state === 'passenger') {
    const c = P.car; tx = c.x; ty = c.y + (c.isTow ? 2.4 : 1.55); tz = c.z;
    desired = (6.4 + c.T.len * 0.35) * cam.zoom;
    if (simTime - cam.lastLook > 1.3 && Math.abs(c.vf) > 1) { const back = c.vf >= -0.5 ? c.h : c.h + Math.PI; cam.yaw += angDiff(cam.yaw, back) * Math.min(1, dt * (1.2 + Math.abs(c.vf) * 0.12)); cam.pitch = damp(cam.pitch, 0.22, 1.5, dt); }
    cam.target.set(tx, damp(cam.target.y, ty, 8, dt), tz);
  } else if (chat.open && chat.npc) {
    // over-the-shoulder conversation framing
    const n = chat.npc, mx = lerp(P.pos.x, n.pos.x, 0.6), mz = lerp(P.pos.z, n.pos.z, 0.6);
    const base = Math.atan2(n.pos.x - P.pos.x, n.pos.z - P.pos.z), col0 = zoneCol(P.where);
    if (!chat.side || simTime > chat.sideT) { chat.sideT = simTime + 1.5; let best = -0.42, bd = -1; for (const off of [-0.42, 0.42, -0.9, 0.9]) { const y = base + off, d = rayCast(col0, mx, n.pos.y + 1.5, mz, -Math.sin(y) * 0.99, 0.1, -Math.cos(y) * 0.99, 3.2, 0.1); if (d > bd + 0.2) { bd = d; best = off; } } chat.side = best; }
    const yawT = base + chat.side;
    cam.yaw += angDiff(cam.yaw, yawT) * Math.min(1, 3 * dt); cam.pitch = damp(cam.pitch, 0.1, 3, dt);
    cam.target.x = damp(cam.target.x, mx, 5, dt); cam.target.z = damp(cam.target.z, mz, 5, dt); cam.target.y = damp(cam.target.y, n.pos.y + 1.55 * (n.look.h || 1), 5, dt);
    desired = 2.6;
  } else {
    if (P.state === 'use' && P.use.kind === 'lie') cam.pitch = damp(cam.pitch, 0.85, 2, dt);
    tx = P.pos.x; ty = P.pos.y + (P.state === 'use' && P.use.kind === 'lie' ? 0.45 : P.state === 'use' && P.use.kind === 'sit' ? 1.05 : 1.45) - P.anim.knock * 1.0; tz = P.pos.z;
    if (P.state === 'entering' || P.state === 'exiting') { tx = P.car.x; tz = P.car.z; ty = P.car.y + 1.4; }
    desired = (outdoor || P.where === 'rb' || P.where === 'test' ? 4.6 : 3.1) * cam.zoom;
    const kT = Math.max(18, Math.hypot(P.vel.x, P.vel.z) * 0.9); cam.target.x = damp(cam.target.x, tx, kT, dt); cam.target.z = damp(cam.target.z, tz, kT, dt); cam.target.y = damp(cam.target.y, ty, 9, dt);
  }
  const cp = Math.cos(cam.pitch), dx = -Math.sin(cam.yaw) * cp, dy = Math.sin(cam.pitch), dz = -Math.cos(cam.yaw) * cp;
  const col = zoneCol(P.where);
  let hit = rayCast(col, cam.target.x, cam.target.y, cam.target.z, dx, dy, dz, desired + 0.3, chat.open ? 0.1 : 0.45) - 0.3;
  if (P.where === 'rb') hit = Math.min(hit, rbDoorHit(cam.target.x, cam.target.y, cam.target.z, dx, dy, dz, desired + 0.3) - 0.3);
  const want = Math.max(0.6, Math.min(desired, hit));
  cam.cur = want < cam.cur ? want : damp(cam.cur, want, 3, dt);
  let px = cam.target.x + dx * cam.cur, py = cam.target.y + dy * cam.cur, pz = cam.target.z + dz * cam.cur;
  if (outdoor) py = Math.max(py, groundH(px, pz) + 0.35); else if (P.where === 'in') py = clamp(py, 0.4, 2.9); else if (P.where === 'rb') py = Math.max(py, P.pos.y + 0.3); else py = Math.max(py, 0.4);
  if (cam.shake > 0) { px += (Math.random() - 0.5) * cam.shake * 0.4; py += (Math.random() - 0.5) * cam.shake * 0.4; pz += (Math.random() - 0.5) * cam.shake * 0.4; cam.shake = Math.max(0, cam.shake - dt * 1.6); }
  camera.position.set(px, py, pz); camera.lookAt(cam.target);
  const off = chat.open && innerWidth > innerHeight * 1.25 ? innerWidth * 0.2 : 0;
  cam.voff = damp(cam.voff || 0, off, 5, dt);
  if (cam.voff > 1) camera.setViewOffset(innerWidth, innerHeight, cam.voff, 0, innerWidth, innerHeight); else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  const fovT = 60 + ((P.state === 'car' || P.state === 'passenger') ? clamp(Math.abs(P.car.vf) * 0.32, 0, 14) : 0) + (P.where === 'rb' && P.turbo ? clamp(Math.hypot(P.vel.x, P.vel.z) * (P.turbo === 2 ? 0.1 : 0.45), 0, 22) : 0);
  cam.fov = damp(cam.fov, fovT, 3, dt); if (Math.abs(camera.fov - cam.fov) > 0.05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
}

/* ============================================================
   Garage, repairs and the tow truck
   ============================================================ */
let tow = null, towJob = null;
const MECH_LOOK = () => Object.assign(randomLook(), { shirt: '#2b4c7e', pants: '#2b4c7e', shoes: '#1a1a1a', style: Math.random() < 0.6 ? 'short' : 'curly', cap: Math.random() < 0.6 ? '#c2561a' : null, coat: null, sleeves: true, umbrella: false, female: false, beard: Math.random() < 0.4, h: 0.98 + Math.random() * 0.06 });
function staffFor(key, job, line) {
  let rs = store.residents[key];
  if (!rs) { const look = MECH_LOOK(); const persona = makePersona(look, false); persona.job = job; persona.jobLine = line; rs = store.residents[key] = { look, persona }; }
  const p = makePerson(rs.look, false); p.persona = rs.persona; p.npc = true; return p;
}
let towSignTex = null;
function addTowParts(car) {
  const t = car.T, body = car.body;
  const bed = car.bed = new THREE.Group(); bed.position.set(0, 1.2, 1.3); body.add(bed);
  const steel = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.55, metalness: 0.6 });
  const mk = (geo, mat, x, y, z, parent = bed) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  mk(new THREE.BoxGeometry(2.3, 0.18, 4.95), steel, 0, 0.09, -2.47);
  for (const sx of [-1.11, 1.11]) mk(new THREE.BoxGeometry(0.08, 0.22, 4.95), car.paint, sx, 0.27, -2.47);
  mk(new THREE.BoxGeometry(2.2, 0.05, 0.7), steel, 0, 0.02, -5.1).rotation.x = 0.12;
  mk(new THREE.BoxGeometry(0.9, 0.5, 0.45), new THREE.MeshStandardMaterial({ color: 0xf2c12e, roughness: 0.5 }), 0, 0.43, -0.3);
  mk(new THREE.BoxGeometry(1.5, 0.1, 0.28), CarMats.black, 0, t.roofY + 0.12, (t.cab[0] + t.cab[1]) / 2, body);
  car.beacon = new THREE.MeshStandardMaterial({ color: 0x8a5a10, emissive: 0xffa21a, emissiveIntensity: 0 });
  car.beacons = [-0.5, 0.5].map(x => mk(new THREE.BoxGeometry(0.42, 0.15, 0.24), car.beacon, x, t.roofY + 0.24, (t.cab[0] + t.cab[1]) / 2, body));
  if (!towSignTex) { const c = mkCanvas(512, 150), g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.font = '70px Lalezar, Vazirmatn, Tahoma'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillText('یدک‌کش شهر آزاد', 256, 58); g.font = '40px Vazirmatn, Tahoma'; g.fillText('امداد خودرو ۲۴ ساعته', 256, 120); towSignTex = new THREE.CanvasTexture(c); towSignTex.colorSpace = THREE.SRGBColorSpace; }
  const sm = new THREE.MeshBasicMaterial({ map: towSignTex, transparent: true, toneMapped: false });
  for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.37), sm); m.position.set(sx * (t.wid / 2 + 0.11), 1.3, 2.3); m.rotation.y = sx * Math.PI / 2; body.add(m); }
  car.bedTilt = 0; car.bedSlide = 0;
}
function towVisuals(car, dt) {
  if (!car.bed) return;
  car.bed.rotation.x = -car.bedTilt * 0.17; car.bed.position.z = 1.3 - car.bedSlide * 1.4;
  const on = car.beaconOn, ph = (simTime * 3) % 1;
  car.beacon.emissiveIntensity = on ? (ph < 0.5 ? 4 : 0.6) : 0;
  car.beacons[0].visible = !on || ph < 0.5 || true;
}
function spawnTow() {
  const old = tow;
  tow = new Car('tow', 0xe2661c, roadX(1) - LANE, -14, 0, { ai: { i: 1, j: 3, d: 0 } });
  tow.isTow = true; addTowParts(tow); cars.push(tow);
  const d = staffFor('towDriver', 'رانندهٔ یدک‌کش', 'شب و روز ماشین خراب‌ها رو می‌برم تعمیرگاه.');
  tow.setDriver(d); tow.owner = d;
  if (old) old.isTow = false;
  return tow;
}
function spawnGarageStaff() {
  for (let k = 0; k < 2; k++) {
    const m = staffFor('mech' + k, 'مکانیک', k ? 'برق ماشین کار منه.' : 'سی ساله موتور تعمیر می‌کنم!');
    const [x, z] = garage.mechSpots[k]; m.mech = true; m.mechIdx = k; m.mode = 'mech'; m.pos.set(x, CURB, z); m.anim.idleKind = 'crossed';
    outdoorPool.attach(m); npcs.push(m); garage.mechs.push(m);
  }
  spawnTow();
}
const freeBay = () => garage.bays.find(b => !b.car) || garage.bays[0];
const inBay = (c, b) => Math.abs(c.x - b.x) < 4.6 && Math.abs(c.z - b.z) < 2.3;
function bedAnchor(t, out) { t.group.updateMatrixWorld(true); out.set(0, 0.18, -2.6); return t.bed.localToWorld(out); }
const _anc = new V3();
function startRepair(car, bay) {
  garage.job = { car, bay, phase: 'gather', t: 0, startHp: car.health, sx: car.x, sz: car.z, sh: car.h };
  bay.car = car; car.locked = true; car.vx = car.vz = 0; car.av = 0; car.inHand = true;
  const h = bay.h, lx = Math.cos(h), lz = -Math.sin(h);
  garage.job.spots = [[bay.x + lx * 1.7 - Math.sin(h) * 0.9, bay.z + lz * 1.7 - Math.cos(h) * 0.9], [bay.x - lx * 1.7 + Math.sin(h) * 0.9, bay.z - lz * 1.7 + Math.cos(h) * 0.9]];
  if (Math.hypot(player.pos.x - bay.x, player.pos.z - bay.z) < 40) banner('تعمیر شروع شد', player.state === 'car' && player.car === car ? 'می‌تونی پیاده شی و تماشا کنی' : 'مکانیک‌ها رفتن سراغ ماشین');
  say(garage.mechs[0], mpick(['بذار ببینم چی شده...', 'اوه، حسابی ضربه خورده!', 'زود درستش می‌کنیم.']), 3);
}
function updateRepair(dt) {
  for (const b of garage.bays) { b.lift = b.car && b.car.lift ? b.car.lift : damp(b.lift, 0, 4, dt); b.arms.position.y = CURB + 0.2 + b.lift; }
  // the player drives into a bay and stops
  if (!garage.job && player.state === 'car' && !player.car.isTow) {
    const c = player.car, b = garage.bays.find(b => inBay(c, b));
    if (b && Math.abs(c.vf) < 0.4) { garage.wait = (garage.wait || 0) + dt; if (garage.wait > 1) { garage.wait = -99; if (c.health < 99 || c.dents) startRepair(c, b); else banner('ماشینت سالمه!', 'نیازی به تعمیر نیست'); } }
    else if (!b) garage.wait = 0;
  }
  const j = garage.job; if (!j) return;
  j.t += dt; const c = j.car;
  if (j.phase === 'gather') {
    const u = smooth(0, 2.5, j.t); c.x = lerp(j.sx, j.bay.x, u); c.z = lerp(j.sz, j.bay.z, u); c.h = j.sh + angDiff(j.sh, j.bay.h) * u;
    if (j.t > 2.6) { j.phase = 'raise'; j.t = 0; Audio.burst(0.12, 300, 1.6, 'lowpass', 1); }
  } else if (j.phase === 'raise') { c.lift = smooth(0, 2.5, j.t) * 1.25; if (j.t > 2.6) { j.phase = 'work'; j.t = 0; } }
  else if (j.phase === 'work') {
    const dur = 9; c.health = lerp(j.startHp, 100, Math.min(1, j.t / dur));
    if (Math.random() < dt * 7) { const s = Math.sin(c.h), co = Math.cos(c.h), lz = (Math.random() - 0.5) * c.T.len * 0.8, lx = (Math.random() - 0.5) * c.T.wid * 0.6; const x = c.x + lx * co + lz * s, z = c.z - lx * s + lz * co, y = c.y + c.lift + 0.25; for (let k = 0; k < 6; k++) FX.emit(x, y, z, (Math.random() - 0.5) * 4, -Math.random() * 2, (Math.random() - 0.5) * 4, 0.45, 0.05, 0.02, 0xffb34a, 1, 9); }
    if (Math.random() < dt * 2.5) Audio.clank(c.x, c.z); if (Math.random() < dt * 0.4) Audio.drill(c.x, c.z);
    if (j.t > dur) { c.repairAll(); j.phase = 'lower'; j.t = 0; }
  } else if (j.phase === 'lower') { c.lift = (1 - smooth(0, 2.5, j.t)) * 1.25; if (j.t > 2.6) { c.lift = 0; j.phase = 'done'; } }
  else if (j.phase === 'done') {
    c.locked = false; c.inHand = true; j.bay.car = null; garage.job = null; store.stats.repairs++;
    say(garage.mechs[1], mpick(['تموم شد! مثل روز اول شد.', 'بفرما، صفر کیلومتر شد!', 'دیگه مواظب باش، باشه؟']), 3);
    if (Math.hypot(player.pos.x - c.x, player.pos.z - c.z) < 60) banner('ماشینت مثل روز اول شد!', 'سوار شو و با احتیاط برون');
    logEvent('تعمیرگاه مرکزی یه ماشین داغون رو مثل روز اول کرد.'); saveGame();
  }
}
/* mechanic drives a delivered car from the kerb into the bay */
function startValet(car, bay) {
  const m = garage.mechs[0]; m.mode = 'valet'; m.vel.set(0, 0, 0);
  car.setDriver(m); car.hasDriver = true; car.locked = false; car.inHand = false; bay.car = car;
  car.valet = { bay, pts: [{ x: car.x - 3, z: bay.z }, { x: bay.x, z: bay.z }], k: 0 };
}
function updateValet(car, dt) {
  const v = car.valet, p = v.pts[v.k], dx = p.x - car.x, dz = p.z - car.z, d = Math.hypot(dx, dz);
  if (d < 1.2 && v.k < v.pts.length - 1) v.k++;
  const fx = Math.sin(car.h), fz = Math.cos(car.h), lr = dx * -fz + dz * fx, lf = dx * fx + dz * fz;
  const maxSt = 0.62 / (1 + Math.abs(car.vf) * 0.045);
  car.inSteer = clamp(Math.atan2(2 * car.T.wb * lr, Math.max(d * d, 1)) / maxSt, -1, 1) * (lf < 0 ? -1 : 1);
  const last = v.k === v.pts.length - 1, tsp = last ? Math.min(2.6, d * 0.7) : 2.6;
  car.inThrottle = clamp((tsp - car.vf) * 0.7, -1, 1); car.inHand = false;
  if (last && d < 0.7) {
    car.valet = null; car.inThrottle = 0; car.inHand = true; car.vx = car.vz = 0;
    const m = car.driverP; car.driverP = null; car.hasDriver = false;
    if (m) { m.inCar = null; m.anim.special = null; m.anim.sw = 0; const s = Math.sin(car.h), c = Math.cos(car.h); m.pos.set(car.x + c * 1.6, CURB, car.z - s * 1.6); m.mode = 'mech'; }
    startRepair(car, v.bay);
  }
}
/* tow truck jobs: drive to a car, winch it onto the bed, take it to the garage */
function callTow() {
  const target = player.state === 'car' ? player.car : player.lastCar;
  if (!target || target.isTow) return 'ماشینی نداری که یدک‌کش ببره.';
  if (towJob) return 'یدک‌کش تو راهه، یه کم صبر کن.';
  if (garage.job && garage.job.car === target) return 'ماشینت همین الان تو تعمیرگاهه.';
  if (tow && tow.player) return 'خودت پشت فرمان یدک‌کشی!';
  if (!tow || !tow.driverP) spawnTow();
  if (player.state === 'foot') { player.anim.special = 'phone'; setTimeout(() => { if (player.anim.special === 'phone') player.anim.special = null; }, 3200); }
  say(player, 'الو؟ تعمیرگاه؟ ماشینم خراب شده، یه یدک‌کش بفرستید لطفاً.', 3);
  setTimeout(() => {
    towJob = { phase: 'toCar', car: target, t: 0, re: 0 };
    if (!tow.ai) tow.ai = new CarAI(tow, 1, 3, 0), tow.ai.resetFromPos();
    tow.ai.setDest(target.x, target.z); towJob.dest = { x: target.x, z: target.z };
    banner('یدک‌کش راه افتاد', `حدود ${fa(Math.round(Math.hypot(tow.x - target.x, tow.z - target.z)))} متر تا ماشینت فاصله دارد`);
    logEvent('یدک‌کش تعمیرگاه رفت دنبال یه ماشین خراب.');
  }, 2200);
  return 'زنگ زدی. یدک‌کش داره میاد!';
}
function updateTow(dt) {
  if (!tow) return;
  if (tow.carrying) { const c = tow.carrying; bedAnchor(tow, _anc); c.x = _anc.x; c.z = _anc.z; c.y = _anc.y; c.h = tow.h; c.carryPitch = tow.bed.rotation.x; c.vx = c.vz = c.vf = 0; c.sync(dt); }
  tow.beaconOn = !!towJob || !!tow.carrying;
  const J = towJob; if (!J) {
    // the player drives the tow (with a car on it) to the garage
    if (tow.player && tow.carrying && Math.hypot(tow.x - garage.road.x, tow.z - garage.road.z) < 32 && Math.abs(tow.vf) < 0.4) towJob = { phase: 'unload', car: tow.carrying, t: 0, bay: freeBay(), self: true };
    return;
  }
  const c = J.car; J.t += dt;
  if (!tow.driverP && J.phase !== 'unload') { towJob = null; return; }
  if (J.phase === 'toCar') {
    J.re += dt; if (J.re > 4) { J.re = 0; if (Math.hypot(c.x - J.dest.x, c.z - J.dest.z) > 20) { tow.ai.setDest(c.x, c.z); J.dest = { x: c.x, z: c.z }; } }
    if (tow.ai && tow.ai.arrived) {
      if (player.state === 'car' && player.car === c) { exitCar(); say(tow.driverP, 'لطفاً پیاده شو تا بارش کنیم.', 3); }
      J.phase = 'load'; J.t = 0; J.s = { x: c.x, z: c.z, y: c.y, h: c.h }; c.locked = true; c.inHand = true; c.glide = true;
      say(tow.driverP, mpick(['اومدم! الان بارش می‌کنیم.', 'سلام! این ماشین خرابه؟ بذار ببرمش.']), 3);
    }
  } else if (J.phase === 'load' || J.phase === 'unload') {
    const tilt = J.t < 1.2 ? J.t / 1.2 : J.t < 5 ? 1 : Math.max(0, 1 - (J.t - 5) / 1.2);
    tow.bedTilt = tilt; tow.bedSlide = tilt; tow.inHand = true; tow.locked = true;
    if (J.phase === 'unload' && !J.s) { J.s = { x: c.x, z: c.z, y: c.y, h: c.h }; tow.carrying = null; c.carriedBy = null; c.glide = true; J.e = { x: roadX(1) - RH - 0.6, z: J.bay.z }; }
    const u = smooth(1.3, 4.8, J.t);
    if (J.t > 1.2 && J.t < 5 && Math.floor(J.t * 4) !== Math.floor((J.t - dt) * 4)) Audio.burst(0.04, 700, 0.15, 'bandpass', 3);
    if (J.phase === 'load') { bedAnchor(tow, _anc); c.x = lerp(J.s.x, _anc.x, u); c.z = lerp(J.s.z, _anc.z, u); c.y = lerp(J.s.y, _anc.y, u) + Math.sin(u * Math.PI) * 0.25; c.h = J.s.h + angDiff(J.s.h, tow.h) * u; c.carryPitch = tow.bed.rotation.x * u; }
    else { const ey = groundH(J.e.x, J.e.z); c.x = lerp(J.s.x, J.e.x, u); c.z = lerp(J.s.z, J.e.z, u); c.y = lerp(J.s.y, ey, u) + Math.sin(u * Math.PI) * 0.3; c.h = J.s.h + angDiff(J.s.h, J.bay.h) * u; c.carryPitch = tow.bed.rotation.x * (1 - u); }
    c.vx = c.vz = c.vf = 0;
    if (J.t > 6.3) {
      tow.locked = false; tow.bedTilt = tow.bedSlide = 0;
      if (J.phase === 'load') {
        c.glide = false; c.carriedBy = tow; tow.carrying = c; J.phase = 'toGarage'; J.bay = freeBay(); J.bay.car = c;
        tow.ai.setDest(garage.road.x, J.bay.z + 3.6 + 1.6 - 7.5); store.stats.tows++;
        say(tow.driverP, 'بار زدیم! می‌ریم تعمیرگاه.', 3);
      } else {
        c.glide = false; c.locked = false; c.y = groundH(c.x, c.z); c.carryPitch = 0;
        if (!J.self) { tow.ai.clearDest(); }
        towJob = null; startValet(c, J.bay);
        if (Math.hypot(player.pos.x - c.x, player.pos.z - c.z) < 60) banner('ماشینت رسید تعمیرگاه', 'مکانیک داره می‌بردش داخل');
      }
    }
  } else if (J.phase === 'toGarage') { if (tow.ai && tow.ai.arrived) { J.phase = 'unload'; J.t = 0; J.s = null; } }
}
function boardTow() {
  const P = player; P.state = 'passenger'; P.car = tow; P.inCar = tow; tow.passengerP = P; P.anim.special = 'passenger'; P.anim.sw = 0; P.vel.set(0, 0, 0); Audio.door();
  if (!towJob) { if (!tow.ai) { tow.ai = new CarAI(tow, 1, 3, 0); tow.ai.resetFromPos(); } tow.ai.setDest(garage.road.x, garage.road.z); say(tow.driverP, 'سلام! بشین، می‌برمت تعمیرگاه.', 3); }
  else say(tow.driverP, 'کمربندت رو ببند، داریم می‌ریم!', 3);
}
function leaveTow() {
  const P = player, t = tow.T, s = Math.sin(tow.h), c = Math.cos(tow.h), lz = (t.cab[0] + t.cab[1]) / 2;
  tow.passengerP = null; P.inCar = null; P.state = 'foot'; P.car = null; P.anim.special = null;
  P.pos.set(tow.x - c * (t.wid / 2 + 0.7) + s * lz, 0, tow.z + s * (t.wid / 2 + 0.7) + c * lz); P.pos.y = groundH(P.pos.x, P.pos.z); P.facing = tow.h - Math.PI / 2; Audio.door();
  if (tow.ai && !towJob) tow.ai.clearDest();
}
function throwDriver() {
  const d = tow.driverP; if (!d) return;
  const n = ejectDriver(tow, false);
  if (n) { n.mode = 'down'; n.knockT = 0; n.onGround = false; const s = Math.sin(tow.h), c = Math.cos(tow.h); n.vel.set(c * 3.5, 3.2, -s * 3.5); n.persona.rel -= 4; n.persona.mood = 0.1; n.persona.mem.carTaken = true; say(n, mpick(['هوی!! چرا هلم دادی؟!', 'آی کمرم! یدک‌کشمو کجا می‌بری؟!', 'دزد! یدک‌کش تعمیرگاهو بردن!']), 3.5); }
  logEvent('یکی رانندهٔ یدک‌کش رو از ماشین انداخت پایین!');
  tow.passengerP = null; tow.ai = null; towJob = null; tow.blink = null;
  const P = player; P.state = 'car'; P.inCar = null; tow.setDriver(P); tow.player = true; tow.hasDriver = true; tow.inHand = false; P.car = tow; addCarLights(tow); Audio.door();
  banner('حالا یدک‌کش دست خودته!', tow.carrying ? 'ماشین روی یدک‌کش رو جلوی تعمیرگاه نگه دار تا تحویل بدی' : 'با احتیاط برون');
}
function goGarage(mode) {
  const b = garage.bays[0], pt = { name: 'تعمیرگاه مرکزی شهر', x: roadX(1) - RH - 2, z: 0 };
  if (mode === 'route') { setWaypoint(pt); return 'مسیر تعمیرگاه روی نقشه علامت خورد.'; }
  if (player.where !== 'out') return 'اول از ساختمان بیرون برو.';
  if (player.state === 'passenger') return 'الان مسافر یدک‌کشی!';
  if (player.state !== 'foot' && player.state !== 'car') return '';
  fadeTo(() => {
    if (player.state === 'car') { const c = player.car; c.x = roadX(1) - RH - 3.5; c.z = b.z; c.h = -Math.PI / 2; c.vx = c.vz = c.av = c.vf = 0; c.y = groundH(c.x, c.z); cam.yaw = c.h; }
    else { player.pos.set(roadX(1) - RH - 2.5, CURB, 1.5); player.vel.set(0, 0, 0); player.facing = -Math.PI / 2; cam.yaw = -Math.PI / 2; }
    banner('تعمیرگاه مرکزی شهر', player.state === 'car' ? 'ماشین رو ببر داخل یکی از جایگاه‌ها و نگه دار' : 'مکانیک‌ها داخل منتظرند');
  });
  return '';
}
function garageStatus() {
  const j = garage.job;
  if (j) return { gather: 'مکانیک‌ها دارند ماشین را آماده می‌کنند', raise: 'ماشین روی جک می‌رود بالا', work: `در حال تعمیر: ${fa(Math.round(j.car.health))}٪`, lower: 'ماشین دارد پایین می‌آید', done: 'تمام شد' }[j.phase];
  if (towJob) return towJob.phase === 'toCar' ? `یدک‌کش در راه است (${fa(Math.round(Math.hypot(tow.x - towJob.car.x, tow.z - towJob.car.z)))} متر)` : towJob.phase === 'toGarage' ? 'یدک‌کش ماشینت را به تعمیرگاه می‌برد' : 'در حال بار زدن ماشین';
  const c = player.state === 'car' ? player.car : player.lastCar;
  return c ? `سلامت ماشینت: ${fa(Math.round(c.health))}٪` : 'هنوز ماشینی نداری';
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
  { const x = X(roadX(1) - RH - 18), z = X(0); g.fillStyle = '#c2561a'; g.beginPath(); g.arc(x, z, 14, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 18px Vazirmatn, Tahoma'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ت', x, z + 1); }
  for (const f of world.fountains) { g.fillStyle = '#5aa6d6'; g.beginPath(); g.arc(X(f.x), X(f.z), 3.4 * s, 0, 7); g.fill(); }
  for (const [pl, cx, cz] of world.newPlaces) { const [col, ch] = { mall: ['#8a2a6a', 'پ'], gas: ['#1f7a4a', 'ب'], mosque: ['#1e5f9a', 'م'], school: ['#2a5aa8', 'د'], hospital: ['#c8202a', '+'] }[pl]; const x = X(cx), z = X(cz); g.fillStyle = col; g.beginPath(); g.arc(x, z, 14, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 18px Vazirmatn, Tahoma'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, x, z + 1); }
  mapBase = c;
}
function drawMap() {
  if (player.where === 'rb' || player.where === 'test') { drawZoneMap(); return; }
  const cvm = $('minimap'), g = cvm.getContext('2d'), W = cvm.width, s = 1024 / MAPW, zoom = 1.25;
  const px = player.where === 'out' ? (player.state === 'car' ? player.car.x : player.pos.x) : interior.door.x, pz = player.where === 'out' ? (player.state === 'car' ? player.car.z : player.pos.z) : interior.door.z;
  const rot = -Math.PI / 2 - Math.atan2(Math.cos(cam.yaw), Math.sin(cam.yaw));
  g.save(); g.fillStyle = '#2a3a24'; g.fillRect(0, 0, W, W);
  g.translate(W / 2, W / 2); g.rotate(rot); g.scale(zoom, zoom); g.translate(-(px + MAPW / 2) * s, -(pz + MAPW / 2) * s);
  g.drawImage(mapBase, 0, 0);
  const X = v => (v + MAPW / 2) * s;
  for (const c of cars) { if (c.player) continue; g.save(); g.translate(X(c.x), X(c.z)); g.rotate(-c.h); g.fillStyle = c.service === 'bus' ? '#3ad87a' : c.service === 'amb' ? (c.sirenOn && (simTime * 3) % 1 < 0.5 ? '#2a6aff' : '#ff4a4a') : c.taxi ? '#ffd23a' : c.ai ? '#e8e8e8' : '#9fb4c8'; g.fillRect(-c.T.wid * s / 2, -c.T.len * s / 2, c.T.wid * s, c.T.len * s); g.restore(); }
  g.fillStyle = '#ffcf7a'; for (const n of npcs) { if (n.mode === 'inside') continue; g.beginPath(); g.arc(X(n.pos.x), X(n.pos.z), 2.2, 0, 7); g.fill(); }
  if (tow) { g.save(); g.translate(X(tow.x), X(tow.z)); g.rotate(-tow.h); g.fillStyle = tow.beaconOn && (simTime * 3) % 1 < 0.5 ? '#ffd23a' : '#e2661c'; g.fillRect(-6, -10, 12, 20); g.restore(); }
  if (towJob && towJob.car) { g.strokeStyle = '#e2661c'; g.lineWidth = 3; g.beginPath(); g.arc(X(towJob.car.x), X(towJob.car.z), 9, 0, 7); g.stroke(); }
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
/* quality ladder: the game steps down automatically whenever frames get slow */
const LEVELS = ['potato', 'low', 'medium', 'high'];
let qLevel = 3, shadowEvery = 1, poseDist = 85, frameNo = 0, qCooldown = 0, fastWins = 0;
let composerAll = null;
// phones always draw straight to the screen, desktops always through the bloom chain:
// the path never changes while playing, so no shader is ever rebuilt mid-game
const USE_COMPOSER = !LOW;
function setupComposer() {
  if (!USE_COMPOSER) { composer = null; return; }
  if (!composerAll) {
    const size = renderer.getDrawingBufferSize(new V2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: renderer.capabilities.isWebGL2 ? (LOW ? 2 : 4) : 0 });
    composerAll = new EffectComposer(renderer, rt);
    renderPass = new RenderPass(scene, camera); composerAll.addPass(renderPass);
    composerAll.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main() { vec4 c = texture2D(tDiffuse, vUv); bool bad = !(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b) || c.r > 65000.0 || c.g > 65000.0 || c.b > 65000.0; gl_FragColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : min(c, vec4(48.0)); }' }));
    bloomPass = new UnrealBloomPass(new V2(innerWidth, innerHeight), 0.3, 0.45, 1.0); composerAll.addPass(bloomPass);
    composerAll.addPass(new OutputPass());
  }
  composerAll.setPixelRatio(pixelRatio); composerAll.setSize(innerWidth, innerHeight);
  composer = composerAll; bloomPass.enabled = qLevel >= 2;
}
function applyQuality(level) {
  if (level == null) level = settings.quality === 'auto' ? (LOW ? 2 : 3) : Math.max(0, LEVELS.indexOf(settings.quality));
  qLevel = level; const dpr = window.devicePixelRatio || 1;
  pixelRatio = Math.min(dpr, [0.7, 1, 1.25, LOW ? 1.6 : 2][level]);
  renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth, innerHeight);
  const sm = level === 3 ? 2048 : level === 0 ? 512 : 1024;
  if (sun.shadow.mapSize.x !== sm) { sun.shadow.mapSize.set(sm, sm); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  shadowEvery = [4, 3, 2, 1][level]; poseDist = [40, 55, 70, 85][level];
  for (const m of world.grassMeshes || []) m.visible = level >= 2;
  if (M.leaves) M.leaves.visible = level > 0;
  camera.far = level === 0 ? 520 : 1400; camera.updateProjectionMatrix();
  setupComposer();
}
// quality changes are queued and applied at the start of the next frame, right before it is drawn,
// so a resized canvas is never shown empty; going back up needs a long calm period (no ping-pong)
let pendingQ = null, pendingPR = null, lastDrop = -1e9, drops = 0;
function autoQuality(avg) {
  if (settings.quality !== 'auto') return false;
  qCooldown -= 1;
  if (avg > 1 / 40 && qLevel > 0 && qCooldown <= 0) { pendingQ = qLevel - 1; qCooldown = 3; fastWins = 0; lastDrop = simTime; drops++; toast('کیفیت گرافیک برای روان ماندن بازی خودکار کمی پایین آمد'); return true; }
  if (avg < 1 / 80 && drops < 3 && simTime - lastDrop > 90) { if (++fastWins >= 10 && qLevel < (LOW ? 2 : 3)) { pendingQ = qLevel + 1; fastWins = 0; qCooldown = 5; } } else fastWins = 0;
  return true;
}
function applyPending() {
  if (pendingQ !== null) { applyQuality(pendingQ); pendingQ = null; pendingPR = null; }
  if (pendingPR !== null) { pixelRatio = pendingPR; pendingPR = null; renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth, innerHeight); if (composer) { composer.setPixelRatio(pixelRatio); composer.setSize(innerWidth, innerHeight); } }
}
function toast(t) { const el = $('saved'); el.textContent = t; el.hidden = false; el.style.opacity = '1'; clearTimeout(toast.t); toast.t = setTimeout(() => { el.style.opacity = '0'; el.textContent = 'ذخیره شد'; }, 2600); }
addEventListener('resize', () => { if (composerAll && composer) { composerAll.setPixelRatio(pixelRatio); composerAll.setSize(innerWidth, innerHeight); } if (composer) { composer.setPixelRatio(pixelRatio); composer.setSize(innerWidth, innerHeight); } if (FX.pts) FX.pts.material.uniforms.uScale.value = renderer.domElement.height * 0.5; });
function updateWorld(dt) {
  simTime += dt; windUniform.value = simTime; skyUniforms.uTime.value = simTime;
  tod = (tod + dt * DAY_SPEED) % 24;
  updateWeather(dt);
  // obstacles for AI drivers
  _obs.length = 0;
  for (const c of cars) _obs.push({ x: c.x, z: c.z, r: c.T.len / 2 - 0.6, ref: c });
  if (player.where === 'out' && player.state === 'foot') _obs.push({ x: player.pos.x, z: player.pos.z, r: 0.5, player: true });
  for (const n of npcs) if (onRoad(n.pos.x, n.pos.z)) _obs.push({ x: n.pos.x, z: n.pos.z, r: 0.5 });
  for (const c of cars) {
    c.aiAcc = (c.aiAcc || 0) + dt;
    if (c.valet) updateValet(c, dt);
    else if (c.ai && !c.locked) { const far = Math.abs(c.x - camera.position.x) + Math.abs(c.z - camera.position.z) > 140; if (!far || frameNo % 2 === 0) { c.ai.update(Math.min(c.aiAcc, 0.1), _obs); c.aiAcc = 0; } }
    else if (!c.player) { c.inThrottle = 0; c.inSteer = 0; c.inHand = true; }
    if (c.closeT > 0) { c.closeT -= dt; if (c.closeT <= 0) { c.doorT = 0; Audio.door(); } }
  }
  const cp = camera.position;
  for (const c of cars) c.near = Math.abs(c.x - cp.x) + Math.abs(c.z - cp.z) < 110 || c.player;
  for (let s = 0; s < 3; s++) {
    for (const c of cars) { if (c.locked || c.carriedBy || c.glide || (s > 0 && !c.near)) continue; c.integrate(c.near ? dt / 3 : dt); carStatic(c); }
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) { const a = cars[i], b = cars[j]; if (s > 0 && !a.near && !b.near) continue; if (a.carriedBy || b.carriedBy || a.glide || b.glide || (a.locked && b.locked)) continue; const dx = a.x - b.x, dz = a.z - b.z, rs = (a.T.len + b.T.len) / 2; if (dx * dx + dz * dz > rs * rs) continue; const r = satCarCar(a, b); if (r) { if (a.locked) { b.x -= r.nx * r.depth; b.z -= r.nz * r.depth; } else if (b.locked) { a.x += r.nx * r.depth; a.z += r.nz * r.depth; } else carCarResolve(a, b, r); } }
  }
  for (const c of cars) {
    if (Math.abs(c.x) > BOUND + 5 || Math.abs(c.z) > BOUND + 5) { c.x = clamp(c.x, -BOUND + 3, BOUND - 3); c.z = clamp(c.z, -BOUND + 3, BOUND - 3); c.vx = c.vz = 0; }
    c.sync(dt); if (player.where === 'out') carEffects(c, dt);
  }
  updateTow(dt); updateRepair(dt); updateAmbulance(dt); updateBus(dt);
  updatePlayer(dt);
  const cp2 = camera.position;
  for (let i = 0; i < npcs.length; i++) {
    const n = npcs[i]; n.acc = (n.acc || 0) + dt;
    const far = Math.abs(n.pos.x - cp2.x) + Math.abs(n.pos.z - cp2.z) > 100 && n.mode !== 'down';
    if (far && (frameNo + i) % 3) continue;
    updateNPC(n, Math.min(n.acc, 0.15), true, world.col); n.acc = 0;
  }
  if (player.where === 'in') { for (const n of interior.npcs) updateNPC(n, dt, false, interior.col); updateInterior(dt); }
  if (player.where === 'rb') { updateRB(dt); updateBuild(dt); }
  if (player.where === 'out') updateBalloons(dt); updateFireworks(dt);
  if (player.where === 'test') updateTest(dt);
  updateInvites(dt);
  const people = player.state !== 'foot' ? (player.where === 'out' ? npcs : interior.npcs) : player.where === 'out' ? [player, ...npcs] : [player, ...interior.npcs];
  if (player.where === 'out' || player.where === 'in') separatePeople(people.filter(p => p.mode !== 'sit' && p.mode !== 'inside' && p.mode !== 'valet'));
  updateSignals(); updateFountain(dt); FX.update(dt); updateBirds(dt); updatePigeons(dt);
  updateMall(dt); updateSwings(dt); updateBalls(dt); updateFloaters(dt); updateEnergy(dt); updateSkate(dt);
  if (frameNo % 8 === 0) updateWalletHUD();
  // doors swing open for the player and for people walking in or out
  if (player.where === 'out') for (const d of world.doors) {
    if (d.npcOpen > 0) d.npcOpen -= dt;
    if (d.dead) continue;
    const dx = player.pos.x - d.x, dz = player.pos.z - d.z; if ((Math.abs(dx) > 30 || Math.abs(dz) > 30) && !(d.npcOpen > 0)) { d.want = 0; if (d.open > 0.001) { d.open = damp(d.open, 0, 3, dt); d.inner.rotation.y = -d.open * 1.4; } continue; }
    if (d.want) { const far = Math.hypot(dx, dz) > 4.5 || player.state !== 'foot'; d.closeT = far ? d.closeT + dt : 0; if (d.closeT > 3.5) { d.want = 0; if (Math.hypot(dx, dz) < 25) Audio.door(); } }
    const want = d.want ? 1 : d.npcOpen > 0 ? 0.8 : 0;
    d.open = damp(d.open, want, want ? 3.2 : 2.2, dt); d.inner.rotation.y = -d.open * 1.4;
  }
  if (portalMat) { portalMat.uniforms.uCam.value.copy(camera.position); portalMat.uniforms.uLamp.value = 0.55 + night * 0.65; portalMat.uniforms.uDay.value = dayF; }
  for (const w of waterMeshes) w.material.roughness = 0.04 + Math.sin(simTime * 3) * 0.02;
  if (wpMesh && wpMesh.visible) { wpMesh.userData.gem.rotation.y += dt * 2; wpMesh.userData.gem.position.y = 3.2 + Math.sin(simTime * 2.5) * 0.3; }
}
function syncVisuals(dt) {
  const camPos = camera.position;
  const showPeople = (p, outdoor) => {
    if (p.inCar) return;
    const H = p.H; const d = Math.hypot(p.pos.x - camPos.x, p.pos.z - camPos.z);
    if (outdoor) H.visible = d < 170 && p.mode !== 'inside';
    H.root.position.set(p.pos.x, p.pos.y, p.pos.z); H.root.rotation.set(0, p.facing, 0);
    if (H.visible && d < poseDist) poseHuman(p, dt, simTime);
  };
  for (const c of cars) {
    const cd = Math.hypot(c.x - camPos.x, c.z - camPos.z), lod = cd < 40 ? 0 : cd < 110 ? 1 : 2;
    c.group.visible = cd < 230;
    if (lod !== c.lod) { c.lod = lod; for (const m of c.lodNear) m.visible = lod === 0; for (const m of c.lodMid) m.visible = lod <= 1; }
    const dp = c.driverP; if (dp && !dp.isPlayer) { dp.H.visible = c.group.visible && player.where === 'out'; if (dp.H.visible && Math.hypot(c.x - camPos.x, c.z - camPos.z) < 70) poseHuman(dp, dt, simTime); }
  }
  for (const n of npcs) showPeople(n, true);
  for (const n of mall.npcs) if (n.H.visible) showPeople(n, true); for (const n of mall.staff) if (n.H.visible) showPeople(n, true);
  if (player.where === 'in') for (const n of interior.npcs) showPeople(n, false);
  const P = player, seated = P.inCar || (P.state === 'exiting' && P.exitT < 0.35);
  if (!seated) { P.H.root.position.copy(P.pos); P.H.root.rotation.set(0, P.facing, 0); }
  if (player.where === 'rb') for (const n of rb.people) showPeople(n, false);
  syncFlyer(dt);
  P.H.visible = !(P.state === 'hide' && P.hideSpot && P.hideSpot.kind === 'in'); poseHuman(P, dt, simTime);
  outdoorPool.update(); interiorPool.update(); if (rbPool && player.where === 'rb') rbPool.update(); if (testPool && player.where === 'test') testPool.update();
  updateBlobs(); updateAttachments(); updateCockpit(); updateHeadLights(); updateGuide(dt); updateStreaks(dt);
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
  const inCar = P.state === 'car' || P.state === 'passenger';
  if (P.state !== 'fly') { $('speedo').hidden = !inCar; if (inCar) { $('fuel-row').hidden = false; if ($('spdunit').textContent !== 'کیلومتر بر ساعت') $('spdunit').textContent = 'کیلومتر بر ساعت'; } }
  if (inCar) { $('fuel').style.width = (P.car.fuel ?? 100) + '%'; $('fuel').style.background = P.car.fuel > 20 ? 'var(--amber)' : 'var(--red)';
    const kmh = Math.round(Math.abs(P.car.vf) * 3.6); $('spd').textContent = fa(kmh); $('gear').textContent = P.car.vf < -0.5 ? 'R' : P.car.inHand ? 'P' : 'D'; $('health').style.width = P.car.health + '%'; $('health').style.background = P.car.health > 50 ? '#5fd3c3' : P.car.health > 20 ? '#ffb340' : '#ff5b4e'; }
  syncTouchUI();
  let label;
  if (P.where === 'in') label = interior.door.name;
  else if (P.where === 'rb') label = 'ساختمان رنگین‌کمان';
  else if (P.where === 'test') label = 'محیط آزمایشی';
  else if (!inCar && inMall(P.pos.x, P.pos.z)) label = P.inShop ? P.inShop.name : 'پاساژ آزادی · ' + (mallFloorAt(P.pos.y) ? 'طبقهٔ اول' : 'همکف');
  else label = streetAt(inCar ? P.car.x : P.pos.x, inCar ? P.car.z : P.pos.z);
  if ($('street').textContent !== label) $('street').textContent = label;
  const wp = $('wp');
  if (waypoint) { const d = Math.hypot(waypoint.x - P.pos.x, waypoint.z - P.pos.z); wp.hidden = false; wp.textContent = `${waypoint.name} · ${fa(Math.round(d))} متر`; } else wp.hidden = true;
  if (++mapTick % 3 === 0 && mapBase) drawMap();
  if (P.state === 'car') { const c = P.car; const rpm = (Math.abs(c.vf) % 14) / 14 * 0.6 + Math.abs(c.vf) / c.T.vmax * 0.6 + Math.abs(c.inThrottle) * 0.15; Audio.engine(c.health > 0, rpm, Math.max(0, c.inThrottle)); Audio.tyre((c.slip - 1.5) / 5 + (c.inHand && Math.abs(c.vf) > 3 ? 0.4 : 0)); }
}
function render() {
  const sc = player ? zoneScene(player.where) : scene;
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
  applyPending();
  frameNo++; if (frameNo % shadowEvery === 0 || player.state === 'fly' || (player.state === 'car' && Math.abs(player.car.vf) > 5) || Math.hypot(player.vel.x, player.vel.z) > 7.5) renderer.shadowMap.needsUpdate = true;
  readKeys(dt);
  updateWorld(dt);
  if (simTime - lastSave > 15) saveGame();
  updateCamera(dt);
  updateTimeOfDay();
  syncVisuals(dt);
  updateBubbles(dt);
  updateHUD(dt);
  render();
  // adaptive resolution
  frameAcc += dt; frameN++; perfT += dt;
  if (perfT > 2) { const avg = frameAcc / frameN; if (!autoQuality(avg) && avg > 0.036 && pixelRatio > 0.8) pendingPR = Math.max(0.8, pixelRatio - 0.15); frameAcc = 0; frameN = 0; perfT = 0; }
}
function updateWorldDemo(dt) {
  if (!restored) tod = 17.6; _obs.length = 0; for (const c of cars) _obs.push({ x: c.x, z: c.z, r: c.T.len / 2 - 0.6, ref: c });
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
  outdoorPool = new HumanPool(scene, LOW ? 76 : 110); interiorPool = new HumanPool(interiorScene, 4);
  buildCity(); buildMapBase();
  FX.init(); Skids.init(); buildRain(); buildBirds(); buildBlobs();
  setupPlayer();
  const sv = loadSave();
  if (sv) { try { restoreFromSave(sv); } catch (e) { console.error(e); } }
  if (!restored) { spawnTraffic(); spawnPeople(); }
  spawnGarageStaff(); buildPigeons(); spawnMallShoppers(); spawnSchoolKids(); spawnServices(); buildBalloons(); buildFireworks();
  if (restored) rebuildPlayerLook();
  setView(settings.view === 'first'); updateWalletHUD();
  if (restored) { $('play').textContent = 'ادامهٔ بازی'; $('newgame').hidden = false; const d = new Date(sv.time); $('load').textContent = 'بازی ذخیره‌شده پیدا شد: ' + fa(d.toLocaleString('fa-IR')); }
  if (data && typeof data.tod === 'number') tod = data.tod;
  initFixedLights(); buildRainbow(); buildTest();
  applyWeatherSetting(); applyQuality(); bakeEnvironments();
  try { // warm up every shader now instead of stalling the first time something appears
    const RT0 = composerAll ? composerAll.renderTarget1 : null; renderer.setRenderTarget(RT0); renderer.compile(scene, camera);
    if (player.where !== 'in') { const dd = world.doors.find(d => d.kind === 'shop' && !d.dead), dh = world.doors.find(d => d.kind === 'house' && !d.dead);
      for (const d of [dd, dh]) if (d) { buildInterior(d); renderer.setRenderTarget(RT0); renderer.compile(interiorScene, camera); renderer.setRenderTarget(null);
        const cp0 = camera.position.clone(), cq0 = camera.quaternion.clone(); camera.position.set(0, 1.6, interior.D / 2 - 0.8); camera.lookAt(0, 1.2, 0); renderer.shadowMap.needsUpdate = true; if (composerAll) { renderPass.scene = interiorScene; composerAll.render(); renderPass.scene = scene; } else renderer.render(interiorScene, camera); camera.position.copy(cp0); camera.quaternion.copy(cq0); for (const n of interior.npcs) if (n.persona && n.persona.met > 0) n.persona.met--; }
      for (const n of interior.npcs) interiorPool.detach(n); interior.npcs = []; }
    for (const zs of [rbScene, testScene]) { renderer.setRenderTarget(RT0); renderer.compile(zs, camera); renderer.setRenderTarget(null); }
    renderer.setRenderTarget(null); renderer.shadowMap.needsUpdate = true; render();
  } catch (e) { console.warn(e); }
  updateTimeOfDay();
  if (!restored) $('load').textContent = 'شهر آماده است.';
  $('play').disabled = false;
  window.__city = { rb, rbCanSee, balloons, fwk, startFireworks, rbX: { rbInLift, rbLiftGo, rbSetFloor, openLift, rbChangeFloor, rbBuildWindow, rbChunk, rbNearestCore, rbPath, toggleTurbo, RB_FH, RB_L, RB_W, RB_FLOORS, get core() { return rbCoreT; } }, rbScene, RB_TYPES, enterRB, leaveRB, rbStartGame, rbHide, rbUnhide, nearestSpot, startBuild, endBuild, placeNew, bdAct, fly, spawnFlyer, boardFlyer, runCode, openFlyPanel, closeFlyPanel, inviteNPC, get test() { return test; }, get amb() { return amb; }, get bus() { return bus; }, hospital, injure, boardBus, leaveBus, knockDown, mall, gas, swings, balls, ITEMS, addToCart, payAt, useHeld, hold, wear, consume, toggleView, setView, get cam() { return cam; }, toggleBag, enterThrough, exitThrough, startFuel, applyQuality, autoQuality, get qLevel() { return qLevel; }, get pigeons() { return pigeons; }, garage, get tow() { return tow; }, get towJob() { return towJob; }, callTow, goGarage, startUse, store, saveGame, loadSave, snapshot, scene, cars, npcs, player, world, camera, renderer, interior, chat, weather, settings, openChat, sendChat, closeChat, setWaypoint, places,
    step(n, dt = 1 / 30) { for (let i = 0; i < n; i++) { readKeys(dt); updateWorld(dt); updateCamera(dt); updateTimeOfDay(); syncVisuals(dt); updateBubbles(dt); updateHUD(dt); } }, render, get tod() { return tod; }, set tod(v) { tod = v; envTod = -99; } };
}
renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); toast('گرافیک گوشی لحظه‌ای قطع شد؛ در حال بازگشت…'); });
renderer.domElement.addEventListener('webglcontextrestored', () => { renderer.shadowMap.needsUpdate = true; envTod = -99; });
$('play').addEventListener('click', () => {
  if (resumeRB) { resumeRB = false; setTimeout(() => { try { enterRB(true); } catch (e) { console.error(e); } }, 50); }
  Audio.init(); started = true; $('start').classList.add('gone'); setTimeout(() => $('start').hidden = true, 650);
  $('minimap').hidden = false; $('topbar').hidden = false; if (IS_TOUCH) showTouchUI();
  try { if (IS_TOUCH && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { }); } catch (_) { }
  if (!restored) cam.yaw = Math.PI * 0.82; cam.target.set(player.pos.x, player.pos.y + 1.45, player.pos.z);
  if (!restored) { tod = 17.2; banner('شهر آزاد', 'به هر کسی نزدیک شو و با او حرف بزن · ماشین قرمز روبه‌رویت است'); }
  else { cam.target.set(player.pos.x, player.pos.y + 1.45, player.pos.z); banner('خوش برگشتی!', 'بازی از همان جایی که بودی ادامه دارد'); }
  envTod = -99; setTimeout(saveGame, 1500); if (store.worn.ears) Audio.music(true);
});
window.claude?.hot?.snapshot?.(() => ({ tod }));
$(IS_TOUCH ? 'ctrl-keys' : 'ctrl-touch').hidden = true;
requestAnimationFrame(frame);
Promise.resolve().then(() => window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {})).catch(err => { $('load').textContent = 'خطا در ساختن شهر: ' + err.message; console.error(err); });
