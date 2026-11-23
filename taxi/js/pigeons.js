import * as THREE from 'three';
import { concatGeometries } from './util.js';
import { regionAt } from './world.js';

const FLOCKS = 3, PER = 10, N = FLOCKS * PER;
const ROOF = N; // one extra bird that likes to sit on a parked taxi
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3();
const _box = new THREE.Box3();

function paint(geo, hex) {
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

/** City pigeons pecking on the pavement. They burst into the air when you drive close or honk,
 *  waddle up to you when you stand still on foot, and one may land on your parked taxi. */
export class Pigeons {
  constructor(game) {
    this.g = game;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
    const body = concatGeometries([
      paint(new THREE.SphereGeometry(0.09, 8, 6).scale(1, 0.85, 1.5), 0x8a8f99),
      paint(new THREE.SphereGeometry(0.058, 8, 6).scale(1, 0.6, 1).translate(0, 0.055, 0.09), 0x4f8a7a), // shiny neck
      paint(new THREE.SphereGeometry(0.055, 8, 6).translate(0, 0.09, 0.11), 0x5f6b7a),
      paint(new THREE.SphereGeometry(0.012, 5, 4).translate(-0.04, 0.105, 0.14), 0xff7a1a),
      paint(new THREE.SphereGeometry(0.012, 5, 4).translate(0.04, 0.105, 0.14), 0xff7a1a),
      paint(new THREE.ConeGeometry(0.015, 0.04, 4).rotateX(Math.PI / 2).translate(0, 0.085, 0.17), 0xd9c9a0),
      paint(new THREE.ConeGeometry(0.05, 0.12, 4).rotateX(-Math.PI / 2).translate(0, 0.01, -0.15), 0x6b7280),
      paint(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 4).translate(-0.03, -0.09, 0), 0xe57373),
      paint(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 4).translate(0.03, -0.09, 0), 0xe57373),
    ]);
    this.body = new THREE.InstancedMesh(body, mat, N + 1);
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.07, 0.26, 0, -0.02, 0, 0, -0.08]), 3));
    wing.computeVertexNormals();
    this.wings = new THREE.InstancedMesh(paint(wing, 0x7b8494), mat, (N + 1) * 2);
    for (const im of [this.body, this.wings]) {
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      game.scene.add(im);
    }
    this.birds = [];
    for (let i = 0; i <= N; i++) this.birds.push({ f: Math.floor(i / PER), x: 1e9, y: -50, z: 1e9, h: 0, vy: 0, vx: 0, vz: 0, fly: 0, ph: Math.random() * 6, hide: i === ROOF });
    this.flocks = [];
    for (let f = 0; f < FLOCKS; f++) this.flocks.push({ x: 1e9, z: 1e9, t: 0, flown: false });
    this.roof = { state: 'none', t: 0 };
    this.cooT = 3;
  }
  /** a new spot on the pavement near (but not too near) the focus */
  land(F) {
    const g = this.g, w = g.world, p = g.focus().pos;
    for (let k = 0; k < 20; k++) {
      const a = Math.random() * Math.PI * 2, d = 25 + Math.random() * 60;
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      const rd = w.roadDist(x, z);
      // the pavement strip beside the road
      if (regionAt(x, z) !== 'city' || rd < 7 || rd > 11) continue;
      F.x = x;
      F.z = z;
      F.t = 0;
      for (const b of this.birds) if (b.f < FLOCKS && this.flocks[b.f] === F) {
        b.x = x + (Math.random() - 0.5) * 3;
        b.z = z + (Math.random() - 0.5) * 3;
        // stand on the paving slabs (they sit a little above the terrain)
        b.y = Math.max(w.heightAt(b.x, b.z), 0.04) + 0.125;
        b.h = Math.random() * 6.28;
        b.fly = 0;
      }
      return true;
    }
    return false;
  }
  scare(F, from) {
    F.flown = true;
    F.t = 0;
    this.g.audio.burst(0.5, 2600, 'bandpass', 0.12);
    for (const b of this.birds) if (b.f < FLOCKS && this.flocks[b.f] === F) {
      const a = Math.atan2(b.x - from.x, b.z - from.z) + (Math.random() - 0.5) * 1.2;
      b.fly = 1;
      b.vx = Math.sin(a) * (4 + Math.random() * 3);
      b.vz = Math.cos(a) * (4 + Math.random() * 3);
      b.vy = 3 + Math.random() * 2.5;
      b.h = a;
    }
  }
  /** the roof bird: lands on a taxi that has stood still for a while, leaves when it moves */
  updateRoof(dt, show) {
    const g = this.g, p = g.player, R = this.roof, b = this.birds[ROOF];
    const still = show && Math.abs(p.speed) < 0.3 && !p.air;
    R.t = still ? R.t + dt : 0;
    if (R.state === 'none') {
      b.hide = true;
      if (R.t > 12 && Math.random() < dt * 0.3) {
        // fly in from somewhere above, to the top of the roof sign (or the roof)
        let sign = null;
        p.car.body.traverse((o) => {
          if (!sign && o.isMesh && p.car.roofSign && o.material === p.car.roofSign) sign = o;
        });
        _box.setFromObject(sign || p.car.body);
        _box.getCenter(_v);
        p.group.worldToLocal(_v);
        R.lx = sign ? _v.x : 0;
        R.lz = sign ? _v.z : -0.35;
        _v.set(0, _box.max.y, 0);
        R.y = _box.max.y - p.group.position.y + 0.14;
        R.state = 'in';
        R.k = 0;
        const a = Math.random() * Math.PI * 2;
        R.from = { x: p.pos.x + Math.sin(a) * 25, y: p.y + 12, z: p.pos.z + Math.cos(a) * 25 };
        b.hide = false;
      }
    } else if (R.state === 'in' || R.state === 'sit') {
      if (!still) {
        R.state = 'out';
        R.k = 0;
        this.g.audio.burst(0.3, 2600, 'bandpass', 0.08);
      }
    }
    if (R.state === 'none') return;
    _v.set(R.lx || 0, R.y, R.lz ?? -0.35);
    p.group.localToWorld(_v);
    if (R.state === 'in') {
      R.k = Math.min(1, R.k + dt / 2.2);
      const e = 1 - (1 - R.k) * (1 - R.k);
      b.x = R.from.x + (_v.x - R.from.x) * e;
      b.y = R.from.y + (_v.y - R.from.y) * e;
      b.z = R.from.z + (_v.z - R.from.z) * e;
      b.h = Math.atan2(_v.x - R.from.x, _v.z - R.from.z);
      b.fly = 1;
      if (R.k >= 1) {
        R.state = 'sit';
        b.h = p.heading + Math.PI * (Math.random() < 0.5 ? 0 : 1) + (Math.random() - 0.5);
        g.stats.roofPigeons = (g.stats.roofPigeons || 0) + 1;
      }
    } else if (R.state === 'sit') {
      b.x = _v.x;
      b.y = _v.y;
      b.z = _v.z;
      b.fly = 0;
      if (Math.random() < dt * 0.3) b.h += (Math.random() - 0.5) * 1.5;
    } else if (R.state === 'out') {
      R.k += dt;
      b.fly = 1;
      b.x += Math.sin(b.h) * 6 * dt;
      b.z += Math.cos(b.h) * 6 * dt;
      b.y += 4 * dt;
      if (R.k > 4) {
        R.state = 'none';
        b.hide = true;
      }
    }
  }
  update(dt) {
    const g = this.g, f = g.focus(), t = g.time;
    const inCity = regionAt(f.pos.x, f.pos.z) === 'city' && !(g.zombie && g.zombie.active);
    const night = g.env ? g.env.night : 0;
    const rain = g.weather ? g.weather.rain : 0;
    const show = inCity && night < 0.6 && rain < 0.5;
    this.body.visible = this.wings.visible = show;
    if (!show) {
      if (this.roof.state !== 'none') this.roof.state = 'none';
      this.birds[ROOF].hide = true;
      return;
    }
    const p = g.player, sp = Math.abs(p.speed);
    const honked = g.audio.hornOn;
    for (const F of this.flocks) {
      F.t += dt;
      if (Math.hypot(F.x - f.pos.x, F.z - f.pos.z) > 130 || (F.flown && F.t > 9)) {
        F.flown = false;
        this.land(F);
      }
      // scare them: a car close by, the horn, or walking right into them
      const dF = Math.hypot(F.x - f.pos.x, F.z - f.pos.z);
      if (!F.flown && ((!f.onFoot && dF < 14 && sp > 3) || (dF < 30 && honked) || (f.onFoot && dF < 2.2 && g.onfoot.speed > 2.5))) this.scare(F, f.pos);
      // standing quietly nearby on foot: they come closer, hoping for crumbs
      F.curious = f.onFoot && !F.flown && dF < 9 && (g.onfoot.speed || 0) < 0.5;
    }
    this.updateRoof(dt, show);
    // the odd coo when you're among them
    this.cooT -= dt;
    if (this.cooT <= 0) {
      this.cooT = 3 + Math.random() * 5;
      const near = this.flocks.some((F) => !F.flown && Math.hypot(F.x - f.pos.x, F.z - f.pos.z) < 20);
      if (near) {
        g.audio.tone(330, 0.22, 0.03, 'sine');
        g.audio.tone(290, 0.3, 0.03, 'sine', 0.2);
      }
    }
    this.birds.forEach((b, i) => {
      let flap = 0;
      const F = this.flocks[b.f];
      if (i === ROOF) {
        flap = b.fly ? Math.sin(t * 28 + b.ph) * 0.9 : 0;
      } else if (b.fly) {
        b.x += b.vx * dt;
        b.z += b.vz * dt;
        b.y += b.vy * dt;
        b.vy = Math.max(1.2, b.vy - dt * 0.8);
        flap = Math.sin(t * 28 + b.ph) * 0.9;
      } else {
        // peck and waddle; curious ones shuffle towards you
        b.ph += dt;
        if (F && F.curious) {
          const dx = f.pos.x - b.x, dz = f.pos.z - b.z, d = Math.hypot(dx, dz);
          if (d > 1.1) {
            b.h = Math.atan2(dx, dz) + Math.sin(b.ph * 3) * 0.3;
            b.x += Math.sin(b.h) * 0.6 * dt;
            b.z += Math.cos(b.h) * 0.6 * dt;
          }
        } else if (Math.random() < dt * 0.3) b.h += (Math.random() - 0.5) * 2;
      }
      const peck = b.fly ? 0 : Math.max(0, Math.sin(b.ph * 3 + i)) * 0.5;
      const hidden = b.hide;
      const sc = hidden ? 0 : i === ROOF ? 1.3 : 1;
      _s.set(sc, sc, sc);
      _p.set(b.x, b.y, b.z);
      _e.set(peck, b.h, 0, 'YXZ');
      _m.compose(_p, _q.setFromEuler(_e), _s);
      this.body.setMatrixAt(i, _m);
      // folded wings when standing, flapping when flying
      for (const side of [0, 1]) {
        const k = (hidden ? 0 : b.fly ? 1 : 0.5) * (i === ROOF ? 1.3 : 1);
        _e.set(0, b.h, (side ? -1 : 1) * (b.fly ? flap : -0.5), 'YXZ');
        _m.compose(_p.set(b.x, b.y + (b.fly ? 0.03 : 0.05), b.z), _q.setFromEuler(_e), _s.set(side ? -k : k, sc, sc * (b.fly ? 1 : 0.85)));
        this.wings.setMatrixAt(i * 2 + side, _m);
      }
    });
    this.body.instanceMatrix.needsUpdate = true;
    this.wings.instanceMatrix.needsUpdate = true;
  }
}
