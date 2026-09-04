export type Rng = () => number;

export const defaultRng: Rng = Math.random;

export function randomInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive) % maxExclusive;
}

export function pickRandom<T>(rng: Rng, items: readonly T[]): T {
  return items[randomInt(rng, items.length)];
}

/** Deterministic RNG (mulberry32) used by tests and reproducible games. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
