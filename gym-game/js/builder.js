'use strict';
/*
 * Build mode, game side: the 🛠️ button in the first gym and in the Steel Gym. Walk around and
 * add pieces (they appear in front of you as a green ghost, red where they don't fit), pick
 * pieces up and move them, turn them, or delete them. In the Steel Gym you can also repaint
 * the walls, floor and lights, rename it, or put the original layout back.
 */

const BUILD_GROUPS = [
  { id: 'g2', name: '⚙️ باشگاه فولاد' },
  { id: 'g3', name: '🏛️ معبد تایتان‌ها' },
  { id: 'g4', name: '🌌 المپ کیهانی' },
  { id: 'decor', name: '🗿 تزئینات' },
];

const _ghostOk = new THREE.MeshBasicMaterial({ color: '#2ecc71', transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false });
const _ghostBad = new THREE.MeshBasicMaterial({ color: '#ff3b4d', transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false });

Object.assign(Game, {
  buildKey() {
    if (this.world === this.gym) return 'gym';
    if (this.where === 'env' && this.envId === 'gym2') return 'gym2';
    return null;
  },

  layoutFor(key) {
    const B = this.save.build;
    if (key === 'gym2') return B.gym2 || G2_DEFAULT_LAYOUT.map((i) => Object.assign({}, i));
    return B.gym;
  },

  applyLayout(w, key) {
    for (const item of this.layoutFor(key)) if (PLACEABLES[item.type]) w.addPlaced(item);
  },

  /** Store the current pieces of this world. */
  saveLayout() {
    const key = this.buildKey();
    if (!key) return;
    const items = [...this.world.placed.values()].map((p) => ({ id: p.item.id, type: p.item.type, x: p.item.x, z: p.item.z, rot: p.item.rot }));
    this.save.build[key] = items;
    this.persist();
    this.refreshMoves();
  },

  /* ---------------- build mode ---------------- */

  toggleBuild() {
    if (this.build) { this.exitBuild(); return; }
    const key = this.buildKey();
    if (!key || this.mode !== 'play' || this.race || this.arm || this.photo) return;
    this.cancelChallenge();
    if (!this.world.placed) this.world.placed = new Map();
    this.build = { key, mode: 'browse', ghost: null, item: null, sel: null };
    $('hud').classList.add('build-on');
    $('buildBar').hidden = false;
    $('bTheme').hidden = key !== 'gym2';
    this.renderBuildBar();
    Sfx.play('click');
    this.toast(key === 'gym2'
      ? '🛠️ حالت ساخت: باشگاه فولاد مال توئه! هر وسیله‌ای رو جابه‌جا کن، بچرخون، حذف کن یا وسیله‌ی تازه بذار. رنگ و اسمش رو هم عوض کن.'
      : '🛠️ حالت ساخت: ورزش‌های باشگاه‌های دیگه رو این‌جا اضافه کن. راه برو و دکمه‌ی «➕ اضافه» رو بزن.', 'gold');
  },

  exitBuild() {
    if (!this.build) return;
    this.dropGhost();
    if (this.build.marker) this.world.scene.remove(this.build.marker);
    this.build = null;
    $('hud').classList.remove('build-on');
    $('buildBar').hidden = true;
    this.refreshMoves();
  },

  renderBuildBar() {
    const B = this.build;
    const placing = B.mode === 'place';
    for (const id of ['bAdd', 'bMove', 'bRot', 'bDel', 'bTheme', 'bExit']) $(id).hidden = placing;
    if (!placing) $('bTheme').hidden = B.key !== 'gym2';
    for (const id of ['bTurn', 'bPut', 'bCancel']) $(id).hidden = !placing;
    const sel = B.sel && this.world.placed.get(B.sel);
    for (const id of ['bMove', 'bRot', 'bDel']) $(id).disabled = !sel;
    const def = sel && PLACEABLES[sel.item.type];
    $('buildInfo').textContent = placing
      ? `${PLACEABLES[B.item.type].icon} ${PLACEABLES[B.item.type].name}: راه برو تا سبز بشه، بعد «بذار این‌جا»`
      : sel ? `انتخاب شده: ${def.icon} ${def.name}` : 'برو کنار یه وسیله تا انتخاب بشه، یا وسیله‌ی تازه اضافه کن';
  },

  openBuildCatalog() {
    const B = this.build;
    const grid = $('buildGrid');
    grid.innerHTML = '';
    const groups = B.key === 'gym2' ? BUILD_GROUPS.filter((g) => g.id === 'g2' || g.id === 'decor') : BUILD_GROUPS;
    for (const g of groups) {
      const h = document.createElement('div');
      h.className = 'map-head';
      h.textContent = g.name;
      grid.appendChild(h);
      for (const [type, def] of Object.entries(PLACEABLES)) {
        if (def.group !== g.id) continue;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'map-card';
        const mv = def.equip && MOVES.find((m) => m.equip === def.equip);
        const i = document.createElement('span');
        i.className = 'map-icon';
        i.textContent = def.icon;
        const n = document.createElement('b');
        n.textContent = def.name;
        const d = document.createElement('small');
        d.textContent = mv ? `ورزش: ${mv.name}${mv.zone ? ` (فقط سطح ${fa(mv.zone)}+)` : ''}` : 'تزئینی';
        b.append(i, n, d);
        b.addEventListener('click', () => { this.closeModal('buildModal'); this.startPlacing({ id: this.newPieceId(), type, x: 0, z: 0, rot: 0 }); });
        grid.appendChild(b);
      }
    }
    this.openModal('buildModal');
  },

  newPieceId() {
    this.save.build.nextId = (this.save.build.nextId || 0) + 1;
    return 'p' + this.save.build.nextId;
  },

  startPlacing(item, from) {
    const B = this.build;
    this.dropGhost();
    // a new piece faces the way you are looking, so it grows away from you
    if (!from) item.rot = ((Math.round(this.player.ch.root.rotation.y / (Math.PI / 2)) % 4) + 4) % 4;
    B.mode = 'place';
    B.item = item;
    B.from = from || null;
    B.ghostOk = B.ghostBad = null;
    this.renderBuildBar();
    Sfx.play('click');
  },

  dropGhost() {
    const B = this.build;
    if (!B) return;
    for (const k of ['ghostOk', 'ghostBad']) if (B[k]) { this.world.scene.remove(B[k].group); B[k] = null; }
  },

  /** Where the piece would go: a few steps ahead of you, on a 0.5 m grid. */
  ghostSpot() {
    const B = this.build;
    const p = this.player.ch.root.position;
    const yaw = this.player.ch.root.rotation.y;
    const def = PLACEABLES[B.item.type];
    const reach = 1.4 + Math.max(def.fp[3] - def.fp[1], def.fp[2] - def.fp[0]) / 2;
    const it = Object.assign({}, B.item);
    it.x = Math.round((p.x + Math.sin(yaw) * reach) * 2) / 2;
    it.z = Math.round((p.z + Math.cos(yaw) * reach) * 2) / 2;
    // keep the player outside the footprint
    const r = this.world.placedRect(it);
    if (p.x > r.x1 - 0.4 && p.x < r.x2 + 0.4 && p.z > r.z1 - 0.4 && p.z < r.z2 + 0.4) {
      it.x += Math.sin(yaw) * 2;
      it.z += Math.cos(yaw) * 2;
    }
    return it;
  },

  tickBuild() {
    const B = this.build;
    if (!B) return;
    const w = this.world;
    if (this.buildKey() !== B.key) { this.exitBuild(); return; }
    if (B.mode === 'place') {
      const it = this.ghostSpot();
      Object.assign(B.item, { x: it.x, z: it.z });
      const why = w.canPlace(B.item, B.from);
      B.why = why;
      const want = why ? 'ghostBad' : 'ghostOk';
      const other = why ? 'ghostOk' : 'ghostBad';
      if (!B[want] || B[want].rot !== B.item.rot) {
        if (B[want]) w.scene.remove(B[want].group);
        B[want] = w.addPlaced(Object.assign({}, B.item), why ? _ghostBad : _ghostOk);
        B[want].rot = B.item.rot;
      }
      B[want].group.visible = true;
      B[want].group.position.set(B.item.x, 0.01, B.item.z);
      if (B[other]) B[other].group.visible = false;
      return;
    }
    // browsing: select the nearest piece
    const p = this.player.ch.root.position;
    let best = null;
    let bd = 3.5;
    for (const pl of w.placed.values()) {
      const r = w.placedRect(pl.item);
      const d = Math.hypot(clamp(p.x, r.x1, r.x2) - p.x, clamp(p.z, r.z1, r.z2) - p.z);
      if (d < bd) { bd = d; best = pl; }
    }
    const id = best ? best.item.id : null;
    if (id !== B.sel) {
      B.sel = id;
      if (B.marker) { w.scene.remove(B.marker); B.marker = null; }
      if (best) {
        const r = w.placedRect(best.item);
        const g = new THREE.Mesh(new THREE.PlaneGeometry(r.x2 - r.x1 + 0.3, r.z2 - r.z1 + 0.3), new THREE.MeshBasicMaterial({ color: '#ffd34d', transparent: true, opacity: 0.28, depthWrite: false }));
        g.rotation.x = -Math.PI / 2;
        g.position.set((r.x1 + r.x2) / 2, 0.06, (r.z1 + r.z2) / 2);
        w.scene.add(g);
        B.marker = g;
      }
      this.renderBuildBar();
    }
    if (B.marker) B.marker.material.opacity = 0.2 + 0.12 * Math.sin(this.clock * 6);
  },

  buildPut() {
    const B = this.build;
    const w = this.world;
    const why = w.canPlace(B.item, B.from);
    if (why) {
      Sfx.play('error');
      this.toast(why === 'wall' ? '⛔ از دیوار بیرون می‌زنه. یه کم جلوتر برو.' : why === 'spot' ? '⛔ جلوی یه وسیله یا جای ورزش رو می‌گیره.' : '⛔ این‌جا یه چیز دیگه هست. جای خالی پیدا کن.', 'warn');
      return;
    }
    if (B.from) w.removePlaced(B.from);
    B.carried = null;
    w.addPlaced(Object.assign({}, B.item));
    const p = w.placed.get(B.item.id);
    w.fx.burst({ x: B.item.x, y: 0.6, z: B.item.z }, { count: 40, colors: ['#ffd34d', '#2ecc71', '#ffffff'], speed: 2.5, up: 3, life: 1 });
    Sfx.play('success');
    const def = PLACEABLES[B.item.type];
    const mv = def.equip && MOVES.find((m) => m.equip === def.equip);
    if (mv && B.key === 'gym') this.toast(`✅ «${def.name}» اضافه شد! ورزشش («${mv.name}») توی زبانه‌ی «🧩 اضافه‌شده» هست.`, 'gold');
    this.dropGhost();
    B.mode = 'browse';
    B.item = null;
    B.from = null;
    B.sel = null;
    if (p) this.saveLayout();
    this.renderBuildBar();
  },

  buildCancel() {
    const B = this.build;
    // a picked-up piece goes back where it was
    if (B.carried) B.carried.group.visible = true;
    B.carried = null;
    this.dropGhost();
    B.mode = 'browse';
    B.item = null;
    B.from = null;
    this.renderBuildBar();
  },

  buildMove() {
    const B = this.build;
    const pl = B.sel && this.world.placed.get(B.sel);
    if (!pl) return;
    B.fromItem = Object.assign({}, pl.item);
    this.startPlacing(Object.assign({}, pl.item), pl.item.id);
    // hide the original while it is being carried
    pl.group.visible = false;
    B.carried = pl;
  },

  buildRotate() {
    const B = this.build;
    if (B.mode === 'place') {
      B.item.rot = ((B.item.rot || 0) + 1) % 4;
      Sfx.play('click');
      return;
    }
    const pl = B.sel && this.world.placed.get(B.sel);
    if (!pl) return;
    const it = Object.assign({}, pl.item, { rot: ((pl.item.rot || 0) + 1) % 4 });
    if (this.world.canPlace(it, it.id)) { Sfx.play('error'); this.toast('⛔ این‌جا جای چرخیدن نداره. اول جابه‌جاش کن.', 'warn'); return; }
    this.world.removePlaced(it.id);
    this.world.addPlaced(it);
    B.sel = null;
    Sfx.play('success');
    this.saveLayout();
  },

  buildDelete() {
    const B = this.build;
    const pl = B.sel && this.world.placed.get(B.sel);
    if (!pl) return;
    const def = PLACEABLES[pl.item.type];
    this.world.removePlaced(pl.item.id);
    if (B.marker) { this.world.scene.remove(B.marker); B.marker = null; }
    B.sel = null;
    Sfx.play('clank');
    this.toast(`🗑️ «${def.name}» برداشته شد.`);
    this.saveLayout();
    this.renderBuildBar();
  },

  /* ---------------- Steel Gym colours and name ---------------- */

  openTheme() {
    const th = Object.assign({}, G2_THEME_DEFAULT, this.save.build.gym2Theme);
    const row = (id, list, cur, onPick, paint) => {
      const box = $(id);
      box.innerHTML = '';
      list.forEach((v) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'swatch' + (JSON.stringify(v) === JSON.stringify(cur) ? ' on' : '');
        b.style.background = paint(v);
        b.addEventListener('click', () => { onPick(v); this.openTheme(); });
        box.appendChild(b);
      });
    };
    const set = (k, v) => { this.save.build.gym2Theme = Object.assign({}, th, { [k]: v }); };
    row('thWall', G2_THEMES.wall, th.wall, (v) => set('wall', v), (v) => v);
    row('thFloor', G2_THEMES.floor, th.floor, (v) => set('floor', v), (v) => `linear-gradient(135deg, ${v[0]} 50%, ${v[1]} 50%)`);
    row('thLight', G2_THEMES.light, th.light, (v) => set('light', v), (v) => v);
    $('thName').value = th.name || '';
    this.openModal('themeModal');
  },

  applyTheme() {
    const name = $('thName').value.replace(/[<>]/g, '').trim().slice(0, 24);
    this.save.build.gym2Theme = Object.assign({}, G2_THEME_DEFAULT, this.save.build.gym2Theme, { name });
    this.closeModal('themeModal');
    this.rebuildGym2('🎨 باشگاه فولاد رنگ تازه گرفت!');
  },

  resetGym2() {
    this.save.build.gym2 = null;
    this.save.build.gym2Theme = null;
    this.closeModal('themeModal');
    this.rebuildGym2('↩️ باشگاه فولاد مثل اولش شد.');
  },

  /** Build the Steel Gym again with the new look and keep the player where they stand. */
  rebuildGym2(msg) {
    const old = this.envs.get('gym2');
    if (!old) return;
    const P = this.player;
    const pos = P.ch.root.position.clone();
    const yaw = P.ch.root.rotation.y;
    const wasBuilding = !!this.build;
    if (wasBuilding) this.exitBuild();
    if (this.pet) old.scene.remove(this.pet.root);
    // residents move over to the new building
    for (const n of [...old.npcs]) old.dropNpc && old.dropNpc(n);
    this.envs.delete('gym2');
    const w = this.getEnv('gym2');
    w.enter(P, { x: pos.x, z: pos.z, yaw, camYaw: old.cam.yaw });
    this.world = w;
    this.attachPet();
    this.persist();
    Sfx.play('win');
    this.toast(msg, 'gold');
    if (wasBuilding) this.toggleBuild();
  },
});
