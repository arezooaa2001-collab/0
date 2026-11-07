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
addEventListener('pointerdown', () => Sound.init(), { passive: true });
function readInput() {
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
const ST = { deaths: 0, gems: 0, time: 0, wins: 0, ach: {}, secret: false, realm: 0 };
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
const fmtT = s => { s = Math.max(0, s); const m = Math.floor(s / 60), r = s - m * 60; return m ? `${faNum(m)}:${faNum(r.toFixed(0).padStart(2, '0'))}` : faNum(r.toFixed(1)); };

/* ---------- achievements ---------- */
const ACH = [
  ['first', '🥇', 'اولین برد', 'اولین مرحله رو تموم کن'],
  ['ten', '🔟', 'ده‌تایی', '۱۰ مرحله رو تموم کن'],
  ['twenty', '🧭', 'نیمه‌ی راه', '۲۰ مرحله رو تموم کن'],
  ['all', '👑', 'فاتح تله‌زار', 'هر ۴۰ مرحله رو تموم کن'],
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
  ['speed', '⚡', 'برق‌آسا', 'یه مرحله‌ی سکوبازی رو با میانگین زیر ۸ ثانیه برای هر اتاق تموم کن'],
  ['stars', '⭐', 'ستاره‌باران', '۶۰ ستاره جمع کن (در یک سطح سختی)'],
  ['modes', '🎮', 'همه‌کاره', 'توی هر چهار حالت بازی یه مرحله رو ببر'],
];
let toastQ = [], toastBusy = false;
function unlockAch(id) {
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
  '3d': { n: 'سه‌بعدی کامل', d: 'همه‌ی مرحله‌ها، حتی سکوبازی‌ها، با موتور سه‌بعدی واقعی و نور و سایه' },
};
function viewOf(def) {
  const run = def.kind === '3d';
  switch (CFG.mode) { case '2d': return run ? 'r2' : 'p2'; case '25': return run ? 'r25' : 'p25'; case '3d': return run ? 'x3' : 'p3'; default: return run ? 'x3' : 'p2'; }
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
  const gm = app.kind === 'run' && app.run ? '💎 ' + faNum(app.run.gems) : '';
  let pw = '';
  if (app.kind === 'run' && app.run) { const p = app.run.p; if (p.shield) pw += '🛡️'; if (p.boostT > 0) pw += '⚡' + faNum(Math.ceil(p.boostT)); if (app.run.freezeT > 0) pw += ' ❄️' + faNum(Math.ceil(app.run.freezeT)); }
  const fp = CFG.fps ? faNum(Perf.fpsShow) + ' FPS · ' + faNum(Math.round(Perf.dyn * 100)) + '٪' : '';
  s = tm + '|' + gm + '|' + pw + '|' + fp;
  if (s === hudLast) return; hudLast = s;
  $('tmr').textContent = tm; $('gemC').textContent = gm; $('pwr').textContent = pw; $('fps').textContent = fp;
}

const app = {
  state: 'title', screen: 'sTitle', kind: 'plat', view: 'p2', def: null, run: null, world: null, p3: null, idx: 0, realmIdx: -1,
  deaths: 0, unlocked: 1, completed: 0, diff: 1, prog: {}, runStart: 0, bannerT: null, levelT: 0, levelDeaths: 0, back: 'sTitle', dirty: true,
  show(id) { for (const s of ['sTitle', 'sLevels', 'sPause', 'sEnd', 'sSet', 'sMode', 'sStats']) $(s).classList.toggle('on', s === id); this.screen = id; },
  open(id) { this.show(id); },
  goBack() {
    Sound.play('click');
    const b = this.state === 'pause' ? 'sPause' : this.state === 'end' ? 'sEnd' : 'sTitle';
    this.show(b); if (b !== 'sEnd') renderDiffs();
  },
  updTag() {
    const w = this.kind === 'plat' && this.world, rm = w && w.rooms.length > 1 ? ` · اتاق ${faNum(w.room + 1)}/${faNum(w.rooms.length)}` : '';
    $('lvlTag').innerHTML = `${this.label()} · <i style="color:${DIFFS[this.diff].col}">${DIFFS[this.diff].name}</i>` + (this.kind === 'run' ? ' · فرار از غول' : rm);
  },
  label() { return this.realmIdx >= 0 ? `ابعاد پنهان ${faNum(this.realmIdx + 1)} از ${faNum(REALM.length)}` : `مرحله ${faNum(this.idx + 1)} از ${faNum(LEVELS.length)}`; },
  startLevel(i) { this.realmIdx = -1; this.idx = i; this.startDef(LEVELS[i]); },
  startRealm(r) { this.realmIdx = r; this.startDef(REALM[r]); },
  teardown() { if (this.run) { this.run.dispose(); this.run = null; } if (this.p3) { this.p3.dispose(); this.p3 = null; } },
  startDef(def) {
    this.teardown();
    this.def = def; this.kind = def.kind === '3d' ? 'run' : 'plat';
    let v = viewOf(def);
    if (isGL(v) && !getRenderer3()) { v = this.kind === 'run' ? 'r25' : 'p25'; setTimeout(() => this.taunt('این دستگاه سه‌بعدی رو پشتیبانی نمی‌کنه؛ نمای شبه‌سه‌بعدی', '#ffd36e'), 700); }
    this.view = v;
    if ((v === 'p25') !== !!BG.far) buildBackground();
    cv.style.display = isGL(v) ? 'none' : 'block'; $('c3').style.display = isGL(v) ? 'block' : 'none';
    this.state = 'play'; this.show(null); this.levelT = 0; this.levelDeaths = 0;
    $('hud').classList.add('on'); tLayer.classList.toggle('on', isTouch); $('revBadge').classList.remove('on'); $('danger').style.boxShadow = 'none';
    tLayer.classList.toggle('vert', v === 'r2');
    if (v === 'r2') setTimeout(() => this.taunt(isTouch ? '▲ ▼ = جابه‌جایی بالا و پایین جاده' : '← → = جابه‌جایی بالا و پایین جاده', '#9ef9ff'), 2300);
    this.updTag();
    this.updDeaths();
    if (this.kind === 'plat') {
      const w = this.world = new World(def, { diff: this.diff });
      w.onDeath = c => this.onDeath(c); w.onRev = on => $('revBadge').classList.toggle('on', on); w.onWin = () => this.onWin(); w.onSay = t => this.taunt(t, def.realm ? '#c59bff' : '#ffd36e');
      if (v === 'p3') this.p3 = new P3D(w);
      $('r3hud').classList.remove('on'); this.updTag();
    } else {
      const run = this.run = new Run3D(def, this.diff, { noScene: v !== 'x3' });
      run.onDeath = c => { this.onDeath(c); this.taunt(c === 'caught' ? 'غول گرفتت! 👹' : 'افتادی! 🕳️', c === 'caught' ? '#ff3d71' : '#ff5d8a'); };
      run.onWin = () => this.onWin(); run.onSay = t => { if (t) this.taunt(t, '#ffd36e'); };
      run.onRage = () => { if (Math.random() < 0.5) this.taunt('غول عصبانی شد!', '#ff8a4c'); };
      run.onPick = k => this.onPick(k);
      $('r3hud').classList.add('on'); $('mirror').classList.toggle('hide', v !== 'x3' || !GFX.mir); hud3.last = -1;
    }
    resize3();
    $('banner').classList.toggle('low', this.kind === 'run');
    const size = def.rooms && def.rooms.length > 1 ? ` · ${faNum(def.rooms.length)} اتاق` : this.kind === 'run' ? ` · ${faNum(def.len)} متر` : '';
    $('bSmall').textContent = this.label() + size + (def.realm ? ' · پرش دوبل فعاله!' : ''); $('bBig').textContent = def.name;
    $('banner').classList.add('show'); clearTimeout(this.bannerT); this.bannerT = setTimeout(() => $('banner').classList.remove('show'), 2000);
    if (this.kind === 'plat' && !isGL(v)) { const p = this.world.p; startTrans('open', .55, null, p.x + PW / 2, p.y + PHT / 2); }
    $('fade').classList.remove('on');
    Perf.reset(2); this.dirty = true;
  },
  restartView() {
    if (!this.def || (this.state !== 'play' && this.state !== 'pause')) return;
    const st = this.state, sc = this.screen;
    if (this.realmIdx >= 0) this.startRealm(this.realmIdx); else this.startDef(this.def);
    if (st === 'pause') { this.state = 'pause'; this.show(sc || 'sPause'); $('banner').classList.remove('show'); }
  },
  refreshVisuals() {
    // colours / graphics changed: rebuild drawing resources without resetting the level
    buildPal(); buildTextures(ctx); buildBackground(); applyMood(); layoutTouch();
    if (this.p3) { const w = this.p3.world; this.p3.dispose(); this.p3 = new P3D(w); }
    if (this.run && this.view === 'x3') this.run.rebuildScene();
    if (this.run) $('mirror').classList.toggle('hide', this.view !== 'x3' || !GFX.mir);
    resize3(); this.dirty = true;
  },
  onDeath(c) {
    this.deaths++; this.levelDeaths++; ST.deaths++; this.updDeaths(); $('deaths').classList.remove('bump'); void $('deaths').offsetWidth; $('deaths').classList.add('bump');
    if (CFG.vib && navigator.vibrate) navigator.vibrate([30, 20, 40]);
    if (this.kind === 'plat' && Math.random() < .75) this.taunt(TAUNTS[Math.floor(Math.random() * TAUNTS.length)], '#ff5d8a');
    if (ST.deaths >= 50) unlockAch('d50'); if (ST.deaths >= 500) unlockAch('d500');
    if (ST.deaths % 5 === 0) writeSave();
  },
  onPick(k) {
    if (k === 'gem') { ST.gems++; if (ST.gems >= 100) unlockAch('gems100'); return; }
    if (k === 'shieldUsed') { unlockAch('shield'); this.taunt('سپر نجاتت داد! 🛡️', '#8fd3ff'); return; }
    this.taunt({ shield: 'سپر گرفتی! 🛡️', boost: 'سرعت توربو! ⚡', freeze: 'غول‌ها یخ زدن! ❄️' }[k] || '', '#9ef9ff');
    Sound.play('spawn');
  },
  taunt(text, col) { if (!text) return; $('banner').classList.remove('show'); const el = $('taunt'); el.textContent = text; el.style.color = col; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); },
  enterPortal() {
    ST.secret = true; unlockAch('portal'); writeSave();
    this.taunt('وارد ابعاد پنهان شدی! 🌀', '#c59bff'); Sound.play('orb');
    $('fade').classList.add('on'); setTimeout(() => this.startRealm(0), 650);
  },
  nextRoom() {
    const w = this.world, d = w.winDoor, flat = this.view === 'p2' || this.view === 'p25';
    const go = () => {
      w.nextRoom();
      if (this.p3) { this.p3.dispose(); this.p3 = new P3D(w); }
      this.updTag(); $('revBadge').classList.remove('on');
      this.taunt(`اتاق ${faNum(w.room + 1)} از ${faNum(w.rooms.length)}` + (w.room === w.rooms.length - 1 ? ' — آخرین اتاق!' : ''), '#9ef9ff');
      if (flat) startTrans('open', .45, null, w.p.x + PW / 2, w.p.y + PHT / 2); else $('fade').classList.remove('on');
      Sound.play('spawn'); Perf.reset(1); this.dirty = true;
    };
    if (flat) startTrans('close', .42, go, d.x + d.w / 2, d.y + d.h / 2);
    else { $('fade').classList.add('on'); setTimeout(go, 420); }
  },
  onWin() {
    if (this.kind === 'plat' && this.world && this.world.winKind === 'portal') return this.enterPortal();
    if (this.kind === 'plat' && this.world && this.world.winKind === 'room') return this.nextRoom();
    const t = this.levelT, d = this.levelDeaths;
    const nr = this.kind === 'plat' && this.world ? this.world.rooms.length : 1;
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
      if (!pr.best[this.idx] || t < pr.best[this.idx]) pr.best[this.idx] = +t.toFixed(2);
      this.unlocked = Math.max(this.unlocked, Math.min(LEVELS.length, this.idx + 2));
      this.completed = Math.max(this.completed || 0, this.idx + 1);
      const wonCount = Object.keys(pr.stars).length;
      unlockAch('first'); if (wonCount >= 10) unlockAch('ten'); if (wonCount >= 20) unlockAch('twenty'); if (wonCount >= LEVELS.length) unlockAch('all');
      if (this.idx === LEVELS.length - 1) unlockAch('horde');
      if (totalStars(this.diff) >= 60) unlockAch('stars');
      next = () => { if (this.idx + 1 < LEVELS.length) this.startLevel(this.idx + 1); else this.finish(); };
    }
    if (d === 0) unlockAch('clean'); if (this.kind === 'run') unlockAch('run3d'); if (this.diff === 4) unlockAch('insane'); if (this.kind === 'plat' && t < nr * 8) unlockAch('speed');
    writeSave();
    this.taunt(`${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}  ${fmtT(t)} ثانیه`, '#ffd36e');
    const flat = v => v === 'p2' || v === 'p25';
    const nextDef = this.realmIdx >= 0 ? (this.realmIdx + 1 < REALM.length ? REALM[this.realmIdx + 1] : LEVELS[PORTAL_LEVEL + 1]) : LEVELS[this.idx + 1];
    if (flat(this.view) && nextDef && flat(viewOf(nextDef)) && this.world && this.world.winDoor) {
      const dd = this.world.winDoor; startTrans('close', .5, next, dd.x + dd.w / 2, dd.y + dd.h / 2);
    } else { $('fade').classList.add('on'); setTimeout(next, 480); }
  },
  finish() {
    this.teardown(); this.view = 'p2'; this.kind = 'plat'; cv.style.display = 'block'; $('c3').style.display = 'none'; $('r3hud').classList.remove('on'); $('fade').classList.remove('on');
    this.world = new World(0, { silent: true });
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
  pause() { if (this.state !== 'play') return; this.state = 'pause'; ptrs.clear(); refreshTouch(); renderDiffs(); soundLabel(); this.show('sPause'); },
  resume() { if (this.state !== 'pause') return; this.state = 'play'; this.show(null); Perf.reset(1); },
  menu() {
    this.teardown(); this.view = 'p2'; this.kind = 'plat'; this.def = null; cv.style.display = 'block'; $('c3').style.display = 'none'; $('r3hud').classList.remove('on'); $('fade').classList.remove('on');
    if (BG.far) buildBackground();
    this.state = 'title'; $('hud').classList.remove('on'); $('revBadge').classList.remove('on'); tLayer.classList.remove('on'); renderDiffs(); this.show('sTitle'); this.world = new World(0, { silent: true });
  },
  setDiff(d) {
    if (d === this.diff) return;
    writeSave(); this.diff = d;
    const pr = progOf(d); this.unlocked = clamp(pr.unlocked || 1, 1, LEVELS.length); this.completed = pr.completed || 0;
    writeSave(); renderDiffs();
    if (this.state === 'pause') {
      if (this.realmIdx < 0) { this.unlocked = Math.max(this.unlocked, this.idx + 1); writeSave(); }
      this.state = 'play'; this.show(null); this.startDef(this.def);
    }
    if ($('sLevels').classList.contains('on')) this.buildGrid();
  },
  buildGrid() {
    const g = $('lvGrid'); g.innerHTML = ''; const pr = progOf(this.diff), stars = pr.stars || {};
    LEVELS.forEach((L, i) => {
      const b = document.createElement('button'); b.className = 'lv' + (i < (this.completed || 0) ? ' done' : '') + (L.kind === '3d' ? ' l3' : '');
      b.innerHTML = faNum(i + 1) + (stars[i] ? `<span class="st">${'★'.repeat(stars[i])}</span>` : ''); b.title = L.name; b.disabled = i >= this.unlocked;
      b.onclick = () => { Sound.play('click'); this.runStart = performance.now(); this.deaths = 0; this.startLevel(i); };
      g.appendChild(b);
    });
    $('realmBox').hidden = !ST.secret;
    const rg = $('rmGrid'); rg.innerHTML = '';
    REALM.forEach((L, i) => { const b = document.createElement('button'); b.className = 'lv'; b.textContent = '🌀' + faNum(i + 1); b.title = L.name; b.onclick = () => { Sound.play('click'); this.runStart = performance.now(); this.deaths = 0; this.startRealm(i); }; rg.appendChild(b); });
  },
};
function soundLabel() { const t = Sound.on ? '🔊 صدا: روشن' : '🔇 صدا: خاموش'; $('bSound').textContent = t; $('bSound2').textContent = t; }
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
$('bMenu').onclick = $('bMenu2').onclick = () => { Sound.play('click'); app.menu(); };
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
