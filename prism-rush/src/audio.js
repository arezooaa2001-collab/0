// Prism Rush - procedural audio engine (Web Audio API only, no asset files).
// Graph: music / sfx (+ gameplay loops) / ambient buses -> master -> compressor -> destination.
// Everything is synthesized from oscillators, shared noise buffers, filters and envelopes.
// Nodes are created per note / per voice and disconnected by a periodic sweep once finished.

/* ------------------------------------------------------------------ utils */
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const num = (x, d) => (typeof x === 'number' && isFinite(x) ? x : d);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const dbg = (...a) => { try { console.debug('[audio]', ...a); } catch (_) { /* ignore */ } };
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function vec3(a) { // accepts [x,y,z], typed arrays or {x,y,z}
  if (!a) return null;
  const x = a.x !== undefined ? a.x : a[0], y = a.y !== undefined ? a.y : a[1], z = a.z !== undefined ? a.z : a[2];
  return isFinite(x) && isFinite(y) && isFinite(z) ? [+x, +y, +z] : null;
}

/* ----------------------------------------------------------- engine state */
let ctx = null, master = null, busMusic = null, busSfx = null, busLoop = null, busAmb = null;
const NZ = {};                                    // shared noise buffers: white / pink / brown
const vol = { master: 0.85, music: 0.7, sfx: 0.9, ambient: 0.7 };
let hq = true, paused = false, timer = 0, lastTick = 0, warned = 0;
const trash = [];                                 // {t, nodes} disconnected once ctx time passes t
let voices = [];                                  // live one-shot SFX voices
const lastPlay = Object.create(null);             // per-name throttle timestamps (ms)
const ringState = { t: -1e9, n: 0, side: 1 };
const lis = { pos: [0, 0, 0], fwd: [0, 0, -1], up: [0, 1, 0] };
const tracks = [];                                // live music track instances (current + fading)
let cur = null, wantTrack = null, inten = 0, intenT = 0;
const beds = Object.create(null);                 // ambience beds by name
const loops = Object.create(null);                // gameplay loops by name
const loopWant = Object.create(null);             // loop requests made before init()

function warnOnce(e) { if (warned++ < 3) { try { console.warn('[audio]', e); } catch (_) { /* ignore */ } } }
const safe = (fn) => function (...a) { try { return fn(...a); } catch (e) { warnOnce(e); return undefined; } };

/* --------------------------------------------------------- node lifecycle */
const bin = (t, nodes) => { trash.push({ t, nodes }); };
function sweep(now) {
  for (let i = trash.length - 1; i >= 0; i--) {
    const e = trash[i];
    if (e.t > now) continue;
    for (const n of e.nodes) { try { n.disconnect(); } catch (_) { /* already gone */ } }
    trash[i] = trash[trash.length - 1]; trash.pop();
  }
}

/* ------------------------------------------------------------ graph setup */
function makeNoise() {
  const sr = ctx.sampleRate, len = Math.floor(sr * 2), F = Math.floor(sr * 0.05);
  const raw = { white: new Float32Array(len + F), pink: new Float32Array(len + F), brown: new Float32Array(len + F) };
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0;
  for (let i = 0; i < len + F; i++) {
    const w = Math.random() * 2 - 1;
    raw.white[i] = w;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    raw.pink[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
    br = (br + 0.02 * w) / 1.02; raw.brown[i] = br;
  }
  for (const k in raw) { // crossfade the tail into the head so the loop seam is click-free, then normalize
    const r = raw[k], buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    let pk = 1e-6;
    for (let i = 0; i < len; i++) {
      d[i] = i < F ? r[i] * (i / F) + r[len + i] * (1 - i / F) : r[i];
      const a = Math.abs(d[i]); if (a > pk) pk = a;
    }
    const s = 0.95 / pk; for (let i = 0; i < len; i++) d[i] *= s;
    NZ[k] = buf;
  }
}
function build() {
  const G = (to) => { const g = ctx.createGain(); g.connect(to); return g; };
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
  comp.connect(ctx.destination);
  master = G(comp); busMusic = G(master); busSfx = G(master); busAmb = G(master); busLoop = G(busSfx);
  master.gain.value = vol.master; busMusic.gain.value = vol.music; busSfx.gain.value = vol.sfx;
  busAmb.gain.value = paused ? 0 : vol.ambient; busLoop.gain.value = paused ? 0 : 1;
  makeNoise();
}
function applyVolumes(tau = 0.08) {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(vol.master, t, tau);
  busMusic.gain.setTargetAtTime(vol.music * (paused ? 0.35 : 1), t, tau);
  busSfx.gain.setTargetAtTime(vol.sfx, t, tau);
  busAmb.gain.setTargetAtTime(paused ? 0 : vol.ambient, t, tau);
  busLoop.gain.setTargetAtTime(paused ? 0 : 1, t, tau * 0.6);
}
function resume() {
  if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return;
  if (typeof document !== 'undefined' && document.hidden) return;
  try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* ignore */ }
}

/* ------------------------------------------------- synthesis primitives */
// Gain envelope. a: attack s, g: peak, d: total length, h: hold fraction of d, sw: linear swell over d.
function env(p, t, a, g, d, h, sw) {
  p.setValueAtTime(0, t);
  if (sw) { p.linearRampToValueAtTime(g, t + d); p.setTargetAtTime(0, t + d, 0.04); return t + d + 0.25; }
  p.linearRampToValueAtTime(g, t + a);
  if (h) p.setValueAtTime(g, t + Math.max(a, d * h));
  p.exponentialRampToValueAtTime(0.0005, t + d);
  p.linearRampToValueAtTime(0, t + d + 0.01);
  return t + d + 0.02;
}
function start(v, s, t, end, off) { s.start(t, off || 0); s.stop(end); v.srcs.push(s); if (end > v.end) v.end = end; }
function mod(v, rate, depth, param, t, end, type) { // LFO into an AudioParam (voice-owned)
  const l = ctx.createOscillator(), lg = ctx.createGain();
  l.type = type || 'sine'; l.frequency.value = rate; lg.gain.value = depth;
  l.connect(lg); lg.connect(param); v.nodes.push(l, lg); start(v, l, t, end);
}
// Oscillator tone. o: {w,f,f2,sl,fs:[[dt,f]],t,d,a,g,h,sw,det,vib:[rate,depthFrac],am:[rate,depth],lp,to}
function tn(v, o) {
  const t = v.t + (o.t || 0), d = o.d || 0.2, p = v.p, f = o.f * p;
  const osc = ctx.createOscillator(), g = ctx.createGain(), fq = osc.frequency;
  osc.type = o.w || 'sine';
  fq.setValueAtTime(f, t);
  if (o.f2) fq.exponentialRampToValueAtTime(Math.max(1, o.f2 * p), t + (o.sl || d));
  if (o.fs) for (const [dt, ff] of o.fs) fq.exponentialRampToValueAtTime(Math.max(1, ff * p), t + dt);
  if (o.det) osc.detune.value = o.det;
  const end = env(g.gain, t, o.a ?? 0.004, o.g ?? 0.3, d, o.h, o.sw);
  osc.connect(g); v.nodes.push(osc, g);
  let node = g;
  if (o.vib) mod(v, o.vib[0], o.vib[1] * f, fq, t, end);
  if (o.am) {
    const tg = ctx.createGain(); tg.gain.value = 1 - o.am[1];
    node.connect(tg); node = tg; v.nodes.push(tg); mod(v, o.am[0], o.am[1], tg.gain, t, end, 'square');
  }
  if (o.lp) { const fl = ctx.createBiquadFilter(); fl.frequency.value = o.lp * p; node.connect(fl); node = fl; v.nodes.push(fl); }
  node.connect(o.to || v.out);
  start(v, osc, t, end);
}
// Filtered noise burst. o: {n:'white'|'pink'|'brown', ft, f, f2, sl, q, t, d, a, g, h, sw, to}
function nz(v, o) {
  const t = v.t + (o.t || 0), d = o.d || 0.2, p = v.p;
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = NZ[o.n || 'white']; s.loop = true;
  fl.type = o.ft || 'bandpass'; fl.Q.value = o.q ?? 1;
  fl.frequency.setValueAtTime(o.f * p, t);
  if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2 * p, t + (o.sl || d));
  const end = env(g.gain, t, o.a ?? 0.003, o.g ?? 0.3, d, o.h, o.sw);
  s.connect(fl); fl.connect(g); g.connect(o.to || v.out);
  v.nodes.push(s, fl, g); start(v, s, t, end, Math.random() * 1.5);
}
// Melody helper: notes [[beat, semitone, lenBeats]] from MIDI root.
function mel(v, notes, root, beat, o) {
  for (const [b, n, l] of notes) tn(v, Object.assign({}, o, { f: mtof(root + n), t: (o.t || 0) + b * beat, d: l * beat }));
}
// Cute formant "chirp" voice: saw source, two moving bandpass formants, pitch contour.
const VOW = { a: [900, 1500], e: [550, 2200], i: [380, 2700], o: [600, 1000], u: [420, 900] };
function vox(v, o) {
  const t = v.t + (o.t || 0), d = o.d, p = v.p, f0 = 360 * p, fm = 1.12 * Math.sqrt(p);
  const osc = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(f0 * o.pts[0][1], t);
  for (let i = 1; i < o.pts.length; i++) osc.frequency.linearRampToValueAtTime(f0 * o.pts[i][1], t + o.pts[i][0]);
  const end = env(g.gain, t, 0.018, 0.7 * (o.g || 1), d, 0.5);
  osc.connect(g); g2.gain.value = 0.6; g2.connect(v.out); v.nodes.push(osc, g, g2);
  const A = VOW[o.v1], B = VOW[o.v2];
  for (let i = 0; i < 2; i++) {
    const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.Q.value = i ? 8 : 4.5;
    b.frequency.setValueAtTime(A[i] * fm, t); b.frequency.linearRampToValueAtTime(B[i] * fm, t + d * 0.7);
    g.connect(b); b.connect(i ? g2 : v.out); v.nodes.push(b);
  }
  if (o.vib) mod(v, o.vib[0], o.vib[1] * f0, osc.frequency, t, end);
  start(v, osc, t, end);
}

