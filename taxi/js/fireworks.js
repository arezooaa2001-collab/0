import { Particles } from './effects.js';
import { regionAt } from './world.js';

const COLORS = [0xff3b3b, 0xffd21a, 0x39ff7a, 0x3ba8ff, 0xff4fd8, 0xffffff];

/** Fireworks: rockets that whistle up and burst into coloured stars. */
export class Fireworks {
  constructor(game) {
    this.g = game;
    this.sets = COLORS.map((c) => new Particles(game.scene, { max: 320, color: c, additive: true }));
    this.trail = new Particles(game.scene, { max: 200, color: 0xffc070, additive: true });
    this.rockets = [];
    this.queue = [];
    this.autoT = 20;
  }
  setScale(h, fov) {
    for (const p of this.sets) p.setScale(h, fov);
    this.trail.setScale(h, fov);
  }
  /** a short show of n rockets around (x, z) */
  show(x, z, n = 6) {
    for (let i = 0; i < n; i++) this.queue.push({ t: i * (0.25 + Math.random() * 0.35), x: x + (Math.random() - 0.5) * 50, z: z + (Math.random() - 0.5) * 50 });
  }
  launch(x, z) {
    const g = this.g;
    const y = g.world.heightAt(x, z);
    this.rockets.push({ x, y, z, vx: (Math.random() - 0.5) * 4, vy: 27 + Math.random() * 8, vz: (Math.random() - 0.5) * 4, t: 0, fuse: 1.3 + Math.random() * 0.5, c: Math.floor(Math.random() * COLORS.length) });
    const d = Math.hypot(x - g.player.pos.x, z - g.player.pos.z);
    const vol = Math.max(0, 1 - d / 600);
    if (vol > 0.05 && g.audio.ctx) {
      // rising whistle
      const ctx = g.audio.ctx, o = ctx.createOscillator(), gn = ctx.createGain(), t = ctx.currentTime;
      o.type = 'sine';
      o.frequency.setValueAtTime(900, t);
      o.frequency.exponentialRampToValueAtTime(2600, t + 1.2);
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(0.04 * vol, t + 0.1);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
      o.connect(gn).connect(g.audio.master);
      o.start(t);
      o.stop(t + 1.4);
    }
  }
  burst(r) {
    const g = this.g, P = this.sets[r.c], P2 = this.sets[(r.c + 2) % COLORS.length];
    const n = 70;
    for (let i = 0; i < n; i++) {
      // even-ish directions on a sphere
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const sp = 19 + Math.random() * 6;
      (i % 4 ? P : P2).emit(r.x, r.y, r.z, Math.cos(a) * s * sp, u * sp, Math.sin(a) * s * sp, 1.7 + Math.random() * 0.9, 4.2, -0.4, 1, 1.4);
    }
    const d = Math.hypot(r.x - g.player.pos.x, r.z - g.player.pos.z, r.y - g.player.y);
    const vol = Math.max(0, 1 - d / 700);
    if (vol > 0.05) {
      // the bang arrives a little later than the flash
      setTimeout(() => {
        if (g.state !== 'play' && g.state !== 'cutscene') return;
        g.audio.burst(0.5, 260, 'lowpass', 0.8 * vol);
        g.audio.burst(0.6, 3200, 'highpass', 0.18 * vol);
      }, Math.min(1500, (d / 340) * 1000));
    }
  }
  update(dt) {
    const g = this.g;
    // random shows over the city at night
    if (g.state === 'play' && g.env && g.env.night > 0.6) {
      this.autoT -= dt;
      if (this.autoT <= 0) {
        this.autoT = 35 + Math.random() * 50;
        const p = g.player.pos;
        const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 180;
        const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
        if (regionAt(x, z) === 'city' || regionAt(p.x, p.z) === 'city') this.show(x, z, 5 + Math.floor(Math.random() * 6));
      }
    }
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      q.t -= dt;
      if (q.t <= 0) {
        this.launch(q.x, q.z);
        this.queue.splice(i, 1);
      }
    }
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.t += dt;
      r.vy -= 9.8 * dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.z += r.vz * dt;
      if (Math.random() < 0.8) this.trail.emit(r.x, r.y, r.z, (Math.random() - 0.5) * 0.6, -1, (Math.random() - 0.5) * 0.6, 0.6, 1.8, -0.5, 0.9, 1);
      if (r.t >= r.fuse) {
        this.burst(r);
        this.rockets.splice(i, 1);
      }
    }
    for (const p of this.sets) p.update(dt, 3.2);
    this.trail.update(dt, 0);
  }
}
