import { isSunk } from '../engine/board';
import type { Board } from '../engine/types';

interface FleetStatusProps {
  board: Board;
  title: string;
}

export function FleetStatus({ board, title }: FleetStatusProps) {
  const afloat = board.ships.filter((s) => !isSunk(s)).length;

  return (
    <div className="rounded-lg border border-sea-600 bg-sea-800/60 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          {title}
        </h3>
        <span className="text-xs text-slate-400">{afloat} afloat</span>
      </div>
      <ul className="space-y-1">
        {board.ships.map((ship) => {
          const sunk = isSunk(ship);
          return (
            <li
              key={ship.id}
              className={`flex items-center justify-between gap-2 text-xs ${
                sunk ? 'text-rose-300 line-through' : 'text-slate-200'
              }`}
            >
              <span>{ship.name}</span>
              <span className="flex gap-[2px]" aria-hidden>
                {Array.from({ length: ship.length }, (_, i) => (
                  <span
                    key={i}
                    className={`h-2 w-2 rounded-[2px] ${
                      i < ship.hits.length
                        ? sunk
                          ? 'bg-rose-500'
                          : 'bg-amber-400'
                        : 'bg-slate-400/60'
                    }`}
                  />
                ))}
              </span>
            </li>
          );
        })}
        {board.ships.length === 0 && (
          <li className="text-xs text-slate-400">No ships placed yet.</li>
        )}
      </ul>
    </div>
  );
}
