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

export function modelFor(lang: LangCode, enabled: LangCode[]): string {
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
export async function recognizeSpeech(original: Blob, lang: LangCode, enabled: LangCode[], onProgress?: ProgressFn): Promise<string> {
  const model = modelFor(lang, enabled);
  const [pipe, samples] = await Promise.all([loadRecognizer(model, onProgress), decodeTo16kMono(original)]);
  // ".en" models are English-only and take no language option; the multilingual model is told the language.
  const opts: Record<string, unknown> = model.endsWith('.en') ? {} : { language: LANGS[lang].whisper, task: 'transcribe' };
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
