import { describe, expect, it } from "vitest"
import { subtract } from "./rect"

const area = (rects: { w: number; h: number }[]) =>
  rects.reduce((sum, r) => sum + r.w * r.h, 0)

describe("subtract", () => {
  const r = { x: 0, y: 0, w: 10, h: 10 }

  it("leaves a rectangle it doesn't touch as it is", () => {
    expect(subtract(r, { x: 20, y: 0, w: 5, h: 5 })).toEqual([r])
  })

  it("is nothing when the cut covers it", () => {
    expect(subtract(r, { x: -1, y: -1, w: 12, h: 12 })).toEqual([])
  })

  it("leaves what's around a cut in the middle", () => {
    const rest = subtract(r, { x: 2, y: 3, w: 4, h: 5 })
    expect(rest).toHaveLength(4)
    expect(area(rest)).toBe(100 - 20)
  })

  it("cuts off a side", () => {
    expect(subtract(r, { x: 6, y: -5, w: 10, h: 20 })).toEqual([
      { x: 0, y: 0, w: 6, h: 10 },
    ])
  })
})
