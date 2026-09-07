import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AiCommandCenter, type CommandVerdict } from './components/AiCommandCenter';
import { AudioControls } from './components/AudioControls';
import { FleetStatus } from './components/FleetStatus';
import { GameBoard, type BoardImpact } from './components/GameBoard';
import { MissionReport } from './components/MissionReport';
import { useAudio } from './audio/context';
import { isSunk, shipCells, validatePlacement } from './engine/board';
import { coordLabel } from './engine/coords';
import { aiPlan, type AiThought } from './engine/ai';
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
  type LogEntry,
} from './engine/game';
import { loadGame, saveGame } from './engine/persistence';
import { gameStats } from './engine/stats';
import { enemyShipName, playerShipName, sunkVerb } from './theme/fleet';
import type { Coord, Difficulty, Orientation, Player } from './engine/types';

/** Minimum pause before the AI fires, even for a very short reasoning chain. */
const AI_MIN_THINKING_MS = 700;
/** Time each reasoning step stays on screen in the command centre. */
const COMMAND_STEP_MS = 260;
const ARMS_RACE_KEY = 'battleship-ai:armsrace';
const ARMS_RACE_CODE = 'devin';

const store = typeof window === 'undefined' ? undefined : window.sessionStorage;

function readArmsRace(): boolean {
  try {
    return window.localStorage.getItem(ARMS_RACE_KEY) === 'on';
  } catch {
    return false;
  }
}

