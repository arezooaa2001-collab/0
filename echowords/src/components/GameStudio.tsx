import { useEffect, useRef, useState } from 'react';
import { AiError, type Provider, aiLogLines, aiLogReset } from '../lib/ai';
import { aiErrorDetail, aiErrorText } from '../lib/aiErrors';
import {
  type BuiltGame,
  type SavedGame,
  buildGame,
  changeGame,
  deleteGame,
  downloadGame,
  gameTitle,
  improvePrompt,
  listGames,
  saveGame,
  stripPromptCode,
  wantsPromptCode,
} from '../lib/gameStudio';
import { t } from '../lib/strings';
import { useToast } from './Toast';

/** Whatever happens, one build ends within this time. */
const BUILD_DEADLINE_MS = (globalThis as { __ECHOWORDS_GAME_DEADLINE__?: number }).__ECHOWORDS_GAME_DEADLINE__ ?? 300_000;

type Stage = 'improve' | 'build' | 'change';

interface Current {
  /** What the game was built from (the improved brief, or the child's words). */
  description: string;
  prompt: string;
  game: BuiltGame;
  savedId?: string;
}

export function GameStudio({
  provider,
  start,
  initialIdea = '',
  onBack,
  onOpenSettings,
}: {
  provider: Provider | null;
  start: 'studio' | 'games';
  /** A request typed in the chat («… /Prompt Code»): built at once. */
  initialIdea?: string;
  onBack: () => void;
  onOpenSettings: () => void;
}) {
  const toast = useToast();
  const [view, setView] = useState<'studio' | 'games'>(start);
  const [idea, setIdea] = useState(initialIdea);
  const [change, setChange] = useState('');
  const [stage, setStage] = useState<Stage | null>(null);
  const [secs, setSecs] = useState(0);
  const [chars, setChars] = useState(0);
  const [brief, setBrief] = useState<string | null>(null);
  const [current, setCurrent] = useState<Current | null>(null);
  const [error, setError] = useState<{ text: string; detail: string; report: string } | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [full, setFull] = useState(false);
  const [games, setGames] = useState<SavedGame[]>(() => listGames());
  const abortRef = useRef<AbortController | null>(null);

  const gameRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  // A new game (or a replay): bring it into view.
  useEffect(() => {
    if (runKey) gameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [runKey]);
  useEffect(() => {
    if (initialIdea.trim() && provider) void build(initialIdea);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!stage) return;
    setSecs(0);
    const t0 = Date.now();
    const id = window.setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [stage]);

  /** Runs one AI job with a hard deadline; «ساختن» always ends. */
  const job = async <T,>(s: Stage, fn: (signal: AbortSignal) => Promise<T>): Promise<T | null> => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStage(s);
    setChars(0);
    try {
      return await Promise.race([
        fn(ctrl.signal),
        new Promise<never>((_, reject) =>
          setTimeout(() => {
            ctrl.abort();
            reject(new AiError('timeout', `no game within ${BUILD_DEADLINE_MS / 1000} s`));
          }, BUILD_DEADLINE_MS),
        ),
      ]);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError' && !(e instanceof AiError)) toast(t.aiCancelled, 'success');
      else {
        const report = [...aiLogLines(), `failed: ${aiErrorDetail(e)}`, navigator.userAgent].join('\n');
        setError({ text: e instanceof AiError ? aiErrorText(e) : t.gameFailed, detail: aiErrorDetail(e), report });
      }
      return null;
    } finally {
      setStage(null);
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  };

  const build = async (text = idea) => {
    const raw = text.trim();
    if (!raw || stage) return;
    const prompt = stripPromptCode(raw);
    if (!prompt) return;
    setError(null);
    setBrief(null);
    aiLogReset();
    let description = prompt;
    if (wantsPromptCode(raw)) {
      const better = await job('improve', (signal) => improvePrompt(prompt, signal));
      if (!better) return;
      setBrief(better);
      description = `${better}\n\n(The child's own words: ${prompt})`;
    }
    const game = await job('build', (signal) => buildGame(description, { signal, onProgress: setChars }));
    if (!game) return;
    setCurrent({ description, prompt, game });
    setRunKey((k) => k + 1);
  };

  const applyChange = async () => {
    const c = change.trim();
    if (!c || !current || stage) return;
    setError(null);
    aiLogReset();
    const game = await job('change', (signal) => changeGame(current.description, current.game.html, c, { signal, onProgress: setChars }));
    if (!game) return;
    setCurrent({ ...current, description: `${current.description}\n\nThen changed: ${c}`, game, savedId: undefined });
    setChange('');
    setRunKey((k) => k + 1);
  };

  const keep = () => {
    if (!current) return;
    const g = saveGame({ title: gameTitle(current.game.html, current.prompt), prompt: current.prompt, html: current.game.html });
    if (!g) return toast(t.gameNoRoom, 'error');
    setCurrent({ ...current, savedId: g.id });
    setGames(listGames());
    toast(t.gameSaved, 'success');
  };

  const play = (g: SavedGame) => {
    setCurrent({ description: g.prompt, prompt: g.prompt, game: { html: g.html, incomplete: false }, savedId: g.id });
    setBrief(null);
    setError(null);
    setView('studio');
    setRunKey((k) => k + 1);
  };

  const busyText = stage === 'improve' ? t.gameImproving : stage === 'change' ? t.gameChanging : t.gameBuilding;
  const providerOk = !!provider;

  return (
    <section className="screen studio-screen">
      <div className="row studio-head">
        <button className="btn btn-ghost btn-small" onClick={onBack}>➡️ {t.backToTutor}</button>
        <div className="row">
          <button className={`chip${view === 'studio' ? ' on' : ''}`} onClick={() => setView('studio')}>🧑‍💻 {t.abcCoding}</button>
          <button className={`chip${view === 'games' ? ' on' : ''}`} onClick={() => { setGames(listGames()); setView('games'); }}>🎮 {t.abcMyGames} ({games.length.toLocaleString('fa-IR')})</button>
        </div>
      </div>

      {view === 'games' ? (
        <>
          <h1 className="title">🎮 {t.abcMyGames}</h1>
          {!games.length ? (
            <p className="empty">{t.gamesEmpty}</p>
          ) : (
            <div className="games-list">
              {games.map((g) => (
                <div key={g.id} className="card game-card">
                  <div>
                    <p className="state-title" dir="auto">{g.title}</p>
                    <p className="meta" dir="auto">{g.prompt.slice(0, 120)}</p>
                  </div>
                  <div className="row">
                    <button className="btn btn-primary btn-small" onClick={() => play(g)}>▶️ {t.gamePlay}</button>
                    <button className="btn btn-ghost btn-small" aria-label={t.gameDelete} onClick={() => { deleteGame(g.id); setGames(listGames()); }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <h1 className="title">🧑‍💻 {t.abcCoding}</h1>
          <p className="meta center-text">{t.studioHelp}</p>

          {!providerOk && (
            <div className="card">
              <p className="state-title">{t.studioNeedsAi}</p>
              <p className="meta">{t.studioNeedsAiHelp}</p>
              <button className="btn btn-primary" onClick={onOpenSettings}>⚙️ {t.aiOpenSettings}</button>
            </div>
          )}

          <form
            className="studio-input"
            onSubmit={(e) => {
              e.preventDefault();
              void build();
            }}
          >
            <textarea className="input" dir="auto" rows={3} placeholder={t.studioPlaceholder} value={idea} onChange={(e) => setIdea(e.target.value)} />
            <button className="btn btn-confirm btn-big" type="submit" disabled={!!stage || !idea.trim() || !providerOk}>🚀 {t.studioBuild}</button>
          </form>
          {!current && !stage && (
            <div className="row wrap center">
              {t.studioExamples.map((ex) => (
                <button key={ex} className="chip" dir="auto" onClick={() => setIdea(ex)}>{ex}</button>
              ))}
            </div>
          )}

          {stage && (
            <div className="card studio-busy" role="status">
              <p className="state-busy">
                <span className="spinner" aria-hidden /> {busyText} <span className="meta">({secs.toLocaleString('fa-IR')} {t.seconds})</span>
              </p>
              {chars > 0 && <p className="meta">{t.gameWritten(chars)}</p>}
              <p className="meta">{t.gameWaitHelp}</p>
              <button className="btn btn-ghost btn-small" onClick={() => abortRef.current?.abort()}>✖️ {t.cancel}</button>
            </div>
          )}

          {brief && (
            <details className="card brief" open={!current}>
              <summary>✨ {t.briefTitle}</summary>
              <pre className="brief-text" dir="ltr">{brief}</pre>
            </details>
          )}

          {error && (
            <div className="msg msg-error" role="alert">
              <p>{error.text}</p>
              <p className="meta diag" dir="ltr">{error.detail}</p>
              <details>
                <summary>📋 {t.reportCopy}</summary>
                <pre className="report-text" dir="ltr">{error.report}</pre>
              </details>
            </div>
          )}

          {current && (
            <div ref={gameRef} className={`game-wrap${full ? ' full' : ''}`}>
              {current.game.incomplete && <p className="msg msg-error">{t.gameIncomplete}</p>}
              <iframe
                key={runKey}
                className="game-frame"
                title={gameTitle(current.game.html, current.prompt)}
                sandbox="allow-scripts allow-pointer-lock"
                srcDoc={current.game.html}
              />
              <div className="row wrap center game-actions">
                <button className="btn btn-secondary btn-small" onClick={() => setRunKey((k) => k + 1)}>🔄 {t.gameRestart}</button>
                <button className="btn btn-secondary btn-small" onClick={() => setFull((f) => !f)}>{full ? `↩️ ${t.gameExitFull}` : `⛶ ${t.gameFull}`}</button>
                {!full && (
                  <>
                    <button className="btn btn-primary btn-small" disabled={!!current.savedId} onClick={keep}>💾 {current.savedId ? t.gameSavedShort : t.gameSave}</button>
                    <button
                      className="btn btn-ghost btn-small"
                      onClick={() => void downloadGame(gameTitle(current.game.html, current.prompt), current.game.html).catch(() => toast(t.saveFailed, 'error'))}
                    >
                      ⬇️ {t.gameDownload}
                    </button>
                  </>
                )}
              </div>
              {!full && (
                <form
                  className="studio-input"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void applyChange();
                  }}
                >
                  <textarea className="input" dir="auto" rows={2} placeholder={t.gameChangePlaceholder} value={change} onChange={(e) => setChange(e.target.value)} />
                  <button className="btn btn-secondary" type="submit" disabled={!!stage || !change.trim() || !providerOk}>✏️ {t.gameChange}</button>
                </form>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
