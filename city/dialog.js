/* Conversation system: every person in the city has a persona and a memory.
   Offline: a Persian dialogue engine (intent detection + context + memory).
   Online (optional): if the player saves a Claude API key, replies come from Claude. */

const rnd = a => a[Math.floor(Math.random() * a.length)];
const fa = s => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

const MALE = ['علی', 'محمد', 'حسین', 'رضا', 'مهدی', 'امیر', 'سعید', 'حمید', 'کامران', 'بهرام', 'داریوش', 'فرهاد', 'مجید', 'نیما', 'آرش', 'کاوه', 'پویا', 'سینا', 'بابک', 'جواد', 'هومن', 'مازیار', 'یوسف', 'اکبر'];
const FEMALE = ['مریم', 'زهرا', 'فاطمه', 'سارا', 'نرگس', 'لیلا', 'شیرین', 'مینا', 'نازنین', 'الهام', 'پریسا', 'سمیرا', 'ترانه', 'آزاده', 'مهسا', 'رویا', 'هستی', 'یاسمن', 'گلاره', 'نسرین', 'فرشته', 'منیژه'];
const FAMILY = ['احمدی', 'رضایی', 'کریمی', 'حسینی', 'موسوی', 'تهرانی', 'شیرازی', 'کاظمی', 'رستمی', 'نوری', 'صادقی', 'جعفری', 'یزدانی', 'مرادی', 'بهرامی'];
const JOBS = [
  ['معلم ریاضی', 'سر کلاس بچه‌ها رو با معادله اذیت می‌کنم!'], ['راننده تاکسی', 'از صبح تا شب تو همین خیابونا مسافر می‌برم.'], ['دانشجوی معماری', 'شبا تا صبح ماکت می‌سازم.'],
  ['پرستار', 'شیفت شب بیمارستانم، الان تازه تموم شد.'], ['نانوا', 'ساعت چهار صبح بیدار می‌شم که نون تازه دستتون برسه.'], ['مهندس برق', 'تیر چراغ‌های همین خیابونا کار ماست.'],
  ['بازنشسته', 'سی سال کارمند اداره بودم، حالا فقط قدم می‌زنم.'], ['فروشنده', 'تو یکی از مغازه‌های همین محله کار می‌کنم.'], ['برنامه‌نویس', 'کل روز پشت کامپیوترم، الان اومدم هوا بخورم.'],
  ['نقاش', 'دنبال رنگای غروب این شهرم.'], ['آشپز', 'تو یه رستوران قورمه‌سبزی درست می‌کنم.'], ['کارمند بانک', 'کل روز عدد می‌شمرم.'], ['پزشک', 'مطبم همین نزدیکیه.'],
  ['مکانیک', 'هر ماشینی خراب بشه دستم بهش می‌رسه.'], ['دانش‌آموز', 'امروز مدرسه تعطیل بود!'], ['خبرنگار', 'دنبال یه خبر داغم.'], ['گلفروش', 'گل‌های یاس امروز خیلی قشنگن.']];
const HOBBY = ['کوه‌نوردی', 'کتاب خوندن', 'فوتبال', 'عکاسی', 'آشپزی', 'شعر حافظ', 'سه‌تار زدن', 'شطرنج', 'دوچرخه‌سواری', 'فیلم دیدن', 'باغبونی', 'خطاطی'];
const FOOD = ['قورمه‌سبزی', 'کباب کوبیده', 'زرشک‌پلو با مرغ', 'آش رشته', 'فسنجون', 'دیزی', 'کشک بادمجون', 'پیتزا', 'ماکارونی', 'میرزا قاسمی', 'باقالی‌پلو'];
const COLOR = ['آبی', 'سبز', 'قرمز', 'زرد', 'بنفش', 'فیروزه‌ای', 'نارنجی', 'مشکی', 'سفید'];
const MUSIC = ['شجریان', 'موسیقی سنتی', 'پاپ', 'راک', 'گوگوش', 'موسیقی کلاسیک', 'جاز', 'محلی'];
const TRAITS = ['warm', 'warm', 'funny', 'shy', 'grumpy', 'wise', 'chatty'];
const JOKES = [
  'یه روز یه حلزون رفت دکتر، دکتر گفت: چرا دیر اومدی؟ گفت: آقای دکتر، من که از صبح راه افتادم!',
  'به یکی گفتن چرا ساعتتو انداختی پایین؟ گفت می‌خواستم ببینم زمان چطوری می‌گذره!',
  'معلم پرسید: بچه‌ها، چرا پرنده‌ها زمستون می‌رن جنوب؟ یکی گفت: چون پیاده خیلی راهه آقا!',
  'یارو رفت نونوایی گفت: نون تازه دارین؟ گفت: نه، فردا بیا! گفت: فردا هم میگی فردا بیا!',
  'به ماهی گفتن چرا حرف نمی‌زنی؟ گفت: دهنم پر آبه!',
  'یکی زنگ زد آتش‌نشانی گفت: آشپزخونه‌م آتیش گرفته! گفتن: چطوری بیایم؟ گفت: مگه دیگه ماشین قرمز ندارین؟',
  'به یکی گفتن قورمه‌سبزی دوست داری؟ گفت: نه بابا، من فقط با برنجش دوستم!',
  'گفتم امروز ورزش می‌کنم؛ دو بار رفتم سر یخچال و برگشتم، حساب میشه؟'];
