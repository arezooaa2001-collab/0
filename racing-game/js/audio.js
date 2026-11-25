// صداهای ساخته‌شده با WebAudio: موتور، باد، جیغ لاستیک، تشویق جمعیت، بوق شمارش
export class AudioSys {
  constructor() { this.ctx = null; this.volume = 0.8; this.enabled = true; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.volume; this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(this.master); this.bus = comp;
    // نویز
    const len = c.sampleRate * 2; const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const noise = () => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    // موتور
    this.eng = { gain: c.createGain(), filt: c.createBiquadFilter(), shaper: c.createWaveShaper(), o1: c.createOscillator(), o2: c.createOscillator(), o3: c.createOscillator() };
    const e = this.eng;
    e.o1.type = 'sawtooth'; e.o2.type = 'square'; e.o3.type = 'sawtooth'; e.o3.detune.value = 12;
    const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.2); } e.shaper.curve = curve;
    e.filt.type = 'lowpass'; e.filt.Q.value = 2.5;
    const g2 = c.createGain(); g2.gain.value = 0.5; const g3 = c.createGain(); g3.gain.value = 0.25;
    e.o1.connect(e.shaper); e.o2.connect(g2).connect(e.shaper); e.o3.connect(g3).connect(e.shaper);
    e.shaper.connect(e.filt).connect(e.gain).connect(this.bus);
    e.gain.gain.value = 0; [e.o1, e.o2, e.o3].forEach((o) => o.start());
    // باد
    this.wind = { src: noise(), filt: c.createBiquadFilter(), gain: c.createGain() };
    this.wind.filt.type = 'bandpass'; this.wind.filt.frequency.value = 600; this.wind.filt.Q.value = 0.6; this.wind.gain.gain.value = 0;
    this.wind.src.connect(this.wind.filt).connect(this.wind.gain).connect(this.bus);
    // جیغ لاستیک
    this.skid = { src: noise(), filt: c.createBiquadFilter(), gain: c.createGain() };
    this.skid.filt.type = 'bandpass'; this.skid.filt.frequency.value = 2300; this.skid.filt.Q.value = 9; this.skid.gain.gain.value = 0;
    this.skid.src.connect(this.skid.filt).connect(this.skid.gain).connect(this.bus);
    // جمعیت
    this.crowd = { src: noise(), filt: c.createBiquadFilter(), gain: c.createGain(), lfo: c.createOscillator(), lfoG: c.createGain() };
    this.crowd.filt.type = 'bandpass'; this.crowd.filt.frequency.value = 900; this.crowd.filt.Q.value = 0.7; this.crowd.gain.gain.value = 0;
    this.crowd.lfo.frequency.value = 3.1; this.crowd.lfoG.gain.value = 0; this.crowd.lfo.connect(this.crowd.lfoG).connect(this.crowd.gain.gain); this.crowd.lfo.start();
    this.crowd.src.connect(this.crowd.filt).connect(this.crowd.gain).connect(this.bus);
    // صدای ماشین‌های دیگر
    this.others = { o: c.createOscillator(), filt: c.createBiquadFilter(), gain: c.createGain() };
    this.others.o.type = 'sawtooth'; this.others.filt.type = 'lowpass'; this.others.filt.frequency.value = 500; this.others.gain.gain.value = 0;
    this.others.o.connect(this.others.filt).connect(this.others.gain).connect(this.bus); this.others.o.start();
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  setEngine({ rpm = 800, throttle = 0, speed = 0, cyl = 6, on = true }) {
    if (!this.ctx) return; const t = this.ctx.currentTime; const e = this.eng;
    const f = Math.max(20, (rpm / 60) * (cyl / 2));
    e.o1.frequency.setTargetAtTime(f, t, 0.03); e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03); e.o3.frequency.setTargetAtTime(f * 2, t, 0.03);
    e.filt.frequency.setTargetAtTime(300 + throttle * 2200 + rpm * 0.18, t, 0.05);
    e.gain.gain.setTargetAtTime(on ? 0.05 + throttle * 0.09 + Math.min(0.05, speed / 1500) : 0, t, 0.06);
    this.wind.gain.gain.setTargetAtTime(on ? Math.min(0.18, speed * speed / 60000) : 0, t, 0.1);
    this.wind.filt.frequency.setTargetAtTime(400 + speed * 8, t, 0.1);
  }
  setSkid(a) { if (!this.ctx) return; this.skid.gain.gain.setTargetAtTime(Math.min(0.16, a * 0.16), this.ctx.currentTime, 0.05); }
  setCrowd(a) { if (!this.ctx) return; const t = this.ctx.currentTime; this.crowd.gain.gain.setTargetAtTime(a * 0.12, t, 0.2); this.crowd.lfoG.gain.setTargetAtTime(a * 0.04, t, 0.2); }
  setOthers(dist, rpm) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.others.o.frequency.setTargetAtTime(Math.max(30, rpm / 20), t, 0.1);
    this.others.gain.gain.setTargetAtTime(Math.max(0, 0.06 * (1 - dist / 50)), t, 0.1);
  }
  beep(freq = 600, dur = 0.25, vol = 0.25) {
    if (!this.ctx) return; const c = this.ctx; const o = c.createOscillator(); const g = c.createGain();
    o.type = 'square'; o.frequency.value = freq; g.gain.value = vol; g.gain.setTargetAtTime(0, c.currentTime + dur * 0.7, 0.04);
    o.connect(g).connect(this.bus); o.start(); o.stop(c.currentTime + dur + 0.2);
  }
  thump(vol = 0.5) {
    if (!this.ctx) return; const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; const g = c.createGain(); g.gain.value = vol;
    g.gain.setTargetAtTime(0, c.currentTime + 0.05, 0.08); s.connect(f).connect(g).connect(this.bus); s.start(); s.stop(c.currentTime + 0.5);
  }
  pop() {
    if (!this.ctx) return; const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 180; f.Q.value = 1.5; const g = c.createGain(); g.gain.value = 0.35;
    g.gain.setTargetAtTime(0, c.currentTime + 0.02, 0.03); s.connect(f).connect(g).connect(this.bus); s.start(); s.stop(c.currentTime + 0.2);
  }
  cheer(dur = 2.5) {
    if (!this.ctx) return; const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.5; const g = c.createGain(); g.gain.value = 0;
    g.gain.setTargetAtTime(0.22, c.currentTime, 0.2); g.gain.setTargetAtTime(0, c.currentTime + dur, 0.5);
    s.connect(f).connect(g).connect(this.bus); s.start(); s.stop(c.currentTime + dur + 2.5);
    (this.cheers = this.cheers || new Set()).add(g); s.onended = () => this.cheers.delete(g);
  }

  // صداهای شهر آزاد
  burst({ type = 'bandpass', freq = 800, q = 1, vol = 0.3, dur = 0.2, at = 0, decay = 0.06 } = {}) {
    if (!this.ctx) return; const c = this.ctx; const t0 = c.currentTime + at; const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.value = 0;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.setTargetAtTime(0, t0 + dur * 0.6, decay);
    s.connect(f).connect(g).connect(this.bus); s.start(t0, Math.random()); s.stop(t0 + dur + 0.6);
  }
  tone(freq, dur = 0.3, vol = 0.2, type = 'sine', at = 0, slide = 0) {
    if (!this.ctx) return; const c = this.ctx; const t0 = c.currentTime + at; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.setTargetAtTime(0, t0 + dur * 0.5, dur * 0.25);
    o.connect(g).connect(this.bus); o.start(t0); o.stop(t0 + dur + 0.5);
  }
  sfx(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'cough': for (let k = 0; k < 2; k++) { this.burst({ freq: 420 + Math.random() * 160, q: 1.6, vol: 0.32, dur: 0.16, at: k * 0.22, decay: 0.05 }); this.burst({ type: 'lowpass', freq: 260, vol: 0.2, dur: 0.12, at: k * 0.22 }); } break;
      case 'gasp': this.burst({ freq: 1500, q: 0.8, vol: 0.12, dur: 0.5, decay: 0.12 }); break;
      case 'door': this.burst({ type: 'lowpass', freq: 300, vol: 0.25, dur: 0.12 }); this.tone(140, 0.25, 0.08, 'triangle', 0.02, -40); break;
      case 'bell': this.tone(880, 0.6, 0.16, 'sine'); this.tone(660, 0.8, 0.16, 'sine', 0.35); break;
      case 'splash': this.burst({ type: 'lowpass', freq: 1400, vol: 0.4, dur: 0.6, decay: 0.2 }); break;
      case 'water': this.burst({ freq: 2400, q: 0.5, vol: 0.1, dur: 1.2, decay: 0.3 }); break;
      case 'trash': this.burst({ type: 'lowpass', freq: 500, vol: 0.32, dur: 0.12 }); this.burst({ freq: 2600, q: 2, vol: 0.08, dur: 0.2, at: 0.03 }); break;
      case 'lid': this.burst({ type: 'lowpass', freq: 220, vol: 0.4, dur: 0.1 }); break;
      case 'pickup': this.burst({ freq: 3200, q: 1.5, vol: 0.07, dur: 0.15 }); break;
      case 'coin': this.tone(1320, 0.12, 0.14, 'square'); this.tone(1760, 0.3, 0.14, 'square', 0.09); break;
      case 'mission': this.tone(523, 0.18, 0.16, 'triangle'); this.tone(659, 0.18, 0.16, 'triangle', 0.15); this.tone(784, 0.4, 0.16, 'triangle', 0.3); break;
      case 'fail': this.tone(400, 0.4, 0.16, 'triangle', 0, -200); break;
      case 'click': this.burst({ freq: 3000, q: 3, vol: 0.12, dur: 0.04, decay: 0.01 }); break;
      case 'whoosh': this.burst({ freq: 900, q: 0.6, vol: 0.18, dur: 0.6, decay: 0.15 }); break;
      case 'scream': this.tone(900, 0.9, 0.05, 'sawtooth', 0, 300); break;
      case 'extinguish': this.burst({ type: 'highpass', freq: 1800, vol: 0.18, dur: 1.0, decay: 0.3 }); break;
      case 'jump': this.burst({ type: 'lowpass', freq: 400, vol: 0.15, dur: 0.08 }); break;
      case 'step': this.burst({ type: 'lowpass', freq: 380 + Math.random() * 120, vol: 0.05, dur: 0.05, decay: 0.02 }); break;
      case 'stepRun': this.burst({ type: 'lowpass', freq: 520 + Math.random() * 160, vol: 0.08, dur: 0.05, decay: 0.02 }); break;
      case 'siren': this.tone(760, 0.55, 0.07, 'sawtooth', 0, 380); this.tone(1140, 0.55, 0.07, 'sawtooth', 0.55, -380); break;
      case 'bark': this.burst({ freq: 620, q: 2.5, vol: 0.22, dur: 0.09, decay: 0.03 }); this.burst({ freq: 540, q: 2.5, vol: 0.2, dur: 0.09, at: 0.16, decay: 0.03 }); break;
      case 'thumpBall': this.burst({ type: 'lowpass', freq: 260, vol: 0.32, dur: 0.06, decay: 0.03 }); break;
      case 'horn': this.tone(420, 0.45, 0.12, 'square'); this.tone(520, 0.45, 0.08, 'square'); break;
    }
  }
  // صدای باران (پیوسته)
  setRain(a) {
    if (!this.ctx) return; const c = this.ctx;
    if (!this.rain) { const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200; const g = c.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(this.bus); s.start(); this.rain = { g }; }
    this.rain.g.gain.setTargetAtTime(Math.min(0.12, a * 0.12), c.currentTime, 0.4);
  }
  thunder() { if (!this.ctx) return; this.burst({ type: 'lowpass', freq: 120, vol: 0.5, dur: 2.2, at: 0.6 + Math.random() * 1.2, decay: 0.7 }); this.burst({ type: 'lowpass', freq: 300, vol: 0.25, dur: 0.6, at: 0.5, decay: 0.2 }); }
  // صدای ترق‌تروق آتش (پیوسته)
  setFire(a) {
    if (!this.ctx) return; const c = this.ctx;
    if (!this.fire) {
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
      const g = c.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(this.bus); s.start(); this.fire = { g, t: 0 };
    }
    this.fire.g.gain.setTargetAtTime(Math.min(0.2, a * 0.2), c.currentTime, 0.2);
    if (a > 0.05 && Math.random() < a * 0.25) this.burst({ freq: 1800 + Math.random() * 2500, q: 4, vol: 0.05 + a * 0.08, dur: 0.03, decay: 0.01 });
  }
  silence() { if (!this.ctx) return; for (const g of this.cheers || []) g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); this.setFire?.(0); this.setRain?.(0); this.setEngine({ on: false }); this.setSkid(0); this.setCrowd(0); this.setOthers(999, 0); }
  suspend() { this.ctx?.suspend?.(); }
  resume() { this.ctx?.resume?.(); }
}
