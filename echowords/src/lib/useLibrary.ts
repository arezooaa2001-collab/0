import { useCallback, useEffect, useRef, useState } from 'react';
import type { Accent } from '../../supabase/functions/_shared/stt';
import { sha256Hex } from './audio';
import * as outbox from './outbox';
import type { OutboxItem } from './outbox';
import type { Take } from './useRecorder';
import { type SaveStage, type Word, deleteWord, listWords, setFavorite, setTranscript, transcribeWord, uploadRecording } from './words';

/** Thrown when a recording is safe in the local outbox but did not reach the cloud yet. */
export class SaveError extends Error {
  constructor(public itemId: string, cause: unknown) {
    super(errText(cause));
  }
}

export interface PendingUpload {
  item: OutboxItem;
  status: 'waiting' | 'uploading' | 'failed';
  stage: SaveStage | null;
  error: string | null;
}

export interface Library {
  words: Word[];
  pending: PendingUpload[];
  loading: boolean;
  loadError: boolean;
  transcribing: Set<string>;
  refresh: () => Promise<void>;
  saveTake: (take: Take, opts: { hint: string | null; accent: Accent }, onStage: (s: SaveStage | 'local') => void) => Promise<Word>;
  /** Retry uploads; resolves with the words that reached the cloud. */
  retryPending: (id?: string) => Promise<Word[]>;
  transcribe: (id: string) => Promise<Word | null>;
  correct: (id: string, text: string) => Promise<Word>;
  toggleFavorite: (w: Word) => Promise<void>;
  remove: (w: Word) => Promise<void>;
}

function errText(e: unknown): string {
  return (e as { message?: string })?.message ?? String(e);
}

export function useLibrary(userId: string): Library {
  const [words, setWords] = useState<Word[]>([]);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [transcribing, setTranscribing] = useState<Set<string>>(new Set());
  const busy = useRef(new Set<string>());

  const upsertWord = useCallback((w: Word) => {
    setWords((prev) => {
      const i = prev.findIndex((x) => x.id === w.id);
      if (i === -1) return [w, ...prev].sort((a, b) => b.created_at.localeCompare(a.created_at));
      const next = prev.slice();
      next[i] = w;
      return next;
    });
  }, []);

  const setPendingState = useCallback((id: string, patch: Partial<PendingUpload>) => {
    setPending((prev) => prev.map((p) => (p.item.id === id ? { ...p, ...patch } : p)));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setWords(await listWords());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const setTx = useCallback((id: string, on: boolean) => {
    setTranscribing((prev) => {
      const n = new Set(prev);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }, []);

  const transcribe = useCallback(
    async (id: string) => {
      setTx(id, true);
      try {
        const w = await transcribeWord(id);
        upsertWord(w);
        return w;
      } catch {
        return null;
      } finally {
        setTx(id, false);
      }
    },
    [setTx, upsertWord],
  );

  /** Upload one outbox item. Returns the cloud word, or throws (item stays safely in the outbox). */
  const uploadOne = useCallback(
    async (item: OutboxItem, onStage?: (s: SaveStage) => void): Promise<Word> => {
      if (busy.current.has(item.id)) throw new Error('already_uploading');
      busy.current.add(item.id);
      setPendingState(item.id, { status: 'uploading', error: null });
      try {
        const w = await uploadRecording(item, (s) => {
          setPendingState(item.id, { stage: s });
          onStage?.(s);
        });
        await outbox.removeItem(item.id); // only after the cloud copy is verified
        setPending((prev) => prev.filter((p) => p.item.id !== item.id));
        upsertWord(w);
        return w;
      } catch (e) {
        await outbox.markAttempt(item.id, errText(e)).catch(() => undefined);
        setPendingState(item.id, { status: 'failed', stage: null, error: errText(e) });
        throw e;
      } finally {
        busy.current.delete(item.id);
      }
    },
    [setPendingState, upsertWord],
  );

  const retryPending = useCallback(
    async (id?: string) => {
      const items = await outbox.listItems(userId).catch(() => [] as OutboxItem[]);
      setPending((prev) => {
        const known = new Map(prev.map((p) => [p.item.id, p]));
        return items.map((item) => known.get(item.id) ?? { item, status: 'waiting', stage: null, error: item.lastError });
      });
      const uploaded: Word[] = [];
      for (const item of items) {
        if (id && item.id !== id) continue;
        if (busy.current.has(item.id)) continue;
        try {
          const w = await uploadOne(item);
          uploaded.push(w);
          if (w.stt_status === 'pending' || w.stt_status === 'failed') void transcribe(w.id);
        } catch {
          /* stays in outbox; shown as failed with a retry button */
        }
      }
      return uploaded;
    },
    [transcribe, uploadOne, userId],
  );

  const saveTake: Library['saveTake'] = useCallback(
    async (take, { hint, accent }, onStage) => {
      onStage('local');
      const item: OutboxItem = {
        id: crypto.randomUUID(),
        userId,
        blob: take.blob,
        mimeType: take.mimeType,
        durationMs: take.durationMs,
        accent,
        hint,
        sha256: await sha256Hex(take.blob),
        createdAt: new Date().toISOString(),
        attempts: 0,
        lastError: null,
      };
      await outbox.putItem(item); // durable before any network traffic
      setPending((prev) => [...prev, { item, status: 'waiting', stage: null, error: null }]);
      try {
        return await uploadOne(item, onStage);
      } catch (e) {
        throw new SaveError(item.id, e);
      }
    },
    [uploadOne, userId],
  );

  const correct = useCallback(
    async (id: string, text: string) => {
      const w = await setTranscript(id, text);
      upsertWord(w);
      return w;
    },
    [upsertWord],
  );

  const toggleFavorite = useCallback(
    async (w: Word) => {
      upsertWord(await setFavorite(w.id, !w.favorite));
    },
    [upsertWord],
  );

  const remove = useCallback(async (w: Word) => {
    await deleteWord(w);
    setWords((prev) => prev.filter((x) => x.id !== w.id));
  }, []);

  useEffect(() => {
    void refresh();
    void retryPending();
    const onOnline = () => {
      void retryPending();
      void refresh();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [refresh, retryPending]);

  return { words, pending, loading, loadError, transcribing, refresh, saveTake, retryPending, transcribe, correct, toggleFavorite, remove };
}
