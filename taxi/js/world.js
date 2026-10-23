import * as THREE from 'three';
import {
  rand, rr, pick, fbm, noise2, hash2, clamp, lerp, smoothstep, canvasTexture, speckle, mergeByMaterial,
  SpatialHash, circleCol, boxCol, makeCanvas,
} from './util.js';
import { box, cyl, sphere, signTexture } from './models.js';

export const HALF = 2000;
export const GRID = [-400, -300, -200, -100, 0, 100, 200, 300, 400];
export const ROAD_W = 12;
export const LANE = 3;
const XN = ['شریعتی', 'سعدی', 'حافظ', 'فردوسی', 'ولیعصر', 'مولوی', 'نیما', 'سهروردی', 'پاسداران'];
const ZN = ['آزادی', 'انقلاب', 'جمهوری', 'بهار', 'کریمخان', 'نوروز', 'گلستان', 'لاله', 'یاس'];

export const REGION_NAMES = { city: 'شهر', forest: 'جنگل', desert: 'کویر', lake: 'کوهستان و دریاچه', farm: 'روستا و مزرعه' };
export function regionAt(x, z) {
  if (Math.abs(x) < 470 && Math.abs(z) < 470) return 'city';
  if (Math.abs(z) >= Math.abs(x)) return z < 0 ? 'forest' : 'desert';
  return x > 0 ? 'lake' : 'farm';
}
function regionWeights(x, z) {
  const ax = Math.abs(x), az = Math.abs(z);
  const city = 1 - smoothstep(430, 560, Math.max(ax, az));
  const ns = smoothstep(-90, 90, az - ax);
  const o = 1 - city;
  return {
    city,
    forest: z < 0 ? o * ns : 0,
    desert: z > 0 ? o * ns : 0,
    lake: x > 0 ? o * (1 - ns) : 0,
    farm: x < 0 ? o * (1 - ns) : 0,
  };
}

const HIGHWAYS = [
  { name: 'جاده جنگل', pts: [[0, -400], [0, -600], [60, -850], [-80, -1100], [40, -1350], [0, -1600], [-150, -1800]] },
  { name: 'جاده کلبه جنگلی', pts: [[60, -850], [350, -950], [650, -1150], [900, -1250]] },
  { name: 'جاده کویر', pts: [[0, 400], [0, 600], [-100, 850], [-50, 1100], [-250, 1400], [-300, 1750]] },
  { name: 'جاده واحه', pts: [[-50, 1100], [300, 1250], [700, 1350], [1100, 1500]] },
  { name: 'جاده کوهستان', pts: [[400, 0], [600, 0], [850, 80], [1100, -50], [1350, 100], [1650, 250]] },
  { name: 'جاده دریاچه', pts: [[1100, -50], [1150, -300], [1250, -550]] },
  { name: 'جاده روستا', pts: [[-400, 0], [-600, 0], [-850, -60], [-1100, 50], [-1400, 0], [-1700, -150]] },
  { name: 'جاده باغ انار', pts: [[-1100, 50], [-1150, 350], [-1300, 700]] },
  { name: 'کمربندی شمال شرق', pts: [[650, -1150], [900, -800], [1150, -300]] },
  { name: 'کمربندی جنوب غرب', pts: [[-250, 1400], [-700, 1200], [-1000, 950], [-1300, 700]] },
  { name: 'کمربندی شمال غرب', pts: [[-850, -60], [-900, -500], [-600, -900], [-80, -1100]] },
  { name: 'کمربندی جنوب شرق', pts: [[850, 80], [900, 500], [1000, 900], [700, 1350]] },
];

const PLACES = [
  { name: 'میدان شهر', x: 0, z: 0 },
  { name: 'بیمارستان مرکزی', x: 200, z: -300 },
  { name: 'دانشگاه', x: -300, z: -200 },
  { name: 'بازار بزرگ', x: -100, z: 300 },
  { name: 'ترمینال مسافربری', x: 300, z: 350 },
  { name: 'برج شهر', x: 50, z: -100 },
  { name: 'ایستگاه مترو', x: 100, z: 150 },
  { name: 'پارک لاله', x: -250, z: 0 },
  { name: 'سینما آزادی', x: -350, z: -400 },
  { name: 'روستای سبزدره', x: -150, z: -1800, decor: 'cabins' },
  { name: 'کلبه جنگلی', x: 900, z: -1250, decor: 'cabins' },
  { name: 'آبشار جنگل', x: 40, z: -1350, decor: 'rocks' },
  { name: 'کمپ جنگلی', x: 350, z: -950, decor: 'camp' },
  { name: 'دهکده چوبی', x: -600, z: -900, decor: 'cabins' },
  { name: 'شهرک کویری ریگزار', x: -300, z: 1750, decor: 'mud' },
  { name: 'واحه نخلستان', x: 1100, z: 1500, decor: 'oasis' },
  { name: 'کاروانسرای قدیمی', x: -100, z: 850, decor: 'caravan' },
  { name: 'چاه آب کویر', x: 300, z: 1250, decor: 'mudSmall' },
  { name: 'رصدخانه کویر', x: -700, z: 1200, decor: 'observatory' },
  { name: 'روستای کوهستانی', x: 1650, z: 250, decor: 'village' },
  { name: 'ساحل دریاچه', x: 1250, z: -550, decor: 'beach' },
  { name: 'پل سنگی', x: 1100, z: -50, decor: 'rocks' },
  { name: 'قهوه‌خانه بین‌راهی', x: 900, z: 500, decor: 'village' },
  { name: 'کلبه کوهستان', x: 1350, z: 100, decor: 'cabins' },
  { name: 'روستای باغستان', x: -1700, z: -150, decor: 'farmVillage' },
  { name: 'باغ انار', x: -1300, z: 700, decor: 'orchard' },
  { name: 'مزرعه گندم', x: -1100, z: 50, decor: 'farm' },
  { name: 'آسیاب بادی', x: -1400, z: 0, decor: 'windmill' },
  { name: 'دامداری', x: -900, z: -500, decor: 'farm' },
];

/* ---------- graph ---------- */
class Graph {
  constructor() {
    this.nodes = [];
    this.edges = [];
    this.hash = new Map();
  }
  addNode(x, z) {
    const k = Math.round(x) + ',' + Math.round(z);
    if (this.hash.has(k)) return this.hash.get(k);
    const n = { id: this.nodes.length, x, z, edges: [], city: Math.abs(x) <= 400.5 && Math.abs(z) <= 400.5 };
    this.nodes.push(n);
    this.hash.set(k, n.id);
    return n.id;
  }
  addEdge(a, b, road) {
    if (a === b) return -1;
    const A = this.nodes[a], B = this.nodes[b];
    const e = { id: this.edges.length, a, b, len: Math.hypot(B.x - A.x, B.z - A.z), road };
    this.edges.push(e);
    A.edges.push(e.id);
    B.edges.push(e.id);
    return e.id;
  }
  other(e, n) {
    return e.a === n ? e.b : e.a;
  }
}

/* ---------- textures ---------- */
function roadTexture(kind) {
  return canvasTexture(256, 512, (g, w, h) => {
    speckle(g, w, h, kind === 'patch' ? '#3b3d40' : '#3a3c3f', 0.09, 9000, 2);
    for (let i = 0; i < 25; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
      g.beginPath();
      g.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 40, 30 + Math.random() * 80, 0, 0, 6.28);
      g.fill();
    }
    if (kind === 'patch') return;
    g.fillStyle = '#e8e8e2';
    g.fillRect(9, 0, 6, h);
    g.fillRect(w - 15, 0, 6, h);
    g.fillStyle = kind === 'highway' ? '#e6c040' : '#efefe8';
    if (kind === 'highway') {
      g.fillRect(w / 2 - 7, 0, 4, h);
      g.fillRect(w / 2 + 3, 0, 4, h);
    } else {
      g.fillRect(w / 2 - 3, 0, 6, h * 0.42);
    }
  }, { repeat: [1, 1] });
}
function grainTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const id = g.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const n = noise2(x / 6, y / 6) * 0.5 + noise2(x / 2.1, y / 2.1) * 0.3 + Math.random() * 0.2;
        const v = 190 + n * 65;
        const i = (y * w + x) * 4;
        id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
        id.data[i + 3] = 255;
      }
    g.putImageData(id, 0, 0);
  }, { repeat: [1, 1] });
}
function sidewalkTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    speckle(g, w, h, '#a9a49a', 0.08, 3000, 2);
    g.strokeStyle = 'rgba(60,55,50,0.45)';
    g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke();
    }
  }, { repeat: [1, 1] });
}
function grassTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    speckle(g, w, h, '#5d7d3a', 0.15, 9000, 2);
  }, { repeat: [1, 1] });
}
function crosswalkTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(240,240,232,0.92)';
    for (let i = 0; i < 6; i++) g.fillRect(4 + i * 21, 0, 12, h);
  });
}
const FACADES = [
  { wall: '#cdb89b', glass: '#4a6378', frame: '#f0ebe0' },
  { wall: '#e4e2dc', glass: '#5d7d96', frame: '#9aa0a6' },
  { wall: '#a35f47', glass: '#3c4c5c', frame: '#e8dccb' },
  { wall: '#8c9196', glass: '#2e3e4e', frame: '#6a6e72', strip: true },
  { wall: '#3d5c7a', glass: '#6c96b8', frame: '#2a3a48', tower: true },
  { wall: '#d8c9a8', glass: '#56707f', frame: '#7a5a3a' },
];
function facadeTextures(f) {
  const lit = [];
  for (let i = 0; i < 16; i++) lit.push(Math.random() < 0.38);
  const draw = (g, w, h, emissive) => {
    g.fillStyle = emissive ? '#000' : f.wall;
    g.fillRect(0, 0, w, h);
    if (!emissive) {
      for (let i = 0; i < 1600; i++) {
        g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }
    const cw = w / 4, ch = h / 4;
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const on = lit[i * 4 + j];
        let x, y, ww, hh;
        if (f.tower) { x = i * cw + 2; y = j * ch + 2; ww = cw - 4; hh = ch - 6; }
        else if (f.strip) { x = i * cw; y = j * ch + ch * 0.3; ww = cw; hh = ch * 0.45; }
        else { x = i * cw + cw * 0.2; y = j * ch + ch * 0.22; ww = cw * 0.6; hh = ch * 0.56; }
        if (emissive) {
          g.fillStyle = on ? (Math.random() < 0.3 ? '#bcd6ff' : '#ffd79a') : '#000';
          g.fillRect(x, y, ww, hh);
        } else {
          g.fillStyle = f.frame;
          g.fillRect(x - 3, y - 3, ww + 6, hh + 6);
          const gr = g.createLinearGradient(x, y, x + ww, y + hh);
          gr.addColorStop(0, f.glass);
          gr.addColorStop(1, '#1a2430');
          g.fillStyle = gr;
          g.fillRect(x, y, ww, hh);
          g.fillStyle = 'rgba(255,255,255,0.12)';
          g.fillRect(x, y, ww * 0.35, hh);
          if (!f.tower && !f.strip) {
            g.fillStyle = f.frame;
            g.fillRect(x + ww / 2 - 1, y, 2, hh);
          }
        }
      }
  };
  const map = canvasTexture(256, 256, (g, w, h) => draw(g, w, h, false), { repeat: [1, 1] });
  const em = canvasTexture(256, 256, (g, w, h) => draw(g, w, h, true), { repeat: [1, 1] });
  return { map, em };
}
function shopSignAtlas() {
  const names = ['سوپرمارکت', 'نانوایی', 'کافه', 'داروخانه', 'کتاب‌فروشی', 'رستوران', 'میوه‌فروشی', 'لوازم خانگی'];
  const cols = ['#c0392b', '#d68910', '#6c3483', '#1e8449', '#1f618d', '#a04000', '#239b56', '#2e4053'];
  return canvasTexture(1024, 512, (g) => {
    for (let i = 0; i < 8; i++) {
      const x = (i % 2) * 512, y = Math.floor(i / 2) * 128;
      g.fillStyle = cols[i];
      g.fillRect(x, y, 512, 128);
      g.fillStyle = 'rgba(255,255,255,0.15)';
      g.fillRect(x, y, 512, 10);
      g.fillStyle = '#fff';
      g.font = 'bold 70px Vazirmatn, Tahoma, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(names[i], x + 256, y + 68);
    }
  });
}
function billboardTexture(i) {
  const ads = [
    ['بستنی شاد', 'خنک‌ترین تابستون!', '#ff7eb3', '#7a1f4a'],
    ['بیمه رانندگان', 'با خیال راحت برون', '#2e86de', '#0b2a4a'],
    ['چای ایرانی', 'یه استکان آرامش', '#c0392b', '#3a0f0a'],
    ['سفر به کویر', 'شب‌های پرستاره', '#e67e22', '#3a1f05'],
    ['لاستیک محکم', 'جاده رو حس کن', '#2c3e50', '#111'],
    ['کمربند ایمنی', 'جان شما مهم است', '#27ae60', '#0a2a14'],
  ];
  const a = ads[i % ads.length];
  return canvasTexture(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, a[2]);
    gr.addColorStop(1, a[3]);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.font = 'bold 76px Vazirmatn, Tahoma, sans-serif';
    g.fillText(a[0], w / 2, 120);
    g.font = '40px Vazirmatn, Tahoma, sans-serif';
    g.fillText(a[1], w / 2, 195);
  });
}
function waterNormalTexture() {
  const s = 256;
  return canvasTexture(s, s, (g) => {
    const hgt = new Float32Array(s * s);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        hgt[y * s + x] =
          Math.sin((x / s) * Math.PI * 8 + Math.sin((y / s) * Math.PI * 4) * 1.5) * 0.5 +
          Math.sin((y / s) * Math.PI * 12 + (x / s) * Math.PI * 6) * 0.3 +
          Math.sin(((x + y) / s) * Math.PI * 18) * 0.2;
      }
    const id = g.createImageData(s, s);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const dx = hgt[y * s + ((x + 1) % s)] - hgt[y * s + ((x - 1 + s) % s)];
        const dy = hgt[((y + 1) % s) * s + x] - hgt[((y - 1 + s) % s) * s + x];
        const v = new THREE.Vector3(-dx * 1.2, -dy * 1.2, 1).normalize();
        const i = (y * s + x) * 4;
        id.data[i] = (v.x * 0.5 + 0.5) * 255;
        id.data[i + 1] = (v.y * 0.5 + 0.5) * 255;
        id.data[i + 2] = (v.z * 0.5 + 0.5) * 255;
        id.data[i + 3] = 255;
      }
    g.putImageData(id, 0, 0);
  }, { repeat: [30, 30], srgb: false });
}

