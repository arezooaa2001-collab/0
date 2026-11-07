/* ============================ LONG LEVELS: COURSE GENERATOR ============================ */
// Every platformer level is one long scrolling course. It is made of chunks of about five obstacles, each
// chunk starting with a checkpoint flag, and it ends with the level's hand-made screen and its door.
// Obstacles come from a catalogue of distinct obstacle designs (KINDS). Inside one level no design is
// used twice. Each level leans on its own families of traps (FLAVOR), gets its own order and its own
// colours (BIOMES), so two levels never play the same. Coordinates below are tiles relative to the chunk.
const TOP_MIN = 10, TOP_MAX = 15, CHUNK = 5;
// chunk seeds replaced after checking every chunk with the auto-solver (easy + insane)
const CHUNK_FIX = { 'L17:4': 2804, 'L33:4': 5404 };

/* ---------- obstacle catalogue ----------
   fam: family; lvl: unlocks at this level progress (0..1); df: base difficulty 1..3; can(t): needs floor top t;
   need: 'grav' | 'ice' | 'conv' | 'laser'; wait: needs waiting/timing (left out of chase levels);
   ceil: has a ceiling; launch: throws the player high (never followed directly by a ceiling obstacle). */
const KINDS = {};
function kind(key, fam, lvl, df, o, build) { KINDS[key] = Object.assign({ key, fam, lvl, df, build }, o); }

