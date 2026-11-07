/* ============================ SETTINGS / MODE / RECORDS SCREENS ============================ */
let setTab = 'gfx';
const GFX_LABEL = { auto: 'خودکار', go: 'Go', plus: 'Plus', pro: 'Pro', max: 'Max', ultra: 'Ultra', maxultra: 'Max Ultra' };
const GFX_COL = { auto: '#8fd3ff', go: '#9be05a', plus: '#6ff3c4', pro: '#8fd3ff', max: '#ffd36e', ultra: '#ff8a4c', maxultra: '#ff3d71' };
XTIERS.forEach(([n], i) => { GFX_LABEL['x' + (i + 1)] = n; GFX_COL['x' + (i + 1)] = hslHex(285 - i * 13, .85, .68); });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const chip = (on, label, attrs, col) => `<button class="chip${on ? ' on' : ''}" ${attrs}${col ? ` style="--cc:${col}"` : ''}>${label}</button>`;
const sw = (k, label) => `<div class="ctl"><label>${label}</label><button class="sw${CFG[k] ? ' on' : ''}" data-t="${k}" role="switch" aria-checked="${!!CFG[k]}" aria-label="${esc(label)}"></button></div>`;
const rng = (path, label, min, max, unit = '') => { const v = getPath(path); return `<div class="ctl"><label for="r_${path}">${label}</label><input id="r_${path}" type="range" min="${min}" max="${max}" value="${v}" data-r="${path}"><output>${faNum(v)}${unit}</output></div>`; };
function getPath(p) { const [a, b] = p.split('.'); return b ? CFG[a][b] : CFG[a]; }
function setPath(p, v) { const [a, b] = p.split('.'); if (b) CFG[a][b] = v; else CFG[a] = v; }

