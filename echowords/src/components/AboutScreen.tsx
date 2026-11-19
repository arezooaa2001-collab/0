import { useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '../lib/config';
import { MUSIC_DROP_S, type MusicHandle, musicEnabled, playIntroMusic, setMusicEnabled } from '../lib/introMusic';
import { GUIDE, GUIDE_INTRO } from '../lib/guide';
import { fa, t } from '../lib/strings';
import { AmirAbc, LogoMark } from './Brand';

/** When the guide follows the intro (without music; with music, at the music's drop). */
const INTRO_MS = 4000;

/**
 * «ℹ️ توضیحات»: «AMIR ABC» fades in from faint to bright, then the guide to the whole app,
 * and at the end the logo with its name and «منتظر برنامه‌های دیگر ما باشید...».
 */
export function AboutScreen({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<'intro' | 'guide'>('intro');
  const [outroSeen, setOutroSeen] = useState(false);
  const [musicOn, setMusicOn] = useState(musicEnabled);
  const outroRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const music = useRef<MusicHandle | null>(null);
  const introTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const toGuideIn = (ms: number) => {
    clearTimeout(introTimer.current);
    introTimer.current = setTimeout(() => setPhase('guide'), ms);
  };
  const startMusic = (syncDrop: boolean) => {
    music.current?.stop(0.1);
    // the guide appears exactly at the music's drop
    music.current = playIntroMusic(() => {
      if (syncDrop && phaseRef.current === 'intro') toGuideIn(MUSIC_DROP_S * 1000);
    });
  };

  // The intro: «AMIR ABC» fades in with the music; the guide follows at the drop.
  useEffect(() => {
    toGuideIn(INTRO_MS);
    if (musicEnabled()) startMusic(true);
    return () => {
      clearTimeout(introTimer.current);
      music.current?.stop();
      music.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMusic = () => {
    const on = !musicOn;
    setMusicOn(on);
    setMusicEnabled(on);
    if (on) startMusic(false);
    else {
      music.current?.stop();
      music.current = null;
    }
  };

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The closing logo appears (faint → bright) when the reader reaches the end of the guide.
  useEffect(() => {
    if (phase !== 'guide' || !outroRef.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setOutroSeen(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setOutroSeen(true);
    }, { threshold: 0.25 });
    io.observe(outroRef.current);
    return () => io.disconnect();
  }, [phase]);

  return (
    <div className="about" role="dialog" aria-modal="true" aria-label={t.aboutTitle}>
      <div className="welcome-stars" aria-hidden />
      <div className="about-head">
        <button ref={closeRef} className="welcome-skip about-close" onClick={onClose}>✖ {t.aboutClose}</button>
        <button className="welcome-skip about-music" onClick={toggleMusic} aria-pressed={musicOn} aria-label={musicOn ? t.aboutMusicOff : t.aboutMusicOn}>
          {musicOn ? '🔊' : '🔇'} {t.aboutMusic}
        </button>
      </div>

      {phase === 'intro' ? (
        <button className="about-intro" onClick={() => setPhase('guide')} aria-label={t.aboutSkipIntro}>
          <AmirAbc className="about-intro-amir" />
          <span className="about-intro-fa">{t.appName}</span>
        </button>
      ) : (
        <div className="about-scroll">
          <div className="about-guide">
            <h1 className="about-title">ℹ️ {t.aboutTitle}</h1>
            <p className="about-lead">{GUIDE_INTRO}</p>
            {GUIDE.map((s) => (
              <section key={s.title} className="about-card">
                <h2>
                  <span aria-hidden>{s.icon}</span> {s.title}
                </h2>
                <ul>
                  {s.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </section>
            ))}
            <p className="about-version">{t.aboutVersion(fa(APP_VERSION))}</p>

            <div ref={outroRef} className={`about-outro${outroSeen ? ' seen' : ''}`}>
              <LogoMark size={200} className="about-outro-logo" />
              <AmirAbc className="about-outro-amir" />
              <span className="welcome-fa about-outro-fa">{t.appName}</span>
              <p className="about-soon">{t.aboutSoon}</p>
              <button className="btn btn-primary btn-big" onClick={onClose}>↩️ {t.aboutBack}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
