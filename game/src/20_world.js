/* ============================ LEVEL RUNTIME ============================ */
class Level {
  constructor(def, world, only) {
    this.def = def; this.w = world; this.d = world.d; this.D = world.D; this.uid = ++levelUid;
    this.ents = []; this.byId = {}; this.trigs = []; this.timers = []; this.t = 0; this.flags = [];
    if (def.secs) {
      // long scrolling level: sections placed one after another (each with its own x offset and id prefix)
      def.secs.forEach((sec, i) => { if (!only || only.includes(i)) this.addSec(sec, i, i === def.secs.length - 1 && !def.endless); });
      this.width = def.width * T;
    } else { def.build(this); this.width = W; this.link(0); }
  }
  link(from) { for (let j = from; j < this.ents.length; j++) { const e = this.ents[j]; if (e.parent) { const p = this.byId[e.parent]; e.par = p; e.offx = e.x - p.x; e.offy = e.y - p.y; } } }
  // one section of a long level (also used to grow the endless course while it is played)
  addSec(sec, i, last) {
    const n0 = this.ents.length, P = secBuilder(this, sec, i, last);
    sec.build(P); P.done();
    if (i > 0) this.flags.push(this.add('flag' + i, { type: 'flag', i, x: (sec.x0 + .45) * T, y: (sec.t0 - 2.6) * T, w: 14, h: 2.6 * T, on: false, wave: 0 }));
    this.link(n0);
    return this.ents.slice(n0);
  }
  add(id, e) {
    e.id = id; e.moves = []; e.dx = 0; e.dy = 0; e.shake = 0;
    if (Array.isArray(e.patrol)) e.patrol = { pts: e.patrol.map(p => [p[0] * T, p[1] * T]), sp: (e.speed || 3) * T * this.D.trapV, i: 1, jump: !!e.pjump };
    // any entity can circle around its starting point (orbit) or swing below a pivot (pendulum)
    if (e.orbit && e.ocx == null) { e.ocx = e.x; e.ocy = e.y; e.a = e.orbit.ph || 0; }
    if (e.pend) { e.pcx = e.x; e.pcy = e.y - e.pend.len * T; e.pt = 0; }
    if (e.blink) e.lt = e.blink.ph || 0;
    e.patrol0 = e.patrol || null;
    this.ents.push(e); if (id) this.byId[id] = e; return e;
  }
  block(id, x, y, w, h, o = {}) { return this.add(id, Object.assign({ type: 'block', x: x * T, y: y * T, w: w * T, h: h * T, hidden: false, appear: 1 }, o, o.hidden ? { appear: 0 } : {})); }
  spikes(id, x, y, n, dir = 'up', o = {}) {
    const vert = dir === 'up' || dir === 'down';
    return this.add(id, Object.assign({ type: 'spike', dir, n, x: x * T, y: y * T, w: vert ? n * T : T, h: vert ? T : n * T, hidden: false }, o, { pop: o.hidden ? 0 : 1 }));
  }
  door(x, y, o = {}) { return this.add('door', Object.assign({ type: 'door', x: x * T, y: y * T, w: 1.4 * T, h: 2 * T }, o)); }
  saw(id, cx, cy, r, o = {}) {
    const e = Object.assign({ type: 'saw', x: cx * T, y: cy * T, r: r * T, rot: 0 }, o);
    if (o.orbit) { e.ocx = cx * T; e.ocy = cy * T; e.a = o.orbit.ph || 0; e.x = e.ocx + Math.cos(e.a) * o.orbit.rad * T; e.y = e.ocy + Math.sin(e.a) * o.orbit.rad * T; }
    return this.add(id, e);
  }
  /* timed laser beam: dir 'h' or 'v', starts at (x,y) tiles, len tiles. on/off in seconds */
  laser(id, x, y, len, dir = 'h', o = {}) {
    const on = o.on ?? 1.1, off = (o.off ?? 1.4) * this.D.trapT;
    return this.add(id, Object.assign({ type: 'laser', dir, x: x * T, y: y * T, len: len * T, w: dir === 'h' ? len * T : 10, h: dir === 'h' ? 10 : len * T, on, off, lt: o.ph || 0, act: false, warn: false }, o.patrol ? { patrol: o.patrol, speed: o.speed } : {}));
  }
  /* secret portal: appears (opens) when openPortal(id) is called */
  portal(id, x, y, o = {}) { return this.add(id, Object.assign({ type: 'portal', x: x * T, y: y * T, w: 1.4 * T, h: 2 * T, open: 0, opening: false }, o)); }
  openPortal(id, delay = 0) {
    if (delay > 0) return this.at(delay, () => this.openPortal(id));
    const e = this.e(id); if (!e || e.opening) return; e.opening = true; this.sfx('orb'); this.shake(5); this.say('یه پرتال مخفی باز شد! 🌀');
    this.w.burst(e.x + e.w / 2, e.y + e.h / 2, 26, { col: '#c59bff', sp: 260, life: .7, add: true, size: 3 });
  }
  /* area effects: kind 'wind' (push fx/fy tiles per second, optional on/off timing), 'float' (gravity scale g), 'shade' (darkness) */
  zone(id, kind, x, y, w, h, o = {}) { return this.add(id, Object.assign({ type: 'zone', kind, x: x * T, y: y * T, w: w * T, h: h * T, act: true, lt: o.ph || 0 }, o)); }
  /* one-way teleporter: touching it moves the player to the entity 'to' */
  tele(id, x, y, to, o = {}) { return this.add(id, Object.assign({ type: 'tele', x: x * T, y: y * T, w: .9 * T, h: 1.6 * T, to, cd: 0 }, o)); }
  /* dash pad on the floor: run over it for a burst of speed */
  dash(id, x, y, o = {}) { return this.add(id, Object.assign({ type: 'dash', x: x * T, y: (y + 1) * T - 8, w: 2 * T, h: 8 }, o)); }
  spring(id, x, y, o = {}) { return this.add(id, Object.assign({ type: 'spring', x: x * T, y: (y + 1) * T - 16, w: T, h: 16, anim: 0 }, o)); }
  orb(id, cx, cy) { return this.add(id, { type: 'orb', x: cx * T, y: cy * T, r: 0.42 * T, cd: 0 }); }
  trig(x, y, w, h, fn, o = {}) { this.trigs.push({ x: x * T, y: y * T, w: w * T, h: h * T, fn, ground: !!o.ground, rising: !!o.rising, fired: false }); }
  e(id) { return typeof id === 'string' ? this.byId[id] : id; }
  move(id, dx, dy, speed, delay = 0) {
    const e = this.e(id); if (!e) return;
    const last = e.moves.length ? e.moves[e.moves.length - 1] : { tx: e.x, ty: e.y };
    e.moves.push({ tx: last.tx + dx * T, ty: last.ty + dy * T, sp: speed * T * this.D.trapV, delay: delay * this.D.trapT });
  }
  fall(id, delay = 0) { const e = this.e(id); if (!e || e.falling) return; e.falling = true; e.fallDelay = delay * this.D.trapT; e.vy = e.fallV || 0; e.moves = []; e.patrol = null; }
  pop(id, delay = 0) {
    if (delay > 0) return this.after(delay, () => this.pop(id));
    const e = this.e(id); if (!e || !e.hidden) return;
    e.hidden = false; e.popped = true;
    if (e.type === 'spike') e.pop = 0.001; else e.appear = 0.001;
    this.sfx(e.type === 'spike' ? 'pop' : 'appear');
    if (e.type === 'block') this.w.burst(e.x + e.w / 2, e.y + e.h / 2, 14, { col: '#9ef9dc', sp: 160, life: .5, add: true, size: 3, spreadX: e.w / 2 });
  }
  after(t, fn) { this.timers.push({ t: t * this.D.trapT, fn }); }
  at(t, fn) { this.timers.push({ t, fn }); }
  reverse(on) { if (this.w.rev === on) return; this.w.rev = on; this.sfx('orb'); this.shake(4); if (this.w.onRev) this.w.onRev(on); }
  shake(a) { this.w.shake(a); }
  sfx(n) { this.w.sfx(n); }
  say(t) { this.w.say(t); }
}
/* Builder handed to one section of a long level: same API as Level, but every x is shifted by the section's
   start column and every id gets a section prefix, so hand-made screens and generated chunks can be chained.
   Timers started while building (L.at) wait until the player reaches the section. Only the last section keeps its door. */
