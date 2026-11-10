import { useEffect, useState } from 'react';
import { DEFAULT_MODELS, type KeyProvider, getClaude, normalizeBaseUrl, readAiSettings, saveAiSettings, testConnection } from '../lib/ai';
import { aiErrorDetail, aiErrorText } from '../lib/aiErrors';
import { t } from '../lib/strings';
import { useToast } from './Toast';

const PROVIDERS: { id: KeyProvider; label: string }[] = [
  { id: 'anthropic', label: 'Claude (Anthropic)' },
  { id: 'openai', label: 'ChatGPT (OpenAI)' },
  { id: 'gemini', label: 'Google Gemini' },
  { id: 'custom', label: t.aiCustom },
];

/** Parent-only: choose the AI service and paste its key (used only outside Claude). */
export function AiSettingsCard() {
  const toast = useToast();
  const saved = readAiSettings();
  const [inClaude, setInClaude] = useState(false);
  const [provider, setProvider] = useState<KeyProvider>(saved?.provider ?? 'anthropic');
  const [key, setKey] = useState(saved?.key ?? '');
  const [model, setModel] = useState(saved?.model ?? DEFAULT_MODELS[saved?.provider ?? 'anthropic']);
  const [baseUrl, setBaseUrl] = useState(saved?.baseUrl ?? '');
  const [hasSaved, setHasSaved] = useState(!!saved);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; text: string; detail?: string } | null>(null);

  useEffect(() => {
    void getClaude().then((c) => setInClaude(!!c));
  }, []);

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    const r = await testConnection();
    setTesting(false);
    if (r.ok) {
      const name = r.provider === 'claude' || r.provider === 'anthropic' ? 'Claude' : r.provider === 'openai' ? 'ChatGPT' : r.provider === 'gemini' ? 'Gemini' : t.aiCustomShort;
      setTest({ ok: true, text: t.aiTestOk(name, new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(r.ms / 1000)) });
    } else setTest({ ok: false, text: `${t.aiTestFail} ${aiErrorText(r.error)}`, detail: aiErrorDetail(r.error) });
  };

  const save = () => {
    const url = provider === 'custom' ? normalizeBaseUrl(baseUrl) : null;
    if (provider === 'custom' && !url) return setTest({ ok: false, text: t.aiBadUrl });
    saveAiSettings({ provider, key: key.trim(), model: model.trim() || DEFAULT_MODELS[provider], ...(url ? { baseUrl: url } : {}) });
    setHasSaved(true);
    toast(t.aiSaved, 'success');
    void runTest(); // check right away that it really answers
  };

  return (
    <div className="card ai-settings">
      <h2>{t.aiTitle}</h2>
      {inClaude && <p className="msg msg-success">{t.aiInClaude}</p>}
      <p className="meta">{t.aiKeyHelp}</p>
      <div className="row wrap">
        <span className="meta">{t.aiProvider}</span>
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            className={`chip${provider === p.id ? ' on' : ''}`}
            aria-pressed={provider === p.id}
            onClick={() => {
              setProvider(p.id);
              setModel(DEFAULT_MODELS[p.id]);
              setTest(null);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      {provider === 'anthropic' && <p className="meta ai-help">{t.aiAnthropicHelp}</p>}
      {provider === 'custom' && (
        <label className="field">
          <span>{t.aiBaseUrl}</span>
          <input className="input" dir="ltr" inputMode="url" spellCheck={false} placeholder="https://…/v1" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          <small>{t.aiBaseUrlHelp}</small>
        </label>
      )}
      <label className="field">
        <span>{t.aiKeyLabel}</span>
        <input className="input ai-key" type="password" dir="ltr" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} />
      </label>
      <label className="field">
        <span>{t.aiModelLabel}</span>
        <input className="input ai-model" dir="ltr" spellCheck={false} value={model} onChange={(e) => setModel(e.target.value)} />
      </label>
      <div className="row wrap">
        <button className="btn btn-primary" disabled={!key.trim()} onClick={save}>💾 {t.aiSave}</button>
        <button className="btn btn-secondary" onClick={runTest} disabled={testing}>🔌 {testing ? t.aiTesting : t.aiTest}</button>
        {hasSaved && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              saveAiSettings(null);
              setKey('');
              setHasSaved(false);
              setTest(null);
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
