// Small DOM helpers shared by the camera, gallery and enhancer.

export const $ = (id) => document.getElementById(id);

let toastTimer = 0;
export function toast(message, ms = 3200) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export function showBusy(text, progress = null) {
  $('busy').hidden = false;
  $('busyText').textContent = text;
  const bar = $('busyBar');
  bar.parentElement.hidden = progress === null;
  if (progress !== null) bar.style.width = `${Math.round(progress * 100)}%`;
}

export function hideBusy() { $('busy').hidden = true; }

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Keeps numbers like "1920×1080" or "12 MB" in left-to-right order inside Persian text.
export const ltr = (s) => `\u2066${s}\u2069`;

export function fmtBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return ltr(`${n} B`);
  if (n < 1024 * 1024) return ltr(`${(n / 1024).toFixed(0)} KB`);
  if (n < 1024 * 1024 * 1024) return ltr(`${(n / 1024 / 1024).toFixed(1)} MB`);
  return ltr(`${(n / 1024 / 1024 / 1024).toFixed(2)} GB`);
}

export function extFor(mime = '') {
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

export function fileNameFor(item) {
  const d = new Date(item.created || Date.now());
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const tag = { fast: '_FAST', slow: '_SLOW', enhanced: '_HD' }[item.mode] || '';
  return `Camera_${stamp}${tag}.${extFor(item.mime || item.blob?.type)}`;
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Opens the system share sheet (on iPad/iPhone this offers "Save to Photos").
export async function shareBlob(blob, name) {
  try {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Camera' });
      return true;
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return true;
  }
  downloadBlob(blob, name);
  toast('اشتراک‌گذاری مستقیم پشتیبانی نشد؛ فایل دانلود شد.');
  return false;
}

export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.95) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, quality);
    } catch (err) {
      reject(err);
    }
  });
}

export async function thumbFromSource(source, sw, sh, size = 320) {
  const s = size / Math.max(sw, sh);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * s));
  c.height = Math.max(1, Math.round(sh * s));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return canvasToBlob(c, 'image/jpeg', 0.8);
}

export async function thumbFromImageBlob(blob) {
  const bmp = await createImageBitmap(blob);
  try { return await thumbFromSource(bmp, bmp.width, bmp.height); } finally { bmp.close?.(); }
}

export async function thumbFromVideoBlob(blob) {
  const url = URL.createObjectURL(blob);
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.src = url;
  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), 8000);
      v.onloadeddata = () => { clearTimeout(t); resolve(); };
      v.onerror = () => { clearTimeout(t); reject(new Error('decode')); };
    });
    return await thumbFromSource(v, v.videoWidth, v.videoHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const faNum = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
