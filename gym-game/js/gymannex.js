'use strict';
/*
 * The gym grew another 80 m. West: the Inspiration Garden, a hall of statues, a golden
 * fountain, torches, lions, a giant dumbbell, Olympic rings and paintings (art, no slogans).
 * East: the ninja course, with monkey bars, salmon ladder, warped wall, quintuple steps,
 * balance beam and cargo net.
 */

const ANNEX = { west: -112, east: 112 };
const WARP = { f0: 3.9, R: 3.1, back: 2.4, land: 1.0 };

Object.assign(EQUIP, {
  nbars: { name: 'میله‌های میمون', env: 'gym', where: 'پیست نینجا، بال شرقی جدید' },
  nsalmon: { name: 'نردبان سالمون', env: 'gym', where: 'پیست نینجا، کنار دیوار شمال' },
  nwarp: { name: 'دیوار منحنی', env: 'gym', where: 'پیست نینجا، شمال شرقی' },
  nsteps: { name: 'پله‌های پنج‌گانه', env: 'gym', where: 'پیست نینجا' },
  nbeam: { name: 'تیر تعادل', env: 'gym', where: 'پیست نینجا' },
  nnet: { name: 'تور صعود', env: 'gym', where: 'پیست نینجا، دیوار شرقی' },
});

const NINJA_MOVES = [
  ['beamwalk', 'تیر تعادل', '🤸‍♀️', 50, 160, 'nbeam'],
  ['qsteps', 'پله‌های پنج‌گانه', '🪜', 55, 170, 'nsteps'],
  ['monkeybars', 'میله‌های میمون', '🐒', 60, 180, 'nbars'],
  ['cargonet', 'صعود از تور', '🕸️', 65, 185, 'nnet', 'climb'],
  ['salmon', 'نردبان سالمون', '🐟', 110, 270, 'nsalmon'],
  ['warpwall', 'دیوار منحنی نینجا', '🧗', 130, 300, 'nwarp'],
].map(([id, name, icon, level, xp, equip, anim]) => Object.assign({ id, name, icon, level, xp, equip, cat: 'pro' }, anim ? { anim } : {}));
MOVES.push(...NINJA_MOVES);
for (const m of NINJA_MOVES) MOVE_BY_ID[m.id] = m;

