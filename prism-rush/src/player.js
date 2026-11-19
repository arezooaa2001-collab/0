// Player character controller: momentum-based high-speed movement, slopes, jumps, spin dash, homing, boost,
// wall-run / wall-jump / climb, rails, loops & tracks, swimming, power-ups, damage + respawn, companion AI.
import * as THREE from 'three';
import { G, bus } from './game.js';
import { clamp, lerp, damp, rotateTowards, UP } from './util.js';
import { heightAt, normalAt, waterLevelAt, lavaAt, surfaceAt, regionAt, inWorld, ZONES } from './world/terrain.js';
import { charStats, addXP } from './progress.js';
import { createRig, CHARACTER_INFO } from './characters.js';

export const GRAV = 34;
const RADIUS = 0.45, HEIGHT = 1.35;
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), nrm = new THREE.Vector3();
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), mtx = new THREE.Matrix4();

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.pos = new THREE.Vector3(0, 20, 0); this.prevPos = this.pos.clone(); this.vel = new THREE.Vector3();
    this.heading = new THREE.Vector3(0, 0, 1); this.facing = new THREE.Vector3(0, 0, 1);
    this.groundN = new THREE.Vector3(0, 1, 0); this.visUp = new THREE.Vector3(0, 1, 0);
    this.mode = 'air'; this.modeTime = 0; this.grounded = false; this.groundC = null; this.groundY = 0;
    this.speed = 0; this.energy = 100; this.boosting = false; this.rings = 0; this.combo = 0; this.comboTimer = 0;
    this.invuln = 0; this.shield = null; this.power = { speed: 0, magnet: 0, invinc: 0, ringx2: 0, xpx2: 0, slowmo: 0, lowgrav: 0 };
    this.prism = false; this.jumps = 0; this.airDashes = 0; this.homing = null; this.homingTarget = null; this.homingChain = 0;
    this.ball = false; this.rolling = false; this.sliding = 0; this.charging = false; this.charge = 0; this.skid = 0; this.lastSkid = -9;
    this.flip = null; this.attackT = 0; this.dashCd = 0; this.specialCd = 0; this.landT = 0; this.lastLand = -9; this.springLock = 0;
    this.wallN = new THREE.Vector3(); this.wallT = 0; this.lastWall = -9; this.wallCd = 0; this.wallSide = 1;
    this.rail = null; this.railS = 0; this.railDir = 1; this.railSpeed = 0; this.railCd = 0; this.lastMoveX = 0; this.railHop = 0;
    this.ride = null; this.rideS = 0; this.rideSpeed = 0; this.rideCd = 0;
    this.underwater = false; this.swimT = 0; this.glide = false; this.flyT = 0; this.flying = false;
    this.cannon = null; this.noControl = 0; this.deadT = 0; this.hurtT = 0; this.locked = false; this.anim = null; this.animOverride = null; this.animOverrideT = 0;
    this.stepAcc = 0; this.boostTime = 0; this.perfectWindow = 0; this.boostChain = 0; this.gravityMul = 1; this.inSafeZone = false;
    this.t = 0; this.hitStop = 0; this.surface = 'grass';
    this.container = new THREE.Group(); this.container.name = 'player'; scene.add(this.container);
    this.visual = new THREE.Group(); this.container.add(this.visual);
    this.blob = makeBlobShadow(); scene.add(this.blob);
    this.bubble = makeBubble(); this.container.add(this.bubble);
    this.res = {};
  }
  get x() { return this.pos.x; } get z() { return this.pos.z; }
  setCharacter(id, quality) {
    this.charId = id; this.stats = charStats(id); this.info = CHARACTER_INFO[id];
    if (this.rig) { this.visual.remove(this.rig.root); this.rig.dispose(); }
    this.rig = createRig(id, { quality: quality ?? (G.preset ? G.preset.charQ : 0.6), skin: (G.save && G.save.skin[id]) || 'default' });
    this.visual.add(this.rig.root);
    this.energy = Math.min(this.energy, this.stats.boostCap);
    bus.emit('charChanged', id);
  }
  refreshStats() { if (this.charId) this.stats = charStats(this.charId); }
  spawn(p, yaw = 0) {
    this.pos.copy(p); this.prevPos.copy(p); this.vel.set(0, 0, 0); this.speed = 0;
    this.heading.set(Math.sin(yaw), 0, Math.cos(yaw)); this.facing.copy(this.heading);
    this.setMode('air'); this.rail = null; this.ride = null; this.cannon = null; this.charging = false; this.rolling = false; this.homing = null;
    this.invuln = 1.5; this.hurtT = 0; this.deadT = 0; this.noControl = 0; this.container.visible = true; this.prism = false;
    if (G.cam) G.cam.snapBehind(this);
  }
  setMode(m) { if (this.mode !== m) { this.mode = m; this.modeTime = 0; } }
  isAttacking() {
    return this.ball || this.rolling || this.sliding > 0 || this.charging || !!this.homing || this.mode === 'stomp' || this.boosting || this.prism || this.power.invinc > 0 || this.attackT > 0 || this.airDashT > 0 || this.mode === 'rail' || this.mode === 'ride';
  }
  maxJumps() { return (this.stats.triple ? 3 : 2) + (this.shield === 'elec' ? 1 : 0); }
  topSpeed() { return this.stats.top * (this.power.speed > 0 ? 1.28 : 1) * (this.prism ? 1.35 : 1); }
  boostSpeed() { return this.stats.boostSpeed * (this.prism ? 1.3 : 1) * (this.power.speed > 0 ? 1.1 : 1); }

  // ---------------------------------------------------------------- fixed step
  fixedUpdate(h) {
    const inp = G.input; const st = this.stats;
    this.t += h; this.modeTime += h;
    this.prevPos.copy(this.pos);
    if (this.hitStop > 0) { this.hitStop -= h; return; }
    for (const k in this.power) if (this.power[k] > 0) { this.power[k] -= h; if (this.power[k] <= 0) bus.emit('powerEnd', k); }
    this.invuln = Math.max(0, this.invuln - h); this.dashCd -= h; this.specialCd -= h; this.railCd -= h; this.rideCd -= h; this.wallCd -= h;
    this.attackT = Math.max(0, this.attackT - h); this.airDashT = Math.max(0, (this.airDashT || 0) - h); this.landT = Math.max(0, this.landT - h);
    this.springLock = Math.max(0, this.springLock - h); this.noControl = Math.max(0, this.noControl - h); this.perfectWindow -= h;
    this.comboTimer -= h; if (this.comboTimer <= 0 && this.combo > 0) { this.combo = 0; }
    if (this.prism) { this.prismDrain = (this.prismDrain || 0) + h; if (this.prismDrain >= 1) { this.prismDrain = 0; this.rings--; if (this.rings <= 0) this.endPrism(); } this.energy = st.boostCap; }
    if (this.mode === 'dead') { this.deadT -= h; if (this.deadT <= 0) this.respawn(); return; }
    if (this.locked) { this.vel.multiplyScalar(0.9); return; }

    // gravity zones
    const inMoon = this.pos.distanceTo(v1.fromArray(ZONES.moon.c)) < ZONES.moon.r;
    this.gravityMul = (inMoon ? ZONES.moon.gravity : 1) * (this.power.lowgrav > 0 ? 0.5 : 1) * (G.level ? G.level.gravityAt(this.pos) : 1);

    // input -> wish
    const mv = inp.move; const cf = G.cam.forwardXZ, cr = G.cam.rightXZ;
    this.wish = (this.wish || new THREE.Vector3()).set(0, 0, 0).addScaledVector(cf, mv.y).addScaledVector(cr, mv.x);
    let wl = Math.min(1, this.wish.length()); if (wl > 0.01) this.wish.divideScalar(wl || 1);
    if (G.settings.access.autoRun && wl < 0.1 && this.mode === 'ground' && this.speed > 4) { this.wish.copy(this.heading); wl = 1; }
    if (this.noControl > 0) wl = 0;
    this.wl = wl;

    // boost
    const wantBoost = inp.boostHeld();
    const cost = this.prism ? 0 : 20;
    if (wantBoost && this.energy > (this.boosting ? 0.5 : 6) && !this.charging && this.mode !== 'swim' && this.mode !== 'climb' && this.mode !== 'hurt') {
      if (!this.boosting) this.startBoost();
      this.boosting = true; this.energy = Math.max(0, this.energy - cost * h); this.boostTime += h; G.save.stats.boostTime += h;
    } else { if (this.boosting) G.audio.loop('boostLoop', false); this.boosting = false; this.energy = Math.min(st.boostCap, this.energy + st.boostRegen * h * (this.mode === 'ground' ? 1 : 0.5)); }

    this.updateHomingTarget();
    // interaction / special / transform / items work in most modes
    if (inp.take('interact')) G.level.interact(this);
    if (inp.take('transform')) this.tryPrism();
    if (inp.take('special')) this.special();

    switch (this.mode) {
      case 'ground': this.groundStep(h); break;
      case 'air': case 'stomp': this.airStep(h); break;
      case 'hurt': this.hurtStep(h); break;
      case 'wall': this.wallStep(h); break;
      case 'climb': this.climbStep(h); break;
      case 'swim': this.swimStep(h); break;
      case 'rail': this.railStep(h); break;
      case 'ride': this.rideStep(h); break;
      case 'cannon': this.cannonStep(h); break;
    }
    if (this.mode === 'ground' || this.mode === 'air' || this.mode === 'stomp' || this.mode === 'hurt' || this.mode === 'wall' || this.mode === 'climb' || this.mode === 'swim') this.moveAndCollide(h);
    this.postStep(h);
  }

  startBoost() {
    G.audio.play('boost'); G.audio.loop('boostLoop', true);
    G.save.stats.boosts++;
    if (this.perfectWindow > 0) { this.perfectWindow = 0; this.energy = Math.min(this.stats.boostCap, this.energy + 18); this.speed *= 1.12; G.hud.toast('perfect_boost', 'good'); bus.emit('perfectBoost'); }
    if (this.mode === 'ground' || this.mode === 'air') {
      const fwd = v1.copy(this.wl > 0.1 ? this.wish : this.heading).setY(0).normalize();
      if (this.mode === 'air') { this.vel.x = fwd.x * Math.max(this.boostSpeed() * 0.8, this.hSpeed()); this.vel.z = fwd.z * Math.max(this.boostSpeed() * 0.8, this.hSpeed()); this.vel.y = Math.max(this.vel.y, 1); this.ball = false; }
      if (this.speed > 34 || this.mode === 'air') { G.fx.sonicBoom(this.pos, fwd); G.audio.play('sonicBoom', { vol: 0.8 }); G.cam.shake(0.25); }
    }
  }
  hSpeed() { return Math.hypot(this.vel.x, this.vel.z); }

  groundStep(h) {
    const st = this.stats, inp = G.input, n = this.groundN;
    // heading on the plane
    v1.copy(this.vel).addScaledVector(n, -this.vel.dot(n));
    let speed = v1.length();
    if (speed > 0.4) this.heading.copy(v1).divideScalar(speed);
    else this.heading.copy(this.facing).addScaledVector(n, -this.facing.dot(n)).normalize();
    // spin dash charging
    if (this.charging) {
      speed = Math.max(0, speed - 60 * h);
      this.charge = Math.min(1, this.charge + h * 0.75);
      if (inp.take('jump') || inp.take('spin')) { this.charge = Math.min(1, this.charge + 0.22); G.audio.play('spinCharge', { pitch: 0.8 + this.charge * 0.8 }); G.fx.dust(this.pos, this.surface, 6); }
      if (this.wl > 0.1) rotateTowards(this.facing, this.facing, this.wish, 8 * h);
      G.audio.loop('charge', true, { pitch: 0.7 + this.charge });
      if (!inp.held('spin')) {
        this.charging = false; G.audio.loop('charge', false);
        const dir = this.wl > 0.1 ? this.wish : this.facing;
        this.heading.copy(dir).addScaledVector(n, -dir.dot(n)).normalize();
        speed = 30 + 46 * this.charge; this.rolling = true; G.audio.play('spinRelease'); G.fx.dust(this.pos, this.surface, 20); G.cam.shake(0.2 + this.charge * 0.3);
        if (this.charge >= 0.99) G.save.stats.spindashMax = 1;
        bus.emit('spindash', this.charge);
      }
      this.vel.copy(this.heading).multiplyScalar(speed); this.speed = speed; return;
    }
    const top = this.topSpeed();
    if (this.sliding > 0) { this.sliding -= h; if (this.sliding <= 0 || speed < 8) this.sliding = 0; }
    if (this.wl > 0.05) {
      v2.copy(this.wish).addScaledVector(n, -this.wish.dot(n)).normalize();
      const d = this.heading.dot(v2);
      if (d < -0.45 && speed > 12 && !this.rolling && !this.boosting) {
        if (this.skid <= 0) { G.audio.play('footstep_' + this.surfaceSfx(), { vol: 1.4, pitch: 0.7 }); }
        this.skid = 0.25; this.lastSkid = this.t; speed = Math.max(0, speed - 75 * h);
        G.fx.dust(this.pos, this.surface, 2);
        if (speed < 4) this.heading.copy(v2);
      } else {
        this.skid = Math.max(0, this.skid - h);
        const sn = clamp(speed / (top * 1.6), 0, 1);
        const turn = (this.rolling ? 2.6 : this.sliding > 0 ? 1.8 : lerp(14, 3.4, sn)) * st.turn;
        const before = this.heading.clone();
        rotateTowards(this.heading, this.heading, v2, turn * h);
        this.turnRate = before.cross(this.heading).y / h;
        let target = this.boosting ? this.boostSpeed() : top * this.wl;
        if (this.rolling || this.sliding > 0) target = 0;
        if (speed < target) {
          const acc = this.boosting ? 140 : st.accel * (1.15 - 0.75 * (speed / Math.max(1, target)));
          speed = Math.min(target, speed + acc * h);
        } else if (!this.rolling && this.sliding <= 0) {
          speed = Math.max(target, speed - (speed > top * 1.02 ? 5 : 26) * h * G.weather.frictionMul());
        }
      }
    } else {
      this.skid = 0; this.turnRate = 0;
      const fr = (this.rolling ? 3 : this.sliding > 0 ? 9 : this.boosting ? 0 : 32) * G.weather.frictionMul();
      if (this.boosting) speed = Math.min(this.boostSpeed(), speed + 140 * h);
      else speed = Math.max(0, speed - fr * h);
    }
    // slope gravity
    v3.set(0, -GRAV * this.gravityMul, 0); v3.addScaledVector(n, -v3.dot(n));
    const along = v3.dot(this.heading);
    const k = this.rolling || this.sliding > 0 ? 1.0 : this.boosting ? 0.15 : 0.5;
    speed += along * k * h;
    if (speed < 0) { speed = -speed; this.heading.negate(); }
    if (speed < 1.5 && v3.length() > 6 && n.y < 0.82) { this.heading.copy(v3).normalize(); speed += v3.length() * 0.4 * h; }
    if (this.rolling && speed < 5) this.rolling = false;
    speed = Math.min(speed, 130);
    this.speed = speed;
    this.vel.copy(this.heading).multiplyScalar(speed);
    if (this.wl > 0.05 || speed > 1) this.facing.copy(this.heading).setY(0).normalize();

    // actions
    if (inp.take('jump')) {
      if (inp.held('spin') && speed < 6) this.doJump('backflip');
      else if (this.t - this.lastSkid < 0.3) this.doJump('sideflip');
      else this.doJump();
      return;
    }
    if (inp.take('spin')) {
      if (speed < 6) { this.charging = true; this.charge = 0; G.audio.play('spinCharge', { pitch: 0.8 }); }
      else if (speed < 22 && this.sliding <= 0) { this.rolling = !this.rolling; if (this.rolling) G.audio.play('spinRelease', { vol: 0.5 }); }
      else if (this.sliding <= 0) { this.sliding = 1.3; this.rolling = false; G.audio.play('dash', { vol: 0.6, pitch: 0.7 }); }
    }
    if (inp.take('attack')) {
      const tgt = this.homingTarget;
      if (tgt && tgt.pos.distanceTo(this.pos) < 4.5) { this.attackT = 0.35; this.attackHit(tgt); }
      else if (this.dashCd <= 0) { this.dashCd = 0.8; this.speed = Math.max(speed, Math.max(38, top * 1.15)); this.vel.copy(this.heading).multiplyScalar(this.speed); this.attackT = 0.25; G.audio.play('dash'); G.fx.dust(this.pos, this.surface, 10); }
      else this.attackT = 0.35;
    }
  }
  doJump(kind) {
    const n = this.groundN; const j = this.stats.jump * (this.prism ? 1.2 : 1);
    this.vel.addScaledVector(n, j * 0.82); this.vel.y += j * 0.18 + Math.max(0, -this.vel.y * 0.2);
    if (this.groundC && this.groundC.vy) { this.vel.x += this.groundC.vx; this.vel.y += Math.max(0, this.groundC.vy); this.vel.z += this.groundC.vz; }
    this.flip = null; this.ball = true;
    if (kind === 'backflip') { this.vel.y = j * 1.3; this.vel.addScaledVector(this.facing, -4.5); this.flip = 'backflip'; this.ball = false; }
    if (kind === 'sideflip') { this.vel.y = j * 1.22; this.vel.addScaledVector(this.wl > 0.1 ? this.wish : this.facing, 6); this.flip = 'sideflip'; this.ball = false; }
    if (this.charId === 'lumi' && G.input.held('spin') && kind === undefined && this.speed < 10) { this.vel.y = j * 1.65; this.flip = 'pogo'; this.ball = false; }
    this.rolling = false; this.sliding = 0; this.charging = false; this.jumps = 1; this.airDashes = 0; this.homingChain = 0;
    this.setMode('air'); this.grounded = false; this.groundC = null;
    G.audio.play('jump', { pitch: this.info.voicePitch * 0.9 }); G.save.stats.jumps++; bus.emit('jump');
    if (Math.random() < 0.15) G.audio.play('voiceEffort', { pitch: this.info.voicePitch });
  }
  airStep(h) {
    const st = this.stats, inp = G.input;
    let g = GRAV * this.gravityMul;
    if (this.vel.y < 0) g *= 1.12;
    if (this.glide && this.vel.y < 0) { g *= 0.18; this.vel.y = Math.max(this.vel.y, -4); }
    if (this.homing) {
      const tp = this.homing.pos; v1.copy(tp).sub(this.pos); v1.y += this.homing.yOff || 0.4; const d = v1.length();
      this.vel.copy(v1).divideScalar(Math.max(d, 0.01)).multiplyScalar(58);
      this.homingT -= h;
      if (d < 1.6 || this.homingT <= 0 || this.homing.dead) {
        if (d < 2.2 && !this.homing.dead) this.attackHit(this.homing, true);
        else { this.homing = null; this.vel.multiplyScalar(0.3); }
      }
      return;
    }
    if (this.mode === 'stomp') { this.vel.set(this.vel.x * 0.9, -52, this.vel.z * 0.9); return; }
    this.vel.y -= g * h;
    if (this.vel.y < -70) this.vel.y = -70;
    // air control (preserve momentum, steer)
    if (this.wl > 0.05 && this.springLock <= 0) {
      v1.set(this.vel.x, 0, this.vel.z); let hs = v1.length();
      const airTop = Math.max(this.topSpeed() * 0.75, 14) * this.wl;
      if (hs > 0.5) { v1.divideScalar(hs); rotateTowards(v1, v1, this.wish, 3.2 * st.air * h); } else v1.copy(this.wish);
      if (hs < airTop) hs = Math.min(airTop, hs + 26 * st.air * h);
      this.vel.x = v1.x * hs; this.vel.z = v1.z * hs;
      this.facing.copy(v1);
    } else if (this.springLock <= 0) { this.vel.x *= 1 - 0.15 * h; this.vel.z *= 1 - 0.15 * h; }
    // wind (blizzards / sandstorms)
    if (G.weather) { const w = G.weather.wind; const k = clamp(G.weather.cur.wind - 0.5, 0, 1) * 0.5; this.vel.x += w.x * k * h; this.vel.z += w.z * k * h; }
    // jump buttons
    if (inp.take('jump')) {
      if (this.t - this.lastWall < 0.18 && this.wallCd <= 0) this.wallJump();
      else if (this.jumps < this.maxJumps()) {
        this.vel.y = st.jump * (this.jumps === 1 ? 0.95 : 0.85) * (this.shield === 'elec' && this.jumps >= 2 ? 1.1 : 1);
        this.jumps++; this.ball = true; this.flip = null; this.glide = false;
        G.audio.play('doubleJump', { pitch: 1 + this.jumps * 0.08 }); G.fx.ring(this.pos, 0xffffff, 1.2); bus.emit('jump');
        if (this.shield === 'elec') G.fx.burst(this.pos, 0x7fdcff, 14, 6);
      } else if (this.charId === 'pip' && this.flyT < 4 + this.stats.spec * 1.5) { this.flying = true; }
    }
    if (this.charId === 'pip') {
      if (this.flying && inp.held('jump') && this.flyT < 4 + this.stats.spec * 1.5) { this.vel.y = Math.min(this.vel.y + 46 * h, 7.5); this.flyT += h; this.ball = false; }
      else this.flying = false;
      this.glide = !this.flying && inp.held('jump') && this.vel.y < 0 && this.jumps >= 2;
    } else this.glide = inp.held('jump') && this.vel.y < -2 && this.jumps >= this.maxJumps() && (this.charId === 'pip');
    if (inp.take('attack') || (inp.take('jump2'))) {
      const tgt = this.homingTarget;
      if (tgt) { this.homing = tgt; this.homingT = 0.7; this.ball = true; this.glide = false; G.audio.play('homing'); G.fx.ring(this.pos, 0x9fe8ff, 1.4); bus.emit('homing'); G.save.stats.homing++; }
      else if (this.airDashes < this.stats.airDashes) {
        this.airDashes++; const f = v1.copy(this.wl > 0.1 ? this.wish : this.facing).setY(0).normalize();
        const s = Math.max(this.hSpeed(), 36) * (this.shield === 'fire' ? 1.25 : 1); this.vel.set(f.x * s, Math.max(this.vel.y, 1.5), f.z * s);
        this.airDashT = 0.3; this.ball = true; G.audio.play('dash'); G.fx.sonicBoom(this.pos, f, 0.5);
        if (this.shield === 'fire') G.fx.burst(this.pos, 0xff8a2a, 20, 8);
      }
    }
    if (inp.take('spin')) { this.setMode('stomp'); this.ball = true; G.audio.play('dash', { pitch: 0.6 }); }
  }
  wallJump() {
    this.vel.set(this.wallN.x * 13, this.stats.jump * 1.0, this.wallN.z * 13);
    this.facing.copy(this.wallN).setY(0).normalize(); this.heading.copy(this.facing);
    this.jumps = 1; this.airDashes = 0; this.ball = true; this.wallCd = 0.2; this.setMode('air');
    G.audio.play('jump', { pitch: 1.2 }); G.fx.dust(this.pos, 'rock', 8); bus.emit('wallJump');
  }
  hurtStep(h) { this.vel.y -= GRAV * this.gravityMul * h; this.hurtT -= h; if (this.hurtT <= 0) this.setMode('air'); }
  wallStep(h) {
    this.wallT -= h;
    v1.set(this.vel.x, 0, this.vel.z); v1.addScaledVector(this.wallN, -v1.dot(this.wallN));
    const s = Math.max(16, v1.length() + (this.boosting ? 40 * h : -2 * h)); v1.normalize();
    this.vel.set(v1.x * s, damp(this.vel.y, 0, 5, h) - 3 * h, v1.z * s).addScaledVector(this.wallN, -3);
    if (this.wallUp) this.vel.y = Math.max(4, s * 0.55);
    this.facing.copy(v1); this.heading.copy(v1);
    if (G.input.take('jump')) { this.wallJump(); return; }
    if (this.wallT <= 0 || this.t - this.lastWall > 0.12) { this.setMode('air'); this.wallCd = 0.4; this.wallUp = false; }
  }
  climbStep(h) {
    const mv = G.input.move;
    v1.set(-this.wallN.z, 0, this.wallN.x); // lateral along wall
    const camSide = v1.dot(G.cam.rightXZ) >= 0 ? 1 : -1;
    this.vel.set(0, mv.y * 6, 0).addScaledVector(v1, mv.x * 5 * camSide).addScaledVector(this.wallN, -2);
    this.facing.copy(this.wallN).negate();
    if (G.input.take('jump')) { this.wallJump(); return; }
    if (this.t - this.lastWall > 0.15) {
      if (mv.y > 0.2) { this.vel.y = 9; this.vel.addScaledVector(this.wallN, -5); } // ledge hop
      this.setMode('air');
    }
  }
  swimStep(h) {
    const wl = waterLevelAt(this.pos.x, this.pos.z);
    const surf = wl - 0.55;
    const deep = this.pos.y < surf - 0.3;
    const sp = (this.boosting ? 19 : 11) * (this.shield === 'water' ? 1.3 : 1);
    v1.copy(this.wish).multiplyScalar(sp * this.wl);
    this.vel.x = damp(this.vel.x, v1.x, 3, h); this.vel.z = damp(this.vel.z, v1.z, 3, h);
    if (G.input.held('spin')) this.vel.y = damp(this.vel.y, -6, 3, h);
    else this.vel.y = damp(this.vel.y, (surf - this.pos.y) * 4, 4, h);
    if (this.wl > 0.1) this.facing.copy(this.wish);
    if (G.input.take('jump') && !deep) { this.vel.y = this.stats.jump * 0.9; this.setMode('air'); this.jumps = 1; this.ball = true; G.audio.play('splash'); G.fx.splash(this.pos); }
    else if (G.input.take('jump') && deep) this.vel.y = 7;
    this.speed = this.hSpeed();
  }
  railStep(h) {
    const r = this.rail; const st = this.stats;
    r.tangentAt(this.railS, v1); v1.multiplyScalar(this.railDir);
    this.railSpeed += -GRAV * this.gravityMul * v1.y * 0.85 * h;
    if (this.boosting) this.railSpeed = Math.min(this.boostSpeed() * 1.05 * st.rail, this.railSpeed + 60 * h);
    else if (G.input.held('spin')) this.railSpeed += 4 * h; // crouch: aerodynamic tuck
    else this.railSpeed -= 1.5 * h;
    this.railSpeed = clamp(this.railSpeed, 10, 95 * st.rail);
    this.railS += this.railSpeed * this.railDir * h;
    G.save.stats.railDist += this.railSpeed * h;
    if (this.railHop > 0) this.railHop -= h;
    if (this.railS < 0 || this.railS > r.length) { this.leaveRail(1); return; }
    r.pointAt(this.railS, this.pos); this.pos.y += 0.05 + (this.railHop > 0 ? Math.sin((this.railHop / 0.3) * Math.PI) * 1.2 : 0);
    this.vel.copy(v1).multiplyScalar(this.railSpeed); this.speed = this.railSpeed;
    this.facing.copy(v1).setY(0).normalize(); this.heading.copy(v1);
    // rail switching (flick left/right)
    const mx = G.input.move.x;
    if (Math.abs(mx) > 0.75 && Math.abs(this.lastMoveX) <= 0.75 && this.railHop <= 0) {
      const side = v2.copy(G.cam.rightXZ).multiplyScalar(Math.sign(mx));
      const other = G.level.findParallelRail(this.pos, side, r);
      if (other) { this.rail = other.rail; this.railS = other.s; this.railHop = 0.3; G.audio.play('railLand', { pitch: 1.2 }); bus.emit('railSwitch'); }
    }
    this.lastMoveX = mx;
    if (G.input.take('jump')) { this.leaveRail(0); this.vel.y += this.stats.jump * 0.95; this.ball = true; this.jumps = 1; G.audio.play('jump'); }
    G.audio.loop('grind', true, { pitch: 0.7 + this.railSpeed / 60 });
    if (Math.random() < 0.6) G.fx.sparks(this.pos, v1);
  }
  leaveRail(endBoost) {
    G.audio.loop('grind', false);
    this.rail = null; this.railCd = 0.3; this.setMode('air'); this.jumps = 1; this.airDashes = 0;
    if (endBoost) this.vel.y += 3;
  }
  rideStep(h) {
    const tr = this.ride;
    tr.tangentAt(this.rideS, v1); tr.upAt(this.rideS, v2);
    this.rideSpeed += -GRAV * this.gravityMul * v1.y * 0.8 * h;
    if (this.boosting) this.rideSpeed = Math.min(this.boostSpeed() * 1.1, this.rideSpeed + 50 * h);
    if (tr.autoSpeed) this.rideSpeed = Math.max(this.rideSpeed, tr.autoSpeed);
    if (this.rideSpeed < 9 && v2.y < 0.25) { // too slow: fall off
      this.ride = null; this.rideCd = 1; this.vel.copy(v1).multiplyScalar(this.rideSpeed); this.setMode('air'); this.visUp.set(0, 1, 0); return;
    }
    this.rideS += this.rideSpeed * h;
    if (this.rideS >= tr.length) {
      tr.tangentAt(tr.length, v1); this.vel.copy(v1).multiplyScalar(this.rideSpeed); this.ride = null; this.rideCd = 0.5;
      this.setMode('air'); this.jumps = 1; if (tr.kind === 'loop' || tr.kind === 'corkscrew') { G.save.stats.loops++; bus.emit('loop', tr.kind); }
      return;
    }
    tr.pointAt(this.rideS, this.pos); this.pos.addScaledVector(v2, 0.05);
    this.vel.copy(v1).multiplyScalar(this.rideSpeed); this.speed = this.rideSpeed; this.rideUp = v2;
    this.heading.copy(v1); if (Math.abs(v1.y) < 0.9) this.facing.copy(v1).setY(0).normalize();
    if (G.input.take('jump') && tr.kind !== 'tube') { this.ride = null; this.rideCd = 0.6; this.vel.addScaledVector(v2, this.stats.jump); this.setMode('air'); this.ball = true; this.jumps = 1; }
  }
  cannonStep(h) {
    const c = this.cannon; this.vel.set(0, 0, 0); this.pos.copy(c.mouth);
    c.t -= h; if (c.t <= 0) {
      this.vel.copy(c.launchVel); this.cannon = null; this.setMode('air'); this.ball = true; this.noControl = c.flight * 0.85; this.springLock = c.flight * 0.85;
      this.container.visible = true; G.audio.play('cannon'); G.cam.shake(0.5); G.fx.explosion(this.pos, 0xffd27a, 0.8); this.jumps = 1; this.airDashes = 0;
    }
  }

  // -------------------------------------------------------------- integration
  moveAndCollide(h) {
    const L = this.vel.length() * h;
    const n = clamp(Math.ceil(L / 0.32), 1, 12); const sub = h / n;
    const res = this.res; const phys = G.physics;
    let groundedAny = false; let wallAny = false;
    for (let i = 0; i < n; i++) {
      const prevY = this.pos.y;
      this.pos.addScaledVector(this.vel, sub);
      res.ground = false; res.wall = false; res.ceiling = false; res.gc = null;
      phys.resolveCapsule(this.pos, this.vel, RADIUS, this.sliding > 0 ? 0.9 : HEIGHT, res, { grounded: this.mode === 'ground', prevY, step: 0.55 });
      // terrain
      const th = heightAt(this.pos.x, this.pos.z);
      const wasGround = this.mode === 'ground';
      const snap = wasGround ? 0.3 + Math.min(0.6, this.speed * sub * 0.8) : 0.0;
      let tGround = false;
      if (this.pos.y <= th + snap && (this.vel.y <= 2 || this.pos.y < th)) {
        normalAt(this.pos.x, this.pos.z, nrm);
        if (this.pos.y < th || wasGround) this.pos.y = th;
        const vn = this.vel.dot(nrm); if (vn < 0) this.vel.addScaledVector(nrm, -vn);
        tGround = true;
      }
      if (res.ground && (!tGround || res.gy >= th - 0.05)) { this.groundN.set(res.gnx, res.gny, res.gnz); this.groundC = res.gc; this.groundY = this.pos.y; groundedAny = true; }
      else if (tGround) {
        if (nrm.y < 0.45 && this.mode !== 'ground') { // too steep to land: treat like a wall
          res.wall = true; res.wnx = nrm.x; res.wnz = nrm.z;
        } else { this.groundN.copy(nrm); this.groundC = null; this.groundY = th; groundedAny = true; }
      }
      if (res.wall) { wallAny = true; this.wallN.set(res.wnx, 0, res.wnz).normalize(); this.lastWall = this.t; this.wallC = res.wc; }
      if (res.ceiling && this.vel.y > 0) this.vel.y = 0;
    }
    // inherit moving platform motion
    if (groundedAny && this.groundC && this.groundC.dynamic) {
      const c = this.groundC; this.pos.x += c.vx * h; this.pos.y += c.vy * h; this.pos.z += c.vz * h;
      if (c.dyaw) { const dx = this.pos.x - c.x, dz = this.pos.z - c.z; const ca = Math.cos(-c.dyaw), sa = Math.sin(-c.dyaw); this.pos.x = c.x + dx * ca - dz * sa; this.pos.z = c.z + dx * sa + dz * ca; this.facing.applyAxisAngle(UP, c.dyaw); }
    }
    if (groundedAny && this.mode !== 'ground' && this.mode !== 'climb' && this.mode !== 'swim' && this.vel.y <= 0.5) this.land();
    else if (!groundedAny && this.mode === 'ground') {
      this.coyote = (this.coyote || 0) + h;
      if (this.coyote > 0.08) { this.setMode('air'); this.jumps = 1; this.ball = false; this.grounded = false; }
    }
    if (groundedAny) this.coyote = 0;
    this.grounded = this.mode === 'ground';
    // wall interactions while airborne
    if (wallAny && (this.mode === 'air') && this.wallCd <= 0) {
      v1.set(this.vel.x, 0, this.vel.z); const hs = v1.length();
      const into = hs > 0.1 ? -v1.dot(this.wallN) / hs : 0;
      const towards = this.wl > 0.2 ? -this.wish.dot(this.wallN) : 0;
      if (this.stats.special === 'climb' && towards > 0.5 && this.wallC !== 'terrain') { this.setMode('climb'); this.ball = false; this.homing = null; }
      else if (hs > 13 && into < 0.6 && this.vel.y > -16) {
        this.setMode('wall'); this.wallT = this.stats.wallTime; this.ball = false; this.wallUp = false;
        this.wallSide = new THREE.Vector3().crossVectors(UP, this.wallN).dot(v1) > 0 ? 1 : -1;
        G.audio.play('wallrun'); G.save.stats.wallruns++; bus.emit('wallrun');
      } else if (hs > 22 && into > 0.85 && this.boosting) {
        this.setMode('wall'); this.wallT = 0.7; this.wallUp = true; this.ball = false;
      }
    }
    if (this.mode === 'stomp' && (groundedAny)) {
      G.fx.ring(this.pos, 0xffffff, 3); G.cam.shake(0.4); G.audio.play('stomp');
      G.enemies && G.enemies.damageRadius(this.pos, 4, this); G.level.smash(this.pos, 3.5, this);
      if (this.shield === 'water') { this.vel.y = 18; this.setMode('air'); }
    }
  }
  land() {
    const fall = -this.vel.y;
    this.setMode('ground'); this.jumps = 0; this.airDashes = 0; this.ball = false; this.flip = null; this.glide = false; this.flying = false; this.flyT = 0; this.homing = null; this.homingChain = 0;
    this.grounded = true; this.springLock = 0; this.noControl = 0;
    if (this.lastLand < this.t - 0.25) { G.audio.play('land', { vol: clamp(fall / 25, 0.3, 1.2) }); G.fx.landing(this.pos, this.surface, clamp(fall / 20, 0.3, 1.5)); }
    if (fall > 18) { this.landT = 0.18; G.cam.shake(clamp(fall / 80, 0, 0.35)); }
    this.lastLand = this.t; this.perfectWindow = 0.22;
    v1.copy(this.vel).addScaledVector(this.groundN, -this.vel.dot(this.groundN)); // keep momentum along the slope
    if (v1.length() > 0.5) { this.heading.copy(v1).normalize(); }
    this.vel.copy(v1); this.speed = v1.length();
  }

  postStep(h) {
    const st = this.stats;
    // water & lava
    const wl = waterLevelAt(this.pos.x, this.pos.z);
    const terr = heightAt(this.pos.x, this.pos.z);
    this.underwater = this.pos.y < wl - 1.1 && this.mode !== 'rail' && this.mode !== 'ride';
    if (this.mode !== 'swim' && this.mode !== 'rail' && this.mode !== 'ride' && this.mode !== 'cannon' && this.pos.y < wl - 0.9 && terr < wl - 1.2) {
      if (this.boosting && this.hSpeed() > 30 && this.mode !== 'air') { this.pos.y = wl - 0.05; this.vel.y = Math.max(0, this.vel.y); this.waterRun = true; } // water running at speed
      else { this.setMode('swim'); this.ball = false; G.audio.play('splash'); G.fx.splash(this.pos); this.vel.multiplyScalar(0.4); }
    } else if (this.mode === 'swim' && (terr > wl - 0.9 || this.pos.y > wl + 0.3)) { this.setMode(terr > this.pos.y - 0.3 ? 'ground' : 'air'); }
    // run across water when fast (classic!)
    if (this.mode === 'ground' && terr < wl - 0.5 && this.speed > 28) { this.pos.y = Math.max(this.pos.y, wl); if (Math.random() < 0.5) G.fx.splash(this.pos, 0.4); }
    const lv = lavaAt(this.pos.x, this.pos.z);
    if (this.pos.y < lv + 0.4) {
      this.pos.y = lv + 0.4; this.vel.y = 24; this.setMode('air');
      if (this.shield !== 'fire') this.hurt(this.pos.clone().add(new THREE.Vector3(0, -1, 0)), 'lava');
      G.fx.burst(this.pos, 0xff6a1a, 20, 10);
    }
    // rail / ride attach
    if (this.mode === 'air' || this.mode === 'ground' || this.mode === 'stomp') {
      if (this.railCd <= 0) {
        const r = G.level.findRail(this.pos, this.vel);
        if (r) {
          this.rail = r.rail; this.railS = r.s; r.rail.tangentAt(r.s, v1); this.railDir = this.vel.dot(v1) >= 0 ? 1 : -1;
          this.railSpeed = Math.max(Math.abs(this.vel.dot(v1)), 16); this.setMode('rail'); this.ball = false; this.homing = null;
          G.audio.play('railLand'); G.fx.sparks(this.pos, v1, 12); bus.emit('rail');
        }
      }
      if (this.mode === 'ground' && this.rideCd <= 0) {
        const tr = G.level.findRide(this.pos, this.heading, this.speed);
        if (tr) { this.ride = tr; this.rideS = 0; this.rideSpeed = Math.max(this.speed, tr.minSpeed); this.setMode('ride'); this.rolling = false; bus.emit('rideStart', tr.kind); }
      }
    }
    // triggers, rings, enemies
    G.level.triggers(this, h);
    G.level.collectRings(this, h);
    if (G.enemies) G.enemies.checkPlayer(this);
    if (G.bosses) G.bosses.checkPlayer(this);
    // surface + stats
    normalAt(this.pos.x, this.pos.z, nrm);
    this.surface = this.groundC ? (this.groundC.surface || 'metal') : surfaceAt(this.pos.x, this.pos.z, nrm.y);
    const d = Math.hypot(this.pos.x - this.prevPos.x, this.pos.z - this.prevPos.z);
    if (d < 5) G.save.stats.distance += d;
    const kmh = this.vel.length() * 3.6; if (kmh > G.save.stats.topSpeed && this.mode !== 'cannon' && this.mode !== 'dead') G.save.stats.topSpeed = Math.round(kmh);
    // recovery from invalid positions
    if (!isFinite(this.pos.x + this.pos.y + this.pos.z)) { this.pos.copy(this.prevPos); this.vel.set(0, 0, 0); }
    const outside = !inWorld(this.pos.x, this.pos.z) && !this.inZone();
    if (this.pos.y < -60 || this.pos.y < terr - 6 && this.mode !== 'swim' && !this.inZone() || outside) this.fallOut();
    this.inSafeZone = this.inZone();
  }
  inZone() {
    for (const k in ZONES) { const z = ZONES[k]; if (this.pos.y > z.c[1] - 140 && v3.fromArray(z.c).distanceTo(this.pos) < z.r * 1.6) return true; }
    return false;
  }
  fallOut() {
    if (this.inZone() && this.pos.y > 50) {
      // fell off a floating zone: back to its last checkpoint without penalty
      this.respawn(true); return;
    }
    if (this.pos.y < -60 || !inWorld(this.pos.x, this.pos.z)) this.respawn(true);
    else { const th = heightAt(this.pos.x, this.pos.z); this.pos.y = th + 0.5; this.vel.y = Math.max(0, this.vel.y); }
  }

  // ------------------------------------------------------------- combat & items
  updateHomingTarget() {
    if (this.mode !== 'air' && this.mode !== 'ground') { this.homingTarget = null; return; }
    const list = this._tg || (this._tg = []); list.length = 0;
    G.enemies && G.enemies.targets(list); G.bosses && G.bosses.targets(list); G.level.homingTargets(list);
    let best = null, bs = 1e9; const range = this.stats.homingRange;
    const fwd = v1.copy(this.mode === 'air' ? G.cam.forwardXZ : this.facing).setY(0).normalize();
    for (const t of list) {
      v2.copy(t.pos).sub(this.pos); const d = v2.length(); if (d > range || d < 0.5) continue;
      if (v2.y > 7) continue;
      const dir = v2.setY(0).normalize().dot(fwd); if (dir < 0.35 && d > 4) continue;
      const s = d * (1.6 - dir);
      if (s < bs) { bs = s; best = t; }
    }
    this.homingTarget = best;
  }
  attackHit(t, homing) {
    const killed = t.hit ? t.hit(this, homing ? 'homing' : 'attack') : true;
    if (homing) {
      this.homing = null; this.vel.set(0, 12.5, 0).addScaledVector(this.facing, 2); this.jumps = 1; this.airDashes = 0; this.ball = true;
      this.homingChain++; if (this.homingChain > G.save.stats.maxHomingChain) G.save.stats.maxHomingChain = this.homingChain;
      if (this.homingChain >= 3) G.hud.toast('homing_chain', 'good', { n: this.homingChain });
      if (this.stats.homingChain) this.energy = Math.min(this.stats.boostCap, this.energy + 6);
      this.hitStop = 0.035;
    }
    this.energy = Math.min(this.stats.boostCap, this.energy + 4);
    return killed;
  }
  bounceOff() { this.vel.y = Math.max(this.vel.y, 11); this.jumps = 1; this.airDashes = 0; this.ball = true; if (this.mode === 'ground') this.setMode('air'); }
  hurt(src, kind) {
    if (this.mode === 'dead' || this.invuln > 0 || this.prism || this.power.invinc > 0) return false;
    if (kind === 'lava' && this.shield === 'fire') return false;
    G.cam.shake(0.45); this.rig && this.rig.setExpression && this.rig.setExpression('hurt');
    if (this.mode === 'rail') this.leaveRail(); this.ride = null; this.charging = false; G.audio.loop('charge', false); G.audio.loop('grind', false);
    v1.copy(this.pos).sub(src).setY(0); if (v1.lengthSq() < 0.01) v1.copy(this.facing).negate(); v1.normalize();
    this.vel.set(v1.x * 9, 9, v1.z * 9); this.setMode('hurt'); this.hurtT = 0.55; this.ball = false; this.homing = null; this.boosting = false;
    this.invuln = 2.2;
    if (this.shield) { this.shield = null; G.audio.play('shield', { pitch: 0.6 }); G.fx.burst(this.pos, 0x9fe8ff, 20, 8); bus.emit('hurt', { shield: true }); return true; }
    if (this.rings > 0) {
      const diff = G.settings.gameplay.difficulty;
      const lose = diff === 'easy' ? Math.min(this.rings, 10) : this.rings;
      G.level.scatterRings(this.pos, Math.min(lose, 24));
      this.rings -= lose; G.audio.play('ringScatter'); G.audio.play('voiceHurt', { pitch: this.info.voicePitch });
      bus.emit('hurt', { rings: lose }); return true;
    }
    this.die(); return true;
  }
  die() {
    if (this.mode === 'dead') return;
    this.setMode('dead'); this.deadT = 1.8; this.vel.set(0, 10, 0); G.save.stats.deaths++;
    G.audio.play('voiceSad', { pitch: this.info.voicePitch }); G.audio.play('hurt'); G.fx.explosion(this.pos, 0xffffff, 0.5);
    this.boosting = false; G.audio.loop('boostLoop', false);
    bus.emit('death');
  }
  respawn(fall) {
    const cp = G.level.checkpoint || { pos: new THREE.Vector3(0, heightAt(0, 0) + 1, 0), yaw: 0 };
    this.spawn(cp.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), cp.yaw);
    if (!fall) { this.rings = 0; this.shield = null; }
    this.energy = Math.max(this.energy, 40);
    bus.emit('respawn', { fall });
  }
  addRings(n, pos) {
    const mul = this.power.ringx2 > 0 ? 2 : 1;
    this.rings += n * mul; this.energy = Math.min(this.stats.boostCap, this.energy + 1.8 * n);
    this.combo += n; this.comboTimer = 1.4; if (this.combo > G.save.stats.maxCombo) G.save.stats.maxCombo = this.combo;
    G.progress.addRings(n * mul);
    if (this.combo > 0 && this.combo % 25 === 0) { addXP(10); G.hud.toast('ring_combo', 'good', { n: this.combo }); this.rig.setExpression && this.rig.setExpression('happy'); }
    bus.emit('ring', n * mul);
  }
  givePower(kind) {
    const T = { speed: 15, magnet: 18, invinc: 15, ringx2: 30, xpx2: 60, slowmo: 8, lowgrav: 20 };
    if (kind === 'shield' || kind === 'elecShield' || kind === 'fireShield' || kind === 'waterShield') {
      this.shield = { shield: 'basic', elecShield: 'elec', fireShield: 'fire', waterShield: 'water' }[kind]; G.audio.play('shield');
    } else if (kind === 'energy') { this.energy = this.stats.boostCap; G.audio.play('powerup'); }
    else if (kind === 'rings10') { this.addRings(10); G.audio.play('ring'); }
    else if (T[kind]) { this.power[kind] = T[kind]; G.audio.play(kind === 'slowmo' ? 'slowmoIn' : 'powerup'); }
    bus.emit('power', kind);
  }
  tryPrism() {
    const shards = G.progress.countFound('shard');
    if (this.prism) return;
    if (shards < 7) { G.hud.toast('prism_need_shards', 'info', { n: shards }); return; }
    if (this.rings < 50) { G.hud.toast('prism_need_rings', 'info'); return; }
    this.prism = true; this.prismDrain = 0; G.audio.play('transform'); G.fx.explosion(this.pos, 0xfff2a0, 2); G.cam.shake(0.5);
    this.rig.setPrism && this.rig.setPrism(true); G.save.flags.prismUses = (G.save.flags.prismUses || 0) + 1; bus.emit('prism', true);
    G.hud.toast('prism_on', 'good');
  }
  endPrism() { this.prism = false; this.rig.setPrism && this.rig.setPrism(false); bus.emit('prism', false); }
  special() {
    if (this.specialCd > 0) return;
    const sp = this.stats.special; const lvl = this.stats.spec;
    if (sp === 'blink' && this.mode !== 'rail' && this.mode !== 'ride') {
      const d = v1.copy(this.wl > 0.1 ? this.wish : this.facing).setY(0).normalize();
      const dist = 12 + lvl * 4; const target = v2.copy(this.pos).addScaledVector(d, dist);
      const th = heightAt(target.x, target.z); if (target.y < th) target.y = th + 0.2;
      G.fx.burst(this.pos, 0xb06bff, 18, 6); this.pos.copy(target); this.prevPos.copy(target); G.fx.burst(this.pos, 0xb06bff, 18, 6);
      G.audio.play('teleport'); this.specialCd = 1.6 - lvl * 0.3; G.enemies && G.enemies.damageRadius(this.pos, 3, this);
    } else if (sp === 'flameDash') {
      const d = v1.copy(this.wl > 0.1 ? this.wish : this.facing).setY(0).normalize();
      const s = Math.max(this.hSpeed(), 45 + lvl * 6); this.vel.x = d.x * s; this.vel.z = d.z * s; if (this.mode !== 'ground') this.vel.y = Math.max(this.vel.y, 2);
      this.airDashT = 0.5; G.fx.burst(this.pos, 0xff7a1a, 30, 10); G.audio.play('boost', { pitch: 0.8 }); this.specialCd = 2 - lvl * 0.4;
    } else if (sp === 'climb') { // ground pound smash
      if (this.mode === 'air') { this.setMode('stomp'); this.ball = true; }
      else { this.attackT = 0.4; G.enemies && G.enemies.damageRadius(this.pos, 4 + lvl, this); G.level.smash(this.pos, 4 + lvl, this); G.fx.ring(this.pos, 0xff8a5a, 3); G.cam.shake(0.3); G.audio.play('stomp'); }
      this.specialCd = 1.2;
    } else if (sp === 'fly') { if (this.mode === 'ground') this.doJump(); this.flying = true; this.flyT = 0; this.specialCd = 3 - lvl * 0.5; }
    else if (sp === 'pogo') { if (this.mode === 'ground' || this.mode === 'air') { this.vel.y = this.stats.jump * (1.6 + lvl * 0.15); this.setMode('air'); this.flip = 'pogo'; this.jumps = 1; G.audio.play('spring', { pitch: 1.3 }); this.specialCd = 1.2; } }
    else if (sp === 'airBoost') { if (this.mode === 'air' && this.energy > 15) { this.energy -= 15; this.startBoost(); this.vel.y = Math.max(this.vel.y, 4); this.specialCd = 0.8 - lvl * 0.2; } }
  }
  // springs / pads (called by level)
  spring(dir, power, lock = 0.35) {
    this.vel.copy(dir).multiplyScalar(power); this.setMode('air'); this.ball = false; this.flip = null; this.jumps = 1; this.airDashes = 0;
    this.springLock = lock; this.homing = null; this.rolling = false; this.charging = false; this.springT = 0.5;
    if (this.mode === 'rail') this.leaveRail(); this.perfectWindow = 0.35;
  }
  dashPad(dir, speed) {
    v1.copy(dir).addScaledVector(this.groundN, -dir.dot(this.groundN)).normalize();
    this.heading.copy(v1); this.facing.copy(v1).setY(0).normalize(); this.speed = Math.max(this.speed, speed);
    this.vel.copy(v1).multiplyScalar(this.speed); this.perfectWindow = 0.35;
  }

  // -------------------------------------------------------------- per-frame visuals
  update(dt, alpha) {
    const p = this.container.position.lerpVectors(this.prevPos, this.pos, alpha);
    if (this.mode === 'dead') { this.container.visible = this.deadT > 1.2 || Math.floor(this.deadT * 10) % 2 === 0; }
    else this.container.visible = !(this.invuln > 0 && this.invuln < 2 && Math.floor(this.invuln * 14) % 2 === 0) && !this.cannon;
    // orientation
    const yaw = Math.atan2(this.facing.x, this.facing.z);
    let up = v1.set(0, 1, 0);
    if (this.mode === 'ground') up.copy(this.groundN).lerp(UP, 0.35).normalize();
    else if (this.mode === 'ride' && this.rideUp) up.copy(this.rideUp);
    else if (this.mode === 'wall') up.set(0, 1, 0).addScaledVector(this.wallN, 0.55).normalize();
    this.visUp.lerp(up, 1 - Math.exp(-14 * dt)).normalize();
    qa.setFromAxisAngle(UP, yaw);
    qb.setFromUnitVectors(UP, this.visUp);
    if (this.mode === 'ride' && this.rideUp) {
      // full frame alignment on loops: forward along track, up = track normal
      const f = v2.copy(this.heading).normalize(); const r = v3.crossVectors(this.visUp, f).normalize(); const f2 = new THREE.Vector3().crossVectors(r, this.visUp);
      mtx.makeBasis(r, this.visUp, f2); this.container.quaternion.setFromRotationMatrix(mtx);
    } else this.container.quaternion.slerp(qb.multiply(qa), 1 - Math.exp(-18 * dt));
    // animation state
    const a = this.anim || (this.anim = {});
    a.speed = this.vel.length(); a.speedNorm = this.boosting ? 1.25 : clamp(this.speed / Math.max(1, this.stats.top), 0, 1.3);
    a.boosting = this.boosting; a.vy = this.vel.y; a.charge = this.charge; a.wallSide = this.wallSide; a.prism = this.prism;
    a.lean = damp(a.lean || 0, clamp(-(this.turnRate || 0) * this.speed * 0.012, -0.55, 0.55), 8, dt);
    a.pitch = this.mode === 'ground' ? clamp(this.speed / 90, 0, 0.35) : 0;
    a.lod = 0;
    let s;
    const m = this.mode;
    if (this.animOverride && this.animOverrideT > 0) { s = this.animOverride; this.animOverrideT -= dt; }
    else if (m === 'dead') s = 'dead';
    else if (m === 'hurt') s = 'hurt';
    else if (m === 'rail') s = 'grind';
    else if (m === 'ride') s = this.ride && this.ride.kind === 'cannon' ? 'cannon' : 'sprint';
    else if (m === 'wall') s = 'wallrun';
    else if (m === 'climb') s = 'climb';
    else if (m === 'swim') s = 'swim';
    else if (m === 'cannon') s = 'cannon';
    else if (m === 'stomp') s = 'stomp';
    else if (m === 'air') {
      if (this.flip === 'backflip') s = 'backflip'; else if (this.flip === 'sideflip') s = 'sideflip'; else if (this.flip === 'pogo') s = this.charId === 'lumi' ? 'pogo' : 'jump';
      else if (this.flying) s = 'fly'; else if (this.glide) s = 'glide';
      else if (this.ball || this.homing) s = 'ball';
      else if ((this.springT || 0) > 0) s = 'jump';
      else s = this.vel.y > 0 ? 'jump' : 'fall';
    } else {
      if (this.charging) s = 'spindash'; else if (this.rolling) s = 'ball'; else if (this.sliding > 0) s = 'slide'; else if (this.skid > 0) s = 'skid';
      else if (this.attackT > 0) s = 'attack'; else if (this.landT > 0) s = 'land';
      else if (this.speed < 0.6) s = this.idleAnim || 'idle'; else if (this.speed < 9) s = 'walk'; else if (this.speed < this.stats.top * 0.92 && !this.boosting) s = 'run'; else s = 'sprint';
    }
    this.springT = Math.max(0, (this.springT || 0) - dt);
    if (s !== a.state) { a.state = s; a.timeInState = 0; } else a.timeInState += dt;
    if (this.rig) {
      this.rig.update(dt, a);
      if (this.rig.lookAt) this.rig.lookAt(this.homingTarget ? this.homingTarget.pos : null);
    }
    // blob shadow
    const th = heightAt(p.x, p.z);
    const gy = this.mode === 'ground' ? p.y : Math.max(th, this.groundY > p.y - 30 && this.groundY < p.y + 0.5 ? this.groundY : th);
    this.blob.position.set(p.x, gy + 0.06, p.z); const hgt = p.y - gy; this.blob.material.opacity = clamp(0.45 - hgt * 0.03, 0, 0.45); this.blob.scale.setScalar(clamp(1 - hgt * 0.03, 0.4, 1));
    this.blob.visible = this.container.visible && !G.preset.shadow;
    // bubble / aura
    const bm = this.bubble.material.uniforms;
    let col = null;
    if (this.prism) col = 0xfff2a0; else if (this.power.invinc > 0) col = 0xff7ae0; else if (this.shield === 'basic') col = 0x7fd8ff; else if (this.shield === 'elec') col = 0xffe85a; else if (this.shield === 'fire') col = 0xff6a2a; else if (this.shield === 'water') col = 0x3a9bff;
    this.bubble.visible = !!col; if (col) { bm.uColor.value.set(col); bm.uTime.value += dt; this.bubble.scale.setScalar(this.prism ? 1.25 : 1.05 + Math.sin(this.t * 6) * 0.02); }
    // trails & particles
    G.fx.playerTrail(this, dt);
    if (this.mode === 'ground' && this.speed > 8) { this.stepAcc += dt * this.speed * 0.22; if (this.stepAcc > 1) { this.stepAcc = 0; G.audio.play('footstep_' + this.surfaceSfx(), { vol: clamp(this.speed / 30, 0.25, 0.9) }); if (this.speed > 20) G.fx.dust(this.pos, this.surface, 2); } }
    if (this.prism && Math.random() < 0.5) G.fx.burst(this.pos.clone().add(new THREE.Vector3(0, 0.7, 0)), 0xfff0a0, 1, 2, 0.4);
  }
  surfaceSfx() { const s = this.surface; return s === 'grass' ? 'grass' : s === 'sand' ? 'sand' : s === 'snow' ? 'snow' : s === 'metal' ? 'metal' : s === 'water' ? 'water' : 'rock'; }
  celebrate(kind = 'victory', time = 2.5) { this.animOverride = kind; this.animOverrideT = time; this.rig && this.rig.setExpression && this.rig.setExpression(kind === 'defeat' || kind === 'frustrated' ? 'sad' : 'happy'); }
}

