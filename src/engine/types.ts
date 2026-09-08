export const BOARD_SIZE = 10;

export type Orientation = 'horizontal' | 'vertical';

export type ShipName =
  | 'Carrier'
  | 'Battleship'
  | 'Cruiser'
  | 'Submarine'
  | 'Destroyer';

export interface ShipSpec {
  name: ShipName;
  length: number;
}

export const FLEET: readonly ShipSpec[] = [
  { name: 'Carrier', length: 5 },
  { name: 'Battleship', length: 4 },
  { name: 'Cruiser', length: 3 },
  { name: 'Submarine', length: 3 },
  { name: 'Destroyer', length: 2 },
] as const;

export interface Coord {
  row: number;
  col: number;
}

export interface Ship {
  id: string;
  name: ShipName;
  length: number;
  cells: Coord[];
  hits: Coord[];
}

export type CellState = 'unknown' | 'miss' | 'hit';

export interface Board {
  ships: Ship[];
  /** Attack results indexed [row][col]; 'unknown' means not yet attacked. */
  grid: CellState[][];
}

export type AttackOutcome = 'miss' | 'hit' | 'sunk' | 'invalid';

export interface AttackResult {
  outcome: AttackOutcome;
  coord: Coord;
  ship?: Ship;
}

export type Difficulty = 'easy' | 'smart' | 'scott';

export type Phase = 'setup' | 'playing' | 'gameover';

export type Player = 'human' | 'ai';
