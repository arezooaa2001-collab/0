import * as THREE from 'three';
import { fa, faMoney, pick } from './util.js';
import { regionAt } from './world.js';

const WNAME = { clear: 'آفتابی ☀️', cloudy: 'ابری ☁️', rain: 'بارونی 🌧️', storm: 'طوفانی ⛈️' };
const DJ = {
  pop: ['🎤 دی‌جی سارا', ['سلام به همه راننده‌های شب‌زنده‌دار! 🎶', 'یه آهنگ شاد برای همه تاکسی‌های زرد شهر 💛', 'شیشه‌ها رو بدین پایین و صدا رو زیاد کنین! 🔊']],
  sonati: ['🎻 استاد نوایی', ['بشنوید از دستگاه شور، به یاد قدیمای تهران 🌙', 'رانندگی آروم با یه ساز دلنشین... 🎶', 'سلام بر رانندگان صبور شهر 🙏']],
  electro: ['🎧 دی‌جی نیترو', ['بیس رو زیاد کن! امشب شب پروازه 🚀', 'این یکی مخصوص اونایی که با ۲۰۰ تا میرن ⚡', 'تمپو بالا، دنده بالا! 🔥']],
};
const CITY = [
  'شهرداری اعلام کرد سرعت‌گیرهای شهر رنگ جدید خوردن 🚧 آروم رد شید!',
  'یه گله شتر توی جاده کویر دیده شده 🐫 رانندگان مراقب باشن',
  'گزارش‌های تازه از دیده شدن یه نور عجیب شب‌ها توی کویر... 👽',
  'مسابقه درگ این هفته توی پیست کویر برگزار میشه 🚦 جایزه‌ها نقدی!',
  'پلیس راهور: کمربند ایمنی فراموش نشه! 🚓',
  'کارواش پمپ‌بنزین‌ها این هفته شلوغ‌تر از همیشه‌ست 🧽',
  'یه کاروان عروسی امروز توی خیابون‌های شهر بوق‌زنان رد شد 💍',
  'هواشناسی: شب‌های پاییزی کوهستان سرد و برفیه ❄️',
];

