'use strict';
/* Game data: moves, unlock levels, XP curve, opponents */

const UNLOCK_CODE = '1818';

// Toggle moves change how you move. The rest are exercises that play an animation and give XP.
const MOVES = [
  { id: 'run', name: 'دویدن', icon: '🏃', toggle: true, level: 1, hint: 'سریع بدو' },
  { id: 'jumprun', name: 'دویدن پرشی', icon: '🦘', toggle: true, level: 1, hint: 'بدو و وسطش بپر' },
  { id: 'backflip', name: 'پشتک', icon: '🤸', level: 5, xp: 20 },
  { id: 'jumpspin', name: 'پرش و چرخش', icon: '🌪️', level: 7, xp: 28 },
  { id: 'frontflip', name: 'ملق', icon: '🔄', level: 10, xp: 42 },
  { id: 'pushup', name: 'شنا سوئدی', icon: '💪', level: 1, xp: 10 },
  { id: 'squat', name: 'اسکوات', icon: '🦵', level: 2, xp: 12 },
  { id: 'situp', name: 'دراز و نشست', icon: '🧘', level: 3, xp: 14 },
  { id: 'jack', name: 'جامپینگ جک', icon: '⭐', level: 4, xp: 16 },
  { id: 'treadmill', name: 'تردمیل', icon: '🏃‍♂️', level: 3, xp: 18, equip: 'treadmill', run: 12 },
  { id: 'bike', name: 'دوچرخه ثابت', icon: '🚴', level: 5, xp: 24, equip: 'bike', run: 16 },
  { id: 'curl', name: 'دمبل', icon: '🏋️', level: 6, xp: 30, equip: 'dumbbell' },
  { id: 'rope', name: 'طناب‌زنی', icon: '➰', level: 8, xp: 32 },
  { id: 'box', name: 'کیسه بوکس', icon: '🥊', level: 9, xp: 42, equip: 'bag' },
  { id: 'kick', name: 'لگد چرخشی', icon: '🦶', level: 11, xp: 48 },
  { id: 'lift', name: 'وزنه‌برداری', icon: '🦍', level: 12, xp: 64, equip: 'barbell' },
  { id: 'bench', name: 'پرس سینه', icon: '🛋️', level: 13, xp: 70, equip: 'bench' },
  { id: 'handstand', name: 'بالانس دست', icon: '🙃', level: 14, xp: 65 },
  { id: 'pullup', name: 'بارفیکس', icon: '🧗', level: 15, xp: 80, equip: 'pullup' },
];

/** Machines in the gym. Moves with `equip` can only be done on that machine. */
const EQUIP = {
  treadmill: { name: 'تردمیل', where: 'سمت راست باشگاه' },
  bike: { name: 'دوچرخه ثابت', where: 'سمت راست باشگاه' },
  dumbbell: { name: 'قفسه‌ی دمبل', where: 'سمت چپ باشگاه، کنار آینه' },
  bag: { name: 'کیسه بوکس', where: 'گوشه‌ی جنوب شرقی' },
  barbell: { name: 'هالتر', where: 'سمت چپ باشگاه' },
  bench: { name: 'نیمکت پرس', where: 'سمت چپ باشگاه' },
  pullup: { name: 'میله‌ی بارفیکس', where: 'دو طرف قدرت‌سنج' },
};

/** Exercises the AI builder may assign to new equipment (every one has an animation). */
const AI_ANIMS = ['treadmill', 'bike', 'curl', 'lift', 'bench', 'pullup', 'box', 'rope', 'jack', 'squat', 'pushup', 'situp', 'kick', 'backflip', 'frontflip', 'jumpspin', 'handstand', 'cheer',
  'lunge', 'burpee', 'mountain', 'plank', 'bridge', 'highknees', 'superman', 'russian', 'starjump', 'skater', 'shadow', 'uppercut', 'frontkick', 'cartwheel', 'headspin', 'split', 'hoop', 'spin1080', 'dbackflip', 'swim', 'ski', 'skate', 'climb', 'trampoline',
  'kettle', 'ropes', 'rower', 'boxjump', 'tireflip', 'deadlift', 'mball', 'warrior', 'cobra', 'downdog', 'meditate', 'pistol', 'farmer', 'kata', 'combo', 'slip', 'golf', 'archery', 'serve', 'speedbag', 'legpress', 'latpull'];
