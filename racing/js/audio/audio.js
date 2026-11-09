// Fully synthesised sound (no audio files): engine voices with RPM/load dependent timbre,
// tyre squeal, wind, nitro, impacts, gear-change pops, countdown and UI sounds.
// Opponent engines use a small pool of voices assigned to the nearest cars with doppler + pan.

import { clamp } from '../core/utils.js';

function makeDistortion(ctx, amount) {
  const ws = ctx.createWaveShaper();
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  ws.curve = curve;
  ws.oversample = '2x';
  return ws;
}

class EngineVoice {
  constructor(audio, cylinders, out, character = 1) {
    const ctx = audio.ctx;
    this.ctx = ctx;
    this.cyl = cylinders;
    this.character = character;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 1.2;
    this.shaper = makeDistortion(ctx, 3 + cylinders * 0.4);
    this.o1 = ctx.createOscillator();
    this.o1.type = 'sawtooth';
    this.o2 = ctx.createOscillator();
    this.o2.type = 'square';
    this.o3 = ctx.createOscillator();
    this.o3.type = 'sawtooth';
    const g1 = ctx.createGain(); g1.gain.value = 0.5;
    const g2 = ctx.createGain(); g2.gain.value = 0.32;
    const g3 = ctx.createGain(); g3.gain.value = 0.14;
    this.o1.connect(g1); this.o2.connect(g2); this.o3.connect(g3);
    const mix = ctx.createGain();
    g1.connect(mix); g2.connect(mix); g3.connect(mix);
    // intake / combustion noise
    this.noise = ctx.createBufferSource();
    this.noise.buffer = audio.noiseBuffer;
    this.noise.loop = true;
    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.Q.value = 0.8;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.05;
    this.noise.connect(this.noiseFilter).connect(this.noiseGain).connect(mix);
    mix.connect(this.shaper).connect(this.filter).connect(this.gain);
    if (this.pan) { this.gain.connect(this.pan); this.pan.connect(out); } else this.gain.connect(out);
    const t = ctx.currentTime;
    this.o1.start(t); this.o2.start(t); this.o3.start(t); this.noise.start(t, Math.random() * 1.5);
  }

  set(rpm, load, redline, volume, panValue = 0, pitchMul = 1) {
    const t = this.ctx.currentTime;
    const f0 = (rpm / 60) * (this.cyl / 2) * 0.5 * pitchMul * this.character;
    const rn = clamp(rpm / redline, 0, 1.1);
    this.o1.frequency.setTargetAtTime(f0, t, 0.02);
    this.o2.frequency.setTargetAtTime(f0 * 0.5, t, 0.02);
    this.o3.frequency.setTargetAtTime(f0 * 2.01, t, 0.02);
    this.noiseFilter.frequency.setTargetAtTime(400 + f0 * 3, t, 0.05);
    this.noiseGain.gain.setTargetAtTime(0.03 + load * 0.08, t, 0.05);
    this.filter.frequency.setTargetAtTime(300 + load * 2600 + rn * 1600, t, 0.04);
    this.gain.gain.setTargetAtTime(volume * (0.1 + 0.16 * load + 0.1 * rn), t, 0.05);
    if (this.pan) this.pan.pan.setTargetAtTime(clamp(panValue, -1, 1), t, 0.05);
  }

  stop() {
    const t = this.ctx.currentTime;
    this.gain.gain.setTargetAtTime(0, t, 0.05);
    for (const o of [this.o1, this.o2, this.o3, this.noise]) {
      try { o.stop(t + 0.3); } catch { /* already stopped */ }
    }
    setTimeout(() => { try { this.gain.disconnect(); this.pan?.disconnect(); } catch { /* ignore */ } }, 500);
  }
}

