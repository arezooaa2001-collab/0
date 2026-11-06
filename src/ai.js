/* Ladino — creative AI: runs on the viewer's own Claude through the artifact's `sample` capability (no API key) */
(function () {
  const L = window.L, S = L.state, A = L.api;
  const $ = (s) => document.querySelector(s);
  const fa = L.fa;
  const uid = (p) => p + Math.random().toString(36).slice(2, 9);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  let sample = null, canTools = false, busy = null;

  // ---------- library of AI creations (local cache + cloud via L.cloud) ----------
  const LS = 'ladino.lib.v1';
  const lib = (L.lib = {
    load(items) {
      for (const it of items || []) {
        if (it.kind === 'effect' && !L.customEffects.find((x) => x.id === it.id)) L.customEffects.push({ id: it.id, name: it.name, cat: 'هوش مصنوعی', glsl: it.glsl, custom: true });
        if (it.kind === 'style' && !L.customStyles.find((x) => x.id === it.id)) L.customStyles.push({ id: it.id, name: it.name, spec: L.sanitizeSpec(it.spec) });
        if (it.kind === 'anim' && !L.customAnims.find((x) => x.id === it.id)) L.customAnims.push({ id: it.id, name: it.name, ...L.sanitizeAnim({ kind: it.animKind, keyframes: it.keyframes, ease: it.ease, period: it.period }) });
      }
      lib.info();
    },
    items() {
      return [
        ...L.customEffects.map((e) => ({ kind: 'effect', id: e.id, name: e.name, glsl: e.glsl })),
        ...L.customStyles.map((s) => ({ kind: 'style', id: s.id, name: s.name, spec: s.spec })),
        ...L.customAnims.map((a) => ({ kind: 'anim', id: a.id, name: a.name, animKind: a.kind, keyframes: a.kf, ease: a.ease, period: a.period })),
      ];
    },
    add(item) {
      try { localStorage.setItem(LS, JSON.stringify(lib.items())); } catch (e) {}
      L.cloud && L.cloud.saveLibraryItem && L.cloud.saveLibraryItem(item);
      lib.info();
    },
    info() {
      const el = $('#libInfo'); if (!el) return;
      const n = [L.customEffects.length, L.customStyles.length, L.customAnims.length];
      el.textContent = n[0] + n[1] + n[2] ? `${fa(n[0])} جلوه، ${fa(n[1])} استایل متن و ${fa(n[2])} حرکت ساخته‌شده با هوش مصنوعی — در همه پروژه‌هایت در دسترس‌اند.` : 'هنوز چیزی با هوش مصنوعی ساخته نشده.';
    },
  });
  try { lib.load(JSON.parse(localStorage.getItem(LS) || '[]')); A.renderFx(); } catch (e) {}

  // ---------- actions shared by tools and the JSON fallback ----------
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const animIds = (kind) => (kind === 'loop' ? [...L.ANIM_LOOP, ...L.customAnims.filter((a) => a.kind === 'loop')] : [...L.ANIM_IN, ...L.customAnims.filter((a) => a.kind !== 'loop')]).map((a) => a.id);
  function textFields(ly, a) {
    if (a.text != null) ly.text = String(a.text).slice(0, 300) || ' ';
    if (a.style_id != null) { const sid = typeof a.style_id === 'string' && !/^\d+$/.test(a.style_id) ? a.style_id : clamp(parseInt(a.style_id, 10) || 0, 0, L.STYLE_COUNT - 1); if (typeof sid === 'string' && !L.customStyles.find((s) => s.id === sid)) throw new Error('style_id not found: ' + sid); ly.styleId = sid; ly.custom = false; ly.font = ''; }
    if (a.x != null) ly.x = clamp(num(a.x, 0.5), -0.2, 1.2);
    if (a.y != null) ly.y = clamp(num(a.y, 0.5), -0.2, 1.2);
    if (a.size != null) { ly.size = clamp(num(a.size, 90), 10, 400); ly.scale = 1; }
    if (a.rotation != null) ly.rot = clamp(num(a.rotation, 0), -180, 180);
    if (a.opacity != null) ly.opacity = clamp(num(a.opacity, 1), 0.05, 1);
    const d = L.src.dur || 9999;
    if (a.start != null) ly.start = clamp(num(a.start, 0), 0, d);
    if (a.end != null) ly.end = clamp(num(a.end, d), 0, d);
    if (ly.end - ly.start < 0.2) ly.end = Math.min(d, ly.start + 2);
    for (const [k, key, kind] of [['in_anim', 'inAnim', 'in'], ['out_anim', 'outAnim', 'out'], ['loop_anim', 'loopAnim', 'loop']]) {
      if (a[k] != null) { if (!animIds(kind).includes(a[k])) throw new Error(`${k} "${a[k]}" is not a known animation id`); ly[key] = a[k]; }
    }
    if (a.in_dur != null) ly.inDur = clamp(num(a.in_dur, 0.8), 0.1, 5);
    if (a.out_dur != null) ly.outDur = clamp(num(a.out_dur, 0.6), 0.1, 5);
    if (a.loop_speed != null) ly.loopSpeed = clamp(num(a.loop_speed, 1), 0.1, 4);
    if (a.font != null) { const i = L.FONTS.findIndex((f) => f.fam.toLowerCase() === String(a.font).toLowerCase()); if (i >= 0) ly.font = i; }
  }
  const did = [];
  const ACT = {
    get_state() { return stateSummary(); },
    apply_effect(a) { if (!L.effectById(a.id)) throw new Error('unknown effect id ' + a.id); A.applyEffect(a.id, clamp(num(a.amount, 1), 0, 1)); did.push('جلوه: ' + L.effectById(a.id).name); return 'applied'; },
    remove_effect(a) { A.removeEffect(a.id); did.push('حذف جلوه'); return 'removed'; },
    clear_effects() { A.clearEffects(); did.push('ویدیوی اصلی'); return 'cleared'; },
    create_effect(a) {
      const glsl = String(a.glsl || '');
      if (!/vec4\s+effect\s*\(\s*vec2/.test(glsl)) throw new Error('glsl must define: vec4 effect(vec2 uv) { ... }');
      if (glsl.length > 12000) throw new Error('glsl too long, keep it under 12000 chars');
      const err = L.tryCompileEffect(glsl);
      if (err) throw new Error('GLSL compile error, fix and call create_effect again:\n' + err.slice(0, 1500));
      const fx = { id: uid('ai_'), name: String(a.name || 'جلوه هوش مصنوعی').slice(0, 40), cat: 'هوش مصنوعی', glsl, custom: true };
      L.customEffects.push(fx);
      lib.add({ kind: 'effect', id: fx.id, name: fx.name, glsl });
      if (a.apply !== false) A.applyEffect(fx.id, clamp(num(a.amount, 1), 0, 1));
      A.renderFx(); setTimeout(() => L.renderFxThumbs(), 50);
      did.push('جلوه تازه: ' + fx.name);
      return { ok: true, id: fx.id };
    },
    add_text(a) {
      const ly = L.newLayer({ text: 'متن' });
      try { textFields(ly, a); } catch (e) { S.texts = S.texts.filter((x) => x !== ly); throw e; }
      if (a.start == null && a.end == null) { ly.start = S.trim.start; ly.end = S.trim.end; }
      A.select(ly.id); A.commit();
      did.push('متن: ' + ly.text.slice(0, 20));
      return { ok: true, id: ly.id };
    },
    update_text(a) {
      const ly = S.texts.find((x) => x.id === a.id) || (a.id == null && S.texts.find((x) => x.id === S.selected));
      if (!ly) throw new Error('text id not found');
      textFields(ly, a); A.select(ly.id); A.commit(); L.syncTextEditor();
      did.push('ویرایش متن'); return 'updated';
    },
    remove_text(a) { A.removeText(a.id); did.push('حذف متن'); return 'removed'; },
    create_text_style(a) {
      const spec = L.sanitizeSpec(a.spec);
      const st = { id: uid('ais_'), name: String(a.name || 'استایل هوش مصنوعی').slice(0, 40), spec };
      L.customStyles.push(st);
      lib.add({ kind: 'style', id: st.id, name: st.name, spec });
      const target = a.apply_to_text_id ? S.texts.find((x) => x.id === a.apply_to_text_id) : null;
      if (target) { target.styleId = st.id; target.custom = false; target.font = ''; A.select(target.id); A.commit(); }
      L.renderStyles();
      did.push('استایل تازه: ' + st.name);
      return { ok: true, style_id: st.id };
    },
    create_animation(a) {
      const an = { id: uid('aia_'), name: String(a.name || 'حرکت هوش مصنوعی').slice(0, 40), ...L.sanitizeAnim(a) };
      L.customAnims.push(an);
      lib.add({ kind: 'anim', id: an.id, name: an.name, animKind: an.kind, keyframes: an.kf, ease: an.ease, period: an.period });
      const target = a.apply_to_text_id ? S.texts.find((x) => x.id === a.apply_to_text_id) : null;
      if (target) {
        if (an.kind === 'loop') target.loopAnim = an.id; else if (an.kind === 'out') target.outAnim = an.id; else target.inAnim = an.id;
        if (a.duration) { const d = clamp(num(a.duration, 1), 0.1, 5); if (an.kind === 'out') target.outDur = d; else if (an.kind === 'in') target.inDur = d; }
        A.select(target.id); A.commit();
      }
      L.renderAnimPanel();
      did.push('حرکت تازه: ' + an.name);
      return { ok: true, animation_id: an.id };
    },
    set_adjustments(a) {
      const m = { brightness: ['bright', -0.5, 0.5], contrast: ['contrast', 0.4, 2], saturation: ['sat', 0, 2.5], temperature: ['temp', -1, 1] };
      for (const k in m) if (a[k] != null) S.adjust[m[k][0]] = clamp(num(a[k], 0), m[k][1], m[k][2]);
      A.syncMedia(); A.commit(); did.push('تنظیم رنگ'); return 'ok';
    },
    set_video(a) {
      if (a.ratio && ['original', '9:16', '1:1', '4:5', '16:9'].includes(a.ratio)) S.ratio = a.ratio;
      if (a.fit === 'cover' || a.fit === 'contain') S.fit = a.fit;
      if (a.speed != null) S.speed = clamp(num(a.speed, 1), 0.25, 3);
      const d = L.src.dur;
      if (a.trim_start != null) S.trim.start = clamp(num(a.trim_start, 0), 0, d - 0.2);
      if (a.trim_end != null) S.trim.end = clamp(num(a.trim_end, d), S.trim.start + 0.2, d);
      A.refresh(); A.commit(); did.push('تنظیم ویدیو'); return 'ok';
    },
  };

  const S_ = (o) => ({ type: 'object', ...o });
  const textProps = {
    text: { type: 'string' }, style_id: { description: 'number 0-1399 (look_index*70 + palette_index) or an id returned by create_text_style' },
    x: { type: 'number', description: '0..1 from left' }, y: { type: 'number', description: '0..1 from top' }, size: { type: 'number', description: 'font size, 90 is a normal title, 40 a caption' },
    rotation: { type: 'number' }, opacity: { type: 'number' }, start: { type: 'number', description: 'seconds' }, end: { type: 'number', description: 'seconds' },
    in_anim: { type: 'string' }, out_anim: { type: 'string' }, loop_anim: { type: 'string' }, in_dur: { type: 'number' }, out_dur: { type: 'number' }, loop_speed: { type: 'number' }, font: { type: 'string' },
  };
  const TOOLS = [
    { name: 'apply_effect', description: 'Apply (or re-set the amount of) a video effect by id. Effects stack in order. Returns "applied".', inputSchema: S_({ properties: { id: { type: 'string' }, amount: { type: 'number', description: '0..1' } }, required: ['id'] }) },
    { name: 'remove_effect', description: 'Remove one active effect by id.', inputSchema: S_({ properties: { id: { type: 'string' } }, required: ['id'] }) },
    { name: 'clear_effects', description: 'Remove every effect so the video looks original.' },
    { name: 'create_effect', description: 'Create a brand-new GPU video effect from a GLSL ES 1.0 snippet that defines `vec4 effect(vec2 uv)`, compile it, store it, and (by default) apply it. Throws the compiler log on error so you can fix it.', inputSchema: S_({ properties: { name: { type: 'string', description: 'short Persian name' }, glsl: { type: 'string' }, amount: { type: 'number' }, apply: { type: 'boolean' } }, required: ['name', 'glsl'] }) },
    { name: 'add_text', description: 'Add a text layer on the video. Returns its id.', inputSchema: S_({ properties: textProps, required: ['text'] }) },
    { name: 'update_text', description: 'Change an existing text layer (any field of add_text).', inputSchema: S_({ properties: { id: { type: 'string' }, ...textProps }, required: ['id'] }) },
    { name: 'remove_text', description: 'Delete a text layer.', inputSchema: S_({ properties: { id: { type: 'string' } }, required: ['id'] }) },
    { name: 'create_text_style', description: 'Design a new text style from a spec object, store it, optionally apply it to a text. Returns style_id.', inputSchema: S_({ properties: { name: { type: 'string' }, spec: { type: 'object' }, apply_to_text_id: { type: 'string' } }, required: ['name', 'spec'] }) },
    { name: 'create_animation', description: 'Design a new text animation from keyframes, store it, optionally apply it to a text. Returns animation_id.', inputSchema: S_({ properties: { name: { type: 'string' }, kind: { type: 'string', enum: ['in', 'out', 'loop'] }, keyframes: { type: 'array' }, ease: { type: 'string' }, period: { type: 'number' }, duration: { type: 'number' }, apply_to_text_id: { type: 'string' } }, required: ['name', 'kind', 'keyframes'] }) },
    { name: 'set_adjustments', description: 'Colour grade: brightness -0.5..0.5, contrast 0.4..2, saturation 0..2.5, temperature -1..1.', inputSchema: S_({ properties: { brightness: { type: 'number' }, contrast: { type: 'number' }, saturation: { type: 'number' }, temperature: { type: 'number' } } }) },
    { name: 'set_video', description: 'Frame and timing: ratio (original, 9:16, 1:1, 4:5, 16:9), fit (contain|cover), speed 0.25..3, trim_start, trim_end seconds.', inputSchema: S_({ properties: { ratio: { type: 'string' }, fit: { type: 'string' }, speed: { type: 'number' }, trim_start: { type: 'number' }, trim_end: { type: 'number' } } }) },
  ];

  function stateSummary() {
    return {
      video: { has_user_video: S.hasVideo, duration: +(L.src.dur || 0).toFixed(2), current_time: +L.src.time.toFixed(2), trim: S.trim, ratio: S.ratio, speed: S.speed },
      active_effects: S.effects.map((e) => ({ id: e.id, amount: e.amt })),
      adjustments: S.adjust,
      texts: S.texts.map((t) => ({ id: t.id, text: t.text, style_id: t.styleId, x: +t.x.toFixed(3), y: +t.y.toFixed(3), size: t.size, start: +t.start.toFixed(2), end: +t.end.toFixed(2), in_anim: t.inAnim, out_anim: t.outAnim, loop_anim: t.loopAnim })),
      selected_text_id: S.selected,
    };
  }

  function rules() {
    const fx = L.allEffects().map((e) => `${e.id}=${e.name}`).join(', ');
    const looks = L.LOOKS.map((l, i) => `${i}:${l.name}(${l.key})`).join(', ');
    const pals = L.PALETTES.map((p, i) => `${i}:${p.name}`).join(', ');
    const ai = L.customStyles.map((s) => `${s.id}=${s.name}`).join(', ') || 'none';
    const inA = animIds('in').join(', '), loopA = animIds('loop').join(', ');
    const fonts = L.FONTS.map((f) => f.fam).filter((v, i, a) => a.indexOf(v) === i).join(', ');
    return `You are the creative assistant built into "Ladino", a Persian video editor running in the browser. The user writes in Persian (sometimes English). Do what they ask by changing the editor, then answer in short, warm, natural Persian (1-3 sentences) saying what you did. Never mention tools, JSON or code to the user.

EFFECTS (id=Persian name): ${fx}
Choose the best existing effects for a mood, combine several, and tune amount (0..1). If nothing fits, invent a new one with create_effect.

create_effect GLSL contract (WebGL1 / GLSL ES 1.0). Write ONLY helper functions plus:
vec4 effect(vec2 uv) { ... return vec4(rgb, 1.0); }
Already declared, do not redeclare: uniform sampler2D u_tex; uniform vec2 u_res (pixels); uniform float u_time (seconds); uniform float u_amt (0..1 intensity, always use it to blend: mix(original, result, u_amt)); varying v_uv; #define PI.
Helpers available: vec4 tex(vec2 uv) (clamped sample), float luma(vec3), float hash(vec2), float noise(vec2), vec3 rgb2hsv(vec3), vec3 hsv2rgb(vec3), vec3 sobel(vec2 uv) (edge strength in .r).
GLSL ES 1.0 rules: float literals need a dot (1.0 not 1), loops need constant int bounds, no dynamic array indexing, no texture() (use tex), no #version.

TEXT STYLES: 1400 built-in styles, style_id = look_index*70 + palette_index.
Looks: ${looks}
Palettes: ${pals}
AI styles already made: ${ai}
create_text_style spec (all optional): {"font":{"fam":one of [${fonts}],"w":100-900,"italic":bool}, "fill":{"type":"solid|linear|radial|stripes|rainbow|none","colors":["#hex",...],"angle":deg}, "strokes":[{"color":"#hex","width":0.01-0.6 (fraction of font size)}], "shadow":{"color","x","y","blur"}, "glow":{"color","blur":0.05-1,"passes":1-4}, "extrude":{"color","depth":0.02-0.4}, "longShadow":{"color","len":0.1-1.2}, "hardShadow":{"color","x","y"}, "glitch":{"c1","c2","off":0.01-0.2}, "bg":{"type":"box|pill|marker","colors":["#hex"],"pad":0-1,"radius":0-1}, "emboss":bool, "letterSpacing":-0.1..0.6, "opacity":0..1}. Sizes are fractions of the font size. Noto Nastaliq Urdu is Persian calligraphy, Lalezar is a bold display face, Vazirmatn a clean modern face.

TEXT ANIMATIONS
in/out ids: ${inA}
loop ids: ${loopA}
create_animation keyframes: [{"t":0..1, "o":opacity, "x":offset fraction of width, "y":offset fraction of height, "s":scale, "sx","sy":stretch, "r":rotation deg, "b":blur (fraction of font size), "k":skew deg}], missing values mean the resting state (o 1, s 1, others 0). For kind "in", t=0 is the hidden start and t=1 MUST be the resting state. For kind "out", t=0 is resting and t=1 is gone. For kind "loop", t=0 and t=1 must match. ease: linear, outCubic, inCubic, inOut, outBack, outElastic, outBounce. period: seconds per loop cycle.

Positions: x,y are the text centre (0.5,0.5 = middle; y 0.85 = lower third). Texts default to the whole trimmed video unless the user gives times.`;
  }

  // ---------- chat UI ----------
  const chat = $('#chat');
  const turns = [];
  function msg(role, text, acts) {
    const d = document.createElement('div'); d.className = 'msg ' + role;
    d.textContent = text;
    if (acts && acts.length) { const box = document.createElement('div'); box.className = 'acts'; acts.forEach((a) => { const s = document.createElement('span'); s.textContent = a; box.append(s); }); d.append(box); }
    chat.append(d); d.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return d;
  }
  function thinking() { const d = document.createElement('div'); d.className = 'msg ai'; const t = document.createElement('span'); t.className = 'thinking'; t.append(document.createElement('i'), document.createElement('i'), document.createElement('i')); d.append(t); chat.append(d); d.scrollIntoView({ block: 'nearest' }); return d; }
  const CHIPS = [
    'حال‌وهوای فیلم‌های دهه هشتاد بده',
    'یه جلوه آبرنگی که رنگ‌ها آروم موج بخورن بساز',
    'بالای ویدیو بنویس «تولدت مبارک» طلایی و پاپ کنه',
    'یه حرکت ورود بساز که متن مثل فنر از پایین بپره',
    'ویدیو رو سینمایی و دراماتیک کن',
    'یه استایل متن نئونی صورتی-آبی با سایه بلند بساز',
  ];
  $('#aiChips').replaceChildren(...CHIPS.map((c) => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = c; b.onclick = () => { $('#aiInp').value = c; run(c); }; return b; }));
  msg('ai', 'سلام! من دستیار خلاق لادینو هستم 🌈 بگو چه حسی می‌خواهی؛ جلوه، استایل متن یا حرکتی که حتی وجود ندارد را برایت می‌سازم و روی ویدیو می‌گذارم.');

  function setStat(kind, text) { const el = $('#aiStat'); el.querySelector('.dot').className = 'dot ' + kind; el.querySelector('span').textContent = text; }
  const ERR = {
    not_granted: 'اجازه استفاده از هوش مصنوعی داده نشد. اگر خواستی، از منوی دسترسی‌های همین صفحه اجازه بده.',
    sampling_disabled: 'هوش مصنوعی برای این حساب در دسترس نیست.',
    rate_limited: 'درخواست‌ها زیاد شد؛ کمی بعد دوباره امتحان کن.',
    session_expired: 'نشست تمام شده؛ دوباره وارد Claude شو.',
    refused: 'این درخواست انجام نشد. جور دیگری بگو.',
    prompt_too_large: 'درخواست خیلی بلند است؛ کوتاه‌ترش کن.',
    invalid_json: 'جواب کامل نبود؛ یک بار دیگر بزن.',
  };

  async function run(text, origin) {
    text = String(text || '').trim();
    if (!text) return;
    if (!sample) { L.toast('هوش مصنوعی فقط وقتی برنامه داخل Claude باز است کار می‌کند'); msg('sys', 'هوش مصنوعی در این نما در دسترس نیست. برنامه را داخل Claude باز کن.'); return; }
    if (busy) { L.toast('صبر کن، کار قبلی هنوز تمام نشده'); return; }
    const ctl = new AbortController(); busy = ctl;
    $('#aiSend').disabled = true; $('#aiStop').disabled = false;
    [...document.querySelectorAll('.ai-box .btn')].forEach((b) => (b.disabled = true));
    msg('me', text);
    const think = thinking();
    did.length = 0;
    if (origin) L.toast('هوش مصنوعی در حال ساختن است…', 3500);
    const state = 'Current editor state:\n' + JSON.stringify(stateSummary());
    turns.push({ role: 'user', content: state + '\n\nUser request: ' + text });
    while (turns.length > 8) turns.shift();
    const input = [{ role: 'user', content: rules() }, ...turns];
    let reply = '';
    try {
      if (canTools) {
        const tools = TOOLS.map((t) => ({ ...t, execute: (inp) => ACT[t.name](inp || {}) }));
        const r = await sample(input, { tools, signal: ctl.signal, modelTier: 'default', onText: ({ text: t }) => { think.textContent = lastPara(t); } });
        reply = lastPara(r.text);
      } else {
        const plan = await sample.json([...input.slice(0, -1), { role: 'user', content: input[input.length - 1].content + `\n\nReply with ONLY a JSON object: {"actions":[{"tool":"<one of ${Object.keys(ACT).join(', ')}>","args":{...}}], "reply":"short Persian message"}. Tool argument names are exactly as described above (add_text uses text, style_id, x, y, size, start, end, in_anim, out_anim, loop_anim...; create_effect uses name, glsl; create_text_style uses name, spec, apply_to_text_id; create_animation uses name, kind, keyframes, ease, period, apply_to_text_id). When you create a style or animation in the same plan as a text, put the text first and use apply_to_text_id "LAST_TEXT".` }], { signal: ctl.signal, modelTier: 'default', cache: false });
        let lastText = null; const errs = [];
        for (const step of (plan && plan.actions) || []) {
          const fn = ACT[step && step.tool]; if (!fn) continue;
          const args = { ...(step.args || {}) };
          if (args.apply_to_text_id === 'LAST_TEXT') args.apply_to_text_id = lastText;
          if (args.id === 'LAST_TEXT') args.id = lastText;
          try { const out = fn(args); if (out && out.id && step.tool === 'add_text') lastText = out.id; } catch (e) { errs.push(String(e.message || e)); }
        }
        reply = (plan && plan.reply) || 'انجام شد ✨';
        if (errs.length) reply += '\n(بخشی از کار انجام نشد: ' + errs[0].slice(0, 120) + ')';
      }
      turns.push({ role: 'assistant', content: reply || 'انجام شد.' });
      think.remove();
      msg('ai', reply || 'انجام شد ✨', did.slice());
      if (origin) L.toast(did.length ? '✨ ' + did[did.length - 1] : 'هوش مصنوعی کاری انجام نداد', 3500);
    } catch (e) {
      think.remove();
      turns.pop();
      if (e && e.code === 'cancelled') msg('sys', 'متوقف شد.' + (did.length ? ' کارهای انجام‌شده باقی ماندند.' : ''));
      else {
        const m = (e && ERR[e.code]) || 'ارتباط با هوش مصنوعی قطع شد؛ دوباره امتحان کن.';
        msg('sys', m);
        if (origin) L.toast(m, 4000);
        if (e && (e.code === 'not_granted' || e.code === 'sampling_disabled')) { setStat('off', 'هوش مصنوعی خاموش'); }
      }
    } finally {
      busy = null;
      $('#aiSend').disabled = false; $('#aiStop').disabled = true;
      [...document.querySelectorAll('.ai-box .btn')].forEach((b) => (b.disabled = false));
    }
  }
  const lastPara = (t) => { const p = String(t || '').trim().split(/\n\s*\n/).filter(Boolean); return p[p.length - 1] || ''; };
  L.aiRun = run;

  $('#aiSend').onclick = () => { const v = $('#aiInp').value; $('#aiInp').value = ''; run(v); };
  $('#aiInp').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#aiSend').click(); });
  $('#aiStop').onclick = () => busy && busy.abort();
  const panelAsk = (inp, prefix) => () => { const v = $(inp).value.trim(); if (!v) { $(inp).focus(); return; } $(inp).value = ''; run(prefix + v, 'panel'); };
  $('#fxAiBtn').onclick = panelAsk('#fxAiInp', 'یک جلوه ویدیویی کاملاً جدید بساز و روی ویدیو بگذار: ');
  $('#stAiBtn').onclick = panelAsk('#stAiInp', 'یک استایل متن کاملاً جدید طراحی کن و روی متن انتخاب‌شده بگذار (اگر متنی نیست، یک متن کوتاه مناسب بساز): ');
  $('#anAiBtn').onclick = panelAsk('#anAiInp', 'یک حرکت (انیمیشن) متن کاملاً جدید طراحی کن و روی متن انتخاب‌شده بگذار (اگر متنی نیست، یک متن کوتاه بساز): ');
  ['#fxAiInp', '#stAiInp', '#anAiInp'].forEach((id) => $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') $(id).nextElementSibling.click(); }));

  // ---------- connect ----------
  (async () => {
    if (!window.claude || typeof window.claude.use !== 'function') { setStat('off', 'هوش مصنوعی: داخل Claude باز کن'); return; }
    sample = await window.claude.use('sample');
    if (!sample) { setStat('off', 'هوش مصنوعی در دسترس نیست'); return; }
    const lim = await sample.limits().catch(() => null);
    canTools = !!(lim && lim.tools);
    setStat('on', 'هوش مصنوعی آماده');
  })();
})();
