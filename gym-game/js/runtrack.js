'use strict';
/*
 * The Energy & Running Hall (a new hall through the gym's east wall, red and yellow chequered)
 * and the Million-Metre Track behind its gate: 40 m wide, 1,000,000 m long. You run it
 * yourself with the joystick (normal, turbo or super turbo). Every step costs energy, faster
 * modes cost more per second. When the energy runs out you faint (and get up again), and the
 * race is over: the distance counts, compared with the people you invited (up to three).
 * Energy has its own level, raised by its own exercises.
 */

const RUN_HALL = { door: 4, doorH: 4.4, x1: 132.5, x2: 172.5, gate: { x: 170.4, z: 0 } };
const RUN_TRACK = { half: 20.5, goal: 1000000, shift: 100, z1: 170, z2: -470, tile: 4, recenter: -150 };
const RUN_TURBO = { turbo: 2.5, superturbo: 5 };
// energy per second at full speed in each way of moving (faster = more per second)
const RUN_DRAIN = { walk: 0.5, run: 1, jumprun: 1.1, turbo: 2.3, superturbo: 4.2 };
const RUN_PRIZE = { 1: 1000000, 2: 20000, 3: 100, 4: 50, 5: 10, 10: 0 };
const RUN_MAX_GUESTS = 3;

const energyMax = (L) => Math.round(100 + 80 * (L - 1) + 2 * (L - 1) * (L - 1));
const energyNeed = (L) => Math.round(30 + 12 * L);
/** People's energy grows with their strength. */
const npcEnergyLv = (n) => 1 + Math.floor(n.level / 5);

ENVS.push({ id: 'runtrack', name: 'پیست دو یک‌میلیون متری', icon: '🏁', level: 1, noVisit: true, desc: '۴۰ متر پهنا، ۱٬۰۰۰٬۰۰۰ متر طول • توربو و انرژی' });
ENV_BY_ID.runtrack = ENVS[ENVS.length - 1];

const TURBO_MOVES = [
  { id: 'turbo', name: 'دویدن توربو', icon: '🚀', toggle: true, level: 1, cat: 'base', hint: 'فقط توی پیست دو' },
  { id: 'superturbo', name: 'دویدن خیلی توربو', icon: '☄️', toggle: true, level: 1, cat: 'base', hint: 'فقط توی پیست دو' },
];
// exercises that raise the energy level (their "level" is the energy level they need)
const ENERGY_MOVES = [
  ['en_jog', 'دویدن درجا', '🏃‍♂️', 1, 22, 'highknees'],
  ['en_rope', 'طناب استقامت', '🪢', 3, 32, 'rope'],
  ['en_jack', 'جک انرژی', '⭐', 6, 44, 'jack'],
  ['en_burpee', 'برپی استقامت', '💥', 10, 62, 'burpee'],
  ['en_skater', 'اسکیتر', '⛸️', 16, 85, 'skater'],
  ['en_mountain', 'کوهنورد', '⛰️', 25, 115, 'mountain'],
].map(([id, name, icon, level, ex, anim]) => ({ id, name, icon, level, xp: 0, ex, anim, cat: 'energy' }));
MOVES.splice(2, 0, ...TURBO_MOVES);
MOVES.push(...ENERGY_MOVES);
for (const m of [...TURBO_MOVES, ...ENERGY_MOVES]) MOVE_BY_ID[m.id] = m;
Object.assign(RUN_XP_PER_SEC, { turbo: 4, superturbo: 6 });

/** Out of energy: down on the back, rest, back on the feet. */
ANIMS.faint = {
  dur: 7,
  events: [[0.12, 'thud']],
  fn(p, t) {
    const down = smooth(seg(t, 0, 0.12)) * (1 - smooth(seg(t, 0.74, 0.95)));
    const breathe = Math.sin(t * 7 * 4) * 0.04 * down;
    p.bx = -1.5 * down;
    p.y = -0.8 * down;
    p.spX = -0.05 * down + breathe;
    p.nkX = 0.25 * down;
    p.hpLX = p.hpRX = -0.08 * down - 0.6 * Math.sin(Math.PI * seg(t, 0.74, 0.95));
    p.knL = p.knR = 0.1 * down + 1.2 * Math.sin(Math.PI * seg(t, 0.74, 0.95));
    p.hpLZ = 0.15 * down; p.hpRZ = -0.15 * down;
    p.shLX = p.shRX = -0.3 * down;
    p.shLZ = 0.12 + 1.0 * down; p.shRZ = -p.shLZ;
    p.elL = p.elR = -0.2 - 0.4 * down;
  },
};

