import { fa } from './util.js';
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
  ['nitro', '🔥', 'نیتروباز', '۲۰ ثانیه از نیترو استفاده کن', 10, (g) => [Math.floor(g.stats.nitroSec || 0), 20]],
  ['escape', '🏃', 'فراری', 'از دست پلیس فرار کن', 25, (g) => [g.stats.escapes || 0, 1]],
  ['jail', '🔒', 'زندانی سابق', 'یه بار برو زندان', 5, (g) => [g.stats.jailed || 0, 1]],
  ['arson', '🧯', 'آتش‌بازی', 'تاکسی رو آتیش بزن', 5, (g) => [g.stats.arsons || 0, 1]],
  ['night', '🌙', 'شب‌کار', 'یه سفر رو شب تموم کن', 10, (g) => [g.stats.nightRides || 0, 1]],
  ['rain', '🌧️', 'رانندگی زیر بارون', 'یه سفر رو زیر بارون تموم کن', 15, (g) => [g.stats.rainRides || 0, 1]],
];

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
    const kmh = Math.abs(p.speed) * 3.6;
    if (g.state === 'play' && !g.onfoot.active) {
      s.maxKmh = Math.max(s.maxKmh || 0, kmh);
      s.km = (s.km || 0) + (Math.abs(p.speed) * dt) / 1000;
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
    const done = this.done();
    for (const [id, icon, title, , reward, prog] of LIST) {
      if (done.includes(id)) continue;
      const [v, goal] = prog(g);
      if (v >= goal) {
        done.push(id);
        g.coins += reward;
        g.audio.cash();
        g.ui.achievement(icon, title, reward);
        g.save();
        break; // one at a time; the next one pops a second later
      }
    }
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
