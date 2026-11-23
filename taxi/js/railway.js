import * as THREE from 'three';
import { clamp, damp, fa, canvasTexture, mergeByMaterial, circleCol, boxCol } from './util.js';
import { box, cyl, sphere, buildPerson, poseIdle } from './models.js';

const VMAX = 22; // m/s cruise (about 80 km/h)
const ACC = 1.1; // m/s² for speeding up and braking
const GAP = 1.1; // coupling gap between vehicles
const PLATFORM = 70; // station platform length
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });

/** window strip for the coaches: lit squares at night through emissiveMap */
function coachTexture() {
  return canvasTexture(512, 64, (g, w, h) => {
    g.fillStyle = '#efe6cc';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      const x = 14 + i * 62;
      g.fillStyle = '#26323d';
      g.fillRect(x, 10, 46, 40);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(x + 4, 13, 12, 34);
    }
  });
}
function coachGlow() {
  return canvasTexture(512, 64, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 3 === 1 ? '#c98a3a' : '#ffd88a';
      g.fillRect(14 + i * 62, 10, 46, 40);
    }
  }, { srgb: true });
}
function stripeTexture() {
  return canvasTexture(256, 16, (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#ffffff' : '#e02020';
      g.fillRect(i * 32, 0, 32, h);
    }
  });
}
function signBoard(text, sub) {
  return canvasTexture(512, 160, (g, w, h) => {
    g.fillStyle = '#1d4d7a';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff';
    g.lineWidth = 8;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 62px Vazirmatn, Tahoma, sans-serif';
    g.fillText(text, w / 2, h / 2 - 18);
    g.font = '34px Vazirmatn, Tahoma, sans-serif';
    g.fillText(sub, w / 2, h / 2 + 42);
  });
}
function crossbuck() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.translate(w / 2, h / 2);
    for (const a of [Math.PI / 4, -Math.PI / 4]) {
      g.save();
      g.rotate(a);
      g.fillStyle = '#fff';
      g.fillRect(-120, -22, 240, 44);
      g.strokeStyle = '#d01818';
      g.lineWidth = 8;
      g.strokeRect(-120, -22, 240, 44);
      g.restore();
    }
    g.fillStyle = '#d01818';
    g.font = 'bold 30px Vazirmatn, Tahoma, sans-serif';
    g.textAlign = 'center';
    g.fillText('قطار', 0, 92);
  });
}

/** A steam train on a line through the farmland: tunnels at both ends, a village station,
 *  a level crossing with barriers, lamps and a bell. Cars wait at the gate; you can try to beat
 *  the train across (at your own risk). */
