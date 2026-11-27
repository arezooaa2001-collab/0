import * as THREE from 'three';
import { clamp, damp, canvasTexture, mergeByMaterial, boxCol, circleCol } from './util.js';
import { box, cyl } from './models.js';

const _m = new THREE.Matrix4();
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...o });
const TAXI_V = 9; // taxiing speed m/s
const LIFT_V = 55; // rotate at this speed
const ACC = 3.6; // takeoff acceleration (a fast car with a running start can win)
const BRAKE = 6; // landing deceleration

function runwayTexture(len) {
  const PX = 4; // px per metre
  return canvasTexture(30 * PX * 2, len * PX / 2, (g, w, h) => {
    const k = w / 30;
    g.fillStyle = '#3a3c41';
    g.fillRect(0, 0, w, h);
    // speckle
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.fillStyle = '#f2f2f2';
    // edge lines
    g.fillRect(k * 0.6, 0, k * 0.4, h);
    g.fillRect(w - k * 1.0, 0, k * 0.4, h);
    const L = h / len;
    // centreline dashes
    for (let z = 70; z < len - 90; z += 50) g.fillRect(w / 2 - k * 0.3, z * L, k * 0.6, 30 * L);
    // threshold "piano keys" and numbers at both ends
    for (const end of [0, 1]) {
      const z0 = end ? len - 14 : 4;
      for (let i = 0; i < 8; i++) {
        const x = k * 2.2 + i * k * 3.3;
        if (Math.abs(x - w / 2) < k * 1.2) continue;
        g.fillRect(x, z0 * L, k * 1.8, 10 * L);
      }
      g.save();
      g.translate(w / 2, (end ? len - 34 : 34) * L);
      if (!end) g.rotate(Math.PI);
      g.font = `bold ${Math.round(16 * L)}px sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.scale(1, 1);
      g.fillText(end ? '36' : '18', 0, 0);
      g.restore();
      // touchdown zone bars
      for (const dz of [60, 90]) {
        const zz = end ? len - dz : dz;
        g.fillRect(k * 5, zz * L, k * 1.5, 12 * L);
        g.fillRect(w - k * 6.5, zz * L, k * 1.5, 12 * L);
      }
    }
  }, { aniso: 8 });
}
function signTex(text, sub, bg = '#0d47a1') {
  return canvasTexture(512, 160, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 66px Vazirmatn, Tahoma, sans-serif';
    g.fillText(text, w / 2, h / 2 - (sub ? 18 : 0));
    if (sub) {
      g.font = '32px Vazirmatn, Tahoma, sans-serif';
      g.fillText(sub, w / 2, h / 2 + 44);
    }
  });
}
function windowsTex() {
  return canvasTexture(1024, 64, (g, w, h) => {
    g.fillStyle = '#f4f6f8';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffc61a';
    g.fillRect(0, 44, w, 10);
    for (let i = 0; i < 38; i++) {
      const x = 40 + i * 25;
      if (i === 3 || i === 30) {
        g.fillStyle = '#c9ced4';
        g.fillRect(x - 4, 6, 18, 36);
        continue;
      }
      g.fillStyle = '#1d2733';
      g.beginPath();
      g.ellipse(x + 5, 22, 5, 8, 0, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** an airliner: +z is the nose, the origin sits on the ground under the main gear */
function buildPlane() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const white = mat(0xf4f6f8, { roughness: 0.35, metalness: 0.15 });
  const grey = mat(0xb0b8c0, { roughness: 0.4, metalness: 0.4 });
  const dark = mat(0x22262c, { roughness: 0.4 });
  const yellow = mat(0xffc61a, { roughness: 0.4 });
  // fuselage, nose and tail cone
  const fus = cyl(2, 2, 32, white, 24, body);
  fus.rotation.x = Math.PI / 2;
  fus.position.set(0, 3, -1);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(2, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), white);
  nose.rotation.x = Math.PI / 2;
  nose.scale.set(1, 1.6, 1);
  nose.position.set(0, 3, 15);
  body.add(nose);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 2, 8, 24, 1), white);
  cone.rotation.x = -Math.PI / 2 + 0.08;
  cone.position.set(0, 3.35, -21);
  body.add(cone);
  // cockpit windows
  const cw = box(2.6, 0.55, 1.2, dark, 0, 3.95, 16.4, body);
  cw.rotation.x = 0.35;
  // the window rows and the cheat line, both sides
  const wt = new THREE.MeshStandardMaterial({ map: windowsTex(), roughness: 0.4 });
  for (const s of [-1, 1]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(27, 1.7), wt);
    pl.position.set(s * 2.01, 3.25, -0.5);
    pl.rotation.y = s * Math.PI / 2;
    body.add(pl);
  }
  // a planform extruded into a wing (x = span, z = chord)
  const planform = (pts, t) => {
    const sh = new THREE.Shape();
    sh.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) sh.lineTo(p[0], p[1]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false });
    g.rotateX(Math.PI / 2); // shape y -> -z... lie flat
    return g;
  };
  for (const s of [-1, 1]) {
    const wg = planform([[1.6, 3.5], [17, -5.5], [17, -8], [1.6, -4]], 0.45);
    const wm = new THREE.Mesh(wg, white);
    wm.scale.x = s;
    wm.position.set(0, 2.1, 0);
    body.add(wm);
    // winglet
    const wl = box(0.25, 2.2, 1.6, yellow, s * 17, 3.1, 6.6, body);
    wl.rotation.z = -s * 0.25;
    // engine on a pylon
    const eng = cyl(1.25, 1.1, 4.6, grey, 18, body);
    eng.rotation.x = Math.PI / 2;
    eng.position.set(s * 6.4, 1.3, 2.6);
    const intake = cyl(1.05, 1.05, 0.1, dark, 18, body);
    intake.rotation.x = Math.PI / 2;
    intake.position.set(s * 6.4, 1.3, 4.92);
    box(0.4, 0.9, 2.4, grey, s * 6.4, 2.05, 1.8, body);
    // horizontal stabiliser
    const hs = new THREE.Mesh(planform([[0.5, -17.5], [6.6, -21.5], [6.6, -23], [0.5, -21.5]], 0.3), white);
    hs.scale.x = s;
    hs.position.set(0, 4.0, 0);
    body.add(hs);
  }
  // fin with the yellow livery
  const finShape = new THREE.Shape();
  finShape.moveTo(-15, 0);
  finShape.lineTo(-22.5, 7.8);
  finShape.lineTo(-25, 7.8);
  finShape.lineTo(-23.5, 0);
  const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.4, bevelEnabled: false }), yellow);
  fin.rotation.y = -Math.PI / 2;
  fin.position.set(0.2, 4.6, 0);
  body.add(fin);
  // a checker band on the fin (it's the taxi city's own airline)
  const chk = canvasTexture(128, 32, (g, w, h) => {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#111' : '#fff';
      g.fillRect(i * 16, j * 16, 16, 16);
    }
  });
  for (const s of [-1, 1]) {
    const band = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.9), new THREE.MeshStandardMaterial({ map: chk }));
    band.position.set(s * 0.43, 9.2, -21.5);
    band.rotation.y = s * Math.PI / 2;
    band.rotation.z = s * 0.0;
    body.add(band);
  }
  mergeByMaterial(body);
  // landing gear (retracts after take-off)
  const gear = new THREE.Group();
  const tyre = mat(0x1a1a1a, { roughness: 0.9 });
  const strut = mat(0x9aa3ab, { metalness: 0.6 });
  const leg = (x, z, n) => {
    box(0.22, 1.2, 0.22, strut, x, 1.0, z, gear);
    for (let i = 0; i < n; i++) {
      const w = cyl(0.55, 0.55, 0.4, tyre, 14, gear);
      w.rotation.z = Math.PI / 2;
      w.position.set(x + (n > 1 ? (i ? 0.35 : -0.35) : 0), 0.55, z);
    }
  };
  leg(0, 13, 1);
  leg(-2.6, -1, 2);
  leg(2.6, -1, 2);
  root.add(gear);
  // navigation lights and strobes
  const lights = {
    red: new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 })),
    green: new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0x20ff40 })),
    strobe: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
  };
  lights.red.position.set(-17.1, 2.4, -6.6);
  lights.green.position.set(17.1, 2.4, -6.6);
  root.add(lights.red, lights.green);
  for (const p of [[-17.1, 2.4, -7.4], [17.1, 2.4, -7.4], [0, 5.2, -1]]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), lights.strobe);
    s.position.set(p[0], p[1], p[2]);
    root.add(s);
  }
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { root, gear, lights, body };
}

/** The desert airport: runway, taxiway, terminal, tower and hangar, with an airliner that lands,
 *  taxis to the gate, waits, then takes off again. Passengers come off the planes; you can race
 *  a departing plane down the runway, or stand under one coming in to land. */
export class Airport {
  constructor(game) {
    this.g = game;
    const w = game.world;
    this.A = w.airport;
    this.gy = w.heightAt(this.A.x, (this.A.z0 + this.A.z1) / 2);
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.buildField();
    this.buildBuildings();
    this.plane = buildPlane();
    this.plane.root.visible = false;
    this.group.add(this.plane.root);
    this.state = 'away';
    this.wait = 25;
    this.pos = new THREE.Vector3();
    this.h = Math.PI;
    this.v = 0;
    this.alt = 0;
    this.pitch = 0;
    this.roll = 0;
    this.gearK = 1;
    this.hitCd = 0;
    this.overCd = 0;
    this.roarT = 0;
    this.flashT = 0;
  }
  /* ---------------- building ---------------- */
  buildField() {
    const g = this.g, w = g.world, A = this.A, y = this.gy;
    const len = A.z1 - A.z0;
    const rw = new THREE.Mesh(new THREE.PlaneGeometry(A.hw * 2, len), new THREE.MeshStandardMaterial({ map: runwayTexture(len), roughness: 0.9 }));
    rw.rotation.x = -Math.PI / 2;
    rw.position.set(A.x, y + 0.06, (A.z0 + A.z1) / 2);
    rw.receiveShadow = true;
    this.group.add(rw);
    // shoulders and blast pads
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(A.hw * 2 + 10, len + 60), mat(0x8c7f6a, { roughness: 1 }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(A.x, y + 0.03, (A.z0 + A.z1) / 2);
    sh.receiveShadow = true;
    this.group.add(sh);
    // taxiway, stubs and apron
    const tw = mat(0x4a4d53, { roughness: 0.9 });
    const conc = mat(0xa9a59c, { roughness: 0.95 });
    const flat = (wd, d, m, x, z, yy = 0.05) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(wd, d), m);
      p.rotation.x = -Math.PI / 2;
      p.position.set(x, y + yy, z);
      p.receiveShadow = true;
      this.group.add(p);
      return p;
    };
    flat(16, len - 60, tw, A.tx, (A.z0 + A.z1) / 2);
    for (const z of [A.z0 + 40, (A.az0 + A.az1) / 2 - 30, A.z1 - 40]) flat(A.tx - A.x, 16, tw, (A.x + A.tx) / 2 + 4, z, 0.055);
    flat(A.ax1 - A.ax0, A.az1 - A.az0, conc, (A.ax0 + A.ax1) / 2, (A.az0 + A.az1) / 2, 0.045);
    // yellow taxi lines
    const yl = new THREE.MeshBasicMaterial({ color: 0xf4c20d });
    flat(0.35, len - 60, yl, A.tx, (A.z0 + A.z1) / 2, 0.07);
    // runway edge lights (glow at night), green at the thresholds
    const n = Math.floor(len / 30) + 1;
    this.edgeMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xfff2c0, emissiveIntensity: 0.2 });
    const lg = new THREE.SphereGeometry(0.28, 8, 6);
    const edge = new THREE.InstancedMesh(lg, this.edgeMat, n * 2);
    let k = 0;
    for (let i = 0; i < n; i++) for (const s of [-1, 1]) edge.setMatrixAt(k++, _m.makeTranslation(A.x + s * (A.hw + 0.8), y + 0.35, A.z0 + i * 30));
    this.group.add(edge);
    this.greenMat = new THREE.MeshStandardMaterial({ color: 0x88ff99, emissive: 0x20ff50, emissiveIntensity: 0.3 });
    const thr = new THREE.InstancedMesh(lg, this.greenMat, 24);
    k = 0;
    for (const z of [A.z0 - 1, A.z1 + 1]) for (let i = 0; i < 12; i++) thr.setMatrixAt(k++, _m.makeTranslation(A.x - A.hw + 1 + i * ((A.hw * 2 - 2) / 11), y + 0.35, z));
    this.group.add(thr);
    // approach strobes south of the runway (the planes come in from the south)
    this.strobeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    this.strobes = [];
    for (let i = 1; i <= 8; i++) {
      const s = new THREE.Mesh(lg, this.strobeMat.clone());
      s.position.set(A.x, w.heightAt(A.x, A.z1 + i * 14) + 1.2, A.z1 + i * 14);
      s.scale.setScalar(1.6);
      this.group.add(s);
      this.strobes.push(s);
      box(0.12, 1.2, 0.12, mat(0x666666), A.x, s.position.y - 0.6, A.z1 + i * 14, this.group);
    }
    // a windsock that swings with the wind
    const ws = new THREE.Group();
    ws.position.set(A.x - A.hw - 20, w.heightAt(A.x - A.hw - 20, A.z0 + 80), A.z0 + 80);
    box(0.15, 6, 0.15, mat(0xdddddd), 0, 3, 0, ws);
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, 3, 10, 1, true).rotateZ(Math.PI / 2).translate(1.5, 0, 0), new THREE.MeshStandardMaterial({ color: 0xff6d00, side: THREE.DoubleSide }));
    const sockPivot = new THREE.Group();
    sockPivot.position.y = 5.8;
    sockPivot.add(sock);
    ws.add(sockPivot);
    this.sock = sockPivot;
    this.group.add(ws);
    w.nightMats.push({ mat: this.edgeMat, min: 0.2, max: 3 }, { mat: this.greenMat, min: 0.3, max: 3 });
  }
  buildBuildings() {
    const g = this.g, w = g.world, A = this.A, y = this.gy;
    const glass = new THREE.MeshStandardMaterial({ color: 0x5f8fb5, roughness: 0.15, metalness: 0.6, emissive: 0xffd9a0, emissiveIntensity: 0 });
    const wall = mat(0xe8e2d6, { roughness: 0.8 });
    const roof = mat(0x8a939c, { metalness: 0.4, roughness: 0.5 });
    const grp = new THREE.Group();
    // terminal: a long glass hall with a wavy roof, facing the apron (west)
    const tz = (A.az0 + A.az1) / 2 - 30, tx = 774;
    box(26, 10, 100, wall, tx, y + 5, tz, grp);
    const gf = box(0.3, 7.5, 96, glass, tx - 13.1, y + 4.6, tz, grp);
    gf.userData.glass = true;
    for (let i = -5; i <= 5; i++) {
      const r = box(30, 0.8, 9.2, roof, tx - 1, y + 10.6 + Math.sin(i * 0.9) * 0.6, tz + i * 9, grp);
      r.rotation.z = 0.06;
    }
    // jet bridge out to the gate
    const jb = box(14, 3, 3.2, mat(0xcfd3d8, { metalness: 0.3 }), tx - 20, y + 4.2, (A.az0 + A.az1) / 2 - 30, grp);
    jb.rotation.y = 0;
    box(0.6, 4.2, 0.6, mat(0x777777), tx - 25, y + 2.1, (A.az0 + A.az1) / 2 - 30, grp);
    // name on the land side and the air side
    const nameT = signTex('فرودگاه کویر', 'Desert Airport', '#0d47a1');
    for (const [x, ry] of [[tx + 13.2, Math.PI / 2], [tx - 13.3, -Math.PI / 2]]) {
      const n = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), new THREE.MeshStandardMaterial({ map: nameT, emissive: 0xffffff, emissiveMap: nameT, emissiveIntensity: 0.15 }));
      n.position.set(x, y + 12.2, tz);
      n.rotation.y = ry;
      grp.add(n);
      w.nightMats.push({ mat: n.material, min: 0.15, max: 0.9 });
    }
    // control tower
    const T = { x: 790, z: A.az0 - 14 };
    const tower = cyl(1.8, 2.6, 30, wall, 16, grp);
    tower.position.set(T.x, y + 15, T.z);
    const cab = cyl(4.4, 3.6, 4, glass, 12, grp);
    cab.position.set(T.x, y + 32, T.z);
    const cap = cyl(5, 4.6, 0.8, roof, 12, grp);
    cap.position.set(T.x, y + 34.4, T.z);
    this.beaconPos = new THREE.Vector3(T.x, y + 35.4, T.z);
    // hangar: an arched roof over a big door facing the taxiway
    const hz = A.az1 - 20;
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 36, 24, 1, false, 0, Math.PI), roof);
    arch.rotation.z = Math.PI / 2;
    arch.rotation.y = Math.PI / 2;
    arch.position.set(752, y, hz);
    arch.scale.set(1, 1, 0.75);
    grp.add(arch);
    box(0.4, 11, 30, mat(0x56606a), 734.2, y + 5.5, hz, grp);
    const hs = new THREE.Mesh(new THREE.PlaneGeometry(14, 3), new THREE.MeshStandardMaterial({ map: signTex('آشیانه ۱', '', '#37474f') }));
    hs.position.set(733.9, y + 9, hz);
    hs.rotation.y = -Math.PI / 2;
    grp.add(hs);
    mergeByMaterial(grp);
    this.group.add(grp);
    w.nightMats.push({ mat: glass, max: 0.9 });
    // the rotating beacon on the tower
    this.beacon = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x9fffb0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.beacon.scale.setScalar(5);
    this.beacon.position.copy(this.beaconPos);
    this.group.add(this.beacon);
    // collisions for the buildings
    w.statics.insert(boxCol(tx, tz, 13, 50));
    w.statics.insert(circleCol(T.x, T.z, 2.8));
    w.statics.insert(boxCol(752, hz, 13, 18));
    // where things happen
    this.gate = { x: tx - 38, z: (A.az0 + A.az1) / 2 - 30 };
    this.curb = { x: tx + 20, z: tz };
  }
  /* ---------------- paths ---------------- */
  /** taxi route from the runway to the gate (after landing) */
  inPath() {
    const A = this.A, G = this.gate;
    return [[A.x + 2, A.z0 + 46], [A.x + 14, A.z0 + 40], [A.tx, A.z0 + 40], [A.tx, G.z - 12], [A.tx + 6, G.z], [G.x, G.z]];
  }
  /** from the gate back out to the south end of the runway */
  outPath() {
    const A = this.A, G = this.gate;
    return [[A.tx + 4, G.z], [A.tx, G.z + 12], [A.tx, A.z1 - 40], [A.x + 14, A.z1 - 40], [A.x + 1, A.z1 - 30], [A.x, A.z1 - 40]];
  }
  follow(path, dt, speed) {
    const P = this.path;
    if (!P || P.i >= P.pts.length) return true;
    const [tx, tz] = P.pts[P.i];
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    const step = Math.abs(speed) * dt;
    if (d <= step) {
      this.pos.x = tx;
      this.pos.z = tz;
      P.i++;
      return P.i >= P.pts.length;
    }
    this.pos.x += (dx / d) * step;
    this.pos.z += (dz / d) * step;
    const want = speed < 0 ? Math.atan2(-dx, -dz) : Math.atan2(dx, dz);
    let dh = want - this.h;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.h += clamp(dh, -dt * 0.9, dt * 0.9);
    return false;
  }
  /* ---------------- update ---------------- */
  update(dt) {
    const g = this.g, A = this.A, f = g.focus();
    if (!dt) return;
    this.hitCd -= dt;
    this.overCd -= dt;
    const night = g.env ? g.env.night : 0;
    const zombie = g.zombie && g.zombie.active;
    switch (this.state) {
      case 'away':
        this.plane.root.visible = false;
        this.wait -= dt;
        if (this.wait <= 0 && !zombie) {
          // inbound from the south, lined up with the runway
          this.state = 'approach';
          this.pos.set(A.x, 0, A.z1 + 2600);
          this.alt = 150;
          this.v = 72;
          this.h = Math.PI;
          this.gearK = 1;
          this.plane.root.visible = true;
          this.spoke = false;
          this.over = false;
        }
        break;
      case 'approach': {
        // a 3° glide down to the threshold, then a flare
        this.pos.z -= this.v * dt;
        const td = A.z1 - 70; // touchdown point
        const dist = this.pos.z - td;
        // the last stretch flattens out into the flare
        this.alt = dist >= 140 ? dist * 0.055 : 7.7 * Math.pow(Math.max(0, dist) / 140, 1.5);
        this.v = damp(this.v, 64, 0.3, dt);
        this.pitch = dist < 160 ? -0.08 - (1 - dist / 160) * 0.06 : -0.03;
        if (dist <= 0) {
          this.state = 'rollout';
          this.alt = 0;
          this.touchFx();
        }
        break;
      }
      case 'rollout':
        this.v = Math.max(TAXI_V, this.v - BRAKE * dt);
        this.pos.z -= this.v * dt;
        this.pitch = damp(this.pitch, 0, 2, dt);
        if (this.pos.z <= A.z0 + 46 && this.v <= TAXI_V + 0.1) {
          this.state = 'taxiIn';
          this.path = { pts: this.inPath(), i: 0 };
        }
        break;
      case 'taxiIn':
        this.v = TAXI_V;
        if (this.follow(this.path, dt, this.path.i >= this.path.pts.length - 1 ? 4 : TAXI_V)) {
          this.state = 'gate';
          this.wait = 40;
          this.v = 0;
          this.arrive();
        }
        break;
      case 'gate':
        this.v = 0;
        this.wait -= dt;
        // swing round to face the terminal
        this.h = damp(this.h, Math.PI / 2, 1.5, dt);
        if (this.wait <= 0 && !zombie) {
          this.state = 'pushback';
          this.path = { pts: [[this.gate.x - 22, this.gate.z]], i: 0 };
        }
        break;
      case 'pushback':
        this.v = -2.5;
        if (this.follow(this.path, dt, -2.5)) {
          this.state = 'taxiOut';
          this.path = { pts: this.outPath(), i: 0 };
        }
        break;
      case 'taxiOut':
        this.v = TAXI_V;
        if (this.follow(this.path, dt, TAXI_V)) {
          this.state = 'lineup';
          this.wait = 4;
          this.v = 0;
        }
        break;
      case 'lineup':
        this.h = damp(this.h, Math.PI, 3, dt);
        this.wait -= dt;
        if (this.wait <= 0) {
          this.state = 'takeoff';
          this.v = 0;
          this.raceCheck();
        }
        break;
      case 'takeoff':
        this.h = Math.PI;
        this.v += ACC * dt;
        this.pos.z -= this.v * dt;
        if (this.v > LIFT_V) {
          this.pitch = damp(this.pitch, -0.2, 2, dt);
          this.alt += (this.v - LIFT_V + 4) * 0.22 * dt * 2.2;
          if (!this.liftSaid) {
            this.liftSaid = true;
            this.raceEnd();
          }
        }
        if (this.alt > 8) this.gearK = Math.max(0, this.gearK - dt * 0.5);
        if (this.alt > 260 || this.pos.z < A.z0 - 2400) {
          this.state = 'away';
          this.wait = 40 + Math.random() * 40;
          this.liftSaid = false;
          this.pitch = 0;
          this.alt = 0;
        }
        break;
    }
    this.place();
    this.collide(dt);
    this.flyOver();
    this.sound(dt, f);
    this.lights(dt, night);
  }
  place() {
    const P = this.plane, w = this.g.world;
    if (!P.root.visible) return;
    const gy = Math.max(this.gy, w.heightAt(this.pos.x, this.pos.z));
    P.root.position.set(this.pos.x, gy + this.alt, this.pos.z);
    P.root.rotation.set(this.pitch, this.h, this.roll, 'YXZ');
    P.gear.scale.set(1, Math.max(0.01, this.gearK), 1);
    P.gear.visible = this.gearK > 0.02;
  }
  touchFx() {
    const g = this.g, f = g.focus();
    // tyre smoke at touchdown
    for (let i = 0; i < 16; i++) for (const s of [-1, 1]) g.fx.tyre.emit(this.pos.x + s * 2.6, this.gy + 0.6, this.pos.z + 1, (Math.random() - 0.5) * 2, 1 + Math.random(), 6 + Math.random() * 6, 2.2, 1.6, 3, 0.7, 0.6);
    if (Math.hypot(f.pos.x - this.pos.x, f.pos.z - this.pos.z) < 300) g.audio.burst(0.6, 700, 'lowpass', 0.4);
  }
  arrive() {
    const g = this.g, f = g.focus();
    const d = Math.hypot(f.pos.x - this.curb.x, f.pos.z - this.curb.z);
    if (d < 160) g.ui.toast('🛬 یه هواپیما نشست! مسافرها دارن پیاده میشن', 'info');
    if (d < 900 && g.rides.state === 'idle' && !(g.zombie && g.zombie.active)) {
      this.passengerT = 45;
      g.rides.cooldown = Math.min(g.rides.cooldown, 3);
    }
  }
  /** a roadside pickup at the terminal for a passenger off the plane (used once) */
  pickup() {
    if (!(this.passengerT > 0)) return null;
    this.passengerT = 0;
    const w = this.g.world;
    const ne = w.nearestEdge(this.curb.x + 20, this.curb.z);
    if (!ne) return null;
    let best = null;
    for (const side of [1, -1]) {
      const rs = w.roadside(ne, side, 9);
      const d = Math.hypot(rs.x - this.curb.x, rs.z - this.curb.z);
      if (!best || d < best.d) best = { rs, d };
    }
    const rs = best.rs;
    return { x: rs.x, z: rs.z, roadX: ne.x, roadZ: ne.z, nx: rs.nx, nz: rs.nz, edge: ne.edge, region: 'desert', plane: true };
  }
  /** a take-off is starting: is the player lined up on the runway to race it? */
  raceCheck() {
    const g = this.g, p = g.player, A = this.A;
    if (g.onfoot.active) return;
    const onRw = Math.abs(p.pos.x - A.x) < A.hw && p.pos.z < this.pos.z + 40 && p.pos.z > this.pos.z - 80;
    if (!onRw) return;
    this.race = true;
    g.ui.toast('🏁 مسابقه با هواپیما! تا وقتی از زمین بلند نشده ازش جلو بمون (کنار باند امن‌تره، جلوی دماغش نه!)', 'warn');
    g.audio.tone(880, 0.2, 0.1, 'square');
  }
  raceEnd() {
    const g = this.g, p = g.player;
    if (!this.race) return;
    this.race = false;
    const nose = this.pos.z - 18;
    if (!g.onfoot.active && p.pos.z < nose && Math.abs(p.pos.x - this.A.x) < this.A.hw + 4 && p.health > 0) {
      g.coins += 40;
      g.addXp(150);
      g.stats.planeRaces = (g.stats.planeRaces || 0) + 1;
      g.ui.toast('🏆 از هواپیما جلو زدی!! +۴۰ سکه', 'good');
      g.audio.cash();
      if (g.replay) g.replay.offer();
    } else g.ui.toast('✈️ هواپیما بُرد! دفعه بعد با نیترو بیا 🔥', 'info');
  }
  /** car and plane: the fuselage, the engines and the gear are solid */
  collide() {
    const g = this.g, p = g.player, P = this.plane;
    if (!P.root.visible || this.alt > 3 || g.onfoot.active) return;
    const fx = Math.sin(this.h), fz = Math.cos(this.h), rx = fz, rz = -fx;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const along = dx * fx + dz * fz, side = dx * rx + dz * rz;
    const inBody = along > -23 && along < 18 && Math.abs(side) < 3.2;
    const inEngine = Math.abs(along - 2.6) < 3 && Math.abs(Math.abs(side) - 6.4) < 2;
    if (!inBody && !inEngine) return;
    const sd = side >= 0 ? 1 : -1;
    if (Math.abs(this.v) > 3 && this.hitCd <= 0) {
      this.hitCd = 3;
      p.health = Math.max(0, p.health - 25);
      p.ext.set(rx * sd * 14 + fx * this.v * 0.5, rz * sd * 14 + fz * this.v * 0.5);
      p.speed *= 0.2;
      p.air = true;
      p.vy = 6;
      p.airT = 0;
      p.airMax = 0;
      p.geyserLaunch = true;
      if (p.bump) p.bump(-2, 0.6, sd * 1.4);
      g.crashFx({ impact: 24 });
      g.stats.planeHits = (g.stats.planeHits || 0) + 1;
      g.ui.toast('✈️💥 هواپیما بهت زد! روی باند جای تاکسی نیست!', 'bad');
    } else if (Math.abs(this.v) <= 3) {
      // a parked plane is a wall: slide out sideways
      const push = (inBody ? 3.3 - Math.abs(side) : 0.4) + 0.1;
      p.pos.x += rx * sd * push;
      p.pos.z += rz * sd * push;
      p.speed *= 0.5;
    }
  }
  /** a plane roaring low right over your head is worth something */
  flyOver() {
    const g = this.g, f = g.focus();
    if (!this.plane.root.visible || this.overCd > 0 || this.alt < 4 || this.alt > 45) return;
    if (Math.hypot(f.pos.x - this.pos.x, f.pos.z - this.pos.z) > 14) return;
    this.overCd = 20;
    g.shake = Math.max(g.shake || 0, 0.6);
    g.audio.burst(1.4, 300, 'lowpass', 0.9);
    g.coins += 10;
    g.stats.flyOvers = (g.stats.flyOvers || 0) + 1;
    g.ui.toast('✈️😱 هواپیما درست از بالای سرت رد شد! +۱۰ سکه', 'good');
  }
  sound(dt, f) {
    const g = this.g;
    if (!this.plane.root.visible) return;
    const d = Math.hypot(f.pos.x - this.pos.x, f.pos.z - this.pos.z, this.alt);
    if (d > 900) return;
    const thrust = this.state === 'takeoff' ? 1 : this.state === 'approach' ? 0.55 : this.state === 'rollout' ? 0.7 : 0.35;
    this.roarT -= dt;
    if (this.roarT <= 0) {
      this.roarT = 0.22;
      const v = clamp(1 - d / 900, 0, 1) ** 1.5 * thrust;
      g.audio.burst(0.32, 380 + thrust * 300, 'lowpass', 0.5 * v);
      if (Math.random() < 0.3) g.audio.tone(1900 + thrust * 500, 0.3, 0.012 * v, 'sine');
    }
  }
  lights(dt, night) {
    this.flashT += dt;
    // approach strobes run towards the runway at night
    const k = Math.floor(this.flashT * 8) % 10;
    this.strobes.forEach((s, i) => (s.material.opacity = night > 0.3 && 7 - i === k ? 1 : 0));
    // plane strobes
    this.plane.lights.strobe.opacity = this.plane.root.visible && this.flashT % 1.2 < 0.08 ? 1 : 0;
    // tower beacon: a slow sweep
    this.beacon.material.opacity = night > 0.3 ? Math.max(0, Math.sin(this.flashT * 2.2)) ** 6 : 0;
    // the windsock points downwind
    const W = this.g.world.vegWind ? this.g.world.vegWind.value : 0.3;
    this.sock.rotation.set(0, 0.6 + Math.sin(this.flashT * 0.3) * 0.3, -1.2 + clamp(W, 0, 1.2) * 1.1);
  }
  mapIcons() {
    const out = [{ x: this.curb.x, z: this.curb.z, col: '#0d47a1', txt: '🛫' }];
    if (this.plane.root.visible) out.push({ x: this.pos.x, z: this.pos.z, col: '#455a64', txt: '✈️' });
    return out;
  }
  /* ---------------- replay ---------------- */
  snapshot() {
    return { x: this.pos.x, z: this.pos.z, h: this.h, alt: this.alt, pitch: this.pitch, vis: this.plane.root.visible, gearK: this.gearK };
  }
  restore(S) {
    if (!S) return;
    this.pos.x = S.x;
    this.pos.z = S.z;
    this.h = S.h;
    this.alt = S.alt;
    this.pitch = S.pitch;
    this.gearK = S.gearK;
    this.plane.root.visible = S.vis;
    this.place();
  }
  /** a recorded frame: x NaN while the plane was away */
  showAt(x, z, h, alt, pitch) {
    const vis = Number.isFinite(x);
    this.plane.root.visible = vis;
    if (!vis) return;
    const keep = { x: this.pos.x, z: this.pos.z, h: this.h, alt: this.alt, pitch: this.pitch };
    Object.assign(this, { h, alt, pitch });
    this.pos.x = x;
    this.pos.z = z;
    this.place();
    this.pos.x = keep.x;
    this.pos.z = keep.z;
    Object.assign(this, { h: keep.h, alt: keep.alt, pitch: keep.pitch });
  }
}
