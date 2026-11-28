// رقبای کامپیوتری که همان مسیر را با زمان‌بندی واقعی طی می‌کنند
import * as THREE from 'three';
import { Character } from './character.js';
import { PHYS } from './config.js';
import { anchorWorld, platTransform, blinkOn, laserOn } from './level.js';
import { clamp, lerp, damp, dampAngle, wrapAngle, mulberry32 } from './util.js';

const V3 = THREE.Vector3;

export class Bot {
  constructor(persona, look, idx, opts) {
    this.persona = persona;
    this.name = persona.name;
    this.idx = idx;
    this.color = look.shirt;
    this.char = new Character(look, { scarf: opts.scarf });
    this.pos = new V3();
    this.vel = new V3();
    this.yaw = 0;
    this.skill = persona.skill;
    this.lane = (idx - 2.5) * 0.32;
    this.chatCooldown = 0;
  }
}

export class BotManager {
  constructor(L, course, personas, looks, opts = {}) {
    this.L = L;
    this.course = course;
    this.opts = opts;
    this.bots = personas.map((p, i) => new Bot(p, looks[i % looks.length], i, opts));
    this.rng = mulberry32(L.seed ^ 0x9e37);
    this.events = opts.events || {};
    // نگاشت سکو -> اندیس مسیر (برای پیشرفت بازیکن)
    this.platRoute = new Map();
    L.route.forEach((e, i) => {
      const pid = e.b ? e.b.p : e.a ? e.a.p : e.p;
      if (pid !== undefined && !this.platRoute.has(pid)) this.platRoute.set(pid, i);
    });
    this.d = L.d;
  }

  addTo(scene) {
    for (const b of this.bots) {
      scene.add(b.char.root);
      if (b.char.scarf) scene.add(b.char.scarf);
    }
  }
  removeFrom(scene) {
    for (const b of this.bots) {
      scene.remove(b.char.root);
      if (b.char.scarf) scene.remove(b.char.scarf);
      b.char.dispose();
    }
  }

  laneFor(b, pid) {
    const p = this.L.platforms[pid];
    const half = p.shape === 'cyl' ? p.r * 0.45 : p.sx / 2 - 0.45;
    return clamp(b.lane * 2.2, -Math.max(0, half), Math.max(0, half));
  }

  reset() {
    const S = this.L.start;
    const sp = this.L.platforms[S.plat];
    for (const b of this.bots) {
      const lx = (b.idx - 2.5) * 1.9 + (b.idx >= 3 ? 1.9 : 0);
      b.local = { p: S.plat, lx: clamp(lx, -sp.sx / 2 + 0.6, sp.sx / 2 - 0.6), lz: -3 };
      b.entry = 0;
      b.mode = 'idle';
      b.s = 0;
      b.wait = 0;
      b.finished = false;
      b.finishTime = 0;
      b.respawnEntry = 0;
      b.respawnLocal = { ...b.local };
      b.falls = 0;
      b.recentFalls = 0;
      b.speed = PHYS.baseSpeed * (0.8 + 0.3 * b.skill) * (1 + 0.24 * this.d) * (0.96 + this.rng() * 0.08);
      b.ghost = 1;
      b.char.setGhost(1);
      b.char.root.visible = true;
      b.progress = 0;
      b.hopT = 0;
      this.placeAttached(b, 0);
      b.yaw = S.yaw;
      b.char.root.rotation.set(0, b.yaw, 0);
      b.grounded = true;
      b.char.scarfInit = false;
    }
  }
  start() {
    for (const b of this.bots) b.mode = 'next';
  }

  placeAttached(b, t) {
    const w = anchorWorld(this.L, b.local, t);
    b.pos.set(w.x, w.y, w.z);
  }

  // پیشرفت بازیکن بر اساس آخرین سکو
  playerProgress(lastPlat) {
    if (!lastPlat) return 0;
    const i = this.platRoute.get(lastPlat.id);
    return i === undefined ? 0 : i + 0.5;
  }

  update(dt, t) {
    for (const b of this.bots) this.updateBot(b, dt, t);
  }

