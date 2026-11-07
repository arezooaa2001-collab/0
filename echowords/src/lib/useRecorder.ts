import { useCallback, useEffect, useRef, useState } from 'react';
import { pickMimeType, resolveMime, rmsLevel } from './audio';
import { MAX_AUDIO_BYTES, MAX_RECORDING_MS, VOICE_BITRATE, MIN_AUDIO_BYTES, MIN_RECORDING_MS, SILENCE_PEAK } from './config';
import { t } from './strings';

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopping' | 'ready' | 'error';

export interface Take {
  blob: Blob;
  url: string;
  mimeType: string;
  durationMs: number;
  peakLevel: number | null;
}

export type StopReason = 'user' | 'max' | 'background' | 'mic_lost';

export interface RecorderApi {
  state: RecorderState;
  elapsedMs: number;
  /** Live microphone level 0..1 from the real audio stream (null when not measurable). */
  level: number | null;
  take: Take | null;
  error: string | null;
  notice: string | null;
  canPause: boolean;
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  reset: () => void;
}

function micErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return t.errDenied;
    case 'SecurityError':
      return window.isSecureContext ? t.errDenied : t.errInsecure;
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return t.errNoMic;
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return t.errInUse;
    default:
      return t.errRecorder;
  }
}

/** Resolve true if the browser can decode the blob as audio (or if it cannot tell within the time limit). */
function checkPlayable(url: string, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    const a = new Audio();
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      a.removeAttribute('src');
      a.load();
      resolve(ok);
    };
    a.preload = 'metadata';
    a.onloadedmetadata = () => finish(true);
    a.oncanplay = () => finish(true);
    a.onerror = () => finish(false);
    setTimeout(() => finish(true), timeoutMs);
    a.src = url;
  });
}

/**
 * Real microphone recorder built on getUserMedia + MediaRecorder.
 * Guarantees: one session at a time, microphone released on stop/cancel/unmount,
 * no success state unless real audio bytes were captured.
 */
