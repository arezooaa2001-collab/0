// On-device English speech recognition with OpenAI Whisper (tiny.en, English-only model)
// running inside the browser through transformers.js. No account and no server of our own.
//
// The first time, the browser downloads the library and the model (~40 MB, needs internet),
// then keeps them in its cache. The recording itself never leaves the device.
//
// The original recording is never changed: a temporary 16 kHz copy is decoded in memory
// for the recognizer and thrown away.

export interface AsrConfig {
  libUrl: string;
  model: string;
  /** Optional mirrors (for self-hosting); undefined = library defaults (Hugging Face / jsDelivr). */
  remoteHost?: string;
  remotePathTemplate?: string;
  wasmPaths?: string;
}

const DEFAULTS: AsrConfig = {
  libUrl: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js',
  model: 'Xenova/whisper-tiny.en',
};

function config(): AsrConfig {
  const override = (globalThis as { __ECHOWORDS_ASR__?: Partial<AsrConfig> }).__ECHOWORDS_ASR__;
  return { ...DEFAULTS, ...(override ?? {}) };
}

type Pipe = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string } | { text: string }[]>;

export type ProgressFn = (fraction: number) => void;

let pipePromise: Promise<Pipe> | null = null;
const progressListeners = new Set<ProgressFn>();

/** Load (once) the recognizer. Progress is reported 0..1 while the model downloads. */
export function loadRecognizer(onProgress?: ProgressFn): Promise<Pipe> {
  if (onProgress) progressListeners.add(onProgress);
  if (!pipePromise) {
    const cfg = config();
    const files = new Map<string, { loaded: number; total: number }>();
    pipePromise = (async () => {
      const lib = await import(/* @vite-ignore */ cfg.libUrl);
      lib.env.allowLocalModels = false;
      if (cfg.remoteHost) lib.env.remoteHost = cfg.remoteHost;
      if (cfg.remotePathTemplate) lib.env.remotePathTemplate = cfg.remotePathTemplate;
      if (cfg.wasmPaths) lib.env.backends.onnx.wasm.wasmPaths = cfg.wasmPaths;
      try {
        lib.env.useBrowserCache = typeof caches !== 'undefined';
      } catch {
        lib.env.useBrowserCache = false;
      }
      const pipe = await lib.pipeline('automatic-speech-recognition', cfg.model, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
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
      pipePromise = null; // allow a later retry (e.g. when the internet is back)
      throw e;
    });
  }
  return pipePromise.finally(() => {
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

/** Recognize English speech in a recording. Returns the raw text from the model. */
export async function recognizeEnglish(original: Blob, onProgress?: ProgressFn): Promise<string> {
  const [pipe, samples] = await Promise.all([loadRecognizer(onProgress), decodeTo16kMono(original)]);
  const model = config().model;
  // English-only (".en") models need no language option; a multilingual model is forced to English.
  const opts: Record<string, unknown> = model.endsWith('.en') ? {} : { language: 'english', task: 'transcribe' };
  await new Promise((r) => setTimeout(r, 30)); // let the UI paint "working…" before the CPU-heavy step
  const out = await pipe(samples, opts);
  return Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text;
}
