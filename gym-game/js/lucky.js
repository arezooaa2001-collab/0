'use strict';
/* Lucky Island (level 250): every few steps you walk there gives you 10 strength levels. */

const LUCKY_PORTAL = { x: 12, z: 22 };
const LUCKY_HOME = { x: -8, z: 18 };
const LUCKY_STEP = 3; // metres walked per +10 levels
const LUCKY_LEVELS = 10;

function cloverMesh(m, x, z, s, color = '#2ecc71') {
  m.cyl(0.06 * s, 1.4 * s, x, 0.7 * s, z, '#2b8a3e', 0, 0, 0.15);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.3;
    m.sphere(0.42 * s, x + Math.cos(a) * 0.38 * s, 1.45 * s, z + Math.sin(a) * 0.38 * s, color, 0.35);
  }
  m.sphere(0.12 * s, x, 1.47 * s, z, '#ffd34d');
}

class LuckyWorld extends WorldBase {
  constructor() {
    const R = 26;
    super({ bounds: { circle: R }, spawn: { x: LUCKY_HOME.x + 2, z: LUCKY_HOME.z - 2, yaw: Math.PI }, background: '#d9f7ff', fog: [70, 260] });
    const sc = this.scene;
    sc.add(skyDome('#47c6ff', '#fff4c2'));
    sc.add(new THREE.HemisphereLight(0xffffff, 0x88cc77, 1.0));
    const sun = new THREE.DirectionalLight(0xfff2d8, 0.85);
    sun.position.set(20, 40, 15);
    sc.add(sun);
    const m = this.matte;
    m.cyl(R + 1, 0.6, 0, -0.3, 0, '#4cc95d', 0, 0, 0, 56);
    m.add(new THREE.CylinderGeometry(1, 0.8, 1, 48), 0, -1.9, 0, '#8a6a35', 0, 0, 0, R + 1, 2.6, R + 1);
    for (let i = 0; i < 60; i++) m.cyl(rand(0.8, 2), 0.02, rand(-R + 2, R - 2) * 0.9, 0.005, rand(-R + 2, R - 2) * 0.9, pick(['#5ad66b', '#41b553', '#7ee08a']), 0, 0, 0, 10);
    // golden path spiral
    for (let i = 0; i < 70; i++) {
      const a = i * 0.32;
      const r = 3 + i * 0.28;
      if (r > R - 2) break;
      m.cyl(0.55, 0.05, Math.cos(a) * r, 0.03, Math.sin(a) * r, i % 2 ? '#ffd34d' : '#ffe9a3', 0, 0, 0, 12);
    }
    // rainbow arch ending in two pots of gold
    const cols = ['#e63946', '#ff7b00', '#ffd34d', '#2ecc71', '#00b4d8', '#4361ee', '#9b5de5'];
    cols.forEach((c, i) => this.glow.geo(new THREE.TorusGeometry(14 - i * 0.55, 0.28, 8, 64, Math.PI), 0, 0, -10, c));
    for (const s of [-1, 1]) {
      const x = s * 11.2;
      m.cyl(1.0, 1.1, x, 0.55, -10, '#1d1d1d', 0, 0, 0, 20);
      m.cyl(1.08, 0.12, x, 1.1, -10, '#3a3a3a', 0, 0, 0, 20);
      for (let k = 0; k < 14; k++) m.cyl(0.22, 0.06, x + rand(-0.7, 0.7), 1.15 + rand(0, 0.5), -10 + rand(-0.7, 0.7), '#ffcf33', rand(-0.5, 0.5), 0, rand(-0.5, 0.5), 14);
      this.addCollider(x - 1.1, -11.1, x + 1.1, -8.9);
    }
    // giant clovers, horseshoes and dice
    for (const [x, z, s] of [[-16, 4, 2.2], [16, 6, 2.0], [-12, -18, 1.8], [12, -19, 2.4], [20, -4, 1.6], [-21, -6, 1.7], [4, 20, 1.5]]) {
      cloverMesh(m, x, z, s);
      this.addCollider(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
    }
    for (const [x, z, ry] of [[-6, -20, 0.3], [7, 12, -0.6], [-19, 14, 1.2]]) {
      m.geo(new THREE.TorusGeometry(1.3, 0.28, 8, 24, Math.PI * 1.3), x, 1.6, z, '#ffcf33', 0, ry, Math.PI * 0.85);
      this.addCollider(x - 1, z - 1, x + 1, z + 1);
    }
    for (const [x, z, n, ry] of [[9, -2, 6, 0.4], [-9, -1, 3, -0.3]]) {
      m.box(1.6, 1.6, 1.6, x, 0.8, z, '#ffffff', ry, 0.0);
      const dots = n === 6 ? [[-0.4, -0.4], [-0.4, 0], [-0.4, 0.4], [0.4, -0.4], [0.4, 0], [0.4, 0.4]] : [[-0.4, -0.4], [0, 0], [0.4, 0.4]];
      for (const [a, b] of dots) m.sphere(0.12, x + Math.cos(ry) * a, 0.8 + b, z - Math.sin(ry) * a + 0.8 * Math.cos(ry), '#111111', 0.4);
      this.addCollider(x - 0.9, z - 0.9, x + 0.9, z + 0.9);
    }
    // lucky cat statue waving
    m.cyl(1.4, 0.6, 0, 0.3, 4, '#e63946', 0, 0, 0, 24);
    m.sphere(1.1, 0, 1.6, 4, '#ffffff', 1.15);
    m.sphere(0.85, 0, 3.0, 4, '#ffffff');
    for (const s of [-1, 1]) m.add(UnitGeo.cone(4), s * 0.5, 3.75, 4, '#ffffff', 0, Math.PI / 4, s * -0.2, 0.3, 0.45, 0.3);
    for (const s of [-1, 1]) m.sphere(0.1, s * 0.3, 3.1, 4.8, '#111111');
    m.sphere(0.08, 0, 2.9, 4.85, '#ff8fab');
    m.box(1.3, 0.2, 0.3, 0, 2.3, 4.85, '#e63946');
    m.sphere(0.18, 0, 2.15, 5.0, '#ffd34d');
    this.addCollider(-1.4, 2.6, 1.4, 5.4);
    this.catPaw = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }));
    this.catPaw.position.set(0.95, 3.3, 4.3);
    this.scene.add(this.catPaw);
    // coin fountain
    m.cyl(3.2, 0.6, 0, 0.3, -2, '#d9e2ec', 0, 0, 0, 32);
    m.cyl(0.5, 2.0, 0, 1.2, -2, '#d9e2ec', 0, 0, 0, 16);
    m.cyl(1.2, 0.2, 0, 2.2, -2, '#ffcf33', 0, 0, 0, 24);
    const water = new THREE.Mesh(new THREE.CircleGeometry(3.0, 32), new THREE.MeshStandardMaterial({ color: '#4fc3f7', transparent: true, opacity: 0.8, roughness: 0.1 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.62, -2);
    sc.add(water);
    this.addCollider(-3.2, -5.2, 3.2, 1.2);
    // edge railing in gold
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * TAU;
      this.metal.box(0.08, 0.9, 0.08, Math.cos(a) * (R + 0.4), 0.45, Math.sin(a) * (R + 0.4), '#ffcf33');
    }
    this.homeRing = portalRing(this, LUCKY_HOME.x, LUCKY_HOME.z, '#ffc23d', 'برگشت به باشگاه');
    for (let i = 0; i < 6; i++) this.addStation(rand(-14, 14), rand(-15, 14), rand(-3, 3), ['jack', 'pushup', 'e_dance', 'cheer', 'backflip', 'starjump']);
    this.finishBatches();
    this.below = cloudField(40, 32, 150, -26, -6);
    sc.add(this.below);
    this.cam.pitch = 0.32;
  }

  nearHome() {
    const p = this.player.ch.root.position;
    return Math.hypot(p.x - LUCKY_HOME.x, p.z - LUCKY_HOME.z) < 2.6;
  }

  entrance() { return { x: LUCKY_HOME.x * 0.8, z: LUCKY_HOME.z * 0.8 }; }
  exitPoint() { return { x: LUCKY_HOME.x, z: LUCKY_HOME.z }; }

  updateExtra(dt) {
    this.below.rotation.y += dt * 0.01;
    this.homeRing.rotation.z += dt;
    this.catPaw.position.y = 3.3 + Math.sin(this.time * 4) * 0.25;
    if (Math.random() < dt * 6) this.fx.emit(rand(-2.5, 2.5), 2.4, -2 + rand(-2.5, 2.5), 0, 1.5, 0, new THREE.Color(pick(['#ffcf33', '#ffffff', '#7fe0ff'])), 1.2, 3);
  }
}