function renderSettings(tab) {
  if (tab) setTab = tab;
  const tabs = [['gfx', '🖥️ گرافیک'], ['wx', '🌦️ آب و هوا'], ['route', '⛏️ مسیرها'], ['light', '💡 نور و جلوه'], ['color', '🎨 رنگ‌ها'], ['ctrl', '🔊 صدا و کنترل']];
  $('setTabs').innerHTML = tabs.map(([k, n]) => `<button class="tab${k === setTab ? ' on' : ''}" data-tab="${k}">${n}</button>`).join('');
  let h = '';
  if (setTab === 'gfx') {
    const cur = CFG.gfx === 'auto' ? `خودکار ← ${GFXS[GFXK].n}` : GFXS[GFXK].n;
    h += `<div class="sec"><h3>کیفیت گرافیک</h3><div class="chips">${GFX_ORDER.map(k => chip(CFG.gfx === k, GFX_LABEL[k], `data-gfx="${k}"`, GFX_COL[k])).join('')}</div>
      <p><b>${esc(cur)}</b> — ${esc(CFG.gfx === 'auto' ? 'بر اساس قدرت دستگاهت انتخاب شده' : GFXS[GFXK].d)}</p>
      <p>هر کیفیت روی هر دستگاهی روان می‌مونه: بازی مدام سرعت فریم رو اندازه می‌گیره و اگه دستگاه کند بشه، رزولوشن و بعد جلوه‌ها رو کمی پایین میاره و وقتی دوباره جا باز شد، برمی‌گردونه.</p>
      <p id="perfNow">الان: ${faNum(Perf.fpsShow)} فریم در ثانیه · رزولوشن ${faNum(Math.round(Perf.dyn * 100))}٪${Perf.fxDrop ? ' · جلوه‌ها کم شده' : ''}</p></div>
      <div class="sec"><h3>چی عوض می‌شه؟</h3><p>Go: سبک‌ترین · Plus: سایه‌ی نرم و آینه‌ی عقب · Pro: فیلترهای نور و جزئیات بیشتر · Max: لبه‌های صاف و منظره‌ی کامل · Ultra: رزولوشن بالا، ذرات و درخشش بیشتر · Max Ultra: سایه‌ی واقعی، بیشترین جزئیات و ذرات</p>
      <p><b>۲۰ سطح بالاتر از Max Ultra</b> — هر سطح همه‌ی جلوه‌های سطح قبلی رو داره و یک جزئیات واقعی‌تر اضافه می‌کنه:</p>
      <ol class="tiers">${XTIERS.map(([n, f], i) => `<li${GFXK === 'x' + (i + 1) ? ' class="on"' : ''}><b>${n}</b> ${esc(f)}</li>`).join('')}</ol></div>
      <div class="sec"><h3>نمایش</h3>${sw('fps', 'نمایش FPS')}${sw('timer', 'زمان‌سنج مرحله')}</div>`;
  } else if (setTab === 'wx') {
    const cur = wxCurrent();
    h += `<div class="sec"><h3>آب و هوا</h3><div class="chips">${Object.keys(WX_KINDS).map(k => chip(CFG.weather === k, WX_KINDS[k].i + ' ' + WX_KINDS[k].n, `data-wx="${k}"`)).join('')}</div>
      <p>${CFG.weather === 'auto' ? `خودکار: هوا خودش هر چند وقت یک بار عوض می‌شه و با رنگ‌وبوی هر مرحله جور درمیاد (الان: ${WX_KINDS[cur].i} ${WX_KINDS[cur].n}).` : 'بارون، برف، سیل و طوفان روی هر چهار حالت بازی و مرحله‌های سه‌بعدی دیده می‌شن.'}</p>
      <p>آب و هوا فقط ظاهر و صدای بازی رو عوض می‌کنه؛ سختی مرحله‌ها همون می‌مونه.</p></div>
      <div class="sec"><h3>شدت</h3>${rng('weatherI', 'شدت بارش', 10, 100, '٪')}${sw('wsnd', 'صدای بارون، باد و رعد')}</div>`;
  } else if (setTab === 'route') {
    const U = { auto: 'خودکار', all: 'همه‌ی مرحله‌ها', pick: 'انتخاب دستی', off: 'خاموش' }, u = CFG.under || 'auto';
    const plat = LEVELS.map((d, i) => d.secs ? i : -1).filter(i => i >= 0);
    h += `<div class="sec"><h3>راه زیرزمینی</h3><div class="chips">${Object.keys(U).map(k => chip(u === k, U[k], `data-under="${k}"`)).join('')}</div>
      <p>توی مرحله‌هایی که راه زیرزمینی دارن، وسط مسیر یهو راه می‌ره زیر زمین: سقف سنگی پایین میاد، غار تاریک‌تره و باید مانع‌های زیرزمین رو رد کنی تا دوباره به سطح برسی.</p>
      <p>${u === 'auto' ? `خودکار: ${faNum(AUTO_CAVE.size)} مرحله (${[...AUTO_CAVE].map(i => faNum(i + 1)).join('، ')}) راه زیرزمینی دارن.` : u === 'pick' ? 'مرحله‌هایی که می‌خوای راه زیرزمینی داشته باشن رو انتخاب کن:' : u === 'all' ? 'همه‌ی مرحله‌های سکوبازی راه زیرزمینی دارن.' : 'هیچ مرحله‌ای راه زیرزمینی نداره.'}</p>
      ${u === 'pick' ? `<div class="chips">${plat.map(i => chip((CFG.underLv || []).includes(i), faNum(i + 1), `data-ulv="${i}"`)).join('')}</div>` : ''}
      <p>تغییر از مرحله‌ی بعدی (یا شروع دوباره‌ی مرحله) اعمال می‌شه.</p></div>`;
  } else if (setTab === 'light') {
    h += `<div class="sec"><h3>جلوه‌ی نور</h3><div class="chips">${Object.keys(MOODS).map(k => chip(CFG.mood === k, MOODS[k].n, `data-mood="${k}"`)).join('')}</div>
      ${!GFX.filt && CFG.mood !== 'custom' && CFG.mood !== 'default' ? '<p>روی کیفیت Go و Plus بخشی از جلوه‌ی نور برای حفظ سرعت ساده‌تر نمایش داده می‌شه.</p>' : ''}</div>`;
    if (CFG.mood === 'custom') h += `<div class="sec"><h3>تنظیم دستی نور</h3>${rng('mc.br', 'روشنایی', 50, 150, '٪')}${rng('mc.ct', 'کنتراست', 50, 160, '٪')}${rng('mc.sat', 'اشباع رنگ', 0, 200, '٪')}${rng('mc.hue', 'چرخش رنگ', -180, 180, '°')}
      <div class="ctl"><label for="c_tint">رنگ نور</label><input id="c_tint" type="color" value="${CFG.mc.tint}" data-c="mc.tint"></div>${rng('mc.tintA', 'شدت رنگ نور', 0, 60, '٪')}</div>`;
    h += `<div class="sec"><h3>جلوه‌ها</h3>${sw('bars', 'نوارهای سینمایی')}${sw('grain', 'دانه‌ی فیلم')}${rng('vig', 'تاریکی لبه‌ها', 0, 100, '٪')}${rng('glow', 'درخشش نورها', 0, 150, '٪')}${rng('shake', 'لرزش صفحه', 0, 150, '٪')}</div>`;
  } else if (setTab === 'color') {
    h += `<div class="sec"><h3>پالت آماده</h3><div class="chips">${Object.keys(PALETTES).map(k => chip(CFG.pal === k, PALETTES[k].n, `data-pal="${k}"`)).join('')}${CFG.pal === 'custom' ? chip(true, 'سفارشی', 'disabled') : ''}</div></div>
      <div class="sec"><h3>رنگ دلخواه برای هر چیز</h3><div class="colors">${COLOR_KEYS.map(k => `<div class="crow"><span>${COLOR_NAMES[k]}</span><input type="color" value="${colOf(k)}" data-col="${k}" aria-label="${esc(COLOR_NAMES[k])}"><button data-colreset="${k}" title="پیش‌فرض" aria-label="پیش‌فرض">↺</button></div>`).join('')}</div>
      <p>رنگ‌ها روی هر چهار حالت بازی (دوبعدی، شبه‌سه‌بعدی و سه‌بعدی) اعمال می‌شن.</p><div class="btns" style="max-width:260px;margin:8px auto 0"><button class="btn" data-colall>↺ همه‌ی رنگ‌ها پیش‌فرض</button></div></div>`;
  } else {
    h += `<div class="sec"><h3>صدا</h3>${rng('musicV', 'موسیقی', 0, 100, '٪')}${rng('sfxV', 'جلوه‌های صوتی', 0, 100, '٪')}</div>
      <div class="sec"><h3>کنترل لمسی</h3>${rng('tsize', 'اندازه‌ی دکمه‌ها', 70, 140, '٪')}${rng('topac', 'پررنگی دکمه‌ها', 25, 100, '٪')}${sw('vib', 'لرزش گوشی')}</div>`;
  }
  $('setBody').innerHTML = h;
}
let colTimer = 0;
function colorsChanged() { clearTimeout(colTimer); colTimer = setTimeout(() => { saveCfg(); app.refreshVisuals(); }, 120); }
function gfxChanged() {
  const oldAA = GFX.aa; resolveGfx(); Perf.si = 0; Perf.fxDrop = 0; Perf.reset(2.5);
  if (R3renderer && !!oldAA !== !!GFX.aa) resetRenderer3();
  resize(); app.refreshVisuals();
  // 3D scenery density is baked into the level, so rebuild 3D views
  if (app.def && (app.view === 'x3' || app.view === 'p3')) app.restartView();
}
$('setTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { Sound.play('click'); renderSettings(b.dataset.tab); } });
$('setBody').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; Sound.play('click');
  const d = b.dataset;
  if (d.gfx) { CFG.gfx = d.gfx; saveCfg(); gfxChanged(); applyMood(); }
  else if (d.wx) { CFG.weather = d.wx; if (d.wx === 'auto') WX.autoT = 0; saveCfg(); }
  else if (d.under) { CFG.under = d.under; saveCfg(); }
  else if (d.ulv) { const i = +d.ulv, a = CFG.underLv || (CFG.underLv = []), j = a.indexOf(i); if (j >= 0) a.splice(j, 1); else a.push(i); saveCfg(); }
  else if (d.mood) { CFG.mood = d.mood; saveCfg(); applyMood(); }
  else if (d.t) { CFG[d.t] = !CFG[d.t]; saveCfg(); applyMood(); hudLast = ''; }
  else if (d.pal) { CFG.pal = d.pal; for (const k of COLOR_KEYS) CFG.colors[k] = PALETTES[d.pal].c[k] || ''; colorsChanged(); }
  else if (d.colreset) { CFG.colors[d.colreset] = ''; CFG.pal = 'custom'; colorsChanged(); }
  else if ('colall' in d) { CFG.pal = 'def'; for (const k of COLOR_KEYS) CFG.colors[k] = ''; colorsChanged(); }
  else return;
  renderSettings();
});
$('setBody').addEventListener('input', e => {
  const el = e.target, d = el.dataset;
  if (d.r) {
    setPath(d.r, +el.value); const o = el.nextElementSibling; if (o) o.textContent = faNum(el.value) + (o.textContent.match(/[٪°]$/) || [''])[0];
    if (d.r === 'musicV' || d.r === 'sfxV') Sound.applyVol();
    else if (d.r === 'tsize' || d.r === 'topac') layoutTouch();
    else applyMood();
    saveCfg();
  } else if (d.c) { setPath(d.c, el.value); applyMood(); saveCfg(); }
  else if (d.col) { CFG.colors[d.col] = el.value; CFG.pal = 'custom'; colorsChanged(); }
});
setInterval(() => { const el = document.getElementById('perfNow'); if (el && app.screen === 'sSet') el.textContent = `الان: ${faNum(Perf.fpsShow)} فریم در ثانیه · رزولوشن ${faNum(Math.round(Perf.dyn * 100))}٪${Perf.fxDrop ? ' · جلوه‌ها کم شده' : ''}`; }, 700);

