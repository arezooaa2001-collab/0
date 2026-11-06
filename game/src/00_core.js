'use strict';
/* =====================================================================
   تله‌زار (Trapland) — original troll-platformer
   ===================================================================== */
const T = 40, W = 1280, H = 720, STEP = 1 / 120;
const PH = { g: 2300, maxFall: 1150, run: 300, accG: 3400, accA: 2300, fric: 3800, jump: 780, cut: 260, coyote: 0.09, buf: 0.12, spring: 1400 };
const PW = 24, PHT = 30;
const faNum = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const circRect = (cx, cy, r, x, y, w, h) => { const nx = Math.max(x, Math.min(cx, x + w)), ny = Math.max(y, Math.min(cy, y + h)); const dx = cx - nx, dy = cy - ny; return dx * dx + dy * dy < r * r; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

/* difficulty presets: speed = whole-game time scale, trapT = trap delay scale, trapV = trap speed scale,
   sm = extra spike forgiveness (px), saw = saw hit radius factor, hints = show hidden traps faintly */
const DIFFS = [
  { name: 'آسون', col: '#6ff3c4', speed: 0.9, trapT: 1.35, trapV: 0.8, sm: 4, saw: 0.7, coyote: 0.14, buf: 0.16, hints: true },
  { name: 'معمولی', col: '#8fd3ff', speed: 1, trapT: 1, trapV: 1, sm: 0, saw: 0.8, coyote: 0.09, buf: 0.12 },
  { name: 'سخت', col: '#ffd36e', speed: 1.06, trapT: 0.8, trapV: 1.15, sm: -2, saw: 0.85, coyote: 0.07, buf: 0.1 },
  { name: 'خیلی سخت', col: '#ff8a4c', speed: 1.12, trapT: 0.65, trapV: 1.25, sm: -3, saw: 0.9, coyote: 0.05, buf: 0.08 },
  { name: 'دیوانه‌وار', col: '#ff3d71', speed: 1.2, trapT: 0.5, trapV: 1.35, sm: -4, saw: 0.95, coyote: 0.03, buf: 0.06 },
];

