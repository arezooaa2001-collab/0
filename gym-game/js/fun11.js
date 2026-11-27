'use strict';
/*
 * Round seventeen: a carnival shooting gallery (tap or click the moving ducks), a strongman
 * truck pull in the running hall, a magnet power that pulls every coin and gem in, a selfie and
 * a swim on the floor, and people who wave and say hello as you pass.
 */

POWERS.push({ id: 'magnet', name: 'آهن‌ربای غول', icon: '🧲', level: 420, cd: 40, xp: 60, key: '\\' });
for (const p of POWERS) POWER_BY_ID[p.id] = p;

const EMOTES11 = [['e_selfie', 'سلفی', '🤳'], ['e_swim', 'شنای خشکی', '🏊']]
  .map(([id, name, icon]) => ({ id, name, icon, level: 1, cat: 'fun', emote: true }));
MOVES.push(...EMOTES11);
for (const e of EMOTES11) MOVE_BY_ID[e.id] = e;
if (typeof DANCE_POOL !== 'undefined') DANCE_POOL.push('e_selfie', 'e_swim');

Object.assign(EXTRA_PROPS, {
  phone(ch, pr) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.012), new THREE.MeshStandardMaterial({ color: '#15161c', roughness: 0.3, metalness: 0.5 }));
    m.position.set(0, -0.09, 0.03);
    m.rotation.x = 0.2;
    ch.B.haR.add(m);
    pr.meshes.push(m);
  },
  blaster(ch, pr) {
    const b = new Batch();
    b.box(0.07, 0.09, 0.3, 0, -0.05, 0.12, '#ff4da6');
    b.cyl(0.025, 0.14, 0, -0.03, 0.32, '#ffd34d', Math.PI / 2, 0, 0);
    b.box(0.04, 0.12, 0.05, 0, -0.12, 0.04, '#2f9bff');
    const m = new THREE.Mesh(mergeParts(b.parts, false), MATTE_MAT);
    ch.B.haR.add(m);
    pr.meshes.push(m);
  },
});

Object.assign(ANIMS, {
  e_selfie: {
    dur: 3.0,
    props: ['phone'],
    events: [[0.5, 'snap'], [0.8, 'snap']],
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.1)) * (1 - smooth(seg(t, 0.9, 1)));
      const q = makePose();
      // phone up at arm's length, a peace sign with the other hand, a little head tilt
      q.shRX = -2.1; q.shRZ = -0.45; q.elR = -0.35;
      q.shLX = -2.6; q.shLZ = 0.55; q.elL = -2.1;
      q.nkY = -0.35; q.nkX = -0.2; q.spZ = 0.12; q.bz = Math.sin(t * TAU * 1.5) * 0.04;
      q.hpLX = -0.15; q.knL = 0.25;
      mixInto(p, q, k);
    },
  },
  e_swim: {
    dur: 3.4,
    events: [[0.12, 'land']],
    fn(p, t) {
      const down = smooth(seg(t, 0, 0.12)) * (1 - smooth(seg(t, 0.88, 1)));
      const a = t * 3.4 * TAU * 0.9;
      const q = makePose();
      // flat on the belly, front crawl: arms windmill, legs flutter
      q.bx = 1.5 * down; q.y = -0.76 * down;
      q.shLX = -1.6 + Math.sin(a) * 1.6; q.shRX = -1.6 - Math.sin(a) * 1.6;
      q.elL = q.elR = -0.3;
      q.hpLX = 0.15 * Math.sin(a * 3); q.hpRX = -0.15 * Math.sin(a * 3);
      q.knL = q.knR = 0.15;
      q.nkY = Math.sin(a) > 0.7 ? 0.6 : 0; q.nkX = -0.5;
      mixInto(p, q, Math.max(down, 0.001));
      p.bx = q.bx; p.y = q.y;
    },
  },
});

ACHIEVEMENTS.push(
  { id: 'gallery', name: 'تیرانداز شهربازی', icon: '🦆', desc: 'یه دور توی تیراندازی شهربازی بازی کن', test: (s) => (s.stats.galleryRounds || 0) >= 1 },
  { id: 'sharpshooter', name: 'تک‌تیرانداز', icon: '🎯', desc: 'توی تیراندازی شهربازی ۲۵۰ امتیاز بگیر', test: (s) => (s.stats.galleryBest || 0) >= 250 },
  { id: 'truck', name: 'مرد آهنین', icon: '🚚', desc: 'کامیون رو ۲۰ متر بکش', test: (s) => (s.stats.truckPulls || 0) >= 1 },
  { id: 'truckfast', name: 'هرکول', icon: '💪', desc: 'کامیون رو زیر ۱۲ ثانیه بکش', test: (s) => (s.stats.truckBest || 99) <= 12 },
  { id: 'magnet', name: 'آهن‌ربا', icon: '🧲', desc: 'با آهن‌ربای غول ۱۰ سکه یه‌جا جمع کن', test: (s) => (s.stats.magnetBest || 0) >= 10 },
);

