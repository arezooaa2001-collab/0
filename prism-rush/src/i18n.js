// Localisation: 23 languages, RTL handling, number formatting.
import en from './strings/en.js';
import { PACKS } from './strings/index.js';

export const LANGS = [
  { code: 'en', name: 'English (US)', locale: 'en-US' },
  { code: 'en-GB', name: 'English (UK)', locale: 'en-GB' },
  { code: 'fa', name: 'فارسی', locale: 'fa-IR', rtl: true },
  { code: 'ar', name: 'العربية', locale: 'ar', rtl: true },
  { code: 'tr', name: 'Türkçe', locale: 'tr-TR' },
  { code: 'az', name: 'Azərbaycanca', locale: 'az-Latn-AZ' },
  { code: 'ur', name: 'اردو', locale: 'ur-PK', rtl: true },
  { code: 'hi', name: 'हिन्दी', locale: 'hi-IN' },
  { code: 'de', name: 'Deutsch', locale: 'de-DE' },
  { code: 'fr', name: 'Français', locale: 'fr-FR' },
  { code: 'es', name: 'Español', locale: 'es-ES' },
  { code: 'it', name: 'Italiano', locale: 'it-IT' },
  { code: 'pt', name: 'Português (Brasil)', locale: 'pt-BR' },
  { code: 'ru', name: 'Русский', locale: 'ru-RU' },
  { code: 'uk', name: 'Українська', locale: 'uk-UA' },
  { code: 'pl', name: 'Polski', locale: 'pl-PL' },
  { code: 'nl', name: 'Nederlands', locale: 'nl-NL' },
  { code: 'sv', name: 'Svenska', locale: 'sv-SE' },
  { code: 'zh', name: '简体中文', locale: 'zh-CN' },
  { code: 'ja', name: '日本語', locale: 'ja-JP' },
  { code: 'ko', name: '한국어', locale: 'ko-KR' },
  { code: 'id', name: 'Bahasa Indonesia', locale: 'id-ID' },
  { code: 'vi', name: 'Tiếng Việt', locale: 'vi-VN' },
];

let cur = LANGS[0];
let dict = en;
let nf = new Intl.NumberFormat('en-US');
const listeners = new Set();

export function langInfo() { return cur; }
export function isRTL() { return !!cur.rtl; }
export function onLang(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function setLang(code) {
  cur = LANGS.find((l) => l.code === code) || LANGS[0];
  // en-GB inherits en and overrides spelling; other packs fall back to en per key
  dict = cur.code === 'en' ? en : Object.assign({}, en, PACKS[cur.code] || {});
  try { nf = new Intl.NumberFormat(cur.locale); } catch { nf = new Intl.NumberFormat('en-US'); }
  const html = document.documentElement;
  html.lang = cur.code;
  html.dir = cur.rtl ? 'rtl' : 'ltr';
  html.classList.toggle('rtl', !!cur.rtl);
  html.dataset.script = /^(fa|ar|ur)$/.test(cur.code) ? 'arabic' : /^(zh|ja|ko)$/.test(cur.code) ? 'cjk' : /^hi$/.test(cur.code) ? 'deva' : 'latin';
  listeners.forEach((fn) => { try { fn(cur); } catch (e) { console.error(e); } });
}

export function t(key, params) {
  let s = dict[key];
  if (s === undefined) s = en[key];
  if (s === undefined) return key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? (typeof params[k] === 'number' ? num(params[k]) : params[k]) : m));
  return s;
}
export function has(key) { return dict[key] !== undefined || en[key] !== undefined; }

export function num(v, digits) {
  if (digits !== undefined) {
    try { return new Intl.NumberFormat(cur.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v); } catch { return v.toFixed(digits); }
  }
  return nf.format(Math.round(v));
}
// localise digits inside an already formatted string such as 1:02.33
export function digits(str) {
  const sample = nf.format(0);
  if (sample === '0') return str;
  const base = sample.charCodeAt(0) - 48;
  return String(str).replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) + base));
}
export function coverage(code) {
  const p = PACKS[code]; if (!p) return code === 'en' || code === 'en-GB' ? 1 : 0;
  const keys = Object.keys(en); let n = 0; for (const k of keys) if (p[k] !== undefined) n++;
  return n / keys.length;
}
