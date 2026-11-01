'use strict';
/*
 * Twelve golden dumbbells hidden around the gym and the places you can travel to. Each one
 * gives coins; all twelve give a big prize and a medal. The menu shows hints.
 */

const GOLD_SPOTS = [
  { id: 'g1', w: 'gym', x: -120, z: -20, hint: 'باغ الهام، ته باشگاه سمت غرب' },
  { id: 'g2', w: 'gym', x: 120, z: -25, hint: 'پیست نینجا، سمت شرق' },
  { id: 'g3', w: 'gym', x: 166, z: 26, hint: 'تالار انرژی و دو، یه گوشه‌ی دنج' },
  { id: 'g4', w: 'gym', x: -70, z: 26, hint: 'بال غربی، نزدیک آبمیوه‌بار' },
  { id: 'g5', w: 'pool', x: 17, z: -9, hint: 'استخر المپیک، کنار چتر آفتابی' },
  { id: 'g6', w: 'dojo', x: 12, z: 12, hint: 'باغ رزمی ساکورا' },
  { id: 'g7', w: 'beach', x: 15, z: 15, hint: 'ساحل والیبال، نزدیک آب' },
  { id: 'g8', w: 'snow', x: -10, z: 10, hint: 'کوهستان برفی' },
  { id: 'g9', w: 'tricks', x: 18, z: -18, hint: 'زمین حرکات ویژه، بیرون زمین شطرنجی' },
  { id: 'g10', w: 'gym2', x: -20, z: -15, hint: 'باشگاه فولاد' },
  { id: 'g11', w: 'island', x: 10, z: -10, hint: 'جزیره‌ی ابرها' },
  { id: 'g12', w: 'lucky', x: 12, z: 12, hint: 'جزیره‌ی خوش‌شانسی' },
];

ACHIEVEMENTS.push({ id: 'gold12', name: 'گنج‌یاب', icon: '🏆', desc: 'هر ۱۲ دمبل طلایی رو پیدا کن', test: (s) => (s.goldFound || []).length >= GOLD_SPOTS.length });

function goldDumbbellMesh() {
  const b = new Batch();
  b.cyl(0.05, 0.9, 0, 0, 0, '#fff1b0', 0, 0, Math.PI / 2, 10);
  for (const s of [-1, 1]) {
    b.cyl(0.22, 0.1, s * 0.33, 0, 0, '#ffcf33', 0, 0, Math.PI / 2, 16);
    b.cyl(0.17, 0.08, s * 0.43, 0, 0, '#e6b800', 0, 0, Math.PI / 2, 16);
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(mergeParts(b.parts, false), METAL_MAT));
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 32), new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  g.add(halo);
  g.userData.noSolid = true;
  g.userData.halo = halo;
  return g;
}

Object.assign(Game, {
  goldFound() {
    if (!Array.isArray(this.save.goldFound)) this.save.goldFound = [];
    return this.save.goldFound;
  },

  /** Place the dumbbells of this place that are still to find (on a clear spot near their mark). */
  placeGold(w) {
    const key = this.worldKey(w);
    w.goldItems = [];
    const found = this.goldFound();
    for (const g of GOLD_SPOTS) {
      if (g.w !== key || found.includes(g.id)) continue;
      let x = g.x, z = g.z;
      outer: for (let r = 0; r < 12; r += 0.5) {
        for (let a = 0; a < TAU; a += Math.PI / 6) {
          const tx = g.x + Math.cos(a) * r, tz = g.z + Math.sin(a) * r;
          if (w.inBounds(tx, tz, 1) && w.spotFree(tx, tz, 0.7)) { x = tx; z = tz; break outer; }
          if (r === 0) break;
        }
      }
      const mesh = goldDumbbellMesh();
      mesh.position.set(x, 1.1 + w.groundAt(x, z, 0.3), z);
      w.scene.add(mesh);
      w.goldItems.push({ g, mesh });
    }
  },

  tickGold(dt) {
    const w = this.world;
    if (!w || this.mode !== 'play') return;
    if (w.goldFor !== w) { w.goldFor = w; this.placeGold(w); }
    if (!w.goldItems || !w.goldItems.length) return;
    const p = this.player.ch.root.position;
    const t = this.clock;
    for (const it of [...w.goldItems]) {
      const m = it.mesh;
      m.rotation.y = t * 1.6;
      m.userData.halo.rotation.z = t;
      m.userData.halo.material.opacity = 0.35 + 0.2 * Math.sin(t * 4);
      if (Math.random() < dt * 4) w.fx.emit(m.position.x + rand(-0.4, 0.4), m.position.y + rand(-0.3, 0.4), m.position.z + rand(-0.4, 0.4), 0, 0.6, 0, new THREE.Color('#ffe066'), 0.6, 0);
      if (Math.hypot(p.x - m.position.x, p.z - m.position.z) < 1.2 && p.y + this.player.ch.airY < m.position.y + 0.8) this.takeGold(w, it);
    }
  },

  takeGold(w, it) {
    w.scene.remove(it.mesh);
    w.goldItems.splice(w.goldItems.indexOf(it), 1);
    const found = this.goldFound();
    if (found.includes(it.g.id)) return;
    found.push(it.g.id);
    const n = found.length;
    const all = n >= GOLD_SPOTS.length;
    const p = it.mesh.position;
    w.fx.burst({ x: p.x, y: p.y, z: p.z }, { count: 80, colors: ['#ffd34d', '#fff1b0', '#ffffff'], speed: 4, up: 4, life: 1.1 });
    Sfx.play(all ? 'win' : 'unlock');
    this.addCoins(all ? 3000 : 150);
    if (all) {
      this.confetti();
      this.showBanner('+۳٬۰۰۰ سکه و مدال «گنج‌یاب»', '🏆 هر ۱۲ دمبل طلایی!');
    } else this.toast(`🏆 دمبل طلایی پیدا کردی! (${fa(n)} از ${fa(GOLD_SPOTS.length)}) • 🪙 ۱۵۰`, 'gold');
    this.checkAchievements();
    this.persist();
  },

  openGold() {
    this.closeModal('menuModal');
    const list = $('goldList');
    list.innerHTML = '';
    const found = this.goldFound();
    for (const g of GOLD_SPOTS) {
      const li = document.createElement('li');
      const ok = found.includes(g.id);
      li.className = ok ? 'open' : '';
      li.textContent = `${ok ? '✅' : '❔'} ${g.hint}`;
      list.appendChild(li);
    }
    $('goldHead').textContent = `${fa(found.length)} از ${fa(GOLD_SPOTS.length)} پیدا شده • هر کدوم ۱۵۰ سکه، همه‌شون ۳٬۰۰۰ سکه و یه مدال`;
    this.openModal('goldModal');
  },
});