function secBuilder(L, sec, si, last) {
  const ox = sec.x0, pre = 's' + si + '.';
  const pid = id => typeof id === 'string' ? pre + id : id;
  const fixO = o => {
    if (!o) return o; const c = Object.assign({}, o);
    if (c.patrol) c.patrol = c.patrol.map(([x, y]) => [x + ox, y]);
    if (c.parent) c.parent = pid(c.parent); if (c.fake) c.fake = pid(c.fake);
    return c;
  };
  let building = true, npw = 0; const pend = [], gems = [];
  const P = {
    d: L.d, D: L.D, w: L.w, sec,
    add(id, e) { e.x += ox * T; if (e.fake) e.fake = pid(e.fake); return L.add(pid(id), e); },
    block: (id, x, y, w, h, o) => L.block(pid(id), x + ox, y, w, h, fixO(o)),
    spikes: (id, x, y, n, dir, o) => L.spikes(pid(id), x + ox, y, n, dir, fixO(o)),
    door: (x, y, o) => last ? L.add(pid('door'), Object.assign({ type: 'door', x: (x + ox) * T, y: y * T, w: 1.4 * T, h: 2 * T }, fixO(o))) : null,
    saw: (id, cx, cy, r, o) => L.saw(pid(id), cx + ox, cy, r, fixO(o)),
    laser: (id, x, y, len, dir, o) => L.laser(pid(id), x + ox, y, len, dir, fixO(o)),
    portal: (id, x, y, o) => L.portal(pid(id), x + ox, y, o),
    openPortal: (id, delay = 0) => delay > 0 ? P.at(delay, () => L.openPortal(pid(id))) : L.openPortal(pid(id)),
    spring: (id, x, y, o) => L.spring(pid(id), x + ox, y, fixO(o)),
    orb: (id, cx, cy) => L.orb(pid(id), cx + ox, cy),
    zone: (id, kind, x, y, w, h, o) => L.zone(pid(id), kind, x + ox, y, w, h, o),
    tele: (id, x, y, to, o) => L.tele(pid(id), x + ox, y, pid(to), o),
    dash: (id, x, y, o) => L.dash(pid(id), x + ox, y, o),
    gem: (x, y) => gems.push([x + ox, y]),
    pow: (x, y, kind) => L.add(pre + 'pw' + npw++, { type: 'pow', x: (x + ox) * T, y: y * T, w: 0, r: 15, kind, ph: npw }),
    trig: (x, y, w, h, fn, o) => L.trig(x + ox, y, w, h, () => fn(P, L.w), o),
    e: id => L.e(pid(id)),
    move: (id, dx, dy, sp, delay) => L.move(pid(id), dx, dy, sp, delay),
    fall: (id, delay) => L.fall(pid(id), delay),
    pop: (id, delay) => L.pop(pid(id), delay),
    after: (t, fn) => L.after(t, fn),
    at: (t, fn) => { if (building) pend.push([t, fn]); else L.at(t, fn); },
    reverse: on => L.reverse(on), shake: a => L.shake(a), sfx: n => L.sfx(n), say: t => L.say(t),
    done() {
      building = false;
      const solid = L.ents.filter(e => e.type === 'block' && !e.ghost && !e.hidden && !e.lava && !e.patrol && !e.orbit && !e.pend);
      gems.forEach(([gx, gy], i) => {
        let y = gy; const inside = yy => solid.some(e => gx * T > e.x - 14 && gx * T < e.x + e.w + 14 && yy * T > e.y - 14 && yy * T < e.y + e.h + 14);
        while (inside(y) && y > gy - 4) y -= .5;
        if (!inside(y) && y > .8) L.add(pre + 'gem' + i, { type: 'gem', x: gx * T, y: y * T, w: 0, r: 13, ph: i });
      });
      if (pend.length) L.trig(ox - 1, -4, sec.spawn[0] + 2, 26, () => pend.forEach(([t, fn]) => L.at(t, fn)));
    },
  };
  return P;
}

