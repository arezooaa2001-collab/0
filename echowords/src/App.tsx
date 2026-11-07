import { useState } from 'react';
import { LibraryScreen } from './components/LibraryScreen';
import { RecordScreen } from './components/RecordScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { stopPlayback } from './lib/player';
import { readAccent, saveAccent } from './lib/settings';
import type { Accent } from './lib/stt';
import { fa, t } from './lib/strings';
import { APP_VERSION } from './lib/config';
import { useLibrary } from './lib/useLibrary';
import type { Word } from './lib/db';
import { downloadBackup } from './lib/backup';
import { useToast } from './components/Toast';

type Tab = 'record' | 'library' | 'settings';

export default function App() {
  const lib = useLibrary();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('record');
  const [accent, setAccent] = useState<Accent>(readAccent);
  /** Word picked in the library to add a recording to; bumps `recordKey` to open a fresh recorder. */
  const [voiceFor, setVoiceFor] = useState<Word | null>(null);
  const [recordKey, setRecordKey] = useState(0);

  const go = (next: Tab) => {
    stopPlayback();
    if (next === 'record' && tab !== 'record') setRecordKey((k) => k + 1);
    setTab(next);
  };

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand"><span aria-hidden>🎤</span> {t.appName}</span>
        <span className="version">نسخه {fa(APP_VERSION)}</span>
      </header>
      <main className="content">
        {lib.health?.mode === 'memory' && (
          <div className="msg msg-error storage-banner" role="alert">
            <p>{t.storageBlockedShort}</p>
            <button
              className="btn btn-primary"
              disabled={!lib.words.length}
              onClick={() => void downloadBackup().then(() => toast(t.backupDone, 'success'))}
            >
              ⬇️ {t.backupExport}
            </button>
          </div>
        )}
        {/* The record screen is unmounted when leaving it: this always releases the microphone. */}
        {tab === 'record' && <RecordScreen key={recordKey} lib={lib} accent={accent} initialTarget={voiceFor} onOpenLibrary={() => go('library')} />}
        {tab === 'library' && (
          <LibraryScreen
            lib={lib}
            onAddVoice={(w) => {
              setVoiceFor(w);
              setRecordKey((k) => k + 1);
              go('record');
            }}
          />
        )}
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
          <button key={key} className={tab === key ? 'on' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => {
              if (key === 'record') setVoiceFor(null);
              go(key);
            }}>
            <span aria-hidden>{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
