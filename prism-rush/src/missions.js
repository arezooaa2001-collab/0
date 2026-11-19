// Missions (story / side / character / hidden / special stages) and races (circuit, sprint, sky, rail, underground,
// rival, time trial, tournament) with countdowns, checkpoints, AI rivals, positions, medals, local leaderboards, ghosts.
import * as THREE from 'three';
import { G, bus } from './game.js';
import { clamp, lerp, damp, fmtTime } from './util.js';
import { heightAt } from './world/terrain.js';
import { ANCHORS } from './world/content.js';
import { Path } from './world/level.js';
import { addXP, TOTALS } from './progress.js';
import { createRig } from './characters.js';

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
const P3 = (x, z, y) => [x, y ?? null, z];

export const RACES = {
  r_meadow: { type: 'circuit', laps: 2, rivals: ['ember', 'lumi', 'pip'], cps: [P3(-60, 140), P3(40, 200), P3(120, 150), P3(120, 60), P3(40, 40), P3(-40, 60)] },
  r_rival: { type: 'rival', laps: 2, rivals: ['vex'], cps: [P3(-60, 140), P3(40, 200), P3(120, 150), P3(120, 60), P3(40, 40), P3(-40, 60)], skill: 1.08 },
  r_desert: { type: 'sprint', laps: 1, rivals: ['ember', 'rook'], cps: [P3(520, 260), P3(600, 300), P3(560, 420), P3(500, 520), P3(470, 600)] },
  r_sky: { type: 'sky', laps: 1, rivals: [], cps: [P3(120, -120, 231), P3(165, -150, 239), P3(210, -130, 247), P3(245, -170, 259), P3(230, -215, 271), P3(185, -235, 285)] },
  r_city: { type: 'circuit', laps: 2, rivals: ['vex', 'zara', 'ember'], cps: Array.from({ length: 8 }, (_, i) => P3(680 + Math.cos(i / 8 * Math.PI * 2) * 222, -560 + Math.sin(i / 8 * Math.PI * 2) * 222)) },
  r_rail: { type: 'rail', laps: 1, rivals: [], cps: [P3(-388, 607), P3(-340, 520), P3(-290, 440), P3(-240, 360), P3(-200, 300)] },
  r_canyon: { type: 'underground', laps: 1, rivals: ['rook', 'pip'], cps: [P3(-620, -300), P3(-640, -460), P3(-622, -515), P3(-660, -705), P3(-640, -860)] },
  r_time: { type: 'time', laps: 1, rivals: [], cps: [P3(40, -10), P3(200, 0), P3(350, 30), P3(560, 40), P3(640, 80)] },
};
export const TOURNAMENT = ['r_meadow', 'r_desert', 'r_city'];

