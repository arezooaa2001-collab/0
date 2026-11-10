import { useState } from 'react';
import { formatDate } from '../lib/format';
import { DriveError, isGoogleDrive, linkDrive, restoreFromDrive, unlinkDrive } from '../lib/driveCopy';
import { t } from '../lib/strings';
import type { DriveSync } from '../lib/useDriveSync';
import type { Library } from '../lib/useLibrary';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from './Toast';

const driveErrorText = (e: unknown) => {
  const code = e instanceof DriveError ? e.code : '';
  if (code === 'cancelled') return t.driveCancelled;
  if (code === 'read-only') return t.driveReadOnly;
  if (code === 'no-picker') return t.driveNoPicker;
  return t.driveFailed;
};

/** «حساب گوگل»: keep a full copy (words + recordings) in the family's Google Drive. */
export function DriveCard({ lib, drive, compact }: { lib: Library; drive: DriveSync; compact?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  if (!drive.available) {
    return compact ? null : (
      <div className="card">
        <h2>{t.driveTitle}</h2>
        <p className="meta">{t.driveOnlyInApp}</p>
      </div>
    );
  }

  const link = async () => {
    setBusy(true);
    try {
      await linkDrive();
      drive.refresh();
      toast(t.driveLinked, 'success');
    } catch (e) {
      toast(driveErrorText(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      const r = await restoreFromDrive();
      await lib.refresh();
      drive.refresh();
      toast(t.backupRestored(r.added, r.skipped), 'success');
    } catch (e) {
      toast(e instanceof DriveError ? driveErrorText(e) : t.backupBad, 'error');
    } finally {
      setBusy(false);
    }
  };

  const restoreButton = (
    <button className={`btn btn-secondary${compact ? ' btn-big wide' : ''}`} onClick={restore} disabled={busy}>
      ⬇️ {t.driveRestore}
    </button>
  );
  if (compact) return restoreButton;

  const { info } = drive;
  return (
    <div className="card drive-card">
      <h2>{t.driveTitle}</h2>
      {info.linked ? (
        <>
          <p className="msg msg-success">
            ✅ {isGoogleDrive(info.authority) ? t.driveLinkedTo : t.driveLinkedOther} <b dir="ltr">{info.name}</b>
          </p>
          {!isGoogleDrive(info.authority) && <p className="meta">{t.driveNotDriveWarn}</p>}
          <p className="meta">
            {drive.syncing ? t.driveSyncing : drive.lastSync ? t.driveLastSync(formatDate(drive.lastSync), new Date(drive.lastSync).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })) : ''}
          </p>
          {drive.error && <p className="msg msg-error">{t.driveSyncError}</p>}
          <div className="row wrap">
            <button className="btn btn-primary" onClick={() => void drive.syncNow().then((ok) => toast(ok ? t.driveSynced : t.driveSyncError, ok ? 'success' : 'error'))} disabled={busy || drive.syncing}>
              🔄 {t.driveSyncNow}
            </button>
            {restoreButton}
            <button className="btn btn-ghost" onClick={() => setConfirmUnlink(true)} disabled={busy}>
              {t.driveUnlink}
            </button>
          </div>
        </>
      ) : (
        <>
          <p>{t.driveHelp}</p>
          <ol className="drive-steps">
            <li>{t.driveStep1}</li>
            <li>{t.driveStep2}</li>
            <li>{t.driveStep3}</li>
          </ol>
          <div className="row wrap">
            <button className="btn btn-primary btn-big" onClick={link} disabled={busy}>
              ☁️ {t.driveLink}
            </button>
            {restoreButton}
          </div>
          <p className="meta">{t.driveRestoreHelp}</p>
        </>
      )}
      {confirmUnlink && (
        <ConfirmDialog
          message={t.driveUnlinkConfirm}
          confirmLabel={t.driveUnlink}
          onConfirm={() => {
            setConfirmUnlink(false);
            unlinkDrive();
            drive.refresh();
          }}
          onCancel={() => setConfirmUnlink(false)}
        />
      )}
    </div>
  );
}
