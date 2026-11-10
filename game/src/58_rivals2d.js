/* ============================ 2D RIVALS (race levels played as platformers) ============================ */
// Each rival replays, room by room, an input sequence the auto-solver found for that room (RIVAL_DATA, recorded
// on easy). It runs in its own invisible copy of the room, so its traps are its own; only the runner is drawn in
// your level. Rivals sometimes trip and restart a room, and a rival far ahead waits for you, so the race stays close.
const ACTS2 = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 0, 1], [0, 1, 1], [0, 0, 1]].map(a => ({ left: !!a[0], right: !!a[1], jump: !!a[2] }));
const secSig = s => s.hand ? 'hand' : s.keys.join(',') + '|' + s.seed + (s.cave ? 'c' : '');
class Rivals2D {
  constructor(def, data, seed, si0 = 0) {
    this.def = def; this.data = data; this.fin = 0; const r0 = srand(seed);
    const names = RIVAL_NAMES.slice().sort(() => r0() - .5);
    this.list = data.runs.map((runs, i) => ({ i, name: names[i], col: RIVAL_COLS[(i * 2 + 1) % RIVAL_COLS.length], runs, trip: [.22, .14, .08][i % 3], wait: .5 + i * .6, done: false, place: 0, poof: 0 }));
    for (const r of this.list) this.start(r, si0);
  }
  start(r, si) {
    const n = this.def.secs.length, last = si === n - 1;
    r.si = si; r.ai = 0; r.sub = 0;
    r.w = new World(this.def, { silent: true, diff: 0, ck: si, only: last ? [si] : [si, si + 1] });
    r.acts = this.data.sig[si] === secSig(this.def.secs[si]) ? r.runs[si] : null;
    r.skipT = r.acts ? 0 : 8 + r.i;
    // now and then a rival slips and has to run the room again
    const h = Math.sin((si + 1) * 91.7 + r.i * 13.1 + (r.tries || 0) * 7.7) * 43758.5; r.fail = r.acts && h - Math.floor(h) < r.trip ? Math.floor(r.acts.length * (.3 + (h * 10 % 1) * .5)) : -1;
  }
  next(r) {
    if (r.si >= this.def.secs.length - 1) { r.done = true; r.place = ++this.fin; if (this.onDone) this.onDone(r); return; }
    r.tries = 0; this.start(r, r.si + 1);
  }
  // one fixed 1/120 s step (called with every step of your own world)
  tick(playerRoom) {
    for (const r of this.list) {
      if (r.done) continue;
      if (r.poof > 0) r.poof = Math.max(0, r.poof - 1 / 120);
      if (r.wait > 0) { r.wait -= 1 / 120; continue; }
      // a rival more than one room ahead waits at the start of its room
      if (r.si > playerRoom + 1 && r.ai === 0 && r.sub === 0) continue;
      if (!r.acts) { r.skipT -= 1 / 120; if (r.skipT <= 0) this.next(r); continue; }
      const w = r.w, a = r.acts.charCodeAt(r.ai) - 48;
      w.step(w.D.speed / 120, ACTS2[a] || ACTS2[0]);
      if (++r.sub >= 8) { r.sub = 0; r.ai++; }
      if (r.fail >= 0 && r.ai >= r.fail) { r.poof = .5; r.tries = (r.tries || 0) + 1; if (this.onTrip) this.onTrip(r); this.start(r, r.si); r.fail = -1; r.wait = .7; continue; }
      if (r.si < this.def.secs.length - 1 ? w.ck > r.si : w.state === 'win') { this.next(r); continue; }
      if (w.state === 'dead' || r.ai >= r.acts.length) { this.start(r, r.si); r.fail = -1; }
    }
  }
  rank(px) { let n = 1; for (const r of this.list) if (r.done || (!r.done && r.w.p.x > px)) n++; return n; }
  draw(t) {
    for (const r of this.list) {
      if (r.done || r.wait > 0 && r.si === 0 && r.ai === 0) continue;
      const p = r.w.p, cx = p.x + PW / 2;
      if (cx < CAMX - 120 || cx > CAMX + W + 120) continue;
      ctx.save(); ctx.globalAlpha = r.poof > 0 ? r.poof * 2 * (Math.floor(t * 20) % 2) : .92;
      ctx.translate(cx, p.g > 0 ? p.y + PHT : p.y); if (p.g < 0) ctx.scale(1, -1);
      HERO_OVR = r.col; drawHero(t, p.face, p.onGround, p.vx, p.vy * p.g, p.runPhase, 2, false); HERO_OVR = null;
      ctx.restore();
      ctx.save(); ctx.font = 'bold 13px Vazirmatn, Tahoma, sans-serif'; ctx.textAlign = 'center';
      const w = ctx.measureText(r.name).width + 10; ctx.fillStyle = 'rgba(10,6,24,.55)'; ctx.fillRect(cx - w / 2, p.y - 30, w, 17); ctx.fillStyle = r.col; ctx.fillText(r.name, cx, p.y - 17.5); ctx.restore();
    }
  }
}
