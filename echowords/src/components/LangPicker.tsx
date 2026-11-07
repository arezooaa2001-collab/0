import { LANGS, type LangCode } from '../lib/langs';
import { t } from '../lib/strings';

/** Row of language chips (shown only when more than one language is switched on). */
export function LangPicker({ enabled, value, onChange }: { enabled: LangCode[]; value: LangCode; onChange: (l: LangCode) => void }) {
  if (enabled.length < 2) return null;
  return (
    <div className="lang-picker" role="radiogroup" aria-label={t.langLabel}>
      <span className="meta">{t.langLabel}</span>
      {enabled.map((l) => (
        <button key={l} type="button" role="radio" aria-checked={value === l} className={`chip${value === l ? ' on' : ''}`} onClick={() => onChange(l)}>
          {LANGS[l].flag} {LANGS[l].name}
        </button>
      ))}
    </div>
  );
}
