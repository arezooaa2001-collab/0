// Backup file: one JSON file with every word and its original audio (base64).
// Restoring checks every recording against its SHA-256 fingerprint.
import { fromBase64, sha256Hex, toBase64 } from './audio';
import { isNativeApp, nativeSaveFile } from './native';
import { type Folder, type Word, addWord, getAudio, getWord, listFolders, listWords, saveFolder } from './db';

const FORMAT = 'echowords-backup';

export async function buildBackup(): Promise<Blob> {
  const words = await listWords();
  const items = [];
  for (const w of words) {
    const audio = w.audioSha256 ? await getAudio(w.id) : null;
    items.push({ ...w, audio: audio ? toBase64(audio) : null });
  }
  const folders = await listFolders();
  return new Blob([JSON.stringify({ format: FORMAT, version: 2, exportedAt: new Date().toISOString(), folders, words: items })], {
    type: 'application/json',
  });
}

export function backupFileName(count: number): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `echowords-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}-${count}-words.json`;
}

// ── Automatic backup files ─────────────────────────────────────────────────
// A backup file in the Downloads folder survives things browser storage does not:
// clearing the browser, a new copy/version of the app, or a page that cannot keep data.

const META_KEY = 'echowords-backup-meta';
let memMeta: BackupMeta | null = null;

interface BackupMeta {
  lastAt: string;
  count: number;
  signature: string;
}

function readMeta(): BackupMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return JSON.parse(raw) as BackupMeta;
  } catch {
    /* storage blocked */
  }
  return memMeta;
}

function writeMeta(m: BackupMeta): void {
  memMeta = m;
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    /* storage blocked */
  }
}

export function lastBackupAt(): string | null {
  return readMeta()?.lastAt ?? null;
}

/** Fingerprint of the library's current state (changes whenever a word is added, edited or removed). */
export function librarySignature(words: Word[]): string {
  return `${words.length}:${words.reduce((m, w) => (w.updatedAt > m ? w.updatedAt : m), '')}`;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * When should the app save a backup file by itself?
 * - the page cannot keep data → after every change (otherwise it is lost when closed)
 * - otherwise: the first time, then at most once a week when something changed,
 *   or straight away after 25 new words — so the Downloads folder does not fill up.
 */
export function autoBackupDue(words: Word[], deviceStorage: boolean, now = Date.now()): boolean {
  if (!words.length) return false;
  const meta = readMeta();
  const sig = librarySignature(words);
  if (meta?.signature === sig) return false;
  if (!deviceStorage || !meta) return true;
  if (words.length - meta.count >= 25) return true;
  return now - new Date(meta.lastAt).getTime() >= WEEK_MS;
}

/** Build the backup and hand it to the browser as a download. Returns the file name. */
export async function downloadBackup(): Promise<string> {
  const words = await listWords();
  const blob = await buildBackup();
  const name = backupFileName(words.length);
  // Android app: the system «save as» screen (backups land where the family chooses, e.g. Downloads).
  if (isNativeApp()) {
    if (!(await nativeSaveFile(name, 'application/json', blob))) throw new Error('not saved');
    writeMeta({ lastAt: new Date().toISOString(), count: words.length, signature: librarySignature(words) });
    return name;
  }
  // Inside Claude, a page may only save files through the «downloads» capability.
  const use = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude?.use;
  if (typeof use === 'function') {
    const dl = (await use('downloads').catch(() => null)) as { save?: (r: { filename: string; data: Blob }) => Promise<unknown> } | null;
    if (dl?.save) {
      await dl.save({ filename: name, data: blob });
      writeMeta({ lastAt: new Date().toISOString(), count: words.length, signature: librarySignature(words) });
      return name;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  writeMeta({ lastAt: new Date().toISOString(), count: words.length, signature: librarySignature(words) });
  return name;
}

/** Restore words from a backup file. Existing words are kept; damaged entries are skipped. */
export async function restoreBackup(file: Blob): Promise<{ added: number; skipped: number }> {
  const data = JSON.parse(await file.text());
  if (data?.format !== FORMAT || !Array.isArray(data.words)) throw new Error('not_a_backup');
  let added = 0;
  let skipped = 0;
  const have = new Set((await listFolders()).map((f) => f.id));
  for (const f of (Array.isArray(data.folders) ? data.folders : []) as Folder[]) {
    if (typeof f?.id === 'string' && typeof f.name === 'string' && !have.has(f.id)) await saveFolder(f);
  }
  for (const item of data.words as (Word & { audio: string | null })[]) {
    try {
      if (typeof item?.id !== 'string') throw new Error('bad');
      if (await getWord(item.id)) {
        skipped++;
        continue;
      }
      const { audio: b64, ...word } = item;
      let bytes: ArrayBuffer | null = null;
      if (word.audioSha256) {
        if (typeof b64 !== 'string') throw new Error('missing audio');
        bytes = fromBase64(b64);
        if ((await sha256Hex(bytes)) !== word.audioSha256) throw new Error('damaged');
      }
      await addWord({ ...word, sttStatus: word.sttStatus === 'processing' ? 'pending' : word.sttStatus }, bytes);
      added++;
    } catch {
      skipped++;
    }
  }
  return { added, skipped };
}
