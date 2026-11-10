// Translation with no API key: «متن» را به «زبان» ترجمه کن.
// Uses Google Translate's free public endpoint (no account, no key). In the Android app the
// request is sent by Android itself; elsewhere by fetch (the endpoint allows cross-site calls).
import type { LangCode } from './langs';
import { nativeHasHttp, nativeHttp } from './native';

export interface TargetLang {
  /** Google Translate code. */
  code: string;
  /** Persian name. */
  name: string;
  /** BCP-47 tag for the device's voice. */
  tag: string;
  /** The app's own language code, when it is one of them. */
  app: LangCode | null;
  /** Show the Latin-letter reading (for scripts a Persian child cannot read). */
  romanize: boolean;
}

const T = (code: string, name: string, tag: string, app: LangCode | null, romanize: boolean, aliases: string[]): [TargetLang, string[]] => [
  { code, name, tag, app, romanize },
  [name, ...aliases],
];

const TABLE: [TargetLang, string[]][] = [
  T('en', 'انگلیسی', 'en-US', 'en', false, ['انگلیسى', 'english', 'en']),
  T('fa', 'فارسی', 'fa-IR', 'fa', false, ['پارسی', 'persian', 'farsi', 'fa']),
  T('fr', 'فرانسوی', 'fr-FR', 'fr', false, ['فرانسه', 'فرانسوى', 'french', 'fr']),
  T('zh-CN', 'چینی', 'zh-CN', 'zh', true, ['چینى', 'chinese', 'zh']),
  T('ja', 'ژاپنی', 'ja-JP', 'ja', true, ['ژاپنى', 'japanese', 'ja']),
  T('hi', 'هندی', 'hi-IN', 'hi', true, ['هندى', 'hindi', 'hi']),
  T('ar', 'عربی', 'ar-SA', null, false, ['عربى', 'arabic', 'ar']),
  T('de', 'آلمانی', 'de-DE', null, false, ['المانی', 'german', 'de']),
  T('es', 'اسپانیایی', 'es-ES', null, false, ['اسپانیولی', 'اسپانیائی', 'spanish', 'es']),
  T('it', 'ایتالیایی', 'it-IT', null, false, ['ایتالیائی', 'italian', 'it']),
  T('tr', 'ترکی', 'tr-TR', null, false, ['ترکی استانبولی', 'turkish', 'tr']),
  T('ru', 'روسی', 'ru-RU', null, true, ['russian', 'ru']),
  T('ko', 'کره‌ای', 'ko-KR', null, true, ['کره ای', 'کره اى', 'کره‌اى', 'korean', 'ko']),
  T('pt', 'پرتغالی', 'pt-PT', null, false, ['پرتقالی', 'portuguese', 'pt']),
  T('ur', 'اردو', 'ur-PK', null, false, ['urdu', 'ur']),
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/‌/g, ' ')
    .replace(/^(زبان|به زبان)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

const BY_NAME = new Map<string, TargetLang>();
for (const [lang, names] of TABLE) for (const n of names) BY_NAME.set(norm(n), lang);

export function findTargetLang(name: string): TargetLang | null {
  return BY_NAME.get(norm(name)) ?? null;
}

/** The languages a child can ask for (Persian names), for help messages. */
export const TARGET_NAMES = TABLE.map(([l]) => l.name);

export type TranslateRequest = { ok: true; text: string; target: TargetLang } | { ok: false; reason: 'unknown_lang'; name: string };

/**
 * Is this message a translation request?
 *   سلام دوست من / انگلیسی                  (the main, simplest form)
 *   «سلام دوست من» را به «انگلیسی» ترجمه کن
 *   «I love cats» رو به زبان «فارسی» ترجمه کن
 *   «گربه» را به ژاپنی ترجمه کن            (language without «» also understood)
 * Anything else is NOT translated: it goes to the tutor as a normal message.
 */
export function parseTranslateRequest(message: string): TranslateRequest | null {
  // Main form: «متن / زبان», e.g. «سلام دوست من / انگلیسی» (the last «/» separates them).
  const msg = message.trim();
  const cut = msg.lastIndexOf('/');
  if (cut > 0) {
    const text = msg.slice(0, cut).replace(/[«»]/g, '').trim();
    const name = msg.slice(cut + 1).replace(/[«»]/g, '').trim();
    if (text && name) {
      const target = findTargetLang(name);
      if (target) return { ok: true, text, target };
      // Looks like a language name (one or two words, no digits or question): say we do not know it.
      if (/^[^\d?؟.!,،]{2,30}$/u.test(name) && name.split(/\s+/).length <= 2 && !/^(prompt|abc)\b/i.test(name))
        return { ok: false, reason: 'unknown_lang', name };
    }
  }
  const groups = [...message.matchAll(/«([^»]+)»/g)].map((m) => m[1].trim()).filter(Boolean);
  if (!groups.length) return null;
  const outside = norm(message.replace(/«[^»]*»/g, ' '));
  const asksTranslate = /ترجمه|برگردان|translate/.test(outside);
  if (groups.length >= 2) {
    const last = groups[groups.length - 1];
    const target = findTargetLang(last);
    const text = groups.slice(0, -1).join(' ');
    if (target) return { ok: true, text, target };
    if (asksTranslate) return { ok: false, reason: 'unknown_lang', name: last };
    return null;
  }
  if (!asksTranslate) return null;
  // One «…» group: the language is named after «به».
  const m = /به\s+(?:زبان\s+)?([^\s]+(?:\s+[^\s]+)?)/.exec(outside);
  if (m) {
    const two = findTargetLang(m[1]);
    const one = findTargetLang(m[1].split(' ')[0]);
    const target = two ?? one;
    if (target) return { ok: true, text: groups[0], target };
    return { ok: false, reason: 'unknown_lang', name: m[1].split(' ')[0] };
  }
  const en = /\bto\s+([a-z]+)/.exec(outside);
  const target = en ? findTargetLang(en[1]) : null;
  return target ? { ok: true, text: groups[0], target } : null;
}

export class TranslateError extends Error {
  constructor(
    public code: 'network' | 'timeout' | 'bad_reply',
    message: string,
  ) {
    super(message);
  }
}

const timeoutMs = (): number => (globalThis as { __ECHOWORDS_TR_TIMEOUT__?: number }).__ECHOWORDS_TR_TIMEOUT__ ?? 12_000;

async function get(url: string, signal?: AbortSignal): Promise<string> {
  if (nativeHasHttp()) {
    const r = await nativeHttp('GET', url, {}, null, timeoutMs(), signal);
    if (!r.ok) throw new TranslateError(r.error === 'timeout' ? 'timeout' : 'network', `${r.error} ${r.detail ?? ''}`.trim());
    if (r.status !== 200) throw new TranslateError('bad_reply', `HTTP ${r.status}`);
    return r.body;
  }
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs());
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (res.status !== 200) throw new TranslateError('bad_reply', `HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    if (e instanceof TranslateError) throw e;
    if (signal?.aborted) throw new DOMException('cancelled', 'AbortError');
    throw new TranslateError(timedOut ? 'timeout' : 'network', String((e as Error)?.message ?? e));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export interface Translation {
  text: string;
  /** Latin-letter reading (Japanese, Chinese, Hindi, Russian, Korean), or ''. */
  reading: string;
  /** Detected language of the original (Google code). */
  from: string;
}

export async function translateFree(text: string, target: TargetLang, signal?: AbortSignal): Promise<Translation> {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto' +
    `&tl=${encodeURIComponent(target.code)}&dt=t${target.romanize ? '&dt=rm' : ''}&q=${encodeURIComponent(text.slice(0, 2000))}`;
  const body = await get(url, signal);
  try {
    const j = JSON.parse(body) as [unknown[][], unknown, string];
    let out = '';
    let reading = '';
    for (const seg of j[0] ?? []) {
      if (typeof seg?.[0] === 'string') out += seg[0];
      else if (seg?.[0] == null && typeof seg?.[2] === 'string') reading = seg[2];
    }
    out = out.trim();
    if (!out) throw new Error('empty');
    return { text: out, reading: target.romanize ? reading.trim() : '', from: typeof j[2] === 'string' ? j[2] : '' };
  } catch {
    throw new TranslateError('bad_reply', body.slice(0, 120));
  }
}
