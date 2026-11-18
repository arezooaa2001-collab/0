'use strict';
/*
 * Round fourteen: a rhythm dance pad with falling arrows and its own beat, a mechanical bull
 * to stay on as long as you can, a shadow-clone power (echoes of you that copy every move and
 * double exercise XP), a breakdance windmill and a superhero landing, and medals.
 */

POWERS.push({ id: 'clone', name: 'سایه‌های نینجا', icon: '👥', level: 300, cd: 45, xp: 80, key: '=' });
for (const p of POWERS) POWER_BY_ID[p.id] = p;

const EMOTES8 = [['e_windmill', 'بریک‌دنس', '🌀'], ['e_hero', 'فرود ابرقهرمانی', '🦸']]
  .map(([id, name, icon]) => ({ id, name, icon, level: 1, cat: 'fun', emote: true }));
MOVES.push(...EMOTES8);
for (const e of EMOTES8) MOVE_BY_ID[e.id] = e;
if (typeof DANCE_POOL !== 'undefined') DANCE_POOL.push('e_windmill', 'e_hero');

Object.assign(ANIMS, {
  e_windmill: {
    dur: 3.4,
    snapAll: false,
    events: [[0.15, 'land']],
    fn(p, t) {
      const down = smooth(seg(t, 0, 0.16)) * (1 - smooth(seg(t, 0.86, 1)));
      const a = smooth(seg(t, 0.16, 0.86));
      const q = makePose();
      // drop to the floor on the back, legs in a wide V, and spin round and round
      q.bx = -1.45 * down;
      q.by = TAU * 3 * a;
      q.y = -0.72 * down;
      q.hpLZ = 0.95 * down; q.hpRZ = -0.95 * down;
      q.hpLX = q.hpRX = -0.9 * down;
      q.knL = q.knR = 0.1;
      const w = Math.sin(t * TAU * 6);
      q.shLZ = (1.3 + 0.3 * w) * down; q.shRZ = -(1.3 - 0.3 * w) * down;
      q.elL = q.elR = -0.2;
      q.nkX = 0.4 * down;
      q.autoAnkle = true;
      mixInto(p, q, Math.max(down, 0.001));
      p.by = q.by; p.bx = q.bx; p.y = q.y;
    },
  },
  e_hero: {
    dur: 2.6,
    events: [[0.08, 'land']],
    fn(p, t) {
      const k = 1 - smooth(seg(t, 0.55, 0.8));
      const up = smooth(seg(t, 0.55, 0.8)) * (1 - smooth(seg(t, 0.92, 1)));
      const q = makePose();
      // the landing: one knee down, a fist on the floor, the other arm thrown back
      q.y = -0.5 * k;
      q.hpLX = -1.4 * k; q.knL = 1.6 * k;
      q.hpRX = 0.2 * k; q.knR = 2.0 * k;
      q.spX = 0.55 * k;
      q.shRX = -0.9 * k; q.elR = -0.2; q.shRZ = -0.1;
      q.shLX = 0.6 * k; q.shLZ = 0.9 * k; q.elL = -0.3;
      q.nkX = -0.5 * k;
      // then up: fists on hips, chest out, chin up
      q.shLZ += 0.5 * up; q.shRZ -= 0.5 * up; q.elL -= 1.6 * up; q.elR -= 1.6 * up;
      q.spX -= 0.15 * up; q.nkX -= 0.2 * up;
      mixInto(p, q, 1 - smooth(seg(t, 0.94, 1)));
    },
  },
});

ACHIEVEMENTS.push(
  { id: 'rhythmA', name: 'ستاره‌ی ریتم', icon: '🎵', desc: 'توی رقص ریتمی نمره‌ی A یا بهتر بگیر', test: (s) => (s.stats.rhythmBestGrade || 0) >= 4 },
  { id: 'fullcombo', name: 'بی‌نقص', icon: '💯', desc: 'یه آهنگ رقص ریتمی رو بدون حتی یه خطا تموم کن', test: (s) => (s.stats.fullCombos || 0) >= 1 },
  { id: 'cowboy', name: 'گاوچرون', icon: '🤠', desc: '۱۵ ثانیه روی گاو مکانیکی بمون', test: (s) => (s.stats.bullBest || 0) >= 15 },
  { id: 'rodeo', name: 'سلطان رودئو', icon: '🐂', desc: '۳۰ ثانیه روی گاو مکانیکی بمون', test: (s) => (s.stats.bullBest || 0) >= 30 },
  { id: 'clones', name: 'ارتش سایه‌ها', icon: '👥', desc: 'با سایه‌های نینجا ورزش کن', test: (s) => (s.stats.cloneReps || 0) >= 1 },
  { id: 'breaker', name: 'بریک‌دنسر', icon: '🌀', desc: 'بریک‌دنس برو', test: (s) => (s.stats.windmills || 0) >= 1 },
);

const PAD = { x: 52, z: -5.5 };
const BULL = { x: 66.5, z: -5.5, r: 3.1 };
GYM_SPOTS.push(['🎵', 'رقص ریتمی و گاو مکانیکی', 59, -1.5]);

