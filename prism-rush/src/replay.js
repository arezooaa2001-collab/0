// Replay system: records the last 40 s of the player (30 Hz ring buffer) and plays it back with replay cameras.
import * as THREE from 'three';
import { G } from './game.js';
import { createRig } from './characters.js';
import { clamp } from './util.js';

export const ANIM_STATES = ['idle', 'walk', 'run', 'sprint', 'skid', 'jump', 'fall', 'ball', 'spindash', 'slide', 'wallrun', 'climb', 'glide', 'fly', 'swim', 'grind', 'hurt', 'land', 'backflip', 'sideflip', 'stomp', 'attack', 'pogo', 'celebrate', 'victory', 'defeat', 'frustrated', 'high5', 'cannon', 'dead'];
const HZ = 30, SEC = 40, N = HZ * SEC, STRIDE = 10;

export class Replay {
  constructor(scene) { this.scene = scene; this.buf = new Float32Array(N * STRIDE); this.count = 0; this.head = 0; this.acc = 0; this.playing = false; this.speed = 1; this.cam = 'follow'; this.t = 0; this.paused = false; }
  record(dt, P) {
    this.acc += dt; if (this.acc < 1 / HZ) return; this.acc = 0;
    const o = this.head * STRIDE, c = P.container, a = P.anim || {};
    this.buf[o] = c.position.x; this.buf[o + 1] = c.position.y; this.buf[o + 2] = c.position.z;
    this.buf[o + 3] = c.quaternion.x; this.buf[o + 4] = c.quaternion.y; this.buf[o + 5] = c.quaternion.z; this.buf[o + 6] = c.quaternion.w;
    this.buf[o + 7] = Math.max(0, ANIM_STATES.indexOf(a.state)); this.buf[o + 8] = a.speedNorm || 0; this.buf[o + 9] = a.speed || 0;
    this.head = (this.head + 1) % N; this.count = Math.min(N, this.count + 1);
  }
  start() {
    if (this.count < HZ) { G.hud.toast('replay_empty', 'info'); return false; }
    this.playing = true; this.t = 0; this.paused = false;
    this.rig = createRig(G.player.charId, { quality: G.preset.charQ, skin: G.save.skin[G.player.charId] }); this.scene.add(this.rig.root);
    G.player.container.visible = false; G.player.blob.visible = false; this.anim = { state: 'idle' };
    return true;
  }
  stop() { this.playing = false; if (this.rig) { this.scene.remove(this.rig.root); this.rig.dispose(); this.rig = null; } G.player.container.visible = true; }
  toggle() { this.paused = !this.paused; }
  seek(f) { this.t = clamp(f, 0, 1) * (this.count - 1) / HZ; }
  frame(i) { const idx = ((this.head - this.count + i) % N + N) % N; return idx * STRIDE; }
  update(dt) {
    if (!this.playing) return;
    const len = (this.count - 1) / HZ;
    if (!this.paused) this.t += dt * this.speed; if (this.t > len) this.t = 0;
    const f = this.t * HZ; const i = Math.floor(f), k = f - i;
    const a = this.frame(i), b = this.frame(Math.min(this.count - 1, i + 1)), B = this.buf;
    const r = this.rig.root;
    r.position.set(B[a] + (B[b] - B[a]) * k, B[a + 1] + (B[b + 1] - B[a + 1]) * k, B[a + 2] + (B[b + 2] - B[a + 2]) * k);
    r.quaternion.set(B[a + 3], B[a + 4], B[a + 5], B[a + 6]).slerp(new THREE.Quaternion(B[b + 3], B[b + 4], B[b + 5], B[b + 6]), k);
    const st = ANIM_STATES[B[a + 7] | 0]; if (st !== this.anim.state) { this.anim.state = st; this.anim.timeInState = 0; } else this.anim.timeInState += dt;
    this.anim.speedNorm = B[a + 8]; this.anim.speed = B[a + 9];
    this.rig.update(dt * this.speed, this.anim);
    // replay cameras
    const cam = G.camera, p = r.position;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(r.quaternion).setY(0).normalize();
    if (this.cam === 'follow') cam.position.copy(p).addScaledVector(fwd, -6).add(new THREE.Vector3(0, 2.5, 0));
    else if (this.cam === 'orbit') { const ang = G.realTime * 0.6; cam.position.set(p.x + Math.sin(ang) * 8, p.y + 3, p.z + Math.cos(ang) * 8); }
    else if (this.cam === 'side') cam.position.copy(p).add(new THREE.Vector3(-fwd.z, 0, fwd.x).multiplyScalar(9)).add(new THREE.Vector3(0, 1.5, 0));
    else { const seg = Math.floor(this.t / 3); const fa = this.frame(Math.min(this.count - 1, Math.floor((seg * 3 + 1.5) * HZ))); this.trackPos = this.trackPos || new THREE.Vector3(); if (this.trackSeg !== seg) { this.trackSeg = seg; this.trackPos.set(B[fa] + 10, B[fa + 1] + 4, B[fa + 2] + 10); } cam.position.copy(this.trackPos); }
    cam.lookAt(p.x, p.y + 1, p.z);
    this.onTick && this.onTick(this.t / Math.max(0.001, len));
  }
}
