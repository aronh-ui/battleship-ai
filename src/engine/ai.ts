import { alreadyAttacked, key } from './board';
import { defaultRng, randomInt, type Rng } from './random';
import {
  BOARD_SIZE,
  type AttackResult,
  type Board,
  type Coord,
  type Difficulty,
} from './types';

export type AiMode = 'hunt' | 'target';

export interface AiState {
  difficulty: Difficulty;
  /** Hits that belong to a ship that has not been sunk yet. */
  pendingHits: Coord[];
}

export interface AiMove {
  coord: Coord;
  mode: AiMode;
  /** Plain-language explanation of why this cell was chosen. */
  reason: string;
}

export function createAiState(difficulty: Difficulty = 'smart'): AiState {
  return { difficulty, pendingHits: [] };
}

function neighbors({ row, col }: Coord): Coord[] {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ];
}

function inBounds({ row, col }: Coord): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function untried(board: Board, coord: Coord): boolean {
  return inBounds(coord) && !alreadyAttacked(board, coord);
}

function allUntried(board: Board): Coord[] {
  const cells: Coord[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board.grid[row][col] === 'unknown') cells.push({ row, col });
    }
  }
  return cells;
}

/**
 * Cells along the line implied by two or more hits, extending past both ends.
 * Only returns cells that have not been attacked yet.
 */
function lineExtensions(board: Board, hits: Coord[]): Coord[] {
  const horizontal = hits.every((h) => h.row === hits[0].row);
  const vertical = hits.every((h) => h.col === hits[0].col);
  if (!horizontal && !vertical) return [];

  const sorted = [...hits].sort((a, b) =>
    horizontal ? a.col - b.col : a.row - b.row,
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const candidates = horizontal
    ? [
        { row: first.row, col: first.col - 1 },
        { row: last.row, col: last.col + 1 },
      ]
    : [
        { row: first.row - 1, col: first.col },
        { row: last.row + 1, col: last.col },
      ];
  return candidates.filter((c) => untried(board, c));
}

/**
 * Probability-density targeting for the hardest difficulty. For every ship still
 * afloat, every placement consistent with what the AI has seen (no misses, no cells of
 * sunk ships; in target mode it must cover a known hit) adds weight to the cells it
 * would occupy. The densest untried cell is the shot. Uses only public information:
 * the attack grid, announced sinks and the AI's own hit memory.
 */
export function densityMap(board: Board, pendingHits: Coord[]): number[][] {
  const pending = new Set(pendingHits.map(key));
  const sunkCells = new Set(
    board.ships
      .filter((s) => s.hits.length === s.length)
      .flatMap((s) => s.cells.map(key)),
  );
  const open = (c: Coord) =>
    inBounds(c) &&
    !sunkCells.has(key(c)) &&
    (board.grid[c.row][c.col] === 'unknown' || pending.has(key(c)));
  const lengths = board.ships
    .filter((s) => s.hits.length < s.length)
    .map((s) => s.length);
  const map = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0) as number[]);

  for (const length of lengths) {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        for (const horizontal of [true, false]) {
          const cells: Coord[] = [];
          for (let i = 0; i < length; i++) {
            cells.push(horizontal ? { row, col: col + i } : { row: row + i, col });
          }
          if (!cells.every(open)) continue;
          const covered = cells.filter((c) => pending.has(key(c))).length;
          if (pending.size > 0 && covered === 0) continue;
          const weight = 1 + covered * BOARD_SIZE;
          for (const c of cells) {
            if (!pending.has(key(c))) map[c.row][c.col] += weight;
          }
        }
      }
    }
  }
  return map;
}

function densestCell(board: Board, state: AiState, rng: Rng): Coord | null {
  const map = densityMap(board, state.pendingHits);
  let best: Coord[] = [];
  let bestScore = 0;
  for (const c of allUntried(board)) {
    const score = map[c.row][c.col];
    if (score > bestScore) {
      bestScore = score;
      best = [c];
    } else if (score === bestScore && score > 0) {
      best.push(c);
    }
  }
  return best.length > 0 ? best[randomInt(rng, best.length)] : null;
}

/** Cells whose coordinates share the checkerboard parity used for hunting. */
export function parityCells(cells: Coord[]): Coord[] {
  return cells.filter((c) => (c.row + c.col) % 2 === 0);
}

/**
 * Chooses the AI's next shot against `board` (the defender's board).
 * Only attack history (`board.grid`) and past results are consulted — never ship positions.
 */
