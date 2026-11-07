/* ============================ LEVEL RUNTIME ============================ */
class Level {
  constructor(def, world) {
    this.def = def; this.w = world; this.d = world.d; this.D = world.D; this.uid = ++levelUid;
    this.ents = []; this.byId = {}; this.trigs = []; this.timers = []; this.t = 0;
    def.build(this);
    for (const e of this.ents) if (e.parent) { const p = this.byId[e.parent]; e.par = p; e.offx = e.x - p.x; e.offy = e.y - p.y; }
  }
  add(id, e) {
    e.id = id; e.moves = []; e.dx = 0; e.dy = 0; e.shake = 0;
    if (Array.isArray(e.patrol)) e.patrol = { pts: e.patrol.map(p => [p[0] * T, p[1] * T]), sp: (e.speed || 3) * T * this.D.trapV, i: 1 };
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
    return this.add(id, { type: 'laser', dir, x: x * T, y: y * T, len: len * T, w: dir === 'h' ? len * T : 10, h: dir === 'h' ? 10 : len * T, on, off, lt: o.ph || 0, act: false, warn: false });
  }
  /* secret portal: appears (opens) when openPortal(id) is called */
  portal(id, x, y, o = {}) { return this.add(id, Object.assign({ type: 'portal', x: x * T, y: y * T, w: 1.4 * T, h: 2 * T, open: 0, opening: false }, o)); }
  openPortal(id, delay = 0) {
    if (delay > 0) return this.at(delay, () => this.openPortal(id));
    const e = this.e(id); if (!e || e.opening) return; e.opening = true; this.sfx('orb'); this.shake(5); this.say('یه پرتال مخفی باز شد! 🌀');
    this.w.burst(e.x + e.w / 2, e.y + e.h / 2, 26, { col: '#c59bff', sp: 260, life: .7, add: true, size: 3 });
  }
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
    e.hidden = false;
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

/* ============================ WORLD / PHYSICS ============================ */
class World {
  constructor(idx, opt = {}) {
    this.idx = typeof idx === 'number' ? idx : -1; this.def = typeof idx === 'number' ? LEVELS[idx] : idx; this.silent = !!opt.silent;
    this.dj = !!this.def.dj; this.winKind = 'door';
    this.rooms = this.def.rooms || [this.def]; this.room = clamp(opt.room || 0, 0, this.rooms.length - 1);
    this.d = clamp(opt.diff ?? 1, 0, DIFFS.length - 1); this.D = DIFFS[this.d];
    this.parts = []; this.shakeA = 0; this.flash = 0; this.time = 0; this.lightning = 0; this.lightT = 3;
    this.respawn(true);
  }
  respawn(first) {
    if (this.rev && this.onRev) this.onRev(false);
    this.rev = false;
    this.rdef = this.rooms[this.room]; this.dark = !!(this.rdef.dark ?? this.def.dark);
    this.lv = new Level(this.rdef, this);
    const [sx, sy] = this.rdef.spawn;
    this.p = { x: sx * T + (T - PW) / 2, y: (sy + 1) * T - PHT, w: PW, h: PHT, vx: 0, vy: 0, g: 1, face: 1, onGround: true, ground: null, coy: 0, buf: 0,
      jumpHeld: true, jumping: false, sx: 1, sy: 1, runPhase: 0, dustT: 0, winS: 1, rot: 0, blink: 2, landV: 0, air2: false };
    this.state = 'play';
    if (!first) { this.burst(this.p.x + PW / 2, this.p.y + PHT / 2, 18, { col: '#fff1c9', sp: 220, life: .45, add: true, size: 3, inward: true }); this.sfx('spawn'); }
  }
  sfx(n) { if (!this.silent) Sound.play(n); }
  shake(a) { if (!this.silent) this.shakeA = Math.max(this.shakeA, a); }
  say(t) { if (!this.silent && this.onSay) this.onSay(t); }
  isSolid(e) { return e.type === 'block' && !e.hidden && !e.gone && !e.ghost; }
  solids() { return this.lv.ents.filter(e => this.isSolid(e)); }

