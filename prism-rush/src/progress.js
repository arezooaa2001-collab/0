// Progression: XP/levels, skill trees, shop, achievements, daily/weekly challenges, completion %.
import { G, bus } from './game.js';
import { hashStr, rng } from './util.js';

export const CHAR_STATS = {
  zara:  { top: 31, accel: 36, jump: 13.6, boost: 64, air: 1.0, turn: 1.0, weight: 1.0, special: 'airBoost' },
  pip:   { top: 26, accel: 31, jump: 12.8, boost: 54, air: 1.25, turn: 1.1, weight: 0.8, special: 'fly' },
  rook:  { top: 27, accel: 29, jump: 12.6, boost: 56, air: 0.85, turn: 0.95, weight: 1.35, special: 'climb' },
  lumi:  { top: 28, accel: 33, jump: 13.2, boost: 57, air: 1.1, turn: 1.15, weight: 0.9, special: 'pogo' },
  vex:   { top: 32, accel: 37, jump: 13.6, boost: 66, air: 1.0, turn: 1.0, weight: 1.05, special: 'blink' },
  ember: { top: 30, accel: 36, jump: 13.5, boost: 62, air: 1.05, turn: 1.0, weight: 1.0, special: 'flameDash' },
};
export const CHAR_ORDER = ['zara', 'pip', 'rook', 'lumi', 'vex', 'ember'];
export const UNLOCK_RULES = { rook: { mission: 'm3' }, lumi: { mission: 'm5' }, vex: { boss: 'vex' }, ember: { tokens: 5 } };

export const SKILLS = [
  { id: 'spd1', cost: 1, col: 0, row: 0 }, { id: 'spd2', cost: 1, col: 0, row: 1, req: 'spd1' }, { id: 'spd3', cost: 2, col: 0, row: 2, req: 'spd2' },
  { id: 'acc1', cost: 1, col: 0, row: 3, req: 'spd1' },
  { id: 'bst1', cost: 1, col: 1, row: 0 }, { id: 'bst2', cost: 1, col: 1, row: 1, req: 'bst1' }, { id: 'bst3', cost: 2, col: 1, row: 2, req: 'bst2' },
  { id: 'hom1', cost: 1, col: 1, row: 3, req: 'bst1' },
  { id: 'jmp1', cost: 1, col: 2, row: 0 }, { id: 'air1', cost: 1, col: 2, row: 1, req: 'jmp1' }, { id: 'wall1', cost: 1, col: 2, row: 2, req: 'air1' },
  { id: 'trip', cost: 2, col: 2, row: 3, req: 'jmp1' },
  { id: 'spec1', cost: 2, col: 3, row: 0 }, { id: 'spec2', cost: 2, col: 3, row: 1, req: 'spec1' },
];

export const SHOP = [
  // upgrades (global)
  { id: 'magnet', kind: 'upgrade', max: 3, price: [250, 600, 1200] },
  { id: 'boostCap', kind: 'upgrade', max: 3, price: [300, 700, 1400] },
  { id: 'boostRegen', kind: 'upgrade', max: 3, price: [300, 700, 1400] },
  { id: 'airCtl', kind: 'upgrade', max: 2, price: [350, 900] },
  { id: 'wallrun', kind: 'upgrade', max: 2, price: [350, 900] },
  { id: 'railSpeed', kind: 'upgrade', max: 2, price: [400, 1000] },
  { id: 'dashExt', kind: 'upgrade', max: 1, price: [800] },
  { id: 'jumpUp', kind: 'upgrade', max: 2, price: [400, 1000] },
  { id: 'tripleJump', kind: 'ability', max: 1, price: [1500] },
  { id: 'treasureRadar', kind: 'ability', max: 1, price: [900] },
  { id: 'enemyRadar', kind: 'ability', max: 1, price: [700] },
  // consumables
  { id: 'shield', kind: 'item', price: [120] }, { id: 'elecShield', kind: 'item', price: [200] },
  { id: 'fireShield', kind: 'item', price: [200] }, { id: 'waterShield', kind: 'item', price: [200] },
  { id: 'slowmo', kind: 'item', price: [250] }, { id: 'lowgrav', kind: 'item', price: [250] },
  { id: 'invinc', kind: 'item', price: [350] }, { id: 'ringx2', kind: 'item', price: [300] }, { id: 'xpx2', kind: 'item', price: [300] },
];
export const SKIN_PRICES = [0, 300, 650, 1100];

