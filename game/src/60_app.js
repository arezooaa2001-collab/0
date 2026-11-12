/* ============================ INPUT ============================ */
const keys = {};
const touch = { left: false, right: false, jump: false };
addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code) && app.state === 'play') e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true; Sound.init();
  if (app.state === 'play') { if (e.code === 'KeyR') app.restart(); if (e.code === 'Escape' || e.code === 'KeyP') app.pause(); }
  else if (app.state === 'pause' && (e.code === 'Escape' || e.code === 'KeyP') && app.screen === 'sPause') app.resume();
  else if (e.code === 'Escape' && app.screen && app.screen !== 'sTitle' && app.screen !== 'sPause') app.goBack();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; ptrs.clear(); refreshTouch(); if (app.state === 'play') app.pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && app.state === 'play') app.pause(); Sound.visible(!document.hidden); });
// every kind of user gesture may unlock or resume the sound (browsers differ in which ones count)
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, () => Sound.init(), { passive: true, capture: true });
function readInput() {
  if (app.state === 'play' && document.body.classList.contains('mMirror')) return mutInput(readRaw());
  return readRaw();
}
function readRaw() {
  return { left: !!(keys.ArrowLeft || keys.KeyA || touch.left), right: !!(keys.ArrowRight || keys.KeyD || touch.right), jump: !!(keys.Space || keys.ArrowUp || keys.KeyW || touch.jump) };
}
const tLayer = document.getElementById('touch'), tL = document.getElementById('tL'), tR = document.getElementById('tR'), tJ = document.getElementById('tJ');
const ptrs = new Map();
function moveRole(x) { const a = tL.getBoundingClientRect(), b = tR.getBoundingClientRect(); return x < (a.right + b.left) / 2 ? 'left' : 'right'; }
function refreshTouch() {
  const v = [...ptrs.values()];
  touch.left = v.includes('left'); touch.right = v.includes('right'); touch.jump = v.includes('jump');
  tL.classList.toggle('p', touch.left); tR.classList.toggle('p', touch.right); tJ.classList.toggle('p', touch.jump);
}
tLayer.addEventListener('pointerdown', e => {
  e.preventDefault(); Sound.init();
  try { tLayer.setPointerCapture(e.pointerId); } catch (_) {}
  const role = e.clientX < innerWidth * 0.5 ? moveRole(e.clientX) : 'jump';
  if ((role === 'left' || role === 'right') && CFG.vib && navigator.vibrate) navigator.vibrate(6);
  ptrs.set(e.pointerId, role); refreshTouch();
});
tLayer.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  const r = ptrs.get(e.pointerId);
  if (r !== 'jump') { const nr = moveRole(e.clientX); if (nr !== r) { ptrs.set(e.pointerId, nr); refreshTouch(); } }
});
const endPtr = e => { if (ptrs.delete(e.pointerId)) refreshTouch(); };
tLayer.addEventListener('pointerup', endPtr); tLayer.addEventListener('pointercancel', endPtr); tLayer.addEventListener('lostpointercapture', endPtr);
tLayer.addEventListener('contextmenu', e => e.preventDefault());
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;

/* ============================ APP / UI ============================ */
const $ = id => document.getElementById(id);
const TAUNTS = ['هه! 😈', 'انتظارشو نداشتی، نه؟', 'یه بار دیگه!', 'نزدیک بود!', 'اعتماد نکن!', 'خخخ 🤭', 'تله‌ها همه‌جا هستن', 'این که آسون بود...', 'دوباره امتحان کن', 'آخ! 💥'];
const SAVE_KEY = 'telezar_v2';
const DDESC = ['تله‌های پنهان کم‌رنگ دیده می‌شن و همه‌چیز آروم‌تره', 'همون‌طور که باید باشه', 'تله‌ها سریع‌ترن و تله‌های اضافه داری',
  'بازی تندتره، خارها تیزترن و تله‌های بیشتر', 'سرعت بالا، بدون بخشش، همه تله‌ها فعال. موفق باشی!'];
const ST = { deaths: 0, gems: 0, time: 0, wins: 0, ach: {}, secret: false, realm: 0, spent: 0, owned: {}, wear: {} };
function loadSave() {
  try { const v = JSON.parse(localStorage.getItem(SAVE_KEY)); if (v) return v;
    const old = JSON.parse(localStorage.getItem('telezar_v1')); if (old) return { diff: 1, sound: old.sound, prog: { 1: { unlocked: old.unlocked || 1, completed: old.completed || 0 } } };
  } catch (e) {}
  return {};
}
function writeSave() {
  try {
    Object.assign(progOf(app.diff), { unlocked: app.unlocked, completed: app.completed });
    localStorage.setItem(SAVE_KEY, JSON.stringify({ diff: app.diff, prog: app.prog, sound: Sound.on, stats: ST }));
  } catch (e) {}
}
const progOf = d => app.prog[d] || (app.prog[d] = {});
// checkpoint reached in an unfinished long level (0 = start); ignored if the level's checkpoint count changed
const savedCk = (d, i) => { const r = (progOf(d).ck || {})[i] | 0, n = LEVELS[i] ? LEVELS[i].rooms || (LEVELS[i].secs ? LEVELS[i].secs.length : 1) : 1; return r > 0 && r < n ? r : 0; };
// level colours (biomes); rebuilding textures and background only when the scheme changes
function setBiome(key) { const b = key && BIOMES[key] || null; Sound.setMusic(b && b.mus || 'dusk'); if (b === BIOME) return; BIOME = b; buildPal(); buildTextures(ctx); buildBackground(); }
const parTime = def => Math.round((def.nObs || 10) * 2.6 + 25);
const fmtT = s => { s = Math.max(0, s); const m = Math.floor(s / 60), r = s - m * 60; return m ? `${faNum(m)}:${faNum(r.toFixed(0).padStart(2, '0'))}` : faNum(r.toFixed(1)); };