/** A framed painting drawn on a canvas: pure art, no words. */
function paintingTexture(kind) {
  return makeCanvasTexture(512, 320, (ctx, W, H) => {
    if (kind === 'sunrise') {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#2b1055'); g.addColorStop(0.5, '#ff6f61'); g.addColorStop(1, '#ffd34d');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(W * 0.5, H * 0.62, 60, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a1c5a';
      ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W * 0.28, H * 0.45); ctx.lineTo(W * 0.5, H * 0.75); ctx.lineTo(W * 0.72, H * 0.35); ctx.lineTo(W, H); ctx.fill();
      // a climber on the summit with arms up
      ctx.fillStyle = '#120820';
      ctx.save(); ctx.translate(W * 0.72, H * 0.35);
      ctx.fillRect(-4, -34, 8, 22); ctx.beginPath(); ctx.arc(0, -40, 7, 0, TAU); ctx.fill();
      ctx.fillRect(-14, -50, 4, 20); ctx.fillRect(10, -50, 4, 20); ctx.fillRect(-6, -12, 4, 14); ctx.fillRect(2, -12, 4, 14);
      ctx.restore();
    } else if (kind === 'waves') {
      ctx.fillStyle = '#0b3d91'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 7; i++) {
        ctx.strokeStyle = ['#7fe0ff', '#00b4d8', '#ffffff', '#4dd2ff'][i % 4];
        ctx.lineWidth = 10;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 8) ctx.lineTo(x, 40 + i * 42 + Math.sin(x * 0.03 + i) * 18);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(W * 0.82, 60, 34, 0, TAU); ctx.fill();
    } else if (kind === 'lion') {
      const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 260);
      g.addColorStop(0, '#ffd34d'); g.addColorStop(1, '#e63946');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 24; i++) {
        ctx.fillStyle = ['#ff7b00', '#9b5de5', '#ff4da6', '#2ecc71'][i % 4];
        ctx.beginPath();
        const a = (i / 24) * TAU;
        ctx.moveTo(W / 2, H / 2); ctx.lineTo(W / 2 + Math.cos(a) * 130, H / 2 + Math.sin(a) * 130); ctx.lineTo(W / 2 + Math.cos(a + 0.2) * 110, H / 2 + Math.sin(a + 0.2) * 110); ctx.fill();
      }
      ctx.fillStyle = '#ffcf6b'; ctx.beginPath(); ctx.arc(W / 2, H / 2, 70, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a1c0c';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(W / 2 + s * 24, H / 2 - 12, 8, 0, TAU); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(W / 2 - 12, H / 2 + 14); ctx.lineTo(W / 2 + 12, H / 2 + 14); ctx.lineTo(W / 2, H / 2 + 28); ctx.fill();
    } else if (kind === 'runner') {
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, '#ff4da6'); g.addColorStop(0.5, '#ffb347'); g.addColorStop(1, '#ffd34d');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 6; i++) ctx.fillRect(0, 80 + i * 26, W * 0.45 - i * 30, 6);
      ctx.fillStyle = '#1d0b2a';
      ctx.save(); ctx.translate(W * 0.6, H * 0.55); ctx.rotate(-0.3);
      ctx.beginPath(); ctx.arc(0, -70, 16, 0, TAU); ctx.fill();
      ctx.fillRect(-8, -54, 16, 56);
      ctx.save(); ctx.rotate(0.9); ctx.fillRect(-4, 0, 9, 60); ctx.restore();
      ctx.save(); ctx.rotate(-0.8); ctx.fillRect(-4, 0, 9, 66); ctx.restore();
      ctx.save(); ctx.translate(0, -48); ctx.rotate(-1.4); ctx.fillRect(-3, 0, 7, 46); ctx.restore();
      ctx.save(); ctx.translate(0, -48); ctx.rotate(1.2); ctx.fillRect(-3, 0, 7, 46); ctx.restore();
      ctx.restore();
    } else {
      ctx.fillStyle = '#0b0420'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 160; i++) { ctx.fillStyle = Math.random() < 0.3 ? '#ffd34d' : '#ffffff'; ctx.fillRect(rand(0, W), rand(0, H), 2, 2); }
      ctx.strokeStyle = '#7fe0ff'; ctx.lineWidth = 3;
      const pts = [[90, 220], [150, 120], [240, 160], [300, 70], [380, 140], [440, 90]];
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.fillStyle = '#ffffff'; for (const [x, y] of pts) { ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#c8a2ff'; ctx.beginPath(); ctx.arc(110, 80, 40, 0, TAU); ctx.fill();
    }
  });
}

