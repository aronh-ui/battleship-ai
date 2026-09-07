# Audio licenses

**This project ships no audio files.** Every sound in the game — music beds and
sound effects alike — is synthesised in the browser at runtime with the Web Audio
API (oscillators, gain envelopes, filters and an in-memory noise buffer generated
from `Math.random()`), in `src/audio/engine.ts`.

There are therefore no external audio assets, no third-party samples, no
downloaded or ripped media, and no attribution requirements. The repository
contains no `.mp3`, `.ogg`, `.wav` or other media binaries.

| Asset | Source | License | Attribution |
| --- | --- | --- | --- |
| _(none)_ | — | — | — |

## Why procedural audio

- **Zero licensing ambiguity.** Nothing has to be verified as usable in a public
  repository and a public deployment, because nothing was sourced externally.
- **No large media files.** The whole audio layer is a few kB of TypeScript
  instead of megabytes of tracks, which keeps the static bundle small.
- **Adaptive by construction.** Scenes (menu, setup, battle, AI turn, last stand,
  victory, defeat) crossfade by re-scheduling the synth rather than by streaming
  and beat-matching separate files.

The compositions are original: simple modal chord beds with an arpeggiated
sequence over them. They are not modelled on, and do not attempt to evoke, any
identifiable existing score, franchise theme or artist's work. The trade-off is
honest to state: synthesised music is thinner than a professionally recorded
cinematic score. If richer audio is ever wanted, replace the engine with properly
licensed royalty-free tracks and document each file in the table above with
filename, track name, creator, source URL, license and required attribution text.

## Runtime behaviour

- No audio node is created and no sound is played before the first user
  interaction: the audio context is constructed lazily on the first `pointerdown`
  or `keydown` (see `src/audio/AudioProvider.tsx`), which satisfies
  browser autoplay policies.
- Master, music and effects volumes plus mute are user-controlled and persisted
  in `localStorage`.
