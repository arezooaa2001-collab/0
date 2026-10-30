'use strict';
/*
 * The Trick Field: a big chequered square of red, orange and yellow. Step on it and a special
 * move opens up: jump, spin upright in the air, turn flat, flip and land. Each time you start
 * it you choose how much strength it gives. That strength is "chosen", not earned, so the
 * cheat-wipe button takes it away again.
 */

const TRICK_FIELD = { half: 12, cell: 3 };
const TRICK_COLORS = ['#e63946', '#ff7b00', '#ffd34d'];

ENVS.push({ id: 'tricks', name: 'زمین حرکات ویژه', icon: '🌀', level: 1, desc: 'پرش چرخشی هوایی؛ زورش رو خودت انتخاب کن' });
ENV_BY_ID.tricks = ENVS[ENVS.length - 1];

const TRICK_MOVE = { id: 'aerialx', name: 'پرش چرخشی هوایی', icon: '🌀', level: 1, xp: 0, cat: 'field', field: 'tricks', anim: 'aerialx' };
MOVES.push(TRICK_MOVE);
MOVE_BY_ID.aerialx = TRICK_MOVE;

/** Up, spinning upright; flat out like flying; one flip; down on both feet. */
ANIMS.aerialx = {
  dur: 3.6,
  snapAll: true,
  events: [[0.13, 'whoosh'], [0.82, 'thud']],
  fn(p, t) {
    const H = 2.6;
    if (t < 0.13) {
      const c = smooth(t / 0.13);
      crouchPose(p, c * 0.9);
      p.shLX = p.shRX = 0.9 * c;
      p.elL = p.elR = -0.3;
      return;
    }
    if (t < 0.82) {
      const u = seg(t, 0.13, 0.82);
      p.y = 4 * H * u * (1 - u);
      // 1. upright spin, arms pulled in
      const spin = smooth(seg(t, 0.13, 0.4));
      p.by = TAU * 2 * spin;
      p.shLX = p.shRX = -0.4;
      p.shLZ = 0.15; p.shRZ = -0.15;
      p.elL = p.elR = -2.3;
      // 2. turn flat, arms out like wings
      const flat = smooth(seg(t, 0.4, 0.52));
      p.bx = (Math.PI / 2) * flat;
      p.shLZ += 1.35 * flat; p.shRZ -= 1.35 * flat;
      p.elL = p.elR = lerp(-2.3, -0.15, flat);
      p.shLX = p.shRX = lerp(-0.4, 0, flat);
      // 3. one tucked flip back to upright
      const f = seg(t, 0.52, 0.8);
      if (f > 0) {
        p.bx = Math.PI / 2 + 1.5 * Math.PI * smooth(f);
        const k = Math.sin(Math.PI * f);
        p.hpLX = p.hpRX = -1.9 * k;
        p.knL = p.knR = 2.2 * k;
        p.shLZ = lerp(1.5, 0.3, smooth(f)); p.shRZ = -p.shLZ;
        p.shLX = p.shRX = -1.2 * k;
        p.elL = p.elR = -0.4 - 0.6 * k;
      }
      return;
    }
    // land and stand up
    const c = 1 - smooth(seg(t, 0.84, 1));
    p.bx = TAU;
    p.by = TAU * 2;
    crouchPose(p, c * 0.85);
    p.shLX = p.shRX = -1.2 * c;
    p.shLZ = 0.12 + 0.6 * c; p.shRZ = -p.shLZ;
  },
};

function chequerTexture(colors, n) {
  return makeCanvasTexture(512, 512, (ctx, w) => {
    const s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      ctx.fillStyle = colors[(i + j) % colors.length];
      ctx.fillRect(i * s, j * s, s, s);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(i * s, j * s, s, 3);
    }
  });
}

