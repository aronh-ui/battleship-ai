import { describe, expect, it } from 'vitest';
import {
  aiPlan,
  chooseMove,
  createAiState,
  parityCells,
  updateAiState,
  type AiState,
} from './ai';
import { attack, createBoard, placeShip } from './board';
import { randomBoard } from './placement';
import { seededRng } from './random';
import { BOARD_SIZE, FLEET, type Board, type Coord } from './types';

const rng = () => 0; // always picks the first candidate

function boardWith(...placements: [number, Coord, 'horizontal' | 'vertical'][]): Board {
  let board = createBoard();
  for (const [index, start, orientation] of placements) {
    board = placeShip(board, FLEET[index], start, orientation)!;
  }
  return board;
}

function fireAt(board: Board, cells: Coord[]): Board {
  return cells.reduce((b, c) => attack(b, c).board, board);
}

describe('hunt mode', () => {
  it('only fires at checkerboard cells while hunting in smart mode', () => {
    let board = createBoard();
    let state = createAiState('smart');
    const seeded = seededRng(42);
    for (let i = 0; i < 30; i++) {
      const move = chooseMove(board, state, seeded)!;
      expect((move.coord.row + move.coord.col) % 2).toBe(0);
      expect(move.mode).toBe('hunt');
      board = attack(board, move.coord).board;
      state = updateAiState(state, { outcome: 'miss', coord: move.coord });
    }
  });

  it('falls back to any untried cell when the parity half is exhausted', () => {
    let board = createBoard();
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if ((row + col) % 2 === 0) board = attack(board, { row, col }).board;
      }
    }
    const move = chooseMove(board, createAiState('smart'), rng)!;
    expect((move.coord.row + move.coord.col) % 2).toBe(1);
  });

  it('never repeats a cell over a full game', () => {
    let board = randomBoard(seededRng(9));
    let state = createAiState('smart');
    const seen = new Set<string>();
    const seeded = seededRng(5);
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      const move = chooseMove(board, state, seeded);
      if (!move) break;
      const id = `${move.coord.row},${move.coord.col}`;
      expect(seen.has(id)).toBe(false);
      seen.add(id);
      const outcome = attack(board, move.coord);
      board = outcome.board;
      state = updateAiState(state, outcome.result);
    }
    expect(seen.size).toBe(BOARD_SIZE * BOARD_SIZE);
    expect(board.ships.every((s) => s.hits.length === s.length)).toBe(true);
  });

  it('returns null when the board is fully attacked', () => {
    let board = createBoard();
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        board = attack(board, { row, col }).board;
      }
    }
    expect(chooseMove(board, createAiState('smart'), rng)).toBeNull();
  });

  it('easy mode ignores parity and stays in hunt mode after a hit', () => {
    const board = fireAt(boardWith([4, { row: 4, col: 4 }, 'horizontal']), []);
    const state: AiState = { difficulty: 'easy', pendingHits: [{ row: 4, col: 4 }] };
    const move = chooseMove(board, state, seededRng(2))!;
    expect(move.mode).toBe('hunt');
  });
});

