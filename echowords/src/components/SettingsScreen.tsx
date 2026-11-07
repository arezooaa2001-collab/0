import { useState } from 'react';
import type { Accent } from '../../supabase/functions/_shared/stt';
import { t } from '../lib/strings';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  email: string;
  accent: Accent;
  onAccent: (a: Accent) => void;
  onLogout: () => void;
  /** Present only when the cloud connection was entered on this device. */
  onResetCloud?: () => void;
}

const ACCENTS: { value: Accent; label: string }[] = [
  { value: 'auto', label: t.accentAuto },
  { value: 'us', label: t.accentUS },
  { value: 'uk', label: t.accentUK },
];

export function SettingsScreen({ email, accent, onAccent, onLogout, onResetCloud }: Props) {
  const [confirm, setConfirm] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <section className="screen settings-screen">
      <h1 className="title">{t.settingsTitle}</h1>

      <div className="card">
        <h2>{t.accentTitle}</h2>
        <p className="meta">{t.accentHelp}</p>
        <div className="segmented" role="radiogroup" aria-label={t.accentTitle}>
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              role="radio"
              aria-checked={accent === a.value}
              className={accent === a.value ? 'on' : ''}
              onClick={() => onAccent(a.value)}
            >
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

      <div className="card">
        <h2>{t.account}</h2>
        <p dir="ltr" className="email">{email}</p>
        <div className="row wrap">
          <button className="btn btn-ghost" onClick={() => setConfirm(true)}>🚪 {t.logout}</button>
          {onResetCloud && (
            <button className="btn btn-ghost" onClick={() => setConfirmReset(true)}>🛠️ {t.setupChange}</button>
          )}
        </div>
      </div>

      {confirmReset && onResetCloud && (
        <ConfirmDialog
          message={t.setupChangeConfirm}
          confirmLabel={t.ok}
          onConfirm={onResetCloud}
          onCancel={() => setConfirmReset(false)}
        />
      )}

      {confirm && (
        <ConfirmDialog
          message={t.logoutConfirm}
          confirmLabel={t.logout}
          onConfirm={() => {
            setConfirm(false);
            onLogout();
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </section>
  );
}
