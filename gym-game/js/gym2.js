'use strict';
/*
 * The gym's two new 50 m wings. West: live camera wall, hall of fame, trophies, punch machine,
 * reaction wall, spinning class, strongman corner, juice bar, mascot statue, sauna.
 * East: Olympic platforms, rope climb, sprint lane, trampolines, basketball arcade,
 * human-flag poles, DJ booth with a light-up dance floor, body scanner, ice baths, quote board, clock.
 */

const WING = {
  live: { x: -70, y: 5.6, w: 15, h: 8.4 },
  status: { x: -54.5, w: 9 },
  console: { x: -62, z: -26.6 },
  trophy: { x: -46, z: -31.2 },
  fame: { x: -60, z: -15 },
  punch: { x: -46.2, z: -7 },
  reaction: { x: -46.2, z: 0 },
  juice: { x: -60, z: 29.4 },
  spin: { x: -61, z: 6 },
  mascot: { x: -50, z: 20 },
  sprint: { x1: 46, x2: 76, z: -12 },
  dj: { x: 72, z: 24 },
  floor: { x: 63, z: 24, s: 8 },
  scanner: { x: 47, z: 27.5 },
};

const GOLD_OUTFIT = {
  skin: '#d4af37', hair: '#b8901e', shirt: '#e6c35c', accent: '#fff1b0', shorts: '#c79a2a', shoes: '#e6c35c',
  sole: '#fff1b0', socks: '#e6c35c', style: 'tank', band: '#fff1b0', number: false,
};

