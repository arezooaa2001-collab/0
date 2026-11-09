// A short voice recording for asking the tutor (used when the phone's speech recognition is missing).
import { explainMicError } from './mic';
import { nativeCanRecord, nativeCancelRecording, nativeStartRecording, nativeStopRecording } from './native';
import { pickMimeType } from './audio';
import { t } from './strings';

export interface VoiceNote {
  stop(): Promise<Blob | null>;
  cancel(): void;
}

export class VoiceNoteError extends Error {}

export async function startVoiceNote(): Promise<VoiceNote> {
  if (nativeCanRecord()) {
    const r = await nativeStartRecording();
    if (!r.ok) throw new VoiceNoteError(r.error === 'not-allowed' ? t.errMicApp : r.error === 'busy' ? t.errInUse : t.errRecorder);
    return {
      stop: async () => {
        const s = await nativeStopRecording();
        return s.ok ? s.blob : null;
      },
      cancel: () => nativeCancelRecording(),
    };
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    throw new VoiceNoteError(await explainMicError(e));
  }
  const mime = pickMimeType(MediaRecorder.isTypeSupported?.bind(MediaRecorder));
  const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start(250);
  const release = () => stream.getTracks().forEach((tr) => tr.stop());
  return {
    stop: () =>
      new Promise<Blob | null>((resolve) => {
        rec.onstop = () => {
          release();
          resolve(chunks.length ? new Blob(chunks, { type: chunks[0].type || mime || 'audio/webm' }) : null);
        };
        try {
          rec.stop();
        } catch {
          release();
          resolve(null);
        }
      }),
    cancel: () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      release();
    },
  };
}
