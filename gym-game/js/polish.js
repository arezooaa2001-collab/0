'use strict';
/*
 * Round fourteen: the look and feel. Faces that blink and react, heads that turn to look at
 * you, a squash on landing, dust from feet, sweat while you work, reflections on metal,
 * dust motes in the air, windows with light falling in along the long gym walls and a soft
 * vignette. Everything extra is skipped on the light "Go" graphics preset.
 */

const FACE_LID_GEO = new Map();
const FACE_MOUTH_GEO = (() => {
  const b = new Batch();
  b.add(UnitGeo.sphere(10, 8), 0, 0, 0, '#3e0f12', 0, 0, 0, 1, 1, 1);
  b.add(UnitGeo.sphere(8, 6), 0, -0.45, 0.25, '#d65a6a', 0, 0, 0, 0.6, 0.4, 0.6);
  return mergeParts(b.parts, false);
})();
const CHEER_ACTS = new Set(['e_laugh', 'e_victory', 'e_dance', 'e_clap', 'fanclap', 'e_guitar', 'e_chicken', 'e_floss', 'e_dab', 'e_shuffle', 'e_moon', 'e_heart', 'cheer', 'highfive', 'e_hero', 'e_windmill']);
const SHINE_SEEN = new WeakSet();
const SHINE_LIST = [];
const _pv = new THREE.Vector3();
const _pv2 = new THREE.Vector3();

function lidGeo(skin) {
  let g = FACE_LID_GEO.get(skin);
  if (!g) {
    const b = new Batch();
    for (const ex of [0.043, -0.043]) b.add(UnitGeo.sphere(10, 8), ex, 0, 0, skin, 0, 0, 0, 0.029, 0.028, 0.0215);
    g = mergeParts(b.parts, false);
    FACE_LID_GEO.set(skin, g);
  }
  return g;
}

/** Is this character drawn close enough to the camera to bother with its face? */
function nearCam(ch, d) {
  const cam = Game.camera;
  if (!cam || !ch.root.parent) return false;
  const p = ch.root.position;
  const c = cam.position;
  return (p.x - c.x) ** 2 + (p.z - c.z) ** 2 < d * d;
}

Object.assign(Character.prototype, {
  ensureFace() {
    if (this.face) return this.face;
    const lids = new THREE.Mesh(lidGeo(this.o.skin), MATTE_MAT);
    lids.position.set(0, 0.186, 0.113);
    lids.visible = false;
    const mouth = new THREE.Mesh(FACE_MOUTH_GEO, MATTE_MAT);
    mouth.position.set(0, 0.116, 0.121);
    mouth.scale.set(0.022, 0.0001, 0.012);
    mouth.visible = false;
    for (const m of [lids, mouth]) { m.userData.noSolid = true; m.frustumCulled = false; this.B.head.add(m); }
    this.face = { lids, mouth, blinkT: rand(1, 4), blink: 0, lid: 0, open: 0 };
    return this.face;
  },

  /** Blinks, squints while straining, an open mouth when flying, falling or cheering. */
  updateFace(dt) {
    const F = this.ensureFace();
    F.blinkT -= dt;
    if (F.blinkT <= 0) { F.blinkT = rand(1.8, 5.5); F.blink = 0.14; }
    if (F.blink > 0) F.blink -= dt;
    const act = this.action && this.action.name;
    let lid = 0, open = 0;
    if (act === 'knock') {
      const t = this.actionT / 2.8;
      lid = t > 0.15 && t < 0.7 ? 1 : 0.3;
      open = t < 0.5 ? 0.9 : 0.3;
    } else if (!this.grounded && Math.abs(this.vy) > 2.5 && !this.manual) {
      open = 0.85; lid = 0;
    } else if (act && CHEER_ACTS.has(act)) {
      open = 0.55 + 0.25 * Math.abs(Math.sin(this.time * 7)); lid = 0.25;
    } else if (act && MOVE_BY_ID[act] && !MOVE_BY_ID[act].emote) {
      // working hard: squinting, teeth showing on every push
      lid = 0.45;
      open = 0.18 + 0.22 * Math.max(0, Math.sin(this.actionT * 6));
    } else if (this.speed > 4.5) {
      open = 0.35; lid = 0.15;
    }
    if (F.blink > 0) lid = 1;
    F.lid += (lid - F.lid) * damp(F.blink > 0 ? 40 : 12, dt);
    F.open += (open - F.open) * damp(10, dt);
    const k = F.lid;
    F.lids.visible = k > 0.04;
    if (F.lids.visible) {
      F.lids.scale.set(1, Math.max(0.05, k), 1);
      F.lids.position.y = 0.186 + (1 - k) * 0.026;
    }
    F.mouth.visible = F.open > 0.04;
    if (F.mouth.visible) F.mouth.scale.set(0.02 + 0.006 * F.open, 0.004 + 0.018 * F.open, 0.012);
  },

  hideFace() {
    if (!this.face) return;
    this.face.lids.visible = false;
    this.face.mouth.visible = false;
  },
});

