import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AudioContext as AudioStateContext, LEVELS_STORAGE_KEY, parseLevels } from './context';
import { AudioEngine, type Levels, type MusicScene, type SoundName } from './engine';

function readStoredLevels(): Levels {
  try {
    return parseLevels(window.localStorage.getItem(LEVELS_STORAGE_KEY));
  } catch {
    return parseLevels(null);
  }
}

/**
 * Owns the single AudioEngine instance. Nothing is audible until the first user
 * gesture, which is what browser autoplay policies require.
 */
export function AudioProvider({ children }: { children: ReactNode }) {
  const engine = useRef<AudioEngine | null>(null);
  const [levels, setLevelsState] = useState<Levels>(readStoredLevels);
  const [enabled, setEnabled] = useState(false);
  const pendingScene = useRef<MusicScene>('silent');

  if (engine.current === null) engine.current = new AudioEngine();

  useEffect(() => {
    const unlock = () => {
      engine.current?.start();
      engine.current?.setLevels(levels);
      engine.current?.setScene(pendingScene.current);
      setEnabled(true);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    // Only the first gesture matters; later level changes are pushed separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engine.current?.setLevels(levels);
    try {
      window.localStorage.setItem(LEVELS_STORAGE_KEY, JSON.stringify(levels));
    } catch {
      // Private-mode storage failures must not break audio.
    }
  }, [levels]);

  useEffect(() => () => engine.current?.dispose(), []);

  const setLevels = useCallback((patch: Partial<Levels>) => {
    setLevelsState((current) => ({ ...current, ...patch }));
  }, []);

  const toggleMute = useCallback(() => {
    setLevelsState((current) => ({ ...current, muted: !current.muted }));
  }, []);

  const play = useCallback((sound: SoundName) => engine.current?.play(sound), []);

  const setScene = useCallback((scene: MusicScene) => {
    pendingScene.current = scene;
    engine.current?.setScene(scene);
  }, []);

  const api = useMemo(
    () => ({ levels, enabled, setLevels, toggleMute, play, setScene }),
    [levels, enabled, setLevels, toggleMute, play, setScene],
  );

  return <AudioStateContext.Provider value={api}>{children}</AudioStateContext.Provider>;
}
