// Photo enhancement engine. Runs inside a Web Worker; when workers are unavailable it is
// loaded as a normal script and exposed as self.EnhanceCore.
//
// Pipeline (all on the device, no upload):
//   1. RGB -> YCbCr, automatic noise-level estimate
//   2. edge-preserving denoise (bilateral on luma, light blur on chroma)
//   3. automatic levels, midtone gamma, gentle white balance and vibrance
//   4. local contrast ("clarity")
//   5. Lanczos-3 upscaling of luma, bilinear chroma
//   6. noise-aware sharpening clamped to the local range (no halos)
(function () {
  'use strict';

  const PRESETS = {
    low: { denoiseK: 1.6, sharp: 0.6, clarity: 0.1, sat: 1.06, overshoot: 2 },
    medium: { denoiseK: 2.2, sharp: 0.95, clarity: 0.18, sat: 1.1, overshoot: 4 },
    high: { denoiseK: 3.0, sharp: 1.4, clarity: 0.26, sat: 1.15, overshoot: 7 },
  };

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  function estimateNoise(Y, w, h) {
    // Noise level of the flattest image areas: per 8x8 block, the spread of neighbour
    // differences (insensitive to smooth gradients); the lower quartile of all blocks is
    // dominated by flat areas, where only noise (and JPEG grain) is left.
    const B = 8;
    if (w < B * 2 || h < B * 2) return 0;
    const blocks = Math.floor(w / B) * Math.floor(h / B);
    const step = Math.max(1, Math.floor(Math.sqrt(blocks / 40000)));
    const stds = [];
    for (let by = 0; by + B <= h; by += B * step) {
      for (let bx = 0; bx + B <= w; bx += B * step) {
        let s = 0;
        let n = 0;
        for (let y = by; y < by + B - 1; y++) {
          const o = y * w;
          for (let x = bx; x < bx + B - 1; x++) {
            const c = Y[o + x];
            const dx = Y[o + x + 1] - c;
            const dy = Y[o + w + x] - c;
            s += dx * dx + dy * dy;
            n += 2;
          }
        }
        stds.push(Math.sqrt(s / n / 2));
      }
    }
    stds.sort((a, b) => a - b);
    return stds[Math.floor(stds.length * 0.25)] * 1.1;
  }

  function bilateral(Y, w, h, sigmaR, report) {
    const out = new Float32Array(Y.length);
    const r = 2;
    const sw = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) sw.push(Math.exp(-(dx * dx + dy * dy) / (2 * 1.5 * 1.5)));
    const lut = new Float32Array(256);
    for (let d = 0; d < 256; d++) lut[d] = Math.exp(-(d * d) / (2 * sigmaR * sigmaR));
    const rows = new Int32Array(2 * r + 1);
    const cols = new Int32Array((2 * r + 1) * w);
    for (let x = 0; x < w; x++) for (let k = -r; k <= r; k++) cols[x * (2 * r + 1) + k + r] = clamp(x + k, 0, w - 1);
    for (let y = 0; y < h; y++) {
      for (let k = -r; k <= r; k++) rows[k + r] = clamp(y + k, 0, h - 1) * w;
      for (let x = 0; x < w; x++) {
        const c = Y[y * w + x];
        let sum = 0;
        let wsum = 0;
        let n = 0;
        const cb = x * (2 * r + 1);
        for (let a = 0; a <= 2 * r; a++) {
          const row = rows[a];
          for (let b = 0; b <= 2 * r; b++) {
            const v = Y[row + cols[cb + b]];
            let d = v - c;
            if (d < 0) d = -d;
            const wt = sw[n++] * lut[d > 255 ? 255 : d | 0];
            sum += v * wt;
            wsum += wt;
          }
        }
        out[y * w + x] = sum / wsum;
      }
      if ((y & 63) === 0) report(y / h);
    }
    return out;
  }

  // Box blur (sliding window), horizontal then vertical, in place via a temp buffer.
  function boxBlur(src, w, h, r, tmp) {
    const norm = 1 / (2 * r + 1);
    for (let y = 0; y < h; y++) {
      const o = y * w;
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[o + clamp(k, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        tmp[o + x] = acc * norm;
        acc += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += tmp[clamp(k, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        src[y * w + x] = acc * norm;
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
  }

  function autoColor(Y, Cb, Cr, P) {
    const N = Y.length;
    const hist = new Uint32Array(256);
    for (let i = 0; i < N; i++) hist[clamp(Y[i] | 0, 0, 255)]++;
    const pct = (p) => {
      const target = N * p;
      let acc = 0;
      for (let b = 0; b < 256; b++) { acc += hist[b]; if (acc >= target) return b; }
      return 255;
    };
    const lo = pct(0.004);
    const hi = pct(0.996);
    const range = Math.max(1, hi - lo);
    const gain = range > 30 ? Math.min(1.6, 255 / range) : 1;
    const off = gain > 1 ? lo : 0;

    let mean = 0;
    for (let b = 0; b < 256; b++) mean += hist[b] * clamp((b - off) * gain, 0, 255);
    mean = clamp(mean / N, 8, 247);
    let g = Math.log(118 / 255) / Math.log(mean / 255);
    g = 1 + (clamp(g, 0.75, 1.3) - 1) * 0.5;

    const lut = new Float32Array(1025);
    for (let k = 0; k <= 1024; k++) {
      const v = (k / 4);
      const s = clamp((v - off) * gain, 0, 255);
      const t = 255 * Math.pow(s / 255, g);
      lut[k] = v + (t - v) * 0.75;
    }

    // Gentle white balance from near-neutral midtones.
    let sb = 0;
    let sr = 0;
    let cnt = 0;
    for (let i = 0; i < N; i += 3) {
      const y = Y[i];
      if (y > 40 && y < 225 && Math.abs(Cb[i]) + Math.abs(Cr[i]) < 40) { sb += Cb[i]; sr += Cr[i]; cnt++; }
    }
    const shiftB = cnt > N / 300 ? clamp(-(sb / cnt) * 0.6, -6, 6) : 0;
    const shiftR = cnt > N / 300 ? clamp(-(sr / cnt) * 0.6, -6, 6) : 0;

    for (let i = 0; i < N; i++) {
      const y = clamp(Y[i], 0, 255) * 4;
      const k = y | 0;
      const f = y - k;
      const ny = k >= 1024 ? lut[1024] : lut[k] + (lut[k + 1] - lut[k]) * f;
      const ratio = Y[i] > 1 ? Math.sqrt(clamp(ny / Y[i], 0.6, 1.6)) : 1;
      let cb = (Cb[i] + shiftB) * ratio;
      let cr = (Cr[i] + shiftR) * ratio;
      const sat = Math.sqrt(cb * cb + cr * cr);
      const boost = 1 + (P.sat - 1) * 1.6 * (1 - Math.min(1, sat / 80));
      Y[i] = ny;
      Cb[i] = cb * boost;
      Cr[i] = cr * boost;
    }
  }

  function clarity(Y, w, h, amount) {
    const r = Math.max(2, Math.round(Math.min(w, h) * 0.012));
    const blur = Float32Array.from(Y);
    const tmp = new Float32Array(Y.length);
    for (let pass = 0; pass < 3; pass++) boxBlur(blur, w, h, r, tmp);
    for (let i = 0; i < Y.length; i++) {
      const m = clamp(Y[i] / 255, 0, 1);
      const d = clamp(Y[i] - blur[i], -40, 40);
      Y[i] += amount * d * 4 * m * (1 - m);
    }
  }

  function lanczos(x) {
    if (x === 0) return 1;
    if (x <= -3 || x >= 3) return 0;
    const px = Math.PI * x;
    return (3 * Math.sin(px) * Math.sin(px / 3)) / (px * px);
  }

  function weights(inSize, outSize) {
    const scale = outSize / inSize;
    const fs = Math.min(1, scale);
    const support = 3 / fs;
    const taps = Math.ceil(support) * 2 + 1;
    const idx = new Int32Array(outSize * taps);
    const wts = new Float32Array(outSize * taps);
    for (let o = 0; o < outSize; o++) {
      const center = (o + 0.5) / scale - 0.5;
      const start = Math.floor(center - support) + 1;
      let sum = 0;
      for (let t = 0; t < taps; t++) {
        const k = start + t;
        const wv = lanczos((center - k) * fs);
        idx[o * taps + t] = clamp(k, 0, inSize - 1);
        wts[o * taps + t] = wv;
        sum += wv;
      }
      for (let t = 0; t < taps; t++) wts[o * taps + t] /= sum;
    }
    return { idx, wts, taps };
  }

  function resample(src, w, h, W, H, report) {
    const hx = weights(w, W);
    const tmp = new Float32Array(W * h);
    for (let y = 0; y < h; y++) {
      const si = y * w;
      const ti = y * W;
      for (let o = 0; o < W; o++) {
        let acc = 0;
        const base = o * hx.taps;
        for (let t = 0; t < hx.taps; t++) acc += src[si + hx.idx[base + t]] * hx.wts[base + t];
        tmp[ti + o] = acc;
      }
    }
    report(0.4);
    const vy = weights(h, H);
    const out = new Float32Array(W * H);
    for (let o = 0; o < H; o++) {
      const oi = o * W;
      const base = o * vy.taps;
      for (let t = 0; t < vy.taps; t++) {
        const wt = vy.wts[base + t];
        if (wt === 0) continue;
        const ri = vy.idx[base + t] * W;
        for (let x = 0; x < W; x++) out[oi + x] += tmp[ri + x] * wt;
      }
      if ((o & 127) === 0) report(0.4 + 0.6 * (o / H));
    }
    return out;
  }

  function gaussian(src, w, h, sigma, tmp, out) {
    const r = Math.max(1, Math.ceil(sigma * 2.5));
    const k = new Float32Array(2 * r + 1);
    let s = 0;
    for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)); s += k[i + r]; }
    for (let i = 0; i < k.length; i++) k[i] /= s;
    for (let y = 0; y < h; y++) {
      const o = y * w;
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let i = -r; i <= r; i++) {
          let xx = x + i;
          xx = xx < 0 ? 0 : xx >= w ? w - 1 : xx;
          acc += src[o + xx] * k[i + r];
        }
        tmp[o + x] = acc;
      }
    }
    out.fill(0);
    for (let y = 0; y < h; y++) {
      const o = y * w;
      for (let i = -r; i <= r; i++) {
        let yy = y + i;
        yy = yy < 0 ? 0 : yy >= h ? h - 1 : yy;
        const ri = yy * w;
        const wt = k[i + r];
        for (let x = 0; x < w; x++) out[o + x] += tmp[ri + x] * wt;
      }
    }
  }

  // Unsharp mask with coring (ignores noise-sized detail) and clamping to the 3x3 range.
  function sharpen(Y, w, h, sigma, amount, core, overshoot, report) {
    const tmp = new Float32Array(w * h);
    const blur = new Float32Array(w * h);
    gaussian(Y, w, h, sigma, tmp, blur);
    report(0.5);
    for (let y = 0; y < h; y++) {
      const r0 = Math.max(0, y - 1) * w;
      const r1 = y * w;
      const r2 = Math.min(h - 1, y + 1) * w;
      for (let x = 0; x < w; x++) {
        const xm = x > 0 ? x - 1 : 0;
        const xp = x < w - 1 ? x + 1 : x;
        const c = Y[r1 + x];
        let d = c - blur[r1 + x];
        const ad = d < 0 ? -d : d;
        d = ad <= core ? 0 : (d < 0 ? -(ad - core) : ad - core);
        let lo = c;
        let hi = c;
        let q;
        q = Y[r0 + xm]; if (q < lo) lo = q; else if (q > hi) hi = q;
        q = Y[r0 + x]; if (q < lo) lo = q; else if (q > hi) hi = q;
        q = Y[r0 + xp]; if (q < lo) lo = q; else if (q > hi) hi = q;
        q = Y[r1 + xm]; if (q < lo) lo = q; else if (q > hi) hi = q;
        q = Y[r1 + xp]; if (q < lo) lo = q; else if (q > hi) hi = q;
        q = Y[r2 + xm]; if (q < lo) lo = q; else if (q > hi) hi = q;
        q = Y[r2 + x]; if (q < lo) lo = q; else if (q > hi) hi = q;
        q = Y[r2 + xp]; if (q < lo) lo = q; else if (q > hi) hi = q;
        const v = c + amount * d;
        blur[r1 + x] = v < lo - overshoot ? lo - overshoot : v > hi + overshoot ? hi + overshoot : v;
      }
      if ((y & 127) === 0) report(0.5 + 0.5 * (y / h));
    }
    return { Y: blur, spare: tmp };
  }

  function axisMap(inSize, outSize) {
    const i0 = new Int32Array(outSize);
    const i1 = new Int32Array(outSize);
    const f = new Float32Array(outSize);
    const s = inSize / outSize;
    for (let o = 0; o < outSize; o++) {
      const p = clamp((o + 0.5) * s - 0.5, 0, inSize - 1);
      const a = Math.floor(p);
      i0[o] = a;
      i1[o] = Math.min(inSize - 1, a + 1);
      f[o] = p - a;
    }
    return { i0, i1, f };
  }

  function enhance(job, progress) {
    const { width: w, height: h, outW: W, outH: H } = job;
    const opts = job.opts || {};
    const P = PRESETS[opts.strength] || PRESETS.medium;
    const data = new Uint8ClampedArray(job.data);
    const N = w * h;
    const stage = (from, to, label) => (p) => progress(from + (to - from) * clamp(p, 0, 1), label);

    let Y = new Float32Array(N);
    const Cb = new Float32Array(N);
    const Cr = new Float32Array(N);
    let hasAlpha = false;
    for (let i = 0, j = 0; i < N; i++, j += 4) {
      const r = data[j];
      const g = data[j + 1];
      const b = data[j + 2];
      Y[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      Cb[i] = -0.168736 * r - 0.331264 * g + 0.5 * b;
      Cr[i] = 0.5 * r - 0.418688 * g - 0.081312 * b;
      if (data[j + 3] !== 255) hasAlpha = true;
    }
    let A = null;
    if (hasAlpha) {
      A = new Uint8Array(N);
      for (let i = 0; i < N; i++) A[i] = data[i * 4 + 3];
    }
    const noise = estimateNoise(Y, w, h);
    progress(0.05, 'analyze');

    if (opts.denoise !== false && noise > 0.6) {
      const sigmaR = clamp(P.denoiseK * noise * 1.8, 3, 30);
      Y = bilateral(Y, w, h, sigmaR, stage(0.05, 0.3, 'denoise'));
      const tmp = new Float32Array(N);
      const cr = noise > 3 ? 2 : 1;
      boxBlur(Cb, w, h, cr, tmp);
      boxBlur(Cr, w, h, cr, tmp);
    }
    progress(0.3, 'color');

    if (opts.autoColor !== false) autoColor(Y, Cb, Cr, P);
    if (P.clarity > 0) clarity(Y, w, h, P.clarity);
    progress(0.4, 'upscale');

    const scale = Math.sqrt((W * H) / N);
    let Yo = (W === w && H === h) ? Y : resample(Y, w, h, W, H, stage(0.4, 0.68, 'upscale'));
    if (Yo !== Y) Y = null;
    progress(0.68, 'sharpen');

    const sigmaS = 0.55 + 0.45 * Math.max(1, scale);
    const residualNoise = opts.denoise !== false ? noise * 0.35 : noise;
    const core = clamp(residualNoise * 0.8, 0.3, 6);
    const amount = P.sharp * (scale > 1.4 ? 1.15 : 1);
    const sharp = sharpen(Yo, W, H, sigmaS, amount, core, P.overshoot, stage(0.68, 0.92, 'sharpen'));
    Yo = null;
    progress(0.92, 'compose');

    const outY = sharp.Y;
    const out = new Uint8ClampedArray(sharp.spare.buffer);
    const mx = axisMap(w, W);
    const my = axisMap(h, H);
    for (let y = 0; y < H; y++) {
      const a0 = my.i0[y] * w;
      const a1 = my.i1[y] * w;
      const fy = my.f[y];
      for (let x = 0; x < W; x++) {
        const b0 = mx.i0[x];
        const b1 = mx.i1[x];
        const fx = mx.f[x];
        const w00 = (1 - fx) * (1 - fy);
        const w01 = fx * (1 - fy);
        const w10 = (1 - fx) * fy;
        const w11 = fx * fy;
        const cb = Cb[a0 + b0] * w00 + Cb[a0 + b1] * w01 + Cb[a1 + b0] * w10 + Cb[a1 + b1] * w11;
        const cr = Cr[a0 + b0] * w00 + Cr[a0 + b1] * w01 + Cr[a1 + b0] * w10 + Cr[a1 + b1] * w11;
        const yy = outY[y * W + x];
        const j = (y * W + x) * 4;
        out[j] = yy + 1.402 * cr;
        out[j + 1] = yy - 0.344136 * cb - 0.714136 * cr;
        out[j + 2] = yy + 1.772 * cb;
        out[j + 3] = A ? A[a0 + b0] * w00 + A[a0 + b1] * w01 + A[a1 + b0] * w10 + A[a1 + b1] * w11 : 255;
      }
    }
    progress(1, 'done');
    return { data: out.buffer, width: W, height: H, hasAlpha, noise };
  }

  const isWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
  if (isWorker) {
    self.onmessage = (e) => {
      const job = e.data;
      let last = 0;
      const progress = (p, stageName) => {
        const now = Date.now();
        if (p >= 1 || now - last > 120) { last = now; self.postMessage({ id: job.id, type: 'progress', p, stage: stageName }); }
      };
      try {
        const res = enhance(job, progress);
        self.postMessage({ id: job.id, type: 'done', ...res }, [res.data]);
      } catch (err) {
        self.postMessage({ id: job.id, type: 'error', message: String(err && err.message || err), oom: err instanceof RangeError });
      }
    };
  } else {
    self.EnhanceCore = { enhance };
  }
})();
