// Pronunciation («تلفظ»): the device's own text-to-speech voice reads the word.
// A separate feature from «صدای خودم», which always plays the learner's own recording.
import { LANGS, type LangCode, segmentByLang } from './langs';
import { isNativeApp, nativeHasVoice, nativeSpeak, nativeStopSpeaking } from './native';
import type { Accent } from './stt';

export type SpeakResult = 'ok' | 'no-voice' | 'unsupported' | 'error';

/** The browser's own speech engine. It does NOT exist inside the Android app's WebView. */
function webSpeechAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function standardPronunciationSupported(): boolean {
  if (isNativeApp()) return true; // Android app: the phone's own text-to-speech
  return webSpeechAvailable();
}

/** Voices load asynchronously on Android/Chrome: wait for them (briefly). */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const now = window.speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener?.('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}

function ttsTag(lang: LangCode, accent: Accent): string {
  if (lang === 'en') return accent === 'uk' ? 'en-GB' : 'en-US';
  return LANGS[lang].tts;
}

export function pickVoice(voices: SpeechSynthesisVoice[], tag: string): SpeechSynthesisVoice | null {
  const norm = (s: string) => s.toLowerCase().replace('_', '-');
  const base = tag.split('-')[0];
  return (
    voices.find((v) => norm(v.lang) === norm(tag)) ??
    voices.find((v) => norm(v.lang).split('-')[0] === base) ??
    null
  );
}

export interface SpeakOutcome {
  result: SpeakResult;
  /** Languages in the text that this device has no voice for (those parts were skipped). */
  missing: LangCode[];
}

/** Speak one piece in one language. */
async function speakOne(text: string, tag: string, voice: SpeechSynthesisVoice | null): Promise<SpeakResult> {
  const synth = window.speechSynthesis;
  return new Promise<SpeakResult>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = tag;
    u.rate = 0.85; // a little slower for young learners
    try {
      if (voice) u.voice = voice;
    } catch {
      /* some browsers reject the voice object; u.lang still selects the language */
    }
    let settled = false;
    const finish = (r: SpeakResult) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    u.onend = () => finish('ok');
    u.onerror = (e) => {
      const err = (e as SpeechSynthesisErrorEvent).error;
      finish(err === 'language-unavailable' || err === 'voice-unavailable' ? 'no-voice' : err === 'interrupted' || err === 'canceled' ? 'ok' : 'error');
    };
    synth.speak(u);
    setTimeout(() => finish('ok'), Math.min(30_000, 4000 + text.length * 250));
  });
}

let speakRun = 0;

/**
 * Read text aloud. Mixed text ("cat گربه") is split by language and every part is read
 * with its own language's voice, one after another.
 */
export async function speakText(text: string, accent: Accent, lang: LangCode = 'en'): Promise<SpeakOutcome> {
  if (!standardPronunciationSupported()) return { result: 'unsupported', missing: [] };
  const run = ++speakRun;
  if (isNativeApp()) {
    nativeStopSpeaking();
    const parts = segmentByLang(text, lang);
    const missing: LangCode[] = [];
    let spoke = false;
    for (const part of parts) {
      if (run !== speakRun) break;
      const tag = ttsTag(part.lang, accent);
      if (!nativeHasVoice(tag)) {
        if (!missing.includes(part.lang)) missing.push(part.lang);
        continue;
      }
      const r = await nativeSpeak(part.text, tag);
      if (r === 'no-voice') {
        if (!missing.includes(part.lang)) missing.push(part.lang);
      } else if (r === 'ok') spoke = true;
    }
    return { result: spoke ? 'ok' : missing.length ? 'no-voice' : 'error', missing };
  }
  if (!webSpeechAvailable()) return { result: 'unsupported', missing: [] };
  const synth = window.speechSynthesis;
  const voices = await loadVoices();
  synth.cancel();
  await new Promise((r) => setTimeout(r, 60)); // Chrome on Android drops a speak() right after cancel()
  const parts = segmentByLang(text, lang);
  const missing: LangCode[] = [];
  let spoke = false;
  for (const part of parts) {
    if (run !== speakRun) break; // a newer request took over
    const tag = ttsTag(part.lang, accent);
    const voice = pickVoice(voices, tag);
    // If the device lists voices but none for this language, skip it instead of reading it wrongly.
    if (voices.length && !voice) {
      if (!missing.includes(part.lang)) missing.push(part.lang);
      continue;
    }
    const r = await speakOne(part.text, tag, voice);
    if (r === 'no-voice') {
      if (!missing.includes(part.lang)) missing.push(part.lang);
    } else spoke = true;
  }
  return { result: spoke ? 'ok' : missing.length ? 'no-voice' : 'error', missing };
}

/** Older single-result form. */
export async function speakStandard(text: string, accent: Accent, lang: LangCode = 'en'): Promise<SpeakResult> {
  return (await speakText(text, accent, lang)).result;
}

export function stopSpeaking(): void {
  speakRun++;
  nativeStopSpeaking();
  // Only touch the browser engine where it exists (inside the Android app it does not).
  try {
    if (webSpeechAvailable()) window.speechSynthesis.cancel();
  } catch {
    /* never let "stop speaking" break the caller */
  }
}