Object.assign(GymWorld.prototype, {
  painting(kind, x, y, z, ry, w = 6) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.625), new THREE.MeshBasicMaterial({ map: paintingTexture(kind), toneMapped: false }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    this.scene.add(mesh);
    const fx = Math.cos(ry);
    const fz = -Math.sin(ry);
    for (const [dx, dy, bw, bh] of [[0, w * 0.3125 + 0.12, w + 0.5, 0.24], [0, -w * 0.3125 - 0.12, w + 0.5, 0.24], [w / 2 + 0.12, 0, 0.24, w * 0.625], [-w / 2 - 0.12, 0, 0.24, w * 0.625]]) {
      this.metal.box(bw, bh, 0.1, x + fx * dx, y + dy, z + fz * dx, '#d4af37', ry);
    }
  },

  /** West annex: the Inspiration Garden. */
  buildStatueGarden() {
    const m = this.matte;
    const mt = this.metal;
    const glow = this.glow;
    const X = ANNEX.west;
    const Z = ROOM.z;
    this.floorPatch(X - 19, -Z + 1, X + 19, Z - 1, ['#efe9dc', '#e2d6bd'], 2);
    for (const z of [-3, 3]) m.box(38, 0.03, 0.25, X, 0.03, z, '#d4af37');
    // arch into the garden with Olympic rings
    for (const z of [-8, 8]) {
      m.box(1.4, ROOM.h, 1.4, -91.5, ROOM.h / 2, z, '#efe9dc');
      mt.box(1.45, 0.2, 1.45, -91.5, 2.2, z, '#d4af37');
      this.addCollider(-92.2, z - 0.7, -90.8, z + 0.7);
    }
    m.box(1.4, 1.6, 17.4, -91.5, ROOM.h - 1.2, 0, '#efe9dc');
    ['#2f6fed', '#111111', '#e63946', '#ffd34d', '#2ecc71'].forEach((c, i) => {
      glow.add(UnitGeo.torus(1, 0.09, 6, 32), -90.7, 7.8 - (i % 2) * 0.75, (i - 2) * 1.35, c, 0, Math.PI / 2, 0, 0.62, 0.62, 0.62);
    });
    // the fountain with a golden champion on top
    const F = { x: X, z: 0 };
    m.cyl(5.2, 0.6, F.x, 0.3, F.z, '#e2d6bd', 0, 0, 0, 40);
    mt.add(UnitGeo.torus(1, 0.048, 6, 48), F.x, 0.62, F.z, '#d4af37', Math.PI / 2, 0, 0, 5.2, 5.2, 5.2);
    const water = new THREE.Mesh(new THREE.CircleGeometry(4.9, 40), new THREE.MeshStandardMaterial({ color: '#4fb3ff', roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(F.x, 0.55, F.z);
    this.scene.add(water);
    m.cyl(2.2, 1.3, F.x, 1.15, F.z, '#efe9dc', 0, 0, 0, 28);
    m.cyl(1.1, 1.0, F.x, 2.3, F.z, '#e2d6bd', 0, 0, 0, 20);
    this.addCollider(F.x - 5.2, F.z - 5.2, F.x + 5.2, F.z + 5.2);
    makeStatue(this, GOLD_OUTFIT, 'e_victory', 0.5, F.x, F.z, Math.PI / 2, { scale: 1.6, plinth: 2.8 });
    const jets = [];
    for (let i = 0; i < 12; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: '#bfe9ff', transparent: true, opacity: 0.8 }));
      this.scene.add(d);
      jets.push({ d, a: (i / 12) * TAU, ph: i / 12 });
    }
    this.anims.push((dt, time) => {
      for (const j of jets) {
        const u = (time * 0.7 + j.ph) % 1;
        const r = 2.3 + u * 2.2;
        j.d.position.set(F.x + Math.cos(j.a) * r, 1.8 + 4 * 1.4 * u * (1 - u) - u * 1.1, F.z + Math.sin(j.a) * r);
      }
    });
    // statue avenue: gold, silver, bronze, marble and crystal heroes
    const SILVER = Object.assign({}, MARBLE_OUTFIT, { skin: '#c9ced6', hair: '#9aa0a8', shirt: '#d5dce6', shorts: '#aab3c0', shoes: '#c9ced6', sole: '#ffffff', socks: '#c9ced6' });
    const rows = [
      [GOLD_OUTFIT, 'lift', 0.6], [SILVER, 'handstand', 0.5], [BRONZE_OUTFIT, 'javelin', 0.6], [MARBLE_OUTFIT, 'archery', 0.5], [CRYSTAL_OUTFIT, 'kata', 0.3],
      [MARBLE_OUTFIT, 'e_salute', 0.5], [BRONZE_OUTFIT, 'kettle', 0.3], [GOLD_OUTFIT, 'globehold', 0.25], [SILVER, 'frontkick', 0.5], [CRYSTAL_OUTFIT, 'e_flex', 0.5],
    ];
    rows.forEach(([o, a, t], i) => {
      const side = i < 5 ? -1 : 1;
      const x = X - 14 + (i % 5) * 7;
      const z = side * 19;
      makeStatue(this, o, a, t, x, z, side < 0 ? 0 : Math.PI, {
        scale: 1.25, plinth: 1.1, plinthColor: ['#2c3140', '#e2d6bd', '#3d2b1f'][i % 3], trim: ['#d4af37', '#c9ced6', '#cd7f32'][i % 3],
      });
      this.plant(x + 2.4, z, ['#e76f51', '#2a9d8f', '#9b5de5', '#ffb703', '#ff4da6'][i % 5], 0.9);
    });
    // torches between the statues
    for (let i = 0; i < 4; i++) {
      for (const s of [-1, 1]) {
        const x = X - 10.5 + i * 7;
        const z = s * 16.5;
        mt.cyl(0.07, 2.4, x, 1.2, z, '#d4af37', 0, 0, 0, 8);
        mt.cyl(0.26, 0.22, x, 2.45, z, '#d4af37', 0, 0, 0, 12);
        flame(this, x, 2.85, z, 1.3);
        this.addCollider(x - 0.2, z - 0.2, x + 0.2, z + 0.2);
      }
    }
    // two stone lions guarding the arch
    for (const s of [-1, 1]) {
      const lx = -95.5;
      const lz = s * 6.2;
      m.box(2.6, 1.0, 1.6, lx, 0.5, lz, '#d8d0c0');
      m.box(1.6, 0.9, 1.0, lx + 0.1, 1.3, lz, '#e2d6bd');
      m.sphere(0.65, lx + 0.9, 1.75, lz, '#c9a46c');
      m.sphere(0.42, lx + 1.2, 1.75, lz, '#e2d6bd');
      for (const e of [-1, 1]) m.sphere(0.07, lx + 1.55, 1.9, lz + e * 0.17, '#2c3140');
      m.box(0.6, 0.7, 0.3, lx + 1.0, 0.75, lz + 0.45, '#e2d6bd');
      m.box(0.6, 0.7, 0.3, lx + 1.0, 0.75, lz - 0.45, '#e2d6bd');
      m.cyl(0.06, 1.1, lx - 1.6, 1.0, lz, '#d8d0c0', 0, 0, 0.8);
      m.sphere(0.14, lx - 2.0, 1.35, lz, '#c9a46c');
      this.addCollider(lx - 2.15, lz - 0.85, lx + 1.4, lz + 0.85);
    }
    // a giant golden dumbbell turning on a pedestal by the far wall
    const D = { x: -127, z: 0 };
    m.cyl(2.2, 1.0, D.x, 0.5, D.z, '#2c3140', 0, 0, 0, 28);
    glow.cyl(2.25, 0.1, D.x, 1.0, D.z, '#ffd34d', 0, 0, 0, 28);
    this.addCollider(D.x - 2.2, D.z - 2.2, D.x + 2.2, D.z + 2.2);
    const db = new Batch();
    db.cyl(0.18, 4.4, 0, 0, 0, '#c9ced6', 0, 0, Math.PI / 2, 16);
    for (const s of [-1, 1]) {
      db.cyl(1.1, 0.35, s * 1.6, 0, 0, '#ffcf33', 0, 0, Math.PI / 2, 28);
      db.cyl(0.9, 0.3, s * 1.95, 0, 0, '#e6b800', 0, 0, Math.PI / 2, 28);
    }
    const dumbbell = new THREE.Mesh(mergeParts(db.parts, false), METAL_MAT);
    dumbbell.position.set(D.x, 3.4, D.z);
    this.scene.add(dumbbell);
    this.anims.push((dt, time) => { dumbbell.rotation.y += dt * 0.45; dumbbell.position.y = 3.4 + Math.sin(time * 1.3) * 0.25; });
    // rainbow arch over the garden path
    const HALF_TORUS = new THREE.TorusGeometry(1, 0.12, 4, 40, Math.PI);
    for (const s of [-1, 1]) this.addCollider(X - 9.8, s > 0 ? 4.1 : -7.2, X - 8.2, s > 0 ? 7.2 : -4.1);
    ['#e63946', '#ff7b00', '#ffd34d', '#2ecc71', '#00b4d8', '#9b5de5'].forEach((c, i) => {
      glow.add(HALF_TORUS, X - 9, 0, 0, c, 0, Math.PI / 2, 0, 6.5 - i * 0.26, 6.5 - i * 0.26, 6.5 - i * 0.26);
    });
    // paintings on the long walls and the far wall
    this.painting('sunrise', X - 8, 6.2, -Z + 0.12, 0);
    this.painting('waves', X + 8, 6.2, -Z + 0.12, 0);
    this.painting('lion', X - 8, 6.2, Z - 0.12, Math.PI);
    this.painting('runner', X + 8, 6.2, Z - 0.12, Math.PI);
    this.painting('stars', -ROOM.x + 0.12, 6.4, -14, Math.PI / 2, 7);
    this.painting('sunrise', -ROOM.x + 0.12, 6.4, 14, Math.PI / 2, 7);
    // benches to sit and look
    for (const [x, z] of [[X - 4, 9], [X + 4, 9], [X - 4, -9], [X + 4, -9]]) {
      m.box(2.6, 0.12, 0.6, x, 0.46, z, '#e2d6bd');
      for (const s of [-1, 1]) m.box(0.3, 0.45, 0.55, x + s * 1.1, 0.22, z, '#c9b38a');
      this.addCollider(x - 1.3, z - 0.3, x + 1.3, z + 0.3);
    }
  },

  /** East annex: the ninja course. */
  buildNinja() {
    const m = this.matte;
    const mt = this.metal;
    const glow = this.glow;
    const Z = ROOM.z;
    this.floorPatch(93, -Z + 1, 131, Z - 1, ['#16213e', '#1a2a50'], 2);
    for (const z of [-8, 8]) {
      m.box(1.4, ROOM.h, 1.4, 91.5, ROOM.h / 2, z, '#2a3550');
      glow.box(1.45, 0.14, 1.45, 91.5, 2.2, z, '#ff4da6');
      this.addCollider(90.8, z - 0.7, 92.2, z + 0.7);
    }
    m.box(1.4, 1.6, 17.4, 91.5, ROOM.h - 1.2, 0, '#2a3550');
    // monkey bars over a glowing pool
    for (const x of [100, 105]) {
      const z0 = -24;
      glow.box(2.2, 0.03, 5.6, x, 0.02, z0 + 2.3, '#1f7ae0');
      for (const s of [-1, 1]) {
        for (const z of [z0 - 0.4, z0 + 4.8]) {
          mt.box(0.12, 2.9, 0.12, x + s * 0.6, 1.45, z, '#ff4da6');
          this.addCollider(x + s * 0.6 - 0.08, z - 0.08, x + s * 0.6 + 0.08, z + 0.08);
        }
        mt.box(0.1, 0.1, 5.4, x + s * 0.6, 2.85, z0 + 2.2, '#ff4da6');
      }
      for (let k = 0; k < 9; k++) mt.cyl(0.03, 1.2, x, 2.82, z0 + 0.1 + k * 0.6, '#ffd34d', 0, 0, Math.PI / 2, 8);
      this.addStation(x, z0, 0, ['monkeybars'], { equip: 'nbars', ax: x, az: z0 + 4.2, bar: { y: 2.82, f: 0 } });
    }
    // salmon ladder against the north wall
    for (const x of [112, 116.5]) {
      const z = -Z + 1.3;
      for (const s of [-1, 1]) mt.box(0.14, 5.4, 0.14, x + s * 0.8, 2.7, z - 0.33, '#2ecc71');
      for (let k = 0; k < 5; k++) mt.box(1.8, 0.06, 0.12, x, 2.5 + k * 0.55, z - 0.33, '#c9ced6');
      for (const s of [-1, 1]) this.addCollider(x + s * 0.8 - 0.09, z - 0.42, x + s * 0.8 + 0.09, z - 0.24);
      this.addStation(x, z, Math.PI, ['salmon'], { equip: 'nsalmon', ax: x, az: z + 1.4, bar: { y: 2.5, f: 0.33 } });
    }
    // the warped wall: a quarter pipe ending in a platform
    {
      // a true quarter circle: flat at the bottom, vertical at the top, solid underneath
      const zw = -13.6;
      const R = WARP.R;
      const N = 16;
      for (let k = 0; k < N; k++) {
        const a0 = (k / N) * (Math.PI / 2);
        const a1 = ((k + 1) / N) * (Math.PI / 2);
        const am = (a0 + a1) / 2;
        const len = 2 * R * Math.sin((a1 - a0) / 2) + 0.03;
        // the slat's top face lies on the curve (rotated to its tangent); a solid column fills below
        m.box(7, 0.12, len, 123, R * (1 - Math.cos(am)) - 0.06 * Math.cos(am), zw - (R + 0.06) * Math.sin(am), k % 2 ? '#ff7b00' : '#ffb347', 0, am);
        const y0 = R * (1 - Math.cos(a0));
        const u0 = R * Math.sin(a0);
        const u1 = R * Math.sin(a1);
        if (y0 > 0.02) m.box(7, y0, u1 - u0, 123, y0 / 2, zw - (u0 + u1) / 2, '#2c3140');
      }
      m.box(7, R, 2.4, 123, R / 2, zw - R - 1.2, '#2c3140');
      glow.box(7.05, 0.1, 0.1, 123, R + 0.02, zw - R, '#ffd34d');
      this.addCollider(119.5, zw - R - 2.4, 126.5, zw - 0.5);
      for (const x of [121, 125]) this.addStation(x, zw + WARP.f0, Math.PI, ['warpwall'], { equip: 'nwarp', ax: x, az: zw - WARP.R - WARP.back - WARP.land });
    }
    // quintuple steps: tilted blocks left and right
    for (const x of [99, 105]) {
      const z0 = 4;
      for (let k = 0; k < 5; k++) {
        const s = k % 2 ? 1 : -1;
        m.box(0.9, 0.3, 0.9, x + s * 0.45, 0.15, z0 + 1.2 * (k + 1) - 0.6, k % 2 ? '#00b4d8' : '#9b5de5', 0, 0, s * 0.3);
      }
      glow.box(2.4, 0.02, 7, x, 0.015, z0 + 3, '#1f7ae0');
      this.addStation(x, z0 - 0.4, 0, ['qsteps'], { equip: 'nsteps', ax: x, az: z0 - 0.4 + 7.0 });
    }
    // balance beams
    for (const x of [112, 116]) {
      const z0 = 4;
      mt.box(0.24, 0.12, 5.8, x, 0.36, z0 + 2.8, '#ffd34d');
      for (const z of [z0 + 0.2, z0 + 5.5]) m.box(0.5, 0.3, 0.3, x, 0.15, z, '#2c3140');
      this.addCollider(x - 0.25, z0 + 0.05, x + 0.25, z0 + 5.65);
      this.addStation(x, z0 - 0.3, 0, ['beamwalk'], { equip: 'nbeam', ax: x, az: z0 - 0.3 + 6.2 });
    }
    // cargo net on the east wall
    {
      const xw = ROOM.x - 0.5;
      for (let i = 0; i < 9; i++) m.box(0.05, 6, 0.05, xw, 3, 9 + i * 1.2, '#c9a46c');
      for (let j = 0; j < 10; j++) m.box(0.05, 0.05, 9.8, xw, 0.4 + j * 0.62, 13.8, '#c9a46c');
      m.box(0.3, 0.3, 10.4, xw + 0.1, 6.1, 13.8, '#ff4da6');
      this.addCollider(xw - 0.12, 8.6, ROOM.x, 19);
      for (const z of [11.5, 16]) this.addStation(xw - 0.75, z, Math.PI / 2, ['climb'], { equip: 'nnet', ax: xw - 2.6, az: z, wall: 0.72, wallH: 6.0 });
    }
    // neon art: a giant ninja star and lightning on the walls
    const star = new THREE.Group();
    const sb = new Batch();
    for (let i = 0; i < 4; i++) sb.add(UnitGeo.cone(4), Math.cos(i * Math.PI / 2) * 1.2, Math.sin(i * Math.PI / 2) * 1.2, 0, i % 2 ? '#ff4da6' : '#7fe0ff', 0, 0, i * Math.PI / 2 - Math.PI / 2, 0.55, 1.6, 0.1);
    sb.cyl(0.45, 0.12, 0, 0, 0, '#ffd34d', Math.PI / 2, 0, 0, 16);
    star.add(new THREE.Mesh(mergeParts(sb.parts, false), GLOW_MAT));
    star.position.set(112, 7.4, 0);
    this.scene.add(star);
    this.anims.push((dt) => { star.rotation.z += dt * 0.8; });
    for (const z of [-Z + 0.1, Z - 0.1]) {
      for (let i = 0; i < 6; i++) glow.box(0.25, 2.4, 0.04, 96 + i * 6.5, 6 + (i % 2) * 0.8, z, i % 2 ? '#ff4da6' : '#7fe0ff', 0, 0, i % 2 ? 0.5 : -0.5);
    }
    this.painting('stars', ROOM.x - 0.12, 6.4, -14, -Math.PI / 2, 7);
    this.painting('runner', ROOM.x - 0.12, 6.4, -24, -Math.PI / 2, 7);
  },
});
