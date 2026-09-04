import { canPlaceShip, createBoard, placeShip } from './board';
import { defaultRng, randomInt, type Rng } from './random';
import {
  BOARD_SIZE,
  FLEET,
  type Board,
  type Coord,
  type Orientation,
  type ShipSpec,
} from './types';

const ORIENTATIONS: Orientation[] = ['horizontal', 'vertical'];

export function legalPlacements(
  board: Board,
  length: number,
  orientation: Orientation,
): Coord[] {
  const cells: Coord[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (canPlaceShip(board, { row, col }, length, orientation)) {
        cells.push({ row, col });
      }
    }
  }
  return cells;
}

/** Places the remaining fleet at random. Falls back to a fresh retry if a layout dead-ends. */
export function randomizeRemaining(
  board: Board,
  specs: readonly ShipSpec[],
  rng: Rng = defaultRng,
): Board {
  let current = board;
  for (const spec of specs) {
    const options = ORIENTATIONS.flatMap((orientation) =>
      legalPlacements(current, spec.length, orientation).map((start) => ({
        start,
        orientation,
      })),
    );
    if (options.length === 0) return randomizeRemaining(board, specs, rng);
    const choice = options[randomInt(rng, options.length)];
    current = placeShip(current, spec, choice.start, choice.orientation) ?? current;
  }
  return current;
}

export function randomBoard(rng: Rng = defaultRng): Board {
  return randomizeRemaining(createBoard(), FLEET, rng);
}

export function remainingFleet(board: Board): ShipSpec[] {
  const placed = new Set(board.ships.map((s) => s.name));
  return FLEET.filter((spec) => !placed.has(spec.name));
}