const GALLERY = { x: 118, z: -30.2, standZ: -24.8, w: 14 };
const TRUCK = { x0: 140, z: -10, goal: 20 };
GYM_SPOTS.push(['🦆', 'تیراندازی شهربازی', GALLERY.x, GALLERY.standZ + 1.2], ['🚚', 'کشیدن کامیون', TRUCK.x0 + 5, TRUCK.z + 2]);

function duckTexture(kind) {
  return makeCanvasTexture(128, 128, (ctx, w, h) => {
    ctx.translate(w / 2, h / 2);
    if (kind === 'bomb') {
      ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(0, 8, 42, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e63946'; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✕', 0, 10);
      ctx.strokeStyle = '#c0a060'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(20, -30); ctx.quadraticCurveTo(40, -55, 30, -60); ctx.stroke();
      return;
    }
    const body = kind === 'gold' ? '#ffd34d' : '#ffe26b';
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 18, 46, 30, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(22, -18, 24, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff7b00'; ctx.beginPath(); ctx.moveTo(42, -18); ctx.lineTo(62, -12); ctx.lineTo(42, -6); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(28, -22, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = kind === 'gold' ? '#e6a800' : '#f0c040'; ctx.beginPath(); ctx.ellipse(-8, 18, 22, 12, -0.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#e63946'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 60, 0, TAU); ctx.stroke();
    if (kind === 'gold') { ctx.fillStyle = '#fff'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('×3', -10, 26); }
  });
}

Object.assign(Game, {
  /* ---------- building ---------- */

  buildFun11(g) {
    g.fun11 = true;
    const add = (m, solid) => { if (!solid) m.userData.noSolid = true; g.scene.add(m); return m; };
    const G = GALLERY;
    // the booth: a striped back wall, a roof, a counter in front
    const back = add(new THREE.Mesh(new THREE.BoxGeometry(G.w + 1, 3.6, 0.3), new THREE.MeshStandardMaterial({
      map: makeCanvasTexture(512, 128, (ctx, w, h) => { for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 2 ? '#e63946' : '#fff4dc'; ctx.fillRect((i * w) / 16, 0, w / 16 + 1, h); } ctx.fillStyle = 'rgba(16,20,42,0.55)'; ctx.fillRect(0, h * 0.18, w, h * 0.64); }),
      roughness: 0.8,
    })), true);
    back.position.set(G.x, 1.8, G.z - 0.3);
    const roof = add(new THREE.Mesh(new THREE.BoxGeometry(G.w + 1.6, 0.25, 2.6), new THREE.MeshStandardMaterial({ color: '#ffd34d', roughness: 0.6 })));
    roof.position.set(G.x, 3.75, G.z + 0.9);
    for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.75, 0.18), new THREE.MeshStandardMaterial({ color: '#e63946' })), true).position.set(G.x + s * (G.w / 2 + 0.6), 1.87, G.z + 2.1);
    const counter = add(new THREE.Mesh(new THREE.BoxGeometry(G.w, 1.0, 0.5), new THREE.MeshStandardMaterial({ color: '#2f6fed', roughness: 0.6 })), true);
    counter.position.set(G.x, 0.5, G.standZ - 1.0);
    // two rails the ducks ride on
    for (const y of [1.45, 2.55]) add(new THREE.Mesh(new THREE.BoxGeometry(G.w, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: '#9aa0a8', metalness: 0.6 }))).position.set(G.x, y - 0.38, G.z + 0.05);
    g.galleryTex = { duck: duckTexture('duck'), gold: duckTexture('gold'), bomb: duckTexture('bomb') };
    this.hangSign(g, 'تیراندازی شهربازی 🦆', '#ff4da6', G.x, 5.8, G.z + 2.4, 4.6);

    // the truck at the start of its lane in the running hall
    const T = TRUCK;
    const truck = new THREE.Group();
    const b = new Batch();
    b.box(2.0, 1.2, 3.6, 0, 1.0, -0.4, '#e63946');
    b.box(2.0, 1.1, 1.5, 0, 1.25, 2.05, '#c0392b');
    b.box(1.8, 0.55, 0.05, 0, 1.45, 2.81, '#9fd3ff');
    b.box(2.1, 0.3, 0.2, 0, 0.55, 2.85, '#9aa0a8');
    b.box(0.3, 0.18, 0.06, 0.7, 0.85, 2.86, '#ffe26b');
    b.box(0.3, 0.18, 0.06, -0.7, 0.85, 2.86, '#ffe26b');
    truck.add(new THREE.Mesh(mergeParts(b.parts, false), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25 })));
    const wheels = [];
    for (const [x, z] of [[1.05, 1.9], [-1.05, 1.9], [1.05, -1.3], [-1.05, -1.3]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16), new THREE.MeshStandardMaterial({ color: '#15161c', roughness: 0.9 }));
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.42, z);
      truck.add(w);
      wheels.push(w);
    }
    truck.rotation.y = Math.PI / 2; // nose towards +x, the way it is pulled
    truck.position.set(T.x0, 0, T.z);
    truck.traverse((o) => { o.userData.noSolid = true; });
    g.scene.add(truck);
    g.truck = truck;
    g.truckWheels = wheels;
    // the finish line 20 m on
    const fin = add(new THREE.Mesh(new THREE.PlaneGeometry(0.4, 4), new THREE.MeshBasicMaterial({ color: '#ffd34d' })));
    fin.rotation.x = -Math.PI / 2;
    fin.position.set(T.x0 + 3 + T.goal, 0.015, T.z);
    this.hangSign(g, 'کشیدن کامیون 🚚', '#ffd34d', T.x0 + 10, 5.6, T.z - 2.6, 4.4);
    g.solids = null;
  },

  nearGallery() {
    const p = this.player.ch.root.position;
    return Math.abs(p.x - GALLERY.x) < GALLERY.w / 2 && p.z > GALLERY.standZ - 0.8 && p.z < GALLERY.standZ + 2.5;
  },
  nearTruck() {
    const p = this.player.ch.root.position;
    return Math.hypot(p.x - (TRUCK.x0 + 4), p.z - TRUCK.z) < 2.6;
  },

  /* ---------- the shooting gallery ---------- */

  startGallery() {
    if (!this.arcadeFree() || !this.nearGallery()) return;
    if (this.loop) this.stopLoop(true);
    const P = this.player;
    if (P.board) this.endBoard();
    if (P.jet) this.endJet();
    if (this.clones) this.endClones();
    if (this.morph) { this.morph = null; P.ch.root.scale.setScalar(1); }
    P.ch.stopAction();
    P.ch.manual = true;
    P.ch.manualSnap = false;
    P.ch.showProp('blaster', true);
    this.gallery = { t: 30, score: 0, hits: 0, shots: 0, targets: [], spawnT: 0.2, aimYaw: Math.PI, kick: 0 };
    this.follow(new THREE.Vector3(GALLERY.x, 1.7, GALLERY.z + 3), 7.8, 0, 0.12);
    $('galleryPanel').hidden = false;
    Sfx.play('whistle');
    this.toast('🦆 روی اردک‌ها بزن (کلیک یا لمس صفحه). اردک طلایی ۳ برابر؛ به بمب ✕ نزن!', 'gold');
  },

  spawnTarget() {
    const G = this.gallery;
    const g = this.gym;
    const r = Math.random();
    const kind = r < 0.12 ? 'gold' : r < 0.27 ? 'bomb' : 'duck';
    const row = Math.random() < 0.5 ? 0 : 1;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const m = new THREE.Mesh(this.duckGeo || (this.duckGeo = new THREE.CircleGeometry(0.42, 24)), new THREE.MeshBasicMaterial({ map: g.galleryTex[kind], transparent: true, side: THREE.DoubleSide }));
    m.userData.noSolid = true;
    m.scale.x = dir;
    const x = GALLERY.x - dir * (GALLERY.w / 2 - 0.5);
    m.position.set(x, [1.45, 2.55][row], GALLERY.z + 0.12);
    g.scene.add(m);
    G.targets.push({ m, kind, dir, v: rand(2.2, 3.6) * (1 + (30 - G.t) / 40), wob: rand(0, TAU), hit: false, fall: 0 });
  },

  /** A tap on the screen: a ray from the camera; the first duck it meets is hit. */
  shootAt(clientX, clientY) {
    const G = this.gallery;
    if (!G || G.t <= 0 || this.modals.size) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = this.galleryRay || (this.galleryRay = new THREE.Raycaster());
    ray.setFromCamera(ndc, this.camera);
    G.shots++;
    G.kick = 1;
    Sfx.play('punch');
    const live = G.targets.filter((T) => !T.hit);
    const hits = ray.intersectObjects(live.map((T) => T.m), false);
    // turn the blaster to where you shot
    const aim = new THREE.Vector3();
    ray.ray.at(10, aim);
    const pp = this.player.ch.root.position;
    G.aimYaw = Math.atan2(aim.x - pp.x, aim.z - pp.z);
    if (!hits.length) {
      const pt = new THREE.Vector3();
      if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -(GALLERY.z - 0.14)), pt)) this.world.fx.burst({ x: pt.x, y: pt.y, z: pt.z + 0.1 }, { count: 8, colors: ['#ffffff', '#cfd6e3'], speed: 1.5, up: 0.5, life: 0.4 });
      G.combo = 0;
      return;
    }
    const T = live.find((x) => x.m === hits[0].object);
    T.hit = true;
    const p = T.m.position;
    if (T.kind === 'bomb') {
      G.score = Math.max(0, G.score - 30);
      G.combo = 0;
      this.world.fx.burst({ x: p.x, y: p.y, z: p.z + 0.2 }, { count: 40, colors: ['#1a1a1a', '#ff7b00', '#ffd34d'], speed: 5, up: 1, life: 0.7 });
      Sfx.play('boom');
      this.floatText('💣 ‎-۳۰', '');
      return;
    }
    G.combo = (G.combo || 0) + 1;
    const pts = (T.kind === 'gold' ? 30 : 10) + Math.min(10, (G.combo - 1) * 2);
    G.score += pts;
    G.hits++;
    this.world.fx.burst({ x: p.x, y: p.y, z: p.z + 0.2 }, { count: T.kind === 'gold' ? 36 : 18, colors: T.kind === 'gold' ? ['#ffd34d', '#ffffff', '#ff7b00'] : ['#ffe26b', '#ffffff'], speed: 3.5, up: 1, life: 0.6 });
    Sfx.play(T.kind === 'gold' ? 'coin' : 'tap');
    this.floatText(`🦆 +${fa(pts)}${G.combo >= 3 ? ` (${fa(G.combo)} پشت سر هم)` : ''}`, T.kind === 'gold' || G.combo >= 3 ? 'fl-combo' : '');
  },

  tickGallery(dt) {
    const G = this.gallery;
    if (!G) return;
    const g = this.gym;
    if (this.world !== g || this.mode !== 'play' || this.race || this.arm) { this.endGallery(null); return; }
    const P = this.player;
    const ch = P.ch;
    ch.root.position.set(clamp(ch.root.position.x, GALLERY.x - 3, GALLERY.x + 3), 0, GALLERY.standZ);
    ch.root.rotation.y = angleLerp(ch.root.rotation.y, G.aimYaw, damp(12, dt));
    P.vel.set(0, 0);
    const pose = ch.manualPose;
    copyPose(pose, STAND);
    G.kick = Math.max(0, G.kick - dt * 8);
    pose.shRX = -1.55 + G.kick * 0.25; pose.elR = -0.1; pose.shLX = -1.45; pose.shLZ = -0.35; pose.elL = -0.4;
    pose.spY = 0.12; pose.nkX = 0.05; pose.hpLX = -0.25; pose.knL = 0.2;
    if (this.modals.size || this.watch || this.photo) return;
    G.t -= dt;
    G.spawnT -= dt;
    if (G.spawnT <= 0 && G.t > 0.5) { G.spawnT = rand(0.35, 0.8) * (G.t > 15 ? 1 : 0.75); this.spawnTarget(); }
    for (let i = G.targets.length - 1; i >= 0; i--) {
      const T = G.targets[i];
      const m = T.m;
      if (T.hit) {
        // flipped over backwards and gone
        T.fall += dt * 6;
        m.rotation.x = -Math.min(Math.PI / 2, T.fall);
        if (T.fall > 2) { m.removeFromParent(); m.material.dispose(); G.targets.splice(i, 1); }
        continue;
      }
      m.position.x += T.dir * T.v * dt;
      m.position.y += Math.sin(this.clock * 6 + T.wob) * 0.004;
      if (Math.abs(m.position.x - GALLERY.x) > GALLERY.w / 2 - 0.3) { m.removeFromParent(); m.material.dispose(); G.targets.splice(i, 1); }
    }
    this.setText('galleryHead', `🦆 ${fa(G.score)} امتیاز · ⏱️ ${fa(Math.max(0, Math.ceil(G.t)))}`);
    if (G.t <= 0) this.endGallery(true);
  },

  endGallery(done) {
    const G = this.gallery;
    if (!G) return;
    this.gallery = null;
    $('galleryPanel').hidden = true;
    this.unfollow(true);
    for (const T of G.targets) { T.m.removeFromParent(); T.m.material.dispose(); }
    const P = this.player;
    if (P) { P.ch.showProp('blaster', false); if (!P.board) P.ch.manual = false; }
    if (!done) return;
    const st = this.save.stats;
    st.galleryRounds = (st.galleryRounds || 0) + 1;
    const best = G.score > (st.galleryBest || 0);
    st.galleryBest = Math.max(st.galleryBest || 0, G.score);
    const coins = Math.min(80, Math.round(G.score / 5));
    if (coins) this.addCoins(coins, true);
    this.gainXp(Math.round(G.score * 1.5 * this.mult()));
    const acc = G.shots ? Math.round((G.hits / G.shots) * 100) : 0;
    this.showBanner(`${fa(G.hits)} اردک · دقت ${fa(acc)}٪ · ${fa(coins)} سکه${best ? ' · رکورد!' : ''}`, `🦆 ${fa(G.score)} امتیاز`);
    if (G.score >= 200) { this.confetti(); Sfx.play('cheer'); }
    this.checkAchievements();
    this.persist();
  },

  /* ---------- the truck pull ---------- */

  startTruck() {
    if (!this.arcadeFree() || !this.nearTruck()) return;
    if (this.loop) this.stopLoop(true);
    const P = this.player;
    if (P.board) this.endBoard();
    if (P.jet) this.endJet();
    if (this.clones) this.endClones();
    if (this.morph) { this.morph = null; P.ch.root.scale.setScalar(1); }
    P.ch.stopAction();
    P.ch.manual = true;
    P.ch.manualSnap = false;
    const g = this.gym;
    g.truck.position.set(TRUCK.x0, 0, TRUCK.z);
    this.truck = { t: 0, x: 0, v: 0, force: 0, count: 2.4, taps: [], phase: 0 };
    if (!this.ropeMesh) {
      this.ropeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#c8a060', roughness: 0.9 }));
      this.ropeMesh.userData.noSolid = true;
    }
    g.scene.add(this.ropeMesh);
    $('truckPanel').hidden = false;
    // from the side, a little ahead: the puller in front, the truck coming behind
    this.follow(null, 9.5, 0.55, 0.28);
    this.camFollow = null;
    g.gatherFans(TRUCK.x0 + 10, TRUCK.z + 3, 18, 6, 40, 'fanclap');
    Sfx.play('whistle');
    this.toast('🚚 دکمه‌ی «بکش!» رو تند تند بزن (یا فاصله). ۲۰ متر تا خط زرد!', 'gold');
  },

  pullTruck() {
    const T = this.truck;
    if (!T || T.count > 0 || T.done || this.modals.size) return;
    // fast taps pull harder, but there is a limit to how fast a body can heave
    const now = this.clock;
    T.taps = T.taps.filter((t) => now - t < 1);
    T.taps.push(now);
    const rate = Math.min(T.taps.length, 9);
    T.force = Math.min(1, T.force + 0.09 + rate * 0.012);
    T.heave = 1;
    Sfx.play('tap');
  },

  tickTruck(dt) {
    const T = this.truck;
    if (!T) return;
    const g = this.gym;
    if (this.world !== g || this.mode !== 'play' || this.race || this.arm) { this.endTruck(null); return; }
    const P = this.player;
    const ch = P.ch;
    const paused = this.modals.size || this.watch || this.photo;
    if (!paused) {
      if (T.count > 0) {
        const before = Math.ceil(T.count);
        T.count -= dt;
        if (Math.ceil(T.count) !== before) Sfx.play(T.count <= 0 ? 'go' : 'tick');
      } else if (!T.done) {
        T.t += dt;
        // the truck moves when the pull beats the friction; it rolls on a little when you ease off
        T.force = Math.max(0, T.force - dt * 0.75);
        const pull = Math.max(0, T.force - 0.28) * 2.6;
        T.v += (pull - T.v * 0.9) * dt * 2.5;
        T.v = Math.max(0, T.v);
        T.x += T.v * dt;
        if (T.x >= TRUCK.goal) this.finishTruck();
      }
    }
    T.heave = Math.max(0, (T.heave || 0) - dt * 5);
    const tx = TRUCK.x0 + T.x;
    g.truck.position.x = tx;
    for (const w of g.truckWheels) w.rotation.x += (T.v / 0.42) * dt;
    if (T.v > 0.3 && Math.random() < dt * 10) this.world.fx.emit(tx - 1.6, 0.1, TRUCK.z + rand(-1, 1), rand(-0.5, 0), rand(0.3, 0.8), rand(-0.3, 0.3), new THREE.Color('#cdbfa6'), 0.6, 0.5);
    // the puller: harness rope over the shoulder, leaning hard into it, feet digging in
    const px = tx + 3.4 + T.force * 0.35;
    ch.root.position.set(px, 0, TRUCK.z);
    ch.root.rotation.y = Math.PI / 2;
    P.vel.set(0, 0);
    T.phase += dt * (2 + T.v * 3);
    const pose = ch.manualPose;
    copyPose(pose, STAND);
    const lean = 0.25 + T.force * 0.55 + T.heave * 0.15;
    pose.bx = lean * 0.6; pose.spX = lean * 0.5;
    const st = Math.sin(T.phase);
    pose.hpLX = -0.6 + 0.35 * st; pose.knL = 0.7 - 0.3 * st; pose.hpRX = 0.35 - 0.35 * st; pose.knR = 0.3 + 0.3 * st;
    pose.shLX = -1.0; pose.shRX = -0.8; pose.elL = -1.6; pose.elR = -1.4; pose.shLZ = 0.35; pose.shRZ = -0.25;
    pose.nkX = -0.3; pose.y = -0.1 * lean;
    // the rope from the waist back to the truck's nose
    ch.root.updateMatrixWorld(true);
    const a = new THREE.Vector3(px - 0.2, 1.0, TRUCK.z), b = new THREE.Vector3(tx + 2.9, 0.7, TRUCK.z);
    const r = this.ropeMesh;
    r.position.copy(b);
    r.scale.set(1, a.distanceTo(b), 1);
    r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.clone().sub(b).normalize());
    this.setText('truckHead', T.count > 0 ? `🚚 آماده… ${fa(Math.ceil(T.count))}` : `🚚 ${fa(Math.min(TRUCK.goal, T.x).toFixed(1))} از ${fa(TRUCK.goal)} متر · ⏱️ ${fa(T.t.toFixed(1))}`);
    $('truckForce').style.width = `${Math.round(T.force * 100)}%`;
    if (T.done) { T.doneT -= dt; if (T.doneT <= 0) this.endTruck(true); }
    else if (T.t > 45) this.finishTruck(true);
  },

  finishTruck(timeout) {
    const T = this.truck;
    T.done = true;
    T.doneT = 2.5;
    const st = this.save.stats;
    if (timeout) {
      this.showBanner(`${fa(T.x.toFixed(1))} متر کشیدی`, '🚚 وقت تموم شد');
      Sfx.play('fail');
      this.gainXp(Math.round(T.x * 8 * this.mult()));
      return;
    }
    st.truckPulls = (st.truckPulls || 0) + 1;
    const best = T.t < (st.truckBest || 99);
    st.truckBest = Math.min(st.truckBest || 99, Math.round(T.t * 10) / 10);
    const coins = T.t < 12 ? 60 : T.t < 18 ? 35 : 15;
    this.addCoins(coins, true);
    this.gainXp(Math.round((300 - Math.min(250, T.t * 8)) * this.mult()));
    this.showBanner(`${fa(T.t.toFixed(1))} ثانیه · ${fa(coins)} سکه${best ? ' · رکورد!' : ''}`, '🚚 کامیون رسید!');
    this.confetti();
    Sfx.play('cheer');
    this.player.ch.manual = false;
    this.player.ch.play('e_flex');
    this.checkAchievements();
    this.persist();
  },

  endTruck(done) {
    const T = this.truck;
    if (!T) return;
    this.truck = null;
    $('truckPanel').hidden = true;
    this.unfollow(true);
    if (this.ropeMesh) this.ropeMesh.removeFromParent();
    const g = this.gym;
    if (g && g.truck) g.truck.position.set(TRUCK.x0, 0, TRUCK.z);
    const P = this.player;
    if (P && !P.board && !P.ch.busy) P.ch.manual = false;
    if (P && this.world === g) {
      const p = P.ch.root.position;
      p.set(p.x, 0, TRUCK.z + 2);
    }
  },

  /* ---------- the magnet ---------- */

  startMagnet() {
    const pw = POWER_BY_ID.magnet;
    if (this.mode !== 'play' || this.modals.size || this.race || this.arm || this.photo || this.build) return;
    if (!this.powerUnlocked(pw)) { Sfx.play('error'); this.toast(`🔒 قدرت «${pw.name}» در سطح ${fa(pw.level)} باز می‌شه.`, 'warn'); return; }
    if (this.powerCd.magnet > 0 || this.magnetT > 0 || this.cannon || this.meter || this.lockMove) return;
    this.magnetT = 9;
    this.magnetGot = 0;
    this.powerCd.magnet = pw.cd;
    this.save.stats.powers++;
    this.missionProgress('power', 1);
    // a big horseshoe magnet hovering over your head
    if (!this.magnetMesh) {
      const g = new THREE.Group();
      const red = new THREE.MeshStandardMaterial({ color: '#e63946', roughness: 0.35, metalness: 0.3 });
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.09, 10, 24, Math.PI), red);
      arc.rotation.z = Math.PI;
      g.add(arc);
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 12), red);
        leg.position.set(s * 0.28, 0.11, 0);
        g.add(leg);
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.1, 12), new THREE.MeshStandardMaterial({ color: '#d5dce6', metalness: 0.8, roughness: 0.25 }));
        tip.position.set(s * 0.28, 0.27, 0);
        g.add(tip);
      }
      g.traverse((o) => { o.userData.noSolid = true; });
      this.magnetMesh = g;
    }
    this.world.scene.add(this.magnetMesh);
    Sfx.play('charge');
    this.showBanner('همه‌ی سکه‌ها و الماس‌ها میان پیشت!', '🧲 آهن‌ربای غول');
    this.gainXp(Math.round(pw.xp * this.mult()));
    this.refreshPowers();
  },

  tickMagnet(dt) {
    if (!(this.magnetT > 0)) return;
    if (this.mode !== 'play' || !this.world) { this.magnetT = 0; if (this.magnetMesh) this.magnetMesh.removeFromParent(); return; }
    if (!(this.modals.size || this.watch || this.photo)) this.magnetT -= dt;
    const M = this.magnetMesh;
    if (M.parent !== this.world.scene) this.world.scene.add(M);
    const ch = this.player.ch;
    const p = ch.root.position;
    M.position.set(p.x, (p.y || 0) + ch.airY + 2.5 * ch.root.scale.y + Math.sin(this.clock * 4) * 0.08, p.z);
    M.rotation.y += dt * 3;
    if (Math.random() < dt * 30) {
      const a = rand(0, TAU), r = rand(3, 9);
      this.world.fx.emit(p.x + Math.cos(a) * r, rand(0.3, 1.8), p.z + Math.sin(a) * r, -Math.cos(a) * r * 1.2, rand(0, 0.6), -Math.sin(a) * r * 1.2, new THREE.Color(pick(['#ff9aa2', '#ffffff', '#ffd34d'])), 0.7, 0);
    }
    if (this.magnetT <= 0) {
      M.removeFromParent();
      const st = this.save.stats;
      st.magnetBest = Math.max(st.magnetBest || 0, this.magnetGot || 0);
      if (this.magnetGot) this.floatText(`🧲 ${fa(this.magnetGot)} تا جمع شد!`, 'fl-combo');
      this.checkAchievements();
    }
  },

  /* ---------- people say hello ---------- */

  tickGreetings(dt) {
    if (this.mode !== 'play' || !this.world || this.modals.size) return;
    this.greetT = (this.greetT || 0) - dt;
    if (this.greetT > 0) return;
    this.greetT = 0.5;
    const P = this.player;
    const pp = P.ch.root.position;
    if (P.ch.busy || this.miniBusy() || this.loop) return;
    for (const n of this.world.npcs) {
      if (!['idle', 'walk'].includes(n.state) || n.ch.busy || !n.ch.grounded) continue;
      const q = n.ch.root.position;
      const d = Math.hypot(q.x - pp.x, q.z - pp.z);
      if (d > 3.6 || d < 1) continue;
      if (this.clock < (n.greetT || 0)) continue;
      n.greetT = this.clock + rand(40, 80);
      if (Math.random() < 0.45) continue;
      // they turn to you, wave, and say something
      n.vel.set(0, 0);
      n.ch.root.rotation.y = Math.atan2(pp.x - q.x, pp.z - q.z);
      const lv = this.lv();
      const lines = lv >= 500 ? ['وای! خودِ قهرمانی! 😍', 'یه عکس باهات بگیرم؟ 🤳', 'اسطوره! 👑'] : lv >= 100 ? ['سلام قهرمان! 💪', 'چه زوری داری!', 'منم یه روز مثل تو می‌شم!'] : ['سلام! 👋', 'خسته نباشی!', 'امروز چی تمرین می‌کنی؟', 'بزن بریم! 🔥'];
      const selfie = lv >= 500 && Math.random() < 0.4;
      if (n.ch.play(selfie ? 'e_selfie' : 'e_wave')) this.say(n, pick(lines));
      break;
    }
  },

  /* ---------- the menu ---------- */

  goGallery() {
    this.closeModal('menuModal');
    if (this.world !== this.gym) { this.toast('تیراندازی شهربازی ته پیست نینجای باشگاه اوله؛ اول برگرد باشگاه.', 'warn'); return; }
    this.quickTravel(GALLERY.x, GALLERY.standZ + 1.2);
  },
  goTruck() {
    this.closeModal('menuModal');
    if (this.world !== this.gym) { this.toast('کشیدن کامیون توی تالار دو اوله؛ اول برگرد باشگاه.', 'warn'); return; }
    this.quickTravel(TRUCK.x0 + 4.5, TRUCK.z + 1.5);
  },

  /* ---------- every frame ---------- */

  tickFun11(dt) {
    const g = this.gym;
    if (g && !g.fun11) this.buildFun11(g);
    this.tickGallery(dt);
    this.tickTruck(dt);
    this.tickMagnet(dt);
    this.tickGreetings(dt);
  },
});

