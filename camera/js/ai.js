// On-device AI, no API key and no cloud: everything runs on the phone's GPU with TensorFlow.js
// (bundled inside ai/face-api.js).
//  - superResolve(): ESRGAN (RDN) super-resolution models from @upscalerjs (MIT), 2x / 4x.
//  - FaceTracker: tiny face detector + 68-point landmarks from @vladmandic/face-api (MIT),
//    used by the beauty mode (skin, nose, eyes, eye colour).

let loading = null;
const models = new Map();

const aiUrl = (p) => new URL(`ai/${p}`, document.baseURI).href;

export function loadAI() {
  if (loading) return loading;
  loading = (async () => {
    if (!window.faceapi) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = aiUrl('face-api.js');
        s.onload = resolve;
        s.onerror = () => reject(new Error('ai-missing'));
        document.head.appendChild(s);
      });
    }
    const fa = window.faceapi;
    const tf = fa.tf;
    try {
      await tf.setBackend('webgl');
      await tf.ready();
    } catch {
      await tf.setBackend('cpu');
      await tf.ready();
    }
    return fa;
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

async function getModel(name) {
  if (!models.has(name)) {
    const p = loadAI().then((fa) => fa.tf.loadLayersModel(aiUrl(`esrgan/${name}/model.json`)));
    p.catch(() => models.delete(name));
    models.set(name, p);
  }
  return models.get(name);
}

