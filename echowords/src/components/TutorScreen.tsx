import { useEffect, useRef, useState } from 'react';
import { AiError, type ChatTurn, type Provider, type TutorReply, askTutor, askTutorByVoice, currentProvider, shrinkImage } from '../lib/ai';
import { type VoiceNote, VoiceNoteError, startVoiceNote } from '../lib/voiceNote';
import { aiErrorDetail, aiErrorText } from '../lib/aiErrors';
import { LANGS } from '../lib/langs';
import { ListenError, canListen, listenOnce, stopListening } from '../lib/listen';
import { speakText, stopSpeaking } from '../lib/speech';
import type { Accent } from '../lib/stt';
import { t } from '../lib/strings';
import type { Library } from '../lib/useLibrary';
import { CameraPanel, type CameraPanelHandle } from './CameraPanel';
import { readLastFolder } from './FolderPicker';
import { PronounceButton } from './PronounceButton';
import { useToast } from './Toast';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  imageUrl?: string;
  reply?: TutorReply;
  error?: boolean;
  /** Technical reason (small, for a screenshot when something fails). */
  detail?: string;
}

const LISTEN_LANGS = [
  { tag: 'fa-IR', label: '🇮🇷 فارسی' },
  { tag: 'en-US', label: '🇬🇧 English' },
];

function listenErrorText(e: unknown): string {
  const code = e instanceof ListenError ? e.code : '';
  if (code === 'unsupported') return t.listenUnsupported;
  if (code === 'not-allowed' || code === 'service-not-allowed') return t.listenNotAllowed;
  if (code === 'network') return t.listenNetwork;
  return t.listenOther;
}

