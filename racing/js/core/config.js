// Game rules, cars, upgrades and stages. Everything that defines "the game" lives here so
// balancing never requires touching simulation or rendering code.

import { hashString } from './utils.js';

export const FIELD_SIZE = 20; // cars per race (player + 19 AI)

/** Coins paid for finishing a stage, indexed by finishing rank (1-based). */
export const COIN_REWARDS = Object.freeze([100, 50, 10, 5, 2]);
export const coinsForRank = (rank) => (rank >= 1 && rank <= COIN_REWARDS.length ? COIN_REWARDS[rank - 1] : 0);

/** Championship-style points (امتیاز) per finishing rank. */
export const POINT_REWARDS = Object.freeze([25, 18, 15, 12, 10, 8, 6, 4, 2, 1]);
export const pointsForRank = (rank) => (rank >= 1 && rank <= POINT_REWARDS.length ? POINT_REWARDS[rank - 1] : 0);

/** A stage counts as passed (unlocks the next one) when the player reaches the podium. */
export const PASS_RANK = 3;
export const START_COINS = 100;

export const playerLevel = (points) => Math.floor(Math.sqrt(Math.max(0, points) / 15)) + 1;

// ---------------------------------------------------------------------------------------------
// Cars
// ---------------------------------------------------------------------------------------------

/**
 * Physics values are in SI units. `body` drives the procedural model in gfx/carModel.js.
 */