export default function App() {
  const audio = useAudio();
  const [game, setGame] = useState<GameState>(
    () => loadGame(store) ?? createGame('smart'),
  );
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [hover, setHover] = useState<Coord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [armsRace, setArmsRace] = useState<boolean>(readArmsRace);
  const [plan, setPlan] = useState<PlanSnapshot>({ turn: -1, steps: [] });
  const noticeTimer = useRef<number | undefined>(undefined);
  const soundedLog = useRef<number>(game.log.length);

  const nextShip = nextShipToPlace(game);
  const setupComplete = nextShip === null;
  const aiTurnActive = game.phase === 'playing' && game.turn === 'ai';

  const flash = useCallback((message: string) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2600);
  }, []);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  // Surviving an accidental refresh matters more than a pristine URL bar.
  useEffect(() => saveGame(store, game), [game]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ARMS_RACE_KEY, armsRace ? 'on' : 'off');
    } catch {
      // Storage is a convenience here, never a requirement.
    }
  }, [armsRace]);

  // The command centre shows the reasoning the AI is about to apply, so the plan
  // is captured from the board *before* the shot lands, then frozen for the rest
  // of the round so the verdict stays attached to the reasoning that produced it.
  if (aiTurnActive && plan.turn !== game.log.length) {
    setPlan({ turn: game.log.length, steps: aiPlan(game.playerBoard, game.aiState) });
  }

  const thinkingMs = Math.max(
    AI_MIN_THINKING_MS,
    plan.steps.length * COMMAND_STEP_MS + 250,
  );

  useEffect(() => {
    if (!aiTurnActive) return;
    const timer = window.setTimeout(() => {
      setGame((current) =>
        current.phase === 'playing' && current.turn === 'ai'
          ? aiAttack(current)
          : current,
      );
    }, thinkingMs);
    return () => window.clearTimeout(timer);
  }, [aiTurnActive, game.log.length, thinkingMs]);

  // Music follows the phase of the match; the last ships afloat raise the tension.
  useEffect(() => {
    if (game.phase === 'setup') {
      audio.setScene(game.playerBoard.ships.length === 0 ? 'menu' : 'setup');
      return;
    }
    if (game.phase === 'gameover') {
      audio.setScene(game.winner === 'human' ? 'victory' : 'defeat');
      return;
    }
    const afloat = Math.min(
      game.playerBoard.ships.filter((s) => !isSunk(s)).length,
      game.aiBoard.ships.filter((s) => !isSunk(s)).length,
    );
    audio.setScene(afloat <= 2 ? 'lastStand' : 'battle');
  }, [game.phase, game.winner, game.playerBoard, game.aiBoard, audio]);

  // One shot, one sound: fire, then the result a beat later.
  useEffect(() => {
    if (game.log.length === soundedLog.current) return;
    soundedLog.current = game.log.length;
    const entry = game.log[game.log.length - 1];
    if (!entry) return;
    audio.play(entry.player === 'human' ? 'fire' : 'aiFire');
    const timer = window.setTimeout(() => {
      audio.play(
        entry.outcome === 'sunk' ? 'sink' : entry.outcome === 'hit' ? 'hit' : 'miss',
      );
    }, 240);
    return () => window.clearTimeout(timer);
  }, [game.log, audio]);

  useEffect(() => {
    if (game.phase !== 'gameover' || !game.winner) return;
    const timer = window.setTimeout(
      () => audio.play(game.winner === 'human' ? 'victory' : 'defeat'),
      500,
    );
    return () => window.clearTimeout(timer);
  }, [game.phase, game.winner, audio]);

  // Rotate with R; typing the hidden code unlocks the AI Arms Race targets.
  useEffect(() => {
    let typed = '';
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r' && game.phase === 'setup') {
        setOrientation((o) => (o === 'horizontal' ? 'vertical' : 'horizontal'));
      }
      typed = (typed + event.key.toLowerCase()).slice(-ARMS_RACE_CODE.length);
      if (typed === ARMS_RACE_CODE) {
        typed = '';
        setArmsRace((on) => !on);
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
    const label = playerShipName(nextShip.name);
    if (error) {
      audio.play('invalid');
      flash(
        error === 'off-board'
          ? `${label} (${nextShip.length}) does not fit there — it would run off the board.`
          : `${label} (${nextShip.length}) would overlap another ship.`,
      );
      return;
    }
    audio.play('place');
    setGame((g) => placePlayerShip(g, coord, orientation));
  };

  const handleFire = (coord: Coord) => {
    if (game.turn !== 'human' || game.phase !== 'playing') return;
    setGame((g) => playerAttack(g, coord));
  };

  const lastHuman = lastShotBy(game.log, 'human');
  const lastAi = lastShotBy(game.log, 'ai');
  const lastAiEntry = lastAi?.entry;

  /** Name of the player ship occupying a cell — always visible to the player. */
  const playerShipAt = useCallback(
    (coord: Coord) =>
      game.playerBoard.ships.find((ship) =>
        ship.cells.some((c) => c.row === coord.row && c.col === coord.col),
      ),
    [game.playerBoard.ships],
  );

  // Each side keeps its own line: the AI answers within a second, and a sink
  // message the player never got to read may as well not have been shown.
  const yourShotLine = useMemo(() => {
    const entry = lastHuman?.entry;
    if (!entry) return 'Take the first shot.';
    const at = coordLabel(entry.coord);
    if (entry.outcome === 'sunk' && entry.shipName) {
      const name = enemyShipName(entry.shipName, armsRace).toUpperCase();
      return `${name} — ${sunkVerb(entry.shipName, 'enemy', armsRace)}`;
    }
    // Naming a merely damaged enemy target would leak its length, so hits stay generic.
    return entry.outcome === 'hit'
      ? `DIRECT HIT AT ${at} — TARGET DAMAGED`
      : `${at} — NO CONTACT`;
  }, [lastHuman, armsRace]);

  const enemyShotLine = ((): string | null => {
    if (!lastAiEntry) return null;
    const at = coordLabel(lastAiEntry.coord);
    const ship = playerShipAt(lastAiEntry.coord);
    if (lastAiEntry.outcome === 'sunk' && ship) {
      return `${playerShipName(ship.name).toUpperCase()} — DESTROYED`;
    }
    if (lastAiEntry.outcome === 'hit' && ship) {
      return `${playerShipName(ship.name).toUpperCase()} — HIT AT ${at}`;
    }
    return `ENEMY FIRED AT ${at} — MISS`;
  })();

  const verdict = ((): CommandVerdict | null => {
    if (!lastAiEntry) return null;
    const ship = playerShipAt(lastAiEntry.coord);
    return {
      coord: coordLabel(lastAiEntry.coord),
      outcome: lastAiEntry.outcome === 'invalid' ? 'miss' : lastAiEntry.outcome,
      target: ship ? playerShipName(ship.name) : undefined,
      reason: lastAiEntry.reason,
    };
  })();


  const changeDifficulty = (difficulty: Difficulty) => {
    audio.play('click');
    setGame((g) => setDifficulty(g, difficulty));
  };

  const stats = useMemo(() => gameStats(game), [game]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 p-3 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Battleship<span className="text-cyan-400"> AI</span>
          </h1>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400 sm:text-sm">
            Observe · Reason · Act · Verify
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AudioControls />
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
          shipName={nextShip ? playerShipName(nextShip.name) : undefined}
          shipLength={nextShip?.length}
          orientation={orientation}
          setupComplete={setupComplete}
          onRotate={() => {
            audio.play('rotate');
            setOrientation((o) => (o === 'horizontal' ? 'vertical' : 'horizontal'));
          }}
          onRandomize={() => {
            audio.play('place');
            setGame((g) => randomizePlayerBoard(g));
          }}
          onAutofill={() => {
            audio.play('place');
            setGame((g) => autofillPlayerBoard(g));
          }}
          onClear={() => {
            audio.play('click');
            setGame((g) => clearPlayerBoard(g));
          }}
          onStart={() => {
            audio.play('sonar');
            setGame((g) => startGame(g));
          }}
        />
      ) : (
        <TurnBar
          turn={game.turn}
          phase={game.phase}
          yourShot={yourShotLine}
          enemyShot={enemyShotLine}
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

      <main className="grid gap-5 lg:grid-cols-[1fr_1fr_16rem]">
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
            previewShip={nextShip ? { name: nextShip.name, orientation } : null}
            lastShot={lastAiEntry?.coord ?? null}
            sonar={aiTurnActive}
            impact={impactOf(lastAi)}
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
            lastShot={lastHuman?.entry.coord ?? null}
            sonar={game.phase === 'playing' && game.turn === 'human'}
            impact={impactOf(lastHuman)}
            label="Enemy board"
            onCellClick={handleFire}
          />
          {game.phase === 'setup' && (
            <p className="text-xs text-slate-400">
              Enemy positions stay hidden until the battle ends.
            </p>
          )}
        </section>

        <aside className="contents lg:block lg:space-y-3">
          <div className="-order-1 lg:order-none">
            <AiCommandCenter
              key={`${plan.turn}-${aiTurnActive}`}
              active={aiTurnActive}
              difficulty={game.difficulty}
              plan={plan.steps}
              verdict={verdict}
              stepMs={COMMAND_STEP_MS}
            />
          </div>
          <FleetStatus
            board={game.playerBoard}
            title="Your fleet"
            side="player"
            revealDamage
          />
          <FleetStatus
            board={game.aiBoard}
            title="Enemy targets"
            side="enemy"
            armsRace={armsRace}
          />
          <ArmsRaceToggle
            on={armsRace}
            onToggle={() => {
              audio.play('click');
              setArmsRace((v) => !v);
            }}
          />
        </aside>
      </main>

      {game.phase === 'gameover' && game.winner && (
        <MissionReport
          winner={game.winner}
          aiBoard={game.aiBoard}
          stats={stats}
          armsRace={armsRace}
          onPlayAgain={() => {
            audio.play('click');
            setGame((g) => resetGame(g));
            setOrientation('horizontal');
            setHover(null);
            setPlan({ turn: -1, steps: [] });
          }}
        />
      )}
    </div>
  );
}

