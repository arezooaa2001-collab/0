/* ============================ LEVEL GRADES (S / A / B / C / D) ============================ */
// Every won level gets a grade from deaths, time, gems and style (near misses, first place in races).
// The grade is stamped on the screen before the next level starts; the best grade per level is kept.
const GRADES = ['D', 'C', 'B', 'A', 'S'], GRADE_COL = { S: '#ffd36e', A: '#6ff3c4', B: '#7af7ff', C: '#ffb36b', D: '#b9b0d9' };
const gradeRank = g => GRADES.indexOf(g);
function gradeOf(I) {
  // deaths (40): compared with the number of rooms on 2D levels
  let pd;
  if (I.kind === 'run') pd = I.d === 0 ? 40 : I.d <= 1 ? 30 : I.d <= 3 ? 20 : 8;
  else pd = I.d === 0 ? 40 : I.d <= I.nr * .5 ? 32 : I.d <= I.nr ? 24 : I.d <= I.nr * 2 ? 14 : 6;
  // time (35): against the level's golden time; a run continued from a checkpoint gets a middle score
  let pt = 28;
  if (I.kind !== 'run') { const r = I.t / I.par; pt = I.resumed ? 15 : r <= .8 ? 35 : r <= 1 ? 29 : r <= 1.3 ? 21 : r <= 1.8 ? 12 : 5; }
  // gems (15) and style (10)
  const pg = I.gemTotal ? 15 * clamp(I.gems / I.gemTotal, 0, 1) : 10;
  const ps = Math.min(10, (I.near || 0) * 2.5 + (I.race1 ? 5 : 0) + (I.kind === 'run' && I.d === 0 ? 5 : 0));
  const pts = Math.round(pd + pt + pg + ps);
  return { g: pts >= 90 ? 'S' : pts >= 75 ? 'A' : pts >= 58 ? 'B' : pts >= 40 ? 'C' : 'D', pts, pd, pt, pg: Math.round(pg), ps: Math.round(ps) };
}
function showStamp(G, isNew, gems, line) {
  const el = $('stamp'); el.className = 'fa g' + G.g;
  el.innerHTML = `<div class="sg">${G.g}</div>${line ? `<b>${line}</b>` : ''}<small>💀 ${faNum(G.pd)} · ⏱ ${faNum(G.pt)} · 💎 ${faNum(G.pg)} · 😅 ${faNum(G.ps)} = ${faNum(G.pts)}</small>${isNew ? `<em>بهترین رتبه‌ی جدید!${gems ? ` +${faNum(gems)} 💎` : ''}</em>` : ''}`;
  void el.offsetWidth; el.classList.add('on');
  Sound.play(G.g === 'S' ? 'win' : 'spawn'); if (G.g === 'S' && CFG.vib && navigator.vibrate) navigator.vibrate([30, 40, 60]);
  clearTimeout(showStamp.t); showStamp.t = setTimeout(() => el.classList.remove('on'), 2300);
}
// called from onWin for the main levels: records the grade, pays for new A/S grades
function gradeLevel(app_, t, d, nr, line) {
  const w = app_.world, run = app_.run, plat = app_.kind === 'plat';
  const I = { kind: app_.kind, t, d, nr, par: parTime(app_.def), resumed: app_.resumed, near: app_.levelNear || 0,
    gems: plat ? (w ? w.got.size : 0) : (run ? run.gems : 0), gemTotal: plat ? (w ? w.gemTotal : 0) : (run ? run.picks.filter(k => k.k === 'gem').length : 0),
    race1: app_.raceFirst };
  const G = gradeOf(I), pr = progOf(app_.diff), GR = pr.grade || (pr.grade = {}), old = GR[app_.idx];
  const isNew = !old || gradeRank(G.g) > gradeRank(old); let gems = 0;
  if (isNew) { GR[app_.idx] = G.g; if (G.g === 'S' && (!old || old !== 'S')) gems = 15; else if (G.g === 'A' && (!old || gradeRank(old) < 3)) gems = 5; ST.gems += gems; }
  if (G.g === 'S') { unlockAch('gradeS'); let n = 0; for (const d in app_.prog) n += Object.values(app_.prog[d].grade || {}).filter(x => x === 'S').length; if (n >= 10) unlockAch('gradeS10'); Missions.ev('gradeS'); }
  showStamp(G, isNew, gems, line);
  return G;
}

