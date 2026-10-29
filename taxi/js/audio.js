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
    // tyre squeal: narrow band noise with a wobbling pitch
    const sk = ctx.createBufferSource();
    sk.buffer = buf;
    sk.loop = true;
    this.skidFilter = ctx.createBiquadFilter();
    this.skidFilter.type = 'bandpass';
    this.skidFilter.frequency.value = 1700;
    this.skidFilter.Q.value = 9;
    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0;
    sk.connect(this.skidFilter).connect(this.skidGain).connect(this.master);
    sk.start();
    // gushing water (broken hydrants)
    const wa = ctx.createBufferSource();
    wa.buffer = buf;
    wa.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'highpass';
    wf.frequency.value = 900;
    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0;
    wa.connect(wf).connect(this.waterGain).connect(this.master);
    wa.start(0, 0.7);

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
  setSkid(level) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.skidGain.gain.setTargetAtTime(Math.min(0.5, level) * 0.6, t, 0.06);
    this.skidFilter.frequency.setTargetAtTime(1500 + Math.sin(t * 13) * 180 + level * 300, t, 0.05);
  }
  setWater(level) {
    if (!this.ctx) return;
    this.waterGain.gain.setTargetAtTime(Math.min(1, level) * 0.18, this.ctx.currentTime, 0.2);
  }
  /** exhaust backfire: a short low thump and crackle */
  backfire(k = 1) {
    if (!this.ctx) return;
    this.burst(0.09, 380, 'lowpass', 0.55 * k);
    this.burst(0.05, 2400, 'bandpass', 0.25 * k);
    this.tone(70, 0.12, 0.22 * k, 'sine');
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
    this.updateRadio();
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
  /* ---------- weather ---------- */
  setRain(level) {
    if (!this.ctx) return;
    if (!this.rainGain) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 1400;
      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.value = 0;
      src.connect(f).connect(this.rainGain).connect(this.master);
      src.start();
    }
    this.rainGain.gain.setTargetAtTime(level * 0.12, this.ctx.currentTime, 0.5);
  }
  thunder() {
    this.burst(2.8, 120, 'lowpass', 0.9);
    this.burst(1.2, 400, 'lowpass', 0.4);
  }

  /* ---------- radio: procedurally generated music ---------- */
  setRadio(station) {
    this.station = station;
    if (!this.ctx) return;
    if (!this.radioGain) {
      this.radioGain = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 5200; // a bit "car speaker"
      this.radioGain.connect(f).connect(this.master);
    }
    this.radioGain.gain.setTargetAtTime(station ? 0.5 : 0, this.ctx.currentTime, 0.1);
    this.radioNext = this.ctx.currentTime + 0.1;
    this.radioStep = 0;
    this.melody = 0;
  }
  note(freq, t, dur, gain, type = 'triangle', attack = 0.005) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.radioGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  drum(t, freq, dur, gain, type = 'lowpass') {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.radioGain);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }
  updateRadio() {
    if (!this.ctx || !this.station || !this.enabled) return;
    if (!this.radioGain) this.setRadio(this.station);
    const ctx = this.ctx;
    const hz = (semi, base = 220) => base * Math.pow(2, semi / 12);
    // after the tab was hidden (or sound was off) skip the missed notes instead of playing them all at once
    if (this.radioNext < ctx.currentTime) this.radioNext = ctx.currentTime + 0.05;
    while (this.radioNext < ctx.currentTime + 0.3) {
      const t = this.radioNext, i = this.radioStep++;
      if (this.station === 'pop') {
        // Am - F - C - G at ~112 bpm, 8th-note grid
        const step = 0.27;
        const chords = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]];
        const ch = chords[Math.floor(i / 8) % 4];
        if (i % 2 === 0) this.drum(t, 150, 0.25, 0.9); // kick
        if (i % 4 === 2) this.drum(t, 1800, 0.18, 0.35, 'bandpass'); // snare
        this.drum(t, 7000, 0.05, 0.12, 'highpass'); // hat
        if (i % 2 === 0) this.note(hz(ch[0] - 12, 110), t, 0.45, 0.22, 'triangle'); // bass
        this.note(hz(ch[i % 3] + 12), t, 0.22, 0.05, 'square'); // arpeggio
        if (i % 8 === 0) for (const n of ch) this.note(hz(n), t, 2.0, 0.035, 'sawtooth', 0.08); // pad
        if (Math.random() < 0.45) {
          const scale = [0, 3, 5, 7, 10, 12, 15];
          this.melody = Math.max(0, Math.min(6, this.melody + Math.floor(Math.random() * 3) - 1));
          this.note(hz(scale[this.melody] + 12), t, 0.35, 0.08, 'sine');
        }
        this.radioNext += step;
      } else {
        // Persian "Shur" on D with quarter tones: santur tremolo + daf
        const step = 0.17;
        const shur = [0, 1.5, 3, 5, 6.5, 8, 10, 12, 13.5, 15];
        if (i % 6 === 0) this.drum(t, 110, 0.35, 0.8);
        if (i % 6 === 3) this.drum(t, 900, 0.15, 0.3, 'bandpass');
        if (i % 6 === 5) this.drum(t, 2500, 0.08, 0.2, 'bandpass');
        if (i % 3 === 0) this.melody = Math.max(0, Math.min(9, this.melody + Math.floor(Math.random() * 3) - 1 + (this.melody < 2 ? 1 : 0)));
        const f = hz(shur[this.melody], 293.66);
        this.note(f, t, 0.9, 0.09, 'triangle', 0.002);
        this.note(f * 2, t, 0.4, 0.025, 'sine', 0.002);
        if (i % 12 === 0) this.note(hz(-12, 293.66), t, 1.8, 0.08, 'triangle');
        this.radioNext += step;
      }
    }
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
