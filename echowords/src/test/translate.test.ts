import { describe, expect, it } from 'vitest';
import { parseTranslateRequest } from '../lib/translate';

const p = (q: string) => {
  const r = parseTranslateRequest(q);
  return r === null ? null : r.ok ? `${r.text} → ${r.target.code}` : `unknown:${r.name}`;
};

describe('parseTranslateRequest', () => {
  it('the «متن» را به «زبان» ترجمه کن format', () => {
    expect(p('«سلام دوست من» را به «انگلیسی» ترجمه کن')).toBe('سلام دوست من → en');
    expect(p('«I love my cat» رو به زبان «فارسی» ترجمه کن')).toBe('I love my cat → fa');
    expect(p('«گربه» را به «ژاپنی» ترجمه کن')).toBe('گربه → ja');
    expect(p('«گربه» را به «زبان کره‌ای» ترجمه کن')).toBe('گربه → ko');
    expect(p('«dog» «آلمانی»')).toBe('dog → de');
  });
  it('language named without «»', () => {
    expect(p('«سیب» را به چینی ترجمه کن')).toBe('سیب → zh-CN');
    expect(p('«سیب» را به زبان ترکی ترجمه کن')).toBe('سیب → tr');
    expect(p('translate «سیب» to english')).toBe('سیب → en');
  });
  it('a language it does not know', () => {
    expect(p('«سلام» را به «مریخی» ترجمه کن')).toBe('unknown:مریخی');
  });
  it('anything else is NOT a translation (normal conversation)', () => {
    expect(p('سلام خوبی؟')).toBeNull();
    expect(p('چرا آسمان آبی است؟')).toBeNull();
    expect(p('cat گربه')).toBeNull();
    expect(p('سیب به انگلیسی چی میشه')).toBeNull();
    expect(p('اسم کتابم «شازده کوچولو» است')).toBeNull();
  });
});

import gtxEn from './fixtures/gtx-en.json?raw';
import gtxJa from './fixtures/gtx-ja.json?raw';
import { afterEach, vi } from 'vitest';
import { findTargetLang, translateFree } from '../lib/translate';

describe('translateFree (real Google replies, recorded)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const reply = (file: string) =>
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      reply.urls.push(url);
      return new Response(file === 'gtx-en.json' ? gtxEn : gtxJa, { status: 200 });
    }));
  reply.urls = [] as string[];
  it('Persian → English, sentences joined', async () => {
    reply('gtx-en.json');
    const r = await translateFree('سلام دوست من. خوبی؟', findTargetLang('انگلیسی')!);
    expect(r.text).toMatch(/hello my friend/i);
    expect(r.text).toMatch(/how are you/i);
    expect(r.from).toBe('fa');
    expect(r.reading).toBe('');
    expect(reply.urls.at(-1)).toContain('tl=en');
  });
  it('Japanese gets its Latin reading', async () => {
    reply('gtx-ja.json');
    const r = await translateFree('گربه', findTargetLang('ژاپنی')!);
    expect(r.text).toMatch(/猫|ネコ|ねこ/);
    expect(r.reading.length).toBeGreaterThan(0);
    expect(reply.urls.at(-1)).toContain('dt=rm');
  });
});
