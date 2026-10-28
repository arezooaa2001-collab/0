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
const AI_ANIMS = ['treadmill', 'bike', 'curl', 'lift', 'bench', 'pullup', 'box', 'rope', 'jack', 'squat', 'pushup', 'situp', 'kick', 'backflip', 'frontflip', 'jumpspin', 'handstand', 'cheer'];
const ISLAND_LEVEL = 100;
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
