import { fa, faMoney, damp } from './util.js';

const $ = (id) => document.getElementById(id);

/** Jump & drift scoring, slow motion during big jumps. */
export class Stunts {
  constructor(game) {
    this.g = game;
    this.drift = 0;
    this.driftT = 0;
    this.calm = 0;
    this.slow = 1;
  }
  show(text, cls = '') {
    const el = $('stunt');
    el.className = cls;
    el.textContent = text;
    el.classList.toggle('hidden', !text);
  }
  banner(text) {
    const el = document.createElement('div');
    el.className = 'stuntpop';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }
  update(dt) {
    const g = this.g, p = g.player, s = g.stats;
    const driving = g.state === 'play' && !g.onfoot.active;
    // ---------- jumps ----------
    let slowTarget = 1;
    if (driving && p.air) {
      if (p.airT > 0.35) {
        this.show(`✈️ ${fa(p.airT.toFixed(1)).replace('.', '٫')} ثانیه پرواز!`, 'air');
        if (p.y - g.world.heightAt(p.pos.x, p.pos.z) > 2.5) slowTarget = 0.45;
      }
    } else if (!this.drift) this.show('');
    if (p.landed) {
      const L = p.landed;
      p.landed = null;
      if (driving && L.airT > 0.5) {
        const pts = Math.round(L.airT * 100 + L.height * 25);
        const cash = pts * 150;
        g.money += cash;
        s.jumps = (s.jumps || 0) + 1;
        s.bestAir = Math.max(s.bestAir || 0, L.airT);
        g.audio.cash();
        this.banner(`🚀 پرش ${fa(L.airT.toFixed(1)).replace('.', '٫')} ثانیه • +${faMoney(cash)} تومان`);
        if (L.imp > 16) g.ui.toast('💥 فرود سخت! ماشین آسیب دید', 'bad');
      }
    }
    this.slow = damp(this.slow, slowTarget, slowTarget < 1 ? 8 : 4, dt);
    g.slowmo = this.slow;
    // ---------- drifts ----------
    if (!driving || p.air) {
      if (this.drift) this.endDrift(false);
      return;
    }
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const vx = fx * p.speed + p.ext.x, vz = fz * p.speed + p.ext.y;
    const v = Math.hypot(vx, vz);
    const sinA = v > 0.1 ? Math.abs(fx * vz - fz * vx) / v : 0;
    if (v > 8 && sinA > 0.22) {
      this.drift += sinA * v * dt * 14;
      this.driftT += dt;
      this.calm = 0;
      if (this.driftT > 0.4) this.show(`🌀 دریفت! ${fa(Math.round(this.drift))}`, 'drift');
    } else if (this.drift) {
      this.calm += dt;
      if (this.calm > 0.8) this.endDrift(true);
    }
    // a crash ruins the drift
    if (this.drift && p.events.some((e) => e.type === 'crash' && e.impact > 3)) {
      this.banner('💥 دریفت از دست رفت!');
      this.endDrift(false);
    }
  }
  endDrift(bank) {
    const g = this.g, s = g.stats;
    const pts = Math.round(this.drift);
    if (bank && this.driftT > 1 && pts > 50) {
      const cash = pts * 40;
      g.money += cash;
      s.bestDrift = Math.max(s.bestDrift || 0, pts);
      s.drifts = (s.drifts || 0) + 1;
      g.audio.cash();
      this.banner(`🌀 دریفت ${fa(pts)} امتیاز • +${faMoney(cash)} تومان`);
    }
    this.drift = 0;
    this.driftT = 0;
    this.calm = 0;
    this.show('');
  }
}
