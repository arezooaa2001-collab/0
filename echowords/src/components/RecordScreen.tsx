import { useState } from 'react';
import { formatDuration } from '../lib/format';
import type { Accent } from '../lib/stt';
import { t } from '../lib/strings';
import type { Library } from '../lib/useLibrary';
import { useRecorder } from '../lib/useRecorder';
import { validateHint } from '../lib/validation';
import { LevelMeter } from './LevelMeter';
import { PlayButton } from './PlayButton';
import { useToast } from './Toast';
import { WordCard } from './WordCard';

type Phase = 'record' | 'saving' | 'result';

export function RecordScreen({ lib, accent }: { lib: Library; accent: Accent }) {
  const rec = useRecorder();
  const toast = useToast();
  const [hint, setHint] = useState('');
  const [hintError, setHintError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('record');
  const [wordId, setWordId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const word = wordId ? lib.words.find((w) => w.id === wordId) ?? null : null;
  const isLive = rec.state === 'recording' || rec.state === 'paused';

  const startRecording = () => {
    const h = validateHint(hint);
    if (!h.ok) return setHintError(h.error);
    setHintError(null);
    void rec.start();
  };

  const save = async () => {
    if (!rec.take || saving) return;
    const h = validateHint(hint);
    if (!h.ok) return setHintError(h.error);
    setSaving(true);
    setPhase('saving');
    try {
      const w = await lib.saveTake(rec.take, { hint: h.value, accent });
      setWordId(w.id);
      setPhase('result');
      toast(t.saved, 'success');
      void lib.transcribe(w.id);
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
        <button className="btn btn-primary btn-big wide" onClick={newRecording}>🎤 {t.recordNewOne}</button>
      </section>
    );
  }

  return (
    <section className="screen record-screen">
      <h1 className="title">{t.recordTitle}</h1>

      {(rec.state === 'idle' || rec.state === 'error') && (
        <label className="field hint-field">
          <span>{t.hintLabel}</span>
          <input
            className="input input-en"
            dir="ltr"
            lang="en"
            placeholder={t.hintPlaceholder}
            value={hint}
            maxLength={100}
            autoCapitalize="none"
            autoCorrect="off"
            onChange={(e) => {
              setHint(e.target.value);
              setHintError(null);
            }}
            aria-invalid={!!hintError}
          />
          <small>{t.hintHelp}</small>
          {hintError && <p className="msg msg-error" role="alert">{hintError}</p>}
        </label>
      )}

      {rec.error && <p className="msg msg-error" role="alert">{rec.error}</p>}

      {(rec.state === 'idle' || rec.state === 'error' || rec.state === 'requesting') && (
        <div className="mic-zone">
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
        <div className="card preview">
          {rec.notice && <p className="msg msg-info">{rec.notice}</p>}
          <p className="state-title">{t.takeReady}</p>
          <p className="meta" dir="ltr">{formatDuration(rec.take.durationMs)}</p>
          <PlayButton playKey="preview" getUrl={async () => rec.take!.url} label={t.listenToMine} big />
          <div className="row wrap center">
            <button className="btn btn-secondary" onClick={() => rec.reset()}>🔁 {t.recordAgain}</button>
            <button className="btn btn-primary btn-big" onClick={save} disabled={saving}>✅ {t.save}</button>
          </div>
        </div>
      )}
    </section>
  );
}
