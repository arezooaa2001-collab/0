import { useEffect, useRef, useState } from 'react';
import { AiError, type ChatTurn, type Provider, type TutorReply, askTutor, currentProvider } from '../lib/ai';
import { aiErrorDetail, aiErrorText } from '../lib/aiErrors';
import { LANGS } from '../lib/langs';
import { speakText, stopSpeaking } from '../lib/speech';
import type { Accent } from '../lib/stt';
import { t } from '../lib/strings';
import type { Library } from '../lib/useLibrary';
import { readLastFolder } from './FolderPicker';
import { PronounceButton } from './PronounceButton';
import { useToast } from './Toast';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  reply?: TutorReply;
  error?: boolean;
  /** Technical reason (small, for a screenshot when something fails). */
  detail?: string;
}

/** Hard limit for one question: whatever happens, «thinking» ends. */
const DEADLINE_MS = 40_000;

/**
 * «معلم مهربان» — text only: type a question (or use the keyboard's own voice typing),
 * get the answer in a box with «🔊 تلفظ», plus a box for every word it teaches.
 */
export function TutorScreen({ lib, accent, onOpenSettings }: { lib: Library; accent: Accent; onOpenSettings: () => void }) {
  const toast = useToast();
  const [provider, setProvider] = useState<Provider | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [waitSecs, setWaitSecs] = useState(0);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<ChatTurn[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void currentProvider().then(setProvider, () => setProvider(null));
    return () => {
      abortRef.current?.abort();
      try {
        stopSpeaking();
      } catch {
        /* leaving the screen must never fail */
      }
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  useEffect(() => {
    if (!busy) return;
    setWaitSecs(0);
    const started = Date.now();
    const id = window.setInterval(() => setWaitSecs(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const add = (m: Omit<Message, 'id'>) => setMessages((prev) => [...prev, { ...m, id: nextId.current++ }]);

  const send = async (raw: string) => {
    const q = raw.trim();
    if (!q || busy) return;
    if (!provider) {
      add({ role: 'user', text: q });
      add({ role: 'assistant', text: t.aiNoProvider, error: true });
      return;
    }
    // From here on, everything is inside one protected block: «thinking» ALWAYS ends.
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let reply: TutorReply | null = null;
    try {
      try {
        stopSpeaking();
      } catch {
        /* not important */
      }
      add({ role: 'user', text: q });
      const history = [...historyRef.current, { role: 'user' as const, text: q }];
      reply = await Promise.race([
        askTutor(history, null, { signal: ctrl.signal }),
        new Promise<never>((_, reject) =>
          setTimeout(() => {
            ctrl.abort();
            reject(new AiError('timeout', `no answer within ${DEADLINE_MS / 1000} s`));
          }, DEADLINE_MS),
        ),
      ]);
      historyRef.current = [...history, { role: 'assistant', text: reply.reply }];
      add({ role: 'assistant', text: reply.reply, reply });
    } catch (e) {
      const cancelled = (e as Error)?.name === 'AbortError' && !(e instanceof AiError);
      add({ role: 'assistant', text: cancelled ? t.aiCancelled : aiErrorText(e), error: !cancelled, detail: cancelled ? undefined : aiErrorDetail(e) });
    } finally {
      setBusy(false);
      if (abortRef.current === ctrl) abortRef.current = null;
    }
    // Reading the answer aloud is separate: it can never block or undo the answer.
    if (reply && autoSpeak) {
      try {
        const r = await speakText(reply.reply, accent, 'fa');
        if (r.missing.includes('fa') && !sessionFlag('fa-voice-warned')) toast(t.noVoiceForLang(LANGS.fa.name), 'error');
      } catch {
        /* the answer is already on screen */
      }
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

  const providerName = provider === 'claude' ? 'Claude' : provider === 'openai' ? 'ChatGPT' : provider === 'custom' ? t.aiCustomShort : 'Gemini';

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

      {messages.length === 0 && (
        <div className="card tutor-hello">
          <p>{t.tutorHelloText}</p>
          <div className="row wrap center">
            {t.tutorStarters.map((s) => (
              <button key={s} className="chip" onClick={() => void send(s)} disabled={busy}>{s}</button>
            ))}
          </div>
        </div>
      )}

      <div className="chat" aria-live="polite">
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="bubble user">
              <p dir="auto">{m.text}</p>
            </div>
          ) : (
            <div key={m.id} className={`bubble assistant${m.error ? ' error' : ''}`}>
              {m.error ? (
                <>
                  <p dir="auto">{m.text}</p>
                  {m.detail && <p className="meta diag" dir="ltr">{m.detail}</p>}
                </>
              ) : (
                <>
                  <div className="answer-box">
                    <p dir="auto">{m.text}</p>
                    <PronounceButton text={m.text} lang="fa" accent={accent} />
                  </div>
                  {m.reply?.items.map((it, i) => (
                    <div key={i} className="tutor-item">
                      <div className="tutor-item-text">
                        <b dir="auto">{it.text}</b>
                        {it.say && <span className="meta"> ({it.say})</span>}
                        {it.meaning && <span dir="auto"> = {it.meaning}</span>}
                      </div>
                      <div className="row">
                        <PronounceButton text={it.text} lang={it.lang ?? 'en'} accent={accent} />
                        <button className="btn btn-secondary btn-small" onClick={() => saveItem(it.text, it.meaning)} title={t.saveToLibrary} aria-label={t.saveToLibrary}>
                          💾
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          ),
        )}
        {busy && (
          <div className="bubble assistant">
            <p className="state-busy">
              <span className="spinner" aria-hidden /> {t.tutorThinkingWith(providerName)}
              {waitSecs >= 3 && <span className="meta"> ({waitSecs.toLocaleString('fa-IR')} {t.seconds})</span>}
            </p>
            <button className="btn btn-ghost btn-small" onClick={() => abortRef.current?.abort()}>✖️ {t.cancel}</button>
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
      <div className="row wrap center">
        <label className="chip">
          <input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} /> 🔊 {t.tutorAutoSpeak}
        </label>
      </div>
      <p className="meta center-text">{t.tutorKeyboardVoice}</p>
    </section>
  );
}

function sessionFlag(key: string): boolean {
  try {
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, '1');
  } catch {
    /* ignore */
  }
  return false;
}
