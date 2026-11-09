import { useMemo, useState } from 'react';
import type { Folder, Word } from '../lib/db';
import { LANGS, type LangCode, langsIn } from '../lib/langs';
import type { Accent } from '../lib/stt';
import { t } from '../lib/strings';
import type { Library } from '../lib/useLibrary';
import { ConfirmDialog } from './ConfirmDialog';
import { FolderDialog } from './FolderDialog';
import { RestoreButton } from './RestoreButton';
import { useToast } from './Toast';
import { WordCard } from './WordCard';

/** 'all' = every word; null = words without a folder; otherwise a folder id. */
type FolderView = 'all' | null | string;

const wordLangs = (w: Word): LangCode[] => (w.transcript ? langsIn(w.transcript) : []);

export function LibraryScreen({ lib, accent, onAddVoice }: { lib: Library; accent: Accent; onAddVoice: (w: Word) => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [langFilter, setLangFilter] = useState<LangCode | null>(null);
  const [view, setView] = useState<FolderView>('all');
  const [dialog, setDialog] = useState<'new' | 'rename' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const folder: Folder | null = typeof view === 'string' && view !== 'all' ? lib.folders.find((f) => f.id === view) ?? null : null;
  const countIn = (id: string | null) => lib.words.filter((w) => (w.folderId ?? null) === id).length;
  const inView = (w: Word) => view === 'all' || (w.folderId ?? null) === view;

  const langsInUse = useMemo(() => [...new Set(lib.words.filter(inView).flatMap(wordLangs))], [lib.words, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lib.words.filter((w) => {
      if (!inView(w)) return false;
      if (favOnly && !w.favorite) return false;
      if (langFilter && !wordLangs(w).includes(langFilter)) return false;
      if (!needle) return true;
      return [w.transcript, w.sttHeard, w.hint].some((s) => s?.toLowerCase().includes(needle));
    });
  }, [lib.words, q, favOnly, langFilter, view]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="screen library-screen">
      <div className="library-head">
        <h1 className="title">{t.libraryTitle}</h1>
        <span className="badge">{t.wordsCount(lib.words.length)}</span>
      </div>

      {/* ── Folders ───────────────────────────────────────────── */}
      <div className="folder-bar" role="tablist" aria-label={t.folderLabel}>
        <button role="tab" aria-selected={view === 'all'} className={`folder-tile${view === 'all' ? ' on' : ''}`} onClick={() => setView('all')}>
          <span className="folder-emoji" aria-hidden>📚</span>
          <span className="folder-name">{t.allWords}</span>
          <span className="folder-count">{lib.words.length.toLocaleString('fa-IR')}</span>
        </button>
        {lib.folders.map((f) => (
          <button key={f.id} role="tab" aria-selected={view === f.id} className={`folder-tile${view === f.id ? ' on' : ''}`} onClick={() => setView(f.id)}>
            <span className="folder-emoji" aria-hidden>{f.emoji}</span>
            <span className="folder-name">{f.name}</span>
            <span className="folder-count">{countIn(f.id).toLocaleString('fa-IR')}</span>
          </button>
        ))}
        <button role="tab" aria-selected={view === null} className={`folder-tile${view === null ? ' on' : ''}`} onClick={() => setView(null)}>
          <span className="folder-emoji" aria-hidden>🗂️</span>
          <span className="folder-name">{t.noFolder}</span>
          <span className="folder-count">{countIn(null).toLocaleString('fa-IR')}</span>
        </button>
        <button className="folder-tile folder-add" onClick={() => setDialog('new')}>
          <span className="folder-emoji" aria-hidden>➕</span>
          <span className="folder-name">{t.newFolder}</span>
        </button>
      </div>

      {folder && (
        <div className="folder-header">
          <span className="state-title">
            {folder.emoji} {folder.name}
          </span>
          <span className="row">
            <button className="btn-link" onClick={() => setDialog('rename')} aria-label={t.renameFolder}>✏️</button>
            <button className="btn-link danger" onClick={() => setConfirmDelete(true)} aria-label={t.deleteFolder}>🗑️</button>
          </span>
        </div>
      )}

      <div className="row wrap toolbar">
        <input
          className="input search"
          type="search"
          dir="auto"
          placeholder={t.searchPlaceholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t.searchPlaceholder}
        />
        <button className={`chip${favOnly ? ' on' : ''}`} aria-pressed={favOnly} onClick={() => setFavOnly((v) => !v)}>
          ⭐ {t.favoritesOnly}
        </button>
        {langsInUse.length > 1 &&
          langsInUse.map((l) => (
            <button key={l} className={`chip${langFilter === l ? ' on' : ''}`} aria-pressed={langFilter === l} onClick={() => setLangFilter(langFilter === l ? null : l)}>
              {LANGS[l].flag} {LANGS[l].name}
            </button>
          ))}
      </div>

      {lib.loadError && (
        <div className="msg msg-error" role="alert">
          {t.loadFailed}{' '}
          <button className="btn-link" onClick={() => lib.refresh().catch(() => toast(t.loadFailed, 'error'))}>{t.retry}</button>
        </div>
      )}

      {lib.loading && !lib.words.length ? (
        <p className="state state-busy"><span className="spinner" aria-hidden /> {t.authWait}</p>
      ) : !lib.words.length && !lib.loadError ? (
        <>
          <div className="empty">
            <p className="empty-emoji" aria-hidden>🦜</p>
            <p>{t.emptyLibrary}</p>
          </div>
          <div className="card restore-card">
            <p className="state-title">{t.emptyRestoreTitle}</p>
            <p className="meta">{t.emptyRestoreHelp}</p>
            <RestoreButton lib={lib} big />
          </div>
        </>
      ) : !shown.length ? (
        <p className="empty">{folder && !countIn(folder.id) ? t.folderEmpty : t.noResults}</p>
      ) : (
        <div className="word-list">
          {shown.map((w) => (
            <WordCard key={w.id} word={w} lib={lib} accent={accent} onAddVoice={onAddVoice} />
          ))}
        </div>
      )}

      {dialog === 'new' && (
        <FolderDialog
          title={t.newFolder}
          onCancel={() => setDialog(null)}
          onSave={async (name, emoji) => {
            const f = await lib.createFolder(name, emoji);
            setView(f.id);
            setDialog(null);
          }}
        />
      )}
      {dialog === 'rename' && folder && (
        <FolderDialog
          title={t.renameFolder}
          initialName={folder.name}
          initialEmoji={folder.emoji}
          onCancel={() => setDialog(null)}
          onSave={async (name, emoji) => {
            await lib.renameFolder(folder, name, emoji);
            setDialog(null);
          }}
        />
      )}
      {confirmDelete && folder && (
        <ConfirmDialog
          message={t.deleteFolderConfirm(folder.name)}
          confirmLabel={t.yesDelete}
          danger
          onConfirm={async () => {
            setConfirmDelete(false);
            await lib.removeFolder(folder);
            setView('all');
            toast(t.deleted, 'success');
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </section>
  );
}
