import * as THREE from 'three';
import { concatGeometries, pick } from './util.js';
import { regionAt } from './world.js';

function painted(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = c.r;
    a[i * 3 + 1] = c.g;
    a[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const sph = (r, x, y, z, sx = 1, sy = 1, sz = 1, d = 10) => new THREE.SphereGeometry(r, d, Math.max(6, d - 3)).scale(sx, sy, sz).translate(x, y, z);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

/** a deer: +z forward; legs on their own pivots for the gallop */
function buildDeer(stag, mat, eyeMat) {
  const fur = 0xa86f3c, belly = 0xead7b8, dark = 0x3b2a1e;
  const root = new THREE.Group();
  const parts = [
    painted(sph(0.34, 0, 1.12, 0, 1, 0.95, 1.9, 12), fur),
    painted(sph(0.24, 0, 0.98, 0.1, 0.9, 0.7, 1.6, 10), belly),
    painted(new THREE.CylinderGeometry(0.11, 0.16, 0.62, 8).rotateX(-0.75).translate(0, 1.45, 0.62), fur),
    painted(sph(0.15, 0, 1.72, 0.86, 0.85, 0.9, 1.3, 10), fur),
    painted(sph(0.08, 0, 1.66, 1.04, 0.8, 0.75, 1.2, 8), dark), // snout
    painted(sph(0.035, 0, 1.68, 1.13, 1, 1, 1, 6), 0x111111), // nose
    painted(sph(0.06, -0.12, 1.86, 0.8, 0.5, 1.5, 0.5, 6).rotateZ(0.4), fur), // ears
    painted(sph(0.06, 0.12, 1.86, 0.8, 0.5, 1.5, 0.5, 6).rotateZ(-0.4), fur),
    painted(sph(0.08, 0, 1.22, -0.62, 1, 1.2, 0.6, 6), 0xffffff), // white tail
  ];
  // dappled spots on the back
  for (let i = 0; i < 7; i++) parts.push(painted(sph(0.045, (i % 2 ? 0.16 : -0.16), 1.3, -0.35 + i * 0.1, 1, 0.4, 1, 6), 0xf3e3c6));
  if (stag) {
    for (const s of [-1, 1]) {
      parts.push(painted(new THREE.CylinderGeometry(0.018, 0.025, 0.4, 5).rotateZ(s * 0.5).translate(s * 0.13, 2.02, 0.78), 0xd8c3a0));
      parts.push(painted(new THREE.CylinderGeometry(0.014, 0.02, 0.22, 5).rotateZ(-s * 0.3).rotateX(-0.5).translate(s * 0.2, 2.15, 0.86), 0xd8c3a0));
      parts.push(painted(new THREE.CylinderGeometry(0.014, 0.02, 0.2, 5).rotateZ(s * 0.9).translate(s * 0.27, 2.14, 0.74), 0xd8c3a0));
    }
  }
  root.add(new THREE.Mesh(concatGeometries(parts), mat));
  // eyes that shine in the headlights
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), eyeMat);
    e.position.set(s * 0.1, 1.77, 0.96);
    root.add(e);
  }
  const legGeo = concatGeometries([painted(new THREE.CylinderGeometry(0.045, 0.035, 0.9, 6).translate(0, -0.45, 0), fur), painted(sph(0.045, 0, -0.9, 0.02, 1, 0.7, 1.3, 6), dark)]);
  const legs = [];
  for (const [x, z] of [[-0.14, 0.45], [0.14, 0.45], [-0.14, -0.42], [0.14, -0.42]]) {
    const pv = new THREE.Group();
    pv.position.set(x, 0.98, z);
    pv.add(new THREE.Mesh(legGeo, mat));
    root.add(pv);
    legs.push(pv);
  }
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { root, legs };
}

function rabbitGeo() {
  return concatGeometries([
    painted(sph(0.12, 0, 0.12, 0, 1, 0.95, 1.25), 0x9b8a7a),
    painted(sph(0.075, 0, 0.21, 0.13, 1, 1, 1.1), 0x9b8a7a),
    painted(sph(0.03, -0.035, 0.33, 0.1, 0.6, 2.2, 0.5, 6), 0x8c7b6b),
    painted(sph(0.03, 0.035, 0.33, 0.1, 0.6, 2.2, 0.5, 6), 0x8c7b6b),
    painted(sph(0.04, 0, 0.14, -0.15, 1, 1, 1, 6), 0xffffff),
    painted(sph(0.012, -0.04, 0.23, 0.19, 1, 1, 1, 4), 0x111111),
    painted(sph(0.012, 0.04, 0.23, 0.19, 1, 1, 1, 4), 0x111111),
  ]);
}

