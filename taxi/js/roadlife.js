import * as THREE from 'three';
import { buildCar } from './models.js';
import { TrafficCar } from './traffic.js';
import { fa, mulberry32, pick } from './util.js';
import { regionAt } from './world.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _y = new THREE.Vector3(0, 1, 0);

/** Life on the roads: speed bumps, wedding convoys, car alarms and police roadblocks. */
export class RoadLife {
  constructor(game) {
    this.g = game;
    this.buildBumps();
    this.convoy = [];
    this.convoyT = 40;
    this.blockers = [];
    this.blockT = 0;
    this.alarmBeep = 0;
    this.buildSpikes();
  }
  /** a spike strip laid across the road in front of a police roadblock */
  buildSpikes() {
    const grp = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.05, 0.42), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.7, metalness: 0.4 }));
    base.position.y = 0.03;
    grp.add(base);
    const N = 34;
    const spikes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.06, 0.2, 5), new THREE.MeshStandardMaterial({ color: 0xc0c4c8, metalness: 0.9, roughness: 0.3 }), N);
    const m = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      m.makeTranslation(-6 + (i / (N - 1)) * 12, 0.14, (i % 2 ? 0.1 : -0.1));
      spikes.setMatrixAt(i, m);
    }
    grp.add(spikes);
    // yellow-black ends so you can see it coming
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 8;
    const c = cv.getContext('2d');
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? '#111' : '#ffd21a';
      c.fillRect(i * 8, 0, 8, 8);
    }
    const tex = new THREE.CanvasTexture(cv);
    for (const x of [-6.4, 6.4]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.5), new THREE.MeshStandardMaterial({ map: tex }));
      e.position.set(x, 0.04, 0);
      grp.add(e);
    }
    grp.visible = false;
    this.g.scene.add(grp);
    this.spikes = grp;
    this.spikeAt = null;
  }
  updateSpikes() {
    const g = this.g, S = this.spikeAt, p = g.player;
    if (!S || g.onfoot.active || p.air) return;
    const rx = p.pos.x - S.x, rz = p.pos.z - S.z;
    if (rx * rx + rz * rz > 900) {
      S.prev = null;
      return;
    }
    const along = rx * S.dx + rz * S.dz, lat = Math.abs(rx * S.dz - rz * S.dx);
    const prev = S.prev;
    S.prev = along;
    if (prev === null || Math.sign(prev) === Math.sign(along) || lat > 6.6) return;
    if (!p.flat) {
      p.flat = true;
      g.stats.flats = (g.stats.flats || 0) + 1;
      g.audio.burst(0.35, 2400, 'highpass', 0.7);
      g.audio.burst(0.5, 300, 'lowpass', 0.6);
      g.shake = Math.max(g.shake || 0, 0.7);
      g.ui.toast('💥 روی میخ‌های پلیس رفتی! لاستیک‌ها ترکید؛ ماشین کند و لغزنده شده. برو تعمیرگاه 🔧', 'bad');
    }
  }

  /* ---------------- speed bumps ---------------- */
  buildBumps() {
    const g = this.g, w = g.world, G = w.graph;
    const rnd = mulberry32(8080);
    const city = G.edges.filter((e) => e.road.type === 'city' && e.len > 60);
    this.bumps = [];
    for (let k = 0; k < 26 && city.length; k++) {
      const e = city.splice(Math.floor(rnd() * city.length), 1)[0];
      const A = G.nodes[e.a], B = G.nodes[e.b];
      const x = (A.x + B.x) / 2, z = (A.z + B.z) / 2;
      const dx = (B.x - A.x) / e.len, dz = (B.z - A.z) / e.len;
      this.bumps.push({ x, z, dx, dz, prev: null });
    }
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 8;
    const c = cv.getContext('2d');
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? '#111' : '#f2c200';
      c.fillRect(i * 16, 0, 16, 8);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.CylinderGeometry(0.35, 0.35, 11.6, 12, 1, false, 0, Math.PI);
    geo.rotateZ(Math.PI / 2);
    geo.scale(1, 0.32, 1);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), this.bumps.length);
    this.bumps.forEach((b, i) => {
      // the bump lies across the road
      _q.setFromAxisAngle(_y, Math.atan2(b.dx, b.dz));
      _p.set(b.x, w.heightAt(b.x, b.z) + 0.01, b.z);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
    });
    mesh.receiveShadow = true;
    g.scene.add(mesh);
  }
  updateBumps() {
    const g = this.g, p = g.player;
    if (g.state !== 'play' || g.onfoot.active || p.air) return;
    for (const b of this.bumps) {
      const rx = p.pos.x - b.x, rz = p.pos.z - b.z;
      if (rx * rx + rz * rz > 400) {
        b.prev = null;
        continue;
      }
      const along = rx * b.dx + rz * b.dz, lat = Math.abs(rx * b.dz - rz * b.dx);
      const prev = b.prev;
      b.prev = along;
      if (prev === null || Math.sign(prev) === Math.sign(along) || lat > 6.2) continue;
      const sp = p.groundSpeed ?? Math.abs(p.speed);
      // races and Crazy Taxi: the AI ignores bumps, so the player only gets a jolt
      if (sp < 7 || g.race.state !== 'idle' || g.crazy.state !== 'idle') {
        g.shake = Math.max(g.shake || 0, sp < 7 ? 0.15 : 0.35);
        continue;
      }
      // too fast over the bump: the taxi bucks into the air
      p.air = true;
      p.vy = Math.min(7, sp * 0.15);
      p.airT = 0;
      p.airMax = 0;
      p.geyserLaunch = true;
      g.shake = Math.max(g.shake || 0, Math.min(1, sp / 25));
      g.audio.burst(0.15, 300, 'lowpass', 0.6);
      if (sp > 14) {
        p.health = Math.max(0, p.health - (sp - 14) * 0.5);
        if (g.rides.ride && g.rides.state === 'toDest') {
          g.rides.ride.complaints++;
          g.rides.say(pick(['آخ کمرم! سرعت‌گیر رو ندیدی؟! 😣', 'یواش‌تر از روی سرعت‌گیر!', 'سرم خورد به سقف! 🤕']));
        }
        if (!this.bumpSaid || g.time - this.bumpSaid > 30) {
          this.bumpSaid = g.time;
          g.ui.toast('⚠️ سرعت‌گیر! آروم‌تر رد شو، به ماشین آسیب می‌زنه', 'warn');
        }
      }
    }
  }

  /* ---------------- car alarms ---------------- */
  updateAlarms(dt) {
    const g = this.g, p = g.player;
    let near = Infinity;
    for (const c of g.traffic.cars) {
      if (!c.alarmT) continue;
      c.alarmT = Math.max(0, c.alarmT - dt);
      if (!c.active) c.alarmT = 0;
      if (c.alarmT > 0) near = Math.min(near, Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z));
    }
    this.alarmBeep -= dt;
    if (near < 90 && this.alarmBeep <= 0 && g.state === 'play') {
      this.alarmBeep = 0.45;
      const v = Math.max(0.03, 0.14 * (1 - near / 90));
      g.audio.tone(980, 0.18, v, 'square');
      g.audio.tone(760, 0.18, v, 'square', 0.22);
    }
  }

  /* ---------------- wedding convoy ---------------- */
  weddingCar(lead) {
    const root = buildCar({ type: lead ? 'sedan' : 'hatch', color: lead ? 0xffffff : pick([0xffffff, 0xd8d0b8, 0xbfc3c8]) }).root;
    if (lead) {
      // flowers on the bonnet and ribbons to the mirrors
      const pink = new THREE.MeshStandardMaterial({ color: 0xff7eb6, roughness: 0.6 });
      const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
      for (let i = 0; i < 9; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), i % 3 ? pink : white);
        f.position.set(-0.5 + (i % 3) * 0.5, 1.02 + (i % 2) * 0.05, 1.35 + Math.floor(i / 3) * 0.18);
        root.add(f);
      }
      for (const x of [0.85, -0.85]) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.6), pink);
        rib.position.set(x * 0.6, 1.0, 1.6);
        rib.rotation.y = x > 0 ? 0.5 : -0.5;
        root.add(rib);
      }
    }
    const c = new TrafficCar(this.g.traffic, root);
    c.isWedding = true;
    return c;
  }
  spawnConvoy() {
    const g = this.g, w = g.world, G = w.graph, p = g.player.pos;
    for (let k = 0; k < 30; k++) {
      const e = G.edges[Math.floor(Math.random() * G.edges.length)];
      if (e.road.type !== 'city' || e.len < 80) continue;
      const A = G.nodes[e.a], B = G.nodes[e.b];
      const mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2, d = Math.hypot(mx - p.x, mz - p.z);
      if (d < 90 || d > 220) continue;
      if (!this.convoy.length) for (let i = 0; i < 4; i++) this.convoy.push(this.weddingCar(i === 0));
      const lead = this.convoy[0];
      lead.picks = new Map();
      this.convoy.forEach((c, i) => {
        if (i) c.leader = lead;
        c.spawnOn(e.id, e.a, 0.62 - i * 0.16);
        c.persona = 0.72;
      });
      this.convoyLife = 140;
      this.convoyNear = 0;
      this.convoyPaid = false;
      this.honkT = 0;
      g.ui.toast('🎊 صدای بوق عروسی میاد! یه کاروان عروس توی شهره', 'info');
      return true;
    }
    return false;
  }
  updateConvoy(dt) {
    const g = this.g, p = g.player;
    const live = this.convoy.some((c) => c.active);
    if (!live) {
      this.convoyT -= dt;
      const h = g.hour;
      if (this.convoyT <= 0 && g.state === 'play' && h > 9 && h < 21 && regionAt(p.pos.x, p.pos.z) === 'city') {
        this.convoyT = 120 + Math.random() * 120;
        if (Math.random() < 0.6) this.spawnConvoy();
      }
      return;
    }
    this.convoyLife -= dt;
    let dmin = Infinity;
    for (const c of this.convoy) {
      if (!c.active) continue;
      c.update(dt, g.time);
      dmin = Math.min(dmin, Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z));
    }
    // the whole convoy honks in rhythm
    this.honkT -= dt;
    if (this.honkT <= 0 && dmin < 140 && g.state === 'play') {
      this.honkT = 2.2 + Math.random();
      const v = 0.14 * (1 - dmin / 140);
      [0, 0.18, 0.36, 0.7, 0.88].forEach((t, i) => g.audio.tone(i % 2 ? 494 : 392, 0.15, v, 'square', t));
    }
    // follow the convoy for a while and you're a guest at the wedding
    if (dmin < 30 && !g.onfoot.active && !this.convoyPaid) {
      this.convoyNear += dt;
      if (this.convoyNear > 15) {
        this.convoyPaid = true;
        g.coins += 20;
        g.addXp(50);
        g.stats.weddings = (g.stats.weddings || 0) + 1;
        g.audio.cash();
        g.ui.achievement('🎊', 'مهمون عروسی شدی! شیرینی خوردی 🍰', 20, '💍 کاروان عروس');
        g.fireworks.show(p.pos.x + Math.sin(p.heading) * 120, p.pos.z + Math.cos(p.heading) * 120, 6);
      }
    }
    if (this.convoyLife <= 0 || dmin > 420) for (const c of this.convoy) c.deactivate();
  }

  /* ---------------- police roadblocks ---------------- */
  updateRoadblocks(dt) {
    const g = this.g, pol = g.police, p = g.focus(), w = g.world;
    for (const b of this.blockers) if (b.active) b.update(dt, g.time);
    const chasing = pol.state === 'chase' && pol.stars >= 3;
    this.blockT -= dt;
    if (chasing && this.blockT <= 0 && !p.onFoot && !this.blockers.some((b) => b.active)) {
      this.blockT = 35;
      const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
      const ne = w.nearestEdge(p.pos.x + fx * 170, p.pos.z + fz * 170);
      if (ne && ne.dist < 30 && Math.hypot(ne.x - p.pos.x, ne.z - p.pos.z) > 110) {
        if (!this.blockers.length) for (let i = 0; i < 2; i++) {
          const c = new TrafficCar(g.traffic, pol.tpl.root);
          c.isPolice = true;
          c.isBlocker = true;
          this.blockers.push(c);
        }
        const rx = -ne.dz, rz = ne.dx; // across the road
        this.blockers.forEach((c, i) => {
          const s = i ? -2.6 : 2.6;
          c.pos.set(ne.x + rx * s, 0, ne.z + rz * s);
          c.heading = Math.atan2(rx, rz) + (i ? Math.PI : 0) + (Math.random() - 0.5) * 0.3;
          c.speed = 0;
          c.knock.set(0, 0);
          c.spin = 0;
          c.state = 'parked';
          c.active = true;
          c.group.visible = true;
          c.sync(0);
        });
        this.blockAt = { x: ne.x, z: ne.z };
        // the spike strip lies across the road on your side of the block
        const sg = fx * ne.dx + fz * ne.dz > 0 ? 1 : -1;
        const sx = ne.x - ne.dx * sg * 16, sz = ne.z - ne.dz * sg * 16;
        this.spikes.position.set(sx, w.heightAt(sx, sz), sz);
        this.spikes.rotation.y = Math.atan2(ne.dx, ne.dz);
        this.spikes.visible = true;
        this.spikeAt = { x: sx, z: sz, dx: ne.dx, dz: ne.dz, prev: null };
        g.ui.toast('🚧 پلیس جلوتر جاده رو بسته و میخ ریخته! دورش بزن', 'bad');
      }
    }
    // clear the block once the chase is over or it's far behind
    if (this.blockAt && (pol.state !== 'chase' || Math.hypot(this.blockAt.x - p.pos.x, this.blockAt.z - p.pos.z) > 350)) {
      for (const b of this.blockers) b.deactivate();
      this.blockAt = null;
      this.spikes.visible = false;
      this.spikeAt = null;
    }
  }
  /** red/blue flashes on the roadblock cars (drawn by CarLights) */
  flashers(cb) {
    if (!this.blockAt) return;
    const ph = Math.floor(this.g.time * 7) % 2;
    for (const b of this.blockers) {
      if (!b.active) continue;
      const rx = Math.cos(b.heading) * 0.35, rz = -Math.sin(b.heading) * 0.35, y = b.group.position.y + 1.62;
      cb(b.pos.x + rx, y, b.pos.z + rz, ph ? 'red' : 'blue');
      cb(b.pos.x - rx, y, b.pos.z - rz, ph ? 'blue' : 'red');
    }
  }
  update(dt) {
    this.updateBumps();
    this.updateAlarms(dt);
    this.updateConvoy(dt);
    this.updateRoadblocks(dt);
    this.updateSpikes();
  }
}
