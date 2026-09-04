import { useMemo } from 'react';
import { isSunk, key } from '../engine/board';
import { COLUMN_LABELS, coordLabel } from '../engine/coords';
import { BOARD_SIZE, type Board, type Coord } from '../engine/types';

export interface GameBoardProps {
  board: Board;
  /** Show ship hulls that have not been hit (own board, or the AI board after the game). */
  revealShips: boolean;
  interactive?: boolean;
  disabled?: boolean;
  previewCells?: Coord[];
  previewValid?: boolean;
  lastShot?: Coord | null;
  label: string;
  onCellClick?: (coord: Coord) => void;
  onCellEnter?: (coord: Coord) => void;
  onLeave?: () => void;
}

export function GameBoard({
  board,
  revealShips,
  interactive = false,
  disabled = false,
  previewCells = [],
  previewValid = true,
  lastShot = null,
  label,
  onCellClick,
  onCellEnter,
  onLeave,
}: GameBoardProps) {
  const shipCellIds = useMemo(() => {
    const map = new Map<string, { sunk: boolean; name: string }>();
    for (const ship of board.ships) {
      for (const cell of ship.cells) {
        map.set(key(cell), { sunk: isSunk(ship), name: ship.name });
      }
    }
    return map;
  }, [board.ships]);

  const previewIds = useMemo(
    () => new Set(previewCells.map(key)),
    [previewCells],
  );

  return (
    <div
      className="select-none"
      onMouseLeave={onLeave}
      aria-label={label}
      role="grid"
    >
      <div className="grid grid-cols-[1.25rem_repeat(10,minmax(0,1fr))] gap-[2px] sm:gap-[3px]">
        <div />
        {COLUMN_LABELS.map((c) => (
          <div
            key={c}
            className="text-center text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs"
          >
            {c}
          </div>
        ))}

        {Array.from({ length: BOARD_SIZE }, (_, row) => (
          <Row
            key={row}
            row={row}
            board={board}
            revealShips={revealShips}
            interactive={interactive}
            disabled={disabled}
            previewIds={previewIds}
            previewValid={previewValid}
            lastShot={lastShot}
            shipCellIds={shipCellIds}
            onCellClick={onCellClick}
            onCellEnter={onCellEnter}
          />
        ))}
      </div>
    </div>
  );
}

interface RowProps extends Omit<GameBoardProps, 'previewCells' | 'label' | 'onLeave'> {
  row: number;
  previewIds: Set<string>;
  shipCellIds: Map<string, { sunk: boolean; name: string }>;
}

function Row({
  row,
  board,
  revealShips,
  interactive,
  disabled,
  previewIds,
  previewValid,
  lastShot,
  shipCellIds,
  onCellClick,
  onCellEnter,
}: RowProps) {
  return (
    <>
      <div className="flex items-center justify-center text-[0.6rem] font-semibold text-slate-400 sm:text-xs">
        {row + 1}
      </div>
      {Array.from({ length: BOARD_SIZE }, (_, col) => {
        const coord = { row, col };
        const id = key(coord);
        const state = board.grid[row][col];
        const ship = shipCellIds.get(id);
        const isPreview = previewIds.has(id);
        const isLastShot =
          lastShot?.row === row && lastShot?.col === col && state !== 'unknown';

        return (
          <Cell
            key={col}
            coord={coord}
            state={state}
            ship={ship}
            revealShips={!!revealShips}
            interactive={!!interactive && !disabled && state === 'unknown'}
            isPreview={isPreview}
            previewValid={previewValid !== false}
            isLastShot={isLastShot}
            onCellClick={onCellClick}
            onCellEnter={onCellEnter}
          />
        );
      })}
    </>
  );
}

interface CellProps {
  coord: Coord;
  state: 'unknown' | 'hit' | 'miss';
  ship?: { sunk: boolean; name: string };
  revealShips: boolean;
  interactive: boolean;
  isPreview: boolean;
  previewValid: boolean;
  isLastShot: boolean;
  onCellClick?: (coord: Coord) => void;
  onCellEnter?: (coord: Coord) => void;
}

function Cell({
  coord,
  state,
  ship,
  revealShips,
  interactive,
  isPreview,
  previewValid,
  isLastShot,
  onCellClick,
  onCellEnter,
}: CellProps) {
  const sunk = state === 'hit' && ship?.sunk;
  const classes = ['aspect-square rounded-[3px] border transition-colors duration-150'];

  if (isPreview) {
    classes.push(
      previewValid
        ? 'border-emerald-200 bg-emerald-400'
        : 'border-rose-200 bg-rose-500',
    );
  } else if (sunk) {
    classes.push('border-rose-900 bg-rose-800');
  } else if (state === 'hit') {
    classes.push('border-rose-400 bg-rose-500');
  } else if (state === 'miss') {
    classes.push('border-sea-600 bg-sea-700');
  } else if (revealShips && ship) {
    classes.push('border-slate-400 bg-slate-300');
  } else {
    classes.push('border-sea-600 bg-sea-800');
  }

  if (interactive && !isPreview) {
    classes.push('cursor-pointer hover:border-cyan-300 hover:bg-sea-600');
  } else if (interactive) {
    classes.push('cursor-pointer');
  }

  const outcome = sunk ? 'sunk' : state === 'unknown' ? 'unknown' : state;
  const status = revealShips && ship ? `${ship.name} ${outcome}` : outcome;

  return (
    <button
      type="button"
      role="gridcell"
      data-cell={coordLabel(coord)}
      data-state={sunk ? 'sunk' : state}
      aria-label={`${coordLabel(coord)} ${status}`}
      disabled={!interactive}
      onClick={() => onCellClick?.(coord)}
      onMouseEnter={() => onCellEnter?.(coord)}
      className={classes.join(' ')}
    >
      {state === 'miss' && (
        <span className="mx-auto block h-1/3 w-1/3 animate-splash rounded-full bg-slate-300/80" />
      )}
      {state === 'hit' && (
        <span
          className={`mx-auto block h-1/2 w-1/2 rounded-full ${
            isLastShot ? 'animate-blast' : ''
          } ${sunk ? 'bg-rose-300/70' : 'bg-amber-200'}`}
        />
      )}
    </button>
  );
}
