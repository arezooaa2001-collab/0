// Headless simulation tests: tracks for all stages, physics sanity, AI lap completion,
// reward table. Run with: node tests/sim.test.mjs
import assert from 'node:assert/strict';
import { STAGES, CARS, tunedPhysics, coinsForRank, THEMES, emptyUpgrades } from '../js/core/config.js';
import { Track } from '../js/game/track.js';
import { Vehicle, collideVehicles, collideWalls } from '../js/game/physics.js';
import { AIDriver } from '../js/game/ai.js';
import { RNG } from '../js/core/utils.js';

const realism = { bodyMotion: true, drafting: true, loadSensitivity: true, shiftTime: 0.12, roadBumps: false, damage: false, tireTemperature: false, dirtyAir: false };

// rewards: exactly what the player asked for
assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 20].map(coinsForRank), [100, 50, 10, 5, 2, 0, 0, 0]);

let t0 = performance.now();
const tracks = STAGES.map((s) => new Track(s));
console.log(`generated ${tracks.length} tracks in ${(performance.now() - t0).toFixed(0)} ms`);
tracks.forEach((t, i) => {
  assert.ok(!t.fallback, `stage ${i} used fallback track`);
  assert.ok(t.length > 900 && t.length < 6000, `stage ${i} length ${t.length}`);
  for (let k = 0; k < t.n; k++) assert.ok(Number.isFinite(t.px[k] + t.pz[k] + t.py[k] + t.kappa[k]));
});
console.log('lengths:', tracks.map((t) => Math.round(t.length)).join(' '));

function runRace(stageIndex, carCount, seconds, carIdx = 0, upg = 0) {
  const stage = STAGES[stageIndex];
  const track = tracks[stageIndex];
  const theme = THEMES[stage.theme];
  const env = { track, roadGrip: theme.roadGrip, offGrip: theme.offGrip, weatherGrip: 1, realism, assists: 2 };
  const rng = new RNG(5);
  const cars = [];
  for (let k = 0; k < carCount; k++) {
    const def = CARS[carIdx];
    const u = emptyUpgrades(); for (const key in u) u[key] = upg;
    const v = new Vehicle(tunedPhysics(def, u), def.body);
    const p = track.pointAt(track.length - 10 - Math.floor(k / 2) * 8, (k % 2 ? -1 : 1) * 3);
    v.reset(p.x, p.z, p.heading, p.y);
    const ai = new AIDriver(v, track, { skill: 0.95, rng, roadGrip: theme.roadGrip, weatherGrip: 1 });
    cars.push({ v, ai, progress: -10 - Math.floor(k / 2) * 8, lastS: null });
  }
  const dt = 1 / 240;
  let contacts = 0, wallHits = 0, maxSpeed = 0;
  const vs = cars.map((c) => c.v);
  for (let step = 0; step < seconds / dt; step++) {
    const time = step * dt;
    for (const c of cars) {
      c.ai.update(dt, vs, { started: true, time, raceTime: time, playerProgress: cars[0].progress, myProgress: c.progress });
      c.v.step(dt, env);
    }
    contacts += collideVehicles(vs);
    for (const c of cars) {
      if (collideWalls(c.v, track)) wallHits++;
      const s = c.v.proj.s;
      if (c.lastS !== null) {
        let ds = s - c.lastS;
        if (ds < -track.length / 2) ds += track.length;
        if (ds > track.length / 2) ds -= track.length;
        c.progress += ds;
      }
      c.lastS = s;
      maxSpeed = Math.max(maxSpeed, c.v.speed);
      assert.ok(Number.isFinite(c.v.x + c.v.z + c.v.vx + c.v.vz + c.v.yawRate), 'NaN in vehicle state');
    }
  }
  return { cars, contacts, wallHits, maxSpeed, track };
}

