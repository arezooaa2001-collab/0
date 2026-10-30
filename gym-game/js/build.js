'use strict';
/*
 * Build mode. Equipment from the Steel Gym, the Titans' Temple and Cosmic Olympus, plus
 * decorations, can be placed, moved, turned and removed. In the first gym that lets you add
 * the other gyms' exercises; the Steel Gym itself is made of these pieces, so you can rearrange
 * it completely and give it your own colours and name.
 *
 * Every piece is built in its own frame: the exercise spot is the origin, facing +z. Pieces turn
 * in quarter turns so their colliders stay axis-aligned and exact.
 */

const BUILD_KEYS = ['gym', 'gym2'];

function chainLinks(t, x, z, y0, y1) {
  for (let y = y0, k = 0; y < y1; y += 0.31, k++) t.mt.add(UnitGeo.torus(1, 0.3, 4, 8), x, y, z, '#9aa0a8', 0, k % 2 ? Math.PI / 2 : 0, 0, 0.11, 0.11, 0.11);
}

/** type → { name, icon, group, equip?, fp: [x1, z1, x2, z2] footprint, build(t) } */
const PLACEABLES = {
  /* ---------- Steel Gym ---------- */
  g2tire: { name: 'لاستیک و پتک', icon: '🔨', group: 'g2', equip: 'g2tire', fp: [-0.9, -0.6, 0.9, 1.9], build(t) {
    t.m.add(UnitGeo.torus(1, 0.42, 8, 20), 0, 0.23, 1.0, '#1d1d1d', Math.PI / 2, 0, 0, 0.55, 0.55, 0.55);
    t.col(-0.78, 0.45, 0.78, 1.55); t.col(-0.55, 0.22, 0.55, 1.78);
    t.station(0, 0, 0, ['hammer'], { ax: 0, az: -0.9 });
  } },
  g2chainbar: { name: 'میله‌ی زنجیری', icon: '⛓️', group: 'g2', equip: 'g2chainbar', fp: [-1.0, -0.4, 1.0, 1.4], build(t) {
    for (const s of [-1, 1]) {
      t.mt.box(0.12, 3.0, 0.12, s * 0.85, 1.5, 0, '#3c4250');
      t.col(s * 0.85 - 0.08, -0.08, s * 0.85 + 0.08, 0.08);
      chainLinks(t, s * 0.6, 0, 2.55, 2.95);
    }
    t.mt.box(1.9, 0.12, 0.12, 0, 3.0, 0, '#ff7b00');
    t.mt.cyl(0.035, 1.6, 0, 2.5, 0, '#c9ced6', 0, 0, Math.PI / 2, 10);
    t.station(0, 0, 0, ['pullup'], { ax: 0, az: 1.1, bar: { y: 2.5, f: 0 } });
  } },
  g2kb: { name: 'کتل‌بل آهنی', icon: '🔔', group: 'g2', equip: 'g2kb', fp: [-1.1, -1.1, 1.1, 1.1], build(t) {
    t.m.box(2.2, 0.05, 2.2, 0, 0.025, 0, '#3d2b1f');
    t.station(0, 0, 0, ['kettle'], { ax: 0, az: -1.2 });
  } },
  g2anvil: { name: 'سندان‌ها', icon: '🧱', group: 'g2', equip: 'g2anvil', fp: [-0.9, -0.8, 0.9, 3.7], build(t) {
    t.m.box(1.6, 0.03, 3.8, 0, 0.015, 1.3, '#4a4f5a');
    t.m.box(0.5, 0.25, 0.5, 0, 0.125, 3.4, '#3c4250');
    t.col(-0.26, 3.14, 0.26, 3.66);
    t.station(0, 0, 0, ['anvilwalk'], { ax: 0, az: 2.6 });
  } },
  g2log: { name: 'الوار', icon: '🪵', group: 'g2', equip: 'g2log', fp: [-1.3, -1.2, 1.3, 1.2], build(t) {
    t.m.box(2.6, 0.06, 2.4, 0, 0.03, 0, '#3d2b1f');
    t.station(0, 0, 0, ['logpress'], { ax: 0, az: -1.3 });
  } },
  g2keg: { name: 'بشکه و میله', icon: '🛢️', group: 'g2', equip: 'g2keg', fp: [-1.5, -4.0, 1.5, 0.9], build(t) {
    for (const s of [-1, 1]) { t.mt.box(0.12, 3.4, 0.12, s * 1.3, 1.7, -2.3, '#ffb000'); t.col(s * 1.3 - 0.08, -2.38, s * 1.3 + 0.08, -2.22); }
    t.mt.box(2.7, 0.1, 0.1, 0, 3.4, -2.3, '#ffb000');
    for (let k = 0; k < 3; k++) { t.m.cyl(0.2, 0.5, -0.9 + k * 0.9, 0.25, -3.6, '#aab3c0', 0, 0, 0, 12); t.col(-1.1 + k * 0.9, -3.8, -0.7 + k * 0.9, -3.4); }
    t.station(0, 0, 0, ['kegtoss'], { ax: 0, az: 0.9 });
  } },
  g2truck: { name: 'کامیون', icon: '🚚', group: 'g2', equip: 'g2truck', fp: [-1.3, -0.9, 1.3, 14.3], build(t) {
    t.m.box(2.3, 2.6, 2.0, 0, 1.6, 8.9, '#c1121f');
    t.m.box(1.9, 1.0, 0.06, 0, 2.2, 7.88, '#9fd6ff');
    t.m.box(2.3, 2.0, 4.2, 0, 1.3, 12.0, '#e63946');
    for (const z of [8.9, 11.0, 13.2]) for (const s of [-1, 1]) t.m.cyl(0.45, 0.35, s * 1.15, 0.45, z, '#1d1d1d', 0, 0, Math.PI / 2, 14);
    for (const s of [-1, 1]) t.gl.box(0.4, 0.25, 0.06, s * 0.8, 1.0, 7.88, '#fff4c2');
    t.col(-1.33, 7.9, 1.33, 14.1);
    t.station(0, 0, 0, ['truckpull'], { ax: 0, az: -0.9 });
  } },
  g2bigtire: { name: 'لاستیک غول', icon: '🛞', group: 'g2', equip: 'g2bigtire', fp: [-1.6, -1.0, 1.6, 3.0], build(t) {
    t.m.box(3.2, 0.05, 4, 0, 0.025, 1.0, '#3d2b1f');
    t.station(0, 0, 0, ['tireflip'], { ax: 0, az: -1.0 });
  } },
  g2forge: { name: 'سندان آهنگری', icon: '⚒️', group: 'g2', equip: 'g2forge', fp: [-0.8, -0.8, 0.8, 1.3], build(t) {
    t.m.box(0.6, 0.6, 0.35, 0, 0.3, 0.8, '#2c3140');
    t.mt.box(0.85, 0.2, 0.4, 0, 0.7, 0.8, '#3c4250');
    t.mt.add(UnitGeo.cone(4), 0.55, 0.7, 0.8, '#3c4250', 0, 0, -Math.PI / 2, 0.14, 0.4, 0.14);
    t.gl.sphere(0.12, -0.25, 0.82, 0.8, '#ff7b00', 0.4);
    t.col(-0.62, 0.58, 0.62, 1.02);
    t.station(0, 0, 0, ['hammer'], { ax: 0, az: -0.9 });
  } },
  g2sled: { name: 'سورتمه‌ی فولادی', icon: '🛷', group: 'g2', equip: 'g2sled', fp: [-0.9, -0.7, 0.9, 5.2], build(t) {
    t.m.box(1.6, 0.03, 5.4, 0, 0.015, 2.3, '#4a4f5a');
    t.station(0, 0, 0, ['sledpush'], { ax: 0, az: 2.7 });
  } },
  g2stone: { name: 'سنگ آتشفشان', icon: '🌋', group: 'g2', equip: 'g2stone', fp: [-0.8, -0.8, 0.8, 1.4], build(t) {
    t.m.cyl(0.42, 1.25, 0, 0.625, 0.9, '#3c2a22', 0, 0, 0, 12);
    t.gl.cyl(0.43, 0.06, 0, 1.22, 0.9, '#ff5a00', 0, 0, 0, 12);
    t.col(-0.42, 0.48, 0.42, 1.32);
    t.station(0, 0, 0, ['atlas'], { ax: 0, az: -0.9 });
  } },
  g2car: { name: 'ماشین قرمز', icon: '🚗', group: 'g2', equip: 'g2car', fp: [-1.2, -0.9, 1.2, 3.0], build(t) {
    t.m.box(2.4, 0.05, 3.6, 0, 0.025, 1.2, '#4a4f5a');
    t.gl.box(0.8, 0.02, 0.2, 0, 0.06, 2.8, '#ff4d4d');
    t.station(0, 0, 0, ['carlift'], { ax: 0, az: -0.9 });
  } },
  g2beam: { name: 'تیرآهن', icon: '🏗️', group: 'g2', equip: 'g2beam', fp: [-1.6, -0.9, 1.6, 0.9], build(t) {
    for (const s of [-1, 1]) { t.mt.box(0.12, 2.0, 0.12, s * 1.4, 1.0, -0.6, '#ff7b00'); t.col(s * 1.4 - 0.08, -0.68, s * 1.4 + 0.08, -0.52); }
    t.station(0, 0, 0, ['beamsquat'], { ax: 0, az: 0.9 });
  } },
  g2climb: { name: 'زنجیر آویزان', icon: '🪝', group: 'g2', equip: 'g2climb', fp: [-1.1, -1.1, 1.1, 1.9], build(t) {
    const top = Math.min(9.6, (t.ceiling || 10) - 0.4);
    chainLinks(t, 0, 0.25, 0.3, top);
    t.mt.box(1.4, 0.2, 0.2, 0, top + 0.1, 0.25, '#3c4250');
    for (const s of [-1, 1]) t.mt.box(0.14, top + 0.2, 0.14, s * 0.7, (top + 0.2) / 2, 0.25, '#3c4250');
    for (const s of [-1, 1]) t.col(s * 0.7 - 0.09, 0.16, s * 0.7 + 0.09, 0.34);
    t.m.box(2.2, 0.02, 2.2, 0, 0.01, 0, '#ff7b00');
    t.station(0, 0, 0, ['ropeclimb'], { ax: 0, az: 1.8, rope: 0.25, ropeH: top - 0.3 });
  } },
  /* ---------- Titans' Temple ---------- */
  g3spear: { name: 'نیزه‌ی طلایی', icon: '🔱', group: 'g3', equip: 'g3spear', fp: [-0.9, -0.8, 0.9, 8.0], build(t) {
    t.m.box(1.6, 0.02, 8.4, 0, 0.012, 3.8, '#e2d6bd');
    t.mt.box(0.06, 1.6, 0.06, -0.6, 0.8, -0.4, '#d4af37');
    t.col(-0.65, -0.45, -0.55, -0.35);
    t.station(0, 0, 0, ['javelin'], { ax: 0, az: -0.8 });
  } },
  g3discus: { name: 'سکوی دیسک', icon: '🥏', group: 'g3', equip: 'g3discus', fp: [-1.4, -1.4, 1.4, 1.4], build(t) {
    t.m.cyl(1.25, 0.06, 0, 0.03, 0, '#c9b38a', 0, 0, 0, 24);
    t.gl.add(UnitGeo.torus(1, 0.04, 4, 32), 0, 0.07, 0, '#ffcf33', Math.PI / 2, 0, 0, 1.25, 1.25, 1.25);
    t.station(0, 0, 0, ['discus'], { ax: 0, az: -1.6 });
  } },
  g3mat: { name: 'تشک پانکراسیون', icon: '🥋', group: 'g3', equip: 'g3mat', fp: [-1.6, -1.2, 1.6, 1.2], build(t) {
    t.m.box(3.2, 0.04, 2.4, 0, 0.02, 0, '#b33a3a');
    t.m.box(3.3, 0.03, 2.5, 0, 0.015, 0, '#d4af37');
    t.station(0, 0, 0, ['kata'], { ax: 0, az: -1.4 });
  } },
  g3stairs: { name: 'پله‌های معبد', icon: '🏃', group: 'g3', equip: 'g3stairs', fp: [-1.8, -0.8, 1.8, 6.6], build(t) {
    for (let k = 0; k < 5; k++) t.m.box(3.4, 0.35 * (k + 1), 1.0, 0, 0.175 * (k + 1), 1.6 + k * 1.0, '#efe9dc');
    t.col(-1.7, 1.1, 1.7, 6.1);
    t.station(0, 0, 0, ['highknees'], { ax: 0, az: -0.8 });
  } },
  g3column: { name: 'ستون مرمری', icon: '🏛️', group: 'g3', equip: 'g3column', fp: [-1.7, -0.7, 1.7, 1.5], build(t) {
    t.m.box(3.2, 0.05, 1.4, 0, 0.13, 0.75, '#c9b38a');
    t.station(0, 0, 0, ['columnlift'], { ax: 0, az: -0.9 });
  } },
  g3boulder: { name: 'صخره‌ی تایتان', icon: '🪨', group: 'g3', equip: 'g3boulder', fp: [-0.8, -1.4, 0.8, 0.9], build(t) {
    t.m.sphere(0.36, 0, 0.36, -0.9, '#7a6a5a');
    t.col(-0.34, -1.24, 0.34, -0.56);
    t.station(0, 0, 0, ['boulderthrow'], { ax: 0.9, az: 0 });
  } },
  g3globe: { name: 'کره‌ی زمین', icon: '🌍', group: 'g3', equip: 'g3globe', fp: [-0.9, -0.9, 0.9, 0.9], build(t) {
    t.m.cyl(0.8, 0.1, 0, 0.05, 0, '#d4af37', 0, 0, 0, 20);
    t.station(0, 0, 0, ['globehold'], { ax: 0, az: -1.1 });
  } },
  g3chariot: { name: 'ارابه‌ی طلایی', icon: '🐎', group: 'g3', equip: 'g3chariot', fp: [-1.5, -0.9, 1.5, 9.9], build(t) {
    t.mt.box(2.2, 0.9, 1.4, 0, 1.0, 9.0, '#d4af37');
    for (const s of [-1, 1]) {
      t.mt.cyl(0.75, 0.1, s * 1.2, 0.75, 9.0, '#d4af37', 0, 0, Math.PI / 2, 18);
      t.mt.add(UnitGeo.torus(1, 0.15, 4, 18), s * 1.26, 0.75, 9.0, '#8a6d1a', 0, Math.PI / 2, 0, 0.7, 0.7, 0.7);
    }
    t.mt.box(0.12, 0.12, 2.6, 0, 0.8, 7.0, '#8a6d1a');
    t.col(-1.4, 8.2, 1.4, 9.8); t.col(-0.1, 5.7, 0.1, 8.2);
    t.station(0, 0, 0, ['truckpull'], { ax: 0, az: -0.9 });
  } },
  /* ---------- Cosmic Olympus ---------- */
  g4meteor: { name: 'شهاب‌سنگ آویزان', icon: '☄️', group: 'g4', equip: 'g4meteor', fp: [-0.9, -0.8, 0.9, 1.6], build(t) {
    t.mt.box(0.12, 3.6, 0.12, 0.8, 1.8, 0.85, '#c8a2ff');
    t.mt.box(0.9, 0.1, 0.1, 0.4, 3.6, 0.85, '#c8a2ff');
    t.mt.cyl(0.015, 1.4, 0, 2.9, 0.85, '#c8a2ff', 0, 0, 0, 5);
    t.m.sphere(0.5, 0, 1.75, 0.85, '#5a3a7a', 1.3);
    t.gl.sphere(0.12, 0.25, 1.9, 1.15, '#ff7b00');
    t.col(-0.45, 0.4, 0.88, 1.3);
    t.station(0, 0, 0, ['bigpunch'], { ax: 0, az: -0.9 });
  } },
  g4pad: { name: 'سکوی کم‌گرانش', icon: '🌙', group: 'g4', equip: 'g4pad', fp: [-1.1, -1.1, 1.1, 1.1], build(t) {
    t.gl.cyl(1.0, 0.06, 0, 0.03, 0, '#7bed9f', 0, 0, 0, 24);
    t.gl.add(UnitGeo.torus(1, 0.04, 4, 32), 0, 0.07, 0, '#ffffff', Math.PI / 2, 0, 0, 1.05, 1.05, 1.05);
    t.station(0, 0, 0, ['moonjump'], { ax: 0, az: -1.3 });
  } },
  g4star: { name: 'سبد ستاره‌ها', icon: '⭐', group: 'g4', equip: 'g4star', fp: [-0.9, -0.9, 1.2, 0.8], build(t) {
    t.m.cyl(0.35, 0.5, 0.7, 0.25, -0.4, '#3a2a5a', 0, 0, 0, 12);
    for (let k = 0; k < 4; k++) t.gl.sphere(0.1, 0.7 + (k % 2 ? 0.12 : -0.12), 0.55, -0.4 + (k < 2 ? 0.12 : -0.12), '#ffd34d');
    t.col(0.35, -0.75, 1.05, -0.05);
    t.station(0, 0, 0, ['starthrow'], { ax: -0.9, az: 0 });
  } },
  g4ice: { name: 'پیست کهکشانی', icon: '🛸', group: 'g4', equip: 'g4ice', fp: [-1.6, -1.2, 1.6, 1.2], build(t) {
    t.gl.box(3.2, 0.02, 2.4, 0, 0.012, 0, '#3a6aa8');
    t.station(0, 0, 0, ['skater'], { ax: 0, az: -1.4 });
  } },
  g4planet: { name: 'سیاره', icon: '🪐', group: 'g4', equip: 'g4planet', fp: [-1.0, -1.0, 1.0, 1.0], build(t) {
    t.gl.cyl(0.9, 0.05, 0, 0.025, 0, '#ff9f43', 0, 0, 0, 20);
    t.station(0, 0, 0, ['planetlift'], { ax: 0, az: -1.2 });
  } },
  g4comet: { name: 'دنباله‌دار', icon: '💫', group: 'g4', equip: 'g4comet', fp: [-0.9, -0.9, 0.9, 4.0], build(t) {
    t.gl.box(1.2, 0.02, 4.4, 0, 0.012, 1.6, '#4a2a8a');
    t.station(0, 0, 0, ['cometthrow'], { ax: 0, az: -0.9 });
  } },
  g4thunder: { name: 'سکوی صاعقه', icon: '⚡', group: 'g4', equip: 'g4thunder', fp: [-1.1, -1.1, 1.1, 1.1], build(t) {
    t.gl.cyl(1.0, 0.05, 0, 0.025, 0, '#7fe0ff', 0, 0, 0, 20);
    t.station(0, 0, 0, ['thunderslam'], { ax: 0, az: -1.3 });
  } },
  g4sun: { name: 'خورشید کوچک', icon: '☀️', group: 'g4', equip: 'g4sun', fp: [-1.0, -0.8, 1.0, 4.4], build(t) {
    t.gl.box(1.8, 0.02, 4.8, 0, 0.012, 1.8, '#ff8c1a');
    t.station(0, 0, 0, ['sunpush'], { ax: 0, az: 2.7 });
  } },
  /* ---------- decorations ---------- */
  d_gold: { name: 'مجسمه‌ی طلایی', icon: '🏆', group: 'decor', fp: [-0.85, -0.85, 0.85, 0.85], build(t) {
    t.statue(GOLD_OUTFIT, 'e_flex', 1.1);
  } },
  d_marble: { name: 'مجسمه‌ی مرمری', icon: '🗿', group: 'decor', fp: [-0.85, -0.85, 0.85, 0.85], build(t) {
    t.statue(MARBLE_OUTFIT, 'e_victory', 1.1);
  } },
  d_crystal: { name: 'مجسمه‌ی کریستالی', icon: '💎', group: 'decor', fp: [-0.85, -0.85, 0.85, 0.85], build(t) {
    t.statue(CRYSTAL_OUTFIT, 'e_salute', 1.1);
  } },
  d_plant: { name: 'گلدان بزرگ', icon: '🪴', group: 'decor', fp: [-0.5, -0.5, 0.5, 0.5], build(t) {
    t.m.cyl(0.4, 0.7, 0, 0.35, 0, '#e76f51');
    for (let i = 0; i < 6; i++) t.m.sphere(0.4, Math.cos(i * 1.1) * 0.22, 1.05 + (i % 3) * 0.28, Math.sin(i * 1.1) * 0.22, ['#2f9e44', '#40c057', '#2b8a3e'][i % 3]);
    t.col(-0.45, -0.45, 0.45, 0.45);
  } },
  d_bench: { name: 'نیمکت', icon: '🪑', group: 'decor', fp: [-1.3, -0.4, 1.3, 0.4], build(t) {
    t.m.box(2.4, 0.08, 0.5, 0, 0.45, 0, '#ffd34d');
    for (const s of [-1, 1]) t.m.box(0.08, 0.45, 0.45, s * 1.1, 0.22, 0, '#2c3140');
    t.col(-1.2, -0.25, 1.2, 0.25);
  } },
  d_lamp: { name: 'چراغ پایه‌دار', icon: '💡', group: 'decor', fp: [-0.35, -0.35, 0.35, 0.35], build(t) {
    t.mt.cyl(0.25, 0.08, 0, 0.04, 0, '#2c3140');
    t.mt.cyl(0.04, 2.6, 0, 1.3, 0, '#2c3140');
    t.gl.sphere(0.25, 0, 2.75, 0, t.light || '#ffe8a3');
    t.col(-0.26, -0.26, 0.26, 0.26);
  } },
  d_flag: { name: 'پرچم رنگی', icon: '🚩', group: 'decor', fp: [-0.3, -0.3, 1.3, 0.3], build(t) {
    t.mt.cyl(0.04, 3.6, 0, 1.8, 0, '#c9ced6');
    ['#e63946', '#ffd34d', '#2ecc71', '#2f6fed'].forEach((c, i) => t.m.box(1.1, 0.18, 0.03, 0.58, 3.3 - i * 0.18, 0, c));
    t.col(-0.1, -0.1, 0.1, 0.1);
  } },
  d_trophy: { name: 'جام روی پایه', icon: '🏅', group: 'decor', fp: [-0.5, -0.5, 0.5, 0.5], build(t) {
    t.m.box(0.8, 1.0, 0.8, 0, 0.5, 0, '#1d2433');
    t.mt.cyl(0.22, 0.1, 0, 1.05, 0, '#ffcf33');
    t.mt.cyl(0.08, 0.25, 0, 1.2, 0, '#ffcf33');
    t.mt.add(UnitGeo.cone(16), 0, 1.55, 0, '#ffcf33', Math.PI, 0, 0, 0.3, 0.45, 0.3);
    t.col(-0.42, -0.42, 0.42, 0.42);
  } },
  d_crates: { name: 'جعبه‌های چوبی', icon: '📦', group: 'decor', fp: [-0.9, -0.6, 0.9, 0.6], build(t) {
    t.m.box(0.8, 0.8, 0.8, -0.42, 0.4, 0, '#b58450');
    t.m.box(0.8, 0.8, 0.8, 0.42, 0.4, 0, '#a0703f');
    t.m.box(0.7, 0.7, 0.7, 0, 1.15, 0, '#c99a62');
    t.col(-0.84, -0.42, 0.84, 0.42);
  } },
  d_neon: { name: 'تابلوی نئون قلب', icon: '💖', group: 'decor', fp: [-0.7, -0.3, 0.7, 0.3], build(t) {
    for (const s of [-1, 1]) t.mt.box(0.08, 2.2, 0.08, s * 0.55, 1.1, 0, '#2c3140');
    t.gl.sphere(0.3, -0.2, 2.05, 0, '#ff4da6', 0.4);
    t.gl.sphere(0.3, 0.2, 2.05, 0, '#ff4da6', 0.4);
    t.gl.add(UnitGeo.cone(4), 0, 1.75, 0, '#ff4da6', Math.PI, Math.PI / 4, 0, 0.42, 0.5, 0.08);
    for (const s of [-1, 1]) t.col(s * 0.55 - 0.06, -0.06, s * 0.55 + 0.06, 0.06);
  } },
  d_mat: { name: 'تشک رنگی', icon: '🟥', group: 'decor', fp: [-1.2, -1.2, 1.2, 1.2], build(t) {
    for (let i = 0; i < 4; i++) t.m.box(1.2, 0.03, 1.2, -0.6 + (i % 2) * 1.2, 0.015, -0.6 + Math.floor(i / 2) * 1.2, ['#ff4da6', '#ffd34d', '#7fe0ff', '#2ecc71'][i]);
  } },
};

