'use strict';
/*
 * Three more champion gyms, each with its own look and its own exercises.
 *  - Steel Gym (باشگاه فولاد): an industrial forge. It keeps a level of its own that starts at 1
 *    and is harder to raise; your main level waits for you back in the first gym.
 *  - Titans' Temple (معبد تایتان‌ها) and Cosmic Olympus (المپ کیهانی): open at main level 500.
 *    Each has a special zone whose lifts are so heavy that only level 500 (Titans) or
 *    level 1000 (Olympus) can do them. Try one below that and you fail and lose 20 levels.
 */

const G2_LEVEL = 25;
const G2_HARD = 1.6;
const GYM3_LEVEL = 500;
const TITAN_LEVEL = 500;
const OLYMPUS_LEVEL = 1000;
const ZONE_PENALTY = 20;

const GYM_ENVS = [
  { id: 'gym2', name: 'باشگاه فولاد', icon: '⚙️', level: G2_LEVEL, track: 'g2', gym: 2, cat: 'g2', desc: 'باشگاه دوم: سطحت از ۱ شروع می‌شه و سخت‌تره' },
  { id: 'gym3', name: 'معبد تایتان‌ها', icon: '🏛️', level: GYM3_LEVEL, gym: 3, cat: 'g3', desc: 'ورزش‌های اسطوره‌ای • میدان تایتان: فقط ۵۰۰+' },
  { id: 'gym4', name: 'المپ کیهانی', icon: '🌌', level: GYM3_LEVEL, gym: 4, cat: 'g4', desc: 'ورزش بین ستاره‌ها • قله‌ی المپ: فقط ۱۰۰۰+' },
];
ENVS.push(...GYM_ENVS);
for (const e of GYM_ENVS) ENV_BY_ID[e.id] = e;

Object.assign(EQUIP, {
  g2tire: { name: 'لاستیک و پتک', env: 'gym2', where: 'باشگاه فولاد، ردیف شمال غربی' },
  g2chainbar: { name: 'میله‌ی زنجیری', env: 'gym2', where: 'باشگاه فولاد، غرب' },
  g2kb: { name: 'کتل‌بل آهنی', env: 'gym2', where: 'باشگاه فولاد، شرق' },
  g2anvil: { name: 'سندان‌ها', env: 'gym2', where: 'باشگاه فولاد، وسط شرق' },
  g2log: { name: 'الوار', env: 'gym2', where: 'باشگاه فولاد، وسط غرب' },
  g2keg: { name: 'بشکه و میله', env: 'gym2', where: 'باشگاه فولاد، شمال شرقی' },
  g2truck: { name: 'کامیون', env: 'gym2', where: 'باشگاه فولاد، جنوب غربی' },
  g2bigtire: { name: 'لاستیک غول', env: 'gym2', where: 'باشگاه فولاد، غرب' },
  g2forge: { name: 'سندان آهنگری', env: 'gym2', where: 'کوره‌ی شمال' },
  g2sled: { name: 'سورتمه‌ی فولادی', env: 'gym2', where: 'باشگاه فولاد، جنوب' },
  g2stone: { name: 'سنگ آتشفشان', env: 'gym2', where: 'باشگاه فولاد، شرق' },
  g2car: { name: 'ماشین قرمز', env: 'gym2', where: 'باشگاه فولاد، جنوب' },
  g2beam: { name: 'تیرآهن', env: 'gym2', where: 'باشگاه فولاد، شرق' },
  g2climb: { name: 'زنجیر آویزان', env: 'gym2', where: 'گوشه‌ی جنوب شرقی' },
  g3spear: { name: 'نیزه‌ی طلایی', env: 'gym3', where: 'غرب معبد' },
  g3discus: { name: 'سکوی دیسک', env: 'gym3', where: 'شرق معبد' },
  g3mat: { name: 'تشک پانکراسیون', env: 'gym3', where: 'غرب معبد' },
  g3stairs: { name: 'پله‌های معبد', env: 'gym3', where: 'شرق معبد' },
  g3column: { name: 'ستون مرمری', env: 'gym3', where: 'میدان تایتان' },
  g3boulder: { name: 'صخره‌ی تایتان', env: 'gym3', where: 'میدان تایتان' },
  g3globe: { name: 'کره‌ی زمین', env: 'gym3', where: 'میدان تایتان' },
  g3chariot: { name: 'ارابه‌ی طلایی', env: 'gym3', where: 'میدان تایتان' },
  g4meteor: { name: 'شهاب‌سنگ آویزان', env: 'gym4', where: 'غرب المپ' },
  g4pad: { name: 'سکوی کم‌گرانش', env: 'gym4', where: 'شرق المپ' },
  g4star: { name: 'سبد ستاره‌ها', env: 'gym4', where: 'غرب المپ' },
  g4ice: { name: 'پیست کهکشانی', env: 'gym4', where: 'شرق المپ' },
  g4planet: { name: 'سیاره', env: 'gym4', where: 'قله‌ی المپ' },
  g4comet: { name: 'دنباله‌دار', env: 'gym4', where: 'قله‌ی المپ' },
  g4thunder: { name: 'سکوی صاعقه', env: 'gym4', where: 'قله‌ی المپ' },
  g4sun: { name: 'خورشید کوچک', env: 'gym4', where: 'قله‌ی المپ' },
});

