// In-app gallery and crash-safe recording storage (IndexedDB on this device).
// Video chunks are written while recording, so if the browser is closed or the device
// locks mid-recording, the footage is recovered the next time the app opens.
// Falls back to memory when IndexedDB is unavailable (e.g. some private windows).

const DB_NAME = 'camera-app';
const DB_VERSION = 1;

let db = null;
const memory = new Map();

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function tx(names, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(names, mode);
    let result;
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('aborted'));
    Promise.resolve(fn(t)).then((r) => { result = r; }, reject);
  });
}

export const store = {
  get persistent() { return !!db; },

  async init() {
    if (!('indexedDB' in window)) return false;
    try {
      db = await new Promise((resolve, reject) => {
        const open = indexedDB.open(DB_NAME, DB_VERSION);
        open.onupgradeneeded = () => {
          const d = open.result;
          if (!d.objectStoreNames.contains('media')) d.createObjectStore('media', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('chunks')) d.createObjectStore('chunks', { keyPath: ['rec', 'i'] });
          if (!d.objectStoreNames.contains('pending')) d.createObjectStore('pending', { keyPath: 'id' });
        };
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
        open.onblocked = () => reject(new Error('blocked'));
      });
      // Probe a write: some private modes open the DB but refuse to store blobs.
      await tx(['pending'], 'readwrite', (t) => req(t.objectStore('pending').put({ id: '__probe', blobTest: new Blob(['x']) })));
      await tx(['pending'], 'readwrite', (t) => req(t.objectStore('pending').delete('__probe')));
      try { navigator.storage?.persist?.(); } catch { /* optional */ }
      return true;
    } catch (err) {
      console.warn('IndexedDB unavailable, using memory', err);
      db = null;
      return false;
    }
  },

  async addMedia(item) {
    if (!db) { memory.set(item.id, item); return item; }
    try {
      await tx(['media'], 'readwrite', (t) => req(t.objectStore('media').put(item)));
    } catch (err) {
      memory.set(item.id, item);
      throw err;
    }
    return item;
  },

  async listMedia() {
    let items = [...memory.values()];
    if (db) {
      try { items = items.concat(await tx(['media'], 'readonly', (t) => req(t.objectStore('media').getAll()))); } catch { /* ignore */ }
    }
    return items.sort((a, b) => b.created - a.created);
  },

  async getMedia(id) {
    if (memory.has(id)) return memory.get(id);
    if (!db) return null;
    return tx(['media'], 'readonly', (t) => req(t.objectStore('media').get(id)));
  },

  async deleteMedia(id) {
    memory.delete(id);
    if (db) await tx(['media'], 'readwrite', (t) => req(t.objectStore('media').delete(id)));
  },

  async beginRecording(meta) {
    if (!db) return;
    try { await tx(['pending'], 'readwrite', (t) => req(t.objectStore('pending').put(meta))); } catch { /* best effort */ }
  },

  async addChunk(rec, i, blob) {
    if (!db) return;
    await tx(['chunks'], 'readwrite', (t) => req(t.objectStore('chunks').put({ rec, i, blob })));
  },

  async endRecording(rec) {
    if (!db) return;
    try {
      await tx(['chunks', 'pending'], 'readwrite', (t) => {
        t.objectStore('chunks').delete(IDBKeyRange.bound([rec, 0], [rec, Number.MAX_SAFE_INTEGER]));
        t.objectStore('pending').delete(rec);
      });
    } catch { /* best effort */ }
  },

  // Rebuilds recordings that were interrupted (page closed, device locked, crash).
  async recoverPending(makeThumb) {
    if (!db) return 0;
    let pending = [];
    try { pending = await tx(['pending'], 'readonly', (t) => req(t.objectStore('pending').getAll())); } catch { return 0; }
    let recovered = 0;
    for (const p of pending) {
      try {
        const chunks = await tx(['chunks'], 'readonly', (t) =>
          req(t.objectStore('chunks').getAll(IDBKeyRange.bound([p.id, 0], [p.id, Number.MAX_SAFE_INTEGER]))));
        if (chunks.length) {
          chunks.sort((a, b) => a.i - b.i);
          const blob = new Blob(chunks.map((c) => c.blob), { type: p.mime || 'video/webm' });
          let thumb = p.thumb || null;
          if (!thumb && makeThumb) { try { thumb = await makeThumb(blob); } catch { thumb = null; } }
          await this.addMedia({
            id: p.id, kind: 'video', mode: p.mode || 'video', mime: blob.type, blob, thumb,
            created: p.created || Date.now(), width: p.width, height: p.height,
            duration: chunks.length, size: blob.size, recovered: true,
          });
          recovered++;
        }
      } catch (err) {
        console.warn('recovery failed', err);
      }
      await this.endRecording(p.id);
    }
    return recovered;
  },
};
