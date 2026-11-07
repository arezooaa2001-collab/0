import { LANGS, type LangCode, isInLang } from './langs';
import { t } from './strings';

export const MAX_TEXT = 200;

type Result = { ok: true; value: string } | { ok: false; error: string };

/**
 * Validate a word/sentence typed by the learner for one language.
 * Letters must belong to that language's script; digits, spaces, punctuation and
 * combining marks (e.g. Hindi vowel signs, Persian diacritics) are allowed.
 */
export function validateText(raw: string, lang: LangCode): Result {
  const value = raw.replace(/\s+/g, ' ').trim();
  if (!value) return { ok: false, error: t.emptyText };
  if (value.length > MAX_TEXT) return { ok: false, error: t.tooLong };
  const wrong = t.wrongScript(LANGS[lang].name);
  if (!isInLang(value, lang)) return { ok: false, error: wrong };
  for (const ch of value) {
    if (/\p{L}/u.test(ch)) continue; // already checked by isInLang
    if (!/[\p{M}\p{N}\p{P}\s‌‍&/+=~^`$%@#]/u.test(ch)) return { ok: false, error: wrong };
  }
  return { ok: true, value };
}

/** English only (kept for older callers). */
export function validateEnglish(raw: string): Result {
  return validateText(raw, 'en');
}
