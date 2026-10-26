import { Walker } from './people.js';
import { poseWalk, poseIdle } from './models.js';
import { clamp, dampAngle, collideCircle } from './util.js';

const R = 0.35;
const _res = { nx: 0, nz: 0, pen: 0 };

/** Getting out of the taxi and walking around on foot. */
export class OnFoot {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.busy = false;
    this.walker = null;
    this.speed = 0;
    this.yaw = 0;
    this._q = [];
    this._c = [];
  }
  doorPoint(out) {
    const p = this.g.player;
    const h = p.heading;
    return { x: p.pos.x + Math.cos(h) * out + Math.sin(h) * 0.2, z: p.pos.z - Math.sin(h) * out + Math.cos(h) * 0.2 };
  }
  nearCar() {
    if (!this.walker) return false;
    const d = this.doorPoint(1.4);
    return Math.hypot(this.walker.pos.x - d.x, this.walker.pos.z - d.z) < 3.2;
  }
  toggle() {
    if (this.active) this.enter();
    else this.exit();
  }
  /** jump out immediately (fire!) */
  forceExit() {
    if (this.active || this.busy) return;
    this.g.player.speed = 0;
    this.doExit(0, 2.6);
  }
  exit() {
    const g = this.g, p = g.player;
    if (this.active || this.busy || g.state !== 'play') return;
    if (Math.abs(p.speed) > 1.5) {
      g.ui.toast('اول ماشین رو کامل نگه دار، بعد پیاده شو ✋', 'warn');
      return;
    }
    this.doExit(450, 1.4);
  }
  doExit(delay, out) {
    const g = this.g, p = g.player;
    this.busy = true;
    p.car.doors.fl.target = 1;
    g.audio.door();
    setTimeout(() => {
      p.driver.root.visible = false;
      if (!this.walker) this.walker = new Walker(g.scene, g.driverLook);
      const w = this.walker;
      if (!w.root.parent) g.scene.add(w.root);
      w.root.visible = true;
      w.handsUp = false;
      w.mode = 'idle';
      w.target = null;
      const d = this.doorPoint(out);
      w.setPos(d.x, d.z, p.heading + Math.PI / 2);
      this.yaw = p.heading;
      this.speed = 0;
      g.lookYaw = 0;
      g.lookPitch = 0;
      this.active = true;
      this.busy = false;
      document.body.classList.add('onfoot');
      g.ui.toast('پیاده شدی 🚶 برای سوار شدن برو کنار در راننده', 'info');
      setTimeout(() => {
        p.car.doors.fl.target = 0;
        g.audio.door();
      }, 700);
    }, delay);
  }
  enter() {
    const g = this.g, p = g.player, w = this.walker;
    if (!this.active || this.busy) return;
    if (p.burning) {
      g.ui.toast('ماشین داره می‌سوزه! صبر کن خودش درست بشه 🔥', 'warn');
      return;
    }
    if (!this.nearCar()) {
      g.ui.toast('برو کنار در راننده تا سوار بشی 🚗', 'warn');
      return;
    }
    this.busy = true;
    const d = this.doorPoint(1.3);
    w.walkTo(d.x, d.z, 2, () => {
      w.lookAt(p.pos.x, p.pos.z);
      p.car.doors.fl.target = 1;
      g.audio.door();
      setTimeout(() => {
        this.instantIn();
        setTimeout(() => {
          p.car.doors.fl.target = 0;
          g.audio.door();
        }, 500);
      }, 450);
    });
  }
  /** put the driver back behind the wheel immediately (used by cutscenes) */
  instantIn() {
    const g = this.g;
    if (this.walker) {
      this.walker.root.visible = false;
      this.walker.mode = 'idle';
      this.walker.target = null;
      this.walker.onArrive = null;
    }
    g.player.driver.root.visible = true;
    g.lookYaw = 0;
    this.active = false;
    this.busy = false;
    this.speed = 0;
    document.body.classList.remove('onfoot');
  }
  update(dt, inp) {
    if (!this.active) return;
    const g = this.g, w = this.walker;
    if (this.busy) {
      w.update(dt, g.world);
      this.speed = w.mode === 'walk' ? w.speed : 0;
      return;
    }
    const cy = this.yaw + g.lookYaw;
    const mx = inp.moveX, mz = inp.moveY;
    const mag = Math.min(1, Math.hypot(mx, mz));
    if (mag > 0.12) {
      const fx = Math.sin(cy), fz = Math.cos(cy);
      const rx = -fz, rz = fx;
      const dx = fx * mz + rx * mx, dz = fz * mz + rz * mx;
      const run = inp.run || mag > 0.92;
      this.speed = (run ? 4.4 : 1.8) * Math.max(0.4, mag);
      w.heading = dampAngle(w.heading, Math.atan2(dx, dz), 10, dt);
      const l = Math.hypot(dx, dz);
      w.pos.x += (dx / l) * this.speed * dt;
      w.pos.z += (dz / l) * this.speed * dt;
      poseWalk(w.p, dt, this.speed);
      if (run) w.p.spine.rotation.x = 0.15;
    } else {
      this.speed = 0;
      w.t += dt;
      poseIdle(w.p, w.t);
    }
    // collisions: buildings, trees, poles, our taxi and traffic
    g.world.statics.query(w.pos.x, w.pos.z, 1, this._q);
    for (const o of this._q) {
      if (o.soft || !collideCircle(w.pos.x, w.pos.z, R, o, _res)) continue;
      w.pos.x += _res.nx * _res.pen;
      w.pos.z += _res.nz * _res.pen;
    }
    const cars = [g.player, ...g.traffic.cars.filter((c) => c.active)];
    if (g.police.unit.active) cars.push(g.police.unit);
    for (const c of cars) {
      if (Math.hypot(c.pos.x - w.pos.x, c.pos.z - w.pos.z) > 5) continue;
      const cc = c.circles(this._c);
      for (let k = 0; k < 3; k++) {
        const ddx = w.pos.x - cc[k * 2], ddz = w.pos.z - cc[k * 2 + 1];
        const dd = Math.hypot(ddx, ddz);
        const min = R + 0.95;
        if (dd < min && dd > 1e-4) {
          w.pos.x += (ddx / dd) * (min - dd);
          w.pos.z += (ddz / dd) * (min - dd);
        }
      }
    }
    w.root.position.set(w.pos.x, g.world.heightAt(w.pos.x, w.pos.z) + 0.03, w.pos.z);
    w.root.rotation.y = w.heading;
    w.p.head.visible = g.camMode !== 'first';
  }
}

/** turns "۱۸ ۱۸", "1818", "١٨١٨" into "1818" */
export function normalizeCode(s) {
  return String(s)
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/\s+/g, '');
}
export { clamp };
