// Graphics presets. Six named presets up to "Ultra Max" followed by 20 presets beyond it.
// Every step raises rendering detail AND simulation realism (physics rate, tyre model,
// body dynamics, damage...), exactly as requested: higher graphics => more realistic game.

import { lerp, clamp } from '../core/utils.js';

const NAMED = [
  { fa: 'کم', en: 'Low' },
  { fa: 'متوسط', en: 'Medium' },
  { fa: 'خوب', en: 'Good' },
  { fa: 'خیلی خوب', en: 'Very Good' },
  { fa: 'فوق‌العاده', en: 'Excellent' },
  { fa: 'اولترا مکس', en: 'Ultra Max' },
];

const BEYOND = [
  ['اولترا مکس پلاس', 'Ultra Max+'], ['هایپر', 'Hyper'], ['هایپر پلاس', 'Hyper+'],
  ['اکستریم', 'Extreme'], ['اکستریم پلاس', 'Extreme+'], ['سینمایی', 'Cinematic'],
  ['سینمایی پلاس', 'Cinematic+'], ['فوتورئال', 'Photoreal'], ['فوتورئال پلاس', 'Photoreal+'],
  ['تایتان', 'Titan'], ['تایتان پلاس', 'Titan+'], ['کوانتوم', 'Quantum'], ['کوانتوم پلاس', 'Quantum+'],
  ['نوا', 'Nova'], ['نوا پلاس', 'Nova+'], ['افسانه', 'Legend'], ['افسانه پلاس', 'Legend+'],
  ['بی‌نهایت', 'Infinity'], ['اُمگا', 'Omega'], ['واقعیت مطلق', 'Reality X'],
];

export const ULTRA_MAX_INDEX = 5;
export const TIER_COUNT = NAMED.length + BEYOND.length; // 26

// Explicit values for the six named presets: [low, medium, good, veryGood, excellent, ultraMax]
const T = {
  dprCap: [1, 1, 1.25, 1.5, 2, 2.5],
  scale: [0.6, 0.8, 1, 1, 1, 1],
  maxPixels: [0.9e6, 1.6e6, 2.6e6, 4e6, 6e6, 8.3e6],
  msaa: [0, 0, 4, 4, 4, 8],
  fxaa: [false, true, false, false, false, false],
  shadowMap: [0, 1024, 1024, 2048, 2048, 4096],
  shadowRange: [0, 45, 60, 80, 100, 120],
  shadowType: ['none', 'pcf', 'pcf', 'soft', 'soft', 'soft'],
  treeShadows: [false, false, false, true, true, true],
  viewDistance: [480, 650, 900, 1200, 1500, 2000],
  trees: [0.28, 0.45, 0.65, 0.85, 1, 1.25],
  props: [0.3, 0.5, 0.7, 0.85, 1, 1.2],
  grass: [0, 0, 0, 14000, 30000, 50000],
  crowd: [0, 120, 260, 500, 800, 1200],
  texSize: [512, 1024, 1024, 2048, 2048, 2048],
  normalMaps: [false, false, true, true, true, true],
  anisotropy: [1, 2, 4, 8, 16, 16],
  material: [0, 1, 2, 2, 2, 2], // 0 lambert, 1 standard, 2 physical (clear-coat paint)
  carSections: [14, 22, 30, 40, 48, 56],
  carRing: [12, 16, 22, 28, 32, 36],
  wheelSegments: [12, 16, 24, 32, 40, 48],
  interior: [false, false, false, true, true, true],
  brakeDiscs: [false, false, true, true, true, true],
  envMap: [0, 64, 128, 256, 256, 256],
  dynamicReflections: [0, 0, 0, 0, 128, 256],
  reflectionInterval: [0, 0, 0, 0, 6, 3],
  bloom: [0, 0, 0.35, 0.45, 0.5, 0.55],
  motionBlur: [0, 0, 0, 0, 8, 12],
  grade: [false, false, true, true, true, true],
  grain: [0, 0, 0, 0, 0.02, 0.03],
  aberration: [0, 0, 0, 0, 0, 0.0012],
  ao: [false, false, false, false, false, false],
  particles: [300, 700, 1400, 2500, 4000, 6000],
  skids: [300, 700, 1300, 2200, 3200, 4500],
  weather: [700, 1800, 3500, 6000, 9000, 13000],
  clouds: [0, 2, 3, 4, 5, 6],
  stars: [300, 800, 1500, 2500, 3500, 5000],
  terrain: [64, 96, 128, 160, 200, 256],
  nightLights: [0, 2, 4, 6, 8, 10],
  headlightShadows: [false, false, false, false, false, true],
  wind: [false, false, false, true, true, true],
  physicsHz: [120, 120, 180, 240, 300, 360],
  bodyMotion: [false, true, true, true, true, true],
  suspension: [false, false, true, true, true, true],
  cameraShake: [false, false, true, true, true, true],
  drafting: [false, true, true, true, true, true],
  loadSensitivity: [false, false, false, true, true, true],
  shiftTime: [0, 0, 0, 0.12, 0.14, 0.15],
  roadBumps: [false, false, false, false, true, true],
  damage: [false, false, false, false, false, true],
  tireTemperature: [false, false, false, false, false, false],
  dirtyAir: [false, false, false, false, false, false],
  aiVoices: [1, 1, 1, 2, 2, 3],
};

