export class AudioSys {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.voice = true;
    this.sirenOn = false;
    this.sirenT = 0;
  }
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.55 : 0;
    this.master.connect(ctx.destination);

    // engine: two detuned oscillators through a lowpass
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 600;
    this.engFilter.Q.value = 2;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.e1 = ctx.createOscillator();
    this.e1.type = 'sawtooth';
    this.e2 = ctx.createOscillator();
    this.e2.type = 'square';
    this.e3 = ctx.createOscillator();
    this.e3.type = 'triangle';
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    const g3 = ctx.createGain();
    g3.gain.value = 0.6;
    this.e1.connect(this.engFilter);
    this.e2.connect(g2).connect(this.engFilter);
    this.e3.connect(g3).connect(this.engFilter);
    this.engFilter.connect(this.engGain).connect(this.master);
    for (const o of [this.e1, this.e2, this.e3]) o.start();

    // noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const wn = ctx.createBufferSource();
    wn.buffer = buf;
    wn.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 500;
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wn.connect(this.windFilter).connect(this.windGain).connect(this.master);
    wn.start();

    // siren
    this.sOsc = ctx.createOscillator();
    this.sOsc.type = 'square';
    this.sGain = ctx.createGain();
    this.sGain.gain.value = 0;
    const sf = ctx.createBiquadFilter();
    sf.type = 'lowpass';
    sf.frequency.value = 2200;
    this.sOsc.connect(sf).connect(this.sGain).connect(this.master);
    this.sOsc.start();

    // horn
    this.hGain = ctx.createGain();
    this.hGain.gain.value = 0;
    const hf = ctx.createBiquadFilter();
    hf.type = 'lowpass';
    hf.frequency.value = 1800;
    for (const f of [392, 494]) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      o.connect(hf);
      o.start();
    }
    hf.connect(this.hGain).connect(this.master);
  }
  setEnabled(v) {
    this.enabled = v;
    if (this.master) this.master.gain.value = v ? 0.55 : 0;
    if (!v && window.speechSynthesis) window.speechSynthesis.cancel();
  }
  setEngine(rpm, throttle, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = Math.max(20, (rpm / 60) * 2);
    this.e1.frequency.setTargetAtTime(f, t, 0.03);
    this.e2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    this.e3.frequency.setTargetAtTime(f * 2.02, t, 0.03);
    this.engFilter.frequency.setTargetAtTime(250 + throttle * 1300 + rpm * 0.18, t, 0.05);
    this.engGain.gain.setTargetAtTime(on ? 0.1 + throttle * 0.11 : 0, t, 0.08);
  }
  setWind(speed, rough) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(Math.min(0.22, speed * 0.0035 + (rough ? speed * 0.004 : 0)), t, 0.2);
    this.windFilter.frequency.setTargetAtTime(rough ? 220 : 380 + speed * 12, t, 0.2);
  }
  horn(on) {
    if (!this.ctx) return;
    this.hGain.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.02);
  }
  siren(on, vol = 1) {
    this.sirenOn = on;
    this.sirenVol = vol;
    if (!this.ctx) return;
    this.sGain.gain.setTargetAtTime(on ? 0.07 * vol : 0, this.ctx.currentTime, 0.1);
  }
  update(dt) {
    if (!this.ctx || !this.sirenOn) return;
    this.sirenT += dt;
    const f = 700 + 420 * (0.5 + 0.5 * Math.sin(this.sirenT * Math.PI * 1.3));
    this.sOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.02);
  }
  burst(dur, freq, type, gain) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }
  tone(freq, dur, gain = 0.15, type = 'sine', when = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    const t = ctx.currentTime + when;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  click(v = 0.5) {
    this.burst(0.05, 2500, 'highpass', 0.25 * v);
    this.tone(140, 0.06, 0.12 * v, 'square');
  }
  crash(intensity) {
    const k = Math.min(1, intensity / 12);
    this.burst(0.5 + k * 0.5, 900, 'lowpass', 0.4 + k * 0.6);
    this.burst(0.25, 3500, 'highpass', 0.2 + k * 0.3);
    this.tone(55, 0.35, 0.4 * k + 0.1, 'sine');
  }
  door() {
    this.burst(0.18, 260, 'lowpass', 0.5);
  }
  cash() {
    this.tone(988, 0.12, 0.18);
    this.tone(1319, 0.3, 0.18, 'sine', 0.1);
  }
  beep() {
    this.tone(660, 0.12, 0.12, 'triangle');
  }
  bad() {
    this.tone(220, 0.25, 0.15, 'sawtooth');
    this.tone(180, 0.35, 0.15, 'sawtooth', 0.18);
  }
  speak(text) {
    if (!this.voice || !this.enabled || !window.speechSynthesis) return;
    try {
      const voices = window.speechSynthesis.getVoices();
      const v = voices.find((x) => /^fa/i.test(x.lang));
      if (!v) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = v;
      u.lang = v.lang;
      u.rate = 1.02;
      window.speechSynthesis.speak(u);
    } catch (e) {
      /* speech is optional */
    }
  }
}