export const ACHIEVEMENTS = [
  ['first_ring', 'rings', 1, 20], ['rings_500', 'rings', 500, 200], ['rings_5000', 'rings', 5000, 1000], ['rings_20000', 'rings', 20000, 3000],
  ['combo_50', 'maxCombo', 50, 300], ['combo_150', 'maxCombo', 150, 800],
  ['speed_100', 'topSpeed', 100, 50], ['speed_200', 'topSpeed', 200, 300], ['speed_300', 'topSpeed', 300, 800],
  ['boost_60', 'boostTime', 60, 200], ['homing_5', 'maxHomingChain', 5, 300],
  ['enemies_10', 'enemies', 10, 100], ['enemies_100', 'enemies', 100, 500], ['enemies_500', 'enemies', 500, 1500],
  ['loop_1', 'loops', 1, 50], ['loops_25', 'loops', 25, 400], ['rail_2000', 'railDist', 2000, 400],
  ['wallrun_1', 'wallruns', 1, 50], ['spindash_max', 'spindashMax', 1, 100], ['marathon', 'distance', 42195, 1500],
  ['critters_25', 'critters', 25, 400], ['photo_1', 'photos', 1, 50], ['missions_10', 'missions', 10, 800],
  ['explorer', 'regionsFound', 10, 1000], ['shards_7', 'shards', 7, 2000], ['red_rings', 'redRings', 20, 1500],
  ['chests', 'chests', 12, 1200], ['races_3', 'racesWon', 3, 600], ['bosses_5', 'bosses', 5, 2500],
  ['all_chars', 'charsUnlocked', 6, 1500], ['level_10', 'maxLevel', 10, 600], ['prism', 'prismUses', 1, 800],
  ['daily_1', 'dailyDone', 1, 150], ['no_hit_boss', 'noHitBoss', 1, 1000], ['completion_100', 'completion', 100, 5000],
].map(([id, stat, goal, reward]) => ({ id, stat, goal, reward }));

const DAILY_POOL = [
  ['d_rings', 'rings', 400], ['d_enemies', 'enemies', 30], ['d_dist', 'distance', 6000], ['d_homing', 'homing', 20],
  ['d_loops', 'loops', 4], ['d_boost', 'boostTime', 45], ['d_rail', 'railDist', 600], ['d_jumps', 'jumps', 120], ['d_critters', 'critters', 5],
];
const WEEKLY_POOL = [
  ['w_rings', 'rings', 4000], ['w_enemies', 'enemies', 250], ['w_dist', 'distance', 50000], ['w_missions', 'missions', 6], ['w_rail', 'railDist', 5000],
];

export function charStats(id) {
  const s = G.save; const base = CHAR_STATS[id];
  const sk = (s && s.skills[id]) || {}; const up = (s && s.upgrades) || {};
  const lvl = (s && s.level[id]) || 1;
  const lv = 1 + (lvl - 1) * 0.006;
  return {
    top: base.top * lv * (1 + (sk.spd1 ? 0.05 : 0) + (sk.spd2 ? 0.05 : 0) + (sk.spd3 ? 0.06 : 0)),
    accel: base.accel * (sk.acc1 ? 1.12 : 1) * lv,
    jump: base.jump * (1 + (sk.jmp1 ? 0.06 : 0) + 0.04 * (up.jumpUp || 0)),
    boostSpeed: base.boost * (sk.bst3 ? 1.06 : 1) * lv,
    boostCap: 100 + (sk.bst1 ? 15 : 0) + 20 * (up.boostCap || 0),
    boostRegen: 3.5 * (sk.bst2 ? 1.4 : 1) * (1 + 0.35 * (up.boostRegen || 0)),
    air: base.air * (sk.air1 ? 1.3 : 1) * (1 + 0.2 * (up.airCtl || 0)),
    wallTime: 1.1 + (sk.wall1 ? 0.6 : 0) + 0.4 * (up.wallrun || 0),
    triple: !!(sk.trip || up.tripleJump),
    homingRange: 22 * (sk.hom1 ? 1.3 : 1),
    homingChain: !!sk.hom1,
    airDashes: 1 + (up.dashExt ? 1 : 0),
    magnet: 2.2 + 1.6 * (up.magnet || 0),
    rail: 1 + 0.12 * (up.railSpeed || 0),
    turn: base.turn, weight: base.weight, special: base.special, spec: (sk.spec1 ? 1 : 0) + (sk.spec2 ? 1 : 0),
  };
}

export const xpFor = (lvl) => Math.round(120 * Math.pow(lvl, 1.45));
export function addXP(amount) {
  const s = G.save; if (!s) return;
  const id = s.char;
  if (G.player && G.player.power.xpx2 > 0) amount *= 2;
  s.xp[id] += Math.round(amount);
  while (s.level[id] < 30 && s.xp[id] >= xpFor(s.level[id])) {
    s.xp[id] -= xpFor(s.level[id]); s.level[id]++; s.sp[id]++;
    bus.emit('levelUp', { char: id, level: s.level[id] });
  }
}
export function addRings(n) {
  const s = G.save; if (!s) return;
  s.wallet += n; s.stats.rings += n;
}

