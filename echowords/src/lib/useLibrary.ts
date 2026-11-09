import { useCallback, useEffect, useRef, useState } from 'react';
import { recognizeSpeech } from './asr';
import { ALL_LANGS, type LangCode, langOf, primaryLang } from './langs';
import { newId, sha256Hex } from './audio';
import { autoBackupDue, downloadBackup } from './backup';
import { isNativeApp } from './native';
import { pullRemote, pushFolder, pushWord, removeFolderRemote, removeWordRemote } from './cloudSync';
import * as db from './db';
import type { Word } from './db';
import { type Analysis, analyzeResult, type Accent } from './stt';
import type { Take } from './useRecorder';

export interface SaveOptions {
  hint: string | null;
  accent: Accent;
  lang?: LangCode;
  folderId?: string | null;
  /** English text the learner confirmed (null = no text yet). */
  text: string | null;
  /** True when the learner confirmed before recognition finished: the library will finish it. */
  pendingTranscription?: boolean;
  /** What the recognizer produced, or null if it could not run. */
  analysis: Analysis | null;
}

export interface Library {
  /** Whether this page can keep data on the device (null while checking). */
  health: db.StorageHealth | null;
  /** Save a backup file to Downloads if one is due. Call right after a tap (browsers allow downloads then). */
  autoBackupIfDue: () => Promise<boolean>;
  words: Word[];
  loading: boolean;
  loadError: boolean;
  /** 0..1 while the speech model downloads for the first time, otherwise null. */
  modelProgress: number | null;
  transcribing: Set<string>;
  refresh: () => Promise<void>;
  /** Recognize a recording that is not saved yet (for the review step). Throws if the recognizer is unavailable. */
  recognizeTake: (take: Take, hint: string | null, lang: LangCode | 'auto') => Promise<Analysis>;
  /** Save a take after the learner pressed «تایید». */
  saveTake: (take: Take, opts: SaveOptions) => Promise<Word>;
  /** Save a typed English word/sentence right away (no recording yet). */
  saveText: (text: string, accent: Accent, folderId?: string | null) => Promise<Word>;
  folders: db.Folder[];
  createFolder: (name: string, emoji: string) => Promise<db.Folder>;
  renameFolder: (f: db.Folder, name: string, emoji: string) => Promise<void>;
  removeFolder: (f: db.Folder) => Promise<void>;
  moveToFolder: (w: Word, folderId: string | null) => Promise<void>;
  /** Attach the learner's own recording to a saved word that has none yet. */
  attachTake: (id: string, take: Take, analysis: Analysis | null) => Promise<Word>;
  transcribe: (id: string) => Promise<Word | null>;
  correct: (id: string, text: string) => Promise<Word>;
  toggleFavorite: (w: Word) => Promise<void>;
  remove: (w: Word) => Promise<void>;
  getAudioUrl: (w: Word) => Promise<{ url: string; verified: boolean }>;
}

const audioUrls = new Map<string, { url: string; verified: boolean }>();

/**
 * Inside Claude: bring words/folders stored in Claude onto this device (e.g. after the
 * browser was cleared, or on another device), and copy device-only words up to Claude.
 */
async function mergeWithClaude(): Promise<void> {
  const remote = await pullRemote();
  if (!remote) return;
  const localFolders = new Set((await db.listFolders()).map((f) => f.id));
  for (const f of remote.folders) if (!localFolders.has(f.id)) await db.saveFolder(f);
  const remoteFolderIds = new Set(remote.folders.map((f) => f.id));
  for (const f of await db.listFolders()) if (!remoteFolderIds.has(f.id)) void pushFolder(f);
  const remoteIds = new Set<string>();
  for (const rw of remote.words) {
    remoteIds.add(rw.id);
    const local = await db.getWord(rw.id);
    if (!local) await db.addWord(rw, null);
    else if (rw.updatedAt > local.updatedAt)
      await db.updateWord(rw.id, {
        transcript: rw.transcript,
        transcriptEdited: rw.transcriptEdited,
        favorite: rw.favorite,
        folderId: rw.folderId ?? null,
        lang: rw.lang,
      });
  }
  for (const w of await db.listWords()) if (!remoteIds.has(w.id)) void pushWord(w);
}

