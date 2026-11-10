import { useState } from 'react';
import { LANGS, type LangCode } from '../lib/langs';
import { speakTag, speakText } from '../lib/speech';
import type { Accent } from '../lib/stt';
import { t } from '../lib/strings';
import { useToast } from './Toast';

/** «🔊 تلفظ»: the device reads the word aloud in its language. */
/** `voice`: read with this exact voice tag and name (any language, e.g. a translation into German). */
export function PronounceButton({ text, lang, accent, big, voice }: { text: string; lang: LangCode; accent: Accent; big?: boolean; voice?: { tag: string; name: string } }) {
  const toast = useToast();
  const [speaking, setSpeaking] = useState(false);
  return (
    <button
      type="button"
      className={`btn btn-tts${big ? ' btn-big' : ''}${speaking ? ' is-speaking' : ''}`}
      title={t.listenTitle}
      aria-busy={speaking}
      onClick={async () => {
        if (speaking) return;
        setSpeaking(true);
        if (voice) {
          const r = await speakTag(text, voice.tag);
          setSpeaking(false);
          if (r === 'unsupported') toast(t.noSpeechSupport, 'error');
          else if (r === 'no-voice') toast(t.noVoiceForLang(voice.name), 'error');
          return;
        }
        const r = await speakText(text, accent, lang);
        setSpeaking(false);
        if (r.result === 'unsupported') toast(t.noSpeechSupport, 'error');
        else if (r.missing.length) toast(t.noVoiceForLang(r.missing.map((l) => LANGS[l].name).join(' و ')), 'error');
      }}
    >
      <span aria-hidden>{speaking ? '🔉' : '🔊'}</span> {t.listen}
    </button>
  );
}
