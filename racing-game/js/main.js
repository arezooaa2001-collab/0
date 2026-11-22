// قهرمان پیست — فایل اصلی: مدیریت صفحه‌ها، منوها، گاراژ، شخصی‌سازی، تنظیمات، نور و کد مخفی
import * as THREE from 'three';
import { Engine, QUALITY, TIMES } from './engine.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { SaveStore } from './save.js';
import { HUD } from './ui.js';
import { Showcase } from './showcase.js';
import { Garage } from './garage.js';
import { Race, stageInfo, rivalProfiles, COINS } from './race.js';
import { Track, TEAM_NAMES } from './track.js';
import { CARS, CUSTOM, PAINTS, UPGRADES, MAX_UP, upgradeCost, carStats, defaultCustom, defaultUpgrades, looksScore, carById, carIndex } from './cars.js';
import { toFa, fromFa, fmtNum, isTouch, clamp } from './utils.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['loading', 'menu', 'stage', 'hud', 'pause', 'judge', 'results', 'replay', 'shop', 'custom', 'settings', 'secret', 'light'];

class App {
  constructor() { this.mode = 'none'; this.last = performance.now(); this.stageSel = 1; this.gi = 0; this.cTab = 'look'; }

  async boot() {
    this.loadProgress(0.05, 'بارگذاری فونت‌ها');
    try { await Promise.race([document.fonts.load("900 40px 'Vazirmatn'"), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* ادامه */ }
    this.save = new SaveStore(); this.save.load();
    this.save.onRemote = () => { this.refreshMenu(); this.updateShowcaseCar(); };
    const S = this.save.data;
    this.loadProgress(0.2, 'راه‌اندازی موتور گرافیکی');
    this.engine = new Engine($('gl'), S.settings);
    this.audio = new AudioSys(); this.audio.volume = S.settings.volume;
    this.input = new Input(); this.input.bindTouch($('touch'));
    this.hud = new HUD(this);
    this.ui = {
      onPhase: (p, r) => this.hud.onPhase(p, r), countdown: (n) => this.hud.countdown(n), toast: (t) => this.hud.toast(t),
      hud: (r, dt) => this.hud.update(r, dt), togglePause: () => this.togglePause(), replayHud: (r, t, tot) => this.hud.replayHud(r, t, tot),
      replayDone: () => {}, onReplayEnd: () => {}
    };
    this.loadProgress(0.45, 'ساخت صحنه منو');
    await tick();
    this.showcase = new Showcase(this);
    this.updateShowcaseCar();
    this.applyLight();
    this.loadProgress(0.8, 'آماده‌سازی منوها');
    this.bindMenus(); this.bindStage(); this.bindRaceUI(); this.bindShop(); this.bindCustom(); this.bindSettings(); this.bindSecret(); this.bindLight();
    this.refreshMenu();
    this.loadProgress(1, 'آماده!');
    requestAnimationFrame((t) => this.loop(t));
    await tick(); this.go('menu'); this.booted = true;
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.race && this.mode === 'race' && !this.race.paused && this.race.phase !== 'results' && this.race.phase !== 'replay') this.togglePause(true); });
    const unlockAudio = () => { this.audio.init(); window.removeEventListener('pointerdown', unlockAudio); };
    window.addEventListener('pointerdown', unlockAudio);
  }

  loadProgress(f, text) { $('loadBar').style.width = Math.round(f * 100) + '%'; $('loadText').textContent = text; }

  show(...ids) { for (const s of SCREENS) $(s).classList.toggle('show', ids.includes(s)); }

  go(name) {
    if (this.booted) this.audio.init();
    if (name === 'menu') { this.mode = 'showcase'; this.applyLight(); this.show('menu'); this.refreshMenu(); this.garage && (this.garage.active = false); }
    else if (name === 'stage') { this.mode = 'showcase'; this.stageSel = this.save.data.stage || this.save.data.maxStage; this.renderStage(); this.show('stage'); }
    else if (name === 'shop') { this.ensureGarage(); this.mode = 'garage'; this.garage.active = true; this.garage.inside = false; this.gi = carIndex(this.save.data.selected); this.renderShop(); this.show('shop'); }
    else if (name === 'custom') { this.ensureGarage(); this.mode = 'garage'; this.garage.active = true; this.garage.inside = false; this.renderCustom(true); this.show('custom'); }
    else if (name === 'settings') { this.mode = 'none'; this.renderSettings(); this.show('settings'); }
    else if (name === 'light') { this.mode = 'showcase'; this.renderLight(); this.show('light'); }
  }

  ensureGarage() { if (!this.garage) this.garage = new Garage(this); }

  // برای آزمایش خودکار: جلو بردن شبیه‌سازی بدون رندر هر فریم
  advance(sec, step = 1 / 30) {
    const n = Math.max(1, Math.round(sec / step));
    for (let k = 0; k < n; k++) {
      if (this.race && this.mode === 'race') { this.race.skipDraw = k < n - 1; this.race.update(step); this.race.skipDraw = false; }
      else if (this.mode === 'garage' && this.garage) { if (k === n - 1) this.garage.update(step); }
      else if (this.mode === 'showcase' && k === n - 1) this.showcase.update(step);
      this.input.clearPressed();
    }
  }
  loop(t) {
    const dt = Math.min(0.1, (t - this.last) / 1000); this.last = t;
    if (this.manual) { requestAnimationFrame((tt) => this.loop(tt)); return; }
    try {
      if (this.mode === 'race' && this.race) this.race.update(dt);
      else if (this.mode === 'garage' && this.garage) this.garage.update(dt);
      else if (this.mode === 'showcase') this.showcase.update(dt);
      if (this.mode !== 'none') this.engine.trackPerf(dt);
    } catch (e) { console.error(e); }
    this.input.clearPressed();
    requestAnimationFrame((tt) => this.loop(tt));
  }

  // ---------------- منوی اصلی ----------------
  bindMenus() {
    document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => this.go(b.dataset.go)));
  }
  refreshMenu() {
    const S = this.save.data;
    $('mCoins').textContent = fmtNum(S.coins); $('mLevel').textContent = toFa(S.maxStage); $('mCar').textContent = carById(S.selected).name;
    document.querySelectorAll('.coins-v').forEach((e) => { e.textContent = fmtNum(S.coins); });
  }
  updateShowcaseCar() { const S = this.save.data; const def = carById(S.selected); this.showcase.setCar(def, S.custom[def.id] || defaultCustom(def)); this.applyLight(); }
  lightTimeFor(level) { const L = this.save.data.light; return L.time === 'auto' ? stageInfo(level || this.save.data.maxStage, 'auto').time : L.time; }
  applyLight() { this.showcase.applyLight(this.lightTimeFor(), this.save.data.light); }

  // ---------------- انتخاب مرحله ----------------
  bindStage() {
    $('stPrev').addEventListener('click', () => { this.stageSel = Math.max(1, this.stageSel - 1); this.renderStage(); });
    $('stNext').addEventListener('click', () => { this.stageSel = Math.min(this.save.data.maxStage, this.stageSel + 1); this.renderStage(); });
    $('stGo').addEventListener('click', () => this.startStage(this.stageSel));
  }
  renderStage() {
    const lv = this.stageSel; const info = stageInfo(lv, this.save.data.light.time);
    const tr = new Track(lv);
    const rv = rivalProfiles(lv);
    const rc = [...new Set(rv.map((r) => r.carDef.name))].slice(0, 4).join('، ');
    $('stNum').textContent = toFa(lv); $('stOf').textContent = 'از ۱۰۰۰ • باز تا مرحله ' + toFa(this.save.data.maxStage);
    $('stPrev').disabled = lv <= 1; $('stNext').disabled = lv >= this.save.data.maxStage;
    const strength = Math.round(rv.reduce((a, r) => a + r.stats.vmax, 0) / rv.length * 3.6);
    let boss = '';
    if (info.bossLevel) boss = `<div class="it boss"><small>مرحله ویژه</small><b>${info.judged ? '👑 رئیس کل پیست کنار طرفدارهای تو می‌نشیند و قدرت، سرعت و ظاهر ماشینت را داوری می‌کند!' : '🌈 رئیس کل پیست برای تماشا کنار طرفدارهای تیم ' + TEAM_NAMES[info.bossTeam] + ' می‌نشیند.'}</b></div>`;
    $('stInfo').innerHTML = `
      <div class="it"><small>پیست</small><b>${tr.name}</b></div>
      <div class="it"><small>طول مسیر</small><b>${toFa((tr.length / 1000).toFixed(2))} کیلومتر</b></div>
      <div class="it"><small>تعداد دور</small><b>${toFa(info.laps)}</b></div>
      <div class="it"><small>زمان روز</small><b>${TIMES[info.time].label}</b></div>
      <div class="it"><small>تعداد پیچ</small><b>${toFa(tr.corners.length)}</b></div>
      <div class="it"><small>سرعت رقبا</small><b>حدود ${toFa(strength)} کیلومتر</b></div>
      <div class="it" style="grid-column:1/-1"><small>ماشین رقبا</small><b>${rc}</b></div>
      <div class="it" style="grid-column:1/-1"><small>ماشین تو</small><b>${carById(this.save.data.selected).name} • حداکثر ${toFa(Math.round(carStats(carById(this.save.data.selected), this.save.data.upgrades[this.save.data.selected]).vmax * 3.6))} کیلومتر</b></div>
      ${boss}`;
  }

  async startStage(level) {
    this.audio.init();
    if (this.race) { this.race.dispose(); this.race = null; }
    this.mode = 'none'; this.show('loading'); this.loadProgress(0, 'ساخت مرحله ' + toFa(level));
    this.save.data.stage = level; this.save.save();
    await tick();
    const race = new Race(this, { level });
    try { await race.build((f, t) => this.loadProgress(f, t)); } catch (e) { console.error(e); this.loadProgress(1, 'خطا در ساخت مرحله: ' + e.message); return; }
    this.race = race;
    const S = this.save.data.settings;
    const touchOn = S.touch === 'on' || (S.touch === 'auto' && isTouch());
    $('touch').classList.toggle('show', touchOn); $('hud').classList.toggle('touchmode', touchOn);
    $('hBoard').innerHTML = ''; $('hCount').textContent = '';
    this.show('hud');
    this.mode = 'race';
    race.begin();
  }

  // ---------------- رابط مسابقه ----------------
  bindRaceUI() {
    $('hCam').addEventListener('click', () => this.race?.cycleCamera());
    $('hReset').addEventListener('click', () => this.race?.phase === 'race' && this.race.resetPlayer());
    $('hPause').addEventListener('click', () => this.togglePause());
    $('hSkip').addEventListener('click', () => { if (this.race) this.race.skipFlag = true; });
    $('pResume').addEventListener('click', () => this.togglePause(false));
    $('pCam').addEventListener('click', () => this.race?.cycleCamera());
    $('pRestart').addEventListener('click', () => { const lv = this.race.cfg.level; this.togglePause(false); this.startStage(lv); });
    $('pExit').addEventListener('click', () => { this.togglePause(false); this.exitRace(); });
    $('rReplay').addEventListener('click', () => { if (this.race?.startReplay()) { this.show('replay'); } });
    $('rNext').addEventListener('click', () => this.startStage(Math.min(1000, this.race.cfg.level + 1)));
    $('rRetry').addEventListener('click', () => this.startStage(this.race.cfg.level));
    $('rMenu').addEventListener('click', () => this.exitRace());
    // پخش ویدیو
    const speeds = [0.5, 1, 2, 4]; const cams = ['auto', 'tv', 'chase', 'heli', 'cockpit', 'wheel', 'fans', 'top'];
    $('rpPlay').addEventListener('click', () => { const rp = this.race.rp; if (!rp.playing && rp.t >= (this.race.record.frames.length - 1) * this.race.record.dt) rp.t = 0; rp.playing = !rp.playing; });
    $('rpSpeed').addEventListener('click', () => { const rp = this.race.rp; rp.speed = speeds[(speeds.indexOf(rp.speed) + 1) % speeds.length]; $('rpSpeed').textContent = toFa(rp.speed) + '×'; });
    $('rpCam').addEventListener('click', () => { const rp = this.race.rp; rp.cam = cams[(cams.indexOf(rp.cam) + 1) % cams.length]; this.race.camInit = false; rp.spot = null; $('rpCam').textContent = 'دوربین: ' + { auto: 'خودکار', tv: 'تلویزیونی', chase: 'تعقیب', heli: 'هلیکوپتر', cockpit: 'داخل ماشین', wheel: 'کنار چرخ', fans: 'تماشاگران', top: 'از بالا' }[rp.cam]; });
    $('rpTarget').addEventListener('click', () => { const r = this.race; const rp = r.rp; rp.target = (rp.target + 1) % r.racers.length; const t = r.racers[rp.target]; $('rpTarget').textContent = 'دنبال: ' + (t.isPlayer ? 'تو' : t.name); r.camInit = false; rp.spot = null; });
    $('rpExit').addEventListener('click', () => { this.race.endReplay(); this.show('hud', 'results'); this.hud.showResults(this.race.result, this.race, this.lastResultInfo); });
    // نگاه به اطراف در دید داخل ماشین با کشیدن انگشت/موس
    const el = this.engine.renderer.domElement; let drag = false, lx = 0, ly = 0;
    el.addEventListener('pointerdown', (e) => { if (this.mode === 'race') { drag = true; lx = e.clientX; ly = e.clientY; } });
    window.addEventListener('pointerup', () => { drag = false; if (this.race) { this.race.dragLook = 0; this.race.dragPitch = 0; } });
    window.addEventListener('pointermove', (e) => {
      if (!drag || !this.race) return;
      this.race.dragLook = clamp((this.race.dragLook || 0) - (e.clientX - lx) * 0.004, -1.2, 1.2);
      this.race.dragPitch = clamp((this.race.dragPitch || 0) - (e.clientY - ly) * 0.004, -0.8, 0.5);
      lx = e.clientX; ly = e.clientY;
    });
    window.addEventListener('keydown', (e) => { if (e.code === 'Enter' && this.race && (this.race.phase === 'boss' || this.race.phase === 'intro')) this.race.skipFlag = true; });
  }
  togglePause(force) {
    const r = this.race; if (!r || r.phase === 'results' || r.phase === 'replay') return;
    r.paused = force !== undefined ? force : !r.paused;
    $('pause').classList.toggle('show', r.paused);
    if (r.paused) this.audio.silence();
  }
  exitRace() {
    if (this.race) { this.race.dispose(); this.race = null; }
    this.audio.silence();
    this.go('menu');
  }
  onRaceResult(result, race) {
    const S = this.save.data; const lv = race.cfg.level; const place = result.place;
    const coins = COINS[place - 1] || 0;
    S.coins += coins; S.stats.races++; if (place === 1) S.stats.wins++; if (place <= 3) S.stats.podiums++;
    let advanced = false;
    if (place <= 3 && lv >= S.maxStage && lv < 1000) { S.maxStage = lv + 1; advanced = true; }
    S.stage = Math.min(S.maxStage, place <= 3 ? lv + 1 : lv);
    this.save.save(); this.refreshMenu();
    this.lastResultInfo = { coins, advanced, total: S.coins };
    const newCars = advanced ? CARS.filter((c) => c.unlock === S.maxStage) : [];
    setTimeout(() => {
      if (this.race !== race) return;
      this.hud.showResults(result, race, this.lastResultInfo);
      if (newCars.length) this.hud.toast('ماشین جدید قابل خرید شد: ' + newCars.map((c) => c.name).join('، '));
    }, 1400);
  }

  // ---------------- گاراژ: خرید و دیدن ماشین ----------------
  bindShop() {
    $('gPrev').addEventListener('click', () => { this.gi = (this.gi - 1 + CARS.length) % CARS.length; this.renderShop(); });
    $('gNext').addEventListener('click', () => { this.gi = (this.gi + 1) % CARS.length; this.renderShop(); });
    $('gAction').addEventListener('click', () => this.shopAction());
    $('gInside').addEventListener('click', () => { const on = this.garage.toggleInside(); $('gInside').textContent = on ? 'نمای بیرون' : 'نمای داخل ماشین'; });
  }
  carState(c) {
    const S = this.save.data;
    const owned = S.owned.includes(c.id); const unlocked = c.unlock <= S.maxStage;
    return { owned, unlocked, visible: owned || unlocked || S.viewAll, selected: S.selected === c.id };
  }
  statBars(c) {
    const st = carStats(c, this.save.data.upgrades[c.id] || defaultUpgrades());
    const rows = [['سرعت', st.vmax * 3.6 / 480, toFa(Math.round(st.vmax * 3.6)) + ' km'], ['شتاب', st.acc / 14, toFa(st.acc.toFixed(1))], ['فرمان‌پذیری', st.grip / 2.1, toFa(st.grip.toFixed(2))], ['ترمز', st.brake / 17, toFa(st.brake.toFixed(1))]];
    return rows.map(([n, f, v]) => `<div class="stat"><span>${n}</span><div class="sb"><i style="width:${Math.round(clamp(f, 0.03, 1) * 100)}%"></i></div><span>${v}</span></div>`).join('');
  }
  renderShop() {
    const c = CARS[this.gi]; const st = this.carState(c); const S = this.save.data;
    this.garage.inside = false; $('gInside').textContent = 'نمای داخل ماشین';
    this.garage.setCar(c, S.custom[c.id] || defaultCustom(c), { covered: !st.visible });
    $('gIdx').textContent = toFa(this.gi + 1) + ' از ' + toFa(CARS.length) + (this.gi === 0 ? ' • ضعیف‌ترین' : this.gi === CARS.length - 1 ? ' • قوی‌ترین' : '');
    $('gName').textContent = st.visible ? c.name : '؟ ؟ ؟';
    $('gClass').textContent = st.visible ? 'کلاس ' + c.class : 'ماشین مخفی';
    $('gStats').innerHTML = st.visible ? this.statBars(c) : '<p class="hint">مشخصات این ماشین پنهان است.</p>';
    $('gInside').style.display = st.visible ? '' : 'none';
    const s = $('gStatus'); const a = $('gAction'); a.disabled = false;
    s.className = 'g-status';
    if (st.owned) { s.textContent = st.selected ? 'این ماشین الان ماشین توست ✓' : 'این ماشین را داری'; s.classList.add('own'); a.textContent = st.selected ? 'انتخاب شده' : 'انتخاب این ماشین'; a.disabled = st.selected; }
    else if (st.unlocked) { s.textContent = 'قابل خرید است • قیمت: ' + fmtNum(c.price) + ' سکه'; a.textContent = S.coins >= c.price ? 'خرید با ' + fmtNum(c.price) + ' سکه' : 'سکه کافی نداری (' + fmtNum(c.price) + ')'; a.disabled = S.coins < c.price; }
    else { s.textContent = '🔒 قفل است • در سطح ' + toFa(c.unlock) + ' قابل خرید می‌شود (با پول باز نمی‌شود)'; s.classList.add('lock'); a.textContent = 'قفل'; a.disabled = true; }
  }
  shopAction() {
    const c = CARS[this.gi]; const st = this.carState(c); const S = this.save.data;
    if (st.owned) { S.selected = c.id; }
    else if (st.unlocked && S.coins >= c.price) {
      S.coins -= c.price; S.owned.push(c.id); S.selected = c.id;
      S.custom[c.id] = S.custom[c.id] || defaultCustom(c); S.upgrades[c.id] = S.upgrades[c.id] || defaultUpgrades();
      this.hud.toast('تبریک! ' + c.name + ' مال تو شد');
    } else return;
    this.save.save(); this.refreshMenu(); this.renderShop(); this.updateShowcaseCar();
  }

  // ---------------- شخصی‌سازی ----------------
  bindCustom() {
    document.querySelectorAll('#custom .tab').forEach((t) => t.addEventListener('click', () => { this.cTab = t.dataset.tab; document.querySelectorAll('#custom .tab').forEach((x) => x.classList.toggle('on', x === t)); this.renderCustom(false); }));
    $('cInside').addEventListener('click', () => { const on = this.garage.toggleInside(); $('cInside').textContent = on ? 'نمای بیرون' : 'نمای داخل'; });
  }
  bought(id, key) { const b = this.save.data.bought || (this.save.data.bought = {}); return !!(b[id] && b[id][key]); }
  markBought(id, key) { const b = this.save.data.bought || (this.save.data.bought = {}); (b[id] || (b[id] = {}))[key] = true; }
  renderCustom(rebuild) {
    const S = this.save.data; const c = carById(S.selected); const cu = S.custom[c.id] || (S.custom[c.id] = defaultCustom(c));
    const up = S.upgrades[c.id] || (S.upgrades[c.id] = defaultUpgrades());
    $('cCar').textContent = c.name;
    if (rebuild) { this.garage.inside = false; $('cInside').textContent = 'نمای داخل'; this.garage.setCar(c, cu); }
    const body = $('cBody');
    if (this.cTab === 'look') {
      const sw = (key, colors, cost) => `<div class="c-group"><h4>${CUSTOM[key].name} <small style="color:var(--muted)">(${toFa(cost)} سکه)</small></h4><div class="opts">${colors.map((col) => `<button class="sw ${cu[key] === col ? 'on' : ''}" style="background:${col}" data-k="${key}" data-v="${col}" aria-label="رنگ"></button>`).join('')}</div></div>`;
      const opt = (key) => { const d = CUSTOM[key]; return `<div class="c-group"><h4>${d.name}</h4><div class="opts">${d.options.map((o, i) => `<button class="opt ${cu[key] === i ? 'on' : ''}" data-k="${key}" data-v="${i}">${o}<small>${d.costs[i] === 0 || this.bought(c.id, key + ':' + i) ? (cu[key] === i ? 'فعال' : 'رایگان') : toFa(d.costs[i]) + ' سکه'}</small></button>`).join('')}</div></div>`; };
      body.innerHTML = sw('paint', PAINTS, CUSTOM.paint.cost) + opt('finish') + opt('rims') + opt('rimColor') + opt('spoiler') + opt('stripes') + sw('stripeColor', ['#ffffff', '#111111', '#ffd400', '#ff2a1a', '#1e6bff', '#19c25a', '#ff7a00', '#c0c0c0'], CUSTOM.stripeColor.cost) + opt('tint') + opt('neon') + opt('smoke') + opt('suit') +
        `<div class="c-group"><h4>شماره روی در (رایگان)</h4><div class="opts"><button class="opt" data-num="-1">−</button><button class="opt on">${toFa(cu.number || 7)}</button><button class="opt" data-num="1">+</button></div></div>`;
      body.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => this.buyLook(b.dataset.k, b.dataset.v)));
      body.querySelectorAll('[data-num]').forEach((b) => b.addEventListener('click', () => { cu.number = ((cu.number || 7) + +b.dataset.num + 98) % 99 + 1; this.save.save(); this.renderCustom(true); }));
    } else {
      body.innerHTML = UPGRADES.map((u) => {
        const lvl = up[u.key] || 0; const cost = upgradeCost(c, u.key, lvl);
        return `<div class="up-row"><div><b>${u.icon} ${u.name}</b><br><small>${u.desc}</small><div class="pips">${Array.from({ length: MAX_UP }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
          <button data-up="${u.key}" ${lvl >= MAX_UP || S.coins < cost ? 'disabled' : ''}>${lvl >= MAX_UP ? 'حداکثر' : 'ارتقا ' + fmtNum(cost)}</button></div>`;
      }).join('') + `<div class="c-group"><h4>مشخصات فعلی</h4>${this.statBars(c)}</div>`;
      body.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.up; const lvl = up[k] || 0; const cost = upgradeCost(c, k, lvl);
        if (lvl >= MAX_UP || S.coins < cost) return;
        S.coins -= cost; up[k] = lvl + 1; this.save.save(); this.refreshMenu(); this.renderCustom(false);
        this.hud.toast(UPGRADES.find((u) => u.key === k).name + ' به سطح ' + toFa(up[k]) + ' رسید');
      }));
    }
    const st = carStats(c, up);
    $('cScore').innerHTML = `امتیاز ظاهر: <b>${toFa(looksScore(cu))}</b> • سرعت: <b>${toFa(Math.round(st.vmax * 3.6))}</b> کیلومتر • نیترو: <b>${st.nitro ? toFa(st.nitro.toFixed(1)) + ' ثانیه' : 'ندارد'}</b>`;
    this.refreshMenu();
  }
  buyLook(key, val) {
    const S = this.save.data; const c = carById(S.selected); const cu = S.custom[c.id];
    const isColor = key === 'paint' || key === 'stripeColor';
    const v = isColor ? val : +val;
    if (cu[key] === v) return;
    const bkey = key + ':' + v;
    const cost = isColor ? CUSTOM[key].cost : CUSTOM[key].costs[v];
    const free = cost === 0 || this.bought(c.id, bkey);
    if (!free) {
      if (S.coins < cost) { this.hud.toast('سکه کافی نداری (' + fmtNum(cost) + ' سکه لازم است)'); return; }
      S.coins -= cost; this.markBought(c.id, bkey);
    }
    cu[key] = v; this.save.save(); this.renderCustom(true); this.updateShowcaseCar();
  }

  // ---------------- تنظیمات ----------------
  seg(el, options, value, onPick) {
    el.innerHTML = options.map(([v, label]) => `<button class="${v === value ? 'on' : ''}" data-v="${v}">${label}</button>`).join('');
    el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { onPick(b.dataset.v); el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); }));
  }
  bindSettings() {
    $('sVol').addEventListener('input', (e) => { this.save.data.settings.volume = +e.target.value; this.audio.setVolume(+e.target.value); this.save.save(); });
    $('sReset').addEventListener('click', () => {
      const b = $('sReset');
      if (b.dataset.confirm) { this.save.reset(); b.dataset.confirm = ''; b.textContent = 'پاک شد'; this.refreshMenu(); this.updateShowcaseCar(); setTimeout(() => { b.textContent = 'پاک کردن'; }, 1500); }
      else { b.dataset.confirm = '1'; b.textContent = 'مطمئنی؟ دوباره بزن'; setTimeout(() => { if (b.dataset.confirm) { b.dataset.confirm = ''; b.textContent = 'پاک کردن'; } }, 3500); }
    });
    $('secretDot').addEventListener('click', () => { $('codeIn').value = ''; $('codeMsg').textContent = ''; $('codeMsg').className = 'code-msg'; $('secret').classList.add('show'); });
  }
  renderSettings() {
    const S = this.save.data.settings;
    this.seg($('sQuality'), Object.entries(QUALITY).map(([k, q]) => [k, q.label]), S.quality, (v) => {
      S.quality = v; this.save.save(); this.engine.applyQuality(v); this.showcase.outdoor.setShadowSize(this.engine.q.shadow); this.applyLight();
    });
    $('sVol').value = S.volume;
    this.seg($('sCam'), [['chase', 'سوم شخص'], ['cockpit', 'اول شخص'], ['top', 'از بالا']], S.camera, (v) => { S.camera = v; this.save.save(); });
    this.seg($('sTouch'), [['auto', 'خودکار'], ['on', 'روشن'], ['off', 'خاموش']], S.touch, (v) => { S.touch = v; this.save.save(); });
    this.seg($('sFps'), [['1', 'روشن'], ['0', 'خاموش']], S.fps ? '1' : '0', (v) => { S.fps = v === '1'; this.save.save(); });
  }

  // ---------------- کد مخفی ----------------
  bindSecret() {
    const kp = $('keypad');
    kp.innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => `<button data-k="${k}">${k === 'C' ? 'پاک' : k === '⌫' ? '⌫' : toFa(k)}</button>`).join('');
    kp.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.k; const inp = $('codeIn');
      if (k === 'C') inp.value = ''; else if (k === '⌫') inp.value = inp.value.slice(0, -1); else inp.value += toFa(k);
    }));
    $('codeOk').addEventListener('click', () => this.applyCode());
    $('codeIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.applyCode(); });
    $('codeBack').addEventListener('click', () => $('secret').classList.remove('show'));
  }
  applyCode() {
    const code = fromFa($('codeIn').value).replace(/[^0-9]/g, '');
    const msg = $('codeMsg'); const S = this.save.data;
    if (code === '1571') {
      for (const c of CARS) { if (!S.owned.includes(c.id)) S.owned.push(c.id); S.custom[c.id] = S.custom[c.id] || defaultCustom(c); S.upgrades[c.id] = S.upgrades[c.id] || defaultUpgrades(); }
      S.viewAll = true;
      msg.textContent = 'همه ماشین‌ها باز و خریداری شدند! 🎉'; msg.className = 'code-msg ok';
    } else if (code === '100200') {
      S.viewAll = true; msg.textContent = 'حالا همه ماشین‌ها و اسمشان را می‌توانی ببینی، حتی قفل‌ها 👀'; msg.className = 'code-msg ok';
    } else { msg.textContent = 'کد اشتباه است'; msg.className = 'code-msg bad'; return; }
    this.save.save(); this.refreshMenu();
  }

  // ---------------- تنظیم نور ----------------
  bindLight() {
    const L = () => this.save.data.light;
    const sliders = [['lExp', 'exposure', 'oExp'], ['lSun', 'sun', 'oSun'], ['lAmb', 'ambient', 'oAmb'], ['lBloom', 'bloom', 'oBloom'], ['lFog', 'fog', 'oFog'], ['lCloud', 'clouds', 'oCloud']];
    for (const [id, key, out] of sliders) $(id).addEventListener('input', (e) => { L()[key] = +e.target.value; $(out).textContent = toFa(Math.round(+e.target.value * 100)) + '٪'; this.save.save(); this.applyLight(); });
    $('lReset').addEventListener('click', () => { Object.assign(this.save.data.light, { time: 'auto', exposure: 1, sun: 1, ambient: 1, bloom: 0.5, shadows: true, fog: 1, clouds: 1 }); this.save.save(); this.renderLight(); this.applyLight(); });
  }
  renderLight() {
    const L = this.save.data.light;
    this.seg($('lTime'), [['auto', 'خودکار'], ['morning', 'صبح'], ['noon', 'ظهر'], ['sunset', 'غروب'], ['night', 'شب']], L.time, (v) => { L.time = v; this.save.save(); this.applyLight(); });
    this.seg($('lShadow'), [['1', 'روشن'], ['0', 'خاموش']], L.shadows ? '1' : '0', (v) => { L.shadows = v === '1'; this.save.save(); this.applyLight(); });
    for (const [id, key, out] of [['lExp', 'exposure', 'oExp'], ['lSun', 'sun', 'oSun'], ['lAmb', 'ambient', 'oAmb'], ['lBloom', 'bloom', 'oBloom'], ['lFog', 'fog', 'oFog'], ['lCloud', 'clouds', 'oCloud']]) { $(id).value = L[key]; $(out).textContent = toFa(Math.round(L[key] * 100)) + '٪'; }
  }
}

function tick() { return new Promise((r) => setTimeout(r, 0)); }

const app = new App();
window.__app = app;
app.boot().catch((e) => { console.error(e); const t = document.getElementById('loadText'); if (t) t.textContent = 'خطا: ' + e.message; });
