// On-device library (IndexedDB). Word details and the original audio bytes are stored
// in two object stores and always written together in ONE transaction.
import type { Accent } from './stt';

export type SttStatus = 'pending' | 'processing' | 'done' | 'unclear' | 'failed';

export interface Word {
  id: string;
  createdAt: string;
  updatedAt: string;
  durationMs: number;
  audioMime: string;
  audioBytes: number;
  audioSha256: string;
  accent: Accent;
  hint: string | null;
  transcript: string | null;
  transcriptEdited: boolean;
  sttStatus: SttStatus;
  sttHeard: string | null;
  sttReason: string | null;
  favorite: boolean;
}

/** Fields that may change after saving. The audio and its fingerprint never change. */
export type WordPatch = Partial<Pick<Word, 'transcript' | 'transcriptEdited' | 'sttStatus' | 'sttHeard' | 'sttReason' | 'favorite'>>;

const DB_NAME = 'echowords-library';
const WORDS = 'words';
const AUDIO = 'audio';

let dbPromise: Promise<IDBDatabase> | null = null;

// ── Storage health ──────────────────────────────────────────────────────────
// Some places that can open an HTML file (in-app file viewers, private tabs, some
// Android "content://" pages) do not let a page keep data. The app detects this at
// start-up instead of failing silently, keeps working in memory for this visit, and
// tells the learner to make a backup file before closing.

export type StorageMode = 'unknown' | 'device' | 'memory';
export interface StorageHealth {
  mode: StorageMode;
  persisted: boolean;
}

let mode: StorageMode = 'unknown';
let healthPromise: Promise<StorageHealth> | null = null;
const mem = { words: new Map<string, Word>(), audio: new Map<string, ArrayBuffer>() };
const PROBE = '__echowords_probe__';

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('storage timeout')), ms))]);
}

/** Write, read back and delete a test record. Decides once whether the device can keep data. */
export function checkStorage(): Promise<StorageHealth> {
  if (!healthPromise) {
    healthPromise = (async () => {
      try {
        if (typeof indexedDB === 'undefined') throw new Error('no indexedDB');
        const bytes = new Uint8Array([7, 7, 7]).buffer;
        await withTimeout(rawRun<void>([AUDIO], 'readwrite', (tx) => void tx.objectStore(AUDIO).put({ id: PROBE, bytes })), 5000);
        const back = await withTimeout(rawRun<{ bytes: ArrayBuffer } | undefined>([AUDIO], 'readonly', (tx) => tx.objectStore(AUDIO).get(PROBE)), 5000);
        if (!back || new Uint8Array(back.bytes)[2] !== 7) throw new Error('probe mismatch');
        await withTimeout(rawRun<void>([AUDIO], 'readwrite', (tx) => void tx.objectStore(AUDIO).delete(PROBE)), 5000);
        mode = 'device';
      } catch (e) {
        console.warn('Device storage unavailable, using memory for this visit', e);
        mode = 'memory';
      }
      const persisted = mode === 'device' ? await requestPersistentStorage() : false;
      return { mode, persisted };
    })();
  }
  return healthPromise;
}

async function onDevice(): Promise<boolean> {
  return (await checkStorage()).mode === 'device';
}

/** For tests only. */
export function _resetStorageCheck(): void {
  healthPromise = null;
  mode = 'unknown';
}

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(WORDS)) db.createObjectStore(WORDS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(AUDIO)) db.createObjectStore(AUDIO, { keyPath: 'id' });
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

function rawRun<T>(stores: string[], txMode: IDBTransactionMode, fn: (tx: IDBTransaction) => IDBRequest<T> | void): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(stores, txMode);
        const req = fn(tx);
        let result: T;
        if (req) req.onsuccess = () => (result = req.result);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
      }),
  );
}

const run = rawRun;

export async function listWords(): Promise<Word[]> {
  const rows = (await onDevice()) ? await run<Word[]>([WORDS], 'readonly', (tx) => tx.objectStore(WORDS).getAll()) : [...mem.words.values()];
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getWord(id: string): Promise<Word | undefined> {
  if (!(await onDevice())) return mem.words.get(id);
  return run<Word | undefined>([WORDS], 'readonly', (tx) => tx.objectStore(WORDS).get(id));
}

/** Save a new word and its original audio atomically (both or neither). */
export async function addWord(word: Word, audio: ArrayBuffer): Promise<void> {
  if (!(await onDevice())) {
    if (mem.words.has(word.id)) throw new Error('exists');
    mem.words.set(word.id, { ...word });
    mem.audio.set(word.id, audio.slice(0));
    return;
  }
  return run<void>([WORDS, AUDIO], 'readwrite', (tx) => {
    tx.objectStore(WORDS).add(word);
    tx.objectStore(AUDIO).add({ id: word.id, bytes: audio });
  });
}

export async function getAudio(id: string): Promise<ArrayBuffer | null> {
  if (!(await onDevice())) return mem.audio.get(id)?.slice(0) ?? null;
  const row = await run<{ id: string; bytes: ArrayBuffer } | undefined>([AUDIO], 'readonly', (tx) => tx.objectStore(AUDIO).get(id));
  return row?.bytes ?? null;
}

const PATCHABLE = ['transcript', 'transcriptEdited', 'sttStatus', 'sttHeard', 'sttReason', 'favorite'] as const;

function applyPatch(cur: Word, patch: WordPatch): Word {
  const allowed: WordPatch = {};
  for (const k of PATCHABLE) if (k in patch) (allowed as Record<string, unknown>)[k] = patch[k];
  return { ...cur, ...allowed, updatedAt: new Date().toISOString() };
}

export async function updateWord(id: string, patch: WordPatch): Promise<Word> {
  if (!(await onDevice())) {
    const cur = mem.words.get(id);
    if (!cur) throw new Error('Word not found');
    const next = applyPatch(cur, patch);
    mem.words.set(id, next);
    return next;
  }
  let updated: Word | undefined;
  await run<void>([WORDS], 'readwrite', (tx) => {
    const store = tx.objectStore(WORDS);
    const req = store.get(id);
    req.onsuccess = () => {
      const cur = req.result as Word | undefined;
      if (!cur) return tx.abort();
      updated = applyPatch(cur, patch);
      store.put(updated);
    };
  });
  if (!updated) throw new Error('Word not found');
  return updated;
}

export async function deleteWord(id: string): Promise<void> {
  if (!(await onDevice())) {
    mem.words.delete(id);
    mem.audio.delete(id);
    return;
  }
  return run<void>([WORDS, AUDIO], 'readwrite', (tx) => {
    tx.objectStore(WORDS).delete(id);
    tx.objectStore(AUDIO).delete(id);
  });
}

/** Ask the browser not to clear this app's data when the device is low on space. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function storageInfo(): Promise<{ persisted: boolean; usage: number | null }> {
  try {
    const [persisted, est] = await Promise.all([navigator.storage?.persisted?.() ?? false, navigator.storage?.estimate?.()]);
    return { persisted: !!persisted, usage: est?.usage ?? null };
  } catch {
    return { persisted: false, usage: null };
  }
}
