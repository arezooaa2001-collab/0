import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { isEmbedded, isFilePage } from '../lib/mic';
import { isNativeApp, nativeOpenAppSettings, nativeRequestCamera } from '../lib/native';
import { t } from '../lib/strings';

export interface CameraPanelHandle {
  /** The current camera picture as a small JPEG (null if the camera is not showing yet). */
  snapshot(): Promise<Blob | null>;
}

type Facing = 'user' | 'environment';

/**
 * Live camera for the tutor. While it is open, every question goes to the AI together with
 * what the camera sees, e.g. a word the child holds up: «این را به فارسی ترجمه کن».
 */
export const CameraPanel = forwardRef<CameraPanelHandle, { onClose: () => void }>(function CameraPanel({ onClose }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>('environment');
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let alive = true;
    setError(null);
    (async () => {
      // Android app: ask for the camera with Android's own dialog first.
      const perm = await nativeRequestCamera();
      if (perm && !perm.granted) {
        setBlocked(!!perm.blocked);
        return alive && setError(perm.blocked ? t.cameraBlockedApp : t.cameraDeniedApp);
      }
      if (!navigator.mediaDevices?.getUserMedia) return alive && setError(t.cameraUnavailable);
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 960 } }, audio: false });
        if (!alive) return s.getTracks().forEach((tr) => tr.stop());
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch (e) {
        const name = (e as { name?: string })?.name;
        if (!alive) return;
        setError(
          name === 'NotFoundError' || name === 'OverconstrainedError'
            ? t.cameraUnavailable
            : isNativeApp()
              ? t.cameraDeniedApp
              : isFilePage()
                ? t.cameraFilePage
                : isEmbedded()
                  ? t.cameraEmbedded
                  : t.cameraDenied,
        );
      }
    })();
    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach((tr) => tr.stop()); // always turn the camera off
      streamRef.current = null;
    };
  }, [facing]);

  useImperativeHandle(ref, () => ({
    snapshot: async () => {
      const v = videoRef.current;
      // Check the video itself (not a state flag), so a picture is taken even right after switching cameras.
      if (!v || !v.srcObject || v.readyState < 2 || !v.videoWidth) return null;
      const scale = Math.min(1, 768 / Math.max(v.videoWidth, v.videoHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(v.videoWidth * scale);
      c.height = Math.round(v.videoHeight * scale);
      c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
      return new Promise<Blob | null>((resolve) => c.toBlob((b) => resolve(b), 'image/jpeg', 0.75));
    },
  }));

  return (
    <div className="card camera-panel">
      {error ? (
        <>
          <p className="msg msg-error">{error}</p>
          {blocked && <button className="btn btn-ghost" onClick={nativeOpenAppSettings}>⚙️ {t.openAppSettings}</button>}
        </>
      ) : (
        <video ref={videoRef} className={`camera-live${facing === 'user' ? ' mirrored' : ''}`} playsInline muted aria-label={t.tutorCamera} />
      )}
      <p className="meta">{t.cameraLiveHelp}</p>
      <div className="row wrap center">
        <button className="btn btn-secondary" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}>
          🔄 {facing === 'user' ? t.cameraUseBack : t.cameraUseFront}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>✖️ {t.cameraClose}</button>
      </div>
    </div>
  );
});
