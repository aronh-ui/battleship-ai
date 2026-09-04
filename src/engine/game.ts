import {
  allShipsSunk,
  attack,
  createBoard,
  isFleetComplete,
  placeShip,
} from './board';
import { chooseMove, createAiState, updateAiState, type AiState } from './ai';
import { randomBoard, randomizeRemaining, remainingFleet } from './placement';
import { defaultRng, type Rng } from './random';
import {
  FLEET,
  type AttackResult,
  type Board,
  type Coord,
  type Difficulty,
  type Orientation,
  type Phase,
  type Player,
  type ShipSpec,
} from './types';

export interface LogEntry {
  player: Player;
  coord: Coord;
  outcome: AttackResult['outcome'];
  shipName?: string;
  reason?: string;
}

export interface GameState {
  phase: Phase;
  turn: Player;
  difficulty: Difficulty;
  playerBoard: Board;
  aiBoard: Board;
  aiState: AiState;
  winner: Player | null;
  log: LogEntry[];
}

export function createGame(
  difficulty: Difficulty = 'smart',
  rng: Rng = defaultRng,
): GameState {
  return {
    phase: 'setup',
    turn: 'human',
    difficulty,
    playerBoard: createBoard(),
    aiBoard: randomBoard(rng),
    aiState: createAiState(difficulty),
    winner: null,
    log: [],
  };
}

export function nextShipToPlace(state: GameState): ShipSpec | null {
  return remainingFleet(state.playerBoard)[0] ?? null;
}

export function placePlayerShip(
  state: GameState,
  start: Coord,
  orientation: Orientation,
): GameState {
  if (state.phase !== 'setup') return state;
  const spec = nextShipToPlace(state);
  if (!spec) return state;
  const playerBoard = placeShip(state.playerBoard, spec, start, orientation);
  return playerBoard ? { ...state, playerBoard } : state;
}

export function randomizePlayerBoard(
  state: GameState,
  rng: Rng = defaultRng,
): GameState {
  if (state.phase !== 'setup') return state;
  return { ...state, playerBoard: randomBoard(rng) };
}

export function autofillPlayerBoard(
  state: GameState,
  rng: Rng = defaultRng,
): GameState {
  if (state.phase !== 'setup') return state;
  return {
    ...state,
    playerBoard: randomizeRemaining(
      state.playerBoard,
      remainingFleet(state.playerBoard),
      rng,
    ),
  };
}

export function clearPlayerBoard(state: GameState): GameState {
  if (state.phase !== 'setup') return state;
  return { ...state, playerBoard: createBoard() };
}

export function setDifficulty(
  state: GameState,
  difficulty: Difficulty,
): GameState {
  return {
    ...state,
    difficulty,
    aiState: { ...state.aiState, difficulty },
  };
}

export function startGame(state: GameState): GameState {
  if (state.phase !== 'setup' || !isFleetComplete(state.playerBoard)) {
    return state;
  }
  return { ...state, phase: 'playing', turn: 'human' };
}

/** Human fires at the AI board. Invalid shots leave the state untouched. */
export function playerAttack(state: GameState, coord: Coord): GameState {
  if (state.phase !== 'playing' || state.turn !== 'human') return state;
  const { board, result } = attack(state.aiBoard, coord);
  if (result.outcome === 'invalid') return state;

  const log: LogEntry[] = [
    ...state.log,
    {
      player: 'human',
      coord,
      outcome: result.outcome,
      shipName: result.outcome === 'sunk' ? result.ship?.name : undefined,
    },
  ];

  if (allShipsSunk(board)) {
    return {
      ...state,
      aiBoard: board,
      phase: 'gameover',
      winner: 'human',
      log,
    };
  }
  return { ...state, aiBoard: board, turn: 'ai', log };
}

/** AI fires at the human board. Returns the same state if it is not the AI's turn. */
export function aiAttack(state: GameState, rng: Rng = defaultRng): GameState {
  if (state.phase !== 'playing' || state.turn !== 'ai') return state;
  const move = chooseMove(state.playerBoard, state.aiState, rng);
  if (!move) return state;

  const { board, result } = attack(state.playerBoard, move.coord);
  if (result.outcome === 'invalid') return state;

  const aiState = updateAiState(state.aiState, result);
  const log: LogEntry[] = [
    ...state.log,
    {
      player: 'ai',
      coord: move.coord,
      outcome: result.outcome,
      shipName: result.outcome === 'sunk' ? result.ship?.name : undefined,
      reason: move.reason,
    },
  ];

  if (allShipsSunk(board)) {
    return {
      ...state,
      playerBoard: board,
      aiState,
      phase: 'gameover',
      winner: 'ai',
      log,
    };
  }
  return { ...state, playerBoard: board, aiState, turn: 'human', log };
}

export function resetGame(
  state: GameState,
  rng: Rng = defaultRng,
): GameState {
  return createGame(state.difficulty, rng);
}

export { FLEET };