// single car laps on a few tracks
for (const si of [0, 7, 14, 21, 29]) {
  t0 = performance.now();
  const ci = Math.min(6, Math.floor(si / 5) + 1);
  const r = runRace(si, 1, 150, ci, 3);
  const prog = r.cars[0].progress;
  const laps = prog / r.track.length;
  const avg = prog / 150;
  console.log(`stage ${si + 1} (${CARS[ci].id}) solo: laps ${laps.toFixed(2)}, avg ${(avg * 3.6).toFixed(0)} km/h, max ${(r.maxSpeed * 3.6).toFixed(0)} km/h, wall-steps ${r.wallHits}, stuck ${r.cars[0].ai.stuckCount || 0}  [${(performance.now() - t0).toFixed(0)}ms]`);
  assert.ok(laps > 1, `AI could not complete a lap on stage ${si}`);
}

// full field
t0 = performance.now();
const field = runRace(3, 20, 120, 0, 1);
const progs = field.cars.map((c) => c.progress / field.track.length);
console.log(`20-car field: min laps ${Math.min(...progs).toFixed(2)} max ${Math.max(...progs).toFixed(2)} contacts ${field.contacts} stuck ${field.cars.reduce((a, c) => a + (c.ai.stuckCount || 0), 0)} [${(performance.now() - t0).toFixed(0)}ms]`);
assert.ok(Math.min(...progs) > 0.8, 'some AI cars got stuck in the pack');

// difficulty balance: a good driver in the starter car (stock) should usually podium on stage 1
function balanceRace(seed) {
  const stage = STAGES[0];
  const track = tracks[0];
  const theme = THEMES[stage.theme];
  const env = { track, roadGrip: theme.roadGrip, offGrip: theme.offGrip, weatherGrip: 1, realism, assists: 2 };
  const rng = new RNG(stage.seed ^ 0x51ed);
  const entries = [];
  for (let k = 0; k < 19; k++) {
    const def = CARS[rng.int(stage.ai.carMin, stage.ai.carMax)];
    const u = emptyUpgrades(); for (const key in u) u[key] = rng.int(stage.ai.upgMin, stage.ai.upgMax);
    const phys = tunedPhysics(def, u);
    const skill = Math.min(0.98, Math.max(0.68, stage.ai.skill + rng.range(-0.035, 0.03)));
    entries.push({ def, phys, skill, pace: skill * (1 + phys.powerKW / phys.mass) });
  }
  entries.sort((a, b) => b.pace - a.pace);
  entries.splice(9, 0, { def: CARS[0], phys: tunedPhysics(CARS[0], emptyUpgrades()), skill: 0.95, player: true });
  const L = track.length;
  const cars = entries.map((e, slot) => {
    const v = new Vehicle(e.phys, e.def.body); v.assists = 2;
    const g = track.gridSlot(slot); const p = track.pointAt(g.s, g.d);
    v.reset(p.x, p.z, p.heading, p.y); v.hint = p.index; v.step(0, env);
    return { v, ai: new AIDriver(v, track, { skill: e.skill, rng: new RNG(slot * 13 + seed * 101), roadGrip: 1, weatherGrip: 1 }), progress: -g.back, lastS: v.proj.s, player: !!e.player };
  });
  const vs = cars.map((c) => c.v);
  const pl = cars.find((c) => c.player);
  const dt = 1 / 120;
  for (let s = 0; s < 260 / dt; s++) {
    if (s % 2 === 0) for (const c of cars) c.ai.update(1 / 60, vs, { started: true, time: s * dt, raceTime: s * dt, playerProgress: pl.progress, myProgress: c.progress });
    for (const v of vs) v.step(dt, env);
    collideVehicles(vs);
    for (const c of cars) {
      collideWalls(c.v, track);
      let ds = c.v.proj.s - c.lastS; if (ds < -L / 2) ds += L; if (ds > L / 2) ds -= L;
      c.progress += ds; c.lastS = c.v.proj.s;
    }
    if (pl.progress > stage.laps * L) break;
  }
  return [...cars].sort((a, b) => b.progress - a.progress).indexOf(pl) + 1;
}
const ranks = [1, 2, 3, 4, 5].map(balanceRace).sort((a, b) => a - b);
console.log('stage-1 balance (autopilot, stock starter car) ranks:', ranks.join(' '));
assert.ok(ranks[2] <= 4, 'median rank on stage 1 should be a podium-ish result');
console.log('ALL SIM TESTS PASSED');
