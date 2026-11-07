import type { Accent } from './stt';

const KEY = 'echowords-accent';

export function readAccent(): Accent {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'us' || v === 'uk' || v === 'auto') return v;
  } catch {
    /* storage may be unavailable */
  }
  return 'auto';
}

export function saveAccent(accent: Accent): void {
  try {
    localStorage.setItem(KEY, accent);
  } catch {
    /* ignore */
  }
}
