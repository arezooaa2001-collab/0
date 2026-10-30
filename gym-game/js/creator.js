'use strict';
/*
 * AI builder for Cloud Island: turns a Persian request into sports equipment, a new exercise
 * or a whole new sports place. Uses Claude through the artifact runtime when available
 * (and shares creations with every player through its database); otherwise falls back to
 * a small offline builder. Everything coming back is validated before it is built.
 */

const CREATIONS_KEY = 'zoor-gym-creations-v1';
const MY_CREATIONS_KEY = 'zoor-gym-my-creations-v1';
const SHAPES = ['box', 'cylinder', 'sphere', 'cone', 'torus'];
const ON_MACHINE = ['treadmill', 'bike', 'bench', 'pullup'];

/* ---------------- validation ---------------- */

const vNum = (v, lo, hi, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? clamp(n, lo, hi) : d;
};
const vColor = (c, d) => (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.trim()) ? c.trim() : d);
const vText = (t, max, d) => {
  const s = typeof t === 'string' ? t.replace(/[<>{}\\]/g, '').replace(/\s+/g, ' ').trim() : '';
  return Array.from(s).slice(0, max).join('') || d;
};
const vIcon = (t) => {
  const s = typeof t === 'string' ? t.trim() : '';
  return s ? Array.from(s).slice(0, 2).join('') : '✨';
};

function vParts(list, max, lim) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const p of list.slice(0, max)) {
    if (!p || typeof p !== 'object') continue;
    const shape = SHAPES.includes(p.shape) ? p.shape : 'box';
    const size = Array.isArray(p.size) ? p.size : [];
    const pos = Array.isArray(p.pos) ? p.pos : [];
    const rot = Array.isArray(p.rot) ? p.rot : [];
    out.push({
      shape,
      size: [0, 1, 2].map((i) => vNum(size[i], 0.02, lim.size, i === 1 ? 0.5 : 0.3)),
      pos: [vNum(pos[0], -lim.xz, lim.xz, 0), vNum(pos[1], -0.5, lim.y, 0.3), vNum(pos[2], -lim.xz, lim.xz, 0)],
      rot: [0, 1, 2].map((i) => vNum(rot[i], -360, 360, 0)),
      color: vColor(p.color, '#8aa0c8'),
    });
  }
  return out;
}

function vEffect(e) {
  const o = e && typeof e === 'object' ? e : {};
  const eff = {
    stat: o.stat === 'run' ? 'run' : 'zoor',
    levels: Math.round(vNum(o.levels, 0, 1000, 0)),
    xp: Math.round(vNum(o.xp, 0, 100000, 0)),
  };
  if (!eff.levels && !eff.xp) eff.xp = 120;
  return eff;
}

function vEquipment(raw) {
  const anim = AI_ANIMS.includes(raw.anim) ? raw.anim : 'squat';
  const parts = vParts(raw.parts, 28, { size: 4, xz: 2.2, y: 4 });
  return {
    name: vText(raw.name, 26, 'وسیله‌ی جدید'),
    icon: vIcon(raw.icon),
    desc: vText(raw.description || raw.desc, 90, ''),
    anim,
    effect: vEffect(raw.effect),
    parts: parts.length ? parts : defaultParts(anim),
  };
}

/** Untrusted JSON (from Claude, the shared database or local storage) → a safe creation or null. */
function validateCreation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = ['equipment', 'exercise', 'place'].includes(raw.kind) ? raw.kind : null;
  if (!kind) return null;
  const base = {
    id: typeof raw.id === 'string' && /^[a-z0-9_-]{4,40}$/i.test(raw.id) ? raw.id : newCreationId(),
    kind,
    author: vText(raw.author, 16, 'یک ورزشکار'),
    created: vNum(raw.created, 0, 9e15, Date.now()),
  };
  if (kind === 'equipment') return Object.assign(base, vEquipment(raw));
  if (kind === 'exercise') {
    return Object.assign(base, {
      name: vText(raw.name, 22, 'ورزش جدید'),
      icon: vIcon(raw.icon),
      desc: vText(raw.description || raw.desc, 90, ''),
      anim: AI_ANIMS.includes(raw.anim) && !ON_MACHINE.includes(raw.anim) ? raw.anim : 'jack',
      effect: vEffect(raw.effect),
    });
  }
  const pl = raw.place && typeof raw.place === 'object' ? raw.place : {};
  const radius = vNum(pl.radius, 12, 40, 20);
  return Object.assign(base, {
    name: vText(raw.name, 26, 'مکان ورزشی'),
    icon: vIcon(raw.icon),
    desc: vText(raw.description || raw.desc, 90, ''),
    place: {
      ground: vColor(pl.ground, '#4caf50'),
      sky: vColor(pl.sky, '#7ec8ff'),
      radius,
      props: vParts(pl.props, 50, { size: 14, xz: radius - 1, y: 14 }),
      equipment: (Array.isArray(pl.equipment) ? pl.equipment : []).slice(0, 6).filter((e) => e && typeof e === 'object').map(vEquipment),
    },
  });
}

