# Bugs and fixes

QA log for Battleship AI: what was tested, what broke, and how each fix was verified.

## Testing performed

| Check                     | How                                                                                       | Result                                        |
| ------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| Engine unit tests         | `npm test` (Vitest, 5 files / 51 tests)                                                     | Passing                                       |
| Type check + bundle       | `npm run build` (`tsc -b && vite build`)                                                    | Passing, no type errors                       |
| Lint                      | `npm run lint` (oxlint)                                                                     | Clean (one warning found and fixed, see BUG-1) |
| Full playthrough, desktop | `npm run qa:playthrough` at 1280×900 — Playwright over CDP against the dev server           | Passing, loss path                            |
| Full playthrough, win     | `npm run qa:playthrough -- <url> --easy` — scripted player uses hunt/target against Easy AI | Passing, victory path                         |
| Full playthrough, mobile  | `npm run qa:playthrough -- <url> --mobile` at 390×844                                       | Passing                                       |
| Console cleanliness       | Playwright collects `console.error`, `console.warn` and uncaught page errors during a game  | No errors or warnings                         |
| Layout overflow           | Script comparing `documentElement.scrollWidth` to the viewport at 390 px                    | No horizontal overflow                        |
| Visual review             | Screenshots of setup and battle at desktop and mobile widths                                | Two issues found, see BUG-2 and BUG-3         |

Each scripted playthrough asserts: manual ship placement advances through the fleet in
order, overlapping and off-board placements are refused with an explanation, the rotate
toggle flips orientation, enemy ships stay hidden during setup, `Start battle` is
disabled until all five ships are placed, randomize completes the fleet (17 ship cells),
the game opens on the player's turn, an already-attacked cell cannot be clicked again, a
ship visibly sinks, the AI fires back, the win/loss modal appears and reveals all 17
enemy ship cells, and `Play again` returns both boards to a clean setup phase.

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
- **Console errors.** None across desktop, mobile and Easy-mode playthroughs.

## Minor issues resolved along the way

- The Vite template's unused `App.css` and starter assets were deleted rather than left
  in the repo.
- Node 20.18 could not install the Rolldown native binding required by Vite 8
  (`engines: ^20.19.0 || >=22.12.0`); the project is developed and built on Node 22, and
  the requirement is documented in the README.
