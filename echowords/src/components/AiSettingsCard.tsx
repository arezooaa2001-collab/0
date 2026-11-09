import { useEffect, useState } from 'react';
import { AiError, DEFAULT_MODELS, getClaude, readAiSettings, saveAiSettings, testConnection } from '../lib/ai';
import { t } from '../lib/strings';
import { useToast } from './Toast';

/** Parent-only: choose Gemini or ChatGPT and paste a key (used only outside Claude). */
export function AiSettingsCard() {
  const toast = useToast();
  const saved = readAiSettings();
  const [inClaude, setInClaude] = useState(false);
  const [provider, setProvider] = useState<'gemini' | 'openai'>(saved?.provider ?? 'gemini');
  const [key, setKey] = useState(saved?.key ?? '');
  const [model, setModel] = useState(saved?.model ?? DEFAULT_MODELS.gemini);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; text: string; detail?: string } | null>(null);

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    const r = await testConnection();
    setTesting(false);
    if (r.ok) {
      const name = r.provider === 'claude' ? 'Claude' : r.provider === 'openai' ? 'ChatGPT' : 'Gemini';
      setTest({ ok: true, text: t.aiTestOk(name, new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(r.ms / 1000)) });
    } else {
      const e = r.error;
      const code = e instanceof AiError ? e.code : 'other';
      const why =
        code === 'timeout' ? t.aiTimeout : code === 'bad_key' ? t.aiBadKey : code === 'blocked' ? t.aiBlocked : code === 'network' ? t.aiNetwork : code === 'no_provider' ? t.aiNoProvider : t.aiOther;
      setTest({ ok: false, text: `${t.aiTestFail} ${why}`, detail: `${code}: ${String(e.message).slice(0, 160)}` });
    }
  };

  useEffect(() => {
    void getClaude().then((c) => setInClaude(!!c));
  }, []);

  return (
    <div className="card">
      <h2>{t.aiTitle}</h2>
      {inClaude && <p className="msg msg-success">{t.aiInClaude}</p>}
      <p className="meta">{t.aiKeyHelp}</p>
      <div className="row wrap">
        <span className="meta">{t.aiProvider}</span>
        {(['gemini', 'openai'] as const).map((p) => (
          <button
            key={p}
            className={`chip${provider === p ? ' on' : ''}`}
            onClick={() => {
              setProvider(p);
              setModel(DEFAULT_MODELS[p]);
            }}
          >
            {p === 'gemini' ? 'Google Gemini' : 'ChatGPT (OpenAI)'}
          </button>
        ))}
      </div>
      <label className="field">
        <span>{t.aiKeyLabel}</span>
        <input className="input" type="password" dir="ltr" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} />
      </label>
      <label className="field">
        <span>{t.aiModelLabel}</span>
        <input className="input" dir="ltr" spellCheck={false} value={model} onChange={(e) => setModel(e.target.value)} />
      </label>
      <div className="row wrap">
        <button
          className="btn btn-primary"
          disabled={!key.trim()}
          onClick={() => {
            saveAiSettings({ provider, key: key.trim(), model: model.trim() || DEFAULT_MODELS[provider] });
            toast(t.aiSaved, 'success');
            void runTest(); // check right away that it really answers
          }}
        >
          💾 {t.aiSave}
        </button>
        <button className="btn btn-secondary" onClick={runTest} disabled={testing}>
          🔌 {testing ? t.aiTesting : t.aiTest}
        </button>
        {saved && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              saveAiSettings(null);
              setKey('');
              toast(t.deleted, 'success');
            }}
          >
            🗑️ {t.aiRemove}
          </button>
        )}
      </div>
      {test && <p className={`msg ${test.ok ? 'msg-success' : 'msg-error'}`} role="status">{test.text}</p>}
      {test?.detail && <p className="meta diag" dir="ltr">{test.detail}</p>}
    </div>
  );
}
