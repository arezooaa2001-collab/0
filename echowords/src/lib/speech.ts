// OPTIONAL, clearly separate feature: a machine voice reading the English text.
// It is never used in place of the learner's own recording.
import type { Accent } from '../../supabase/functions/_shared/stt';

export function standardPronunciationSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('en')) ??
    null
  );
}

export function speakStandard(text: string, accent: Accent): void {
  if (!standardPronunciationSupported()) return;
  const lang = accent === 'uk' ? 'en-GB' : 'en-US';
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.85; // a little slower for young learners
  const v = pickVoice(lang);
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}
