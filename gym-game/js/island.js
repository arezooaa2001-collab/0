'use strict';
/* Cloud Island (unlocks at level 100) and the sports places its AI builder creates */

const ISLAND_R = 23;
const ISLAND_PORTAL = { x: 7.5, z: 17.9 };
const ISLAND_PORTAL_A = Math.atan2(ISLAND_PORTAL.z, ISLAND_PORTAL.x);
const KIOSK = { x: 0, z: 0 };

function skyDome(top, bottom) {
  const mat = new THREE.MeshBasicMaterial({ map: cloudSkyTexture(top, bottom, 34), side: THREE.BackSide, toneMapped: false, fog: false });
  mat.map.repeat.set(3, 1);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 16), mat);
  return dome;
}

/** Ring of fluffy clouds around/below a world; returns a group to spin slowly. */
function cloudField(count, rMin, rMax, yMin, yMax) {
  const g = new THREE.Group();
  const geos = [0, 1, 2, 3].map((i) => cloudPuffGeometry(i));
  for (let i = 0; i < count; i++) {
    const c = new THREE.Mesh(geos[i % 4], CLOUD_MAT);
    const a = Math.random() * TAU;
    const r = rand(rMin, rMax);
    c.position.set(Math.cos(a) * r, rand(yMin, yMax), Math.sin(a) * r);
    c.scale.setScalar(rand(1.4, 3.6));
    c.rotation.y = Math.random() * TAU;
    g.add(c);
  }
  return g;
}

function portalRing(world, x, z, color, title) {
  world.matte.cyl(1.6, 0.12, x, 0.06, z, '#eef4ff');
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.11, 10, 40), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  ring.position.set(x, 1.6, z);
  ring.rotation.y = Math.atan2(x, z);
  world.scene.add(ring);
  // the ring's foot is solid all along its width
  orientedColliders(world, x, z, 2.85, 0.26, ring.rotation.y, 0.26);
  const sign = labelSprite(title, 'برای رفتن کنارش برو', color, 3);
  sign.position.set(x, 3.6, z);
  world.scene.add(sign);
  return ring;
}

