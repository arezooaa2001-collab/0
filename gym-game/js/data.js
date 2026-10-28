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
  { id: 'curl', name: 'دمبل', icon: '🏋️', level: 6, xp: 24 },
  { id: 'rope', name: 'طناب‌زنی', icon: '➰', level: 8, xp: 32 },
  { id: 'box', name: 'بوکس', icon: '🥊', level: 9, xp: 36 },
  { id: 'kick', name: 'لگد چرخشی', icon: '🦶', level: 11, xp: 48 },
  { id: 'lift', name: 'وزنه‌برداری', icon: '🦍', level: 12, xp: 55 },
  { id: 'handstand', name: 'بالانس دست', icon: '🙃', level: 14, xp: 65 },
];
const MOVE_BY_ID = Object.fromEntries(MOVES.map((m) => [m.id, m]));
const EXERCISE_IDS = MOVES.filter((m) => !m.toggle).map((m) => m.id);

const RUN_XP_PER_SEC = { run: 2, jumprun: 3.5 };

/** XP needed to go from level L to L+1. */
const xpNeed = (L) => Math.round(30 + 22 * Math.pow(L, 1.3));
/** Muscle look (0..1) for a strength level. */
const muscleFor = (L) => clamp((L - 1) / 22, 0, 1);

const OPPONENTS = [
  { name: 'بهروز', title: 'مبتدی محله', level: 2 },
  { name: 'کامران', title: 'قهرمان باشگاه', level: 4 },
  { name: 'فرهاد', title: 'قهرمان شهر', level: 6 },
  { name: 'سیاوش', title: 'قهرمان استان', level: 8 },
  { name: 'جمشید', title: 'قهرمان کشور', level: 10 },
  { name: 'تیمور', title: 'قهرمان آسیا', level: 12 },
  { name: 'اسکندر', title: 'نایب‌قهرمان جهان', level: 14 },
  { name: 'اردشیر', title: 'قهرمان جهان', level: 16 },
  { name: 'رستم', title: 'قهرمان المپیک', level: 18 },
  { name: 'اسفندیار', title: 'اسطوره‌ی کشتی', level: 20 },
];
const MAIN_STAGES = OPPONENTS.length;

function opponentFor(stage) {
  if (stage <= MAIN_STAGES) return Object.assign({ stage }, OPPONENTS[stage - 1]);
  const n = stage - MAIN_STAGES;
  return { stage, name: 'مدعی شماره ' + fa(n), title: 'چالش بی‌پایان', level: 20 + n * 2 };
}

const NPC_NAMES = [
  'علی', 'رضا', 'محمد', 'حسین', 'مهدی', 'امیر', 'سعید', 'حمید', 'مجید', 'وحید',
  'کیان', 'آرش', 'بابک', 'کاوه', 'سهراب', 'بهرام', 'داریوش', 'کوروش', 'پویا', 'پارسا',
  'سینا', 'نیما', 'یاسین', 'طاها', 'ماهان', 'آرین', 'بردیا', 'سامان', 'شایان', 'عرفان',
  'فرزاد', 'کامیار', 'مانی', 'میلاد', 'نوید', 'هومن', 'یزدان', 'جواد', 'صادق', 'اکبر',
];

const PLAYER_COLORS = ['#e63946', '#2f6fed', '#2ecc71', '#ff7b00', '#9b5de5', '#111111'];
