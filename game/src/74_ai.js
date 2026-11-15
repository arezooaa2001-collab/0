/* ============================ IN-GAME AI (only inside claude.ai) ============================ */
// A chat with Claude that changes the game through a few page tools: level looks (colours, scenery, 3D theme,
// music, weather), brand-new traps (described as parts + triggers, checked by the robot), new levels for the editor
// and new body colours. Everything it makes is kept in this browser (localStorage) like the rest of the save.
// The feature appears only where the page can reach Claude (a claude.ai artifact view); elsewhere it stays hidden.
const AI_KEY = 'telezar_ai';
const AIX = (() => { try { const v = JSON.parse(localStorage.getItem(AI_KEY)); if (v && typeof v === 'object') return Object.assign({ looks: {}, apply: { all: null, lv: {} }, traps: [], colors: [] }, v); } catch (e) {} return { looks: {}, apply: { all: null, lv: {} }, traps: [], colors: [] }; })();
function aiSave() { try { localStorage.setItem(AI_KEY, JSON.stringify(AIX)); } catch (e) {} }
const AI_ENUM = {
  scen: ['mountains', 'forest', 'dunes', 'crystals', 'volcano', 'mushrooms', 'waves', 'candy', 'ruins', 'spires', 'hills', 'city', 'sakura', 'jungle', 'factory', 'islands', 'pyramids', 'swamp', 'domes'],
  bs: ['brick', 'cobble', 'sandstone', 'iceblock', 'basalt', 'mossy', 'coral', 'candy', 'tiles', 'metal', 'wood', 'crystal', 'circuit'],
  top: ['grass', 'sand', 'snow', 'embers', 'slime', 'frosting', 'gold', 'thorns', 'neon', 'petals', 'vines', 'hazard', 'cloud', 'crystal', 'leaves'],
  cel: ['moon', 'sun', 'aurora', 'none', 'planet', 'twin'],
  th3: Object.keys(THEMES3), mus: ['dusk', 'bright', 'desert', 'frost', 'fire', 'neon', 'wild', 'rest', 'chase', 'boss'],
  weather: ['off', 'rain', 'snow', 'flood', 'storm', 'auto'],
};
const hexOk = c => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : null;

/* ---------- level looks ---------- */
// which look a level uses: its own AI look, the AI look for all levels, or its normal one
function biomeOf(def) {
  if (!def || def.custom) return def && def.biome;
  const i = LEVELS.indexOf(def), k = (i >= 0 && AIX.apply.lv[i]) || AIX.apply.all;
  return k && BIOMES[k] ? k : def.biome;
}
function aiTheme3(def) {
  const i = def.from != null && def.from >= 0 ? def.from : LEVELS.indexOf(def), k = (i >= 0 && AIX.apply.lv[i]) || AIX.apply.all;
  return k && BIOMES[k] && BIOMES[k].th3 && THEMES3[BIOMES[k].th3] ? BIOMES[k].th3 : null;
}
function aiRegisterLooks() { for (const k in AIX.looks) BIOMES[k] = AIX.looks[k]; }
// a running level shows a new look straight away
function aiRefreshLook() {
  if (app.state === 'title' || app.state === 'end') { setBiome(biomeOf(LEVELS[0])); return; }
  if (!app.def || app.def.custom) return;
  if (app.kind === 'plat' && !app.duo) { setBiome(biomeOf(app.def)); app.refreshVisuals(); if (app.p3) app.restartView(); }
  else if (app.duo) { setBiome(biomeOf(app.def)); duoLayout(); }
  else if (app.run) app.restartView();
}

