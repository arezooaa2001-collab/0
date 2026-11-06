// One shared <audio> element so only one recording plays at a time.
type Listener = (playingKey: string | null) => void;

let audio: HTMLAudioElement | null = null;
let currentKey: string | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(currentKey));
}

function el(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
    audio.addEventListener('ended', () => {
      currentKey = null;
      emit();
    });
    audio.addEventListener('pause', () => {
      if (audio && !audio.ended) {
        currentKey = null;
        emit();
      }
    });
  }
  return audio;
}

/** Play an audio URL from the start. Can be called any number of times. */
export async function play(key: string, url: string): Promise<void> {
  const a = el();
  if (currentKey) stopPlayback();
  if (a.src !== url) a.src = url;
  a.currentTime = 0;
  currentKey = key;
  emit();
  try {
    await a.play();
  } catch (e) {
    currentKey = null;
    emit();
    throw e;
  }
}

export function stopPlayback(): void {
  if (audio && !audio.paused) audio.pause();
  if (audio) audio.currentTime = 0;
  currentKey = null;
  emit();
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function playingKey(): string | null {
  return currentKey;
}
