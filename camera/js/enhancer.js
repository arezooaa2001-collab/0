// "Photo quality" screen: pick any photo, enhance it on the device, compare before/after.
import { $, toast, canvasToBlob, downloadBlob, shareBlob, fileNameFor, thumbFromImageBlob, faNum, ltr } from './ui.js';

const MAX_OUT_PIXELS = 16_000_000; // iPad/iPhone canvases are limited to ~16.7 MP
const MAX_SIDE = 8192;

let worker = null;
let workerFailed = false;
let jobId = 0;
let current = null; // { file, bitmap, w, h, url }
let result = null; // { blob, url, w, h }
let options = { scale: 2, strength: 'medium' };
let hooks = { saveToGallery: async () => {} };

function getWorker() {
  if (worker || workerFailed) return worker;
  try {
    worker = new Worker(new URL('./enhance-core.js', import.meta.url));
    worker.onerror = () => { workerFailed = true; worker = null; };
  } catch {
    workerFailed = true;
    worker = null;
  }
  return worker;
}

function loadCoreOnMainThread() {
  if (self.EnhanceCore) return Promise.resolve(self.EnhanceCore);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = new URL('./enhance-core.js', import.meta.url).href;
    s.onload = () => (self.EnhanceCore ? resolve(self.EnhanceCore) : reject(new Error('core')));
    s.onerror = () => reject(new Error('core'));
    document.head.appendChild(s);
  });
}

async function decode(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall through */ }
    try { return await createImageBitmap(file); } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function sizeOf(src) {
  return { w: src.naturalWidth || src.videoWidth || src.width, h: src.naturalHeight || src.videoHeight || src.height };
}

function plan(w, h, scale, cap = MAX_OUT_PIXELS) {
  // Input is limited to the cap as well; output = input * scale, capped.
  let inS = Math.min(1, Math.sqrt(cap / (w * h)), MAX_SIDE / Math.max(w, h));
  const iw = Math.max(1, Math.round(w * inS));
  const ih = Math.max(1, Math.round(h * inS));
  let s = Math.min(scale, Math.sqrt(cap / (iw * ih)), MAX_SIDE / Math.max(iw, ih));
  s = Math.max(1, s);
  return { iw, ih, ow: Math.max(1, Math.round(iw * s)), oh: Math.max(1, Math.round(ih * s)), effective: s };
}

function updateSizes() {
  if (!current) return;
  const p = plan(current.w, current.h, options.scale);
  const note = p.effective + 0.01 < options.scale
    ? ` (برای جلوگیری از کمبود حافظه دستگاه، حداکثر ${faNum(p.effective.toFixed(1))}× بزرگ می‌شود)`
    : '';
  $('enhanceSizes').textContent = `ورودی: ${ltr(`${current.w}×${current.h}`)}  ←  خروجی: ${ltr(`${p.ow}×${p.oh}`)}${note}`;
}

function setProgress(p, text) {
  const bar = $('enhanceProgress');
  bar.hidden = p === null;
  if (p !== null) bar.firstElementChild.style.width = `${Math.round(p * 100)}%`;
  if (text !== undefined) $('enhanceStatus').textContent = text;
}

const STAGE_TEXT = {
  analyze: 'در حال بررسی عکس…',
  denoise: 'در حال حذف نویز…',
  color: 'در حال اصلاح نور و رنگ…',
  upscale: 'در حال بزرگ‌کردن با کیفیت بالا…',
  sharpen: 'در حال شفاف‌سازی جزئیات…',
  compose: 'در حال ساخت عکس نهایی…',
  done: 'تمام شد',
};

function resetResult() {
  if (result?.url) URL.revokeObjectURL(result.url);
  result = null;
  $('compare').hidden = true;
}

export async function loadFile(file) {
  if (!file) return;
  if (file.type && !file.type.startsWith('image/')) { toast('لطفاً یک فایل عکس انتخاب کن.'); return; }
  resetResult();
  if (current?.url) URL.revokeObjectURL(current.url);
  current = null;
  setProgress(null, 'در حال باز کردن عکس…');
  try {
    const bitmap = await decode(file);
    const { w, h } = sizeOf(bitmap);
    if (!w || !h) throw new Error('empty');
    current = { file, bitmap, w, h, url: URL.createObjectURL(file) };
    $('enhanceOptions').hidden = false;
    $('enhanceStatus').textContent = '';
    updateSizes();
  } catch {
    $('enhanceOptions').hidden = true;
    $('enhanceStatus').textContent = '';
    toast('این عکس باز نشد. فرمت آن در این مرورگر پشتیبانی نمی‌شود (مثلاً HEIC). یک عکس JPG یا PNG امتحان کن.', 5000);
  }
}

