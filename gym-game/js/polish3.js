'use strict';
/*
 * Round sixteen, the look and the feel: capes from the shop that flap behind you as you run
 * and jump (a little cloth simulation), and a split-second freeze on the biggest hits so
 * they land with a thump.
 */

SHOP.push(
  { id: 'cape_red', cat: 'cape', name: 'شنل قهرمان', icon: '🦸', price: 450, once: true, color: '#d62839', desc: 'پشت سرت توی باد تکون می‌خوره' },
  { id: 'cape_royal', cat: 'cape', name: 'شنل شاهانه', icon: '👑', price: 650, once: true, color: '#5a2a9a', trim: '#ffd34d', desc: 'بنفش با لبه‌ی طلایی' },
  { id: 'cape_night', cat: 'cape', name: 'شنل شب', icon: '🦇', price: 650, once: true, color: '#141824', trim: '#e63946', desc: 'سیاه با آستر قرمز' },
  { id: 'cape_gold', cat: 'cape', name: 'شنل طلایی', icon: '🌟', price: 900, once: true, color: '#d4af37', trim: '#fff2b0', shiny: true, desc: 'برق می‌زنه' },
);
for (const it of SHOP) SHOP_BY_ID[it.id] = it;
ACHIEVEMENTS.push({ id: 'cape', name: 'ابرقهرمان', icon: '🦸', desc: 'یه شنل ببند', test: (s) => !!(s.shop && s.shop.cape) });

const CAPE = { cols: 5, rows: 9, len: 1.1, top: 0.4, bottom: 0.7 };
const _cv = new THREE.Vector3();
const _cm = new THREE.Matrix4();

/** A cape: a grid of points hanging from the shoulders, kept apart by sticks, falling behind the back. */
class Cape {
  constructor(item) {
    const { cols, rows } = CAPE;
    this.n = cols * rows;
    this.p = new Float32Array(this.n * 3);
    this.q = new Float32Array(this.n * 3);
    this.ready = false;
    const geo = new THREE.PlaneGeometry(1, 1, cols - 1, rows - 1);
    this.geo = geo;
    const tex = makeCanvasTexture(64, 128, (ctx, w, h) => {
      ctx.fillStyle = item.color; ctx.fillRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      if (item.trim) { ctx.fillStyle = item.trim; ctx.fillRect(0, h - 9, w, 9); ctx.fillRect(0, 0, 4, h); ctx.fillRect(w - 4, 0, 4, h); }
      // an emblem in the middle of the back
      ctx.fillStyle = item.trim || 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.moveTo(w / 2, h * 0.28); ctx.lineTo(w * 0.64, h * 0.4); ctx.lineTo(w / 2, h * 0.52); ctx.lineTo(w * 0.36, h * 0.4); ctx.closePath(); ctx.fill();
    });
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: item.shiny ? 0.3 : 0.75, metalness: item.shiny ? 0.6 : 0.05 }));
    this.mesh.frustumCulled = false;
    this.mesh.userData.noSolid = true;
    this.mesh.castShadow = true;
  }

  /** The anchor along the shoulders, in world space (spine bone local coordinates). */
  anchor(ch, i, out) {
    const u = i / (CAPE.cols - 1) - 0.5;
    return out.set(u * CAPE.top, 0.5, -0.16).applyMatrix4(ch.B.spine.matrixWorld);
  }

  reset(ch) {
    ch.root.updateMatrixWorld(true);
    const s = ch.root.scale.y;
    for (let r = 0; r < CAPE.rows; r++) for (let c = 0; c < CAPE.cols; c++) {
      this.anchor(ch, c, _cv);
      const o = (r * CAPE.cols + c) * 3;
      this.p[o] = this.q[o] = _cv.x;
      this.p[o + 1] = this.q[o + 1] = _cv.y - (r / (CAPE.rows - 1)) * CAPE.len * s;
      this.p[o + 2] = this.q[o + 2] = _cv.z;
    }
    this.ready = true;
  }

  update(ch, dt) {
    if (!this.ready) this.reset(ch);
    const { cols, rows } = CAPE;
    const p = this.p, q = this.q;
    const s = ch.root.scale.y;
    ch.root.updateMatrixWorld(true);
    // a teleport: start hanging again rather than stretch across the room
    this.anchor(ch, 2, _cv);
    if (Math.hypot(_cv.x - p[6], _cv.z - p[8]) > 2) this.reset(ch);
    const h = Math.min(dt, 1 / 30);
    const g = -9.8 * h * h;
    const t = Game.clock;
    // move: gravity, a soft flutter, a little damping (verlet)
    for (let i = cols; i < this.n; i++) {
      const o = i * 3;
      const vx = (p[o] - q[o]) * 0.97, vy = (p[o + 1] - q[o + 1]) * 0.97, vz = (p[o + 2] - q[o + 2]) * 0.97;
      q[o] = p[o]; q[o + 1] = p[o + 1]; q[o + 2] = p[o + 2];
      const row = Math.floor(i / cols);
      const fl = Math.sin(t * 7 + row * 0.8 + (i % cols)) * 0.0006 * row;
      p[o] += vx + fl; p[o + 1] += vy + g; p[o + 2] += vz + fl;
    }
    // the top row is sewn to the shoulders
    for (let c = 0; c < cols; c++) { this.anchor(ch, c, _cv); const o = c * 3; p[o] = q[o] = _cv.x; p[o + 1] = q[o + 1] = _cv.y; p[o + 2] = q[o + 2] = _cv.z; }
    const segV = (CAPE.len / (rows - 1)) * s;
    _cm.copy(ch.B.spine.matrixWorld).invert();
    const spine = ch.B.spine.matrixWorld;
    for (let it = 0; it < 4; it++) {
      for (let r = 0; r < rows; r++) {
        const w = (CAPE.top + (CAPE.bottom - CAPE.top) * (r / (rows - 1))) * s / (cols - 1);
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          if (c < cols - 1) this.stick(i, i + 1, w, r === 0);
          if (r < rows - 1) this.stick(i, i + cols, segV, r === 0);
        }
      }
      // never through the body: points in front of the back plane are pushed behind it
      for (let i = cols; i < this.n; i++) {
        const o = i * 3;
        _cv.set(p[o], p[o + 1], p[o + 2]).applyMatrix4(_cm);
        if (_cv.y > -0.75 && _cv.y < 0.62 && Math.abs(_cv.x) < 0.3 && _cv.z > -0.17) {
          _cv.z = -0.17;
          _cv.applyMatrix4(spine);
          p[o] = _cv.x; p[o + 1] = _cv.y; p[o + 2] = _cv.z;
        }
        const floor = (ch.root.position.y || 0) + 0.03;
        if (p[o + 1] < floor) p[o + 1] = floor;
      }
    }
    const pos = this.geo.attributes.position;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      // the plane's own vertex order runs top row first, left to right
      const i = r * cols + c;
      pos.setXYZ(i, p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    }
    pos.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }

  stick(a, b, len, pinnedA) {
    const p = this.p;
    const oa = a * 3, ob = b * 3;
    const dx = p[ob] - p[oa], dy = p[ob + 1] - p[oa + 1], dz = p[ob + 2] - p[oa + 2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    const k = (d - len) / d;
    if (pinnedA) { p[ob] -= dx * k; p[ob + 1] -= dy * k; p[ob + 2] -= dz * k; return; }
    const h = k * 0.5;
    p[oa] += dx * h; p[oa + 1] += dy * h; p[oa + 2] += dz * h;
    p[ob] -= dx * h; p[ob + 1] -= dy * h; p[ob + 2] -= dz * h;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.geo.dispose();
    if (this.mesh.material.map) this.mesh.material.map.dispose();
    this.mesh.material.dispose();
  }
}

