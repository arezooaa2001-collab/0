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

// ── Settings: which languages are switched on ──────────────────────────────
const KEY = 'echowords-langs';
const LAST = 'echowords-last-lang';

export function readEnabledLangs(): LangCode[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (Array.isArray(v)) {
      const list = v.filter(isLangCode);
      if (list.length) return ALL_LANGS.filter((l) => list.includes(l));
    }
  } catch {
    /* storage blocked */
  }
  return ['en'];
}

export function saveEnabledLangs(langs: LangCode[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(langs));
  } catch {
    /* ignore */
  }
}

export function readLastLang(enabled: LangCode[]): LangCode {
  try {
    const v = localStorage.getItem(LAST);
    if (isLangCode(v) && enabled.includes(v)) return v;
  } catch {
    /* ignore */
  }
  return enabled.includes('en') ? 'en' : enabled[0];
}

export function saveLastLang(l: LangCode): void {
  try {
    localStorage.setItem(LAST, l);
  } catch {
    /* ignore */
  }
}