/* ---------- achievements ---------- */
const ACH = [
  ['first', '🥇', 'اولین برد', 'اولین مرحله رو تموم کن'],
  ['ten', '🔟', 'ده‌تایی', '۱۰ مرحله رو تموم کن'],
  ['twenty', '🧭', 'نیمه‌ی راه', '۲۰ مرحله رو تموم کن'],
  ['all', '👑', 'فاتح تله‌زار', 'همه‌ی ۴۲ مرحله رو تموم کن'],
  ['clean', '✨', 'بی‌خطا', 'یه مرحله رو بدون حتی یک مرگ تموم کن'],
  ['run3d', '🏃', 'فرار بزرگ', 'توی یه مرحله‌ی فرار از غول، به دروازه برس'],
  ['horde', '👹', 'ارتش غول‌ها', 'مرحله‌ی ۴۰ با ۴۵ غول رو ببر'],
  ['portal', '🌀', 'کاشف', 'پرتال مخفی مرحله‌ی ۳۷ رو پیدا کن'],
  ['realm', '🔮', 'ارباب ابعاد', 'ابعاد پنهان رو کامل کن'],
  ['gems100', '💎', 'جواهرباز', '۱۰۰ جواهر جمع کن'],
  ['shield', '🛡️', 'زره‌پوش', 'با سپر از یه مانع رد شو'],
  ['d50', '💀', 'سرسخت', '۵۰ بار بمیر و ادامه بده'],
  ['d500', '☠️', 'خستگی‌ناپذیر', '۵۰۰ بار بمیر'],
  ['insane', '🔥', 'دیوانه', 'یه مرحله رو روی دیوانه‌وار ببر'],
  ['speed', '⚡', 'برق‌آسا', 'یه مرحله‌ی سکوبازی رو زیر زمان طلایی تموم کن (حدود ۲٫۶ ثانیه برای هر مانع)'],
  ['stars', '⭐', 'ستاره‌باران', '۶۰ ستاره جمع کن (در یک سطح سختی)'],
  ['modes', '🎮', 'همه‌کاره', 'توی هر چهار حالت بازی یه مرحله رو ببر'],
  ['allgems', '💠', 'جواهر کامل', 'همه‌ی جواهرهای یک مرحله‌ی سکوبازی رو جمع کن و ببر'],
  ['cave', '⛏️', 'معدنچی', 'یه مرحله با راه زیرزمینی رو تموم کن'],
  ['storm', '⛈️', 'طوفان‌سوار', 'وسط طوفان یه مرحله رو ببر'],
  ['endless', '♾️', 'ماراتن', 'توی حالت بی‌پایان ۵۰۰ متر برو'],
  ['boss', '🗿', 'غول‌کُش', 'یکی از غول‌های آخر مرحله رو شکست بده'],
  ['bossAll', '👑', 'پادشاه غول‌ها', 'هر چهار غول (مرحله‌های ۱۳، ۲۳، ۳۳ و ۳۹) رو شکست بده'],
  ['champ', '🥇', 'قهرمان مسابقه', 'توی یه مرحله‌ی مسابقه، از همه‌ی رقیب‌ها زودتر برس'],
  ['summit', '🏔️', 'فاتح قله', 'مرحله‌ی ۴۲ با ۴۵ اتاق رو ببر'],
  ['lvl5', '⭐', 'باتجربه', 'به سطح ۵ برس'],
  ['lvl10', '🌟', 'استاد تله‌زار', 'به سطح ۱۰ برس'],
  ['maker', '🛠️', 'سازنده', 'یه مرحله بساز و خودت ردش کن'],
  ['robot', '🤖', 'دستیار آهنی', 'بذار ربات یکی از مرحله‌هات رو رد کنه'],
  ['share', '📤', 'تله‌گذار', 'کد یکی از مرحله‌هات رو برای دوستات بفرست'],
  ['import', '📥', 'مهمون', 'مرحله‌ی یه نفر دیگه رو بازی کن'],
  ['friend', '🤝', 'رفیق نیمه‌راه نیست', 'مرحله‌ی ساخت یه نفر دیگه رو ببر'],
  ['cards', '📖', 'دانشنامه‌ی کامل', 'با همه‌ی ۱۶ نوع تله بمیر (همه‌ی کارت‌ها)'],
  ['rush', '🏟️', 'قهرمان میدان', 'توی «نبرد غول‌ها» هر چهار غول رو پشت سر هم شکست بده'],
  ['rushInsane', '💀', 'غول‌کش دیوانه', 'نبرد غول‌ها رو روی سختی دیوانه‌وار ببر'],
  ['pow25', '🎁', 'شکارچی قدرت', '۲۵ پاورآپ (سپر، ستاره، زمان کند، آهن‌ربا، کفش فنری) جمع کن'],
];
let toastQ = [], toastBusy = false;
function unlockAch(id, cond = true) {
  if (!cond) return;
  if (ST.ach[id]) return; ST.ach[id] = Date.now(); writeSave();
  const a = ACH.find(x => x[0] === id); if (!a) return;
  toastQ.push(a); if (!toastBusy) nextToast();
}
function nextToast() {
  const a = toastQ.shift(); if (!a) { toastBusy = false; return; } toastBusy = true;
  const el = $('toast'); el.innerHTML = `<span style="font-size:24px">${a[1]}</span><div>دستاورد: ${a[2]}<small>${a[3]}</small></div>`;
  el.classList.add('show'); Sound.play('win');
  setTimeout(() => { el.classList.remove('show'); setTimeout(nextToast, 350); }, 2600);
}
const totalStars = d => Object.values((app.prog[d] || {}).stars || {}).reduce((a, b) => a + b, 0);

/* ---------- game modes / views ---------- */
const MODES = {
  classic: { n: 'ترکیبی (پیشنهادی)', d: 'سکوبازی‌ها دوبعدی، مرحله‌های فرار از غول سه‌بعدی واقعی' },
  '2d': { n: 'دوبعدی', d: 'همه‌چیز صاف و کلاسیک؛ فرار از غول از نمای کناری' },
  '25': { n: 'دوبعدی با جلوه‌ی سه‌بعدی', d: 'سکوها عمق و پرسپکتیو دارن و پس‌زمینه لایه‌لایه حرکت می‌کنه؛ فرار از غول روی جاده‌ی شبه‌سه‌بعدی' },
  '3d': { n: 'سه‌بعدی واقعی', d: 'همه‌ی مرحله‌ها مثل مرحله‌های فرار از غول: توی دنیای سه‌بعدی می‌دوی، می‌پری و از موانع جاخالی می‌دی' },
  p3d: { n: 'سکوبازی سه‌بعدی (از کنار)', d: 'سکوبازی‌ها با همون نقشه‌ی دوبعدی ولی با گرافیک سه‌بعدی؛ دوربین کناری یا پشت سر' },
};
function viewOf(def) {
  const run = def.kind === '3d';
  switch (CFG.mode) { case '2d': return run ? 'r2' : 'p2'; case '25': return run ? 'r25' : 'p25'; case '3d': case 'p3d': return run ? 'x3' : 'p3'; default: return run ? 'x3' : 'p2'; }
}
const isGL = v => v === 'p3' || v === 'x3';

