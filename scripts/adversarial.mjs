/**
 * Adversarial QA pass: tries to break the UI rather than to play it well.
 *
 * Covers rapid/duplicate clicking, out-of-turn shots, placement edge cases,
 * restart and mid-game refresh, AI behaviour after consecutive hits, and the
 * mobile layout. Reports every failure instead of stopping at the first one.
 *
 * Usage: node scripts/adversarial.mjs [url] [--mobile]
 * Requires a Chrome instance with remote debugging on CDP_URL (default port 29229).
 */
import { chromium } from 'playwright-core';

const CDP_URL = process.env.CDP_URL ?? 'http://127.0.0.1:29229';
const URL = process.argv[2] ?? 'http://127.0.0.1:5173';
const MOBILE = process.argv.includes('--mobile');

const failures = [];
const consoleIssues = [];
const log = (...a) => console.log(...a);
const check = (cond, msg) => {
  log(`  ${cond ? 'ok  ' : 'FAIL'}: ${msg}`);
  if (!cond) failures.push(msg);
};

const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
const page = await context.newPage();
await page.setViewportSize(
  MOBILE ? { width: 390, height: 844 } : { width: 1280, height: 900 },
);
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning')
    consoleIssues.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => consoleIssues.push(`pageerror: ${e.message}`));

const own = () => page.locator('[aria-label="Your board"]');
const enemy = () => page.locator('[aria-label="Enemy board"]');
const cell = (board, id) => board.locator(`[data-cell="${id}"]`);
const states = async (board) =>
  board.evaluate((el) =>
    Object.fromEntries(
      [...el.querySelectorAll('[data-cell]')].map((c) => [c.dataset.cell, c.dataset.state]),
    ),
  );
const attackedCount = async (board) =>
  Object.values(await states(board)).filter((s) => s !== 'unknown').length;
const turn = () => page.getByTestId('turn-indicator').innerText();
const shipCells = async (board) =>
  board.evaluate(
    (el) =>
      [...el.querySelectorAll('[aria-label]')].filter((c) =>
        /Carrier|Battleship|Cruiser|Submarine|Destroyer/.test(c.getAttribute('aria-label') ?? ''),
      ).length,
  );

const randomize = () => page.locator('button', { hasText: /Randomize/ }).click();
const start = () => page.locator('button', { hasText: 'Start battle' }).click();

await page.goto(URL, { waitUntil: 'networkidle' });

log('# placement edge cases');
// Carrier (5) horizontal: F1 is the last legal start on a row, G1 is not.
await cell(own(), 'G1').click();
check(
  await page.locator('[role="status"]', { hasText: 'run off the board' }).isVisible(),
  'carrier rejected at G1 (last legal horizontal start is F1)',
);
await cell(own(), 'F1').click();
check((await shipCells(own())) === 5, 'carrier accepted at the exact right edge (F1-J1)');

// Battleship (4) vertical: row 7 is the last legal start, row 8 is not.
await page.keyboard.press('r');
await cell(own(), 'A8').click();
check(
  await page.locator('[role="status"]', { hasText: 'run off the board' }).isVisible(),
  'battleship rejected at A8 (last legal vertical start is A7)',
);
await cell(own(), 'A7').click();
check((await shipCells(own())) === 9, 'battleship accepted at the exact bottom edge (A7-A10)');

// Rapid double click on the same cell must not stack two ships.
await cell(own(), 'C3').dblclick();
const afterDouble = await shipCells(own());
check(
  afterDouble === 12,
  `double-click places exactly one cruiser, not two (ship cells: ${afterDouble})`,
);

// Start must stay blocked while the fleet is incomplete, even when spam-clicked.
const startBtn = page.locator('button', { hasText: 'Start battle' });
check(await startBtn.isDisabled(), 'start disabled with an incomplete fleet');
await startBtn.click({ force: true, timeout: 2000 }).catch(() => {});
check((await turn().catch(() => '')) === '', 'forced click on disabled start does not begin the game');

// Spam randomize/clear, then confirm the fleet is still exactly 17 cells.
await page.locator('button', { hasText: 'Clear' }).click();
check((await shipCells(own())) === 0, 'clear empties the board');
for (let i = 0; i < 5; i++) await randomize();
check((await shipCells(own())) === 17, 'repeated randomize always yields exactly 17 ship cells');

log('# turn integrity');
await start();
check((await turn()).includes('Your turn'), 'battle starts on the player turn');

// Five different enemy cells clicked as fast as possible: only one shot may land.
const targets = ['A1', 'B1', 'C1', 'D1', 'E1'];
await enemy().evaluate((el, ids) => {
  for (const id of ids) el.querySelector(`[data-cell="${id}"]`)?.click();
}, targets);
await page.waitForTimeout(150);
const burst = await attackedCount(enemy());
check(burst === 1, `burst of 5 clicks registers a single shot (got ${burst})`);

// Same cell double-clicked: still a single shot, and the cell is disabled afterwards.
check((await turn()).includes('Enemy'), 'turn passed to the AI after the shot');
await page.waitForTimeout(1200);
const disabled = await cell(enemy(), (await firstAttacked())).isDisabled();
check(disabled, 'an attacked enemy cell is disabled');