/* ---------- vegetation geometries (vertex colored) ---------- */
function colorize(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) {
    const v = 0.88 + Math.random() * 0.24;
    arr[i] = c.r * v; arr[i + 1] = c.g * v; arr[i + 2] = c.b * v;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
function mergeColored(parts) {
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    if (!p.attributes.normal) p.computeVertexNormals();
    pos.set(p.attributes.position.array, o * 3);
    nor.set(p.attributes.normal.array, o * 3);
    col.set(p.attributes.color.array, o * 3);
    o += p.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}
function tg(geo, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
  return geo.applyMatrix4(m);
}
function vegGeos() {
  const pine = mergeColored([
    colorize(tg(new THREE.CylinderGeometry(0.16, 0.3, 2.6, 6), 0, 1.3, 0), 0x5a3a22),
    colorize(tg(new THREE.ConeGeometry(2.3, 3.4, 8), 0, 3.4, 0), 0x2c4a22),
    colorize(tg(new THREE.ConeGeometry(1.75, 2.9, 8), 0, 5.0, 0, 0, 0.4), 0x335a28),
    colorize(tg(new THREE.ConeGeometry(1.1, 2.3, 8), 0, 6.5, 0, 0, 0.9), 0x3b6a2e),
  ]);
  const broad = mergeColored([
    colorize(tg(new THREE.CylinderGeometry(0.18, 0.3, 3, 6), 0, 1.5, 0), 0x5e4630),
    colorize(tg(new THREE.IcosahedronGeometry(2.3, 1), 0, 4.4, 0), 0x4f7a2e),
    colorize(tg(new THREE.IcosahedronGeometry(1.6, 1), 1.2, 3.8, 0.6), 0x5a8a34),
    colorize(tg(new THREE.IcosahedronGeometry(1.5, 1), -1.1, 4.0, -0.5), 0x46702a),
  ]);
  const palmParts = [];
  for (let i = 0; i < 4; i++) palmParts.push(colorize(tg(new THREE.CylinderGeometry(0.2 - i * 0.02, 0.24 - i * 0.02, 1.9, 7), i * 0.12, 0.95 + i * 1.85, 0, 0, 0, -0.06 * i), 0x8a6a44));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const leaf = tg(new THREE.BoxGeometry(0.5, 0.06, 3.2), 0, 0, 1.5);
    tg(leaf, 0, 0, 0, 0.45, 0, 0);
    tg(leaf, 0.4, 7.6, 0, 0, a, 0);
    palmParts.push(colorize(leaf, 0x4f8a2e));
  }
  const palm = mergeColored(palmParts);
  const cactus = mergeColored([
    colorize(tg(new THREE.CapsuleGeometry(0.32, 3.2, 3, 8), 0, 1.9, 0), 0x4e7a3a),
    colorize(tg(new THREE.CapsuleGeometry(0.2, 1.1, 3, 6), 0.75, 2.4, 0), 0x4e7a3a),
    colorize(tg(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 6), 0.45, 1.9, 0, 0, 0, Math.PI / 2), 0x4e7a3a),
    colorize(tg(new THREE.CapsuleGeometry(0.18, 0.8, 3, 6), -0.65, 2.0, 0), 0x4e7a3a),
    colorize(tg(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 6), -0.4, 1.6, 0, 0, 0, Math.PI / 2), 0x4e7a3a),
  ]);
  const rockG = new THREE.DodecahedronGeometry(1, 1);
  const p = rockG.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 0.75 + noise2(p.getX(i) * 3 + 5, p.getZ(i) * 3 + p.getY(i) * 2) * 0.5;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k);
  }
  rockG.computeVertexNormals();
  const rock = mergeColored([colorize(rockG, 0x8a8278)]);
  const bush = mergeColored([colorize(tg(new THREE.IcosahedronGeometry(0.9, 1), 0, 0.5, 0), 0x55702e), colorize(tg(new THREE.IcosahedronGeometry(0.7, 0), 0.6, 0.4, 0.3), 0x60802e)]);
  const dry = mergeColored([colorize(tg(new THREE.IcosahedronGeometry(0.6, 0), 0, 0.35, 0), 0x9a8a55)]);
  const hay = mergeColored([colorize(tg(new THREE.CylinderGeometry(1.4, 1.5, 1.6, 12), 0, 0.8, 0), 0xd9b85a), colorize(tg(new THREE.ConeGeometry(1.45, 0.9, 12), 0, 2.05, 0), 0xcaa850)]);
  const cypress = mergeColored([
    colorize(tg(new THREE.CylinderGeometry(0.15, 0.22, 1.2, 6), 0, 0.6, 0), 0x5a3a22),
    colorize(tg(new THREE.CapsuleGeometry(0.9, 6, 4, 8), 0, 4.2, 0), 0x2a4a26),
  ]);
  return { pine, broad, palm, cactus, rock, bush, dry, hay, cypress };
}
const TRUNK_R = { pine: 0.45, broad: 0.45, palm: 0.4, cactus: 0.45, rock: 0.9, bush: 0, dry: 0, hay: 1.4, cypress: 0.4 };

/* =========================================================
   World
   ========================================================= */