// --- pits and gaps
kind('gapPlain', 'pits', 0, 1, {}, G => { const w = G.ri(2, 3 + (G.k > .45 ? 1 : 0)) + (G.dj ? 2 : 0); G.pit(G.x, w); G.x += w; });
kind('gapUp', 'pits', 0, 1, { can: t => t - 1 >= TOP_MIN }, G => {
  const dh = G.t - 2 >= TOP_MIN && G.r() < .5 ? 2 : 1, w = G.ri(2, 3) + (G.dj ? 1 : 0); G.pit(G.x, w); G.x += w; G.t -= dh;
});
kind('gapDown', 'pits', 0, 1, { can: t => t + 1 <= TOP_MAX }, G => {
  const dh = Math.min(TOP_MAX - G.t, G.ri(1, 3)), w = G.ri(2, 4) + (G.dj ? 2 : 0); G.pit(G.x, w); G.x += w; G.t += dh;
});
kind('stoneHop', 'pits', 0, 1, {}, G => {
  const a = G.ri(2, 3), b = G.ri(2, 3) + (G.k > .5 ? 1 : 0), top = G.t - (G.r() < .5 ? 1 : 0), x = G.x;
  G.pit(x, a); G.L.block(null, x + a, top, 1, 18 - top); G.pit(x + a + 1, b); G.x += a + 1 + b;
});
kind('islands', 'pits', .05, 2, {}, G => {
  const n = 2 + (G.k > .45 ? 1 : 0), span = n * 4 + 2, x = G.x; G.pit(x, span);
  for (let i = 0; i < n; i++) G.L.block(null, x + 2 + i * 4, G.t - 1 - (i % 2) - (G.k > .6 && i === n - 1 ? 1 : 0), 2, .6);
  G.x += span;
});
kind('lowJump', 'ceiling', .2, 2, { ceil: true }, G => {
  // a spiked ceiling hangs over a short gap: only a flat jump gets across
  const w = G.ri(2, 3), x = G.x, top = G.t - 4; G.F(x, 2); G.pit(x + 2, w); G.F(x + 2 + w, 3);
  G.L.block(null, x, 0, w + 5, top, { ceil: true }); G.L.spikes(null, x, top, w + 5, 'down'); G.x += w + 5;
});
kind('hiddenLanding', 'hidden', .1, 2, {}, G => {
  // the landing grows a spike while you are in the air
  const w = 3 + (G.dj ? 1 : 0), x = G.x, id = G.id(); G.pit(x, w); G.F(x + w, 5);
  G.L.spikes(id, x + w + 1, G.t - 1, 1, 'up', { hidden: true }); G.L.trig(x + .3, 0, w - .6, G.t, () => G.L.pop(id), { rising: true });
  G.x += w + 5;
});
kind('dropLanding', 'falling', .1, 2, {}, G => {
  // land on a stone that sinks away: jump on at once
  const x = G.x, id = G.id(); G.pit(x, 6);
  G.L.block(id, x + 2, G.t, 2, 18 - G.t, { fallV: 200 }); G.L.trig(x + 2, G.t - 1, 2, 1, () => { G.L.fall(id, .32); G.L.sfx('rumble'); }, { ground: true });
  G.x += 6;
});
kind('ghostLanding', 'hidden', .2, 2, {}, G => { const x = G.x; G.pit(x, 4); G.L.block(null, x + 2, G.t, 2, 18 - G.t, { ghost: true }); G.x += 4; });
kind('springLeap', 'springs', .1, 1, { launch: true }, G => {
  const x = G.x, w = G.ri(7, 8); G.F(x, 1); G.L.spring(null, x, G.t - 1); G.pit(x + 1, w); G.x += 1 + w;
});
kind('springPit', 'springs', .2, 2, { launch: true }, G => {
  const x = G.x; G.pit(x, 3); G.L.block(null, x + 3, G.t, 1, 18 - G.t); G.L.spring(null, x + 3, G.t - 1); G.pit(x + 4, 6); G.x += 10;
});
// --- gravity orbs
kind('orbCeilRun', 'gravity', .1, 2, { need: 'grav', ceil: true }, G => {
  const w = 8, x = G.x; G.L.block(null, x - .5, 0, w + 1, 3.5, { ceil: true }); G.F(x, 1); G.pit(x + 1, w - 1);
  G.L.orb(G.id(), x + .5, G.t - .6); G.L.spikes(null, x + 4, 3.5, 1, 'down'); G.L.orb(G.id(), x + w - .5, 3.9); G.F(x + w, 5); G.x += w + 5;
});
kind('orbFloorSpikes', 'gravity', .3, 2, { need: 'grav', ceil: true }, G => {
  const x = G.x; G.F(x, 11); G.L.spikes(null, x + 2, G.t - 1, 6, 'up'); G.L.block(null, x - .5, 0, 12, 3.5, { ceil: true });
  G.L.orb(G.id(), x + 1, G.t - .6); G.L.orb(G.id(), x + 9, 3.9); G.x += 11;
});
// --- moving platforms and moving hazards
kind('movingBridge', 'movers', .1, 2, { wait: true }, G => {
  const w = 7 + (G.k > .5 ? 1 : 0), x = G.x; G.pit(x, w);
  G.L.block(G.id(), x + 1, G.t - 1, 2, .6, { patrol: [[x + 1, G.t - 1], [x + w - 3, G.t - 1]], speed: 2 + G.k }); G.x += w;
});
kind('elevatorUp', 'movers', .2, 2, { wait: true, can: t => t - 4 >= TOP_MIN }, G => {
  const x = G.x; G.pit(x, 5); G.L.block(G.id(), x + 1.5, G.t, 2, .6, { patrol: [[x + 1.5, G.t], [x + 1.5, G.t - 4]], speed: 1.8 + G.k });
  G.x += 5; G.t -= 4;
});
kind('liftDown', 'movers', .25, 2, { wait: true, can: t => t + 4 <= TOP_MAX }, G => {
  const x = G.x; G.pit(x, 5); G.L.block(G.id(), x + 1.5, G.t, 2, .6, { patrol: [[x + 1.5, G.t], [x + 1.5, G.t + 4]], speed: 1.8 + G.k });
  G.x += 5; G.t += 4;
});
kind('spikeBlockPatrol', 'movers', .2, 2, {}, G => {
  const x = G.x; G.F(x, 9); G.L.spikes(G.id(), x + 7, G.t - 1, 1, 'up', { patrol: [[x + 7, G.t - 1], [x + 1.5, G.t - 1]], speed: 2 + G.k * 1.5 }); G.x += 9;
});
// --- falling floors
kind('dropFloor', 'falling', 0, 1, {}, G => {
  const w = 2 + Math.floor(G.r() * (1.5 + G.k)), x = G.x, id = G.id(); G.pit(x, w);
  G.L.block(id, x, G.t, w, 18 - G.t, { fallV: 200 }); G.L.trig(x + .05, G.t - 1, .6, 1, () => { G.L.fall(id, .05); G.L.sfx('rumble'); }, { ground: true }); G.x += w;
});
kind('crumbleBridge', 'falling', .1, 2, {}, G => {
  const n = 2 + (G.k > .5 ? 1 : 0), w = n * 4 + 2, x = G.x; G.pit(x, w);
  for (let i = 0; i < n; i++) G.L.block(null, x + 2 + i * 4, G.t - 1, 2, .5, { crumble: .5 - G.k * .1 });
  G.x += w;
});
kind('collapseRun', 'falling', .25, 2, {}, G => {
  // a long bridge collapses behind you, stone after stone: keep running
  const n = 7 + (G.k > .5 ? 2 : 0), x = G.x, ids = []; G.pit(x, n);
  for (let i = 0; i < n; i++) { const id = G.id(); ids.push(id); G.L.block(id, x + i, G.t, 1, .8, { fallV: 80 }); }
  G.L.trig(x, G.t - 1, 1, 1, () => { ids.forEach((id, i) => G.L.fall(id, .3 + i * .14)); G.L.sfx('rumble'); G.L.shake(3); }, { ground: true });
  G.x += n;
});
kind('fallSpikeGap', 'falling', .3, 2, { wait: true, ceil: true }, G => {
  const w = 3, x = G.x, id = G.id(); G.L.block(null, x - 1, 0, w + 2, 2, { ceil: true }); G.L.spikes(id, x, 2, w, 'down');
  G.L.trig(x - 3, 0, .5, 18, () => { G.L.fall(id, .05); G.L.sfx('crack'); }); G.pit(x, w); G.x += w;
});
// --- ceilings
kind('crusher', 'ceiling', .05, 1, { ceil: true }, G => {
  const x = G.x, id = G.id(); G.F(x, 5); G.L.block(null, x, 0, 5, 2.5, { ceil: true });
  G.L.block(id, x + 1.5, 2.5, 2, 2, { fallV: 150 }); G.L.spikes(null, x + 1.5, 4.5, 2, 'down', { parent: id });
  G.L.trig(x - .7, 2.5, .5, 15, () => { G.L.fall(id, .3); G.L.sfx('rumble'); }); G.x += 5;
});
kind('spikeRain', 'ceiling', .15, 2, { ceil: true }, G => {
  const x = G.x; G.F(x, 10); G.L.block(null, x, 0, 10, 2, { ceil: true });
  [2, 5, 8].forEach((c, i) => { const id = G.id(); G.L.spikes(id, x + c, 2, 1 + (G.k > .6 && i === 1 ? 1 : 0), 'down'); G.L.trig(x + c - 2.2, 0, .5, 18, () => { G.L.fall(id, .1); G.L.sfx('crack'); }); });
  G.x += 10;
});
kind('lowCeil', 'ceiling', .3, 2, { ceil: true }, G => {
  const x = G.x; G.F(x, 7); G.L.block(null, x, 0, 7, G.t - 4.4, { ceil: true }); G.L.spikes(null, x, G.t - 4.4, 7, 'down');
  G.L.spikes(null, x + 3, G.t - 1, 1, 'up'); G.x += 7;
});
kind('closingCeiling', 'ceiling', .3, 3, { ceil: true }, G => {
  // a spiked ceiling starts to come down as you walk in: run through before it closes
  const x = G.x, id = G.id(); G.F(x, 6); G.L.block(null, x, 0, 6, 1, { ceil: true });
  G.L.block(id, x + 1, 1, 4, G.t - 6, { ceil: true }); G.L.spikes(null, x + 1, G.t - 5, 4, 'down', { parent: id });
  G.L.trig(x - .5, 0, .5, 18, () => { G.L.move(id, 0, 3.9, 2.4 + G.k * .6, .25); G.L.sfx('rumble'); G.L.shake(3); }); G.x += 6;
});
kind('tunnelSaw', 'saws', .3, 3, { wait: true, ceil: true }, G => {
  const x = G.x; G.F(x, 9); G.L.block(null, x, 0, 9, G.t - 2.7, { ceil: true });
  G.L.saw(G.id(), x + 2, G.t - .5, .45, { patrol: [[x + 1.2, G.t - .5], [x + 7.8, G.t - .5]], speed: 2.2 + G.k }); G.x += 9;
});
// --- saws
kind('sawFloor', 'saws', 0, 1, {}, G => {
  const w = 5 + Math.floor(G.r() * 2), x = G.x; G.F(x, w);
  G.L.saw(G.id(), x + 1, G.t - .65, .6, { patrol: [[x + .8, G.t - .65], [x + w - .8, G.t - .65]], speed: 2.4 + G.k * 1.8 }); G.x += w;
});
kind('twinSaws', 'saws', .2, 2, { wait: true }, G => {
  const x = G.x, sp = 2.4 + G.k * 1.5; G.F(x, 11);
  G.L.saw(G.id(), x + 1.5, G.t - .65, .6, { patrol: [[x + 1, G.t - .65], [x + 5, G.t - .65]], speed: sp });
  G.L.saw(G.id(), x + 9.5, G.t - .65, .6, { patrol: [[x + 10, G.t - .65], [x + 6, G.t - .65]], speed: sp }); G.x += 11;
});
kind('sawHead', 'saws', .2, 2, { wait: true }, G => {
  const x = G.x; G.F(x, 8); G.L.spikes(null, x + 4, G.t - 1, 1, 'up');
  G.L.saw(G.id(), x + 1, G.t - 2.4, .55, { patrol: [[x + 1, G.t - 2.4], [x + 7, G.t - 2.4]], speed: 2.4 + G.k }); G.x += 8;
});
kind('wheel', 'saws', .35, 3, { wait: true }, G => {
  const x = G.x; G.F(x, 8);
  G.L.saw(G.id(), x + 4, G.t - 3.6, .55, { orbit: { rad: 3, w: (1.5 + G.k) * (G.r() < .5 ? 1 : -1), ph: G.r() * 6.28 } }); G.x += 8;
});
kind('sawRail', 'saws', .15, 2, { wait: true }, G => {
  const w = 3 + (G.k > .6 ? 1 : 0) + (G.dj ? 1 : 0), x = G.x; G.pit(x, w);
  G.L.saw(G.id(), x + w / 2, 16.2, .55, { patrol: [[x + w / 2, 16.2], [x + w / 2, G.t - 4.4]], speed: 2.2 + G.k * 2 }); G.x += w;
});
kind('orbitPit', 'saws', .3, 2, { wait: true }, G => {
  const x = G.x; G.pit(x, 7); G.L.block(null, x + 2.5, G.t - 1.5, 2, .6);
  G.L.saw(G.id(), x + 3.5, G.t - 3.4, .5, { orbit: { rad: 2.1, w: (2 + G.k) * (G.r() < .5 ? 1 : -1), ph: G.r() * 6.28 } }); G.x += 7;
});
kind('plateauSaw', 'saws', .25, 2, { can: t => t - 2 >= TOP_MIN }, G => {
  const x = G.x, top = G.t - 2; G.F(x, 1); G.F(x + 1, 8, top);
  G.L.saw(G.id(), x + 2, top - .65, .6, { patrol: [[x + 1.8, top - .65], [x + 8.2, top - .65]], speed: 2.2 + G.k }); G.x += 9;
});
// --- spikes on the ground
kind('spikeStrip', 'spikes', 0, 1, {}, G => { const n = 1 + (G.r() < .35 + G.k * .4 ? 1 : 0), x = G.x; G.F(x, n + 1); G.L.spikes(null, x, G.t - 1, n, 'up'); G.x += n + 1; });
kind('doubleSpike', 'spikes', 0, 1, {}, G => {
  const a = 1 + (G.r() < G.k ? 1 : 0), w = a * 2 + 3, x = G.x; G.F(x, w);
  G.L.spikes(null, x + 1, G.t - 1, a, 'up'); G.L.spikes(null, x + 2 + a, G.t - 1, a, 'up'); G.x += w;
});
kind('risingWave', 'spikes', .25, 2, {}, G => {
  // spikes burst out of the ground one after another right behind you
  const x = G.x, ids = []; G.F(x, 10); G.L.spikes(null, x + 5, G.t - 1, 1, 'up');
  for (let i = 0; i < 9; i++) { if (i === 5) continue; const id = G.id(); ids.push([i, id]); G.L.spikes(id, x + i, G.t - 1, 1, 'up', { hidden: true }); }
  G.L.trig(x + .3, G.t - 2, .5, 2, () => { G.L.sfx('rumble'); ids.forEach(([i, id]) => G.L.at(.32 + i * .12, () => G.L.pop(id))); }, { ground: true });
  G.x += 10;
});
// --- invisible traps
kind('hiddenPop', 'hidden', 0, 1, {}, G => {
  const n = 1 + (G.r() < .5 ? 1 : 0), x = G.x, id = G.id(); G.F(x, n + 2);
  G.L.spikes(id, x + 1, G.t - 1, n, 'up', { hidden: true }); G.L.trig(x - .5, G.t - 1.5, .5, 1.5, () => G.L.pop(id), { ground: true }); G.x += n + 2;
});
kind('bumpBlock', 'hidden', .2, 2, {}, G => {
  const x = G.x, id = G.id(); G.F(x, 6); G.L.spikes(null, x + 3, G.t - 1, 1, 'up');
  G.L.block(id, x + 2.5, G.t - 4.5, 2, 1, { hidden: true }); G.L.trig(x + 2, G.t - 3.5, 3, 1.2, () => G.L.pop(id), { rising: true }); G.x += 6;
});
kind('ghostFloor', 'hidden', .15, 1, {}, G => {
  const w = 2 + Math.floor(G.r() * 2), x = G.x; G.pit(x, w); G.L.block(null, x, G.t, w, 18 - G.t, { ghost: true }); G.x += w;
});
kind('wallHidden', 'hidden', .1, 1, {}, G => {
  const x = G.x; G.F(x, 5); G.L.block(null, x + 1.5, G.t - 2, 2, 2);
  if (G.k > .3) { const id = G.id(); G.L.spikes(id, x + 2, G.t - 3, 1, 'up', { hidden: true }); G.L.trig(x + 1.5, G.t - 3.5, 2, 1.5, () => G.L.pop(id), { ground: true }); }
  G.x += 5;
});
// --- steps, towers, valleys
kind('stepUpSpike', 'steps', 0, 1, { can: t => t - 2 >= TOP_MIN }, G => { const x = G.x; G.F(x, 1); G.L.spikes(null, x, G.t - 1, 1, 'up'); G.x += 1; G.t -= 2; });
kind('stairsUp', 'steps', 0, 1, { can: t => t - 3 >= TOP_MIN }, G => {
  const x = G.x; G.F(x, 2, G.t - 1); G.F(x + 2, 2, G.t - 2); if (G.k > .3) G.L.spikes(null, x + 3, G.t - 3, 1, 'up'); G.x += 4; G.t -= 3;
});
kind('stairsDown', 'steps', 0, 1, { can: t => t + 2 <= TOP_MAX }, G => {
  const x = G.x; G.F(x, 2, G.t + 1); G.F(x + 2, 2, G.t + 2); if (G.k > .25) G.L.spikes(null, x + 2, G.t + 1, 1, 'up'); G.x += 4; G.t += 2;
});
kind('pillarHop', 'steps', 0, 2, {}, G => {
  const n = 2 + (G.r() < .3 + G.k * .5 ? 1 : 0), w = n * 3 + 2, x = G.x;
  for (let i = 0; i <= n; i++) G.pit(x + i * 3, 2);
  for (let i = 0; i < n; i++) { const top = G.t - 1 - (i % 2); G.L.block(null, x + 2 + i * 3, top, 1, 18 - top); }
  G.x += w;
});
kind('towerClimb', 'steps', .3, 2, {}, G => {
  const x = G.x; G.F(x, 10); G.L.block(null, x + 1, G.t - 2.2, 2, .6); G.L.block(null, x + 3.5, G.t - 4.2, 2, .6);
  G.L.block(null, x + 6, G.t - 5.5, 2, 5.5); G.x += 10;
});
kind('valleySpikes', 'steps', .1, 1, { can: t => t + 2 <= TOP_MAX }, G => {
  const x = G.x; G.F(x, 6, G.t + 2); G.L.spikes(null, x + 2, G.t + 1, 2, 'up'); G.x += 6;
});
kind('wallSpring', 'springs', .05, 1, { launch: true }, G => {
  const x = G.x; G.F(x, 7); G.L.spring(null, x + .8, G.t - 1); G.L.block(null, x + 3.6, G.t - 6, 2, 6); G.x += 7;
});
// --- slippery and moving floors (unlocked by their own levels)
kind('iceSpikes', 'ice', .5, 2, { need: 'ice' }, G => { const x = G.x; G.L.block(null, x, G.t, 6, 18 - G.t, { ice: true }); G.L.spikes(null, x + 3, G.t - 1, 1, 'up'); G.x += 6; });
kind('iceTakeoff', 'ice', .5, 2, { need: 'ice' }, G => { const x = G.x; G.L.block(null, x, G.t, 6, 18 - G.t, { ice: true }); G.pit(x + 6, 3 + (G.dj ? 1 : 0)); G.x += 9 + (G.dj ? 1 : 0); });
kind('conveyorSpikes', 'conveyor', .5, 2, { need: 'conv' }, G => {
  const x = G.x; G.L.block(null, x, G.t, 6, 18 - G.t, { conv: -(2.5 + G.k * 1.5) }); G.L.spikes(null, x + 3, G.t - 1, 1, 'up'); G.x += 6;
});
kind('conveyorTakeoff', 'conveyor', .5, 2, { need: 'conv' }, G => {
  const x = G.x; G.L.block(null, x, G.t, 5, 18 - G.t, { conv: -(2 + G.k) }); G.pit(x + 5, 3); G.x += 8;
});
// --- lasers (hidden realm only)
kind('laserGate', 'lasers', 0, 2, { need: 'laser', wait: true }, G => {
  const x = G.x; G.F(x, 4); G.L.laser(G.id(), x + 2, G.t - 6.5, 6.5, 'v', { on: .9 + G.k * .3, off: 1.5 - G.k * .3, ph: G.r() * 2 }); G.x += 4;
});
kind('laserHurdle', 'lasers', 0, 2, { need: 'laser', wait: true }, G => {
  const x = G.x; G.F(x, 7); G.L.spikes(null, x + 3, G.t - 1, 1, 'up'); G.L.laser(G.id(), x + .5, G.t - 1.6, 6, 'h', { on: 1, off: 1.4, ph: G.r() * 2 }); G.x += 7;
});
kind('laserTwin', 'lasers', 0, 3, { need: 'laser', wait: true }, G => {
  const x = G.x, ph = G.r() * 2; G.pit(x, 6);
  // the second beam goes off a moment after the first: cross on the 'green wave'
  G.L.laser(G.id(), x + 2, G.t - 6, 6, 'v', { on: .7, off: 1.3, ph }); G.L.laser(G.id(), x + 4, G.t - 6, 6, 'v', { on: .7, off: 1.3, ph: ph - .35 }); G.x += 6;
});

