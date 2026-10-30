// Camera — uses the real camera of this phone/tablet through the browser.
// Live preview, zoom up to 250x (back) / 20x (front), photo, video with optional microphone,
// fast (time-lapse) and slow-motion video, in-app gallery and photo enhancement.
import { Renderer } from './renderer.js';
import { store } from './storage.js';
import { createMp4Writer, webCodecsSupported } from './encoder.js';
import { initEnhancer, loadFile as loadIntoEnhancer } from './enhancer.js';
import {
  $, toast, showBusy, hideBusy, fmtTime, fmtBytes, fileNameFor, downloadBlob, shareBlob,
  canvasToBlob, thumbFromSource, thumbFromVideoBlob, clamp, faNum, ltr,
} from './ui.js';

const MAX_ZOOM = { environment: 250, user: 20 };
const PRESETS = { environment: [1, 2, 5, 10, 25, 50, 100, 250], user: [1, 2, 5, 10, 20] };
const QUALITIES = {
  '4k': { label: '4K', long: 3840, short: 2160 },
  1080: { label: '1080p', long: 1920, short: 1080 },
  720: { label: '720p', long: 1280, short: 720 },
};
const QUALITY_ORDER = ['4k', '1080', '720'];
const TL_INTERVALS = [0.5, 1, 2, 5, 10];
const SLOW_FACTORS = [2, 4, 8];
const OUT_FPS = 30;
const MODE_LABEL = { photo: 'عکس', video: 'ویدیو', fast: 'سریع', slow: 'آهسته', enhanced: 'HD' };

const video = $('video');
const stage = $('stage');
const minimap = $('minimap');
const minimapCtx = minimap.getContext('2d');
let renderer = null;
let canvas = $('view');

const saved = loadSettings();
const state = {
  facing: saved.facing === 'user' ? 'user' : 'environment',
  mode: ['photo', 'video', 'fast', 'slow'].includes(saved.mode) ? saved.mode : 'video',
  quality: QUALITIES[saved.quality] ? saved.quality : '4k',
  tlInterval: TL_INTERVALS.includes(saved.tlInterval) ? saved.tlInterval : 1,
  slowFactor: SLOW_FACTORS.includes(saved.slowFactor) ? saved.slowFactor : 4,
  micWanted: !!saved.mic,
  stream: null,
  track: null,
  profile: null,
  audioStream: null,
  micOn: false,
  zoom: 1,
  hw: { supported: false, min: 1, max: 1, step: 0.1, applied: 1, wanted: 1, busy: false },
  panX: 0.5,
  panY: 0.5,
  crop: { x: 0, y: 0, w: 1, h: 1 },
  digital: 1,
  out: { w: 0, h: 0 },
  photoRequest: null,
  torch: false,
  torchSupported: false,
  focusSupported: false,
  cameraCount: -1,
  trackFps: 30,
  rec: null,
  locked: null,
  screen: 'permScreen',
  opening: null,
  busy: false,
};

// ---------------------------------------------------------------- settings
function loadSettings() {
  try { return JSON.parse(localStorage.getItem('camera.settings') || '{}') || {}; } catch { return {}; }
}
function saveSettings() {
  try {
    localStorage.setItem('camera.settings', JSON.stringify({
      quality: state.quality, facing: state.facing, mode: state.mode,
      tlInterval: state.tlInterval, slowFactor: state.slowFactor, mic: state.micOn,
    }));
  } catch { /* storage may be blocked */ }
}

// ---------------------------------------------------------------- screens
const SCREENS = ['permScreen', 'camScreen', 'galleryScreen', 'viewerScreen', 'enhanceScreen'];
const navStack = [];

function show(name) {
  const prev = state.screen;
  for (const s of SCREENS) $(s).hidden = s !== name;
  state.screen = name;
  if (prev === 'viewerScreen' && name !== 'viewerScreen') closeViewer();
  if (prev === 'galleryScreen' && name !== 'galleryScreen' && name !== 'viewerScreen') releaseGalleryUrls();
  if (name === 'camScreen') resumeCamera(); else pauseCamera();
  if (name === 'galleryScreen') renderGallery();
  if (name === 'viewerScreen') renderViewer();
}

function openPage(name) {
  if (state.rec) { toast('اول ضبط را متوقف کن.'); return; }
  navStack.push(state.screen);
  try { history.pushState({ page: name }, ''); } catch { /* ignore */ }
  show(name);
}

function goBack() {
  if (navStack.length) history.back();
  else show(state.track ? 'camScreen' : 'permScreen');
}

window.addEventListener('popstate', () => {
  const prev = navStack.pop();
  if (prev) show(prev);
});

// ---------------------------------------------------------------- camera
function profileFor(mode) { return mode === 'slow' ? 'slow' : 'normal'; }

function cameraErrorText(err) {
  const n = err && err.name;
  if (err && err.message === 'insecure') return 'برای دسترسی به دوربین، این صفحه باید با آدرس امن (https) باز شود.';
  if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') {
    return 'اجازه دوربین داده نشد. از تنظیمات مرورگر (آیکون قفل/دوربین کنار نوار آدرس، یا تنظیمات سایت) دسترسی «دوربین» را برای این سایت روی «مجاز» بگذار و دوباره دکمه بالا را بزن.';
  }
  if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return 'دوربینی روی این دستگاه پیدا نشد.';
  if (n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError') {
    return 'دوربین در اختیار برنامه دیگری است (مثلاً برنامه دوربین یا تماس تصویری). آن را ببند و دوباره امتحان کن.';
  }
  return `باز کردن دوربین ناموفق بود (${(err && (err.message || n)) || 'نامشخص'}).`;
}

const FATAL = new Set(['NotAllowedError', 'SecurityError', 'PermissionDeniedError', 'NotReadableError', 'TrackStartError']);

async function getStream(attempts) {
  let lastErr = null;
  for (const videoConstraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
    } catch (err) {
      lastErr = err;
      if (err && FATAL.has(err.name)) throw err;
    }
  }
  throw lastErr || new Error('camera');
}

function stopVideoStream() {
  if (state.stream) for (const t of state.stream.getTracks()) { try { t.stop(); } catch { /* ignore */ } }
  state.stream = null;
  state.track = null;
}

function waitForVideo(timeout = 6000) {
  if (video.readyState >= 2 && video.videoWidth) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener('loadeddata', done);
      video.removeEventListener('playing', done);
      resolve();
    };
    const timer = setTimeout(done, timeout);
    video.addEventListener('loadeddata', done);
    video.addEventListener('playing', done);
  });
}