export const CARS = [
  {
    id: 'shahin', name: 'شاهین', nameEn: 'Shahin', tag: 'هاچبک اسپرت', price: 0,
    color: '#e8eef5',
    phys: {
      mass: 1120, powerKW: 115, torqueNm: 210, idleRpm: 900, redline: 7000,
      gears: [3.3, 2.1, 1.5, 1.18, 0.97, 0.82], finalDrive: 4.1, wheelRadius: 0.31, drive: 'FWD',
      grip: 1.0, brake: 1.0, steerLock: 0.62, cgHeight: 0.5, wheelbase: 2.5, frontWeight: 0.6,
      cdA: 0.7, clA: 0.05, nitroTime: 4, nitroBoost: 0.3, cylinders: 4,
    },
    body: {
      length: 4.05, width: 1.78, height: 1.42, wheelbase: 2.5, wheelRadius: 0.31, wheelWidth: 0.21,
      noseY: 0.62, cowlY: 0.86, deckY: 0.92, tailY: 0.9, floorY: 0.24,
      cabin: [0.3, 0.93], roofSpan: [0.47, 0.77], exp: 4.2, tumble: 0.2, nosePinch: 0.3, tailPinch: 0.12,
      spoiler: 'lip', scoop: false, fin: false, rim: 'spoke5', exhaust: 1,
    },
  },
  {
    id: 'toofan', name: 'توفان', nameEn: 'Toofan', tag: 'ماسل کلاسیک', price: 200,
    color: '#d7261e',
    phys: {
      mass: 1580, powerKW: 280, torqueNm: 540, idleRpm: 750, redline: 6400,
      gears: [2.9, 1.95, 1.42, 1.1, 0.88, 0.72], finalDrive: 3.6, wheelRadius: 0.34, drive: 'RWD',
      grip: 0.98, brake: 0.95, steerLock: 0.58, cgHeight: 0.55, wheelbase: 2.8, frontWeight: 0.55,
      cdA: 0.82, clA: 0.1, nitroTime: 5, nitroBoost: 0.35, cylinders: 8,
    },
    body: {
      length: 4.75, width: 1.95, height: 1.32, wheelbase: 2.8, wheelRadius: 0.34, wheelWidth: 0.27,
      noseY: 0.78, cowlY: 0.86, deckY: 0.9, tailY: 0.88, floorY: 0.26,
      cabin: [0.36, 0.78], roofSpan: [0.48, 0.68], exp: 6, tumble: 0.14, nosePinch: 0.08, tailPinch: 0.06,
      spoiler: 'duck', scoop: true, fin: false, rim: 'dish', exhaust: 2,
    },
  },
  {
    id: 'tondar', name: 'تندر', nameEn: 'Tondar', tag: 'رالی چهارچرخ', price: 450,
    color: '#1f6fe0',
    phys: {
      mass: 1320, powerKW: 235, torqueNm: 420, idleRpm: 900, redline: 7200,
      gears: [3.2, 2.1, 1.55, 1.2, 0.98, 0.8], finalDrive: 3.9, wheelRadius: 0.32, drive: 'AWD',
      grip: 1.08, brake: 1.05, steerLock: 0.64, cgHeight: 0.5, wheelbase: 2.6, frontWeight: 0.57,
      cdA: 0.78, clA: 0.2, nitroTime: 4.5, nitroBoost: 0.33, cylinders: 4,
    },
    body: {
      length: 4.4, width: 1.84, height: 1.44, wheelbase: 2.6, wheelRadius: 0.32, wheelWidth: 0.23,
      noseY: 0.7, cowlY: 0.88, deckY: 0.95, tailY: 0.93, floorY: 0.28,
      cabin: [0.32, 0.84], roofSpan: [0.47, 0.72], exp: 5, tumble: 0.18, nosePinch: 0.16, tailPinch: 0.08,
      spoiler: 'wing', scoop: true, fin: false, rim: 'rally', exhaust: 1,
    },
  },
  {
    id: 'shabdiz', name: 'شبدیز', nameEn: 'Shabdiz', tag: 'گرند تورر', price: 800,
    color: '#1d1f24',
    phys: {
      mass: 1450, powerKW: 340, torqueNm: 600, idleRpm: 800, redline: 7400,
      gears: [3.1, 2.05, 1.5, 1.18, 0.96, 0.8], finalDrive: 3.6, wheelRadius: 0.335, drive: 'RWD',
      grip: 1.12, brake: 1.15, steerLock: 0.6, cgHeight: 0.46, wheelbase: 2.7, frontWeight: 0.52,
      cdA: 0.68, clA: 0.35, nitroTime: 5, nitroBoost: 0.36, cylinders: 6,
    },
    body: {
      length: 4.6, width: 1.92, height: 1.3, wheelbase: 2.7, wheelRadius: 0.335, wheelWidth: 0.26,
      noseY: 0.64, cowlY: 0.82, deckY: 0.86, tailY: 0.84, floorY: 0.22,
      cabin: [0.4, 0.86], roofSpan: [0.53, 0.72], exp: 3.8, tumble: 0.22, nosePinch: 0.22, tailPinch: 0.14,
      spoiler: 'lip', scoop: false, fin: false, rim: 'multi', exhaust: 2,
    },
  },
  {
    id: 'azarakhsh', name: 'آذرخش', nameEn: 'Azarakhsh', tag: 'سوپراسپرت', price: 1300,
    color: '#ffb300',
    phys: {
      mass: 1380, powerKW: 430, torqueNm: 680, idleRpm: 1000, redline: 8200,
      gears: [3.0, 2.1, 1.6, 1.28, 1.05, 0.88], finalDrive: 3.5, wheelRadius: 0.34, drive: 'RWD',
      grip: 1.2, brake: 1.25, steerLock: 0.6, cgHeight: 0.42, wheelbase: 2.65, frontWeight: 0.43,
      cdA: 0.64, clA: 0.6, nitroTime: 5.5, nitroBoost: 0.38, cylinders: 10,
    },
    body: {
      length: 4.5, width: 1.98, height: 1.16, wheelbase: 2.65, wheelRadius: 0.34, wheelWidth: 0.28,
      noseY: 0.5, cowlY: 0.74, deckY: 0.88, tailY: 0.86, floorY: 0.18,
      cabin: [0.36, 0.72], roofSpan: [0.5, 0.62], exp: 3.4, tumble: 0.26, nosePinch: 0.3, tailPinch: 0.1,
      spoiler: 'wing', scoop: false, fin: false, rim: 'spoke5', exhaust: 2,
    },
  },
  {
    id: 'simorgh', name: 'سیمرغ', nameEn: 'Simorgh', tag: 'هایپرکار', price: 2000,
    color: '#18b38a',
    phys: {
      mass: 1320, powerKW: 500, torqueNm: 800, idleRpm: 1000, redline: 8500,
      gears: [3.0, 2.15, 1.65, 1.32, 1.08, 0.9, 0.78], finalDrive: 3.3, wheelRadius: 0.345, drive: 'AWD',
      grip: 1.28, brake: 1.35, steerLock: 0.6, cgHeight: 0.4, wheelbase: 2.7, frontWeight: 0.42,
      cdA: 0.6, clA: 0.9, nitroTime: 6, nitroBoost: 0.4, cylinders: 12,
    },
    body: {
      length: 4.65, width: 2.02, height: 1.12, wheelbase: 2.7, wheelRadius: 0.345, wheelWidth: 0.3,
      noseY: 0.46, cowlY: 0.72, deckY: 0.86, tailY: 0.84, floorY: 0.16,
      cabin: [0.34, 0.68], roofSpan: [0.47, 0.58], exp: 3.0, tumble: 0.3, nosePinch: 0.34, tailPinch: 0.06,
      spoiler: 'bigwing', scoop: false, fin: false, rim: 'turbine', exhaust: 4,
    },
  },
  {
    id: 'rakhsh', name: 'رخش', nameEn: 'Rakhsh', tag: 'نمونه‌ی مسابقه‌ای', price: 3000,
    color: '#8a3ffc',
    phys: {
      mass: 1050, powerKW: 560, torqueNm: 760, idleRpm: 1200, redline: 9000,
      gears: [3.1, 2.2, 1.7, 1.36, 1.12, 0.94, 0.8], finalDrive: 3.4, wheelRadius: 0.33, drive: 'RWD',
      grip: 1.38, brake: 1.5, steerLock: 0.62, cgHeight: 0.36, wheelbase: 2.75, frontWeight: 0.44,
      cdA: 0.62, clA: 1.4, nitroTime: 6.5, nitroBoost: 0.42, cylinders: 8,
    },
    body: {
      length: 4.8, width: 2.0, height: 1.05, wheelbase: 2.75, wheelRadius: 0.33, wheelWidth: 0.31,
      noseY: 0.38, cowlY: 0.66, deckY: 0.84, tailY: 0.86, floorY: 0.14,
      cabin: [0.4, 0.66], roofSpan: [0.5, 0.58], exp: 2.8, tumble: 0.34, nosePinch: 0.38, tailPinch: 0.04,
      spoiler: 'bigwing', scoop: true, fin: true, rim: 'turbine', exhaust: 2,
    },
  },
];

