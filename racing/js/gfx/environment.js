// World around the track: sky, sun/moon & shadows, image-based lighting, terrain, vegetation,
// grass, grandstands & crowd, city blocks & street lights, sea, mountains and weather.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RNG, fbm2D, smoothstep, lerp, clamp, TAU } from '../core/utils.js';
import { groundTexture, glowTexture, waterNormalTexture, bannerTexture } from './textures.js';
import { buildTrackMeshes } from './trackMesh.js';

// ---------------------------------------------------------------------------------------------
// Theme looks
// ---------------------------------------------------------------------------------------------

export const LOOKS = {
  meadow: {
    sky: ['#2a66cf', '#b9d6f0', '#6f8a57'], sun: { elev: 50, azim: 35, color: '#fff2da', intensity: 3.1 },
    hemi: ['#cfe2ff', '#53702f', 1.05], fog: '#b7cee2', exposure: 1, clouds: 0.42,
    ground: 'grass', shoulder: 'grass', trees: { oak: 0.45, pine: 0.3, bush: 0.25 }, treeCount: 1500,
    rocks: 120, grass: true, mountains: '#7d93a3', wall: 'armco', terrain: { amp: 7, far: 40 },
    groundTint: ['#ffffff', '#c9d79a'],
  },
  desert: {
    sky: ['#2f6ec4', '#f0d9b4', '#c9a06b'], sun: { elev: 62, azim: -25, color: '#ffe8c4', intensity: 3.5 },
    hemi: ['#f8e4c4', '#b98d55', 1], fog: '#e7cfa6', exposure: 0.95, clouds: 0.12,
    ground: 'sand', shoulder: 'sand', trees: { cactus: 0.6, palm: 0.1, bush: 0.3 }, treeCount: 520,
    rocks: 260, grass: false, mountains: '#c4976a', wall: 'armco', terrain: { amp: 6, far: 70, dunes: true },
    groundTint: ['#ffffff', '#f3d7a8'],
  },
  coast: {
    sky: ['#1f74e0', '#cde6f6', '#7aa0a8'], sun: { elev: 40, azim: 115, color: '#fff4e0', intensity: 3.2 },
    hemi: ['#d4ecff', '#6b8a5a', 1.05], fog: '#c4def0', exposure: 1, clouds: 0.3,
    ground: 'grass', shoulder: 'sand', trees: { palm: 0.7, bush: 0.3 }, treeCount: 820,
    rocks: 160, grass: true, mountains: '#86a1a8', wall: 'armco', terrain: { amp: 5, far: 30 }, sea: true,
    groundTint: ['#ffffff', '#d8dc9c'],
  },
  forest: {
    sky: ['#3a4c86', '#ffb27a', '#3e4a30'], sun: { elev: 7, azim: -100, color: '#ffb36b', intensity: 2.6 },
    hemi: ['#ffcfaa', '#33402a', 0.95], fog: '#d39a77', exposure: 1.05, clouds: 0.38,
    ground: 'forest', shoulder: 'grass', trees: { pine: 0.75, oak: 0.25 }, treeCount: 3600,
    rocks: 200, grass: true, mountains: '#5a5878', wall: 'armco', terrain: { amp: 11, far: 120 },
    groundTint: ['#ffffff', '#c9b98a'],
  },
  snow: {
    sky: ['#7b90aa', '#e1e8f0', '#e9eef4'], sun: { elev: 24, azim: 60, color: '#eef3ff', intensity: 1.7 },
    hemi: ['#e8eff9', '#f3f6fb', 1.45], fog: '#d9e2eb', exposure: 1, clouds: 0.82,
    ground: 'snow', shoulder: 'snow', trees: { pinesnow: 1 }, treeCount: 2500,
    rocks: 140, grass: false, mountains: '#eef2f7', wall: 'concrete', terrain: { amp: 12, far: 160 },
    groundTint: ['#ffffff', '#e4ebf5'],
  },
  city: {
    sky: ['#04060f', '#1b2547', '#0b0d14'], sun: { elev: 38, azim: 140, color: '#9fb6ff', intensity: 0.35 },
    hemi: ['#3c4c80', '#141218', 0.38], fog: '#121a30', exposure: 1.2, clouds: 0.25, night: true,
    ground: 'concrete', shoulder: 'concrete', trees: { bush: 1 }, treeCount: 140,
    rocks: 0, grass: false, mountains: null, wall: 'concrete', terrain: { amp: 0, far: 0 }, city: true,
    groundTint: ['#ffffff', '#bfc4d0'],
  },
};

// ---------------------------------------------------------------------------------------------
// Distance field to the centre line (for terrain shaping and object placement)
// ---------------------------------------------------------------------------------------------

