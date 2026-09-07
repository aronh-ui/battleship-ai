import { describe, expect, it } from 'vitest';
import { FLEET } from '../engine/types';
import {
  ARMS_RACE_CLEARED,
  ARMS_RACE_SHIPS,
  enemyShipName,
  playerShipName,
  shipDisplayName,
  sunkVerb,
} from './fleet';

describe('fleet theme', () => {
  it('names every ship in the fleet on both sides', () => {
    for (const spec of FLEET) {
      expect(playerShipName(spec.name)).toBeTruthy();
      expect(enemyShipName(spec.name)).toBeTruthy();
      expect(playerShipName(spec.name)).not.toBe(enemyShipName(spec.name));
    }
  });

  it('uses the themed player names', () => {
    expect(playerShipName('Carrier')).toBe('Cognition Carrier');
    expect(playerShipName('Destroyer')).toBe('Bug Destroyer');
  });

  it('uses the themed enemy names by default', () => {
    expect(enemyShipName('Battleship')).toBe('Technical Debt');
    expect(enemyShipName('Destroyer')).toBe('Slow Releases');
  });

  it('renames only the two competitor targets in arms race mode', () => {
    expect(enemyShipName('Carrier', true)).toBe('Copilot Carrier');
    expect(enemyShipName('Cruiser', true)).toBe('Cursor Cruiser');
    expect(enemyShipName('Battleship', true)).toBe('Technical Debt');
    expect(ARMS_RACE_SHIPS).toEqual(['Carrier', 'Cruiser']);
  });

  it('never renames the player fleet in arms race mode', () => {
    for (const spec of FLEET) {
      expect(shipDisplayName(spec.name, 'player', true)).toBe(playerShipName(spec.name));
    }
  });

  it('uses competitor-specific sink wording only in arms race mode', () => {
    expect(sunkVerb('Carrier', 'enemy', true)).toBe('ELIMINATED');
    expect(sunkVerb('Cruiser', 'enemy', true)).toBe('SUNK');
    expect(sunkVerb('Carrier', 'enemy', false)).toBe('DESTROYED');
    expect(sunkVerb('Carrier', 'player', true)).toBe('DESTROYED');
  });

  it('has the arms race completion lines', () => {
    expect(ARMS_RACE_CLEARED).toEqual([
      'THE AI ARMS RACE CONTINUES.',
      'DEVIN REMAINS OPERATIONAL.',
    ]);
  });
});