export const carById = (id) => CARS.find((c) => c.id === id) || CARS[0];
export const carIndex = (id) => Math.max(0, CARS.findIndex((c) => c.id === id));

export const PAINT_COLORS = [
  '#e8eef5', '#9aa3ad', '#1d1f24', '#d7261e', '#ff5a1f', '#ffb300', '#f5e04a', '#7bd23a',
  '#18b38a', '#1fb6d6', '#1f6fe0', '#2a3fb0', '#8a3ffc', '#d63fa8', '#7a2b2b', '#c9a46a',
];

// ---------------------------------------------------------------------------------------------
// Upgrades
// ---------------------------------------------------------------------------------------------

export const MAX_UPGRADE = 5;

export const UPGRADES = [
  { id: 'engine', name: 'موتور', icon: '⚙️', desc: 'قدرت و شتاب بیشتر (+۷٪ در هر سطح)' },
  { id: 'nitro', name: 'نیترو', icon: '🔥', desc: 'مخزن بزرگ‌تر و انفجار قوی‌تر' },
  { id: 'tires', name: 'لاستیک', icon: '🛞', desc: 'چسبندگی بیشتر در پیچ‌ها' },
  { id: 'brakes', name: 'ترمز', icon: '🛑', desc: 'ترمزگیری کوتاه‌تر و پایدارتر' },
  { id: 'handling', name: 'تعلیق و آیرودینامیک', icon: '🏁', desc: 'فرمان‌پذیری بهتر و نیروی رو به پایین' },
];

