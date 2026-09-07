import { describe, expect, it } from 'vitest';
import { createGame, playerAttack, startGame, type GameState } from './game';
import { gameStats } from './stats';
import { randomBoard } from './placement';
import { seededRng } from './random';

function playingGame(): GameState {
  const rng = seededRng(7);
  const game = createGame('smart');
  return startGame({ ...game, playerBoard: randomBoard(rng) });
}

describe('gameStats', () => {
  it('reports zeroes before any shot', () => {
    const stats = gameStats(playingGame());
    expect(stats.player).toEqual({ shots: 0, hits: 0, destroyed: 0, accuracy: 0 });
    expect(stats.survivors).toHaveLength(5);
  });

  it('counts shots, hits, sinks and accuracy from the real log', () => {
    let game = playingGame();
    const target = game.aiBoard.ships[0];
    // Fire at every cell of one ship, plus a guaranteed-empty-of-that-ship cell.
    for (const cell of target.cells) {
      game = playerAttack(game, cell);
      game = { ...game, turn: 'human' };
    }
    const stats = gameStats(game);
    expect(stats.player.shots).toBe(target.length);
    expect(stats.player.hits).toBe(target.length);
    expect(stats.player.destroyed).toBe(1);
    expect(stats.player.accuracy).toBe(100);
    expect(stats.survivors).not.toContain(target.name);
    expect(stats.survivors).toHaveLength(4);
  });

  it('counts a miss against accuracy', () => {
    let game = playingGame();
    const empty = game.aiBoard.grid
      .flatMap((row, r) => row.map((_, c) => ({ row: r, col: c })))
      .find(
        (coord) =>
          !game.aiBoard.ships.some((ship) =>
            ship.cells.some((c) => c.row === coord.row && c.col === coord.col),
          ),
      );
    const hitCell = game.aiBoard.ships[0].cells[0];
    game = playerAttack(game, empty!);
    game = playerAttack({ ...game, turn: 'human' }, hitCell);
    const stats = gameStats(game);
    expect(stats.player.shots).toBe(2);
    expect(stats.player.hits).toBe(1);
    expect(stats.player.accuracy).toBe(50);
  });
});