/* ---------- placing pieces into a world ---------- */

Object.assign(WorldBase.prototype, {
  /** Build one placed piece as its own little group, with its colliders and exercise spots. */
  addPlaced(item, ghostMat) {
    const def = PLACEABLES[item.type];
    if (!def) return null;
    const yaw = (item.rot || 0) * Math.PI / 2;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const toW = (lx, lz) => [item.x + lx * c + lz * s, item.z - lx * s + lz * c];
    const group = new THREE.Group();
    group.position.set(item.x, 0, item.z);
    group.rotation.y = yaw;
    const t = {
      m: new Batch(), mt: new Batch(), gl: new Batch(), ceiling: this.ceiling, light: this.theme && this.theme.light,
      cols: [], sts: [], objs: [],
      col(x1, z1, x2, z2) { t.cols.push([x1, z1, x2, z2]); },
      station(lx, lz, lyaw, acts, opts = {}) { t.sts.push({ lx, lz, lyaw, acts, opts }); },
      statue(outfit, anim, plinth) {
        t.m.box(1.4, plinth, 1.4, 0, plinth / 2, 0, '#2c3140');
        t.mt.box(1.48, 0.08, 1.48, 0, plinth, 0, '#d4af37');
        t.col(-0.72, -0.72, 0.72, 0.72);
        const ch = new Character(Object.assign({}, outfit, { muscle: 1 }));
        ch.manual = true;
        copyPose(ch.manualPose, makePose());
        ANIMS[anim].fn(ch.manualPose, 0.5, ch);
        standOnPlinth(ch.manualPose);
        copyPose(ch.cur, ch.manualPose);
        ch.apply();
        ch.root.position.y = plinth + 0.04;
        t.objs.push(ch.root);
      },
    };
    def.build(t);
    for (const [b, mat] of [[t.m, MATTE_MAT], [t.mt, METAL_MAT], [t.gl, GLOW_MAT]]) {
      if (!b.parts.length) continue;
      group.add(new THREE.Mesh(mergeParts(b.parts, false), ghostMat || mat));
    }
    for (const o of t.objs) {
      if (ghostMat) o.traverse((k) => { if (k.isMesh) k.material = ghostMat; });
      group.add(o);
    }
    this.scene.add(group);
    if (ghostMat) {
      // show the whole footprint on the floor too
      const [x1, z1, x2, z2] = def.fp;
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), ghostMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set((x1 + x2) / 2, 0.04, (z1 + z2) / 2);
      group.add(pad);
      return { group };
    }
    const placed = { item, group, colliders: [], stations: [] };
    for (const [x1, z1, x2, z2] of t.cols) {
      const [ax, az] = toW(x1, z1);
      const [bx, bz] = toW(x2, z2);
      const r = { x1: Math.min(ax, bx), z1: Math.min(az, bz), x2: Math.max(ax, bx), z2: Math.max(az, bz), placed: item.id };
      this.colliders.push(r);
      placed.colliders.push(r);
    }
    for (const st of t.sts) {
      const [x, z] = toW(st.lx, st.lz);
      const o = Object.assign({}, st.opts);
      if (o.ax != null) { const [ax, az] = toW(o.ax, o.az); o.ax = ax; o.az = az; }
      const sta = this.addStation(x, z, yaw + st.lyaw, st.acts, Object.assign(o, { equip: def.equip, placed: item.id }));
      placed.stations.push(sta);
    }
    (this.placed || (this.placed = new Map())).set(item.id, placed);
    return placed;
  },

  removePlaced(id) {
    const p = this.placed && this.placed.get(id);
    if (!p) return;
    this.scene.remove(p.group);
    p.group.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && o.geometry) o.geometry.dispose(); });
    this.colliders = this.colliders.filter((c) => c.placed !== id);
    for (const s of p.stations) {
      if (s.occ) {
        const n = s.occ;
        n.ch.stopAction();
        this.leaveStation(n);
        n.state = 'idle';
        n.timer = rand(0.3, 1);
      }
      if (s.player && this.player) { this.player.ch.stopAction(); this.player.anchor = null; s.player = false; }
    }
    this.stations = this.stations.filter((s) => s.placed !== id);
    this.placed.delete(id);
  },

  /** Footprint of a piece in world space. */
  placedRect(item) {
    const def = PLACEABLES[item.type];
    const yaw = (item.rot || 0) * Math.PI / 2;
    const c = Math.round(Math.cos(yaw));
    const s = Math.round(Math.sin(yaw));
    const [x1, z1, x2, z2] = def.fp;
    const pts = [[x1, z1], [x2, z2]].map(([lx, lz]) => [item.x + lx * c + lz * s, item.z - lx * s + lz * c]);
    return { x1: Math.min(pts[0][0], pts[1][0]), z1: Math.min(pts[0][1], pts[1][1]), x2: Math.max(pts[0][0], pts[1][0]), z2: Math.max(pts[0][1], pts[1][1]) };
  },

  /** Can this piece stand here without going through walls, other things or anyone's exercise spot? */
  canPlace(item, ignoreId) {
    const r = this.placedRect(item);
    const B = this.bounds;
    if (B.rect) {
      if (r.x1 < -B.rect[0] + 0.4 || r.x2 > B.rect[0] - 0.4 || r.z1 < -B.rect[1] + 0.4 || r.z2 > B.rect[1] - 0.4) return 'wall';
    } else {
      for (const [x, z] of [[r.x1, r.z1], [r.x2, r.z1], [r.x1, r.z2], [r.x2, r.z2]]) if (Math.hypot(x, z) > B.circle - 0.4) return 'wall';
    }
    for (const c of this.colliders) {
      if (ignoreId && c.placed === ignoreId) continue;
      if (c.x1 < r.x2 && c.x2 > r.x1 && c.z1 < r.z2 && c.z2 > r.z1) return 'thing';
    }
    for (const s of this.stations) {
      if (ignoreId && s.placed === ignoreId) continue;
      for (const [x, z] of [[s.x, s.z], [s.ax, s.az]]) {
        if (x > r.x1 - 0.5 && x < r.x2 + 0.5 && z > r.z1 - 0.5 && z < r.z2 + 0.5) return 'spot';
      }
    }
    if (this.spots) {
      for (const sp of this.spots) if (sp.x > r.x1 - 1 && sp.x < r.x2 + 1 && sp.z > r.z1 - 1 && sp.z < r.z2 + 1) return 'spot';
    }
    for (const p of [PORTAL, typeof LUCKY_PORTAL !== 'undefined' ? LUCKY_PORTAL : null]) {
      if (this === Game.gym && p && p.x > r.x1 - 3 && p.x < r.x2 + 3 && p.z > r.z1 - 3 && p.z < r.z2 + 3) return 'spot';
    }
    return null;
  },
});

