import { isSunk } from '../engine/board';
import type { GameStats } from '../engine/stats';
import { ARMS_RACE_CLEARED, ARMS_RACE_SHIPS, enemyShipName } from '../theme/fleet';
import { GameBoard } from './GameBoard';
import type { Board, Player } from '../engine/types';

interface MissionReportProps {
  winner: Player;
  aiBoard: Board;
  stats: GameStats;
  armsRace: boolean;
  onPlayAgain: () => void;
}

export function MissionReport({
  winner,
  aiBoard,
  stats,
  armsRace,
  onPlayAgain,
}: MissionReportProps) {
  const won = winner === 'human';
  const competitorsCleared =
    armsRace &&
    ARMS_RACE_SHIPS.every((name) =>
      aiBoard.ships.some((ship) => ship.name === name && isSunk(ship)),
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-sea-900/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-title"
    >
      <div className="max-h-full w-full max-w-md overflow-y-auto rounded-xl border border-sea-600 bg-sea-800/95 p-5 shadow-2xl">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-cyan-300/80">
          {won ? 'Mission complete' : 'Mission failed'}
        </p>
        <h2
          id="mission-title"
          className={`animate-slide-in text-3xl font-bold tracking-tight ${
            won ? 'text-emerald-300' : 'text-rose-300'
          }`}
        >
          {won ? 'Fleet eliminated' : 'Fleet lost'}
        </h2>

        <h3 className="mt-4 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Your performance
        </h3>
        <dl
          data-testid="mission-stats"
          className="mt-1 grid grid-cols-3 gap-2 text-center"
        >
          {[
            { label: 'Shots', value: stats.player.shots },
            { label: 'Hits', value: stats.player.hits },
            { label: 'Accuracy', value: `${stats.player.accuracy}%` },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-sea-600 bg-sea-900/60 p-2"
            >
              <dt className="text-[0.6rem] uppercase tracking-widest text-slate-400">
                {item.label}
              </dt>
              <dd className="text-lg font-semibold tabular-nums text-white">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-2 text-[0.65rem] uppercase tracking-[0.15em] text-slate-400">
          Opponent: {stats.ai.shots} shots · {stats.ai.hits} hits ·{' '}
          {stats.ai.accuracy}% accuracy
        </p>

        <p className="mt-3 text-sm uppercase tracking-[0.2em] text-slate-300">
          {won
            ? `${stats.player.destroyed} targets destroyed · the ocean is clear.`
            : `${stats.player.destroyed} of 5 targets destroyed · ${stats.survivors.length} still afloat.`}
        </p>

        {competitorsCleared && (
          <div className="mt-3 rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-3">
            {ARMS_RACE_CLEARED.map((line) => (
              <p
                key={line}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200"
              >
                {line}
              </p>
            ))}
          </div>
        )}

        {!won && stats.survivors.length > 0 && (
          <p className="mt-3 text-xs text-slate-400">
            Still afloat:{' '}
            {stats.survivors.map((name) => enemyShipName(name, armsRace)).join(', ')}.
          </p>
        )}

        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
            Enemy positions revealed
          </h3>
          <GameBoard board={aiBoard} revealShips label="Enemy fleet revealed" />
        </div>

        <p className="mt-4 text-center text-xs uppercase tracking-[0.25em] text-slate-400">
          {won ? 'Ready to build something else?' : 'Ready for another run?'}
        </p>
        <button
          type="button"
          onClick={onPlayAgain}
          className="mt-2 w-full rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-sea-900 transition hover:bg-cyan-400"
        >
          Play again
        </button>
      </div>
    </div>
  );
}
