import { isSunk } from './board';
import type { GameState, LogEntry } from './game';
import type { Player, ShipName } from './types';

export interface SideStats {
  shots: number;
  hits: number;
  /** Ships this side destroyed. */
  destroyed: number;
  /** Hits as a percentage of shots, rounded to a whole number. */
  accuracy: number;
}

export interface GameStats {
  player: SideStats;
  ai: SideStats;
  /** Enemy ships the player never found, in fleet order. */
  survivors: ShipName[];
}

function sideStats(log: LogEntry[], player: Player): SideStats {
  const shots = log.filter((e) => e.player === player);
  const hits = shots.filter((e) => e.outcome === 'hit' || e.outcome === 'sunk');
  return {
    shots: shots.length,
    hits: hits.length,
    destroyed: shots.filter((e) => e.outcome === 'sunk').length,
    accuracy: shots.length === 0 ? 0 : Math.round((hits.length / shots.length) * 100),
  };
}

export function gameStats(state: GameState): GameStats {
  return {
    player: sideStats(state.log, 'human'),
    ai: sideStats(state.log, 'ai'),
    survivors: state.aiBoard.ships.filter((s) => !isSunk(s)).map((s) => s.name),
  };
}
