// Boss battles: Titan Walker, Magma Wyrm, Kraken Unit, Vex (rival chase + duel), Iron Regent (3-phase final).
// Health bars, phases, telegraphed attack patterns, weak points, defensive phases, intro / defeat cinematics,
// music transitions, arena destruction, difficulty, ratings and rematches.
import * as THREE from 'three';
import { G, bus } from './game.js';
import { clamp, lerp, damp, rng } from './util.js';
import { heightAt } from './world/terrain.js';
import { createBoss } from './robots.js';
import { createRig } from './characters.js';
import { ANCHORS } from './world/content.js';
import { addXP } from './progress.js';

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
export const BOSS_DEFS = {
  titan: { hp: 6, phases: 2, music: 'boss', arena: 'titan', radius: 90, reward: 800, xp: 600 },
  wyrm: { hp: 6, phases: 3, music: 'boss', arena: 'crater', radius: 80, reward: 1200, xp: 900 },
  kraken: { hp: 6, phases: 2, music: 'boss', arena: 'krakenArena', radius: 70, reward: 1200, xp: 900 },
  vex: { hp: 5, phases: 2, music: 'race', arena: 'vexArena', radius: 75, reward: 1000, xp: 800 },
  regent: { hp: 10, phases: 3, music: 'final', arena: 'fortress', radius: 110, reward: 5000, xp: 3000 },
};

class Hazards {
  constructor(scene) {
    this.scene = scene; this.list = [];
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    this.warnMat = new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.5, depthWrite: false });
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0xff3a5a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
  }
  shock(c, speed = 20, maxR = 42) { const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), this.ringMat); m.rotation.x = -Math.PI / 2; m.position.copy(c).y += 0.25; this.scene.add(m); this.list.push({ type: 'shock', m, c: c.clone(), r: 1, speed, maxR }); }
  missile(p, delay = 1.4, R = 4.5) { const m = new THREE.Mesh(new THREE.CircleGeometry(R, 32), this.warnMat.clone()); m.rotation.x = -Math.PI / 2; m.position.copy(p).y += 0.2; this.scene.add(m); this.list.push({ type: 'missile', m, p: p.clone(), t: delay, R }); G.audio.play('missileWarn', { pos: p, vol: 0.5 }); }
  beam(origin, len, y, speed, life = 4) { const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 0.5).translate(len / 2, 0, 0), this.beamMat); m.position.set(origin.x, y, origin.z); this.scene.add(m); this.list.push({ type: 'beam', m, o: origin.clone(), len, y, speed, t: life, a: Math.random() * 6.28 }); G.audio.play('laserCharge', { pos: origin }); }
  update(dt) {
    const P = G.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const h = this.list[i]; let done = false;
      if (h.type === 'shock') {
        h.r += h.speed * dt; h.m.scale.setScalar(h.r); h.m.material.opacity = 0.85 * (1 - h.r / h.maxR);
        const d = Math.hypot(P.pos.x - h.c.x, P.pos.z - h.c.z);
        if (Math.abs(d - h.r) < 1.1 && P.mode === 'ground' && Math.abs(P.pos.y - h.c.y) < 2) P.hurt(h.c, 'shock');
        done = h.r >= h.maxR;
      } else if (h.type === 'missile') {
        h.t -= dt; h.m.material.opacity = 0.25 + 0.35 * (Math.sin(h.t * 25) * 0.5 + 0.5);
        if (h.t <= 0) { G.fx.explosion(h.p, 0xff8a2a, 1.1); G.audio.play('explode', { pos: h.p }); if (P.pos.distanceTo(h.p) < h.R) P.hurt(h.p, 'missile'); done = true; }
      } else if (h.type === 'beam') {
        h.t -= dt; h.a += h.speed * dt; h.m.rotation.y = h.a; h.m.position.set(h.o.x, h.y, h.o.z);
        const dx = Math.cos(h.a), dz = -Math.sin(h.a); v1.set(P.pos.x - h.o.x, 0, P.pos.z - h.o.z); const along = v1.x * dx + v1.z * dz; const perp = Math.abs(-v1.x * dz + v1.z * dx);
        if (along > 0 && along < h.len && perp < 0.9 && Math.abs(P.pos.y + 0.5 - h.y) < 1.1) P.hurt(h.o, 'laser');
        done = h.t <= 0;
      }
      if (done) { this.scene.remove(h.m); h.m.geometry.dispose(); this.list.splice(i, 1); }
    }
  }
  clear() { for (const h of this.list) { this.scene.remove(h.m); h.m.geometry.dispose(); } this.list = []; }
}

