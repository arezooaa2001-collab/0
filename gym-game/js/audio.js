'use strict';
/* Synthesized sound effects (no audio files needed) */

const Sfx = (() => {
  let ctx = null;
  let master = null;
  let muted = false;
  let noiseBuf = null;
  let crowd = null;

  function init() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.55;
        master.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) {
      ctx = null;
    }
  }

  function ok() { return ctx && !muted && ctx.state === 'running'; }

  function tone(freq, dur, { type = 'sine', vol = 0.25, to = null, delay = 0, attack = 0.005 } = {}) {
    if (!ok()) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noise(dur, { vol = 0.3, freq = 1000, to = null, q = 1, type = 'lowpass', delay = 0, attack = 0.005 } = {}) {
    if (!ok()) return;
    const t0 = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t0);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t0, Math.random());
    s.stop(t0 + dur + 0.05);
  }

  const sounds = {
    click() { tone(660, 0.06, { type: 'triangle', vol: 0.12 }); },
    xp() { tone(880, 0.08, { type: 'square', vol: 0.05 }); tone(1320, 0.1, { type: 'square', vol: 0.04, delay: 0.05 }); },
    levelup() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.18, delay: i * 0.08 }));
      noise(0.6, { vol: 0.08, freq: 6000, type: 'highpass', delay: 0.3 });
    },
    unlock() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.3, { type: 'sine', vol: 0.16, delay: i * 0.06 })); },
    whoosh() { noise(0.35, { vol: 0.22, freq: 400, to: 2500, type: 'bandpass', q: 2, attack: 0.08 }); },
    land() { tone(120, 0.18, { type: 'sine', vol: 0.35, to: 50 }); noise(0.12, { vol: 0.15, freq: 600 }); },
    step() { noise(0.05, { vol: 0.05, freq: 900 }); },
    punch() { noise(0.09, { vol: 0.3, freq: 1600, to: 300 }); tone(90, 0.1, { type: 'sine', vol: 0.25, to: 50 }); },
    clank() { tone(1900, 0.25, { type: 'square', vol: 0.05 }); tone(1300, 0.3, { type: 'triangle', vol: 0.08 }); },
    slam() {
      tone(70, 0.45, { type: 'sine', vol: 0.6, to: 30 });
      noise(0.35, { vol: 0.4, freq: 900, to: 120 });
    },
    bell() { [1568, 2093, 3136].forEach((f, i) => tone(f, 1.4, { type: 'sine', vol: 0.18 - i * 0.04 })); },
    hammer() { tone(160, 0.2, { type: 'sine', vol: 0.5, to: 60 }); noise(0.15, { vol: 0.3, freq: 2000, to: 400 }); },
    whistle() {
      if (!ok()) return;
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 2600;
      lfo.frequency.value = 38;
      lg.gain.value = 140;
      lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
      g.gain.setValueAtTime(0.2, t0 + 0.42);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      o.connect(g).connect(master);
      o.start(t0); lfo.start(t0);
      o.stop(t0 + 0.55); lfo.stop(t0 + 0.55);
    },
    cheer() { noise(1.8, { vol: 0.25, freq: 900, q: 0.7, type: 'bandpass', attack: 0.25 }); noise(1.4, { vol: 0.1, freq: 2600, q: 1, type: 'bandpass', attack: 0.2, delay: 0.1 }); },
    groan() { noise(1.2, { vol: 0.14, freq: 500, to: 250, q: 0.8, type: 'bandpass', attack: 0.2 }); },
    tick() { tone(1000, 0.07, { type: 'square', vol: 0.08 }); },
    go() { tone(523, 0.15, { type: 'square', vol: 0.1 }); tone(1046, 0.35, { type: 'square', vol: 0.1, delay: 0.12 }); },
    success() { tone(660, 0.12, { type: 'triangle', vol: 0.18 }); tone(990, 0.2, { type: 'triangle', vol: 0.18, delay: 0.08 }); },
    fail() { tone(300, 0.25, { type: 'sawtooth', vol: 0.08, to: 150 }); },
    error() { tone(220, 0.12, { type: 'square', vol: 0.08 }); tone(180, 0.18, { type: 'square', vol: 0.08, delay: 0.1 }); },
    win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.16, delay: i * 0.13 })); },
    lose() { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.14, delay: i * 0.18 })); },
    tap() { tone(rand(300, 380), 0.05, { type: 'triangle', vol: 0.09 }); },
  };

  return {
    init,
    play(name) { try { if (sounds[name]) sounds[name](); } catch (e) { /* ignore audio failures */ } },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.55;
    },
    isMuted() { return muted; },
    crowd(on, level = 0.05) {
      try {
        if (!ctx || !noiseBuf) return;
        if (on && !crowd) {
          const s = ctx.createBufferSource();
          s.buffer = noiseBuf;
          s.loop = true;
          const f = ctx.createBiquadFilter();
          f.type = 'bandpass';
          f.frequency.value = 700;
          f.Q.value = 0.5;
          const g = ctx.createGain();
          g.gain.value = 0.0001;
          s.connect(f).connect(g).connect(master);
          s.start();
          crowd = { s, g };
        }
        if (crowd) crowd.g.gain.setTargetAtTime(on ? level : 0.0001, ctx.currentTime, 0.4);
        if (!on && crowd) {
          const c = crowd;
          crowd = null;
          setTimeout(() => { try { c.s.stop(); } catch (e) { /* already stopped */ } }, 1500);
        }
      } catch (e) { /* ignore */ }
    },
  };
})();