  updateBot(b, dt, t) {
    const L = this.L;
    const route = L.route;
    const prevPos = b.pos.clone();
    let grounded = true, vy = 0, slide = false, wall = 0, knock = false, cele = false;
    b.chatCooldown -= dt;

    if (b.mode === 'idle') {
      this.placeAttached(b, t);
    } else if (b.mode === 'next') {
      if (b.entry >= route.length) { b.mode = 'done'; }
      else {
        const e = route[b.entry];
        b.e = e;
        b.s = 0;
        b.wait = 0;
        if (e.type === 'checkpoint') {
          b.recentFalls = 0;
          b.respawnEntry = b.entry + 1;
          b.respawnLocal = { p: e.p, lx: this.laneFor(b, e.p), lz: 0 };
          b.entry++;
        } else if (e.type === 'finish') {
          b.finished = true;
          b.finishTime = t;
          b.mode = 'done';
          const p = L.platforms[e.p];
          b.local = { p: e.p, lx: clamp((b.idx - 2.5) * 2, -p.sx / 2 + 1, p.sx / 2 - 1), lz: 1.5 + (b.idx % 2) * 1.5 };
          b.mode = 'goFinish';
          this.events.botFinished && this.events.botFinished(b);
        } else if (e.type === 'run') {
          b.mode = 'run';
          b.target = { p: e.b.p, lx: e.b.lx + this.laneFor(b, e.b.p) * 0.6, lz: e.b.lz };
          if (b.local.p !== e.b.p) b.local = { p: e.b.p, lx: b.target.lx, lz: e.a ? e.a.lz : b.target.lz };
        } else if (e.type === 'ride') {
          b.mode = 'ride';
        } else if (e.type === 'jump' || e.type === 'bounce') {
          b.mode = 'prejump';
        } else if (e.type === 'wallrun') {
          b.mode = 'prewall';
        } else {
          b.entry++;
        }
      }
      this.placeAttached(b, t);
    }

    if (b.mode === 'run') {
      const e = b.e;
      const p = L.platforms[b.local.p];
      // صبر برای لیزر / چکش
      let blocked = false;
      if (e.wait === 'laser' || e.wait === 'hammer') {
        for (const H of this.course.hazards) {
          if (H.plat !== p) continue;
          const ahead = H.lz - b.local.lz;
          if (H.type === 'laser' && e.wait === 'laser' && ahead > 0 && ahead < 1.1) {
            if (laserOn(H, t) || laserOn(H, t + 0.3)) blocked = true;
          }
          if (H.type === 'hammer' && e.wait === 'hammer' && ahead > -0.2 && ahead < 1.5) {
            const th = Math.sin(t * H.speed + H.phase) * H.amp;
            const th2 = Math.sin((t + 0.35) * H.speed + H.phase) * H.amp;
            if (Math.abs(th) < 0.7 || Math.abs(th2) < 0.7) {
              if (b.wait < 2.5 * b.skill + 0.3) blocked = true;
              else if (Math.abs(th) < 0.25 && this.rng() < dt * 2.5 * (1 - b.skill) * Math.pow(0.45, b.recentFalls || 0)) { this.knockOff(b, t, H); return this.finishFrame(b, dt, t, prevPos, false, 0, false, 0, true, false); }
            }
          }
        }
      }
      if (blocked) {
        b.wait += dt;
      } else {
        const dx = b.target.lx - b.local.lx, dz = b.target.lz - b.local.lz;
        const dist = Math.hypot(dx, dz);
        const step = b.speed * dt;
        if (dist <= step) {
          b.local.lx = b.target.lx; b.local.lz = b.target.lz;
          b.entry++;
          b.mode = 'next';
        } else {
          b.local.lx += (dx / dist) * step;
          b.local.lz += (dz / dist) * step;
        }
      }
      this.placeAttached(b, t);
      if (e.hop) {
        b.hopT += dt;
        const hp = Math.abs(Math.sin(b.hopT * 4.6));
        b.pos.y += hp * 0.75;
        grounded = hp < 0.12;
        vy = Math.cos(b.hopT * 4.6) * 3;
      }
      if (e.type === 'slide') {
        for (const H of this.course.hazards) {
          if (H.plat === p && H.type === 'bar' && Math.abs(H.lz - b.local.lz) < 1.6) slide = true;
        }
      }
    } else if (b.mode === 'ride') {
      const next = route[b.entry + 1];
      const goNow = !next || !next.b || this.goodTime(b, next, t);
      b.wait += dt;
      if (goNow || b.wait > 7) { b.entry++; b.mode = 'next'; }
      this.placeAttached(b, t);
    } else if (b.mode === 'prejump') {
      const e = b.e;
      const curP = L.platforms[b.local.p];
      let ok = true;
      if (e.waitBlink) {
        const tp = L.platforms[e.b.p];
        ok = blinkOn(tp, t) && blinkOn(tp, t + 0.9) && blinkOn(tp, t + 1.4);
      }
      if (e.fromSpin || curP.kind === 'spinner') {
        // صبر تا هم‌راستا شدن چرخنده
        const tr = platTransform(curP, t);
        const tw = anchorWorld(L, e.b, t);
        const ang = Math.atan2(tw.x - tr.x, tw.z - tr.z);
        const err = Math.abs(wrapAngle((tr.yaw - ang) * 2) / 2);
        if (err > 0.22) ok = false;
        else {
          // دویدن تا سر بازو
          const endLz = Math.cos(wrapAngle(tr.yaw - ang)) > 0 ? curP.sz / 2 - 0.6 : -curP.sz / 2 + 0.6;
          b.local.lz = damp(b.local.lz, endLz, 10, dt);
          b.local.lx = damp(b.local.lx, 0, 10, dt);
          if (Math.abs(b.local.lz - endLz) > 0.3) ok = false;
        }
      } else if (ok && e.type !== 'bounce') {
        ok = this.goodTime(b, e, t);
      }
      b.wait += dt;
      if (ok || b.wait > 6) this.beginJump(b, e, t);
      else this.placeAttached(b, t);
    } else if (b.mode === 'prewall') {
      const e = b.e;
      const wp = L.platforms[e.wall];
      const startLocal = { p: wp.id, lx: e.side * (wp.sx / 2 + 0.42), lz: -wp.sz / 2 + 1.0 };
      const sw = anchorWorld(L, startLocal, t);
      sw.y = wp.top - 2.6;
      this.beginArc(b, sw, 0.55, 1.0, t, { next: 'wall', startLocal });
    } else if (b.mode === 'wall') {
      const e = b.e;
      const wp = L.platforms[e.wall];
      b.wallS += dt * (b.speed * 1.08) / Math.max(1, wp.sz - 2);
      const lz = lerp(-wp.sz / 2 + 1.0, wp.sz / 2 - 1.2, Math.min(1, b.wallS));
      const w = anchorWorld(L, { p: wp.id, lx: e.side * (wp.sx / 2 + 0.42), lz }, t);
      b.pos.set(w.x, wp.top - 2.6 + Math.sin(Math.min(1, b.wallS) * Math.PI) * 0.6, w.z);
      grounded = false;
      // سمت دیوار نسبت به بدن
      const fwd = new V3(Math.sin(wp.yaw), 0, Math.cos(wp.yaw));
      b.yaw = Math.atan2(fwd.x, fwd.z);
      const wallWorldSide = new V3(Math.cos(wp.yaw) * e.side, 0, -Math.sin(wp.yaw) * e.side); // از دیوار به بیرون
      const left = new V3(Math.cos(b.yaw), 0, -Math.sin(b.yaw));
      wall = -(wallWorldSide.x * left.x + wallWorldSide.z * left.z) > 0 ? 1 : -1;
      if (b.wallS >= 1) {
        const tw = anchorWorld(L, e.b, t);
        this.beginArc(b, null, 0.6, 1.2, t, { targetAnchor: e.b, fail: false });
      }
    } else if (b.mode === 'arc') {
      const a = b.arc;
      a.s += dt / a.T;
      const s = Math.min(1, a.s);
      let end = a.endFixed;
      if (a.anchor) end = anchorWorld(L, a.anchor, a.t0 + a.T);
      if (a.miss) {
        end = { x: end.x - a.missDir.x * a.miss, y: end.y, z: end.z - a.missDir.z * a.miss };
      }
      const x = lerp(a.from.x, end.x, s), z = lerp(a.from.z, end.z, s);
      const yLin = lerp(a.from.y, end.y, s);
      const y = yLin + 4 * a.h * s * (1 - s);
      b.pos.set(x, y, z);
      grounded = false;
      vy = (lerp(a.from.y, end.y, s + 0.01) + 4 * a.h * (s + 0.01) * (1 - s - 0.01) - y) / (a.T * 0.01);
      if (a.s >= 1) {
        if (a.miss) {
          b.mode = 'fall';
          b.vel.set((end.x - a.from.x) / a.T * 0.6, vy, (end.z - a.from.z) / a.T * 0.6);
          b.fallT = 0;
        } else if (a.next === 'wall') {
          b.mode = 'wall';
          b.wallS = 0;
        } else if (a.anchor) {
          b.local = { p: a.anchor.p, lx: a.anchor.lx + this.laneFor(b, a.anchor.p) * 0.5, lz: a.anchor.lz };
          this.placeAttached(b, t);
          b.char.triggerLand(clamp(Math.abs(vy) / 18, 0.2, 0.8));
          const lp = L.platforms[a.anchor.p];
          if (lp.kind === 'bounce') this.course.bouncePlat(lp);
          b.entry++;
          b.mode = 'next';
          this.events.botLanded && this.events.botLanded(b);
        }
      }
    } else if (b.mode === 'fall') {
      b.fallT += dt;
      b.vel.y -= PHYS.gravity * dt;
      b.pos.addScaledVector(b.vel, dt);
      grounded = false;
      vy = b.vel.y;
      knock = b.knocked;
      const seg = L.platforms[b.local.p] ? L.platforms[b.local.p].seg : 0;
      const killY = L.killY[Math.min(L.killY.length - 1, seg + 1)] ?? -50;
      if (b.pos.y < killY || b.fallT > 2.6) {
        b.mode = 'respawn';
        b.respawnT = 1.1;
        b.falls++;
        b.recentFalls = (b.recentFalls || 0) + 1;
        b.char.root.visible = false;
        this.events.botFell && this.events.botFell(b);
      }
    } else if (b.mode === 'respawn') {
      b.respawnT -= dt;
      if (b.respawnT <= 0) {
        b.local = { ...b.respawnLocal };
        b.entry = b.respawnEntry;
        b.mode = 'next';
        b.knocked = false;
        b.char.root.visible = true;
        this.placeAttached(b, t);
        this.events.botRespawn && this.events.botRespawn(b);
      }
    } else if (b.mode === 'goFinish') {
      const p = L.platforms[b.local.p];
      const tgt = { lx: b.local.lx, lz: b.local.lz };
      this.placeAttached(b, t);
      b.mode = 'walkFinish';
      b.finishTarget = tgt;
      b.local = { p: p.id, lx: b.local.lx, lz: -p.sz / 2 + 2 };
    } else if (b.mode === 'walkFinish') {
      const dx = b.finishTarget.lx - b.local.lx, dz = b.finishTarget.lz - b.local.lz;
      const d = Math.hypot(dx, dz);
      if (d < 0.1) b.mode = 'done';
      else {
        const st = Math.min(d, b.speed * 0.5 * dt);
        b.local.lx += (dx / d) * st;
        b.local.lz += (dz / d) * st;
      }
      this.placeAttached(b, t);
    } else if (b.mode === 'done') {
      this.placeAttached(b, t);
      cele = b.finished;
    }

    this.finishFrame(b, dt, t, prevPos, grounded, vy, slide, wall, knock, cele);
  }

