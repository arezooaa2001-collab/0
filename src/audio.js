/* Ladino — on-device sound intelligence: finds disturbing sounds, previews them, removes the confirmed ones */
(function () {
  const L = (window.L = window.L || {});

  // ---------- radix-2 FFT (in place) ----------
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let j = 0; j < len / 2; j++) {
          const a = i + j, b = a + len / 2;
          const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }
  function ifft(re, im) { for (let i = 0; i < im.length; i++) im[i] = -im[i]; fft(re, im); const n = re.length; for (let i = 0; i < n; i++) { re[i] /= n; im[i] = -im[i] / n; } }
  const hann = (n) => { const w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)); return w; };
  const yieldUI = () => new Promise((r) => setTimeout(r, 0));

  L.TYPES = {
    bang: { name: 'ضربه یا صدای ناگهانی', icon: '💥', how: 'بی‌صدا با محو نرم' },
    clip: { name: 'صدای ترک‌خورده (اعوجاج)', icon: '⚡', how: 'بی‌صدا با محو نرم' },
    hiss: { name: 'خش‌خش و هیس', icon: '🌬', how: 'کاهش نویز طیفی' },
    hum: { name: 'وزوز برق', icon: '🔌', how: 'کاهش نویز طیفی' },
    rumble: { name: 'باد یا غرش بم', icon: '🌪', how: 'حذف بم + کاهش نویز' },
    floor: { name: 'نویز ثابت پس‌زمینه', icon: '📡', how: 'کاهش نویز طیفی در کل ویدیو' },
  };

  function mono(buf) {
    const n = buf.length, ch = buf.numberOfChannels, out = new Float32Array(n);
    for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i] / ch; }
    return out;
  }
  const pct = (arr, p) => { const a = Float32Array.from(arr).sort(); return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * a.length)))]; };

  /** Analyse an AudioBuffer and return disturbing segments. */
  L.detectNoise = async function (buf, onProgress) {
    const sr = buf.sampleRate, x = mono(buf);
    const N = 2048, H = 1024, w = hann(N), half = N / 2, bin = sr / N;
    const frames = Math.max(0, Math.floor((x.length - N) / H));
    const F = { db: new Float32Array(frames), flat: new Float32Array(frames), cen: new Float32Array(frames), low: new Float32Array(frames), hi: new Float32Array(frames), hum: new Float32Array(frames), clip: new Uint16Array(frames), flux: new Float32Array(frames), peak: new Float32Array(frames), imp: new Float32Array(frames), blk: new Float32Array(frames) };
    const re = new Float32Array(N), im = new Float32Array(N);
    let prevMag = new Float32Array(half);
    const b150 = Math.round(150 / bin), b4k = Math.round(4000 / bin);
    const fLo = Math.round(300 / bin), fHi = Math.min(half - 1, Math.round(Math.min(12000, sr * 0.4) / bin));
    const humBins = (f0) => [1, 2, 3, 4].map((k) => Math.round((f0 * k) / bin));
    const h50 = humBins(50), h60 = humBins(60);
    for (let f = 0; f < frames; f++) {
      const o = f * H;
      let e = 0, clip = 0, pk = 0, be = 0, bmax = 0;
      for (let i = 0; i < N; i++) { const v = x[o + i]; e += v * v; be += v * v; if ((i & 255) === 255) { if (be > bmax) bmax = be; be = 0; } const av = v < 0 ? -v : v; if (av > pk) pk = av; if (av > 0.985) clip++; re[i] = v * w[i]; im[i] = 0; }
      F.imp[f] = e > 0 ? bmax / (e / 8) : 0;
      F.blk[f] = 10 * Math.log10(bmax / 256 + 1e-10);
      fft(re, im);
      let sum = 0, cen = 0, low = 0, hi = 0, flux = 0, bsum = 0, blog = 0;
      const mag = new Float32Array(half);
      for (let k = 1; k < half; k++) {
        const p = re[k] * re[k] + im[k] * im[k];
        mag[k] = Math.sqrt(p);
        sum += p; cen += p * k * bin;
        if (k >= fLo && k <= fHi) { bsum += p; blog += Math.log(p + 1e-14); }
        if (k <= b150) low += p;
        if (k >= b4k) hi += p;
        const d = mag[k] - prevMag[k]; if (d > 0) flux += d;
      }
      prevMag = mag;
      const nb = fHi - fLo + 1, bmean = bsum / nb;
      F.db[f] = 10 * Math.log10(e / N + 1e-10);
      F.flat[f] = bmean > 1e-12 ? Math.exp(blog / nb) / bmean : 0;
      F.peak[f] = 20 * Math.log10(pk + 1e-9);
      F.cen[f] = sum > 0 ? cen / sum : 0;
      F.low[f] = sum > 0 ? low / sum : 0;
      F.hi[f] = sum > 0 ? hi / sum : 0;
      F.clip[f] = clip;
      F.flux[f] = flux;
      const hs = (bins) => { let on = 0, off = 0; for (const b of bins) { on += mag[b] || 0; off += ((mag[b - 2] || 0) + (mag[b + 2] || 0)) / 2; } return on / (off + 1e-9); };
      F.hum[f] = Math.max(hs(h50), hs(h60));
      if (f % 400 === 0) { onProgress && onProgress(f / frames); await yieldUI(); }
    }
    if (!frames) return { segments: [], floorDb: -90 };

    const floor = pct(F.db, 0.1), median = pct(F.db, 0.5), fluxMed = pct(F.flux, 0.5) + 1e-9;
    const fps = sr / H;
    const label = new Array(frames).fill(null), score = new Float32Array(frames);
    const win = Math.round(fps * 0.75);
    // running local median approximation via mean of window (cheap)
    const pre = new Float64Array(frames + 1);
    for (let i = 0; i < frames; i++) pre[i + 1] = pre[i] + Math.pow(10, F.db[i] / 10);
    for (let f = 0; f < frames; f++) {
      const db = F.db[f];
      if (db < floor + 6 || db < -62) continue;
      const a = Math.max(0, f - win), b = Math.min(frames, f + win);
      const local = 10 * Math.log10((pre[b] - pre[a] - Math.pow(10, db / 10)) / Math.max(1, b - a - 1) + 1e-10);
      if (F.clip[f] > 4) { label[f] = 'clip'; score[f] = Math.min(1, F.clip[f] / 40 + 0.5); continue; }
      const jump = F.blk[f] - local;
      if (F.imp[f] > 3.5 && jump > 8 && F.peak[f] > -20) { label[f] = 'bang'; score[f] = Math.min(0.99, 0.55 + (jump - 8) / 20 + (F.imp[f] - 3.5) / 12); continue; }
      if (F.low[f] > 0.6 && F.flat[f] < 0.05 && F.cen[f] < 220) { label[f] = 'hum'; score[f] = Math.min(0.97, 0.55 + (F.low[f] - 0.6)); continue; }
      if (F.low[f] > 0.55 && F.cen[f] < 450) { label[f] = 'rumble'; score[f] = Math.min(0.95, F.low[f] * 0.9); continue; }
      if (F.flat[f] > 0.3 && F.hi[f] > 0.3) { label[f] = 'hiss'; score[f] = Math.min(0.98, F.flat[f] + F.hi[f] * 0.4); }
    }
    // group frames into segments
    const minDur = { bang: 0, clip: 0, hiss: 0.45, hum: 0.6, rumble: 0.5 };
    const maxDur = { bang: 0.9, clip: 2 };
    const segs = [];
    for (let f = 0; f < frames; f++) {
      if (!label[f]) continue;
      const type = label[f];
      let e = f, gap = 0, sc = 0, cnt = 0;
      while (e < frames && gap <= 3) { if (label[e] === type) { gap = 0; sc += score[e]; cnt++; } else gap++; e++; }
      e -= gap;
      const start = (f * H) / sr, end = ((e - 1) * H + N) / sr;
      const dur = end - start;
      if (dur >= minDur[type] && (!maxDur[type] || dur <= maxDur[type])) {
        segs.push({ type, start: Math.max(0, start - 0.04), end: Math.min(buf.duration, end + 0.04), conf: Math.round((sc / cnt) * 100) });
      }
      f = e;
    }
    // background floor: quiet frames that are noisy (not true silence)
    const quiet = [];
    for (let f = 0; f < frames; f++) if (F.db[f] <= floor + 3) quiet.push(f);
    const qFlat = quiet.length ? quiet.reduce((s, f) => s + F.flat[f], 0) / quiet.length : 0;
    if (floor > -58 && qFlat > 0.22 && buf.duration > 2) {
      let best = quiet[0] || 0;
      segs.unshift({ type: 'floor', start: 0, end: buf.duration, conf: Math.round(Math.min(1, qFlat + (floor + 58) / 30) * 100), previewAt: (best * H) / sr });
    }
    segs.sort((a, b) => a.start - b.start);
    const out = segs.slice(0, 40).map((s, i) => ({ ...s, id: 'n' + i + '_' + Math.round(s.start * 100), keep: true }));
    onProgress && onProgress(1);
    return { segments: out, floorDb: floor, medianDb: median };
  };

  /** Spectral gate over [s0,s1) samples of channel data (in place). */
  async function spectralGate(d, sr, s0, s1, strength, killLow, profileFrom) {
    const N = 2048, H = 512, w = hann(N), half = N / 2, bin = sr / N;
    const pad = N;
    const a = Math.max(0, s0 - pad), b = Math.min(d.length, s1 + pad);
    const len = b - a;
    if (len < N * 2) return;
    // noise profile: 20th percentile magnitude per bin over the profile region
    const pr = profileFrom || [a, b];
    const pFrames = Math.max(1, Math.floor((pr[1] - pr[0] - N) / (H * 4)));
    const mags = Array.from({ length: half }, () => []);
    const re = new Float32Array(N), im = new Float32Array(N);
    for (let f = 0; f < pFrames; f++) {
      const o = pr[0] + f * H * 4;
      for (let i = 0; i < N; i++) { re[i] = (d[o + i] || 0) * w[i]; im[i] = 0; }
      fft(re, im);
      for (let k = 0; k < half; k++) mags[k].push(Math.hypot(re[k], im[k]));
    }
    const prof = new Float32Array(half);
    for (let k = 0; k < half; k++) { const m = mags[k].sort((p, q) => p - q); prof[k] = m[Math.floor(m.length * 0.2)] || 0; }
    const out = new Float32Array(len), wsum = new Float32Array(len);
    const frames = Math.floor((len - N) / H) + 1;
    let prevG = new Float32Array(half).fill(1);
    const lowCut = Math.round(130 / bin);
    for (let f = 0; f < frames; f++) {
      const o = f * H;
      for (let i = 0; i < N; i++) { re[i] = d[a + o + i] * w[i]; im[i] = 0; }
      fft(re, im);
      const g = new Float32Array(half);
      for (let k = 0; k < half; k++) {
        const m = Math.hypot(re[k], im[k]) + 1e-9;
        let gain = Math.max(0.06, 1 - (strength * prof[k]) / m);
        if (killLow && k <= lowCut) gain = Math.min(gain, 0.08);
        gain = 0.6 * gain + 0.4 * prevG[k];
        g[k] = gain;
      }
      // light smoothing across frequency
      for (let k = 1; k < half - 1; k++) prevG[k] = (g[k - 1] + 2 * g[k] + g[k + 1]) / 4;
      for (let k = 0; k < half; k++) {
        const gk = k === 0 || k === half - 1 ? g[k] : prevG[k];
        re[k] *= gk; im[k] *= gk;
        if (k > 0) { re[N - k] *= gk; im[N - k] *= gk; }
      }
      re[half] *= g[half - 1]; im[half] *= g[half - 1];
      ifft(re, im);
      for (let i = 0; i < N; i++) { out[o + i] += re[i] * w[i]; wsum[o + i] += w[i] * w[i]; }
      if (f % 300 === 0) await yieldUI();
    }
    // write back with crossfades at the segment edges
    const fade = Math.round(sr * 0.03);
    for (let i = s0; i < s1; i++) {
      const j = i - a;
      if (wsum[j] < 1e-4) continue;
      const v = out[j] / wsum[j];
      let mixv = 1;
      if (i - s0 < fade) mixv = (i - s0) / fade;
      if (s1 - i < fade) mixv = Math.min(mixv, (s1 - i) / fade);
      d[i] = d[i] * (1 - mixv) + v * mixv;
    }
  }

  function duck(d, sr, s0, s1, level) {
    const fade = Math.round(sr * 0.015);
    for (let i = Math.max(0, s0 - fade); i < Math.min(d.length, s1 + fade); i++) {
      let g = level;
      if (i < s0) g = 1 - (1 - level) * ((i - (s0 - fade)) / fade);
      else if (i >= s1) g = level + (1 - level) * ((i - s1) / fade);
      d[i] *= g;
    }
  }

  /** Make a cleaned copy of `buf` with the chosen segments removed. */
  L.cleanAudio = async function (ctx, buf, segments, onProgress) {
    const out = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
    const sr = buf.sampleRate;
    const quiet = segments.find((s) => s.type === 'floor');
    const steps = buf.numberOfChannels * segments.length || 1;
    let done = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = out.getChannelData(c);
      d.set(buf.getChannelData(c));
      // global floor first, then local events
      const ordered = [...segments].sort((p, q) => (p.type === 'floor' ? -1 : q.type === 'floor' ? 1 : 0));
      for (const s of ordered) {
        const s0 = Math.floor(s.start * sr), s1 = Math.min(d.length, Math.ceil(s.end * sr));
        if (s.type === 'bang' || s.type === 'clip') duck(d, sr, s0, s1, 0.04);
        else if (s.type === 'floor') await spectralGate(d, sr, 0, d.length, 1.6, false, quiet && quiet.profile);
        else await spectralGate(d, sr, s0, s1, s.type === 'hum' ? 2.2 : 1.8, s.type === 'rumble', null);
        done++; onProgress && onProgress(done / steps);
        await yieldUI();
      }
    }
    return out;
  };

  /** Draw a compact waveform with segment overlays. */
  L.drawWave = function (cv, buf, segments, cleaned, head) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = (cv.width = cv.clientWidth * dpr), Hh = (cv.height = cv.clientHeight * dpr);
    const g = cv.getContext('2d');
    g.clearRect(0, 0, W, Hh);
    if (!buf) return;
    const src = (cleaned || buf).getChannelData(0), step = Math.max(1, Math.floor(src.length / W));
    const dur = buf.duration;
    for (const s of segments || []) {
      if (s.type === 'floor') continue;
      g.fillStyle = s.removed ? 'rgba(93,255,168,.22)' : 'rgba(255,107,139,.28)';
      g.fillRect((s.start / dur) * W, 0, Math.max(2, ((s.end - s.start) / dur) * W), Hh);
    }
    const grd = g.createLinearGradient(0, 0, W, 0);
    grd.addColorStop(0, '#ff7ae6'); grd.addColorStop(0.5, '#7ae8ff'); grd.addColorStop(1, '#b6ff7a');
    g.fillStyle = grd;
    for (let x = 0; x < W; x++) {
      let mn = 1, mx = -1;
      const o = x * step;
      for (let i = 0; i < step; i += 4) { const v = src[o + i] || 0; if (v < mn) mn = v; if (v > mx) mx = v; }
      g.fillRect(x, ((1 - mx) / 2) * Hh, 1, Math.max(1, ((mx - mn) / 2) * Hh));
    }
    if (head != null) { g.fillStyle = '#ffcf5c'; g.fillRect((head / dur) * W - 1, 0, 2, Hh); }
  };
})();