/* ---------- traps made by the AI ---------- */
// Grid codes for AI traps in editor levels (characters no built-in tool uses)
const AI_CODES = 'ABCEGHIJMNORUXYZklsvxy';
const aiTrapOf = c => AIX.traps.find(t => t.code === c) || null;
function aiRegisterTrap(t) {
  if (!t.code || EDC.has(t.code) && !aiTrapOf(t.code)) { const free = [...AI_CODES].find(c => !EDC.has(c)); if (!free) return false; t.code = free; }
  if (!EDT.some(x => x[0] === t.code)) EDT.push([t.code, t.icon, t.name, t.desc + ' (ساخت هوش مصنوعی)']);
  EDC.add(t.code); ED_HAZ.add(t.code); return true;
}
function aiUnregisterTrap(t) { const i = EDT.findIndex(x => x[0] === t.code); if (i >= 0) EDT.splice(i, 1); EDC.delete(t.code); ED_HAZ.delete(t.code); }
// checks and tidies a trap description; throws a readable list of problems
function aiCleanTrap(inp) {
  const err = [], num = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? clamp(n, a, b) : d; };
  const idOk = v => v == null || v === '' ? null : /^[a-zA-Z0-9_]{1,12}$/.test(String(v)) ? String(v) : (err.push(`id «${v}» فقط حروف انگلیسی/عدد/_ تا ۱۲ تا`), null);
  const name = String(inp.name || '').trim().slice(0, 24); if (!name) err.push('name لازمه');
  const icon = [...String(inp.icon || '🪤')].slice(0, 2).join('') || '🪤';
  const desc = String(inp.description || inp.desc || '').trim().slice(0, 90);
  const parts = Array.isArray(inp.parts) ? inp.parts.slice(0, 20) : (err.push('parts باید آرایه باشه'), []);
  const ids = new Set(), P = [];
  for (const [i, q] of parts.entries()) {
    if (!q || typeof q !== 'object') { err.push(`part ${i} شیء نیست`); continue; }
    const k = String(q.kind || q.k || ''); if (!['block', 'spike', 'saw', 'laser', 'spring', 'orb', 'gem', 'wind', 'lava'].includes(k)) { err.push(`part ${i}: kind «${k}» ناشناخته`); continue; }
    const o = { k, x: num(q.x, -8, 8, 0), y: num(q.y, -13, 3, 0) }, id = idOk(q.id); if (id) { if (ids.has(id)) err.push(`id تکراری ${id}`); ids.add(id); o.id = id; }
    if (k === 'block' || k === 'wind' || k === 'lava') { o.w = num(q.w, .2, 10, 1); o.h = num(q.h, .2, 10, 1); }
    if (k === 'block') { for (const f of ['hidden', 'ghost', 'crumble', 'ice', 'bounce']) if (q[f]) o[f] = true; if (q.conveyor) o.conv = num(q.conveyor, -4, 4, 0); }
    if (k === 'spike') { o.n = Math.round(num(q.n, 1, 10, 1)); o.dir = ['up', 'down', 'left', 'right'].includes(q.dir) ? q.dir : 'up'; if (q.hidden) o.hidden = true; if (q.arrow) o.arrow = true; }
    if (k === 'saw') o.r = num(q.r, .3, 1.4, .6);
    if (k === 'laser') { o.len = num(q.len, 1, 14, 4); o.dir = q.dir === 'h' ? 'h' : 'v'; o.on = num(q.on, .3, 4, 1.1); o.off = num(q.off, .3, 4, 1.4); }
    if (k === 'wind') { o.fx = num(q.fx, -25, 25, 0); o.fy = num(q.fy, -25, 25, 0); }
    if (Array.isArray(q.path) && q.path.length && ['block', 'spike', 'saw', 'laser'].includes(k)) { o.path = q.path.slice(0, 6).map(p => [num(p && p[0], -12, 12, 0), num(p && p[1], -12, 12, 0)]); o.speed = num(q.speed, .5, 14, 3); }
    if (o.arrow && !o.path) err.push(`part ${i}: arrow به path نیاز داره`);
    if (q.orbit && (k === 'saw' || k === 'block')) o.orbit = { rad: num(q.orbit.radius ?? q.orbit.rad, .5, 5, 2), speed: num(q.orbit.speed, -5, 5, 1.5) };
    if (q.follow != null) { const f = String(q.follow); if (P.some(p => p.id === f && p.k === 'block')) o.follow = f; else err.push(`part ${i}: follow «${f}» باید id یه block قبلی باشه`); }
    P.push(o);
  }
  if (!P.length) err.push('دست‌کم یه part لازمه');
  const TG = [];
  for (const [i, t] of (Array.isArray(inp.triggers) ? inp.triggers.slice(0, 8) : []).entries()) {
    if (!t || typeof t !== 'object') continue;
    const o = { x: num(t.x, -10, 10, 0), y: num(t.y, -14, 3, -2), w: num(t.w, .3, 14, 1), h: num(t.h, .3, 14, 3), when: ['touch', 'ground', 'head'].includes(t.when) ? t.when : 'touch', acts: [] };
    for (const a of (Array.isArray(t.actions) ? t.actions.slice(0, 6) : [])) {
      const d = String(a && a.do || ''); if (!['pop', 'fall', 'move', 'say', 'shake', 'reverse', 'sound'].includes(d)) { err.push(`trigger ${i}: action «${d}» ناشناخته`); continue; }
      const A = { do: d, delay: num(a.delay, 0, 5, 0) };
      if (['pop', 'fall', 'move'].includes(d)) { if (!ids.has(String(a.id))) { err.push(`trigger ${i}: id «${a.id}» توی parts نیست`); continue; } A.id = String(a.id); }
      if (d === 'pop' && !P.find(p => p.id === A.id && p.hidden)) err.push(`trigger ${i}: pop فقط برای part با hidden:true`);
      if (d === 'move') { A.dx = num(a.dx, -20, 20, 0); A.dy = num(a.dy, -20, 20, 0); A.speed = num(a.speed, .5, 20, 6); }
      if (d === 'say') A.text = String(a.text || '').slice(0, 40);
      if (d === 'sound') A.name = ['rumble', 'crack', 'whoosh', 'thud', 'pop', 'orb', 'spring', 'roar'].includes(a.name) ? a.name : 'pop';
      o.acts.push(A);
    }
    if (o.acts.length) TG.push(o);
  }
  if (err.length) throw new Error(err.slice(0, 8).join(' | '));
  return { name, icon, desc, parts: P, trigs: TG };
}
// builds one placed copy of an AI trap (lx, y: the cell it was put in; every part id gets the copy's prefix)
function aiBuildTrap(P, t, lx, y, inst) {
  const id = q => q ? inst + q : null, mk = e => { if (e) e.dyn = true; return e; };
  for (const q of t.parts) {
    const ax = lx + q.x, ay = y + q.y, o = {};
    if (q.path) { o.patrol = [[ax, ay]].concat(q.path.map(p => [ax + p[0], ay + p[1]])); o.speed = q.speed; }
    if (q.orbit) o.orbit = { rad: q.orbit.rad, w: q.orbit.speed, ph: 0 };
    if (q.follow) o.parent = inst + q.follow;
    if (q.k === 'block') {
      if (q.hidden) o.hidden = true; if (q.ghost) o.ghost = true; if (q.crumble) o.crumble = .45; if (q.ice) o.ice = true; if (q.bounce) o.bounce = 22; if (q.conv) o.conv = q.conv;
      o.fallV = 80; mk(P.block(id(q.id), ax, ay, q.w, q.h, o));
    } else if (q.k === 'lava') P.block(null, ax, ay + .3, q.w, q.h, { lava: true, ghost: true });
    else if (q.k === 'spike') { if (q.hidden) o.hidden = true; if (q.arrow) { o.arrow = true; o.pjump = true; } o.fallV = 100; mk(P.spikes(id(q.id), ax, ay, q.n, q.dir, o)); }
    else if (q.k === 'saw') mk(P.saw(id(q.id), ax, ay, q.r, o));
    else if (q.k === 'laser') mk(P.laser(id(q.id), ax, ay, q.len, q.dir, Object.assign({ on: q.on, off: q.off }, o)));
    else if (q.k === 'spring') mk(P.spring(id(q.id), ax, ay));
    else if (q.k === 'orb') mk(P.orb(id(q.id), ax, ay));
    else if (q.k === 'gem') P.gem(ax, ay);
    else if (q.k === 'wind') mk(P.zone(id(q.id), 'wind', ax, ay, q.w, q.h, { fx: q.fx, fy: q.fy }));
  }
  for (const g of t.trigs) {
    P.trig(lx + g.x, y + g.y, g.w, g.h, () => {
      for (const a of g.acts) {
        const run = () => {
          if (a.do === 'pop') P.pop(inst + a.id);
          else if (a.do === 'fall') P.fall(inst + a.id, 0);
          else if (a.do === 'move') P.move(inst + a.id, a.dx, a.dy, a.speed, 0);
          else if (a.do === 'say') P.say(a.text);
          else if (a.do === 'shake') P.shake(8);
          else if (a.do === 'sound') P.sfx(a.name);
          else if (a.do === 'reverse') { P.reverse(true); P.after(3, () => P.reverse(false)); }
        };
        if (a.delay > 0) P.after(a.delay, run); else run();
      }
    }, { ground: g.when === 'ground', rising: g.when === 'head' });
  }
}
// a one-screen room with the trap in the middle (for testing it and for the robot)
function aiTrapRoom(t) {
  const lv = edNew(1); lv.id = 'airoom_' + t.code; lv.name = `🧪 ${t.name}`; lv.mine = false; lv.sample = true; lv.ok = true; lv.biome = AIX.apply.all && BIOMES[AIX.apply.all] ? AIX.apply.all : 'factory';
  lv.g = lv.g.map((r, y) => y === 14 ? r.slice(0, 16) + t.code + r.slice(17) : r);
  return lv;
}
// all AI traps one after another, each in its own room
function aiGauntlet() {
  const list = AIX.traps.slice(0, 9); if (!list.length) return null;
  const C = Math.max(ED_SW, list.length * 16 + 8), lv = edNew(1);
  lv.g = lv.g.map((r, y) => (y >= 15 ? 'g' : ' ').repeat(C));
  const set = (x, y, c) => { lv.g[y] = lv.g[y].slice(0, x) + c + lv.g[y].slice(x + 1); };
  set(2, 14, 'P'); list.forEach((t, i) => { if (i) set(i * 16 + 1, 14, 'K'); set(i * 16 + 9, 14, t.code); }); set(C - 3, 14, 'D');
  Object.assign(lv, { id: 'aigauntlet', name: '🧪 همه‌ی تله‌های هوش مصنوعی', biome: AIX.apply.all && BIOMES[AIX.apply.all] ? AIX.apply.all : 'factory', mine: false, sample: true, ok: true });
  return lv;
}
// a trap that came inside a level code: reuse an identical one or add it (returns its letter here, or null)
function aiImportTrap(raw) {
  let c; try { c = aiCleanTrap(raw || {}); } catch (e) { return null; }
  const same = AIX.traps.find(t => JSON.stringify([t.parts, t.trigs]) === JSON.stringify([c.parts, c.trigs])); if (same) return same.code;
  if (AIX.traps.length >= AI_CODES.length) return null;
  let name = c.name; while (AIX.traps.some(t => t.name === name)) name += '+';
  const t = Object.assign({ id: 't' + Date.now().toString(36) + AIX.traps.length }, c, { name, ok: null, made: Date.now(), from: 'code' });
  if (!aiRegisterTrap(t)) return null; AIX.traps.push(t); aiSave(); ED.iconBiome = null; return t.code;
}
function aiCheckTrap(t) {
  t.ok = null; renderLab();
  const S = solveDef(edDef(aiTrapRoom(t)), 1, { totalMs: 25000 });
  return S.promise.then(r => { t.ok = r.ok; aiSave(); renderLab(); return r.ok; });
}