/* ---------- per-level flavour (which families a level leans on), by position in LEVELS ---------- */
const FLAVOR = {
  0: ['falling', 'pits'], 2: ['hidden', 'spikes'], 3: ['steps', 'hidden'], 5: ['ceiling', 'pits'], 6: ['falling', 'saws'], 7: ['springs', 'steps'],
  8: ['pits', 'spikes'], 10: ['gravity', 'pits'], 11: ['saws', 'steps'], 12: ['hidden', 'falling'], 13: ['pits', 'spikes'], 15: ['ceiling', 'falling'],
  16: ['movers', 'pits'], 17: ['hidden', 'steps'], 18: ['saws', 'ceiling'], 20: ['steps', 'hidden'], 21: ['saws', 'movers'], 22: ['gravity', 'hidden'],
  23: ['falling', 'pits'], 25: ['springs', 'hidden'], 26: ['movers', 'saws'], 27: ['springs', 'pits'], 28: ['spikes', 'pits'], 30: ['ice', 'pits'],
  31: ['conveyor', 'saws'], 32: ['ceiling', 'falling'], 33: ['saws', 'movers'], 35: ['movers', 'falling'], 36: ['springs', 'hidden'], 37: ['falling', 'steps'],
  38: ['hidden', 'saws'],
};
const CHASE_LV = { 8: 3.7, 28: 3.5 }, REV_LV = { 13: 1, 28: 1 };