const GYM_MOVES = [
  // Steel Gym: levels here are Steel Gym levels
  ['g2hammer', 'پتک روی لاستیک', '🔨', 1, 12, 'g2tire', 'hammer'],
  ['g2chain', 'بارفیکس زنجیری', '⛓️', 2, 14, 'g2chainbar', 'pullup'],
  ['g2kb', 'کتل‌بل آهنی', '🔔', 3, 16, 'g2kb', 'kettle'],
  ['g2anvil', 'راه رفتن با سندان', '🧱', 5, 20, 'g2anvil', 'anvilwalk'],
  ['g2log', 'پرس الوار', '🪵', 7, 24, 'g2log', 'logpress'],
  ['g2keg', 'پرتاب بشکه', '🛢️', 10, 28, 'g2keg', 'kegtoss'],
  ['g2truck', 'کشیدن کامیون', '🚚', 13, 32, 'g2truck', 'truckpull'],
  ['g2tire', 'لاستیک غول‌پیکر', '🛞', 16, 36, 'g2bigtire', 'tireflip'],
  ['g2forge', 'پتک آهنگری', '⚒️', 20, 40, 'g2forge', 'hammer'],
  ['g2sled', 'سورتمه‌ی فولادی', '🛷', 25, 46, 'g2sled', 'sledpush'],
  ['g2stone', 'سنگ آتشفشان', '🌋', 30, 52, 'g2stone', 'atlas'],
  ['g2car', 'ددلیفت ماشین', '🚗', 38, 60, 'g2car', 'carlift'],
  ['g2beam', 'اسکوات تیرآهن', '🏗️', 46, 70, 'g2beam', 'beamsquat'],
  ['g2climb', 'صعود از زنجیر', '🪝', 55, 80, 'g2climb', 'ropeclimb'],
  // Titans' Temple (main level)
  ['g3spear', 'نیزه‌ی طلایی', '🔱', GYM3_LEVEL, 320, 'g3spear', 'javelin'],
  ['g3discus', 'پرتاب دیسک', '🥏', GYM3_LEVEL, 340, 'g3discus', 'discus'],
  ['g3pank', 'فنون پانکراسیون', '🥋', GYM3_LEVEL, 310, 'g3mat', 'kata'],
  ['g3stairs', 'دو روی پله‌های معبد', '🏃', GYM3_LEVEL, 300, 'g3stairs', 'highknees'],
  ['g3column', 'بلند کردن ستون', '🏛️', 1, 900, 'g3column', 'columnlift', TITAN_LEVEL],
  ['g3boulder', 'پرتاب صخره‌ی تایتان', '🪨', 1, 950, 'g3boulder', 'boulderthrow', TITAN_LEVEL],
  ['g3globe', 'حمل کره‌ی زمین', '🌍', 1, 1100, 'g3globe', 'globehold', TITAN_LEVEL],
  ['g3chariot', 'کشیدن ارابه', '🐎', 1, 1000, 'g3chariot', 'truckpull', TITAN_LEVEL],
  // Cosmic Olympus (main level)
  ['g4meteor', 'مشت به شهاب‌سنگ', '☄️', GYM3_LEVEL, 420, 'g4meteor', 'bigpunch'],
  ['g4moon', 'پرش ماه', '🌙', GYM3_LEVEL, 400, 'g4pad', 'moonjump'],
  ['g4star', 'پرتاب ستاره', '⭐', GYM3_LEVEL, 440, 'g4star', 'starthrow'],
  ['g4skate', 'اسکیت کهکشانی', '🛸', GYM3_LEVEL, 380, 'g4ice', 'skater'],
  ['g4planet', 'بلند کردن سیاره', '🪐', 1, 2400, 'g4planet', 'planetlift', OLYMPUS_LEVEL],
  ['g4comet', 'پرتاب دنباله‌دار', '💫', 1, 2500, 'g4comet', 'cometthrow', OLYMPUS_LEVEL],
  ['g4thunder', 'کوبش صاعقه', '⚡', 1, 2600, 'g4thunder', 'thunderslam', OLYMPUS_LEVEL],
  ['g4sun', 'هل دادن خورشید', '☀️', 1, 2700, 'g4sun', 'sunpush', OLYMPUS_LEVEL],
].map(([id, name, icon, level, xp, equip, anim, zone]) => {
  const env = EQUIP[equip].env;
  return Object.assign({ id, name, icon, level, xp, equip, anim, cat: ENV_BY_ID[env].cat, gym: env }, zone ? { zone } : {});
});
MOVES.push(...GYM_MOVES);
for (const m of GYM_MOVES) MOVE_BY_ID[m.id] = m;

/* ---------- props and anims that only these gyms use ---------- */

Object.assign(EXTRA_PROPS, {
  anvils(ch, pr) {
    for (const s of ['haL', 'haR']) {
      const m = propMesh((b) => {
        b.box(0.16, 0.08, 0.3, 0, -0.2, 0, '#3c4250');
        b.box(0.1, 0.08, 0.16, 0, -0.27, 0, '#2c3140');
        b.box(0.2, 0.06, 0.2, 0, -0.33, 0, '#3c4250');
        b.cyl(0.02, 0.18, 0, -0.08, 0, '#c9ced6');
      });
      ch.B[s].add(m);
      pr.meshes.push(m);
    }
  },
  sunball(ch, pr) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14), new THREE.MeshBasicMaterial({ color: '#ffcf33', toneMapped: false }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.95, 20, 14), new THREE.MeshBasicMaterial({ color: '#ff8c1a', transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }));
    m.add(halo);
    m.position.set(0, 1.0, 1.35);
    ch.root.add(m);
    pr.meshes.push(m);
    pr.tick = (c) => { halo.scale.setScalar(1 + 0.08 * Math.sin(c.time * 9)); };
  },
});

Object.assign(ANIMS, {
  anvilwalk: Object.assign({}, ANIMS.farmer, { props: ['anvils'] }),
  sunpush: Object.assign({}, ANIMS.sledpush, { props: ['sunball'] }),
});

/* ---------- shared builders ---------- */

const MARBLE_OUTFIT = {
  skin: '#f1ece2', hair: '#e2dccf', shirt: '#ebe5d8', accent: '#ffffff', shorts: '#e2dccf', shoes: '#ebe5d8',
  sole: '#d8d0c0', socks: '#ebe5d8', style: 'tank', band: null, number: false,
};
const BRONZE_OUTFIT = {
  skin: '#b0703a', hair: '#8a5226', shirt: '#c07f45', accent: '#e8b27a', shorts: '#9a5f2d', shoes: '#b0703a',
  sole: '#e8b27a', socks: '#b0703a', style: 'tank', band: null, number: false,
};
const CRYSTAL_OUTFIT = {
  skin: '#9fe8ff', hair: '#5ad1ff', shirt: '#c8f4ff', accent: '#ffffff', shorts: '#7fc8ff', shoes: '#9fe8ff',
  sole: '#ffffff', socks: '#9fe8ff', style: 'tank', band: '#ff7bf0', number: false,
};

/** A frozen character on a plinth: a statue. */
function makeStatue(w, outfit, anim, t, x, z, ry, { scale = 1, plinth = 1, plinthColor = '#d8d0c0', trim = '#d4af37', muscle = 1 } = {}) {
  if (plinth > 0) {
    w.matte.box(1.6 * scale, plinth, 1.6 * scale, x, plinth / 2, z, plinthColor);
    w.metal.box(1.68 * scale, 0.1, 1.68 * scale, x, plinth, z, trim);
    w.addCollider(x - 0.8 * scale, z - 0.8 * scale, x + 0.8 * scale, z + 0.8 * scale);
  }
  const ch = new Character(Object.assign({}, outfit, { muscle }));
  ch.root.scale.setScalar(scale);
  ch.root.position.set(x, plinth + 0.05, z);
  ch.root.rotation.y = ry;
  ch.manual = true;
  copyPose(ch.manualPose, makePose());
  ANIMS[anim].fn(ch.manualPose, t, ch);
  copyPose(ch.cur, ch.manualPose);
  ch.apply();
  w.scene.add(ch.root);
  return ch;
}

