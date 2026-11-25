import { readFileSync } from "node:fs"
import { beforeAll, describe, expect, it } from "vitest"
import { Font, initText } from "text-shape"
import { createMeasure, missingLetters } from "./font"

let font: Font
beforeAll(async () => {
  await initText()
  font = Font.fromBytes(readFileSync("public/fonts/Montserrat-Regular.ttf"))
})

describe("createMeasure", () => {
  it("adds the letter spacing after every letter, in em", () => {
    const plain = createMeasure(font)
    const spaced = createMeasure(font, 0.1)
    // 3 letters at 20px, 0.1em = 2px each
    expect(spaced.width("ABC", 20)).toBeCloseTo(plain.width("ABC", 20) + 6, 5)
    // in em: twice the size, twice the spacing
    expect(spaced.width("ABC", 40)).toBeCloseTo(plain.width("ABC", 40) + 12, 5)
  })

  it("tightens with negative spacing", () => {
    expect(createMeasure(font, -0.05).width("ABC", 20)).toBeLessThan(
      createMeasure(font).width("ABC", 20),
    )
  })

  it("doesn't change the line height", () => {
    const plain = createMeasure(font)
    const spaced = createMeasure(font, 0.5)
    expect(spaced.ascent(20)).toBe(plain.ascent(20))
    expect(spaced.descent(20)).toBe(plain.descent(20))
  })
})

describe("missingLetters", () => {
  it("lists letters the font has no shape for, each once, not spaces", () => {
    expect(missingLetters(font, "Aあ あB")).toEqual(["あ"])
  })

  it("doesn't count zero-width characters, empty on purpose", () => {
    // a zero-width space: an empty glyph in Montserrat, with no width
    expect(missingLetters(font, "A\u200BB")).toEqual([])
  })
})
