/**
 * Audio is a single licensed music track ("Clash Defiant" by Kevin MacLeod,
 * CC BY 4.0 — see AUDIO_LICENSES.md) looped for the whole experience. There are
 * no sound effects. The scene/sound API is kept so the game code stays untouched:
 * scenes only decide whether the track plays; sounds are no-ops.
 */

export type MusicScene =
  | 'silent'
  | 'menu'
  | 'setup'
  | 'battle'
  | 'aiturn'
  | 'lastStand'
  | 'victory'
  | 'defeat';

export type SoundName =
  | 'click'
  | 'place'
  | 'rotate'
  | 'invalid'
  | 'fire'
  | 'miss'
  | 'hit'
  | 'sink'
  | 'aiFire'
  | 'sonar'
  | 'victory'
  | 'defeat';

export interface Levels {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

export const DEFAULT_LEVELS: Levels = {
  master: 0.7,
  music: 0.45,
  sfx: 0.8,
  muted: false,
};

export const TRACK_URL = `${import.meta.env.BASE_URL}audio/clash-defiant.mp3`;

export class AudioEngine {
  private track: HTMLAudioElement | null = null;
  private levels: Levels = DEFAULT_LEVELS;
  private scene: MusicScene = 'silent';

  /** Must be called from a user gesture so autoplay policies allow playback. */
  start(): void {
    if (this.track) return;
    this.track = new Audio(TRACK_URL);
    this.track.loop = true;
    this.track.preload = 'auto';
    this.applyLevels();
    this.applyScene();
  }

  setLevels(levels: Levels): void {
    this.levels = levels;
    this.applyLevels();
  }

  setScene(scene: MusicScene): void {
    this.scene = scene;
    this.applyScene();
  }

  play(_sound: SoundName): void {
    // No sound effects: the licensed track carries the whole experience.
  }

  dispose(): void {
    this.track?.pause();
    this.track = null;
  }

  private applyLevels(): void {
    if (!this.track) return;
    const { master, music, muted } = this.levels;
    this.track.volume = muted ? 0 : Math.min(1, master * music);
    this.track.muted = muted;
  }

  private applyScene(): void {
    if (!this.track) return;
    if (this.scene === 'silent') {
      this.track.pause();
      return;
    }
    if (this.track.paused) {
      this.track.play().catch(() => {
        // Playback blocked (e.g. no user gesture yet); a later scene change retries.
      });
    }
  }
}