const ISLAND_LEVEL = 100;
for (const m of MOVES) m.cat = 'base';

// 28 new bodyweight moves you can do anywhere, and 12 that need equipment in the new venues.
const NEW_MOVES = [
  ['toetouch', 'کشش همسترینگ', '🙇', 1, 10], ['lunge', 'لانژ', '🚶', 2, 14], ['buttkick', 'پاشنه به باسن', '👟', 2, 14],
  ['highknees', 'زانو بلند', '⏫', 3, 18], ['plank', 'پلانک', '➖', 3, 18], ['catcow', 'گربه و گاو', '🐈', 4, 20],
  ['bridge', 'پل باسن', '🌉', 4, 20], ['superman', 'سوپرمن', '🦸', 5, 22], ['mountain', 'کوهنورد', '⛰️', 5, 24],
  ['tree', 'حرکت درخت', '🌳', 6, 26], ['legraise', 'بالا بردن پا', '⬆️', 6, 26], ['shadow', 'سایه‌زنی', '👊', 7, 30],
  ['burpee', 'برپی', '💥', 8, 34], ['russian', 'چرخش روسی', '🔃', 9, 36], ['bikecrunch', 'کرانچ دوچرخه', '🚲', 10, 40],
  ['diamond', 'شنای الماسی', '💎', 11, 44], ['skater', 'پرش اسکیت', '↔️', 12, 46], ['jumpsquat', 'اسکوات پرشی', '🐸', 13, 50],
  ['frontkick', 'لگد جلو', '🥋', 14, 54], ['hoop', 'هولاهوپ', '⭕', 15, 56], ['uppercut', 'آپرکات', '🤜', 16, 60],
  ['starjump', 'پرش ستاره', '🌟', 17, 62], ['split', 'اسپلیت', '✂️', 19, 68], ['clap', 'شنای کف‌زدنی', '👏', 21, 76],
  ['cartwheel', 'چرخ و فلک', '🎡', 23, 82], ['headspin', 'چرخش روی سر', '🌀', 27, 95], ['dbackflip', 'پشتک دوبل', '🤸‍♂️', 32, 110],
  ['spin1080', 'پرش ۱۰۸۰', '💫', 36, 120],
].map(([id, name, icon, level, xp]) => ({ id, name, icon, level, xp, cat: 'new' }));

