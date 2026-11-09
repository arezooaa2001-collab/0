import { useEffect, useRef, useState } from 'react';
import { t } from '../lib/strings';

export const FOLDER_EMOJIS = ['📁', '🐶', '🍎', '🍔', '🚗', '🏠', '👕', '⚽', '🎨', '🌳', '🔢', '🎵', '😀', '🏫', '🧸', '🌍'];

interface Props {
  title: string;
  initialName?: string;
  initialEmoji?: string;
  onSave: (name: string, emoji: string) => Promise<void> | void;
  onCancel: () => void;
}

/** Make or rename a folder: a name and a picture. */
export function FolderDialog({ title, initialName = '', initialEmoji = '📁', onSave, onCancel }: Props) {
  const [name, setName] = useState(initialName);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(t.folderNameNeeded);
    setBusy(true);
    try {
      await onSave(name.trim(), emoji);
    } catch {
      setError(t.errGeneric);
      setBusy(false);
    }
  };

  return (
    <div className="overlay" role="presentation" onClick={onCancel}>
      <form className="dialog folder-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <p className="state-title">{title}</p>
        <input
          ref={inputRef}
          className="input"
          dir="auto"
          placeholder={t.folderNamePlaceholder}
          value={name}
          maxLength={40}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
        <div className="emoji-grid" role="radiogroup" aria-label={t.folderPicture}>
          {FOLDER_EMOJIS.map((em) => (
            <button key={em} type="button" role="radio" aria-checked={emoji === em} className={`emoji-choice${emoji === em ? ' on' : ''}`} onClick={() => setEmoji(em)}>
              {em}
            </button>
          ))}
        </div>
        {error && <p className="msg msg-error" role="alert">{error}</p>}
        <div className="row center">
          <button type="submit" className="btn btn-confirm" disabled={busy}>✅ {t.hintOk}</button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>{t.cancel}</button>
        </div>
      </form>
    </div>
  );
}
