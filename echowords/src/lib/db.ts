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

function run<T>(stores: string[], mode: IDBTransactionMode, fn: (tx: IDBTransaction) => IDBRequest<T> | void): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(stores, mode);
        const req = fn(tx);
        let result: T;
        if (req) req.onsuccess = () => (result = req.result);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
      }),
  );
}

export async function listWords(): Promise<Word[]> {
  const rows = await run<Word[]>([WORDS], 'readonly', (tx) => tx.objectStore(WORDS).getAll());
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getWord(id: string): Promise<Word | undefined> {
  return run<Word | undefined>([WORDS], 'readonly', (tx) => tx.objectStore(WORDS).get(id));
}

/** Save a new word and its original audio atomically (both or neither). */
export function addWord(word: Word, audio: ArrayBuffer): Promise<void> {
  return run<void>([WORDS, AUDIO], 'readwrite', (tx) => {
    tx.objectStore(WORDS).add(word);
    tx.objectStore(AUDIO).add({ id: word.id, bytes: audio });
  });
}

export async function getAudio(id: string): Promise<ArrayBuffer | null> {
  const row = await run<{ id: string; bytes: ArrayBuffer } | undefined>([AUDIO], 'readonly', (tx) => tx.objectStore(AUDIO).get(id));
  return row?.bytes ?? null;
}

export async function updateWord(id: string, patch: WordPatch): Promise<Word> {
  let updated: Word | undefined;
  await run<void>([WORDS], 'readwrite', (tx) => {
    const store = tx.objectStore(WORDS);
    const req = store.get(id);
    req.onsuccess = () => {
      const cur = req.result as Word | undefined;
      if (!cur) return tx.abort();
      const allowed: WordPatch = {};
      for (const k of ['transcript', 'transcriptEdited', 'sttStatus', 'sttHeard', 'sttReason', 'favorite'] as const) {
        if (k in patch) (allowed as Record<string, unknown>)[k] = patch[k];
      }
      updated = { ...cur, ...allowed, updatedAt: new Date().toISOString() };
      store.put(updated);
    };
  });
  if (!updated) throw new Error('Word not found');
  return updated;
}

export function deleteWord(id: string): Promise<void> {
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
