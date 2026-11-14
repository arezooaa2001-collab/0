import { fa, levelFor } from './util.js';
import { regionAt } from './world.js';

/** id, icon, title, description, reward (coins), progress(game) -> [value, goal] */
const LIST = [
  ['firstRide', '🚕', 'اولین مسافر', 'اولین سفرت رو کامل کن', 5, (g) => [g.stats.completed, 1]],
  ['rides10', '🧳', 'راننده حرفه‌ای', '۱۰ سفر کامل کن', 20, (g) => [g.stats.completed, 10]],
  ['rides50', '👑', 'سلطان جاده', '۵۰ سفر کامل کن', 100, (g) => [g.stats.completed, 50]],
  ['five5', '⭐', 'پنج ستاره', '۵ بار امتیاز ۵ ستاره بگیر', 25, (g) => [g.stats.fiveStars || 0, 5]],
  ['speed150', '💨', 'پرواز روی آسفالت', 'به سرعت ۱۵۰ کیلومتر برس', 10, (g) => [Math.round(g.stats.maxKmh || 0), 150]],
  ['speed220', '🚀', 'دیوار صوتی', 'به سرعت ۲۲۰ کیلومتر برس', 40, (g) => [Math.round(g.stats.maxKmh || 0), 220]],
  ['km10', '🛣️', 'جاده‌نورد', '۱۰ کیلومتر رانندگی کن', 15, (g) => [Math.floor((g.stats.km || 0) * 10) / 10, 10]],
  ['km100', '🌍', 'دور دنیا', '۱۰۰ کیلومتر رانندگی کن', 80, (g) => [Math.floor(g.stats.km || 0), 100]],
  ['explorer', '🧭', 'جهانگرد', 'به هر ۵ منطقه سر بزن', 30, (g) => [(g.stats.regions || []).length, 5]],
  ['coins20', '🪙', 'سکه‌جمع‌کن', '۲۰ سکه از روی جاده‌ها جمع کن', 15, (g) => [g.stats.coinsPicked || 0, 20]],
  ['jump', '🚀', 'پرواز با تاکسی', 'یه پرش ۱٫۲ ثانیه‌ای بزن', 20, (g) => [Math.floor((g.stats.bestAir || 0) * 10) / 10, 1.2]],
  ['drift', '🌀', 'سلطان دریفت', 'یه دریفت ۸۰۰ امتیازی بزن', 25, (g) => [Math.round(g.stats.bestDrift || 0), 800]],
  ['race1', '🏁', 'قهرمان خیابون', 'یه مسابقه خیابونی رو ببر', 25, (g) => [g.stats.racesWon || 0, 1]],
  ['raceAll', '🏆', 'سلطان پیست', 'هر ۴ مسیر مسابقه رو ببر', 80, (g) => [(g.stats.raceTracks || []).length, 4]],
  ['nearMiss', '😱', 'از بیخ گوشش!', '۲۵ بار با سرعت از بغل ماشین‌ها رد شو (نزدیک بود!)', 20, (g) => [g.stats.nearMiss || 0, 25]],
  ['crazy', '🔥', 'راننده دیوونه', 'توی یه دور تاکسی دیوانه ۲۵۰ هزار تومن دربیار', 25, (g) => [Math.round((g.stats.crazyBest || 0) / 1000), 250]],
  ['heli', '🚁', 'گریز از آسمون', 'وقتی هلی‌کوپتر پلیس دنبالته فرار کن', 40, (g) => [g.stats.heliEscapes || 0, 1]],
  ['wedding', '💍', 'مهمون عروسی', 'یه کم پشت کاروان عروس رانندگی کن', 20, (g) => [g.stats.weddings || 0, 1]],
  ['ufo', '👽', 'تماس نزدیک', 'شب‌ها توی کویر دنبال بشقاب پرنده بگرد و برو زیر نورش', 50, (g) => [g.stats.ufo || 0, 1]],
  ['trap', '⚡', 'سرعت نور', 'با ۲۰۰ کیلومتر از زیر یه تله سرعت رد شو', 30, (g) => [g.stats.maxTrap || 0, 200]],
  ['tour', '📸', 'راهنمای تور', '۳ تا تور گردشگری رو کامل کن', 30, (g) => [g.stats.tours || 0, 3]],
  ['tycoon', '💼', 'سلطان تاکسیرانی', '۵ تا تاکسی برای شرکتت بخر', 60, (g) => [(g.stats.fleet && g.stats.fleet.taxis) || 0, 5]],
  ['parker', '🅿️', 'پارک‌بان حرفه‌ای', '۵ بار بدون زدن به هیچ ماشینی پارک کن', 25, (g) => [g.stats.cleanParks || 0, 5]],
  ['hoop', '🔥', 'شیر سیرک', 'با ماشین از وسط حلقه آتیش رد شو', 25, (g) => [g.stats.hoops || 0, 1]],
  ['statues', '🗿', 'گنج‌یاب', 'هر ۱۲ مجسمه طلایی مخفی رو پیدا کن', 150, (g) => [(g.stats.statues || []).length, g.thrills ? g.thrills.statues.length : 12]],
  ['boost', '⚡', 'موشک جاده', '۲۰ بار از روی سکوهای بوست رد شو', 15, (g) => [g.stats.boosts || 0, 20]],
  ['smash', '💥', 'خراب‌کار شهر', '۳۰ تا مخروط، سطل آشغال یا شیر آتش‌نشانی رو بزن', 15, (g) => [g.stats.smashed || 0, 30]],
  ['nitro', '🔥', 'نیتروباز', '۲۰ ثانیه از نیترو استفاده کن', 10, (g) => [Math.floor(g.stats.nitroSec || 0), 20]],
  ['escape', '🏃', 'فراری', 'از دست پلیس فرار کن', 25, (g) => [g.stats.escapes || 0, 1]],
  ['jail', '🔒', 'زندانی سابق', 'یه بار برو زندان', 5, (g) => [g.stats.jailed || 0, 1]],
  ['arson', '🧯', 'آتش‌بازی', 'تاکسی رو آتیش بزن', 5, (g) => [g.stats.arsons || 0, 1]],
  ['night', '🌙', 'شب‌کار', 'یه سفر رو شب تموم کن', 10, (g) => [g.stats.nightRides || 0, 1]],
  ['rain', '🌧️', 'رانندگی زیر بارون', 'یه سفر رو زیر بارون تموم کن', 15, (g) => [g.stats.rainRides || 0, 1]],
  ['drag1', '🚦', 'شاه درگ', 'توی پیست درگ کویر یه مسابقه ببر', 20, (g) => [g.stats.dragWins || 0, 1]],
  ['dragKing', '👑', 'سلطان ۴۰۲ متر', 'شاهین دودی رو توی درگ ببر', 80, (g) => [g.stats.dragBeat || 0, 4]],
  ['shifts', '⚡', 'دست طلایی', '۲۰ بار تعویض دنده عالی توی درگ', 25, (g) => [g.stats.perfectShifts || 0, 20]],
  ['helper', '🆘', 'فرشته جاده', 'به ۳ راننده که ماشینشون خراب شده کمک کن', 30, (g) => [g.stats.helped || 0, 3]],
  ['yield', '🚑', 'راننده با فرهنگ', 'به آمبولانس راه بده', 15, (g) => [g.stats.yielded || 0, 1]],
  ['foodie', '🍔', 'پیک حرفه‌ای', '۵ تا سفارش غذا برسون', 30, (g) => [g.stats.deliveries || 0, 5]],
  ['spin', '🌀', 'فرفره', 'توی هوا با تاکسی یه دور کامل ۳۶۰ درجه بچرخ و صاف فرود بیا', 30, (g) => [g.stats.spins || 0, 1]],
  ['bounty', '🎯', 'شکارچی جایزه', '۳ تا مجرم فراری رو با ماشینت متوقف کن', 50, (g) => [g.stats.bounties || 0, 3]],
  ['replay', '🎬', 'کارگردان', 'یه ریپلی از کارهای خفنت ببین', 5, (g) => [g.stats.replays || 0, 1]],
  ['story', '📖', 'افسانه شهر', 'همه فصل‌های داستان رو تموم کن', 120, (g) => [g.stats.career ? g.stats.career.ch + (g.stats.career.done ? 1 : 0) : 0, 7]],
];

