'use strict';
/* Things lying around every world: spinning coins, gems, the golden star and treasure chests */

const COIN_MAT = new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 0.75, roughness: 0.28, emissive: '#7a5200', emissiveIntensity: 0.55 });
const GEM_MAT = new THREE.MeshStandardMaterial({ color: '#4de8ff', metalness: 0.2, roughness: 0.12, emissive: '#0a7a90', emissiveIntensity: 0.8, flatShading: true });
const STAR_MAT = new THREE.MeshStandardMaterial({ color: '#ffd34d', metalness: 0.4, roughness: 0.3, emissive: '#ff9d00', emissiveIntensity: 0.9 });
const COIN_GEO = new THREE.CylinderGeometry(0.24, 0.24, 0.06, 18).rotateX(Math.PI / 2);
const GEM_GEO = new THREE.OctahedronGeometry(0.24, 0).scale(1, 1.45, 1);

function starGeometry() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.16 : 0.38;
    const a = (i / 10) * TAU + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 });
  g.translate(0, 0, -0.04);
  return g;
}

function chestMesh() {
  const g = new THREE.Group();
  const b = new Batch();
  b.box(0.9, 0.5, 0.6, 0, 0.25, 0, '#8a4b1f');
  b.box(0.94, 0.06, 0.64, 0, 0.06, 0, '#ffc23d');
  b.box(0.94, 0.06, 0.64, 0, 0.47, 0, '#ffc23d');
  for (const x of [-0.38, 0.38]) b.box(0.07, 0.52, 0.64, x, 0.26, 0, '#ffc23d');
  b.box(0.14, 0.16, 0.04, 0, 0.36, 0.31, '#ffe08a');
  g.add(new THREE.Mesh(mergeParts(b.parts, false), METAL_MAT));
  const lid = new THREE.Group();
  lid.position.set(0, 0.5, -0.3);
  const lb = new Batch();
  lb.add(UnitGeo.cyl(16), 0, 0, 0.3, '#9c5626', 0, 0, Math.PI / 2, 0.3, 0.9, 0.3);
  lb.add(UnitGeo.cyl(16), 0.38, 0, 0.3, '#ffc23d', 0, 0, Math.PI / 2, 0.31, 0.07, 0.31);
  lb.add(UnitGeo.cyl(16), -0.38, 0, 0.3, '#ffc23d', 0, 0, Math.PI / 2, 0.31, 0.07, 0.31);
  const lm = new THREE.Mesh(mergeParts(lb.parts, false), METAL_MAT);
  lm.scale.y = 0.75;
  lid.add(lm);
  g.add(lid);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 12, 18, 1, true), new THREE.MeshBasicMaterial({
    color: '#ffc23d', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  }));
  beam.position.y = 6;
  g.add(beam);
  g.userData = { lid, beam };
  return g;
}

class Pickups {
  constructor(world) {
    this.world = world;
    this.items = [];
    this.coins = new THREE.InstancedMesh(COIN_GEO, COIN_MAT, 48);
    this.gems = new THREE.InstancedMesh(GEM_GEO, GEM_MAT, 4);
    for (const m of [this.coins, this.gems]) {
      m.count = 0;
      m.frustumCulled = false;
      world.scene.add(m);
    }
    this.star = new THREE.Mesh(starGeometry(), STAR_MAT);
    this.star.visible = false;
    world.scene.add(this.star);
    this.chest = null;
    this.spawnT = 1;
    this.gemT = rand(10, 25);
    this.starT = rand(40, 70);
    this.chestT = rand(35, 60);
    this.m4 = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.v = new THREE.Vector3();
    this.s = new THREE.Vector3(1, 1, 1);
  }

  count(type) { return this.items.filter((i) => i.type === type).length; }

  spot() {
    const p = this.world.freeSpot();
    return this.world.inBounds(p.x, p.z, 1) ? p : null;
  }

  add(type, x, z, fall = 0) {
    const it = { type, x, z, y: 0.65 + fall, vy: 0, t: rand(0, TAU), born: 0 };
    this.items.push(it);
    return it;
  }

  /** Coins falling from the sky around a point. */
  rain(cx, cz, n) {
    for (let i = 0; i < n; i++) {
      if (this.count('coin') >= 46) break;
      const a = rand(0, TAU);
      const r = rand(1.5, 9);
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (!this.world.inBounds(x, z, 1)) continue;
      this.add('coin', x, z, rand(5, 12));
    }
  }

  spawnChest() {
    const p = this.spot();
    if (!p || this.chest) return null;
    const g = chestMesh();
    g.position.set(p.x, 0, p.z);
    g.rotation.y = rand(-Math.PI, Math.PI);
    this.world.scene.add(g);
    this.chest = { g, x: p.x, z: p.z, open: 0, opening: false };
    return this.chest;
  }

