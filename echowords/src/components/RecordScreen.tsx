import { useEffect, useRef, useState } from 'react';
import type { Word } from '../lib/db';
import { hasAudio } from '../lib/db';
import { formatDuration } from '../lib/format';
import { type Accent, type Analysis, sameWords } from '../lib/stt';
import { t } from '../lib/strings';
import type { Library } from '../lib/useLibrary';
import { useRecorder } from '../lib/useRecorder';
import { ALL_LANGS, LANGS, type LangCode, guessLang, isInLang, langOf, readLastLang, saveLastLang } from '../lib/langs';
import { speakStandard } from '../lib/speech';
import { validateText } from '../lib/validation';
import { LangPicker } from './LangPicker';
import { PronounceButton } from './PronounceButton';
import { ConfirmDialog } from './ConfirmDialog';
import { LevelMeter } from './LevelMeter';
import { PlayButton } from './PlayButton';
import { RestoreButton } from './RestoreButton';
import { useToast } from './Toast';
import { WordCard } from './WordCard';

type Phase = 'record' | 'saving' | 'result';

function reasonText(reason: string | null): string {
  return reason === 'not_english' ? t.reasonNotEnglish : reason === 'mismatch' ? t.reasonMismatch : t.reasonEmpty;
}

interface Props {
  lib: Library;
  accent: Accent;
  onOpenLibrary: () => void;
  /** Languages switched on in Settings. */
  enabledLangs: LangCode[];
  /** A saved word (opened from the library) whose recording the learner wants to add. */
  initialTarget?: Word | null;
}

