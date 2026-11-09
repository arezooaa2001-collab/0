import { useEffect, useRef, useState } from 'react';
import { AiError, type ChatTurn, type Provider, type TutorReply, askTutor, askTutorByVoice, currentProvider, shrinkImage } from '../lib/ai';
import { type VoiceNote, VoiceNoteError, startVoiceNote } from '../lib/voiceNote';
import { LANGS } from '../lib/langs';
import { ListenError, canListen, listenOnce, stopListening } from '../lib/listen';
import { speakText, stopSpeaking } from '../lib/speech';
import type { Accent } from '../lib/stt';
import { t } from '../lib/strings';
import type { Library } from '../lib/useLibrary';
import { CameraCapture } from './CameraCapture';
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
}

const LISTEN_LANGS = [
  { tag: 'fa-IR', label: '🇮🇷 فارسی' },
  { tag: 'en-US', label: '🇬🇧 English' },
];

function aiErrorText(e: unknown): string {
  const code = e instanceof AiError ? e.code : 'other';
  if (code === 'not_granted') return t.aiNotGranted;
  if (code === 'bad_key') return t.aiBadKey;
  if (code === 'blocked') return t.aiBlocked;
  if (code === 'network') return t.aiNetwork;
  if (code === 'no_provider') return t.aiNoProvider;
  return t.aiOther;
}

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
  const [camera, setCamera] = useState(false);
  /** Recording a spoken question (used when the phone cannot turn speech into text). */
  const [note, setNote] = useState<VoiceNote | null>(null);
  const [useRecording, setUseRecording] = useState(() => !canListen());
  const liveRef = useRef(false);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<ChatTurn[]>([]);

  useEffect(() => {
    void currentProvider().then(setProvider);
    return () => {
      liveRef.current = false;
      stopListening();
      stopSpeaking();
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
    setBusy(true);
    stopSpeaking();
    add({ role: 'user', text: q, imageUrl: image ? URL.createObjectURL(image) : undefined });
    historyRef.current = [...historyRef.current, { role: 'user', text: q }];
    try {
      const reply = await askTutor(historyRef.current, image ? await shrinkImage(image) : null);
      historyRef.current = [...historyRef.current, { role: 'assistant', text: reply.reply }];
      add({ role: 'assistant', text: reply.reply, reply });
      setBusy(false);
      if (autoSpeak) {
        const r = await speakText(reply.reply, accent, 'fa');
        if (r.missing.includes('fa') && !sessionStorageFlag('fa-voice-warned')) toast(t.noVoiceForLang(LANGS.fa.name), 'error');
      }
      return reply;
    } catch (e) {
      historyRef.current = historyRef.current.slice(0, -1);
      add({ role: 'assistant', text: aiErrorText(e), error: true });
      setBusy(false);
      return null;
    }
  };

  /** Ask a recorded voice question (the AI or the device turns it into text). */
  const sendVoice = async (audio: Blob) => {
    if (!provider) {
      add({ role: 'assistant', text: t.aiNoProvider, error: true });
      return;
    }
    setBusy(true);
    stopSpeaking();
    const userId = nextId.current;
    add({ role: 'user', text: t.voiceQuestion });
    try {
      const reply = await askTutorByVoice(historyRef.current, audio);
      const heard = reply.heard || t.voiceQuestion;
      setMessages((prev) => prev.map((m) => (m.id === userId ? { ...m, text: `🎤 ${heard}` } : m)));
      historyRef.current = [...historyRef.current, { role: 'user', text: heard }, { role: 'assistant', text: reply.reply }];
      add({ role: 'assistant', text: reply.reply, reply });
      setBusy(false);
      if (autoSpeak) await speakText(reply.reply, accent, 'fa');
    } catch (e) {
      add({ role: 'assistant', text: aiErrorText(e), error: true });
      setBusy(false);
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
      return;
    }
    if (useRecording) {
      toast(t.liveNeedsRecognition, 'info');
      return;
    }
    liveRef.current = true;
    setLive(true);
    let quiet = 0;
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
      if (!r) break;
    }
    liveRef.current = false;
    setLive(false);
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
      <p className="meta center-text">{provider === 'claude' ? t.tutorWithClaude : provider ? t.tutorWithKey(provider === 'gemini' ? 'Gemini' : 'ChatGPT') : ''}</p>

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
                <p className="state-busy"><span className="spinner" aria-hidden /> {t.tutorThinking}</p>
              </div>
            )}
            <div ref={endRef} />
          </div>

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
            <button className="btn btn-secondary" onClick={() => setCamera(true)} disabled={busy}>🎥 {t.tutorCamera}</button>
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

      {camera && (
        <CameraCapture
          onCancel={() => setCamera(false)}
          onFallback={() => {
            setCamera(false);
            photoRef.current?.click();
          }}
          onPhoto={(b) => {
            setCamera(false);
            void send(input, b);
          }}
        />
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
