import { useEffect, useState } from 'react';
import * as player from '../lib/player';
import { t } from '../lib/strings';

interface Props {
  playKey: string;
  /** Resolves the URL of the ORIGINAL recording (local preview or cloud). */
  getUrl: () => Promise<string>;
  label?: string;
  big?: boolean;
  onError?: (msg: string) => void;
}

/** Plays the learner's own recording. Unlimited replays. */
export function PlayButton({ playKey, getUrl, label = t.playMine, big, onError }: Props) {
  const [playing, setPlaying] = useState(player.playingKey() === playKey);
  const [loading, setLoading] = useState(false);

  useEffect(() => player.subscribe((k) => setPlaying(k === playKey)), [playKey]);

  const onClick = async () => {
    if (loading) return;
    if (playing) return player.stopPlayback();
    setLoading(true);
    try {
      const url = await getUrl();
      await player.play(playKey, url);
    } catch {
      onError?.(t.audioLoadFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className={`btn btn-play${big ? ' btn-big' : ''}${playing ? ' is-playing' : ''}`}
      onClick={onClick}
      aria-pressed={playing}
      aria-busy={loading}
    >
      <span className="btn-icon" aria-hidden>{loading ? '⏳' : playing ? '⏹️' : '▶️'}</span>
      <span>{label}</span>
    </button>
  );
}
