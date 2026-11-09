import { useEffect, useState } from 'react';
import { decodeTo16kMono } from '../lib/asr';
import { type MicPermission, isEmbedded, isFilePage, micPermission, requestMicrophone } from '../lib/mic';
import { isNativeApp, nativeMicGranted, nativeOpenAppSettings, nativeRequestMic } from '../lib/native';
import { t } from '../lib/strings';
import { VoiceNoteError, startVoiceNote } from '../lib/voiceNote';

type Result = { ok: boolean; text: string; detail?: string };

/** «🎙️ میکروفون»: ask permission directly, then a 2-second test that records, measures and plays back. */
export function MicCheck() {
  const native = isNativeApp();
  const [perm, setPerm] = useState<MicPermission>('unknown');
  const [result, setResult] = useState<Result | null>(null);
  const [testing, setTesting] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const refresh = async () => {
    if (native) {
      const g = nativeMicGranted();
      setPerm(g === null ? 'unknown' : g ? 'granted' : 'prompt');
    } else setPerm(await micPermission());
  };
  useEffect(() => {
    void refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = async () => {
    if (native) {
      const r = await nativeRequestMic(); // Android's own «Allow?» dialog
      setBlocked(!r.granted && !!r.blocked);
      setResult(r.granted ? { ok: true, text: t.micOk } : { ok: false, text: r.blocked ? t.micBlockedApp : t.errMicApp });
    } else {
      const problem = await requestMicrophone();
      setResult(problem ? { ok: false, text: problem } : { ok: true, text: t.micOk });
    }
    await refresh();
  };

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const note = await startVoiceNote();
      await new Promise((r) => setTimeout(r, 2000));
      const audio = await note.stop();
      if (!audio || audio.size < 500) throw new VoiceNoteError(t.errEmpty);
      let peak = 0;
      try {
        for (const v of await decodeTo16kMono(audio)) peak = Math.max(peak, Math.abs(v));
      } catch {
        peak = -1; // could not measure; still play it back
      }
      void new Audio(URL.createObjectURL(audio)).play().catch(() => undefined);
      setResult(
        peak === -1 || peak > 0.02
          ? { ok: true, text: t.micTestOk(peak === -1 ? '' : `${Math.round(peak * 100)}٪`) }
          : { ok: false, text: t.micTestSilent },
      );
    } catch (e) {
      setResult({ ok: false, text: e instanceof VoiceNoteError ? e.message : t.errRecorder, detail: String((e as Error)?.message ?? e) });
    } finally {
      setTesting(false);
      await refresh();
    }
  };

  const where = native ? 'Android app' : isFilePage() ? 'file page' : isEmbedded() ? 'embedded page' : window.isSecureContext ? 'website (https)' : 'insecure page';

  return (
    <div className="card mic-check">
      <h2>{t.micTitle}</h2>
      <p className="meta">{native ? t.micHelpApp : t.micHelp}</p>
      {perm !== 'unknown' && <p className="meta">{perm === 'granted' ? t.micStateGranted : perm === 'denied' ? t.micStateDenied : t.micStatePrompt}</p>}
      <div className="row wrap">
        <button className="btn btn-primary" onClick={ask}>🎙️ {t.micAsk}</button>
        <button className="btn btn-secondary" onClick={test} disabled={testing}>{testing ? `⏺️ ${t.micTesting}` : `🔊 ${t.micTest}`}</button>
        {native && blocked && <button className="btn btn-ghost" onClick={nativeOpenAppSettings}>⚙️ {t.openAppSettings}</button>}
      </div>
      {result && (
        <p className={`msg ${result.ok ? 'msg-success' : 'msg-error'}`} role="status">
          {result.text}
        </p>
      )}
      <p className="meta diag" dir="ltr">
        {where} · permission: {perm}
        {result?.detail ? ` · ${result.detail}` : ''}
      </p>
    </div>
  );
}
