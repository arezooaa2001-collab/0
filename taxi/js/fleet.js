import { buildCar } from './models.js';
import { TrafficCar } from './traffic.js';
import { fa, faMoney } from './util.js';

const PRICES = [800000, 1200000, 1800000, 2600000, 3600000, 5000000, 7000000, 9500000];
const BASE = 8000; // per taxi per in-game hour
const UPGRADES = [
  ['app', '📱', 'اپلیکیشن درخواست آنلاین', 'مسافرهای بیشتر، ۲۵٪ درآمد بیشتر', 1500000],
  ['pro', '🧑‍✈️', 'راننده‌های حرفه‌ای', 'مسافرها راضی‌ترن، ۲۵٪ درآمد بیشتر', 2200000],
  ['shop', '🛠️', 'تعمیرگاه اختصاصی', 'ماشین‌ها کمتر می‌خوابن، ۲۵٪ درآمد بیشتر', 3000000],
];
const HOUR = 30; // real seconds per in-game hour (DAY_SECONDS / 24)

/** Your own taxi company: buy taxis and upgrades, they earn money while you drive. */
export class Fleet {
  constructor(game) {
    this.g = game;
    this.t = 0;
    this.cars = [];
  }
  get data() {
    const s = this.g.stats;
    if (!s.fleet || typeof s.fleet !== 'object') s.fleet = { taxis: 0, ups: [], earned: 0, pending: 0 };
    if (!Array.isArray(s.fleet.ups)) s.fleet.ups = [];
    return s.fleet;
  }
  perHour() {
    const d = this.data;
    return Math.round(d.taxis * BASE * (1 + 0.25 * d.ups.length));
  }
  /** your company's taxis show up in traffic */
  syncTraffic() {
    const g = this.g, want = Math.min(6, this.data.taxis);
    while (this.cars.length < want) {
      if (!this.tpl) this.tpl = buildCar({ type: 'taxi', color: 0xf3c614 }).root;
      const c = new TrafficCar(g.traffic, this.tpl);
      c.isFleet = true;
      g.traffic.cars.push(c);
      this.cars.push(c);
    }
  }
  update(dt) {
    const g = this.g, d = this.data;
    if (!d.taxis || g.state !== 'play') return;
    if (this.cars.length < Math.min(6, d.taxis)) this.syncTraffic();
    d.pending += (this.perHour() / HOUR) * dt;
    this.t += dt;
    // pay out every two in-game hours
    if (this.t >= HOUR * 2 && d.pending >= 1000) {
      this.t = 0;
      const pay = Math.floor(d.pending / 1000) * 1000;
      d.pending -= pay;
      d.earned += pay;
      g.money += pay;
      g.audio.cash();
      g.ui.toast(`💼 تاکسی‌های شرکتت کار کردن: +${faMoney(pay)} تومان`, 'good');
    }
  }
  open() {
    const g = this.g, ui = g.ui;
    if (g.state !== 'play') return;
    const render = () => {
      const d = this.data, next = PRICES[d.taxis];
      ui.panel(`<h2>💼 شرکت تاکسیرانی تو</h2>
        <div class="statrow"><span>🚕 ${fa(d.taxis)} تاکسی</span><span>💰 درآمد هر ساعت: ${faMoney(this.perHour())}</span><span>📈 تا حالا: ${faMoney(d.earned)}</span></div>
        <p class="note">تاکسی بخر و راننده استخدام کن؛ وقتی خودت داری رانندگی می‌کنی اونا هم برات پول درمیارن (هر ۲ ساعت توی بازی حساب میشه). تاکسی‌های شرکتت توی شهر هم می‌چرخن!</p>
        <div class="grid2">
          <div class="card"><h3>🚕 تاکسی جدید + راننده</h3><p>هر تاکسی ساعتی ${faMoney(BASE)} تومان (قبل از ارتقاها)</p>
            ${next ? `<button data-a="buy">خرید تاکسی ${fa(d.taxis + 1)} • ${faMoney(next)}</button>` : '<button disabled>ناوگانت کامله ✔</button>'}</div>
          ${UPGRADES.map(([id, icon, name, desc, price]) => `<div class="card"><h3>${icon} ${name}</h3><p>${desc}</p>
            ${d.ups.includes(id) ? '<button disabled>✔ خریدی</button>' : `<button data-up="${id}" ${d.taxis ? '' : 'disabled'}>خرید • ${faMoney(price)}</button>`}</div>`).join('')}
        </div>
        <p class="money">موجودی: ${faMoney(g.money)} تومان${g.coins ? ` + 🪙 ${fa(g.coins)} سکه` : ''}</p>`, (el) => {
        const pay = (cost) => {
          g.topUp(cost);
          if (g.money < cost) {
            ui.toast('پول کافی نداری 😟', 'warn');
            g.audio.bad();
            return false;
          }
          g.money -= cost;
          g.audio.cash();
          return true;
        };
        const b = el.querySelector('[data-a=buy]');
        if (b) b.onclick = () => {
          if (!pay(PRICES[d.taxis])) return;
          d.taxis++;
          this.syncTraffic();
          ui.toast(`🚕 تاکسی شماره ${fa(d.taxis)} به شرکتت اضافه شد!`, 'good');
          g.save();
          render();
        };
        el.querySelectorAll('[data-up]').forEach((btn) => {
          btn.onclick = () => {
            const u = UPGRADES.find((x) => x[0] === btn.dataset.up);
            if (!u || d.ups.includes(u[0]) || !pay(u[4])) return;
            d.ups.push(u[0]);
            ui.toast(`${u[1]} ${u[2]} راه افتاد! درآمد بیشتر شد 📈`, 'good');
            g.save();
            render();
          };
        });
      });
    };
    render();
  }
}
