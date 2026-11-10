/* ============================ DAILY MISSIONS + DAILY CHEST ============================ */
// Three missions a day (picked from the pool by the date), each paying gems. A chest can be opened once a day;
// coming back on consecutive days grows the reward (7-day streak).
const MISSION_POOL = [
  { id: 'gem', t: n => `${faNum(n)} جواهر جمع کن`, n: [30, 50, 80], r: 25 },
  { id: 'room', t: n => `از ${faNum(n)} اتاق رد شو`, n: [10, 16, 24], r: 25 },
  { id: 'win', t: n => `${faNum(n)} مرحله رو ببر`, n: [1, 2, 3], r: 30 },
  { id: 'clean', t: () => 'یه مرحله رو بدون حتی یک مرگ ببر', n: [1], r: 40 },
  { id: 'pow', t: n => `${faNum(n)} تا پاورآپ بگیر`, n: [3, 5, 8], r: 20 },
  { id: 'dist', t: n => `توی حالت بی‌پایان ${faNum(n)} متر برو`, n: [200, 350, 500], r: 35, max: true },
  { id: 'race1', t: () => 'توی یه مسابقه نفر اول شو', n: [1], r: 40 },
  { id: 'boss', t: () => 'یه غول آخر مرحله رو شکست بده', n: [1], r: 45 },
  { id: 'win3d', t: () => 'یه مرحله رو سه‌بعدی ببر', n: [1], r: 30 },
  { id: 'jump', t: n => `${faNum(n)} بار بپر`, n: [150, 250, 400], r: 15 },
  { id: 'death', t: n => `${faNum(n)} بار بمیر 😈 (آره، درست خوندی!)`, n: [10, 20], r: 15 },
  { id: 'shop', t: () => 'یه چیز از فروشگاه بخر', n: [1], r: 20 },
];
const CHEST_GEMS = [10, 15, 20, 30, 40, 55, 80];
const Missions = {
  // today's missions (created on first use each day)
  today() {
    const d = dayKey(), M = ST.mis || (ST.mis = {});
    if (M.day !== d) {
      const r = srand(d), pool = MISSION_POOL.slice(), list = [];
      while (list.length < 3 && pool.length) { const m = pool.splice(Math.floor(r() * pool.length), 1)[0]; list.push({ id: m.id, n: m.n[Math.floor(r() * m.n.length)], p: 0, done: false, got: false }); }
      M.day = d; M.list = list;
    }
    return M.list;
  },
  def: id => MISSION_POOL.find(m => m.id === id),
  // something happened in the game (v: amount, or the value for "max" missions)
  ev(id, v = 1) {
    let any = false;
    for (const m of this.today()) {
      if (m.id !== id || m.done) continue;
      m.p = this.def(id).max ? Math.max(m.p, v) : m.p + v;
      if (m.p >= m.n) { m.p = m.n; m.done = true; any = true; }
    }
    if (any) { setTimeout(() => app.taunt('🎯 مأموریت روزانه انجام شد! جایزه‌ات رو بگیر', '#9be05a'), 600); Sound.play('win'); this.badge(); writeSave(); }
  },
  claim(i) {
    const m = this.today()[i]; if (!m || !m.done || m.got) return 0;
    const r = this.def(m.id).r; m.got = true; ST.gems += r; XP.add(30); writeSave(); this.badge(); return r;
  },
  // the daily chest: streak of consecutive days
  chestState() {
    const C = ST.chest || (ST.chest = { last: 0, streak: 0 }), d = dayKey();
    const yest = (() => { const x = new Date(); x.setDate(x.getDate() - 1); return x.getFullYear() * 10000 + (x.getMonth() + 1) * 100 + x.getDate(); })();
    const ready = C.last !== d, next = ready ? (C.last === yest ? C.streak % 7 + 1 : 1) : C.streak;
    return { ready, day: next, gems: CHEST_GEMS[(next - 1) % 7] };
  },
  openChest() {
    const s = this.chestState(); if (!s.ready) return 0;
    ST.chest = { last: dayKey(), streak: s.day }; ST.gems += s.gems; writeSave(); this.badge(); return s.gems;
  },
  claimable() { return this.chestState().ready || this.today().some(m => m.done && !m.got); },
  badge() { const b = document.getElementById('bMissions'); if (b) b.classList.toggle('dot', this.claimable()); },
};
function renderMissions() {
  const s = Missions.chestState(), list = Missions.today();
  $('chestBox').innerHTML = `<div class="chest ${s.ready ? 'ready' : ''}"><div class="ci">${s.ready ? '🎁' : '📦'}</div><div><b>${s.ready ? 'صندوق امروز آماده‌ست!' : 'صندوق امروز رو باز کردی'}</b>
      <small>${s.ready ? `روز ${faNum(s.day)} از ۷ · ${faNum(s.gems)} جواهر` : 'فردا دوباره بیا؛ هر روز پشت سر هم جایزه بیشتر می‌شه'}</small></div>
      ${s.ready ? '<button class="btn primary" data-chest>باز کن</button>' : ''}</div>
    <div class="streak">${CHEST_GEMS.map((g, i) => `<span class="${i < (s.ready ? s.day - 1 : s.day) ? 'on' : ''}">${faNum(i + 1)}<i>💎${faNum(g)}</i></span>`).join('')}</div>`;
  $('misList').innerHTML = list.map((m, i) => { const d = Missions.def(m.id), k = Math.min(1, m.p / m.n);
    return `<div class="mis ${m.done ? 'done' : ''}"><div class="mt"><b>${d.t(m.n)}</b><small>جایزه: 💎 ${faNum(d.r)}</small></div>
      <div class="mbar"><i style="transform:scaleX(${k.toFixed(3)})"></i></div><div class="mp">${faNum(Math.floor(m.p))} / ${faNum(m.n)}</div>
      ${m.got ? '<span class="mok">✔ گرفتی</span>' : m.done ? `<button class="btn primary" data-mis="${i}">بگیر</button>` : ''}</div>`; }).join('');
}

/* ---------- player level (XP): everything you do earns experience; every new level pays gems ---------- */
const XP = {
  lvl: xp => Math.floor(Math.sqrt((xp || 0) / 40)) + 1,             // level 2 at 40 XP, 5 at 640, 10 at 3240...
  need: l => (l - 1) * (l - 1) * 40,
  add(n, why) {
    if (!(n > 0)) return; const before = this.lvl(ST.xp); ST.xp = (ST.xp || 0) + Math.round(n); const after = this.lvl(ST.xp);
    if (after > before) { const g = after * 10; ST.gems += g; Sound.play('win'); setTimeout(() => app.taunt(`⭐ سطح ${faNum(after)}! جایزه: ${faNum(g)} جواهر`, '#ffd36e'), 900); if (after >= 5) unlockAch('lvl5'); if (after >= 10) unlockAch('lvl10'); writeSave(); }
    this.ui();
  },
  ui() {
    const el = document.getElementById('xpBox'); if (!el) return; const l = this.lvl(ST.xp), a = this.need(l), b = this.need(l + 1), k = clamp(((ST.xp || 0) - a) / (b - a), 0, 1);
    el.innerHTML = `<b>⭐ سطح ${faNum(l)}</b><span class="xpbar"><i style="transform:scaleX(${k.toFixed(3)})"></i></span><small>${faNum((ST.xp || 0) - a)} / ${faNum(b - a)}</small>`;
  },
};
