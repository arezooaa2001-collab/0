// «AMIR ABC» intro music — the score. An original 16-second electronic track written as Web Audio
// code. scripts/make-music.cjs renders it once (offline, in Chromium) to src/brand/intro-music.mp3,
// which the app plays: no live synthesis on the tablet, so no crackles on slower devices.
// 120 BPM in A minor:
//   0–4 s   build-up while «AMIR ABC» fades in: filtered arpeggio opening up, pad, rising noise, snare roll
//   4 s     the drop, exactly when the guide appears: crash, kick, clap, pumping pad, bass, lead melody
//   4–12 s  Am – F – C – G, twice the hook
//   12–16 s ending on A minor with a sparkle and the reverb tail

const BPM = 120;
const BEAT = 60 / BPM; // 0.5 s
const STEP = BEAT / 4; // a 16th note
const BAR = BEAT * 4; // 2 s
export const DROP_AT = 2 * BAR; // 4 s
const END_AT = 6 * BAR; // 12 s
export const MUSIC_LENGTH = END_AT + 4.5;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** The drop's chords, one bar each: roots for the bass, notes for pad and arpeggio. */
const DROP_CHORDS = [
  { bass: 45, pad: [57, 60, 64], arp: [57, 60, 64, 69, 72, 69, 64, 60] }, // A minor
  { bass: 41, pad: [57, 60, 65], arp: [53, 57, 60, 65, 69, 65, 60, 57] }, // F major
  { bass: 48, pad: [55, 60, 64], arp: [60, 64, 67, 72, 76, 72, 67, 64] }, // C major
  { bass: 43, pad: [55, 59, 62], arp: [55, 59, 62, 67, 71, 67, 62, 59] }, // G major
];
const BUILD_CHORDS = [DROP_CHORDS[0], DROP_CHORDS[3]]; // Am → G, leading into the drop

/** The hook, in 8th notes over Am – F – C – G (null = rest). */
const HOOK: (number | null)[][] = [
  [76, null, 76, 79, 81, null, 79, 76],
  [77, null, 76, 72, 69, null, 72, null],
  [76, null, 76, 79, 84, null, 83, 79],
  [83, null, 81, 79, 74, null, 79, 83],
];

interface Kit {
  ctx: BaseAudioContext;
  bus: AudioNode; // dry mix
  reverb: AudioNode; // send
  delay: AudioNode; // send
  duck: GainNode; // the pad's «pumping» gain
  noise: AudioBuffer;
}

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 2);
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  let seed = 12345; // the same «noise» every time
  for (let i = 0; i < len; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (seed / 0x3fffffff) - 1;
  }
  return b;
}

function reverbImpulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let seed = 777 + ch * 31;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = ((seed / 0x3fffffff) - 1) * (1 - i / len) ** 3;
    }
  }
  return b;
}

function env(g: GainNode, t: number, peak: number, attack: number, hold: number, release: number) {
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
}

function send(k: Kit, node: AudioNode, wetReverb = 0, wetDelay = 0, pan = 0) {
  let out: AudioNode = node;
  if (pan && typeof k.ctx.createStereoPanner === 'function') {
    const p = k.ctx.createStereoPanner();
    p.pan.value = pan;
    node.connect(p);
    out = p;
  }
  out.connect(k.bus);
  if (wetReverb) {
    const g = k.ctx.createGain();
    g.gain.value = wetReverb;
    out.connect(g).connect(k.reverb);
  }
  if (wetDelay) {
    const g = k.ctx.createGain();
    g.gain.value = wetDelay;
    out.connect(g).connect(k.delay);
  }
}

function noiseSource(k: Kit, t: number, dur: number): AudioBufferSourceNode {
  const s = k.ctx.createBufferSource();
  s.buffer = k.noise;
  s.start(t, Math.random() * 0.5, dur + 0.05);
  return s;
}

// ── Instruments ─────────────────────────────────────────────────────────────
function kick(k: Kit, t: number, level = 0.72) {
  const o = k.ctx.createOscillator();
  o.frequency.setValueAtTime(170, t);
  o.frequency.exponentialRampToValueAtTime(52, t + 0.11);
  const g = k.ctx.createGain();
  env(g, t, level, 0.002, 0.03, 0.32);
  o.connect(g);
  send(k, g);
  o.start(t);
  o.stop(t + 0.45);
  // the click that makes it heard on small tablet speakers
  const n = noiseSource(k, t, 0.02);
  const hp = k.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2500;
  const ng = k.ctx.createGain();
  env(ng, t, level * 0.25, 0.001, 0.003, 0.015);
  n.connect(hp).connect(ng);
  send(k, ng);
}

function clap(k: Kit, t: number, level = 0.32) {
  for (const [i, off] of [0, 0.011, 0.023].entries()) {
    const n = noiseSource(k, t + off, i === 2 ? 0.22 : 0.02);
    const bp = k.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 0.9;
    const g = k.ctx.createGain();
    env(g, t + off, level, 0.001, 0.004, i === 2 ? 0.2 : 0.012);
    n.connect(bp).connect(g);
    send(k, g, 0.35);
  }
}

