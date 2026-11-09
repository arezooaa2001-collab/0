import { t } from './strings';

export const MAX_TEXT = 200;

type Result = { ok: true; value: string } | { ok: false; error: string };

/**
 * Validate a word/sentence typed by the learner. Any language, and several languages
 * mixed together (e.g. "cat گربه"), are welcome. It just needs at least one letter.
 */
export function validateText(raw: string): Result {
  const value = raw.replace(/\s+/g, ' ').trim();
  if (!value) return { ok: false, error: t.emptyText };
  if (value.length > MAX_TEXT) return { ok: false, error: t.tooLong };
  if (!/\p{L}/u.test(value)) return { ok: false, error: t.needLetters };
  if (/[\p{Cc}]/u.test(value)) return { ok: false, error: t.needLetters };
  return { ok: true, value };
}