function openCamera() {
  if (state.opening) return state.opening;
  state.opening = (async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('insecure');
    const profile = profileFor(state.mode);
    const q = QUALITIES[state.quality];
    const long = profile === 'slow' ? Math.min(1920, q.long) : q.long;
    const short = profile === 'slow' ? Math.min(1080, q.short) : q.short;
    const base = {
      facingMode: { ideal: state.facing },
      width: { ideal: long },
      height: { ideal: short },
      frameRate: { ideal: profile === 'slow' ? 240 : 30 },
    };
    stopVideoStream();
    const stream = await getStream([
      { ...base, zoom: true },
      base,
      { facingMode: { ideal: state.facing }, width: { ideal: long } },
      { facingMode: { ideal: state.facing } },
      true,
    ]);
    state.stream = stream;
    state.track = stream.getVideoTracks()[0];
    state.profile = profile;
    state.track.addEventListener('ended', onTrackEnded);
    video.srcObject = stream;
    try { await video.play(); } catch { /* autoplay of a muted inline video is allowed; ignore */ }
    await waitForVideo();
    readCapabilities();
    countCameras();
    updateMirror();
    updateTopbar();
    buildZoomPresets();
    setZoom(state.zoom);
    startLoop();
  })();
  return state.opening.finally(() => { state.opening = null; });
}

function readCapabilities() {
  const t = state.track;
  let caps = {};
  let s = {};
  try { caps = (t.getCapabilities && t.getCapabilities()) || {}; } catch { caps = {}; }
  try { s = (t.getSettings && t.getSettings()) || {}; } catch { s = {}; }
  if (s.facingMode === 'user' || s.facingMode === 'environment') state.facing = s.facingMode;
  const z = caps.zoom;
  if (z && typeof z.max === 'number' && z.max > (z.min || 1) + 0.01) {
    state.hw = {
      supported: true, min: z.min || 1, max: z.max, step: z.step || 0.1,
      applied: typeof s.zoom === 'number' ? s.zoom : (z.min || 1), wanted: 1, busy: false,
    };
  } else {
    state.hw = { supported: false, min: 1, max: 1, step: 0.1, applied: 1, wanted: 1, busy: false };
  }
  state.torchSupported = caps.torch === true || (Array.isArray(caps.torch) && caps.torch.includes(true));
  state.torch = false;
  state.focusSupported = Array.isArray(caps.focusMode) && (caps.focusMode.includes('single-shot') || caps.focusMode.includes('continuous'));
  state.trackFps = s.frameRate || 30;
}

async function countCameras() {
  try {
    const list = await navigator.mediaDevices.enumerateDevices();
    state.cameraCount = list.filter((d) => d.kind === 'videoinput').length;
  } catch {
    state.cameraCount = -1;
  }
  $('flipBtn').hidden = state.cameraCount === 1;
}

function onTrackEnded() {
  if (state.rec) stopRecording('ended');
  if (!document.hidden && state.screen === 'camScreen') {
    setTimeout(() => reopenCamera(), 400);
  }
}

async function reopenCamera() {
  try {
    await openCamera();
    return true;
  } catch (err) {
    console.error(err);
    if (err && FATAL.has(err.name)) showPermissionError(err);
    else toast(cameraErrorText(err), 5000);
    return false;
  }
}

function zoomMin() { return state.hw.supported && state.hw.min < 1 && state.facing === 'environment' ? state.hw.min : 1; }
function zoomMax() { return MAX_ZOOM[state.facing] || 250; }

function updateMirror() {
  const mirror = state.facing === 'user';
  canvas.classList.toggle('mirror', mirror);
  minimap.classList.toggle('mirror', mirror);
  minimap.style.transform = mirror ? 'scaleX(-1)' : '';
}

// ---------------------------------------------------------------- zoom
function hwPart(z) { return state.hw.supported ? clamp(z, state.hw.min, state.hw.max) : 1; }

function setZoom(z) {
  state.zoom = clamp(z, zoomMin(), zoomMax());
  requestHardwareZoom(hwPart(state.zoom));
  updateZoomUI();
}

// applyConstraints is slow, so requests are coalesced: only the latest wanted value is applied.
function requestHardwareZoom(v) {
  const hw = state.hw;
  if (!hw.supported || !state.track) return;
  hw.wanted = v;
  hw.seq = (hw.seq || 0) + 1;
  if (!hw.busy) runHardwareZoom(hw, state.track);
}

async function runHardwareZoom(hw, track) {
  hw.busy = true;
  let handled = -1;
  try {
    while (handled !== hw.seq) {
      handled = hw.seq;
      const step = hw.step > 0 ? hw.step : 0.1;
      const target = clamp(hw.min + Math.round((hw.wanted - hw.min) / step) * step, hw.min, hw.max);
      if (Math.abs(target - hw.applied) < step / 2) continue;
      await track.applyConstraints({ advanced: [{ zoom: target }] });
      if (track !== state.track) return;
      const s = track.getSettings();
      hw.applied = typeof s.zoom === 'number' ? s.zoom : target;
    }
  } catch (err) {
    console.warn('hardware zoom failed, using digital zoom only', err);
    if (track === state.track) { hw.supported = false; hw.applied = 1; }
  } finally {
    hw.busy = false;
    if (hw === state.hw) updateZoomUI();
  }
}

const fmtZoom = (z) => (z < 10 ? z.toFixed(1) : String(Math.round(z)));

function zoomToSlider(z) {
  const a = zoomMin();
  const b = zoomMax();
  return Math.round((1000 * Math.log(z / a)) / Math.log(b / a));
}
function sliderToZoom(v) {
  const a = zoomMin();
  const b = zoomMax();
  return a * Math.pow(b / a, v / 1000);
}

function buildZoomPresets() {
  const box = $('zoomPresets');
  box.textContent = '';
  const list = PRESETS[state.facing].filter((p) => p <= zoomMax());
  if (zoomMin() < 1) list.unshift(Math.round(zoomMin() * 10) / 10);
  for (const p of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.z = p;
    b.textContent = `${p}×`;
    box.appendChild(b);
  }
}

function updateZoomUI() {
  const z = state.zoom;
  $('zoomValue').textContent = `${fmtZoom(z)}×`;
  const slider = $('zoomSlider');
  if (document.activeElement !== slider) slider.value = zoomToSlider(z);
  for (const b of $('zoomPresets').children) b.classList.toggle('active', Math.abs(Number(b.dataset.z) - z) / z < 0.03);
  updateZoomInfo();
}

