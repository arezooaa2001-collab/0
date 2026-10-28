'use strict';
/* Game controller: HUD, input, progression, saving, gym <-> arena flow */

const SAVE_KEY = 'zoor-gym-save-v1';

const Game = {
  save: null,
  mode: 'menu',
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

  loadSave() {
    const d = {
      level: 1, xp: 0, stage: 1, unlocked: false, muted: false, color: 0, wins: 0, losses: 0,
      name: '', npcs: null, mode: 'walk',
    };
    const s = Store.get(SAVE_KEY, null);
    this.save = Object.assign(d, s && typeof s === 'object' ? s : {});
    const v = this.save;
    v.level = Math.max(1, Math.floor(Number(v.level) || 1));
    v.xp = Math.max(0, Number(v.xp) || 0);
    v.stage = Math.max(1, Math.floor(Number(v.stage) || 1));
    v.color = clamp(Math.floor(Number(v.color) || 0), 0, PLAYER_COLORS.length - 1);
    if (!['walk', 'run', 'jumprun'].includes(v.mode)) v.mode = 'walk';
  },

  persist() {
    const s = this.save;
    s.npcs = this.gym ? this.gym.npcs.map((n) => ({ l: n.level, x: Math.round(n.xp) })) : s.npcs;
    Store.set(SAVE_KEY, s);
  },

  playerName() { return this.save.name || 'قهرمان'; },

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
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 160);
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.loadSave();
    Sfx.setMuted(this.save.muted);
    this.gym = new GymWorld();
    this.gym.spawnNpcs(this.save.npcs);
    this.gym.setPlayer({ shirt: PLAYER_COLORS[this.save.color] }, this.save.level);
    this.gym.player.mode = this.save.mode;
    this.gym.onTowerDone = (lvl, rang) => this.towerResult(lvl, rang);
    this.arena = new Arena();

    this.buildMoves();
    this.bindUi();
    this.bindInput();
    this.refreshHud(true);
    this.openStart();

    setInterval(() => { if (this.mode === 'gym') this.persist(); }, 6000);
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

  isUnlocked(m) { return this.save.unlocked || this.save.level >= m.level; },

  buildMoves() {
    const grid = $('moveGrid');
    grid.innerHTML = '';
    this.moveBtns = {};
    for (const m of MOVES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mv-btn' + (m.toggle ? ' toggle' : '');
      b.dataset.id = m.id;
      b.innerHTML = `<span class="mv-icon">${m.icon}</span><span class="mv-name">${m.name}</span><span class="mv-sub"></span><span class="mv-lock">🔒 سطح ${fa(m.level)}</span>`;
      b.addEventListener('click', () => this.onMove(m));
      grid.appendChild(b);
      this.moveBtns[m.id] = b;
    }
  },

  refreshMoves() {
    const P = this.gym.player;
    const busy = !this.gym.canAct();
    for (const m of MOVES) {
      const b = this.moveBtns[m.id];
      const un = this.isUnlocked(m);
      b.classList.toggle('locked', !un);
      b.classList.toggle('active', !!m.toggle && P.mode === m.id);
      b.classList.toggle('wait', !m.toggle && busy && un);
      const sub = m.toggle ? (P.mode === m.id ? 'روشن' : 'خاموش') : `${fa(m.xp)} زور`;
      const subEl = b.querySelector('.mv-sub');
      if (subEl.textContent !== sub) subEl.textContent = sub;
    }
  },

  onMove(m) {
    if (this.mode !== 'gym' || this.modals.size) return;
    Sfx.init();
    if (!this.isUnlocked(m)) {
      Sfx.play('error');
      this.toast(`🔒 «${m.name}» در سطح ${fa(m.level)} باز می‌شه. تمرین کن!`, 'warn');
      const b = this.moveBtns[m.id];
      b.classList.remove('shake');
      void b.offsetWidth;
      b.classList.add('shake');
      return;
    }
    if (m.toggle) {
      const P = this.gym.player;
      P.mode = P.mode === m.id ? 'walk' : m.id;
      this.save.mode = P.mode;
      Sfx.play('click');
      this.toast(P.mode === 'walk' ? 'حالت راه رفتن' : (P.mode === 'run' ? '🏃 دویدن روشن شد' : '🦘 دویدن پرشی روشن شد. حالا راه برو!'));
      this.refreshMoves();
      return;
    }
    const since = this.clock - this.lastExerciseEnd;
    const started = this.gym.playerDo(m.id, () => this.exerciseDone(m));
    if (!started) return;
    Sfx.play('click');
    this.combo = since <= 1.6 ? Math.min(10, this.combo + 1) : 0;
    this.refreshMoves();
  },

  exerciseDone(m) {
    this.lastExerciseEnd = this.clock;
    const mult = 1 + this.combo * 0.1;
    this.gainXp(Math.round(m.xp * mult));
    this.refreshMoves();
  },

  /* ---------------- progression ---------------- */

  /** kind: 'exercise' (floater + sound), 'run' (small floater every 5), 'reward' (no floater). */
  gainXp(amount, kind = 'exercise') {
    if (!(amount > 0)) return;
    const s = this.save;
    s.xp += amount;
    if (kind === 'run') {
      this.runXpShown += amount;
      if (this.runXpShown >= 5) {
        this.floatText(`+${fa(Math.floor(this.runXpShown))}`, 'fl-run');
        this.runXpShown -= Math.floor(this.runXpShown);
      }
    } else if (kind === 'exercise') {
      this.floatText(`+${fa(amount)}`, this.combo > 0 ? 'fl-combo' : '');
      Sfx.play('xp');
    }
    let leveled = false;
    while (s.xp >= xpNeed(s.level)) {
      s.xp -= xpNeed(s.level);
      s.level++;
      leveled = true;
      this.onLevelUp(s.level);
    }
    if (leveled) this.persist();
    this.refreshHud();
  },

  onLevelUp(level) {
    Sfx.play('levelup');
    const b = $('levelBanner');
    b.innerHTML = `<small>سطح زور</small><b>${fa(level)}</b>`;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    this.gym.setPlayerLevel(level);
    this.refreshMoves();
    const p = this.gym.player.ch.root.position;
    this.gym.fx.ring({ x: p.x, y: 0.2, z: p.z }, { count: 70, color: '#ffc23d', radius: 0.5, speed: 6, life: 0.9 });
    this.gym.fx.burst({ x: p.x, y: 1.4, z: p.z }, { count: 60, colors: ['#ffc23d', '#ffffff', '#ff7b00'], speed: 3, up: 4, life: 1.4 });
    if (!this.save.unlocked) {
      for (const m of MOVES) {
        if (m.level === level) {
          setTimeout(() => { Sfx.play('unlock'); this.toast(`🔓 «${m.name}» باز شد!`, 'gold'); }, 700);
        }
      }
    }
    const next = opponentFor(this.save.stage);
    if (level === next.level) setTimeout(() => this.toast(`💪 هم‌زور «${next.name}» شدی! دکمه‌ی آماده‌ام رو بزن`, 'gold'), 1400);
  },

  refreshHud(force) {
    const s = this.save;
    const need = xpNeed(s.level);
    const frac = clamp(s.xp / need, 0, 1);
    const key = `${s.level}|${Math.floor(s.xp)}|${s.stage}|${s.muted}`;
    if (force || key !== this.hudKey) {
      this.hudKey = key;
      $('lvlNum').textContent = fa(s.level);
      $('xpFill').style.width = `${frac * 100}%`;
      $('xpText').textContent = `${fa(Math.floor(s.xp))} / ${fa(need)}`;
      const opp = opponentFor(s.stage);
      $('readySub').textContent = `مرحله‌ی ${fa(s.stage)} • حریف سطح ${fa(opp.level)}`;
      $('readyBtn').classList.toggle('hot', s.level >= opp.level);
      $('soundBtn').textContent = s.muted ? '🔇' : '🔊';
    }
    if (force || this.clock - (this.rankT || 0) > 1) {
      this.rankT = this.clock;
      const rows = this.gym.leaderboard(this.playerName(), s.level, s.xp);
      const rank = rows.findIndex((r) => r.isPlayer) + 1;
      $('rankText').textContent = `رتبه ${fa(rank)} از ${fa(rows.length)}`;
      this.gym.drawBoards({ level: s.level, frac, rank, total: rows.length }, rows);
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
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3100);
  },

  floatText(text, cls) {
    const ch = this.gym.player.ch;
    const v = new THREE.Vector3();
    ch.root.getWorldPosition(v);
    v.y += 2.1 + ch.airY;
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

  /* ---------------- start / menus ---------------- */

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
        sw.querySelectorAll('.swatch').forEach((x, j) => x.classList.toggle('on', j === i));
        this.gym.setPlayer({ shirt: c }, this.save.level);
        this.gym.player.mode = this.save.mode;
      });
      sw.appendChild(b);
    });
    $('startStats').textContent = this.save.level > 1 || this.save.stage > 1
      ? `ادامه‌ی بازی: سطح زور ${fa(this.save.level)} • مرحله‌ی کشتی ${fa(this.save.stage)}`
      : '';
    this.openModal('startModal');
  },

  startGame() {
    Sfx.init();
    Sfx.play('go');
    const name = $('nameInput').value.trim().slice(0, 14);
    this.save.name = name;
    this.closeModal('startModal');
    $('hud').hidden = false;
    this.mode = 'gym';
    this.persist();
    this.refreshHud(true);
    this.refreshMoves();
    this.toast(`سلام ${this.playerName()}! تمرین رو شروع کن 💪`, 'gold');
  },

  openCode() {
    $('codeInput').value = '';
    $('codeMsg').textContent = '';
    $('codeMsg').className = 'code-msg';
    this.openModal('codeModal');
    setTimeout(() => $('codeInput').focus(), 50);
  },

  submitCode() {
    const v = digitsOnly($('codeInput').value);
    const msg = $('codeMsg');
    if (v === UNLOCK_CODE) {
      const already = this.save.unlocked;
      this.save.unlocked = true;
      this.persist();
      Sfx.play('unlock');
      msg.textContent = already ? 'همه‌ی حرکت‌ها از قبل باز بودند ✅' : '🔓 همه‌ی حرکت‌های ورزشی باز شد!';
      msg.className = 'code-msg ok';
      this.refreshMoves();
      if (!already) {
        const p = this.gym.player.ch.root.position;
        this.gym.fx.burst({ x: p.x, y: 1.5, z: p.z }, { count: 120, colors: ['#ffc23d', '#2ecc71', '#2f6fed', '#e63946', '#ffffff'], speed: 5, up: 5, life: 1.6 });
        setTimeout(() => { this.closeModal('codeModal'); this.toast('🔓 همه‌ی حرکت‌ها باز شد! امتحانشون کن', 'gold'); }, 900);
      }
    } else {
      Sfx.play('error');
      msg.textContent = v ? 'کد اشتباهه. دوباره امتحان کن.' : 'اول کد رو بنویس.';
      msg.className = 'code-msg bad';
      const card = $('codeModal').querySelector('.card');
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
    }
  },

  openHelp() {
    const list = $('unlockList');
    list.innerHTML = '';
    for (const m of [...MOVES].sort((a, b) => a.level - b.level)) {
      const li = document.createElement('li');
      const un = this.isUnlocked(m);
      li.className = un ? 'open' : '';
      li.innerHTML = `<span>${m.icon} ${m.name}</span><span>${m.level <= 1 ? 'از اول باز' : 'سطح ' + fa(m.level)} ${un ? '✅' : '🔒'}</span>`;
      list.appendChild(li);
    }
    this.openModal('helpModal');
  },

  openBoard() {
    const rows = this.gym.leaderboard(this.playerName(), this.save.level, this.save.xp);
    const tb = $('boardRows');
    tb.innerHTML = '';
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (r.isPlayer) tr.className = 'me';
      tr.innerHTML = `<td>${fa(i + 1)}</td><td>${r.isPlayer ? '⭐ ' : ''}${r.name}</td><td>${fa(r.level)}</td>`;
      tb.appendChild(tr);
    });
    this.openModal('boardModal');
    const me = tb.querySelector('.me');
    if (me) setTimeout(() => me.scrollIntoView({ block: 'center' }), 30);
  },

  openReady() {
    if (this.mode !== 'gym') return;
    Sfx.init();
    const s = this.save;
    const opp = opponentFor(s.stage);
    $('rdStage').textContent = s.stage <= MAIN_STAGES ? `مرحله‌ی ${fa(s.stage)} از ${fa(MAIN_STAGES)}` : `چالش بی‌پایان • مرحله‌ی ${fa(s.stage)}`;
    $('rdOppName').textContent = opp.name;
    $('rdOppTitle').textContent = opp.title;
    $('rdOppLvl').textContent = fa(opp.level);
    $('rdMeName').textContent = this.playerName();
    $('rdMeLvl').textContent = fa(s.level);
    const dots = $('rdDots');
    dots.innerHTML = '';
    for (let i = 1; i <= MAIN_STAGES; i++) {
      const d = document.createElement('span');
      d.className = 'dot' + (i < s.stage ? ' done' : '') + (i === s.stage ? ' now' : '');
      d.textContent = fa(i);
      dots.appendChild(d);
    }
    const adv = $('rdAdvice');
    const diff = s.level - opp.level;
    if (diff >= 3) { adv.textContent = '🔥 تو خیلی از حریف قوی‌تری. برو بخورش!'; adv.className = 'advice good'; }
    else if (diff >= 0) { adv.textContent = '✅ زورت به حریف می‌رسه. با سرعت زور بزن و فن‌ها رو به‌موقع بزن!'; adv.className = 'advice good'; }
    else if (diff >= -2) { adv.textContent = '⚠️ حریف یه کم از تو قوی‌تره. می‌تونی بری، ولی سخته!'; adv.className = 'advice warn'; }
    else { adv.textContent = '⛔ حریف خیلی از تو قوی‌تره. بهتره اول بیشتر تمرین کنی.'; adv.className = 'advice bad'; }
    this.openModal('readyModal');
  },

  /* ---------------- gym <-> arena ---------------- */

  fadeTo(fn) {
    const f = $('fade');
    f.classList.add('on');
    setTimeout(() => {
      try { fn(); } catch (e) { console.error(e); }
      setTimeout(() => f.classList.remove('on'), 80);
    }, 420);
  },

  startMatch() {
    if (this.mode === 'transition') return;
    const s = this.save;
    const opp = opponentFor(s.stage);
    this.closeModal('readyModal');
    this.closeModal('resultModal');
    this.gym.player.ch.stopAction();
    this.mode = 'transition';
    this.fadeTo(() => {
      $('hud').hidden = true;
      this.mode = 'arena';
      this.arena.start({
        opp, playerLevel: s.level, playerName: this.playerName(),
        playerOutfit: this.gym.player.ch.o,
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
    const reward = r.win ? 50 + 40 * opp.stage : 15 + 5 * opp.stage;
    const lastMain = r.win && opp.stage === MAIN_STAGES;
    if (r.win) {
      s.wins++;
      s.stage = Math.max(s.stage, opp.stage + 1);
    } else s.losses++;
    $('resTitle').textContent = r.win ? (lastMain ? '👑 قهرمان افسانه‌ای شدی!' : '🏆 بردی!') : '😓 باختی!';
    $('resTitle').className = r.win ? 'res-title win' : 'res-title lose';
    $('resReason').textContent = (r.win ? 'برد با ' : 'باخت با ') + reasons[r.reason];
    $('resScore').innerHTML = `<span class="red">${fa(r.score.p)}</span><span class="vs">–</span><span class="blue">${fa(r.score.o)}</span>`;
    $('resNames').textContent = `${this.playerName()} در برابر ${opp.name}`;
    $('resXp').textContent = `جایزه: ${fa(reward)} زور`;
    let tip;
    if (lastMain) tip = 'همه‌ی ۱۰ مرحله رو بردی! حالا چالش بی‌پایان شروع می‌شه.';
    else if (r.win) {
      const nx = opponentFor(s.stage);
      tip = `حریف بعدی: ${nx.name} (${nx.title}) با سطح زور ${fa(nx.level)}`;
    } else tip = 'برگرد باشگاه، زورت رو بیشتر کن و دوباره بیا!';
    $('resTip').textContent = tip;
    $('nextBtn').textContent = r.win ? '➡️ ادامه: مرحله‌ی بعد' : '🔁 دوباره کشتی بگیر';
    this.gainXp(reward, 'reward');
    this.persist();
    this.openModal('resultModal');
  },

  backToGym() {
    if (this.mode === 'transition') return;
    this.closeModal('resultModal');
    this.mode = 'transition';
    this.fadeTo(() => {
      this.arena.stop();
      this.mode = 'gym';
      $('hud').hidden = false;
      this.gym.setPlayerLevel(this.save.level);
      this.refreshHud(true);
      this.refreshMoves();
      this.toast('برگشتی باشگاه! زورت رو بیشتر کن 💪');
    });
  },

  /* ---------------- strength tester ---------------- */

  strengthTest() {
    if (this.mode !== 'gym' || this.modals.size) return;
    Sfx.init();
    if (this.gym.startStrengthTest(this.save.level)) Sfx.play('click');
  },

  towerResult(level, rang) {
    const rows = this.gym.leaderboard(this.playerName(), this.save.level, this.save.xp);
    const rank = rows.findIndex((r) => r.isPlayer) + 1;
    this.toast(rang ? `🔔 دینگ! قدرتت سطح ${fa(level)}ـه! تو یه هیولایی!` : `🔨 قدرت تو: سطح ${fa(level)} • رتبه ${fa(rank)} از ${fa(rows.length)}`, 'gold');
  },

  /* ---------------- input ---------------- */

  bindUi() {
    const on = (id, fn) => $(id).addEventListener('click', fn);
    on('startBtn', () => this.startGame());
    on('codeBtn', () => { Sfx.init(); this.openCode(); });
    $('codeForm').addEventListener('submit', (e) => { e.preventDefault(); this.submitCode(); });
    on('helpBtn', () => { Sfx.init(); this.openHelp(); });
    on('rankBtn', () => { Sfx.init(); this.openBoard(); });
    on('soundBtn', () => {
      Sfx.init();
      this.save.muted = !this.save.muted;
      Sfx.setMuted(this.save.muted);
      this.refreshHud();
      this.persist();
    });
    on('readyBtn', () => this.openReady());
    on('fightBtn', () => this.startMatch());
    on('trainBtn', () => this.closeModal('readyModal'));
    on('nextBtn', () => this.startMatch());
    on('gymBtn', () => this.backToGym());
    on('ctxBtn', () => this.strengthTest());
    on('panelToggle', () => {
      const p = $('panel');
      p.classList.toggle('collapsed');
      $('panelToggle').setAttribute('aria-expanded', String(!p.classList.contains('collapsed')));
    });
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.closeModal(b.dataset.close)));
    $('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.startGame(); });
  },

  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Escape') {
        for (const id of ['codeModal', 'helpModal', 'boardModal', 'readyModal']) if (this.modals.has(id)) this.closeModal(id);
        return;
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (this.modals.size) return;
      if (this.mode === 'arena') {
        if (!e.repeat) this.arena.key(e.code);
        return;
      }
      if (this.mode !== 'gym') return;
      this.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === 'Space') this.pendingJump = true;
      if (e.code === 'KeyE') this.strengthTest();
      if (e.code === 'KeyR') this.onMove(MOVE_BY_ID.run);
      if (e.code === 'KeyF') this.onMove(MOVE_BY_ID.jumprun);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.resetJoy(); this.camDrag.clear(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.keys.clear(); this.resetJoy(); this.persist(); } });
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // joystick
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

    // camera drag / pinch on the 3D view
    const cv = $('scene');
    cv.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'gym') return;
      Sfx.init();
      this.camDrag.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    cv.addEventListener('pointermove', (e) => {
      const p = this.camDrag.get(e.pointerId);
      if (!p || this.mode !== 'gym') return;
      const cam = this.gym.cam;
      if (this.camDrag.size >= 2) {
        const pts = [...this.camDrag.values()];
        const before = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        p.x = e.clientX; p.y = e.clientY;
        const after = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        cam.dist = clamp(cam.dist * (before / Math.max(1, after)), 3.5, 13);
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
      if (this.mode !== 'gym') return;
      e.preventDefault();
      this.gym.cam.dist = clamp(this.gym.cam.dist * (e.deltaY > 0 ? 1.1 : 0.9), 3.5, 13);
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
    const enabled = this.mode === 'gym' && !this.modals.size;
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
    this.clock += dt;
    try {
      if (this.mode === 'arena') {
        this.arena.update(dt, this.camera);
        this.renderer.render(this.arena.scene, this.camera);
      } else {
        if (this.mode === 'menu') this.gym.cam.yaw += dt * 0.12;
        const gained = this.gym.update(dt, this.input(), this.camera, this.save.level);
        if (gained > 0) this.gainXp(gained, 'run');
        if (this.mode === 'gym') this.tickHud();
        this.renderer.render(this.gym.scene, this.camera);
      }
    } catch (e) {
      if (!this.errorShown) { this.errorShown = true; console.error(e); }
    }
    this.watchFps(dt);
  },

  tickHud() {
    const busy = !this.gym.canAct();
    if (busy !== this.lastBusy) { this.lastBusy = busy; this.refreshMoves(); }
    const near = this.gym.nearTower() && this.gym.tower.state === 'idle';
    $('ctxBtn').hidden = !near;
    const comboOn = this.combo > 0 && (busy || this.clock - this.lastExerciseEnd <= 1.6);
    if (!comboOn && this.combo > 0 && !busy) this.combo = 0;
    const cb = $('comboBadge');
    cb.hidden = !comboOn;
    if (comboOn) cb.textContent = `کمبو ×${fa((1 + this.combo * 0.1).toFixed(1))}`;
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