function runJob(job) {
  const w = getWorker();
  if (w) {
    return new Promise((resolve, reject) => {
      const onMsg = (e) => {
        const m = e.data;
        if (m.id !== job.id) return;
        if (m.type === 'progress') setProgress(m.p, STAGE_TEXT[m.stage]);
        else {
          w.removeEventListener('message', onMsg);
          if (m.type === 'done') resolve(m);
          else reject(Object.assign(new Error(m.message), { oom: m.oom }));
        }
      };
      w.addEventListener('message', onMsg);
      w.postMessage(job, [job.data]);
    });
  }
  return loadCoreOnMainThread().then((core) => new Promise((resolve, reject) => {
    setTimeout(() => {
      try { resolve(core.enhance(job, (p, s) => setProgress(p, STAGE_TEXT[s]))); } catch (err) { reject(Object.assign(err, { oom: err instanceof RangeError })); }
    }, 50);
  }));
}

async function run() {
  if (!current) return;
  const btn = $('enhanceRun');
  btn.disabled = true;
  resetResult();
  const strength = options.strength;
  const autoColor = $('autoColor').checked;
  const denoise = $('denoiseOn').checked;
  const caps = [MAX_OUT_PIXELS, 8_000_000, 4_000_000];
  try {
    for (let attempt = 0; attempt < caps.length; attempt++) {
      const p = plan(current.w, current.h, options.scale, caps[attempt]);
      setProgress(0, 'در حال آماده‌سازی…');
      const c = document.createElement('canvas');
      c.width = p.iw;
      c.height = p.ih;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(current.bitmap, 0, 0, p.iw, p.ih);
      const img = ctx.getImageData(0, 0, p.iw, p.ih);
      c.width = c.height = 1;
      const job = { id: ++jobId, data: img.data.buffer, width: p.iw, height: p.ih, outW: p.ow, outH: p.oh, opts: { strength, autoColor, denoise } };
      let res;
      try {
        res = await runJob(job);
      } catch (err) {
        if (err.oom && attempt < caps.length - 1) { toast('حافظه کافی نبود؛ با اندازه کوچک‌تر دوباره تلاش می‌شود…'); continue; }
        throw err;
      }
      setProgress(0.99, 'در حال ذخیره…');
      const out = document.createElement('canvas');
      out.width = res.width;
      out.height = res.height;
      out.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(res.data), res.width, res.height), 0, 0);
      const type = res.hasAlpha ? 'image/png' : 'image/jpeg';
      const blob = await canvasToBlob(out, type, 0.95);
      out.width = out.height = 1;
      result = { blob, url: URL.createObjectURL(blob), w: res.width, h: res.height };
      showCompare();
      setProgress(null, `عکس بهبود یافت: ${ltr(`${res.width}×${res.height}`)} پیکسل`);
      return;
    }
  } catch (err) {
    console.error(err);
    setProgress(null, '');
    toast('بهبود عکس انجام نشد. اندازه کوچک‌تر (۱× یا ۲×) را امتحان کن.', 5000);
  } finally {
    btn.disabled = false;
  }
}

function showCompare() {
  $('cmpBefore').src = current.url;
  $('cmpAfter').src = result.url;
  $('compare').hidden = false;
  setSplit(50);
  $('cmpSlider').value = 50;
  $('compare').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setSplit(v) {
  $('cmpAfterWrap').style.clipPath = `inset(0 0 0 ${v}%)`;
  $('cmpLine').style.left = `${v}%`;
}

function segment(id, key, parse) {
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    for (const x of $(id).querySelectorAll('button')) x.classList.toggle('active', x === b);
    options[key] = parse(b.dataset.v);
    updateSizes();
  });
}

export function initEnhancer(h) {
  hooks = { ...hooks, ...h };
  $('compareInner').style.direction = 'ltr';
  $('enhanceInput').addEventListener('change', (e) => {
    loadFile(e.target.files && e.target.files[0]);
    e.target.value = '';
  });
  const dz = $('dropZone');
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('over');
    loadFile(e.dataTransfer.files && e.dataTransfer.files[0]);
  });
  segment('scaleSeg', 'scale', Number);
  segment('strengthSeg', 'strength', String);
  $('enhanceRun').addEventListener('click', run);
  $('cmpSlider').addEventListener('input', (e) => setSplit(e.target.value));
  $('eSave').addEventListener('click', () => { if (result) downloadBlob(result.blob, fileNameFor({ created: Date.now(), mode: 'enhanced', mime: result.blob.type })); });
  $('eShare').addEventListener('click', () => { if (result) shareBlob(result.blob, fileNameFor({ created: Date.now(), mode: 'enhanced', mime: result.blob.type })); });
  $('eGallery').addEventListener('click', async () => {
    if (!result) return;
    let thumb = null;
    try { thumb = await thumbFromImageBlob(result.blob); } catch { /* optional */ }
    await hooks.saveToGallery({ kind: 'photo', mode: 'enhanced', mime: result.blob.type, blob: result.blob, thumb, width: result.w, height: result.h });
    toast('به گالری برنامه اضافه شد.');
  });
}
