/* ============================ SOUND (Web Audio synth) ============================ */
// music styles: tempo, chord roots (MIDI), melody scale, lead sound and drums (0 none, 1 hats, 2 beat, 3 boss)
const MUSIC = {
  dusk:   { bpm: 104, roots: [57, 53, 48, 55], scale: [0, 3, 5, 7, 10, 12, 15], lead: 'triangle', drums: 0, minor: true },
  bright: { bpm: 118, roots: [60, 65, 67, 60], scale: [0, 2, 4, 7, 9, 12, 14], lead: 'triangle', drums: 1, oct: 0 },
  desert: { bpm: 98, roots: [57, 58, 57, 55], scale: [0, 1, 4, 5, 7, 8, 10, 12], lead: 'sawtooth', drums: 1, minor: true },
  frost:  { bpm: 84, roots: [62, 57, 59, 55], scale: [0, 2, 4, 6, 7, 11, 12, 16], lead: 'sine', drums: 0, padF: 1100 },
  fire:   { bpm: 126, roots: [52, 52, 55, 50], scale: [0, 3, 5, 7, 8, 10, 12], lead: 'sawtooth', drums: 2, minor: true },
  neon:   { bpm: 112, roots: [57, 53, 55, 52], scale: [0, 3, 5, 7, 10, 12, 15, 17], lead: 'square', drums: 2, minor: true, pat: [0, 2, 4, 6, 4, 2, 5, 3] },
  wild:   { bpm: 96, roots: [55, 58, 53, 55], scale: [0, 2, 3, 5, 7, 9, 10, 12], lead: 'triangle', drums: 1, minor: true },
  chase:  { bpm: 132, roots: [57, 55, 53, 52], scale: [0, 3, 5, 7, 10, 12], lead: 'sawtooth', drums: 2, minor: true },
  boss:   { bpm: 146, roots: [52, 53, 52, 50], scale: [0, 2, 3, 5, 7, 8, 11, 12], lead: 'sawtooth', drums: 3, minor: true, pat: [0, 1, 2, 4, 3, 1, 5, 2] },
  rest:   { bpm: 76, roots: [60, 57, 53, 55], scale: [0, 2, 4, 7, 9, 12], lead: 'sine', drums: 0, padF: 900 },
};
const Sound = {
  ctx: null, on: true, MASTER: 1,
  // A short silent WAV played through an <audio> element: on iPhones this moves the page to the "playback" audio
  // session, so the game is heard even with the ring/silent switch on silent (Web Audio alone is muted there).
  silentWav() {
    const n = 2205, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 22050, true); v.setUint32(28, 44100, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return 'data:audio/wav;base64,' + btoa(s);
  },
  iOS: /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  unlockMedia() {
    try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) {}
    if (!this.iOS) return;
    try {
      if (!this.tag) { const a = this.tag = document.createElement('audio'); a.src = this.silentWav(); a.loop = true; a.preload = 'auto'; a.setAttribute('playsinline', ''); a.setAttribute('x-webkit-airplay', 'deny'); a.volume = 0.01; }
      if (this.tag.paused) { const pr = this.tag.play(); if (pr && pr.catch) pr.catch(() => {}); }
    } catch (e) {}
  },
  // called from every user gesture: creates the audio context once, then resumes it whenever the browser paused it
  init() {
    this.unlockMedia();
    if (this.ctx && this.ctx.state === 'closed') { this.ctx = null; this.amb = null; }
    if (this.ctx) {
      if (this.ctx.state !== 'running') { try { const pr = this.ctx.resume(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {} this.kick(); }
      return;
    }
    let c;
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      c = new AC({ latencyHint: 'interactive' });
    } catch (e) { try { c = new (window.AudioContext || window.webkitAudioContext)(); } catch (e2) { return; } }
    this.ctx = c;
    try {
      // sfx + music -> gentle glue compressor -> make-up gain -> limiter -> on/off master -> speakers
      this.master = c.createGain(); this.master.gain.value = this.on ? this.MASTER : 0; this.master.connect(c.destination);
      this.lim = c.createDynamicsCompressor(); this.lim.threshold.value = -3; this.lim.knee.value = 0; this.lim.ratio.value = 20; this.lim.attack.value = 0.001; this.lim.release.value = 0.08; this.lim.connect(this.master);
      this.post = c.createGain(); this.post.gain.value = 2.4; this.post.connect(this.lim);
      this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -18; this.comp.knee.value = 8; this.comp.ratio.value = 3; this.comp.attack.value = 0.003; this.comp.release.value = 0.2; this.comp.connect(this.post);
      this.sfx = c.createGain(); this.sfx.connect(this.comp);
      this.mus = c.createGain(); this.mus.connect(this.comp);
      this.dly = c.createDelay(1); this.dly.delayTime.value = 0.36; this.fb = c.createGain(); this.fb.gain.value = 0.38;
      this.dlyF = c.createBiquadFilter(); this.dlyF.type = 'lowpass'; this.dlyF.frequency.value = 2200;
      this.dly.connect(this.dlyF); this.dlyF.connect(this.fb); this.fb.connect(this.dly); this.dlyF.connect(this.mus);
      const len = c.sampleRate; const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.nbuf = b; this.applyVol(); this.kick(); this.startMusic();
      if (c.state !== 'running') { try { const pr = c.resume(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {} }
      c.onstatechange = () => { if (typeof soundHint === 'function') soundHint(); };
    } catch (e) { try { c.close(); } catch (_) {} this.ctx = null; }
  },
  // a silent one-sample sound started inside the gesture (older iPhones only unlock audio this way)
  kick() { try { const c = this.ctx, s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0); } catch (e) {} },
  running() { return !!this.ctx && this.ctx.state === 'running'; },
  applyVol() {
    if (!this.ctx) return; const k = v => Math.max(0, +v || 0) / 100;
    this.MASTER = k(CFG.vol ?? 100); this.sfx.gain.value = 1.0 * k(CFG.sfxV ?? 90); this.mus.gain.value = 0.62 * k(CFG.musicV ?? 70);
    this.master.gain.setTargetAtTime(this.on ? this.MASTER : 0, this.ctx.currentTime, 0.03);
  },
  visible(v) {
    if (!this.ctx) return;
    try { const pr = v ? this.ctx.resume() : this.ctx.suspend(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {}
    try { if (this.tag) { if (v) { const pr = this.tag.play(); if (pr && pr.catch) pr.catch(() => {}); } else this.tag.pause(); } } catch (e) {}
  },
  setOn(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? this.MASTER : 0, this.ctx.currentTime, 0.05); },
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
      case 'tog': this.tone(660, 990, 0.07, 'square', 0.05); this.tone(990, 660, 0.06, 'triangle', 0.04, 0.04); break;
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
    this.amb.rain.g.gain.setTargetAtTime(rain * .036, t, .6); this.amb.wind.g.gain.setTargetAtTime(wind * .06, t, .9);
    this.amb.wind.fl.frequency.setTargetAtTime(320 + Math.sin(t * .37) * 140, t, .6);
  },
  stomp(k) {
    if (!this.ctx || !this.on) return; const now = this.ctx.currentTime; if (now - (this.lastStomp || 0) < 0.12) return; this.lastStomp = now;
    this.tone(75, 32, 0.4, 'sine', 0.55 * k); this.noise(0.25, 0.32 * k, 220);
  },
  // music style per area (see MUSIC); switched when a level starts, during boss fights and in the 3D chases
  setMusic(name) { const m = MUSIC[name] || MUSIC.dusk; if (this.ms === m) return; this.ms = m; this.msName = name; },
  startMusic() {
    const c = this.ctx; let next = c.currentTime + 0.2, step = 0;
    if (!this.ms) this.ms = MUSIC.dusk;
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    const pad = (root, t, dur, M) => {
      [0, 7, 12, M.minor ? 15 : 16].forEach((iv, k) => {
        const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
        o.type = k % 2 ? 'sawtooth' : 'triangle'; o.frequency.value = mtof(root - 12 + iv); o.detune.value = (k - 1.5) * 6;
        f.type = 'lowpass'; f.frequency.value = M.padF || 700;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + Math.min(1.2, dur * .3)); g.gain.setValueAtTime(0.035, t + dur * .75); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
        o.connect(f); f.connect(g); g.connect(this.mus); o.start(t); o.stop(t + dur + 0.7);
      });
    };
    const pluck = (m, t, v, M) => {
      const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = M.lead || 'triangle'; o.frequency.value = mtof(m); f.type = 'lowpass'; f.frequency.setValueAtTime(M.lead === 'sawtooth' || M.lead === 'square' ? 2200 : 3000, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.3);
      const vv = M.lead === 'sawtooth' || M.lead === 'square' ? v * .55 : v;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vv, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(f); f.connect(g); g.connect(this.mus); g.connect(this.dly); o.start(t); o.stop(t + 0.5);
    };
    const bass = (m, t, beat) => { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = mtof(m - 24);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 1.8);
      o.connect(g); g.connect(this.mus); o.start(t); o.stop(t + beat * 2); };
    // simple drums for the livelier styles
    const kick = t => { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + .12);
      g.gain.setValueAtTime(.32, t); g.gain.exponentialRampToValueAtTime(.0001, t + .2); o.connect(g); g.connect(this.mus); o.start(t); o.stop(t + .22); };
    const hat = (t, v) => { const s = c.createBufferSource(); s.buffer = this.nbuf; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .05); s.connect(f); f.connect(g); g.connect(this.mus); s.start(t, Math.random() * .5); s.stop(t + .07); };
    const snare = t => { const s = c.createBufferSource(); s.buffer = this.nbuf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800;
      const g = c.createGain(); g.gain.setValueAtTime(.18, t); g.gain.exponentialRampToValueAtTime(.0001, t + .14); s.connect(f); f.connect(g); g.connect(this.mus); s.start(t, Math.random() * .5); s.stop(t + .16); };
    const tick = () => {
      // after the tab was hidden/suspended, don't try to "catch up" by scheduling hundreds of notes at once
      if (next < c.currentTime - 0.2) next = c.currentTime + 0.05;
      if (c.state !== 'running' || !this.on || CFG.musicV <= 0) return;
      while (next < c.currentTime + 0.3) {
        const M = this.ms, beat = 60 / M.bpm, roots = M.roots, scale = M.scale;
        const bar = Math.floor(step / 8), root = roots[bar % roots.length], s8 = step % 8;
        if (s8 === 0) { pad(root, next, beat * 4, M); bass(root, next, beat); }
        if (s8 === 4) bass(root + 7, next, beat);
        if (M.drums >= 1 && s8 % 2 === 1) hat(next, .05);
        if (M.drums >= 2) { if (s8 % 4 === 0) kick(next); if (s8 === 4) snare(next); }
        if (M.drums >= 3) { if (s8 % 2 === 0) kick(next); hat(next, .04); }
        const pat = M.pat || [0, -1, 2, 1, 3, -1, 4, 2];
        let idx = pat[(s8 + bar * 3) % pat.length];
        if (idx >= 0 && (Math.random() < 0.82)) { if (Math.random() < 0.2) idx = Math.floor(Math.random() * scale.length); pluck(roots[0] + 12 + scale[idx % scale.length] + (M.oct || 0), next, s8 % 2 ? 0.05 : 0.08, M); }
        next += beat / 2; step++;
      }
    };
    setInterval(tick, 90); tick();
  }
};