function chequer2(colors, cells) {
  return makeCanvasTexture(256, 256, (ctx, w) => {
    const s = w / cells;
    for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) {
      ctx.fillStyle = colors[(i + j) % colors.length];
      ctx.fillRect(i * s, j * s, s, s);
    }
  });
}

/* ---------------- the hall in the gym ---------------- */

Object.assign(GymWorld.prototype, {
  buildRunHall() {
    const m = this.matte;
    const mt = this.metal;
    const glow = this.glow;
    const { x1, x2 } = RUN_HALL;
    const Z = ROOM.z;
    const H = ROOM.h;
    const W = x2 - x1;
    const cx = (x1 + x2) / 2;
    const tex = chequer2(['#e63946', '#ffd34d'], 2);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(W / 4, Z / 2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, Z * 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0.003, 0);
    this.scene.add(floor);
    const wall = '#ffe1c2';
    m.box(W + 0.5, H, 0.5, cx + 0.25, H / 2, -Z - 0.25, wall);
    m.box(W + 0.5, H, 0.5, cx + 0.25, H / 2, Z + 0.25, wall);
    m.box(0.5, H, Z * 2 + 1, x2 + 0.25, H / 2, 0, wall);
    m.box(W + 1, 0.3, Z * 2 + 1, cx, H + 0.15, 0, '#1a1f2c');
    for (const sz of [-1, 1]) {
      m.box(W, 1.3, 0.1, cx, 0.65, sz * (Z - 0.05), '#8f1d2c');
      m.box(W, 0.12, 0.12, cx, 1.36, sz * (Z - 0.06), '#ffc23d');
      ['#e63946', '#ff7b00', '#ffd34d'].forEach((c, i) => m.box(W, 0.22, 0.06, cx, 1.7 + i * 0.3, sz * (Z - 0.03), c));
    }
    m.box(0.1, 1.3, Z * 2, x2 - 0.05, 0.65, 0, '#8f1d2c');
    for (let lx = x1 + 5; lx < x2; lx += 10) for (let lz = -26; lz <= 26; lz += 8.6) glow.box(5, 0.06, 1.2, lx, H - 0.05, lz, '#fff4dc');
    // the gate to the Million-Metre Track
    const G = RUN_HALL.gate;
    for (const sz of [-1, 1]) {
      mt.box(0.6, 6.2, 0.6, x2 - 0.8, 3.1, G.z + sz * 4.3, '#2c3140');
      glow.box(0.66, 0.12, 0.66, x2 - 0.8, 2.2, G.z + sz * 4.3, '#ffd34d');
    }
    mt.box(0.8, 0.8, 9.2, x2 - 0.8, 6.4, G.z, '#e63946');
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(8, 5.8), new THREE.MeshBasicMaterial({ map: chequer2(['#ff7b00', '#ffd34d'], 8), transparent: true, opacity: 0.85, toneMapped: false }));
    portal.position.set(x2 - 0.02, 2.95, G.z);
    portal.rotation.y = -Math.PI / 2;
    this.scene.add(portal);
    this.anims.push((dt, time) => { portal.material.opacity = 0.65 + 0.2 * Math.sin(time * 3); portal.material.map.offset.y = (time * 0.4) % 1; });
    const label = labelSprite('🏁 پیست دو یک‌میلیون متری', '۴۰ متر پهنا • ۱٬۰۰۰٬۰۰۰ متر طول', '#ffd34d', 6);
    label.position.set(x2 - 1.5, 7.6, G.z);
    this.scene.add(label);
    const hall = labelSprite('⚡ تالار انرژی و دو', 'تمرین انرژی • توربو • مسابقه', '#ff7b00', 6);
    hall.position.set(x1 + 3, 6.2, 0);
    this.scene.add(hall);
    // energy training corner with mats flush to the floor
    for (let i = 0; i < 6; i++) {
      const x = x1 + 6 + (i % 3) * 5;
      const z = (i < 3 ? -1 : 1) * 18;
      glow.box(2.6, 0.012, 2.6, x, 0.006, z, ['#ff7b00', '#ffd34d', '#e63946'][i % 3]);
      this.addStation(x, z, rand(-Math.PI, Math.PI), ['highknees', 'rope', 'jack', 'burpee', 'skater', 'mountain']);
    }
    // a board with your best run and energy level
    this.runBoardTex = makeCanvasTexture(1024, 512, () => {});
    const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ map: this.runBoardTex, toneMapped: false }));
    board.position.set(cx, 5.2, -Z + 0.04);
    this.scene.add(board);
  },

  nearRunGate() {
    const p = this.player.ch.root.position;
    const G = RUN_HALL.gate;
    return p.x > G.x - 3.2 && Math.abs(p.z - G.z) < 4;
  },

  drawRunBoard(best, eLv, eMax) {
    redrawCanvasTexture(this.runBoardTex, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#3a0d12'); g.addColorStop(1, '#5a2a05');
      ctx.fillStyle = g;
      roundRect(ctx, 0, 0, w, h, 30); ctx.fill();
      ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 12; roundRect(ctx, 8, 8, w - 16, h - 16, 26); ctx.stroke();
      ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd34d'; ctx.font = `110px ${DISPLAY_FONT}`;
      ctx.fillText('🏁 رکورد دوی تو', w / 2, 110);
      ctx.fillStyle = '#ffffff'; ctx.font = `130px ${DISPLAY_FONT}`;
      ctx.fillText(`${fa(Math.floor(best))} متر`, w / 2, 270);
      ctx.fillStyle = '#ffc9a0'; ctx.font = `600 54px ${UI_FONT}`;
      ctx.fillText(`⚡ سطح انرژی ${fa(eLv)} • ${fa(eMax)} انرژی`, w / 2, 410);
    });
  },
});

