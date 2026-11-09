// Bridge to the Android app (EchoWords APK). Inside the APK, the native shell injects
// `window.EchoWordsAndroid` and answers asynchronous calls through `window.__ewNative`.
// In a normal browser none of this exists and every helper reports "not native".

interface AndroidBridge {
  /** Is a device voice available for this BCP-47 tag (e.g. "fa-IR")? */
  hasVoice(tag: string): boolean;
  speak(callId: string, text: string, tag: string): void;
  stopSpeaking(): void;
  canListen(): boolean;
  listen(callId: string, tag: string): void;
  stopListening(): void;
  saveFile(callId: string, name: string, mime: string, base64: string): void;
  appVersion(): string;
  micGranted?(): boolean;
  cameraGranted?(): boolean;
  requestCamera?(callId: string): void;
  requestMic?(callId: string): void;
  openAppSettings?(): void;
  startRecording?(callId: string): void;
  recordingLevel?(): number;
  pauseRecording?(): boolean;
  resumeRecording?(): boolean;
  stopRecording?(callId: string): void;
  cancelRecording?(): void;
}

type Pending = { resolve: (v: unknown) => void; timer: ReturnType<typeof setTimeout> };
const pending = new Map<string, Pending>();
let seq = 0;

function bridge(): AndroidBridge | null {
  return (window as unknown as { EchoWordsAndroid?: AndroidBridge }).EchoWordsAndroid ?? null;
}

export const isNativeApp = (): boolean => !!bridge();

// The Android side calls window.__ewNative.done(callId, jsonResult).
(window as unknown as { __ewNative: { done: (id: string, json: string) => void } }).__ewNative = {
  done(id: string, json: string) {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    clearTimeout(p.timer);
    try {
      p.resolve(JSON.parse(json));
    } catch {
      p.resolve(null);
    }
  },
};

function call<T>(start: (id: string) => void, timeoutMs: number, onTimeout: T): Promise<T> {
  const id = `c${++seq}`;
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve(onTimeout);
    }, timeoutMs);
    pending.set(id, { resolve: resolve as (v: unknown) => void, timer });
    try {
      start(id);
    } catch {
      clearTimeout(timer);
      pending.delete(id);
      resolve(onTimeout);
    }
  });
}

export function nativeHasVoice(tag: string): boolean {
  try {
    return !!bridge()?.hasVoice(tag);
  } catch {
    return false;
  }
}

/** Speak with Android's text-to-speech. Resolves 'ok' | 'no-voice' | 'error'. */
export function nativeSpeak(text: string, tag: string): Promise<'ok' | 'no-voice' | 'error'> {
  const b = bridge();
  if (!b) return Promise.resolve('error');
  return call<{ status: 'ok' | 'no-voice' | 'error' } | null>((id) => b.speak(id, text, tag), Math.min(60_000, 6000 + text.length * 300), null).then(
    (r) => r?.status ?? 'ok',
  );
}

export function nativeStopSpeaking(): void {
  try {
    bridge()?.stopSpeaking();
  } catch {
    /* ignore */
  }
}

export function nativeCanListen(): boolean {
  try {
    return !!bridge()?.canListen();
  } catch {
    return false;
  }
}

/** Listen once with Android's speech recognition. */
export function nativeListen(tag: string): Promise<{ text: string; error: string | null }> {
  const b = bridge();
  if (!b) return Promise.resolve({ text: '', error: 'unsupported' });
  return call<{ text?: string; error?: string | null } | null>((id) => b.listen(id, tag), 25_000, null).then((r) => ({
    text: r?.text ?? '',
    error: r ? (r.error ?? null) : null,
  }));
}

export function nativeStopListening(): void {
  try {
    bridge()?.stopListening();
  } catch {
    /* ignore */
  }
}

/** Save a file through Android's "save as" screen. Resolves true when it was written. */
export async function nativeSaveFile(name: string, mime: string, data: Blob): Promise<boolean> {
  const b = bridge();
  if (!b) return false;
  const buf = new Uint8Array(await data.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const b64 = btoa(s);
  const r = await call<{ ok: boolean } | null>((id) => b.saveFile(id, name, mime, b64), 10 * 60_000, null);
  return !!r?.ok;
}

// ── Microphone permission and native recording (APK v11+) ───────────────────
export const nativeCanRecord = (): boolean => typeof bridge()?.startRecording === 'function';

export function nativeMicGranted(): boolean | null {
  try {
    const b = bridge();
    return b?.micGranted ? !!b.micGranted() : null;
  } catch {
    return null;
  }
}

/** Show Android's own «Allow microphone?» dialog. `blocked` = the user chose «Don't ask again». */
export function nativeRequestMic(): Promise<{ granted: boolean; blocked?: boolean }> {
  const b = bridge();
  if (!b?.requestMic) return Promise.resolve({ granted: false });
  return call<{ granted: boolean; blocked?: boolean } | null>((id) => b.requestMic!(id), 120_000, null).then((r) => r ?? { granted: false });
}

export function nativeOpenAppSettings(): void {
  try {
    bridge()?.openAppSettings?.();
  } catch {
    /* ignore */
  }
}

export function nativeStartRecording(): Promise<{ ok: boolean; error?: string; detail?: string }> {
  const b = bridge();
  if (!b?.startRecording) return Promise.resolve({ ok: false, error: 'unsupported' });
  return call<{ ok: boolean; error?: string; detail?: string } | null>((id) => b.startRecording!(id), 120_000, null).then(
    (r) => r ?? { ok: false, error: 'timeout' },
  );
}

export function nativeRecordingLevel(): number {
  try {
    return Number(bridge()?.recordingLevel?.() ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function nativePauseRecording(): boolean {
  try {
    return !!bridge()?.pauseRecording?.();
  } catch {
    return false;
  }
}

export function nativeResumeRecording(): boolean {
  try {
    return !!bridge()?.resumeRecording?.();
  } catch {
    return false;
  }
}

/** Stop and get the recording (AAC in .m4a). */
export async function nativeStopRecording(): Promise<{ ok: true; blob: Blob } | { ok: false; error: string }> {
  const b = bridge();
  if (!b?.stopRecording) return { ok: false, error: 'unsupported' };
  const r = await call<{ ok: boolean; error?: string; mime?: string; b64?: string } | null>((id) => b.stopRecording!(id), 30_000, null);
  if (!r?.ok || !r.b64) return { ok: false, error: r?.error ?? 'timeout' };
  const bin = atob(r.b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { ok: true, blob: new Blob([bytes], { type: r.mime || 'audio/mp4' }) };
}

export function nativeCancelRecording(): void {
  try {
    bridge()?.cancelRecording?.();
  } catch {
    /* ignore */
  }
}

/** Android app: ask for the camera with Android's own dialog (before the live camera opens). */
export function nativeRequestCamera(): Promise<{ granted: boolean; blocked?: boolean } | null> {
  const b = bridge();
  if (!b?.requestCamera) return Promise.resolve(null); // not the app (or an older app): the browser asks itself
  return call<{ granted: boolean; blocked?: boolean } | null>((id) => b.requestCamera!(id), 120_000, null).then((r) => r ?? { granted: false });
}
