// Settings defaults + the 23 graphics presets.
import { clamp, lerp } from './util.js';

export const PRESET_NAMES = [
  'Plus', 'Pro', 'Ultra Max',
  'Ultra Max+', 'Ultra Max Pro', 'Ultra Max Extreme', 'Ultra Max Extreme+', 'Ultra Max Supreme', 'Ultra Max Supreme+',
  'Ultra Max Ultimate', 'Ultra Max Ultimate+', 'Ultra Max Hyper', 'Ultra Max Hyper+', 'Ultra Max Quantum', 'Ultra Max Quantum+',
  'Ultra Max Infinity', 'Ultra Max Infinity+', 'Ultra Max Omega', 'Ultra Max Omega+', 'Ultra Max Celestial', 'Ultra Max Celestial+',
  'Ultra Max Transcendent', 'Ultra Max Absolute',
];

// Every step above Ultra Max raises render scale, density, draw distance, particles,
// shadow reach and character detail monotonically; feature switches unlock along the way.
export function presetParams(i) {
  i = clamp(i | 0, 0, 22);
  const base = [
    { prCap: 1.0, scale: 0.72, shadow: 0, shadowDist: 0, veg: 0.32, grass: 0, particles: 0.35, draw: 480, bloom: 0, aa: 'none', ssao: 0, godrays: 0, motionBlur: 0, grade: 0, dofCine: 0, grain: 0, env: 0, water: 0, charQ: 0.15, mat: 0, aniso: 1, clouds: 0, stars: 500, weatherP: 700, animLod: 22, lights: 0, chunkLod: 140, detailTex: 128, skyOct: 2, trail: 16, objDist: 190, ringDist: 140, vegDist: 230 },
    { prCap: 1.5, scale: 0.9, shadow: 1024, shadowDist: 45, veg: 0.6, grass: 0.35, particles: 0.65, draw: 720, bloom: 0.5, aa: 'fxaa', ssao: 0, godrays: 0, motionBlur: 6, grade: 1, dofCine: 0, grain: 0, env: 0, water: 1, charQ: 0.5, mat: 1, aniso: 4, clouds: 14, stars: 1400, weatherP: 1600, animLod: 36, lights: 2, chunkLod: 220, detailTex: 256, skyOct: 3, trail: 28, objDist: 260, ringDist: 200, vegDist: 380 },
    { prCap: 2.0, scale: 1.0, shadow: 2048, shadowDist: 70, veg: 1.0, grass: 1.0, particles: 1.0, draw: 1000, bloom: 1, aa: 'smaa', ssao: 0, godrays: 0, motionBlur: 8, grade: 1, dofCine: 0, grain: 0, env: 1, water: 2, charQ: 0.8, mat: 2, aniso: 8, clouds: 30, stars: 2600, weatherP: 3000, animLod: 60, lights: 4, chunkLod: 320, detailTex: 512, skyOct: 4, trail: 40, objDist: 420, ringDist: 320, vegDist: 600 },
  ];
  if (i < 3) return Object.assign({ index: i, name: PRESET_NAMES[i], msaa: 0, envEvery: 24 }, base[i]);
  const u = (i - 2) / 20; // 0.05 .. 1
  const b = base[2];
  return {
    index: i, name: PRESET_NAMES[i],
    prCap: lerp(2.0, 3.0, u), scale: lerp(1.0, 1.5, u),
    shadow: i >= 15 ? 8192 : i >= 7 ? 4096 : 2048,
    shadowDist: lerp(75, 190, u),
    veg: lerp(1.08, 2.6, u), grass: lerp(1.1, 3.2, u), particles: lerp(1.05, 2.4, u),
    draw: lerp(1080, 2900, u),
    bloom: 1, aa: i >= 3 ? 'smaa' : b.aa, msaa: i >= 11 ? 8 : i >= 4 ? 4 : 0,
    ssao: i >= 7 ? 1 : 0, godrays: i >= 5 ? 1 : 0,
    motionBlur: Math.round(lerp(9, 18, u)), grade: 1, dofCine: i >= 11 ? 1 : 0, grain: i >= 13 ? 1 : 0,
    env: 1, envEvery: lerp(20, 3, u), water: 2,
    charQ: lerp(0.82, 1.0, u), mat: 2, aniso: 16,
    clouds: Math.round(lerp(34, 110, u)), stars: Math.round(lerp(2800, 7000, u)), weatherP: Math.round(lerp(3300, 12000, u)),
    animLod: lerp(65, 200, u), lights: Math.round(lerp(4, 12, u)), chunkLod: lerp(340, 900, u),
    detailTex: i >= 9 ? 1024 : 512, skyOct: i >= 9 ? 6 : 5, trail: Math.round(lerp(44, 90, u)),
    objDist: lerp(450, 1100, u), ringDist: lerp(340, 750, u), vegDist: lerp(640, 1700, u),
  };
}

