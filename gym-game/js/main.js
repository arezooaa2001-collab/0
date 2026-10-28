'use strict';
/* Game controller: HUD, input, progression, saving, travel between worlds and the arena.
 * Shop, missions, medals, map, race and the boost code live in features.js. */

const SAVE_KEY = 'zoor-gym-save-v1';

const Game = {
  save: null,
  mode: 'menu', // menu | play | arena | transition
  where: 'gym', // gym | island | place | env
  envId: null,
  keys: new Set(),
  joy: { x: 0, y: 0, id: null },
  camDrag: new Map(),
  combo: 0,
  lastExerciseEnd: -10,
  runXpShown: 0,
  clock: 0,
  modals: new Set(),
  pendingJump: false,
  errorShown: false,
  places: new Map(),
  envs: new Map(),
  aiBusy: false,
  customMoves: [],
  race: null,
  pet: null,

  loadSave() {
    const d = {
      level: 1, xp: 0, stage: 1, unlocked: false, muted: false, color: 0, wins: 0, losses: 0,
      name: '', npcs: null, mode: 'walk', runLevel: 1, runXp: 0, islandSeen: false,
      coins: 0, music: false, tab: 'base', achievements: [], missions: [],
    };
    const s = Store.get(SAVE_KEY, null);
    this.save = Object.assign(d, s && typeof s === 'object' ? s : {});
    const v = this.save;
    v.level = Math.max(1, Math.floor(Number(v.level) || 1));
    v.xp = Math.max(0, Number(v.xp) || 0);
    v.runLevel = Math.max(1, Math.floor(Number(v.runLevel) || 1));
    v.runXp = Math.max(0, Number(v.runXp) || 0);
    v.stage = Math.max(1, Math.floor(Number(v.stage) || 1));
    v.coins = Math.max(0, Math.floor(Number(v.coins) || 0));
    v.color = clamp(Math.floor(Number(v.color) || 0), 0, PLAYER_COLORS.length - 1);
    if (!['walk', 'run', 'jumprun'].includes(v.mode)) v.mode = 'walk';
    if (!['base', 'new', 'env', 'ai'].includes(v.tab)) v.tab = 'base';
    const obj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
    v.shop = Object.assign({ owned: [], shirt: null, band: null, aura: null, pet: null }, obj(v.shop));
    if (!Array.isArray(v.shop.owned)) v.shop.owned = [];
    v.stats = Object.assign({ reps: 0, moves: {}, visited: [], raceWins: 0, coinsEarned: 0, maxCombo: 0, missionsDone: 0, equipReps: 0 }, obj(v.stats));
    v.stats.moves = obj(v.stats.moves);
    if (!Array.isArray(v.stats.visited)) v.stats.visited = [];
    v.boost = Object.assign({ used: false, until: 0 }, obj(v.boost));
    if (!Array.isArray(v.achievements)) v.achievements = [];
    if (!Array.isArray(v.missions)) v.missions = [];
  },

  persist() {
    const s = this.save;
    s.npcs = this.gym ? this.gym.npcs.map((n) => ({ l: n.level, x: Math.round(n.xp) })) : s.npcs;
    Store.set(SAVE_KEY, s);
  },

  playerName() { return this.save.name || 'قهرمان'; },

  /** Strength level including the temporary 1919 boost. */
  lv() { return this.save.level + (this.boostActive() ? BOOST_LEVELS : 0); },
  boostActive() { return Date.now() < (this.save.boost.until || 0); },
  stats() { return { level: this.lv(), runLevel: this.save.runLevel, speedMult: this.owns('shoes') ? 1.15 : 1 }; },
  envKey() { return this.where === 'env' ? this.envId : this.where; },

  /* ---------------- boot ---------------- */

  init() {
    THREE.ColorManagement.legacyMode = false;
    const canvas = $('scene');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      $('noGl').hidden = false;
      return;
    }
    this.renderer = renderer;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(this.pixelRatio);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 700);
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.loadSave();
    Sfx.setMuted(this.save.muted);
    this.gym = new GymWorld();
    this.gym.spawnNpcs(NPC_NAMES, this.save.npcs);
    this.player = createPlayer(this.outfit(), this.lv());
    this.player.mode = this.save.mode;
    this.gym.enter(this.player);
    this.world = this.gym;
    this.gym.onTowerDone = (lvl, rang) => this.towerResult(lvl, rang);
    this.arena = new Arena();
    this.attachPet();

    this.buildMoves();
    this.bindUi();
    this.bindInput();
    this.ensureMissions();
    Creations.onChange((items) => this.onCreations(items));
    Creations.init();
    this.refreshHud(true);
    this.updateWorldHud();
    this.openStart();

    setInterval(() => { if (this.mode === 'play') this.persist(); }, 6000);
    window.addEventListener('pagehide', () => this.persist());
    this.last = performance.now();
    this.fpsT = 0;
    this.fpsN = 0;
    requestAnimationFrame((t) => this.frame(t));
  },

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 68 : 55;
    this.camera.updateProjectionMatrix();
  },

  /* ---------------- moves panel ---------------- */

  isUnlocked(m) { return m.custom || this.save.unlocked || this.lv() >= m.level; },

  moveButton(m) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mv-btn' + (m.toggle ? ' toggle' : '') + (m.equip ? ' equip' : '') + (m.custom ? ' custom' : '');
    b.dataset.id = m.id;
    b.dataset.cat = m.custom ? 'ai' : m.cat;
    b.innerHTML = `<span class="mv-icon"></span><span class="mv-name"></span><span class="mv-sub"></span><span class="mv-lock">🔒 سطح ${fa(m.level || 1)}</span>`;
    b.querySelector('.mv-icon').textContent = m.icon;
    b.querySelector('.mv-name').textContent = m.name;
    b.addEventListener('click', () => this.onMove(m));
    return b;
  },

  buildMoves() {
    const grid = $('moveGrid');
    grid.innerHTML = '';
    this.moveBtns = {};
    for (const m of MOVES) {
      const b = this.moveButton(m);
      grid.appendChild(b);
      this.moveBtns[m.id] = b;
    }
    this.setTab(this.save.tab);
  },

  setTab(tab) {
    this.save.tab = tab;
    $('moveGrid').dataset.tab = tab;
    document.querySelectorAll('.mv-tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
    $('moveGrid').scrollTop = 0;
  },

  /** Exercises the AI made show up as extra buttons that work anywhere. */
  setCustomMoves(items) {
    const grid = $('moveGrid');
    for (const m of this.customMoves) { this.moveBtns[m.id].remove(); delete this.moveBtns[m.id]; }
    this.customMoves = items.filter((c) => c.kind === 'exercise').slice(0, 12).map((c) => ({
      id: 'ai_' + c.id, name: c.name, icon: c.icon, custom: true, level: 1, anim: c.anim, effect: c.effect,
    }));
    for (const m of this.customMoves) {
      const b = this.moveButton(m);
      grid.appendChild(b);
      this.moveBtns[m.id] = b;
    }
    $('tabAi').hidden = !this.customMoves.length;
    this.refreshMoves();
  },

  nearEquip(type) {
    if (EQUIP[type].env !== this.envKey()) return null;
    const r = this.world.nearestStation((s) => s.equip === type);
    return r && r.d < 2.4 ? r.s : null;
  },

  envName(env) { return env === 'gym' ? 'باشگاه' : (ENV_BY_ID[env] ? ENV_BY_ID[env].name : env); },

  refreshMoves() {
    const P = this.player;
    const busy = !this.world.canAct();
    const mult = xpMult(this.save.level);
    const here = this.envKey();
    for (const m of [...MOVES, ...this.customMoves]) {
      const b = this.moveBtns[m.id];
      if (!b) continue;
      const un = this.isUnlocked(m);
      b.classList.toggle('locked', !un);
      b.classList.toggle('active', !!m.toggle && P.mode === m.id);
      b.classList.toggle('wait', !m.toggle && busy && un);
      let sub;
      if (m.toggle) sub = P.mode === m.id ? 'روشن' : 'خاموش';
      else if (m.custom) sub = effectText(m.effect);
      else if (m.equip) {
        const env = EQUIP[m.equip].env;
        const near = env === here ? this.nearEquip(m.equip) : null;
        b.classList.toggle('near', !!near);
        b.classList.toggle('here', env === here);
        sub = near ? `آماده • ${fa(Math.round(m.xp * mult))} زور` : env === here ? `📍 ${EQUIP[m.equip].name}` : `🗺️ ${this.envName(env)}`;
      } else sub = `${fa(Math.round(m.xp * mult))} زور`;
      const subEl = b.querySelector('.mv-sub');
      if (subEl.textContent !== sub) subEl.textContent = sub;
    }
  },

  shakeBtn(id) {
    const b = this.moveBtns[id];
    if (!b) return;
    b.classList.remove('shake');
    void b.offsetWidth;
    b.classList.add('shake');
  },

  onMove(m) {
    if (this.mode !== 'play' || this.modals.size || this.race) return;
    Sfx.init();
    if (!this.isUnlocked(m)) {
      Sfx.play('error');
      this.toast(`🔒 «${m.name}» در سطح ${fa(m.level)} باز می‌شه. تمرین کن!`, 'warn');
      this.shakeBtn(m.id);
      return;
    }
    const P = this.player;
    if (m.toggle) {
      P.mode = P.mode === m.id ? 'walk' : m.id;
      this.save.mode = P.mode;
      Sfx.play('click');
      this.toast(P.mode === 'walk' ? 'حالت راه رفتن' : (P.mode === 'run' ? '🏃 دویدن روشن شد' : '🦘 دویدن پرشی روشن شد. حالا راه برو!'));
      this.refreshMoves();
      return;
    }
    if (!this.world.canAct()) return;
    const since = this.clock - this.lastExerciseEnd;
    let started;
    if (m.equip) {
      const env = EQUIP[m.equip].env;
      if (env !== this.envKey()) {
        Sfx.play('error');
        const e = ENV_BY_ID[env];
        const lock = e && this.lv() < e.level ? ` (از سطح ${fa(e.level)} باز می‌شه)` : '';
        this.toast(`«${m.name}» با ${EQUIP[m.equip].name} انجام می‌شه. برو به «${this.envName(env)}»${lock}. از دکمه‌ی نقشه 🗺️`, 'warn');
        return;
      }
      const st = this.nearEquip(m.equip);
      if (!st) {
        const r = this.world.nearestStation((s) => s.equip === m.equip);
        Sfx.play('error');
        this.shakeBtn(m.id);
        this.toast(`برای «${m.name}» برو سراغ ${EQUIP[m.equip].name}. دنبال فلش سبز برو!`, 'warn');
        if (r) this.world.guideTo(r.s);
        return;
      }
      started = this.world.useStation(st, m.id, () => this.exerciseDone(m));
    } else if (m.custom) {
      started = this.world.playerDo(m.anim, () => this.customDone(m.name, m.effect));
    } else {
      started = this.world.playerDo(m.id, () => this.exerciseDone(m));
    }
    if (!started) return;
    Sfx.play('click');
    this.combo = since <= 1.6 ? Math.min(10, this.combo + 1) : 0;
    this.noteCombo(this.combo);
    this.refreshMoves();
  },

  exerciseDone(m) {
    this.lastExerciseEnd = this.clock;
    const mult = 1 + this.combo * 0.1;
    this.gainXp(Math.round(m.xp * mult * xpMult(this.save.level)));
    if (m.run) this.gainRun(Math.round(m.run * mult));
    this.noteRep(m);
    this.refreshMoves();
  },

  /** Equipment or exercises the AI built: apply their effect exactly as described. */
  customDone(name, effect) {
    this.lastExerciseEnd = this.clock;
    if (effect.levels) {
      if (effect.stat === 'run') this.addRunLevels(effect.levels);
      else this.addLevels(effect.levels);
      this.floatText(`+${fa(effect.levels)}`, 'fl-combo');
      Sfx.play('xp');
    }
    if (effect.xp) {
      if (effect.stat === 'run') { this.gainRun(effect.xp); this.floatText(`+${fa(effect.xp)}`, 'fl-run'); }
      else this.gainXp(effect.xp);
    }
    this.noteRep({ id: 'ai', level: 10 });
    this.refreshMoves();
  },

  /* ---------------- progression ---------------- */

  /** kind: 'exercise' (floater + sound), 'run' (small floater every 5), 'reward' (no floater). */
  gainXp(amount, kind = 'exercise') {
    if (!(amount > 0)) return;
    const s = this.save;
    if (kind !== 'reward' && this.drinkActive()) amount *= 2;
    amount = Math.round(amount * 10) / 10;
    s.xp += amount;
    if (kind === 'run') {
      this.runXpShown += amount;
      if (this.runXpShown >= 5) {
        this.floatText(`+${fa(Math.floor(this.runXpShown))}`, 'fl-run');
        this.runXpShown -= Math.floor(this.runXpShown);
      }
    } else if (kind === 'exercise') {
      this.floatText(`+${fa(Math.round(amount))}`, this.combo > 0 || this.drinkActive() ? 'fl-combo' : '');
      Sfx.play('xp');
    }
    const from = s.level;
    let guard = 0;
    while (s.xp >= xpNeed(s.level) && guard++ < 5000) {
      s.xp -= xpNeed(s.level);
      s.level++;
    }
    if (s.level > from) this.levelsGained(from, s.level);
    this.refreshHud();
  },

  addLevels(n) {
    const s = this.save;
    const from = s.level;
    const frac = s.xp / xpNeed(s.level);
    s.level += n;
    s.xp = Math.floor(frac * xpNeed(s.level));
    this.levelsGained(from, s.level);
    this.refreshHud();
  },

  gainRun(amount) {
    if (!(amount > 0)) return;
    const s = this.save;
    s.runXp += amount;
    const from = s.runLevel;
    let guard = 0;
    while (s.runXp >= runNeed(s.runLevel) && guard++ < 5000) {
      s.runXp -= runNeed(s.runLevel);
      s.runLevel++;
    }
    if (s.runLevel > from) { this.toast(`🏃 سطح دویدن ${fa(s.runLevel)}! سریع‌تر شدی`, 'gold'); this.checkAchievements(); }
    this.refreshHud();
  },

  addRunLevels(n) {
    this.save.runLevel += n;
    this.toast(`🏃 +${fa(n)} سطح دویدن! حالا سطح ${fa(this.save.runLevel)}`, 'gold');
    this.persist();
    this.checkAchievements();
    this.refreshHud();
  },

  levelsGained(from, to) {
    Sfx.play('levelup');
    const b = $('levelBanner');
    b.innerHTML = `<small>سطح زور</small><b>${fa(to + (this.boostActive() ? BOOST_LEVELS : 0))}</b>`;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    setPlayerLevelLook(this.player, this.lv());
    this.refreshMoves();
    if (this.mode === 'play') {
      const p = this.player.ch.root.position;
      this.world.fx.ring({ x: p.x, y: 0.2, z: p.z }, { count: 70, color: '#ffc23d', radius: 0.5, speed: 6, life: 0.9 });
      this.world.fx.burst({ x: p.x, y: 1.4, z: p.z }, { count: 60, colors: ['#ffc23d', '#ffffff', '#ff7b00'], speed: 3, up: 4, life: 1.4 });
    }
    if (!this.save.unlocked && !this.boostActive()) {
      const opened = MOVES.filter((m) => m.level > from && m.level <= to);
      if (opened.length === 1) setTimeout(() => { Sfx.play('unlock'); this.toast(`🔓 «${opened[0].name}» باز شد!`, 'gold'); }, 700);
      else if (opened.length > 1) setTimeout(() => { Sfx.play('unlock'); this.toast(`🔓 ${fa(opened.length)} حرکت جدید باز شد!`, 'gold'); }, 700);
      const envs = ENVS.filter((e) => e.level > from && e.level <= to);
      for (const e of envs) setTimeout(() => this.toast(`🗺️ «${e.name}» باز شد! از دکمه‌ی نقشه برو`, 'gold'), 1200);
    }
    if (from < ISLAND_LEVEL && to >= ISLAND_LEVEL) {
      setTimeout(() => { Sfx.play('win'); this.toast('🌥️ جزیره‌ی ابرها باز شد! از نقشه یا دروازه‌ی ابری کنار در سالن کشتی برو', 'gold'); }, 1500);
    }
    const next = opponentFor(this.save.stage);
    if (from < next.level && to >= next.level) setTimeout(() => this.toast(`💪 هم‌زور «${next.name}» شدی! دکمه‌ی آماده‌ام رو بزن`, 'gold'), 2200);
    this.missionProgress('levels', to - from);
    this.checkAchievements();
    this.persist();
  },

  refreshHud(force) {
    const s = this.save;
    const need = xpNeed(s.level);
    const frac = clamp(s.xp / need, 0, 1);
    const boost = this.boostActive();
    const key = `${s.level}|${Math.floor(s.xp)}|${s.stage}|${s.muted}|${s.runLevel}|${Math.floor(s.runXp)}|${s.coins}|${boost}`;
    if (force || key !== this.hudKey) {
      this.hudKey = key;
      $('lvlNum').textContent = fa(this.lv());
      $('lvlNum').classList.toggle('boosted', boost);
      $('xpFill').style.width = `${frac * 100}%`;
      $('xpText').textContent = `${fa(Math.floor(s.xp))} / ${fa(need)}`;
      $('runText').textContent = `🏃 سطح دویدن ${fa(s.runLevel)}`;
      $('runFill').style.width = `${clamp(s.runXp / runNeed(s.runLevel), 0, 1) * 100}%`;
      $('coinText').textContent = fa(s.coins);
      const opp = opponentFor(s.stage);
      $('readySub').textContent = `مرحله‌ی ${fa(s.stage)} • حریف سطح ${fa(opp.level)}`;
      $('readyBtn').classList.toggle('hot', this.lv() >= opp.level);
      $('soundBtn').textContent = s.muted ? '🔇' : '🔊';
      this.renderMissionChip();
    }
    if (force || this.clock - (this.rankT || 0) > 1) {
      this.rankT = this.clock;
      const rows = this.gym.leaderboard(this.playerName(), this.lv(), s.xp);
      const rank = rows.findIndex((r) => r.isPlayer) + 1;
      $('rankText').textContent = `رتبه ${fa(rank)} از ${fa(rows.length)}`;
      this.gym.drawBoards({ level: this.lv(), frac, rank, total: rows.length }, rows);
    }
  },

  /* ---------------- HUD helpers ---------------- */

  toast(text, cls = '') {
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 3000);
    setTimeout(() => el.remove(), 3500);
  },

  floatText(text, cls) {
    if (this.mode !== 'play') return;
    const ch = this.player.ch;
    const v = new THREE.Vector3();
    ch.root.getWorldPosition(v);
    v.y += 2.1 + ch.airY + (cls === 'fl-coin' ? 0.4 : 0);
    v.project(this.camera);
    if (v.z > 1) return;
    const el = document.createElement('div');
    el.className = 'floater ' + (cls || '');
    el.dir = 'ltr';
    el.textContent = text;
    el.style.left = `${(v.x * 0.5 + 0.5) * 100}%`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * 100}%`;
    $('floaters').appendChild(el);
    setTimeout(() => el.remove(), 1300);
  },

  showBanner(small, big) {
    const b = $('levelBanner');
    b.innerHTML = '';
    const s = document.createElement('small');
    s.textContent = small;
    const g = document.createElement('b');
    g.textContent = big;
    b.append(s, g);
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  },

  openModal(id) {
    $(id).hidden = false;
    this.modals.add(id);
    this.keys.clear();
    this.resetJoy();
  },
  closeModal(id) {
    $(id).hidden = true;
    this.modals.delete(id);
  },

  /* ---------------- start ---------------- */

  outfit() {
    const sh = this.save.shop;
    return {
      shirt: sh.shirt && SHOP_BY_ID[sh.shirt] ? SHOP_BY_ID[sh.shirt].color : PLAYER_COLORS[this.save.color],
      band: sh.band && SHOP_BY_ID[sh.band] ? SHOP_BY_ID[sh.band].color : '#ffc23d',
    };
  },

  /** Rebuild the player's character (new clothes) in place. */
  rebuildPlayer() {
    const old = this.player;
    const pos = old.ch.root.position.clone();
    const yaw = old.ch.root.rotation.y;
    this.releasePlayer();
    this.world.scene.remove(old.ch.root);
    this.world.scene.remove(old.arrow);
    this.player = createPlayer(this.outfit(), this.lv());
    this.player.mode = old.mode;
    const cam = Object.assign({}, this.world.cam);
    this.world.enter(this.player, { x: pos.x, z: pos.z, yaw });
    Object.assign(this.world.cam, cam);
  },

  openStart() {
    this.mode = 'menu';
    $('hud').hidden = true;
    $('nameInput').value = this.save.name || '';
    const sw = $('swatches');
    sw.innerHTML = '';
    PLAYER_COLORS.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch' + (i === this.save.color ? ' on' : '');
      b.style.background = c;
      b.setAttribute('aria-label', 'رنگ ' + fa(i + 1));
      b.addEventListener('click', () => {
        this.save.color = i;
        this.save.shop.shirt = null;
        sw.querySelectorAll('.swatch').forEach((x, j) => x.classList.toggle('on', j === i));
        this.rebuildPlayer();
      });
      sw.appendChild(b);
    });
    $('startStats').textContent = this.save.level > 1 || this.save.stage > 1
      ? `ادامه‌ی بازی: سطح زور ${fa(this.save.level)} • مرحله‌ی کشتی ${fa(this.save.stage)} • 🪙 ${fa(this.save.coins)}`
      : '';
    this.openModal('startModal');
  },

  startGame() {
    Sfx.init();
    Sfx.play('go');
    this.save.name = $('nameInput').value.trim().slice(0, 14);
    this.closeModal('startModal');
    $('hud').hidden = false;
    this.mode = 'play';
    if (this.save.music) Sfx.music(true);
    this.persist();
    this.refreshHud(true);
    this.refreshMoves();
    this.toast(`سلام ${this.playerName()}! تمرین رو شروع کن 💪`, 'gold');
  },

  /* ---------------- travel ---------------- */

  fadeTo(fn) {
    const f = $('fade');
    f.classList.add('on');
    setTimeout(() => {
      try { fn(); } catch (e) { console.error(e); }
      setTimeout(() => f.classList.remove('on'), 80);
    }, 420);
  },

  releasePlayer() {
    const P = this.player;
    if (P.anchor) {
      P.anchor.player = false;
      P.ch.root.position.set(P.anchor.ax, 0, P.anchor.az);
      P.anchor = null;
    }
    P.ch.stopAction();
    P.ch.root.position.y = 0;
  },

  getIsland() {
    if (!this.island) {
      this.island = new IslandWorld();
      this.island.spawnNpcs(ISLAND_NAMES, null, [25, 80]);
      this.island.setCreations(Creations.items);
    }
    return this.island;
  },

  getPlace(item) {
    let w = this.places.get(item.id);
    if (!w) {
      w = new PlaceWorld(item);
      w.spawnNpcs([...NPC_NAMES].sort(() => Math.random() - 0.5).slice(0, 6), null, [5, 45]);
      this.places.set(item.id, w);
    }
    return w;
  },

  getEnv(id) {
    let w = this.envs.get(id);
    if (!w) {
      w = buildEnv(id);
      const e = ENV_BY_ID[id];
      w.spawnNpcs([...NPC_NAMES].sort(() => Math.random() - 0.5).slice(0, 8), null, [e.level, e.level + 25]);
      this.envs.set(id, w);
    }
    return w;
  },

  /** target: 'gym' | 'island' | 'place' (item = creation) | 'env' (item = env id) */
  travel(target, item) {
    if (this.mode !== 'play' || this.race) return;
    if (target === 'island' && this.lv() < ISLAND_LEVEL) {
      Sfx.play('error');
      this.toast(`🔒 جزیره‌ی ابرها در سطح ${fa(ISLAND_LEVEL)} باز می‌شه. الان سطح ${fa(this.lv())} هستی؛ خیلی تمرین کن!`, 'warn');
      return;
    }
    if (target === 'env') {
      const e = ENV_BY_ID[item];
      if (!e) return;
      if (this.lv() < e.level) {
        Sfx.play('error');
        this.toast(`🔒 «${e.name}» در سطح ${fa(e.level)} باز می‌شه.`, 'warn');
        return;
      }
      if (this.where === 'env' && this.envId === item) return;
    }
    Sfx.init();
    Sfx.play('whoosh');
    const from = this.where;
    const fromItem = this.placeItem;
    this.closeModal('mapModal');
    this.releasePlayer();
    this.mode = 'transition';
    this.fadeTo(() => {
      let w;
      let at;
      if (target === 'gym') {
        w = this.gym;
        if (from === 'island') at = { x: PORTAL.x + 2.5, z: PORTAL.z - 2.5, yaw: Math.PI, camYaw: 0.7 };
      } else if (target === 'island') {
        w = this.getIsland();
        if (from === 'place' && fromItem) {
          const pp = w.placePortals.find((p) => p.item.id === fromItem.id);
          if (pp) at = { x: pp.x * 0.85, z: pp.z * 0.85, yaw: Math.atan2(-pp.x, -pp.z), camYaw: Math.atan2(pp.x, pp.z) + 0.6 };
        }
      } else if (target === 'env') w = this.getEnv(item);
      else w = this.getPlace(item);
      if (this.pet) this.world.scene.remove(this.pet.root);
      w.enter(this.player, at);
      this.world = w;
      this.where = target;
      this.envId = target === 'env' ? item : null;
      this.placeItem = target === 'place' ? item : null;
      this.attachPet();
      this.mode = 'play';
      this.updateWorldHud();
      this.refreshMoves();
      if (target === 'island') {
        this.toast(this.save.islandSeen ? 'به جزیره‌ی ابرها خوش اومدی! 🌥️' : '🌥️ به جزیره‌ی ابرها رسیدی! برو پیش ربات وسط جزیره و هر وسیله‌ی ورزشی که دلت می‌خواد بساز.', 'gold');
        this.save.islandSeen = true;
      } else if (target === 'place') this.toast(`${item.icon} به «${item.name}» خوش اومدی!`, 'gold');
      else if (target === 'env') {
        const e = ENV_BY_ID[item];
        this.toast(`${e.icon} به «${e.name}» خوش اومدی! ورزش‌های این‌جا توی زبانه‌ی «مکان‌ها» هستن.`, 'gold');
        if (!this.save.stats.visited.includes(item)) this.save.stats.visited.push(item);
        this.missionProgress('visit', 1, item);
        this.checkAchievements();
        this.setTab('env');
      } else this.toast('برگشتی باشگاه 💪');
      this.persist();
    });
  },

  updateWorldHud() {
    const inGym = this.where === 'gym';
    $('readyBtn').hidden = !inGym;
    $('aiBtn').hidden = !(this.where === 'island' || this.where === 'place');
  },

  /* ---------------- wrestling ---------------- */

  startMatch() {
    if (this.mode === 'transition') return;
    const s = this.save;
    const opp = opponentFor(s.stage);
    this.closeModal('readyModal');
    this.closeModal('resultModal');
    this.releasePlayer();
    this.mode = 'transition';
    this.fadeTo(() => {
      $('hud').hidden = true;
      this.mode = 'arena';
      this.arena.start({
        opp, playerLevel: this.lv(), playerName: this.playerName(),
        playerOutfit: this.player.ch.o,
        xpMult: xpMult(s.level),
        onZoor: (amt) => this.gainXp(amt, 'reward'),
        onEnd: (r) => this.matchEnded(r, opp),
      });
    });
  },

  matchEnded(r, opp) {
    const s = this.save;
    const reasons = {
      fall: 'ضربه فنی', tech: 'برتری فنی (۱۰ امتیاز اختلاف)', points: 'امتیاز بیشتر در پایان وقت',
      criteria: 'امتیاز آخر', golden: 'امتیاز طلایی در وقت اضافه', decision: 'رأی داور',
    };
    const reward = Math.round((r.win ? 50 + 40 * opp.stage : 15 + 5 * opp.stage) * xpMult(s.level));
    const levels = r.win ? 1 + Math.floor(opp.stage / 2) : 0;
    const coins = r.win ? 25 * opp.stage : 5 * opp.stage;
    const lastMain = r.win && opp.stage === MAIN_STAGES;
    if (r.win) {
      s.wins++;
      s.stage = Math.max(s.stage, opp.stage + 1);
      this.missionProgress('win', 1);
    } else s.losses++;
    $('resTitle').textContent = r.win ? (lastMain ? '👑 قهرمان افسانه‌ای شدی!' : '🏆 بردی!') : '😓 باختی!';
    $('resTitle').className = r.win ? 'res-title win' : 'res-title lose';
    $('resReason').textContent = (r.win ? 'برد با ' : 'باخت با ') + reasons[r.reason];
    $('resScore').innerHTML = `<span class="red">${fa(r.score.p)}</span><span class="vs">–</span><span class="blue">${fa(r.score.o)}</span>`;
    $('resNames').textContent = `${this.playerName()} در برابر ${opp.name}`;
    const parts = [];
    if (levels) parts.push(`+${fa(levels)} سطح زور`);
    parts.push(`+${fa(reward + (r.zoor || 0))} زور`);
    parts.push(`🪙 ${fa(coins)}`);
    $('resXp').textContent = 'جایزه: ' + parts.join(' • ');
    let tip;
    if (lastMain) tip = 'همه‌ی ۱۰ مرحله رو بردی! حالا چالش بی‌پایان شروع می‌شه.';
    else if (r.win) {
      const nx = opponentFor(s.stage);
      tip = `حریف بعدی قوی‌تره: ${nx.name} (${nx.title}) با سطح زور ${fa(nx.level)}`;
    } else tip = 'زوری که توی همین کشتی گرفتی مال خودته. برگرد باشگاه، قوی‌تر شو و دوباره بیا!';
    $('resTip').textContent = tip;
    $('nextBtn').textContent = r.win ? '➡️ ادامه: مرحله‌ی بعد' : '🔁 دوباره کشتی بگیر';
    this.gainXp(reward, 'reward');
    if (levels) this.addLevels(levels);
    this.addCoins(coins);
    this.checkAchievements();
    this.persist();
    this.openModal('resultModal');
  },

  backToGym() {
    if (this.mode === 'transition') return;
    this.closeModal('resultModal');
    this.mode = 'transition';
    this.fadeTo(() => {
      this.arena.stop();
      this.mode = 'play';
      $('hud').hidden = false;
      setPlayerLevelLook(this.player, this.lv());
      this.refreshHud(true);
      this.refreshMoves();
      this.toast('برگشتی باشگاه! زورت رو بیشتر کن 💪');
    });
  },

  openReady() {
    if (this.mode !== 'play' || this.where !== 'gym') return;
    Sfx.init();
    const s = this.save;
    const opp = opponentFor(s.stage);
    $('rdStage').textContent = s.stage <= MAIN_STAGES ? `مرحله‌ی ${fa(s.stage)} از ${fa(MAIN_STAGES)}` : `چالش بی‌پایان • مرحله‌ی ${fa(s.stage)}`;
    $('rdOppName').textContent = opp.name;
    $('rdOppTitle').textContent = opp.title;
    $('rdOppLvl').textContent = fa(opp.level);
    $('rdMeName').textContent = this.playerName();
    $('rdMeLvl').textContent = fa(this.lv());
    const dots = $('rdDots');
    dots.innerHTML = '';
    for (let i = 1; i <= MAIN_STAGES; i++) {
      const d = document.createElement('span');
      d.className = 'dot' + (i < s.stage ? ' done' : '') + (i === s.stage ? ' now' : '');
      d.textContent = fa(i);
      dots.appendChild(d);
    }
    const adv = $('rdAdvice');
    const diff = this.lv() - opp.level;
    if (diff >= 3) { adv.textContent = '🔥 تو از حریف قوی‌تری. برو بخورش!'; adv.className = 'advice good'; }
    else if (diff >= 0) { adv.textContent = '✅ زورت به حریف می‌رسه. با سرعت زور بزن و فن‌ها رو به‌موقع بزن!'; adv.className = 'advice good'; }
    else if (diff >= -2) { adv.textContent = '⚠️ حریف یه کم از تو قوی‌تره. می‌تونی بری، ولی سخته!'; adv.className = 'advice warn'; }
    else { adv.textContent = `⛔ حریف ${fa(-diff)} سطح از تو قوی‌تره. بهتره اول بیشتر تمرین کنی.`; adv.className = 'advice bad'; }
    this.openModal('readyModal');
  },

  /* ---------------- context button (things you are standing next to) ---------------- */

  contextAction() {
    const w = this.world;
    if (this.race || !w.canAct()) return null;
    if (w === this.gym) {
      if (w.nearTower() && w.tower.state === 'idle') return { label: '🔨 تست قدرت', run: () => this.strengthTest() };
      if (w.nearPortal()) {
        const open = this.lv() >= ISLAND_LEVEL;
        return { label: open ? '🌥️ برو به جزیره‌ی ابرها' : `🔒 جزیره‌ی ابرها • سطح ${fa(ISLAND_LEVEL)}`, run: () => this.travel('island') };
      }
      if (this.nearRaceStart()) return { label: '🏁 مسابقه‌ی دو', run: () => this.startRace() };
    } else if (w === this.island) {
      if (w.nearKiosk()) return { label: '🤖 با هوش مصنوعی حرف بزن', run: () => this.openAi() };
      if (w.nearHome()) return { label: '🏋️ برگشت به باشگاه', run: () => this.travel('gym') };
      const pp = w.nearPlace();
      if (pp) return { label: `${pp.item.icon} برو به ${pp.item.name}`, run: () => this.travel('place', pp.item) };
    } else if (w.nearHome && w.nearHome()) {
      return { label: '🌥️ برگشت به جزیره', run: () => this.travel('island') };
    }
    const eq = w.nearestStation((s) => !!s.equip);
    if (eq && eq.d < 2.0) {
      const m = MOVES.find((x) => x.equip === eq.s.equip);
      if (m) return { label: `${m.icon} ${m.name}`, run: () => this.onMove(m) };
    }
    const r = w.nearestStation((s) => !!s.custom);
    if (r && r.d < 2.0) {
      const item = r.s.custom;
      return { label: `${item.icon} ${item.name}`, run: () => this.useCustom(r.s) };
    }
    return null;
  },

  useCustom(st) {
    const item = st.custom;
    const since = this.clock - this.lastExerciseEnd;
    if (this.world.useStation(st, item.anim, () => this.customDone(item.name, item.effect))) {
      Sfx.play('click');
      this.combo = since <= 1.6 ? Math.min(10, this.combo + 1) : 0;
      this.noteCombo(this.combo);
    }
  },

  runContext() {
    if (this.mode !== 'play' || this.modals.size) return;
    Sfx.init();
    const c = this.contextAction();
    if (c) c.run();
  },

  strengthTest() {
    if (this.mode !== 'play' || this.modals.size || this.world !== this.gym) return;
    Sfx.init();
    if (this.gym.startStrengthTest(this.lv())) Sfx.play('click');
  },

  towerResult(level, rang) {
    const rows = this.gym.leaderboard(this.playerName(), this.lv(), this.save.xp);
    const rank = rows.findIndex((r) => r.isPlayer) + 1;
    this.toast(rang ? `🔔 دینگ! قدرتت سطح ${fa(level)}ـه! تو یه هیولایی!` : `🔨 قدرت تو: سطح ${fa(level)} • رتبه ${fa(rank)} از ${fa(rows.length)}`, 'gold');
  },

  /* ---------------- input ---------------- */

  bindUi() {
    const on = (id, fn) => $(id).addEventListener('click', fn);
    on('startBtn', () => this.startGame());
    $('codeForm').addEventListener('submit', (e) => { e.preventDefault(); this.submitCode(); });
    on('rankBtn', () => { Sfx.init(); this.openBoard(); });
    on('soundBtn', () => {
      Sfx.init();
      this.save.muted = !this.save.muted;
      Sfx.setMuted(this.save.muted);
      this.refreshHud(true);
      this.persist();
    });
    on('mapBtn', () => { Sfx.init(); this.openMap(); });
    on('shopBtn', () => { Sfx.init(); this.openShop(); });
    on('menuBtn', () => { Sfx.init(); this.openMenu(); });
    on('coinChip', () => { Sfx.init(); this.openShop(); });
    on('missionChip', () => { Sfx.init(); this.openMissions(); });
    on('aiBtn', () => this.openAi());
    on('readyBtn', () => this.openReady());
    on('fightBtn', () => this.startMatch());
    on('trainBtn', () => this.closeModal('readyModal'));
    on('nextBtn', () => this.startMatch());
    on('gymBtn', () => this.backToGym());
    on('ctxBtn', () => this.runContext());
    on('panelToggle', () => {
      const p = $('panel');
      p.classList.toggle('collapsed');
      $('panelToggle').setAttribute('aria-expanded', String(!p.classList.contains('collapsed')));
    });
    document.querySelectorAll('.mv-tab').forEach((t) => t.addEventListener('click', () => { Sfx.play('click'); this.setTab(t.dataset.tab); }));
    $('aiForm').addEventListener('submit', (e) => { e.preventDefault(); this.sendAi(); });
    document.querySelectorAll('.ai-example').forEach((b) => b.addEventListener('click', () => this.sendAi(b.textContent)));
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.closeModal(b.dataset.close)));
    document.querySelectorAll('[data-menu]').forEach((b) => b.addEventListener('click', () => this.menuAction(b.dataset.menu)));
    $('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.startGame(); });
  },

  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Escape') {
        for (const id of ['codeModal', 'helpModal', 'boardModal', 'readyModal', 'aiModal', 'mapModal', 'shopModal', 'menuModal', 'missionModal', 'medalModal']) if (this.modals.has(id)) this.closeModal(id);
        return;
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (this.modals.size) return;
      if (this.mode === 'arena') {
        if (!e.repeat) this.arena.key(e.code);
        return;
      }
      if (this.mode !== 'play') return;
      this.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === 'Space') this.pendingJump = true;
      if (e.code === 'KeyE') this.runContext();
      if (e.code === 'KeyR') this.onMove(MOVE_BY_ID.run);
      if (e.code === 'KeyF') this.onMove(MOVE_BY_ID.jumprun);
      if (e.code === 'KeyM') this.openMap();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.resetJoy(); this.camDrag.clear(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.keys.clear(); this.resetJoy(); this.persist(); } });
    document.addEventListener('contextmenu', (e) => { if (!(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))) e.preventDefault(); });

    const joy = $('joy');
    const knob = $('joyKnob');
    const R = 46;
    const setJoy = (e) => {
      const r = joy.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy.x = dx / R;
      this.joy.y = dy / R;
    };
    joy.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Sfx.init();
      this.joy.id = e.pointerId;
      try { joy.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      joy.classList.add('on');
      setJoy(e);
    });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === this.joy.id) setJoy(e); });
    const end = (e) => { if (e.pointerId === this.joy.id) this.resetJoy(); };
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);
    joy.addEventListener('lostpointercapture', end);

    const cv = $('scene');
    cv.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'play') return;
      Sfx.init();
      this.camDrag.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    cv.addEventListener('pointermove', (e) => {
      const p = this.camDrag.get(e.pointerId);
      if (!p || this.mode !== 'play') return;
      const cam = this.world.cam;
      if (this.camDrag.size >= 2) {
        const pts = [...this.camDrag.values()];
        const before = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        p.x = e.clientX; p.y = e.clientY;
        const after = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        cam.dist = clamp(cam.dist * (before / Math.max(1, after)), 3.5, 14);
        return;
      }
      cam.yaw -= (e.clientX - p.x) * 0.0065;
      cam.pitch = clamp(cam.pitch + (e.clientY - p.y) * 0.004, 0.02, 1.15);
      p.x = e.clientX; p.y = e.clientY;
    });
    const up = (e) => this.camDrag.delete(e.pointerId);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => {
      if (this.mode !== 'play') return;
      e.preventDefault();
      this.world.cam.dist = clamp(this.world.cam.dist * (e.deltaY > 0 ? 1.1 : 0.9), 3.5, 14);
    }, { passive: false });
  },

  resetJoy() {
    this.joy.x = 0;
    this.joy.y = 0;
    this.joy.id = null;
    $('joyKnob').style.transform = '';
    $('joy').classList.remove('on');
  },

  input() {
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (this.joy.id != null) { x = this.joy.x; y = this.joy.y; }
    const enabled = this.mode === 'play' && !this.modals.size && !(this.race && this.race.state === 'count');
    const jump = this.pendingJump && enabled;
    this.pendingJump = false;
    return { x, y, run: k.has('ShiftLeft') || k.has('ShiftRight'), jump, enabled };
  },

  /* ---------------- loop ---------------- */

  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.05);
    this.step(dt);
    this.watchFps(dt);
  },

  step(dt) {
    this.clock += dt;
    try {
      if (this.mode === 'arena') {
        this.arena.update(dt, this.camera);
        this.renderer.render(this.arena.scene, this.camera);
        return;
      }
      if (this.mode === 'menu') this.world.cam.yaw += dt * 0.12;
      const metersBefore = this.world.metersRun || 0;
      const gained = this.world.update(dt, this.input(), this.camera, this.stats());
      if (gained > 0) {
        this.gainXp(gained * xpMult(this.save.level), 'run');
        this.gainRun(gained * 1.5);
      }
      const ran = (this.world.metersRun || 0) - metersBefore;
      if (ran > 0 && this.mode === 'play') this.noteRun(ran);
      if (this.pet) this.pet.update(dt, this.player, this.clock);
      this.tickAura(dt);
      if (this.race) this.tickRace(dt);
      if (this.mode === 'play') this.tickHud();
      this.renderer.render(this.world.scene, this.camera);
    } catch (e) {
      if (!this.errorShown) { this.errorShown = true; console.error(e); }
    }
  },

  tickHud() {
    const busy = !this.world.canAct();
    this.hudT = (this.hudT || 0) + 1;
    if (busy !== this.lastBusy || this.hudT % 15 === 0) { this.lastBusy = busy; this.refreshMoves(); }
    const c = this.contextAction();
    const btn = $('ctxBtn');
    btn.hidden = !c;
    if (c && btn.textContent !== c.label) btn.textContent = c.label;
    const comboOn = this.combo > 0 && (busy || this.clock - this.lastExerciseEnd <= 1.6);
    if (!comboOn && this.combo > 0 && !busy) this.combo = 0;
    const cb = $('comboBadge');
    cb.hidden = !comboOn;
    if (comboOn) cb.textContent = `کمبو ×${fa((1 + this.combo * 0.1).toFixed(1))}`;
    this.tickTimers();
    this.refreshHud();
  },

  watchFps(dt) {
    this.fpsT += dt;
    this.fpsN++;
    if (this.fpsT < 3) return;
    const fps = this.fpsN / this.fpsT;
    this.fpsT = 0;
    this.fpsN = 0;
    if (fps < 38 && this.pixelRatio > 0.75) {
      this.pixelRatio = Math.max(0.75, this.pixelRatio - 0.35);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.resize();
    }
  },
};

/** Canvas signs need the Persian fonts, so wait for them briefly before building the world. */
function bootWhenFontsReady() {
  let started = false;
  const go = () => { if (!started) { started = true; Game.init(); } };
  try {
    if (document.fonts && document.fonts.load) {
      Promise.all([
        document.fonts.load(`40px Lalezar`, 'باشگاه'),
        document.fonts.load(`700 20px Vazirmatn`, 'سطح'),
        document.fonts.load(`400 20px Vazirmatn`, 'سطح'),
      ]).then(go, go);
      setTimeout(go, 2500);
      return;
    }
  } catch (e) { /* fall through */ }
  go();
}
window.addEventListener('DOMContentLoaded', bootWhenFontsReady);