export class Bosses {
  constructor(scene) { this.scene = scene; this.active = null; this.hz = new Hazards(scene); this.models = {}; }
  start(id, onEnd) {
    if (this.active) this.end(false);
    const def = BOSS_DEFS[id]; const diff = G.settings.gameplay.boss; const hpMul = diff === 'easy' ? 0.7 : diff === 'hard' ? 1.4 : 1;
    const center = ANCHORS[def.arena].clone();
    const b = { id, def, center, hp: Math.round(def.hp * hpMul), maxHp: Math.round(def.hp * hpMul), phase: 1, t: 0, st: 'intro', stT: 0, vulnerable: false, onEnd, hitsTaken: 0, startTime: G.time, focus: new THREE.Vector3(), atkRate: diff === 'easy' ? 0.75 : diff === 'hard' ? 1.3 : 1, pos: center.clone(), yaw: 0, s: { state: 'idle', t: 0 } };
    if (id === 'vex') { b.rig = createRig('vex', { quality: G.preset.charQ }); b.model = { root: b.rig.root, weakPoints: [], update: () => {}, setFlash: () => {} }; b.anim = { state: 'idle' }; b.pos.set(center.x + 30, heightAt(center.x + 30, center.z), center.z); b.vel = new THREE.Vector3(); }
    else { b.model = this.models[id] || (this.models[id] = createBoss(id, Math.min(0.9, G.preset.charQ))); }
    this.scene.add(b.model.root); b.model.root.visible = true; b.model.setPhase && b.model.setPhase(1);
    if (id === 'titan') b.pos.set(center.x, heightAt(center.x, center.z), center.z + 30);
    if (id === 'kraken') b.pos.set(center.x, -6, center.z);
    if (id === 'regent') { b.pos.set(center.x, center.y + 22, center.z); b.gens = []; const gens = b.model.parts.generators || []; gens.forEach((g, i) => { const a = i / gens.length * Math.PI * 2; g.position.set(center.x + Math.cos(a) * 38, center.y, center.z + Math.sin(a) * 38); if (g.parent !== this.scene) this.scene.attach ? this.scene.attach(g) : this.scene.add(g); g.visible = true; b.gens.push({ obj: g, alive: true, pos: new THREE.Vector3(center.x + Math.cos(a) * 38, center.y + 4, center.z + Math.sin(a) * 38) }); }); }
    if (id === 'wyrm') { b.ang = 0; b.headPos = new THREE.Vector3(center.x + 50, 125, center.z); if (b.model.head) { b.model.head.position.copy(b.headPos); b.model.snapChain && b.model.snapChain(); } }
    this.active = b; this.noHit = true;
    G.audio.music(def.music); G.hud.bossBar(id, 1, 1);
    // intro cinematic
    G.state = 'cutscene'; G.player.locked = true;
    G.hud.titleCard(G.ui ? 'boss_' + id : id, 'boss_' + id + '_sub');
    const camR = id === 'regent' || id === 'titan' ? 40 : 26; if (G.preset.dofCine) G.post.dof = { focus: camR, aperture: 0.0025, maxblur: 0.01 };
    G.cam.cinematic(b.pos.clone().add(new THREE.Vector3(0, id === 'regent' ? 0 : 6, 0)), camR, 10, 3.2, () => { G.state = 'play'; G.player.locked = false; b.st = 'fight'; b.stT = 0; if (G.state !== 'photo') G.post.dof = null; });
    G.audio.play('bossRoar');
    bus.emit('bossStart', id);
    return b;
  }
  end(won) {
    const b = this.active; if (!b) return;
    this.hz.clear(); this.active = null; G.hud.bossBar(null);
    if (b.rig) { this.scene.remove(b.rig.root); b.rig.dispose(); } else this.scene.remove(b.model.root);
    if (b.gens) b.gens.forEach((g) => (g.obj.visible = false));
    if (won) {
      const time = G.time - b.startTime; const rank = b.hitsTaken === 0 ? 'S' : b.hitsTaken <= 2 && time < 150 ? 'A' : b.hitsTaken <= 5 ? 'B' : 'C';
      const rec = G.save.bosses[b.id] || {}; const first = !rec.done;
      rec.done = true; rec.best = Math.min(rec.best || 1e9, time); rec.rank = better(rec.rank, rank); G.save.bosses[b.id] = rec;
      G.save.wallet += first ? b.def.reward : Math.round(b.def.reward * 0.25); addXP(first ? b.def.xp : b.def.xp * 0.3);
      G.save.stats.bosses = Object.values(G.save.bosses).filter((x) => x.done).length;
      if (b.hitsTaken === 0) G.save.flags.noHitBoss = 1;
      bus.emit('bossDefeated', { id: b.id, time, rank, first });
      b.onEnd && b.onEnd(true, { time, rank, first, reward: first ? b.def.reward : Math.round(b.def.reward * 0.25) });
    } else b.onEnd && b.onEnd(false);
    G.progress.tryUnlocks(); G.progress.checkAchievements();
  }
  damage(n = 1) {
    const b = this.active; if (!b || !b.vulnerable) return false;
    b.hp -= n; b.model.setFlash && b.model.setFlash(1); b.flash = 1; G.audio.play('bossHit'); G.cam.shake(0.4); G.fx.explosion(v1.copy(b.focus), 0xffffff, 0.8);
    b.vulnerable = false; b.st = 'recover'; b.stT = 0;
    const per = b.maxHp / b.def.phases; const ph = Math.min(b.def.phases, 1 + Math.floor((b.maxHp - b.hp) / per));
    if (ph !== b.phase && b.hp > 0) { b.phase = ph; b.model.setPhase && b.model.setPhase(ph); G.hud.toast('boss_phase', 'warn', { n: ph }); G.audio.play('bossRoar'); this.arenaDamage(b); }
    G.hud.bossBar(b.id, Math.max(0, b.hp / b.maxHp), b.phase);
    if (b.id === 'vex' && b.hp > 0) this.vexBlink(b);
    if (b.hp <= 0) this.defeat(b);
    return true;
  }
  arenaDamage(b) { for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28, d = 10 + Math.random() * 30; const p = v1.set(b.center.x + Math.cos(a) * d, 0, b.center.z + Math.sin(a) * d); p.y = b.id === 'wyrm' ? 108 : heightAt(p.x, p.z); G.fx.explosion(p, 0xff7a2a, 1.2); } G.cam.shake(0.6); }
  defeat(b) {
    b.st = 'dying'; b.stT = 0; b.vulnerable = false; this.hz.clear(); G.audio.music('victory'); G.audio.play('explode');
    G.timeScaleTarget = 0.35; G.player.invuln = 5;
  }
  targets(list) {
    const b = this.active; if (!b || b.st !== 'fight') return;
    if (b.id === 'regent' && b.phase === 1) { for (const g of b.gens) if (g.alive) list.push(g.__t || (g.__t = { pos: g.pos, yOff: 0, get dead() { return !g.alive; }, hit: () => this.genHit(b, g) })); return; }
    if (!b.vulnerable) return;
    const wp = (b.model.weakPoints && b.model.weakPoints[0]) || null;
    if (wp) wp.getWorldPosition(b.focus); else if (b.rig) b.focus.copy(b.pos).y += 0.8;
    list.push(b.__t || (b.__t = { pos: b.focus, yOff: 0, dead: false, hit: () => this.damage(1) }));
  }
  genHit(b, g) {
    if (!g.alive) return false; g.alive = false; g.obj.visible = false; G.fx.explosion(g.pos, 0x6af0ff, 1.5); G.audio.play('explode', { pos: g.pos });
    if (b.gens.every((x) => !x.alive)) { b.hp = Math.min(b.hp, Math.round(b.maxHp * 2 / 3)); b.phase = 2; b.model.setPhase && b.model.setPhase(2); G.hud.bossBar(b.id, b.hp / b.maxHp, 2); G.hud.toast('boss_shield_down', 'good'); G.audio.play('bossRoar'); }
    return true;
  }
  checkPlayer(P) {
    const b = this.active; if (!b || b.st !== 'fight') return;
    // body contact
    let R = 0, c = v1;
    if (b.id === 'titan') { c.copy(b.pos).y += 3; R = 4; }
    else if (b.id === 'wyrm') { c.copy(b.headPos); R = 2.6; }
    else if (b.id === 'vex') { c.copy(b.pos).y += 0.7; R = 1.1; if (P.pos.distanceTo(b.pos) < 1.8) { if (P.isAttacking() && b.st === 'fight' && b.mode !== 'dash') { b.vulnerable = true; this.damage(1); P.bounceOff(); } else if (b.mode === 'dash') P.hurt(b.pos, 'vex'); } return; }
    else if (b.id === 'regent') { c.copy(b.pos); R = 6; }
    else if (b.id === 'kraken') { c.copy(b.pos).y += 3; R = 4.5; }
    if (R && P.pos.distanceTo(c) < R && !(b.vulnerable && P.isAttacking())) P.hurt(c, 'boss');
    // arena leash
    const d = Math.hypot(P.pos.x - b.center.x, P.pos.z - b.center.z);
    if (d > b.def.radius * 1.5) { b.leash = (b.leash || 0) + 1 / 120; if (b.leash > 6) { G.hud.toast('boss_left', 'warn'); this.end(false); } } else b.leash = 0;
  }
  update(dt) {
    this.hz.update(dt);
    const b = this.active; if (!b) return;
    const P = G.player; b.t += dt; b.stT += dt; b.flash = Math.max(0, (b.flash || 0) - dt * 3); b.model.setFlash && b.model.setFlash(b.flash);
    if (P.hurtT > 0.5 && !b._hurtFlag) { b.hitsTaken++; b._hurtFlag = true; } if (P.hurtT <= 0) b._hurtFlag = false;
    if (b.st === 'dying') {
      if (Math.random() < 0.3) G.fx.explosion(v1.copy(b.pos).add(v2.set((Math.random() - 0.5) * 8, Math.random() * 8, (Math.random() - 0.5) * 8)), 0xff9a3a, 1);
      b.s.state = 'dying'; b.s.t = b.stT; b.model.update(dt, b.s);
      if (b.rig) { b.anim.state = 'defeat'; b.rig.update(dt, b.anim); }
      if (b.stT > 3.5) { G.timeScaleTarget = 1; this.end(true); P.celebrate('victory', 3); }
      return;
    }
    if (b.st === 'intro') { this.pose(b, dt); return; }
    const rate = b.atkRate * (1 + (b.phase - 1) * 0.25);
    this[b.id](b, dt, P, rate);
    this.pose(b, dt);
  }
  pose(b, dt) {
    if (b.rig) { b.rig.root.position.copy(b.pos); b.rig.root.rotation.y = b.yaw; b.rig.update(dt, b.anim); return; }
    if (b.id !== 'wyrm') { b.model.root.position.copy(b.pos); b.model.root.rotation.y = b.yaw; }
    b.s.t = b.stT; b.model.update(dt, b.s);
    const wp = b.model.weakPoints && b.model.weakPoints[0]; if (wp) wp.getWorldPosition(b.focus); else b.focus.copy(b.pos);
  }
  faceP(b, P, k = 2, dt = 0.016) { const a = Math.atan2(P.pos.x - b.pos.x, P.pos.z - b.pos.z); let d = a - b.yaw; while (d > Math.PI) d -= 6.283; while (d < -Math.PI) d += 6.283; b.yaw += d * Math.min(1, k * dt); }

  // ---------------------------------------------------------------- Titan Walker
  titan(b, dt, P, rate) {
    const s = b.s;
    switch (b.st) {
      case 'fight': case 'recover': {
        s.state = 'walk'; s.coreOpen = damp(s.coreOpen || 0, 0, 3, dt); this.faceP(b, P, 1.2, dt);
        v1.copy(P.pos).sub(b.pos).setY(0); const d = v1.length();
        if (d > 18) { b.pos.addScaledVector(v1.normalize(), 3.2 * dt); b.pos.y = heightAt(b.pos.x, b.pos.z); }
        if (b.stT > 3.2 / rate) { const r = Math.random(); b.st = r < 0.45 ? 'stomp' : r < 0.8 ? 'missiles' : (b.phase >= 2 ? 'laser' : 'stomp'); b.stT = 0; }
        break;
      }
      case 'stomp': s.state = 'stomp'; if (b.stT > 0.8 && !b.did) { b.did = true; this.hz.shock(b.pos, 22); if (b.phase >= 2) setTimeout(() => this.active === b && this.hz.shock(b.pos, 16), 500); G.audio.play('stomp'); G.cam.shake(0.6); }
        if (b.stT > 1.4) { b.did = false; b.st = 'stunned'; b.stT = 0; } break;
      case 'missiles': s.state = 'missiles'; if (!b.did) { b.did = true; const n = 5 + b.phase * 2; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = Math.random() * 12; const p = v1.set(P.pos.x + Math.cos(a) * r, 0, P.pos.z + Math.sin(a) * r); p.y = heightAt(p.x, p.z); this.hz.missile(p, 1.2 + i * 0.15); } G.audio.play('shot', { pos: b.pos }); }
        if (b.stT > 2.6) { b.did = false; b.st = 'fight'; b.stT = 0; } break;
      case 'laser': s.state = 'laser'; if (!b.did) { b.did = true; this.hz.beam(b.pos, 45, b.pos.y + 1.0, 0.9 * rate, 5); } if (b.stT > 5) { b.did = false; b.st = 'stunned'; b.stT = 0; } break;
      case 'stunned': s.state = 'stunned'; s.coreOpen = damp(s.coreOpen || 0, 1, 5, dt); b.vulnerable = b.stT > 0.4 && b.stT < 3.6; if (b.stT > 3.8) { b.vulnerable = false; b.st = 'fight'; b.stT = 0; } break;
    }
    if (b.st === 'recover') { b.vulnerable = false; if (b.stT > 1) b.st = 'fight'; }
  }
  // ---------------------------------------------------------------- Magma Wyrm
  wyrm(b, dt, P, rate) {
    const c = b.center, s = b.s; const h = b.model.head;
    if (b.st === 'fight' || b.st === 'recover') {
      b.ang += dt * 0.45 * rate; const r = 52 + Math.sin(b.t * 0.7) * 8;
      v1.set(c.x + Math.cos(b.ang) * r, 124 + Math.sin(b.t * 1.3) * 6, c.z + Math.sin(b.ang) * r);
      b.headPos.lerp(v1, 1 - Math.exp(-2 * dt)); s.mouthOpen = damp(s.mouthOpen || 0, 0, 4, dt); s.telegraph = 0; b.vulnerable = false;
      if (b.stT > 4 / rate) { b.st = Math.random() < 0.5 ? 'breath' : 'dive'; b.stT = 0; b.diveFrom = b.headPos.clone(); b.diveTo = P.pos.clone(); }
    } else if (b.st === 'breath') {
      s.telegraph = clamp(b.stT / 1.0, 0, 1); s.mouthOpen = s.telegraph;
      if (b.stT > 1 && b.stT < 2.2) { if (Math.random() < 0.5) { v2.copy(P.pos).y += 0.6; v2.sub(b.headPos).normalize().multiplyScalar(30).add(v3.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4)); G.enemies.fire(b.headPos, v2); } }
      if (b.stT > 2.4) { b.st = 'fight'; b.stT = 0; }
    } else if (b.st === 'dive') {
      const k = clamp(b.stT / 2.2, 0, 1); v1.lerpVectors(b.diveFrom, b.diveTo, k); v1.y = lerp(b.diveFrom.y, 110.5, Math.sin(k * Math.PI * 0.5)); b.headPos.copy(v1);
      s.mouthOpen = 0.6; b.vulnerable = k > 0.75;
      if (k >= 1) { b.st = 'stuck'; b.stT = 0; G.fx.explosion(b.headPos, 0xff7a2a, 1.5); G.cam.shake(0.5); this.hz.shock(v1.copy(b.headPos).setY(108), 18, 30); }
    } else if (b.st === 'stuck') { b.vulnerable = true; s.mouthOpen = 0.2; if (b.stT > 3) { b.vulnerable = false; b.st = 'fight'; b.stT = 0; } }
    if (b.st === 'recover') { b.vulnerable = false; if (b.stT > 1) b.st = 'fight'; }
    if (h) { const prev = h.position.clone(); h.position.copy(b.headPos); v2.copy(b.headPos).sub(prev); if (v2.lengthSq() > 1e-4) h.lookAt(v3.copy(b.headPos).add(v2)); }
    b.pos.copy(b.headPos);
  }
  // ---------------------------------------------------------------- Kraken Unit
  kraken(b, dt, P, rate) {
    const s = b.s; this.faceP(b, P, 1, dt);
    b.pos.y = damp(b.pos.y, b.st === 'stunned' ? -0.4 : 0.2, 2, dt);
    if (b.st === 'fight' || b.st === 'recover') { s.state = 'idle'; b.vulnerable = false; if (b.stT > 3 / rate) { b.st = Math.random() < 0.55 ? 'swipe' : 'ink'; b.stT = 0; b.did = false; } }
    else if (b.st === 'swipe') { s.state = 'swipe'; s.telegraph = clamp(b.stT / 1.1, 0, 1); if (b.stT > 1.1 && !b.did) { b.did = true; this.hz.shock(v1.copy(b.pos).setY(1.2), 18, 46); G.audio.play('stomp'); G.cam.shake(0.4); } if (b.stT > 1.8) { b.st = 'stunned'; b.stT = 0; } }
    else if (b.st === 'ink') { s.state = 'ink'; if (b.stT > 0.6 && b.stT < 2 && Math.random() < 0.25) { v2.copy(P.pos).sub(b.pos).normalize().multiplyScalar(22); v2.y += 6; G.enemies.fire(v1.copy(b.pos).y += 4, v2); } if (b.stT > 2.4) { b.st = 'fight'; b.stT = 0; } }
    else if (b.st === 'stunned') { s.state = 'stunned'; b.vulnerable = b.stT > 0.3 && b.stT < 3.2; if (b.stT > 3.4) { b.vulnerable = false; b.st = 'fight'; b.stT = 0; } }
    if (b.st === 'recover' && b.stT > 1) b.st = 'fight';
  }
  // ---------------------------------------------------------------- Vex: chase then duel
  vex(b, dt, P, rate) {
    const a = b.anim; const c = b.center;
    if (b.st === 'recover' && b.stT > 0.8) { b.st = 'fight'; b.stT = 0; }
    if (b.phase === 1) {
      // chase sequence: Vex runs a circuit; catch him and hit him
      b.ang = (b.ang || 0) + dt * (P.boosting ? 0.42 : 0.5) * rate * 0.9;
      const r = 55; v1.set(c.x + Math.cos(b.ang) * r, 0, c.z + Math.sin(b.ang) * r); v1.y = heightAt(v1.x, v1.z);
      v2.copy(v1).sub(b.pos); b.yaw = Math.atan2(v2.x, v2.z); b.pos.copy(v1);
      a.state = 'sprint'; a.speed = 30; a.speedNorm = 1; b.mode = 'run'; b.vulnerable = true;
      if (Math.random() < 0.01 * rate) { v2.copy(P.pos).sub(b.pos).normalize().multiplyScalar(30); G.enemies.fire(v3.copy(b.pos).y += 1, v2); }
    } else {
      const d = b.pos.distanceTo(P.pos);
      if (b.mode === 'dash') { b.pos.addScaledVector(b.vel, dt); b.pos.y = heightAt(b.pos.x, b.pos.z); a.state = 'ball'; if (b.stT > 0.7) { b.mode = 'idle'; b.stT = 0; } }
      else if (b.mode === 'tele') { a.state = 'spindash'; a.charge = clamp(b.stT / 0.8, 0, 1); if (b.stT > 0.8) { b.mode = 'dash'; b.stT = 0; b.vel.copy(P.pos).sub(b.pos).setY(0).normalize().multiplyScalar(42); G.audio.play('spinRelease'); } }
      else { this.faceP(b, P, 4, dt); a.state = d > 3 ? 'run' : 'idle'; a.speed = 12; a.speedNorm = 0.5; v2.copy(P.pos).sub(b.pos).setY(0); if (d > 12) b.pos.addScaledVector(v2.normalize(), 12 * dt); b.pos.y = heightAt(b.pos.x, b.pos.z);
        b.vulnerable = true; if (b.stT > 2.2 / rate) { b.mode = Math.random() < 0.7 ? 'tele' : 'spear'; b.stT = 0; if (b.mode === 'spear') { for (let i = -1; i <= 1; i++) { v2.copy(P.pos).sub(b.pos).normalize(); v2.applyAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.25).multiplyScalar(28); G.enemies.fire(v3.copy(b.pos).y += 1, v2); } G.audio.play('laserShot'); b.mode = 'idle'; } } }
    }
    b.focus.copy(b.pos).y += 0.8;
  }
  vexBlink(b) { G.fx.burst(b.pos, 0xb06bff, 18, 6); G.audio.play('teleport'); const a = Math.random() * 6.28; b.pos.set(b.center.x + Math.cos(a) * 25, 0, b.center.z + Math.sin(a) * 25); b.pos.y = heightAt(b.pos.x, b.pos.z); b.mode = 'idle'; b.stT = 0; }
  // ---------------------------------------------------------------- Iron Regent (final)
  regent(b, dt, P, rate) {
    const s = b.s; const c = b.center;
    b.yaw += dt * 0.3;
    if (b.phase === 1) {
      s.shield = 1; s.armorOpen = 0; b.vulnerable = false; b.pos.y = damp(b.pos.y, c.y + 22, 1, dt);
      if (b.stT > 2.4 / rate) { b.stT = 0; const muz = b.model.parts.cannonMuzzles || []; for (let i = 0; i < 4; i++) { const m = muz[i]; if (m) m.getWorldPosition(v1); else v1.copy(b.pos); v2.copy(P.pos).y += 0.7; v2.sub(v1).normalize().multiplyScalar(24); G.enemies.fire(v1, v2); } G.audio.play('shot', { pos: b.pos }); if (Math.random() < 0.4) this.hz.shock(v1.set(c.x, c.y, c.z), 18, 60); }
      return;
    }
    s.shield = damp(s.shield || 0, 0, 2, dt);
    if (b.st === 'fight' || b.st === 'recover') {
      s.armorOpen = damp(s.armorOpen || 0, 0, 3, dt); b.vulnerable = false; b.pos.y = damp(b.pos.y, c.y + (b.phase === 3 ? 7 : 14), 1, dt);
      if (b.stT > 3 / rate) { const r = Math.random(); b.st = r < 0.35 ? 'laser' : r < 0.7 ? 'missiles' : 'slam'; b.stT = 0; b.did = false; }
    } else if (b.st === 'laser') { s.telegraph = clamp(b.stT, 0, 1); if (!b.did && b.stT > 0.8) { b.did = true; this.hz.beam(v1.set(c.x, c.y, c.z), 60, c.y + 1, 0.8 * rate, 5); if (b.phase === 3) { const bb = this.hz.list[this.hz.list.length - 1]; this.hz.beam(v1.set(c.x, c.y, c.z), 60, c.y + 1, 0.8 * rate, 5); this.hz.list[this.hz.list.length - 1].a = bb.a + Math.PI; } } if (b.stT > 5.5) { b.st = 'open'; b.stT = 0; } }
    else if (b.st === 'missiles') { if (!b.did) { b.did = true; const n = 6 + b.phase * 3; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = Math.random() * 16; const p = v1.set(P.pos.x + Math.cos(a) * r, c.y, P.pos.z + Math.sin(a) * r); this.hz.missile(p, 1.1 + i * 0.12, 5); } } if (b.stT > 3) { b.st = 'open'; b.stT = 0; } }
    else if (b.st === 'slam') { b.pos.y = damp(b.pos.y, c.y + 5, 4, dt); if (!b.did && b.stT > 1) { b.did = true; this.hz.shock(v1.set(c.x, c.y, c.z), 22, 70); G.cam.shake(0.7); G.audio.play('stomp'); } if (b.stT > 1.6) { b.st = 'open'; b.stT = 0; } }
    else if (b.st === 'open') { s.armorOpen = damp(s.armorOpen || 0, 1, 5, dt); b.pos.y = damp(b.pos.y, c.y + 5, 3, dt); b.vulnerable = b.stT > 0.4 && b.stT < 3.4; if (b.stT > 3.6) { b.vulnerable = false; b.st = 'fight'; b.stT = 0; } }
    if (b.st === 'recover' && b.stT > 1) b.st = 'fight';
  }
}
function better(a, b) { const o = ['S', 'A', 'B', 'C']; if (!a) return b; return o.indexOf(b) < o.indexOf(a) ? b : a; }
