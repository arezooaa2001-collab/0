import { describe, expect, it } from 'vitest';
import { analyzeResult, hasNonLatinLetters, sameWords, sanitizeHint, stripNonSpeech, tidyTranscript } from '../lib/stt';

describe('tidyTranscript', () => {
  it('drops the auto full stop from a single word only', () => {
    expect(tidyTranscript(' Apple. ')).toBe('Apple');
    expect(tidyTranscript('I am learning English.')).toBe('I am learning English.');
    expect(tidyTranscript("Don't   worry!")).toBe("Don't worry!");
  });
});

describe('analyzeResult', () => {
  it('accepts English when there is no hint', () => {
    expect(analyzeResult(' Beautiful.', null)).toMatchObject({ status: 'done', transcript: 'Beautiful', reason: null });
  });
  it('accepts English that matches the hint (case/punctuation ignored)', () => {
    expect(analyzeResult(' Apple.', 'apple')).toMatchObject({ status: 'done', transcript: 'Apple' });
    expect(analyzeResult('Ice-cream!', 'ice cream').status).toBe('done');
  });
  it('asks instead of guessing when the result differs from the hint', () => {
    expect(analyzeResult(' Thank you.', 'apple')).toMatchObject({ status: 'unclear', transcript: null, heard: 'Thank you.', reason: 'mismatch' });
  });
  it('treats Whisper non-speech markers as empty', () => {
    expect(analyzeResult(' [BLANK_AUDIO]', null)).toMatchObject({ status: 'unclear', reason: 'empty', heard: null });
    expect(analyzeResult('(upbeat music) ♪', null).reason).toBe('empty');
    expect(stripNonSpeech('*laughs* hello').trim()).toBe('hello');
  });
  it('accepts every script', () => {
    expect(analyzeResult('سلام', null).status).toBe('done');
    expect(analyzeResult('hello سلام', null).status).toBe('done');
  });
  it('keeps accented Latin words', () => {
    expect(analyzeResult('Café', null).status).toBe('done');
    expect(hasNonLatinLetters('naïve résumé')).toBe(false);
  });
});

describe('other languages', () => {
  it('accepts results in the word\'s language and rejects other scripts', () => {
    expect(analyzeResult(' گربه.', null, 'fa')).toMatchObject({ status: 'done', transcript: 'گربه' });
    expect(analyzeResult('cat گربه', null)).toMatchObject({ status: 'done', transcript: 'cat گربه' }); // mixed is fine
    expect(analyzeResult('猫。', null, 'zh')).toMatchObject({ status: 'done', transcript: '猫' });
    expect(analyzeResult('Bonjour', 'bonjour', 'fr').status).toBe('done');
  });
});

describe('helpers', () => {
  it('compares words loosely', () => {
    expect(sameWords("Don’t", "don't")).toBe(true);
    expect(sameWords('apple', 'apples')).toBe(false);
  });
  it('drops non-English hints', () => {
    expect(sanitizeHint('سیب')).toBeNull();
    expect(sanitizeHint('  ice   cream ')).toBe('ice cream');
  });
});
