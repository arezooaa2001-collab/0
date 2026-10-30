'use strict';
/*
 * Only strength you earn by exercising is yours to keep. Levels that come from anywhere else
 * (Lucky Island, equipment or exercises the AI built, the wheel, treasure chests, protein shakes)
 * are temporary: each batch disappears 5 minutes after you got it. The 1919 code keeps its own
 * 2-minute rule.
 */

const TEMP_SECONDS = 300;
const TEMP_SOURCES = {
  lucky: '🍀 جزیره‌ی خوش‌شانسی', ai: '🤖 ساخته‌ی هوش مصنوعی', wheel: '🎡 گردونه', chest: '🎁 صندوق گنج', shake: '🥛 شیک پروتئین',
};

Object.assign(Game, {
  tempActive(kind) {
    const now = Date.now();
    let n = 0;
    for (const t of this.save.temp) if (t.kind === kind && t.until > now) n += t.n;
    return n;
  },

  /** Running level including temporary running levels. */
  runLv() { return this.save.runLevel + this.tempActive('run'); },

  /** Give levels that do not stay: they vanish TEMP_SECONDS after this moment. */
  addTempLevels(n, src, quiet, kind = 'str') {
    if (!(n > 0)) return;
    const now = Date.now();
    const T = this.save.temp;
    const from = this.lv();
    const last = T[T.length - 1];
    if (last && last.src === src && last.kind === kind && now - last.at < 15000) {
      last.n += n;
      last.at = now;
      last.until = now + TEMP_SECONDS * 1000;
    } else T.push({ n, src, kind, at: now, until: now + TEMP_SECONDS * 1000 });
    if (kind === 'str') {
      this.levelTemp = true;
      try { this.levelsGained(from, this.lv(), quiet, 'main'); } finally { this.levelTemp = false; }
    }
    else this.toast(`🏃 +${fa(n)} سطح دویدن موقت (۵ دقیقه)`, 'gold');
    if (!this.tempHintShown) {
      this.tempHintShown = true;
      setTimeout(() => this.toast('⏳ سطح‌هایی که با ورزش نگرفتی موقتی‌ان و ۵ دقیقه بعد از بین می‌رن. فقط زورِ ورزش موندگاره!', 'warn'), 1400);
    }
    this.refreshHud(true);
    this.persist();
  },

  /** XP from a non-exercise source piles up and turns into temporary levels. */
  addTempXp(xp, src, kind = 'str') {
    if (!(xp > 0)) return 0;
    const acc = this.tempXp || (this.tempXp = { str: 0, run: 0 });
    acc[kind] += xp;
    let n = 0;
    let L = kind === 'str' ? this.lv() : this.runLv();
    const need = kind === 'str' ? xpNeed : runNeed;
    while (acc[kind] >= need(L) && n < 5000) { acc[kind] -= need(L); L++; n++; }
    if (n) this.addTempLevels(n, src, false, kind);
    else this.floatText(`+${fa(Math.round(xp))} ⏳`, kind === 'run' ? 'fl-run' : '');
    return n;
  },

  /** Drop what has run out; called every frame from the HUD tick. */
  tickTemp() {
    const T = this.save.temp;
    if (!T.length) { $('tempBadge').hidden = true; return; }
    const now = Date.now();
    const gone = T.filter((t) => t.until <= now);
    if (gone.length) {
      this.save.temp = T.filter((t) => t.until > now);
      const str = gone.filter((t) => t.kind === 'str').reduce((a, t) => a + t.n, 0);
      const run = gone.filter((t) => t.kind === 'run').reduce((a, t) => a + t.n, 0);
      const srcs = [...new Set(gone.map((t) => TEMP_SOURCES[t.src] || t.src))].join('، ');
      Sfx.play('fail');
      this.toast(`⏳ ${str ? `${fa(str)} سطح زور` : ''}${str && run ? ' و ' : ''}${run ? `${fa(run)} سطح دویدن` : ''} موقت (${srcs}) از بین رفت. فقط زورِ ورزش می‌مونه!`, 'warn');
      setPlayerLevelLook(this.player, this.lv());
      this.labelPlayer();
      this.refreshPowers(true);
      this.refreshHud(true);
      this.refreshMoves();
      this.persist();
    }
    const live = this.save.temp;
    const b = $('tempBadge');
    if (!live.length) { b.hidden = true; return; }
    const str = this.tempActive('str');
    const run = this.tempActive('run');
    const next = Math.max(0, Math.ceil((Math.min(...live.map((t) => t.until)) - now) / 1000));
    b.hidden = false;
    b.textContent = `⏳ ${str ? `+${fa(str)} زور` : ''}${str && run ? ' ' : ''}${run ? `+${fa(run)} دو` : ''} موقت • ${fa(Math.floor(next / 60))}:${fa(String(next % 60).padStart(2, '0'))}`;
  },
});