const ENV_MOVES = [
  { id: 'swim', name: 'شنای کرال', icon: '🏊', level: 5, xp: 30, run: 8, equip: 'swim' },
  { id: 'dive', name: 'شیرجه', icon: '🤿', level: 5, xp: 40, equip: 'dive' },
  { id: 'penalty', name: 'پنالتی', icon: '⚽', level: 8, xp: 42, equip: 'goal' },
  { id: 'basket', name: 'پرتاب بسکتبال', icon: '🏀', level: 12, xp: 50, equip: 'hoop' },
  { id: 'spike', name: 'اسپک والیبال', icon: '🏐', level: 15, xp: 58, equip: 'net' },
  { id: 'giantswing', name: 'بارفیکس چرخشی', icon: '🎠', level: 20, xp: 80, equip: 'highbar' },
  { id: 'rings', name: 'حلقه‌ها', icon: '💍', level: 20, xp: 70, equip: 'rings' },
  { id: 'parallel', name: 'پارالل', icon: '🤸‍♀️', level: 20, xp: 66, equip: 'pbars' },
  { id: 'trampoline', name: 'ترامپولین', icon: '🔝', level: 20, xp: 72, equip: 'tramp' },
  { id: 'skate', name: 'اسکیت روی یخ', icon: '⛸️', level: 25, xp: 85, run: 12, equip: 'ice' },
  { id: 'ski', name: 'اسکی', icon: '⛷️', level: 30, xp: 95, run: 15, equip: 'slope' },
  { id: 'climb', name: 'صخره‌نوردی', icon: '🧗‍♂️', level: 30, xp: 100, equip: 'wall' },
].map((m) => Object.assign(m, { cat: 'env' }));
// The bigger gym's pro zones (equipment) plus yoga and calisthenics, and the moves of the four newest venues.
const PRO_MOVES = [
  ['meditate', 'مدیتیشن', '🧘‍♂️', 1, 8], ['cobra', 'حرکت کبرا', '🐍', 2, 12], ['warrior', 'جنگجوی یوگا', '🗡️', 3, 14],
  ['kettle', 'کتل‌بل', '🔔', 4, 22, 'kettle'], ['mball', 'کوبیدن توپ مدیسن', '🔴', 5, 24], ['downdog', 'سگ رو به پایین', '🐕‍🦺', 6, 22],
  ['rower', 'پاروزنی', '🚣', 7, 30, 'rower', 10], ['speedbag', 'کیسه سرعتی', '🎯', 8, 34, 'speedbag'], ['farmer', 'راه رفتن کشاورز', '🧺', 9, 36],
  ['ropes', 'طناب نبرد', '🌊', 9, 40, 'ropes'], ['legpress', 'پرس پا', '🦿', 10, 44, 'legpress'], ['sideplank', 'پلانک پهلو', '📐', 11, 40],
  ['boxjump', 'پرش روی جعبه', '📦', 11, 48, 'plyo'], ['latpull', 'زیربغل سیم‌کش', '⬇️', 12, 50, 'lat'], ['deadlift', 'ددلیفت', '🏗️', 14, 62, 'barbell'],
  ['boulder', 'دیوار سنگ‌نوردی', '🧗‍♀️', 14, 60, 'boulder'], ['tireflip', 'چرخاندن لاستیک', '🛞', 16, 72, 'tire'], ['pistol', 'اسکوات تک‌پا', '🦩', 18, 70],
  ['lsit', 'ال‌سیت', '🪑', 20, 76], ['muscleup', 'ماسل‌آپ', '🦾', 24, 96, 'pullup'], ['hspu', 'شنای بالانس', '🤸‍♀️', 28, 105],
].map(([id, name, icon, level, xp, equip, run]) => Object.assign({ id, name, icon, level, xp, cat: 'pro' }, equip ? { equip } : {}, run ? { run } : {}));

const VENUE_MOVES = [
  { id: 'boardbreak', name: 'شکستن تخته', icon: '🪵', level: 10, xp: 46, equip: 'boards' },
  { id: 'kata', name: 'کاتای کاراته', icon: '🥋', level: 10, xp: 44, equip: 'tatami' },
  { id: 'archery', name: 'تیراندازی با کمان', icon: '🏹', level: 12, xp: 52, equip: 'target' },
  { id: 'serve', name: 'سرویس تنیس', icon: '🎾', level: 18, xp: 66, equip: 'tserve' },
  { id: 'forehand', name: 'فورهند تنیس', icon: '🏸', level: 18, xp: 62, equip: 'tbase' },
  { id: 'combo', name: 'ترکیب مشت', icon: '🥊', level: 22, xp: 74, equip: 'ring' },
  { id: 'slip', name: 'جاخالی بوکس', icon: '💨', level: 22, xp: 70, equip: 'ropebox' },
  { id: 'golf', name: 'ضربه‌ی گلف', icon: '🏌️', level: 40, xp: 120, equip: 'tee' },
  { id: 'putt', name: 'پات گلف', icon: '⛳', level: 40, xp: 110, equip: 'green' },
].map((m) => Object.assign(m, { cat: 'env' }));

MOVES.push(...NEW_MOVES, ...ENV_MOVES, ...PRO_MOVES, ...VENUE_MOVES);

