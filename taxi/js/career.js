import { fa, faMoney, pick } from './util.js';
import { levelFor } from './util.js';

const $ = (id) => document.getElementById(id);
const MENTOR = 'اوستا رضا 🔧';

/**
 * Story chapters. Each objective: [icon, text, kind, key, goal]
 *  kind 'd' = grows from the chapter start (stats delta), 'a' = absolute value, 'f' = function(game)
 */
const CHAPTERS = [
  {
    title: 'روز اول کاری',
    intro: 'سلام پسرم! خوش اومدی به خانواده تاکسی‌رونا 🚕 این سمند قراضه رو بهت سپردم، قدرش رو بدون. امروز فقط چند تا مسافر برسون و یه سری به پمپ بنزین بزن.',
    done: 'آفرین! روز اولت عالی بود. فردا کارای بزرگ‌تری داریم 💪',
    goals: [['🧳', '۳ مسافر برسون', 'd', 'completed', 3], ['💰', '۳۰۰ هزار تومن درآمد', 'd', 'earned', 300000], ['⛽', 'یه بار بنزین بزن', 'd', 'fuelBuys', 1]],
    reward: 30,
  },
  {
    title: 'راننده خیابون',
    intro: 'مسافرها ازت راضی‌ان، ولی یه راننده واقعی باید ۵ ستاره بگیره و همه شهر رو بشناسه. یه مسافر خاص (VIP، توریست یا کارآگاه) هم قبول کن.',
    done: 'دیگه یه راننده واقعی شدی! بچه‌های ایستگاه دارن درباره‌ت حرف می‌زنن 😎',
    goals: [['⭐', '۳ بار ۵ ستاره بگیر', 'd', 'fiveStars', 3], ['🛣️', '۱۰ کیلومتر رانندگی کن', 'd', 'km', 10], ['🎩', 'یه مسافر ویژه برسون', 'd', 'specialRides', 1]],
    reward: 40,
  },
  {
    title: 'شب‌های شهر',
    intro: 'شب‌ها شهر یه شکل دیگه‌ست... کرایه‌ها بیشتره ولی خیابونا خطرناک‌تر. چند تا سفر شبونه برو و یه کم هم حرکات نمایشی یاد بگیر 😉',
    done: 'شب‌ها هم مال تو شد! داری به اسم و رسم می‌رسی 🌙',
    goals: [['🌙', '۲ سفر شبانه', 'd', 'nightRides', 2], ['🚀', '۳ تا پرش', 'd', 'jumps', 3], ['😱', '۵ بار «نزدیک بود!»', 'd', 'nearMiss', 5]],
    reward: 50,
  },
  {
    title: 'رقابت',
    intro: 'یه سری بچه پولدار با ماشین‌های اسپرت ادعا می‌کنن سریع‌ترین راننده‌های شهرن. وقتشه نشونشون بدی! یه مسابقه ببر، یه دریفت درست و حسابی بزن و ثابت کن پارک کردنم بلدی.',
    done: 'دهنشون رو بستی! 🏆 حالا همه می‌دونن کی سلطان خیابوناست.',
    goals: [['🏁', 'یه مسابقه خیابونی ببر', 'd', 'racesWon', 1], ['🌀', 'یه دریفت ۵۰۰ امتیازی', 'a', 'bestDrift', 500], ['🅿️', 'چالش پارک رو ببر', 'd', 'parks', 1]],
    reward: 70,
  },
  {
    title: 'بیزینس‌من',
    intro: 'رانندگی خوبه، ولی پولدارا خودشون رانندگی نمی‌کنن! 😄 با دکمه 📱 برو تو برنامه شرکت، اولین تاکسیت رو بخر و راننده استخدام کن.',
    done: 'شرکت خودت رو داری! تبریک رئیس 💼',
    goals: [['💼', 'یه تاکسی برای شرکت بخر', 'f', (g) => [(g.stats.fleet && g.stats.fleet.taxis) || 0, 1]], ['🚗', '۲ تا ماشین داشته باش', 'f', (g) => [g.player.owned.length, 2]], ['🎖️', 'به سطح ۵ برس', 'f', (g) => [levelFor(g.stats.xp || 0), 5]]],
    reward: 90,
  },
  {
    title: 'تحت تعقیب',
    intro: 'یه شایعه شنیدم... بعضی مسافرا آدمای مشکوکی‌ان. اگه پلیس دنبالت کرد، خونسرد باش و گمشون کن. تاکسی دیوانه رو هم امتحان کن، یه کم هیجان لازم داری!',
    done: 'تو حتی از دست پلیسم در میری؟! 😅 افسانه‌ای شدی.',
    goals: [['🏃', 'از دست پلیس فرار کن', 'd', 'escapes', 1], ['🔥', 'تاکسی دیوانه: ۱۵۰ هزار تومن', 'a', 'crazyBest', 150000], ['💥', '۱۰ تا وسیله شهری بزن', 'd', 'smashed', 10]],
    reward: 100,
  },
  {
    title: 'سلطان شهر',
    intro: 'آخرین قدم! بزرگ‌ترین شرکت تاکسی‌رانی شهر رو بساز، گنج‌های طلایی رو پیدا کن و شماره یک رتبه‌بندی راننده‌ها شو 👑',
    done: 'باورم نمیشه... تو از یه سمند قراضه به سلطان شهر رسیدی! 👑🎆 بهت افتخار می‌کنم پسرم.',
    goals: [['💼', '۵ تاکسی توی شرکت', 'f', (g) => [(g.stats.fleet && g.stats.fleet.taxis) || 0, 5]], ['🗿', '۶ مجسمه طلایی', 'f', (g) => [(g.stats.statues || []).length, 6]], ['🏆', 'نفر اول رتبه‌بندی', 'f', (g) => [g.career.rank() === 1 ? 1 : 0, 1]]],
    reward: 250,
  },
];