const UPGRADE_BASE_COST = [15, 35, 60, 90, 130];

/** Cost of buying `level` (1..5) of any upgrade for a car. */
export function upgradeCost(carId, level) {
  if (level < 1 || level > MAX_UPGRADE) return Infinity;
  const mult = 1 + 0.18 * carIndex(carId);
  return Math.round((UPGRADE_BASE_COST[level - 1] * mult) / 5) * 5;
}

export const emptyUpgrades = () => ({ engine: 0, nitro: 0, tires: 0, brakes: 0, handling: 0 });

/** Applies upgrade levels on top of a car's base physics values. Returns a new object. */
export function tunedPhysics(carDef, upgrades = emptyUpgrades()) {
  const u = { ...emptyUpgrades(), ...upgrades };
  const p = carDef.phys;
  return {
    ...p,
    powerKW: p.powerKW * (1 + 0.07 * u.engine),
    torqueNm: p.torqueNm * (1 + 0.06 * u.engine),
    nitroTime: p.nitroTime * (1 + 0.2 * u.nitro),
    nitroBoost: p.nitroBoost + 0.05 * u.nitro,
    grip: p.grip * (1 + 0.035 * u.tires),
    brake: p.brake * (1 + 0.1 * u.brakes),
    steerLock: p.steerLock * (1 + 0.02 * u.handling),
    steerRate: 1 + 0.08 * u.handling,
    clA: p.clA * (1 + 0.12 * u.handling) + 0.04 * u.handling,
    stability: 0.06 * u.handling,
  };
}

/** Single performance number used for UI comparisons (roughly 50 .. 120). */
export function performanceIndex(phys) {
  const pw = (phys.powerKW * (1 + phys.nitroBoost * 0.25)) / phys.mass;
  const grip = phys.grip * (1 + phys.clA * 0.04);
  return Math.round(100 * (0.5 * Math.sqrt(pw / 0.7) + 0.35 * (grip / 1.5) + 0.15 * (phys.brake / 1.6)));
}

/** Normalised 0..1 stats for the garage bars. */
export function carStats(phys) {
  const top = Math.cbrt((2 * phys.powerKW * 850) / (1.2 * phys.cdA));
  return {
    speed: Math.min(1, (top - 50) / 70),
    accel: Math.min(1, Math.sqrt(phys.powerKW / phys.mass / 0.75)),
    handling: Math.min(1, (phys.grip * (1 + phys.clA * 0.05) - 0.85) / 0.75),
    braking: Math.min(1, (phys.brake - 0.8) / 1.0),
    nitro: Math.min(1, (phys.nitroTime * phys.nitroBoost) / 5),
    topSpeedKmh: top * 3.6,
  };
}

// ---------------------------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------------------------

export const THEMES = {
  meadow: { id: 'meadow', name: 'چمنزار', icon: '🌳', roadGrip: 1.0, offGrip: 0.62, width: 14, hills: 6 },
  desert: { id: 'desert', name: 'کویر', icon: '🏜️', roadGrip: 0.97, offGrip: 0.55, width: 15, hills: 4 },
  coast: { id: 'coast', name: 'ساحل', icon: '🌴', roadGrip: 1.0, offGrip: 0.6, width: 14, hills: 3 },
  forest: { id: 'forest', name: 'جنگل غروب', icon: '🌲', roadGrip: 0.98, offGrip: 0.58, width: 13, hills: 9 },
  snow: { id: 'snow', name: 'کوهستان برفی', icon: '❄️', roadGrip: 0.86, offGrip: 0.5, width: 14, hills: 8 },
  city: { id: 'city', name: 'شهر در شب', icon: '🌃', roadGrip: 1.0, offGrip: 0.7, width: 16, hills: 0 },
};