function updateZoomInfo() {
  const hw = state.hw;
  const digital = Math.max(1, state.zoom / (hw.supported ? hw.applied : 1));
  const parts = [];
  if (hw.supported) parts.push(`زوم سخت‌افزاری دوربین ${ltr(`${fmtZoom(hw.applied)}×`)}`);
  parts.push(`زوم دیجیتال ${ltr(`${fmtZoom(digital)}×`)}`);
  if (!hw.supported) parts.push('(این دوربین در مرورگر زوم سخت‌افزاری ندارد)');
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (digital > 1.05 && vw) {
    // How many real camera pixels end up on screen (the honest detail level at this zoom).
    const out = state.out.w ? state.out : { w: vw, h: vh };
    const srcA = vw / vh;
    const outA = out.w / out.h;
    const bw = srcA > outA ? outA / srcA : 1;
    const bh = srcA < outA ? srcA / outA : 1;
    parts.push(`جزئیات واقعی از دوربین: ${ltr(`${Math.max(1, Math.round((bw / digital) * vw))}×${Math.max(1, Math.round((bh / digital) * vh))}`)} پیکسل`);
  }
  $('zoomInfo').textContent = parts.join(' · ');
}

// ---------------------------------------------------------------- rendering
const even = (n) => Math.max(2, Math.floor(n / 2) * 2);

function outputSize(vw, vh) {
  const q = QUALITIES[state.quality];
  const landscape = vw >= vh;
  const maxW = landscape ? q.long : q.short;
  const maxH = landscape ? q.short : q.long;
  const s = Math.min(1, maxW / vw, maxH / vh);
  return { w: even(vw * s), h: even(vh * s) };
}

function computeCrop(vw, vh, W, H, digital) {
  const srcA = vw / vh;
  const outA = W / H;
  let bw = 1;
  let bh = 1;
  if (srcA > outA + 1e-6) bw = outA / srcA;
  else if (srcA < outA - 1e-6) bh = srcA / outA;
  const w = bw / digital;
  const h = bh / digital;
  state.panX = clamp(state.panX, w / 2, 1 - w / 2);
  state.panY = clamp(state.panY, h / 2, 1 - h / 2);
  return { x: state.panX - w / 2, y: state.panY - h / 2, w, h };
}

function sharpFor(mag) {
  if (mag <= 1.05) return 0.12;
  return Math.min(0.75, 0.12 + (mag - 1) * 0.3);
}

const loop = { running: false, mode: 'raf', handle: 0, lastCb: 0, gen: 0, frames: 0, errors: 0 };

function startLoop() {
  stopLoop();
  loop.running = true;
  loop.mode = 'requestVideoFrameCallback' in HTMLVideoElement.prototype ? 'rvfc' : 'raf';
  loop.lastCb = performance.now();
  schedule(++loop.gen);
}

function stopLoop() {
  loop.running = false;
  loop.gen++;
  try {
    if (loop.mode === 'rvfc' && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(loop.handle);
    else cancelAnimationFrame(loop.handle);
  } catch { /* ignore */ }
}

function schedule(gen) {
  if (!loop.running || gen !== loop.gen) return;
  if (loop.mode === 'rvfc') {
    loop.handle = video.requestVideoFrameCallback((now, meta) => {
      if (gen !== loop.gen) return;
      loop.lastCb = performance.now();
      tick(now, meta);
      schedule(gen);
    });
  } else {
    loop.handle = requestAnimationFrame((now) => {
      if (gen !== loop.gen) return;
      loop.lastCb = performance.now();
      tick(now, null);
      schedule(gen);
    });
  }
}

// Some browsers never fire requestVideoFrameCallback for a hidden source video: fall back.
setInterval(() => {
  if (loop.running && loop.mode === 'rvfc' && !document.hidden && video.readyState >= 2
    && performance.now() - loop.lastCb > 1200) {
    try { video.cancelVideoFrameCallback(loop.handle); } catch { /* ignore */ }
    loop.mode = 'raf';
    schedule(++loop.gen);
  }
}, 700);

function tick(now, meta) {
  try {
    processFrame(now, meta);
    loop.errors = 0;
  } catch (err) {
    if (loop.errors++ < 3) console.error(err);
    if (state.rec && state.rec.kind !== 'video' && loop.errors > 30) stopRecording('error');
  }
}

// The live preview is rendered at screen resolution; the full output resolution (up to 4K)
// is used for the photo itself and for the whole duration of a recording.
let stageSize = { w: 0, h: 0 };
function measureStage() {
  const r = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  stageSize = { w: Math.max(320, r.width * dpr), h: Math.max(240, r.height * dpr) };
}
window.addEventListener('resize', measureStage);
window.addEventListener('orientationchange', () => setTimeout(measureStage, 300));

function previewSize(out) {
  if (!stageSize.w) measureStage();
  const s = Math.min(1, stageSize.w / out.w, stageSize.h / out.h);
  return { w: even(out.w * s), h: even(out.h * s) };
}

function drawCurrent() {
  const vw = renderer.sourceW;
  const vh = renderer.sourceH;
  if (!vw || !vh) return null;
  const hwApplied = state.hw.supported ? state.hw.applied : 1;
  state.digital = Math.max(1, state.zoom / hwApplied);
  const crop = computeCrop(vw, vh, canvas.width, canvas.height, state.digital);
  state.crop = crop;
  const sharp = sharpFor(canvas.width / (crop.w * vw));
  return { crop, sharp };
}

function processFrame(now, meta) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || video.readyState < 2) return;
  const out = outputSize(vw, vh);
  if (out.w !== state.out.w || out.h !== state.out.h) {
    state.out = out;
    updateTopbar();
  }
  const target = state.locked || (state.photoRequest ? out : previewSize(out));
  if (target.w !== canvas.width || target.h !== canvas.height) renderer.setSize(target.w, target.h);
  if (!renderer.upload(video, vw, vh)) return;
  const { crop, sharp } = drawCurrent();
  const rec = state.rec;
  if (rec && rec.kind === 'slow') slowFrame(rec, now, meta, crop, sharp);
  renderer.draw({ crop, sharp });
  if (rec && rec.kind === 'fast') fastFrame(rec, now);
  if (state.photoRequest) {
    const req = state.photoRequest;
    state.photoRequest = null;
    const W = canvas.width;
    const H = canvas.height;
    // Both read the canvas synchronously, before the next (preview-sized) frame.
    req.resolve({ W, H, blob: canvasToBlob(canvas, 'image/jpeg', 0.95), thumb: thumbFromSource(canvas, W, H).catch(() => null) });
  }
  if (++loop.frames % 6 === 0) drawMinimap(vw, vh, crop);
}