/* ------------------------------------------------------- one-shot recipes */
const CLANK = [523, 1397, 2093, 3271];
const SFX = {
  ring(v) {
    tn(v, { w: 'triangle', f: 1760, d: 0.11, g: 0.3 }); tn(v, { f: 3520, d: 0.06, g: 0.05 });
    tn(v, { w: 'triangle', f: 2349, t: 0.055, d: 0.42, g: 0.32 }); tn(v, { f: 4698, t: 0.055, d: 0.22, g: 0.06 });
  },
  ringScatter(v) {
    for (let i = 0; i < 7; i++) tn(v, { w: 'triangle', f: rnd(1300, 2900), t: i * 0.055 + rnd(0, 0.02), d: 0.22, g: 0.13 });
    nz(v, { ft: 'highpass', f: 4000, d: 0.12, g: 0.12 });
  },
  jump(v) { tn(v, { w: 'square', f: 280, f2: 720, d: 0.16, g: 0.1, lp: 3200 }); nz(v, { n: 'pink', f: 800, f2: 2500, q: 0.8, d: 0.15, g: 0.14 }); },
  doubleJump(v) {
    tn(v, { w: 'triangle', f: 500, f2: 1300, d: 0.14, g: 0.22 }); tn(v, { w: 'square', f: 750, f2: 1700, t: 0.05, d: 0.12, g: 0.06, lp: 4000 });
    nz(v, { f: 1500, f2: 4000, d: 0.2, g: 0.12 });
  },
  spinCharge(v) {
    tn(v, { w: 'sawtooth', f: 70, f2: 200, d: 0.3, a: 0.01, g: 0.3, lp: 1500, am: [38, 0.45] });
    nz(v, { f: 700, f2: 2600, q: 2, d: 0.3, g: 0.2 });
  },
  spinRelease(v) {
    nz(v, { n: 'pink', f: 3000, f2: 400, q: 1.2, d: 0.4, g: 0.45 }); tn(v, { w: 'sawtooth', f: 500, f2: 90, d: 0.3, g: 0.15, lp: 2000 });
    tn(v, { f: 160, f2: 45, d: 0.25, g: 0.5 });
  },
  boost(v) {
    nz(v, { n: 'pink', f: 300, f2: 3500, sl: 0.35, q: 0.9, a: 0.04, d: 0.7, g: 0.5 }); tn(v, { f: 130, f2: 38, d: 0.35, g: 0.6 });
    nz(v, { n: 'brown', ft: 'lowpass', f: 600, f2: 150, d: 0.5, g: 0.4 });
  },
  sonicBoom(v) {
    tn(v, { f: 90, f2: 28, d: 1.1, g: 0.75 }); nz(v, { n: 'brown', ft: 'lowpass', f: 900, f2: 60, q: 0.5, d: 1.5, g: 0.7 });
    nz(v, { ft: 'highpass', f: 1800, q: 0.5, d: 0.09, g: 0.55 }); nz(v, { f: 3000, f2: 600, q: 0.6, t: 0.03, d: 0.6, g: 0.25 });
  },
  homing(v) { nz(v, { f: 900, f2: 5500, sl: 0.15, q: 1.5, d: 0.2, g: 0.4 }); tn(v, { w: 'triangle', f: 700, f2: 2000, d: 0.15, g: 0.1 }); },
  dash(v) { nz(v, { n: 'pink', f: 3500, f2: 700, d: 0.28, g: 0.45 }); tn(v, { w: 'triangle', f: 900, f2: 350, d: 0.18, g: 0.12 }); },
  land(v) { tn(v, { f: 150, f2: 50, d: 0.14, g: 0.45 }); nz(v, { n: 'pink', ft: 'lowpass', f: 900, d: 0.09, g: 0.3 }); },
  footstep_grass(v) { nz(v, { ft: 'highpass', f: 2500, q: 0.5, a: 0.008, d: 0.06, g: 0.14 }); nz(v, { f: 5000, t: 0.015, d: 0.04, g: 0.07 }); },
  footstep_sand(v) { nz(v, { f: 1400, q: 0.6, a: 0.012, d: 0.09, g: 0.2 }); nz(v, { ft: 'highpass', f: 6000, d: 0.05, g: 0.05 }); },
  footstep_snow(v) { nz(v, { n: 'pink', f: 900, q: 1.2, a: 0.025, d: 0.13, g: 0.3 }); nz(v, { ft: 'highpass', f: 3500, a: 0.02, d: 0.08, g: 0.07 }); },
  footstep_metal(v) {
    tn(v, { w: 'triangle', f: 1250, d: 0.09, g: 0.1 }); tn(v, { w: 'square', f: 2730, d: 0.05, g: 0.025 });
    nz(v, { ft: 'highpass', f: 3000, d: 0.03, g: 0.14 });
  },
  footstep_rock(v) { nz(v, { f: 700, q: 1.5, d: 0.05, g: 0.3 }); tn(v, { f: 180, f2: 90, d: 0.05, g: 0.2 }); },
  footstep_water(v) { nz(v, { f: 500, f2: 1800, q: 3, d: 0.12, g: 0.5 }); nz(v, { ft: 'highpass', f: 4000, t: 0.02, d: 0.08, g: 0.07 }); },
  splash(v) {
    nz(v, { f: 600, f2: 2800, sl: 0.1, q: 0.8, a: 0.01, d: 0.7, g: 0.45 }); nz(v, { n: 'pink', ft: 'lowpass', f: 700, d: 0.5, g: 0.35 });
    for (let i = 0; i < 4; i++) { const f = rnd(500, 1200); tn(v, { f, f2: f * 2.2, t: 0.1 + i * 0.07 + rnd(0, 0.05), d: 0.06, g: 0.08 }); }
  },
  spring(v) { tn(v, { w: 'triangle', f: 180, f2: 720, sl: 0.12, d: 0.42, g: 0.32, vib: [16, 0.08] }); tn(v, { f: 360, f2: 1440, sl: 0.12, d: 0.25, g: 0.1 }); },
  dashPad(v) {
    tn(v, { w: 'sawtooth', f: 250, f2: 2600, sl: 0.2, d: 0.25, g: 0.14, lp: 5000, am: [45, 0.5] });
    nz(v, { ft: 'highpass', f: 3000, f2: 8000, d: 0.2, g: 0.12 }); tn(v, { w: 'square', f: 1200, f2: 3000, d: 0.12, g: 0.04 });
  },
  bounce(v) { tn(v, { f: 280, f2: 950, sl: 0.1, d: 0.18, g: 0.38 }); tn(v, { w: 'triangle', f: 560, f2: 1900, d: 0.12, g: 0.1 }); },
  hurt(v) {
    tn(v, { w: 'square', f: 700, f2: 160, d: 0.32, g: 0.13, lp: 2500, vib: [28, 0.06] }); nz(v, { f: 1200, q: 0.8, d: 0.15, g: 0.3 });
    tn(v, { f: 200, f2: 70, d: 0.2, g: 0.3 });
  },
  enemyHit(v) {
    CLANK.forEach((f, i) => tn(v, { w: i ? 'square' : 'triangle', f, d: 0.24 - i * 0.04, g: i ? 0.05 : 0.15, lp: 6000 }));
    nz(v, { f: 2500, d: 0.06, g: 0.35 }); tn(v, { f: 220, f2: 90, d: 0.1, g: 0.3 });
  },
  explode(v) {
    nz(v, { n: 'brown', ft: 'lowpass', f: 1500, f2: 90, q: 0.6, d: 1.1, g: 0.8 }); nz(v, { f: 1600, f2: 400, q: 0.7, d: 0.35, g: 0.4 });
    tn(v, { f: 110, f2: 32, d: 0.6, g: 0.6 });
    for (let i = 0; i < 4; i++) nz(v, { ft: 'highpass', f: rnd(2500, 5500), t: rnd(0.08, 0.6), d: 0.04, g: 0.15 });
  },
  laserCharge(v) {
    tn(v, { w: 'sawtooth', f: 180, f2: 1500, d: 1.2, sw: 1, g: 0.13, lp: 3500, vib: [11, 0.04] });
    tn(v, { f: 360, f2: 3000, d: 1.2, sw: 1, g: 0.09 }); nz(v, { ft: 'highpass', f: 2000, f2: 7000, d: 1.2, sw: 1, g: 0.07 });
  },
  laserShot(v) {
    tn(v, { w: 'square', f: 2000, f2: 180, d: 0.26, g: 0.1, lp: 5000 }); tn(v, { w: 'sawtooth', f: 1000, f2: 90, d: 0.3, g: 0.13, lp: 3000 });
    nz(v, { ft: 'highpass', f: 3000, d: 0.05, g: 0.15 });
  },
  shot(v) { tn(v, { w: 'square', f: 1300, f2: 280, d: 0.1, g: 0.1, lp: 4000 }); nz(v, { ft: 'highpass', f: 2500, d: 0.03, g: 0.12 }); },
  missileWarn(v) { for (let i = 0; i < 3; i++) tn(v, { w: 'square', f: 1250, t: i * 0.16, d: 0.08, h: 0.8, g: 0.13, lp: 3500 }); },
  stomp(v) {
    tn(v, { f: 110, f2: 32, d: 0.55, g: 0.85 }); nz(v, { n: 'brown', ft: 'lowpass', f: 900, f2: 120, d: 0.45, g: 0.6 });
    nz(v, { f: 500, q: 0.8, d: 0.1, g: 0.4 });
  },
  bossRoar(v) {
    tn(v, { w: 'sawtooth', f: 68, fs: [[0.5, 92], [1.4, 55]], a: 0.12, h: 0.6, d: 1.5, g: 0.3, lp: 1100, vib: [7, 0.05] });
    tn(v, { w: 'square', f: 103, fs: [[0.5, 137], [1.4, 82]], a: 0.15, h: 0.6, d: 1.5, g: 0.1, lp: 800, am: [23, 0.4] });
    nz(v, { n: 'pink', f: 500, f2: 900, q: 2, a: 0.1, h: 0.6, d: 1.5, g: 0.35 });
  },
  bossHit(v) {
    const p = v.p; v.p *= 0.7; SFX.enemyHit(v); v.p = p;
    tn(v, { f: 140, f2: 40, d: 0.4, g: 0.6 }); nz(v, { n: 'brown', ft: 'lowpass', f: 700, d: 0.3, g: 0.4 });
  },
  checkpoint(v) {
    [72, 76, 79, 84, 88].forEach((m, i) => { tn(v, { w: 'triangle', f: mtof(m + 12), t: i * 0.07, d: 0.6, g: 0.14 }); tn(v, { f: mtof(m + 24), t: i * 0.07, d: 0.3, g: 0.04 }); });
  },
  itemPickup(v) {
    tn(v, { w: 'square', f: 988, d: 0.07, h: 0.7, g: 0.07, lp: 5000 }); tn(v, { w: 'square', f: 1319, t: 0.07, d: 0.2, g: 0.07, lp: 5000 });
    tn(v, { w: 'triangle', f: 2637, t: 0.07, d: 0.2, g: 0.08 });
  },
  shield(v) {
    tn(v, { w: 'triangle', f: 300, f2: 1200, a: 0.03, d: 0.6, g: 0.22, vib: [9, 0.03] }); nz(v, { f: 2000, f2: 6000, q: 4, a: 0.05, d: 0.6, g: 0.14 });
    tn(v, { f: 600, f2: 2400, d: 0.5, g: 0.06 });
  },
  powerup(v) {
    [0, 4, 7, 12, 16, 19].forEach((n, i) => tn(v, { w: 'square', f: mtof(67 + n), t: i * 0.045, d: 0.12, g: 0.1, lp: 4500 }));
    tn(v, { w: 'triangle', f: mtof(91), t: 0.27, d: 0.5, g: 0.1, vib: [7, 0.01] });
  },
  levelUp(v) {
    [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((n, i) => tn(v, { w: 'triangle', f: mtof(72 + n), t: i * 0.06, d: 0.16, g: 0.13 }));
    [72, 76, 79, 84].forEach((m) => tn(v, { w: 'square', f: mtof(m), t: 0.56, d: 0.7, h: 0.3, g: 0.035, lp: 3000 }));
  },
  achievement(v) {
    const N = [[0, 0, 0.6], [0.6, 4, 0.6], [1.2, 7, 0.6], [1.8, 12, 1.2], [3, 11, 0.6], [3.6, 12, 2.6]];
    mel(v, N, 74, 0.1, { w: 'square', g: 0.06, h: 0.6, lp: 4200 }); mel(v, N, 86, 0.1, { w: 'triangle', g: 0.06 });
    tn(v, { w: 'triangle', f: mtof(62), t: 0.36, d: 0.6, g: 0.12 });
  },
  missionStart(v) {
    mel(v, [[0, 0, 1], [1, 5, 1], [2, 7, 3]], 67, 0.11, { w: 'sawtooth', g: 0.1, h: 0.6, lp: 2500 });
    mel(v, [[0, 0, 1], [1, 5, 1], [2, 7, 3]], 79, 0.11, { w: 'triangle', g: 0.08, h: 0.5 });
    nz(v, { f: 500, f2: 6000, q: 1.5, d: 0.5, sw: 1, g: 0.08 });
  },
  missionComplete(v) {
    const N = [[0, 0, 1], [1, 4, 1], [2, 7, 1], [3, 12, 2.4], [5.5, 11, 0.5], [6, 12, 6]];
    mel(v, N, 74, 0.14, { w: 'sawtooth', g: 0.09, h: 0.65, lp: 2800 }); mel(v, N, 74, 0.14, { w: 'square', g: 0.04, h: 0.65, lp: 2000, det: 8 });
    [62, 66, 69].forEach((m) => tn(v, { w: 'sawtooth', f: mtof(m), t: 0.84, d: 1.0, a: 0.05, h: 0.5, g: 0.045, lp: 1800 }));
    tn(v, { f: 110, f2: 45, t: 0.84, d: 0.3, g: 0.5 }); nz(v, { ft: 'highpass', f: 5000, t: 0.84, d: 1.2, g: 0.08 });
  },
  missionFail(v) {
    mel(v, [[0, 7, 1], [1, 6, 1], [2, 5, 1], [3, 4, 4]], 60, 0.22, { w: 'triangle', g: 0.2, h: 0.6 });
    mel(v, [[0, 7, 1], [1, 6, 1], [2, 5, 1], [3, 4, 4]], 48, 0.22, { w: 'square', g: 0.04, h: 0.6, lp: 1200 });
  },
  countdown(v) { tn(v, { w: 'square', f: 880, d: 0.16, h: 0.7, g: 0.08, lp: 4000 }); tn(v, { f: 880, d: 0.18, g: 0.14 }); },
  countdownGo(v) {
    tn(v, { w: 'square', f: 1760, d: 0.5, h: 0.5, g: 0.07, lp: 5000 }); tn(v, { f: 1760, d: 0.5, h: 0.5, g: 0.1 });
    tn(v, { f: 880, d: 0.5, h: 0.5, g: 0.07 });
  },
  uiClick(v) { tn(v, { w: 'triangle', f: 1800, f2: 1200, d: 0.035, g: 0.14 }); nz(v, { ft: 'highpass', f: 5000, d: 0.012, g: 0.06 }); },
  uiHover(v) { tn(v, { f: 2600, d: 0.03, g: 0.035 }); },
  uiBack(v) { tn(v, { w: 'triangle', f: 900, f2: 480, d: 0.08, g: 0.15 }); },
  thunder(v) {
    nz(v, { ft: 'highpass', f: 1200, q: 0.5, d: 0.3, g: 0.35 }); nz(v, { n: 'brown', ft: 'lowpass', f: 1200, f2: 300, q: 0.5, d: 0.8, g: 0.6 });
    for (let i = 0; i < 4; i++) nz(v, { n: 'brown', ft: 'lowpass', f: 500 - i * 80, f2: 110, q: 0.7, t: 0.15 + i * 0.45 + rnd(0, 0.3), a: 0.15, d: rnd(1.6, 2.6), g: 0.6 - i * 0.08 });
  },
  teleport(v) {
    tn(v, { f: 250, f2: 3200, sl: 0.5, d: 0.6, g: 0.18, vib: [32, 0.08] }); tn(v, { w: 'triangle', f: 500, f2: 4800, t: 0.05, d: 0.5, g: 0.08 });
    nz(v, { f: 800, f2: 9000, sl: 0.5, q: 3, d: 0.6, g: 0.14 });
  },
  cannon(v) {
    tn(v, { f: 130, f2: 30, d: 0.7, g: 0.8 }); nz(v, { n: 'brown', ft: 'lowpass', f: 1800, f2: 150, d: 0.6, g: 0.7 });
    nz(v, { ft: 'highpass', f: 1500, d: 0.06, g: 0.4 });
  },
  switch(v) {
    tn(v, { w: 'square', f: 1400, d: 0.025, g: 0.07, lp: 5000 }); tn(v, { w: 'square', f: 900, t: 0.06, d: 0.04, g: 0.07, lp: 4000 });
    nz(v, { ft: 'highpass', f: 4000, d: 0.015, g: 0.1 });
  },
  doorOpen(v) {
    tn(v, { w: 'sawtooth', f: 55, f2: 85, a: 0.08, h: 0.7, d: 0.9, g: 0.18, lp: 450 }); nz(v, { n: 'pink', f: 300, f2: 500, q: 1.5, a: 0.1, h: 0.6, d: 0.9, g: 0.3 });
    tn(v, { f: 110, f2: 50, t: 0.85, d: 0.2, g: 0.4 }); nz(v, { f: 800, t: 0.85, d: 0.08, g: 0.25 });
  },
  break(v) {
    nz(v, { f: 2800, q: 0.8, d: 0.3, g: 0.4 }); nz(v, { n: 'brown', ft: 'lowpass', f: 600, d: 0.25, g: 0.45 });
    for (let i = 0; i < 5; i++) tn(v, { w: 'triangle', f: rnd(1800, 4800), t: rnd(0.02, 0.28), d: 0.05, g: 0.06 });
  },
  shardGet(v) {
    [0, 2, 4, 7, 9, 12, 14, 16, 19].forEach((n, i) => tn(v, { w: i & 1 ? 'sine' : 'triangle', f: mtof(84 + n), t: i * 0.04, d: 0.5, g: 0.08 }));
    tn(v, { f: mtof(96), t: 0.3, d: 1.0, g: 0.06, vib: [6, 0.01] }); nz(v, { f: 6000, q: 5, a: 0.1, d: 0.9, g: 0.07 });
  },
  transform(v) {
    [0, 7, 12].forEach((n, i) => tn(v, { w: 'sawtooth', f: mtof(48 + n), f2: mtof(60 + n), d: 1.5, sw: 1, g: 0.07, lp: 2500, det: i * 7 }));
    nz(v, { n: 'pink', f: 400, f2: 7000, q: 2, d: 1.5, sw: 1, g: 0.2 });
    tn(v, { w: 'triangle', f: mtof(84), t: 1.45, d: 0.9, g: 0.15 }); tn(v, { f: mtof(91), t: 1.5, d: 0.9, g: 0.08 });
  },
  slowmoIn(v) { tn(v, { f: 700, f2: 70, sl: 0.6, d: 0.7, g: 0.25 }); nz(v, { n: 'pink', f: 2500, f2: 200, d: 0.7, g: 0.3 }); },
  slowmoOut(v) { tn(v, { f: 70, f2: 700, d: 0.45, g: 0.2 }); nz(v, { n: 'pink', f: 200, f2: 3000, d: 0.45, g: 0.3 }); },
  railLand(v) {
    tn(v, { w: 'triangle', f: 1180, d: 0.25, g: 0.12 }); tn(v, { w: 'triangle', f: 1847, d: 0.18, g: 0.07 });
    nz(v, { f: 4200, q: 6, d: 0.2, g: 0.3 }); tn(v, { f: 160, f2: 60, d: 0.1, g: 0.3 });
  },
  wallrun(v) {
    nz(v, { n: 'pink', f: 1200, f2: 2200, a: 0.03, d: 0.3, g: 0.5 });
    for (let i = 0; i < 3; i++) nz(v, { f: 900, q: 1.5, t: i * 0.08, d: 0.04, g: 0.3 });
  },
  critterFree(v) {
    for (let i = 0; i < 4; i++) { const f = rnd(1700, 2600); tn(v, { f, f2: f * 1.6, sl: 0.05, t: i * 0.09, d: 0.07, g: 0.13 }); }
    tn(v, { w: 'triangle', f: mtof(84), t: 0.38, d: 0.3, g: 0.08 }); tn(v, { w: 'triangle', f: mtof(88), t: 0.45, d: 0.3, g: 0.07 });
  },
  voiceHappy(v) { vox(v, { pts: [[0, 1], [0.08, 1.35], [0.22, 1.15]], v1: 'e', v2: 'a', d: 0.26 }); },
  voiceHurt(v) { vox(v, { pts: [[0, 1.45], [0.2, 0.8]], v1: 'a', v2: 'o', d: 0.24 }); },
  voiceEffort(v) { vox(v, { pts: [[0, 0.95], [0.1, 1.12]], v1: 'u', v2: 'a', d: 0.13, g: 0.9 }); },
  voiceWin(v) {
    vox(v, { pts: [[0, 1.1], [0.1, 1.2]], v1: 'i', v2: 'a', d: 0.14 });
    vox(v, { t: 0.16, pts: [[0, 1.2], [0.12, 1.55], [0.35, 1.4]], v1: 'o', v2: 'u', d: 0.42 });
  },
  voiceSad(v) { vox(v, { pts: [[0, 1.1], [0.15, 1.15], [0.5, 0.75]], v1: 'a', v2: 'o', d: 0.55, vib: [6, 0.03] }); },
};

/* ---------------------------------------------------------- SFX voices */
function killVoice(v, t) {
  try { v.out.gain.cancelScheduledValues(t); v.out.gain.setTargetAtTime(0, t, 0.012); } catch (_) { /* ignore */ }
  for (const s of v.srcs) { try { s.stop(t + 0.08); } catch (_) { /* already stopped */ } }
  v.end = t; // count as finished; its trash entry still disconnects the nodes later
}
function setPos(pn, p) {
  if (pn.positionX) { pn.positionX.value = p[0]; pn.positionY.value = p[1]; pn.positionZ.value = p[2]; } else pn.setPosition(p[0], p[1], p[2]);
}
function play(name, opts) {
  if (!ctx || !audio.ready) return;
  const fn = SFX[name];
  if (!fn) { dbg('unknown sfx', name); return; }
  if (ctx.state !== 'running') return;
  const ms = nowMs();
  if (ms - (lastPlay[name] || -1e9) < 25) return; // burst throttle
  lastPlay[name] = ms;
  const o = opts || {}, now = ctx.currentTime, pos = vec3(o.pos);
  if (pos) { // distance cull: inaudible beyond maxDistance
    const dx = pos[0] - lis.pos[0], dy = pos[1] - lis.pos[1], dz = pos[2] - lis.pos[2];
    if (dx * dx + dy * dy + dz * dz > 300 * 300) return;
  }
  voices = voices.filter((x) => x.end > now);
  const cap = hq ? 24 : 12;
  while (voices.length >= cap) killVoice(voices.shift(), now);
  const v = { t: now, p: clamp(num(o.pitch, 1), 0.25, 4), nodes: [], srcs: [], end: now, out: ctx.createGain() };
  v.out.gain.value = clamp(num(o.vol, 1), 0, 2);
  let pan = typeof o.pan === 'number' && isFinite(o.pan) ? clamp(o.pan, -1, 1) : null;
  if (name === 'ring') { // fast combos rise a little in pitch and alternate L/R
    ringState.n = ms - ringState.t < 450 ? Math.min(ringState.n + 1, 12) : 0; ringState.t = ms;
    v.p *= 1 + ringState.n * 0.015;
    if (!pos && pan === null) { ringState.side = -ringState.side; pan = 0.22 * ringState.side; }
  } else if (name.startsWith('footstep')) v.p *= rnd(0.9, 1.1);
  v.nodes.push(v.out);
  if (pos) {
    const pn = ctx.createPanner();
    pn.panningModel = hq ? 'HRTF' : 'equalpower'; pn.distanceModel = 'inverse';
    pn.refDistance = 6; pn.rolloffFactor = 1.2; pn.maxDistance = 300;
    setPos(pn, pos); v.out.connect(pn); pn.connect(busSfx); v.nodes.push(pn);
  } else if (pan !== null && ctx.createStereoPanner) {
    const sp = ctx.createStereoPanner(); sp.pan.value = pan; v.out.connect(sp); sp.connect(busSfx); v.nodes.push(sp);
  } else v.out.connect(busSfx);
  try { fn(v, o); } catch (e) { warnOnce(e); }
  bin(v.end + 0.1, v.nodes);
  voices.push(v);
}
function applyListener() {
  const L = ctx.listener, [px, py, pz] = lis.pos, [fx, fy, fz] = lis.fwd, [ux, uy, uz] = lis.up;
  if (L.positionX) {
    L.positionX.value = px; L.positionY.value = py; L.positionZ.value = pz;
    L.forwardX.value = fx; L.forwardY.value = fy; L.forwardZ.value = fz;
    L.upX.value = ux; L.upY.value = uy; L.upZ.value = uz;
  } else {
    if (L.setPosition) L.setPosition(px, py, pz);
    if (L.setOrientation) L.setOrientation(fx, fy, fz, ux, uy, uz);
  }
}

/* ---------------------------------------------------------------- music */
const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  mixo: [0, 2, 4, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11], phrygd: [0, 1, 4, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11],
};
// 16-step drum lines: [kick, snare (x snare, c clap, g ghost), hats (x closed, o open)]
const DRUMS = {
  four: ['x...x...x...x...', '....x.......x...', '..x...x...x...x.'],
  rock: ['x.....x.x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.'],
  break: ['x.....x...x..x..', '....c.......c..g', 'x.xxx.x.x.xxx.x.'],
  shuffle: ['x.....x...x.....', '....x.......x...', 'x.xxx.xxx.xxx.xo'],
  half: ['x.........x.....', '........x.......', 'x.x.x.x.x.x.x.x.'],
  gallop: ['x..x..x.x..x..x.', '....x.......x...', 'x...x...x...x...'],
  march: ['x...x...x...x...', '....x..g....x.xg', 'x.x.x.x.x.x.x.x.'],
  dnb: ['x.........x.....', '....x.......x...', 'x.xxx.xxx.xxx.xx'],
  boss: ['x.x...x.x.x...xx', '....x.......x...', 'x.x.o.x.x.x.o.x.'],
  soft: ['x.......x.......', '................', '....x.......x...'],
};
const FILL = '....x.......xgxx';
// Bass figures per bar: [step, len, tone] tone: 0 root, 1 third, 2 fifth, 3 octave
const BASS = {
  bounce: [[0, 3, 0], [3, 1, 0], [6, 2, 2], [8, 3, 0], [11, 1, 3], [14, 2, 2]],
  drive: [[0, 2, 0], [2, 2, 0], [4, 2, 0], [6, 2, 0], [8, 2, 0], [10, 2, 0], [12, 2, 2], [14, 2, 3]],
  drive16: Array.from({ length: 16 }, (_, s) => [s, 1, s % 4 === 2 ? 3 : 0]),
  pump: [[0, 2, 0], [2, 2, 3], [4, 2, 0], [6, 2, 3], [8, 2, 0], [10, 2, 3], [12, 2, 0], [14, 2, 3]],
  walk: [[0, 4, 0], [4, 4, 1], [8, 4, 2], [12, 4, 3]],
  sync: [[0, 3, 0], [3, 3, 0], [6, 4, 2], [10, 2, 0], [12, 2, 3], [14, 2, 2]],
  gallop: [[0, 1, 0], [1, 1, 0], [2, 2, 0], [4, 1, 2], [5, 1, 2], [6, 2, 2], [8, 1, 0], [9, 1, 0], [10, 2, 0], [12, 1, 3], [13, 1, 3], [14, 2, 2]],
  sustain: [[0, 12, 0], [12, 4, 2]],
};
const WG = { sine: 0.19, triangle: 0.19, square: 0.075, sawtooth: 0.085 }; // lead/pad loudness per waveform
const BG = { sine: 0.26, triangle: 0.24, square: 0.11, sawtooth: 0.14 };  // bass loudness per waveform
const MUSIC_LVL = 0.75;
// key: MIDI centre of pads/lead, lo: lead octave shift, prog: scale-degree chord per bar, bars: loop length.
const TRACKS = {
  menu: { bpm: 112, key: 65, mode: 'major', prog: [0, 5, 3, 4, 0, 5, 1, 4], bars: 8, drum: 'four', bass: 'bounce', lw: 'square', pw: 'triangle', bw: 'triangle', dens: 0.5, run: 0.1, arp: 'up' },
  meadow: { bpm: 142, key: 67, mode: 'major', prog: [0, 4, 5, 3, 0, 4, 3, 4], drum: 'rock', bass: 'bounce', lw: 'square', pw: 'sawtooth', dens: 0.65, run: 0.2, arp: 'up' },
  forest: { bpm: 126, key: 62, mode: 'dorian', prog: [0, 3, 6, 3, 0, 3, 4, 6], drum: 'shuffle', bass: 'walk', lw: 'triangle', pw: 'triangle', bw: 'triangle', swing: 0.16, dens: 0.6, run: 0.15, arp: 'updown' },
  desert: { bpm: 132, key: 64, mode: 'phrygd', prog: [0, 1, 0, 6, 0, 5, 1, 0], drum: 'break', bass: 'sync', lw: 'sawtooth', pw: 'triangle', dens: 0.6, run: 0.35, lcut: 2600 },
  snow: { bpm: 120, key: 62, lo: 1, mode: 'lydian', prog: [0, 1, 5, 4, 0, 1, 3, 4], drum: 'four', bass: 'bounce', lw: 'sine', pw: 'sawtooth', bw: 'triangle', dens: 0.5, run: 0.1, arp: 'up16', pcut: 2400 },
  volcano: { bpm: 152, key: 61, mode: 'harm', prog: [0, 5, 3, 4, 0, 3, 5, 4], drum: 'rock', bass: 'drive', lw: 'sawtooth', pw: 'sawtooth', dens: 0.7, run: 0.35 },
  coast: { bpm: 124, key: 70, mode: 'mixo', prog: [0, 6, 3, 0, 0, 6, 3, 4], drum: 'shuffle', bass: 'walk', lw: 'triangle', pw: 'triangle', bw: 'triangle', swing: 0.14, dens: 0.6, run: 0.2, arp: 'up' },
  city: { bpm: 118, key: 66, mode: 'minor', prog: [0, 5, 2, 6, 0, 5, 2, 4], drum: 'four', bass: 'pump', lw: 'sawtooth', pw: 'sawtooth', dens: 0.55, run: 0.15, arp: 'up16' },
  ruins: { bpm: 116, key: 62, mode: 'harm', prog: [0, 0, 5, 4, 0, 3, 5, 4], drum: 'half', bass: 'sync', lw: 'triangle', pw: 'triangle', dens: 0.5, run: 0.2, arp: 'updown' },
  canyon: { bpm: 138, key: 64, mode: 'mixo', prog: [0, 6, 3, 0, 0, 6, 4, 4], drum: 'gallop', bass: 'gallop', lw: 'square', pw: 'triangle', dens: 0.6, run: 0.2 },
  sky: { bpm: 134, key: 63, lo: 1, mode: 'major', prog: [0, 3, 4, 5, 0, 3, 1, 4], drum: 'four', bass: 'bounce', lw: 'triangle', pw: 'sawtooth', dens: 0.6, run: 0.2, arp: 'updown', pcut: 2600 },
  fortress: { bpm: 144, key: 60, lo: 1, mode: 'minor', prog: [0, 0, 5, 6, 0, 0, 3, 4], drum: 'march', bass: 'drive', lw: 'square', pw: 'sawtooth', dens: 0.65, run: 0.3 },
  moon: { bpm: 108, key: 59, lo: 1, mode: 'dorian', prog: [0, 3, 0, 3, 5, 6, 0, 0], drum: 'soft', bass: 'sustain', lw: 'sine', pw: 'sawtooth', bw: 'triangle', dens: 0.4, run: 0.1, arp: 'up', pcut: 1400 },
  race: { bpm: 164, key: 69, mode: 'dorian', prog: [0, 6, 5, 6, 0, 6, 5, 4], drum: 'dnb', bass: 'drive16', lw: 'sawtooth', pw: 'sawtooth', dens: 0.7, run: 0.4 },
  boss: { bpm: 156, key: 62, mode: 'harm', prog: [0, 0, 5, 5, 3, 3, 4, 4], drum: 'boss', bass: 'drive16', lw: 'square', pw: 'sawtooth', dens: 0.65, run: 0.45 },
  final: { bpm: 148, key: 60, mode: 'minor', prog: [0, 5, 2, 6, 0, 5, 3, 4], drum: 'rock', bass: 'drive', lw: 'sawtooth', pw: 'sawtooth', dens: 0.7, run: 0.3, arp: 'up16' },
  special: { bpm: 96, key: 60, lo: 1, mode: 'lydian', prog: [0, 1, 0, 1, 5, 4, 1, 4], bars: 8, drum: 'soft', bass: 'sustain', lw: 'sine', pw: 'triangle', bw: 'sine', dens: 0.4, run: 0.1, arp: 'updown', pcut: 3000 },
  victory: { bpm: 140, key: 60, once: true },
};

