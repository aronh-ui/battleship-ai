import { describe, expect, it } from 'vitest';
import { createBoard, key, placeShip } from './board';
import {
  legalPlacements,
  randomBoard,
  randomizeRemaining,
  remainingFleet,
} from './placement';
import { seededRng } from './random';
import { BOARD_SIZE, FLEET } from './types';

describe('legalPlacements', () => {
  it('lists every valid origin on an empty board', () => {
    expect(legalPlacements(createBoard(), 5, 'horizontal')).toHaveLength(
      BOARD_SIZE * (BOARD_SIZE - 4),
    );
  });

  it('excludes origins blocked by an existing ship', () => {
    const board = placeShip(createBoard(), FLEET[0], { row: 0, col: 0 }, 'horizontal')!;
    const origins = legalPlacements(board, 2, 'horizontal');
    expect(origins.some((c) => c.row === 0 && c.col === 0)).toBe(false);
  });
});

describe('random placement', () => {
  it('places the full fleet without overlaps or off-board cells', () => {
    for (let seed = 0; seed < 50; seed++) {
      const board = randomBoard(seededRng(seed + 1));
      expect(board.ships).toHaveLength(FLEET.length);
      const cells = new Set<string>();
      for (const ship of board.ships) {
        expect(ship.cells).toHaveLength(ship.length);
        for (const cell of ship.cells) {
          expect(cell.row).toBeGreaterThanOrEqual(0);
          expect(cell.row).toBeLessThan(BOARD_SIZE);
          expect(cell.col).toBeGreaterThanOrEqual(0);
          expect(cell.col).toBeLessThan(BOARD_SIZE);
          expect(cells.has(key(cell))).toBe(false);
          cells.add(key(cell));
        }
        const rows = new Set(ship.cells.map((c) => c.row));
        const cols = new Set(ship.cells.map((c) => c.col));
        expect(rows.size === 1 || cols.size === 1).toBe(true);
      }
      expect(cells.size).toBe(5 + 4 + 3 + 3 + 2);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(randomBoard(seededRng(7)).ships).toEqual(randomBoard(seededRng(7)).ships);
  });

  it('keeps already placed ships when filling the rest', () => {
    const board = placeShip(createBoard(), FLEET[0], { row: 0, col: 0 }, 'horizontal')!;
    const filled = randomizeRemaining(board, remainingFleet(board), seededRng(3));
    expect(filled.ships).toHaveLength(FLEET.length);
    expect(filled.ships[0].cells).toEqual(board.ships[0].cells);
  });
});

describe('remainingFleet', () => {
  it('returns ships that still need placing, in fleet order', () => {
    const board = placeShip(createBoard(), FLEET[0], { row: 0, col: 0 }, 'horizontal')!;
    expect(remainingFleet(board).map((s) => s.name)).toEqual([
      'Battleship',
      'Cruiser',
      'Submarine',
      'Destroyer',
    ]);
  });
});
