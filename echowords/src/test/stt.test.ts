import { describe, expect, it } from 'vitest';
import {
  analyzeResult,
  buildDeepgramUrl,
  hasNonLatinLetters,
  parseDeepgram,
  parseWhisperVerbose,
  sanitizeHint,
  tidyTranscript,
} from '../../supabase/functions/_shared/stt';

describe('tidyTranscript', () => {
  it('drops the auto full stop from a single word only', () => {
    expect(tidyTranscript(' Apple. ')).toBe('Apple');
    expect(tidyTranscript('Beautiful.')).toBe('Beautiful');
    expect(tidyTranscript('I am learning English.')).toBe('I am learning English.');
    expect(tidyTranscript("Don't   worry!")).toBe("Don't worry!");
  });
});

describe('analyzeResult', () => {
  it('accepts a confident English result', () => {
    const a = analyzeResult({ provider: 'deepgram', text: 'Apple.', confidence: 0.97 });
    expect(a).toMatchObject({ status: 'done', transcript: 'Apple', confidence: 0.97, reason: null });
  });

  it('never invents a confidence when the provider has none', () => {
    const a = analyzeResult({ provider: 'openai-whisper', text: 'I am learning English.', confidence: null });
    expect(a.status).toBe('done');
    expect(a.confidence).toBeNull();
  });

  it('refuses low-confidence results but keeps them only as a suggestion', () => {
    const a = analyzeResult({ provider: 'deepgram', text: 'banana', confidence: 0.31 });
    expect(a).toMatchObject({ status: 'unclear', transcript: null, heard: 'banana', reason: 'low_confidence' });
  });

  it('treats empty output as unclear', () => {
    expect(analyzeResult({ provider: 'deepgram', text: '', confidence: 0 })).toMatchObject({ status: 'unclear', reason: 'empty', heard: null });
    expect(analyzeResult({ provider: 'deepgram', text: ' ... ', confidence: 0.9 })).toMatchObject({ status: 'unclear', reason: 'empty' });
  });

  it('rejects non-English script', () => {
    expect(analyzeResult({ provider: 'x', text: 'سلام', confidence: 0.99 }).reason).toBe('empty');
    expect(analyzeResult({ provider: 'x', text: 'hello سلام', confidence: 0.99 })).toMatchObject({ status: 'unclear', reason: 'not_english' });
    expect(analyzeResult({ provider: 'x', text: 'Привет friend', confidence: 0.99 }).reason).toBe('not_english');
  });

  it('uses Whisper no-speech and logprob signals', () => {
    expect(analyzeResult({ provider: 'w', text: 'you', confidence: null, noSpeechProbability: 0.9 }).reason).toBe('no_speech');
    expect(analyzeResult({ provider: 'w', text: 'thank you', confidence: null, avgLogProb: -1.6 }).reason).toBe('low_confidence');
  });

  it('keeps accented Latin words', () => {
    expect(analyzeResult({ provider: 'x', text: 'Café', confidence: 0.9 }).status).toBe('done');
    expect(hasNonLatinLetters('naïve résumé')).toBe(false);
  });
});

describe('providers', () => {
  it('forces English and maps accents', () => {
    expect(buildDeepgramUrl({ accent: 'us' })).toContain('language=en-US');
    expect(buildDeepgramUrl({ accent: 'uk' })).toContain('language=en-GB');
    const auto = new URL(buildDeepgramUrl({ accent: 'auto', hint: 'apple' }));
    expect(auto.searchParams.get('language')).toBe('en');
    expect(auto.searchParams.get('keyterm')).toBe('apple');
    expect(auto.searchParams.get('detect_language')).toBeNull();
    expect(new URL(buildDeepgramUrl({ accent: 'us', hint: 'apple', model: 'nova-2' })).searchParams.get('keywords')).toBe('apple:2');
  });

  it('drops non-English hints', () => {
    expect(sanitizeHint('سیب')).toBeNull();
    expect(sanitizeHint('  ice   cream ')).toBe('ice cream');
  });

  it('parses Deepgram responses', () => {
    const r = parseDeepgram({ results: { channels: [{ alternatives: [{ transcript: 'Beautiful.', confidence: 0.93 }] }] } });
    expect(r).toEqual({ provider: 'deepgram', text: 'Beautiful.', confidence: 0.93 });
    expect(parseDeepgram({})).toEqual({ provider: 'deepgram', text: '', confidence: null });
  });

  it('parses Whisper verbose responses without inventing confidence', () => {
    const r = parseWhisperVerbose({ text: ' Apple.', segments: [{ no_speech_prob: 0.01, avg_logprob: -0.2 }] });
    expect(r.confidence).toBeNull();
    expect(r.noSpeechProbability).toBe(0.01);
    expect(r.avgLogProb).toBeCloseTo(-0.2);
  });
});
