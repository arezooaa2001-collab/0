// On-device English speech recognition with OpenAI Whisper (tiny.en, English-only model)
// running inside the browser through transformers.js. No account and no server of our own.
//
// The first time, the browser downloads the library and the model (~40 MB, needs internet),
// then keeps them in its cache. The recording itself never leaves the device.
//
// The original recording is never changed: a temporary 16 kHz copy is decoded in memory
// for the recognizer and thrown away.

import { LANGS, type LangCode } from './langs';

export interface AsrConfig {
  libUrl: string;
  /** Forces one model for every language (self-hosting/tests). Otherwise chosen per language. */
  model?: string;
  /** Optional mirrors (for self-hosting); undefined = library defaults (Hugging Face / jsDelivr). */
  remoteHost?: string;
  remotePathTemplate?: string;
  wasmPaths?: string;
}

const DEFAULTS: AsrConfig = {
  libUrl: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js',
};
/** English-only model: best for English, used when English is the only language switched on. */
export const MODEL_EN = 'Xenova/whisper-tiny.en';
/** One multilingual model for Persian, French, Chinese, Japanese, Hindi (and English when mixed). */
export const MODEL_MULTI = 'Xenova/whisper-tiny';

export function modelFor(lang: LangCode | 'auto', enabled: LangCode[]): string {
  const forced = config().model;
  if (forced) return forced;
  return lang === 'en' && enabled.every((l) => l === 'en') ? MODEL_EN : MODEL_MULTI;
}

function config(): AsrConfig {
  const override = (globalThis as { __ECHOWORDS_ASR__?: Partial<AsrConfig> }).__ECHOWORDS_ASR__;
  return { ...DEFAULTS, ...(override ?? {}) };
}

type Pipe = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string } | { text: string }[]>;

export type ProgressFn = (fraction: number) => void;

/** If the download makes no progress for this long, stop waiting (it may continue in the background). */
export const STALL_MS = 20_000;
/** Upper limit for recognizing one recording once the model is ready. */
export const RECOGNIZE_MS = 90_000;

const pipes = new Map<string, Promise<Pipe>>();
let lastActivity = 0;
const progressListeners = new Set<ProgressFn>();

export class AsrUnavailable extends Error {}

function startLoading(model: string): Promise<Pipe> {
  const cfg = config();
  const files = new Map<string, { loaded: number; total: number }>();
  lastActivity = Date.now();
  return (async () => {
    const lib = await import(/* @vite-ignore */ cfg.libUrl);
    lastActivity = Date.now();
    lib.env.allowLocalModels = false;
    if (cfg.remoteHost) lib.env.remoteHost = cfg.remoteHost;
    if (cfg.remotePathTemplate) lib.env.remotePathTemplate = cfg.remotePathTemplate;
    if (cfg.wasmPaths) lib.env.backends.onnx.wasm.wasmPaths = cfg.wasmPaths;
    try {
      lib.env.useBrowserCache = typeof caches !== 'undefined';
    } catch {
      lib.env.useBrowserCache = false;
    }
    const pipe = await lib.pipeline('automatic-speech-recognition', model, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        lastActivity = Date.now();
        if (p.status === 'progress' && p.file && p.total) {
          files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
          let loaded = 0;
          let total = 0;
          for (const f of files.values()) {
            loaded += f.loaded;
            total += f.total;
          }
          progressListeners.forEach((l) => l(total ? loaded / total : 0));
        }
      },
    });
    progressListeners.forEach((l) => l(1));
    return pipe as Pipe;
  })().catch((e) => {
    pipes.delete(model); // allow a later retry (e.g. when the internet is back)
    throw e;
  });
}

/**
 * Load (once) the recognizer. Progress is reported 0..1 while the model downloads.
 * Rejects with AsrUnavailable if the download stalls, so the app never waits forever.
 */
export function loadRecognizer(model: string, onProgress?: ProgressFn): Promise<Pipe> {
  if (onProgress) progressListeners.add(onProgress);
  if (!pipes.has(model)) pipes.set(model, startLoading(model));
  const loading = pipes.get(model)!;
  let timer: ReturnType<typeof setInterval> | undefined;
  const watchdog = new Promise<never>((_, reject) => {
    timer = setInterval(() => {
      if (Date.now() - lastActivity > STALL_MS) reject(new AsrUnavailable('model download stalled'));
    }, 1000);
  });
  return Promise.race([loading, watchdog]).finally(() => {
    clearInterval(timer);
    if (onProgress) progressListeners.delete(onProgress);
  });
}

