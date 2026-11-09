import { useEffect, useState } from 'react';
import { type MicPermission, micPermission, requestMicrophone } from '../lib/mic';
import { downloadBackup, lastBackupAt } from '../lib/backup';
import { formatDate } from '../lib/format';
import type { Accent } from '../lib/stt';
import { t } from '../lib/strings';
import type { Library } from '../lib/useLibrary';
import { AiSettingsCard } from './AiSettingsCard';
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
  const [mic, setMic] = useState<MicPermission>('unknown');
  const [micMsg, setMicMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    void micPermission().then(setMic);
  }, []);

  const askMic = async () => {
    const problem = await requestMicrophone();
    setMicMsg(problem ? { ok: false, text: problem } : { ok: true, text: t.micOk });
    setMic(await micPermission());
  };

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

  const totalBytes = lib.words.reduce((s, w) => s + (w.audioBytes ?? 0), 0);
  const nf = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
  const mb = totalBytes < 1024 * 1024 ? `${nf.format(Math.max(1, Math.round(totalBytes / 1024)))} کیلوبایت` : `${nf.format(totalBytes / 1024 / 1024)} مگابایت`;
  const health = lib.health;

  return (
    <section className="screen settings-screen">
      <h1 className="title">{t.settingsTitle}</h1>

      <div className="card">
        <h2>{t.micTitle}</h2>
        <p className="meta">{t.micHelp}</p>
        {mic !== 'unknown' && (
          <p className="meta">{mic === 'granted' ? t.micStateGranted : mic === 'denied' ? t.micStateDenied : t.micStatePrompt}</p>
        )}
        <button className="btn btn-primary" onClick={askMic}>🎙️ {t.micAsk}</button>
        {micMsg && <p className={`msg ${micMsg.ok ? 'msg-success' : 'msg-error'}`} role="status">{micMsg.text}</p>}
      </div>

      <div className="card">
        <h2>🌍 {t.englishOnlyTitle}</h2>
        <p>{t.allLangsInfo}</p>
      </div>

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
        <h2>🇬🇧 {t.accentTitle}</h2>
        <p className="meta">{t.accentHelp}</p>
        <div className="segmented" role="radiogroup" aria-label={t.accentTitle}>
          {ACCENTS.map((a) => (
            <button key={a.value} role="radio" aria-checked={accent === a.value} className={accent === a.value ? 'on' : ''} onClick={() => onAccent(a.value)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>



      <AiSettingsCard />

      <div className="card">
        <h2>🔒 {t.privacyTitle}</h2>
        <p>{t.privacyBody}</p>
      </div>
    </section>
  );
}