function makeBlobShadow() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(0,0,0,0.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.45 }));
  m.renderOrder = 2; return m;
}
export function makeBubble(radius = 1.0) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(0x7fd8ff) }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); float hex = 0.5+0.5*sin(vP.x*14.0+uTime*3.0)*sin(vP.y*14.0-uTime*2.0)*sin(vP.z*14.0); gl_FragColor = vec4(uColor*(f*1.4 + hex*0.12), 1.0); }',
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), mat); m.position.y = 0.7; m.visible = false; return m;
}

// ---------------------------------------------------------------- companion AI
export class Companion {
  constructor(scene) { this.scene = scene; this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.container = new THREE.Group(); scene.add(this.container); this.anim = { state: 'idle' }; this.t = 0; this.atkCd = 0; this.id = null; this.chatCd = 20; }
  set(id) {
    if (this.rig) { this.container.remove(this.rig.root); this.rig.dispose(); this.rig = null; }
    this.id = id; if (!id) return;
    this.rig = createRig(id, { quality: Math.min(0.6, G.preset.charQ), skin: G.save.skin[id] || 'default' }); this.container.add(this.rig.root);
    if (G.preset.index < 2) this.rig.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    const p = G.player.pos; this.pos.set(p.x - 3, p.y, p.z - 3);
  }
  update(dt) {
    if (!this.rig || !G.settings.gameplay.companion) { this.container.visible = false; return; }
    this.container.visible = true; this.t += dt;
    const P = G.player; const target = v1.copy(P.pos).addScaledVector(P.facing, -3.2).add(v2.set(-P.facing.z, 0, P.facing.x).multiplyScalar(1.8));
    const d = this.pos.distanceTo(target);
    if (d > 45 || P.inZone() !== this.inZone) { this.pos.copy(target); this.vel.set(0, 0, 0); this.inZone = P.inZone(); }
    const k = clamp(d * 0.9, 0, Math.max(30, P.speed * 1.1));
    v3.copy(target).sub(this.pos).setY(0); const hd = v3.length(); if (hd > 0.3) v3.multiplyScalar(k / hd); else v3.set(0, 0, 0);
    this.vel.x = damp(this.vel.x, v3.x, 6, dt); this.vel.z = damp(this.vel.z, v3.z, 6, dt);
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const th = heightAt(this.pos.x, this.pos.z);
    const ty = P.mode === 'ground' ? Math.max(th, P.pos.y - 0.3) : Math.max(th, target.y);
    this.pos.y = damp(this.pos.y, P.inZone() ? target.y : ty, 10, dt);
    if (this.pos.y < th) this.pos.y = th;
    this.container.position.copy(this.pos);
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.5) this.container.rotation.y = Math.atan2(this.vel.x, this.vel.z);
    const a = this.anim; const s = P.mode === 'air' && Math.abs(this.pos.y - th) > 1 ? 'jump' : hs < 0.6 ? (this.high5 > 0 ? 'high5' : 'idle') : hs < 9 ? 'walk' : hs < 24 ? 'run' : 'sprint';
    if (s !== a.state) { a.state = s; a.timeInState = 0; } else a.timeInState = (a.timeInState || 0) + dt;
    a.speed = hs; a.speedNorm = clamp(hs / 30, 0, 1.2); a.lod = 1;
    this.rig.update(dt, a);
    // assistance: attack nearby enemies, collect rings close to it
    this.atkCd -= dt;
    if (this.atkCd <= 0 && G.enemies) { const e = G.enemies.nearest(this.pos, 9); if (e) { this.atkCd = 3.5; G.fx.ring(e.pos, 0x9fe8ff, 1); G.enemies.damage(e, 1, P); } }
    if (G.level) G.level.collectRingsAt(this.pos, 1.6);
    // friendship interaction when both idle
    this.high5 = Math.max(0, (this.high5 || 0) - dt);
    this.chatCd -= dt;
    if (P.speed < 0.5 && P.mode === 'ground' && hs < 0.5 && this.chatCd <= 0 && this.pos.distanceTo(P.pos) < 5) {
      this.chatCd = 40; this.high5 = 1.5; P.celebrate('high5', 1.2);
      const key = [P.charId, this.id].sort().join('-'); G.save.friendship[key] = (G.save.friendship[key] || 0) + 1;
      G.hud.subtitle(this.id, 'line_friend_' + (G.save.friendship[key] % 4)); G.audio.play('voiceHappy', { pitch: CHARACTER_INFO[this.id].voicePitch });
      bus.emit('friendship', key);
    }
  }
}