let mirrorCache = null;
function resize3() {
  if (!R3renderer) return;
  R3renderer.setPixelRatio(targetPR(2));
  R3renderer.setSize(innerWidth, innerHeight, false);
  mirrorCache = null;
}
function hud3(run) {
  const gap = Math.max(0, run.gapNow()), prog = clamp(run.p.s / run.len, 0, 1);
  $('progBar').style.transform = `scaleX(${prog.toFixed(3)})`;
  $('gapBar').style.transform = `scaleX(${clamp((gap - 2.5) / (run.gap0 * 1.3), 0, 1).toFixed(3)})`;
  const g = Math.round(gap);
  if (g !== hud3.last) {
    hud3.last = g; $('gapLbl').textContent = `غول: ${faNum(g)} متر`; $('mirror').classList.toggle('near', gap < 9);
    const d = clamp(1 - (gap - 3) / 10, 0, 1); $('danger').style.boxShadow = d > 0 ? `inset 0 0 ${Math.round(40 + d * 80)}px ${Math.round(d * 30)}px rgba(255,40,80,${(d * .55).toFixed(2)})` : 'none';
  }
}
hud3.last = -1;
let hudLast = '';
function hudTick() {
  let s = '';
  const tm = CFG.timer && app.state === 'play' ? '⏱ ' + fmtT(app.levelT) : '';
  const gm = app.kind === 'run' && app.run ? '💎 ' + faNum(app.run.gems) : app.endless && app.world ? `💎 ${faNum(app.world.got.size)}` : app.kind === 'plat' && app.world && app.world.gemTotal && app.state !== 'title' ? `💎 ${faNum(app.world.got.size)}/${faNum(app.world.gemTotal)}` : '';
  let pw = '';
  if (app.kind === 'plat' && app.world && app.world.lw > W && app.state !== 'title') {
    const k = clamp((app.world.p.x + PW) / app.world.lw, 0, 1), q = Math.round(k * 200);
    if (q !== hudTick.pq) { hudTick.pq = q; $('pprog').firstChild.style.transform = `scaleX(${(q / 200).toFixed(3)})`; }
  }
  if (app.endless && app.world && app.state === 'play') { const m = Math.max(0, Math.floor(app.world.p.x / T)); if (m > app.endless.dist) { app.endless.dist = m; app.updTag(); if (m === app.endless.best + 1 && app.endless.best > 0) app.taunt('🏆 رکورد شکسته شد!', '#ffd36e'); } }
  if (app.kind === 'plat' && app.world && app.state !== 'title') { const p = app.world.p; if (p.shield) pw += '🛡️'; for (const k of ['star', 'slow', 'magnet', 'jump']) { const v = p[POWS[k].t]; if (v > 0) pw += ' ' + POWS[k].i + faNum(Math.ceil(v)); } }
  if (app.kind === 'plat' && app.rivals2 && app.world && app.state !== 'title') pw += ` 🏁 نفر ${faNum(app.rivals2.rank(app.world.p.x))} از ${faNum(app.rivals2.list.length + 1)}`;
  if (app.kind === 'run' && app.run && app.run.rivals) pw += ` 🏁 نفر ${faNum(app.run.rank())} از ${faNum(app.run.rivals.length + 1)}`;
  if (app.kind === 'run' && app.run) { const p = app.run.p; if (p.shield) pw += '🛡️'; if (p.boostT > 0) pw += '⚡' + faNum(Math.ceil(p.boostT)); if (app.run.freezeT > 0) pw += ' ❄️' + faNum(Math.ceil(app.run.freezeT)); }
  const fp = CFG.fps ? faNum(Perf.fpsShow) + ' FPS · ' + faNum(Math.round(Perf.dyn * 100)) + '٪' : '';
  s = tm + '|' + gm + '|' + pw + '|' + fp;
  if (s === hudLast) return; hudLast = s;
  $('tmr').textContent = tm; $('gemC').textContent = gm; $('pwr').textContent = pw; $('fps').textContent = fp;
}

// daily challenge: the same endless course for everyone on the same day (the date is the seed)
const dayKey = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const dailyBest = () => ST.daily && ST.daily.day === dayKey() ? ST.daily.best : 0;

/* ---------- ghost of your best run (2D levels): recorded at 10 Hz, saved when you beat your best time ---------- */
const Ghost = {
  rec: null, play: null,
  key: (d, i) => 'telezar_ghost_' + d + '_' + i,
  start(d, i, fresh) {
    this.rec = fresh ? { k: this.key(d, i), a: [] } : null; this.play = null;
    if (!fresh || CFG.ghost === false) return;
    try { const s = localStorage.getItem(this.rec.k); if (s) { const b = atob(s), u = new Uint8Array(b.length); for (let j = 0; j < b.length; j++) u[j] = b.charCodeAt(j); this.play = new Int16Array(u.buffer); } } catch (e) { this.play = null; }
  },
  stop() { this.rec = null; this.play = null; },
  tick(w, t) {
    const r = this.rec; if (!r || r.a.length > 24000) return;
    while (r.a.length / 2 <= t * 10) r.a.push(Math.round(w.p.x), Math.round(w.p.y * (w.p.g < 0 ? -1 : 1)) || 0);
  },
  save() {
    const r = this.rec; if (!r || r.a.length < 4) return;
    try { const u = new Uint8Array(new Int16Array(r.a).buffer); let s = ''; for (let j = 0; j < u.length; j++) s += String.fromCharCode(u[j]); localStorage.setItem(r.k, btoa(s)); } catch (e) {}
  },
  // position of the ghost at level time t (null when there is none or it already finished)
  at(t) {
    const a = this.play; if (!a || CFG.ghost === false || app.state === 'title') return null;
    const f = t * 10, i = Math.floor(f), n = a.length / 2 - 1; if (i >= n) return null;
    const k = f - i, x0 = a[i * 2], x1 = a[i * 2 + 2], y0 = a[i * 2 + 1], y1 = a[i * 2 + 3];
    if (Math.abs(x1 - x0) > 300) return { x: x0, y: Math.abs(y0), flip: y0 < 0, face: 1, vx: 0 };
    return { x: x0 + (x1 - x0) * k, y: Math.abs(y0 + (y1 - y0) * k), flip: y0 < 0, face: x1 < x0 ? -1 : 1, vx: (x1 - x0) * 10 };
  },
};