function drawMinimap(vw, vh, crop) {
  const visible = state.digital > 1.05 && state.screen === 'camScreen';
  minimap.hidden = !visible;
  if (!visible) return;
  const w = 160;
  const h = Math.max(40, Math.round((w * vh) / vw));
  if (minimap.width !== w || minimap.height !== h) { minimap.width = w; minimap.height = h; }
  minimapCtx.drawImage(video, 0, 0, w, h);
  minimapCtx.strokeStyle = '#ffcc33';
  minimapCtx.lineWidth = 2;
  const rw = Math.max(3, crop.w * w);
  const rh = Math.max(3, crop.h * h);
  minimapCtx.strokeRect(crop.x * w + crop.w * w / 2 - rw / 2, crop.y * h + crop.h * h / 2 - rh / 2, rw, rh);
}

function resumeCamera() {
  acquireWakeLock();
  if (state.track && state.track.readyState === 'live') {
    if (!loop.running) startLoop();
  } else if (state.stream || state.screen === 'camScreen') {
    reopenCamera();
  }
}

function pauseCamera() {
  stopLoop();
  releaseWakeLock();
  if (state.torch) setTorch(false);
}

// ---------------------------------------------------------------- wake lock
let wakeLock = null;
async function acquireWakeLock() {
  if (wakeLock || document.hidden || !('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { wakeLock = null; }
}
function releaseWakeLock() {
  if (wakeLock && !state.rec) { wakeLock.release().catch(() => {}); wakeLock = null; }
}

// ---------------------------------------------------------------- gestures
const pointers = new Map();
let gesture = null;

function displayedRect() {
  const r = stage.getBoundingClientRect();
  const a = canvas.width / canvas.height || 16 / 9;
  let w = r.width;
  let h = r.width / a;
  if (h > r.height) { h = r.height; w = r.height * a; }
  return { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, w, h };
}

function pinchDistance() {
  const p = [...pointers.values()];
  return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1;
}

function beginPan(x, y) {
  gesture = { type: 'pan', x0: x, y0: y, px: state.panX, py: state.panY, t0: performance.now(), moved: false };
}

stage.addEventListener('pointerdown', (e) => {
  try { stage.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) gesture = { type: 'pinch', d0: pinchDistance(), z0: state.zoom };
  else if (pointers.size === 1) beginPan(e.clientX, e.clientY);
});

stage.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId) || !gesture) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (gesture.type === 'pinch' && pointers.size >= 2) {
    setZoom(gesture.z0 * (pinchDistance() / gesture.d0));
  } else if (gesture.type === 'pan') {
    const dxp = e.clientX - gesture.x0;
    const dyp = e.clientY - gesture.y0;
    if (Math.hypot(dxp, dyp) > 8) gesture.moved = true;
    if (state.digital > 1.001 && gesture.moved) {
      const r = displayedRect();
      let dx = dxp / r.w;
      const dy = dyp / r.h;
      if (state.facing === 'user') dx = -dx;
      state.panX = gesture.px - dx * state.crop.w;
      state.panY = gesture.py - dy * state.crop.h;
    }
  }
});

function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (gesture && gesture.type === 'pan' && !gesture.moved && performance.now() - gesture.t0 < 350 && e.type === 'pointerup') {
    tapToFocus(e.clientX, e.clientY);
  }
  if (pointers.size === 1) {
    const p = [...pointers.values()][0];
    beginPan(p.x, p.y);
    gesture.moved = true;
  } else if (pointers.size === 0) {
    gesture = null;
  }
}
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);

stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  setZoom(state.zoom * Math.exp(-e.deltaY * 0.0015));
}, { passive: false });

async function tapToFocus(x, y) {
  if (!state.focusSupported || !state.track) return;
  const r = displayedRect();
  let u = (x - r.x) / r.w;
  const v = (y - r.y) / r.h;
  if (u < 0 || u > 1 || v < 0 || v > 1) return;
  if (state.facing === 'user') u = 1 - u;
  const c = state.crop;
  const point = { x: clamp(c.x + u * c.w, 0, 1), y: clamp(c.y + v * c.h, 0, 1) };
  const ring = $('focusRing');
  ring.hidden = true;
  ring.style.left = `${x - stage.getBoundingClientRect().left}px`;
  ring.style.top = `${y - stage.getBoundingClientRect().top}px`;
  void ring.offsetWidth;
  ring.hidden = false;
  clearTimeout(tapToFocus.t);
  tapToFocus.t = setTimeout(() => { ring.hidden = true; }, 1200);
  try {
    await state.track.applyConstraints({ advanced: [{ pointsOfInterest: [point], focusMode: 'single-shot' }] });
  } catch {
    try { await state.track.applyConstraints({ advanced: [{ pointsOfInterest: [point] }] }); } catch { /* unsupported */ }
  }
}

// ---------------------------------------------------------------- top bar / modes
function qualityLabel(w, h) {
  const m = Math.max(w, h);
  if (m >= 3800) return '4K';
  if (m >= 2500) return '2.5K';
  if (m >= 1900) return '1080p';
  if (m >= 1260) return '720p';
  return `${Math.min(w, h)}p`;
}

function updateTopbar() {
  $('resBtn').textContent = state.out.w > 2 ? qualityLabel(state.out.w, state.out.h) : QUALITIES[state.quality].label;
  $('torchBtn').hidden = !state.torchSupported;
  $('torchBtn').classList.toggle('on', state.torch);
  $('micBtn').classList.toggle('on', state.micOn);
  $('micBtn').setAttribute('aria-pressed', String(state.micOn));
  const fps = $('fpsInfo');
  fps.hidden = state.mode !== 'slow';
  fps.textContent = `${Math.round(state.trackFps)} fps`;
}

function renderModeOptions() {
  const box = $('modeOptions');
  box.textContent = '';
  const add = (html) => { const s = document.createElement('span'); s.textContent = html; box.appendChild(s); };
  const btn = (label, active, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.classList.toggle('active', active);
    b.addEventListener('click', onClick);
    box.appendChild(b);
  };
  if (state.mode === 'fast') {
    add('هر');
    for (const i of TL_INTERVALS) {
      btn(`${faNum(i)} ثانیه`, i === state.tlInterval, () => { state.tlInterval = i; saveSettings(); renderModeOptions(); });
    }
    add(`یک فریم ← ${faNum(Math.round(state.tlInterval * OUT_FPS))} برابر سریع‌تر · بدون صدا`);
  } else if (state.mode === 'slow') {
    for (const f of SLOW_FACTORS) {
      btn(`${faNum(f)}× آهسته`, f === state.slowFactor, () => { state.slowFactor = f; saveSettings(); renderModeOptions(); });
    }
    add('بدون صدا');
  } else if (state.mode === 'video' && !state.micOn) {
    add('🎤 صدا خاموش است؛ برای ضبط صدا دکمه میکروفون بالا را بزن');
  }
}

