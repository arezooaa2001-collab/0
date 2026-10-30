'use strict';
/*
 * Real pedalling and the spinning class. Every exercise bike has a crank that turns with the
 * rider's feet: IK keeps the toes on the pedals and the hands on the handlebar. The class bikes
 * can't be ridden alone: invite people until every bike has a rider, then follow the instructor,
 * who calls a new move every few seconds. Everyone keeps riding until they press stop.
 */

/* ---------- the bike, in the rider's frame (rider at the origin facing +z) ---------- */

const BIKE = { barY: 1.1, barF: 0.73, crankY: 0.34, crankF: 0.3, crankR: 0.15, pedalX: 0.17 };

/** Crank arms and pedals that turn; st.crank is driven by whoever rides the bike. */
function addBikeCrank(world, st, col) {
  const g = new THREE.Group();
  g.position.set(st.x, st.y || 0, st.z);
  g.rotation.y = st.yaw;
  g.userData.noSolid = true;
  const R = BIKE.crankR;
  const pivot = propMesh((b) => {
    b.cyl(0.025, 0.36, 0, 0, 0, '#9aa0a8', 0, 0, Math.PI / 2, 8);
    b.cyl(0.08, 0.02, 0.1, 0, 0, col || '#2c3140', 0, 0, Math.PI / 2, 14);
    b.box(0.03, R, 0.035, 0.14, R / 2, 0, '#2c3140');
    b.box(0.03, R, 0.035, -0.14, -R / 2, 0, '#2c3140');
    b.cyl(0.022, 0.1, BIKE.pedalX, R, 0, '#111317', 0, 0, Math.PI / 2, 8);
    b.cyl(0.022, 0.1, -BIKE.pedalX, -R, 0, '#111317', 0, 0, Math.PI / 2, 8);
  });
  pivot.position.set(0, BIKE.crankY, BIKE.crankF);
  g.add(pivot);
  world.scene.add(g);
  st.crank = pivot;
  return pivot;
}

/** How each move rides: cadence (rad/s), hip height and place, lean, arms. */
const BIKE_STYLES = {
  bike: { name: 'رکاب نشسته', icon: '🚴', cad: 7.5, hipY: 1.0, hipF: -0.02, bx: 0.22, sp: 0.38, up: 0, push: 0, sway: 0 },
  bikestand: { name: 'ایستاده رکاب بزن', icon: '⛰️', cad: 5.2, hipY: 1.07, hipF: 0.15, bx: 0.35, sp: 0.3, up: 0, push: 0, sway: 0.09 },
  bikesprint: { name: 'اسپرینت تند', icon: '⚡', cad: 13, hipY: 1.0, hipF: 0, bx: 0.36, sp: 0.5, up: 0, push: 0, sway: 0 },
  bikearms: { name: 'دست‌ها بالا', icon: '🙌', cad: 7, hipY: 1.0, hipF: -0.04, bx: 0.04, sp: 0.06, up: 1, push: 0, sway: 0 },
  bikepush: { name: 'شنا روی فرمون', icon: '💪', cad: 6, hipY: 1.0, hipF: -0.02, bx: 0.25, sp: 0.4, up: 0, push: 0.32, sway: 0 },
  bikewait: { cad: 0, hipY: 1.0, hipF: -0.02, bx: 0.2, sp: 0.36, up: 0, push: 0, sway: 0 },
};
const SPIN_CUES = ['bike', 'bikestand', 'bikesprint', 'bikearms', 'bikepush'];
const BIKE_KEYS = ['cad', 'hipY', 'hipF', 'bx', 'sp', 'up', 'push', 'sway'];

const _bt = new THREE.Vector3();
const _bikeSeedQ = makePose();
Object.assign(_bikeSeedQ, { shLX: -1.2, shRX: -1.2, shLZ: 0.15, shRZ: -0.15, elL: -0.3, elR: -0.3, hpLX: -1.1, hpRX: -1.1, hpLZ: 0.05, hpRZ: -0.05, knL: 1.4, knR: 1.4 });

