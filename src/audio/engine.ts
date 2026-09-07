/**
 * All music and sound effects are synthesised in the browser with the Web Audio
 * API — there are no audio files in this repository, so nothing here depends on
 * third-party media licensing. See AUDIO_LICENSES.md.
 *
 * The engine is intentionally dumb about the game: callers ask for a musical
 * "scene" or a one-shot effect, and it schedules oscillators accordingly.
 */

declare global {
  interface Window {
    /** Safari still exposes the prefixed constructor. */
    webkitAudioContext?: typeof AudioContext;
  }
}

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

interface SceneSpec {
  /** Root note of the drone, in Hz. */
  root: number;
  /** Scale degrees (semitones above the root) the arpeggio may use. */
  scale: number[];
  /** Seconds between arpeggio notes. */
  step: number;
  padGain: number;
  pulseGain: number;
  /** Chance a given step plays a note at all — sparser feels more deliberate. */
  density: number;
  sonarEvery: number;
}

const SCENES: Record<Exclude<MusicScene, 'silent'>, SceneSpec> = {
  menu: {
    root: 55,
    scale: [0, 7, 12, 15, 19],
    step: 0.85,
    padGain: 0.16,
    pulseGain: 0.05,
    density: 0.35,
    sonarEvery: 8,
  },
  setup: {
    root: 65.4,
    scale: [0, 5, 7, 12, 14, 17],
    step: 0.6,
    padGain: 0.14,
    pulseGain: 0.06,
    density: 0.5,
    sonarEvery: 12,
  },
  battle: {
    root: 49,
    scale: [0, 3, 7, 10, 12, 15],
    step: 0.4,
    padGain: 0.18,
    pulseGain: 0.08,
    density: 0.62,
    sonarEvery: 16,
  },
  aiturn: {
    root: 43.65,
    scale: [0, 1, 5, 8, 12],
    step: 0.3,
    padGain: 0.2,
    pulseGain: 0.07,
    density: 0.75,
    sonarEvery: 5,
  },
  lastStand: {
    root: 41.2,
    scale: [0, 2, 3, 7, 9, 14],
    step: 0.24,
    padGain: 0.22,
    pulseGain: 0.1,
    density: 0.85,
    sonarEvery: 9,
  },
  victory: {
    root: 65.4,
    scale: [0, 4, 7, 11, 12, 16, 19],
    step: 0.3,
    padGain: 0.2,
    pulseGain: 0.12,
    density: 0.9,
    sonarEvery: 0,
  },
  defeat: {
    root: 38.9,
    scale: [0, 1, 3, 6, 8],
    step: 0.9,
    padGain: 0.22,
    pulseGain: 0.05,
    density: 0.4,
    sonarEvery: 0,
  },
};

const LOOKAHEAD_MS = 120;
const SCHEDULE_AHEAD_S = 0.35;