/** A flame that flickers: returns the mesh so the world can animate it. */
function flame(w, x, y, z, s = 1, color = '#ff9f1a') {
  const f = new THREE.Mesh(new THREE.ConeGeometry(0.16 * s, 0.5 * s, 8), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.08 * s, 0.3 * s, 8), new THREE.MeshBasicMaterial({ color: '#fff3b0', toneMapped: false }));
  core.position.y = -0.06 * s;
  f.add(core);
  f.position.set(x, y, z);
  w.scene.add(f);
  const ph = rand(0, TAU);
  w.anims.push((dt, time) => {
    f.scale.set(1 + 0.12 * Math.sin(time * 13 + ph), 1 + 0.25 * Math.sin(time * 17 + ph * 2), 1 + 0.12 * Math.cos(time * 11 + ph));
  });
  return f;
}

function ringSign(w, title, sub, x, y, z, color) {
  const s = labelSprite(title, sub, color, 6);
  s.position.set(x, y, z);
  w.scene.add(s);
  return s;
}

/* ---------- Steel Gym ---------- */

ENV_BUILDERS.gym2 = () => {
  const W = 30;
  const D = 22;
  const H = 10;
  const w = new EnvWorld('gym2', {
    bounds: { rect: [W, D] }, spawn: { x: 0, z: 18, yaw: Math.PI }, background: '#1a1210', fog: [45, 130],
    skyTop: '#120a06', skyBottom: '#2a140a', groundTint: 0x553322,
  });
  w.clouds.visible = false;
  w.zone = null;
  w.ceiling = H;
  w.cams = [
    { name: 'نمای کلی', pos: [0, 8.5, 20.5], look: [0, 1, -6] },
    { name: 'کوره', pos: [8, 5, -8], look: [0, 1.5, -19] },
    { name: 'گوشه‌ی غربی', pos: [-12, 6, 18], look: [-22, 0.5, -4] },
    { name: 'گوشه‌ی شرقی', pos: [12, 6, 18], look: [22, 0.5, -4] },
  ];
  const m = w.matte;
  const mt = w.metal;
  const glow = w.glow;
  const warm = new THREE.PointLight(0xff7a2a, 1.4, 40, 1.6);
  warm.position.set(0, 4, -17);
  w.scene.add(warm);
  // steel floor plates and hazard edges
  for (let i = 0; i < 15; i++) {
    for (let j = 0; j < 11; j++) m.box(3.96, 0.06, 3.96, -W + 2 + i * 4, -0.02, -D + 2 + j * 4, (i + j) % 2 ? '#2b2e34' : '#33373e');
  }
  for (let i = 0; i < 30; i++) {
    m.box(1.0, 0.065, 0.5, -W + 1 + i * 2, 0.0, -D + 0.3, i % 2 ? '#ffd34d' : '#1d1d1d', 0.6);
    m.box(1.0, 0.065, 0.5, -W + 1 + i * 2, 0.0, D - 0.3, i % 2 ? '#ffd34d' : '#1d1d1d', 0.6);
  }
  // corrugated rusty walls with ribs, roof trusses, hanging lamps
  m.box(W * 2, H, 0.4, 0, H / 2, -D - 0.2, '#6e341a');
  m.box(W * 2, H, 0.4, 0, H / 2, D + 0.2, '#6e341a');
  m.box(0.4, H, D * 2, -W - 0.2, H / 2, 0, '#6e341a');
  m.box(0.4, H, D * 2, W + 0.2, H / 2, 0, '#6e341a');
  for (let i = 0; i <= 30; i++) {
    for (const z of [-D + 0.05, D - 0.05]) m.box(0.18, H, 0.12, -W + i * 2, H / 2, z, '#8a4422');
  }
  for (let j = 0; j <= 22; j++) for (const x of [-W + 0.05, W - 0.05]) m.box(0.12, H, 0.18, x, H / 2, -D + j * 2, '#8a4422');
  m.box(W * 2, 0.3, D * 2, 0, H + 0.15, 0, '#1a1614');
  for (let i = 0; i < 8; i++) {
    const z = -D + 2.75 + i * 5.5;
    mt.box(W * 2, 0.4, 0.3, 0, H - 0.4, z, '#3a3f48');
    for (let k = 0; k < 12; k++) mt.box(0.12, 1.5, 0.12, -W + 2.5 + k * 5, H - 1.1, z, '#3a3f48', 0, 0, k % 2 ? 0.6 : -0.6);
  }
  for (const [x, z] of [[-18, -8], [-6, -8], [6, -8], [18, -8], [-18, 6], [-6, 6], [6, 6], [18, 6]]) {
    mt.cyl(0.02, 2.4, x, H - 1.6, z, '#2c3140', 0, 0, 0, 6);
    mt.cyl(0.55, 0.35, x, H - 2.9, z, '#2c3140', 0, 0, 0, 14);
    glow.cyl(0.45, 0.04, x, H - 3.08, z, '#ffd9a0', 0, 0, 0, 14);
  }
  // shipping containers along the side walls
  for (const [x, z, c, rib] of [[-27.4, 18, '#2f6fed', '#2458c0'], [27.4, -3, '#2a9d8f', '#1f7a70'], [27.4, 3.4, '#e63946', '#b8252f'], [-27.4, 12.5, '#ff7b00', '#cc6200']]) {
    m.box(2.4, 2.6, 6, x, 1.3, z, c);
    for (let k = 0; k < 9; k++) m.box(2.44, 2.4, 0.08, x, 1.3, z - 2.7 + k * 0.67, rib);
    w.addCollider(x - 1.2, z - 3, x + 1.2, z + 3);
  }
  // the forge: a glowing lava trough, chimney and two anvils
  m.box(12, 1.0, 3.2, 0, 0.5, -20.2, '#2c2420');
  glow.box(10.6, 0.06, 2.0, 0, 1.02, -20.2, '#ff5a00');
  for (let i = 0; i < 7; i++) glow.sphere(0.3, -4.5 + i * 1.5, 1.02, -20.2 + rand(-0.5, 0.5), i % 2 ? '#ffb347' : '#ff7b00', 0.25);
  m.box(4, 6, 2.2, 0, 4, -21, '#3a2e28');
  m.add(UnitGeo.cone(4), 0, 7.8, -21, '#2c2420', 0, Math.PI / 4, 0, 2.6, 1.6, 2.0);
  w.addCollider(-6, -21.8, 6, -18.6);
  for (const x of [-3, 3]) {
    const st = w.equipStation('g2forge', 'hammer', x, -15.2, Math.PI);
    const [ax, az] = local(st, 0, 0.8);
    m.box(0.6, 0.6, 0.35, ax, 0.3, az, '#2c3140');
    mt.box(0.85, 0.2, 0.4, ax, 0.7, az, '#3c4250');
    mt.add(UnitGeo.cone(4), ax + 0.55, 0.7, az, '#3c4250', 0, 0, -Math.PI / 2, 0.14, 0.4, 0.14);
    w.addCollider(ax - 0.5, az - 0.25, ax + 0.5, az + 0.25);
  }
  const sparks = { t: 0 };
  w.anims.push((dt) => {
    sparks.t -= dt;
    if (sparks.t <= 0 && w.fx) {
      sparks.t = rand(0.25, 0.7);
      w.fx.burst({ x: rand(-4.5, 4.5), y: 1.1, z: -20 }, { count: 6, colors: ['#ffb347', '#ff5a00', '#fff3b0'], speed: 1.6, up: 3.2, life: 0.9 });
    }
  });
  // a giant turning gear on the forge chimney
  const gear = new THREE.Group();
  const gb = new Batch();
  gb.add(UnitGeo.torus(1, 0.18, 6, 28), 0, 0, 0, '#ffb000', 0, 0, 0, 1.6, 1.6, 1.6);
  for (let i = 0; i < 12; i++) gb.box(0.4, 0.5, 0.25, Math.cos(i * 0.5236) * 1.95, Math.sin(i * 0.5236) * 1.95, 0, '#ffb000', 0, 0, i * 0.5236 + Math.PI / 2);
  for (let i = 0; i < 4; i++) gb.box(2.9, 0.18, 0.18, 0, 0, 0, '#d89000', 0, 0, i * 0.785);
  gb.cyl(0.35, 0.3, 0, 0, 0, '#3c4250', Math.PI / 2, 0, 0, 14);
  gear.add(new THREE.Mesh(mergeParts(gb.parts, false), METAL_MAT));
  gear.position.set(0, 5.4, -19.85);
  w.scene.add(gear);
  w.anims.push((dt) => { gear.rotation.z += dt * 0.4; });
  // crane gantry with a swinging hook over the middle
  for (const x of [-12, 12]) for (const z of [-6, 10]) { mt.box(0.4, H - 1, 0.4, x, (H - 1) / 2, z, '#ffb000'); w.addCollider(x - 0.25, z - 0.25, x + 0.25, z + 0.25); }
  for (const z of [-6, 10]) mt.box(24.4, 0.5, 0.5, 0, H - 1.2, z, '#ffb000');
  const trolley = new THREE.Group();
  const tb = new Batch();
  tb.box(1.0, 0.5, 16.6, 0, 0, 0, '#ff9500');
  tb.cyl(0.02, 3.2, 0, -1.8, 0, '#2c3140', 0, 0, 0, 6);
  tb.add(UnitGeo.torus(1, 0.25, 6, 14), 0, -3.5, 0, '#c9ced6', 0, 0, 0, 0.28, 0.28, 0.28);
  trolley.add(new THREE.Mesh(mergeParts(tb.parts, false), METAL_MAT));
  trolley.position.set(0, H - 0.8, 2);
  w.scene.add(trolley);
  w.anims.push((dt, time) => { trolley.position.x = 9 * Math.sin(time * 0.15); });
  // stations
  for (const x of [-25, -21, -17]) {
    const st = w.equipStation('g2tire', 'hammer', x, -12, Math.PI);
    const [tx, tz] = local(st, 0, 0.95);
    m.add(UnitGeo.torus(1, 0.45, 8, 20), tx, 0.2, tz, '#1d1d1d', Math.PI / 2, 0, 0, 0.75, 0.75, 0.75);
    w.addCollider(tx - 0.6, tz - 0.6, tx + 0.6, tz + 0.6);
  }
  for (const x of [-25, -21]) {
    const z = -3;
    for (const s of [-1, 1]) mt.cyl(0.03, H - 2.5, x + s * 0.85, (H + 2.5) / 2, z, '#9aa0a8', 0, 0, 0, 5);
    mt.cyl(0.035, 1.8, x, 2.5, z, '#c9ced6', 0, 0, Math.PI / 2, 10);
    for (let k = 0; k < 10; k++) for (const s of [-1, 1]) mt.add(UnitGeo.torus(1, 0.3, 4, 8), x + s * 0.85, 3.0 + k * 0.6, z, '#9aa0a8', 0, k % 2 ? Math.PI / 2 : 0, 0, 0.1, 0.1, 0.1);
    w.addStation(x, z, 0, ['pullup'], { equip: 'g2chainbar', ax: x, az: z + 1.1 });
  }
  for (const x of [-15, -11]) {
    m.box(2.6, 0.06, 2.4, x, 0.03, -3, '#3d2b1f');
    w.equipStation('g2log', 'logpress', x, -3, Math.PI);
  }
  for (const x of [17, 21, 25]) {
    const st = w.equipStation('g2keg', 'kegtoss', x, -12, Math.PI);
    for (const s of [-1, 1]) {
      const [px, pz] = local(st, s * 1.3, -2.3);
      mt.box(0.12, 3.4, 0.12, px, 1.7, pz, '#ffb000');
      w.addCollider(px - 0.1, pz - 0.1, px + 0.1, pz + 0.1);
    }
    const [bx, bz] = local(st, 0, -2.3);
    mt.box(2.7, 0.1, 0.1, bx, 3.4, bz, '#ffb000', st.yaw);
    for (let k = 0; k < 3; k++) {
      const [kx, kz] = local(st, -0.9 + k * 0.9, -3.6);
      m.cyl(0.2, 0.5, kx, 0.25, kz, '#aab3c0', 0, 0, 0, 12);
    }
  }
  for (const x of [9, 13]) {
    const st = w.equipStation('g2anvil', 'anvilwalk', x, -3, Math.PI);
    const [ax, az] = local(st, 0, -3.4);
    m.box(1.6, 0.03, 4.6, x, 0.015, -4.6, '#4a4f5a');
    m.box(0.5, 0.25, 0.5, ax, 0.12, az, '#3c4250');
  }
  for (const x of [19, 23]) {
    m.box(2.2, 0.05, 2.2, x, 0.025, -3, '#3d2b1f');
    w.equipStation('g2kb', 'kettle', x, -3, Math.PI);
  }
  for (const x of [-25, -19]) {
    m.box(3.2, 0.05, 4, x, 0.025, 6, '#3d2b1f');
    w.equipStation('g2bigtire', 'tireflip', x, 7, Math.PI);
  }
  {
    const st = w.equipStation('g2truck', 'truckpull', -12, 16, -Math.PI / 2);
    const [cx, cz] = local(st, 0, 8.6);
    m.box(4.2, 2.0, 2.3, cx - 2.1, 1.3, cz, '#e63946');
    m.box(2.0, 2.6, 2.3, cx + 0.9, 1.6, cz, '#c1121f');
    m.box(0.06, 1.0, 1.9, cx + 1.92, 2.2, cz, '#9fd6ff');
    for (const dx of [-3.4, -1.0, 1.0]) for (const s of [-1, 1]) m.cyl(0.45, 0.35, cx + dx, 0.45, cz + s * 1.15, '#1d1d1d', Math.PI / 2, 0, 0, 14);
    glow.box(0.06, 0.25, 0.4, cx + 1.92, 1.0, cz + 0.8, '#fff4c2');
    glow.box(0.06, 0.25, 0.4, cx + 1.92, 1.0, cz - 0.8, '#fff4c2');
    w.addCollider(cx - 4.3, cz - 1.3, cx + 1.95, cz + 1.3);
  }
  for (const x of [-7, -3]) {
    m.box(2.4, 0.05, 3.6, x, 0.025, 8.6, '#4a4f5a');
    w.equipStation('g2car', 'carlift', x, 10, Math.PI);
  }
  for (const x of [8, 12]) {
    const st = w.equipStation('g2beam', 'beamsquat', x, 7, Math.PI);
    for (const s of [-1, 1]) {
      const [px, pz] = local(st, s * 1.4, -0.6);
      mt.box(0.12, 2.0, 0.12, px, 1.0, pz, '#ff7b00');
      w.addCollider(px - 0.1, pz - 0.1, px + 0.1, pz + 0.1);
    }
  }
  for (const x of [17, 22]) {
    const st = w.equipStation('g2stone', 'atlas', x, 7, Math.PI);
    const [px, pz] = local(st, 0, 0.9);
    m.cyl(0.42, 1.25, px, 0.62, pz, '#3c2a22', 0, 0, 0, 12);
    glow.cyl(0.43, 0.06, px, 1.2, pz, '#ff5a00', 0, 0, 0, 12);
    w.addCollider(px - 0.4, pz - 0.4, px + 0.4, pz + 0.4);
  }
  for (const x of [6, 10]) {
    m.box(1.6, 0.03, 5, x, 0.015, 14.5, '#4a4f5a');
    w.equipStation('g2sled', 'sledpush', x, 17, Math.PI);
  }
  for (const x of [21, 25]) {
    const z = 16;
    for (let k = 0; k < 14; k++) mt.add(UnitGeo.torus(1, 0.3, 4, 8), x, 0.6 + k * 0.62, z - 0.1, '#9aa0a8', 0, k % 2 ? Math.PI / 2 : 0, 0, 0.12, 0.12, 0.12);
    m.box(2.2, 0.3, 2.2, x, 0.15, z, '#ff7b00');
    w.addStation(x, z, Math.PI, ['ropeclimb'], { equip: 'g2climb', ax: x, az: z + 1.8 });
  }
  // walls of fire-coloured art: hammers, flames and a lion made of iron
  const art = makeCanvasTexture(1024, 384, (ctx, Wd, Hd) => {
    const g = ctx.createLinearGradient(0, 0, Wd, Hd);
    g.addColorStop(0, '#1d0c05'); g.addColorStop(0.5, '#5a1f08'); g.addColorStop(1, '#1d0c05');
    ctx.fillStyle = g; ctx.fillRect(0, 0, Wd, Hd);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = ['#ff5a00', '#ffb347', '#ffd34d'][i % 3];
      ctx.globalAlpha = 0.85;
      const x = (i / 26) * Wd + 10;
      ctx.beginPath(); ctx.moveTo(x, Hd); ctx.quadraticCurveTo(x + 30, Hd * 0.5 - (i % 5) * 20, x + 18, Hd * 0.2 + (i % 4) * 25); ctx.quadraticCurveTo(x + 50, Hd * 0.6, x + 40, Hd); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 16;
    for (const cx of [260, 760]) {
      ctx.save(); ctx.translate(cx, Hd / 2); ctx.rotate(cx < 500 ? -0.6 : 0.6);
      ctx.fillStyle = '#c9ced6'; ctx.fillRect(-14, -120, 28, 230); ctx.fillStyle = '#e9eef7'; ctx.fillRect(-60, -150, 120, 60);
      ctx.restore();
    }
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath(); ctx.arc(Wd / 2, Hd / 2, 90, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1d0c05';
    ctx.font = `120px ${DISPLAY_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('💪', Wd / 2, Hd / 2 + 8);
  });
  for (const [x, z, ry] of [[-W + 0.25, -6, Math.PI / 2], [W - 0.25, 10, -Math.PI / 2], [0, D - 0.25, Math.PI]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.5), new THREE.MeshBasicMaterial({ map: art, toneMapped: false }));
    p.position.set(x, 6.4, z);
    p.rotation.y = ry;
    w.scene.add(p);
  }
  ringSign(w, '⚙️ باشگاه فولاد', `سطح جدا • از ۱ شروع کن`, 0, 8.6, -12, '#ff9a3d');
  // iron statues of strongmen at the entrance
  makeStatue(w, Object.assign({}, BRONZE_OUTFIT, { skin: '#5d6675', hair: '#3c4250', shirt: '#6e7787', shorts: '#4a525f', shoes: '#5d6675', sole: '#9aa0a8', socks: '#5d6675', accent: '#c9ced6' }), 'e_flex', 0.5, -4.5, 19.6, Math.PI, { scale: 1.4, plinth: 0.8, plinthColor: '#2c2420', trim: '#ff7b00' });
  makeStatue(w, Object.assign({}, BRONZE_OUTFIT, { skin: '#5d6675', hair: '#3c4250', shirt: '#6e7787', shorts: '#4a525f', shoes: '#5d6675', sole: '#9aa0a8', socks: '#5d6675', accent: '#c9ced6' }), 'e_victory', 0.5, 4.5, 19.6, Math.PI, { scale: 1.4, plinth: 0.8, plinthColor: '#2c2420', trim: '#ff7b00' });
  w.finishBatches();
  return w;
};

/* ---------- Titans' Temple ---------- */

ENV_BUILDERS.gym3 = () => {
  const R = 34;
  const w = new EnvWorld('gym3', {
    bounds: { circle: R }, spawn: { x: 0, z: 28, yaw: Math.PI }, background: '#ffd9a0', fog: [90, 300],
    skyTop: '#4f9bff', skyBottom: '#ffe3b0', groundTint: 0x998866,
  });
  const Z = { x: 0, z: -16, r: 9.5 };
  w.zone = { x: Z.x, z: Z.z, r: Z.r, level: TITAN_LEVEL, name: 'میدان تایتان' };
  const m = w.matte;
  const mt = w.metal;
  const glow = w.glow;
  // marble island floating over a golden sea of clouds
  m.cyl(R + 1.5, 0.6, 0, -0.3, 0, '#efe9dc', 0, 0, 0, 64);
  m.cyl(R + 2.2, 3.0, 0, -2.1, 0, '#d8d0c0', 0, 0, 0, 64);
  for (let i = 0; i < 6; i++) m.add(UnitGeo.torus(1, 0.012, 4, 64), 0, 0.01, 0, i % 2 ? '#d4af37' : '#c9b38a', Math.PI / 2, 0, 0, 8 + i * 4.4, 8 + i * 4.4, 8 + i * 4.4);
  for (let i = 0; i < 24; i++) m.box(0.06, 0.012, R - 6, Math.sin(i * 0.2618) * (R / 2 + 3), 0.012, Math.cos(i * 0.2618) * (R / 2 + 3), '#e2d6bd', i * 0.2618);
  // colonnade around the edge
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU;
    if (Math.abs(wrapAngle(a)) < 0.12) continue;
    const x = Math.sin(a) * (R - 1.2);
    const z = Math.cos(a) * (R - 1.2);
    m.cyl(0.55, 0.4, x, 0.2, z, '#d8d0c0', 0, 0, 0, 14);
    m.cyl(0.42, 7, x, 3.9, z, '#f4efe5', 0, 0, 0, 14);
    m.box(1.3, 0.45, 1.3, x, 7.6, z, '#e2d6bd', -a);
    mt.box(1.35, 0.1, 1.35, x, 7.86, z, '#d4af37', -a);
    w.addCollider(x - 0.5, z - 0.5, x + 0.5, z + 0.5);
  }
  m.add(UnitGeo.torus(1, 0.04, 6, 96), 0, 8.1, 0, '#e2d6bd', Math.PI / 2, 0, 0, R - 1.2, R - 1.2, 14);
  // the gate behind the spawn
  for (const s of [-1, 1]) { m.cyl(0.6, 9, s * 3, 4.5, R - 1.2, '#f4efe5', 0, 0, 0, 16); w.addCollider(s * 3 - 0.6, R - 1.8, s * 3 + 0.6, R - 0.6); }
  m.box(8, 1.2, 1.4, 0, 9.4, R - 1.2, '#e2d6bd');
  m.add(UnitGeo.cone(3), 0, 10.6, R - 1.2, '#e2d6bd', 0, 0, 0, 4.6, 1.2, 0.7);
  mt.box(8.1, 0.15, 1.45, 0, 8.8, R - 1.2, '#d4af37');
  // reflecting pool and olive trees on the way in
  m.box(9, 0.25, 5.6, 0, 0.12, 13, '#d4af37');
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 5), new THREE.MeshStandardMaterial({ color: '#4fb3ff', roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.85 }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.26, 13);
  w.scene.add(pool);
  w.addCollider(-4.5, 10.2, 4.5, 15.8);
  for (const [x, z] of [[-9, 20], [9, 20], [-21, 18], [21, 18], [-25, -6], [25, -6]]) leafyTree(w, x, z, 0.9, ['#7f9a52', '#93ad62', '#6d8a45']);
  // torches all round
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.31;
    const x = Math.sin(a) * 26;
    const z = Math.cos(a) * 26;
    mt.cyl(0.08, 2.2, x, 1.1, z, '#d4af37', 0, 0, 0, 8);
    mt.cyl(0.28, 0.25, x, 2.3, z, '#d4af37', 0, 0, 0, 12);
    flame(w, x, 2.7, z, 1.4);
    w.addCollider(x - 0.2, z - 0.2, x + 0.2, z + 0.2);
  }
  // the Titans' arena: raised gold ring, fence with an open south gate
  m.cyl(Z.r, 0.12, Z.x, 0.06, Z.z, '#e8dcc0', 0, 0, 0, 48);
  glow.add(UnitGeo.torus(1, 0.013, 6, 64), Z.x, 0.14, Z.z, '#ffcf33', Math.PI / 2, 0, 0, Z.r, Z.r, Z.r);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU;
    if (Math.abs(wrapAngle(a)) < 0.2) continue;
    const x = Z.x + Math.sin(a) * (Z.r + 0.3);
    const z = Z.z + Math.cos(a) * (Z.r + 0.3);
    mt.cyl(0.07, 1.3, x, 0.65, z, '#d4af37', 0, 0, 0, 6);
    mt.sphere(0.12, x, 1.35, z, '#ffcf33');
    w.addCollider(x - 0.15, z - 0.15, x + 0.15, z + 0.15);
  }
  ringSign(w, '⚡ میدان تایتان', `فقط سطح ${fa(TITAN_LEVEL)} به بالا • جریمه: −${fa(ZONE_PENALTY)} سطح`, Z.x, 5.2, Z.z + Z.r + 0.6, '#ffcf33');
  // two giant marble Titans guarding the arena gate
  makeStatue(w, MARBLE_OUTFIT, 'globehold', 0.25, -6.5, Z.z + Z.r + 2.2, Math.PI, { scale: 3.2, plinth: 1.4 });
  makeStatue(w, MARBLE_OUTFIT, 'e_flex', 0.5, 6.5, Z.z + Z.r + 2.2, Math.PI, { scale: 3.2, plinth: 1.4 });
  // arena stations
  for (const [x, z] of [[-6, -19], [-2.2, -21.5]]) {
    const st = w.equipStation('g3column', 'columnlift', x, z, Math.PI);
    const [cx, cz] = local(st, 0, 0.75);
    m.box(3.2, 0.05, 1.4, cx, 0.13, cz, '#c9b38a', st.yaw);
  }
  for (const [x, z] of [[2.2, -21.5], [6, -19]]) {
    w.equipStation('g3globe', 'globehold', x, z, Math.PI);
    m.cyl(0.8, 0.1, x, 0.17, z, '#d4af37', 0, 0, 0, 20);
  }
  for (const x of [-4, 4]) {
    const st = w.equipStation('g3boulder', 'boulderthrow', x, -11.5, Math.PI);
    const [bx, bz] = local(st, 0, -0.9);
    m.sphere(0.36, bx, 0.36, bz, '#7a6a5a');
  }
  {
    const st = w.equipStation('g3chariot', 'truckpull', 0, -24, Math.PI);
    const [cx, cz] = local(st, 0, 8.6);
    mt.box(2.2, 0.9, 1.4, cx, 1.0, cz, '#d4af37');
    for (const s of [-1, 1]) {
      mt.cyl(0.75, 0.1, cx + s * 1.2, 0.75, cz, '#d4af37', 0, 0, Math.PI / 2, 18);
      mt.add(UnitGeo.torus(1, 0.15, 4, 18), cx + s * 1.26, 0.75, cz, '#8a6d1a', 0, Math.PI / 2, 0, 0.7, 0.7, 0.7);
    }
    mt.box(0.12, 0.12, 2.6, cx, 0.8, cz + 1.8, '#8a6d1a');
    w.addCollider(cx - 1.4, cz - 0.8, cx + 1.4, cz + 0.8);
  }
  // normal exercises around the temple
  for (const z of [6, 11]) {
    w.equipStation('g3spear', 'javelin', -12, z, -Math.PI / 2);
    m.box(30, 0.02, 1.6, -27, 0.012, z, '#e2d6bd');
    mt.box(0.06, 1.6, 0.06, -12.4, 0.8, z + 1.0, '#d4af37');
  }
  for (const z of [6, 11]) {
    w.equipStation('g3discus', 'discus', 12, z, Math.PI / 2);
    m.cyl(1.25, 0.06, 12, 0.03, z, '#c9b38a', 0, 0, 0, 24);
    glow.add(UnitGeo.torus(1, 0.05, 4, 32), 12, 0.07, z, '#ffcf33', Math.PI / 2, 0, 0, 1.25, 1.25, 1.25);
  }
  m.box(7, 0.06, 5, -16, 0.03, -3, '#b33a3a');
  m.box(7.2, 0.04, 5.2, -16, 0.02, -3, '#d4af37');
  for (const x of [-18, -14]) w.equipStation('g3mat', 'kata', x, -3, Math.PI);
  for (let k = 0; k < 5; k++) m.box(7, 0.35, 1.2, 17, 0.175 + k * 0.35, -9 - k * 1.2, '#efe9dc');
  w.addCollider(13.5, -15, 20.5, -8.4);
  for (const x of [15, 19]) w.equipStation('g3stairs', 'highknees', x, -6.5, Math.PI);
  // bronze and gold heroes along the path
  makeStatue(w, GOLD_OUTFIT, 'e_victory', 0.5, -9, 8, Math.PI / 2, { scale: 1.2 });
  makeStatue(w, BRONZE_OUTFIT, 'javelin', 0.6, 9, 8, -Math.PI / 2, { scale: 1.2, trim: '#b0703a' });
  makeStatue(w, MARBLE_OUTFIT, 'discus', 0.5, -20, 24, 0.6, { scale: 1.3 });
  makeStatue(w, BRONZE_OUTFIT, 'boxjump', 0.36, 20, 24, -0.6, { scale: 1.3, trim: '#b0703a' });
  // golden laurel crown floating above the arena
  const crown = new THREE.Group();
  const cb = new Batch();
  cb.add(UnitGeo.torus(1, 0.08, 6, 40), 0, 0, 0, '#ffcf33', Math.PI / 2, 0, 0, 1.6, 1.6, 1.6);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    cb.sphere(0.2, Math.cos(a) * 1.6, 0.12, Math.sin(a) * 1.6, i % 2 ? '#ffcf33' : '#e6b800', 0.5);
  }
  crown.add(new THREE.Mesh(mergeParts(cb.parts, false), METAL_MAT));
  crown.position.set(Z.x, 9, Z.z);
  w.scene.add(crown);
  w.anims.push((dt, time) => { crown.rotation.y += dt * 0.5; crown.position.y = 9 + Math.sin(time * 1.2) * 0.4; });
  w.finishBatches();
  return w;
};

/* ---------- Cosmic Olympus ---------- */

ENV_BUILDERS.gym4 = () => {
  const R = 32;
  const w = new EnvWorld('gym4', {
    bounds: { circle: R }, spawn: { x: 0, z: 26, yaw: Math.PI }, background: '#0b0420', fog: [120, 420],
    skyTop: '#05010f', skyBottom: '#2a0a4a', groundTint: 0x442266,
  });
  w.clouds.visible = false;
  for (const c of w.scene.children) if (c.material && c.material.side === THREE.BackSide) c.visible = false;
  const Z = { x: 0, z: -15, r: 9.5 };
  w.zone = { x: Z.x, z: Z.z, r: Z.r, level: OLYMPUS_LEVEL, name: 'قله‌ی المپ' };
  const m = w.matte;
  const mt = w.metal;
  const glow = w.glow;
  // stars
  const N = 1400;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const v = new THREE.Vector3(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize().multiplyScalar(rand(220, 300));
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, fog: false }));
  w.scene.add(stars);
  // galaxy swirl in the sky
  const gal = makeCanvasTexture(512, 512, (ctx, Wd) => {
    ctx.translate(Wd / 2, Wd / 2);
    for (let i = 0; i < 1800; i++) {
      const arm = i % 3;
      const r = Math.pow(Math.random(), 0.7) * 240;
      const a = r * 0.03 + arm * (TAU / 3) + rand(-0.35, 0.35);
      ctx.fillStyle = ['#ff7bf0', '#7fe0ff', '#ffd34d'][arm];
      ctx.globalAlpha = 0.5 * (1 - r / 260);
      ctx.fillRect(Math.cos(a) * r, Math.sin(a) * r, 3, 3);
    }
  });
  const galaxy = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshBasicMaterial({ map: gal, transparent: true, depthWrite: false, toneMapped: false, fog: false, blending: THREE.AdditiveBlending }));
  galaxy.position.set(-40, 140, -200);
  galaxy.lookAt(0, 0, 0);
  w.scene.add(galaxy);
  // planets
  const planets = [];
  for (const [x, y, z, r, c, ring] of [[90, 60, -160, 26, '#ff9f43', '#c8a2ff'], [-140, 40, -60, 14, '#4dd2ff', null], [60, 25, 150, 10, '#ff4da6', '#ffd34d'], [-60, 90, 120, 18, '#7bed9f', null]]) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, emissive: c, emissiveIntensity: 0.25, fog: false })));
    if (ring) {
      const rm = new THREE.Mesh(new THREE.RingGeometry(r * 1.4, r * 2.1, 48), new THREE.MeshBasicMaterial({ color: ring, side: THREE.DoubleSide, transparent: true, opacity: 0.6, toneMapped: false, fog: false }));
      rm.rotation.x = Math.PI / 2 - 0.4;
      g.add(rm);
    }
    g.position.set(x, y, z);
    w.scene.add(g);
    planets.push(g);
  }
  w.anims.push((dt) => { for (const p of planets) p.rotation.y += dt * 0.05; stars.rotation.y += dt * 0.004; });
  // the floating platform with a neon grid
  m.cyl(R + 1, 0.6, 0, -0.3, 0, '#1b0f33', 0, 0, 0, 64);
  m.add(UnitGeo.cone(64), 0, -7, 0, '#140a26', Math.PI, 0, 0, R + 1, 13, R + 1);
  glow.add(UnitGeo.torus(1, 0.008, 6, 96), 0, 0.02, 0, '#7fe0ff', Math.PI / 2, 0, 0, R + 0.6, R + 0.6, R + 0.6);
  for (let i = -R + 2; i <= R - 2; i += 4) {
    const half = Math.sqrt(R * R - i * i) - 0.5;
    glow.box(0.05, 0.01, half * 2, i, 0.012, 0, i % 8 === 0 ? '#ff7bf0' : '#5a2a8a');
    glow.box(half * 2, 0.01, 0.05, 0, 0.012, i, i % 8 === 0 ? '#7fe0ff' : '#3a2a8a');
  }
  // crystal pillars and floating rocks
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.26;
    const x = Math.sin(a) * (R - 2);
    const z = Math.cos(a) * (R - 2);
    if (z > R - 6 && Math.abs(x) < 6) continue;
    const h = rand(4, 8);
    glow.add(UnitGeo.cone(6), x, h / 2, z, i % 2 ? '#c8a2ff' : '#7fe0ff', 0, a, 0, 0.6, h, 0.6);
    w.addCollider(x - 0.5, z - 0.5, x + 0.5, z + 0.5);
  }
  const rocks = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.8, 2.2), 0), new THREE.MeshStandardMaterial({ color: pick(['#3a2a5a', '#4a3a6a', '#2a1a4a']), roughness: 0.9, flatShading: true }));
    const a = rand(0, TAU);
    const r = rand(R + 6, R + 20);
    g.position.set(Math.sin(a) * r, rand(2, 14), Math.cos(a) * r);
    w.scene.add(g);
    rocks.push({ g, y: g.position.y, ph: rand(0, TAU), s: rand(0.2, 0.6) });
  }
  w.anims.push((dt, time) => {
    for (const r of rocks) { r.g.position.y = r.y + Math.sin(time * r.s + r.ph) * 1.2; r.g.rotation.x += dt * 0.2; r.g.rotation.y += dt * 0.15; }
  });
  // Olympus peak: a glowing ring with a column of light and a hovering crown of stars
  m.cyl(Z.r, 0.12, Z.x, 0.06, Z.z, '#24124a', 0, 0, 0, 48);
  glow.add(UnitGeo.torus(1, 0.02, 6, 64), Z.x, 0.14, Z.z, '#ffd34d', Math.PI / 2, 0, 0, Z.r, Z.r, Z.r);
  glow.add(UnitGeo.torus(1, 0.011, 6, 64), Z.x, 0.15, Z.z, '#ff7bf0', Math.PI / 2, 0, 0, Z.r - 0.5, Z.r - 0.5, Z.r - 0.5);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    if (Math.abs(wrapAngle(a)) < 0.25) continue;
    const x = Z.x + Math.sin(a) * (Z.r + 0.4);
    const z = Z.z + Math.cos(a) * (Z.r + 0.4);
    glow.box(0.25, 2.4, 0.25, x, 1.2, z, i % 2 ? '#ffd34d' : '#ff7bf0', a);
    w.addCollider(x - 0.2, z - 0.2, x + 0.2, z + 0.2);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(Z.r * 0.95, Z.r * 0.95, 60, 40, 1, true), new THREE.MeshBasicMaterial({
    color: '#fff6c8', transparent: true, opacity: 0.05, fog: false, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  }));
  beam.position.set(Z.x, 30, Z.z);
  w.scene.add(beam);
  ringSign(w, '👑 قله‌ی المپ', `فقط سطح ${fa(OLYMPUS_LEVEL)} به بالا • جریمه: −${fa(ZONE_PENALTY)} سطح`, Z.x, 5.2, Z.z + Z.r + 0.6, '#ffd34d');
  const crown = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial({ color: i % 2 ? '#ffd34d' : '#ffffff', toneMapped: false }));
    const a = (i / 7) * TAU;
    s.position.set(Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2);
    crown.add(s);
  }
  crown.position.set(Z.x, 11, Z.z);
  w.scene.add(crown);
  w.anims.push((dt, time) => { crown.rotation.y += dt * 0.8; crown.position.y = 11 + Math.sin(time) * 0.6; beam.material.opacity = 0.045 + 0.02 * Math.sin(time * 2); });
  // crystal heroes at the gate of the peak
  makeStatue(w, CRYSTAL_OUTFIT, 'planetlift', 0.6, -6.5, Z.z + Z.r + 2.2, Math.PI, { scale: 2.6, plinth: 1.2, plinthColor: '#24124a', trim: '#7fe0ff' });
  makeStatue(w, CRYSTAL_OUTFIT, 'e_victory', 0.5, 6.5, Z.z + Z.r + 2.2, Math.PI, { scale: 2.6, plinth: 1.2, plinthColor: '#24124a', trim: '#ff7bf0' });
  // peak stations
  for (const x of [-5, 5]) {
    w.equipStation('g4planet', 'planetlift', x, -18.5, Math.PI);
    glow.cyl(0.9, 0.05, x, 0.17, -18.5, '#ff9f43', 0, 0, 0, 20);
  }
  for (const x of [-3.5]) w.equipStation('g4comet', 'cometthrow', x, -10.5, Math.PI);
  for (const x of [3.5]) {
    w.equipStation('g4thunder', 'thunderslam', x, -10.5, Math.PI);
    glow.cyl(1.0, 0.05, x, 0.17, -10.5, '#7fe0ff', 0, 0, 0, 20);
  }
  w.equipStation('g4sun', 'sunpush', 0, -20.5, Math.PI);
  // normal stations
  for (const z of [5, 10]) {
    const st = w.equipStation('g4meteor', 'bigpunch', -14, z, -Math.PI / 2);
    const [mx, mz] = local(st, 0, 0.85);
    mt.cyl(0.015, 3.0, mx, 3.9, mz, '#c8a2ff', 0, 0, 0, 5);
    m.sphere(0.5, mx, 1.75, mz, '#5a3a7a', 1.3);
    glow.sphere(0.12, mx + 0.25, 1.9, mz + 0.3, '#ff7b00');
    w.addCollider(mx - 0.4, mz - 0.4, mx + 0.4, mz + 0.4);
  }
  for (const z of [5, 10]) {
    w.equipStation('g4pad', 'moonjump', 14, z, Math.PI / 2);
    glow.cyl(1.0, 0.06, 14, 0.04, z, '#7bed9f', 0, 0, 0, 24);
    glow.add(UnitGeo.torus(1, 0.04, 4, 32), 14, 0.08, z, '#ffffff', Math.PI / 2, 0, 0, 1.1, 1.1, 1.1);
  }
  for (const z of [-4, 0]) {
    const st = w.equipStation('g4star', 'starthrow', -20, z, -Math.PI / 2);
    const [bx, bz] = local(st, 0.7, -0.4);
    m.cyl(0.35, 0.5, bx, 0.25, bz, '#3a2a5a', 0, 0, 0, 12);
    for (let k = 0; k < 4; k++) glow.sphere(0.1, bx + rand(-0.2, 0.2), 0.55, bz + rand(-0.2, 0.2), '#ffd34d');
  }
  glow.box(10, 0.02, 3.6, 18, 0.015, -2, '#3a6aa8');
  for (const x of [15.5, 20.5]) w.equipStation('g4ice', 'skater', x, -2, Math.PI);
  w.finishBatches();
  return w;
};
