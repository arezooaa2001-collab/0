/** Recording formats in order of preference. Chrome/Android → WebM/Opus, Safari/iOS → MP4/AAC. */
export const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/aac',
  'audio/ogg;codecs=opus',
  'audio/ogg',
] as const;

export function pickMimeType(isTypeSupported: ((t: string) => boolean) | undefined): string | null {
  if (!isTypeSupported) return null;
  for (const m of MIME_CANDIDATES) {
    try {
      if (isTypeSupported(m)) return m;
    } catch {
      /* some browsers throw for unknown types */
    }
  }
  return null;
}

/** "audio/webm;codecs=opus" → "audio/webm" */
export function baseMime(mime: string): string {
  return (mime || '').split(';')[0].trim().toLowerCase();
}

export function extensionFor(mime: string): string {
  const b = baseMime(mime);
  if (b === 'audio/webm') return 'webm';
  if (b === 'audio/ogg') return 'ogg';
  if (b === 'audio/mp4' || b === 'audio/x-m4a') return 'm4a';
  if (b === 'audio/aac') return 'aac';
  if (b === 'audio/mpeg') return 'mp3';
  if (b === 'audio/wav') return 'wav';
  return 'bin';
}

/** Some browsers return an empty blob.type; fall back to the format we asked for, then to the container we can sniff. */
export function resolveMime(recorderMime: string | undefined, requested: string | null, bytes?: Uint8Array): string {
  const candidate = baseMime(recorderMime || '') || baseMime(requested || '');
  if (candidate) return candidate;
  if (bytes) return sniffMime(bytes) ?? 'audio/webm';
  return 'audio/webm';
}

/** Detect the audio container from its magic bytes. */
export function sniffMime(b: Uint8Array): string | null {
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'audio/webm';
  if (b.length >= 4 && b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return 'audio/ogg';
  if (b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'audio/mp4';
  if (b.length >= 4 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return 'audio/wav';
  return null;
}

export async function sha256Hex(data: Blob | ArrayBuffer): Promise<string> {
  const buf = data instanceof Blob ? await data.arrayBuffer() : data;
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, '0')).join('');
}

/** RMS level of a time-domain buffer (values centred on 128), 0..1. */
export function rmsLevel(samples: Uint8Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = (samples[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}