/* ---------- the Steel Gym's own look and the default layout ---------- */

const G2_THEMES = {
  wall: ['#6e341a', '#1d2b4f', '#1f5f5b', '#3d1f5a', '#4a4f5a', '#8a1c2b', '#c7d0e2', '#2e5e1f'],
  floor: [['#2b2e34', '#33373e'], ['#1d2a4a', '#24345c'], ['#4a1d1d', '#5c2424'], ['#2a3d24', '#34502c'], ['#3d2b1f', '#4a3626'], ['#e9e4d8', '#d8d2c4']],
  light: ['#ffd9a0', '#bfe9ff', '#ffb3e6', '#b8ffcf', '#fff3b0', '#ff9a8a'],
};

const G2_DEFAULT_LAYOUT = [
  ...[-25, -21, -17].map((x) => ['g2tire', x, -12, 2]),
  ...[-25, -21].map((x) => ['g2chainbar', x, -3, 0]),
  ...[-15, -11].map((x) => ['g2log', x, -3, 2]),
  ...[17, 21, 25].map((x) => ['g2keg', x, -12, 2]),
  ...[9, 13].map((x) => ['g2anvil', x, -3, 2]),
  ...[19, 23].map((x) => ['g2kb', x, -3, 2]),
  ...[-25, -19].map((x) => ['g2bigtire', x, 7, 2]),
  ['g2truck', -12, 16, 3],
  ...[-7, -3].map((x) => ['g2car', x, 10, 2]),
  ...[8, 12].map((x) => ['g2beam', x, 7, 2]),
  ...[17, 22].map((x) => ['g2stone', x, 7, 2]),
  ...[6, 10].map((x) => ['g2sled', x, 17, 2]),
  ...[21, 25].map((x) => ['g2climb', x, 16, 2]),
  ...[-3, 3].map((x) => ['g2forge', x, -15.2, 2]),
].map(([type, x, z, rot], i) => ({ id: 'd' + i, type, x, z, rot }));