function bikeFn(style, dur) {
  return function (p, t, ch) {
    // one memory per rider: the pedals' angle and the riding style ease from move to move
    const live = ch && ch.time != null;
    let bk = live ? ch._bike : null;
    const now = live ? ch.time : 0;
    if (!bk || now - bk.time > 0.25) {
      bk = { time: now, th: 0, mount: live ? 0 : 1, mem: copyPose(makePose(), _bikeSeedQ), ph: 0 };
      for (const k of BIKE_KEYS) bk[k] = style[k];
      if (live) ch._bike = bk;
    }
    const dt = live ? clamp(now - bk.time, 0, 0.1) : 0;
    bk.time = now;
    const e = 1 - Math.exp(-5 * dt);
    for (const k of BIKE_KEYS) bk[k] += (style[k] - bk[k]) * e;
    if (live) bk.th += bk.cad * dt;
    else bk.th = t * dur * style.cad;
    bk.ph += dt * 3.2;
    bk.mount = Math.min(1, bk.mount + dt / 0.35);
    const th = bk.th;
    const st = ch && ch.station;
    if (st && st.crank) st.crank.rotation.x = th;

    const q = Contact.makePoseCached(ch);
    copyPose(q, bk.mem);
    const push = bk.push * (0.5 - 0.5 * Math.cos(bk.ph * 1.6));
    q.x = bk.sway * 0.35 * Math.sin(th);
    q.y = bk.hipY - HIP_H;
    q.z = bk.hipF;
    q.bx = bk.bx; q.by = 0; q.bz = bk.sway * Math.sin(th);
    q.spX = bk.sp + push; q.spY = 0; q.spZ = 0;
    q.nkX = -0.75 * (bk.bx + bk.sp + push) + 0.15;
    q.nkY = style.cad === 0 ? 0.5 * Math.sin(bk.ph * 0.4) : 0;
    q.autoAnkle = false;
    const R = BIKE.crankR;
    const feet = [['legL', BIKE.pedalX - 0.01, th, 'hpLX', 'knL', 'anL'], ['legR', -BIKE.pedalX + 0.01, th + Math.PI, 'hpRX', 'knR', 'anR']];
    for (const [leg, x, a, hp, kn, an] of feet) {
      _bt.set(x, BIKE.crankY + R * Math.cos(a) + 0.025, BIKE.crankF + R * Math.sin(a));
      Contact.reachLimb(q, leg, _bt, _bikeSeedQ, 8, 0.002);
      q[an] = 0.12 * Math.sin(a) - q.bx - q[hp] - q[kn];
      Contact.solveLimb(q, leg, _bt, 3, 0.002);
      q[an] = 0.12 * Math.sin(a) - q.bx - q[hp] - q[kn];
    }
    // hands on the handlebar, or up in the air
    const up = bk.up;
    if (up < 0.99) {
      Contact.reachLimb(q, 'armL', _bt.set(0.25, BIKE.barY + 0.01, BIKE.barF - 0.02), _bikeSeedQ, 8, 0.002);
      Contact.reachLimb(q, 'armR', _bt.set(-0.25, BIKE.barY + 0.01, BIKE.barF - 0.02), _bikeSeedQ, 8, 0.002);
    }
    copyPose(bk.mem, q);
    if (up > 0.01) {
      const pump = Math.sin(bk.ph * 2.2);
      const a = { shLX: -2.85 + 0.25 * pump, shRX: -2.85 - 0.25 * pump, shLZ: 0.3, shRZ: -0.3, elL: -0.25, elR: -0.25 };
      for (const k in a) q[k] += (a[k] - q[k]) * up;
    }
    if (bk.mount < 1) mixInto(p, q, smooth(bk.mount));
    else copyPose(p, q);
  };
}

for (const id of [...SPIN_CUES, 'bikewait']) {
  const dur = id === 'bikewait' ? 2.5 : 3.0;
  ANIMS[id] = { snapAll: true, dur, fn: bikeFn(BIKE_STYLES[id], dur) };
}

/* ---------- the class, world side ---------- */