/* game mode picker */
const MODE_PV = {
  classic: '<svg viewBox="0 0 120 50"><rect x="6" y="34" width="44" height="12" fill="#3a2f66"/><rect x="6" y="32" width="44" height="3" fill="#4fd8a8"/><rect x="18" y="22" width="9" height="10" rx="3" fill="#ffe2b8"/><path d="M70 46 L88 14 L96 14 L114 46Z" fill="#4f4580"/><path d="M88 14 L92 14 L92 46 L70 46Z" fill="#5c51a0"/><circle cx="92" cy="30" r="3.5" fill="#ffe2b8"/></svg>',
  '2d': '<svg viewBox="0 0 120 50"><rect x="0" y="36" width="120" height="14" fill="#3a2f66"/><rect x="0" y="34" width="120" height="3" fill="#4fd8a8"/><path d="M50 36 l6 -10 l6 10z" fill="#d8dcf2"/><rect x="20" y="24" width="10" height="11" rx="4" fill="#ffe2b8"/><rect x="96" y="18" width="12" height="17" rx="6" fill="#ffd36e"/></svg>',
  '25': '<svg viewBox="0 0 120 50"><path d="M10 34 L28 22 L118 22 L100 34Z" fill="#4fd8a8" opacity=".7"/><rect x="10" y="34" width="90" height="14" fill="#3a2f66"/><path d="M100 34 L118 22 L118 36 L100 48Z" fill="#251d45"/><rect x="34" y="20" width="10" height="13" rx="4" fill="#ffe2b8"/><path d="M60 34 l6 -10 l6 10z" fill="#d8dcf2"/></svg>',
  '3d': '<svg viewBox="0 0 120 50"><path d="M60 4 L92 18 L60 32 L28 18Z" fill="#8f86d8"/><path d="M28 18 L60 32 L60 48 L28 34Z" fill="#4f4580"/><path d="M92 18 L60 32 L60 48 L92 34Z" fill="#2c2550"/><circle cx="60" cy="16" r="5" fill="#ffe2b8"/></svg>',
};
function renderModes() {
  $('modeList').innerHTML = Object.keys(MODES).map(k => `<button class="mcard${CFG.mode === k ? ' on' : ''}" data-mode="${k}"><div class="pv">${MODE_PV[k]}</div><b>${MODES[k].n}</b><small>${MODES[k].d}</small></button>`).join('');
  $('camBox').innerHTML = `<h3>دوربین سکوبازی‌ها در حالت سه‌بعدی کامل</h3><div class="chips">${chip(CFG.cam3d !== 'third', '🎬 از کنار (پیش‌فرض)', 'data-cam="side"')}${chip(CFG.cam3d === 'third', '🏃 سوم شخص (پشت سر بازیکن)', 'data-cam="third"')}</div>
    <p>${CFG.mode === '3d' ? 'وسط بازی هم با دکمه‌ی دوربین بالای صفحه یا کلید C عوض می‌شه.' : 'این گزینه وقتی حالت «سه‌بعدی کامل» انتخاب شده اثر داره. مرحله‌های فرار از غول همیشه از پشت سر بازیکن دیده می‌شن.'}</p>`;
}
function setCam3d(v) { CFG.cam3d = v; saveCfg(); if (app.p3) app.p3.cs = null; updCamBtn(); }
function updCamBtn() { const b = $('bCam'); b.classList.toggle('on', app.view === 'p3' && app.state !== 'title'); b.style.opacity = CFG.cam3d === 'third' ? 1 : .7; }
$('camBox').addEventListener('click', e => { const b = e.target.closest('[data-cam]'); if (!b) return; Sound.play('click'); setCam3d(b.dataset.cam); renderModes(); });
$('bCam').addEventListener('click', () => { Sound.play('click'); setCam3d(CFG.cam3d === 'third' ? 'side' : 'third'); app.taunt(CFG.cam3d === 'third' ? 'دوربین: سوم شخص 🏃' : 'دوربین: از کنار 🎬', '#9ef9ff'); });
addEventListener('keydown', e => { if (e.code === 'KeyC' && !e.repeat && app.state === 'play' && app.view === 'p3') $('bCam').click(); });
$('modeList').addEventListener('click', e => {
  const b = e.target.closest('[data-mode]'); if (!b) return; Sound.play('click');
  if (CFG.mode === b.dataset.mode) return;
  CFG.mode = b.dataset.mode; saveCfg(); renderModes();
  if (app.def && app.state === 'pause') app.restartView();
});

