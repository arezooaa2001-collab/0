/* ============================ CHALLENGE MODIFIERS ============================ */
// Optional twists for every level: darkness, an upside-down screen, a mirrored world (levels run right to left)
// and turbo speed. Each one that is on gives extra XP and gems for every level you win.
const MUTS = [
  ['dark', '🌑', 'تاریکی', 'فقط دور و بر خودت رو می‌بینی (نمای دوبعدی)'],
  ['flip', '🙃', 'دنیای وارونه', 'کل صفحه سر و ته می‌شه؛ کنترل‌ها همون‌طور می‌مونن 😵'],
  ['mirror', '🪞', 'آینه', 'دنیا برعکس می‌شه: مرحله‌ها از راست به چپ (دکمه‌ها هم برعکس)'],
  ['fast', '⚡', 'توربو', 'همه‌چیز ۲۵٪ تندتر'],
  ['clock', '⏳', 'ساعت شنی', 'هر اتاق یه زمان محدود داره؛ تموم بشه، می‌میری! (مرحله‌های دوبعدی)'],
];
/* ---------- hot streak: rooms passed one after another without dying ---------- */
// 3 rooms: gems count double; 6 rooms: triple, and the hero is on fire. A death puts it out.
const hotBonus = () => app.custom || app.duo ? 0 : (app.streak || 0) >= 6 ? 2 : (app.streak || 0) >= 3 ? 1 : 0;
function hotRoom() {
  if (app.custom || app.duo) return;
  app.streak = (app.streak || 0) + 1;
  if (app.streak === 3) setTimeout(() => app.taunt('🔥 داغ شدی! جواهرها دو برابر', '#ff9a3a'), 900);
  if (app.streak === 6) { setTimeout(() => app.taunt('☄️ آتیشی شدی! جواهرها سه برابر', '#ffd36e'), 900); unlockAch('hot'); Sound.play('win'); }
}
function hotLost() { if ((app.streak || 0) >= 3) setTimeout(() => app.taunt('💨 آتیشت خاموش شد…', '#b9b0d9'), 700); app.streak = 0; }
// flames around the hero while the streak lasts
function drawHotAura(world, t) {
  const k = app.streak >= 6 ? 1 : .55, p = world.p, cx = p.x + PW / 2, cy = p.y + PHT / 2;
  if (world.state !== 'play') return;
  if (glowK() > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .45 * k + Math.sin(t * 13) * .08; ctx.drawImage(TEX.gGold, cx - 46, cy - 52, 92, 92); ctx.restore(); }
  if (Math.random() < .5 * k * GFX.fx) world.parts.push({ x: cx + (Math.random() - .5) * 20, y: cy + 8, vx: (Math.random() - .5) * 30 - p.vx * .1, vy: -60 - Math.random() * 70, life: .45, max: .45, size: 2.5 + Math.random() * 2.5, col: Math.random() < .5 ? '#ff7a2a' : '#ffd36e', g: -40, drag: 1.5, add: true });
}
/* ---------- hourglass: a time limit for every room of a 2D level ---------- */
function hourLimit() {
  if (!mutOn('clock') || app.state !== 'play' && app.state !== 'pause' || app.kind !== 'plat' || app.duo || !app.world || !app.world.secs) return 0;
  const sec = app.world.secs[app.world.ck]; return sec ? clamp(Math.round(sec.w * .85), 20, 90) : 0;
}
function hourTick(dt) {
  const lim = hourLimit(); if (!lim) return; const w = app.world;
  if (w.state !== 'play') return;
  const before = lim - app.roomT; app.roomT += dt;
  if (before > 5 && lim - app.roomT <= 5) { Sound.play('click'); app.taunt('⏳ ۵ ثانیه مونده!', '#ff9a8a'); }
  if (app.roomT >= lim) { app.roomT = 0; w.die('time'); }
}
const mutOn = k => !!(ST.mut && ST.mut[k]);
// the rear-view mirror of the 3D runs is drawn into the canvas under an HTML frame: left out while the screen is flipped
const mutScr = () => document.body.classList.contains('mFlip') || document.body.classList.contains('mMirror');
const mutCount = () => MUTS.filter(m => mutOn(m[0])).length;
// the screen effects only while a level is played (not in menus or the editor)
function mutApply(on) {
  const b = document.body;
  b.classList.toggle('mFlip', !!on && mutOn('flip')); b.classList.toggle('mMirror', !!on && mutOn('mirror'));
}
function mutInput(inp) {
  if (!document.body.classList.contains('mMirror')) return inp;
  return { left: inp.right, right: inp.left, jump: inp.jump };
}
function renderMuts() {
  const n = mutCount();
  return `<div class="sec"><h3>🎭 چالش‌های ویژه ${n ? `<small class="mutBonus">هر برد: +${faNum(n * 50)}٪ تجربه و +${faNum(n * 5)} 💎</small>` : ''}</h3>
    <p>روی همه‌ی مرحله‌ها اعمال می‌شن. هر چالشی که روشن باشه جایزه‌ی برد رو بیشتر می‌کنه.</p>
    <div class="muts">${MUTS.map(m => `<button class="mut${mutOn(m[0]) ? ' on' : ''}" data-mut="${m[0]}"><i>${m[1]}</i><b>${m[2]}</b><small>${m[3]}</small></button>`).join('')}</div></div>`;
}

