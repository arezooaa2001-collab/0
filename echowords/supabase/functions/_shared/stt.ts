// Pure, dependency-free speech-to-text logic shared by the Edge Function and the unit tests.
// No Deno or browser APIs are used here, so it runs in both runtimes.

export type Accent = 'auto' | 'us' | 'uk';

export type SttStatus = 'done' | 'unclear';

export type UnclearReason = 'empty' | 'not_english' | 'low_confidence' | 'no_speech';

export interface ProviderResult {
  provider: string;
  /** Raw text exactly as the provider returned it. */
  text: string;
  /** 0..1 confidence ONLY if the provider actually returned one; otherwise null. */
  confidence: number | null;
  /** Provider-specific uncertainty signals that are not a confidence score (e.g. Whisper no_speech_prob). */
  noSpeechProbability?: number | null;
  avgLogProb?: number | null;
}

export interface Analysis {
  status: SttStatus;
  /** Cleaned English text the app may save as the word. Null when unclear. */
  transcript: string | null;
  /** What the provider heard (cleaned), offered to the learner as a suggestion only. */
  heard: string | null;
  confidence: number | null;
  reason: UnclearReason | null;
}

/** Below this provider confidence we refuse to auto-save a transcript. */
export const MIN_CONFIDENCE = 0.6;
/** Whisper: segment is probably silence/noise above this. */
export const MAX_NO_SPEECH_PROB = 0.6;
/** Whisper: average token log-probability below this is very uncertain. */
export const MIN_AVG_LOGPROB = -1.0;

/** True if the text contains any letter that is not from the Latin alphabet (e.g. Persian, Arabic, Cyrillic). */
export function hasNonLatinLetters(text: string): boolean {
  return /(?![\p{Script=Latin}])\p{L}/u.test(text);
}

/** True if the text contains at least one Latin letter. */
export function hasLatinLetters(text: string): boolean {
  return /\p{Script=Latin}/u.test(text);
}

/**
 * Light, non-inventive clean-up of provider output:
 * trims whitespace, collapses runs of spaces, and drops the trailing full stop that
 * auto-punctuation adds to a single word ("Apple." → "Apple"). Sentences keep their punctuation.
 */
export function tidyTranscript(raw: string): string {
  let t = raw.replace(/\s+/g, ' ').trim();
  const isSingleWord = !/\s/.test(t);
  if (isSingleWord) t = t.replace(/\.+$/, '');
  return t;
}

/** Decide whether the provider result is trustworthy enough to save as the learner's word. */
export function analyzeResult(r: ProviderResult): Analysis {
  const heard = tidyTranscript(r.text ?? '');
  const confidence = typeof r.confidence === 'number' && Number.isFinite(r.confidence) ? clamp01(r.confidence) : null;
  const base = { heard: heard || null, confidence };

  if (!heard || !hasLatinLetters(heard)) {
    return { ...base, heard: null, status: 'unclear', transcript: null, reason: 'empty' };
  }
  if (hasNonLatinLetters(heard)) {
    return { ...base, status: 'unclear', transcript: null, reason: 'not_english' };
  }
  if (typeof r.noSpeechProbability === 'number' && r.noSpeechProbability > MAX_NO_SPEECH_PROB) {
    return { ...base, status: 'unclear', transcript: null, reason: 'no_speech' };
  }
  if (typeof r.avgLogProb === 'number' && r.avgLogProb < MIN_AVG_LOGPROB) {
    return { ...base, status: 'unclear', transcript: null, reason: 'low_confidence' };
  }
  if (confidence !== null && confidence < MIN_CONFIDENCE) {
    return { ...base, status: 'unclear', transcript: null, reason: 'low_confidence' };
  }
  return { ...base, status: 'done', transcript: heard, reason: null };
}

/** Deepgram language code for the selected English accent. */
export function deepgramLanguage(accent: Accent): string {
  return accent === 'us' ? 'en-US' : accent === 'uk' ? 'en-GB' : 'en';
}

/** Build the Deepgram pre-recorded transcription URL. English only, always. */
export function buildDeepgramUrl(opts: { accent: Accent; hint?: string | null; model?: string; baseUrl?: string }): string {
  const model = opts.model || 'nova-3';
  const p = new URLSearchParams({
    model,
    language: deepgramLanguage(opts.accent),
    smart_format: 'true',
    punctuate: 'true',
  });
  const hint = sanitizeHint(opts.hint);
  if (hint) {
    // Nova-3 uses "keyterm" prompting; older models use "keywords" boosting.
    if (model.startsWith('nova-3')) p.append('keyterm', hint);
    else p.append('keywords', `${hint}:2`);
  }
  const base = (opts.baseUrl || 'https://api.deepgram.com').replace(/\/+$/, '');
  return `${base}/v1/listen?${p.toString()}`;
}

/** Parse a Deepgram /v1/listen JSON response. */
export function parseDeepgram(json: unknown): ProviderResult {
  // deno-lint-ignore no-explicit-any
  const alt = (json as any)?.results?.channels?.[0]?.alternatives?.[0];
  const text = typeof alt?.transcript === 'string' ? alt.transcript : '';
  const confidence = typeof alt?.confidence === 'number' ? alt.confidence : null;
  return { provider: 'deepgram', text, confidence };
}

/** Parse an OpenAI Whisper verbose_json response (no confidence score is invented). */
export function parseWhisperVerbose(json: unknown): ProviderResult {
  // deno-lint-ignore no-explicit-any
  const j = json as any;
  const text = typeof j?.text === 'string' ? j.text : '';
  const segs: Array<{ no_speech_prob?: number; avg_logprob?: number }> = Array.isArray(j?.segments) ? j.segments : [];
  let noSpeech: number | null = null;
  let avgLog: number | null = null;
  if (segs.length) {
    noSpeech = Math.min(...segs.map((s) => (typeof s.no_speech_prob === 'number' ? s.no_speech_prob : 0)));
    const logs = segs.map((s) => s.avg_logprob).filter((v): v is number => typeof v === 'number');
    avgLog = logs.length ? logs.reduce((a, b) => a + b, 0) / logs.length : null;
  }
  return { provider: 'openai-whisper', text, confidence: null, noSpeechProbability: noSpeech, avgLogProb: avgLog };
}

/** Hints are short English words/phrases only. Anything else is dropped. */
export function sanitizeHint(hint: string | null | undefined): string | null {
  if (!hint) return null;
  const h = hint.replace(/\s+/g, ' ').trim().slice(0, 100);
  if (!h || hasNonLatinLetters(h) || !hasLatinLetters(h)) return null;
  return h;
}

/** File extension → MIME type that providers understand, using the stored MIME first. */
export function providerContentType(mime: string): string {
  return (mime || 'application/octet-stream').split(';')[0].trim();
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