  finishFrame(b, dt, t, prevPos, grounded, vy, slide, wall, knock, cele) {
    const mv = b.pos.clone().sub(prevPos);
    // سرعت نسبی (منهای حرکت سکو)
    let hs = Math.hypot(mv.x, mv.z) / Math.max(dt, 1e-4);
    if (b.mode === 'ride' || b.mode === 'idle' || (b.mode === 'prejump' && b.wait > 0) || b.mode === 'done') hs = 0;
    if (b.mode === 'run' && b.wait > 0 && mv.lengthSq() < 1e-6) hs = 0;
    if (hs > 0.5 && !wall && b.mode !== 'ride') b.yaw = dampAngle(b.yaw, Math.atan2(mv.x, mv.z), 12, dt);
    if (b.mode === 'done' && b.finished) b.yaw = dampAngle(b.yaw, this.L.platforms[this.L.finish.plat].yaw + Math.PI, 3, dt);
    if (b.mode === 'run' && b.e && b.e.hop) hs = b.speed;
    b.char.root.position.copy(b.pos);
    b.char.root.rotation.set(0, b.yaw, 0);
    b.vel.copy(mv).divideScalar(Math.max(dt, 1e-4));
    b.char.update(dt, {
      speed: clamp(hs, 0, b.speed * 1.3),
      maxSpeed: b.speed,
      grounded,
      vy,
      slide,
      wall,
      mantle: -1,
      knock,
      cele,
      bank: 0,
    });
    if (this.opts.scarf) b.char.updateScarf(dt, b.vel);
    b.progress = b.finished ? 1e6 - b.finishTime : b.entry + (b.mode === 'arc' ? Math.min(1, b.arc.s) * 0.9 : 0.1);
  }

