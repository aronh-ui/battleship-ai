# Bugs and fixes

QA log for Battleship AI: what was tested, what broke, and how each fix was verified.

## Testing performed

| Check                     | How                                                                                       | Result                                        |
| ------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| Engine unit tests         | `npm test` (Vitest, 6 files / 57 tests)                                                     | Passing                                       |
| Type check + bundle       | `npm run build` (`tsc -b && vite build`)                                                    | Passing, no type errors                       |
| Lint                      | `npm run lint` (oxlint)                                                                     | Clean (one warning found and fixed, see BUG-1) |
| Full playthrough, desktop | `npm run qa:playthrough` at 1280×900 — Playwright over CDP against the dev server           | Passing, loss path                            |
| Full playthrough, win     | `npm run qa:playthrough -- <url> --easy` — scripted player uses hunt/target against Easy AI | Passing, victory path                         |
| Full playthrough, mobile  | `npm run qa:playthrough -- <url> --mobile` at 390×844                                       | Passing                                       |
| Console cleanliness       | Playwright collects `console.error`, `console.warn` and uncaught page errors during a game  | No errors or warnings                         |
| Layout overflow           | Script comparing `documentElement.scrollWidth` to the viewport at 390 px                    | No horizontal overflow                        |
| Visual review             | Screenshots of setup and battle at desktop and mobile widths                                | Two issues found, see BUG-2 and BUG-3         |
| Adversarial pass, live    | `npm run qa:adversarial -- https://aronh-ui.github.io/battleship-ai/ [--mobile]`             | Two issues found, see BUG-5 and BUG-6         |

Each scripted playthrough asserts: manual ship placement advances through the fleet in
order, overlapping and off-board placements are refused with an explanation, the rotate
toggle flips orientation, enemy ships stay hidden during setup, `Start battle` is
disabled until all five ships are placed, randomize completes the fleet (17 ship cells),
the game opens on the player's turn, an already-attacked cell cannot be clicked again, a
ship visibly sinks, the AI fires back, the win/loss modal appears and reveals all 17
enemy ship cells, and `Play again` returns both boards to a clean setup phase.

The adversarial pass (`scripts/adversarial.mjs`) additionally asserts, against the
deployed site on desktop and at 390×844: a ship is refused one cell past the right and
bottom edges and accepted exactly on them; double-clicking a cell places one ship, not
two; a forced click on the disabled `Start battle` button cannot start an incomplete
game; five randomizations in a row always yield exactly 17 ship cells; a burst of five
rapid clicks on five different enemy cells fires exactly one shot; clicking every enemy
cell during the AI's turn fires nothing; a full game is played click-by-click asserting
one shot per click and plausible AI accuracy; `Play again` clears both boards and
re-hides the enemy fleet; the game survives a mid-game `location.reload()`; the game-over
modal fits inside a 844 px-tall viewport.

---

## BUG-1 — Fast-refresh warning from mixing a helper export with components

**Description.** `oxlint` reported
`react(only-export-components): Fast refresh only works when a file only exports components`
for `src/components/GameBoard.tsx`, which exported both the `GameBoard` component and a
`coordLabel` helper.

**Reproduction.** `npm run lint`.

**Root cause.** The A1-style coordinate formatter lived next to the component. Besides
tripping the lint rule (React Fast Refresh cannot reliably hot-reload a module that
exports non-components), it also put a piece of domain vocabulary in the UI layer.

**Fix.** Moved the formatter and the column labels into `src/engine/coords.ts`, and added
`coords.test.ts` to cover it.

**Verification.** `npm run lint` is clean; `npm test` covers the moved helper; the app
still renders A–J / 1–10 axes (see the screenshots in `docs/`).

---

## BUG-2 — Enemy fleet panel leaked which ship had been hit

**Description.** The "Enemy fleet" sidebar drew one pip per ship cell and coloured the
damaged pips amber. After a hit, the panel therefore revealed *which* enemy ship had been
hit and how much of it was left — information a real Battleship opponent never gives you
until the ship sinks.

**Reproduction.** Start a game, hit any enemy ship without sinking it, and look at the
"Enemy fleet" panel: the hit ship shows an amber pip while the others do not.

**Root cause.** `FleetStatus` was rendered with the same props for both fleets, so the
component rendered `ship.hits` for the AI board too.