Object.assign(GymWorld.prototype, {
  /** Points you can walk up to and use; Game.contextAction reads them. */
  addSpot(id, x, z, r, label) {
    if (!this.spots) this.spots = [];
    this.spots.push({ id, x, z, r, label });
  },

  nearSpot() {
    if (!this.spots) return null;
    const p = this.player.ch.root.position;
    let best = null;
    for (const s of this.spots) {
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      if (d < s.r && (!best || d < best.d)) best = { s, d };
    }
    return best && best.s;
  },

  floorPatch(x1, z1, x2, z2, colors, size = 2) {
    const nx = Math.round((x2 - x1) / size);
    const nz = Math.round((z2 - z1) / size);
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        this.matte.box(size - 0.02, 0.025, size - 0.02, x1 + (i + 0.5) * size, 0.013, z1 + (j + 0.5) * size, colors[(i + j) % colors.length]);
      }
    }
  },

  buildWestWing() {
    const m = this.matte;
    const mt = this.metal;
    const glow = this.glow;
    const Z = ROOM.z;
    // live camera wall and the who-is-where board
    const L = WING.live;
    mt.box(L.w + 0.5, L.h + 0.5, 0.12, L.x, L.y, -Z + 0.08, '#0b0f1c');
    glow.box(L.w + 0.7, 0.12, 0.14, L.x, L.y + L.h / 2 + 0.35, -Z + 0.1, '#7fe0ff');
    this.liveRT = new THREE.WebGLRenderTarget(768, 432);
    this.liveRT.texture.encoding = THREE.sRGBEncoding;
    const live = new THREE.Mesh(new THREE.PlaneGeometry(L.w, L.h), new THREE.MeshBasicMaterial({ map: this.liveRT.texture, toneMapped: false }));
    live.position.set(L.x, L.y, -Z + 0.16);
    this.scene.add(live);
    this.liveScreen = live;
    this.liveCaptionTex = makeCanvasTexture(1024, 96, () => {});
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(L.w, L.w * 96 / 1024), new THREE.MeshBasicMaterial({ map: this.liveCaptionTex, transparent: true, toneMapped: false }));
    cap.position.set(L.x, L.y - L.h / 2 + 0.75, -Z + 0.18);
    this.scene.add(cap);
    const S = WING.status;
    mt.box(S.w + 0.4, L.h + 0.5, 0.12, S.x, L.y, -Z + 0.08, '#0b0f1c');
    this.statusTex = makeCanvasTexture(640, 600, () => {});
    const st = new THREE.Mesh(new THREE.PlaneGeometry(S.w, S.w * 600 / 640), new THREE.MeshBasicMaterial({ map: this.statusTex, toneMapped: false }));
    st.position.set(S.x, L.y, -Z + 0.16);
    this.scene.add(st);
    // control desk in front of the screens
    const C = WING.console;
    m.box(4.2, 1.0, 1.0, C.x, 0.5, C.z, '#1d2433');
    m.box(4.3, 0.08, 1.1, C.x, 1.02, C.z, '#3c4250', 0, -0.25);
    for (let i = 0; i < 4; i++) glow.box(0.8, 0.5, 0.04, C.x - 1.5 + i * 1.0, 1.3, C.z - 0.45, ['#7fe0ff', '#2ecc71', '#ffd34d', '#ff4da6'][i]);
    this.addCollider(C.x - 2.1, C.z - 0.5, C.x + 2.1, C.z + 0.5);
    this.addSpot('watch', C.x, C.z + 1.4, 2.4, '📺 دوربین‌های زنده');
    this.zoneSign('دوربین‌های زنده', '#7fe0ff', -62, 9.9, -Z + 0.6, 0, 6);

    // trophy cabinet: a cup for every wrestling stage
    const T = WING.trophy;
    m.box(6.4, 3.0, 0.9, T.x, 1.5, T.z, '#3a2a20');
    m.box(6.0, 2.6, 0.05, T.x, 1.55, T.z + 0.46, '#a8d8ff');
    for (const y of [0.9, 1.9]) m.box(6.0, 0.06, 0.8, T.x, y, T.z, '#5a3a20');
    this.addCollider(T.x - 3.2, T.z - 0.5, T.x + 3.2, T.z + 0.5);
    this.trophies = [];
    for (let i = 0; i < 10; i++) {
      const row = i < 5 ? 0 : 1;
      const x = T.x - 2.4 + (i % 5) * 1.2;
      const y = row ? 1.93 : 0.93;
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: '#555b66', metalness: 0.8, roughness: 0.25 });
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.08, 0.3, 16), mat);
      cup.position.y = 0.42;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 8), mat);
      stem.position.y = 0.2;
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.24), new THREE.MeshStandardMaterial({ color: '#2c1f17' }));
      base.position.y = 0.05;
      for (const s of [-1, 1]) {
        const h = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 12), mat);
        h.position.set(s * 0.19, 0.45, 0);
        h.rotation.y = Math.PI / 2;
        g.add(h);
      }
      g.add(cup, stem, base);
      g.position.set(x, y, T.z);
      this.scene.add(g);
      this.trophies.push(mat);
    }
    this.zoneSign('ویترین جام‌ها', '#ffd34d', T.x, 4.4, T.z + 0.6, 0, 4);

    // hall of fame: three golden statues of the strongest people in the gym
    const F = WING.fame;
    for (const [dx, h, c] of [[0, 1.2, '#ffd34d'], [-2.4, 0.8, '#d5dce6'], [2.4, 0.55, '#cd7f32']]) {
      m.box(2.2, h, 2.2, F.x + dx, h / 2, F.z, c);
      m.box(2.25, 0.08, 2.25, F.x + dx, h, F.z, '#1d2433');
    }
    this.addCollider(F.x - 3.6, F.z - 1.2, F.x + 3.6, F.z + 1.2);
    this.statues = [[0, 1.2], [-2.4, 0.8], [2.4, 0.55]].map(([dx, h], i) => {
      const ch = new Character(Object.assign({}, GOLD_OUTFIT, { muscle: 1 - i * 0.2 }));
      ch.root.position.set(F.x + dx, h, F.z);
      ch.root.rotation.y = Math.PI;
      ch.manual = true;
      copyPose(ch.manualPose, makePose());
      ANIMS[['e_flex', 'e_victory', 'e_salute'][i]].fn(ch.manualPose, 0.5, ch);
      copyPose(ch.cur, ch.manualPose);
      ch.apply();
      ch.setLabel('—', ['🥇 اول', '🥈 دوم', '🥉 سوم'][i], '#ffd34d');
      ch.label.position.y = 2.6;
      this.scene.add(ch.root);
      return ch;
    });
    this.zoneSign('تالار افتخار', '#ffd34d', F.x, 6.8, F.z, Math.PI, 5);

    // punch machine and reaction wall, facing the main hall
    const P = WING.punch;
    m.box(1.2, 2.6, 0.9, P.x - 0.4, 1.3, P.z, '#e63946');
    m.box(1.25, 0.6, 0.95, P.x - 0.4, 2.5, P.z, '#111317');
    m.sphere(0.32, P.x + 0.25, 1.45, P.z, '#ffd34d');
    this.punchTex = makeCanvasTexture(256, 128, () => {});
    const pd = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: this.punchTex, toneMapped: false }));
    pd.position.set(P.x + 0.08, 2.5, P.z);
    pd.rotation.y = Math.PI / 2;
    this.scene.add(pd);
    this.addCollider(P.x - 1.0, P.z - 0.5, P.x + 0.3, P.z + 0.5);
    this.addSpot('punch', P.x + 1.3, P.z, 1.8, '🥊 دستگاه مشت‌سنج');
    const R = WING.reaction;
    m.box(0.3, 3.0, 3.6, R.x - 0.4, 1.5, R.z, '#1d2433');
    this.reactionLights = [];
    for (let i = 0; i < 9; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: '#33384a', toneMapped: false });
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), mat);
      l.position.set(R.x - 0.24, 0.8 + Math.floor(i / 3) * 0.85, R.z - 1.1 + (i % 3) * 1.1);
      l.rotation.y = Math.PI / 2;
      this.scene.add(l);
      this.reactionLights.push(mat);
    }
    this.addCollider(R.x - 0.6, R.z - 1.8, R.x - 0.2, R.z + 1.8);
    this.addSpot('reaction', R.x + 1.2, R.z, 1.8, '⚡ تست سرعت واکنش');
    this.zoneSign('بازی‌های قدرت و سرعت', '#ff4da6', -46.2, 6.6, -3.5, Math.PI / 2, 6);
    this.drawPunch(null, 0);

    // spinning class: 3 rows of bikes in front of the instructor
    const SP = WING.spin;
    this.floorPatch(SP.x - 6, SP.z - 6, SP.x + 6, SP.z + 10, ['#4361ee', '#3a0ca3', '#7209b7'], 2);
    m.box(4, 0.4, 2.4, SP.x, 0.2, SP.z - 4.2, '#ff4da6');
    this.addCollider(SP.x - 2, SP.z - 5.4, SP.x + 2, SP.z - 3.0);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const x = SP.x - 4.2 + c * 2.8;
        const z = SP.z + 0.5 + r * 2.8;
        const col = ['#ff4da6', '#7fe0ff', '#ffd34d', '#2ecc71'][c];
        mt.box(0.1, 0.1, 1.2, x, 0.1, z, '#2c3140');
        mt.box(0.08, 0.75, 0.08, x, 0.45, z + 0.2, col);
        m.box(0.26, 0.08, 0.32, x, 0.86, z + 0.25, '#111317');
        mt.box(0.08, 0.95, 0.08, x, 0.6, z - 0.45, col);
        mt.cyl(0.03, 0.55, x, 1.1, z - 0.45, '#9aa0a8', 0, 0, Math.PI / 2, 10);
        mt.cyl(0.24, 0.07, x, 0.35, z - 0.42, col, 0, 0, Math.PI / 2, 18);
        this.addCollider(x - 0.3, z - 0.7, x + 0.3, z - 0.2);
        this.addStation(x, z + 0.28, Math.PI, ['bike'], { equip: 'spin', ax: x + 1.0, az: z + 0.28 });
      }
    }
    mt.box(0.1, 0.1, 1.2, SP.x, 0.5, SP.z - 4.2, '#2c3140');
    mt.box(0.08, 0.95, 0.08, SP.x, 1.0, SP.z - 4.65, '#ff4da6');
    mt.cyl(0.24, 0.07, SP.x, 0.75, SP.z - 4.62, '#ff4da6', 0, 0, Math.PI / 2, 18);
    const coach = new Character(Object.assign(randomOutfit(), { shirt: '#ff4da6', band: '#ffffff', muscle: 0.6 }));
    coach.root.position.set(SP.x, 0.4, SP.z - 4.2);
    coach.setLabel('مربی', 'کلاس اسپینینگ', '#ff4da6');
    this.scene.add(coach.root);
    this.coach = coach;
    this.zoneSign('کلاس اسپینینگ', '#c77dff', SP.x, 7.5, SP.z + 2, Math.PI / 2, 5);

    // strongman corner: atlas stones onto platforms and sled lanes
    this.floorPatch(-78, -14, -68, 2, ['#2f2f2f', '#3d3d3d'], 2);
    for (const z of [-11, -6]) {
      m.box(1.0, 1.2, 1.0, -73 + 0.78, 0.6, z, '#5d4329');
      m.box(1.05, 0.06, 1.05, -73 + 0.78, 1.2, z, '#ffd34d');
      this.addCollider(-73 + 0.28, z - 0.5, -73 + 1.28, z + 0.5);
      this.addStation(-73, z, Math.PI / 2, ['atlas', 'squat'], { equip: 'atlas', ax: -74.3, az: z });
      for (let k = 0; k < 3; k++) m.sphere(0.2 + k * 0.05, -77 + k * 0.7, 0.2 + k * 0.05, z + 1.4, '#8d99ae');
      this.addCollider(-77.25, z + 1.1, -75.3, z + 1.7);
    }
    for (const z of [18, 22]) {
      m.box(14, 0.03, 2.2, -70, 0.016, z, '#3a7d44');
      for (let k = 0; k <= 7; k++) m.box(0.08, 0.035, 2.2, -77 + k * 2, 0.017, z, '#ffffff');
      this.addStation(-76, z, Math.PI / 2, ['sledpush'], { equip: 'sled', ax: -76.5, az: z + 1.4 });
    }
    this.zoneSign('بخش قدرتی', '#ff7b00', -72, 7.5, 4, Math.PI / 2, 5);

    // juice bar with a barista
    const J = WING.juice;
    m.box(10, 1.1, 1.0, J.x, 0.55, J.z - 1.6, '#ff7b00');
    m.box(10.2, 0.08, 1.2, J.x, 1.12, J.z - 1.6, '#f1faee');
    m.box(10, 2.6, 0.3, J.x, 2.3, J.z + 0.3, '#2a9d8f');
    for (let i = 0; i < 30; i++) {
      const x = J.x - 4.6 + (i % 15) * 0.65;
      const y = 1.6 + Math.floor(i / 15) * 0.7;
      m.cyl(0.08, 0.32, x, y, J.z + 0.05, pick(['#ff4d6d', '#ffd34d', '#2ecc71', '#ff7b00', '#c77dff', '#7fe0ff']));
    }
    for (const y of [1.42, 2.12]) m.box(10, 0.05, 0.3, J.x, y, J.z + 0.05, '#e9c46a');
    for (let i = 0; i < 6; i++) {
      const x = J.x - 4 + i * 1.6;
      mt.cyl(0.04, 0.75, x, 0.37, J.z - 2.6, '#c9ced6');
      m.cyl(0.24, 0.08, x, 0.78, J.z - 2.6, ['#e63946', '#ffd34d', '#2ecc71'][i % 3]);
      this.addCollider(x - 0.2, J.z - 2.8, x + 0.2, J.z - 2.4);
    }
    this.addCollider(J.x - 5, J.z - 2.1, J.x + 5, J.z + 0.5);
    const barista = new Character(Object.assign(randomOutfit(), { shirt: '#2a9d8f', band: null, muscle: 0.2 }));
    barista.root.position.set(J.x + 2, 0, J.z - 0.6);
    barista.root.rotation.y = Math.PI;
    barista.lookAround = true;
    barista.setLabel('آبمیوه‌فروش', 'شیک و اسموتی', '#2ecc71');
    this.scene.add(barista.root);
    this.barista = barista;
    this.addSpot('juice', J.x, J.z - 3.2, 2.2, '🥤 آبمیوه‌ی انرژی • ۴۰ سکه');
    this.zoneSign('آبمیوه‌بار', '#2ecc71', J.x, 5.0, J.z + 0.2, Math.PI, 5);
    for (const x of [-50, -47.5]) {
      m.box(1.0, 0.5, 1.1, x, 0.35, Z - 1.5, '#3d3d3d');
      m.box(1.0, 1.2, 0.3, x, 0.95, Z - 0.95, '#3d3d3d', 0, -0.3);
      this.addCollider(x - 0.5, Z - 2.05, x + 0.5, Z - 0.8);
    }

    // giant golden mascot on a pedestal
    const M = WING.mascot;
    m.cyl(2.0, 1.2, M.x, 0.6, M.z, '#1d2433', 0, 0, 0, 24);
    glow.cyl(2.05, 0.1, M.x, 1.2, M.z, '#ffd34d', 0, 0, 0, 24);
    this.addCollider(M.x - 2, M.z - 2, M.x + 2, M.z + 2);
    const mascot = new Character(Object.assign({}, GOLD_OUTFIT, { muscle: 1, band: '#e63946' }));
    mascot.root.scale.setScalar(2.8);
    mascot.root.position.set(M.x, 1.2, M.z);
    mascot.root.rotation.y = Math.PI / 2;
    mascot.manual = true;
    ANIMS.e_flex.fn(mascot.manualPose, 0.5, mascot);
    copyPose(mascot.cur, mascot.manualPose);
    mascot.apply();
    this.scene.add(mascot.root);
    this.mascot = mascot;

    // sauna cabin with steam
    m.box(5, 3, 4, -77, 1.5, 28.5, '#a0522d');
    m.box(1.0, 2.2, 0.08, -77, 1.1, 26.48, '#5a3a20');
    glow.box(0.6, 0.4, 0.05, -77, 2.5, 26.46, '#ffb347');
    this.addCollider(-79.5, 26.5, -74.5, 30.5);
    this.zoneSign('سونا', '#ffb347', -77, 4.6, 26.4, Math.PI, 3);
  },

  buildEastWing() {
    const m = this.matte;
    const mt = this.metal;
    const glow = this.glow;
    const Z = ROOM.z;
    // Olympic lifting platforms
    for (const x of [50, 56, 62]) {
      m.box(3.2, 0.02, 3.2, x, 0.01, -25, '#c9a46c');
      m.box(0.8, 0.022, 3.2, x - 1.2, 0.011, -25, '#3a3a3a');
      m.box(0.8, 0.022, 3.2, x + 1.2, 0.011, -25, '#3a3a3a');
      this.addStation(x, -25, Math.PI, ['snatch', 'cleanjerk', 'lift'], { equip: 'platform', ax: x, az: -22.6 });
    }
    for (let i = 0; i < 8; i++) mt.cyl(0.22 + (i % 4) * 0.03, 0.06, 47 + i * 0.6, 0.3, -30.8, ['#e63946', '#2f6fed', '#ffd34d', '#2ecc71'][i % 4], Math.PI / 2, 0, 0, 18);
    this.addCollider(46.6, -31.0, 51.6, -30.6);
    this.zoneSign('وزنه‌برداری المپیک', '#ffd34d', 56, 7.8, -27, 0, 6);
    // rope climb from the ceiling
    for (const x of [70, 73, 76]) {
      m.cyl(0.045, ROOM.h - 0.6, x, ROOM.h / 2 + 0.3, -27.25, '#d9c49a', 0, 0, 0, 8);
      m.box(2.2, 0.02, 2.2, x, 0.01, -27, '#2f6fed');
      this.addStation(x, -27, Math.PI, ['ropeclimb'], { equip: 'climbrope', ax: x, az: -25.2, rope: 0.25, ropeH: ROOM.h - 0.8 });
    }
    this.zoneSign('صعود با طناب', '#7fe0ff', 73, 8.2, -29, 0, 5);
    // sprint lane with timing gates
    const S = WING.sprint;
    m.box(S.x2 - S.x1 + 6, 0.025, 3.0, (S.x1 + S.x2) / 2, 0.014, S.z, '#b8352b');
    for (const dz of [-1.5, 0, 1.5]) m.box(S.x2 - S.x1 + 6, 0.028, 0.06, (S.x1 + S.x2) / 2, 0.015, S.z + dz, '#ffffff');
    for (const [x, c] of [[S.x1, '#2ecc71'], [S.x2, '#e63946']]) {
      for (const s of [-1, 1]) mt.box(0.15, 3.0, 0.15, x, 1.5, S.z + s * 1.8, '#2c3140');
      glow.box(0.12, 0.25, 3.7, x, 3.0, S.z, c);
      m.box(0.15, 0.03, 3.0, x, 0.03, S.z, c);
      this.addCollider(x - 0.1, S.z + 1.7, x + 0.1, S.z + 1.9);
      this.addCollider(x - 0.1, S.z - 1.9, x + 0.1, S.z - 1.7);
    }
    this.sprintTex = makeCanvasTexture(512, 160, () => {});
    const sb = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.375), new THREE.MeshBasicMaterial({ map: this.sprintTex, toneMapped: false, side: THREE.DoubleSide }));
    sb.position.set((S.x1 + S.x2) / 2, 4.2, S.z - 2.6);
    this.scene.add(sb);
    mt.box(4.6, 0.1, 0.1, (S.x1 + S.x2) / 2, 3.45, S.z - 2.6, '#2c3140');
    for (const s of [-1, 1]) mt.box(0.1, 3.45, 0.1, (S.x1 + S.x2) / 2 + s * 2.2, 1.72, S.z - 2.6, '#2c3140');
    this.addSpot('sprintinfo', S.x1 - 1.5, S.z, 1.6, '🏁 از خط سبز تا قرمز بدو!');
    // trampoline park
    this.floorPatch(46, 1, 58, 13, ['#ff4da6', '#ffd34d', '#7fe0ff'], 2);
    for (const [x, z] of [[49, 4], [54.5, 4], [49, 9.5], [54.5, 9.5]]) {
      m.cyl(1.5, 0.55, x, 0.3, z, '#2c3140');
      m.cyl(1.3, 0.04, x, 0.6, z, '#111111');
      mt.geo(UnitGeo.torus(1, 0.05, 6, 32), x, 0.6, z, pick(['#ff4da6', '#2f6fed', '#ffd34d', '#2ecc71']), Math.PI / 2, 0, 0, 1.45);
      this.addCollider(x - 1.3, z - 1.3, x + 1.3, z + 1.3);
      this.addStation(x, z, -Math.PI / 2, ['trampoline'], { equip: 'gymtramp', y: 0.62, ax: x - 2.1, az: z });
    }
    this.zoneSign('پارک ترامپولین', '#ff4da6', 52, 7.6, 7, -Math.PI / 2, 5);
    // basketball arcade lanes (hoop 4.4 m ahead, 3.05 m up)
    for (const x of [64, 68, 72]) {
      const z = 1;
      m.box(2.4, 0.06, 5.4, x, 0.03, z + 2.6, '#e8742a');
      for (const s of [-1, 1]) m.box(0.06, 2.6, 5.4, x + s * 1.2, 1.3, z + 2.6, '#2c3140');
      m.box(2.4, 3.6, 0.1, x, 1.8, z + 5.3, '#1d2433');
      m.box(1.2, 0.9, 0.06, x, 3.4, z + 5.2, '#f5f5f5');
      mt.geo(UnitGeo.torus(1, 0.08, 6, 24), x, 3.05, z + 4.4, '#ff7b00', Math.PI / 2, 0, 0, 0.23);
      glow.box(2.4, 0.2, 0.08, x, 3.8, z + 5.25, pick(['#ff4da6', '#7fe0ff', '#ffd34d']));
      for (const s of [-1, 1]) this.addCollider(x + s * 1.2 - 0.05, z, x + s * 1.2 + 0.05, z + 5.3);
      this.addCollider(x - 1.2, z + 5.2, x + 1.2, z + 5.4);
      this.addStation(x, z, 0, ['basket'], { equip: 'arcade', ax: x, az: z - 1.3 });
    }
    this.zoneSign('بسکتبال سکه‌ای', '#ff7b00', 68, 7.6, 3, 0, 5);
    // human flag poles
    for (const x of [62, 66]) {
      mt.cyl(0.07, 3.6, x, 1.8, 15, '#c9ced6');
      m.cyl(0.6, 0.02, x, 0.01, 15, '#e63946');
      this.addCollider(x - 0.1, 14.9, x + 0.1, 15.1);
      this.addStation(x - 0.35, 15, Math.PI / 2, ['humanflag'], { equip: 'flagpole', ax: x - 1.6, az: 15 });
    }
    // DJ booth and a light-up dance floor
    const D = WING.dj;
    m.box(3.4, 1.2, 1.4, D.x, 0.6, D.z, '#111317');
    for (let i = 0; i < 2; i++) mt.cyl(0.35, 0.05, D.x - 0.7 + i * 1.4, 1.23, D.z, '#c9ced6', 0, 0, 0, 20);
    for (const s of [-1, 1]) {
      m.box(1.0, 2.4, 1.0, D.x + s * 2.6, 1.2, D.z + 0.4, '#1d2433');
      m.cyl(0.35, 0.08, D.x + s * 2.6, 1.6, D.z - 0.12, '#3c4250', Math.PI / 2, 0, 0, 18);
      m.cyl(0.2, 0.08, D.x + s * 2.6, 0.7, D.z - 0.12, '#3c4250', Math.PI / 2, 0, 0, 18);
    }
    this.addCollider(D.x - 3.2, D.z - 0.8, D.x + 3.2, D.z + 1.0);
    this.addSpot('dj', D.x - 2.6, D.z - 2.2, 2.0, '🎧 دی‌جی: روشن/خاموش');
    const F = WING.floor;
    this.danceTex = makeCanvasTexture(256, 256, () => {});
    this.danceTex.magFilter = THREE.NearestFilter;
    const df = new THREE.Mesh(new THREE.PlaneGeometry(F.s, F.s), new THREE.MeshBasicMaterial({ map: this.danceTex, toneMapped: false }));
    df.rotation.x = -Math.PI / 2;
    df.position.set(F.x, 0.03, F.z);
    this.scene.add(df);
    this.danceBeams = [];
    ['#ff4d6d', '#4d8bff', '#ffd34d', '#2ecc71'].forEach((c, i) => {
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.4, 9, 18, 1, true), new THREE.MeshBasicMaterial({
        color: c, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      }));
      beam.geometry.translate(0, -4.5, 0);
      const pivot = new THREE.Group();
      pivot.position.set(F.x - 3 + (i % 2) * 6, ROOM.h - 0.6, F.z - 3 + Math.floor(i / 2) * 6);
      pivot.add(beam);
      this.scene.add(pivot);
      this.danceBeams.push({ pivot, ph: i * 1.9 });
    });
    this.zoneSign('دیسکو ورزشی', '#ff4d6d', F.x, 8.4, F.z + 4.6, Math.PI, 5);
    // body scanner booth
    const B = WING.scanner;
    m.cyl(1.0, 0.15, B.x, 0.075, B.z, '#1d2433', 0, 0, 0, 24);
    m.cyl(1.0, 0.15, B.x, 2.6, B.z, '#1d2433', 0, 0, 0, 24);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      if (Math.abs(wrapAngle(a + Math.PI / 2)) < 0.4) continue;
      mt.box(0.08, 2.5, 0.08, B.x + Math.cos(a) * 0.95, 1.33, B.z + Math.sin(a) * 0.95, '#7fe0ff');
      this.addCollider(B.x + Math.cos(a) * 0.95 - 0.07, B.z + Math.sin(a) * 0.95 - 0.07, B.x + Math.cos(a) * 0.95 + 0.07, B.z + Math.sin(a) * 0.95 + 0.07);
    }
    this.scanRing = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 6, 32), new THREE.MeshBasicMaterial({ color: '#7fe0ff', toneMapped: false, transparent: true, opacity: 0.8 }));
    this.scanRing.rotation.x = Math.PI / 2;
    this.scanRing.position.set(B.x, 0.3, B.z);
    this.scene.add(this.scanRing);
    this.addSpot('scan', B.x, B.z - 1.6, 1.8, '🔬 اسکن بدن');
    this.zoneSign('اسکنر بدن', '#7fe0ff', B.x, 4.3, B.z, Math.PI, 3);
    // ice baths
    for (const x of [52, 55.5]) {
      m.box(2.6, 0.8, 1.4, x, 0.4, 28.5, '#e9eef7');
      glow.box(2.3, 0.04, 1.1, x, 0.78, 28.5, '#9fdcff');
      for (let k = 0; k < 5; k++) m.box(0.18, 0.12, 0.18, x + rand(-1, 1), 0.82, 28.5 + rand(-0.4, 0.4), '#ffffff', rand(0, 1));
      this.addCollider(x - 1.3, 27.8, x + 1.3, 29.2);
    }
    this.zoneSign('حمام یخ', '#9fdcff', 53.7, 3.6, 28.5, Math.PI, 3);
    // quote board and a big clock on the north wall
    this.quoteTex = makeCanvasTexture(1024, 220, () => {});
    const qb = new THREE.Mesh(new THREE.PlaneGeometry(16, 3.44), new THREE.MeshBasicMaterial({ map: this.quoteTex, toneMapped: false }));
    qb.position.set(66, 7.2, -Z + 0.14);
    this.scene.add(qb);
    mt.box(16.4, 3.8, 0.1, 66, 7.2, -Z + 0.06, '#0b0f1c');
    this.clockTex = makeCanvasTexture(512, 220, () => {});
    const cb = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.15), new THREE.MeshBasicMaterial({ map: this.clockTex, toneMapped: false }));
    cb.position.set(47.5, 7.6, -Z + 0.14);
    this.scene.add(cb);
    mt.box(5.3, 2.4, 0.1, 47.5, 7.6, -Z + 0.06, '#0b0f1c');
    for (const [x, z, c] of [[44.5, 22, '#e76f51'], [44.5, -18, '#2a9d8f'], [78, -18, '#e9c46a'], [60, 20, '#f4a261']]) this.plant(x, z, c, 1.2);
    this.sprintBest = null;
    this.drawSprintBoard('آماده‌ای؟', '');
    this.quoteI = -1;
    this.nextQuote();
    this.drawClock();
  },

  drawSprintBoard(big, small) {
    redrawCanvasTexture(this.sprintTex, (ctx, w, h) => {
      ctx.fillStyle = '#0b0f1c';
      ctx.fillRect(0, 0, w, h);
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd34d';
      ctx.font = `64px ${DISPLAY_FONT}`;
      ctx.fillText(big, w / 2, 62);
      ctx.fillStyle = '#7fe0ff';
      ctx.font = `600 30px ${UI_FONT}`;
      ctx.fillText(small || (this.sprintBest ? `رکورد: ${fa(this.sprintBest.toFixed(2))} ثانیه` : 'دوی ۳۰ متر'), w / 2, 126);
    });
  },

  nextQuote() {
    const Q = ['هر تکرار، یه قدم به قهرمانی', 'امروز سخت‌تر از دیروز', 'عرق امروز، مدال فردا', 'بدن قوی، ذهن قوی', 'قهرمان‌ها هر روز تمرین می‌کنن',
      'یه ست دیگه، فقط یه ست دیگه!', 'تو از دیروزت قوی‌تری', 'نظم، از انگیزه قوی‌تره', 'کوچیک شروع کن، بزرگ تموم کن', 'دردِ امروز، قدرتِ فرداست'];
    this.quoteI = (this.quoteI + 1) % Q.length;
    const text = Q[this.quoteI];
    const hue = (this.quoteI * 47) % 360;
    redrawCanvasTexture(this.quoteTex, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, `hsl(${hue}, 80%, 45%)`);
      g.addColorStop(1, `hsl(${(hue + 60) % 360}, 80%, 40%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 10;
      ctx.font = `100px ${DISPLAY_FONT}`;
      ctx.fillText(text, w / 2, h / 2 + 6);
    });
  },

  drawClock() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    redrawCanvasTexture(this.clockTex, (ctx, w, h) => {
      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ff4d4d';
      ctx.shadowColor = '#ff4d4d';
      ctx.shadowBlur = 18;
      ctx.font = `bold 120px ${UI_FONT}`;
      ctx.fillText(fa(`${hh}:${mm}`), w / 2, h / 2 - 12);
      ctx.shadowBlur = 0;
      ctx.direction = 'rtl';
      ctx.fillStyle = '#7fe0ff';
      ctx.font = `600 30px ${UI_FONT}`;
      ctx.fillText('ساعت تمرین', w / 2, h - 26);
    });
  },

  /** Statue labels, trophies and other boards; called every few seconds by the game. */
  refreshWings(top3, stage) {
    this.statues.forEach((ch, i) => {
      const r = top3[i];
      ch.setLabel(r ? (r.isPlayer ? '⭐ ' + r.name : r.name) : '—', r ? `${['🥇', '🥈', '🥉'][i]} سطح ${fa(r.level)}` : '', '#ffd34d');
    });
    this.trophies.forEach((mat, i) => {
      const won = stage > i + 1;
      mat.color.set(won ? '#ffcf33' : '#555b66');
      mat.emissive = mat.emissive || new THREE.Color();
      mat.emissive.set(won ? '#5a3d00' : '#000000');
    });
  },

  drawPunch(score, best) {
    redrawCanvasTexture(this.punchTex, (ctx, w, h) => {
      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd34d';
      ctx.font = `bold 64px ${UI_FONT}`;
      ctx.fillText(score != null ? fa(score) : '----', w / 2, 52);
      ctx.fillStyle = '#7fe0ff';
      ctx.font = `600 22px ${UI_FONT}`;
      ctx.direction = 'rtl';
      ctx.fillText(best ? `رکورد ${fa(best)}` : 'مشت بزن!', w / 2, 106);
    });
  },

  updateWings(dt) {
    const t = this.time;
    for (const b of this.danceBeams) {
      b.pivot.rotation.z = Math.sin(t * 0.8 + b.ph) * (this.party ? 0.6 : 0.25);
      b.pivot.rotation.x = Math.cos(t * 0.6 + b.ph) * (this.party ? 0.6 : 0.25);
      b.pivot.children[0].material.opacity = this.party ? 0.18 : 0.06;
    }
    this.danceT = (this.danceT || 0) + dt;
    if (this.danceT > (this.party ? 0.25 : 0.8)) {
      this.danceT = 0;
      const party = this.party;
      redrawCanvasTexture(this.danceTex, (ctx, w) => {
        const n = 8;
        const s = w / n;
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            const on = party ? Math.random() < 0.6 : Math.random() < 0.25;
            ctx.fillStyle = on ? `hsl(${Math.floor(Math.random() * 360)}, 90%, ${party ? 60 : 45}%)` : '#1a1d2b';
            ctx.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
          }
        }
      });
    }
    this.scanRing.position.y = this.scanning ? 0.3 + (Math.sin(t * 6) * 0.5 + 0.5) * 2.1 : 0.3 + (Math.sin(t * 1.5) * 0.5 + 0.5) * 2.1;
    this.scanRing.material.color.set(this.scanning ? '#2ecc71' : '#7fe0ff');
    this.coach.speed = 0;
    if (!this.coach.busy) this.coach.play(pick(['bike', 'cheer', 'e_clap']));
    this.coach.update(dt);
    this.barista.update(dt);
    this.quoteT = (this.quoteT || 0) + dt;
    if (this.quoteT > 7) { this.quoteT = 0; this.nextQuote(); }
    this.clockT = (this.clockT || 0) + dt;
    if (this.clockT > 20) { this.clockT = 0; this.drawClock(); }
  },
});