const SMALLTALK = ['هوای امروز خیلی خوبه، نه؟', 'دیروز رفتم بازار، همه چی گرون شده!', 'شنیدی نانوایی سر کوچه نون بربری تازه داره؟', 'بچه‌ها امروز تو پارک فوتبال بازی می‌کردن.',
  'این ماشینا چقدر سریع رانندگی می‌کنن!', 'فردا مهمونی داریم، باید شیرینی بخرم.', 'چراغ راهنمایی سر چهارراه خیلی طول می‌کشه.', 'آخر هفته بریم کوه؟'];
const STOP_NAMES = new Set(['چی', 'چیه', 'کی', 'کیه', 'کجا', 'چطور', 'خوب', 'خوبم', 'خسته', 'ناراحت', 'خوشحال', 'گرسنه', 'گشنه', 'تنها', 'اینجا', 'اونجا', 'یه', 'یک', 'هم', 'دیگه', 'الان', 'گم', 'مریض', 'بیکار', 'آدم', 'رباط', 'ربات']);

export function makePersona(look, isFemale) {
  const female = isFemale ?? (look.style === 'scarf' || look.style === 'long');
  const [job, jobLine] = rnd(JOBS);
  const age = job === 'دانش‌آموز' ? 13 + Math.floor(Math.random() * 5) : job === 'بازنشسته' ? 60 + Math.floor(Math.random() * 15) : 19 + Math.floor(Math.random() * 40);
  return {
    name: rnd(female ? FEMALE : MALE), family: rnd(FAMILY), female, age, job, jobLine,
    hobby: rnd(HOBBY), food: rnd(FOOD), color: rnd(COLOR), music: rnd(MUSIC), trait: rnd(TRAITS),
    married: age > 28 && Math.random() < 0.6, kids: age > 32 ? Math.floor(Math.random() * 4) : 0,
    mood: 0.5 + Math.random() * 0.4, rel: 0, met: 0,
    mem: { playerName: null, pending: null, insults: 0, facts: {}, used: new Set(), lastTopic: null, hitByPlayer: 0, carTaken: false },
    hist: []
  };
}

