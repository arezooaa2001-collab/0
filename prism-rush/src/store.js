// Safe localStorage + settings + save slots (with backup / recovery)
import { defaultSettings, mergeDeep } from './config.js';

const P = 'prismrush.';
export function lsGet(k) { try { return localStorage.getItem(P + k); } catch { return null; } }
export function lsSet(k, v) { try { localStorage.setItem(P + k, v); return true; } catch { return false; } }
export function lsDel(k) { try { localStorage.removeItem(P + k); } catch { /* ignore */ } }
export function lsJSON(k, fallback) { const s = lsGet(k); if (!s) return fallback; try { return JSON.parse(s); } catch { return fallback; } }

export function loadSettings() {
  const raw = lsJSON('settings', null);
  const s = mergeDeep(defaultSettings(), raw || {});
  s.__first = !raw;
  return s;
}
export function saveSettings(s) { const c = Object.assign({}, s); delete c.__first; lsSet('settings', JSON.stringify(c)); }

export const START_CHARS = ['zara', 'pip'];
export function newSave() {
  const now = Date.now();
  const per = (v) => ({ zara: v, pip: v, rook: v, lumi: v, vex: v, ember: v });
  return {
    v: 1, created: now, updated: now, playTime: 0,
    char: 'zara', companion: 'pip',
    unlocked: START_CHARS.slice(), seenUnlock: {},
    skin: per('default'), ownedSkins: {},
    xp: per(0), level: per(1), sp: per(0), skills: { zara: {}, pip: {}, rook: {}, lumi: {}, vex: {}, ember: {} },
    wallet: 0, crystals: 0, keys: 0, tokens: 0,
    upgrades: {}, items: { shield: 1, elecShield: 0, fireShield: 0, waterShield: 0, slowmo: 0, lowgrav: 0, invinc: 0, ringx2: 0, xpx2: 0 },
    missions: {}, races: {}, bosses: {}, found: {}, regions: {}, maps: {}, achievements: {},
    stats: { distance: 0, rings: 0, enemies: 0, jumps: 0, boosts: 0, boostTime: 0, topSpeed: 0, deaths: 0, homing: 0, railDist: 0, loops: 0, missions: 0, racesWon: 0, bosses: 0, critters: 0, photos: 0, maxCombo: 0, spindashMax: 0, wallruns: 0, maxHomingChain: 0, playTime: 0 },
    daily: null, weekly: null, friendship: {},
    checkpoint: null, pos: null,
    flags: {},
  };
}
function validSave(d) { return d && typeof d === 'object' && d.v === 1 && d.stats && d.xp; }

export function loadSlot(n) {
  const raw = lsGet('slot' + n);
  if (!raw) return { data: null, recovered: false };
  try {
    const d = JSON.parse(raw);
    if (validSave(d)) return { data: mergeDeep(newSave(), d), recovered: false };
    throw new Error('invalid');
  } catch {
    const bak = lsJSON('slot' + n + '.bak', null);
    if (validSave(bak)) return { data: mergeDeep(newSave(), bak), recovered: true };
    return { data: null, recovered: false, corrupt: true };
  }
}
export function writeSlot(n, d) {
  d.updated = Date.now();
  const s = JSON.stringify(d);
  const prev = lsGet('slot' + n);
  if (prev) lsSet('slot' + n + '.bak', prev);
  const ok = lsSet('slot' + n, s);
  lsSet('lastSlot', String(n));
  return ok;
}
export function deleteSlot(n) { lsDel('slot' + n); lsDel('slot' + n + '.bak'); }
export function slotMeta(n) {
  const r = loadSlot(n); if (!r.data) return null;
  const d = r.data; return { char: d.char, playTime: d.playTime, updated: d.updated, wallet: d.wallet, completion: d.flags.completion || 0 };
}
export function lastSlot() { return parseInt(lsGet('lastSlot') || '0', 10) || 0; }