export class World {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.quality = opts.quality || 'high';
    this.statics = new SpatialHash(24);
    this.group = new THREE.Group();
    scene.add(this.group);
    this.graph = new Graph();
    this.roads = [];
    this.flats = [];
    this.stations = [];
    this.garages = [];
    this.speedCams = [];
    this.lightNodes = [];
    this.billboards = [];
    this.nightMats = [];
    this.waterMats = [];
    this.scatter = new Map();
    this.veg = vegGeos();
    this.vegMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });

    this.buildRoads();
    this.buildRoadDistance();
    this.places = PLACES.map((p) => this.makePlace(p));
    this.setupStations();
    this.buildHeights();
    this.buildTerrain();
    this.buildRoadMeshes();
    this.buildCity();
    this.buildStations();
    this.buildRegions();
    this.buildLamps();
    this.buildTrafficLights();
    this.buildRoadside();
    this.finishScatter();
    this.buildMinimapBase();
  }

  /* ---------- roads & graph ---------- */
  buildRoads() {
    const G = this.graph;
    for (let i = 0; i < GRID.length; i++) {
      const x = GRID[i];
      const road = { name: 'خیابان ' + XN[i], type: 'city', pts: GRID.map((z) => ({ x, z })), axis: 'z' };
      this.roads.push(road);
      for (let j = 0; j < GRID.length - 1; j++) G.addEdge(G.addNode(x, GRID[j]), G.addNode(x, GRID[j + 1]), road);
    }
    for (let j = 0; j < GRID.length; j++) {
      const z = GRID[j];
      const road = { name: 'خیابان ' + ZN[j], type: 'city', pts: GRID.map((x) => ({ x, z })), axis: 'x' };
      this.roads.push(road);
      for (let i = 0; i < GRID.length - 1; i++) G.addEdge(G.addNode(GRID[i], z), G.addNode(GRID[i + 1], z), road);
    }
    for (const h of HIGHWAYS) {
      const curve = new THREE.CatmullRomCurve3(h.pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.5);
      const n = h.pts.length - 1;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const [ax, az] = h.pts[i], [bx, bz] = h.pts[i + 1];
        const m = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 22));
        for (let k = 0; k < m; k++) {
          if (k === 0) pts.push({ x: ax, z: az });
          else {
            const v = curve.getPoint((i + k / m) / n);
            pts.push({ x: Math.round(v.x * 100) / 100, z: Math.round(v.z * 100) / 100 });
          }
        }
      }
      const last = h.pts[n];
      pts.push({ x: last[0], z: last[1] });
      const road = { name: h.name, type: 'highway', pts };
      this.roads.push(road);
      for (let i = 0; i < pts.length - 1; i++) G.addEdge(G.addNode(pts[i].x, pts[i].z), G.addNode(pts[i + 1].x, pts[i + 1].z), road);
    }
    for (const n of G.nodes) n.inter = n.edges.length >= 3;
  }

  buildRoadDistance() {
    const N = (this.dN = 1000);
    const C = (this.dCell = 4);
    const d = (this.dist = new Uint8Array(N * N).fill(255));
    const R = 64;
    for (const r of this.roads) {
      for (let s = 0; s < r.pts.length - 1; s++) {
        const a = r.pts[s], b = r.pts[s + 1];
        const minx = Math.min(a.x, b.x) - R, maxx = Math.max(a.x, b.x) + R;
        const minz = Math.min(a.z, b.z) - R, maxz = Math.max(a.z, b.z) + R;
        const i0 = clamp(Math.floor((minx + HALF) / C), 0, N - 1), i1 = clamp(Math.floor((maxx + HALF) / C), 0, N - 1);
        const j0 = clamp(Math.floor((minz + HALF) / C), 0, N - 1), j1 = clamp(Math.floor((maxz + HALF) / C), 0, N - 1);
        const abx = b.x - a.x, abz = b.z - a.z, l2 = abx * abx + abz * abz || 1;
        for (let j = j0; j <= j1; j++) {
          const pz = j * C - HALF + C / 2;
          for (let i = i0; i <= i1; i++) {
            const px = i * C - HALF + C / 2;
            const t = clamp(((px - a.x) * abx + (pz - a.z) * abz) / l2, 0, 1);
            const dx = px - a.x - abx * t, dz = pz - a.z - abz * t;
            const dd = Math.min(255, Math.sqrt(dx * dx + dz * dz));
            const k = j * N + i;
            if (dd < d[k]) d[k] = dd;
          }
        }
      }
    }
  }
  roadDist(x, z) {
    const i = Math.floor((x + HALF) / this.dCell), j = Math.floor((z + HALF) / this.dCell);
    if (i < 0 || j < 0 || i >= this.dN || j >= this.dN) return 255;
    return this.dist[j * this.dN + i];
  }

  /* ---------- terrain ---------- */
  rawHeight(x, z) {
    const w = regionWeights(x, z);
    let h = 0;
    if (w.forest) h += w.forest * (fbm(x / 220, z / 220, 4) * 18 - 5);
    if (w.desert) {
      const dn = fbm(x / 110 + 3, z / 170 - 7, 3);
      const ridge = 1 - Math.abs(dn * 2 - 1);
      h += w.desert * (ridge * ridge * 10 + fbm(x / 400, z / 400, 2) * 5 - 2);
    }
    if (w.lake) h += w.lake * (fbm(x / 260, z / 260, 4) * 24 - 5 + Math.max(0, x - 1450) * 0.3 * fbm(x / 90, z / 90, 3));
    if (w.farm) h += w.farm * (fbm(x / 300, z / 300, 3) * 4 - 1);
    const e = Math.max(Math.abs(x), Math.abs(z)) - 1760;
    if (e > 0) h += e * e * 0.0022 * (0.55 + 0.9 * fbm(x / 120, z / 120, 4));
    const ld = Math.hypot(x - 1350, z + 750);
    if (ld < 320) h = lerp(h, -7, 1 - smoothstep(170, 300, ld));
    const pd = Math.hypot(x - 1160, z - 1525);
    if (pd < 60) h = lerp(h, -2.5, 1 - smoothstep(16, 42, pd));
    return h;
  }
  buildHeights() {
    const N = (this.hN = 256);
    const C = (this.hCell = (HALF * 2) / N);
    const H = (this.heights = new Float32Array((N + 1) * (N + 1)));
    for (let j = 0; j <= N; j++)
      for (let i = 0; i <= N; i++) {
        const x = i * C - HALF, z = j * C - HALF;
        let h = this.rawHeight(x, z);
        const rd = this.roadDist(x, z);
        let f = smoothstep(14, 50, rd);
        for (const fl of this.flats) {
          const d = Math.hypot(x - fl.x, z - fl.z);
          if (d < fl.r + 30) f = Math.min(f, smoothstep(fl.r, fl.r + 30, d));
        }
        H[j * (N + 1) + i] = lerp(-0.08, h, f);
      }
  }
  heightAt(x, z) {
    const N = this.hN, C = this.hCell;
    const fx = clamp((x + HALF) / C, 0, N - 0.001), fz = clamp((z + HALF) / C, 0, N - 0.001);
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const H = this.heights, W = N + 1;
    // match triangle split of PlaneGeometry-like grid (a-b-d / b-c-d)
    const h00 = H[j * W + i], h10 = H[j * W + i + 1], h01 = H[(j + 1) * W + i], h11 = H[(j + 1) * W + i + 1];
    let h;
    if (tx + tz <= 1) h = h00 + (h10 - h00) * tx + (h01 - h00) * tz;
    else h = h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
    if (this.roadDist(x, z) < 8) h = Math.max(h, 0.02);
    return h;
  }
  surfaceAt(x, z) {
    if (this.roadDist(x, z) < 7.5) return 'road';
    if (Math.abs(x) < 410 && Math.abs(z) < 410) return 'pave';
    const r = regionAt(x, z);
    return r === 'desert' ? 'sand' : r === 'city' ? 'grass' : 'grass';
  }
  buildTerrain() {
    const N = this.hN, C = this.hCell, W = N + 1;
    const pos = new Float32Array(W * W * 3), col = new Float32Array(W * W * 3), uv = new Float32Array(W * W * 2);
    const c = new THREE.Color(), t = new THREE.Color();
    const COL = {
      city: new THREE.Color('#6f8250'), forest: new THREE.Color('#3d5c2b'), desert: new THREE.Color('#d7b678'),
      lake: new THREE.Color('#5d7838'), farm: new THREE.Color('#86964c'),
    };
    const FIELDS = ['#c9b35a', '#6f9a3a', '#7a5a3a', '#a4a85a', '#d4c070', '#5f8a30'].map((h) => new THREE.Color(h));
    const rock = new THREE.Color('#7d756b'), snow = new THREE.Color('#f2f4f6'), dirt = new THREE.Color('#7b6f58'), sandW = new THREE.Color('#c8b07a');
    for (let j = 0; j <= N; j++)
      for (let i = 0; i <= N; i++) {
        const k = j * W + i;
        const x = i * C - HALF, z = j * C - HALF;
        const h = this.heights[k];
        pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
        uv[k * 2] = x / 9; uv[k * 2 + 1] = z / 9;
        const w = regionWeights(x, z);
        c.setRGB(0, 0, 0);
        for (const key in COL) if (w[key]) c.add(t.copy(COL[key]).multiplyScalar(w[key]));
        if (w.farm > 0.3) {
          const fc = FIELDS[Math.floor(hash2(Math.floor(x / 80), Math.floor(z / 80)) * FIELDS.length)];
          c.lerp(fc, w.farm * 0.85);
        }
        const n = fbm(x / 40, z / 40, 3);
        c.multiplyScalar(0.82 + n * 0.36);
        const rd = this.roadDist(x, z);
        if (rd < 16 && !(Math.abs(x) < 470 && Math.abs(z) < 470)) c.lerp(w.desert > 0.5 ? sandW : dirt, (1 - smoothstep(8, 16, rd)) * 0.7);
        // slope
        const hx = this.heights[j * W + Math.min(N, i + 1)] - this.heights[j * W + Math.max(0, i - 1)];
        const hz = this.heights[Math.min(N, j + 1) * W + i] - this.heights[Math.max(0, j - 1) * W + i];
        const slope = Math.hypot(hx, hz) / (2 * C);
        c.lerp(rock, smoothstep(0.35, 0.8, slope));
        if (h > 70) c.lerp(snow, smoothstep(70, 120, h + n * 25) * 0.85);
        if (h < -0.6) c.lerp(new THREE.Color('#9a8a62'), 0.8);
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      }
    const idx = [];
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const a = j * W + i, b = a + 1, d = a + W, e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: grainTexture(), roughness: 0.97 });
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.terrain = mesh;

    // water
    const wn = waterNormalTexture();
    const water = new THREE.MeshStandardMaterial({ color: 0x2a6a88, roughness: 0.06, metalness: 0.25, normalMap: wn, normalScale: new THREE.Vector2(0.5, 0.5), transparent: true, opacity: 0.88 });
    this.waterMats.push(water);
    const lake = new THREE.Mesh(new THREE.CircleGeometry(300, 64), water);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(1350, -1.3, -750);
    this.group.add(lake);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(40, 32), water);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(1160, -0.7, 1525);
    this.group.add(pond);
    this.waterNormal = wn;
  }

  /* ---------- road meshes ---------- */
  buildRoadMeshes() {
    const mats = {
      city: new THREE.MeshStandardMaterial({ map: roadTexture('city'), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      highway: new THREE.MeshStandardMaterial({ map: roadTexture('highway'), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      patch: new THREE.MeshStandardMaterial({ map: roadTexture('patch'), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    };
    this.roadMats = mats;
    const buckets = { city: [], highway: [] };
    for (const r of this.roads) {
      if (r.type === 'city') {
        // split per segment so intersections don't stretch markings
        for (let i = 0; i < r.pts.length - 1; i++) buckets.city.push(ribbon([r.pts[i], r.pts[i + 1]], ROAD_W, 10, 0.02));
      } else buckets.highway.push(ribbon(r.pts, ROAD_W + 1, 10, 0.02));
    }
    for (const k in buckets) {
      const m = new THREE.Mesh(mergePlain(buckets[k]), mats[k]);
      m.receiveShadow = true;
      this.group.add(m);
    }
    // intersection patches + crosswalks
    const patches = [], walks = [];
    for (const n of this.graph.nodes) {
      if (!n.inter) continue;
      if (n.city) {
        patches.push(quadXZ(n.x - 6.5, n.z - 6.5, n.x + 6.5, n.z + 6.5, 0.03));
        for (const e of n.edges) {
          const ed = this.graph.edges[e];
          const o = this.graph.nodes[this.graph.other(ed, n.id)];
          const dx = Math.sign(o.x - n.x), dz = Math.sign(o.z - n.z);
          const cx = n.x + dx * 9, cz = n.z + dz * 9;
          if (dx) walks.push(quadXZ(cx - 1.6, cz - 5.6, cx + 1.6, cz + 5.6, 0.035, true));
          else walks.push(quadXZ(cx - 5.6, cz - 1.6, cx + 5.6, cz + 1.6, 0.035));
        }
      } else {
        const g = new THREE.CircleGeometry(10, 20);
        g.rotateX(-Math.PI / 2);
        g.translate(n.x, 0.03, n.z);
        patches.push(g.toNonIndexed());
      }
    }
    const pm = new THREE.Mesh(mergePlain(patches), mats.patch);
    pm.receiveShadow = true;
    this.group.add(pm);
    const wm = new THREE.Mesh(mergePlain(walks), new THREE.MeshStandardMaterial({ map: crosswalkTexture(), transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, depthWrite: false }));
    wm.receiveShadow = true;
    this.group.add(wm);
  }

  /* ---------- places & stations ---------- */
  nearestEdge(x, z, filter) {
    let best = null, bd = Infinity;
    const G = this.graph;
    for (const e of G.edges) {
      if (filter && !filter(e)) continue;
      const a = G.nodes[e.a], b = G.nodes[e.b];
      const abx = b.x - a.x, abz = b.z - a.z;
      const t = clamp(((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz || 1), 0, 1);
      const px = a.x + abx * t, pz = a.z + abz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < bd) {
        bd = d;
        best = { edge: e, t, x: px, z: pz, dist: d, dx: abx / e.len, dz: abz / e.len };
      }
    }
    return best;
  }
  roadside(ne, side = 1, off = 8.5) {
    // right normal of edge direction
    const rx = -ne.dz * side, rz = ne.dx * side;
    return { x: ne.x + rx * off, z: ne.z + rz * off, nx: rx, nz: rz };
  }
  makePlace(p) {
    const ne = this.nearestEdge(p.x, p.z);
    const rs = this.roadside(ne, 1, 9);
    const region = regionAt(p.x, p.z);
    if (region !== 'city') this.flats.push({ x: rs.x + rs.nx * 25, z: rs.z + rs.nz * 25, r: 40 });
    return { ...p, region, x: rs.x, z: rs.z, roadX: ne.x, roadZ: ne.z, nx: rs.nx, nz: rs.nz, edge: ne.edge, road: ne.edge.road.name };
  }
  setupStations() {
    const blockPad = (bi, bj, side, kind, name) => {
      const x0 = GRID[bi], x1 = GRID[bi + 1], z0 = GRID[bj], z1 = GRID[bj + 1];
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      let x = cx, z = cz, rot = 0;
      if (side === '+z') { z = z1 - 24; rot = 0; }
      if (side === '-z') { z = z0 + 24; rot = Math.PI; }
      if (side === '+x') { x = x1 - 24; rot = Math.PI / 2; }
      if (side === '-x') { x = x0 + 24; rot = -Math.PI / 2; }
      return { kind, name, x, z, rot, block: bi + ',' + bj };
    };
    this.special = new Map();
    const list = [
      blockPad(5, 2, '+z', 'gas', 'پمپ بنزین مرکزی'),
      blockPad(1, 5, '+x', 'gas', 'پمپ بنزین غرب شهر'),
      blockPad(2, 4, '-z', 'garage', 'تعمیرگاه اوستا رضا'),
      blockPad(6, 6, '-x', 'police', 'کلانتری مرکزی'),
    ];
    const outer = [
      [10, -700, 'gas', 'پمپ بنزین جاده جنگل'], [-60, 1000, 'gas', 'پمپ بنزین جاده کویر'], [720, 40, 'gas', 'پمپ بنزین جاده کوهستان'],
      [-720, -40, 'gas', 'پمپ بنزین جاده روستا'], [500, 1310, 'gas', 'پمپ بنزین واحه'], [-1000, 950, 'gas', 'پمپ بنزین کمربندی'],
      [600, -1080, 'gas', 'پمپ بنزین جنگل شرقی'], [-260, 1560, 'garage', 'تعمیرگاه کویر'],
    ];
    for (const [x, z, kind, name] of outer) {
      const ne = this.nearestEdge(x, z, (e) => e.road.type === 'highway');
      const rs = this.roadside(ne, 1, 26);
      const rot = Math.atan2(-rs.nx, -rs.nz);
      list.push({ kind, name, x: rs.x, z: rs.z, rot });
      this.flats.push({ x: rs.x, z: rs.z, r: 30 });
    }
    for (const s of list) {
      if (s.block) this.special.set(s.block, s);
      if (s.kind === 'gas') this.stations.push(s);
      else if (s.kind === 'garage') this.garages.push(s);
      else this.police = s;
    }
    this.extraSpecial = new Map([['3,3', 'park'], ['4,3', 'tower'], ['0,0', 'park'], ['7,7', 'park'], ['6,1', 'park'], ['2,6', 'park'], ['2,2', 'mosque'], ['5,5', 'park']]);
  }
  localToWorld(s, lx, lz) {
    const c = Math.cos(s.rot), sn = Math.sin(s.rot);
    return [s.x + lx * c + lz * sn, s.z - lx * sn + lz * c];
  }
  addBox(s, lx, lz, hx, hz, extra) {
    const [x, z] = this.localToWorld(s, lx, lz);
    this.statics.insert(boxCol(x, z, hx, hz, s.rot, extra));
  }
  addCircle(s, lx, lz, r) {
    const [x, z] = this.localToWorld(s, lx, lz);
    this.statics.insert(circleCol(x, z, r));
  }

  /* ---------- city ---------- */
  buildCity() {
    const tiles = new Map();
    const tileGroup = (x, z) => {
      const k = Math.floor((x + 400) / 200) + ',' + Math.floor((z + 400) / 200);
      if (!tiles.has(k)) {
        const g = new THREE.Group();
        tiles.set(k, g);
      }
      return tiles.get(k);
    };
    const facades = FACADES.map((f) => {
      const t = facadeTextures(f);
      const m = new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.em, emissive: 0xffffff, emissiveIntensity: 0, roughness: f.tower ? 0.3 : 0.85, metalness: f.tower ? 0.4 : 0 });
      this.nightMats.push({ mat: m, max: 1.1 });
      return m;
    });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x77736d, roughness: 0.95, map: grainTexture() });
    const signMat = new THREE.MeshStandardMaterial({ map: shopSignAtlas(), emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.5 });
    signMat.emissiveMap = signMat.map;
    this.nightMats.push({ mat: signMat, max: 0.8 });
    const sideMat = new THREE.MeshStandardMaterial({ map: sidewalkTexture(), roughness: 0.95 });
    const grassMat = new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xb8b4ac, roughness: 0.9 });
    const tankMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.5, metalness: 0.3 });
    const sideGeos = [], grassGeos = [];
    const curbG = new THREE.Group();

    for (let bi = 0; bi < 8; bi++)
      for (let bj = 0; bj < 8; bj++) {
        const x0 = GRID[bi] + 6, x1 = GRID[bi + 1] - 6, z0 = GRID[bj] + 6, z1 = GRID[bj + 1] - 6;
        sideGeos.push(uvScale(quadXZ(x0, z0, x1, z1, 0.035), 22));
        for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]]) {
          const c = box(Math.max(0.3, bx - ax), 0.14, Math.max(0.3, bz - az), curbMat, (ax + bx) / 2, 0.07, (az + bz) / 2);
          curbG.add(c);
        }
        const key = bi + ',' + bj;
        const ix0 = GRID[bi] + 10, ix1 = GRID[bi + 1] - 10, iz0 = GRID[bj] + 10, iz1 = GRID[bj + 1] - 10;
        const cx = (ix0 + ix1) / 2, cz = (iz0 + iz1) / 2;
        const tgp = tileGroup(cx, cz);
        const sp = this.special.get(key);
        const ex = this.extraSpecial.get(key);
        if (sp || ex === 'park') {
          grassGeos.push(uvScale(quadXZ(ix0, iz0, ix1, iz1, 0.045), 16));
          if (ex === 'park') this.buildPark(tgp, ix0, iz0, ix1, iz1);
          continue;
        }
        if (ex === 'tower') {
          this.buildTower(tgp, cx, cz);
          grassGeos.push(uvScale(quadXZ(ix0, iz0, ix1, iz1, 0.045), 16));
          continue;
        }
        if (ex === 'mosque') {
          this.buildMosque(tgp, cx, cz);
          continue;
        }
        const r = Math.hypot(cx, cz);
        const maxH = lerp(72, 14, clamp(r / 520, 0, 1));
        const nx = rand() < 0.5 ? 2 : 3, nz = rand() < 0.5 ? 2 : 3;
        const sx = (ix1 - ix0) / nx, sz = (iz1 - iz0) / nz;
        for (let i = 0; i < nx; i++)
          for (let j = 0; j < nz; j++) {
            if (nx === 3 && nz === 3 && i === 1 && j === 1) continue;
            const m = rr(1, 2.5);
            const bx0 = ix0 + i * sx + (i === 0 ? 0 : m), bx1 = ix0 + (i + 1) * sx - (i === nx - 1 ? 0 : m);
            const bz0 = iz0 + j * sz + (j === 0 ? 0 : m), bz1 = iz0 + (j + 1) * sz - (j === nz - 1 ? 0 : m);
            let h = Math.max(7, Math.round((rr(0.35, 1) * maxH) / 3.2) * 3.2);
            let fi = Math.floor(rand() * FACADES.length);
            if (FACADES[fi].tower && h < 30) fi = 1;
            if (h > 45 && rand() < 0.5) fi = 4;
            const w = bx1 - bx0, d = bz1 - bz0;
            const geo = buildingGeo(w, h, d, rand());
            const mesh = new THREE.Mesh(geo, [facades[fi], facades[fi], roofMat, roofMat, facades[fi], facades[fi]]);
            mesh.position.set((bx0 + bx1) / 2, h / 2, (bz0 + bz1) / 2);
            tgp.add(mesh);
            this.statics.insert(boxCol((bx0 + bx1) / 2, (bz0 + bz1) / 2, w / 2, d / 2, 0, { building: true }));
            // roof props
            const nt = 1 + Math.floor(rand() * 3);
            for (let k = 0; k < nt; k++) {
              const tx = rr(bx0 + 2, bx1 - 2), tz = rr(bz0 + 2, bz1 - 2);
              if (rand() < 0.6) {
                const t = cyl(0.8, 0.8, 1.6, tankMat, 10, tgp);
                t.rotation.z = Math.PI / 2;
                t.position.set(tx, h + 1.1, tz);
                box(1.4, 0.3, 1.2, roofMat, tx, h + 0.15, tz, tgp);
              } else box(1.2, 0.9, 0.9, tankMat, tx, h + 0.45, tz, tgp);
            }
            box(w, 0.6, 0.25, roofMat, (bx0 + bx1) / 2, h + 0.3, bz0 + 0.12, tgp);
            box(w, 0.6, 0.25, roofMat, (bx0 + bx1) / 2, h + 0.3, bz1 - 0.12, tgp);
            // shop signs facing streets
            const faces = [];
            if (i === 0) faces.push(['-x', bx0, (bz0 + bz1) / 2, d]);
            if (i === nx - 1) faces.push(['+x', bx1, (bz0 + bz1) / 2, d]);
            if (j === 0) faces.push(['-z', (bx0 + bx1) / 2, bz0, w]);
            if (j === nz - 1) faces.push(['+z', (bx0 + bx1) / 2, bz1, w]);
            for (const [f, fx, fz, len] of faces) {
              if (rand() < 0.35) continue;
              const sw = Math.min(9, len * 0.7);
              const s = signPlane(sw, 1.3, Math.floor(rand() * 8), signMat);
              s.position.set(fx, 3.9, fz);
              if (f === '+x') { s.rotation.y = Math.PI / 2; s.position.x += 0.06; }
              if (f === '-x') { s.rotation.y = -Math.PI / 2; s.position.x -= 0.06; }
              if (f === '+z') s.position.z += 0.06;
              if (f === '-z') { s.rotation.y = Math.PI; s.position.z -= 0.06; }
              tgp.add(s);
              // awning
              const aw = box(f === '+x' || f === '-x' ? 1.4 : sw, 0.12, f === '+x' || f === '-x' ? sw : 1.4, roofMat, fx, 3.05, fz);
              if (f === '+x') aw.position.x += 0.7;
              if (f === '-x') aw.position.x -= 0.7;
              if (f === '+z') aw.position.z += 0.7;
              if (f === '-z') aw.position.z -= 0.7;
              tgp.add(aw);
            }
          }
      }
    const sm = new THREE.Mesh(mergePlain(sideGeos), sideMat);
    sm.receiveShadow = true;
    this.group.add(sm);
    const gm = new THREE.Mesh(mergePlain(grassGeos), grassMat);
    gm.receiveShadow = true;
    this.group.add(gm);
    mergeByMaterial(curbG, { shadow: false });
    this.group.add(curbG);
    for (const g of tiles.values()) {
      mergeByMaterial(g);
      this.group.add(g);
    }
  }
  buildPark(tg, x0, z0, x1, z1) {
    const pathMat = new THREE.MeshStandardMaterial({ color: 0xb8ad98, roughness: 0.95 });
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    box(x1 - x0, 0.02, 4, pathMat, cx, 0.06, cz, tg);
    box(4, 0.02, z1 - z0, pathMat, cx, 0.06, cz, tg);
    const stone = new THREE.MeshStandardMaterial({ color: 0xc8c0b0, roughness: 0.8 });
    const f = cyl(5, 5.4, 0.8, stone, 24, tg);
    f.position.set(cx, 0.4, cz);
    const wtr = new THREE.Mesh(new THREE.CircleGeometry(4.6, 24), this.waterMats[0]);
    wtr.rotation.x = -Math.PI / 2;
    wtr.position.set(cx, 0.75, cz);
    tg.add(wtr);
    const p = cyl(0.4, 0.6, 2.2, stone, 12, tg);
    p.position.set(cx, 1.5, cz);
    this.statics.insert(circleCol(cx, cz, 5.4));
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5636, roughness: 0.9 });
    for (let i = 0; i < 6; i++) {
      const bx = cx + (i % 2 ? 1 : -1) * 4, bz = lerp(z0 + 6, z1 - 6, i / 5);
      box(0.6, 0.1, 2, wood, bx, 0.5, bz, tg);
      box(0.1, 0.5, 2, wood, bx + (i % 2 ? 0.3 : -0.3), 0.8, bz, tg);
    }
    for (let i = 0; i < 26; i++) {
      const x = rr(x0 + 3, x1 - 3), z = rr(z0 + 3, z1 - 3);
      if (Math.abs(x - cx) < 4 || Math.abs(z - cz) < 4) continue;
      this.addVeg(rand() < 0.3 ? 'cypress' : 'broad', x, z, rr(0.8, 1.2));
    }
    for (let i = 0; i < 14; i++) {
      const x = rr(x0 + 2, x1 - 2), z = rr(z0 + 2, z1 - 2);
      if (Math.abs(x - cx) < 4 || Math.abs(z - cz) < 4) continue;
      this.addVeg('bush', x, z, rr(0.7, 1.3));
    }
  }
  buildTower(tg, cx, cz) {
    const conc = new THREE.MeshStandardMaterial({ color: 0xd0d0cc, roughness: 0.6 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x4a7aa8, roughness: 0.15, metalness: 0.6, emissive: 0x6aa0ff, emissiveIntensity: 0 });
    this.nightMats.push({ mat: glass, max: 0.6 });
    const base = cyl(14, 18, 8, conc, 24, tg);
    base.position.set(cx, 4, cz);
    const shaft = cyl(3.2, 5, 150, conc, 16, tg);
    shaft.position.set(cx, 83, cz);
    const pod = cyl(12, 7, 14, glass, 24, tg);
    pod.position.set(cx, 140, cz);
    const top = cyl(9, 12, 4, conc, 24, tg);
    top.position.set(cx, 149, cz);
    const ant = cyl(0.6, 1.4, 50, conc, 8, tg);
    ant.position.set(cx, 176, cz);
    const red = new THREE.MeshBasicMaterial({ color: 0xff2020 });
    sphere(1.2, red, 8, 6, tg).position.set(cx, 202, cz);
    this.statics.insert(circleCol(cx, cz, 18));
  }
  buildMosque(tg, cx, cz) {
    const wall = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.85 });
    const tile = new THREE.MeshStandardMaterial({ color: 0x2aa3b8, roughness: 0.35, metalness: 0.2 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.9 });
    box(44, 12, 44, wall, cx, 6, cz, tg);
    const d = new THREE.Mesh(new THREE.SphereGeometry(13, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), tile);
    d.position.set(cx, 15, cz);
    d.scale.y = 1.25;
    tg.add(d);
    cyl(13.5, 13.5, 3.5, wall, 28, tg).position.set(cx, 13.5, cz);
    for (const [ox, oz] of [[-22, 22], [22, 22]]) {
      const m = cyl(1.6, 1.9, 38, tile, 12, tg);
      m.position.set(cx + ox, 19, cz + oz);
      cyl(2.4, 2.4, 1.5, wall, 12, tg).position.set(cx + ox, 32, cz + oz);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.7, 4, 12), gold);
      cap.position.set(cx + ox, 40, cz + oz);
      tg.add(cap);
    }
    // portal (iwan)
    box(18, 20, 3, tile, cx, 10, cz + 23, tg);
    box(10, 14, 0.5, new THREE.MeshStandardMaterial({ color: 0x1a3a50 }), cx, 7, cz + 24.6, tg);
    this.statics.insert(boxCol(cx, cz + 1.5, 22, 24, 0, { building: true }));
  }

  /* ---------- stations ---------- */
  buildStations() {
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.6 });
    const green = new THREE.MeshStandardMaterial({ color: 0x1f8a4c, roughness: 0.5 });
    const conc = new THREE.MeshStandardMaterial({ color: 0x9a968e, roughness: 0.95, map: grainTexture() });
    const glassM = new THREE.MeshStandardMaterial({ color: 0x5a7a90, roughness: 0.1, metalness: 0.5, emissive: 0xfff0d0, emissiveIntensity: 0 });
    this.nightMats.push({ mat: glassM, max: 0.5 });
    const lightPanel = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.1 });
    this.nightMats.push({ mat: lightPanel, max: 1.4, min: 0.1 });
    const signs = {
      gas: new THREE.MeshStandardMaterial({ map: signTexture('پمپ بنزین', '#1f8a4c', '#fff'), emissive: 0xffffff, emissiveIntensity: 0 }),
      regular: new THREE.MeshStandardMaterial({ map: signTexture('معمولی', '#c0392b', '#fff') }),
      super: new THREE.MeshStandardMaterial({ map: signTexture('سوپر', '#1f4fa0', '#fff') }),
      garage: new THREE.MeshStandardMaterial({ map: signTexture('تعمیرگاه', '#d68910', '#111'), emissive: 0xffffff, emissiveIntensity: 0 }),
      police: new THREE.MeshStandardMaterial({ map: signTexture('کلانتری', '#0f6b3a', '#fff'), emissive: 0xffffff, emissiveIntensity: 0 }),
      price: new THREE.MeshStandardMaterial({
        map: canvasTexture(256, 384, (g, w, h) => {
          g.fillStyle = '#123';
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#1f8a4c';
          g.fillRect(0, 0, w, 100);
          g.fillStyle = '#fff';
          g.textAlign = 'center';
          g.font = 'bold 44px Vazirmatn, Tahoma, sans-serif';
          g.fillText('بنزین', w / 2, 66);
          g.font = 'bold 34px Vazirmatn, Tahoma, sans-serif';
          g.fillStyle = '#ffd34a';
          g.fillText('معمولی ۱٬۵۰۰', w / 2, 180);
          g.fillStyle = '#6ad4ff';
          g.fillText('سوپر ۳٬۰۰۰', w / 2, 260);
          g.fillStyle = '#ccc';
          g.font = '24px Vazirmatn, Tahoma, sans-serif';
          g.fillText('تومان / لیتر', w / 2, 330);
        }),
        emissive: 0xffffff,
        emissiveIntensity: 0,
      }),
    };
    signs.price.emissiveMap = signs.price.map;
    for (const k of ['gas', 'garage', 'police']) {
      signs[k].emissiveMap = signs[k].map;
      this.nightMats.push({ mat: signs[k], max: 0.7 });
    }
    this.nightMats.push({ mat: signs.price, max: 0.7 });
    const all = [...this.stations, ...this.garages, this.police];
    for (const s of all) {
      const g = new THREE.Group();
      g.position.set(s.x, 0, s.z);
      g.rotation.y = s.rot;
      box(30, 0.04, 26, conc, 0, 0.04, -2, g);
      if (s.kind === 'gas') {
        box(18, 0.6, 11, white, 0, 5.4, 0, g);
        box(18.2, 0.35, 11.2, green, 0, 5.0, 0, g);
        box(16, 0.02, 9, lightPanel, 0, 4.82, 0, g);
        for (const [x, z] of [[-7, -4], [7, -4], [-7, 4], [7, 4]]) {
          cyl(0.25, 0.25, 4.8, white, 10, g).position.set(x, 2.4, z);
          this.addCircle(s, x, z, 0.35);
        }
        for (const x of [-3.2, 3.2]) {
          box(1.3, 0.22, 6, conc, x, 0.11, 0, g);
          for (const z of [-1.5, 1.5]) {
            box(0.8, 1.7, 0.55, white, x, 1.07, z, g);
            const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.3), z < 0 ? signs.regular : signs.super);
            sg.position.set(x + (x < 0 ? -0.41 : 0.41), 1.55, z);
            sg.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2;
            g.add(sg);
            box(0.82, 0.4, 0.57, green, x, 2.0, z, g);
          }
          this.addBox(s, x, 0, 0.6, 3);
        }
        // canopy sign
        for (const z of [5.65, -5.65]) {
          const sg = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.4), signs.gas);
          sg.position.set(0, 5.3, z);
          if (z < 0) sg.rotation.y = Math.PI;
          g.add(sg);
        }
        // shop
        box(12, 4, 6, white, 0, 2, -11, g);
        box(8, 2.4, 0.1, glassM, 0, 1.6, -7.95, g);
        box(12.4, 0.6, 6.4, green, 0, 4.3, -11, g);
        this.addBox(s, 0, -11, 6, 3);
        // price pylon
        cyl(0.18, 0.18, 6, white, 8, g).position.set(12, 3, 9);
        const pb = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 0.3), [white, white, white, white, signs.price, signs.price]);
        pb.position.set(12, 6.6, 9);
        g.add(pb);
        this.addCircle(s, 12, 9, 0.4);
        s.padLocal = [0, 0];
      } else {
        const wallMat = s.kind === 'police' ? new THREE.MeshStandardMaterial({ color: 0xe9e4d6, roughness: 0.85 }) : new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.85 });
        const bw = 20, bd = 10, bh = s.kind === 'police' ? 9 : 6;
        box(bw, bh, bd, wallMat, 0, bh / 2, -10, g);
        box(bw + 0.4, 0.5, bd + 0.4, s.kind === 'police' ? green : conc, 0, bh + 0.25, -10, g);
        const sg = new THREE.Mesh(new THREE.PlaneGeometry(7, 2), signs[s.kind]);
        sg.position.set(0, bh - 1.4, -4.94);
        g.add(sg);
        if (s.kind === 'garage') {
          box(8, 4.2, 0.2, new THREE.MeshStandardMaterial({ color: 0x222222 }), -4, 2.1, -4.92, g);
          const tireM = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
          for (let i = 0; i < 4; i++) {
            const t = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.17, 8, 16), tireM);
            t.rotation.x = Math.PI / 2;
            t.position.set(8, 0.17 + i * 0.32, -3);
            g.add(t);
          }
          this.addCircle(s, 8, -3, 0.7);
        } else {
          box(4, 3, 0.15, glassM, 0, 1.5, -4.94, g);
          for (let i = 0; i < 4; i++) box(1.4, 1.6, 0.12, glassM, -8 + i * 2.2 + (i > 1 ? 6.6 : 0), 6, -4.94, g);
          cyl(0.08, 0.08, 10, new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 }), 8, g).position.set(11, 5, -3);
          const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshStandardMaterial({
            side: THREE.DoubleSide,
            map: canvasTexture(96, 56, (gg) => {
              gg.fillStyle = '#239f40'; gg.fillRect(0, 0, 96, 19);
              gg.fillStyle = '#fff'; gg.fillRect(0, 19, 96, 18);
              gg.fillStyle = '#da0000'; gg.fillRect(0, 37, 96, 19);
            }),
          }));
          flag.position.set(12.2, 9.2, -3);
          flag.userData.noMerge = true;
          g.add(flag);
          this.flag = flag;
          this.addCircle(s, 11, -3, 0.3);
        }
        this.addBox(s, 0, -10, bw / 2, bd / 2, { building: true });
        s.padLocal = [0, 4];
      }
      const [px, pz] = this.localToWorld(s, s.padLocal[0], s.padLocal[1]);
      s.padX = px;
      s.padZ = pz;
      mergeByMaterial(g);
      this.group.add(g);
    }
  }

  /* ---------- regions decor ---------- */
  addVeg(type, x, z, s = 1, color) {
    if (!this.scatter.has(type)) this.scatter.set(type, []);
    const y = this.heightAt(x, z);
    this.scatter.get(type).push({ x, y, z, s, r: rand() * Math.PI * 2, color });
    const tr = TRUNK_R[type] * (type === 'rock' ? s : 1);
    if (tr > 0) this.statics.insert(circleCol(x, z, tr, { soft: type === 'bush' }));
  }
  finishScatter() {
    const tile = 500;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const col = new THREE.Color();
    for (const [type, list] of this.scatter) {
      const byTile = new Map();
      for (const it of list) {
        const k = Math.floor(it.x / tile) + ',' + Math.floor(it.z / tile);
        if (!byTile.has(k)) byTile.set(k, []);
        byTile.get(k).push(it);
      }
      for (const items of byTile.values()) {
        const im = new THREE.InstancedMesh(this.veg[type], this.vegMat, items.length);
        items.forEach((it, i) => {
          e.set(type === 'rock' ? it.r * 0.3 : 0, it.r, 0);
          q.setFromEuler(e);
          sc.set(it.s, type === 'rock' ? it.s * rr(0.6, 1.1) : it.s, it.s);
          m4.compose(v.set(it.x, it.y - (type === 'rock' ? 0.3 * it.s : 0.05), it.z), q, sc);
          im.setMatrixAt(i, m4);
          col.setHSL(0, 0, 0.85 + rand() * 0.3);
          if (it.color) col.set(it.color);
          im.setColorAt(i, col);
        });
        im.castShadow = type !== 'bush' && type !== 'dry';
        im.receiveShadow = true;
        im.computeBoundingSphere();
        this.group.add(im);
      }
    }
  }
  freeSpot(x, z, minRoad = 12) {
    if (Math.abs(x) > HALF - 30 || Math.abs(z) > HALF - 30) return false;
    if (this.roadDist(x, z) < minRoad) return false;
    if (Math.hypot(x - 1350, z + 750) < 290) return false;
    if (Math.hypot(x - 1160, z - 1525) < 44) return false;
    const h = this.heightAt(x, z);
    if (h > 45 || h < -0.5) return false;
    for (const s of this.stations) if (Math.hypot(x - s.x, z - s.z) < 22) return false;
    for (const s of this.garages) if (Math.hypot(x - s.x, z - s.z) < 22) return false;
    return true;
  }
  buildRegions() {
    const lowQ = this.quality === 'low';
    const k = lowQ ? 0.45 : 1;
    const tries = (n, region, fn) => {
      let placed = 0, guard = 0;
      while (placed < n * k && guard++ < n * 12) {
        const x = rr(-HALF + 40, HALF - 40), z = rr(-HALF + 40, HALF - 40);
        if (regionAt(x, z) !== region) continue;
        const w = regionWeights(x, z)[region];
        if (w < 0.6) continue;
        const rd = this.roadDist(x, z);
        if (rd > 120 && rand() < 0.55) continue;
        if (fn(x, z, rd)) placed++;
      }
    };
    tries(3200, 'forest', (x, z) => {
      if (!this.freeSpot(x, z, 13)) return false;
      const r = rand();
      this.addVeg(r < 0.78 ? 'pine' : r < 0.93 ? 'broad' : 'bush', x, z, rr(0.8, 1.45));
      return true;
    });
    tries(500, 'forest', (x, z) => {
      if (!this.freeSpot(x, z, 9)) return false;
      this.addVeg(rand() < 0.5 ? 'rock' : 'bush', x, z, rr(0.6, 1.6));
      return true;
    });
    tries(420, 'desert', (x, z) => {
      if (!this.freeSpot(x, z, 10)) return false;
      this.addVeg('cactus', x, z, rr(0.7, 1.3));
      return true;
    });
    tries(500, 'desert', (x, z) => {
      if (!this.freeSpot(x, z, 9)) return false;
      this.addVeg(rand() < 0.5 ? 'rock' : 'dry', x, z, rr(0.6, 2.4));
      return true;
    });
    tries(1300, 'lake', (x, z) => {
      if (!this.freeSpot(x, z, 12)) return false;
      const r = rand();
      this.addVeg(r < 0.6 ? 'pine' : r < 0.8 ? 'rock' : 'broad', x, z, rr(0.7, 1.4));
      return true;
    });
    tries(700, 'farm', (x, z) => {
      if (!this.freeSpot(x, z, 12)) return false;
      const r = rand();
      if (r < 0.55) {
        // row of trees along field borders
        const gx = Math.round(x / 80) * 80;
        this.addVeg(rand() < 0.5 ? 'broad' : 'cypress', gx + rr(-1, 1), z, rr(0.8, 1.2));
      } else if (r < 0.75) this.addVeg('hay', x, z, rr(0.8, 1.1));
      else this.addVeg('bush', x, z, rr(0.8, 1.3));
      return true;
    });
    // city outskirts green belt
    tries(300, 'city', (x, z) => {
      if (Math.abs(x) < 415 && Math.abs(z) < 415) return false;
      if (!this.freeSpot(x, z, 12)) return false;
      this.addVeg(rand() < 0.6 ? 'broad' : 'cypress', x, z, rr(0.8, 1.3));
      return true;
    });

    // place decor
    const mats = {
      mud: new THREE.MeshStandardMaterial({ color: 0xc9a476, roughness: 1, map: grainTexture() }),
      wood: new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 0.9 }),
      darkWood: new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 }),
      white: new THREE.MeshStandardMaterial({ color: 0xebe6da, roughness: 0.9 }),
      red: new THREE.MeshStandardMaterial({ color: 0x9a3a2a, roughness: 0.8 }),
      stone: new THREE.MeshStandardMaterial({ color: 0x8a8278, roughness: 0.95, map: grainTexture() }),
      barn: new THREE.MeshStandardMaterial({ color: 0x8e3b2c, roughness: 0.9 }),
      grey: new THREE.MeshStandardMaterial({ color: 0x5a5a5e, roughness: 0.8 }),
      teal: new THREE.MeshStandardMaterial({ color: 0x2aa3b8, roughness: 0.4 }),
      win: new THREE.MeshStandardMaterial({ color: 0x2a3440, emissive: 0xffc070, emissiveIntensity: 0 }),
      canvas: new THREE.MeshStandardMaterial({ color: 0xd06030, roughness: 0.9, side: THREE.DoubleSide }),
    };
    this.nightMats.push({ mat: mats.win, max: 1.2 });
    const dg = new THREE.Group();
    const house = (style, x, z, rot) => {
      const g = new THREE.Group();
      g.position.set(x, this.heightAt(x, z), z);
      g.rotation.y = rot;
      let hw = 4, hd = 4;
      if (style === 'mud') {
        const w = rr(7, 10), d = rr(7, 10), h = rr(3.5, 4.5);
        hw = w / 2; hd = d / 2;
        box(w, h, d, mats.mud, 0, h / 2, 0, g);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(Math.min(w, d) * 0.36, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.mud);
        dome.position.y = h;
        g.add(dome);
        if (rand() < 0.6) {
          box(1.8, 6, 1.8, mats.mud, w / 2 - 1, h + 3, d / 2 - 1, g);
          for (const s of [-0.5, 0, 0.5]) box(0.25, 1.6, 1.85, mats.darkWood, w / 2 - 1 + s, h + 4.8, d / 2 - 1, g);
        }
        box(1.2, 2.2, 0.1, mats.darkWood, 0, 1.1, d / 2 + 0.03, g);
        box(0.8, 0.8, 0.1, mats.win, 2, 2, d / 2 + 0.03, g);
      } else if (style === 'cabin' || style === 'village' || style === 'barn') {
        const big = style === 'barn';
        const w = big ? 12 : rr(6, 8), d = big ? 9 : rr(5.5, 7), h = big ? 5.5 : 3.4;
        hw = w / 2; hd = d / 2;
        const wm = style === 'cabin' ? mats.wood : style === 'barn' ? mats.barn : mats.white;
        const rm = style === 'cabin' ? mats.darkWood : style === 'barn' ? mats.grey : mats.red;
        box(w, h, d, wm, 0, h / 2, 0, g);
        const roof = new THREE.Mesh(prismGeo(w + 0.8, big ? 3.5 : 2.4, d + 0.8), rm);
        roof.position.y = h;
        g.add(roof);
        box(1.1, 2.1, 0.1, mats.darkWood, -w / 4, 1.05, d / 2 + 0.03, g);
        box(1, 0.9, 0.1, mats.win, w / 4, 1.9, d / 2 + 0.03, g);
        if (style !== 'barn') box(0.6, 1.6, 0.6, mats.stone, w / 2 - 1, h + 1.2, 0, g);
      } else if (style === 'tent') {
        const t = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.4, 4), mats.canvas);
        t.position.y = 1.2;
        t.rotation.y = Math.PI / 4;
        g.add(t);
        hw = hd = 1.6;
      }
      dg.add(g);
      this.statics.insert(boxCol(x, z, hw, hd, rot, { building: true }));
    };
    for (const p of this.places) {
      if (!p.decor) continue;
      const bx = p.x + p.nx * 25, bz = p.z + p.nz * 25;
      const rot = Math.atan2(-p.nx, -p.nz);
      const ring = (n, style, r0, r1) => {
        for (let i = 0; i < n; i++) {
          for (let tries2 = 0; tries2 < 10; tries2++) {
            const a = rand() * Math.PI * 2, r = rr(r0, r1);
            const x = bx + Math.cos(a) * r, z = bz + Math.sin(a) * r;
            if (this.roadDist(x, z) < 15) continue;
            house(style, x, z, rot + Math.round(rand() * 3) * (Math.PI / 2));
            break;
          }
        }
      };
      switch (p.decor) {
        case 'mud': ring(9, 'mud', 6, 60); break;
        case 'mudSmall': ring(3, 'mud', 4, 30); {
          // well
          const w = cyl(1.4, 1.5, 1, mats.stone, 14, dg);
          w.position.set(p.x + p.nx * 6, 0.5, p.z + p.nz * 6);
          this.statics.insert(circleCol(w.position.x, w.position.z, 1.5));
        } break;
        case 'cabins': ring(6, 'cabin', 8, 50); break;
        case 'village': ring(7, 'village', 6, 50); break;
        case 'farmVillage': ring(6, 'village', 6, 45); ring(2, 'barn', 20, 50); break;
        case 'farm': ring(2, 'barn', 10, 40); ring(1, 'village', 6, 20);
          for (let i = 0; i < 10; i++) this.addVeg('hay', bx + rr(-40, 40), bz + rr(-40, 40), rr(0.8, 1.1));
          break;
        case 'orchard':
          for (let i = -4; i <= 4; i++) for (let j = 0; j <= 5; j++) {
            const x = bx + i * 7, z = bz + (j - 2.5) * 7;
            if (this.roadDist(x, z) > 12) this.addVeg('broad', x, z, 0.6, 0x8a5a3a);
          }
          ring(1, 'village', 30, 40);
          break;
        case 'camp': ring(5, 'tent', 6, 25); break;
        case 'rocks': for (let i = 0; i < 18; i++) this.addVeg('rock', bx + rr(-30, 30), bz + rr(-30, 30), rr(1, 3)); break;
        case 'beach': for (let i = 0; i < 6; i++) this.addVeg('palm', bx + rr(-25, 25), bz + rr(-25, 25), rr(0.8, 1.1)); ring(2, 'cabin', 15, 35); break;
        case 'oasis': for (let i = 0; i < 26; i++) {
          const a = rand() * Math.PI * 2, r = rr(44, 70);
          const x = 1160 + Math.cos(a) * r, z = 1525 + Math.sin(a) * r;
          if (this.roadDist(x, z) > 10) this.addVeg('palm', x, z, rr(0.8, 1.3));
        } ring(3, 'mud', 20, 50); break;
        case 'caravan': {
          const g = new THREE.Group();
          g.position.set(bx + p.nx * 20, 0, bz + p.nz * 20);
          g.rotation.y = rot;
          const S = 40, H = 7;
          for (const [x, z, w, d] of [[0, -S / 2, S, 3], [-S / 2, 0, 3, S], [S / 2, 0, 3, S], [-12, S / 2, 16, 3], [12, S / 2, 16, 3]]) box(w, H, d, mats.mud, x, H / 2, z, g);
          box(8, 10, 4, mats.mud, 0, 5, S / 2, g);
          box(5, 6, 4.2, mats.darkWood, 0, 3, S / 2, g);
          for (const [cx, cz] of [[-S / 2, -S / 2], [S / 2, -S / 2], [-S / 2, S / 2], [S / 2, S / 2]]) cyl(2.4, 2.6, H + 2, mats.mud, 12, g).position.set(cx, (H + 2) / 2, cz);
          dg.add(g);
          g.updateMatrixWorld();
          for (const [x, z, w, d] of [[0, -S / 2, S, 3], [-S / 2, 0, 3, S], [S / 2, 0, 3, S], [-12, S / 2, 16, 3], [12, S / 2, 16, 3]]) {
            const v = new THREE.Vector3(x, 0, z).applyMatrix4(g.matrixWorld);
            this.statics.insert(boxCol(v.x, v.z, w / 2 + 1.3, d / 2, rot, { building: true }));
          }
          break;
        }
        case 'observatory': {
          const g = new THREE.Group();
          g.position.set(bx + p.nx * 10, 0, bz + p.nz * 10);
          cyl(7, 7, 6, mats.white, 24, g).position.y = 3;
          const d = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.white);
          d.position.y = 6;
          g.add(d);
          box(1.6, 7.5, 7.4, mats.grey, 0, 6.5, 0, g);
          dg.add(g);
          this.statics.insert(circleCol(g.position.x, g.position.z, 7.2));
          ring(2, 'mud', 18, 30);
          break;
        }
        case 'windmill': {
          const g = new THREE.Group();
          g.position.set(bx, this.heightAt(bx, bz), bz);
          cyl(2.2, 3.4, 14, mats.white, 16, g).position.y = 7;
          const cap = new THREE.Mesh(new THREE.ConeGeometry(2.8, 3, 16), mats.red);
          cap.position.y = 15.5;
          g.add(cap);
          const blades = new THREE.Group();
          blades.position.set(0, 13, 2.8);
          for (let i = 0; i < 4; i++) {
            const b = box(1.4, 9, 0.12, mats.wood, 0, 4.6, 0);
            const pv = new THREE.Group();
            pv.rotation.z = (i * Math.PI) / 2;
            pv.add(b);
            blades.add(pv);
          }
          g.add(blades);
          this.scene.add(g);
          this.windmill = blades;
          this.statics.insert(circleCol(bx, bz, 3.4));
          ring(2, 'village', 20, 40);
          break;
        }
        default:
      }
    }
    mergeByMaterial(dg);
    this.group.add(dg);
  }

  /* ---------- street furniture ---------- */
  buildLamps() {
    const pts = [];
    for (const r of this.roads) {
      if (r.type === 'city') {
        const a = r.pts[0], b = r.pts[r.pts.length - 1];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
        for (let s = 16; s < len - 8; s += 34) {
          const along = s % 100;
          if (along < 12 || along > 88) continue;
          const side = Math.floor(s / 34) % 2 ? 1 : -1;
          pts.push({ x: a.x + dx * s - dz * side * 7.4, z: a.z + dz * s + dx * side * 7.4, rot: Math.atan2(dz * side, -dx * side) });
        }
      } else {
        let acc = 0;
        for (let i = 0; i < r.pts.length - 1; i++) {
          const a = r.pts[i], b = r.pts[i + 1];
          const l = Math.hypot(b.x - a.x, b.z - a.z);
          acc += l;
          const near = Math.max(Math.abs(a.x), Math.abs(a.z)) < 750 || this.places.some((p) => p.region !== 'city' && Math.hypot(p.x - a.x, p.z - a.z) < 160);
          if (!near || acc < 45) continue;
          acc = 0;
          const dx = (b.x - a.x) / l, dz = (b.z - a.z) / l;
          pts.push({ x: a.x - dz * 8.6, z: a.z + dx * 8.6, rot: Math.atan2(dz, -dx) });
        }
      }
    }
    const poleG = new THREE.CylinderGeometry(0.09, 0.14, 8, 8);
    poleG.translate(0, 4, 0);
    const armG = new THREE.BoxGeometry(0.08, 0.08, 2.2);
    armG.translate(0, 7.9, 1.0);
    const merged = concatPlain([poleG.toNonIndexed(), armG.toNonIndexed()]);
    const headG = new THREE.BoxGeometry(0.4, 0.12, 0.7);
    headG.translate(0, 7.84, 2.0);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x5a5e62, metalness: 0.6, roughness: 0.4 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, emissive: 0xffd9a0, emissiveIntensity: 0 });
    this.nightMats.push({ mat: headMat, max: 2.5 });
    const poles = new THREE.InstancedMesh(merged, poleMat, pts.length);
    const heads = new THREE.InstancedMesh(headG, headMat, pts.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    const glowPos = [];
    pts.forEach((p, i) => {
      // arm points toward road center: local +z rotated by rot
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot);
      m.compose(v.set(p.x, this.heightAt(p.x, p.z), p.z), q, s);
      poles.setMatrixAt(i, m);
      heads.setMatrixAt(i, m);
      const hx = p.x + Math.sin(p.rot) * 2, hz = p.z + Math.cos(p.rot) * 2;
      glowPos.push(hx, 7.6 + v.y, hz);
      this.statics.insert(circleCol(p.x, p.z, 0.25));
    });
    poles.castShadow = true;
    poles.computeBoundingSphere();
    heads.computeBoundingSphere();
    this.group.add(poles, heads);
    this.lampPositions = glowPos;
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(glowPos, 3));
    const glowTex = canvasTexture(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,230,180,1)');
      gr.addColorStop(0.25, 'rgba(255,200,120,0.5)');
      gr.addColorStop(1, 'rgba(255,180,90,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    });
    this.glowMat = new THREE.PointsMaterial({ map: glowTex, size: 7, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    const glow = new THREE.Points(gg, this.glowMat);
    glow.frustumCulled = false;
    this.group.add(glow);
    // light pools on the ground under each lamp (cheap fake lighting at night)
    const poolTex = canvasTexture(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,214,150,0.85)');
      gr.addColorStop(0.5, 'rgba(255,190,110,0.35)');
      gr.addColorStop(1, 'rgba(255,170,90,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    });
    this.poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 });
    const poolG = new THREE.PlaneGeometry(16, 16);
    poolG.rotateX(-Math.PI / 2);
    const pools = new THREE.InstancedMesh(poolG, this.poolMat, pts.length);
    const pm = new THREE.Matrix4();
    for (let i = 0; i < pts.length; i++) {
      const x = glowPos[i * 3], z = glowPos[i * 3 + 2];
      pm.makeTranslation(x, this.heightAt(x, z) + 0.06, z);
      pools.setMatrixAt(i, pm);
    }
    pools.computeBoundingSphere();
    pools.renderOrder = 2;
    this.group.add(pools);
  }

  buildTrafficLights() {
    const nodes = this.graph.nodes.filter((n) => n.city && n.inter && Math.abs(n.x) < 400 && Math.abs(n.z) < 400);
    const approaches = [
      // travel dir, corner offset, facing rot (head faces approaching car)
      { axis: 'z', dx: 0, dz: 1, cx: -7.6, cz: -7.6, rot: Math.PI },
      { axis: 'z', dx: 0, dz: -1, cx: 7.6, cz: 7.6, rot: 0 },
      { axis: 'x', dx: 1, dz: 0, cx: -7.6, cz: 7.6, rot: -Math.PI / 2 },
      { axis: 'x', dx: -1, dz: 0, cx: 7.6, cz: -7.6, rot: Math.PI / 2 },
    ];
    const count = nodes.length * 4;
    const poleG = concatPlain([
      (() => { const g = new THREE.CylinderGeometry(0.1, 0.12, 4.2, 8); g.translate(0, 2.1, 0); return g.toNonIndexed(); })(),
    ]);
    const housG = new THREE.BoxGeometry(0.42, 1.25, 0.32);
    housG.translate(0, 3.7, 0);
    const bulbG = new THREE.SphereGeometry(0.13, 10, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3d40, metalness: 0.5, roughness: 0.5 });
    const housMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
    const poles = new THREE.InstancedMesh(poleG, poleMat, count);
    const hous = new THREE.InstancedMesh(housG, housMat, count);
    const bulbs = new THREE.InstancedMesh(bulbG, new THREE.MeshBasicMaterial({ color: 0xffffff }), count * 3);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    const Y = new THREE.Vector3(0, 1, 0);
    let i = 0;
    nodes.forEach((n, ni) => {
      n.light = { group: (Math.round(n.x / 100) + Math.round(n.z / 100)) % 2 ? 13 : 0, base: i };
      n.redCam = ni % 5 === 2;
      for (const ap of approaches) {
        const x = n.x + ap.cx, z = n.z + ap.cz;
        q.setFromAxisAngle(Y, ap.rot);
        m.compose(v.set(x, 0, z), q, one);
        poles.setMatrixAt(i, m);
        hous.setMatrixAt(i, m);
        // bulbs on the face toward approaching traffic (local +z)
        for (let c = 0; c < 3; c++) {
          const ly = 4.1 - c * 0.4;
          const off = new THREE.Vector3(0, ly, 0.17).applyQuaternion(q);
          m.compose(v.set(x + off.x, off.y, z + off.z), q, one);
          bulbs.setMatrixAt(i * 3 + c, m);
        }
        this.statics.insert(circleCol(x, z, 0.2));
        i++;
      }
      this.lightNodes.push(n);
    });
    for (const im of [poles, hous, bulbs]) {
      im.computeBoundingSphere();
      this.group.add(im);
    }
    poles.castShadow = true;
    this.bulbs = bulbs;
    this.lightApproaches = approaches;
    this.lastLightKey = '';
  }
  lightState(node, axis, t) {
    const c = (t + node.light.group) % 26;
    if (axis === 'z') return c < 11 ? 'g' : c < 13 ? 'y' : 'r';
    return c < 13 ? 'r' : c < 24 ? 'g' : 'y';
  }
  updateLights(t) {
    const key = Math.floor(t) + '';
    if (key === this.lastLightKey) return;
    this.lastLightKey = key;
    const on = { r: new THREE.Color(3, 0.15, 0.1), y: new THREE.Color(3, 2.1, 0.1), g: new THREE.Color(0.1, 3, 0.6) };
    const off = new THREE.Color(0.12, 0.12, 0.12);
    for (const n of this.lightNodes) {
      this.lightApproaches.forEach((ap, k) => {
        const st = this.lightState(n, ap.axis, t);
        const base = (n.light.base + k) * 3;
        this.bulbs.setColorAt(base, st === 'r' ? on.r : off);
        this.bulbs.setColorAt(base + 1, st === 'y' ? on.y : off);
        this.bulbs.setColorAt(base + 2, st === 'g' ? on.g : off);
      });
    }
    this.bulbs.instanceColor.needsUpdate = true;
  }

  buildRoadside() {
    // speed cameras + billboards on highways
    const camMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const g = new THREE.Group();
    const hw = this.roads.filter((r) => r.type === 'highway');
    hw.forEach((r, i) => {
      if (i % 2 === 0 && r.pts.length > 14) {
        const p = r.pts[6], q2 = r.pts[7];
        const l = Math.hypot(q2.x - p.x, q2.z - p.z);
        const dx = (q2.x - p.x) / l, dz = (q2.z - p.z) / l;
        const x = p.x - dz * 8.2, z = p.z + dx * 8.2;
        cyl(0.12, 0.12, 5, camMat, 8, g).position.set(x, 2.5, z);
        box(0.5, 0.45, 0.8, camMat, x, 5.1, z, g);
        box(0.3, 0.3, 0.05, dark, x, 5.1, z + 0.4, g);
        this.speedCams.push({ x: p.x, z: p.z, limit: 90, name: r.name });
        this.statics.insert(circleCol(x, z, 0.3));
      }
      if (r.pts.length > 10) {
        const k = Math.floor(r.pts.length * 0.6);
        const p = r.pts[k], q2 = r.pts[k + 1];
        const l = Math.hypot(q2.x - p.x, q2.z - p.z);
        const dx = (q2.x - p.x) / l, dz = (q2.z - p.z) / l;
        const x = p.x + dz * 22, z = p.z - dx * 22;
        if (!this.freeSpot(x, z, 16)) return;
        const bg = new THREE.Group();
        bg.position.set(x, this.heightAt(x, z), z);
        bg.rotation.y = Math.atan2(-dz, dx);
        cyl(0.25, 0.3, 7, camMat, 8, bg).position.set(-3, 3.5, 0);
        cyl(0.25, 0.3, 7, camMat, 8, bg).position.set(3, 3.5, 0);
        const bm = new THREE.MeshStandardMaterial({ map: billboardTexture(i), emissive: 0xffffff, emissiveIntensity: 0 });
        bm.emissiveMap = bm.map;
        this.nightMats.push({ mat: bm, max: 0.5 });
        const b = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 0.3), [dark, dark, dark, dark, bm, bm]);
        b.position.y = 8.5;
        bg.add(b);
        g.add(bg);
        this.statics.insert(circleCol(x, z, 3.2));
      }
    });
    mergeByMaterial(g);
    this.group.add(g);
  }

  /* ---------- per-frame ---------- */
  update(dt, env, time) {
    for (const nm of this.nightMats) nm.mat.emissiveIntensity = (nm.min || 0) + env.night * (nm.max - (nm.min || 0));
    this.glowMat.opacity = env.night * 0.9;
    this.poolMat.opacity = env.night * 0.75;
    this.waterNormal.offset.x += dt * 0.01;
    this.waterNormal.offset.y += dt * 0.006;
    if (this.windmill) this.windmill.rotation.z += dt * 0.6;
    if (this.flag) this.flag.rotation.y = Math.sin(time * 2) * 0.15;
    this.updateLights(time);
  }

  /* ---------- routing ---------- */
  route(fx, fz, tx, tz) {
    const G = this.graph;
    const s = this.nearestEdge(fx, fz), t = this.nearestEdge(tx, tz);
    if (!s || !t) return [{ x: tx, z: tz }];
    if (s.edge === t.edge) return [{ x: s.x, z: s.z }, { x: t.x, z: t.z }, { x: tx, z: tz }];
    const N = G.nodes.length;
    const g = new Float64Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const sa = G.nodes[s.edge.a], sb = G.nodes[s.edge.b];
    g[s.edge.a] = Math.hypot(sa.x - s.x, sa.z - s.z);
    g[s.edge.b] = Math.hypot(sb.x - s.x, sb.z - s.z);
    const goalCost = new Map();
    const ta = G.nodes[t.edge.a], tb = G.nodes[t.edge.b];
    goalCost.set(t.edge.a, Math.hypot(ta.x - t.x, ta.z - t.z));
    goalCost.set(t.edge.b, Math.hypot(tb.x - t.x, tb.z - t.z));
    const open = [s.edge.a, s.edge.b];
    const hfn = (n) => Math.hypot(G.nodes[n].x - t.x, G.nodes[n].z - t.z);
    let bestGoal = -1, bestCost = Infinity;
    while (open.length) {
      let bi = 0, bf = Infinity;
      for (let i = 0; i < open.length; i++) {
        const f = g[open[i]] + hfn(open[i]);
        if (f < bf) { bf = f; bi = i; }
      }
      const cur = open.splice(bi, 1)[0];
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (bf >= bestCost) break;
      if (goalCost.has(cur)) {
        const c = g[cur] + goalCost.get(cur);
        if (c < bestCost) { bestCost = c; bestGoal = cur; }
      }
      for (const eid of G.nodes[cur].edges) {
        const e = G.edges[eid];
        const o = G.other(e, cur);
        const ng = g[cur] + e.len;
        if (ng < g[o]) {
          g[o] = ng;
          prev[o] = cur;
          open.push(o);
        }
      }
    }
    if (bestGoal < 0) return [{ x: tx, z: tz }];
    const path = [];
    for (let n = bestGoal; n >= 0; n = prev[n]) path.push({ x: G.nodes[n].x, z: G.nodes[n].z, node: n });
    path.reverse();
    path.unshift({ x: s.x, z: s.z });
    path.push({ x: t.x, z: t.z }, { x: tx, z: tz });
    this.lastRouteLen = bestCost + s.dist + t.dist;
    return path;
  }
  routeLength(path) {
    let l = 0;
    for (let i = 1; i < path.length; i++) l += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
    return l;
  }
  randomRoadside(near, minD, maxD, cityOnly = false) {
    const G = this.graph;
    for (let k = 0; k < 400; k++) {
      const e = G.edges[Math.floor(Math.random() * G.edges.length)];
      if (cityOnly && e.road.type !== 'city') continue;
      const a = G.nodes[e.a], b = G.nodes[e.b];
      const t = 0.25 + Math.random() * 0.5;
      const x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t);
      const d = near ? Math.hypot(x - near.x, z - near.z) : minD;
      if (d < minD || d > maxD) continue;
      const ne = { x, z, dx: (b.x - a.x) / e.len, dz: (b.z - a.z) / e.len, edge: e };
      const side = Math.random() < 0.5 ? 1 : -1;
      const rs = this.roadside(ne, side, e.road.type === 'city' ? 8.4 : 9);
      return { x: rs.x, z: rs.z, roadX: x, roadZ: z, nx: rs.nx, nz: rs.nz, edge: e, region: regionAt(x, z) };
    }
    return null;
  }
  addressOf(x, z) {
    const reg = regionAt(x, z);
    if (reg === 'city') {
      let bi = 0, bd = Infinity, axis = 'x';
      GRID.forEach((g, i) => {
        if (Math.abs(x - g) < bd) { bd = Math.abs(x - g); bi = i; axis = 'x'; }
        if (Math.abs(z - g) < bd) { bd = Math.abs(z - g); bi = i; axis = 'z'; }
      });
      const along = axis === 'x' ? z : x;
      const names = axis === 'x' ? ZN : XN;
      let ci = 0, cd = Infinity;
      GRID.forEach((g, i) => { if (Math.abs(along - g) < cd) { cd = Math.abs(along - g); ci = i; } });
      const street = 'خیابان ' + (axis === 'x' ? XN[bi] : ZN[bi]);
      if (cd < 28) return `${street}، نبش خیابان ${names[ci]}`;
      const ci2 = along > GRID[ci] ? Math.min(8, ci + 1) : Math.max(0, ci - 1);
      return `${street}، بین ${names[ci]} و ${names[ci2]}`;
    }
    const ne = this.nearestEdge(x, z);
    let np = null, nd = Infinity;
    for (const p of this.places) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < nd) { nd = d; np = p; }
    }
    return `${ne.edge.road.name}، ${nd < 120 ? 'کنار' : 'نزدیک'} ${np.name}`;
  }

  /* ---------- minimap ---------- */
  buildMinimapBase() {
    const S = 1024;
    const c = makeCanvas(S, S);
    const g = c.getContext('2d');
    const k = S / (HALF * 2);
    const id = g.createImageData(S / 4, S / 4);
    const regCol = { city: [92, 104, 80], forest: [44, 74, 38], desert: [196, 168, 110], lake: [80, 104, 62], farm: [126, 136, 74] };
    for (let j = 0; j < S / 4; j++)
      for (let i = 0; i < S / 4; i++) {
        const x = (i * 4) / k - HALF, z = (j * 4) / k - HALF;
        const h = this.heightAt(x, z);
        let col = regCol[regionAt(x, z)];
        if (h < -0.9) col = [52, 110, 150];
        else if (h > 100) col = [220, 224, 228];
        else if (h > 40) col = [120, 112, 100];
        const o = (j * (S / 4) + i) * 4;
        id.data[o] = col[0]; id.data[o + 1] = col[1]; id.data[o + 2] = col[2]; id.data[o + 3] = 255;
      }
    const tmp = makeCanvas(S / 4, S / 4);
    tmp.getContext('2d').putImageData(id, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(tmp, 0, 0, S, S);
    g.fillStyle = 'rgba(70,72,78,0.85)';
    g.fillRect((-405 + HALF) * k, (-405 + HALF) * k, 810 * k, 810 * k);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const pass of [0, 1]) {
      for (const r of this.roads) {
        g.strokeStyle = pass ? (r.type === 'city' ? '#e9e6dc' : '#ffd36a') : 'rgba(0,0,0,0.5)';
        g.lineWidth = (r.type === 'city' ? 3.2 : 4) + (pass ? 0 : 2);
        g.beginPath();
        r.pts.forEach((p, i) => (i ? g.lineTo((p.x + HALF) * k, (p.z + HALF) * k) : g.moveTo((p.x + HALF) * k, (p.z + HALF) * k)));
        g.stroke();
      }
    }
    this.minimapBase = c;
    this.minimapScale = k;
  }
}