/* the gym's green-gold portal next to the cloud one */
Object.assign(GymWorld.prototype, {
  buildLuckyPortal() {
    const { x, z } = LUCKY_PORTAL;
    this.matte.cyl(1.7, 0.12, x, 0.06, z, '#e9ffe9');
    this.glow.geo(ellipseRingGeometry(1.55, 1.55, 0.12), x, 0.13, z, '#2ecc71');
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.12, 10, 40), new THREE.MeshBasicMaterial({ color: '#2ecc71', toneMapped: false }));
    ring.position.set(x, 1.65, z);
    this.scene.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32), new THREE.MeshBasicMaterial({ color: '#ffd34d', transparent: true, opacity: 0.3, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
    disc.position.copy(ring.position);
    this.scene.add(disc);
    const clovers = new THREE.Group();
    const b = new Batch();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      cloverMesh(b, Math.cos(a) * 2.0, Math.sin(a) * 2.0, 0.35);
    }
    clovers.add(new THREE.Mesh(mergeParts(b.parts, false), MATTE_MAT));
    clovers.position.set(x, 0, z);
    this.scene.add(clovers);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.85), new THREE.MeshBasicMaterial({
      map: signTexture([{ text: 'جزیره‌ی خوش‌شانسی • سطح ۲۵۰', size: 84, display: true, color: '#7dff8a' }], { w: 1024, h: 256, border: '#ffd34d' }),
      toneMapped: false, side: THREE.DoubleSide,
    }));
    sign.position.set(x, 3.45, z);
    this.scene.add(sign);
    this.lucky = { ring, disc, clovers };
  },

  nearLuckyPortal() {
    const p = this.player.ch.root.position;
    return Math.hypot(p.x - LUCKY_PORTAL.x, p.z - LUCKY_PORTAL.z) < 2.6;
  },

  updateLuckyPortal(dt, level) {
    const L = this.lucky;
    const open = level >= LUCKY_LEVEL;
    L.ring.rotation.y += dt * (open ? 1.5 : 0.3);
    L.ring.material.color.set(open ? '#2ecc71' : '#5d6b8a');
    L.disc.material.opacity = open ? 0.35 + 0.2 * Math.sin(this.time * 4) : 0.08;
    L.clovers.rotation.y -= dt * 0.4;
  },
});

Object.assign(Game, {
  getLucky() {
    if (!this.lucky) {
      this.lucky = new LuckyWorld();
      this.settleResidents(this.lucky);
    }
    return this.lucky;
  },

  /** On Lucky Island every few metres walked is worth 10 levels. */
  tickLucky() {
    if (this.world !== this.lucky || this.mode !== 'play') { this.luckyMeters = 0; return; }
    const m = this.world.metersRun || 0;
    if (this.luckyLast == null) this.luckyLast = m;
    this.luckyMeters = (this.luckyMeters || 0) + Math.max(0, m - this.luckyLast);
    this.luckyLast = m;
    while (this.luckyMeters >= LUCKY_STEP) {
      this.luckyMeters -= LUCKY_STEP;
      this.addLevels(LUCKY_LEVELS, true);
      this.floatText(`+${fa(LUCKY_LEVELS)} سطح 🍀`, 'fl-combo');
      Sfx.play('coin');
      const p = this.player.ch.root.position;
      this.world.fx.burst({ x: p.x, y: 0.6, z: p.z }, { count: 16, colors: ['#2ecc71', '#ffd34d', '#ffffff'], speed: 2, up: 2.5, life: 0.8 });
    }
  },
});