const _charUpdatePolish = Character.prototype.update;
Character.prototype.update = function (dt) {
  const wasGrounded = this.grounded;
  const vy0 = this.vy;
  const phase0 = this.phase;
  _charUpdatePolish.call(this, dt);
  if (!Game.polishOn || !(dt > 0)) { if (this.face) this.hideFace(); return; }
  const near = nearCam(this, 26);
  if (near && !this.noFace && !this.mesh.material.transparent) this.updateFace(dt); else this.hideFace();
  const B = this.B;
  // turning the head to look at someone (set from outside as lookAtP)
  let want = 0, pitch = 0;
  const L = this.lookAtP;
  if (L && !this.action && !this.manual) {
    const p = this.root.position;
    const yaw = Math.atan2(L.x - p.x, L.z - p.z) - this.root.rotation.y - this.cur.by - this.cur.spY;
    want = clamp(wrapAngle(yaw), -1.05, 1.05);
    if (Math.abs(wrapAngle(yaw)) > 1.9) want = 0; // right behind: don't twist round
    const d = Math.hypot(L.x - p.x, L.z - p.z);
    pitch = clamp(-Math.atan2((L.y || 1.6) - (1.6 * this.root.scale.y + this.airY), Math.max(0.5, d)), -0.5, 0.5);
  }
  this.lookY = (this.lookY || 0) + (want - (this.lookY || 0)) * damp(5, dt);
  this.lookP = (this.lookP || 0) + (pitch - (this.lookP || 0)) * damp(5, dt);
  if (Math.abs(this.lookY) > 0.002 || Math.abs(this.lookP) > 0.002) {
    B.head.rotation.y += this.lookY;
    B.head.rotation.x += this.lookP;
  }
  // landing: knees give a little, more after a big fall
  if (!wasGrounded && this.grounded) {
    const v = Math.abs(vy0) + (this.grav || 20) * dt;
    if (v > 3.5) {
      this.squash = Math.min(1, v / 13);
      if (near && Game.world && Game.world.fx && this.root.parent === Game.world.scene) {
        const p = this.root.position;
        Game.world.fx.ring({ x: p.x, y: 0.08, z: p.z }, { count: Math.round(10 + 16 * this.squash), color: '#d8cbb4', radius: 0.25, speed: 1.6 + 2.5 * this.squash, life: 0.45 });
      }
    }
  }
  if (this.squash > 0) {
    const k = Math.sin(Math.min(1, this.squash) * Math.PI * 0.5);
    B.knL.rotation.x += 0.7 * k; B.knR.rotation.x += 0.7 * k;
    B.hpL.rotation.x -= 0.5 * k; B.hpR.rotation.x -= 0.5 * k;
    B.anL.rotation.x -= 0.2 * k; B.anR.rotation.x -= 0.2 * k;
    B.body.position.y -= 0.1 * k;
    B.spine.rotation.x += 0.18 * k;
    this.squash -= dt * 4.5;
  }
  if (!near || this.root.parent !== (Game.world && Game.world.scene)) return;
  const fx = Game.world.fx;
  if (!fx) return;
  // a puff of dust on every running footfall
  if (this.grounded && !this.action && this.runBlend > 0.45 && this.speed > 4 && Math.floor(phase0 / Math.PI) !== Math.floor(this.phase / Math.PI)) {
    const p = this.root.position;
    const yaw = this.root.rotation.y;
    const side = Math.floor(this.phase / Math.PI) % 2 ? 1 : -1;
    const fxp = p.x + Math.cos(yaw) * 0.11 * side, fzp = p.z - Math.sin(yaw) * 0.11 * side;
    for (let i = 0; i < 2; i++) fx.emit(fxp + rand(-0.08, 0.08), 0.05, fzp + rand(-0.08, 0.08), rand(-0.4, 0.4) - Math.sin(yaw) * 0.6, rand(0.3, 0.8), rand(-0.4, 0.4) - Math.cos(yaw) * 0.6, POLISH_DUST, 0.45, 0.5);
  }
  // sweat while working
  const act = this.action && this.action.name;
  if (act && this.actionT > 0.8 && MOVE_BY_ID[act] && !MOVE_BY_ID[act].emote && Math.random() < dt * 1.6) {
    this.root.updateMatrixWorld(true);
    B.head.getWorldPosition(_pv);
    const a = rand(0, TAU);
    fx.emit(_pv.x + Math.cos(a) * 0.1, _pv.y + 0.12, _pv.z + Math.sin(a) * 0.1, Math.cos(a) * 0.5, rand(0.6, 1.2), Math.sin(a) * 0.5, POLISH_SWEAT, 0.6, 7);
  }
};
const POLISH_DUST = new THREE.Color('#cdbfa6');
const POLISH_SWEAT = new THREE.Color('#9fe3ff');

