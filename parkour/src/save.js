// ذخیره و بازیابی پیشرفت بازیکن (localStorage با محافظت از خطا)
import { MODES, MAX_LEVEL } from './config.js';

const KEY = 'ouj_parkour_save_v1';

const DEFAULTS = () => ({
  coins: 0,
  maxLevel: 1, // بالاترین مرحلهٔ باز
  level: 1, // مرحلهٔ انتخابی فعلی
  stats: {}, // level -> { rank, time }
  totalCoins: 0,
  totalFalls: 0,
  wins: 0,
  upgrades: { speed: 0, jump: 0, doubleJump: 0, magnet: 0 },
  owned: { palettes: ['theme'], lightings: ['theme'], outfits: ['default'], customLight: false, customColor: false },
  settings: {
    mode: 'forward',
    quality: 'auto',
    lighting: 'theme',
    palette: 'theme',
    outfit: 'default',
    customLight: { enabled: false, sun: 1, elev: 30, exposure: 1, bloom: 1, warmth: 0 },
    customColor: { enabled: false, base: '#ff7a3d', trim: '#3de1ff' },
    sfx: 0.8,
    music: 0.45,
    sens: 1,
    invertY: false,
    camDist: 1,
    showFps: false,
    haptics: true,
    playerName: 'تو',
    apiKey: '',
    model: 'claude-opus-5-5',
    botChat: true,
    reduceMotion: false,
  },
  seenTutorial: false,
});

function merge(base, over) {
  if (!over || typeof over !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (over[k] === undefined) continue;
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) base[k] = merge(base[k], over[k]);
    else base[k] = over[k];
  }
  // کلیدهای اضافه (مثل آمار مراحل)
  for (const k of Object.keys(over)) if (!(k in base)) base[k] = over[k];
  return base;
}

export class SaveData {
  constructor() {
    this.data = DEFAULTS();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = merge(DEFAULTS(), JSON.parse(raw));
    } catch (e) {
      /* حالت خصوصی مرورگر */
    }
    this.data.maxLevel = Math.min(MAX_LEVEL, Math.max(1, this.data.maxLevel | 0));
    this.data.level = Math.min(this.data.maxLevel, Math.max(1, this.data.level | 0));
    this._t = 0;
  }
  get s() {
    return this.data.settings;
  }
  save() {
    clearTimeout(this._t);
    this._t = setTimeout(() => this.flush(), 150);
  }
  flush() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      /* ignore */
    }
  }
  modeUnlocked(id) {
    const m = MODES.find((x) => x.id === id);
    return !!m && this.data.maxLevel > m.unlock;
  }
  addCoins(n) {
    this.data.coins += n;
    this.data.totalCoins += Math.max(0, n);
    this.save();
  }
  spend(n) {
    if (this.data.coins < n) return false;
    this.data.coins -= n;
    this.save();
    return true;
  }
  completeLevel(level, rank, time) {
    const st = this.data.stats[level] || {};
    if (!st.rank || rank < st.rank) st.rank = rank;
    if (!st.time || time < st.time) st.time = time;
    this.data.stats[level] = st;
    const before = this.data.maxLevel;
    if (level >= this.data.maxLevel && level < MAX_LEVEL) this.data.maxLevel = level + 1;
    if (rank === 1) this.data.wins++;
    this.save();
    // حالت‌هایی که تازه باز شدند
    return MODES.filter((m) => before <= m.unlock && this.data.maxLevel > m.unlock);
  }
  reset() {
    this.data = DEFAULTS();
    this.flush();
  }
}
