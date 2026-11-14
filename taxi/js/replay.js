import * as THREE from 'three';
import { clamp, fa } from './util.js';

const $ = (id) => document.getElementById(id);
const N = 720; // 12 seconds at 60 fps
const MAXC = 48;
const CAMS = ['🎬 سینمایی', '🎥 تعقیب', '📺 تلویزیونی', '🚁 هوایی'];
const _v = new THREE.Vector3();

/** Instant replay: the last 12 seconds of the taxi and the cars around it, replayed with cinematic cameras. */
export class Replay {
  constructor(game) {
    this.g = game;
    this.buf = [];
    for (let i = 0; i < N; i++) this.buf.push({ p: new Float32Array(9), n: 0, refs: new Array(MAXC), c: new Float32Array(MAXC * 6), dt: 1 / 60 });
    this.head = 0;
    this.count = 0;
    this.cam = 0;
    this.speed = 1;
    this.paused = false;
    this.chipT = 0;
    $('rpExit').onclick = () => this.close();
    $('rpCam').onclick = () => this.nextCam();
    $('rpSlow').onclick = () => this.toggleSlow();
    $('rpPlay').onclick = () => this.togglePause();
    $('rpRestart').onclick = () => {
      this.pos = 0;
      this.tvAt = null;
    };
    $('replayChip').onclick = () => this.open();
    $('rpShot').onclick = () => game.photo.capture();
    $('rpBar').addEventListener('pointerdown', (e) => this.seek(e));
  }
  reset() {
    this.count = 0;
  }
  /** called every play frame after the world moved */
  record(dt) {
    const g = this.g;
    if (g.state !== 'play') return;
    const f = this.buf[this.head];
    const P = g.player.group, p = f.p;
    p[0] = P.position.x;
    p[1] = P.position.y;
    p[2] = P.position.z;
    p[3] = P.rotation.x;
    p[4] = P.rotation.y;
    p[5] = P.rotation.z;
    const w = g.player.car.wheels;
    p[6] = w[0].steer.rotation.y;
    p[7] = w[0].spin.rotation.x;
    p[8] = g.player.nitroOn ? 1 : 0;
    let n = 0;
    for (const o of g.traffic.obstacles) {
      if (n >= MAXC) break;
      if (o === g.player || !o.group || !o.active) continue;
      f.refs[n] = o;
      const k = n * 6, gp = o.group.position, gr = o.group.rotation;
      f.c[k] = gp.x;
      f.c[k + 1] = gp.y;
      f.c[k + 2] = gp.z;
      f.c[k + 3] = gr.x;
      f.c[k + 4] = gr.y;
      f.c[k + 5] = gr.z;
      n++;
    }
    for (let i = n; i < f.n; i++) f.refs[i] = null;
    f.n = n;
    f.dt = dt;
    this.head = (this.head + 1) % N;
    this.count = Math.min(N, this.count + 1);
    // the replay chip after something worth watching
    if (this.chipT > 0) {
      this.chipT -= dt;
      if (this.chipT <= 0) $('replayChip').classList.add('hidden');
    }
  }
  /** show the 🎬 chip for a few seconds (big jump, crash, finish line) */
  offer() {
    if (this.count < 90) return;
    this.chipT = 6;
    $('replayChip').classList.remove('hidden');
  }
  frameAt(i) {
    return this.buf[(this.head - this.count + i + N * 2) % N];
  }
  open() {
    const g = this.g;
    if (g.state !== 'play' || g.ui.panelOpen || this.count < 60) {
      if (this.count < 60 && g.state === 'play') g.ui.toast('🎬 هنوز چیزی برای ریپلی ضبط نشده', 'info');
      return;
    }
    g.ui.closePanel && g.ui.panelOpen && g.ui.closePanel();
    this.frames = this.count;
    g.state = 'replay';
    g.ui.resetInputs();
    g.audio.setEngine(0, 0, false);
    g.audio.setSkid(0);
    g.audio.setWind(0, false);
    g.audio.siren(false);
    g.ui.toggleBigMap(false);
    $('replayChip').classList.add('hidden');
    this.chipT = 0;
    // remember where everything really is
    const P = g.player.group;
    this.saved = { pos: P.position.clone(), rot: P.rotation.clone(), cars: [], camFov: g.camera.fov };
    const seen = new Set();
    for (let i = 0; i < this.frames; i++) {
      const f = this.frameAt(i);
      for (let k = 0; k < f.n; k++) if (f.refs[k]) seen.add(f.refs[k]);
    }
    for (const o of g.traffic.obstacles) if (o !== g.player && o.group) seen.add(o);
    for (const o of seen) this.saved.cars.push({ o, pos: o.group.position.clone(), rot: o.group.rotation.clone(), vis: o.group.visible });
    this.pos = 0;
    this.paused = false;
    this.speed = 1;
    this.tvAt = null;
    this.camPos = null;
    document.body.classList.add('replaymode');
    $('replay').classList.remove('hidden');
    $('rpSlow').classList.remove('active');
    $('rpPlay').textContent = '⏸️';
    $('rpCam').textContent = CAMS[this.cam];
    g.stats.replays = (g.stats.replays || 0) + 1;
  }
  close() {
    const g = this.g;
    if (g.state !== 'replay') return;
    g.state = 'play';
    const S = this.saved, P = g.player.group;
    P.position.copy(S.pos);
    P.rotation.copy(S.rot);
    for (const s of S.cars) {
      s.o.group.position.copy(s.pos);
      s.o.group.rotation.copy(s.rot);
      s.o.group.visible = s.vis;
    }
    g.camera.fov = S.camFov;
    g.camera.updateProjectionMatrix();
    g.camInit = true;
    document.body.classList.remove('replaymode');
    $('replay').classList.add('hidden');
    if (g.police.state === 'chase') g.audio.siren(true);
  }
  nextCam() {
    this.cam = (this.cam + 1) % CAMS.length;
    $('rpCam').textContent = CAMS[this.cam];
    this.tvAt = null;
    this.camPos = null;
  }
  toggleSlow() {
    this.speed = this.speed === 1 ? 0.35 : 1;
    $('rpSlow').classList.toggle('active', this.speed < 1);
  }
  togglePause() {
    this.paused = !this.paused;
    $('rpPlay').textContent = this.paused ? '▶️' : '⏸️';
  }
  seek(e) {
    const r = $('rpBar').getBoundingClientRect();
    this.pos = clamp((e.clientX - r.left) / r.width, 0, 1) * (this.frames - 1);
    this.tvAt = null;
    this.camPos = null;
  }
  apply(f) {
    const g = this.g, P = g.player.group, p = f.p;
    P.position.set(p[0], p[1], p[2]);
    P.rotation.set(p[3], p[4], p[5]);
    for (const w of g.player.car.wheels) {
      w.spin.rotation.x = p[7];
      if (w.front) w.steer.rotation.y = p[6];
    }
    for (const s of this.saved.cars) s.o.group.visible = false;
    for (let k = 0; k < f.n; k++) {
      const o = f.refs[k];
      if (!o) continue;
      const i = k * 6;
      o.group.visible = true;
      o.group.position.set(f.c[i], f.c[i + 1], f.c[i + 2]);
      o.group.rotation.set(f.c[i + 3], f.c[i + 4], f.c[i + 5]);
    }
  }
  update(dt) {
    const g = this.g, cam = g.camera;
    if (!this.paused) {
      // slow motion by itself while the taxi flies
      const cur = this.frameAt(Math.floor(this.pos));
      const gy = g.world.heightAt(cur.p[0], cur.p[2]);
      const flying = cur.p[1] - gy > 1.2;
      this.pos += (dt / (cur.dt || 1 / 60)) * this.speed * (flying && this.speed === 1 ? 0.45 : 1);
      if (this.pos >= this.frames - 1) {
        this.pos = 0;
        this.tvAt = null;
        this.camPos = null;
      }
    }
    const i = Math.floor(this.pos);
    const f = this.frameAt(i);
    this.apply(f);
    const p = f.p;
    const tx = p[0], ty = p[1] + 0.9, tz = p[2];
    const h = p[4];
    const fx = Math.sin(h), fz = Math.cos(h);
    let want, fov = 55;
    if (this.cam === 0) {
      // slow orbit that drifts around the car
      const a = h + Math.PI * 0.75 + this.pos * 0.004;
      want = _v.set(tx + Math.sin(a) * 7.5, ty + 1.6, tz + Math.cos(a) * 7.5);
      fov = 50;
    } else if (this.cam === 1) {
      want = _v.set(tx - fx * 7, ty + 1.9, tz - fz * 7);
      fov = 62;
    } else if (this.cam === 2) {
      // a camera on the roadside ahead; when the car has passed, pick the next spot
      const far = this.tvAt && Math.hypot(this.tvAt.x - tx, this.tvAt.z - tz);
      const passed = this.tvAt && (this.tvAt.x - tx) * fx + (this.tvAt.z - tz) * fz < -12;
      if (!this.tvAt || far > 70 || passed) {
        const ahead = this.frameAt(Math.min(this.frames - 1, i + 150)).p;
        const side = Math.random() < 0.5 ? 1 : -1;
        const ax = ahead[0] + Math.cos(h) * 11 * side, az = ahead[2] - Math.sin(h) * 11 * side;
        this.tvAt = { x: ax, z: az, y: Math.max(g.world.heightAt(ax, az) + 2.4, ahead[1] + 1.8) };
      }
      want = _v.set(this.tvAt.x, this.tvAt.y, this.tvAt.z);
      const d = Math.hypot(tx - want.x, tz - want.z);
      fov = clamp((Math.atan(4.5 / Math.max(1, d)) * 360) / Math.PI, 12, 60);
    } else {
      want = _v.set(tx - fx * 3, ty + 22, tz - fz * 3);
      fov = 55;
    }
    want.y = Math.max(want.y, g.world.heightAt(want.x, want.z) + 0.5);
    if (!this.camPos || this.cam === 2) this.camPos = want.clone();
    else this.camPos.lerp(want, 1 - Math.exp(-4 * dt));
    cam.position.copy(this.camPos);
    cam.lookAt(tx, ty, tz);
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * (this.cam === 2 ? 1 : 0.1);
      cam.updateProjectionMatrix();
    }
    g.sky.mesh.position.copy(cam.position);
    $('rpFill').style.width = (i / Math.max(1, this.frames - 1)) * 100 + '%';
    const left = ((this.frames - i) / 60).toFixed(1);
    const t = `${fa(left).replace('.', '٫')} ث`;
    if (t !== this.tText) $('rpTime').textContent = this.tText = t;
  }
}
