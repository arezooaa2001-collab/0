// Persistent player profile. All reads are validated so a corrupted or outdated save can never
// crash the game; unknown fields are dropped and missing ones fall back to defaults.

import {
  CARS, STAGE_COUNT, START_COINS, MAX_UPGRADE, PAINT_COLORS, emptyUpgrades, carById,
  coinsForRank, pointsForRank, PASS_RANK, upgradeCost,
} from './config.js';
import { clamp } from './utils.js';

const KEY = 'shetab-racing-save-v1';

export const CONTROL_MODES = ['slide', 'wheel', 'buttons', 'tilt'];

export function defaultSettings(defaultGraphics = 2) {
  return {
    graphics: defaultGraphics,
    showFps: false,
    controlMode: 'slide',
    steerSensitivity: 1,
    tiltSensitivity: 1,
    autoAccel: false,
    pedalSide: 'right',
    buttonScale: 1,
    haptics: true,
    assists: 1, // 0 = pro, 1 = normal, 2 = full
    camera: 0,
    units: 'kmh',
    masterVolume: 0.8,
    sfxVolume: 0.9,
    engineVolume: 0.75,
    minimap: true,
  };
}

function defaultProfile(defaultGraphics) {
  return {
    version: 1,
    coins: START_COINS,
    points: 0,
    races: 0,
    wins: 0,
    owned: [CARS[0].id],
    selected: CARS[0].id,
    upgrades: {},
    paint: {},
    unlocked: 1, // number of unlocked stages
    stages: {}, // index -> { best: rank, time: seconds }
    settings: defaultSettings(defaultGraphics),
  };
}

const num = (v, def, lo, hi) => (Number.isFinite(Number(v)) ? clamp(Number(v), lo, hi) : def);
const isColor = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

function sanitize(raw, defaultGraphics) {
  const d = defaultProfile(defaultGraphics);
  if (!raw || typeof raw !== 'object') return d;
  const p = d;
  p.coins = Math.floor(num(raw.coins, d.coins, 0, 1e9));
  p.points = Math.floor(num(raw.points, 0, 0, 1e9));
  p.races = Math.floor(num(raw.races, 0, 0, 1e9));
  p.wins = Math.floor(num(raw.wins, 0, 0, 1e9));
  const ids = new Set(CARS.map((c) => c.id));
  if (Array.isArray(raw.owned)) p.owned = [...new Set([CARS[0].id, ...raw.owned.filter((id) => ids.has(id))])];
  p.selected = p.owned.includes(raw.selected) ? raw.selected : p.owned[0];
  if (raw.upgrades && typeof raw.upgrades === 'object') {
    for (const id of p.owned) {
      const src = raw.upgrades[id];
      if (!src) continue;
      const u = emptyUpgrades();
      for (const k of Object.keys(u)) u[k] = Math.floor(num(src[k], 0, 0, MAX_UPGRADE));
      p.upgrades[id] = u;
    }
  }
  if (raw.paint && typeof raw.paint === 'object') {
    for (const id of Object.keys(raw.paint)) if (ids.has(id) && isColor(raw.paint[id])) p.paint[id] = raw.paint[id];
  }
  p.unlocked = Math.floor(num(raw.unlocked, 1, 1, STAGE_COUNT));
  if (raw.stages && typeof raw.stages === 'object') {
    for (const [k, v] of Object.entries(raw.stages)) {
      const i = Number(k);
      if (!Number.isInteger(i) || i < 0 || i >= STAGE_COUNT || !v) continue;
      p.stages[i] = { best: Math.floor(num(v.best, 99, 1, 99)), time: num(v.time, 0, 0, 1e6) };
    }
  }
  const s = raw.settings || {};
  const ds = d.settings;
  p.settings = {
    graphics: Math.floor(num(s.graphics, ds.graphics, 0, 25)),
    showFps: !!s.showFps,
    controlMode: CONTROL_MODES.includes(s.controlMode) ? s.controlMode : ds.controlMode,
    steerSensitivity: num(s.steerSensitivity, 1, 0.4, 2),
    tiltSensitivity: num(s.tiltSensitivity, 1, 0.4, 2),
    autoAccel: !!s.autoAccel,
    pedalSide: s.pedalSide === 'left' ? 'left' : 'right',
    buttonScale: num(s.buttonScale, 1, 0.75, 1.35),
    haptics: s.haptics !== false,
    assists: Math.floor(num(s.assists, 1, 0, 2)),
    camera: Math.floor(num(s.camera, 0, 0, 3)),
    units: s.units === 'mph' ? 'mph' : 'kmh',
    masterVolume: num(s.masterVolume, ds.masterVolume, 0, 1),
    sfxVolume: num(s.sfxVolume, ds.sfxVolume, 0, 1),
    engineVolume: num(s.engineVolume, ds.engineVolume, 0, 1),
    minimap: s.minimap !== false,
  };
  return p;
}

