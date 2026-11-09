// DOM menus: main menu, stage select, garage, settings (incl. the 26 graphics presets),
// pause and results dialogs, toasts and confirmations.

import {
  CARS, STAGES, THEMES, UPGRADES, MAX_UPGRADE, COIN_REWARDS, PAINT_COLORS, FIELD_SIZE, PASS_RANK,
  carById, tunedPhysics, performanceIndex, carStats, upgradeCost, playerLevel, emptyUpgrades,
} from '../core/config.js';
import { TIERS, ULTRA_MAX_INDEX } from '../gfx/quality.js';
import { fa, faNum, formatTime } from '../core/utils.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const WEATHER = { clear: ['☀️', 'آفتابی'], rain: ['🌧️', 'بارانی'], snow: ['🌨️', 'برفی'], fog: ['🌫️', 'مه'] };
const DRIVE = { FWD: 'دیفرانسیل جلو', RWD: 'دیفرانسیل عقب', AWD: 'چهارچرخ محرک' };
const medal = (r) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : '');

export class UI {
  constructor(app) {
    this.app = app;
    this.hudHost = $('#hud-host');
    this.current = 'loading';
    this.settingsReturn = 'menu';
    this.garageCar = null;
    this.#bind();
    this.#renderRewardStrips();
  }

  get profile() {
    return this.app.profile;
  }