export function TutorScreen({ lib, accent, onOpenSettings }: { lib: Library; accent: Accent; onOpenSettings: () => void }) {
  const toast = useToast();
  const [provider, setProvider] = useState<Provider | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [live, setLive] = useState(false);
  const [listenLang, setListenLang] = useState('fa-IR');
  const [autoSpeak, setAutoSpeak] = useState(true);
  /** Live camera open: every question also sends what the camera sees. */
  const [cameraOn, setCameraOn] = useState(false);
  const cameraRef = useRef<CameraPanelHandle>(null);
  const cameraOnRef = useRef(false); // read by the live-mode loop, which outlives renders
  cameraOnRef.current = cameraOn;
  const providerName = provider === 'claude' ? 'Claude' : provider === 'openai' ? 'ChatGPT' : provider === 'custom' ? t.aiCustomShort : 'Gemini';
  /** Recording a spoken question (used when the phone cannot turn speech into text). */
  const [note, setNote] = useState<VoiceNote | null>(null);
  const [useRecording, setUseRecording] = useState(() => !canListen());
  const liveRef = useRef(false);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<ChatTurn[]>([]);
  /** Cancels the request in progress («لغو», or leaving live mode). */
  const abortRef = useRef<AbortController | null>(null);
  const [waitSecs, setWaitSecs] = useState(0);
  useEffect(() => {
    if (!busy) return;
    setWaitSecs(0);
    const started = Date.now();
    const id = window.setInterval(() => setWaitSecs(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);
  const cancelAsk = () => abortRef.current?.abort();
  /** Hard limit for a whole question (whatever might get stuck), so «thinking» always ends. */
  const withDeadline = <T,>(p: Promise<T>, ctrl: AbortController): Promise<T> =>
    Promise.race([
      p,
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          ctrl.abort();
          reject(new AiError('timeout', 'no answer within 40 s'));
        }, 40_000),
      ),
    ]);
  const isAbort = (e: unknown) => (e as Error)?.name === 'AbortError';

  useEffect(() => {
    void currentProvider().then(setProvider);
    return () => {
      liveRef.current = false;
      try {
        stopListening();
        stopSpeaking();
      } catch {
        /* leaving the screen must never fail */
      }
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const add = (m: Omit<Message, 'id'>) => setMessages((prev) => [...prev, { ...m, id: nextId.current++ }]);

  /** Send a question (and/or a photo). Resolves with the reply, which is also spoken. */
  const send = async (text: string, image?: Blob | null): Promise<TutorReply | null> => {
    const q = text.trim() || (image ? t.photoQuestion : '');
    if (!q || busy) return null;
    if (!provider) {
      add({ role: 'user', text: q });
      add({ role: 'assistant', text: t.aiNoProvider, error: true });
      return null;
    }
    // Everything after «thinking» is switched on is inside ONE protected block:
    // whatever goes wrong, the bubble is switched off again and the reason is shown.
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let asked = false;
    try {
      stopSpeaking();
      if (!image && cameraOnRef.current) image = await cameraRef.current?.snapshot(); // what the camera sees right now
      add({ role: 'user', text: q, imageUrl: image ? URL.createObjectURL(image) : undefined });
      historyRef.current = [...historyRef.current, { role: 'user', text: q }];
      asked = true;
      const reply = await withDeadline(askTutor(historyRef.current, image ? await shrinkImage(image) : null, { signal: ctrl.signal, live: liveRef.current }), ctrl);
      historyRef.current = [...historyRef.current, { role: 'assistant', text: reply.reply }];
      add({ role: 'assistant', text: reply.reply, reply });
      setBusy(false);
      if (autoSpeak) {
        const r = await speakText(reply.reply, accent, 'fa');
        if (r.missing.includes('fa') && !sessionStorageFlag('fa-voice-warned')) toast(t.noVoiceForLang(LANGS.fa.name), 'error');
      }
      return reply;
    } catch (e) {
      if (asked) historyRef.current = historyRef.current.slice(0, -1);
      add({ role: 'assistant', text: isAbort(e) ? t.aiCancelled : aiErrorText(e), error: !isAbort(e), detail: isAbort(e) ? undefined : aiErrorDetail(e) });
      return null;
    } finally {
      setBusy(false);
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  };

  /** Ask a recorded voice question (the AI or the device turns it into text). */
  const sendVoice = async (audio: Blob) => {
    if (!provider) {
      add({ role: 'assistant', text: t.aiNoProvider, error: true });
      return;
    }
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      stopSpeaking();
      const userId = nextId.current;
      add({ role: 'user', text: t.voiceQuestion });
      const shot = cameraOnRef.current ? await cameraRef.current?.snapshot() : null;
      const reply = await withDeadline(askTutorByVoice(historyRef.current, audio, { signal: ctrl.signal }, shot ?? null), ctrl);
      const heard = reply.heard || t.voiceQuestion;
      setMessages((prev) => prev.map((m) => (m.id === userId ? { ...m, text: `🎤 ${heard}` } : m)));
      historyRef.current = [...historyRef.current, { role: 'user', text: heard }, { role: 'assistant', text: reply.reply }];
      add({ role: 'assistant', text: reply.reply, reply });
      setBusy(false);
      if (autoSpeak) await speakText(reply.reply, accent, 'fa');
    } catch (e) {
      add({ role: 'assistant', text: isAbort(e) ? t.aiCancelled : aiErrorText(e), error: !isAbort(e), detail: isAbort(e) ? undefined : aiErrorDetail(e) });
    } finally {
      setBusy(false);
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  };

  const startNote = async () => {
    try {
      setNote(await startVoiceNote());
    } catch (e) {
      toast(e instanceof VoiceNoteError ? e.message : t.errRecorder, 'error');
    }
  };

  const talkOnce = async () => {
    // Recording a question → second tap stops and sends it.
    if (note) {
      const n = note;
      setNote(null);
      const audio = await n.stop();
      if (audio && audio.size > 1000) await sendVoice(audio);
      else toast(t.errTooShort, 'error');
      return;
    }
    if (listening) return stopListening();
    stopSpeaking();
    if (useRecording) return startNote();
    setListening(true);
    try {
      const heard = await listenOnce(listenLang);
      setListening(false);
      if (heard) await send(heard);
    } catch (e) {
      setListening(false);
      const code = e instanceof ListenError ? e.code : '';
      if (code === 'not-allowed' || code === 'service-not-allowed') return toast(listenErrorText(e), 'error');
      // The phone's speech recognition does not work here: record the question instead.
      setUseRecording(true);
      toast(t.switchToRecording, 'info');
    }
  };

  /** Live mode: listen → answer out loud → listen again, until stopped. */
  const toggleLive = async () => {
    if (liveRef.current) {
      liveRef.current = false;
      setLive(false);
      stopListening();
      stopSpeaking();
      cancelAsk();
      return;
    }
    if (useRecording) {
      toast(t.liveNeedsRecognition, 'info');
      return;
    }
    liveRef.current = true;
    setLive(true);
    let quiet = 0;
    let failures = 0;
    try {
      while (liveRef.current) {
        setListening(true);
        let heard = '';
        try {
          heard = await listenOnce(listenLang);
        } catch (e) {
          toast(listenErrorText(e), 'error');
          break;
        } finally {
          setListening(false);
        }
        if (!liveRef.current) break;
        if (!heard) {
          if (++quiet >= 3) break; // three silent turns: stop by itself
          continue;
        }
        quiet = 0;
        const r = await send(heard);
        if (!liveRef.current) break;
        if (!r) {
          if (++failures >= 2) break; // two answers in a row failed: stop and show why
          continue; // otherwise keep listening
        }
        failures = 0;
      }
    } catch (e) {
      console.error('live mode stopped', e);
      toast(t.errGeneric, 'error');
    } finally {
      liveRef.current = false;
      setLive(false);
      setListening(false);
    }
  };

  const saveItem = async (text: string, meaning: string) => {
    try {
      await lib.saveText(`${text} ${meaning}`.trim().slice(0, 200), accent, readLastFolder());
      toast(t.savedInLibrary, 'success');
    } catch {
      toast(t.saveFailed, 'error');
    }
  };

  if (provider === undefined) return <p className="state state-busy"><span className="spinner" aria-hidden /> {t.authWait}</p>;

  return (
    <section className="screen tutor-screen">
      <h1 className="title">{t.tutorTitle}</h1>
      <p className="meta center-text">{provider === 'claude' ? t.tutorWithClaude : provider ? t.tutorWithKey(providerName) : ''}</p>

      {!provider && (
        <div className="card">
          <p className="state-title">{t.aiNoProviderTitle}</p>
          <p className="meta">{t.aiNoProvider}</p>
          <button className="btn btn-primary" onClick={onOpenSettings}>⚙️ {t.aiOpenSettings}</button>
        </div>
      )}

      {(
        <>
          {messages.length === 0 && (
            <div className="card tutor-hello">
              <p>{t.tutorHello}</p>
              <div className="row wrap center">
                {t.tutorStarters.map((s) => (
                  <button key={s} className="chip" onClick={() => void send(s)} disabled={busy}>{s}</button>
                ))}
              </div>
            </div>
          )}

          <div className="chat" aria-live="polite">
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.role}${m.error ? ' error' : ''}`}>
                {m.imageUrl && <img className="bubble-photo" src={m.imageUrl} alt="" />}
                <p dir="auto">{m.text}</p>
                {m.detail && <p className="meta diag" dir="ltr">{m.detail}</p>}
                {m.role === 'assistant' && !m.error && (
                  <div className="row wrap">
                    <PronounceButton text={m.text} lang="fa" accent={accent} />
                  </div>
                )}
                {m.reply?.items.map((it, i) => (
                  <div key={i} className="tutor-item">
                    <div className="tutor-item-text">
                      <b dir="auto">{it.text}</b>
                      {it.say && <span className="meta"> ({it.say})</span>}
                      {it.meaning && <span dir="auto"> = {it.meaning}</span>}
                    </div>
                    <div className="row">
                      <PronounceButton text={it.text} lang={it.lang ?? 'en'} accent={accent} />
                      <button className="btn btn-secondary btn-small" onClick={() => saveItem(it.text, it.meaning)} title={t.saveToLibrary}>💾</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {busy && (
              <div className="bubble assistant">
                <p className="state-busy">
                  <span className="spinner" aria-hidden /> {t.tutorThinkingWith(providerName)}
                  {waitSecs >= 3 && <span className="meta"> ({waitSecs.toLocaleString('fa-IR')} {t.seconds})</span>}
                </p>
                <button className="btn btn-ghost btn-small" onClick={cancelAsk}>✖️ {t.cancel}</button>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {cameraOn && <CameraPanel ref={cameraRef} onClose={() => setCameraOn(false)} />}

          <form
            className="tutor-input"
            onSubmit={(e) => {
              e.preventDefault();
              const v = input;
              setInput('');
              void send(v);
            }}
          >
            <textarea
              className="input"
              dir="auto"
              rows={2}
              placeholder={t.tutorPlaceholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement).requestSubmit();
                }
              }}
            />
            <button className="btn btn-confirm" type="submit" disabled={busy || !input.trim()}>📨 {t.tutorSend}</button>
          </form>

          <div className="tutor-tools">
            <button className={`btn ${(listening && !live) || note ? 'btn-stop' : 'btn-secondary'}`} onClick={talkOnce} disabled={busy || live}>
              {note ? `⏹️ ${t.tutorRecordingQ}` : `🎙️ ${listening && !live ? t.tutorListening : t.tutorTalk}`}
            </button>
            <button className={`btn ${live ? 'btn-stop' : 'btn-primary'}`} onClick={toggleLive} disabled={busy && !live}>
              {live ? `⏹️ ${t.tutorLiveStop}` : `🔴 ${t.tutorLive}`}
            </button>
            <button className="btn btn-secondary" onClick={() => photoRef.current?.click()} disabled={busy}>📸 {t.tutorPhoto}</button>
            <button className={`btn ${cameraOn ? 'btn-stop' : 'btn-secondary'}`} onClick={() => setCameraOn((v) => !v)}>
              🎥 {cameraOn ? t.cameraClose : t.tutorCamera}
            </button>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void send(input, f);
              }}
            />
          </div>
          <div className="row wrap center">
            <span className="meta">{t.tutorListenLang}</span>
            {LISTEN_LANGS.map((l) => (
              <button key={l.tag} className={`chip${listenLang === l.tag ? ' on' : ''}`} onClick={() => setListenLang(l.tag)}>{l.label}</button>
            ))}
            <label className="chip">
              <input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} /> 🔊 {t.tutorAutoSpeak}
            </label>
          </div>
          {useRecording && <p className="meta center-text">{t.recordingModeInfo}</p>}
          {live && <p className="msg msg-info center-text">{listening ? t.tutorLiveListening : t.tutorLiveSpeaking}</p>}
        </>
      )}

    </section>
  );
}

function sessionStorageFlag(key: string): boolean {
  try {
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, '1');
  } catch {
    /* ignore */
  }
  return false;
}