// Seeded composer: chords, bass and a phrase-structured lead (A A' B C, second half varies).
function compose(id, d) {
  const R = rng(hash('prism:' + id)), M = MODES[d.mode], bars = d.bars || 16, K = d.key;
  const pick = (a) => a[Math.floor(R() * a.length)];
  const sem = (deg) => { const o = Math.floor(deg / 7); return M[deg - o * 7] + 12 * o; };
  const prog = Array.from({ length: bars }, (_, i) => d.prog[i % d.prog.length]);
  const pad = prog.map((c) => [0, 2, 4].map((i) => {
    let m = K - 12 + sem(c + i); while (m < K - 8) m += 12; while (m > K + 4) m -= 12; return m;
  }).sort((a, b) => a - b));
  const padLo = pad.map((ch, i) => ch.filter((m) => (m - K - sem(prog[i])) % 12 !== 0).slice(0, 2));
  const B0 = 36 + (K % 12), rootOf = (c) => { const r = B0 + sem(c); return r > 47 ? r - 12 : r; };
  const bass = prog.map((c, bi) => {
    const arr = new Array(16).fill(0), r = rootOf(c), iv = [0, sem(c + 2) - sem(c), sem(c + 4) - sem(c), 12];
    for (const [s, len, k] of BASS[d.bass]) arr[s] = [len, r + iv[k]];
    if (bi % 4 === 3 && d.bass !== 'sustain' && d.bass !== 'drive16') arr[14] = [2, rootOf(prog[(bi + 1) % bars]) - 1];
    return arr;
  });
  const rhythm = () => {
    const ons = [];
    for (let s = 0; s < 16; s += 2) {
      const pr = s % 8 === 0 ? 0.9 : s % 4 === 0 ? d.dens + 0.1 : d.dens - 0.1;
      if (R() < pr) { if (s < 14 && R() < d.run) ons.push(s, s + 1); else ons.push(s); }
    }
    if (!ons.length) ons.push(0);
    return ons.map((s, i) => [s, Math.min((i + 1 < ons.length ? ons[i + 1] : 16) - s, 6)]);
  };
  const near = (x, c) => { // nearest chord tone (scale degrees) to x
    let best = c, bd = 99;
    for (let o = -14; o <= 14; o += 7) for (const i of [0, 2, 4]) { const n = c + i + o, dd = Math.abs(n - x); if (dd < bd) { bd = dd; best = n; } }
    return best;
  };
  let prev = 4;
  const fill = (rh, c) => rh.map(([s, len]) => {
    let n = s % 4 === 0 ? near(prev + Math.round((R() - 0.5) * 5), c) : prev + pick([-2, -1, -1, 1, 1, 2, 0, -3, 3]);
    if (n > 10) n -= 3; if (n < -2) n += 3;
    prev = n; return [s, len, n];
  });
  const cad = (c, tonic) => {
    const a = near(prev - 1, c), b = a + pick([-1, 1, 2]);
    const e = tonic ? (Math.abs(b - 7) < Math.abs(b) ? 7 : 0) : near(b, c);
    prev = e; return [[0, 3, a], [3, 3, b], [6, 10, e]];
  };
  const rA = [rhythm(), rhythm()], rB = [rhythm(), rhythm()], rC = rhythm();
  const A = [fill(rA[0], prog[0]), fill(rA[1], prog[1])];
  const k = (((prog[2] - prog[0]) % 7) + 10) % 7 - 3; // sequence A up/down by the chord movement
  const A2 = A.map((b) => b.map(([s, l, n]) => [s, l, n + k]));
  prev = A2[1][A2[1].length - 1][2];
  const mel = [...A, ...A2, fill(rB[0], prog[4]), fill(rB[1], prog[5]), fill(rC, prog[6]), cad(prog[7], bars === 8)];
  if (bars === 16) mel.push(...A, ...A2, fill(rB[0], prog[12]), fill(rhythm(), prog[13]), fill(rhythm(), prog[14]), cad(prog[15], true));
  const base = K + 12 * (d.lo || 0);
  const lead = mel.map((bar) => { const arr = new Array(16).fill(0); for (const [s, l, n] of bar) arr[s] = [l, base + sem(n)]; return arr; });
  return { bars, pad, padLo, bass, lead };
}

