// «کدنویسی با هوش مصنوعی»: the child describes a game, an AI writes it as one HTML file,
// and the app runs it in a sealed frame (no access to the app, its words or the internet).
import { type ChatTurn, askRaw } from './ai';

export const GAME_SYSTEM = `You are a world-class HTML5 game developer. A 9-year-old Persian-speaking child describes a game; you build it for real.
Write ONE complete, polished, genuinely fun and playable game as a single self-contained HTML file.
Hard requirements:
- Everything inline in this one file: HTML, CSS and JavaScript. NO external files, libraries, fonts, images or network requests. Draw graphics with <canvas>, SVG, CSS or emoji. Make sounds with the Web Audio API (start audio only after the first tap or key press).
- It runs inside a sandboxed iframe on an Android tablet: no alert/confirm/prompt, no window.open, no fetch. If you use localStorage (e.g. for a high score), wrap every access in try/catch because it may be blocked.
- Fill the whole frame (100vw x 100vh, no scrollbars) and adapt to any size and to resizing; handle devicePixelRatio for a crisp canvas.
- Controls MUST work with touch (on-screen buttons, taps or swipes, using pointer events with touch-action: none) AND with the keyboard.
- Include: a start screen with the game's title and a one-line "how to play" in simple Persian (dir="rtl"), the score, increasing difficulty or levels, a clear win/lose screen and a restart button. All text the player sees is in Persian.
- Smooth animation with requestAnimationFrame and delta time. Add juice: particles, little bounces, colours, gentle sounds.
- Content must be friendly for a young child: no blood, horror or scary content.
- Write clean, bug-free code; check that the game can actually be started, played, won or lost, and restarted.
Answer with ONLY the HTML document, starting with <!DOCTYPE html> and ending with </html>. No explanations before or after.`;

const IMPROVE_SYSTEM = `You turn a child's game idea into an expert, detailed brief for an AI game developer, so the result is much better.
Keep the child's idea and everything they asked for; add what makes it great. Write in English, at most 300 words, with these headings:
Title (a fun Persian title), Core idea, Gameplay loop, Controls (touch AND keyboard), Characters and objects, Levels and difficulty, Scoring, Win and lose, Visual style (colours, shapes, emoji), Juice and feedback (particles, animations), Sounds (Web Audio), Persian text on screen.
The game must be one self-contained HTML file for a tablet and suitable for a 9-year-old. Answer with ONLY the brief.`;

/** «… /Prompt Code» at the end (or anywhere): improve the prompt first. */
const PROMPT_CODE = /\/\s*prompt\s*code\b/i;
export const wantsPromptCode = (s: string): boolean => PROMPT_CODE.test(s);
export const stripPromptCode = (s: string): string => s.replace(PROMPT_CODE, ' ').replace(/\s+/g, ' ').trim();

/** «/ABC» opens the menu. */
export const isAbcCommand = (s: string): boolean => /^\/\s*abc$/i.test(s.trim());

/** Long answers can take a while: one request may run this long. */
const timeout = (): number => (globalThis as { __ECHOWORDS_GAME_TIMEOUT__?: number }).__ECHOWORDS_GAME_TIMEOUT__ ?? 240_000;

export async function improvePrompt(idea: string, signal?: AbortSignal): Promise<string> {
  const r = await askRaw(IMPROVE_SYSTEM, [{ role: 'user', text: idea }], { signal, tier: 'quick', maxTokens: 1200, timeoutMs: timeout() });
  const brief = r.text.trim();
  if (!brief) throw new Error('empty brief');
  return brief;
}

export interface BuiltGame {
  html: string;
  /** The answer was cut off before </html>: the game may be unfinished. */
  incomplete: boolean;
}

/** Pull the HTML document out of the answer (it may be wrapped in a ``` block). */
export function extractHtml(answer: string): BuiltGame | null {
  let s = answer;
  const fence = /```(?:html)?\s*\n([\s\S]*?)(?:```|$)/i.exec(s);
  if (fence && /<html|<!doctype|<body|<canvas|<script/i.test(fence[1])) s = fence[1];
  const start = s.search(/<!doctype html|<html[\s>]/i);
  if (start === -1) {
    if (!/<(script|canvas|body|div)[\s>]/i.test(s)) return null;
    return { html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${s}</body></html>`, incomplete: false };
  }
  s = s.slice(start);
  const end = s.search(/<\/html>/i);
  if (end !== -1) return { html: s.slice(0, end + 7), incomplete: false };
  return { html: s, incomplete: true };
}

export interface BuildOptions {
  signal?: AbortSignal;
  onProgress?: (chars: number) => void;
}

/** Build a new game from a description (or a brief). */
export async function buildGame(description: string, opts: BuildOptions = {}): Promise<BuiltGame> {
  return run([{ role: 'user', text: `Build this game:\n\n${description}` }], opts);
}

/** Change an existing game: the AI gets its code and the child's request. */
export async function changeGame(description: string, html: string, change: string, opts: BuildOptions = {}): Promise<BuiltGame> {
  return run(
    [
      { role: 'user', text: `Build this game:\n\n${description}` },
      { role: 'assistant', text: html },
      { role: 'user', text: `Change the game like this (the child's words): ${change}\n\nKeep everything else working. Answer with the COMPLETE updated HTML file only.` },
    ],
    opts,
  );
}

async function run(turns: ChatTurn[], opts: BuildOptions): Promise<BuiltGame> {
  const r = await askRaw(GAME_SYSTEM, turns, { signal: opts.signal, tier: 'complex', maxTokens: 32_000, timeoutMs: timeout(), onProgress: opts.onProgress });
  const game = extractHtml(r.text);
  if (!game) throw new Error(`no HTML in the answer: ${r.text.slice(0, 120)}`);
  return { html: game.html, incomplete: game.incomplete || r.truncated };
}

// ── «بازی‌های من»: games kept on this device ─────────────────────────────────
export interface SavedGame {
  id: string;
  title: string;
  prompt: string;
  html: string;
  createdAt: string;
}

const KEY = 'echowords-games';
const MAX_GAMES = 30;

export function listGames(): SavedGame[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? (v as SavedGame[]) : [];
  } catch {
    return [];
  }
}

/** The game's own <title>, or the start of the request. */
export function gameTitle(html: string, prompt: string): string {
  const t = /<title>([^<]{1,80})<\/title>/i.exec(html)?.[1]?.trim();
  return t || prompt.slice(0, 40) || 'بازی من';
}

/** Returns false when the device has no room left. */
export function saveGame(g: Omit<SavedGame, 'id' | 'createdAt'>): SavedGame | null {
  const game: SavedGame = { ...g, id: `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, createdAt: new Date().toISOString() };
  const all = [game, ...listGames()].slice(0, MAX_GAMES);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
    return game;
  } catch {
    return null;
  }
}

export function deleteGame(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(listGames().filter((g) => g.id !== id)));
  } catch {
    /* ignore */
  }
}

/** Hand the game to the family as an .html file (Android «save as», Claude downloads, or a browser download). */
export async function downloadGame(title: string, html: string): Promise<boolean> {
  const { isNativeApp, nativeSaveFile } = await import('./native');
  const name = `${title.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 40) || 'game'}.html`;
  const blob = new Blob([html], { type: 'text/html' });
  if (isNativeApp()) return nativeSaveFile(name, 'text/html', blob);
  const use = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude?.use;
  if (typeof use === 'function') {
    const dl = (await use('downloads').catch(() => null)) as { save?: (r: { filename: string; data: Blob }) => Promise<unknown> } | null;
    if (dl?.save) {
      await dl.save({ filename: name, data: blob });
      return true;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
