import { describe, expect, it } from 'vitest';
import { FLEET } from '../engine/types';
import {
  ARMS_RACE_CLEARED,
  ARMS_RACE_SHIPS,
  DEFENDER,
  DEFENDER_HIT,
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
    expect(enemyShipName('Submarine')).toBe('Claude Carrier');
    expect(enemyShipName('Destroyer')).toBe('Cursor Cruiser');
  });

  it('names the flagship Devin Defender and flags the rivalry ships', () => {
    expect(playerShipName('Battleship')).toBe('Devin Defender');
    expect(DEFENDER).toBe('Battleship');
    expect(ARMS_RACE_SHIPS).toEqual(['Submarine', 'Destroyer']);
    expect(shipDisplayName('Battleship', 'player')).toBe('Devin Defender');
  });

  it('uses rivalry-specific sink wording', () => {
    expect(sunkVerb('Submarine', 'enemy')).toBe('ELIMINATED');
    expect(sunkVerb('Destroyer', 'enemy')).toBe('SUNK');
    expect(sunkVerb('Carrier', 'enemy')).toBe('DESTROYED');
    expect(sunkVerb('Battleship', 'player')).toBe('DESTROYED');
  });

  it('has the rivalry callouts', () => {
    expect(ARMS_RACE_CLEARED).toBe('THE AI ARMS RACE CONTINUES.');
    expect(DEFENDER_HIT).toBe('DEVIN REMAINS OPERATIONAL.');
  });
});
