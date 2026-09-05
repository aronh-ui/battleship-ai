import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FleetStatus } from './components/FleetStatus';
import { GameBoard } from './components/GameBoard';
import { GameOverModal } from './components/GameOverModal';
import { shipCells, validatePlacement } from './engine/board';
import { coordLabel } from './engine/coords';
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
} from './engine/game';
import { loadGame, saveGame } from './engine/persistence';
import type { Coord, Difficulty, Orientation } from './engine/types';

const AI_THINKING_MS = 650;

const store = typeof window === 'undefined' ? undefined : window.sessionStorage;

export default function App() {
  const [game, setGame] = useState<GameState>(
    () => loadGame(store) ?? createGame('smart'),
  );
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [hover, setHover] = useState<Coord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);

  const nextShip = nextShipToPlace(game);
  const setupComplete = nextShip === null;

  const flash = useCallback((message: string) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2600);
  }, []);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  // Surviving an accidental refresh matters more than a pristine URL bar.
  useEffect(() => saveGame(store, game), [game]);

  // The AI takes its shot shortly after the player's, so the result is readable.
  useEffect(() => {
    if (game.phase !== 'playing' || game.turn !== 'ai') return;
    const timer = window.setTimeout(() => {
      setGame((current) =>
        current.phase === 'playing' && current.turn === 'ai'
          ? aiAttack(current)
          : current,
      );
    }, AI_THINKING_MS);
    return () => window.clearTimeout(timer);
  }, [game.phase, game.turn, game.log.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r' && game.phase === 'setup') {
        setOrientation((o) => (o === 'horizontal' ? 'vertical' : 'horizontal'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game.phase]);

  const preview = useMemo(() => {
    if (game.phase !== 'setup' || !hover || !nextShip) {
      return { cells: [] as Coord[], valid: true };
    }
    const cells = shipCells(hover, nextShip.length, orientation);
    const error = validatePlacement(
      game.playerBoard,
      hover,
      nextShip.length,
      orientation,
    );
    return { cells, valid: error === null };
  }, [game.phase, game.playerBoard, hover, nextShip, orientation]);

  const handlePlace = (coord: Coord) => {
    if (!nextShip) return;
    const error = validatePlacement(
      game.playerBoard,
      coord,
      nextShip.length,
      orientation,
    );
    if (error) {
      flash(
        error === 'off-board'
          ? `${nextShip.name} (${nextShip.length}) does not fit there — it would run off the board.`
          : `${nextShip.name} (${nextShip.length}) would overlap another ship.`,
      );
      return;
    }
    setGame((g) => placePlayerShip(g, coord, orientation));
  };

  const handleFire = (coord: Coord) => {
    if (game.turn !== 'human' || game.phase !== 'playing') return;
    setGame((g) => playerAttack(g, coord));
  };

  const lastEntry = game.log[game.log.length - 1];
  const lastAiEntry = [...game.log].reverse().find((e) => e.player === 'ai');
  const playerShots = game.log.filter((e) => e.player === 'human').length;

  const changeDifficulty = (difficulty: Difficulty) =>
    setGame((g) => setDifficulty(g, difficulty));

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 p-3 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Battleship<span className="text-cyan-400"> AI</span>
          </h1>
          <p className="text-xs text-slate-400 sm:text-sm">
            Sink the enemy fleet before it sinks yours.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">
            Difficulty
          </span>
          <div className="flex overflow-hidden rounded-lg border border-sea-600">
            {(['easy', 'smart'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => changeDifficulty(level)}
                aria-pressed={game.difficulty === level}
                className={`px-3 py-1.5 text-sm capitalize transition ${
                  game.difficulty === level
                    ? 'bg-cyan-500 font-semibold text-sea-900'
                    : 'bg-sea-800 text-slate-300 hover:bg-sea-700'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </header>

      {game.phase === 'setup' ? (
        <SetupBar
          shipName={nextShip?.name}
          shipLength={nextShip?.length}
          orientation={orientation}
          setupComplete={setupComplete}
          onRotate={() =>
            setOrientation((o) => (o === 'horizontal' ? 'vertical' : 'horizontal'))
          }
          onRandomize={() => setGame((g) => randomizePlayerBoard(g))}
          onAutofill={() => setGame((g) => autofillPlayerBoard(g))}
          onClear={() => setGame((g) => clearPlayerBoard(g))}
          onStart={() => setGame((g) => startGame(g))}
        />
      ) : (
        <TurnBar
          turn={game.turn}
          phase={game.phase}
          lastEvent={
            lastEntry
              ? `${lastEntry.player === 'human' ? 'You' : 'Enemy'} fired at ${coordLabel(
                  lastEntry.coord,
                )} — ${lastEntry.outcome === 'sunk' ? `sunk the ${lastEntry.shipName}!` : lastEntry.outcome}`
              : 'Take the first shot.'
          }
        />
      )}

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-sm text-amber-200"
        >
          {notice}
        </div>
      )}

      <main className="grid gap-5 lg:grid-cols-[1fr_1fr_15rem]">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Your waters
          </h2>
          <GameBoard
            board={game.playerBoard}
            revealShips
            interactive={game.phase === 'setup' && !setupComplete}
            previewCells={preview.cells}
            previewValid={preview.valid}
            lastShot={lastAiEntry?.coord ?? null}
            label="Your board"
            onCellClick={handlePlace}
            onCellEnter={setHover}
            onLeave={() => setHover(null)}
          />
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Enemy waters
          </h2>
          <GameBoard
            board={game.aiBoard}
            revealShips={game.phase === 'gameover'}
            interactive={game.phase === 'playing' && game.turn === 'human'}
            lastShot={
              [...game.log].reverse().find((e) => e.player === 'human')?.coord ?? null
            }
            label="Enemy board"
            onCellClick={handleFire}
          />
          {game.phase === 'setup' && (
            <p className="text-xs text-slate-400">
              Enemy ships are hidden until the battle ends.
            </p>
          )}
        </section>

        <aside className="space-y-3">
          <FleetStatus board={game.playerBoard} title="Your fleet" revealDamage />
          <FleetStatus board={game.aiBoard} title="Enemy fleet" />
          <AiExplainer
            difficulty={game.difficulty}
            reason={lastAiEntry?.reason}
            coord={lastAiEntry ? coordLabel(lastAiEntry.coord) : undefined}
          />
        </aside>
      </main>

      {game.phase === 'gameover' && game.winner && (
        <GameOverModal
          winner={game.winner}
          aiBoard={game.aiBoard}
          shots={playerShots}
          onPlayAgain={() => {
            setGame((g) => resetGame(g));
            setOrientation('horizontal');
            setHover(null);
          }}
        />
      )}
    </div>
  );
}

interface SetupBarProps {
  shipName?: string;
  shipLength?: number;
  orientation: Orientation;
  setupComplete: boolean;
  onRotate: () => void;
  onRandomize: () => void;
  onAutofill: () => void;
  onClear: () => void;
  onStart: () => void;
}

function SetupBar({
  shipName,
  shipLength,
  orientation,
  setupComplete,
  onRotate,
  onRandomize,
  onAutofill,
  onClear,
  onStart,
}: SetupBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sea-600 bg-sea-800/60 p-3">
      <p className="mr-auto text-sm text-slate-200">
        {setupComplete ? (
          <>Fleet ready. Start the battle when you are.</>
        ) : (
          <>
            Place your <strong className="text-white">{shipName}</strong> ({shipLength}{' '}
            cells) — click a cell on your board.
          </>
        )}
      </p>
      <button
        type="button"
        onClick={onRotate}
        disabled={setupComplete}
        className="rounded-lg border border-sea-500 bg-sea-700 px-3 py-1.5 text-sm text-slate-100 transition hover:bg-sea-600 disabled:opacity-40"
      >
        Rotate: {orientation === 'horizontal' ? 'Horizontal' : 'Vertical'} (R)
      </button>
      <button
        type="button"
        onClick={setupComplete ? onRandomize : onAutofill}
        className="rounded-lg border border-sea-500 bg-sea-700 px-3 py-1.5 text-sm text-slate-100 transition hover:bg-sea-600"
      >
        {setupComplete ? 'Randomize again' : 'Randomize placement'}
      </button>
      <button
        type="button"
        onClick={onClear}
        className="rounded-lg border border-sea-500 bg-sea-700 px-3 py-1.5 text-sm text-slate-100 transition hover:bg-sea-600"
      >
        Clear
      </button>
      <button
        type="button"
        onClick={onStart}
        disabled={!setupComplete}
        className="rounded-lg bg-cyan-500 px-4 py-1.5 text-sm font-semibold text-sea-900 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-sea-600 disabled:text-slate-400"
      >
        Start battle
      </button>
    </div>
  );
}

function TurnBar({
  turn,
  phase,
  lastEvent,
}: {
  turn: 'human' | 'ai';
  phase: GameState['phase'];
  lastEvent: string;
}) {
  const playing = phase === 'playing';
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-sea-600 bg-sea-800/60 p-3">
      <span
        data-testid="turn-indicator"
        className={`rounded-full px-3 py-1 text-sm font-semibold ${
          !playing
            ? 'bg-slate-600 text-slate-100'
            : turn === 'human'
              ? 'bg-emerald-400 text-sea-900'
              : 'bg-amber-400 text-sea-900'
        }`}
      >
        {!playing ? 'Game over' : turn === 'human' ? 'Your turn' : 'Enemy turn…'}
      </span>
      <span className="text-sm text-slate-300">{lastEvent}</span>
    </div>
  );
}

function AiExplainer({
  difficulty,
  reason,
  coord,
}: {
  difficulty: Difficulty;
  reason?: string;
  coord?: string;
}) {
  return (
    <div className="rounded-lg border border-sea-600 bg-sea-800/60 p-3">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
        How the enemy thinks
      </h3>
      <p className="text-xs text-slate-300">
        {reason
          ? `${coord}: ${reason}`
          : difficulty === 'smart'
            ? 'Smart mode: hunts on a checkerboard pattern, then locks onto a ship once it lands a hit.'
            : 'Easy mode: fires at random untried cells.'}
      </p>
    </div>
  );
}
