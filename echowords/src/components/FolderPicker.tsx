import { useState } from 'react';
import { t } from '../lib/strings';
import type { Library } from '../lib/useLibrary';
import { FolderDialog } from './FolderDialog';

/** Choose where a new word goes: no folder, an existing folder, or a new one. */
export function FolderPicker({ lib, value, onChange }: { lib: Library; value: string | null; onChange: (id: string | null) => void }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="folder-picker" role="radiogroup" aria-label={t.folderLabel}>
      <span className="meta">{t.folderLabel}</span>
      <button type="button" role="radio" aria-checked={value === null} className={`chip${value === null ? ' on' : ''}`} onClick={() => onChange(null)}>
        🗂️ {t.noFolder}
      </button>
      {lib.folders.map((f) => (
        <button key={f.id} type="button" role="radio" aria-checked={value === f.id} className={`chip${value === f.id ? ' on' : ''}`} onClick={() => onChange(f.id)}>
          {f.emoji} {f.name}
        </button>
      ))}
      <button type="button" className="chip chip-add" onClick={() => setCreating(true)}>
        ➕ {t.newFolder}
      </button>
      {creating && (
        <FolderDialog
          title={t.newFolder}
          onCancel={() => setCreating(false)}
          onSave={async (name, emoji) => {
            const f = await lib.createFolder(name, emoji);
            onChange(f.id);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

const LAST_FOLDER = 'echowords-last-folder';
export function readLastFolder(): string | null {
  try {
    return localStorage.getItem(LAST_FOLDER) || null;
  } catch {
    return null;
  }
}
export function saveLastFolder(id: string | null): void {
  try {
    if (id) localStorage.setItem(LAST_FOLDER, id);
    else localStorage.removeItem(LAST_FOLDER);
  } catch {
    /* ignore */
  }
}
