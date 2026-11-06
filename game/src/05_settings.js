/* ============================ SETTINGS / GRAPHICS / COLORS ============================ */
/* colour helpers */
function hexRgb(h) { h = String(h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbHex(r, g, b) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function mixHex(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return rgbHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
function rgbaHex(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; }
function hexHsl(hex) {
  let [r, g, b] = hexRgb(hex).map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [h, s, l];
}
function hslHex(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  const f = (p, q, t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  if (!s) return rgbHex(l * 255, l * 255, l * 255);
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return rgbHex(f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255);
}

/* ---------- persistent config ---------- */
const CFG_KEY = 'telezar_cfg_v1';
const COLOR_KEYS = ['player', 'scarf', 'block', 'moss', 'hazard', 'saw', 'door', 'sky', 'road', 'obstacle', 'giant'];
const COLOR_DEF = { player: '#ffe2b8', scarf: '#ff7a45', block: '#2f2858', moss: '#4fd8a8', hazard: '#b5bae0', saw: '#b9bdd8', door: '#ffd36e', sky: '#3a1c5e', road: '#4f4580', obstacle: '#ffd36e', giant: '#6a5a8a' };
const COLOR_NAMES = { player: 'بدن شخصیت', scarf: 'شال شخصیت', block: 'سکوها و سنگ‌ها', moss: 'لبه‌ی درخشان', hazard: 'خارها', saw: 'اره‌ها', door: 'در و پرتال', sky: 'آسمان', road: 'جاده‌ی سه‌بعدی', obstacle: 'موانع سه‌بعدی', giant: 'غول‌ها' };
const PALETTES = {
  def: { n: 'پیش‌فرض', c: {} },
  fire: { n: 'آتشین', c: { player: '#ffd8b0', scarf: '#ff3d3d', block: '#4a1c1c', moss: '#ff8a3d', hazard: '#ffc09a', saw: '#ffcf8a', door: '#ffe14a', sky: '#5a1414', road: '#5a2a22', obstacle: '#ff5a2a', giant: '#6a2a1a' } },
  ocean: { n: 'اقیانوسی', c: { player: '#e6f8ff', scarf: '#2ad1ff', block: '#14385a', moss: '#3cf0e0', hazard: '#a8dcff', saw: '#9fe6ff', door: '#7af7ff', sky: '#0a3a6a', road: '#2a5a7a', obstacle: '#3cf0e0', giant: '#2a4a6a' } },
  forest: { n: 'جنگلی', c: { player: '#fff2c8', scarf: '#e8a43a', block: '#2c4628', moss: '#9be05a', hazard: '#dfe6bc', saw: '#c8d0a0', door: '#ffd36e', sky: '#1e4a3a', road: '#5a4a32', obstacle: '#e8a43a', giant: '#4a5a32' } },
  candy: { n: 'آب‌نباتی', c: { player: '#fff0fa', scarf: '#ff5dbb', block: '#6a3a8a', moss: '#ff9ae0', hazard: '#ffd0f0', saw: '#ffc0e8', door: '#9ef9ff', sky: '#7a3a9a', road: '#8a5aaa', obstacle: '#ff5dbb', giant: '#9a5a9a' } },
  gold: { n: 'طلایی', c: { player: '#fff6d8', scarf: '#ffb800', block: '#3a3020', moss: '#ffd36e', hazard: '#ffe8a8', saw: '#ffd890', door: '#fff0a0', sky: '#2a2010', road: '#5a4a2a', obstacle: '#ffb800', giant: '#5a4a30' } },
  neon: { n: 'نئونی', c: { player: '#e8fffb', scarf: '#ff2bd6', block: '#160c30', moss: '#00ffd5', hazard: '#7af7ff', saw: '#ff5df0', door: '#00ffd5', sky: '#12002a', road: '#1c0c40', obstacle: '#ff2bd6', giant: '#2a0a4a' } },
  mono: { n: 'سیاه‌وسفید', c: { player: '#ffffff', scarf: '#bdbdbd', block: '#2a2a2a', moss: '#cfcfcf', hazard: '#e0e0e0', saw: '#d0d0d0', door: '#ffffff', sky: '#161616', road: '#444444', obstacle: '#ffffff', giant: '#555555' } },
};
const CFG = {
  gfx: 'auto', mode: 'classic', mood: 'default', pal: 'def',
  mc: { br: 100, ct: 100, sat: 100, hue: 0, tint: '#ff8844', tintA: 0 },
  bars: false, grain: false, vig: 55, glow: 100, shake: 100,
  musicV: 70, sfxV: 90, vib: true, fps: false, timer: false, tsize: 100, topac: 100,
  colors: Object.fromEntries(COLOR_KEYS.map(k => [k, ''])),
};
function loadCfg() {
  try {
    const o = JSON.parse(localStorage.getItem(CFG_KEY)); if (!o) return;
    for (const k in CFG) if (k in o && k !== 'mc' && k !== 'colors') CFG[k] = o[k];
    Object.assign(CFG.mc, o.mc || {}); Object.assign(CFG.colors, o.colors || {});
  } catch (e) {}
}
function saveCfg() { try { localStorage.setItem(CFG_KEY, JSON.stringify(CFG)); } catch (e) {} }
loadCfg();
const colOf = k => CFG.colors[k] || COLOR_DEF[k];
const colSet = k => !!CFG.colors[k];

/* ---------- graphics presets ---------- */
// res = max render pixel ratio, scn = scenery density, fx = particle multiplier, sh: 0 none / 1 blob / 2 real shadow maps
const GFXS = {
  go:       { n: 'Go',        d: 'سبک‌ترین؛ برای گوشی‌های ضعیف',            res: .65, aa: 0, scn: .3,  fx: .35, motes: 0,  giants: 16, sh: 0, mir: 0, clouds: 0,   glow: 0,   filt: 0, dust: 0, sun: 0 },
  plus:     { n: 'Plus',      d: 'سبک با کمی جلوه',                         res: .85, aa: 0, scn: .5,  fx: .6,  motes: 10, giants: 26, sh: 1, mir: 1, clouds: .4,  glow: .6,  filt: 0, dust: 1, sun: 1 },
  pro:      { n: 'Pro',       d: 'تعادل کیفیت و سرعت',                      res: 1,   aa: 0, scn: .75, fx: .85, motes: 20, giants: 45, sh: 1, mir: 1, clouds: .7,  glow: .85, filt: 1, dust: 1, sun: 1 },
  max:      { n: 'Max',       d: 'کیفیت بالا، لبه‌های صاف',                   res: 1.3, aa: 1, scn: 1,   fx: 1,   motes: 28, giants: 45, sh: 1, mir: 1, clouds: 1,   glow: 1,   filt: 1, dust: 1, sun: 1 },
  ultra:    { n: 'Ultra',     d: 'جزئیات و جلوه‌های بیشتر',                   res: 1.7, aa: 1, scn: 1.3, fx: 1.3, motes: 42, giants: 45, sh: 1, mir: 1, clouds: 1.3, glow: 1.2, filt: 1, dust: 1, sun: 2, ss: 1.25 },
  maxultra: { n: 'Max Ultra', d: 'همه‌چیز روشن: سایه‌ی واقعی، بیشترین جزئیات', res: 2,   aa: 1, scn: 1.6, fx: 1.6, motes: 60, giants: 45, sh: 2, mir: 1, clouds: 1.6, glow: 1.4, filt: 1, dust: 1, sun: 2, ss: 1.4 },
};
const GFX_ORDER = ['auto', 'go', 'plus', 'pro', 'max', 'ultra', 'maxultra'];
function autoGfxKey() {
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ''));
  const sc = cores + mem * 1.2 + (mobile ? -3 : 5) - Math.max(0, (window.devicePixelRatio || 1) - 2) * 2;
  return sc < 6 ? 'go' : sc < 9 ? 'plus' : sc < 13 ? 'pro' : sc < 18 ? 'max' : 'ultra';
}
let GFXK = 'pro', GFX = GFXS.pro;
function resolveGfx() { GFXK = CFG.gfx === 'auto' ? autoGfxKey() : (GFXS[CFG.gfx] ? CFG.gfx : 'pro'); GFX = GFXS[GFXK]; }
resolveGfx();

/* ---------- adaptive performance: keeps every preset smooth ----------
   Watches real frame times. If frames get slow, render resolution steps down (and, as a last resort, effects).
   When the device has headroom again it steps back up. Hysteresis avoids flicker between levels. */
const Perf = {
  steps: [1, .9, .8, .7, .62, .55, .48, .42], si: 0, fxDrop: 0,
  win: 0, n: 0, slow: 0, fast: 0, hold: 2.5, fps: 60, fpsShow: 60, cb: null,
  get dyn() { return this.steps[this.si]; },
  get fxK() { return [1, .6, .3][this.fxDrop]; },
  reset(grace = 2) { this.win = 0; this.n = 0; this.slow = 0; this.fast = 0; this.hold = grace; },
  tick(raw, active) {
    if (raw > 0.5) { this.reset(1); return; }               // tab switch / hitch: ignore
    this.win += raw; this.n++;
    if (this.win < 0.6) return;
    const avg = this.win / this.n; this.fps = 1 / avg; this.fpsShow = Math.round(this.fps); this.win = 0; this.n = 0;
    if (!active || (this.hold -= 0.6) > 0) return;
    if (avg > 1 / 47) { this.fast = 0; if (++this.slow >= 2) { this.slow = 0; this.down(); } }
    else if (avg < 1 / 56) { this.slow = 0; if (++this.fast >= 4) { this.fast = 0; this.up(); } }
    else { this.slow = Math.max(0, this.slow - 1); this.fast = 0; }
  },
  down() {
    if (this.si < this.steps.length - 1) this.si++; else if (this.fxDrop < 2) this.fxDrop++; else return;
    this.hold = 2.2; if (this.cb) this.cb();
  },
  up() {
    if (this.fxDrop > 0) this.fxDrop--; else if (this.si > 0) this.si--; else return;
    this.hold = 2.5; if (this.cb) this.cb();
  },
};
// render pixel ratio for the current preset and dynamic scale
function targetPR(cap) {
  const dev = window.devicePixelRatio || 1;
  let pr = Math.min(GFX.res, dev);
  if (GFX.ss) pr = Math.max(pr, Math.min(GFX.ss, GFX.res));
  if (cap) pr = Math.min(pr, cap);
  return Math.max(0.4, pr * Perf.dyn);
}

/* ---------- light / mood presets (CSS colour grading over the game canvas) ---------- */
const MOODS = {
  default: { n: 'پیش‌فرض', f: '' },
  cinema: { n: 'سینمایی', f: 'contrast(1.12) saturate(1.12) brightness(.97)', tint: 'linear-gradient(180deg,rgba(0,110,150,.32),rgba(255,140,60,.24))', blend: 'soft-light', vig: 85, bars: true },
  neon: { n: 'نئون', f: 'saturate(1.6) contrast(1.15) brightness(1.05)', tint: 'linear-gradient(135deg,rgba(255,0,200,.22),rgba(0,220,255,.2))', blend: 'screen', vig: 50 },
  sunset: { n: 'غروب طلایی', f: 'saturate(1.25) contrast(1.05) brightness(1.02)', tint: 'linear-gradient(180deg,rgba(255,150,40,.34),rgba(255,60,110,.24))', blend: 'soft-light', vig: 60 },
  moon: { n: 'مهتاب', f: 'saturate(.8) brightness(.93) contrast(1.05)', tint: 'rgba(60,110,255,.32)', blend: 'soft-light', vig: 75 },
  dream: { n: 'رویایی', f: 'saturate(.95) brightness(1.1) contrast(.94)', tint: 'linear-gradient(180deg,rgba(255,170,230,.28),rgba(150,200,255,.26))', blend: 'screen', vig: 35 },
  retro: { n: 'فیلم قدیمی', f: 'sepia(.7) contrast(1.1) saturate(.9)', vig: 80, grain: true },
  noir: { n: 'سیاه‌وسفید', f: 'grayscale(1) contrast(1.3) brightness(.95)', vig: 85 },
  horror: { n: 'ترسناک', f: 'saturate(.5) contrast(1.25) brightness(.85)', tint: 'radial-gradient(ellipse at center,rgba(0,0,0,0) 30%,rgba(140,0,0,.5))', blend: 'multiply', vig: 95, flicker: true },
  cyber: { n: 'سایبرپانک', f: 'hue-rotate(-30deg) saturate(1.45) contrast(1.12)', tint: 'linear-gradient(180deg,rgba(0,255,220,.16),rgba(255,0,150,.2))', blend: 'screen', vig: 65 },
  custom: { n: 'سفارشی', f: '' },
};
function moodFilter() {
  if (CFG.mood === 'custom') { const m = CFG.mc; return `brightness(${m.br / 100}) contrast(${m.ct / 100}) saturate(${m.sat / 100}) hue-rotate(${m.hue}deg)`; }
  return (MOODS[CFG.mood] || MOODS.default).f;
}
function applyMood() {
  const m = MOODS[CFG.mood] || MOODS.default, $q = id => document.getElementById(id);
  const f = moodFilter();
  // CSS filters are costly on weak GPUs: Go/Plus skip them unless the player picked "custom" on purpose
  const useF = f && (GFX.filt || CFG.mood === 'custom') && Perf.fxDrop < 2;
  for (const id of ['c', 'c3']) { const el = $q(id); if (el) el.style.filter = useF ? f : 'none'; }
  const gr = $q('grade');
  if (CFG.mood === 'custom') { gr.style.background = CFG.mc.tintA > 0 ? rgbaHex(CFG.mc.tint, CFG.mc.tintA / 100) : 'none'; gr.style.mixBlendMode = 'soft-light'; }
  else { gr.style.background = m.tint || 'none'; gr.style.mixBlendMode = GFX.filt ? (m.blend || 'normal') : 'normal'; gr.style.opacity = GFX.filt ? 1 : .55; }
  gr.classList.toggle('flicker', !!m.flicker && CFG.mood !== 'custom');
  const vig = CFG.mood === 'default' || CFG.mood === 'custom' ? CFG.vig : Math.max(CFG.vig, m.vig || 0);
  document.documentElement.style.setProperty('--vig', (vig / 100 * 0.85).toFixed(2));
  $q('bars').classList.toggle('on', !!(CFG.bars || (m.bars && CFG.mood !== 'custom')));
  $q('grain').classList.toggle('on', !!(CFG.grain || (m.grain && CFG.mood !== 'custom')) && GFXK !== 'go');
}

/* ---------- derived palette for drawing (rebuilt when colours change) ---------- */
const PAL = {};
function buildPal() {
  const p = colOf('player'), s = colOf('scarf');
  PAL.bodyTop = mixHex(p, '#ffffff', .55); PAL.bodyBot = mixHex(p, '#ff9a50', colSet('player') ? .12 : .35);
  PAL.scarf = s; PAL.scarfHi = mixHex(s, '#ffffff', .4);
  PAL.moss = colOf('moss'); PAL.door = colOf('door'); PAL.hazard = colOf('hazard'); PAL.saw = colOf('saw'); PAL.block = colOf('block');
  // sky: hue/saturation/lightness ratio relative to the default dusk sky
  const [h0, s0, l0] = hexHsl(COLOR_DEF.sky), [h1, s1, l1] = hexHsl(colOf('sky'));
  PAL.skyDh = h1 - h0; PAL.skySr = clamp(s1 / Math.max(.01, s0), 0, 1.6); PAL.skyLr = clamp(l1 / Math.max(.01, l0), .4, 2.2);
  PAL.skyCol = h => { const [a, b, c] = hexHsl(h); return hslHex(a + PAL.skyDh, b * PAL.skySr, c * PAL.skyLr); };
  PAL.ver = (PAL.ver || 0) + 1;
}
buildPal();