  // آیا زمان مناسب پرش به هدف است؟ (پیش‌بینی موقعیت سکوی متحرک)
  goodTime(b, e, t) {
    const L = this.L;
    const tp = L.platforms[e.b.p];
    const cp = L.platforms[b.local.p];
    const dynamic = (p) => p && (p.kind === 'mover' || p.kind === 'elevator' || p.kind === 'spinner');
    if (!dynamic(tp) && !dynamic(cp)) return true;
    const metric = (tt) => {
      const from = anchorWorld(L, b.local, tt);
      const to = anchorWorld(L, e.b, tt + 0.6);
      const hd = Math.hypot(to.x - from.x, to.z - from.z);
      const dy = to.y - from.y;
      return hd + Math.max(0, dy) * 3 + Math.max(0, -dy - 4) * 0.5;
    };
    const m0 = metric(t), m1 = metric(t + 0.12);
    const reach = b.speed * 0.78;
    return m0 < reach && m0 <= m1 + 0.02;
  }

  beginJump(b, e, t) {
    const L = this.L;
    const from = b.pos.clone();
    const anchor = { p: e.b.p, lx: e.b.lx + this.laneFor(b, e.b.p) * 0.4, lz: e.b.lz };
    // مدت پرش بر اساس فاصله
    let T = 0.6;
    for (let i = 0; i < 3; i++) {
      const to = anchorWorld(L, anchor, t + T);
      const D = Math.hypot(to.x - from.x, to.z - from.z);
      const dy = to.y - from.y;
      T = clamp(D / (b.speed * 0.95), 0.38, 1.35) + Math.max(0, -dy) * 0.025 + Math.max(0, dy) * 0.05;
    }
    let h = 1.0 * (e.h ?? 1);
    let fail = false;
    if (e.type === 'bounce') {
      T = 1.25;
      h = 4.5;
    } else {
      const hard = e.hard ?? 0.3;
      const pf = clamp(hard * (1.05 - b.skill) * (0.2 + this.d * 0.6), 0.002, 0.12) * Math.pow(0.45, b.recentFalls || 0);
      fail = this.rng() < pf;
    }
    const to = anchorWorld(L, anchor, t + T);
    h = Math.max(h, (Math.max(from.y, to.y) - Math.min(from.y, to.y)) * 0.25 + 0.7);
    if (to.y > from.y) h += (to.y - from.y) * 0.55;
    this.beginArc(b, null, T, h, t, { targetAnchor: anchor, fail });
    if (e.type === 'bounce') this.course.bouncePlat(L.platforms[b.local.p]);
    this.events.botJump && this.events.botJump(b, e.type);
  }