// Music instruments (nodes binned for the sweep).
function note(dest, type, f, t, dur, g, a, sus, dec, rel, det) {
  const o = ctx.createOscillator(), e = ctx.createGain(), off = t + Math.max(dur, a + 0.01);
  o.type = type; o.frequency.value = f; if (det) o.detune.value = det;
  e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + a);
  if (sus < 1) e.gain.setTargetAtTime(g * sus, t + a, dec);
  e.gain.setTargetAtTime(0, off, rel);
  const end = off + rel * 5;
  o.connect(e); e.connect(dest); o.start(t); o.stop(end); bin(end + 0.05, [o, e]);
}
function hit(dest, t, ft, f, q, g, dec, buf) { // filtered noise hit
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), e = ctx.createGain();
  s.buffer = NZ[buf || 'white']; s.loop = true; fl.type = ft; fl.frequency.value = f; fl.Q.value = q;
  e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + 0.002); e.gain.exponentialRampToValueAtTime(0.001, t + dec);
  s.connect(fl); fl.connect(e); e.connect(dest); s.start(t, Math.random() * 1.8); s.stop(t + dec + 0.02);
  bin(t + dec + 0.1, [s, fl, e]);
}
function thump(dest, t, f0, f1, g, dec) { // pitch-dropping sine (kick / tom)
  const o = ctx.createOscillator(), e = ctx.createGain();
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dec * 0.3);
  e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + 0.003); e.gain.exponentialRampToValueAtTime(0.001, t + dec);
  o.connect(e); e.connect(dest); o.start(t); o.stop(t + dec + 0.02); bin(t + dec + 0.1, [o, e]);
}
const kick = (dest, t, g) => thump(dest, t, 150, 44, 0.75 * g, 0.32);
function snare(dest, t, g) { hit(dest, t, 'highpass', 1300, 0.6, 0.3 * g, 0.16); if (hq) thump(dest, t, 210, 160, 0.2 * g, 0.09); }
function clap(dest, t) { hit(dest, t, 'bandpass', 1250, 1.1, 0.22, 0.03); hit(dest, t + 0.012, 'bandpass', 1250, 1.1, 0.24, 0.14); }

