'use strict';
/*
 * "My level and strength": take away as many levels as you like, and wipe in one go every bit
 * of strength that did not come from exercise (temporary levels, the 1919 boost, levels you
 * chose for yourself on the Trick Field). Also the graphics presets: Go, Plus, Pro, Ultra, PC.
 */

const GRAPHICS = {
  go: { name: 'Go', desc: 'گوشی، تبلت و کامپیوترهای ضعیف: تصویر سبک‌تر و دید کوتاه‌تر، روون‌ترین حالت.', ratio: () => 0.7, far: 160, fog: 0.6, shadows: 0 },
  plus: { name: 'Plus', desc: 'گوشی، تبلت و کامپیوترهای معمولی: تصویر تمیز و روون.', ratio: (d) => Math.min(d, 1.25), far: 320, fog: 0.85, shadows: 0 },
  pro: { name: 'Pro', desc: 'گوشی، تبلت و کامپیوترهای قوی: تصویر تیز و دید بلند.', ratio: (d) => Math.min(d, 1.75), far: 520, fog: 1, shadows: 0 },
  ultra: { name: 'Ultra', desc: 'دستگاه‌های خیلی خیلی قوی: بیشترین وضوح و سایه‌ی واقعی همه‌چیز.', ratio: (d) => Math.min(d, 2), far: 700, fog: 1.15, shadows: 1024 },
  pc: { name: 'PC', desc: 'کامپیوترهای رومیزی: وضوح بالاتر از صفحه، سایه‌های دقیق و دورترین دید.', ratio: (d) => Math.min(Math.max(d, 1) * 1.35, 2.5), far: 900, fog: 1.3, shadows: 2048 },
};
const GRAPHICS_ORDER = ['go', 'plus', 'pro', 'ultra', 'pc'];

/** A first guess for new players: phones and tablets Plus, computers Pro. */
function defaultGraphics() {
  const touch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 1;
  return touch ? 'plus' : 'pro';
}

