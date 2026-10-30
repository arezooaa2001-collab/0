'use strict';
/* The gym: hall, equipment, strength tower, 40 training NPCs, player movement and camera */

const ROOM = { x: 132, z: 32, h: 11 };
const TRACK = { cx: 0, cz: 2, a: 12.5, b: 7.5, w: 2.4 };
const TOWER = { x: 0, z: -29.4, standX: 0, standZ: -27.4, segs: 20 };
const PORTAL = { x: 0, z: 14.6 };

const DUMBBELL_COLORS = ['#e63946', '#ff7b00', '#ffd34d', '#2ecc71', '#00b4d8', '#2f6fed', '#9b5de5', '#ff4da6'];

function woodTexture() {
  const tex = makeCanvasTexture(512, 512, (ctx, w, h) => {
    const plankH = 32;
    for (let y = 0; y < h; y += plankH) {
      // planks of one row span exactly w so the texture tiles without a seam
      const x0 = -Math.random() * 200;
      let x = x0;
      while (x < x0 + w - 1) {
        let len = rand(150, 320);
        if (x + len > x0 + w - 70) len = x0 + w - x;
        const color = `hsl(${rand(27, 33)}, ${rand(42, 52)}%, ${rand(50, 62)}%)`;
        const grain = [];
        for (let i = 0; i < 5; i++) grain.push([Math.random() < 0.5 ? '#5a3b1e' : '#f3d9b0', rand(2, plankH - 3), rand(1, 2)]);
        for (const off of [0, w]) {
          const px = x + off;
          ctx.fillStyle = color;
          ctx.fillRect(px, y, len, plankH);
          ctx.globalAlpha = 0.12;
          for (const [c, gy, gh] of grain) {
            ctx.fillStyle = c;
            ctx.fillRect(px, y + gy, len, gh);
          }
          ctx.globalAlpha = 1;
          ctx.fillStyle = 'rgba(60,35,15,0.55)';
          ctx.fillRect(px, y, 2, plankH);
        }
        x += len;
      }
      ctx.fillStyle = 'rgba(60,35,15,0.45)';
      ctx.fillRect(0, y, w, 2);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(Math.round(ROOM.x / 3), 11);
  return tex;
}

function signTexture(lines, opts = {}) {
  const w = opts.w || 1024;
  const h = opts.h || 256;
  return makeCanvasTexture(w, h, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, opts.bg1 || '#0f1730');
    g.addColorStop(1, opts.bg2 || '#1d2b55');
    ctx.fillStyle = g;
    roundRect(ctx, 0, 0, w, h, 26);
    ctx.fill();
    ctx.strokeStyle = opts.border || '#ffc23d';
    ctx.lineWidth = 10;
    roundRect(ctx, 8, 8, w - 16, h - 16, 22);
    ctx.stroke();
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((ln, i) => {
      ctx.fillStyle = ln.color || '#ffffff';
      ctx.font = `${ln.size || 90}px ${ln.display ? DISPLAY_FONT : UI_FONT}`;
      ctx.fillText(ln.text, w / 2, ln.y != null ? ln.y : h / 2);
    });
  });
}

class GymWorld extends WorldBase {
  constructor() {
    super({ bounds: { rect: [ROOM.x, ROOM.z], extra: [[ROOM.x - 12, -ROOM.z, RUN_HALL.x2, ROOM.z]] }, track: TRACK, spawn: { x: 0, z: 4, yaw: Math.PI }, background: '#141a28', fog: [80, 210] });
    this.ceiling = ROOM.h;
    this.cloudTex = cloudSkyTexture();
    this.cloudMat = new THREE.MeshBasicMaterial({ map: this.cloudTex, toneMapped: false });
    this.anims = [];
    this.buildLights();
    this.buildRoom();
    this.buildTrack();
    // the original zones moved out with the walls when the hall grew
    this.withOffset(-62, 0, () => this.buildWeights());
    this.withOffset(62, 0, () => this.buildCardio());
    this.buildMats();
    this.withOffset(0, 10, () => this.buildBoxing());
    this.withOffset(0, -10, () => this.buildNorth());
    this.buildDoor();
    this.buildPortal();
    this.buildTower();
    this.buildBoards();
    this.buildArmTable();
    this.buildFunctional();
    this.buildYoga();
    this.buildCalisthenics();
    this.buildClimbWall();
    this.buildSpeedBags();
    this.buildDecor();
    this.buildWestWing();
    this.buildEastWing();
    this.buildStatueGarden();
    this.buildNinja();
    this.buildLuckyPortal();
    this.buildRunHall();
    this.finishBatches();
    this.onImpact = () => this.strikeTower();
  }

  /** Run a builder with every batch part, collider and station shifted by (dx, dz). */
  withOffset(dx, dz, fn) {
    const saved = { matte: this.matte, metal: this.metal, glow: this.glow, addCollider: this.addCollider, addStation: this.addStation };
    const shift = (b) => {
      const o = Object.create(b);
      o.add = (geo, x, y, z, ...rest) => b.add(geo, x + dx, y, z + dz, ...rest);
      return o;
    };
    this.matte = shift(saved.matte);
    this.metal = shift(saved.metal);
    this.glow = shift(saved.glow);
    this.addCollider = (x1, z1, x2, z2) => saved.addCollider.call(this, x1 + dx, z1 + dz, x2 + dx, z2 + dz);
    this.addStation = (x, z, yaw, acts, opts = {}) => {
      const o = Object.assign({}, opts);
      if (o.ax != null) o.ax += dx;
      if (o.az != null) o.az += dz;
      return saved.addStation.call(this, x + dx, z + dz, yaw, acts, o);
    };
    try { fn(); } finally {
      this.matte = saved.matte;
      this.metal = saved.metal;
      this.glow = saved.glow;
      delete this.addCollider;
      delete this.addStation;
    }
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xe8eeff, 0x4a3a2c, 0.85));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.75);
    sun.position.set(12, 25, 10);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9fb8ff, 0.3);
    fill.position.set(-15, 10, -12);
    this.scene.add(fill);
  }

  buildRoom() {
    const { x: X, z: Z, h: H } = ROOM;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(X * 2, Z * 2),
      new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.55, metalness: 0.05 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const m = this.matte;
    const wall = '#c7d0e2';
    const dado = '#1d2b4f';
    m.box(X * 2 + 1, H, 0.5, 0, H / 2, -Z - 0.25, wall);
    m.box(X * 2 + 1, H, 0.5, 0, H / 2, Z + 0.25, wall);
    m.box(0.5, H, Z * 2, -X - 0.25, H / 2, 0, wall);
    // the east wall has a wide doorway into the Energy & Running Hall
    const D = RUN_HALL.door;
    const L = Z - D;
    for (const sz of [-1, 1]) {
      m.box(0.5, H, L, X + 0.25, H / 2, sz * (D + L / 2), wall);
      m.box(0.1, 1.3, L, X - 0.03, 0.65, sz * (D + L / 2), dado);
      m.box(0.12, 0.12, L, X - 0.06, 1.36, sz * (D + L / 2), '#ffc23d');
    }
    m.box(0.5, H - RUN_HALL.doorH, D * 2, X + 0.25, (H + RUN_HALL.doorH) / 2, 0, wall);
    m.box(X * 2, 1.3, 0.1, 0, 0.65, -Z + 0.03, dado);
    m.box(X * 2, 1.3, 0.1, 0, 0.65, Z - 0.03, dado);
    m.box(0.1, 1.3, Z * 2, -X + 0.03, 0.65, 0, dado);
    m.box(X * 2, 0.12, 0.12, 0, 1.36, -Z + 0.06, '#ffc23d');
    m.box(X * 2, 0.12, 0.12, 0, 1.36, Z - 0.06, '#ffc23d');
    m.box(0.12, 0.12, Z * 2, -X + 0.06, 1.36, 0, '#ffc23d');
    m.box(X * 2 + 1, 0.3, Z * 2 + 1, 0, H + 0.15, 0, '#1a1f2c');
    for (const tz of [-26, -14, -3, 8, 18, 27]) this.metal.box(X * 2, 0.35, 0.3, 0, H - 0.5, tz, '#39404f');
    for (let lx = -(X - 7); lx <= X - 7; lx += 10) {
      for (let lz = -26; lz <= 26; lz += 8.6) if (Math.abs(lx) > 18 || Math.abs(lz) > 11) this.glow.box(5, 0.06, 1.2, lx, H - 0.05, lz, '#fff4dc');
    }
    // big skylight with drifting clouds
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(34, 20), this.cloudMat);
    sky.rotation.x = Math.PI / 2;
    sky.position.set(0, H - 0.08, 0);
    this.scene.add(sky);
    for (const sz of [-1, 1]) m.box(34.6, 0.3, 0.3, 0, H - 0.2, sz * 10.1, '#e9eef7');
    for (const sx of [-1, 1]) m.box(0.3, 0.3, 20.4, sx * 17.15, H - 0.2, 0, '#e9eef7');
    for (const bx of [-11, -5.5, 0, 5.5, 11]) m.box(0.12, 0.12, 20, bx, H - 0.15, 0, '#e9eef7');
    // high windows on the long walls
    for (const sx of [-1, 1]) {
      for (let wz = -27; wz <= 27; wz += 6) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.6), this.cloudMat);
        win.position.set(sx * (X - 0.05), 6.8, wz);
        win.rotation.y = -sx * Math.PI / 2;
        this.scene.add(win);
        m.box(0.12, 0.18, 4.8, sx * (X - 0.06), 5.45, wz, '#e9eef7');
        m.box(0.12, 0.18, 4.8, sx * (X - 0.06), 8.15, wz, '#e9eef7');
        m.box(0.12, 2.8, 0.12, sx * (X - 0.06), 6.8, wz, '#e9eef7');
      }
    }
    // pillars between zones
    for (const px of [-28.8, 28.8, -41.5, 41.5, -78.8, 78.8]) {
      for (const pz of [-24, -12, 0, 12, 24]) {
        m.box(1, H, 1, px, H / 2, pz, '#2a3550');
        this.glow.box(1.04, 0.12, 1.04, px, 2.2, pz, '#ffc23d');
        this.addCollider(px - 0.5, pz - 0.5, px + 0.5, pz + 0.5);
      }
    }
  }

  buildTrack() {
    const { cx, cz, a, b, w } = TRACK;
    this.matte.geo(ellipseRingGeometry(a, b, w), cx, 0.008, cz, '#b8352b');
    for (const off of [0, 0.8, 1.6, w - 0.06]) this.matte.geo(ellipseRingGeometry(a + off, b + off, 0.06), cx, 0.011, cz, '#f5f5f5');
    this.matte.box(w, 0.006, 0.16, cx + a + w / 2, 0.012, cz, '#f5f5f5');
    const logo = makeCanvasTexture(1024, 1024, (ctx, W) => {
      ctx.translate(W / 2, W / 2);
      ctx.strokeStyle = 'rgba(29,43,79,0.85)';
      ctx.lineWidth = 26;
      ctx.beginPath(); ctx.arc(0, 0, 470, 0, TAU); ctx.stroke();
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(0, 0, 420, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(29,43,79,0.85)';
      ctx.fillRect(-230, -30, 460, 60);
      for (const s of [-1, 1]) {
        ctx.fillRect(s * 230 - 35, -120, 70, 240);
        ctx.fillRect(s * 300 - 30, -85, 60, 170);
      }
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.font = `150px ${DISPLAY_FONT}`;
      ctx.fillStyle = 'rgba(29,43,79,0.9)';
      ctx.fillText('باشگاه قهرمانان', 0, -190);
      ctx.font = `90px ${DISPLAY_FONT}`;
      ctx.fillText('زور • اراده • کشتی', 0, 300);
    });
    const logoMat = new THREE.MeshStandardMaterial({ map: logo, transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
    const lm = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 8.5), logoMat);
    lm.rotation.x = -Math.PI / 2;
    lm.position.set(cx, 0.01, cz);
    this.scene.add(lm);

  }

  buildWeights() {
    const m = this.matte;
    const mt = this.metal;
    m.box(12.6, 0.03, ROOM.z * 2 - 0.4, -23.7, 0.015, 0, '#2a2d34');
    for (let i = 0; i < 6; i++) m.box(0.3, 0.032, ROOM.z * 2 - 0.4, -17.6 - i * 0.02, 0.016, 0, ['#e63946', '#ff7b00', '#ffd34d', '#2ecc71', '#2f6fed', '#9b5de5'][i]);
    // mirror wall
    mt.box(0.05, 2.0, 50, -29.9, 2.45, 0, '#bcd6ea');
    // dumbbell racks
    for (const zc of [-9, 9]) {
      const len = 9;
      for (const y of [0.42, 0.88]) mt.box(0.9, 0.07, len, -28.5, y, zc, '#3c4250');
      for (const ez of [-len / 2, len / 2]) {
        mt.box(0.08, 0.95, 0.08, -28.9, 0.47, zc + ez, '#3c4250');
        mt.box(0.08, 0.95, 0.08, -28.1, 0.47, zc + ez, '#3c4250');
      }
      for (let i = 0; i < 14; i++) {
        const z = zc - len / 2 + 0.45 + i * 0.6;
        for (const [y, s] of [[0.52, 1 + i * 0.03], [0.98, 0.8 + i * 0.02]]) {
          mt.cyl(0.02, 0.36, -28.5, y, z, '#c9ced6', 0, 0, Math.PI / 2, 10);
          const dc = DUMBBELL_COLORS[i % DUMBBELL_COLORS.length];
          mt.cyl(0.07 * s, 0.07, -28.36, y, z, dc, 0, 0, Math.PI / 2, 10);
          mt.cyl(0.07 * s, 0.07, -28.64, y, z, dc, 0, 0, Math.PI / 2, 10);
        }
      }
      this.addCollider(-30, zc - len / 2 - 0.15, -27.95, zc + len / 2 + 0.15);
      for (const k of [-3, 0, 3]) this.addStation(-26.6, zc + k, -Math.PI / 2, ['curl', 'curl', 'squat'], { equip: 'dumbbell' });
    }
    // bench presses
    for (const z of [-17, -1.5]) {
      // the pad ends just past the hips so the legs bend over its end, not through it
      m.box(1.15, 0.12, 0.38, -21.43, 0.47, z, '#111317');
      mt.box(0.08, 0.42, 0.08, -21.85, 0.21, z, '#3c4250');
      mt.box(0.08, 0.42, 0.08, -21.0, 0.21, z, '#3c4250');
      for (const s of [-1, 1]) mt.box(0.1, 1.25, 0.1, -22.1, 0.62, z + s * 0.55, '#3c4250');
      mt.cyl(0.02, 1.9, -22.05, 1.22, z, '#d4d8de', Math.PI / 2, 0, 0, 10);
      for (const s of [-1, 1]) {
        mt.cyl(0.22, 0.06, -22.05, 1.22, z + s * 0.68, '#d62828', Math.PI / 2, 0, 0, 18);
        mt.cyl(0.18, 0.05, -22.05, 1.22, z + s * 0.75, '#2f6fed', Math.PI / 2, 0, 0, 18);
      }
      this.addCollider(-22.4, z - 0.85, -20.55, z + 0.85);
      this.addStation(-21.05, z, Math.PI / 2, ['bench'], { equip: 'bench', ax: -21.2, az: z + 1.25 });
      this.addStation(-19.4, z + 1.8, -Math.PI / 2, ['pushup', 'squat', 'jack']);
    }
    // squat racks
    for (const z of [7, 15.5]) {
      const x = -21.8;
      for (const sx of [-0.6, 0.6]) for (const sz of [-0.65, 0.65]) mt.box(0.1, 2.4, 0.1, x + sx, 1.2, z + sz, '#2c3140');
      for (const sz of [-0.65, 0.65]) mt.box(1.3, 0.1, 0.1, x, 2.4, z + sz, '#2c3140');
      for (const sx of [-0.6, 0.6]) mt.box(0.1, 0.1, 1.4, x + sx, 2.4, z, '#2c3140');
      mt.cyl(0.02, 1.9, x + 0.35, 1.45, z, '#d4d8de', Math.PI / 2, 0, 0, 10);
      for (const s of [-1, 1]) mt.cyl(0.22, 0.07, x + 0.35, 1.45, z + s * 0.82, '#2ecc71', Math.PI / 2, 0, 0, 18);
      m.box(1.6, 0.04, 1.8, x, 0.02, z, '#5d4329');
      this.addCollider(x - 0.7, z - 0.95, x + 0.7, z + 0.95);
      this.addStation(x + 2.0, z, -Math.PI / 2, ['lift', 'lift', 'squat'], { equip: 'barbell' });
    }
    // plyo boxes and kettlebells
    for (let i = 0; i < 3; i++) {
      const h = 0.4 + i * 0.2;
      m.box(0.8, h, 0.8, -26.5 + i * 1.1, h / 2, 19.6, '#b58450');
    }
    this.addCollider(-26.95, 19.15, -23.85, 20.05);
    for (let i = 0; i < 6; i++) {
      const x = -27.5 + i * 0.7;
      mt.sphere(0.13 + i * 0.012, x, 0.14, -20.6, DUMBBELL_COLORS[i]);
      mt.geo(UnitGeo.torus(1, 0.18, 6, 16), x, 0.3, -20.6, '#22252b', 0, 0, 0, 0.09);
    }
    this.addCollider(-27.85, -20.95, -23.65, -20.25);
  }

  buildCardio() {
    const m = this.matte;
    const mt = this.metal;
    m.box(12.6, 0.03, ROOM.z * 2 - 0.4, 23.7, 0.015, 0, '#2a2d34');
    for (let i = 0; i < 6; i++) m.box(0.3, 0.032, ROOM.z * 2 - 0.4, 17.6 + i * 0.02, 0.016, 0, ['#9b5de5', '#2f6fed', '#2ecc71', '#ffd34d', '#ff7b00', '#e63946'][i]);
    for (const z of [-15, -10, -5, 0, 5, 10]) {
      const x = 26;
      m.box(2.0, 0.2, 0.85, x, 0.1, z, '#2d3038');
      m.box(1.75, 0.02, 0.6, x - 0.05, 0.21, z, '#0e0f12');
      for (const s of [-1, 1]) {
        mt.box(1.8, 0.04, 0.05, x, 0.24, z + s * 0.4, '#9aa0a8');
        mt.box(0.06, 1.15, 0.06, x + 0.95, 0.78, z + s * 0.36, '#9aa0a8');
      }
      mt.cyl(0.025, 0.78, x + 0.8, 1.15, z, '#9aa0a8', Math.PI / 2, 0, 0, 10);
      const tc = ['#e63946', '#2f6fed', '#2ecc71', '#ff7b00', '#9b5de5', '#ff4da6'][(z + 15) / 5];
      m.box(0.24, 0.42, 0.82, x + 1.02, 1.45, z, '#23262e');
      m.box(0.26, 0.08, 0.84, x + 1.02, 1.7, z, tc);
      m.box(2.02, 0.05, 0.87, x, 0.2, z, tc);
      this.glow.box(0.02, 0.22, 0.5, x + 0.89, 1.5, z, '#39c0ff');
      this.addCollider(x + 0.8, z - 0.48, x + 1.2, z + 0.48);
      this.addStation(x - 0.25, z, Math.PI / 2, ['treadmill'], { equip: 'treadmill', ax: x - 1.6, az: z, y: 0.225 });
    }
    for (const z of [-15, -10, -5, 0, 5]) {
      const x = 21.3;
      mt.box(0.1, 0.1, 1.2, x, 0.05, z, '#2c3140');
      const bc = ['#e63946', '#ffd34d', '#2ecc71', '#2f6fed', '#ff4da6'][(z + 15) / 5];
      mt.box(0.06, 0.26, 0.06, x, 0.22, z + 0.02, '#2c3140');
      mt.box(0.08, 0.75, 0.08, x, 0.45, z - 0.2, bc);
      m.box(0.26, 0.08, 0.32, x, 0.86, z - 0.25, '#111317');
      mt.box(0.08, 0.95, 0.08, x, 0.6, z + 0.45, bc);
      mt.cyl(0.03, 0.55, x, 1.1, z + 0.45, '#9aa0a8', 0, 0, Math.PI / 2, 10);
      mt.cyl(0.24, 0.07, x, 0.35, z + 0.42, '#22252b', 0, 0, Math.PI / 2, 18);
      this.addCollider(x - 0.3, z + 0.2, x + 0.3, z + 0.7);
      addBikeCrank(this, this.addStation(x, z - 0.28, 0, ['bike'], { equip: 'bike', ax: x - 1.0, az: z - 0.28, y: 0 }), bc);
      this.addStation(x - 1.8, z, Math.PI / 2, ['jack', 'squat', 'rope', 'pushup']);
    }
    for (let i = 0; i < 4; i++) {
      const x = 19 + i * 2.6;
      const lz = ROOM.z - 0.3;
      m.box(1.2, 1.9, 0.5, x, 0.95, lz, ['#e63946', '#2f6fed', '#ffd34d', '#2ecc71'][i]);
      m.box(0.04, 1.7, 0.02, x, 0.95, lz - 0.26, '#0e1424');
      for (const hy of [0.7, 1.35]) m.box(0.5, 0.06, 0.02, x, hy, lz - 0.27, '#ffffff');
    }
    this.addCollider(18, ROOM.z - 0.7, 28.5, ROOM.z);
  }

  buildMats() {
    const m = this.matte;
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 3; j++) {
        const x = -14 + i * 2.05;
        const z = 14.4 + j * 2.05;
        m.box(2, 0.03, 2, x, 0.015, z, (i + j) % 2 ? '#2f6fed' : '#2556c4');
        this.addStation(x, z, rand(-Math.PI, Math.PI), ['pushup', 'situp', 'jack', 'handstand', 'backflip', 'frontflip', 'kick', 'squat', 'jumpspin']);
      }
    }
  }

  buildBoxing() {
    const m = this.matte;
    const mt = this.metal;
    m.box(10.5, 0.03, 4.4, 10, 0.015, 18.8, '#7a2630');
    mt.box(10.5, 0.2, 0.2, 10, 3.45, 19.6, '#2c3140');
    for (const x of [4.9, 15.1]) {
      mt.box(0.2, 3.45, 0.2, x, 1.72, 19.6, '#2c3140');
      this.addCollider(x - 0.15, 19.45, x + 0.15, 19.75);
    }
    [6.4, 8.9, 11.4, 13.9].forEach((x, i) => {
      mt.cyl(0.015, 1.0, x, 2.9, 19.6, '#c9ced6', 0, 0, 0, 6);
      m.cyl(0.27, 1.15, x, 1.82, 19.6, i % 2 ? '#d62828' : '#22252b');
      m.cyl(0.28, 0.1, x, 2.4, 19.6, '#f1f1f1');
      m.cyl(0.28, 0.08, x, 1.25, 19.6, '#f1f1f1');
      this.addCollider(x - 0.3, 19.3, x + 0.3, 19.9);
      this.addStation(x, 18.55, 0, ['box', 'box', 'kick'], { equip: 'bag' });
    });
  }

  buildNorth() {
    const m = this.matte;
    const mt = this.metal;
    // stretching mats north-east and north-west
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const x = sx * (7.5 + i * 2.1);
        m.box(1.9, 0.03, 3.2, x, 0.015, -15.5, sx > 0 ? '#1f8a5b' : '#7b3fbf');
        this.addStation(x, -15.5, Math.PI + rand(-0.4, 0.4), ['pushup', 'situp', 'squat', 'jack', 'backflip', 'jumpspin', 'handstand', 'rope']);
      }
    }
    // pull-up frames
    for (const x of [-12, 12]) {
      const z = -19.8;
      for (const s of [-1, 1]) {
        mt.box(0.1, 2.6, 0.1, x + s * 0.8, 1.3, z, '#2c3140');
        mt.box(0.1, 0.1, 1.2, x + s * 0.8, 0.05, z, '#2c3140');
        this.addCollider(x + s * 0.8 - 0.08, z - 0.08, x + s * 0.8 + 0.08, z + 0.08);
      }
      mt.cyl(0.03, 1.7, x, 2.5, z, '#c9ced6', 0, 0, Math.PI / 2, 10);
      this.addStation(x, z, 0, ['pullup'], { equip: 'pullup', ax: x, az: z + 1.1 });
    }

  }

  buildDoor() {
    const m = this.matte;
    const z = ROOM.z - 0.1;
    m.box(4.4, 4.6, 0.2, 0, 2.3, z, '#0b0f1c');
    this.glow.box(4.8, 0.18, 0.12, 0, 4.7, z - 0.12, '#ffc23d');
    this.glow.box(0.18, 4.7, 0.12, -2.3, 2.35, z - 0.12, '#ffc23d');
    this.glow.box(0.18, 4.7, 0.12, 2.3, 2.35, z - 0.12, '#ffc23d');
    m.box(0.06, 4.4, 0.06, 0, 2.2, z - 0.15, '#2c3140');
    m.box(2.6, 0.012, 10, 0, 0.012, ROOM.z - 5.2, '#a3162a');
    this.addCollider(-2.5, ROOM.z - 0.4, 2.5, ROOM.z);
  }

  buildPortal() {
    const { x, z } = PORTAL;
    this.matte.cyl(1.7, 0.12, x, 0.06, z, '#dfe9ff');
    this.glow.geo(ellipseRingGeometry(1.55, 1.55, 0.12), x, 0.13, z, '#7fe0ff');
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.11, 10, 40), new THREE.MeshBasicMaterial({ color: '#7fe0ff', toneMapped: false }));
    ring.position.set(x, 1.65, z);
    this.scene.add(ring);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.28, 32), new THREE.MeshBasicMaterial({
      map: this.cloudTex, transparent: true, opacity: 0.4, side: THREE.DoubleSide, toneMapped: false, depthWrite: false,
    }));
    glow.position.copy(ring.position);
    this.scene.add(glow);
    const clouds = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(cloudPuffGeometry(i), CLOUD_MAT);
      const a = (i / 6) * TAU;
      c.position.set(Math.cos(a) * 1.9, 0.25 + (i % 2) * 0.25, Math.sin(a) * 1.9);
      c.scale.setScalar(0.32);
      clouds.add(c);
    }
    clouds.position.set(x, 0, z);
    this.scene.add(clouds);
    // the ring stands on its base: solid where it touches the floor, and round each cloud
    this.addCollider(x - 1.5, z - 0.15, x + 1.5, z + 0.15);
    clouds.updateMatrixWorld(true);
    for (const c of clouds.children) {
      const b = new THREE.Box3().setFromObject(c);
      this.addCollider(b.min.x, b.min.z, b.max.x, b.max.z);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshBasicMaterial({
      map: signTexture([{ text: 'جزیره‌ی ابرها • سطح ۱۰۰', size: 92, display: true, color: '#7fe0ff' }], { w: 1024, h: 256, border: '#7fe0ff' }),
      toneMapped: false, side: THREE.DoubleSide,
    }));
    sign.position.set(x, 3.45, z);
    this.scene.add(sign);
    this.portal = { ring, glow, clouds, sign };
  }

  buildTower() {
    const { x, z } = TOWER;
    const m = this.matte;
    const mt = this.metal;
    m.box(2.8, 0.35, 2.4, x, 0.175, z, '#b3202a');
    this.glow.box(2.84, 0.06, 2.44, x, 0.36, z, '#ffc23d');
    mt.box(0.8, 0.12, 0.8, x, 0.42, z + 0.7, '#22252b');
    mt.box(0.6, 0.06, 0.6, x, 0.5, z + 0.7, '#d62828');
    m.box(0.4, 7.2, 0.24, x, 3.95, z - 0.5, '#f4f4f4');
    mt.box(0.06, 7.2, 0.06, x - 0.22, 3.95, z - 0.36, '#9aa0a8');
    mt.box(0.06, 7.2, 0.06, x + 0.22, 3.95, z - 0.36, '#9aa0a8');
    this.addCollider(x - 1.45, z - 1.25, x + 1.45, z + 1.25);

    const segs = [];
    for (let i = 0; i < TOWER.segs; i++) {
      const f = i / (TOWER.segs - 1);
      const on = new THREE.Color().setHSL(0.33 - f * 0.33, 0.95, 0.5);
      const mat = new THREE.MeshStandardMaterial({ color: '#2a2f3a', emissive: on, emissiveIntensity: 0, roughness: 0.4 });
      const s = new THREE.Mesh(UnitGeo.box(), mat);
      s.scale.set(0.5, 0.27, 0.08);
      s.position.set(x - 0.62, 0.75 + i * 0.33, z - 0.42);
      this.scene.add(s);
      segs.push({ mesh: s, on, lit: 0 });
    }
    const puck = new THREE.Mesh(UnitGeo.box(), new THREE.MeshStandardMaterial({ color: '#ff2d55', emissive: '#ff2d55', emissiveIntensity: 0.5 }));
    puck.scale.set(0.55, 0.2, 0.12);
    puck.position.set(x, 0.75, z - 0.32);
    this.scene.add(puck);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.48, 0.5, 20), new THREE.MeshStandardMaterial({ color: '#ffcf33', metalness: 0.8, roughness: 0.25, emissive: '#5a3d00' }));
    bell.position.set(x, 7.85, z - 0.45);
    this.scene.add(bell);
    const scale = makeCanvasTexture(128, 1024, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(10,14,28,0.85)';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold 56px ${UI_FONT}`;
      for (let L = 0; L <= 20; L++) {
        const y = h - 30 - (L / 20) * (h - 60);
        ctx.fillStyle = L % 5 === 0 ? '#ffc23d' : '#55607a';
        ctx.fillRect(0, y - 2, L % 5 === 0 ? 34 : 18, 4);
        if (L % 5 === 0 && L > 0) ctx.fillText(fa(L * 5), w / 2 + 14, y);
      }
    });
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 6.9), new THREE.MeshBasicMaterial({ map: scale, toneMapped: false }));
    sp.position.set(x + 0.62, 3.95, z - 0.36);
    this.scene.add(sp);
    const title = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({
      map: signTexture([{ text: 'قدرت‌سنج', size: 150, display: true, color: '#ffc23d' }], { w: 1024, h: 256 }), toneMapped: false,
    }));
    title.position.set(x, 8.5, z - 0.4);
    this.scene.add(title);
    this.tower = { segs, puck, bell, state: 'idle', y: 0.75, vy: 0, peak: 0, ringT: 0, base: 0.75, top: 0.75 + 19 * 0.33 + 0.4, flash: 0, displayLevel: 0 };
  }

  buildBoards() {
    const mk = (w, h, x) => {
      const tex = makeCanvasTexture(1024, 512, () => {});
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      mesh.position.set(x, 5.3, -ROOM.z + 0.12);
      this.scene.add(mesh);
      this.metal.box(w + 0.3, h + 0.3, 0.08, x, 5.3, -ROOM.z + 0.04, '#0b0f1c');
      return tex;
    };
    this.boardTex = mk(8, 4, -7.5);
    this.rankTex = mk(8, 4, 7.5);
    const banners = [
      { lines: [{ text: 'زور = تمرین + اراده', size: 110, display: true }], pos: [-ROOM.x + 0.06, 5.4, 0], ry: Math.PI / 2 },
      { lines: [{ text: 'قهرمان بعدی تویی!', size: 120, display: true, color: '#ffc23d' }], pos: [ROOM.x - 0.06, 5.4, 0], ry: -Math.PI / 2 },
      { lines: [{ text: 'سالن کشتی', size: 140, display: true, color: '#ffc23d' }], pos: [0, 6.0, ROOM.z - 0.06], ry: Math.PI },
    ];
    for (const b of banners) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: signTexture(b.lines), toneMapped: false }));
      mesh.position.set(...b.pos);
      mesh.rotation.y = b.ry;
      this.scene.add(mesh);
    }
  }

  nearTower() {
    const p = this.player.ch.root.position;
    return Math.hypot(p.x - TOWER.standX, p.z - TOWER.standZ) < 2.4;
  }

  startStrengthTest(level) {
    if (!this.canAct() || this.tower.state !== 'idle') return false;
    const ch = this.player.ch;
    ch.root.position.set(TOWER.standX, 0, TOWER.standZ);
    ch.root.rotation.y = Math.PI;
    this.player.vel.set(0, 0);
    this.player.guide = null;
    this.cam.yaw = 0.5;
    this.tower.testLevel = level;
    return ch.play('hammer');
  }

  strikeTower() {
    const T = this.tower;
    Sfx.play('hammer');
    this.shake = Math.max(this.shake, 0.25);
    this.fx.burst({ x: TOWER.x, y: 0.55, z: TOWER.z + 0.7 }, { count: 30, colors: ['#ffc23d', '#ffffff'], speed: 3, up: 2, life: 0.6 });
    const frac = clamp((T.testLevel || 1) / 100, 0.04, 1.08);
    T.peak = T.base + frac * (T.top - T.base);
    T.vy = Math.sqrt(2 * 26 * (T.peak - T.base));
    T.y = T.base;
    T.state = 'up';
    T.rang = false;
  }

  updateTower(dt, level) {
    const T = this.tower;
    const show = clamp(Math.round(Math.min(level, 100) / 5), 0, 20);
    if (T.state === 'up' || T.state === 'down') {
      T.vy -= 26 * dt;
      T.y += T.vy * dt;
      if (T.y >= T.top) {
        T.y = T.top;
        T.vy = -Math.abs(T.vy) * 0.2;
        if (!T.rang) {
          T.rang = true;
          T.ringT = 1.2;
          Sfx.play('bell');
          this.fx.burst({ x: TOWER.x, y: 7.9, z: TOWER.z - 0.3 }, { count: 70, colors: ['#ffc23d', '#ff4d6d', '#ffffff'], speed: 5, up: 3, life: 1.3 });
        }
      }
      if (T.vy < 0) T.state = 'down';
      if (T.state === 'down' && T.y <= T.base) {
        T.y = T.base;
        T.vy = 0;
        T.state = 'hold';
        T.holdT = 2.2;
        if (this.onTowerDone) this.onTowerDone(T.testLevel, T.rang);
      }
    } else if (T.state === 'hold') {
      T.holdT -= dt;
      if (T.holdT <= 0) T.state = 'idle';
    }
    T.puck.position.y = T.y;
    const puckSeg = (T.y - 0.75) / 0.33;
    const testing = T.state !== 'idle';
    T.segs.forEach((s, i) => {
      let target;
      if (testing) target = i <= puckSeg + 0.3 || (T.state === 'hold' && i < Math.ceil((T.peak - 0.75) / 0.33)) ? 1.6 : 0.05;
      else target = i < show ? 0.75 + 0.25 * Math.sin(this.time * 3 - i * 0.4) : 0.05;
      s.lit += (target - s.lit) * damp(14, dt);
      s.mesh.material.emissiveIntensity = s.lit;
    });
    if (T.ringT > 0) {
      T.ringT -= dt;
      T.bell.rotation.z = Math.sin(T.ringT * 40) * 0.25 * T.ringT;
    } else T.bell.rotation.z = 0;
  }

  drawBoards(info, board) {
    const key = JSON.stringify([info, board.map((r) => r.name + r.level)]);
    if (key === this.boardKey) return;
    this.boardKey = key;
    redrawCanvasTexture(this.boardTex, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#0d1530');
      g.addColorStop(1, '#060a18');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffc23d';
      ctx.font = `86px ${DISPLAY_FONT}`;
      ctx.fillText('قدرت‌سنج: زور تو', w / 2, 70);
      ctx.fillStyle = '#ffffff';
      ctx.font = `210px ${DISPLAY_FONT}`;
      ctx.fillText('سطح ' + fa(info.level), w / 2, 245);
      const bw = 760;
      const bx = (w - bw) / 2;
      ctx.fillStyle = '#1d2747';
      roundRect(ctx, bx, 370, bw, 44, 22);
      ctx.fill();
      const fw = Math.max(44, bw * clamp(info.frac, 0, 1));
      ctx.fillStyle = '#2ecc71';
      roundRect(ctx, bx + bw - fw, 370, fw, 44, 22);
      ctx.fill();
      ctx.fillStyle = '#b9c6ea';
      ctx.font = `44px ${UI_FONT}`;
      ctx.fillText(`رتبه‌ی تو: ${fa(info.rank)} از ${fa(info.total)}`, w / 2, 465);
    });
    redrawCanvasTexture(this.rankTex, (ctx, w, h) => {
      ctx.fillStyle = '#081024';
      ctx.fillRect(0, 0, w, h);
      ctx.direction = 'rtl';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffc23d';
      ctx.font = `76px ${DISPLAY_FONT}`;
      ctx.fillText('قوی‌ترین‌های باشگاه', w / 2, 60);
      board.slice(0, 5).forEach((r, i) => {
        const y = 140 + i * 74;
        ctx.fillStyle = r.isPlayer ? 'rgba(255,194,61,0.25)' : (i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)');
        ctx.fillRect(60, y - 33, w - 120, 66);
        ctx.font = `bold 48px ${UI_FONT}`;
        ctx.textAlign = 'right';
        ctx.fillStyle = r.isPlayer ? '#ffc23d' : '#ffffff';
        ctx.fillText(`${fa(i + 1)}. ${r.name}`, w - 90, y);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#7fe0ff';
        ctx.fillText('سطح ' + fa(r.level), 90, y);
      });
    });
  }

  leaderboard(playerName, level, xp) {
    const rows = this.npcs.map((n) => ({ name: n.name, level: n.level, xp: n.xp, isPlayer: false }));
    rows.push({ name: playerName, level, xp, isPlayer: true });
    rows.sort((a, b) => b.level - a.level || b.xp - a.xp);
    return rows;
  }

  updateExtra(dt, stats) {
    this.updateTower(dt, stats.level);
    this.updateWings(dt);
    this.updateLuckyPortal(dt, stats.level);
    for (const f of this.anims) f(dt, this.time);
    this.cloudTex.offset.x = (this.cloudTex.offset.x + dt * 0.006) % 1;
    const P = this.portal;
    const open = stats.level >= ISLAND_LEVEL;
    P.ring.rotation.z += dt * (open ? 1.2 : 0.25);
    P.ring.material.color.set(open ? '#7fe0ff' : '#5d6b8a');
    P.glow.material.opacity = open ? 0.45 + 0.2 * Math.sin(this.time * 3) : 0.12;
    P.clouds.children.forEach((c, i) => { c.rotation.y += dt * 0.5; c.position.y = 0.25 + (i % 2) * 0.25 + 0.06 * Math.sin(this.time * 1.5 + i); });
  }

  buildArmTable() {
    const { x, z } = ARM_TABLE;
    const m = this.matte;
    const mt = this.metal;
    m.cyl(0.9, 0.03, x, 0.015, z, '#7a2630');
    mt.cyl(0.07, 0.98, x, 0.49, z, '#2c3140');
    mt.box(0.6, 0.04, 0.5, x, 0.04, z, '#2c3140');
    m.box(0.72, 0.07, 0.56, x, 1.0, z, '#1d2433');
    m.box(0.74, 0.012, 0.58, x, 1.04, z, '#e63946');
    for (const [dx, dz] of [[0.22, -0.18], [-0.22, 0.18]]) mt.cyl(0.025, 0.16, x + dx, 1.12, z + dz, '#c9ced6');
    this.addCollider(x - 0.36, z - 0.28, x + 0.36, z + 0.28);
    mt.box(0.08, 3.1, 0.08, x + 0.95, 1.55, z, '#2c3140');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.6), new THREE.MeshBasicMaterial({
      map: signTexture([{ text: 'مچ‌اندازی', size: 120, display: true, color: '#ffc23d' }], { w: 1024, h: 280, border: '#ffc23d' }),
      toneMapped: false, side: THREE.DoubleSide,
    }));
    sign.position.set(x + 0.95, 3.25, z);
    sign.rotation.y = -Math.PI / 2;
    this.scene.add(sign);
    this.addCollider(x + 0.88, z - 0.07, x + 1.02, z + 0.07);
  }

  /* ---------------- the new pro zones ---------------- */

  zoneSign(text, color, x, y, z, ry, w = 5) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.25), new THREE.MeshBasicMaterial({
      map: signTexture([{ text, size: 130, display: true, color }], { w: 1024, h: 256, border: color, bg1: '#10142a', bg2: '#1b1f3d' }),
      toneMapped: false, side: THREE.DoubleSide,
    }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    this.scene.add(mesh);
    for (const s of [-1, 1]) this.metal.cyl(0.015, ROOM.h - y - w * 0.125, x + Math.cos(ry) * s * w * 0.4, (ROOM.h + y + w * 0.125) / 2, z - Math.sin(ry) * s * w * 0.4, '#9aa0a8', 0, 0, 0, 6);
  }

  plant(x, z, pot = '#e76f51', s = 1) {
    const m = this.matte;
    m.cyl(0.3 * s, 0.55 * s, x, 0.275 * s, z, pot);
    m.cyl(0.32 * s, 0.06 * s, x, 0.55 * s, z, '#2c3140');
    for (let i = 0; i < 5; i++) m.sphere(0.32 * s, x + Math.cos(i * 1.3) * 0.18 * s, (0.9 + (i % 3) * 0.22) * s, z + Math.sin(i * 1.3) * 0.18 * s, ['#2f9e44', '#40c057', '#2b8a3e'][i % 3]);
    this.addCollider(x - 0.3 * s, z - 0.3 * s, x + 0.3 * s, z + 0.3 * s);
  }

  buildFunctional() {
    const m = this.matte;
    const mt = this.metal;
    // rubber floor: warm checker for the strength corner, cool checker for the machines
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 23; j++) {
        const x = 17.5 + i * 2;
        const z = -22 + j * 2;
        const warm = z < 0;
        const c = (i + j) % 2 ? '#30343f' : (warm ? ['#ff7b00', '#e63946', '#ffb703'][(i + j) % 3] : ['#00b4d8', '#2ecc71', '#4361ee'][(i + j) % 3]);
        m.box(1.98, 0.025, 1.98, x, 0.013, z, c);
      }
    }
    // battle ropes
    for (const z of [-20, -16.5]) {
      mt.cyl(0.14, 0.9, 21.7, 0.45, z, '#ffd34d');
      mt.cyl(0.16, 0.08, 21.7, 0.92, z, '#2c3140');
      this.addCollider(21.5, z - 0.2, 21.9, z + 0.2);
      this.addStation(18.2, z, Math.PI / 2, ['ropes', 'ropes', 'squat'], { equip: 'ropes', ax: 17.2, az: z + 1.1 });
    }
    // tire flips, with a spare stack
    for (const z of [-12, -8]) {
      m.box(3.2, 0.02, 1.6, 19.6, 0.01, z, '#5d4329');
      this.addStation(18.0, z, Math.PI / 2, ['tireflip', 'squat'], { equip: 'tire', ax: 17.0, az: z + 1.2 });
    }
    for (let k = 0; k < 3; k++) m.geo(UnitGeo.torus(1, 0.42, 8, 24), 27.2, 0.25 + k * 0.48, -10, '#22252b', Math.PI / 2, 0, 0, 0.55);
    m.cyl(0.32, 1.5, 27.2, 0.75, -10, '#ffd34d');
    this.addCollider(26.6, -10.6, 27.8, -9.4);
    // plyo boxes
    for (const [z, c] of [[-20, '#e63946'], [-16.5, '#2f6fed']]) {
      m.box(0.62, 0.6, 0.62, 24.35, 0.3, z, c);
      m.box(0.64, 0.05, 0.64, 24.35, 0.6, z, '#1d2433');
      this.addCollider(24.05, z - 0.3, 24.65, z + 0.3);
      this.addStation(23.6, z, Math.PI / 2, ['boxjump', 'squat'], { equip: 'plyo', ax: 22.6, az: z + 1.1 });
    }
    // kettlebells
    for (const z of [-12, -8]) this.addStation(23.6, z, Math.PI / 2, ['kettle', 'squat', 'lunge'], { equip: 'kettle', ax: 22.6, az: z + 1.1 });
    mt.box(0.6, 0.06, 3.4, 27.5, 0.45, -5.2, '#3c4250');
    mt.box(0.6, 0.06, 3.4, 27.5, 0.05, -5.2, '#3c4250');
    for (const dz of [-1.6, 1.6]) mt.box(0.06, 0.5, 0.06, 27.5, 0.25, -5.2 + dz, '#3c4250');
    for (let i = 0; i < 6; i++) {
      const z = -6.6 + i * 0.55;
      mt.sphere(0.15, 27.5, 0.62, z, DUMBBELL_COLORS[i]);
      mt.geo(UnitGeo.torus(1, 0.18, 6, 16), 27.5, 0.78, z, '#22252b', 0, Math.PI / 2, 0, 0.09);
    }
    this.addCollider(27.15, -7, 27.85, -3.4);
    // rowing machines
    const rowCols = ['#2f6fed', '#e63946', '#2ecc71', '#ff7b00'];
    [4, 7, 10, 13].forEach((z, i) => {
      mt.box(2.8, 0.06, 0.16, 18.9, 0.12, z, '#c9ced6');
      for (const dx of [-1.3, 1.3]) mt.box(0.12, 0.14, 0.5, 18.9 + dx, 0.07, z, '#2c3140');
      m.box(0.4, 0.08, 0.32, 18.6, 0.3, z, '#111317');
      mt.cyl(0.32, 0.22, 20.2, 0.42, z, rowCols[i], 0, 0, Math.PI / 2, 20);
      mt.cyl(0.2, 0.24, 20.2, 0.42, z, '#1d2433', 0, 0, Math.PI / 2, 16);
      m.box(0.12, 0.3, 0.42, 19.55, 0.3, z, rowCols[i]);
      this.addCollider(19.9, z - 0.25, 20.5, z + 0.25);
      this.addStation(18.6, z, Math.PI / 2, ['rower'], { equip: 'rower', ax: 18.6, az: z + 1.2 });
    });
    // leg press machines (sled in front of a reclined seat)
    for (const [z, c] of [[5, '#9b5de5'], [9.5, '#ff4da6']]) {
      mt.box(2.6, 0.12, 0.9, 25.4, 0.06, z, '#2c3140');
      m.box(0.9, 0.1, 0.6, 24.9, 0.45, z, '#111317');
      m.box(0.1, 0.9, 0.6, 24.4, 0.52, z, '#111317', 0, 0, 1.05);
      // the sled plate itself moves with the feet (a prop of the leg-press move); here only its stop
      mt.box(0.1, 0.1, 0.8, 26.4, 0.62, z, c);
      for (const dz of [-0.35, 0.35]) mt.box(1.6, 0.08, 0.08, 25.8, 0.75, z + dz, '#c9ced6', 0, 0, 0.5);
      for (const dz of [-0.55, 0.55]) mt.cyl(0.22, 0.06, 26.7, 1.15, z + dz, c, Math.PI / 2, 0, 0, 16);
      this.addCollider(25.9, z - 0.5, 27.0, z + 0.5);
      this.addCollider(24.1, z - 0.45, 25.9, z + 0.45);
      this.addStation(24.75, z, Math.PI / 2, ['legpress'], { equip: 'legpress', ax: 24.75, az: z + 1.3 });
    }
    // lat pulldown towers
    for (const [z, c] of [[14.5, '#2ecc71'], [18.5, '#ffd34d']]) {
      m.box(0.5, 0.1, 0.4, 25, 0.37, z, '#111317');
      for (const s of [-1, 1]) for (const dx of [-0.2, 0.2]) mt.box(0.04, 0.33, 0.04, 25 + dx, 0.16, z + s * 0.15, '#2c3140');
      m.box(0.4, 0.12, 0.2, 25.25, 0.75, z, '#111317');
      mt.box(0.14, 2.8, 0.14, 25.75, 1.4, z, c);
      mt.box(0.6, 0.12, 0.14, 25.45, 2.75, z, c);
      mt.cyl(0.008, 0.6, 25.15, 2.45, z, '#2c3140', 0, 0, 0, 4);
      mt.cyl(0.02, 1.2, 25.15, 2.15, z, '#c9ced6', Math.PI / 2, 0, 0, 8);
      mt.box(0.4, 0.6, 0.5, 25.95, 0.4, z, '#3c4250');
      this.addCollider(25.6, z - 0.3, 26.2, z + 0.3);
      this.addCollider(24.75, z - 0.25, 25.6, z + 0.25);
      this.addStation(25.0, z, -Math.PI / 2, ['latpull'], { equip: 'lat', ax: 23.9, az: z });
    }
    this.zoneSign('کراس‌فیت', '#ff7b00', 22.5, 6.2, -14, -Math.PI / 2, 5);
    this.zoneSign('دستگاه‌ها', '#00b4d8', 22.5, 6.2, 11, -Math.PI / 2, 5);
  }

  buildYoga() {
    const m = this.matte;
    m.box(11.6, 0.025, 20, -22.6, 0.013, -12.5, '#e8d4b0');
    const mats = ['#ff4da6', '#ff7b00', '#ffd34d', '#2ecc71', '#00b4d8', '#9b5de5'];
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 3; c++) {
        const x = -26.5 + c * 3.6;
        const z = -20.5 + r * 3.1;
        m.box(0.8, 0.03, 2, x, 0.03, z, mats[(r + c) % mats.length]);
        this.addStation(x, z, rand(-0.3, 0.3) + (c % 2 ? Math.PI : 0), ['warrior', 'cobra', 'downdog', 'meditate', 'tree', 'toetouch', 'sideplank', 'split', 'bridge']);
      }
    }
    for (const [x, z, c] of [[-17.8, -21.8, '#e76f51'], [-17.8, -3.3, '#2a9d8f'], [-28, -2.8, '#e9c46a'], [-28, -22.4, '#f4a261']]) this.plant(x, z, c, 1.2);
    // a soft rainbow arch over the studio
    for (let i = 0; i < 6; i++) {
      this.glow.geo(new THREE.TorusGeometry(3.6 - i * 0.25, 0.08, 6, 40, Math.PI), -22.6, 3.2, -23.2, mats[i]);
    }
    this.zoneSign('یوگا و کشش', '#ff4da6', -22.6, 6.4, -12, Math.PI / 2, 5);
  }

  buildCalisthenics() {
    const m = this.matte;
    const mt = this.metal;
    m.box(11.6, 0.025, 20, -22.6, 0.013, 12, '#3a4a6b');
    for (let k = 0; k < 5; k++) m.box(11.6, 0.027, 0.08, -22.6, 0.014, 2.2 + k * 4.4, '#7fe0ff');
    // pull-up rig: bars along x, one per row
    for (const [z, c] of [[6, '#ffd34d'], [10, '#00b4d8'], [14, '#ff4da6'], [18, '#2ecc71']]) {
      for (const s of [-1, 1]) {
        mt.box(0.12, 2.6, 0.12, -21 + s * 0.8, 1.3, z, '#1d2433');
        mt.box(0.14, 0.2, 0.14, -21 + s * 0.8, 1.9, z, c);
        this.addCollider(-21 + s * 0.8 - 0.08, z - 0.08, -21 + s * 0.8 + 0.08, z + 0.08);
      }
      mt.cyl(0.03, 1.7, -21, 2.5, z, '#c9ced6', 0, 0, Math.PI / 2, 10);
      this.addStation(-21, z, 0, ['pullup', 'muscleup'], { equip: 'pullup', ax: -21, az: z + 1.1 });
    }
    // parallettes for L-sits and handstands
    for (const [z, c] of [[6, '#e63946'], [10, '#2f6fed'], [14, '#ff7b00'], [18, '#9b5de5']]) {
      for (const s of [-1, 1]) {
        mt.cyl(0.025, 0.5, -25.6 + s * 0.3, 0.2, z, c, Math.PI / 2, 0, 0, 8);
        for (const dz of [-0.2, 0.2]) mt.box(0.04, 0.2, 0.04, -25.6 + s * 0.3, 0.1, z + dz, '#2c3140');
      }
      this.addStation(-25.6, z - 0.5, 0, ['lsit', 'pistol', 'hspu', 'handstand', 'pushup', 'diamond']);
    }
    this.zoneSign('کالیستنیکس', '#7fe0ff', -22.6, 6.4, 12, Math.PI / 2, 5);
  }

  buildClimbWall() {
    const m = this.matte;
    const z = -ROOM.z + 0.4;
    // a tall wall: nearly up to the roof
    m.box(11.5, 9.6, 0.5, 22, 4.8, z, '#5c677d');
    const panels = ['#ff7b00', '#2ecc71', '#00b4d8', '#ff4da6', '#ffd34d'];
    for (let i = 0; i < 5; i++) m.box(2.2, 9.4, 0.12, 17.6 + i * 2.2, 4.8, z + 0.3, panels[i], 0, 0.06 * (i % 2 ? 1 : -1));
    for (let i = 0; i < 300; i++) {
      const hx = rand(16.6, 27.4);
      const hy = rand(0.3, 9.4);
      if (Math.random() < 0.5) m.sphere(rand(0.06, 0.12), hx, hy, z + 0.4, pick(['#e63946', '#ffd34d', '#2ecc71', '#2f6fed', '#9b5de5', '#ffffff', '#111111']), 0.7);
      else m.box(rand(0.12, 0.25), rand(0.08, 0.14), 0.08, hx, hy, z + 0.4, pick(['#ff4da6', '#00b4d8', '#ff7b00', '#d4f700']), 0, rand(-0.8, 0.8));
    }
    m.box(11.5, 0.05, 2.4, 22, 0.025, z + 1.7, '#2f6fed');
    for (let i = 0; i < 4; i++) m.box(2.6, 0.06, 0.05, 17.8 + i * 2.85, 0.03, z + 2.9, '#ffd34d');
    this.addCollider(16.2, z - 0.3, 27.8, z + 0.5);
    for (const x of [18, 20.5, 23, 25.5]) this.addStation(x, z + 1.15, Math.PI, ['boulder'], { equip: 'boulder', ax: x, az: z + 3.5, wall: 0.7, wallH: 9.3 });
    this.zoneSign('سنگ‌نوردی', '#2ecc71', 22, 10.25, z + 0.4, 0, 5);
  }

  buildSpeedBags() {
    const m = this.matte;
    const mt = this.metal;
    const z = ROOM.z - 0.6;
    for (const [x, c] of [[19, '#e63946'], [21.6, '#2f6fed'], [24.2, '#ffd34d']]) {
      m.box(1.4, 1.2, 0.2, x, 2.6, z + 0.35, c);
      m.box(0.9, 0.06, 0.7, x, 2.1, z, '#2c3140');
      mt.cyl(0.01, 0.12, x, 2.0, z - 0.1, '#c9ced6', 0, 0, 0, 4);
      m.sphere(0.13, x, 1.78, z - 0.1, '#8b1e2d', 1.4);
      this.addStation(x, z - 0.75, 0, ['speedbag'], { equip: 'speedbag', ax: x, az: z - 1.9 });
    }
    this.addCollider(18, z - 0.2, 25.2, z + 0.6);
  }

  buildDecor() {
    const m = this.matte;
    const glow = this.glow;
    const X = ROOM.x;
    const Z = ROOM.z;
    // a colour band of its own on every wall
    const bands = {
      north: ['#e63946', '#ff7b00', '#ffd34d'], south: ['#00b4d8', '#2f6fed', '#7fe0ff'],
      east: ['#2ecc71', '#a7e22e', '#ffd34d'], west: ['#9b5de5', '#ff4da6', '#ff8fab'],
    };
    bands.north.forEach((c, i) => m.box(X * 2, 0.22, 0.06, 0, 1.7 + i * 0.3, -Z + 0.06, c));
    bands.south.forEach((c, i) => m.box(X * 2, 0.22, 0.06, 0, 1.7 + i * 0.3, Z - 0.06, c));
    bands.east.forEach((c, i) => { for (const sz of [-1, 1]) m.box(0.06, 0.22, Z - RUN_HALL.door, X - 0.06, 1.7 + i * 0.3, sz * (Z + RUN_HALL.door) / 2, c); });
    bands.west.forEach((c, i) => m.box(0.06, 0.22, Z * 2, -X + 0.06, 1.7 + i * 0.3, 0, c));
    // party bunting across the hall
    const flags = ['#e63946', '#ff7b00', '#ffd34d', '#2ecc71', '#00b4d8', '#9b5de5', '#ff4da6'];
    for (const bz of [-20, -8, 8, 20]) {
      const n = Math.round(X);
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        const x = -X + 3 + u * (X * 2 - 6);
        const y = ROOM.h - 1.6 - Math.sin(Math.PI * ((i % 10) / 9)) * 0.8;
        m.add(UnitGeo.cone(3), x, y - 0.25, bz, flags[i % flags.length], Math.PI, Math.PI / 6, 0, 0.22, 0.45, 0.04);
      }
    }
    // lounge in the south-west corner: sofas, vending machines, water coolers
    for (const [x, c] of [[-36, '#e63946'], [-31, '#2f6fed']]) {
      m.box(3.4, 0.45, 1.0, x, 0.32, Z - 1.4, c);
      m.box(3.4, 0.7, 0.3, x, 0.75, Z - 0.95, c);
      for (let k = 0; k < 3; k++) m.box(1.0, 0.18, 0.8, x - 1.1 + k * 1.1, 0.62, Z - 1.45, '#f1faee');
      this.addCollider(x - 1.75, Z - 1.95, x + 1.75, Z - 0.8);
    }
    for (const [x, c] of [[-26.5, '#ff7b00'], [-25.2, '#2ecc71']]) {
      m.box(1.1, 2.0, 0.8, x, 1.0, Z - 0.6, c);
      glow.box(0.8, 1.1, 0.04, x - 0.08, 1.3, Z - 1.02, '#e8f6ff');
      for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) m.box(0.16, 0.18, 0.02, x - 0.32 + j * 0.24, 0.95 + k * 0.28, Z - 1.05, pick(flags));
      this.addCollider(x - 0.55, Z - 1.0, x + 0.55, Z);
    }
    for (const x of [-38.5, 38.5]) {
      m.box(0.45, 1.0, 0.45, x, 0.5, -Z + 0.6, '#e9eef7');
      this.metal.cyl(0.18, 0.5, x, 1.28, -Z + 0.6, '#7fc8ff');
      this.addCollider(x - 0.3, -Z + 0.3, x + 0.3, -Z + 0.9);
    }
    // benches around the track
    for (const [x, z, c] of [[-17, -12, '#ffd34d'], [-17, 14, '#00b4d8'], [8, -22, '#ff4da6'], [-5, 24, '#2ecc71']]) {
      m.box(2.4, 0.08, 0.5, x, 0.45, z, c);
      for (const s of [-1, 1]) m.box(0.08, 0.45, 0.45, x + s * 1.1, 0.22, z, '#2c3140');
      this.addCollider(x - 1.2, z - 0.25, x + 1.2, z + 0.25);
    }
    for (const [x, z, c] of [[-16.5, 22, '#e76f51'], [16.5, 24, '#2a9d8f'], [-16.5, -26, '#e9c46a'], [3, 27.5, '#f4a261'], [-3, 27.5, '#9b5de5'], [14.5, -30, '#ff4da6']]) this.plant(x, z, c, 1.1);
    // murals
    const mural = (text, cols, x, y, z, ry, w) => {
      const tex = makeCanvasTexture(1024, 384, (ctx, W, H) => {
        cols.forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.beginPath();
          const x0 = (i / cols.length) * W * 1.3 - 120;
          ctx.moveTo(x0, 0); ctx.lineTo(x0 + W / cols.length * 1.3, 0); ctx.lineTo(x0 + W / cols.length * 1.3 - 160, H); ctx.lineTo(x0 - 160, H);
          ctx.fill();
        });
        ctx.fillStyle = 'rgba(10,14,30,0.35)';
        ctx.fillRect(0, H * 0.3, W, H * 0.4);
        ctx.direction = 'rtl';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `150px ${DISPLAY_FONT}`;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 12;
        ctx.fillText(text, W / 2, H / 2 + 6);
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.375), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      mesh.position.set(x, y, z);
      mesh.rotation.y = ry;
      this.scene.add(mesh);
    };
    mural('حرکت یعنی زندگی', ['#e63946', '#ff7b00', '#ffd34d', '#2ecc71', '#00b4d8', '#9b5de5'], -22, 5.2, -Z + 0.08, 0, 12);
    mural('هر روز قوی‌تر', ['#ff4da6', '#9b5de5', '#4361ee', '#00b4d8', '#2ecc71'], -22, 5.2, Z - 0.08, Math.PI, 12);
    this.painting('waves', 22, 6.6, Z - 0.12, Math.PI, 9);
  }

  nearArm() {
    const p = this.player.ch.root.position;
    return Math.hypot(p.x - ARM_TABLE.x, p.z - ARM_TABLE.z) < 2.0;
  }

  nearPortal() {
    const p = this.player.ch.root.position;
    return Math.hypot(p.x - PORTAL.x, p.z - PORTAL.z) < 2.6;
  }
}
