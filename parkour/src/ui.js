// رابط کاربری: منوها، فروشگاه، تنظیمات، HUD، نتایج، چت و برچسب‌های بالای سر
import { MODES, SHOP_ITEMS, OUTFITS, PALETTES, LIGHTINGS, QUALITY, THEMES, CUSTOM_COLOR_PRICE, CUSTOM_LIGHT_PRICE, MAX_LEVEL } from './config.js';
import { CATEGORIES, SUGGESTED, BOT_PERSONAS } from './chat.js';
import { AI_MODELS } from './ai.js';
import { fa, faNum, formatTime, escapeHtml } from './util.js';

const $ = (id) => document.getElementById(id);
const h = (tag, attrs = {}, html = '') => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  if (html) el.innerHTML = html;
  return el;
};

export class UI {
  constructor(game) {
    this.game = game;
    this.save = game.save;
    this.screen = 'loading';
    this.levelPage = 0;
    this.shopTab = 'up';
    this.setTab = 'mode';
    this.suggCat = CATEGORIES[0].id;
    this.tags = new Map();
    this.chatOpen = false;
    this.unread = 0;
    this.botColors = {};
    this.wire();
  }

  wire() {
    $('btnPlay').onclick = () => { this.click(); this.game.startLevel(this.save.data.level); };
    $('btnLevels').onclick = () => { this.click(); this.levelPage = Math.floor((this.save.data.level - 1) / 50); this.show('levels'); this.buildLevels(); };
    $('btnShop').onclick = () => { this.click(); this.show('shop'); this.buildShop(); };
    $('btnSettings').onclick = () => { this.click(); this.openSettings('menu'); };
    $('btnMenuChat').onclick = () => this.toggleChat(true);
    document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => { this.click(); this.back(); }));
    $('lvPrev').onclick = () => { this.levelPage = Math.max(0, this.levelPage - 1); this.buildLevels(); };
    $('lvNext').onclick = () => { this.levelPage = Math.min(19, this.levelPage + 1); this.buildLevels(); };
    $('shopTabs').onclick = (e) => {
      const t = e.target.closest('.tab');
      if (!t) return;
      this.shopTab = t.dataset.tab;
      this.buildShop();
    };
    $('setTabs').onclick = (e) => {
      const t = e.target.closest('.tab');
      if (!t) return;
      this.setTab = t.dataset.tab;
      this.buildSettings();
    };
    $('btnPause').onclick = () => this.game.pause();
    $('btnChat').onclick = () => this.toggleChat();
    $('pResume').onclick = () => this.game.resume();
    $('pRestart').onclick = () => this.game.restart();
    $('pCheckpoint').onclick = () => { this.game.resume(); this.game.respawnPlayer(false); };
    $('pSettings').onclick = () => this.openSettings('pause');
    $('pMenu').onclick = () => this.game.toMenu();
    $('rNext').onclick = () => this.game.nextLevel();
    $('rRetry').onclick = () => this.game.restart();
    $('rMenu').onclick = () => this.game.toMenu();
    $('chatClose').onclick = () => this.toggleChat(false);
    $('suggBtn').onclick = () => this.toggleSugg();
    $('chatForm').onsubmit = (e) => {
      e.preventDefault();
      const v = $('chatText').value.trim();
      if (!v) return;
      $('chatText').value = '';
      this.game.chat.sendFree(v);
    };
    $('chatText').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.toggleChat(false); e.stopPropagation(); }
    });
    // نام‌گذاری‌های پیشنهادی
    this.buildSuggestions();
  }
  click() {
    this.game.audio.click();
  }

  show(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id);
    this.prevScreen = this.screen;
    this.screen = id;
    if (id === 'menu') this.refreshMenu();
  }
  back() {
    if (this.settingsFrom === 'pause' && this.screen === 'settings') {
      this.show('none');
      $('pause').hidden = false;
      this.settingsFrom = null;
      return;
    }
    this.show('menu');
  }
  setLoading(p, tip) {
    $('loadFill').style.width = `${Math.round(p * 100)}%`;
    if (tip) $('loadTip').textContent = tip;
  }

  // ---------- منو ----------
  refreshMenu() {
    const d = this.save.data;
    $('menuCoins').textContent = faNum(d.coins);
    $('menuMax').textContent = fa(d.maxLevel);
    $('playLabel').textContent = `شروع مرحله ${fa(d.level)}`;
    const mode = MODES.find((m) => m.id === this.save.s.mode);
    $('playSub').textContent = `حالت ${mode.name}`;
    this.buildModeStrip($('modeStrip'));
    document.querySelectorAll('.coinsNow').forEach((e) => (e.textContent = faNum(d.coins)));
  }
  buildModeStrip(el) {
    el.innerHTML = '';
    for (const m of MODES) {
      const unlocked = this.save.modeUnlocked(m.id);
      const active = this.save.s.mode === m.id;
      const chip = h('button', { class: `mode-chip${active ? ' active' : ''}${unlocked ? '' : ' locked'}`, role: 'radio', 'aria-checked': String(active) },
        `<span class="mi">${unlocked ? m.icon : '🔒'}</span><span>${m.name}<small>${unlocked ? (active ? 'انتخاب‌شده' : 'باز') : `بعد از مرحلهٔ ${fa(m.unlock)}`}</small></span>`);
      chip.onclick = () => {
        if (!unlocked) {
          this.game.audio.error();
          this.toast(`حالت «${m.name}» بعد از رد کردن مرحلهٔ ${fa(m.unlock)} باز می‌شود.`);
          return;
        }
        this.click();
        this.save.s.mode = m.id;
        this.save.save();
        this.refreshMenu();
        if (this.screen === 'settings') this.buildSettings();
        this.game.onModeChanged();
      };
      el.appendChild(chip);
    }
  }

  buildLevels() {
    const grid = $('levelGrid');
    grid.innerHTML = '';
    const start = this.levelPage * 50 + 1;
    $('lvPage').textContent = `${fa(start)}–${fa(Math.min(MAX_LEVEL, start + 49))}`;
    const d = this.save.data;
    for (let i = start; i < start + 50 && i <= MAX_LEVEL; i++) {
      const st = d.stats[i];
      const b = h('button', { class: `lv${i === d.level ? ' cur' : ''}` }, `${fa(i)}${st ? `<i class="medal r${Math.min(3, st.rank) <= 3 ? st.rank : 0}"></i>` : ''}`);
      if (i > d.maxLevel) {
        b.disabled = true;
        b.innerHTML = '🔒';
        b.title = `مرحلهٔ ${fa(i)} قفل است`;
      } else {
        b.title = st ? `بهترین رتبه: ${fa(st.rank)} · بهترین زمان: ${formatTime(st.time)}` : `مرحلهٔ ${fa(i)}`;
        b.onclick = () => {
          this.click();
          this.save.data.level = i;
          this.save.save();
          this.game.startLevel(i);
        };
      }
      grid.appendChild(b);
    }
  }

  // ---------- فروشگاه ----------
  buildShop() {
    document.querySelectorAll('#shopTabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === this.shopTab));
    const body = $('shopBody');
    body.innerHTML = '';
    document.querySelectorAll('.coinsNow').forEach((e) => (e.textContent = faNum(this.save.data.coins)));
    const row = h('div', { class: 'card-row' });
    body.appendChild(row);
    if (this.shopTab === 'up') {
      for (const it of SHOP_ITEMS) {
        const lv = this.save.data.upgrades[it.id] || 0;
        const maxed = lv >= it.max;
        const price = maxed ? 0 : it.price(lv);
        const card = h('div', { class: 'item' });
        card.innerHTML = `<h4><span class="ico">${it.icon}</span>${it.name}</h4><p>${it.desc}</p>
          ${it.max > 1 ? `<div class="pips">${Array.from({ length: it.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div><p>سطح ${fa(lv)} از ${fa(it.max)}</p>` : `<p>${lv ? 'خریداری شده ✔' : 'یک بار خرید'}</p>`}`;
        const btn = h('button', { class: `btn ${maxed ? '' : 'primary'}` }, maxed ? 'کامل شد' : `<span class="price"><i class="coin-ic"></i>${faNum(price)}</span>`);
        btn.disabled = maxed;
        btn.onclick = async () => {
          if (this.save.data.coins < price) return this.noMoney(price);
          if (!(await this.confirm(`خرید ${it.name}`, `${it.name} ${it.max > 1 ? `سطح ${fa(lv + 1)}` : ''} با ${faNum(price)} سکه؟`))) return;
          if (this.save.spend(price)) {
            this.save.data.upgrades[it.id] = lv + 1;
            this.save.save();
            this.game.audio.buy();
            this.toast(`${it.name} ارتقا پیدا کرد!`, 'good');
            this.game.applyUpgrades();
            this.buildShop();
          }
        };
        card.appendChild(btn);
        row.appendChild(card);
      }
    } else {
      for (const o of OUTFITS) {
        const owned = this.save.data.owned.outfits.includes(o.id);
        const sel = this.save.s.outfit === o.id;
        const c = o.colors;
        const card = h('div', { class: `item${sel ? ' sel' : ''}` });
        card.innerHTML = `<h4>${o.name}</h4><div class="swatches"><i style="background:${c.shirt}"></i><i style="background:${c.pants}"></i><i style="background:${c.shoes}"></i><i style="background:${c.accent}"></i></div>`;
        const btn = h('button', { class: `btn ${owned ? '' : 'primary'}` }, sel ? 'پوشیده‌ای ✔' : owned ? 'بپوش' : `<span class="price"><i class="coin-ic"></i>${faNum(o.price)}</span>`);
        btn.disabled = sel;
        btn.onclick = async () => {
          if (!owned) {
            if (this.save.data.coins < o.price) return this.noMoney(o.price);
            if (!(await this.confirm('خرید لباس', `لباس «${o.name}» با ${faNum(o.price)} سکه؟`))) return;
            if (!this.save.spend(o.price)) return;
            this.save.data.owned.outfits.push(o.id);
            this.game.audio.buy();
          }
          this.save.s.outfit = o.id;
          this.save.save();
          this.game.applyOutfit();
          this.buildShop();
        };
        card.appendChild(btn);
        row.appendChild(card);
      }
    }
  }
  noMoney(price) {
    this.game.audio.error();
    this.toast(`سکه کافی نداری؛ ${faNum(price - this.save.data.coins)} سکهٔ دیگه لازمه. مراحل رو رد کن تا سکه جمع کنی!`);
  }

  // ---------- تنظیمات ----------
  openSettings(from) {
    this.settingsFrom = from;
    $('pause').hidden = true;
    this.show('settings');
    this.buildSettings();
  }
  buildSettings() {
    document.querySelectorAll('#setTabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === this.setTab));
    document.querySelectorAll('.coinsNow').forEach((e) => (e.textContent = faNum(this.save.data.coins)));
    const body = $('setBody');
    body.innerHTML = '';
    const s = this.save.s, own = this.save.data.owned;
    const tab = this.setTab;
    if (tab === 'mode') {
      body.appendChild(h('p', { class: 'note' }, 'مسیر پارکور به چه سمتی برود؟ حالت <b>رو به جلو</b> از اول باز است و بقیه با رد کردن مراحل باز می‌شوند. پیشرفت مراحل بین همهٔ حالت‌ها مشترک است.'));
      const row = h('div', { class: 'card-row' });
      for (const m of MODES) {
        const unlocked = this.save.modeUnlocked(m.id);
        const sel = s.mode === m.id;
        const card = h('div', { class: `item${sel ? ' sel' : ''}` }, `<h4><span class="ico">${unlocked ? m.icon : '🔒'}</span>${m.name}</h4><p>${m.desc}</p>`);
        const btn = h('button', { class: `btn ${sel ? '' : 'primary'}` }, sel ? 'انتخاب‌شده ✔' : unlocked ? 'انتخاب' : `بعد از مرحلهٔ ${fa(m.unlock)}`);
        btn.disabled = sel || !unlocked;
        btn.onclick = () => { s.mode = m.id; this.save.save(); this.click(); this.buildSettings(); this.refreshMenu(); this.game.onModeChanged(); };
        card.appendChild(btn);
        row.appendChild(card);
      }
      body.appendChild(row);
    } else if (tab === 'light') {
      body.appendChild(h('p', { class: 'note' }, 'حال‌وهوای نور بازی را عوض کن. هر نورپردازی یک بار خریده می‌شود و همیشه در دسترس می‌ماند.'));
      const row = h('div', { class: 'card-row' });
      for (const L of LIGHTINGS) {
        const owned = own.lightings.includes(L.id);
        const sel = s.lighting === L.id && !(s.customLight.enabled && own.customLight);
        const o = L.o;
        const theme = THEMES[0];
        const top = o.tint || theme.sky.top, hor = o.tint ? o.sunColor : theme.sky.horizon;
        const card = h('div', { class: `item${sel ? ' sel' : ''}` }, `<div class="preview-sky" style="background:linear-gradient(180deg, ${top}, ${hor});--sun:${o.sunColor || theme.sun.color}"></div><h4>${L.name}</h4>`);
        card.appendChild(this.buyButton(owned, sel, L.price, async () => {
          if (!owned) {
            if (!(await this.purchase(L.name, L.price))) return;
            own.lightings.push(L.id);
          }
          s.lighting = L.id;
          s.customLight.enabled = false;
          this.save.save();
          this.game.applyLook();
          this.buildSettings();
        }));
        row.appendChild(card);
      }
      body.appendChild(row);
      // نورپردازی سفارشی
      const cl = h('div', { class: 'item' }, `<h4><span class="ico">🎛️</span>نورپردازی سفارشی</h4><p>شدت و ارتفاع خورشید، روشنایی، درخشش و دمای رنگ را خودت تنظیم کن.</p>`);
      if (!own.customLight) {
        cl.appendChild(this.buyButton(false, false, CUSTOM_LIGHT_PRICE, async () => {
          if (!(await this.purchase('نورپردازی سفارشی', CUSTOM_LIGHT_PRICE))) return;
          own.customLight = true;
          s.customLight.enabled = true;
          this.save.save();
          this.game.applyLook();
          this.buildSettings();
        }));
      } else {
        const c = s.customLight;
        cl.appendChild(this.switchRow('فعال باشد', c.enabled, (v) => { c.enabled = v; this.save.save(); this.game.applyLook(); }));
        const apply = () => { this.save.save(); clearTimeout(this._lt); this._lt = setTimeout(() => this.game.applyLook(), 120); };
        cl.appendChild(this.rangeRow('شدت خورشید', c.sun, 0.2, 2, 0.05, (v) => { c.sun = v; apply(); }));
        cl.appendChild(this.rangeRow('ارتفاع خورشید', c.elev, 3, 80, 1, (v) => { c.elev = v; apply(); }));
        cl.appendChild(this.rangeRow('روشنایی کلی', c.exposure, 0.5, 1.8, 0.02, (v) => { c.exposure = v; apply(); }));
        cl.appendChild(this.rangeRow('درخشش (Bloom)', c.bloom, 0, 3, 0.05, (v) => { c.bloom = v; apply(); }));
        cl.appendChild(this.rangeRow('دمای رنگ (سرد ← گرم)', c.warmth, -1, 1, 0.05, (v) => { c.warmth = v; apply(); }));
      }
      body.appendChild(cl);
    } else if (tab === 'color') {
      body.appendChild(h('p', { class: 'note' }, 'رنگ سکوها و لبه‌های نورانی پارکور را عوض کن. هر پالت یک بار خریده می‌شود.'));
      const row = h('div', { class: 'card-row' });
      for (const P of PALETTES) {
        const owned = own.palettes.includes(P.id);
        const sel = s.palette === P.id && !(s.customColor.enabled && own.customColor);
        const cols = P.colors === 'rainbow' ? ['#ff5c5c', '#ffb13d', '#fff23d', '#5cff7a', '#5cc8ff', '#a05cff'] : P.colors || this.game.theme.palette;
        const card = h('div', { class: `item${sel ? ' sel' : ''}` }, `<div class="swatches">${cols.map((c) => `<i style="background:${c}"></i>`).join('')}<i style="background:${P.trim || this.game.theme.trim};flex:.35;box-shadow:0 0 12px ${P.trim || this.game.theme.trim}"></i></div><h4>${P.name}</h4>`);
        card.appendChild(this.buyButton(owned, sel, P.price, async () => {
          if (!owned) {
            if (!(await this.purchase(P.name, P.price))) return;
            own.palettes.push(P.id);
          }
          s.palette = P.id;
          s.customColor.enabled = false;
          this.save.save();
          this.game.applyLook(true);
          this.buildSettings();
        }));
        row.appendChild(card);
      }
      body.appendChild(row);
      const cc = h('div', { class: 'item' }, `<h4><span class="ico">🎨</span>رنگ دلخواه</h4><p>رنگ سکوها و رنگ نوار نورانی را کاملاً خودت انتخاب کن.</p>`);
      if (!own.customColor) {
        cc.appendChild(this.buyButton(false, false, CUSTOM_COLOR_PRICE, async () => {
          if (!(await this.purchase('رنگ دلخواه', CUSTOM_COLOR_PRICE))) return;
          own.customColor = true;
          s.customColor.enabled = true;
          this.save.save();
          this.game.applyLook(true);
          this.buildSettings();
        }));
      } else {
        const c = s.customColor;
        cc.appendChild(this.switchRow('فعال باشد', c.enabled, (v) => { c.enabled = v; this.save.save(); this.game.applyLook(true); }));
        cc.appendChild(this.colorRow('رنگ سکوها', c.base, (v) => { c.base = v; this.save.save(); this.game.applyLook(true); }));
        cc.appendChild(this.colorRow('رنگ لبهٔ نورانی', c.trim, (v) => { c.trim = v; this.save.save(); this.game.applyLook(true); }));
      }
      body.appendChild(cc);
    } else if (tab === 'gfx') {
      const sel = h('select', { id: 'qSel' });
      sel.innerHTML = `<option value="auto">خودکار (پیشنهادی)</option>` + Object.entries(QUALITY).map(([k, q]) => `<option value="${k}">${q.label}</option>`).join('');
      sel.value = s.quality;
      sel.onchange = () => { s.quality = sel.value; this.save.save(); this.game.applyQuality(); };
      body.appendChild(this.row('کیفیت گرافیک', 'سایه‌ها، درخشش، وضوح و ذرات. در حالت خودکار، وضوح برای روان ماندن بازی خودبه‌خود تنظیم می‌شود.', sel));
      body.appendChild(this.rangeRow('فاصلهٔ دوربین', s.camDist, 0.7, 1.6, 0.05, (v) => { s.camDist = v; this.save.save(); }));
      body.appendChild(this.switchRow('نمایش FPS', s.showFps, (v) => { s.showFps = v; this.save.save(); $('hudFps').hidden = !v; }));
      body.appendChild(this.switchRow('کاهش حرکت (بدون لرزش دوربین)', s.reduceMotion, (v) => { s.reduceMotion = v; this.save.save(); }));
      body.appendChild(h('p', { class: 'note' }, `کیفیت فعلی: <b>${QUALITY[this.game.qualityKey].label}</b> · وضوح رندر: <b>${fa(Math.round(this.game.renderScale * 100))}٪</b>`));
    } else if (tab === 'ctrl') {
      const name = h('input', { type: 'text', maxlength: '18', id: 'nameIn', value: s.playerName });
      name.style.direction = 'rtl';
      name.style.textAlign = 'right';
      name.onchange = () => { s.playerName = name.value.trim() || 'تو'; this.save.save(); };
      body.appendChild(this.row('اسم تو در چت', '', name));
      body.appendChild(this.rangeRow('حساسیت دوربین', s.sens, 0.3, 2.5, 0.05, (v) => { s.sens = v; this.save.save(); }));
      body.appendChild(this.switchRow('برعکس کردن محور عمودی', s.invertY, (v) => { s.invertY = v; this.save.save(); }));
      body.appendChild(this.switchRow('لرزش گوشی', s.haptics, (v) => { s.haptics = v; this.save.save(); }));
      body.appendChild(this.rangeRow('صدای افکت‌ها', s.sfx, 0, 1, 0.05, (v) => { s.sfx = v; this.save.save(); this.game.audio.setVolumes(s.sfx, s.music); }));
      body.appendChild(this.rangeRow('صدای موسیقی', s.music, 0, 1, 0.05, (v) => { s.music = v; this.save.save(); this.game.audio.setVolumes(s.sfx, s.music); }));
      body.appendChild(this.switchRow('حرف زدن خودجوش رقبا وسط مسابقه', s.botChat, (v) => { s.botChat = v; this.save.save(); }));
      body.appendChild(h('p', { class: 'note' }, '<b>کیبورد:</b> W A S D یا جهت‌ها برای حرکت · Space پرش (در هوا: پرش دوبل) · Shift یا C سُر خوردن · موس برای چرخاندن دوربین (کلیک برای قفل) · Enter یا T چت · Esc توقف. <b>دسته بازی</b> هم پشتیبانی می‌شود.'));
      const reset = h('button', { class: 'btn ghost' }, 'پاک کردن کامل پیشرفت');
      reset.onclick = async () => {
        if (await this.confirm('پاک کردن پیشرفت', 'همهٔ مراحل، سکه‌ها و خریدها پاک می‌شوند. مطمئنی؟')) {
          this.save.reset();
          location.reload();
        }
      };
      body.appendChild(reset);
    } else if (tab === 'ai') {
      const src = this.game.ai.source();
      body.appendChild(h('p', { class: 'note' }, `<span class="status-dot ${src ? 'on' : ''}"></span>${src === 'claude' ? '<b>داخل محیط Claude اجرا می‌شود.</b> بچه‌ها به هر پیام آزادی که بنویسی با هوش مصنوعی و کاملاً طبیعی جواب می‌دهند؛ کلید لازم نیست (بار اول Claude اجازه می‌خواهد).' : src === 'key' ? '<b>کلید API فعال است.</b> پیام‌های آزاد تو با هوش مصنوعی جواب داده می‌شوند.' : '<b>هوش مصنوعی وصل نیست.</b> ۲۰۰ پیام پیشنهادی همیشه کار می‌کنند. برای گفت‌وگوی آزاد کاملاً طبیعی، یا بازی را داخل Claude باز کن یا کلید API را اینجا وارد کن.'}`));
      const key = h('input', { type: 'password', id: 'keyIn', placeholder: 'sk-ant-…', value: s.apiKey, autocomplete: 'off', spellcheck: 'false' });
      key.onchange = () => { s.apiKey = key.value.trim(); this.save.save(); this.game.chat._errShown = false; this.updateChatMode(); this.buildSettings(); };
      body.appendChild(this.row('کلید API کلود', 'از console.anthropic.com بگیر. فقط روی همین دستگاه ذخیره می‌شود و مستقیم به api.anthropic.com فرستاده می‌شود.', key));
      const msel = h('select', { id: 'modelSel' });
      msel.innerHTML = AI_MODELS.map((m) => `<option value="${m.id}">${m.name}</option>`).join('');
      msel.value = s.model;
      msel.onchange = () => { s.model = msel.value; this.save.save(); };
      body.appendChild(this.row('مدل', 'برای کلید API. Haiku سریع‌تر و ارزان‌تر است.', msel));
      if (s.apiKey) {
        const clr = h('button', { class: 'btn ghost small' }, 'حذف کلید از این دستگاه');
        clr.onclick = () => { s.apiKey = ''; this.save.save(); this.updateChatMode(); this.buildSettings(); };
        body.appendChild(clr);
      }
    }
  }
  buyButton(owned, sel, price, onClick) {
    const btn = h('button', { class: `btn ${owned || price === 0 ? '' : 'primary'}` }, sel ? 'فعال ✔' : owned || price === 0 ? 'استفاده' : `<span class="price"><i class="coin-ic"></i>${faNum(price)}</span>`);
    btn.disabled = sel;
    btn.onclick = onClick;
    return btn;
  }
  async purchase(name, price) {
    if (this.save.data.coins < price) { this.noMoney(price); return false; }
    if (!(await this.confirm(`خرید «${name}»`, `با ${faNum(price)} سکه بخری؟ بعد از خرید همیشه مال توست.`))) return false;
    if (!this.save.spend(price)) return false;
    this.game.audio.buy();
    this.toast(`«${name}» خریداری شد!`, 'good');
    return true;
  }
  row(label, sub, control) {
    const r = h('div', { class: 'row' });
    const l = h('label', {}, `${label}${sub ? `<small>${sub}</small>` : ''}`);
    r.append(l, control);
    return r;
  }
  rangeRow(label, val, min, max, step, cb) {
    const inp = h('input', { type: 'range', min, max, step, value: val, 'aria-label': label });
    inp.oninput = () => cb(parseFloat(inp.value));
    return this.row(label, '', inp);
  }
  switchRow(label, val, cb) {
    const sw = h('button', { class: `switch${val ? ' on' : ''}`, role: 'switch', 'aria-checked': String(!!val), 'aria-label': label });
    sw.onclick = () => {
      const v = !sw.classList.contains('on');
      sw.classList.toggle('on', v);
      sw.setAttribute('aria-checked', String(v));
      this.click();
      cb(v);
    };
    return this.row(label, '', sw);
  }
  colorRow(label, val, cb) {
    const c = h('input', { type: 'color', value: val, 'aria-label': label });
    c.onchange = () => cb(c.value);
    return this.row(label, '', c);
  }
  confirm(title, text) {
    return new Promise((res) => {
      $('modalTitle').textContent = title;
      $('modalText').textContent = text;
      $('modal').hidden = false;
      const done = (v) => { $('modal').hidden = true; res(v); };
      $('modalOk').onclick = () => done(true);
      $('modalCancel').onclick = () => done(false);
    });
  }

  // ---------- HUD ----------
  setPlaying(on) {
    $('hud').hidden = !on;
    $('touch').hidden = !on || !this.game.isTouch;
    $('hudFps').hidden = !this.save.s.showFps;
    if (!on) this.clearTags();
  }
  hudStatic(level, modeName, total, cps) {
    $('hudLevel').textContent = `مرحله ${fa(level)}`;
    $('hudMode').textContent = modeName;
    $('hudRankOf').textContent = `از ${fa(total)}`;
    const bar = $('raceBar');
    bar.innerHTML = '<div class="race-track"></div><span class="race-flag">🏁</span>';
    for (const c of cps) bar.appendChild(h('i', { class: 'race-cp', style: `right:${(c * 100).toFixed(1)}%` }));
    this.dots = [];
    for (let i = 0; i < total; i++) {
      const me = i === total - 1;
      const d = h('i', { class: `race-dot${me ? ' me' : ''}` });
      bar.appendChild(d);
      this.dots.push(d);
    }
  }
  hud(st) {
    $('hudTime').textContent = formatTime(st.time);
    if (st.coins !== this._lastCoins) {
      $('hudCoins').textContent = faNum(st.coins);
      const el = $('hudCoins').parentElement;
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
      this._lastCoins = st.coins;
    }
    $('hudRank').textContent = fa(st.rank);
    if (this.dots) {
      st.racers.forEach((r, i) => {
        const d = this.dots[i];
        if (!d) return;
        d.style.right = `${(Math.min(1, r.prog) * 100).toFixed(2)}%`;
        if (!r.me) d.style.background = r.color;
      });
    }
    if (this.save.s.showFps) $('hudFps').textContent = `${st.fps | 0} FPS · ${Math.round(this.game.renderScale * 100)}%`;
  }
  hint(text, sec = 5) {
    const el = $('hint');
    el.innerHTML = text;
    el.hidden = false;
    clearTimeout(this._ht);
    this._ht = setTimeout(() => (el.hidden = true), sec * 1000);
  }
  toast(text, kind = '') {
    const t = h('div', { class: `toast ${kind}` });
    t.textContent = text;
    $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 2700);
  }
  flash(kind = 'hurt') {
    const f = $('flash');
    f.className = kind === 'cp' ? 'cp on' : 'on';
    requestAnimationFrame(() => requestAnimationFrame(() => (f.className = kind === 'cp' ? 'cp' : '')));
  }
  countdown(n) {
    const el = $('countdown');
    el.innerHTML = n > 0 ? `<span class="n">${fa(n)}</span>` : n === 0 ? `<span class="n go">برو!</span>` : '';
  }
  skipButton(on, cb) {
    let b = document.getElementById('skipBtn');
    if (on && !b) {
      b = h('button', { class: 'btn skip', id: 'skipBtn' }, 'رد کردن ⏭');
      b.onclick = cb;
      $('ui').appendChild(b);
    } else if (!on && b) b.remove();
  }
  showPause(on) {
    $('pause').hidden = !on;
  }

  // ---------- نتایج ----------
  results(r) {
    $('results').hidden = false;
    $('resLevel').textContent = `مرحله ${fa(r.level)} · ${r.modeName}`;
    $('resTitle').textContent = r.rank === 1 ? 'قهرمان شدی! 🏆' : r.rank <= 3 ? `نفر ${fa(r.rank)} شدی!` : 'مرحله رد شد!';
    $('resTime').textContent = formatTime(r.time);
    $('resRank').textContent = `${fa(r.rank)} از ${fa(r.total)}`;
    $('resFalls').textContent = fa(r.falls);
    const pod = $('resPodium');
    pod.innerHTML = '';
    r.standings.slice(0, 7).forEach((s, i) => {
      pod.appendChild(h('div', { class: `pod${s.me ? ' me' : ''}` }, `<span class="rk r${i + 1}">${fa(i + 1)}</span><span class="nm"><i style="background:${s.color}"></i>${escapeHtml(s.name)}</span><span class="tm">${s.time ? formatTime(s.time) : 'در راه…'}</span>`));
    });
    // شمارش سکه
    const el = $('resCoins');
    let shown = 0;
    const step = Math.max(1, Math.ceil(r.coins / 40));
    clearInterval(this._ci);
    this._ci = setInterval(() => {
      shown = Math.min(r.coins, shown + step);
      el.textContent = `+${faNum(shown)}`;
      if (shown >= r.coins) clearInterval(this._ci);
    }, 30);
    $('resCoinsDetail').textContent = `پاداش مرحله ${faNum(r.base)} · رتبه ×${fa(r.mult)} · سکه‌های مسیر ${faNum(r.picked)}`;
    const un = $('resUnlock');
    if (r.unlocks && r.unlocks.length) {
      un.hidden = false;
      un.textContent = `🔓 حالت جدید باز شد: ${r.unlocks.map((m) => m.name).join('، ')} — از تنظیمات یا منو انتخابش کن!`;
    } else un.hidden = true;
    $('rNext').hidden = r.level >= MAX_LEVEL;
  }
  hideResults() {
    $('results').hidden = true;
  }

  // ---------- چت ----------
  toggleChat(force) {
    this.chatOpen = force ?? !this.chatOpen;
    $('chat').hidden = !this.chatOpen;
    if (this.chatOpen) {
      this.unread = 0;
      $('chatBadge').hidden = true;
      this.updateChatMode();
      const log = $('chatLog');
      log.scrollTop = log.scrollHeight;
      if (!this.game.isTouch) setTimeout(() => $('chatText').focus(), 50);
    } else {
      $('chatText').blur();
    }
    this.game.input.enabled = !this.chatOpen || this.game.isTouch;
  }
  updateChatMode() {
    const src = this.game.ai.source();
    $('chatMode').textContent = src === 'claude' ? 'چت آزاد با هوش مصنوعی Claude' : src === 'key' ? 'چت آزاد با کلید API' : '۲۰۰ پیام پیشنهادی + جواب‌های آماده';
  }
  toggleSugg(force) {
    const s = $('sugg');
    s.hidden = force !== undefined ? !force : !s.hidden;
  }
  buildSuggestions() {
    const cats = $('suggCats');
    cats.innerHTML = '';
    for (const c of CATEGORIES) {
      const b = h('button', { class: c.id === this.suggCat ? 'active' : '' }, `${c.icon} ${c.label}`);
      b.onclick = () => { this.suggCat = c.id; this.buildSuggestions(); };
      cats.appendChild(b);
    }
    const list = $('suggList');
    list.innerHTML = '';
    for (const s of SUGGESTED.filter((x) => x.cat === this.suggCat)) {
      const b = h('button', {});
      b.textContent = s.text;
      b.onclick = () => {
        this.game.chat.sendSuggested(s);
        if (this.game.isTouch) this.toggleSugg(false);
      };
      list.appendChild(b);
    }
  }
  addMessage(m) {
    const log = $('chatLog');
    let el;
    if (m.from === 'system') {
      el = h('div', { class: 'msg sys' });
      el.textContent = m.text;
    } else if (m.from === 'player') {
      el = h('div', { class: 'msg me' });
      el.textContent = m.text;
    } else {
      el = h('div', { class: 'msg bot' });
      const who = h('div', { class: 'who' }, `<i style="background:${this.botColors[m.bot] || '#fff'}"></i>`);
      who.appendChild(document.createTextNode(m.name));
      const tx = h('div');
      tx.textContent = m.text;
      el.append(who, tx);
      this.bubble(m.bot, m.text);
    }
    log.appendChild(el);
    while (log.children.length > 80) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
    if (!this.chatOpen && m.from === 'bot') {
      this.unread++;
      $('chatBadge').hidden = false;
    }
    if (m.from === 'bot') this.game.audio.chat();
  }
  typing(persona, on) {
    this._typing = this._typing || new Set();
    if (on) this._typing.add(persona.name);
    else this._typing.delete(persona.name);
    const el = $('chatTyping');
    el.hidden = !this._typing.size;
    el.textContent = this._typing.size ? `${[...this._typing].join('، ')} در حال نوشتن…` : '';
    const t = this.tags.get(persona.id);
    if (t) t.dots.hidden = !on;
  }

  // ---------- برچسب نام ----------
  ensureTag(id, name, color) {
    let t = this.tags.get(id);
    if (t) return t;
    const el = h('div', { class: 'tag' });
    const nm = h('div', { class: 'nm' }, `<i style="background:${color}"></i>`);
    nm.appendChild(document.createTextNode(name));
    const dots = h('div', { class: 'dots' }, '•••');
    dots.hidden = true;
    const bub = h('div', { class: 'bub' });
    bub.hidden = true;
    el.append(bub, dots, nm);
    $('tags').appendChild(el);
    t = { el, nm, bub, dots, until: 0 };
    this.tags.set(id, t);
    this.botColors[id] = color;
    return t;
  }
  bubble(id, text) {
    const t = this.tags.get(id);
    if (!t) return;
    t.bub.textContent = text;
    t.bub.hidden = false;
    t.until = performance.now() + 4800;
  }
  placeTag(id, x, y, scale, visible) {
    const t = this.tags.get(id);
    if (!t) return;
    if (!visible) {
      if (t.el.style.display !== 'none') t.el.style.display = 'none';
      return;
    }
    if (t.el.style.display === 'none') t.el.style.display = '';
    t.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${scale})`;
    if (!t.bub.hidden && performance.now() > t.until) t.bub.hidden = true;
  }
  clearTags() {
    for (const t of this.tags.values()) t.el.remove();
    this.tags.clear();
  }

  // ---------- کنترل لمسی ----------
  touchUI() {
    const joy = $('joy'), knob = $('joyKnob');
    return {
      zone: $('touchZone'),
      jump: $('tJump'),
      slide: $('tSlide'),
      showJoy: (x, y) => { joy.hidden = false; joy.style.left = `${x}px`; joy.style.top = `${y}px`; knob.style.transform = ''; },
      moveJoyBase: (x, y) => { joy.style.left = `${x}px`; joy.style.top = `${y}px`; },
      moveKnob: (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; },
      hideJoy: () => { joy.hidden = true; },
    };
  }
}
