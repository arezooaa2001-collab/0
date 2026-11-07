import { useEffect, useRef, useState } from 'react';
import { backupFileName, buildBackup, restoreBackup } from '../lib/backup';
import { storageInfo } from '../lib/db';
import type { Accent } from '../lib/stt';
import { t } from '../lib/strings';
import type { Library } from '../lib/useLibrary';
import { useToast } from './Toast';

interface Props {
  lib: Library;
  accent: Accent;
  onAccent: (a: Accent) => void;
}

const ACCENTS: { value: Accent; label: string }[] = [
  { value: 'auto', label: t.accentAuto },
  { value: 'us', label: t.accentUS },
  { value: 'uk', label: t.accentUK },
];

export function SettingsScreen({ lib, accent, onAccent }: Props) {
  const toast = useToast();
  const [info, setInfo] = useState<{ persisted: boolean; usage: number | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    storageInfo().then(setInfo);
  }, [lib.words.length]);

  const exportBackup = async () => {
    setBusy(true);
    try {
      const blob = await buildBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast(t.backupDone, 'success');
    } catch {
      toast(t.errGeneric, 'error');
    } finally {
      setBusy(false);
    }
  };

  const importBackup = async (file: File) => {
    setBusy(true);
    try {
      const r = await restoreBackup(file);
      await lib.refresh();
      toast(t.backupRestored(r.added, r.skipped), 'success');
    } catch {
      toast(t.backupBad, 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const totalBytes = lib.words.reduce((s, w) => s + w.audioBytes, 0);
  const mb = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(totalBytes / 1024 / 1024);

  return (
    <section className="screen settings-screen">
      <h1 className="title">{t.settingsTitle}</h1>

      <div className="card">
        <h2>{t.storageTitle}</h2>
        <p className="state-title">{t.storageInfo(lib.words.length, mb)}</p>
        <p className="meta">{info?.persisted ? t.storageSafe : t.storageWarn}</p>
      </div>

      <div className="card">
        <h2>🗂️ {t.backupTitle}</h2>
        <p className="meta">{t.backupHelp}</p>
        <div className="row wrap">
          <button className="btn btn-primary" onClick={exportBackup} disabled={busy || !lib.words.length}>⬇️ {t.backupExport}</button>
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={busy}>⬆️ {t.backupImport}</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importBackup(f);
            }}
          />
        </div>
      </div>

      <div className="card">
        <h2>{t.accentTitle}</h2>
        <p className="meta">{t.accentHelp}</p>
        <div className="segmented" role="radiogroup" aria-label={t.accentTitle}>
          {ACCENTS.map((a) => (
            <button key={a.value} role="radio" aria-checked={accent === a.value} className={accent === a.value ? 'on' : ''} onClick={() => onAccent(a.value)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>🇬🇧 {t.englishOnlyTitle}</h2>
        <p>{t.englishOnlyBody}</p>
      </div>

      <div className="card">
        <h2>🔒 {t.privacyTitle}</h2>
        <p>{t.privacyBody}</p>
      </div>
    </section>
  );
}
