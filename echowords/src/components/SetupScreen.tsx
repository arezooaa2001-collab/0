import { useState } from 'react';
import { checkPublicKey, normalizeUrl, saveRuntimeConfig } from '../lib/config';
import { t } from '../lib/strings';

/** One-time connection form for a parent (used by the single-file HTML build). */
export function SetupScreen() {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const origin = normalizeUrl(url);
    if (!origin) return setError(t.setupBadUrl);
    const keyProblem = checkPublicKey(key);
    if (keyProblem === 'secret_key') return setError(t.setupSecretKey);
    if (keyProblem) return setError(t.setupBadKey);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${origin}/auth/v1/settings`, { headers: { apikey: key.trim() } });
      if (!res.ok) throw new Error(String(res.status));
      saveRuntimeConfig({ url: origin, anonKey: key.trim() });
      window.location.reload();
    } catch {
      setError(t.setupFailed);
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <div className="auth-card card">
        <div className="logo" aria-hidden>🛠️</div>
        <h1>{t.setupTitle}</h1>
        <p>{t.setupBody}</p>
        <form className="auth-form" onSubmit={submit}>
          <label className="field">
            <span>{t.setupUrl}</span>
            <input className="input" dir="ltr" type="url" required placeholder="https://xxxx.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <label className="field">
            <span>{t.setupKey}</span>
            <input className="input" dir="ltr" required autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} />
            <small>{t.setupKeyHelp}</small>
          </label>
          {error && <p className="msg msg-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-big wide" type="submit" disabled={busy}>
            {busy ? t.setupChecking : t.setupConnect}
          </button>
        </form>
      </div>
    </main>
  );
}
