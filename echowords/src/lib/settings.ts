import type { Accent } from '../../supabase/functions/_shared/stt';
import { sb } from './supabase';

const KEY = 'echowords-accent';

export function readLocalAccent(): Accent {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'us' || v === 'uk' || v === 'auto') return v;
  } catch {
    /* storage may be unavailable */
  }
  return 'auto';
}

/** Saved on the account (follows the learner to every device) and cached locally. */
export async function saveAccent(accent: Accent): Promise<void> {
  try {
    localStorage.setItem(KEY, accent);
  } catch {
    /* ignore */
  }
  await sb().auth.updateUser({ data: { accent } });
}

export function accentFromMetadata(meta: Record<string, unknown> | undefined): Accent | null {
  const v = meta?.accent;
  return v === 'us' || v === 'uk' || v === 'auto' ? v : null;
}