/* records & achievements */
function renderStats() {
  const pr = progOf(app.diff), stars = pr.stars || {}, best = pr.best || {};
  const won = Object.keys(stars).length, got = ACH.filter(a => ST.ach[a[0]]).length;
  let h = `<div class="kv"><div><b>${faNum(won)}/${faNum(LEVELS.length)}</b><span>مرحله‌ی برده‌شده</span></div><div><b>${faNum(totalStars(app.diff))}</b><span>ستاره (${DIFFS[app.diff].name})</span></div>
    <div><b>${faNum(ST.deaths)}</b><span>کل مرگ‌ها</span></div><div><b>${faNum(ST.gems)}</b><span>جواهر</span></div><div><b>${faNum(Math.floor(ST.time / 60))}</b><span>دقیقه بازی</span></div><div><b>${faNum(got)}/${faNum(ACH.length)}</b><span>دستاورد</span></div></div>
    <div class="sec"><h3>دستاوردها</h3><div class="achs">${ACH.map(a => `<div class="ach${ST.ach[a[0]] ? ' got' : ''}"><i>${ST.ach[a[0]] ? a[1] : '🔒'}</i><div><b>${a[2]}</b><small>${a[3]}</small></div></div>`).join('')}</div></div>
    <div class="sec"><h3>رکورد مرحله‌ها (${DIFFS[app.diff].name})</h3><div class="lvStars">${LEVELS.map((L, i) => `<div title="${esc(L.name)}"><b>${faNum(i + 1)}</b>${stars[i] ? '<span style="color:var(--gold)">' + '★'.repeat(stars[i]) + '</span>' : '—'}<br>${best[i] ? fmtT(best[i]) : ''}</div>`).join('')}</div></div>`;
  $('statsBody').innerHTML = h;
}