function updateModeUI() {
  for (const b of $('modes').children) b.classList.toggle('active', b.dataset.mode === state.mode);
  const sh = $('shutterBtn');
  sh.className = `shutter ${state.mode === 'photo' ? '' : state.mode}`.trim();
  sh.setAttribute('aria-label', state.mode === 'photo' ? 'گرفتن عکس' : 'شروع ضبط');
  renderModeOptions();
  updateTopbar();
}

async function setMode(mode) {
  if (state.rec || state.busy || mode === state.mode) return;
  if ((mode === 'fast' || mode === 'slow') && !webCodecsSupported()) {
    toast('این مرورگر از ساخت ویدیوی سریع/آهسته پشتیبانی نمی‌کند. لطفاً Chrome یا Safari به‌روز را استفاده کن.', 5000);
    return;
  }
  const before = profileFor(state.mode);
  state.mode = mode;
  saveSettings();
  updateModeUI();
  if (profileFor(mode) !== before && state.track) {
    state.busy = true;
    try { await reopenCamera(); } finally { state.busy = false; updateTopbar(); }
    if (mode === 'slow' && state.trackFps <= 31) {
      toast(`دوربین این دستگاه در مرورگر حداکثر ${faNum(Math.round(state.trackFps))} فریم در ثانیه می‌دهد؛ فریم‌های بین آن‌ها ساخته می‌شود تا حرکت نرم بماند.`, 6000);
    }
  }
}

// ---------------------------------------------------------------- mic / torch / flip / quality
async function ensureMic() {
  const t = state.audioStream && state.audioStream.getAudioTracks()[0];
  if (t && t.readyState === 'live') return t;
  try {
    state.audioStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    return state.audioStream.getAudioTracks()[0] || null;
  } catch (err) {
    console.warn('microphone', err);
    return null;
  }
}

function releaseMic() {
  if (state.audioStream) for (const t of state.audioStream.getTracks()) t.stop();
  state.audioStream = null;
}

async function toggleMic() {
  if (state.rec) return;
  if (state.micOn) {
    state.micOn = false;
    releaseMic();
    toast('میکروفون خاموش شد.');
  } else {
    const t = await ensureMic();
    if (t) { state.micOn = true; toast('میکروفون روشن شد؛ ویدیوها با صدا ضبط می‌شوند.'); }
    else toast('اجازه میکروفون داده نشد. از تنظیمات سایت در مرورگر، «میکروفون» را مجاز کن.', 5000);
  }
  saveSettings();
  updateTopbar();
  renderModeOptions();
}

async function setTorch(on) {
  if (!state.track || !state.torchSupported) return;
  try {
    await state.track.applyConstraints({ advanced: [{ torch: on }] });
    state.torch = on;
  } catch {
    state.torch = false;
  }
  updateTopbar();
}

async function flipCamera() {
  if (state.busy || (state.rec && state.rec.kind !== 'video')) return;
  state.busy = true;
  const old = state.facing;
  state.facing = old === 'user' ? 'environment' : 'user';
  state.zoom = 1;
  state.panX = 0.5;
  state.panY = 0.5;
  try {
    const ok = await reopenCamera();
    if (!ok && !state.track) {
      state.facing = old;
      await reopenCamera();
    }
  } finally {
    state.busy = false;
    saveSettings();
  }
}

async function cycleQuality() {
  if (state.rec || state.busy) return;
  const i = QUALITY_ORDER.indexOf(state.quality);
  state.quality = QUALITY_ORDER[(i + 1) % QUALITY_ORDER.length];
  saveSettings();
  state.busy = true;
  try { await reopenCamera(); } finally { state.busy = false; }
  await new Promise((r) => setTimeout(r, 300));
  const wanted = QUALITIES[state.quality].label;
  const got = qualityLabel(state.out.w, state.out.h);
  updateTopbar();
  if (wanted !== got && state.mode !== 'slow') toast(`حداکثر کیفیت این دوربین در مرورگر ${got} است.`);
  else toast(`کیفیت: ${got}`);
}

// ---------------------------------------------------------------- capture
function bitrateFor(W, H) {
  const px = W * H;
  if (px >= 3840 * 2160 * 0.9) return 40e6;
  if (px >= 2560 * 1440 * 0.9) return 24e6;
  if (px >= 1920 * 1080 * 0.9) return 14e6;
  if (px >= 1280 * 720 * 0.9) return 7e6;
  return 4e6;
}

function pickMime(withAudio) {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  const list = withAudio
    ? ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return list.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || '';
}

function flash() {
  const f = $('flash');
  f.classList.remove('go');
  void f.offsetWidth;
  f.classList.add('go');
}

async function takePhoto() {
  if (!state.track || !loop.running) return;
  flash();
  try {
    const shot = await new Promise((resolve, reject) => {
      state.photoRequest = { resolve };
      setTimeout(() => {
        if (state.photoRequest) { state.photoRequest = null; reject(new Error('no-frame')); }
      }, 5000);
    });
    const { W, H } = shot;
    const [blob, thumb] = await Promise.all([shot.blob, shot.thumb]);
    await saveMedia({ kind: 'photo', mode: 'photo', mime: 'image/jpeg', blob, thumb, width: W, height: H });
    toast(`عکس ذخیره شد (${ltr(`${qualityLabel(W, H)} · ${W}×${H}`)})`, 1800);
  } catch (err) {
    console.error(err);
    toast('گرفتن عکس ناموفق بود.');
  }
}

async function startRecording() {
  if (!state.track || state.track.readyState !== 'live' || state.out.w < 4 || !renderer.sourceW) { toast('دوربین آماده نیست.'); return; }
  state.busy = true;
  const id = `rec-${Date.now()}`;
  const thumb = await thumbFromSource(canvas, canvas.width, canvas.height).catch(() => null);
  // Switch the canvas to the full output resolution before any recorder looks at it.
  const W = state.out.w;
  const H = state.out.h;
  state.locked = { w: W, h: H };
  renderer.setSize(W, H);
  const first = drawCurrent();
  if (first) renderer.draw(first);
  try {
    if (state.mode === 'video') await startVideoRecording(id, thumb, W, H);
    else await startFrameRecording(state.mode, id, thumb, W, H);
    enterRecordingUI();
  } catch (err) {
    console.error(err);
    state.rec = null;
    state.locked = null;
    const msg = err && err.message;
    if (msg === 'codec-unsupported' || msg === 'webcodecs-unsupported') toast('این مرورگر نمی‌تواند این نوع ویدیو را بسازد. Chrome یا Safari به‌روز را امتحان کن.', 5000);
    else if (msg === 'recorder-unsupported') toast('ضبط ویدیو در این مرورگر پشتیبانی نمی‌شود. Chrome یا Safari به‌روز را امتحان کن.', 5000);
    else toast('شروع ضبط ناموفق بود.');
  } finally {
    state.busy = false;
  }
}

