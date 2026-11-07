import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { baseMime, extensionFor, pickMimeType, resolveMime, rmsLevel, sha256Hex, sniffMime } from '../lib/audio';
import { buildBackup, restoreBackup } from '../lib/backup';
import * as db from '../lib/db';
import { formatDuration } from '../lib/format';
import { validateEnglish, validateHint } from '../lib/validation';

describe('audio helpers', () => {
  it('picks the first supported recording format', () => {
    expect(pickMimeType((m) => m === 'audio/mp4')).toBe('audio/mp4');
    expect(pickMimeType((m) => m.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(pickMimeType(() => false)).toBeNull();
    expect(pickMimeType(undefined)).toBeNull();
    expect(pickMimeType(() => { throw new Error('x'); })).toBeNull();
  });
  it('maps MIME types', () => {
    expect(baseMime('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(extensionFor('audio/mp4')).toBe('m4a');
  });
  it('sniffs containers when the browser gives no type', () => {
    expect(sniffMime(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).toBe('audio/webm');
    expect(sniffMime(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]))).toBe('audio/mp4');
    expect(resolveMime('', null, new Uint8Array([0x4f, 0x67, 0x67, 0x53]))).toBe('audio/ogg');
  });
  it('measures RMS level', () => {
    expect(rmsLevel(new Uint8Array(64).fill(128))).toBe(0);
    expect(rmsLevel(new Uint8Array(64).fill(255))).toBeGreaterThan(0.9);
  });
  it('hashes bytes with SHA-256', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc').buffer as ArrayBuffer)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('validation', () => {
  it('accepts English', () => {
    expect(validateEnglish('  I am   learning English. ')).toEqual({ ok: true, value: 'I am learning English.' });
    expect(validateEnglish('Wi-Fi & café!').ok).toBe(true);
  });
  it('rejects Persian or empty text', () => {
    expect(validateEnglish('سیب').ok).toBe(false);
    expect(validateEnglish('apple سیب').ok).toBe(false);
    expect(validateEnglish('   ').ok).toBe(false);
  });
  it('allows an empty hint', () => {
    expect(validateHint('')).toEqual({ ok: true, value: null });
  });
});

describe('format', () => {
  it('shows Persian digits', () => {
    expect(formatDuration(5300)).toBe('۰:۰۵');
  });
});

function makeWord(id: string, bytes: ArrayBuffer, sha: string): db.Word {
  const now = new Date().toISOString();
  return {
    id, createdAt: now, updatedAt: now, durationMs: 1200, audioMime: 'audio/webm', audioBytes: bytes.byteLength, audioSha256: sha,
    accent: 'us', hint: 'apple', transcript: null, transcriptEdited: false, sttStatus: 'pending', sttHeard: null, sttReason: null, favorite: false,
  };
}

describe('on-device library (IndexedDB)', () => {
  it('stores exact audio bytes and protects them from updates', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 250]).buffer;
    const sha = await sha256Hex(bytes);
    await db.addWord(makeWord('w1', bytes, sha), bytes);
    expect(await sha256Hex((await db.getAudio('w1'))!)).toBe(sha);

    const updated = await db.updateWord('w1', { transcript: 'Apple', transcriptEdited: true, audioSha256: 'x' } as never);
    expect(updated.transcript).toBe('Apple');
    expect(updated.audioSha256).toBe(sha); // audio fields cannot be patched
    expect((await db.listWords()).map((w) => w.id)).toEqual(['w1']);
  });

  it('round-trips a backup file and verifies fingerprints', async () => {
    const backup = await buildBackup();
    await db.deleteWord('w1');
    expect(await db.getAudio('w1')).toBeNull();
    expect(await restoreBackup(backup)).toEqual({ added: 1, skipped: 0 });
    expect((await db.getWord('w1'))?.transcript).toBe('Apple');
    expect(new Uint8Array((await db.getAudio('w1'))!)).toEqual(new Uint8Array([1, 2, 3, 4, 5, 250]));
    expect(await restoreBackup(backup)).toEqual({ added: 0, skipped: 1 }); // no duplicates

    const damaged = JSON.parse(await backup.text());
    damaged.words[0].id = 'w2';
    damaged.words[0].audio = btoa('tampered');
    expect(await restoreBackup(new Blob([JSON.stringify(damaged)]))).toEqual({ added: 0, skipped: 1 });
    await expect(restoreBackup(new Blob(['{"hello":1}']))).rejects.toThrow();
  });
});

describe('automatic backup rules', () => {
  const w = (id: string, updatedAt: string) => ({ ...makeWord(id, new ArrayBuffer(1), 'x'), updatedAt });
  it('is never due for an empty library', async () => {
    const { autoBackupDue } = await import('../lib/backup');
    expect(autoBackupDue([], true)).toBe(false);
  });
  it('is due the first time, then not again until something changes', async () => {
    localStorage.clear();
    const { autoBackupDue, librarySignature } = await import('../lib/backup');
    const words = [w('a', '2026-01-01T00:00:00Z')];
    expect(autoBackupDue(words, true)).toBe(true);
    localStorage.setItem('echowords-backup-meta', JSON.stringify({ lastAt: new Date().toISOString(), count: 1, signature: librarySignature(words) }));
    expect(autoBackupDue(words, true)).toBe(false); // nothing changed
    const more = [...words, w('b', '2026-01-02T00:00:00Z')];
    expect(autoBackupDue(more, true)).toBe(false); // changed, but backed up less than a day ago
    expect(autoBackupDue(more, true, Date.now() + 25 * 3600 * 1000)).toBe(true); // a day later
    expect(autoBackupDue(more, false)).toBe(true); // page cannot keep data: every change
    const ten = Array.from({ length: 11 }, (_, i) => w(`n${i}`, `2026-02-0${(i % 9) + 1}T00:00:00Z`));
    expect(autoBackupDue(ten, true)).toBe(true); // 10+ new words: right away
  });
});

describe('page that cannot keep data', () => {
  it('falls back to memory instead of failing', async () => {
    const saved = globalThis.indexedDB;
    // @ts-expect-error simulate a browser/viewer without IndexedDB
    delete globalThis.indexedDB;
    db._resetStorageCheck();
    try {
      expect((await db.checkStorage()).mode).toBe('memory');
      const bytes = new Uint8Array([9, 8, 7]).buffer;
      await db.addWord(makeWord('m1', bytes, await sha256Hex(bytes)), bytes);
      expect((await db.listWords()).map((x) => x.id)).toEqual(['m1']);
      expect(new Uint8Array((await db.getAudio('m1'))!)).toEqual(new Uint8Array([9, 8, 7]));
    } finally {
      globalThis.indexedDB = saved;
      db._resetStorageCheck();
    }
    expect((await db.checkStorage()).mode).toBe('device');
  });
});
