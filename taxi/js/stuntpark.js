import * as THREE from 'three';
import { clamp, fa, canvasTexture, mergeByMaterial, boxCol, circleCol } from './util.js';
import { box, cyl } from './models.js';

const LOOP_R = 7.5; // loop radius
const LOOP_G = 7.5; // softer "loop gravity" so it is doable from the park's run-up (needs v0² ≥ 5·g·R)
const LOOP_SHIFT = 5.5; // corkscrew offset: you come out beside the way in
const LOOP_MIN = 16.5; // m/s needed at the entry (about 60 km/h)
const _v = new THREE.Vector3();

function stripes(a, b, n = 8) {
  return canvasTexture(256, 32, (g, w, h) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? a : b;
      g.fillRect((i * w) / n, 0, w / n + 1, h);
    }
  });
}
function sign(text, sub) {
  return canvasTexture(512, 192, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#ff6a00');
    gr.addColorStop(1, '#b3261e');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffd21a';
    g.lineWidth = 10;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 74px Vazirmatn, Tahoma, sans-serif';
    g.fillText(text, w / 2, h / 2 - 22);
    g.font = '36px Vazirmatn, Tahoma, sans-serif';
    g.fillText(sub, w / 2, h / 2 + 52);
  });
}

/** Two new rides at the stunt park: a corkscrew loop-the-loop ("حلقه مرگ") and a giant cannon
 *  that fires the taxi far into the desert, where it floats down under a parachute. */
