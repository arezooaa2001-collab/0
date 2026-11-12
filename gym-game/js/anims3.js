'use strict';
/*
 * Show-off moves (emotes), the knock-down fall used by super powers, and the
 * arm-wrestling pose. Emotes are built from key poses like the exercises.
 */

function laughFn(p, t) {
  const k = smooth(seg(t, 0, 0.12)) * (1 - smooth(seg(t, 0.88, 1)));
  const sh = Math.sin(t * 70) * 0.06 * k;
  p.spX = -0.22 * k + sh;
  p.nkX = -0.45 * k;
  p.shLX = p.shRX = -0.55 * k;
  p.shLZ = 0.12 + 0.25 * k; p.shRZ = -p.shLZ;
  p.elL = p.elR = -0.18 - 1.5 * k;
  p.knL = p.knR = 0.04 + 0.2 * k + Math.abs(sh);
  plant(p, false);
}

/** Robot dance: stiff poses that snap from one to the next. */
const ROBOT_STEPS = [
  { shLX: -1.57, elL: 0, shRX: 0, elR: -1.57, nkY: 0.5 },
  { shLX: 0, elL: -1.57, shRX: -1.57, elR: 0, nkY: -0.5 },
  { shLX: -1.57, elL: -1.57, shRX: -1.57, elR: -1.57, nkY: 0, spY: 0.4 },
  { shLX: -3.0, elL: 0, shRX: 0.2, elR: 0, nkY: 0, spY: -0.4 },
  { shLX: 0.2, elL: 0, shRX: -3.0, elR: 0, nkY: 0.4 },
  { shLX: -1.57, elL: -1.2, shRX: -1.57, elR: -1.2, nkY: 0, knL: 0.5, knR: 0.5 },
];
function robotFn(p, t) {
  const k = smooth(seg(t, 0, 0.06)) * (1 - smooth(seg(t, 0.94, 1)));
  const i = Math.min(ROBOT_STEPS.length - 1, Math.floor(t * ROBOT_STEPS.length));
  const q = makePose();
  Object.assign(q, ROBOT_STEPS[i]);
  q.shLZ = 0.15; q.shRZ = -0.15;
  plant(q, false);
  mixInto(p, q, k);
}

/** Glide backwards: one foot flat, the other on its toes, swapping. */
function moonwalkFn(p, t) {
  const k = smooth(seg(t, 0, 0.1)) * (1 - smooth(seg(t, 0.9, 1)));
  const s = Math.sin(t * 6 * Math.PI);
  p.hpLX = (0.25 * s) * k;
  p.hpRX = (-0.25 * s) * k;
  p.knL = (0.15 + 0.45 * Math.max(0, s)) * k;
  p.knR = (0.15 + 0.45 * Math.max(0, -s)) * k;
  p.shLX = -0.25 * s * k; p.shRX = 0.25 * s * k;
  p.elL = p.elR = -0.9 * k;
  p.spX = 0.12 * k;
  p.nkY = 0.3 * k;
  p.y = -0.03 * k;
}

/** Shoved off your feet, a moment on the floor, then back up. */
function knockFn(p, t) {
  const lie = Object.assign(makePose(), BASES.lieBack, { knL: 0.5, knR: 0.2, hpLX: -0.4, hpRX: -0.1, shLZ: 1.2, shRZ: -1.2 });
  const sit = Object.assign(makePose(), BASES.seated);
  if (t < 0.22) {
    const a = smooth(t / 0.22);
    mixInto(p, lie, a);
    p.shLX = p.shRX = -2.0 * Math.sin(Math.PI * a);
    p.y += 0.25 * Math.sin(Math.PI * a);
  } else if (t < 0.6) {
    copyPose(p, lie);
    const b = Math.max(0, Math.sin((t - 0.22) * 30)) * 0.04 * (1 - seg(t, 0.22, 0.4));
    p.y += b;
    p.nkX = -0.2 + 0.2 * Math.sin(t * 20);
  } else if (t < 0.8) {
    copyPose(p, lie);
    mixInto(p, sit, smooth(seg(t, 0.6, 0.8)));
  } else {
    copyPose(p, sit);
    const stand = makePose();
    crouchPose(stand, 0.6 * (1 - seg(t, 0.92, 1)));
    mixInto(p, stand, smooth(seg(t, 0.8, 1)));
  }
  p.autoAnkle = t >= 0.8;
}