/* ============================ WORLD / PHYSICS ============================ */
class World {
  constructor(idx, opt = {}) {
    this.idx = typeof idx === 'number' ? idx : -1; this.def = typeof idx === 'number' ? LEVELS[idx] : idx; this.silent = !!opt.silent;
    this.dj = !!this.def.dj; this.winKind = 'door';
    this.secs = this.def.secs || null; this.ck = this.secs ? clamp(opt.ck || 0, 0, this.secs.length - 1) : 0; this.only = opt.only || null;
    this.d = clamp(opt.diff ?? 1, 0, DIFFS.length - 1); this.D = DIFFS[this.d];
    this.parts = []; this.shakeA = 0; this.flash = 0; this.time = 0; this.lightning = 0; this.lightT = 3;
    this.respawn(true);
  }
  respawn(first) {
    if (this.rev && this.onRev) this.onRev(false);
    this.rev = false; this.tog = 0; this.nmC = null;
    this.dark = !!this.def.dark || (!this.silent && mutOn('dark'));
    // endless course: only the sections around the checkpoint are built
    if (this.def.endless) { this.only = []; for (let i = Math.max(0, this.ck - 1); i < this.secs.length; i++) this.only.push(i); this.minX = this.secs[this.only[0]].x0 * T; }
    this.lv = new Level(this.def, this, this.only); this.lw = this.lv.width;
    if (!this.silent && Sound.msName === 'boss') Sound.setMusic(BIOME && BIOME.mus || 'dusk');   // a boss you died to waits asleep again
    // gems stay collected across deaths
    this.got = this.got || new Set(); let ng = 0;
    for (const e of this.lv.ents) if (e.type === 'gem') { ng++; if (this.got.has(e.id)) e.gone = true; }
    this.gemTotal = ng;
    const sec = this.secs ? this.secs[this.ck] : null;
    const [sx, sy] = sec ? [sec.x0 + sec.spawn[0], sec.spawn[1]] : this.def.spawn;
    this.p = { x: sx * T + (T - PW) / 2, y: (sy + 1) * T - PHT, w: PW, h: PHT, vx: 0, vy: 0, g: 1, face: 1, onGround: true, ground: null, coy: 0, buf: 0,
      jumpHeld: true, jumping: false, sx: 1, sy: 1, runPhase: 0, dustT: 0, winS: 1, rot: 0, blink: 2, landV: 0, air2: false };
    for (const f of this.lv.flags) f.on = f.i <= this.ck;
    this.look = 0; this.camX = this.camTarget(); this.act = this.lv.ents; this.actX = -1e9;
    this.state = 'play';
    if (!first) { this.burst(this.p.x + PW / 2, this.p.y + PHT / 2, 18, { col: '#fff1c9', sp: 220, life: .45, add: true, size: 3, inward: true }); this.sfx('spawn'); }
  }
  // endless course: new sections appended ahead, old ones far behind dropped. Returns what changed (for the 3D view).
  extend(add) {
    const d = this.def, n0 = d.secs.length; d.secs.push(...add); d.relayout();
    let added = [];
    for (let i = n0; i < d.secs.length; i++) { added = added.concat(this.lv.addSec(d.secs[i], i, false)); if (this.only) this.only.push(i); }
    this.lv.width = d.width * T; this.lw = this.lv.width;
    const keep = Math.max(0, this.ck - 1), cut = d.secs[keep].x0 * T - 300, dropped = new Set();
    for (const e of this.lv.ents) if (!e.moves.length && !e.patrol && (e.x + (e.w || 0) + (e.r || 0) < cut)) dropped.add(e);
    if (dropped.size) {
      this.lv.ents = this.lv.ents.filter(e => !dropped.has(e) || e === this.p.ground);
      for (const k in this.lv.byId) if (dropped.has(this.lv.byId[k])) delete this.lv.byId[k];
      this.lv.flags = this.lv.flags.filter(f => !dropped.has(f));
      this.only = this.only && this.only.filter(i => i >= keep);
      this.minX = Math.max(this.minX || 0, d.secs[keep].x0 * T);
    }
    for (const e of added) if (e.type === 'gem') { if (this.got.has(e.id)) e.gone = true; else this.gemTotal++; }
    this.actX = -1e9;
    return { added, dropped };
  }
  sfx(n) { if (!this.silent) Sound.play(n); }
  grabGem(e) {
    if (e.gone) return; e.gone = true; this.got.add(e.id); this.sfx('gem'); this.burst(e.x, e.y, 12, { col: '#7af7ff', sp: 180, life: .5, add: true, size: 3 });
    // combo: gems picked up quickly one after another are worth more (x2 from 5 in a row, x3 from 12)
    const C = this.combo || (this.combo = { n: 0, t: -9 }); C.n = this.time - C.t < 1.6 ? C.n + 1 : 1; C.t = this.time;
    const bonus = C.n >= 12 ? 2 : C.n >= 5 ? 1 : 0;
    if (bonus && !this.silent) this.parts.push({ x: e.x, y: e.y - 14, vx: 0, vy: -50, life: .9, max: .9, size: 0, col: bonus > 1 ? '#ffd36e' : '#9ef9ff', g: 0, drag: 0, txt: `×${faNum(bonus + 1)}` + (C.n === 5 || C.n === 12 ? ' کمبو!' : '') });
    if (this.onGem) this.onGem(e, bonus);
  }
  // switch blocks: every jump swaps which colour is solid
  flipTog() { this.tog ^= 1; if (!this.silent && this.act.some(e => e.tog != null && !e.gone)) Sound.play('tog'); }
  shake(a) { if (!this.silent) this.shakeA = Math.max(this.shakeA, a); }
  say(t) { if (!this.silent && this.onSay) this.onSay(t); }
  isSolid(e) { return e.type === 'block' && !e.hidden && !e.gone && !e.ghost && !e.off; }
  solids() { return this.act.filter(e => this.isSolid(e)); }
  // camera: keeps the player a bit left of centre, looking ahead in the running direction
  camTarget() { const m = this.minX || 0; return clamp(this.p.x + PW / 2 - W * .42 + this.look, m, Math.max(m, this.lw - W)); }
  // long levels: only entities within ~1.3 screens of the player are simulated (far ones wait, frozen)
  updAct() {
    const px = this.p.x;
    if (this.lw <= W + 1 || Math.abs(px - this.actX) < 40) return;
    this.actX = px; const a = px - 1700, b = px + 1900;
    this.act = this.lv.ents.filter(e => !e.gone && e.x + (e.w || 0) + (e.r || 0) + (e.orbit ? e.orbit.rad * T : 0) > a && e.x - (e.r || 0) - (e.orbit ? e.orbit.rad * T : 0) < b || e.moves.length > 0 && !e.gone);
  }