/* ============================ START BOOSTERS ============================ */
// Bought with gems before a level (one level at a time): they work like the power-ups found in the levels.
const REVIVE_GEMS = 30;
const BOOSTS = [['shield', 20, 'یه بار از مرگ نجاتت می‌ده'], ['magnet', 15, 'جواهرها میان سمتت'], ['slow', 15, 'تله‌ها آهسته‌تر'], ['star', 25, 'چند ثانیه شکست‌ناپذیر']];
let boostSel = {};
function renderBoost() {
  const el = $('boostBar'); if (!el) return; const tot = BOOSTS.reduce((a, b) => a + (boostSel[b[0]] ? b[1] : 0), 0);
  el.innerHTML = `<span class="bl">🎒 بوستر برای مرحله‌ی بعد:</span>${BOOSTS.map(([k, c, d]) => `<button class="chip${boostSel[k] ? ' on' : ''}" data-boost="${k}" title="${d}" style="--cc:${POWS[k].col}">${POWS[k].i} ${POWS[k].n} <small>💎${faNum(c)}</small></button>`).join('')}
    <span class="bl">${tot ? `جمع: 💎 ${faNum(tot)} از ${faNum(gemBalance())}` : 'سه‌بعدی‌ها فقط سپر رو می‌گیرن'}</span>`;
}
$('boostBar').addEventListener('click', e => {
  const b = e.target.closest('[data-boost]'); if (!b) return; Sound.play('click'); const k = b.dataset.boost;
  if (!boostSel[k]) { const tot = BOOSTS.reduce((a, x) => a + (boostSel[x[0]] ? x[1] : 0), 0) + BOOSTS.find(x => x[0] === k)[1]; if (tot > gemBalance()) { app.taunt('💎 جواهرت کافی نیست', '#ff9a8a'); return; } }
  boostSel[k] = !boostSel[k]; renderBoost();
});
function boostApply() {
  const ks = BOOSTS.filter(b => boostSel[b[0]]); if (!ks.length) return;
  const w = app.kind === 'plat' ? app.world : null, run = app.kind === 'run' ? app.run : null, used = [];
  let cost = 0;
  for (const [k, c] of ks) {
    if (run && k !== 'shield') continue;
    if (cost + c > gemBalance()) break;
    cost += c; used.push(POWS[k].i);
    if (w) { if (k === 'shield') w.p.shield = true; else w.p[POWS[k].t] = POWS[k].dur + 3; }
    else if (run) run.p.shield = true;
  }
  boostSel = {};
  if (!cost) return;
  ST.spent = (ST.spent || 0) + cost; writeSave();
  setTimeout(() => app.taunt(`🎒 بوستر فعال شد: ${used.join(' ')}`, '#9ef9ff'), 2300);
}

