// ساخت دنیای سه‌بعدی مرحله از دادهٔ تولیدشده + برخورددهنده‌ها
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { platTransform, blinkOn, laserOn } from './level.js';
import { mulberry32, clamp, lerp, fa } from './util.js';
import { makeBanner } from './textures.js';

const V3 = THREE.Vector3;
const tmpColor = new THREE.Color();

function boxUV(geo, tile, ox = 0, oy = 0, oz = 0) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + ox, y = pos.getY(i) + oy, z = pos.getZ(i) + oz;
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = x / tile; v = z / tile; }
    else if (ax >= az) { u = z / tile; v = y / tile; }
    else { u = x / tile; v = y / tile; }
    uv[i * 2] = u; uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function colorize(geo, top, sideMul = 0.78, bottomMul = 0.5) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const h = Math.max(0.01, bb.max.y - bb.min.y);
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const ny = nor.getY(i);
    let m;
    if (ny > 0.6) m = 1;
    else if (ny < -0.6) m = bottomMul;
    else m = sideMul * lerp(0.75, 1, (pos.getY(i) - bb.min.y) / h);
    col[i * 3] = top.r * m; col[i * 3 + 1] = top.g * m; col[i * 3 + 2] = top.b * m;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

function prep(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.color) {
    const c = new Float32Array(g.attributes.position.count * 3).fill(1);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  return g;
}

function roundedCyl(r, h, segs = 40) {
  const b = Math.min(0.08, r * 0.15, h * 0.3);
  const pts = [new THREE.Vector2(0, -h / 2), new THREE.Vector2(r - b, -h / 2)];
  for (let i = 1; i <= 3; i++) { const a = (i / 3) * Math.PI / 2; pts.push(new THREE.Vector2(r - b + Math.sin(a) * b, -h / 2 + b - Math.cos(a) * b)); }
  for (let i = 0; i <= 3; i++) { const a = (i / 3) * Math.PI / 2; pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, h / 2 - b + Math.sin(a) * b)); }
  pts.push(new THREE.Vector2(0, h / 2));
  const g = new THREE.LatheGeometry(pts, segs);
  g.computeVertexNormals();
  return g;
}

export class Course {
  constructor(L, ctx) {
    this.L = L;
    this.ctx = ctx;
    this.scene = ctx.scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.dynamic = [];
    this.colliders = [];
    this.hazards = [];
    this.animated = [];
    this.checkpointVis = {};
    this.time = 0;
    this.groundY = ctx.groundY;
    this.build();
  }

  paletteColor(p, i) {
    const pal = this.ctx.palette, theme = this.L.theme;
    const custom = this.ctx.customColor;
    if (custom && custom.enabled) {
      tmpColor.set(custom.base);
      const hsl = {}; tmpColor.getHSL(hsl);
      return new THREE.Color().setHSL(hsl.h, hsl.s, clamp(hsl.l + ((i % 3) - 1) * 0.05, 0, 1));
    }
    if (pal.colors === 'rainbow') return new THREE.Color().setHSL((p.order * 0.07) % 1, 0.75, 0.6);
    const list = pal.colors || theme.palette;
    return new THREE.Color(list[i % list.length]);
  }
  trimColor() {
    const custom = this.ctx.customColor;
    if (custom && custom.enabled) return new THREE.Color(custom.trim);
    return new THREE.Color(this.ctx.palette.trim || this.L.theme.trim);
  }

