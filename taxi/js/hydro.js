import { clamp, pick } from './util.js';

/** Hydraulics (a garage part): hold the 🦘 button (or 8) to squat the car on its springs and
 *  let go to hop: a little hop when you tap, a big one when you charge it. Hop over police
 *  spikes and traffic. Standing still, each tap makes the car dance like a lowrider. */
export class Hydro {
  constructor(game) {
    this.g = game;
    this.charge = 0;
    this.holding = false;
    this.cd = 0;
    this.dance = 0;
    this.danceT = 0;
    this.taps = [];
    const btn = (this.btn = document.getElementById('btnHydro'));
    if (btn) {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        this.press();
      });
      const up = () => this.release();
      btn.addEventListener('pointerup', up);
      btn.addEventListener('lostpointercapture', up);
      btn.addEventListener('pointercancel', up);
    }
    // keyboard: hold 8
    const typing = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    window.addEventListener('keydown', (e) => {
      if ((e.code === 'Digit8' || e.code === 'Numpad8') && !e.repeat && !typing(e)) this.press();
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Digit8' || e.code === 'Numpad8') this.release();
    });
  }
  get owned() {
    return this.g.player.hasPerf('hydro');
  }
  ready() {
    const g = this.g, p = g.player;
    return this.owned && g.state === 'play' && !g.onfoot.active && !g.onfoot.busy && p.health > 0 && !p.script;
  }
  press() {
    if (!this.ready() || this.holding) return;
    this.g.audio.init();
    this.holding = true;
    this.charge = 0;
    // compressor whine while it charges
    this.g.audio.tone(140, 0.25, 0.05, 'sawtooth');
  }
  release() {
    if (!this.holding) return;
    this.holding = false;
    const g = this.g, p = g.player;
    const k = this.charge;
    this.charge = 0;
    p.hydroSquat = 0;
    if (!this.ready() || p.air || this.cd > 0) return;
    this.cd = 0.45;
    const A = g.audio;
    A.burst(0.25, 3200, 'highpass', 0.35); // pssht!
    A.tone(90, 0.12, 0.25, 'square');
    if (Math.abs(p.speed) < 2 && k < 0.35) return this.bounce();
    // a hop: tap = small, fully charged = big
    p.air = true;
    p.vy = 5 + k * 6.5;
    p.airT = 0;
    p.airMax = 0;
    p.geyserLaunch = true; // not a stunt-ramp jump: no prize money for it
    p.bump(2.2 + k * 1.5, -0.4, 0);
    g.stats.hops = (g.stats.hops || 0) + 1;
    if (k > 0.9) g.ui.toast('🦘 پرش بزرگ!', 'info');
  }
  /** standing still: the lowrider dance, a different bounce for each tap */
  bounce() {
    const g = this.g, p = g.player;
    const moves = [[2.6, 0, 0], [0.8, 1.8, 0], [0.8, -1.8, 0], [0.8, 0, 2.2], [0.8, 0, -2.2]];
    const m = moves[this.dance % moves.length];
    this.dance++;
    p.bump(m[0], m[1], m[2]);
    const now = g.time;
    this.taps = this.taps.filter((t) => now - t < 3);
    this.taps.push(now);
    if (this.taps.length >= 5 && now - (this.danceSaid || -99) > 20) {
      this.danceSaid = now;
      g.stats.hydroDances = (g.stats.hydroDances || 0) + 1;
      g.ui.toast(pick(['💃 ماشینت داره می‌رقصه!', '🕺 رقص لوراید! همه دارن نگاه می‌کنن', '🎶 هیدرولیک‌بازی!']), 'good');
      if (g.rides.ride && g.rides.state === 'toDest' && !g.rides.ride.danceSaid) {
        g.rides.ride.danceSaid = true;
        g.rides.say(pick(['وای این چه ماشینیه؟! 😂', 'تو رو خدا الان وقت رقصه؟ 😅', 'ایول! یه بار دیگه! 🕺']));
      }
    }
  }
  update(dt) {
    const g = this.g, p = g.player;
    this.cd = Math.max(0, this.cd - dt);
    const show = this.owned && !g.onfoot.active && g.state === 'play';
    if (this.btn) this.btn.classList.toggle('hidden', !show);
    if (this.holding) {
      if (!this.ready()) {
        this.holding = false;
        p.hydroSquat = 0;
        return;
      }
      this.charge = clamp(this.charge + dt * 1.25, 0, 1);
      // the body sinks as pressure builds
      p.hydroSquat = this.charge;
      if (this.btn) this.btn.style.setProperty('--k', String(this.charge));
    } else if (this.btn) this.btn.style.setProperty('--k', '0');
  }
}