/* ---------- the lab (a section for the AI's traps) ---------- */
function renderLab() {
  const el = document.getElementById('labList'); if (!el) return;
  el.innerHTML = AIX.traps.length ? AIX.traps.map(t => `<div class="myLv"><div class="ci" style="font-size:30px">${esc(t.icon)}</div><div class="mt"><b>${esc(t.name)}</b><small>${esc(t.desc)}</small>
      <small class="${t.ok ? 'ok' : 'no'}">${t.ok == null ? '⏳ ربات داره امتحانش می‌کنه…' : t.ok ? '✅ ربات ردش کرد' : '⚠️ ربات نتونست ردش کنه'}</small></div>
      <div class="ma"><button class="btn primary" data-lab="play" data-c="${t.code}">▶</button><button class="btn" data-lab="check" data-c="${t.code}">🤖</button><button class="btn" data-lab="del" data-c="${t.code}">🗑</button></div></div>`).join('')
    : '<p class="sub small">هنوز تله‌ای نساختی. به هوش مصنوعی بگو مثلاً «یه تله بساز که سقف یهو بیاد پایین».</p>';
  $('bGaunt').disabled = !AIX.traps.length;
}
$('labList').addEventListener('click', e => {
  const b = e.target.closest('[data-lab]'); if (!b) return; Sound.play('click'); const t = aiTrapOf(b.dataset.c); if (!t) return;
  if (b.dataset.lab === 'play') app.startCustom(aiTrapRoom(t), { back: 'sLab' });
  else if (b.dataset.lab === 'check') aiCheckTrap(t);
  else if (b.dataset.lab === 'del' && confirm(`تله‌ی «${t.name}» پاک بشه؟`)) { aiUnregisterTrap(t); AIX.traps = AIX.traps.filter(x => x !== t); aiSave(); renderLab(); }
});
$('bGaunt').onclick = () => { Sound.play('click'); const lv = aiGauntlet(); if (lv) app.startCustom(lv, { back: 'sLab' }); };
$('bLab').onclick = $('bLab2').onclick = () => { Sound.play('click'); renderLab(); app.open('sLab'); };

