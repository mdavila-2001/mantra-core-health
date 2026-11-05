import { nearestBlockKey } from './nearest-block';

describe('nearestBlockKey', () => {
  const at = (clave: string, hour: number, minute = 0) => ({
    clave,
    desde: new Date(2026, 10, 4, hour, minute),
  });

  it('picks the block that starts closest to the minute', () => {
    const blocks = [at('a', 9), at('b', 11), at('c', 15)];
    expect(nearestBlockKey(blocks, ['a', 'b', 'c'], 10 * 60 + 40)).toBe('b');
  });

  it('ignores blocks that are not in the keys and falls back to the first key', () => {
    expect(nearestBlockKey([at('a', 9)], ['z'], 600)).toBe('z');
    expect(nearestBlockKey([at('a', 9), at('b', 10)], ['b'], 9 * 60)).toBe('b');
  });
});