/* ============================ LUCKY WHEEL ============================ */
// One free spin a day, more for a few gems. The prize is drawn first, then the wheel is spun to land on it.
const WHEEL = [
  { t: '💎 ۱۵', w: 22, col: '#3fb8e0', g: 15 },
  { t: '⭐ ۵۰', w: 18, col: '#e0a83f', xp: 50 },
  { t: '💎 ۳۰', w: 16, col: '#33c99b', g: 30 },
  { t: '😈 هیچی!', w: 14, col: '#d9446c', none: true },
  { t: '💎 ۶۰', w: 10, col: '#4a7ae0', g: 60 },
  { t: '⭐ ۱۵۰', w: 8, col: '#c98a2a', xp: 150 },
  { t: '🎁 آیتم', w: 6, col: '#9a5ae0', item: true },
  { t: '💰 ۱۵۰', w: 6, col: '#e0c23f', g: 150 },
];
const SPIN_COST = 25;
const Wheel = {
  rot: 0, busy: false,
  free() { return !ST.wheel || ST.wheel.day !== dayKey(); },
  draw() {
    const c = document.getElementById('wheelCv'); if (!c) return; const g = c.getContext('2d'), R = c.width / 2, n = WHEEL.length, seg = Math.PI * 2 / n;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.translate(R, R);
    g.save(); g.rotate(this.rot);
    WHEEL.forEach((s, i) => {
      const a0 = -Math.PI / 2 + i * seg; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R - 8, a0, a0 + seg); g.closePath();
      g.fillStyle = s.col; g.fill(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.stroke();
      g.save(); g.rotate(a0 + seg / 2); g.translate(R * .6, 0); g.rotate(Math.PI / 2); g.fillStyle = '#fff'; g.font = `bold ${Math.round(R * .12)}px Vazirmatn, Tahoma, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 4; g.fillText(s.t, 0, 0); g.restore();
    });
    for (let i = 0; i < n * 2; i++) { const a = i * seg / 2; g.fillStyle = i % 2 ? '#fff6d8' : '#ffd36e'; g.beginPath(); g.arc(Math.cos(a) * (R - 4), Math.sin(a) * (R - 4), 3.2, 0, 7); g.fill(); }
    g.restore();
    g.fillStyle = '#1c1238'; g.beginPath(); g.arc(0, 0, R * .17, 0, 7); g.fill(); g.strokeStyle = '#ffd36e'; g.lineWidth = 3; g.stroke();
    g.font = `${Math.round(R * .16)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('😈', 0, 2);
    // pointer at the top
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-11, -R - 2); g.lineTo(11, -R - 2); g.lineTo(0, -R + 20); g.closePath(); g.fill(); g.strokeStyle = '#ff5d8a'; g.lineWidth = 2; g.stroke();
  },
  spin() {
    if (this.busy) return;
    const free = this.free();
    if (!free) { if (gemBalance() < SPIN_COST) { app.taunt(`💎 برای چرخوندن ${faNum(SPIN_COST)} جواهر لازم داری`, '#ff9a8a'); Sound.play('die'); return; } ST.spent = (ST.spent || 0) + SPIN_COST; }
    else ST.wheel = { day: dayKey() };
    writeSave(); this.busy = true; renderWheelBtn();
    let tot = 0; for (const s of WHEEL) tot += s.w; let x = Math.random() * tot, k = 0; while (k < WHEEL.length - 1 && (x -= WHEEL[k].w) > 0) k++;
    const n = WHEEL.length, seg = Math.PI * 2 / n, want = -(k + .5) * seg + (Math.random() - .5) * seg * .6;
    const from = this.rot, base = from - (((from % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
    const to = base + Math.PI * 2 * 6 + ((want % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), t0 = performance.now(), dur = 3800;
    let lastSeg = -1;
    const step = now => {
      const u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 4);
      this.rot = from + (to - from) * e; this.draw();
      const sg = Math.floor(((-this.rot / seg) % n + n) % n); if (sg !== lastSeg) { lastSeg = sg; Sound.play('click'); }
      if (u < 1 && app.screen === 'sMissions') return requestAnimationFrame(step);
      this.rot = to; this.draw(); this.busy = false; this.give(WHEEL[k]); renderWheelBtn();
    };
    requestAnimationFrame(step);
  },
  give(s) {
    let msg;
    if (s.none) { msg = '😈 هیچی! ترول شدی… فردا دوباره امتحان کن'; Sound.play('die'); }
    else if (s.g) { ST.gems += s.g; msg = `🎉 ${faNum(s.g)} جواهر بردی!`; Sound.play('win'); }
    else if (s.xp) { XP.add(s.xp); msg = `⭐ ${faNum(s.xp)} امتیاز تجربه گرفتی!`; Sound.play('win'); }
    else if (s.item) {
      const pool = []; for (const tab of Object.keys(SKINS)) for (const it of SKINS[tab]) if (it.p > 0 && !ST.owned[tab + ':' + it.id]) pool.push([tab, it]);
      if (pool.length) { const [tab, it] = pool[Math.floor(Math.random() * pool.length)]; ST.owned[tab + ':' + it.id] = 1; msg = `🎁 جایزه از فروشگاه: ${it.i} ${it.n} (توی فروشگاه بپوشش)`; }
      else { ST.gems += 100; msg = '🎁 همه‌چیز رو داشتی؛ به جاش ۱۰۰ جواهر!'; }
      Sound.play('win');
    }
    writeSave(); app.taunt(msg, s.none ? '#ff9a8a' : '#ffd36e'); const r = document.getElementById('wheelRes'); if (r) r.textContent = msg; Missions.badge();
  },
};
function renderWheelBtn() {
  const b = document.getElementById('bSpin'); if (!b) return;
  b.disabled = Wheel.busy; b.textContent = Wheel.busy ? '…' : Wheel.free() ? '🎡 بچرخون! (مجانی)' : `🎡 بچرخون (💎 ${faNum(SPIN_COST)})`;
}
function renderWheel() {
  $('wheelBox').innerHTML = `<canvas id="wheelCv" width="300" height="300"></canvas><div class="wInfo"><b>🎡 گردونه‌ی شانس</b>
    <small>روزی یه بار مجانی؛ دفعه‌های بعد ${faNum(SPIN_COST)} جواهر. جواهر، تجربه، آیتم فروشگاه… یا هیچی 😈</small>
    <button class="btn primary" id="bSpin"></button><small id="wheelRes"></small></div>`;
  Wheel.draw(); renderWheelBtn();
}
$('wheelBox').addEventListener('click', e => { if (e.target.closest('#bSpin')) { Sound.init(); Wheel.spin(); } });
