import { useEffect, useRef, useState } from 'react';
import { isEmbedded, isFilePage } from '../lib/mic';
import { t } from '../lib/strings';

/** Live camera: point at a word, press «بگیر», and the photo goes to the tutor. */
export function CameraCapture({ onPhoto, onCancel, onFallback }: { onPhoto: (b: Blob) => void; onCancel: () => void; onFallback: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setError(t.cameraUnavailable);
      try {
        // The browser shows its own «allow camera?» prompt here when needed.
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
        if (!alive) return s.getTracks().forEach((tr) => tr.stop());
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setError(
          name === 'NotFoundError' ? t.cameraUnavailable : isFilePage() ? t.cameraFilePage : isEmbedded() ? t.cameraEmbedded : t.cameraDenied,
        );
      }
    })();
    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach((tr) => tr.stop()); // always turn the camera off
    };
  }, []);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    c.toBlob((b) => b && onPhoto(b), 'image/jpeg', 0.9);
  };

  return (
    <div className="overlay" role="presentation">
      <div className="dialog camera-dialog" role="dialog" aria-modal="true" aria-label={t.tutorCamera}>
        {error ? (
          <>
            <p className="msg msg-error">{error}</p>
            <button className="btn btn-primary" onClick={onFallback}>📸 {t.tutorPhoto}</button>
          </>
        ) : (
          <>
            <video ref={videoRef} className="camera-video" playsInline muted />
            <p className="meta">{t.cameraHelp}</p>
            <button className="btn btn-confirm btn-big wide" onClick={capture} disabled={!ready}>📸 {t.cameraShoot}</button>
          </>
        )}
        <button className="btn btn-ghost" onClick={onCancel}>{t.cancel}</button>
      </div>
    </div>
  );
}
