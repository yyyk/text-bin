import { describe, expect, it } from "vitest"
import { createFrameClock } from "./frame-clock"

describe("createFrameClock", () => {
  it("steps fps frames a second, whatever the screen frames", () => {
    const clock = createFrameClock(60, 0)
    // a 120 Hz screen: about one frame every other screen frame
    let frames = 0
    for (let t = 1000 / 120; t <= 1000.001; t += 1000 / 120) {
      frames += clock.due(t)
    }
    expect(frames).toBe(60)
  })

  it("catches up after a slow screen frame", () => {
    const clock = createFrameClock(60, 0)
    expect(clock.due(51)).toBe(3)
  })

  it("catches up a few frames at most after a stall, and drops the rest", () => {
    const clock = createFrameClock(60, 0)
    expect(clock.due(2000)).toBe(4)
    // nothing left over from the stall
    expect(clock.due(2001)).toBe(0)
  })

  it("doesn't pile time up while paused", () => {
    const clock = createFrameClock(60, 0)
    clock.pause(5000)
    expect(clock.due(5010)).toBe(0)
    expect(clock.due(5017)).toBe(1)
  })
})
