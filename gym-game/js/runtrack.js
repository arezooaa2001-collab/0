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
// hurdle rows across the whole track, twice every 100 m (jump them!)
const RUN_HURDLES = [-25, -75];
// something to grab every 30 m: coins, and now and then an energy drink
const RUN_ITEM_GAP = 30;
const hash01 = (k) => { const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

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
    // hurdles: real solids, so you have to jump them (or squeeze through the gaps when tiny)
    for (let base = 100; base > T.z2; base -= 100) {
      for (const hz of RUN_HURDLES) {
        const z = base + hz;
        if (z < T.z2 + 2 || z > T.z1 - 2) continue;
        for (let x = -17.5; x <= 17.5; x += 5) {
          // one unbroken bar from wall to wall: no gap to slip through
          for (const sx of [-1, 1]) {
            this.metal.box(0.06, 0.5, 0.06, x + sx * 2.2, 0.25, z, '#c9ced6');
            this.metal.box(0.06, 0.03, 0.5, x + sx * 2.2, 0.015, z + 0.2, '#c9ced6');
          }
          for (let i = 0; i < 5; i++) m.box(1.0, 0.12, 0.05, x - 2 + i, 0.45, z, i % 2 ? '#ffffff' : '#e63946');
        }
      }
    }
    // the blue pad back to the hall sits behind the start line and moves with it
    this.exitPad = { x: 0, z: 14 };
    const pad = new THREE.Mesh(new THREE.BoxGeometry(6, 0.01, 2), new THREE.MeshBasicMaterial({ color: '#7fe0ff', toneMapped: false }));
    pad.position.set(0, 0.005, 14);
    this.startGate.add(pad);
    const padSign = labelSprite('🏋️ برگشت به تالار', 'اینجا بایست', '#7fe0ff', 4);
    padSign.position.set(0, 3, 14.5);
    this.startGate.add(padSign);
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
    if (r.phase === 'down') {
      // ran out in mid-air: fall over once they land
      if (!r.fainted && ch.grounded && !ch.busy) r.fainted = ch.play('faint', () => { r.phase = 'out'; });
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
        r.fainted = ch.play('faint', () => { r.phase = 'out'; });
        ch.setLabel(n.name, `😵 ${fa(Math.floor(r.dist))} متر`, '#ff9aa2');
        return [0, 0, 0];
      }
      // jump the next hurdle row just in time
      if (ch.grounded && !ch.busy) {
        const lead = r.speed * 0.3 + 0.35;
        for (let base = Math.ceil(pos.z / 100) * 100; base > pos.z - 200; base -= 100) {
          for (const hz of RUN_HURDLES) {
            const ahead = pos.z - (base + hz);
            if (ahead > 0 && ahead < lead) ch.jump(6.2);
          }
        }
      }
      const dx = (r.lane - pos.x) * 0.3;
      return [dx, -1, r.speed];
    }
    return [0, 0, 0];
  }
}

ENV_BUILDERS.runtrack = () => new RunWorld();

/** Take a coin or drink off the track; a drink's own geometry is freed (coins share theirs). */
function disposeRunItem(m) {
  if (m.parent) m.parent.remove(m);
  if (m.isGroup) m.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
}

