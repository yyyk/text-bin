import { describe, expect, it } from "vitest"
import { defaultDoc } from "./document"
import { parseDoc, serializeDoc } from "./document-file"

const file = (doc: unknown, version = 1) =>
  JSON.stringify({ format: "text-bin", version, doc })

describe("parseDoc", () => {
  it("reads back what serializeDoc wrote", () => {
    const doc = {
      ...defaultDoc,
      text: { ...defaultDoc.text, texts: ["A B", "C"] },
      seed: 42,
    }
    expect(parseDoc(serializeDoc(doc))).toEqual(doc)
  })

  it("fills in settings an older file doesn't have", () => {
    expect(parseDoc(file({ seed: 7 }))).toEqual({ ...defaultDoc, seed: 7 })
  })

  it("ignores values of the wrong type or choice", () => {
    const doc = parseDoc(
      file({
        seed: "7",
        motion: { minSize: Number.NaN, pattern: "spiral" },
        atlas: { strategy: "size-step" },
        text: { texts: ["A", 3, "B"] },
      }),
    )
    expect(doc.seed).toBe(defaultDoc.seed)
    expect(doc.motion.minSize).toBe(defaultDoc.motion.minSize)
    expect(doc.motion.pattern).toBe(defaultDoc.motion.pattern)
    expect(doc.atlas.strategy).toBe("size-step")
    expect(doc.text.texts).toEqual(["A", "B"])
  })

  it("keeps hex colours and ignores others", () => {
    const doc = parseDoc(
      file({ appearance: { background: "#112233", color: "red" } }),
    )
    expect(doc.appearance).toEqual({
      ...defaultDoc.appearance,
      background: "#112233",
    })
  })

  it("reads a transparent background", () => {
    const doc = parseDoc(file({ appearance: { transparent: true } }))
    expect(doc.appearance.transparent).toBe(true)
  })

  it("reads settings saved before they were renamed or moved", () => {
    const doc = parseDoc(
      file({
        zoom: { motion: "scatter", maxSize: 48, perFrame: 3 },
        text: { texts: ["A"], zoom: "single", sizes: "same" },
      }),
    )
    expect(doc.motion).toEqual({
      ...defaultDoc.motion,
      mode: "scatter",
      maxSize: 48,
      perFrame: 3,
      zoomTexts: "single",
      zoomSizes: "same",
    })
    expect(doc.text).toEqual({ ...defaultDoc.text, texts: ["A"] })
  })

  it("keeps what's already in the new place", () => {
    const doc = parseDoc(
      file({ zoom: { maxSize: 48 }, motion: { maxSize: 20, mode: "zoom" } }),
    )
    expect(doc.motion.maxSize).toBe(20)
  })

  it("throws for files that aren't text-bin documents", () => {
    expect(() => parseDoc("{")).toThrow(/valid JSON/)
    expect(() =>
      parseDoc(JSON.stringify({ format: "other", doc: {} })),
    ).toThrow(/text-bin/)
    expect(() => parseDoc(file({}, 2))).toThrow(/newer version/)
  })
})