/* ============================ EMOTES ============================ */
// A speech bubble over the hero (keys 1–4; in two-player mode the right player uses 7–0). Just for fun.
const EMOTES = ['😂', '😎', '😡', '👋', '🤡', '😱'];
function emote(world, i) {
  if (!world || world.silent || world.state === 'dead') return;
  world.emote = { i: EMOTES[i % EMOTES.length], t0: world.time }; Sound.play('click');
}
function drawEmote(world) {
  const E = world.emote; if (!E) return; const a = world.time - E.t0; if (a > 1.9 || a < 0) { if (a > 1.9) world.emote = null; return; }
  const p = world.p, k = Math.min(1, a * 6), out = a > 1.6 ? 1 - (a - 1.6) / .3 : 1, s = (.6 + .4 * k) * (1 + Math.sin(a * 9) * .03);
  const x = p.x + PW / 2, y = p.g > 0 ? p.y - 30 : p.y + PHT + 30;
  ctx.save(); ctx.globalAlpha = out; ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-24, -26, 48, 40, 14) : ctx.rect(-24, -26, 48, 40); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-6, 13); ctx.lineTo(0, 22); ctx.lineTo(6, 13); ctx.fill();
  ctx.font = '26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(E.i, 0, -5);
  ctx.restore();
}
addEventListener('keydown', e => {
  if (app.state !== 'play' || e.repeat) return;
  const d = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5 }[e.code], d2 = { Digit7: 0, Digit8: 1, Digit9: 2, Digit0: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[e.code];
  if (app.duo) { if (d != null) emote(app.duo.w[0], d); else if (d2 != null) emote(app.duo.w[1], d2); }
  else if (d != null && app.kind === 'plat') emote(app.world, d);
});
$('bEmote').onclick = () => { Sound.init(); $('emoteBar').classList.toggle('on'); };
$('emoteBar').innerHTML = EMOTES.map((e, i) => `<button data-emo="${i}">${e}</button>`).join('');
$('emoteBar').addEventListener('click', e => { const b = e.target.closest('[data-emo]'); if (!b) return; emote(app.kind === 'plat' ? app.world : null, +b.dataset.emo); $('emoteBar').classList.remove('on'); });

/* ============================ TITLES ============================ */
// Achievements unlock titles; the chosen one is shown under your level on the title screen.
const TITLES = { first: 'تازه‌کار', ten: 'ماجراجو', twenty: 'کهنه‌کار', all: 'فاتح تله‌زار', clean: 'بی‌خطا', insane: 'دیوانه', boss: 'غول‌کُش', bossAll: 'پادشاه غول‌ها',
  rush: 'قهرمان میدان', d500: 'خستگی‌ناپذیر', maker: 'سازنده', robot: 'ربات‌باز', duo: 'رفیق‌باز', cards: 'دانشنامه‌نویس', near50: 'مو به مو', gradeS: 'ستاره‌ی S',
  gradeS10: 'افسانه', champ: 'قهرمان مسابقه', endless: 'ماراتن‌باز', speed: 'برق‌آسا', portal: 'کاشف', realm: 'ارباب ابعاد', lvl10: 'استاد' };
const titleOf = () => ST.title && ST.ach[ST.title] && TITLES[ST.title] ? TITLES[ST.title] : '';
function renderTitles() {
  const got = Object.keys(TITLES).filter(k => ST.ach[k]);
  return `<p class="sub small">هر دستاورد یه لقب بهت می‌ده. لقبی که انتخاب کنی زیر سطحت توی منوی اصلی نشون داده می‌شه.</p>
    <div class="chips titles">${Object.keys(TITLES).map(k => { const a = ACH.find(x => x[0] === k), on = ST.title === k, has = !!ST.ach[k];
      return `<button class="chip${on ? ' on' : ''}${has ? '' : ' locked'}" data-title="${k}" title="${a ? a[3] : ''}">${has ? (a ? a[1] : '🏷️') : '🔒'} ${TITLES[k]}</button>`; }).join('')}</div>
    <p class="sub small">${faNum(got.length)} از ${faNum(Object.keys(TITLES).length)} لقب باز شده.</p>`;
}
$('statsBody').addEventListener('click', e => {
  const b = e.target.closest('[data-title]'); if (!b) return; const k = b.dataset.title;
  if (!ST.ach[k]) { Sound.play('click'); const a = ACH.find(x => x[0] === k); app.taunt(`🔒 برای این لقب: ${a ? a[3] : ''}`, '#ffd36e'); return; }
  Sound.play('spawn'); ST.title = ST.title === k ? null : k; writeSave(); renderStats('titles'); XP.ui();
});
