import type { ShipName } from '../engine/types';

/**
 * Display naming for the "AI Arms Race" theme. The engine keeps the classic ship
 * names; everything the player reads is mapped here so the theme stays presentation
 * only and never touches game rules.
 */

const PLAYER_NAMES: Record<ShipName, string> = {
  Carrier: 'Cognition Carrier',
  Battleship: 'Devin Defender',
  Cruiser: 'Code Cruiser',
  Submarine: 'Autonomous Submarine',
  Destroyer: 'Bug Destroyer',
};

/** The enemy fleet is what an engineering team actually fights. */
const ENEMY_NAMES: Record<ShipName, string> = {
  Carrier: 'Legacy Code',
  Battleship: 'Technical Debt',
  Cruiser: 'Bugs',
  Submarine: 'Claude Carrier',
  Destroyer: 'Cursor Cruiser',
};

/** Enemy ships whose hits and sinks get a full-screen banner. */
export const ARMS_RACE_SHIPS: readonly ShipName[] = ['Submarine', 'Destroyer'];

export function playerShipName(name: ShipName): string {
  return PLAYER_NAMES[name];
}

export function enemyShipName(name: ShipName): string {
  return ENEMY_NAMES[name];
}

export function shipDisplayName(name: ShipName, side: 'player' | 'enemy'): string {
  return side === 'player' ? playerShipName(name) : enemyShipName(name);
}

/** Competitor targets say "ELIMINATED"/"SUNK"; the rest are "DESTROYED". */
export function sunkVerb(name: ShipName, side: 'player' | 'enemy') {
  if (side === 'player') return 'DESTROYED';
  if (name === 'Submarine') return 'ELIMINATED';
  if (name === 'Destroyer') return 'SUNK';
  return 'DESTROYED';
}
