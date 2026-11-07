import { useState } from 'react';
import { t } from '../lib/strings';
import { sb } from '../lib/supabase';

function authError(e: { message?: string; code?: string } | null): string {
  const m = `${e?.code ?? ''} ${e?.message ?? ''}`.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid_credentials')) return t.errBadLogin;
  if (m.includes('already registered') || m.includes('user_already_exists')) return t.errUserExists;
  if (m.includes('password')) return t.errWeakPassword;
  if (m.includes('not confirmed')) return t.errEmailNotConfirmed;
  if (m.includes('fetch') || m.includes('network')) return t.errOffline;
  return t.errGeneric;
}

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'login') {
        const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
        if (error) setError(authError(error));
      } else {
        if (password.length < 6) {
          setError(t.errWeakPassword);
          return;
        }
        const { data, error } = await sb().auth.signUp({
          email: email.trim(),
          password,
          options: /^https?:$/.test(window.location.protocol) ? { emailRedirectTo: window.location.origin } : undefined,
        });
        if (error) setError(authError(error));
        else if (!data.session) {
          setInfo(t.signupCheckEmail);
          setMode('login');
        }
      }
    } catch (err) {
      setError(authError(err as { message?: string }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <div className="auth-card card">
        <div className="logo" aria-hidden>🎤</div>
        <h1>{t.appName}</h1>
        <p className="tagline">{t.appTagline}</p>
        <p className="auth-hello">{t.authHello}</p>
        <p className="meta">{t.authParentNote}</p>
        <form onSubmit={submit} className="auth-form">
          <label className="field">
            <span>{t.email}</span>
            <input className="input" type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>{t.password}</span>
            <input
              className="input"
              type="password"
              dir="ltr"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === 'signup' && <small>{t.passwordHint}</small>}
          </label>
          {error && <p className="msg msg-error" role="alert">{error}</p>}
          {info && <p className="msg msg-info" role="status">{info}</p>}
          <button className="btn btn-primary btn-big wide" type="submit" disabled={busy}>
            {busy ? t.authWait : mode === 'login' ? t.login : t.signup}
          </button>
        </form>
        <button
          className="btn-link"
          onClick={() => {
            setMode((m) => (m === 'login' ? 'signup' : 'login'));
            setError(null);
          }}
        >
          {mode === 'login' ? t.noAccount : t.haveAccount}
        </button>
      </div>
    </main>
  );
}