/* ---------- tools Claude can call ---------- */
const AI_TOOLS = [
  { name: 'set_look', description: 'Change how levels look: colours, background scenery, block material, edge/top style, sky object, 3D theme, music, optional weather. target: "all" (every main level), "current" (the level being played), "levels" (numbers in `levels`) or "reset" (back to normal; with `levels` only those). Returns what was applied.',
    inputSchema: { type: 'object', properties: { target: { type: 'string', enum: ['all', 'current', 'levels', 'reset'] }, levels: { type: 'array', items: { type: 'integer' } }, name: { type: 'string' },
      sky: { type: 'string', description: '#rrggbb' }, block: { type: 'string', description: '#rrggbb' }, accent: { type: 'string', description: '#rrggbb edge/grass colour' },
      scenery: { type: 'string', enum: AI_ENUM.scen }, blockStyle: { type: 'string', enum: AI_ENUM.bs }, top: { type: 'string', enum: AI_ENUM.top }, celestial: { type: 'string', enum: AI_ENUM.cel },
      theme3d: { type: 'string', enum: AI_ENUM.th3 }, music: { type: 'string', enum: AI_ENUM.mus }, weather: { type: 'string', enum: AI_ENUM.weather } }, required: ['target'] },
    execute: inp => aiSetLook(inp) },
  { name: 'create_trap', description: 'Create a brand-new trap for the game (it gets its own section, the Trap Lab, and becomes an editor tool). Parts and triggers use tile units relative to the cell the trap is placed in (y=1 is the top of the ground under it). The robot then tries to pass it; returns {code, passable}. If passable is false, redesign (same name replaces it).',
    inputSchema: { type: 'object', properties: { name: { type: 'string' }, icon: { type: 'string', description: 'one emoji' }, description: { type: 'string', description: 'Persian, one short line' },
      parts: { type: 'array', items: { type: 'object' }, description: 'see the trap guide in the instructions' }, triggers: { type: 'array', items: { type: 'object' } } }, required: ['name', 'icon', 'parts'] },
    execute: inp => aiCreateTrap(inp) },
  { name: 'delete_trap', description: 'Delete an AI-made trap by its name. Returns the remaining trap names.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    execute: inp => { const t = AIX.traps.find(x => x.name === String(inp.name)); if (!t) throw new Error('trap not found'); aiUnregisterTrap(t); AIX.traps = AIX.traps.filter(x => x !== t); aiSave(); renderLab(); return { left: AIX.traps.map(x => x.name) }; } },
  { name: 'create_level', description: 'Create a playable level for the player (saved in the level editor list). rows: exactly 18 strings of equal length (32 to 160), one character per tile, using the editor codes from the instructions (AI trap codes allowed). Needs one P (start) and one D (door). The robot tries it (about 30 s) and the result is returned.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' }, look: { type: 'string', description: 'a look key: one of the normal ones or an AI look' }, rows: { type: 'array', items: { type: 'string' } } }, required: ['name', 'rows'] },
    execute: inp => aiCreateLevel(inp) },
  { name: 'add_color', description: 'Add a new free body colour for the hero to the shop (and wear it if wear is true).',
    inputSchema: { type: 'object', properties: { name: { type: 'string' }, color: { type: 'string', description: '#rrggbb' }, icon: { type: 'string' }, wear: { type: 'boolean' } }, required: ['name', 'color'] },
    execute: inp => { const c = hexOk(inp.color); if (!c) throw new Error('color must be #rrggbb'); const it = { id: 'aic' + Date.now().toString(36), n: String(inp.name).slice(0, 20), i: [...String(inp.icon || '🎨')].slice(0, 2).join(''), p: 0, c };
      AIX.colors.push(it); SKINS.color.push(it); if (inp.wear) { ST.wear = Object.assign({}, ST.wear, { color: it.id }); writeSave(); } aiSave(); aiNote(`🎨 رنگ تازه: ${it.i} ${it.n}`); return { added: it.n, worn: !!inp.wear }; } },
];
function aiSetLook(inp) {
  const tg = String(inp.target || 'all'), lvls = (Array.isArray(inp.levels) ? inp.levels : []).map(n => Math.round(Number(n)) - 1).filter(i => i >= 0 && i < LEVELS.length);
  if (tg === 'reset') { if (lvls.length) for (const i of lvls) delete AIX.apply.lv[i]; else { AIX.apply.all = null; AIX.apply.lv = {}; } aiSave(); aiRefreshLook(); aiNote('↩️ ظاهر مرحله‌ها برگشت'); return { reset: lvls.length ? lvls.map(i => i + 1) : 'all' }; }
  const base = BIOMES[biomeOf(LEVELS[Math.max(0, app.idx)])] || BIOMES.dusk;
  const pick = (v, list, d) => list.includes(v) ? v : d;
  const look = { n: String(inp.name || 'ظاهر هوش مصنوعی').slice(0, 24), sky: hexOk(inp.sky) || base.sky, block: hexOk(inp.block) || base.block, moss: hexOk(inp.accent) || base.moss,
    scen: pick(inp.scenery, AI_ENUM.scen, base.scen), bs: pick(inp.blockStyle, AI_ENUM.bs, base.bs), top: pick(inp.top, AI_ENUM.top, base.top), cel: pick(inp.celestial, AI_ENUM.cel, base.cel),
    th3: pick(inp.theme3d, AI_ENUM.th3, base.th3), mus: pick(inp.music, AI_ENUM.mus, base.mus), ai: true };
  const key = 'ai_' + Date.now().toString(36); AIX.looks[key] = look; BIOMES[key] = look;
  if (tg === 'all') AIX.apply.all = key;
  else if (tg === 'current') { if (!(app.idx >= 0 && app.def && LEVELS[app.idx] === app.def)) throw new Error('no main level is being played right now; use target all or levels'); AIX.apply.lv[app.idx] = key; }
  else { if (!lvls.length) throw new Error('levels is empty'); for (const i of lvls) AIX.apply.lv[i] = key; }
  // forget looks nothing uses any more
  const used = new Set([AIX.apply.all, ...Object.values(AIX.apply.lv)]); for (const k in AIX.looks) if (!used.has(k)) { delete AIX.looks[k]; }
  if (inp.weather && AI_ENUM.weather.includes(inp.weather)) { CFG.weather = inp.weather; saveCfg(); }
  aiSave(); aiRefreshLook(); aiNote(`🎨 ظاهر «${look.n}» روی ${tg === 'all' ? 'همه‌ی مرحله‌ها' : tg === 'current' ? 'این مرحله' : 'مرحله‌های ' + lvls.map(i => faNum(i + 1)).join('، ')}`);
  return { applied: look.n, target: tg, levels: lvls.map(i => i + 1) };
}
async function aiCreateTrap(inp) {
  const c = aiCleanTrap(inp), old = AIX.traps.find(x => x.name === c.name);
  if (!old && AIX.traps.length >= AI_CODES.length) throw new Error('too many traps; delete one first');
  const t = old || { id: 't' + Date.now().toString(36) }; Object.assign(t, c, { ok: null, made: Date.now() });
  if (!old) { if (!aiRegisterTrap(t)) throw new Error('no free code'); AIX.traps.push(t); } else { aiUnregisterTrap(t); EDC.delete(t.code); aiRegisterTrap(t); }
  aiSave(); ED.iconBiome = null;
  const note = aiNote(`🪤 تله‌ی «${t.icon} ${t.name}» ساخته شد · ربات داره امتحانش می‌کنه…`, [['🧪 امتحانش کن', 'trap:' + t.code]]);
  const ok = await aiCheckTrap(t);
  if (note) note.firstChild.textContent = `🪤 تله‌ی «${t.icon} ${t.name}» ${ok ? '✅ قابل رد شدنه' : '⚠️ ربات نتونست ردش کنه'}`;
  return { code: t.code, passable: ok };
}
async function aiCreateLevel(inp) {
  const rows = (Array.isArray(inp.rows) ? inp.rows : []).map(r => String(r));
  if (rows.length !== ED_R) throw new Error(`rows must be exactly ${ED_R} strings`);
  const C = Math.max(...rows.map(r => r.length)); const g = rows.map(r => (r + ' '.repeat(C)).slice(0, C));
  const bad = new Set(); for (const r of g) for (const ch of r) if (!EDC.has(ch)) bad.add(ch);
  if (bad.size) throw new Error('unknown characters: ' + [...bad].join(' '));
  const lv = { id: 'm' + Date.now().toString(36), name: String(inp.name || 'مرحله‌ی هوش مصنوعی').slice(0, 40), biome: BIOMES[inp.look] ? inp.look : 'dusk', g, ok: false, mine: true, ai: true, t: Date.now() };
  if (!edValid(lv)) throw new Error('width must be 32..160');
  if (!edFind(g, 'P').length || !edFind(g, 'D').length) throw new Error('needs one P and one D');
  Ed.put(lv);
  const note = aiNote(`🗺️ مرحله‌ی «${lv.name}» ساخته شد · ربات داره امتحانش می‌کنه…`, [['▶ بازی کن', 'lv:' + lv.id], ['✏️ توی سازنده', 'ed:' + lv.id]]);
  const r = await solveDef(edDef(lv), 1, { totalMs: 30000 }).promise;
  if (r.ok) { lv.bot = true; Ed.put(lv); }
  if (note) note.firstChild.textContent = `🗺️ مرحله‌ی «${lv.name}» ${r.ok ? '✅ ربات ردش کرد' : '⚠️ ربات نتونست ردش کنه'}`;
  return { saved: lv.name, width: C, passable: r.ok, robotStuckAtTile: r.best ? [Math.round(r.best.x / T), Math.round(r.best.y / T)] : null };
}

