import { AiError } from './ai';
import { t } from './strings';

/** The real reason an AI request failed, in Persian a parent can act on. */
export function aiErrorText(e: unknown): string {
  const code = e instanceof AiError ? e.code : 'other';
  switch (code) {
    case 'not_granted':
      return t.aiNotGranted;
    case 'bad_key':
      return t.aiBadKey;
    case 'quota':
      return t.aiQuota;
    case 'blocked':
      return t.aiBlocked;
    case 'denied':
      return t.aiDenied;
    case 'unreachable':
      return t.aiUnreachable;
    case 'network':
      return t.aiNetwork;
    case 'timeout':
      return t.aiTimeout;
    case 'no_provider':
      return t.aiNoProvider;
    case 'refused':
      return t.aiRefused;
    default:
      return t.aiOther;
  }
}

/** Short technical line (shown small under the message, for a screenshot). */
export function aiErrorDetail(e: unknown): string {
  const code = e instanceof AiError ? e.code : ((e as Error)?.name ?? 'error');
  const msg = String((e as Error)?.message ?? e).replace(/\s+/g, ' ').slice(0, 240);
  return `${code}: ${msg}`;
}