  step(dt, inp) {
    if (this.slowmo > 0) { this.slowmo -= dt; dt *= .3; }   // a short slow-motion moment when you die
    this.time += dt;
    this.updAct();
    if (this.state === 'play') {
      const lv = this.lv, edt = this.p.slowT > 0 ? dt * .45 : dt; lv.t += edt;
      for (let i = lv.timers.length - 1; i >= 0; i--) { const tm = lv.timers[i]; tm.t -= edt; if (tm.t <= 0) { lv.timers.splice(i, 1); tm.fn(); } }
      this.updateEntities(edt);
      if (this.state === 'play') this.updatePlayer(dt, inp);
      if (this.state === 'play') this.checkTriggers();
      if (this.state === 'play') this.checkHazards(dt);
      if (this.state === 'play' && this.lv.flags.length) this.checkFlags();
    } else if (this.state === 'dead') {
      this.updateEntities(dt, true);
      this.deadT -= dt; if (this.deadT <= 0) this.respawn(false);
    } else if (this.state === 'win') {
      this.updateEntities(dt, true);
      const p = this.p, d = this.winDoor; this.winT += dt;
      const tx = d.x + d.w / 2 - PW / 2, ty = d.y + d.h * 0.55 - PHT / 2;
      p.x = lerp(p.x, tx, Math.min(1, dt * 7)); p.y = lerp(p.y, ty, Math.min(1, dt * 7));
      p.winS = Math.max(0, 1 - this.winT * 1.6); p.rot += dt * 12;
      if (this.winT > 0.85 && !this.winFired) { this.winFired = true; if (this.onWin) this.onWin(); }
    }
    // particles
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i]; q.life -= dt;
      if (q.life <= 0) { this.parts.splice(i, 1); continue; }
      q.vx *= (1 - q.drag * dt); q.vy = q.vy * (1 - q.drag * dt) + q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
    }
    if (this.silent) this.parts.length = 0;
    if (this.state !== 'dead') { this.look = lerp(this.look, this.p.face * 70, Math.min(1, dt * 1.6)); this.camX = lerp(this.camX, this.camTarget(), Math.min(1, dt * 7)); }
    for (const f of this.lv.flags) if (f.wave > 0) f.wave = Math.max(0, f.wave - dt);
    this.shakeA = Math.max(0, this.shakeA - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    if (this.dark) { this.lightT -= dt; if (this.lightT <= 0) { this.lightning = 1; this.lightT = rand(2.6, 4.2); this.sfx('thunder'); } this.lightning = Math.max(0, this.lightning - dt * 3.2); }
  }

  updEnt(e, dt) {
    if (e.type === 'boss') return this.updBoss(e, dt);
    if (e.tog != null) { const want = e.tog === this.tog; if (!want) e.off = true; else if (e.off && !(this.state === 'play' && hit(this.p, e))) e.off = false; }
    if (e.type === 'spike' && !e.hidden && e.pop < 1) e.pop = Math.min(1, e.pop + dt / 0.07);
    if (e.type === 'block' && !e.hidden && e.appear < 1) e.appear = Math.min(1, e.appear + dt / 0.25);
    if (e.type === 'saw') e.rot += dt * 14;
    if (e.type === 'spring' && e.anim > 0) e.anim = Math.max(0, e.anim - dt * 3);
    if (e.type === 'orb' && e.cd > 0) e.cd -= dt;
    if (e.type === 'portal' && e.opening && e.open < 1) e.open = Math.min(1, e.open + dt * 1.6);
    if (e.type === 'laser') { e.lt += dt; const per = e.on + e.off, ph = e.lt % per; e.act = ph < e.on; e.warn = !e.act && ph > per - 0.4; }
    if (e.orbit) { e.a += e.orbit.w * dt * this.D.trapV; e.x = e.ocx + Math.cos(e.a) * e.orbit.rad * T; e.y = e.ocy + Math.sin(e.a) * e.orbit.rad * T; }
    if (e.pend) { e.pt += dt * this.D.trapV; const a = e.pend.amp * Math.sin(e.pend.w * e.pt + (e.pend.ph || 0)); e.x = e.pcx + Math.sin(a) * e.pend.len * T; e.y = e.pcy + Math.cos(a) * e.pend.len * T; }
    if (e.blink) { e.lt += dt; const b = e.blink, per = b.on + b.off * this.D.trapT, ph = e.lt % per; e.off = ph >= b.on; e.warn = !e.off && ph > b.on - .45; }
    if (e.type === 'zone' && e.on != null) { e.lt += dt; const per = e.on + e.off, ph = e.lt % per; e.act = ph < e.on; e.warn = !e.act && ph > per - .5; }
    if (e.type === 'tele' && e.cd > 0) e.cd -= dt;
    if (e.sink && e.sinking) { e.y += e.sink * T * dt; if (e.y > H + 200) e.gone = true; }
    if (e.par) return;
    if (e.falling) {
      if (e.fallDelay > 0) { e.fallDelay -= dt; e.shake = 1; return; }
      e.shake = 0; e.vy = Math.min(e.vy + PH.g * dt, 1500); e.y += e.vy * dt;
      if (e.type === 'block') {
        for (const s of this.act) {
          if (s !== e && this.isSolid(s) && !s.falling && hit(e, s)) {
            e.y = s.y - e.h; e.falling = false; e.vy = 0; e.landed = true;
            this.shake(10); this.sfx('thud');
            for (let k = 0; k < 22; k++) this.parts.push(this.mkPart(e.x + Math.random() * e.w, e.y + e.h, { col: '#8c7fb8', sp: 140, life: .7, size: rand(2, 5), g: 300, up: true }));
            break;
          }
        }
      }
      if (e.type === 'spike') {
        for (const s of this.act) {
          if (this.isSolid(s) && !s.falling && hit(e, s) && !(e.dir === 'down' && s.y + s.h <= e.y + 2)) {
            e.gone = true; this.sfx('crack'); this.shake(3);
            this.burst(e.x + e.w / 2, s.y, 16, { col: '#cfd3ef', sp: 220, life: .5, size: 2.5, g: 700, up: true, sq: true, spreadX: e.w / 2 });
            break;
          }
        }
      }
      if (e.y > H + 500) e.gone = true;
      return;
    }
    if (e.moves.length) {
      const m = e.moves[0];
      if (m.delay > 0) m.delay -= dt;
      else {
        const dx = m.tx - e.x, dy = m.ty - e.y, d = Math.hypot(dx, dy), st = m.sp * dt;
        if (d <= st) { e.x = m.tx; e.y = m.ty; e.moves.shift(); } else { e.x += dx / d * st; e.y += dy / d * st; }
      }
    } else if (e.patrol) {
      const pt = e.patrol.pts[e.patrol.i], dx = pt[0] - e.x, dy = pt[1] - e.y, d = Math.hypot(dx, dy), st = e.patrol.sp * dt;
      if (d <= st) { e.x = pt[0]; e.y = pt[1]; e.patrol.i = (e.patrol.i + 1) % e.patrol.pts.length; } else { e.x += dx / d * st; e.y += dy / d * st; }
    }
  }

  updateEntities(dt, noPlayer) {
    const p = this.p, ents = this.act;
    for (const e of ents) { if (e.gone || e.par) continue; const ox = e.x, oy = e.y; this.updEnt(e, dt); e.dx = e.x - ox; e.dy = e.y - oy; }
    for (const e of ents) {
      if (!e.par || e.gone) continue;
      const ox = e.x, oy = e.y; this.updEnt(e, dt);
      e.x = e.par.x + e.offx; e.y = e.par.y + e.offy; e.dx = e.x - ox; e.dy = e.y - oy; e.shake = e.par.shake;
      if (e.par.gone) e.gone = true;
    }
    if (noPlayer) return;
    for (const e of ents) {
      if (!this.isSolid(e) || (!e.dx && !e.dy) || (e.oneway && p.ground !== e)) continue;
      if (p.ground === e && !e.falling) { p.x += e.dx; p.y += e.dy; continue; }
      if (hit(p, { x: e.x, y: e.y, w: e.w, h: e.h })) {
        if (Math.abs(e.dx) > Math.abs(e.dy)) p.x = e.dx > 0 ? e.x + e.w : e.x - PW;
        else if (e.dy > 0) { p.y = e.y + e.h; p.vy = Math.max(p.vy, e.dy / dt); }
        else { p.y = e.y - PHT; p.vy = Math.min(p.vy, 0); }
      }
    }
    const pr = { x: p.x + 1, y: p.y + 1, w: PW - 2, h: PHT - 2 };
    for (const e of ents) if (this.isSolid(e) && !e.oneway && hit(pr, e)) { this.die('crush', e); return; }
  }

  updatePlayer(dt, inp) {
    const p = this.p, g = p.g;
    // area effects around the player
    let wx = 0, wy = 0, gk = 1; this.shade = false; this.cave = false;
    for (const e of this.act) {
      if (e.type !== 'zone' || e.gone || !e.act || !hit(p, e)) continue;
      if (e.kind === 'wind') { wx += (e.fx || 0) * T; wy += (e.fy || 0) * T; }
      else if (e.kind === 'float') gk = Math.min(gk, e.g || .4);
      else if (e.kind === 'shade') this.shade = true;
      else if (e.kind === 'cave') this.cave = true;
    }
    if (p.dashT > 0) p.dashT -= dt;
    if (p.kickT > 0) { p.kickT -= dt; if (p.onGround) p.kickT = 0; }
    if (!this.silent) petStep(this, dt);
    for (const k of POW_T) if (p[k] > 0) { p[k] -= dt; if (p[k] <= 0) { p[k] = 0; if (k !== 'inv') this.sfx('pop'); } }
    // last safe standing spot (for the shield's rescue from a fall)
    const gr = p.ground; if (p.onGround && gr && gr.type === 'block' && !gr.falling && !gr.sink && !gr.blink && !gr.moves.length && !gr.patrol && !gr.orbit && !gr.pend && !gr.par && !gr.lava && !gr.oneway) { const sf = p.safe || (p.safe = [0, 0, 1]); sf[0] = p.x; sf[1] = p.y; sf[2] = p.g; }
    if (this.minX && p.x < this.minX) { p.x = this.minX; if (p.vx < 0) p.vx = 0; }   // endless: the course behind is gone
    const dir = ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * (this.rev ? -1 : 1);
    const onIce = p.onGround && p.ground && p.ground.ice;
    if (p.onGround) p.air2 = false;
    if (dir) {
      p.face = dir;
      let acc = p.onGround ? (onIce ? 900 : PH.accG) : PH.accA;
      if (Math.sign(p.vx) !== dir && p.vx !== 0) acc *= onIce ? 0.9 : 1.7;
      if (p.kickT > 0) acc *= .2;
      const mx = Math.max(PH.run * (p.dashT > 0 ? 1.9 : 1) * (p.starT > 0 ? 1.22 : 1), p.kickT > 0 ? Math.abs(p.vx) : 0);
      p.vx = clamp(p.vx + dir * acc * dt, -mx, mx);
    } else {
      const f = (p.onGround ? (onIce ? 210 : PH.fric) : PH.fric * (p.kickT > 0 ? 0 : 0.45)) * dt;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
    }
    if (inp.jump && !p.jumpHeld) p.buf = this.D.buf;
    p.jumpHeld = inp.jump;
    p.buf -= dt;
    p.coy = p.onGround ? this.D.coyote : p.coy - dt;
    if (p.buf > 0 && p.coy > 0) {
      p.vy = -PH.jump * g; p.buf = 0; p.coy = 0; p.onGround = false; p.ground = null; p.jumping = true; this.flipTog(); if (this.onJump) this.onJump();
      p.sx = 0.72; p.sy = 1.3; this.sfx('jump');
      for (let k = 0; k < 7; k++) this.parts.push(this.mkPart(p.x + PW / 2, g > 0 ? p.y + PHT : p.y, { col: '#b8acdf', sp: 90, life: .35, size: rand(2, 4), g: 200 * g, up: g > 0 }));
    }
    else if ((this.dj || p.jumpT > 0) && p.buf > 0 && !p.air2 && !p.onGround && p.coy <= 0) {
      p.vy = -PH.jump * 0.92 * g; p.buf = 0; p.air2 = true; p.jumping = true; this.flipTog(); p.sx = 0.75; p.sy = 1.25; this.sfx('spring');
      this.parts.push({ x: p.x + PW / 2, y: g > 0 ? p.y + PHT : p.y, vx: 0, vy: 0, life: .35, max: .35, size: 0, col: '#9ef9dc', g: 0, drag: 0, ring: true });
      for (let k = 0; k < 8; k++) this.parts.push(this.mkPart(p.x + PW / 2, g > 0 ? p.y + PHT : p.y, { col: '#9ef9dc', sp: 110, life: .4, size: rand(2, 3.5), g: 120 * g, add: true }));
    }
    if (!inp.jump && p.jumping && p.vy * g < -PH.cut) p.vy = -PH.cut * g;
    if (p.vy * g >= 0) p.jumping = false;
    p.vy += PH.g * g * dt * gk + wy * dt * 4;
    const mf = PH.maxFall * (gk < 1 ? .45 : 1); if (p.vy * g > mf) p.vy = mf * g;

    const sol = this.solids();
    // X
    if (p.onGround && p.ground && p.ground.conv) p.x += p.ground.conv * T * dt;
    const ox = p.x; p.x += p.vx * dt + wx * dt;
    for (const s of sol) if (!s.oneway && hit(p, s)) { if (p.x > ox) p.x = s.x - PW; else if (p.x < ox) p.x = s.x + s.w; p.vx = 0; }
    if (p.x < 0) { p.x = 0; p.vx = 0; } if (p.x > this.lw - PW) { p.x = this.lw - PW; p.vx = 0; }
    // Y
    const was = p.onGround, vyBefore = p.vy, oy = p.y;
    p.onGround = false; p.ground = null;
    p.y += p.vy * dt;
    for (const s of sol) if (hit(p, s)) {
      // one-way planks only hold you when you come down onto them from above
      if (s.oneway) { if (g > 0 && p.vy >= 0 && oy + PHT <= s.y + 2) { p.y = s.y - PHT; p.onGround = true; p.ground = s; p.vy = 0; } continue; }
      if (p.vy > 0) { p.y = s.y - PHT; if (g > 0) { p.onGround = true; p.ground = s; } }
      else if (p.vy < 0) { p.y = s.y + s.h; if (g < 0) { p.onGround = true; p.ground = s; } }
      p.vy = 0;
    }
    if (p.onGround && !was && Math.abs(vyBefore) > 260) {
      const k = clamp(Math.abs(vyBefore) / 900, 0.15, 0.5);
      p.sx = 1 + k; p.sy = 1 - k * 0.8; this.sfx('land');
      for (let i = 0; i < 9; i++) this.parts.push(this.mkPart(p.x + PW / 2 + rand(-10, 10), g > 0 ? p.y + PHT : p.y, { col: '#b8acdf', sp: 120, life: .4, size: rand(2, 4.5), g: 250 * g, up: g > 0, side: true }));
    }
    if (p.ground && p.ground.crumble && !p.ground.falling) { this.lv.fall(p.ground, p.ground.crumble); this.sfx('crack'); }
    if (p.ground && p.ground.sink && !p.ground.sinking) { p.ground.sinking = true; this.sfx('rumble'); }
    // trampolines throw you up as soon as you land on them
    if (p.ground && p.ground.bounce && g > 0) {
      p.vy = -p.ground.bounce * T; p.onGround = false; p.ground = null; p.jumping = false; p.coy = 0; p.sx = .7; p.sy = 1.4; this.sfx('spring');
      this.burst(p.x + PW / 2, p.y + PHT, 10, { col: '#ff8fd0', sp: 180, life: .4, size: 3, g: 300, up: true, add: true });
    }
    // animation state
    p.sx = lerp(p.sx, 1, Math.min(1, dt * 12)); p.sy = lerp(p.sy, 1, Math.min(1, dt * 12));
    if (p.onGround && Math.abs(p.vx) > 40) {
      p.runPhase += dt * Math.abs(p.vx) * 0.055;
      p.dustT -= dt;
      if (p.dustT <= 0) { p.dustT = 0.09; this.parts.push(this.mkPart(p.x + PW / 2 - p.face * 8, g > 0 ? p.y + PHT : p.y, { col: '#9d92c8', sp: 40, life: .35, size: rand(1.5, 3.5), g: -40 * g })); }
    }
    p.blink -= dt; if (p.blink < -0.12) p.blink = rand(1.8, 4);
  }

  checkTriggers() {
    const p = this.p;
    for (const t of this.lv.trigs) {
      if (t.fired || (t.ground && !p.onGround) || (t.rising && p.vy * p.g >= 0)) continue;
      if (hit(p, t)) { t.fired = true; t.fn(this.lv, this); }
    }
  }

  spikeBox(e) {
    const m = 7 + this.D.sm;
    switch (e.dir) {
      case 'up': return { x: e.x + m, y: e.y + T * 0.36, w: e.w - m * 2, h: T * 0.64 };
      case 'down': return { x: e.x + m, y: e.y, w: e.w - m * 2, h: T * 0.64 };
      case 'right': return { x: e.x, y: e.y + m, w: T * 0.64, h: e.h - m * 2 };
      default: return { x: e.x + T * 0.36, y: e.y + m, w: T * 0.64, h: e.h - m * 2 };
    }
  }

  checkFlags() {
    const p = this.p, cx = p.x + PW / 2;
    for (const f of this.lv.flags) if (!f.on && cx >= f.x) {
      f.on = true; f.wave = .8;
      if (f.i > this.ck) { this.ck = f.i; this.sfx('gem'); this.burst(f.x + 8, f.y + 14, 24, { col: '#9ef9dc', sp: 240, life: .6, add: true, size: 3 }); if (this.onCheckpoint) this.onCheckpoint(f.i); }
    }
  }
  checkHazards(dt) {
    const p = this.p;
    for (const e of this.act) {
      if (e.gone || e.hidden) continue;
      if (e.type === 'spike') { if (!e.fake && !e.off && e.pop > 0.6) { const sb = this.spikeBox(e); if (hit(p, sb)) return this.die(e.arrow ? 'arrow' : 'spike', e); if (!this.silent && e.pop >= 1 && hit(p, { x: sb.x - 11, y: sb.y - 11, w: sb.w + 22, h: sb.h + 22 })) this.nearChk(e); } }
      else if (e.type === 'tele') {
        if (e.cd <= 0 && hit(p, e)) { const d = this.lv.e(e.to); if (d) {
          this.burst(p.x + PW / 2, p.y + PHT / 2, 16, { col: '#7af7ff', sp: 200, life: .45, add: true, size: 3 });
          p.x = d.x + (d.w - PW) / 2; p.y = d.y + d.h - PHT - 2; e.cd = d.cd = .6; this.sfx('orb'); this.actX = -1e9;
          this.burst(p.x + PW / 2, p.y + PHT / 2, 16, { col: '#c59bff', sp: 200, life: .45, add: true, size: 3 }); } }
      }
      else if (e.type === 'pow') { if (!this.silent && circRect(e.x, e.y, e.r, p.x, p.y, PW, PHT)) this.grabPow(e); }
      else if (e.type === 'gem') {
        if (p.magT > 0) { const dx = p.x + PW / 2 - e.x, dy = p.y + PHT / 2 - e.y, d = Math.hypot(dx, dy); if (d < 190 && d > 1) { const s = Math.min(d, (260 + (190 - d) * 4) * dt); e.x += dx / d * s; e.y += dy / d * s; } }
        if (circRect(e.x, e.y, e.r, p.x, p.y, PW, PHT)) this.grabGem(e);
      }
      else if (e.type === 'zone' && e.kind === 'plate') { if (!e.down && p.onGround && hit(p, { x: e.x, y: e.y - 4, w: e.w, h: e.h + 4 })) { e.down = true; this.sfx('click'); } }
      else if (e.type === 'dash') { if (p.onGround && hit(p, e)) { if (!(p.dashT > 0)) this.sfx('whoosh'); p.dashT = .6; p.vx = PH.run * 1.9 * (e.dir || 1); } }
      else if (e.type === 'boss') { if (e.hp > 0 && hit(p, { x: e.x + 14, y: e.y + 18, w: e.w - 28, h: e.h - 18 })) return this.die('boss', e); }
      else if (e.type === 'saw') { if (circRect(e.x, e.y, e.r * this.D.saw, p.x, p.y, PW, PHT)) return this.die('saw', e); if (!this.silent && circRect(e.x, e.y, e.r * this.D.saw + 16, p.x, p.y, PW, PHT)) this.nearChk(e); }
      else if (e.type === 'laser') { if (e.act && hit(p, { x: e.x + (e.dir === 'h' ? 0 : -1), y: e.y + (e.dir === 'h' ? -1 : 0), w: e.w + (e.dir === 'h' ? 0 : 2), h: e.h + (e.dir === 'h' ? 2 : 0) })) return this.die('laser', e); }
      else if (e.type === 'block' && e.lava) { if (hit(p, { x: e.x, y: e.y + 8, w: e.w, h: e.h })) return this.die('lava', e); }
      else if (e.type === 'portal') { if (e.open > 0.9 && hit(p, { x: e.x + 10, y: e.y + 12, w: e.w - 20, h: e.h - 20 })) return this.win(e, 'portal'); }
      else if (e.type === 'door') {
        if (e.fake) { const inner = { x: e.x + 12, y: e.y + 16, w: e.w - 24, h: e.h - 16 }; if (hit(p, inner)) { e.gone = true; this.lv.pop(e.fake); this.say('در قلابی بود!'); this.shake(6); } continue; }
        const inner = e.flip ? { x: e.x + 12, y: e.y, w: e.w - 24, h: e.h - 16 } : { x: e.x + 12, y: e.y + 16, w: e.w - 24, h: e.h - 16 };
        if (hit(p, inner)) return this.win(e);
      }
      else if (e.type === 'spring') {
        if (p.g > 0 && p.vy >= 0 && hit(p, { x: e.x + 5, y: e.y - 2, w: e.w - 10, h: e.h + 2 })) {
          p.vy = -PH.spring * (e.kp || 1); p.onGround = false; p.ground = null; p.jumping = false; p.coy = 0; p.buf = 0;
          if (e.kick) { p.vx = e.kick * T; p.kickT = .5; p.face = Math.sign(e.kick); }
          p.sx = 0.65; p.sy = 1.45; e.anim = 1; this.sfx('spring');
          for (let k = 0; k < 12; k++) this.parts.push(this.mkPart(e.x + T / 2, e.y, { col: '#ffd36e', sp: 200, life: .45, size: rand(2, 4), g: 400, up: true, add: true }));
        }
      }
      else if (e.type === 'orb') {
        if (e.cd <= 0 && circRect(e.x, e.y, e.r, p.x, p.y, PW, PHT)) {
          e.cd = 0.6; p.g *= -1; p.vy *= 0.25; p.onGround = false; p.ground = null; p.jumping = false; this.sfx('orb'); this.shake(4);
          this.burst(e.x, e.y, 22, { col: '#c59bff', sp: 260, life: .5, add: true, size: 3 });
        }
      }
    }
    if (p.y > H + 60 || p.y < -110) return this.die('fall');
    if (this.nmC && this.nmC.size) this.nearTick();
  }
  /* near misses: a trap you brushed past (inside a small margin) and left alive */
  nearChk(e) { (this.nmC || (this.nmC = new Set())).add(e); e.nmIn = this.time; }
  nearTick() {
    for (const e of this.nmC) {
      if (this.time - e.nmIn < .06) continue;
      this.nmC.delete(e);
      if (this.time < (e.nmT || 0) || this.time < (this.nmT || 0) || (this.p.onGround && Math.abs(this.p.vx) < 60)) continue;
      e.nmT = this.time + 3; this.nmT = this.time + 1.2;
      this.parts.push({ x: this.p.x + PW / 2, y: this.p.y - 16, vx: 0, vy: -45, life: .9, max: .9, size: 0, col: '#ffd36e', g: 0, drag: 0, txt: 'نزدیک بود! 😅' });
      if (this.onNear) this.onNear(e);
    }
  }

  /* In-place snapshot of all gameplay state. Closures in triggers/timers stay valid because the same Level object is reused. */
  // sub: optional list of entity indexes to keep (things that never change can be left out by a search)
  save(sub) {
    const K = ['x', 'y', 'dx', 'dy', 'hidden', 'gone', 'falling', 'fallDelay', 'vy', 'pop', 'appear', 'shake', 'anim', 'cd', 'rot', 'landed', 'open', 'opening', 'lt', 'a', 'act', 'warn', 'on', 'pt', 'off', 'sinking', 'down', 'hp', 'bt', 'bp', 'stun', 'awake', 'hurt', 'dead'];
    const lv = this.lv, ents = lv.ents;
    // which entities are simulated (the window around the player) is part of the state: it decides when far traps start moving
    let actI = null;
    if (this.act !== ents) { if (this.act.some(e => ents[e.ix] !== e)) ents.forEach((e, i) => { e.ix = i; }); actI = this.act.map(e => e.ix); }
    return { ck: this.ck, camX: this.camX, look: this.look, actX: this.actX, actI,
      ents: (sub ? sub.map(i => ents[i]) : ents).map(e => { const o = { pi: e.patrol ? e.patrol.i : -1, moves: e.moves.map(m => ({ tx: m.tx, ty: m.ty, sp: m.sp, delay: m.delay })) }; for (const k of K) o[k] = e[k]; return o; }),
      p: Object.assign({}, this.p, { ground: ents.indexOf(this.p.ground) }),
      trigs: lv.trigs.slice(), fired: lv.trigs.map(t => t.fired),
      timers: lv.timers.map(t => ({ t: t.t, fn: t.fn })), lt: lv.t,
      state: this.state, tog: this.tog, deadT: this.deadT, winT: this.winT, winFired: this.winFired, winDoor: ents.indexOf(this.winDoor), winKind: this.winKind, rev: this.rev, time: this.time,
    };
  }
  load(sn, sub) {
    const K = ['x', 'y', 'dx', 'dy', 'hidden', 'gone', 'falling', 'fallDelay', 'vy', 'pop', 'appear', 'shake', 'anim', 'cd', 'rot', 'landed', 'open', 'opening', 'lt', 'a', 'act', 'warn', 'on', 'pt', 'off', 'sinking', 'down', 'hp', 'bt', 'bp', 'stun', 'awake', 'hurt', 'dead'];
    const lv = this.lv, ents = lv.ents;
    this.ck = sn.ck; this.camX = sn.camX; this.look = sn.look;
    if (sn.actX != null) { this.actX = sn.actX; this.act = sn.actI ? sn.actI.map(i => ents[i]) : ents; } else this.actX = -1e9;
    (sub ? sub.map(i => ents[i]) : ents).forEach((e, i) => { const o = sn.ents[i]; for (const k of K) e[k] = o[k]; e.moves = o.moves.map(m => Object.assign({}, m)); e.patrol = o.pi >= 0 ? e.patrol0 : null; if (e.patrol) e.patrol.i = o.pi; });
    this.p = Object.assign({}, sn.p, { ground: sn.p.ground >= 0 ? ents[sn.p.ground] : null });
    lv.trigs = sn.trigs.slice(); lv.trigs.forEach((t, i) => t.fired = sn.fired[i]);
    lv.timers = sn.timers.map(t => ({ t: t.t, fn: t.fn })); lv.t = sn.lt;
    this.state = sn.state; this.tog = sn.tog || 0; this.deadT = sn.deadT; this.winT = sn.winT; this.winFired = sn.winFired; this.winDoor = sn.winDoor >= 0 ? ents[sn.winDoor] : null; this.winKind = sn.winKind; this.rev = sn.rev; this.time = sn.time;
    this.parts.length = 0;
  }

  mkPart(x, y, o) {
    const a = o.up ? rand(-Math.PI * 0.95, -Math.PI * 0.05) : o.side ? (Math.random() < .5 ? rand(-0.4, 0) : rand(-Math.PI, -Math.PI + 0.4)) : rand(0, Math.PI * 2);
    const sp = (o.sp || 100) * rand(0.35, 1);
    const life = (o.life || .5) * rand(0.6, 1);
    return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * (o.up === false ? -1 : 1), life, max: life, size: o.size || 3, col: o.col || '#fff', g: o.g || 0, drag: o.drag ?? 2.5, add: !!o.add, sq: !!o.sq };
  }
  burst(x, y, n, o = {}) {
    n = this.silent ? 0 : Math.max(1, Math.round(n * GFX.fx * Perf.fxK));
    for (let i = 0; i < n; i++) {
      const q = this.mkPart(x + (o.spreadX ? rand(-o.spreadX, o.spreadX) : 0), y, o);
      if (o.inward) { q.x += q.vx * 0.3; q.y += q.vy * 0.3; q.vx *= -1; q.vy *= -1; }
      this.parts.push(q);
    }
  }

  grabPow(e) {
    const p = this.p, P = POWS[e.kind]; e.gone = true; this.sfx('orb');
    this.burst(e.x, e.y, 26, { col: P.col, sp: 260, life: .6, add: true, size: 3 });
    this.parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: .45, max: .45, size: 0, col: P.col, g: 0, drag: 0, ring: true });
    if (e.kind === 'shield') p.shield = true; else p[P.t] = P.dur;
    if (this.onPick) this.onPick('pow:' + e.kind);
  }
  // shield or star: hazards don't kill. Falls and crushes still do (the shield even rescues from a fall)
  saved(cause) {
    const p = this.p;
    if (cause === 'crush') return false;
    if ((p.starT > 0 || p.inv > 0) && cause !== 'fall') return true;
    if (!p.shield || cause === 'fall' && !p.safe) return false;
    p.shield = false; p.inv = 1.5; this.shake(8); this.sfx('orb'); this.flash = .5;
    this.burst(p.x + PW / 2, p.y + PHT / 2, 30, { col: '#7af7ff', sp: 320, life: .6, add: true, size: 3 });
    if (cause === 'fall') { [p.x, p.y, p.g] = p.safe; p.vx = 0; p.vy = 0; p.onGround = false; p.ground = null; this.actX = -1e9; }
    else { p.vy = -PH.jump * 1.05 * p.g; p.onGround = false; p.ground = null; p.jumping = false; }
    if (this.onPick) this.onPick('shieldUsed');
    return true;
  }
  die(cause, src) {
    if (this.state !== 'play' || this.saved(cause)) return;
    const p = this.p; this.state = 'dead'; this.deadT = 0.85; this.nmC = null; this.flash = 1; if (!this.silent && CFG.slowmo !== false) this.slowmo = .32;
    const cx = p.x + PW / 2, cy = p.y + PHT / 2;
    if (this.silent || !deathFx(this, cx, cy)) {
      this.burst(cx, cy, 26, { col: '#ffe9c4', sp: 420, life: .9, size: 4.5, g: 900, drag: 1.2, sq: true });
      this.burst(cx, cy, 14, { col: '#ff7a45', sp: 380, life: .8, size: 4, g: 900, drag: 1.2, sq: true });
      this.burst(cx, cy, 18, { col: '#ffb36b', sp: 520, life: .45, size: 2.5, add: true });
    }
    this.parts.push({ x: cx, y: cy, vx: 0, vy: 0, life: .4, max: .4, size: 0, col: '#fff', g: 0, drag: 0, ring: true });
    this.shake(16); this.sfx('die');
    if (this.onDeath) this.onDeath(cause, src);
  }
  win(door, kind = 'door') {
    if (this.state !== 'play') return;
    this.state = 'win'; this.winT = 0; this.winDoor = door; this.winFired = false; this.winKind = kind;
    this.sfx('win'); this.burst(door.x + door.w / 2, door.y + door.h / 2, 40, { col: '#ffe08a', sp: 320, life: .9, add: true, size: 3 });
  }
}