function semitone(root: number, steps: number): number {
  return root * Math.pow(2, steps / 12);
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private padVoices: { osc: OscillatorNode; gain: GainNode }[] = [];
  private padFilter: BiquadFilterNode | null = null;
  private scene: MusicScene = 'silent';
  private timer: number | undefined;
  private nextNoteAt = 0;
  private stepIndex = 0;
  private levels: Levels = { ...DEFAULT_LEVELS };
  private noise: AudioBuffer | null = null;

  get started(): boolean {
    return this.ctx !== null;
  }

  /** Must be called from a user gesture: browsers block audio before that. */
  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);

    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 700;
    this.padFilter.Q.value = 0.7;
    this.padFilter.connect(this.musicBus);

    this.noise = this.buildNoise(ctx);
    this.applyLevels();
    if (this.scene !== 'silent') this.setScene(this.scene, true);
  }

  private buildNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  setLevels(levels: Levels): void {
    this.levels = levels;
    this.applyLevels();
  }

  private applyLevels(): void {
    if (!this.ctx || !this.master || !this.musicBus || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const master = this.levels.muted ? 0 : this.levels.master;
    this.master.gain.setTargetAtTime(master, now, 0.05);
    this.musicBus.gain.setTargetAtTime(this.levels.music, now, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.levels.sfx, now, 0.05);
  }

  setScene(scene: MusicScene, force = false): void {
    if (scene === this.scene && !force) return;
    this.scene = scene;
    if (!this.ctx || !this.padFilter) return;

    this.stopPad();
    window.clearInterval(this.timer);
    this.timer = undefined;
    if (scene === 'silent') return;

    const spec = SCENES[scene];
    const now = this.ctx.currentTime;
    // A drone plus a fifth and an octave: enough to feel like a score, cheap to run.
    for (const [interval, detune] of [
      [0, -6],
      [0, 7],
      [7, 0],
      [12, 4],
    ] as const) {
      const osc = this.ctx.createOscillator();
      osc.type = interval === 12 ? 'triangle' : 'sawtooth';
      osc.frequency.value = semitone(spec.root, interval);
      osc.detune.value = detune;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(spec.padGain / 4, now, 1.2);
      osc.connect(gain).connect(this.padFilter);
      osc.start();
      this.padVoices.push({ osc, gain });
    }

    this.nextNoteAt = now + 0.1;
    this.stepIndex = 0;
    this.timer = window.setInterval(() => this.schedule(spec), LOOKAHEAD_MS);
  }

  private stopPad(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const { osc, gain } of this.padVoices) {
      gain.gain.setTargetAtTime(0, now, 0.25);
      osc.stop(now + 1.2);
    }
    this.padVoices = [];
  }

  private schedule(spec: SceneSpec): void {
    if (!this.ctx || !this.musicBus) return;
    const ctx = this.ctx;
    while (this.nextNoteAt < ctx.currentTime + SCHEDULE_AHEAD_S) {
      const at = this.nextNoteAt;
      if (Math.random() < spec.density) {
        const degree = spec.scale[Math.floor(Math.random() * spec.scale.length)];
        const octave = Math.random() < 0.35 ? 36 : 24;
        this.pluck(semitone(spec.root, degree + octave), at, spec.pulseGain);
      }
      if (spec.sonarEvery > 0 && this.stepIndex % spec.sonarEvery === 0) {
        this.ping(semitone(spec.root, 24), at, spec.pulseGain * 0.9);
      }
      this.stepIndex++;
      this.nextNoteAt += spec.step;
    }
  }

  private pluck(freq: number, at: number, gainValue: number): void {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(gainValue, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
    osc.connect(gain).connect(this.musicBus);
    osc.start(at);
    osc.stop(at + 1);
  }

  private ping(freq: number, at: number, gainValue: number): void {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 2, at);
    osc.frequency.exponentialRampToValueAtTime(freq, at + 0.5);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(gainValue, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
    osc.connect(gain).connect(this.musicBus);
    osc.start(at);
    osc.stop(at + 1.2);
  }

  private noiseBurst(
    at: number,
    duration: number,
    gainValue: number,
    filter: { type: BiquadFilterType; from: number; to: number },
  ): void {
    if (!this.ctx || !this.sfxBus || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const band = this.ctx.createBiquadFilter();
    band.type = filter.type;
    band.frequency.setValueAtTime(filter.from, at);
    band.frequency.exponentialRampToValueAtTime(Math.max(filter.to, 40), at + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(gainValue, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    src.connect(band).connect(gain).connect(this.sfxBus);
    src.start(at);
    src.stop(at + duration + 0.05);
  }

  private tone(
    at: number,
    type: OscillatorType,
    from: number,
    to: number,
    duration: number,
    gainValue: number,
  ): void {
    if (!this.ctx || !this.sfxBus) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 20), at + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(gainValue, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(at);
    osc.stop(at + duration + 0.05);
  }

  play(sound: SoundName): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    switch (sound) {
      case 'click':
        this.tone(t, 'square', 880, 660, 0.06, 0.12);
        break;
      case 'place':
        this.tone(t, 'triangle', 220, 440, 0.14, 0.2);
        this.noiseBurst(t, 0.18, 0.1, { type: 'lowpass', from: 900, to: 200 });
        break;
      case 'rotate':
        this.tone(t, 'sine', 520, 780, 0.1, 0.14);
        break;
      case 'invalid':
        this.tone(t, 'sawtooth', 180, 90, 0.22, 0.16);
        break;
      case 'fire':
        this.tone(t, 'sawtooth', 700, 120, 0.28, 0.16);
        this.noiseBurst(t, 0.3, 0.14, { type: 'bandpass', from: 1800, to: 300 });
        break;
      case 'aiFire':
        this.tone(t, 'square', 420, 90, 0.3, 0.12);
        this.noiseBurst(t, 0.32, 0.1, { type: 'bandpass', from: 1200, to: 220 });
        break;
      case 'miss':
        this.noiseBurst(t, 0.5, 0.24, { type: 'lowpass', from: 2600, to: 220 });
        this.tone(t + 0.02, 'sine', 320, 140, 0.3, 0.07);
        break;
      case 'hit':
        this.tone(t, 'sine', 160, 45, 0.5, 0.34);
        this.noiseBurst(t, 0.45, 0.28, { type: 'lowpass', from: 3200, to: 160 });
        break;
      case 'sink':
        this.tone(t, 'sine', 140, 32, 1.3, 0.36);
        this.noiseBurst(t, 1.2, 0.3, { type: 'lowpass', from: 2400, to: 90 });
        [0, 4, 7].forEach((s, i) =>
          this.tone(t + 0.12 + i * 0.09, 'triangle', semitone(196, s), semitone(196, s), 0.5, 0.13),
        );
        break;
      case 'sonar':
        this.ping(720, t, 0.1);
        break;
      case 'victory':
        [0, 4, 7, 12, 16].forEach((s, i) =>
          this.tone(t + i * 0.13, 'triangle', semitone(261.6, s), semitone(261.6, s), 0.9, 0.18),
        );
        break;
      case 'defeat':
        [0, -3, -7, -12].forEach((s, i) =>
          this.tone(t + i * 0.26, 'sawtooth', semitone(174.6, s), semitone(174.6, s), 1.1, 0.14),
        );
        break;
    }
  }

  dispose(): void {
    window.clearInterval(this.timer);
    this.stopPad();
    void this.ctx?.close();
    this.ctx = null;
  }
}