export function useLibrary(enabledLangs: LangCode[] = ALL_LANGS): Library {
  const enabledRef = useRef(enabledLangs);
  enabledRef.current = enabledLangs;
  const [words, setWords] = useState<Word[]>([]);
  const [health, setHealth] = useState<db.StorageHealth | null>(null);
  const [folders, setFolders] = useState<db.Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [transcribing, setTranscribing] = useState<Set<string>>(new Set());
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inFlight = useRef(new Map<string, Promise<Word | null>>());

  const upsert = useCallback((w: Word) => {
    void pushWord(w); // also kept in Claude storage when running inside Claude (no-op elsewhere)
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
      setHealth(await db.checkStorage());
      await mergeWithClaude();
      setWords(await db.listWords());
      setFolders(await db.listFolders());
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
          const word = await db.getWord(id);
          if (!word || !db.hasAudio(word)) return null;
          const bytes = await db.getAudio(id);
          if (!bytes) return null;
          upsert(await db.updateWord(id, { sttStatus: 'processing' }));
          const lang = word.transcript ? langOf(word) : 'auto';
          const raw = await recognizeSpeech(new Blob([bytes], { type: word.audioMime ?? '' }), lang, enabledRef.current, (p) =>
            setModelProgress(p < 1 ? p : null),
          );
          setModelProgress(null);
          const a = analyzeResult(raw, word.hint);
          const patch: db.WordPatch = { sttStatus: a.status, sttHeard: a.heard, sttReason: a.reason };
          if (a.status === 'done' && !word.transcriptEdited) {
            patch.transcript = a.transcript;
            patch.lang = primaryLang(a.transcript!);
          }
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

  const recognizeTake = useCallback((take: Take, hint: string | null, lang: LangCode | 'auto'): Promise<Analysis> => {
    const job = queue.current.then(async () => {
      try {
        const raw = await recognizeSpeech(take.blob, lang, enabledRef.current, (p) => setModelProgress(p < 1 ? p : null));
        return analyzeResult(raw, hint);
      } finally {
        setModelProgress(null);
      }
    });
    queue.current = job.catch(() => undefined);
    return job;
  }, []);

  const saveTake = useCallback(
    async (take: Take, { hint, accent, lang, folderId, text, analysis, pendingTranscription }: SaveOptions) => {
      const bytes = await take.blob.arrayBuffer();
      const sha = await sha256Hex(bytes);
      const now = new Date().toISOString();
      const word: Word = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        durationMs: Math.max(1, Math.round(take.durationMs)),
        audioMime: take.mimeType,
        audioBytes: bytes.byteLength,
        audioSha256: sha,
        accent,
        lang: lang ?? (text ? primaryLang(text) : undefined),
        folderId: folderId ?? null,
        hint,
        transcript: text,
        transcriptEdited: !!text && text !== analysis?.transcript,
        // With confirmed text the word is finished; without it, the library offers "write again".
        sttStatus: text ? 'done' : analysis ? analysis.status : pendingTranscription ? 'pending' : 'failed',
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

  const saveText = useCallback(
    async (text: string, accent: Accent, folderId: string | null = null) => {
      const now = new Date().toISOString();
      const word: Word = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        durationMs: null,
        audioMime: null,
        audioBytes: null,
        audioSha256: null,
        accent,
        lang: primaryLang(text),
        folderId,
        hint: text,
        transcript: text,
        transcriptEdited: true,
        sttStatus: 'none',
        sttHeard: null,
        sttReason: null,
        favorite: false,
      };
      await db.addWord(word, null);
      const back = await db.getWord(word.id); // read back: proves it is really stored
      if (!back || back.transcript !== text) throw new Error('verify_failed');
      void db.requestPersistentStorage();
      upsert(back);
      return back;
    },
    [upsert],
  );

  const attachTake = useCallback(
    async (id: string, take: Take, analysis: Analysis | null) => {
      const bytes = await take.blob.arrayBuffer();
      const sha = await sha256Hex(bytes);
      const meta = { durationMs: Math.max(1, Math.round(take.durationMs)), audioMime: take.mimeType, audioBytes: bytes.byteLength, audioSha256: sha };
      const w = await db.addAudio(id, meta, bytes, {
        sttStatus: analysis ? analysis.status : 'none',
        sttHeard: analysis?.heard ?? null,
        sttReason: analysis?.reason ?? null,
      });
      const back = await db.getAudio(id);
      if (!back || (await sha256Hex(back)) !== sha) throw new Error('verify_failed');
      upsert(w);
      return w;
    },
    [upsert],
  );

  const createFolder = useCallback(async (name: string, emoji: string) => {
    const f: db.Folder = { id: newId(), name: name.trim().slice(0, 40), emoji, createdAt: new Date().toISOString() };
    await db.saveFolder(f);
    void pushFolder(f);
    setFolders(await db.listFolders());
    return f;
  }, []);

  const renameFolder = useCallback(async (f: db.Folder, name: string, emoji: string) => {
    const next = { ...f, name: name.trim().slice(0, 40), emoji };
    await db.saveFolder(next);
    void pushFolder(next);
    setFolders(await db.listFolders());
  }, []);

  const removeFolder = useCallback(async (f: db.Folder) => {
    const inside = new Set((await db.listWords()).filter((w) => w.folderId === f.id).map((w) => w.id));
    await db.deleteFolder(f.id);
    void removeFolderRemote(f.id);
    setFolders(await db.listFolders());
    const all = await db.listWords();
    for (const w of all) if (inside.has(w.id)) void pushWord(w); // now "no folder" in Claude storage too
    setWords(all);
  }, []);

  const moveToFolder = useCallback(
    async (w: Word, folderId: string | null) => {
      upsert(await db.updateWord(w.id, { folderId }));
    },
    [upsert],
  );

  const correct = useCallback(
    async (id: string, text: string) => {
      const w = await db.updateWord(id, { transcript: text, transcriptEdited: true, lang: primaryLang(text) });
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
    void removeWordRemote(w.id);
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
    const entry = { url: URL.createObjectURL(new Blob([bytes], { type: w.audioMime ?? '' })), verified: (await sha256Hex(bytes)) === w.audioSha256 };
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

  const autoBackupIfDue = useCallback(async () => {
    try {
      const h = await db.checkStorage();
      const all = await db.listWords();
      // Android app with working storage: no surprise «save file» screens; backups are made from Settings.
      if (isNativeApp() && h.mode === 'device') return false;
      // Only IndexedDB counts as lasting storage; anything weaker gets a backup file after every change.
      if (!autoBackupDue(all, h.mode === 'device')) return false;
      await downloadBackup();
      return true;
    } catch (e) {
      console.warn('automatic backup failed', e);
      return false;
    }
  }, []);

  return { folders, createFolder, renameFolder, removeFolder, moveToFolder, health, autoBackupIfDue, words, loading, loadError, modelProgress, transcribing, refresh, recognizeTake, saveTake, saveText, attachTake, transcribe, correct, toggleFavorite, remove, getAudioUrl };
}