export class Railway {
  constructor(game) {
    this.g = game;
    const w = game.world, R = w.rail;
    this.R = R;
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.findCrossing();
    // the station sits beside the track, a short way up the line from the road
    this.station = { z: this.cz + 72 };
    this.buildTrack();
    this.buildTunnels();
    this.buildStation();
    this.buildCrossing();
    this.buildTrain();
    // timetable
    this.state = 'tunnel';
    this.wait = 18;
    this.dir = 1;
    this.s = 0; // head position along the track (z)
    this.v = 0;
    this.closed = false;
    this.armK = 0; // 0 = up, 1 = down
    this.flashT = 0;
    this.bellT = 0;
    this.hornCd = 0;
    this.hitCd = 0;
    this.dodge = null;
    this.smokeT = 0;
    this.chuffT = 0;
    this.wheelA = 0;
  }
  /* ---------------- building ---------------- */
  findCrossing() {
    const w = this.g.world, R = this.R;
    let best = Infinity, bz = 0;
    for (let z = R.z0; z <= R.z1; z += 1) {
      const d = w.roadDist(R.x, z);
      if (d < best) {
        best = d;
        bz = z;
      }
    }
    this.cz = bz;
    const ne = w.nearestEdge(R.x, bz);
    let dx = 1, dz = 0;
    if (ne) {
      const A = w.graph.nodes[ne.edge.a], B = w.graph.nodes[ne.edge.b];
      const L = Math.hypot(B.x - A.x, B.z - A.z) || 1;
      dx = (B.x - A.x) / L;
      dz = (B.z - A.z) / L;
      // road centre exactly under the track
      if (Math.abs(dx) > 0.2) this.cz = ne.z + ((R.x - ne.x) / dx) * dz;
    }
    if (dx < 0) {
      dx = -dx;
      dz = -dz;
    }
    this.road = { dx, dz, lx: -dz, lz: dx };
    this.centre = { x: R.x, z: this.cz };
  }
  buildTrack() {
    const w = this.g.world, R = this.R, len = R.z1 - R.z0 + 40, zc = (R.z0 + R.z1) / 2;
    const y0 = (z) => w.heightAt(R.x, z);
    const gy = y0(zc);
    const ballast = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.35, len), mat(0x8a8178, { roughness: 1 }));
    ballast.position.set(R.x, gy + 0.05, zc);
    ballast.receiveShadow = true;
    this.group.add(ballast);
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.2, len), mat(0x6e675f, { roughness: 1 }));
    shoulder.position.set(R.x, gy - 0.02, zc);
    shoulder.receiveShadow = true;
    this.group.add(shoulder);
    // sleepers (not across the road: a plank deck there)
    const n = Math.floor(len / 0.75);
    const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.16, 0.26), mat(0x5a4130, { roughness: 0.95 }), n);
    let k = 0;
    for (let i = 0; i < n; i++) {
      const z = R.z0 - 20 + i * 0.75;
      if (Math.abs(z - this.cz) < 7.5) continue;
      sl.setMatrixAt(k++, _m.makeTranslation(R.x, gy + 0.28, z));
    }
    sl.count = k;
    sl.receiveShadow = true;
    this.group.add(sl);
    const railMat = mat(0x9aa0a6, { metalness: 0.85, roughness: 0.35 });
    for (const sx of [-0.72, 0.72]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, len), railMat);
      r.position.set(R.x + sx, gy + 0.43, zc);
      r.castShadow = true;
      this.group.add(r);
    }
    // the crossing deck: rubber panels flush with the road
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 14), mat(0x2f3134, { roughness: 0.9 }));
    deck.position.set(R.x, y0(this.cz) + 0.3, this.cz);
    deck.receiveShadow = true;
    this.group.add(deck);
    this.railY = gy + 0.51;
  }
  buildTunnels() {
    const w = this.g.world, R = this.R;
    const rock = mat(0x7b7468, { roughness: 1, flatShading: true });
    const stone = mat(0x9b8f7e, { roughness: 0.95 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.DoubleSide });
    this.portals = [];
    for (const end of [-1, 1]) {
      const zEnd = end > 0 ? R.z1 : R.z0;
      const g = new THREE.Group();
      g.position.set(R.x, w.heightAt(R.x, zEnd), zEnd);
      g.rotation.y = end > 0 ? 0 : Math.PI;
      // a rocky hill swallowing the line
      const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), rock);
      hill.scale.set(R.mound * 1.15, 24, R.mound * 0.95);
      hill.position.set(0, -4, R.mound + 1.5);
      g.add(hill);
      const hill2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), rock);
      hill2.scale.set(18, 15, 16);
      hill2.position.set(16, -2, R.mound * 0.9 + 6);
      g.add(hill2);
      // a wide stone wall with the tunnel mouth, built into the hillside
      const face = new THREE.Group();
      box(26, 10, 2, stone, 0, 5, 1, face);
      for (const sx of [-1, 1]) {
        const wing = box(10, 7, 1.6, stone, sx * 16.5, 3.5, 4.5, face);
        wing.rotation.y = sx * 0.9;
      }
      const mouth = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 6.4), dark);
      mouth.position.set(0, 3.2, -0.02);
      face.add(mouth);
      const arch = new THREE.Mesh(new THREE.CircleGeometry(2.6, 16, 0, Math.PI), dark);
      arch.position.set(0, 6.3, -0.03);
      face.add(arch);
      box(27, 0.6, 2.4, mat(0x7c705f), 0, 10.2, 1, face);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.9), new THREE.MeshStandardMaterial({ map: signBoard('تونل', end > 0 ? 'کوه جنوبی' : 'کوه شمالی') }));
      sign.position.set(0, 7.6, -0.05);
      sign.rotation.y = Math.PI;
      face.add(sign);
      g.add(face);
      mergeByMaterial(g);
      this.group.add(g);
      w.statics.insert(circleCol(R.x, zEnd + end * R.mound * 0.8, R.mound * 0.92));
      this.portals.push(g);
    }
  }
  buildStation() {
    const w = this.g.world, R = this.R, S = this.station;
    const z0 = S.z - PLATFORM / 2;
    const gy = w.heightAt(R.x + 8, S.z);
    const g = new THREE.Group();
    g.position.set(R.x, gy, S.z);
    const conc = mat(0xb9b3a8, { roughness: 0.95 });
    const brick = mat(0xa0533c, { roughness: 0.9 });
    const roof = mat(0x3b4a5a, { roughness: 0.7 });
    const wood = mat(0x7a5638);
    const white = mat(0xf2efe6);
    // platform with a yellow safety line
    box(4.6, 0.95, PLATFORM, conc, 4.4, 0.47, 0, g);
    box(0.25, 0.02, PLATFORM, mat(0xffd21a), 2.35, 0.96, 0, g);
    // shelter roof on posts
    for (let i = -3; i <= 3; i++) box(0.18, 3, 0.18, white, 5.6, 2.45, i * 8, g);
    const canopy = box(4.2, 0.22, 56, roof, 4.8, 4.0, 0, g);
    canopy.rotation.z = -0.06;
    // station house
    box(7, 4.6, 14, brick, 11.2, 2.3, 0, g);
    const hr = box(8.2, 0.5, 15.4, roof, 11.2, 4.85, 0, g);
    hr.rotation.z = 0.04;
    box(1.6, 2.6, 0.12, wood, 7.66, 1.3, -2.5, g).rotation.y = Math.PI / 2;
    for (const zz of [-5, 2, 5]) box(0.1, 1.4, 1.6, mat(0x2b3a48, { emissive: 0xffc070, emissiveIntensity: 0 }), 7.66, 2.4, zz, g);
    const name = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.4), new THREE.MeshStandardMaterial({ map: signBoard('ایستگاه راه‌آهن', 'روستای گندم‌زار') }));
    name.position.set(7.62, 3.7, 0);
    name.rotation.y = -Math.PI / 2;
    g.add(name);
    // the side facing the road: entrance, windows and another sign
    const name2 = name.clone();
    name2.position.set(14.78, 3.7, 0);
    name2.rotation.y = Math.PI / 2;
    g.add(name2);
    box(0.12, 2.6, 1.8, wood, 14.72, 1.3, 0, g);
    box(0.4, 0.15, 2.6, roof, 15.0, 2.75, 0, g);
    for (const zz of [-4.6, 4.6]) box(0.1, 1.4, 1.8, mat(0x2b3a48, { emissive: 0xffc070, emissiveIntensity: 0 }), 14.74, 2.3, zz, g);
    // platform benches and lamps
    for (const zz of [-24, -8, 8, 24]) {
      box(0.6, 0.1, 2.2, wood, 5.2, 1.45, zz, g);
      box(0.1, 0.6, 2.2, wood, 5.5, 1.75, zz, g);
    }
    const lampMat = mat(0xfff2c0, { emissive: 0xffd88a, emissiveIntensity: 0 });
    for (const zz of [-30, -15, 0, 15, 30]) {
      box(0.12, 3.4, 0.12, mat(0x333333), 3.1, 2.65, zz, g);
      sphere(0.22, lampMat, 10, 8, g).position.set(3.1, 4.45, zz);
    }
    // a big clock
    const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20), white);
    clock.rotation.z = Math.PI / 2;
    clock.position.set(5.6, 3.5, -28);
    g.add(clock);
    this.handH = box(0.04, 0.32, 0.06, mat(0x111111), 5.5, 3.5, -28, g);
    this.handM = box(0.03, 0.45, 0.04, mat(0x111111), 5.52, 3.5, -28, g);
    // gravel forecourt between the road and the station house
    const yard = new THREE.Mesh(new THREE.BoxGeometry(14, 0.1, 30), mat(0x9c9284, { roughness: 1 }));
    yard.position.set(21, 0.03, -PLATFORM / 2 + 10);
    yard.receiveShadow = true;
    g.add(yard);
    this.handH.userData.noMerge = this.handM.userData.noMerge = true;
    mergeByMaterial(g);
    this.group.add(g);
    this.stationGroup = g;
    w.nightMats.push({ mat: lampMat, max: 2.2 });
    // collisions: platform edge and the house
    w.statics.insert(boxCol(R.x + 4.4, S.z, 2.4, PLATFORM / 2));
    w.statics.insert(boxCol(R.x + 11.2, S.z, 3.6, 7.2));
    S.stopZ = S.z; // the train centre stops here
    S.z0 = z0;
    // people waiting on the platform; they board when the train leaves
    this.waiting = [];
    const looks = [
      { female: true, shirt: 0xc2185b, pants: 0x263238, hair: 0x2b1a10 },
      { female: false, shirt: 0x1565c0, pants: 0x3e2723, hair: 0x111111, mustache: true },
      { female: true, shirt: 0xf9a825, pants: 0x37474f, hair: 0x5d4037 },
      { female: false, shirt: 0x2e7d32, pants: 0x212121, hair: 0x3a2a1a },
    ];
    looks.forEach((o, i) => {
      const P = buildPerson({ skin: [0xe0ac86, 0xc68e62, 0xf1c9a5, 0xd9a07a][i], ...o });
      P.root.position.set(R.x + 4.2 + (i % 2) * 1.3, gy + 0.95, S.z - 20 + i * 11);
      P.root.rotation.y = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
      P.root.traverse((m) => {
        if (m.isMesh) m.castShadow = false;
      });
      this.group.add(P.root);
      this.waiting.push({ P, ph: Math.random() * 6 });
    });
  }
  buildCrossing() {
    const w = this.g.world, R = this.R, rd = this.road;
    const stripe = new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.6 });
    const pole = mat(0xdedede, { metalness: 0.3 });
    const darkM = mat(0x222222);
    this.lampMats = [];
    this.arms = [];
    const buck = new THREE.MeshStandardMaterial({ map: crossbuck(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      // barrier before the track on each side of it, pivot on the right-hand kerb
      const ax = R.x - side * 7.5 * rd.dx, az = this.cz - side * 7.5 * rd.dz;
      const kx = ax + rd.lx * 6.8 * -side, kz = az + rd.lz * 6.8 * -side;
      const gy = w.heightAt(kx, kz);
      const post = new THREE.Group();
      post.position.set(kx, gy, kz);
      box(0.5, 1.1, 0.5, mat(0xf2c200), 0, 0.55, 0, post);
      // the lamp mast with two red lamps and the crossbuck
      const mast = new THREE.Group();
      mast.position.set(-side * rd.dx * 1.2, 0, -side * rd.dz * 1.2);
      box(0.16, 4.2, 0.16, pole, 0, 2.1, 0, mast);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), buck);
      plate.position.y = 3.7;
      plate.rotation.y = Math.atan2(-side * rd.dx, -side * rd.dz);
      mast.add(plate);
      const head = new THREE.Group();
      head.position.y = 2.6;
      head.rotation.y = plate.rotation.y;
      box(1.1, 0.42, 0.12, darkM, 0, 0, 0, head);
      for (const lx of [-0.34, 0.34]) {
        const lm = new THREE.MeshStandardMaterial({ color: 0x551111, emissive: 0xff1a1a, emissiveIntensity: 0 });
        const L = new THREE.Mesh(new THREE.CircleGeometry(0.16, 14), lm);
        L.position.set(lx, 0, 0.07);
        head.add(L);
        this.lampMats.push(lm);
      }
      mast.add(head);
      post.add(mast);
      // the arm swings across the road from the pivot
      const pivot = new THREE.Group();
      pivot.position.set(0, 1.0, 0);
      pivot.rotation.order = 'YXZ';
      // local +x points across the road
      pivot.rotation.y = Math.atan2(-side * rd.lz, side * rd.lx);
      const arm = box(11.4, 0.16, 0.16, stripe, 5.8, 0, 0, pivot);
      arm.castShadow = true;
      const tip = new THREE.MeshStandardMaterial({ color: 0x551111, emissive: 0xff2020, emissiveIntensity: 0 });
      for (const ex of [4, 8, 11.3]) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), tip);
        b.position.set(ex, 0.14, 0);
        pivot.add(b);
      }
      this.lampMats.push(tip);
      post.add(pivot);
      this.group.add(post);
      this.arms.push({ pivot, kick: 0, x: kx, z: kz, side });
      w.statics.insert(circleCol(kx, kz, 0.45));
    }
    // stop lines for traffic, before each gate (both lanes)
    this.stops = [-1, 1].map((side) => ({ x: R.x - side * 10.5 * rd.dx, z: this.cz - side * 10.5 * rd.dz }));
  }
  /** one rigid vehicle: returns { group, len, wheels:[{x,z,r}] } with +z = forward */
  buildLoco() {
    const g = new THREE.Group();
    const black = mat(0x1d1f22, { metalness: 0.4, roughness: 0.45 });
    const red = mat(0xb3261e, { roughness: 0.5 });
    const gold = mat(0xd9a83a, { metalness: 0.8, roughness: 0.3 });
    const grey = mat(0x3a3d42, { metalness: 0.3 });
    box(2.7, 0.55, 11.4, red, 0, 1.05, 0, g);
    const boiler = cyl(1.05, 1.05, 7.4, black, 20, g);
    boiler.rotation.x = Math.PI / 2;
    boiler.position.set(0, 2.25, 1.9);
    for (const zz of [-1.2, 0.8, 2.8, 4.8]) {
      const band = cyl(1.08, 1.08, 0.12, gold, 20, g);
      band.rotation.x = Math.PI / 2;
      band.position.set(0, 2.25, zz);
    }
    const smoke = cyl(1.1, 1.1, 1.1, grey, 20, g);
    smoke.rotation.x = Math.PI / 2;
    smoke.position.set(0, 2.25, 5.5);
    const door = cyl(0.85, 0.85, 0.1, black, 20, g);
    door.rotation.x = Math.PI / 2;
    door.position.set(0, 2.25, 6.08);
    const star = cyl(0.25, 0.25, 0.08, gold, 5, g);
    star.rotation.x = Math.PI / 2;
    star.position.set(0, 2.25, 6.14);
    const chim = cyl(0.42, 0.32, 1.3, black, 14, g);
    chim.position.set(0, 3.85, 5.1);
    const chimTop = cyl(0.55, 0.42, 0.3, black, 14, g);
    chimTop.position.set(0, 4.6, 5.1);
    sphere(0.55, gold, 14, 10, g).position.set(0, 3.25, 2.6);
    sphere(0.42, black, 12, 8, g).position.set(0, 3.2, 0.6);
    const whistle = cyl(0.07, 0.07, 0.5, gold, 8, g);
    whistle.position.set(0.3, 3.7, -1.2);
    // cab
    box(2.9, 2.5, 3.3, red, 0, 2.6, -3.9, g);
    box(3.2, 0.2, 3.9, black, 0, 3.95, -3.9, g);
    for (const sx of [-1.46, 1.46]) box(0.04, 0.9, 1.1, mat(0x1a2a36, { emissive: 0xffb050, emissiveIntensity: 0 }), sx, 3.0, -3.4, g);
    // cow catcher
    const cc = box(2.6, 0.7, 0.9, red, 0, 0.55, 6.1, g);
    cc.rotation.x = -0.5;
    for (const sx of [-0.95, 0.95]) {
      const bf = cyl(0.16, 0.16, 0.5, grey, 10, g);
      bf.rotation.x = Math.PI / 2;
      bf.position.set(sx, 1.1, 5.9);
    }
    // headlamp
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xfff0b0, emissiveIntensity: 0.6 });
    const lamp = cyl(0.28, 0.28, 0.3, lampMat, 14, g);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(0, 3.45, 5.75);
    box(0.7, 0.6, 0.5, black, 0, 3.45, 5.5, g);
    this.locoLamp = lampMat;
    this.cabMat = g.children.find((o) => o.material && o.material.emissive && o.material.emissive.getHex() === 0xffb050)?.material;
    const wheels = [];
    for (const z of [-1.7, 0.2, 2.1]) for (const x of [-1.45, 1.45]) wheels.push({ x, z, r: 0.78, big: true });
    for (const z of [4.3, 5.3]) for (const x of [-1.3, 1.3]) wheels.push({ x, z, r: 0.42 });
    for (const z of [-4.6]) for (const x of [-1.3, 1.3]) wheels.push({ x, z, r: 0.5 });
    mergeByMaterial(g);
    return { group: g, len: 12.6, wheels, loco: true };
  }
  buildTender() {
    const g = new THREE.Group();
    const black = mat(0x1d1f22, { metalness: 0.4, roughness: 0.45 });
    const red = mat(0xb3261e, { roughness: 0.5 });
    box(2.7, 0.5, 6.2, red, 0, 1.05, 0, g);
    box(2.8, 1.9, 5.8, black, 0, 2.2, 0, g);
    const coal = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat(0x151515, { roughness: 1, flatShading: true }));
    coal.scale.set(1.25, 0.45, 2.5);
    coal.position.set(0, 3.15, 0.2);
    g.add(coal);
    box(2.84, 0.12, 5.84, mat(0xd9a83a, { metalness: 0.8, roughness: 0.3 }), 0, 1.4, 0, g);
    const wheels = [];
    for (const z of [-2, 0, 2]) for (const x of [-1.3, 1.3]) wheels.push({ x, z, r: 0.45 });
    mergeByMaterial(g);
    return { group: g, len: 6.4, wheels };
  }
  buildCoach(i) {
    const g = new THREE.Group();
    const green = mat([0x2f6b45, 0x7a2430, 0x2f4f7a][i % 3], { roughness: 0.5 });
    const roof = mat(0x4a4d52, { roughness: 0.6 });
    const under = mat(0x1d1f22, { roughness: 0.6 });
    if (!this.winTex) {
      this.winTex = coachTexture();
      this.winGlow = coachGlow();
    }
    const win = new THREE.MeshStandardMaterial({ map: this.winTex, emissiveMap: this.winGlow, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.5 });
    this.winMats.push(win);
    box(2.6, 0.45, 12.4, under, 0, 1.0, 0, g);
    box(2.9, 1.1, 12.6, green, 0, 1.75, 0, g);
    for (const sx of [-1.46, 1.46]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(12.6, 1.2), win);
      p.position.set(sx, 2.85, 0);
      p.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(p);
    }
    box(2.9, 1.25, 12.6, mat(0xefe6cc), 0, 2.85, 0, g).scale.set(0.98, 1, 1);
    box(2.9, 0.25, 12.6, green, 0, 3.55, 0, g);
    const r = cyl(1.55, 1.55, 12.8, roof, 16, g);
    r.rotation.x = Math.PI / 2;
    r.scale.set(1, 0.32, 1);
    r.position.set(0, 3.7, 0);
    // doors at both ends
    for (const zz of [-5.9, 5.9]) for (const sx of [-1.47, 1.47]) box(0.04, 2.2, 0.9, green, sx, 2.2, zz, g);
    const wheels = [];
    for (const z of [-4.9, -3.7, 3.7, 4.9]) for (const x of [-1.3, 1.3]) wheels.push({ x, z, r: 0.45 });
    mergeByMaterial(g);
    return { group: g, len: 12.8, wheels };
  }
  buildTrain() {
    this.winMats = [];
    this.cars = [this.buildLoco(), this.buildTender(), this.buildCoach(0), this.buildCoach(1), this.buildCoach(2), this.buildCoach(3)];
    this.trainLen = this.cars.reduce((a, c) => a + c.len, 0) + GAP * (this.cars.length - 1);
    let off = 0;
    for (const c of this.cars) {
      c.off = off + c.len / 2; // centre distance behind the head
      off += c.len + GAP;
      this.group.add(c.group);
      c.group.visible = false;
    }
    // all wheels in two instanced meshes (with spokes, so the spin shows)
    const wm = mat(0x8a2018, { metalness: 0.4, roughness: 0.5 });
    const spokeM = mat(0xd9a83a, { metalness: 0.7 });
    const all = this.cars.flatMap((c) => c.wheels.map((w) => ({ c, w })));
    const big = all.filter((o) => o.w.big), small = all.filter((o) => !o.w.big);
    this.wheelSets = [];
    for (const [list, r] of [[big, 0.78], [small, 0.45]]) {
      const geo = new THREE.CylinderGeometry(1, 1, 0.16, 18).rotateZ(Math.PI / 2);
      const im = new THREE.InstancedMesh(geo, wm, list.length);
      const sp = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 1.7, 0.16), spokeM, list.length * 2);
      im.frustumCulled = sp.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      sp.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = true;
      this.group.add(im, sp);
      this.wheelSets.push({ list, im, sp, r });
    }
    // driving rods on the loco
    const rodM = mat(0xc9ccd0, { metalness: 0.9, roughness: 0.3 });
    this.rods = [-1, 1].map((sd) => {
      const rod = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 4.2), rodM);
      rod.frustumCulled = false;
      this.group.add(rod);
      return { rod, sd };
    });
  }
  /* ---------------- helpers ---------------- */
  /** z of a vehicle centre */
  carZ(c) {
    return this.s - this.dir * c.off;
  }
  tailS() {
    return this.s - this.dir * this.trainLen;
  }
  /** is the barrier closed (or closing) now */
  stopPoints() {
    return this.closed ? this.stops : [];
  }
  mapIcons() {
    const out = [{ x: this.R.x + 10, z: this.station.z, col: '#1d4d7a', txt: '🚉' }];
    if (this.state !== 'tunnel') out.push({ x: this.R.x, z: this.s - this.dir * this.trainLen * 0.3, col: '#5d4037', txt: '🚂' });
    return out;
  }
  /* ---------------- update ---------------- */
  update(dt) {
    const g = this.g, R = this.R;
    if (!dt) return;
    this.hornCd -= dt;
    this.hitCd -= dt;
    const zombie = g.zombie && g.zombie.active;
    if (this.state === 'tunnel') {
      this.wait -= dt;
      if (this.wait <= 0 && !zombie) {
        this.state = 'run';
        this.dir = -this.dir;
        this.s = this.dir > 0 ? R.z0 - 30 : R.z1 + 30;
        this.v = VMAX * 0.8;
        this.served = false;
        for (const c of this.cars) c.group.visible = true;
      }
    } else {
      // speed: cruise, brake for the station, wait, then pull away
      const S = this.station;
      const stopHead = S.stopZ + (this.dir * this.trainLen) / 2;
      const toStop = (stopHead - this.s) * this.dir;
      if (this.state === 'station') {
        this.v = 0;
        this.stopT -= dt;
        if (this.stopT < 3 && !this.departHorn) {
          this.departHorn = true;
          this.horn(0.8);
        }
        if (this.stopT <= 0) {
          this.state = 'run';
          this.served = true;
        }
      } else {
        let target = VMAX;
        if (!this.served && toStop > -0.5) target = Math.min(target, Math.sqrt(Math.max(0, 2 * ACC * 0.9 * toStop)));
        this.v = target > this.v ? Math.min(target, this.v + ACC * dt) : Math.max(target, this.v - ACC * 1.6 * dt);
        if (!this.served && toStop < 0.6 && this.v < 0.7) {
          this.state = 'station';
          this.stopT = 12;
          this.departHorn = false;
          this.v = 0;
          this.arrive();
        }
      }
      this.s += this.dir * this.v * dt;
      // whistle before the crossing
      const ahead = (this.cz - this.s) * this.dir;
      if (ahead > 0 && ahead < 260 && this.v > 8 && this.hornCd <= 0) this.horn(1.6);
      // gone into the far tunnel
      const tail = this.tailS();
      if ((this.dir > 0 && tail > R.z1 + 25) || (this.dir < 0 && tail < R.z0 - 25)) {
        this.state = 'tunnel';
        this.wait = 35 + Math.random() * 35;
        for (const c of this.cars) c.group.visible = false;
      }
    }
    this.place(dt);
    this.updateCrossing(dt);
    this.collide(dt);
    this.fx(dt);
    if (this.passengerT > 0) this.passengerT -= dt;
    // platform people: they get on the train as it leaves and new ones turn up later
    if (this.state === 'station' && this.stopT < 4) this.boarded = true;
    if (this.state === 'tunnel' && this.wait < 25) this.boarded = false;
    const near = Math.hypot(g.focus().pos.x - R.x, g.focus().pos.z - this.station.z) < 160;
    for (const W of this.waiting) {
      W.P.root.visible = !this.boarded && near;
      if (W.P.root.visible) poseIdle(W.P, g.time + W.ph);
    }
    // station clock and lamps
    const hr = g.hour || 0;
    this.handH.rotation.x = -((hr % 12) / 12) * Math.PI * 2;
    this.handM.rotation.x = -((hr % 1) * Math.PI * 2);
    const night = g.env ? g.env.night : 0;
    for (const m of this.winMats) m.emissiveIntensity = night * 1.6;
    this.locoLamp.emissiveIntensity = 0.6 + night * 2.5;
    if (this.cabMat) this.cabMat.emissiveIntensity = night * 1.2;
  }
  place(dt) {
    const R = this.R, vis = this.state !== 'tunnel';
    this.wheelA += (this.v * dt) / 0.78;
    for (const c of this.cars) {
      const z = this.carZ(c);
      c.group.position.set(R.x, this.railY, z);
      c.group.rotation.y = this.dir > 0 ? 0 : Math.PI;
      c.z = z;
    }
    this.wheelSets.forEach((W) => {
      let n = 0;
      for (const { c, w } of W.list) {
        const f = this.dir;
        const x = R.x + w.x * f, z = c.z + w.z * f;
        const a = (this.wheelA * 0.78) / w.r;
        _e.set(a * f, 0, 0);
        _s.set(1, w.r, w.r);
        if (!vis) _s.set(0, 0, 0);
        _m.compose(_p.set(x, this.railY + w.r, z), _q.setFromEuler(_e), _s);
        W.im.setMatrixAt(n, _m);
        for (const sp of [0, 1]) {
          _e.set(a * f + sp * Math.PI / 2, 0, 0);
          _s.set(vis ? 1.05 : 0, vis ? w.r : 0, vis ? 1 : 0);
          _m.compose(_p.set(x + (w.x > 0 ? 0.03 : -0.03) * f, this.railY + w.r, z), _q.setFromEuler(_e), _s);
          W.sp.setMatrixAt(n * 2 + sp, _m);
        }
        n++;
      }
      W.im.instanceMatrix.needsUpdate = true;
      W.sp.instanceMatrix.needsUpdate = true;
    });
    // coupling rods follow the crank
    const L = this.cars[0];
    for (const { rod, sd } of this.rods) {
      rod.visible = vis;
      const ang = this.wheelA + (sd > 0 ? 0 : Math.PI / 2);
      rod.position.set(R.x + 1.6 * sd * this.dir, this.railY + 0.78 + Math.sin(ang) * 0.32, L.z + (0.2 + Math.cos(ang) * 0.32) * this.dir);
      rod.rotation.y = this.dir > 0 ? 0 : Math.PI;
    }
  }
  updateCrossing(dt) {
    const g = this.g, f = g.focus();
    // closed while the train is within reach of the road (or about to leave the station towards it)
    let closed = false;
    if (this.state !== 'tunnel') {
      const head = (this.s - this.cz) * this.dir; // > 0: head already past the road
      const tail = (this.tailS() - this.cz) * this.dir;
      // a train that will stop at the station before reaching the road keeps the gate open until it leaves
      const stopHead = this.station.stopZ + (this.dir * this.trainLen) / 2;
      const stopsShort = !this.served && (this.cz - stopHead) * this.dir > 0;
      const look = this.state === 'station' ? (this.stopT < 8 ? 70 : 0) : stopsShort ? 0 : 230;
      if (tail < 9 && head > -look) closed = true;
    }
    if (closed && !this.closed) {
      this.closeT = 0;
      if (f && Math.hypot(f.pos.x - this.R.x, f.pos.z - this.cz) < 160) g.ui.toast('🚦 گیت راه‌آهن داره بسته میشه! قطار در راهه 🚂', 'warn');
    }
    this.closed = closed;
    this.closeT = (this.closeT || 0) + dt;
    // lamps flash at once, arms come down after a short warning
    const down = closed && this.closeT > 2.5;
    this.armK = damp(this.armK, down ? 1 : 0, down ? 1.2 : 2.2, dt);
    this.flashT += dt;
    const on = Math.floor(this.flashT * 2.2) % 2;
    this.lampMats.forEach((m, i) => (m.emissiveIntensity = closed ? ((i % 3 === 2 ? 1 : (i % 3 === 0) === !!on) ? 3.2 : 0.1) : 0));
    for (const A of this.arms) {
      A.kick = Math.max(0, A.kick - dt * 1.5);
      const k = clamp(this.armK - A.kick, 0, 1);
      A.pivot.rotation.z = (1 - k) * (Math.PI / 2) * 0.98;
    }
    // the bell rings while closed, if you're near enough to hear it
    if (closed && f) {
      const d = Math.hypot(f.pos.x - this.R.x, f.pos.z - this.cz);
      this.bellT -= dt;
      if (d < 200 && this.bellT <= 0) {
        this.bellT = 0.55;
        const v = clamp(1 - d / 200, 0, 1) * 0.12;
        g.audio.tone(1480, 0.25, v, 'triangle');
        g.audio.tone(2220, 0.12, v * 0.5, 'sine');
      }
    }
  }
  /** a long steam whistle */
  horn(len) {
    const g = this.g, f = g.focus();
    this.hornCd = 9;
    const d = Math.hypot(f.pos.x - this.R.x, f.pos.z - this.s);
    const v = clamp(1 - d / 700, 0, 1) * 0.16;
    if (v <= 0.005) return;
    for (const [fq, gain] of [[370, 1], [466, 0.8], [554, 0.6]]) {
      g.audio.tone(fq, len, v * gain, 'sawtooth');
      g.audio.tone(fq, len * 0.4, v * gain * 0.8, 'sawtooth', len + 0.25);
    }
  }
  arrive() {
    const g = this.g, f = g.focus();
    const d = Math.hypot(f.pos.x - this.R.x, f.pos.z - this.station.z);
    if (d < 90) g.ui.toast('🚉 قطار به ایستگاه رسید!', 'info');
    // someone gets off with a suitcase and wants a taxi, if you're around
    if (d < 400 && g.rides.state === 'idle' && !(g.zombie && g.zombie.active)) {
      this.passengerT = 40;
      g.rides.cooldown = Math.min(g.rides.cooldown, 2.5);
    }
  }
  /** a roadside pickup at the station for a passenger off the train (used once) */
  trainPickup() {
    if (!(this.passengerT > 0)) return null;
    this.passengerT = 0;
    const w = this.g.world, R = this.R;
    const ne = w.nearestEdge(R.x + 22 * this.road.dx, this.cz + 22 * this.road.dz);
    if (!ne) return null;
    let best = null;
    for (const side of [1, -1]) {
      const rs = w.roadside(ne, side, 9);
      const d = Math.hypot(rs.x - (R.x + 18), rs.z - this.station.z);
      if (!best || d < best.d) best = { rs, d };
    }
    const rs = best.rs;
    return { x: rs.x, z: rs.z, roadX: ne.x, roadZ: ne.z, nx: rs.nx, nz: rs.nz, edge: ne.edge, region: 'farm', train: true };
  }
  collide(dt) {
    const g = this.g, p = g.player, R = this.R;
    if (this.state === 'tunnel') return;
    const zA = Math.min(this.s, this.tailS()) - 1, zB = Math.max(this.s, this.tailS()) + 1;
    // traffic cars caught on the rails get flung aside
    for (const c of g.traffic.cars) {
      if (!c.active || c.isFugitive || c.isRival || c.isKeeper) continue;
      const cp = c.pos;
      if (Math.abs(cp.x - R.x) < 2.6 && cp.z > zA && cp.z < zB && c.state !== 'hit') {
        const sd = cp.x >= R.x ? 1 : -1;
        c.hit(sd * 16, this.dir * this.v * 0.5, 20, this);
        c.state = 'hit';
        c.hitTimer = 3;
        c.spin = (Math.random() - 0.5) * 6;
        if (Math.hypot(cp.x - p.pos.x, cp.z - p.pos.z) < 80) g.audio.crash(10);
      }
    }
    if (g.onfoot.active) {
      const f = g.onfoot;
      if (f.pos && Math.abs(f.pos.x - R.x) < 2.2 && f.pos.z > zA && f.pos.z < zB && this.v > 1) {
        // a walker is shoved off the line, never hurt badly
        f.pos.x = R.x + (f.pos.x >= R.x ? 3 : -3);
        g.ui.toast('😱 مواظب قطار باش!', 'bad');
      }
      return;
    }
    const dx = p.pos.x - R.x;
    if (Math.abs(dx) > 3) this.lastSide = Math.sign(dx);
    const onTrack = Math.abs(dx) < 2.6 && p.pos.z > zA && p.pos.z < zB;
    if (onTrack) {
      const sd = dx >= 0 ? 1 : -1;
      if (this.v > 1.5 && this.hitCd <= 0) {
        this.hitCd = 3;
        p.health = Math.max(0, p.health - 28);
        p.ext.set(sd * 15, this.dir * this.v * 0.7);
        p.speed *= 0.2;
        p.air = true;
        p.vy = 6.5;
        p.airT = 0;
        p.airMax = 0;
        p.geyserLaunch = true;
        if (p.bump) p.bump(-2, 0.8, sd * 1.5);
        g.crashFx({ impact: 26 });
        g.stats.trainHits = (g.stats.trainHits || 0) + 1;
        g.ui.toast('🚂💥 قطار بهت زد! هیچوقت روی ریل نمون!', 'bad');
        this.horn(1.2);
      } else if (this.v <= 1.5) {
        // a standing train is a wall
        p.pos.x = R.x + sd * 2.65;
        p.speed *= 0.5;
      }
    }
    // beating the train across: on the crossing when the train is close
    const onX = Math.abs(dx) < 2.6 && Math.abs(p.pos.z - this.cz) < 7;
    const head = (this.cz - this.s) * this.dir;
    if (onX && this.state === 'run' && head > 6 && head < 90 && this.v > 5 && !this.dodge) this.dodge = { side: this.lastSide || Math.sign(dx) || 1, head, t: 0 };
    if (this.dodge) {
      this.dodge.t += dt;
      if (Math.abs(dx) > 3.4 && Math.sign(dx) !== this.dodge.side) {
        // made it to the other side before the train
        const tight = clamp(1 - this.dodge.head / 90, 0, 1);
        const coins = Math.round(5 + tight * 15);
        g.coins += coins;
        g.addXp(30 + Math.round(tight * 50));
        g.stats.trainDodges = (g.stats.trainDodges || 0) + 1;
        g.ui.toast(`😮‍💨 از جلوی قطار رد شدی! +${fa(coins)} سکه`, 'good');
        if (g.replay && g.replay.offer) g.replay.offer();
        this.dodge = null;
      } else if (this.dodge.t > 6 || this.hitCd > 0) this.dodge = null;
    }
  }
  fx(dt) {
    const g = this.g, R = this.R;
    if (this.state === 'tunnel') return;
    const L = this.cars[0];
    const f = g.focus();
    const d = Math.hypot(f.pos.x - R.x, f.pos.z - L.z);
    if (d > 420) return;
    // smoke puffs from the chimney, faster with speed
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = this.v > 1 ? clamp(1.6 / this.v, 0.06, 0.3) : 0.45;
      const cz = L.z + 5.1 * this.dir;
      g.fx.smoke.emit(R.x + (Math.random() - 0.5) * 0.3, this.railY + 4.9, cz, (Math.random() - 0.5) * 0.6, 3.2 + Math.random(), -this.dir * this.v * 0.25, 3.5, 1.4, 3.2, 0.55, 0.6);
    }
    // a steam hiss at the wheels when pulling away
    if (this.v > 0.3 && this.v < 6 && Math.random() < dt * 6) g.fx.tyre.emit(R.x + (Math.random() < 0.5 ? -1.5 : 1.5), this.railY + 0.3, L.z + 3 * this.dir, (Math.random() - 0.5) * 2, 0.5, 0, 1.2, 0.7, 2.5, 0.5, 0.8);
    // chuff-chuff
    if (this.v > 0.3 && d < 260) {
      this.chuffT -= dt;
      if (this.chuffT <= 0) {
        this.chuffT = clamp(1.8 / Math.max(this.v, 1), 0.09, 0.6);
        const v = clamp(1 - d / 260, 0, 1);
        g.audio.burst(0.12, 520, 'lowpass', 0.22 * v);
      }
    }
    // rumble of the wheels
    if (this.v > 6 && d < 140 && Math.random() < dt * 3) g.audio.burst(0.3, 160, 'lowpass', 0.25 * (1 - d / 140));
  }
}
