// Local "outbox" for recordings that are not yet confirmed in the cloud.
// This is NOT the library — the library lives in the cloud. The outbox only makes sure that a
// recording survives a lost connection, a closed tab or a crash between "Save" and the
// cloud confirming the upload. Items are removed only after the cloud copy is verified.

import type { Accent } from '../../supabase/functions/_shared/stt';

export interface OutboxItem {
  id: string;
  userId: string;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  accent: Accent;
  hint: string | null;
  sha256: string;
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

const DB_NAME = 'echowords-outbox';
const STORE = 'pending';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('userId', 'userId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const req = fn(transaction.objectStore(STORE));
      let result: T;
      req.onsuccess = () => (result = req.result);
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error ?? req.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    });
  } finally {
    db.close();
  }
}

export async function putItem(item: OutboxItem): Promise<void> {
  // Store the bytes as an ArrayBuffer: more reliable than Blob across older mobile browsers.
  const bytes = await item.blob.arrayBuffer();
  await tx('readwrite', (s) => s.put({ ...item, blob: undefined, bytes }));
}

function revive(raw: Record<string, unknown>): OutboxItem {
  const { bytes, ...rest } = raw as Record<string, unknown> & { bytes: ArrayBuffer };
  return { ...(rest as unknown as OutboxItem), blob: new Blob([bytes], { type: rest.mimeType as string }) };
}

export async function listItems(userId: string): Promise<OutboxItem[]> {
  const rows = await tx('readonly', (s) => s.index('userId').getAll(userId));
  return (rows as Record<string, unknown>[]).map(revive).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getItem(id: string): Promise<OutboxItem | null> {
  const row = await tx('readonly', (s) => s.get(id));
  return row ? revive(row as Record<string, unknown>) : null;
}

export async function markAttempt(id: string, error: string | null): Promise<void> {
  const item = await getItem(id);
  if (!item) return;
  await putItem({ ...item, attempts: item.attempts + 1, lastError: error });
}

export async function removeItem(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}