class IslandWorld extends WorldBase {
  constructor() {
    super({ bounds: { circle: ISLAND_R }, spawn: { x: 0, z: 15, yaw: Math.PI }, background: '#bfe0ff', fog: [60, 260] });
    const sc = this.scene;
    sc.add(skyDome('#3f8fff', '#e8f4ff'));
    sc.add(new THREE.HemisphereLight(0xffffff, 0x88aa77, 0.95));
    const sun = new THREE.DirectionalLight(0xfff2d8, 0.85);
    sun.position.set(20, 40, 15);
    sc.add(sun);
    const m = this.matte;
    m.cyl(ISLAND_R + 1, 0.6, 0, -0.3, 0, '#5cc96b', 0, 0, 0, 48);
    m.add(UnitGeo.cyl(48), 0, -0.02, 0, '#6fd87c', 0, 0, 0, ISLAND_R + 0.9, 0.04, ISLAND_R + 0.9);
    m.add(new THREE.CylinderGeometry(1, 0.85, 1, 48), 0, -1.8, 0, '#8a5a35', 0, 0, 0, ISLAND_R + 1, 2.4, ISLAND_R + 1);
    m.add(new THREE.CylinderGeometry(1, 0.05, 1, 24), 0, -9.5, 0, '#6d5a4a', 0, 0, 0, ISLAND_R * 0.85, 13, ISLAND_R * 0.85);
    // stone path ring and flowers
    m.geo(ellipseRingGeometry(4.2, 4.2, 1.1), 0, 0.03, 0, '#d8d2c4');
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * TAU;
      const r = rand(5.5, ISLAND_R - 0.5);
      m.sphere(0.07, Math.cos(a) * r, 0.07, Math.sin(a) * r, pick(['#ffd34d', '#ff6b8a', '#ffffff', '#b07bff']));
    }
    // edge railing
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * TAU;
      this.metal.box(0.08, 0.9, 0.08, Math.cos(a) * (ISLAND_R + 0.4), 0.45, Math.sin(a) * (ISLAND_R + 0.4), '#f5f7ff');
    }
    this.glow.geo(ellipseRingGeometry(ISLAND_R + 0.36, ISLAND_R + 0.36, 0.08), 0, 0.88, 0, '#bfe9ff');
    // trees
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + 0.6;
      if (Math.abs(wrapAngle(a - ISLAND_PORTAL_A)) < 0.5 || Math.abs(wrapAngle(a - Math.PI / 2)) < 0.3) continue;
      const x = Math.cos(a) * (ISLAND_R - 2);
      const z = Math.sin(a) * (ISLAND_R - 2);
      m.cyl(0.18, 1.6, x, 0.8, z, '#7a5230');
      m.sphere(1.0, x, 2.1, z, '#3fae55', 1.1);
      m.sphere(0.7, x + 0.4, 2.7, z, '#52c56a');
      this.addCollider(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
    }
    this.buildKiosk();
    this.homeRing = portalRing(this, ISLAND_PORTAL.x, ISLAND_PORTAL.z, '#ffc23d', 'برگشت به باشگاه');
    this.finishBatches();
    this.below = cloudField(46, 30, 150, -26, -6);
    this.above = cloudField(18, 40, 160, 10, 30);
    sc.add(this.below, this.above);
    this.created = new THREE.Group();
    sc.add(this.created);
    this.baseColliders = this.colliders.length;
    this.baseStations = this.stations.length;
    this.placePortals = [];
    this.cam.pitch = 0.32;
  }

  buildKiosk() {
    const m = this.matte;
    const { x, z } = KIOSK;
    m.cyl(1.4, 0.5, x, 0.25, z, '#e9eef7');
    m.cyl(0.5, 1.6, x, 1.3, z, '#c9d3f0');
    this.glow.cyl(1.45, 0.08, x, 0.52, z, '#7fe0ff');
    const head = new THREE.Group();
    const hb = new Batch();
    hb.box(1.1, 0.8, 0.9, 0, 0, 0, '#f5f7ff');
    hb.box(0.85, 0.45, 0.05, 0, 0.02, 0.46, '#13203d');
    hb.cyl(0.03, 0.4, 0, 0.6, 0, '#c9d3f0');
    hb.sphere(0.09, 0, 0.82, 0, '#ff4d6d');
    head.add(new THREE.Mesh(mergeParts(hb.parts, false), MATTE_MAT));
    const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.02), new THREE.MeshBasicMaterial({ color: '#7fe0ff', toneMapped: false }));
    eyes.position.set(0, 0.04, 0.49);
    head.add(eyes);
    head.position.set(x, 2.55, z);
    this.scene.add(head);
    const sign = labelSprite('🤖 سازنده‌ی هوش مصنوعی', 'هر وسیله‌ی ورزشی بخوای می‌سازه', '#7fe0ff', 3.4);
    sign.position.set(x, 3.9, z);
    this.scene.add(sign);
    this.kiosk = { head, eyes };
    this.addCollider(x - 1.2, z - 1.2, x + 1.2, z + 1.2);
  }

  nearKiosk() {
    const p = this.player.ch.root.position;
    return Math.hypot(p.x - KIOSK.x, p.z - KIOSK.z) < 3.2;
  }

  nearHome() {
    const p = this.player.ch.root.position;
    return Math.hypot(p.x - ISLAND_PORTAL.x, p.z - ISLAND_PORTAL.z) < 2.6;
  }

  nearPlace() {
    const p = this.player.ch.root.position;
    return this.placePortals.find((pp) => Math.hypot(p.x - pp.x, p.z - pp.z) < 2.6) || null;
  }

  /** Rebuild everything the AI made: equipment on two rings, places as portals near the edge. */
  setCreations(items) {
    for (const ch of [...this.created.children]) {
      this.created.remove(ch);
      ch.traverse((o) => { if (o.isSprite && o.material.map) o.material.map.dispose(); });
    }
    this.colliders.length = this.baseColliders;
    for (const n of this.npcs) if (n.station && this.stations.indexOf(n.station) >= this.baseStations) { this.leaveStation(n); n.state = 'idle'; n.timer = 0.5; }
    this.stations.length = this.baseStations;
    if (this.player && this.player.anchor && this.player.anchor.custom) this.player.anchor = null;
    const slots = [];
    for (const [r, n] of [[9.5, 8], [15.5, 12]]) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + (r > 10 ? 0.13 : 0);
        if (Math.abs(wrapAngle(a - Math.PI / 2)) < 0.3 || (r > 12 && Math.abs(wrapAngle(a - ISLAND_PORTAL_A)) < 0.35)) continue;
        slots.push({ a, r });
      }
    }
    const equips = items.filter((c) => c.kind === 'equipment').slice(0, slots.length);
    equips.forEach((item, i) => {
      const { a, r } = slots[i];
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      placeEquipment(this, item, x, z, Math.atan2(-x, -z), this.created);
    });
    const places = items.filter((c) => c.kind === 'place').slice(0, 8);
    this.placePortals = places.map((item, i) => {
      const a = ISLAND_PORTAL_A + 0.45 + (i + 0.5) * ((TAU - 1.4) / places.length);
      const x = Math.cos(a) * 20.5;
      const z = Math.sin(a) * 20.5;
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.1, 10, 36), new THREE.MeshBasicMaterial({ color: '#b07bff', toneMapped: false }));
      ring.position.set(x, 1.5, z);
      ring.rotation.y = Math.atan2(x, z);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.1, 28), new THREE.MeshBasicMaterial({ color: '#d9c4ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, toneMapped: false }));
      disc.position.copy(ring.position);
      disc.rotation.y = ring.rotation.y;
      const sign = labelSprite(`${item.icon} ${item.name}`, 'مکان ورزشی', '#b07bff', 2.6);
      sign.position.set(x, 3.3, z);
      g.add(ring, disc, sign);
      this.created.add(g);
      return { x, z, item, ring };
    });
  }

  updateExtra(dt) {
    this.below.rotation.y += dt * 0.01;
    this.above.rotation.y -= dt * 0.006;
    this.homeRing.rotation.z += dt;
    for (const p of this.placePortals) p.ring.rotation.z += dt * 1.4;
    this.kiosk.head.rotation.y = Math.sin(this.time * 0.7) * 0.5;
    this.kiosk.eyes.scale.y = Math.sin(this.time * 2.3) > 0.97 ? 0.15 : 1;
  }
}

