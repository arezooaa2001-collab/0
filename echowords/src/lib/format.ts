import { fa } from './strings';

/** 5300 ms → "۰:۰۵" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${fa(m)}:${fa(Math.floor(s / 10))}${fa(s % 10)}`;
}

/** Duration with tenths for short words: 1800 ms → "۱٫۸ ثانیه" */
export function formatSeconds(ms: number): string {
  const v = Math.round(ms / 100) / 10;
  return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(v)} ثانیه`;
}

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatPercent(v: number): string {
  return `${fa(Math.round(v * 100))}٪`;
}
