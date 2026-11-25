// دستاوردها: با انجام کارهای جالب در مسابقه و شهر آزاد، مدال می‌گیری
export const ACH = [
  { id: 'coin1', icon: '🪙', name: 'اولین سکه', desc: 'یک سکه چرخان در شهر جمع کن' },
  { id: 'coins20', icon: '💰', name: 'کلکسیونر', desc: '۲۰ سکه چرخان در شهر جمع کن' },
  { id: 'jump', icon: '🚀', name: 'پرواز!', desc: 'با رمپ پرش کن' },
  { id: 'jump30', icon: '🦅', name: 'پرش بلند', desc: 'پرشی بیشتر از ۳۰ متر' },
  { id: 'drift', icon: '🔥', name: 'دریفت‌باز', desc: 'جایزه دریفت در شهر بگیر' },
  { id: 'speed', icon: '⚡', name: 'برق‌آسا', desc: 'در شهر به سرعت ۱۵۰ کیلومتر برس' },
  { id: 'boost', icon: '💨', name: 'موشک', desc: 'از سکوی سرعت رد شو' },
  { id: 'mission1', icon: '🎖️', name: 'اولین ماموریت', desc: 'یک ماموریت را کامل کن' },
  { id: 'mission5', icon: '🏆', name: 'قهرمان شهر', desc: '۵ ماموریت را کامل کن' },
  { id: 'choke', icon: '🫁', name: 'نجات‌دهنده', desc: 'کسی را از خفگی نجات بده' },
  { id: 'fire', icon: '🧑‍🚒', name: 'آتش‌نشان', desc: 'آدم‌ها را از خانه آتش‌گرفته نجات بده' },
  { id: 'clean', icon: '🧹', name: 'رفتگر محله', desc: 'یک محله را از آشغال پاک کن' },
  { id: 'chat', icon: '💬', name: 'هم‌صحبت', desc: 'با کسی که نجاتش دادی چت کن' },
  { id: 'street', icon: '🏁', name: 'قهرمان خیابان', desc: 'مسابقه خیابانی را تمام کن' },
  { id: 'goal', icon: '⚽', name: 'گل!', desc: 'در میدان شهر گل بزن' },
  { id: 'dog', icon: '🐶', name: 'دوست چهارپا', desc: 'سگ میدان را نوازش کن' },
  { id: 'tip', icon: '🎵', name: 'حامی هنر', desc: 'به رقصنده خیابانی انعام بده' },
  { id: 'coaster', icon: '🎢', name: 'عاشق هیجان', desc: 'سوار ترن هوایی شو' },
  { id: 'rides5', icon: '🎡', name: 'شهربازی‌گرد', desc: 'سوار ۵ وسیله مختلف شهربازی شو' },
  { id: 'dance', icon: '💃', name: 'رقصنده', desc: 'وسط شهر برقص' },
  { id: 'honk', icon: '📯', name: 'بوق‌زن', desc: 'بوق ماشین را بزن' },
  { id: 'race1', icon: '🥇', name: 'اولین برد', desc: 'یک مسابقه را اول شو' },
  { id: 'stage50', icon: '5️⃣', name: 'نیمه راه صد', desc: 'به مرحله ۵۰ برس' },
  { id: 'stage100', icon: '💯', name: 'صدتایی', desc: 'به مرحله ۱۰۰ برس' },
  { id: 'stage500', icon: '👑', name: 'افسانه پیست', desc: 'به مرحله ۵۰۰ برس' }
];
export function hasAch(app, id) { return !!(app.save.data.ach || {})[id]; }
export function unlockAch(app, id) {
  const S = app.save.data; S.ach = S.ach || {}; if (S.ach[id]) return false;
  const a = ACH.find((x) => x.id === id); if (!a) return false;
  S.ach[id] = Date.now(); app.save.save();
  const el = document.getElementById('achPop');
  if (el) { el.innerHTML = `<span>${a.icon}</span><div><small>دستاورد جدید!</small><b>${a.name}</b></div>`; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
  app.audio?.sfx?.('mission');
  return true;
}
export function achCount(app) { return Object.keys(app.save.data.ach || {}).length; }