async function startVideoRecording(id, thumb, W, H) {
  if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) throw new Error('recorder-unsupported');
  let audioTrack = null;
  if (state.micOn) {
    audioTrack = await ensureMic();
    if (!audioTrack) toast('میکروفون در دسترس نیست؛ ویدیو بدون صدا ضبط می‌شود.');
  }
  const fps = clamp(Math.round(state.trackFps || 30), 15, 60);
  const vStream = canvas.captureStream(fps);
  const tracks = vStream.getVideoTracks();
  if (audioTrack) tracks.push(audioTrack);
  const mixed = new MediaStream(tracks);
  const mime = pickMime(!!audioTrack);
  const opts = { videoBitsPerSecond: bitrateFor(W, H) };
  if (mime) opts.mimeType = mime;
  if (audioTrack) opts.audioBitsPerSecond = 160000;
  let mr;
  try { mr = new MediaRecorder(mixed, opts); } catch { mr = new MediaRecorder(mixed); }
  const rec = {
    kind: 'video', id, mr, mime: mime || 'video/webm', chunks: [], index: 0,
    start: performance.now(), W, H, thumb, vStream, audio: !!audioTrack, writes: Promise.resolve(),
  };
  rec.stopped = new Promise((resolve) => { mr.onstop = resolve; });
  mr.ondataavailable = (e) => {
    if (!e.data || !e.data.size) return;
    rec.chunks.push(e.data);
    const i = rec.index++;
    rec.writes = rec.writes.then(() => store.addChunk(id, i, e.data)).catch(() => {});
  };
  mr.onerror = (e) => {
    console.error('MediaRecorder error', e.error || e);
    toast('خطا در ضبط؛ بخش ضبط‌شده ذخیره می‌شود.');
    stopRecording('error');
  };
  mr.start(1000);
  rec.mime = mr.mimeType || mime || 'video/webm';
  rec.writes = store.beginRecording({ id, mime: rec.mime, created: Date.now(), mode: 'video', width: W, height: H, thumb });
  state.rec = rec;
}

async function startFrameRecording(kind, id, thumb, W, H) {
  const bitrate = bitrateFor(W, H) * (kind === 'slow' ? 1.2 : 1);
  const writer = await createMp4Writer({ width: W, height: H, fps: OUT_FPS, bitrate });
  if (state.micOn) toast(kind === 'fast' ? 'ویدیوی سریع بدون صدا ساخته می‌شود.' : 'ویدیوی آهسته بدون صدا ساخته می‌شود.', 2500);
  state.rec = {
    kind, id, writer, W, H, thumb, start: performance.now(), n: 0,
    // time-lapse
    interval: state.tlInterval * 1000, last: -Infinity,
    // slow motion
    factor: state.slowFactor, t0: null, lastReal: 0, prevT: 0, next: 0, clock: null, lastMedia: -1, stall: 0,
  };
}

function fastFrame(rec, now) {
  if (now - rec.last < rec.interval) return;
  if (rec.writer.addFrame(canvas, (rec.n * 1e6) / OUT_FPS, 1e6 / OUT_FPS)) {
    rec.n++;
    rec.last = now;
  }
}

// Slow motion: every camera frame is placed `factor` times further apart in time; the gaps
// are filled at 30 fps by blending neighbouring frames so motion stays smooth.
function slowFrame(rec, now, meta, crop, sharp) {
  if (rec.clock === null) rec.clock = meta && meta.mediaTime > 0 ? 'media' : 'now';
  let t = now;
  if (rec.clock === 'media') {
    const m = meta && meta.mediaTime;
    if (!(m > rec.lastMedia)) {
      if (++rec.stall > 10) rec.clock = 'now';
      return;
    }
    rec.stall = 0;
    rec.lastMedia = m;
    t = m * 1000;
  }
  const dur = 1 / OUT_FPS;
  if (rec.t0 === null) {
    rec.t0 = t;
    rec.lastReal = t;
    renderer.draw({ crop, sharp });
    if (rec.writer.addFrame(canvas, 0, dur * 1e6)) rec.n++;
    rec.prevT = 0;
    rec.next = dur;
    return;
  }
  if (t - rec.lastReal > 500) rec.t0 += t - rec.lastReal - 1000 / 30; // pause (e.g. app switch): skip the gap
  rec.lastReal = t;
  const T = ((t - rec.t0) / 1000) * rec.factor;
  const span = T - rec.prevT;
  if (span <= 0) return;
  let emitted = 0;
  while (rec.next <= T + 1e-9 && emitted < 16) {
    const alpha = (rec.next - rec.prevT) / span;
    renderer.draw({ crop, sharp, blend: clamp(1 - alpha, 0, 1) });
    if (rec.writer.addFrame(canvas, rec.next * 1e6, dur * 1e6)) rec.n++;
    rec.next += dur;
    emitted++;
  }
  if (rec.next <= T) rec.next = T + dur;
  rec.prevT = T;
}

let recTimer = 0;
function enterRecordingUI() {
  $('shutterBtn').classList.add('recording');
  $('shutterBtn').setAttribute('aria-label', 'توقف ضبط');
  $('modes').classList.add('locked');
  for (const id of ['galleryBtn', 'enhanceBtn', 'resBtn', 'micBtn']) $(id).disabled = true;
  $('flipBtn').disabled = state.rec.kind !== 'video';
  $('recBadge').hidden = false;
  $('blackoutBtn').hidden = false;
  acquireWakeLock();
  updateRecBadge();
  clearInterval(recTimer);
  recTimer = setInterval(updateRecBadge, 250);
}

function exitRecordingUI() {
  clearInterval(recTimer);
  $('shutterBtn').classList.remove('recording');
  $('shutterBtn').setAttribute('aria-label', 'شروع ضبط');
  $('modes').classList.remove('locked');
  for (const id of ['galleryBtn', 'enhanceBtn', 'resBtn', 'micBtn', 'flipBtn']) $(id).disabled = false;
  $('recBadge').hidden = true;
  $('blackoutBtn').hidden = true;
  exitBlackout();
}