/* the four lanes: screen left, down, up, right (the camera looks the way you face, -z) */
const LANES = [
  { id: 0, icon: '⬅️', color: '#ff4da6', dx: -1, dz: 0 },
  { id: 1, icon: '⬇️', color: '#2ecc71', dx: 0, dz: 1 },
  { id: 2, icon: '⬆️', color: '#2f9bff', dx: 0, dz: -1 },
  { id: 3, icon: '➡️', color: '#ffd34d', dx: 1, dz: 0 },
];
const RHY = { bpm: 116, beats: 72, approach: 1.7, perfect: 0.075, great: 0.13, good: 0.2 };
const RHY_BASS = [55, 55, 65.4, 49, 55, 73.4, 65.4, 49];
const RHY_LEAD = [440, 523, 659, 587, 523, 440, 392, 440];

/** A chart: notes on the beat, then eighths, then the odd double, getting busier as it goes. */
function rhythmChart() {
  const spb = 60 / RHY.bpm;
  const notes = [];
  let last = -1;
  for (let b = 4; b < RHY.beats - 2; b++) {
    const part = b / RHY.beats;
    const slots = part < 0.3 ? [0] : part < 0.65 ? [0, 0.5] : [0, 0.5, 0.75];
    for (const s of slots) {
      if (s && Math.random() > (part < 0.65 ? 0.45 : 0.55)) continue;
      if (!s && part < 0.15 && b % 2) continue;
      let lane = Math.floor(Math.random() * 4);
      if (lane === last && Math.random() < 0.6) lane = (lane + 1 + Math.floor(Math.random() * 3)) % 4;
      last = lane;
      notes.push({ t: (b + s) * spb, lane, hit: null });
      if (!s && part > 0.55 && b % 4 === 0) notes.push({ t: b * spb, lane: (lane + 2) % 4, hit: null });
    }
  }
  return notes;
}

const CLONE_MAT = new THREE.MeshStandardMaterial({ color: '#6c3dff', emissive: '#2c0f7a', emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.55, depthWrite: true });

