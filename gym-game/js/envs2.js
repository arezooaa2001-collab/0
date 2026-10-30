'use strict';
/* Four more venues: the cherry-blossom dojo garden (level 10), tennis, a boxing arena and golf. */

/** Place a part relative to a station: (lx, lz) are in the station's facing frame. */
function local(st, lx, lz) {
  const c = Math.cos(st.yaw);
  const s = Math.sin(st.yaw);
  return [st.x + lx * c + lz * s, st.z - lx * s + lz * c];
}

function blossomTree(w, x, z, s = 1, colors = ['#ffb7c5', '#ff8fab', '#ffc8dd', '#fde2e4']) {
  const m = w.matte;
  m.cyl(0.22 * s, 2.4 * s, x, 1.2 * s, z, '#6b3e26', 0.08, 0, 0.05);
  for (const [dx, dy, dz, r] of [[0.9, 2.5, 0, 0.45], [-0.8, 2.6, 0.3, 0.4], [0.2, 2.9, -0.7, 0.4]]) {
    m.cyl(0.08 * s, 1.2 * s, x + dx * 0.5 * s, dy * 0.85 * s + 0.35, z + dz * 0.5 * s, '#6b3e26', dz * 0.6, 0, -dx * 0.6);
  }
  m.cyl(0.18 * s, 1.0, x, 2.4 * s + 0.4, z, '#6b3e26');
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7;
    const r = rand(0.5, 1.4) * s;
    const rr = rand(0.7, 1.05) * s;
    // keep the blossom above head height
    m.sphere(rr, x + Math.cos(a) * r, Math.max((2.9 + rand(-0.3, 0.7)) * s + 0.4, 1.95 + rr), z + Math.sin(a) * r, colors[i % colors.length]);
  }
  w.addCollider(x - 0.3 * s, z - 0.3 * s, x + 0.3 * s, z + 0.3 * s);
}

/** A rotated rectangle as a grid of small squares, so the collision follows its real outline. */
function orientedColliders(w, cx, cz, W, D, ry, cell = 0.8) {
  const nx = Math.max(1, Math.round(W / cell));
  const nz = Math.max(1, Math.round(D / cell));
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const sx = W / nx;
  const sz = D / nz;
  const h = 0.5 * (Math.min(sx, sz) * (Math.abs(c) + Math.abs(s)));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const lx = -W / 2 + (i + 0.5) * sx;
      const lz = -D / 2 + (j + 0.5) * sz;
      const x = cx + lx * c + lz * s;
      const z = cz - lx * s + lz * c;
      w.addCollider(x - h, z - h, x + h, z + h);
    }
  }
}

/** An oval pond or basin as three overlapping rectangles that stay inside the ellipse. */
function ellipseColliders(w, cx, cz, rx, rz) {
  for (const [fx, fz] of [[0.93, 0.36], [0.78, 0.62], [0.4, 0.92]]) w.addCollider(cx - rx * fx, cz - rz * fz, cx + rx * fx, cz + rz * fz);
}