/** A can of energy drink: grab it to refill a quarter of your energy. */
function drinkMesh() {
  const b = new Batch();
  b.cyl(0.16, 0.42, 0, 0, 0, '#2ecc71', 0, 0, 0, 14);
  b.cyl(0.165, 0.1, 0, 0.05, 0, '#ffd34d', 0, 0, 0, 14);
  b.cyl(0.13, 0.03, 0, 0.225, 0, '#c9ced6', 0, 0, 0, 14);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(mergeParts(b.parts, false), GLOW_MAT));
  return g;
}

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
    if (!this.run && w.offset !== 0) {
      // a new visit starts at the start line, not where the last run ended
      w.offset = 0;
      w.labelGantries();
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
      R.traceT -= dt;
      if (R.traceT <= 0 && R.trace.length < 60000) { R.traceT = 0.2; R.trace.push(Math.round(R.t * 10) / 10, Math.round(d * 10) / 10, Math.round(pos.x * 10) / 10); }
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
    const padD = Math.hypot(pos.x - w.exitPad.x, pos.z - (w.exitPad.z + w.offset));
    if (R.state !== 'running' && padD < 1.5 && !this.runExitArmed) {
      this.runExitArmed = true;
      this.travel('gym');
      return;
    }
    if (padD > 2.5) this.runExitArmed = false;
    // out of energy in the middle of a jump: faint as soon as the feet touch the ground
    if (this.runFaintPending && P.ch.grounded && !P.ch.busy) {
      this.runFaintPending = false;
      P.vel.set(0, 0);
      P.ch.play('faint');
    }
    this.tickRunItems(w, R, P, e, max);
    this.tickGhost(w, R, dt);
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
    R.trace = [];
    R.traceT = 0;
    this.runBestBefore = this.save.runBest || 0;
    this.spawnGhost();
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
  finishRunRace(finished, byChoice) {
    const R = this.runState();
    const w = this.world;
    const P = this.player;
    R.state = 'done';
    const me = Math.floor(R.d);
    if (byChoice) {
      this.toast('⏹ دویدن رو تموم کردی؛ همین فاصله حساب شد.');
    } else if (!finished) {
      this.stopLoop(true);
      P.ch.stopAction();
      P.vel.set(0, 0);
      this.runFaintPending = !P.ch.play('faint');
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
    // rank is the prize tier (far behind counts as 5 or 10); place is where you actually finished
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
    if (place === 1 && rows.length > 1) this.save.stats.runWins = (this.save.stats.runWins || 0) + 1;
    // a new record: next time your ghost runs it again beside you
    const G = this.save.runGhost;
    if (me > 30 && (!G || me > G.d) && R.trace && R.trace.length >= 6) {
      const n = R.trace.length / 3;
      const step = Math.max(1, Math.ceil(n / 1500));
      const pts = [];
      for (let i = 0; i < n; i += step) pts.push(R.trace[i * 3], R.trace[i * 3 + 1], R.trace[i * 3 + 2]);
      pts.push(R.trace[(n - 1) * 3], R.trace[(n - 1) * 3 + 1], R.trace[(n - 1) * 3 + 2]);
      this.save.runGhost = { d: me, pts };
      if (G) setTimeout(() => this.toast('👻 رکورد جدید! دفعه‌ی بعد روحِ همین دویدنت کنارت می‌دوه.', 'gold'), 2600);
    }
    this.save.runBest = Math.max(this.save.runBest || 0, me);
    this.checkAchievements();
    if (prize > 0) this.addLevels(prize, false);
    this.persist();
    const record = me > (this.runBestBefore || 0) && me > 30;
    clearTimeout(this.runResultT);
    this.runResultT = setTimeout(() => {
      // only if this race is still the one on screen
      if (this.run !== R || R.state !== 'done' || !(this.world instanceof RunWorld)) return;
      this.showRunResult(rows, rank, prize, finished, me, place);
      if (rank === 1 || finished || record) { this.confetti(); this.fireworks(6); this.victoryDance(400); }
      if (record) this.toast(`🎉 رکورد جدید: ${fa(me)} متر!`, 'gold');
    }, finished ? 400 : 2200);
  },

  showRunResult(rows, rank, prize, finished, me, place) {
    const list = $('runResultList');
    list.innerHTML = '';
    rows.forEach((r, i) => {
      const li = document.createElement('li');
      li.className = r.me ? 'me' : '';
      li.textContent = `${fa(i + 1)}. ${r.name}: ${fa(r.d)} متر${r.me ? ' (تو)' : ''}`;
      list.appendChild(li);
    });
    $('runResultTitle').textContent = finished ? '🏆 یک میلیون متر رو تموم کردی!' : rank ? `🏁 نفر ${fa(place)}${rank !== place ? ` (جایزه‌ی رتبه‌ی ${fa(rank)})` : ''}` : '🏃 تمرین تموم شد';
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
    clearTimeout(this.runResultT);
    this.runFaintPending = false;
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
    this.clearRunItems(w);
    this.removeGhost();
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
    clearTimeout(this.runResultT);
    this.runFaintPending = false;
    // coins and drinks go too (they live in the track's scene, not the one you are in now)
    if (this.runItems) for (const it of this.runItems.values()) if (it.mesh) disposeRunItem(it.mesh);
    this.runItems = null;
    this.removeGhost();
    if (!R) return;
    for (const n of R.guests) if (n.run) this.sendRunnerHome(n);
  },

  /* ---- coins and energy drinks along the track ---- */

  tickRunItems(w, R, P, e, max) {
    if (!this.runItems) this.runItems = new Map();
    if (!R.taken) R.taken = new Set();
    const pos = P.ch.root.position;
    const pd = w.distAt(pos.z);
    const lo = Math.max(1, Math.floor((pd - 40) / RUN_ITEM_GAP));
    const hi = Math.floor((pd + 280) / RUN_ITEM_GAP);
    for (const [k, it] of this.runItems) {
      if (k >= lo && k <= hi) continue;
      if (it.mesh) disposeRunItem(it.mesh);
      this.runItems.delete(k);
    }
    for (let k = lo; k <= hi; k++) {
      if (this.runItems.has(k) || R.taken.has(k)) continue;
      const h = hash01(k);
      const kind = h < 0.2 ? 'drink' : h < 0.75 ? 'coin' : null;
      const it = { kind, d: k * RUN_ITEM_GAP + 12, x: -17.5 + 5 * Math.floor(hash01(k * 7.31 + 3) * 8) };
      if (kind) {
        it.mesh = kind === 'coin' ? new THREE.Mesh(COIN_GEO, COIN_MAT) : drinkMesh();
        it.mesh.userData.noSolid = true;
        if (kind === 'coin') it.mesh.scale.setScalar(1.6);
        w.scene.add(it.mesh);
      }
      this.runItems.set(k, it);
    }
    const t = this.clock;
    for (const [k, it] of this.runItems) {
      if (!it.mesh) continue;
      it.mesh.position.set(it.x, 1.0 + Math.sin(t * 3 + k) * 0.12, w.offset - it.d);
      it.mesh.rotation.y = t * 3 + k;
      const p = it.mesh.position;
      // grabbed when the body passes through it (jumping counts)
      if (Math.abs(p.x - pos.x) < 0.9 && Math.abs(p.z - pos.z) < 0.9 && P.ch.airY + pos.y < 1.8) {
        disposeRunItem(it.mesh);
        it.mesh = null;
        R.taken.add(k);
        if (it.kind === 'coin') {
          this.addCoins(2);
          this.floatText('+۲ 🪙', '');
          Sfx.play('coin');
        } else {
          const add = Math.round(max * 0.25);
          e.now = Math.min(max, e.now + add);
          this.floatText(`+${fa(add)} ⚡`, 'fl-run');
          Sfx.play('xp');
          w.fx.ring({ x: pos.x, y: 0.4, z: pos.z }, { count: 30, color: '#a7e22e', radius: 0.4, speed: 3, life: 0.5 });
        }
      }
    }
  },

  clearRunItems(w) {
    if (this.runItems) for (const it of this.runItems.values()) if (it.mesh) disposeRunItem(it.mesh);
    this.runItems = new Map();
    if (this.run) this.run.taken = new Set();
  },

  /* ---- the ghost of your best run ---- */

  spawnGhost() {
    this.removeGhost();
    const G = this.save.runGhost;
    if (!G || !Array.isArray(G.pts) || G.pts.length < 6) return;
    const ch = new Character(Object.assign({}, this.player.ch.o));
    const mat = CHAR_MAT.clone();
    mat.transparent = true;
    mat.opacity = 0.42;
    mat.depthWrite = false;
    ch.mesh.material = mat;
    ch.setLabel('👻 رکوردت', `${fa(Math.floor(G.d))} متر`, '#c8b6ff');
    ch.onEvent = null;
    this.world.scene.add(ch.root);
    this.ghost = { ch, pts: G.pts, i: 0, done: false };
  },

  removeGhost() {
    const g = this.ghost;
    if (!g) return;
    g.ch.mesh.material.dispose();
    g.ch.dispose();
    this.ghost = null;
  },

  tickGhost(w, R, dt) {
    const g = this.ghost;
    if (!g) return;
    const P = g.pts;
    const t = R.state === 'running' ? R.t : g.lastT || 0;
    g.lastT = t;
    while (g.i + 3 < P.length - 3 && P[g.i + 3] <= t) g.i += 3;
    const i = g.i;
    const t0 = P[i], t1 = P[i + 3] ?? t0;
    const k = t1 > t0 ? clamp((t - t0) / (t1 - t0), 0, 1) : 1;
    const d = lerp(P[i + 1], P[i + 4] ?? P[i + 1], k);
    const x = lerp(P[i + 2], P[i + 5] ?? P[i + 2], k);
    const ch = g.ch;
    ch.root.position.set(x, 0, w.offset - d);
    ch.root.rotation.y = Math.PI;
    const end = t >= P[P.length - 3];
    ch.speed = !end && t1 > t0 ? (P[i + 4] - P[i + 1]) / (t1 - t0) : 0;
    if (end && !g.done) { g.done = true; ch.play('faint'); }
    const z = ch.root.position.z;
    ch.root.visible = z < RUN_TRACK.z1 - 1 && z > RUN_TRACK.z2 + 1;
    ch.update(dt);
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
      const kmh = Math.round(this.player.vel.length() * 3.6);
      head = `🏃 ${fa(Math.floor(R.d))} متر • 🚀 ${fa(kmh)} کیلومتر بر ساعت${R.guests.length ? ` • نفر ${fa(place)}` : ''}`;
      info = `تا یک میلیون متر: ${fa(Math.max(0, RUN_TRACK.goal - Math.floor(R.d)))} متر مونده`;
    } else {
      head = '😵 مسابقه تموم شد';
      info = 'دکمه‌ی «دوباره» رو بزن یا روی سکوی آبی پشت خط شروع برو تا برگردی تالار.';
    }
    if ($('runHead').textContent !== head) $('runHead').textContent = head;
    if ($('runInfo').textContent !== info) $('runInfo').textContent = info;
    $('runInvite').hidden = R.state === 'running';
    $('runAgain').hidden = R.state !== 'done';
    $('runStop').hidden = R.state !== 'running';
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
