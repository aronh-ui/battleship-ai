import { useState } from 'react';
import { useAudio } from '../audio/context';

const SLIDERS = [
  { key: 'master', label: 'Master' },
  { key: 'music', label: 'Music' },
] as const;

export function AudioControls() {
  const { levels, enabled, setLevels, toggleMute, play } = useAudio();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div className="flex overflow-hidden rounded-lg border border-sea-600">
        <button
          type="button"
          onClick={() => {
            toggleMute();
            play('click');
          }}
          aria-pressed={levels.muted}
          aria-label={levels.muted ? 'Unmute audio' : 'Mute audio'}
          className="bg-sea-800 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-sea-700"
        >
          {levels.muted ? 'Sound off' : 'Sound on'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            play('click');
          }}
          aria-expanded={open}
          aria-label="Audio settings"
          className="border-l border-sea-600 bg-sea-800 px-2 py-1.5 text-sm text-slate-300 transition hover:bg-sea-700"
        >
          ▾
        </button>
      </div>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-lg border border-sea-600 bg-sea-800 p-3 shadow-xl">
          {SLIDERS.map(({ key, label }) => (
            <label key={key} className="mb-2 block text-xs text-slate-300">
              <span className="mb-1 flex justify-between">
                <span>{label}</span>
                <span className="tabular-nums text-slate-400">
                  {Math.round(levels[key] * 100)}
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(levels[key] * 100)}
                aria-label={`${label} volume`}
                onChange={(event) =>
                  setLevels({ [key]: Number(event.target.value) / 100 })
                }
                className="w-full accent-cyan-400"
              />
            </label>
          ))}
          <p className="mt-1 text-[0.65rem] leading-snug text-slate-400">
            {enabled
              ? 'Music loops for the whole match.'
              : 'Music starts after your first click, per browser autoplay rules.'}
          </p>
          <p className="mt-1.5 text-[0.6rem] leading-snug text-slate-500">
            "Clash Defiant" Kevin MacLeod (incompetech.com). Licensed under Creative
            Commons: By Attribution 4.0 —{' '}
            <a
              href="http://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-slate-300"
            >
              CC BY 4.0
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
