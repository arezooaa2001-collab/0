// Plays the «AMIR ABC» intro music (src/brand/intro-music.mp3, rendered from the score in
// src/brand/introMusicScore.ts by scripts/make-music.cjs). The MP3 is inside the app itself:
// nothing is downloaded, and playing it costs almost no processor time.
import musicDataUrl from '../brand/intro-music.mp3?inline';

/** The drop (where the guide appears), in seconds from the start of the track. */
export const MUSIC_DROP_S = 4;

export interface MusicHandle {
  /** Fade out (seconds) and release the audio device. */
  stop: (fade?: number) => void;
}

function dataUrlBytes(url: string): ArrayBuffer {
  const b64 = url.slice(url.indexOf(',') + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Start the track. `onStart` is called the moment it really starts playing (after decoding),
 * so the screen can match the drop. Returns null if this device cannot play Web Audio.
 */
export function playIntroMusic(onStart?: () => void, volume = 0.9): MusicHandle | null {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  let ctx: AudioContext;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  let stopped = false;
  let src: AudioBufferSourceNode | null = null;
  const close = () => {
    if (ctx.state !== 'closed') void ctx.close().catch(() => undefined);
  };
  setMusicState('loading');
  void ctx.resume().catch(() => undefined);
  void (async () => {
    try {
      const buf = await ctx.decodeAudioData(dataUrlBytes(musicDataUrl));
      if (stopped) return;
      src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(master);
      src.onended = () => {
        if (stopped) return;
        stopped = true;
        setMusicState('ended');
        close();
      };
      src.start();
      setMusicState('playing');
      onStart?.();
    } catch {
      setMusicState('failed');
      close();
    }
  })();
  return {
    stop(fade = 0.35) {
      if (stopped) return;
      stopped = true;
      setMusicState('stopped');
      try {
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(0, now + fade);
        src?.stop(now + fade + 0.02);
      } catch {
        /* closing anyway */
      }
      setTimeout(close, fade * 1000 + 80);
    },
  };
}

/** For the tests: what the music is doing. */
function setMusicState(s: 'loading' | 'playing' | 'stopped' | 'ended' | 'failed') {
  (globalThis as { __ECHOWORDS_MUSIC__?: string }).__ECHOWORDS_MUSIC__ = s;
}

const MUSIC_KEY = 'echowords-about-music';
export function musicEnabled(): boolean {
  try {
    return localStorage.getItem(MUSIC_KEY) !== 'off';
  } catch {
    return true;
  }
}
export function setMusicEnabled(on: boolean): void {
  try {
    localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
}
