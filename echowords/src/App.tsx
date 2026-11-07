import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import type { Accent } from '../supabase/functions/_shared/stt';
import { AuthScreen } from './components/AuthScreen';
import { SetupScreen } from './components/SetupScreen';
import { LibraryScreen } from './components/LibraryScreen';
import { RecordScreen } from './components/RecordScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { useToast } from './components/Toast';
import { clearRuntimeConfig, isConfigured, isRuntimeConfigured } from './lib/config';
import { stopPlayback } from './lib/player';
import { accentFromMetadata, readLocalAccent, saveAccent } from './lib/settings';
import { t } from './lib/strings';
import { supabase } from './lib/supabase';
import { useLibrary } from './lib/useLibrary';
import { clearAudioCache } from './lib/words';

type Tab = 'record' | 'library' | 'settings';

function Home({ session }: { session: Session }) {
  const toast = useToast();
  const user = session.user;
  const lib = useLibrary(user.id);
  const [tab, setTab] = useState<Tab>('record');
  const [accent, setAccent] = useState<Accent>(() => accentFromMetadata(user.user_metadata) ?? readLocalAccent());

  const changeAccent = (a: Accent) => {
    setAccent(a);
    saveAccent(a).catch(() => toast(t.errGeneric, 'error'));
  };

  const go = (next: Tab) => {
    stopPlayback();
    setTab(next);
  };

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand"><span aria-hidden>🎤</span> {t.appName}</span>
        {lib.pending.length > 0 && <span className="badge badge-warn">☁️ {lib.pending.length.toLocaleString('fa-IR')}</span>}
      </header>
      <main className="content">
        {/* The record screen is unmounted when leaving it: this always releases the microphone. */}
        {tab === 'record' && <RecordScreen lib={lib} accent={accent} />}
        {tab === 'library' && <LibraryScreen lib={lib} />}
        {tab === 'settings' && (
          <SettingsScreen
            email={user.email ?? ''}
            accent={accent}
            onAccent={changeAccent}
            onLogout={async () => {
              stopPlayback();
              clearAudioCache();
              await supabase!.auth.signOut();
            }}
            onResetCloud={
              isRuntimeConfigured
                ? async () => {
                    await supabase!.auth.signOut().catch(() => undefined);
                    clearRuntimeConfig();
                    window.location.reload();
                  }
                : undefined
            }
          />
        )}
      </main>
      <nav className="tabbar" aria-label="menu">
        {([
          ['record', '🎤', t.tabRecord],
          ['library', '📚', t.tabLibrary],
          ['settings', '⚙️', t.tabSettings],
        ] as const).map(([key, icon, label]) => (
          <button key={key} className={tab === key ? 'on' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => go(key)}>
            <span aria-hidden>{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isConfigured) return <SetupScreen />;
  if (session === undefined)
    return (
      <main className="auth">
        <p className="state state-busy"><span className="spinner" aria-hidden /> {t.authWait}</p>
      </main>
    );
  if (!session) return <AuthScreen />;
  return <Home key={session.user.id} session={session} />;
}
