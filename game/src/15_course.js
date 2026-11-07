/* ============================ LONG LEVELS: COURSE GENERATOR ============================ */
// Every platformer level is one long scrolling course. It is made of chunks of about five obstacles, each
// chunk starting with a checkpoint flag, and it ends with the level's hand-made screen and its door.
// Obstacles come from a catalogue of distinct obstacle designs (KINDS). Inside one level no design is
// used twice. Each level leans on its own families of traps (FLAVOR), gets its own order and its own
// colours (BIOMES), so two levels never play the same. Coordinates below are tiles relative to the chunk.
const TOP_MIN = 10, TOP_MAX = 15, CHUNK = 5;
// chunk seeds replaced after checking every chunk with the auto-solver (easy + insane)
const CHUNK_FIX = {};

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
kind('springLeap', 'springs', .1, 1, { tall: true, launch: true }, G => {
  const x = G.x, w = G.ri(7, 8); G.F(x, 1); G.L.spring(null, x, G.t - 1); G.pit(x + 1, w); G.x += 1 + w;
});
kind('springPit', 'springs', .2, 2, { tall: true, launch: true }, G => {
  const x = G.x; G.pit(x, 3); G.L.block(null, x + 3, G.t, 1, 18 - G.t); G.L.spring(null, x + 3, G.t - 1); G.pit(x + 4, 6); G.x += 10;
});
// --- gravity orbs
kind('orbCeilRun', 'gravity', .1, 2, { tall: true, need: 'grav', ceil: true }, G => {
  const w = 8, x = G.x; G.L.block(null, x - .5, 0, w + 1, 3.5, { ceil: true }); G.F(x, 1); G.pit(x + 1, w - 1);
  G.L.orb(G.id(), x + .5, G.t - .6); G.L.spikes(null, x + 4, 3.5, 1, 'down'); G.L.orb(G.id(), x + w - .5, 3.9); G.F(x + w, 5); G.x += w + 5;
});
kind('orbFloorSpikes', 'gravity', .3, 2, { tall: true, need: 'grav', ceil: true }, G => {
  const x = G.x; G.F(x, 11); G.L.spikes(null, x + 2, G.t - 1, 6, 'up'); G.L.block(null, x - .5, 0, 12, 3.5, { ceil: true });
  G.L.orb(G.id(), x + 1, G.t - .6); G.L.orb(G.id(), x + 9, 3.9); G.x += 11;
});
// --- moving platforms and moving hazards
kind('movingBridge', 'movers', .1, 2, { wait: true }, G => {
  const w = 7 + (G.k > .5 ? 1 : 0), x = G.x; G.pit(x, w);
  G.L.block(G.id(), x + 1, G.t - 1, 2, .6, { patrol: [[x + 1, G.t - 1], [x + w - 3, G.t - 1]], speed: 2 + G.k }); G.x += w;
});
kind('elevatorUp', 'movers', .2, 2, { tall: true, wait: true, can: t => t - 4 >= TOP_MIN }, G => {
  const x = G.x; G.pit(x, 5); G.L.block(G.id(), x + 1.5, G.t, 2, .6, { patrol: [[x + 1.5, G.t], [x + 1.5, G.t - 4]], speed: 1.8 + G.k });
  G.x += 5; G.t -= 4;
});
kind('liftDown', 'movers', .25, 2, { tall: true, wait: true, can: t => t + 4 <= TOP_MAX }, G => {
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
kind('fallSpikeGap', 'falling', .3, 2, { tall: true, wait: true, ceil: true }, G => {
  const w = 3, x = G.x, id = G.id(); G.L.block(null, x - 1, 0, w + 2, 2, { ceil: true }); G.L.spikes(id, x, 2, w, 'down');
  G.L.trig(x - 3, 0, .5, 18, () => { G.L.fall(id, .05); G.L.sfx('crack'); }); G.pit(x, w); G.x += w;
});
// --- ceilings
kind('crusher', 'ceiling', .05, 1, { tall: true, ceil: true }, G => {
  const x = G.x, id = G.id(); G.F(x, 5); G.L.block(null, x, 0, 5, 2.5, { ceil: true });
  G.L.block(id, x + 1.5, 2.5, 2, 2, { fallV: 150 }); G.L.spikes(null, x + 1.5, 4.5, 2, 'down', { parent: id });
  G.L.trig(x - .7, 2.5, .5, 15, () => { G.L.fall(id, .3); G.L.sfx('rumble'); }); G.x += 5;
});
kind('spikeRain', 'ceiling', .15, 2, { tall: true, ceil: true }, G => {
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
kind('wheel', 'saws', .35, 3, { tall: true, wait: true }, G => {
  const x = G.x; G.F(x, 8);
  G.L.saw(G.id(), x + 4, G.t - 3.6, .55, { orbit: { rad: 3, w: (1.5 + G.k) * (G.r() < .5 ? 1 : -1), ph: G.r() * 6.28 } }); G.x += 8;
});
kind('sawRail', 'saws', .15, 2, { wait: true }, G => {
  const w = 3 + (G.k > .6 ? 1 : 0) + (G.dj ? 1 : 0), x = G.x; G.pit(x, w);
  G.L.saw(G.id(), x + w / 2, 16.2, .55, { patrol: [[x + w / 2, 16.2], [x + w / 2, G.t - 4.4]], speed: 2.2 + G.k * 2 }); G.x += w;
});
kind('orbitPit', 'saws', .3, 2, { tall: true, wait: true }, G => {
  const x = G.x; G.pit(x, 7); G.L.block(null, x + 2.5, G.t - 1.5, 2, .6);
  G.L.saw(G.id(), x + 3.5, G.t - 3.4, .5, { orbit: { rad: 2.1, w: (2 + G.k) * (G.r() < .5 ? 1 : -1), ph: G.r() * 6.28 } }); G.x += 7;
});
kind('plateauSaw', 'saws', .25, 2, { tall: true, can: t => t - 2 >= TOP_MIN }, G => {
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
kind('stairsUp', 'steps', 0, 1, { tall: true, can: t => t - 3 >= TOP_MIN }, G => {
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
kind('towerClimb', 'steps', .3, 2, { tall: true,}, G => {
  const x = G.x; G.F(x, 10); G.L.block(null, x + 1, G.t - 2.2, 2, .6); G.L.block(null, x + 3.5, G.t - 4.2, 2, .6);
  G.L.block(null, x + 6, G.t - 5.5, 2, 5.5); G.x += 10;
});
kind('valleySpikes', 'steps', .1, 1, { can: t => t + 2 <= TOP_MAX }, G => {
  const x = G.x; G.F(x, 6, G.t + 2); G.L.spikes(null, x + 2, G.t + 1, 2, 'up'); G.x += 6;
});
kind('wallSpring', 'springs', .05, 1, { tall: true, launch: true }, G => {
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

/* ---------- 71 more designs built on the newer mechanics (trampolines, wind, low gravity, teleporters,
   blinking blocks, pendulums and wheels, arrows, lava/acid, dash pads, one-way planks, maces, trolls) ---------- */
const LAVA = (G, x, w, o = {}) => G.L.block(null, x, 16.3, w, 2.2, Object.assign({ lava: true, ghost: true }, o));
// trampolines
kind('trampGap', 'bounce', 0, 1, { tall: true,}, G => { const x = G.x; G.L.block(null, x, G.t, 2, 18 - G.t, { bounce: 26 }); G.pit(x + 2, 6); G.x += 8; });
kind('trampWall', 'bounce', 0, 1, { tall: true,}, G => { const x = G.x; G.F(x, 1); G.L.block(null, x + 1, G.t, 2, 18 - G.t, { bounce: 26 }); G.F(x + 3, 5); G.L.block(null, x + 4, G.t - 5, 2, 5); G.x += 8; });
kind('trampChain', 'bounce', .15, 2, { tall: true,}, G => { const x = G.x; G.pit(x, 12); G.L.block(null, x + 3, G.t, 1.5, 18 - G.t, { bounce: 20 }); G.L.block(null, x + 7.5, G.t, 1.5, 18 - G.t, { bounce: 20 }); G.x += 12; });
kind('trapTramp', 'bounce', .2, 2, { tall: true, ceil: true }, G => {
  // a trampoline under spikes: do NOT step on it, jump over it
  const x = G.x; G.F(x, 3); G.L.block(null, x + 3, G.t, 2, 18 - G.t, { bounce: 26 }); G.F(x + 5, 3);
  G.L.block(null, x + 2, 0, 4, G.t - 5, { ceil: true }); G.L.spikes(null, x + 2, G.t - 5, 4, 'down'); G.x += 8;
});
kind('trampLedge', 'bounce', .25, 2, { tall: true,}, G => {
  const x = G.x; G.pit(x, 1); G.L.block(null, x + 1, G.t + 1, 2, 17 - G.t, { bounce: 27 }); G.pit(x + 3, 1); G.F(x + 4, 5, G.t - 4); G.x += 9;
});
kind('bouncePadsSaw', 'bounce', .4, 3, { tall: true, wait: true }, G => {
  const x = G.x; G.pit(x, 12); G.L.block(null, x + 3, G.t, 1.5, 18 - G.t, { bounce: 20 }); G.L.block(null, x + 7.5, G.t, 1.5, 18 - G.t, { bounce: 20 });
  G.L.saw(G.id(), x + 8.25, G.t - 4, .45, { orbit: { rad: 1.6, w: 2 * (G.r() < .5 ? 1 : -1), ph: G.r() * 6.28 } }); G.x += 12;
});
// wind
kind('windGap', 'wind', .1, 2, {}, G => { const x = G.x; G.pit(x, 3); G.L.zone(G.id(), 'wind', x - 1, 0, 5, G.t, { fx: -1.8 }); G.x += 3; });
kind('windAssist', 'wind', 0, 1, {}, G => { const x = G.x; G.pit(x, 6); G.L.zone(G.id(), 'wind', x - 1.5, 0, 9, G.t, { fx: 3.5 }); G.x += 6; });
kind('windUp', 'wind', .2, 2, { tall: true,}, G => { const x = G.x; G.pit(x, 7); G.L.zone(G.id(), 'wind', x + 2.5, G.t - 8, 2, 26 - G.t, { fy: -16 }); G.x += 7; });
kind('geyserTimed', 'wind', .3, 2, { tall: true, wait: true }, G => { const x = G.x; G.pit(x, 8); G.L.zone(G.id(), 'wind', x + 3, G.t - 7, 2, 25 - G.t, { fy: -20, on: 1.4, off: 1.6, ph: G.r() * 2 }); G.x += 8; });
kind('windCorridor', 'wind', .3, 2, { ceil: true }, G => {
  const x = G.x; G.F(x, 9); G.L.block(null, x, 0, 9, G.t - 3.2, { ceil: true }); G.L.zone(G.id(), 'wind', x, G.t - 3.2, 9, 3.2, { fx: -2.5 });
  G.L.spikes(null, x + 3, G.t - 1, 1, 'up'); G.L.spikes(null, x + 6, G.t - 1, 1, 'up'); G.x += 9;
});
kind('windDown', 'wind', .35, 2, {}, G => { const x = G.x; G.pit(x, 3); G.L.zone(G.id(), 'wind', x - .5, 0, 4, G.t, { fy: 12 }); G.x += 3; });
kind('fanTunnel', 'wind', .3, 2, { tall: true,}, G => { const x = G.x; G.F(x, 10); G.L.zone(G.id(), 'wind', x + 2, 0, 2, G.t, { fy: -18 }); G.L.block(null, x + 4, G.t - 7, 2, 7); G.x += 10; });
// low gravity
kind('floatPit', 'float', .15, 1, { tall: true,}, G => { const x = G.x; G.pit(x, 9); G.L.zone(G.id(), 'float', x - 1, 0, 11, 18, { g: .35 }); G.x += 9; });
kind('floatSpikes', 'float', .3, 2, { ceil: true }, G => {
  const x = G.x; G.F(x, 9); G.L.zone(G.id(), 'float', x, 0, 9, G.t, { g: .35 }); G.L.block(null, x, 0, 9, G.t - 5.5, { ceil: true }); G.L.spikes(null, x, G.t - 5.5, 9, 'down');
  G.L.spikes(null, x + 3, G.t - 1, 1, 'up'); G.L.spikes(null, x + 6, G.t - 1, 1, 'up'); G.x += 9;
});
kind('floatTower', 'float', .25, 1, { tall: true,}, G => { const x = G.x; G.F(x, 10); G.L.block(null, x + 4, G.t - 7, 2, 7); G.L.zone(G.id(), 'float', x, 0, 10, G.t, { g: .38 }); G.x += 10; });
// teleporters
kind('warpGap', 'warp', .1, 1, {}, G => {
  const x = G.x, a = G.id(), b = G.id(); G.F(x, 3); G.L.block(null, x + 3, G.t - 9, 4, 9); G.F(x + 7, 4);
  G.L.tele(a, x + 1, G.t - 1.6, b); G.L.tele(b, x + 8.5, G.t - 1.6); G.x += 11;
});
kind('warpUp', 'warp', .2, 2, { tall: true,}, G => {
  const x = G.x, a = G.id(), b = G.id(); G.F(x, 12); G.L.spikes(null, x + 3, G.t - 1, 6, 'up'); G.L.block(null, x + 4, G.t - 6, 5, .6);
  G.L.tele(a, x + 1, G.t - 1.6, b); G.L.tele(b, x + 5.5, G.t - 7.6); G.x += 12;
});
kind('warpPit', 'warp', .3, 2, {}, G => {
  // the only way past the tall wall is to jump INTO the pit, through the glowing portal down there
  const x = G.x, a = G.id(), b = G.id(); G.F(x, 1); G.pit(x + 1, 4); G.F(x + 5, 6); G.L.block(null, x + 5, G.t - 8, 2, 8);
  G.L.tele(a, x + 2.55, G.t + .4, b); G.L.tele(b, x + 8.6, G.t - 1.6); G.x += 11;
});
kind('warpChain', 'warp', .4, 2, {}, G => {
  const x = G.x, a = G.id(), b = G.id(), c = G.id(), d = G.id(); G.F(x, 12);
  G.L.spikes(null, x + 2, G.t - 1, 2.5, 'up'); G.L.spikes(null, x + 7.5, G.t - 1, 3, 'up'); G.L.block(null, x + 4.5, G.t - 1, 3, 1);
  G.L.tele(a, x + .8, G.t - 1.6, b); G.L.tele(b, x + 4.6, G.t - 2.6); G.L.tele(c, x + 6.5, G.t - 2.6, d); G.L.tele(d, x + 10.8, G.t - 1.6); G.x += 12;
});
kind('teleSaw', 'warp', .4, 3, { wait: true }, G => {
  const x = G.x, a = G.id(), b = G.id(); G.F(x, 3); G.L.block(null, x + 3, G.t - 9, 2, 9); G.F(x + 5, 7);
  G.L.tele(a, x + 1, G.t - 1.6, b); G.L.tele(b, x + 5.3, G.t - 1.6);
  G.L.saw(G.id(), x + 9, G.t - .65, .6, { patrol: [[x + 11.2, G.t - .65], [x + 6.6, G.t - .65]], speed: 2.4 + G.k }); G.x += 12;
});
// blinking blocks
kind('blinkBridge', 'blink', .15, 2, { wait: true }, G => {
  const x = G.x, ph = G.r() * 2; G.pit(x, 10);
  for (let i = 0; i < 3; i++) G.L.block(null, x + 1.5 + i * 3, G.t, 2, .6, { blink: { on: 1.6, off: 1, ph: ph + i * .6 } }); G.x += 10;
});
kind('blinkStairs', 'blink', .3, 2, { tall: true, wait: true }, G => {
  const x = G.x, ph = G.r() * 2; G.F(x, 8.5);
  [[1, 1.5], [3.5, 3], [6, 4.5]].forEach(([dx, h], i) => G.L.block(null, x + dx, G.t - h, 2, .6, { blink: { on: 1.8, off: 1, ph: ph + i * .5 } }));
  G.F(x + 8.5, 4, G.t - 4.5); G.x += 12.5;
});
kind('blinkFloor', 'blink', .2, 2, { wait: true }, G => { const x = G.x; G.F(x, 1); G.pit(x + 1, 5); G.L.block(null, x + 1, G.t, 5, 18 - G.t, { blink: { on: 2, off: 1.2, ph: G.r() * 2 } }); G.F(x + 6, 1); G.x += 7; });
kind('blinkWall', 'blink', .25, 2, { wait: true }, G => { const x = G.x; G.F(x, 6); G.L.block(null, x + 2, 0, 2, G.t, { ceil: true, blink: { on: 1.6, off: 1.4, ph: G.r() * 2 } }); G.x += 6; });
// swinging and wheeling platforms / blades
kind('ferris', 'swing', .3, 2, { tall: true, wait: true }, G => {
  const x = G.x, ph = G.r() * 6.28; G.pit(x, 10);
  for (let i = 0; i < 3; i++) G.L.block(null, x + 4, G.t - 3, 2, .5, { orbit: { rad: 2.6, w: .9, ph: ph + i * 2.094 } }); G.x += 10;
});
kind('swingPlat', 'swing', .2, 2, { tall: true, wait: true }, G => { const x = G.x; G.pit(x, 8); G.L.block(null, x + 2.75, G.t - .5, 2.5, .5, { pend: { len: 4, amp: .9, w: 1.6, ph: G.r() * 6.28 } }); G.x += 8; });
kind('swingAxe', 'swing', .25, 2, { wait: true }, G => { const x = G.x; G.F(x, 8); G.L.saw(G.id(), x + 4, G.t - .8, .6, { mace: true, pend: { len: 5, amp: 1.1, w: 2.2, ph: G.r() * 6.28 } }); G.x += 8; });
kind('doubleAxe', 'swing', .4, 3, { wait: true }, G => {
  const x = G.x, ph = G.r() * 6.28; G.F(x, 11);
  G.L.saw(G.id(), x + 3.5, G.t - .8, .6, { mace: true, pend: { len: 5, amp: 1.05, w: 2.1, ph } }); G.L.saw(G.id(), x + 7.5, G.t - .8, .6, { mace: true, pend: { len: 5, amp: 1.05, w: 2.1, ph: ph + Math.PI } }); G.x += 11;
});
kind('orbitPair', 'swing', .45, 3, { wait: true }, G => {
  const x = G.x, ph = G.r() * 6.28; G.pit(x, 13);
  G.L.block(null, x + 2.5, G.t - 2, 2, .5, { orbit: { rad: 1.8, w: 1.1, ph } }); G.L.block(null, x + 8.5, G.t - 2, 2, .5, { orbit: { rad: 1.8, w: -1.1, ph: ph + 1 } }); G.x += 13;
});
// arrows
const ARROW = (G, x0, x1, y, sp, ph) => G.L.spikes(G.id(), x0 - (x0 - x1) * ph, y, 1, x1 < x0 ? 'left' : 'right', { arrow: true, pjump: true, patrol: [[x0, y], [x1, y]], speed: sp });
kind('arrowWall', 'arrows', .2, 2, { wait: true }, G => {
  const x = G.x; G.F(x, 10); G.L.block(null, x + 9.5, G.t - 1.6, 1, 1.6); ARROW(G, x + 8.6, x - 1, G.t - .95, 7 + G.k * 2, 0); ARROW(G, x + 8.6, x - 1, G.t - .95, 7 + G.k * 2, .5); G.x += 10.5;
});
kind('arrowHigh', 'arrows', .3, 2, { wait: true }, G => {
  const x = G.x; G.F(x, 10); G.L.block(null, x + 9.5, G.t - 3.4, 1, 1.6); G.L.spikes(null, x + 4, G.t - 1, 1, 'up'); ARROW(G, x + 8.6, x - 1, G.t - 2.6, 8, G.r()); G.x += 10.5;
});
kind('arrowRain', 'arrows', .3, 2, { tall: true, wait: true }, G => {
  const x = G.x; G.F(x, 9); G.L.block(null, x, 0, 9, 1, { ceil: true });
  [2, 4.5, 7].forEach((c, i) => G.L.spikes(G.id(), x + c, 1 + (G.t - 1) * ((i * .37 + G.r() * .3) % 1), 1, 'down', { arrow: true, pjump: true, patrol: [[x + c, 1], [x + c, G.t + .5]], speed: 9 }));
  G.x += 9;
});
kind('arrowPair', 'arrows', .45, 3, { wait: true }, G => {
  const x = G.x; G.F(x, 11); G.L.block(null, x + 10.5, G.t - 3.4, 1, 3.4); ARROW(G, x + 9.6, x - 1, G.t - .95, 7, 0); ARROW(G, x + 9.6, x - 1, G.t - 2.6, 7, .5); G.x += 11.5;
});
// lava and acid
kind('lavaPit', 'lava', 0, 1, {}, G => { const x = G.x, w = 3 + (G.k > .5 ? 1 : 0); LAVA(G, x, w); G.x += w; });
kind('acidPool', 'lava', .1, 1, {}, G => { const x = G.x; LAVA(G, x, 2, { acid: true }); G.L.block(null, x + 2, G.t - .5, 1, 18.5 - G.t); LAVA(G, x + 3, 2.5, { acid: true }); G.x += 5.5; });
kind('lavaRise', 'lava', .3, 2, { wait: true }, G => {
  const x = G.x; G.L.block(null, x + 2.5, G.t, 1, 18 - G.t); G.L.block(null, x + 5, G.t, 1, 18 - G.t);
  G.L.block(G.id(), x, 16.8, 8, 3, { lava: true, ghost: true, patrol: [[x, 16.8], [x, G.t - .6]], speed: 1.6 }); G.x += 8;
});
kind('lavaSteps', 'lava', .2, 2, {}, G => { const x = G.x; LAVA(G, x, 9); [[2, 0], [4.5, 1], [7, 0]].forEach(([d, h]) => G.L.block(null, x + d, G.t - h, 1, 18.3 - G.t + h)); G.x += 9; });
// dash pads
kind('dashGap', 'dash', .1, 1, {}, G => { const x = G.x; G.F(x, 3); G.L.dash(G.id(), x + .5, G.t - 1); G.pit(x + 3, 7); G.x += 10; });
kind('dashRamp', 'dash', .25, 2, { tall: true,}, G => { const x = G.x; G.F(x, 3); G.L.dash(G.id(), x + .5, G.t - 1); G.pit(x + 3, 5); G.F(x + 8, 3, G.t - 2); G.x += 8; G.t -= 2; });
kind('dashCrusher', 'dash', .35, 2, { ceil: true }, G => {
  const x = G.x, id = G.id(); G.F(x, 12); G.L.dash(G.id(), x + .5, G.t - 1); G.L.block(null, x + 2, 0, 9, 1, { ceil: true });
  G.L.block(id, x + 3, 1, 7, G.t - 6, { ceil: true }); G.L.spikes(null, x + 3, G.t - 5, 7, 'down', { parent: id });
  G.L.trig(x + .3, 0, .5, 18, () => { G.L.move(id, 0, 3.9, 3.2 + G.k * .6, .2); G.L.sfx('rumble'); }); G.x += 12;
});
kind('dashOneway', 'dash', .3, 2, {}, G => {
  const x = G.x; G.F(x, 3); G.L.dash(G.id(), x + .5, G.t - 1); G.pit(x + 3, 10); G.L.block(null, x + 7, G.t - 1.5, 2, .3, { oneway: true }); G.L.block(null, x + 10, G.t - 2.5, 2, .3, { oneway: true }); G.x += 13;
});
// one-way planks
kind('onewayStairs', 'oneway', .05, 1, { tall: true,}, G => {
  const x = G.x; G.F(x, 8.5); [[1, 2], [3.5, 4], [6, 6]].forEach(([d, h]) => G.L.block(null, x + d, G.t - h, 2.5, .3, { oneway: true })); G.F(x + 8.5, 4, G.t - 6); G.x += 12.5;
});
kind('onewayPit', 'oneway', .15, 2, {}, G => { const x = G.x; G.pit(x, 10); [[1.5, 1], [4.5, 2.5], [7.5, 1]].forEach(([d, h]) => G.L.block(null, x + d, G.t - h, 2, .3, { oneway: true })); G.x += 10; });
kind('onewayTrap', 'oneway', .3, 2, {}, G => {
  const x = G.x; G.F(x, 12); G.L.spikes(null, x + 1, G.t - 1, 10, 'up');
  G.L.block(null, x + 1.5, G.t - 2, 2.5, .3, { oneway: true }); G.L.block(null, x + 5, G.t - 3, 2.5, .3, { oneway: true, sink: 1.4 }); G.L.block(null, x + 8.5, G.t - 2, 2.5, .3, { oneway: true }); G.x += 12;
});
// maces
kind('maceFloor', 'maces', .1, 1, {}, G => { const x = G.x; G.F(x, 9); G.L.saw(G.id(), x + 7, G.t - .85, .8, { mace: true, patrol: [[x + 7.5, G.t - .85], [x + 1.5, G.t - .85]], speed: 2.2 + G.k }); G.x += 9; });
kind('maceDrop', 'maces', .2, 2, { tall: true, wait: true }, G => { const x = G.x; G.F(x, 8); G.L.saw(G.id(), x + 4, G.t - 6, .7, { mace: true, patrol: [[x + 4, G.t - 6], [x + 4, G.t - .75]], speed: 4 + G.k * 2 }); G.x += 8; });
kind('maceOrbit', 'maces', .35, 3, { wait: true }, G => {
  const x = G.x, ph = G.r() * 6.28; G.F(x, 10); G.L.block(null, x + 4, G.t - 2, 2, 2);
  G.L.saw(G.id(), x + 5, G.t - 2, .5, { mace: true, orbit: { rad: 2.4, w: 1.6, ph } }); G.L.saw(G.id(), x + 5, G.t - 2, .5, { mace: true, orbit: { rad: 2.4, w: 1.6, ph: ph + Math.PI } }); G.x += 10;
});
// trolls
kind('fakeSpikes', 'trolls', .15, 1, {}, G => {
  // the spikes are fake (walk through them); the landing past them is not a floor
  const x = G.x, id = G.id(); G.F(x, 6); G.L.spikes(null, x + 1, G.t - 1, 5, 'up', { fake: true });
  G.pit(x + 6, 2); G.L.block(id, x + 6, G.t, 2, 18 - G.t, { fallV: 200 });
  G.L.trig(x + 6.05, G.t - 1, .6, 1, () => G.L.fall(id, .35), { ground: true }); G.F(x + 8, 2); G.x += 10;
});
kind('faithBridge', 'trolls', .25, 2, {}, G => {
  // an invisible bridge over the pit appears stone by stone as you walk onto it
  const x = G.x, n = 8; G.pit(x, n);
  for (let i = 0; i < n; i++) { const id = G.id(); G.L.block(id, x + i, G.t, 1, .8, { hidden: true }); G.L.trig(x + i - 1.6, 0, .5, 18, () => G.L.pop(id)); }
  G.x += n;
});
kind('shadeZone', 'trolls', .2, 2, {}, G => {
  const x = G.x; G.F(x, 11); G.L.zone(G.id(), 'shade', x, 0, 11, 18); G.L.spikes(null, x + 3, G.t - 1, 1, 'up'); G.L.spikes(null, x + 7, G.t - 1, 1, 'up');
  G.L.saw(G.id(), x + 5, G.t - 2.6, .45, { patrol: [[x + 2, G.t - 2.6], [x + 9, G.t - 2.6]], speed: 2.2 }); G.x += 11;
});
kind('revZone', 'trolls', .35, 2, { need: 'revz' }, G => {
  const x = G.x; G.F(x, 10); G.L.spikes(null, x + 3, G.t - 1, 1, 'up'); G.L.spikes(null, x + 6.5, G.t - 1, 1, 'up');
  G.L.trig(x + .5, 0, .5, 18, () => { G.L.reverse(true); G.L.say('کنترل‌ها برعکس!'); }); G.L.trig(x + 9.3, 0, .5, 18, () => G.L.reverse(false)); G.x += 10;
});
kind('risingSawPit', 'trolls', .35, 2, {}, G => {
  const x = G.x, id = G.id(); G.pit(x, 3); G.L.saw(id, x + 1.5, 17.6, .6, { hidden: true });
  G.L.trig(x + .2, 0, 2.6, G.t, () => { G.L.pop(id); G.L.move(id, 0, -(17.6 - (G.t - 2.2)), 5); G.L.sfx('saw'); }, { rising: true }); G.x += 3;
});
// more combinations of the classic traps
kind('sawStairs', 'saws', .25, 2, { tall: true, can: t => t - 3 >= TOP_MIN }, G => {
  const x = G.x, t = G.t; G.F(x, 2, t - 1); G.F(x + 2, 2, t - 2); G.F(x + 4, 2, t - 3);
  G.L.saw(G.id(), x + 1, t - 1.65, .5, { patrol: [[x + 1, t - 1.65], [x + 3, t - 2.65], [x + 5, t - 3.65]], speed: 2 + G.k }); G.x += 6; G.t -= 3;
});
kind('crusherRow', 'ceiling', .3, 2, { tall: true, ceil: true }, G => {
  const x = G.x; G.F(x, 11); G.L.block(null, x, 0, 11, 2.5, { ceil: true });
  [1.5, 4.5, 7.5].forEach(d => { const id = G.id(); G.L.block(id, x + d, 2.5, 2, 2, { fallV: 150 }); G.L.spikes(null, x + d, 4.5, 2, 'down', { parent: id }); G.L.trig(x + d - 1.2, 2.5, .5, 15, () => { G.L.fall(id, .25); G.L.sfx('rumble'); }); });
  G.x += 11;
});
kind('pistonGaps', 'movers', .3, 2, { wait: true }, G => {
  const x = G.x, ph = G.r(); G.F(x, 1);
  for (let i = 0; i < 3; i++) {
    const px = x + 1 + i * 3, id = G.id(); G.pit(px, 1.5); G.F(px + 1.5, 1.5);
    const lo = G.t + 2.5, hi = G.t - 2, y0 = lo + (hi - lo) * ((ph + i * .33) % 1);
    G.L.block(id, px, y0, 1.5, 3, { patrol: [[px, lo], [px, hi]], speed: 3 }); G.L.spikes(null, px, y0 - 1, 1.5, 'up', { parent: id });
  }
  G.x += 10;
});
kind('pistonCeiling', 'ceiling', .35, 2, { wait: true, ceil: true }, G => {
  const x = G.x; G.F(x, 9); G.L.block(null, x, 0, 9, 1, { ceil: true });
  [2, 5.5].forEach((d, i) => { const id = G.id(), y0 = i ? 1 : G.t - 4; G.L.block(id, x + d, y0, 1.5, 2, { ceil: true, patrol: [[x + d, 1], [x + d, G.t - 3.2]], speed: 4 }); G.L.spikes(null, x + d, y0 + 2, 1.5, 'down', { parent: id }); });
  G.x += 9;
});
kind('spikeWallSlide', 'movers', .2, 2, {}, G => {
  const x = G.x, id = G.id(); G.F(x, 9); G.L.block(id, x + 7, G.t - 1.4, 1, 1.4, { patrol: [[x + 7.5, G.t - 1.4], [x + 1, G.t - 1.4]], speed: 2.4 + G.k });
  G.L.spikes(null, x + 7, G.t - 2.4, 1, 'up', { parent: id }); G.x += 9;
});
kind('gapCeilSaw', 'saws', .25, 2, { wait: true }, G => { const x = G.x; G.pit(x, 4); G.L.saw(G.id(), x + 2, G.t - 3, .5, { patrol: [[x - 1, G.t - 3], [x + 5, G.t - 3]], speed: 3 + G.k }); G.x += 4; });
kind('pillarSaws', 'saws', .4, 3, { wait: true }, G => {
  const x = G.x; for (let i = 0; i <= 2; i++) G.pit(x + i * 3, 2);
  for (let i = 0; i < 2; i++) { G.L.block(null, x + 2 + i * 3, G.t - 1, 1, 19 - G.t); G.L.saw(G.id(), x + 2.5 + i * 3, G.t - 1, .4, { orbit: { rad: 1.5, w: 1.8 * (i ? -1 : 1), ph: G.r() * 6.28 } }); }
  G.x += 8;
});
kind('elevatorSaw', 'movers', .4, 3, { tall: true, wait: true, can: t => t - 4 >= TOP_MIN }, G => {
  const x = G.x; G.pit(x, 5); G.L.block(G.id(), x + 1.5, G.t, 2, .6, { patrol: [[x + 1.5, G.t], [x + 1.5, G.t - 4]], speed: 1.8 + G.k });
  G.F(x + 5, 6, G.t - 4); G.L.saw(G.id(), x + 7, G.t - 4.65, .5, { patrol: [[x + 6, G.t - 4.65], [x + 10.5, G.t - 4.65]], speed: 2.2 }); G.x += 11; G.t -= 4;
});
kind('crumbleStairs', 'falling', .2, 2, { tall: true,}, G => {
  const x = G.x; G.F(x, 8.5); [[1, 1.5], [3.5, 3], [6, 4.5]].forEach(([d, h]) => G.L.block(null, x + d, G.t - h, 2, .5, { crumble: .55 })); G.F(x + 8.5, 4, G.t - 4.5); G.x += 12.5;
});
kind('sinkingIsles', 'falling', .2, 2, {}, G => { const x = G.x; G.pit(x, 11); for (let i = 0; i < 3; i++) G.L.block(null, x + 1.5 + i * 3, G.t, 2, .8, { sink: 1.6 }); G.x += 11; });
kind('hiddenStairs', 'hidden', .25, 2, { tall: true,}, G => {
  const x = G.x; G.F(x, 8.5);
  [[1, 1.5], [3.5, 3], [6, 4.5]].forEach(([d, h]) => { const id = G.id(); G.L.block(id, x + d, G.t - h, 2, .6, { hidden: true }); G.L.trig(x + d - 1.5, 0, 1, 18, () => G.L.pop(id)); });
  G.F(x + 8.5, 4, G.t - 4.5); G.x += 12.5;
});
kind('spikeTeeth', 'ceiling', .4, 3, { wait: true, ceil: true }, G => {
  const x = G.x, id = G.id(); G.F(x, 9); G.L.spikes(null, x + 2, G.t - 1, 1, 'up'); G.L.spikes(null, x + 5.5, G.t - 1, 1, 'up');
  G.L.block(id, x, 0, 9, G.t - 5, { ceil: true, patrol: [[x, 0], [x, 1.6]], speed: .9 }); G.L.spikes(null, x, G.t - 5, 9, 'down', { parent: id }); G.x += 9;
});
kind('icePlatforms', 'ice', .5, 2, { need: 'ice' }, G => { const x = G.x; G.pit(x, 10); for (let i = 0; i < 3; i++) G.L.block(null, x + 1.5 + i * 3, G.t - (i % 2), 2, .6, { ice: true }); G.x += 10; });
kind('conveyorBridge', 'conveyor', .5, 2, { need: 'conv' }, G => { const x = G.x; G.pit(x, 10); for (let i = 0; i < 2; i++) G.L.block(null, x + 2 + i * 4, G.t, 2.5, .6, { conv: -(2 + G.k) }); G.x += 10; });
kind('gravityZigzag', 'gravity', .3, 2, { tall: true, need: 'grav', ceil: true }, G => {
  const x = G.x; G.F(x, 15); G.L.block(null, x - .5, 0, 16, 3.5, { ceil: true });
  G.L.spikes(null, x + 2, G.t - 1, 5, 'up'); G.L.orb(G.id(), x + 1, G.t - .6); G.L.spikes(null, x + 4.5, 3.5, 1, 'down'); G.L.orb(G.id(), x + 7.5, 3.9);
  G.L.spikes(null, x + 9.5, G.t - 1, 1, 'up'); G.x += 15;
});
kind('orbSaw', 'gravity', .4, 3, { tall: true, need: 'grav', wait: true, ceil: true }, G => {
  const x = G.x; G.F(x, 12); G.L.block(null, x - .5, 0, 13, 3.5, { ceil: true }); G.L.spikes(null, x + 2, G.t - 1, 7, 'up');
  G.L.orb(G.id(), x + 1, G.t - .6); G.L.orb(G.id(), x + 10, 3.9); G.L.saw(G.id(), x + 5, 4.1, .45, { patrol: [[x + 3, 4.1], [x + 8.5, 4.1]], speed: 2 + G.k }); G.x += 12;
});
// lasers (hidden realm)
kind('laserSweep', 'lasers', 0, 2, { need: 'laser', wait: true }, G => {
  // a beam that sweeps back and forth while blinking
  const x = G.x; G.F(x, 10); G.L.laser(G.id(), x + 1, G.t - 6, 6, 'v', { on: 1, off: 1.2, ph: G.r() * 2, patrol: [[x + 1, G.t - 6], [x + 9, G.t - 6]], speed: 1.6 }); G.x += 10;
});
kind('laserGrid', 'lasers', 0, 3, { need: 'laser', wait: true }, G => {
  const x = G.x, ph = G.r() * 2; G.F(x, 9); G.L.spikes(null, x + 4, G.t - 1, 1, 'up');
  G.L.laser(G.id(), x + .5, G.t - 1.5, 8, 'h', { on: .9, off: 1.3, ph }); G.L.laser(G.id(), x + 6.5, G.t - 6, 6, 'v', { on: .9, off: 1.3, ph: ph + 1.1 }); G.x += 9;
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
// every level also leans on one of the newer mechanic families, in turn
const NEWFAM = ['bounce', 'oneway', 'wind', 'lava', 'warp', 'maces', 'dash', 'blink', 'float', 'swing', 'arrows', 'trolls'];

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
  const last = ci === nChunks - 1, cave = opt.cave && ci === opt.caveCi;
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
      const gx = G.x, gt = G.t;
      kd.build(G);
      P.gem((gx + G.x) / 2, Math.min(gt, G.t) - 2.6);
    });
    G.F(G.x, 2); G.x += 2;
    if (last && G.t !== TOP_MAX) { G.t = TOP_MAX; G.F(G.x, 3); G.x += 3; }
    const top = Math.min(...G.fl.map(f => f[2]));
    G.flush();
    const w = G.x;
    if (cave) {
      // underground: a rock ceiling (with stalactites) closes over the whole chunk, with a dark cave wall behind
      const ceil = Math.max(2, top - 6.5), r2 = srand(seed * 77 + 5);
      P.zone('cave', 'cave', 2, 0, w - 3.5, 18);
      P.block(null, 2.5, 0, w - 4.5, ceil, { ceil: true, rock: true });
      for (let c = 4 + r2() * 3; c < w - 4; c += 4 + r2() * 4) P.spikes(null, c, ceil, 1, 'down');
      P.trig(3, 0, .5, 18, () => P.say('راه زیرزمینی! ⛏️'));
    }
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
  return { gen: true, keys, seed, t0, w: m.w, tEnd: m.tEnd, spawn: [1, t0 - 1], cave: !!(opt.cave && ci === opt.caveCi), build: P => { lay(P); } };
}
const caveOk = kd => !kd.tall && !kd.launch && kd.need !== 'grav';
// which levels get an underground stretch: settings 'auto' (a few levels), 'all', 'pick' (chosen levels) or 'off'
const AUTO_CAVE = new Set();
function caveFor(idx) {
  const u = CFG.under || 'auto';
  return u === 'all' ? true : u === 'pick' ? (CFG.underLv || []).includes(idx) : u === 'auto' ? AUTO_CAVE.has(idx) : false;
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
  def.courseOpt = opt;
  const r = srand(opt.seed * 7919 + 13), keys = pickKinds(opt, r);
  opt.n = keys.length;
  const groups = []; for (let i = 0; i < keys.length; i += CHUNK) groups.push(keys.slice(i, i + CHUNK));
  // underground stretch: the middle chunk goes into a cave; designs that need a high ceiling are swapped for cave-friendly ones
  opt.caveCi = Math.floor((groups.length - 1) / 2);
  if (opt.cave) {
    const used = new Set(keys), alt = Object.values(KINDS).filter(kd => caveOk(kd) && !used.has(kd.key) && kd.lvl <= opt.k0 + .12 && (!kd.need || opt[kd.need]) && !(opt.chase && kd.wait));
    groups[opt.caveCi] = groups[opt.caveCi].map(k => { if (caveOk(KINDS[k])) return k; const a = alt.shift(); return a ? a.key : k; });
  }
  const secs = []; let t = TOP_MAX;
  groups.forEach((ks, ci) => {
    const fk = opt.key + ':' + ci + (opt.cave && ci === opt.caveCi ? 'c' : ''), seed = CHUNK_FIX[fk] ?? (opt.seed * 100 + ci);
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
  const nth = LEVELS.slice(0, idx).filter(d => d.kind !== '3d').length;
  if (nth % 6 === 4) AUTO_CAVE.add(idx);
  buildCourse(def, { prev: prevKeys,
    key: 'L' + idx, seed: idx + 1, k0, n: Math.round(20 + idx), pri: (FLAVOR[idx] || ['pits', 'spikes']).concat(NEWFAM[nth % NEWFAM.length]),
    grav: idx >= 10, ice: idx >= 30, conv: idx >= 31, revz: idx >= 13, chase: CHASE_LV[idx] || 0, rev: !!REV_LV[idx], cave: caveFor(idx),
  });
  prevKeys = new Set(def.secs.filter(s => s.gen).flatMap(s => s.keys));
  def.biome = def.biome || BIOME_ORDER[LEVELS.slice(0, idx).filter(d => d.kind !== '3d').length % BIOME_ORDER.length];
});
REALM.forEach((def, ri) => {
  buildCourse(def, {
    key: 'R' + ri, seed: 500 + ri, k0: .82 + ri * .06, n: 48 + ri * 4, revz: true, pri: [['lasers', 'movers'], ['lasers', 'saws'], ['lasers', 'gravity']][ri],
    grav: true, ice: true, conv: true, laser: true, dj: true, chase: 0, rev: false,
  });
});

// the underground setting changed: rebuild the courses (applied when a level starts)
function refreshCaves() {
  LEVELS.forEach((def, idx) => { if (!def.courseOpt) return; const want = caveFor(idx); if (!!def.courseOpt.cave !== want) buildCourse(def, Object.assign({}, def.courseOpt, { cave: want })); });
}
