import { describe, expect, it } from 'vitest';
import { parseLevels } from './context';
import { DEFAULT_LEVELS } from './engine';

describe('parseLevels', () => {
  it('falls back to defaults for missing or corrupt data', () => {
    expect(parseLevels(null)).toEqual(DEFAULT_LEVELS);
    expect(parseLevels('not json')).toEqual(DEFAULT_LEVELS);
    expect(parseLevels('"a string"')).toEqual(DEFAULT_LEVELS);
  });

  it('keeps stored levels that are in range', () => {
    expect(parseLevels('{"master":0.1,"music":0,"sfx":1,"muted":true}')).toEqual({
      master: 0.1,
      music: 0,
      sfx: 1,
      muted: true,
    });
  });

  it('rejects out-of-range or wrongly typed values field by field', () => {
    expect(parseLevels('{"master":5,"music":"loud","sfx":0.3,"muted":"yes"}')).toEqual({
      ...DEFAULT_LEVELS,
      sfx: 0.3,
    });
  });
});
