import { useState } from 'react';
import { t } from '../lib/strings';
import { LANGS, type LangCode } from '../lib/langs';
import { validateText } from '../lib/validation';

interface Props {
  lang: LangCode;
  initial: string;
  onSave: (text: string) => Promise<void>;
  onCancel: () => void;
}

/** Manual correction of the English text. The original audio is never affected. */
export function TranscriptEditor({ lang, initial, onSave, onCancel }: Props) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = validateText(value, lang);
    if (!r.ok) return setError(r.error);
    setBusy(true);
    setError(null);
    try {
      await onSave(r.value);
    } catch {
      setError(t.errGeneric);
      setBusy(false);
    }
  };

  return (
    <form className="editor" onSubmit={submit}>
      <label className="field">
        <span>{t.editLabel}</span>
        <input
          className="input input-word"
          dir={LANGS[lang].dir}
          lang={lang}
          inputMode="text"
          autoCapitalize="sentences"
          autoCorrect="off"
          spellCheck
          autoFocus
          maxLength={200}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          aria-invalid={!!error}
        />
      </label>
      {error && <p className="msg msg-error" role="alert">{error}</p>}
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={busy}>✅ {t.editSave}</button>
        <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={busy}>{t.editCancel}</button>
      </div>
    </form>
  );
}