// Values reached by the very last preset (Reality X); presets 6..25 are interpolated towards it.
const MAX = {
  dprCap: 3, scale: 1.6, maxPixels: 16.6e6, msaa: 8, shadowMap: 8192, shadowRange: 260,
  viewDistance: 4200, trees: 3.4, props: 3, grass: 320000, crowd: 5000, texSize: 4096,
  anisotropy: 16, carSections: 110, carRing: 64, wheelSegments: 96, envMap: 1024,
  dynamicReflections: 512, reflectionInterval: 1, bloom: 0.65, motionBlur: 32, grain: 0.035,
  aberration: 0.002, particles: 30000, skids: 16000, weather: 60000, clouds: 8, stars: 12000,
  terrain: 512, nightLights: 20, physicsHz: 1200, aiVoices: 5,
};

const pow2Floor = (v) => 2 ** Math.floor(Math.log2(Math.max(1, v)));

function build(i) {
  const named = i <= ULTRA_MAX_INDEX;
  const t = named ? 0 : (i - ULTRA_MAX_INDEX) / BEYOND.length; // 0.05 .. 1
  const pick = (key) => {
    if (named) return T[key][i];
    const base = T[key][ULTRA_MAX_INDEX];
    if (typeof base === 'boolean') return true;
    if (typeof base === 'string') return base;
    if (!(key in MAX)) return base;
    return lerp(base, MAX[key], t);
  };
  const intPick = (key) => Math.round(pick(key));
  const name = named ? NAMED[i] : { fa: BEYOND[i - NAMED.length][0], en: BEYOND[i - NAMED.length][1] };
  const tier = {
    index: i,
    name: name.fa,
    nameEn: name.en,
    badge: named ? '' : `UM+${i - ULTRA_MAX_INDEX}`,
    beyond: !named,
    dprCap: pick('dprCap'),
    scale: pick('scale'),
    maxPixels: pick('maxPixels'),
    msaa: named ? T.msaa[i] : 8,
    fxaa: named ? T.fxaa[i] : false,
    shadowType: pick('shadowType'),
    shadowMap: named ? T.shadowMap[i] : pow2Floor(lerp(4096, 8192 * 1.01, t)),
    shadowRange: pick('shadowRange'),
    treeShadows: pick('treeShadows'),
    viewDistance: pick('viewDistance'),
    trees: pick('trees'),
    props: pick('props'),
    grass: intPick('grass'),
    crowd: intPick('crowd'),
    texSize: named ? T.texSize[i] : t >= 0.3 ? 4096 : 2048,
    normalMaps: pick('normalMaps'),
    anisotropy: intPick('anisotropy'),
    material: pick('material'),
    carSections: intPick('carSections'),
    carRing: intPick('carRing'),
    wheelSegments: intPick('wheelSegments'),
    interior: pick('interior'),
    brakeDiscs: pick('brakeDiscs'),
    envMap: named ? T.envMap[i] : pow2Floor(lerp(256, 1024 * 1.01, t)),
    dynamicReflections: named ? T.dynamicReflections[i] : pow2Floor(lerp(256, 512 * 1.01, t)),
    reflectionInterval: named ? T.reflectionInterval[i] : t < 0.5 ? 3 : 2,
    bloom: pick('bloom'),
    motionBlur: intPick('motionBlur'),
    grade: pick('grade'),
    grain: pick('grain'),
    aberration: pick('aberration'),
    ao: named ? false : t >= 0.2,
    aoSamples: named ? 0 : Math.round(lerp(8, 24, t)),
    particles: intPick('particles'),
    skids: intPick('skids'),
    weather: intPick('weather'),
    clouds: intPick('clouds'),
    stars: intPick('stars'),
    terrain: intPick('terrain'),
    nightLights: intPick('nightLights'),
    headlightShadows: pick('headlightShadows'),
    wind: pick('wind'),
    physicsHz: Math.round(pick('physicsHz') / 60) * 60,
    realism: {
      bodyMotion: pick('bodyMotion'),
      suspension: pick('suspension'),
      cameraShake: pick('cameraShake'),
      drafting: pick('drafting'),
      loadSensitivity: pick('loadSensitivity'),
      shiftTime: pick('shiftTime'),
      roadBumps: pick('roadBumps'),
      damage: pick('damage'),
      tireTemperature: named ? false : t >= 0.25,
      dirtyAir: named ? false : t >= 0.45,
      aiVoices: intPick('aiVoices'),
    },
  };
  tier.description = describe(tier);
  return tier;
}

