/* ============================ LONGER LEVELS: ROOMS ============================ */
// Every platformer level is a long chain of rooms (screens): 8 rooms on level 1 up to 18 on the last
// platformer levels, 12 in each hidden-realm level. Room 1 is the hand-made screen of the level; the
// following rooms are packed with trap segments: the level's own themed traps mixed with a shared pool
// that unlocks more trap types as the game goes on, getting harder towards the end of each level and of
// the game. Dying sends you back to the start of the current room (checkpoint).
// Room seeds were checked with the auto-solver on easy and insane; ROOM_SEED_FIX holds seeds swapped in
// where the first seed produced a layout the solver could not finish.
const ROOM_SEED_FIX = {};

/* segment library: each builds a feature starting at column x using at most m columns and returns the
   columns used (0 = does not fit). F(x, w) registers plain floor that is merged into long blocks later. */
const SEG = {
  pit(L, x, m, r, k, id, F, o) { const w = 2 + Math.floor(r() * (2 + k * 1.6)) + (o.dj ? 2 : 0); if (w > m) return 0; L.spikes(null, x, 17, w, 'up'); return w; },
  spikes(L, x, m, r, k, id, F) { const n = 1 + (r() < .35 + k * .4 ? 1 : 0); if (n + 1 > m) return 0; F(x, n + 1); L.spikes(null, x, 14, n, 'up'); return n + 1; },
  hidden(L, x, m, r, k, id, F) {
    const n = 1 + (r() < .5 ? 1 : 0); if (n + 2 > m) return 0;
    F(x, n + 2); L.spikes(id, x + 1, 14, n, 'up', { hidden: true }); L.trig(x - .5, 13.5, .5, 1.5, () => L.pop(id), { ground: true }); return n + 2;
  },
  drop(L, x, m, r, k, id) {
    const w = 2 + Math.floor(r() * (1.5 + k)); if (w > m) return 0;
    L.spikes(null, x, 17, w, 'up'); L.block(id, x, 15, w, 3, { fallV: 200 });
    L.trig(x + .05, 14, .6, 1, () => { L.fall(id, .05); L.sfx('rumble'); }, { ground: true }); return w;
  },
  crumble(L, x, m, r, k, id) {
    const n = 2 + (r() < k ? 1 : 0), w = n * 4 + 2; if (w > m) return 0;
    L.spikes(null, x, 17, w, 'up');
    for (let i = 0; i < n; i++) L.block(null, x + 2 + i * 4, 14, 2, .5, { crumble: .5 - k * .1 });
    return w;
  },
  saw(L, x, m, r, k, id, F) {
    const w = 5 + Math.floor(r() * 2); if (w > m) return 0;
    F(x, w); L.saw(id, x + 1, 14.35, .6, { patrol: [[x + .8, 14.35], [x + w - .8, 14.35]], speed: 2.4 + k * 1.8 }); return w;
  },
  wall(L, x, m, r, k, id, F) {
    if (5 > m) return 0; F(x, 5); L.block(null, x + 1.5, 13, 2, 2);
    if (k > .45) { L.spikes(id, x + 2, 12, 1, 'up', { hidden: true }); L.trig(x + 1.5, 11.5, 2, 1.5, () => L.pop(id), { ground: true }); }
    return 5;
  },
  crusher(L, x, m, r, k, id, F) {
    if (5 > m) return 0; F(x, 5);
    L.block(null, x, 0, 5, 2.5, { ceil: true });
    L.block(id, x + 1.5, 2.5, 2, 2, { fallV: 150 }); L.spikes(null, x + 1.5, 4.5, 2, 'down', { parent: id });
    L.trig(x - .7, 2.5, .5, 12.5, () => { L.fall(id, .3); L.sfx('rumble'); }); return 5;
  },
  spring(L, x, m, r, k, id, F) {
    if (7 > m) return 0; F(x, 7); L.spring(null, x + .8, 14); L.block(null, x + 3.6, 9, 2, 6); return 7;
  },
  orbit(L, x, m, r, k, id) {
    if (7 > m) return 0; L.spikes(null, x, 17, 7, 'up'); L.block(null, x + 2.5, 13.5, 2, .6);
    L.saw(id, x + 3.5, 11.6, .5, { orbit: { rad: 2.1, w: (2 + k) * (r() < .5 ? 1 : -1), ph: r() * 6.28 } }); return 7;
  },
  laser(L, x, m, r, k, id, F) {
    if (4 > m) return 0; F(x, 4); L.laser(id, x + 2, 8.5, 6.5, 'v', { on: .9 + k * .3, off: 1.5 - k * .3, ph: r() * 2 }); return 4;
  },
  ice(L, x, m, r, k, id) { if (6 > m) return 0; L.block(null, x, 15, 6, 3, { ice: true }); L.spikes(null, x + 3, 14, 1, 'up'); return 6; },
  conveyor(L, x, m, r, k, id) { if (6 > m) return 0; L.block(null, x, 15, 6, 3, { conv: -(2.5 + k * 1.5) }); L.spikes(null, x + 3, 14, 1, 'up'); return 6; },
  ghost(L, x, m, r, k, id) { const w = 2 + Math.floor(r() * 2); if (w > m) return 0; L.spikes(null, x, 17, w, 'up'); L.block(null, x, 15, w, 3, { ghost: true }); return w; },
  bump(L, x, m, r, k, id, F) {
    if (6 > m) return 0; F(x, 6); L.spikes(null, x + 3, 14, 1, 'up');
    L.block(id, x + 2.5, 10.5, 2, 1, { hidden: true }); L.trig(x + 2, 11.5, 3, 1.2, () => L.pop(id), { rising: true }); return 6;
  },
  fallSpikes(L, x, m, r, k, id, F) {
    if (6 > m) return 0; F(x, 6); L.block(null, x, 0, 6, 2, { ceil: true }); L.spikes(id, x + 3, 2, 2, 'down');
    L.trig(x - 1.2, 2, .5, 13, () => { L.fall(id, .1); L.sfx('crack'); }); return 6;
  },
  movingPlat(L, x, m, r, k, id) {
    const w = 7 + (k > .5 ? 1 : 0); if (w > m) return 0; L.spikes(null, x, 17, w, 'up');
    L.block(id, x + 1, 14, 2, .6, { patrol: [[x + 1, 14], [x + w - 3, 14]], speed: 2 + k }); return w;
  },
  orbFlip(L, x, m, r, k, id, F) {
    // flip onto the ceiling over a spike pit, hop one ceiling spike, flip back down and land on a long floor
    const w = 8, land = 5; if (w + land > m) return 0;
    L.block(null, x - .5, 0, w + 1, 3.5, { ceil: true }); L.spikes(null, x + 1, 17, w - 1, 'up');
    F(x, 1); L.orb(id + 'a', x + .5, 14.4); L.spikes(null, x + 4, 3.5, 1, 'down'); L.orb(id + 'b', x + w - .5, 3.9);
    F(x + w, land); return w + land;
  },
  pillarHop(L, x, m, r, k, id) {
    // hop across 1-tile pillars of alternating height over a spike pit
    const n = 2 + (r() < .3 + k * .5 ? 1 : 0), w = n * 3 + 2; if (w > m) return 0;
    for (let i = 0; i <= n; i++) L.spikes(null, x + i * 3, 17, 2, 'up');
    for (let i = 0; i < n; i++) { const top = i % 2 ? 13 : 14; L.block(null, x + 2 + i * 3, top, 1, 18 - top); }
    return w;
  },
  stairs(L, x, m, r, k, id, F) {
    // climb three steps, then leap over a spike strip from the top step
    const n = 2 + (k > .5 ? 1 : 0), w = 9 + n; if (w > m) return 0; F(x, w);
    L.block(null, x + 1, 14, 2, 1); L.block(null, x + 3, 13, 2, 2); L.block(null, x + 5, 12, 2, 3);
    L.spikes(null, x + 7, 14, n, 'up'); return w;
  },
  sawRail(L, x, m, r, k, id) {
    // a saw rides up and down through a spike pit: time the jump
    const w = 3 + (k > .6 ? 1 : 0); if (w > m) return 0;
    L.spikes(null, x, 17, w, 'up');
    L.saw(id, x + w / 2, 16.2, .55, { patrol: [[x + w / 2, 16.2], [x + w / 2, 10.6]], speed: 2.2 + k * 2 }); return w;
  },
  doubleSpike(L, x, m, r, k, id, F) {
    // two spike strips with a one-tile island between them
    const a = 1 + (r() < k ? 1 : 0), w = a * 2 + 3; if (w > m) return 0;
    F(x, w); L.spikes(null, x + 1, 14, a, 'up'); L.spikes(null, x + 2 + a, 14, a, 'up'); return w;
  },
  lowCeil(L, x, m, r, k, id, F) {
    // spiked ceiling hangs low: a full jump hits it, so hop the floor spike with a short tap
    if (7 > m) return 0; F(x, 7);
    L.block(null, x, 0, 7, 10.6, { ceil: true }); L.spikes(null, x, 10.6, 7, 'down');
    L.spikes(null, x + 3, 14, 1, 'up'); return 7;
  },
};
// shared trap pool, unlocked step by step through the game (by level progress k0)
const POOL = [
  [0, ['pit', 'spikes', 'hidden', 'drop', 'doubleSpike', 'pillarHop', 'stairs']],
  [.22, ['saw', 'crumble', 'sawRail', 'wall']],
  [.42, ['crusher', 'fallSpikes', 'bump', 'ghost', 'movingPlat', 'lowCeil']],
  [.65, ['orbit']],
];
const HIDDEN_SEG = new Set(['hidden', 'drop', 'ghost', 'bump']); // traps you cannot see before they spring
const poolFor = k0 => POOL.filter(([u]) => k0 >= u).flatMap(([, l]) => l);
// which segments each platformer level uses (by position in LEVELS), plus room-wide extras
const ROOM_THEMES = {
  0: { seg: ['pit', 'drop', 'spikes'] }, 2: { seg: ['hidden', 'spikes', 'pit'] }, 3: { seg: ['wall', 'pit', 'hidden'] },
  5: { seg: ['crusher', 'pit', 'spikes'] }, 6: { seg: ['crumble', 'saw', 'pit'] }, 7: { seg: ['spring', 'drop', 'spikes'] },
  8: { seg: ['pit', 'spikes', 'drop'], wall: 4.6 }, 10: { seg: ['orbFlip', 'pit', 'spikes'] }, 11: { seg: ['pit', 'saw', 'hidden'], dark: true },
  12: { seg: ['ghost', 'bump', 'pit'] }, 13: { seg: ['pit', 'spikes', 'hidden'], rev: true }, 15: { seg: ['fallSpikes', 'pit', 'spikes'] },
  16: { seg: ['movingPlat', 'pit', 'ghost'] }, 17: { seg: ['hidden', 'wall', 'spikes'] }, 18: { seg: ['saw', 'crusher', 'spikes'] },
  20: { seg: ['wall', 'ghost', 'crumble'] }, 21: { seg: ['saw', 'orbit', 'pit'] }, 22: { seg: ['orbFlip', 'pit', 'hidden'] },
  23: { seg: ['drop', 'crumble', 'pit'] }, 25: { seg: ['spring', 'hidden', 'spikes'] }, 26: { seg: ['movingPlat', 'saw', 'orbit'] },
  27: { seg: ['spring', 'pit', 'hidden'], dark: true }, 28: { seg: ['pit', 'spikes'], wall: 4.2, rev: true }, 30: { seg: ['ice', 'pit', 'spikes'] },
  31: { seg: ['conveyor', 'pit', 'saw'] }, 32: { seg: ['crusher', 'fallSpikes', 'pit'] }, 33: { seg: ['orbit', 'movingPlat', 'pit'] },
  35: { seg: ['movingPlat', 'crumble', 'saw'] }, 36: { seg: ['spring', 'hidden', 'drop'] }, 37: { seg: ['crumble', 'drop', 'pit', 'saw'] },
  38: { seg: ['hidden', 'drop', 'crusher', 'saw', 'crumble', 'ghost', 'bump', 'fallSpikes'] },
};
const REALM_THEME = { seg: ['laser', 'movingPlat', 'orbit', 'pit', 'ice', 'conveyor', 'laser'], dj: true };