ENV_BUILDERS.tricks = () => {
  const w = new EnvWorld('tricks', { bounds: { rect: [26, 26] }, spawn: { x: 0, z: 19, yaw: Math.PI }, background: '#ffe2c4', fog: [70, 240], skyTop: '#ff9f43', skyBottom: '#fff1d6' });
  const m = w.matte;
  const F = TRICK_FIELD;
  m.box(56, 0.1, 56, 0, -0.05, 0, '#3a2f2a');
  // the field itself: one flat chequered sheet, nothing to trip on
  const n = (F.half * 2) / F.cell;
  const field = new THREE.Mesh(new THREE.PlaneGeometry(F.half * 2, F.half * 2), new THREE.MeshStandardMaterial({ map: chequerTexture(TRICK_COLORS, n), roughness: 0.7 }));
  field.rotation.x = -Math.PI / 2;
  field.position.y = 0.006;
  w.scene.add(field);
  // a glowing border flush with the ground
  for (const s of [-1, 1]) {
    w.glow.box(F.half * 2 + 0.4, 0.012, 0.2, 0, 0.006, s * (F.half + 0.1), '#fff1b0');
    w.glow.box(0.2, 0.012, F.half * 2 + 0.4, s * (F.half + 0.1), 0.006, 0, '#fff1b0');
  }
  // flags and torches around the field
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const x = Math.cos(a) * 18.5;
    const z = Math.sin(a) * 18.5;
    if (Math.abs(x) < 3 && z > 0) continue;
    w.metal.cyl(0.06, 4.2, x, 2.1, z, '#c9ced6');
    m.box(1.1, 0.7, 0.04, x + 0.55, 3.7, z, TRICK_COLORS[i % 3]);
  }
  for (const [x, z] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) {
    m.cyl(0.35, 1.2, x, 0.6, z, '#2c3140', 0, 0, 0, 14);
    w.glow.sphere(0.32, x, 1.5, z, '#ffd34d');
  }
  // seats for the crowd along the back
  w.stands(0, -21, 40, 3, Math.PI, ['#e63946', '#ff7b00', '#ffd34d']);
  w.sign('🌀 زمین حرکات ویژه', 'برو روی زمین شطرنجی', 0, 5.5, -16, '#ffd34d');
  w.freeStations([[-20, 8], [20, 8], [-20, -8], [20, -8]], ['jack', 'squat', 'cartwheel', 'backflip']);
  w.finishBatches();
  return w;
};

Object.assign(Game, {
  onTrickField() {
    const w = this.world;
    if (!w || w.env !== 'tricks') return false;
    const p = this.player.ch.root.position;
    return Math.abs(p.x) < TRICK_FIELD.half && Math.abs(p.z) < TRICK_FIELD.half;
  },

  /** The special move's button shows up while you stand on the field. */
  tickTrickField() {
    const on = this.mode === 'play' && this.onTrickField();
    const tab = $('tabField');
    if (tab.hidden === on) {
      tab.hidden = !on;
      if (on) {
        this.prevTab = this.save.tab === 'field' ? 'base' : this.save.tab;
        this.setTab('field');
        const panel = $('panel');
        if (panel.classList.contains('collapsed')) panel.classList.remove('collapsed');
        Sfx.play('unlock');
        this.toast('🌀 حرکت ویژه باز شد: «پرش چرخشی هوایی»! دکمه‌اش رو بزن و زورش رو خودت انتخاب کن.', 'gold');
      } else if (this.save.tab === 'field') this.setTab(this.prevTab || 'base');
    }
  },

  /** Ask how much strength each jump gives, then start. */
  openTrick() {
    if (!this.onTrickField()) {
      Sfx.play('error');
      this.toast('🌀 این حرکت فقط روی زمین شطرنجی «زمین حرکات ویژه» باز می‌شه. از نقشه 🗺️ برو.', 'warn');
      return;
    }
    $('trickAmt').value = String(this.save.trickAmt || 10);
    this.openModal('trickModal');
  },

  startTrick() {
    const n = clamp(Math.floor(Number(digitsOnly($('trickAmt').value)) || 0), 0, 1e9);
    this.closeModal('trickModal');
    if (!this.onTrickField()) return;
    this.save.trickAmt = n;
    if (this.loop) this.stopLoop(true);
    if (!this.world.canAct()) return;
    const ok = this.startLoop({ m: TRICK_MOVE, anim: 'aerialx', done: () => this.trickReward(n) });
    if (ok) {
      Sfx.play('click');
      this.toast(`🌀 هر پرش: +${fa(n)} سطح زور (انتخاب خودت؛ تقلبی حساب می‌شه).`);
    }
  },

  trickReward(n) {
    this.lastExerciseEnd = this.clock;
    this.noteRep(TRICK_MOVE);
    if (!(n > 0)) return;
    const s = this.save;
    const from = this.lv();
    s.level += n;
    s.cheatLv = (s.cheatLv || 0) + n;
    this.levelsGained(from, this.lv(), n < 5, 'main');
    this.floatText(`+${fa(n)} 🌀`, 'fl-combo');
    this.refreshHud(true);
    this.persist();
  },
});