const LEAGUES = [
  { theme: 'meadow', names: ['دشت سبز', 'تپه‌های شقایق', 'مسیر رودخانه', 'دره‌ی باد', 'جام چمنزار'], weather: ['clear', 'clear', 'clear', 'rain', 'clear'] },
  { theme: 'desert', names: ['شن‌های داغ', 'سراب', 'کاروانسرا', 'تپه‌های طلایی', 'جام کویر'], weather: ['clear', 'clear', 'clear', 'clear', 'clear'] },
  { theme: 'coast', names: ['ساحل فیروزه‌ای', 'جاده‌ی صخره‌ای', 'فانوس دریایی', 'نخلستان', 'جام ساحل'], weather: ['clear', 'clear', 'rain', 'clear', 'clear'] },
  { theme: 'forest', names: ['جنگل غروب', 'کاج‌های بلند', 'مه کوهستان', 'گذرگاه سنگی', 'جام جنگل'], weather: ['clear', 'clear', 'fog', 'clear', 'clear'] },
  { theme: 'snow', names: ['قله‌ی یخی', 'دره‌ی برف', 'دریاچه‌ی یخ‌زده', 'بوران', 'جام زمستان'], weather: ['snow', 'clear', 'snow', 'snow', 'snow'] },
  { theme: 'city', names: ['چراغ‌های شهر', 'بزرگراه نئون', 'مرکز شهر', 'باران شبانه', 'جام نهایی'], weather: ['clear', 'clear', 'clear', 'rain', 'rain'] },
];

export const STAGES = LEAGUES.flatMap((league, li) =>
  league.names.map((name, k) => {
    const index = li * 5 + k;
    const d = index / (LEAGUES.length * 5 - 1); // 0..1 difficulty
    const theme = THEMES[league.theme];
    return {
      index,
      league: li,
      theme: league.theme,
      name,
      weather: league.weather[k],
      seed: hashString(`shetab-stage-${index}`),
      laps: k < 2 ? 2 : 3,
      cup: k === 4,
      track: {
        radius: 230 + 14 * k + 18 * li,
        controlPoints: 9 + ((index * 7) % 6),
        roughness: 0.45 + 0.05 * k,
        width: theme.width,
        hills: theme.hills,
      },
      ai: {
        carMin: Math.max(0, li - 1),
        carMax: Math.min(CARS.length - 1, li + (k >= 3 ? 1 : 0)),
        upgMin: Math.min(MAX_UPGRADE, Math.max(0, k - 2 + (li >= 4 ? 1 : 0))),
        upgMax: Math.min(MAX_UPGRADE, k + (li >= 3 ? 1 : 0)),
        // fraction of the physical cornering limit the AI drives at (stage 1 ≈ 0.77, stage 30 ≈ 0.95)
        skill: Math.min(0.96, 0.765 + 0.17 * d + 0.006 * k),
      },
    };
  }),
);

export const STAGE_COUNT = STAGES.length;

export const DRIVER_NAMES = [
  'آرش', 'کاوه', 'بهرام', 'سهراب', 'نیما', 'سینا', 'پویا', 'کیان', 'داریوش', 'فرهاد',
  'شهاب', 'بابک', 'مانی', 'ساسان', 'آرمان', 'ترانه', 'نگار', 'مهسا', 'پریا', 'رها',
  'بردیا', 'یاسمن', 'سامان', 'آیدا', 'امید', 'هومن', 'شیدا', 'رامین',
];
