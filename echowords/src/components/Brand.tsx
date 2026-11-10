import { useEffect, useState } from 'react';
import markSvg from '../brand/mark.svg?raw';
import { t } from '../lib/strings';

/** The rainbow AMIR ABC mark (static SVG made by scripts/make-logo.cjs). */
export function LogoMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return <span className={`logo-mark ${className}`} style={{ width: size, height: size }} aria-hidden dangerouslySetInnerHTML={{ __html: markSvg }} />;
}

/** "AMIR ABC" with every letter the same size, in the logo's own colours. */
export function AmirAbc({ className = '' }: { className?: string }) {
  const amir: [string, string][] = [
    ['A', '#ff5459'],
    ['M', '#ff8a40'],
    ['I', '#00e676'],
    ['R', '#c6ff00'],
  ];
  return (
    <span className={`amir-abc ${className}`} dir="ltr" lang="en" aria-label="AMIR ABC">
      {amir.map(([c, col], i) => (
        <span key={i} style={{ color: col }}>{c}</span>
      ))}
      <span className="amir-gap" />
      {['A', 'B', 'C'].map((c) => (
        <span key={c} className="amir-gold">{c}</span>
      ))}
    </span>
  );
}

const WELCOMED = 'echowords-welcomed';

function alreadyWelcomed(): boolean {
  try {
    return localStorage.getItem(WELCOMED) === '1';
  } catch {
    return true; // storage blocked: do not show it on every visit
  }
}

/**
 * First launch only: «تبریک! …خوش آمدید» on a starry background.
 * Fades out by itself after 3 seconds; a «رد کردن» button appears after 1 second.
 */
export function WelcomeSplash() {
  const [show, setShow] = useState(() => !alreadyWelcomed());
  const [canSkip, setCanSkip] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    try {
      localStorage.setItem(WELCOMED, '1');
    } catch {
      /* ignore */
    }
    const skipTimer = setTimeout(() => setCanSkip(true), 1000);
    const fadeTimer = setTimeout(() => setLeaving(true), 3000);
    return () => {
      clearTimeout(skipTimer);
      clearTimeout(fadeTimer);
    };
  }, [show]);

  useEffect(() => {
    if (!leaving) return;
    const id = setTimeout(() => setShow(false), 650);
    return () => clearTimeout(id);
  }, [leaving]);

  if (!show) return null;
  return (
    <div className={`welcome${leaving ? ' leaving' : ''}`} role="dialog" aria-modal="true" aria-label={t.welcomeText}>
      <div className="welcome-stars" aria-hidden />
      {canSkip && !leaving && (
        <button className="welcome-skip" onClick={() => setLeaving(true)}>
          {t.welcomeSkip} ⏭️
        </button>
      )}
      <div className="welcome-body">
        <LogoMark size={220} className="welcome-logo" />
        <p className="welcome-congrats">🎉 {t.welcomeCongrats}</p>
        <p className="welcome-text">
          {t.welcomeTo} <AmirAbc className="welcome-amir" /> <span className="welcome-fa">{t.appName}</span>
          {t.welcomeEnd}
        </p>
      </div>
    </div>
  );
}