/** Decode any recorded format into 16 kHz mono samples (a temporary copy for the recognizer). */
export async function decodeTo16kMono(original: Blob): Promise<Float32Array> {
  const copy = await original.arrayBuffer(); // decodeAudioData consumes its buffer; the original blob stays intact
  const Offline = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const decoded = await new Offline(1, 1, 16000).decodeAudioData(copy);
  // Resample explicitly in case the browser decoded at another rate.
  const length = Math.max(1, Math.ceil(decoded.duration * 16000));
  const ctx = new Offline(1, length, 16000);
  const src = ctx.createBufferSource();
  src.buffer = decoded;
  src.connect(ctx.destination); // multi-channel input is down-mixed to mono
  src.start();
  const rendered = await ctx.startRendering();
  return rendered.getChannelData(0);
}

/** Recognize speech in one language. Returns the raw text from the model. */
export async function recognizeSpeech(original: Blob, lang: LangCode | 'auto', enabled: LangCode[], onProgress?: ProgressFn): Promise<string> {
  const model = modelFor(lang, enabled);
  // ".en" models are English-only and take no language option; the multilingual model is told the language.
  // 'auto': the multilingual model detects the language itself (any language, no setting needed).
  const opts: Record<string, unknown> = model.endsWith('.en') ? {} : lang === 'auto' ? { task: 'transcribe' } : { language: LANGS[lang].whisper, task: 'transcribe' };
  const samples = await decodeTo16kMono(original);
  let tryPageInstead = false;
  // The recognizer runs in a background thread, so saving, buttons and sounds never wait for it.
  // If this page cannot start one (old browser, strict viewer), it runs here as before.
  if (workerUsable !== false) {
    try {
      // Until the worker has proven itself, it gets a copy (the samples are handed over, not shared).
      return await recognizeInWorker(model, workerUsable ? samples : samples.slice(), opts, onProgress);
    } catch (e) {
      if (!(e instanceof WorkerUnavailable)) throw e;
      console.warn('speech recognition: no background thread here, using the page itself', e.message);
      tryPageInstead = true;
    }
  }
  const pipe = await loadRecognizer(model, onProgress);
  // The library loads in the page but not in the worker: stop trying the worker on this page.
  // (If neither loads, it is the internet: the worker is tried again next time.)
  if (tryPageInstead) workerUsable = false;
  (globalThis as { __ECHOWORDS_ASR_THREAD__?: string }).__ECHOWORDS_ASR_THREAD__ = 'page';
  await new Promise((r) => setTimeout(r, 30)); // let the UI paint "working…" before the CPU-heavy step
  let limit: ReturnType<typeof setTimeout> | undefined;
  const out = await Promise.race([
    pipe(samples, opts),
    new Promise<never>((_, reject) => {
      limit = setTimeout(() => reject(new AsrUnavailable('recognition took too long')), RECOGNIZE_MS);
    }),
  ]).finally(() => clearTimeout(limit));
  return Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text;
}

// ── Background thread (Web Worker) ──────────────────────────────────────────
class WorkerUnavailable extends Error {}
/** null = not tried yet; false = this page cannot run it. */
let workerUsable: boolean | null = null;
let worker: Worker | null = null;
let workerSeq = 0;
const workerJobs = new Map<number, (m: WorkerMsg) => void>();

type WorkerMsg =
  | { type: 'progress'; id: number; fraction: number }
  | { type: 'loaded'; id: number }
  | { type: 'result'; id: number; text: string }
  | { type: 'error'; id: number; stage: 'import' | 'load' | 'run'; message: string };