/** A sports place the AI designed. */
class PlaceWorld extends WorldBase {
  constructor(item) {
    const pl = item.place;
    const R = pl.radius;
    super({ bounds: { circle: R }, spawn: { x: 0, z: R - 4, yaw: Math.PI }, background: pl.sky, fog: [R * 3, R * 9] });
    this.home = { x: Math.cos(1.05) * (R - 1.8), z: Math.sin(1.05) * (R - 1.8) };
    this.item = item;
    const sc = this.scene;
    const sky = new THREE.Color(pl.sky);
    const top = '#' + sky.clone().multiplyScalar(0.75).getHexString();
    sc.add(skyDome(top, '#f2f8ff'));
    sc.add(new THREE.HemisphereLight(0xffffff, 0x777777, 0.9));
    const sun = new THREE.DirectionalLight(0xfff2d8, 0.8);
    sun.position.set(15, 30, 10);
    sc.add(sun);
    this.matte.cyl(R + 1.5, 0.6, 0, -0.3, 0, pl.ground, 0, 0, 0, 56);
    this.matte.add(new THREE.CylinderGeometry(1, 0.6, 1, 40), 0, -2.6, 0, '#8a6a4a', 0, 0, 0, R + 1.5, 4, R + 1.5);
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU;
      this.metal.box(0.08, 0.9, 0.08, Math.cos(a) * (R + 0.4), 0.45, Math.sin(a) * (R + 0.4), '#f5f7ff');
    }
    addPartsToBatch(this.matte, pl.props);
    for (const p of pl.props) {
      const fp = partsFootprint([p]);
      if (!fp) continue;
      if (fp.x2 - fp.x1 > R || fp.z2 - fp.z1 > R) continue;
      if (Math.hypot(p.pos[0], p.pos[2] - (R - 4)) < 3 || Math.hypot(p.pos[0] - Math.cos(1.05) * (R - 1.8), p.pos[2] - Math.sin(1.05) * (R - 1.8)) < 3) continue;
      this.addCollider(fp.x1, fp.z1, fp.x2, fp.z2);
    }
    this.homeRing = portalRing(this, this.home.x, this.home.z, '#7fe0ff', 'برگشت به جزیره');
    this.finishBatches();
    const equipment = new THREE.Group();
    sc.add(equipment);
    pl.equipment.forEach((eq, i) => {
      const a = -Math.PI / 2 + (i - (pl.equipment.length - 1) / 2) * 0.7;
      const r = R * 0.5;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      placeEquipment(this, Object.assign({ id: item.id + '_' + i }, eq), x, z, Math.atan2(-x, -z), equipment);
    });
    this.clouds = cloudField(24, R + 10, R + 120, 8, 40);
    sc.add(this.clouds);
    for (let i = 0; i < 6; i++) this.addStation(rand(-R / 2, R / 2), rand(-R / 2, R / 3), rand(-3, 3), ['jack', 'pushup', 'squat', 'kick', 'jumpspin', 'rope']);
  }

  nearHome() {
    const p = this.player.ch.root.position;
    return Math.hypot(p.x - this.home.x, p.z - this.home.z) < 2.6;
  }

  updateExtra(dt) {
    this.clouds.rotation.y += dt * 0.008;
    this.homeRing.rotation.z += dt;
  }
}
