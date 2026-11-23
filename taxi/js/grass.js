import * as THREE from 'three';
import { concatGeometries } from './util.js';
import { addSway, regionAt } from './world.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const R = 48;
const FLY = 26;

/** a tuft: a few crossed blades, dark at the root and light at the tips; some carry a flower head */
function tuft(flower, hue) {
  const parts = [];
  const blade = (a, h, lean) => {
    const g = new THREE.PlaneGeometry(0.12, h, 1, 2);
    g.translate(0, h / 2, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      p.setX(i, p.getX(i) * (1 - (y / h) * 0.8));
      p.setZ(i, (y / h) * (y / h) * lean);
    }
    g.rotateY(a);
    const n = p.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const k = p.getY(i) / h;
      col[i * 3] = 0.16 + k * 0.32;
      col[i * 3 + 1] = 0.34 + k * 0.38;
      col[i * 3 + 2] = 0.1 + k * 0.1;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g.toNonIndexed();
  };
  for (let i = 0; i < 7; i++) parts.push(blade((i / 7) * Math.PI + Math.random() * 0.4, 0.3 + Math.random() * 0.4, 0.05 + Math.random() * 0.1));
  if (flower) {
    parts.push(blade(0.3, 0.55, 0.02));
    // five petals around a yellow heart; the instance colour tints the petals
    const head = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const pet = new THREE.SphereGeometry(0.045, 6, 4).scale(1, 0.35, 1.6).translate(0, 0, 0.06).rotateY(a).toNonIndexed();
      const n = pet.attributes.position.count, col = new Float32Array(n * 3), c = new THREE.Color(hue);
      for (let i = 0; i < n; i++) {
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
      }
      pet.setAttribute('color', new THREE.BufferAttribute(col, 3));
      head.push(pet);
    }
    const heart = new THREE.SphereGeometry(0.034, 6, 4).toNonIndexed();
    const n = heart.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = 1;
      col[i * 3 + 1] = 0.8;
      col[i * 3 + 2] = 0.2;
    }
    heart.setAttribute('color', new THREE.BufferAttribute(col, 3));
    head.push(heart);
    const hg = concatGeometries(head);
    hg.rotateX(-0.35);
    hg.translate(0, 0.57, 0.02);
    parts.push(hg);
  }
  return concatGeometries(parts);
}

/** one butterfly wing: a rounded fore and hind lobe, coloured by the instance colour, dark edges */
function wingGeo() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.05, 0.09, 0.15, 0.1, 0.16, 0.03);
  shape.bezierCurveTo(0.17, -0.02, 0.1, -0.03, 0.06, -0.02);
  shape.bezierCurveTo(0.11, -0.06, 0.09, -0.12, 0.04, -0.1);
  shape.bezierCurveTo(0.01, -0.08, 0, -0.04, 0, 0);
  const g = new THREE.ShapeGeometry(shape, 6);
  g.rotateX(Math.PI / 2); // lie flat: x = span, +z = towards the head
  const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = Math.hypot(p.getX(i), p.getZ(i));
    const k = r > 0.12 ? 0.25 : 1;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const BUTTERFLY_COLORS = [0xffb030, 0x6ab7ff, 0xffffff, 0xff6fa8, 0xffe24a, 0xb48cff];

/** Grass and wildflowers that grow around the camera on green ground, swaying with the trees,
 *  and butterflies that drift between them on sunny days. */
