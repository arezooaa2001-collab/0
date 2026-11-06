import type { Accent } from '../../supabase/functions/_shared/stt';
import { baseMime, extensionFor, sha256Hex } from './audio';
import { AUDIO_BUCKET, TRANSCRIBE_CLIENT_TIMEOUT_MS } from './config';
import type { OutboxItem } from './outbox';
import { sb } from './supabase';

export type SttStatus = 'pending' | 'processing' | 'done' | 'unclear' | 'failed';

export interface Word {
  id: string;
  user_id: string;
  audio_path: string;
  audio_mime: string;
  audio_bytes: number;
  audio_sha256: string;
  duration_ms: number;
  accent: Accent;
  hint: string | null;
  transcript: string | null;
  transcript_edited: boolean;
  stt_status: SttStatus;
  stt_transcript: string | null;
  stt_confidence: number | null;
  stt_reason: string | null;
  stt_provider: string | null;
  stt_error: string | null;
  favorite: boolean;
  created_at: string;
  updated_at: string;
}

export type SaveStage = 'upload' | 'verify' | 'record';

export function audioPathFor(userId: string, id: string, mime: string): string {
  return `${userId}/${id}.${extensionFor(mime)}`;
}

export async function listWords(): Promise<Word[]> {
  const { data, error } = await sb().from('words').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Word[];
}

export async function getWord(id: string): Promise<Word | null> {
  const { data, error } = await sb().from('words').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Word) ?? null;
}

function isAlreadyExists(err: unknown): boolean {
  const e = err as { statusCode?: string | number; status?: number; message?: string; error?: string };
  const code = String(e?.statusCode ?? e?.status ?? '');
  const msg = `${e?.message ?? ''} ${e?.error ?? ''}`.toLowerCase();
  return code === '409' || msg.includes('already exists') || msg.includes('duplicate');
}

/**
 * Upload one recording to the private cloud and register it in the vocabulary table.
 * Idempotent: safe to call again after any interruption (same id → same path, never a duplicate).
 *
 * 1. upload the original bytes (no overwrite is ever allowed by storage policy)
 * 2. download them back and compare SHA-256 → proves the cloud copy is byte-identical
 * 3. insert the database row (ignored if it already exists)
 */
export async function uploadRecording(item: OutboxItem, onStage?: (s: SaveStage) => void): Promise<Word> {
  const client = sb();
  const path = audioPathFor(item.userId, item.id, item.mimeType);
  const storage = client.storage.from(AUDIO_BUCKET);

  onStage?.('upload');
  const { error: upErr } = await storage.upload(path, item.blob, {
    contentType: baseMime(item.mimeType),
    upsert: false,
    cacheControl: '31536000',
  });
  if (upErr && !isAlreadyExists(upErr)) throw upErr;

  onStage?.('verify');
  const { data: remote, error: dlErr } = await storage.download(path);
  if (dlErr || !remote) throw dlErr ?? new Error('Could not read back uploaded audio');
  const remoteHash = await sha256Hex(remote);
  if (remoteHash !== item.sha256) {
    throw new Error(`Cloud copy does not match the original recording (sha256 ${remoteHash} ≠ ${item.sha256})`);
  }

  onStage?.('record');
  const row = {
    id: item.id,
    user_id: item.userId,
    audio_path: path,
    audio_mime: baseMime(item.mimeType),
    audio_bytes: item.blob.size,
    audio_sha256: item.sha256,
    duration_ms: Math.max(1, Math.round(item.durationMs)),
    accent: item.accent,
    hint: item.hint,
    created_at: item.createdAt,
  };
  const { error: insErr } = await client.from('words').upsert(row, { onConflict: 'id', ignoreDuplicates: true });
  if (insErr) throw insErr;

  const saved = await getWord(item.id);
  if (!saved) throw new Error('Saved word could not be read back from the cloud');
  return saved;
}

/** Ask the server to transcribe the saved original recording into English. */
export async function transcribeWord(id: string): Promise<Word> {
  const call = sb().functions.invoke('transcribe', { body: { wordId: id } });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('transcription_timeout')), TRANSCRIBE_CLIENT_TIMEOUT_MS),
  );
  try {
    const { data, error } = await Promise.race([call, timeout]);
    if (error) throw error;
    if (data?.word) return data.word as Word;
    throw new Error('Empty transcription response');
  } catch (e) {
    // The function records failures on the row itself; return the row so the UI shows the real state.
    const fresh = await getWord(id).catch(() => null);
    if (fresh && fresh.stt_status !== 'processing') return fresh;
    throw e;
  }
}

/** Save a transcript written or confirmed by the learner. The audio is never touched. */
export async function setTranscript(id: string, text: string): Promise<Word> {
  const { data, error } = await sb()
    .from('words')
    .update({ transcript: text, transcript_edited: true })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Word;
}

export async function setFavorite(id: string, favorite: boolean): Promise<Word> {
  const { data, error } = await sb().from('words').update({ favorite }).eq('id', id).select('*').single();
  if (error) throw error;
  return data as Word;
}

/** Delete the audio file first, then the row. Both steps are idempotent, so a retry always finishes the job. */
export async function deleteWord(word: Word): Promise<void> {
  const client = sb();
  const { error: rmErr } = await client.storage.from(AUDIO_BUCKET).remove([word.audio_path]);
  if (rmErr) throw rmErr;
  const { error } = await client.from('words').delete().eq('id', word.id);
  if (error) throw error;
  audioCache.delete(word.id);
}

// ── Playback of the exact original recording ────────────────────────────────

const audioCache = new Map<string, { url: string; verified: boolean }>();

/**
 * Fetch the original recording from private storage and return a playable object URL.
 * The bytes are checked against the SHA-256 taken at recording time.
 */
export async function getOriginalAudioUrl(word: Word): Promise<{ url: string; verified: boolean }> {
  const hit = audioCache.get(word.id);
  if (hit) return hit;
  const { data, error } = await sb().storage.from(AUDIO_BUCKET).download(word.audio_path);
  if (error || !data) throw error ?? new Error('Audio not found');
  const verified = (await sha256Hex(data)) === word.audio_sha256;
  const blob = new Blob([data], { type: word.audio_mime });
  const entry = { url: URL.createObjectURL(blob), verified };
  audioCache.set(word.id, entry);
  return entry;
}

export function clearAudioCache(): void {
  for (const { url } of audioCache.values()) URL.revokeObjectURL(url);
  audioCache.clear();
}