Object.assign(GymWorld.prototype, {
  spinState() {
    if (!this.spin) this.spin = { state: 'idle', members: [], cue: 'bike', cueT: 0, coachT: 0 };
    return this.spin;
  },

  /** People needed besides you: one rider for every other bike. */
  spinNeed() { return this.spinBikes.length - 1; },

  spinSeated() {
    return this.spinState().members.filter((n) => n.cls && (n.cls.phase === 'wait' || n.cls.phase === 'ride')).length;
  },

  spinFreeBike() {
    const free = this.spinBikes.filter((s) => !s.occ && !s.player);
    return free.length ? free[0] : null;
  },

  /** They say yes: stop what they're doing and walk to a free bike. */
  spinInvite(n) {
    const S = this.spinState();
    if (S.members.length >= this.spinNeed() || n.state === 'class') return false;
    const free = this.spinBikes.filter((s) => !s.occ && !s.player);
    if (free.length < 2) return false;
    const p = n.ch.root.position;
    free.sort((a, b) => Math.hypot(a.ax - p.x, a.az - p.z) - Math.hypot(b.ax - p.x, b.az - p.z));
    const bike = free[0];
    if (n.ch.busy) n.ch.stopAction();
    this.leaveStation(n);
    n.chat = null;
    n.fan = null;
    n.forceAct = null;
    n.state = 'class';
    n.station = bike;
    bike.occ = n;
    n.cls = { phase: 'walk', bike, walkT: 0, anim: S.cue, next: null, followT: 0, stopT: Infinity };
    n.stuckT = 0;
    n.lastPos.set(p.x, p.z);
    n.ch.setLabel(n.name, '🚲 باشه، اومدم!', '#c77dff');
    S.members.push(n);
    return true;
  },

  classNpc(n, dt) {
    const c = n.cls;
    const ch = n.ch;
    const pos = ch.root.position;
    const S = this.spinState();
    if (!c) { n.state = 'idle'; n.timer = 0.5; return [0, 0, 0]; }
    const s = c.bike;
    if (c.phase === 'walk') {
      c.walkT += dt;
      const dx = s.ax - pos.x;
      const dz = s.az - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.35 || c.walkT > 40) {
        pos.set(s.x, this.stationY(s), s.z);
        ch.root.rotation.y = s.yaw;
        n.anchored = true;
        n.vel.set(0, 0);
        c.phase = S.state === 'running' ? 'ride' : 'wait';
        if (c.phase === 'wait') ch.setLabel(n.name, '⏳ منتظر کلاس', '#c77dff');
        else ch.setLabel(n.name, 'سطح ' + fa(n.level), '#7fe0ff');
        return [0, 0, 0];
      }
      n.stuckT += dt;
      if (n.stuckT > 1.5) {
        const moved = Math.hypot(pos.x - n.lastPos.x, pos.z - n.lastPos.y);
        n.stuckT = 0;
        n.lastPos.set(pos.x, pos.z);
        // blocked: step sideways around whatever is in the way
        if (moved < 0.4) { const side = Math.random() < 0.5 ? 1 : -1; pos.x += (-dz / d) * 0.7 * side; pos.z += (dx / d) * 0.7 * side; }
      }
      // a brisk walk: people are waiting for them
      return [dx / d, dz / d, Math.min(Math.max(n.walk, 2.4), d * 2 + 0.3)];
    }
    ch.station = s;
    ch.root.rotation.y = s.yaw;
    if (c.phase === 'wait') {
      if (!ch.busy) ch.play('bikewait');
      return [0, 0, 0];
    }
    // riding: copy the instructor a moment after each call, keep going until they choose to stop
    c.stopT -= dt;
    if (c.stopT <= 0) {
      ch.stopAction();
      this.leaveStation(n);
      n.cls = null;
      n.state = 'idle';
      n.timer = rand(0.5, 2);
      ch.setLabel(n.name, 'سطح ' + fa(n.level), '#7fe0ff');
      return [0, 0, 0];
    }
    if (c.next) {
      c.followT -= dt;
      if (c.followT <= 0) { c.anim = c.next; c.next = null; if (ch.busy) ch.stopAction(); }
    }
    if (!ch.busy) ch.play(c.anim, () => this.npcGain(n, 'spin'));
    return [0, 0, 0];
  },

  spinStart() {
    const S = this.spinState();
    S.state = 'running';
    S.cue = 'bike';
    S.cueT = rand(8, 10);
    for (const n of S.members) {
      n.cls.phase = 'ride';
      n.cls.anim = 'bike';
      n.cls.next = null;
      n.cls.stopT = Infinity;
      if (n.ch.busy) n.ch.stopAction();
      n.ch.setLabel(n.name, 'سطح ' + fa(n.level), '#7fe0ff');
    }
  },

  /** You stopped: the others finish when they feel like it. */
  spinEnd() {
    const S = this.spinState();
    if (S.state !== 'running') return;
    S.state = 'ending';
    for (const n of S.members) if (n.cls) n.cls.stopT = rand(5, 30);
  },

  spinResume() {
    const S = this.spinState();
    S.state = 'running';
    for (const n of S.members) if (n.cls) n.cls.stopT = Infinity;
  },

  /** Cancel before it starts: everyone goes back to what they were doing. */
  spinCancel() {
    const S = this.spinState();
    for (const n of S.members) {
      if (!n.cls) continue;
      n.ch.stopAction();
      this.leaveStation(n);
      n.cls = null;
      n.state = 'idle';
      n.timer = rand(0.3, 1.5);
      n.ch.setLabel(n.name, 'سطح ' + fa(n.level), '#7fe0ff');
    }
    S.members = [];
    S.state = 'idle';
  },

  spinTick(dt) {
    const S = this.spinState();
    S.members = S.members.filter((n) => {
      if (n.cls && n.world === this && n.state === 'class') return true;
      if (n.cls && n.world !== this) n.cls = null;
      return false;
    });
    if (S.state === 'ending' && !S.members.length) S.state = 'idle';
    if (S.state === 'running') {
      S.cueT -= dt;
      if (S.cueT <= 0) {
        S.cue = pick(SPIN_CUES.filter((c) => c !== S.cue));
        S.cueT = rand(8, 12);
        this.coach.stopAction();
        for (const n of S.members) if (n.cls) { n.cls.next = S.cue; n.cls.followT = rand(0.4, 1.4); }
        if (this.onSpinCue) this.onSpinCue(S.cue);
      }
    }
    const co = this.coach;
    co.speed = 0;
    if (!co.busy) {
      let a = S.cue;
      if (S.state === 'idle' || S.state === 'forming') {
        S.coachT = (S.coachT || 0) + 1;
        a = S.coachT % 4 === 0 ? 'bikearms' : 'bikewait';
      }
      co.play(a);
    }
    const sub = S.state === 'running' || S.state === 'ending' ? `📣 ${BIKE_STYLES[S.cue].icon} ${BIKE_STYLES[S.cue].name}` : 'کلاس اسپینینگ';
    if (co.labelSub !== sub) { co.labelSub = sub; co.setLabel('مربی', sub, '#ff4da6'); }
    co.update(dt);
  },
});

