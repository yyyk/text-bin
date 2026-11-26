import { describe, expect, it } from "vitest"
import { MAX_PNG_SIDE, pngSize } from "./png"

describe("pngSize", () => {
  it("scales, rounded as the preview's canvas", () => {
    expect(pngSize(1024, 512, 1)).toEqual({ width: 1024, height: 512 })
    expect(pngSize(1024, 512, 2)).toEqual({ width: 2048, height: 1024 })
    expect(pngSize(100, 50.2, 2)).toEqual({ width: 200, height: 100 })
  })

  it("is at least 1 px a side", () => {
    expect(pngSize(0, 0.1, 1)).toEqual({ width: 1, height: 1 })
  })

  it("refuses what's too big to draw", () => {
    expect(pngSize(MAX_PNG_SIDE, 10, 1).width).toBe(MAX_PNG_SIDE)
    expect(() => pngSize(MAX_PNG_SIDE, 10, 2)).toThrow("too big for a PNG")
  })
})