**Fix.** Added a `revealDamage` prop to `FleetStatus`. `App.tsx` passes it only for the
player's own fleet; the enemy panel now shows ships as intact until they sink, at which
point they turn red and are struck through — which is legitimate public information.

**Verification.** Replayed a game and confirmed the panel stays neutral after
non-sinking hits and only marks a ship once it actually sinks (`docs/screenshot-battle.png`
shows two sunk player ships and an undamaged-looking enemy panel while enemy hits are
visible on the board itself).

---

## BUG-3 — Ship placement preview was invisible on the hovered cell

**Description.** During setup, the green placement preview did not appear on the cell
under the cursor: the hovered cell kept the ordinary hover colour, so a 5-cell Carrier
looked like a 4-cell preview.

**Reproduction.** Load the app and hover any cell on your own board during setup.

**Root cause.** Cell classes were composed in order, and the interactive
`hover:bg-sea-600` utility was appended *after* the preview colour, so it won the
cascade on exactly the cell being hovered. The translucent `bg-emerald-400/70` used for
the rest of the preview was also washed out against the dark board.

**Fix.** Skip the hover utilities when a cell is part of the current preview, and use
solid `bg-emerald-400` / `bg-rose-500` for valid / invalid previews.

**Verification.** Re-took the setup screenshot: all five preview cells now render in the
same solid green (`docs/screenshot-setup.png`).

---

## BUG-4 — Board cells were unlabelled for assistive tech (and untestable)

**Description.** While writing the playthrough script, cells could only be identified by
position, and screen readers announced nothing useful; the modal's revealed fleet could
not be verified at all because hit cells dropped the ship name from their label.

**Reproduction.** Inspect any cell in the accessibility tree, or count ship cells in the
game-over modal — a ship cell that had been hit reported only `hit`, so the revealed
fleet appeared to be 16 cells instead of 17.

**Root cause.** The cell's accessible name was built with a chain of ternaries where the
attack outcome shadowed the ship name.

**Fix.** The label is now composed as `<coordinate> [<ship name>] <outcome>` whenever
ships are revealed for that board, e.g. `C5 Carrier hit`, and each cell also exposes
`data-cell` / `data-state` attributes for automation.

**Verification.** The playthrough script now counts exactly 17 ship cells on the player
board during setup and 17 in the game-over modal, and passes on desktop and mobile.

---

## BUG-5 — AI forgot a damaged ship when it sank a ship touching it

**Description.** With two ships butted against each other (e.g. a destroyer on A1-B1 and
a cruiser starting at C1), the Smart AI could sink one of them and immediately drop the
unresolved hits on its neighbour, reverting to hunt mode and re-discovering the damaged
ship by chance later.

**Reproduction.** Unit-level: hit C1, B1, A1 in that order on a board with a destroyer at
A1-B1 and a cruiser at C1-E1. The third shot sinks the destroyer; the AI's `pendingHits`
became empty even though C1 was a live hit on the cruiser.

**Root cause.** `updateAiState()` cleared the whole *connected group* of hit cells on a
sink. Connectivity is a good proxy for "cells of the ship that just sank" only when ships
never touch — which this variant allows — so the cruiser's hit at C1, adjacent to the
destroyer's at B1, was swept up with it.

**Fix.** `src/engine/ai.ts` now clears exactly the sunk ship's own cells
(`result.ship.cells`), falling back to the connected group only if the attack result
carries no ship.

