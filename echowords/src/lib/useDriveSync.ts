import { useCallback, useEffect, useRef, useState } from 'react';
import { type CloudInfo } from './native';
import { driveAvailable, driveStatus, lastDriveSync, syncDriveNow } from './driveCopy';
import type { Library } from './useLibrary';

export interface DriveSync {
  available: boolean;
  info: CloudInfo;
  lastSync: string | null;
  syncing: boolean;
  error: string | null;
  refresh: () => void;
  syncNow: () => Promise<boolean>;
}

/** Keeps the Google Drive copy up to date: rewrites it a few seconds after every change. */
export function useDriveSync(lib: Library): DriveSync {
  const available = driveAvailable();
  const [info, setInfo] = useState<CloudInfo>(() => driveStatus());
  const [lastSync, setLastSync] = useState<string | null>(() => lastDriveSync());
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const again = useRef(false);

  const refresh = useCallback(() => {
    setInfo(driveStatus());
    setLastSync(lastDriveSync());
  }, []);

  const syncNow = useCallback(async () => {
    if (!driveStatus().linked) return false;
    if (running.current) {
      again.current = true; // one more round after the current one
      return true;
    }
    running.current = true;
    setSyncing(true);
    let ok = true;
    try {
      do {
        again.current = false;
        await syncDriveNow();
      } while (again.current);
      setError(null);
    } catch (e) {
      ok = false;
      setError(String((e as { code?: string })?.code ?? (e as Error)?.message ?? e));
    } finally {
      running.current = false;
      setSyncing(false);
      refresh();
    }
    return ok;
  }, [refresh]);

  // Any change to words or folders → sync 3 seconds later (several quick changes = one sync).
  const signature = `${lib.words.length}|${lib.words.reduce((m, w) => (w.updatedAt > m ? w.updatedAt : m), '')}|${lib.folders.map((f) => f.id + f.name + f.emoji).join(',')}`;
  const first = useRef(true);
  useEffect(() => {
    if (lib.loading) return;
    if (first.current) {
      first.current = false;
      return; // nothing changed yet
    }
    if (!available || !info.linked) return;
    const id = setTimeout(() => void syncNow(), 3000);
    return () => clearTimeout(id);
  }, [signature, lib.loading, available, info.linked, syncNow]);

  return { available, info, lastSync, syncing, error, refresh, syncNow };
}