const app = {
  state: 'title', screen: 'sTitle', kind: 'plat', view: 'p2', def: null, run: null, world: null, p3: null, idx: 0, realmIdx: -1,
  deaths: 0, unlocked: 1, completed: 0, diff: 1, prog: {}, runStart: 0, bannerT: null, levelT: 0, levelDeaths: 0, back: 'sTitle', dirty: true,
  show(id) { for (const s of ['sTitle', 'sLevels', 'sPause', 'sEnd', 'sSet', 'sMode', 'sStats', 'sShop', 'sOver', 'sEndless', 'sMissions', 'sMy']) $(s).classList.toggle('on', s === id); this.screen = id; $('edCode').classList.remove('on'); },
  open(id) { this.show(id); },
  goBack() {
    Sound.play('click'); if (this.state === 'over') return this.menu();
    const b = this.state === 'pause' ? 'sPause' : this.state === 'end' ? 'sEnd' : 'sTitle';
    this.show(b); if (b !== 'sEnd') renderDiffs();
  },
  updTag() {
    if (this.endless) { const E = this.endless; $('lvlTag').innerHTML = `${E.daily ? '🗓️ چالش امروز' : '♾️ بی‌پایان'} · <i style="color:${DIFFS[this.diff].col}">${DIFFS[this.diff].name}</i> · ${'❤️'.repeat(Math.max(0, E.lives))} · ${faNum(E.dist)} متر`; $('pprog').classList.remove('on'); return; }
    const w = this.kind === 'plat' && this.world, n = w && w.secs ? w.secs.length - 1 : 0, ck = n ? ` · 🚪 اتاق ${faNum(w.ck + 1)}/${faNum(n + 1)}` : '';
    const rm = this.kind === 'run' && this.run ? ` · 🚪 اتاق ${faNum(this.run.room || 1)}/${faNum(this.run.rooms)}` : '';
    const mu = MUTS.filter(m => mutOn(m[0])).map(m => m[1]).join('');
    $('lvlTag').innerHTML = `${this.label()} · <i style="color:${DIFFS[this.diff].col}">${DIFFS[this.diff].name}</i>` + (this.kind === 'run' ? rm : ck) + (mu ? ' · ' + mu : '');
    $('pprog').classList.toggle('on', !!n);
  },
  label() { if (this.custom) return `🛠️ ${esc(this.custom.lv.name)}`; if (this.rush) return '🗿 نبرد غول‌ها'; return this.endless ? (this.endless.daily ? '🗓️ چالش روزانه' : '♾️ حالت بی‌پایان') : this.realmIdx >= 0 ? `ابعاد پنهان ${faNum(this.realmIdx + 1)} از ${faNum(REALM.length)}` : `مرحله ${faNum(this.idx + 1)} از ${faNum(LEVELS.length)}`; },
  startLevel(i, opt = {}) {
    this.realmIdx = -1; this.idx = i; this.endless = null; this.custom = null; this.demo = null; this.rush = null;
    // long levels: continue from the checkpoint reached last time (saved per difficulty)
    if (opt.ck == null) { const sc = savedCk(this.diff, i); if (sc > 0) opt = Object.assign({}, opt, { ck: sc, resumed: true }); }
    this.startDef(LEVELS[i], opt);
  },
  startRealm(r, opt = {}) { this.realmIdx = r; this.endless = null; this.custom = null; this.demo = null; this.rush = null; this.startDef(REALM[r], opt); },
  // boss rush: the four boss arenas one after another, against the clock
  startRush() {
    this.realmIdx = -1; this.idx = -1; this.endless = null; this.custom = null; this.demo = null;
    this.rush = { best: (ST.rush || {})[this.diff] || 0 }; this.runStart = performance.now(); this.deaths = 0;
    this.startDef(bossRushDef(), {});
    setTimeout(() => { if (this.rush) this.taunt('🗿 چهار غول پشت سر هم! دکمه‌های قرمز رو بزن', '#ffd36e'); }, 2100);
  },
  // the scenery changes in the middle of a level (endless zones, boss rush arenas)
  swapBiome(b, small, big) {
    if (!b || !BIOMES[b] || BIOMES[b] === BIOME) return;
    setBiome(b); if (this.world) this.world.def.biome = b; if (this.p3) { const w = this.p3.world; this.p3.dispose(); this.p3 = new P3D(w); }
    $('bSmall').textContent = small; $('bBig').textContent = big;
    $('banner').classList.add('show'); clearTimeout(this.bannerT); this.bannerT = setTimeout(() => $('banner').classList.remove('show'), 1800);
  },
  // a level made in the editor (test: started from the editor, which it goes back to; demo: the robot's run is replayed)
  startCustom(lv, opt = {}) {
    this.realmIdx = -1; this.idx = -1; this.endless = null; this.rush = null;
    this.custom = { lv, test: !!opt.test }; this.demo = opt.demo ? { acts: opt.demo, i: 0, n: 0 } : null; this.demoUsed = !!this.demo;
    this.runStart = performance.now(); this.deaths = 0;
    this.startDef(edDef(lv), {});
    if (this.demo) setTimeout(() => { if (this.demo) this.taunt('🤖 ربات داره بازی می‌کنه… هر دکمه‌ای بزنی خودت ادامه می‌دی', '#9ef9ff'); }, 2100);
    else if (!lv.mine && !lv.sample) unlockAch('import');
  },
  // endless mode: 3 lives, the course grows ahead, a life every 5 checkpoints, zones change colour
  startEndless(daily = this.endless ? this.endless.daily : false) {
    const seed = daily ? dayKey() : (Math.random() * 1e6) | 0, def = makeEndless(seed);
    this.custom = null; this.demo = null; this.rush = null; this.realmIdx = -1; this.idx = -1; this.runStart = performance.now(); this.deaths = 0;
    this.endless = { lives: 3, dist: 0, gems: 0, seed, zone: 0, daily, best: daily ? dailyBest() : (ST.endBest || {})[this.diff] || 0 };
    this.startDef(def, {});
    setTimeout(() => this.taunt('♾️ تا جایی که می‌تونی برو! ۳ جون داری', '#9ef9ff'), 2100);
  },
  endlessCheck(i) {
    const E = this.endless, w = this.world, d = w.def;
    if (i >= d.secs.length - 3) {
      const ch = w.extend([endlessNext(d.E), endlessNext(d.E)]);
      if (this.p3) { this.p3.dropEnts(ch.dropped); this.p3.addEnts(ch.added); }
    }
    if (i % 5 === 0 && E.lives < 5) { E.lives++; Sound.play('win'); setTimeout(() => this.taunt('❤️ یه جون اضافه!', '#ff7ab8'), 900); }
    const z = Math.floor(i / ENDLESS_ZONE);
    if (z !== E.zone) {
      E.zone = z; const b = endlessZoneBiome(d, i);
      this.swapBiome(b, `منطقه‌ی ${faNum(z + 1)}`, b && BIOMES[b] ? BIOMES[b].n || 'منطقه‌ی جدید' : '');
    }
  },
  endlessOver() {
    const E = this.endless; if (!E) return;
    ST.endBest = ST.endBest || {}; const best = E.daily ? dailyBest() : ST.endBest[this.diff] || 0, rec = E.dist > best;
    if (rec) { if (E.daily) ST.daily = { day: dayKey(), best: E.dist }; else ST.endBest[this.diff] = E.dist; }
    if (E.dist > (ST.endBest[this.diff] || 0)) ST.endBest[this.diff] = E.dist;
    if (E.dist >= 500) unlockAch('endless'); Missions.ev('dist', E.dist); XP.add(E.dist / 10);
    writeSave();
    $('oDist').textContent = faNum(E.dist); $('oBest').textContent = faNum(Math.max(best, E.dist)); $('oGems').textContent = faNum(this.world ? this.world.got.size : 0); $('oCk').textContent = faNum(this.world ? this.world.ck : 0);
    $('oSub').textContent = (E.daily ? '🗓️ چالش امروز · ' : '') + (rec ? '🏆 رکورد جدید! ' + (best ? `(قبلی: ${faNum(best)} متر)` : '') : best ? `رکوردت ${faNum(best)} متره؛ یه بار دیگه!` : 'جون‌هات تموم شد…');
    if (rec) Sound.play('win');
    this.state = 'over'; mutApply(false); $('hud').classList.remove('on'); tLayer.classList.remove('on'); ptrs.clear(); refreshTouch(); this.show('sOver');
  },
  teardown() { if (this.run) { this.run.dispose(); this.run = null; } if (this.p3) { this.p3.dispose(); this.p3 = null; } },
  startDef(def, opt = {}) {
    this.teardown(); this.resumed = !!opt.resumed;
    this.def = def;
    // true 3D mode: a platformer level is played as a 3D run built from it
    const rdef = def.kind !== '3d' && CFG.mode === '3d' && !def.endless && !def.noRun ? runDefOf(def) : def;
    this.kind = rdef.kind === '3d' ? 'run' : 'plat';
    let v = viewOf(rdef);
    if (isGL(v) && !getRenderer3()) { v = this.kind === 'run' ? 'r25' : 'p25'; setTimeout(() => this.taunt('این دستگاه سه‌بعدی رو پشتیبانی نمی‌کنه؛ نمای شبه‌سه‌بعدی', '#ffd36e'), 700); }
    this.view = v;
    if (this.kind === 'plat') { setBiome(def.biome); refreshCaves(); if (def.rest) Sound.setMusic('rest'); }
    cv.style.display = isGL(v) ? 'none' : 'block'; $('c3').style.display = isGL(v) ? 'block' : 'none';
    this.state = 'play'; this.show(null); if (!opt.keep) { this.levelT = 0; this.levelDeaths = 0; } mutApply(true);
    $('hud').classList.add('on'); tLayer.classList.toggle('on', isTouch); $('revBadge').classList.remove('on'); $('danger').style.boxShadow = 'none';
    tLayer.classList.toggle('vert', v === 'r2');
    if (v === 'r2') setTimeout(() => this.taunt(isTouch ? '▲ ▼ = جابه‌جایی بالا و پایین جاده' : '← → = جابه‌جایی بالا و پایین جاده', '#9ef9ff'), 2300);
    this.updTag();
    this.updDeaths();
    if (!opt.keep) { if (this.kind === 'plat' && !def.endless && !def.noRun && this.realmIdx < 0) Ghost.start(this.diff, this.idx, !opt.resumed && !(opt.ck > 0)); else Ghost.stop(); }
    this.rivals2 = null;
    if (this.kind === 'plat') {
      const w = this.world = new World(def, { diff: this.diff, ck: opt.ck || 0 });
      // race levels in 2D: rivals replay recorded runs of every room
      const rd = this.realmIdx < 0 && !def.endless && RIVAL_LV.has(this.idx) && RIVAL_DATA['L' + this.idx];
      if (rd) { const R = this.rivals2 = new Rivals2D(def, rd, this.idx * 7 + 1, w.ck);
        R.onDone = r => this.taunt(`${r.name} رسید! نفر ${faNum(r.place)} 🏁`, r.col);
        R.onTrip = r => { const now = performance.now(); if (now - (this.rivT || 0) > 2500 && Math.abs(r.w.p.x - w.p.x) < W) { this.rivT = now; this.taunt(`${r.name} خورد زمین! 😵`, r.col); } }; }
      w.onCheckpoint = i => this.onCheckpoint(i);
      w.onGem = (e, bonus = 0) => { if (def.custom) return; ST.gems += 1 + bonus; if (ST.gems >= 100) unlockAch('gems100'); Missions.ev('gem', 1 + bonus); };
      w.onJump = () => { if (!def.custom) Missions.ev('jump'); };
      w.onBoss = b => { XP.add(this.rush ? 60 : 120); const s = ST.bosses || (ST.bosses = {}); s[b.kind] = 1; unlockAch('boss'); if (Object.keys(s).length >= Object.keys(BOSSES).length) unlockAch('bossAll'); if (typeof Missions !== 'undefined') Missions.ev('boss'); writeSave(); };
      w.onPick = k => this.onPick(k); w.onDeath = (c, e) => this.onDeath(c, e); w.onRev = on => $('revBadge').classList.toggle('on', on); w.onWin = () => this.onWin(); w.onSay = t => this.taunt(t, def.realm ? '#c59bff' : '#ffd36e');
      if (v === 'p3') this.p3 = new P3D(w);
      $('r3hud').classList.remove('on'); this.updTag();
    } else {
      const run = this.run = new Run3D(rdef, this.diff, { noScene: v !== 'x3' }); Sound.setMusic(rdef.noObst ? 'rest' : 'chase');
      // ck is a room number for every kind of level: start at that room's arch
      if (opt.ck > 0 && run.arches.length) { run.ckS = run.arches[Math.min(opt.ck, run.arches.length) - 1]; run.respawn(false); }
      run.onDeath = c => { this.onDeath(c === 'fall' ? 'fall3' : c); this.taunt(c === 'caught' ? 'غول گرفتت! 👹' : 'افتادی! 🕳️', c === 'caught' ? '#ff3d71' : '#ff5d8a'); };
      run.onWin = () => this.onWin(); run.onSay = t => { if (t) this.taunt(t, '#ffd36e'); };
      run.onRage = () => { if (Math.random() < 0.5) this.taunt('غول عصبانی شد!', '#ff8a4c'); };
      run.onPick = k => this.onPick(k); run.onJump = () => Missions.ev('jump');
      run.onRival = (r, what) => { const now = performance.now(); if (now - (this.rivT || 0) < 1800 && what !== 'done') return; this.rivT = now;
        this.taunt(what === 'caught' ? `${r.name} گیر غول افتاد! 😱` : what === 'fall' ? `${r.name} افتاد پایین! 🕳️` : `${r.name} رسید! نفر ${faNum(r.place)} 🏁`, r.col); };
      run.onRoom = (rm, ck) => { this.updTag(); Missions.ev('room'); XP.add(4); const sp = this.split(rm - 1); if (ck && this.realmIdx < 0 && !this.endless && this.idx >= 0) { const pr = progOf(this.diff); (pr.ck || (pr.ck = {}))[this.idx] = rm - 1; writeSave(); } this.taunt((rm === run.rooms ? `🚪 اتاق آخر! ${faNum(rm)} از ${faNum(run.rooms)}` : `🚪 اتاق ${faNum(rm)} از ${faNum(run.rooms)}${ck ? ' ✓' : ''}`) + (sp ? sp.txt : ''), sp ? sp.col : '#9ef9dc'); };
      $('r3hud').classList.add('on'); $('mirror').classList.toggle('hide', v !== 'x3' || !GFX.mir || mutScr()); hud3.last = -1;
    }
    resize3(); updCamBtn();
    $('banner').classList.toggle('low', this.kind === 'run');
    const size = def.rest ? ' · فقط برای استراحت 🌿' : this.kind === 'run' ? ` · ${faNum(this.run.rooms)} اتاق · ${faNum(rdef.len)} متر${rdef !== def ? ' · سه‌بعدی واقعی' : ''}` : def.secs ? ` · ${faNum(def.secs.length)} اتاق · ${faNum(def.nObs)} مانع` : '';
    $('bSmall').textContent = this.label() + size + (def.realm && this.kind === 'plat' ? ' · پرش دوبل فعاله!' : ''); $('bBig').textContent = def.name;
    $('banner').classList.add('show'); clearTimeout(this.bannerT); this.bannerT = setTimeout(() => $('banner').classList.remove('show'), 2000);
    if (this.kind === 'plat' && !isGL(v)) { const p = this.world.p; startTrans('open', .55, null, p.x + PW / 2, p.y + PHT / 2); }
    $('fade').classList.remove('on');
    if (def.endless) $('bSmall').textContent = `${faNum(this.endless ? this.endless.lives : 3)} جون · رکورد: ${faNum(this.endless ? this.endless.best : 0)} متر`;
    if (opt.resumed && !opt.keep) setTimeout(() => this.taunt(this.kind === 'run' ? `ادامه از اتاق ${faNum(this.run.roomAt(this.run.ckS))} از ${faNum(this.run.rooms)}` : `ادامه از اتاق ${faNum(this.world.ck + 1)} از ${faNum(this.world.secs.length)}`, '#9ef9ff'), 2100);
    Perf.reset(2); this.dirty = true;
  },
  restartView() {
    if (!this.def || (this.state !== 'play' && this.state !== 'pause')) return;
    const st = this.state, sc = this.screen;
    // keep the room / checkpoint, time and deaths: only the view is rebuilt
    const o = { keep: true, resumed: this.resumed, ck: this.kind === 'plat' && this.world ? this.world.ck : this.run ? this.run.roomAt(this.run.ckS) - 1 : 0 };
    if (this.realmIdx >= 0) this.startRealm(this.realmIdx, o); else { this.realmIdx = -1; this.startDef(this.def, o); }
    if (st === 'pause') { this.state = 'pause'; this.show(sc || 'sPause'); $('banner').classList.remove('show'); }
  },
  refreshVisuals() {
    // colours / graphics changed: rebuild drawing resources without resetting the level
    buildPal(); buildTextures(ctx); buildBackground(); applyMood(); layoutTouch();
    if (this.p3) { const w = this.p3.world; this.p3.dispose(); this.p3 = new P3D(w); }
    if (this.run && this.view === 'x3') this.run.rebuildScene();
    if (this.run) $('mirror').classList.toggle('hide', this.view !== 'x3' || !GFX.mir || mutScr());
    resize3(); this.dirty = true;
  },
  onDeath(c, src) {
    if (this.demo) { this.demo = null; setTimeout(() => this.taunt('🤖 ای وای، ربات اشتباه کرد! حالا خودت ادامه بده', '#9ef9ff'), 400); }
    Missions.ev('death'); trapSeen(c, src);
    if (this.endless && this.kind === 'plat') {
      const E = this.endless; if (E.lives <= 0) return; E.lives--; this.updTag();
      if (E.lives <= 0) { this.world.deadT = 1e9; const fin = () => { if (this.endless !== E) return; if (this.state === 'play') this.endlessOver(); else setTimeout(fin, 300); }; setTimeout(fin, 1100); }
      else this.taunt(E.lives === 1 ? '⚠️ آخرین جون!' : `${'❤️'.repeat(E.lives)} مونده`, '#ff7ab8');
    }
    this.deaths++; this.levelDeaths++; ST.deaths++; this.updDeaths(); $('deaths').classList.remove('bump'); void $('deaths').offsetWidth; $('deaths').classList.add('bump');
    if (CFG.vib && navigator.vibrate) navigator.vibrate([30, 20, 40]);
    if (this.kind === 'plat' && Math.random() < .75) this.taunt(TAUNTS[Math.floor(Math.random() * TAUNTS.length)], '#ff5d8a');
    if (ST.deaths >= 50) unlockAch('d50'); if (ST.deaths >= 500) unlockAch('d500');
    if (ST.deaths % 5 === 0) writeSave();
  },
  onPick(k) {
    if (k === 'gem') { ST.gems++; if (ST.gems >= 100) unlockAch('gems100'); Missions.ev('gem'); return; }
    if (k === 'shield' || k === 'boost' || k === 'freeze' || k.startsWith('pow:')) Missions.ev('pow');
    if (k === 'shieldUsed') { unlockAch('shield'); this.taunt('سپر نجاتت داد! 🛡️', '#8fd3ff'); return; }
    if (k.startsWith('pow:')) { const P = POWS[k.slice(4)]; ST.pows = (ST.pows || 0) + 1; if (ST.pows >= 25) unlockAch('pow25'); this.taunt(`${P.i} ${P.n}! ${P.d}`, P.col); if (CFG.vib && navigator.vibrate) navigator.vibrate(25); return; }
    this.taunt({ shield: 'سپر گرفتی! 🛡️', boost: 'سرعت توربو! ⚡', freeze: 'غول‌ها یخ زدن! ❄️' }[k] || '', '#9ef9ff');
    Sound.play('spawn');
  },
  taunt(text, col) { if (!text) return; $('banner').classList.remove('show'); const el = $('taunt'); el.textContent = text; el.style.color = col; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); },
  enterPortal() {
    ST.secret = true; unlockAch('portal'); writeSave();
    this.taunt('وارد ابعاد پنهان شدی! 🌀', '#c59bff'); Sound.play('orb');
    $('fade').classList.add('on'); setTimeout(() => this.startRealm(0), 650);
  },
  onCheckpoint(i) {
    if (this.rush) {
      this.updTag(); const k = RUSH[i];
      if (k) { this.swapBiome(RUSH_BIOME[k], `غول ${faNum(i + 1)} از ${faNum(RUSH.length)}`, BOSSES[k].n); setTimeout(() => this.taunt(`⏱ ${fmtT(this.levelT)}`, '#9ef9dc'), 1900); }
      else this.taunt('🚪 در خروج نزدیکه!', '#9ef9dc');
      return;
    }
    if (this.custom) { this.updTag(); const n = this.world.secs.length - 1; this.taunt(i === n ? '🚪 اتاق آخر!' : `🚩 اتاق ${faNum(i + 1)} از ${faNum(n + 1)}`, '#9ef9dc'); return; }
    Missions.ev('room'); XP.add(4);
    if (this.endless) { this.endlessCheck(i); this.updTag(); this.taunt(`🚩 چک‌پوینت ${faNum(i)}`, '#9ef9dc'); return; }
    const w = this.world, n = w.secs.length - 1;
    if (this.realmIdx < 0) { const pr = progOf(this.diff); (pr.ck || (pr.ck = {}))[this.idx] = i; writeSave(); }
    this.updTag();
    const sp = this.split(i);
    this.taunt((i === n ? `🚪 اتاق آخر! (${faNum(n + 1)} از ${faNum(n + 1)}) در نزدیکه` : `🚪 اتاق ${faNum(i + 1)} از ${faNum(n + 1)}`) + (sp ? sp.txt : ''), sp ? sp.col : '#9ef9dc');
  },
  // time to reach room i compared with your best (only for runs started from the first room)
  split(i) {
    if (this.resumed || this.endless || this.realmIdx >= 0 || this.idx < 0) return null;
    const pr = progOf(this.diff), S = pr.split || (pr.split = {}), key = this.idx + (this.kind === 'run' ? 'r' : ''), arr = S[key] || (S[key] = []), t = this.levelT, best = arr[i];
    if (!best || t < best) arr[i] = +t.toFixed(2);
    if (!best) return null;
    const d = t - best; return { txt: `   ⏱ ${d < 0 ? '−' : '+'}${faNum(Math.abs(d).toFixed(1))}`, col: d < 0 ? '#6ff3c4' : '#ff9a8a' };
  },
  onWin() {
    if (this.kind === 'plat' && this.world && this.world.winKind === 'portal') return this.enterPortal();
    if (this.custom) return this.customWin();
    if (this.rush) return this.rushWin();
    const t = this.levelT, d = this.levelDeaths;
    const nr = this.kind === 'plat' && this.world && this.world.secs ? this.world.secs.length : 1;
    const stars = this.kind === 'run' ? (d === 0 ? 3 : d <= 2 ? 2 : 1) : (d <= nr ? 3 : d <= nr * 4 ? 2 : 1);
    ST.wins++;
    const modesWon = ST.modes || (ST.modes = {}); modesWon[CFG.mode] = 1; if (Object.keys(modesWon).length >= 4) unlockAch('modes');
    let next;
    if (this.realmIdx >= 0) {
      if (this.realmIdx + 1 < REALM.length) next = () => this.startRealm(this.realmIdx + 1);
      else {
        ST.realm = 1; unlockAch('realm');
        this.unlocked = Math.max(this.unlocked, PORTAL_LEVEL + 2); this.completed = Math.max(this.completed, PORTAL_LEVEL + 1);
        next = () => this.startLevel(PORTAL_LEVEL + 1);
      }
    } else {
      const pr = progOf(this.diff); pr.stars = pr.stars || {}; pr.best = pr.best || {};
      pr.stars[this.idx] = Math.max(pr.stars[this.idx] || 0, stars);
      if (pr.ck) delete pr.ck[this.idx];
      if (this.world && this.world.gemTotal) { pr.gems = pr.gems || {}; pr.gems[this.idx] = Math.max(pr.gems[this.idx] || 0, this.world.got.size); }
      // a run continued from a saved checkpoint does not count for best time
      if (!this.resumed && (!pr.best[this.idx] || t < pr.best[this.idx])) { if (pr.best[this.idx]) setTimeout(() => this.taunt('👻 رکورد جدید! شبحت ذخیره شد', '#bfe8ff'), 1300); pr.best[this.idx] = +t.toFixed(2); if (this.kind === 'plat') Ghost.save(); }
      this.unlocked = Math.max(this.unlocked, Math.min(LEVELS.length, this.idx + 2));
      this.completed = Math.max(this.completed || 0, this.idx + 1);
      const wonCount = Object.keys(pr.stars).length;
      unlockAch('first'); if (wonCount >= 10) unlockAch('ten'); if (wonCount >= 20) unlockAch('twenty'); if (wonCount >= LEVELS.length) unlockAch('all');
      if (this.idx === 39) unlockAch('horde'); if (this.def.final) unlockAch('summit');
      if (totalStars(this.diff) >= 60) unlockAch('stars');
      next = () => { if (this.idx + 1 < LEVELS.length) this.startLevel(this.idx + 1); else this.finish(); };
    }
    if (this.kind === 'plat' && this.world) { const w = this.world; if (w.gemTotal && w.got.size >= w.gemTotal) unlockAch('allgems'); if (w.secs && w.secs.some(s => s.cave)) unlockAch('cave'); }
    if (WX.kind === 'storm') unlockAch('storm');
    if (d === 0) unlockAch('clean'); if (this.kind === 'run') unlockAch('run3d'); if (this.diff === 4) unlockAch('insane'); if (this.kind === 'plat' && !this.resumed && t < parTime(this.def)) unlockAch('speed');
    writeSave();
    this.taunt(`${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}  ${fmtT(t)} ثانیه`, '#ffd36e');
    const race = this.kind === 'run' ? this.run && this.run.rivals && { fin: this.run.finishCount, n: this.run.rivals.length } : this.rivals2 && { fin: this.rivals2.fin, n: this.rivals2.list.length };
    const nm = mutCount(); if (nm) { Missions.ev('mut'); ST.gems += nm * 5; setTimeout(() => this.taunt(`🎭 جایزه‌ی چالش: +${faNum(nm * 5)} 💎`, '#ff8a4c'), 2300); }
    Missions.ev('win'); XP.add((40 + (d === 0 ? 20 : 0) + this.diff * 10) * (1 + nm * .5)); if (d === 0) Missions.ev('clean'); if (this.kind === 'run') Missions.ev('win3d');
    if (race) { const pl = race.fin + 1; if (pl === 1) { unlockAch('champ'); Missions.ev('race1'); } setTimeout(() => this.taunt(pl === 1 ? '🏆 نفر اول شدی! از همه جلو زدی' : `🏁 نفر ${faNum(pl)} از ${faNum(race.n + 1)} شدی`, pl === 1 ? '#ffd36e' : '#9ef9ff'), 1100); }
    const flat = v => v === 'p2' || v === 'p25';
    const nextDef = this.realmIdx >= 0 ? (this.realmIdx + 1 < REALM.length ? REALM[this.realmIdx + 1] : LEVELS[PORTAL_LEVEL + 1]) : LEVELS[this.idx + 1];
    if (flat(this.view) && nextDef && flat(viewOf(nextDef)) && this.world && this.world.winDoor) {
      const dd = this.world.winDoor; startTrans('close', .5, next, dd.x + dd.w / 2, dd.y + dd.h / 2);
    } else { $('fade').classList.add('on'); setTimeout(next, 480); }
  },
  rushWin() {
    const t = this.levelT, R = ST.rush || (ST.rush = {}), best = R[this.diff], rec = !best || t < best, W = ST.rushWon || (ST.rushWon = {});
    if (rec) R[this.diff] = +t.toFixed(2);
    const gems = W[this.diff] ? 0 : 40 + this.diff * 20; if (gems) { W[this.diff] = 1; ST.gems += gems; }
    XP.add(150); unlockAch('rush'); if (this.diff === 4) unlockAch('rushInsane'); Missions.ev('win'); writeSave();
    this.taunt(`🏆 نبرد غول‌ها تموم شد! ⏱ ${fmtT(t)}${rec ? ' — رکورد جدید!' : ` (رکورد: ${fmtT(best)})`}${gems ? ` · +${faNum(gems)} 💎` : ''}`, '#ffd36e');
    const R0 = this.rush; $('fade').classList.add('on');
    setTimeout(() => { if (this.rush !== R0) return; this.menu('sEndless'); renderEndless(); }, 2600);
  },
  customWin() {
    const C = this.custom, lv = C.lv, t = this.levelT, d = this.levelDeaths, byBot = this.demoUsed;
    if (!byBot && !lv.sample) { lv.ok = true; const s = Ed.get(lv.id); if (s) { s.ok = true; Ed.put(s); } }
    if (!byBot && lv.mine) { unlockAch('maker'); Missions.ev('make'); }
    if (!byBot && !lv.mine && !lv.sample) unlockAch('friend');
    this.taunt(byBot ? '🤖 ربات رسید به در!' : `🏁 ${lv.mine && C.test ? 'مرحله‌ات تأیید شد! حالا می‌تونی کدش رو بفرستی' : 'ردش کردی!'}  ⏱ ${fmtT(t)} · 💀 ${faNum(d)}`, '#ffd36e');
    $('fade').classList.add('on');
    setTimeout(() => { if (this.custom !== C) return; if (C.test && ED.lv === lv) edOpen(lv, true); else this.menu('sMy'); }, 1300);
  },
  finish() {
    mutApply(false); this.teardown(); this.view = 'p2'; this.kind = 'plat'; cv.style.display = 'block'; $('c3').style.display = 'none'; $('r3hud').classList.remove('on'); $('fade').classList.remove('on');
    setBiome(LEVELS[0].biome); this.world = new World(0, { silent: true });
    this.state = 'end'; $('hud').classList.remove('on'); tLayer.classList.remove('on'); ptrs.clear(); refreshTouch();
    const secs = Math.round((performance.now() - this.runStart) / 1000);
    $('eDeaths').textContent = faNum(this.deaths); $('eDiff').textContent = DIFFS[this.diff].name; $('eDiff').style.color = DIFFS[this.diff].col; $('eTime').textContent = `${faNum(Math.floor(secs / 60))}:${faNum(String(secs % 60).padStart(2, '0'))}`;
    $('eStars').textContent = faNum(totalStars(this.diff));
    this.show('sEnd'); startTrans('open', .5, null);
  },
  updDeaths() { $('dCount').textContent = faNum(this.deaths); },
  restart() {
    if (this.kind === 'run') { if (this.run && (this.run.state === 'run' || this.run.state === 'intro')) this.run.respawn(false); return; }
    if (this.world && this.world.state === 'play') { this.world.respawn(false); }
  },
  restartLevel() {
    // whole level from the very start (forgets a saved checkpoint)
    if (!this.def) return;
    if (this.custom) return this.startCustom(this.custom.lv, { test: this.custom.test });
    if (this.rush) return this.startRush();
    if (this.endless) return this.startEndless();
    if (this.realmIdx >= 0) return this.startRealm(this.realmIdx, { ck: 0 });
    const pr = progOf(this.diff); if (pr.ck && pr.ck[this.idx]) { delete pr.ck[this.idx]; writeSave(); }
    this.startLevel(this.idx, { ck: 0 });
  },
  pause() { if (this.state !== 'play') return; this.state = 'pause'; ptrs.clear(); refreshTouch(); renderDiffs(); soundLabel(); $('bEdBack').hidden = !this.custom; this.show('sPause'); },
  resume() { if (this.state !== 'pause') return; this.state = 'play'; this.show(null); Perf.reset(1); },
  menu(to = 'sTitle') {
    mutApply(false); this.teardown(); this.endless = null; this.custom = null; this.demo = null; this.rush = null; this.rivals2 = null; Ghost.stop(); this.view = 'p2'; this.kind = 'plat'; this.def = null; cv.style.display = 'block'; $('c3').style.display = 'none'; $('r3hud').classList.remove('on'); $('fade').classList.remove('on');
    setBiome(LEVELS[0].biome);
    this.state = 'title'; $('bCam').classList.remove('on'); $('hud').classList.remove('on'); $('revBadge').classList.remove('on'); tLayer.classList.remove('on'); renderDiffs(); if (to === 'sMy') renderMy(); this.show(to); this.world = new World(0, { silent: true });
  },
  setDiff(d) {
    if (d === this.diff) return;
    this.demo = null;
    writeSave(); this.diff = d;
    const pr = progOf(d); this.unlocked = clamp(pr.unlocked || 1, 1, LEVELS.length); this.completed = pr.completed || 0;
    writeSave(); renderDiffs();
    if (this.state === 'pause') {
      if (this.realmIdx < 0) { this.unlocked = Math.max(this.unlocked, this.idx + 1); writeSave(); }
      this.state = 'play'; this.show(null); if (this.endless) this.startEndless(); else if (this.rush) this.startRush(); else this.startDef(this.def);
    }
    if ($('sLevels').classList.contains('on')) this.buildGrid();
    if ($('sEndless').classList.contains('on')) renderEndless();
  },
  buildGrid() {
    const g = $('lvGrid'); g.innerHTML = ''; const pr = progOf(this.diff), stars = pr.stars || {};
    LEVELS.forEach((L, i) => {
      const b = document.createElement('button'); b.className = 'lv' + (i < (this.completed || 0) ? ' done' : '') + (L.kind === '3d' ? ' l3' : '');
      const sc = savedCk(this.diff, i);
      b.innerHTML = faNum(i + 1) + (RIVAL_LV.has(i) ? '<span class="rv" title="مسابقه">🏁</span>' : L.rest ? '<span class="rv">🌿</span>' : '') + (stars[i] ? `<span class="st">${'★'.repeat(stars[i])}</span>` : '') + (sc > 0 ? `<span class="rs">🚪${faNum(sc + 1)}</span>` : '');
      b.title = L.name + (sc > 0 ? ` — ادامه از اتاق ${faNum(sc + 1)}` : ''); b.disabled = i >= this.unlocked;
      b.onclick = () => { Sound.play('click'); this.runStart = performance.now(); this.deaths = 0; this.startLevel(i); };
      g.appendChild(b);
    });
    $('realmBox').hidden = !ST.secret;
    const rg = $('rmGrid'); rg.innerHTML = '';
    REALM.forEach((L, i) => { const b = document.createElement('button'); b.className = 'lv'; b.textContent = '🌀' + faNum(i + 1); b.title = L.name; b.onclick = () => { Sound.play('click'); this.runStart = performance.now(); this.deaths = 0; this.startRealm(i); }; rg.appendChild(b); });
  },
};
function soundLabel() { const t = !Sound.on ? '🔇 صدا: خاموش' : Sound.ctx && !Sound.running() ? '🔈 صدا: بزن تا فعال شه' : '🔊 صدا: روشن'; $('bSound').textContent = t; $('bSound2').textContent = t; }
// shows whether the browser lets the game play sound (settings > sound, and the sound buttons)
function soundHint() {
  soundLabel(); const el = document.getElementById('sndState'); if (!el) return;
  el.textContent = !Sound.ctx ? 'صدا هنوز فعال نشده؛ یه بار روی صفحه بزن.' : Sound.running() ? (Sound.on ? '✅ صدا فعاله.' : '🔇 صدا از دکمه‌ی صدا خاموشه.') : '⚠️ مرورگر صدا رو متوقف کرده؛ یه بار روی صفحه بزن.';
}
function goFull() {
  const el = document.documentElement;
  try { const r = (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); if (r && r.then) r.then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {}); } catch (e) {}
}
$('bPlay').onclick = () => { Sound.init(); Sound.play('click'); if (isTouch && !document.fullscreenElement) goFull(); app.runStart = performance.now(); app.deaths = 0; app.startLevel(app.completed >= LEVELS.length ? 0 : app.unlocked - 1); };
$('bLevels').onclick = () => { Sound.init(); Sound.play('click'); app.buildGrid(); app.open('sLevels'); };
$('bMode').onclick = $('bMode2').onclick = () => { Sound.init(); Sound.play('click'); renderModes(); app.open('sMode'); };
$('bSet').onclick = $('bSet2').onclick = () => { Sound.init(); Sound.play('click'); renderSettings(); app.open('sSet'); };
$('bStats').onclick = () => { Sound.init(); Sound.play('click'); renderStats(); app.open('sStats'); };
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => app.goBack());
$('bSound').onclick = $('bSound2').onclick = () => { Sound.init(); Sound.setOn(!Sound.on); soundLabel(); writeSave(); Sound.play('click'); };
$('bFull').onclick = () => { Sound.init(); goFull(); };
$('bPause').onclick = () => { Sound.play('click'); app.pause(); };
$('bRestart').onclick = () => { Sound.play('click'); app.restart(); };
$('bResume').onclick = () => { Sound.play('click'); app.resume(); };
$('bRestart2').onclick = () => { Sound.play('click'); app.resume(); app.restart(); };
$('bRestartAll').onclick = () => { Sound.play('click'); app.restartLevel(); };
$('bMenu').onclick = $('bMenu2').onclick = () => { Sound.play('click'); app.menu(); };
$('bEdBack').onclick = () => { Sound.play('click'); const C = app.custom; if (!C) return; if (C.test && ED.lv === C.lv) edOpen(C.lv, true); else app.menu('sMy'); };
$('bAgain').onclick = () => { Sound.play('click'); app.runStart = performance.now(); app.deaths = 0; app.startLevel(0); };
function renderDiffs() {
  document.querySelectorAll('[data-diffs]').forEach(box => {
    box.innerHTML = '';
    DIFFS.forEach((D, i) => {
      const b = document.createElement('button'); b.className = 'dchip' + (i === app.diff ? ' on' : ''); b.textContent = D.name;
      b.style.setProperty('--dc', D.col); b.setAttribute('aria-pressed', i === app.diff);
      b.onclick = () => { Sound.init(); Sound.play('click'); app.setDiff(i); };
      box.appendChild(b);
    });
  });
  $('dDesc').textContent = DDESC[app.diff];
}
$('bRotOk').onclick = () => { rotDismissed = true; checkRotate(); };
let rotDismissed = false;
function checkRotate() { $('rotate').classList.toggle('on', isTouch && !rotDismissed && innerHeight > innerWidth); }