/** Sports venues you travel to from the map. */
const ENVS = [
  { id: 'pool', name: 'استخر المپیک', icon: '🏊', level: 5, desc: 'شنا و شیرجه' },
  { id: 'stadium', name: 'ورزشگاه فوتبال', icon: '🏟️', level: 8, desc: 'پنالتی بزن' },
  { id: 'dojo', name: 'باغ رزمی ساکورا', icon: '⛩️', level: 10, desc: 'کاراته، شکستن تخته، کمانداری' },
  { id: 'court', name: 'زمین بسکتبال', icon: '🏀', level: 12, desc: 'پرتاب سه‌امتیازی' },
  { id: 'beach', name: 'ساحل والیبال', icon: '🏖️', level: 15, desc: 'اسپک کنار دریا' },
  { id: 'tennis', name: 'زمین تنیس', icon: '🎾', level: 18, desc: 'سرویس و فورهند' },
  { id: 'gymnastics', name: 'سالن ژیمناستیک', icon: '🤸', level: 20, desc: 'بارفیکس، حلقه، پارالل، ترامپولین' },
  { id: 'boxing', name: 'سالن بوکس', icon: '🥊', level: 22, desc: 'رینگ، ترکیب مشت، جاخالی' },
  { id: 'ice', name: 'پیست یخ', icon: '⛸️', level: 25, desc: 'اسکیت روی یخ' },
  { id: 'snow', name: 'کوهستان برفی', icon: '🏔️', level: 30, desc: 'اسکی و صخره‌نوردی' },
  { id: 'golf', name: 'زمین گلف', icon: '⛳', level: 40, desc: 'ضربه‌ی دور و پات' },
];
const ENV_BY_ID = Object.fromEntries(ENVS.map((e) => [e.id, e]));
Object.assign(EQUIP, {
  swim: { name: 'استخر', env: 'pool' },
  dive: { name: 'سکوی شیرجه', env: 'pool' },
  goal: { name: 'نقطه‌ی پنالتی', env: 'stadium' },
  hoop: { name: 'حلقه‌ی بسکتبال', env: 'court' },
  net: { name: 'تور والیبال', env: 'beach' },
  highbar: { name: 'میله‌ی ژیمناستیک', env: 'gymnastics' },
  rings: { name: 'حلقه‌های ژیمناستیک', env: 'gymnastics' },
  pbars: { name: 'پارالل', env: 'gymnastics' },
  tramp: { name: 'ترامپولین', env: 'gymnastics' },
  ice: { name: 'پیست یخ', env: 'ice' },
  slope: { name: 'پیست اسکی', env: 'snow' },
  wall: { name: 'دیوار صخره', env: 'snow' },
  kettle: { name: 'جایگاه کتل‌بل', where: 'زون کراس‌فیت' },
  ropes: { name: 'طناب نبرد', where: 'زون کراس‌فیت' },
  tire: { name: 'لاستیک بزرگ', where: 'زون کراس‌فیت' },
  plyo: { name: 'جعبه‌ی پرش', where: 'زون کراس‌فیت' },
  rower: { name: 'دستگاه پاروزنی', where: 'زون دستگاه‌ها' },
  legpress: { name: 'دستگاه پرس پا', where: 'زون دستگاه‌ها' },
  lat: { name: 'دستگاه سیم‌کش', where: 'زون دستگاه‌ها' },
  boulder: { name: 'دیوار سنگ‌نوردی', where: 'گوشه‌ی شمال شرقی' },
  speedbag: { name: 'کیسه‌ی سرعتی', where: 'دیوار جنوبی کنار بوکس' },
  boards: { name: 'سکوی شکستن تخته', env: 'dojo' },
  tatami: { name: 'تاتامی', env: 'dojo' },
  target: { name: 'سیبل کمانداری', env: 'dojo' },
  tserve: { name: 'خط سرویس', env: 'tennis' },
  tbase: { name: 'خط عقب زمین', env: 'tennis' },
  ring: { name: 'کیسه‌ی رینگ', env: 'boxing' },
  ropebox: { name: 'گوشه‌ی رینگ', env: 'boxing' },
  tee: { name: 'سکوی ضربه', env: 'golf' },
  green: { name: 'گرین', env: 'golf' },
});
for (const k of Object.keys(EQUIP)) if (!EQUIP[k].env) EQUIP[k].env = 'gym';

