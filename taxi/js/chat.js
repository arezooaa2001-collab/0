import { REGION_NAMES } from './world.js';
import { fa, faMoney, faDist, pick } from './util.js';

const KEY_STORE = 'taxiCity.gemini.v1';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const $ = (id) => document.getElementById(id);

const JOBS = {
  m: ['معلم ریاضی', 'برنامه‌نویس', 'مهندس عمران', 'کارمند بانک', 'دانشجوی پزشکی', 'آشپز رستوران', 'عکاس', 'مکانیک', 'فروشنده موبایل', 'نقاش ساختمون'],
  f: ['معلم ادبیات', 'برنامه‌نویس', 'پرستار', 'دانشجوی معماری', 'طراح لباس', 'حسابدار', 'دندون‌پزشک', 'خبرنگار', 'مترجم', 'گرافیست'],
};
const REASONS = {
  forest: ['با دوستام یه کلبه اجاره کردیم، می‌خوایم آخر هفته رو اونجا باشیم', 'مادربزرگم اونجا زندگی می‌کنه، رفتم یه سر بهش بزنم', 'دلم یه کم هوای تازه و سکوت می‌خواد، شهر خفه‌م کرده'],
  desert: ['می‌خوام شب‌ستاره‌های کویر رو ببینم، می‌گن آسمونش بی‌نظیره', 'یه تور کویرنوردی ثبت‌نام کردم', 'برای کار عکاسی باید برم اونجا'],
  lake: ['خانواده‌م لب دریاچه منتظرن، قراره ماهی‌گیری کنیم', 'با دوستام قرار کوهنوردی داریم', 'یه ویلای کوچیک اونجا داریم'],
  farm: ['باغ پدریمه، فصل برداشته و باید کمک کنم', 'عروسی پسرعموم توی روستاست', 'یه مدت می‌خوام از شلوغی شهر دور باشم'],
  city: ['یه قرار کاری مهم دارم', 'دارم میرم دیدن یه دوست قدیمی', 'باید یه سری خرید انجام بدم'],
};
const HOBBY = ['کتاب خوندن', 'فوتبال', 'آشپزی', 'سفر', 'فیلم دیدن', 'کوهنوردی', 'عکاسی', 'موسیقی سنتی'];
const MOOD_DESC = {
  normal: 'آدم معمولی و مؤدبی هستی',
  hurry: 'خیلی عجله داری و دیرت شده، یه کم بی‌قراری',
  scared: 'از سرعت زیاد و تصادف می‌ترسی و مدام نگرانی',
  chatty: 'خیلی پرحرف و خونگرمی، دوست داری گپ بزنی و سؤال بپرسی',
  grumpy: 'بداخلاق و کم‌حوصله‌ای، جواب‌هات کوتاه و یه کم تنده',
};
const QUICK = ['سلام 👋', 'حالت چطوره؟', 'کجا میری؟', 'چیکاره‌ای؟', 'چقدر مونده؟', 'آهنگ بذارم؟'];

const norm = (s) => s.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[ً-ْ]/g, '').replace(/‌/g, ' ').toLowerCase().trim();

export class PassengerChat {
  constructor(game) {
    this.g = game;
    this.ride = null;
    this.history = [];
    this.busy = false;
    try {
      this.cfg = Object.assign({ key: '', model: DEFAULT_MODEL }, JSON.parse(localStorage.getItem(KEY_STORE) || '{}'));
    } catch (e) {
      this.cfg = { key: '', model: DEFAULT_MODEL };
    }
    this.bind();
  }

