'use strict';
/* Seven sports venues reached from the map. Each has its own equipment-only exercises. */

class EnvWorld extends WorldBase {
  constructor(env, opts) {
    super(opts);
    this.env = env;
    this.scene.add(skyDome(opts.skyTop || '#4f9bff', opts.skyBottom || '#e8f4ff'));
    this.scene.add(new THREE.HemisphereLight(0xffffff, opts.groundTint || 0x887766, 0.95));
    const sun = new THREE.DirectionalLight(0xfff2d8, 0.85);
    sun.position.set(20, 35, 12);
    this.scene.add(sun);
    this.clouds = cloudField(22, 45, 170, 18, 45);
    this.scene.add(this.clouds);
    this.anims = [];
  }

  /** A machine station: people stand at (x, z[, y]) facing yaw and do `anim`. */
  equipStation(type, anim, x, z, yaw, extra = {}) {
    return this.addStation(x, z, yaw, [anim], Object.assign({ equip: type }, extra));
  }

  /** Free spots where visitors do bodyweight moves. */
  freeStations(list, acts) {
    for (const [x, z] of list) this.addStation(x, z, rand(-Math.PI, Math.PI), acts);
  }

  sign(text, sub, x, y, z, color = '#ffc23d') {
    const s = labelSprite(text, sub, color, 4);
    s.position.set(x, y, z);
    this.scene.add(s);
  }

  stands(x, z, w, rows, ry, colors) {
    const m = this.matte;
    {
      const ex = x + Math.sin(ry) * (rows - 1);
      const ez = z + Math.cos(ry) * (rows - 1);
      const side = Math.abs(Math.sin(ry)) < 0.5;
      if (side) this.addCollider(x - w / 2, Math.min(z, ez) - 0.5, x + w / 2, Math.max(z, ez) + 0.5);
      else this.addCollider(Math.min(x, ex) - 0.5, z - w / 2, Math.max(x, ex) + 0.5, z + w / 2);
    }
    for (let r = 0; r < rows; r++) {
      const h = 0.45 + r * 0.55;
      const off = r * 1.0;
      const px = x + Math.sin(ry) * off;
      const pz = z + Math.cos(ry) * off;
      m.box(w, h, 1.0, px, h / 2, pz, r % 2 ? '#3a4560' : '#2f3850', ry);
      const n = Math.floor(w / 0.8);
      for (let i = 0; i < n; i++) {
        if (Math.random() < 0.3) continue;
        const u = -w / 2 + 0.4 + i * 0.8;
        const cx = px + Math.cos(ry) * u;
        const cz = pz - Math.sin(ry) * u;
        m.box(0.42, 0.55, 0.3, cx, h + 0.3, cz, pick(colors || PALETTE.shirts), ry);
        m.sphere(0.13, cx, h + 0.72, cz, pick(PALETTE.skins));
      }
    }
  }

  updateExtra(dt) {
    this.clouds.rotation.y += dt * 0.006;
    for (const f of this.anims) f(dt, this.time);
  }
}

function buildEnv(id) {
  return ENV_BUILDERS[id]();
}