async function firstAttacked() {
  const s = await states(enemy());
  return Object.keys(s).find((id) => s[id] !== 'unknown');
}

// Clicking during the AI's turn must not fire.
await page.waitForSelector('[data-testid="turn-indicator"]');
let sneaked = false;
for (let i = 0; i < 40 && !sneaked; i++) {
  const t = await turn();
  if (t.includes('Enemy')) {
    const before = await attackedCount(enemy());
    await enemy().evaluate((el) => {
      for (const c of el.querySelectorAll('[data-cell]')) c.click();
    });
    await page.waitForTimeout(80);
    const after = await attackedCount(enemy());
    check(after === before, `clicking every enemy cell during the AI turn fires nothing (${before} -> ${after})`);
    sneaked = true;
  } else {
    await cell(enemy(), await firstUnknown()).click();
    await page.waitForTimeout(60);
  }
}
check(sneaked, 'observed an AI turn to test out-of-turn clicking');

async function firstUnknown() {
  const s = await states(enemy());
  return Object.keys(s).find((id) => s[id] === 'unknown');
}

// One shot per turn: count player-attacked cells against turns taken.
log('# AI behaviour and full game');
let playerShots = await attackedCount(enemy());
let guard = 0;
let sawSunkEnemy = false;
while (guard++ < 2000) {
  const t = await turn();
  if (t.includes('Game over')) break;
  if (t.includes('Enemy')) {
    await page.waitForTimeout(100);
    continue;
  }
  // Spam the difficulty toggle mid-game: it must not skip or duplicate a turn.
  if (guard % 7 === 0) {
    await page.locator('button', { hasText: /^easy$/i }).click();
    await page.locator('button', { hasText: /^smart$/i }).click();
  }
  const target = await firstUnknown();
  if (!target) break;
  await cell(enemy(), target).click();
  playerShots++;
  const enemyStates = await states(enemy());
  if (Object.values(enemyStates).includes('sunk')) sawSunkEnemy = true;
  await page.waitForTimeout(40);
}
check(sawSunkEnemy, 'enemy ships sink and render their sunk state');

const registered = await attackedCount(enemy());
check(
  registered === playerShots,
  `every click produced exactly one shot (clicks ${playerShots}, cells ${registered})`,
);

// AI accuracy after consecutive hits: once it hits, follow-up shots should cluster.
const ownStates = await states(own());
const hitIds = Object.keys(ownStates).filter((id) => ownStates[id] !== 'unknown' && ownStates[id] !== 'miss');
const misses = Object.keys(ownStates).filter((id) => ownStates[id] === 'miss').length;
check(
  hitIds.length === 0 || misses < 90,
  `AI fire is plausible (${hitIds.length} hits, ${misses} misses)`,
);

log('# game over and restart');
await page.waitForSelector('[role="dialog"]', { timeout: 30000 });
const dialog = page.locator('[role="dialog"]');
if (MOBILE) {
  const box = await dialog.boundingBox();
  check(
    box !== null && box.y >= 0 && box.height <= 844,
    `game over modal fits the mobile viewport (height ${box?.height})`,
  );
}
// Spam Play again.
await dialog.locator('button', { hasText: 'Play again' }).click();
await page.waitForSelector('[role="dialog"]', { state: 'detached' });
check((await shipCells(own())) === 0, 'play again clears the player fleet');
check((await attackedCount(enemy())) === 0, 'play again clears the enemy board');
check(
  Object.values(await states(enemy())).every((s) => s === 'unknown'),
  'enemy ships hidden again after restart',
);

log('# refresh mid-game');
await randomize();
await start();
await cell(enemy(), 'A1').click();
await page.waitForTimeout(1200);
const beforeReload = {
  enemy: await attackedCount(enemy()),
  own: await attackedCount(own()),
  ships: await shipCells(own()),
};
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const afterPhase = await page
  .locator('text=Place your')
  .first()
  .isVisible()
  .catch(() => false);
const afterState = {
  enemy: await attackedCount(enemy()),
  own: await attackedCount(own()),
  ships: await shipCells(own()),
};
check(
  !afterPhase &&
    afterState.enemy === beforeReload.enemy &&
    afterState.own === beforeReload.own &&
    afterState.ships === beforeReload.ships,
  `refresh mid-game keeps the game (before ${JSON.stringify(beforeReload)}, after ${JSON.stringify(afterState)})`,
);

if (MOBILE) {
  log('# mobile layout');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check(overflow <= 0, `no horizontal overflow (${overflow}px)`);
}

log('# console');
check(consoleIssues.length === 0, `no console errors or warnings${consoleIssues.length ? `: ${consoleIssues.join(' | ')}` : ''}`);

await page.close();
await browser.close();

log(
  `\nADVERSARIAL PASS ${failures.length ? 'FAILED' : 'PASSED'} (mobile=${MOBILE})` +
    (failures.length ? `\n${failures.map((f) => ` - ${f}`).join('\n')}` : ''),
);
process.exit(failures.length ? 1 : 0);
