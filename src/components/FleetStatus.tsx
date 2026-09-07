import { isSunk, key } from '../engine/board';
import { ShipSprite } from './ShipSprite';
import type { Board } from '../engine/types';

/** Height in pixels of one cell of the fleet-panel ship icons. */
const PIP = 12;

interface FleetStatusProps {
  board: Board;
  title: string;
  /** Per-cell damage is only public knowledge for your own fleet. */
  revealDamage?: boolean;
}

export function FleetStatus({ board, title, revealDamage = false }: FleetStatusProps) {
  const afloat = board.ships.filter((s) => !isSunk(s)).length;
  const hitIds = new Set(board.ships.flatMap((s) => s.hits.map(key)));

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
              <ShipSprite
                name={ship.name}
                length={ship.length}
                orientation="horizontal"
                tone={sunk ? 'sunk' : 'afloat'}
                damage={
                  revealDamage
                    ? ship.cells
                        .map((cell, i) => (hitIds.has(key(cell)) ? i : -1))
                        .filter((i) => i >= 0)
                    : []
                }
                className="shrink-0"
                style={{ width: ship.length * PIP, height: PIP }}
              />
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
