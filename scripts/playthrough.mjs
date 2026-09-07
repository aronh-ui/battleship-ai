/**
 * End-to-end playthrough used for manual QA.
 *
 * Drives a full game (setup -> battle -> game over -> restart) in a real browser and
 * asserts the rules that cannot be covered by the engine unit tests: rendering, turn
 * handling in the UI, disabled cells, and console cleanliness.
 *
 * Usage: node scripts/playthrough.mjs [url] [--easy] [--mobile]
 * Requires a Chrome instance with remote debugging on CDP_URL (default port 29229),
 * e.g. `google-chrome --remote-debugging-port=29229`.
 */
import { chromium } from 'playwright-core';

const CDP_URL = process.env.CDP_URL ?? 'http://127.0.0.1:29229';
const URL = process.argv[2] ?? 'http://127.0.0.1:5173';
const MOBILE = process.argv.includes('--mobile');
const EASY = process.argv.includes('--easy');

const errors = [];
const log = (...a) => console.log(...a);
const assert = (cond, msg) => {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  log(`  ok: ${msg}`);
};

const neighbours = (id) => {
  const col = id[0].charCodeAt(0) - 65;
  const row = Number(id.slice(1)) - 1;
  return [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ]
    .filter(([r, c]) => r >= 0 && r < 10 && c >= 0 && c < 10)
    .map(([r, c]) => `${String.fromCharCode(65 + c)}${r + 1}`);
};

/** Mirrors the AI's hunt/target logic so the scripted player can actually win. */
const pickTarget = (state) => {
  const untried = Object.keys(state).filter((id) => state[id] === 'unknown');
  const openHits = Object.keys(state).filter((id) => state[id] === 'hit');
  for (const hit of openHits) {
    const next = neighbours(hit).find((id) => state[id] === 'unknown');
    if (next) return next;
  }
  const parity = untried.filter(
    (id) => (id[0].charCodeAt(0) - 65 + Number(id.slice(1)) - 1) % 2 === 0,
  );
  return parity[0] ?? untried[0];
};

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
const page = await context.newPage();
if (MOBILE) await page.setViewportSize({ width: 390, height: 844 });
else await page.setViewportSize({ width: 1280, height: 900 });

page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(URL, { waitUntil: 'networkidle' });

const own = () => page.locator('[aria-label="Your board"]');
const enemy = () => page.locator('[aria-label="Enemy board"]');
const cell = (board, id) => board.locator(`[data-cell="${id}"]`);
const states = async (board) =>
  board.evaluate((el) =>
    Object.fromEntries(
      [...el.querySelectorAll('[data-cell]')].map((c) => [
        c.dataset.cell,
        c.dataset.state,
      ]),
    ),
  );

if (EASY) {
  await page.locator('button', { hasText: /^easy$/i }).click();
  log('  ok: difficulty switched to Easy');
}

log('# setup phase');
assert(await page.locator('text=Place your').first().isVisible(), 'setup prompt visible');

// Manual placement of the Carrier, horizontal.
await cell(own(), 'A1').click();
assert(
  (await page.locator('text=Place your').first().innerText()).includes('Battleship'),
  'carrier placed, battleship is next',
);

// Invalid placement: overlap.
await cell(own(), 'C1').click();
assert(
  await page.locator('[role="status"]', { hasText: 'overlap' }).isVisible(),
  'overlap placement explained and rejected',
);

// Rotate then place vertically at the right edge; then an off-board attempt.
await page.keyboard.press('r');
assert(
  (await page.locator('button', { hasText: 'Rotate:' }).innerText()).includes('Vertical'),
  'rotate toggle flips to vertical',
);
await cell(own(), 'J9').click();
assert(
  await page.locator('[role="status"]', { hasText: 'run off the board' }).isVisible(),
  'off-board placement explained and rejected',
);
await cell(own(), 'A2').click();

// Enemy ships must not be visible during setup.
const enemyStates = await states(enemy());
assert(
  Object.values(enemyStates).every((s) => s === 'unknown'),
  'enemy ships hidden during setup',
);

