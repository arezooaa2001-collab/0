// On-device library. A word can be saved as text only (typed and confirmed) and get the
// learner's own recording later — once. A recording, after it is attached, never changes.
//
// Storage, best first (chosen by a write/read test when the app starts):
//   1. 'device'  IndexedDB  — large, the normal case
//   2. 'local'   localStorage — smaller (~5 MB), used when a viewer blocks IndexedDB
//   3. 'memory'  nothing can be kept → the app warns and makes backup files after each save
import { fromBase64, toBase64 } from './audio';
import type { Accent } from './stt';

export type SttStatus = 'pending' | 'processing' | 'done' | 'unclear' | 'failed' | 'none';

export interface Word {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Recording details: all null while the word has no recording yet. */
  durationMs: number | null;
  audioMime: string | null;
  audioBytes: number | null;
  audioSha256: string | null;
  accent: Accent;
  hint: string | null;
  transcript: string | null;
  transcriptEdited: boolean;
  sttStatus: SttStatus;
  sttHeard: string | null;
  sttReason: string | null;
  favorite: boolean;
}

export interface AudioMeta {
  durationMs: number;
  audioMime: string;
  audioBytes: number;
  audioSha256: string;
}

/** Fields that may change after saving. Recording fields are only set by addAudio. */
export type WordPatch = Partial<Pick<Word, 'transcript' | 'transcriptEdited' | 'sttStatus' | 'sttHeard' | 'sttReason' | 'favorite'>>;
const PATCHABLE = ['transcript', 'transcriptEdited', 'sttStatus', 'sttHeard', 'sttReason', 'favorite'] as const;

export const hasAudio = (w: Pick<Word, 'audioSha256'>): boolean => !!w.audioSha256;

interface Backend {
  list(): Promise<Word[]>;
  get(id: string): Promise<Word | undefined>;
  add(word: Word, audio: ArrayBuffer | null): Promise<void>;
  put(word: Word): Promise<void>;
  /** Store word details + audio together. */
  putWithAudio(word: Word, audio: ArrayBuffer): Promise<void>;
  getAudio(id: string): Promise<ArrayBuffer | null>;
  remove(id: string): Promise<void>;
}

// ── 1. IndexedDB ────────────────────────────────────────────────────────────
const DB_NAME = 'echowords-library';
const WORDS = 'words';
const AUDIO = 'audio';
let dbPromise: Promise<IDBDatabase> | null = null;

function openIdb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
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
    }).catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise!;
}

function idbRun<T>(stores: string[], mode: IDBTransactionMode, fn: (tx: IDBTransaction) => IDBRequest<T> | void): Promise<T> {
  return openIdb().then(
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

const idb: Backend = {
  list: () => idbRun<Word[]>([WORDS], 'readonly', (tx) => tx.objectStore(WORDS).getAll()),
  get: (id) => idbRun<Word | undefined>([WORDS], 'readonly', (tx) => tx.objectStore(WORDS).get(id)),
  add: (word, audio) =>
    idbRun<void>([WORDS, AUDIO], 'readwrite', (tx) => {
      tx.objectStore(WORDS).add(word);
      if (audio) tx.objectStore(AUDIO).add({ id: word.id, bytes: audio });
    }),
  put: (word) => idbRun<void>([WORDS], 'readwrite', (tx) => void tx.objectStore(WORDS).put(word)),
  putWithAudio: (word, audio) =>
    idbRun<void>([WORDS, AUDIO], 'readwrite', (tx) => {
      tx.objectStore(WORDS).put(word);
      tx.objectStore(AUDIO).add({ id: word.id, bytes: audio }); // add: never overwrites an existing recording
    }),
  getAudio: async (id) =>
    (await idbRun<{ bytes: ArrayBuffer } | undefined>([AUDIO], 'readonly', (tx) => tx.objectStore(AUDIO).get(id)))?.bytes ?? null,
  remove: (id) =>
    idbRun<void>([WORDS, AUDIO], 'readwrite', (tx) => {
      tx.objectStore(WORDS).delete(id);
      tx.objectStore(AUDIO).delete(id);
    }),
};

// ── 2. localStorage ─────────────────────────────────────────────────────────
const LS_WORDS = 'echowords-ls-words';
const lsAudioKey = (id: string) => `echowords-ls-audio-${id}`;

function lsRead(): Word[] {
  const raw = localStorage.getItem(LS_WORDS);
  return raw ? (JSON.parse(raw) as Word[]) : [];
}
function lsWrite(words: Word[]): void {
  localStorage.setItem(LS_WORDS, JSON.stringify(words));
}

const ls: Backend = {
  list: async () => lsRead(),
  get: async (id) => lsRead().find((w) => w.id === id),
  add: async (word, audio) => {
    const all = lsRead();
    if (all.some((w) => w.id === word.id)) throw new Error('exists');
    if (audio) localStorage.setItem(lsAudioKey(word.id), toBase64(audio));
    try {
      lsWrite([...all, word]);
    } catch (e) {
      localStorage.removeItem(lsAudioKey(word.id));
      throw e;
    }
  },
  put: async (word) => lsWrite(lsRead().map((w) => (w.id === word.id ? word : w))),
  putWithAudio: async (word, audio) => {
    if (localStorage.getItem(lsAudioKey(word.id))) throw new Error('recording exists');
    localStorage.setItem(lsAudioKey(word.id), toBase64(audio));
    try {
      lsWrite(lsRead().map((w) => (w.id === word.id ? word : w)));
    } catch (e) {
      localStorage.removeItem(lsAudioKey(word.id));
      throw e;
    }
  },
  getAudio: async (id) => {
    const b64 = localStorage.getItem(lsAudioKey(id));
    return b64 ? fromBase64(b64) : null;
  },
  remove: async (id) => {
    localStorage.removeItem(lsAudioKey(id));
    lsWrite(lsRead().filter((w) => w.id !== id));
  },
};

// ── 3. memory ───────────────────────────────────────────────────────────────
const memWords = new Map<string, Word>();
const memAudio = new Map<string, ArrayBuffer>();
const memory: Backend = {
  list: async () => [...memWords.values()],
  get: async (id) => memWords.get(id),
  add: async (word, audio) => {
    if (memWords.has(word.id)) throw new Error('exists');
    memWords.set(word.id, { ...word });
    if (audio) memAudio.set(word.id, audio.slice(0));
  },
  put: async (word) => void memWords.set(word.id, { ...word }),
  putWithAudio: async (word, audio) => {
    if (memAudio.has(word.id)) throw new Error('recording exists');
    memAudio.set(word.id, audio.slice(0));
    memWords.set(word.id, { ...word });
  },
  getAudio: async (id) => memAudio.get(id)?.slice(0) ?? null,
  remove: async (id) => {
    memWords.delete(id);
    memAudio.delete(id);
  },
};

// ── Choosing the storage ────────────────────────────────────────────────────
export type StorageMode = 'unknown' | 'device' | 'local' | 'memory';
export interface StorageHealth {
  mode: StorageMode;
  persisted: boolean;
}

let healthPromise: Promise<StorageHealth> | null = null;
let backend: Backend = memory;
const PROBE = '__echowords_probe__';

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('storage timeout')), ms))]);
}