/* ---------------- the track ---------------- */

class RunWorld extends EnvWorld {
  constructor() {
    super('runtrack', {
      bounds: { rect: [RUN_TRACK.half, 1e7] }, spawn: { x: 0, z: 8, yaw: Math.PI },
      background: '#ffe2c4', fog: [140, 430], skyTop: '#ff8c42', skyBottom: '#ffe8c9',
    });
    this.allowTurbo = true;
    this.offset = 0;
    const T = RUN_TRACK;
    const L = T.z1 - T.z2;
    const zc = (T.z1 + T.z2) / 2;
    const m = this.matte;
    const glow = this.glow;
    const tex = chequer2(['#e63946', '#ffd34d'], 2);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set((T.half * 2) / (T.tile * 2), L / (T.tile * 2));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(T.half * 2, L), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.002, zc);
    this.scene.add(floor);
    m.box(200, 0.1, L, 0, -0.06, zc, '#7a5a3a');
    // low walls you can touch, with stripes every 10 m (the pattern repeats every 100 m)
    for (const sx of [-1, 1]) {
      m.box(0.5, 1.1, L, sx * (T.half + 0.25), 0.55, zc, '#2c3140');
      for (let z = T.z1; z > T.z2; z -= 10) {
        glow.box(0.06, 0.25, 4.6, sx * (T.half + 0.01), 0.8, z - 2.5, (Math.round(z / 10) % 2) ? '#ffd34d' : '#e63946');
        m.cyl(0.9, 0.3, sx * (T.half + 7), 0.15, z - 5, '#5d8f3a', 0, 0, 0, 10);
        m.add(UnitGeo.cone(10), sx * (T.half + 7), 3.4, z - 5, '#2f8f4e', 0, 0, 0, 1.8, 4.6, 1.8);
        m.cyl(0.18, 1.2, sx * (T.half + 7), 0.6, z - 5, '#6b4a2a');
      }
    }
    // lane lines flush with the ground
    for (let x = -15; x <= 15; x += 5) glow.box(0.08, 0.004, L, x, 0.004, zc, '#ffffff');
    // a gantry every 100 m showing the distance
    this.gantries = [];
    for (let z = 100; z > T.z2; z -= 100) {
      for (const sx of [-1, 1]) this.metal.box(0.4, 6.6, 0.4, sx * (T.half - 0.35), 3.3, z, '#c9ced6');
      this.metal.box(T.half * 2, 0.5, 0.5, 0, 6.6, z, '#e63946');
      const tx = makeCanvasTexture(1024, 256, () => {});
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false, side: THREE.DoubleSide }));
      sign.position.set(0, 5.3, z);
      this.scene.add(sign);
      this.gantries.push({ z, tx });
    }
    // start and finish arches (they move with the distance)
    this.startGate = this.arch('🏁 شروع', '#2ecc71');
    // the back wall behind the start pad
    const bw = new Batch();
    bw.box(RUN_TRACK.half * 2, 1.2, 0.4, 0, 0.6, 17.2, '#2c3140');
    for (let x = -18; x <= 18; x += 4) bw.box(1.2, 0.5, 0.05, x, 0.8, 16.99, x % 8 ? '#ffd34d' : '#e63946');
    this.startGate.add(new THREE.Mesh(mergeParts(bw.parts, false), MATTE_MAT));
    this.finishGate = this.arch('🏆 پایان • ۱٬۰۰۰٬۰۰۰ متر', '#ffd34d');
    this.exitPad = { x: 0, z: 14 };
    glow.box(6, 0.01, 2, 0, 0.005, 14, '#7fe0ff');
    this.sign('🏋️ برگشت به تالار', 'اینجا بایست', 0, 3, 14.5, '#7fe0ff');
    this.finishBatches();
    this.labelGantries();
  }

  arch(text, color) {
    const g = new THREE.Group();
    g.userData.noSolid = true;
    const b = new Batch();
    for (const sx of [-1, 1]) b.box(0.6, 7, 0.6, sx * (RUN_TRACK.half - 0.6), 3.5, 0, color);
    b.box(RUN_TRACK.half * 2, 0.8, 0.6, 0, 7, 0, color);
    g.add(new THREE.Mesh(mergeParts(b.parts, false), GLOW_MAT));
    const line = new THREE.Mesh(new THREE.PlaneGeometry(RUN_TRACK.half * 2, 0.5), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.006;
    g.add(line);
    const s = labelSprite(text, '', color, 7);
    s.position.y = 8.6;
    g.add(s);
    this.scene.add(g);
    return g;
  }

  labelGantries() {
    for (const g of this.gantries) {
      const d = this.offset - g.z;
      redrawCanvasTexture(g.tx, (ctx, w, h) => {
        ctx.fillStyle = '#1b1f3d'; roundRect(ctx, 0, 0, w, h, 24); ctx.fill();
        ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 10; roundRect(ctx, 6, 6, w - 12, h - 12, 20); ctx.stroke();
        ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = d < 0 ? '#7fe0ff' : '#ffffff'; ctx.font = `120px ${DISPLAY_FONT}`;
        ctx.fillText(d < 0 ? 'پیش از شروع' : `${fa(d)} متر`, w / 2, h / 2 + 6);
      });
    }
    this.placeGates();
  }

  placeGates() {
    const T = RUN_TRACK;
    for (const [g, d] of [[this.startGate, 0], [this.finishGate, T.goal]]) {
      const z = this.offset - d;
      g.position.z = z;
      g.visible = z < T.z1 - 2 && z > T.z2 + 2;
    }
  }

  /** Logical distance of a spot along the track (0 at the start line). */
  distAt(z) { return this.offset - z; }

  /** Keep everyone near the middle: the pattern repeats, so moving people back by 100 m looks the same. */
  recenter(game) {
    const P = this.player;
    if (!P || P.ch.root.position.z > RUN_TRACK.recenter) return;
    const s = RUN_TRACK.shift;
    this.offset += s;
    P.ch.root.position.z += s;
    for (const n of this.npcs) n.ch.root.position.z += s;
    this.cam.tz += s;
    if (game.camera) game.camera.position.z += s;
    if (game.pet && game.pet.root) game.pet.root.position.z += s;
    this.labelGantries();
  }

  updateExtra(dt) {
    super.updateExtra(dt);
    const T = RUN_TRACK;
    for (const n of this.npcs) {
      const z = n.ch.root.position.z;
      n.ch.root.visible = z < T.z1 - 1 && z > T.z2 + 1;
    }
  }

  /** A runner in the race: waits on its lane, then runs until its energy runs out and faints. */
  raceNpc(n, dt) {
    const r = n.run;
    const ch = n.ch;
    const pos = ch.root.position;
    if (!r) { n.state = 'idle'; n.timer = 1; return [0, 0, 0]; }
    if (r.phase === 'ready') {
      const dx = r.lane - pos.x;
      const dz = (this.offset + 1.5 + r.back) - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.3) return [dx / d, dz / d, Math.min(2.5, d * 2)];
      ch.root.rotation.y = angleLerp(ch.root.rotation.y, Math.PI, damp(6, dt));
      return [0, 0, 0];
    }
    if (r.phase === 'go') {
      r.react -= dt;
      if (r.react > 0) return [0, 0, 0];
      r.energy -= r.drain * dt;
      r.dist = Math.max(r.dist, this.distAt(pos.z));
      if (r.energy <= 0) {
        r.phase = 'down';
        r.energy = 0;
        n.vel.set(0, 0);
        ch.stopAction();
        ch.play('faint', () => { r.phase = 'out'; });
        ch.setLabel(n.name, `😵 ${fa(Math.floor(r.dist))} متر`, '#ff9aa2');
        return [0, 0, 0];
      }
      const dx = (r.lane - pos.x) * 0.3;
      return [dx, -1, r.speed];
    }
    return [0, 0, 0];
  }
}