  /* ---------------- ui ---------------- */
  bind() {
    $('btnChat').addEventListener('click', () => this.toggle());
    $('chatClose').addEventListener('click', () => this.toggle(false));
    $('chatKey').addEventListener('click', () => this.showKeyBox(!$('chatKeyBox').classList.contains('hidden') ? false : true));
    $('chatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const t = $('chatInput').value.trim();
      if (!t) return;
      $('chatInput').value = '';
      this.send(t);
    });
    for (const id of ['chatInput', 'chatKeyInput', 'chatModelInput']) {
      // typing must not drive the taxi
      $(id).addEventListener('keydown', (e) => e.stopPropagation());
      $(id).addEventListener('keyup', (e) => e.stopPropagation());
    }
    $('chatKeySave').addEventListener('click', () => {
      this.cfg.key = $('chatKeyInput').value.trim();
      this.cfg.model = $('chatModelInput').value.trim() || DEFAULT_MODEL;
      this.saveCfg();
      this.showKeyBox(false);
      this.g.ui.toast(this.cfg.key ? '🤖 کلید جمنای ذخیره شد؛ مسافرها با هوش مصنوعی حرف می‌زنن' : 'حالت آفلاین فعال شد', 'good');
    });
    $('chatKeyDelete').addEventListener('click', () => {
      this.cfg.key = '';
      $('chatKeyInput').value = '';
      this.saveCfg();
      this.showKeyBox(false);
      this.g.ui.toast('کلید پاک شد؛ چت آفلاین فعاله 💬', 'info');
    });
    const quick = $('chatQuick');
    for (const q of QUICK) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = q;
      b.onclick = () => this.send(q);
      quick.appendChild(b);
    }
  }
  saveCfg() {
    try { localStorage.setItem(KEY_STORE, JSON.stringify(this.cfg)); } catch (e) { /* storage blocked */ }
    this.renderMode();
  }
  renderMode() {
    $('chatMode').textContent = this.cfg.key ? '🤖 جمنای' : '💬 آفلاین';
    $('chatMode').classList.toggle('ai', !!this.cfg.key);
  }
  showKeyBox(on) {
    $('chatKeyBox').classList.toggle('hidden', !on);
    if (on) {
      $('chatKeyInput').value = this.cfg.key;
      $('chatModelInput').value = this.cfg.model;
    }
  }
  available() {
    const r = this.g.rides;
    return !!r.ride && r.state === 'toDest';
  }
  toggle(on) {
    const el = $('chat');
    const show = on === undefined ? el.classList.contains('hidden') : on;
    if (show && !this.available()) {
      this.g.ui.toast('اول یه مسافر سوار کن تا باهاش حرف بزنی 🧍', 'warn');
      return;
    }
    el.classList.toggle('hidden', !show);
    this.g.ui.resetInputs();
    if (show) {
      this.renderMode();
      if (!this.history.length) this.opening();
      this.renderLog();
    }
  }
  renderLog() {
    const log = $('chatLog');
    log.innerHTML = '';
    for (const m of this.history) {
      const d = document.createElement('div');
      d.className = 'msg ' + (m.from === 'me' ? 'me' : m.from === 'sys' ? 'sys' : 'them');
      d.textContent = m.text;
      log.appendChild(d);
    }
    if (this.busy) {
      const d = document.createElement('div');
      d.className = 'msg them typing';
      d.textContent = 'داره می‌نویسه…';
      log.appendChild(d);
    }
    log.scrollTop = log.scrollHeight;
  }
  push(from, text) {
    this.history.push({ from, text });
    if (this.history.length > 40) this.history.shift();
    this.renderLog();
  }

  /* ---------------- lifecycle ---------------- */
  update() {
    const r = this.g.rides.ride;
    const avail = this.available();
    $('btnChat').classList.toggle('hidden', !avail);
    if (r !== this.ride) {
      // new passenger (or none): fresh conversation and backstory
      this.ride = r;
      this.history = [];
      if (r) {
        const sex = r.o.female ? 'f' : 'm';
        r.story = r.story || {
          job: pick(JOBS[sex]),
          reason: pick(REASONS[r.o.dest.region] || REASONS.city),
          hobby: pick(HOBBY),
          age: 19 + Math.floor(Math.random() * 45),
        };
      }
    }
    if (!avail && !$('chat').classList.contains('hidden')) {
      const st = this.g.rides.state;
      if (st === 'alighting' && !this.byeSaid) {
        this.byeSaid = true;
        this.push('sys', 'مسافر پیاده شد 👋');
        setTimeout(() => this.toggle(false), 1800);
      } else if (st !== 'alighting') this.toggle(false);
    }
    if (avail) this.byeSaid = false;
  }
  opening() {
    const o = this.ride.o;
    const lines = {
      normal: 'سلام، خسته نباشید 🙂',
      hurry: 'سلام! فقط تو رو خدا سریع‌تر برو، دیرم شده.',
      scared: 'سلام... فقط یه خواهش، آروم برونید لطفاً.',
      chatty: `سلااام! من ${o.name.split(' ')[0]}م. چه خوب که راه درازه، کلی می‌تونیم گپ بزنیم!`,
      grumpy: 'سلام.',
    };
    this.push('them', lines[o.mood] || lines.normal);
  }

  /* ---------------- talking ---------------- */
  async send(text) {
    if (!this.available() || this.busy) return;
    this.push('me', text);
    this.busy = true;
    this.renderLog();
    const ride = this.ride;
    try {
      let reply = null;
      if (this.cfg.key) {
        try {
          reply = await this.askGemini();
        } catch (e) {
          if (this.ride === ride) this.push('sys', '⚠️ جمنای جواب نداد (' + e.message + '). مسافر خودش جواب میده:');
        }
      } else {
        await new Promise((res) => setTimeout(res, 500 + Math.random() * 900));
      }
      // the passenger may have left meanwhile
      if (this.ride !== ride || !this.available()) return;
      if (!reply) reply = this.offlineReply(text);
      this.push('them', reply);
      this.g.audio.speak(reply);
    } finally {
      this.busy = false;
      this.renderLog();
    }
  }

  context() {
    const g = this.g, r = this.ride, o = r.o;
    const h = Math.floor(g.hour), m = Math.floor((g.hour - h) * 60);
    return {
      first: o.name.split(' ')[0],
      dest: o.kind === 'follow' ? 'هر جا که اون ماشین قرمز بره' : o.kind === 'robber' ? 'مخفیگاه' : o.dest.name,
      region: REGION_NAMES[o.dest.region] || 'شهر',
      kmh: Math.round(Math.abs(g.player.speed) * 3.6),
      left: g.guideDist || 0,
      night: g.env && g.env.night > 0.5,
      time: `${h}:${String(m).padStart(2, '0')}`,
      crashes: r.crashes || 0,
      fare: o.fare,
      story: r.story,
    };
  }

  persona() {
    const r = this.ride, o = r.o, c = this.context(), s = r.story;
    return [
      `تو «${o.name}» هستی، یه مسافر ${o.female ? 'زن' : 'مرد'} ${s.age} ساله که توی یه تاکسی نشستی (این یه بازی رانندگی ایرانیه و کاربر راننده تاکسیه).`,
      `شغلت ${o.kind === 'follow' ? 'کارآگاه خصوصی' : o.kind === 'robber' ? '(فعلاً) دزدی' : s.job}ه و به ${s.hobby} علاقه داری. داری میری «${c.dest}» توی منطقه ${c.region}، چون ${s.reason}.`,
      `اخلاقت: ${MOOD_DESC[o.mood] || MOOD_DESC.normal}.`,
      o.kind === 'robber' ? 'نقش ویژه: تو یه دزد بانک (کارتونی، مثل فیلم‌های اکشن) هستی که همین الان از بانک فرار کردی و پلیس دنبالته؛ عصبی و هیجان‌زده‌ای و مدام به راننده می‌گی تندتر بره و پلیس رو گم کنه.' : '',
      o.kind === 'follow' ? 'نقش ویژه: تو یه کارآگاه خصوصی هستی که داری با این تاکسی یه ماشین قرمز مشکوک رو تعقیب می‌کنی؛ مرموز و هیجان‌زده‌ای و نمی‌خوای لو بری.' : '',
      `وضعیت الان: ساعت ${c.time} ${c.night ? '(شبه)' : '(روزه)'}، سرعت ماشین ${c.kmh} کیلومتر بر ساعت، حدود ${faDist(c.left)} تا مقصد مونده، توی این سفر ${c.crashes} بار تصادف شده، کرایه ${faMoney(c.fare)} تومنه.`,
      'قوانین: فقط و فقط به‌عنوان همین مسافر و به فارسی محاوره‌ای و خودمونی (مثل حرف زدن واقعی توی تاکسی تهران) جواب بده.',
      'جواب‌هات کوتاه باشه (معمولاً یک تا سه جمله)، طبیعی و انسانی، گاهی خودت هم سؤال بپرس. هیچ‌وقت نگو که هوش مصنوعی یا مدل زبانی هستی و از نقش بیرون نیا.',
      'اگه سرعت خیلی زیاده یا تصادف شده، طبق اخلاقت واکنش نشون بده. اگه راننده بی‌ادبی کرد، دلخور شو.',
    ].filter(Boolean).join('\n');
  }

  async askGemini() {
    const model = (this.cfg.model || DEFAULT_MODEL).trim();
    const contents = [{ role: 'user', parts: [{ text: '(مسافر سوار تاکسی شد و نشست)' }] }];
    for (const m of this.history) {
      if (m.from === 'sys') continue;
      const role = m.from === 'me' ? 'user' : 'model';
      const last = contents[contents.length - 1];
      if (last.role === role) last.parts[0].text += '\n' + m.text;
      else contents.push({ role, parts: [{ text: m.text }] });
    }
    const gen = { temperature: 1, maxOutputTokens: 300 };
    if (/2\.5-flash/.test(model)) gen.thinkingConfig = { thinkingBudget: 0 };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    let res;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.cfg.key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: this.persona() }] }, contents, generationConfig: gen }),
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new Error(e.name === 'AbortError' ? 'زمانش طول کشید' : 'اینترنت وصل نیست');
    } finally {
      clearTimeout(timer);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data.error && data.error.message) || res.status;
      if (res.status === 400 && /api key/i.test(String(msg))) throw new Error('کلید اشتباهه');
      if (res.status === 404) throw new Error(`مدل «${model}» پیدا نشد`);
      if (res.status === 429) throw new Error('سهمیه کلید تموم شده');
      throw new Error(String(msg).slice(0, 80));
    }
    const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    const text = parts && parts.map((p) => p.text || '').join('').trim();
    if (!text) throw new Error('جواب خالی بود');
    return text;
  }

  /* ---------------- offline conversation engine ---------------- */
  offlineReply(raw) {
    const t = norm(raw);
    const c = this.context();
    const mood = this.ride.o.mood;
    const s = c.story;
    const seen = (this.ride.seen = this.ride.seen || {});
    const again = (k) => (seen[k] = (seen[k] || 0) + 1) > 1;
    const grumpy = mood === 'grumpy';
    const chatty = mood === 'chatty';
    const asked = (this.ride.asked = this.ride.asked || []);
    const ask = () => {
      if (!(chatty || Math.random() < 0.3)) return '';
      const left = ['شما چی؟', 'شما خودتون اهل کجایین؟', 'چند وقته رانندگی می‌کنید؟', 'شما هم این جاده رو زیاد میاین؟', 'از کارتون راضی هستین؟', 'تاکسی خودتونه یا اجاره‌ای؟'].filter((q) => !asked.includes(q));
      if (!left.length) return '';
      const q = pick(left);
      asked.push(q);
      return ' ' + q;
    };
    const fast = c.kmh > 110;
    let out;

    if (/احمق|خفه|بیشعور|گمشو|نفهم|(^|\s)خر($|\s)|کثافت|بی ?ادب/.test(t)) {
      out = grumpy ? 'درست صحبت کن! نگه دار همین‌جا پیاده میشم... نه، اصلاً به درک، فقط برو.' : pick(['چرا اینجوری حرف می‌زنید؟ من که حرف بدی نزدم!', 'واقعاً ازتون انتظار نداشتم. لطفاً محترمانه صحبت کنید.', 'باشه... دیگه چیزی نمی‌گم.']);
    } else if (/خداحافظ|خدانگهدار|(^|\s)بای($|\s)|bye/.test(t)) {
      out = pick(['هنوز که نرسیدیم! 😄', 'خداحافظی رو بذاریم برای وقتی رسیدیم.']);
    } else if (/سلام|درود|صبح بخیر|عصر بخیر|شب بخیر|hello|\bhi\b/.test(t)) {
      out = again('greet') ? pick(['سلام دوباره 😄', 'سلام، جانم؟']) : grumpy ? 'سلام. بریم دیگه.' : pick([`سلام، ممنون. خسته نباشید.${ask()}`, `سلام علیکم، روزتون بخیر!${ask()}`, `سلام! خوبین؟ ${c.night ? 'شب خوبی برای رانندگیه.' : 'چه روز قشنگیه.'}`]);
    } else if (/خوبی|خوبین|چطوری|چطورین|حالت|حال شما|چه خبر|خبر چه/.test(t)) {
      if (c.crashes > 0) out = `راستش با این تصادفی که کردیم هنوز دلم داره می‌لرزه...`;
      else if (mood === 'hurry') out = 'خوبم، فقط استرس دارم که دیر برسم.';
      else if (grumpy) out = 'خوبم. خسته‌ام.';
      else out = pick([`خوبم، شکر. یه کم خسته‌ام ولی خوبم.${ask()}`, `مرسی، بد نیستم. ${s.reason.split('،')[0]}، حالم بهتره.`, 'ای، می‌گذره دیگه. شما خوبین؟']);
    } else if (/اسم|کی هستی|خودتو معرفی/.test(t)) {
      out = again('name') ? `گفتم که، ${c.first} 😄` : grumpy ? `${c.first}.` : `من ${c.first}م، خوشبختم.${chatty ? ' اسم شما چیه؟' : ''}`;
    } else if (/چقدر مونده|کی میرسیم|کی می رسیم|نزدیکیم|دوره|چقد راهه|مونده/.test(t)) {
      out = c.left > 50 ? `فکر کنم حدود ${faDist(c.left)} دیگه مونده.${mood === 'hurry' ? ' تو رو خدا یه کم سریع‌تر!' : ''}` : 'دیگه رسیدیم، همین‌جاهاست!';
    } else if (/کجا|مقصد|آدرس|میری|میرین|می ری/.test(t)) {
      out = again('dest') ? `${c.dest} دیگه، یادتون رفت؟ 😅` : `${c.dest}، توی ${c.region}. ${grumpy ? '' : s.reason + '.'}`;
    } else if (/چرا|برای چی|واسه چی|چیکار داری|چه کاری|دلیل/.test(t)) {
      out = grumpy ? 'کار دارم دیگه.' : `${s.reason}. ${chatty ? 'خیلی وقته منتظر این سفرم!' : ''}`;
    } else if (/شغل|چیکاره|کار میکنی|کار می کنی|کارت چیه|درس|دانشجو/.test(t)) {
      out = grumpy ? `${s.job}م.` : `${s.job}م. ${pick(['کار سختیه ولی دوستش دارم.', 'درآمدش بد نیست ولی خسته‌کننده‌ست.', 'از بچگی آرزوم بود.'])}${ask()}`;
    } else if (/کرایه|پول|چقدر میدی|حساب|تومن|تومان/.test(t)) {
      out = `قرارمون ${faMoney(c.fare)} تومن بود دیگه. ${c.crashes ? 'البته با این تصادف‌ها باید تخفیف بدین!' : 'اگه خوب برونید انعامم میدم 😉'}`;
    } else if (/هوا|بارون|گرم|سرد|آفتاب|ستاره/.test(t)) {
      out = c.night ? pick(['شب خیلی قشنگیه، ستاره‌ها رو ببینید.', 'هوا یه کم خنک شده، خوبه.']) : pick(['هوا عالیه، حیف آدم تو خونه بمونه.', 'یه کم گرمه، کولر ماشین روشنه؟']);
    } else if (/آهنگ|موزیک|موسیقی|رادیو|ترانه|خواننده|ضبط/.test(t)) {
      out = grumpy ? 'نه، حوصله ندارم. سکوت بهتره.' : pick(['آره بذارید! یه چیز شاد باشه.', `من عاشق ${s.hobby === 'موسیقی سنتی' ? 'شجریان' : 'آهنگای قدیمی'}م. اگه دارید بذارید.`, 'صداشو کم بذارید فقط، سرم یه کم درد می‌کنه.']);
    } else if (/تند|یواش|سرعت|سریع|عجله|گاز بدم/.test(t)) {
      if (mood === 'scared') out = fast ? 'نه نه! همین الانم خیلی تنده! یواش‌تر تو رو خدا 😰' : 'همین‌جوری آروم برید خیلی خوبه، ممنون.';
      else if (mood === 'hurry') out = 'آره! هر چی سریع‌تر بهتر، دیرم شده!';
      else out = fast ? 'یه کم تند میرید ها... مواظب باشید.' : 'همین سرعت خوبه، عجله‌ای نیست.';
    } else if (/غذا|گرسنه|ناهار|شام|صبحونه|چایی|چای|قهوه/.test(t)) {
      out = pick(['اتفاقاً گرسنمه! نزدیک مقصد یه جای خوب سراغ دارم.', 'یه چایی الان خیلی می‌چسبه.', 'تازه غذا خوردم، مرسی.']);
    } else if (/خانواده|بچه|همسر|خانمت|شوهر|ازدواج|مجرد|پدر|مادر/.test(t)) {
      out = grumpy ? 'این سؤالا شخصیه.' : pick(['متأهلم، یه دختر کوچولو دارم که عاشقشم.', 'مجردم فعلاً، وقت نشده 😄', 'پدر و مادرم شهرستانن، دلم براشون تنگ شده.']);
    } else if (/فوتبال|پرسپولیس|استقلال|تیم|والیبال|بازی دیشب/.test(t)) {
      out = pick(['من طرفدار پرسپولیسم! شما چی؟', 'استقلالی‌ام، ولی این فصل دلم خونه.', 'زیاد دنبال نمی‌کنم، ولی والیبال رو دوست دارم.']);
    } else if (/جوک|بخندیم|لطیفه|بامزه/.test(t)) {
      out = pick(['یه بار یه راننده تاکسی رو بردن کلاس آشپزی، گفت فقط بلدم دور بزنم! 😄', 'جوک بلد نیستم ولی رانندگی شما خودش هیجان‌انگیزه 😅']);
    } else if (/مرسی|ممنون|متشکر|دستت درد نکنه|لطف/.test(t)) {
      out = pick(['خواهش می‌کنم 🙂', 'قربونت، وظیفه‌ست.', 'ممنون از شما.']);
    } else if (/ببخشید|شرمنده|معذرت|عذر/.test(t)) {
      out = c.crashes ? 'باشه، فقط دیگه حواستون باشه لطفاً.' : 'نه بابا، چیزی نشده.';
    } else if (/خوشگل|قشنگ|خوش تیپ|مهربون|باحال/.test(t)) {
      out = grumpy ? 'ممنون.' : 'لطف دارید، شما هم خیلی آقا هستید 🙂';
    } else if (/^(آره|اره|بله|آری|اوکی|باشه|حتما|حتماً)/.test(t)) {
      out = pick(['خب خوبه.', 'آهان، جالبه.', 'چه خوب!']);
    } else if (/^(نه|نخیر|اصلا|اصلاً)/.test(t)) {
      out = pick(['آهان، باشه.', 'جدی؟ فکر می‌کردم آره.']);
    } else if (/[?؟]$/.test(t)) {
      out = grumpy ? 'نمی‌دونم.' : pick(['والا چی بگم... سؤال سختیه 😄', 'نمی‌دونم راستش، شما نظرتون چیه؟', 'هوم، تا حالا بهش فکر نکرده بودم.']);
    } else {
      out = grumpy ? pick(['اوهوم.', 'باشه.', 'حواست به جاده باشه.']) : pick([`آره واقعاً.${ask()}`, 'جالبه، بیشتر بگید.', 'راست می‌گید.', `منم همینو فکر می‌کنم.${ask()}`]);
    }
    if (mood === 'scared' && fast && !/یواش/.test(out)) out += ' فقط یه کم یواش‌تر لطفاً 😰';
    if (c.crashes > 1 && Math.random() < 0.3) out += ' و لطفاً دیگه تصادف نکنید!';
    return out.trim();
  }
}