const ENV_BUILDERS = {
  pool() {
    const w = new EnvWorld('pool', { bounds: { rect: [20, 14] }, spawn: { x: 0, z: 9.4, yaw: Math.PI }, background: '#bfe0ff', fog: [60, 220] });
    const m = w.matte;
    m.box(40, 0.1, 28, 0, -0.05, 0, '#e3edf3');
    m.box(26, 0.02, 13, 0, 0.0, -2, '#1d5f9e');
    for (let i = 0; i < 7; i++) m.box(25, 0.025, 0.08, 0, 0.012, -8 + i * 2, i === 0 || i === 6 ? '#f5f5f5' : '#123f6b');
    m.box(26.6, 0.25, 0.3, 0, 0.12, -8.65, '#f5f5f5');
    m.box(26.6, 0.25, 0.3, 0, 0.12, 4.65, '#f5f5f5');
    m.box(0.3, 0.25, 13.6, -13.15, 0.12, -2, '#f5f5f5');
    m.box(0.3, 0.25, 13.6, 13.15, 0.12, -2, '#f5f5f5');
    for (let i = 0; i < 5; i++) {
      const z = -7 + i * 2.4;
      for (let k = 0; k < 12; k++) m.sphere(0.06, -12 + k * 2.2, 0.07, z + 1.2, k % 2 ? '#e63946' : '#ffffff');
    }
    const water = new THREE.Mesh(new THREE.PlaneGeometry(26, 13), new THREE.MeshStandardMaterial({ color: '#36a9ff', transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.2 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.06, -2);
    w.scene.add(water);
    w.anims.push((dt, t) => { water.material.opacity = 0.5 + 0.06 * Math.sin(t * 1.7); });
    // diving tower
    m.box(2.2, 2.2, 2.2, 0, 1.1, -10.3, '#e9eef7');
    w.metal.box(1.0, 0.1, 2.2, 0, 2.25, -8.4, '#2f6fed');
    for (let i = 0; i < 6; i++) w.metal.box(0.5, 0.06, 0.2, 1.4, 0.35 + i * 0.36, -10.3 + 0.2, '#9aa0a8');
    w.addCollider(-1.1, -11.4, 1.1, -9.2);
    w.equipStation('dive', 'dive', 0, -8.0, 0, { y: 2.3, ax: 2.2, az: -9.6 });
    for (let lane = 0; lane < 5; lane++) {
      const z = -7 + lane * 2.4 + 1.2;
      w.equipStation('swim', 'swim', -8 + (lane % 2) * 16, z, lane % 2 ? -Math.PI / 2 : Math.PI / 2, { ax: -8 + (lane % 2) * 16, az: 6.2 });
    }
    w.stands(0, 10.8, 30, 3, 0, null);
    // lifeguard chair and umbrellas
    m.box(0.8, 1.8, 0.8, 15, 0.9, -2, '#e63946');
    w.addCollider(14.5, -2.5, 15.5, -1.5);
    for (const [x, z] of [[-17, 5], [17, 5], [-17, -9], [17, -9]]) {
      m.cyl(0.05, 2.2, x, 1.1, z, '#9aa0a8');
      m.add(UnitGeo.cone(16), x, 2.3, z, pick(['#ff7b00', '#2f6fed', '#e63946']), 0, 0, 0, 1.4, 0.6, 1.4);
    }
    w.freeStations([[-16, 6], [16, 6], [-16, -6], [16, -6]], ['toetouch', 'tree', 'jack', 'lunge']);
    w.sign('🏊 استخر المپیک', 'شنای کرال و شیرجه', 0, 5.5, -12, '#7fe0ff');
    w.finishBatches();
    return w;
  },

  stadium() {
    const w = new EnvWorld('stadium', { bounds: { rect: [34, 22] }, spawn: { x: 0, z: 14, yaw: Math.PI }, background: '#bfe0ff', fog: [80, 260] });
    const m = w.matte;
    m.box(72, 0.1, 48, 0, -0.05, 0, '#2f7d3b');
    for (let i = 0; i < 12; i++) m.box(5, 0.02, 34, -27.5 + i * 5, 0.01, 0, i % 2 ? '#3a9d4a' : '#45ad55');
    m.box(0.15, 0.03, 34, 0, 0.02, 0, '#ffffff');
    m.geo(ellipseRingGeometry(4.5, 4.5, 0.15), 0, 0.025, 0, '#ffffff');
    for (const s of [-1, 1]) {
      m.box(55, 0.03, 0.15, 0, 0.02, s * 17, '#ffffff');
      m.box(0.15, 0.03, 34, s * 27.5, 0.02, 0, '#ffffff');
      m.box(0.15, 0.03, 16, s * 11.5, 0.02, 0, '#ffffff');
      m.box(16, 0.03, 0.15, s * 19.5, 0.02, 8, '#ffffff');
      m.box(16, 0.03, 0.15, s * 19.5, 0.02, -8, '#ffffff');
      // goal
      const gx = s * 29.5;
      w.metal.box(0.15, 2.44, 0.15, gx, 1.22, -3.66, '#ffffff');
      w.metal.box(0.15, 2.44, 0.15, gx, 1.22, 3.66, '#ffffff');
      w.metal.box(0.15, 0.15, 7.5, gx, 2.44, 0, '#ffffff');
      m.box(1.5, 0.05, 7.4, gx + s * 0.75, 2.42, 0, '#d9dde3');
      w.addCollider(gx - 0.1, -3.8, gx + 0.1, -3.5);
      w.addCollider(gx - 0.1, 3.5, gx + 0.1, 3.8);
      for (const z of [-2.5, 0, 2.5]) w.equipStation('goal', 'penalty', s * 18.5, z, s > 0 ? Math.PI / 2 : -Math.PI / 2, { ax: s * 17.2, az: z });
    }
    const net = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const n = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 2.44), net);
      n.position.set(s * 31, 1.22, 0);
      n.rotation.y = Math.PI / 2;
      w.scene.add(n);
    }
    w.stands(0, -23.5, 60, 5, 0, ['#e63946', '#ffffff', '#e63946', '#2f6fed']);
    w.stands(0, 23.5, 60, 5, Math.PI, ['#2ecc71', '#ffffff', '#ffd34d']);
    w.freeStations([[-8, -8], [8, 8], [-5, 6], [6, -6], [0, 10], [-14, 2]], ['highknees', 'skater', 'buttkick', 'jumpsquat', 'lunge', 'starjump']);
    w.sign('🏟️ ورزشگاه فوتبال', 'برو جلوی دروازه و پنالتی بزن', 0, 6, -18, '#2ecc71');
    w.finishBatches();
    return w;
  },

  court() {
    const w = new EnvWorld('court', { bounds: { rect: [18, 12] }, spawn: { x: 0, z: 9, yaw: Math.PI }, background: '#bfe0ff', fog: [60, 220] });
    const m = w.matte;
    m.box(44, 0.1, 32, 0, -0.05, 0, '#5a6b85');
    m.box(30, 0.02, 17, 0, 0.0, 0, '#e8742a');
    m.box(0.12, 0.03, 17, 0, 0.015, 0, '#ffffff');
    m.geo(ellipseRingGeometry(1.8, 1.8, 0.12), 0, 0.02, 0, '#ffffff');
    for (const s of [-1, 1]) {
      m.box(5.8, 0.025, 4.9, s * 12.1, 0.012, 0, '#c45a1a');
      m.geo(ellipseRingGeometry(6.7, 6.7, 0.12), s * 13.6, 0.022, 0, '#ffffff');
      const hx = s * 14.6;
      w.metal.cyl(0.12, 3.6, hx + s * 0.8, 1.8, 0, '#2c3140');
      w.metal.box(1.2, 0.12, 0.12, hx + s * 0.25, 3.5, 0, '#2c3140');
      m.box(0.06, 1.05, 1.8, hx - s * 0.1, 3.4, 0, '#f5f5f5');
      m.box(0.065, 0.45, 0.6, hx - s * 0.11, 3.25, 0, '#e63946');
      w.metal.geo(UnitGeo.torus(1, 0.08, 6, 24), hx - s * 0.45, 3.05, 0, '#ff7b00', Math.PI / 2, 0, 0, 0.23);
      w.addCollider(hx + s * 0.6, -0.3, hx + s * 1.0, 0.3);
      for (const z of [-2.2, 0, 2.2]) w.equipStation('hoop', 'basket', hx - s * 0.45 - s * 4.4, z * 0.6, s > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    // fence
    for (let i = 0; i <= 18; i++) {
      for (const z of [-11.5, 11.5]) w.metal.box(0.08, 3, 0.08, -18 + i * 2, 1.5, z, '#9aa0a8');
    }
    const fence = new THREE.MeshBasicMaterial({ color: '#c9d3e0', transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    for (const z of [-11.5, 11.5]) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(36, 3), fence);
      f.position.set(0, 1.5, z);
      w.scene.add(f);
    }
    w.freeStations([[-6, 5], [6, -5], [-3, -6], [4, 6]], ['shadow', 'burpee', 'jumpsquat', 'highknees']);
    w.sign('🏀 زمین بسکتبال', 'جلوی حلقه برو و پرتاب کن', 0, 5, -12, '#ff7b00');
    w.finishBatches();
    return w;
  },

  beach() {
    const w = new EnvWorld('beach', { bounds: { circle: 26 }, spawn: { x: 0, z: 18, yaw: Math.PI }, background: '#bfe6ff', fog: [80, 260], skyTop: '#2f8cff' });
    const m = w.matte;
    m.cyl(28, 0.4, 0, -0.2, 0, '#ecd8a0', 0, 0, 0, 48);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 300), new THREE.MeshStandardMaterial({ color: '#1e90d6', roughness: 0.2, metalness: 0.1 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.1, -150);
    w.scene.add(sea);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(600, 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 }));
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(0, -0.05, -27);
    w.scene.add(foam);
    w.anims.push((dt, t) => { foam.position.z = -27 + Math.sin(t * 0.8) * 0.8; });
    for (const cz of [-6, 6]) {
      for (const s of [-1, 1]) w.metal.box(0.12, 2.6, 0.12, 0, 1.3, cz + s * 4.6, '#f5f5f5');
      m.box(0.05, 0.9, 9.0, 0, 2.05, cz, '#f5f5f5');
      w.addCollider(-0.12, cz - 4.75, 0.12, cz - 4.45);
      w.addCollider(-0.12, cz + 4.45, 0.12, cz + 4.75);
      m.box(16, 0.02, 8, 0, 0.01, cz, '#e3c98a');
      for (const z of [-2, 2]) {
        w.equipStation('net', 'spike', -1.6, cz + z, Math.PI / 2);
        w.equipStation('net', 'spike', 1.6, cz + z, -Math.PI / 2);
      }
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.3;
      const x = Math.cos(a) * 21;
      const z = Math.sin(a) * 21;
      if (z < -15) continue;
      m.cyl(0.22, 5, x, 2.5, z, '#8b5a2b', 0.1, 0, 0.1);
      for (let k = 0; k < 6; k++) m.add(UnitGeo.box(), x + Math.cos(k) * 1.2, 5.1, z + Math.sin(k) * 1.2, '#2f9e44', 0.3 * Math.sin(k), k, 0.3 * Math.cos(k), 2.4, 0.08, 0.7);
      w.addCollider(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
    }
    for (const [x, z, c] of [[-12, 12, '#e63946'], [12, 12, '#ffd34d'], [-15, -2, '#2f6fed']]) {
      m.cyl(0.05, 2.2, x, 1.1, z, '#f5f5f5');
      m.add(UnitGeo.cone(16), x, 2.3, z, c, 0, 0, 0, 1.6, 0.6, 1.6);
      m.box(1.0, 0.03, 2.0, x + 1.2, 0.02, z, pick(['#ff4d8d', '#39c0ff', '#ffbe0b']));
    }
    w.freeStations([[-10, 8], [10, 8], [8, -12], [-8, -12], [0, 14]], ['jack', 'cartwheel', 'skater', 'starjump', 'lunge']);
    w.sign('🏖️ ساحل والیبال', 'کنار تور برو و اسپک بزن', 0, 5.5, -14, '#ffd34d');
    w.finishBatches();
    return w;
  },

  gymnastics() {
    const w = new EnvWorld('gymnastics', { bounds: { rect: [20, 13] }, spawn: { x: 0, z: 10, yaw: Math.PI }, background: '#1a2238', fog: [50, 140] });
    w.ceiling = 11;
    const m = w.matte;
    const cloudTex = cloudSkyTexture();
    const cloudMat = new THREE.MeshBasicMaterial({ map: cloudTex, toneMapped: false });
    m.box(42, 0.1, 28, 0, -0.05, 0, '#c9a46c');
    m.box(34, 0.04, 18, 0, 0.0, 0, '#2556c4');
    for (const s of [-1, 1]) {
      m.box(42, 11, 0.4, 0, 5.5, s * 14, '#d7deea');
      m.box(0.4, 11, 28, s * 21, 5.5, 0, '#d7deea');
      for (let x = -16; x <= 16; x += 8) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), cloudMat);
        win.position.set(x, 7, s * 13.78);
        if (s > 0) win.rotation.y = Math.PI;
        w.scene.add(win);
      }
    }
    m.box(42, 0.3, 28, 0, 11.1, 0, '#232a3b');
    w.anims.push((dt) => { cloudTex.offset.x = (cloudTex.offset.x + dt * 0.006) % 1; });
    // high bar (bar along z, gymnast faces +x)
    for (const z of [-1.3, 1.3]) {
      w.metal.box(0.1, 2.75, 0.1, -12, 1.37, z, '#c9d3e0');
      w.addCollider(-12.08, z - 0.08, -11.92, z + 0.08);
    }
    w.metal.cyl(0.03, 2.6, -12, 2.7, 0, '#e0e4ea', Math.PI / 2, 0, 0);
    m.box(4, 0.15, 4, -12, 0.075, 0, '#1d3f8f');
    w.equipStation('highbar', 'giantswing', -12, 0, Math.PI / 2, { ax: -10.6, az: 1.8 });
    // rings
    w.metal.box(0.12, 5.2, 0.12, -5, 2.6, -1.6, '#c9d3e0');
    w.metal.box(0.12, 5.2, 0.12, -5, 2.6, 1.6, '#c9d3e0');
    w.metal.box(0.12, 0.12, 3.3, -5, 5.2, 0, '#c9d3e0');
    for (const z of [-0.3, 0.3]) {
      w.metal.cyl(0.01, 2.6, -5, 3.9, z, '#d9c49a');
      w.metal.geo(UnitGeo.torus(1, 0.12, 6, 20), -5, 2.5, z, '#8b5a2b', 0, Math.PI / 2, 0, 0.11);
    }
    w.addCollider(-5.1, -1.7, -4.9, -1.5);
    w.addCollider(-5.1, 1.5, -4.9, 1.7);
    w.equipStation('rings', 'rings', -5, 0, Math.PI / 2, { ax: -3.8, az: 1.3 });
    // parallel bars (bars along x at z = ±0.3)
    for (const z of [-0.32, 0.32]) {
      w.metal.cyl(0.03, 3.2, 3, 1.25, z, '#e0e4ea', 0, 0, Math.PI / 2);
      for (const x of [1.8, 4.2]) w.metal.box(0.06, 1.25, 0.06, x, 0.62, z, '#c9d3e0');
    }
    w.addCollider(1.72, -0.4, 4.28, 0.4);
    w.equipStation('pbars', 'parallel', 3, 0, Math.PI / 2, { ax: 3, az: 1.4 });
    // trampolines
    for (const [x, z] of [[11, -4], [11, 4]]) {
      m.cyl(1.5, 0.55, x, 0.3, z, '#2c3140');
      m.cyl(1.3, 0.04, x, 0.6, z, '#111111');
      w.metal.geo(UnitGeo.torus(1, 0.05, 6, 32), x, 0.6, z, '#2f6fed', Math.PI / 2, 0, 0, 1.45);
      w.addCollider(x - 1.3, z - 1.3, x + 1.3, z + 1.3);
      w.equipStation('tramp', 'trampoline', x, z, -Math.PI / 2, { y: 0.62, ax: x - 2.1, az: z });
    }
    // beam and vault (decor)
    m.box(5, 0.12, 0.12, 4, 1.2, 8, '#d9c49a');
    for (const x of [2, 6]) m.box(0.1, 1.2, 0.4, x, 0.6, 8, '#9aa0a8');
    w.addCollider(1.4, 7.8, 6.6, 8.2);
    w.freeStations([[-8, 7], [-2, 8], [8, 9], [-14, -8], [14, -9]], ['split', 'cartwheel', 'headspin', 'handstand', 'backflip', 'tree']);
    w.sign('🤸 سالن ژیمناستیک', 'بارفیکس، حلقه، پارالل، ترامپولین', 0, 8.5, -13.4, '#7fe0ff');
    w.finishBatches();
    return w;
  },

  ice() {
    const w = new EnvWorld('ice', { bounds: { circle: 26 }, spawn: { x: 0, z: 18, yaw: Math.PI }, background: '#dbe9f7', fog: [60, 220], skyTop: '#8fb3d9', skyBottom: '#f2f7ff', groundTint: 0xaabbcc });
    const m = w.matte;
    m.cyl(28, 0.4, 0, -0.2, 0, '#f4f8fc', 0, 0, 0, 48);
    const ice = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshStandardMaterial({ color: '#cfe9ff', roughness: 0.05, metalness: 0.3 }));
    ice.rotation.x = -Math.PI / 2;
    ice.scale.set(16, 10, 1);
    ice.position.y = 0.02;
    w.scene.add(ice);
    // the boards are solid; a gap on the spawn side is the way onto the ice
    for (let i = 0; i < 64; i++) {
      if (i >= 15 && i <= 17) continue;
      const a = (i / 64) * TAU;
      const bx = Math.cos(a) * 16.2;
      const bz = Math.sin(a) * 10.2;
      // turned along the oval's tangent so neighbours meet
      const ry = Math.atan2(-10.2 * Math.cos(a), -16.2 * Math.sin(a));
      m.box(1.75, 0.9, 0.12, bx, 0.45, bz, i % 8 === 0 ? '#e63946' : '#ffffff', ry);
      for (const u of [-0.6, 0, 0.6]) {
        const tx = -Math.sin(a) * 16.2;
        const tz = Math.cos(a) * 10.2;
        const tl = Math.hypot(tx, tz);
        const cx = bx + (tx / tl) * u;
        const cz = bz + (tz / tl) * u;
        w.addCollider(cx - 0.16, cz - 0.16, cx + 0.16, cz + 0.16);
      }
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      w.equipStation('ice', 'skate', Math.cos(a) * 9, Math.sin(a) * 5.5, a + Math.PI / 2);
    }
    w.equipStation('ice', 'skate', 0, 0, 0);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const x = Math.cos(a) * 21;
      const z = Math.sin(a) * 21;
      if (Math.hypot(x, z - 18) < 5) continue;
      m.cyl(0.18, 2.0, x, 1.0, z, '#6b4423');
      m.add(UnitGeo.cone(12), x, 3.15, z, '#1f6b3a', 0, 0, 0, 1.3, 2.4, 1.3);
      m.add(UnitGeo.cone(12), x, 4.25, z, '#f5f8ff', 0, 0, 0, 0.7, 0.8, 0.7);
      w.addCollider(x - 0.4, z - 0.4, x + 0.4, z + 0.4);
    }
    // string lights
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * TAU;
      if (a > 1.35 && a < 1.8) continue;
      w.glow.sphere(0.09, Math.cos(a) * 16.2, 0.95, Math.sin(a) * 10.2, pick(['#ff4d6d', '#ffd34d', '#7fe0ff', '#2ecc71']));
    }
    w.anims.push((dt) => {
      for (let i = 0; i < 2; i++) w.fx.emit(rand(-26, 26), 12, rand(-26, 26), rand(-0.3, 0.3), -0.8, rand(-0.3, 0.3), new THREE.Color('#ffffff'), 9, 0.05);
    });
    w.freeStations([[-14, 13], [14, 13], [0, -15]], ['jack', 'highknees', 'starjump']);
    w.sign('⛸️ پیست یخ', 'روی یخ برو و اسکیت کن', 0, 5, -12, '#7fe0ff');
    w.finishBatches();
    return w;
  },

  snow() {
    const w = new EnvWorld('snow', { bounds: { circle: 30 }, spawn: { x: 0, z: 22, yaw: Math.PI }, background: '#dfeaf6', fog: [70, 260], skyTop: '#7aa6d6', skyBottom: '#f4f8ff', groundTint: 0xaabbcc });
    const m = w.matte;
    m.cyl(32, 0.4, 0, -0.2, 0, '#f7fbff', 0, 0, 0, 56);
    for (const [x, z, r, h] of [[-40, -45, 22, 30], [10, -60, 28, 40], [50, -30, 20, 26], [-60, 10, 18, 22], [55, 25, 16, 20]]) {
      m.add(UnitGeo.cone(20), x, h / 2, z, '#7d8ea3', 0, 0, 0, r, h, r);
      m.add(UnitGeo.cone(20), x, h * 0.82, z, '#ffffff', 0, 0, 0, r * 0.38, h * 0.36, r * 0.38);
    }
    // climbing wall
    m.box(12, 10.4, 1.4, 0, 5.2, -24, '#8a7a6a');
    m.box(5, 4, 1.6, -5, 10.6, -24.1, '#9a8a7a');
    m.box(4, 3, 1.6, 4.5, 11.2, -24.1, '#7a6a5a');
    for (let i = 0; i < 80; i++) m.sphere(0.1, rand(-5.5, 5.5), rand(0.5, 10.0), -23.25, pick(['#e63946', '#ffd34d', '#2ecc71', '#2f6fed']));
    w.addCollider(-6, -24.8, 6, -23.3);
    for (const x of [-3.5, 0, 3.5]) w.equipStation('wall', 'climb', x, -22.6, Math.PI, { ax: x, az: -21.2, wall: 0.65, wallH: 10.0 });
    // ski piste with gates
    m.box(10, 0.03, 30, 14, 0.02, 0, '#e8f1fb');
    for (let i = 0; i < 6; i++) {
      const z = -12 + i * 5;
      const x = 14 + (i % 2 ? 2.5 : -2.5);
      w.metal.cyl(0.03, 1.4, x, 0.7, z, i % 2 ? '#e63946' : '#2f6fed');
      w.matte.box(0.6, 0.4, 0.02, x + 0.3, 1.2, z, i % 2 ? '#e63946' : '#2f6fed');
    }
    for (const z of [-9, -3, 3, 9]) w.equipStation('slope', 'ski', 14, z, Math.PI);
    // pine forest
    for (let i = 0; i < 18; i++) {
      const a = rand(0, TAU);
      const r = rand(22, 29);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.hypot(x, z - 22) < 6 || (z < -19 && Math.abs(x) < 8)) continue;
      m.cyl(0.2, 2.0, x, 1.0, z, '#6b4423');
      m.add(UnitGeo.cone(12), x, 3.4, z, '#1f5b33', 0, 0, 0, 1.5, 2.8, 1.5);
      m.add(UnitGeo.cone(12), x, 4.6, z, '#ffffff', 0, 0, 0, 0.8, 0.9, 0.8);
      w.addCollider(x - 0.45, z - 0.45, x + 0.45, z + 0.45);
    }
    // cabin
    m.box(5, 3, 4, -15, 1.5, 5, '#8b5a2b');
    m.add(UnitGeo.cone(4), -15, 3.9, 5, '#f5f8ff', 0, Math.PI / 4, 0, 4.0, 1.8, 4.0);
    w.addCollider(-17.5, 3, -12.5, 7);
    w.anims.push(() => {
      for (let i = 0; i < 4; i++) w.fx.emit(rand(-30, 30), 14, rand(-30, 30), rand(-0.4, 0.4), -1.0, rand(-0.4, 0.4), new THREE.Color('#ffffff'), 10, 0.04);
    });
    w.freeStations([[-6, 8], [6, 10], [-10, -8], [0, 0]], ['jack', 'starjump', 'burpee', 'highknees']);
    w.sign('🏔️ کوهستان برفی', 'اسکی و صخره‌نوردی', 0, 9, -21, '#7fe0ff');
    w.finishBatches();
    return w;
  },
};
