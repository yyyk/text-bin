import { describe, expect, it } from "vitest"
import { EASING_KEYWORDS, parseTimingFunction } from "./easing"

const XS = [0.05, 0.1, 0.3, 0.45, 0.55, 0.7, 0.8, 0.95]

// What Chrome's own easing gives at XS (Web Animations API,
// getComputedTiming().progress), rounded to 6 decimals
const CHROME: Record<string, number[]> = {
  linear: [0.05, 0.1, 0.3, 0.45, 0.55, 0.7, 0.8, 0.95],
  ease: [
    0.032952, 0.094796, 0.513315, 0.747853, 0.847752, 0.940765, 0.975625,
    0.998625,
  ],
  "ease-in": [
    0.004475, 0.017027, 0.129577, 0.263345, 0.370676, 0.554814, 0.691634,
    0.917758,
  ],
  "ease-out": [
    0.082242, 0.160572, 0.445186, 0.629324, 0.736655, 0.870423, 0.937718,
    0.995525,
  ],
  "ease-in-out": [
    0.00483, 0.019722, 0.187396, 0.41434, 0.58566, 0.812604, 0.91834, 0.99517,
  ],
  "cubic-bezier(0.5, -1, 0.5, 2)": [
    -0.089537, -0.156134, -0.11992, 0.303494, 0.696506, 1.11992, 1.206515,
    1.089537,
  ],
  "steps(4)": [0, 0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75],
  "steps(4, jump-start)": [0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1, 1],
  "steps(4, jump-none)": [0, 0, 0.333333, 0.333333, 0.666667, 0.666667, 1, 1],
  "steps(4, jump-both)": [0.2, 0.2, 0.4, 0.4, 0.6, 0.6, 0.8, 0.8],
  "step-start": [1, 1, 1, 1, 1, 1, 1, 1],
  "step-end": [0, 0, 0, 0, 0, 0, 0, 0],
  "linear(0, 0.25 75%, 1)": [
    0.016667, 0.033333, 0.1, 0.15, 0.183333, 0.233333, 0.4, 0.85,
  ],
  "linear(0, 0.5 25% 75%, 1)": [0.1, 0.2, 0.5, 0.5, 0.5, 0.5, 0.6, 0.9],
  "linear(0, 0.9, 0.2, 1)": [0.135, 0.27, 0.81, 0.655, 0.445, 0.28, 0.52, 0.88],
  "linear(0, 0.5 60%, 0.8 60%, 1)": [
    0.041667, 0.083333, 0.25, 0.375, 0.458333, 0.85, 0.9, 0.975,
  ],
}

describe("parseTimingFunction", () => {
  for (const [css, expected] of Object.entries(CHROME)) {
    it(`matches Chrome for ${css}`, () => {
      const ease = parseTimingFunction(css)
      XS.forEach((x, i) => expect(ease(x)).toBeCloseTo(expected[i], 4))
    })
  }

  it("starts at 0 and ends at 1 for the smooth keywords", () => {
    for (const css of [
      "linear",
      "ease",
      "ease-in",
      "ease-out",
      "ease-in-out",
    ]) {
      const ease = parseTimingFunction(css)
      expect(ease(0)).toBeCloseTo(0, 5)
      expect(ease(1)).toBeCloseTo(1, 5)
    }
  })

  it("knows every keyword it lists", () => {
    for (const css of EASING_KEYWORDS) {
      expect(() => parseTimingFunction(css)).not.toThrow()
    }
  })

  it("throws for values it doesn't know", () => {
    expect(() => parseTimingFunction("bounce")).toThrow(/bounce/)
  })
})