/* ---------- hooks into what is already there ---------- */

const _miniBusy11 = Game.miniBusy;
Game.miniBusy = function () { return !!(this.gallery || this.truck) || _miniBusy11.call(this); };

const _usePower11 = Game.usePower;
Game.usePower = function (id) {
  if (id === 'magnet') { if (!this.miniBusy()) this.startMagnet(); return; }
  _usePower11.call(this, id);
};

const _quickTravel11 = Game.quickTravel;
Game.quickTravel = function (x, z, special) {
  if (this.world === this.gym && this.mode === 'play' && !this.race && !this.arm && !this.build && !this.photo) { this.endGallery(null); this.endTruck(null); }
  _quickTravel11.call(this, x, z, special);
};

const _ctx11 = Game.contextAction;
Game.contextAction = function () {
  if (this.truck) return this.truck.count > 0 || this.truck.done ? null : { label: '💪 بکش!', run: () => this.pullTruck() };
  if (this.gallery) return null;
  if (this.world === this.gym && this.gym.fun11 && this.arcadeFree()) {
    if (this.nearGallery()) return { label: '🦆 تیراندازی شهربازی', run: () => this.startGallery() };
    if (this.nearTruck()) return { label: '🚚 کشیدن کامیون', run: () => this.startTruck() };
  }
  return _ctx11.call(this);
};