// Start must be blocked until the fleet is complete.
const startBtn = page.locator('button', { hasText: 'Start battle' });
assert(await startBtn.isDisabled(), 'start disabled with an incomplete fleet');

await page.locator('button', { hasText: 'Randomize placement' }).click();
assert(await startBtn.isEnabled(), 'randomize completes the fleet and enables start');

const playerShips = await own().evaluate(
  (el) => [...el.querySelectorAll('[aria-label]')].filter((c) => /Carrier|Battleship|Cruiser|Submarine|Destroyer/.test(c.getAttribute('aria-label'))).length,
);
assert(playerShips === 17, `player board shows 17 ship cells (got ${playerShips})`);

await startBtn.click();
assert(
  (await page.getByTestId('turn-indicator').innerText()).includes('Your turn'),
  'battle starts on the player turn',
);

log('# battle');
const ids = [];
for (const r of '12345678910'.match(/10|\d/g)) for (const c of 'ABCDEFGHIJ') ids.push(`${c}${r}`);

let shots = 0;
let sawSunk = false;
let duplicateBlocked = false;

while (shots < 100) {
  const turn = await page.getByTestId('turn-indicator').innerText();
  if (turn.includes('Game over')) break;
  if (turn.includes('Enemy')) {
    await page.waitForTimeout(120);
    continue;
  }
  const enemyState = await states(enemy());
  const target = pickTarget(enemyState);
  if (!target) break;

  await cell(enemy(), target).click();
  shots++;

  if (!duplicateBlocked) {
    // A previously attacked cell must not accept another shot.
    const before = await states(enemy());
    const attacked = ids.find((id) => before[id] !== 'unknown');
    const btn = cell(enemy(), attacked);
    assert(await btn.isDisabled(), `attacked cell ${attacked} is not clickable again`);
    duplicateBlocked = true;
  }

  if (!sawSunk) {
    const sunk = Object.values(await states(enemy())).filter((s) => s === 'sunk').length;
    if (sunk > 0) {
      sawSunk = true;
      log('  ok: a ship sank and rendered its sunk state');
    }
  }
  await page.waitForTimeout(60);
}

const aiShots = Object.values(await states(own())).filter((s) => s !== 'unknown').length;
assert(aiShots > 0, `AI fired back (${aiShots} cells attacked on the player board)`);
assert(sawSunk, 'at least one enemy ship was sunk');

log('# game over');
await page.waitForSelector('[role="dialog"]', { timeout: 20000 });
const dialog = page.locator('[role="dialog"]');
const outcome = await dialog.locator('h2').innerText();
assert(
  ['Fleet eliminated', 'Fleet lost'].includes(outcome),
  `mission report shown (${outcome})`,
);
const revealed = await dialog.evaluate(
  (el) => [...el.querySelectorAll('[aria-label]')].filter((c) => /Carrier|Battleship|Cruiser|Submarine|Destroyer/.test(c.getAttribute('aria-label') ?? '')).length,
);
assert(revealed >= 17, `modal reveals the AI fleet (${revealed} ship cells)`);

await dialog.locator('button', { hasText: 'Play again' }).click();
await page.waitForSelector('[role="dialog"]', { state: 'detached' });
assert(await page.locator('text=Place your').first().isVisible(), 'play again returns to setup');
const freshOwn = Object.values(await states(own())).every((s) => s === 'unknown');
const freshEnemy = Object.values(await states(enemy())).every((s) => s === 'unknown');
assert(freshOwn && freshEnemy, 'both boards reset to unknown after play again');
assert(
  (await page.locator('button', { hasText: 'Rotate:' }).innerText()).includes('Horizontal'),
  'rotation resets to horizontal',
);

if (EASY) {
  assert(outcome === 'Fleet eliminated', 'player can win against the easy AI');
}

log('# console');
if (errors.length) {
  log(errors.join('\n'));
  throw new Error(`${errors.length} console errors/warnings`);
}
log('  ok: no console errors or warnings');

log(`\nPLAYTHROUGH PASSED (${shots} player shots, mobile=${MOBILE})`);
await page.close();
await browser.close();
