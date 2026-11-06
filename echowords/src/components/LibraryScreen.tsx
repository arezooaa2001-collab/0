import { useMemo, useState } from 'react';
import { formatDate, formatSeconds } from '../lib/format';
import { t } from '../lib/strings';
import type { Library, PendingUpload } from '../lib/useLibrary';
import { PlayButton } from './PlayButton';
import { useToast } from './Toast';
import { WordCard } from './WordCard';

function PendingCard({ p, lib }: { p: PendingUpload; lib: Library }) {
  const [url] = useState(() => URL.createObjectURL(p.item.blob));
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return (
    <article className="card word-card pending-card">
      <p className="state-title">
        ☁️ {t.notInCloudYet}
        {p.item.hint && (
          <>
            {' · '}
            <b dir="ltr" lang="en">{p.item.hint}</b>
          </>
        )}
      </p>
      <p className="meta">
        {p.status === 'uploading' ? t.uploading : offline ? t.waitingForInternet : p.status === 'failed' ? t.saveFailed : t.uploading}
      </p>
      <div className="row wrap actions">
        <PlayButton playKey={`pending-${p.item.id}`} getUrl={async () => url} big />
        {p.status !== 'uploading' && (
          <button className="btn btn-secondary" onClick={() => lib.retryPending(p.item.id)}>🔁 {t.retry}</button>
        )}
      </div>
      <p className="meta">{formatDate(p.item.createdAt)} · {formatSeconds(p.item.durationMs)}</p>
    </article>
  );
}

export function LibraryScreen({ lib }: { lib: Library }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [favOnly, setFavOnly] = useState(false);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lib.words.filter((w) => {
      if (favOnly && !w.favorite) return false;
      if (!needle) return true;
      return [w.transcript, w.stt_transcript, w.hint].some((s) => s?.toLowerCase().includes(needle));
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
          onClick={() => {
            void lib.refresh();
            void lib.retryPending();
          }}
          aria-label={t.refresh}
        >
          🔄 {t.refresh}
        </button>
      </div>

      {lib.pending.map((p) => (
        <PendingCard key={p.item.id} p={p} lib={lib} />
      ))}

      {lib.loadError && (
        <div className="msg msg-error" role="alert">
          {t.loadFailed}{' '}
          <button className="btn-link" onClick={() => lib.refresh().catch(() => toast(t.loadFailed, 'error'))}>{t.retry}</button>
        </div>
      )}

      {lib.loading && !lib.words.length ? (
        <p className="state state-busy"><span className="spinner" aria-hidden /> {t.authWait}</p>
      ) : !lib.words.length && !lib.loadError ? (
        <div className="empty">
          <p className="empty-emoji" aria-hidden>🦜</p>
          <p>{t.emptyLibrary}</p>
        </div>
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