// Upscales `src` (canvas/image, sw x sh) by `scale` (2 or 4) with the AI model, tile by tile.
export async function superResolve(src, sw, sh, { scale = 4, size = 'slim', onProgress = () => {} } = {}) {
  const fa = await loadAI();
  const tf = fa.tf;
  const model = await getModel(`${size}-x${scale}`);
  const out = document.createElement('canvas');
  out.width = sw * scale;
  out.height = sh * scale;
  const octx = out.getContext('2d');
  const tile = document.createElement('canvas');
  const tctx = tile.getContext('2d', { willReadFrequently: true });
  const P = 96;
  const PAD = 6;
  const total = Math.ceil(sw / P) * Math.ceil(sh / P);
  let done = 0;
  for (let y = 0; y < sh; y += P) {
    for (let x = 0; x < sw; x += P) {
      const x0 = Math.max(0, x - PAD);
      const y0 = Math.max(0, y - PAD);
      const x1 = Math.min(sw, x + P + PAD);
      const y1 = Math.min(sh, y + P + PAD);
      const tw = x1 - x0;
      const th = y1 - y0;
      tile.width = tw;
      tile.height = th;
      tctx.drawImage(src, x0, y0, tw, th, 0, 0, tw, th);
      const result = tf.tidy(() => {
        const input = tf.browser.fromPixels(tile).toFloat().expandDims(0);
        return model.predict(input).squeeze().clipByValue(0, 255).cast('int32');
      });
      const pixels = await tf.browser.toPixels(result);
      result.dispose();
      const img = new ImageData(pixels, tw * scale, th * scale);
      const ix = (x - x0) * scale;
      const iy = (y - y0) * scale;
      const iw = (Math.min(sw, x + P) - x) * scale;
      const ih = (Math.min(sh, y + P) - y) * scale;
      octx.putImageData(img, x0 * scale, y0 * scale, ix, iy, iw, ih);
      onProgress(++done / total);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  return out;
}

// ------------------------------------------------------------------ face tracking
const mean = (pts) => {
  let x = 0;
  let y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
};

export class FaceTracker {
  constructor(video) {
    this.video = video;
    this.face = null; // smoothed geometry in source-frame pixels
    this.running = false;
    this.missed = 0;
    this.gen = 0;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.eyeCanvas = document.createElement('canvas');
    this.eyeCtx = this.eyeCanvas.getContext('2d', { willReadFrequently: true });
  }

  async start() {
    if (this.running) return;
    this.running = true;
    const fa = await loadAI();
    if (!this.netsLoaded) {
      await fa.nets.tinyFaceDetector.loadFromUri(aiUrl('models'));
      await fa.nets.faceLandmark68Net.loadFromUri(aiUrl('models'));
      this.netsLoaded = true;
    }
    this.options = new fa.TinyFaceDetectorOptions({ inputSize: 256, scoreThreshold: 0.35 });
    if (this.running) this.loop(fa, ++this.gen);
  }

  stop() {
    this.running = false;
    this.gen++;
    this.face = null;
  }

  async loop(fa, gen) {
    while (this.running && gen === this.gen) {
      const t0 = performance.now();
      try {
        await this.detect(fa);
      } catch (err) {
        console.warn('face detection', err);
      }
      const wait = Math.max(15, 70 - (performance.now() - t0));
      await new Promise((r) => setTimeout(r, wait));
    }
  }

  async detect(fa) {
    const v = this.video;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    if (!vw || !vh || v.readyState < 2) return;
    const s = Math.min(1, 480 / Math.max(vw, vh));
    const w = Math.round(vw * s);
    const h = Math.round(vh * s);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.ctx.drawImage(v, 0, 0, w, h);
    const res = await fa.detectSingleFace(this.canvas, this.options).withFaceLandmarks();
    if (!this.running) return;
    if (!res) {
      if (++this.missed > 6) this.face = null;
      return;
    }
    this.missed = 0;
    const k = 1 / s;
    const pts = res.landmarks.positions.map((p) => ({ x: p.x * k, y: p.y * k }));
    this.update(pts, vw, vh);
  }

  // Darkest blob inside the eye opening = the iris (landmarks only give the eyelids).
  irisCentre(eyePts, vw, vh) {
    const c = mean(eyePts);
    const xs = eyePts.map((p) => p.x);
    const ys = eyePts.map((p) => p.y);
    const x0 = Math.max(0, Math.min(...xs));
    const x1 = Math.min(vw, Math.max(...xs));
    const y0 = Math.max(0, Math.min(...ys) - 2);
    const y1 = Math.min(vh, Math.max(...ys) + 2);
    if (x1 - x0 < 6 || y1 - y0 < 3) return c;
    const W = 48;
    const H = Math.max(8, Math.round((W * (y1 - y0)) / (x1 - x0)));
    this.eyeCanvas.width = W;
    this.eyeCanvas.height = H;
    this.eyeCtx.drawImage(this.video, x0, y0, x1 - x0, y1 - y0, 0, 0, W, H);
    const d = this.eyeCtx.getImageData(0, 0, W, H).data;
    const lum = new Float32Array(W * H);
    const sorted = [];
    for (let i = 0; i < W * H; i++) {
      lum[i] = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
      sorted.push(lum[i]);
    }
    sorted.sort((a, b) => a - b);
    const thr = sorted[Math.floor(sorted.length * 0.3)];
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (lum[y * W + x] <= thr) { sx += x; sy += y; n++; }
      }
    }
    if (!n) return c;
    return { x: x0 + ((sx / n + 0.5) / W) * (x1 - x0), y: y0 + ((sy / n + 0.5) / H) * (y1 - y0) };
  }

  update(p, vw, vh) {
    const eyeL = p.slice(36, 42);
    const eyeR = p.slice(42, 48);
    const eye = (pts) => {
      const c = mean(pts);
      const halfW = Math.hypot(pts[3].x - pts[0].x, pts[3].y - pts[0].y) / 2;
      const halfH = (Math.hypot(pts[1].x - pts[5].x, pts[1].y - pts[5].y) + Math.hypot(pts[2].x - pts[4].x, pts[2].y - pts[4].y)) / 4;
      return { x: c.x, y: c.y, halfW, halfH };
    };
    const L = eye(eyeL);
    const R = eye(eyeR);
    const irisL = this.irisCentre(eyeL, vw, vh);
    const irisR = this.irisCentre(eyeR, vw, vh);
    const jaw = p.slice(0, 17);
    const brow = p.slice(17, 27);
    const angle = Math.atan2(R.y - L.y, R.x - L.x);
    const faceW = Math.hypot(jaw[16].x - jaw[0].x, jaw[16].y - jaw[0].y);
    const top = mean(brow);
    const chin = p[8];
    const faceH = Math.hypot(chin.x - top.x, chin.y - top.y) * 1.25;
    const centre = { x: (top.x + chin.x) / 2 + (top.x - chin.x) * 0.06, y: (top.y + chin.y) / 2 + (top.y - chin.y) * 0.06 };
    const noseTop = p[27];
    const noseTip = p[30];
    const noseW = Math.hypot(p[35].x - p[31].x, p[35].y - p[31].y) / 2;
    const next = {
      cx: centre.x, cy: centre.y, rx: faceW * 0.55, ry: faceH * 0.55, angle,
      eyeL: L, eyeR: R,
      irisL: { x: irisL.x, y: irisL.y, r: L.halfW * 0.42 },
      irisR: { x: irisR.x, y: irisR.y, r: R.halfW * 0.42 },
      nose: { x0: noseTop.x, y0: noseTop.y, x1: noseTip.x, y1: noseTip.y, w: noseW },
      vw, vh,
    };
    this.face = this.face && this.face.vw === vw ? blend(this.face, next, 0.55) : next;
  }
}

// Exponential smoothing of the face geometry so the effects do not jitter.
function blend(a, b, t) {
  if (typeof a === 'number') return a + (b - a) * t;
  if (a && typeof a === 'object') {
    const o = {};
    for (const k of Object.keys(b)) o[k] = k === 'vw' || k === 'vh' ? b[k] : blend(a[k], b[k], t);
    return o;
  }
  return b;
}