/* ---------- what Claude is told ---------- */
function aiRules() {
  const st = {
    playing: app.state === 'play' || app.state === 'pause' ? (app.custom ? 'custom level' : app.idx >= 0 ? `main level ${app.idx + 1} (${LEVELS[app.idx].name}) in ${app.kind === 'run' ? '3D' : '2D'}` : app.endless ? 'endless' : 'other') : 'menu',
    lookAll: AIX.apply.all ? AIX.looks[AIX.apply.all].n : null, lookPerLevel: Object.entries(AIX.apply.lv).map(([i, k]) => [+i + 1, AIX.looks[k] && AIX.looks[k].n]),
    aiTraps: AIX.traps.map(t => ({ code: t.code, name: t.name, passable: t.ok })), weather: CFG.weather, levels: LEVELS.length,
    normalLooks: Object.keys(BIOMES).filter(k => !BIOMES[k].ai).map(k => `${k}=${BIOMES[k].n}`).join(', '),
  };
  return `You are «هوش تله‌زار», the AI built into the Persian troll platformer game «تله‌زار» (Telezar). The player talks to you in Persian.
Always answer in friendly, playful Persian, short (1-4 sentences). You change the game ONLY by calling the tools; never claim a change you did not make with a tool.
If a request is impossible with the tools (for example giving free gems, or anything outside this game), say so kindly and offer what you can do.
When the player asks for a "new trap" (تله), design one with create_trap. When they ask to change how levels look (e.g. «آتشین کن»), use set_look with fitting colours and styles.

GAME STATE: ${JSON.stringify(st)}

LOOK OPTIONS (set_look): scenery: ${AI_ENUM.scen.join(', ')} | blockStyle: ${AI_ENUM.bs.join(', ')} | top: ${AI_ENUM.top.join(', ')} | celestial: ${AI_ENUM.cel.join(', ')} | theme3d: ${AI_ENUM.th3.join(', ')} | music: ${AI_ENUM.mus.join(', ')} | weather: ${AI_ENUM.weather.join(', ')}.
Colours are dark-ish backgrounds with a bright accent. Example fiery look: sky #5c1616, block #3e1c1c, accent #ff8a3d, scenery volcano, blockStyle basalt, top embers, celestial none, theme3d lava, music fire.

TRAP GUIDE (create_trap). Units are tiles (1 tile = the hero's height-ish; hero is 0.6 wide, 0.75 tall, runs 7.5 tiles/s, jumps about 3.3 tiles high and 5 tiles far).
Coordinates are relative to the anchor cell where the player places the trap: (0,0) is that cell's top-left, x grows right, y grows DOWN, the ground surface under it is at y=1. Keep x in -8..8 and y in -12..1 (the trap sits on flat ground; the player comes from the left and must get past it to the right).
parts: [{kind, id?, x, y, ...}] kinds:
- block {w,h, hidden?, ghost? (looks solid, falls through), crumble?, ice?, bounce?, conveyor? (-4..4 tiles/s), path?, speed?, orbit?}
- spike {n (1-10), dir: up|down|left|right, hidden?, arrow? (flies along path and jumps back; needs path), path?, speed?}  (a spike tile is 1x1; x,y is its top-left)
- saw {r (0.3-1.4), x,y = centre, path?, speed?, orbit? {radius, speed (rad/s)}}
- laser {len, dir: v|h, on, off (seconds)}  (vertical from y down)
- spring, orb (flips gravity), gem, lava {w,h}, wind {w,h, fx, fy (tiles/s; fy -18 lifts)}
path = list of [dx,dy] offsets from the part's start, visited in a loop; speed in tiles/s.
follow: the id of an earlier block — the part then moves and falls together with that block (e.g. spikes under a crushing ceiling).
triggers: [{x,y,w,h, when: touch|ground (player standing inside)|head (player jumping up into it), actions:[{do: pop (show a hidden part)|fall (part drops)|move {dx,dy,speed}|say {text, Persian}|shake|sound {name: rumble|crack|whoosh|thud|pop|orb|spring|roar}|reverse (controls flipped 3 s), id?, delay? (s)}]}]
Make traps surprising but fair: there must be a way through (timing, a hidden route, waiting). Avoid walls taller than 3 tiles without a way around. Prefer 3-12 parts.
Example — "سقف خاردار" (a ceiling with spikes that slams down once you are under it, then goes back up):
parts [{kind:"block",id:"c",x:-1,y:-7,w:4,h:1},{kind:"spike",x:-1,y:-6,n:4,dir:"down",follow:"c"}]
triggers [{x:-2,y:-6,w:1,h:7,when:"touch",actions:[{do:"sound",name:"rumble"},{do:"move",id:"c",dx:0,dy:4.5,speed:12,delay:0.35},{do:"move",id:"c",dx:0,dy:-4.5,speed:3,delay:1.2},{do:"say",text:"سقف!"}]}]
(moves on the same id queue one after another; delay is the wait before that move starts)

LEVEL GRID (create_level): 18 rows, 32-160 columns, one char per tile; the bottom rows are usually ground.
codes: ' ' empty, g ground, p plank (jump through), i ice, m moving platform, c crumbling, f fake ground, d falling ground, n invisible block, S spike up, V spike down, h hidden spike, r falling spike, w saw, W moving saw, z laser, L lava, j spring, b bounce pad, < > conveyors, q pink switch block (solid first), Q blue switch block, t teleporter in, T teleporter out, u updraft, a arrow shooter, o gravity orb, e gem, P start (one), D door (one), F fake door, K checkpoint${AIX.traps.length ? ', AI traps: ' + AIX.traps.map(t => `${t.code}=${t.name}`).join(', ') : ''}.
Hero needs 2 empty tiles of headroom. Keep jumps under 3 tiles up and 4 tiles across.`;
}

