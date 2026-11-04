import * as THREE from 'three';
import { HALF, regionAt } from './world.js';

const BIRDS = 14;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

/** Life in the sky: airliners with contrails, flocks of birds and hot-air balloons over the desert. */
export class Ambient {
  constructor(game) {
    this.g = game;
    this.buildPlane();
    this.buildBirds();
    this.buildBalloons();
    this.planeT = 20 + Math.random() * 40;
  }
  buildPlane() {
    const g = this.g, grp = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.4, metalness: 0.3 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x1e5aa8, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.3, 30, 12), white);
    body.rotation.x = Math.PI / 2;
    grp.add(body);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), white);
    nose.position.z = 15;
    nose.scale.z = 1.6;
    grp.add(nose);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(34, 0.4, 5), white);
    wing.position.z = 1;
    grp.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(11, 0.3, 3), white);
    tail.position.z = -13.5;
    grp.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 4), blue);
    fin.position.set(0, 3, -13.5);
    grp.add(fin);
    this.lightR = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    this.lightG = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 4), new THREE.MeshBasicMaterial({ color: 0x20ff40 }));
    this.lightR.position.set(-17, 0, 1);
    this.lightG.position.set(17, 0, 1);
    grp.add(this.lightR, this.lightG);
    // contrail: a long soft ribbon that fades out behind
    const cv = document.createElement('canvas');
    cv.width = 4;
    cv.height = 128;
    const c = cv.getContext('2d');
    const grd = c.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, 'rgba(255,255,255,0.8)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grd;
    c.fillRect(0, 0, 4, 128);
    const trailMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    for (const x of [-9, 9]) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 420), trailMat);
      t.rotation.x = -Math.PI / 2;
      t.position.set(x, 0, -225);
      grp.add(t);
    }
    grp.visible = false;
    g.scene.add(grp);
    this.plane = grp;
  }
  buildBirds() {
    // a bird is two thin wings that flap around the body line
    const mat = new THREE.MeshBasicMaterial({ color: 0x1b1b1b, side: THREE.DoubleSide });
    const wing = (sx) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.3, sx * 0.95, 0, -0.1, 0, 0, -0.3]), 3));
      const m = new THREE.InstancedMesh(geo, mat, BIRDS);
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.g.scene.add(m);
      return m;
    };
    this.wingL = wing(-1);
    this.wingR = wing(1);
    this.flock = { x: 0, z: 0, y: 40, a: 0, r: 30, t: 99 };
    this.offs = [];
    for (let i = 0; i < BIRDS; i++) this.offs.push([(Math.random() - 0.5) * 16, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 16, Math.random() * 6]);
  }
  buildBalloons() {
    const g = this.g, w = g.world;
    const cols = [[0xe53935, 0xffd21a], [0x1e88e5, 0xffffff], [0x43a047, 0xff7043]];
    this.balloons = [];
    const basketMat = new THREE.MeshStandardMaterial({ color: 0x6d4c2f, roughness: 0.9 });
    cols.forEach(([a, b], i) => {
      const cv = document.createElement('canvas');
      cv.width = 128;
      cv.height = 64;
      const c = cv.getContext('2d');
      for (let k = 0; k < 8; k++) {
        c.fillStyle = '#' + (k % 2 ? b : a).toString(16).padStart(6, '0');
        c.fillRect(k * 16, 0, 16, 64);
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const grp = new THREE.Group();
      const env = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 14), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
      env.scale.y = 1.25;
      grp.add(env);
      const basket = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 2.2), basketMat);
      basket.position.y = -12.5;
      grp.add(basket);
      const x = 150 + i * 260 - 300, z = 1100 + i * 150;
      grp.position.set(x, w.heightAt(x, z) + 70 + i * 25, z);
      g.scene.add(grp);
      this.balloons.push({ grp, x, z, y: grp.position.y, ph: i * 2 });
    });
  }
  update(dt) {
    const g = this.g, f = g.focus(), t = g.time;
    const night = g.env ? g.env.night : 0;
    // airliner crossing the sky every minute or two
    const P = this.plane;
    if (!P.visible) {
      this.planeT -= dt;
      if (this.planeT <= 0) {
        const a = Math.random() * Math.PI * 2;
        this.pv = { x: Math.sin(a + Math.PI), z: Math.cos(a + Math.PI) };
        P.position.set(f.pos.x + Math.sin(a) * 1600 + (Math.random() - 0.5) * 600, 400 + Math.random() * 80, f.pos.z + Math.cos(a) * 1600);
        P.rotation.set(0, Math.atan2(this.pv.x, this.pv.z), 0);
        P.visible = true;
      }
    } else {
      P.position.x += this.pv.x * 95 * dt;
      P.position.z += this.pv.z * 95 * dt;
      const blink = Math.floor(t * 1.5) % 2 === 0;
      this.lightR.visible = this.lightG.visible = blink || night < 0.3;
      const d = Math.hypot(P.position.x - f.pos.x, P.position.z - f.pos.z);
      if (d > 2400 || Math.abs(P.position.x) > HALF + 2000 || Math.abs(P.position.z) > HALF + 2000) {
        P.visible = false;
        this.planeT = 60 + Math.random() * 80;
      }
    }
    // birds circle above the countryside (not over the city or at night)
    const B = this.flock;
    B.t += dt;
    if (B.t > 40 || Math.hypot(B.x - f.pos.x, B.z - f.pos.z) > 260) {
      B.t = 0;
      const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 90;
      B.x = f.pos.x + Math.cos(a) * d;
      B.z = f.pos.z + Math.sin(a) * d;
      B.y = g.world.heightAt(B.x, B.z) + 25 + Math.random() * 20;
      B.r = 20 + Math.random() * 25;
    }
    const show = regionAt(f.pos.x, f.pos.z) !== 'city' && night < 0.5;
    this.wingL.visible = this.wingR.visible = show;
    if (show) {
      B.a += dt * 0.35;
      _s.set(1, 1, 1);
      for (let i = 0; i < BIRDS; i++) {
        const o = this.offs[i], a = B.a + i * 0.05;
        _p.set(B.x + Math.cos(a) * B.r + o[0], B.y + o[1] + Math.sin(t + o[3]) * 1.5, B.z + Math.sin(a) * B.r + o[2]);
        const yaw = Math.atan2(-Math.sin(a), Math.cos(a)), flap = Math.sin(t * 9 + o[3]) * 0.6;
        _e.set(0, yaw, flap, 'YXZ');
        _m.compose(_p, _q.setFromEuler(_e), _s);
        this.wingL.setMatrixAt(i, _m);
        _e.set(0, yaw, -flap, 'YXZ');
        _m.compose(_p, _q.setFromEuler(_e), _s);
        this.wingR.setMatrixAt(i, _m);
      }
      this.wingL.instanceMatrix.needsUpdate = this.wingR.instanceMatrix.needsUpdate = true;
    }
    // balloons drift and bob gently
    for (const b of this.balloons) {
      b.grp.position.set(b.x + Math.sin(t * 0.05 + b.ph) * 40, b.y + Math.sin(t * 0.3 + b.ph) * 3, b.z + Math.cos(t * 0.04 + b.ph) * 40);
    }
  }
}