  step(dt, inp) {
    this.time += dt;
    if (this.state === 'play') {
      const lv = this.lv; lv.t += dt;
      for (let i = lv.timers.length - 1; i >= 0; i--) { const tm = lv.timers[i]; tm.t -= dt; if (tm.t <= 0) { lv.timers.splice(i, 1); tm.fn(); } }
      this.updateEntities(dt);
      if (this.state === 'play') this.updatePlayer(dt, inp);
      if (this.state === 'play') this.checkTriggers();
      if (this.state === 'play') this.checkHazards(dt);
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
    this.shakeA = Math.max(0, this.shakeA - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    if (this.dark) { this.lightT -= dt; if (this.lightT <= 0) { this.lightning = 1; this.lightT = rand(2.6, 4.2); this.sfx('thunder'); } this.lightning = Math.max(0, this.lightning - dt * 3.2); }
  }

  updEnt(e, dt) {
    if (e.type === 'spike' && !e.hidden && e.pop < 1) e.pop = Math.min(1, e.pop + dt / 0.07);
    if (e.type === 'block' && !e.hidden && e.appear < 1) e.appear = Math.min(1, e.appear + dt / 0.25);
    if (e.type === 'saw') e.rot += dt * 14;
    if (e.type === 'spring' && e.anim > 0) e.anim = Math.max(0, e.anim - dt * 3);
    if (e.type === 'orb' && e.cd > 0) e.cd -= dt;
    if (e.type === 'portal' && e.opening && e.open < 1) e.open = Math.min(1, e.open + dt * 1.6);
    if (e.type === 'laser') { e.lt += dt; const per = e.on + e.off, ph = e.lt % per; e.act = ph < e.on; e.warn = !e.act && ph > per - 0.4; }
    if (e.orbit) { e.a += e.orbit.w * dt * this.D.trapV; e.x = e.ocx + Math.cos(e.a) * e.orbit.rad * T; e.y = e.ocy + Math.sin(e.a) * e.orbit.rad * T; }
    if (e.par) return;
    if (e.falling) {
      if (e.fallDelay > 0) { e.fallDelay -= dt; e.shake = 1; return; }
      e.shake = 0; e.vy = Math.min(e.vy + PH.g * dt, 1500); e.y += e.vy * dt;
      if (e.type === 'block') {
        for (const s of this.lv.ents) {
          if (s !== e && this.isSolid(s) && !s.falling && hit(e, s)) {
            e.y = s.y - e.h; e.falling = false; e.vy = 0; e.landed = true;
            this.shake(10); this.sfx('thud');
            for (let k = 0; k < 22; k++) this.parts.push(this.mkPart(e.x + Math.random() * e.w, e.y + e.h, { col: '#8c7fb8', sp: 140, life: .7, size: rand(2, 5), g: 300, up: true }));
            break;
          }
        }
      }
      if (e.type === 'spike') {
        for (const s of this.lv.ents) {
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
    const p = this.p, ents = this.lv.ents;
    for (const e of ents) { if (e.gone || e.par) continue; const ox = e.x, oy = e.y; this.updEnt(e, dt); e.dx = e.x - ox; e.dy = e.y - oy; }
    for (const e of ents) {
      if (!e.par || e.gone) continue;
      const ox = e.x, oy = e.y; this.updEnt(e, dt);
      e.x = e.par.x + e.offx; e.y = e.par.y + e.offy; e.dx = e.x - ox; e.dy = e.y - oy; e.shake = e.par.shake;
      if (e.par.gone) e.gone = true;
    }
    if (noPlayer) return;
    for (const e of ents) {
      if (!this.isSolid(e) || (!e.dx && !e.dy)) continue;
      if (p.ground === e && !e.falling) { p.x += e.dx; p.y += e.dy; continue; }
      if (hit(p, { x: e.x, y: e.y, w: e.w, h: e.h })) {
        if (Math.abs(e.dx) > Math.abs(e.dy)) p.x = e.dx > 0 ? e.x + e.w : e.x - PW;
        else if (e.dy > 0) { p.y = e.y + e.h; p.vy = Math.max(p.vy, e.dy / dt); }
        else { p.y = e.y - PHT; p.vy = Math.min(p.vy, 0); }
      }
    }
    const pr = { x: p.x + 1, y: p.y + 1, w: PW - 2, h: PHT - 2 };
    for (const e of ents) if (this.isSolid(e) && hit(pr, e)) { this.die('crush'); return; }
  }

  updatePlayer(dt, inp) {
    const p = this.p, g = p.g;
    const dir = ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * (this.rev ? -1 : 1);
    const onIce = p.onGround && p.ground && p.ground.ice;
    if (p.onGround) p.air2 = false;
    if (dir) {
      p.face = dir;
      let acc = p.onGround ? (onIce ? 900 : PH.accG) : PH.accA;
      if (Math.sign(p.vx) !== dir && p.vx !== 0) acc *= onIce ? 0.9 : 1.7;
      p.vx = clamp(p.vx + dir * acc * dt, -PH.run, PH.run);
    } else {
      const f = (p.onGround ? (onIce ? 210 : PH.fric) : PH.fric * 0.45) * dt;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
    }
    if (inp.jump && !p.jumpHeld) p.buf = this.D.buf;
    p.jumpHeld = inp.jump;
    p.buf -= dt;
    p.coy = p.onGround ? this.D.coyote : p.coy - dt;
    if (p.buf > 0 && p.coy > 0) {
      p.vy = -PH.jump * g; p.buf = 0; p.coy = 0; p.onGround = false; p.ground = null; p.jumping = true;
      p.sx = 0.72; p.sy = 1.3; this.sfx('jump');
      for (let k = 0; k < 7; k++) this.parts.push(this.mkPart(p.x + PW / 2, g > 0 ? p.y + PHT : p.y, { col: '#b8acdf', sp: 90, life: .35, size: rand(2, 4), g: 200 * g, up: g > 0 }));
    }
    else if (this.dj && p.buf > 0 && !p.air2 && !p.onGround && p.coy <= 0) {
      p.vy = -PH.jump * 0.92 * g; p.buf = 0; p.air2 = true; p.jumping = true; p.sx = 0.75; p.sy = 1.25; this.sfx('spring');
      this.parts.push({ x: p.x + PW / 2, y: g > 0 ? p.y + PHT : p.y, vx: 0, vy: 0, life: .35, max: .35, size: 0, col: '#9ef9dc', g: 0, drag: 0, ring: true });
      for (let k = 0; k < 8; k++) this.parts.push(this.mkPart(p.x + PW / 2, g > 0 ? p.y + PHT : p.y, { col: '#9ef9dc', sp: 110, life: .4, size: rand(2, 3.5), g: 120 * g, add: true }));
    }
    if (!inp.jump && p.jumping && p.vy * g < -PH.cut) p.vy = -PH.cut * g;
    if (p.vy * g >= 0) p.jumping = false;
    p.vy += PH.g * g * dt;
    if (p.vy * g > PH.maxFall) p.vy = PH.maxFall * g;

    const sol = this.solids();
    // X
    if (p.onGround && p.ground && p.ground.conv) p.x += p.ground.conv * T * dt;
    p.x += p.vx * dt;
    for (const s of sol) if (hit(p, s)) { if (p.vx > 0) p.x = s.x - PW; else if (p.vx < 0) p.x = s.x + s.w; p.vx = 0; }
    if (p.x < 0) { p.x = 0; p.vx = 0; } if (p.x > W - PW) { p.x = W - PW; p.vx = 0; }
    // Y
    const was = p.onGround, vyBefore = p.vy;
    p.onGround = false; p.ground = null;
    p.y += p.vy * dt;
    for (const s of sol) if (hit(p, s)) {
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

  checkHazards(dt) {
    const p = this.p;
    for (const e of this.lv.ents) {
      if (e.gone || e.hidden) continue;
      if (e.type === 'spike') { if (e.pop > 0.6 && hit(p, this.spikeBox(e))) return this.die('spike'); }
      else if (e.type === 'saw') { if (circRect(e.x, e.y, e.r * this.D.saw, p.x, p.y, PW, PHT)) return this.die('saw'); }
      else if (e.type === 'laser') { if (e.act && hit(p, { x: e.x + (e.dir === 'h' ? 0 : -1), y: e.y + (e.dir === 'h' ? -1 : 0), w: e.w + (e.dir === 'h' ? 0 : 2), h: e.h + (e.dir === 'h' ? 2 : 0) })) return this.die('laser'); }
      else if (e.type === 'block' && e.lava) { if (hit(p, { x: e.x, y: e.y + 8, w: e.w, h: e.h })) return this.die('lava'); }
      else if (e.type === 'portal') { if (e.open > 0.9 && hit(p, { x: e.x + 10, y: e.y + 12, w: e.w - 20, h: e.h - 20 })) return this.win(e, 'portal'); }
      else if (e.type === 'door') {
        if (e.fake) { const inner = { x: e.x + 12, y: e.y + 16, w: e.w - 24, h: e.h - 16 }; if (hit(p, inner)) { e.gone = true; this.lv.pop(e.fake); this.say('در قلابی بود!'); this.shake(6); } continue; }
        const inner = e.flip ? { x: e.x + 12, y: e.y, w: e.w - 24, h: e.h - 16 } : { x: e.x + 12, y: e.y + 16, w: e.w - 24, h: e.h - 16 };
        if (hit(p, inner)) return this.win(e);
      }
      else if (e.type === 'spring') {
        if (p.g > 0 && p.vy >= 0 && hit(p, { x: e.x + 5, y: e.y - 2, w: e.w - 10, h: e.h + 2 })) {
          p.vy = -PH.spring; p.onGround = false; p.ground = null; p.jumping = false; p.coy = 0; p.buf = 0;
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
    if (p.y > H + 60 || p.y < -110) this.die('fall');
  }

  /* In-place snapshot of all gameplay state. Closures in triggers/timers stay valid because the same Level object is reused. */
  save() {
    const K = ['x', 'y', 'dx', 'dy', 'hidden', 'gone', 'falling', 'fallDelay', 'vy', 'pop', 'appear', 'shake', 'anim', 'cd', 'rot', 'landed', 'open', 'opening', 'lt', 'a', 'act', 'warn'];
    const lv = this.lv, ents = lv.ents;
    return {
      ents: ents.map(e => { const o = { pi: e.patrol ? e.patrol.i : -1, moves: e.moves.map(m => ({ tx: m.tx, ty: m.ty, sp: m.sp, delay: m.delay })) }; for (const k of K) o[k] = e[k]; return o; }),
      p: Object.assign({}, this.p, { ground: ents.indexOf(this.p.ground) }),
      trigs: lv.trigs.slice(), fired: lv.trigs.map(t => t.fired),
      timers: lv.timers.map(t => ({ t: t.t, fn: t.fn })), lt: lv.t,
      state: this.state, deadT: this.deadT, winT: this.winT, winFired: this.winFired, winDoor: ents.indexOf(this.winDoor), winKind: this.winKind, rev: this.rev, time: this.time,
    };
  }
  load(sn) {
    const K = ['x', 'y', 'dx', 'dy', 'hidden', 'gone', 'falling', 'fallDelay', 'vy', 'pop', 'appear', 'shake', 'anim', 'cd', 'rot', 'landed', 'open', 'opening', 'lt', 'a', 'act', 'warn'];
    const lv = this.lv, ents = lv.ents;
    ents.forEach((e, i) => { const o = sn.ents[i]; for (const k of K) e[k] = o[k]; e.moves = o.moves.map(m => Object.assign({}, m)); e.patrol = o.pi >= 0 ? e.patrol0 : null; if (e.patrol) e.patrol.i = o.pi; });
    this.p = Object.assign({}, sn.p, { ground: sn.p.ground >= 0 ? ents[sn.p.ground] : null });
    lv.trigs = sn.trigs.slice(); lv.trigs.forEach((t, i) => t.fired = sn.fired[i]);
    lv.timers = sn.timers.map(t => ({ t: t.t, fn: t.fn })); lv.t = sn.lt;
    this.state = sn.state; this.deadT = sn.deadT; this.winT = sn.winT; this.winFired = sn.winFired; this.winDoor = sn.winDoor >= 0 ? ents[sn.winDoor] : null; this.winKind = sn.winKind; this.rev = sn.rev; this.time = sn.time;
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

  die(cause) {
    if (this.state !== 'play') return;
    const p = this.p; this.state = 'dead'; this.deadT = 0.95; this.flash = 1;
    const cx = p.x + PW / 2, cy = p.y + PHT / 2;
    this.burst(cx, cy, 26, { col: '#ffe9c4', sp: 420, life: .9, size: 4.5, g: 900, drag: 1.2, sq: true });
    this.burst(cx, cy, 14, { col: '#ff7a45', sp: 380, life: .8, size: 4, g: 900, drag: 1.2, sq: true });
    this.burst(cx, cy, 18, { col: '#ffb36b', sp: 520, life: .45, size: 2.5, add: true });
    this.parts.push({ x: cx, y: cy, vx: 0, vy: 0, life: .4, max: .4, size: 0, col: '#fff', g: 0, drag: 0, ring: true });
    this.shake(16); this.sfx('die');
    if (this.onDeath) this.onDeath(cause);
  }
  nextRoom() { if (this.room < this.rooms.length - 1) { this.room++; this.respawn(true); } }
  win(door, kind = 'door') {
    if (this.state !== 'play') return;
    if (kind === 'door' && this.room < this.rooms.length - 1) kind = 'room';
    this.state = 'win'; this.winT = 0; this.winDoor = door; this.winFired = false; this.winKind = kind;
    this.sfx('win'); this.burst(door.x + door.w / 2, door.y + door.h / 2, 40, { col: '#ffe08a', sp: 320, life: .9, add: true, size: 3 });
  }
}