const MOVE_BY_ID = Object.fromEntries(MOVES.map((m) => [m.id, m]));
const EXERCISE_IDS = MOVES.filter((m) => !m.toggle).map((m) => m.id);

const RUN_XP_PER_SEC = { run: 2, jumprun: 3.5 };
/** Running level: earned by running, jump-running, treadmill and bike; makes you faster. */
const runNeed = (L) => Math.round(20 + 8 * L);
const runSpeedFor = (runLevel) => 5.4 + Math.min(4, (runLevel - 1) * 0.04);
/** Stronger athletes get more out of each rep, so level 100 is far but reachable. */
const xpMult = (L) => 1 + 0.08 * (L - 1);

/** XP needed to go from level L to L+1. */
const xpNeed = (L) => Math.round(30 + 22 * Math.pow(L, 1.3));
/** Muscle look (0..1) for a strength level. */
const muscleFor = (L) => clamp((L - 1) / 40, 0, 1);

const OPPONENTS = [
  { name: 'بهروز', title: 'مبتدی محله', level: 2 },
  { name: 'کامران', title: 'قهرمان باشگاه', level: 5 },
  { name: 'فرهاد', title: 'قهرمان شهر', level: 9 },
  { name: 'سیاوش', title: 'قهرمان استان', level: 14 },
  { name: 'جمشید', title: 'قهرمان کشور', level: 20 },
  { name: 'تیمور', title: 'قهرمان آسیا', level: 27 },
  { name: 'اسکندر', title: 'نایب‌قهرمان جهان', level: 35 },
  { name: 'اردشیر', title: 'قهرمان جهان', level: 44 },
  { name: 'رستم', title: 'قهرمان المپیک', level: 54 },
  { name: 'اسفندیار', title: 'اسطوره‌ی کشتی', level: 65 },
];
const MAIN_STAGES = OPPONENTS.length;

function opponentFor(stage) {
  if (stage <= MAIN_STAGES) return Object.assign({ stage }, OPPONENTS[stage - 1]);
  const n = stage - MAIN_STAGES;
  return { stage, name: 'مدعی شماره ' + fa(n), title: 'چالش بی‌پایان', level: 65 + n * 8 };
}

const NPC_NAMES = [
  'علی', 'رضا', 'محمد', 'حسین', 'مهدی', 'امیر', 'سعید', 'حمید', 'مجید', 'وحید',
  'کیان', 'آرش', 'بابک', 'کاوه', 'سهراب', 'بهرام', 'داریوش', 'کوروش', 'پویا', 'پارسا',
  'سینا', 'نیما', 'یاسین', 'طاها', 'ماهان', 'آرین', 'بردیا', 'سامان', 'شایان', 'عرفان',
  'فرزاد', 'کامیار', 'مانی', 'میلاد', 'نوید', 'هومن', 'یزدان', 'جواد', 'صادق', 'اکبر',
];

const PLAYER_COLORS = ['#e63946', '#2f6fed', '#2ecc71', '#ff7b00', '#9b5de5', '#111111'];

const ISLAND_NAMES = ['ابرنوش', 'آسمان', 'باران', 'تندر', 'رعد', 'مهتاب', 'نسیم', 'ستاره', 'افق', 'پرواز'];

/* ---------------- boost code, coins, shop, missions, medals ---------------- */

const BOOST_CODE = '1919';
const BOOST_LEVELS = 100;
const BOOST_MIN_LEVEL = 3;
const BOOST_SECONDS = 120;