  // ------------------------------------------------------------------------------------------
  #bind() {
    document.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (go) {
        this.app.audio.unlock();
        this.app.audio.click();
        this.app.go(go.dataset.go);
      }
      if (e.target.closest('[data-back]')) {
        this.app.audio.click();
        if (this.settingsReturn === 'pause') {
          this.show('none');
          this.showPause(true);
        } else this.app.go(this.settingsReturn);
      }
    });
    // garage tabs
    $$('[data-gtab]').forEach((b) => b.addEventListener('click', () => {
      $$('[data-gtab]').forEach((x) => x.classList.toggle('active', x === b));
      $$('.gtab').forEach((x) => x.classList.toggle('active', x.id === `gtab-${b.dataset.gtab}`));
    }));
    // settings tabs
    $$('[data-stab]').forEach((b) => b.addEventListener('click', () => {
      $$('[data-stab]').forEach((x) => x.classList.toggle('active', x === b));
      $$('.stab').forEach((x) => x.classList.toggle('active', x.id === `stab-${b.dataset.stab}`));
    }));
    // settings inputs
    $$('[data-setting]').forEach((el) => {
      const key = el.dataset.setting;
      const handler = () => {
        const v = el.type === 'checkbox' ? el.checked : Number(el.value);
        this.profile.setSetting(key, v);
        this.app.onSettingChanged(key);
      };
      el.addEventListener(el.type === 'range' ? 'input' : 'change', handler);
    });
    $$('[data-setting-seg]').forEach((seg) => {
      const key = seg.dataset.settingSeg;
      seg.addEventListener('click', async (e) => {
        const b = e.target.closest('button[data-v]');
        if (!b) return;
        let v = b.dataset.v;
        if (key === 'assists') v = Number(v);
        if (key === 'controlMode' && v === 'tilt') {
          const ok = await this.app.input.requestTiltPermission();
          if (!ok) {
            this.toast('دسترسی به حسگر شیب گوشی ممکن نشد');
            return;
          }
        }
        this.profile.setSetting(key, v);
        this.app.onSettingChanged(key);
        this.renderSettings();
      });
    });
    $('#reset-progress').addEventListener('click', async () => {
      if (await this.confirm('همه‌ی سکه‌ها، ماشین‌ها و مراحل پاک شوند؟')) {
        this.profile.reset();
        this.app.onProfileReset();
        this.toast('پیشرفت بازی پاک شد');
      }
    });
    $('#paint-custom').addEventListener('input', (e) => this.#paint(e.target.value));
    $('#car-action').addEventListener('click', () => this.#carAction());
    $('#modal-pause').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pause]');
      if (!b) return;
      this.app.audio.click();
      this.app.pauseAction(b.dataset.pause);
    });
    $('#modal-results').addEventListener('click', (e) => {
      const b = e.target.closest('[data-res]');
      if (!b || b.disabled) return;
      this.app.audio.click();
      this.app.resultsAction(b.dataset.res);
    });
    $('#rotate-dismiss').addEventListener('click', () => {
      this.rotateDismissed = true;
      $('#rotate-hint').hidden = true;
    });
  }

  show(name) {
    this.current = name;
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
    document.body.dataset.screen = name;
    if (name === 'menu') this.refreshMenu();
    if (name === 'stages') this.renderStages();
    if (name === 'garage') this.renderGarage();
    if (name === 'settings') this.renderSettings();
  }

  setLoading(p, text) {
    $('#load-bar').style.width = `${Math.round(p * 100)}%`;
    if (text) $('#load-text').textContent = text;
  }

  refreshWallet() {
    const d = this.profile.data;
    $$('[data-bind="coins"]').forEach((e) => (e.textContent = faNum(d.coins)));
    $$('[data-bind="points"]').forEach((e) => (e.textContent = faNum(d.points)));
    $$('[data-bind="level"]').forEach((e) => (e.textContent = fa(playerLevel(d.points))));
  }

  refreshMenu() {
    const d = this.profile.data;
    this.refreshWallet();
    const car = carById(d.selected);
    $('[data-bind="carName"]').textContent = car.name;
    $('[data-bind="carTag"]').textContent = car.tag;
    $('[data-bind="unlocked"]').textContent = fa(d.unlocked);
    $('[data-bind="stageCount"]').textContent = fa(STAGES.length);
    $('[data-bind="wins"]').textContent = fa(d.wins);
  }

  #renderRewardStrips() {
    const html = COIN_REWARDS.map((c, i) => `<span class="rw r${i + 1}"><b>${medal(i + 1) || fa(i + 1)}</b>رتبه ${fa(i + 1)}: ${fa(c)} 🪙</span>`).join('')
      + `<span class="rw r6"><b>${fa(6)}+</b>رتبه ${fa(6)} به بعد: ${fa(0)}</span>`;
    $('#reward-strip').innerHTML = html;
    $('#reward-strip-help').innerHTML = html;
  }

  // ---- stages --------------------------------------------------------------------------------
  renderStages() {
    this.refreshWallet();
    const d = this.profile.data;
    const myPI = performanceIndex(tunedPhysics(carById(d.selected), this.profile.upgradesOf(d.selected)));
    const list = $('#stage-list');
    list.innerHTML = STAGES.map((st) => {
      const locked = st.index >= d.unlocked;
      const rec = d.stages[st.index];
      const theme = THEMES[st.theme];
      const mid = Math.round((st.ai.carMin + st.ai.carMax) / 2);
      const up = emptyUpgrades();
      for (const k of Object.keys(up)) up[k] = Math.round((st.ai.upgMin + st.ai.upgMax) / 2);
      const pi = Math.round(performanceIndex(tunedPhysics(CARS[mid], up)) * (0.9 + st.ai.skill * 0.1));
      const cmp = myPI >= pi + 3 ? 'easy' : myPI >= pi - 4 ? 'even' : 'hard';
      const [wi, wn] = WEATHER[st.weather];
      return `
        <button class="stage-card ${locked ? 'locked' : ''} ${st.cup ? 'cup' : ''} t-${st.theme}" data-stage="${st.index}" ${locked ? 'disabled' : ''}>
          <span class="st-num">${fa(st.index + 1)}</span>
          <span class="st-icon">${theme.icon}</span>
          <b class="st-name">${st.name}${st.cup ? ' 🏆' : ''}</b>
          <small class="st-meta">${theme.name} | ${wi} ${wn} | ${fa(st.laps)} دور</small>
          <span class="st-pi ${cmp}" title="قدرت رقبا">رقبا ${fa(pi)} / شما ${fa(myPI)}</span>
          <span class="st-best">${locked ? '🔒' : rec ? `${medal(rec.best) || `رتبه ${fa(rec.best)}`} ${rec.time ? formatTime(rec.time, false) : ''}` : 'جدید'}</span>
        </button>`;
    }).join('');
    list.onclick = (e) => {
      const card = e.target.closest('[data-stage]');
      if (!card || card.disabled) return;
      this.app.audio.unlock();
      this.app.audio.click();
      this.app.startRace(Number(card.dataset.stage));
    };
    const target = list.querySelector(`[data-stage="${Math.max(0, d.unlocked - 1)}"]`);
    target?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  // ---- garage --------------------------------------------------------------------------------
  renderGarage() {
    this.refreshWallet();
    const p = this.profile;
    const d = p.data;
    if (!this.garageCar) this.garageCar = d.selected;
    const id = this.garageCar;
    const car = carById(id);
    const owned = p.owns(id);
    $('#car-list').innerHTML = CARS.map((c) => {
      const own = p.owns(c.id);
      const sel = d.selected === c.id;
      const pi = performanceIndex(tunedPhysics(c, p.upgradesOf(c.id)));
      return `<button class="car-item ${c.id === id ? 'active' : ''} ${own ? 'owned' : ''}" data-car="${c.id}">
        <span class="swatch" style="background:${p.paintOf(c.id)}"></span>
        <b>${c.name}</b><small>${c.tag}</small>
        <em>${sel ? '✓ فعال' : own ? 'خریداری‌شده' : `${faNum(c.price)} 🪙`}</em>
        <i class="pi">PI ${fa(pi)}</i>
      </button>`;
    }).join('');
    $('#car-list').onclick = (e) => {
      const b = e.target.closest('[data-car]');
      if (!b) return;
      this.app.audio.click();
      this.garageCar = b.dataset.car;
      this.renderGarage();
    };
    const ups = p.upgradesOf(id);
    const base = carStats(tunedPhysics(car, emptyUpgrades()));
    const phys = tunedPhysics(car, ups);
    const st = carStats(phys);
    const pi = performanceIndex(phys);
    $('#car-title').innerHTML = `${car.name} <small>${car.nameEn}</small>`;
    const bar = (label, key) => `<div class="stat"><span>${label}</span><div class="sbar"><i style="width:${(base[key] * 100).toFixed(0)}%"></i><u style="width:${((st[key] - base[key]) * 100).toFixed(0)}%"></u></div></div>`;
    $('#car-stats').innerHTML = `
      <div class="pi-badge">PI <b>${fa(pi)}</b></div>
      ${bar('سرعت', 'speed')}${bar('شتاب', 'accel')}${bar('کنترل', 'handling')}${bar('ترمز', 'braking')}${bar('نیترو', 'nitro')}
      <div class="specs">
        <span>قدرت <b>${faNum(phys.powerKW * 1.341)}</b> اسب</span>
        <span>گشتاور <b>${faNum(phys.torqueNm)}</b> N·m</span>
        <span>وزن <b>${faNum(phys.mass)}</b> kg</span>
        <span>حداکثر سرعت ~<b>${faNum(st.topSpeedKmh)}</b> km/h</span>
        <span>${DRIVE[phys.drive]}</span>
        <span>${fa(phys.gears.length)} دنده</span>
      </div>`;
    $('#upgrade-list').innerHTML = UPGRADES.map((u) => {
      const lvl = ups[u.id];
      const max = lvl >= MAX_UPGRADE;
      const cost = max ? 0 : upgradeCost(id, lvl + 1);
      const can = owned && !max && d.coins >= cost;
      const pips = Array.from({ length: MAX_UPGRADE }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
      return `<div class="upgrade">
        <div class="u-head"><span class="u-icon">${u.icon}</span><b>${u.name}</b><span class="pips">${pips}</span></div>
        <small>${u.desc}</small>
        <button class="btn ${can ? 'primary' : ''}" data-up="${u.id}" ${!owned || max ? 'disabled' : ''}>
          ${max ? 'حداکثر' : !owned ? 'ابتدا ماشین را بخرید' : `ارتقا به سطح ${fa(lvl + 1)} | ${faNum(cost)} 🪙`}
        </button>
      </div>`;
    }).join('');
    $('#upgrade-list').onclick = (e) => {
      const b = e.target.closest('[data-up]');
      if (!b || b.disabled) return;
      const r = p.buyUpgrade(id, b.dataset.up);
      if (r.ok) {
        this.app.audio.coin();
        this.toast(`ارتقا انجام شد: سطح ${fa(r.level)}`);
      } else if (r.reason === 'coins') {
        this.toast(`سکه کافی نیست (${faNum(r.cost)} 🪙 لازم است)`);
      }
      this.renderGarage();
    };
    const paint = p.paintOf(id);
    $('#paint-list').innerHTML = PAINT_COLORS.map((c) => `<button class="paint ${c === paint ? 'active' : ''}" data-paint="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');
    $('#paint-custom').value = paint;
    $('#paint-list').onclick = (e) => {
      const b = e.target.closest('[data-paint]');
      if (b) this.#paint(b.dataset.paint);
    };
    const act = $('#car-action');
    if (!owned) {
      act.textContent = `خرید ${car.name} | ${faNum(car.price)} 🪙`;
      act.disabled = false;
      act.classList.toggle('primary', d.coins >= car.price);
    } else if (d.selected !== id) {
      act.textContent = 'انتخاب این ماشین';
      act.disabled = false;
      act.classList.add('primary');
    } else {
      act.textContent = '🏁 مسابقه با این ماشین';
      act.disabled = false;
      act.classList.add('primary');
    }
    this.app.garage.showCar(id, paint);
  }

  #paint(color) {
    const id = this.garageCar;
    if (this.profile.owns(id)) {
      this.profile.setPaint(id, color);
      this.renderGarage();
    } else {
      this.app.garage.setColor(color);
      this.toast('پیش‌نمایش رنگ؛ برای ذخیره، ماشین را بخرید');
    }
  }

  #carAction() {
    const p = this.profile;
    const id = this.garageCar;
    if (!p.owns(id)) {
      const r = p.buyCar(id);
      if (r.ok) {
        this.app.audio.coin();
        this.toast(`${carById(id).name} خریداری شد! 🎉`);
      } else this.toast(`سکه کافی نیست (${faNum(carById(id).price)} 🪙 لازم است)`);
    } else if (p.data.selected !== id) {
      p.selectCar(id);
      this.toast(`${carById(id).name} انتخاب شد`);
    } else {
      this.app.go('stages');
      return;
    }
    this.renderGarage();
  }

  // ---- settings -----------------------------------------------------------------------------
  renderSettings() {
    const s = this.profile.settings;
    $$('[data-setting]').forEach((el) => {
      const v = s[el.dataset.setting];
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v;
    });
    $$('[data-setting-seg]').forEach((seg) => {
      const v = String(s[seg.dataset.settingSeg]);
      $$('button', seg).forEach((b) => b.classList.toggle('active', b.dataset.v === v));
    });
    const cur = TIERS[s.graphics];
    $('#gfx-current').innerHTML = `<b>${cur.name}</b> <small>${cur.nameEn}${cur.badge ? ` • ${cur.badge}` : ''}</small><p>${cur.description}</p>`;
    $('#gfx-list').innerHTML = TIERS.map((t) => `
      <button class="gfx ${t.index === s.graphics ? 'active' : ''} ${t.beyond ? 'beyond' : ''}" data-gfx="${t.index}">
        <span class="g-lvl">${fa(t.index + 1)}</span>
        <b>${t.name}</b>
        <small>${t.nameEn}${t.badge ? ` <em>${t.badge}</em>` : ''}</small>
        <span class="g-meter"><i style="width:${(((t.index + 1) / TIERS.length) * 100).toFixed(0)}%"></i></span>
      </button>`).join('');
    $('#gfx-list').onclick = (e) => {
      const b = e.target.closest('[data-gfx]');
      if (!b) return;
      const i = Number(b.dataset.gfx);
      this.profile.setSetting('graphics', i);
      this.app.onSettingChanged('graphics');
      this.renderSettings();
      if (i > ULTRA_MAX_INDEX) this.toast('⚠️ این سطح به سخت‌افزار بسیار قوی نیاز دارد');
    };
  }

  openSettings(returnTo) {
    this.settingsReturn = returnTo;
    this.show('settings');
  }

  // ---- modals --------------------------------------------------------------------------------
  showPause(v) {
    $('#modal-pause').hidden = !v;
  }

  showResults(r) {
    const box = $('#modal-results');
    const st = r.stage;
    $('#res-medal').textContent = medal(r.rank) || fa(r.rank);
    $('#res-medal').className = `medal m${Math.min(r.rank, 4)}`;
    $('#res-title').textContent = r.rank === 1 ? 'قهرمان شدید!' : `رتبه‌ی ${fa(r.rank)} از ${fa(FIELD_SIZE)}`;
    $('#res-sub').textContent = `${st.name} | زمان ${formatTime(r.time)} | بهترین دور ${r.bestLap ? formatTime(r.bestLap) : '--'}`;
    const rw = r.reward;
    const nextIdx = st.index + 1;
    const hasNext = nextIdx < STAGES.length && this.profile.data.unlocked > nextIdx;
    $('#res-rewards').innerHTML = `
      <div class="rw-big"><span>سکه</span><b>+${faNum(rw.coins)} 🪙</b></div>
      <div class="rw-big"><span>امتیاز</span><b>+${faNum(rw.points)} ⭐</b></div>
      <div class="rw-msg">${rw.unlockedNew ? `🔓 مرحله‌ی ${fa(nextIdx + 1)} باز شد!` : rw.passed ? '✅ مرحله پاس شد' : `برای باز شدن مرحله‌ی بعد باید رتبه‌ی ${fa(PASS_RANK)} یا بهتر بگیرید`}</div>`;
    $('#res-table').innerHTML = r.rows.map((row) => `
      <div class="res-row ${row.isPlayer ? 'me' : ''}">
        <i>${medal(row.rank) || fa(row.rank)}</i>
        <span class="sw" style="background:${row.color}"></span>
        <b>${row.name}</b><small>${row.car}</small>
        <em>${row.estimated ? '~' : ''}${formatTime(row.time)}</em>
      </div>`).join('');
    const next = $('#res-next');
    next.disabled = !hasNext;
    next.hidden = nextIdx >= STAGES.length;
    box.hidden = false;
    this.refreshWallet();
    box.querySelector('.res-row.me')?.scrollIntoView({ block: 'center' });
  }

  hideResults() {
    $('#modal-results').hidden = true;
  }

  toast(msg, ms = 2200) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  confirm(text) {
    return new Promise((resolve) => {
      const m = $('#modal-confirm');
      $('#confirm-text').textContent = text;
      m.hidden = false;
      const done = (v) => {
        m.hidden = true;
        $('#confirm-yes').onclick = $('#confirm-no').onclick = null;
        resolve(v);
      };
      $('#confirm-yes').onclick = () => done(true);
      $('#confirm-no').onclick = () => done(false);
    });
  }

  updateRotateHint(inRace) {
    const portrait = window.innerHeight > window.innerWidth * 1.1;
    const touch = (navigator.maxTouchPoints || 0) > 0;
    $('#rotate-hint').hidden = !(inRace && portrait && touch && !this.rotateDismissed);
  }
}