const EMOTE_ANIMS = {
  e_wave: keyAnim({ dur: 2.2, reps: 3, base: { shRX: -2.7, shRZ: -0.45, elR: -0.45, nkY: 0.15, spZ: 0.04 }, a: { shRZ: -0.2, elR: -0.3 }, b: { shRZ: -0.85, elR: -0.8 } }),
  e_flex: keyAnim({ dur: 2.6, reps: 2, inOut: 0.18,
    base: { shLX: -1.57, shRX: -1.57, shLZ: 1.5, shRZ: -1.5, elL: -1.6, elR: -1.6, knL: 0.15, knR: 0.15, nkX: -0.1, hpLZ: 0.15, hpRZ: -0.15 },
    a: { elL: -1.5, elR: -1.5 }, b: { elL: -2.3, elR: -2.3, spX: 0.12, nkX: 0.1 }, wobble: 0.003, plantFeet: true }),
  e_dance: keyAnim({ dur: 3.2, reps: 4, plantFeet: true, hop: 0.06, hopEvery: 2, inOut: 0.08,
    a: { bz: 0.12, spZ: -0.12, shLX: -1.6, shRX: 0.35, shLZ: 0.4, shRZ: -0.3, elL: -1.4, elR: -0.8, knL: 0.4, knR: 0.08 , nkY: 0.2 },
    b: { bz: -0.12, spZ: 0.12, shRX: -1.6, shLX: 0.35, shRZ: -0.4, shLZ: 0.3, elR: -1.4, elL: -0.8, knR: 0.4, knL: 0.08, nkY: -0.2 } }),
  e_robot: { dur: 3.0, fn: robotFn },
  e_dab: keyAnim({ dur: 1.8, reps: 1, inOut: 0.22,
    b: { shLX: -2.2, shLZ: 1.0, elL: 0, shRX: -1.65, shRY: 0.3, shRZ: 0.75, elR: -2.3, nkX: 0.55, nkY: 0.55, spZ: -0.12, spY: 0.25 } }),
  e_bow: keyAnim({ dur: 2.0, reps: 1, inOut: 0.25, b: { spX: 0.95, nkX: 0.35, shRX: -1.0, shRZ: 0.55, elR: -1.9, shLX: 0.25, shLZ: 0.2 } }),
  e_clap: keyAnim({ dur: 2.2, reps: 6, inOut: 0.1, base: { shLX: -1.35, shRX: -1.35, elL: -0.55, elR: -0.55 }, a: { shLZ: 0.65, shRZ: -0.65 }, b: { shLZ: -0.12, shRZ: 0.12 },
    events: [[0.17, 'clap'], [0.31, 'clap'], [0.45, 'clap'], [0.59, 'clap'], [0.73, 'clap'], [0.87, 'clap']] }),
  e_sit: keyAnim({ dur: 3.6, reps: 1, inOut: 0.2, base: Object.assign({}, BASES.seated, { shLX: 0.7, shRX: 0.7, elL: 0, elR: 0, shLZ: 0.25, shRZ: -0.25, knL: 1.9, knR: 1.9, hpLZ: 0.5, hpRZ: -0.5 }), b: { nkX: -0.15, nkY: 0.3 } }),
  e_laugh: { dur: 2.4, fn: laughFn },
  e_moon: { dur: 3.0, move: (t) => (t > 0.1 && t < 0.9 ? -1.2 : 0), fn: moonwalkFn },
  e_salute: keyAnim({ dur: 2.0, reps: 1, inOut: 0.2, b: { shRX: -1.25, shRY: 0.2, shRZ: -1.2, elR: -2.6, nkX: -0.05, spX: -0.05 } }),
  e_victory: ANIMS.cheer,
  talk: keyAnim({ dur: 2.2, reps: 3, inOut: 0.2, a: { shRX: -0.7, elR: -1.5, shRZ: -0.3, nkX: 0.08 }, b: { shRX: -0.45, elR: -1.1, shRZ: -0.15, nkX: -0.05, nkY: 0.15 } }),
  talk2: keyAnim({ dur: 2.4, reps: 2, inOut: 0.2, a: { shLX: -0.8, elL: -1.4, shRX: -0.8, elR: -1.4, shLZ: 0.4, shRZ: -0.4 }, b: { shLX: -0.5, elL: -1.0, shRX: -0.5, elR: -1.0, shLZ: 0.6, shRZ: -0.6, nkY: -0.15 } }),
  knock: { dur: 2.8, move: (t) => (t < 0.2 ? -2.6 : 0), events: [[0.2, 'land']], fn: knockFn },
  fanclap: keyAnim({ dur: 2.0, reps: 5, inOut: 0.1, plantFeet: true, hop: 0.05, base: { shLX: -1.5, shRX: -1.5, elL: -0.5, elR: -0.5, nkX: -0.15 }, a: { shLZ: 0.6, shRZ: -0.6 }, b: { shLZ: -0.1, shRZ: 0.1 } }),
};
Object.assign(ANIMS, EMOTE_ANIMS);

/** Moves you show off with: no strength, but people nearby cheer and toss you coins. */
const EMOTES = [
  ['e_wave', 'سلام', '👋'], ['e_flex', 'ژست بازو', '💪'], ['e_dance', 'رقص شاد', '💃'], ['e_robot', 'رقص ربات', '🤖'],
  ['e_dab', 'دب', '😎'], ['e_victory', 'پیروزی', '🏆'], ['e_clap', 'دست زدن', '👏'], ['e_bow', 'تعظیم', '🙇'],
  ['e_laugh', 'خنده', '😂'], ['e_moon', 'مون‌واک', '🕺'], ['e_salute', 'احترام', '🫡'], ['e_sit', 'نشستن', '🧘'],
].map(([id, name, icon]) => ({ id, name, icon, level: 1, cat: 'fun', emote: true }));
MOVES.push(...EMOTES);
for (const e of EMOTES) MOVE_BY_ID[e.id] = e;

/**
 * Arm wrestling, standing at a high table. theta: -1 (you lose) .. 1 (you win);
 * side: 1 for the player, -1 for the opponent, so both hands tilt the same way.
 */
function armWrestlePose(p, theta, effort, side, time) {
  const shake = Math.sin(time * 38 + side) * 0.02 * effort;
  p.spX = 0.45;
  p.nkX = -0.4;
  p.hpLX = -0.55; p.hpRX = 0.05;
  p.knL = 0.35; p.knR = 0.2;
  p.shRX = -0.8;
  p.shRZ = 0.32;
  p.elR = -2.0;
  p.shRY = side * 0.9 * theta + shake;
  p.shLX = -0.6; p.shLZ = 0.35; p.elL = -1.3;
  p.spY = 0.08 * theta * side;
  p.spZ = -0.08 * theta * side;
  plant(p, false);
}
