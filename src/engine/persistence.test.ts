import { describe, expect, it } from 'vitest';
import { createGame, playerAttack, randomizePlayerBoard, startGame } from './game';
import { clearSavedGame, decodeGame, loadGame, saveGame } from './persistence';
import { seededRng } from './random';
import type { KeyValueStore } from './persistence';

function fakeStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function midGame() {
  const rng = seededRng(9);
  let game = startGame(randomizePlayerBoard(createGame('smart', rng), rng));
  game = playerAttack(game, { row: 3, col: 3 });
  return game;
}

describe('game persistence', () => {
  it('restores a game in progress unchanged', () => {
    const store = fakeStore();
    const game = midGame();
    saveGame(store, game);
    expect(loadGame(store)).toEqual(game);
  });

  it('returns null when nothing has been saved', () => {
    expect(loadGame(fakeStore())).toBeNull();
  });

  it('discards corrupt or foreign saved data instead of crashing', () => {
    expect(decodeGame('not json')).toBeNull();
    expect(decodeGame(JSON.stringify({ phase: 'playing' }))).toBeNull();
    expect(
      decodeGame(JSON.stringify({ ...midGame(), phase: 'elsewhere' })),
    ).toBeNull();
    expect(
      decodeGame(JSON.stringify({ ...midGame(), playerBoard: { grid: [], ships: [] } })),
    ).toBeNull();
  });

  it('clears the saved game', () => {
    const store = fakeStore();
    saveGame(store, midGame());
    clearSavedGame(store);
    expect(loadGame(store)).toBeNull();
  });

  it('tolerates a storage that throws (private browsing, quota)', () => {
    const hostile: KeyValueStore = {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('denied');
      },
      removeItem() {
        throw new Error('denied');
      },
    };
    expect(loadGame(hostile)).toBeNull();
    expect(() => saveGame(hostile, midGame())).not.toThrow();
    expect(() => clearSavedGame(hostile)).not.toThrow();
  });
});