function newCreationId() {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function defaultParts(anim) {
  if (anim === 'treadmill') {
    return [
      { shape: 'box', size: [0.9, 0.2, 2], pos: [0, 0.1, 0], rot: [0, 0, 0], color: '#2d3038' },
      { shape: 'box', size: [0.7, 0.03, 1.7], pos: [0, 0.21, 0.05], rot: [0, 0, 0], color: '#111111' },
      { shape: 'box', size: [0.8, 0.45, 0.25], pos: [0, 1.4, -1.0], rot: [0, 0, 0], color: '#2f6fed' },
      { shape: 'cylinder', size: [0.04, 1.2, 0], pos: [0.38, 0.75, -0.95], rot: [0, 0, 0], color: '#c9ced6' },
      { shape: 'cylinder', size: [0.04, 1.2, 0], pos: [-0.38, 0.75, -0.95], rot: [0, 0, 0], color: '#c9ced6' },
    ];
  }
  return [
    { shape: 'box', size: [1.4, 0.2, 1.4], pos: [0, 0.1, 0], rot: [0, 0, 0], color: '#2d3038' },
    { shape: 'cylinder', size: [0.12, 2.2, 0], pos: [0, 1.2, -0.5], rot: [0, 0, 0], color: '#c9ced6' },
    { shape: 'box', size: [1.2, 0.5, 0.3], pos: [0, 2.2, -0.5], rot: [0, 0, 0], color: '#e63946' },
  ];
}

/* ---------------- 3D building ---------------- */

const CREATION_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.18 });

function addPartsToBatch(b, parts, ox = 0, oz = 0) {
  const d = Math.PI / 180;
  for (const p of parts) {
    const [a, h, c] = p.size;
    const [x, y, z] = p.pos;
    const [rx, ry, rz] = p.rot.map((v) => v * d);
    const X = x + ox;
    const Z = z + oz;
    if (p.shape === 'box') b.add(UnitGeo.box(), X, y, Z, p.color, rx, ry, rz, a, h, c);
    else if (p.shape === 'cylinder') b.add(UnitGeo.cyl(18), X, y, Z, p.color, rx, ry, rz, a, h, a);
    else if (p.shape === 'cone') b.add(UnitGeo.cone(18), X, y, Z, p.color, rx, ry, rz, a, h, a);
    else if (p.shape === 'sphere') b.add(UnitGeo.sphere(), X, y, Z, p.color, rx, ry, rz, a, h > 0.05 ? h : a, c > 0.05 ? c : a);
    else {
      const tube = clamp(h / Math.max(a, 0.05), 0.004, 0.6);
      b.add(UnitGeo.torus(1, Math.round(tube * 1000) / 1000, 8, a > 4 ? 64 : 28), X, y, Z, p.color, rx, ry, rz, a, a, a);
    }
  }
}

/** XZ footprint of parts that are tall enough to bump into. */
function partsFootprint(parts) {
  let x1 = Infinity;
  let z1 = Infinity;
  let x2 = -Infinity;
  let z2 = -Infinity;
  for (const p of parts) {
    const r = p.shape === 'box' ? Math.max(p.size[0], p.size[2]) / 2 : p.size[0];
    const top = p.pos[1] + (p.shape === 'box' || p.shape === 'cylinder' || p.shape === 'cone' ? p.size[1] / 2 : p.size[0]);
    if (top < 0.35) continue;
    x1 = Math.min(x1, p.pos[0] - r); x2 = Math.max(x2, p.pos[0] + r);
    z1 = Math.min(z1, p.pos[2] - r); z2 = Math.max(z2, p.pos[2] + r);
  }
  return x1 === Infinity ? null : { x1, z1, x2, z2 };
}

