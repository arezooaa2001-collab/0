/* Ladino — text animations: enter, exit and loop. Keyframes: t (0..1), o opacity, x/y offset (fraction of canvas),
   s scale, sx/sy stretch, r rotation (deg), b blur (fraction of font size), k skew (deg) */
(function () {
  const L = (window.L = window.L || {});

  const E = {
    linear: (t) => t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
    outBounce: (t) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; },
  };
  L.EASES = E;

  const IN = [
    { id: 'none', name: 'بدون', out: 'بدون', icon: '⏺', kf: [{ t: 0 }, { t: 1 }] },
    { id: 'fade', name: 'محو تدریجی', out: 'محو شدن', icon: '🌫', ease: 'outCubic', kf: [{ t: 0, o: 0 }, { t: 1, o: 1 }] },
    { id: 'slideUp', name: 'از پایین', out: 'به پایین', icon: '⬆', ease: 'outCubic', kf: [{ t: 0, o: 0, y: 0.12 }, { t: 1 }] },
    { id: 'slideDown', name: 'از بالا', out: 'به بالا', icon: '⬇', ease: 'outCubic', kf: [{ t: 0, o: 0, y: -0.12 }, { t: 1 }] },
    { id: 'slideRight', name: 'از راست', out: 'به راست', icon: '⬅', ease: 'outCubic', kf: [{ t: 0, o: 0, x: 0.25 }, { t: 1 }] },
    { id: 'slideLeft', name: 'از چپ', out: 'به چپ', icon: '➡', ease: 'outCubic', kf: [{ t: 0, o: 0, x: -0.25 }, { t: 1 }] },
    { id: 'zoomIn', name: 'بزرگ شدن', out: 'کوچک شدن', icon: '🔍', ease: 'outCubic', kf: [{ t: 0, o: 0, s: 0.2 }, { t: 1 }] },
    { id: 'zoomOut', name: 'از نزدیک', out: 'به دوربین', icon: '🎯', ease: 'outCubic', kf: [{ t: 0, o: 0, s: 3 }, { t: 1 }] },
    { id: 'pop', name: 'پاپ', out: 'ترکیدن', icon: '💥', kf: [{ t: 0, o: 0, s: 0 }, { t: 0.6, o: 1, s: 1.25 }, { t: 0.8, s: 0.92 }, { t: 1 }] },
    { id: 'bounce', name: 'پرش', out: 'پرش بیرون', icon: '🏀', ease: 'outBounce', kf: [{ t: 0, o: 0, y: -0.35 }, { t: 0.2, o: 1 }, { t: 1 }] },
    { id: 'drop', name: 'سقوط', out: 'افتادن', icon: '🪂', ease: 'outBack', kf: [{ t: 0, o: 0, y: -0.5, r: -12 }, { t: 1 }] },
    { id: 'rotateIn', name: 'چرخشی', out: 'چرخش بیرون', icon: '🔄', ease: 'outBack', kf: [{ t: 0, o: 0, r: -180, s: 0.3 }, { t: 1 }] },
    { id: 'spin', name: 'گردباد', out: 'گردباد بیرون', icon: '🌪', ease: 'outCubic', kf: [{ t: 0, o: 0, r: 720, s: 0 }, { t: 1 }] },
    { id: 'flipX', name: 'ورق افقی', out: 'ورق بسته', icon: '📖', ease: 'outBack', kf: [{ t: 0, o: 0, sx: 0 }, { t: 1 }] },
    { id: 'flipY', name: 'ورق عمودی', out: 'تا شدن', icon: '📜', ease: 'outBack', kf: [{ t: 0, o: 0, sy: 0 }, { t: 1 }] },
    { id: 'blurIn', name: 'از مه', out: 'در مه', icon: '☁', ease: 'outCubic', kf: [{ t: 0, o: 0, b: 0.5, s: 1.15 }, { t: 1 }] },
    { id: 'elastic', name: 'فنری', out: 'فنر بیرون', icon: '🪀', ease: 'outElastic', kf: [{ t: 0, o: 0, sx: 1.8, sy: 0.3 }, { t: 0.15, o: 1 }, { t: 1 }] },
    { id: 'swing', name: 'تاب', out: 'تاب بیرون', icon: '🎐', kf: [{ t: 0, o: 0, r: 40 }, { t: 0.4, o: 1, r: -18 }, { t: 0.7, r: 8 }, { t: 1 }] },
    { id: 'skew', name: 'کشیدگی', out: 'کش آمدن', icon: '💨', ease: 'outCubic', kf: [{ t: 0, o: 0, x: 0.2, k: -40 }, { t: 1 }] },
    { id: 'stamp', name: 'مهر', out: 'مهر بیرون', icon: '🔖', kf: [{ t: 0, o: 0, s: 3.2 }, { t: 0.55, o: 1, s: 0.95 }, { t: 0.7, s: 1.05, r: 2 }, { t: 0.85, r: -1 }, { t: 1 }] },
    { id: 'rise', name: 'طلوع', out: 'غروب', icon: '🌅', ease: 'outCubic', kf: [{ t: 0, o: 0, y: 0.06, b: 0.2, s: 0.9 }, { t: 1 }] },
    { id: 'unfold', name: 'باز شدن', out: 'جمع شدن', icon: '🪭', ease: 'outBack', kf: [{ t: 0, o: 0, sy: 0, sx: 1.4 }, { t: 1 }] },
    { id: 'typewriter', name: 'ماشین تحریر', out: 'پاک شدن حرفی', icon: '⌨', special: 'type', kf: [{ t: 0 }, { t: 1 }] },
    { id: 'glitchIn', name: 'گلیچی', out: 'گلیچ بیرون', icon: '📺', special: 'glitch', kf: [{ t: 0, o: 0 }, { t: 0.3, o: 1 }, { t: 1 }] },
    { id: 'flicker', name: 'روشن شدن نئون', out: 'خاموش شدن', icon: '💡', special: 'flicker', kf: [{ t: 0 }, { t: 1 }] },
  ];
  const LOOP = [
    { id: 'none', name: 'بدون', icon: '⏺', period: 1, kf: [{ t: 0 }, { t: 1 }] },
    { id: 'pulse', name: 'ضربان', icon: '💓', period: 1, ease: 'inOut', kf: [{ t: 0 }, { t: 0.5, s: 1.08 }, { t: 1 }] },
    { id: 'float', name: 'شناور', icon: '🎈', period: 3, ease: 'inOut', kf: [{ t: 0 }, { t: 0.5, y: -0.02 }, { t: 1 }] },
    { id: 'shake', name: 'لرزش', icon: '📳', period: 0.25, kf: [{ t: 0 }, { t: 0.25, x: 0.004, r: 1 }, { t: 0.5, x: -0.004 }, { t: 0.75, x: 0.003, r: -1 }, { t: 1 }] },
    { id: 'wobble', name: 'تلوتلو', icon: '🌀', period: 2, ease: 'inOut', kf: [{ t: 0, r: -4 }, { t: 0.5, r: 4 }, { t: 1, r: -4 }] },
    { id: 'heartbeat', name: 'قلب', icon: '❤', period: 1.2, kf: [{ t: 0 }, { t: 0.1, s: 1.12 }, { t: 0.2 }, { t: 0.3, s: 1.08 }, { t: 0.45 }, { t: 1 }] },
    { id: 'jelly', name: 'ژله‌ای', icon: '🍮', period: 1.1, ease: 'inOut', kf: [{ t: 0 }, { t: 0.3, sx: 1.12, sy: 0.9 }, { t: 0.6, sx: 0.94, sy: 1.08 }, { t: 1 }] },
    { id: 'blink', name: 'چشمک', icon: '✨', period: 1.4, kf: [{ t: 0 }, { t: 0.45 }, { t: 0.5, o: 0.25 }, { t: 0.55 }, { t: 1 }] },
    { id: 'spin', name: 'چرخش مداوم', icon: '♻', period: 4, kf: [{ t: 0, r: 0 }, { t: 1, r: 360 }] },
    { id: 'swing', name: 'آونگ', icon: '🕰', period: 2.2, ease: 'inOut', kf: [{ t: 0, r: 10 }, { t: 0.5, r: -10 }, { t: 1, r: 10 }] },
    { id: 'breath', name: 'نفس', icon: '🫧', period: 3.5, ease: 'inOut', kf: [{ t: 0, o: 1 }, { t: 0.5, o: 0.6, s: 0.97 }, { t: 1, o: 1 }] },
    { id: 'tilt', name: 'کج و راست', icon: '↗', period: 1.6, ease: 'inOut', kf: [{ t: 0, k: -6 }, { t: 0.5, k: 6 }, { t: 1, k: -6 }] },
  ];
  L.ANIM_IN = IN;
  L.ANIM_LOOP = LOOP;
  L.customAnims = []; // {id, name, kind:'in'|'out'|'loop', kf, ease, period}

  const DEF = { o: 1, x: 0, y: 0, s: 1, sx: 1, sy: 1, r: 0, b: 0, k: 0 };
  const KEYS = Object.keys(DEF);

  function sample(kf, p) {
    // fill keyframe defaults so each property interpolates independently
    const out = {};
    for (const key of KEYS) {
      let prev = null, next = null;
      for (const f of kf) {
        if (f[key] === undefined && f.t !== 0 && f.t !== 1) continue;
        const v = f[key] === undefined ? DEF[key] : f[key];
        if (f.t <= p) prev = { t: f.t, v };
        if (f.t >= p && !next) next = { t: f.t, v };
      }
      if (!prev) prev = next || { t: 0, v: DEF[key] };
      if (!next) next = prev;
      const span = next.t - prev.t;
      out[key] = span > 0 ? prev.v + (next.v - prev.v) * ((p - prev.t) / span) : prev.v;
    }
    return out;
  }

  L.findAnim = (kind, id) => {
    const c = L.customAnims.find((a) => a.id === id && (a.kind === kind || (kind !== 'loop' && a.kind !== 'loop')));
    if (c) return c;
    return (kind === 'loop' ? LOOP : IN).find((a) => a.id === id) || (kind === 'loop' ? LOOP[0] : IN[0]);
  };

  /** Animation state of a text layer at time t (seconds). */
  L.animState = function (layer, t) {
    const st = { ...DEF, visible: true, reveal: 1, jitter: 0 };
    if (t < layer.start || t > layer.end) { st.visible = false; return st; }
    const local = t - layer.start, remain = layer.end - t;
    const dur = Math.max(0.05, layer.end - layer.start);
    const inD = Math.min(layer.inDur, dur / 2), outD = Math.min(layer.outDur, dur / 2);
    const apply = (a) => { st.o *= a.o; st.x += a.x; st.y += a.y; st.s *= a.s; st.sx *= a.sx; st.sy *= a.sy; st.r += a.r; st.b += a.b; st.k += a.k; };
    const special = (anim, p) => {
      if (anim.special === 'type') st.reveal = Math.min(st.reveal, p);
      if (anim.special === 'glitch' && p < 1) st.jitter = Math.max(st.jitter, 1 - p);
      if (anim.special === 'flicker') { const f = p < 1 ? (Math.sin(p * 63) * Math.sin(p * 27) > 0.1 - p * 0.9 ? 1 : 0.12) : 1; st.o *= f; }
    };
    if (layer.inAnim !== 'none' && local < inD) {
      const a = L.findAnim('in', layer.inAnim);
      const raw = local / inD;
      const p = (E[a.ease] || E.linear)(raw);
      if (a.kind === 'out') apply(sample(a.kf, 1 - p)); else apply(sample(a.kf, p));
      special(a, raw);
    }
    if (layer.outAnim !== 'none' && remain < outD) {
      const a = L.findAnim('out', layer.outAnim);
      const raw = remain / outD; // 1 → 0 as it leaves
      const p = (E[a.ease] || E.linear)(raw);
      if (a.kind === 'out') apply(sample(a.kf, 1 - p)); else apply(sample(a.kf, p));
      special(a, raw);
    }
    if (layer.loopAnim && layer.loopAnim !== 'none') {
      const a = L.findAnim('loop', layer.loopAnim);
      const per = (a.period || 1) / Math.max(0.1, layer.loopSpeed || 1);
      const raw = (local / per) % 1;
      apply(sample(a.kf, (E[a.ease] || E.linear)(raw)));
    }
    return st;
  };

  L.sanitizeAnim = (a) => {
    const n = (v, lo, hi) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined; };
    const kf = (Array.isArray(a.keyframes || a.kf) ? a.keyframes || a.kf : []).slice(0, 16).map((f) => {
      const o = { t: n(f.t, 0, 1) ?? 0 };
      const lim = { o: [0, 1], x: [-1.5, 1.5], y: [-1.5, 1.5], s: [0, 8], sx: [0, 8], sy: [0, 8], r: [-1440, 1440], b: [0, 2], k: [-80, 80] };
      for (const k in lim) { const v = n(f[k], lim[k][0], lim[k][1]); if (v !== undefined) o[k] = v; }
      return o;
    }).sort((p, q) => p.t - q.t);
    if (!kf.length || kf[0].t !== 0) kf.unshift({ t: 0 });
    if (kf[kf.length - 1].t !== 1) kf.push({ t: 1 });
    return {
      kind: ['in', 'out', 'loop'].includes(a.kind) ? a.kind : 'in',
      ease: E[a.ease] ? a.ease : 'outCubic',
      period: n(a.period, 0.1, 20) ?? 1.5,
      kf,
    };
  };
})();
