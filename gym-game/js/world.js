'use strict';
/*
 * Shared walkable world: player movement, equipment stations, NPC AI, collisions and camera.
 * GymWorld, IslandWorld and PlaceWorld build their own scenery on top of this.
 */

const MATTE_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.04 });
const METAL_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.35 });
const GLOW_MAT = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

/** Soft painted sky with clouds; tiles horizontally so it can scroll. */
function cloudSkyTexture(top = '#5da9ff', bottom = '#d9ecff', puffs = 26) {
  const tex = makeCanvasTexture(1024, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < puffs; i++) {
      const cx = Math.random() * w;
      const cy = h * (0.15 + Math.random() * 0.7);
      const s = rand(40, 110);
      for (let k = 0; k < 7; k++) {
        const px = cx + rand(-s, s) * 1.2;
        const py = cy + rand(-s, s) * 0.3;
        const r = s * rand(0.45, 0.8);
        for (const off of [-w, 0, w]) {
          const rg = ctx.createRadialGradient(px + off, py, 0, px + off, py, r);
          rg.addColorStop(0, 'rgba(255,255,255,0.95)');
          rg.addColorStop(0.6, 'rgba(255,255,255,0.55)');
          rg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.arc(px + off, py, r, 0, TAU);
          ctx.fill();
        }
      }
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** A puffy 3D cloud made of white spheres (one mesh). */
function cloudPuffGeometry(seed = 0) {
  const b = new Batch();
  const n = 5 + (seed % 4);
  for (let i = 0; i < n; i++) {
    const r = rand(0.7, 1.4);
    b.sphere(r, rand(-1.8, 1.8), rand(-0.2, 0.5), rand(-0.8, 0.8), i % 2 ? '#ffffff' : '#eef5ff', 0.75);
  }
  return mergeParts(b.parts, false);
}
const CLOUD_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: '#9fb4d6', emissiveIntensity: 0.35, flatShading: false });

/** Creates the player's character once; it moves between worlds. */
function createPlayer(outfit, level) {
  const ch = new Character(Object.assign({
    skin: '#e0ac69', hair: '#1b1b1b', accent: '#ffffff', shorts: '#111111', shoes: '#ffffff', socks: '#ffffff',
    style: 'tank', band: '#ffc23d', wrist: '#ffc23d', number: true,
  }, outfit, { muscle: muscleFor(level) }));
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 4), new THREE.MeshBasicMaterial({ color: '#ffc23d', toneMapped: false }));
  marker.rotation.x = Math.PI;
  marker.position.y = 2.35;
  ch.root.add(marker);
  const ringTex = makeCanvasTexture(256, 256, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, w * 0.28, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
    map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffc23d', toneMapped: false,
  }));
  ring.position.y = 0.03;
  ring.visible = false;
  ch.root.add(ring);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 3).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2ecc71', toneMapped: false, transparent: true, opacity: 0.9 }));
  arrow.visible = false;
  const player = { ch, marker, ring, arrow, vel: new THREE.Vector2(), mode: 'walk', hopTimer: 0.4, anchor: null, guide: null };
  setPlayerLevelLook(player, level);
  return player;
}

function setPlayerLevelLook(player, level) {
  player.ch.setMuscle(muscleFor(level));
  const tiers = [[100, '#7fe0ff'], [50, '#b07bff'], [20, '#ff4d6d'], [15, '#ffc23d'], [10, '#d9e2ff'], [5, '#e0915a']];
  const tier = tiers.find(([L]) => level >= L);
  player.ring.visible = !!tier;
  if (tier) player.ring.material.color.set(tier[1]);
}