export class StuntRides {
  constructor(game) {
    this.g = game;
    const w = game.world, P = w.stuntPark;
    // the loop: you drive in heading +x along the south edge of the park
    this.loop = { x0: P.x - 6, z0: P.z + 64, h: Math.PI / 2 };
    this.loop.y = w.heightAt(this.loop.x0, this.loop.z0);
    // the cannon on the north side, aiming south over the park into the open desert
    this.cannon = { x: P.x + 28, z: P.z - 68, aim: 0, pitch: 0.66 };
    this.cannon.y = w.heightAt(this.cannon.x, this.cannon.z);
    this.buildLoop();
    this.buildCannon();
    this.buildChute();
    this.cool = 0;
    this.padT = 0;
  }
  /* ---------------- building ---------------- */
  loopPoint(th, out = _v) {
    const L = this.loop;
    return out.set(L.x0 + LOOP_R * Math.sin(th), L.y + LOOP_R * (1 - Math.cos(th)), L.z0 + (LOOP_SHIFT * th) / (Math.PI * 2));
  }
  buildLoop() {
    const g = this.g, w = g.world, L = this.loop;
    const N = 96, HW = 2.4;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * Math.PI * 2;
      const c = this.loopPoint(th);
      for (const s of [-1, 1]) {
        pos.push(c.x, c.y + 0.05 * Math.cos(th), c.z + s * HW);
        uv.push(s > 0 ? 1 : 0, i / 6);
      }
      if (i < N) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const tex = stripes('#e53935', '#fafafa', 2);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    tex.rotation = Math.PI / 2;
    const track = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide }));
    track.castShadow = true;
    track.receiveShadow = true;
    const grp = new THREE.Group();
    grp.add(track);
    // guard rails along both edges
    const railMat = new THREE.MeshStandardMaterial({ color: 0xffd21a, metalness: 0.6, roughness: 0.35 });
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const th = (i / N) * Math.PI * 2, c = this.loopPoint(th, new THREE.Vector3());
        // a little inward (towards the centre) from the deck
        c.x += -Math.sin(th) * 0.45;
        c.y += Math.cos(th) * 0.45;
        c.z += s * (HW + 0.05);
        pts.push(c);
      }
      grp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.12, 6), railMat));
    }
    // steel towers holding the top
    const steel = new THREE.MeshStandardMaterial({ color: 0x8a96a3, metalness: 0.7, roughness: 0.4 });
    const top = this.loopPoint(Math.PI, new THREE.Vector3());
    for (const s of [-1, 1]) {
      const z = top.z + s * 5.2;
      for (const dx of [-2.6, 2.6]) {
        const leg = box(0.35, top.y - L.y + 0.4, 0.35, steel, L.x0 + dx, (top.y + L.y) / 2, z, grp);
        leg.rotation.z = -dx * 0.03;
      }
      box(5.6, 0.3, 0.35, steel, L.x0, top.y + 0.35, z, grp);
      w.statics.insert(circleCol(L.x0 - 2.6, z, 0.4));
      w.statics.insert(circleCol(L.x0 + 2.6, z, 0.4));
    }
    box(0.4, 0.4, 10.8, steel, L.x0, top.y + 0.6, top.z, grp);
    // a run-up lane painted on the ground and a sign
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(60, 4.8), new THREE.MeshStandardMaterial({ map: stripes('#ffd21a', '#2b2b2b', 24), roughness: 0.9 }));
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(L.x0 - 31, L.y + 0.04, L.z0);
    lane.receiveShadow = true;
    grp.add(lane);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.25), new THREE.MeshStandardMaterial({ map: sign('🎢 حلقه مرگ', 'حداقل ۶۰ کیلومتر سرعت!'), roughness: 0.6 }));
    board.position.set(L.x0 - 30, L.y + 4.4, L.z0 - 5.2);
    grp.add(board);
    for (const dx of [-2.5, 2.5]) box(0.2, 3.4, 0.2, steel, L.x0 - 30 + dx, L.y + 1.7, L.z0 - 5.3, grp);
    mergeByMaterial(grp);
    g.scene.add(grp);
  }
  buildCannon() {
    const g = this.g, w = g.world, C = this.cannon;
    const grp = new THREE.Group();
    grp.position.set(C.x, C.y, C.z);
    grp.rotation.y = C.aim;
    const wood = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.8 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.7, roughness: 0.35 });
    const red = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.5 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc107, metalness: 0.8, roughness: 0.3 });
    // carriage and big spoked wheels
    box(5.4, 2.2, 9, red, 0, 1.6, -1.2, grp);
    for (const s of [-1, 1]) {
      const wh = cyl(2.3, 2.3, 0.6, wood, 20, grp);
      wh.rotation.z = Math.PI / 2;
      wh.position.set(s * 3.1, 2.3, 0.2);
      const hub = cyl(0.5, 0.5, 0.7, gold, 12, grp);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(s * 3.15, 2.3, 0.2);
    }
    // the barrel, tilted up; the taxi fits inside
    const barrel = new THREE.Group();
    barrel.position.set(0, 2.8, -4.2);
    barrel.rotation.x = -C.pitch;
    const tube = cyl(2.05, 2.35, 15, iron, 28, barrel);
    tube.rotation.x = Math.PI / 2;
    tube.position.z = 6.8;
    tube.material = iron;
    for (const z of [1, 6, 11]) {
      const band = cyl(2.45, 2.45, 0.5, gold, 28, barrel);
      band.rotation.x = Math.PI / 2;
      band.position.z = z;
    }
    const muzzle = cyl(2.6, 2.4, 0.9, gold, 28, barrel);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.z = 14.4;
    const dark = cyl(1.85, 1.85, 0.05, new THREE.MeshBasicMaterial({ color: 0x050505 }), 24, barrel);
    dark.rotation.x = Math.PI / 2;
    dark.position.z = 14.86;
    grp.add(barrel);
    // the loading ramp up to the back of the barrel and a glowing pad in front of it
    const ramp = box(4.6, 0.3, 7, wood, 0, 1.1, -8.6, grp);
    ramp.rotation.x = 0.3;
    this.padMat = new THREE.MeshStandardMaterial({ color: 0x2a1000, emissive: 0xff8f00, emissiveIntensity: 1.2, transparent: true, opacity: 0.85 });
    const pad = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), this.padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.06, -14.5);
    grp.add(pad);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.4), new THREE.MeshStandardMaterial({ map: sign('🚀 توپ پرتاب', 'روی دایره نارنجی وایستا'), roughness: 0.6 }));
    board.position.set(5.5, 4.2, -14);
    board.rotation.y = Math.PI;
    grp.add(board);
    for (const dx of [-2.6, 2.6]) box(0.2, 3.2, 0.2, iron, 5.5 + dx, 1.6, -13.9, grp);
    mergeByMaterial(grp);
    g.scene.add(grp);
    this.cannonGrp = grp;
    // world positions: pad, breech, muzzle
    const toW = (x, y, z) => {
      grp.updateMatrixWorld(true);
      return new THREE.Vector3(x, y, z).applyMatrix4(grp.matrixWorld);
    };
    C.pad = toW(0, 0, -14.5);
    // a point on the barrel's axis, z metres from its back end, dropped so the car sits inside
    const bp = (z) => toW(0, 2.8 + Math.sin(C.pitch) * z - Math.cos(C.pitch) * 0.8, -4.2 + Math.cos(C.pitch) * z + Math.sin(C.pitch) * 0.8);
    C.breech = bp(0.5);
    C.muzzle = bp(15);
    w.statics.insert(boxCol(C.x, C.z - 1.2, 2.9, 4.6, C.aim));
  }
  /** the parachute the taxi floats down on after a cannon shot */
  buildChute() {
    const geo = new THREE.SphereGeometry(4.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const n = geo.attributes.position.count, col = new Float32Array(n * 3), c = new THREE.Color();
    const P = geo.attributes.position;
    const hues = [0xe53935, 0xffffff, 0x1e88e5, 0xffd21a];
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(P.getZ(i), P.getX(i));
      c.set(hues[Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8) % 4]);
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.scale(1, 0.55, 1);
    const chute = new THREE.Group();
    chute.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide })));
    const lineM = new THREE.MeshBasicMaterial({ color: 0x333333 });
    for (const [x, z] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]]) {
      const ln = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 4), lineM);
      // from the canopy rim down to the roof
      const a = new THREE.Vector3(x * 0.75, 0, z * 0.75), b = new THREE.Vector3(x * 0.12, -5.2, z * 0.2);
      ln.position.copy(a).add(b).multiplyScalar(0.5);
      ln.scale.y = a.distanceTo(b);
      ln.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      chute.add(ln);
    }
    chute.visible = false;
    this.chute = chute;
  }
  /* ---------------- rides ---------------- */
  busy() {
    const g = this.g;
    return g.race.state !== 'idle' || g.crazy.state !== 'idle' || g.drag.state !== 'idle' || g.parking.state !== 'idle' || g.soccer.state !== 'idle' || (g.zombie && g.zombie.active);
  }
  /** the car enters the loop: a scripted ride around the circle */
  startLoop(v0) {
    const g = this.g, p = g.player, L = this.loop;
    const ok = v0 >= LOOP_MIN;
    const R = { th: 0, v0, ok };
    g.audio.tone(220, 0.3, 0.08, 'sawtooth');
    p.script = (dt) => {
      const h = LOOP_R * (1 - Math.cos(R.th));
      let v = Math.sqrt(Math.max(0, v0 * v0 - 2 * LOOP_G * h));
      if (ok) v = Math.max(v, 6);
      else {
        // too slow: past the side of the loop the track can't hold the car any more
        const need = R.th > Math.PI / 2 ? LOOP_G * LOOP_R * Math.max(0.15, -Math.cos(R.th)) : 0;
        if (v < 2.5 || v * v < need) {
          this.loopFall(R, Math.max(v, 2));
          return false;
        }
      }
      R.th += (v * dt) / LOOP_R;
      if (R.th >= Math.PI * 2) {
        this.loopDone(v0);
        return false;
      }
      const c = this.loopPoint(R.th);
      p.pos.set(c.x, 0, c.z);
      p.y = c.y;
      p.heading = L.h;
      p.pitch = -R.th;
      p.roll = 0;
      p.speed = v;
      p.air = false;
      p.group.position.set(c.x, c.y, c.z);
      p.group.rotation.set(-R.th, L.h, 0);
      return true;
    };
  }
  loopDone(v0) {
    const g = this.g, p = g.player, L = this.loop;
    const c = this.loopPoint(Math.PI * 2);
    p.pos.set(c.x + 0.3, 0, c.z);
    p.heading = L.h;
    p.pitch = 0;
    p.speed = v0 * 0.96;
    p.y = g.world.heightAt(c.x, c.z);
    p.syncTransform(0);
    g.stats.loops = (g.stats.loops || 0) + 1;
    const first = g.stats.loops === 1;
    g.coins += first ? 30 : 8;
    g.addXp(first ? 120 : 40);
    g.ui.toast(first ? '🎢 حلقه مرگ رو کامل رفتی!! +۳۰ سکه' : `🎢 یه دور دیگه! (${fa(g.stats.loops)} دور) +۸ سکه`, 'good');
    g.audio.cash();
    if (g.replay) g.replay.offer();
    if (g.rides.ride && g.rides.state === 'toDest') g.rides.say('واااای!!! سرم گیج رفت!!! 😵‍💫');
  }
  loopFall(R, v) {
    const g = this.g, p = g.player, L = this.loop;
    const c = this.loopPoint(R.th);
    p.pos.set(c.x, 0, c.z);
    p.y = c.y;
    p.heading = L.h;
    p.pitch = 0;
    // still on the way up: it rolls back down backwards; over the side: it drops off
    const vx = v * Math.cos(R.th), vy = v * Math.sin(R.th);
    p.speed = R.th < Math.PI / 2 ? -2.5 : vx * 0.6;
    p.air = true;
    p.vy = vy * 0.5;
    p.airT = 0;
    p.airMax = 0;
    p.airSpin = 0;
    p.geyserLaunch = false;
    p.ext.set(0, 0);
    g.ui.toast('😵 سرعتت کم بود! از حلقه افتادی پایین. با سرعت بیشتر بیا', 'warn');
    g.stats.loopFails = (g.stats.loopFails || 0) + 1;
  }
  /** load and fire the cannon */
  startCannon() {
    const g = this.g, p = g.player, C = this.cannon, w = g.world;
    // a landing spot out in the desert, about 380-460 m away
    let land = null;
    for (let k = 0; k < 40 && !land; k++) {
      const a = C.aim + (Math.random() - 0.5) * 0.5, d = 380 + Math.random() * 80;
      const x = C.muzzle.x + Math.sin(a) * d, z = C.muzzle.z + Math.cos(a) * d;
      if (w.freeSpot(x, z, 10) && w.heightAt(x, z) < 30) land = { x, z };
    }
    if (!land) return g.ui.toast('🚀 جای فرود امن پیدا نشد؛ یه لحظه دیگه امتحان کن', 'warn');
    g.ui.toast('🚀 آماده... ۳... ۲... ۱...', 'info');
    const S = { t: 0, phase: 'load', from: p.pos.clone(), fromY: p.y };
    const ly = w.heightAt(land.x, land.z);
    const M = C.muzzle, apex = M.y + 85;
    p.script = (dt) => {
      S.t += dt;
      if (S.phase === 'load') {
        // roll up into the barrel and wait for the fuse
        const k = clamp(S.t / 2.2, 0, 1), e = k * k * (3 - 2 * k);
        const B = C.breech;
        p.pos.set(S.from.x + (B.x - S.from.x) * e, 0, S.from.z + (B.z - S.from.z) * e);
        p.y = S.fromY + (B.y - S.fromY) * e;
        p.heading = C.aim;
        p.pitch = -C.pitch * e;
        p.speed = (1 - k) * 3;
        p.group.position.set(p.pos.x, p.y, p.pos.z);
        p.group.rotation.set(p.pitch, p.heading, 0);
        if (S.t > 2.2 && !S.fuse) {
          S.fuse = true;
          for (let i = 0; i < 6; i++) g.audio.tone(2400 - i * 120, 0.08, 0.04, 'square', i * 0.12);
        }
        if (S.t > 3) {
          S.phase = 'fly';
          S.t = 0;
          this.boom();
        }
        return true;
      }
      // the flight: a fast ballistic climb, then the parachute opens and it floats down
      const T1 = 3.4, T2 = 6.5;
      let x, y, z, pitch;
      if (S.t < T1) {
        const u = S.t / T1;
        x = M.x + (land.x - M.x) * 0.82 * u;
        z = M.z + (land.z - M.z) * 0.82 * u;
        y = M.y + (apex - M.y) * (1 - (u - 1) * (u - 1));
        pitch = -C.pitch * (1 - u);
      } else {
        const u = clamp((S.t - T1) / T2, 0, 1);
        x = M.x + (land.x - M.x) * (0.82 + 0.18 * u);
        z = M.z + (land.z - M.z) * (0.82 + 0.18 * u);
        y = apex + (ly - apex) * Math.pow(u, 1.15);
        pitch = Math.sin(S.t * 1.7) * 0.08;
        if (!this.chute.visible) this.openChute();
        this.chute.scale.setScalar(Math.min(1, (S.t - T1) * 2.5 + 0.2));
        if (u >= 1) {
          this.cannonLand(land);
          return false;
        }
      }
      p.pos.set(x, 0, z);
      p.y = y;
      p.heading = C.aim;
      p.pitch = pitch;
      p.speed = 0;
      p.air = true;
      p.group.position.set(x, y, z);
      p.group.rotation.set(pitch, C.aim, Math.sin(S.t * 1.3) * 0.06);
      return true;
    };
  }
  boom() {
    const g = this.g, M = this.cannon.muzzle;
    g.audio.crash(14);
    g.audio.tone(45, 1.4, 0.5, 'sine');
    g.audio.burst(1.2, 600, 'lowpass', 0.9);
    g.shake = 1.3;
    g.flashT = Math.max(g.flashT || 0, 0.15);
    for (let i = 0; i < 30; i++) g.fx.smoke.emit(M.x + (Math.random() - 0.5) * 3, M.y + (Math.random() - 0.5) * 3, M.z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 8, Math.random() * 6, 6 + Math.random() * 10, 3.5, 3, 3, 0.7, 0.8);
    for (let i = 0; i < 40; i++) g.fx.fire.emit(M.x, M.y, M.z, (Math.random() - 0.5) * 10, Math.random() * 8, 10 + Math.random() * 16, 0.6, 2.5, 1.5, 1, 0.7);
    g.stats.cannons = (g.stats.cannons || 0) + 1;
    if (g.rides.ride && g.rides.state === 'toDest') g.rides.say('چیییییی؟!! مارو با توپ شلیک کردی؟!!! 😱😱');
  }
  openChute() {
    const g = this.g, p = g.player;
    this.chute.position.set(0, 6.3, -0.2);
    p.group.add(this.chute);
    this.chute.visible = true;
    g.audio.burst(0.4, 1200, 'bandpass', 0.5);
  }
  cannonLand(land) {
    const g = this.g, p = g.player;
    this.chute.visible = false;
    this.chute.removeFromParent();
    p.pos.set(land.x, 0, land.z);
    p.speed = 0;
    p.pitch = 0;
    p.vy = 0;
    p.air = false;
    p.airSpin = 0;
    p.y = g.world.heightAt(land.x, land.z);
    p.syncTransform(0);
    p.bump(-1.6, 0, 0);
    g.camInit = true;
    g.coins += 15;
    g.addXp(60);
    const d = Math.hypot(land.x - this.cannon.x, land.z - this.cannon.z);
    g.ui.toast(`🪂 فرود نرم! ${fa(Math.round(d))} متر پرواز کردی • +۱۵ سکه`, 'good');
    g.audio.cash();
    this.cool = 8;
  }
  /* ---------------- update ---------------- */
  update(dt) {
    const g = this.g, p = g.player;
    this.cool = Math.max(0, this.cool - dt);
    this.padMat.emissiveIntensity = 0.8 + Math.sin(g.time * 4) * 0.5;
    // a flight cut short (a teleport, jail...) never leaves the parachute hanging
    if (!p.script && this.chute.visible) {
      this.chute.visible = false;
      this.chute.removeFromParent();
    }
    if (g.state !== 'play' || g.onfoot.active || p.script || p.air || this.busy()) {
      this.padT = 0;
      return;
    }
    // entering the loop: right lane, right direction, moving
    const L = this.loop;
    const dx = p.pos.x - L.x0, dz = p.pos.z - L.z0;
    const ang = Math.abs(Math.atan2(Math.sin(p.heading - L.h), Math.cos(p.heading - L.h)));
    if (dx > -1.6 && dx < 0.2 && Math.abs(dz) < 2.2 && ang < 0.45 && p.speed > 4) {
      this.startLoop(p.speed);
      return;
    }
    // parked on the cannon's pad for a moment
    const C = this.cannon;
    const onPad = Math.hypot(p.pos.x - C.pad.x, p.pos.z - C.pad.z) < 3 && Math.abs(p.speed) < 1.2;
    this.padT = onPad && this.cool <= 0 ? this.padT + dt : 0;
    if (this.padT > 1) {
      this.padT = 0;
      this.startCannon();
    }
  }
  mapIcons() {
    return [
      { x: this.loop.x0, z: this.loop.z0, col: '#e53935', txt: '🎢' },
      { x: this.cannon.x, z: this.cannon.z, col: '#5d4037', txt: '💣' },
    ];
  }
}