/* ---------- text normalisation ---------- */
export function norm(s) {
  return s.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[ة]/g, 'ه').replace(/[أإ]/g, 'ا').replace(/[ً-ْٰ]/g, '')
    .replace(/‌/g, ' ').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[؟?!.,،;:«»"'()\-_]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}
const hasQ = t => /(^| )(چی|چرا|کی|کجا|چطور|چطوری|چند|چندتا|آیا|کدوم|کدام|چه|مگه)( |$)/.test(t);

/* ---------- reply styling by personality ---------- */
function style(p, text) {
  const r = Math.random();
  switch (p.trait) {
    case 'warm': return r < 0.3 ? text.replace(/[.!؟]?$/, m => ' عزیزم' + (m || '.')) : text;
    case 'funny': return r < 0.25 ? text + ' هه هه!' : text;
    case 'shy': return r < 0.35 ? 'اِم... ' + text : text;
    case 'grumpy': return r < 0.3 ? 'هوم. ' + text : text;
    case 'wise': return r < 0.2 ? text + ' به قول حافظ: «هر که را خوابگه آخر مشتی خاک است...»' : text;
    case 'chatty': return r < 0.35 ? text + ' ' + rnd(SMALLTALK) : text;
  }
  return text;
}
function pickFresh(p, key, arr) {
  const avail = arr.filter((_, i) => !p.mem.used.has(key + i));
  const list = avail.length ? avail : arr;
  const v = rnd(list); p.mem.used.add(key + arr.indexOf(v)); return v;
}
const callName = (p, reply) => p.mem.playerName && !reply.includes(p.mem.playerName) ? rnd(['', '', p.mem.playerName + ' جان، ', p.mem.playerName + '، ']) : '';

/* ---------- places & directions ---------- */
export function findPlace(t, places) {
  let best = null, bestScore = 0;
  for (const pl of places) {
    let sc = 0;
    for (const k of pl.keys) if (k.length > 1 && t.includes(k)) sc += k.length;
    if (sc > bestScore || (sc === bestScore && sc > 0 && pl.dist < best.dist)) { best = pl; bestScore = sc; }
  }
  return bestScore > 0 ? best : null;
}

/* ---------- intents ---------- */
const I = [];
const def = (id, re, fn) => I.push({ id, re, fn });

def('greet', /(^| )(سلام|درود|سلامتی|صبح بخیر|ظهر بخیر|عصر بخیر|شب بخیر|خسته نباشی|خسته نباشید|هلو|salam|slm|hello|hi)( |$)/, (p, c) => {
  p.met++;
  const hr = c.hour;
  const tod = hr < 11 ? 'صبح بخیر' : hr < 16 ? 'ظهر بخیر' : hr < 20 ? 'عصر بخیر' : 'شب بخیر';
  if (p.mem.hitByPlayer > 0 && p.rel < 0) return { r: 'سلام؟! تو همونی نیستی که با ماشین زدی به من؟ هنوز کمرم درد می‌کنه!' };
  if (p.met > 1) return { r: rnd([`سلام دوباره ${p.mem.playerName || ''}! چه خبر؟`, 'باز هم سلام! دلت برام تنگ شده بود؟', `به به، ${callName(p)}سلام!`]) };
  const q = !p.mem.playerName && Math.random() < 0.45;
  if (q) p.mem.pending = 'playerName';
  return { r: rnd([`سلام! ${tod}.`, `علیک سلام! ${tod}، خوش اومدی به محله.`, `سلام، ${tod}! حالت چطوره؟`, `درود! ${tod}.`]) + (q ? ' اسمت چیه؟' : ''), a: 'wave' };
});
def('howareyou', /(چطوری|خوبی|حالت|احوال|چه خبر|چخبر|خوب هستی|خوب هستید|روبراهی|سرحالی|خوبید|chetori|khobi)/, p => {
  const m = p.mood;
  const r = m > 0.7 ? rnd(['عالی‌ام، مرسی! امروز روز خوبیه.', 'خیلی خوبم! تو چطوری؟', 'شکر خدا خوبم، مرسی که پرسیدی.'])
    : m > 0.4 ? rnd(['بد نیستم، می‌گذرونیم.', 'خوبم، یه کم خسته‌ام.', 'ای، هستیم. تو خوبی؟'])
      : rnd(['راستش امروز حال و حوصله ندارم.', 'زیاد خوب نیستم، ولی مرسی.', 'خسته‌ام، از صبح دارم می‌دوم.']);
  p.mem.pending = 'playerMood';
  return { r };
});
def('askName', /(اسمت|اسم شما|اسمتون|اسم تو|کی هستی|شما کی هستید|چی صدات|اسمت چیه|esmet)/, p => {
  p.mem.pending = p.mem.playerName ? null : 'playerName';
  return { r: rnd([`من ${p.name}‌ام، ${p.name} ${p.family}.`, `اسمم ${p.name}ه.`, `${p.name} هستم، خوشبختم!`]) + (p.mem.playerName ? '' : ' اسم تو چیه؟') };
});
def('tellName', /(?:اسم من|اسمم|اسم من هم|صدام کن|بهم بگو|من)\s+([^\s]{2,15})(?:\s+(?:است|هست|هستم|ام|ه))?(?:\s|$)/, (p, c, m, t) => {
  if (!/(اسم|صدام|بهم بگو|هستم|ام$)/.test(t) || /(اسم من چیه|اسمم چیه|اسم من چی)/.test(t)) return null;
  let n = m[1].replace(/(ه|ام|هستم)$/, '');
  if (STOP_NAMES.has(n) || STOP_NAMES.has(m[1])) return null;
  return setName(p, c, n);
});
def('askMyName', /(اسم من چیه|اسمم چیه|منو میشناسی|منو یادته|یادته اسمم|من کی ام|من کیم)/, p => {
  if (p.mem.playerName) return { r: rnd([`معلومه که یادمه! تو ${p.mem.playerName} هستی.`, `${p.mem.playerName}! مگه میشه یادم بره؟`]) };
  p.mem.pending = 'playerName'; return { r: 'راستش هنوز اسمتو بهم نگفتی! اسمت چیه؟' };
});
def('age', /(چند سالته|سنت|چند سال داری|چند سالتون|سن شما|چندسالته)/, p => ({ r: p.age > 60 ? `${fa(p.age)} سالمه، ولی دلم هنوز جوونه!` : `${fa(p.age)} سالمه. تو چند سالته؟`, pend: 'playerAge' }));
def('job', /(کارت چیه|چیکاره|چه کاره|شغلت|شغل شما|کجا کار|چکاره|چیکار میکنی تو زندگی|درس میخونی)/, p => { p.mem.pending = 'playerJob'; return { r: `من ${p.job}‌م. ${p.jobLine} تو چیکاره‌ای؟` }; });
def('live', /(کجا زندگی|خونت کجا|خونه‌ت کجا|خونتون کجا|کجا میشینی|اهل کجایی|بچه کجایی|ساکن کجا)/, (p, c) => { p.mem.pending = 'playerFrom'; return { r: `خونه‌م همین نزدیکیه، تو ${c.home}. بچه‌ی همین محله‌ام. تو اهل کجایی؟` }; });
def('where', /(کجاست|کجا هست|کجاس|کجان|کجا میشه|آدرس|چطوری برم|چطور برم|راه|کجا برم|نزدیک ترین|نزدیکترین|میخوام برم|سراغ|پیدا کنم|kojast)/, (p, c, m, t) => {
  const pl = findPlace(t, c.places);
  if (!pl) { p.mem.pending = 'whereTo'; return { r: 'کجا رو می‌خوای؟ نانوایی، کافه، داروخانه، سوپرمارکت، پارک... بگو تا نشونت بدم.' }; }
  return route(p, c, pl);
});
def('time', /(ساعت چنده|ساعت چند|چه ساعتیه|ساعت رو داری|وقت داری بگی|چه وقته)/, (p, c) => ({ r: `الان ساعت ${c.timeStr}ه. ` + (c.hour >= 21 || c.hour < 5 ? 'دیروقته‌ها! مواظب خودت باش.' : c.hour < 10 ? 'هنوز صبح زوده.' : '') }));
def('weather', /(هوا|بارون|باران|آفتاب|سرده|گرمه|ابری|برف|weather)/, (p, c) => ({ r: c.weather === 'rain' ? rnd(['داره بارون میاد! چتر داری؟', 'بارونش عالیه، ولی خیس شدم!', 'هوای بارونی رو دوست دارم، بوی خاک بارون خورده...']) : c.weather === 'cloudy' ? rnd(['هوا ابریه، فکر کنم بارون بیاد.', 'آسمون گرفته‌ست، چتر بردار.']) : c.hour >= 20 || c.hour < 5 ? 'شب قشنگیه، ستاره‌ها رو ببین!' : rnd(['هوا عالیه! بهترین وقت برای قدم زدنه.', 'آفتابیه، حیفه آدم تو خونه بمونه.']) }));
def('thanks', /(مرسی|ممنون|متشکرم|متشکر|دستت درد نکنه|قربونت|سپاس|لطف کردی|merci|mersi|mamnoon)/, p => { p.rel += 0.5; return { r: rnd(['خواهش می‌کنم!', 'قابلی نداشت.', 'کاری نکردم که!', 'وظیفه بود.', 'فدات!']) }; });
def('bye', /(خداحافظ|خدافظ|بای|فعلا|خدانگهدار|میبینمت|می‌بینمت|برم دیگه|شب خوش|bye|khodafez)/, p => ({ r: rnd(['خداحافظ! مواظب خودت باش.', 'به سلامت! باز هم بیا.', 'فعلاً! روز خوبی داشته باشی.', `خدانگهدار ${p.mem.playerName || ''}!`]), a: 'wave', end: true }));
def('compliment', /(خوشگلی|قشنگی|مهربونی|باحالی|خیلی خوبی|دوستت دارم|عالی هستی|نازی|خوش تیپی|ماهی|گلی)/, p => { p.rel += 1; p.mood = Math.min(1, p.mood + 0.1); return { r: p.trait === 'shy' ? 'اِ... مرسی، خجالتم دادی!' : p.trait === 'grumpy' ? 'خب... مرسی. زیاد تعریف نکن.' : rnd(['وای مرسی! تو هم خیلی گلی.', 'لطف داری! چشمات قشنگ می‌بینه.', 'ممنون، روزمو ساختی!']) }; });
def('insult', /(احمق|خری|خر |بیشعور|دیوونه|زشتی|خفه شو|گمشو|گم شو|نفهم|کثافت|بی ادب|بی‌ادب|مسخره|کودن|بیخود)/, p => {
  p.mem.insults++; p.rel -= 2; p.mood = Math.max(0, p.mood - 0.25);
  if (p.mem.insults >= 3) return { r: 'دیگه بسه! من با آدم بی‌ادب حرف نمی‌زنم.', a: 'leave', end: true };
  return { r: rnd(['چرا اینطوری حرف می‌زنی؟ من که کاریت نداشتم!', 'لطفاً مؤدب باش.', 'خجالت بکش! این چه طرز حرف زدنه؟', 'بهت برنخوره، ولی خودتی!']) };
});
def('joke', /(جوک|لطیفه|بخندون|یه چیز خنده دار|خنده‌دار|شوخی)/, p => ({ r: pickFresh(p, 'j', JOKES), a: 'laugh' }));
def('laugh', /(^| )(هه|خخخ|خخ|هاها|ها ها|خنده|lol|😂)/, () => ({ r: rnd(['خوشحالم خندیدی!', 'می‌دونستم خوشت میاد!', 'هه هه، خودمم خنده‌م گرفت.']), a: 'laugh' }));
def('follow', /(دنبالم بیا|با من بیا|همراهم بیا|بیا بریم|بریم با هم|همراه من|دنبال من بیا|بیا اینجا)/, p => {
  if (p.rel < -1) return { r: 'نه خیر! با تو هیچ‌جا نمیام.' };
  if (p.trait === 'grumpy' && Math.random() < 0.4) return { r: 'حوصله ندارم، کار دارم.' };
  return { r: rnd(['باشه، بریم! جلو برو.', 'حتماً، پشت سرتم.', 'بریم ببینیم کجا می‌بری منو!']), a: 'follow' };
});
def('stop', /(وایسا|صبر کن|همینجا بمون|بمون|نیا دیگه|دیگه نیا|ولم کن|برو خونه|دنبالم نیا|برو دیگه)/, () => ({ r: rnd(['باشه، همینجا می‌مونم.', 'چشم، وایمیستم.', 'باشه، من دیگه میرم سراغ کارم.']), a: 'stop' }));
def('dance', /(برقص|رقص|قر بده|بزن برقص)/, p => p.trait === 'shy' ? { r: 'وای نه، خجالت می‌کشم... باشه فقط یه کم!', a: 'dance' } : { r: rnd(['آهنگ بذار تا ببینی!', 'حالا که اصرار می‌کنی... ببین!', 'رقص من حرف نداره!']), a: 'dance' });
def('sit', /(بشین|بنشین|بفرما بشین)/, () => ({ r: 'آخیش، پاهام خسته شده بود.', a: 'sit' }));
def('wave', /(دست تکون بده|دست بده|بای بای کن|دست بزن)/, () => ({ r: 'سلام سلام!', a: 'wave' }));
def('food', /(غذا|گشنمه|گرسنمه|گرسنه|رستوران|چی بخورم|ناهار|شام|صبحونه|خوراکی)/, (p, c) => {
  const pl = c.places.filter(x => /نانوایی|کافه|شیرینی|بستنی|سوپر|میوه|قنادی|لبنیات|آجیل/.test(x.name)).sort((a, b) => a.dist - b.dist)[0];
  return { r: `من عاشق ${p.food}م! ` + (pl ? `اگه گشنته، ${pl.name} همین نزدیکیه، ${pl.how}.` : ''), guide: pl };
});
def('fav', /(مورد علاقه|علاقه داری|دوست داری|خوشت میاد|عاشق چی|سرگرمی|تفریح)/, (p, c, m, t) => {
  if (/رنگ/.test(t)) return { r: `رنگ ${p.color}! تو چه رنگی دوست داری؟`, pend: 'playerColor' };
  if (/غذا/.test(t)) return { r: `${p.food}، بدون شک!` };
  if (/آهنگ|موسیقی|خواننده|موزیک/.test(t)) return { r: `من ${p.music} گوش میدم. تو چی؟`, pend: 'playerMusic' };
  if (/ورزش|فوتبال|تیم/.test(t)) return { r: rnd(['فوتبال! شبا با دوستام بازی می‌کنیم.', 'پیاده‌روی تو همین پارک بهترین ورزشه.', 'والیبال دوست دارم.']) };
  return { r: `تو وقت آزادم ${p.hobby} کار می‌کنم. تو چی دوست داری؟`, pend: 'playerHobby' };
});
def('family', /(زن داری|شوهر داری|ازدواج|مجردی|متاهلی|متأهلی|بچه داری|خانواده|بچه‌هات|همسر)/, p => ({ r: p.married ? `آره، متأهلم${p.kids ? ` و ${fa(p.kids)} تا بچه دارم، شیطونای خونه‌ان!` : '.'}` : rnd(['مجردم فعلاً!', 'نه هنوز، دنبال آدم درستش می‌گردم!']) }));
def('city', /(این شهر|شهر آزاد|این محله|اینجا کجاست|کجاییم|اسم اینجا|محله)/, (p, c) => ({ r: `اینجا شهر آزاده! الان تو ${c.place} هستیم. پارک مرکزی و فواره‌ش رو ندیدی؟ شبا خیلی قشنگه.` }));
def('feelBad', /(ناراحتم|غمگینم|افسرده|دلم گرفته|حالم بده|خسته‌ام|خسته ام|حوصلم سر رفته|حوصله ندارم|تنهام|تنها هستم)/, p => { p.rel += 0.5; return { r: rnd(['آخی، چی شده؟ بیا یه کم قدم بزنیم حالت بهتر میشه.', 'غصه نخور، همه چی درست میشه.', 'یه چای داغ بخور، حالت جا میاد. اگه بخوای باهات میام.', 'من اینجام، اگه خواستی حرف بزن.']) }; });
def('feelGood', /(خوشحالم|خوبم|عالیم|عالی‌ام|سرحالم|بد نیستم|شکر)/, (p) => (p.mem.pending === 'playerMood' || Math.random() < 0.8) ? { r: rnd(['خدا رو شکر! همیشه خوب باشی.', 'چه عالی! خوشحالی‌ت به منم سرایت کرد.']) } : null);
def('car', /(ماشین|رانندگی|تاکسی|اتوبوس|ترافیک|موتور)/, (p, c) => p.mem.carTaken ? { r: 'ماشین؟! همون ماشینی که از من دزدیدی؟ هنوز ازت شکایت دارم!' } : { r: rnd(['ترافیک این شهر سر چهارراه‌ها بیداد می‌کنه.', 'مواظب باش، اینجا بعضیا خیلی تند رانندگی می‌کنن.', 'اگه ماشین بخوای، کنار خیابون پر ماشین پارک شده‌ست، ولی مال مردمه‌ها!']) });
def('money', /(پول|قرض|تومن|اسکناس|پول داری)/, () => ({ r: rnd(['پول؟ آخر ماهه، جیبم خالیه!', 'نه والا، خودم دنبال قرض می‌گردم!', 'برو سر کار، پول میاد!']) }));
def('doing', /(داری چیکار|چیکار میکنی|کجا میری|چیکار داری میکنی|چه میکنی)/, p => ({ r: rnd([`دارم میرم ${p.food} بخرم.`, 'همینطوری دارم قدم می‌زنم.', `دارم میرم سر کار، ${p.jobLine}`, 'منتظر یکی از دوستامم.']) }));
def('opinion', /(نظرت|چی فکر میکنی|عقیده|به نظرت)/, p => ({ r: rnd(['به نظرم هر کاری با حوصله انجام بدی خوب میشه.', 'سخته بگم... ولی دلم میگه آره.', 'بستگی داره! تو خودت چی فکر می‌کنی؟']) }));
def('robot', /(رباتی|آدمی|واقعی هستی|هوش مصنوعی|بازی|کامپیوتر)/, () => ({ r: rnd(['ربات؟! من از صبح تا حالا سه تا چای خوردم، ربات چای می‌خوره؟', 'معلومه واقعی‌ام! ببین، دارم نفس می‌کشم.', 'گاهی خودمم فکر می‌کنم همه‌مون تو یه بازی زندگی می‌کنیم!']) }));
def('news', /(خبر جدید|اخبار|چه خبره|چی شده|اتفاق)/, (p, c) => ({ r: c.events.length ? 'شنیدی؟ ' + c.events[c.events.length - 1] : rnd(['خبری نیست، محله آرومه.', 'می‌گن قراره یه کافه جدید باز کنن.', 'دیشب چراغای پارک رو عوض کردن.']) }));
def('love', /(عاشقتم|عاشق شدم|ازدواج کن|زنم میشی|شوهرم میشی|باهام دوست میشی)/, p => ({ r: p.rel > 3 ? 'وای... بذار فکر کنم! ولی مرسی، خیلی لطف داری.' : rnd(['هنوز همو خوب نمی‌شناسیم که!', 'چه زود! بیا اول دوست باشیم.']) }));
def('help', /(کمک|کمکم کن|گم شدم|بلد نیستم|نمیدونم چیکار|راهنمایی)/, () => ({ r: 'حتماً! می‌تونی بپرسی «نانوایی کجاست؟» تا راهو نشونت بدم، یا سوار یه ماشین بشی، یا بری تو مغازه‌ها. اگه خواستی بگو «دنبالم بیا».' }));
def('yes', /^(آره|اره|بله|آری|حتما|چرا که نه|اوهوم|باشه|اوکی|ok|اوکه)( |$)/, p => p.mem.lastQ === 'tea' ? { r: 'پس بفرما، اینم چای تازه دم! نوش جان.' } : p.mem.lastQ === 'walk' ? { r: 'پس بریم!', a: 'follow' } : { r: rnd(['خوبه!', 'آفرین!', 'پس توافق کردیم.']) });
def('no', /^(نه|نخیر|اصلا|ابدا|نمیخوام)( |$)/, () => ({ r: rnd(['باشه، هر جور راحتی.', 'اشکالی نداره.', 'حیف شد!']) }));
def('sorry', /(ببخشید|معذرت|شرمنده|ببخش|عذر میخوام)/, p => { p.rel += 1; if (p.mem.hitByPlayer) { p.mem.hitByPlayer = 0; return { r: 'باشه، می‌بخشمت. ولی دیگه حواست به رانندگیت باشه!' }; } return { r: rnd(['خواهش می‌کنم، اتفاقیه.', 'نه بابا، اشکالی نداره.']) }; });

function setName(p, c, n) {
  p.mem.playerName = n; p.mem.pending = null; p.rel += 0.5;
  c.shareName && c.shareName(n);
  return { r: rnd([`خوشبختم ${n}! چه اسم قشنگی.`, `${n}؟ اسم خوبیه! من ${p.name}‌ام.`, `از آشنایی‌ت خوشحالم ${n} جان.`]) };
}
function route(p, c, pl) {
  return { r: `${pl.name}؟ ${pl.how}. ` + rnd(['رو نقشه‌ت هم علامت زدم.', 'یه علامت رو نقشه‌ت گذاشتم که گم نشی.', 'نشونه رو دنبال کن.']), guide: pl };
}

/* answers to questions the NPC asked earlier */
function pendingAnswer(p, c, t, raw) {
  const pend = p.mem.pending; p.mem.pending = null;
  if (!pend) return null;
  const words = raw.trim().split(/\s+/);
  switch (pend) {
    case 'playerName': {
      if (hasQ(t) || /(اسمت|اسم تو|اسم شما)/.test(t)) { p.mem.pending = 'playerName'; return null; }
      let n = (t.match(/(?:اسمم|اسم من|من)\s+([^\s]+)/) || [])[1] || (words.length <= 2 ? words[words.length - 1] : null);
      if (n) n = n.replace(/(هستم|ام|ه)$/, '');
      if (n && !STOP_NAMES.has(n) && n.length >= 2 && n.length <= 15) return setName(p, c, n);
      return null;
    }
    case 'playerMood': if (/(خوب|عالی|خوش|شکر|بد نیست)/.test(t)) return { r: rnd(['خدا رو شکر!', 'همیشه خوب باشی.']) }; if (/(بد|خسته|ناراحت|افتضاح)/.test(t)) return { r: 'آخی... امیدوارم زود حالت خوب شه. یه چای بهت بدم؟', q: 'tea' }; return null;
    case 'playerJob': raw = raw.replace(/\s*(هستم|ام|م)$/, '') || raw; p.mem.facts.job = raw; return { r: rnd([`${raw}؟ چه کار جالبی!`, `آفرین، ${raw} کار سختیه ولی شیرینه.`, 'چه خوب! کارتو دوست داری؟']) };
    case 'playerFrom': p.mem.facts.from = raw; return { r: rnd([`به به، ${raw}! جای قشنگیه.`, `${raw}؟ یه بار رفتم اونجا، مردمش خیلی مهربون بودن.`]) };
    case 'playerAge': return { r: rnd(['چه خوب! بهترین سن‌هاست.', 'هنوز جوونی، قدرشو بدون!']) };
    case 'playerColor': return { r: `${raw}؟ سلیقه‌ت خوبه!` };
    case 'playerMusic': return { r: `${raw}؟ منم گاهی گوش میدم!` };
    case 'playerHobby': return { r: `${raw}؟ چه جالب! یه روز باید با هم بریم.` };
    case 'whereTo': { const pl = findPlace(t, c.places); if (pl) return route(p, c, pl); return { r: 'اونجا رو نمی‌شناسم. شاید بپرسی نانوایی، کافه، داروخانه یا پارک؟' }; }
  }
  return null;
}

function fallback(p, c, t, raw) {
  const words = raw.split(/\s+/).filter(w => w.length > 2);
  const key = words.sort((a, b) => b.length - a.length)[0];
  if (hasQ(t) || /؟|\?/.test(raw)) {
    return { r: rnd([key ? `«${key}»؟ راستش زیاد در موردش نمی‌دونم.` : 'سوال سختیه!', 'نمی‌دونم والا، بذار فکر کنم...', 'از من می‌پرسی؟ شاید بقال سر کوچه بدونه!', `خوب سوالیه. تو خودت چی فکر می‌کنی؟`]) };
  }
  const r = Math.random();
  if (r < 0.25 && !p.mem.playerName) { p.mem.pending = 'playerName'; return { r: 'جالبه! راستی، اسمت چی بود؟' }; }
  if (r < 0.4 && !p.mem.facts.job) { p.mem.pending = 'playerJob'; return { r: 'آهان. راستی تو چیکاره‌ای؟' }; }
  if (r < 0.5) { p.mem.lastQ = 'walk'; return { r: 'جالبه. می‌خوای با هم یه دوری بزنیم؟' }; }
  return { r: rnd([key ? `${key}؟ جدی؟ بیشتر بگو.` : 'جدی؟ بیشتر بگو.', 'آهان، که اینطور!', 'جالبه، اصلاً بهش فکر نکرده بودم.', 'راست میگی.', 'اوهوم... ' + rnd(SMALLTALK), 'باحال بود! دیگه چه خبر؟']) };
}

/* main offline entry */
export function replyOffline(npc, raw, c) {
  const p = npc.persona; const t = norm(raw);
  if (!t) return { reply: '...', action: null };
  const pa = pendingAnswer(p, c, t, raw.trim());
  const hits = [];
  for (const it of I) { const m = t.match(it.re); if (m) hits.push({ it, m, pos: m.index }); }
  hits.sort((a, b) => a.pos - b.pos);
  const parts = []; let action = null, guide = null, end = false;
  if (pa) { parts.push(pa.r); if (pa.guide) guide = pa.guide; }
  const seen = new Set();
  for (const h of hits) {
    if (parts.length >= 2) break;
    if (seen.has(h.it.id)) continue;
    if (pa && (h.it.id === 'tellName' || h.it.id === 'feelGood' || h.it.id === 'yes' || h.it.id === 'no')) continue;
    const res = h.it.fn(p, c, h.m, t);
    if (!res) continue;
    seen.add(h.it.id); parts.push(res.r);
    if (res.a) action = res.a; if (res.guide) guide = res.guide; if (res.end) end = true;
    if (res.pend) p.mem.pending = res.pend;
    if (res.q) p.mem.lastQ = res.q;
  }
  if (!parts.length) parts.push(fallback(p, c, t, raw.trim()).r);
  else if (pa && pa.q) p.mem.lastQ = pa.q;
  let reply = parts.join(' ');
  reply = style(p, callName(p, reply) + reply);
  return { reply, action, guide, end };
}

/* ---------- Claude (optional) ---------- */
const MODEL = 'claude-opus-5-5';
let sdkPromise = null;
async function client(key) {
  if (!sdkPromise) sdkPromise = import('https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm');
  const mod = await sdkPromise; const Anthropic = mod.default || mod.Anthropic;
  return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
}
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['reply', 'action', 'place'],
  properties: {
    reply: { type: 'string', description: 'What the character says, colloquial Persian, 1-3 short sentences.' },
    action: { type: 'string', enum: ['none', 'wave', 'follow', 'stop', 'dance', 'sit', 'laugh', 'leave', 'guide'] },
    place: { type: 'string', description: 'For action "guide": the exact name of one place from the list, otherwise an empty string.' }
  }
};
function systemPrompt(npc, c) {
  const p = npc.persona;
  return `You are ${p.name} ${p.family}, a resident of «شهر آزاد», a small Iranian city in a 3D game. Stay fully in character as a real person; never say you are an AI or a game character.
About you: ${p.age} years old, ${p.female ? 'woman' : 'man'}, job: ${p.job}. Personality: ${p.trait}. Hobby: ${p.hobby}. Favourite food: ${p.food}. Favourite music: ${p.music}. ${p.married ? 'Married' : 'Single'}${p.kids ? `, ${p.kids} children` : ''}. You live on ${c.home}.
Current mood (0-1): ${p.mood.toFixed(2)}. How you feel about the player (-5 hate .. +5 friend): ${p.rel.toFixed(1)}.
What you remember about the player: ${p.mem.playerName ? 'name is ' + p.mem.playerName : 'you do not know their name'}${p.mem.hitByPlayer ? '; they hit you with a car earlier and you are upset' : ''}${p.mem.carTaken ? '; they stole your car' : ''}${p.mem.facts.job ? '; their job: ' + p.mem.facts.job : ''}.
World right now: time ${c.timeStr}, weather ${c.weather}, you are standing on ${c.place}. Recent neighbourhood news: ${c.events.slice(-3).join(' | ') || 'nothing special'}.
Places nearby with directions from where the player stands now:
${c.places.slice(0, 14).map(pl => `- ${pl.name}: ${pl.how}`).join('\n')}
Rules: reply in natural, warm, colloquial Persian (Farsi) like a real neighbour, 1-3 short sentences, no lists, no emojis. React to what the player says and to how they treat you. If they ask where a place is, give the direction from the list and use action "guide" with that place's exact name. If they ask you to come with them use "follow"; to stop/stay use "stop"; to dance "dance"; to sit "sit"; if they say goodbye use "wave"; if they are very rude and you want to walk away use "leave".`;
}
export async function replyAI(npc, raw, c, key) {
  const p = npc.persona;
  p.hist.push({ role: 'user', content: raw });
  while (p.hist.length > 20) p.hist.splice(0, 2);
  const cl = await client(key);
  const resp = await cl.beta.messages.create({
    model: MODEL, max_tokens: 2000,
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: systemPrompt(npc, c), messages: p.hist
  });
  if (resp.stop_reason === 'refusal') { p.hist.pop(); throw new Error('refusal'); }
  const tb = resp.content.find(b => b.type === 'text');
  if (!tb) { p.hist.pop(); throw new Error('empty reply'); }
  const data = JSON.parse(tb.text);
  p.hist.push({ role: 'assistant', content: tb.text });
  const guide = data.action === 'guide' ? c.places.find(pl => pl.name === data.place) || null : null;
  return { reply: data.reply, action: data.action === 'none' || data.action === 'guide' ? null : data.action, guide, end: false };
}

export const QUICK = ['سلام!', 'اسمت چیه؟', 'حالت چطوره؟', 'نانوایی کجاست؟', 'یه جوک بگو', 'دنبالم بیا', 'برقص!', 'خداحافظ'];
export const NPC_CHAT = SMALLTALK;