  build() {
    const L = this.L, A = this.ctx.assets, pal = this.ctx.palette;
    const rng = mulberry32(L.seed ^ 0x5bd1);
    const trimCol = this.trimColor();
    const trimBoost = (pal.trimBoost || 1.4) * (0.8 + L.theme.night * 0.9);
    const glassy = !!pal.glassy;

    this.mats = {
      top: new THREE.MeshStandardMaterial({
        vertexColors: true, map: A.tiles.map, normalMap: A.tiles.normalMap, roughnessMap: A.tiles.roughnessMap,
        roughness: pal.rough ?? 0.72, metalness: pal.metal ?? 0.05, normalScale: new THREE.Vector2(0.8, 0.8), envMapIntensity: glassy ? 1.6 : 1,
      }),
      metal: new THREE.MeshStandardMaterial({
        vertexColors: true, map: A.metal.map, normalMap: A.metal.normalMap, roughnessMap: A.metal.roughnessMap,
        roughness: 0.5, metalness: 0.65, envMapIntensity: 1.2,
      }),
      trim: new THREE.MeshBasicMaterial({ color: trimCol.clone().multiplyScalar(trimBoost), toneMapped: true }),
      under: new THREE.MeshStandardMaterial({ vertexColors: true, map: A.concrete.map, normalMap: A.concrete.normalMap, roughness: 0.92, metalness: 0.02 }),
      crumble: new THREE.MeshStandardMaterial({
        vertexColors: true, map: A.concrete.map, normalMap: A.concrete.normalMap, roughness: 0.9,
        emissive: new THREE.Color('#ff4a1a'), emissiveMap: A.crack, emissiveIntensity: 0.6,
      }),
      ice: new THREE.MeshStandardMaterial({ color: '#cdf3ff', roughness: 0.05, metalness: 0.2, envMapIntensity: 2.0, normalMap: A.concrete.normalMap, normalScale: new THREE.Vector2(0.2, 0.2) }),
      stripes: new THREE.MeshStandardMaterial({ map: A.stripes, roughness: 0.45, metalness: 0.3, emissive: '#ffd23d', emissiveMap: A.stripes, emissiveIntensity: 0.25 }),
      darkMetal: new THREE.MeshStandardMaterial({ color: '#2a2f3a', roughness: 0.35, metalness: 0.85 }),
      bounce: new THREE.MeshStandardMaterial({ color: '#b6ff3d', emissive: '#7dff2a', emissiveIntensity: 1.4, roughness: 0.3 }),
      wall: new THREE.MeshStandardMaterial({ color: '#3a4766', roughness: 0.35, metalness: 0.5, emissive: trimCol.clone(), emissiveMap: A.chevron, emissiveIntensity: 2.2 }),
      conveyor: new THREE.MeshStandardMaterial({ map: A.conveyor, roughness: 0.6, metalness: 0.3, emissive: '#ffffff', emissiveMap: A.conveyor, emissiveIntensity: 0.15 }),
      laser: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a3d').multiplyScalar(4), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }),
      coin: new THREE.MeshStandardMaterial({ color: '#ffc93d', metalness: 1, roughness: 0.22, emissive: '#ff9a00', emissiveIntensity: 0.35, envMapIntensity: 1.6 }),
    };
    this.mats.conveyor.map = A.conveyor.clone();
    this.mats.conveyor.map.needsUpdate = true;
    this.mats.conveyor.emissiveMap = this.mats.conveyor.map;

    const staticTop = [], staticMetal = [], staticTrim = [], staticUnder = [], columns = [];
    const colMat = this.columnMaterial();

    for (let i = 0; i < L.platforms.length; i++) {
      const p = L.platforms[i];
      const color = this.paletteColor(p, i);
      const isDyn = ['mover', 'elevator', 'crumble', 'blink', 'spinner'].includes(p.kind);
      let geo;
      const ox = rng() * 10, oz = rng() * 10;
      if (p.shape === 'cyl') {
        geo = roundedCyl(p.r, p.sy);
      } else {
        const bevel = Math.min(0.09, p.sx * 0.12, p.sy * 0.3, p.sz * 0.12);
        geo = new RoundedBoxGeometry(p.sx, p.sy, p.sz, 2, bevel);
      }
      boxUV(geo, 4, ox, 0, oz);
      if (p.kind === 'start' || p.kind === 'finish') color.lerp(new THREE.Color('#ffffff'), 0.25);
      if (p.kind === 'crumble') color.lerp(new THREE.Color('#c77a4a'), 0.55);
      if (p.kind === 'checkpoint') color.lerp(new THREE.Color('#ffffff'), 0.2);
      colorize(geo, color);
      const metalKind = p.kind === 'mover' || p.kind === 'elevator' || p.kind === 'spinner' || p.beam;
      let mat = metalKind ? this.mats.metal : this.mats.top;
      if (p.kind === 'crumble') mat = this.mats.crumble;
      if (p.kind === 'ice') mat = this.mats.ice;
      if (p.kind === 'wall') mat = this.mats.wall;
      if (p.kind === 'blink') {
        mat = new THREE.MeshStandardMaterial({ color, emissive: trimCol, emissiveIntensity: 0.9, transparent: true, opacity: 1, roughness: 0.3, metalness: 0.2 });
      }

      // لبهٔ نورانی بالای سکو
      const trims = [];
      if (p.kind !== 'wall') {
        if (p.shape === 'cyl') {
          const t = new THREE.TorusGeometry(p.r + 0.005, 0.035, 6, 48);
          t.rotateX(Math.PI / 2);
          t.translate(0, p.sy / 2 - 0.05, 0);
          trims.push(t);
        } else {
          const hy = p.sy / 2 - 0.05, w = 0.045;
          for (const [sx, sz, x, z] of [
            [p.sx, w, 0, p.sz / 2 + 0.005], [p.sx, w, 0, -p.sz / 2 - 0.005],
            [w, p.sz, p.sx / 2 + 0.005, 0], [w, p.sz, -p.sx / 2 - 0.005, 0],
          ]) {
            const t = new THREE.BoxGeometry(sx, 0.05, sz);
            t.translate(x, hy, z);
            trims.push(t);
          }
        }
      }

      if (!isDyn) {
        const m = new THREE.Matrix4().compose(new V3(p.x, p.y, p.z), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), p.yaw), new V3(1, 1, 1));
        const g = prep(geo).applyMatrix4(m);
        if (mat === this.mats.top) staticTop.push(g);
        else if (mat === this.mats.metal) staticMetal.push(g);
        else {
          const mesh = new THREE.Mesh(g, mat);
          mesh.castShadow = mesh.receiveShadow = true;
          this.group.add(mesh);
          if (p.kind === 'wall') this.animated.push({ type: 'chevron', mat });
        }
        for (const t of trims) staticTrim.push(prep(t).applyMatrix4(m));
        // ستون/ساختمان زیر سکو
        if (p.column && colMat && this.groundY !== undefined) {
          const bottom = p.y - p.sy / 2;
          const h = bottom - this.groundY;
          if (h > 2) {
            let cg;
            const style = L.theme.column;
            if (p.shape === 'cyl') {
              cg = new THREE.CylinderGeometry(p.r * 0.92, p.r * (style === 'rock' ? 1.3 : 1.0), h, 24, Math.max(1, Math.floor(h / 6)));
            } else if (style === 'rock' || style === 'basalt' || style === 'ice' || style === 'tree') {
              const rr = Math.min(p.sx, p.sz) * 0.5;
              const sides = style === 'basalt' || style === 'ice' ? 6 : 10;
              cg = new THREE.CylinderGeometry(rr * (style === 'tree' ? 0.45 : 0.92), rr * (style === 'tree' ? 0.7 : 1.25), h, sides, Math.max(1, Math.floor(h / 5)));
              const cp = cg.attributes.position;
              const vr = mulberry32(i * 13 + 7);
              for (let k = 0; k < cp.count; k++) {
                const x = cp.getX(k), z = cp.getZ(k);
                const n = 1 + (vr() - 0.5) * (style === 'rock' ? 0.18 : 0.05);
                cp.setXYZ(k, x * n, cp.getY(k), z * n);
              }
              cg.computeVertexNormals();
            } else {
              cg = new THREE.BoxGeometry(p.sx + 0.2, h, p.sz + 0.2);
            }
            cg.translate(0, -h / 2, 0);
            const cm = new THREE.Matrix4().compose(new V3(p.x, bottom, p.z), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), p.yaw), new V3(1, 1, 1));
            cg.applyMatrix4(cm);
            const g = prep(cg);
            this.columnUV(g, style);
            columns.push(g);
          }
        } else if (p.kind === 'static' || p.kind === 'checkpoint' || p.kind === 'ice' || p.kind === 'conveyor' || p.kind === 'bounce') {
          // زیر سکوی معلق: تکهٔ سنگ/سازه
          const depth = Math.min(3.5, 0.6 + Math.min(p.sx || p.r * 2, p.sz || p.r * 2) * 0.55);
          let ug;
          if (p.shape === 'cyl') ug = new THREE.ConeGeometry(p.r * 0.95, depth, 16, 2);
          else {
            ug = new THREE.CylinderGeometry(0.71, 0.18, depth, 4, 2);
            ug.rotateY(Math.PI / 4);
            ug.scale(p.sx * 0.98, 1, p.sz * 0.98);
          }
          if (p.shape === 'cyl') ug.rotateX(Math.PI);
          ug.translate(0, -p.sy / 2 - depth / 2 + 0.02, 0);
          boxUV(ug, 3, ox, 0, oz);
          colorize(ug, color.clone().multiplyScalar(0.55), 0.8, 0.6);
          const g = prep(ug).applyMatrix4(m);
          staticUnder.push(g);
        }
      } else {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = mesh.receiveShadow = true;
        for (const t of trims) {
          const tm = new THREE.Mesh(t, p.kind === 'crumble' ? new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6a2a').multiplyScalar(2) }) : this.mats.trim);
          mesh.add(tm);
        }
        // پیشران زیر سکوی متحرک
        if (p.kind === 'mover' || p.kind === 'elevator') {
          const thr = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.18, 0.3, 16), this.mats.darkMetal);
          thr.position.y = -p.sy / 2 - 0.12;
          mesh.add(thr);
          const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: A.soft, color: trimCol.clone().multiplyScalar(2.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
          glow.scale.set(1.6, 1.6, 1);
          glow.position.y = -p.sy / 2 - 0.35;
          mesh.add(glow);
          this.animated.push({ type: 'thruster', sprite: glow, seed: rng() * 10 });
        }
        if (p.kind === 'spinner') {
          for (const s of [-1, 1]) {
            const end = new THREE.Mesh(new THREE.BoxGeometry(p.sx + 0.02, p.sy + 0.02, 0.6), this.mats.stripes);
            end.position.z = s * (p.sz / 2 - 0.3);
            mesh.add(end);
          }
          const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 6, 16), this.mats.darkMetal);
          hub.position.y = -3.2;
          this.group.add(hub);
          hub.position.set(p.x, p.y - 3.2, p.z);
        }
        this.group.add(mesh);
        this.dynamic.push({ p, mesh, state: 'idle', timer: 0, baseY: 0 });
      }

      // موارد ویژه روی سکو
      if (p.kind === 'bounce') this.buildBouncePad(p);
      if (p.kind === 'conveyor') this.buildConveyor(p);
      if (p.kind === 'checkpoint') this.buildCheckpoint(p);
      if (p.kind === 'start') this.buildGate(p, 'start');
      if (p.kind === 'finish') this.buildGate(p, 'finish');

      // برخورددهنده
      const col = {
        id: i, p, shape: p.shape, hx: (p.sx || 0) / 2, hy: p.sy / 2, hz: (p.sz || 0) / 2, r: p.r || 0,
        cx: p.x, cy: p.y, cz: p.z, yaw: p.yaw, cos: Math.cos(p.yaw), sin: Math.sin(p.yaw),
        top: p.top, bottom: p.y - p.sy / 2, solid: true, dynamic: isDyn,
        dx: 0, dy: 0, dz: 0, dyaw: 0, kind: p.kind, wall: p.kind === 'wall',
        bound: p.shape === 'cyl' ? p.r : Math.hypot(p.sx, p.sz) / 2,
      };
      this.colliders.push(col);
      p.col = col;
    }

    const addMerged = (list, mat, shadow = true) => {
      if (!list.length) return;
      const g = mergeGeometries(list, false);
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      list.forEach((x) => x.dispose());
      return mesh;
    };
    addMerged(staticTop, this.mats.top);
    addMerged(staticMetal, this.mats.metal);
    addMerged(staticTrim, this.mats.trim, false);
    addMerged(staticUnder, this.mats.under);
    if (columns.length && colMat) {
      const cm = addMerged(columns, colMat, false);
      if (cm) cm.receiveShadow = true;
    }

    // موانع
    for (const h of L.hazards) this.buildHazard(h);
    this.buildCoins();
    if (L.tower) this.buildTower();
  }

  columnMaterial() {
    const A = this.ctx.assets, th = this.L.theme;
    const style = th.column;
    if (style === 'none') return null;
    if (style === 'building')
      return new THREE.MeshStandardMaterial({ map: A.facade.map, emissiveMap: A.facade.emissiveMap, emissive: '#ffffff', emissiveIntensity: 0.18 + th.night * 0.75, roughness: 0.55, metalness: 0.35, color: th.id === 'neon' ? '#5a5878' : '#d7dbe3' });
    if (style === 'rock') return new THREE.MeshStandardMaterial({ map: A.rock.map, normalMap: A.rock.normalMap, color: th.id === 'desert' ? '#e0a072' : '#b8ab9c', roughness: 0.95 });
    if (style === 'basalt') return new THREE.MeshStandardMaterial({ map: A.rock.map, normalMap: A.rock.normalMap, color: '#3a3330', roughness: 0.9, emissive: '#ff3a0a', emissiveMap: A.crack, emissiveIntensity: 1.2 });
    if (style === 'ice') return new THREE.MeshStandardMaterial({ color: '#a8e4ff', roughness: 0.08, metalness: 0.15, envMapIntensity: 1.8, transparent: true, opacity: 0.88 });
    if (style === 'tree') return new THREE.MeshStandardMaterial({ map: A.rock.map, normalMap: A.rock.normalMap, color: '#6b4a32', roughness: 1 });
    return null;
  }
  columnUV(g, style) {
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const horiz = Math.abs(nor.getX(i)) > Math.abs(nor.getZ(i)) ? z : x;
      if (style === 'building') uv.setXY(i, horiz / 25.6, y / 57.6);
      else uv.setXY(i, horiz / 8, y / 8);
    }
    uv.needsUpdate = true;
  }

  buildBouncePad(p) {
    const A = this.ctx.assets;
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.18, 32), this.mats.darkMetal);
    base.position.y = 0.09;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.1, 32), this.mats.bounce);
    pad.position.y = 0.22;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color('#b6ff3d').multiplyScalar(3) }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: A.soft, color: new THREE.Color('#9dff3d').multiplyScalar(1.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
    glow.scale.set(3.5, 3.5, 1);
    glow.position.y = 0.6;
    g.add(base, pad, ring, glow);
    g.position.set(p.x, p.top, p.z);
    this.group.add(g);
    p.padMesh = pad;
    this.animated.push({ type: 'bounce', p, pad, ring, t: 0 });
  }
  buildConveyor(p) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(p.sx * 0.92, p.sz * 0.96), this.mats.conveyor);
    plane.rotation.x = -Math.PI / 2;
    plane.rotation.z = Math.atan2(p.belt.x, -p.belt.z) + 0; // جهت فلش‌ها
    plane.position.set(0, p.sy / 2 + 0.012, 0);
    const holder = new THREE.Group();
    holder.position.set(p.x, p.y, p.z);
    holder.rotation.y = p.yaw;
    holder.add(plane);
    this.group.add(holder);
    const tex = this.mats.conveyor.map;
    tex.repeat.set(p.sx / 3, p.sz / 3);
    this.animated.push({ type: 'conveyor', tex, speed: p.beltSpeed / 3 });
  }
  buildCheckpoint(p) {
    const A = this.ctx.assets;
    const g = new THREE.Group();
    g.position.set(p.x, p.top, p.z);
    g.rotation.y = p.yaw;
    const color = new THREE.Color('#3de1ff');
    const ringMat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(3) });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.07, 8, 64), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    // پرتو نور
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: color.clone() }, uTime: this.ctx.world.shared.uTime },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
      fragmentShader: `uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
        void main(){ float a = pow(1.0 - vUv.y, 2.2) * 0.42 * (0.85 + 0.15 * sin(uTime * 3.0 + vUv.x * 30.0));
          a *= 0.7 + 0.3 * smoothstep(0.0, 0.5, fract(vUv.y * 6.0 - uTime * 0.6));
          gl_FragColor = vec4(uColor * 1.6, a); }`,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.3, 26, 32, 1, true), beamMat);
    beam.position.y = 13;
    // میلهٔ پرچم
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 10), this.mats.darkMetal);
    pole.position.set(2.6, 2.1, 0);
    pole.castShadow = true;
    const flagGeo = new THREE.PlaneGeometry(1.6, 1, 12, 6);
    flagGeo.translate(0.8, 0, 0);
    const flagMat = new THREE.MeshStandardMaterial({ color: '#3de1ff', emissive: '#3de1ff', emissiveIntensity: 0.6, side: THREE.DoubleSide, roughness: 0.6 });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(2.6, 3.6, 0);
    flag.castShadow = true;
    const base = flagGeo.attributes.position.array.slice();
    g.add(ring, beam, pole, flag);
    this.group.add(g);
    this.checkpointVis[p.id] = { ringMat, beamMat, flagMat, flag, base, active: false, g };
    this.animated.push({ type: 'flag', flag, base, seed: p.id });
  }
  activateCheckpoint(id) {
    const v = this.checkpointVis[id];
    if (!v || v.active) return;
    v.active = true;
    const c = new THREE.Color('#4dff8a');
    v.ringMat.color.copy(c).multiplyScalar(3);
    v.beamMat.uniforms.uColor.value.copy(c);
    v.flagMat.color.copy(c);
    v.flagMat.emissive.copy(c);
  }
  buildGate(p, kind) {
    const g = new THREE.Group();
    g.position.set(p.x, p.top, p.z);
    g.rotation.y = p.yaw;
    const zOff = kind === 'start' ? p.sz / 2 - 1.2 : -p.sz / 2 + 1.5;
    const w = p.sx - 1.6;
    const pillarGeo = new THREE.BoxGeometry(0.9, 7.5, 0.9);
    const lvl = `مرحله ${fa(this.L.level)}`;
    const bannerTex = makeBanner(kind === 'start' ? 'شروع' : 'خط پایان', lvl, kind === 'start' ? ['#3d7bff', '#3de1ff'] : ['#ff7a3d', '#ff3d8b']);
    for (const s of [-1, 1]) {
      const pl = new THREE.Mesh(pillarGeo, this.mats.darkMetal);
      pl.position.set(s * w / 2, 3.75, zOff);
      pl.castShadow = true;
      g.add(pl);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 7.2, 0.95), this.mats.trim);
      strip.position.set(s * (w / 2 - 0.45), 3.75, zOff);
      g.add(strip);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.9, 1.0, 0.9), this.mats.darkMetal);
    top.position.set(0, 7.6, zOff);
    g.add(top);
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, w * 0.9 / 4), bannerMat);
    banner.position.set(0, 9.0, zOff);
    if (kind === 'finish') banner.rotation.y = Math.PI;
    g.add(banner);
    const back = banner.clone();
    back.rotation.y = kind === 'finish' ? 0 : Math.PI;
    back.position.z = zOff + (kind === 'finish' ? 0.02 : -0.02);
    g.add(back);
    if (kind === 'finish') {
      // کف شطرنجی
      const ch = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.2), new THREE.MeshStandardMaterial({ map: this.ctx.assets.checker, roughness: 0.6 }));
      ch.rotation.x = -Math.PI / 2;
      ch.position.set(0, 0.015, zOff);
      ch.receiveShadow = true;
      g.add(ch);
      this.finishZ = zOff;
    } else {
      // چراغ‌های شمارش معکوس
      this.startLights = [];
      for (let i = 0; i < 3; i++) {
        const lm = new THREE.MeshBasicMaterial({ color: '#331111' });
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), lm);
        l.position.set((i - 1) * 1.1, 6.7, zOff + 0.5);
        g.add(l);
        this.startLights.push(lm);
      }
      // خطوط شروع
      for (let i = 0; i < 7; i++) {
        const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 3), this.mats.trim);
        ln.rotation.x = -Math.PI / 2;
        ln.position.set((i - 3) * 2, 0.012, -3);
        g.add(ln);
      }
    }
    this.group.add(g);
  }
  setStartLights(n, go) {
    if (!this.startLights) return;
    this.startLights.forEach((m, i) => {
      if (go) m.color.set('#3dff6a').multiplyScalar(4);
      else m.color.set(i < n ? '#ff2a2a' : '#331111').multiplyScalar(i < n ? 4 : 1);
    });
  }

  buildHazard(h) {
    const p = this.L.platforms[h.p];
    const holder = new THREE.Group();
    this.group.add(holder);
    const topOff = p.top - p.y;
    const H = { ...h, plat: p, holder, topOff };
    if (h.type === 'bar') {
      const hgt = h.y1 - h.y0;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(h.w, hgt, 0.35), this.mats.stripes);
      bar.position.set(0, topOff + h.y0 + hgt / 2, h.lz);
      bar.castShadow = true;
      const edge = new THREE.Mesh(new THREE.BoxGeometry(h.w + 0.02, 0.06, 0.37), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd23d').multiplyScalar(3) }));
      edge.position.set(0, topOff + h.y0 + 0.03, h.lz);
      holder.add(bar, edge);
      // برخورددهندهٔ جامد
      const col = {
        id: -1, p, shape: 'box', hx: h.w / 2, hy: hgt / 2, hz: 0.175, r: 0, local: { lx: 0, ly: topOff + h.y0 + hgt / 2, lz: h.lz },
        cx: 0, cy: 0, cz: 0, yaw: p.yaw, cos: 1, sin: 0, top: 0, bottom: 0, solid: true, dynamic: false, dx: 0, dy: 0, dz: 0, dyaw: 0, kind: 'bar', bound: h.w / 2 + 0.3,
      };
      this.colliders.push(col);
      H.col = col;
    } else if (h.type === 'sweeper') {
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, h.h + 0.6, 16), this.mats.darkMetal);
      hub.position.y = topOff + (h.h + 0.6) / 2;
      const arm = new THREE.Group();
      const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, h.len), this.mats.stripes);
      armMesh.castShadow = true;
      arm.add(armMesh);
      for (const s of [-1, 1]) {
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3d3d').multiplyScalar(3) }));
        tip.position.z = s * h.len / 2;
        arm.add(tip);
      }
      arm.position.y = topOff + h.h;
      holder.add(hub, arm);
      H.arm = arm;
    } else if (h.type === 'laser') {
      const posts = [];
      for (const s of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.3, 0.28), this.mats.darkMetal);
        post.position.set(s * (h.w / 2 + 0.2), topOff + 1.15, h.lz);
        post.castShadow = true;
        holder.add(post);
        posts.push(post);
      }
      const heights = h.low ? [0.45] : [0.35, 0.95, 1.55, 2.1];
      const beams = [];
      for (const y of heights) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, h.w + 0.3, 8), this.mats.laser.clone());
        b.rotation.z = Math.PI / 2;
        b.position.set(0, topOff + y, h.lz);
        const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, h.w + 0.3, 8, 1, true), b.material.clone());
        glow.material.opacity = 0.25;
        b.add(glow);
        holder.add(b);
        beams.push(b);
      }
      H.beams = beams;
      H.heights = heights;
    } else if (h.type === 'hammer') {
      const w = p.sx;
      const pivotY = topOff + h.arm + 0.5;
      for (const s of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, pivotY - topOff + 0.4, 0.3), this.mats.darkMetal);
        post.position.set(s * (w / 2 + 1.4), topOff + (pivotY - topOff + 0.4) / 2, h.lz);
        post.castShadow = true;
        holder.add(post);
      }
      const cross = new THREE.Mesh(new THREE.BoxGeometry(w + 3.1, 0.3, 0.3), this.mats.darkMetal);
      cross.position.set(0, pivotY + 0.2, h.lz);
      holder.add(cross);
      const pend = new THREE.Group();
      pend.position.set(0, pivotY, h.lz);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, h.arm, 8), this.mats.darkMetal);
      rod.position.y = -h.arm / 2;
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.5, 24), this.mats.stripes);
      head.rotation.x = Math.PI / 2;
      head.position.y = -h.arm;
      head.castShadow = true;
      const caps = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 1.56, 24, 1, true), this.mats.darkMetal);
      caps.rotation.x = Math.PI / 2;
      caps.position.y = -h.arm;
      caps.scale.set(1, 0.18, 1);
      pend.add(rod, head, caps);
      holder.add(pend);
      H.pend = pend;
      H.pivotY = pivotY;
    }
    this.hazards.push(H);
  }

  buildCoins() {
    const coins = this.L.coins;
    this.coinState = coins.map((c) => ({ ...c, taken: false, fly: 0, t: Math.random() * 6 }));
    if (!coins.length) return;
    const geo = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 28);
    geo.rotateX(Math.PI / 2);
    const rim = new THREE.TorusGeometry(0.34, 0.035, 6, 28);
    const merged = mergeGeometries([prep(geo), prep(rim)]);
    this.coinMesh = new THREE.InstancedMesh(merged, this.mats.coin, coins.length);
    this.coinMesh.castShadow = true;
    this.coinMesh.frustumCulled = false;
    this.group.add(this.coinMesh);
    this.updateCoins(0);
  }

  buildTower() {
    const T = this.L.tower;
    const h = this.L.bounds.maxY - this.groundY + 80;
    const g = new THREE.CylinderGeometry(T.r, T.r * 1.15, h, 48, 24, false);
    g.translate(0, h / 2 + this.groundY, 0);
    const mat = new THREE.MeshStandardMaterial({ map: this.ctx.assets.facade.map, emissiveMap: this.ctx.assets.facade.emissiveMap, emissive: '#ffffff', emissiveIntensity: 0.25 + this.L.theme.night * 0.8, roughness: 0.5, metalness: 0.4, color: '#c9cfdb' });
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, (g.attributes.position.getY(i)) / 57.6);
    const tower = new THREE.Mesh(g, mat);
    tower.receiveShadow = true;
    this.group.add(tower);
    // حلقه‌های نورانی
    for (let y = this.groundY + 20; y < this.L.bounds.maxY + 60; y += 14) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(T.r + 0.2, 0.18, 8, 64), this.mats.trim);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      this.group.add(ring);
    }
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.ctx.assets.soft, color: new THREE.Color('#ff3d3d').multiplyScalar(3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    beacon.scale.set(12, 12, 1);
    beacon.position.y = this.groundY + h + 2;
    this.group.add(beacon);
    this.animated.push({ type: 'beacon', sprite: beacon });
    // برخورددهندهٔ برج (دیوار)
    this.colliders.push({ id: -2, p: null, shape: 'cyl', r: T.r, hy: h / 2, cx: 0, cy: this.groundY + h / 2, cz: 0, yaw: 0, cos: 1, sin: 0, top: this.groundY + h, bottom: this.groundY, solid: true, dynamic: false, dx: 0, dy: 0, dz: 0, dyaw: 0, kind: 'tower', bound: T.r });
  }

  // به‌روزرسانی برخورددهنده‌ها برای زمان t (در هر زیرگام فیزیک)
  updateColliders(t) {
    const tr = this._tr2 || (this._tr2 = { x: 0, y: 0, z: 0, yaw: 0 });
    for (const c of this.colliders) {
      if (!c.p) continue;
      const p = c.p;
      const moving = c.dynamic || c.local;
      if (!moving && c._init) continue;
      platTransform(p, t, tr);
      let { x, y, z, yaw } = tr;
      if (c.local) {
        const cs = Math.cos(yaw), sn = Math.sin(yaw);
        x += cs * c.local.lx + sn * c.local.lz;
        z += -sn * c.local.lx + cs * c.local.lz;
        y += c.local.ly;
      }
      if (c._init) {
        c.dx = x - c.cx; c.dy = y - c.cy; c.dz = z - c.cz; c.dyaw = yaw - c.yaw;
      }
      c.cx = x; c.cy = y; c.cz = z; c.yaw = yaw;
      c.cos = Math.cos(yaw); c.sin = Math.sin(yaw);
      c.top = y + c.hy; c.bottom = y - c.hy;
      if (c.shape === 'box' && !c.local) { c.top = y + p.sy / 2; c.bottom = y - p.sy / 2; }
      c._init = true;
      // وضعیت جامد بودن
      if (p.kind === 'blink') c.solid = blinkOn(p, t);
      else if (p.kind === 'crumble') c.solid = !p._fallen;
    }
  }

  nearby(pos, radius, out = []) {
    out.length = 0;
    for (const c of this.colliders) {
      const dx = c.cx - pos.x, dz = c.cz - pos.z;
      const r = radius + c.bound;
      if (dx * dx + dz * dz < r * r) out.push(c);
    }
    return out;
  }

  // فعال‌سازی سکوی فروریزنده وقتی بازیکن رویش ایستاد
  touchCrumble(col) {
    const d = this.dynamic.find((x) => x.p === col.p);
    if (d && d.state === 'idle') {
      d.state = 'shaking';
      d.timer = 0.55;
      this.ctx.onCrumble && this.ctx.onCrumble(col.p);
    }
  }

  update(t, dt) {
    this.time = t;
    const tr = this._tr || (this._tr = { x: 0, y: 0, z: 0, yaw: 0 });
    for (const d of this.dynamic) {
      const p = d.p;
      platTransform(p, t, tr);
      d.mesh.position.set(tr.x, tr.y, tr.z);
      d.mesh.rotation.y = tr.yaw;
      if (p.kind === 'crumble') {
        if (d.state === 'shaking') {
          d.timer -= dt;
          d.mesh.position.x += (Math.random() - 0.5) * 0.08;
          d.mesh.position.z += (Math.random() - 0.5) * 0.08;
          d.mesh.rotation.z = (Math.random() - 0.5) * 0.05;
          if (d.timer <= 0) { d.state = 'falling'; d.timer = 4.5; d.vy = 0; d.off = 0; p._fallen = true; this.ctx.onCrumbleFall && this.ctx.onCrumbleFall(p); }
        } else if (d.state === 'falling') {
          d.timer -= dt;
          d.vy -= 22 * dt;
          d.off += d.vy * dt;
          d.mesh.position.y = tr.y + d.off;
          d.mesh.rotation.x += dt * 0.8;
          d.mesh.rotation.z += dt * 0.5;
          d.mesh.visible = d.off > -60;
          if (d.timer <= 0) { d.state = 'respawn'; d.timer = 0.6; }
        } else if (d.state === 'respawn') {
          d.timer -= dt;
          d.mesh.visible = true;
          const k = 1 - Math.max(0, d.timer) / 0.6;
          d.mesh.scale.setScalar(Math.max(0.01, k));
          d.mesh.rotation.set(0, tr.yaw, 0);
          if (d.timer <= 0) { d.state = 'idle'; p._fallen = false; d.mesh.scale.setScalar(1); }
        }
      } else if (p.kind === 'blink') {
        const on = blinkOn(p, t);
        const f = ((t / p.period + p.phase) % 1 + 1) % 1;
        // هشدار چشمک‌زن قبل از خاموش شدن
        const warn = on && f > p.onFrac - 0.18;
        const target = on ? (warn ? (Math.sin(t * 40) > 0 ? 1 : 0.35) : 1) : 0.12;
        d.mesh.material.opacity = lerp(d.mesh.material.opacity, target, Math.min(1, dt * 20));
        d.mesh.material.emissiveIntensity = on ? 0.9 : 2.5;
        d.mesh.material.depthWrite = on;
        d.mesh.castShadow = on;
      }
    }
    // موانع
    for (const H of this.hazards) {
      const p = H.plat;
      platTransform(p, t, tr);
      H.holder.position.set(tr.x, tr.y, tr.z);
      H.holder.rotation.y = tr.yaw;
      if (H.type === 'sweeper') H.arm.rotation.y = t * H.speed + H.phase;
      else if (H.type === 'hammer') H.pend.rotation.z = Math.sin(t * H.speed + H.phase) * H.amp;
      else if (H.type === 'laser') {
        const on = laserOn(H, t);
        const f = ((t / H.period + H.phase) % 1 + 1) % 1;
        const warn = !on && f > 0.82;
        for (const b of H.beams) {
          const o = on ? 0.85 + Math.random() * 0.15 : warn ? (Math.sin(t * 50) > 0 ? 0.4 : 0.05) : 0.04;
          b.material.opacity = o;
          b.children[0].material.opacity = on ? 0.3 : 0;
        }
      }
    }
    for (const a of this.animated) {
      if (a.type === 'flag') {
        const pos = a.flag.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = a.base[i * 3], y = a.base[i * 3 + 1];
          pos.setZ(i, Math.sin(x * 3.2 - t * 6 + a.seed) * 0.14 * x + Math.sin(y * 4 + t * 3) * 0.03 * x);
        }
        pos.needsUpdate = true;
        a.flag.geometry.computeVertexNormals();
      } else if (a.type === 'thruster') {
        const s = 1.4 + Math.sin(t * 20 + a.seed) * 0.15 + Math.random() * 0.1;
        a.sprite.scale.set(s, s, 1);
      } else if (a.type === 'conveyor') {
        a.tex.offset.y -= a.speed * dt;
      } else if (a.type === 'chevron') {
        a.mat.emissiveIntensity = 1.6 + Math.sin(t * 5) * 0.6;
      } else if (a.type === 'bounce') {
        a.t = Math.max(0, a.t - dt * 4);
        const sq = Math.sin(a.t * Math.PI) * 0.6;
        a.pad.scale.set(1 + sq * 0.2, 1 - sq, 1 + sq * 0.2);
        a.ring.scale.setScalar(1 + (1 - a.t) * 0.0 + Math.sin(t * 4) * 0.04);
      } else if (a.type === 'beacon') {
        a.sprite.material.opacity = Math.sin(t * 2.5) > 0 ? 1 : 0.2;
      }
    }
    this.mats.crumble.emissiveIntensity = 0.5 + Math.sin(t * 4) * 0.2;
    this.updateCoins(dt);
  }

  bouncePlat(p) {
    const a = this.animated.find((x) => x.type === 'bounce' && x.p === p);
    if (a) a.t = 1;
  }

  updateCoins(dt) {
    if (!this.coinMesh) return;
    const C = this._cc || (this._cc = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new V3(), pos: new V3(), up: new V3(0, 1, 0) });
    const { m, q, s, pos, up } = C;
    this.coinState.forEach((c, i) => {
      c.t += dt;
      if (c.taken && c.fly <= 0) {
        s.setScalar(0);
      } else {
        q.setFromAxisAngle(up, c.t * 2.6);
        const sc = c.taken ? Math.max(0, c.fly / 0.25) : 1;
        s.setScalar(sc);
      }
      pos.set(c.x, c.y + Math.sin(c.t * 2.2) * 0.12, c.z);
      m.compose(pos, q, s);
      this.coinMesh.setMatrixAt(i, m);
    });
    this.coinMesh.instanceMatrix.needsUpdate = true;
  }

  // جمع‌کردن سکه‌ها؛ برمی‌گرداند تعداد جمع‌شده
  collectCoins(pp, magnet, dt, onCoin) {
    if (!this.coinState) return;
    const R = 1.05 + magnet;
    for (const c of this.coinState) {
      if (c.taken) {
        if (c.fly > 0) {
          c.fly -= dt;
          c.x = lerp(c.x, pp.x, Math.min(1, dt * 18));
          c.y = lerp(c.y, pp.y + 1, Math.min(1, dt * 18));
          c.z = lerp(c.z, pp.z, Math.min(1, dt * 18));
        }
        continue;
      }
      const dx = c.x - pp.x, dy = c.y - (pp.y + 0.9), dz = c.z - pp.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (magnet > 0 && d2 < R * R * 4) {
        // آهنربا: جذب نرم
        const k = Math.min(1, dt * (4 + magnet * 2));
        c.x -= dx * k; c.y -= dy * k; c.z -= dz * k;
      }
      if (d2 < 1.15 * 1.15) {
        c.taken = true;
        c.fly = 0.25;
        onCoin && onCoin(c);
      }
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => {
          if (m.map && m.map.userData && m.map.userData.owned) m.map.dispose();
          m.dispose();
        });
      }
    });
    Object.values(this.mats).forEach((m) => m.dispose());
  }
}