const SHOP = [
  { id: 'drink', cat: 'boost', name: 'نوشیدنی انرژی', icon: '🥤', price: 60, desc: '۹۰ ثانیه زور دوبرابر' },
  { id: 'shake', cat: 'boost', name: 'شیک پروتئین', icon: '🥛', price: 150, desc: 'فوری +۱ سطح زور' },
  { id: 'shoes', cat: 'gear', name: 'کفش سرعت', icon: '👟', price: 250, once: true, desc: 'برای همیشه ۱۵٪ سریع‌تر' },
  { id: 'magnet', cat: 'gear', name: 'کیف پول طلایی', icon: '👛', price: 300, once: true, desc: 'سکه‌ها دوبرابر' },
  { id: 'dog', cat: 'pet', name: 'سگ ورزشکار', icon: '🐕', price: 350, once: true, desc: 'همه‌جا دنبالت میاد' },
  { id: 'cat', cat: 'pet', name: 'گربه‌ی تیزپا', icon: '🐈', price: 350, once: true, desc: 'همه‌جا دنبالت میاد' },
  { id: 'aura_fire', cat: 'aura', name: 'هاله‌ی آتش', icon: '🔥', price: 400, once: true, color: '#ff6a00', desc: 'دورت جرقه‌ی آتش' },
  { id: 'aura_ice', cat: 'aura', name: 'هاله‌ی یخ', icon: '❄️', price: 400, once: true, color: '#7fe0ff', desc: 'دورت دونه‌ی برف' },
  { id: 'aura_gold', cat: 'aura', name: 'هاله‌ی طلا', icon: '✨', price: 600, once: true, color: '#ffd34d', desc: 'برق قهرمانی' },
  { id: 'shirt_gold', cat: 'shirt', name: 'لباس طلایی', icon: '🥇', price: 200, once: true, color: '#d4af37', desc: 'لباس قهرمان‌ها' },
  { id: 'shirt_neon', cat: 'shirt', name: 'لباس نئونی', icon: '💚', price: 150, once: true, color: '#39ff14', desc: 'از دور پیدایی' },
  { id: 'shirt_pink', cat: 'shirt', name: 'لباس صورتی', icon: '🩷', price: 150, once: true, color: '#ff4da6', desc: 'خوش‌رنگ' },
  { id: 'shirt_white', cat: 'shirt', name: 'لباس سفید', icon: '🤍', price: 120, once: true, color: '#f5f5f5', desc: 'ساده و شیک' },
  { id: 'shirt_galaxy', cat: 'shirt', name: 'لباس کهکشانی', icon: '🌌', price: 300, once: true, color: '#4b2a8a', desc: 'بنفش تیره' },
  { id: 'band_red', cat: 'band', name: 'هدبند قرمز', icon: '🔴', price: 50, once: true, color: '#e63946', desc: 'برای پیشونی' },
  { id: 'band_blue', cat: 'band', name: 'هدبند آبی', icon: '🔵', price: 50, once: true, color: '#2f6fed', desc: 'برای پیشونی' },
  { id: 'band_white', cat: 'band', name: 'هدبند سفید', icon: '⚪', price: 50, once: true, color: '#ffffff', desc: 'برای پیشونی' },
];
const SHOP_BY_ID = Object.fromEntries(SHOP.map((i) => [i.id, i]));

/** Mission templates: each mission picks one and a target. */
const MISSION_TYPES = [
  { type: 'reps', targets: [10, 20, 30], text: (n) => `${fa(n)} بار ورزش کن` },
  { type: 'move', targets: [3, 5, 8], text: (n, m) => `${fa(n)} بار «${m.name}» بزن` },
  { type: 'equip', targets: [2, 4, 6], text: (n) => `${fa(n)} بار با وسیله ورزش کن` },
  { type: 'win', targets: [1, 2], text: (n) => `${fa(n)} کشتی ببر` },
  { type: 'visit', targets: [1], text: (n, m, env) => `برو به «${env.name}»` },
  { type: 'combo', targets: [4, 6, 8], text: (n) => `کمبو ×${fa((1 + n / 10).toFixed(1))} بگیر` },
  { type: 'run', targets: [150, 300, 500], text: (n) => `${fa(n)} متر بدو` },
  { type: 'race', targets: [1], text: () => 'توی مسابقه‌ی دو شرکت کن' },
  { type: 'levels', targets: [1, 2, 3], text: (n) => `${fa(n)} سطح زور بالا برو` },
];

