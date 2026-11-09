// Why can't we use the microphone? Browsers give the same "NotAllowedError" for very
// different reasons, so we look at where the page is running to give the real answer.
import { t } from './strings';

export type MicPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

/** The page was opened as a file (file:// or Android content://), not as a website. */
export const isFilePage = (): boolean => /^(file|content):$/.test(location.protocol);

/** The page runs inside another app's frame (e.g. a viewer, or a claude.ai page). */
export function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export async function micPermission(): Promise<MicPermission> {
  try {
    const st = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
    return (st?.state as MicPermission) ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Turn a getUserMedia error into a clear Persian explanation. */
export async function explainMicError(err: unknown): Promise<string> {
  const name = (err as { name?: string })?.name ?? '';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return t.errNoMic;
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return t.errInUse;
  if (!window.isSecureContext) return t.errInsecure;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    if (isFilePage()) return t.errMicFilePage;
    if (isEmbedded()) return t.errMicEmbedded;
    const p = await micPermission();
    if (p === 'denied') return t.errDenied;
    return t.errMicDismissed;
  }
  return t.errRecorder;
}

/**
 * Ask the browser for the microphone right now (shows the browser's own permission prompt
 * when needed), then release it immediately. Returns null when it works, otherwise why not.
 */
export async function requestMicrophone(): Promise<string | null> {
  if (!navigator.mediaDevices?.getUserMedia) return window.isSecureContext ? t.errUnsupported : t.errInsecure;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((tr) => tr.stop());
    return null;
  } catch (e) {
    return explainMicError(e);
  }
}