/* ---------- colour schemes: every level looks different ---------- */
const BIOMES = {
  dusk:    { n: 'غروب بنفش', sky: '#3a1c5e', block: '#2f2858', moss: '#4fd8a8' },
  forest:  { n: 'جنگل شب', sky: '#1d4a3c', block: '#2a4426', moss: '#9be05a' },
  desert:  { n: 'بیابان', sky: '#7a3a22', block: '#5a3a24', moss: '#ffc46a' },
  ice:     { n: 'یخچال', sky: '#1d4677', block: '#2c4a70', moss: '#c8f4ff' },
  volcano: { n: 'آتشفشان', sky: '#5c1616', block: '#3e1c1c', moss: '#ff8a3d' },
  toxic:   { n: 'مرداب سمی', sky: '#284a16', block: '#26321e', moss: '#c6ff3a' },
  ocean:   { n: 'اعماق', sky: '#0b3c6c', block: '#16385a', moss: '#3cf0e0' },
  candy:   { n: 'آب‌نبات', sky: '#7a3a9a', block: '#5c3480', moss: '#ff9ae0' },
  gold:    { n: 'طلایی', sky: '#5a4012', block: '#3c3020', moss: '#ffd36e' },
  storm:   { n: 'طوفان', sky: '#2c3346', block: '#2a2f3e', moss: '#a8c4e6' },
  crimson: { n: 'شب سرخ', sky: '#4e1030', block: '#3a1832', moss: '#ff6f9a' },
  aurora:  { n: 'شفق', sky: '#0f3040', block: '#1c2c44', moss: '#7af7c8' },
};
const BIOME_ORDER = ['dusk', 'forest', 'desert', 'ice', 'crimson', 'toxic', 'ocean', 'gold', 'volcano', 'aurora', 'candy', 'storm'];