export function RecordScreen({ lib, accent, onOpenLibrary, enabledLangs, initialTarget = null }: Props) {
  const rec = useRecorder();
  const toast = useToast();

  // Step 1: typed word, saved with «تایید و ذخیره».
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState<string | null>(null);
  /** Language for a new word (chips appear when several languages are on). */
  const [lang, setLangState] = useState<LangCode>(() => readLastLang(enabledLangs));
  const setLang = (l: LangCode) => {
    setLangState(l);
    saveLastLang(l);
  };
  /** The saved word we are now recording for (null = recording a brand-new word). */
  const [targetId, setTargetId] = useState<string | null>(initialTarget?.id ?? null);
  const target = targetId ? lib.words.find((w) => w.id === targetId) ?? null : null;

  const [phase, setPhase] = useState<Phase>('record');
  const [resultId, setResultId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Review step.
  const [recog, setRecog] = useState<'working' | 'failed' | Analysis>('working');
  const [text, setText] = useState('');
  const [textError, setTextError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const typedRef = useRef(false);

  const resultWord = resultId ? lib.words.find((w) => w.id === resultId) ?? null : null;
  const isLive = rec.state === 'recording' || rec.state === 'paused';
  const attachMode = !!target && !hasAudio(target);
  /** Language of what is being recorded right now. */
  const activeLang: LangCode = target ? langOf(target) : lang;
  const activeInfo = LANGS[activeLang];

  const backupAfterSave = async () => {
    // Still inside the tap: browsers allow the backup download now.
    if (await lib.autoBackupIfDue()) toast(t.autoBackupSaved, 'success');
  };

  /** «✅ تایید و ذخیره» next to the writing box: saves the word immediately. */
  const saveTyped = async () => {
    if (saving) return;
    const v = validateText(typed, lang);
    if (!v.ok) {
      // Written in a language that is switched off? Say where to switch it on.
      const other = ALL_LANGS.find((l) => !enabledLangs.includes(l) && isInLang(typed, l));
      return setTypedError(other ? t.enableLangFirst(LANGS[other].name) : v.error);
    }
    setSaving(true);
    try {
      const w = await lib.saveText(v.value, accent, lang);
      setTargetId(w.id);
      setTyped('');
      setTypedError(null);
      void speakStandard(v.value, accent, lang); // say the new word once
      await backupAfterSave();
    } catch (e) {
      console.error('save failed', e);
      setTypedError(t.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  // As soon as a take is ready, write down what was said (in the background; never blocks saving).
  const take = rec.state === 'ready' ? rec.take : null;
  useEffect(() => {
    if (!take) return;
    let alive = true;
    setRecog('working');
    setText('');
    setTextError(null);
    typedRef.current = false;
    lib
      .recognizeTake(take, target?.transcript ?? null, activeLang)
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

  /** «✅ تایید و ذخیره» on the review card. */
  const confirmTake = async () => {
    if (!rec.take || saving) return;
    const analysis = typeof recog === 'object' ? recog : null;
    let finalText: string | null = null;
    if (!attachMode && text.trim()) {
      const v = validateText(text, activeLang);
      if (!v.ok) return setTextError(v.error);
      finalText = v.value;
    }
    setSaving(true);
    setPhase('saving');
    try {
      const w = attachMode
        ? await lib.attachTake(target!.id, rec.take, analysis)
        : await lib.saveTake(rec.take, { hint: null, accent, lang: activeLang, text: finalText, analysis, pendingTranscription: recog === 'working' });
      setResultId(w.id);
      setPhase('result');
      if (!attachMode && w.sttStatus === 'pending') void lib.transcribe(w.id);
      await backupAfterSave();
    } catch (e) {
      console.error('save failed', e);
      toast(t.saveFailed, 'error');
      setPhase('record');
    } finally {
      setSaving(false);
    }
  };

  const startOver = () => {
    rec.reset();
    setTyped('');
    setTypedError(null);
    setTargetId(null);
    setResultId(null);
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
        {resultWord && <WordCard word={resultWord} lib={lib} accent={accent} result onRecordAgain={startOver} />}
        <p className="msg msg-success" role="status">{t.savedInLibrary}</p>
        <button className="btn btn-primary btn-big wide" onClick={startOver}>➕ {t.newWord}</button>
        <button className="btn btn-secondary btn-big wide" onClick={onOpenLibrary}>📚 {t.goToLibrary}</button>
      </section>
    );
  }

  const idle = rec.state === 'idle' || rec.state === 'error';
  const voiceFeedback =
    attachMode && typeof recog === 'object' ? (
      recog.heard && target?.transcript && sameWords(recog.heard, target.transcript) ? (
        <p className="msg msg-success">{t.saidItRight}</p>
      ) : recog.heard ? (
        <p className="msg msg-info">
          {t.deviceHeard} <b dir={activeInfo.dir} lang={activeLang}>{recog.heard}</b>
        </p>
      ) : null
    ) : null;

  return (
    <section className="screen record-screen">
      <h1 className="title">{t.recordTitle}</h1>

      {/* ── Step 1: write and save ─────────────────────────────── */}
      {idle && !target && (
        <div className="card step hint-field">
          <p className="step-title">{t.step1Title}</p>
          <LangPicker enabled={enabledLangs} value={lang} onChange={setLang} />
          <form
            className="hint-form"
            onSubmit={(e) => {
              e.preventDefault();
              void saveTyped();
            }}
          >
            <input
              className="input input-word"
              dir={LANGS[lang].dir}
              lang={lang}
              placeholder={t.hintPlaceholder}
              value={typed}
              maxLength={200}
              autoCapitalize="none"
              autoCorrect="off"
              enterKeyHint="done"
              aria-label={t.step1Title}
              onChange={(e) => {
                setTyped(e.target.value);
                setTypedError(null);
                const g = guessLang(e.target.value, enabledLangs, lang);
                if (g !== lang) setLang(g);
              }}
              aria-invalid={!!typedError}
            />
            <button type="submit" className="btn btn-confirm btn-big wide save-typed" disabled={saving}>
              ✅ {t.confirmSave}
            </button>
          </form>
          {typedError && <p className="msg msg-error" role="alert">{typedError}</p>}
        </div>
      )}

      {idle && target && (
        <div className="card step saved-card" role="status">
          <p className="msg msg-success">✅ {t.savedWordIs}</p>
          <b className="hint-word" dir={activeInfo.dir} lang={activeLang}>{target.transcript}</b>
          <PronounceButton text={target.transcript ?? ''} lang={activeLang} accent={accent} big />
          <div className="row wrap center">
            <button className="btn btn-secondary" onClick={onOpenLibrary}>📚 {t.goToLibrary}</button>
            <button className="btn btn-ghost" onClick={startOver}>➕ {t.newWord}</button>
          </div>
        </div>
      )}

      {rec.error && <p className="msg msg-error" role="alert">{rec.error}</p>}

      {/* ── Step 2: record (optional) ──────────────────────────── */}
      {(idle || rec.state === 'requesting') && (!target || attachMode) && (
        <div className="mic-zone">
          {idle && <p className="step-title">{target ? t.step2SayIt(target.transcript ?? '') : t.step2OrJustRecord}</p>}
          <button className="mic-btn" onClick={() => void rec.start()} disabled={rec.state === 'requesting'} aria-label={t.record}>
            <span aria-hidden>{rec.state === 'requesting' ? '⏳' : '🎤'}</span>
            <b>{rec.state === 'requesting' ? t.requestingMic : t.record}</b>
          </button>
          <p className="meta">{rec.state === 'requesting' ? t.allowMicHelp : t.pressToRecord}</p>
          {rec.state === 'requesting' && <button className="btn btn-ghost" onClick={rec.cancel}>{t.cancel}</button>}
        </div>
      )}

      {(isLive || rec.state === 'stopping') && (
        <div className="mic-zone live" aria-live="polite">
          {target && <b className="hint-word" dir={activeInfo.dir} lang={activeLang}>{target.transcript}</b>}
          <p className={`live-label${rec.state === 'paused' ? ' paused' : ''}`}>
            <span className="dot" aria-hidden /> {rec.state === 'paused' ? t.paused : t.recording}
          </p>
          <p className="timer" aria-label="timer">{formatDuration(rec.elapsedMs)}</p>
          <LevelMeter level={rec.level} active={rec.state === 'recording'} />
          <div className="row wrap center">
            <button className="btn btn-stop btn-big" onClick={rec.stop} disabled={rec.state === 'stopping'}>⏹️ {t.stop}</button>
            {rec.canPause && rec.state === 'recording' && <button className="btn btn-secondary" onClick={rec.pause}>⏸️ {t.pause}</button>}
            {rec.canPause && rec.state === 'paused' && <button className="btn btn-secondary" onClick={rec.resume}>▶️ {t.resume}</button>}
            <button className="btn btn-ghost" onClick={rec.cancel} disabled={rec.state === 'stopping'}>✖️ {t.cancel}</button>
          </div>
        </div>
      )}

      {/* ── Review: listen, check, confirm ─────────────────────── */}
      {rec.state === 'ready' && rec.take && (
        <div className="card preview review">
          {rec.notice && <p className="msg msg-info">{rec.notice}</p>}
          <p className="state-title">{attachMode ? t.reviewVoiceTitle : t.reviewTitle}</p>
          {attachMode && <b className="hint-word" dir={activeInfo.dir} lang={activeLang}>{target!.transcript}</b>}
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
          {voiceFeedback}

          {!attachMode && (
            <>
              {recog === 'working' && <p className="meta">{t.reviewStillListening}</p>}
              {recog === 'failed' && <p className="msg msg-info">{t.reviewNoModel}</p>}
              {typeof recog === 'object' && recog.status === 'unclear' && (
                <div className="state state-unclear">
                  <p className="state-title">{t.notSure}</p>
                  <p>{reasonText(recog.reason)}</p>
                  {recog.heard && recog.reason !== 'not_english' && (
                    <>
                      <p className="meta">{t.tapToUse}</p>
                      <button
                        className="chip chip-en"
                        dir={activeInfo.dir}
                        lang={activeLang}
                        onClick={() => {
                          typedRef.current = true;
                          setText(recog.heard!);
                          setTextError(null);
                        }}
                      >
                        {recog.heard}
                      </button>
                    </>
                  )}
                </div>
              )}
              <label className="field wide">
                <span>{t.reviewTextLabel}</span>
                <input
                  className="input input-word review-input"
                  dir={activeInfo.dir}
                  lang={activeLang}
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
            </>
          )}

          <div className="confirm-bar">
            <button className="btn btn-confirm btn-big wide" onClick={confirmTake} disabled={saving}>
              ✅ {attachMode ? t.confirmSaveVoice : t.confirmSave}
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
                rec.reset();
              }}
              onCancel={() => setConfirmDiscard(false)}
            />
          )}
        </div>
      )}

      {idle && !target && !lib.loading && lib.words.length === 0 && (
        <div className="card restore-card">
          <p className="state-title">{t.emptyRestoreTitle}</p>
          <p className="meta">{t.emptyRestoreHelp}</p>
          <RestoreButton lib={lib} />
        </div>
      )}
    </section>
  );
}