Object.assign(Game, {
  /* ---------------- my level ---------------- */

  openLevels() {
    this.closeModal('menuModal');
    this.renderLevels();
    this.openModal('levelsModal');
  },

  cheatParts() {
    const s = this.save;
    const parts = [];
    const t = this.tempActive('str');
    if (t) parts.push([`⏳ سطح‌های موقت زور`, t]);
    const tr = this.tempActive('run');
    if (tr) parts.push([`⏳ سطح‌های موقت دویدن`, tr]);
    if (this.boostActive()) parts.push(['⚡ کد ۱۹۱۹', BOOST_LEVELS]);
    if (s.cheatLv > 0) parts.push(['🎯 زوری که توی زمین حرکات ویژه خودت انتخاب کردی', Math.min(s.cheatLv, s.level - 1)]);
    return parts;
  },

  renderLevels() {
    const s = this.save;
    const g2 = this.track === 'g2';
    $('lvInfo').textContent = g2
      ? `توی باشگاه فولادی؛ سطح این‌جا ${fa(s.g2.level)}ـه. هر چقدر بنویسی از همین سطح کم می‌شه.`
      : `سطح زورت ${fa(this.lv())}ـه (${fa(s.level)} از ورزش و بقیه‌اش موقت یا تقلبی). هر چقدر بنویسی از سطحت کم می‌شه.`;
    const parts = this.cheatParts();
    const box = $('cheatInfo');
    box.innerHTML = '';
    if (!parts.length) {
      box.textContent = '✅ الان هیچ زور تقلبی‌ای نداری؛ همه‌ی زورت مال ورزش خودته.';
    } else {
      for (const [name, n] of parts) {
        const row = document.createElement('div');
        row.className = 'cheat-row';
        row.textContent = `${name}: ${fa(n)} سطح`;
        box.appendChild(row);
      }
    }
    $('cheatBtn').disabled = !parts.length;
    $('lvCutBtn').textContent = '➖ کم کن';
    this.cutArmed = false;
  },

  /** Take away n levels from the level you are on now (two taps for safety). */
  cutLevels() {
    const n = Math.floor(Number(digitsOnly($('lvCut').value)) || 0);
    if (!(n > 0)) { this.toast('یه عدد بنویس: چند سطح کم بشه؟', 'warn'); return; }
    if (!this.cutArmed) {
      this.cutArmed = true;
      $('lvCutBtn').textContent = `مطمئنی؟ ${fa(n)} سطح کم بشه`;
      return;
    }
    this.cutArmed = false;
    const s = this.prog();
    const before = s.level;
    s.level = Math.max(1, s.level - n);
    s.xp = Math.min(s.xp, this.need(s.level) - 1);
    if (this.track !== 'g2') this.save.cheatLv = Math.min(this.save.cheatLv || 0, s.level - 1);
    const lost = before - s.level;
    setPlayerLevelLook(this.player, this.lv());
    this.labelPlayer();
    this.refreshPowers(true);
    this.refreshHud(true);
    this.refreshMoves();
    this.persist();
    Sfx.play('click');
    this.toast(lost ? `➖ ${fa(lost)} سطح کم شد. حالا سطح ${fa(this.gymLv())} هستی.` : 'سطحت ۱ـه؛ کمتر از این نمی‌شه.');
    $('lvCut').value = '';
    this.renderLevels();
  },

  /** Keep only what exercise gave you. */
  purgeCheats() {
    const s = this.save;
    const before = this.lv();
    s.temp = [];
    this.tempXp = { str: 0, run: 0 };
    if (this.boostActive()) s.boost.until = 0;
    const cut = Math.min(s.cheatLv || 0, s.level - 1);
    if (cut > 0) {
      s.level -= cut;
      s.xp = Math.min(s.xp, xpNeed(s.level) - 1);
    }
    s.cheatLv = 0;
    const lost = before - this.lv();
    setPlayerLevelLook(this.player, this.lv());
    this.labelPlayer();
    this.refreshPowers(true);
    this.refreshHud(true);
    this.refreshMoves();
    this.persist();
    Sfx.play('whoosh');
    this.toast(`🧹 زور تقلبی پاک شد${lost > 0 ? ` (−${fa(lost)} سطح)` : ''}. حالا فقط زور ورزش خودت مونده: سطح ${fa(this.lv())}.`, 'gold');
    this.renderLevels();
  },

  /* ---------------- graphics ---------------- */

  graphicsKey() {
    const q = this.save.settings.quality;
    return GRAPHICS[q] ? q : 'plus';
  },

  renderGraphics() {
    const k = this.graphicsKey();
    document.querySelectorAll('#gfxSeg button').forEach((b) => b.classList.toggle('on', b.dataset.q === k));
    $('gfxDesc').textContent = GRAPHICS[k].desc + (this.aaNeedsReload ? ' (صاف‌کردن لبه‌ها بعد از باز کردن دوباره‌ی بازی عوض می‌شه.)' : '');
  },

  /** Resolution, view distance and real shadows for the chosen preset. */
  applyGraphics() {
    const G = GRAPHICS[this.graphicsKey()];
    const dpr = window.devicePixelRatio || 1;
    this.pixelRatio = G.ratio(dpr);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.camera.far = G.far;
    this.camera.updateProjectionMatrix();
    const r = this.renderer;
    r.shadowMap.enabled = !!G.shadows;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.aaNeedsReload = (this.graphicsKey() === 'go') === this.antialias;
    this.shadowSize = G.shadows;
    this.fogScale = G.fog;
    if (!G.shadows && this.world) for (const c of [this.player && this.player.ch, ...this.world.npcs.map((n) => n.ch)]) if (c && c.shadow) c.shadow.visible = true;
    if (this.world) this.dressWorld(this.world);
    this.resize();
  },

  /** Fog distance and shadows for one world (on entering it and when the preset changes). */
  dressWorld(w) {
    const f = w.scene.fog;
    if (f) {
      if (!f.userData) f.userData = {};
      if (f.userData.near == null) { f.userData.near = f.near; f.userData.far = f.far; }
      f.near = f.userData.near * this.fogScale;
      f.far = f.userData.far * this.fogScale;
    }
    const on = !!this.shadowSize;
    if (!w.sun) w.scene.traverse((o) => { if (!w.sun && o.isDirectionalLight) w.sun = o; });
    if (w.sun) {
      w.sun.castShadow = on;
      if (on) {
        const S = w.sun.shadow;
        if (S.mapSize.x !== this.shadowSize) {
          S.mapSize.set(this.shadowSize, this.shadowSize);
          if (S.map) { S.map.dispose(); S.map = null; }
        }
        const c = S.camera;
        c.left = -22; c.right = 22; c.top = 22; c.bottom = -22; c.near = 1; c.far = 120;
        c.updateProjectionMatrix();
        S.bias = -0.0005;
        S.normalBias = 0.02;
        if (!w.sun.target.parent) w.scene.add(w.sun.target);
        w.sunDir = w.sun.position.clone().normalize();
      }
    }
    if (w.shadowsOn !== on) {
      w.shadowsOn = on;
      w.scene.traverse((o) => {
        if (!o.isMesh) return;
        const fx = o.material && (o.material.transparent || o.material.blending === THREE.AdditiveBlending);
        o.castShadow = on && !fx;
        o.receiveShadow = on && !fx && !o.isSkinnedMesh;
      });
    }
  },

  /** Real shadows follow you around. */
  tickShadows() {
    const w = this.world;
    if (w && this.dressed !== w) { this.dressed = w; this.dressWorld(w); }
    if (!this.shadowSize || !w || !w.sun || !w.sunDir || !this.player) return;
    const p = this.player.ch.root.position;
    w.sun.target.position.set(p.x, 0, p.z);
    w.sun.position.set(p.x + w.sunDir.x * 50, w.sunDir.y * 50, p.z + w.sunDir.z * 50);
    // new people and things that arrived since: let them cast shadows too
    w.shadowT = (w.shadowT || 0) + 1;
    if (w.shadowT % 90 === 0) { w.shadowsOn = null; this.dressWorld(w); }
    for (const c of [this.player.ch, ...w.npcs.map((n) => n.ch)]) if (c.shadow) c.shadow.visible = false;
  },
});