Object.assign(Game, {
  /* ---------- building the corner ---------- */

  buildFun8(g) {
    g.fun8 = true;
    const add = (m, solid) => { if (!solid) m.userData.noSolid = true; g.scene.add(m); return m; };
    const steel = new THREE.MeshStandardMaterial({ color: '#2c3140', roughness: 0.4, metalness: 0.7 });

    /* the dance pad: a lit stage with four arrow tiles and two speakers */
    const stage = add(new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 4.4), new THREE.MeshStandardMaterial({ color: '#141833', roughness: 0.3, metalness: 0.4 })));
    stage.position.set(PAD.x, 0.06, PAD.z);
    const rim = add(new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.06, 4.6), new THREE.MeshBasicMaterial({ color: '#ff4da6', toneMapped: false })));
    rim.position.set(PAD.x, 0.03, PAD.z);
    g.padRim = rim;
    g.padTiles = LANES.map((L) => {
      const tex = makeCanvasTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#0d1022'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = L.color; ctx.lineWidth = 8; ctx.strokeRect(6, 6, w - 12, h - 12);
        ctx.fillStyle = L.color;
        ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate([Math.PI, Math.PI / 2, -Math.PI / 2, 0][L.id]);
        ctx.beginPath(); ctx.moveTo(34, 0); ctx.lineTo(-6, -32); ctx.lineTo(-6, -14); ctx.lineTo(-32, -14); ctx.lineTo(-32, 14); ctx.lineTo(-6, 14); ctx.lineTo(-6, 32); ctx.closePath(); ctx.fill();
        ctx.restore();
      });
      const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: L.color, emissiveIntensity: 0.15, emissiveMap: tex, roughness: 0.4 });
      const m = add(new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), mat));
      m.rotation.x = -Math.PI / 2;
      m.position.set(PAD.x + L.dx * 1.35, 0.125, PAD.z + L.dz * 1.35);
      return { m, mat, glow: 0 };
    });
    for (const s of [-1, 1]) {
      const spk = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.8), new THREE.MeshStandardMaterial({ color: '#15161c', roughness: 0.6 }));
      box.position.y = 0.9;
      spk.add(box);
      const cones = [];
      for (const [y, r] of [[1.35, 0.25], [0.65, 0.33]]) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.6, 0.08, 20), new THREE.MeshStandardMaterial({ color: '#30323c', roughness: 0.3, metalness: 0.5 }));
        c.rotation.x = Math.PI / 2;
        c.position.set(0, y, 0.42);
        spk.add(c);
        cones.push(c);
      }
      spk.position.set(PAD.x + s * 3.1, 0, PAD.z - 0.6);
      spk.rotation.y = -s * 0.35;
      spk.traverse((o) => { o.userData.noSolid = true; });
      g.scene.add(spk);
      box.userData.noSolid = false;
      (g.padSpeakers || (g.padSpeakers = [])).push({ spk, cones });
    }
    this.hangSign(g, 'رقص ریتمی 🎵', '#ff4da6', PAD.x, 6.1, PAD.z - 2.6, 4.4);

    /* the mechanical bull on its padded ring */
    const ring = add(new THREE.Mesh(new THREE.CylinderGeometry(BULL.r, BULL.r + 0.15, 0.35, 40), new THREE.MeshStandardMaterial({
      map: makeCanvasTexture(256, 32, (ctx, w, h) => { for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 2 ? '#e63946' : '#ffd34d'; ctx.fillRect((i * w) / 16, 0, w / 16 + 1, h); } }),
      roughness: 0.85,
    })));
    ring.position.set(BULL.x, 0.175, BULL.z);
    const top = add(new THREE.Mesh(new THREE.CircleGeometry(BULL.r - 0.05, 40), new THREE.MeshStandardMaterial({ color: '#3a6ea5', roughness: 0.9 })));
    top.rotation.x = -Math.PI / 2;
    top.position.set(BULL.x, 0.355, BULL.z);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.9, 16), steel), true).position.set(BULL.x, 0.8, BULL.z);
    const bull = new THREE.Group();
    bull.position.set(BULL.x, 1.3, BULL.z);
    const hide = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.55, metalness: 0.05 });
    const dark = new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.6 });
    const horn = new THREE.MeshStandardMaterial({ color: '#f1e6c8', roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.95, 6, 14), hide);
    body.rotation.x = Math.PI / 2;
    bull.add(body);
    const head = new THREE.Group();
    head.position.set(0, 0.12, 0.78);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.5), hide);
    head.add(skull);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.16), dark);
    snout.position.set(0, -0.08, 0.3);
    head.add(snout);
    for (const sx of [-1, 1]) {
      const h1 = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.36, 8), horn);
      h1.position.set(sx * 0.27, 0.2, 0.02);
      h1.rotation.z = -sx * 1.1;
      head.add(h1);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2a2a', toneMapped: false }));
      eye.position.set(sx * 0.17, 0.06, 0.24);
      head.add(eye);
    }
    bull.add(head);
    const saddle = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.5, 16, 1, false, Math.PI, Math.PI), new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.5 }));
    saddle.rotation.x = Math.PI / 2;
    saddle.rotation.z = Math.PI;
    saddle.position.set(0, 0.06, -0.05);
    bull.add(saddle);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.5, 6), dark);
    tail.position.set(0, -0.05, -0.78);
    tail.rotation.x = 0.5;
    bull.add(tail);
    bull.traverse((o) => { o.userData.noSolid = true; });
    g.scene.add(bull);
    g.bull = bull;
    g.bullTail = tail;
    this.hangSign(g, 'گاو مکانیکی 🐂', '#ffd34d', BULL.x, 6.1, BULL.z - 3.6, 4.4);
    g.solids = null;
  },

  nearPad() {
    const p = this.player.ch.root.position;
    return Math.abs(p.x - PAD.x) < 2.6 && Math.abs(p.z - PAD.z) < 2.8;
  },
  nearBull() {
    const p = this.player.ch.root.position;
    return Math.hypot(p.x - BULL.x, p.z - BULL.z) < BULL.r + 1.2;
  },

  fun8Free() {
    return this.arcadeFree() && this.gym && this.gym.fun8 && !this.clones;
  },

  fun8Action() {
    if (this.rhythm || this.bullRide) return null;
    if (this.world !== this.gym || !this.gym.fun8 || !this.fun8Free()) return null;
    if (this.nearPad()) return { label: '🎵 رقص ریتمی', run: () => this.startRhythm() };
    if (this.nearBull()) return { label: '🐂 سوار گاو مکانیکی شو', run: () => this.startBull() };
    return null;
  },

  /* ---------- the rhythm pad ---------- */

  startRhythm() {
    if (!this.fun8Free() || !this.nearPad()) return;
    if (this.loop) this.stopLoop(true);
    const P = this.player;
    if (P.board) this.endBoard();
    if (P.jet) this.endJet();
    Sfx.init();
    P.ch.stopAction();
    P.ch.manual = true;
    P.ch.manualSnap = false;
    P.ch.root.position.set(PAD.x, 0, PAD.z);
    P.ch.root.rotation.y = Math.PI;
    P.vel.set(0, 0);
    const notes = rhythmChart();
    this.rhythm = { t: -2.2, notes, next: 0, beat: -1, score: 0, combo: 0, best: 0, judged: 0, counts: [0, 0, 0, 0], step: null, stepT: 0, musicWas: !!this.save.music };
    if (this.save.music) Sfx.music(false);
    // the lanes and their notes are drawn in the panel
    const lanes = $('rhyLanes');
    lanes.textContent = '';
    for (const L of LANES) {
      const d = document.createElement('div');
      d.className = 'rhy-lane';
      d.style.setProperty('--c', L.color);
      lanes.appendChild(d);
    }
    for (const n of notes) {
      const el = document.createElement('i');
      el.className = 'rhy-note';
      el.textContent = LANES[n.lane].icon;
      el.style.setProperty('--c', LANES[n.lane].color);
      el.hidden = true;
      lanes.children[n.lane].appendChild(el);
      n.el = el;
    }
    $('rhyHead').textContent = '🎵 آماده… ۳';
    $('rhyJudge').textContent = '';
    $('rhythmPanel').hidden = false;
    this.follow(null, 6.2, 0, 0.32);
    this.camFollow = null;
    this.gym.gatherFans(PAD.x, PAD.z + 2, 14, 6, 50, 'fanclap');
    this.toast('🎵 وقتی فلش به خط سفید رسید، همون فلش رو بزن (کلیدهای جهت یا دکمه‌های پایین نوار).', 'gold');
  },

  rhythmHit(lane) {
    const R = this.rhythm;
    if (!R || R.t < 0 || this.modals.size) return;
    const g = this.gym;
    // the nearest note in that lane still waiting
    let best = null, bd = 1e9;
    for (let i = R.next; i < R.notes.length; i++) {
      const n = R.notes[i];
      if (n.t - R.t > RHY.good + 0.05) break;
      if (n.lane !== lane || n.hit) continue;
      const d = Math.abs(n.t - R.t);
      if (d < bd) { bd = d; best = n; }
    }
    R.step = lane;
    R.stepT = 0.28;
    const tile = g.padTiles[lane];
    tile.glow = 1;
    const btn = $('rhyBtns').children[lane];
    if (btn) { btn.classList.remove('hit'); void btn.offsetWidth; btn.classList.add('hit'); }
    if (!best || bd > RHY.good) { Sfx.play('tap'); return; }
    const kind = bd <= RHY.perfect ? 0 : bd <= RHY.great ? 1 : 2;
    best.hit = ['perfect', 'great', 'good'][kind];
    R.counts[kind]++;
    R.combo++;
    R.best = Math.max(R.best, R.combo);
    R.score += [300, 200, 100][kind] * (1 + Math.min(R.combo, 50) / 50);
    if (best.el) { best.el.classList.add('done'); setTimeout(() => { if (best.el) best.el.hidden = true; }, 160); }
    this.judge(['✨ عالی!', '👍 خیلی خوب', '🙂 خوب'][kind], kind);
    Sfx.play(kind === 0 ? 'perfect' : 'tap');
    const p = tile.m.position;
    this.world.fx.burst({ x: p.x, y: 0.3, z: p.z }, { count: kind === 0 ? 18 : 8, colors: [LANES[lane].color, '#ffffff'], speed: 2.5, up: 2, life: 0.5 });
    if (R.combo % 25 === 0) {
      Sfx.play('cheer');
      this.floatText(`🔥 ${fa(R.combo)} پشت سر هم!`, 'fl-combo');
      this.gym.gatherFans(PAD.x, PAD.z + 2, 14, 4, 30, 'fanclap');
    }
  },

  judge(text, kind) {
    const el = $('rhyJudge');
    el.textContent = text;
    el.className = 'rhy-judge j' + kind;
    void el.offsetWidth;
    el.classList.add('pop');
  },

  tickRhythm(dt) {
    const R = this.rhythm;
    if (!R) return;
    const g = this.gym;
    if (this.world !== g || this.mode !== 'play' || this.race || this.arm) { this.endRhythm(null); return; }
    const P = this.player;
    const ch = P.ch;
    ch.root.position.set(PAD.x, 0, PAD.z);
    ch.root.rotation.y = Math.PI;
    P.vel.set(0, 0);
    const paused = this.modals.size || this.watch || this.photo;
    if (!paused) R.t += dt;
    const spb = 60 / RHY.bpm;
    // count in, then the beat
    if (R.t < 0) $('rhyHead').textContent = `🎵 آماده… ${fa(Math.ceil(-R.t / 0.75))}`;
    const beat = Math.floor(R.t / spb + 1e-6);
    if (!paused && beat !== R.beat && R.t > -spb * 0.5) {
      R.beat = beat;
      if (beat >= 0 && beat < RHY.beats) {
        Sfx.play('kick');
        if (beat % 2 === 1) Sfx.play('snare');
        Sfx.note(RHY_BASS[Math.floor(beat / 2) % 8], spb * 0.9, { type: 'triangle', vol: 0.12 });
        if (beat % 8 >= 4) Sfx.note(RHY_LEAD[beat % 8], spb * 0.5, { type: 'square', vol: 0.035 });
        R.hatT = spb / 2;
        for (const S of g.padSpeakers) S.pulse = 1;
        g.padRim.material.color.set(LANES[beat % 4].color);
      } else if (beat < 0) Sfx.play('tick');
    }
    if (R.hatT > 0 && !paused) { R.hatT -= dt; if (R.hatT <= 0) Sfx.play('hat'); }
    // the speakers thump, the tiles glow where you stepped
    for (const S of g.padSpeakers) {
      S.pulse = Math.max(0, (S.pulse || 0) - dt * 5);
      for (const c of S.cones) c.scale.set(1 + 0.12 * S.pulse, 1, 1 + 0.12 * S.pulse);
    }
    for (const T of g.padTiles) { T.glow = Math.max(0, T.glow - dt * 3.5); T.mat.emissiveIntensity = 0.15 + 1.4 * T.glow; }
    // notes falling down their lanes (top 0% → hit line at 85%)
    for (let i = R.next; i < R.notes.length; i++) {
      const n = R.notes[i];
      const ahead = n.t - R.t;
      if (ahead > RHY.approach) break;
      if (n.hit) continue;
      if (ahead < -RHY.good) {
        n.hit = 'miss';
        R.counts[3]++;
        if (R.combo >= 10) Sfx.play('fail');
        R.combo = 0;
        this.judge('❌ از دست رفت', 3);
        if (n.el) n.el.hidden = true;
        continue;
      }
      if (n.el) {
        n.el.hidden = false;
        n.el.style.top = `${(85 * (1 - ahead / RHY.approach)).toFixed(1)}%`;
      }
    }
    while (R.next < R.notes.length && R.notes[R.next].hit) R.next++;
    R.judged = R.counts.reduce((a, b) => a + b, 0);
    if (R.t >= 0) $('rhyHead').textContent = `🎵 امتیاز ${fa(Math.round(R.score))} · ${R.combo > 1 ? '🔥 ' + fa(R.combo) : ''}`;
    // the dancer: a bounce on the beat, a step onto the tile you pressed
    const pose = ch.manualPose;
    copyPose(pose, STAND);
    const ph = (R.t / spb) * TAU;
    const bounce = Math.max(0, Math.sin(ph));
    pose.knL = pose.knR = 0.15 + 0.25 * bounce;
    pose.hpLX = pose.hpRX = -0.12 - 0.15 * bounce;
    pose.y = -0.06 * bounce;
    pose.shLX = -0.5 - 0.5 * Math.sin(ph / 2); pose.shRX = -0.5 + 0.5 * Math.sin(ph / 2);
    pose.elL = pose.elR = -1.4;
    pose.nkX = 0.1 * bounce;
    if (R.stepT > 0) {
      R.stepT -= dt;
      const k = Math.sin(Math.min(1, R.stepT / 0.28) * Math.PI);
      const L = LANES[R.step];
      // the camera looks the other way (-z), so screen left is the body's right
      if (L.dx > 0) { pose.hpRZ = -0.55 * k; pose.bz = -0.1 * k; }
      if (L.dx < 0) { pose.hpLZ = 0.55 * k; pose.bz = 0.1 * k; }
      if (L.dz < 0) { pose.hpLX = -0.9 * k; pose.knL = 0.6 * k; }
      if (L.dz > 0) { pose.hpRX = 0.5 * k; pose.knR = 0.7 * k; pose.spX = 0.15 * k; }
      pose.shLZ = 0.6 + 1.6 * k; pose.shRZ = -(0.6 + 1.6 * k); pose.elL = pose.elR = -0.4;
    }
    if (R.t > RHY.beats * spb + 0.6 && R.next >= R.notes.length) this.endRhythm(true);
  },

  endRhythm(done) {
    const R = this.rhythm;
    if (!R) return;
    this.rhythm = null;
    $('rhythmPanel').hidden = true;
    $('rhyLanes').textContent = '';
    this.unfollow(true);
    const P = this.player;
    if (P && !P.board) P.ch.manual = false;
    if (R.musicWas && this.save.music) Sfx.music(true);
    if (this.gym && this.gym.padTiles) for (const T of this.gym.padTiles) { T.glow = 0; T.mat.emissiveIntensity = 0.15; }
    if (!done) return;
    const total = R.notes.length;
    const acc = total ? (R.counts[0] + R.counts[1] * 0.75 + R.counts[2] * 0.4) / total : 0;
    const grade = acc >= 0.95 ? 5 : acc >= 0.85 ? 4 : acc >= 0.7 ? 3 : acc >= 0.5 ? 2 : 1;
    const name = ['', 'D', 'C', 'B', 'A', 'S'][grade];
    const st = this.save.stats;
    st.rhythmPlays = (st.rhythmPlays || 0) + 1;
    st.rhythmBest = Math.max(st.rhythmBest || 0, Math.round(R.score));
    st.rhythmBestGrade = Math.max(st.rhythmBestGrade || 0, grade);
    const full = R.counts[3] === 0 && total > 0;
    if (full) st.fullCombos = (st.fullCombos || 0) + 1;
    const coins = Math.round(R.score / 150) + (full ? 50 : 0);
    if (coins) this.addCoins(coins, true);
    this.gainXp(Math.round(R.score / 20 * this.mult()));
    this.showBanner(`${fa(Math.round(acc * 100))}٪ درست · بهترین زنجیره ${fa(R.best)} · ${fa(coins)} سکه${full ? ' · بی‌نقص!' : ''}`, `🎵 نمره‌ی ${name}`);
    if (grade >= 4) { this.confetti(); Sfx.play('cheer'); P.ch.play('e_victory'); }
    else Sfx.play(grade >= 3 ? 'success' : 'fail');
    this.checkAchievements();
    this.persist();
  },

  /* ---------- the mechanical bull ---------- */

  startBull() {
    if (!this.fun8Free() || !this.nearBull()) return;
    if (this.loop) this.stopLoop(true);
    const P = this.player;
    if (P.board) this.endBoard();
    if (P.jet) this.endJet();
    P.ch.stopAction();
    P.ch.manual = true;
    P.ch.manualSnap = false;
    this.bullRide = { t: 0, b: rand(-0.05, 0.05), vb: 0, yaw: 0, spin: 1, jolt: 0, joltT: rand(1.5, 2.5), countT: 1.4 };
    $('bullPanel').hidden = false;
    $('bullHead').textContent = '🐂 محکم بشین…';
    Sfx.play('click');
    this.follow(null, 6.5, Math.PI, 0.3);
    this.camFollow = null;
    this.gym.gatherFans(BULL.x, BULL.z, 15, 6, 40, 'fanclap');
    this.toast('🐂 با چپ و راست (یا دکمه‌های نوار) خودت رو صاف نگه دار تا پرت نشی!', 'gold');
  },

  tickBull(dt) {
    const R = this.bullRide;
    const g = this.gym;
    if (g && g.bull && !R) {
      // waiting for a rider: it rocks gently
      g.bull.rotation.x = Math.sin(this.clock * 1.2) * 0.04;
      g.bull.position.y = 1.3;
    }
    if (!R) return;
    if (this.world !== g || this.mode !== 'play' || this.race || this.arm) { this.endBull(false, true); return; }
    const P = this.player;
    const ch = P.ch;
    const paused = this.modals.size || this.watch || this.photo;
    const bull = g.bull;
    if (!paused) {
      if (R.countT > 0) R.countT -= dt;
      else {
        R.t += dt;
        const lvl = 1 + R.t / 12;
        // the bull swings, bucks and jolts harder the longer you last
        R.yaw = Math.sin(R.t * (1.1 + 0.25 * lvl)) * 0.6 * R.spin;
        R.joltT -= dt;
        if (R.joltT <= 0) {
          R.joltT = rand(0.9, 2.2) / Math.min(2.2, lvl);
          R.jolt = rand(0.9, 1.5) * (Math.random() < 0.5 ? -1 : 1) * Math.min(2.4, 0.8 + 0.4 * lvl);
          if (Math.random() < 0.3) R.spin = -R.spin;
          Sfx.play('punch');
        }
        R.jolt *= Math.max(0, 1 - 3 * dt);
        const inp = (this.bullIn || 0) + (R.btn || 0);
        // tipping over feeds itself; you lean against it
        R.vb += (R.b * 1.6 + R.jolt + Math.sin(R.t * 2.3) * 0.35 * lvl - inp * 3.4) * dt;
        R.vb *= Math.max(0, 1 - 2.2 * dt);
        R.b += R.vb * dt;
        if (Math.abs(R.b) >= 1) { this.throwOffBull(Math.sign(R.b)); return; }
        $('bullHead').textContent = `🐂 ${fa(R.t.toFixed(1))} ثانیه`;
      }
    }
    const buck = Math.sin(R.t * 7) * (0.12 + Math.min(0.25, R.t * 0.01));
    bull.rotation.set(buck, R.yaw, R.b * 0.25 + R.jolt * 0.06);
    bull.position.y = 1.3 + Math.max(0, Math.sin(R.t * 7)) * 0.08;
    g.bullTail.rotation.x = 0.5 + Math.sin(this.clock * 9) * 0.4;
    $('bullNeedle').style.left = `${(50 + R.b * 50).toFixed(1)}%`;
    // the rider sits on the saddle, one hand on the strap, the other waving the hat
    bull.updateMatrixWorld(true);
    _bullSeat.set(0, 0.1, -0.08).applyMatrix4(bull.matrixWorld);
    ch.root.position.set(_bullSeat.x, 0, _bullSeat.z);
    ch.root.rotation.y = R.yaw;
    ch.airY = _bullSeat.y - HIP_H + 0.06;
    ch.vy = 0;
    ch.grounded = false;
    P.vel.set(0, 0);
    const pose = ch.manualPose;
    copyPose(pose, STAND);
    pose.hpLZ = 0.62; pose.hpRZ = -0.62; pose.hpLX = pose.hpRX = -0.85; pose.knL = pose.knR = 1.35;
    pose.bx = buck * 0.8; pose.bz = R.b * 0.55;
    pose.spX = 0.2 - buck * 0.6;
    pose.shRX = -0.9; pose.elR = -0.8; pose.shRZ = -0.2;
    const wave = Math.sin(this.clock * 8);
    pose.shLX = -2.6; pose.shLZ = 0.6 + 0.35 * wave; pose.elL = -0.6;
    pose.nkX = -0.1 - buck;
    pose.autoAnkle = true;
  },

  throwOffBull(side) {
    const R = this.bullRide;
    const P = this.player;
    const ch = P.ch;
    const t = R.t;
    this.endBull(false, false);
    // flung off the side, over the padding
    const yaw = R.yaw + side * Math.PI / 2;
    ch.vy = 6.5;
    ch.grounded = false;
    this.bullFling = { vx: Math.sin(yaw) * 3.2, vz: Math.cos(yaw) * 3.2 };
    ch.airFlip = { t: 0, dur: 0.75, turns: 1, dir: Math.random() < 0.5 ? 1 : -1 };
    Sfx.play('whoosh');
    this.bullDrop = 1.2;
    this.scoreBull(t);
  },

  scoreBull(t) {
    const st = this.save.stats;
    st.bullRides = (st.bullRides || 0) + 1;
    const best = t > (st.bullBest || 0);
    st.bullBest = Math.max(st.bullBest || 0, Math.floor(t * 10) / 10);
    const coins = Math.floor(t * 3);
    if (coins) this.addCoins(coins, true);
    this.gainXp(Math.round(t * 6 * this.mult()));
    this.showBanner(`${fa(coins)} سکه${best ? ' — رکورد تازه!' : ''}`, `🐂 ${fa(t.toFixed(1))} ثانیه روی گاو!`);
    if (t >= 15) { this.confetti(); Sfx.play('cheer'); }
    this.checkAchievements();
    this.persist();
  },

  endBull(byHand, silent) {
    const R = this.bullRide;
    if (!R) return;
    this.bullRide = null;
    $('bullPanel').hidden = true;
    this.unfollow(true);
    const P = this.player;
    if (!P) return;
    if (!P.board) P.ch.manual = false;
    if (byHand || silent) {
      // climb down beside the ring
      if (this.world === this.gym) {
        P.ch.root.position.set(BULL.x - BULL.r - 0.6, 0, BULL.z);
        P.ch.airY = 0; P.ch.vy = 0; P.ch.grounded = true;
      }
      if (byHand && R.t > 0.5) this.scoreBull(R.t);
    }
  },

  /** After the throw: land on your back and get up. */
  tickBullDrop(dt) {
    if (!(this.bullDrop > 0)) return;
    this.bullDrop -= dt;
    const ch = this.player.ch;
    const F = this.bullFling;
    if (F && !ch.grounded && this.world === this.gym) { const p = ch.root.position; const nx = p.x + F.vx * dt, nz = p.z + F.vz * dt; if (this.gym.spotFree(nx, nz, 0.3)) { p.x = nx; p.z = nz; } }
    if (ch.grounded) {
      this.bullFling = null;
      this.bullDrop = 0;
      this.player.vel.set(0, 0);
      ch.play('knock');
      Sfx.play('land');
      this.floatText('😵 پرت شدی!', '');
    }
  },

  /* ---------- shadow clones ---------- */

  startClones() {
    const pw = POWER_BY_ID.clone;
    if (this.mode !== 'play' || this.modals.size || this.race || this.arm || this.photo || this.build) return;
    if (!this.powerUnlocked(pw)) { Sfx.play('error'); this.toast(`🔒 قدرت «${pw.name}» در سطح ${fa(pw.level)} باز می‌شه.`, 'warn'); return; }
    if (this.powerCd.clone > 0 || this.clones || this.cannon || this.meter || this.lockMove) return;
    const P = this.player;
    if (P.anchor) return;
    Sfx.init();
    const w = this.world;
    const offs = [[-1.3, -0.5], [1.3, -0.5], [-0.75, -1.6], [0.75, -1.6]];
    const list = offs.map(([ox, oz], i) => {
      const c = new Character(Object.assign({}, P.ch.o));
      c.setMuscle(P.ch.mq / 8);
      c.mesh.material = CLONE_MAT;
      c.noFace = true;
      c.shadow.material = SHADOW_MAT;
      c.manual = true;
      c.manualSnap = true;
      c.rate = [7, 9, 11, 13][i];
      c.root.traverse((o) => { o.userData.noSolid = true; });
      const p = P.ch.root.position;
      c.root.position.copy(p);
      c.root.rotation.y = P.ch.root.rotation.y;
      w.scene.add(c.root);
      return { c, ox, oz, lag: 0.1 + i * 0.07 };
    });
    this.clones = { w, list, t: 12 };
    this.powerCd.clone = pw.cd;
    this.save.stats.powers++;
    this.missionProgress('power', 1);
    const p = P.ch.root.position;
    w.fx.burst({ x: p.x, y: 1.2, z: p.z }, { count: 70, colors: ['#6c3dff', '#c77dff', '#1a0b3d', '#ffffff'], speed: 5, up: 2, life: 0.9 });
    Sfx.play('zap');
    Sfx.play('whoosh');
    this.showBanner('۱۲ ثانیه XP ورزش دوبرابر!', '👥 سایه‌های نینجا');
    this.gainXp(Math.round(pw.xp * this.mult()));
    this.refreshPowers();
  },

  tickClones(dt) {
    const C = this.clones;
    if (!C) return;
    const P = this.player;
    if (C.w !== this.world || this.mode !== 'play' || !P) { this.endClones(); return; }
    if (!(this.modals.size || this.watch || this.photo)) C.t -= dt;
    const ch = P.ch;
    const p = ch.root.position;
    const yaw = ch.root.rotation.y;
    const s = Math.sin(yaw), c = Math.cos(yaw);
    const fade = Math.min(1, C.t / 0.8);
    CLONE_MAT.opacity = 0.55 * fade;
    for (const K of C.list) {
      const cc = K.c;
      // echoes of you: in formation, copying every move a moment later
      const tx = p.x + K.ox * c + K.oz * s, tz = p.z - K.ox * s + K.oz * c;
      const q = cc.root.position;
      const k = damp(1 / K.lag, dt);
      q.x += (tx - q.x) * k;
      q.z += (tz - q.z) * k;
      cc.root.rotation.y = angleLerp(cc.root.rotation.y, yaw, k);
      cc.airY += (ch.airY - cc.airY) * k;
      cc.vy = 0;
      cc.grounded = ch.grounded;
      cc.root.scale.copy(ch.root.scale);
      copyPose(cc.manualPose, ch.cur);
      cc.speed = ch.speed;
      // the same things in their hands
      for (const name in ch.props) {
        const vis = ch.props[name].meshes.some((m) => m.visible);
        if (vis || cc.props[name]) cc.showProp(name, vis);
      }
      cc.update(dt);
      if (Math.random() < dt * 8) this.world.fx.emit(q.x + rand(-0.2, 0.2), 0.4 + rand(0, 1.4) + cc.airY, q.z + rand(-0.2, 0.2), 0, rand(0.3, 0.9), 0, CLONE_SPARK, 0.6, -0.5);
    }
    if (C.t <= 0) this.endClones();
  },

  endClones() {
    const C = this.clones;
    if (!C) return;
    this.clones = null;
    for (const K of C.list) {
      const q = K.c.root.position;
      if (C.w === this.world) C.w.fx.burst({ x: q.x, y: 1.1, z: q.z }, { count: 22, colors: ['#6c3dff', '#c77dff'], speed: 3, up: 1.5, life: 0.6 });
      K.c.dispose();
    }
    CLONE_MAT.opacity = 0.55;
    if (C.w === this.world) Sfx.play('whoosh');
  },

  /* ---------- the menu ---------- */

  goFun8() {
    this.closeModal('menuModal');
    if (this.world !== this.gym) { this.toast('رقص ریتمی و گاو مکانیکی توی باشگاه اوله (کنار بخش کاردیو)؛ اول برگرد باشگاه.', 'warn'); return; }
    this.quickTravel(59, -1.5);
    if (this.world === this.gym && Math.hypot(this.player.ch.root.position.x - 59, this.player.ch.root.position.z + 1.5) < 4) this.toast('🎵 سکوی رقص ریتمی سمت چپته و 🐂 گاو مکانیکی سمت راست.', 'gold');
  },

  /* ---------- every frame ---------- */

  tickFun8(dt) {
    const g = this.gym;
    if (g && !g.fun8) this.buildFun8(g);
    this.tickRhythm(dt);
    this.tickBull(dt);
    this.tickBullDrop(dt);
    this.tickClones(dt);
  },
});
const _bullSeat = new THREE.Vector3();
const CLONE_SPARK = new THREE.Color('#9b6dff');