/* ---------- chat ---------- */
const AIC = { sample: null, tools: false, turns: [], busy: false, ctl: null, bubble: null };
function aiAdd(role, text) {
  const d = document.createElement('div'); d.className = 'aiMsg ' + role; const t = document.createElement('div'); t.className = 'aiT'; t.textContent = text; d.appendChild(t);
  $('aiLog').appendChild(d); $('aiLog').scrollTop = $('aiLog').scrollHeight; return d;
}
// a line under Claude's answer for every change a tool made (with buttons to try it)
function aiNote(text, btns = []) {
  const host = AIC.bubble; if (!host) return null;
  const n = document.createElement('div'); n.className = 'aiNote'; const s = document.createElement('span'); s.textContent = text; n.appendChild(s);
  for (const [label, act] of btns) { const b = document.createElement('button'); b.className = 'chip'; b.textContent = label; b.dataset.aiAct = act; n.appendChild(b); }
  host.appendChild(n); $('aiLog').scrollTop = $('aiLog').scrollHeight; return n;
}
const AI_ERR = { not_granted: 'اجازه‌ی استفاده از Claude داده نشد.', sampling_disabled: 'Claude برای این حساب فعال نیست.', rate_limited: 'یه کم زیاد پرسیدی؛ چند دقیقه‌ی دیگه دوباره امتحان کن.',
  session_expired: 'باید دوباره وارد claude.ai بشی.', refused: 'این درخواست رو نمی‌تونم انجام بدم.', prompt_too_large: 'گفت‌وگو خیلی طولانی شد؛ «گفت‌وگوی تازه» رو بزن.', tools_unavailable: 'این‌جا ابزارهای تغییر بازی در دسترس نیستن.' };