describe('target mode', () => {
  it('probes an orthogonal neighbour after a single hit', () => {
    const board = fireAt(boardWith([0, { row: 4, col: 2 }, 'horizontal']), [
      { row: 4, col: 4 },
    ]);
    const state = updateAiState(createAiState('smart'), {
      outcome: 'hit',
      coord: { row: 4, col: 4 },
    });
    const move = chooseMove(board, state, rng)!;
    expect(move.mode).toBe('target');
    const { row, col } = move.coord;
    expect(Math.abs(row - 4) + Math.abs(col - 4)).toBe(1);
  });

  it('locks onto the direction once two hits line up', () => {
    const board = fireAt(boardWith([0, { row: 4, col: 2 }, 'horizontal']), [
      { row: 4, col: 4 },
      { row: 4, col: 5 },
    ]);
    let state = updateAiState(createAiState('smart'), {
      outcome: 'hit',
      coord: { row: 4, col: 4 },
    });
    state = updateAiState(state, { outcome: 'hit', coord: { row: 4, col: 5 } });
    for (let i = 0; i < 10; i++) {
      const move = chooseMove(board, state, seededRng(i + 1))!;
      expect(move.mode).toBe('target');
      expect(move.coord.row).toBe(4);
      expect([3, 6]).toContain(move.coord.col);
    }
  });

  it('continues along a vertical line', () => {
    const board = fireAt(boardWith([0, { row: 2, col: 6 }, 'vertical']), [
      { row: 2, col: 6 },
      { row: 3, col: 6 },
    ]);
    let state = updateAiState(createAiState('smart'), {
      outcome: 'hit',
      coord: { row: 2, col: 6 },
    });
    state = updateAiState(state, { outcome: 'hit', coord: { row: 3, col: 6 } });
    const move = chooseMove(board, state, rng)!;
    expect(move.coord.col).toBe(6);
    expect([1, 4]).toContain(move.coord.row);
  });

  it('returns to hunt mode after the targeted ship sinks', () => {
    let state = createAiState('smart');
    state = updateAiState(state, { outcome: 'hit', coord: { row: 4, col: 4 } });
    state = updateAiState(state, { outcome: 'sunk', coord: { row: 4, col: 5 } });
    expect(state.pendingHits).toEqual([]);
    const move = chooseMove(createBoard(), state, rng)!;
    expect(move.mode).toBe('hunt');
  });

  it('keeps targeting a damaged ship that touches the one it just sank', () => {
    // Destroyer at A1-B1 with a cruiser butted against it at C1-E1.
    let board = boardWith(
      [4, { row: 0, col: 0 }, 'horizontal'],
      [2, { row: 0, col: 2 }, 'horizontal'],
    );
    let state = createAiState('smart');
    for (const coord of [
      { row: 0, col: 2 },
      { row: 0, col: 1 },
      { row: 0, col: 0 },
    ]) {
      const outcome = attack(board, coord);
      board = outcome.board;
      state = updateAiState(state, outcome.result);
    }
    expect(state.pendingHits).toEqual([{ row: 0, col: 2 }]);

    const move = chooseMove(board, state, rng)!;
    expect(move.mode).toBe('target');
    expect(move.coord).toEqual({ row: 1, col: 2 });
  });

  it('keeps targeting a second damaged ship when one of two sinks', () => {
    let state = createAiState('smart');
    state = updateAiState(state, { outcome: 'hit', coord: { row: 0, col: 0 } });
    state = updateAiState(state, { outcome: 'hit', coord: { row: 7, col: 7 } });
    state = updateAiState(state, { outcome: 'sunk', coord: { row: 7, col: 8 } });
    expect(state.pendingHits).toEqual([{ row: 0, col: 0 }]);
  });

  it('sinks a ship faster in smart mode than in easy mode', () => {
    const shots = (difficulty: 'easy' | 'smart') => {
      let board = randomBoard(seededRng(11));
      let state = createAiState(difficulty);
      const seeded = seededRng(4);
      let count = 0;
      while (!board.ships.every((s) => s.hits.length === s.length)) {
        const move = chooseMove(board, state, seeded)!;
        const outcome = attack(board, move.coord);
        board = outcome.board;
        state = updateAiState(state, outcome.result);
        count++;
      }
      return count;
    };
    expect(shots('smart')).toBeLessThan(shots('easy'));
  });
});

describe('parityCells', () => {
  it('keeps half of a full board', () => {
    const all: Coord[] = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) all.push({ row, col });
    }
    expect(parityCells(all)).toHaveLength(50);
  });
});

describe('aiPlan', () => {
  it('describes the checkerboard search while hunting', () => {
    const plan = aiPlan(createBoard(), createAiState('smart'));
    expect(plan.map((s) => s.stage)).toEqual(['observe', 'reason', 'act', 'act']);
    expect(plan[0].detail).toContain('100 cells');
    expect(plan[1].label).toBe('Eliminating impossible targets');
    expect(plan[plan.length - 1].label).toBe('Firing');
  });

  it('switches to a targeting narrative once a hit is unresolved', () => {
    const board = boardWith([1, { row: 4, col: 4 }, 'horizontal']);
    const fired = fireAt(board, [{ row: 4, col: 4 }]);
    const state: AiState = { difficulty: 'smart', pendingHits: [{ row: 4, col: 4 }] };
    const plan = aiPlan(fired, state);
    expect(plan.map((s) => s.label)).toContain('Analyzing previous hits');
    expect(plan.map((s) => s.label)).toContain('Probing adjacent cells');
    expect(plan.map((s) => s.label)).toContain('Target acquired');
  });

  it('reports the confirmed orientation once two hits line up', () => {
    const board = boardWith([1, { row: 4, col: 4 }, 'horizontal']);
    const fired = fireAt(board, [
      { row: 4, col: 4 },
      { row: 4, col: 5 },
    ]);
    const state: AiState = {
      difficulty: 'smart',
      pendingHits: [
        { row: 4, col: 4 },
        { row: 4, col: 5 },
      ],
    };
    const plan = aiPlan(fired, state);
    const orientation = plan.find((s) => s.label === 'Detecting ship orientation');
    expect(orientation?.detail).toContain('Horizontal');
  });

  it('never mentions a cell the AI has not attacked', () => {
    const board = boardWith([0, { row: 0, col: 0 }, 'horizontal']);
    const plan = aiPlan(board, createAiState('smart'));
    const text = plan.map((s) => `${s.label} ${s.detail}`).join(' ');
    expect(text).not.toMatch(/[A-J](10|[1-9])\b/);
  });

  it('is honest about easy mode', () => {
    const plan = aiPlan(createBoard(), createAiState('easy'));
    expect(plan.map((s) => s.label)).toContain('Sampling at random');
  });
});
