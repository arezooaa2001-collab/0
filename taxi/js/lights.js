import * as THREE from 'three';

const SIDES = [0.62, -0.62];
const ALARM_CORNERS = [[2.2, 0.75], [2.2, -0.75], [-2.25, 0.75], [-2.25, -0.75]];

const MAX = 90; // light points per pool

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.22)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** a cheap pool of glowing points (one draw call) refilled every frame */
class GlowPool {
  constructor(scene, tex, color, size) {
    this.pos = new Float32Array(MAX * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.mat = new THREE.PointsMaterial({ map: tex, color, size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.pts = new THREE.Points(geo, this.mat);
    this.pts.frustumCulled = false;
    this.pts.renderOrder = 5;
    this.geo = geo;
    this.n = 0;
    scene.add(this.pts);
  }
  begin() {
    this.n = 0;
  }
  add(x, y, z) {
    if (this.n >= MAX) return;
    const i = this.n++ * 3;
    this.pos[i] = x;
    this.pos[i + 1] = y;
    this.pos[i + 2] = z;
  }
  end() {
    this.geo.setDrawRange(0, this.n);
    if (this.n) this.geo.attributes.position.needsUpdate = true;
  }
}

/**
 * Car lights: traffic head/tail lights at night, the taxi's turn signals, hazards,
 * reverse lights, visible headlight beams and a headlight that dies when the car is wrecked.
 */
export class CarLights {
  constructor(game) {
    this.g = game;
    const tex = glowTexture();
    this.head = new GlowPool(game.scene, tex, 0xfff2cc, 1.6);
    this.tail = new GlowPool(game.scene, tex, 0xff2a1a, 1.1);
    this.amber = new GlowPool(game.scene, tex, 0xffa020, 1.25);
    this.white = new GlowPool(game.scene, tex, 0xffffff, 1.0);
    this.red = new GlowPool(game.scene, tex, 0xff2020, 1.8);
    this.blue = new GlowPool(game.scene, tex, 0x2a5cff, 1.8);
    this.blink = { side: 0, t: 0, on: false, hold: 0, calm: 0, hazard: false };
    // soft light beams in front of the taxi (no real lights: two additive cones)
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1cf, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const cone = new THREE.CylinderGeometry(0.1, 2.1, 20, 18, 1, true);
    cone.translate(0, -10, 0);
    cone.rotateX(-Math.PI / 2 + 0.06); // point forward, dipping slightly toward the road
    this.beamMat = beamMat;
    this.beams = [0.62, -0.62].map((x) => {
      const m = new THREE.Mesh(cone, beamMat);
      m.position.set(x, 0.7, 0);
      m.renderOrder = 4;
      return m;
    });
  }
  /** the taxi's turn signals: automatic while steering slowly, hazards while a passenger gets in or out */
  updateBlinkers(dt) {
    const g = this.g, p = g.player, B = this.blink;
    const sp = p.groundSpeed ?? Math.abs(p.speed);
    const st = g.rides.state;
    B.hazard = g.state === 'play' && (st === 'boarding' || st === 'alighting' || p.health <= 0 || (p.fuelTotal() <= 0.01 && sp < 1));
    const want = Math.abs(p.steer) > 0.25 && sp < 14 && sp > 0.5 ? Math.sign(p.steer) : 0;
    if (want) {
      B.hold += dt;
      B.calm = 0;
      if (B.hold > 0.25) B.side = want;
    } else {
      B.hold = 0;
      B.calm += dt;
      if (B.calm > 1.2) B.side = 0;
    }
    const active = B.hazard || B.side !== 0;
    B.t = active ? B.t + dt : 0;
    const on = active && B.t % 0.8 < 0.42;
    if (on !== B.on && active && !g.onfoot.active && g.state === 'play') g.audio.click(on ? 0.35 : 0.25);
    B.on = on;
    return on;
  }
  update(dt) {
    const g = this.g, p = g.player;
    const night = g.env ? g.env.night : 0;
    const gloom = Math.max(night, g.weather ? Math.max(g.weather.cloud * 0.6, g.weather.sand || 0, g.weather.snow * 0.5) : 0);
    this.head.begin();
    this.tail.begin();
    this.amber.begin();
    this.white.begin();
    this.red.begin();
    this.blue.begin();
    // alarms blink, roadblocks flash red and blue
    const ph = Math.floor(g.time * 3) % 2 === 0;
    for (const c of g.traffic.cars) {
      if (!c.active || !(c.alarmT > 0) || !ph) continue;
      const fx = Math.sin(c.heading), fz = Math.cos(c.heading), y = c.group.position.y + 0.72;
      for (const [f, s] of ALARM_CORNERS) this.amber.add(c.pos.x + fx * f + fz * s, y, c.pos.z + fz * f - fx * s);
    }
    if (g.roadLife) g.roadLife.flashers((x, y, z, col) => (col === 'red' ? this.red : this.blue).add(x, y, z));
    // traffic, police, rival, chase target and company taxis
    if (gloom > 0.35) {
      const cam = g.camera.position;
      const list = this.list || (this.list = []);
      list.length = 0;
      for (const c of g.traffic.cars) if (c.active) list.push(c);
      const add = (extra) => {
        if (extra && extra.active && !list.includes(extra)) list.push(extra);
      };
      add(g.police.unit);
      add(g.race.rival);
      add(g.rides.target);
      if (g.roadLife) for (const c of g.roadLife.convoy) add(c);
      if (g.events) add(g.events.ambCar);
      for (const c of list) {
        if (Math.abs(c.pos.x - cam.x) > 400 || Math.abs(c.pos.z - cam.z) > 400) continue;
        const fx = Math.sin(c.heading), fz = Math.cos(c.heading), y = c.group.position.y + 0.72;
        for (const s of SIDES) {
          this.head.add(c.pos.x + fx * 2.2 + fz * s, y, c.pos.z + fz * 2.2 - fx * s);
          this.tail.add(c.pos.x - fx * 2.25 + fz * s, y + 0.05, c.pos.z - fz * 2.25 - fx * s);
        }
      }
    }
    // the taxi itself
    const on = this.updateBlinkers(dt);
    const P = p.car.P, half = P.len / 2;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading), y = p.y + 0.72;
    const corner = (fwd, side, pool, dy = 0) => pool.add(p.pos.x + fx * fwd + fz * side * P.W * 0.92, y + dy, p.pos.z + fz * fwd - fx * side * P.W * 0.92);
    if (on) {
      const B = this.blink;
      // corner() measures sides to the left; B.side is +1 for a right turn
      for (const side of B.hazard ? [1, -1] : [-B.side]) {
        corner(half + 0.02, side, this.amber, -0.08);
        corner(-half - 0.02, side, this.amber, 0.02);
      }
    }
    if (p.gear === -1 && !g.onfoot.active) {
      corner(-half - 0.02, 0.45, this.white);
      corner(-half - 0.02, -0.45, this.white);
    }
    this.head.end();
    this.tail.end();
    this.amber.end();
    this.white.end();
    this.red.end();
    this.blue.end();
    // headlight beams; a wrecked car loses one headlight (and the other flickers)
    for (const b of this.beams) if (b.parent !== p.group) p.group.add(b);
    const lightsOn = p.lights || night > 0.5;
    const broken = p.health < 35;
    const flick = broken && Math.random() < 0.08 ? 0.3 : 1;
    this.beamMat.opacity = lightsOn ? (0.012 + night * 0.026) * flick : 0;
    this.beams[0].visible = lightsOn;
    this.beams[1].visible = lightsOn && !broken;
    if (p.headlights && p.headlights.length > 1) {
      p.headlights[1].intensity = broken ? 0 : p.headlights[0].intensity;
      if (broken) p.headlights[0].intensity *= flick;
    }
    // little blinker arrows on the speedometer
    if (on !== this.shown) {
      this.shown = on;
      const el = document.getElementById('blink');
      if (el) el.textContent = on ? (this.blink.hazard ? '⚠️' : this.blink.side > 0 ? '➡️' : '⬅️') : '';
    }
  }
}
