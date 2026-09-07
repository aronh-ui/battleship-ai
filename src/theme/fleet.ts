import type { ShipName } from '../engine/types';

/**
 * Display naming for the "AI Arms Race" theme. The engine keeps the classic ship
 * names; everything the player reads is mapped here so the theme stays presentation
 * only and never touches game rules.
 */

const PLAYER_NAMES: Record<ShipName, string> = {
  Carrier: 'Cognition Carrier',
  Battleship: 'Agent Battleship',
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

/** Hidden mode: the enemy flagship is renamed after another AI coding tool. */
const ARMS_RACE_NAMES: Partial<Record<ShipName, string>> = {
  Carrier: 'Copilot Carrier',
};

/** Sinking all of these in hidden mode triggers the arms-race completion copy. */
export const ARMS_RACE_SHIPS: readonly ShipName[] = ['Carrier', 'Destroyer'];

export function playerShipName(name: ShipName): string {
  return PLAYER_NAMES[name];
}

export function enemyShipName(name: ShipName, armsRace = false): string {
  return (armsRace ? ARMS_RACE_NAMES[name] : undefined) ?? ENEMY_NAMES[name];
}

export function shipDisplayName(
  name: ShipName,
  side: 'player' | 'enemy',
  armsRace = false,
): string {
  return side === 'player' ? playerShipName(name) : enemyShipName(name, armsRace);
}

/** Competitor targets say "ELIMINATED"/"SUNK"; the rest are "DESTROYED". */
export function sunkVerb(name: ShipName, side: 'player' | 'enemy', armsRace: boolean) {
  if (side === 'player') return 'DESTROYED';
  if (armsRace && name === 'Carrier') return 'ELIMINATED';
  if (name === 'Destroyer') return 'SUNK';
  return 'DESTROYED';
}

export const ARMS_RACE_CLEARED = [
  'THE AI ARMS RACE CONTINUES.',
  'DEVIN REMAINS OPERATIONAL.',
] as const;
