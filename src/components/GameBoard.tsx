import { useMemo } from 'react';
import { isSunk, key } from '../engine/board';
import { COLUMN_LABELS, coordLabel } from '../engine/coords';
import { ShipSprite, type ShipTone } from './ShipSprite';
import {
  BOARD_SIZE,
  type Board,
  type Coord,
  type Orientation,
  type ShipName,
} from '../engine/types';

interface ShipOverlay {
  id: string;
  name: ShipName;
  length: number;
  orientation: Orientation;
  origin: Coord;
  damage: number[];
  tone: ShipTone;
}

export interface GameBoardProps {
  board: Board;
  /** Show ship hulls that have not been hit (own board, or the AI board after the game). */
  revealShips: boolean;
  interactive?: boolean;
  disabled?: boolean;
  previewCells?: Coord[];
  previewValid?: boolean;
  previewShip?: { name: ShipName; orientation: Orientation } | null;
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
  previewShip = null,
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

  const overlays = useMemo<ShipOverlay[]>(() => {
    if (!revealShips) return [];
    return board.ships.map((ship) => {
      const cells = ship.cells;
      const orientation: Orientation =
        cells.length > 1 && cells[0].row === cells[1].row ? 'horizontal' : 'vertical';
      const damage = cells
        .map((cell, index) => (board.grid[cell.row][cell.col] === 'hit' ? index : -1))
        .filter((index) => index >= 0);
      return {
        id: ship.id,
        name: ship.name,
        length: ship.length,
        orientation,
        origin: cells[0],
        damage,
        tone: isSunk(ship) ? 'sunk' : 'afloat',
      };
    });
  }, [board.ships, board.grid, revealShips]);

  const previewOverlay = useMemo<ShipOverlay | null>(() => {
    if (!previewShip || previewCells.length === 0) return null;
    return {
      id: 'preview',
      name: previewShip.name,
      length: previewCells.length,
      orientation: previewShip.orientation,
      origin: previewCells[0],
      damage: [],
      tone: previewValid ? 'preview' : 'invalid',
    };
  }, [previewShip, previewCells, previewValid]);

  return (
    <div
      className="select-none"
      onMouseLeave={onLeave}
      aria-label={label}
      role="grid"
    >
      <div className="relative grid grid-cols-[1.25rem_repeat(10,minmax(0,1fr))] gap-[2px] sm:gap-[3px]">
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

        {/* Hulls live in their own layer so a ship is one continuous silhouette
            across its cells instead of an icon repeated in every cell. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid grid-cols-[1.25rem_repeat(10,minmax(0,1fr))] grid-rows-[auto_repeat(10,minmax(0,1fr))] gap-[2px] sm:gap-[3px]"
        >
          {[...overlays, ...(previewOverlay ? [previewOverlay] : [])].map((ship) => (
            <div
              key={ship.id}
              className="self-stretch justify-self-stretch p-[1px]"
              style={{
                gridColumn:
                  ship.orientation === 'horizontal'
                    ? `${ship.origin.col + 2} / span ${ship.length}`
                    : `${ship.origin.col + 2}`,
                gridRow:
                  ship.orientation === 'vertical'
                    ? `${ship.origin.row + 2} / span ${ship.length}`
                    : `${ship.origin.row + 2}`,
              }}
            >
              <ShipSprite
                name={ship.name}
                length={ship.length}
                orientation={ship.orientation}
                damage={ship.damage}
                tone={ship.tone}
                className={`h-full w-full ${
                  ship.tone === 'preview' || ship.tone === 'invalid'
                    ? 'opacity-80'
                    : 'drop-shadow-[0_1px_2px_rgba(2,8,23,0.65)]'
                }`}
              />
            </div>
          ))}
        </div>
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
  // Revealed hulls are drawn as one sprite across the whole ship, so those cells
  // stay water-coloured and only tint to show damage underneath the sprite.
  const underShip = revealShips && !!ship;
  const classes = ['aspect-square rounded-[3px] border transition-colors duration-150'];

  if (isPreview) {
    classes.push(
      previewValid
        ? 'border-emerald-300/70 bg-emerald-500/25'
        : 'border-rose-300/70 bg-rose-500/30',
    );
  } else if (underShip) {
    classes.push(
      sunk
        ? 'border-rose-500/60 bg-rose-900/50'
        : state === 'hit'
          ? 'border-amber-400/60 bg-amber-500/20'
          : 'border-sea-600 bg-sea-800',
    );
  } else if (sunk) {
    classes.push('border-rose-900 bg-rose-800');
  } else if (state === 'hit') {
    classes.push('border-rose-400 bg-rose-500');
  } else if (state === 'miss') {
    classes.push('border-sea-600 bg-sea-700');
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
      {state === 'hit' && !underShip && (
        <span
          className={`mx-auto block h-1/2 w-1/2 rounded-full ${
            isLastShot ? 'animate-blast' : ''
          } ${sunk ? 'bg-rose-300/70' : 'bg-amber-200'}`}
        />
      )}
    </button>
  );
}
