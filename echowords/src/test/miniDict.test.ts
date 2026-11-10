import { describe, expect, it } from 'vitest';
import { dictionaryAnswer } from '../lib/miniDict';

const pairs = (q: string) => dictionaryAnswer(q)?.items.map((i) => `${i.text}=${i.meaning}`) ?? null;

describe('dictionaryAnswer (tutor fallback without AI)', () => {
  it('Persian → English', () => {
    expect(pairs('«سیب» به انگلیسی چی میشه؟')).toEqual(['apple=سیب']);
    expect(pairs('گربه به انگلیسی چی میشه')).toEqual(['cat=گربه']);
    expect(pairs('شیر به انگلیسی')).toEqual(['milk=شیر']);
    expect(pairs('سیب زمینی یعنی چی')).toEqual(['potato=سیب‌زمینی']);
  });
  it('English → Persian, plurals and phrases', () => {
    expect(pairs('cat یعنی چی؟')).toEqual(['cat=گربه']);
    expect(pairs('What is apples in Persian?')).toEqual(['apple=سیب']);
    expect(pairs('good morning')).toEqual(['good morning=صبح بخیر']);
    expect(pairs('ice cream به فارسی')).toEqual(['ice cream=بستنی']);
  });
  it('unknown words → null (the real error is shown instead)', () => {
    expect(dictionaryAnswer('یک داستان بگو')).toBeNull();
    expect(dictionaryAnswer('xylophonic')).toBeNull();
    expect(dictionaryAnswer('یک کلمه تازه انگلیسی یادم بده')).toBeNull();
  });
});