class DistanceField {
  constructor(track, margin, cell = 8) {
    const b = track.bounds;
    this.track = track;
    this.cell = cell;
    this.x0 = b.minX - margin;
    this.z0 = b.minZ - margin;
    this.nx = Math.ceil((b.maxX - b.minX + 2 * margin) / cell) + 1;
    this.nz = Math.ceil((b.maxZ - b.minZ + 2 * margin) / cell) + 1;
    const N = this.nx * this.nz;
    this.dist = new Float32Array(N).fill(Infinity);
    this.idx = new Int32Array(N).fill(-1);
    this.reach = 320;
    const rc = Math.ceil(this.reach / cell);
    for (let i = 0; i < track.n; i += 2) {
      const cx = Math.floor((track.px[i] - this.x0) / cell);
      const cz = Math.floor((track.pz[i] - this.z0) / cell);
      for (let oz = -rc; oz <= rc; oz++) {
        const z = cz + oz;
        if (z < 0 || z >= this.nz) continue;
        const wz = this.z0 + (z + 0.5) * cell - track.pz[i];
        for (let ox = -rc; ox <= rc; ox++) {
          const x = cx + ox;
          if (x < 0 || x >= this.nx) continue;
          const wx = this.x0 + (x + 0.5) * cell - track.px[i];
          const d = Math.sqrt(wx * wx + wz * wz);
          const k = z * this.nx + x;
          if (d < this.dist[k]) { this.dist[k] = d; this.idx[k] = i; }
        }
      }
    }
    this.cx = (b.minX + b.maxX) / 2;
    this.cz = (b.minZ + b.maxZ) / 2;
    this.radius = Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) / 2;
  }

  /** Returns { dist, index } – exact distance to the nearest centre-line sample. */
  query(x, z, out = { dist: Infinity, index: -1 }) {
    const cx = Math.floor((x - this.x0) / this.cell);
    const cz = Math.floor((z - this.z0) / this.cell);
    if (cx < 0 || cz < 0 || cx >= this.nx || cz >= this.nz) {
      out.dist = Infinity; out.index = -1;
      return out;
    }
    const k = cz * this.nx + cx;
    const i0 = this.idx[k];
    if (i0 < 0) { out.dist = Infinity; out.index = -1; return out; }
    const t = this.track;
    let best = i0, bd = Infinity;
    for (let o = -6; o <= 6; o++) {
      const i = t.wrap(i0 + o);
      const d = (t.px[i] - x) ** 2 + (t.pz[i] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    out.dist = Math.sqrt(bd);
    out.index = best;
    return out;
  }
}

// ---------------------------------------------------------------------------------------------
// Shared shader snippets
// ---------------------------------------------------------------------------------------------

/** Small scenery (trees, grass, crowd...) lives on this layer so reflection probes can skip it. */
export const DETAIL_LAYER = 1;

const timeUniform = { value: 0 };
const exciteUniform = { value: 0.3 };

function addWind(material, amount) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      {
        float h = max(0.0, position.y);
        vec2 ip = vec2(0.0);
        #ifdef USE_INSTANCING
          ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        #endif
        float s = sin(uTime * 1.6 + ip.x * 0.11 + ip.y * 0.07) + 0.4 * sin(uTime * 3.7 + ip.y * 0.3);
        transformed.x += s * ${amount.toFixed(4)} * h * h;
        transformed.z += s * ${(amount * 0.6).toFixed(4)} * h * h;
      }`,
    );
  };
  material.customProgramCacheKey = () => `wind${amount}`;
}

function colorize(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function colorizeGradient(geo, bottomHex, topHex, y0, y1) {
  const a = new THREE.Color(bottomHex), b = new THREE.Color(topHex);
  const pos = geo.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(a).lerp(b, clamp((pos.getY(i) - y0) / (y1 - y0), 0, 1));
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function jitter(geo, amount, seed) {
  const rng = new RNG(seed);
  const pos = geo.attributes.position;
  // keep shared vertices together by hashing positions
  const map = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!map.has(key)) map.set(key, [rng.range(-1, 1) * amount, rng.range(-1, 1) * amount, rng.range(-1, 1) * amount]);
    const o = map.get(key);
    pos.setXYZ(i, pos.getX(i) + o[0], pos.getY(i) + o[1], pos.getZ(i) + o[2]);
  }
  geo.computeVertexNormals();
  return geo;
}

const merge = (list) => {
  const g = mergeGeometries(list.map((x) => {
    for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'color'].includes(k)) x.deleteAttribute(k);
    return x.index ? x.toNonIndexed() : x;
  }));
  g.computeBoundingSphere();
  return g;
};

// ---------------------------------------------------------------------------------------------
// Vegetation & prop geometry
// ---------------------------------------------------------------------------------------------

function treeGeometry(type, detail) {
  const seg = detail >= 3 ? 10 : detail >= 1 ? 7 : 5;
  switch (type) {
    case 'pine':
    case 'pinesnow': {
      const parts = [colorize(new THREE.CylinderGeometry(0.18, 0.3, 3, seg).translate(0, 1.5, 0), '#5a3d26')];
      const layers = detail >= 2 ? 4 : 3;
      for (let k = 0; k < layers; k++) {
        const r = 2.5 - k * 0.5, h = 3.4 - k * 0.35, y = 2.2 + k * 1.75;
        const cone = new THREE.ConeGeometry(r, h, seg + 2, 1).translate(0, y + h / 2, 0);
        if (type === 'pinesnow') colorizeGradient(cone, '#26402e', '#f4f8fc', y + h * 0.15, y + h * 0.8);
        else colorizeGradient(cone, '#1f3d22', '#3f6b34', y, y + h);
        parts.push(cone);
      }
      return merge(parts);
    }
    case 'oak': {
      const parts = [colorize(new THREE.CylinderGeometry(0.25, 0.4, 3.2, seg).translate(0, 1.6, 0), '#5b4330')];
      const blobs = detail >= 2 ? 5 : 3;
      const rng = new RNG(11);
      for (let k = 0; k < blobs; k++) {
        const ico = new THREE.IcosahedronGeometry(rng.range(1.6, 2.3), detail >= 3 ? 2 : 1);
        jitter(ico, 0.25, k + 3);
        ico.translate(rng.range(-1.2, 1.2), rng.range(3.8, 5.4), rng.range(-1.2, 1.2));
        colorizeGradient(ico, '#2f5a22', '#6c9a3c', 3, 7);
        parts.push(ico);
      }
      return merge(parts);
    }
    case 'bush': {
      const ico = jitter(new THREE.IcosahedronGeometry(1.1, detail >= 2 ? 2 : 1), 0.18, 4);
      ico.scale(1.3, 0.8, 1.2).translate(0, 0.65, 0);
      return merge([colorizeGradient(ico, '#2c4a20', '#5e8a38', 0, 1.4)]);
    }
    case 'palm': {
      const parts = [];
      const segs = 6;
      let x = 0, y = 0;
      for (let k = 0; k < segs; k++) {
        const c = new THREE.CylinderGeometry(0.17 - k * 0.012, 0.2 - k * 0.012, 1.4, seg);
        c.rotateZ(-0.05 * k);
        c.translate(x, y + 0.7, 0);
        parts.push(colorize(c, k % 2 ? '#7a5a3a' : '#8b6a45'));
        x += 0.07 * k;
        y += 1.38;
      }
      for (let k = 0; k < 8; k++) {
        const leaf = new THREE.BoxGeometry(0.5, 0.05, 3.2);
        leaf.translate(0, 0, 1.6);
        leaf.rotateX(0.45);
        leaf.rotateY((k / 8) * TAU);
        leaf.translate(x, y, 0);
        parts.push(colorizeGradient(leaf, '#2e6b2a', '#58a043', y - 1.5, y));
      }
      return merge(parts);
    }
    case 'cactus': {
      const parts = [colorize(new THREE.CylinderGeometry(0.32, 0.36, 4.2, seg).translate(0, 2.1, 0), '#3f7a3c')];
      for (const s of [1, -1]) {
        const arm = new THREE.CylinderGeometry(0.22, 0.24, 1.3, seg).translate(s * 0.75, 2.2, 0);
        const up = new THREE.CylinderGeometry(0.2, 0.22, 1.5, seg).translate(s * 1.05, 2.9, 0);
        parts.push(colorize(arm.rotateZ(0), '#3c7438'), colorize(up, '#3f7a3c'));
      }
      return merge(parts);
    }
    case 'rock': {
      const ico = jitter(new THREE.IcosahedronGeometry(1, detail >= 2 ? 2 : 1), 0.28, 9);
      ico.scale(1.4, 0.8, 1.1).translate(0, 0.35, 0);
      return merge([colorizeGradient(ico, '#5e5a56', '#9a948c', -0.2, 1.1)]);
    }
    default:
      return merge([colorize(new THREE.BoxGeometry(1, 1, 1), '#888')]);
  }
}

function scatter(group, geo, mat, items, chunk, cast, receive = true, tag = '', detail = true) {
  const buckets = new Map();
  for (const it of items) {
    const key = `${Math.floor(it.x / chunk)},${Math.floor(it.z / chunk)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(it);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  const meshes = [];
  for (const list of buckets.values()) {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => {
      q.setFromAxisAngle(up, it.rot || 0);
      s.set(it.sx ?? it.scale, it.sy ?? it.scale, it.sz ?? it.scale);
      p.set(it.x, it.y, it.z);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      if (it.color !== undefined) mesh.setColorAt(i, col.set(it.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.name = tag;
    if (detail) mesh.layers.set(DETAIL_LAYER);
    group.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}

// ---------------------------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------------------------

export class Environment {
  constructor(gfx, scene, stage, track, tier) {
    this.gfx = gfx;
    this.scene = scene;
    this.stage = stage;
    this.track = track;
    this.tier = tier;
    const base = LOOKS[stage.theme];
    this.look = { ...base, id: stage.theme, wet: stage.weather === 'rain' };
    this.weather = stage.weather;
    this.group = new THREE.Group();
    this.group.name = 'environment';
    scene.add(this.group);
    this.disposables = [];
    this.lampPositions = [];
    this.lampLights = [];
    this.time = 0;
    const aniso = Math.min(tier.anisotropy, gfx.maxAnisotropy);
    this.aniso = aniso;
    this.margin = clamp(tier.viewDistance * 0.9, 520, 2600);
    this.df = new DistanceField(track, Math.min(this.margin, 700), 8);
    this.rng = new RNG(stage.seed ^ 0x77);
    this.seaLevel = -1e9;
    if (this.look.sea) {
      let minY = Infinity;
      for (let i = 0; i < track.n; i++) minY = Math.min(minY, track.py[i]);
      this.seaLevel = minY - 4.5;
      const a = this.rng.range(0, TAU);
      this.seaDir = [Math.cos(a), Math.sin(a)];
    }

    const T = (this.timings = {});
    let t0 = performance.now();
    const mark = (k) => { const t = performance.now(); T[k] = Math.round(t - t0); t0 = t; };
    this.#atmosphere();
    this.#sky();
    this.#lights();
    this.#environmentMap();
    mark('sky+env');
    const tm = buildTrackMeshes(track, this.look, tier, aniso);
    mark('trackMeshes');
    this.group.add(tm.group);
    this.trackMeshes = tm;
    this.startLights = tm.startLights;
    this.#terrain();
    mark('terrain');
    this.#vegetation();
    mark('vegetation');
    if (this.look.grass && tier.grass > 0) this.#grass();
    mark('grass');
    this.#grandstands();
    if (this.look.city) this.#city();
    if (this.look.sea) this.#sea();
    if (this.look.mountains && tier.index >= 1) this.#mountains();
    this.#weatherParticles();
    mark('rest');
  }

  // -- atmosphere -----------------------------------------------------------------------------
  #atmosphere() {
    const L = this.look;
    const t = this.tier;
    let far = t.viewDistance;
    let near = far * 0.18;
    this.fogColor = new THREE.Color(L.fog);
    if (this.weather === 'rain') { far *= 0.6; near = 25; this.fogColor.lerp(new THREE.Color('#7d8794'), L.night ? 0.2 : 0.55); }
    if (this.weather === 'snow') { far *= 0.7; near = 35; }
    if (this.weather === 'fog') { far = Math.min(far, 340); near = 8; this.fogColor.lerp(new THREE.Color('#c9c3bc'), 0.5); }
    this.scene.fog = new THREE.Fog(this.fogColor, near, far);
    this.viewFar = Math.max(far * 1.05, 400);
    this.exposure = L.exposure * (this.weather === 'rain' && !L.night ? 0.85 : 1);
    this.grade = {
      saturation: L.night ? 1.12 : this.weather === 'rain' ? 0.88 : this.look.id === 'forest' ? 1.1 : 1.06,
      contrast: this.weather === 'fog' ? 0.96 : 1.05,
      tint: new THREE.Color(this.look.id === 'forest' ? '#fff0e0' : this.look.id === 'snow' ? '#f0f6ff' : L.night ? '#eef0ff' : '#ffffff'),
      vignette: 0.38,
    };
  }

  // -- sky ------------------------------------------------------------------------------------
  #sky() {
    const L = this.look;
    const t = this.tier;
    const sunDir = new THREE.Vector3();
    const el = THREE.MathUtils.degToRad(L.sun.elev), az = THREE.MathUtils.degToRad(L.sun.azim);
    sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
    this.sunDir = sunDir;
    let [top, hor, gnd] = L.sky.map((c) => new THREE.Color(c));
    let cover = L.clouds;
    if (this.weather === 'rain') {
      top.lerp(new THREE.Color(L.night ? '#06070c' : '#5d6672'), 0.75);
      hor.copy(this.fogColor);
      cover = 0.92;
    } else if (this.weather === 'snow') {
      top.lerp(new THREE.Color('#9aa6b4'), 0.6);
      hor.copy(this.fogColor);
      cover = 0.95;
    } else if (this.weather === 'fog') {
      hor.copy(this.fogColor);
      top.lerp(this.fogColor, 0.6);
    } else {
      hor.lerp(this.fogColor, 0.5);
    }
    const uniforms = {
      topColor: { value: top },
      horizonColor: { value: hor },
      groundColor: { value: gnd.lerp(hor, 0.3) },
      sunDir: { value: sunDir },
      sunColor: { value: new THREE.Color(L.sun.color).multiplyScalar(L.night ? 0.6 : 1) },
      cloudCover: { value: cover },
      night: { value: L.night ? 1 : 0 },
      uTime: timeUniform,
    };
    const octaves = t.clouds;
    const mat = new THREE.ShaderMaterial({
      uniforms,
      defines: { CLOUD_OCTAVES: octaves },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor, horizonColor, groundColor, sunDir, sunColor;
        uniform float cloudCover, night, uTime;
        varying vec3 vDir;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) {
          float s = 0.0, a = 0.5;
          for (int i = 0; i < CLOUD_OCTAVES; i++) { s += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
          return s / (1.0 - pow(0.5, float(CLOUD_OCTAVES)));
        }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = h > 0.0
            ? mix(horizonColor, topColor, pow(smoothstep(0.0, 1.0, h), 0.55))
            : mix(horizonColor, groundColor, smoothstep(0.0, -0.2, h));
          float sd = max(dot(d, normalize(sunDir)), 0.0);
          col += sunColor * (pow(sd, 6.0) * 0.18 + pow(sd, 48.0) * 0.35) * (1.0 - night * 0.6);
          col += sunColor * smoothstep(0.9993, 0.9997, sd) * (night > 0.5 ? 2.0 : 18.0);
          #if CLOUD_OCTAVES > 0
          if (h > 0.0) {
            vec2 uv = d.xz / (h + 0.18) * 0.9 + vec2(uTime * 0.006, uTime * 0.002);
            float n = fbm(uv * 1.6);
            float c = smoothstep(1.0 - cloudCover, 1.0 - cloudCover + 0.35, n) * smoothstep(0.0, 0.12, h);
            vec3 cloudLit = mix(horizonColor * 1.05, vec3(1.0), 0.55) * (night > 0.5 ? 0.12 : 1.0);
            cloudLit += sunColor * pow(sd, 5.0) * 0.45;
            vec3 cloudShade = mix(cloudLit * 0.62, horizonColor * 0.7, 0.3);
            col = mix(col, mix(cloudShade, cloudLit, smoothstep(0.4, 0.9, n)), c * 0.92);
          }
          #endif
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const geo = new THREE.SphereGeometry(1, 48, 24);
    const sky = new THREE.Mesh(geo, mat);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    sky.name = 'sky';
    this.sky = sky;
    this.scene.add(sky);
    this.disposables.push(geo, mat);
    this.skyUniforms = uniforms;

    if (L.night || this.look.id === 'snow' && false) {
      const n = t.stars;
      const pos = new Float32Array(n * 3);
      const rng = new RNG(5);
      for (let i = 0; i < n; i++) {
        const u = rng.range(0.05, 1), a = rng.range(0, TAU);
        const r = Math.sqrt(1 - u * u);
        pos[i * 3] = Math.cos(a) * r * 900; pos[i * 3 + 1] = u * 900; pos[i * 3 + 2] = Math.sin(a) * r * 900;
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const sm = new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: this.weather === 'rain' ? 0.15 : 0.85, depthWrite: false });
      this.stars = new THREE.Points(sg, sm);
      this.stars.frustumCulled = false;
      this.stars.renderOrder = -9;
      this.scene.add(this.stars);
      this.disposables.push(sg, sm);
      const moonMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xdfe8ff, fog: false, depthWrite: false, transparent: true });
      this.moon = new THREE.Sprite(moonMat);
      this.moon.scale.set(70, 70, 1);
      this.moon.renderOrder = -8;
      this.scene.add(this.moon);
      this.disposables.push(moonMat);
    }
  }

  // -- lights -----------------------------------------------------------------------------------
  #lights() {
    const L = this.look;
    const t = this.tier;
    const hemi = new THREE.HemisphereLight(L.hemi[0], L.hemi[1], L.hemi[2] * (this.weather === 'rain' && !L.night ? 0.9 : 1));
    this.scene.add(hemi);
    this.hemi = hemi;
    const sunInt = L.sun.intensity * (this.weather === 'rain' ? 0.35 : this.weather === 'snow' ? 0.6 : this.weather === 'fog' ? 0.55 : 1);
    const sun = new THREE.DirectionalLight(L.sun.color, sunInt);
    sun.position.copy(this.sunDir).multiplyScalar(400);
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    if (t.shadowType !== 'none' && t.shadowMap > 0) {
      const size = Math.min(t.shadowMap, this.gfx.caps.maxTexture);
      sun.castShadow = true;
      sun.shadow.mapSize.set(size, size);
      const r = t.shadowRange;
      Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 1200 });
      sun.shadow.camera.updateProjectionMatrix();
      sun.shadow.bias = -0.00025;
      sun.shadow.normalBias = 0.03 + (r / size) * 2;
      sun.shadow.radius = t.shadowType === 'soft' ? 2 : 1;
      this.shadowTexel = (2 * r) / size;
    }
    // basis for texel snapping
    const lz = this.sunDir.clone();
    const lx = new THREE.Vector3(0, 1, 0).cross(lz).normalize();
    if (lx.lengthSq() < 1e-6) lx.set(1, 0, 0);
    const ly = lz.clone().cross(lx).normalize();
    this.lightBasis = { lx, ly, lz };
  }

  #environmentMap() {
    if (this.tier.envMap <= 0) return;
    const r = this.gfx.renderer;
    const pmrem = new THREE.PMREMGenerator(r);
    const envScene = new THREE.Scene();
    const sky = new THREE.Mesh(this.sky.geometry, this.sky.material);
    sky.scale.setScalar(50);
    envScene.add(sky);
    if (this.look.city) {
      // a ring of city lights to give the paint something to reflect at night
      const rng = new RNG(4);
      const cols = ['#ffd38a', '#8ad2ff', '#ff6fb1', '#ffffff'];
      for (let i = 0; i < 46; i++) {
        const a = (i / 46) * TAU;
        const m = new THREE.Mesh(new THREE.BoxGeometry(3, rng.range(2, 9), 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(cols[i % 4]).multiplyScalar(rng.range(1.5, 4)) }));
        m.position.set(Math.cos(a) * 40, rng.range(1, 6), Math.sin(a) * 40);
        m.lookAt(0, m.position.y, 0);
        envScene.add(m);
      }
    } else {
      const ground = new THREE.Mesh(new THREE.CircleGeometry(48, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(this.look.sky[2]).multiplyScalar(0.5) }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -2;
      envScene.add(ground);
    }
    const rt = pmrem.fromScene(envScene, 0.02, 0.1, 200);
    this.scene.environment = rt.texture;
    this.envRT = rt;
    envScene.traverse((o) => {
      if (o !== sky && o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
    });
    pmrem.dispose();
  }

  // -- terrain ----------------------------------------------------------------------------------
  heightAt(x, z, q = { dist: 0, index: -1 }) {
    const L = this.look;
    const tr = this.track;
    this.df.query(x, z, q);
    const dist = q.index >= 0 ? q.dist : Math.max(this.df.reach, Math.hypot(x - this.df.cx, z - this.df.cz) - this.df.radius + this.df.reach);
    const amp = L.terrain.amp;
    let hN = 0;
    if (amp > 0) {
      hN = (fbm2D(x / 260, z / 260, 4, 3) - 0.5) * 2 * amp;
      if (L.terrain.dunes) hN += Math.abs(Math.sin(x / 55 + fbm2D(x / 140, z / 140, 2, 8) * 5)) * 4 - 2;
      const farK = smoothstep(220, 900, dist);
      if (farK > 0) hN += farK * L.terrain.far * (0.35 + fbm2D(x / 520, z / 520, 4, 21));
    }
    if (L.sea) {
      const side = (x - this.df.cx) * this.seaDir[0] + (z - this.df.cz) * this.seaDir[1];
      hN -= smoothstep(this.df.radius * 0.35, this.df.radius * 0.35 + 260, side) * 16;
      hN = Math.max(hN, this.seaLevel - 6);
    }
    if (q.index < 0) return hN;
    const hT = tr.py[q.index] - 0.45;
    const w = smoothstep(tr.wallDist + 1.5, tr.wallDist + 70, q.dist);
    return lerp(hT, hN, w);
  }

  #terrain() {
    const t = this.tier;
    const tr = this.track;
    const size = tr.extent + 2 * this.margin;
    const seg = t.terrain;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    geo.translate(this.df.cx, 0, this.df.cz);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const colors = new Float32Array(pos.count * 3);
    const [ta, tb] = this.look.groundTint.map((c) => new THREE.Color(c));
    const sand = new THREE.Color('#e6cf9a');
    const c = new THREE.Color();
    const q = { dist: 0, index: -1 };
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.heightAt(x, z, q);
      pos.setY(i, h);
      uv.setXY(i, x / 12, z / 12);
      c.copy(ta).lerp(tb, fbm2D(x / 90, z / 90, 3, 41));
      if (this.look.sea) c.lerp(sand, smoothstep(this.seaLevel + 3.5, this.seaLevel + 0.5, h));
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const map = groundTexture(this.look.ground, Math.min(1024, t.texSize), this.aniso);
    const mat = t.material === 0
      ? new THREE.MeshLambertMaterial({ map, vertexColors: true })
      : new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    this.group.add(mesh);
    this.disposables.push(geo, mat);
    this.terrainSize = size;
  }

  /** Random placement candidates around the track with a distance window. */
  #candidates(count, minDist, maxDist, rng, nearBias = 1) {
    const out = [];
    const q = { dist: 0, index: -1 };
    const b = this.track.bounds;
    const pad = Math.min(maxDist, this.margin * 0.9);
    let guard = count * 12;
    while (out.length < count && guard-- > 0) {
      const x = rng.range(b.minX - pad, b.maxX + pad);
      const z = rng.range(b.minZ - pad, b.maxZ + pad);
      this.df.query(x, z, q);
      const dist = q.index >= 0 ? q.dist : Infinity;
      if (dist < minDist) continue;
      if (dist > maxDist && Number.isFinite(maxDist)) continue;
      if (!Number.isFinite(dist) && maxDist < 1e6) continue;
      // denser near the track where it is seen
      if (nearBias > 0 && rng.next() > lerp(1, 0.25, clamp((dist - minDist) / 500, 0, 1) * nearBias)) continue;
      const y = this.heightAt(x, z);
      if (y < this.seaLevel + 0.8) continue;
      out.push({ x, y, z, dist, index: q.index });
    }
    return out;
  }

  #vegetation() {
    const L = this.look;
    const t = this.tier;
    const rng = new RNG(this.stage.seed ^ 0x1234);
    const detail = t.index >= 4 ? 3 : t.index >= 2 ? 2 : t.index >= 1 ? 1 : 0;
    const total = Math.round(L.treeCount * t.trees);
    const minD = this.track.wallDist + (L.city ? 14 : 4);
    const maxD = Math.min(this.margin * 0.85, 300 + t.viewDistance * 0.35);
    const pts = this.#candidates(total, minD, maxD, rng, 1);
    const types = Object.entries(L.trees);
    const byType = new Map(types.map(([k]) => [k, []]));
    for (const p of pts) {
      let r = rng.next(), pick = types[0][0];
      for (const [k, w] of types) { if ((r -= w) <= 0) { pick = k; break; } }
      const big = pick === 'pine' || pick === 'pinesnow' ? rng.range(0.8, 1.7) : pick === 'bush' ? rng.range(0.6, 1.5) : rng.range(0.75, 1.35);
      const tint = new THREE.Color().setHSL(0, 0, rng.range(0.82, 1.12));
      byType.get(pick).push({ x: p.x, y: p.y - 0.15, z: p.z, rot: rng.range(0, TAU), scale: big, color: tint.getHex() });
    }
    const castTrees = t.treeShadows && t.shadowType !== 'none';
    this.windMats = [];
    for (const [type, items] of byType) {
      if (!items.length) continue;
      const geo = treeGeometry(type, detail);
      const mat = t.material === 0
        ? new THREE.MeshLambertMaterial({ vertexColors: true })
        : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.4 });
      if (t.wind && type !== 'cactus') addWind(mat, type === 'palm' ? 0.0022 : 0.0012);
      scatter(this.group, geo, mat, items, 220, castTrees, true, `trees-${type}`);
      this.disposables.push(geo, mat);
    }
    // rocks
    const rocks = Math.round(L.rocks * t.props);
    if (rocks > 0) {
      const rp = this.#candidates(rocks, this.track.wallDist + 2.5, maxD, rng, 1.2);
      const items = rp.map((p) => ({ x: p.x, y: p.y, z: p.z, rot: rng.range(0, TAU), sx: rng.range(0.6, 2.2), sy: rng.range(0.5, 1.6), sz: rng.range(0.6, 2.2), color: new THREE.Color().setHSL(0.08, 0.1, rng.range(0.55, 0.9)).getHex() }));
      const geo = treeGeometry('rock', detail);
      const mat = t.material === 0 ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
      scatter(this.group, geo, mat, items, 220, castTrees, true, 'rocks');
      this.disposables.push(geo, mat);
    }
  }

  #grass() {
    const t = this.tier;
    const rng = new RNG(this.stage.seed ^ 0x9e37);
    const tr = this.track;
    // blade: tapered strip
    const segs = t.index >= 8 ? 4 : 3;
    const pos = [], col = [], idx = [];
    const baseC = new THREE.Color(this.look.id === 'forest' ? '#3a4e1f' : '#3d6a22');
    const tipC = new THREE.Color(this.look.id === 'forest' ? '#a69a52' : '#8fc04f');
    for (let k = 0; k <= segs; k++) {
      const v = k / segs;
      const w = 0.045 * (1 - v * 0.92);
      const bend = v * v * 0.12;
      pos.push(-w, v, bend, w, v, bend);
      const c = baseC.clone().lerp(tipC, v);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (k < segs) {
        const a = k * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // up-facing normals look much better for grass lighting
    const nrm = geo.attributes.normal;
    for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0.2);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    if (t.wind) addWind(mat, 0.09);
    const items = [];
    const count = t.grass;
    const shoulderGrass = this.look.shoulder === 'grass';
    let guard = count;
    const tmp = {};
    while (items.length < count && guard-- > 0) {
      // grass grows in tufts: pick a tuft centre, then scatter blades around it
      const i = Math.floor(rng.next() * tr.n);
      const side = rng.next() < 0.5 ? 1 : -1;
      const onShoulder = shoulderGrass && rng.next() < 0.35;
      const d0 = onShoulder
        ? side * rng.range(tr.halfWidth + tr.curbWidth + 1.2, tr.wallDist - 0.6)
        : side * (tr.wallDist + 0.8 + rng.next() ** 1.7 * 60);
      const c = tr.pointAt(i * tr.ds + rng.range(0, tr.ds), d0, tmp);
      const cx = c.x, cz = c.z;
      const baseY = onShoulder ? tr.py[i] - 0.05 : this.heightAt(cx, cz) + 0.02;
      if (baseY < this.seaLevel + 0.6) continue;
      const blades = 10 + Math.floor(rng.next() * 26);
      const hue = 0.24 + rng.range(-0.035, 0.03);
      for (let b = 0; b < blades && items.length < count; b++) {
        const a = rng.range(0, TAU), r = Math.sqrt(rng.next()) * 0.9;
        const tint = new THREE.Color().setHSL(hue, 0.3, rng.range(0.82, 1));
        items.push({ x: cx + Math.cos(a) * r, y: baseY, z: cz + Math.sin(a) * r, rot: rng.range(0, TAU), sx: rng.range(0.8, 1.4), sy: rng.range(0.22, 0.55), sz: 1, color: tint.getHex() });
      }
    }
    scatter(this.group, geo, mat, items, 70, false, true, 'grass');
    this.disposables.push(geo, mat);
  }

  #grandstands() {
    const t = this.tier;
    const tr = this.track;
    const lambert = t.material === 0;
    const M = (o) => (lambert ? new THREE.MeshLambertMaterial({ color: o.color }) : new THREE.MeshStandardMaterial(o));
    const standMat = M({ color: 0x8f969f, roughness: 0.8, metalness: 0.1 });
    const roofMat = M({ color: 0xd8dde4, roughness: 0.4, metalness: 0.6 });
    const rows = 8;
    const geos = [], roofs = [];
    const seats = [];
    for (const side of [1, -1]) {
      for (let seg = -6; seg <= 18; seg++) {
        const i = tr.wrap(seg * 3);
        const heading = Math.atan2(-tr.nz[i], tr.nx[i]);
        for (let r = 0; r < rows; r++) {
          const d = side * (tr.wallDist + 4 + r * 1.1);
          const p = tr.pointAt(i * tr.ds, d);
          const g = new THREE.BoxGeometry(1.1, 0.55 + r * 0.6, tr.ds * 3 + 0.05);
          g.translate(0, (0.55 + r * 0.6) / 2, 0);
          g.rotateY(heading);
          g.translate(p.x, tr.py[i] - 0.2, p.z);
          geos.push(g);
          seats.push({ x: p.x, y: tr.py[i] - 0.2 + 0.55 + r * 0.6, z: p.z, heading, side, len: tr.ds * 3 });
        }
        // low back wall behind the top row
        const topH = 0.55 + (rows - 1) * 0.6;
        const pb = tr.pointAt(i * tr.ds, side * (tr.wallDist + 4 + rows * 1.1 - 0.35));
        const wall = new THREE.BoxGeometry(0.3, topH + 1.1, tr.ds * 3 + 0.05);
        wall.translate(0, (topH + 1.1) / 2, 0);
        wall.rotateY(heading);
        wall.translate(pb.x, tr.py[i] - 0.2, pb.z);
        geos.push(wall);
        // thin cantilever roof carried by columns at the back
        const roofY = tr.py[i] + topH + 3;
        const pr = tr.pointAt(i * tr.ds, side * (tr.wallDist + 4 + rows * 0.6));
        const roof = new THREE.BoxGeometry(rows * 1.15, 0.1, tr.ds * 3 + 0.05);
        roof.rotateZ(side * 0.1);
        roof.rotateY(heading);
        roof.translate(pr.x, roofY, pr.z);
        roofs.push(roof);
        if (seg % 3 === 0) {
          const col = new THREE.CylinderGeometry(0.12, 0.14, roofY - tr.py[i] + 0.3, 8);
          col.translate(pb.x, (roofY + tr.py[i]) / 2 - 0.15, pb.z);
          geos.push(col);
        }
      }
    }
    const stand = new THREE.Mesh(mergeGeometries(geos), standMat);
    stand.castShadow = stand.receiveShadow = t.shadowType !== 'none';
    const roof = new THREE.Mesh(mergeGeometries(roofs), roofMat);
    roof.castShadow = t.shadowType !== 'none';
    this.group.add(stand, roof);
    this.disposables.push(stand.geometry, roof.geometry, standMat, roofMat);
    geos.forEach((g) => g.dispose());
    roofs.forEach((g) => g.dispose());

    // crowd
    const n = t.crowd;
    if (n <= 0) return;
    const rng = new RNG(3);
    const bodyGeo = new THREE.BoxGeometry(0.42, 0.62, 0.3);
    bodyGeo.translate(0, 0.31, 0);
    const headGeo = new THREE.SphereGeometry(0.13, 8, 6);
    headGeo.translate(0, 0.78, 0);
    const bodyMat = lambert ? new THREE.MeshLambertMaterial() : new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const headMat = lambert ? new THREE.MeshLambertMaterial({ color: 0xd9a77e }) : new THREE.MeshStandardMaterial({ color: 0xd9a77e, roughness: 0.8 });
    for (const m of [bodyMat, headMat]) {
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = timeUniform;
        shader.uniforms.uExcite = exciteUniform;
        shader.vertexShader = 'uniform float uTime;\nuniform float uExcite;\n' + shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float ph = float(gl_InstanceID) * 1.731;
          transformed.y += max(0.0, sin(uTime * (5.0 + mod(ph, 3.0)) + ph)) * 0.22 * uExcite;`,
        );
      };
      m.customProgramCacheKey = () => 'crowd';
    }
    const total = Math.min(n, seats.length * 4);
    const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, total);
    const heads = new THREE.InstancedMesh(headGeo, headMat, total);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    const shirt = ['#e11d48', '#2563eb', '#f59e0b', '#10b981', '#f8fafc', '#111827', '#7c3aed', '#ef4444', '#06b6d4'];
    const c = new THREE.Color();
    for (let k = 0; k < total; k++) {
      const seat = seats[Math.floor(rng.next() * seats.length)];
      const along = rng.range(-0.5, 0.5) * seat.len;
      const fx = Math.sin(seat.heading), fz = Math.cos(seat.heading);
      p.set(seat.x + fx * along, seat.y, seat.z + fz * along);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), seat.heading + (seat.side > 0 ? -Math.PI / 2 : Math.PI / 2));
      s.setScalar(rng.range(0.9, 1.1));
      mtx.compose(p, q, s);
      bodies.setMatrixAt(k, mtx);
      heads.setMatrixAt(k, mtx);
      bodies.setColorAt(k, c.set(shirt[k % shirt.length]));
    }
    bodies.computeBoundingSphere();
    heads.computeBoundingSphere();
    bodies.layers.set(DETAIL_LAYER);
    heads.layers.set(DETAIL_LAYER);
    this.group.add(bodies, heads);
    this.disposables.push(bodyGeo, headGeo, bodyMat, headMat);
  }

  #city() {
    const t = this.tier;
    const tr = this.track;
    const rng = new RNG(this.stage.seed ^ 0xc17);
    // buildings
    const count = Math.round(260 * Math.min(2.5, 0.6 + t.props));
    const pts = this.#candidates(count * 3, tr.wallDist + 16, Math.min(this.margin * 0.8, 520), rng, 0.6);
    const occupied = new Set();
    const items = [];
    for (const p of pts) {
      if (items.length >= count) break;
      const key = `${Math.floor(p.x / 34)},${Math.floor(p.z / 34)}`;
      if (occupied.has(key)) continue;
      occupied.add(key);
      const near = clamp((p.dist - tr.wallDist) / 300, 0, 1);
      const w = rng.range(16, 30), d = rng.range(16, 30);
      const h = rng.range(14, 40) + near * rng.range(10, 70);
      const heading = p.index >= 0 ? Math.atan2(-tr.nz[p.index], tr.nx[p.index]) : 0;
      items.push({ x: p.x, y: p.y - 0.5, z: p.z, rot: heading, sx: w, sy: h, sz: d, color: new THREE.Color().setHSL(rng.range(0.55, 0.65), 0.08, rng.range(0.18, 0.4)).getHex() });
    }
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = t.material === 0
      ? new THREE.MeshLambertMaterial({ color: 0xffffff })
      : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.2 });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = 'varying vec3 vWPos;\nvarying vec3 vWN;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec4 wp = vec4(transformed, 1.0);
          vec3 wn = objectNormal;
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
            wn = mat3(instanceMatrix) * wn;
          #endif
          vWPos = (modelMatrix * wp).xyz;
          vWN = normalize(mat3(modelMatrix) * wn);
        }`,
      );
      shader.fragmentShader = 'varying vec3 vWPos;\nvarying vec3 vWN;\n' + shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec2 fuv = abs(vWN.x) > 0.5 ? vec2(vWPos.z, vWPos.y) : vec2(vWPos.x, vWPos.y);
          vec2 cell = fuv / vec2(3.0, 3.5);
          vec2 f = fract(cell);
          vec2 id = floor(cell);
          float win = step(0.16, f.x) * step(f.x, 0.84) * step(0.22, f.y) * step(f.y, 0.78);
          win *= 1.0 - step(0.5, abs(vWN.y));
          win *= step(1.5, vWPos.y);
          float hsh = fract(sin(dot(id + floor(vWPos.xz * 0.02) * 13.0, vec2(12.9898, 78.233))) * 43758.5453);
          float lit = step(0.5, hsh);
          vec3 wc = mix(vec3(1.0, 0.78, 0.45), vec3(0.65, 0.85, 1.0), step(0.8, hsh));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.04, 0.05, 0.07), win * 0.85);
          totalEmissiveRadiance += win * lit * wc * 1.6;
        }`,
      );
    };
    mat.customProgramCacheKey = () => 'buildings';
    scatter(this.group, geo, mat, items, 300, t.treeShadows && t.shadowType !== 'none', true, 'buildings', false);
    this.disposables.push(geo, mat);

    // street lamps along both barriers
    const spacing = Math.max(10, Math.round(42 / tr.ds));
    const poleGeo = mergeGeometries([
      new THREE.CylinderGeometry(0.12, 0.16, 9, 8).translate(0, 4.5, 0),
      new THREE.BoxGeometry(0.12, 0.12, 2.6).translate(0, 8.9, 1.2),
    ]);
    const headGeo = new THREE.BoxGeometry(0.5, 0.16, 0.9);
    headGeo.translate(0, 8.75, 2.4);
    const poleMat = t.material === 0 ? new THREE.MeshLambertMaterial({ color: 0x30343a }) : new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.5, metalness: 0.7 });
    const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2a8').multiplyScalar(3) });
    const poles = [], heads = [], pools = [];
    let alt = 0;
    for (let i = 0; i < tr.n; i += spacing) {
      const side = alt++ % 2 ? 1 : -1;
      const d = side * (tr.wallDist + 0.8);
      const p = tr.pointAt(i * tr.ds, d);
      const rot = Math.atan2(-side * tr.nx[i], -side * tr.nz[i]);
      const item = { x: p.x, y: tr.py[i], z: p.z, rot, scale: 1 };
      poles.push(item);
      heads.push(item);
      const lp = tr.pointAt(i * tr.ds, d - side * 2.4);
      this.lampPositions.push(new THREE.Vector3(lp.x, tr.py[i] + 8.4, lp.z));
      pools.push({ x: lp.x, y: tr.py[i] + 0.04, z: lp.z, rot: 0, scale: 1 });
    }
    scatter(this.group, poleGeo, poleMat, poles, 300, t.shadowType !== 'none', false, 'lamps');
    scatter(this.group, headGeo, headMat, heads, 300, false, false, 'lampheads');
    const poolGeo = new THREE.PlaneGeometry(16, 16);
    poolGeo.rotateX(-Math.PI / 2);
    const poolMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffc46b, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    scatter(this.group, poolGeo, poolMat, pools, 300, false, false, 'lamppools');
    this.disposables.push(poleGeo, headGeo, poleMat, headMat, poolGeo, poolMat);
    // pooled real point lights moved to the lamps nearest the player
    for (let k = 0; k < t.nightLights; k++) {
      const l = new THREE.PointLight(0xffd59a, 260, 46, 2);
      l.position.set(0, -1000, 0);
      this.scene.add(l);
      this.lampLights.push(l);
    }
    // neon signs
    const words = [['نئون', 'NEON', '#ff2bd6'], ['شتاب', 'SHETAB', '#1ee3ff'], ['شب', 'NIGHT', '#ffb31a'], ['سرعت', 'SPEED', '#7cff4f']];
    const neonGeo = new THREE.PlaneGeometry(14, 4);
    for (let k = 0; k < 14; k++) {
      const it = items[Math.floor(rng.next() * items.length)];
      if (!it) break;
      const w = words[k % words.length];
      const m = new THREE.MeshBasicMaterial({ map: bannerTexture(w[0], w[1], '#0a0a12', w[2]), color: new THREE.Color(2, 2, 2), side: THREE.DoubleSide });
      const sign = new THREE.Mesh(neonGeo, m);
      sign.position.set(it.x, it.y + Math.min(it.sy * 0.8, 24), it.z);
      sign.rotation.y = it.rot + Math.PI / 2;
      this.group.add(sign);
      this.disposables.push(m);
    }
    this.disposables.push(neonGeo);
  }

  #sea() {
    const size = this.terrainSize * 2.2;
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const normal = waterNormalTexture();
    normal.repeat.set(size / 40, size / 40);
    const mat = this.tier.material === 0
      ? new THREE.MeshLambertMaterial({ color: 0x1b5f86 })
      : new THREE.MeshStandardMaterial({ color: 0x0d4a6e, roughness: 0.06, metalness: 0.05, normalMap: normal, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.3 });
    const sea = new THREE.Mesh(geo, mat);
    sea.position.set(this.df.cx, this.seaLevel, this.df.cz);
    sea.receiveShadow = true;
    this.group.add(sea);
    this.water = mat;
    this.waterNormal = normal;
    this.disposables.push(geo, mat);
  }

  #mountains() {
    const t = this.tier;
    const R = Math.min(this.terrainSize * 0.5, this.df.radius + Math.min(t.viewDistance * 0.8, 2200));
    const seg = clamp(Math.round(t.terrain * 0.75), 64, 360);
    const pos = [], col = [], idx = [];
    const base = new THREE.Color(this.look.mountains);
    const snowCap = new THREE.Color('#f4f7fb');
    const cx = this.df.cx, cz = this.df.cz;
    const H = R * 0.11;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * TAU;
      const n = fbm2D(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + 10, 5, 77);
      const h = H * (0.35 + n * 1.1);
      const ca = Math.cos(a), sa = Math.sin(a);
      pos.push(cx + ca * R * 1.08, -30, cz + sa * R * 1.08);
      pos.push(cx + ca * R, h, cz + sa * R);
      pos.push(cx + ca * R * 0.86, -10, cz + sa * R * 0.86);
      const top = this.look.id === 'snow' || this.look.id === 'forest' && h > H * 1.1 ? snowCap : base.clone().multiplyScalar(1.15);
      col.push(base.r * 0.7, base.g * 0.7, base.b * 0.7, top.r, top.g, top.b, base.r * 0.8, base.g * 0.8, base.b * 0.8);
      if (i < seg) {
        const k = i * 3;
        idx.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = t.material === 0 ? new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.name = 'mountains';
    this.group.add(m);
    this.disposables.push(geo, mat);
    this.viewFar = Math.max(this.viewFar, R * 1.15);
  }

  #weatherParticles() {
    const w = this.weather;
    if (w !== 'rain' && w !== 'snow') return;
    const t = this.tier;
    const n = t.weather;
    const rain = w === 'rain';
    const verts = rain ? 2 : 1;
    const seeds = new Float32Array(n * verts * 3);
    const ends = new Float32Array(n * verts);
    const rng = new RNG(8);
    for (let i = 0; i < n; i++) {
      const s = [rng.next(), rng.next(), rng.next()];
      for (let v = 0; v < verts; v++) {
        seeds.set(s, (i * verts + v) * 3);
        ends[i * verts + v] = v;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * verts * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
    const box = rain ? new THREE.Vector3(70, 34, 70) : new THREE.Vector3(80, 40, 80);
    const uniforms = {
      uTime: timeUniform,
      uCam: { value: new THREE.Vector3() },
      uBox: { value: box },
      uSpeed: { value: rain ? 24 : 2.2 },
      uWind: { value: new THREE.Vector3(rain ? 2.5 : 1.2, 0, rain ? 1 : 0.6) },
      uColor: { value: new THREE.Color(rain ? '#b9c7d6' : '#ffffff') },
      uOpacity: { value: rain ? 0.42 : 0.9 },
      uSize: { value: (this.gfx.height || 800) * 0.06 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        uniform float uTime, uSpeed, uSize;
        uniform vec3 uCam, uBox, uWind;
        attribute vec3 aSeed;
        attribute float aEnd;
        varying float vFade;
        void main() {
          vec3 p = aSeed * uBox;
          float sp = uSpeed * (0.8 + aSeed.x * 0.4);
          p.y -= uTime * sp;
          p += uWind * uTime * (0.7 + aSeed.z * 0.6);
          ${rain ? '' : 'p.x += sin(uTime * 0.9 + aSeed.y * 30.0) * 0.8; p.z += cos(uTime * 0.7 + aSeed.x * 20.0) * 0.8;'}
          p = mod(p - uCam + uBox * 0.5, uBox) + uCam - uBox * 0.5;
          ${rain ? 'vec3 vel = normalize(vec3(uWind.x, -uSpeed, uWind.z)); p -= vel * aEnd * 0.85;' : ''}
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          vFade = smoothstep(uBox.x * 0.5, uBox.x * 0.2, length(p - uCam));
          ${rain ? '' : 'gl_PointSize = uSize * (0.6 + aSeed.y) / max(1.0, -mv.z);'}
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vFade;
        void main() {
          ${rain ? 'float a = 1.0;' : 'vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.15, length(c));'}
          gl_FragColor = vec4(uColor, a * uOpacity * vFade);
          #include <colorspace_fragment>
        }`,
    });
    const obj = rain ? new THREE.LineSegments(geo, mat) : new THREE.Points(geo, mat);
    obj.frustumCulled = false;
    obj.renderOrder = 5;
    this.scene.add(obj);
    this.precip = obj;
    this.precipUniforms = uniforms;
    this.disposables.push(geo, mat);
  }

  // -- runtime ------------------------------------------------------------------------------------
  setStartLights(count, green) {
    this.startLights.forEach((l, i) => {
      if (green) l.material.color.setRGB(0.1, 3, 0.4);
      else l.material.color.setRGB(i < count ? 3.2 : 0.15, i < count ? 0.1 : 0, 0);
    });
  }

  setCrowdExcitement(v) {
    exciteUniform.value = v;
  }

  update(dt, camera, focus) {
    this.time += dt;
    timeUniform.value = this.time;
    this.sky.position.copy(camera.position);
    if (this.stars) this.stars.position.copy(camera.position);
    if (this.moon) this.moon.position.copy(camera.position).addScaledVector(this.sunDir, 800);
    if (this.precipUniforms) {
      this.precipUniforms.uCam.value.copy(camera.position);
      this.precipUniforms.uSize.value = (this.gfx.height || 800) * this.gfx.pixelRatio * 0.05;
    }
    if (this.waterNormal) this.waterNormal.offset.set(this.time * 0.01, this.time * 0.006);
    // shadow box follows the focus point with texel snapping (no shimmering)
    if (focus) {
      const sun = this.sun;
      const { lx, ly, lz } = this.lightBasis;
      const cpos = focus;
      if (this.shadowTexel) {
        const tx = this.shadowTexel;
        const a = Math.round(cpos.dot(lx) / tx) * tx;
        const b = Math.round(cpos.dot(ly) / tx) * tx;
        const c = cpos.dot(lz);
        sun.target.position.set(0, 0, 0).addScaledVector(lx, a).addScaledVector(ly, b).addScaledVector(lz, c);
      } else {
        sun.target.position.copy(cpos);
      }
      sun.position.copy(sun.target.position).addScaledVector(lz, 500);
      sun.target.updateMatrixWorld();
      // move pooled lamp lights to the lamps closest to the player
      if (this.lampLights.length && (this._lampTimer = (this._lampTimer || 0) - dt) <= 0) {
        this._lampTimer = 0.2;
        const sorted = this.lampPositions
          .map((p) => [p, p.distanceToSquared(focus)])
          .sort((x, y) => x[1] - y[1]);
        this.lampLights.forEach((l, k) => {
          const e = sorted[k];
          if (e) l.position.copy(e[0]);
        });
      }
    }
  }

  dispose() {
    this.trackMeshes.dispose();
    for (const d of this.disposables) d.dispose?.();
    this.envRT?.dispose();
    this.scene.environment = null;
    this.scene.fog = null;
    for (const o of [this.sky, this.stars, this.moon, this.precip, this.sun, this.sun?.target, this.hemi, ...this.lampLights]) o?.removeFromParent();
    this.group.removeFromParent();
  }
}
