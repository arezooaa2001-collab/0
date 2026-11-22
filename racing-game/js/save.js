// ذخیره پیشرفت بازی: حافظه مرورگر + (در صورت وجود) پایگاه داده شخصی Claude
import { CARS, defaultCustom, defaultUpgrades } from './cars.js';
import { isTouch } from './utils.js';

const KEY = 'ghahreman-pist-save-v1';
export function defaultSave() {
  return {
    v: 1, t: 0, coins: 0, stage: 1, maxStage: 1, owned: ['c1'], selected: 'c1', viewAll: false,
    custom: { c1: defaultCustom(CARS[0]) }, upgrades: { c1: defaultUpgrades() },
    settings: { quality: isTouch() ? 'medium' : 'high', volume: 0.8, camera: 'chase', touch: 'auto', fps: false, units: 'kmh' },
    light: { time: 'auto', exposure: 1, sun: 1, ambient: 1, bloom: 0.5, shadows: true, fog: 1, clouds: 1 },
    stats: { races: 0, wins: 0, podiums: 0, best: {} }
  };
}

export class SaveStore {
  constructor() { this.data = defaultSave(); this.db = null; this.uid = null; this._timer = 0; }
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = this.merge(JSON.parse(raw));
    } catch (e) { /* حافظه در دسترس نیست */ }
    this.connectCloud();
    return this.data;
  }
  merge(d) {
    const def = defaultSave();
    const out = { ...def, ...d, settings: { ...def.settings, ...(d.settings || {}) }, light: { ...def.light, ...(d.light || {}) }, stats: { ...def.stats, ...(d.stats || {}) } };
    out.custom = { ...def.custom, ...(d.custom || {}) }; out.upgrades = { ...def.upgrades, ...(d.upgrades || {}) };
    if (!Array.isArray(out.owned) || !out.owned.length) out.owned = ['c1'];
    for (const id of out.owned) { const car = CARS.find((c) => c.id === id); if (car) { out.custom[id] = { ...defaultCustom(car), ...(out.custom[id] || {}) }; out.upgrades[id] = { ...defaultUpgrades(), ...(out.upgrades[id] || {}) }; } }
    if (!out.owned.includes(out.selected)) out.selected = out.owned[0];
    return out;
  }
  async connectCloud() {
    try {
      if (!window.claude?.use) return;
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const uid = await user.id(); if (!uid) return;
      this.db = db; this.uid = uid;
      const snap = await db.doc('data/users/' + uid + '/gamesave').get();
      if (snap.exists) {
        const remote = snap.data();
        if (remote && remote.json && (remote.t || 0) > (this.data.t || 0)) {
          this.data = this.merge(JSON.parse(remote.json));
          this.onRemote?.(this.data);
        }
      }
    } catch (e) { this.db = null; }
  }
  save() {
    this.data.t = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* نادیده */ }
    if (this.db && this.uid) {
      clearTimeout(this._timer);
      this._timer = setTimeout(() => {
        this.db.doc('data/users/' + this.uid + '/gamesave').set({ json: JSON.stringify(this.data), t: this.data.t }).catch(() => {});
      }, 1500);
    }
  }
  reset() { const s = this.data.settings, l = this.data.light; this.data = defaultSave(); this.data.settings = s; this.data.light = l; this.save(); }
}