class WorldBase {
  constructor({ bounds, track = null, spawn, background = '#141a28', fog = [48, 100] }) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(background);
    if (fog) this.scene.fog = new THREE.Fog(background, fog[0], fog[1]);
    this.bounds = bounds; // {rect: [x, z]} or {circle: r}
    this.track = track;
    this.spawn = spawn || { x: 0, z: 4, yaw: Math.PI };
    this.colliders = [];
    this.stations = [];
    this.npcs = [];
    this.time = 0;
    this.shake = 0;
    this.matte = new Batch();
    this.metal = new Batch();
    this.glow = new Batch();
    this.cam = { yaw: 0, pitch: 0.3, dist: 7.2, tx: 0, ty: 1.3, tz: 0 };
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 9, 20, 1, true), new THREE.MeshBasicMaterial({
      color: '#2ecc71', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    }));
    this.beacon.visible = false;
    this.scene.add(this.beacon);
  }

  finishBatches() {
    for (const [b, mat] of [[this.matte, MATTE_MAT], [this.metal, METAL_MAT], [this.glow, GLOW_MAT]]) {
      const mesh = b.build(mat);
      if (mesh) this.scene.add(mesh);
    }
    this.matte = this.metal = this.glow = null;
    this.fx = new Particles(this.scene, 700, 0.2);
  }

  addCollider(x1, z1, x2, z2) {
    this.colliders.push({ x1: Math.min(x1, x2), z1: Math.min(z1, z2), x2: Math.max(x1, x2), z2: Math.max(z1, z2) });
  }

  /**
   * A spot where someone exercises. equip marks a machine the player needs for a move;
   * approach is where people walk to before snapping onto the machine.
   */
  addStation(x, z, yaw, acts, opts = {}) {
    const s = Object.assign({ x, z, yaw, acts, occ: null, equip: null, ax: x, az: z, label: '' }, opts);
    this.stations.push(s);
    return s;
  }

  /* ---------------- entering ---------------- */

  enter(player, at) {
    this.player = player;
    const sp = at || this.spawn;
    player.ch.stopAction();
    player.anchor = null;
    player.guide = null;
    player.vel.set(0, 0);
    player.ch.root.position.set(sp.x, 0, sp.z);
    player.ch.root.rotation.y = sp.yaw;
    this.scene.add(player.ch.root);
    this.scene.add(player.arrow);
    player.ch.onEvent = (e, c) => this.onCharEvent(e, c, true);
    this.cam.yaw = sp.camYaw != null ? sp.camYaw : wrapAngle(sp.yaw + Math.PI);
    this.cam.tx = sp.x;
    this.cam.tz = sp.z;
    this.beacon.visible = false;
  }

  /* ---------------- NPCs ---------------- */

  spawnNpcs(names, saved, levelRange = [1, 9]) {
    for (let i = 0; i < names.length; i++) {
      const s = saved && saved[i];
      const level = s ? s.l : randi(levelRange[0], levelRange[1]);
      const n = {
        name: names[i], level, xp: s ? s.x : rand(0, xpNeed(level) * 0.8), rate: rand(0.35, 0.7),
        ch: new Character(Object.assign(randomOutfit(), { muscle: muscleFor(level) })),
        state: 'idle', timer: rand(0, 3), target: null, station: null, reps: 0,
        vel: new THREE.Vector2(), walk: rand(1.3, 2.0), stuckT: 0, lastPos: new THREE.Vector2(),
      };
      const pos = this.freeSpot();
      n.ch.root.position.set(pos.x, 0, pos.z);
      n.ch.root.rotation.y = rand(-Math.PI, Math.PI);
      n.ch.onEvent = (e, c) => this.onCharEvent(e, c, false);
      n.ch.setLabel(n.name, 'سطح ' + fa(n.level), '#7fe0ff');
      this.scene.add(n.ch.root);
      this.npcs.push(n);
    }
  }

  inBounds(x, z, m = 0) {
    if (this.bounds.circle) return Math.hypot(x, z) < this.bounds.circle - m;
    return Math.abs(x) < this.bounds.rect[0] - m && Math.abs(z) < this.bounds.rect[1] - m;
  }

  freeSpot() {
    for (let k = 0; k < 80; k++) {
      let p;
      if (this.bounds.circle) {
        const a = Math.random() * TAU;
        const r = Math.sqrt(Math.random()) * (this.bounds.circle - 2);
        p = { x: Math.cos(a) * r, z: Math.sin(a) * r };
      } else p = { x: rand(-this.bounds.rect[0] + 3, this.bounds.rect[0] - 3), z: rand(-this.bounds.rect[1] + 3, this.bounds.rect[1] - 3) };
      if (Math.hypot(p.x - this.spawn.x, p.z - this.spawn.z) < 2.5) continue;
      if (this.colliders.some((c) => p.x > c.x1 - 0.6 && p.x < c.x2 + 0.6 && p.z > c.z1 - 0.6 && p.z < c.z2 + 0.6)) continue;
      return p;
    }
    return { x: rand(-3, 3), z: rand(-3, 3) };
  }

  resolve(pos, r) {
    const B = this.bounds;
    if (B.circle) {
      const d = Math.hypot(pos.x, pos.z);
      const lim = B.circle - r;
      if (d > lim) { pos.x *= lim / d; pos.z *= lim / d; }
    } else {
      pos.x = clamp(pos.x, -B.rect[0] + r + 0.1, B.rect[0] - r - 0.1);
      pos.z = clamp(pos.z, -B.rect[1] + r + 0.1, B.rect[1] - r - 0.1);
    }
    for (const c of this.colliders) {
      const cx = clamp(pos.x, c.x1, c.x2);
      const cz = clamp(pos.z, c.z1, c.z2);
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * r;
        pos.z = cz + (dz / d) * r;
      } else {
        const pl = pos.x - c.x1;
        const pr = c.x2 - pos.x;
        const pt = pos.z - c.z1;
        const pb = c.z2 - pos.z;
        const mn = Math.min(pl, pr, pt, pb);
        if (mn === pl) pos.x = c.x1 - r;
        else if (mn === pr) pos.x = c.x2 + r;
        else if (mn === pt) pos.z = c.z1 - r;
        else pos.z = c.z2 + r;
      }
    }
  }

  onCharEvent(e, ch, isPlayer) {
    const p = ch.root.position;
    if (e === 'land' || e === 'hop') {
      if (e === 'land' || isPlayer) this.fx.dust(p, e === 'land' ? 16 : 6);
      if (isPlayer) {
        Sfx.play(e === 'land' ? 'land' : 'step');
        if (e === 'land') this.shake = Math.max(this.shake, 0.18);
      }
    } else if (!isPlayer) {
      return;
    } else if (e === 'jump' || e === 'whoosh') Sfx.play('whoosh');
    else if (e === 'punch') Sfx.play('punch');
    else if (e === 'drop') { Sfx.play('clank'); this.shake = Math.max(this.shake, 0.12); }
    else if (e === 'impact' && this.onImpact) this.onImpact();
    else if (e === 'splash') {
      Sfx.play('splash');
      this.fx.burst({ x: p.x, y: 0.2, z: p.z + 1 }, { count: 50, colors: ['#bfe9ff', '#ffffff'], speed: 2.5, up: 4, life: 1.0 });
    } else if (e === 'snow') this.fx.burst({ x: p.x, y: 0.1, z: p.z }, { count: 18, colors: ['#ffffff'], speed: 2.5, up: 1.5, life: 0.7 });
  }

  npcChoose(n) {
    this.leaveStation(n);
    const joggers = this.npcs.filter((o) => o.state === 'jog').length;
    if (this.track && Math.random() < 0.28 && joggers < 9) {
      n.state = 'jog';
      n.timer = rand(14, 35);
      n.lane = rand(0.35, 2.05);
      n.jogSpeed = rand(3.4, 4.6);
      n.hop = Math.random() < 0.3;
      n.hopT = rand(0.3, 1);
      return;
    }
    const free = this.stations.filter((s) => !s.occ && !(s.player));
    if (free.length && Math.random() < 0.85) {
      const s = pick(free);
      s.occ = n;
      n.station = s;
      n.target = { x: s.ax, z: s.az };
    } else {
      n.target = this.freeSpot();
    }
    n.state = 'walk';
    n.stuckT = 0;
    n.lastPos.set(n.ch.root.position.x, n.ch.root.position.z);
  }

  leaveStation(n) {
    const s = n.station;
    if (!s) return;
    if (n.anchored) {
      n.ch.stopAction();
      n.ch.root.position.set(s.ax, 0, s.az);
      n.anchored = false;
    }
    s.occ = null;
    n.station = null;
  }

  npcAction(n) {
    const lvl = n.level;
    const acts = (n.station ? n.station.acts : ['jack', 'pushup', 'squat', 'situp', 'backflip', 'jumpspin', 'rope']).filter((a) => {
      const mv = MOVE_BY_ID[a];
      return ANIMS[a] && (!mv || lvl >= mv.level || (n.station && n.station.custom));
    });
    return acts.length ? pick(acts) : pick(['pushup', 'jack']);
  }

  updateNpc(n, dt) {
    const ch = n.ch;
    const pos = ch.root.position;
    let dirX = 0;
    let dirZ = 0;
    let speed = 0;
    if (n.state === 'idle') {
      n.timer -= dt;
      if (n.timer <= 0) this.npcChoose(n);
    } else if (n.state === 'walk') {
      const dx = n.target.x - pos.x;
      const dz = n.target.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.35) {
        n.state = 'exercise';
        n.reps = n.station ? randi(1, 3) : randi(1, 2);
        n.faceT = n.station ? 0.4 : 0;
        if (n.station && (n.station.x !== n.station.ax || n.station.z !== n.station.az)) {
          pos.set(n.station.x, n.station.y || 0, n.station.z);
          n.anchored = true;
        }
      } else {
        dirX = dx / d;
        dirZ = dz / d;
        speed = Math.min(n.walk, d * 2 + 0.3);
        n.stuckT += dt;
        if (n.stuckT > 1.5) {
          const moved = Math.hypot(pos.x - n.lastPos.x, pos.z - n.lastPos.y);
          n.stuckT = 0;
          n.lastPos.set(pos.x, pos.z);
          if (moved < 0.4) {
            this.leaveStation(n);
            n.target = this.freeSpot();
          }
        }
      }
    } else if (n.state === 'jog') {
      const T = this.track;
      const A = T.a + n.lane;
      const Bb = T.b + n.lane;
      const th = Math.atan2((pos.z - T.cz) / Bb, (pos.x - T.cx) / A) + 0.4;
      const dx = T.cx + Math.cos(th) * A - pos.x;
      const dz = T.cz + Math.sin(th) * Bb - pos.z;
      const d = Math.hypot(dx, dz) || 1;
      dirX = dx / d;
      dirZ = dz / d;
      speed = n.jogSpeed;
      if (n.hop) {
        n.hopT -= dt;
        if (n.hopT <= 0 && ch.grounded) { ch.jump(5.2); n.hopT = rand(0.9, 1.3); }
      }
      n.timer -= dt;
      if (n.timer <= 0) { n.state = 'idle'; n.timer = rand(0.5, 2); }
    } else if (n.state === 'exercise') {
      if (n.faceT > 0 && n.station) {
        n.faceT -= dt;
        ch.root.rotation.y = angleLerp(ch.root.rotation.y, n.station.yaw, damp(8, dt));
      } else if (!ch.busy && ch.grounded) {
        if (n.reps > 0) {
          n.reps--;
          const a = this.npcAction(n);
          if (n.station) ch.root.rotation.y = n.station.yaw;
          ch.play(a, () => this.npcGain(n, a));
        } else {
          this.leaveStation(n);
          n.state = 'idle';
          n.timer = rand(0.4, 2.2);
        }
      }
    }

    if (speed > 0 && !ch.busy) {
      n.vel.x += (dirX * speed - n.vel.x) * damp(6, dt);
      n.vel.y += (dirZ * speed - n.vel.y) * damp(6, dt);
      ch.root.rotation.y = angleLerp(ch.root.rotation.y, Math.atan2(n.vel.x, n.vel.y), damp(8, dt));
    } else {
      n.vel.multiplyScalar(Math.max(0, 1 - 10 * dt));
    }
    if (!n.anchored) {
      pos.x += n.vel.x * dt;
      pos.z += n.vel.y * dt;
      this.rootMotion(ch, pos, dt);
      this.resolve(pos, 0.32);
    }
    ch.anchored = !!n.anchored;
    ch.speed = n.vel.length();
    ch.update(dt);
  }

  npcGain(n, act) {
    const mv = MOVE_BY_ID[act];
    n.xp += (mv ? mv.xp : 14) * n.rate * xpMult(n.level) * 0.5;
    let leveled = false;
    while (n.xp >= xpNeed(n.level)) {
      n.xp -= xpNeed(n.level);
      n.level++;
      leveled = true;
    }
    if (leveled) {
      n.ch.setLabel(n.name, 'سطح ' + fa(n.level), '#7fe0ff');
      n.ch.setMuscle(muscleFor(n.level));
      const p = n.ch.root.position;
      this.fx.ring({ x: p.x, y: 0.2, z: p.z }, { count: 24, color: '#7fe0ff', radius: 0.4, speed: 2.5, life: 0.6 });
    }
  }

  /* ---------------- player & equipment ---------------- */

  canAct() {
    const ch = this.player.ch;
    return !ch.busy && ch.grounded;
  }

  playerDo(anim, onDone) {
    const ch = this.player.ch;
    if (!this.canAct()) return false;
    this.player.vel.set(0, 0);
    ch.speed = 0;
    return ch.play(anim, onDone);
  }

  /** Nearest station matching the filter, with its distance from the player. */
  nearestStation(filter) {
    const p = this.player.ch.root.position;
    let best = null;
    let bd = Infinity;
    for (const s of this.stations) {
      if (!filter(s)) continue;
      const d = Math.min(Math.hypot(p.x - s.ax, p.z - s.az), Math.hypot(p.x - s.x, p.z - s.z));
      if (d < bd) { bd = d; best = s; }
    }
    return best ? { s: best, d: bd } : null;
  }

  /** Snap the player onto a station and play an animation there. */
  useStation(s, anim, onDone) {
    if (!this.canAct()) return false;
    const P = this.player;
    if (s.occ) {
      const n = s.occ;
      n.ch.stopAction();
      this.leaveStation(n);
      n.state = 'idle';
      n.timer = rand(0.5, 1.5);
    }
    s.player = true;
    P.anchor = s;
    P.guide = null;
    P.ch.root.position.set(s.x, s.y || 0, s.z);
    P.ch.root.rotation.y = s.yaw;
    P.vel.set(0, 0);
    const ok = P.ch.play(anim, (name) => {
      s.player = false;
      if (P.anchor === s) {
        P.anchor = null;
        P.ch.root.position.set(s.ax, 0, s.az);
      }
      if (onDone) onDone(name);
    });
    if (!ok) { s.player = false; P.anchor = null; }
    return ok;
  }

  /** Point a beacon and a floor arrow at a station for a while. */
  guideTo(s) {
    this.player.guide = { s, t: 14 };
    this.beacon.position.set(s.ax, 4.5, s.az);
    this.beacon.visible = true;
  }

  /* ---------------- frame ---------------- */

  update(dt, input, camera, stats) {
    this.time += dt;
    const P = this.player;
    const ch = P.ch;
    const pos = ch.root.position;
    const cy = this.cam.yaw;
    let mx = 0;
    let mz = 0;
    if (input.enabled) {
      mx = -Math.sin(cy) * -input.y + Math.cos(cy) * input.x;
      mz = -Math.cos(cy) * -input.y - Math.sin(cy) * input.x;
    }
    const mag = Math.min(1, Math.hypot(mx, mz));
    const running = P.mode !== 'walk' || input.run;
    const maxSpeed = running ? runSpeedFor(stats.runLevel) * (stats.speedMult || 1) : 2.5;
    let gained = 0;
    if (ch.busy || P.anchor) {
      P.vel.multiplyScalar(Math.max(0, 1 - 12 * dt));
    } else {
      const len = Math.hypot(mx, mz) || 1;
      const tx = mag > 0.05 ? (mx / len) * maxSpeed * mag : 0;
      const tz = mag > 0.05 ? (mz / len) * maxSpeed * mag : 0;
      const acc = ch.grounded ? 9 : 2.5;
      P.vel.x += (tx - P.vel.x) * damp(acc, dt);
      P.vel.y += (tz - P.vel.y) * damp(acc, dt);
      if (mag > 0.05) ch.root.rotation.y = angleLerp(ch.root.rotation.y, Math.atan2(mx, mz), damp(10, dt));
      if (input.jump && ch.grounded) { ch.jump(6); Sfx.play('whoosh'); }
      const moving = P.vel.length() > 1.2;
      if (P.mode === 'jumprun' && moving) {
        P.hopTimer -= dt;
        if (P.hopTimer <= 0 && ch.grounded) {
          ch.jump(6.2);
          Sfx.play('whoosh');
          P.hopTimer = 0.95;
        }
      } else P.hopTimer = 0.35;
      if (moving && P.mode !== 'walk') gained += RUN_XP_PER_SEC[P.mode] * dt * Math.min(1, P.vel.length() / 5.4);
    }
    if (P.anchor) {
      pos.set(P.anchor.x, P.anchor.y || 0, P.anchor.z);
    } else {
      pos.x += P.vel.x * dt;
      pos.z += P.vel.y * dt;
      this.rootMotion(ch, pos, dt);
      this.resolve(pos, 0.34);
      pos.y = 0;
    }
    this.metersRun = (this.metersRun || 0) + (P.anchor ? 0 : P.vel.length() * dt);
    ch.anchored = !!P.anchor;
    ch.speed = P.anchor ? 0 : P.vel.length();
    ch.update(dt);
    P.marker.position.y = 2.35 + Math.sin(this.time * 4) * 0.06 + ch.airY;
    P.marker.rotation.y += dt * 2;
    P.ring.material.opacity = 0.65 + 0.35 * Math.sin(this.time * 3);
    this.updateGuide(dt);

    for (const n of this.npcs) this.updateNpc(n, dt);
    this.separate();
    for (const n of this.npcs) {
      const d = n.ch.root.position.distanceTo(camera.position);
      if (n.ch.label) n.ch.label.visible = d > 3.2 && d < 19;
    }
    this.updateExtra(dt, stats);
    this.fx.update(dt);
    this.updateCamera(dt, camera);
    return gained;
  }

  updateExtra() {}

  /** Forward / sideways movement baked into an animation (flips, cartwheels). */
  rootMotion(ch, pos, dt) {
    const yaw = ch.root.rotation.y;
    if (ch.rootSpeed) {
      pos.x += Math.sin(yaw) * ch.rootSpeed * dt;
      pos.z += Math.cos(yaw) * ch.rootSpeed * dt;
    }
    if (ch.rootSide) {
      pos.x += Math.cos(yaw) * ch.rootSide * dt;
      pos.z -= Math.sin(yaw) * ch.rootSide * dt;
    }
  }

  updateGuide(dt) {
    const P = this.player;
    const g = P.guide;
    if (!g) {
      P.arrow.visible = false;
      this.beacon.visible = false;
      return;
    }
    g.t -= dt;
    const p = P.ch.root.position;
    const dx = g.s.ax - p.x;
    const dz = g.s.az - p.z;
    const d = Math.hypot(dx, dz);
    if (g.t <= 0 || d < 1.6) {
      P.guide = null;
      return;
    }
    P.arrow.visible = true;
    P.arrow.position.set(p.x + (dx / d) * 1.3, 0.25, p.z + (dz / d) * 1.3);
    P.arrow.rotation.y = Math.atan2(dx, dz);
    P.arrow.material.opacity = 0.6 + 0.35 * Math.sin(this.time * 8);
    this.beacon.material.opacity = 0.25 + 0.15 * Math.sin(this.time * 5);
  }

  separate() {
    const all = [this.player.ch, ...this.npcs.map((n) => n.ch)];
    const R = 0.62;
    for (let i = 0; i < all.length; i++) {
      const A = all[i];
      const a = A.root.position;
      for (let j = i + 1; j < all.length; j++) {
        const Bc = all[j];
        const b = Bc.root.position;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 >= R * R || d2 < 1e-6) continue;
        if (A.anchored && Bc.anchored) continue;
        const d = Math.sqrt(d2);
        const push = (R - d) / d;
        let wa = i === 0 ? 0.2 : 0.5;
        if (A.anchored) wa = 0;
        else if (Bc.anchored) wa = 1;
        const wb = 1 - wa;
        a.x -= dx * push * wa; a.z -= dz * push * wa;
        b.x += dx * push * wb; b.z += dz * push * wb;
      }
    }
    for (const c of all) if (!c.anchored) this.resolve(c.root.position, 0.32);
  }

  cameraLimits(x, y, z) {
    const B = this.bounds;
    if (B.rect) {
      x = clamp(x, -B.rect[0] + 0.6, B.rect[0] - 0.6);
      z = clamp(z, -B.rect[1] + 0.6, B.rect[1] - 0.6);
      y = clamp(y, 0.6, (this.ceiling || 30) - 0.8);
    } else y = Math.max(0.6, y);
    return [x, y, z];
  }

  updateCamera(dt, camera) {
    const c = this.cam;
    const ch = this.player.ch;
    const p = ch.root.position;
    const k = damp(8, dt);
    c.tx += (p.x - c.tx) * k;
    c.tz += (p.z - c.tz) * k;
    c.ty += (1.25 + ch.airY * 0.5 + Math.max(0, ch.cur.y) * 0.5 - c.ty) * k;
    const cp = Math.cos(c.pitch);
    const [x, y, z] = this.cameraLimits(
      c.tx + Math.sin(c.yaw) * cp * c.dist,
      c.ty + Math.sin(c.pitch) * c.dist + 0.5,
      c.tz + Math.cos(c.yaw) * cp * c.dist,
    );
    camera.position.set(x, y, z);
    if (this.shake > 0) {
      camera.position.x += rand(-1, 1) * this.shake * 0.3;
      camera.position.y += rand(-1, 1) * this.shake * 0.3;
      this.shake = Math.max(0, this.shake - dt * 1.2);
    }
    camera.lookAt(c.tx, c.ty, c.tz);
  }
}