function hat(k: Kit, t: number, level: number, open = false) {
  const n = noiseSource(k, t, open ? 0.25 : 0.05);
  const hp = k.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = open ? 6500 : 8000;
  const g = k.ctx.createGain();
  env(g, t, level, 0.001, 0.005, open ? 0.22 : 0.04);
  n.connect(hp).connect(g);
  send(k, g, 0.08, 0, 0.25);
}

function crash(k: Kit, t: number, level = 0.2) {
  const n = noiseSource(k, t, 2.2);
  const hp = k.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 4500;
  const g = k.ctx.createGain();
  env(g, t, level, 0.003, 0.05, 2);
  n.connect(hp).connect(g);
  send(k, g, 0.4);
}

/** A soft «whoomp» under the first beat of the drop (one hit, not a «dun dun dun»). */
function impact(k: Kit, t: number) {
  const o = k.ctx.createOscillator();
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.6);
  const g = k.ctx.createGain();
  env(g, t, 0.45, 0.005, 0.05, 0.8);
  o.connect(g);
  send(k, g, 0.2);
  o.start(t);
  o.stop(t + 1);
}

function pluck(k: Kit, t: number, midi: number, bright: number, pan: number, level = 0.075) {
  const o = k.ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = hz(midi);
  const lp = k.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 4;
  lp.frequency.setValueAtTime(400 + 4200 * bright, t);
  lp.frequency.exponentialRampToValueAtTime(260, t + 0.16);
  const g = k.ctx.createGain();
  env(g, t, level, 0.003, 0.02, 0.16);
  o.connect(lp).connect(g);
  send(k, g, 0.18, 0.28, pan);
  o.start(t);
  o.stop(t + 0.25);
}

function padChord(k: Kit, t: number, dur: number, notes: number[], cutoffFrom: number, cutoffTo: number, level = 0.03) {
  const lp = k.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.7;
  lp.frequency.setValueAtTime(cutoffFrom, t);
  lp.frequency.exponentialRampToValueAtTime(cutoffTo, t + dur);
  const g = k.ctx.createGain();
  env(g, t, level, 0.25, Math.max(0, dur - 0.35), 0.5);
  lp.connect(g).connect(k.duck);
  for (const m of notes)
    for (const det of [-9, 9]) {
      const o = k.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(m);
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.6);
    }
}

function bass(k: Kit, t: number, midi: number) {
  const o = k.ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = hz(midi);
  const sub = k.ctx.createOscillator();
  sub.frequency.value = hz(midi - 12);
  const lp = k.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1400, t);
  lp.frequency.exponentialRampToValueAtTime(380, t + 0.18);
  const g = k.ctx.createGain();
  env(g, t, 0.17, 0.004, 0.08, 0.1);
  o.connect(lp).connect(g);
  const sg = k.ctx.createGain();
  env(sg, t, 0.12, 0.004, 0.08, 0.1);
  sub.connect(sg);
  send(k, g);
  send(k, sg);
  for (const x of [o, sub]) {
    x.start(t);
    x.stop(t + 0.25);
  }
}

function lead(k: Kit, t: number, midi: number, dur: number, level = 0.11) {
  const lp = k.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(5200, t);
  lp.frequency.exponentialRampToValueAtTime(2400, t + Math.max(0.1, dur));
  const g = k.ctx.createGain();
  env(g, t, level, 0.008, Math.max(0, dur - 0.06), 0.12);
  lp.connect(g);
  send(k, g, 0.25, 0.22);
  // a little vibrato on longer notes
  const lfo = k.ctx.createOscillator();
  lfo.frequency.value = 5.5;
  const depth = k.ctx.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(dur > 0.3 ? 12 : 0, t + Math.min(dur, 0.4));
  lfo.connect(depth);
  for (const [type, det, mul] of [['sawtooth', -7, 1], ['sawtooth', 7, 1], ['square', 0, 0.5]] as const) {
    const o = k.ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz(midi) * mul;
    o.detune.value = det;
    depth.connect(o.detune);
    const og = k.ctx.createGain();
    og.gain.value = type === 'square' ? 0.35 : 0.5;
    o.connect(og).connect(lp);
    o.start(t);
    o.stop(t + dur + 0.25);
  }
  lfo.start(t);
  lfo.stop(t + dur + 0.25);
}

function bell(k: Kit, t: number, midi: number, level = 0.06) {
  for (const [mul, l] of [[1, 1], [2.01, 0.35], [3.98, 0.12]] as const) {
    const o = k.ctx.createOscillator();
    o.frequency.value = hz(midi) * mul;
    const g = k.ctx.createGain();
    env(g, t, level * l, 0.003, 0.02, 1.6);
    o.connect(g);
    send(k, g, 0.4, 0.25, 0.2);
    o.start(t);
    o.stop(t + 1.8);
  }
}

/** Rising filtered noise and a snare roll over the build-up. */
function riser(k: Kit, t: number, dur: number) {
  const n = noiseSource(k, t, dur);
  const bp = k.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
  const g = k.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.14, t + dur - 0.02);
  g.gain.linearRampToValueAtTime(0, t + dur);
  n.connect(bp).connect(g);
  send(k, g, 0.2);
}

