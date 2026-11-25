/** A random number generator: each call returns the next number in [0, 1) */
export type Rng = () => number

/** Seeded random numbers (mulberry32), as in type-shards */
export function createRng(seed: number): Rng {
  return function () {
    let t = (seed = (seed + 0x6d2b79f5) | 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// MurmurHash3's finalizer
function mix(h: number): number {
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/**
 * One key per kind of randomness. Pass it to deriveSeed, so each kind gets
 * its own values: changing the jitter never changes the zoom path.
 */
export const RandomStream = {
  /** the zoom path: the gestures' target sizes */
  path: 0,
  /** each gesture's duration jitter */
  jitter: 1,
  /** with motion "scatter": which text, and its size */
  placements: 2,
} as const

export function deriveSeed(seed: number, ...keys: number[]): number {
  let h = mix(seed)
  for (const key of keys) {
    h = mix(h ^ key)
  }
  return h
}