/* ---------- hooks into what is already there ---------- */

const _miniBusy8 = Game.miniBusy;
Game.miniBusy = function () { return !!(this.rhythm || this.bullRide) || _miniBusy8.call(this); };

const _usePower8 = Game.usePower;
Game.usePower = function (id) {
  if (id === 'clone') { if (!this.miniBusy()) this.startClones(); return; }
  _usePower8.call(this, id);
};

const _quickTravel8 = Game.quickTravel;
Game.quickTravel = function (x, z, special) {
  if (this.world === this.gym && this.mode === 'play' && !this.race && !this.arm && !this.build && !this.photo) {
    this.endRhythm(null);
    this.endBull(false, true);
  }
  _quickTravel8.call(this, x, z, special);
};

const _input8 = Game.input;
Game.input = function () {
  const r = _input8.call(this);
  // on the bull, left and right are for balance (the camera looks the way the bull faces)
  this.bullIn = this.bullRide ? -(r.x || 0) : 0;
  return r;
};

const _ctx8 = Game.contextAction;
Game.contextAction = function () {
  if (this.bullRide) return { label: '🙋 پیاده شو', run: () => this.endBull(true, false) };
  if (this.rhythm) return null;
  return this.fun8Action() || _ctx8.call(this);
};

/* exercise XP doubles while the shadows train with you */
const _mult8 = Game.mult;
Game.mult = function () { return _mult8.call(this) * (this.clones ? 2 : 1); };
const _exerciseDone8 = Game.exerciseDone;
Game.exerciseDone = function (m) {
  if (this.clones) {
    const st = this.save.stats;
    st.cloneReps = (st.cloneReps || 0) + 1;
    if (st.cloneReps === 1) this.checkAchievements();
  }
  return _exerciseDone8.call(this, m);
};

