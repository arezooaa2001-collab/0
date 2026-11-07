// Backup file: one JSON file with every word and its original audio (base64).
// Restoring checks every recording against its SHA-256 fingerprint.
import { sha256Hex } from './audio';
import { type Word, addWord, getAudio, getWord, listWords } from './db';

const FORMAT = 'echowords-backup';

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): ArrayBuffer {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out.buffer;
}

export async function buildBackup(): Promise<Blob> {
  const words = await listWords();
  const items = [];
  for (const w of words) {
    const audio = await getAudio(w.id);
    if (audio) items.push({ ...w, audio: toBase64(audio) });
  }
  return new Blob([JSON.stringify({ format: FORMAT, version: 1, exportedAt: new Date().toISOString(), words: items })], {
    type: 'application/json',
  });
}

export function backupFileName(): string {
  return `echowords-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

/** Restore words from a backup file. Existing words are kept; damaged entries are skipped. */
export async function restoreBackup(file: Blob): Promise<{ added: number; skipped: number }> {
  const data = JSON.parse(await file.text());
  if (data?.format !== FORMAT || !Array.isArray(data.words)) throw new Error('not_a_backup');
  let added = 0;
  let skipped = 0;
  for (const item of data.words as (Word & { audio: string })[]) {
    try {
      if (typeof item?.id !== 'string' || typeof item.audio !== 'string') throw new Error('bad');
      if (await getWord(item.id)) {
        skipped++;
        continue;
      }
      const bytes = fromBase64(item.audio);
      if ((await sha256Hex(bytes)) !== item.audioSha256) throw new Error('damaged');
      const { audio: _audio, ...word } = item;
      void _audio;
      await addWord({ ...word, sttStatus: word.sttStatus === 'processing' ? 'pending' : word.sttStatus }, bytes);
      added++;
    } catch {
      skipped++;
    }
  }
  return { added, skipped };
}
