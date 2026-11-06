/* Ladino — 1400 text styles (20 looks × 70 palettes) + a canvas renderer for any style spec */
(function () {
  const L = (window.L = window.L || {});

  L.FONTS = [
    { fam: 'Vazirmatn', w: 900, name: 'وزیر ضخیم', lh: 1.35 },
    { fam: 'Lalezar', w: 400, name: 'لاله‌زار', lh: 1.4 },
    { fam: 'Noto Nastaliq Urdu', w: 700, name: 'نستعلیق', lh: 2.0 },
    { fam: 'Reem Kufi', w: 700, name: 'کوفی', lh: 1.4 },
    { fam: 'Changa', w: 800, name: 'چنگا', lh: 1.45 },
    { fam: 'Lemonada', w: 700, name: 'لیموناد', lh: 1.6 },
    { fam: 'Jomhuria', w: 400, name: 'جمهوریا', lh: 1.05 },
    { fam: 'Aref Ruqaa', w: 700, name: 'رقعه', lh: 1.6 },
    { fam: 'Markazi Text', w: 700, name: 'مرکزی', lh: 1.4 },
    { fam: 'Rakkas', w: 400, name: 'رقاص', lh: 1.45 },
    { fam: 'Vazirmatn', w: 400, name: 'وزیر نازک', lh: 1.35 },
  ];
  L.fontCss = (f, px) => `${f.italic ? 'italic ' : ''}${f.w || 700} ${px}px "${f.fam}", "Vazirmatn", "Segoe UI Emoji", sans-serif`;

  // ---------- palettes ----------
  const named = [
    ['غروب', '#ff5f6d', '#ffc371', '#3a0ca3'], ['اقیانوس', '#00c6ff', '#0072ff', '#001845'], ['آبنبات', '#ff9ff3', '#feca57', '#5f27cd'],
    ['طلایی', '#fff1a8', '#f5b700', '#5a3a00'], ['نقره‌ای', '#ffffff', '#b8c1cc', '#2d3436'], ['آتش', '#fff200', '#ff6a00', '#7a0000'],
    ['یخ', '#e0fbff', '#7fdbff', '#0b3d91'], ['جنگل', '#d4fc79', '#38b000', '#063b00'], ['بنفش شب', '#e0aaff', '#7b2cbf', '#10002b'],
    ['صورتی نئون', '#ffd6f5', '#ff2fb9', '#3a0030'], ['لیمو', '#fbff12', '#a7ff00', '#1f3300'], ['شکلاتی', '#ffe0b5', '#b5651d', '#3b1f0b'],
    ['هلو', '#ffe5d9', '#ff9b85', '#6d2e46'], ['سایبر', '#00fff0', '#ff00e6', '#120024'], ['قهوه', '#f3e9dc', '#c08552', '#2b1810'],
    ['زمرد', '#b9fbc0', '#00a676', '#02231c'], ['یاقوت', '#ffb3c1', '#c9184a', '#2b000a'], ['فیروزه', '#c7f9f5', '#06d6a0', '#073b4c'],
    ['کهکشان', '#f72585', '#4361ee', '#0b0033'], ['شفق', '#43e97b', '#38f9d7', '#2d1b69'], ['مرجان', '#ffd3b6', '#ff6f59', '#254441'],
    ['لاوندر', '#f3e8ff', '#b388eb', '#3c1361'], ['خاکی', '#f2e8cf', '#a68a64', '#3d405b'], ['آسمان', '#ffffff', '#8ecae6', '#023047'],
    ['هندوانه', '#ff6b6b', '#51cf66', '#1b4332'], ['پرچم', '#ffffff', '#d90429', '#007f3f'], ['کلاسیک', '#ffffff', '#ffffff', '#000000'],
    ['شب', '#111111', '#333333', '#ffffff'], ['رترو', '#ffbe0b', '#fb5607', '#3a0ca3'], ['ویپرویو', '#ff71ce', '#01cdfe', '#05ffa1'],
  ];
  const hsl = (h, s, l) => `hsl(${Math.round(h) % 360} ${s}% ${l}%)`;
  const schemes = ['هم‌خانواده', 'مکمل', 'سه‌گانه', 'تک‌رنگ'];
  const P = named.map(([name, a, b, c]) => ({ name, c: [a, b, c] }));
  for (let i = 0; P.length < 70; i++) {
    const h = (i * 360) / 40 + 7;
    const k = i % 4;
    let c;
    if (k === 0) c = [hsl(h, 95, 72), hsl(h + 35, 90, 55), hsl(h + 200, 70, 14)];
    else if (k === 1) c = [hsl(h, 100, 65), hsl(h + 180, 95, 60), hsl(h + 90, 60, 12)];
    else if (k === 2) c = [hsl(h, 95, 70), hsl(h + 120, 90, 60), hsl(h + 240, 80, 18)];
    else c = [hsl(h, 100, 88), hsl(h, 95, 58), hsl(h, 80, 16)];
    P.push({ name: `${schemes[k]} ${i + 1}`, c });
  }
  L.PALETTES = P;

  // ---------- looks ----------
  const LOOKS = [
    { key: 'classic', name: 'کلاسیک', font: 0 },
    { key: 'outline', name: 'حاشیه‌دار', font: 1 },
    { key: 'double', name: 'دوخطی', font: 4 },
    { key: 'neon', name: 'نئون', font: 3 },
    { key: 'gradient', name: 'گرادینت', font: 0 },
    { key: '3d', name: 'سه‌بعدی', font: 1 },
    { key: 'longshadow', name: 'سایه بلند', font: 6 },
    { key: 'box', name: 'جعبه‌ای', font: 0 },
    { key: 'pill', name: 'کپسولی', font: 4 },
    { key: 'sticker', name: 'استیکر', font: 5 },
    { key: 'glitch', name: 'گلیچ', font: 3 },
    { key: 'retro', name: 'رترو', font: 9 },
    { key: 'metal', name: 'متالیک', font: 8 },
    { key: 'glass', name: 'شیشه‌ای', font: 0 },
    { key: 'comic', name: 'کمیک', font: 5 },
    { key: 'fire', name: 'آتشین', font: 1 },
    { key: 'marker', name: 'هایلایت', font: 7 },
    { key: 'hollow', name: 'توخالی', font: 6 },
    { key: 'emboss', name: 'برجسته', font: 8 },
    { key: 'calligraphy', name: 'خوشنویسی', font: 2 },
  ];
  L.LOOKS = LOOKS;
  L.STYLE_COUNT = LOOKS.length * P.length; // 1400

  const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];
  // fonts vary within a look so neighbouring styles feel different
  const fontFor = (lookIdx, palIdx) => {
    const base = LOOKS[lookIdx].font;
    const alt = [base, base, (base + 3) % 10, (base + 7) % 10, base, (base + 5) % 10, 2][palIdx % 7];
    return L.FONTS[alt];
  };

  function buildSpec(lookIdx, palIdx) {
    const look = LOOKS[lookIdx].key;
    const [a, b, c] = P[palIdx].c;
    const f = fontFor(lookIdx, palIdx);
    const font = { fam: f.fam, w: f.w, lh: f.lh };
    const s = { font, fill: { type: 'solid', colors: [a] }, strokes: [], opacity: 1 };
    switch (look) {
      case 'classic': s.fill = { type: 'solid', colors: [a] }; s.shadow = { color: 'rgba(0,0,0,.55)', x: 0.02, y: 0.04, blur: 0.08 }; break;
      case 'outline': s.fill = { type: 'solid', colors: [a] }; s.strokes = [{ color: c, width: 0.14 }]; break;
      case 'double': s.fill = { type: 'solid', colors: [a] }; s.strokes = [{ color: b, width: 0.3 }, { color: c, width: 0.15 }]; break;
      case 'neon': s.fill = { type: 'solid', colors: ['#ffffff'] }; s.strokes = [{ color: b, width: 0.06 }]; s.glow = { color: b, blur: 0.35, passes: 3 }; break;
      case 'gradient': s.fill = { type: 'linear', colors: [a, b], angle: 90 }; s.strokes = [{ color: c, width: 0.05 }]; s.shadow = { color: 'rgba(0,0,0,.4)', x: 0, y: 0.03, blur: 0.06 }; break;
      case '3d': s.fill = { type: 'linear', colors: [a, b], angle: 90 }; s.extrude = { color: c, depth: 0.12 }; s.strokes = [{ color: c, width: 0.04 }]; break;
      case 'longshadow': s.fill = { type: 'solid', colors: [a] }; s.longShadow = { color: c, len: 0.5 }; break;
      case 'box': s.fill = { type: 'solid', colors: [lum(a) > 0.6 ? c : '#ffffff'] }; s.bg = { type: 'box', colors: [a], pad: 0.3, radius: 0.08 }; break;
      case 'pill': s.fill = { type: 'solid', colors: ['#ffffff'] }; s.bg = { type: 'pill', colors: [b, c], pad: 0.38, radius: 1 }; s.shadow = { color: 'rgba(0,0,0,.3)', x: 0, y: 0.02, blur: 0.04 }; break;
      case 'sticker': s.fill = { type: 'linear', colors: [a, b], angle: 90 }; s.strokes = [{ color: '#ffffff', width: 0.32 }, { color: c, width: 0.06 }]; s.shadow = { color: 'rgba(0,0,0,.45)', x: 0.03, y: 0.06, blur: 0.12 }; break;
      case 'glitch': s.fill = { type: 'solid', colors: ['#ffffff'] }; s.glitch = { c1: a, c2: b, off: 0.05 }; break;
      case 'retro': s.fill = { type: 'stripes', colors: [a, b], angle: 90 }; s.strokes = [{ color: c, width: 0.08 }]; s.extrude = { color: c, depth: 0.08 }; break;
      case 'metal': s.fill = { type: 'linear', colors: ['#ffffff', a, mix(a, '#000000', 0.45), '#ffffff', b], angle: 90 }; s.strokes = [{ color: c, width: 0.06 }]; s.shadow = { color: 'rgba(0,0,0,.6)', x: 0, y: 0.04, blur: 0.06 }; break;
      case 'glass': s.fill = { type: 'linear', colors: [alpha(a, 0.55), alpha(b, 0.25)], angle: 90 }; s.strokes = [{ color: 'rgba(255,255,255,.85)', width: 0.035 }]; s.glow = { color: alpha(a, 0.8), blur: 0.25, passes: 1 }; break;
      case 'comic': s.fill = { type: 'solid', colors: [a] }; s.strokes = [{ color: '#000000', width: 0.16 }]; s.hardShadow = { color: b, x: 0.07, y: 0.08 }; s.font.italic = false; break;
      case 'fire': s.fill = { type: 'linear', colors: ['#fffbe0', a, b], angle: 90 }; s.glow = { color: b, blur: 0.3, passes: 2 }; s.strokes = [{ color: c, width: 0.03 }]; break;
      case 'marker': s.fill = { type: 'solid', colors: [lum(a) > 0.55 ? c : '#ffffff'] }; s.bg = { type: 'marker', colors: [alpha(a, 0.9)], pad: 0.2, radius: 0.2 }; break;
      case 'hollow': s.fill = { type: 'none', colors: [] }; s.strokes = [{ color: a, width: 0.07 }]; s.glow = { color: b, blur: 0.18, passes: 1 }; break;
      case 'emboss': s.fill = { type: 'solid', colors: [a] }; s.emboss = true; s.strokes = [{ color: mix(a, '#000000', 0.5), width: 0.025 }]; break;
      case 'calligraphy': s.fill = { type: 'linear', colors: [a, b], angle: 90 }; s.shadow = { color: alpha(c, 0.9), x: 0.02, y: 0.03, blur: 0.05 }; s.font = { fam: 'Noto Nastaliq Urdu', w: 700, lh: 2.0 }; break;
    }
    return s;
  }

  L.styleInfo = (id) => {
    if (typeof id === 'string') {
      const c = L.customStyles.find((x) => x.id === id);
      return c ? { id, name: c.name, look: 'هوش مصنوعی', pal: '', spec: c.spec, custom: true } : L.styleInfo(0);
    }
    const n = Math.max(0, Math.min(L.STYLE_COUNT - 1, id | 0));
    const li = Math.floor(n / P.length), pi = n % P.length;
    return { id: n, name: `${LOOKS[li].name} · ${P[pi].name}`, look: LOOKS[li].name, lookKey: LOOKS[li].key, pal: P[pi].name, spec: buildSpec(li, pi) };
  };
  L.customStyles = [];

  // ---------- colour helpers ----------
  const cnv = document.createElement('canvas').getContext('2d');
  function toRGB(col) {
    cnv.fillStyle = '#000';
    cnv.fillStyle = col;
    const v = cnv.fillStyle;
    if (v[0] === '#') return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1];
    const m = v.match(/[\d.]+/g) || [0, 0, 0, 1];
    return [+m[0], +m[1], +m[2], m[3] == null ? 1 : +m[3]];
  }
  function lum(col) { const [r, g, b] = toRGB(col); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
  function alpha(col, a) { const [r, g, b] = toRGB(col); return `rgba(${r},${g},${b},${a})`; }
  function mix(c1, c2, t) { const a = toRGB(c1), b = toRGB(c2); return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`; }
  L.color = { toRGB, lum, alpha, mix };
  L.validColor = (col) => {
    if (typeof col !== 'string' || col.length > 60) return null;
    cnv.fillStyle = '#010203';
    cnv.fillStyle = col;
    return cnv.fillStyle === '#010203' && col.replace(/\s/g, '').toLowerCase() !== '#010203' ? null : col;
  };

  // Sanitise a style spec that came from the AI (never trusted)
  const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  L.sanitizeSpec = (s) => {
    s = s && typeof s === 'object' ? s : {};
    const out = { strokes: [], opacity: num(s.opacity, 0.05, 1, 1) };
    const f = s.font || {};
    const known = L.FONTS.find((x) => x.fam.toLowerCase() === String(f.fam || f.family || '').toLowerCase()) || L.FONTS[0];
    out.font = { fam: known.fam, w: num(f.w || f.weight, 100, 900, known.w), lh: known.lh, italic: !!f.italic };
    const fill = s.fill || {};
    const types = ['solid', 'linear', 'radial', 'stripes', 'rainbow', 'none'];
    const cols = (Array.isArray(fill.colors) ? fill.colors : [fill.color || '#ffffff']).map(L.validColor).filter(Boolean).slice(0, 8);
    out.fill = { type: types.includes(fill.type) ? fill.type : 'solid', colors: cols.length ? cols : ['#ffffff'], angle: num(fill.angle, 0, 360, 90) };
    (Array.isArray(s.strokes) ? s.strokes : []).slice(0, 4).forEach((k) => { const c = L.validColor(k && k.color); if (c) out.strokes.push({ color: c, width: num(k.width, 0.005, 0.6, 0.08) }); });
    const sh = (o, keys) => (o && L.validColor(o.color) ? keys(o) : undefined);
    out.shadow = sh(s.shadow, (o) => ({ color: o.color, x: num(o.x, -0.5, 0.5, 0), y: num(o.y, -0.5, 0.5, 0.04), blur: num(o.blur, 0, 1, 0.08) }));
    out.glow = sh(s.glow, (o) => ({ color: o.color, blur: num(o.blur, 0.02, 1, 0.3), passes: num(o.passes, 1, 4, 2) | 0 }));
    out.extrude = sh(s.extrude, (o) => ({ color: o.color, depth: num(o.depth, 0.01, 0.4, 0.1) }));
    out.longShadow = sh(s.longShadow, (o) => ({ color: o.color, len: num(o.len, 0.05, 1.2, 0.4) }));
    out.hardShadow = sh(s.hardShadow, (o) => ({ color: o.color, x: num(o.x, -0.4, 0.4, 0.06), y: num(o.y, -0.4, 0.4, 0.06) }));
    if (s.glitch && L.validColor(s.glitch.c1) && L.validColor(s.glitch.c2)) out.glitch = { c1: s.glitch.c1, c2: s.glitch.c2, off: num(s.glitch.off, 0.01, 0.2, 0.05) };
    if (s.bg && typeof s.bg === 'object') {
      const bc = (Array.isArray(s.bg.colors) ? s.bg.colors : [s.bg.color]).map(L.validColor).filter(Boolean).slice(0, 4);
      if (bc.length) out.bg = { type: ['box', 'pill', 'marker'].includes(s.bg.type) ? s.bg.type : 'box', colors: bc, pad: num(s.bg.pad, 0, 1, 0.3), radius: num(s.bg.radius, 0, 1, 0.1) };
    }
    out.emboss = !!s.emboss;
    out.letterSpacing = num(s.letterSpacing, -0.1, 0.6, 0);
    return out;
  };

  // ---------- renderer ----------
  const RTL = /[֐-ࣿיִ-ﻼ]/;
  function makeFill(ctx, fill, w, h, t) {
    const cols = fill.colors && fill.colors.length ? fill.colors : ['#fff'];
    if (fill.type === 'solid' || cols.length === 1 && fill.type !== 'rainbow') return cols[0];
    const ang = ((fill.angle == null ? 90 : fill.angle) * Math.PI) / 180;
    const dx = Math.sin(ang) * w * 0.5, dy = -Math.cos(ang) * h * 0.5;
    if (fill.type === 'radial') {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) * 0.6);
      cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
      return g;
    }
    if (fill.type === 'rainbow') {
      const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      const off = (t * 120) % 360;
      for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${(off + i * 60) % 360} 100% 62%)`);
      return g;
    }
    const g = ctx.createLinearGradient(-dx, -dy, dx, dy);
    if (fill.type === 'stripes') {
      const n = 6;
      for (let i = 0; i < n; i++) { const c = cols[i % cols.length]; g.addColorStop(i / n, c); g.addColorStop((i + 1) / n - 0.001, c); }
      return g;
    }
    cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
    return g;
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /** Draw `text` centred at the current origin. Returns the local box {w,h}. */
  L.drawStyledText = function (ctx, text, spec, px, t = 0, opt = {}) {
    const lines = String(text).split('\n');
    const font = spec.font || L.FONTS[0];
    ctx.font = L.fontCss(font, px);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = RTL.test(text) ? 'rtl' : 'ltr';
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(spec.letterSpacing || 0) * px}px`;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    const lh = px * (font.lh || 1.35);
    let w = 0;
    for (const ln of lines) w = Math.max(w, ctx.measureText(ln).width);
    const h = lh * lines.length;
    const y0 = -h / 2 + lh / 2;
    const each = (fn) => lines.forEach((ln, i) => fn(ln, y0 + i * lh));
    const reset = () => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; };
    const strokeW = spec.strokes && spec.strokes.length ? Math.max(...spec.strokes.map((s) => s.width)) * px : 0;
    let boxW = w + strokeW, boxH = h;
    const baseAlpha = ctx.globalAlpha;
    ctx.globalAlpha = baseAlpha * (spec.opacity == null ? 1 : spec.opacity);

    if (spec.bg) {
      const pad = (spec.bg.pad || 0.3) * px;
      const bw = w + pad * 2 + strokeW, bh = h + pad * 1.2;
      const fillBg = makeFill(ctx, { type: spec.bg.colors.length > 1 ? 'linear' : 'solid', colors: spec.bg.colors, angle: 90 }, bw, bh, t);
      ctx.fillStyle = fillBg;
      if (spec.bg.type === 'marker') {
        ctx.save(); ctx.rotate(-0.025);
        roundRect(ctx, -bw / 2, -bh / 2 + bh * 0.12, bw, bh * 0.82, px * 0.12); ctx.fill(); ctx.restore();
      } else {
        roundRect(ctx, -bw / 2, -bh / 2, bw, bh, spec.bg.type === 'pill' ? bh / 2 : (spec.bg.radius || 0.1) * px * 2);
        ctx.fill();
      }
      boxW = bw; boxH = bh;
    }
    const fillStyle = spec.fill && spec.fill.type !== 'none' ? makeFill(ctx, spec.fill, w, h, t) : null;

    if (spec.longShadow) {
      ctx.fillStyle = spec.longShadow.color;
      const n = Math.max(4, Math.round(spec.longShadow.len * px));
      for (let i = n; i > 0; i -= Math.max(1, n / 60)) each((ln, y) => ctx.fillText(ln, i, y + i));
    }
    if (spec.extrude) {
      ctx.fillStyle = spec.extrude.color;
      const d = Math.max(2, spec.extrude.depth * px);
      for (let i = d; i > 0; i -= Math.max(1, d / 30)) {
        each((ln, y) => { if (strokeW) { ctx.strokeStyle = spec.extrude.color; ctx.lineWidth = strokeW; ctx.strokeText(ln, i * 0.5, y + i); } ctx.fillText(ln, i * 0.5, y + i); });
      }
    }
    if (spec.hardShadow) {
      ctx.fillStyle = spec.hardShadow.color; ctx.strokeStyle = spec.hardShadow.color; ctx.lineWidth = strokeW;
      each((ln, y) => { if (strokeW) ctx.strokeText(ln, spec.hardShadow.x * px, y + spec.hardShadow.y * px); ctx.fillText(ln, spec.hardShadow.x * px, y + spec.hardShadow.y * px); });
    }
    if (spec.glitch) {
      const o = spec.glitch.off * px * (1 + 0.6 * Math.sin(t * 9) * (opt.anim ? 1 : 0));
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = spec.glitch.c1; each((ln, y) => ctx.fillText(ln, -o, y - o * 0.3));
      ctx.fillStyle = spec.glitch.c2; each((ln, y) => ctx.fillText(ln, o, y + o * 0.3));
      ctx.globalCompositeOperation = 'source-over';
    }
    if (spec.shadow) {
      ctx.shadowColor = spec.shadow.color; ctx.shadowBlur = spec.shadow.blur * px;
      ctx.shadowOffsetX = spec.shadow.x * px; ctx.shadowOffsetY = spec.shadow.y * px;
      ctx.fillStyle = fillStyle || spec.shadow.color;
      if (spec.strokes && spec.strokes[0]) { ctx.strokeStyle = spec.strokes[0].color; ctx.lineWidth = spec.strokes[0].width * px; each((ln, y) => ctx.strokeText(ln, 0, y)); }
      else if (fillStyle) each((ln, y) => ctx.fillText(ln, 0, y));
      reset();
    }
    if (spec.glow) {
      ctx.shadowColor = spec.glow.color; ctx.shadowBlur = spec.glow.blur * px;
      ctx.strokeStyle = spec.glow.color; ctx.lineWidth = Math.max(2, (spec.strokes[0] ? spec.strokes[0].width : 0.04) * px);
      for (let p = 0; p < (spec.glow.passes || 1); p++) each((ln, y) => ctx.strokeText(ln, 0, y));
      reset();
    }
    if (spec.strokes) {
      [...spec.strokes].sort((a, b) => b.width - a.width).forEach((s) => {
        ctx.strokeStyle = s.color; ctx.lineWidth = s.width * px;
        each((ln, y) => ctx.strokeText(ln, 0, y));
      });
    }
    if (spec.emboss) {
      ctx.fillStyle = 'rgba(255,255,255,.7)'; each((ln, y) => ctx.fillText(ln, -px * 0.025, y - px * 0.025));
      ctx.fillStyle = 'rgba(0,0,0,.6)'; each((ln, y) => ctx.fillText(ln, px * 0.03, y + px * 0.03));
    }
    if (fillStyle) { ctx.fillStyle = fillStyle; each((ln, y) => ctx.fillText(ln, 0, y)); }
    ctx.globalAlpha = baseAlpha;
    return { w: boxW, h: boxH };
  };
})();
