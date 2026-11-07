import { useState } from 'react';
import { downloadBackup, lastBackupAt } from '../lib/backup';
import { formatDate } from '../lib/format';
import type { Accent } from '../lib/stt';
import { t } from '../lib/strings';
import type { Library } from '../lib/useLibrary';
import { RestoreButton } from './RestoreButton';
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
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(lastBackupAt);

  const exportBackup = async () => {
    setBusy(true);
    try {
      await downloadBackup();
      setLast(lastBackupAt());
      toast(t.backupDone, 'success');
    } catch {
      toast(t.errGeneric, 'error');
    } finally {
      setBusy(false);
    }
  };

  const totalBytes = lib.words.reduce((s, w) => s + w.audioBytes, 0);
  const mb = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(totalBytes / 1024 / 1024);
  const health = lib.health;

  return (
    <section className="screen settings-screen">
      <h1 className="title">{t.settingsTitle}</h1>

      <div className="card">
        <h2>{t.storageTitle}</h2>
        <p className="state-title">{t.storageInfo(lib.words.length, mb)}</p>
        {health?.mode === 'memory' ? (
          <p className="msg msg-error">{t.storageBlocked}</p>
        ) : health?.persisted ? (
          <p className="meta">{t.storageSafe}</p>
        ) : (
          <p className="meta">{t.storageWarn}</p>
        )}
      </div>

      <div className="card">
        <h2>🗂️ {t.backupTitle}</h2>
        <p className="meta">{t.backupHelp}</p>
        <p className="meta">{last ? t.lastBackup(formatDate(last)) : t.noBackupYet}</p>
        <div className="row wrap">
          <button className="btn btn-primary" onClick={exportBackup} disabled={busy || !lib.words.length}>⬇️ {t.backupExport}</button>
          <RestoreButton lib={lib} />
        </div>
        <p className="meta">{t.backupKeepSafe}</p>
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