ENV_BUILDERS.runtrack = () => new RunWorld();

/* ---------------- you: energy, turbo, the race ---------------- */

Object.assign(Game, {
  energy() {
    const e = this.save.energy;
    if (!e || typeof e !== 'object') this.save.energy = { level: 1, xp: 0, now: energyMax(1) };
    const v = this.save.energy;
    v.level = Math.max(1, Math.floor(Number(v.level) || 1));
    v.xp = Math.max(0, Number(v.xp) || 0);
    if (!(v.now >= 0)) v.now = energyMax(v.level);
    return v;
  },
  energyLv() { return this.energy().level; },

  /** An energy exercise: its points go to the energy level, not to strength. */
  energyDone(m) {
    this.lastExerciseEnd = this.clock;
    const e = this.energy();
    e.xp += m.ex;
    this.floatText(`+${fa(m.ex)} ⚡`, 'fl-run');
    Sfx.play('xp');
    let up = 0;
    while (e.xp >= energyNeed(e.level) && up < 1000) { e.xp -= energyNeed(e.level); e.level++; up++; }
    if (up) {
      e.now = energyMax(e.level);
      Sfx.play('levelup');
      this.showBanner('⚡ سطح انرژی', fa(e.level));
      this.toast(`⚡ سطح انرژیت ${fa(e.level)} شد! حالا ${fa(energyMax(e.level))} انرژی داری و بیشتر می‌تونی بدوی.`, 'gold');
    }
    this.noteRep(m);
    this.refreshEnergyHud(true);
    this.refreshMoves();
    this.persist();
  },

  turboMult() {
    const P = this.player;
    return P && this.world && this.world.allowTurbo && RUN_TURBO[P.mode] ? RUN_TURBO[P.mode] : 1;
  },

  refreshEnergyHud(force) {
    const e = this.energy();
    const key = `${e.level}|${Math.floor(e.xp)}`;
    if (!force && key === this.enKey) return;
    this.enKey = key;
    $('enText').textContent = `⚡ سطح انرژی ${fa(e.level)}`;
    $('enFill').style.width = `${clamp(e.xp / energyNeed(e.level), 0, 1) * 100}%`;
  },

  /* ---- people coming to run with you ---- */

  openRunInvite() {
    const list = $('runInviteList');
    list.innerHTML = '';
    const R = this.runState();
    const people = [...(this.people || [])].sort((a, b) => b.level - a.level);
    $('runInviteHead').textContent = `حداکثر ${fa(RUN_MAX_GUESTS)} نفر • دعوت‌شده: ${fa(R.guests.length)}`;
    for (const n of people) {
      const b = document.createElement('button');
      b.type = 'button';
      const on = R.guests.includes(n);
      b.className = 'inv-row' + (on ? ' on' : '');
      b.innerHTML = `<span class="inv-name"></span><span class="inv-sub"></span><span class="inv-act"></span>`;
      b.querySelector('.inv-name').textContent = n.name;
      b.querySelector('.inv-sub').textContent = `سطح ${fa(n.level)} • ⚡ انرژی ${fa(npcEnergyLv(n))} • ${this.locName ? this.locName(n.loc) : ''}`;
      b.querySelector('.inv-act').textContent = on ? '✅ میاد' : '🙋 دعوت';
      b.addEventListener('click', () => { this.toggleRunGuest(n); this.openRunInvite(); });
      list.appendChild(b);
    }
    if (!this.modals.has('runInviteModal')) this.openModal('runInviteModal');
  },

  toggleRunGuest(n) {
    const R = this.runState();
    const w = this.world;
    if (!(w instanceof RunWorld) || R.state === 'running') return;
    const i = R.guests.indexOf(n);
    if (i >= 0) {
      R.guests.splice(i, 1);
      this.sendRunnerHome(n);
      return;
    }
    if (R.guests.length >= RUN_MAX_GUESTS) { Sfx.play('error'); this.toast(`فقط ${fa(RUN_MAX_GUESTS)} نفر رو می‌تونی دعوت کنی.`, 'warn'); return; }
    // they accept and come over to the start line
    if (n.world) n.world.dropNpc(n);
    n.loc = 'runtrack';
    w.adoptNpc(n, { x: rand(-6, 6), z: 12 });
    const lane = [-6, 6, -12][R.guests.length] ?? rand(-14, 14);
    n.state = 'race';
    n.run = { phase: 'ready', lane, back: 0, dist: 0, energy: 0, speed: 0, drain: 0, react: 0 };
    n.ch.setLabel(n.name, '🏁 «باشه، بریم بدویم!»', '#ffd34d');
    R.guests.push(n);
    Sfx.play('xp');
    this.toast(`✅ ${n.name} قبول کرد و اومد سر خط شروع! (${fa(R.guests.length)} از ${fa(RUN_MAX_GUESTS)})`);
  },

  sendRunnerHome(n) {
    n.run = null;
    if (n.world) n.world.dropNpc(n);
    this.placePerson(n, 'gym', 'runtrack', false);
  },

  runState() {
    if (!this.run) this.run = { state: 'ready', guests: [], best: 0, t: 0, d: 0 };
    return this.run;
  },

  /** Every frame. */
  tickRun(dt) {
    const w = this.world;
    const P = this.player;
    this.refreshEnergyHud();
    if (!(w instanceof RunWorld)) {
      if (this.run) this.leaveRun();
      if (P && RUN_TURBO[P.mode]) { P.mode = 'run'; this.refreshMoves(); }
      $('runPanel').hidden = true;
      $('hud').classList.remove('run-on');
      this.regenEnergy(dt);
      this.tickRunBoard(dt);
      return;
    }
    const R = this.runState();
    w.recenter(this);
    const e = this.energy();
    const max = energyMax(e.level);
    const pos = P.ch.root.position;
    // behind the start there is only the blue pad back to the hall (a wall of flags, nothing invisible)
    const back = Math.min(RUN_TRACK.z1 - 2, w.offset + 17 - 0.16);
    if (pos.z > back) pos.z = back;
    const d = w.distAt(pos.z);
    if (R.state === 'ready') {
      e.now = Math.min(max, e.now + max * 0.1 * dt);
      if (d > 0.3 && this.mode === 'play') this.startRunRace();
    } else if (R.state === 'running') {
      R.t += dt;
      R.d = Math.max(R.d, d);
      const sp = P.vel.length();
      if (sp > 0.2) {
        const key = RUN_TURBO[P.mode] ? P.mode : (P.mode === 'walk' && !this.keys.has('ShiftLeft') ? 'walk' : P.mode);
        const full = key === 'walk' ? 2.5 : runSpeedFor(this.runLv()) * this.turboMult();
        e.now -= RUN_DRAIN[key] * Math.min(1.2, sp / Math.max(1, full)) * dt;
      }
      if (R.d >= RUN_TRACK.goal) this.finishRunRace(true);
      else if (e.now <= 0) { e.now = 0; this.finishRunRace(false); }
    } else {
      e.now = Math.min(max, e.now + max * 0.04 * dt);
    }
    // can't leave without walking out; standing on the blue pad takes you back to the hall
    if (R.state !== 'running' && Math.hypot(pos.x - w.exitPad.x, pos.z - (w.exitPad.z + w.offset * 0)) < 1.5 && w.offset === 0 && !this.runExitArmed) {
      this.runExitArmed = true;
      this.travel('gym');
      return;
    }
    if (Math.hypot(pos.x - w.exitPad.x, pos.z - w.exitPad.z) > 2.5) this.runExitArmed = false;
    this.renderRunPanel(d, e, max);
  },

  regenEnergy(dt) {
    const e = this.energy();
    const max = energyMax(e.level);
    if (e.now < max) e.now = Math.min(max, e.now + max * 0.05 * dt);
  },

  startRunRace() {
    const R = this.runState();
    const w = this.world;
    R.state = 'running';
    R.t = 0;
    R.d = 0;
    const base = runSpeedFor(this.runLv());
    for (const n of R.guests) {
      if (!n.run || n.world !== w) continue;
      // each one picks a way to run that suits them, with energy from their own level
      const mode = n.level > 60 ? 'superturbo' : n.level > 20 ? 'turbo' : 'run';
      const mult = mode === 'run' ? 1 : RUN_TURBO[mode];
      Object.assign(n.run, {
        phase: 'go', react: rand(0.25, 0.9), dist: 0,
        speed: Math.min(base * mult * rand(0.9, 1.1), 34), drain: RUN_DRAIN[mode] * rand(0.95, 1.05),
        energy: energyMax(npcEnergyLv(n)) * rand(0.85, 1.15),
      });
      n.ch.setLabel(n.name, `سطح ${fa(n.level)}`, '#7fe0ff');
    }
    Sfx.play('whoosh');
    this.showBanner(R.guests.length ? 'تا وقتی انرژی داری بدو!' : 'تنهایی: فقط تمرین (برای رتبه کسی رو دعوت کن)', '🏁 شروع!');
  },

  /** Out of energy (or past the million): the race is decided. */
  finishRunRace(finished) {
    const R = this.runState();
    const w = this.world;
    const P = this.player;
    R.state = 'done';
    const me = Math.floor(R.d);
    if (!finished) {
      this.stopLoop(true);
      P.ch.stopAction();
      P.vel.set(0, 0);
      P.ch.play('faint');
      this.toast('😵 انرژیت تموم شد و غش کردی! یه کم استراحت می‌کنی و دوباره پا می‌شی.', 'warn');
    }
    // where the others will end up: they keep going until their own energy is gone
    const rows = [{ name: this.playerName(), d: me, me: true }];
    for (const n of R.guests) {
      const r = n.run;
      if (!r) continue;
      const left = r.phase === 'go' ? (r.energy / Math.max(0.01, r.drain)) * r.speed : 0;
      rows.push({ name: n.name, d: Math.floor(Math.min(RUN_TRACK.goal, r.dist + left)), n });
    }
    rows.sort((a, b) => b.d - a.d);
    const place = rows.findIndex((r) => r.me) + 1;
    let rank = 0;
    let prize = 0;
    if (finished) {
      rank = 1;
      prize = RUN_PRIZE[1];
    } else if (rows.length > 1) {
      const lead = Math.max(...rows.filter((r) => !r.me).map((r) => r.d));
      rank = place;
      if (place > 1) {
        const k = lead > 0 ? me / lead : 0;
        if (k < 0.5) rank = 10;
        else if (k < 0.85) rank = Math.max(place, 5);
      }
      prize = Math.floor((RUN_PRIZE[rank] || 0) * Math.min(1, me / RUN_TRACK.goal));
      if (prize < 1 && rank <= 5 && me >= 100) prize = 1;
    }
    this.save.runBest = Math.max(this.save.runBest || 0, me);
    if (prize > 0) this.addLevels(prize, false);
    this.persist();
    setTimeout(() => this.showRunResult(rows, rank, prize, finished, me), finished ? 400 : 2200);
  },

  showRunResult(rows, rank, prize, finished, me) {
    const list = $('runResultList');
    list.innerHTML = '';
    rows.forEach((r, i) => {
      const li = document.createElement('li');
      li.className = r.me ? 'me' : '';
      li.textContent = `${fa(i + 1)}. ${r.name}: ${fa(r.d)} متر${r.me ? ' (تو)' : ''}`;
      list.appendChild(li);
    });
    $('runResultTitle').textContent = finished ? '🏆 یک میلیون متر رو تموم کردی!' : rank ? `🏁 رتبه‌ی ${fa(rank)}` : '🏃 تمرین تموم شد';
    $('runResultSub').textContent = finished
      ? `+${fa(prize)} سطح زور! قهرمان واقعی دو استقامتی!`
      : rank ? `${fa(me)} متر دویدی • جایزه: ${prize ? '+' + fa(prize) + ' سطح زور' : 'این بار جایزه‌ای نشد'} (جایزه‌ی هر رتبه برای کل یک میلیون متره و به اندازه‌ای که دویدی بهت می‌رسه)`
        : `${fa(me)} متر دویدی. برای رتبه و جایزه، از دکمه‌ی «دعوت» حداقل یه نفر رو بیار.`;
    this.openModal('runResultModal');
    Sfx.play(prize > 0 ? 'levelup' : 'click');
  },

  /** Back to the start line with full energy, everyone lined up again. */
  resetRun() {
    this.closeModal('runResultModal');
    const w = this.world;
    if (!(w instanceof RunWorld)) return;
    const R = this.runState();
    const shift = w.offset;
    w.offset = 0;
    for (const n of w.npcs) n.ch.root.position.z -= shift;
    w.cam.tz -= shift;
    this.camera.position.z -= shift;
    w.labelGantries();
    const P = this.player;
    this.stopLoop(true);
    P.ch.stopAction();
    P.ch.root.position.set(0, 0, 6);
    P.ch.root.rotation.y = Math.PI;
    P.vel.set(0, 0);
    R.state = 'ready';
    R.d = 0;
    const e = this.energy();
    e.now = energyMax(e.level);
    R.guests.forEach((n, i) => {
      if (!n.run) return;
      n.ch.stopAction();
      n.run.phase = 'ready';
      n.ch.root.position.set(n.run.lane, 0, 4 + i);
      n.ch.setLabel(n.name, '🏁 آماده', '#ffd34d');
    });
  },

  leaveRun() {
    const R = this.run;
    this.run = null;
    if (!R) return;
    for (const n of R.guests) if (n.run) this.sendRunnerHome(n);
  },

  renderRunPanel(d, e, max) {
    const R = this.runState();
    $('runPanel').hidden = this.mode !== 'play';
    $('hud').classList.toggle('run-on', this.mode === 'play');
    const frac = clamp(e.now / max, 0, 1);
    $('energyFill').style.width = `${frac * 100}%`;
    $('energyFill').classList.toggle('low', frac < 0.2);
    $('energyText').textContent = `⚡ ${fa(Math.ceil(e.now))} / ${fa(max)}`;
    this.runPanelT = (this.runPanelT || 0) + 1;
    if (this.runPanelT % 6) return;
    let head;
    let info;
    if (R.state === 'ready') {
      head = `🏁 خط شروع • ${fa(R.guests.length)} از ${fa(RUN_MAX_GUESTS)} حریف`;
      info = 'خودت با دسته‌ی حرکت بدو؛ از خط سفید که رد بشی مسابقه شروع می‌شه. 🚀 توربو و ☄️ خیلی توربو تندترن ولی انرژی بیشتری می‌خورن.';
    } else if (R.state === 'running') {
      const place = 1 + R.guests.filter((n) => n.run && n.run.dist > R.d).length;
      head = `🏃 ${fa(Math.floor(R.d))} متر • ⏱️ ${fa(Math.floor(R.t))} ثانیه${R.guests.length ? ` • الان نفر ${fa(place)}` : ''}`;
      info = `تا یک میلیون متر: ${fa(Math.max(0, RUN_TRACK.goal - Math.floor(R.d)))} متر مونده`;
    } else {
      head = '😵 مسابقه تموم شد';
      info = 'دکمه‌ی «دوباره» رو بزن یا روی سکوی آبی پشت خط شروع برو تا برگردی تالار.';
    }
    if ($('runHead').textContent !== head) $('runHead').textContent = head;
    if ($('runInfo').textContent !== info) $('runInfo').textContent = info;
    $('runInvite').hidden = R.state === 'running';
    $('runAgain').hidden = R.state !== 'done';
  },

  tickRunBoard(dt) {
    if (this.world !== this.gym || !this.gym.runBoardTex) return;
    this.runBoardT = (this.runBoardT || 0) - dt;
    if (this.runBoardT > 0) return;
    this.runBoardT = 4;
    const e = this.energy();
    const key = `${Math.floor(this.save.runBest || 0)}|${e.level}`;
    if (key === this.runBoardKey) return;
    this.runBoardKey = key;
    this.gym.drawRunBoard(this.save.runBest || 0, e.level, energyMax(e.level));
  },
});
