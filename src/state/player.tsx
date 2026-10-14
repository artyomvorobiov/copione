import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface PlayerValue {
  /** URL of the preview that is currently playing, if any. */
  playingUrl: string | null;
  toggle: (url: string) => void;
  stop: () => void;
}

const PlayerContext = createContext<PlayerValue>({ playingUrl: null, toggle: () => {}, stop: () => {} });

/** One shared audio player for 30-second track previews. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    // Let previews play even when the iPhone's ring/silent switch is on silent.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const toggle = useCallback(
    (url: string) => {
      if (current === url && status.playing) {
        player.pause();
        setCurrent(null);
        return;
      }
      if (current !== url) player.replace({ uri: url });
      else player.seekTo(0).catch(() => {});
      setCurrent(url);
      player.play();
    },
    [current, status.playing, player],
  );

  const stop = useCallback(() => {
    player.pause();
    setCurrent(null);
  }, [player]);

  // A preview that played to the end is no longer "playing".
  const playingUrl = current && !status.didJustFinish ? current : null;
  const value = useMemo(() => ({ playingUrl, toggle, stop }), [playingUrl, toggle, stop]);
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerValue {
  return useContext(PlayerContext);
}
