// Cloud connection settings come from the build (.env) or, for the single-file HTML build,
// from a one-time setup form filled in by a parent and remembered on this device.
// Only PUBLIC values are accepted here: the project URL and the anon/publishable key.
const RUNTIME_KEY = 'echowords-cloud-config';

interface CloudConfig {
  url: string;
  anonKey: string;
}

function readRuntimeConfig(): CloudConfig | null {
  try {
    const raw = localStorage.getItem(RUNTIME_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as CloudConfig;
    return c?.url && c?.anonKey ? c : null;
  } catch {
    return null;
  }
}

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';
const envOk = Boolean(envUrl && envKey && !envUrl.includes('YOUR-PROJECT'));
const runtime = envOk ? null : readRuntimeConfig();

export const SUPABASE_URL = envOk ? envUrl : runtime?.url ?? '';
export const SUPABASE_ANON_KEY = envOk ? envKey : runtime?.anonKey ?? '';
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
/** True when the connection was entered on this device (so it can be changed from Settings). */
export const isRuntimeConfigured = !envOk && !!runtime;

/** Returns an error code, or null if the key looks like a public (anon/publishable) key. */
export function checkPublicKey(key: string): 'secret_key' | 'bad_key' | null {
  const k = key.trim();
  if (k.startsWith('sb_secret_')) return 'secret_key';
  if (k.startsWith('sb_publishable_')) return null;
  const parts = k.split('.');
  if (parts.length !== 3) return 'bad_key';
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload?.role === 'service_role') return 'secret_key';
    return payload?.role === 'anon' ? null : 'bad_key';
  } catch {
    return 'bad_key';
  }
}

export function normalizeUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function saveRuntimeConfig(c: CloudConfig): void {
  localStorage.setItem(RUNTIME_KEY, JSON.stringify(c));
}

export function clearRuntimeConfig(): void {
  try {
    localStorage.removeItem(RUNTIME_KEY);
  } catch {
    /* ignore */
  }
}

export const AUDIO_BUCKET = 'recordings';
/** Recording limits. */
export const MAX_RECORDING_MS = 60_000;
export const MIN_RECORDING_MS = 400;
export const MIN_AUDIO_BYTES = 500;
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
/** RMS level (0..1) the microphone must reach at least once, otherwise we treat the take as silent. */
export const SILENCE_PEAK = 0.015;
export const TRANSCRIBE_CLIENT_TIMEOUT_MS = 70_000;