export class Grass {
  constructor(game, count) {
    this.g = game;
    this.n = count;
    if (!count) return;
    const w = game.world;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
    addSway(mat, w.vegTime, w.vegWind, 0.9);
    this.meshes = [];
    const hues = [0xffd23a, 0xff5a6a, 0xc58cff, 0xffffff, 0xff8a2a, 0x7ab8ff];
    const fl = Math.round((count * 0.22) / hues.length);
    const col = new THREE.Color();
    for (const hue of [null, ...hues]) {
      const flower = hue !== null;
      const n = flower ? fl : count - fl * hues.length;
      const im = new THREE.InstancedMesh(tuft(flower, hue), mat, n);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      im.receiveShadow = true;
      if (!flower) for (let i = 0; i < n; i++) im.setColorAt(i, col.setScalar(0.8 + Math.random() * 0.35));
      game.scene.add(im);
      const slots = [];
      for (let i = 0; i < n; i++) slots.push({ x: 1e9, z: 1e9, ok: false });
      this.meshes.push({ im, slots, cursor: 0, flower });
    }
    // butterflies
    const bmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
    this.wings = new THREE.InstancedMesh(wingGeo(), bmat, FLY * 2);
    this.wings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wings.frustumCulled = false;
    for (let i = 0; i < FLY; i++) {
      col.set(BUTTERFLY_COLORS[i % BUTTERFLY_COLORS.length]);
      this.wings.setColorAt(i * 2, col);
      this.wings.setColorAt(i * 2 + 1, col);
    }
    game.scene.add(this.wings);
    this.flies = [];
    for (let i = 0; i < FLY; i++) this.flies.push({ x: 1e9, y: 0, z: 1e9, h: Math.random() * 6.28, ph: Math.random() * 6.28, tx: 0, tz: 0, rest: 0, scare: 0 });
  }
  okAt(x, z) {
    const w = this.g.world, reg = regionAt(x, z);
    if (reg === 'desert' || w.surfaceAt(x, z) !== 'grass' || w.roadDist(x, z) < 7.5) return false;
    if (w.onRail && w.onRail(x, z, 3)) return false;
    // no meadow on the snowy mountain tops
    return w.heightAt(x, z) < 34;
  }
  /** a random spot near the focus; zero scale if the ground there isn't grass */
  place(im, i, slot, cx, cz, first) {
    const w = this.g.world;
    const a = Math.random() * Math.PI * 2, d = first ? Math.sqrt(Math.random()) * R : R * (0.75 + Math.random() * 0.25);
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    slot.x = x;
    slot.z = z;
    slot.ok = this.okAt(x, z);
    const s = slot.ok ? 0.75 + Math.random() * 0.7 : 0;
    _p.set(x, w.heightAt(x, z) - 0.02, z);
    _e.set(0, Math.random() * 6.28, 0);
    _s.set(s, s * (0.8 + Math.random() * 0.5), s);
    _m.compose(_p, _q.setFromEuler(_e), _s);
    im.setMatrixAt(i, _m);
  }
  update(dt) {
    if (!this.n) return;
    const g = this.g, f = g.focus(), cx = f.pos.x, cz = f.pos.z;
    for (const M of this.meshes) {
      const { im, slots } = M;
      let changed = false;
      if (!M.init || (M.lx - cx) ** 2 + (M.lz - cz) ** 2 > 200 * 200) {
        // first frame, or a long jump (teleport, tow): plant everything afresh
        M.init = true;
        slots.forEach((s, i) => this.place(im, i, s, cx, cz, true));
        changed = true;
      } else {
        // a few far-away tufts move to the front each frame
        const n = slots.length, budget = Math.min(n, 60);
        for (let k = 0; k < budget; k++) {
          const i = M.cursor;
          M.cursor = (M.cursor + 1) % n;
          const s = slots[i];
          if ((s.x - cx) * (s.x - cx) + (s.z - cz) * (s.z - cz) > (R + 6) * (R + 6)) {
            this.place(im, i, s, cx, cz, false);
            changed = true;
          }
        }
      }
      M.lx = cx;
      M.lz = cz;
      if (changed) im.instanceMatrix.needsUpdate = true;
    }
    this.updateFlies(dt, cx, cz);
  }
  /** a flower to visit near the focus, or null */
  pickFlower(cx, cz) {
    for (let k = 0; k < 8; k++) {
      const M = this.meshes[1 + Math.floor(Math.random() * (this.meshes.length - 1))];
      const s = M.slots[Math.floor(Math.random() * M.slots.length)];
      if (s.ok && (s.x - cx) ** 2 + (s.z - cz) ** 2 < 40 * 40) return s;
    }
    return null;
  }
  updateFlies(dt, cx, cz) {
    const g = this.g, w = g.world, env = g.env || { night: 0 };
    const W = g.weather || {};
    // only where a meadow surrounds us (sampled once a second)
    this.meadowT = (this.meadowT || 0) - dt;
    if (this.meadowT <= 0) {
      this.meadowT = 1;
      const sl = this.meshes[0].slots;
      let ok = 0;
      for (let k = 0; k < 60; k++) if (sl[Math.floor(Math.random() * sl.length)].ok) ok++;
      this.meadow = ok / 60;
    }
    const show = env.night < 0.35 && (W.rain || 0) < 0.3 && (W.snow || 0) < 0.5 && !(g.zombie && g.zombie.active) && this.meadow > 0.2;
    this.wings.visible = show;
    if (!show) {
      for (const b of this.flies) b.x = 1e9;
      return;
    }
    const t = g.time, p = g.player, sp = Math.abs(p.speed);
    this.flies.forEach((b, i) => {
      if ((b.x - cx) ** 2 + (b.z - cz) ** 2 > 50 * 50) {
        const fl = this.pickFlower(cx, cz);
        if (!fl) return;
        b.x = fl.x;
        b.z = fl.z;
        b.y = w.heightAt(fl.x, fl.z) + 0.8;
        b.tx = fl.x;
        b.tz = fl.z;
        b.rest = 0;
      }
      // the car rushing past scares them up and away
      const dc = Math.hypot(b.x - p.pos.x, b.z - p.pos.z);
      if (dc < 6 && sp > 4 && b.scare <= 0) {
        b.scare = 2.5;
        b.rest = 0;
        const a = Math.atan2(b.x - p.pos.x, b.z - p.pos.z);
        b.tx = b.x + Math.sin(a) * 12;
        b.tz = b.z + Math.cos(a) * 12;
      }
      b.scare -= dt;
      const gy = w.heightAt(b.x, b.z);
      let flap;
      if (b.rest > 0) {
        // sitting on a flower: slow wing breathing
        b.rest -= dt;
        flap = 0.9 + Math.sin(t * 2 + b.ph) * 0.5;
        b.y += (gy + 0.62 - b.y) * Math.min(1, dt * 6);
      } else {
        const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
        if (d < 0.4) {
          if (b.scare <= 0 && Math.random() < 0.5) b.rest = 2 + Math.random() * 4;
          const fl = this.pickFlower(cx, cz);
          if (fl) {
            b.tx = fl.x;
            b.tz = fl.z;
          }
        } else {
          const v = b.scare > 0 ? 4.5 : 1.6;
          const wob = Math.sin(t * 3 + b.ph) * 0.9;
          const h = Math.atan2(dx, dz) + wob * 0.6;
          b.h = h;
          b.x += Math.sin(h) * v * dt;
          b.z += Math.cos(h) * v * dt;
        }
        const ty = gy + 0.7 + Math.sin(t * 2.3 + b.ph) * 0.35 + (b.scare > 0 ? 1.5 : 0) + Math.min(1, d * 0.1);
        b.y += (ty - b.y) * Math.min(1, dt * 3);
        flap = Math.sin(t * 22 + b.ph) * 1.1;
      }
      for (const side of [0, 1]) {
        _e.set(0, b.h, (side ? -1 : 1) * flap, 'YXZ');
        _m.compose(_p.set(b.x, b.y, b.z), _q.setFromEuler(_e), _s.set(side ? -1 : 1, 1, 1));
        this.wings.setMatrixAt(i * 2 + side, _m);
      }
    });
    this.wings.instanceMatrix.needsUpdate = true;
  }
}