  beginArc(b, endFixed, T, h, t, opts) {
    const from = b.pos.clone();
    const arc = { from, T, h, t0: t, s: 0, endFixed, anchor: opts.targetAnchor || null, next: opts.next };
    if (opts.fail) {
      const to = anchorWorld(this.L, arc.anchor, t + T);
      const dir = new V3(to.x - from.x, 0, to.z - from.z);
      const D = dir.length() || 1;
      dir.divideScalar(D);
      arc.miss = Math.min(D * 0.45, 1.6 + this.rng() * 1.2);
      arc.missDir = dir;
      arc.h *= 0.8;
    }
    b.arc = arc;
    b.mode = 'arc';
  }

  knockOff(b, t, H) {
    const p = H.plat;
    const side = this.rng() < 0.5 ? 1 : -1;
    b.mode = 'fall';
    b.knocked = true;
    b.fallT = 0;
    b.vel.set(Math.cos(p.yaw) * side * 9, 6, -Math.sin(p.yaw) * side * 9);
    this.events.botKnocked && this.events.botKnocked(b);
  }

  ranking(playerProg, playerFinished, playerTime) {
    const list = this.bots.map((b) => ({ bot: b, prog: b.progress, fin: b.finished, time: b.finishTime }));
    list.push({ bot: null, prog: playerFinished ? 1e6 - playerTime : playerProg, fin: playerFinished, time: playerTime });
    list.sort((a, b) => b.prog - a.prog);
    return list;
  }
}
