/* ============================ TEST HOOK ============================ */
// Deterministic headless simulation used for verifying each level is beatable.
window.TRAPLAND = {
  LEVELS,
  sim3(idx, diff = 1, maxT = 1200) {
    const run = new Run3D(LEVELS[idx], diff, { headless: true }); let deaths = 0, minGap = 1e9, hits = 0, t = 0;
    run.onDeath = c => { deaths++; run.lastCause = c; }; run.onStumble = () => hits++;
    while (t < maxT) { run.update(STEP, bot3(run)); t += STEP; if (run.state === 'run') minGap = Math.min(minGap, run.gapNow()); if (run.state === 'win' || deaths) break; }
    return { won: run.state === 'win', died: deaths ? run.lastCause : null, t: +t.toFixed(1), s: Math.round(run.p.s), len: run.len, minGap: +minGap.toFixed(1), hits, obs: run.obs.length };
  },
  sim(idx, script, diff = 1) {
    const w = new World(idx, { silent: true, diff }); let t = 0, won = false, died = null;
    w.onWin = () => { won = true; }; w.onDeath = c => { died = died || c; };
    for (const [dur, k] of script) {
      const inp = { left: k.includes('l'), right: k.includes('r'), jump: k.includes('j') };
      for (let s = 0; s < Math.round(dur / STEP); s++) { w.step(STEP * w.D.speed, inp); t += STEP; if (died || w.state === 'win') break; }
      if (died || w.state === 'win') break;
    }
    for (let s = 0; s < 200 && w.state === 'win'; s++) w.step(STEP, { left: false, right: false, jump: false });
    return { won, died, t: +t.toFixed(2), x: Math.round(w.p.x), y: Math.round(w.p.y), state: w.state };
  },
  probe(idx, script) {
    const w = new World(idx, { silent: true }); const out = [];
    for (const [dur, k] of script) { const inp = { left: k.includes('l'), right: k.includes('r'), jump: k.includes('j') };
      for (let s = 0; s < Math.round(dur / STEP); s++) { w.step(STEP, inp); } out.push([Math.round(w.p.x), Math.round(w.p.y), w.state]); }
    return out;
  }
};
