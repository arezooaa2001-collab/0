import { isNativeApp, nativeCanListen, nativeListen, nativeStopListening } from './native';

// Speech-to-text for talking with the tutor (the browser's own speech recognition).
type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

function ctor(): (new () => Rec) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canListen = (): boolean => nativeCanListen() || (!isNativeApp() && !!ctor());

export class ListenError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

let active: Rec | null = null;

/** Listen once and resolve with what was said ('' if nothing). */
export function listenOnce(lang: string): Promise<string> {
  if (isNativeApp()) {
    // Android app: the phone's own speech recognition (the in-app browser has none).
    return nativeListen(lang).then((r) => {
      if (r.error && r.error !== 'no-speech') throw new ListenError(r.error);
      return r.text;
    });
  }
  const C = ctor();
  if (!C) return Promise.reject(new ListenError('unsupported'));
  stopListening();
  return new Promise((resolve, reject) => {
    const r = new C();
    active = r;
    r.lang = lang;
    r.interimResults = false;
    r.continuous = false;
    r.maxAlternatives = 1;
    let text = '';
    let done = false;
    // Safety net: some devices never end a recognition session. Stop waiting after 20 s.
    const limit = setTimeout(() => {
      try {
        r.abort();
      } catch {
        /* ignore */
      }
      finish();
    }, 20_000);
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(limit);
      if (active === r) active = null;
      resolve(text);
    };
    r.onresult = (e) => {
      text = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? '')
        .join(' ')
        .trim();
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return; // onend resolves with ''
      if (done) return;
      done = true;
      clearTimeout(limit);
      active = null;
      reject(new ListenError(e.error));
    };
    r.onend = finish;
    try {
      r.start();
    } catch (e) {
      done = true;
      clearTimeout(limit);
      active = null;
      reject(new ListenError(String((e as Error)?.name ?? 'start')));
    }
  });
}

export function stopListening(): void {
  nativeStopListening();
  try {
    active?.abort();
  } catch {
    /* ignore */
  }
  active = null;
}