function updateRecBadge() {
  const rec = state.rec;
  if (!rec) return;
  const secs = (performance.now() - rec.start) / 1000;
  $('recTime').textContent = fmtTime(secs);
  let info = '';
  if (rec.kind === 'video') info = rec.audio ? '🎤' : '🔇';
  if (rec.kind === 'fast') info = `${faNum(rec.n)} فریم · خروجی ${fmtTime(rec.n / OUT_FPS)}`;
  if (rec.kind === 'slow') info = `${rec.factor}× آهسته · خروجی ${fmtTime(rec.n / OUT_FPS)}`;
  $('recInfo').textContent = info;
}

let stoppedWhileHidden = false;

async function stopRecording(reason = 'user') {
  const rec = state.rec;
  if (!rec || rec.stopping) return;
  rec.stopping = true;
  state.rec = null;
  exitRecordingUI();
  if (reason === 'hidden') stoppedWhileHidden = true;
  if (rec.kind !== 'video') showBusy('در حال ساخت ویدیو…');
  try {
    if (rec.kind === 'video') {
      if (rec.mr.state !== 'inactive') rec.mr.stop();
      await Promise.race([rec.stopped, new Promise((r) => setTimeout(r, 6000))]);
      for (const t of rec.vStream.getTracks()) t.stop();
      await rec.writes;
      const blob = new Blob(rec.chunks, { type: rec.mime });
      if (!blob.size) throw new Error('no-frames');
      await saveMedia({
        id: rec.id, kind: 'video', mode: 'video', mime: rec.mime, blob, thumb: rec.thumb,
        width: rec.W, height: rec.H, duration: (performance.now() - rec.start) / 1000,
      });
      await store.endRecording(rec.id);
    } else {
      const blob = await rec.writer.finish();
      await saveMedia({
        id: rec.id, kind: 'video', mode: rec.kind, mime: 'video/mp4', blob, thumb: rec.thumb,
        width: rec.writer.width, height: rec.writer.height, duration: (rec.writer.lastTs + 1e6 / OUT_FPS) / 1e6,
      });
    }
    if (reason === 'hidden') toast('صفحه خاموش/قفل شد؛ ضبط متوقف و ذخیره شد.', 5000);
    else toast('ویدیو در گالری برنامه ذخیره شد.');
  } catch (err) {
    console.error(err);
    if (rec.writer) rec.writer.abort();
    toast(err && err.message === 'no-frames' ? 'ویدیو خیلی کوتاه بود و ذخیره نشد.' : 'ذخیره ویدیو ناموفق بود.');
  } finally {
    hideBusy();
    state.locked = null;
    releaseWakeLock();
    if (state.screen === 'camScreen') acquireWakeLock();
  }
}

async function onShutter() {
  if (state.busy) return;
  if (state.rec) { await stopRecording('user'); return; }
  if (state.mode === 'photo') { await takePhoto(); return; }
  await startRecording();
}

// ---------------------------------------------------------------- black screen while recording
let lastBlackTap = 0;
let blackDimTimer = 0;
function enterBlackout() {
  const b = $('blackout');
  b.hidden = false;
  b.classList.remove('dim');
  clearTimeout(blackDimTimer);
  blackDimTimer = setTimeout(() => b.classList.add('dim'), 3000);
  // Fullscreen also hides the status and navigation bars. The request resolves later, so if
  // the black screen was already closed by then, leave fullscreen again.
  try {
    const req = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    if (req && req.then) {
      req.then(() => { if (b.hidden && document.fullscreenElement) document.exitFullscreen().catch(() => {}); }).catch(() => {});
    }
  } catch { /* optional */ }
}
function exitBlackout() {
  const b = $('blackout');
  if (b.hidden) return;
  b.hidden = true;
  clearTimeout(blackDimTimer);
  try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch { /* optional */ }
}
$('blackout').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const now = e.timeStamp || performance.now();
  if (now - lastBlackTap < 450) exitBlackout();
  else {
    $('blackout').classList.remove('dim');
    clearTimeout(blackDimTimer);
    blackDimTimer = setTimeout(() => $('blackout').classList.add('dim'), 2000);
  }
  lastBlackTap = now;
});

// ---------------------------------------------------------------- gallery
const galleryUrls = [];
let viewerItem = null;
let viewerUrl = '';

