import { useState } from 'react';
import { formatDate, formatSeconds } from '../lib/format';
import { standardPronunciationSupported, speakStandard } from '../lib/speech';
import { t } from '../lib/strings';
import type { Library } from '../lib/useLibrary';
import { type Word, hasAudio } from '../lib/db';
import { ConfirmDialog } from './ConfirmDialog';
import { PlayButton } from './PlayButton';
import { useToast } from './Toast';
import { TranscriptEditor } from './TranscriptEditor';

interface Props {
  word: Word;
  lib: Library;
  /** Large "result" layout right after recording. */
  result?: boolean;
  onRecordAgain?: () => void;
  /** Open the recorder to add the learner's voice to a word saved as text only. */
  onAddVoice?: (w: Word) => void;
}

const STUCK_MS = 2 * 60_000;

function reasonText(reason: string | null): string {
  switch (reason) {
    case 'not_english':
      return t.reasonNotEnglish;
    case 'mismatch':
      return t.reasonMismatch;
    default:
      return t.reasonEmpty;
  }
}

export function WordCard({ word, lib, result, onRecordAgain, onAddVoice }: Props) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isTranscribing =
    lib.transcribing.has(word.id) ||
    (word.sttStatus === 'processing' && Date.now() - new Date(word.updatedAt).getTime() < STUCK_MS);
  const text = word.transcript;

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
        <p className="word-text" dir="ltr" lang="en">{text}</p>
        {word.transcriptEdited && <p className="meta">{t.editedByYou}</p>}
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
        {word.sttReason === 'mismatch' && word.hint && (
          <p className="suggestion">
            {t.youWrote} <b dir="ltr" lang="en">{word.hint}</b>
          </p>
        )}
        {word.sttHeard && word.sttReason !== 'not_english' && (
          <p className="suggestion">
            {t.maybeYouSaid} <b dir="ltr" lang="en">{word.sttHeard}</b>
          </p>
        )}
        <p className="meta">{t.retryOrType}</p>
        <div className="row wrap">
          {word.sttHeard && word.sttReason !== 'not_english' && (
            <button className="btn btn-primary" onClick={() => accept(word.sttHeard!)}>👍 {t.yesCorrect}</button>
          )}
          {word.sttReason === 'mismatch' && word.hint && (
            <button className="btn btn-secondary" onClick={() => accept(word.hint!)}>📝 {t.useMyHint}</button>
          )}
          <button className="btn btn-secondary" onClick={() => setEditing(true)}>✏️ {t.writeItMyself}</button>
          {onRecordAgain && <button className="btn btn-secondary" onClick={onRecordAgain}>🎤 {t.recordAgain}</button>}
        </div>
      </div>
    );
  } else {
    // pending, failed, or stuck in processing
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
    <article className={`card word-card${result ? ' word-card-result' : ''}${deleting ? ' is-deleting' : ''}`}>
      <div className="word-head">
        {body}
        {!result && (
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

      <div className="row wrap actions">
        {hasAudio(word) ? (
          <PlayButton playKey={word.id} getUrl={getUrl} big onError={(m) => toast(m, 'error')} />
        ) : (
          onAddVoice && (
            <button className="btn btn-stop btn-big add-voice" onClick={() => onAddVoice(word)}>
              🎤 {t.addMyVoice}
            </button>
          )
        )}
        {text && standardPronunciationSupported() && (
          <button
            className="btn btn-tts"
            onClick={() => speakStandard(text, word.accent)}
            title={t.standardPronunciationNote}
          >
            <span aria-hidden>🤖</span> {t.standardPronunciation}
          </button>
        )}
      </div>

      <div className="word-foot">
        <span className="meta">
          {formatDate(word.createdAt)}
          {word.durationMs ? ` · ${formatSeconds(word.durationMs)}` : ''}
        </span>
        {!editing && (
          <span className="row">
            {(text || word.sttStatus === 'done') && (
              <button className="btn-link" onClick={() => setEditing(true)}>✏️ {t.edit}</button>
            )}
            <button className="btn-link danger" onClick={() => setConfirmDelete(true)} disabled={deleting}>🗑️ {t.delete}</button>
          </span>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog message={t.deleteConfirm} confirmLabel={t.yesDelete} danger onConfirm={doDelete} onCancel={() => setConfirmDelete(false)} />
      )}
    </article>
  );
}
