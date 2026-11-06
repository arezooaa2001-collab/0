export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('YOUR-PROJECT'));

export const AUDIO_BUCKET = 'recordings';
/** Recording limits. */
export const MAX_RECORDING_MS = 60_000;
export const MIN_RECORDING_MS = 400;
export const MIN_AUDIO_BYTES = 500;
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
/** RMS level (0..1) the microphone must reach at least once, otherwise we treat the take as silent. */
export const SILENCE_PEAK = 0.015;
export const TRANSCRIBE_CLIENT_TIMEOUT_MS = 70_000;
