/* ============================ SOUND (Web Audio synth) ============================ */
const Sound = {
  ctx: null, on: true,
  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') try { this.ctx.resume(); } catch (e) {} return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.on ? 0.7 : 0; this.master.connect(c.destination);
      this.comp = c.createDynamicsCompressor(); this.comp.connect(this.master);
      this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.comp);
      this.mus = c.createGain(); this.mus.gain.value = 0.32; this.mus.connect(this.comp);
      this.dly = c.createDelay(1); this.dly.delayTime.value = 0.36; this.fb = c.createGain(); this.fb.gain.value = 0.38;
      this.dlyF = c.createBiquadFilter(); this.dlyF.type = 'lowpass'; this.dlyF.frequency.value = 2200;
      this.dly.connect(this.dlyF); this.dlyF.connect(this.fb); this.fb.connect(this.dly); this.dlyF.connect(this.mus);
      const len = c.sampleRate; const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.nbuf = b; this.applyVol(); this.startMusic();
    } catch (e) { this.ctx = null; }
  },
  applyVol() { if (!this.ctx) return; this.sfx.gain.value = 0.9 * CFG.sfxV / 100; this.mus.gain.value = 0.32 * CFG.musicV / 100; },
  visible(v) { if (!this.ctx) return; try { v ? this.ctx.resume() : this.ctx.suspend(); } catch (e) {} },
  setOn(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? 0.7 : 0, this.ctx.currentTime, 0.05); },
  tone(f0, f1, dur, type = 'square', vol = 0.2, delay = 0, bus) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfx); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol, freq, type = 'lowpass', delay = 0, f1) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.nbuf; const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  },
  play(n) {
    if (!this.ctx || !this.on) return;
    switch (n) {
      case 'jump': this.tone(380, 720, 0.13, 'square', 0.07); this.tone(190, 360, 0.13, 'triangle', 0.08); break;
      case 'land': this.noise(0.08, 0.16, 900); break;
      case 'die': this.noise(0.45, 0.5, 2400, 'lowpass', 0, 200); this.tone(320, 40, 0.5, 'sawtooth', 0.16); this.tone(90, 30, 0.35, 'sine', 0.4); break;
      case 'pop': this.tone(1400, 300, 0.09, 'square', 0.08); this.noise(0.06, 0.2, 5000, 'highpass'); break;
      case 'appear': this.tone(500, 1200, 0.18, 'sine', 0.12); break;
      case 'rumble': this.noise(0.7, 0.35, 220); this.tone(55, 40, 0.6, 'sine', 0.25); break;
      case 'thud': this.noise(0.35, 0.55, 300); this.tone(80, 30, 0.35, 'sine', 0.5); break;
      case 'crack': this.noise(0.12, 0.3, 3000, 'bandpass'); this.tone(900, 200, 0.08, 'square', 0.04); break;
      case 'whoosh': this.noise(0.45, 0.3, 400, 'bandpass', 0, 3000); break;
      case 'spring': this.tone(180, 900, 0.28, 'sine', 0.22); this.tone(360, 1500, 0.2, 'triangle', 0.06); break;
      case 'orb': this.tone(300, 1200, 0.3, 'sine', 0.18); this.tone(1200, 300, 0.3, 'triangle', 0.08, 0.05); break;
      case 'saw': this.noise(1.2, 0.18, 1600, 'bandpass'); this.tone(220, 260, 1.0, 'sawtooth', 0.04); break;
      case 'thunder': this.noise(1.1, 0.22, 500, 'lowpass', 0, 80); break;
      case 'spawn': this.tone(600, 1200, 0.16, 'sine', 0.08); break;
      case 'click': this.tone(800, 600, 0.05, 'square', 0.05); break;
      case 'gem': this.tone(1320, 1980, 0.09, 'sine', 0.08); this.tone(1980, 2640, 0.08, 'triangle', 0.04, 0.05); break;
      case 'roar': this.noise(1.1, 0.4, 500, 'bandpass', 0, 140); this.tone(130, 55, 1.1, 'sawtooth', 0.1); this.tone(98, 49, 1.0, 'square', 0.05, 0.05); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0, 0.32, 'triangle', 0.14, i * 0.08)); this.tone(1568, 0, 0.5, 'sine', 0.06, 0.32); break;
    }
  },
  // looping rain hiss and wind (0..1 each), faded smoothly
  ambient(rain, wind) {
    const c = this.ctx; if (!c) return;
    if (!this.amb) {
      const mk = (type, f, q) => { const s = c.createBufferSource(); s.buffer = this.nbuf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
        const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.sfx); s.start(); return { s, fl, g }; };
      this.amb = { rain: mk('bandpass', 2600, .45), wind: mk('lowpass', 380, .8) };
    }
    const t = c.currentTime;
    this.amb.rain.g.gain.setTargetAtTime(rain * .2, t, .6); this.amb.wind.g.gain.setTargetAtTime(wind * .32, t, .9);
    this.amb.wind.fl.frequency.setTargetAtTime(320 + Math.sin(t * .37) * 140, t, .6);
  },
  stomp(k) {
    if (!this.ctx || !this.on) return; const now = this.ctx.currentTime; if (now - (this.lastStomp || 0) < 0.12) return; this.lastStomp = now;
    this.tone(75, 32, 0.4, 'sine', 0.55 * k); this.noise(0.25, 0.32 * k, 220);
  },
  startMusic() {
    const c = this.ctx; const bpm = 104, beat = 60 / bpm; let next = c.currentTime + 0.2, step = 0;
    const roots = [57, 53, 48, 55]; // A F C G
    const scale = [0, 3, 5, 7, 10, 12, 15];
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    const pad = (root, t, dur) => {
      [0, 7, 12, 16].forEach((iv, k) => {
        const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
        o.type = k % 2 ? 'sawtooth' : 'triangle'; o.frequency.value = mtof(root - 12 + iv + (k === 3 && root !== 48 ? -1 : 0)); o.detune.value = (k - 1.5) * 6;
        f.type = 'lowpass'; f.frequency.value = 700;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + 1.2); g.gain.setValueAtTime(0.035, t + dur - 1); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
        o.connect(f); f.connect(g); g.connect(this.mus); o.start(t); o.stop(t + dur + 0.7);
      });
    };
    const pluck = (m, t, v) => {
      const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = mtof(m); f.type = 'lowpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.3);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(f); f.connect(g); g.connect(this.mus); g.connect(this.dly); o.start(t); o.stop(t + 0.5);
    };
    const bass = (m, t) => { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = mtof(m - 24);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 1.8);
      o.connect(g); g.connect(this.mus); o.start(t); o.stop(t + beat * 2); };
    const tick = () => {
      // after the tab was hidden/suspended, don't try to "catch up" by scheduling hundreds of notes at once
      if (next < c.currentTime - 0.2) next = c.currentTime + 0.05;
      if (c.state !== 'running' || !this.on || CFG.musicV <= 0) return;
      while (next < c.currentTime + 0.3) {
        const bar = Math.floor(step / 8), root = roots[bar % 4], s8 = step % 8;
        if (s8 === 0) { pad(root, next, beat * 4); bass(root, next); }
        if (s8 === 4) bass(root + 7, next);
        const pat = [0, -1, 2, 1, 3, -1, 4, 2];
        let idx = pat[(s8 + bar * 3) % 8];
        if (idx >= 0 && (Math.random() < 0.82)) { if (Math.random() < 0.2) idx = Math.floor(Math.random() * scale.length); pluck(57 + 12 + scale[idx] + (root - 57 > 0 ? 0 : 0), next, s8 % 2 ? 0.05 : 0.08); }
        next += beat / 2; step++;
      }
    };
    setInterval(tick, 90); tick();
  }
};

