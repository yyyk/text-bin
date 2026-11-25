import { readFileSync } from "node:fs"
import { beforeAll, describe, expect, it } from "vitest"
import { Font, initText } from "text-shape"
import { createEngine } from "./engine"
import type { AtlasFont } from "./font"
import { createRng } from "./random"
import { type PackStrategy, type Settings } from "./settings"
import { TestContext, testFont, withPath2D, testSettings } from "./test-context"
import { planGestures } from "./timeline"

let font: AtlasFont
beforeAll(async () => {
  await initText()
  font = testFont(
    Font.fromBytes(readFileSync("public/fonts/Montserrat-Regular.ttf")),
  )
})

const run = (settings: Settings, frames: number) => {
  const engine = createEngine(new TestContext(), settings, font)
  for (let i = 0; i < frames; i++) engine.advanceFrame()
  return engine
}

const withStrategy = (strategy: PackStrategy): Settings => ({
  ...testSettings,
  atlas: { ...testSettings.atlas, strategy },
})

describe("createEngine", () => {
  it("gives the same result for the same settings", () => {
    const a = run(testSettings, 500)
    const b = run(testSettings, 500)
    expect(a.stats()).toEqual(b.stats())
    expect(a.sizes()).toEqual(b.sizes())
  })

  it("gives another result for another seed", () => {
    const a = run(testSettings, 500)
    const b = run({ ...testSettings, seed: 2 }, 500)
    expect(a.sizes()).not.toEqual(b.sizes())
  })

  it("loops back to the start after one cycle", () => {
    const engine = createEngine(new TestContext(), testSettings, font)
    for (let i = 0; i < engine.cycleFrames; i++) engine.advanceFrame()
    expect(engine.cycle()).toBe(2)
    expect(engine.frame()).toBe(0)
    expect(engine.sizes()).toEqual([6, 6, 6])
    expect(engine.lastCycle()).not.toBeNull()
  })

  it("stops after one cycle without loop", () => {
    const settings: Settings = {
      ...testSettings,
      timing: { ...testSettings.timing, loop: false },
    }
    const engine = createEngine(new TestContext(), settings, font)
    for (let i = 0; i < engine.cycleFrames; i++) engine.advanceFrame()
    expect(engine.done()).toBe(true)
    const frame = engine.frame()
    engine.advanceFrame()
    expect(engine.frame()).toBe(frame)
  })

  it("does nothing without texts", () => {
    const settings: Settings = {
      ...testSettings,
      text: { ...testSettings.text, texts: [] },
    }
    const engine = run(settings, 10)
    expect(engine.done()).toBe(true)
    expect(engine.stats().packed).toBe(0)
  })

  it("packs the same with either renderer", () => {
    const shaped: Settings = {
      ...testSettings,
      text: { ...testSettings.text, render: "text-shape" },
    }
    let withTextShape
    withPath2D(() => {
      withTextShape = run(shaped, 500).stats()
    })
    expect(withTextShape).toEqual(run(testSettings, 500).stats())
  })

  it("packs more without reuse", () => {
    const cycle = (reuse: boolean) => {
      const settings: Settings = {
        ...testSettings,
        atlas: { ...testSettings.atlas, strategy: "size-step", reuse },
      }
      const engine = createEngine(new TestContext(), settings, font)
      for (let i = 0; i < engine.cycleFrames; i++) engine.advanceFrame()
      return engine.lastCycle()!.packed
    }
    expect(cycle(false)).toBeGreaterThan(cycle(true))
  })

  // A snapshot of one cycle per strategy, so a change that alters the result
  // shows up here
  it("packs as before, per strategy", () => {
    const results = Object.fromEntries(
      (["every-frame", "size-step", "end-only"] as const).map((strategy) => {
        const settings = withStrategy(strategy)
        const engine = createEngine(new TestContext(), settings, font)
        for (let i = 0; i < engine.cycleFrames; i++) engine.advanceFrame()
        return [strategy, engine.lastCycle()]
      }),
    )
    expect(results).toMatchInlineSnapshot(`
      {
        "end-only": {
          "cached": 66,
          "evicted": 0,
          "packed": 66,
          "resets": 0,
        },
        "every-frame": {
          "cached": 201,
          "evicted": 1190,
          "packed": 1477,
          "resets": 1,
        },
        "size-step": {
          "cached": 93,
          "evicted": 0,
          "packed": 158,
          "resets": 1,
        },
      }
    `)
  })
})

describe("scatter motion", () => {
  const scatter = (motion: Partial<Settings["motion"]> = {}): Settings => ({
    ...testSettings,
    motion: {
      ...testSettings.motion,
      mode: "scatter",
      perFrame: 4,
      count: 100,
      ...motion,
    },
  })

  it("packs perFrame texts a frame, count in a cycle", () => {
    const engine = createEngine(new TestContext(), scatter(), font)
    expect(engine.cycleFrames).toBe(25)
    expect(engine.stats().packed).toBe(0) // starts empty
    engine.advanceFrame()
    expect(engine.active()).toHaveLength(4)
    for (let i = 1; i < 25; i++) engine.advanceFrame()
    expect(engine.cycle()).toBe(2)
    expect(engine.lastCycle()!.packed).toBeLessThanOrEqual(100)
  })

  it("picks sizes between min and max", () => {
    const engine = createEngine(new TestContext(), scatter(), font)
    for (let i = 0; i < 10; i++) {
      engine.advanceFrame()
      for (const i of engine.active()) {
        expect(engine.sizes()[i]).toBeGreaterThanOrEqual(6)
        expect(engine.sizes()[i]).toBeLessThanOrEqual(36)
      }
    }
  })

  it("repeats the same placements every cycle", () => {
    const engine = createEngine(new TestContext(), scatter(), font)
    const cycle = () =>
      Array.from({ length: 25 }, () => {
        engine.advanceFrame()
        // the texts picked, and their sizes
        return engine.active().map((i) => [i, engine.sizes()[i]])
      })
    expect(cycle()).toEqual(cycle())
  })

  it("packs a text picked twice in a frame at both sizes", () => {
    // One text, 10 a frame: every frame picks it ten times
    const settings = {
      ...scatter({ perFrame: 10, count: 10 }),
      text: { ...testSettings.text, texts: ["A"] },
    }
    const engine = createEngine(new TestContext(), settings, font)
    engine.advanceFrame()
    expect(engine.stats().packed).toBe(10)
  })
})

describe("planGestures", () => {
  it("keeps the zoom path when only the jitter changes", () => {
    const targets = (jitter: number) =>
      planGestures(
        {
          ...testSettings,
          timing: { ...testSettings.timing, jitter },
        },
        createRng(1),
        createRng(2),
      ).map((g) => g.to)
    expect(targets(0)).toEqual(targets(0.5))
  })

  it("zooms one text per gesture with single", () => {
    const gestures = planGestures(
      {
        ...testSettings,
        motion: { ...testSettings.motion, zoomTexts: "single" },
      },
      createRng(1),
      createRng(2),
    )
    expect(gestures.slice(0, 4).map((g) => g.active)).toEqual([
      [0],
      [1],
      [2],
      [0],
    ])
  })

  it("gives all texts one size with same", () => {
    const gestures = planGestures(
      {
        ...testSettings,
        motion: {
          ...testSettings.motion,
          zoomTexts: "all",
          zoomSizes: "same",
        },
      },
      createRng(1),
      createRng(2),
    )
    for (const g of gestures) expect(new Set(g.to).size).toBe(1)
  })
})