class Track {
  constructor(id) {
    const d = (this.d = TRACKS[id]); this.id = id; this.nodes = []; this.lv = {};
    const G = (v, to) => { const g = ctx.createGain(); g.gain.value = v; g.connect(to); this.nodes.push(g); return g; };
    const F = (f, to) => { const x = ctx.createBiquadFilter(); x.frequency.value = f; x.Q.value = 0.7; x.connect(to); this.nodes.push(x); return x; };
    this.out = G(0, busMusic);
    this.drum = G(0.85, this.out); this.perc = G(0, this.drum);
    this.bass = F(d.bcut || 800, G(1, this.out));
    this.padF = F(d.pcut || 1800, G(1, this.out));
    this.leadF = F(d.lcut || 4200, G(1, this.out));
    this.dbl = G(0, this.leadF); this.arp = G(0, this.out);
    this.sd = 60 / d.bpm / 4; this.step = 0; this.t = ctx.currentTime + 0.08;
    if (d.once) { this.fanfare(this.t); return; }
    this.song = compose(id, d);
    if (hq) { // dotted-eighth echo on the lead (high quality only)
      const dl = ctx.createDelay(1); dl.delayTime.value = this.sd * 3; this.nodes.push(dl);
      const fb = G(0.3, dl), wet = G(0.6, this.out);
      this.send = G(0.2, dl); dl.connect(fb); dl.connect(wet); this.leadF.connect(this.send);
    }
  }
  lay(k, param, v) { // smooth layer/param update, only when changed
    const o = this.lv[k];
    if (o === undefined || Math.abs(o - v) > 0.01 * Math.max(1, Math.abs(v))) { this.lv[k] = v; param.setTargetAtTime(v, ctx.currentTime, 0.2); }
  }
  update(now) {
    const d = this.d, I = inten;
    this.lay('perc', this.perc.gain, smooth(0.3, 0.65, I) * 0.9);
    this.lay('dbl', this.dbl.gain, hq ? smooth(0.6, 0.9, I) * 0.55 : 0);
    this.lay('arp', this.arp.gain, hq && d.arp ? 0.45 + 0.55 * I : 0);
    this.lay('pf', this.padF.frequency, (d.pcut || 1800) * (0.75 + 0.75 * I));
    this.lay('dr', this.drum.gain, 0.78 + 0.22 * I);
    if (this.send) this.lay('snd', this.send.gain, hq ? 0.2 : 0);
    if (d.once || (this.dieAt && now > this.dieAt - 0.3)) return;
    if (this.t < now - 0.1) { const n = Math.ceil((now - this.t) / this.sd); this.step += n; this.t += n * this.sd; } // resync after a stall
    const until = now + (hq ? 0.12 : 0.16);
    while (this.t < until) { this.play(this.step, this.t); this.step++; this.t += this.sd; }
  }
  play(step, t0) {
    const d = this.d, S = this.song, s = step % 16, abs = Math.floor(step / 16), bar = abs % S.bars, pass = Math.floor(abs / S.bars);
    const t = t0 + (s & 1 ? (d.swing || 0) * this.sd : 0), end4 = bar % 4 === 3, P = DRUMS[d.drum], sd = this.sd;
    // drums
    const k = P[0][s], sn = end4 && d.drum !== 'soft' ? FILL[s] : P[1][s], h = P[2][s];
    if (k === 'x') kick(this.drum, t, 1);
    if (sn === 'x') snare(this.drum, t, 1); else if (sn === 'g') snare(this.drum, t, 0.35); else if (sn === 'c') clap(this.drum, t);
    if (h === 'x') hit(this.drum, t, 'highpass', 7500, 0.7, 0.07, 0.045); else if (h === 'o') hit(this.drum, t, 'highpass', 7000, 0.7, 0.065, 0.22);
    if ((this.lv.perc || 0) > 0.02) { // intensity percussion layer
      if (h === '.') hit(this.perc, t, 'highpass', 8000, 0.7, s & 1 ? 0.04 : 0.06, 0.035);
      if (hq && (s & 3) === 2) hit(this.perc, t, 'bandpass', 5200, 2.5, 0.08, 0.06);
      if (hq && end4 && s >= 12) thump(this.perc, t, [220, 185, 156, 131][s - 12], 90, 0.32, 0.22);
      if (hq && bar % 8 === 0 && s === 0) hit(this.perc, t, 'highpass', 4500, 0.5, 0.09, 1.3);
      if (s === 14 && k === '.' && d.drum !== 'soft') kick(this.perc, t, 0.6);
    }
    // bass
    const b = S.bass[bar][s];
    if (b) note(this.bass, d.bw || 'sawtooth', mtof(b[1]), t, b[0] * sd * 0.9, BG[d.bw || 'sawtooth'], 0.005, 0.65, 0.12, 0.03);
    // pad: one chord per bar
    if (s === 0) {
      const pg = WG[d.pw] * 0.32, len = 16 * sd;
      if (hq) for (const m of S.pad[bar]) { note(this.padF, d.pw, mtof(m), t, len, pg * 0.7, 0.15, 1, 0, 0.12, -7); note(this.padF, d.pw, mtof(m), t, len, pg * 0.7, 0.15, 1, 0, 0.12, 7); }
      else for (const m of S.padLo[bar]) note(this.padF, d.pw, mtof(m), t, len, pg * 1.3, 0.15, 1, 0, 0.05); // low: 2 tones, bass carries the root
    }
    // lead (+ octave doubling layer at high intensity)
    const L = S.lead[bar][s];
    if (L) {
      const m = L[1] + (pass & 1 && bar >= 4 && bar < 6 && L[1] < 80 ? 12 : 0), f = mtof(m), dur = L[0] * sd * 0.85, g = WG[d.lw];
      note(this.leadF, d.lw, f, t, dur, g, 0.008, 0.65, 0.12, 0.06);
      if (hq && d.lw !== 'sine') note(this.leadF, d.lw, f, t, dur, g * 0.45, 0.008, 0.65, 0.12, 0.06, 10);
      if ((this.lv.dbl || 0) > 0.02) note(this.dbl, d.lw === 'sine' ? 'triangle' : d.lw, f * 2, t, dur, g * 0.8, 0.008, 0.6, 0.1, 0.05);
    }
    // arpeggio (high quality)
    if (d.arp && (this.lv.arp || 0) > 0.02) {
      const every = d.arp === 'up16' ? 1 : 2;
      if (s % every === 0) {
        const ch = S.pad[bar], tones = [ch[0], ch[1], ch[2], ch[0] + 12, ch[1] + 12, ch[2] + 12], i = s / every;
        const idx = d.arp === 'updown' ? [0, 1, 2, 3, 4, 5, 4, 3][i % 8] : i % 6;
        note(this.arp, 'triangle', mtof(tones[idx] + 12), t, sd * every * 0.6, 0.06, 0.003, 0.3, 0.05, 0.05);
      }
    }
  }
  fanfare(t0) { // 'victory': one-shot ~4s fanfare, then silence
    const b = 60 / 140;
    const L = [[0, 67, 0.3], [1 / 3, 72, 0.3], [2 / 3, 76, 0.3], [1, 79, 1], [2, 76, 0.5], [2.5, 79, 0.5], [3, 81, 0.75], [3.75, 79, 0.25],
      [4, 77, 0.5], [4.5, 81, 0.5], [5, 83, 0.5], [5.5, 86, 0.5], [6, 84, 2.6]];
    for (const [bt, m, l] of L) {
      note(this.leadF, 'sawtooth', mtof(m), t0 + bt * b, l * b * 0.9, 0.1, 0.01, 0.7, 0.2, 0.12);
      note(this.leadF, 'square', mtof(m + 12), t0 + bt * b, l * b * 0.9, 0.035, 0.01, 0.6, 0.2, 0.12);
    }
    const CH = [[1, [60, 64, 67], 48, 2], [3, [60, 65, 69], 41, 2], [5, [59, 62, 67], 43, 1], [6, [60, 64, 67, 74], 36, 2.6]];
    for (const [bt, ch, bs, l] of CH) {
      const t = t0 + bt * b;
      for (const m of ch) note(this.padF, 'sawtooth', mtof(m), t, l * b, 0.03, 0.04, 1, 0, 0.25);
      note(this.bass, 'sawtooth', mtof(bs), t, l * b, 0.15, 0.005, 0.7, 0.2, 0.1); kick(this.drum, t, 1);
    }
    for (const x of [0, 1 / 3, 2 / 3]) snare(this.drum, t0 + x * b, 0.5);
    for (let i = 0; i < 8; i++) snare(this.drum, t0 + (5 + i / 8) * b, 0.25 + i * 0.07);
    for (const x of [1, 6]) hit(this.drum, t0 + x * b, 'highpass', 4500, 0.5, 0.12, 1.6);
  }
  dispose() { for (const n of this.nodes) { try { n.disconnect(); } catch (_) { /* ignore */ } } }
}
function fadeTrack(tr, fade) { const t = ctx.currentTime; tr.out.gain.setTargetAtTime(0, t, Math.max(0.01, fade / 5)); tr.dieAt = t + fade + 0.2; }
function switchTrack(id, fade) {
  fade = clamp(fade, 0.02, 10);
  const t = ctx.currentTime;
  for (const tr of tracks) if (tr.dieAt) { tr.out.gain.setTargetAtTime(0, t, 0.03); tr.dieAt = Math.min(tr.dieAt, t + 0.2); }
  if (cur) { fadeTrack(cur, fade); cur = null; }
  if (id) { cur = new Track(id); tracks.push(cur); cur.out.gain.setTargetAtTime(MUSIC_LVL, t, cur.d.once ? 0.005 : fade / 4); }
}