Object.assign(Game, {
  tickCape(dt) {
    const id = this.save && this.save.shop && this.save.shop.cape;
    const want = id && this.owns(id) && SHOP_BY_ID[id] && this.mode === 'play' && this.player && this.world ? id : null;
    if (!want) { if (this.cape) { this.cape.dispose(); this.cape = null; } return; }
    if (!this.cape || this.cape.id !== want || this.cape.ch !== this.player.ch) {
      if (this.cape) this.cape.dispose();
      this.cape = new Cape(SHOP_BY_ID[want]);
      this.cape.id = want;
      this.cape.ch = this.player.ch;
    }
    const C = this.cape;
    if (C.mesh.parent !== this.world.scene) { this.world.scene.add(C.mesh); C.ready = false; }
    C.mesh.visible = this.player.ch.root.visible !== false;
    if (dt > 0) C.update(this.player.ch, dt);
  },

  /* ---------- a beat of stillness on the biggest hits ---------- */

  hitStop(sec) {
    if (!this.polishOn) return;
    this.hitStopT = Math.max(this.hitStopT || 0, sec);
  },
});

/* the shop knows capes: a category, and they can be put on and taken off */
const _timeScale3 = Game.timeScale;
Game.timeScale = function (dt) {
  if (this.hitStopT > 0) { this.hitStopT -= dt; return dt * 0.06; }
  return _timeScale3.call(this, dt);
};
for (const [name, sec] of [['landCannon', 0.09], ['breakPinata', 0.1], ['strike', 0.05], ['throwOffBull', 0.08], ['hoopScore', 0.05]]) {
  const orig = Game[name];
  if (typeof orig !== 'function') continue;
  Game[name] = function (...args) {
    const r = orig.apply(this, args);
    this.hitStop(sec);
    return r;
  };
}