/** Wild animals: deer leaping across forest roads (brake for them!), rabbits hopping in the
 *  meadows, and owls hooting in the forest at night. Nobody gets hurt: a deer you bump just
 *  staggers off, dazed. */
export class Wildlife {
  constructor(game) {
    this.g = game;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0x223322 });
    this.deer = [];
    for (let i = 0; i < 4; i++) {
      const d = buildDeer(i === 0, mat, this.eyeMat);
      d.root.visible = false;
      game.scene.add(d.root);
      this.deer.push({ ...d, on: false });
    }
    this.cross = null;
    this.cool = 25;
    // rabbits
    this.rabbitMesh = new THREE.InstancedMesh(rabbitGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 10);
    this.rabbitMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rabbitMesh.frustumCulled = false;
    game.scene.add(this.rabbitMesh);
    this.rabbits = [];
    for (let i = 0; i < 10; i++) this.rabbits.push({ x: 1e9, z: 1e9, y: 0, h: 0, hop: 0, wait: Math.random() * 3, tx: 0, tz: 0, flee: 0 });
    this.owlT = 20;
  }
  /* ---------------- deer ---------------- */
  canCross() {
    const g = this.g, p = g.player;
    if (g.state !== 'play' || g.onfoot.active || p.script || p.air) return false;
    if (g.race.state !== 'idle' || g.crazy.state !== 'idle' || g.drag.state !== 'idle' || (g.zombie && g.zombie.active)) return false;
    const reg = regionAt(p.pos.x, p.pos.z);
    if (reg !== 'forest' && reg !== 'farm' && reg !== 'lake') return false;
    return Math.abs(p.speed) > 8 && g.world.roadDist(p.pos.x, p.pos.z) < 6;
  }
  startCrossing() {
    const g = this.g, w = g.world, p = g.player;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    // a spot on the road ahead (roads wind, so try a few distances)
    let ne = null;
    for (const k of [1, 0.8, 1.25, 0.65, 1.5]) {
      const ahead = (55 + Math.abs(p.speed) * 1.5) * k;
      const c = w.nearestEdge(p.pos.x + fx * ahead, p.pos.z + fz * ahead);
      const toward = c && (c.x - p.pos.x) * fx + (c.z - p.pos.z) * fz;
      if (c && c.dist < 14 && toward > 35 && Math.abs(c.dx * fx + c.dz * fz) > 0.6) {
        ne = c;
        break;
      }
    }
    if (!ne) return false;
    const lx = -ne.dz, lz = ne.dx, side = Math.random() < 0.5 ? 1 : -1;
    const night = g.env ? g.env.night : 0;
    const n = 2 + Math.floor(Math.random() * 3);
    this.cross = { x: ne.x, z: ne.z, t: 0, hit: false, seen: false, night: night > 0.5 };
    this.deer.forEach((D, i) => {
      D.on = i < n;
      D.root.visible = D.on;
      if (!D.on) return;
      const off = (i - (n - 1) / 2) * 3.5 + (Math.random() - 0.5) * 2;
      D.x0 = ne.x + lx * side * 20 + ne.dx * off;
      D.z0 = ne.z + lz * side * 20 + ne.dz * off;
      D.x1 = ne.x - lx * side * 26 + ne.dx * off;
      D.z1 = ne.z - lz * side * 26 + ne.dz * off;
      D.delay = i * (0.5 + Math.random() * 0.5);
      D.k = 0;
      D.v = 8 + Math.random() * 2;
      D.len = Math.hypot(D.x1 - D.x0, D.z1 - D.z0);
      D.h = Math.atan2(D.x1 - D.x0, D.z1 - D.z0);
      D.daze = 0;
      D.ph = Math.random() * 6;
      // at night the first one may freeze in the headlights on the road
      D.freeze = i === 0 && night > 0.5 && Math.random() < 0.7 ? 2.2 : 0;
      D.root.position.set(D.x0, w.heightAt(D.x0, D.z0), D.z0);
      D.root.rotation.set(0, D.h, 0);
    });
    return true;
  }
  updateDeer(dt) {
    const g = this.g, w = g.world, p = g.player, C = this.cross;
    if (!C) return;
    C.t += dt;
    const night = g.env ? g.env.night : 0;
    // their eyes catch the headlights
    this.eyeMat.color.setHex(night > 0.4 && (p.lights || night > 0.5) ? 0xd8fff0 : 0x223322);
    let alive = 0;
    for (const D of this.deer) {
      if (!D.on) continue;
      alive++;
      if (C.t < D.delay) continue;
      const cx = D.x0 + (D.x1 - D.x0) * D.k, cz = D.z0 + (D.z1 - D.z0) * D.k;
      // frozen in the middle of the road until honked at or the car gets close
      const mid = Math.abs(D.k - 0.44) < 0.05;
      if (D.freeze > 0 && mid) {
        D.freeze -= dt;
        if (g.audio.hornOn || Math.hypot(p.pos.x - cx, p.pos.z - cz) < 12) D.freeze = 0;
        if (!C.frozeSaid) {
          C.frozeSaid = true;
          g.ui.toast('🦌✨ یه آهو جلوی نور چراغ‌ها خشکش زده! ترمز بگیر یا بوق بزن!', 'warn');
        }
        this.pose(D, 0, dt);
        D.root.rotation.y = D.h + Math.sin(C.t * 2) * 0.15 + 0.6;
      } else {
        const sp = D.daze > 0 ? D.v * 0.6 : D.v;
        D.k = Math.min(1.3, D.k + (sp * dt) / D.len);
        this.pose(D, sp, dt);
        D.root.rotation.y = D.h + (D.daze > 0 ? Math.sin(C.t * 9) * 0.3 : 0);
      }
      D.daze = Math.max(0, D.daze - dt);
      // a leap over the road
      const onRoad = Math.abs(D.k - 0.44) < 0.22;
      const leap = onRoad && D.freeze <= 0 ? Math.sin(((D.k - 0.22) / 0.44) * Math.PI) * 1.1 : 0;
      const gy = w.heightAt(cx, cz);
      D.root.position.set(cx, gy + Math.max(0, leap) + D.bob, cz);
      // the car and the deer
      const d = Math.hypot(p.pos.x - cx, p.pos.z - cz);
      if (d < 60) C.seen = true;
      // how slow you went while they were close: the bonus is for braking
      if (d < 45) C.minV = Math.min(C.minV ?? 99, Math.abs(p.speed));
      if (d < 2.4 && Math.abs(p.speed) > 3 && !D.bumped) {
        D.bumped = true;
        D.daze = 3;
        C.hit = true;
        p.health = Math.max(0, p.health - 6);
        p.speed *= 0.55;
        if (p.bump) p.bump(-1.2, 0.8, (Math.random() - 0.5) * 1.5);
        g.audio.crash(5);
        g.stats.deerBumps = (g.stats.deerBumps || 0) + 1;
        g.ui.toast('🦌💫 آخ! آهو گیج شد ولی سالم فرار کرد. توی جنگل آروم‌تر برو!', 'bad');
        if (g.rides.ride && g.rides.state === 'toDest') g.rides.say('وای حیوونکی!! 😢 یواش‌تر برو!');
      }
      if (D.k >= 1.3) {
        D.on = false;
        D.root.visible = false;
      }
    }
    if (!alive) {
      // everyone made it across: a good driver braked for them
      if (C.seen && !C.hit && (C.minV ?? 99) < 6) {
        g.coins += 5;
        g.stats.deerSaved = (g.stats.deerSaved || 0) + 1;
        g.ui.toast(pick(['🦌 آهوها سالم رد شدن! ترمز به موقع 👏 +۵ سکه', '🦌 چه راننده مهربونی! +۵ سکه']), 'good');
        if (g.rides.ride && g.rides.state === 'toDest' && Math.random() < 0.6) g.rides.say(pick(['وای چه آهوهای خوشگلی! 😍', 'دمت گرم که ترمز گرفتی 🦌']));
      }
      this.cross = null;
      for (const D of this.deer) D.bumped = false;
    }
  }
  /** gallop: legs swing in pairs, the body bobs */
  pose(D, sp, dt) {
    D.ph += dt * (sp > 0.5 ? 2 + sp * 0.9 : 0);
    const a = sp > 0.5 ? 0.75 : 0;
    const s = Math.sin(D.ph);
    D.legs[0].rotation.x = s * a;
    D.legs[1].rotation.x = s * a * 0.8;
    D.legs[2].rotation.x = -s * a;
    D.legs[3].rotation.x = -s * a * 0.8;
    D.bob = sp > 0.5 ? Math.abs(Math.sin(D.ph)) * 0.18 : 0;
  }
  /* ---------------- rabbits ---------------- */
  updateRabbits(dt) {
    const g = this.g, w = g.world, f = g.focus();
    const reg = regionAt(f.pos.x, f.pos.z);
    const night = g.env ? g.env.night : 0;
    const show = (reg === 'farm' || reg === 'forest' || reg === 'lake') && night < 0.65 && !(g.zombie && g.zombie.active);
    this.rabbitMesh.visible = show;
    if (!show) return;
    const p = g.player, sp = f.onFoot ? g.onfoot.speed || 0 : Math.abs(p.speed);
    this.rabbits.forEach((R, i) => {
      if ((R.x - f.pos.x) ** 2 + (R.z - f.pos.z) ** 2 > 70 * 70) {
        // somewhere on the grass nearby, not on the road
        for (let k = 0; k < 6; k++) {
          const a = Math.random() * Math.PI * 2, d = 25 + Math.random() * 40;
          const x = f.pos.x + Math.cos(a) * d, z = f.pos.z + Math.sin(a) * d;
          const hz = w.heightAt(x, z);
          if (w.roadDist(x, z) > 9 && w.surfaceAt(x, z) === 'grass' && hz > 0.3 && hz < 40) {
            R.x = x;
            R.z = z;
            R.tx = x;
            R.tz = z;
            break;
          }
        }
      }
      const dd = Math.hypot(R.x - f.pos.x, R.z - f.pos.z);
      if (dd < (f.onFoot ? 5 : 12) && sp > 1.5 && R.flee <= 0) {
        R.flee = 2.5;
        const a = Math.atan2(R.x - f.pos.x, R.z - f.pos.z) + (Math.random() - 0.5);
        R.tx = R.x + Math.sin(a) * 14;
        R.tz = R.z + Math.cos(a) * 14;
      }
      R.flee -= dt;
      R.wait -= dt;
      if (R.hop <= 0 && R.wait <= 0) {
        if (Math.hypot(R.tx - R.x, R.tz - R.z) < 0.5 && R.flee <= 0) {
          const a = Math.random() * Math.PI * 2;
          R.tx = R.x + Math.cos(a) * 3;
          R.tz = R.z + Math.sin(a) * 3;
        }
        R.hop = 0.35;
        R.wait = R.flee > 0 ? 0 : 0.6 + Math.random() * 2.5;
        R.h = Math.atan2(R.tx - R.x, R.tz - R.z);
      }
      let lift = 0;
      if (R.hop > 0) {
        R.hop -= dt;
        const step = (R.flee > 0 ? 7 : 2.4) * dt;
        const dx = R.tx - R.x, dz = R.tz - R.z, d = Math.hypot(dx, dz);
        if (d > 0.05) {
          R.x += (dx / d) * Math.min(step, d);
          R.z += (dz / d) * Math.min(step, d);
        }
        lift = Math.sin((1 - Math.max(0, R.hop) / 0.35) * Math.PI) * (R.flee > 0 ? 0.35 : 0.18);
      }
      const y = w.heightAt(R.x, R.z) + lift;
      _e.set(lift > 0 ? -0.3 : 0, R.h, 0);
      _m.compose(_p.set(R.x, y, R.z), _q.setFromEuler(_e), _s.set(1.4, 1.4, 1.4));
      this.rabbitMesh.setMatrixAt(i, _m);
    });
    this.rabbitMesh.instanceMatrix.needsUpdate = true;
  }
  update(dt) {
    const g = this.g;
    if (!dt) return;
    this.cool -= dt;
    if (!this.cross && this.cool <= 0 && this.canCross()) {
      const night = g.env ? g.env.night : 0;
      // dusk and night are deer time
      if (Math.random() < dt * (night > 0.3 ? 0.25 : 0.12)) {
        if (this.startCrossing()) this.cool = 50 + Math.random() * 50;
        else this.cool = 3;
      }
    }
    this.updateDeer(dt);
    this.updateRabbits(dt);
    // an owl in the forest at night
    const f = g.focus();
    if (g.env && g.env.night > 0.7 && regionAt(f.pos.x, f.pos.z) === 'forest') {
      this.owlT -= dt;
      if (this.owlT <= 0) {
        this.owlT = 15 + Math.random() * 25;
        const A = g.audio;
        A.tone(392, 0.35, 0.05, 'sine');
        A.tone(370, 0.6, 0.05, 'sine', 0.45);
        A.tone(392, 0.25, 0.04, 'sine', 1.3);
      }
    }
  }
}