const fa = (v) => String(v).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);

function describe(t) {
  const items = [];
  items.push(`رزولوشن ${fa(Math.round(t.scale * 100))}٪ تا ${fa(t.dprCap)}x`);
  items.push(t.shadowMap ? `سایه ${fa(t.shadowMap)}` : 'سایه ساده');
  if (t.msaa) items.push(`ضدلبه ${fa(t.msaa)}x`);
  else if (t.fxaa) items.push('ضدلبه FXAA');
  if (t.bloom) items.push('درخشش نور');
  if (t.dynamicReflections) items.push('بازتاب زنده');
  if (t.motionBlur) items.push('محو حرکتی');
  if (t.ao) items.push('سایه‌روشن محیطی AO');
  if (t.grass) items.push(`${fa(Math.round(t.grass / 1000))} هزار علف`);
  items.push(`فیزیک ${fa(t.physicsHz)} هرتز`);
  if (t.realism.loadSensitivity) items.push('مدل لاستیک پیشرفته');
  if (t.realism.damage) items.push('آسیب بدنه');
  if (t.realism.tireTemperature) items.push('دمای لاستیک');
  if (t.realism.dirtyAir) items.push('آیرودینامیک واقعی');
  return items.join('، ');
}

export const TIERS = Array.from({ length: TIER_COUNT }, (_, i) => build(i));

export const getTier = (index) => TIERS[clamp(Math.round(Number(index) || 0), 0, TIER_COUNT - 1)];

/** Conservative first-run default based on the device. */
export function detectDefaultTier() {
  if (typeof navigator === 'undefined') return 2;
  const touch = (navigator.maxTouchPoints || 0) > 0;
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (touch) return mem >= 6 && cores >= 8 ? 3 : mem >= 3 ? 2 : 1;
  return cores >= 8 ? 4 : 3;
}
