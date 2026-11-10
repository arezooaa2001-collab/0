// Languages a learner can save words in. The app's own menus are always Persian.

export type LangCode = 'en' | 'fa' | 'fr' | 'zh' | 'ja' | 'hi';

export interface LangInfo {
  code: LangCode;
  /** Name in Persian (shown in the menus). */
  name: string;
  flag: string;
  dir: 'ltr' | 'rtl';
  /** BCP-47 tag for the device's speech voice. */
  tts: string;
  /** Language name Whisper understands. */
  whisper: string;
  /** Letters allowed in a word of this language. */
  letter: RegExp;
}

export const LANGS: Record<LangCode, LangInfo> = {
  en: { code: 'en', name: 'انگلیسی', flag: '🇬🇧', dir: 'ltr', tts: 'en-US', whisper: 'english', letter: /\p{Script=Latin}/u },
  fa: { code: 'fa', name: 'فارسی', flag: '🇮🇷', dir: 'rtl', tts: 'fa-IR', whisper: 'persian', letter: /\p{Script=Arabic}/u },
  fr: { code: 'fr', name: 'فرانسوی', flag: '🇫🇷', dir: 'ltr', tts: 'fr-FR', whisper: 'french', letter: /\p{Script=Latin}/u },
  zh: { code: 'zh', name: 'چینی', flag: '🇨🇳', dir: 'ltr', tts: 'zh-CN', whisper: 'chinese', letter: /[\p{Script=Han}\p{Script=Common}]/u },
  ja: { code: 'ja', name: 'ژاپنی', flag: '🇯🇵', dir: 'ltr', tts: 'ja-JP', whisper: 'japanese', letter: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Common}]/u },
  hi: { code: 'hi', name: 'هندی', flag: '🇮🇳', dir: 'ltr', tts: 'hi-IN', whisper: 'hindi', letter: /\p{Script=Devanagari}/u },
};

export const ALL_LANGS: LangCode[] = ['fa', 'en', 'fr', 'zh', 'ja', 'hi'];

export const isLangCode = (v: unknown): v is LangCode => typeof v === 'string' && v in LANGS;

/** Words saved before languages existed are English. */
export const langOf = (w: { lang?: LangCode | null }): LangCode => (w.lang && isLangCode(w.lang) ? w.lang : 'en');

/** True if every letter belongs to the language's script (and there is at least one letter). */
export function isInLang(text: string, lang: LangCode): boolean {
  const letters = text.match(/\p{L}/gu);
  if (!letters?.length) return false;
  const re = LANGS[lang].letter;
  const own = letters.filter((ch) => re.test(ch));
  // Han/Common alone is not enough for Japanese vs Chinese, but script-wise both are fine.
  return own.length === letters.length && letters.some((ch) => !/\p{Script=Common}/u.test(ch));
}

/**
 * Guess which of the enabled languages a typed text is in.
 * Returns `current` when it fits (e.g. English vs French both use Latin letters).
 */
export function guessLang(text: string, enabled: LangCode[], current: LangCode): LangCode {
  if (!/\p{L}/u.test(text) || isInLang(text, current)) return current;
  if (enabled.includes('ja') && /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return 'ja';
  return enabled.find((l) => isInLang(text, l)) ?? current;
}

// ── Mixed text: every language at once, no settings needed ─────────────────

/** Language of a single letter (Latin → English; Han → Japanese if the text has kana, else Chinese). */
export function letterLang(ch: string, hasKana: boolean): LangCode | null {
  if (!/\p{L}/u.test(ch)) return null;
  if (/\p{Script=Latin}/u.test(ch)) return 'en';
  if (/\p{Script=Arabic}/u.test(ch)) return 'fa';
  if (/\p{Script=Devanagari}/u.test(ch)) return 'hi';
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(ch)) return 'ja';
  if (/\p{Script=Han}/u.test(ch)) return hasKana ? 'ja' : 'zh';
  return null; // other scripts / symbols: keep with the surrounding text
}

export interface Segment {
  text: string;
  lang: LangCode;
}

/**
 * Split text into runs of one language, e.g. "cat گربه" → [{cat,en},{گربه,fa}].
 * Spaces, digits and punctuation stay with the run they are in.
 * `latinAs` lets a word marked French read its Latin parts in French.
 */
export function segmentByLang(text: string, latinAs: LangCode = 'en'): Segment[] {
  // Chinese characters are also used in Japanese: a text known to be Japanese reads them as Japanese.
  const hasKana = latinAs === 'ja' || /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text);
  const out: Segment[] = [];
  let cur: Segment | null = null;
  let pending = '';
  for (const ch of text) {
    let l = letterLang(ch, hasKana);
    if (l === 'en' && latinAs === 'fr') l = 'fr';
    if (!l) {
      pending += ch;
      continue;
    }
    if (cur && cur.lang === l) {
      cur.text += pending + ch;
    } else {
      if (cur) {
        // punctuation right after a word ("cat,") stays with that word
        const tail: string = /^\S*/.exec(pending)?.[0] ?? '';
        cur.text += tail;
        pending = pending.slice(tail.length);
      }
      cur = { text: pending.trimStart() + ch, lang: l };
      out.push(cur);
    }
    pending = '';
  }
  if (cur) cur.text += pending;
  return out.map((s) => ({ ...s, text: s.text.trim() })).filter((s) => s.text);
}

/** Languages present in a text, most letters first. */
export function langsIn(text: string): LangCode[] {
  const count = new Map<LangCode, number>();
  for (const seg of segmentByLang(text)) count.set(seg.lang, (count.get(seg.lang) ?? 0) + [...seg.text].filter((c) => /\p{L}/u.test(c)).length);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
}

/** Main language of a text (the one with the most letters). */
export function primaryLang(text: string): LangCode {
  return langsIn(text)[0] ?? 'en';
}