export class Profile {
  constructor(defaultGraphics = 2) {
    this.defaultGraphics = defaultGraphics;
    this.data = sanitize(this.#read(), defaultGraphics);
    this.listeners = new Set();
  }

  #read() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage unavailable (private mode) – progress lives for this session only */
    }
    for (const fn of this.listeners) fn(this.data);
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get settings() {
    return this.data.settings;
  }

  setSetting(key, value) {
    this.data.settings = sanitize({ ...this.data, settings: { ...this.data.settings, [key]: value } }, this.defaultGraphics).settings;
    this.save();
  }

  upgradesOf(carId) {
    return { ...emptyUpgrades(), ...(this.data.upgrades[carId] || {}) };
  }

  paintOf(carId) {
    return this.data.paint[carId] || carById(carId).color;
  }

  owns(carId) {
    return this.data.owned.includes(carId);
  }

  buyCar(carId) {
    const car = carById(carId);
    if (this.owns(carId)) return { ok: false, reason: 'owned' };
    if (this.data.coins < car.price) return { ok: false, reason: 'coins' };
    this.data.coins -= car.price;
    this.data.owned.push(carId);
    this.data.selected = carId;
    this.save();
    return { ok: true };
  }

  selectCar(carId) {
    if (!this.owns(carId)) return false;
    this.data.selected = carId;
    this.save();
    return true;
  }

  buyUpgrade(carId, upgradeId) {
    if (!this.owns(carId)) return { ok: false, reason: 'notOwned' };
    const u = this.upgradesOf(carId);
    if (!(upgradeId in u)) return { ok: false, reason: 'invalid' };
    if (u[upgradeId] >= MAX_UPGRADE) return { ok: false, reason: 'max' };
    const cost = upgradeCost(carId, u[upgradeId] + 1);
    if (this.data.coins < cost) return { ok: false, reason: 'coins', cost };
    this.data.coins -= cost;
    u[upgradeId] += 1;
    this.data.upgrades[carId] = u;
    this.save();
    return { ok: true, cost, level: u[upgradeId] };
  }

  setPaint(carId, color) {
    if (!isColor(color) || !this.owns(carId)) return false;
    this.data.paint[carId] = color;
    this.save();
    return true;
  }

  /**
   * Records a finished race and pays out. Returns what was awarded so the results screen can
   * show it. Rewards follow config.COIN_REWARDS exactly: 1st 100, 2nd 50, 3rd 10, 4th 5, 5th 2.
   */
  recordRace(stageIndex, rank, time) {
    const coins = coinsForRank(rank);
    const points = pointsForRank(rank);
    const d = this.data;
    d.coins += coins;
    d.points += points;
    d.races += 1;
    if (rank === 1) d.wins += 1;
    const prev = d.stages[stageIndex];
    const isBestRank = !prev || rank < prev.best;
    const isBestTime = !prev || !prev.time || time < prev.time;
    d.stages[stageIndex] = {
      best: prev ? Math.min(prev.best, rank) : rank,
      time: isBestTime ? time : prev.time,
    };
    const passed = rank <= PASS_RANK;
    let unlockedNew = false;
    if (passed && stageIndex + 1 < STAGE_COUNT && d.unlocked < stageIndex + 2) {
      d.unlocked = stageIndex + 2;
      unlockedNew = true;
    }
    this.save();
    return { coins, points, passed, unlockedNew, isBestRank };
  }

  reset() {
    const settings = this.data.settings;
    this.data = defaultProfile(this.defaultGraphics);
    this.data.settings = settings;
    this.save();
  }
}

export { PAINT_COLORS };