/** daily challenges: id, icon, text, stat, goal, reward (coins) */
const DAILY = [
  ['rides', '🧳', '۳ تا مسافر برسون', 'completed', 3, 15],
  ['drift', '🌀', '۱۵۰۰ امتیاز دریفت جمع کن', 'driftPts', 1500, 15],
  ['jumps', '🚀', '۵ تا پرش بزن', 'jumps', 5, 15],
  ['near', '😱', '۱۰ بار «نزدیک بود!» بگیر', 'nearMiss', 10, 15],
  ['smash', '💥', '۱۵ تا مخروط و سطل و شیر آتش‌نشانی بزن', 'smashed', 15, 10],
  ['km', '🛣️', '۱۵ کیلومتر رانندگی کن', 'km', 15, 15],
  ['coins', '🪙', '۸ تا سکه از جاده جمع کن', 'coinsPicked', 8, 10],
  ['race', '🏁', 'یه مسابقه خیابونی ببر', 'racesWon', 1, 25],
  ['crazy', '🔥', 'یه دور تاکسی دیوانه بازی کن', 'crazyRuns', 1, 15],
  ['five', '⭐', '۲ بار امتیاز ۵ ستاره بگیر', 'fiveStars', 2, 15],
  ['drag', '🚦', 'یه مسابقه درگ ببر', 'dragWins', 1, 20],
  ['shift', '⚡', '۵ بار تعویض دنده عالی بزن', 'perfectShifts', 5, 15],
  ['deliver', '🍔', '۲ تا سفارش غذا برسون', 'deliveries', 2, 15],
  ['help', '🆘', 'به یه راننده خراب‌شده کمک کن', 'helped', 1, 15],
  ['bounty', '🎯', 'یه مجرم فراری رو بگیر', 'bounties', 1, 20],
  ['spin', '🌀', 'یه ۳۶۰ درجه توی هوا بزن', 'spins', 1, 15],
];
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export class Achievements {
  constructor(game) {
    this.g = game;
    this.t = 0;
  }
  get list() {
    return LIST;
  }
  done() {
    return (this.g.stats.ach = this.g.stats.ach || []);
  }
  /** live stats that are sampled continuously */
  track(dt) {
    const g = this.g, s = g.stats, p = g.player;
    if (s.completed == null) s.completed = s.trips || 0; // saves from before the counter existed
    if (s.xp == null) {
      s.xp = (s.completed || 0) * 70 + (s.coinsPicked || 0) * 3;
      s.level = levelFor(s.xp);
    }
    const kmh = (p.groundSpeed ?? Math.abs(p.speed)) * 3.6;
    if (g.state === 'play' && !g.onfoot.active) {
      s.maxKmh = Math.max(s.maxKmh || 0, kmh);
      s.km = (s.km || 0) + ((p.groundSpeed ?? Math.abs(p.speed)) * dt) / 1000;
      if (p.nitroOn) s.nitroSec = (s.nitroSec || 0) + dt;
    }
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 1;
    const r = regionAt(g.focus().pos.x, g.focus().pos.z);
    s.regions = s.regions || [];
    if (!s.regions.includes(r)) {
      s.regions.push(r);
      if (s.regions.length > 1) g.ui.toast(`🧭 منطقه جدید کشف شد!`, 'info');
    }
    this.checkDaily();
    const done = this.done();
    for (const [id, icon, title, , reward, prog] of LIST) {
      if (done.includes(id)) continue;
      const [v, goal] = prog(g);
      if (v >= goal) {
        done.push(id);
        g.coins += reward;
        g.addXp(reward * 2);
        g.audio.cash();
        g.ui.achievement(icon, title, reward);
        g.save();
        break; // one at a time; the next one pops a second later
      }
    }
  }
  /** pick (or keep) today's three challenges */
  daily() {
    const s = this.g.stats, key = today();
    if (!s.daily || s.daily.date !== key || !Array.isArray(s.daily.list)) {
      let h = 0;
      for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      const pool = DAILY.slice(), list = [];
      while (list.length < 3) {
        h = (h * 1103515245 + 12345) >>> 0;
        const [id, , , stat] = pool.splice(h % pool.length, 1)[0];
        list.push({ id, base: s[stat] || 0, done: false });
      }
      s.daily = { date: key, list, bonus: false };
    }
    return s.daily;
  }
  dailyProgress(item) {
    const d = DAILY.find((x) => x[0] === item.id);
    const v = (this.g.stats[d[3]] || 0) - item.base;
    return { def: d, v: Math.max(0, d[3] === 'km' ? Math.floor(v * 10) / 10 : Math.floor(v)), goal: d[4] };
  }
  checkDaily() {
    const g = this.g, D = this.daily();
    for (const it of D.list) {
      if (it.done || !DAILY.find((x) => x[0] === it.id)) continue;
      const { def, v, goal } = this.dailyProgress(it);
      if (v >= goal) {
        it.done = true;
        g.coins += def[5];
        g.addXp(def[5] * 3);
        g.audio.cash();
        g.ui.achievement(def[1], def[2], def[5], '📅 چالش روزانه انجام شد!');
        g.save();
        return;
      }
    }
    if (!D.bonus && D.list.every((it) => it.done)) {
      D.bonus = true;
      g.coins += 30;
      g.ui.achievement('🌟', 'هر سه چالش امروز رو زدی!', 30, '📅 جایزه ویژه روزانه');
      g.fireworks.show(g.player.pos.x + Math.sin(g.player.heading) * 160, g.player.pos.z + Math.cos(g.player.heading) * 160, 6);
      g.save();
    }
  }
  dailyHtml() {
    const D = this.daily();
    return `<div class="daily"><h3>📅 چالش‌های امروز <small>(هر روز عوض میشن)</small></h3>${D.list.map((it) => {
      if (!DAILY.find((x) => x[0] === it.id)) return '';
      const { def, v, goal } = this.dailyProgress(it);
      const k = Math.min(1, v / goal);
      return `<div class="ach ${it.done ? 'ok' : ''}"><span class="ai">${def[1]}</span><div><b>${def[2]}</b><small>${fa(Math.min(v, goal))} از ${fa(goal)}</small>
        <div class="ap"><i style="width:${k * 100}%"></i></div></div><span class="ar">${it.done ? '✅' : '🪙 ' + fa(def[5])}</span></div>`;
    }).join('')}${D.bonus ? '<p class="note">🌟 هر سه رو زدی! فردا چالش‌های جدید میان.</p>' : '<p class="note">هر سه رو بزنی، ۳۰ سکه جایزه ویژه می‌گیری!</p>'}</div>`;
  }
  html() {
    const g = this.g, done = this.done();
    return LIST.map(([id, icon, title, desc, reward, prog]) => {
      const ok = done.includes(id);
      const [v, goal] = prog(g);
      const k = Math.min(1, v / goal);
      return `<div class="ach ${ok ? 'ok' : ''}"><span class="ai">${icon}</span><div><b>${title}</b><small>${desc}</small>
        <div class="ap"><i style="width:${k * 100}%"></i></div></div><span class="ar">${ok ? '✅' : '🪙 ' + fa(reward)}</span></div>`;
    }).join('');
  }
}
