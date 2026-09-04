import {
  BOARD_SIZE,
  FLEET,
  type AttackResult,
  type Board,
  type Coord,
  type Orientation,
  type Ship,
  type ShipSpec,
} from './types';

export function createBoard(): Board {
  return {
    ships: [],
    grid: Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => 'unknown' as const),
    ),
  };
}

export function isOnBoard({ row, col }: Coord): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function shipCells(
  start: Coord,
  length: number,
  orientation: Orientation,
): Coord[] {
  return Array.from({ length }, (_, i) =>
    orientation === 'horizontal'
      ? { row: start.row, col: start.col + i }
      : { row: start.row + i, col: start.col },
  );
}

export function occupiedCells(board: Board): Set<string> {
  const set = new Set<string>();
  for (const ship of board.ships) {
    for (const cell of ship.cells) set.add(key(cell));
  }
  return set;
}

export function key({ row, col }: Coord): string {
  return `${row},${col}`;
}

export type PlacementError = 'off-board' | 'overlap';

export function validatePlacement(
  board: Board,
  start: Coord,
  length: number,
  orientation: Orientation,
): PlacementError | null {
  const cells = shipCells(start, length, orientation);
  if (!cells.every(isOnBoard)) return 'off-board';
  const occupied = occupiedCells(board);
  if (cells.some((c) => occupied.has(key(c)))) return 'overlap';
  return null;
}

export function canPlaceShip(
  board: Board,
  start: Coord,
  length: number,
  orientation: Orientation,
): boolean {
  return validatePlacement(board, start, length, orientation) === null;
}

/** Returns a new board with the ship placed, or null if the placement is invalid. */
export function placeShip(
  board: Board,
  spec: ShipSpec,
  start: Coord,
  orientation: Orientation,
): Board | null {
  if (!canPlaceShip(board, start, spec.length, orientation)) return null;
  const ship: Ship = {
    id: spec.name,
    name: spec.name,
    length: spec.length,
    cells: shipCells(start, spec.length, orientation),
    hits: [],
  };
  return { ...board, ships: [...board.ships, ship] };
}

export function isSunk(ship: Ship): boolean {
  return ship.hits.length >= ship.length;
}

export function shipAt(board: Board, coord: Coord): Ship | undefined {
  return board.ships.find((s) =>
    s.cells.some((c) => c.row === coord.row && c.col === coord.col),
  );
}

export function alreadyAttacked(board: Board, coord: Coord): boolean {
  if (!isOnBoard(coord)) return false;
  return board.grid[coord.row][coord.col] !== 'unknown';
}

/**
 * Applies an attack to a board, returning the new board and the outcome.
 * Off-board or repeated attacks return an 'invalid' outcome and leave the board unchanged.
 */
export function attack(
  board: Board,
  coord: Coord,
): { board: Board; result: AttackResult } {
  if (!isOnBoard(coord) || alreadyAttacked(board, coord)) {
    return { board, result: { outcome: 'invalid', coord } };
  }

  const target = shipAt(board, coord);
  const grid = board.grid.map((row, r) =>
    row.map((cell, c) =>
      r === coord.row && c === coord.col ? (target ? 'hit' : 'miss') : cell,
    ),
  );

  if (!target) {
    return { board: { ...board, grid }, result: { outcome: 'miss', coord } };
  }

  const hitShip: Ship = { ...target, hits: [...target.hits, coord] };
  const ships = board.ships.map((s) => (s.id === hitShip.id ? hitShip : s));
  return {
    board: { ships, grid },
    result: {
      outcome: isSunk(hitShip) ? 'sunk' : 'hit',
      coord,
      ship: hitShip,
    },
  };
}

export function allShipsSunk(board: Board): boolean {
  return board.ships.length > 0 && board.ships.every(isSunk);
}

export function remainingShips(board: Board): Ship[] {
  return board.ships.filter((s) => !isSunk(s));
}

export function isFleetComplete(board: Board): boolean {
  return board.ships.length === FLEET.length;
}
