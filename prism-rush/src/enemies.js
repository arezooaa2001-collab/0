// Robot enemies: 10 types with patrol / detect / chase / telegraphed attacks, shields, cloaking, snipers, turrets,
// projectiles, weak points, damage reactions, drops, respawn, difficulty scaling, pooled models + animation LOD.
import * as THREE from 'three';
import { G, bus } from './game.js';
import { clamp, damp, rng, lerp } from './util.js';
import { heightAt, regionAt, waterLevelAt } from './world/terrain.js';
import { createRobot } from './robots.js';
import { addXP } from './progress.js';
import { ROUTES } from './world/content.js';

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
const TYPES = {
  crawler: { hp: 1, speed: 4, chase: 7.5, detect: 22, range: 3.2, tele: 0.5, cd: 1.6, xp: 10, rings: 3 },
  drone: { hp: 1, speed: 5, chase: 8, detect: 28, range: 8, tele: 0.8, cd: 2.2, xp: 12, rings: 3, fly: 5 },
  roller: { hp: 1, speed: 6, chase: 15, detect: 26, range: 2, tele: 0.3, cd: 1.2, xp: 12, rings: 3 },
  heavy: { hp: 3, speed: 2.5, chase: 3.5, detect: 20, range: 6, tele: 1.0, cd: 2.4, xp: 30, rings: 8 },
  shield: { hp: 2, speed: 3, chase: 5, detect: 22, range: 3.5, tele: 0.6, cd: 1.8, xp: 20, rings: 5 },
  stealth: { hp: 1, speed: 4, chase: 9, detect: 11, range: 3.5, tele: 0.35, cd: 1.4, xp: 18, rings: 4 },
  sniper: { hp: 1, speed: 0, chase: 0, detect: 62, range: 62, tele: 1.4, cd: 3.2, xp: 22, rings: 4, still: true },
  turret: { hp: 2, speed: 0, chase: 0, detect: 36, range: 36, tele: 0.6, cd: 2.0, xp: 18, rings: 4, still: true },
  jumper: { hp: 1, speed: 0, chase: 0, detect: 24, range: 24, tele: 0.4, cd: 1.5, xp: 14, rings: 3 },
  miniboss: { hp: 8, speed: 2.5, chase: 5, detect: 30, range: 9, tele: 1.1, cd: 2.6, xp: 150, rings: 25 },
};
const REGION_TYPES = {
  meadow: ['crawler', 'drone', 'roller', 'crawler'], forest: ['crawler', 'jumper', 'stealth', 'drone'], desert: ['roller', 'sniper', 'heavy', 'crawler'],
  snow: ['shield', 'drone', 'jumper', 'heavy'], volcano: ['heavy', 'turret', 'sniper', 'drone'], coast: ['crawler', 'drone', 'jumper'],
  city: ['shield', 'sniper', 'turret', 'drone', 'stealth'], ruins: ['stealth', 'shield', 'turret', 'crawler'], canyon: ['sniper', 'roller', 'jumper', 'heavy'],
  fortress: ['turret', 'heavy', 'shield', 'sniper', 'drone'],
};