/* ------------------------------------------------- shared builders (beds/loops) */
const nN = (b, kind) => { const s = ctx.createBufferSource(); s.buffer = NZ[kind]; s.loop = true; s.start(ctx.currentTime, Math.random() * 1.5); b.srcs.push(s); b.nodes.push(s); return s; };
const nO = (b, type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); b.srcs.push(o); b.nodes.push(o); return o; };
const nF = (b, type, f, q) => { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q ?? 0.7; b.nodes.push(x); return x; };
const nG = (b, g) => { const x = ctx.createGain(); x.gain.value = g; b.nodes.push(x); return x; };
const nL = (b, rate, depth, param, type) => { const o = nO(b, type || 'sine', rate), g = nG(b, depth); o.connect(g); g.connect(param); return o; };
const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };

/* -------------------------------------------------------------- ambience */
// Each builder wires persistent nodes into b.out, may set b.ev (random events) and returns a base gain.
const BEDS = {
  wind(b) { const f = nF(b, 'bandpass', 600, 0.8), g = nG(b, 0.6); chain(nN(b, 'pink'), f, g, b.out); nL(b, 0.06, 350, f.frequency); nL(b, 0.11, 0.35, g.gain); return 0.9; },
  rain(b) {
    chain(nN(b, 'white'), nF(b, 'bandpass', 4000, 0.4), nG(b, 0.45), b.out);
    chain(nN(b, 'pink'), nF(b, 'lowpass', 900), nG(b, 0.35), b.out); return 0.6;
  },
  ocean(b) {
    const f = nF(b, 'lowpass', 500), g = nG(b, 0.6), f2 = nF(b, 'bandpass', 2500, 0.5), g2 = nG(b, 0.12);
    chain(nN(b, 'brown'), f, g, b.out); chain(nN(b, 'white'), f2, g2, b.out);
    const l = nL(b, 0.09, 350, f.frequency), lg = nG(b, 0.4), lg2 = nG(b, 0.1); l.connect(lg); lg.connect(g.gain); l.connect(lg2); lg2.connect(g2.gain);
    return 0.6;
  },
  lava(b) {
    chain(nN(b, 'brown'), nF(b, 'lowpass', 220), nG(b, 0.9), b.out);
    b.ev = (v) => { tn(v, { f: rnd(90, 160), f2: rnd(300, 500), sl: 0.06, d: 0.09, g: 0.3 }); nz(v, { n: 'brown', ft: 'lowpass', f: 400, d: 0.12, g: 0.4 }); return rnd(0.25, 1.2); };
    return 0.6;
  },
  city(b) {
    chain(nN(b, 'pink'), nF(b, 'lowpass', 450), nG(b, 0.5), b.out); chain(nO(b, 'sine', 58), nG(b, 0.05), b.out);
    b.ev = (v) => {
      if (Math.random() < 0.15) { tn(v, { w: 'square', f: 392, d: 0.35, h: 0.8, g: 0.025, lp: 1200 }); tn(v, { w: 'square', f: 494, d: 0.35, h: 0.8, g: 0.02, lp: 1200 }); }
      else nz(v, { n: 'pink', f: 350, f2: 900, sl: 1.3, q: 1.2, a: 1.2, h: 0.5, d: 2.6, g: 0.3 });
      return rnd(2, 6);
    };
    return 0.6;
  },
  birds(b) {
    b.spread = 0.8;
    b.ev = (v) => {
      const f = rnd(2200, 4200), n = 2 + Math.floor(Math.random() * 4), trill = Math.random() < 0.5;
      for (let i = 0; i < n; i++) {
        const t = i * rnd(0.07, 0.14);
        if (trill) tn(v, { f, f2: f * rnd(1.2, 1.6), sl: 0.04, t, d: 0.06, g: 0.3 }); else tn(v, { f: f * 1.3, f2: f * 0.8, t, d: 0.09, g: 0.28, vib: [30, 0.04] });
      }
      return rnd(0.6, 3.5);
    };
    return 1.2;
  },
  cave(b) {
    chain(nO(b, 'sine', 55), nG(b, 0.12), b.out); chain(nO(b, 'sine', 82.7), nG(b, 0.07), b.out);
    chain(nN(b, 'brown'), nF(b, 'lowpass', 120), nG(b, 0.3), b.out);
    const dl = ctx.createDelay(1); dl.delayTime.value = 0.37; b.nodes.push(dl);
    b.dIn = nG(b, 0.5); const fb = nG(b, 0.45); chain(b.dIn, dl, fb, dl); chain(dl, nG(b, 0.7), b.out);
    b.ev = (v) => { const f = rnd(900, 1800); v.out.connect(b.dIn); tn(v, { f, f2: f * 2.2, sl: 0.03, d: 0.07, g: 0.18 }); return rnd(0.6, 2.5); };
    return 0.8;
  },
  storm(b) {
    chain(nN(b, 'white'), nF(b, 'bandpass', 3000, 0.3), nG(b, 0.7), b.out); chain(nN(b, 'pink'), nF(b, 'lowpass', 1200), nG(b, 0.5), b.out);
    const f = nF(b, 'bandpass', 500, 0.8), g = nG(b, 0.5); chain(nN(b, 'pink'), f, g, b.out); nL(b, 0.08, 300, f.frequency); nL(b, 0.15, 0.3, g.gain);
    b.next = ctx.currentTime + rnd(2, 6);
    b.ev = (v) => { v.out.gain.value = rnd(0.35, 0.9); SFX.thunder(v); return rnd(7, 18); };
    return 0.55;
  },
  sand(b) {
    const g = nG(b, 0.45); chain(nN(b, 'white'), nF(b, 'bandpass', 2800, 1.2), g, b.out); nL(b, 0.17, 0.35, g.gain);
    const f = nF(b, 'bandpass', 500, 0.7); chain(nN(b, 'pink'), f, nG(b, 0.5), b.out); nL(b, 0.07, 250, f.frequency);
    const gr = nG(b, 0.06); chain(nN(b, 'white'), nF(b, 'highpass', 6000), gr, b.out); nL(b, 9, 0.05, gr.gain, 'square');
    return 0.55;
  },
  water(b) {
    chain(nN(b, 'pink'), nF(b, 'lowpass', 2200), nG(b, 0.6), b.out); chain(nN(b, 'brown'), nF(b, 'lowpass', 300), nG(b, 0.4), b.out);
    const g = nG(b, 0.25); chain(nN(b, 'white'), nF(b, 'bandpass', 1200, 0.6), g, b.out); nL(b, 0.3, 0.1, g.gain);
    return 0.55;
  },
  space(b) {
    chain(nO(b, 'sine', 41), nG(b, 0.15), b.out); const g = nG(b, 0.08); chain(nO(b, 'sine', 61.7), g, b.out); nL(b, 0.05, 0.05, g.gain);
    const f = nF(b, 'bandpass', 300, 4); chain(nN(b, 'pink'), f, nG(b, 0.25), b.out); nL(b, 0.03, 200, f.frequency);
    return 0.65;
  },
};
function mkBed(name) {
  const t = ctx.currentTime, b = { name, nodes: [], srcs: [], lv: 0, on: t, next: t + rnd(0.3, 1.5), spread: 0.4, out: ctx.createGain() };
  b.out.gain.value = 0; b.out.connect(busAmb); b.nodes.push(b.out);
  b.base = BEDS[name](b) || 1;
  return b;
}
function killBed(b, fast) {
  const t = ctx.currentTime;
  b.out.gain.setTargetAtTime(0, t, fast ? 0.05 : 0.25);
  for (const s of b.srcs) { try { s.stop(t + 1.5); } catch (_) { /* ignore */ } }
  bin(t + 1.6, b.nodes); delete beds[b.name];
}
function bedEvent(b, t) { // a short-lived voice routed into the bed
  const v = { t, p: 1, nodes: [], srcs: [], end: t, out: ctx.createGain() }, sp = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  v.nodes.push(v.out);
  if (sp) { sp.pan.value = rnd(-b.spread, b.spread); v.out.connect(sp); sp.connect(b.out); v.nodes.push(sp); } else v.out.connect(b.out);
  const next = b.ev(v); bin(v.end + 0.1, v.nodes); return next;
}
function bedsUpdate(t) {
  for (const k in beds) {
    const b = beds[k];
    if (b.lv <= 0 && t - b.on > 3) { killBed(b); continue; } // silent for a while: free the nodes
    if (b.ev && b.lv > 0.02 && !paused && t >= b.next) b.next = t + bedEvent(b, t + 0.05);
  }
}

