import { describe, expect, it } from "vitest"
import { defaultDoc, engineSettings } from "./document"

describe("engineSettings", () => {
  it("leaves out empty lines in the texts", () => {
    const doc = {
      ...defaultDoc,
      text: { ...defaultDoc.text, texts: ["A", "", "  ", "B"] },
    }
    expect(engineSettings(doc).settings.text.texts).toEqual(["A", "B"])
  })

  it("plays an invalid easing as linear, and says so", () => {
    const doc = {
      ...defaultDoc,
      motion: { ...defaultDoc.motion, easing: "wobble" },
    }
    const { settings, easingError } = engineSettings(doc)
    expect(settings.motion.easing).toBe("linear")
    expect(easingError).toMatch(/linear/)
  })

  it("keeps a valid easing", () => {
    const doc = {
      ...defaultDoc,
      motion: { ...defaultDoc.motion, easing: "cubic-bezier(0.5, -1, 0.5, 2)" },
    }
    const { appearance: _, ...settings } = doc
    expect(engineSettings(doc)).toEqual({ settings, easingError: null })
  })
})
