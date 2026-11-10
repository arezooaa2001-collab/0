import { useEffect, useRef, useState } from 'react';
import { AiError, type ChatTurn, type Provider, type TutorReply, aiLog, aiLogLines, aiLogReset, askTutor, currentProvider, onAiLog } from '../lib/ai';
import { APP_VERSION } from '../lib/config';
import { dictionaryAnswer } from '../lib/miniDict';
import { isAbcCommand, wantsPromptCode } from '../lib/gameStudio';
import { GameStudio } from './GameStudio';
import { TARGET_NAMES, type TargetLang, parseTranslateRequest, translateFree } from '../lib/translate';
import { isNativeApp } from '../lib/native';
import { aiErrorDetail, aiErrorText } from '../lib/aiErrors';
import { LANGS } from '../lib/langs';
import { speakTag, speakText, stopSpeaking } from '../lib/speech';
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
  /** Answered from the app's own dictionary because the AI could not be reached. */
  offline?: boolean;
  /** Full step-by-step report for «📋 کپی گزارش». */
  report?: string;
  /** A translation («…» را به «…» ترجمه کن). */
  tr?: Translated;
  /** The «/ABC» menu. */
  menu?: boolean;
}

interface Translated {
  original: string;
  text: string;
  /** Latin-letter reading for scripts a Persian child cannot read yet. */
  reading: string;
  target: TargetLang;
  /** Came from the app's own dictionary (no internet). */
  offline?: boolean;
}

/** Hard limit for one question: whatever happens, «thinking» ends. */
const DEADLINE_MS = 32_000;

/**
 * «معلم مهربان» — text only: type a question (or use the keyboard's own voice typing),
 * get the answer in a box with «🔊 تلفظ», plus a box for every word it teaches.
 */
