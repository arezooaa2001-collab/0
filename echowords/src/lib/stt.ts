// Pure logic that decides whether a speech-recognition result can be trusted.
// The app never saves a guess: anything doubtful is shown to the learner as a question.

export type Accent = 'auto' | 'us' | 'uk';
export type UnclearReason = 'empty' | 'not_english' | 'mismatch';

export interface Analysis {
  status: 'done' | 'unclear';
  /** Text the app may save as the word. Null when unclear. */
  transcript: string | null;
  /** What the recognizer heard (cleaned), offered only as a suggestion. */
  heard: string | null;
  reason: UnclearReason | null;
}

/** True if the text contains any letter that is not from the Latin alphabet (e.g. Persian, Arabic, Cyrillic). */
export function hasNonLatinLetters(text: string): boolean {
  return /(?![\p{Script=Latin}])\p{L}/u.test(text);
}

export function hasLatinLetters(text: string): boolean {
  return /\p{Script=Latin}/u.test(text);
}

/** Whisper marks non-speech as "[BLANK_AUDIO]", "(music)", "*laughs*", "♪" … — these are not words. */
export function stripNonSpeech(raw: string): string {
  return raw.replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*|[♪♫]/g, ' ');
}

/** Trim, collapse spaces, and drop the trailing full stop on a single word ("Apple." → "Apple"). */
export function tidyTranscript(raw: string): string {
  let t = raw.replace(/\s+/g, ' ').trim();
  if (!/\s/.test(t)) t = t.replace(/\.+$/, '');
  return t;
}

/** Compare texts ignoring case, punctuation and extra spaces ("Ice-cream!" ≈ "ice cream"). */
export function sameWords(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/[^\p{L}\p{N}']+/gu, ' ')
      .trim();
  return norm(a) === norm(b);
}

/** Hints are short English words/phrases only. Anything else is dropped. */
export function sanitizeHint(hint: string | null | undefined): string | null {
  if (!hint) return null;
  const h = hint.replace(/\s+/g, ' ').trim().slice(0, 100);
  if (!h || hasNonLatinLetters(h) || !hasLatinLetters(h)) return null;
  return h;
}

export function analyzeResult(rawText: string, hint: string | null): Analysis {
  const heard = tidyTranscript(stripNonSpeech(rawText ?? ''));
  if (!heard || !hasLatinLetters(heard)) return { status: 'unclear', transcript: null, heard: null, reason: 'empty' };
  if (hasNonLatinLetters(heard)) return { status: 'unclear', transcript: null, heard, reason: 'not_english' };
  const h = sanitizeHint(hint);
  if (h && !sameWords(heard, h)) return { status: 'unclear', transcript: null, heard, reason: 'mismatch' };
  return { status: 'done', transcript: heard, heard, reason: null };
}