function genRoom(theme, seed, k, extra = {}, pool = []) {
  const o = Object.assign({}, theme, extra);
  return { spawn: [1, 14], dark: !!o.dark, gen: true, seed, remake: sd => genRoom(theme, sd, k, extra, pool), build(L) {
    const r = srand(seed * 9973 + 7), floors = [];
    const F = (x, w) => floors.push([x, x + w]);
    F(0, 3);
    let x = 3, i = 0, tries = 0, nHid = 0, last = '';
    const END = 28, maxHid = 1 + (k > .55 ? 1 : 0);
    while (x < END - 2 && tries++ < 60) {
      // the level's own traps most of the time, the shared pool for variety; at most one or two invisible
      // traps per room (so a room never looks empty) and never the same trap twice in a row
      const list = pool.length && r() < .42 ? pool : o.seg;
      const name = list[Math.floor(r() * list.length)];
      if (name === last || (HIDDEN_SEG.has(name) && nHid >= maxHid)) continue;
      const pad = 1 + (r() < .28 ? 1 : 0);
      const used = SEG[name](L, x + pad, END - (x + pad), r, k, 'g' + i, F, o);
      if (!used) continue;
      if (HIDDEN_SEG.has(name)) nHid++;
      F(x, pad); x += pad + used; i++; last = name;
    }
    F(x, 32 - x);
    // merge plain floor pieces into long blocks
    floors.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const f of floors) { const lst = merged[merged.length - 1]; if (lst && f[0] <= lst[1] + 1e-6) lst[1] = Math.max(lst[1], f[1]); else merged.push(f.slice()); }
    for (const [a, b] of merged) L.block(null, a, 15, b - a, 3);
    if (o.wall) { L.block('cw', -7, 0, 6, 15); L.spikes(null, -1, 0, 15, 'right', { parent: 'cw' }); L.trig(3.5, 2, .5, 13, () => { L.move('cw', 27, 0, o.wall + k, 0.4); L.sfx('rumble'); L.shake(6); L.say('فرار کن!'); }); }
    if (o.rev) { L.trig(4.5, 2, .5, 13, () => { L.reverse(true); L.say('کنترل‌ها برعکس شد!'); }); L.trig(27.2, 2, .5, 13, () => L.reverse(false)); }
    L.door(29.6, 13);
  }};
}
// attach rooms: 8 rooms on the first level growing to 18 on the last platformer levels; hidden realm 12 each.
// k (difficulty of a room) grows with the level and with the position of the room inside the level.
const roomCount = idx => 8 + Math.round(idx * 10 / 38);
LEVELS.forEach((def, idx) => {
  if (def.kind === '3d') return;
  const th = ROOM_THEMES[idx]; if (!th) return;
  const n = roomCount(idx), k0 = idx / 39, pool = poolFor(k0);
  def.rooms = [def];
  for (let room = 1; room < n; room++) {
    const key = idx + ':' + room, seed = ROOM_SEED_FIX[key] ?? (idx * 100 + room);
    def.rooms.push(genRoom(th, seed, clamp(k0 + room / n * .35, 0, 1), {}, pool));
  }
});
REALM.forEach((def, ri) => {
  def.rooms = [def];
  const n = 12, pool = poolFor(1);
  for (let room = 1; room < n; room++) {
    const key = 'r' + ri + ':' + room, seed = ROOM_SEED_FIX[key] ?? (5000 + ri * 100 + room);
    def.rooms.push(genRoom(REALM_THEME, seed, clamp(.72 + ri * .08 + room / n * .2, 0, 1), { dark: ri === 2 && room >= n - 3 }, pool));
  }
});