async function aiSend(text) {
  text = String(text || '').trim(); if (!text || AIC.busy || !AIC.sample) return;
  AIC.busy = true; $('aiIn').value = ''; aiBusyUI(true);
  aiAdd('user', text); AIC.turns.push({ role: 'user', content: text });
  const bubble = AIC.bubble = aiAdd('ai', 'دارم فکر می‌کنم… 🤔'); const tx = bubble.firstChild;
  const ctl = AIC.ctl = new AbortController();
  const tools = AIC.tools ? AI_TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, execute: async (inp, ctx) => { if (ctx && ctx.signal && ctx.signal.aborted) throw new Error('stopped'); try { return await t.execute(inp || {}); } catch (e) { aiNote('⚠️ ' + String(e.message || e).slice(0, 120)); throw e; } } })) : undefined;
  try {
    const hist = AIC.turns.slice(-12); while (hist.length && hist[0].role !== 'user') hist.shift();
    const { text: ans } = await AIC.sample([{ role: 'user', content: aiRules() }, ...hist], Object.assign({ signal: ctl.signal, modelTier: 'default', onText: ({ text }) => { tx.textContent = text; $('aiLog').scrollTop = $('aiLog').scrollHeight; } }, tools ? { tools } : { cache: false }));
    tx.textContent = ans || '✔'; AIC.turns.push({ role: 'assistant', content: ans || '✔' });
    if (!ST.ach.ai) unlockAch('ai');
  } catch (e) {
    const code = e && e.code;
    tx.textContent = (e && e.text) || (code === 'cancelled' ? '⏹ متوقف شد.' : AI_ERR[code] || 'یه مشکلی پیش اومد؛ دوباره امتحان کن.');
    if (e && e.text) AIC.turns.push({ role: 'assistant', content: e.text });
    if (code === 'not_granted' || code === 'sampling_disabled') aiHide();
  } finally { AIC.busy = false; AIC.ctl = null; AIC.bubble = null; aiBusyUI(false); }
}
function aiBusyUI(b) { $('aiSend').hidden = b; $('aiStop').hidden = !b; $('aiIn').disabled = b; }
function aiHide() { for (const id of ['bAI', 'bAI2']) $(id).hidden = true; }
$('aiSend').onclick = () => { Sound.play('click'); aiSend($('aiIn').value); };
$('aiStop').onclick = () => { if (AIC.ctl) AIC.ctl.abort(); };
$('aiIn').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiSend($('aiIn').value); } });
$('aiChips').addEventListener('click', e => { const b = e.target.closest('[data-aiq]'); if (b) { Sound.play('click'); aiSend(b.dataset.aiq); } });
$('aiNew').onclick = () => { Sound.play('click'); if (AIC.busy) return; AIC.turns = []; $('aiLog').innerHTML = ''; aiAdd('ai', AI_HELLO); };
$('aiLog').addEventListener('click', e => {
  const b = e.target.closest('[data-ai-act]'); if (!b) return; Sound.play('click'); const [k, v] = b.dataset.aiAct.split(':');
  if (k === 'trap') { const t = aiTrapOf(v); if (t) app.startCustom(aiTrapRoom(t), { back: 'sAI' }); }
  else if (k === 'lv') { const lv = Ed.get(v); if (lv) app.startCustom(lv, { back: 'sAI' }); }
  else if (k === 'ed') { const lv = Ed.get(v); if (lv) edOpen(lv); }
});
const AI_HELLO = 'سلام! من هوش مصنوعی تله‌زارم 😈 بگو چی کار کنم: ظاهر مرحله‌ها رو عوض کنم، تله‌ی تازه بسازم، یه مرحله طراحی کنم یا یه رنگ جدید برای آدمکت درست کنم.';
function aiOpen() { Sound.init(); Sound.play('click'); if (!$('aiLog').children.length) aiAdd('ai', AI_HELLO + (AIC.tools ? '' : '\n(این‌جا ابزارهای تغییر بازی در دسترس نیستن؛ فقط می‌تونیم حرف بزنیم.)')); app.open('sAI'); setTimeout(() => $('aiIn').focus(), 50); }
$('bAI').onclick = aiOpen; $('bAI2').onclick = aiOpen;

/* ---------- start: bring back what the AI made, and look for Claude ---------- */
aiRegisterLooks();
for (const t of AIX.traps) aiRegisterTrap(t);
for (const c of AIX.colors) if (!SKINS.color.some(x => x.id === c.id)) SKINS.color.push(c);
if (AIX.apply.all && BIOMES[AIX.apply.all]) setBiome(biomeOf(LEVELS[0]));
(async () => {
  try {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    const s = await window.claude.use('sample'); if (!s) return;
    AIC.sample = s; try { const lim = await s.limits(); AIC.tools = !!(lim && lim.tools); } catch (e) { AIC.tools = false; }
    $('bAI').hidden = false; $('bAI2').hidden = false;
  } catch (e) {}
})();