const ACHIEVEMENTS = [
  { id: 'first', name: 'اولین قدم', icon: '👣', desc: 'اولین تمرین', test: (s) => s.stats.reps >= 1 },
  { id: 'reps100', name: 'پرتلاش', icon: '💪', desc: '۱۰۰ تمرین', test: (s) => s.stats.reps >= 100 },
  { id: 'reps1000', name: 'ماشین تمرین', icon: '🤖', desc: '۱۰۰۰ تمرین', test: (s) => s.stats.reps >= 1000 },
  { id: 'lv10', name: 'قوی', icon: '🥉', desc: 'سطح ۱۰', test: (s) => s.level >= 10 },
  { id: 'lv25', name: 'خیلی قوی', icon: '🥈', desc: 'سطح ۲۵', test: (s) => s.level >= 25 },
  { id: 'lv50', name: 'غول', icon: '🥇', desc: 'سطح ۵۰', test: (s) => s.level >= 50 },
  { id: 'lv100', name: 'افسانه', icon: '👑', desc: 'سطح ۱۰۰', test: (s) => s.level >= 100 },
  { id: 'win1', name: 'اولین برد', icon: '🤼', desc: 'یک کشتی ببر', test: (s) => s.wins >= 1 },
  { id: 'stage5', name: 'قهرمان کشور', icon: '🏅', desc: 'مرحله‌ی ۵ رو ببر', test: (s) => s.stage > 5 },
  { id: 'stage10', name: 'اسطوره‌ی کشتی', icon: '🏆', desc: 'هر ده مرحله رو ببر', test: (s) => s.stage > 10 },
  { id: 'envs', name: 'جهانگرد', icon: '🗺️', desc: 'به همه‌ی مکان‌های ورزشی برو', test: (s) => ENVS.every((e) => s.stats.visited.includes(e.id)) },
  { id: 'run50', name: 'تندباد', icon: '🌬️', desc: 'سطح دویدن ۵۰', test: (s) => s.runLevel >= 50 },
  { id: 'race', name: 'برنده‌ی مسابقه', icon: '🏁', desc: 'مسابقه‌ی دو رو اول شو', test: (s) => s.stats.raceWins >= 1 },
  { id: 'pet', name: 'دوست چهارپا', icon: '🐾', desc: 'یه حیوون بخر', test: (s) => s.shop.owned.includes('dog') || s.shop.owned.includes('cat') },
  { id: 'rich', name: 'پولدار', icon: '💰', desc: '۱۰۰۰ سکه جمع کن', test: (s) => s.stats.coinsEarned >= 1000 },
  { id: 'combo', name: 'کمبوباز', icon: '🔥', desc: 'کمبو ×۲ بگیر', test: (s) => s.stats.maxCombo >= 10 },
  { id: 'code', name: 'رمزگشا', icon: '⚡', desc: 'کد ۱۹۱۹ رو بزن', test: (s) => !!s.boost.used },
  { id: 'variety', name: 'همه‌کاره', icon: '🎯', desc: '۳۰ ورزش مختلف انجام بده', test: (s) => Object.keys(s.stats.moves).length >= 30 },
  { id: 'missions', name: 'مأمور ویژه', icon: '🎖️', desc: '۱۰ مأموریت انجام بده', test: (s) => s.stats.missionsDone >= 10 },
];

/* ---------------- super powers, titles, wheel, treasure, arm wrestling ---------------- */

const POWERS = [
  { id: 'superjump', name: 'پرش غول', icon: '🚀', level: 10, cd: 5, xp: 30, key: '1' },
  { id: 'dash', name: 'دش برق', icon: '⚡', level: 18, cd: 4, xp: 25, key: '2' },
  { id: 'slam', name: 'کوبش زمین', icon: '💥', level: 30, cd: 8, xp: 60, key: '3' },
];
const POWER_BY_ID = Object.fromEntries(POWERS.map((p) => [p.id, p]));

const TITLES = [
  [1, 'تازه‌کار'], [5, 'ورزشکار'], [10, 'پرتلاش'], [18, 'قوی'], [28, 'پهلوان'], [40, 'قهرمان'],
  [55, 'ابرقهرمان'], [75, 'اسطوره'], [100, 'خدای زور'], [150, 'افسانه‌ی جاودان'],
];
function titleFor(level) {
  let t = TITLES[0][1];
  for (const [l, name] of TITLES) if (level >= l) t = name;
  return t;
}

