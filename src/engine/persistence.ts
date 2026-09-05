import { BOARD_SIZE } from './types';
import type { GameState } from './game';

/** Bumped whenever the shape of GameState changes, so stale saves are discarded. */
const STORAGE_KEY = 'battleship-ai:game:v1';

/** The subset of the Storage API used here, so the engine stays DOM-free. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isBoard(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const board = value as { grid?: unknown; ships?: unknown };
  return (
    Array.isArray(board.ships) &&
    Array.isArray(board.grid) &&
    board.grid.length === BOARD_SIZE &&
    board.grid.every((row) => Array.isArray(row) && row.length === BOARD_SIZE)
  );
}

/** Parses a saved game, returning null for anything malformed or outdated. */
export function decodeGame(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GameState;
    const validPhase = ['setup', 'playing', 'gameover'].includes(parsed?.phase);
    const validTurn = ['human', 'ai'].includes(parsed?.turn);
    if (!validPhase || !validTurn) return null;
    if (!isBoard(parsed.playerBoard) || !isBoard(parsed.aiBoard)) return null;
    if (!Array.isArray(parsed.log) || !Array.isArray(parsed.aiState?.pendingHits)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function loadGame(store: KeyValueStore | undefined): GameState | null {
  if (!store) return null;
  try {
    return decodeGame(store.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Persists the game; storage failures (private mode, quota) are non-fatal. */
export function saveGame(store: KeyValueStore | undefined, state: GameState): void {
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function clearSavedGame(store: KeyValueStore | undefined): void {
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
