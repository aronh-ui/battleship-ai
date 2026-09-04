import { describe, expect, it } from 'vitest';
import {
  aiAttack,
  autofillPlayerBoard,
  clearPlayerBoard,
  createGame,
  nextShipToPlace,
  placePlayerShip,
  playerAttack,
  randomizePlayerBoard,
  resetGame,
  setDifficulty,
  startGame,
  type GameState,
} from './game';
import { seededRng } from './random';
import { FLEET, type Coord } from './types';

const rng = () => seededRng(13);

function readyGame(): GameState {
  return startGame(randomizePlayerBoard(createGame('smart', seededRng(1)), seededRng(2)));
}

describe('setup phase', () => {
  it('starts in setup with an AI fleet already placed', () => {
    const game = createGame('smart', seededRng(1));
    expect(game.phase).toBe('setup');
    expect(game.aiBoard.ships).toHaveLength(FLEET.length);
    expect(game.playerBoard.ships).toHaveLength(0);
    expect(nextShipToPlace(game)?.name).toBe('Carrier');
  });

  it('places ships in fleet order and rejects invalid placements', () => {
    let game = createGame('smart', seededRng(1));
    game = placePlayerShip(game, { row: 0, col: 0 }, 'horizontal');
    expect(game.playerBoard.ships).toHaveLength(1);
    expect(nextShipToPlace(game)?.name).toBe('Battleship');

    const overlapping = placePlayerShip(game, { row: 0, col: 0 }, 'horizontal');
    expect(overlapping).toBe(game);

    const offBoard = placePlayerShip(game, { row: 9, col: 8 }, 'horizontal');
    expect(offBoard).toBe(game);
  });

  it('cannot start until the whole fleet is placed', () => {
    const game = placePlayerShip(createGame('smart', seededRng(1)), { row: 0, col: 0 }, 'horizontal');
    expect(startGame(game).phase).toBe('setup');
  });

  it('randomize, autofill and clear manage the player board', () => {
    let game = createGame('smart', seededRng(1));
    game = placePlayerShip(game, { row: 0, col: 0 }, 'horizontal');
    game = autofillPlayerBoard(game, seededRng(6));
    expect(game.playerBoard.ships).toHaveLength(FLEET.length);
    expect(game.playerBoard.ships[0].cells[0]).toEqual({ row: 0, col: 0 });

    game = clearPlayerBoard(game);
    expect(game.playerBoard.ships).toHaveLength(0);

    game = randomizePlayerBoard(game, seededRng(6));
    expect(game.playerBoard.ships).toHaveLength(FLEET.length);
  });

  it('ignores attacks before the game starts', () => {
    const game = createGame('smart', seededRng(1));
    expect(playerAttack(game, { row: 0, col: 0 })).toBe(game);
    expect(aiAttack(game, rng())).toBe(game);
  });

  it('switches difficulty and propagates it to the AI', () => {
    const game = setDifficulty(createGame('smart', seededRng(1)), 'easy');
    expect(game.difficulty).toBe('easy');
    expect(game.aiState.difficulty).toBe('easy');
  });
});

describe('turn order', () => {
  it('hands the turn to the AI after a player shot and back again', () => {
    let game = readyGame();
    expect(game.phase).toBe('playing');
    expect(game.turn).toBe('human');

    game = playerAttack(game, { row: 0, col: 0 });
    expect(game.turn).toBe('ai');

    game = aiAttack(game, seededRng(3));
    expect(game.turn).toBe('human');
    expect(game.log).toHaveLength(2);
  });

  it('ignores a player shot while it is the AI turn', () => {
    let game = playerAttack(readyGame(), { row: 0, col: 0 });
    const blocked = playerAttack(game, { row: 1, col: 1 });
    expect(blocked).toBe(game);
    game = aiAttack(game, seededRng(3));
    expect(aiAttack(game, seededRng(3))).toBe(game);
  });

  it('ignores repeated attacks on the same cell', () => {
    let game = readyGame();
    game = playerAttack(game, { row: 0, col: 0 });
    game = aiAttack(game, seededRng(3));
    const repeat = playerAttack(game, { row: 0, col: 0 });
    expect(repeat).toBe(game);
  });

  it('records hits, misses and sinks in the log', () => {
    let game = readyGame();
    const shipCell = game.aiBoard.ships[4].cells[0];
    game = playerAttack(game, shipCell);
    expect(game.log[0]).toMatchObject({ player: 'human', outcome: 'hit' });
  });
});

describe('win and loss', () => {
  const sinkAll = (game: GameState, cells: Coord[]): GameState =>
    cells.reduce((g, coord) => {
      const next = playerAttack(g, coord);
      return next.phase === 'gameover' ? next : aiAttack(next, seededRng(8));
    }, game);

  it('declares the human the winner when every AI ship is sunk', () => {
    const game = readyGame();
    const cells = game.aiBoard.ships.flatMap((s) => s.cells);
    const finished = sinkAll(game, cells);
    expect(finished.phase).toBe('gameover');
    expect(finished.winner).toBe('human');
    expect(finished.aiBoard.ships.every((s) => s.hits.length === s.length)).toBe(true);
  });

  it('declares the AI the winner when it sinks the human fleet', () => {
    let game = readyGame();
    let guard = 0;
    while (game.phase === 'playing' && guard++ < 400) {
      if (game.turn === 'human') {
        const empty = firstUntried(game);
        game = playerAttack(game, empty);
      } else {
        game = aiAttack(game, seededRng(guard));
      }
    }
    expect(game.phase).toBe('gameover');
    expect(['human', 'ai']).toContain(game.winner);
  });

  it('blocks further attacks after the game is over', () => {
    const game = readyGame();
    const finished = sinkAll(game, game.aiBoard.ships.flatMap((s) => s.cells));
    expect(playerAttack(finished, { row: 9, col: 9 })).toBe(finished);
    expect(aiAttack(finished, seededRng(3))).toBe(finished);
  });

  it('play again resets to a fresh setup phase, keeping difficulty', () => {
    const finished = setDifficulty(readyGame(), 'easy');
    const fresh = resetGame(finished, seededRng(21));
    expect(fresh.phase).toBe('setup');
    expect(fresh.difficulty).toBe('easy');
    expect(fresh.winner).toBeNull();
    expect(fresh.log).toEqual([]);
    expect(fresh.playerBoard.ships).toHaveLength(0);
    expect(fresh.aiBoard.ships).toHaveLength(FLEET.length);
  });
});

function firstUntried(game: GameState): Coord {
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      if (game.aiBoard.grid[row][col] === 'unknown') return { row, col };
    }
  }
  throw new Error('board exhausted');
}
