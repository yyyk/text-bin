import { readFileSync } from "node:fs"
import { beforeAll, describe, expect, it } from "vitest"
import { Font, initText } from "text-shape"
import type { AtlasFont } from "@/lib/atlas/font"
import { TestContext, testFont, testSettings } from "@/lib/atlas/test-context"
import { createPlayer } from "@/lib/preview/player"
import { passFrames, videoSize } from "./video"

describe("videoSize", () => {
  it("is the atlas's own size, made even", () => {
    expect(videoSize(600, 600, "atlas")).toEqual({ width: 600, height: 600 })
    expect(videoSize(601, 333, "atlas")).toEqual({ width: 602, height: 334 })
    expect(videoSize(600, 333, "atlas2")).toEqual({ width: 1200, height: 666 })
  })

  it("scales to fit, up or down, keeping the proportions", () => {
    expect(videoSize(600, 600, "1080")).toEqual({ width: 1080, height: 1080 })
    expect(videoSize(600, 600, "1920")).toEqual({ width: 1080, height: 1080 })
    expect(videoSize(800, 400, "1920")).toEqual({ width: 1920, height: 960 })
    expect(videoSize(1000, 500, "4k")).toEqual({ width: 3840, height: 1920 })
    expect(videoSize(4000, 1000, "1080")).toEqual({ width: 1080, height: 270 })
  })
})

describe("one pass", () => {
  let font: AtlasFont
  beforeAll(async () => {
    await initText()
    font = testFont(
      Font.fromBytes(readFileSync("public/fonts/Montserrat-Regular.ttf")),
    )
  })

  it("goes from an empty atlas to the end, then starts over", () => {
    const settings = {
      ...testSettings,
      timing: { ...testSettings.timing, loop: false },
    }
    const player = createPlayer(() => new TestContext(), settings, font)
    const frames = passFrames(player.engine().cycleFrames)
    // the pass's frames: the first as it starts, then one step each
    for (let i = 1; i < frames; i++) player.advance()
    expect(player.engine().done()).toBe(true)
    expect(player.position()).toBe(frames - 1)
    // the next frame is the next pass's first
    expect(player.advance()).toBe(true)
    expect(player.position()).toBe(0)
    expect(player.engine().done()).toBe(false)
  })
})
