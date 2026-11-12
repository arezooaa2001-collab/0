/* ============================ TRAP ENCYCLOPEDIA ============================ */
// Every kind of trap you die to opens its card (with a few gems the first time) and counts how often it got you.
const TRAPS = [
  ['spike', '🔺', 'خار معمولی', 'ساده‌ترین تله‌ی دنیا… و هنوزم کار می‌کنه.'],
  ['hspike', '🙈', 'خار پنهان', 'اونجا نبود… تا وقتی که بود!'],
  ['cspike', '🔻', 'خار سقفی', 'سقف هم با تو دشمنه.'],
  ['fspike', '☄️', 'خار ریزان', 'همیشه بالای سرت رو هم نگاه کن.'],
  ['mspike', '🧱', 'دیوار خاردار', 'خارهایی که راه می‌رن و دنبالت می‌کنن.'],
  ['arrow', '🏹', 'تیر پرنده', 'از جایی که فکرش رو نمی‌کنی شلیک می‌شه.'],
  ['saw', '⚙️', 'اره', 'می‌چرخه، می‌بُره، پشیمون هم نمی‌شه.'],
  ['psaw', '🔁', 'اره‌ی گشت‌زن', 'میره و میاد… درست وقتی که تو رد می‌شی.'],
  ['osaw', '🌀', 'اره‌ی چرخان', 'دور خودش می‌چرخه و دور تو هم.'],
  ['laser', '🔴', 'لیزر', 'روشن، خاموش، روشن… بوم!'],
  ['lava', '🌋', 'گدازه', 'شنا ممنوع!'],
  ['crush', '🪨', 'له‌شدگی', 'یه چیز خیلی سنگین تو رو با زمین یکی کرد.'],
  ['fall', '🕳️', 'چاله‌ی بی‌ته', 'هنوزم داری می‌افتی…'],
  ['boss', '🗿', 'غول آخر مرحله', 'نزدیکش نشو! دکمه‌های قرمز رو بزن.'],
  ['caught', '👹', 'غول تعقیب‌گر', 'گفتم بدو! (مرحله‌های سه‌بعدی)'],
  ['fall3', '🌌', 'پرت شدن از جاده', 'جاده تموم شد، تو هنوز داشتی می‌دویدی.'],
];
const TRAP_GEMS = 5;
function trapKind(cause, e) {
  if (cause === 'spike') {
    if (!e) return 'spike';
    if (e.popped) return 'hspike';
    if (e.falling || e.landed) return 'fspike';
    if (e.par || e.patrol || (e.moves && e.moves.length) || e.dx || e.dy) return 'mspike';
    return e.dir === 'down' ? 'cspike' : 'spike';
  }
  if (cause === 'saw') return e && (e.orbit || e.pend) ? 'osaw' : e && e.patrol0 ? 'psaw' : 'saw';
  return TRAPS.some(t => t[0] === cause) ? cause : null;
}
function trapSeen(cause, e) {
  const k = trapKind(cause, e); if (!k) return;
  const D = ST.dc || (ST.dc = {}), first = !D[k]; D[k] = (D[k] || 0) + 1;
  if (app.idx >= 0 && !app.custom && !app.endless && app.realmIdx < 0) { const L = ST.dl || (ST.dl = {}); L[app.idx] = (L[app.idx] || 0) + 1; }
  if (first) {
    const t = TRAPS.find(x => x[0] === k); ST.gems += TRAP_GEMS;
    setTimeout(() => app.taunt(`📖 کارت تازه: ${t[1]} ${t[2]}  (+${faNum(TRAP_GEMS)} 💎)`, '#c59bff'), 1000);
    if (TRAPS.every(x => D[x[0]])) unlockAch('cards');
    writeSave();
  }
}
function renderTraps() {
  const D = ST.dc || {}, got = TRAPS.filter(t => D[t[0]]).length, L = ST.dl || {};
  let top = null; for (const t of TRAPS) if (D[t[0]] && (!top || D[t[0]] > D[top[0]])) top = t;
  let lv = -1; for (const k in L) if (lv < 0 || L[k] > L[lv]) lv = +k;
  return `<div class="kv"><div><b>${faNum(got)}/${faNum(TRAPS.length)}</b><span>کارت پیدا شده</span></div>
    <div><b>${top ? top[1] : '—'}</b><span>${top ? `قاتل اصلی: ${top[2]} (${faNum(D[top[0]])} بار)` : 'هنوز نمردی!'}</span></div>
    <div><b>${lv >= 0 ? faNum(lv + 1) : '—'}</b><span>${lv >= 0 ? `مرگبارترین مرحله (${faNum(L[lv])} مرگ)` : 'مرگبارترین مرحله'}</span></div></div>
    <p class="sub small">هر تله‌ای که اولین بار باهاش بمیری کارتش اینجا باز می‌شه و ${faNum(TRAP_GEMS)} جواهر جایزه می‌گیری.</p>
    <div class="cards">${TRAPS.map(t => D[t[0]] ? `<div class="card got"><i>${t[1]}</i><b>${t[2]}</b><small>${t[3]}</small><span>💀 ${faNum(D[t[0]])}</span></div>`
      : `<div class="card"><i>❔</i><b>؟؟؟</b><small>هنوز این تله گیرت ننداخته…</small></div>`).join('')}</div>`;
}