/* ---------- the class, your side ---------- */

Object.assign(Game, {
  spinInClass() { return !!(this.loop && this.loop.st && this.loop.st.cls === 'spin'); },

  /** Using a class bike: only when every other bike has a rider. Returns true when it handled the press. */
  spinBlock(m, st) {
    if (!st || st.cls !== 'spin' || this.world !== this.gym) return false;
    const w = this.gym;
    const S = w.spinState();
    const need = w.spinNeed();
    const seated = w.spinSeated();
    if (seated < need) {
      if (S.state === 'idle') S.state = 'forming';
      Sfx.play('error');
      this.toast(`🚲 کلاس اسپینینگ تنهایی نمی‌شه! باید هر ${fa(need + 1)} دوچرخه پر باشه؛ الان ${fa(seated)} نفر نشستن. کنار بقیه برو و «🙋 دعوت» رو بزن.`, 'warn');
      return true;
    }
    const bike = !st.occ && !st.player ? st : w.spinFreeBike();
    if (!bike) return true;
    const p = this.player.ch.root.position;
    if (Math.min(Math.hypot(p.x - bike.ax, p.z - bike.az), Math.hypot(p.x - bike.x, p.z - bike.z)) > 2.6) {
      w.guideTo(bike);
      this.toast('🚲 دوچرخه‌ی خالی مال توئه. دنبال فلش سبز برو!');
      return true;
    }
    if (S.state === 'ending') w.spinResume();
    else w.spinStart();
    this.spinAnim = S.cue;
    const ok = this.startLoop({
      m, st: bike, anim: 'bike',
      next: () => this.spinAnim,
      done: () => this.spinRep(m),
      onStop: () => this.spinStopped(),
    });
    if (ok) {
      Sfx.play('click');
      this.refreshSpinPanel(true);
      this.showBanner('هر حرکتی مربی کرد، تو هم همون رو بزن', '🚲 کلاس شروع شد!');
    } else w.spinEnd();
    return true;
  },

  spinRep(m) {
    const S = this.gym.spinState();
    const match = this.spinAnim === S.cue;
    const k = match ? 1.5 : 0.6;
    this.lastExerciseEnd = this.clock;
    this.gainXp(Math.round(m.xp * k * this.mult()));
    if (m.run) this.gainRun(Math.round(m.run * k));
    this.noteRep(m);
    const learned = this.save.spinLearned || (this.save.spinLearned = []);
    if (match && !learned.includes(S.cue)) {
      learned.push(S.cue);
      const st = BIKE_STYLES[S.cue];
      this.toast(`🎓 «${st.name}» ${st.icon} رو از مربی یاد گرفتی! (${fa(learned.length)} از ${fa(SPIN_CUES.length)})`, 'gold');
      if (learned.length === SPIN_CUES.length) this.toast('🏅 همه‌ی حرکت‌های کلاس اسپینینگ رو یاد گرفتی!', 'gold');
      this.persist();
    } else if (!match && this.clock - (this.spinHintT || -99) > 6) {
      this.spinHintT = this.clock;
      this.toast(`👀 مربی داره «${BIKE_STYLES[S.cue].name}» می‌کنه. تو هم همون رو بزن!`);
    }
    this.refreshSpinPanel(true);
  },

  /** A move button in the class panel: switch right away, the body eases into it. */
  spinPick(id) {
    if (!BIKE_STYLES[id] || (id === this.spinAnim && this.spinInClass())) return;
    Sfx.init();
    this.spinAnim = id;
    const L = this.loop;
    if (this.spinInClass() && L) {
      this.player.ch.stopAction();
      if (!this.loopRep(L)) this.stopLoop();
    }
    Sfx.play('click');
    this.refreshSpinPanel(true);
  },

  spinStopped() {
    this.gym.spinEnd();
    this.toast('🚲 کلاس برای تو تموم شد. بقیه هر وقت خودشون خواستن تمومش می‌کنن.');
  },

  spinCue(cue) {
    if (!this.spinInClass()) return;
    const st = BIKE_STYLES[cue];
    Sfx.play('clap');
    this.showBanner('📣 مربی می‌گه', `${st.icon} ${st.name}`);
    this.refreshSpinPanel(true);
  },

  /** Near someone while gathering the class: ask them to come. */
  spinInviteAction() {
    const w = this.gym;
    const S = w.spin;
    if (!S || S.state !== 'forming' || S.members.length >= w.spinNeed()) return null;
    const p = this.player.ch.root.position;
    let best = null;
    let bd = 2.4;
    for (const n of w.npcs) {
      if (n.state === 'class' || n.state === 'leave' || n.state === 'knocked') continue;
      const d = Math.hypot(n.ch.root.position.x - p.x, n.ch.root.position.z - p.z);
      if (d < bd) { bd = d; best = n; }
    }
    if (!best) return null;
    return { label: `🙋 دعوت ${best.name} به کلاس`, run: () => this.spinInvite(best) };
  },

  spinInvite(n) {
    const w = this.gym;
    if (!w.spinInvite(n)) return;
    const S = w.spin;
    Sfx.play('xp');
    const p = n.ch.root.position;
    w.fx.ring({ x: p.x, y: 0.2, z: p.z }, { count: 24, color: '#c77dff', radius: 0.4, speed: 2.5, life: 0.6 });
    const left = w.spinNeed() - S.members.length;
    this.toast(left > 0
      ? `✅ ${n.name}: «باشه، میام!» 🚲 (${fa(S.members.length + 1)} از ${fa(w.spinNeed() + 1)}) • ${fa(left)} نفر دیگه لازمه`
      : `✅ ${n.name}: «باشه، میام!» همه دعوت شدن! وقتی نشستن، تو هم برو روی دوچرخه‌ی خالی.`);
    this.refreshSpinPanel(true);
  },

  spinCancelClass() {
    this.gym.spinCancel();
    this.toast('کلاس لغو شد؛ همه برگشتن سر تمرین خودشون.');
    this.refreshSpinPanel(true);
  },

  tickSpin() {
    const w = this.gym;
    if (!w || !w.spinBikes) return;
    const S = w.spinState();
    if (!w.onSpinCue) w.onSpinCue = (cue) => this.spinCue(cue);
    const here = this.world === w && this.mode === 'play';
    if (here) {
      const p = this.player.ch.root.position;
      const sp = WING.spin;
      const inArea = p.x > sp.x - 6.5 && p.x < sp.x + 6.5 && p.z > sp.z - 6.5 && p.z < sp.z + 10.5;
      if (inArea && !this.spinWasIn && S.state === 'idle') {
        S.state = 'forming';
        this.toast(`📣 مربی: «سلام! کلاس وقتی شروع می‌شه که هر ${fa(w.spinNeed() + 1)} دوچرخه پر باشه. برو بقیه رو دعوت کن!»`, 'gold');
      }
      this.spinWasIn = inArea;
      // everyone sat down: show the way to the last bike
      const full = S.state === 'forming' && w.spinSeated() >= w.spinNeed();
      if (full && !this.spinFullShown) {
        const b = w.spinFreeBike();
        if (b) w.guideTo(b);
        Sfx.play('xp');
        this.toast('🚲 همه نشستن! برو روی دوچرخه‌ی خالی تا کلاس شروع بشه.', 'gold');
      }
      this.spinFullShown = full;
    }
    this.refreshSpinPanel();
  },

  refreshSpinPanel(force) {
    const panel = $('spinPanel');
    const w = this.gym;
    const S = w && w.spin;
    const show = !!(S && this.world === w && this.mode === 'play' && !this.build && (S.state !== 'idle' || this.spinInClass()));
    const was = !panel.hidden;
    panel.hidden = !show;
    $('hud').classList.toggle('spin-on', show);
    if (!show) return;
    this.spinPanelT = (this.spinPanelT || 0) + 1;
    if (was && !force && this.spinPanelT % 10) return;
    const need = w.spinNeed() + 1;
    const seated = w.spinSeated();
    const coming = S.members.length - seated;
    const riding = this.spinInClass();
    let head;
    let info;
    if (riding) {
      const c = BIKE_STYLES[S.cue];
      head = `📣 مربی: ${c.icon} ${c.name}`;
      info = this.spinAnim === S.cue ? '✅ درست مثل مربی داری می‌زنی!' : '👀 مثل مربی کن: دکمه‌ی همون حرکت رو بزن';
    } else if (S.state === 'forming') {
      head = `🚲 کلاس اسپینینگ • 👥 ${fa(seated + 1)} از ${fa(need)}`;
      if (seated >= need - 1) info = 'همه نشستن! برو روی دوچرخه‌ی خالی 🚲';
      else info = `تنهایی نمی‌شه! کنار ورزشکارها برو و «🙋 دعوت» رو بزن.${coming > 0 ? ` ${fa(coming)} نفر تو راهن.` : ''}`;
    } else {
      head = '🚲 کلاس داره تموم می‌شه';
      info = `${fa(S.members.length)} نفر هنوز دارن رکاب می‌زنن${seated >= need - 1 ? ' • می‌تونی دوباره سوار شی' : ''}`;
    }
    $('spinHead').textContent = head;
    $('spinInfo').textContent = info;
    $('spinCancel').hidden = S.state !== 'forming';
    const cues = $('spinCues');
    cues.hidden = !riding;
    if (!cues.childElementCount) {
      for (const id of SPIN_CUES) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cue-btn';
        b.dataset.id = id;
        b.innerHTML = `<span class="cue-icon">${BIKE_STYLES[id].icon}</span><span class="cue-name">${BIKE_STYLES[id].name}</span>`;
        b.addEventListener('click', () => this.spinPick(id));
        cues.appendChild(b);
      }
    }
    const learned = this.save.spinLearned || [];
    for (const b of cues.children) {
      const id = b.dataset.id;
      b.classList.toggle('coach', id === S.cue);
      b.classList.toggle('mine', id === this.spinAnim);
      b.classList.toggle('learned', learned.includes(id));
    }
  },
});
