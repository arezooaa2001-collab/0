'use strict';
/* Pets that follow the player, and the footrace on the gym track */

class Pet {
  constructor(kind) {
    this.kind = kind;
    const dog = kind === 'dog';
    const fur = dog ? '#a0662f' : '#f0a24a';
    const dark = dog ? '#5a3a1a' : '#c4772c';
    const s = dog ? 1 : 0.8;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const b = new Batch();
    b.add(UnitGeo.capsule(0.16, 0.42, 4, 10), 0, 0.42 * s, 0, fur, Math.PI / 2, 0, 0, s, s, s);
    b.sphere(0.17 * s, 0, 0.62 * s, 0.36 * s, fur);
    b.sphere(0.08 * s, 0, 0.57 * s, 0.5 * s, dark, 0.8);
    b.sphere(0.03 * s, 0, 0.6 * s, 0.58 * s, '#111111');
    b.sphere(0.025 * s, 0.07 * s, 0.68 * s, 0.49 * s, '#111111');
    b.sphere(0.025 * s, -0.07 * s, 0.68 * s, 0.49 * s, '#111111');
    if (dog) {
      b.add(UnitGeo.box(), 0.13, 0.66, 0.3, dark, 0, 0, 0.5, 0.05, 0.18, 0.1);
      b.add(UnitGeo.box(), -0.13, 0.66, 0.3, dark, 0, 0, -0.5, 0.05, 0.18, 0.1);
      b.cyl(0.13, 0.04, 0, 0.5, 0.25, '#e63946', Math.PI / 2.4, 0, 0);
    } else {
      b.add(UnitGeo.cone(8), 0.08 * s, 0.8 * s, 0.34 * s, fur, 0, 0, -0.2, 0.06, 0.12, 0.06);
      b.add(UnitGeo.cone(8), -0.08 * s, 0.8 * s, 0.34 * s, fur, 0, 0, 0.2, 0.06, 0.12, 0.06);
    }
    this.body.add(new THREE.Mesh(mergeParts(b.parts, false), MATTE_MAT));
    this.legs = [];
    for (const [x, z] of [[0.1, 0.22], [-0.1, 0.22], [0.1, -0.22], [-0.1, -0.22]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.035 * s, 0.32 * s, 8).translate(0, -0.16 * s, 0), new THREE.MeshStandardMaterial({ color: fur, roughness: 0.8 }));
      leg.position.set(x * s, 0.32 * s, z * s);
      this.body.add(leg);
      this.legs.push(leg);
    }
    this.tail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.32 * s, 8).translate(0, 0.16 * s, 0), new THREE.MeshStandardMaterial({ color: fur }));
    this.tail.position.set(0, 0.5 * s, -0.3 * s);
    this.tail.rotation.x = -0.7;
    this.body.add(this.tail);
    const shadow = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT);
    shadow.scale.set(0.6, 1, 0.9);
    shadow.position.y = 0.015;
    this.root.add(shadow);
    this.phase = 0;
    this.hop = 0;
  }

  place(p) {
    this.root.position.set(p.x + 1, 0, p.z + 1);
  }

  update(dt, player, time) {
    const pp = player.ch.root.position;
    const yaw = player.ch.root.rotation.y;
    const tx = pp.x - Math.sin(yaw) * 1.2 + Math.cos(yaw) * 0.9;
    const tz = pp.z - Math.cos(yaw) * 1.2 - Math.sin(yaw) * 0.9;
    const pos = this.root.position;
    const dx = tx - pos.x;
    const dz = tz - pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 25) { pos.set(tx, 0, tz); return; }
    const speed = d > 0.3 ? Math.min(9, d * 3) : 0;
    if (speed > 0) {
      pos.x += (dx / d) * speed * dt;
      pos.z += (dz / d) * speed * dt;
      this.root.rotation.y = angleLerp(this.root.rotation.y, Math.atan2(dx, dz), damp(8, dt));
      this.phase += dt * (6 + speed * 2);
    } else {
      this.root.rotation.y = angleLerp(this.root.rotation.y, Math.atan2(pp.x - pos.x, pp.z - pos.z), damp(4, dt));
    }
    const sw = speed > 0 ? Math.sin(this.phase) * 0.6 : 0;
    this.legs[0].rotation.x = sw; this.legs[3].rotation.x = sw;
    this.legs[1].rotation.x = -sw; this.legs[2].rotation.x = -sw;
    this.tail.rotation.z = Math.sin(time * (speed > 0 ? 10 : 16)) * 0.5;
    const excited = player.ch.busy;
    this.hop = excited ? Math.abs(Math.sin(time * 7)) * 0.25 : Math.max(0, this.hop - dt);
    this.body.position.y = this.hop + (speed > 0 ? Math.abs(Math.sin(this.phase)) * 0.04 : 0);
  }
}

