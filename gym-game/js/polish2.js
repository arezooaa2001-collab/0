'use strict';
/*
 * Round fifteen, the look: glow around the gym's ceiling lights, speed lines and a wider view
 * when you go really fast, a ribbon of light behind you on dashes, turbo and karts, and hair
 * styles to choose in «ظاهر من». The extras are off on the light "Go" preset.
 */

const HAIR_STYLES = [['crop', '💇', 'کوتاه'], ['spiky', '🦔', 'سیخ‌سیخی'], ['bun', '🍡', 'گوجه‌ای'], ['pony', '🎀', 'دم‌اسبی'], ['afro', '🌳', 'فرفری'], ['mohawk', '🦜', 'موهاک'], ['bald', '🥚', 'کچل']];

/** A ribbon of light: a strip of quads following a point, fading towards its tail. */
class Trail {
  constructor(n = 28, color = '#7fe0ff') {
    this.n = n;
    this.pts = [];
    const pos = new Float32Array(n * 2 * 3);
    const col = new Float32Array(n * 2 * 3);
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
    this.mesh.frustumCulled = false;
    this.mesh.userData.noSolid = true;
    this.mesh.visible = false;
    this.color = new THREE.Color(color);
    this.pos = pos;
    this.col = col;
  }

  /** p: where the trail is now; on: still being drawn (the tail keeps fading when off). */
  update(p, half, on, dt) {
    if (on) {
      this.pts.unshift({ x: p.x, y: p.y, z: p.z, a: 1 });
      if (this.pts.length > this.n) this.pts.length = this.n;
    }
    for (const q of this.pts) q.a -= dt * (on ? 1.6 : 3.5);
    while (this.pts.length && this.pts[this.pts.length - 1].a <= 0) this.pts.pop();
    const P = this.pts;
    this.mesh.visible = P.length > 1;
    if (!this.mesh.visible) return;
    const pos = this.pos, col = this.col, c = this.color;
    for (let i = 0; i < this.n; i++) {
      const q = P[Math.min(i, P.length - 1)];
      const o = i * 6;
      const k = Math.max(0, q.a) * (1 - i / this.n);
      const h = half * (0.35 + 0.65 * (1 - i / this.n));
      pos[o] = q.x; pos[o + 1] = q.y + h; pos[o + 2] = q.z;
      pos[o + 3] = q.x; pos[o + 4] = q.y - h; pos[o + 5] = q.z;
      col[o] = c.r * k; col[o + 1] = c.g * k; col[o + 2] = c.b * k;
      col[o + 3] = c.r * k; col[o + 4] = c.g * k; col[o + 5] = c.b * k;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }
}

Object.assign(Game, {
  /* ---------- glow around the ceiling lights ---------- */

  buildHalos(g) {
    g.halosBuilt = true;
    const pts = [];
    // the same grid the gym's glowing ceiling panels are laid out on
    const X = ROOM.x, H = ROOM.h;
    for (let lx = -(X - 7); lx <= X - 7; lx += 10) {
      for (let lz = -26; lz <= 26; lz += 8.6) if (Math.abs(lx) > 18 || Math.abs(lz) > 11) pts.push(lx, H - 0.35, lz);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    const mat = new THREE.PointsMaterial({ size: 4.2, map: radialTexture('rgba(255,244,214,0.55)', 'rgba(255,244,214,0)', 64), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false });
    const halo = new THREE.Points(geo, mat);
    halo.userData.noSolid = true;
    halo.renderOrder = 3;
    g.scene.add(halo);
    g.halos = halo;
  },

  /* ---------- going fast: speed lines, a wider view, a ribbon of light ---------- */

  tickTrailFx(dt) {
    const P = this.player;
    const on = this.polishOn && this.mode === 'play' && P && this.world;
    const ch = P && P.ch;
    // how fast, really: running speed, a dash, the cannon, a kart, the zipline
    let sp = 0;
    if (on) {
      const p = ch.root.position;
      const last = this.fxLastPos || (this.fxLastPos = new THREE.Vector3().copy(p));
      const d = Math.hypot(p.x - last.x, p.z - last.z);
      last.copy(p);
      sp = dt > 0 && d < 1.5 ? d / dt : 0; // a teleport is not speed
    }
    this.fxSpeed = (this.fxSpeed || 0) + (sp - (this.fxSpeed || 0)) * damp(6, dt);
    // the ribbon behind you
    if (!on) { if (this.trail) this.trail.mesh.visible = false; return; }
    const T = this.trail || (this.trail = new Trail(26, '#7fe0ff'));
    if (T.mesh.parent !== this.world.scene) this.world.scene.add(T.mesh);
    const glowing = this.fxSpeed > 9 || !!(this.cannon && this.cannon.state === 'fly') || (this.kart && this.kart.boost > 0);
    const p = ch.root.position;
    T.color.set(this.kart ? '#ffb347' : this.clones ? '#9b6dff' : '#7fe0ff');
    T.update({ x: p.x, y: (p.y || 0) + ch.airY + 1.0 * ch.root.scale.y, z: p.z }, 0.32 * ch.root.scale.y, glowing, dt);
  },

  /* ---------- the hair row in «ظاهر من» ---------- */

  hairRow() {
    const box = $('lookRows');
    if (!box) return;
    const cur = this.outfit().hairStyle || 'crop';
    const row = document.createElement('div');
    row.className = 'look-row';
    const label = document.createElement('span');
    label.textContent = 'مدل مو';
    row.appendChild(label);
    const sw = document.createElement('div');
    sw.className = 'look-sw';
    for (const [id, icon, name] of HAIR_STYLES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch hair-sw' + (cur === id ? ' on' : '');
      b.textContent = icon;
      b.title = name;
      b.setAttribute('aria-label', `مدل مو ${name}`);
      b.addEventListener('click', () => this.setLook('hairStyle', id));
      sw.appendChild(b);
    }
    row.appendChild(sw);
    box.insertBefore(row, box.children[2] || null);
  },

  tickPolish2(dt) {
    const g = this.gym;
    if (this.polishOn && g && !g.halosBuilt) this.buildHalos(g);
    if (g && g.halos) g.halos.visible = this.polishOn;
    this.tickTrailFx(dt);
  },
});

const _openLook2 = Game.openLook;
Game.openLook = function (...args) {
  const r = _openLook2.apply(this, args);
  this.hairRow();
  return r;
};
