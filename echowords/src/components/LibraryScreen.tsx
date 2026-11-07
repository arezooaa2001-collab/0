import { useMemo, useState } from 'react';
import { t } from '../lib/strings';
import type { Library } from '../lib/useLibrary';
import { useToast } from './Toast';
import { RestoreButton } from './RestoreButton';
import { WordCard } from './WordCard';

export function LibraryScreen({ lib }: { lib: Library }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [favOnly, setFavOnly] = useState(false);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lib.words.filter((w) => {
      if (favOnly && !w.favorite) return false;
      if (!needle) return true;
      return [w.transcript, w.sttHeard, w.hint].some((s) => s?.toLowerCase().includes(needle));
    });
  }, [lib.words, q, favOnly]);

  return (
    <section className="screen library-screen">
      <div className="library-head">
        <h1 className="title">{t.libraryTitle}</h1>
        <span className="badge">{t.wordsCount(lib.words.length)}</span>
      </div>

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
        <button
          className="chip"
          onClick={() => void lib.refresh()}
          aria-label={t.refresh}
        >
          🔄 {t.refresh}
        </button>
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
        <p className="empty">{t.noResults}</p>
      ) : (
        <div className="word-list">
          {shown.map((w) => (
            <WordCard key={w.id} word={w} lib={lib} />
          ))}
        </div>
      )}
    </section>
  );
}