/** One lap of the gym track against three runners. */
class Race {
  constructor(gym, player, runLevel, speedMult) {
    this.gym = gym;
    this.player = player;
    this.state = 'count';
    this.t = 0;
    const P = player.ch.root.position;
    const lane0 = 0.35;
    P.set(TRACK.cx + TRACK.a + lane0, 0, TRACK.cz);
    player.ch.root.rotation.y = 0;
    player.vel.set(0, 0);
    gym.cam.yaw = Math.PI + 0.35;
    gym.cam.pitch = 0.28;
    this.lastA = this.angleOf(P.x, P.z);
    this.progress = 0;
    const top = runSpeedFor(runLevel) * speedMult;
    this.racers = [0.95, 1.55, 2.15].map((lane, i) => {
      const ch = new Character(Object.assign(randomOutfit(), { muscle: rand(0.2, 0.7) }));
      ch.setLabel(pick(NPC_NAMES), '🏁 دونده', '#ffd34d');
      gym.scene.add(ch.root);
      const r = { ch, lane, th: 0, done: false, finishT: 0, speed: top * [0.9, 0.86, 0.82][i] * rand(0.98, 1.03), wobble: rand(0, TAU) };
      this.place(r);
      return r;
    });
    this.finished = [];
  }

  angleOf(x, z) { return Math.atan2((z - TRACK.cz) / TRACK.b, (x - TRACK.cx) / TRACK.a); }

  place(r) {
    const A = TRACK.a + r.lane;
    const B = TRACK.b + r.lane;
    const x = TRACK.cx + Math.cos(r.th) * A;
    const z = TRACK.cz + Math.sin(r.th) * B;
    r.ch.root.position.set(x, 0, z);
    r.ch.root.rotation.y = Math.atan2(-A * Math.sin(r.th), B * Math.cos(r.th));
  }

  /** Returns null while running, or {place} when the player crosses the line. */
  update(dt) {
    this.t += dt;
    if (this.state === 'count') {
      for (const r of this.racers) { r.ch.speed = 0; r.ch.update(dt); }
      if (this.t >= 3) { this.state = 'run'; this.t = 0; }
      return null;
    }
    for (const r of this.racers) {
      if (!r.done) {
        const A = TRACK.a + r.lane;
        const B = TRACK.b + r.lane;
        const v = r.speed * (1 + 0.05 * Math.sin(this.t * 0.9 + r.wobble)) * Math.min(1, 0.4 + this.t * 0.6);
        r.th += (v * dt) / Math.hypot(A * Math.sin(r.th), B * Math.cos(r.th));
        if (r.th >= TAU) { r.done = true; r.th = TAU; this.finished.push(r); }
        this.place(r);
        r.ch.speed = v;
      } else r.ch.speed = Math.max(0, r.ch.speed - dt * 4);
      r.ch.update(dt);
    }
    const P = this.player.ch.root.position;
    const a = this.angleOf(P.x, P.z);
    this.progress += wrapAngle(a - this.lastA);
    this.lastA = a;
    this.progress = Math.max(this.progress, -1);
    if (this.progress >= TAU) return { place: this.finished.length + 1 };
    if (this.t > 60) return { place: 4, timeout: true };
    return null;
  }

  position() {
    const mine = this.progress;
    return 1 + this.racers.filter((r) => r.th > mine).length;
  }

  dispose() {
    for (const r of this.racers) this.gym.scene.remove(r.ch.root);
  }
}