/* --------------------------------------------------------- gameplay loops */
// Builders push [AudioParam, baseValue] pairs into L.pp; those follow opts.pitch.
const LOOPS = {
  grind(L) {
    const f = nF(L, 'bandpass', 3200, 6), g = nG(L, 0.7); chain(nN(L, 'white'), f, g, L.out); nL(L, 23, 0.3, g.gain, 'square');
    const o = nO(L, 'sawtooth', 190), f2 = nF(L, 'bandpass', 1900, 12); chain(o, f2, nG(L, 0.5), L.out);
    L.pp.push([f.frequency, 3200], [o.frequency, 190], [f2.frequency, 1900]); return 0.5;
  },
  boostLoop(L) {
    const f = nF(L, 'lowpass', 700, 0.8), g = nG(L, 0.9); chain(nN(L, 'brown'), f, g, L.out); nL(L, 13, 0.15, g.gain);
    const f2 = nF(L, 'bandpass', 1800, 0.9); chain(nN(L, 'pink'), f2, nG(L, 0.3), L.out);
    const o = nO(L, 'sawtooth', 48); chain(o, nF(L, 'lowpass', 260, 1), nG(L, 0.25), L.out);
    L.pp.push([f.frequency, 700], [f2.frequency, 1800], [o.frequency, 48]); return 0.4;
  },
  glide(L) {
    const f = nF(L, 'bandpass', 800, 1), g = nG(L, 0.8); chain(nN(L, 'pink'), f, g, L.out); nL(L, 0.4, 0.25, g.gain); nL(L, 0.23, 200, f.frequency);
    L.pp.push([f.frequency, 800]); return 0.35;
  },
  swim(L) {
    const f = nF(L, 'lowpass', 450, 2); chain(nN(L, 'brown'), f, nG(L, 0.8), L.out); nL(L, 2.2, 250, f.frequency);
    const f2 = nF(L, 'bandpass', 1200, 4); chain(nN(L, 'pink'), f2, nG(L, 0.25), L.out); nL(L, 3.1, 500, f2.frequency);
    L.pp.push([f.frequency, 450], [f2.frequency, 1200]); return 0.45;
  },
  charge(L) {
    const a = nO(L, 'sawtooth', 85), c = nO(L, 'square', 171), f = nF(L, 'lowpass', 1300, 3), g = nG(L, 0.6);
    a.connect(f); c.connect(f); chain(f, g, L.out); const lfo = nL(L, 28, 0.35, g.gain, 'square');
    L.pp.push([a.frequency, 85], [c.frequency, 171], [f.frequency, 1300], [lfo.frequency, 28]); return 0.2;
  },
  wallrun(L) {
    const f = nF(L, 'bandpass', 1700, 1.5), g = nG(L, 0.5); chain(nN(L, 'white'), f, g, L.out); const lfo = nL(L, 12, 0.5, g.gain, 'square');
    chain(nN(L, 'pink'), nF(L, 'bandpass', 600, 0.7), nG(L, 0.4), L.out);
    L.pp.push([f.frequency, 1700], [lfo.frequency, 12]); return 0.4;
  },
};
function loopSet(L, pitch, v) {
  const t = ctx.currentTime;
  if (Math.abs(pitch - L.pitch) > 0.003) { L.pitch = pitch; for (const [p, f] of L.pp) p.setTargetAtTime(f * pitch, t, 0.05); }
  if (Math.abs(v - L.vol) > 0.003 || !L.live) { L.vol = v; L.live = true; L.out.gain.setTargetAtTime(v * L.base, t, 0.06); }
}
function loopOff(name) {
  const L = loops[name]; if (!L) return;
  const t = ctx.currentTime;
  L.out.gain.setTargetAtTime(0, t, 0.06);
  for (const s of L.srcs) { try { s.stop(t + 0.5); } catch (_) { /* ignore */ } }
  bin(t + 0.6, L.nodes); delete loops[name];
}
function loopCtl(name, on, opts) {
  const o = opts || {}, L = loops[name];
  const pitch = clamp(num(o.pitch, L ? L.pitch : 1), 0.1, 8), v = clamp(num(o.vol, L ? L.vol : 1), 0, 2);
  if (!on) { loopOff(name); return; }
  if (!L) {
    const n = { name, nodes: [], srcs: [], pp: [], pitch, vol: v, live: false, out: ctx.createGain() };
    n.out.gain.value = 0; n.out.connect(busLoop); n.nodes.push(n.out);
    n.base = LOOPS[name](n) || 0.4;
    for (const [p, f] of n.pp) p.value = f * pitch;
    loops[name] = n; loopSet(n, pitch, v);
  } else loopSet(L, pitch, v);
}

