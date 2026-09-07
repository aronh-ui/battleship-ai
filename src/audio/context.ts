import { createContext, useContext } from 'react';
import type { Levels, MusicScene, SoundName } from './engine';
import { DEFAULT_LEVELS } from './engine';

export interface AudioApi {
  levels: Levels;
  /** True once the user has interacted and the audio context exists. */
  enabled: boolean;
  setLevels: (levels: Partial<Levels>) => void;
  toggleMute: () => void;
  play: (sound: SoundName) => void;
  setScene: (scene: MusicScene) => void;
}

const noop = () => {};

export const AudioContext = createContext<AudioApi>({
  levels: DEFAULT_LEVELS,
  enabled: false,
  setLevels: noop,
  toggleMute: noop,
  play: noop,
  setScene: noop,
});

export function useAudio(): AudioApi {
  return useContext(AudioContext);
}

export const LEVELS_STORAGE_KEY = 'battleship-ai:audio';

export function parseLevels(raw: string | null): Levels {
  if (!raw) return DEFAULT_LEVELS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_LEVELS;
    const value = parsed as Partial<Record<keyof Levels, unknown>>;
    const num = (key: 'master' | 'music' | 'sfx') =>
      typeof value[key] === 'number' && value[key] >= 0 && value[key] <= 1
        ? value[key]
        : DEFAULT_LEVELS[key];
    return {
      master: num('master'),
      music: num('music'),
      sfx: num('sfx'),
      muted: typeof value.muted === 'boolean' ? value.muted : DEFAULT_LEVELS.muted,
    };
  } catch {
    return DEFAULT_LEVELS;
  }
}
