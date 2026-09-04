import { describe, expect, it } from 'vitest';
import { COLUMN_LABELS, coordLabel } from './coords';

describe('coordLabel', () => {
  it('labels columns A-J and rows 1-10', () => {
    expect(COLUMN_LABELS).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
    expect(coordLabel({ row: 0, col: 0 })).toBe('A1');
    expect(coordLabel({ row: 9, col: 9 })).toBe('J10');
    expect(coordLabel({ row: 4, col: 2 })).toBe('C5');
  });
});
