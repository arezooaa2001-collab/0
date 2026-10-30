'use strict';
/* Game features: codes, coins, shop, missions, medals, map, menu, race, pets, AI builder panel */

Object.assign(Game, {
  /* ---------------- codes ---------------- */

  openCode() {
    $('codeInput').value = '';
    $('codeMsg').textContent = '';
    $('codeMsg').className = 'code-msg';
    this.openModal('codeModal');
    setTimeout(() => $('codeInput').focus(), 50);
  },

  codeMsg(text, ok) {
    const msg = $('codeMsg');
    msg.textContent = text;
    msg.className = 'code-msg ' + (ok ? 'ok' : 'bad');
    if (!ok) {
      Sfx.play('error');
      const card = $('codeModal').querySelector('.card');
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
    }
  },

  submitCode() {
    const v = digitsOnly($('codeInput').value);
    if (v === UNLOCK_CODE) {
      const already = this.save.unlocked;
      this.save.unlocked = true;
      this.persist();
      Sfx.play('unlock');
      this.codeMsg(already ? 'همه‌ی حرکت‌ها از قبل باز بودند ✅' : '🔓 همه‌ی حرکت‌های ورزشی باز شد!', true);
      this.refreshMoves();
      if (!already) {
        const p = this.player.ch.root.position;
        this.world.fx.burst({ x: p.x, y: 1.5, z: p.z }, { count: 120, colors: ['#ffc23d', '#2ecc71', '#2f6fed', '#e63946', '#ffffff'], speed: 5, up: 5, life: 1.6 });
        setTimeout(() => { this.closeModal('codeModal'); this.toast('🔓 همه‌ی حرکت‌ها باز شد! امتحانشون کن', 'gold'); }, 900);
      }
    } else if (v === FOOTBALL_CODE) {
      const first = this.unlockFootball();
      this.codeMsg(first ? '⚽ استادیوم مخفی فوتبال باز شد! از نقشه 🗺️ برو و بازی کن' : '⚽ استادیوم مخفی از قبل بازه. از نقشه برو!', true);
      if (first) setTimeout(() => { this.closeModal('codeModal'); this.toast('⚽ استادیوم مخفی فوتبال توی نقشه اضافه شد!', 'gold'); }, 1100);
    } else if (v === BOOST_CODE) {
      const b = this.save.boost;
      if (this.save.level < BOOST_MIN_LEVEL) {
        this.codeMsg(`🔒 کد ۱۹۱۹ از سطح ${fa(BOOST_MIN_LEVEL)} کار می‌کنه. الان سطح ${fa(this.save.level)} هستی؛ یه کم تمرین کن!`, false);
      } else if (this.boostActive()) {
        this.codeMsg('⚡ زور اضافه همین الان روشنه!', true);
      } else if (b.used) {
        this.codeMsg('این کد فقط یک بار کار می‌کنه و قبلاً استفاده‌اش کردی.', false);
      } else {
        b.used = true;
        b.until = Date.now() + BOOST_SECONDS * 1000;
        this.boostWasOn = true;
        this.persist();
        Sfx.play('boost');
        this.codeMsg(`⚡ +${fa(BOOST_LEVELS)} سطح زور برای ۲ دقیقه! سریع ازش استفاده کن`, true);
        setPlayerLevelLook(this.player, this.lv());
        this.showBanner('⚡ زور اضافه', '+' + fa(BOOST_LEVELS));
        const p = this.player.ch.root.position;
        this.world.fx.ring({ x: p.x, y: 0.3, z: p.z }, { count: 90, color: '#7fe0ff', radius: 0.5, speed: 7, life: 1.0 });
        this.refreshHud(true);
        this.refreshMoves();
        this.checkAchievements();
        setTimeout(() => this.closeModal('codeModal'), 1100);
      }
    } else {
      this.codeMsg(v ? 'کد اشتباهه. دوباره امتحان کن.' : 'اول کد رو بنویس.', false);
    }
  },

  drinkActive() { return Date.now() < (this.drinkUntil || 0); },

  /** Countdown badges for the boost code and the energy drink. */
  tickTimers() {
    const now = Date.now();
    const bt = $('boostBadge');
    if (this.boostActive()) {
      const left = Math.ceil((this.save.boost.until - now) / 1000);
      bt.hidden = false;
      bt.textContent = `⚡ +${fa(BOOST_LEVELS)} • ${fa(Math.floor(left / 60))}:${fa(String(left % 60).padStart(2, '0'))}`;
      this.boostWasOn = true;
    } else {
      bt.hidden = true;
      if (this.boostWasOn) {
        this.boostWasOn = false;
        this.toast('⚡ زمان کد ۱۹۱۹ تموم شد و زور اضافه رفت.', 'warn');
        setPlayerLevelLook(this.player, this.lv());
        this.refreshHud(true);
        this.refreshMoves();
      }
    }
    const db = $('drinkBadge');
    if (this.drinkActive()) {
      db.hidden = false;
      db.textContent = `🥤 زور ×۲ • ${fa(Math.ceil((this.drinkUntil - now) / 1000))}`;
    } else db.hidden = true;
  },

  /* ---------------- coins & stats ---------------- */

  owns(id) { return this.save.shop.owned.includes(id); },

  addCoins(n, show) {
    if (!(n > 0)) return;
    if (this.owns('magnet')) n *= 2;
    this.save.coins += n;
    this.save.stats.coinsEarned += n;
    if (show) this.floatText(`🪙+${fa(n)}`, 'fl-coin');
    Sfx.play('coin');
    this.refreshHud();
  },

  noteRep(m) {
    const st = this.save.stats;
    st.reps++;
    st.moves[m.id] = (st.moves[m.id] || 0) + 1;
    if (m.equip) st.equipReps++;
    this.addCoins(1 + Math.floor((m.level || 1) / 8), true);
    this.missionProgress('reps', 1);
    this.noteEventRep();
    this.chalEvent('rep', m);
    this.missionProgress('move', 1, m.id);
    if (m.equip) this.missionProgress('equip', 1);
    this.checkAchievements();
  },

  noteCombo(c) {
    this.chalEvent('combo', c);
    if (c > this.save.stats.maxCombo) this.save.stats.maxCombo = c;
    this.missionProgress('combo', c, null, true);
  },

  noteRun(meters) {
    this.chalEvent('run', meters);
    this.runMeters = (this.runMeters || 0) + meters;
    if (this.runMeters >= 10) {
      this.missionProgress('run', Math.floor(this.runMeters));
      this.runMeters -= Math.floor(this.runMeters);
    }
  },

  /* ---------------- missions ---------------- */

  newMission() {
    const lv = this.lv();
    const tpl = pick(MISSION_TYPES.filter((t) => {
      if (t.type === 'win') return lv >= opponentFor(this.save.stage).level - 3;
      if (t.type === 'visit') return ENVS.some((e) => !e.secret && lv >= e.level);
      if (t.type === 'power') return this.powerUnlocked(POWERS[0]);
      return true;
    }));
    const n = pick(tpl.targets);
    const m = { type: tpl.type, n, p: 0 };
    if (tpl.type === 'move') {
      const opts = MOVES.filter((x) => !x.toggle && !x.equip && !x.emote && this.isUnlocked(x));
      m.key = pick(opts).id;
    }
    if (tpl.type === 'visit') {
      const opts = ENVS.filter((e) => !e.secret && lv >= e.level);
      m.key = pick(opts).id;
    }
    m.reward = Math.round((30 + n * (tpl.type === 'run' ? 0.15 : tpl.type === 'win' ? 40 : 4)) * (1 + lv / 40));
    return m;
  },

  ensureMissions() {
    const ms = this.save.missions;
    for (let i = ms.length - 1; i >= 0; i--) {
      const m = ms[i];
      if (!m || !MISSION_TYPES.some((t) => t.type === m.type) || (m.type === 'move' && (!MOVE_BY_ID[m.key] || MOVE_BY_ID[m.key].emote)) || (m.type === 'visit' && !ENV_BY_ID[m.key])) ms.splice(i, 1);
    }
    while (ms.length < 3) ms.push(this.newMission());
  },

  missionText(m) {
    const tpl = MISSION_TYPES.find((t) => t.type === m.type);
    return tpl.text(m.n, MOVE_BY_ID[m.key], ENV_BY_ID[m.key]);
  },

  missionProgress(type, amount, key, isMax) {
    let changed = false;
    for (const m of this.save.missions) {
      if (m.type !== type || m.done) continue;
      if ((type === 'move' || type === 'visit') && m.key !== key) continue;
      m.p = isMax ? Math.max(m.p, amount) : m.p + amount;
      changed = true;
      if (m.p >= m.n) {
        m.done = true;
        this.save.stats.missionsDone++;
        Sfx.play('medal');
        this.toast(`🎯 مأموریت انجام شد: ${this.missionText(m)} • 🪙 ${fa(m.reward)}`, 'gold');
        this.addCoins(m.reward);
        this.gainXp(Math.round(m.reward * 2 * xpMult(this.save.level)), 'reward');
        setTimeout(() => {
          const i = this.save.missions.indexOf(m);
          if (i >= 0) this.save.missions.splice(i, 1, this.newMission());
          this.renderMissionChip();
          if (!$('missionModal').hidden) this.openMissions();
        }, 1500);
      }
    }
    if (changed) {
      this.renderMissionChip();
      this.checkAchievements();
    }
  },

  renderMissionChip() {
    const m = this.save.missions.find((x) => !x.done) || this.save.missions[0];
    if (!m) return;
    const txt = `🎯 ${this.missionText(m)} • ${fa(Math.min(Math.floor(m.p), m.n))}/${fa(m.n)}`;
    if ($('missionChip').textContent !== txt) $('missionChip').textContent = txt;
  },

  openMissions() {
    this.closeModal('menuModal');
    const list = $('missionList');
    list.innerHTML = '';
    for (const m of this.save.missions) {
      const li = document.createElement('li');
      li.className = m.done ? 'done' : '';
      const t = document.createElement('div');
      t.className = 'mi-text';
      t.textContent = this.missionText(m);
      const bar = document.createElement('div');
      bar.className = 'mi-bar';
      const fill = document.createElement('div');
      fill.style.width = `${clamp(m.p / m.n, 0, 1) * 100}%`;
      bar.appendChild(fill);
      const r = document.createElement('div');
      r.className = 'mi-reward';
      r.textContent = m.done ? '✅ انجام شد' : `${fa(Math.min(Math.floor(m.p), m.n))}/${fa(m.n)} • 🪙 ${fa(m.reward)}`;
      li.append(t, bar, r);
      list.appendChild(li);
    }
    this.openModal('missionModal');
  },

  /* ---------------- medals ---------------- */

  checkAchievements() {
    const s = this.save;
    for (const a of ACHIEVEMENTS) {
      if (s.achievements.includes(a.id)) continue;
      let ok = false;
      try { ok = a.test(s); } catch (e) { ok = false; }
      if (!ok) continue;
      s.achievements.push(a.id);
      setTimeout(() => {
        Sfx.play('medal');
        this.toast(`🏅 مدال جدید: ${a.icon} ${a.name} • 🪙 ۵۰`, 'gold');
      }, 400);
      s.coins += 50;
      s.stats.coinsEarned += 50;
    }
  },

  openMedals() {
    this.closeModal('menuModal');
    const g = $('medalGrid');
    g.innerHTML = '';
    for (const a of ACHIEVEMENTS) {
      const got = this.save.achievements.includes(a.id);
      const d = document.createElement('div');
      d.className = 'medal' + (got ? ' got' : '');
      const i = document.createElement('div');
      i.className = 'medal-icon';
      i.textContent = got ? a.icon : '🔒';
      const n = document.createElement('b');
      n.textContent = a.name;
      const s = document.createElement('small');
      s.textContent = a.desc;
      d.append(i, n, s);
      g.appendChild(d);
    }
    $('medalCount').textContent = `${fa(this.save.achievements.length)} از ${fa(ACHIEVEMENTS.length)}`;
    this.openModal('medalModal');
  },

  /* ---------------- shop ---------------- */

  openShop() {
    this.renderShop();
    this.openModal('shopModal');
  },

  renderShop() {
    $('shopCoins').textContent = fa(this.save.coins);
    const g = $('shopGrid');
    g.innerHTML = '';
    const sh = this.save.shop;
    const cats = { boost: 'نوشیدنی', gear: 'وسیله', pet: 'حیوون', aura: 'هاله', shirt: 'لباس', band: 'هدبند', trail: 'رد پا' };
    for (const it of SHOP) {
      const owned = it.once && this.owns(it.id);
      const equipped = ['shirt', 'band', 'aura', 'pet', 'trail'].includes(it.cat) && sh[it.cat] === it.id;
      const card = document.createElement('div');
      card.className = 'shop-card' + (equipped ? ' on' : '');
      const ic = document.createElement('div');
      ic.className = 'shop-icon';
      ic.textContent = it.icon;
      if (it.color) ic.style.background = `radial-gradient(circle, ${it.color}55, transparent 70%)`;
      const name = document.createElement('b');
      name.textContent = it.name;
      const desc = document.createElement('small');
      desc.textContent = `${cats[it.cat]} • ${it.desc}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shop-btn';
      const equipable = ['shirt', 'band', 'aura', 'pet', 'trail'].includes(it.cat);
      if (owned && equipable) {
        btn.textContent = equipped ? 'برش دار' : 'بپوش / استفاده کن';
        btn.addEventListener('click', () => this.equipItem(it, !equipped));
      } else if (owned) {
        btn.textContent = 'خریدی ✅';
        btn.disabled = true;
      } else {
        btn.textContent = `🪙 ${fa(it.price)}`;
        btn.disabled = this.save.coins < it.price;
        btn.addEventListener('click', () => this.buyItem(it));
      }
      card.append(ic, name, desc, btn);
      g.appendChild(card);
    }
  },

  buyItem(it) {
    if (this.save.coins < it.price) { Sfx.play('error'); return; }
    if (it.once && this.owns(it.id)) return;
    this.save.coins -= it.price;
    Sfx.play('buy');
    if (it.once) this.save.shop.owned.push(it.id);
    if (it.id === 'drink') {
      this.drinkUntil = Math.max(Date.now(), this.drinkUntil || 0) + 90000;
      this.toast('🥤 ۹۰ ثانیه زور دوبرابر!', 'gold');
    } else if (it.id === 'shake') {
      this.addTempLevels(2, 'shake');
      this.toast('🥛 +۲ سطح زور برای ۵ دقیقه!', 'gold');
    } else if (it.id === 'shoes') this.toast('👟 کفش سرعت رو پوشیدی! سریع‌تر می‌دوی.', 'gold');
    else if (it.id === 'magnet') this.toast('👛 از این به بعد سکه‌ها دوبرابرن!', 'gold');
    if (['shirt', 'band', 'aura', 'pet', 'trail'].includes(it.cat)) this.equipItem(it, true);
    this.checkAchievements();
    this.persist();
    this.refreshHud(true);
    this.renderShop();
  },

  equipItem(it, on) {
    const sh = this.save.shop;
    sh[it.cat] = on ? it.id : null;
    if (it.cat === 'shirt' || it.cat === 'band') this.rebuildPlayer();
    if (it.cat === 'pet') {
      if (this.pet) this.world.scene.remove(this.pet.root);
      this.pet = null;
      this.attachPet();
    }
    Sfx.play('click');
    this.persist();
    this.renderShop();
  },

  attachPet() {
    const id = this.save.shop.pet;
    if (!id || !this.owns(id)) { this.pet = null; return; }
    if (!this.pet || this.pet.kind !== id) this.pet = new Pet(id);
    this.pet.root.userData.noSolid = true;
    this.world.scene.add(this.pet.root);
    this.pet.place(this.player.ch.root.position);
  },

  tickAura(dt) {
    const id = this.save.shop.aura;
    if (!id || this.mode !== 'play' || !this.owns(id)) return;
    this.auraT = (this.auraT || 0) + dt;
    if (this.auraT < 0.05) return;
    this.auraT = 0;
    const p = this.player.ch.root.position;
    const c = new THREE.Color(SHOP_BY_ID[id].color);
    const a = Math.random() * TAU;
    this.world.fx.emit(p.x + Math.cos(a) * 0.5, 0.2 + Math.random() * 1.6 + this.player.ch.airY, p.z + Math.sin(a) * 0.5, 0, id === 'aura_ice' ? -0.3 : 0.9, 0, c, 0.9, id === 'aura_ice' ? 0.2 : -0.5);
  },

  /* ---------------- race ---------------- */

  nearRaceStart() {
    const p = this.player.ch.root.position;
    return Math.hypot(p.x - (TRACK.cx + TRACK.a + 1.2), p.z - TRACK.cz) < 2.4;
  },

  startRace() {
    if (this.race || this.world !== this.gym || !this.world.canAct()) return;
    this.cancelChallenge();
    this.releasePlayer();
    this.raceMode = this.player.mode;
    this.player.mode = 'run';
    this.race = new Race(this.gym, this.player, this.save.runLevel, this.stats().speedMult);
    this.missionProgress('race', 1);
    this.refreshMoves();
    $('raceHud').hidden = false;
    Sfx.play('tick');
    this.raceCount = 3;
    this.showBanner('مسابقه‌ی دو', '۳');
  },

  tickRace(dt) {
    const R = this.race;
    const res = R.update(dt);
    if (R.state === 'count') {
      const c = Math.ceil(3 - R.t);
      if (c !== this.raceCount && c > 0) { this.raceCount = c; Sfx.play('tick'); this.showBanner('آماده', fa(c)); }
      $('raceHud').textContent = '🏁 آماده باش… دکمه‌ی حرکت رو نگه دار!';
      return;
    }
    if (this.raceCount !== 0) { this.raceCount = 0; Sfx.play('go'); this.showBanner('مسابقه', 'برو!'); }
    const pct = clamp(R.progress / TAU, 0, 1);
    $('raceHud').textContent = `🏁 ${fa(Math.round(pct * 100))}٪ از دور • نفر ${fa(R.position())} از ۴`;
    if (!res) return;
    const place = res.place;
    const coins = [0, 120, 70, 40, 20][place];
    R.dispose();
    this.race = null;
    this.player.mode = this.raceMode || 'walk';
    $('raceHud').hidden = true;
    if (place === 1) {
      this.save.stats.raceWins++;
      Sfx.play('win');
      this.showBanner('🥇 اول شدی!', '🏁');
    } else {
      Sfx.play(place <= 3 ? 'success' : 'lose');
      this.showBanner(res.timeout ? 'وقت تموم شد' : 'نفر ' + fa(place), '🏁');
    }
    this.toast(`🏁 مسابقه تموم شد: نفر ${fa(place)} • 🪙 ${fa(coins)} و امتیاز دویدن`, 'gold');
    this.addCoins(coins);
    this.gainRun(Math.round(60 / place));
    this.checkAchievements();
    this.refreshMoves();
    this.persist();
  },

  /* ---------------- map & menu ---------------- */

  openMap() {
    if (this.mode !== 'play' || this.race) return;
    const g = $('mapGrid');
    g.innerHTML = '';
    const lv = this.lv();
    const add = (icon, name, desc, level, here, go) => {
      const b = document.createElement('button');
      b.type = 'button';
      const locked = lv < level;
      b.className = 'map-card' + (locked ? ' locked' : '') + (here ? ' here' : '');
      const i = document.createElement('span');
      i.className = 'map-icon';
      i.textContent = locked ? '🔒' : icon;
      const n = document.createElement('b');
      n.textContent = name;
      const d = document.createElement('small');
      d.textContent = here ? '📍 الان این‌جایی' : locked ? `سطح ${fa(level)} لازمه` : desc;
      b.append(i, n, d);
      b.addEventListener('click', () => {
        if (here) { this.closeModal('mapModal'); return; }
        if (locked) { Sfx.play('error'); this.toast(`🔒 «${name}» در سطح ${fa(level)} باز می‌شه.`, 'warn'); return; }
        go();
      });
      g.appendChild(b);
    };
    const head = (text) => {
      const h = document.createElement('div');
      h.className = 'map-head';
      h.textContent = text;
      g.appendChild(h);
    };
    head('🏆 باشگاه‌های قهرمان');
    add('🏋️', 'باشگاه قهرمانان', 'باشگاه اول: تمرین، قدرت‌سنج و کشتی', 1, this.where === 'gym', () => this.travel('gym'));
    for (const e of GYM_ENVS) add(e.icon, e.name, e.desc, e.level, this.where === 'env' && this.envId === e.id, () => this.travel('env', e.id));
    head('🗺️ مکان‌های ورزشی');
    for (const e of ENVS) {
      if (e.gym) continue;
      if (e.secret && !this.save.secretFootball) continue;
      add(e.icon, e.name, e.desc, e.level, this.where === 'env' && this.envId === e.id, () => this.travel('env', e.id));
    }
    add('🌥️', 'جزیره‌ی ابرها', 'ساختن با هوش مصنوعی', ISLAND_LEVEL, this.where === 'island', () => this.travel('island'));
    add('🍀', 'جزیره‌ی خوش‌شانسی', 'هر چند قدم +۱۰ سطح موقت (۵ دقیقه)', LUCKY_LEVEL, this.where === 'lucky', () => this.travel('lucky'));
    for (const c of Creations.items.filter((x) => x.kind === 'place').slice(0, 6)) {
      add(c.icon, c.name, 'ساخته‌ی هوش مصنوعی', ISLAND_LEVEL, this.where === 'place' && this.placeItem && this.placeItem.id === c.id, () => this.travel('place', c));
    }
    this.openModal('mapModal');
  },

  openMenu() {
    $('musicState').textContent = this.save.music ? 'روشن' : 'خاموش';
    this.openModal('menuModal');
  },

  menuAction(a) {
    if (a === 'missions') this.openMissions();
    else if (a === 'medals') this.openMedals();
    else if (a === 'goals') this.openGoals();
    else if (a === 'code') { this.closeModal('menuModal'); this.openCode(); }
    else if (a === 'help') { this.closeModal('menuModal'); this.openHelp(); }
    else if (a === 'wheel') this.openWheel();
    else if (a === 'challenges') this.openChallenges();
    else if (a === 'photo') this.enterPhoto();
    else if (a === 'watch') this.openWatch(this.worldKey(this.world) || 'gym');
    else if (a === 'settings') this.openSettings();
    else if (a === 'levels') this.openLevels();
    else if (a === 'board') { this.closeModal('menuModal'); this.openBoard(); }
    else if (a === 'music') {
      this.save.music = !this.save.music;
      Sfx.music(this.save.music);
      $('musicState').textContent = this.save.music ? 'روشن' : 'خاموش';
      this.persist();
    }
  },

  openHelp() {
    const list = $('unlockList');
    list.innerHTML = '';
    for (const m of [...MOVES].sort((a, b) => a.level - b.level)) {
      const li = document.createElement('li');
      const un = this.isUnlocked(m);
      li.className = un ? 'open' : '';
      const a = document.createElement('span');
      a.textContent = `${m.icon} ${m.name}${m.equip ? ' 📍' : ''}`;
      const b = document.createElement('span');
      b.textContent = `${m.level <= 1 ? 'از اول' : 'سطح ' + fa(m.level)} ${un ? '✅' : '🔒'}`;
      li.append(a, b);
      list.appendChild(li);
    }
    this.openModal('helpModal');
  },

  openBoard() {
    const rows = this.leaderboardAll();
    const tb = $('boardRows');
    tb.innerHTML = '';
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (r.isPlayer) tr.className = 'me';
      for (const t of [fa(i + 1), (r.isPlayer ? '⭐ ' : '') + r.name, fa(r.level)]) {
        const td = document.createElement('td');
        td.textContent = t;
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    });
    this.openModal('boardModal');
    const me = tb.querySelector('.me');
    if (me) setTimeout(() => me.scrollIntoView({ block: 'center' }), 30);
  },

  /* ---------------- AI builder ---------------- */

  onCreations(items) {
    if (this.island) this.island.setCreations(items);
    this.setCustomMoves(items);
    if (!$('aiModal').hidden) this.renderCreations();
  },

  async openAi() {
    if (this.lv() < ISLAND_LEVEL) {
      this.toast(`🔒 سازنده‌ی هوش مصنوعی توی جزیره‌ی ابرهاست و در سطح ${fa(ISLAND_LEVEL)} باز می‌شه.`, 'warn');
      return;
    }
    Sfx.init();
    this.openModal('aiModal');
    this.renderCreations();
    const status = $('aiStatus');
    status.textContent = 'در حال وصل شدن…';
    const sample = await AI.connect();
    const parts = [sample ? '🟢 هوش مصنوعی Claude وصله' : '⚪ حالت آفلاین: سازنده‌ی ساده (هوش مصنوعی واقعی وقتی کار می‌کنه که بازی داخل Claude باز شده باشه)'];
    parts.push(Creations.db ? '🌐 ساخته‌ها بین همه‌ی بازیکن‌ها مشترکه' : '💾 ساخته‌ها روی همین دستگاه ذخیره می‌شه');
    status.textContent = parts.join(' • ');
    if (!$('aiLog').children.length) this.aiSay('bot', 'سلام! من سازنده‌ی جزیره‌ام 🤖 بگو چه وسیله‌ی ورزشی، چه ورزش جدیدی یا چه مکان ورزشی‌ای برات بسازم. هرچی بسازم بقیه‌ی ورزشکارها هم ازش استفاده می‌کنن!');
    setTimeout(() => $('aiInput').focus(), 60);
  },

  aiSay(who, text, extra) {
    const log = $('aiLog');
    const el = document.createElement('div');
    el.className = 'ai-msg ' + who;
    const p = document.createElement('p');
    p.textContent = text;
    el.appendChild(p);
    if (extra) el.appendChild(extra);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  },

  async sendAi(textArg) {
    const input = $('aiInput');
    const text = (textArg || input.value).trim().slice(0, 400);
    if (!text || this.aiBusy) return;
    input.value = '';
    this.aiSay('me', text);
    this.aiBusy = true;
    $('aiSend').disabled = true;
    const wait = this.aiSay('bot wait', 'دارم می‌سازمش… 🛠️');
    try {
      const res = await AI.create(text);
      wait.remove();
      if (res.refuse) {
        this.aiSay('bot', res.refuse);
      } else {
        const item = res.item;
        item.author = this.playerName();
        const shared = await Creations.add(item);
        let extra = null;
        if (item.kind === 'place') {
          extra = document.createElement('button');
          extra.type = 'button';
          extra.className = 'chip-btn';
          extra.textContent = `${item.icon} برو به ${item.name}`;
          extra.addEventListener('click', () => { this.closeModal('aiModal'); this.travel('place', item); });
        }
        const where = item.kind === 'equipment' ? 'توی جزیره کنار بقیه‌ی وسیله‌ها گذاشتمش.' : item.kind === 'exercise' ? 'دکمه‌اش توی زبانه‌ی «ساخته‌ها» اضافه شد.' : 'دروازه‌اش لب جزیره ساخته شد و توی نقشه هم هست.';
        const eff = item.effect ? ` (${effectText(item.effect)})` : '';
        this.aiSay('bot', `${res.reply} ${item.icon} «${item.name}»${eff}. ${where} ${shared ? '🌐 بقیه‌ی بازیکن‌ها هم می‌بیننش.' : ''}`, extra);
        Sfx.play('unlock');
        this.addCoins(20);
      }
    } catch (e) {
      wait.remove();
      const code = e && e.code;
      const msg = code === 'not_granted' ? 'اجازه‌ی استفاده از هوش مصنوعی داده نشد. می‌تونی از تنظیمات صفحه اجازه بدی.'
        : code === 'rate_limited' ? 'یه کم زیاد درخواست دادی. چند لحظه صبر کن و دوباره بفرست.'
          : 'این دفعه نتونستم بسازمش. یه جور دیگه بگو، مثلاً: «یه دستگاه پارو زدن قرمز بساز»';
      this.aiSay('bot', msg);
    }
    this.aiBusy = false;
    $('aiSend').disabled = false;
  },

  renderCreations() {
    const list = $('aiList');
    list.innerHTML = '';
    const items = Creations.items;
    $('aiCount').textContent = fa(items.length);
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'هنوز چیزی ساخته نشده. اولین وسیله رو تو بساز!';
      list.appendChild(li);
      return;
    }
    const kinds = { equipment: 'وسیله', exercise: 'ورزش', place: 'مکان' };
    for (const c of items) {
      const li = document.createElement('li');
      const t = document.createElement('span');
      t.className = 'ai-item';
      t.textContent = `${c.icon} ${c.name} • ${kinds[c.kind]} • ${c.author}`;
      li.appendChild(t);
      if (c.kind === 'place') {
        const go = document.createElement('button');
        go.type = 'button';
        go.className = 'chip-btn';
        go.textContent = 'برو';
        go.addEventListener('click', () => { this.closeModal('aiModal'); this.travel('place', c); });
        li.appendChild(go);
      }
      if (Creations.mine.has(c.id)) {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'chip-btn del';
        del.textContent = 'حذف';
        del.setAttribute('aria-label', 'حذف ' + c.name);
        del.addEventListener('click', () => {
          if (this.where === 'place' && this.placeItem && this.placeItem.id === c.id) { this.toast('اول از این مکان برو بیرون، بعد حذفش کن.', 'warn'); return; }
          this.places.delete(c.id);
          Creations.remove(c.id);
        });
        li.appendChild(del);
      }
      list.appendChild(li);
    }
  },
});
