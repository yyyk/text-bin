import { describe, expect, it } from "vitest"
import { createRng, deriveSeed, RandomStream } from "./random"

describe("createRng", () => {
  it("repeats the same sequence for the same seed", () => {
    const a = createRng(42)
    const b = createRng(42)
    for (let i = 0; i < 10; i++) expect(a()).toBe(b())
  })

  it("stays in [0, 1)", () => {
    const rng = createRng(1)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe("deriveSeed", () => {
  it("gives each stream its own seed", () => {
    expect(deriveSeed(1, RandomStream.path)).not.toBe(
      deriveSeed(1, RandomStream.jitter),
    )
  })

  it("gives each seed its own streams", () => {
    expect(deriveSeed(1, RandomStream.path)).not.toBe(
      deriveSeed(2, RandomStream.path),
    )
  })
})
