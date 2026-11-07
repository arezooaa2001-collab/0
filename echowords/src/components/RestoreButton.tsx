import { useRef, useState } from 'react';
import { restoreBackup } from '../lib/backup';
import { t } from '../lib/strings';
import type { Library } from '../lib/useLibrary';
import { useToast } from './Toast';

/** Pick a backup file (echowords-backup-….json) and bring its words back. */
export function RestoreButton({ lib, big }: { lib: Library; big?: boolean }) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const restore = async (file: File) => {
    setBusy(true);
    try {
      const r = await restoreBackup(file);
      await lib.refresh();
      toast(t.backupRestored(r.added, r.skipped), 'success');
    } catch {
      toast(t.backupBad, 'error');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <>
      <button className={`btn btn-secondary${big ? ' btn-big wide' : ''}`} onClick={() => ref.current?.click()} disabled={busy}>
        ⬆️ {t.backupImport}
      </button>
      <input
        ref={ref}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void restore(f);
        }}
      />
    </>
  );
}
