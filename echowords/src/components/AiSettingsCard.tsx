import { useEffect, useState } from 'react';
import { DEFAULT_MODELS, getClaude, readAiSettings, saveAiSettings } from '../lib/ai';
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
          }}
        >
          💾 {t.aiSave}
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
    </div>
  );
}
