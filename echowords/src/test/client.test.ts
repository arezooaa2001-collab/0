import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { baseMime, extensionFor, pickMimeType, resolveMime, rmsLevel, sha256Hex, sniffMime } from '../lib/audio';
import { formatDuration } from '../lib/format';
import * as outbox from '../lib/outbox';
import { validateEnglish, validateHint } from '../lib/validation';
import { audioPathFor } from '../lib/words';

describe('audio helpers', () => {
  it('picks the first supported recording format', () => {
    expect(pickMimeType((m) => m === 'audio/mp4')).toBe('audio/mp4');
    expect(pickMimeType((m) => m.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(pickMimeType(() => false)).toBeNull();
    expect(pickMimeType(undefined)).toBeNull();
    expect(pickMimeType(() => { throw new Error('x'); })).toBeNull();
  });

  it('maps MIME types to extensions and paths', () => {
    expect(baseMime('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(extensionFor('audio/mp4')).toBe('m4a');
    expect(audioPathFor('u1', 'w1', 'audio/webm;codecs=opus')).toBe('u1/w1.webm');
  });

  it('sniffs containers when the browser gives no type', () => {
    expect(sniffMime(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).toBe('audio/webm');
    expect(sniffMime(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]))).toBe('audio/mp4');
    expect(resolveMime('', null, new Uint8Array([0x4f, 0x67, 0x67, 0x53]))).toBe('audio/ogg');
    expect(resolveMime('audio/webm;codecs=opus', null)).toBe('audio/webm');
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
    expect(validateEnglish("don't").ok).toBe(true);
    expect(validateEnglish('Wi-Fi & café!').ok).toBe(true);
  });
  it('rejects Persian or empty text', () => {
    expect(validateEnglish('سیب').ok).toBe(false);
    expect(validateEnglish('apple سیب').ok).toBe(false);
    expect(validateEnglish('   ').ok).toBe(false);
    expect(validateEnglish('123').ok).toBe(false);
  });
  it('allows an empty hint', () => {
    expect(validateHint('')).toEqual({ ok: true, value: null });
  });
});

describe('format', () => {
  it('shows Persian digits', () => {
    expect(formatDuration(5300)).toBe('۰:۰۵');
    expect(formatDuration(65_000)).toBe('۱:۰۵');
  });
});

describe('outbox (IndexedDB)', () => {
  it('keeps exact bytes until removed', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 250]);
    const blob = new Blob([bytes], { type: 'audio/webm' });
    const item = {
      id: 'w1', userId: 'u1', blob, mimeType: 'audio/webm', durationMs: 1200, accent: 'us' as const,
      hint: 'apple', sha256: await sha256Hex(blob), createdAt: new Date().toISOString(), attempts: 0, lastError: null,
    };
    await outbox.putItem(item);
    const [got] = await outbox.listItems('u1');
    expect(got.id).toBe('w1');
    expect(new Uint8Array(await got.blob.arrayBuffer())).toEqual(bytes);
    expect(await sha256Hex(got.blob)).toBe(item.sha256);
    expect(await outbox.listItems('someone-else')).toHaveLength(0);
    await outbox.markAttempt('w1', 'offline');
    expect((await outbox.getItem('w1'))?.attempts).toBe(1);
    await outbox.removeItem('w1');
    expect(await outbox.listItems('u1')).toHaveLength(0);
  });
});
