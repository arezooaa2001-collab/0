import { useState } from 'react';
import { type Word, hasAudio } from '../lib/db';
import { formatDate, formatSeconds } from '../lib/format';
import { LANGS, langOf, langsIn } from '../lib/langs';
import type { Accent } from '../lib/stt';
import { t } from '../lib/strings';
import type { Library } from '../lib/useLibrary';
import { ConfirmDialog } from './ConfirmDialog';
import { PlayButton } from './PlayButton';
import { PronounceButton } from './PronounceButton';
import { useToast } from './Toast';
import { TranscriptEditor } from './TranscriptEditor';

interface Props {
  word: Word;
  lib: Library;
  /** English accent for «تلفظ» (defaults to the word's own). */
  accent?: Accent;
  /** Large "result" layout right after saving. */
  result?: boolean;
  onRecordAgain?: () => void;
  /** Open the recorder to add the learner's voice to a word saved as text only. */
  onAddVoice?: (w: Word) => void;
}

const STUCK_MS = 2 * 60_000;

function reasonText(reason: string | null): string {
  return reason === 'not_english' ? t.reasonNotEnglish : reason === 'mismatch' ? t.reasonMismatch : t.reasonEmpty;
}

export function WordCard({ word, lib, accent, result, onRecordAgain, onAddVoice }: Props) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const lang = langOf(word);
  const text = word.transcript;
  const isTranscribing =
    lib.transcribing.has(word.id) || (word.sttStatus === 'processing' && Date.now() - new Date(word.updatedAt).getTime() < STUCK_MS);

  const getUrl = async () => {
    const { url, verified } = await lib.getAudioUrl(word);
    if (!verified) toast(t.audioChanged, 'error');
    return url;
  };

  const retranscribe = async () => {
    const w = await lib.transcribe(word.id);
    if (!w) toast(t.transcribeFailed, 'error');
  };

  const accept = async (s: string) => {
    try {
      await lib.correct(word.id, s);
    } catch {
      toast(t.errGeneric, 'error');
    }
  };

  const doDelete = async () => {
    setConfirmDelete(false);
    setDeleting(true);
    try {
      await lib.remove(word);
      toast(t.deleted, 'success');
    } catch {
      toast(t.errGeneric, 'error');
      setDeleting(false);
    }
  };

  let body: React.ReactNode;
  if (editing) {
    body = (
      <TranscriptEditor
        lang={lang}
        initial={text ?? word.sttHeard ?? word.hint ?? ''}
        onCancel={() => setEditing(false)}
        onSave={async (v) => {
          await lib.correct(word.id, v);
          setEditing(false);
        }}
      />
    );
  } else if (text) {
    body = (
      <div className="word-text-wrap">
        {result && <p className="praise">{t.greatYouSaid}</p>}
        <p className="word-text" dir="auto">{text}</p>
      </div>
    );
  } else if (isTranscribing) {
    body = (
      <p className="state state-busy" aria-live="polite">
        <span className="spinner" aria-hidden />{' '}
        {lib.modelProgress !== null
          ? t.modelDownloading(new Intl.NumberFormat('fa-IR', { style: 'percent' }).format(lib.modelProgress))
          : t.transcribing}
      </p>
    );
  } else if (word.sttStatus === 'unclear') {
    body = (
      <div className="state state-unclear" role="status">
        <p className="state-title">{t.notSure}</p>
        <p>{reasonText(word.sttReason)}</p>
        {word.sttHeard && word.sttReason !== 'not_english' && (
          <p className="suggestion">
            {t.maybeYouSaid} <b dir="auto">{word.sttHeard}</b>
          </p>
        )}
        <div className="row wrap">
          {word.sttHeard && word.sttReason !== 'not_english' && (
            <button className="btn btn-primary" onClick={() => accept(word.sttHeard!)}>👍 {t.yesCorrect}</button>
          )}
          <button className="btn btn-secondary" onClick={() => setEditing(true)}>✏️ {t.writeItMyself}</button>
          {onRecordAgain && <button className="btn btn-secondary" onClick={onRecordAgain}>🎤 {t.recordAgain}</button>}
        </div>
      </div>
    );
  } else {
    body = (
      <div className="state state-failed" role="status">
        <p className="state-title">{word.sttStatus === 'failed' ? t.transcribeFailed : t.waitingText}</p>
        {word.sttStatus === 'failed' && <p className="meta">{t.modelNeedsInternet}</p>}
        <div className="row wrap">
          <button className="btn btn-secondary" onClick={retranscribe}>🔁 {t.tryAgainTranscribe}</button>
          <button className="btn btn-secondary" onClick={() => setEditing(true)}>✏️ {t.writeItMyself}</button>
        </div>
      </div>
    );
  }

  return (
    <article className={`card word-card${result ? ' word-card-result' : ' word-card-compact'}${deleting ? ' is-deleting' : ''}`}>
      <div className="word-head">
        {body}
        {!result && !editing && (
          <button
            className={`star${word.favorite ? ' on' : ''}`}
            aria-label={t.favorite}
            aria-pressed={word.favorite}
            onClick={() => lib.toggleFavorite(word).catch(() => toast(t.errGeneric, 'error'))}
          >
            {word.favorite ? '⭐' : '☆'}
          </button>
        )}
      </div>

      {!editing && (
        <div className="word-actions">
          {text && <PronounceButton text={text} lang={lang} accent={accent ?? word.accent} big={result} />}
          {hasAudio(word) ? (
            <PlayButton playKey={word.id} getUrl={getUrl} big={result} onError={(m) => toast(m, 'error')} />
          ) : (
            onAddVoice && (
              <button className="btn btn-stop add-voice" onClick={() => onAddVoice(word)}>
                🎤 {t.addMyVoice}
              </button>
            )
          )}
        </div>
      )}

      {!editing && (
        <div className="word-foot">
          <span className="meta">
            {(text ? langsIn(text) : [lang]).map((l) => LANGS[l].flag).join(' ')} {formatDate(word.createdAt)}
            {word.durationMs ? ` · ${formatSeconds(word.durationMs)}` : ''}
          </span>
          <span className="row">
            {lib.folders.length > 0 && (
              <select
                className="folder-select"
                aria-label={t.moveTo}
                value={word.folderId ?? ''}
                onChange={(e) => lib.moveToFolder(word, e.target.value || null).catch(() => toast(t.errGeneric, 'error'))}
              >
                <option value="">🗂️ {t.noFolder}</option>
                {lib.folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.emoji} {f.name}
                  </option>
                ))}
              </select>
            )}
            <button className="btn-link" onClick={() => setEditing(true)} aria-label={t.edit}>✏️</button>
            <button className="btn-link danger" onClick={() => setConfirmDelete(true)} disabled={deleting} aria-label={t.delete}>🗑️</button>
          </span>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog message={t.deleteConfirm} confirmLabel={t.yesDelete} danger onConfirm={doDelete} onCancel={() => setConfirmDelete(false)} />
      )}
    </article>
  );
}