/* ---------- geometry helpers ---------- */
function ribbon(pts, width, vScale = 10, y = 0.02) {
  const pos = [], uv = [], nor = [];
  let dist = 0;
  const L = [], R = [], V = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
    let dx = next.x - prev.x, dz = next.z - prev.z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    const nx = -dz, nz = dx;
    if (i > 0) dist += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    const hw = width / 2;
    L.push([p.x + nx * hw, y, p.z + nz * hw]);
    R.push([p.x - nx * hw, y, p.z - nz * hw]);
    V.push(dist / vScale);
  }
  for (let i = 1; i < pts.length; i++) {
    const a = L[i - 1], b = R[i - 1], c = L[i], d = R[i];
    pos.push(...a, ...c, ...b, ...b, ...c, ...d);
    uv.push(0, V[i - 1], 0, V[i], 1, V[i - 1], 1, V[i - 1], 0, V[i], 1, V[i]);
    for (let k = 0; k < 6; k++) nor.push(0, 1, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
function quadXZ(x0, z0, x1, z1, y, rotUV = false) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y, z0, x0, y, z1, x1, y, z0, x1, y, z0, x0, y, z1, x1, y, z1], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  const uv = rotUV ? [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1] : [0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1];
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
function uvScale(g, s) {
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / s, p.getZ(i) / s);
  return g;
}
function concatPlain(list) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of list) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
const mergePlain = concatPlain;
function buildingGeo(w, h, d, uoff) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const T = 12.8;
  // faces: px, nx, py, ny, pz, nz ; 4 verts each
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [fw, fh] = dims[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (f === 2 || f === 3) uv.setXY(i, (uv.getX(i) * fw) / 8, (uv.getY(i) * fh) / 8);
      else uv.setXY(i, (uv.getX(i) * fw) / T + uoff, (uv.getY(i) * fh) / T);
    }
  }
  return g;
}
function signPlane(w, h, idx, mat) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  const cx = (idx % 2) * 0.5, cy = 1 - (Math.floor(idx / 2) + 1) * 0.25;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, cx + uv.getX(i) * 0.5, cy + uv.getY(i) * 0.25);
  return new THREE.Mesh(g, mat);
}
function prismGeo(w, h, d) {
  const hw = w / 2, hd = d / 2;
  const v = [
    // left slope
    [-hw, 0, -hd], [-hw, 0, hd], [0, h, hd], [-hw, 0, -hd], [0, h, hd], [0, h, -hd],
    // right slope
    [hw, 0, hd], [hw, 0, -hd], [0, h, -hd], [hw, 0, hd], [0, h, -hd], [0, h, hd],
    // front gable
    [-hw, 0, hd], [hw, 0, hd], [0, h, hd],
    // back gable
    [hw, 0, -hd], [-hw, 0, -hd], [0, h, -hd],
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v.flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(v.length * 2).fill(0), 2));
  g.computeVertexNormals();
  return g;
}
