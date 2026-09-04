import { GameBoard } from './GameBoard';
import type { Board, Player } from '../engine/types';

interface GameOverModalProps {
  winner: Player;
  aiBoard: Board;
  shots: number;
  onPlayAgain: () => void;
}

export function GameOverModal({
  winner,
  aiBoard,
  shots,
  onPlayAgain,
}: GameOverModalProps) {
  const won = winner === 'human';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-over-title"
    >
      <div className="max-h-full w-full max-w-md overflow-y-auto rounded-xl border border-sea-600 bg-sea-800 p-5 shadow-2xl">
        <h2
          id="game-over-title"
          className={`text-2xl font-bold ${won ? 'text-emerald-300' : 'text-rose-300'}`}
        >
          {won ? 'Victory!' : 'Defeat'}
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          {won
            ? `You sank the enemy fleet in ${shots} shots.`
            : 'The enemy sank your entire fleet. Better luck next time.'}
        </p>

        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
            Enemy fleet positions
          </h3>
          <GameBoard board={aiBoard} revealShips label="Enemy fleet revealed" />
        </div>

        <button
          type="button"
          onClick={onPlayAgain}
          className="mt-5 w-full rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-sea-900 transition hover:bg-cyan-400"
        >
          Play again
        </button>
      </div>
    </div>
  );
}