// type, anchor/start, params, reward rings, requirements
export const MISSIONS = [
  { id: 'm1', story: 1, type: 'reach', at: [10, -30], target: [120, 205], time: 45, reward: 150 },
  { id: 'm2', story: 1, type: 'collect', at: [-20, 30], count: 100, time: 90, reward: 250, req: ['m1'] },
  { id: 'm3', story: 1, type: 'rescue', at: [-150, 60], count: 5, time: 90, reward: 300, req: ['m2'] },
  { id: 'm4', story: 1, type: 'boss', boss: 'titan', at: [240, -190], reward: 0, req: ['m3'] },
  { id: 'm5', story: 1, type: 'race', race: 'r_rival', at: [-50, 130], reward: 400, req: ['m4'] },
  { id: 'm6', story: 1, type: 'explore', at: [600, 140], beacons: [[700, 230], [800, 40], [580, 330]], time: 120, reward: 400, req: ['m5'] },
  { id: 'm7', story: 1, type: 'boss', boss: 'wyrm', at: [470, 590], reward: 0, req: ['m6'] },
  { id: 'm8', story: 1, type: 'puzzle', at: [-800, 340], reward: 500, req: ['m6'] },
  { id: 'm9', story: 1, type: 'race', race: 'r_sky', at: [124, -116, 231], reward: 500, req: ['m8'] },
  { id: 'm10', story: 1, type: 'boss', boss: 'vex', at: [-300, -390], reward: 0, req: ['m9'] },
  { id: 'm11', story: 1, type: 'boss', boss: 'kraken', at: [-80, -880, 1.3], reward: 0, req: ['m7'] },
  { id: 'm12', story: 1, type: 'boss', boss: 'regent', at: [20, 870, 30], reward: 0, req: ['m4', 'm7', 'm10', 'm11'] },
  { id: 's1', type: 'speed', at: [40, -20], kmh: 250, time: 60, reward: 300 },
  { id: 's2', type: 'combat', at: [-540, -200], count: 12, time: 70, reward: 350, wave: ['crawler', 'jumper', 'drone', 'stealth'] },
  { id: 's3', type: 'race', race: 'r_desert', at: [515, 250], reward: 350 },
  { id: 's4', type: 'race', race: 'r_city', at: [890, -560, 16], reward: 450, req: ['m5'] },
  { id: 's5', type: 'platform', at: [-640, 400], anchor: 'towerTop', time: 70, reward: 400 },
  { id: 's6', type: 'race', race: 'r_rail', at: [-392, 612], reward: 350 },
  { id: 's7', type: 'race', race: 'r_canyon', at: [-615, -290], reward: 450 },
  { id: 's8', type: 'rescue', at: [130, 1000, 9.5], count: 5, tag: 'lab', time: 120, reward: 500 },
  { id: 's9', type: 'storm', at: [40, 900, 30], time: 45, reward: 600, req: ['m7'] },
  { id: 's10', type: 'boost', at: [60, -40], seconds: 20, time: 60, reward: 300 },
  { id: 's11', type: 'race', race: 'r_time', at: [30, -16], reward: 250 },
  { id: 's12', type: 'tournament', at: [-70, 150], reward: 1500, req: ['m5'] },
  { id: 'c_zara', char: 'zara', type: 'homing', at: [-30, -90], count: 5, time: 60, reward: 400 },
  { id: 'c_pip', char: 'pip', type: 'reach', at: [124, -125, 231], target: [185, -235, 285], time: 60, reward: 400 },
  { id: 'c_rook', char: 'rook', type: 'smash', at: [-680, 290], count: 4, time: 60, reward: 400 },
  { id: 'c_lumi', char: 'lumi', type: 'platform', at: [750, 10], anchor: 'lumiTop', time: 50, reward: 400 },
  { id: 'c_vex', char: 'vex', type: 'combat', at: [300, -260], count: 8, time: 40, reward: 500, wave: ['crawler', 'roller', 'shield'] },
  { id: 'c_ember', char: 'ember', type: 'reach', at: [600, 300], target: [430, 690, 108], time: 70, reward: 500 },
  { id: 'h1', hidden: 'waterfall', type: 'collectShard', at: [-650, 120], shard: 'shard_0', time: 90, reward: 600 },
  { id: 'h2', hidden: 'moon', type: 'collect', at: [-1735, 15, 650], count: 30, time: 60, reward: 800, req: ['h1'] },
  { id: 'sp0', special: 0, type: 'special', count: 70, time: 50, reward: 500 },
  { id: 'sp1', special: 1, type: 'special', count: 75, time: 50, reward: 500 },
  { id: 'sp2', special: 2, type: 'special', count: 80, time: 50, reward: 500 },
];
TOTALS.missions = MISSIONS.length;
TOTALS.races = Object.keys(RACES).length;
TOTALS.bosses = 5;

function atVec(a) { return a.length === 3 ? new THREE.Vector3(a[0], a[2], a[1]) : new THREE.Vector3(a[0], heightAt(a[0], a[1]), a[1]); }