const WORKER_SOURCE = `
let lib = null;
const pipes = new Map();
self.onmessage = async (e) => {
  const m = e.data;
  const say = (x) => self.postMessage({ id: m.id, ...x });
  let stage = 'import';
  try {
    if (!lib) {
      lib = await import(m.cfg.libUrl);
      lib.env.allowLocalModels = false;
      if (m.cfg.remoteHost) lib.env.remoteHost = m.cfg.remoteHost;
      if (m.cfg.remotePathTemplate) lib.env.remotePathTemplate = m.cfg.remotePathTemplate;
      if (m.cfg.wasmPaths) lib.env.backends.onnx.wasm.wasmPaths = m.cfg.wasmPaths;
      try { lib.env.useBrowserCache = typeof caches !== 'undefined'; } catch (_) { lib.env.useBrowserCache = false; }
    }
    stage = 'load';
    let p = pipes.get(m.model);
    if (!p) {
      const files = new Map();
      p = lib.pipeline('automatic-speech-recognition', m.model, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (x) => {
          if (x.status === 'progress' && x.file && x.total) files.set(x.file, { loaded: x.loaded || 0, total: x.total });
          let loaded = 0, total = 0;
          for (const f of files.values()) { loaded += f.loaded; total += f.total; }
          self.postMessage({ id: m.id, type: 'progress', fraction: total ? loaded / total : 0 });
        },
      });
      pipes.set(m.model, p);
      p.catch(() => pipes.delete(m.model));
    }
    const pipe = await p;
    say({ type: 'loaded' });
    stage = 'run';
    const out = await pipe(m.samples, m.opts);
    say({ type: 'result', text: Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text });
  } catch (err) {
    say({ type: 'error', stage, message: String((err && err.message) || err) });
  }
};
`;

function startWorker(): Worker {
  if (worker) return worker;
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL?.createObjectURL !== 'function') throw new WorkerUnavailable('no Worker');
  let w: Worker;
  try {
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    w = new Worker(url, { type: 'module' });
  } catch (e) {
    throw new WorkerUnavailable(String((e as Error)?.message ?? e));
  }
  w.onmessage = (e: MessageEvent<WorkerMsg>) => workerJobs.get(e.data.id)?.(e.data);
  w.onerror = (e) => {
    // The worker itself could not start: every waiting job falls back to the page.
    e.preventDefault?.();
    const jobs = [...workerJobs.values()];
    workerJobs.clear();
    worker = null;
    w.terminate();
    for (const j of jobs) j({ type: 'error', id: -1, stage: 'import', message: `worker failed: ${e.message ?? 'unknown'}` });
  };
  worker = w;
  return w;
}

function recognizeInWorker(model: string, samples: Float32Array, opts: Record<string, unknown>, onProgress?: ProgressFn): Promise<string> {
  const w = startWorker();
  const id = ++workerSeq;
  const cfg = config();
  return new Promise<string>((resolve, reject) => {
    let loaded = false;
    let last = Date.now();
    const finish = () => {
      clearInterval(watch);
      clearTimeout(limit);
      workerJobs.delete(id);
    };
    // Same rules as before: a stalled download, or a recognition that takes too long, ends the wait.
    const watch = setInterval(() => {
      if (!loaded && Date.now() - last > STALL_MS) {
        finish();
        reject(new AsrUnavailable('model download stalled'));
      }
    }, 1000);
    let limit: ReturnType<typeof setTimeout> | undefined;
    workerJobs.set(id, (m) => {
      last = Date.now();
      if (m.type === 'progress') onProgress?.(Math.min(0.999, m.fraction));
      else if (m.type === 'loaded') {
        loaded = true;
        onProgress?.(1);
        limit = setTimeout(() => {
          finish();
          reject(new AsrUnavailable('recognition took too long'));
        }, RECOGNIZE_MS);
      } else if (m.type === 'result') {
        finish();
        workerUsable = true;
        (globalThis as { __ECHOWORDS_ASR_THREAD__?: string }).__ECHOWORDS_ASR_THREAD__ = 'worker';
        resolve(m.text);
      } else {
        finish();
        // Could not even start the library inside the worker (e.g. a strict page): use the page itself.
        if (m.stage === 'import' && workerUsable !== true) reject(new WorkerUnavailable(m.message));
        else reject(m.stage === 'run' ? new Error(m.message) : new AsrUnavailable(m.message));
      }
    });
    w.postMessage({ id, cfg, model, samples, opts }, [samples.buffer]);
  });
}
