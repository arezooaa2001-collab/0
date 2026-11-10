// A small English ↔ Persian dictionary inside the app, so the tutor can still answer
// simple «X به انگلیسی/فارسی چی میشه؟» questions when no AI service can be reached
// (no internet, filtering, no key yet).
import type { TutorReply } from './ai';

// [English, Persian (variants separated by «/»)]
const PAIRS: [string, string][] = [
  // animals
  ['cat', 'گربه'], ['dog', 'سگ'], ['bird', 'پرنده'], ['fish', 'ماهی'], ['horse', 'اسب'], ['cow', 'گاو'],
  ['sheep', 'گوسفند'], ['goat', 'بز'], ['chicken', 'مرغ'], ['rooster', 'خروس'], ['duck', 'اردک'], ['rabbit', 'خرگوش'],
  ['mouse', 'موش'], ['lion', 'شیر جنگل'], ['tiger', 'ببر'], ['elephant', 'فیل'], ['monkey', 'میمون'], ['bear', 'خرس'],
  ['wolf', 'گرگ'], ['fox', 'روباه'], ['giraffe', 'زرافه'], ['zebra', 'گورخر'], ['camel', 'شتر'], ['donkey', 'الاغ/خر'],
  ['snake', 'مار'], ['frog', 'قورباغه'], ['turtle', 'لاک‌پشت'], ['butterfly', 'پروانه'], ['bee', 'زنبور'], ['ant', 'مورچه'],
  ['spider', 'عنکبوت'], ['owl', 'جغد'], ['eagle', 'عقاب'], ['parrot', 'طوطی'], ['penguin', 'پنگوئن'], ['dolphin', 'دلفین'],
  ['whale', 'نهنگ'], ['shark', 'کوسه'], ['squirrel', 'سنجاب'], ['deer', 'آهو/گوزن'], ['panda', 'پاندا'], ['kangaroo', 'کانگورو'],
  ['crocodile', 'تمساح'], ['pigeon', 'کبوتر'], ['sparrow', 'گنجشک'], ['animal', 'حیوان'],
  // fruits & vegetables
  ['apple', 'سیب'], ['banana', 'موز'], ['orange', 'پرتقال'], ['grape', 'انگور'], ['watermelon', 'هندوانه'], ['melon', 'خربزه'],
  ['strawberry', 'توت‌فرنگی'], ['cherry', 'گیلاس'], ['peach', 'هلو'], ['pear', 'گلابی'], ['pomegranate', 'انار'], ['lemon', 'لیمو'],
  ['mango', 'انبه'], ['pineapple', 'آناناس'], ['kiwi', 'کیوی'], ['apricot', 'زردآلو'], ['plum', 'آلو'], ['fig', 'انجیر'],
  ['date', 'خرما'], ['fruit', 'میوه'], ['tomato', 'گوجه'], ['potato', 'سیب‌زمینی'], ['carrot', 'هویج'], ['onion', 'پیاز'],
  ['cucumber', 'خیار'], ['lettuce', 'کاهو'], ['pepper', 'فلفل'], ['corn', 'ذرت'], ['vegetable', 'سبزی'],
  // food & drink
  ['bread', 'نان'], ['rice', 'برنج'], ['water', 'آب'], ['milk', 'شیر'], ['cheese', 'پنیر'], ['egg', 'تخم‌مرغ'],
  ['meat', 'گوشت'], ['soup', 'سوپ'], ['tea', 'چای'], ['juice', 'آبمیوه'], ['cake', 'کیک'], ['cookie', 'کلوچه/بیسکویت'],
  ['ice cream', 'بستنی'], ['chocolate', 'شکلات'], ['candy', 'آبنبات'], ['sugar', 'شکر'], ['salt', 'نمک'], ['butter', 'کره'],
  ['honey', 'عسل'], ['pizza', 'پیتزا'], ['sandwich', 'ساندویچ'], ['food', 'غذا'], ['breakfast', 'صبحانه'], ['lunch', 'ناهار'],
  ['dinner', 'شام'], ['yogurt', 'ماست'],
  // colors
  ['red', 'قرمز'], ['blue', 'آبی'], ['green', 'سبز'], ['yellow', 'زرد'], ['black', 'سیاه/مشکی'], ['white', 'سفید'],
  ['pink', 'صورتی'], ['purple', 'بنفش'], ['brown', 'قهوه‌ای'], ['gray', 'خاکستری'], ['color', 'رنگ'],
  // numbers
  ['one', 'یک'], ['two', 'دو'], ['three', 'سه'], ['four', 'چهار'], ['five', 'پنج'], ['six', 'شش'], ['seven', 'هفت'],
  ['eight', 'هشت'], ['nine', 'نه'], ['ten', 'ده'], ['hundred', 'صد'], ['thousand', 'هزار'], ['number', 'عدد'],
  // family & people
  ['mother', 'مادر/مامان'], ['father', 'پدر/بابا'], ['brother', 'برادر/داداش'], ['sister', 'خواهر'], ['baby', 'نوزاد/بچه'],
  ['grandmother', 'مادربزرگ'], ['grandfather', 'پدربزرگ'], ['family', 'خانواده'], ['friend', 'دوست'], ['boy', 'پسر'],
  ['girl', 'دختر'], ['man', 'مرد'], ['woman', 'زن'], ['child', 'کودک'], ['teacher', 'معلم'], ['student', 'دانش‌آموز'],
  ['doctor', 'دکتر/پزشک'], ['uncle', 'عمو/دایی'], ['aunt', 'خاله/عمه'],
  // body
  ['head', 'سر'], ['hair', 'مو'], ['eye', 'چشم'], ['ear', 'گوش'], ['nose', 'بینی/دماغ'], ['mouth', 'دهان/دهن'],
  ['tooth', 'دندان'], ['hand', 'دست'], ['foot', 'پا'], ['finger', 'انگشت'], ['face', 'صورت'], ['heart', 'قلب'],
  // home & things
  ['house', 'خانه'], ['home', 'خانه'], ['room', 'اتاق'], ['door', 'در'], ['window', 'پنجره'], ['table', 'میز'],
  ['chair', 'صندلی'], ['bed', 'تخت'], ['kitchen', 'آشپزخانه'], ['book', 'کتاب'], ['pen', 'خودکار'], ['pencil', 'مداد'],
  ['bag', 'کیف'], ['school', 'مدرسه'], ['notebook', 'دفتر'], ['eraser', 'پاک‌کن'], ['ball', 'توپ'], ['toy', 'اسباب‌بازی'],
  ['doll', 'عروسک'], ['phone', 'تلفن/گوشی'], ['computer', 'کامپیوتر/رایانه'], ['television', 'تلویزیون'], ['clock', 'ساعت'],
  ['key', 'کلید'], ['cup', 'فنجان/لیوان'], ['glass', 'لیوان'], ['plate', 'بشقاب'], ['spoon', 'قاشق'], ['fork', 'چنگال'],
  ['knife', 'چاقو'], ['shoe', 'کفش'], ['shirt', 'پیراهن'], ['hat', 'کلاه'], ['dress', 'لباس'], ['car', 'ماشین'],
  ['bus', 'اتوبوس'], ['bicycle', 'دوچرخه'], ['train', 'قطار'], ['airplane', 'هواپیما'], ['ship', 'کشتی'], ['boat', 'قایق'],
  ['picture', 'عکس/تصویر'], ['word', 'کلمه'], ['sentence', 'جمله'], ['letter', 'نامه/حرف'], ['name', 'اسم/نام'],
  // nature & time
  ['sun', 'خورشید'], ['moon', 'ماه'], ['star', 'ستاره'], ['sky', 'آسمان'], ['cloud', 'ابر'], ['rain', 'باران'],
  ['snow', 'برف'], ['wind', 'باد'], ['tree', 'درخت'], ['flower', 'گل'], ['grass', 'چمن'], ['sea', 'دریا'],
  ['river', 'رودخانه'], ['mountain', 'کوه'], ['fire', 'آتش'], ['earth', 'زمین'], ['day', 'روز'], ['night', 'شب'],
  ['morning', 'صبح'], ['today', 'امروز'], ['tomorrow', 'فردا'], ['yesterday', 'دیروز'], ['week', 'هفته'], ['year', 'سال'],
  ['summer', 'تابستان'], ['winter', 'زمستان'], ['spring', 'بهار'], ['autumn', 'پاییز'], ['park', 'پارک'], ['garden', 'باغ'],
  // adjectives
  ['big', 'بزرگ'], ['small', 'کوچک'], ['hot', 'گرم/داغ'], ['cold', 'سرد'], ['good', 'خوب'], ['bad', 'بد'],
  ['happy', 'خوشحال'], ['sad', 'ناراحت/غمگین'], ['beautiful', 'زیبا/قشنگ'], ['new', 'نو/جدید'], ['old', 'پیر/قدیمی'],
  ['fast', 'تند/سریع'], ['slow', 'آهسته/کند'], ['long', 'بلند/دراز'], ['short', 'کوتاه'], ['tall', 'قدبلند'],
  ['hungry', 'گرسنه'], ['thirsty', 'تشنه'], ['tired', 'خسته'], ['clean', 'تمیز'], ['dirty', 'کثیف'], ['easy', 'آسان'],
  ['hard', 'سخت'], ['funny', 'خنده‌دار/بامزه'], ['kind', 'مهربان'], ['strong', 'قوی'],
  // verbs
  ['eat', 'خوردن'], ['drink', 'نوشیدن'], ['sleep', 'خوابیدن'], ['run', 'دویدن'], ['walk', 'راه رفتن'], ['play', 'بازی کردن'],
  ['read', 'خواندن'], ['write', 'نوشتن'], ['sing', 'آواز خواندن'], ['dance', 'رقصیدن'], ['swim', 'شنا کردن'], ['jump', 'پریدن'],
  ['go', 'رفتن'], ['come', 'آمدن'], ['see', 'دیدن'], ['look', 'نگاه کردن'], ['listen', 'گوش دادن'], ['speak', 'حرف زدن'],
  ['open', 'باز کردن'], ['close', 'بستن'], ['love', 'دوست داشتن/عشق'], ['learn', 'یاد گرفتن'], ['draw', 'نقاشی کشیدن'],
  ['help', 'کمک'], ['sit', 'نشستن'], ['stand', 'ایستادن'], ['cry', 'گریه کردن'], ['laugh', 'خندیدن'],
  // phrases
  ['hello', 'سلام'], ['hi', 'سلام'], ['goodbye', 'خداحافظ'], ['bye', 'خداحافظ'], ['thank you', 'ممنون/مرسی/متشکرم'],
  ['thanks', 'ممنون/مرسی'], ['please', 'لطفاً'], ['yes', 'بله/آره'], ['no', 'نه/خیر'], ['sorry', 'ببخشید/متأسفم'],
  ['good morning', 'صبح بخیر'], ['good night', 'شب بخیر'], ['how are you', 'حالت چطوره/چطوری'], ['i love you', 'دوستت دارم'],
  ['my name is', 'اسم من … است'], ['welcome', 'خوش آمدی'], ['excuse me', 'ببخشید'], ['okay', 'باشه'],
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌ً-ٟ]/g, '')
    .replace(/[«»"'“”؟?!.,،:؛;()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const EN = new Map<string, string>();
const FA = new Map<string, string>();
for (const [en, fa] of PAIRS) {
  EN.set(en, fa.split('/')[0]);
  for (const v of fa.split('/'))
    for (const k of [norm(v), norm(v.replace(/\u200c/g, ' '))]) if (!FA.has(k)) FA.set(k, en);
}
const EN_MAX = 3; // longest English phrase, in words
const FA_MAX = 3;

/** Words in a question that only say what is being asked («به انگلیسی چی میشه»…). */
const FA_SKIP = new Set(
  'به را رو و یا از در با که این اون آن چی چیه چه چطور چطوری میشه می‌شه میشود می‌شود یعنی معنی معنیش معنای ترجمه ترجمه‌اش کن بکن بگو بگید بنویس کلمه جمله لغت زبان انگلیسی فارسی فرانسوی چینی ژاپنی هندی توی تو داخل من را؟ لطفا لطفاً هست است میگن می‌گن میگویند گفته میشه؟ چیست'
    .split(' ')
    .map(norm),
);
const EN_SKIP = new Set('what is the a an in to of how do you say mean means meaning translate persian farsi english word please it this that'.split(' '));

const ASKS_MEANING = /انگلیسی|فارسی|یعنی|معنی|ترجمه|چی میشه|چی می ?شه|چی میشود|چه میشود|چی میگن|in english|in persian|in farsi|mean|translate|how do you say/;

/** Look the question's words up. Returns a tutor answer, or null when nothing is known. */
export function dictionaryAnswer(question: string): TutorReply | null {
  const q = norm(question);
  const items: TutorReply['items'] = [];
  const seen = new Set<string>();
  let unknown = 0; // content words that are not in the dictionary
  const push = (en: string, fa: string) => {
    if (seen.has(en)) return;
    seen.add(en);
    items.push({ text: en, lang: 'en', meaning: fa, say: '' });
  };

  // English words (and short phrases) → Persian
  const latin = q.match(/[a-z]+(?: [a-z]+)*/g) ?? [];
  for (const chunk of latin) {
    const w = chunk.split(' ');
    for (let i = 0; i < w.length; i++) {
      for (let n = Math.min(EN_MAX, w.length - i); n >= 1; n--) {
        const p = w.slice(i, i + n).join(' ');
        if (n === 1 && EN_SKIP.has(p)) break;
        const hit = EN.get(p) ?? (p.endsWith('s') && n === 1 ? EN.get(p.slice(0, -1)) : undefined);
        if (hit) {
          push(EN.has(p) ? p : p.slice(0, -1), hit);
          i += n - 1;
          break;
        }
        if (n === 1) unknown++;
      }
    }
  }

  // Persian words (and short phrases) → English
  const fa = q.replace(/[a-z0-9]+/g, ' ').split(' ').filter(Boolean);
  for (let i = 0; i < fa.length; i++) {
    for (let n = Math.min(FA_MAX, fa.length - i); n >= 1; n--) {
      const p = fa.slice(i, i + n).join(' ');
      if (n === 1 && FA_SKIP.has(p)) break;
      const hit = FA.get(p) ?? (n === 1 ? FA.get(p.replace(/(ها|های|ی)$/, '')) : undefined);
      if (hit) {
        push(hit, EN.get(hit) ?? p);
        i += n - 1;
        break;
      }
      if (n === 1) unknown++;
    }
  }

  if (!items.length) return null;
  // Only a word question («… به انگلیسی چی میشه؟», «cat یعنی چی») or just the words themselves:
  // never pretend to answer «یک داستان بگو» with «one = یک».
  if (unknown > 1 || (unknown > 0 && !ASKS_MEANING.test(q))) return null;
  const list = items.map((it) => `${it.text} = ${it.meaning}`).join('، ');
  return { reply: `${list} 📖`, items: items.slice(0, 5) };
}
