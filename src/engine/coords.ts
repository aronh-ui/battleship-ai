import { BOARD_SIZE, type Coord } from './types';

export const COLUMN_LABELS = Array.from({ length: BOARD_SIZE }, (_, i) =>
  String.fromCharCode(65 + i),
);

/** Human-readable coordinate, e.g. { row: 0, col: 0 } -> "A1". */
export function coordLabel({ row, col }: Coord): string {
  return `${COLUMN_LABELS[col]}${row + 1}`;
}
