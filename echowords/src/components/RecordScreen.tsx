import { useEffect, useRef, useState } from 'react';
import { formatDuration } from '../lib/format';
import type { Accent, Analysis } from '../lib/stt';
import { t } from '../lib/strings';
import type { Library } from '../lib/useLibrary';
import { useRecorder } from '../lib/useRecorder';
import { validateEnglish, validateHint } from '../lib/validation';
import { ConfirmDialog } from './ConfirmDialog';
import { RestoreButton } from './RestoreButton';
import { LevelMeter } from './LevelMeter';
import { PlayButton } from './PlayButton';
import { useToast } from './Toast';
import { WordCard } from './WordCard';

type Phase = 'record' | 'saving' | 'result';

function reasonText(reason: string | null): string {
  return reason === 'not_english' ? t.reasonNotEnglish : reason === 'mismatch' ? t.reasonMismatch : t.reasonEmpty;
}

export function RecordScreen({ lib, accent, onOpenLibrary }: { lib: Library; accent: Accent; onOpenLibrary: () => void }) {
  const rec = useRecorder();
  const toast = useToast();
  const [hint, setHint] = useState('');
  const [hintError, setHintError] = useState<string | null>(null);
  /** The word/sentence the learner wrote and confirmed with «تایید» before recording. */
  const [hintConfirmed, setHintConfirmed] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('record');
  const [wordId, setWordId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Review step: what the recognizer heard, and the text the learner will confirm.
  const [recog, setRecog] = useState<'working' | 'failed' | Analysis>('working');
  const [text, setText] = useState('');
  const [textError, setTextError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  /** Once the learner types, the recognizer must not overwrite their text. */
  const typedRef = useRef(false);

  const word = wordId ? lib.words.find((w) => w.id === wordId) ?? null : null;
  const isLive = rec.state === 'recording' || rec.state === 'paused';

  /** «تایید» next to the writing box (also the keyboard's Enter key). */
  const confirmHint = (): boolean => {
    if (!hint.trim()) {
      setHintError(t.emptyText);
      return false;
    }
    const h = validateHint(hint);
    if (!h.ok) {
      setHintError(h.error);
      return false;
    }
    setHintError(null);
    setHintConfirmed(h.value);
    return true;
  };

  const startRecording = () => {
    // Text typed but not confirmed yet: confirm it now (if it is valid English).
    if (!hintConfirmed && hint.trim() && !confirmHint()) return;
    void rec.start();
  };

  // As soon as a take is ready, write down what was said so the learner can check it.
  const take = rec.state === 'ready' ? rec.take : null;
  useEffect(() => {
    if (!take) return;
    let alive = true;
    setRecog('working');
    setText('');
    setTextError(null);
    // The learner's own confirmed word goes straight into the box; the recognizer won't overwrite it.
    setText(hintConfirmed ?? '');
    typedRef.current = !!hintConfirmed;
    lib
      .recognizeTake(take, hintConfirmed)
      .then((a) => {
        if (!alive) return;
        setRecog(a);
        if (a.status === 'done' && a.transcript && !typedRef.current) setText(a.transcript);
      })
      .catch(() => alive && setRecog('failed'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [take]);

  const confirmAndSave = async () => {
    if (!rec.take || saving) return;
    let finalText: string | null = null;
    if (text.trim()) {
      const v = validateEnglish(text);
      if (!v.ok) return setTextError(v.error);
      finalText = v.value;
    }
    setSaving(true);
    setPhase('saving');
    try {
      const analysis = typeof recog === 'object' ? recog : null;
      const w = await lib.saveTake(rec.take, {
        hint: hintConfirmed,
        accent,
        text: finalText,
        analysis,
        pendingTranscription: recog === 'working',
      });
      setWordId(w.id);
      setPhase('result');
      if (w.sttStatus === 'pending') void lib.transcribe(w.id); // finish writing it in the background
      // Still inside the tap on «تایید»: browsers allow the backup download now.
      if (await lib.autoBackupIfDue()) toast(t.autoBackupSaved, 'success');
    } catch {
      // The take is still in memory: the learner can simply press Save again.
      toast(t.saveFailed, 'error');
      setPhase('record');
    } finally {
      setSaving(false);
    }
  };

  const newRecording = () => {
    rec.reset();
    setHint('');
    setHintConfirmed(null);
    setHintError(null);
    setWordId(null);
    setPhase('record');
  };

  if (phase === 'saving') {
    return (
      <section className="screen record-screen" aria-busy="true">
        <p className="state state-busy"><span className="spinner" aria-hidden /> {t.savingTitle}</p>
      </section>
    );
  }

  if (phase === 'result') {
    return (
      <section className="screen record-screen">
        {word ? (
          <WordCard word={word} lib={lib} result onRecordAgain={newRecording} />
        ) : (
          <p className="state state-busy"><span className="spinner" aria-hidden /> {t.authWait}</p>
        )}
        <p className="msg msg-success" role="status">{t.savedInLibrary}</p>
        <button className="btn btn-primary btn-big wide" onClick={newRecording}>🎤 {t.recordNewOne}</button>
        <button className="btn btn-secondary btn-big wide" onClick={onOpenLibrary}>📚 {t.goToLibrary}</button>
      </section>
    );
  }

  return (
    <section className="screen record-screen">
      <h1 className="title">{t.recordTitle}</h1>

      {(rec.state === 'idle' || rec.state === 'error') && (
        <div className="card step hint-field">
          <p className="step-title">{t.step1Title}</p>
          {hintConfirmed ? (
            <div className="hint-confirmed" role="status">
              <span className="meta">✅ {t.hintConfirmedLabel}</span>
              <b className="hint-word" dir="ltr" lang="en">{hintConfirmed}</b>
              <button className="btn-link" onClick={() => setHintConfirmed(null)}>✏️ {t.hintChange}</button>
            </div>
          ) : (
            <form
              className="hint-form"
              onSubmit={(e) => {
                e.preventDefault();
                confirmHint();
              }}
            >
              <input
                className="input input-en"
                dir="ltr"
                lang="en"
                placeholder={t.hintPlaceholder}
                value={hint}
                maxLength={100}
                autoCapitalize="none"
                autoCorrect="off"
                enterKeyHint="done"
                aria-label={t.step1Title}
                onChange={(e) => {
                  setHint(e.target.value);
                  setHintError(null);
                }}
                aria-invalid={!!hintError}
              />
              <button type="submit" className="btn btn-confirm hint-ok">✅ {t.hintOk}</button>
            </form>
          )}
          {!hintConfirmed && <small className="meta">{t.hintHelp}</small>}
          {hintError && <p className="msg msg-error" role="alert">{hintError}</p>}
        </div>
      )}

      {rec.error && <p className="msg msg-error" role="alert">{rec.error}</p>}

      {(rec.state === 'idle' || rec.state === 'error' || rec.state === 'requesting') && (
        <div className="mic-zone">
          {(rec.state === 'idle' || rec.state === 'error') && (
            <p className="step-title">{hintConfirmed ? t.step2TitleWord(hintConfirmed) : t.step2Title}</p>
          )}
          <button
            className="mic-btn"
            onClick={startRecording}
            disabled={rec.state === 'requesting'}
            aria-label={t.record}
          >
            <span aria-hidden>{rec.state === 'requesting' ? '⏳' : '🎤'}</span>
            <b>{rec.state === 'requesting' ? t.requestingMic : t.record}</b>
          </button>
          <p className="meta">{rec.state === 'requesting' ? t.allowMicHelp : t.pressToRecord}</p>
          {rec.state === 'requesting' && (
            <button className="btn btn-ghost" onClick={rec.cancel}>{t.cancel}</button>
          )}
        </div>
      )}

      {rec.state === 'idle' && !lib.loading && lib.words.length === 0 && (
        <div className="card restore-card">
          <p className="state-title">{t.emptyRestoreTitle}</p>
          <p className="meta">{t.emptyRestoreHelp}</p>
          <RestoreButton lib={lib} />
        </div>
      )}

      {(isLive || rec.state === 'stopping') && (
        <div className="mic-zone live" aria-live="polite">
          <p className={`live-label${rec.state === 'paused' ? ' paused' : ''}`}>
            <span className="dot" aria-hidden /> {rec.state === 'paused' ? t.paused : t.recording}
          </p>
          <p className="timer" aria-label="timer">{formatDuration(rec.elapsedMs)}</p>
          <LevelMeter level={rec.level} active={rec.state === 'recording'} />
          <div className="row wrap center">
            <button className="btn btn-stop btn-big" onClick={rec.stop} disabled={rec.state === 'stopping'}>
              ⏹️ {t.stop}
            </button>
            {rec.canPause && rec.state === 'recording' && (
              <button className="btn btn-secondary" onClick={rec.pause}>⏸️ {t.pause}</button>
            )}
            {rec.canPause && rec.state === 'paused' && (
              <button className="btn btn-secondary" onClick={rec.resume}>▶️ {t.resume}</button>
            )}
            <button className="btn btn-ghost" onClick={rec.cancel} disabled={rec.state === 'stopping'}>✖️ {t.cancel}</button>
          </div>
        </div>
      )}

      {rec.state === 'ready' && rec.take && (
        <div className="card preview review">
          {rec.notice && <p className="msg msg-info">{rec.notice}</p>}
          <p className="state-title">{t.reviewTitle}</p>
          <p className="meta">{t.reviewHelp}</p>
          <PlayButton playKey="preview" getUrl={async () => rec.take!.url} label={t.listenToMine} big />
          <p className="meta" dir="ltr">{formatDuration(rec.take.durationMs)}</p>

          {recog === 'working' && (
            <p className="state state-busy" aria-live="polite">
              <span className="spinner" aria-hidden />{' '}
              {lib.modelProgress !== null
                ? t.modelDownloading(new Intl.NumberFormat('fa-IR', { style: 'percent' }).format(lib.modelProgress))
                : t.transcribing}
            </p>
          )}
          {recog === 'working' && <p className="meta">{t.reviewStillListening}</p>}
          {recog === 'failed' && <p className="msg msg-info">{t.reviewNoModel}</p>}
          {typeof recog === 'object' && recog.status === 'unclear' && (
            <div className="state state-unclear">
              <p className="state-title">{t.notSure}</p>
              <p>{reasonText(recog.reason)}</p>
              {(() => {
                const options = [recog.reason !== 'not_english' ? recog.heard : null, hintConfirmed].filter(
                  (o, i, all): o is string => !!o && all.indexOf(o) === i,
                );
                return options.length ? (
                  <>
                    <p className="meta">{t.tapToUse}</p>
                    <div className="row wrap">
                      {options.map((o) => (
                        <button key={o} className="chip chip-en" dir="ltr" lang="en" onClick={() => {
                            typedRef.current = true;
                            setText(o);
                            setTextError(null);
                          }}>
                          {o}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null;
              })()}
            </div>
          )}

          <label className="field wide">
            <span>{t.reviewTextLabel}</span>
            <input
              className="input input-en review-input"
              dir="ltr"
              lang="en"
              placeholder={t.reviewTypeHere}
              value={text}
              maxLength={200}
              autoCapitalize="sentences"
              autoCorrect="off"
              onChange={(e) => {
                typedRef.current = true;
                setText(e.target.value);
                setTextError(null);
              }}
              aria-invalid={!!textError}
            />
            {!text.trim() && <small>{t.reviewNoTextNote}</small>}
            {textError && <p className="msg msg-error" role="alert">{textError}</p>}
          </label>

          <div className="confirm-bar">
            <button className="btn btn-confirm btn-big wide" onClick={confirmAndSave} disabled={saving}>
              ✅ {t.confirmSave}
            </button>
          </div>
          <div className="row wrap center">
            <button className="btn btn-secondary" onClick={() => rec.reset()}>🔁 {t.recordAgain}</button>
            <button className="btn btn-ghost" onClick={() => setConfirmDiscard(true)}>🗑️ {t.cancel}</button>
          </div>
          {confirmDiscard && (
            <ConfirmDialog
              message={t.discardConfirm}
              confirmLabel={t.yesDiscard}
              danger
              onConfirm={() => {
                setConfirmDiscard(false);
                newRecording();
              }}
              onCancel={() => setConfirmDiscard(false)}
            />
          )}
        </div>
      )}
    </section>
  );
}