/** Wheel of fortune slices; w is the chance weight. */
const WHEEL = [
  { id: 'c50', label: '🪙 ۵۰', color: '#2f6fed', w: 22 },
  { id: 'drink', label: '🥤 نوشیدنی', color: '#00b4d8', w: 14 },
  { id: 'c100', label: '🪙 ۱۰۰', color: '#9b5de5', w: 18 },
  { id: 'lv1', label: '💪 +۱ سطح', color: '#e63946', w: 12 },
  { id: 'star', label: '⭐ ستاره', color: '#ff7b00', w: 12 },
  { id: 'c250', label: '🪙 ۲۵۰', color: '#2ecc71', w: 10 },
  { id: 'lv3', label: '💪 +۳ سطح', color: '#ff006e', w: 7 },
  { id: 'c1000', label: '💎 ۱۰۰۰', color: '#d4a017', w: 5 },
];
const WHEEL_PRICE = 100;

const ARM_TABLE = { x: 7.5, z: 2 };

SHOP.push(
  { id: 'trail_fire', cat: 'trail', name: 'رد آتش', icon: '☄️', price: 350, once: true, color: '#ff5a1f', desc: 'وقتی می‌دوی پشتت آتیش' },
  { id: 'trail_rainbow', cat: 'trail', name: 'رد رنگین‌کمان', icon: '🌈', price: 500, once: true, color: '#ff4da6', desc: 'رد پای رنگی' },
  { id: 'trail_bolt', cat: 'trail', name: 'رد برق', icon: '🌩️', price: 450, once: true, color: '#7fe0ff', desc: 'جرقه‌ی برق پشت سرت' },
);
for (const it of SHOP) SHOP_BY_ID[it.id] = it;

MISSION_TYPES.push(
  { type: 'pickup', targets: [10, 20, 40], text: (n) => `${fa(n)} سکه از زمین جمع کن` },
  { type: 'power', targets: [3, 6, 10], text: (n) => `${fa(n)} بار از قدرت ویژه استفاده کن` },
  { type: 'emote', targets: [3, 5], text: (n) => `${fa(n)} بار حرکت نمایشی بزن` },
  { type: 'arm', targets: [1, 2], text: (n) => `${fa(n)} بار مچ‌اندازی ببر` },
);

ACHIEVEMENTS.push(
  { id: 'power', name: 'ابرقدرت', icon: '🚀', desc: 'اولین قدرت ویژه', test: (s) => s.stats.powers >= 1 },
  { id: 'quake', name: 'زلزله', icon: '🌋', desc: 'با یه ضربه ۶ نفر رو بنداز', test: (s) => s.stats.maxKnock >= 6 },
  { id: 'arm1', name: 'مچ آهنین', icon: '🦾', desc: 'یه مچ‌اندازی ببر', test: (s) => s.stats.armWins >= 1 },
  { id: 'arm10', name: 'سلطان مچ', icon: '🤜', desc: '۱۰ مچ‌اندازی ببر', test: (s) => s.stats.armWins >= 10 },
  { id: 'chest', name: 'گنج‌یاب', icon: '🎁', desc: '۵ صندوق گنج باز کن', test: (s) => s.stats.chests >= 5 },
  { id: 'gems', name: 'جواهرشناس', icon: '💎', desc: '۱۰ الماس جمع کن', test: (s) => s.stats.gems >= 10 },
  { id: 'dancer', name: 'ستاره‌ی صحنه', icon: '💃', desc: '۱۵ حرکت نمایشی', test: (s) => s.stats.emotes >= 15 },
  { id: 'belt', name: 'کمربند طلا', icon: '🥇', desc: 'کمربند طلایی قهرمانی', test: (s) => s.stage > 10 },
  { id: 'streak', name: 'وفادار', icon: '📅', desc: '۵ روز پشت سر هم بیا', test: (s) => s.fun.streak >= 5 },
  { id: 'jackpot', name: 'خوش‌شانس', icon: '🍀', desc: 'جایزه‌ی بزرگ گردونه', test: (s) => s.stats.jackpots >= 1 },
);
