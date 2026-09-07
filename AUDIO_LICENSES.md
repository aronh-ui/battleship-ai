# Audio licenses

The game plays one music track, looped for the whole experience. There are no sound
effects and no other audio assets.

| Filename | Track | Creator | Source | License | Attribution required |
| --- | --- | --- | --- | --- | --- |
| `public/audio/clash-defiant.mp3` | Clash Defiant (ISRC USUAN1600003) | Kevin MacLeod (incompetech.com) | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1600003 | Creative Commons: By Attribution 4.0 — https://creativecommons.org/licenses/by/4.0/ | Yes |

## Attribution text

> "Clash Defiant" Kevin MacLeod (incompetech.com)
> Licensed under Creative Commons: By Attribution 4.0 License
> http://creativecommons.org/licenses/by/4.0/

This attribution is shown in the in-game audio controls and reproduced here as required
by the license. The file is unmodified apart from being renamed.

## Runtime behaviour

- Nothing plays before the first pointer or keyboard interaction (browser autoplay policy).
- The track starts on the first interaction and loops; it pauses only when the game has
  no scene to play.
- Master volume, music volume and mute persist in `localStorage`.