function snareHit(k: Kit, t: number, level: number, pitch: number) {
  const n = noiseSource(k, t, 0.1);
  const bp = k.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = pitch;
  bp.Q.value = 0.8;
  const g = k.ctx.createGain();
  env(g, t, level, 0.001, 0.005, 0.09);
  n.connect(bp).connect(g);
  send(k, g, 0.15);
}

// ── The song ────────────────────────────────────────────────────────────────
/** Schedule the whole track on `ctx` starting at `t0`, into `out`. Returns the end time. */
export function scheduleIntroMusic(ctx: BaseAudioContext, out: AudioNode, t0: number): number {
  const bus = ctx.createGain();
  bus.gain.value = 1;
  const reverb = ctx.createConvolver();
  reverb.buffer = reverbImpulse(ctx, 2.4);
  const reverbOut = ctx.createGain();
  reverbOut.gain.value = 0.6;
  reverb.connect(reverbOut).connect(bus);
  // dotted-8th echo with a darker feedback loop
  const delay = ctx.createDelay(1);
  delay.delayTime.value = STEP * 3;
  const fb = ctx.createGain();
  fb.gain.value = 0.32;
  const fbLp = ctx.createBiquadFilter();
  fbLp.type = 'lowpass';
  fbLp.frequency.value = 3000;
  delay.connect(fbLp).connect(fb).connect(delay);
  const delayOut = ctx.createGain();
  delayOut.gain.value = 0.5;
  fbLp.connect(delayOut).connect(bus);
  const duck = ctx.createGain();
  duck.gain.value = 1;
  duck.connect(bus);
  const padSend = ctx.createGain();
  padSend.gain.value = 0.3;
  duck.connect(padSend).connect(reverb);
  bus.connect(out);

  const k: Kit = { ctx, bus, reverb, delay, duck, noise: noiseBuffer(ctx) };

  // 0–4 s: build-up
  BUILD_CHORDS.forEach((c, bar) => {
    const tb = t0 + bar * BAR;
    padChord(k, tb, BAR, c.pad, 280 + bar * 500, 900 + bar * 900, 0.026 + bar * 0.012);
    for (let s = 0; s < 16; s++) {
      const t = tb + s * STEP;
      const bright = (bar * 16 + s) / 32; // the filter opens over the build-up
      pluck(k, t, c.arp[s % 8], bright, s % 2 ? 0.35 : -0.35, 0.08 + 0.08 * bright);
    }
  });
  riser(k, t0, DROP_AT);
  for (let s = 0; s < 8; s++) hat(k, t0 + BAR + s * BEAT * 0.5, 0.02 + s * 0.006);
  // snare roll in the last bar: 8ths, then 16ths, louder and higher
  for (let s = 0; s < 16; s++) {
    const t = t0 + BAR + s * STEP;
    if (s < 8 && s % 2) continue;
    snareHit(k, t, 0.05 + (s / 16) * 0.2, 1200 + s * 90);
  }

  // 4–12 s: the drop
  const drop = t0 + DROP_AT;
  impact(k, drop);
  crash(k, drop);
  DROP_CHORDS.forEach((c, bar) => {
    const tb = drop + bar * BAR;
    padChord(k, tb, BAR, c.pad, 1800, 1400);
    for (let beat = 0; beat < 4; beat++) {
      const t = tb + beat * BEAT;
      kick(k, t);
      // the pad «pumps» with the kick
      duck.gain.setValueAtTime(0.3, t);
      duck.gain.linearRampToValueAtTime(1, t + BEAT * 0.8);
      if (beat % 2) clap(k, t);
      hat(k, t + BEAT / 2, 0.07, true);
      hat(k, t + BEAT / 4, 0.03);
      hat(k, t + (BEAT * 3) / 4, 0.03);
      bass(k, t + BEAT / 2, c.bass);
    }
    for (let s = 0; s < 16; s++) pluck(k, tb + s * STEP, c.arp[s % 8] + 12, 0.75, s % 2 ? 0.4 : -0.4);
    const hook = HOOK[bar];
    hook.forEach((m, i) => {
      if (m === null) return;
      let len = 1;
      while (i + len < hook.length && hook[i + len] === null) len++;
      lead(k, tb + i * BEAT * 0.5, m, len * BEAT * 0.5 * 0.92);
    });
  });

  // 12–16 s: ending on A minor
  const end = t0 + END_AT;
  kick(k, end);
  impact(k, end);
  crash(k, end, 0.16);
  duck.gain.setValueAtTime(1, end);
  padChord(k, end, 2.6, [57, 60, 64, 69], 1600, 500, 0.032);
  bass(k, end, 45);
  lead(k, end, 81, 1.6, 0.08);
  [69, 72, 76, 81, 84, 88].forEach((m, i) => bell(k, end + 0.25 + i * STEP * 2, m, 0.05));

  return t0 + MUSIC_LENGTH;
}
