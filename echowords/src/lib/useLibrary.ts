import { useCallback, useEffect, useRef, useState } from 'react';
import { recognizeEnglish } from './asr';
import { sha256Hex } from './audio';
import * as db from './db';
import type { Word } from './db';
import { type Analysis, analyzeResult, type Accent } from './stt';
import type { Take } from './useRecorder';

export interface SaveOptions {
  hint: string | null;
  accent: Accent;
  /** English text the learner confirmed (null = no text yet). */
  text: string | null;
  /** What the recognizer produced, or null if it could not run. */
  analysis: Analysis | null;
}

export interface Library {
  words: Word[];
  loading: boolean;
  loadError: boolean;
  /** 0..1 while the speech model downloads for the first time, otherwise null. */
  modelProgress: number | null;
  transcribing: Set<string>;
  refresh: () => Promise<void>;
  /** Recognize a recording that is not saved yet (for the review step). Throws if the recognizer is unavailable. */
  recognizeTake: (take: Take, hint: string | null) => Promise<Analysis>;
  /** Save a take after the learner pressed «تایید». */
  saveTake: (take: Take, opts: SaveOptions) => Promise<Word>;
  transcribe: (id: string) => Promise<Word | null>;
  correct: (id: string, text: string) => Promise<Word>;
  toggleFavorite: (w: Word) => Promise<void>;
  remove: (w: Word) => Promise<void>;
  getAudioUrl: (w: Word) => Promise<{ url: string; verified: boolean }>;
}

const audioUrls = new Map<string, { url: string; verified: boolean }>();

export function useLibrary(): Library {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [transcribing, setTranscribing] = useState<Set<string>>(new Set());
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inFlight = useRef(new Map<string, Promise<Word | null>>());

  const upsert = useCallback((w: Word) => {
    setWords((prev) => {
      const i = prev.findIndex((x) => x.id === w.id);
      if (i === -1) return [w, ...prev].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const next = prev.slice();
      next[i] = w;
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setWords(await db.listWords());
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

  /** Transcriptions run one at a time (the model is CPU-heavy). */
  const transcribe = useCallback(
    (id: string): Promise<Word | null> => {
      const running = inFlight.current.get(id);
      if (running) return running;
      setTx(id, true);
      const job = queue.current.then(async () => {
        try {
          const bytes = await db.getAudio(id);
          const word = await db.getWord(id);
          if (!bytes || !word) return null;
          upsert(await db.updateWord(id, { sttStatus: 'processing' }));
          const raw = await recognizeEnglish(new Blob([bytes], { type: word.audioMime }), (p) => setModelProgress(p < 1 ? p : null));
          setModelProgress(null);
          const a = analyzeResult(raw, word.hint);
          const patch: db.WordPatch = { sttStatus: a.status, sttHeard: a.heard, sttReason: a.reason };
          if (a.status === 'done' && !word.transcriptEdited) patch.transcript = a.transcript;
          const saved = await db.updateWord(id, patch);
          upsert(saved);
          return saved;
        } catch (e) {
          console.error('transcription failed', e);
          setModelProgress(null);
          const saved = await db.updateWord(id, { sttStatus: 'failed' }).catch(() => null);
          if (saved) upsert(saved);
          return saved;
        } finally {
          setTx(id, false);
          inFlight.current.delete(id);
        }
      });
      inFlight.current.set(id, job);
      queue.current = job.catch(() => undefined);
      return job;
    },
    [setTx, upsert],
  );

  const recognizeTake = useCallback((take: Take, hint: string | null): Promise<Analysis> => {
    const job = queue.current.then(async () => {
      try {
        const raw = await recognizeEnglish(take.blob, (p) => setModelProgress(p < 1 ? p : null));
        return analyzeResult(raw, hint);
      } finally {
        setModelProgress(null);
      }
    });
    queue.current = job.catch(() => undefined);
    return job;
  }, []);

  const saveTake = useCallback(
    async (take: Take, { hint, accent, text, analysis }: SaveOptions) => {
      const bytes = await take.blob.arrayBuffer();
      const sha = await sha256Hex(bytes);
      const now = new Date().toISOString();
      const word: Word = {
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        durationMs: Math.max(1, Math.round(take.durationMs)),
        audioMime: take.mimeType,
        audioBytes: bytes.byteLength,
        audioSha256: sha,
        accent,
        hint,
        transcript: text,
        transcriptEdited: !!text && text !== analysis?.transcript,
        // With confirmed text the word is finished; without it, the library offers "write again".
        sttStatus: text ? 'done' : analysis ? analysis.status : 'failed',
        sttHeard: analysis?.heard ?? null,
        sttReason: analysis?.reason ?? null,
        favorite: false,
      };
      await db.addWord(word, bytes);
      // Read it back and compare fingerprints: proves the saved copy is byte-identical.
      const back = await db.getAudio(word.id);
      if (!back || (await sha256Hex(back)) !== sha) {
        await db.deleteWord(word.id).catch(() => undefined);
        throw new Error('verify_failed');
      }
      void db.requestPersistentStorage();
      upsert(word);
      return word;
    },
    [upsert],
  );

  const correct = useCallback(
    async (id: string, text: string) => {
      const w = await db.updateWord(id, { transcript: text, transcriptEdited: true });
      upsert(w);
      return w;
    },
    [upsert],
  );

  const toggleFavorite = useCallback(
    async (w: Word) => {
      upsert(await db.updateWord(w.id, { favorite: !w.favorite }));
    },
    [upsert],
  );

  const remove = useCallback(async (w: Word) => {
    await db.deleteWord(w.id);
    const cached = audioUrls.get(w.id);
    if (cached) URL.revokeObjectURL(cached.url);
    audioUrls.delete(w.id);
    setWords((prev) => prev.filter((x) => x.id !== w.id));
  }, []);

  /** The exact original recording, checked against its fingerprint. */
  const getAudioUrl = useCallback(async (w: Word) => {
    const hit = audioUrls.get(w.id);
    if (hit) return hit;
    const bytes = await db.getAudio(w.id);
    if (!bytes) throw new Error('audio_missing');
    const entry = { url: URL.createObjectURL(new Blob([bytes], { type: w.audioMime })), verified: (await sha256Hex(bytes)) === w.audioSha256 };
    audioUrls.set(w.id, entry);
    return entry;
  }, []);

  // On start: load the library and finish any transcription that was interrupted (app closed).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      const all = await db.listWords().catch(() => [] as Word[]);
      if (cancelled) return;
      for (const w of all) {
        if (w.sttStatus === 'pending' || w.sttStatus === 'processing') void transcribe(w.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, transcribe]);

  return { words, loading, loadError, modelProgress, transcribing, refresh, recognizeTake, saveTake, transcribe, correct, toggleFavorite, remove, getAudioUrl };
}