const DRIVERS = ['مش رحیم', 'کامی سریع', 'ژیلا خانم', 'بهروز تاکسی', 'آقا مجید', 'رضا دودی', 'سیما راننده', 'فرهاد ۱۱۰', 'عمو اکبر'];

/** Career mode: story chapters with objectives, the mentor's messages and a leaderboard of rival drivers. */
export class Career {
  constructor(game) {
    this.g = game;
    this.t = 0;
    this.introT = 0;
  }
  get data() {
    const s = this.g.stats;
    if (!s.career || typeof s.career !== 'object') s.career = { ch: 0, base: null, done: false };
    return s.career;
  }
  inbox() {
    const s = this.g.stats;
    return (s.inbox = Array.isArray(s.inbox) ? s.inbox : []);
  }
  /** a new text message on the in-game phone */
  message(from, text, quiet = false) {
    const g = this.g, box = this.inbox();
    box.unshift({ from, text, day: g.day, hour: Math.floor(g.hour), read: false });
    if (box.length > 40) box.length = 40;
    if (!quiet) {
      g.audio.tone(1320, 0.08, 0.1, 'sine');
      g.audio.tone(1760, 0.12, 0.1, 'sine', 0.1);
      g.ui.toast(`📱 پیام از ${from}: ${text.length > 46 ? text.slice(0, 46) + '…' : text}`, 'info');
    }
    this.badge();
  }
  badge() {
    const n = this.inbox().filter((m) => !m.read).length;
    const b = $('phoneBadge');
    if (b) {
      b.textContent = n ? fa(n) : '';
      b.classList.toggle('hidden', !n);
    }
  }
  /** set the chapter and its baseline right away (so a reload can't pay it twice); the mentor's intro comes a bit later */
  startChapter(i, delay = 0) {
    const s = this.g.stats, D = this.data;
    D.ch = i;
    D.base = {};
    D.intro = true;
    this.introT = delay;
    const C = CHAPTERS[i];
    if (!C) return;
    for (const [, , kind, key] of C.goals) if (kind === 'd') D.base[key] = s[key] || 0;
  }
  progress(goal) {
    const g = this.g, s = g.stats, D = this.data;
    const [, , kind, key, goalV] = goal;
    if (kind === 'f') return key(g);
    if (kind === 'a') return [s[key] || 0, goalV];
    return [(s[key] || 0) - ((D.base && D.base[key]) || 0), goalV];
  }
  chapter() {
    return CHAPTERS[this.data.ch];
  }
  /* ---------------- leaderboard of rival drivers ---------------- */
  board() {
    const s = this.g.stats;
    if (!s.lb || !Array.isArray(s.lb.d)) s.lb = { day: this.g.day, d: DRIVERS.map((n, i) => ({ n, e: 200000 + i * 450000 + Math.round(Math.random() * 300000) })), top: false };
    // rivals earn every day too (and the good ones earn more)
    while (s.lb.day < this.g.day) {
      s.lb.day++;
      s.lb.d.forEach((r, i) => (r.e += Math.round((150000 + i * 70000) * (0.6 + Math.random() * 0.8) * (1 + s.lb.day * 0.04))));
    }
    return s.lb;
  }
  table() {
    const s = this.g.stats, lb = this.board();
    const rows = lb.d.map((r) => ({ n: r.n, e: r.e, me: false }));
    rows.push({ n: 'تو 🚕', e: s.earned || 0, me: true });
    rows.sort((a, b) => b.e - a.e);
    return rows;
  }
  rank() {
    return this.table().findIndex((r) => r.me) + 1;
  }
  update(dt) {
    const g = this.g;
    if (g.state !== 'play') return;
    this.t -= dt;
    this.introT -= dt;
    const D = this.data;
    if (D.intro && this.introT <= 0 && CHAPTERS[D.ch]) {
      D.intro = false;
      const C = CHAPTERS[D.ch];
      this.message(MENTOR, `📖 فصل ${fa(D.ch + 1)}: «${C.title}» — ${C.intro}`);
    }
    if (this.t > 0) return;
    this.t = 1;
    if (D.base === null) {
      // first launch (or an old save): start the story
      this.message(MENTOR, 'سلام! من اوستا رضام، صاحب تعمیرگاه. از این به بعد هوات رو دارم 😊 هر وقت خواستی گوشیت (📱) رو نگاه کن.', true);
      this.startChapter(D.ch || 0);
    }
    // leaderboard: first time at the top
    const lb = this.board();
    if (!lb.top && this.rank() === 1) {
      lb.top = true;
      g.coins += 50;
      g.ui.achievement('🏆', 'نفر اول رتبه‌بندی راننده‌های شهر!', 50, '👑 رتبه یک');
      this.message('اتحادیه تاکسی‌رانی', 'تبریک! شما پردرآمدترین راننده تاکسی شهر شدید 🏆');
    }
    const C = this.chapter();
    if (!C || D.done) return this.tracker();
    if (C.goals.every((goal) => {
      const [v, goalV] = this.progress(goal);
      return v >= goalV;
    })) {
      g.coins += C.reward;
      g.addXp(C.reward * 4);
      g.audio.cash();
      g.ui.achievement('📖', `فصل ${fa(D.ch + 1)} تموم شد: «${C.title}»`, C.reward, '🎬 داستان');
      this.message(MENTOR, C.done);
      const p = g.player;
      g.fireworks.show(p.pos.x + Math.sin(p.heading) * 150, p.pos.z + Math.cos(p.heading) * 150, 5);
      if (D.ch + 1 < CHAPTERS.length) this.startChapter(D.ch + 1, 7);
      else {
        D.done = true;
        g.stats.legend = true;
        g.coins += 100;
        setTimeout(() => g.ui.achievement('👑', 'داستان تموم شد: تو افسانه شهری!', 100, '🎬 پایان داستان'), 600);
      }
      g.save();
    }
    this.tracker();
  }
  /** small chip under the minimap: chapter and objectives done */
  tracker() {
    const el = $('storyChip');
    if (!el) return;
    const D = this.data, C = this.chapter();
    let txt = '';
    if (D.done) txt = '👑 افسانه شهر';
    else if (C) {
      const ok = C.goals.filter((goal) => {
        const [v, gv] = this.progress(goal);
        return v >= gv;
      }).length;
      txt = `📖 فصل ${fa(D.ch + 1)} • ${fa(ok)}/${fa(C.goals.length)}`;
    }
    if (txt !== this.chipText) {
      this.chipText = txt;
      el.textContent = txt;
      el.classList.toggle('hidden', !txt);
    }
  }
  /** html for the phone's story app */
  storyHtml() {
    const D = this.data, C = this.chapter();
    if (D.done || !C) return `<div class="story done">👑<b>تو افسانه شهری!</b><small>همه فصل‌های داستان رو تموم کردی. ولی شهر هنوز پر از ماجراست 😉</small></div>`;
    return `<div class="story"><small>فصل ${fa(D.ch + 1)} از ${fa(CHAPTERS.length)}</small><b>«${C.title}»</b><p>${C.intro}</p>
      ${C.goals.map((goal) => {
        const [v, gv] = this.progress(goal);
        const k = Math.min(1, v / gv), ok = v >= gv;
        const show = gv >= 10000 ? `${faMoney(Math.min(v, gv))} از ${faMoney(gv)}` : `${fa(Math.min(Math.floor(v * 10) / 10, gv)).replace('.', '٫')} از ${fa(gv)}`;
        return `<div class="ach ${ok ? 'ok' : ''}"><span class="ai">${goal[0]}</span><div><b>${goal[1]}</b><small>${show}</small><div class="ap"><i style="width:${k * 100}%"></i></div></div><span class="ar">${ok ? '✅' : ''}</span></div>`;
      }).join('')}
      <p class="note">🎁 جایزه فصل: ${fa(C.reward)} سکه</p></div>`;
  }
  boardHtml() {
    const rows = this.table();
    return `<div class="lb">${rows.map((r, i) => `<div class="${r.me ? 'me' : ''}"><span>${i < 3 ? ['🥇', '🥈', '🥉'][i] : fa(i + 1)}</span><b>${r.n}</b><small>${faMoney(r.e)}</small></div>`).join('')}</div>
      <p class="note">رتبه‌بندی بر اساس کل درآمد. بقیه راننده‌ها هم هر روز کار می‌کنن!</p>`;
  }
  static pickRival() {
    return pick(DRIVERS);
  }
}