class NoiseVoice {
  constructor(audio, type, freq, q, out) {
    const ctx = audio.ctx;
    this.ctx = ctx;
    this.src = ctx.createBufferSource();
    this.src.buffer = audio.noiseBuffer;
    this.src.loop = true;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = type;
    this.filter.frequency.value = freq;
    this.filter.Q.value = q;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.src.connect(this.filter).connect(this.gain).connect(out);
    this.src.start(ctx.currentTime, Math.random());
  }
  set(gain, freq) {
    const t = this.ctx.currentTime;
    this.gain.gain.setTargetAtTime(gain, t, 0.06);
    if (freq) this.filter.frequency.setTargetAtTime(freq, t, 0.06);
  }
  stop() {
    try { this.src.stop(this.ctx.currentTime + 0.2); } catch { /* ignore */ }
    setTimeout(() => { try { this.gain.disconnect(); } catch { /* ignore */ } }, 400);
  }
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.volumes = { master: 0.8, sfx: 0.9, engine: 0.75 };
    this.raceVoices = null;
  }

  /** Must be called from a user gesture (mobile autoplay rules). */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC({ latencyHint: 'interactive' });
        const ctx = this.ctx;
        this.master = ctx.createGain();
        this.comp = ctx.createDynamicsCompressor();
        this.comp.threshold.value = -14;
        this.comp.ratio.value = 4;
        this.master.connect(this.comp).connect(ctx.destination);
        this.sfx = ctx.createGain();
        this.engineBus = ctx.createGain();
        this.sfx.connect(this.master);
        this.engineBus.connect(this.master);
        const len = ctx.sampleRate * 2;
        this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.applyVolumes();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (this.pendingRace) this.startRace(...this.pendingRace);
    } catch (e) {
      console.warn('audio unavailable', e);
      this.ctx = null;
    }
  }

  setVolumes(v) {
    Object.assign(this.volumes, v);
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
    this.engineBus.gain.setTargetAtTime(this.volumes.engine, t, 0.05);
  }

  setPaused(p) {
    if (!this.ctx) return;
    if (p && this.ctx.state === 'running') this.ctx.suspend();
    else if (!p && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // ---- race voices ----------------------------------------------------------------------------
  startRace(playerCylinders, aiVoiceCount) {
    this.stopRace();
    if (!this.ctx) {
      // no user gesture yet (e.g. deep link): start the voices as soon as audio is unlocked
      this.pendingRace = [playerCylinders, aiVoiceCount];
      return;
    }
    this.pendingRace = null;
    this.raceVoices = {
      player: new EngineVoice(this, playerCylinders, this.engineBus),
      ai: Array.from({ length: aiVoiceCount }, (_, i) => new EngineVoice(this, 6 + (i % 2) * 2, this.engineBus, 0.95 + i * 0.04)),
      tires: new NoiseVoice(this, 'bandpass', 1100, 9, this.sfx),
      wind: new NoiseVoice(this, 'lowpass', 500, 0.7, this.sfx),
      nitro: new NoiseVoice(this, 'highpass', 1800, 0.7, this.sfx),
      offroad: new NoiseVoice(this, 'lowpass', 260, 1, this.sfx),
    };
  }

  /** Called every frame during a race. */
  updateRace(player, aiCars, listener) {
    const rv = this.raceVoices;
    if (!rv) return;
    const p = player;
    rv.player.set(p.rpm, Math.max(p.throttleOut, p.nitroActive ? 1 : 0), p.p.redline, 0.9);
    rv.tires.set(clamp(p.skid - 0.18, 0, 1) * 0.22 * (p.surface === 2 ? 0.2 : 1), 900 + Math.abs(p.slipR) * 1400);
    rv.wind.set(clamp(p.speed / 80, 0, 1) ** 2 * 0.22, 300 + p.speed * 10);
    rv.nitro.set(p.nitroActive ? 0.12 : 0);
    rv.offroad.set(p.surface === 2 ? clamp(p.speed / 30, 0, 1) * 0.25 : p.surface === 1 ? clamp(p.speed / 30, 0, 1) * 0.08 : 0);
    // nearest opponents
    if (rv.ai.length && aiCars.length) {
      const near = aiCars
        .map((c) => [c, (c.x - p.x) ** 2 + (c.z - p.z) ** 2])
        .sort((a, b) => a[1] - b[1])
        .slice(0, rv.ai.length);
      const lfx = Math.sin(listener.heading), lfz = Math.cos(listener.heading);
      rv.ai.forEach((voice, i) => {
        const e = near[i];
        if (!e) { voice.set(800, 0, 7000, 0); return; }
        const [c, d2] = e;
        const d = Math.sqrt(d2);
        const vol = clamp(1 / (1 + d / 9), 0, 1) * 0.55;
        const dx = (c.x - p.x) / (d || 1), dz = (c.z - p.z) / (d || 1);
        const vrel = -((c.vx - p.vx) * dx + (c.vz - p.vz) * dz);
        const doppler = clamp(343 / (343 - vrel), 0.8, 1.25);
        const side = dx * lfz - dz * lfx; // + = left
        voice.set(c.rpm, c.throttleOut, c.p.redline, vol, -side, doppler);
      });
    }
  }

  stopRace() {
    this.pendingRace = null;
    const rv = this.raceVoices;
    if (!rv) return;
    rv.player.stop();
    rv.ai.forEach((v) => v.stop());
    rv.tires.stop(); rv.wind.stop(); rv.nitro.stop(); rv.offroad.stop();
    this.raceVoices = null;
  }

  // ---- one-shots -------------------------------------------------------------------------------
  #tone(freq, dur, type = 'sine', gain = 0.25, glide = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * glide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  #burst(dur, freq, gain, type = 'lowpass') {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  beep(go = false) {
    this.#tone(go ? 1046 : 523, go ? 0.55 : 0.18, 'square', 0.12);
  }

  click() {
    this.#tone(880, 0.05, 'triangle', 0.08);
  }

  coin() {
    this.#tone(1318, 0.09, 'square', 0.07);
    setTimeout(() => this.#tone(1760, 0.16, 'square', 0.07), 70);
  }

  hit(strength) {
    const s = clamp(strength / 12, 0.05, 1);
    this.#burst(0.18 + s * 0.25, 500 + s * 900, 0.35 * s);
    this.#tone(70, 0.2, 'sine', 0.3 * s, 0.5);
  }

  backfire() {
    this.#burst(0.08, 700, 0.22, 'bandpass');
  }

  whoosh() {
    this.#burst(0.6, 2200, 0.12, 'highpass');
  }

  fanfare(win) {
    const notes = win ? [523, 659, 784, 1046] : [392, 440, 523];
    notes.forEach((f, i) => setTimeout(() => this.#tone(f, 0.25, 'triangle', 0.12), i * 140));
  }
}