  openChest() {
    const c = this.chest;
    if (!c || c.opening) return false;
    c.opening = true;
    return true;
  }

  nearChest(p) {
    const c = this.chest;
    return c && !c.opening && Math.hypot(p.x - c.x, p.z - c.z) < 1.9;
  }

  /**
   * Spin everything, keep a few coins around, and return what the player just picked up.
   * auto: false while the player is busy elsewhere (arm wrestling), so nothing spawns.
   */
  update(dt, player, auto, maxCoins, magnet = 0) {
    const pos = player.ch.root.position;
    const air = player.ch.airY;
    const got = [];
    if (auto) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = 2.5;
        if (this.count('coin') < maxCoins) { const p = this.spot(); if (p) this.add('coin', p.x, p.z); }
      }
      this.gemT -= dt;
      if (this.gemT <= 0) {
        this.gemT = rand(18, 30);
        if (this.count('gem') < 2) { const p = this.spot(); if (p) this.add('gem', p.x, p.z); }
      }
      this.starT -= dt;
      if (this.starT <= 0) {
        this.starT = rand(55, 90);
        if (!this.count('star')) { const p = this.spot(); if (p) this.add('star', p.x, p.z); }
      }
    }
    let nc = 0;
    let ng = 0;
    this.star.visible = false;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      it.born += dt;
      if (magnet && it.type !== 'star') {
        const dx = pos.x - it.x;
        const dz = pos.z - it.z;
        const d = Math.hypot(dx, dz);
        if (d < magnet && d > 0.01) {
          const k = Math.min(d, 9 * dt) / d;
          it.x += dx * k;
          it.z += dz * k;
        }
      }
      if (it.y > 0.66) {
        it.vy -= 14 * dt;
        it.y = Math.max(0.65, it.y + it.vy * dt);
      }
      const dy = Math.abs(it.y - (0.6 + air));
      if (it.born > 0.3 && dy < 1.3 && Math.hypot(pos.x - it.x, pos.z - it.z) < (it.type === 'coin' ? 0.85 : 1.0)) {
        got.push(it);
        this.items.splice(i, 1);
        continue;
      }
      const bob = it.y + Math.sin(it.t * 2.5) * 0.08;
      const grow = Math.min(1, it.born * 4);
      if (it.type === 'coin' && nc < 48) {
        this.e.set(0, it.t * 3, 0);
        this.q.setFromEuler(this.e);
        this.s.setScalar(grow);
        this.m4.compose(this.v.set(it.x, bob, it.z), this.q, this.s);
        this.coins.setMatrixAt(nc++, this.m4);
      } else if (it.type === 'gem' && ng < 4) {
        this.e.set(0, it.t * 1.8, 0);
        this.q.setFromEuler(this.e);
        this.s.setScalar(grow * (1 + 0.08 * Math.sin(it.t * 6)));
        this.m4.compose(this.v.set(it.x, bob + 0.15, it.z), this.q, this.s);
        this.gems.setMatrixAt(ng++, this.m4);
        if (Math.random() < dt * 3) this.world.fx.emit(it.x + rand(-0.3, 0.3), bob + rand(0, 0.6), it.z + rand(-0.3, 0.3), 0, 0.6, 0, new THREE.Color('#9ff3ff'), 0.6, 0);
      } else if (it.type === 'star') {
        this.star.visible = true;
        this.star.position.set(it.x, bob + 0.35, it.z);
        this.star.rotation.y = it.t * 2.2;
        this.star.scale.setScalar(grow * (1 + 0.1 * Math.sin(it.t * 8)));
        if (Math.random() < dt * 8) this.world.fx.emit(it.x + rand(-0.4, 0.4), bob + rand(0, 0.8), it.z + rand(-0.4, 0.4), 0, 0.8, 0, new THREE.Color(pick(['#ffd34d', '#ff7b00', '#ffffff'])), 0.7, 0);
      }
    }
    this.coins.count = nc;
    this.gems.count = ng;
    this.coins.instanceMatrix.needsUpdate = true;
    this.gems.instanceMatrix.needsUpdate = true;

    const c = this.chest;
    if (c) {
      const u = c.g.userData;
      u.beam.material.opacity = 0.18 + 0.1 * Math.sin(this.world.time * 4);
      if (c.opening) {
        c.open += dt;
        u.lid.rotation.x = -Math.min(1.9, c.open * 5);
        if (c.open > 1.6) {
          const s = Math.max(0, 1 - (c.open - 1.6) * 3);
          c.g.scale.setScalar(s);
          if (s <= 0) {
            this.world.scene.remove(c.g);
            this.chest = null;
          }
        }
      } else c.g.position.y = Math.abs(Math.sin(this.world.time * 2)) * 0.05;
    }
    return got;
  }
}