export class Enemies {
  constructor(scene) {
    this.scene = scene; this.list = []; this.pool = {}; this.shots = []; this.active = 0;
    this.shotGeo = new THREE.SphereGeometry(0.35, 10, 8); this.shotMat = new THREE.MeshBasicMaterial({ color: 0xff5a2a });
    for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(this.shotGeo, this.shotMat); m.visible = false; scene.add(m); this.shots.push({ m, v: new THREE.Vector3(), life: 0 }); }
    this.alertTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#ffd21a'; g.beginPath(); g.moveTo(32, 4); g.lineTo(60, 58); g.lineTo(4, 58); g.fill(); g.fillStyle = '#1a1a1a'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.fillText('!', 32, 52); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    this.frame = 0;
  }
  populate() {
    const r = rng(31);
    ROUTES.forEach((route, ri) => {
      for (let i = 0; i < route.length - 1; i++) {
        const a = route[i], b = route[i + 1]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.floor(len / 75);
        for (let k = 0; k < n; k++) {
          const t = (k + 0.6) / n; const side = (r() < 0.5 ? -1 : 1) * (7 + r() * 10);
          const dx = (b[1] - a[1]) / len, dz = -(b[0] - a[0]) / len;
          const x = lerp(a[0], b[0], t) + dx * side, z = lerp(a[1], b[1], t) + dz * side;
          if (Math.hypot(x, z) < 70) continue;
          const reg = regionAt(x, z); const types = REGION_TYPES[reg.id] || REGION_TYPES.meadow;
          const cnt = 1 + Math.floor(r() * Math.min(3, reg.tier));
          for (let c = 0; c < cnt; c++) this.add(types[Math.floor(r() * types.length)], x + (r() - 0.5) * 8, z + (r() - 0.5) * 8);
        }
      }
    });
    // fortress wall turrets + minibosses
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.3; this.add('turret', 40 + Math.cos(a) * 120, 960 + Math.sin(a) * 120); }
    [[-640, -200], [600, 160], [-360, 720], [-700, -640], [700, -460]].forEach(([x, z]) => this.add('miniboss', x, z));
    [[150, 1000, 9], [130, 1020, 9], [175, 995, 9]].forEach(([x, z, y]) => this.add('crawler', x, z, { y }));
  }
  add(type, x, z, opts = {}) {
    const T = TYPES[type];
    const y = opts.y ?? heightAt(x, z);
    if (y < waterLevelAt(x, z) + 0.5 && !T.fly) return null;
    const e = { type, T, pos: new THREE.Vector3(x, y + (T.fly || 0), z), home: new THREE.Vector3(x, y, z), baseY: y, hp: T.hp, state: 'patrol', t: Math.random() * 5, cd: 1 + Math.random(), tele: 0, yaw: Math.random() * 6.28, vel: new THREE.Vector3(),
      robot: null, dead: false, respawnT: 0, flash: 0, tag: opts.tag || null, temp: !!opts.temp, aimDir: new THREE.Vector3(0, 0, 1), lock: new THREE.Vector3(), jumpV: 0, airborne: false, cloak: type === 'stealth' ? 1 : 0, hitCd: 0, lodSkip: 0 };
    this.list.push(e); return e;
  }
  spawnWave(center, types, count, tag, radius = 18) {
    const out = [];
    for (let i = 0; i < count; i++) { const a = (i / count) * Math.PI * 2; const e = this.add(types[i % types.length], center.x + Math.cos(a) * radius, center.z + Math.sin(a) * radius, { tag, temp: true, y: center.y > 100 ? center.y : undefined }); if (e) { e.state = 'chase'; out.push(e); } }
    return out;
  }
  aliveWithTag(tag) { let n = 0; for (const e of this.list) if (e.tag === tag && !e.dead) n++; return n; }
  clearTag(tag) { for (const e of this.list) if (e.tag === tag) { this.release(e); e.dead = true; e.temp = true; } this.list = this.list.filter((e) => !(e.tag === tag)); }
  diff() { const d = G.settings.gameplay.difficulty; return d === 'easy' ? 0.78 : d === 'hard' ? 1.25 : 1; }
  acquire(e) {
    const p = this.pool[e.type] || (this.pool[e.type] = []);
    e.robot = p.pop() || createRobot(e.type, Math.min(0.85, G.preset.charQ));
    this.scene.add(e.robot.root); e.robot.root.visible = true; const cs = G.preset.index >= 2 && G.preset.shadow > 0; if (e.robot._cs !== cs) { e.robot._cs = cs; e.robot.root.traverse((o) => { if (o.isMesh) o.castShadow = cs; }); } e.robot.setFlash && e.robot.setFlash(0);
    if (!e.alert) { e.alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.alertTex, depthTest: false, transparent: true })); e.alert.scale.set(0.8, 0.8, 1); e.alert.renderOrder = 20; }
    this.scene.add(e.alert); e.alert.visible = false;
  }
  release(e) { if (!e.robot) return; this.scene.remove(e.robot.root); (this.pool[e.type] ||= []).push(e.robot); e.robot = null; if (e.alert) this.scene.remove(e.alert); }

  update(dt) {
    const P = G.player; if (!P) return;
    const wdt = dt * (P.power.slowmo > 0 ? 0.4 : 1);
    const k = this.diff(); this.frame++;
    const actR = clamp(G.preset.objDist * 0.85, 130, 190), lodR = G.preset.animLod;
    let active = 0;
    for (const e of this.list) {
      const d = e.pos.distanceTo(P.pos);
      if (e.dead) { if (!e.temp) { e.respawnT -= dt; if (e.respawnT <= 0 && d > 80) { e.dead = false; e.hp = e.T.hp; e.pos.copy(e.home); e.pos.y = e.baseY + (e.T.fly || 0); e.state = 'patrol'; } } continue; }
      if (d > actR && !e.temp) { if (e.robot) this.release(e); continue; }
      if (!e.robot) this.acquire(e);
      active++;
      this.think(e, wdt, d, P, k);
      // visuals
      const R = e.robot; R.root.position.copy(e.pos); R.root.rotation.y = e.yaw;
      e.flash = Math.max(0, e.flash - dt * 4); R.setFlash && R.setFlash(e.flash);
      if (e.type === 'stealth' && R.setOpacity) R.setOpacity(1 - e.cloak * 0.85);
      if (R.aim) R.aim(e.state === 'telegraph' || e.state === 'chase' ? e.aimDir : null);
      const s = e.s || (e.s = {}); s.state = e.state; s.speed = e.vel.length(); s.telegraph = e.tele; s.time = e.t;
      const far = d > lodR; e.lodSkip = (e.lodSkip + 1) % (far ? 3 : 1);
      if (e.lodSkip === 0) R.update(far ? dt * 3 : dt, s);
      e.alert.visible = (e.state === 'telegraph' || e.alertT > 0) && d < 60; e.alertT = Math.max(0, (e.alertT || 0) - dt);
      if (e.alert.visible) e.alert.position.set(e.pos.x, e.pos.y + (R.height || 1.5) + 0.8, e.pos.z);
    }
    this.active = active;
    // projectiles
    for (const s of this.shots) {
      if (s.life <= 0) continue; s.life -= wdt; s.m.position.addScaledVector(s.v, wdt);
      if (s.m.position.distanceTo(v1.copy(P.pos).setY(P.pos.y + 0.7)) < 0.95) { s.life = 0; s.m.visible = false; if (P.isAttacking() && (P.boosting || P.prism)) G.fx.burst(s.m.position, 0xff8a2a, 8, 5); else P.hurt(s.m.position, 'shot'); }
      if (s.m.position.y < heightAt(s.m.position.x, s.m.position.z) || s.life <= 0) { s.life = 0; s.m.visible = false; G.fx.burst(s.m.position, 0xff6a2a, 5, 3); }
    }
  }
  think(e, dt, d, P, k) {
    const T = e.T; e.t += dt; e.cd -= dt * k; e.hitCd -= dt;
    v1.copy(P.pos).sub(e.pos); const dy = v1.y; v1.y = 0; const hd = v1.length(); const toP = hd > 0.01 ? v1.divideScalar(hd) : v1.set(0, 0, 1);
    const detect = T.detect * (G.settings.gameplay.difficulty === 'hard' ? 1.2 : 1) * (P.mode === 'dead' ? 0 : 1);
    const sees = d < detect;
    if (e.type === 'stealth') e.cloak = damp(e.cloak, d < 11 ? 0 : 1, 3, dt);
    const ground = (x, z) => heightAt(x, z);
    switch (e.state) {
      case 'patrol': case 'idle': {
        if (T.still) { e.yaw += dt * 0.4; if (sees) { e.state = 'chase'; e.alertT = 0.8; G.audio.play('missileWarn', { pos: e.pos, vol: 0.4 }); } break; }
        const a = e.t * 0.35 + e.home.x; const tx = e.home.x + Math.cos(a) * 10, tz = e.home.z + Math.sin(a) * 10;
        v2.set(tx - e.pos.x, 0, tz - e.pos.z); const L = v2.length(); if (L > 0.5) { v2.multiplyScalar(T.speed * k / L); e.yaw = Math.atan2(v2.x, v2.z); }
        e.vel.lerp(v2, 1 - Math.exp(-4 * dt));
        if (sees) { e.state = 'chase'; e.alertT = 0.8; G.audio.play('enemyHit', { pos: e.pos, vol: 0.3, pitch: 1.6 }); }
        break;
      }
      case 'chase': {
        e.aimDir.copy(toP); e.aimDir.y = clamp(dy / Math.max(hd, 1), -1, 1);
        e.yaw = Math.atan2(toP.x, toP.z);
        if (!T.still && e.type !== 'jumper') { e.vel.lerp(v2.copy(toP).multiplyScalar(T.chase * k), 1 - Math.exp(-3 * dt)); if (e.type === 'roller') e.vel.copy(toP).multiplyScalar(T.chase * k); }
        else e.vel.multiplyScalar(0.8);
        if (d > detect * 1.6) { e.state = 'patrol'; break; }
        if (hd < T.range && e.cd <= 0 && (e.type !== 'drone' || hd < 10)) { e.state = 'telegraph'; e.tele = 0; e.teleT = 0; e.lock.copy(P.pos); if (e.type === 'sniper') G.audio.play('laserCharge', { pos: e.pos }); }
        break;
      }
      case 'telegraph': {
        e.teleT += dt; e.tele = clamp(e.teleT / T.tele, 0, 1); e.vel.multiplyScalar(0.85);
        if (e.type === 'sniper') { if (e.tele < 0.78) e.lock.copy(P.pos).y += 0.7; v2.copy(e.lock).sub(e.pos); e.aimDir.copy(v2.normalize()); e.yaw = Math.atan2(v2.x, v2.z); }
        else { e.aimDir.copy(toP); e.yaw = Math.atan2(toP.x, toP.z); }
        if (e.teleT >= T.tele) { this.attack(e, P, toP, hd); e.state = 'attack'; e.attackT = 0; e.cd = T.cd; }
        break;
      }
      case 'attack': {
        e.attackT += dt; e.tele = Math.max(0, e.tele - dt * 3);
        if (e.type === 'crawler' || e.type === 'stealth' || e.type === 'shield') { if (e.attackT < 0.3) e.vel.copy(e.lungeDir).multiplyScalar(13 * k); else e.vel.multiplyScalar(0.8); }
        if (e.type === 'drone') { const k2 = e.attackT / 0.7; if (k2 < 1) { e.pos.lerp(v2.copy(e.lock).setY(e.lock.y + 0.5), dt * 4); } }
        if (e.attackT > 0.8) e.state = 'chase';
        break;
      }
      case 'stunned': { e.vel.multiplyScalar(0.9); e.stunT -= dt; if (e.stunT <= 0) e.state = 'chase'; break; }
    }
    // integrate
    if (e.type === 'jumper') {
      if (e.airborne) { e.jumpV -= 30 * dt; e.pos.y += e.jumpV * dt; e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt; const g = ground(e.pos.x, e.pos.z); if (e.pos.y <= g) { e.pos.y = g; e.airborne = false; e.vel.set(0, 0, 0); } }
      else e.pos.y = ground(e.pos.x, e.pos.z);
    } else {
      e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt;
      if (Math.hypot(e.pos.x - e.home.x, e.pos.z - e.home.z) > 60 && !e.temp) { e.pos.x = damp(e.pos.x, e.home.x, 1, dt); e.pos.z = damp(e.pos.z, e.home.z, 1, dt); if (e.state === 'chase') e.state = 'patrol'; }
      const g = e.baseY > 100 && Math.abs(e.baseY - ground(e.home.x, e.home.z)) > 4 ? e.baseY : ground(e.pos.x, e.pos.z);
      if (T.fly) { const want = e.state === 'attack' ? e.pos.y : (e.state === 'chase' || e.state === 'telegraph' ? Math.max(g, P.pos.y) + 4.5 : g + T.fly + Math.sin(e.t * 1.5) * 0.6); e.pos.y = damp(e.pos.y, want, 2.5, dt); if (e.pos.y < g + 0.6) e.pos.y = g + 0.6; }
      else e.pos.y = g;
    }
  }
  attack(e, P, toP, hd) {
    const T = e.T;
    switch (e.type) {
      case 'crawler': case 'stealth': case 'shield': e.lungeDir = toP.clone(); G.audio.play('dash', { pos: e.pos, vol: 0.5, pitch: 1.4 }); break;
      case 'drone': e.lock.copy(P.pos); G.audio.play('homing', { pos: e.pos, vol: 0.5, pitch: 0.8 }); break;
      case 'roller': break;
      case 'heavy': case 'miniboss': {
        G.fx.ring(e.pos, 0xff8a2a, e.type === 'miniboss' ? 9 : 6, 0.5); G.audio.play('stomp', { pos: e.pos }); G.cam.shake(clamp(1 - hd / 30, 0, 0.4));
        const R = e.type === 'miniboss' ? 9 : 6;
        if (hd < R && P.mode === 'ground' && Math.abs(P.pos.y - e.pos.y) < 2) P.hurt(e.pos, 'shock');
        if (e.type === 'miniboss') for (let i = 0; i < 5; i++) { const a = Math.atan2(toP.x, toP.z) + (i - 2) * 0.3; this.fire(v1.copy(e.pos).y += 2.5, v2.set(Math.sin(a), 0.05, Math.cos(a)).multiplyScalar(18)); }
        break;
      }
      case 'sniper': { const m = e.robot && e.robot.muzzle ? e.robot.muzzle.getWorldPosition(v1) : v1.copy(e.pos).y += 1.5; v2.copy(e.lock).sub(m).normalize().multiplyScalar(75); this.fire(m, v2); G.audio.play('laserShot', { pos: e.pos }); break; }
      case 'turret': { const m = e.robot && e.robot.muzzle ? e.robot.muzzle.getWorldPosition(v1) : v1.copy(e.pos).y += 1.5; v2.copy(P.pos).y += 0.7; v2.sub(m).normalize().multiplyScalar(26); this.fire(m, v2); G.audio.play('shot', { pos: e.pos }); break; }
      case 'jumper': { e.airborne = true; e.jumpV = 13; const tt = 2 * 13 / 30; e.vel.copy(toP).multiplyScalar(Math.min(hd, 18) / tt); G.audio.play('spring', { pos: e.pos, vol: 0.5, pitch: 1.5 }); break; }
    }
  }
  fire(p, v) { const s = this.shots.find((x) => x.life <= 0); if (!s) return; s.life = 3; s.m.visible = true; s.m.position.copy(p); s.v.copy(v); }
  // player interaction
  checkPlayer(P) {
    for (const e of this.list) {
      if (e.dead || !e.robot) continue;
      const rad = (e.robot.radius || 0.8) + 0.55;
      v1.copy(P.pos).y += 0.7; v2.copy(e.pos).y += (e.robot.height || 1.4) * 0.5;
      if (v1.distanceTo(v2) > rad + 0.3) continue;
      if (e.hitCd > 0) continue;
      if (P.isAttacking()) {
        // shielded robots block frontal attacks unless boosting / stomping / prism
        if (e.type === 'shield' && !(P.boosting || P.prism || P.mode === 'stomp' || P.power.invinc > 0)) {
          v3.copy(P.pos).sub(e.pos).setY(0).normalize(); const fwd = v2.set(Math.sin(e.yaw), 0, Math.cos(e.yaw));
          if (v3.dot(fwd) > 0.35) { e.hitCd = 0.4; P.vel.set(v3.x * 12, 8, v3.z * 12); P.setMode('air'); P.homing = null; G.audio.play('enemyHit', { pos: e.pos, pitch: 0.7 }); G.fx.burst(e.pos, 0x7fd8ff, 10, 5); continue; }
        }
        this.damage(e, P.mode === 'stomp' || P.boosting || P.prism ? 2 : 1, P);
        if (P.mode === 'air' && !P.homing) P.bounceOff();
      } else if (e.type === 'stealth' && e.cloak > 0.7) { /* invisible & harmless while fully cloaked */ }
      else P.hurt(e.pos, 'enemy');
    }
  }
  damage(e, n, P) {
    if (e.dead || e.hitCd > 0) return false;
    e.hp -= n; e.flash = 1; e.hitCd = 0.25;
    G.audio.play('enemyHit', { pos: e.pos }); G.fx.burst(v1.copy(e.pos).y += 1, 0xffd27a, 8, 6);
    if (e.hp <= 0) { this.kill(e, P); return true; }
    e.state = 'stunned'; e.stunT = 0.5; v1.copy(e.pos).sub(P.pos).setY(0).normalize(); e.vel.copy(v1).multiplyScalar(8);
    return false;
  }
  kill(e, P) {
    e.dead = true; e.respawnT = 50; G.fx.explosion(v1.copy(e.pos).y += 0.8, 0xff9a3a, e.type === 'miniboss' ? 2 : 1); G.audio.play('explode', { pos: e.pos });
    if (e.robot) this.release(e);
    for (let i = 0; i < Math.min(8, e.T.rings); i++) G.level.addTempRing(e.pos, i);
    if (e.T.rings > 8) P.addRings(e.T.rings - 8);
    addXP(e.T.xp * (e.type === 'miniboss' ? 1 : 1)); G.save.stats.enemies++;
    G.hud.popup('+' + e.T.xp + ' XP', e.pos);
    bus.emit('enemyKilled', e);
    if (e.temp) this.list.splice(this.list.indexOf(e), 1);
  }
  damageRadius(p, R, P) { for (const e of this.list) if (!e.dead && e.robot && e.pos.distanceTo(p) < R + (e.robot.radius || 0.8)) this.damage(e, 2, P); }
  nearest(p, R) { let best = null, bd = R; for (const e of this.list) { if (e.dead || !e.robot) continue; const d = e.pos.distanceTo(p); if (d < bd) { bd = d; best = e; } } return best; }
  targets(list) {
    for (const e of this.list) {
      if (e.dead || !e.robot || (e.type === 'stealth' && e.cloak > 0.6)) continue;
      const wp = e.robot.weakPoint; const h = e.robot.height || 1.4;
      const t = e.__t || (e.__t = { pos: new THREE.Vector3(), yOff: 0, e, get dead() { return this.e.dead; }, hit: (pl, kind) => { if (e.type === 'shield' && !this.__behind(e, pl) && !(pl.boosting || pl.prism)) { G.audio.play('enemyHit', { pos: e.pos, pitch: 0.7 }); G.fx.burst(e.pos, 0x7fd8ff, 10, 5); return false; } return this.damage(e, this.__weak(e) ? 2 : 1, pl); } });
      if (wp) wp.getWorldPosition(t.pos); else t.pos.copy(e.pos).y += h * 0.55;
      list.push(t);
    }
  }
  __weak(e) { return !!(e.robot && e.robot.weakPoint); }
  __behind(e, pl) { v3.copy(pl.pos).sub(e.pos).setY(0).normalize(); return v3.dot(v2.set(Math.sin(e.yaw), 0, Math.cos(e.yaw))) < 0.3; }
  radar(out, R = 90) { out.length = 0; const P = G.player.pos; for (const e of this.list) if (!e.dead && e.pos.distanceTo(P) < R) out.push(e.pos); return out; }
}