function labelSprite(title, sub, color = '#7fe0ff', width = 2.4) {
  const tex = makeCanvasTexture(512, 150, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(8,12,26,0.78)';
    roundRect(ctx, 6, 6, w - 12, h - 12, 26);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    roundRect(ctx, 8, 8, w - 16, h - 16, 24);
    ctx.stroke();
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = `52px ${DISPLAY_FONT}`;
    ctx.fillText(title, w / 2, 58, w - 40);
    ctx.fillStyle = color;
    ctx.font = `700 28px ${UI_FONT}`;
    ctx.fillText(sub, w / 2, 112, w - 40);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(width, width * 150 / 512, 1);
  s.renderOrder = 5;
  return s;
}

function effectText(e) {
  const stat = e.stat === 'run' ? 'سطح دویدن' : 'سطح زور';
  if (e.levels) return `+${fa(e.levels)} ${stat}`;
  return `+${fa(e.xp)} ${e.stat === 'run' ? 'امتیاز دویدن' : 'زور'}`;
}

/**
 * Place one piece of equipment in a world at (x, z), facing direction yaw.
 * Adds its mesh, label, collider and a station people (player and NPCs) can use.
 */
function placeEquipment(world, item, x, z, yaw, group) {
  const b = new Batch();
  addPartsToBatch(b, item.parts);
  const mesh = new THREE.Mesh(mergeParts(b.parts, false), CREATION_MAT);
  const g = new THREE.Group();
  g.add(mesh);
  const base = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.68, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7fe0ff', transparent: true, opacity: 0.55, toneMapped: false }));
  base.position.y = 0.02;
  g.add(base);
  const top = item.parts.reduce((m, p) => Math.max(m, p.pos[1] + p.size[1]), 1.5);
  const label = labelSprite(`${item.icon} ${item.name}`, effectText(item.effect));
  label.position.y = Math.min(top, 4.5) + 0.8;
  g.add(label);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  group.add(g);
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  const toWorld = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const on = ON_MACHINE.includes(item.anim);
  const fp = partsFootprint(item.parts);
  if (fp && !on) {
    const pts = [toWorld(fp.x1, fp.z1), toWorld(fp.x2, fp.z1), toWorld(fp.x1, fp.z2), toWorld(fp.x2, fp.z2)];
    world.addCollider(Math.min(...pts.map((p) => p[0])) + 0.1, Math.min(...pts.map((p) => p[1])) + 0.1, Math.max(...pts.map((p) => p[0])) - 0.1, Math.max(...pts.map((p) => p[1])) - 0.1);
  }
  const front = on ? 0 : Math.max(1.2, (fp ? fp.z2 : 0) + 0.65);
  const [sx, sz] = toWorld(0, front);
  const [axx, azz] = toWorld(0, front + (on ? 1.6 : 0));
  return world.addStation(sx, sz, wrapAngle(yaw + Math.PI), [item.anim], { custom: item, ax: axx, az: azz, label: item.name });
}

/* ---------------- storage (local + shared cloud) ---------------- */

const Creations = {
  items: [],
  listeners: [],
  db: null,
  shared: false,
  mine: new Set(Store.get(MY_CREATIONS_KEY, [])),

  init() {
    const local = Store.get(CREATIONS_KEY, []);
    this.items = (Array.isArray(local) ? local : []).map(validateCreation).filter(Boolean);
    this.emit();
    this.connectCloud();
  },

  async connectCloud() {
    try {
      if (!window.claude || typeof window.claude.use !== 'function') return;
      const db = await window.claude.use('db');
      if (!db) return;
      this.db = db;
      db.collection('creations').orderBy('created', 'desc').limit(80).onSnapshot((snap) => {
        this.shared = true;
        const cloud = snap.docs.map((d) => validateCreation(Object.assign({}, d.data(), { id: d.id }))).filter(Boolean);
        const ids = new Set(cloud.map((c) => c.id));
        const localOnly = this.items.filter((c) => !ids.has(c.id) && c.localOnly);
        this.items = [...cloud, ...localOnly].sort((a, b) => b.created - a.created);
        this.saveLocal();
        this.emit();
      }, () => { this.shared = false; });
    } catch (e) { /* stay local */ }
  },

  onChange(fn) { this.listeners.push(fn); },
  emit() { for (const fn of this.listeners) { try { fn(this.items); } catch (e) { console.error(e); } } },
  saveLocal() { Store.set(CREATIONS_KEY, this.items.slice(0, 80)); },

  /** Adds a creation; resolves true when it was shared with everyone, false when only kept here. */
  async add(item) {
    this.mine.add(item.id);
    Store.set(MY_CREATIONS_KEY, [...this.mine]);
    let shared = false;
    if (this.db) {
      try {
        const body = JSON.parse(JSON.stringify(item));
        delete body.id;
        delete body.localOnly;
        await this.db.collection('creations').doc(item.id).set(body);
        shared = true;
      } catch (e) { shared = false; }
    }
    if (!shared) item.localOnly = true;
    this.items = [item, ...this.items.filter((c) => c.id !== item.id)];
    this.saveLocal();
    this.emit();
    return shared;
  },

  async remove(id) {
    if (this.db) { try { await this.db.collection('creations').doc(id).delete(); } catch (e) { /* not allowed or offline */ } }
    this.items = this.items.filter((c) => c.id !== id);
    this.saveLocal();
    this.emit();
  },
};

/* ---------------- talking to the AI ---------------- */

const AI = {
  sample: null,
  checked: false,

  async connect() {
    if (this.checked) return this.sample;
    this.checked = true;
    try {
      if (window.claude && typeof window.claude.use === 'function') this.sample = await window.claude.use('sample');
    } catch (e) { this.sample = null; }
    return this.sample;
  },

  prompt(request) {
    return `You design content for a Persian (Farsi) 3D sports game called "باشگاه قهرمان". The player is on "Cloud Island" and asks, in Persian, for a new sports EQUIPMENT, a new EXERCISE, or a new sports PLACE.
Rules:
- Only sports, fitness and exercise content. A gym and a wrestling hall already exist, so do not make another gym or wrestling hall. If the request is not about sports, is unsafe, or asks for a gym/wrestling hall, use kind "refuse" and explain politely in Persian in "reply".
- Honor numbers the player asks for. Example: "هر بار استفاده کنم ۱۰۰ سطح دویدن بده" means effect {"stat":"run","levels":100,"xp":0}. If no reward is mentioned, use levels 0 and xp between 50 and 300.
- stat is "zoor" (strength) or "run" (running). levels is 0-1000, xp is 0-100000.
- anim (how a person's body moves when using it) must be exactly one of: ${AI_ANIMS.join(', ')}. For a new EXERCISE do not use treadmill, bike, bench or pullup.
- Parts are simple shapes in meters. size meaning: box [width,height,depth]; cylinder [radius,height,0]; cone [radius,height,0]; sphere [radiusX,radiusY,radiusZ]; torus [radius,tube,0]. pos is the shape's center [x,y,z]; rot is degrees [x,y,z]; color is "#rrggbb".
- EQUIPMENT: 6-22 parts, everything inside x,z in [-2,2] and y in [0,4], standing on y=0, centered on x=0,z=0. The user stands at z=+1.3 facing -z. If anim is treadmill, bike, bench or pullup the user is at the origin (on/under the machine) facing -z, so put handles/screens at negative z. Make it look like the real thing with real colors.
- PLACE: "radius" 14-36 meters; "ground" and "sky" colors; "props" are up to 40 decorative parts in place coordinates (center 0,0; keep within the radius; ground is y=0; a flat part like water or a court line should be about 0.05 high); "equipment" is up to 5 equipment objects (same format as EQUIPMENT, without kind). Keep the area around (0, radius-4) free: players arrive there.
- Names and descriptions in Persian. "reply" is one short friendly Persian sentence to the player.
Reply with ONLY one JSON object in this shape:
{"kind":"equipment|exercise|place|refuse","reply":"...","name":"...","icon":"one emoji","description":"...","anim":"...","effect":{"stat":"zoor|run","levels":0,"xp":0},"parts":[{"shape":"box","size":[1,1,1],"pos":[0,0.5,0],"rot":[0,0,0],"color":"#ff0000"}],"place":{"radius":24,"ground":"#3a9d4a","sky":"#87ceeb","props":[],"equipment":[]}}
(Leave out "parts" for exercise/place and "place" for equipment/exercise.)

The player's request: «${request}»`;
  },

  /** Returns {item, reply} or {refuse: reply}. Throws {code} on AI failure. */
  async create(request) {
    const sample = await this.connect();
    if (!sample) return offlineCreate(request);
    const raw = await sample.json(this.prompt(request), { modelTier: 'default', cache: false });
    if (!raw || typeof raw !== 'object') throw { code: 'invalid_json' };
    if (raw.kind === 'refuse') return { refuse: vText(raw.reply, 200, 'این یکی رو نمی‌تونم بسازم. یه چیز ورزشی بخواه!') };
    const item = validateCreation(raw);
    if (!item) throw { code: 'invalid_json' };
    return { item, reply: vText(raw.reply, 200, 'ساختمش!') };
  },
};

/* ---------------- offline builder (no AI available) ---------------- */

const COLOR_WORDS = [
  ['قرمز', '#e63946'], ['آبی', '#2f6fed'], ['سبز', '#2ecc71'], ['زرد', '#ffc23d'], ['نارنجی', '#ff7b00'],
  ['بنفش', '#9b5de5'], ['صورتی', '#ff4d8d'], ['مشکی', '#222222'], ['سفید', '#f5f5f5'], ['طلایی', '#e6b422'], ['نقره', '#c0c6cf'],
];

function offlineCreate(text) {
  const t = String(text);
  const num = Number(digitsOnly((t.match(/[\d۰-۹٠-٩]+/) || [''])[0])) || 0;
  const color = (COLOR_WORDS.find(([w]) => t.includes(w)) || [null, pick(['#e63946', '#2f6fed', '#ff7b00', '#9b5de5'])])[1];
  const run = /دو(ی|ید)|سرعت|تند/.test(t);
  const levels = /سطح/.test(t) ? clamp(num || 10, 1, 1000) : 0;
  const effect = { stat: run ? 'run' : 'zoor', levels, xp: levels ? 0 : clamp(num || 150, 10, 100000) };
  const nameMatch = t.match(/(?:به اسم|به نام|اسمش)\s+«?([^»،.!؟\n]{2,24})/);
  const named = nameMatch ? nameMatch[1].replace(/\s*(بساز|درست کن|اضافه کن|بسازی|می‌خوام)\s*$/, '').trim() || null : null;
  if (/کشتی|باشگاه/.test(t) && /(مکان|جا|سالن|بخش)/.test(t)) {
    return { refuse: 'باشگاه و سالن کشتی از قبل هست! یه مکان ورزشی دیگه بخواه، مثلاً زمین فوتبال یا استخر.' };
  }
  const placeT = PLACE_TEMPLATES.find((p) => p.re.test(t));
  if (placeT && /(مکان|جا|زمین|استخر|پیست|سالن|ساحل|کوه|بخش|ورزشگاه)/.test(t)) {
    const item = validateCreation({ kind: 'place', name: named || placeT.name, icon: placeT.icon, description: placeT.desc, place: placeT.make() });
    return { item, reply: `«${item.name}» ساخته شد! دروازه‌اش لب جزیره‌ست. (سازنده‌ی ساده‌ی آفلاین)` };
  }
  if (/ورزش جدید|حرکت جدید|تمرین جدید/.test(t)) {
    const anim = run ? 'jack' : pick(['jack', 'squat', 'kick', 'jumpspin', 'rope']);
    const item = validateCreation({ kind: 'exercise', name: named || 'ورزش من', icon: '🌟', description: 'یه حرکت تازه', anim, effect });
    return { item, reply: `حرکت «${item.name}» به دکمه‌های ورزشی اضافه شد! (سازنده‌ی ساده‌ی آفلاین)` };
  }
  const tpl = EQUIP_TEMPLATES.find((e) => e.re.test(t)) || (run ? EQUIP_TEMPLATES[0] : EQUIP_TEMPLATES[EQUIP_TEMPLATES.length - 1]);
  const item = validateCreation({
    kind: 'equipment', name: named || tpl.name, icon: tpl.icon, description: tpl.desc, anim: tpl.anim, effect, parts: tpl.parts(color),
  });
  return { item, reply: `«${item.name}» ساخته شد و توی جزیره گذاشتمش. (سازنده‌ی ساده‌ی آفلاین)` };
}

const P = (shape, size, pos, color, rot = [0, 0, 0]) => ({ shape, size, pos, rot, color });

const EQUIP_TEMPLATES = [
  { re: /تردمیل|دویدن|دو |سرعت/, name: 'تردمیل جادویی', icon: '⚡', anim: 'treadmill', desc: 'برای دویدن خیلی سریع',
    parts: (c) => [P('box', [1, 0.22, 2.1], [0, 0.11, 0], '#2d3038'), P('box', [0.75, 0.03, 1.8], [0, 0.23, 0.05], '#111111'),
      P('cylinder', [0.04, 1.25, 0], [0.42, 0.78, -1.0], '#c9ced6'), P('cylinder', [0.04, 1.25, 0], [-0.42, 0.78, -1.0], '#c9ced6'),
      P('box', [0.95, 0.5, 0.18], [0, 1.45, -1.05], c), P('box', [0.6, 0.28, 0.04], [0, 1.5, -0.95], '#39c0ff'),
      P('cylinder', [0.035, 0.9, 0], [0, 1.15, -0.85], '#c9ced6', [0, 0, 90])] },
  { re: /دوچرخه|رکاب/, name: 'دوچرخه‌ی ابری', icon: '🚴', anim: 'bike', desc: 'رکاب بزن و قوی شو',
    parts: (c) => [P('box', [0.12, 0.12, 1.3], [0, 0.1, 0], '#2c3140'), P('cylinder', [0.3, 0.08, 0], [0, 0.4, -0.55], '#222222', [0, 0, 90]),
      P('box', [0.1, 0.8, 0.1], [0, 0.5, 0.15], c), P('box', [0.3, 0.08, 0.35], [0, 0.92, 0.2], '#111111'),
      P('box', [0.1, 1.0, 0.1], [0, 0.6, -0.5], c), P('cylinder', [0.03, 0.6, 0], [0, 1.12, -0.5], '#c9ced6', [0, 0, 90])] },
  { re: /پارو|قایق/, name: 'دستگاه پارو', icon: '🚣', anim: 'curl', desc: 'پارو بزن، بازو بساز',
    parts: (c) => [P('box', [0.4, 0.15, 2.4], [0, 0.2, -0.6], c), P('box', [0.45, 0.12, 0.45], [0, 0.35, -0.2], '#111111'),
      P('cylinder', [0.35, 0.2, 0], [0, 0.55, -1.7], '#2c3140', [90, 0, 0]), P('cylinder', [0.03, 0.8, 0], [0, 0.7, -1.4], '#c9ced6', [0, 0, 90])] },
  { re: /بسکتبال|توپ|سبد/, name: 'حلقه‌ی بسکتبال', icon: '🏀', anim: 'jumpspin', desc: 'بپر و توپ بنداز',
    parts: (c) => [P('cylinder', [0.08, 3.0, 0], [0, 1.5, -1.2], '#c9ced6'), P('box', [1.2, 0.8, 0.05], [0, 3.0, -1.1], '#f5f5f5'),
      P('torus', [0.25, 0.03, 0], [0, 2.75, -0.8], '#ff7b00', [90, 0, 0]), P('sphere', [0.13, 0.13, 0.13], [0.5, 0.13, 0.2], '#e8742a'), P('box', [0.8, 0.1, 0.8], [0, 0.05, -1.2], c)] },
  { re: /صخره|کوهنوردی|دیوار/, name: 'دیوار صخره‌نوردی', icon: '🧗', anim: 'pullup', desc: 'بالا برو!',
    parts: (c) => [P('box', [2.2, 3.6, 0.3], [0, 1.8, -0.6], '#6d5a4a'), ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => P('sphere', [0.1, 0.08, 0.08], [((i % 3) - 1) * 0.6, 0.6 + i * 0.4, -0.42], i % 2 ? c : '#ffc23d')),
      P('cylinder', [0.03, 1.6, 0], [0, 2.5, -0.1], '#c9ced6', [0, 0, 90])] },
  { re: /ترامپولین|پرش/, name: 'ترامپولین', icon: '🤸', anim: 'backflip', desc: 'بپر و پشتک بزن',
    parts: (c) => [P('cylinder', [1.3, 0.12, 0], [0, 0.5, -1.4], '#2c3140'), P('cylinder', [1.15, 0.05, 0], [0, 0.57, -1.4], '#111111'),
      P('torus', [1.3, 0.08, 0], [0, 0.56, -1.4], c, [90, 0, 0]), ...[0, 1, 2, 3].map((i) => P('cylinder', [0.05, 0.5, 0], [Math.cos(i * 1.57) * 1.1, 0.25, -1.4 + Math.sin(i * 1.57) * 1.1], '#c9ced6'))] },
  { re: /بوکس|مشت|کیسه/, name: 'کیسه بوکس طلایی', icon: '🥊', anim: 'box', desc: 'مشت بزن!',
    parts: (c) => [P('box', [0.15, 3.0, 0.15], [0.9, 1.5, -0.7], '#2c3140'), P('box', [1.0, 0.12, 0.12], [0.45, 2.95, -0.7], '#2c3140'),
      P('cylinder', [0.28, 1.2, 0], [0, 1.6, -0.7], c), P('cylinder', [0.29, 0.1, 0], [0, 2.15, -0.7], '#f5f5f5')] },
  { re: /.*/, name: 'دستگاه قدرت', icon: '💥', anim: 'lift', desc: 'وزنه بزن و قوی شو',
    parts: (c) => [P('box', [1.8, 0.1, 1.4], [0, 0.05, -0.4], '#2c3140'), P('box', [0.12, 2.4, 0.12], [-0.8, 1.2, -0.8], c), P('box', [0.12, 2.4, 0.12], [0.8, 1.2, -0.8], c),
      P('box', [1.72, 0.12, 0.12], [0, 2.4, -0.8], c), P('box', [0.6, 1.0, 0.25], [0, 0.6, -1.0], '#22252b'), P('cylinder', [0.25, 0.08, 0], [0.7, 0.3, 0.1], '#d62828', [0, 0, 90])] },
];