/* ---------------------------------------------------------------- ticker */
function tick() {
  if (!ctx) return;
  try {
    const now = ctx.currentTime, dt = clamp(now - lastTick, 0, 0.5); lastTick = now;
    sweep(now);
    if (voices.length > 40) voices = voices.filter((x) => x.end > now);
    inten += (intenT - inten) * (1 - Math.exp(-dt / 0.5));
    for (let i = tracks.length - 1; i >= 0; i--) {
      const tr = tracks[i];
      if (tr.dieAt && now > tr.dieAt) { tr.dispose(); tracks.splice(i, 1); } else tr.update(now);
    }
    bedsUpdate(now);
  } catch (e) { warnOnce(e); }
}

/* ------------------------------------------------------------ public API */
export const audio = {
  ready: false,
  init: safe(() => {
    if (!ctx) {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return false;
      try {
        ctx = new AC();
        build();
      } catch (e) {
        dbg('init failed', e);
        try { if (ctx) ctx.close(); } catch (_) { /* ignore */ }
        ctx = null; return false;
      }
      audio.ready = true;
      lastTick = ctx.currentTime;
      timer = setInterval(tick, 25);
      try { // iOS/Android unlock: tiny silent buffer inside the gesture
        const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0); bin(ctx.currentTime + 0.5, [s]);
      } catch (_) { /* ignore */ }
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (!ctx) return;
          if (document.hidden) { try { const p = ctx.suspend(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* ignore */ } } else resume();
        });
        for (const ev of ['pointerdown', 'touchend', 'keydown', 'mousedown']) window.addEventListener(ev, resume, { capture: true, passive: true });
      }
      applyListener();
      if (wantTrack) switchTrack(wantTrack, 1);
      for (const k in loopWant) { const w = loopWant[k]; delete loopWant[k]; if (w.on) loopCtl(k, true, w.opts); }
    }
    resume();
    return audio.ready;
  }),
  setVolumes: safe((v) => {
    if (!v) return;
    for (const k of ['master', 'music', 'sfx', 'ambient']) if (typeof v[k] === 'number' && isFinite(v[k])) vol[k] = clamp(v[k], 0, 1);
    applyVolumes();
  }),
  setQuality: safe((q) => { hq = q !== 'low'; }),
  play: safe(play),
  setListener: safe((pos, fwd, up) => {
    const p = vec3(pos), f = vec3(fwd), u = vec3(up);
    if (p) lis.pos = p;
    if (f && f[0] * f[0] + f[1] * f[1] + f[2] * f[2] > 1e-8) lis.fwd = f;
    if (u && u[0] * u[0] + u[1] * u[1] + u[2] * u[2] > 1e-8) lis.up = u;
    if (ctx) applyListener();
  }),
  music: safe((trackId, opts) => {
    const id = trackId ? String(trackId) : null;
    if (id && !TRACKS[id]) { dbg('unknown track', id); return; }
    if (id === wantTrack) return;
    wantTrack = id;
    if (ctx) switchTrack(id, num(opts && opts.fade, 1.5));
  }),
  setMusicIntensity: safe((x) => { intenT = clamp(num(x, 0), 0, 1); }),
  ambient: safe((name, level) => {
    if (!BEDS[name]) { dbg('unknown ambient', name); return; }
    if (!ctx) return;
    const lv = clamp(num(level, 0), 0, 1), t = ctx.currentTime;
    let b = beds[name];
    if (!b) { if (lv <= 0.001) return; b = beds[name] = mkBed(name); }
    if (Math.abs(lv - b.lv) > 0.004 || (lv === 0 && b.lv !== 0)) { b.lv = lv; b.out.gain.setTargetAtTime(lv * b.base, t, 0.35); }
    if (lv > 0) b.on = t;
  }),
  loop: safe((name, on, opts) => {
    if (!LOOPS[name]) { dbg('unknown loop', name); return; }
    if (!ctx) { loopWant[name] = { on: !!on, opts }; return; }
    loopCtl(name, !!on, opts);
  }),
  setPaused: safe((p) => { paused = !!p; applyVolumes(0.1); }),
  stopAll: safe(() => {
    wantTrack = null;
    for (const k in loopWant) delete loopWant[k];
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const v of voices) killVoice(v, t);
    voices = [];
    for (const k in loops) loopOff(k);
    for (const k in beds) killBed(beds[k], true);
    if (cur) { fadeTrack(cur, 0.4); cur = null; }
  }),
};
export default audio;