export function TutorScreen({ lib, accent, onOpenSettings }: { lib: Library; accent: Accent; onOpenSettings: () => void }) {
  const toast = useToast();
  const [provider, setProvider] = useState<Provider | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<false | 'chat' | 'translate'>(false);
  const [waitSecs, setWaitSecs] = useState(0);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [stage, setStage] = useState('');
  const [view, setView] = useState<'chat' | 'studio' | 'games'>('chat');
  const [studioIdea, setStudioIdea] = useState('');
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

  useEffect(() => onAiLog((line) => setStage(line.replace(/^\+[\d.]+s /, ''))), []);

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

  /** One request with the hard deadline: whatever happens, «thinking» ends. */
  const withDeadline = <T,>(p: Promise<T>, ctrl: AbortController): Promise<T> =>
    Promise.race([
      p,
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          ctrl.abort();
          reject(new AiError('timeout', `no answer within ${DEADLINE_MS / 1000} s`));
        }, DEADLINE_MS),
      ),
    ]);

  /** «متن» را به «زبان» ترجمه کن: free translation (no key); then the AI, then the app's own dictionary. */
  const translate = async (text: string, target: TargetLang, signal: AbortSignal): Promise<Translated> => {
    try {
      aiLog(`translate → ${target.code}`);
      const r = await translateFree(text, target, signal);
      aiLog(`← translated (${r.from || '?'} → ${target.code})`);
      return { original: text, text: r.text, reading: r.reading, target };
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw e;
      aiLog(`✗ translate: ${(e as Error)?.message ?? e}`);
      if (provider) {
        const r = await askTutor([{ role: 'user', text: `«${text}» را به «${target.name}» ترجمه کن. در "reply" فقط خود ترجمه را بنویس، بدون هیچ توضیحی.` }], null, { signal });
        return { original: text, text: r.reply, reading: '', target };
      }
      if (target.code === 'en' || target.code === 'fa') {
        const d = dictionaryAnswer(`«${text}» به ${target.name} ترجمه`);
        const it = d?.items[0];
        if (it && d!.items.length === 1) return { original: text, text: target.code === 'en' ? it.text : it.meaning, reading: '', target, offline: true };
      }
      throw new AiError('network', `translation: ${(e as Error)?.message ?? e}`);
    }
  };

  const send = async (raw: string) => {
    const q = raw.trim();
    if (!q || busy) return;
    if (isAbcCommand(q)) {
      add({ role: 'user', text: q });
      add({ role: 'assistant', text: t.abcMenuText, menu: true });
      return;
    }
    // «… /Prompt Code» in the chat: that is a game request, so open the studio and start building.
    if (wantsPromptCode(q)) {
      setStudioIdea(q);
      setView('studio');
      return;
    }
    const tr = parseTranslateRequest(q);
    if (!tr && !provider) {
      add({ role: 'user', text: q });
      add({ role: 'assistant', text: t.aiNoProviderChat, error: true });
      return;
    }
    // From here on, everything is inside one protected block: «thinking» ALWAYS ends.
    setBusy(tr ? 'translate' : 'chat');
    setStage('');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let reply: TutorReply | null = null;
    let translated: Translated | null = null;
    try {
      try {
        stopSpeaking();
      } catch {
        /* not important */
      }
      add({ role: 'user', text: q });
      aiLogReset();
      aiLog(`AMIR ABC v${APP_VERSION} ${isNativeApp() ? 'APK' : 'web'} · ${provider ?? 'no key'}`);
      if (tr && !tr.ok) {
        add({ role: 'assistant', text: t.trUnknownLang(tr.name, TARGET_NAMES), error: true });
      } else if (tr) {
        translated = await withDeadline(translate(tr.text, tr.target, ctrl.signal), ctrl);
        aiLog('answer shown');
        add({ role: 'assistant', text: translated.text, tr: translated });
      } else {
        const history = [...historyRef.current, { role: 'user' as const, text: q }];
        reply = await withDeadline(askTutor(history, null, { signal: ctrl.signal }), ctrl);
        historyRef.current = [...history, { role: 'assistant', text: reply.reply }];
        aiLog('answer shown');
        add({ role: 'assistant', text: reply.reply, reply });
      }
    } catch (e) {
      const cancelled = (e as Error)?.name === 'AbortError' && !(e instanceof AiError);
      if (cancelled) add({ role: 'assistant', text: t.aiCancelled });
      else {
        aiLog(`failed: ${aiErrorDetail(e)}`);
        const report = [...aiLogLines(), navigator.userAgent].join('\n');
        add({ role: 'assistant', text: tr ? t.trFailed : aiErrorText(e), error: true, detail: aiErrorDetail(e), report });
      }
    } finally {
      setBusy(false);
      if (abortRef.current === ctrl) abortRef.current = null;
    }
    // Reading the answer aloud is separate: it can never block or undo the answer.
    if (!autoSpeak) return;
    try {
      if (translated) {
        const tg = translated.target;
        if (tg.app) await speakText(translated.text, accent, tg.app);
        else await speakTag(translated.text, tg.tag);
      } else if (reply) {
        const r = await speakText(reply.reply, accent, 'fa');
        if (r.missing.includes('fa') && !sessionFlag('fa-voice-warned')) toast(t.noVoiceForLang(LANGS.fa.name), 'error');
      }
    } catch {
      /* the answer is already on screen */
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

  if (view !== 'chat')
    return <GameStudio provider={provider} start={view} initialIdea={studioIdea} onBack={() => { setStudioIdea(''); setView('chat'); }} onOpenSettings={onOpenSettings} />;

  const providerName = provider === 'claude' ? 'Claude' : provider === 'openai' ? 'ChatGPT' : provider === 'custom' ? t.aiCustomShort : 'Gemini';

  return (
    <section className="screen tutor-screen">
      <h1 className="title">{t.tutorTitle}</h1>
      <p className="meta center-text">
        {provider === 'claude' ? t.tutorWithClaude : provider ? t.tutorWithKey(providerName) : t.tutorNoKeyLine} <span className="badge">{t.versionLabel(APP_VERSION)}</span>
      </p>

      {!provider && (
        <div className="card">
          <p className="state-title">{t.aiNoProviderTitle}</p>
          <p className="meta">{t.aiNoProviderChat}</p>
          <button className="btn btn-primary" onClick={onOpenSettings}>⚙️ {t.aiOpenSettings}</button>
        </div>
      )}

      {messages.length === 0 && (
        <div className="card tutor-hello">
          <p>{t.tutorHelloText}</p>
          <div className="row wrap center">
            {t.tutorStarters.map((s) => (
              <button key={s} className="chip" dir="auto" onClick={() => void send(s)} disabled={!!busy}>{s}</button>
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
                  {m.report && <ReportButton report={m.report} />}
                </>
              ) : m.menu ? (
                <>
                  <p dir="auto">{m.text}</p>
                  <div className="abc-menu">
                    <button className="btn btn-primary btn-big abc-option" onClick={() => setView('studio')}>🧑‍💻 {t.abcCoding}</button>
                    <button className="btn btn-secondary btn-big abc-option" onClick={() => setView('games')}>🎮 {t.abcMyGames}</button>
                  </div>
                </>
              ) : m.tr ? (
                <>
                  <p className="meta tr-head" dir="auto">{t.trHeader(m.tr.original, m.tr.target.name)}</p>
                  <div className="answer-box tr-box">
                    <p className="tr-text" dir="auto" lang={m.tr.target.code}>{m.tr.text}</p>
                    {m.tr.reading && <p className="meta" dir="ltr">({m.tr.reading})</p>}
                    <div className="row">
                      <PronounceButton
                        text={m.tr.text}
                        lang={m.tr.target.app ?? 'en'}
                        accent={accent}
                        voice={m.tr.target.app ? undefined : { tag: m.tr.target.tag, name: m.tr.target.name }}
                      />
                      <button className="btn btn-secondary btn-small" onClick={() => saveItem(m.tr!.text, m.tr!.original)} title={t.saveToLibrary} aria-label={t.saveToLibrary}>
                        💾
                      </button>
                    </div>
                  </div>
                  {m.tr.offline && <p className="meta offline-note">{t.tutorOfflineNote}</p>}
                </>
              ) : (
                <>
                  {m.offline && <p className="meta offline-note">{m.detail ? t.tutorOfflineNote : t.tutorOfflineNoKey}</p>}
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
                  {m.offline && m.detail && <p className="meta diag" dir="ltr">{m.detail}</p>}
                  {m.offline && m.report && <ReportButton report={m.report} />}
                </>
              )}
            </div>
          ),
        )}
        {busy && (
          <div className="bubble assistant">
            <p className="state-busy">
              <span className="spinner" aria-hidden /> {busy === 'translate' ? t.trWorking : t.tutorThinkingWith(providerName)}
              {waitSecs >= 3 && <span className="meta"> ({waitSecs.toLocaleString('fa-IR')} {t.seconds})</span>}
            </p>
            {stage && <p className="meta diag" dir="ltr">{stage}</p>}
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
        <button className="btn btn-confirm" type="submit" disabled={!!busy || !input.trim()}>📨 {t.tutorSend}</button>
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

/** Copies the step-by-step report, so a parent can paste it in a message. */
function ReportButton({ report }: { report: string }) {
  const [copied, setCopied] = useState(false);
  const [show, setShow] = useState(false);
  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(report);
      ok = true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = report;
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        ta.remove();
      } catch {
        /* show it instead */
      }
    }
    setCopied(ok);
    setShow(true);
  };
  return (
    <div className="report">
      <button className="btn btn-ghost btn-small" onClick={() => void copy()}>📋 {copied ? t.reportCopied : t.reportCopy}</button>
      {show && <pre className="report-text" dir="ltr">{report}</pre>}
    </div>
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