/** Small things that make the city feel alive: radio news, the Friday-night festival and rainbows after rain. */
export class Extras {
  constructor(game) {
    this.g = game;
    this.newsT = 50;
    this.buildRainbow();
    this.rainWas = 0;
    this.rainbowT = 0;
    this.fwT = 0;
  }
  /* ---------------- radio news ---------------- */
  bulletin() {
    const g = this.g, s = g.stats, w = g.weather;
    const items = [];
    if (w && w.next && w.next !== w.kind) items.push(`🌦️ هواشناسی: هوا تا چند ساعت دیگه ${WNAME[w.next]} میشه`);
    if (w && w.kind) items.push(`🌡️ وضعیت فعلی هوا: ${WNAME[w.kind]}`);
    const h = g.hour;
    if ((h >= 6.5 && h < 9.5) || (h >= 16.5 && h < 20)) items.push('🚗 ترافیک: خیابون‌های مرکز شهر الان قفله! مسیرهای کمربندی خلوت‌ترن');
    else if (h >= 23 || h < 5) items.push('🌙 ترافیک: خیابون‌ها خلوته؛ ولی مواظب دوربین‌های سرعت باشید 📸');
    if ((s.escapes || 0) > 0) items.push(`🚨 حوادث: یه تاکسی زرد تا حالا ${fa(s.escapes)} بار از دست پلیس در رفته! پلیس دنبالشه...`);
    if ((s.bounties || 0) > 0) items.push(`🎯 پلیس از یه راننده تاکسی قهرمان تشکر کرد که ${fa(s.bounties)} مجرم رو متوقف کرده 👏`);
    if (s.dragBest) items.push(`🚦 ورزش: رکورد پیست درگ کویر الان ${fa(s.dragBest.toFixed(2)).replace('.', '٫')} ثانیه‌ست!`);
    if ((s.helped || 0) > 0) items.push(`🆘 یه راننده تاکسی تا حالا به ${fa(s.helped)} نفر توی جاده کمک کرده. دمش گرم!`);
    if (g.career) {
      const r = g.career.rank();
      items.push(r === 1 ? '📊 اقتصاد: پردرآمدترین راننده شهر یه تاکسی‌ران زرده! 👑' : `📊 اقتصاد: توی رتبه‌بندی راننده‌ها، تو نفر ${fa(r)} هستی`);
    }
    if (g.day % 7 === 6) items.push('🎆 فردا شب جمعه‌ست! جشن و آتش‌بازی توی شهر برگزار میشه');
    items.push(pick(CITY));
    return pick(items);
  }
  updateNews(dt) {
    const g = this.g;
    if (!g.radio || g.state !== 'play') return;
    this.newsT -= dt;
    if (this.newsT > 0) return;
    this.newsT = 75 + Math.random() * 60;
    // a jingle, then a headline or a word from the DJ
    g.audio.tone(784, 0.12, 0.06, 'sine');
    g.audio.tone(988, 0.12, 0.06, 'sine', 0.14);
    g.audio.tone(1175, 0.2, 0.06, 'sine', 0.28);
    if (Math.random() < 0.3 && DJ[g.radio]) {
      const [name, lines] = DJ[g.radio];
      g.ui.say(name, pick(lines));
    } else g.ui.toast(`📻 خبر: ${this.bulletin()}`, 'info');
    g.stats.news = (g.stats.news || 0) + 1;
  }
  /* ---------------- Friday-night festival ---------------- */
  festival() {
    const g = this.g;
    return g.day % 7 === 0 && g.hour >= 19 && g.hour < 24;
  }
  updateFestival(dt) {
    const g = this.g, p = g.focus();
    const on = this.festival();
    if (on !== this.festOn) {
      this.festOn = on;
      if (on && g.state === 'play') g.ui.toast('🎆 جشن شب جمعه شروع شد! آتش‌بازی بالای شهر و کرایه‌ها ۲۰٪ بیشتر 🎉', 'good');
    }
    if (!on || g.state !== 'play') return;
    this.fwT -= dt;
    if (this.fwT > 0) return;
    this.fwT = 1.2 + Math.random() * 2.2;
    // shells go up over the city centre, wherever you can see them from
    if (Math.hypot(p.pos.x, p.pos.z) > 1300) return;
    const x = (Math.random() - 0.5) * 500, z = (Math.random() - 0.5) * 500;
    g.fireworks.show(x, z, 1 + Math.floor(Math.random() * 3));
  }
  /* ---------------- rainbow ---------------- */
  buildRainbow() {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 256;
    const c = cv.getContext('2d');
    const cols = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0080ff', '#4b0082', '#9400d3'];
    c.lineWidth = 9;
    cols.forEach((col, i) => {
      c.strokeStyle = col;
      c.globalAlpha = 0.55;
      c.beginPath();
      c.arc(256, 256, 236 - i * 9, Math.PI, 0);
      c.stroke();
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.rbMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
    this.rainbow = new THREE.Mesh(new THREE.PlaneGeometry(2600, 1300), this.rbMat);
    this.rainbow.visible = false;
    this.rainbow.renderOrder = -1;
    this.g.scene.add(this.rainbow);
  }
  updateRainbow(dt) {
    const g = this.g, w = g.weather, env = g.env;
    if (!w || !env) return;
    // the rain just stopped and the sun is out
    if (this.rainWas > 0.35 && w.rain < 0.08 && env.night < 0.3 && env.sunDir.y > 0.05) {
      this.rainbowT = 70;
      if (g.state === 'play') g.ui.toast('🌈 بارون بند اومد... یه رنگین‌کمان توی آسمونه!', 'good');
      g.stats.rainbows = (g.stats.rainbows || 0) + 1;
    }
    this.rainWas = w.rain > 0.35 ? w.rain : this.rainWas > 0.35 && w.rain >= 0.08 ? this.rainWas : 0;
    if (this.rainbowT > 0) this.rainbowT -= dt;
    const k = this.rainbowT > 0 ? Math.min(1, this.rainbowT / 10, (70 - this.rainbowT) / 6) * (1 - env.night) : 0;
    this.rbMat.opacity = k * 0.6;
    this.rainbow.visible = k > 0.01;
    if (!this.rainbow.visible) return;
    // opposite the sun, standing on the horizon
    const cam = g.camera.position, sd = env.sunDir;
    const ax = -sd.x, az = -sd.z, l = Math.hypot(ax, az) || 1;
    this.rainbow.position.set(cam.x + (ax / l) * 1900, cam.y - 60, cam.z + (az / l) * 1900);
    this.rainbow.lookAt(cam.x, cam.y + 40, cam.z);
  }
  update(dt) {
    this.updateNews(dt);
    this.updateFestival(dt);
    this.updateRainbow(dt);
    void faMoney;
    void regionAt;
  }
}
