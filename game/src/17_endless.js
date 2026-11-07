/* ============================ ENDLESS MODE ============================ */
// An endless course made of chunks taken from the normal levels (every one of them was checked by the
// auto-solver). Chunks start and end on the ground, so any order works. It grows ahead of the player:
// harder chunks come later, and every few checkpoints the world changes its colours (a new "zone").
const ENDLESS_ZONE = 4;   // checkpoints per zone
function endlessPool() {
  const out = [];
  LEVELS.forEach((d, i) => {
    if (!d.secs || d.dj || d.realm || d.kind === '3d') return;
    d.secs.forEach(s => { if (s.gen && !s.cave) out.push({ s, i, biome: d.biome }); });
  });
  return out;
}
// the next chunk: a copy (sections get their own x position), from levels near the current difficulty
function endlessNext(E) {
  const hi = 3 + E.n * 1.3, lo = Math.max(0, hi - 14);
  let c = E.pool.filter(q => q.i <= hi && q.i >= lo && !E.used.has(q));
  if (!c.length) c = E.pool.filter(q => !E.used.has(q));
  if (!c.length) { E.used.clear(); c = E.pool; }
  const q = c[Math.floor(E.r() * c.length)]; E.used.add(q); E.n++;
  return Object.assign({}, q.s, { src: q.i, biome: q.biome });
}
function makeEndless(seed) {
  const E = { pool: endlessPool(), used: new Set(), n: 0, r: srand(seed) };
  const secs = []; for (let i = 0; i < 4; i++) secs.push(endlessNext(E));
  const def = { endless: true, E, name: 'بی‌پایان', biome: secs[0].biome, secs, spawn: secs[0].spawn, nObs: 0 };
  def.relayout = () => { let x = 0; for (const s of def.secs) { s.x0 = x; x += s.w; } def.width = x; };
  def.relayout();
  return def;
}
// biome of the zone that starts at checkpoint i
const endlessZoneBiome = (def, i) => def.secs[Math.floor(i / ENDLESS_ZONE) * ENDLESS_ZONE].biome;
