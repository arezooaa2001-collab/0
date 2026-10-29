'use strict';
/* Two more venues: the athletics stadium (level 35) and the parkour park (level 45). */

function graffitiTexture(seed) {
  return makeCanvasTexture(512, 256, (ctx, w, h) => {
    const cols = ['#ff4da6', '#7fe0ff', '#ffd34d', '#2ecc71', '#ff7b00', '#9b5de5', '#e63946'];
    ctx.fillStyle = '#5c677d';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = cols[(i + seed) % cols.length];
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      const x = ((i * 97 + seed * 53) % w);
      const y = ((i * 61 + seed * 31) % h);
      ctx.ellipse(x, y, 40 + (i * 13) % 60, 25 + (i * 7) % 40, i, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `110px ${DISPLAY_FONT}`;
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#111111';
    const words = ['پرواز کن', 'بی‌مرز', 'آزاد باش', 'بپر!'];
    ctx.strokeText(words[seed % words.length], w / 2, h / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(words[seed % words.length], w / 2, h / 2);
  });
}

Object.assign(ENV_BUILDERS, {
  athletics() {
    const w = new EnvWorld('athletics', { bounds: { rect: [36, 26] }, spawn: { x: 0, z: 10, yaw: Math.PI }, background: '#cfe8ff', fog: [90, 280] });
    const m = w.matte;
    m.box(80, 0.1, 60, 0, -0.05, 0, '#3b9a4a');
    const A = 24;
    const B = 13;
    m.geo(ellipseRingGeometry(A, B, 5), 0, 0.01, 0, '#c4452f');
    for (let k = 0; k <= 5; k++) m.geo(ellipseRingGeometry(A + k, B + k, 0.06), 0, 0.014, 0, '#f5f5f5');
    for (let i = 0; i < 12; i++) m.box(48 / 12, 0.02, 26, -24 + (i + 0.5) * 4, 0.006, 0, i % 2 ? '#48ad57' : '#3f9d4e');
    // hurdles down the home straight (two lanes)
    for (const z of [14.5, 16.5]) {
      m.box(22, 0.02, 1.8, 0, 0.016, z, '#d1553e');
      w.equipStation('hurdlelane', 'hurdles', -9, z, Math.PI / 2, { ax: -10.2, az: z });
      for (const d of [3.9, 7.9, 12.0]) {
        for (const s of [-1, 1]) w.metal.box(0.05, 0.85, 0.05, -9 + d, 0.42, z + s * 0.75, '#2c3140');
        m.box(0.06, 0.12, 1.55, -9 + d, 0.86, z, '#ffffff');
        m.box(0.062, 0.12, 0.4, -9 + d, 0.86, z, '#111111');
      }
      m.box(0.15, 0.03, 1.8, 8, 0.02, z, '#ffffff');
    }
    // long jump runway and sand pit
    for (const z of [-4, -1]) {
      m.box(9, 0.025, 1.3, -18 + 4.25, 0.014, z, '#c4452f');
      m.box(0.2, 0.03, 1.3, -18 + 8.4, 0.017, z, '#ffffff');
      m.box(3.6, 0.06, 2.4, -18 + 10.4, 0.03, z, '#e9d8a6');
      w.equipStation('sandpit', 'longjump', -18, z, Math.PI / 2, { ax: -19.2, az: z });
    }
    // high jump: bar between two stands, a thick landing mat behind it
    const hj = w.equipStation('hjbar', 'highjump', 2, -8, Math.PI / 2, { ax: 0.8, az: -8 });
    m.box(2.6, 0.5, 4.2, hj.x + 5.4, 0.25, hj.z, '#2f6fed');
    m.box(2.62, 0.05, 4.22, hj.x + 5.4, 0.5, hj.z, '#ff4d6d');
    for (const s of [-1, 1]) w.metal.box(0.08, 2.2, 0.08, hj.x + 4.0, 1.1, hj.z + s * 2.1, '#d5dce6');
    w.metal.cyl(0.02, 4.2, hj.x + 4.0, 1.9, hj.z, '#ffd34d', Math.PI / 2, 0, 0, 8);
    w.addCollider(hj.x + 4.1, hj.z - 2.1, hj.x + 6.7, hj.z + 2.1);
    // javelin runway and throwing sector
    w.equipStation('runway', 'javelin', -22, 6, Math.PI / 2, { ax: -23.2, az: 6 });
    m.box(4, 0.025, 1.4, -20, 0.014, 6, '#c4452f');
    for (const s of [-1, 1]) m.box(30, 0.02, 0.06, -3, 0.015, 6 + s * 1.5 + s * 2.6, '#ffffff', -s * 0.09);
    // shot put circle with a toe board
    const sp = w.equipStation('shotring', 'shotput', 10, 4, Math.PI / 2, { ax: 8.6, az: 4 });
    m.cyl(1.07, 0.03, sp.x, 0.015, sp.z, '#9aa0a8', 0, 0, 0, 24);
    m.box(0.12, 0.1, 1.2, sp.x + 1.1, 0.05, sp.z, '#ffffff');
    // stands, olympic rings, flags, scoreboard
    w.stands(0, -21.5, 56, 5, Math.PI, ['#e63946', '#ffffff', '#2f6fed', '#ffd34d']);
    w.addCollider(-30, -26, 30, -21);
    const rings = [['#2f6fed', -2.4, 0], ['#111111', 0, 0], ['#e63946', 2.4, 0], ['#ffd34d', -1.2, -1.1], ['#2ecc71', 1.2, -1.1]];
    for (const [c, x, y] of rings) w.glow.geo(new THREE.TorusGeometry(1.0, 0.13, 8, 32), x, 9.5 + y, -23.5, c);
    for (let i = 0; i < 10; i++) {
      const x = -27 + i * 6;
      w.metal.cyl(0.05, 6, x, 3, 23, '#d5dce6');
      m.box(1.4, 0.8, 0.03, x + 0.72, 5.5, 23, pick(['#e63946', '#2f6fed', '#2ecc71', '#ffd34d', '#ff7b00', '#9b5de5', '#ffffff']));
    }
    w.freeStations([[-6, 2], [6, -2], [0, 6], [-10, 8]], ['highknees', 'buttkick', 'lunge', 'skater', 'starjump']);
    w.sign('🏟️ استادیوم دو و میدانی', 'مانع، پرش طول، پرش ارتفاع، نیزه، وزنه', 0, 7, -18, '#ffd34d');
    w.finishBatches();
    return w;
  },

  parkour() {
    const w = new EnvWorld('parkour', { bounds: { circle: 27 }, spawn: { x: 0, z: 22, yaw: Math.PI }, background: '#ffd9b3', fog: [70, 240], skyTop: '#ff8a5c', skyBottom: '#ffe3b3', groundTint: 0x777777 });
    const m = w.matte;
    m.cyl(29, 0.4, 0, -0.2, 0, '#8d939c', 0, 0, 0, 56);
    for (let i = 0; i < 26; i++) m.box(rand(2, 5), 0.02, rand(2, 5), rand(-22, 22), 0.006, rand(-22, 22), pick(['#9aa1ab', '#7d848e', '#a6adb7']), rand(0, 3));
    // painted court lines and arrows
    m.geo(ellipseRingGeometry(8, 8, 0.25), 0, 0.012, 0, '#ffd34d');
    m.geo(ellipseRingGeometry(14, 14, 0.25), 0, 0.012, 0, '#ff4da6');
    // low walls to vault (run 1.8 m, wall at 2.6–3.2 m)
    const vaultCols = ['#ff4da6', '#7fe0ff', '#ffd34d', '#2ecc71'];
    [[-14, -4, Math.PI / 2], [-14, 2, Math.PI / 2], [14, -6, -Math.PI / 2], [14, 0, -Math.PI / 2]].forEach(([x, z, yaw], i) => {
      const st = w.equipStation('pkwall', 'vault', x, z, yaw, { ax: x - Math.sin(yaw) * 1.2, az: z - Math.cos(yaw) * 1.2 });
      const [cx, cz] = local(st, 0, 2.9);
      m.box(0.6, 0.9, 2.2, cx, 0.45, cz, vaultCols[i], yaw);
      m.box(0.64, 0.06, 2.24, cx, 0.92, cz, '#2c3140', yaw);
      w.addCollider(cx - 1.1, cz - 1.1, cx + 1.1, cz + 1.1);
    });
    // tall graffiti walls for wall flips (wall face 2.1 m ahead)
    [[-6, -14, Math.PI], [0, -14, Math.PI], [6, -14, Math.PI]].forEach(([x, z, yaw], i) => {
      const st = w.equipStation('pkflip', 'wallflip', x, z + 0.0, yaw, { ax: x, az: z + 1.4 });
      const [cx, cz] = local(st, 0, 2.4);
      m.box(4.4, 3.2, 0.6, cx, 1.6, cz, '#5c677d');
      w.addCollider(cx - 2.2, cz - 0.3, cx + 2.2, cz + 0.3);
      const g = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 2.15), new THREE.MeshBasicMaterial({ map: graffitiTexture(i), toneMapped: false }));
      g.position.set(cx, 1.6, cz + 0.31);
      w.scene.add(g);
    });
    // precision blocks (60 cm, just ahead)
    [[-4, 6, 0], [0, 6, 0], [4, 6, 0], [-8, 10, 0.4], [8, 10, -0.4]].forEach(([x, z, yaw]) => {
      const st = w.equipStation('pkblock', 'boxjump', x, z, yaw, { ax: x, az: z - 1.2 });
      const [cx, cz] = local(st, 0, 0.75);
      m.box(0.62, 0.6, 0.62, cx, 0.3, cz, pick(['#c9ced6', '#ffd34d', '#ff7b00']), yaw);
      w.addCollider(cx - 0.31, cz - 0.31, cx + 0.31, cz + 0.31);
    });
    // containers, rails, ramps, lamps and trees
    for (const [x, z, c, ry] of [[-20, -12, '#e63946', 0.5], [20, -12, '#2f6fed', -0.5], [-22, 8, '#2ecc71', 1.3], [22, 8, '#ff7b00', -1.3]]) {
      m.box(6, 2.6, 2.4, x, 1.3, z, c, ry);
      for (let k = 0; k < 8; k++) m.box(0.06, 2.4, 2.42, x + Math.cos(ry) * (-2.8 + k * 0.8), 1.3, z - Math.sin(ry) * (-2.8 + k * 0.8), '#1d2433', ry);
      w.addCollider(x - 3, z - 3, x + 3, z + 3);
    }
    for (const [x, z] of [[-10, 14], [10, 14]]) {
      for (const s of [-1, 1]) w.metal.box(0.06, 0.8, 0.06, x + s * 2, 0.4, z, '#2c3140');
      w.metal.cyl(0.04, 4.1, x, 0.8, z, '#ffd34d', 0, 0, Math.PI / 2, 8);
    }
    for (const [x, z, ry] of [[0, -22, 0], [-17, 18, 0.8], [17, 18, -0.8]]) {
      m.add(UnitGeo.box(), x, 0.6, z, '#9aa1ab', -0.3, ry, 0, 4, 0.2, 3);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2;
      const x = Math.cos(a) * 24;
      const z = Math.sin(a) * 24;
      w.metal.cyl(0.07, 4.5, x, 2.25, z, '#2c3140');
      w.glow.sphere(0.25, x, 4.6, z, '#ffe8a3');
      if (i % 2) {
        m.cyl(0.9, 0.6, x * 0.85, 0.3, z * 0.85, '#7d848e', 0, 0, 0, 12);
        m.sphere(1.0, x * 0.85, 1.6, z * 0.85, pick(['#2f9e44', '#40c057']));
        w.addCollider(x * 0.85 - 0.9, z * 0.85 - 0.9, x * 0.85 + 0.9, z * 0.85 + 0.9);
      }
    }
    w.freeStations([[-4, -4], [4, -4], [0, 14], [-12, 18]], ['backflip', 'frontflip', 'cartwheel', 'jumpspin', 'dbackflip', 'spin1080']);
    w.sign('🧱 پارک پارکور', 'پرش از مانع، ملق از دیوار، پرش دقیق', 0, 6.5, -20, '#ff4da6');
    w.finishBatches();
    return w;
  },
});
