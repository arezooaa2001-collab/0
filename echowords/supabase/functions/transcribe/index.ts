// Supabase Edge Function: transcribe one saved recording into ENGLISH text.
//
// Security model
// - Runs with the caller's own JWT. Every database and storage call goes through
//   Row Level Security, so a user can only ever transcribe their own recordings.
// - The speech-to-text API key lives only in this function's secrets.
//
// Audio preservation
// - The original recording is downloaded read-only and sent to the provider as-is.
//   Nothing is converted, re-encoded, or written back to storage.

import { UserScopedSupabase } from '../_shared/supabaseRest.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import {
  type Accent,
  type ProviderResult,
  UUID_RE,
  analyzeResult,
  buildDeepgramUrl,
  parseDeepgram,
  parseWhisperVerbose,
  providerContentType,
  sanitizeHint,
} from '../_shared/stt.ts';

const PROVIDER_TIMEOUT_MS = 45_000;

class ProviderError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fn(ctrl.signal);
  } catch (e) {
    if (ctrl.signal.aborted) throw new ProviderError('timeout', 'Speech-to-text provider timed out.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function transcribeDeepgram(audio: Blob, mime: string, accent: Accent, hint: string | null): Promise<ProviderResult> {
  const key = Deno.env.get('DEEPGRAM_API_KEY');
  if (!key) throw new ProviderError('not_configured', 'DEEPGRAM_API_KEY is not set.');
  const url = buildDeepgramUrl({
    accent,
    hint,
    model: Deno.env.get('DEEPGRAM_MODEL') ?? undefined,
    // e.g. https://api.eu.deepgram.com for EU data residency
    baseUrl: Deno.env.get('DEEPGRAM_API_BASE') ?? undefined,
  });
  const res = await withTimeout((signal) =>
    fetch(url, {
      method: 'POST',
      headers: { Authorization: `Token ${key}`, 'Content-Type': providerContentType(mime) },
      body: audio,
      signal,
    }),
  );
  if (!res.ok) throw new ProviderError('provider_error', `Deepgram HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return parseDeepgram(await res.json());
}

async function transcribeOpenAI(audio: Blob, mime: string, hint: string | null): Promise<ProviderResult> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new ProviderError('not_configured', 'OPENAI_API_KEY is not set.');
  const ext = mime.includes('mp4') || mime.includes('aac') ? 'm4a' : mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : 'webm';
  const form = new FormData();
  form.append('file', new File([audio], `recording.${ext}`, { type: providerContentType(mime) }));
  form.append('model', 'whisper-1');
  form.append('language', 'en'); // English only — never auto-detect other languages.
  form.append('response_format', 'verbose_json');
  form.append('temperature', '0');
  if (hint) form.append('prompt', hint);
  const res = await withTimeout((signal) =>
    fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal,
    }),
  );
  if (!res.ok) throw new ProviderError('provider_error', `OpenAI HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return parseWhisperVerbose(await res.json());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const db = new UserScopedSupabase(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, authHeader);
  if (!(await db.getUserId().catch(() => null))) return json({ error: 'unauthorized' }, 401);

  let wordId = '';
  try {
    wordId = String((await req.json())?.wordId ?? '');
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!UUID_RE.test(wordId)) return json({ error: 'bad_request' }, 400);

  type WordRow = { id: string; audio_path: string; audio_mime: string; accent: string; hint: string | null; transcript_edited: boolean };
  let word: WordRow | null;
  try {
    word = await db.selectWord<WordRow>(wordId, 'id,audio_path,audio_mime,accent,hint,transcript_edited');
  } catch (e) {
    return json({ error: 'db_error', detail: String((e as Error).message) }, 500);
  }
  if (!word) return json({ error: 'not_found' }, 404);

  const fail = async (code: string, message: string, status: number) => {
    // The recording stays exactly where it is; only the transcription status changes.
    await db.updateWord(wordId, { stt_status: 'failed', stt_error: `${code}: ${message}`.slice(0, 500) }).catch(() => undefined);
    return json({ error: code, detail: message }, status);
  };

  try {
    await db.updateWord(wordId, { stt_status: 'processing', stt_error: null });
  } catch (e) {
    return json({ error: 'db_error', detail: String((e as Error).message) }, 500);
  }

  let audio: Blob;
  try {
    audio = await db.download('recordings', word.audio_path);
    if (audio.size === 0) throw new Error('empty file');
  } catch (e) {
    return fail('audio_missing', String((e as Error).message), 500);
  }

  const provider = (Deno.env.get('STT_PROVIDER') ?? 'deepgram').toLowerCase();
  const hint = sanitizeHint(word.hint);

  let result: ProviderResult;
  try {
    result = provider === 'openai'
      ? await transcribeOpenAI(audio, word.audio_mime, hint)
      : await transcribeDeepgram(audio, word.audio_mime, word.accent as Accent, hint);
  } catch (e) {
    const err = e instanceof ProviderError ? e : new ProviderError('provider_error', String((e as Error)?.message ?? e));
    console.error('transcribe failed', wordId, err.code, err.message);
    return fail(err.code, err.message, err.code === 'timeout' ? 504 : 502);
  }

  const analysis = analyzeResult(result);
  const update: Record<string, unknown> = {
    stt_status: analysis.status,
    stt_transcript: analysis.heard,
    stt_confidence: analysis.confidence,
    stt_reason: analysis.reason,
    stt_provider: result.provider,
    stt_error: null,
  };
  // Never overwrite a transcript the learner corrected by hand.
  if (!word.transcript_edited && analysis.status === 'done') update.transcript = analysis.transcript;

  try {
    const saved = await db.updateWord(wordId, update);
    return json({ word: saved, analysis });
  } catch (e) {
    return json({ error: 'db_error', detail: String((e as Error).message) }, 500);
  }
});
