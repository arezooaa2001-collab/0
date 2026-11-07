// Pronunciation («تلفظ»): the device's own text-to-speech voice reads the word.
// A separate feature from «صدای خودم», which always plays the learner's own recording.
import { LANGS, type LangCode } from './langs';
import type { Accent } from './stt';

export type SpeakResult = 'ok' | 'no-voice' | 'unsupported' | 'error';

export function standardPronunciationSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
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

/** Read the text aloud in its language. Resolves when speaking ends (or fails). */
export async function speakStandard(text: string, accent: Accent, lang: LangCode = 'en'): Promise<SpeakResult> {
  if (!standardPronunciationSupported()) return 'unsupported';
  const synth = window.speechSynthesis;
  const tag = ttsTag(lang, accent);
  const voices = await loadVoices();
  const voice = pickVoice(voices, tag);
  // If the device lists voices but none for this language, say so instead of reading it wrongly.
  if (voices.length && !voice) return 'no-voice';
  synth.cancel();
  await new Promise((r) => setTimeout(r, 60)); // Chrome on Android drops a speak() right after cancel()
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
    u.onerror = (e) => finish((e as SpeechSynthesisErrorEvent).error === 'language-unavailable' || (e as SpeechSynthesisErrorEvent).error === 'voice-unavailable' ? 'no-voice' : 'error');
    synth.speak(u);
    setTimeout(() => finish('ok'), 15_000);
  });
}