/** The AI's reasoning for one turn, tagged with the log length it was taken at. */
interface PlanSnapshot {
  turn: number;
  steps: AiThought[];
}

interface Shot {
  entry: LogEntry;
  index: number;
}

function lastShotBy(log: LogEntry[], player: Player): Shot | null {
  for (let index = log.length - 1; index >= 0; index--) {
    if (log[index].player === player) return { entry: log[index], index };
  }
  return null;
}

/** The log index doubles as an id so each new shot replays its impact animation. */
function impactOf(shot: Shot | null): BoardImpact | null {
  if (!shot) return null;
  const { entry, index } = shot;
  return {
    coord: entry.coord,
    outcome: entry.outcome === 'invalid' ? 'miss' : entry.outcome,
    id: index,
  };
}

function ArmsRaceToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      data-testid="arms-race-toggle"
      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-[0.65rem] uppercase tracking-[0.2em] transition ${
        on
          ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-200'
          : 'border-sea-700 bg-transparent text-slate-500 hover:text-slate-300'
      }`}
      title="Rename two enemy targets"
    >
      <span>AI arms race</span>
      <span aria-hidden>{on ? '◈' : '◇'}</span>
    </button>
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
  yourShot,
  enemyShot,
}: {
  turn: 'human' | 'ai';
  phase: GameState['phase'];
  yourShot: string;
  enemyShot: string | null;
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
      <div className="min-w-0">
        <p
          data-testid="event-line"
          className="text-sm tracking-wide text-slate-100"
        >
          <span className="text-slate-500">You: </span>
          {yourShot}
        </p>
        {enemyShot && (
          <p
            data-testid="enemy-event-line"
            className="text-xs tracking-wide text-slate-400"
          >
            <span className="text-slate-500">Enemy: </span>
            {enemyShot}
          </p>
        )}
      </div>
    </div>
  );
}
