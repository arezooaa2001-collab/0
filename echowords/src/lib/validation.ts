import { t } from './strings';

export const MAX_TEXT = 200;

/**
 * Validate English text typed by the learner (manual correction or hint).
 * Allowed: Latin letters (incl. accents such as café), digits, spaces, and common punctuation.
 */
export function validateEnglish(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.replace(/\s+/g, ' ').trim();
  if (!value) return { ok: false, error: t.emptyText };
  if (value.length > MAX_TEXT) return { ok: false, error: t.tooLong };
  if (!/\p{Script=Latin}/u.test(value)) return { ok: false, error: t.onlyEnglish };
  if (!/^[\p{Script=Latin}\p{N}\s'’‘".,!?;:()\-–—&/]+$/u.test(value)) return { ok: false, error: t.onlyEnglish };
  return { ok: true, value };
}

/** Optional hint: empty is fine, otherwise must be valid English. */
export function validateHint(raw: string): { ok: true; value: string | null } | { ok: false; error: string } {
  if (!raw.trim()) return { ok: true, value: null };
  const r = validateEnglish(raw);
  return r.ok ? { ok: true, value: r.value.slice(0, 100) } : r;
}