function stoneLantern(w, x, z) {
  const m = w.matte;
  m.box(0.5, 0.15, 0.5, x, 0.075, z, '#9a9a9a');
  m.cyl(0.1, 0.8, x, 0.55, z, '#a8a8a8');
  m.box(0.45, 0.35, 0.45, x, 1.1, z, '#b0b0b0');
  w.glow.box(0.3, 0.2, 0.47, x, 1.1, z, '#ffd27f');
  m.add(UnitGeo.cone(4), x, 1.45, z, '#8a8a8a', 0, Math.PI / 4, 0, 0.5, 0.35, 0.5);
  w.addCollider(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
}

function leafyTree(w, x, z, s, colors) {
  const m = w.matte;
  m.cyl(0.25 * s, 2.6 * s, x, 1.3 * s, z, '#7a4a2a');
  m.cyl(0.18 * s, 1.0, x, 2.6 * s + 0.4, z, '#7a4a2a');
  for (let i = 0; i < 5; i++) {
    const rr = rand(0.9, 1.3) * s;
    m.sphere(rr, x + rand(-0.8, 0.8) * s, Math.max((2.9 + rand(0, 1.0)) * s, 1.95 + rr), z + rand(-0.8, 0.8) * s, colors[i % colors.length]);
  }
  w.addCollider(x - 0.35 * s, z - 0.35 * s, x + 0.35 * s, z + 0.35 * s);
}

Object.assign(ENV_BUILDERS, {
  dojo() {
    const w = new EnvWorld('dojo', {
      bounds: { circle: 27 }, spawn: { x: 0, z: 21, yaw: Math.PI }, background: '#ffd9c9', fog: [70, 240],
      skyTop: '#6f86ff', skyBottom: '#ffc9b5', groundTint: 0x7a8a55,
    });
    const m = w.matte;
    m.cyl(29, 0.4, 0, -0.2, 0, '#6fb44a', 0, 0, 0, 56);
    for (let i = 0; i < 40; i++) m.cyl(rand(1, 2.4), 0.02, rand(-24, 24), 0.005, rand(-24, 24), pick(['#7cc255', '#5fa63e', '#86c95f']), 0, 0, 0, 12);
    // gravel path from the gate to the dojo
    m.box(3.2, 0.03, 18, 0, 0.015, 11, '#d9cfbf');
    for (let i = 0; i < 9; i++) m.cyl(0.55, 0.06, rand(-0.6, 0.6), 0.04, 3 + i * 2, '#a9a49b', 0, 0, 0, 10);
    // torii gate at the entrance
    for (const s of [-1, 1]) {
      m.cyl(0.22, 4.6, s * 2.2, 2.3, 17, '#d62828');
      m.cyl(0.3, 0.3, s * 2.2, 0.15, 17, '#222222');
      w.addCollider(s * 2.2 - 0.25, 16.75, s * 2.2 + 0.25, 17.25);
    }
    m.box(6.2, 0.35, 0.45, 0, 4.5, 17, '#d62828');
    m.box(6.8, 0.25, 0.55, 0, 4.85, 17, '#1d1d1d');
    m.box(5.0, 0.25, 0.3, 0, 3.8, 17, '#d62828');
    m.box(0.4, 0.7, 0.32, 0, 4.15, 17, '#1d1d1d');
    // the dojo hall: tatami floor under a big curved roof
    const DX = 0;
    const DZ = -6;
    m.box(14, 0.02, 10, DX, 0.01, DZ, '#6b4423');
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 4; j++) {
        m.box(2.1, 0.012, 2.2, DX - 5.5 + i * 2.2, 0.026, DZ - 3.45 + j * 2.3, (i + j) % 2 ? '#c9c58a' : '#d8d49a');
        m.box(2.12, 0.013, 0.08, DX - 5.5 + i * 2.2, 0.027, DZ - 3.45 + j * 2.3 - 1.08, '#2b4a2b');
      }
    }
    for (const [x, z] of [[-6.8, -10.8], [6.8, -10.8], [-6.8, -1.2], [6.8, -1.2], [0, -10.8]]) {
      m.cyl(0.18, 4.2, DX + x, 2.1, z, '#8b1e1e');
      w.addCollider(DX + x - 0.2, z - 0.2, DX + x + 0.2, z + 0.2);
    }
    m.box(15.6, 0.3, 11.4, DX, 4.3, DZ, '#3a2a20');
    m.add(UnitGeo.cone(4), DX, 5.6, DZ, '#5a2626', 0, Math.PI / 4, 0, 11.5, 2.4, 8.5);
    m.add(UnitGeo.cone(4), DX, 6.9, DZ, '#d4a017', 0, Math.PI / 4, 0, 1.2, 0.6, 1.0);
    for (const s of [-1, 1]) m.box(16.4, 0.2, 0.25, DX, 4.5, DZ + s * 5.8, '#d62828');
    m.box(14, 4, 0.2, DX, 2.2, DZ - 5.0, '#f3e9d2');
    w.addCollider(DX - 7, DZ - 5.12, DX + 7, DZ - 4.88);
    for (let i = 0; i < 6; i++) m.box(0.08, 4, 0.22, DX - 6 + i * 2.4, 2.2, DZ - 4.98, '#6b4423');
    // big painted sun and a gong inside the hall
    w.glow.cyl(1.0, 0.04, DX, 2.6, DZ - 4.85, '#e63946', Math.PI / 2, 0, 0, 32);
    m.cyl(0.6, 0.08, DX + 4.5, 1.6, DZ - 4.2, '#d4a017', Math.PI / 2, 0, 0, 24);
    for (const s of [-1, 1]) m.box(0.08, 2.2, 0.08, DX + 4.5 + s * 0.75, 1.1, DZ - 4.2, '#5a3a20');
    m.box(1.6, 0.1, 0.1, DX + 4.5, 2.25, DZ - 4.2, '#5a3a20');
    // kata on the tatami
    for (const [x, z] of [[-4.4, -8], [-1.5, -8], [1.5, -8], [4.4, -8], [-3, -4], [3, -4]]) w.equipStation('tatami', 'kata', DX + x, z, 0, { ax: DX + x, az: z + 1.4 });
    // board breaking: two cinder blocks in front of each station
    for (const [x, z] of [[-9.5, 4], [-12.5, 3], [-15.5, 1.5]]) {
      const st = w.equipStation('boards', 'boardbreak', x, z, Math.PI * 0.85);
      for (const lx of [-0.22, 0.22]) {
        const [bx, bz] = local(st, lx, 0.62);
        m.box(0.14, 0.75, 0.3, bx, 0.375, bz, '#8d99ae', st.yaw);
      }
      const [cx, cz] = local(st, 0, 0.62);
      w.addCollider(cx - 0.3, cz - 0.3, cx + 0.3, cz + 0.3);
      const [mx, mz] = local(st, 0, 0.3);
      m.box(1.6, 0.03, 1.8, mx, 0.015, mz, '#c9a46c', st.yaw);
    }
    // archery range: three lanes shooting north
    for (const x of [11, 14, 17]) {
      w.equipStation('target', 'archery', x, 7, Math.PI, { ax: x - 1.2, az: 8.2 });
      const tz = -7;
      const rings = ['#ffffff', '#111111', '#2f6fed', '#e63946', '#ffd34d'];
      const tx = x - 0.35;
      rings.forEach((c, i) => m.cyl(0.62 - i * 0.12, 0.08 + i * 0.01, tx, 1.45, tz, c, Math.PI / 2, 0, 0, 24));
      m.cyl(0.66, 0.06, tx, 1.45, tz - 0.06, '#c9a46c', Math.PI / 2, 0, 0, 24);
      for (const s of [-1, 1]) m.box(0.08, 1.9, 0.08, tx + s * 0.45, 0.85, tz - 0.25, '#6b4423', 0, 0.25);
      w.addCollider(tx - 0.75, tz - 0.4, tx + 0.75, tz + 0.2);
      m.box(0.08, 0.02, 13, tx, 0.02, 0, '#ffffff');
    }
    // koi pond with a little bridge
    m.cyl(5.2, 0.05, -14, 0.03, -12, '#7d8a6a', 0, 0, 0, 32);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(4.8, 32), new THREE.MeshStandardMaterial({ color: '#2e86c1', roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.85 }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(-14, 0.07, -12);
    w.scene.add(pond);
    ellipseColliders(w, -14, -12, 5.2, 5.2);
    const koi = [];
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: pick(['#ff7b00', '#ffffff', '#ff4d4d', '#ffd34d']), roughness: 0.4 }));
      f.scale.set(0.6, 0.45, 1.6);
      w.scene.add(f);
      koi.push({ f, r: rand(1.2, 3.8), a: rand(0, TAU), s: rand(0.3, 0.7) * (Math.random() < 0.5 ? 1 : -1) });
    }
    w.anims.push((dt) => {
      for (const k of koi) {
        k.a += k.s * dt;
        k.f.position.set(-14 + Math.cos(k.a) * k.r, 0.04, -12 + Math.sin(k.a) * k.r);
        k.f.rotation.y = -k.a + (k.s > 0 ? 0 : Math.PI);
      }
    });
    for (let i = 0; i < 5; i++) {
      const u = i / 4;
      m.box(1.3, 0.12, 0.9, -14 + (u - 0.5) * 7, 0.25 + Math.sin(Math.PI * u) * 0.6, -12, '#d62828', 0, 0, -0.35 * (u - 0.5) * 2);
    }
    // bamboo groves, lanterns, cherry trees
    for (const [cx, cz] of [[-22, 6], [21, -12], [-6, 20]]) {
      let x1 = Infinity, x2 = -Infinity, z1 = Infinity, z2 = -Infinity;
      for (let i = 0; i < 9; i++) {
        const x = cx + rand(-1.4, 1.4);
        const z = cz + rand(-1.4, 1.4);
        const h = rand(4, 7);
        m.cyl(0.08, h, x, h / 2, z, pick(['#4caf50', '#66bb6a', '#7cb342']), 0, 0, 0, 6);
        x1 = Math.min(x1, x); x2 = Math.max(x2, x); z1 = Math.min(z1, z); z2 = Math.max(z2, z);
      }
      w.addCollider(x1 - 0.1, z1 - 0.1, x2 + 0.1, z2 + 0.1);
    }
    for (const [x, z] of [[-3, 14], [3, 14], [-3, 8], [3, 8], [9, -12], [-9, 10]]) stoneLantern(w, x, z);
    const trees = [[-8, 14], [8, 14], [-18, -2], [18, 2], [-10, -18], [10, -18], [20, -20], [-21, -18], [0, -19], [22, 11], [-20, 15]];
    for (const [x, z] of trees) blossomTree(w, x, z, rand(1.0, 1.3));
    // drifting petals
    w.anims.push(() => {
      for (let i = 0; i < 3; i++) w.fx.emit(rand(-24, 24), rand(5, 9), rand(-24, 24), rand(0.2, 0.8), -0.6, rand(-0.2, 0.2), new THREE.Color(pick(['#ffb7c5', '#ff8fab', '#ffffff'])), 9, 0.03);
    });
    w.freeStations([[-6, 12], [6, 12], [-16, 8], [14, -14], [-6, -16], [6, -16]], ['meditate', 'warrior', 'tree', 'frontkick', 'split', 'cobra']);
    w.sign('⛩️ باغ رزمی ساکورا', 'کاتا، شکستن تخته و کمانداری', 0, 7.2, -11, '#ff8fab');
    w.finishBatches();
    return w;
  },

  tennis() {
    const w = new EnvWorld('tennis', { bounds: { rect: [17, 17] }, spawn: { x: -9, z: 13, yaw: Math.PI * 0.75 }, background: '#cfe8ff', fog: [70, 240] });
    const m = w.matte;
    m.box(38, 0.1, 38, 0, -0.05, 0, '#3c8d5a');
    m.box(16, 0.02, 30, 0, 0.0, 0, '#2e6ab5');
    m.box(11, 0.022, 23.8, 0, 0.005, 0, '#3f7fd0');
    const L = '#ffffff';
    for (const x of [-5.49, 5.49, -4.11, 4.11]) m.box(0.06, 0.03, 23.8, x, 0.015, 0, L);
    for (const z of [-11.89, 11.89]) m.box(11, 0.03, 0.06, 0, 0.015, z, L);
    for (const z of [-6.4, 6.4]) m.box(8.22, 0.03, 0.06, 0, 0.015, z, L);
    m.box(0.06, 0.03, 12.8, 0, 0.015, 0, L);
    for (const z of [-11.8, 11.8]) m.box(0.06, 0.03, 0.25, 0, 0.015, z, L);
    // net
    for (const s of [-1, 1]) {
      w.metal.cyl(0.05, 1.07, s * 6.4, 0.53, 0, '#2c3140');
      w.addCollider(s * 6.4 - 0.1, -0.1, s * 6.4 + 0.1, 0.1);
    }
    const net = new THREE.Mesh(new THREE.PlaneGeometry(12.8, 0.9), new THREE.MeshBasicMaterial({ color: '#111111', transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    net.position.set(0, 0.5, 0);
    w.scene.add(net);
    m.box(12.8, 0.07, 0.04, 0, 0.95, 0, '#ffffff');
    w.addCollider(-6.4, -0.08, 6.4, 0.08);
    // serving from the near baseline, forehands from the far one
    for (const x of [-2.5, 2.5]) w.equipStation('tserve', 'serve', x, 12.3, Math.PI, { ax: x, az: 13.6 });
    for (const x of [-3, 0, 3]) w.equipStation('tbase', 'forehand', x, -12.4, 0, { ax: x, az: -13.6 });
    // umpire chair, ball machine, benches, stands
    w.metal.box(0.9, 0.06, 0.9, 7.6, 1.9, 0, '#2c3140');
    for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) w.metal.box(0.06, 1.9, 0.06, 7.6 + dx, 0.95, dz, '#2c3140');
    m.box(0.8, 0.6, 0.8, 7.6, 2.25, 0, '#2ecc71');
    w.addCollider(7.1, -0.5, 8.1, 0.5);
    m.box(0.8, 0.9, 0.8, -7.8, 0.45, -8, '#ff7b00');
    w.glow.sphere(0.12, -7.8, 1.0, -8, '#d7ff3d');
    w.addCollider(-8.2, -8.4, -7.4, -7.6);
    for (const [x, c] of [[-9, '#e63946'], [9, '#ffd34d']]) {
      m.box(0.5, 0.45, 3.4, x, 0.25, 6, c);
      w.addCollider(x - 0.25, 4.3, x + 0.25, 7.7);
    }
    w.stands(0, -14.6, 22, 3, Math.PI, ['#ff4da6', '#ffffff', '#ffd34d', '#00b4d8']);
    w.stands(14.2, 0, 22, 3, Math.PI / 2, ['#2ecc71', '#ffffff', '#ff7b00']);
    // hedges, flowers and flags
    for (let i = 0; i < 7; i++) m.box(2.2, 1.0, 0.9, -15.5 + i * 2.4, 0.5, 16.2, '#2b8a3e');
    w.addCollider(-16.6, 15.75, -0.0, 16.65);
    for (let i = 0; i < 30; i++) m.sphere(0.12, rand(-16.4, -0.3), 1.03, rand(15.85, 16.55), pick(['#ff4da6', '#ffd34d', '#ffffff', '#e63946', '#9b5de5']));
    for (const [x, c] of [[-14, '#e63946'], [-11, '#2f6fed'], [11, '#ffd34d'], [14, '#2ecc71']]) {
      w.metal.cyl(0.04, 5, x, 2.5, -14.8, '#d5dce6');
      m.box(1.2, 0.7, 0.03, x + 0.62, 4.55, -14.8, c);
    }
    w.freeStations([[-12, 10], [12, 12], [-12, -4], [10, -10]], ['skater', 'lunge', 'highknees', 'jack']);
    w.sign('🎾 زمین تنیس', 'سرویس از این طرف، فورهند از اون طرف', 0, 6, -15, '#d7ff3d');
    w.finishBatches();
    return w;
  },

  boxing() {
    const w = new EnvWorld('boxing', { bounds: { rect: [18, 14] }, spawn: { x: 0, z: 11, yaw: Math.PI }, background: '#0b0d18', fog: [40, 120] });
    w.ceiling = 12;
    const m = w.matte;
    m.box(38, 0.1, 30, 0, -0.05, 0, '#1b1e2b');
    for (const s of [-1, 1]) {
      m.box(38, 12, 0.4, 0, 6, s * 14.6, '#141826');
      m.box(0.4, 12, 30, s * 18.6, 6, 0, '#141826');
    }
    m.box(38, 0.3, 30, 0, 12.1, 0, '#0b0d18');
    // ring: raised canvas, corner posts, three ropes in red / white / blue
    const R = 3.4;
    m.box(R * 2 + 1, 1.0, R * 2 + 1, 0, 0.5, 0, '#1d2433');
    m.box(R * 2 + 0.6, 0.06, R * 2 + 0.6, 0, 1.03, 0, '#2f6fed');
    const logo = makeCanvasTexture(512, 512, (ctx, W) => {
      ctx.translate(W / 2, W / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.arc(0, 0, 200, 0, TAU); ctx.fill();
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `120px ${DISPLAY_FONT}`;
      ctx.fillStyle = '#ffd34d';
      ctx.fillText('بوکس', 0, 10);
    });
    const lm = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), new THREE.MeshBasicMaterial({ map: logo, transparent: true, depthWrite: false }));
    lm.rotation.x = -Math.PI / 2;
    lm.position.y = 1.065;
    w.scene.add(lm);
    const corners = [[-R, -R, '#e63946'], [R, -R, '#ffffff'], [R, R, '#2f6fed'], [-R, R, '#ffffff']];
    for (const [x, z, c] of corners) {
      w.metal.cyl(0.09, 1.5, x, 1.75, z, '#c9ced6');
      m.box(0.3, 1.2, 0.3, x, 1.65, z, c);
    }
    const ropeCols = ['#e63946', '#ffffff', '#2f6fed'];
    for (let k = 0; k < 3; k++) {
      const y = 1.45 + k * 0.32;
      for (const s of [-1, 1]) {
        m.cyl(0.03, R * 2, 0, y, s * R, ropeCols[k], 0, 0, Math.PI / 2, 8);
        m.cyl(0.03, R * 2, s * R, y, 0, ropeCols[k], Math.PI / 2, 0, 0, 8);
      }
    }
    w.addCollider(-R - 0.5, -R - 0.5, R + 0.5, R + 0.5);
    // slipping drills in the corners of the ring
    for (const [x, z, yaw] of [[-2.2, -2.2, Math.PI * 0.75], [2.2, 2.2, -Math.PI * 0.25], [2.2, -2.2, -Math.PI * 0.75], [-2.2, 2.2, Math.PI * 0.25]]) {
      w.equipStation('ropebox', 'slip', x, z, yaw, { y: 1.06, ax: x * 1.9, az: z * 1.9 + (z > 0 ? 0.6 : -0.6) });
    }
    // heavy bags in two rows around the ring
    const bagCols = ['#e63946', '#111111', '#ffd34d', '#2f6fed', '#ff7b00'];
    let bi = 0;
    for (const z of [-10, 10]) {
      for (const x of [-12, -8, 8, 12]) {
        w.metal.cyl(0.015, 1.4, x, 3.4, z, '#c9ced6', 0, 0, 0, 6);
        m.cyl(0.28, 1.2, x, 2.0, z, bagCols[bi++ % bagCols.length]);
        m.cyl(0.29, 0.1, x, 2.5, z, '#f1f1f1');
        w.addCollider(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
        const dir = z < 0 ? 1 : -1;
        w.equipStation('ring', 'combo', x, z + dir * 0.95, z < 0 ? Math.PI : 0, { ax: x + 1.2, az: z + dir * 1.6 });
      }
    }
    // coloured spotlights sweeping over the ring
    const beams = [];
    ['#ff4d6d', '#4d8bff', '#ffd34d', '#2ecc71'].forEach((c, i) => {
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 10, 20, 1, true), new THREE.MeshBasicMaterial({
        color: c, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      }));
      beam.geometry.translate(0, -5, 0);
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(i * Math.PI / 2) * 8, 11.5, Math.sin(i * Math.PI / 2) * 8);
      pivot.add(beam);
      w.scene.add(pivot);
      beams.push({ pivot, ph: i * 1.7 });
    });
    w.anims.push((dt, t) => {
      for (const b of beams) {
        b.pivot.rotation.z = Math.sin(t * 0.7 + b.ph) * 0.45;
        b.pivot.rotation.x = Math.cos(t * 0.5 + b.ph) * 0.45;
      }
    });
    w.scene.add(new THREE.PointLight('#ffffff', 0.6, 30));
    // crowd, big screen and banners
    w.stands(0, -11.4, 30, 3, Math.PI, ['#e63946', '#ffffff', '#ffd34d', '#2f6fed', '#ff4da6']);
    w.stands(0, 11.4, 30, 3, 0, ['#2ecc71', '#ffffff', '#00b4d8', '#ff7b00']);
    for (const [x, c] of [[-17.2, '#e63946'], [17.2, '#2f6fed']]) {
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.4), new THREE.MeshBasicMaterial({
        map: signTexture([{ text: x < 0 ? 'گوشه‌ی قرمز' : 'گوشه‌ی آبی', size: 120, display: true, color: '#ffffff' }], { w: 1024, h: 512, bg1: c, bg2: '#141826', border: '#ffd34d' }),
        toneMapped: false,
      }));
      ban.position.set(x, 6, 0);
      ban.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      w.scene.add(ban);
    }
    w.freeStations([[-14, -4], [14, 4], [-14, 5], [14, -5]], ['shadow', 'uppercut', 'rope', 'jack']);
    w.sign('🥊 سالن بوکس', 'کیسه‌ها برای ترکیب مشت، گوشه‌ی رینگ برای جاخالی', 0, 8.5, -12, '#ff4d6d');
    w.finishBatches();
    return w;
  },

  golf() {
    const w = new EnvWorld('golf', { bounds: { rect: [30, 26] }, spawn: { x: -4, z: 23, yaw: Math.PI }, background: '#cfe8ff', fog: [90, 300], skyTop: '#3f8cff' });
    const m = w.matte;
    m.box(64, 0.1, 56, 0, -0.05, 0, '#4caf50');
    for (let i = 0; i < 10; i++) m.box(6, 0.02, 56, -27 + i * 6, 0.0, 0, i % 2 ? '#5cbf60' : '#66c96a');
    m.box(10, 0.025, 40, 0, 0.01, -4, '#7ed957');
    // tee boxes
    m.box(12, 0.02, 3, 0, 0.014, 19.5, '#8fe388');
    for (const x of [-4.5, -1.5, 1.5, 4.5]) {
      w.equipStation('tee', 'golf', x, 19.4, Math.PI, { ax: x, az: 21.4 });
      m.cyl(0.03, 0.04, x + 0.05, 0.03, 18.78, '#ffffff', 0, 0, 0, 6);
    }
    for (const [x, c] of [[-6.5, '#e63946'], [6.5, '#2f6fed']]) m.sphere(0.18, x, 0.15, 19.5, c);
    // putting green with the hole and a flag
    const G = { x: 16, z: -8 };
    m.cyl(6, 0.016, G.x, 0.016, G.z, '#9ff08f', 0, 0, 0, 40);
    m.cyl(0.11, 0.035, G.x, 0.035, G.z, '#111111', 0, 0, 0, 16);
    w.metal.cyl(0.02, 2.4, G.x, 1.2, G.z, '#ffffff', 0, 0, 0, 6);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), new THREE.MeshStandardMaterial({ color: '#e63946', side: THREE.DoubleSide }));
    flag.position.set(G.x + 0.36, 2.15, G.z);
    w.scene.add(flag);
    w.anims.push((dt, t) => { flag.rotation.y = Math.sin(t * 3) * 0.3; });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      const x = G.x + Math.cos(a) * 4.2;
      const z = G.z + Math.sin(a) * 4.2;
      w.equipStation('green', 'putt', x, z, Math.atan2(G.x - x, G.z - z));
    }
    // a far green for the long shots
    m.cyl(5, 0.03, 0, 0.02, -22, '#9ff08f', 0, 0, 0, 40);
    w.metal.cyl(0.02, 2.4, 0, 1.2, -22, '#ffffff', 0, 0, 0, 6);
    m.box(0.7, 0.45, 0.02, 0.36, 2.15, -22, '#ffd34d');
    // bunkers and a pond
    for (const [x, z, r] of [[-5, -12, 2.6], [5, -16, 2.2], [11, -3, 1.8], [20, -12, 1.6]]) m.cyl(r, 0.03, x, 0.03, z, '#ecd9a6', 0, 0, 0, 24);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(4.5, 32), new THREE.MeshStandardMaterial({ color: '#2e86c1', roughness: 0.1, metalness: 0.2 }));
    pond.rotation.x = -Math.PI / 2;
    pond.scale.set(1.5, 1, 1);
    pond.position.set(-16, 0.05, -6);
    w.scene.add(pond);
    ellipseColliders(w, -16, -6, 6.75, 4.5);
    // autumn trees in many colours
    const tcol = [['#2f9e44', '#40c057'], ['#ff7b00', '#ffb347'], ['#ffd34d', '#f4c430'], ['#e63946', '#ff6b6b'], ['#2b8a3e', '#69db7c']];
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * rand(9, 28);
      const z = rand(-24, 24);
      if (Math.hypot(x - G.x, z - G.z) < 8 || Math.hypot(x + 16, z + 6) < 7 || (z > 15 && Math.abs(x) < 10)) continue;
      leafyTree(w, x, z, rand(0.9, 1.3), pick(tcol));
    }
    // golf cart and clubhouse
    m.box(1.4, 0.5, 2.2, -10, 0.55, 18, '#ffffff');
    m.box(1.4, 0.08, 2.0, -10, 1.8, 18, '#2ecc71');
    for (const [dx, dz] of [[-0.65, -0.9], [0.65, -0.9], [-0.65, 0.9], [0.65, 0.9]]) {
      m.cyl(0.25, 0.15, -10 + dx, 0.25, 18 + dz, '#111111', 0, 0, Math.PI / 2, 12);
      w.metal.box(0.05, 1.3, 0.05, -10 + dx * 0.95, 1.15, 18 + dz * 0.9, '#c9ced6');
    }
    w.addCollider(-10.8, 16.8, -9.2, 19.2);
    m.box(10, 3.4, 5, 18, 1.7, 21, '#f3e9d2');
    m.add(UnitGeo.cone(4), 18, 4.3, 21, '#8b2e2e', 0, Math.PI / 4, 0, 7.8, 1.8, 4.6);
    for (let i = 0; i < 4; i++) w.glow.box(1.4, 1.0, 0.05, 14.5 + i * 2.3, 1.8, 18.45, '#ffe8a3');
    w.addCollider(12.8, 18.4, 23.2, 23.6);
    w.freeStations([[-8, 10], [8, 10], [-6, 2], [6, -2]], ['toetouch', 'lunge', 'warrior', 'tree']);
    w.sign('⛳ زمین گلف', 'از سکوی ضربه دور بزن، روی گرین پات کن', 0, 6, 12, '#7ed957');
    w.finishBatches();
    return w;
  },
});