/* gem shop: colours, hats and trails */
let shopTab = 'color', shopAnim = 0;
const gemBalance = () => Math.max(0, ST.gems - (ST.spent || 0));
function renderShop(tab) {
  if (tab) shopTab = tab;
  const bal = gemBalance(), cur = skinOf(shopTab).id;
  $('shopBal').textContent = '💎 ' + faNum(bal);
  $('shopTabs').innerHTML = [['color', '🎨 رنگ'], ['hat', '🎩 کلاه'], ['trail', '✨ رد پا']].map(([k, n]) => `<button class="tab${k === shopTab ? ' on' : ''}" data-stab="${k}">${n}</button>`).join('');
  $('shopGrid').innerHTML = SKINS[shopTab].map(it => {
    const own = it.p === 0 || ST.owned[shopTab + ':' + it.id], on = cur === it.id;
    return `<button class="shopit${on ? ' on' : ''}${!own && bal < it.p ? ' poor' : ''}" data-item="${it.id}"><i>${it.i}</i><b>${it.n}</b><small>${on ? '✔ پوشیده' : own ? 'پوشیدن' : '💎 ' + faNum(it.p)}</small></button>`;
  }).join('');
}
function shopPreview() {
  if (app.screen !== 'sShop') { shopAnim = 0; return; }
  const c = $('shopPv'), g = c.getContext('2d'), t = performance.now() / 1000, main = ctx;
  const fw = shopPreview.fw || (shopPreview.fw = { p: { x: 90, y: 0, vx: 200, vy: 0, face: 1, onGround: true }, parts: [], silent: false, state: 'play' });
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
  ctx = g; ctx.setTransform(1.5, 0, 0, 1.5, 0, 0);
  fw.p.x = 61 - PW / 2; fw.p.y = 82 - PHT; emitTrail(fw, t);
  for (let i = fw.parts.length - 1; i >= 0; i--) { const q = fw.parts[i]; q.life -= 1 / 60; if (q.life <= 0) { fw.parts.splice(i, 1); continue; } q.x += (q.vx - 120) / 60; q.y += q.vy / 60; }
  drawParticles(fw);
  ctx.save(); ctx.translate(73, 82); drawHero(t, 1, true, 200, 0, t * 9, 1, false); ctx.restore();
  ctx.fillStyle = 'rgba(111,243,196,.35)'; ctx.fillRect(0, 83, 150, 2);
  ctx = main;
  requestAnimationFrame(shopPreview);
}
$('shopTabs').addEventListener('click', e => { const b = e.target.closest('[data-stab]'); if (b) { Sound.play('click'); renderShop(b.dataset.stab); } });
$('shopGrid').addEventListener('click', e => {
  const b = e.target.closest('[data-item]'); if (!b) return;
  const it = SKINS[shopTab].find(s => s.id === b.dataset.item), key = shopTab + ':' + it.id, own = it.p === 0 || ST.owned[key];
  if (!own) {
    if (gemBalance() < it.p) { Sound.play('click'); b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); return; }
    ST.spent = (ST.spent || 0) + it.p; ST.owned[key] = 1; Sound.play('win');
  } else Sound.play('click');
  ST.wear = Object.assign({}, ST.wear, { [shopTab]: it.id }); writeSave(); renderShop();
});
$('bEndless').onclick = () => { Sound.init(); Sound.play('click'); app.startEndless(); };
$('bOverAgain').onclick = () => { Sound.play('click'); app.startEndless(); };
$('bOverMenu').onclick = () => { Sound.play('click'); app.menu(); };
$('bShop').onclick = () => { Sound.init(); Sound.play('click'); renderShop(); app.open('sShop'); if (!shopAnim) { shopAnim = 1; requestAnimationFrame(shopPreview); } };