export class Missions {
  constructor(scene) {
    this.scene = scene; this.active = null; this.markers = []; this.gates = []; this.rivals = []; this.ghost = null; this.tour = null;
    this.beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd21a, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.beaconMatSide = new THREE.MeshBasicMaterial({ color: 0x5ad8ff, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.targetMat = new THREE.MeshBasicMaterial({ color: 0x4aff8a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.gateMat = new THREE.MeshBasicMaterial({ color: 0x5ad8ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    this.gateNext = new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    this.targetBeacon = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 400, 16, 1, true), this.targetMat); this.targetBeacon.visible = false; scene.add(this.targetBeacon);
    bus.on('giantRing', (o) => this.startSpecial(o.id));
    bus.on('collect', (c) => { if (this.active && this.active.def.type === 'collectShard' && c.key === this.active.def.shard) this.complete(); });
    bus.on('regionEnter', (r) => { if (r.id === 'moon') G.save.flags.seenMoon = 1; });
    bus.on('ring', (n) => { if (this.active) this.active.rings += n; });
    bus.on('enemyKilled', (e) => { if (this.active) this.active.kills++; });
    bus.on('critter', (c) => { if (this.active && this.active.def.type === 'rescue' && (!this.active.def.tag || c.tag === this.active.def.tag)) this.active.freed++; });
    bus.on('break', (k) => { if (this.active && k === 'rock') this.active.smashed++; });
    bus.on('homing', () => { if (this.active) this.active.homing++; });
    bus.on('puzzle', () => { if (this.active && this.active.def.type === 'puzzle') this.complete(); });
    bus.on('death', () => { if (this.active && this.active.def.type === 'storm') { this.fail('fail_storm'); } });
  }
  available(m) {
    const s = G.save;
    if (m.special !== undefined) return false;
    if (m.req && !m.req.every((r) => s.missions[r] && s.missions[r].done)) return false;
    if (m.hidden === 'waterfall' && !(s.regions.forest)) return false;
    if (m.hidden === 'moon' && !s.flags.seenMoon) return false;
    return true;
  }
  buildMarkers() {
    for (const mk of this.markers) this.scene.remove(mk.mesh);
    this.markers = [];
    for (const m of MISSIONS) {
      if (!this.available(m)) continue;
      const p = atVec(m.at); const done = G.save.missions[m.id] && G.save.missions[m.id].done;
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, done ? 30 : 80, 16, 1, true), m.story ? this.beaconMat : this.beaconMatSide);
      mesh.position.copy(p).y += done ? 15 : 40; mesh.material = m.story ? this.beaconMat : this.beaconMatSide;
      if (done) { mesh.material = mesh.material.clone(); mesh.material.opacity = 0.1; }
      this.scene.add(mesh); this.markers.push({ m, p, mesh });
    }
  }
  nearMarker(pl) { let best = null, bd = 4.5; for (const mk of this.markers) { const d = mk.p.distanceTo(pl.pos); if (d < bd) { bd = d; best = mk; } } return best; }
  interact(pl) {
    if (this.active) return false;
    const mk = this.nearMarker(pl); if (!mk) return false;
    G.ui.missionBrief(mk.m); return true;
  }
  promptKey(pl) { if (this.active) return null; const mk = this.nearMarker(pl); return mk ? 'prompt_mission' : null; }

  // ---------------------------------------------------------------- start / run / finish
  start(m, teleport) {
    if (this.active) this.abort(true);
    if (m.char && G.save.char !== m.char) { if (!G.save.unlocked.includes(m.char)) { G.hud.toast('char_locked', 'warn'); return; } G.switchCharacter(m.char); }
    const diff = G.settings.gameplay.mission; const tm = diff === 'easy' ? 1.35 : diff === 'hard' ? 0.8 : 1;
    const start = m.at ? atVec(m.at) : G.player.pos.clone();
    if (teleport && m.at) G.player.spawn(start.clone().add(new THREE.Vector3(0, 0.5, 0)), G.player.facingYaw ?? 0);
    const a = this.active = { def: m, t: 0, limit: m.time ? m.time * tm : 0, rings: 0, kills: 0, freed: 0, smashed: 0, homing: 0, boost: 0, startPos: start, target: null, beacons: null, step: 0 };
    G.level.checkpoint = { pos: start.clone(), yaw: 0 };
    switch (m.type) {
      case 'reach': case 'platform': a.target = m.anchor ? ANCHORS[m.anchor].clone() : m.target.length === 3 ? new THREE.Vector3(m.target[0], m.target[2], m.target[1]) : atVec(m.target); break;
      case 'explore': a.beacons = m.beacons.map((b) => ({ p: atVec(b), done: false, mesh: this.addTarget(atVec(b)) })); break;
      case 'rescue': if (!m.tag) { a.cages = []; for (let i = 0; i < m.count; i++) { const ang = i / m.count * Math.PI * 2; const x = start.x + Math.cos(ang) * 26, z = start.z + Math.sin(ang) * 26; a.cages.push(G.level.cage(x, z)); } } else G.level.cages.filter((c) => c.tag === m.tag).forEach((c) => c.reset()); break;
      case 'combat': G.enemies.spawnWave(start, m.wave, m.count, 'mission', 20); break;
      case 'boss': G.bosses.start(m.boss, (won, info) => won ? this.complete(info) : this.fail('fail_boss')); break;
      case 'race': this.startRace(m.race); break;
      case 'tournament': this.tour = { i: 0, points: 0 }; this.startRace(TOURNAMENT[0]); break;
      case 'storm': G.weather.set('storm', true); G.weather.lightTimer = 1; break;
      case 'puzzle': if (G.save.flags.shrineSolved) { setTimeout(() => this.complete(), 400); } a.target = ANCHORS.shrine.clone(); break;
      case 'collectShard': a.target = ANCHORS.waterfall.clone().add(new THREE.Vector3(-58, 0, 0)); if (G.save.found[m.shard]) setTimeout(() => this.complete(), 400); break;
      case 'special': break;
    }
    G.audio.play('missionStart');
    G.hud.missionStart(m);
    bus.emit('missionStart', m.id);
  }
  addTarget(p) { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 60, 16, 1, true), this.targetMat); mesh.position.copy(p).y += 30; this.scene.add(mesh); return mesh; }
  update(dt) {
    const a = this.active; const pl = G.player;
    for (const mk of this.markers) mk.mesh.rotation.y += dt;
    if (this.race) this.updateRace(dt);
    if (!a) { this.targetBeacon.visible = false; G.hud.setObjective(null); return; }
    if (G.state === 'play') a.t += dt;
    const m = a.def; let obj = null, target = a.target, prog = null;
    switch (m.type) {
      case 'reach': case 'platform': if (pl.pos.distanceTo(a.target) < (m.type === 'platform' ? 3.5 : 7)) return this.complete(); obj = 'obj_' + m.type; break;
      case 'collect': prog = [a.rings, m.count]; if (a.rings >= m.count) return this.complete(); obj = 'obj_collect'; break;
      case 'rescue': { const done = m.tag ? a.freed : a.cages.filter((c) => c.open).length; prog = [done, m.count]; if (done >= m.count) return this.complete(); obj = 'obj_rescue'; const next = m.tag ? G.level.cages.find((c) => c.tag === m.tag && !c.open) : a.cages.find((c) => !c.open); target = next ? next.pos : null; break; }
      case 'combat': prog = [Math.min(a.kills, m.count), m.count]; if (G.enemies.aliveWithTag('mission') === 0 || a.kills >= m.count) return this.complete(); obj = 'obj_combat'; break;
      case 'explore': { const left = a.beacons.filter((b) => !b.done); for (const b of left) if (pl.pos.distanceTo(b.p) < 8) { b.done = true; this.scene.remove(b.mesh); G.audio.play('checkpoint'); } prog = [a.beacons.length - left.length, a.beacons.length]; if (left.length === 0 || a.beacons.every((b) => b.done)) return this.complete(); target = left[0] && left[0].p; obj = 'obj_explore'; break; }
      case 'speed': { const k = pl.vel.length() * 3.6; prog = [Math.round(Math.max(a.best || 0, k)), m.kmh]; a.best = Math.max(a.best || 0, k); if (k >= m.kmh) return this.complete(); obj = 'obj_speed'; break; }
      case 'boost': if (pl.boosting) a.boost += dt; prog = [Math.floor(a.boost), m.seconds]; if (a.boost >= m.seconds) return this.complete(); obj = 'obj_boost'; break;
      case 'homing': prog = [a.homing, m.count]; if (pl.homingChain >= m.count || a.homing >= m.count * 2) return this.complete(); obj = 'obj_homing'; break;
      case 'smash': prog = [a.smashed, m.count]; if (a.smashed >= m.count) return this.complete(); obj = 'obj_smash'; break;
      case 'storm': prog = [Math.floor(a.t), Math.floor(a.limit)]; if (a.t >= a.limit) return this.complete(); obj = 'obj_storm'; G.weather.lightTimer = Math.min(G.weather.lightTimer, 3); break;
      case 'puzzle': obj = 'obj_puzzle'; break;
      case 'collectShard': obj = 'obj_shard'; break;
      case 'special': prog = [a.rings, m.count]; if (a.rings >= m.count) return this.complete(); obj = 'obj_special'; break;
      case 'boss': obj = 'obj_boss'; break;
      case 'race': case 'tournament': obj = this.tour ? 'obj_tournament' : 'obj_race'; break;
    }
    if (a.limit && m.type !== 'storm' && a.t > a.limit) return this.fail('fail_time');
    if (m.type === 'boss' && !G.bosses.active && a.t > 5) return;
    this.targetBeacon.visible = !!target && m.type !== 'race';
    if (target) this.targetBeacon.position.set(target.x, target.y + 200, target.z);
    G.hud.setObjective({ key: obj, prog, time: a.limit ? Math.max(0, a.limit - a.t) : a.t, countdown: !!a.limit, target: m.type === 'race' || m.type === 'tournament' ? (this.race && this.race.nextPos) : target, params: { n: m.count, kmh: m.kmh, s: m.seconds } });
  }
  rank(a) {
    const m = a.def; if (!a.limit) return a.rankOverride || 'A';
    const f = a.t / a.limit; return f < 0.45 ? 'S' : f < 0.65 ? 'A' : f < 0.85 ? 'B' : 'C';
  }
  complete(info) {
    const a = this.active; if (!a) return; const m = a.def;
    if (info && info.rank) a.rankOverride = info.rank;
    const rank = info && info.rank ? info.rank : this.rank(a);
    const rec = G.save.missions[m.id] || {}; const first = !rec.done;
    rec.done = true; rec.best = Math.min(rec.best || 1e9, a.t); rec.rank = rankBetter(rec.rank, rank); G.save.missions[m.id] = rec;
    const reward = first ? m.reward : Math.round(m.reward * 0.3);
    G.save.wallet += reward; addXP(first ? 120 + m.reward * 0.4 : 40);
    G.save.stats.missions = Object.values(G.save.missions).filter((x) => x.done).length;
    if (m.type === 'special') { G.level.award('shard', 4 + m.special); this.returnFromSpecial(); }
    this.cleanup();
    G.audio.play('missionComplete'); G.player.celebrate('victory', 2.5);
    G.ui.missionResult(m, { ok: true, rank, time: a.t, reward, first, race: info && info.race });
    bus.emit('missionComplete', m.id);
    G.progress.tryUnlocks(); G.progress.checkAchievements(); this.buildMarkers(); G.autosave();
  }
  fail(reason) {
    const a = this.active; if (!a) return; const m = a.def;
    if (m.type === 'special') this.returnFromSpecial();
    this.cleanup(); G.audio.play('missionFail'); G.player.celebrate('frustrated', 1.6);
    G.ui.missionResult(m, { ok: false, reason });
  }
  abort(silent) { const a = this.active; if (!a) return; if (a.def.type === 'special') this.returnFromSpecial(); if (a.def.type === 'boss') G.bosses.end(false); this.cleanup(); if (!silent) G.hud.toast('mission_aborted', 'info'); }
  cleanup() {
    const a = this.active; if (!a) return;
    if (a.beacons) a.beacons.forEach((b) => this.scene.remove(b.mesh));
    G.enemies.clearTag('mission');
    if (a.def.type === 'storm') G.weather.pickFor(G.region);
    if (this.race) this.endRace(true);
    this.tour = null; this.active = null; G.hud.setObjective(null); this.targetBeacon.visible = false;
  }
  // ---------------------------------------------------------------- special stage
  startSpecial(id) {
    const m = MISSIONS.find((x) => x.special === id); if (!m || this.active) return;
    this.specialReturn = { pos: G.player.pos.clone(), yaw: 0 };
    G.audio.play('teleport'); G.fx.explosion(G.player.pos, 0xffffff, 1);
    G.player.spawn(ANCHORS.special.clone().add(new THREE.Vector3(0, 1, 0)), Math.PI);
    G.audio.music('special');
    this.start(m, false);
    G.level.checkpoint = { pos: ANCHORS.special.clone(), yaw: Math.PI };
  }
  returnFromSpecial() { const r = this.specialReturn; if (!r) return; this.specialReturn = null; setTimeout(() => { G.player.spawn(r.pos.clone().add(new THREE.Vector3(4, 2, 0)), 0); G.audio.play('teleport'); }, 1200); }

