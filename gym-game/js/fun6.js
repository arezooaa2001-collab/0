'use strict';
/*
 * Round twelve: a freeze power, a basketball hoop and a human cannon in the ninja hall (both
 * played with a timing meter), a piñata at disco parties, a dance-off with a coach, a UFO pet,
 * a cartwheel and a shuffle, and medals for all of it.
 */

POWERS.push({ id: 'freeze', name: 'یخ‌زدگی', icon: '❄️', level: 220, cd: 35, xp: 60, key: '0' });
for (const p of POWERS) POWER_BY_ID[p.id] = p;

SHOP.push({ id: 'ufo', cat: 'pet', name: 'بشقاب‌پرنده', icon: '🛸', price: 1200, once: true, desc: 'بالای سرت می‌چرخه، چراغ‌هاش رنگ عوض می‌کنن و گاهی نور می‌تابونه' });
for (const it of SHOP) SHOP_BY_ID[it.id] = it;

const EMOTES6 = [['e_cartwheel', 'چرخ و فلک', '🤸'], ['e_shuffle', 'رقص شافل', '👟']]
  .map(([id, name, icon]) => ({ id, name, icon, level: 1, cat: 'fun', emote: true }));
MOVES.push(...EMOTES6);
for (const e of EMOTES6) MOVE_BY_ID[e.id] = e;

Object.assign(ANIMS, {
  e_cartwheel: {
    dur: 1.6,
    side: (t) => (t > 0.15 && t < 0.85 ? 2.4 : 0),
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.12)) * (1 - smooth(seg(t, 0.88, 1)));
      const a = smooth(seg(t, 0.15, 0.85));
      // arms up, legs apart, the whole body turns over sideways once
      p.shLZ = 2.7 * k; p.shRZ = -2.7 * k;
      p.elL = p.elR = -0.1;
      p.hpLZ = 0.55 * k; p.hpRZ = -0.55 * k;
      p.bz = -TAU * a;
      p.y = 0.35 * Math.sin(Math.PI * a);
      p.nkX = -0.1 * k;
    },
  },
  e_shuffle: {
    dur: 2.4,
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.08)) * (1 - smooth(seg(t, 0.92, 1)));
      const b = Math.sin(t * TAU * 6);
      const s = Math.sin(t * TAU * 3);
      // kick one foot out, then the other, arms pumping
      p.hpLX = -0.55 * Math.max(0, s) * k; p.knL = 0.5 * Math.max(0, s) * k;
      p.hpRX = -0.55 * Math.max(0, -s) * k; p.knR = 0.5 * Math.max(0, -s) * k;
      p.hpLZ = 0.25 * Math.max(0, s) * k; p.hpRZ = -0.25 * Math.max(0, -s) * k;
      p.shLX = (-0.6 - 0.5 * b) * k; p.shRX = (-0.6 + 0.5 * b) * k;
      p.elL = p.elR = -1.6 * k;
      p.y = -0.05 * Math.abs(b) * k;
      p.by = 0.25 * s * k;
      p.nkX = 0.12 * Math.abs(b) * k;
    },
  },
});

ACHIEVEMENTS.push(
  { id: 'iceman', name: 'آدم‌برفی‌ساز', icon: '❄️', desc: 'با یخ‌زدگی ۸ نفر رو یه‌جا یخ بزن', test: (s) => (s.stats.freezeBest || 0) >= 8 },
  { id: 'hoops', name: 'ستاره‌ی بسکتبال', icon: '🏀', desc: '۵ تا توپ پشت سر هم بنداز تو حلقه', test: (s) => (s.stats.hoopStreak || 0) >= 5 },
  { id: 'three', name: 'سه‌امتیازی', icon: '🎯', desc: 'یه پرتاب سه‌امتیازی بزن', test: (s) => (s.stats.hoopThree || 0) >= 1 },
  { id: 'bullseye', name: 'گلوله‌ی انسانی', icon: '💥', desc: 'با توپ انسانی وسط هدف فرود بیا', test: (s) => (s.stats.cannonBull || 0) >= 1 },
  { id: 'pinata', name: 'پینیاتاشکن', icon: '🪅', desc: 'توی مهمونی دیسکو پینیاتا رو بشکن', test: (s) => (s.stats.pinatas || 0) >= 1 },
  { id: 'dancer', name: 'رقصنده‌ی حرفه‌ای', icon: '🕺', desc: 'هر ۵ دور رقص با مربی رو ببر', test: (s) => (s.stats.danceAll || 0) >= 1 },
  { id: 'ufo', name: 'دوست فضایی', icon: '🛸', desc: 'بشقاب‌پرنده رو با خودت ببر', test: (s) => s.shop && s.shop.pet === 'ufo' },
);

/* where things stand in the ninja hall (east end of the gym) */
const HOOP = { x: 112, z: -15.2, rimY: 3.05, rimR: 0.23, boardZ: -15.62 };
const CANNON = { x: 93.6, z: 0, tx: 110, elev: 0.7 };
const BALL_R = 0.12;
const DANCE_POOL = ['e_wave', 'e_flex', 'e_dance', 'e_robot', 'e_dab', 'e_clap', 'e_spin', 'e_kick', 'e_floss', 'e_moon', 'e_heart', 'e_cartwheel', 'e_shuffle'];
GYM_SPOTS.push(['🏀', 'بسکتبال و توپ انسانی', 106, -6]);
const COACH_LINES = ['حالا تو!', 'نوبت توئه!', 'ببینم چی کار می‌کنی!', 'دقیق همین‌ها رو برو!'];

/** A little flying saucer: a dome, a ring of lights changing colour, and now and then a beam. */
class UfoPet {
  constructor() {
    this.kind = 'ufo';
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const hull = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 12), new THREE.MeshStandardMaterial({ color: '#b8c2d6', metalness: 0.85, roughness: 0.25 }));
    hull.scale.y = 0.28;
    this.body.add(hull);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 10, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#7fe0ff', transparent: true, opacity: 0.7, roughness: 0.1, emissive: '#2a6f8a' }));
    dome.position.y = 0.06;
    this.body.add(dome);
    // a tiny green pilot
    const pilot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: '#7bed9f', roughness: 0.6 }));
    pilot.position.y = 0.12;
    this.body.add(pilot);
    this.lights = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: DISCO_COLORS[i % DISCO_COLORS.length], toneMapped: false }));
      m.position.set(Math.cos(a) * 0.38, -0.01, Math.sin(a) * 0.38);
      this.body.add(m);
      this.lights.push(m);
    }
    this.beamMat = new THREE.MeshBasicMaterial({ color: '#b6ff7a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.beam = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1, 20, 1, true).translate(0, -0.5, 0), this.beamMat);
    this.body.add(this.beam);
    const shadow = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT);
    shadow.scale.set(0.6, 1, 0.6);
    shadow.position.y = 0.015;
    this.root.add(shadow);
    this.root.traverse((o) => { o.userData.noSolid = true; });
    this.beamT = rand(4, 8);
    this.beamOn = 0;
    this.h = 2.6;
  }

  place(p) { this.root.position.set(p.x - 1, p.y || 0, p.z + 1); }

  update(dt, player, time) {
    const ch = player.ch;
    const pp = ch.root.position;
    const yaw = ch.root.rotation.y;
    const tx = pp.x - Math.sin(yaw) * 0.5 - Math.cos(yaw) * 1.1;
    const tz = pp.z - Math.cos(yaw) * 0.5 + Math.sin(yaw) * 1.1;
    const pos = this.root.position;
    const dx = tx - pos.x, dz = tz - pos.z;
    if (Math.hypot(dx, dz) > 25) pos.set(tx, pp.y, tz);
    const k = damp(3, dt);
    pos.x += dx * k;
    pos.z += dz * k;
    pos.y += (pp.y - pos.y) * k;
    this.h += (2.3 + ch.airY + 0.7 * ch.root.scale.y - this.h) * damp(2.5, dt);
    this.body.position.y = this.h + Math.sin(time * 2.2) * 0.15;
    this.body.rotation.y += dt * 2.5;
    this.body.rotation.z = Math.sin(time * 1.7) * 0.12;
    this.lights.forEach((m, i) => m.material.color.set(DISCO_COLORS[(i + Math.floor(time * 6)) % DISCO_COLORS.length]));
    // now and then a beam of light down to the floor
    this.beamT -= dt;
    if (this.beamT <= 0) { this.beamT = rand(7, 12); this.beamOn = 2.2; }
    if (this.beamOn > 0) this.beamOn -= dt;
    const want = this.beamOn > 0 ? 0.28 * Math.min(1, this.beamOn * 2, (2.2 - this.beamOn) * 3) : 0;
    this.beamMat.opacity = want;
    this.beam.visible = want > 0.01;
    this.beam.scale.y = this.body.position.y;
  }
}

