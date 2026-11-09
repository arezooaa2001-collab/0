// When the app runs inside Claude (claude.ai), words and folders are ALSO kept in the
// viewer's private Claude storage (`data/users/<id>/…`, readable only by that person).
// That copy survives clearing the browser and follows the learner to other devices.
// Recordings stay on the device (Claude storage holds text only); inside Claude words are typed anyway.
import type { Folder, Word } from './db';

interface DocSnap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface DocRef {
  set(d: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
}
interface CollRef {
  doc(id: string): DocRef;
  get(): Promise<{ docs: DocSnap[] }>;
}
interface ClaudeDb {
  collection(path: string): CollRef;
}

type Use = (name: string) => Promise<unknown>;

let ready: Promise<CollRef | null> | null = null;

/** The learner's private collection inside Claude, or null outside Claude. */
export function claudeCollection(): Promise<CollRef | null> {
  if (!ready) {
    const use = (window as unknown as { claude?: { use?: Use } }).claude?.use;
    ready =
      typeof use !== 'function'
        ? Promise.resolve(null)
        : (async () => {
            try {
              const [db, user] = (await Promise.all([use('db'), use('user')])) as [ClaudeDb | null, { id?: () => Promise<string | null> } | null];
              const uid = db && user?.id ? await user.id() : null;
              return db && uid ? db.collection(`data/users/${uid}`) : null;
            } catch {
              return null;
            }
          })();
  }
  return ready;
}

const wordKey = (id: string) => `w_${id}`;
const folderKey = (id: string) => `f_${id}`;

/** Text-only copy of a word (recordings are not uploaded). */
function wordBody(w: Word): Record<string, unknown> {
  const { durationMs: _d, audioMime: _m, audioBytes: _b, audioSha256: _s, ...rest } = w;
  void _d;
  void _m;
  void _b;
  void _s;
  return { kind: 'word', ...rest, folderId: w.folderId ?? null, lang: w.lang ?? null };
}

// One write at a time per document (Claude storage asks for this): chain writes per key.
const chains = new Map<string, Promise<void>>();

function quietly(key: string, fn: (c: CollRef) => Promise<void>): Promise<void> {
  const prev = chains.get(key) ?? Promise.resolve();
  const next = prev.then(async () => {
    try {
      const c = await claudeCollection();
      if (c) await fn(c);
    } catch (e) {
      console.warn('Claude storage sync failed (the device copy is still saved)', e);
    }
  });
  chains.set(key, next);
  void next.then(() => {
    if (chains.get(key) === next) chains.delete(key);
  });
  return next;
}

export const pushWord = (w: Word) => quietly(wordKey(w.id), (c) => c.doc(wordKey(w.id)).set(wordBody(w)));
export const removeWordRemote = (id: string) => quietly(wordKey(id), (c) => c.doc(wordKey(id)).delete());
export const pushFolder = (f: Folder) => quietly(folderKey(f.id), (c) => c.doc(folderKey(f.id)).set({ kind: 'folder', ...f }));
export const removeFolderRemote = (id: string) => quietly(folderKey(id), (c) => c.doc(folderKey(id)).delete());

export interface RemoteState {
  words: Word[];
  folders: Folder[];
}

/** Everything stored in Claude for this learner (null outside Claude or on error). */
export async function pullRemote(): Promise<RemoteState | null> {
  try {
    const c = await claudeCollection();
    if (!c) return null;
    const snap = await c.get();
    const words: Word[] = [];
    const folders: Folder[] = [];
    for (const d of snap.docs) {
      const v = d.data();
      if (!v) continue;
      if (v.kind === 'folder' && typeof v.id === 'string') folders.push(v as unknown as Folder);
      if (v.kind === 'word' && typeof v.id === 'string') {
        const { kind: _k, ...w } = v;
        void _k;
        words.push({ ...(w as unknown as Word), durationMs: null, audioMime: null, audioBytes: null, audioSha256: null });
      }
    }
    return { words, folders };
  } catch (e) {
    console.warn('Could not read Claude storage', e);
    return null;
  }
}