Object.assign(Game, {
  /* ---------- reflections ---------- */

  /** A soft studio-like room baked into a reflection map (ceiling lights, warm floor). */
  makeEnv() {
    if (this.envTex !== undefined) return this.envTex;
    this.envTex = null;
    try {
      const pm = new THREE.PMREMGenerator(this.renderer);
      const sc = new THREE.Scene();
      const room = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({
        side: THREE.BackSide,
        map: makeCanvasTexture(16, 256, (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#f4f6ff'); g.addColorStop(0.35, '#a9b6d6'); g.addColorStop(0.52, '#6a7390');
          g.addColorStop(0.6, '#6b4a2e'); g.addColorStop(1, '#2a1d12');
          ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        }),
      }));
      sc.add(room);
      const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.9, 2.6) });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.8), lamp);
        m.position.set(Math.cos(a) * 6, 6.5, Math.sin(a) * 6);
        m.lookAt(0, 0, 0);
        sc.add(m);
      }
      this.envTex = pm.fromScene(sc, 0.03).texture;
      pm.dispose();
      sc.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    } catch (e) {
      this.envTex = null;
    }
    return this.envTex;
  },

  /** Metal and polished things in a world pick up the reflection map. */
  shineWorld(w) {
    if (!w || !w.scene || !this.polishOn) return;
    const env = this.makeEnv();
    if (!env) return;
    w.scene.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m || !m.isMeshStandardMaterial || SHINE_SEEN.has(m)) continue;
        SHINE_SEEN.add(m);
        if (m.envMap) continue;
        let k = 0;
        if (m.metalness >= 0.3) k = 0.9;
        else if (m.roughness <= 0.4) k = 0.45;
        else if (m.roughness <= 0.6 && m.map) k = 0.22; // polished wood floors and courts
        if (!k) continue;
        m.envMap = env;
        m.envMapIntensity = k;
        m.needsUpdate = true;
        SHINE_LIST.push(m);
      }
    });
  },

  setShine(on) {
    for (const m of SHINE_LIST) {
      const want = on ? this.envTex : null;
      if (m.envMap !== want) { m.envMap = want; m.needsUpdate = true; }
    }
  },

  /* ---------- dust motes floating in the light ---------- */

  ensureMotes() {
    if (this.motes) return this.motes;
    const N = 260;
    const pos = new Float32Array(N * 3);
    const vel = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = rand(-14, 14); pos[i * 3 + 1] = rand(0.3, 8); pos[i * 3 + 2] = rand(-14, 14);
      vel[i * 3] = rand(-0.08, 0.08); vel[i * 3 + 1] = rand(-0.03, 0.05); vel[i * 3 + 2] = rand(-0.08, 0.08);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ size: 0.06, map: radialTexture('rgba(255,248,230,1)', 'rgba(255,248,230,0)', 32), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.userData.noSolid = true;
    this.motes = { pts, pos, vel, N, cx: 0, cz: 0 };
    return this.motes;
  },

  tickMotes(dt) {
    const on = this.polishOn && this.mode === 'play' && this.world && this.world.scene;
    if (!on) { if (this.motes && this.motes.pts.parent) this.motes.pts.removeFromParent(); return; }
    const M = this.ensureMotes();
    if (M.pts.parent !== this.world.scene) this.world.scene.add(M.pts);
    const c = this.camera.position;
    const { pos, vel, N } = M;
    const t = this.clock;
    for (let i = 0; i < N; i++) {
      const o = i * 3;
      pos[o] += (vel[o] + Math.sin(t * 0.3 + i) * 0.03) * dt;
      pos[o + 1] += vel[o + 1] * dt;
      pos[o + 2] += (vel[o + 2] + Math.cos(t * 0.27 + i) * 0.03) * dt;
      // keep them in a box around the camera: what drifts out comes back on the other side
      if (pos[o] < c.x - 14) pos[o] += 28; else if (pos[o] > c.x + 14) pos[o] -= 28;
      if (pos[o + 2] < c.z - 14) pos[o + 2] += 28; else if (pos[o + 2] > c.z + 14) pos[o + 2] -= 28;
      if (pos[o + 1] < 0.2) pos[o + 1] = 8; else if (pos[o + 1] > 8.5) pos[o + 1] = 0.3;
    }
    M.pts.geometry.attributes.position.needsUpdate = true;
  },

  /* ---------- windows and light shafts along the long gym walls ---------- */

  buildWindows(g) {
    g.windowsBuilt = true;
    const X = ROOM.x, Z = ROOM.z;
    // keep clear of anything already hanging on the walls up there
    const boxes = [];
    const bb = new THREE.Box3();
    g.scene.updateMatrixWorld(true);
    g.scene.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      bb.setFromObject(o);
      const sx = bb.max.x - bb.min.x, sz = bb.max.z - bb.min.z;
      if (sx > 40 || sz > 40) return;
      if (bb.max.y < 5.8 || bb.min.y > 10.4) return;
      if (Math.abs(bb.min.z) < Z - 2.2 && Math.abs(bb.max.z) < Z - 2.2) return;
      boxes.push(bb.clone());
    });
    const frame = new Batch();
    const glass = [];
    const rays = [];
    const W = 5.2, H = 2.8, Y = 8.2;
    for (const sz of [-1, 1]) {
      for (let x = -X + 9; x <= X - 9; x += 11) {
        const z = sz * (Z - 0.02);
        const free = !boxes.some((b) => b.max.x > x - W / 2 - 0.4 && b.min.x < x + W / 2 + 0.4 && b.max.y > Y - H / 2 - 0.3 && b.min.y < Y + H / 2 + 0.3 && (sz < 0 ? b.min.z < -Z + 1.5 : b.max.z > Z - 1.5));
        if (!free) continue;
        glass.push([x, z, sz]);
        frame.box(W + 0.3, 0.2, 0.14, x, Y - H / 2 - 0.05, z + -sz * 0.04, '#e9eef7');
        frame.box(W + 0.3, 0.2, 0.14, x, Y + H / 2 + 0.05, z + -sz * 0.04, '#e9eef7');
        for (const dx of [-W / 2, 0, W / 2]) frame.box(0.14, H + 0.2, 0.14, x + dx, Y, z + -sz * 0.04, '#e9eef7');
        frame.box(W, 0.1, 0.12, x, Y, z + -sz * 0.04, '#e9eef7');
        if (glass.length % 2 === 1) rays.push([x, z, sz]);
      }
    }
    if (!glass.length) return;
    const fm = new THREE.Mesh(mergeParts(frame.parts, false), MATTE_MAT);
    fm.userData.noSolid = true;
    g.scene.add(fm);
    g.windowMeshes = [fm];
    // the glass shows the same drifting sky as the skylight
    const gGeo = new THREE.PlaneGeometry(W, H);
    const parts = glass.map(([x, z, sz]) => { const q = gGeo.clone(); if (sz > 0) q.rotateY(Math.PI); q.translate(x, Y, z); return q; });
    const merged = mergeGeoms(parts);
    const gm = new THREE.Mesh(merged, g.cloudMat || new THREE.MeshBasicMaterial({ color: '#bfe3ff' }));
    gm.userData.noSolid = true;
    g.scene.add(gm);
    g.windowMeshes.push(gm);
    // sunbeams: long soft quads slanting down into the hall
    const rayMat = new THREE.MeshBasicMaterial({
      map: makeCanvasTexture(64, 256, (ctx, w, h) => {
        const gr = ctx.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, 'rgba(255,244,214,0.55)'); gr.addColorStop(0.6, 'rgba(255,244,214,0.16)'); gr.addColorStop(1, 'rgba(255,244,214,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
        const side = ctx.createLinearGradient(0, 0, w, 0);
        side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.25, 'rgba(0,0,0,0)'); side.addColorStop(0.75, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = side; ctx.fillRect(0, 0, w, h);
      }),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    });
    const rGeo = new THREE.PlaneGeometry(W * 0.9, 9).translate(0, -4.5, 0);
    const rparts = rays.map(([x, z, sz]) => {
      const q = rGeo.clone();
      q.rotateX(sz * 0.62);
      q.translate(x + 1.2, Y + H / 2 - 0.2, z - sz * 0.15);
      return q;
    });
    const rm = new THREE.Mesh(mergeGeoms(rparts), rayMat);
    rm.userData.noSolid = true;
    rm.renderOrder = 2;
    g.scene.add(rm);
    g.sunRays = rm;
    g.solids = null;
  },

  /* ---------- every frame ---------- */

  tickPolish(dt) {
    const on = this.polishOn;
    if (on !== this.polishWas) {
      this.polishWas = on;
      this.setShine(on);
      document.body.classList.toggle('polish', on);
      if (this.gym && this.gym.sunRays) this.gym.sunRays.visible = on;
      if (this.gym && this.gym.windowMeshes) for (const m of this.gym.windowMeshes) m.visible = on;
    }
    if (!on || this.mode !== 'play') { this.tickMotes(dt); return; }
    const g = this.gym;
    if (g && !g.windowsBuilt && g.arcade && g.south) this.buildWindows(g);
    this.shineT = (this.shineT || 0) - dt;
    if (this.shineT <= 0 || this.shineWorldWas !== this.world) {
      this.shineT = 2.5;
      this.shineWorldWas = this.world;
      this.shineWorld(this.world);
    }
    this.tickMotes(dt);
    // people nearby turn their heads to look at you
    const P = this.player;
    if (!P || !this.world) return;
    const pp = P.ch.root.position;
    _pv2.set(pp.x, 1.55 * P.ch.root.scale.y + P.ch.airY, pp.z);
    for (const n of this.world.npcs) {
      const q = n.ch.root.position;
      const d2 = (q.x - pp.x) ** 2 + (q.z - pp.z) ** 2;
      const look = d2 < 36 && d2 > 0.3 && ['idle', 'walk', 'fan', 'chat', 'jog'].includes(n.state);
      n.ch.lookAtP = look ? _pv2 : null;
    }
  },
});

/** Extra detail is on for every preset except the light one. */
Object.defineProperty(Game, 'polishOn', {
  get() { return !!(this.save && this.save.settings && this.save.settings.quality !== 'go'); },
  configurable: true,
});

/** Merge plain geometries (same attributes) into one. */
function mergeGeoms(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : 0; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const idx = [];
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (g.index) for (const i of g.index.array) idx.push(i + o);
    o += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}