const PLACE_TEMPLATES = [
  { re: /فوتبال/, name: 'زمین فوتبال', icon: '⚽', desc: 'یه زمین فوتبال چمنی', make: () => ({
    radius: 26, ground: '#3c9d47', sky: '#86c8ff',
    props: [P('box', [26, 0.03, 16], [0, 0.02, -3], '#46b052'), P('box', [0.15, 0.04, 16], [0, 0.05, -3], '#ffffff'), P('torus', [2.2, 0.08, 0], [0, 0.05, -3], '#ffffff', [90, 0, 0]),
      ...[-1, 1].flatMap((s) => [P('box', [0.15, 2.4, 0.15], [s * 13, 1.2, -6.5], '#ffffff'), P('box', [0.15, 2.4, 0.15], [s * 13, 1.2, 0.5], '#ffffff'), P('box', [0.15, 0.15, 7.2], [s * 13, 2.4, -3], '#ffffff')]),
      P('sphere', [0.25, 0.25, 0.25], [2, 0.25, -2], '#f5f5f5')],
    equipment: [{ name: 'ضربه‌ی پنالتی', icon: '⚽', anim: 'kick', effect: { stat: 'run', xp: 200 }, parts: [P('sphere', [0.3, 0.3, 0.3], [0, 0.3, -0.6], '#f5f5f5'), P('cylinder', [0.6, 0.02, 0], [0, 0.01, -0.6], '#ffffff')] }],
  }) },
  { re: /استخر|شنا/, name: 'استخر بزرگ', icon: '🏊', desc: 'استخر آبی و تمیز', make: () => ({
    radius: 22, ground: '#d9e6ef', sky: '#9fd2ff',
    props: [P('box', [18, 0.06, 10], [0, 0.03, -4], '#2fa8ff'), ...[0, 1, 2, 3, 4].map((i) => P('box', [18, 0.07, 0.08], [0, 0.05, -8 + i * 2], '#ffffff')),
      P('box', [19, 0.4, 0.5], [0, 0.2, -9.2], '#f5f5f5'), P('box', [19, 0.4, 0.5], [0, 0.2, 1.2], '#f5f5f5'), P('box', [1.2, 0.8, 1.2], [9.8, 0.4, -4], '#e63946')],
    equipment: [{ name: 'سکوی شیرجه', icon: '🤿', anim: 'frontflip', effect: { stat: 'zoor', xp: 250 }, parts: [P('box', [1.0, 2.0, 1.0], [0, 1.0, -0.8], '#2f6fed'), P('box', [0.6, 0.08, 1.4], [0, 2.05, -0.2], '#ffffff')] }],
  }) },
  { re: /بسکتبال/, name: 'زمین بسکتبال', icon: '🏀', desc: 'زمین بسکتبال نارنجی', make: () => ({
    radius: 22, ground: '#5a6b85', sky: '#88c4ff',
    props: [P('box', [24, 0.03, 14], [0, 0.02, -3], '#e8742a'), P('torus', [2, 0.06, 0], [0, 0.04, -3], '#ffffff', [90, 0, 0]),
      ...[-1, 1].flatMap((s) => [P('cylinder', [0.1, 3.2, 0], [s * 11.5, 1.6, -3], '#c9ced6'), P('box', [0.06, 1.0, 1.6], [s * 11.2, 3.0, -3], '#ffffff'), P('torus', [0.25, 0.03, 0], [s * 10.85, 2.75, -3], '#ff7b00', [90, 0, 0])])],
    equipment: [{ name: 'پرتاب سه‌امتیازی', icon: '🏀', anim: 'jumpspin', effect: { stat: 'zoor', xp: 220 }, parts: [P('sphere', [0.14, 0.14, 0.14], [0.4, 0.14, -0.4], '#e8742a'), P('box', [0.8, 0.04, 0.8], [0, 0.02, -0.4], '#ffffff')] }],
  }) },
  { re: /کوه|صخره/, name: 'کوهستان', icon: '⛰️', desc: 'کوه برای کوهنوردی', make: () => ({
    radius: 30, ground: '#7a8f5a', sky: '#9cc7ef',
    props: [P('cone', [7, 10, 0], [-10, 5, -14], '#7d6a5a'), P('cone', [5, 7, 0], [8, 3.5, -16], '#8d7a6a'), P('cone', [1.6, 1.2, 0], [-10, 10.4, -14], '#ffffff'),
      P('cone', [4, 5, 0], [16, 2.5, -4], '#6d5a4a'), ...[0, 1, 2, 3, 4].map((i) => P('cone', [0.9, 2.2, 0], [-18 + i * 3, 1.1, 8], '#2f7d3b'))],
    equipment: [{ name: 'دیوار صخره‌نوردی', icon: '🧗', anim: 'pullup', effect: { stat: 'zoor', xp: 300 }, parts: EQUIP_TEMPLATES[4].parts('#e63946') }],
  }) },
  { re: /ساحل|والیبال/, name: 'ساحل والیبال', icon: '🏐', desc: 'شن و دریا و والیبال', make: () => ({
    radius: 24, ground: '#e9d39a', sky: '#7cc6ff',
    props: [P('box', [48, 0.05, 10], [0, 0.03, -18], '#2f9ee0'), P('box', [0.12, 2.5, 0.12], [-4.5, 1.25, -3], '#ffffff'), P('box', [0.12, 2.5, 0.12], [4.5, 1.25, -3], '#ffffff'),
      P('box', [9, 0.9, 0.04], [0, 2.0, -3], '#f5f5f5'), P('sphere', [0.2, 0.2, 0.2], [1, 0.2, 0], '#ffd34d')],
    equipment: [{ name: 'اسپک والیبال', icon: '🏐', anim: 'jumpspin', effect: { stat: 'zoor', xp: 200 }, parts: [P('sphere', [0.2, 0.2, 0.2], [0, 0.2, -0.5], '#ffd34d')] }],
  }) },
  { re: /پیست|دو و میدانی|ورزشگاه/, name: 'پیست دو', icon: '🏟️', desc: 'پیست قرمز دو و میدانی', make: () => ({
    radius: 28, ground: '#3c9d47', sky: '#8ccaff',
    props: [P('cylinder', [17.5, 0.03, 0], [0, 0.015, -2], '#c0392b'), P('cylinder', [14.5, 0.04, 0], [0, 0.03, -2], '#3c9d47'),
      P('torus', [16, 0.05, 0], [0, 0.04, -2], '#ffffff', [90, 0, 0]), P('torus', [17.4, 0.05, 0], [0, 0.04, -2], '#ffffff', [90, 0, 0])],
    equipment: [{ name: 'خط شروع', icon: '🏁', anim: 'treadmill', effect: { stat: 'run', xp: 300 }, parts: [P('box', [1.6, 0.03, 0.2], [0, 0.02, -0.6], '#ffffff')] }],
  }) },
  { re: /.*/, name: 'زمین ورزش', icon: '🏟️', desc: 'یه زمین ورزشی تازه', make: () => ({
    radius: 20, ground: '#4caf50', sky: '#8ccaff', props: [P('box', [16, 0.03, 10], [0, 0.02, -3], '#5cc96b')],
    equipment: [{ name: 'جامپینگ جک', icon: '⭐', anim: 'jack', effect: { stat: 'zoor', xp: 150 }, parts: [P('cylinder', [0.6, 0.04, 0], [0, 0.02, -0.4], '#ffffff')] }],
  }) },
];
