import { describe, expect, it } from 'vitest';
import {
  allShipsSunk,
  alreadyAttacked,
  attack,
  canPlaceShip,
  createBoard,
  isSunk,
  placeShip,
  remainingShips,
  shipCells,
  validatePlacement,
} from './board';
import { BOARD_SIZE, FLEET, type ShipSpec } from './types';

const carrier: ShipSpec = { name: 'Carrier', length: 5 };
const destroyer: ShipSpec = { name: 'Destroyer', length: 2 };

describe('createBoard', () => {
  it('creates an empty 10x10 grid with no ships', () => {
    const board = createBoard();
    expect(board.ships).toEqual([]);
    expect(board.grid).toHaveLength(BOARD_SIZE);
    for (const row of board.grid) {
      expect(row).toHaveLength(BOARD_SIZE);
      expect(row.every((c) => c === 'unknown')).toBe(true);
    }
  });
});

describe('ship placement', () => {
  it('places a ship horizontally', () => {
    const board = placeShip(createBoard(), carrier, { row: 0, col: 0 }, 'horizontal');
    expect(board?.ships[0].cells).toEqual(shipCells({ row: 0, col: 0 }, 5, 'horizontal'));
    expect(board?.ships[0].cells.map((c) => c.col)).toEqual([0, 1, 2, 3, 4]);
  });

  it('places a ship vertically', () => {
    const board = placeShip(createBoard(), carrier, { row: 2, col: 3 }, 'vertical');
    expect(board?.ships[0].cells.map((c) => c.row)).toEqual([2, 3, 4, 5, 6]);
    expect(board?.ships[0].cells.every((c) => c.col === 3)).toBe(true);
  });

  it('rejects placements that extend off the right edge', () => {
    expect(validatePlacement(createBoard(), { row: 0, col: 6 }, 5, 'horizontal')).toBe(
      'off-board',
    );
    expect(placeShip(createBoard(), carrier, { row: 0, col: 6 }, 'horizontal')).toBeNull();
  });

  it('rejects placements that extend off the bottom edge', () => {
    expect(validatePlacement(createBoard(), { row: 9, col: 0 }, 2, 'vertical')).toBe(
      'off-board',
    );
  });

  it('rejects negative coordinates', () => {
    expect(canPlaceShip(createBoard(), { row: -1, col: 0 }, 2, 'horizontal')).toBe(false);
  });

  it('rejects overlapping ships', () => {
    const board = placeShip(createBoard(), carrier, { row: 0, col: 0 }, 'horizontal')!;
    expect(validatePlacement(board, { row: 0, col: 4 }, 2, 'vertical')).toBe('overlap');
    expect(placeShip(board, destroyer, { row: 0, col: 4 }, 'vertical')).toBeNull();
  });

  it('allows adjacent, non-overlapping ships', () => {
    const board = placeShip(createBoard(), carrier, { row: 0, col: 0 }, 'horizontal')!;
    const next = placeShip(board, destroyer, { row: 1, col: 0 }, 'horizontal');
    expect(next?.ships).toHaveLength(2);
  });

  it('allows a ship flush against the last column', () => {
    expect(canPlaceShip(createBoard(), { row: 0, col: 5 }, 5, 'horizontal')).toBe(true);
  });

  it('does not mutate the original board', () => {
    const board = createBoard();
    placeShip(board, carrier, { row: 0, col: 0 }, 'horizontal');
    expect(board.ships).toHaveLength(0);
  });
});

describe('attacks', () => {
  const boardWithShips = () => {
    let board = createBoard();
    board = placeShip(board, carrier, { row: 0, col: 0 }, 'horizontal')!;
    board = placeShip(board, destroyer, { row: 5, col: 5 }, 'vertical')!;
    return board;
  };

  it('registers a miss on empty water', () => {
    const { board, result } = attack(boardWithShips(), { row: 9, col: 9 });
    expect(result.outcome).toBe('miss');
    expect(board.grid[9][9]).toBe('miss');
  });

  it('registers a hit on a ship', () => {
    const { board, result } = attack(boardWithShips(), { row: 0, col: 1 });
    expect(result.outcome).toBe('hit');
    expect(board.grid[0][1]).toBe('hit');
    expect(board.ships[0].hits).toHaveLength(1);
  });

  it('prevents attacking the same cell twice', () => {
    const first = attack(boardWithShips(), { row: 9, col: 9 });
    expect(alreadyAttacked(first.board, { row: 9, col: 9 })).toBe(true);
    const second = attack(first.board, { row: 9, col: 9 });
    expect(second.result.outcome).toBe('invalid');
    expect(second.board).toBe(first.board);
  });

  it('rejects attacks off the board', () => {
    expect(attack(boardWithShips(), { row: 10, col: 0 }).result.outcome).toBe('invalid');
  });

  it('sinks a ship once every cell is hit', () => {
    let board = boardWithShips();
    let outcome = attack(board, { row: 5, col: 5 });
    board = outcome.board;
    expect(outcome.result.outcome).toBe('hit');
    outcome = attack(board, { row: 6, col: 5 });
    board = outcome.board;
    expect(outcome.result.outcome).toBe('sunk');
    expect(outcome.result.ship?.name).toBe('Destroyer');
    expect(isSunk(board.ships[1])).toBe(true);
    expect(remainingShips(board).map((s) => s.name)).toEqual(['Carrier']);
  });

  it('detects when the whole fleet is sunk', () => {
    let board = placeShip(createBoard(), destroyer, { row: 0, col: 0 }, 'horizontal')!;
    expect(allShipsSunk(board)).toBe(false);
    board = attack(board, { row: 0, col: 0 }).board;
    board = attack(board, { row: 0, col: 1 }).board;
    expect(allShipsSunk(board)).toBe(true);
  });

  it('reports an empty board as not defeated', () => {
    expect(allShipsSunk(createBoard())).toBe(false);
  });
});

describe('fleet definition', () => {
  it('uses the standard fleet', () => {
    expect(FLEET.map((s) => [s.name, s.length])).toEqual([
      ['Carrier', 5],
      ['Battleship', 4],
      ['Cruiser', 3],
      ['Submarine', 3],
      ['Destroyer', 2],
    ]);
  });
});