/* the magnet counts what it brings in */
const _onPickup11 = Game.onPickup;
Game.onPickup = function (it) {
  if (this.magnetT > 0 && it && (it.type === 'coin' || it.type === 'gem')) this.magnetGot = (this.magnetGot || 0) + 1;
  return _onPickup11.call(this, it);
};

const _rebuildPlayer11 = Game.rebuildPlayer;
Game.rebuildPlayer = function (...args) {
  const r = _rebuildPlayer11.apply(this, args);
  if (this.player && (this.gallery || this.truck)) { this.player.ch.manual = true; if (this.gallery) this.player.ch.showProp('blaster', true); }
  return r;
};

/* a selfie: the phone flashes */
const _onCharEvent11 = WorldBase.prototype.onCharEvent;
WorldBase.prototype.onCharEvent = function (e, ch, isPlayer) {
  if (e === 'snap') {
    ch.root.updateMatrixWorld(true);
    ch.B.haR.getWorldPosition(_galleryV);
    this.fx.burst({ x: _galleryV.x, y: _galleryV.y, z: _galleryV.z }, { count: 12, colors: ['#ffffff'], speed: 1.2, up: 0.2, life: 0.25 });
    if (isPlayer) Sfx.play('click');
    return;
  }
  return _onCharEvent11.call(this, e, ch, isPlayer);
};
const _galleryV = new THREE.Vector3();

/* taps on the 3D view shoot in the gallery (instead of turning the camera); the space bar pulls the truck */
window.addEventListener('pointerdown', (e) => {
  if (!Game.gallery || e.target !== Game.renderer.domElement) return;
  e.preventDefault();
  e.stopPropagation();
  Game.shootAt(e.clientX, e.clientY);
}, true);
window.addEventListener('keydown', (e) => {
  if (!Game.truck || e.repeat || (e.code !== 'Space' && e.code !== 'KeyE' && e.code !== 'Enter')) return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  e.preventDefault();
  e.stopPropagation();
  Game.pullTruck();
}, true);
$('galleryCancel').addEventListener('click', () => { if (Game.gallery) { Game.endGallery(null); Game.toast('🦆 تیراندازی تموم شد.'); } });
$('truckCancel').addEventListener('click', () => { if (Game.truck) Game.endTruck(null); });
$('truckPull').addEventListener('pointerdown', (e) => { e.preventDefault(); Game.pullTruck(); });
