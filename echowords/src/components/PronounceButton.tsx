import { useState } from 'react';
import { LANGS, type LangCode } from '../lib/langs';
import { speakStandard } from '../lib/speech';
import type { Accent } from '../lib/stt';
import { t } from '../lib/strings';
import { useToast } from './Toast';

/** «🔊 تلفظ»: the device reads the word aloud in its language. */
export function PronounceButton({ text, lang, accent, big }: { text: string; lang: LangCode; accent: Accent; big?: boolean }) {
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
        const r = await speakStandard(text, accent, lang);
        setSpeaking(false);
        if (r === 'no-voice') toast(t.noVoiceForLang(LANGS[lang].name), 'error');
        else if (r === 'unsupported') toast(t.noSpeechSupport, 'error');
      }}
    >
      <span aria-hidden>{speaking ? '🔉' : '🔊'}</span> {t.listen}
    </button>
  );
}
