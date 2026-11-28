// صدا: افکت‌های سنتزشده با WebAudio + موسیقی رویه‌ای (بدون فایل)
export class AudioFX {
  constructor() {
    this.ctx = null;
    this.sfxVol = 0.8;
    this.musicVol = 0.45;
    this.started = false;
    this.windLevel = 0;
    this.musicOn = false;
    this.step16 = 0;
    this.mood = 0;
  }
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxVol;
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = this.musicVol * 0.5;
    this.music.connect(this.master);
    // اکوی ساده برای موسیقی
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.33;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.music);
    this.musicBus.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(this.music);
    // نویز پایه
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    // باد
    const wn = ctx.createBufferSource();
    wn.buffer = buf;
    wn.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 500;
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wn.connect(this.windFilter).connect(this.windGain).connect(this.sfx);
    wn.start();
    this.started = true;
    this.startMusic();
  }
  setVolumes(sfx, music) {
    this.sfxVol = sfx;
    this.musicVol = music;
    if (!this.ctx) return;
    this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
    this.music.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.1);
  }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }

  // ---- ابزار ----
  env(g, t, a, peak, dcy) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
  }
  tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, when = 0, dest) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    this.env(g, t, 0.005, vol, dur);
    o.connect(g).connect(dest || this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  noise(dur, vol = 0.3, ftype = 'lowpass', f0 = 1000, f1 = 0, when = 0, q = 1, dest) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = ftype;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t, 0.004, vol, dur);
    s.connect(f).connect(g).connect(dest || this.sfx);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
  }

  // ---- افکت‌ها ----
  jump(kind) {
    if (kind === 'double') {
      this.noise(0.35, 0.25, 'bandpass', 800, 3500, 0, 2);
      this.tone(520, 0.18, 'triangle', 0.12, 1.8);
      this.tone(780, 0.2, 'sine', 0.08, 1.6, 0.05);
    } else if (kind === 'wall') {
      this.noise(0.22, 0.25, 'bandpass', 1200, 2500, 0, 1.5);
      this.tone(330, 0.12, 'square', 0.05, 1.5);
    } else {
      this.noise(0.18, 0.22, 'bandpass', 600, 1800, 0, 1.2);
      this.tone(220, 0.12, 'sine', 0.12, 1.6);
    }
  }
  land(k) {
    this.tone(110, 0.18, 'sine', 0.25 * k + 0.08, 0.5);
    this.noise(0.14, 0.18 * k + 0.06, 'lowpass', 900, 200);
  }
  step(k) {
    this.noise(0.05, 0.05 + 0.06 * k, 'bandpass', 1400 + Math.random() * 600, 600, 0, 1.4);
  }
  coin(combo = 0) {
    const b = 988 * Math.pow(1.0595, Math.min(combo, 12));
    this.tone(b, 0.09, 'square', 0.06);
    this.tone(b * 1.5, 0.22, 'triangle', 0.1, 1, 0.06);
  }
  checkpoint() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.13, 1, i * 0.07));
    this.noise(0.6, 0.1, 'highpass', 3000, 8000, 0.1);
  }
  finish(win) {
    const seq = win ? [523, 659, 784, 1046, 784, 1046, 1318] : [440, 554, 659, 880];
    seq.forEach((f, i) => {
      this.tone(f, 0.35, 'triangle', 0.14, 1, i * 0.11);
      this.tone(f / 2, 0.35, 'sawtooth', 0.04, 1, i * 0.11);
    });
  }
  fall() {
    this.tone(600, 0.7, 'sawtooth', 0.07, 0.15);
    this.noise(0.6, 0.15, 'bandpass', 2000, 300, 0, 1);
  }
  zap() {
    for (let i = 0; i < 4; i++) this.tone(1200 + Math.random() * 1200, 0.06, 'square', 0.06, 0.3, i * 0.04);
    this.noise(0.25, 0.25, 'highpass', 2500, 6000);
  }
  bounce() {
    this.tone(180, 0.45, 'sine', 0.3, 4);
    this.tone(360, 0.3, 'triangle', 0.08, 3, 0.02);
  }
  knock() {
    this.tone(90, 0.25, 'square', 0.15, 0.5);
    this.noise(0.2, 0.3, 'lowpass', 1500, 300);
  }
  click() {
    this.tone(1400, 0.04, 'triangle', 0.06);
  }
  buy() {
    [784, 988, 1318].forEach((f, i) => this.tone(f, 0.15, 'square', 0.06, 1, i * 0.06));
  }
  error() {
    this.tone(200, 0.2, 'square', 0.08, 0.8);
  }
  count(n) {
    this.tone(n > 0 ? 660 : 1320, n > 0 ? 0.18 : 0.5, 'triangle', 0.18);
  }
  chat() {
    this.tone(1200, 0.06, 'sine', 0.06);
    this.tone(1600, 0.08, 'sine', 0.05, 1, 0.05);
  }
  crumble() {
    this.noise(0.5, 0.18, 'lowpass', 600, 120);
  }
  thunder() {
    this.noise(2.2, 0.35, 'lowpass', 400, 60);
  }
  slide() {
    this.noise(0.5, 0.15, 'bandpass', 900, 400, 0, 0.8);
  }
  setWind(level) {
    if (!this.ctx) return;
    const l = Math.min(1, level);
    this.windGain.gain.setTargetAtTime(l * 0.22, this.ctx.currentTime, 0.15);
    this.windFilter.frequency.setTargetAtTime(350 + l * 1400, this.ctx.currentTime, 0.2);
  }

  // ---- موسیقی رویه‌ای ----
  setMood(i) {
    this.mood = i;
  }
  startMusic() {
    if (this.musicOn || !this.ctx) return;
    this.musicOn = true;
    this.nextT = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 30);
  }
  schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const bpm = 112;
    const s16 = 60 / bpm / 4;
    // چهار پیشرفت آکورد برای حال‌وهوای مختلف
    const progs = [
      [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
      [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]],
      [[52, 55, 59], [48, 52, 55], [50, 53, 57], [47, 50, 54]],
      [[55, 58, 62], [51, 55, 58], [53, 57, 60], [50, 53, 57]],
    ];
    const prog = progs[this.mood % progs.length];
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    while (this.nextT < ctx.currentTime + 0.12) {
      const st = this.step16 % 64;
      const bar = Math.floor(st / 16);
      const chord = prog[bar];
      const t = this.nextT;
      const beat = st % 16;
      const dest = this.musicBus;
      // کیک
      if (beat % 4 === 0) this.drum('kick', t);
      if (beat === 4 || beat === 12) this.drum('snare', t);
      if (beat % 2 === 1) this.drum('hat', t, beat % 4 === 3 ? 0.05 : 0.03);
      // باس
      if (beat % 4 === 0 || beat === 10 || beat === 14) {
        this.synth(mtof(chord[0] - 12), s16 * 1.8, 'sawtooth', 0.09, t, dest, 380);
      }
      // آرپژ
      if (beat % 2 === 0) {
        const n = chord[(beat / 2) % 3] + (beat % 8 >= 4 ? 12 : 0) + 12;
        this.synth(mtof(n), s16 * 1.5, 'triangle', 0.045, t, dest, 2600);
      }
      // پد
      if (beat === 0) for (const n of chord) this.synth(mtof(n), s16 * 15, 'sawtooth', 0.016, t, dest, 1100, 0.4);
      this.nextT += s16;
      this.step16++;
    }
  }
  synth(freq, dur, type, vol, t, dest, cutoff = 2000, attack = 0.006) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
    o.connect(f).connect(g).connect(dest);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }
  drum(kind, t, vol) {
    const ctx = this.ctx;
    const dest = this.musicBus;
    if (kind === 'kick') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + 0.3);
    } else {
      const s = ctx.createBufferSource();
      s.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = kind === 'hat' ? 'highpass' : 'bandpass';
      f.frequency.value = kind === 'hat' ? 7000 : 1800;
      const g = ctx.createGain();
      const v = vol || (kind === 'snare' ? 0.12 : 0.04);
      const dcy = kind === 'hat' ? 0.04 : 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dcy);
      s.connect(f).connect(g).connect(dest);
      s.start(t, Math.random());
      s.stop(t + dcy + 0.02);
    }
  }
}