const _emoteDone8 = Game.emoteDone;
Game.emoteDone = function (m) {
  _emoteDone8.call(this, m);
  if (m && m.id === 'e_windmill') {
    const st = this.save.stats;
    st.windmills = (st.windmills || 0) + 1;
    if (st.windmills === 1) this.checkAchievements();
  }
};

/* the rhythm keys: arrows or WASD while the pad is on */
const RHY_KEYS = { ArrowLeft: 0, KeyA: 0, ArrowDown: 1, KeyS: 1, ArrowUp: 2, KeyW: 2, ArrowRight: 3, KeyD: 3 };
window.addEventListener('keydown', (e) => {
  if (!Game.rhythm || e.repeat || !(e.code in RHY_KEYS)) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
  e.preventDefault();
  Game.rhythmHit(RHY_KEYS[e.code]);
}, true);
$('rhyBtns').querySelectorAll('button').forEach((b, i) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); Game.rhythmHit(i); }));
$('rhyCancel').addEventListener('click', () => { if (Game.rhythm) { Game.endRhythm(null); Game.toast('🎵 رقص ریتمی تموم شد.'); } });
for (const [id, v] of [['bullLeft', 1], ['bullRight', -1]]) {
  const b = $(id);
  const set = (on) => (e) => { e.preventDefault(); if (Game.bullRide) Game.bullRide.btn = on ? v : 0; };
  b.addEventListener('pointerdown', set(true));
  b.addEventListener('pointerup', set(false));
  b.addEventListener('pointerleave', set(false));
  b.addEventListener('pointercancel', set(false));
}
$('bullCancel').addEventListener('click', () => Game.endBull(true, false));

/* a new look mid-game builds a new body: give it back its pose control and its bow */
const _rebuildPlayer8 = Game.rebuildPlayer;
Game.rebuildPlayer = function (...args) {
  const r = _rebuildPlayer8.apply(this, args);
  const ch = this.player && this.player.ch;
  if (ch) {
    if (this.archery) { ch.showProp('bow', true); ch.manual = true; }
    if (this.zip || this.rhythm || this.bullRide || this.cannon) { ch.manual = true; ch.manualSnap = false; }
    if ((this.zip && this.zip.phase !== 'climb') || this.bullRide || this.cannon) ch.grounded = false;
  }
  return r;
};