async function probeIdb(): Promise<boolean> {
  try {
    if (typeof indexedDB === 'undefined') return false;
    const bytes = new Uint8Array([7, 7, 7]).buffer;
    await withTimeout(idbRun<void>([AUDIO], 'readwrite', (tx) => void tx.objectStore(AUDIO).put({ id: PROBE, bytes })), 5000);
    const back = await withTimeout(idbRun<{ bytes: ArrayBuffer } | undefined>([AUDIO], 'readonly', (tx) => tx.objectStore(AUDIO).get(PROBE)), 5000);
    await withTimeout(idbRun<void>([AUDIO], 'readwrite', (tx) => void tx.objectStore(AUDIO).delete(PROBE)), 5000);
    return !!back && new Uint8Array(back.bytes)[2] === 7;
  } catch (e) {
    console.warn('IndexedDB unavailable', e);
    return false;
  }
}

function probeLocalStorage(): boolean {
  try {
    localStorage.setItem(PROBE, '7');
    const ok = localStorage.getItem(PROBE) === '7';
    localStorage.removeItem(PROBE);
    return ok;
  } catch {
    return false;
  }
}

/** Decide once (per page load) where words are kept. */
export function checkStorage(): Promise<StorageHealth> {
  if (!healthPromise) {
    healthPromise = (async () => {
      let mode: StorageMode;
      if (await probeIdb()) {
        mode = 'device';
        backend = idb;
        await adoptLocalStorageWords(); // words saved earlier while IndexedDB was blocked
      } else if (probeLocalStorage()) {
        mode = 'local';
        backend = ls;
      } else {
        mode = 'memory';
        backend = memory;
      }
      const persisted = mode === 'memory' ? false : await requestPersistentStorage();
      return { mode, persisted };
    })();
  }
  return healthPromise;
}

/** If an earlier visit had to use localStorage, move those words into IndexedDB. */
async function adoptLocalStorageWords(): Promise<void> {
  try {
    if (!probeLocalStorage()) return;
    const old = lsRead();
    for (const w of old) {
      if (!(await idb.get(w.id))) await idb.add(w, await ls.getAudio(w.id));
      await ls.remove(w.id);
    }
  } catch (e) {
    console.warn('could not move older words', e);
  }
}

async function store(): Promise<Backend> {
  await checkStorage();
  return backend;
}

/** For tests only. */
export function _resetStorageCheck(): void {
  healthPromise = null;
  backend = memory;
  memWords.clear();
  memAudio.clear();
}

// ── Public API ──────────────────────────────────────────────────────────────
export async function listWords(): Promise<Word[]> {
  const rows = await (await store()).list();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getWord(id: string): Promise<Word | undefined> {
  return (await store()).get(id);
}

/** Save a new word, with or without its original recording (both together or neither). */
export async function addWord(word: Word, audio: ArrayBuffer | null): Promise<void> {
  return (await store()).add(word, audio);
}

export async function getAudio(id: string): Promise<ArrayBuffer | null> {
  return (await store()).getAudio(id);
}

/** Attach the learner's recording to a word that has none yet. A recording is never replaced. */
export async function addAudio(id: string, meta: AudioMeta, audio: ArrayBuffer, patch: WordPatch = {}): Promise<Word> {
  const s = await store();
  const cur = await s.get(id);
  if (!cur) throw new Error('Word not found');
  if (hasAudio(cur)) throw new Error('This word already has its recording');
  const next: Word = { ...applyPatch(cur, patch), ...meta };
  await s.putWithAudio(next, audio);
  return next;
}

function applyPatch(cur: Word, patch: WordPatch): Word {
  const allowed: WordPatch = {};
  for (const k of PATCHABLE) if (k in patch) (allowed as Record<string, unknown>)[k] = patch[k];
  return { ...cur, ...allowed, updatedAt: new Date().toISOString() };
}

export async function updateWord(id: string, patch: WordPatch): Promise<Word> {
  const s = await store();
  const cur = await s.get(id);
  if (!cur) throw new Error('Word not found');
  const next = applyPatch(cur, patch);
  await s.put(next);
  return next;
}

export async function deleteWord(id: string): Promise<void> {
  return (await store()).remove(id);
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
