import { fa, faMoney } from './util.js';

const pad = (n) => fa(String(n).padStart(2, '0'));

/** The in-game smartphone: one place for the story, messages, leaderboard, bank, radio and the other apps. */
export class Phone {
  constructor(game) {
    this.g = game;
    this.app = null;
    // other modules can add their own apps: { id, icon, name, open(phone) | html(phone), bind?(el, phone), badge?() }
    this.apps = [
      { id: 'story', icon: '📖', name: 'داستان', html: () => game.career.storyHtml() },
      { id: 'msg', icon: '💬', name: 'پیام‌ها', html: () => this.inboxHtml(), badge: () => game.career.inbox().filter((m) => !m.read).length },
      { id: 'lb', icon: '📊', name: 'رتبه‌بندی', html: () => game.career.boardHtml() },
      { id: 'bank', icon: '🏦', name: 'بانک', html: () => this.bankHtml() },
      { id: 'food', icon: '🍔', name: 'غذارسان', html: () => game.events.phoneHtml(), bind: (el, ph) => game.events.bindPhone(el, ph), badge: () => (game.events.job ? 1 : 0) },
      { id: 'drag', icon: '🚦', name: 'پیست درگ', open: () => {
        const sp = game.drag.spot;
        game.ui.closePanel();
        if (game.ui.navTo(sp.padX, sp.padZ, '🚦 پیست درگ کویر', 'کویر، شرق پارک پرش')) game.ui.toast('🚦 فلش راهنما تو رو به پیست درگ کویر می‌بره', 'good');
      } },
      { id: 'ach', icon: '🏆', name: 'افتخارات', open: () => game.ui.openAchievements() },
      { id: 'fleet', icon: '💼', name: 'شرکت', open: () => game.fleet.open() },
      { id: 'radio', icon: '📻', name: 'رادیو', html: () => this.radioHtml(), bind: (el) => this.bindRadio(el) },
      { id: 'map', icon: '🗺️', name: 'نقشه', open: () => { game.ui.closePanel(); game.ui.toggleBigMap(true); } },
      { id: 'cam', icon: '📸', name: 'دوربین', open: () => { game.ui.closePanel(); game.photo.open(); } },
      { id: 'set', icon: '⚙️', name: 'تنظیمات', open: () => game.ui.openMenu() },
    ];
  }
  addApp(app, before = 'ach') {
    const i = this.apps.findIndex((a) => a.id === before);
    this.apps.splice(i < 0 ? this.apps.length : i, 0, app);
  }
  open(appId = null) {
    const g = this.g;
    if (g.state !== 'play') return;
    g.audio.init();
    g.audio.tone(990, 0.04, 0.06, 'sine');
    this.app = appId;
    this.render();
  }
  render() {
    const g = this.g, ui = g.ui;
    const a = this.app && this.apps.find((x) => x.id === this.app);
    if (a && a.open) {
      this.app = null;
      a.open(this);
      return;
    }
    const bar = `<div class="pstat"><span>${pad(Math.floor(g.hour))}:${pad(Math.floor((g.hour % 1) * 60))}</span><span>📶 تاکسی‌نت</span><span>🔋${fa(Math.round(30 + 70 * (g.player.fuelTotal() / g.player.tank)))}٪</span></div>`;
    let body;
    if (a) body = `<div class="papp"><button class="pback" data-back>‹ برگشت</button><h3>${a.icon} ${a.name}</h3>${a.html(this)}</div>`;
    else {
      body = `<div class="pscroll"><div class="pwall"><b>${pad(Math.floor(g.hour))}:${pad(Math.floor((g.hour % 1) * 60))}</b><small>روز ${fa(g.day)} • ${faMoney(g.money)} تومان</small></div>
        <div class="pgrid">${this.apps.map((x) => {
          const n = x.badge ? x.badge() : 0;
          return `<button data-app="${x.id}"><span class="pi">${x.icon}${n ? `<em>${fa(n)}</em>` : ''}</span><small>${x.name}</small></button>`;
        }).join('')}</div></div>`;
    }
    ui.panel(`<div class="phone">${bar}${body}<div class="phome" data-home></div></div>`, (el) => {
      el.querySelector('.pbox').classList.add('phonebox');
      el.querySelectorAll('[data-app]').forEach((b) => (b.onclick = () => {
        g.audio.tone(1200, 0.03, 0.05, 'sine');
        this.app = b.dataset.app;
        this.render();
      }));
      const back = () => {
        this.app = null;
        this.render();
      };
      const bk = el.querySelector('[data-back]');
      if (bk) bk.onclick = back;
      el.querySelector('[data-home]').onclick = back;
      if (a && a.bind) a.bind(el, this);
    });
    if (a && a.id === 'msg') {
      // opening the inbox reads every message
      g.career.inbox().forEach((m) => (m.read = true));
      g.career.badge();
    }
  }
  inboxHtml() {
    const box = this.g.career.inbox();
    if (!box.length) return '<p class="note">هنوز پیامی نداری 📭</p>';
    return `<div class="sms">${box.map((m) => `<div class="${m.read ? '' : 'new'}"><b>${m.from}</b><small>روز ${fa(m.day)} • ${pad(m.hour)}:۰۰</small><p>${m.text}</p></div>`).join('')}</div>`;
  }
  bankHtml() {
    const g = this.g, s = g.stats;
    const hist = (Array.isArray(s.hist) ? s.hist : []).slice(-6).concat([s.today || 0]);
    const max = Math.max(1, ...hist);
    return `<div class="bank"><div class="bal"><small>موجودی حساب</small><b>${faMoney(g.money)} تومان</b><span>🪙 ${fa(g.coins)} سکه (${faMoney(g.coins * 10000)} تومان)</span></div>
      <div class="statgrid">${[
        ['📅', 'درآمد امروز', faMoney(s.today || 0)], ['💰', 'کل درآمد', faMoney(s.earned || 0)], ['🚨', 'جریمه‌ها', faMoney(s.finesTotal || 0)],
        ['💼', 'درآمد شرکت', faMoney((s.fleet && s.fleet.earned) || 0)], ['⛽', 'بنزین زدی', fa(s.fuelBuys || 0) + ' بار'], ['🧳', 'سفر', fa(s.completed || 0)],
      ].map(([i, t, v]) => `<div><span>${i}</span><small>${t}</small><b>${v}</b></div>`).join('')}</div>
      <h4>📈 درآمد ۷ روز اخیر</h4>
      <div class="spark">${hist.map((v, i) => `<i style="height:${Math.max(4, (v / max) * 100)}%" title="${faMoney(v)}"${i === hist.length - 1 ? ' class="now"' : ''}></i>`).join('')}</div></div>`;
  }
  radioHtml() {
    const g = this.g, list = [[null, '🔇', 'خاموش'], ['pop', '🎤', 'رادیو پاپ'], ['sonati', '🎻', 'رادیو سنتی'], ['electro', '🎧', 'رادیو الکترو']];
    return `<div class="radio">${list.map(([id, i, n]) => `<button data-st="${id || ''}" class="${(g.radio || null) === id ? 'on' : ''}">${i} ${n}</button>`).join('')}</div>
      <p class="note">مسافرها بعضی آهنگا رو خیلی دوست دارن و انعام بیشتری میدن 🎶</p>`;
  }
  bindRadio(el) {
    el.querySelectorAll('[data-st]').forEach((b) => (b.onclick = () => {
      this.g.ui.setRadio(b.dataset.st || null);
      this.render();
    }));
  }
}
