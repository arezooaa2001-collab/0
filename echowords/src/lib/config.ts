/** Shown in the app so it is easy to tell which file is open. */
export const APP_VERSION = 14;

/** Recording limits. */
export const MAX_RECORDING_MS = 60_000;
export const MIN_RECORDING_MS = 400;
export const MIN_AUDIO_BYTES = 500;
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
/** RMS level (0..1) the microphone must reach at least once, otherwise we treat the take as silent. */
export const SILENCE_PEAK = 0.015;
/** Recording bitrate: voice quality, small files. */
export const VOICE_BITRATE = 32_000;