/** The timing meter: a needle runs back and forth; stop it in the middle. */
function meterValue(t, speed) {
  const u = (t * speed) % 2;
  return u < 1 ? u : 2 - u;
}

Object.assign(Game, {
  /* ---------- freeze ---------- */

  startFreeze() {
    const pw = POWER_BY_ID.freeze;
    if (this.mode !== 'play' || this.modals.size || this.race || this.arm || this.photo || this.build) return;
    if (!this.powerUnlocked(pw)) { Sfx.play('error'); this.toast(`🔒 قدرت «${pw.name}» در سطح ${fa(pw.level)} باز می‌شه.`, 'warn'); return; }
    if (this.powerCd.freeze > 0) return;
    Sfx.init();
    const w = this.world;
    const p = this.player.ch.root.position;
    if (!this.iceGeo) this.iceGeo = new THREE.BoxGeometry(0.95, 1, 0.95).translate(0, 0.5, 0);
    if (!this.iceMat) this.iceMat = new THREE.MeshStandardMaterial({ color: '#bfefff', transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.1, emissive: '#3a8fb8', emissiveIntensity: 0.35, depthWrite: false });
    const list = this.frozen || (this.frozen = []);
    let n = 0;
    for (const q of w.npcs) {
      if (['knocked', 'class', 'race', 'boss', 'buddy', 'leave', 'dodge', 'frozen', 'dcoach'].includes(q.state)) continue;
      const qp = q.ch.root.position;
      if (Math.hypot(qp.x - p.x, qp.z - p.z) > 14) continue;
      this.freezeNpc(q, w);
      n++;
    }
    this.powerCd.freeze = pw.cd;
    this.save.stats.powers++;
    this.missionProgress('power', 1);
    w.fx.ring({ x: p.x, y: 0.3, z: p.z }, { count: 60, color: '#bfefff', radius: 0.6, speed: 9, life: 0.9 });
    w.fx.burst({ x: p.x, y: 1.4, z: p.z }, { count: 50, colors: ['#ffffff', '#bfefff', '#7fe0ff'], speed: 6, up: 2, life: 0.9 });
    Sfx.play('zap');
    this.showBanner(n ? `${fa(n)} نفر یخ زدن!` : 'هیچ‌کس نزدیکت نبود!', '❄️ یخ‌زدگی');
    const st = this.save.stats;
    st.freezeBest = Math.max(st.freezeBest || 0, n);
    this.checkAchievements();
    this.gainXp(Math.round(pw.xp * this.mult()));
    this.refreshPowers();
  },

  freezeNpc(q, w) {
    const ch = q.ch;
    if (ch.busy) ch.stopAction();
    w.leaveStation(q);
    q.state = 'frozen';
    q.vel.set(0, 0);
    // the body keeps the pose it had
    copyPose(ch.manualPose, ch.cur);
    ch.manual = true;
    ch.manualSnap = true;
    const ice = new THREE.Mesh(this.iceGeo, this.iceMat);
    ice.userData.noSolid = true;
    ice.scale.y = 2.05;
    ch.root.add(ice);
    ch.setLabel(q.name, '🥶 یخ زده!', '#bfefff');
    this.frozen.push({ q, w, ice, t: 6 + rand(0, 0.6) });
  },

  thawNpc(F, shatter) {
    const { q, w, ice } = F;
    ice.removeFromParent();
    q.ch.manual = false;
    q.ch.manualSnap = false;
    if (shatter && w === this.world) {
      const p = q.ch.root.position;
      w.fx.burst({ x: p.x, y: 1.1, z: p.z }, { count: 26, colors: ['#ffffff', '#bfefff', '#7fe0ff'], speed: 3.5, up: 2.5, life: 0.7 });
    }
    if (q.state === 'frozen') {
      q.state = 'idle';
      q.timer = rand(0.4, 1.4);
      q.ch.setLabel(q.name, 'سطح ' + fa(q.level), '#7fe0ff');
      if (shatter && Math.random() < 0.6) q.ch.play(pick(['e_laugh', 'e_flex', 'e_dance']));
    }
  },

  tickFreeze(dt) {
    const list = this.frozen;
    if (!list || !list.length) return;
    let cracked = false;
    for (let i = list.length - 1; i >= 0; i--) {
      const F = list[i];
      // someone moved them on (a knock, a class, travel): let go at once
      if (F.q.state !== 'frozen' || !F.w.npcs.includes(F.q)) { this.thawNpc(F, false); list.splice(i, 1); continue; }
      if (this.modals.size || this.watch || this.photo) continue;
      F.t -= dt;
      F.ice.material.opacity = F.t < 1 ? 0.25 + 0.2 * Math.abs(Math.sin(this.clock * 14)) : 0.45;
      if (F.t <= 0) { this.thawNpc(F, true); list.splice(i, 1); cracked = true; }
    }
    if (cracked) Sfx.play('clank');
  },

  /* ---------- the ninja-hall arcade: a hoop and a human cannon ---------- */

  buildArcade(g) {
    g.arcade = true;
    const add = (m, solid) => { if (!solid) m.userData.noSolid = true; g.scene.add(m); return m; };
    const steel = new THREE.MeshStandardMaterial({ color: '#2c3140', roughness: 0.5, metalness: 0.6 });
    const orange = new THREE.MeshStandardMaterial({ color: '#ff7b00', roughness: 0.5, metalness: 0.3 });
    // the court painted on the floor: key, free-throw circle and the three-point arc
    const cw = 15, cd = 10.4;
    const court = new THREE.Mesh(new THREE.PlaneGeometry(cw, cd), new THREE.MeshStandardMaterial({
      map: makeCanvasTexture(768, 532, (ctx, w, h) => {
        const s = w / cw;
        ctx.fillStyle = '#c87a3d';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(90,40,10,${rand(0.03, 0.08)})`; ctx.fillRect(0, i * (h / 40), w, h / 80); }
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.07 * s;
        ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
        const rimX = w / 2, rimY = (HOOP.z - (HOOP.boardZ - 0.1)) * s;
        ctx.fillStyle = 'rgba(47,111,237,0.65)';
        ctx.fillRect(w / 2 - 2.45 * s, 0, 4.9 * s, 5.8 * s);
        ctx.strokeRect(w / 2 - 2.45 * s, 0, 4.9 * s, 5.8 * s);
        ctx.beginPath(); ctx.arc(w / 2, 5.8 * s, 1.8 * s, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.arc(rimX, rimY, 6.75 * s, 0.08, Math.PI - 0.08); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rimX - 6.75 * s * Math.cos(0.08), 0); ctx.lineTo(rimX - 6.75 * s * Math.cos(0.08), rimY + 6.75 * s * Math.sin(0.08)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rimX + 6.75 * s * Math.cos(0.08), 0); ctx.lineTo(rimX + 6.75 * s * Math.cos(0.08), rimY + 6.75 * s * Math.sin(0.08)); ctx.stroke();
        ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = `${0.9 * s}px ${DISPLAY_FONT}`;
        ctx.fillText('۳ امتیازی', w / 2, h - 1.0 * s);
      }),
      roughness: 0.7,
    }));
    court.rotation.x = -Math.PI / 2;
    court.position.set(HOOP.x, 0.012, HOOP.boardZ - 0.1 + cd / 2);
    add(court);
    // the post, the arm and the backboard
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 3.9, 12), steel), true).position.set(HOOP.x, 1.95, HOOP.boardZ - 1.1);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.1), steel)).position.set(HOOP.x, 3.55, HOOP.boardZ - 0.55);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.4), new THREE.MeshStandardMaterial({ color: '#2f6fed', roughness: 0.6 })), true).position.set(HOOP.x, 0.25, HOOP.boardZ - 1.1);
    const board = add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 0.05), new THREE.MeshStandardMaterial({
      map: makeCanvasTexture(360, 210, (ctx, w, h) => {
        ctx.fillStyle = '#f4f7fb'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#e63946'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);
        ctx.lineWidth = 7; ctx.strokeRect(w / 2 - 59, h - 115, 118, 90);
      }),
      roughness: 0.3,
    })));
    board.position.set(HOOP.x, 3.45, HOOP.boardZ);
    // rim and net
    const rim = add(new THREE.Mesh(new THREE.TorusGeometry(HOOP.rimR, 0.018, 8, 28), orange));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(HOOP.x, HOOP.rimY, HOOP.z);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, HOOP.z - HOOP.boardZ - HOOP.rimR), orange)).position.set(HOOP.x, HOOP.rimY, (HOOP.boardZ + HOOP.z - HOOP.rimR) / 2);
    const net = add(new THREE.Mesh(new THREE.CylinderGeometry(HOOP.rimR, HOOP.rimR * 0.6, 0.42, 14, 3, true), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.8 })));
    net.position.set(HOOP.x, HOOP.rimY - 0.21, HOOP.z);
    g.hoopNet = net;
    // a sign over the court
    this.hangSign(g, 'بسکتبال 🏀', '#ff7b00', HOOP.x, 6.4, HOOP.boardZ - 1.6, 4.4);

    // the cannon: wheels you bump into, a barrel you climb into, a target on the floor
    const C = CANNON;
    const wood = new THREE.MeshStandardMaterial({ color: '#8a5a2b', roughness: 0.8 });
    const red = new THREE.MeshStandardMaterial({ color: '#e63946', roughness: 0.4, metalness: 0.3 });
    for (const s of [-1, 1]) {
      const wh = add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.14, 20), wood), true);
      wh.rotation.x = Math.PI / 2;
      wh.position.set(C.x, 0.55, C.z + s * 0.64);
      const hub = add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 10), steel));
      hub.rotation.x = Math.PI / 2;
      hub.position.set(C.x, 0.55, C.z + s * 0.68);
    }
    add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.9), wood)).position.set(C.x - 0.2, 0.7, C.z);
    const barrel = new THREE.Group();
    barrel.position.set(C.x, 1.05, C.z);
    barrel.rotation.z = C.elev;
    g.scene.add(barrel);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 2.6, 24, 1, true), red);
    tube.material.side = THREE.DoubleSide;
    tube.rotation.z = -Math.PI / 2;
    tube.position.x = 0.5;
    barrel.add(tube);
    for (const [x, r] of [[-0.8, 0.56], [0.3, 0.52], [1.78, 0.52]]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 8, 24), new THREE.MeshStandardMaterial({ color: '#ffd34d', metalness: 0.7, roughness: 0.3 }));
      band.rotation.y = Math.PI / 2;
      band.position.x = x;
      barrel.add(band);
    }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 10, 0, TAU, 0, Math.PI / 2), red);
    cap.rotation.z = Math.PI / 2;
    cap.position.x = -0.8;
    barrel.add(cap);
    barrel.traverse((o) => { o.userData.noSolid = true; });
    g.cannonBarrel = barrel;
    // the muzzle in the world
    C.mx = C.x + Math.cos(C.elev) * 1.8;
    C.my = 1.05 + Math.sin(C.elev) * 1.8;
    // the target: rings painted on the floor
    [[4.5, '#ffffff'], [3.2, '#2f6fed'], [2, '#ffd34d'], [1, '#e63946']].forEach(([r, c], i) => {
      const m = add(new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })));
      m.rotation.x = -Math.PI / 2;
      m.position.set(C.tx, 0.014 + i * 0.002, C.z);
    });
    this.hangSign(g, 'توپ انسانی 💥', '#e63946', C.x + 3, 6.4, C.z - 2.2, 4.4);
    g.solids = null;
  },

  /** A sign hanging from the ceiling on two cables, readable from both sides. */
  hangSign(g, text, color, x, y, z, sw) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 0.25), new THREE.MeshBasicMaterial({
      map: signTexture([{ text, size: 120, display: true, color }], { w: 1024, h: 256, border: color, bg1: '#10142a', bg2: '#1b1f3d' }),
      toneMapped: false,
    }));
    sign.position.set(x, y, z);
    sign.userData.noSolid = true;
    g.scene.add(sign);
    const back = new THREE.Mesh(sign.geometry, sign.material);
    back.position.copy(sign.position);
    back.rotation.y = Math.PI;
    back.userData.noSolid = true;
    g.scene.add(back);
    const cableLen = (g.ceiling || 11) - y - sw * 0.125;
    const mat = new THREE.MeshStandardMaterial({ color: '#2c3140' });
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, cableLen, 6), mat);
      c.position.set(x + s * sw * 0.4, y + sw * 0.125 + cableLen / 2, z);
      c.userData.noSolid = true;
      g.scene.add(c);
    }
  },

  /** Free hands: not in a race, a game, a machine or the middle of a move. */
  funFree() {
    const P = this.player;
    return this.mode === 'play' && !this.modals.size && !this.race && !this.arm && !this.build && !this.photo && !this.watch
      && !this.meter && !this.cannon && !P.anchor && !P.ch.busy && P.ch.grounded;
  },

  /** Is the player free to start one of the arcade games? */
  arcadeFree() {
    return this.funFree() && this.world === this.gym && !this.dodge && !this.lava && !this.hunt && !this.danceOff && !this.shot && !(this.gym && this.gym.boss);
  },

  nearHoop() {
    const p = this.player.ch.root.position;
    const d = Math.hypot(p.x - HOOP.x, p.z - HOOP.z);
    return d > 1.6 && d < 10 && p.z > HOOP.z + 0.8 && Math.abs(p.x - HOOP.x) < 8.5;
  },

  nearCannon() {
    const p = this.player.ch.root.position;
    return Math.hypot(p.x - (CANNON.x - 1.3), p.z - CANNON.z) < 1.8 || Math.hypot(p.x - CANNON.x, p.z - CANNON.z) < 1.4;
  },

  /** What the context button does in the arcade (null when nothing). */
  arcadeAction() {
    if (this.meter) return { label: '🎯 الان!', run: () => this.lockMeter() };
    const D = this.disco;
    if (D && D.pinata && D.w === this.world && !D.pinata.broken && this.funFree()) {
      const pp = this.player.ch.root.position;
      if (Math.hypot(pp.x - D.pinata.x, pp.z - D.pinata.z) < 1.7) return { label: `🪅 بزن به پینیاتا (${fa(D.pinata.hits)}/${fa(D.pinata.need)})`, run: () => this.hitPinata() };
    }
    if (this.world !== this.gym || !this.gym.arcade || !this.arcadeFree()) return null;
    if (this.nearCannon()) return { label: '💥 برو توی توپ انسانی', run: () => this.loadCannon() };
    if (this.nearHoop()) return { label: '🏀 پرتاب به حلقه', run: () => this.aimHoop() };
    return null;
  },

  /* the timing meter */

  startMeter(kind, title, speed) {
    this.meter = { kind, t: rand(0, 0.5), speed, title };
    $('meterHead').textContent = title;
    $('meterPanel').hidden = false;
    this.lockMove = true;
    this.tickMeter(0);
  },

  tickMeter(dt) {
    const M = this.meter;
    if (!M) return;
    if (this.world !== this.gym || this.mode !== 'play' || this.race || this.arm) { this.cancelMeter(); return; }
    if (M.kind === 'cannon') this.holdInCannon();
    else this.faceHoop();
    if (this.modals.size || this.watch || this.photo) return;
    M.t += dt;
    M.v = meterValue(M.t, M.speed);
    $('meterNeedle').style.left = `${(M.v * 100).toFixed(1)}%`;
  },

  lockMeter() {
    const M = this.meter;
    if (!M) return;
    this.meter = null;
    $('meterPanel').hidden = true;
    const err = (M.v - 0.5) * 2; // -1 … 1, 0 is perfect
    const a = Math.abs(err);
    this.floatText(a < 0.12 ? '🎯 عالی!' : a < 0.35 ? '👍 خوب' : '😬 اوه!', a < 0.12 ? 'fl-combo' : '');
    if (M.kind === 'cannon') this.fireCannon(M.v);
    else this.shootHoop(err);
  },

  cancelMeter() {
    const M = this.meter;
    if (!M) return;
    this.meter = null;
    $('meterPanel').hidden = true;
    this.lockMove = false;
    if (M.kind === 'cannon') this.leaveCannon();
  },

  /* basketball */

  faceHoop() {
    const ch = this.player.ch;
    const p = ch.root.position;
    ch.root.rotation.y = angleLerp(ch.root.rotation.y, Math.atan2(HOOP.x - p.x, HOOP.z - p.z), 0.3);
    this.player.vel.set(0, 0);
  },

  aimHoop() {
    if (!this.arcadeFree() || !this.nearHoop()) return;
    if (this.loop) this.stopLoop(true);
    if (this.player.board) this.endBoard();
    if (this.player.jet) this.endJet();
    Sfx.play('click');
    const p = this.player.ch.root.position;
    const d = Math.hypot(p.x - HOOP.x, p.z - HOOP.z);
    this.startMeter('hoop', d > 6.75 ? '🏀 پرتاب سه‌امتیازی! وقتی عقربه وسطه بزن' : '🏀 وقتی عقربه وسطه دکمه رو بزن', 0.9 + d * 0.06);
  },

  shootHoop(err) {
    const P = this.player;
    const ch = P.ch;
    const p = ch.root.position;
    const yaw = Math.atan2(HOOP.x - p.x, HOOP.z - p.z);
    ch.root.rotation.y = yaw;
    ch.play('throwball');
    const dist = Math.hypot(p.x - HOOP.x, p.z - HOOP.z);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    // where it is really going: long or short by the meter, a little to the side when sloppy
    const side = (Math.random() - 0.5) * Math.abs(err) * 0.5;
    const tx = HOOP.x + fx * err * 0.55 + fz * side;
    const tz = HOOP.z + fz * err * 0.55 - fx * side;
    const sx = p.x + fx * 0.35, sy = p.y + ch.airY + 2.15 * ch.root.scale.y, sz = p.z + fz * 0.35;
    const T = 0.75 + dist * 0.07;
    const G = 9.8;
    const mesh = new THREE.Mesh(this.ballGeo || (this.ballGeo = new THREE.SphereGeometry(BALL_R, 16, 12)), this.ballMat || (this.ballMat = new THREE.MeshStandardMaterial({
      map: makeCanvasTexture(128, 64, (ctx, w, h) => {
        ctx.fillStyle = '#e86a1a'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#2b1a0e'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
        for (const x of [w / 4, (3 * w) / 4]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      }),
      roughness: 0.6,
    })));
    mesh.userData.noSolid = true;
    mesh.visible = false;
    this.world.scene.add(mesh);
    this.shot = {
      mesh, wait: 0.38, G, three: dist > 6.75,
      pos: new THREE.Vector3(sx, sy, sz),
      vel: new THREE.Vector3((tx - sx) / T, (HOOP.rimY - sy + 0.5 * G * T * T) / T, (tz - sz) / T),
      life: 4, scored: false, rimHits: 0, missed: false, prevY: sy,
    };
    this.lockMove = false;
  },

  tickShot(dt) {
    const S = this.shot;
    if (!S) return;
    if (this.world !== this.gym) { this.endShot(); return; }
    if (S.wait > 0) { S.wait -= dt; if (S.wait <= 0) { S.mesh.visible = true; Sfx.play('whoosh'); } return; }
    S.life -= dt;
    const n = 3; // a few small steps so the rim is not skipped
    for (let i = 0; i < n; i++) {
      const h = dt / n;
      S.prevY = S.pos.y;
      S.vel.y -= S.G * h;
      S.pos.addScaledVector(S.vel, h);
      // the backboard
      if (S.vel.z < 0 && S.pos.z - BALL_R < HOOP.boardZ + 0.03 && S.pos.z > HOOP.boardZ - 0.2 && Math.abs(S.pos.x - HOOP.x) < 0.9 && Math.abs(S.pos.y - 3.45) < 0.53) {
        S.pos.z = HOOP.boardZ + 0.03 + BALL_R;
        S.vel.z = -S.vel.z * 0.55;
        S.vel.x *= 0.8;
        Sfx.play('tap');
      }
      // through the rim from above
      if (!S.scored && !S.missed && S.vel.y < 0 && S.prevY >= HOOP.rimY && S.pos.y < HOOP.rimY) {
        const d = Math.hypot(S.pos.x - HOOP.x, S.pos.z - HOOP.z);
        if (d < HOOP.rimR - BALL_R * 0.4) this.hoopScore(S, d < 0.09);
        else if (d < HOOP.rimR + BALL_R + 0.02 && S.rimHits < 2) {
          // off the rim: up and away (sometimes it falls in after all)
          S.rimHits++;
          const ax = (S.pos.x - HOOP.x) / (d || 1), az = (S.pos.z - HOOP.z) / (d || 1);
          const sp = Math.hypot(S.vel.x, S.vel.z);
          const inward = Math.random() < 0.35;
          S.vel.set((inward ? -ax : ax) * sp * 0.35 + rand(-0.3, 0.3), Math.abs(S.vel.y) * 0.45, (inward ? -az : az) * sp * 0.35 + rand(-0.3, 0.3));
          S.pos.y = HOOP.rimY + 0.01;
          Sfx.play('clank');
        } else S.missed = true;
      }
      // the floor
      if (S.pos.y < BALL_R) {
        S.pos.y = BALL_R;
        if (S.vel.y < -1) { S.vel.y = -S.vel.y * 0.6; Sfx.play('tap'); } else S.vel.y = 0;
        S.vel.x *= 0.8; S.vel.z *= 0.8;
        if (!S.scored && !S.done) this.hoopMiss(S);
      }
    }
    S.mesh.position.copy(S.pos);
    S.mesh.rotation.x -= dt * 8;
    if (S.netT > 0) { S.netT -= dt; this.gym.hoopNet.scale.y = 1 - 0.35 * Math.sin(Math.min(1, S.netT * 2) * Math.PI); }
    if (S.life <= 0) this.endShot();
  },

  hoopScore(S, swish) {
    S.scored = true;
    S.done = true;
    S.netT = 0.5;
    S.vel.x *= 0.2; S.vel.z *= 0.2;
    const st = this.save.stats;
    st.hoops = (st.hoops || 0) + 1;
    this.hoopRun = (this.hoopRun || 0) + 1;
    st.hoopStreak = Math.max(st.hoopStreak || 0, this.hoopRun);
    if (S.three) st.hoopThree = (st.hoopThree || 0) + 1;
    const pts = S.three ? 3 : 2;
    const coins = pts * 4 + (this.hoopRun >= 3 ? 5 : 0);
    this.addCoins(coins, true);
    this.gainXp(Math.round(10 * pts * this.mult()));
    Sfx.play(swish ? 'success' : 'coin');
    const w = this.world;
    w.fx.burst({ x: HOOP.x, y: HOOP.rimY, z: HOOP.z }, { count: swish ? 40 : 22, colors: ['#ff7b00', '#ffd34d', '#ffffff'], speed: 2.5, up: 1.5, life: 0.6 });
    const fire = this.hoopRun >= 3 ? ` 🔥×${fa(this.hoopRun)}` : '';
    this.floatText(`🏀 ${swish ? 'شلپ! ' : ''}+${fa(pts)}${fire}`, 'fl-combo');
    if (this.hoopRun === 3) this.toast('🔥 داغ کردی! سه تا پشت سر هم؛ از این به بعد هر پرتاب ۵ سکه بیشتر.', 'gold');
    if (this.hoopRun === 5 || (S.three && st.hoopThree === 1)) this.checkAchievements();
  },

  hoopMiss(S) {
    S.done = true;
    if (this.hoopRun >= 3) this.toast('🏀 زنجیره‌ی پرتاب‌هات قطع شد.', 'warn');
    this.hoopRun = 0;
    Sfx.play('fail');
  },

  endShot() {
    const S = this.shot;
    if (!S) return;
    this.shot = null;
    S.mesh.removeFromParent();
    if (this.gym && this.gym.hoopNet) this.gym.hoopNet.scale.y = 1;
  },

  /* human cannon */

  loadCannon() {
    if (!this.arcadeFree() || !this.nearCannon()) return;
    if (this.loop) this.stopLoop(true);
    const P = this.player;
    if (P.board) this.endBoard();
    if (P.jet) this.endJet();
    this.cannon = { state: 'load' };
    P.ch.manual = true;
    P.ch.manualSnap = false;
    Sfx.play('click');
    this.holdInCannon();
    this.startMeter('cannon', '💥 وقتی عقربه وسطه شلیک کن تا وسط هدف فرود بیای', 1.0);
  },

  /** Inside the barrel: lying along it, head at the muzzle. */
  holdInCannon() {
    const P = this.player;
    const ch = P.ch;
    const C = CANNON;
    ch.root.position.set(C.x + Math.cos(C.elev) * 0.85, 0, C.z);
    ch.root.rotation.y = Math.PI / 2;
    ch.airY = 1.05 + Math.sin(C.elev) * 0.85 - 1.0;
    ch.vy = 0;
    ch.grounded = false;
    P.vel.set(0, 0);
    const pose = ch.manualPose;
    copyPose(pose, STAND);
    pose.bx = Math.PI / 2 - C.elev;
    pose.shLX = pose.shRX = -3.0;
    pose.elL = pose.elR = -0.1;
    pose.nkX = -0.3;
  },

  fireCannon(v) {
    const P = this.player;
    const ch = P.ch;
    const C = CANNON;
    const g = ch.grav || 20;
    const R = (C.tx - C.mx) + (v - 0.5) * 22; // how far from the muzzle it lands
    const vy = 9 + v * 4;
    const h0 = C.my - 1.0;
    const tl = (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g;
    ch.root.position.set(C.mx - 0.6, 0, C.z);
    ch.airY = h0;
    ch.vy = vy;
    ch.grounded = false;
    this.cannon = { state: 'fly', t: 0, sx: C.mx - 0.6, vh: (R + 0.6) / tl, tl };
    this.lockMove = true;
    const w = this.world;
    w.fx.burst({ x: C.mx, y: C.my, z: C.z }, { count: 60, colors: ['#ffffff', '#cfd6e3', '#ff7b00', '#ffd34d'], speed: 6, up: 2, life: 0.9 });
    Sfx.play('boom');
    // the barrel kicks back
    this.gym.cannonBarrel.position.x = C.x - 0.25;
  },

  tickCannon(dt) {
    const K = this.cannon;
    const g = this.gym;
    if (g && g.cannonBarrel) g.cannonBarrel.position.x += (CANNON.x - g.cannonBarrel.position.x) * damp(4, dt);
    if (!K || K.state !== 'fly') return;
    const P = this.player;
    const ch = P.ch;
    if (this.world !== this.gym || this.mode === 'arena') { this.leaveCannon(); return; }
    K.t += dt;
    ch.root.position.x = K.sx + K.vh * K.t;
    ch.root.position.z = CANNON.z;
    P.vel.set(0, 0);
    // superman: body along the flight path, arms out front
    const pose = ch.manualPose;
    copyPose(pose, STAND);
    pose.bx = Math.PI / 2 - Math.atan2(ch.vy, K.vh);
    pose.shLX = pose.shRX = -3.0;
    pose.shLZ = 0.15; pose.shRZ = -0.15;
    pose.hpLX = pose.hpRX = 0.1;
    if (Math.random() < 0.5) this.world.fx.emit(ch.root.position.x - 0.6, ch.airY + 1, CANNON.z, -1, 0.3, rand(-0.3, 0.3), new THREE.Color(pick(['#ffffff', '#cfd6e3'])), 0.5, 0);
    // people in the way get bowled over
    for (const q of this.world.npcs) {
      if (['knocked', 'class', 'race', 'boss', 'buddy', 'leave', 'dodge', 'frozen', 'dcoach'].includes(q.state) || q.anchored) continue;
      const qp = q.ch.root.position;
      if (ch.airY < 1.6 && Math.hypot(qp.x - ch.root.position.x, qp.z - ch.root.position.z) < 0.9) this.world.knockNpc(q, ch.root.position.x, ch.root.position.z);
    }
    if (ch.grounded || K.t > K.tl + 1.5) this.landCannon();
  },

  landCannon() {
    const P = this.player;
    const ch = P.ch;
    const p = ch.root.position;
    this.leaveCannon();
    const d = Math.hypot(p.x - CANNON.tx, p.z - CANNON.z);
    const [pts, coins, text] = d < 1 ? [100, 60, '🎯 وسط هدف!'] : d < 2 ? [50, 30, '🟡 خیلی نزدیک!'] : d < 3.2 ? [25, 15, '🔵 خوب بود!'] : d < 4.5 ? [10, 5, '⚪ لب هدف'] : [0, 0, '😅 بیرون از هدف'];
    const w = this.world;
    w.fx.burst({ x: p.x, y: 0.3, z: p.z }, { count: 30, colors: ['#cfd6e3', '#ffffff'], speed: 3, up: 1, life: 0.6 });
    Sfx.play('land');
    const st = this.save.stats;
    st.cannonShots = (st.cannonShots || 0) + 1;
    st.cannonBest = Math.max(st.cannonBest || 0, pts);
    if (pts) {
      this.addCoins(coins, true);
      this.gainXp(Math.round(pts * this.mult()));
    }
    this.floatText(`${text} ${pts ? '+' + fa(pts) : ''}`, pts >= 50 ? 'fl-combo' : '');
    if (pts === 100) {
      st.cannonBull = (st.cannonBull || 0) + 1;
      this.confetti();
      Sfx.play('cheer');
      ch.play('e_victory');
      if (st.cannonBull === 1) this.checkAchievements();
    }
  },

  leaveCannon() {
    const P = this.player;
    this.cannon = null;
    this.lockMove = false;
    if (!P) return;
    // the hoverboard's own tick decides about manual while you ride; nothing else does
    if (!P.board) P.ch.manual = false;
    if (!P.ch.grounded && P.ch.airY > 0 && this.world === this.gym) {
      // still sitting in the barrel: climb out to the side
      const p = P.ch.root.position;
      if (Math.hypot(p.x - CANNON.x, p.z - CANNON.z) < 1) { p.set(CANNON.x - 1.6, 0, CANNON.z); P.ch.airY = 0; P.ch.vy = 0; P.ch.grounded = true; }
    }
  },

  /* ---------- the piñata at disco parties ---------- */

  addPinata(D) {
    const w = D.w;
    let x = D.cx + 2.6, z = D.cz;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      const tx = D.cx + Math.cos(a) * 2.6, tz = D.cz + Math.sin(a) * 2.6;
      if (w.inBounds(tx, tz, 1) && w.spotFree(tx, tz, 0.6)) { x = tx; z = tz; break; }
    }
    const top = Math.min((w.ceiling || 12) - 0.2, 7);
    const grp = new THREE.Group();
    grp.position.set(x, top, z);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6).translate(0, -0.5, 0), new THREE.MeshStandardMaterial({ color: '#d9c7a0' }));
    const body = new THREE.Group();
    const len = top - 2.2;
    rope.scale.y = len;
    body.position.y = -len - 0.3;
    grp.add(rope, body);
    const b = new Batch();
    b.sphere(0.3, 0, 0, 0, '#ff4da6');
    const cols = ['#ffd34d', '#2ecc71', '#7fe0ff', '#c77dff', '#ff7b00'];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      b.add(UnitGeo.cone(10), Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0, cols[i], 0, 0, a - Math.PI / 2, 0.14, 0.32, 0.14);
    }
    body.add(new THREE.Mesh(mergeParts(b.parts, false), MATTE_MAT));
    // paper streamers
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.55), new THREE.MeshBasicMaterial({ color: cols[i], side: THREE.DoubleSide }));
      const a = (i / 5) * TAU + 0.6;
      s.position.set(Math.cos(a) * 0.2, -0.5, Math.sin(a) * 0.2);
      body.add(s);
    }
    grp.traverse((o) => { o.userData.noSolid = true; });
    w.scene.add(grp);
    D.pinata = { grp, body, rope, x, z, hits: 0, need: 5, swing: 0, sv: 0, broken: false };
  },

  hitPinata() {
    const D = this.disco;
    const Pi = D && D.pinata;
    if (!Pi || Pi.broken || !this.funFree()) return;
    const ch = this.player.ch;
    const p = ch.root.position;
    ch.root.rotation.y = Math.atan2(Pi.x - p.x, Pi.z - p.z);
    ch.play('e_kick');
    Pi.pending = 0.55;
  },

  tickPinata(dt) {
    const D = this.disco;
    const Pi = D && D.pinata;
    if (!Pi || Pi.broken) return;
    Pi.sv += -Pi.swing * 9 * dt;
    Pi.sv *= 1 - dt * 0.8;
    Pi.swing += Pi.sv * dt;
    Pi.grp.rotation.z = Pi.swing;
    Pi.body.rotation.y += dt * 0.8;
    if (Pi.pending > 0) {
      Pi.pending -= dt;
      if (Pi.pending <= 0) {
        Pi.hits++;
        Pi.sv += 1.6 * (Math.random() < 0.5 ? -1 : 1);
        Sfx.play('punch');
        const w = D.w;
        const y = Pi.grp.position.y - Pi.rope.scale.y - 0.3;
        w.fx.burst({ x: Pi.x, y, z: Pi.z }, { count: 12, colors: ['#ff4da6', '#ffd34d', '#7fe0ff'], speed: 2, up: 1, life: 0.5 });
        if (Pi.hits >= Pi.need) this.breakPinata(D, y);
        else this.floatText(`🪅 ${fa(Pi.hits)}/${fa(Pi.need)}`, 'fl-combo');
      }
    }
  },

  breakPinata(D, y) {
    const Pi = D.pinata;
    Pi.broken = true;
    Pi.body.visible = false;
    const w = D.w;
    w.fx.burst({ x: Pi.x, y, z: Pi.z }, { count: 90, colors: ['#ff4da6', '#ffd34d', '#7fe0ff', '#2ecc71', '#c77dff', '#ff7b00'], speed: 5, up: 3, life: 1.3 });
    Sfx.play('jackpot');
    this.confetti();
    this.addCoins(80);
    this.gainXp(Math.round(120 * this.mult()));
    this.showBanner('🍬 آب‌نبات و ۸۰ سکه ریخت پایین!', '🪅 پینیاتا شکست!');
    // the dancers cheer
    for (const n of D.dancers) if (n.state === 'party' && n.ch.grounded) { n.ch.stopAction(); n.ch.play('e_victory'); n.partyT = 1.6; }
    const st = this.save.stats;
    st.pinatas = (st.pinatas || 0) + 1;
    if (st.pinatas === 1) this.checkAchievements();
  },

  removePinata(D) {
    const Pi = D.pinata;
    if (!Pi) return;
    D.pinata = null;
    Pi.grp.removeFromParent();
    Pi.grp.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); if (o.material !== MATTE_MAT) o.material.dispose(); } });
  },

  /* ---------- dance-off with a coach ---------- */

  startDanceOff() {
    this.closeModal('menuModal');
    const w = this.world;
    const P = this.player;
    if (this.mode !== 'play' || this.race || this.arm || this.build || this.dodge || this.lava || this.hunt || this.danceOff || this.inFootball() || w.allowTurbo || this.cannon || this.meter) {
      this.toast('رقص با مربی وقتی کار دیگه‌ای نمی‌کنی شروع می‌شه.', 'warn');
      return;
    }
    if (this.loop) this.stopLoop(true);
    const p = P.ch.root.position;
    // a free spot in front of you for the coach
    const spot = this.coachSpot(w);
    const coach = w.npcs
      .filter((n) => ['idle', 'walk', 'jog', 'chat', 'fan', 'party'].includes(n.state) && !n.anchored)
      .sort((a, b) => a.ch.root.position.distanceTo(p) - b.ch.root.position.distanceTo(p))[0];
    if (!spot || !coach) { this.toast('این‌جا جا یا کسی برای رقص نیست؛ برو جای بازتر.', 'warn'); return; }
    if (coach.ch.busy) coach.ch.stopAction();
    w.leaveStation(coach);
    coach.state = 'dcoach';
    coach.vel.set(0, 0);
    coach.ch.root.position.set(spot.x, coach.ch.root.position.y, spot.z);
    coach.ch.root.rotation.y = Math.atan2(p.x - spot.x, p.z - spot.z);
    P.ch.root.rotation.y = Math.atan2(spot.x - p.x, spot.z - p.z);
    coach.ch.setLabel(coach.name, '🕺 مربی رقص', '#ff4da6');
    w.fx.ring({ x: spot.x, y: 0.2, z: spot.z }, { count: 30, color: '#ff4da6', radius: 0.5, speed: 3, life: 0.6 });
    this.danceOff = { w, coach, round: 0, seq: [], i: 0, state: 'next', t: 1.2, got: 0 };
    $('dancePanel').hidden = false;
    this.setTab('fun');
    Sfx.play('whistle');
    this.showBanner('مربی می‌رقصه؛ تو همون‌ها رو به ترتیب از زبانه‌ی «نمایشی» تکرار کن!', '🕺 رقص با مربی');
    this.drawDance();
  },

  /** A free spot about 2.6 m in front of the player (or null). */
  coachSpot(w) {
    const P = this.player;
    const p = P.ch.root.position;
    const yaw = P.ch.root.rotation.y;
    for (const [d, a] of [[2.6, 0], [2.6, 0.6], [2.6, -0.6], [3.2, 1.2], [3.2, -1.2], [2.6, Math.PI]]) {
      const x = p.x + Math.sin(yaw + a) * d, z = p.z + Math.cos(yaw + a) * d;
      if (w.inBounds(x, z, 0.8) && w.spotFree(x, z, 0.5)) return { x, z };
    }
    return null;
  },

  placeCoach(D) {
    const spot = this.coachSpot(D.w);
    if (!spot) return;
    const c = D.coach.ch;
    const p = this.player.ch.root.position;
    c.root.position.set(spot.x, c.root.position.y, spot.z);
    c.root.rotation.y = Math.atan2(p.x - spot.x, p.z - spot.z);
    D.w.fx.ring({ x: spot.x, y: 0.2, z: spot.z }, { count: 30, color: '#ff4da6', radius: 0.5, speed: 3, life: 0.6 });
  },

  drawDance() {
    const D = this.danceOff;
    if (!D) return;
    const icons = D.seq.map((id, k) => {
      const m = MOVE_BY_ID[id];
      const cls = D.state === 'copy' && k < D.i ? 'ok' : D.state === 'show' && k === D.i ? 'now' : D.state === 'show' && k > D.i ? 'wait' : '';
      return `<span class="dance-ic ${cls}">${D.state === 'show' && k > D.i ? '❔' : m.icon}</span>`;
    }).join('');
    const head = D.state === 'show' ? `👀 دور ${fa(D.round)} از ۵: نگاه کن!` : D.state === 'copy' ? `🕺 دور ${fa(D.round)}: نوبت توئه • ⏱️ ${fa(Math.ceil(Math.max(0, D.t)))}` : `🕺 دور ${fa(D.round + 1)} از ۵`;
    $('danceHead').textContent = head;
    $('danceIcons').innerHTML = icons;
    const names = D.state === 'copy' ? D.seq.map((id) => MOVE_BY_ID[id].name).join(' ← ') : '';
    $('danceInfo').textContent = names;
  },

  tickDanceOff(dt) {
    const D = this.danceOff;
    if (!D) return;
    if (this.world !== D.w || this.mode === 'arena' || this.race || this.arm || !D.w.npcs.includes(D.coach)) { this.endDanceOff(null); return; }
    if (this.modals.size || this.watch || this.photo) return;
    // knocked over by a ball or a power: wait for them to get up, then show the round again
    if (D.coach.state === 'knocked') { D.down = true; return; }
    if (D.coach.state !== 'dcoach') {
      if (!D.down || D.coach.state !== 'idle') { this.endDanceOff(null); return; }
      D.down = false;
      D.coach.state = 'dcoach';
      D.coach.ch.setLabel(D.coach.name, '🕺 مربی رقص', '#ff4da6');
      if (D.state !== 'next') { D.state = 'show'; D.i = 0; D.t = 0.6; this.drawDance(); }
    }
    const c = D.coach.ch;
    const pp = this.player.ch.root.position;
    const cp = c.root.position;
    const far = Math.hypot(pp.x - cp.x, pp.z - cp.z);
    if (far > 22) { this.endDanceOff(null); this.toast('🕺 از مربی دور شدی؛ رقص تموم شد.', 'warn'); return; }
    // cartwheels carry you off: between rounds the coach comes over again
    if (far > 5 && D.state === 'next' && !c.busy) this.placeCoach(D);
    if (!c.busy) c.root.rotation.y = angleLerp(c.root.rotation.y, Math.atan2(pp.x - cp.x, pp.z - cp.z), damp(6, dt));
    D.t -= dt;
    if (D.state === 'next') {
      if (D.t <= 0) {
        D.round++;
        const len = D.round + 1;
        D.seq = [];
        const pool = DANCE_POOL.filter((id) => MOVE_BY_ID[id] && ANIMS[id]);
        for (let k = 0; k < len; k++) {
          let id;
          do id = pick(pool); while (id === D.seq[D.seq.length - 1]);
          D.seq.push(id);
        }
        D.state = 'show';
        D.i = 0;
        D.t = 0.3;
        this.drawDance();
      }
    } else if (D.state === 'show') {
      if (D.t <= 0 && !c.busy && c.grounded) {
        if (D.i < D.seq.length) {
          c.play(D.seq[D.i]);
          this.drawDance();
          D.i++;
          D.t = 0.25;
        } else {
          D.state = 'copy';
          D.i = 0;
          D.t = 8 + D.seq.length * 3.5;
          this.say(D.coach, pick(COACH_LINES));
          Sfx.play('go');
          this.drawDance();
        }
      }
    } else if (D.state === 'copy') {
      if (Math.floor(D.t + dt) !== Math.floor(D.t)) this.drawDance();
      if (D.t <= 0) { this.say(D.coach, 'وقت تموم شد!'); this.endDanceOff(false); }
    }
  },

  /** You finished an emote: is it the next one in the coach's line? */
  danceStep(m) {
    const D = this.danceOff;
    if (!D || D.state !== 'copy' || this.world !== D.w) return;
    if (m.id !== D.seq[D.i]) {
      this.say(D.coach, `نه! «${MOVE_BY_ID[D.seq[D.i]].name}» بود.`);
      this.endDanceOff(false);
      return;
    }
    D.i++;
    Sfx.play('success');
    this.floatText(`✅ ${fa(D.i)}/${fa(D.seq.length)}`, 'fl-combo');
    if (D.i < D.seq.length) { this.drawDance(); return; }
    // round won
    D.got = D.round;
    const coins = 15 * D.round;
    this.addCoins(coins, true);
    this.gainXp(Math.round(40 * D.round * this.mult()));
    if (D.round >= 5) { this.endDanceOff(true); return; }
    this.say(D.coach, pick(['آفرین!', 'عالی بود!', 'بریم دور بعد!', 'ایول!']));
    D.coach.ch.play('e_clap');
    D.state = 'next';
    D.t = 1.6;
    this.drawDance();
  },

  endDanceOff(won) {
    const D = this.danceOff;
    if (!D) return;
    this.danceOff = null;
    $('dancePanel').hidden = true;
    const n = D.coach;
    if (n.state === 'dcoach') {
      n.state = 'idle';
      n.timer = rand(1, 2);
      if (n.sayT > 0) n.sayT = Math.min(n.sayT, 2.5); else n.ch.setLabel(n.name, 'سطح ' + fa(n.level), '#7fe0ff');
    }
    if (won === null) return;
    const st = this.save.stats;
    st.danceBest = Math.max(st.danceBest || 0, D.got);
    if (won) {
      st.danceAll = (st.danceAll || 0) + 1;
      this.addCoins(200);
      this.confetti();
      this.victoryDance(300);
      if (n.ch.grounded) { n.ch.stopAction(); n.ch.play('e_victory'); }
      this.showBanner('هر ۵ دور رو بردی! 🪙 ۲۰۰ جایزه', '🕺 رقصنده‌ی حرفه‌ای!');
    } else {
      Sfx.play('fail');
      this.showBanner(D.got ? `${fa(D.got)} دور رو بردی • رکورد: ${fa(st.danceBest)}` : 'دفعه‌ی بعد بهتر می‌شه!', '🕺 رقص تموم شد');
    }
    this.checkAchievements();
    this.persist();
  },

  goArcade() {
    this.closeModal('menuModal');
    if (this.world !== this.gym) { this.toast('بسکتبال و توپ انسانی ته پیست نینجای باشگاه اوله؛ اول برگرد باشگاه.', 'warn'); return; }
    this.quickTravel(106, -6);
    if (this.world === this.gym && !this.race && !this.arm && !this.build && !this.photo) this.toast('🏀 برو جلوی حلقه و «پرتاب» رو بزن؛ 💥 توپ انسانی هم پشت سرته (سمت غرب).', 'gold');
  },

  /* ---------- every frame ---------- */

  tickFun6(dt) {
    const g = this.gym;
    if (g && !g.arcade) this.buildArcade(g);
    this.tickFreeze(dt);
    this.tickMeter(dt);
    this.tickShot(dt);
    this.tickCannon(dt);
    this.tickPinata(dt);
    this.tickDanceOff(dt);
  },
});

/* ---------- hooks into what is already there ---------- */

const _usePower6 = Game.usePower;
Game.usePower = function (id) {
  // no powers while you are sitting in the cannon, flying out of it or lining up a shot
  if (this.cannon || this.meter) return;
  if (id === 'freeze') { this.startFreeze(); return; }
  _usePower6.call(this, id);
};

const _quickTravel6 = Game.quickTravel;
Game.quickTravel = function (x, z, special) {
  if (this.cannon && this.cannon.state === 'fly') { this.closeModal('qtModal'); this.toast('وسط پرواز نمی‌شه جابه‌جا شد! 💥', 'warn'); return; }
  if (this.dodge || this.hunt) { this.closeModal('qtModal'); this.toast('وسط بازی جاخالی یا شکار ستاره نمی‌شه جابه‌جا شد!', 'warn'); return; }
  this.cancelMeter();
  this.endDanceOff(null);
  _quickTravel6.call(this, x, z, special);
};

const _startRace6 = Game.startRace;
Game.startRace = function () {
  if (this.gym && this.gym.boss && this.world === this.gym) { this.toast('🐉 با غول توی باشگاه نمی‌شه مسابقه داد؛ اول شکستش بده!', 'warn'); return; }
  if (this.cannon || this.meter || this.danceOff || this.dodge || this.lava) { this.toast('اول کاری که می‌کنی رو تموم کن.', 'warn'); return; }
  _startRace6.call(this);
};

const _input6 = Game.input;
Game.input = function () {
  const r = _input6.call(this);
  if (this.lockMove) { r.enabled = false; r.jump = false; }
  return r;
};

const _ctx6 = Game.contextAction;
Game.contextAction = function () {
  if (this.meter) return this.arcadeAction();
  if (this.cannon) return null;
  const a = this.arcadeAction();
  return a || _ctx6.call(this);
};

const _emoteDone6 = Game.emoteDone;
Game.emoteDone = function (m) {
  _emoteDone6.call(this, m);
  this.danceStep(m);
};

const _startDisco6 = Game.startDisco;
Game.startDisco = function (byHand) {
  _startDisco6.call(this, byHand);
  if (this.disco && !this.disco.pinata) this.addPinata(this.disco);
};

const _endDisco6 = Game.endDisco;
Game.endDisco = function (done) {
  const D = this.disco;
  if (D) this.removePinata(D);
  _endDisco6.call(this, done);
};

/* the frozen and the dance coach stand still; the game moves them */
Object.assign(WorldBase.prototype, {
  frozenNpc() { return [0, 0, 0]; },
  dcoachNpc(n) {
    if (Game.danceOff && Game.danceOff.coach === n) return [0, 0, 0];
    n.state = 'idle';
    n.timer = 1;
    return [0, 0, 0];
  },
});

/* the meter and dance panels' own buttons */
$('meterCancel').addEventListener('click', (e) => { e.stopPropagation(); Game.cancelMeter(); });
$('meterBar').addEventListener('pointerdown', (e) => { e.preventDefault(); Game.lockMeter(); });
$('danceCancel').addEventListener('click', () => { if (Game.danceOff) { Game.endDanceOff(null); Game.toast('🕺 رقص با مربی تموم شد.'); } });

/* no exercises or emotes while you are lining up a shot or sitting in the cannon */
const _onMove6 = Game.onMove;
Game.onMove = function (m) {
  if (this.meter || this.cannon) { Sfx.play('error'); return; }
  _onMove6.call(this, m);
};

/* a double-strength drink you paid for lasts through a reload */
Object.defineProperty(Game, 'drinkUntil', {
  get() { return (this.save && this.save.drinkUntil) || 0; },
  set(v) { if (this.save) this.save.drinkUntil = v; },
  configurable: true,
});