export function chooseMove(
  board: Board,
  state: AiState,
  rng: Rng = defaultRng,
): AiMove | null {
  const options = allUntried(board);
  if (options.length === 0) return null;

  if (state.difficulty === 'scott') {
    const coord = densestCell(board, state, rng);
    if (coord) {
      const targeting = state.pendingHits.length > 0;
      return {
        coord,
        mode: targeting ? 'target' : 'hunt',
        reason: targeting
          ? 'Weighs every placement of the damaged ship that fits the evidence and fires where the most of them overlap.'
          : 'Counts every way the remaining ships could still fit around the misses and fires at the cell covered by the most of them.',
      };
    }
  }

  if (state.difficulty !== 'easy' && state.pendingHits.length > 0) {
    const connected = connectedGroup(state.pendingHits);

    if (connected.length >= 2) {
      const line = lineExtensions(board, connected);
      if (line.length > 0) {
        return {
          coord: line[randomInt(rng, line.length)],
          mode: 'target',
          reason:
            'Two hits in a line confirmed the ship direction, so it fires at the next cell along that line.',
        };
      }
    }

    const adjacent = state.pendingHits
      .flatMap(neighbors)
      .filter((c) => untried(board, c));
    if (adjacent.length > 0) {
      return {
        coord: adjacent[randomInt(rng, adjacent.length)],
        mode: 'target',
        reason:
          'A damaged ship has not sunk yet, so it probes a cell next to a known hit.',
      };
    }
  }

  if (state.difficulty === 'smart') {
    const parity = parityCells(options);
    if (parity.length > 0) {
      return {
        coord: parity[randomInt(rng, parity.length)],
        mode: 'hunt',
        reason:
          'Hunting on a checkerboard pattern: every ship is at least two cells long, so this half of the board is enough to find them all.',
      };
    }
  }

  return {
    coord: options[randomInt(rng, options.length)],
    mode: 'hunt',
    reason:
      state.difficulty === 'easy'
        ? 'Easy mode fires at a random cell it has not tried yet.'
        : 'No checkerboard cells are left, so it fires at any remaining untried cell.',
  };
}

/** Hits that are orthogonally connected to the most recent pending hit. */
function connectedGroup(hits: Coord[]): Coord[] {
  if (hits.length === 0) return [];
  const remaining = new Map(hits.map((h) => [key(h), h]));
  const start = hits[hits.length - 1];
  const group: Coord[] = [];
  const stack = [start];
  remaining.delete(key(start));
  while (stack.length > 0) {
    const current = stack.pop()!;
    group.push(current);
    for (const n of neighbors(current)) {
      const found = remaining.get(key(n));
      if (found) {
        remaining.delete(key(n));
        stack.push(found);
      }
    }
  }
  return group;
}

/** Updates AI memory after its shot resolves. */
export function updateAiState(state: AiState, result: AttackResult): AiState {
  if (result.outcome === 'hit') {
    return { ...state, pendingHits: [...state.pendingHits, result.coord] };
  }
  if (result.outcome === 'sunk') {
    // Only the sunk ship's own cells are cleared: a touching ship may still be
    // damaged, and its hits are connected to the ones just cleared.
    const sunkCells = new Set(
      (result.ship?.cells ?? connectedGroup([...state.pendingHits, result.coord])).map(
        key,
      ),
    );
    return {
      ...state,
      pendingHits: state.pendingHits.filter((h) => !sunkCells.has(key(h))),
    };
  }
  return state;
}

export type AiStage = 'observe' | 'reason' | 'act';

export interface AiThought {
  stage: AiStage;
  label: string;
  detail: string;
}

/**
 * The reasoning the AI is about to apply, derived from the same data `chooseMove`
 * uses: the defender's visible attack grid and the AI's own memory of unresolved
 * hits. Nothing here depends on where ships actually are.
 */
export function aiPlan(board: Board, state: AiState): AiThought[] {
  const untried = allUntried(board);
  const targeting = state.difficulty !== 'easy' && state.pendingHits.length > 0;
  const steps: AiThought[] = [
    {
      stage: 'observe',
      label: 'Scanning grid',
      detail: `${untried.length} cells unresolved`,
    },
  ];

  if (state.difficulty === 'scott') {
    steps.push({
      stage: 'observe',
      label: targeting ? 'Analyzing previous hits' : 'Mapping remaining fleet',
      detail: targeting
        ? `${state.pendingHits.length} damaged cell${state.pendingHits.length === 1 ? '' : 's'} constrain the hull`
        : `${board.ships.filter((s) => s.hits.length < s.length).length} hulls still afloat`,
    });
    steps.push({
      stage: 'reason',
      label: 'Computing probability density',
      detail: 'Counting every placement consistent with the evidence',
    });
  } else if (targeting) {
    const connected = connectedGroup(state.pendingHits);
    const line = connected.length >= 2 ? lineExtensions(board, connected) : [];
    steps.push({
      stage: 'observe',
      label: 'Analyzing previous hits',
      detail: `${state.pendingHits.length} damaged cell${
        state.pendingHits.length === 1 ? '' : 's'
      } still unresolved`,
    });
    if (line.length > 0) {
      const horizontal = connected.every((c) => c.row === connected[0].row);
      steps.push({
        stage: 'reason',
        label: 'Detecting ship orientation',
        detail: `${horizontal ? 'Horizontal' : 'Vertical'} hull confirmed — extending the line`,
      });
    } else {
      steps.push({
        stage: 'reason',
        label: 'Probing adjacent cells',
        detail: 'Orientation unknown — testing the neighbours of a known hit',
      });
    }
  } else if (state.difficulty === 'smart') {
    const parity = parityCells(untried);
    steps.push({
      stage: 'reason',
      label: 'Eliminating impossible targets',
      detail: `Every hull must cover one of ${parity.length} checkerboard cells — skipping the other ${untried.length - parity.length}`,
    });
  } else {
    steps.push({
      stage: 'reason',
      label: 'Sampling at random',
      detail: 'Easy mode ignores what it has learned so far',
    });
  }

  steps.push({
    stage: 'act',
    label: targeting ? 'Target acquired' : 'Selecting optimal target',
    detail: targeting ? 'Locking on to the damaged hull' : 'Highest-value untried cell',
  });
  steps.push({ stage: 'act', label: 'Firing', detail: 'Solution locked' });
  return steps;
}

export function aiMode(state: AiState): AiMode {
  return state.difficulty !== 'easy' && state.pendingHits.length > 0
    ? 'target'
    : 'hunt';
}