  // ---------------------------------------------------------------- races
  racePath(def) {
    const pts = def.cps.map((c) => new THREE.Vector3(c[0], c[1] !== null ? c[1] : heightAt(c[0], c[2]), c[2]));
    if (def.laps > 1 || def.type === 'circuit') pts.push(pts[0].clone());
    return { pts, path: new Path(pts.map((p) => p.clone()), null, 2) };
  }
  startRace(id) {
    const def = RACES[id]; const { pts, path } = this.racePath(def);
    const R = this.race = { id, def, pts, path, lap: 1, cp: 1, t: -3.2, started: false, finished: false, rivals: [], ghostRec: [], recT: 0, lastBeep: 4, nextPos: pts[1] };
    // gates
    this.gates = pts.slice(0, def.type === 'circuit' || def.laps > 1 ? pts.length - 1 : pts.length).map((p, i) => {
      const g = new THREE.Mesh(new THREE.TorusGeometry(7, 0.35, 8, 36), i === 1 ? this.gateNext : this.gateMat);
      const nx = pts[Math.min(i + 1, pts.length - 1)], pv = pts[Math.max(0, i - 1)]; v1.copy(nx).sub(pv); g.position.copy(p).y += 3.5; g.lookAt(v2.copy(g.position).add(v1));
      this.scene.add(g); return g;
    });
    // player placement
    const start = pts[0]; v1.copy(pts[1]).sub(start).setY(0).normalize();
    G.player.spawn(start.clone().addScaledVector(v1, -4).add(new THREE.Vector3(0, 0.5, 0)), Math.atan2(v1.x, v1.z));
    G.player.locked = true; G.input.clearAll();
    // rivals
    def.rivals.forEach((cid, i) => {
      const rig = createRig(cid, { quality: Math.min(0.55, G.preset.charQ) }); this.scene.add(rig.root);
      const side = new THREE.Vector3(-v1.z, 0, v1.x).multiplyScalar((i % 2 ? 1 : -1) * (3 + Math.floor(i / 2) * 3));
      R.rivals.push({ id: cid, rig, s: 0, lateral: side.length() * Math.sign((i % 2) - 0.5), speed: 0, anim: { state: 'idle' }, skill: (def.skill || 0.92) + i * 0.025, finished: false, time: 0, pos: new THREE.Vector3() });
    });
    // ghost of best run
    const rec = G.save.races[id];
    if (rec && rec.ghost && rec.ghost.length > 6) {
      const gr = createRig(rec.ghostChar || 'zara', { quality: 0.4 }); gr.setOpacity && gr.setOpacity(0.35); this.scene.add(gr.root);
      this.ghost = { rig: gr, data: rec.ghost, anim: { state: 'run', speedNorm: 0.9, speed: 25 } };
    }
    G.audio.music('race');
  }
  updateRace(dt) {
    const R = this.race; const pl = G.player;
    if (G.state !== 'play') return;
    R.t += dt;
    if (!R.started) {
      const n = Math.ceil(-R.t); if (n !== R.lastBeep && n > 0 && n <= 3) { R.lastBeep = n; G.audio.play('countdown'); G.hud.countdown(n); }
      if (R.t >= 0) { R.started = true; pl.locked = false; G.audio.play('countdownGo'); G.hud.countdown(0); }
    }
    const L = R.path.length; const ncp = R.def.type === 'circuit' || R.def.laps > 1 ? R.pts.length - 1 : R.pts.length;
    // player checkpoints
    if (R.started && !R.finished) {
      const target = R.pts[R.cp % R.pts.length]; R.nextPos = target;
      if (pl.pos.distanceTo(target) < 9.5) {
        G.audio.play('checkpoint', { pitch: 1.2 }); this.gates.forEach((g, i) => (g.material = this.gateMat));
        R.cp++;
        const lapDone = (R.def.type === 'circuit' || R.def.laps > 1) ? R.cp > ncp : R.cp >= ncp;
        if (lapDone) {
          if (R.lap >= R.def.laps) return this.finishRace();
          R.lap++; R.cp = 1; G.hud.toast('race_lap', 'info', { n: R.lap, m: R.def.laps });
        }
        const gi = R.cp % ncp; if (this.gates[gi]) this.gates[gi].material = this.gateNext;
      }
      R.recT -= dt; if (R.recT <= 0) { R.recT = 0.1; R.ghostRec.push(Math.round(pl.pos.x * 10) / 10, Math.round(pl.pos.y * 10) / 10, Math.round(pl.pos.z * 10) / 10); }
    }
    // rivals
    const pprog = ((R.lap - 1) * L + this.progressOf(pl.pos, R)) || 0;
    let position = 1;
    for (const rv of R.rivals) {
      if (R.started && !rv.finished) {
        const rprog = rv.s; const gap = pprog - rprog;
        const band = clamp(1 + gap / 260, 0.85, 1.25);
        const target = 36 * rv.skill * band * (G.settings.gameplay.difficulty === 'hard' ? 1.08 : G.settings.gameplay.difficulty === 'easy' ? 0.88 : 1);
        rv.speed = damp(rv.speed, target, 1.2, dt); rv.s += rv.speed * dt;
        if (rv.s >= L * R.def.laps) { rv.finished = true; rv.time = R.t; }
      }
      const sl = rv.s % L; R.path.pointAt(sl, rv.pos); R.path.tangentAt(sl, v1);
      v2.set(-v1.z, 0, v1.x).normalize().multiplyScalar(rv.lateral); rv.pos.add(v2);
      if (R.def.cps[0][1] === null) rv.pos.y = heightAt(rv.pos.x, rv.pos.z);
      rv.rig.root.position.copy(rv.pos); rv.rig.root.rotation.y = Math.atan2(v1.x, v1.z);
      rv.anim.state = !R.started ? 'idle' : rv.finished ? 'victory' : rv.speed > 30 ? 'sprint' : 'run'; rv.anim.speed = rv.speed; rv.anim.speedNorm = rv.speed / 32; rv.anim.lod = 1;
      rv.rig.update(dt, rv.anim);
      if (rv.s > pprog && !R.finished) position++;
    }
    R.position = position;
    if (this.ghost && R.started) { const g = this.ghost; const i = Math.floor(R.t * 10) * 3; if (i + 2 < g.data.length) { const nx = g.data[Math.min(i + 3, g.data.length - 3)], nz = g.data[Math.min(i + 5, g.data.length - 1)]; g.rig.root.position.set(g.data[i], g.data[i + 1], g.data[i + 2]); g.rig.root.rotation.y = Math.atan2(nx - g.data[i], nz - g.data[i + 2]); g.rig.update(dt, g.anim); g.rig.root.visible = true; } else g.rig.root.visible = false; }
    G.hud.raceInfo({ lap: R.lap, laps: R.def.laps, pos: position, of: R.rivals.length + 1, t: Math.max(0, R.t), started: R.started, ghost: !!this.ghost });
  }
  progressOf(p, R) { return R.path.nearest(p).s; }
  finishRace() {
    const R = this.race; R.finished = true; const t = R.t; const L = R.path.length * R.def.laps;
    const medals = [L / 44, L / 36, L / 28];
    const medal = t <= medals[0] ? 'gold' : t <= medals[1] ? 'silver' : t <= medals[2] ? 'bronze' : null;
    const pos = R.position || 1;
    const rec = G.save.races[R.id] || { board: [] };
    rec.board = (rec.board || []).concat([{ t: Math.round(t * 100) / 100, c: G.save.char, d: Date.now() }]).sort((a, b) => a.t - b.t).slice(0, 5);
    if (!rec.best || t < rec.best) { rec.best = t; rec.ghost = R.ghostRec.slice(0, 9000); rec.ghostChar = G.save.char; }
    const order = ['gold', 'silver', 'bronze']; if (medal && (!rec.medal || order.indexOf(medal) < order.indexOf(rec.medal))) rec.medal = medal;
    rec.runs = (rec.runs || 0) + 1; if (pos === 1) { rec.wins = (rec.wins || 0) + 1; G.save.stats.racesWon++; }
    rec.avgSpeed = Math.round((L / t) * 3.6);
    G.save.races[R.id] = rec;
    const info = { race: { id: R.id, t, medal, pos, of: R.rivals.length + 1, board: rec.board, medals, avg: rec.avgSpeed } };
    bus.emit('raceFinished', info.race);
    const a = this.active;
    if (this.tour && a) {
      this.tour.points += [10, 6, 3, 1][pos - 1] || 0; this.tour.i++;
      if (this.tour.i < TOURNAMENT.length) { this.endRace(); G.hud.toast('tour_next', 'info', { n: this.tour.points }); setTimeout(() => this.active && this.startRace(TOURNAMENT[this.tour.i]), 2500); return; }
      const won = this.tour.points >= 20; this.endRace();
      if (won) { G.save.flags.champion = 1; return this.complete({ rank: this.tour.points >= 28 ? 'S' : 'A', race: info.race }); }
      return this.fail('fail_tournament');
    }
    if (a && (a.def.type === 'race')) {
      const need = R.def.type === 'rival' || R.rivals.length ? pos === 1 : !!medal;
      if (need) return this.complete({ rank: medal === 'gold' && pos === 1 ? 'S' : medal === 'silver' ? 'A' : 'B', race: info.race });
      this.endRace(); return this.fail(R.rivals.length ? 'fail_race_pos' : 'fail_race_time');
    }
    this.endRace();
  }
  endRace() {
    const R = this.race; if (!R) return;
    for (const g of this.gates) { this.scene.remove(g); g.geometry.dispose(); } this.gates = [];
    for (const rv of R.rivals) { this.scene.remove(rv.rig.root); rv.rig.dispose(); }
    if (this.ghost) { this.scene.remove(this.ghost.rig.root); this.ghost.rig.dispose(); this.ghost = null; }
    this.race = null; G.player.locked = false; G.hud.raceInfo(null);
    if (G.region) G.audio.music(G.region.music);
  }
}
function rankBetter(a, b) { const o = ['S', 'A', 'B', 'C']; if (!a) return b; return o.indexOf(b) < o.indexOf(a) ? b : a; }
