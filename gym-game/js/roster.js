'use strict';
/*
 * The gym's athletes are one population that moves around. Everybody starts in the gym; the
 * other places start empty. People walk out of the main door to the venues their level allows,
 * through the cloud portal only at level 100+ and through the lucky portal only at 250+, and come
 * back later. Places you are not in keep going in the background (training, travelling).
 */

Object.assign(WorldBase.prototype, {
  simulateExtra(dt) { this.updateExtra(dt, { level: 0 }); },
});

Object.assign(Game, {
  initRoster() {
    const saved = Array.isArray(this.save.npcs) ? this.save.npcs : [];
    this.people = [...this.gym.npcs];
    this.people.forEach((n, i) => {
      n.id = i;
      n.loc = 'gym';
      n.world = this.gym;
      n.stayT = 0;
      n.travelCd = rand(20, 80);
      const s = saved[i];
      if (s && s.loc && s.loc !== 'gym' && this.validLoc(s.loc, n.level)) {
        this.gym.dropNpc(n);
        n.loc = s.loc;
        n.stayT = rand(40, 160);
      }
    });
    if (!saved.length) {
      // a few gifted athletes start strong, so you'll see someone reach the islands before long
      [...this.people].sort(() => Math.random() - 0.5).slice(0, 4).forEach((n, i) => {
        n.level = [72, 64, 55, 45][i];
        n.rate = rand(0.75, 0.95);
        n.xp = rand(0, xpNeed(n.level) * 0.5);
        n.ch.setMuscle(muscleFor(n.level));
        n.ch.setLabel(n.name, 'سطح ' + fa(n.level), '#7fe0ff');
      });
    }
    WorldBase.prototype.rosterChoose = (world, n) => this.npcMaybeTravel(world, n);
    WorldBase.prototype.onNpcExit = (world, n) => this.npcExited(world, n);
    WorldBase.prototype.onNpcLevel = (world, n) => this.npcLeveled(n);
    this.rosterT = 0;
  },

  validLoc(loc, level) {
    if (loc === 'island') return level >= ISLAND_LEVEL;
    if (loc === 'lucky') return level >= LUCKY_LEVEL;
    const e = ENV_BY_ID[loc];
    return !!(e && !e.secret && level >= e.level);
  },

  worldKey(w) {
    if (!w) return null;
    if (w === this.gym) return 'gym';
    if (w === this.island) return 'island';
    if (w === this.lucky) return 'lucky';
    if (w.env) return w.env;
    return null;
  },

  builtWorld(key) {
    if (key === 'gym') return this.gym;
    if (key === 'island') return this.island || null;
    if (key === 'lucky') return this.lucky || null;
    return this.envs.get(key) || null;
  },

  locName(key) {
    if (key === 'gym') return 'باشگاه';
    if (key === 'island') return 'جزیره‌ی ابرها';
    if (key === 'lucky') return 'جزیره‌ی خوش‌شانسی';
    return ENV_BY_ID[key] ? ENV_BY_ID[key].name : key;
  },

  locIcon(key) {
    if (key === 'gym') return '🏋️';
    if (key === 'island') return '🌥️';
    if (key === 'lucky') return '🍀';
    return ENV_BY_ID[key] ? ENV_BY_ID[key].icon : '📍';
  },

  /** All places people may live, in map order. */
  rosterPlaces() {
    return ['gym', ...ENVS.filter((e) => !e.secret).map((e) => e.id), 'island', 'lucky'];
  },

  pickDestination(n) {
    if (n.level >= LUCKY_LEVEL && Math.random() < 0.5) return 'lucky';
    if (n.level >= ISLAND_LEVEL && Math.random() < 0.55) return 'island';
    const opts = ENVS.filter((e) => !e.secret && n.level >= e.level).map((e) => e.id);
    return opts.length ? pick(opts) : null;
  },

  /** Called when an NPC picks its next activity. Returns true if it set off travelling. */
  npcMaybeTravel(world, n) {
    const key = this.worldKey(world);
    if (!key || !this.people) return false;
    let dest = null;
    if (key === 'gym') {
      if (n.travelCd > 0) return false;
      const away = this.people.filter((p) => p.loc !== 'gym').length;
      const strong = n.level >= ISLAND_LEVEL;
      if (!strong && (away > this.people.length * 0.4 || Math.random() > 0.18)) { n.travelCd = rand(20, 60); return false; }
      dest = this.pickDestination(n);
      if (!dest) { n.travelCd = rand(30, 60); return false; }
    } else {
      if (n.stayT > 0) return false;
      dest = 'gym';
    }
    world.leaveStation(n);
    n.state = 'leave';
    n.dest = dest;
    n.exit = world.exitPoint(dest);
    n.leaveT = 0;
    n.stuckT = 0;
    n.ch.setLabel(n.name, `${this.locIcon(dest)} داره میره ${this.locName(dest)}`, '#ffd34d');
    return true;
  },

  /** The NPC reached the door / portal: move it to its destination. */
  npcExited(world, n) {
    const from = this.worldKey(world);
    world.dropNpc(n);
    if (world === this.world && (n.dest === 'island' || n.dest === 'lucky')) {
      Sfx.play('whoosh');
      this.toast(`${this.locIcon(n.dest)} ${n.name} (سطح ${fa(n.level)}) رفت ${this.locName(n.dest)}!`, 'gold');
    }
    this.placePerson(n, n.dest, from, true);
  },

  /** Put a person in a place; if that place is built they appear (walking in at the door when `visible`). */
  placePerson(n, dest, from, visible) {
    n.loc = dest;
    n.stayT = dest === 'gym' ? 0 : rand(70, 200);
    n.travelCd = rand(40, 120);
    n.state = 'idle';
    const target = this.builtWorld(dest);
    if (!target) return;
    const seen = visible && (target === this.world || target === this.watchWorld);
    target.adoptNpc(n, seen ? target.entrance(from) : null);
    if (target === this.world && this.mode === 'play') this.toast(`👋 ${n.name} (سطح ${fa(n.level)}) اومد ${dest === 'gym' ? 'باشگاه' : 'اینجا'}`);
  },

  npcLeveled(n) {
    if (n.level === ISLAND_LEVEL && n.world === this.world) {
      this.toast(`🌥️ ${n.name} به سطح ۱۰۰ رسید! حالا می‌تونه بره جزیره‌ی ابرها`, 'gold');
      n.travelCd = Math.min(n.travelCd, 4);
    } else if (n.level === LUCKY_LEVEL && n.world === this.world) {
      this.toast(`🍀 ${n.name} به سطح ۲۵۰ رسید! راه جزیره‌ی خوش‌شانسی براش باز شد`, 'gold');
      n.travelCd = Math.min(n.travelCd, 4);
    }
  },

  /** Adopt everyone who lives in a place that has just been built. */
  settleResidents(world) {
    const key = this.worldKey(world);
    for (const n of this.people) if (n.loc === key && !n.world) world.adoptNpc(n, null);
  },

  /** Once a second: timers, background training and travel for places nobody is looking at. */
  tickRoster(dt) {
    this.rosterT += dt;
    if (this.rosterT < 1) return;
    const step = this.rosterT;
    this.rosterT = 0;
    for (const n of this.people) {
      n.stayT -= step;
      n.travelCd -= step;
      const live = n.world && (n.world === this.world || n.world === this.watchWorld);
      if (live) continue;
      // background training
      n.xp += 4 * n.rate * xpMult(n.level) * NPC_GROWTH * step * 0.5;
      const from = n.level;
      while (n.xp >= xpNeed(n.level)) { n.xp -= xpNeed(n.level); n.level++; }
      if (n.level > from) {
        n.ch.setMuscle(muscleFor(n.level));
        n.ch.setLabel(n.name, 'سطح ' + fa(n.level), '#7fe0ff');
      }
      // background travel
      if (n.state === 'leave') {
        const fromKey = n.loc;
        if (n.world) n.world.dropNpc(n);
        this.placePerson(n, n.dest, fromKey, true);
        continue;
      }
      if (n.loc === 'gym') {
        if (n.travelCd > 0) continue;
        const away = this.people.filter((p) => p.loc !== 'gym').length;
        if (n.level < ISLAND_LEVEL && (away > this.people.length * 0.4 || Math.random() > 0.05)) { n.travelCd = rand(10, 40); continue; }
        const dest = this.pickDestination(n);
        if (!dest) { n.travelCd = rand(30, 60); continue; }
        if (n.world) n.world.dropNpc(n);
        this.placePerson(n, dest, 'gym', true);
      } else if (n.stayT <= 0) {
        const from2 = n.loc;
        if (n.world) n.world.dropNpc(n);
        this.placePerson(n, 'gym', from2, true);
      }
    }
  },

  /** Everyone plus you, strongest first. */
  leaderboardAll() {
    const rows = this.people.map((n) => ({ name: n.name, level: n.level, xp: n.xp, isPlayer: false, loc: n.loc }));
    rows.push({ name: this.playerName(), level: this.lv(), xp: this.save.xp, isPlayer: true, loc: this.worldKey(this.world) || 'gym' });
    rows.sort((a, b) => b.level - a.level || b.xp - a.xp);
    return rows;
  },
});

/* the gym: people leave through the main door, or the portals for the islands */
Object.assign(GymWorld.prototype, {
  entrance(from) {
    if (from === 'island') return { x: PORTAL.x + 1.5, z: PORTAL.z - 2.2 };
    if (from === 'lucky') return { x: LUCKY_PORTAL.x + 1.5, z: LUCKY_PORTAL.z - 2.2 };
    return { x: rand(-1.5, 1.5), z: ROOM.z - 3 };
  },
  exitPoint(dest) {
    if (dest === 'island') return { x: PORTAL.x, z: PORTAL.z };
    if (dest === 'lucky') return { x: LUCKY_PORTAL.x, z: LUCKY_PORTAL.z };
    return { x: rand(-1.2, 1.2), z: ROOM.z - 1.2 };
  },
  leaderboard() { return Game.leaderboardAll(); },
});

Object.assign(IslandWorld.prototype, {
  entrance() { return { x: ISLAND_PORTAL.x * 0.85, z: ISLAND_PORTAL.z * 0.85 }; },
  exitPoint() { return { x: ISLAND_PORTAL.x, z: ISLAND_PORTAL.z }; },
});
