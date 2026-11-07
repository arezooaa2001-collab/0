import { useState } from 'react';
import { LibraryScreen } from './components/LibraryScreen';
import { RecordScreen } from './components/RecordScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { stopPlayback } from './lib/player';
import { readAccent, saveAccent } from './lib/settings';
import type { Accent } from './lib/stt';
import { t } from './lib/strings';
import { useLibrary } from './lib/useLibrary';

type Tab = 'record' | 'library' | 'settings';

export default function App() {
  const lib = useLibrary();
  const [tab, setTab] = useState<Tab>('record');
  const [accent, setAccent] = useState<Accent>(readAccent);

  const go = (next: Tab) => {
    stopPlayback();
    setTab(next);
  };

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand"><span aria-hidden>🎤</span> {t.appName}</span>
      </header>
      <main className="content">
        {/* The record screen is unmounted when leaving it: this always releases the microphone. */}
        {tab === 'record' && <RecordScreen lib={lib} accent={accent} />}
        {tab === 'library' && <LibraryScreen lib={lib} />}
        {tab === 'settings' && (
          <SettingsScreen
            lib={lib}
            accent={accent}
            onAccent={(a) => {
              setAccent(a);
              saveAccent(a);
            }}
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