async function saveMedia(item) {
  item.id = item.id || `${item.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  item.created = item.created || Date.now();
  item.size = item.blob.size;
  try {
    await store.addMedia(item);
  } catch (err) {
    console.warn(err);
    toast('حافظه برنامه پر است؛ این مورد فقط تا بسته شدن برنامه نگه داشته می‌شود. آن را از گالری «ذخیره در دستگاه» کن.', 6000);
  }
  setGalleryThumb(item.thumb);
  return item;
}

let thumbUrl = '';
function setGalleryThumb(blob) {
  const img = $('galleryThumb');
  if (thumbUrl) URL.revokeObjectURL(thumbUrl);
  thumbUrl = '';
  if (blob) {
    thumbUrl = URL.createObjectURL(blob);
    img.src = thumbUrl;
    img.hidden = false;
  } else {
    img.hidden = true;
  }
}

async function refreshGalleryThumb() {
  const items = await store.listMedia();
  setGalleryThumb(items[0] ? items[0].thumb : null);
}

function releaseGalleryUrls() {
  while (galleryUrls.length) URL.revokeObjectURL(galleryUrls.pop());
}

async function renderGallery() {
  releaseGalleryUrls();
  const grid = $('galleryGrid');
  const items = await store.listMedia();
  grid.textContent = '';
  $('galleryEmpty').hidden = items.length > 0;
  const total = items.reduce((s, i) => s + (i.size || 0), 0);
  $('galleryCount').textContent = items.length ? `${faNum(items.length)} مورد · ${fmtBytes(total)}` : '';
  for (const it of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'g-item';
    if (it.thumb) {
      const url = URL.createObjectURL(it.thumb);
      galleryUrls.push(url);
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.loading = 'lazy';
      b.appendChild(img);
    }
    const kind = document.createElement('span');
    kind.className = 'g-kind';
    kind.textContent = (it.recovered ? 'بازیابی‌شده · ' : '') + (MODE_LABEL[it.mode] || (it.kind === 'video' ? 'ویدیو' : 'عکس'));
    b.appendChild(kind);
    if (it.kind === 'video') {
      const badge = document.createElement('span');
      badge.className = 'g-badge';
      badge.textContent = `▶ ${fmtTime(it.duration || 0)}`;
      b.appendChild(badge);
    }
    b.addEventListener('click', () => openViewer(it.id));
    grid.appendChild(b);
  }
}

async function openViewer(id) {
  const it = await store.getMedia(id);
  if (!it) { toast('این مورد پیدا نشد.'); return; }
  viewerItem = it;
  openPage('viewerScreen');
}

function renderViewer() {
  const it = viewerItem;
  const body = $('viewerBody');
  body.textContent = '';
  if (!it) return;
  if (viewerUrl) URL.revokeObjectURL(viewerUrl);
  viewerUrl = URL.createObjectURL(it.blob);
  let el;
  if (it.kind === 'video') {
    el = document.createElement('video');
    el.controls = true;
    el.playsInline = true;
    el.preload = 'metadata';
    el.src = viewerUrl;
  } else {
    el = document.createElement('img');
    el.src = viewerUrl;
    el.alt = '';
  }
  body.appendChild(el);
  const d = new Date(it.created);
  $('viewerTitle').textContent = MODE_LABEL[it.mode] || (it.kind === 'video' ? 'ویدیو' : 'عکس');
  const res = it.width ? ltr(`${it.width}×${it.height}`) : '';
  $('viewerMeta').textContent = [d.toLocaleString('fa-IR'), res, fmtBytes(it.size || it.blob.size)].filter(Boolean).join(' · ');
  $('vEnhance').hidden = it.kind !== 'photo';
}

function closeViewer() {
  const v = $('viewerBody').querySelector('video');
  if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
  $('viewerBody').textContent = '';
  if (viewerUrl) URL.revokeObjectURL(viewerUrl);
  viewerUrl = '';
}

// ---------------------------------------------------------------- permission screen
function showPermissionError(err) {
  stopLoop();
  show('permScreen');
  const el = $('permError');
  el.textContent = cameraErrorText(err);
  el.hidden = false;
  $('permBtn').textContent = 'تلاش دوباره';
  $('permBtn').disabled = false;
}

async function requestCamera() {
  const btn = $('permBtn');
  btn.disabled = true;
  $('permError').hidden = true;
  btn.textContent = 'در حال درخواست اجازه دوربین…';
  try {
    await openCamera();
    show('camScreen');
    if (state.micWanted && !state.micOn) restoreMic();
  } catch (err) {
    console.error(err);
    showPermissionError(err);
  }
}

async function restoreMic() {
  // Re-enable the microphone silently only if it was already allowed before.
  try {
    const st = await navigator.permissions.query({ name: 'microphone' });
    if (st.state !== 'granted') return;
    if (await ensureMic()) { state.micOn = true; updateTopbar(); renderModeOptions(); }
  } catch { /* permissions API not available: leave the mic off */ }
}

// ---------------------------------------------------------------- wiring
function bindUI() {
  $('permBtn').addEventListener('click', requestCamera);
  $('permEnhanceBtn').addEventListener('click', () => openPage('enhanceScreen'));
  $('shutterBtn').addEventListener('click', onShutter);
  $('flipBtn').addEventListener('click', flipCamera);
  $('micBtn').addEventListener('click', toggleMic);
  $('torchBtn').addEventListener('click', () => setTorch(!state.torch));
  $('resBtn').addEventListener('click', cycleQuality);
  $('galleryBtn').addEventListener('click', () => openPage('galleryScreen'));
  $('enhanceBtn').addEventListener('click', () => openPage('enhanceScreen'));
  $('helpBtn').addEventListener('click', () => { $('helpDlg').hidden = false; });
  $('helpDlg').addEventListener('click', (e) => { if (e.target === $('helpDlg') || e.target.closest('[data-close]')) $('helpDlg').hidden = true; });
  $('blackoutBtn').addEventListener('click', enterBlackout);
  for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', goBack);

  $('modes').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mode]');
    if (b) setMode(b.dataset.mode);
  });
  $('zoomPresets').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-z]');
    if (b) setZoom(Number(b.dataset.z));
  });
  $('zoomSlider').addEventListener('input', (e) => setZoom(sliderToZoom(Number(e.target.value))));

  $('vSave').addEventListener('click', () => { if (viewerItem) downloadBlob(viewerItem.blob, fileNameFor(viewerItem)); });
  $('vShare').addEventListener('click', () => { if (viewerItem) shareBlob(viewerItem.blob, fileNameFor(viewerItem)); });
  $('vEnhance').addEventListener('click', () => {
    if (!viewerItem) return;
    const it = viewerItem;
    openPage('enhanceScreen');
    loadIntoEnhancer(new File([it.blob], fileNameFor(it), { type: it.mime || it.blob.type || 'image/jpeg' }));
  });
  $('vDelete').addEventListener('click', async () => {
    if (!viewerItem || !confirm('این مورد برای همیشه حذف شود؟')) return;
    await store.deleteMedia(viewerItem.id);
    viewerItem = null;
    await refreshGalleryThumb();
    goBack();
  });

  // iPad/iPhone ignore user-scalable=no: block page pinch-zoom so pinch goes to the camera zoom.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }

  document.addEventListener('keydown', (e) => {
    if (state.screen !== 'camScreen' || e.target.tagName === 'INPUT') return;
    if (e.key === '+' || e.key === '=') setZoom(state.zoom * 1.25);
    else if (e.key === '-') setZoom(state.zoom / 1.25);
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onShutter(); }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.rec) stopRecording('hidden');
      if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
    } else {
      if (state.screen === 'camScreen') {
        acquireWakeLock();
        if (!state.track || state.track.readyState !== 'live') reopenCamera();
      }
      if (stoppedWhileHidden) {
        stoppedWhileHidden = false;
        toast('وقتی صفحه خاموش/قفل شد، مرورگر دوربین را قطع کرد؛ ضبط تا همان لحظه در گالری ذخیره شد. برای ضبط طولانی از دکمه «خاموش کردن صفحه» استفاده کن.', 7000);
      }
    }
  });
  window.addEventListener('pagehide', () => { if (state.rec) stopRecording('hidden'); });
  window.addEventListener('beforeunload', (e) => {
    if (state.rec) { e.preventDefault(); e.returnValue = ''; }
  });
}

function registerServiceWorker() {
  if (window.__CAMERA_SINGLE_FILE) return;
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || local)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

async function boot() {
  renderer = new Renderer(canvas);
  canvas = renderer.canvas;
  bindUI();
  updateModeUI();
  initEnhancer({ saveToGallery: saveMedia });
  registerServiceWorker();
  await store.init();
  try {
    const n = await store.recoverPending(thumbFromVideoBlob);
    if (n) toast(`${faNum(n)} ویدیوی نیمه‌کاره (قطع‌شده) بازیابی و در گالری ذخیره شد.`, 6000);
  } catch { /* ignore */ }
  refreshGalleryThumb();
  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showPermissionError(new Error('insecure'));
    return;
  }
  // Ask for the camera (only the camera) as soon as the app opens.
  requestCamera();
}

boot();

// Exposed for automated testing only.
window.__camera = { state, setZoom, setMode, onShutter, stopRecording, loop };