export const DEFAULT_KEYS = {
  forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  jump: ['Space', ''], boost: ['ShiftLeft', 'ShiftRight'], spin: ['KeyC', 'ControlLeft'], attack: ['KeyE', 'Mouse0'],
  special: ['KeyQ', ''], interact: ['KeyF', 'Enter'], transform: ['KeyX', ''], camReset: ['KeyR', 'Mouse1'],
  camMode: ['KeyV', ''], map: ['KeyM', ''], switchChar: ['Tab', ''], photo: ['KeyP', ''], replay: ['KeyB', ''], pause: ['Escape', 'Backquote'],
};
export const ACTIONS = Object.keys(DEFAULT_KEYS);

export function isTouchDevice() {
  return (navigator.maxTouchPoints || 0) > 0 && matchMedia('(pointer: coarse)').matches;
}

export function defaultSettings() {
  const touch = typeof navigator !== 'undefined' && isTouchDevice();
  return {
    v: 2,
    lang: 'en',
    preset: touch ? 1 : 2,
    gfx: { renderScale: null, shadow: null, particles: null, anim: null, draw: null, aa: null, bloom: null, ssao: null, motionBlur: null, godrays: null, dof: null },
    fpsCounter: false, dynRes: true, adaptive: true, fpsTarget: 60, postIntensity: 1,
    audio: { master: 0.85, music: 0.55, sfx: 0.9, ambient: 0.6 },
    camera: { sens: 1, smooth: 0.5, dist: 1, fov: 64, shake: 1, autoAlign: true, speedFov: true, invertY: false, firstPerson: false },
    touch: { show: touch ? 'auto' : 'auto', joySize: 1, joyMode: 'floating', opacity: 0.6, btnSize: 1, sens: 1, dead: 0.12, haptics: true, smoothing: 0.35, layout: {} },
    keys: JSON.parse(JSON.stringify(DEFAULT_KEYS)),
    pad: { dead: 0.15, sens: 1 },
    access: { textScale: 1, colorblind: 'none', reduceMotion: false, highContrast: false, subtitles: true, autoRun: false, gameSpeed: 1, boostToggle: false },
    gameplay: { difficulty: 'normal', boss: 'normal', mission: 'normal', companion: true, weather: 'dynamic', time: 'dynamic', dayLength: 16, hints: true },
    save: { autosave: true, interval: 60, slot: 1 },
    dev: { collision: false, moveDebug: false, perfGraph: false },
  };
}

// Merge user values onto defaults (keeps new keys when the format grows)
export function mergeDeep(def, val) {
  if (!val || typeof val !== 'object' || Array.isArray(def)) return val === undefined ? def : val;
  const o = {};
  for (const k in def) o[k] = (val[k] !== undefined) ? (typeof def[k] === 'object' && def[k] !== null && !Array.isArray(def[k]) ? mergeDeep(def[k], val[k]) : val[k]) : def[k];
  for (const k in val) if (!(k in o)) o[k] = val[k];
  return o;
}