export function stat(name) {
  const s = G.save; if (!s) return 0;
  switch (name) {
    case 'regionsFound': return Object.keys(s.regions).length;
    case 'shards': return countFound('shard');
    case 'redRings': return countFound('red');
    case 'chests': return countFound('chest');
    case 'charsUnlocked': return s.unlocked.length;
    case 'maxLevel': return Math.max(...Object.values(s.level));
    case 'prismUses': return s.flags.prismUses || 0;
    case 'dailyDone': return s.flags.dailyDone || 0;
    case 'noHitBoss': return s.flags.noHitBoss || 0;
    case 'completion': return completion();
    default: return s.stats[name] || 0;
  }
}
export function countFound(prefix) { let n = 0; for (const k in G.save.found) if (k.startsWith(prefix + '_')) n++; return n; }

export function checkAchievements() {
  const s = G.save; if (!s) return;
  for (const a of ACHIEVEMENTS) {
    if (s.achievements[a.id]) continue;
    if (stat(a.stat) >= a.goal) { s.achievements[a.id] = Date.now(); s.wallet += a.reward; bus.emit('achievement', a); }
  }
}

function dateKey(d = new Date()) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function weekKey(d = new Date()) { const t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return 'w' + dateKey(t); }
function pickChallenges(pool, key, n) {
  const r = rng(hashStr(key)); const p = pool.slice(); const out = [];
  while (out.length < n && p.length) out.push(p.splice(Math.floor(r() * p.length), 1)[0]);
  return out.map(([id, statName, goal]) => ({ id, stat: statName, goal, base: stat(statName), done: false }));
}
export function refreshChallenges() {
  const s = G.save; if (!s) return;
  const dk = dateKey(), wk = weekKey();
  if (!s.daily || s.daily.key !== dk) s.daily = { key: dk, list: pickChallenges(DAILY_POOL, dk, 3) };
  if (!s.weekly || s.weekly.key !== wk) s.weekly = { key: wk, list: pickChallenges(WEEKLY_POOL, wk, 2) };
}
export function challengeProgress(c) { return Math.min(c.goal, stat(c.stat) - c.base); }
export function checkChallenges() {
  const s = G.save; if (!s || !s.daily) return;
  for (const [set, reward] of [[s.daily, 250], [s.weekly, 1500]]) {
    for (const c of set.list) {
      if (!c.done && challengeProgress(c) >= c.goal) {
        c.done = true; s.wallet += reward; if (set === s.daily) s.flags.dailyDone = (s.flags.dailyDone || 0) + 1;
        bus.emit('challengeDone', { c, reward });
      }
    }
  }
}

// totals are filled in by the level/missions modules once the world is built
export const TOTALS = { missions: 1, races: 1, bosses: 1, shard: 7, red: 20, chest: 12, key: 5, token: 5, crystal: 30, map: 10, regions: 10, critterCages: 1 };
export function completion() {
  const s = G.save; if (!s) return 0;
  const parts = [
    [Object.values(s.missions).filter((m) => m.done).length / TOTALS.missions, 30],
    [Object.values(s.races).filter((r) => r.medal).length / TOTALS.races, 12],
    [Object.values(s.bosses).filter((b) => b.done).length / TOTALS.bosses, 14],
    [countFound('shard') / TOTALS.shard, 10], [countFound('red') / TOTALS.red, 6], [countFound('chest') / TOTALS.chest, 5],
    [countFound('key') / TOTALS.key, 3], [countFound('token') / TOTALS.token, 3], [countFound('crystal') / TOTALS.crystal, 4],
    [Object.keys(s.regions).length / TOTALS.regions, 5], [Object.keys(s.achievements).length / ACHIEVEMENTS.length, 5], [s.unlocked.length / 6, 3],
  ];
  let sum = 0, w = 0; for (const [f, wt] of parts) { sum += Math.min(1, f) * wt; w += wt; }
  return Math.floor((sum / w) * 100);
}

export function tryUnlocks() {
  const s = G.save; if (!s) return;
  for (const id in UNLOCK_RULES) {
    if (s.unlocked.includes(id)) continue;
    const r = UNLOCK_RULES[id];
    const ok = (r.mission && s.missions[r.mission]?.done) || (r.boss && s.bosses[r.boss]?.done) || (r.tokens && countFound('token') >= r.tokens);
    if (ok) { s.unlocked.push(id); bus.emit('charUnlocked', id); }
  }
}
