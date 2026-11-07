/* ============================ MAIN LOOP ============================ */
const sv = loadSave();
app.prog = sv.prog || {}; app.diff = clamp(sv.diff ?? 1, 0, DIFFS.length - 1);
if (sv.stats) { Object.assign(ST, sv.stats); ST.ach = Object.assign({}, sv.stats.ach || {}); }
{ const pr = app.prog[app.diff] || {}; app.unlocked = clamp(pr.unlocked || 1, 1, LEVELS.length); app.completed = pr.completed || 0; }
renderDiffs();
if (sv.sound === false) Sound.on = false;
soundLabel();
resize(); buildTextures(ctx); applyMood(); setBiome(LEVELS[0].biome);
Perf.cb = () => { resize(); resize3(); applyMood(); app.dirty = true; };
addEventListener('resize', () => { resize(); resize3(); app.dirty = true; });
app.world = new World(0, { silent: true });
let last = performance.now(), acc = 0, clock = 0, saveT = 0;
function drawView(dt) {
  const v = (app.state === 'title' || app.state === 'end') ? 'p2' : app.view;
  if (v === 'p25' && app.world) render25(app.world, clock, dt);
  else if (v === 'p3') { if (app.p3) app.p3.render(dt, clock); }
  else if (v === 'r2') { if (app.run) drawRun2D(app.run, clock, dt); }
  else if (v === 'r25') { if (app.run) drawRunPseudo(app.run, clock, dt); }
  else if (v === 'x3') { if (app.run) app.run.render(dt); }
  else render(app.world, clock, dt);
}
function frame(now) {
  const raw = (now - last) / 1000, dt = Math.min(0.1, raw); last = now; clock += dt;
  Perf.tick(raw, app.state === 'play' && !document.hidden);
  wxTick(dt, app.state === 'play' && !document.hidden);
  if (trans) { trans.t += dt; if (trans.t >= trans.dur) { const cb = trans.cb; trans = null; if (cb) cb(); } }
  if (app.state === 'play') {
    acc += dt; const inp = readInput(); let n = 0;
    if (app.kind === 'run' && app.run) { while (acc >= STEP && n < 14) { app.run.update(STEP, inp); acc -= STEP; n++; } }
    else if (app.world) { const sp = app.world.D.speed; while (acc >= STEP && n < 14) { app.world.step(STEP * sp, inp); acc -= STEP; n++; } }
    if (n >= 14) acc = 0;
    app.levelT += dt; ST.time += dt;
  } else if (app.state === 'title' && app.world) {
    app.world.step(dt, { left: false, right: false, jump: false });
  } else acc = 0;
  if (app.state !== 'pause' || trans || app.dirty) { drawView(dt); app.dirty = false; }
  if (app.kind === 'run' && app.run && app.state === 'play') hud3(app.run);
  hudTick();
  if ((saveT += dt) > 15) { saveT = 0; if (app.state === 'play') writeSave(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