/* ---------- generation ---------- */
function mkG(P, r, t0, dj) {
  return {
    L: P, r, k: 0, dj, x: 0, t: t0, n: 0, fl: [],
    id() { return 'k' + this.n++; },
    ri(a, b) { return a + Math.floor(this.r() * (b - a + 1)); },
    F(x, w, top = this.t) { if (w > 0) this.fl.push([x, x + w, top]); },
    pit(x, w) { if (w > 0) this.L.spikes(null, x, 17, w, 'up'); },
    flush() {
      // plain floor pieces of the same height that touch are merged into long blocks
      this.fl.sort((a, b) => a[0] - b[0]); const m = [];
      for (const f of this.fl) { const l = m[m.length - 1]; if (l && l[2] === f[2] && f[0] <= l[1] + 1e-6) l[1] = Math.max(l[1], f[1]); else m.push(f.slice()); }
      for (const [a, b, top] of m) this.L.block(null, a, top, b - a, 18 - top);
    },
  };
}
const NOP = new Proxy({}, { get: () => () => null });
// lays out one chunk; called once with a dummy builder (to measure it) and then every time the level is built
function chunkLayout(keys, seed, t0, opt, ci, nChunks) {
  const last = ci === nChunks - 1;
  return P => {
    const r = srand(seed * 9973 + 7), G = mkG(P, r, t0, opt.dj);
    G.F(0, 3); G.x = 3;
    keys.forEach((key, i) => {
      const kd = KINDS[key], pos = (ci * CHUNK + i) / Math.max(1, opt.n - 1);
      G.k = clamp(opt.k0 * .85 + pos * .3, 0, 1);
      // bring the floor to the nearest height this obstacle can be built at (a drop going down, steps going up)
      if (kd.can && !kd.can(G.t)) {
        let best = null; for (let tt = TOP_MIN; tt <= TOP_MAX; tt++) if (kd.can(tt) && (best === null || Math.abs(tt - G.t) < Math.abs(best - G.t))) best = tt;
        if (best !== null) while (G.t !== best) { G.F(G.x, 2); G.x += 2; G.t = best > G.t ? best : Math.max(best, G.t - 2); }
      }
      const pad = 1 + (r() < .35 ? 1 : 0) + (opt.k0 < .15 ? 1 : 0) + (i > 0 && KINDS[keys[i - 1]].launch ? 2 : 0);
      G.F(G.x, pad); G.x += pad;
      kd.build(G);
    });
    G.F(G.x, 2); G.x += 2;
    if (last && G.t !== TOP_MAX) { G.t = TOP_MAX; G.F(G.x, 3); G.x += 3; }
    G.flush();
    const w = G.x;
    if (opt.chase) {
      // a spiked wall wakes up behind you at the start of the chunk and chases you to its end
      P.block('cw', -7, 0, 6, 15, { hidden: true }); P.spikes('cws', -1, 0, 15, 'right', { parent: 'cw', hidden: true });
      P.trig(3.5, 0, .5, 18, () => { P.pop('cw'); P.pop('cws'); P.move('cw', w + 2, 0, opt.chase + G.k * .6, .5); P.sfx('rumble'); P.shake(6); P.say('فرار کن!'); });
    }
    if (opt.rev && ci % 2 === 1) {
      P.trig(3.5, 0, .5, 18, () => { P.reverse(true); P.say('کنترل‌ها برعکس شد!'); });
      P.trig(w - 1.2, 0, .5, 18, () => P.reverse(false));
    }
    return { w, tEnd: G.t };
  };
}
function makeChunk(keys, seed, t0, opt, ci, nChunks) {
  const lay = chunkLayout(keys, seed, t0, opt, ci, nChunks), m = lay(NOP);
  return { gen: true, keys, seed, t0, w: m.w, tEnd: m.tEnd, spawn: [1, t0 - 1], build: P => { lay(P); } };
}
function pickKinds(opt, r) {
  const ok = kd => kd.lvl <= opt.k0 + .12 && (!kd.need || opt[kd.need]) && !(opt.chase && kd.wait);
  const avail = Object.values(KINDS).filter(ok);
  // designs used by the previous level are strongly avoided, so neighbouring levels feel different
  const wOf = kd => (opt.pri[0] === kd.fam ? 3.4 : opt.pri.includes(kd.fam) ? 2.4 : 1) * (.6 + r() * .8) * (opt.prev && opt.prev.has(kd.key) ? .22 : 1);
  const pool = avail.map(kd => ({ kd, w: wOf(kd), s: r() * 1.7 })), out = [];
  // each level uses about 70% of the designs it may use, so neighbouring levels draw different sets
  const n = Math.min(Math.round(pool.length * .72), opt.n);
  while (out.length < n) {
    let tot = 0; for (const q of pool) tot += q.w;
    let x = r() * tot, j = 0; while (j < pool.length - 1 && (x -= pool[j].w) > 0) j++;
    out.push(pool.splice(j, 1)[0]);
  }
  // easier designs first; then avoid two of the same family in a row and a ceiling right after a launch
  out.sort((a, b) => (a.kd.df + a.s) - (b.kd.df + b.s));
  const bad = (a, b) => a.kd.fam === b.kd.fam || (a.kd.launch && b.kd.ceil);
  // the level opens with one of its own signature traps
  const sig = out.findIndex(q => q.kd.fam === opt.pri[0] && q.kd.df <= 2);
  if (sig > 0) out.unshift(out.splice(sig, 1)[0]);
  for (let pass = 0; pass < 3; pass++) for (let i = 1; i < out.length; i++) if (bad(out[i - 1], out[i])) {
    for (let j = i + 1; j < out.length; j++) if (!bad(out[i - 1], out[j]) && (i + 1 >= out.length || !bad(out[j], out[i + 1]))) { [out[i], out[j]] = [out[j], out[i]]; break; }
  }
  return out.map(q => q.kd.key);
}
function buildCourse(def, opt) {
  const r = srand(opt.seed * 7919 + 13), keys = pickKinds(opt, r);
  opt.n = keys.length;
  const groups = []; for (let i = 0; i < keys.length; i += CHUNK) groups.push(keys.slice(i, i + CHUNK));
  const secs = []; let t = TOP_MAX;
  groups.forEach((ks, ci) => {
    const fk = opt.key + ':' + ci, seed = CHUNK_FIX[fk] ?? (opt.seed * 100 + ci);
    const c = makeChunk(ks, seed, t, opt, ci, groups.length); secs.push(c); t = c.tEnd;
  });
  // the hand-made screen closes the level
  secs.push({ hand: true, w: 32, t0: TOP_MAX, spawn: def.spawn, build: def.build });
  def.secs = secs; def.nObs = keys.length; def.course = opt;
  def.relayout = () => { let x = 0; for (const s of def.secs) { s.x0 = x; x += s.w; } def.width = x; };
  def.remakeChunk = (ci, seed) => { const c = def.secs[ci]; def.secs[ci] = makeChunk(c.keys, seed, c.t0, opt, ci, groups.length); def.relayout(); };
  def.relayout();
}
let prevKeys = null;
LEVELS.forEach((def, idx) => {
  if (def.kind === '3d') return;
  const k0 = idx / 39;
  buildCourse(def, { prev: prevKeys,
    key: 'L' + idx, seed: idx + 1, k0, n: Math.round(18 + idx * .9), pri: FLAVOR[idx] || ['pits', 'spikes'],
    grav: idx >= 10, ice: idx >= 30, conv: idx >= 31, chase: CHASE_LV[idx] || 0, rev: !!REV_LV[idx],
  });
  prevKeys = new Set(def.secs.filter(s => s.gen).flatMap(s => s.keys));
  def.biome = def.biome || BIOME_ORDER[LEVELS.slice(0, idx).filter(d => d.kind !== '3d').length % BIOME_ORDER.length];
});
REALM.forEach((def, ri) => {
  buildCourse(def, {
    key: 'R' + ri, seed: 500 + ri, k0: .82 + ri * .06, n: 40 + ri * 5, pri: [['lasers', 'movers'], ['lasers', 'saws'], ['lasers', 'gravity']][ri],
    grav: true, ice: true, conv: true, laser: true, dj: true, chase: 0, rev: false,
  });
});