export function useRecorder(): RecorderApi {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedMs, setElapsed] = useState(0);
  const [level, setLevel] = useState<number | null>(null);
  const [take, setTake] = useState<Take | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const stateRef = useRef<RecorderState>('idle');
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const peakRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const discardRef = useRef(false);
  const stopReasonRef = useRef<StopReason>('user');
  const mountedRef = useRef(true);
  const sessionRef = useRef(0);
  const takeUrlRef = useRef<string | null>(null);

  const setS = useCallback((s: RecorderState) => {
    stateRef.current = s;
    if (mountedRef.current) setState(s);
  }, []);

  const currentElapsed = () =>
    accumulatedRef.current + (segmentStartRef.current !== null ? performance.now() - segmentStartRef.current : 0);

  /** Stop every hardware/processing resource. Safe to call many times. */
  const releaseHardware = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (tickRef.current !== null) clearInterval(tickRef.current);
    tickRef.current = null;
    streamRef.current?.getTracks().forEach((tr) => {
      tr.onended = null;
      tr.stop();
    });
    streamRef.current = null;
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => undefined);
    if (mountedRef.current) setLevel(null);
  }, []);

  const revokeTake = useCallback(() => {
    if (takeUrlRef.current) URL.revokeObjectURL(takeUrlRef.current);
    takeUrlRef.current = null;
  }, []);

  const fail = useCallback(
    (msg: string) => {
      releaseHardware();
      recRef.current = null;
      if (mountedRef.current) setError(msg);
      setS('error');
    },
    [releaseHardware, setS],
  );

  const finalize = useCallback(
    async (session: number) => {
      const durationMs = currentElapsed();
      segmentStartRef.current = null;
      releaseHardware();
      recRef.current = null;
      if (session !== sessionRef.current) return; // a newer session already started
      if (discardRef.current) {
        chunksRef.current = [];
        if (stateRef.current !== 'error') setS('idle');
        return;
      }
      const chunks = chunksRef.current;
      chunksRef.current = [];
      const raw = new Blob(chunks, { type: chunks[0]?.type || mimeRef.current || '' });
      if (raw.size === 0) return fail(t.errEmpty);
      const head = new Uint8Array(await raw.slice(0, 16).arrayBuffer());
      const mimeType = resolveMime(raw.type, mimeRef.current, head);
      const blob = raw.type === mimeType ? raw : new Blob([raw], { type: mimeType }); // same bytes, explicit type
      if (durationMs < MIN_RECORDING_MS || blob.size < MIN_AUDIO_BYTES) return fail(t.errTooShort);
      if (blob.size > MAX_AUDIO_BYTES) return fail(t.errRecorder);
      if (peakRef.current !== null && peakRef.current < SILENCE_PEAK) return fail(t.errSilent);
      const url = URL.createObjectURL(blob);
      if (!(await checkPlayable(url))) {
        URL.revokeObjectURL(url);
        return fail(t.errInvalid);
      }
      if (!mountedRef.current || session !== sessionRef.current) {
        URL.revokeObjectURL(url);
        return;
      }
      revokeTake();
      takeUrlRef.current = url;
      setTake({ blob, url, mimeType, durationMs, peakLevel: peakRef.current });
      setElapsed(durationMs);
      const reason = stopReasonRef.current;
      setNotice(
        reason === 'max' ? t.maxLengthReached : reason === 'background' ? t.stoppedInBackground : reason === 'mic_lost' ? t.micLost : null,
      );
      setS('ready');
    },
    [fail, releaseHardware, revokeTake, setS],
  );

  const stopWith = useCallback((reason: StopReason) => {
    const rec = recRef.current;
    if (!rec || (stateRef.current !== 'recording' && stateRef.current !== 'paused')) return;
    stopReasonRef.current = reason;
    stateRef.current = 'stopping';
    if (mountedRef.current) setState('stopping');
    try {
      if (rec.state !== 'inactive') rec.stop();
    } catch {
      /* onstop will not fire; finalize manually */
      void finalize(sessionRef.current);
    }
  }, [finalize]);

  const start = useCallback(async () => {
    // Guard against double taps and parallel sessions.
    if (!['idle', 'ready', 'error'].includes(stateRef.current)) return;
    setError(null);
    setNotice(null);
    revokeTake();
    setTake(null);
    setElapsed(0);

    if (!window.isSecureContext) return fail(t.errInsecure);
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') return fail(t.errUnsupported);

    const session = ++sessionRef.current;
    setS('requesting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      if (session !== sessionRef.current || !mountedRef.current) return;
      return fail(micErrorMessage(e));
    }
    // The screen may have closed or the user cancelled while the permission prompt was open.
    if (session !== sessionRef.current || !mountedRef.current || stateRef.current !== 'requesting') {
      stream.getTracks().forEach((tr) => tr.stop());
      return;
    }
    const track = stream.getAudioTracks()[0];
    if (!track || track.readyState !== 'live') {
      stream.getTracks().forEach((tr) => tr.stop());
      return fail(t.errNoMic);
    }
    streamRef.current = stream;

    const mime = pickMimeType(MediaRecorder.isTypeSupported?.bind(MediaRecorder));
    mimeRef.current = mime;
    let rec: MediaRecorder;
    try {
      // Voice quality (32 kbit/s) is plenty for speech and keeps each recording small (~4 KB per second).
      rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: VOICE_BITRATE });
    } catch {
      try {
        rec = new MediaRecorder(stream);
        mimeRef.current = null;
      } catch {
        return fail(t.errUnsupported);
      }
    }
    recRef.current = rec;
    chunksRef.current = [];
    discardRef.current = false;
    stopReasonRef.current = 'user';
    peakRef.current = null;
    accumulatedRef.current = 0;

    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    rec.onstop = () => void finalize(session);
    rec.onerror = () => {
      discardRef.current = true;
      fail(t.errRecorder);
    };
    track.onended = () => stopWith('mic_lost');

    // Live level meter from the real stream.
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      peakRef.current = 0;
      const loop = () => {
        analyser.getByteTimeDomainData(buf);
        const lv = rmsLevel(buf);
        if (stateRef.current === 'recording') peakRef.current = Math.max(peakRef.current ?? 0, lv);
        if (mountedRef.current) setLevel(lv);
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      peakRef.current = null; // cannot measure: silence check is skipped, not faked
    }

    try {
      rec.start(250); // small timeslices: captured audio survives sudden interruptions
    } catch {
      return fail(t.errRecorder);
    }
    segmentStartRef.current = performance.now();
    setS('recording');
    tickRef.current = window.setInterval(() => {
      const ms = currentElapsed();
      if (mountedRef.current) setElapsed(ms);
      if (ms >= MAX_RECORDING_MS) stopWith('max');
    }, 100);
  }, [fail, finalize, revokeTake, setS, stopWith]);

  const stop = useCallback(() => stopWith('user'), [stopWith]);

  const canPause = typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && 'pause' in MediaRecorder.prototype;

  const pause = useCallback(() => {
    const rec = recRef.current;
    if (!rec || stateRef.current !== 'recording' || rec.state !== 'recording') return;
    try {
      rec.pause();
      accumulatedRef.current = currentElapsed();
      segmentStartRef.current = null;
      setS('paused');
    } catch {
      /* unsupported: ignore */
    }
  }, [setS]);

  const resume = useCallback(() => {
    const rec = recRef.current;
    if (!rec || stateRef.current !== 'paused' || rec.state !== 'paused') return;
    try {
      rec.resume();
      segmentStartRef.current = performance.now();
      setS('recording');
    } catch {
      /* ignore */
    }
  }, [setS]);

  const cancel = useCallback(() => {
    const s = stateRef.current;
    if (s === 'requesting') {
      sessionRef.current++; // the pending permission result will release its stream
      releaseHardware();
      setS('idle');
      return;
    }
    if (s === 'recording' || s === 'paused') {
      discardRef.current = true;
      stopWith('user');
      return;
    }
    revokeTake();
    setTake(null);
    setElapsed(0);
    setError(null);
    setNotice(null);
    setS('idle');
  }, [releaseHardware, revokeTake, setS, stopWith]);

  const reset = useCallback(() => {
    if (stateRef.current === 'recording' || stateRef.current === 'paused' || stateRef.current === 'requesting') return cancel();
    revokeTake();
    setTake(null);
    setElapsed(0);
    setError(null);
    setNotice(null);
    setS('idle');
  }, [cancel, revokeTake, setS]);

  // Stop (and keep) the recording if the app goes to the background; Android may kill the mic otherwise.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') stopWith('background');
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [stopWith]);

  // Unmount: discard any in-progress recording and release the microphone.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sessionRef.current++;
      discardRef.current = true;
      try {
        if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
      } catch {
        /* ignore */
      }
      recRef.current = null;
      releaseHardware();
      if (takeUrlRef.current) URL.revokeObjectURL(takeUrlRef.current);
    };
  }, [releaseHardware]);

  return { state, elapsedMs, level, take, error, notice, canPause, start, stop, pause, resume, cancel, reset };
}