**Verification.** New regression test in `src/engine/ai.test.ts` ("keeps targeting a
damaged ship that touches the one it just sank") asserts `pendingHits === [C1]` after the
sink and that the next Smart move is in target mode adjacent to C1. The test was run
against the old implementation first and failed, then passed with the fix; full suite
green.

---

## BUG-6 — Refreshing the browser mid-game threw the game away

**Description.** Reloading the page during a battle (or during setup) dropped every
placed ship, every shot and the AI's memory, dumping the player back into an empty setup
phase. Found by the adversarial pass against the live deployment — the kind of thing a
demo audience does by accident.

**Reproduction.** Place ships, start a battle, fire a shot, press reload: both boards come
back empty and the phase resets to setup.

**Root cause.** All state lived in a single `useState(() => createGame('smart'))` in
`App.tsx` with nothing written anywhere durable, so a reload rebuilt a blank game.

**Fix.** Added `src/engine/persistence.ts`, a small storage-agnostic module (a
`KeyValueStore` interface, so it is unit-testable without a browser) that serialises the
game under a versioned key and validates the shape of anything it reads back. `App.tsx`
seeds its state with `loadGame(sessionStorage) ?? createGame('smart')` and saves on every
state change. Corrupt, foreign, stale-schema or inaccessible storage (private browsing,
quota errors) is ignored rather than crashing the app. `sessionStorage` is deliberate:
a refresh or accidental tab restore keeps the game, but a brand new session starts fresh
rather than silently resurrecting a game from days ago.

**Verification.** Five unit tests in `src/engine/persistence.test.ts` cover round-tripping
a mid-game state, empty storage, corrupt/foreign payloads, clearing, and a store that
throws on every call. End to end, the adversarial script records the enemy/own hit counts
and ship-cell count, calls `page.reload()`, and asserts they are unchanged — failing
before the fix, passing after, on desktop and mobile against the live site.

---

## Checks that found nothing

These were specifically looked for and did not reproduce:

- **Duplicate attacks.** Already-attacked cells render as disabled buttons and
  `attack()` returns an `invalid` outcome and the identical board object; covered by unit
  tests and asserted in the playthrough.
- **Turn-order bugs.** `playerAttack` ignores shots when `turn !== 'human'` and
  `aiAttack` ignores shots when `turn !== 'ai'`, so clicking fast during the AI's delay
  cannot steal a turn. React StrictMode's double-invoked effects were checked
  specifically: the AI timer is cleared on cleanup and the state updater re-checks the
  turn, so the AI never fires twice per turn.
- **Invalid game states.** Attacks before `Start battle` and after the game ends are
  rejected by the engine, and `Start battle` stays disabled until all five ships are
  placed.
- **AI targeting bugs.** A unit test plays 100 AI shots against a full board and asserts
  no cell is ever repeated and the whole fleet ends up sunk; another asserts Smart mode
  needs fewer shots than Easy for the same layout.
- **Information leaks.** Verified via the DOM that during setup and play every enemy cell
  reports `unknown` unless it has been attacked (after BUG-2 was fixed).
- **Mobile/responsive issues.** At 390×844 the layout stacks into a single column with no
  horizontal overflow (`scrollWidth === clientWidth`) and a full game plays through.
- **Console errors.** None across desktop, mobile and Easy-mode playthroughs, and none
  during the adversarial pass.
- **Rapid and repeated clicking.** Bursts of clicks dispatched with no delay place one
  ship per cell and fire one shot per turn; the click-by-click full game asserts the
  number of attacked cells equals the number of clicks exactly.
- **Placement boundaries.** Ships are accepted on the exact last legal cell of each axis
  and refused one cell beyond it, horizontally and vertically.
- **Forced invalid actions.** Dispatching a click on the disabled `Start battle` button
  via the DOM does not begin a game with an incomplete fleet.

## Minor issues resolved along the way

- The Vite template's unused `App.css` and starter assets were deleted rather than left
  in the repo.
- Node 20.18 could not install the Rolldown native binding required by Vite 8
  (`engines: ^20.19.0 || >=22.12.0`); the project is developed and built on Node 22, and
  the requirement is documented in the README.

---

# Round 3 — "AI Arms Race" product pass

Testing performed on the cinematic layer (AI Command Center, themed fleets, competitor
easter egg, combat FX, audio, mission report), locally and against
https://aronh-ui.github.io/battleship-ai/.

| Check | How | Result |
| --- | --- | --- |
| Engine + presentation unit tests | `npm test` (Vitest, 9 files / 75 tests) | Passing |
| Type check + bundle | `npm run build` | Passing |
| Lint | `npm run lint` (oxlint) | Clean, no warnings |
| Scripted playthrough, desktop / mobile / Easy-win | `npm run qa:playthrough -- <url> [--easy] [--mobile]` | Passing, no console output |
| Adversarial pass | `npm run qa:adversarial -- <url>` | Passing |
| Interactive session, desktop + 390×844 | Full games played in a real browser, screenshots reviewed | Three issues found: BUG-7, BUG-8, BUG-9 |
| AI fairness | ~15 AI turns inspected: no Command Center step ever named an un-attacked cell or an un-sunk ship | Passing |
| Enemy fleet secrecy | Enemy cells report `unknown` until attacked; positions revealed only in the mission report | Passing |
| Competitor easter egg | `devin` trigger and sidebar toggle, renamed targets, `SUNK` / `ELIMINATED` copy, both-sunk completion lines | Passing |
| Audio | No `AudioContext` created before the first interaction; master/music/SFX sliders, mute and persistence across reload | Passing |

New unit tests added this round: `src/engine/stats.test.ts` (statistics come from the real
log, including the accuracy denominator), `src/theme/fleet.test.ts` (every ship is named on
both sides, arms-race mode renames only the two competitor targets and never the player
fleet, sink wording), `src/audio/context.test.ts` (stored volume levels are validated
field by field and fall back to defaults on corrupt data), and five `aiPlan` cases in
`src/engine/ai.test.ts` — including one asserting the reasoning text never contains a grid
coordinate the AI has not attacked.

## BUG-7 — Mission report showed the AI's statistics after a loss

**Reproduction.** Lose a game and read the SHOTS / HITS / ACCURACY panel: it reported
33 shots · 17 hits · 52% while the player's own log for that game was 33 shots · 11 hits ·
33%. 17 hits was the AI's tally against the player's fleet.

**Root cause.** `MissionReport.tsx` selected the winner's statistics
(`const side = won ? stats.player : stats.ai`) while the line directly beneath it always
used `stats.player`, so a loss screen mixed both sides' numbers with no label saying whose
they were.

**Fix.** The panel always shows the player's own statistics under an explicit
"Your performance" heading, with the opponent's shots/hits/accuracy on a separate labelled
line. Nothing is inferred: every number comes from `gameStats()` over the game log.

**Verification.** Played a full game to a loss and reconciled the reported numbers against
the shot log cell by cell; `stats.test.ts` covers the underlying computation.

## BUG-8 — Impact ring drew across the whole board instead of one cell

**Reproduction.** Fire at any cell (or get fired at) and watch the shock ring: a white
circle roughly the size of the entire board expanded over both grids, most visible at
390×844 where it spilled from the enemy board across the player board.

**Root cause.** The ring is `absolute h-full w-full` inside the impact wrapper, but that
wrapper was a plain (statically positioned) grid item. The ring therefore resolved its
size against the nearest positioned ancestor — the full-board overlay layer — so
`h-full w-full` meant "the whole board", and the `shock` keyframe scaled that by 2.4.

**Fix.** Made the impact wrapper `relative` so the ring is sized to its own cell.

**Verification.** Screenshots of the same shot before and after; the ring is now a
cell-sized pulse, and the earlier report of a sonar sweep bleeding across the player board
on mobile came from this same ring and no longer reproduces.

## BUG-9 — Your own sink message was overwritten within a second

**Reproduction.** Sink an enemy ship: `TECHNICAL DEBT — DESTROYED` appeared in the event
banner and was replaced by the AI's return-fire message roughly one second later, so the
most rewarding moment in the game was easy to miss entirely. On production the competitor
sink lines could not even be screenshotted for this reason.

**Root cause.** A single event line rendered `log[log.length - 1]`, and the AI always
gets the last word.

**Fix.** The turn bar now keeps one line per side — the player's own last result stays on
screen until their next shot, with the enemy's last shot on a second, quieter line.

**Verification.** Played through several sinks on desktop and mobile; the sink line
persists through the AI's reply.

## Checks that found nothing this round

- **Core mechanics unchanged.** The engine's ship names, board, placement rules, attack
  outcomes and AI algorithm are untouched; all 57 pre-existing tests still pass without
  modification. The themed names are a presentation-layer mapping in `src/theme/fleet.ts`.
- **Autoplay compliance.** No audio node is constructed before the first `pointerdown` or
  `keydown`; verified in the browser with a clean page load.
- **Console cleanliness.** No errors or warnings during full games on desktop, mobile and
  production.
- **Restart and refresh.** `Play again` resets to a clean setup screen (arms-race toggle
  correctly persists, game state does not); mid-game refresh still restores the game.
- **Performance.** Effects are CSS keyframes and inline SVG; no measurable jank and no
  media files in the bundle.

---

# Round 4 — pre-demo adversarial QA (current build)

Scope: the deployed build with the licensed music track, renamed fleets (Devin Defender,
Claude Carrier, Cursor Cruiser), full-screen hit/sink callouts and the collapsed AI
Command Center. Everything below was run against the live URL
`https://aronh-ui.github.io/battleship-ai/`, not localhost. Earlier rounds are kept above
in full (BUG-1…9).

## Testing performed

| Area                              | How                                                                                         | Result |
| --------------------------------- | ------------------------------------------------------------------------------------------- | ------ |
| Unit tests                        | `npm test` — 74 tests incl. one new AI stress test (200 seeded games)                        | Pass   |
| Lint / type check / bundle        | `npm run lint`, `npm run build`                                                              | Pass   |
| Placement edge cases              | Adversarial script: one cell past right/bottom edge refused, exact edge accepted, overlap refused, rotate, double-click places once, Start disabled until 5 ships, 5× randomize = 17 cells | Pass, desktop + 390×844 |
| Rapid / repeated clicking         | 5 rapid clicks on 5 enemy cells → exactly one shot, one log entry                           | Pass   |
| Duplicate attacks                 | Re-clicking an attacked cell is disabled and produces no log entry                          | Pass   |
| Turn-order integrity              | Clicking every enemy cell while the AI thinks fires nothing; each player shot yields exactly one AI reply | Pass |
| AI after consecutive hits         | Unit tests: neighbour probe → direction lock → line extension → reset on sink, touching ships, two damaged ships; new stress test sinks every fleet in <90 shots with no invalid move and empty memory at the end | Pass |
| Game restart                      | `Play again` after game over clears both boards, re-hides enemy fleet, returns to setup     | Pass   |
| Browser refresh mid-game          | `location.reload()` mid-battle restores boards, turn and log; mute preference persists      | Pass   |
| Mobile / responsive               | 390×844: no horizontal overflow, Command Center collapsed by default, keyboard (Enter/Space) toggles it, stays open across AI turns, mission report fits viewport, banners fit | Pass |
| Audio                             | No `<audio>` element before first gesture; one looping track after first click; unmuted by default; volume/mute persist | Pass |
| Callouts                          | Cursor Cruiser / Claude Carrier HIT + SUNK / ELIMINATED shown; removed lines ("ARMS RACE CONTINUES", "DEVIN REMAINS OPERATIONAL") never appear | Pass |
| Console                           | Zero `console.error` / `console.warn` / page errors across all runs                         | Pass   |
| Complete games end-to-end, live   | `qa:playthrough` desktop Smart (40 shots) and mobile Easy (53 shots): setup → sinks → game over → report → restart | Pass |

## Application defects found

None. No user-visible or state-integrity defect reproduced in this round.

## QA-harness issue fixed (not an application bug)

**Stale assertion in `scripts/playthrough.mjs`.** After the rename from "Agent Battleship"
to "Devin Defender" the playthrough script still asserted the setup prompt contained
`Battleship`, so the live desktop playthrough failed at "carrier placed, battleship is
next". Root cause: test text not updated with the presentation rename; the UI was
correct. Fix: assertion now checks `Devin Defender`. Verified: both live playthroughs pass.

## Regression coverage added

`src/engine/ai.test.ts` — "sinks every fleet in bounded shots across many random games":
200 seeded random boards, asserting the Smart AI never returns null or an invalid move,
always finishes under 90 shots (well below a 100-cell sweep) and has no pending hits left
once the fleet is sunk. Guards the hunt/target/reset cycle against future changes.

## Complete bug index (all rounds)

| ID    | Round | Summary                                                         |
| ----- | ----- | --------------------------------------------------------------- |
| BUG-1 | 1     | Fast-refresh lint warning from helper export mixed with components |
| BUG-2 | 1     | Enemy fleet panel leaked which ship had been hit                |
| BUG-3 | 1     | Ship placement preview invisible on hovered cell                |
| BUG-4 | 1     | Board cells unlabelled for assistive tech                       |
| BUG-5 | 2     | AI forgot a damaged ship after sinking a touching ship          |
| BUG-6 | 2     | Mid-game refresh discarded the game                             |
| BUG-7 | 3     | Mission report showed AI statistics after a loss                |
| BUG-8 | 3     | Impact ring drew across the whole board                         |
| BUG-9 | 3     | Player sink message overwritten by AI reply                     |
| —     | 4     | No application defects; one stale QA-script assertion fixed     |
