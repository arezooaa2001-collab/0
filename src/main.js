/* Ladino — editor core: state, WebGL renderer, text layers & gestures, timeline, audio graph, export */
(function () {
  const L = window.L;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const fa = (v) => String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const uid = (p) => p + Math.random().toString(36).slice(2, 9);
  const fmt = (t) => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = t - m * 60; return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`; };
  L.fa = fa;

  // ---------- toast ----------
  L.toast = (msg, ms = 2600) => {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    $('#toasts').append(el);
    setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 450); }, ms);
  };

  // ---------- state ----------
  const S = (L.state = {
    hasVideo: false,
    video: { name: 'ویدیوی نمونه', file: null, assetId: null, w: 1280, h: 720 },
    effects: [], // {id, amt}
    adjust: { bright: 0, contrast: 1, sat: 1, temp: 0 },
    xf: { rot: 0, flipX: false, flipY: false, zoom: 1 },
    ratio: 'original', fit: 'contain', bgBlur: true,
    trim: { start: 0, end: 12 },
    speed: 1, vol: 1, mute: false, loop: true,
    texts: [],
    selected: null,
    quality: 1280,
    audio: { buf: null, cleaned: null, segments: [], compare: false, decoding: false },
  });
  L.customEffects = [];

  const video = $('#video');
  video.hidden = false;
  Object.assign(video.style, { position: 'fixed', width: '4px', height: '4px', opacity: '0', pointerEvents: 'none', left: '0', bottom: '0' });
  const view = $('#view');
  const ctx = view.getContext('2d');

  // ---------- demo source (shown before a video is uploaded) ----------
  const demoCv = document.createElement('canvas');
  demoCv.width = 1280; demoCv.height = 720;
  const dctx = demoCv.getContext('2d');
  const demo = { t: 0, playing: true, dur: 12, last: performance.now() };
  function drawDemo(t) {
    const W = demoCv.width, H = demoCv.height;
    const g = dctx.createLinearGradient(0, 0, 0, H);
    const h = (t * 12) % 360;
    g.addColorStop(0, `hsl(${(h + 250) % 360} 70% 22%)`); g.addColorStop(0.55, `hsl(${(h + 320) % 360} 80% 55%)`); g.addColorStop(1, `hsl(${(h + 30) % 360} 95% 62%)`);
    dctx.fillStyle = g; dctx.fillRect(0, 0, W, H);
    // sun
    const sy = H * 0.62 - Math.sin(t * 0.4) * 40;
    const sg = dctx.createRadialGradient(W * 0.5, sy, 10, W * 0.5, sy, 210);
    sg.addColorStop(0, '#fff8d0'); sg.addColorStop(0.35, '#ffd25e'); sg.addColorStop(1, 'rgba(255,120,80,0)');
    dctx.fillStyle = sg; dctx.beginPath(); dctx.arc(W * 0.5, sy, 210, 0, Math.PI * 2); dctx.fill();
    // mountains
    for (let k = 0; k < 3; k++) {
      dctx.fillStyle = `hsla(${(h + 260 + k * 20) % 360} 50% ${12 + k * 7}% / ${0.75 + k * 0.08})`;
      dctx.beginPath(); dctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 20) dctx.lineTo(x, H * (0.62 + k * 0.1) + Math.sin(x * 0.006 + k * 2 + t * 0.15 * (k + 1)) * 40 + Math.sin(x * 0.017 + k) * 14);
      dctx.lineTo(W, H); dctx.fill();
    }
    // floating bubbles
    for (let i = 0; i < 18; i++) {
      const x = ((i * 137 + t * (20 + (i % 5) * 9)) % (W + 80)) - 40;
      const y = H * 0.15 + ((i * 89) % (H * 0.45)) + Math.sin(t + i) * 18;
      dctx.fillStyle = `hsla(${(i * 40 + h) % 360} 100% 75% / .35)`;
      dctx.beginPath(); dctx.arc(x, y, 6 + (i % 4) * 5, 0, Math.PI * 2); dctx.fill();
    }
    // a bird-ish swooping shape
    const bx = ((t * 110) % (W + 200)) - 100, by = H * 0.3 + Math.sin(t * 1.3) * 60;
    dctx.strokeStyle = 'rgba(20,10,40,.8)'; dctx.lineWidth = 6; dctx.lineCap = 'round';
    const wv = Math.sin(t * 8) * 16;
    dctx.beginPath(); dctx.moveTo(bx - 34, by - wv); dctx.quadraticCurveTo(bx - 14, by - 14, bx, by); dctx.quadraticCurveTo(bx + 14, by - 14, bx + 34, by - wv); dctx.stroke();
  }

  const src = {
    get time() { return S.hasVideo ? video.currentTime : demo.t; },
    get dur() { return S.hasVideo ? video.duration || 0 : demo.dur; },
    get paused() { return S.hasVideo ? video.paused : !demo.playing; },
    play() {
      ensureAudio(); if (AC && AC.state === 'suspended') AC.resume();
      if (this.time >= S.trim.end - 0.05 || this.time < S.trim.start) this.seek(S.trim.start);
      if (S.hasVideo) video.play().catch(() => {}); else { demo.playing = true; demo.last = performance.now(); }
      syncClean(); updatePlayBtn();
    },
    pause() { if (S.hasVideo) video.pause(); else demo.playing = false; stopClean(); updatePlayBtn(); },
    seek(t) { t = clamp(t, 0, this.dur || 0); if (S.hasVideo) video.currentTime = t; else demo.t = t; syncClean(); },
    toggle() { this.paused ? this.play() : this.pause(); },
  };
  L.src = src;
  video.addEventListener('play', () => { syncClean(); updatePlayBtn(); });
  video.addEventListener('pause', () => { stopClean(); updatePlayBtn(); });
  video.addEventListener('seeked', () => syncClean());

  // ---------- audio graph ----------
  let AC = null, master = null, monitor = null, recDest = null, vidGain = null, cleanGain = null, mediaNode = null, cleanSrc = null, cleanStart = 0, cleanOffset = 0, clipSrc = null;
  function ensureAudio() {
    if (AC) return AC;
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); monitor = AC.createGain();
      master.connect(monitor); monitor.connect(AC.destination);
      recDest = AC.createMediaStreamDestination(); master.connect(recDest);
      vidGain = AC.createGain(); vidGain.connect(master);
      cleanGain = AC.createGain(); cleanGain.connect(master);
      try { mediaNode = AC.createMediaElementSource(video); mediaNode.connect(vidGain); } catch (e) { mediaNode = null; }
      applyVolume();
    } catch (e) { AC = null; }
    return AC;
  }
  L.ensureAudio = ensureAudio;
  function applyVolume() {
    const v = S.mute ? 0 : S.vol;
    if (master) master.gain.value = v; else { video.volume = clamp(v, 0, 1); video.muted = S.mute; }
    const useClean = !!(S.audio.cleaned && !S.audio.compare);
    if (vidGain) vidGain.gain.value = useClean ? 0 : 1;
    $('#muteBtn').textContent = S.mute ? '🔇' : '🔊';
  }
  function stopClean() { if (cleanSrc) { try { cleanSrc.stop(); } catch (e) {} cleanSrc.disconnect(); cleanSrc = null; } }
  function syncClean() {
    stopClean();
    applyVolume();
    if (!AC || !S.hasVideo || !S.audio.cleaned || S.audio.compare || video.paused) return;
    cleanSrc = AC.createBufferSource();
    cleanSrc.buffer = S.audio.cleaned;
    cleanSrc.playbackRate.value = S.speed;
    cleanSrc.connect(cleanGain);
    cleanOffset = video.currentTime; cleanStart = AC.currentTime;
    cleanSrc.start(0, clamp(cleanOffset, 0, S.audio.cleaned.duration));
  }
  L.syncClean = syncClean;
  L.applyVolume = applyVolume;
  /** Play a slice of a buffer for previewing (pauses the video). */
  L.playClip = (buf, start, dur, onEnd) => {
    ensureAudio(); if (!AC) return;
    if (AC.state === 'suspended') AC.resume();
    L.stopClip(); src.pause();
    clipSrc = AC.createBufferSource(); clipSrc.buffer = buf; clipSrc.connect(master);
    clipSrc.onended = () => { clipSrc = null; onEnd && onEnd(); };
    clipSrc.start(0, start, dur);
    src.seek(start);
  };
  L.stopClip = () => { if (clipSrc) { const c = clipSrc; clipSrc = null; c.onended = null; try { c.stop(); } catch (e) {} } };

  // ---------- WebGL renderer ----------
  const glc = document.createElement('canvas');
  const gl = glc.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, alpha: false, antialias: false });
  L.gl = gl;
  const VS = 'attribute vec2 a_pos; varying vec2 v_uv; void main(){ v_uv = a_pos*0.5+0.5; gl_Position = vec4(a_pos,0.0,1.0); }';
  const BASE_FS = `precision highp float; varying vec2 v_uv;
uniform sampler2D u_video; uniform vec2 u_vres, u_ores; uniform float u_cover, u_zoom, u_rot, u_bg;
uniform vec2 u_flip; uniform float u_bright, u_contrast, u_sat, u_temp;
vec2 mapUV(vec2 uv, float cover){
  vec2 p = (uv-0.5)*u_ores; p /= u_zoom;
  float c = cos(-u_rot), s = sin(-u_rot); p = vec2(c*p.x - s*p.y, s*p.x + c*p.y);
  vec2 vr = abs(cos(u_rot)) > 0.5 ? u_vres : u_vres.yx;
  float sc = cover > 0.5 ? max(u_ores.x/vr.x, u_ores.y/vr.y) : min(u_ores.x/vr.x, u_ores.y/vr.y);
  vec2 v = p/sc/u_vres + 0.5; return mix(v, 1.0-v, u_flip); }
vec3 grade(vec3 c){ c += u_bright; c = (c-0.5)*u_contrast+0.5; float l = dot(c, vec3(0.299,0.587,0.114)); c = mix(vec3(l), c, u_sat);
  c += vec3(0.08, 0.0, -0.08)*u_temp; return clamp(c, 0.0, 1.0); }
void main(){
  vec2 v = mapUV(v_uv, u_cover);
  vec3 col;
  if (v.x >= 0.0 && v.x <= 1.0 && v.y >= 0.0 && v.y <= 1.0) col = texture2D(u_video, v).rgb;
  else if (u_bg > 0.5) { vec2 b = mapUV(v_uv, 1.0); vec3 acc = vec3(0.0);
    for (int i=-2;i<=2;i++) for (int j=-2;j<=2;j++) acc += texture2D(u_video, clamp(b + vec2(float(i),float(j))*0.018, 0.0, 1.0)).rgb;
    col = acc/25.0*0.55; }
  else col = vec3(0.0);
  gl_FragColor = vec4(grade(col), 1.0); }`;

  let quad, baseProg, videoTex;
  const progCache = new Map();
  const targets = new Map();
  function compile(type, srcTxt) {
    const s = gl.createShader(type); gl.shaderSource(s, srcTxt); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(log || 'compile error'); }
    return s;
  }
  function link(fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'a_pos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link error');
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  function mkTex() {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function getTargets(w, h) {
    const key = w + 'x' + h;
    if (targets.has(key)) return targets.get(key);
    const pair = [0, 1].map(() => {
      const tex = mkTex(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fb };
    });
    if (targets.size > 6) { for (const [k, v] of targets) { if (k !== key) { v.forEach((t) => { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }); targets.delete(k); break; } } }
    targets.set(key, pair);
    return pair;
  }
  L.allEffects = () => [...L.EFFECTS, ...L.customEffects];
  L.effectById = (id) => L.allEffects().find((e) => e.id === id);
  function effectProgram(fx) {
    if (progCache.has(fx.id)) return progCache.get(fx.id);
    let r;
    try { r = link(L.FX_PRELUDE + '\n' + fx.glsl + '\n' + L.FX_MAIN); } catch (e) { r = { error: String(e.message || e) }; }
    progCache.set(fx.id, r);
    return r;
  }
  /** Try compiling GLSL for an AI effect; returns error text or null */
  L.tryCompileEffect = (glsl) => { if (!gl) return 'WebGL در این مرورگر فعال نیست'; try { const r = link(L.FX_PRELUDE + '\n' + glsl + '\n' + L.FX_MAIN); gl.deleteProgram(r.p); return null; } catch (e) { return String(e.message || e); } };
  L.dropProgram = (id) => { const r = progCache.get(id); if (r && r.p) gl.deleteProgram(r.p); progCache.delete(id); };

  if (gl) {
    quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    baseProg = link(BASE_FS);
    videoTex = mkTex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  }

  const srcDims = () => (S.hasVideo ? [video.videoWidth || 1280, video.videoHeight || 720] : [demoCv.width, demoCv.height]);
  function uploadFrame() {
    if (!gl) return false;
    const el = S.hasVideo ? video : demoCv;
    if (S.hasVideo && video.readyState < 2) return false;
    gl.bindTexture(gl.TEXTURE_2D, videoTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el); } catch (e) { return false; }
    return true;
  }
  /** Render source + base grade + effect chain at w×h. toScreen draws into glc's backbuffer. */
  function renderGL(w, h, fxList, time, toScreen) {
    const T = getTargets(w, h);
    const [vw, vh] = srcDims();
    const passes = fxList.map((e) => ({ e, fx: L.effectById(e.id) })).filter((x) => x.fx).map((x) => ({ amt: x.e.amt, prog: effectProgram(x.fx) })).filter((x) => x.prog && x.prog.p);
    gl.viewport(0, 0, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, passes.length || !toScreen ? T[0].fb : null);
    const bu = baseProg.u;
    gl.useProgram(baseProg.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, videoTex);
    gl.uniform1i(bu.u_video, 0);
    gl.uniform2f(bu.u_vres, vw, vh); gl.uniform2f(bu.u_ores, w, h);
    gl.uniform1f(bu.u_cover, S.fit === 'cover' ? 1 : 0); gl.uniform1f(bu.u_zoom, S.xf.zoom);
    gl.uniform1f(bu.u_rot, (S.xf.rot * Math.PI) / 180); gl.uniform1f(bu.u_bg, S.bgBlur ? 1 : 0);
    gl.uniform2f(bu.u_flip, S.xf.flipX ? 1 : 0, S.xf.flipY ? 1 : 0);
    gl.uniform1f(bu.u_bright, S.adjust.bright); gl.uniform1f(bu.u_contrast, S.adjust.contrast);
    gl.uniform1f(bu.u_sat, S.adjust.sat); gl.uniform1f(bu.u_temp, S.adjust.temp);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    let read = 0;
    passes.forEach((ps, i) => {
      const last = i === passes.length - 1;
      const write = 1 - read;
      gl.bindFramebuffer(gl.FRAMEBUFFER, last && toScreen ? null : T[write].fb);
      gl.useProgram(ps.prog.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T[read].tex);
      const u = ps.prog.u;
      gl.uniform1i(u.u_tex, 0);
      if (u.u_res) gl.uniform2f(u.u_res, w, h);
      if (u.u_time) gl.uniform1f(u.u_time, time);
      if (u.u_amt) gl.uniform1f(u.u_amt, ps.amt);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      read = write;
    });
    return toScreen ? null : passes.length ? T[read].fb : T[0].fb;
  }

  // ---------- output size ----------
  function outSize(q) {
    const [vw0, vh0] = srcDims();
    let vw = vw0, vh = vh0;
    if (S.xf.rot % 180 !== 0) [vw, vh] = [vh, vw];
    let ar = vw / vh;
    if (S.ratio !== 'original') { const [a, b] = S.ratio.split(':').map(Number); ar = a / b; }
    const long = q || S.quality;
    let W, H;
    if (ar >= 1) { W = long; H = long / ar; } else { H = long; W = long * ar; }
    return [Math.round(W / 2) * 2, Math.round(H / 2) * 2];
  }
  function resize(q) {
    const [W, H] = outSize(q);
    if (view.width !== W || view.height !== H) { view.width = W; view.height = H; }
    if (glc.width !== W || glc.height !== H) { glc.width = W; glc.height = H; }
    fitView();
  }
  L.resize = resize;
  function fitView() {
    const wrapEl = view.parentElement;
    const ar = view.width / view.height;
    if (window.innerWidth <= 980) {
      // phones: the stage takes the height the video needs, capped so the tools stay reachable
      const w0 = wrapEl.getBoundingClientRect().width;
      let w = w0, h = w / ar;
      const maxH = window.innerHeight * 0.58;
      if (h > maxH) { h = maxH; w = h * ar; }
      wrapEl.style.height = Math.floor(h) + 'px';
      view.style.width = Math.floor(w) + 'px'; view.style.height = Math.floor(h) + 'px';
      return;
    }
    wrapEl.style.height = '';
    const wrap = wrapEl.getBoundingClientRect();
    let w = wrap.width, h = w / ar;
    if (h > wrap.height) { h = wrap.height; w = h * ar; }
    view.style.width = Math.floor(w) + 'px'; view.style.height = Math.floor(h) + 'px';
  }
  window.addEventListener('resize', () => { fitView(); drawTimeline(); });
  new ResizeObserver(() => fitView()).observe($('#stage'));

  // ---------- text layers ----------
  const specCache = new Map();
  function layerSpec(ly) {
    const key = `${ly.styleId}|${ly.font}|${ly.custom ? [ly.c1, ly.c2, ly.c3, ly.grad].join() : ''}|${L.customStyles.length}`;
    if (ly._sk === key && ly._spec) return ly._spec;
    const base = L.styleInfo(ly.styleId).spec;
    const spec = JSON.parse(JSON.stringify(base));
    if (ly.font !== '' && ly.font != null && L.FONTS[ly.font]) { const f = L.FONTS[ly.font]; spec.font = { fam: f.fam, w: f.w, lh: f.lh }; }
    if (ly.custom) {
      spec.fill = ly.grad ? { type: 'linear', colors: [ly.c1, ly.c2], angle: 90 } : { type: 'solid', colors: [ly.c1] };
      if (spec.strokes && spec.strokes.length) spec.strokes[spec.strokes.length > 1 ? 1 : 0].color = ly.c3; else spec.strokes = [{ color: ly.c3, width: 0.06 }];
      if (spec.glow) spec.glow.color = ly.c2;
    }
    ly._sk = key; ly._spec = spec;
    return spec;
  }
  L.newLayer = (o = {}) => {
    const t = src.time;
    const ly = Object.assign({
      id: uid('t'), text: 'متن شما', styleId: 63, font: '', size: 90, x: 0.5, y: 0.5, rot: 0, scale: 1, opacity: 1,
      start: Math.max(S.trim.start, Math.min(t, S.trim.end - 1)), end: S.trim.end,
      inAnim: 'pop', inDur: 0.8, outAnim: 'fade', outDur: 0.6, loopAnim: 'none', loopSpeed: 1,
      custom: false, c1: '#ff4fd8', c2: '#5ce1ff', c3: '#1a0033', grad: true,
    }, o);
    if (ly.end - ly.start < 0.3) { ly.start = S.trim.start; ly.end = S.trim.end; }
    S.texts.push(ly);
    return ly;
  };
  function drawLayer(c, ly, W, H, t) {
    const st = L.animState(ly, t);
    ly._vis = st.visible && st.o > 0.002;
    const spec = layerSpec(ly);
    const px = (ly.size * H) / 1000;
    if (!ly._box || ly._bt !== ly.text + px + ly._sk) { c.save(); ly._box = measure(c, ly.text, spec, px); c.restore(); ly._bt = ly.text + px + ly._sk; }
    if (!ly._vis) return;
    let text = ly.text;
    if (st.reveal < 1) { const chars = Array.from(text); text = chars.slice(0, Math.ceil(chars.length * st.reveal)).join(''); if (!text) return; }
    c.save();
    let jx = 0, jy = 0;
    if (st.jitter > 0) { jx = (Math.random() - 0.5) * 0.04 * W * st.jitter; jy = (Math.random() - 0.5) * 0.02 * H * st.jitter; }
    c.translate((ly.x + st.x) * W + jx, (ly.y + st.y) * H + jy);
    c.rotate(((ly.rot + st.r) * Math.PI) / 180);
    if (st.k) c.transform(1, 0, Math.tan((st.k * Math.PI) / 180), 1, 0, 0);
    c.scale(ly.scale * st.s * st.sx || 0.0001, ly.scale * st.s * st.sy || 0.0001);
    c.globalAlpha = clamp(st.o * ly.opacity, 0, 1);
    if (st.b > 0.01 && 'filter' in c) c.filter = `blur(${(st.b * px).toFixed(1)}px)`;
    L.drawStyledText(c, text, spec, px, t, { anim: true });
    if (st.jitter > 0) {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha *= 0.6;
      c.translate((Math.random() - 0.5) * px * 0.2, 0);
      L.drawStyledText(c, text, { ...spec, fill: { type: 'solid', colors: ['#ff00d4'] }, strokes: [], glow: null, shadow: null, bg: null, extrude: null, longShadow: null }, px, t);
    }
    c.restore();
  }
  function measure(c, text, spec, px) {
    c.font = L.fontCss(spec.font, px);
    const lines = String(text).split('\n');
    let w = 0; for (const l of lines) w = Math.max(w, c.measureText(l).width);
    const sw = spec.strokes && spec.strokes.length ? Math.max(...spec.strokes.map((s) => s.width)) * px : 0;
    const pad = spec.bg ? (spec.bg.pad || 0.3) * px * 2 : 0;
    return { w: w + sw + pad, h: px * (spec.font.lh || 1.35) * lines.length + (spec.bg ? (spec.bg.pad || 0.3) * px * 1.2 : 0) };
  }
  function handleR() { const r = view.getBoundingClientRect(); return (14 * view.width) / Math.max(1, r.width); }
  function drawSelection(c, ly, W, H) {
    if (!ly._box) return;
    const hr = handleR();
    c.save();
    c.translate(ly.x * W, ly.y * H); c.rotate((ly.rot * Math.PI) / 180);
    const w = ly._box.w * ly.scale + hr, h = ly._box.h * ly.scale + hr * 0.6;
    c.setLineDash([hr * 0.6, hr * 0.4]); c.lineWidth = hr * 0.16; c.strokeStyle = 'rgba(255,255,255,.95)';
    c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = hr * 0.4;
    c.strokeRect(-w / 2, -h / 2, w, h);
    c.setLineDash([]);
    const dot = (x, y, bg, label) => {
      c.beginPath(); c.arc(x, y, hr, 0, Math.PI * 2); c.fillStyle = bg; c.fill();
      c.lineWidth = hr * 0.14; c.strokeStyle = '#fff'; c.stroke();
      c.shadowBlur = 0; c.fillStyle = '#fff'; c.font = `900 ${hr * 1.1}px Vazirmatn, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, x, y + hr * 0.05);
    };
    c.beginPath(); c.moveTo(0, -h / 2); c.lineTo(0, -h / 2 - hr * 2.2); c.lineWidth = hr * 0.14; c.strokeStyle = '#fff'; c.stroke();
    dot(-w / 2, -h / 2, '#ff4f7b', '×');
    dot(w / 2, h / 2, '#7a5cff', '⤡');
    dot(0, -h / 2 - hr * 2.2, '#11b7d9', '⟳');
    c.restore();
  }

  // ---------- main loop ----------
  let exporting = null;
  let lastFrame = performance.now(), driftCheck = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
    if (!S.hasVideo) {
      if (demo.playing) demo.t += dt * S.speed;
      drawDemo(demo.t);
    }
    const t = src.time;
    // trim / loop
    if (!src.paused && t >= S.trim.end) {
      if (exporting) exporting.finish();
      else if (S.loop) src.seek(S.trim.start);
      else src.pause();
    }
    if (!src.paused && t < S.trim.start - 0.2 && !exporting) src.seek(S.trim.start);
    // clean audio drift correction
    if (cleanSrc && now - driftCheck > 1000) {
      driftCheck = now;
      const expect = cleanOffset + (AC.currentTime - cleanStart) * S.speed;
      if (Math.abs(expect - video.currentTime) > 0.2) syncClean();
    }
    const W = view.width, H = view.height;
    if (gl) {
      uploadFrame();
      renderGL(W, H, S.effects, t, true);
      ctx.drawImage(glc, 0, 0);
    } else {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const el = S.hasVideo ? video : demoCv; const [vw, vh] = srcDims();
      const sc = S.fit === 'cover' ? Math.max(W / vw, H / vh) : Math.min(W / vw, H / vh);
      try { ctx.drawImage(el, (W - vw * sc) / 2, (H - vh * sc) / 2, vw * sc, vh * sc); } catch (e) {}
    }
    for (const ly of S.texts) drawLayer(ctx, ly, W, H, t);
    if (!exporting) { const sel = S.texts.find((x) => x.id === S.selected); if (sel) drawSelection(ctx, sel, W, H); }
    if (exporting) exporting.tick(t);
    updateClock(t);
    requestAnimationFrame(frame);
  }

  // ---------- gestures on the stage ----------
  const ptrs = new Map();
  let gesture = null;
  function canvasPt(e) { const r = view.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * view.width, y: ((e.clientY - r.top) / r.height) * view.height }; }
  function toLocal(ly, p) {
    const W = view.width, H = view.height;
    let dx = p.x - ly.x * W, dy = p.y - ly.y * H;
    const a = (-ly.rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  }
  function hitLayer(p) {
    const t = src.time;
    for (let i = S.texts.length - 1; i >= 0; i--) {
      const ly = S.texts[i];
      if (!ly._box || (t < ly.start || t > ly.end) && ly.id !== S.selected) continue;
      const q = toLocal(ly, p), pad = handleR() * 0.6;
      if (Math.abs(q.x) <= (ly._box.w * ly.scale) / 2 + pad && Math.abs(q.y) <= (ly._box.h * ly.scale) / 2 + pad) return ly;
    }
    return null;
  }
  function hitHandle(ly, p) {
    if (!ly || !ly._box) return null;
    const hr = handleR(), q = toLocal(ly, p);
    const w = ly._box.w * ly.scale + hr, h = ly._box.h * ly.scale + hr * 0.6;
    const near = (x, y) => Math.hypot(q.x - x, q.y - y) <= hr * 1.5;
    if (near(-w / 2, -h / 2)) return 'del';
    if (near(w / 2, h / 2)) return 'scale';
    if (near(0, -h / 2 - hr * 2.2)) return 'rotate';
    return null;
  }
  const selLayer = () => S.texts.find((x) => x.id === S.selected);
  function startPinch() {
    const ly = selLayer(); const ps = [...ptrs.values()];
    if (!ly || ps.length < 2) { gesture = null; return; }
    const [a, b] = ps;
    gesture = { mode: 'pinch', ly, d0: Math.hypot(b.x - a.x, b.y - a.y), a0: Math.atan2(b.y - a.y, b.x - a.x), m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, s0: ly.scale, r0: ly.rot, x0: ly.x, y0: ly.y };
  }
  view.addEventListener('pointerdown', (e) => {
    view.setPointerCapture(e.pointerId);
    const p = canvasPt(e);
    ptrs.set(e.pointerId, p);
    if (ptrs.size === 2) { startPinch(); return; }
    if (ptrs.size > 2) return;
    const sel = selLayer();
    const h = hitHandle(sel, p);
    if (h === 'del') { removeText(sel.id); return; }
    if (h) {
      const c = { x: sel.x * view.width, y: sel.y * view.height };
      gesture = { mode: h, ly: sel, c, d0: Math.hypot(p.x - c.x, p.y - c.y), a0: Math.atan2(p.y - c.y, p.x - c.x), s0: sel.scale, r0: sel.rot };
      return;
    }
    const ly = hitLayer(p);
    if (ly) {
      select(ly.id);
      gesture = { mode: 'move', ly, p0: p, x0: ly.x, y0: ly.y, moved: false };
      view.classList.add('dragging');
    } else {
      gesture = { mode: 'tap', p0: p };
    }
  });
  view.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    const p = canvasPt(e);
    ptrs.set(e.pointerId, p);
    if (!gesture) return;
    const W = view.width, H = view.height, g = gesture;
    if (g.mode === 'pinch' && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      g.ly.scale = clamp((g.s0 * d) / Math.max(1, g.d0), 0.1, 12);
      g.ly.rot = snapRot(g.r0 + ((ang - g.a0) * 180) / Math.PI);
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      g.ly.x = clamp(g.x0 + (m.x - g.m0.x) / W, -0.2, 1.2); g.ly.y = clamp(g.y0 + (m.y - g.m0.y) / H, -0.2, 1.2);
      syncTextEditor();
    } else if (g.mode === 'move') {
      let nx = g.x0 + (p.x - g.p0.x) / W, ny = g.y0 + (p.y - g.p0.y) / H;
      if (Math.abs(nx - 0.5) < 0.012) nx = 0.5;
      if (Math.abs(ny - 0.5) < 0.012) ny = 0.5;
      g.ly.x = clamp(nx, -0.2, 1.2); g.ly.y = clamp(ny, -0.2, 1.2); g.moved = true;
    } else if (g.mode === 'scale') {
      const d = Math.hypot(p.x - g.c.x, p.y - g.c.y), ang = Math.atan2(p.y - g.c.y, p.x - g.c.x);
      g.ly.scale = clamp((g.s0 * d) / Math.max(1, g.d0), 0.1, 12);
      g.ly.rot = snapRot(g.r0 + ((ang - g.a0) * 180) / Math.PI);
      syncTextEditor();
    } else if (g.mode === 'rotate') {
      const ang = Math.atan2(p.y - g.c.y, p.x - g.c.x);
      g.ly.rot = snapRot(g.r0 + ((ang - g.a0) * 180) / Math.PI);
      syncTextEditor();
    }
  });
  function snapRot(r) { r = ((r + 540) % 360) - 180; for (const s of [-180, -90, 0, 90, 180]) if (Math.abs(r - s) < 3) return s; return Math.round(r * 10) / 10; }
  function endPtr(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    view.classList.remove('dragging');
    if (gesture && gesture.mode === 'tap' && ptrs.size === 0) { if (S.selected) select(null); else src.toggle(); }
    if (gesture && gesture.mode !== 'tap') commit();
    if (ptrs.size === 1 && gesture && gesture.mode === 'pinch') {
      const ly = gesture.ly, p = [...ptrs.values()][0];
      gesture = { mode: 'move', ly, p0: p, x0: ly.x, y0: ly.y };
    } else if (ptrs.size === 0) gesture = null;
  }
  view.addEventListener('pointerup', endPtr);
  view.addEventListener('pointercancel', endPtr);
  view.addEventListener('dblclick', (e) => { const ly = hitLayer(canvasPt(e)); if (ly) { select(ly.id); go('text'); setTimeout(() => $('#txtBody').focus(), 50); } });
  let wheelT = 0;
  view.addEventListener('wheel', (e) => {
    const ly = selLayer(); if (!ly) return;
    e.preventDefault();
    if (e.shiftKey || e.altKey) ly.rot = snapRot(ly.rot + e.deltaY * 0.15);
    else ly.scale = clamp(ly.scale * Math.exp(-e.deltaY * 0.0015), 0.1, 12);
    syncTextEditor();
    clearTimeout(wheelT); wheelT = setTimeout(commit, 300);
  }, { passive: false });
  document.addEventListener('keydown', (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    const typing = /INPUT|TEXTAREA|SELECT/.test(tag);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { if (typing) return; e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { if (typing) return; e.preventDefault(); redo(); return; }
    if (typing) return;
    const ly = selLayer();
    if (e.code === 'Space') { e.preventDefault(); src.toggle(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && ly) { removeText(ly.id); }
    else if (ly && e.key.startsWith('Arrow')) {
      e.preventDefault(); const st = e.shiftKey ? 0.02 : 0.004;
      if (e.key === 'ArrowLeft') ly.x -= st; if (e.key === 'ArrowRight') ly.x += st; if (e.key === 'ArrowUp') ly.y -= st; if (e.key === 'ArrowDown') ly.y += st;
      clearTimeout(wheelT); wheelT = setTimeout(commit, 400);
    }
  });

  // ---------- history ----------
  const hist = { stack: [], i: -1, lock: false };
  const snap = () => JSON.stringify({ effects: S.effects, adjust: S.adjust, xf: S.xf, ratio: S.ratio, fit: S.fit, bgBlur: S.bgBlur, trim: S.trim, speed: S.speed, texts: S.texts.map(cleanLayer) });
  function cleanLayer(l) { const o = {}; for (const k in l) if (k[0] !== '_') o[k] = l[k]; return o; }
  L.cleanLayer = cleanLayer;
  function commit() {
    if (hist.lock) return;
    const s = snap();
    if (hist.stack[hist.i] === s) return;
    hist.stack = hist.stack.slice(0, hist.i + 1); hist.stack.push(s);
    if (hist.stack.length > 80) hist.stack.shift();
    hist.i = hist.stack.length - 1;
    updateUndo();
    L.onChange && L.onChange();
  }
  L.commit = commit;
  function restore(s) {
    const d = JSON.parse(s);
    hist.lock = true;
    Object.assign(S, { effects: d.effects, adjust: d.adjust, xf: d.xf, ratio: d.ratio, fit: d.fit, bgBlur: d.bgBlur, trim: d.trim, speed: d.speed, texts: d.texts });
    if (!S.texts.find((x) => x.id === S.selected)) S.selected = null;
    refreshAll();
    hist.lock = false;
  }
  function undo() { if (hist.i > 0) { hist.i--; restore(hist.stack[hist.i]); updateUndo(); L.toast('برگشت ↶'); } }
  function redo() { if (hist.i < hist.stack.length - 1) { hist.i++; restore(hist.stack[hist.i]); updateUndo(); L.toast('جلو ↷'); } }
  function updateUndo() { $('#undoBtn').disabled = hist.i <= 0; $('#redoBtn').disabled = hist.i >= hist.stack.length - 1; }
  $('#undoBtn').onclick = undo; $('#redoBtn').onclick = redo;

  // ---------- navigation ----------
  const VIEWS = {
    media: ['ویدیو', 'آپلود، برش و قاب'], fx: ['جلوه‌ها', `${fa(L.EFFECTS.length)} جلوه زنده`], text: ['متن', `${fa(L.STYLE_COUNT)} استایل خفن`],
    anim: ['حرکت متن', 'چطور بیاید، چطور برود'], audio: ['صدا', 'حذف صداهای مزاحم'], ai: ['هوش مصنوعی', 'دستیار خلاق لادینو'],
    cloud: ['فضای ابری', 'پروژه‌ها و خروجی‌ها'], export: ['خروجی', 'ساخت ویدیوی نهایی'],
  };
  function go(v) {
    $$('#rail button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    $$('.view').forEach((s) => s.classList.toggle('active', s.id === 'v-' + v));
    $('#panelTitle').textContent = VIEWS[v][0]; $('#panelSub').textContent = VIEWS[v][1];
    if (v === 'fx') renderFxThumbsSoon();
    if (v === 'text') { renderStyles(); }
    if (v === 'anim') renderAnimPanel();
    if (v === 'export') updateExportInfo();
    if (v === 'audio') L.audioUI && L.audioUI.redraw();
    try { localStorage.setItem('ladino.view', v); } catch (e) {}
  }
  L.go = go;
  $('#rail').addEventListener('click', (e) => { const b = e.target.closest('button[data-view]'); if (b) go(b.dataset.view); });

  // ---------- media panel ----------
  const fileInput = $('#fileInput');
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); fileInput.value = ''; });
  const drop = $('#drop'), stage = $('#stage');
  [drop, stage].forEach((el) => {
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over'); });
    el.addEventListener('dragleave', () => el.classList.remove('over'));
    el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('over'); const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('video/')); if (f) loadFile(f); else L.toast('فقط فایل ویدیویی'); });
  });
  async function loadFile(file, opts = {}) {
    ensureAudio();
    src.pause();
    const url = opts.url || URL.createObjectURL(file);
    video.src = url;
    video.load();
    S.video = { name: file.name || opts.name || 'ویدیو', file, assetId: opts.assetId || null, size: file.size, type: file.type };
    S.audio = { buf: null, cleaned: null, segments: [], compare: false, decoding: false };
    L.audioUI && L.audioUI.reset();
    $('#fileInfo').textContent = 'در حال باز کردن ویدیو…';
    await new Promise((res, rej) => {
      const ok = () => { cleanup(); res(); }, bad = () => { cleanup(); rej(new Error('format')); };
      const cleanup = () => { video.removeEventListener('loadeddata', ok); video.removeEventListener('error', bad); };
      video.addEventListener('loadeddata', ok); video.addEventListener('error', bad);
    }).catch(() => { $('#fileInfo').textContent = 'این فرمت ویدیو در مرورگر پخش نمی‌شود. یک فایل MP4 یا WebM امتحان کن.'; $('#fileInfo').className = 'note bad'; throw new Error('bad'); });
    S.hasVideo = true;
    S.video.w = video.videoWidth; S.video.h = video.videoHeight;
    const d = video.duration || 0;
    if (!opts.keepTrim) S.trim = { start: 0, end: d };
    S.trim.end = Math.min(S.trim.end || d, d);
    S.texts.forEach((ly) => { if (ly.end > d) ly.end = d; if (ly.start > d - 0.3) ly.start = Math.max(0, d - 2); });
    video.playbackRate = S.speed;
    resize();
    $('#fileInfo').className = 'note good';
    $('#fileInfo').textContent = `${S.video.name} · ${video.videoWidth}×${video.videoHeight} · ${fmt(d)} · ${(file.size / 1048576).toFixed(1)} مگابایت`;
    $('#projName').value = (S.video.name || 'پروژه').replace(/\.[^.]+$/, '');
    syncMedia(); drawTimeline(); renderLayers();
    setTimeout(() => { src.seek(Math.min(1, d / 3)); setTimeout(renderFxThumbsSoon, 400); }, 50);
    commit();
    L.toast('ویدیو آماده شد 🎬');
    decodeAudio(file);
  }
  L.loadFile = loadFile;
  async function decodeAudio(file) {
    if (!file || file.size > 450 * 1048576) { L.audioUI && L.audioUI.note('ویدیو برای تحلیل صدا خیلی بزرگ است (بیشتر از ۴۵۰ مگابایت).', 'warn'); return; }
    S.audio.decoding = true;
    L.audioUI && L.audioUI.note('در حال خواندن صدای ویدیو…');
    try {
      const ab = await file.arrayBuffer();
      const actx = ensureAudio() || new OfflineAudioContext(1, 1, 44100);
      const buf = await new Promise((res, rej) => { const p = actx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
      if (S.video.file !== file) return;
      S.audio.buf = buf;
      L.audioUI && L.audioUI.ready();
      drawTimeline();
      L.onAudioReady && L.onAudioReady();
    } catch (e) {
      L.audioUI && L.audioUI.note('این ویدیو صدای قابل خواندن ندارد یا فرمت صدایش پشتیبانی نمی‌شود.', 'warn');
    } finally { S.audio.decoding = false; }
  }

  const num = (id) => +$(id).value;
  $('#trimStart').onchange = () => { S.trim.start = clamp(num('#trimStart'), 0, S.trim.end - 0.2); syncMedia(); drawTimeline(); commit(); };
  $('#trimEnd').onchange = () => { S.trim.end = clamp(num('#trimEnd'), S.trim.start + 0.2, src.dur); syncMedia(); drawTimeline(); commit(); };
  $('#trimInHere').onclick = () => { S.trim.start = clamp(src.time, 0, S.trim.end - 0.2); syncMedia(); drawTimeline(); commit(); };
  $('#trimOutHere').onclick = () => { S.trim.end = clamp(src.time, S.trim.start + 0.2, src.dur); syncMedia(); drawTimeline(); commit(); };
  $('#speed').oninput = () => { S.speed = num('#speed'); video.playbackRate = S.speed; syncClean(); syncMedia(); };
  $('#speed').onchange = commit;
  $('#ratioChips').onclick = (e) => { const b = e.target.closest('[data-r]'); if (!b) return; S.ratio = b.dataset.r; resize(); syncMedia(); commit(); };
  $('#fit').onchange = () => { S.fit = $('#fit').value; commit(); };
  $('#bgBlur').onchange = () => { S.bgBlur = $('#bgBlur').checked; commit(); };
  $('#rotL').onclick = () => { S.xf.rot = (S.xf.rot + 270) % 360; resize(); commit(); };
  $('#flipX').onclick = () => { S.xf.flipX = !S.xf.flipX; syncMedia(); commit(); };
  $('#flipY').onclick = () => { S.xf.flipY = !S.xf.flipY; syncMedia(); commit(); };
  $('#zoom').oninput = () => { S.xf.zoom = num('#zoom'); syncMedia(); };
  $('#zoom').onchange = commit;
  ['bright', 'contrast', 'sat', 'temp'].forEach((k) => {
    const el = $('#' + k);
    el.oninput = () => { S.adjust[k] = +el.value; el.nextElementSibling.value = (+el.value).toFixed(2); };
    el.onchange = commit;
  });
  $('#adjReset').onclick = () => { S.adjust = { bright: 0, contrast: 1, sat: 1, temp: 0 }; syncMedia(); commit(); };
  function syncMedia() {
    $('#trimStart').value = S.trim.start.toFixed(1); $('#trimEnd').value = S.trim.end.toFixed(1);
    $('#trimLen').textContent = `طول خروجی: ${fmt((S.trim.end - S.trim.start) / S.speed)}`;
    $('#speed').value = S.speed; $('#speedOut').value = S.speed + '×';
    $$('#ratioChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.r === S.ratio));
    $('#fit').value = S.fit; $('#bgBlur').checked = S.bgBlur;
    $('#flipX').classList.toggle('on', S.xf.flipX); $('#flipY').classList.toggle('on', S.xf.flipY);
    $('#zoom').value = S.xf.zoom; $('#zoomOut').value = S.xf.zoom.toFixed(2) + '×';
    ['bright', 'contrast', 'sat', 'temp'].forEach((k) => { $('#' + k).value = S.adjust[k]; $('#' + k).nextElementSibling.value = S.adjust[k].toFixed(2); });
    updateBadges();
  }

  // ---------- effects panel ----------
  let fxCat = 'همه';
  const thumbCanvases = new Map();
  function renderFxCats() {
    $('#fxCats').replaceChildren(...L.EFFECT_CATS.map((c) => { const b = document.createElement('button'); b.className = 'chip' + (c === fxCat ? ' active' : ''); b.textContent = c; b.onclick = () => { fxCat = c; renderFxCats(); renderFxGrid(); }; return b; }));
  }
  function renderFxGrid() {
    const q = $('#fxSearch').value.trim();
    const act = new Set(S.effects.map((e) => e.id));
    const list = L.allEffects().filter((e) => (fxCat === 'همه' || (fxCat === 'فعال' ? act.has(e.id) : e.cat === fxCat)) && (!q || e.name.includes(q) || e.id.includes(q.toLowerCase())));
    const grid = $('#fxGrid');
    grid.replaceChildren(...list.map((fx) => {
      const b = document.createElement('button');
      b.className = 'fx' + (act.has(fx.id) ? ' on' : '');
      b.title = fx.name;
      let cv = thumbCanvases.get(fx.id);
      if (!cv) { cv = document.createElement('canvas'); cv.width = 160; cv.height = 100; thumbCanvases.set(fx.id, cv); }
      const span = document.createElement('span'); span.textContent = fx.name;
      b.append(cv, span);
      if (fx.custom) { const t = document.createElement('i'); t.className = 'tag'; t.textContent = 'AI'; b.append(t); }
      b.onclick = () => toggleEffect(fx.id);
      return b;
    }));
    if (!list.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'جلوه‌ای پیدا نشد. می‌توانی از هوش مصنوعی بخواهی آن را بسازد.'; grid.append(p); }
    $('#fxCount').textContent = `${fa(S.effects.length)} فعال از ${fa(L.allEffects().length)}`;
  }
  function renderFxActive() {
    const box = $('#fxActive');
    if (!S.effects.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'ویدیو الان بدون جلوه است (حالت اصلی).'; box.replaceChildren(p); }
    else box.replaceChildren(...S.effects.map((e) => {
      const fx = L.effectById(e.id); if (!fx) return document.createTextNode('');
      const row = document.createElement('div'); row.className = 'active-item';
      const nm = document.createElement('b'); nm.textContent = fx.name;
      const rg = document.createElement('input'); rg.type = 'range'; rg.min = 0; rg.max = 1; rg.step = 0.01; rg.value = e.amt; rg.title = 'شدت';
      rg.oninput = () => { e.amt = +rg.value; }; rg.onchange = commit;
      const x = document.createElement('button'); x.className = 'x'; x.textContent = '×'; x.title = 'برداشتن'; x.onclick = () => removeEffect(e.id);
      row.append(nm, rg, x); return row;
    }));
    $('#fxClear').disabled = !S.effects.length;
    updateBadges();
  }
  function toggleEffect(id) { if (S.effects.find((e) => e.id === id)) removeEffect(id); else applyEffect(id, 1); }
  function applyEffect(id, amt = 1) {
    const fx = L.effectById(id); if (!fx) return false;
    const prog = gl && effectProgram(fx);
    if (prog && prog.error) { L.toast('این جلوه روی این دستگاه اجرا نشد'); return false; }
    const ex = S.effects.find((e) => e.id === id);
    if (ex) ex.amt = clamp(amt, 0, 1); else S.effects.push({ id, amt: clamp(amt, 0, 1) });
    renderFxActive(); renderFxGrid(); commit();
    return true;
  }
  function removeEffect(id) { S.effects = S.effects.filter((e) => e.id !== id); renderFxActive(); renderFxGrid(); commit(); }
  function clearEffects() { S.effects = []; renderFxActive(); renderFxGrid(); commit(); L.toast('ویدیو به حالت اصلی برگشت'); }
  $('#fxClear').onclick = clearEffects;
  $('#fxSearch').oninput = renderFxGrid;
  $('#fxThumbs').onclick = () => renderFxThumbs();
  let thumbTimer = 0;
  function renderFxThumbsSoon() { clearTimeout(thumbTimer); thumbTimer = setTimeout(renderFxThumbs, 120); }
  function renderFxThumbs() {
    if (!gl || !uploadFrame()) return;
    const w = 160, h = 100, px = new Uint8Array(w * h * 4);
    const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext('2d'); const img = tctx.createImageData(w, h);
    const saveRatio = S.fit; S.fit = 'cover';
    for (const fx of L.allEffects()) {
      let cv = thumbCanvases.get(fx.id);
      if (!cv) { cv = document.createElement('canvas'); cv.width = w; cv.height = h; thumbCanvases.set(fx.id, cv); }
      const fb = renderGL(w, h, [{ id: fx.id, amt: 1 }], src.time + 1.3, false);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
      cv.getContext('2d').putImageData(img, 0, 0);
    }
    S.fit = saveRatio;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  L.renderFxThumbs = renderFxThumbs;

  // ---------- text panel ----------
  const EMO = ['✨', '🔥', '❤️', '😍', '🎉', '🌈', '⭐', '😂', '👑', '💎', '🚀', '🌙', '🎬', '💯', '🌸', '⚡'];
  $('#emojiRow').replaceChildren(...EMO.map((em) => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = em; b.onclick = () => { const ta = $('#txtNew'); ta.value += em; ta.focus(); }; return b; }));
  $('#txtFont').replaceChildren(...[['', 'فونت خود استایل'], ...L.FONTS.map((f, i) => [i, f.name])].map(([v, n]) => { const o = document.createElement('option'); o.value = v; o.textContent = n; return o; }));
  $('#txtAdd').onclick = () => {
    const txt = $('#txtNew').value.trim() || 'متن شما';
    const ly = L.newLayer({ text: txt, styleId: lastStyle });
    select(ly.id); commit();
    L.toast('متن روی ویدیو قرار گرفت — با انگشت بکشش');
  };
  let lastStyle = 63;
  function select(id) {
    S.selected = id;
    renderLayers(); syncTextEditor(); drawTextBars();
    if ($('#v-anim').classList.contains('active')) renderAnimPanel();
    $$('#stGrid .st').forEach((el) => el.classList.toggle('on', !!selLayer() && String(selLayer().styleId) === el.dataset.id));
  }
  L.select = select;
  function removeText(id) { S.texts = S.texts.filter((t) => t.id !== id); if (S.selected === id) S.selected = null; renderLayers(); syncTextEditor(); drawTextBars(); commit(); }
  function renderLayers() {
    const box = $('#layers');
    if (!S.texts.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'هنوز متنی روی ویدیو نیست.'; box.replaceChildren(p); return; }
    box.replaceChildren(...S.texts.slice().reverse().map((ly) => {
      const d = document.createElement('div'); d.className = 'layer' + (ly.id === S.selected ? ' on' : '');
      const sw = document.createElement('i'); sw.className = 'sw';
      const t = document.createElement('span'); t.className = 't'; t.textContent = ly.text.replace(/\n/g, ' ');
      const tm = document.createElement('span'); tm.className = 'tm'; tm.textContent = `${ly.start.toFixed(1)}–${ly.end.toFixed(1)}s`;
      const x = document.createElement('button'); x.className = 'x'; x.textContent = '×'; x.title = 'حذف'; x.onclick = (e) => { e.stopPropagation(); removeText(ly.id); };
      d.append(sw, t, tm, x); d.onclick = () => { select(ly.id); };
      return d;
    }));
  }
  function syncTextEditor() {
    const ly = selLayer();
    $('#txtEdit').hidden = !ly;
    if (!ly) return;
    if (document.activeElement !== $('#txtBody')) $('#txtBody').value = ly.text;
    $('#txtFont').value = ly.font === '' || ly.font == null ? '' : ly.font;
    $('#txtSize').value = ly.size; $('#txtSizeOut').value = Math.round(ly.size * ly.scale);
    $('#txtRot').value = ly.rot; $('#txtRotOut').value = Math.round(ly.rot) + '°';
    $('#txtOpacity').value = ly.opacity;
    $('#txtCustom').checked = ly.custom; $('#txtColors').hidden = !ly.custom;
    $('#txtC1').value = ly.c1; $('#txtC2').value = ly.c2; $('#txtC3').value = ly.c3; $('#txtGrad').checked = ly.grad;
    $('#txtStart').value = ly.start.toFixed(1); $('#txtEnd').value = ly.end.toFixed(1);
  }
  L.syncTextEditor = syncTextEditor;
  const onSel = (fn, doCommit = true) => () => { const ly = selLayer(); if (!ly) return; fn(ly); if (doCommit) commit(); };
  $('#txtBody').oninput = onSel((ly) => { ly.text = $('#txtBody').value || ' '; renderLayers(); drawTextBars(); }, false);
  $('#txtBody').onchange = commit;
  $('#txtFont').onchange = onSel((ly) => { ly.font = $('#txtFont').value === '' ? '' : +$('#txtFont').value; });
  $('#txtSize').oninput = onSel((ly) => { ly.size = +$('#txtSize').value; ly.scale = 1; $('#txtSizeOut').value = ly.size; }, false);
  $('#txtSize').onchange = commit;
  $('#txtRot').oninput = onSel((ly) => { ly.rot = +$('#txtRot').value; $('#txtRotOut').value = ly.rot + '°'; }, false);
  $('#txtRot').onchange = commit;
  $('#txtOpacity').oninput = onSel((ly) => { ly.opacity = +$('#txtOpacity').value; }, false);
  $('#txtOpacity').onchange = commit;
  $('#txtCustom').onchange = onSel((ly) => { ly.custom = $('#txtCustom').checked; $('#txtColors').hidden = !ly.custom; });
  ['#txtC1', '#txtC2', '#txtC3'].forEach((id, i) => { $(id).oninput = onSel((ly) => { ly['c' + (i + 1)] = $(id).value; }, false); $(id).onchange = commit; });
  $('#txtGrad').onchange = onSel((ly) => { ly.grad = $('#txtGrad').checked; });
  $('#txtStart').onchange = onSel((ly) => { ly.start = clamp(+$('#txtStart').value, 0, ly.end - 0.2); drawTextBars(); renderLayers(); });
  $('#txtEnd').onchange = onSel((ly) => { ly.end = clamp(+$('#txtEnd').value, ly.start + 0.2, src.dur || 9999); drawTextBars(); renderLayers(); });
  $('#txtStartHere').onclick = onSel((ly) => { ly.start = clamp(src.time, 0, ly.end - 0.2); syncTextEditor(); drawTextBars(); renderLayers(); });
  $('#txtEndHere').onclick = onSel((ly) => { ly.end = clamp(src.time, ly.start + 0.2, src.dur); syncTextEditor(); drawTextBars(); renderLayers(); });
  $('#txtCenter').onclick = onSel((ly) => { ly.x = 0.5; ly.y = 0.5; ly.rot = 0; syncTextEditor(); });
  $('#txtDup').onclick = onSel((ly) => { const c = L.newLayer({ ...cleanLayer(ly), id: uid('t'), x: ly.x + 0.03, y: ly.y + 0.04 }); select(c.id); });
  $('#txtDel').onclick = () => { const ly = selLayer(); if (ly) removeText(ly.id); };

  // style gallery (1400 + AI)
  let stLook = 'همه', stShown = 0, stList = [];
  function renderLooks() {
    const looks = ['همه', ...L.LOOKS.map((l) => l.name), 'هوش مصنوعی'];
    $('#stLooks').replaceChildren(...looks.map((n) => { const b = document.createElement('button'); b.className = 'chip' + (n === stLook ? ' active' : ''); b.textContent = n; b.onclick = () => { stLook = n; renderLooks(); renderStyles(); }; return b; }));
  }
  const toEn = (s) => s.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  function filterStyles() {
    const q = toEn($('#stSearch').value.trim());
    const out = [];
    if (stLook === 'همه' || stLook === 'هوش مصنوعی') L.customStyles.forEach((c) => { if (!q || c.name.includes(q)) out.push(c.id); });
    if (stLook === 'هوش مصنوعی') return out;
    for (let i = 0; i < L.STYLE_COUNT; i++) {
      const li = Math.floor(i / L.PALETTES.length), pi = i % L.PALETTES.length;
      const look = L.LOOKS[li].name;
      if (stLook !== 'همه' && look !== stLook) continue;
      if (q && !(look.includes(q) || L.PALETTES[pi].name.includes(q) || String(i + 1) === q)) continue;
      out.push(i);
    }
    return out;
  }
  let stIO;
  function renderStyles() {
    stList = filterStyles(); stShown = 0;
    $('#stGrid').replaceChildren();
    $('#stCount').textContent = `${fa(stList.length)} استایل`;
    moreStyles();
    if (!stIO) {
      stIO = new IntersectionObserver((en) => { if (en[0].isIntersecting) moreStyles(); }, { root: $('.panel-body'), rootMargin: '300px' });
      stIO.observe($('#stMore'));
    }
  }
  L.renderStyles = renderStyles;
  const drawQueue = [];
  let drawing = false;
  function moreStyles() {
    const grid = $('#stGrid'); const sel = selLayer();
    const slice = stList.slice(stShown, stShown + 48); stShown += slice.length;
    for (const id of slice) {
      const b = document.createElement('button'); b.className = 'st'; b.dataset.id = id;
      const info = L.styleInfo(id); b.title = info.name;
      if (sel && String(sel.styleId) === String(id)) b.classList.add('on');
      const cv = document.createElement('canvas'); cv.width = 220; cv.height = 110;
      const sm = document.createElement('small'); sm.textContent = typeof id === 'number' ? fa(id + 1) : 'AI';
      b.append(cv, sm);
      b.onclick = () => useStyle(id);
      grid.append(b);
      drawQueue.push([cv, info]);
    }
    if (!drawing) pump();
  }
  function sampleText() {
    const ly = selLayer(); const t = (ly ? ly.text : $('#txtNew').value || 'سلام').split('\n')[0].trim() || 'سلام';
    let out = '';
    for (const w of t.split(/\s+/)) { if (out && (out + ' ' + w).length > 12) break; out = out ? out + ' ' + w : w; }
    return Array.from(out).slice(0, 14).join('');
  }
  function pump() {
    drawing = true;
    const txt = sampleText();
    const n = Math.min(10, drawQueue.length);
    for (let i = 0; i < n; i++) {
      const [cv, info] = drawQueue.shift();
      const c = cv.getContext('2d');
      c.clearRect(0, 0, cv.width, cv.height);
      c.save(); c.translate(cv.width / 2, cv.height / 2);
      let px = 46;
      c.font = L.fontCss(info.spec.font, px);
      const w = c.measureText(txt).width + 30;
      if (w > cv.width * 0.86) px *= (cv.width * 0.86) / w;
      L.drawStyledText(c, txt, info.spec, px, 0);
      c.restore();
    }
    if (drawQueue.length) requestAnimationFrame(pump); else drawing = false;
  }
  function useStyle(id) {
    lastStyle = id;
    let ly = selLayer();
    if (!ly) { ly = L.newLayer({ text: $('#txtNew').value.trim() || 'متن شما', styleId: id }); select(ly.id); }
    else { ly.styleId = id; ly.custom = false; ly.font = ''; syncTextEditor(); }
    $$('#stGrid .st').forEach((el) => el.classList.toggle('on', el.dataset.id === String(id)));
    commit();
  }
  $('#stSearch').oninput = () => { clearTimeout(stIO && stIO._t); renderStyles(); };
  let restyleT = 0;
  $('#txtNew').addEventListener('input', () => { clearTimeout(restyleT); restyleT = setTimeout(() => { if (!selLayer()) renderStyles(); }, 500); });
  $('#txtBody').addEventListener('change', () => renderStyles());

  // ---------- animation panel ----------
  function animBtn(a, on, onclick, label) {
    const b = document.createElement('button'); b.className = 'an' + (on ? ' on' : '');
    const i = document.createElement('i'); i.textContent = a.icon || '✨';
    const s = document.createElement('span'); s.textContent = label || a.name;
    b.append(i, s); b.onclick = onclick; return b;
  }
  function renderAnimPanel() {
    const ly = selLayer();
    $('#animTarget').textContent = ly ? `حرکت برای: «${ly.text.slice(0, 30)}»` : 'اول یک متن انتخاب کن یا بساز؛ بعد اینجا انتخاب کن چطور بیاید و برود.';
    const customIn = L.customAnims.filter((a) => a.kind !== 'loop'), customLoop = L.customAnims.filter((a) => a.kind === 'loop');
    const set = (key, id) => { const l = selLayer(); if (!l) { L.toast('اول یک متن انتخاب کن'); return; } l[key] = id; renderAnimPanel(); commit(); previewAnim(key === 'outAnim' ? 'out' : 'in'); };
    $('#animIn').replaceChildren(...[...L.ANIM_IN, ...customIn.map((a) => ({ ...a, icon: '🤖' }))].map((a) => animBtn(a, ly && ly.inAnim === a.id, () => set('inAnim', a.id), a.kind === 'out' ? a.name : a.name)));
    $('#animOut').replaceChildren(...[...L.ANIM_IN, ...customIn.map((a) => ({ ...a, icon: '🤖' }))].map((a) => animBtn(a, ly && ly.outAnim === a.id, () => set('outAnim', a.id), a.out || a.name)));
    $('#animLoop').replaceChildren(...[...L.ANIM_LOOP, ...customLoop.map((a) => ({ ...a, icon: '🤖' }))].map((a) => animBtn(a, ly && ly.loopAnim === a.id, () => set('loopAnim', a.id))));
    if (ly) {
      $('#inDur').value = ly.inDur; $('#inDurOut').value = ly.inDur.toFixed(2) + 's';
      $('#outDur').value = ly.outDur; $('#outDurOut').value = ly.outDur.toFixed(2) + 's';
      $('#loopSpeed').value = ly.loopSpeed; $('#loopSpeedOut').value = ly.loopSpeed.toFixed(2) + '×';
    }
  }
  L.renderAnimPanel = renderAnimPanel;
  [['#inDur', 'inDur', 's'], ['#outDur', 'outDur', 's'], ['#loopSpeed', 'loopSpeed', '×']].forEach(([id, k, u]) => {
    $(id).oninput = onSel((ly) => { ly[k] = +$(id).value; $(id + 'Out').value = ly[k].toFixed(2) + u; }, false);
    $(id).onchange = commit;
  });
  function previewAnim(which) {
    const ly = selLayer(); if (!ly) return;
    const t = which === 'out' ? Math.max(ly.start, ly.end - ly.outDur - 0.4) : ly.start;
    src.seek(t); src.play();
  }
  $('#animPreview').onclick = () => previewAnim('in');

  // ---------- transport ----------
  $('#playBtn').onclick = () => src.toggle();
  $('#backBtn').onclick = () => src.seek(src.time - 5);
  $('#fwdBtn').onclick = () => src.seek(src.time + 5);
  $('#loopBtn').onclick = () => { S.loop = !S.loop; $('#loopBtn').classList.toggle('on', S.loop); };
  $('#muteBtn').onclick = () => { S.mute = !S.mute; $('#mute').checked = S.mute; applyVolume(); };
  function updatePlayBtn() { $('#playBtn').textContent = src.paused ? '▶' : '❚❚'; }
  let lastClock = '';
  function updateClock(t) {
    const s = `${fmt(t)} / ${fmt(src.dur)}`;
    if (s !== lastClock) { $('#time').textContent = s; lastClock = s; }
    const d = src.dur || 1;
    $('#tlHead').style.left = (t / d) * 100 + '%';
    if (L.audioUI && L.audioUI.tick) L.audioUI.tick(t);
  }
  function updateBadges() {
    const b = [];
    if (!S.hasVideo) b.push('ویدیوی نمونه');
    if (S.effects.length) b.push(`✨ ${fa(S.effects.length)} جلوه`);
    if (S.audio.cleaned) b.push(S.audio.compare ? '🔊 صدای اصلی' : '🎧 صدای تمیز');
    if (S.ratio !== 'original') b.push(fa(S.ratio));
    $('#badges').replaceChildren(...b.map((x) => { const s = document.createElement('span'); s.textContent = x; return s; }));
  }
  L.updateBadges = updateBadges;
  setTimeout(() => { $('#hint').style.opacity = '0'; }, 9000);

  // ---------- timeline ----------
  const track = $('#tlTrack');
  function drawTimeline() {
    const d = src.dur || 1;
    // ruler
    const n = window.innerWidth < 600 ? 4 : 8;
    $('#tlRuler').replaceChildren(...Array.from({ length: n + 1 }, (_, i) => { const s = document.createElement('span'); s.style.left = (i / n) * 100 + '%'; if (i === 0) s.style.transform = 'none'; if (i === n) s.style.transform = 'translateX(-100%)'; s.textContent = fmt((d * i) / n).replace(/\.\d$/, ''); return s; }));
    // track canvas
    const cv = $('#tlCanvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr;
    const c = cv.getContext('2d'), W = cv.width, H = cv.height;
    const g = c.createLinearGradient(0, 0, W, 0);
    ['#ff3b6b', '#ff9a3c', '#ffe14d', '#4dff88', '#3cd8ff', '#6b6bff', '#d94dff'].forEach((col, i) => g.addColorStop(i / 6, col));
    c.globalAlpha = 0.22; c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
    const buf = S.audio.cleaned || S.audio.buf;
    if (buf) {
      const data = buf.getChannelData(0), step = Math.max(1, Math.floor(data.length / W));
      c.fillStyle = g;
      for (let x = 0; x < W; x++) { let m = 0; const o = x * step; for (let i = 0; i < step; i += 8) { const v = Math.abs(data[o + i] || 0); if (v > m) m = v; } const hh = Math.max(1, m * H * 0.9); c.fillRect(x, (H - hh) / 2, 1, hh); }
    } else {
      c.fillStyle = 'rgba(255,255,255,.18)';
      for (let x = 0; x < W; x += 6 * dpr) { const hh = (0.25 + 0.5 * Math.abs(Math.sin(x * 0.05) * Math.cos(x * 0.013))) * H; c.fillRect(x, (H - hh) / 2, 2 * dpr, hh); }
    }
    // trim
    const a = (S.trim.start / d) * 100, b = (S.trim.end / d) * 100;
    Object.assign($('#tlTrim').style, { left: a + '%', width: b - a + '%' });
    $('#tlIn').style.left = `calc(${a}% - 8px)`; $('#tlOut').style.left = `calc(${b}% - 8px)`;
    // noise marks
    $('#tlNoise').replaceChildren(...S.audio.segments.filter((s) => s.type !== 'floor').map((s) => { const m = document.createElement('div'); m.className = 'tl-noise' + (s.removed ? ' fixed' : ''); m.style.left = (s.start / d) * 100 + '%'; m.style.width = Math.max(0.4, ((s.end - s.start) / d) * 100) + '%'; m.title = L.TYPES[s.type].name; return m; }));
    drawTextBars();
  }
  L.drawTimeline = drawTimeline;
  function drawTextBars() {
    const d = src.dur || 1;
    $('#tlTexts').replaceChildren(...S.texts.map((ly) => {
      const row = document.createElement('div'); row.className = 'tl-row';
      const bar = document.createElement('div'); bar.className = 'tl-bar' + (ly.id === S.selected ? ' on' : '');
      bar.style.position = 'absolute'; bar.style.left = (ly.start / d) * 100 + '%'; bar.style.width = Math.max(1, ((ly.end - ly.start) / d) * 100) + '%';
      bar.textContent = ly.text.replace(/\n/g, ' ');
      const el = document.createElement('i'); el.className = 'e l'; const er = document.createElement('i'); er.className = 'e r';
      bar.append(el, er);
      bar.addEventListener('pointerdown', (e) => {
        e.preventDefault(); bar.setPointerCapture(e.pointerId); select(ly.id);
        const mode = e.target === el ? 'l' : e.target === er ? 'r' : 'm';
        const r = track.getBoundingClientRect(), x0 = e.clientX, s0 = ly.start, e0 = ly.end;
        const mv = (ev) => {
          const dt = ((ev.clientX - x0) / r.width) * d;
          if (mode === 'm') { const len = e0 - s0; ly.start = clamp(s0 + dt, 0, d - len); ly.end = ly.start + len; }
          if (mode === 'l') ly.start = clamp(s0 + dt, 0, ly.end - 0.2);
          if (mode === 'r') ly.end = clamp(e0 + dt, ly.start + 0.2, d);
          bar.style.left = (ly.start / d) * 100 + '%'; bar.style.width = ((ly.end - ly.start) / d) * 100 + '%';
          syncTextEditor();
        };
        const up = () => { bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); renderLayers(); drawTextBars(); commit(); };
        bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up);
      });
      row.append(bar); return row;
    }));
  }
  function trackTime(e) { const r = track.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1) * (src.dur || 0); }
  track.addEventListener('pointerdown', (e) => {
    const handle = e.target.id === 'tlIn' ? 'in' : e.target.id === 'tlOut' ? 'out' : null;
    track.setPointerCapture(e.pointerId);
    const mv = (ev) => {
      const t = trackTime(ev);
      if (handle === 'in') { S.trim.start = clamp(t, 0, S.trim.end - 0.2); src.seek(S.trim.start); }
      else if (handle === 'out') { S.trim.end = clamp(t, S.trim.start + 0.2, src.dur); src.seek(S.trim.end); }
      else src.seek(t);
      if (handle) { syncMedia(); drawTimeline(); }
    };
    mv(e);
    const up = () => { track.removeEventListener('pointermove', mv); track.removeEventListener('pointerup', up); if (handle) commit(); };
    track.addEventListener('pointermove', mv); track.addEventListener('pointerup', up);
  });
  video.addEventListener('durationchange', drawTimeline);

  // ---------- export ----------
  function pickMime() {
    const list = ['video/mp4;codecs=avc1.42E01F,opus', 'video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/mp4;codecs=avc1', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    return window.MediaRecorder ? list.find((m) => MediaRecorder.isTypeSupported(m)) || '' : null;
  }
  function updateExportInfo() {
    const m = pickMime();
    const [W, H] = outSize(+$('#expQuality').value);
    $('#expInfo').textContent = m === null ? 'این مرورگر ساخت ویدیو را پشتیبانی نمی‌کند؛ Chrome یا Edge را امتحان کن.' :
      `ابعاد ${fa(W)}×${fa(H)} · ${m.includes('mp4') ? 'MP4' : 'WebM'} · طول ${fmt((S.trim.end - S.trim.start) / S.speed)}${S.audio.cleaned ? ' · با صدای تمیزشده' : ''}${S.hasVideo ? '' : ' · ویدیوی نمونه (بی‌صدا)'}`;
  }
  $('#expQuality').onchange = updateExportInfo;
  let lastExport = null;
  async function startExport() {
    if (exporting) return;
    const mime = pickMime();
    if (mime === null) { L.toast('این مرورگر ساخت ویدیو را پشتیبانی نمی‌کند'); return; }
    ensureAudio(); if (AC && AC.state === 'suspended') await AC.resume().catch(() => {});
    const q = +$('#expQuality').value, fps = +$('#expFps').value;
    const prevQ = S.quality; S.quality = q; resize(q);
    const modal = $('#expModal'); modal.hidden = false;
    $('#expTitle').textContent = 'در حال ساخت ویدیو'; $('#expDone').hidden = true; $('#expVideo').hidden = true; $('#expProg').style.width = '0%';
    $('#expText').textContent = 'آماده‌سازی…'; $('#expClose').textContent = 'لغو';
    let stream = view.captureStream(0);
    let vtrack = stream.getVideoTracks()[0];
    if (!vtrack || typeof vtrack.requestFrame !== 'function') { stream = view.captureStream(fps); vtrack = null; }
    let lastReq = 0;
    if (S.hasVideo && recDest) recDest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: q >= 1080 ? 9e6 : q >= 720 ? 5e6 : 2.5e6 } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const wasLoop = S.loop; S.loop = false;
    src.pause(); src.seek(S.trim.start);
    await new Promise((r) => setTimeout(r, 350));
    const total = S.trim.end - S.trim.start;
    let cancelled = false;
    exporting = {
      tick(t) {
        const now = performance.now();
        if (vtrack && now - lastReq >= 1000 / fps - 4) { lastReq = now; vtrack.requestFrame(); }
        const p = clamp((t - S.trim.start) / total, 0, 1); $('#expProg').style.width = p * 100 + '%'; $('#expText').textContent = `${fa(Math.round(p * 100))}٪ · ${fmt(t - S.trim.start)} از ${fmt(total)}`; },
      finish() { if (rec.state !== 'inactive') rec.stop(); src.pause(); },
      cancel() { cancelled = true; this.finish(); },
    };
    rec.onstop = () => {
      exporting = null; S.loop = wasLoop; S.quality = prevQ; resize();
      stream.getVideoTracks().forEach((t) => t.stop());
      if (cancelled) { modal.hidden = true; L.toast('ساخت خروجی لغو شد'); return; }
      const type = (mime || 'video/webm').split(';')[0];
      const blob = new Blob(chunks, { type });
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      const name = (($('#projName').value || 'ladino').trim().replace(/[\\/:*?"<>|]/g, '') || 'ladino') + '.' + ext;
      lastExport = { blob, name, type };
      const v = $('#expVideo'); v.src = URL.createObjectURL(blob); v.hidden = false;
      $('#expTitle').textContent = 'ویدیوی تو آماده است 🎉';
      $('#expText').textContent = `${name} · ${(blob.size / 1048576).toFixed(1)} مگابایت`;
      $('#expProg').style.width = '100%'; $('#expDone').hidden = false; $('#expClose').textContent = 'بستن';
      $('#expCloud').disabled = !(L.cloud && L.cloud.canUpload());
    };
    rec.start(250);
    src.play();
  }
  $('#expStart').onclick = startExport;
  $('#quickExport').onclick = () => { go('export'); startExport(); };
  $('#expClose').onclick = () => { if (exporting) exporting.cancel(); else $('#expModal').hidden = true; };
  $('#expSave').onclick = async () => {
    if (!lastExport) return;
    const dl = window.claude && window.claude.use ? await window.claude.use('downloads').catch(() => null) : null;
    if (dl) {
      try { await dl.save({ filename: lastExport.name, data: lastExport.blob }); L.toast('ذخیره شد ✅'); }
      catch (e) { L.toast(e && e.code === 'declined' ? 'ذخیره لغو شد' : 'ذخیره روی دستگاه در این صفحه ممکن نشد'); }
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(lastExport.blob); a.download = lastExport.name; document.body.append(a); a.click(); a.remove();
    }
  };
  $('#expCloud').onclick = async () => { if (lastExport && L.cloud) { $('#expCloud').disabled = true; await L.cloud.saveExport(lastExport); } };

  // ---------- audio panel hooks ----------
  $('#vol').oninput = () => { S.vol = +$('#vol').value; $('#volOut').value = fa(Math.round(S.vol * 100)) + '٪'; applyVolume(); };
  $('#mute').onchange = () => { S.mute = $('#mute').checked; applyVolume(); };

  // ---------- public API (AI + cloud) ----------
  L.api = {
    S, src, applyEffect, removeEffect, clearEffects, toggleEffect, removeText, select, commit, go,
    refresh: refreshAll, renderFx: () => { renderFxActive(); renderFxGrid(); }, renderLayers, drawTextBars, syncMedia,
    serialize() { return JSON.parse(snap()); },
    restoreState(d) {
      hist.lock = true;
      const keep = ['effects', 'adjust', 'xf', 'ratio', 'fit', 'bgBlur', 'trim', 'speed', 'texts'];
      keep.forEach((k) => { if (d[k] !== undefined) S[k] = d[k]; });
      S.selected = null; hist.lock = false;
      refreshAll(); commit();
    },
  };
  function refreshAll() {
    video.playbackRate = S.speed;
    resize(); syncMedia(); renderFxActive(); renderFxGrid(); renderLayers(); syncTextEditor(); drawTimeline();
    if ($('#v-anim').classList.contains('active')) renderAnimPanel();
    if ($('#v-text').classList.contains('active')) renderStyles();
  }

  // ---------- boot ----------
  function boot() {
    resize();
    renderFxCats(); renderFxActive(); renderFxGrid(); renderLooks(); renderLayers(); syncMedia();
    const demoText = L.newLayer({ text: 'لادینو ✨', styleId: 3 * 70 + 13, size: 150, x: 0.5, y: 0.38, start: 0, end: 12, inAnim: 'pop', loopAnim: 'float' });
    L.newLayer({ text: 'ویدیوی خودت رو آپلود کن', styleId: 8 * 70 + 1, size: 54, x: 0.5, y: 0.7, start: 1, end: 12, inAnim: 'slideUp', loopAnim: 'none' });
    S.effects = [{ id: 'lightleak', amt: 0.7 }];
    renderFxActive(); renderLayers(); drawTimeline();
    hist.stack = [snap()]; hist.i = 0; updateUndo();
    void demoText;
    requestAnimationFrame(frame);
    const fonts = L.FONTS.map((f) => document.fonts && document.fonts.load(L.fontCss(f, 40), 'سلام abc')).filter(Boolean);
    Promise.allSettled(fonts).then(() => { S.texts.forEach((l) => (l._bt = null)); if ($('#v-text').classList.contains('active')) renderStyles(); });
    setTimeout(renderFxThumbs, 600);
    let v0 = 'media'; try { v0 = localStorage.getItem('ladino.view') || 'media'; } catch (e) {}
    if (VIEWS[v0]) go(v0);
    if (!gl) L.toast('WebGL در دسترس نیست؛ جلوه‌ها غیرفعال هستند', 5000);
  }
  boot();
})();
