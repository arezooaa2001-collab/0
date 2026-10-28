'use strict';
/* The gym: hall, equipment, strength tower, 40 training NPCs, player movement and camera */

const ROOM = { x: 30, z: 22, h: 10 };
const TRACK = { cx: 0, cz: 2, a: 12.5, b: 7.5, w: 2.4 };
const TOWER = { x: 0, z: -19.4, standX: 0, standZ: -17.4, segs: 20 };
const PORTAL = { x: 0, z: 14.6 };

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
  tex.repeat.set(10, 7.5);
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
    super({ bounds: { rect: [ROOM.x, ROOM.z] }, track: TRACK, spawn: { x: 0, z: 4, yaw: Math.PI }, background: '#141a28', fog: [48, 100] });
    this.ceiling = ROOM.h;
    this.cloudTex = cloudSkyTexture();
    this.cloudMat = new THREE.MeshBasicMaterial({ map: this.cloudTex, toneMapped: false });
    this.buildLights();
    this.buildRoom();
    this.buildTrack();
    this.buildWeights();
    this.buildCardio();
    this.buildMats();
    this.buildBoxing();
    this.buildNorth();
    this.buildDoor();
    this.buildPortal();
    this.buildTower();
    this.buildBoards();
    this.finishBatches();
    this.onImpact = () => this.strikeTower();
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
    m.box(0.5, H, Z * 2, X + 0.25, H / 2, 0, wall);
    m.box(X * 2, 1.3, 0.1, 0, 0.65, -Z + 0.03, dado);
    m.box(X * 2, 1.3, 0.1, 0, 0.65, Z - 0.03, dado);
    m.box(0.1, 1.3, Z * 2, -X + 0.03, 0.65, 0, dado);
    m.box(0.1, 1.3, Z * 2, X - 0.03, 0.65, 0, dado);
    m.box(X * 2, 0.12, 0.12, 0, 1.36, -Z + 0.06, '#ffc23d');
    m.box(X * 2, 0.12, 0.12, 0, 1.36, Z - 0.06, '#ffc23d');
    m.box(0.12, 0.12, Z * 2, -X + 0.06, 1.36, 0, '#ffc23d');
    m.box(0.12, 0.12, Z * 2, X - 0.06, 1.36, 0, '#ffc23d');
    m.box(X * 2 + 1, 0.3, Z * 2 + 1, 0, H + 0.15, 0, '#1a1f2c');
    for (const tz of [-14, -3, 8, 18]) this.metal.box(X * 2, 0.35, 0.3, 0, H - 0.5, tz, '#39404f');
    for (const lx of [-22, -11, 0, 11, 22]) {
      for (const lz of [-17, -8.5, 0, 8.5, 17]) if (Math.abs(lx) > 12 || Math.abs(lz) > 7) this.glow.box(5, 0.06, 1.2, lx, H - 0.05, lz, '#fff4dc');
    }
    // big skylight with drifting clouds
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(24, 13), this.cloudMat);
    sky.rotation.x = Math.PI / 2;
    sky.position.set(0, H - 0.08, 0);
    this.scene.add(sky);
    for (const sz of [-1, 1]) m.box(24.6, 0.3, 0.3, 0, H - 0.2, sz * 6.6, '#e9eef7');
    for (const sx of [-1, 1]) m.box(0.3, 0.3, 13.4, sx * 12.15, H - 0.2, 0, '#e9eef7');
    for (const bx of [-6, 0, 6]) m.box(0.12, 0.12, 13, bx, H - 0.15, 0, '#e9eef7');
    // high windows on the long walls
    for (const sx of [-1, 1]) {
      for (let wz = -18; wz <= 18; wz += 6) {
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
    for (const px of [-16.8, 16.8]) {
      for (const pz of [-12, 0, 12]) {
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
    m.box(12.6, 0.03, 43.6, -23.7, 0.015, 0, '#2a2d34');
    // mirror wall
    mt.box(0.05, 2.0, 38, -29.9, 2.45, 0, '#bcd6ea');
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
          mt.cyl(0.07 * s, 0.07, -28.36, y, z, '#22252b', 0, 0, Math.PI / 2, 10);
          mt.cyl(0.07 * s, 0.07, -28.64, y, z, '#22252b', 0, 0, Math.PI / 2, 10);
        }
      }
      this.addCollider(-30, zc - len / 2 - 0.15, -27.95, zc + len / 2 + 0.15);
      for (const k of [-3, 0, 3]) this.addStation(-26.6, zc + k, -Math.PI / 2, ['curl', 'curl', 'squat'], { equip: 'dumbbell' });
    }
    // bench presses
    for (const z of [-17, -1.5]) {
      m.box(1.4, 0.12, 0.38, -21.3, 0.47, z, '#111317');
      mt.box(0.08, 0.42, 0.08, -21.8, 0.21, z, '#3c4250');
      mt.box(0.08, 0.42, 0.08, -20.8, 0.21, z, '#3c4250');
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
    this.addCollider(-27, 19.1, -23.3, 20.1);
    for (let i = 0; i < 6; i++) {
      const x = -27.5 + i * 0.7;
      mt.sphere(0.13 + i * 0.012, x, 0.14, -20.6, '#22252b');
      mt.geo(UnitGeo.torus(1, 0.18, 6, 16), x, 0.3, -20.6, '#22252b', 0, 0, 0, 0.09);
    }
    this.addCollider(-28, -21, -23.6, -20.2);
  }

  buildCardio() {
    const m = this.matte;
    const mt = this.metal;
    m.box(12.6, 0.03, 43.6, 23.7, 0.015, 0, '#2a2d34');
    for (const z of [-15, -10, -5, 0, 5, 10]) {
      const x = 26;
      m.box(2.0, 0.2, 0.85, x, 0.1, z, '#2d3038');
      m.box(1.75, 0.02, 0.6, x - 0.05, 0.21, z, '#0e0f12');
      for (const s of [-1, 1]) {
        mt.box(1.8, 0.04, 0.05, x, 0.24, z + s * 0.4, '#9aa0a8');
        mt.box(0.06, 1.15, 0.06, x + 0.95, 0.78, z + s * 0.36, '#9aa0a8');
      }
      mt.cyl(0.025, 0.78, x + 0.8, 1.15, z, '#9aa0a8', Math.PI / 2, 0, 0, 10);
      m.box(0.24, 0.42, 0.82, x + 1.02, 1.45, z, '#23262e');
      this.glow.box(0.02, 0.22, 0.5, x + 0.89, 1.5, z, '#39c0ff');
      this.addCollider(x + 0.8, z - 0.48, x + 1.2, z + 0.48);
      this.addStation(x - 0.25, z, Math.PI / 2, ['treadmill'], { equip: 'treadmill', ax: x - 1.6, az: z });
    }
    for (const z of [-15, -10, -5, 0, 5]) {
      const x = 21.3;
      mt.box(0.1, 0.1, 1.2, x, 0.1, z, '#2c3140');
      mt.box(0.08, 0.75, 0.08, x, 0.45, z - 0.2, '#e63946');
      m.box(0.26, 0.08, 0.32, x, 0.86, z - 0.25, '#111317');
      mt.box(0.08, 0.95, 0.08, x, 0.6, z + 0.45, '#e63946');
      mt.cyl(0.03, 0.55, x, 1.1, z + 0.45, '#9aa0a8', 0, 0, Math.PI / 2, 10);
      mt.cyl(0.24, 0.07, x, 0.35, z + 0.42, '#22252b', 0, 0, Math.PI / 2, 18);
      this.addCollider(x - 0.3, z + 0.2, x + 0.3, z + 0.7);
      this.addStation(x, z - 0.28, 0, ['bike'], { equip: 'bike', ax: x - 1.0, az: z - 0.28 });
      this.addStation(x - 1.8, z, Math.PI / 2, ['jack', 'squat', 'rope', 'pushup']);
    }
    for (let i = 0; i < 4; i++) {
      const x = 19 + i * 2.6;
      m.box(1.2, 1.9, 0.5, x, 0.95, 21.7, i % 2 ? '#2f6fed' : '#e63946');
      m.box(0.04, 1.7, 0.02, x, 0.95, 21.44, '#0e1424');
    }
    this.addCollider(18, 21.3, 28.5, 22);
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
    // benches to sit on
    for (const x of [-25, 25]) {
      m.box(2.4, 0.08, 0.5, x, 0.45, -21.3, '#b58450');
      for (const s of [-1, 1]) m.box(0.08, 0.45, 0.45, x + s * 1.1, 0.22, -21.3, '#2c3140');
    }
    // water cooler
    m.box(0.45, 1.0, 0.45, 27.5, 0.5, -21.4, '#e9eef7');
    mt.cyl(0.18, 0.5, 27.5, 1.28, -21.4, '#7fc8ff');
    this.addCollider(27.2, -21.7, 27.8, -21.1);
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
      { lines: [{ text: 'زور = تمرین + اراده', size: 110, display: true }], pos: [-ROOM.x + 0.06, 3.6, 0], ry: Math.PI / 2 },
      { lines: [{ text: 'قهرمان بعدی تویی!', size: 120, display: true, color: '#ffc23d' }], pos: [ROOM.x - 0.06, 3.6, 0], ry: -Math.PI / 2 },
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
    this.cloudTex.offset.x = (this.cloudTex.offset.x + dt * 0.006) % 1;
    const P = this.portal;
    const open = stats.level >= ISLAND_LEVEL;
    P.ring.rotation.z += dt * (open ? 1.2 : 0.25);
    P.ring.material.color.set(open ? '#7fe0ff' : '#5d6b8a');
    P.glow.material.opacity = open ? 0.45 + 0.2 * Math.sin(this.time * 3) : 0.12;
    P.clouds.rotation.y += dt * 0.3;
  }

  nearPortal() {
    const p = this.player.ch.root.position;
    return Math.hypot(p.x - PORTAL.x, p.z - PORTAL.z) < 2.6;
  }
}
