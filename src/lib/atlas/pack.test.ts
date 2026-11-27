import { readFileSync } from "node:fs"
import { beforeAll, describe, expect, it } from "vitest"
import { Font, initText } from "text-shape"
import { createMeasure, textBox, type AtlasFont, type Measure } from "./font"
import { createAtlas, splitText, textWarnings } from "./pack"
import { type AtlasSettings, type Evicted, type Settings } from "./settings"
import { TestContext, testFont, withPath2D, testSettings } from "./test-context"

let font: AtlasFont
let measure: Measure
beforeAll(async () => {
  await initText()
  const montserrat = readFileSync("public/fonts/Montserrat-Regular.ttf")
  font = testFont(Font.fromBytes(montserrat), "Montserrat")
  measure = createMeasure(font.font)
})

const withAtlas = (atlas: Partial<AtlasSettings>): Settings => ({
  ...testSettings,
  atlas: { ...testSettings.atlas, ...atlas },
})
const fits = (piece: string, width: number) =>
  textBox(measure, piece, 10).w <= width

describe("splitText", () => {
  // As wide as "AB CD" at 10px: narrower than the longer texts below
  const narrow = () => textBox(measure, "AB CD", 10).w + 0.01

  it("keeps a text that fits whole", () => {
    const settings = withAtlas({ width: narrow(), wrap: "word" })
    expect(splitText(measure, settings, "AB CD", 10)).toEqual(["AB CD"])
  })

  it("wraps at spaces with wrap word", () => {
    const width = narrow()
    const pieces = splitText(
      measure,
      withAtlas({ width, wrap: "word" }),
      "AB CD EF GH",
      10,
    )
    expect(pieces.join("")).toBe("AB CD EF GH")
    expect(pieces.length).toBeGreaterThan(1)
    for (const piece of pieces) expect(fits(piece, width)).toBe(true)
    // every break is at a space: before it or after it
    for (let i = 1; i < pieces.length; i++) {
      expect(pieces[i - 1].endsWith(" ") || pieces[i].startsWith(" ")).toBe(
        true,
      )
    }
  })

  it("breaks a word that's too wide between letters", () => {
    const width = narrow()
    const pieces = splitText(
      measure,
      withAtlas({ width, wrap: "word" }),
      "ABCDEFGHIJ",
      10,
    )
    expect(pieces.join("")).toBe("ABCDEFGHIJ")
    expect(pieces.length).toBeGreaterThan(1)
    for (const piece of pieces) expect(fits(piece, width)).toBe(true)
  })

  it("fills each piece as far as it fits with wrap letter", () => {
    const width = narrow()
    const text = "ABC DEFGH IJ"
    const pieces = splitText(
      measure,
      withAtlas({ width, wrap: "letter" }),
      text,
      10,
    )
    expect(pieces.join("")).toBe(text)
    pieces.forEach((piece, i) => {
      expect(fits(piece, width)).toBe(true)
      // one more letter wouldn't have fitted
      if (i < pieces.length - 1) {
        expect(fits(piece + pieces[i + 1][0], width)).toBe(false)
      }
    })
  })

  it("doesn't wrap with wrap none", () => {
    const settings = withAtlas({ width: narrow(), wrap: "none" })
    expect(splitText(measure, settings, "AB CD EF GH", 10)).toEqual([
      "AB CD EF GH",
    ])
  })

  it("packs words and spaces separately with unit word", () => {
    const settings = withAtlas({ unit: "word" })
    expect(splitText(measure, settings, "AB CD", 10)).toEqual(["AB", " ", "CD"])
  })

  it("packs letters with unit letter", () => {
    const settings = withAtlas({ unit: "letter" })
    expect(splitText(measure, settings, "AB C", 10)).toEqual([
      "A",
      "B",
      " ",
      "C",
    ])
  })
})

describe("createAtlas", () => {
  it("packs a text once per size and reuses it", () => {
    const atlas = createAtlas(new TestContext(), testSettings, font)
    atlas.step([{ text: "ABC", fontSize: 10 }])
    atlas.step([{ text: "ABC", fontSize: 10 }])
    atlas.step([{ text: "ABC", fontSize: 12 }])
    expect(atlas.stats()).toEqual({
      packed: 2,
      evicted: 0,
      resets: 0,
      cached: 2,
    })
  })

  it("shares words between texts with unit word", () => {
    const atlas = createAtlas(
      new TestContext(),
      withAtlas({ unit: "word" }),
      font,
    )
    atlas.step([
      { text: "AB CD", fontSize: 10 },
      { text: "CD EF", fontSize: 10 },
    ])
    expect(atlas.stats().packed).toBe(3)
    expect(atlas.pieces("CD EF")?.map((p) => p.entry?.text ?? null)).toEqual([
      "CD",
      null,
      "EF",
    ])
  })

  it("evicts old entries when it's full, and starts over when that isn't enough", () => {
    // One row, room for "AB" and "CD" (plus a pixel)
    const box = (text: string) => Math.ceil(measure.width(text, 10))
    const atlas = createAtlas(
      new TestContext(),
      withAtlas({
        width: box("AB") + box("CD") + 1,
        height: Math.ceil(measure.ascent(10) + measure.descent(10)),
      }),
      font,
    )
    atlas.step([{ text: "AB", fontSize: 10 }])
    atlas.step([{ text: "CD", fontSize: 10 }])
    // No room for "A": "AB" (least recently used, its slot big enough) goes
    atlas.step([{ text: "A", fontSize: 10 }])
    expect(atlas.stats()).toMatchObject({ packed: 3, evicted: 1, resets: 0 })
    expect(atlas.pieces("AB")).toBeUndefined()
    // Wider than any slot: nothing to evict that helps, so start over
    atlas.step([{ text: "ABCD", fontSize: 10 }])
    expect(atlas.stats()).toMatchObject({ resets: 1, cached: 1 })
  })

  it("skips a text too big for an empty atlas without starting over", () => {
    const atlas = createAtlas(
      new TestContext(),
      withAtlas({ width: measure.width("AB", 10) + 1, wrap: "none" }),
      font,
    )
    atlas.step([{ text: "AB", fontSize: 10 }])
    atlas.step([{ text: "ABCDEFGH", fontSize: 10 }])
    expect(atlas.stats()).toMatchObject({ resets: 0, cached: 1 })
    expect(atlas.pieces("ABCDEFGH")).toBeUndefined()
  })

  it("draws each new entry, with the browser or as glyph outlines", () => {
    const browser = new TestContext()
    const atlas = createAtlas(browser, testSettings, font)
    atlas.step([{ text: "ABC", fontSize: 10 }])
    atlas.step([{ text: "ABC", fontSize: 10 }])
    expect(browser.drawn).toEqual(["ABC"])

    const shaped = new TestContext()
    const settings: Settings = {
      ...testSettings,
      text: { ...testSettings.text, render: "text-shape" },
    }
    withPath2D(() => {
      createAtlas(shaped, settings, font).step([{ text: "AB C", fontSize: 10 }])
    })
    expect(shaped.filled).toBe(3) // A, B, C; not the space
  })
})

describe("letter spacing", () => {
  const spaced: Settings = {
    ...testSettings,
    text: { ...testSettings.text, letterSpacing: 0.1 },
  }

  it("packs boxes wide enough for the spacing", () => {
    const atlas = createAtlas(new TestContext(), spaced, font)
    atlas.step([{ text: "ABC", fontSize: 10 }])
    const entry = atlas.pieces("ABC")![0].entry!
    // 3 letters, 1px after each
    expect(entry.w).toBe(Math.ceil(measure.width("ABC", 10) + 3))
  })

  it("packs boxes wide enough for the ink with negative spacing", () => {
    const tight: Settings = {
      ...testSettings,
      text: { ...testSettings.text, letterSpacing: -0.2 },
    }
    const atlas = createAtlas(new TestContext(), tight, font)
    atlas.step([{ text: "ABC", fontSize: 10 }])
    const entry = atlas.pieces("ABC")![0].entry!
    const tightMeasure = createMeasure(font.font, -0.2)
    const ink = tightMeasure.ink("ABC", 10)
    // the advance ends 2px before the last letter does: wider than it
    expect(entry.w).toBeGreaterThan(Math.ceil(tightMeasure.width("ABC", 10)))
    // all the ink inside the box
    const inkLeft = entry.textXOffset + ink.x
    expect(inkLeft).toBeGreaterThanOrEqual(0)
    expect(inkLeft + ink.w).toBeLessThanOrEqual(entry.w)
  })

  it("wraps to pieces whose boxes fit with negative spacing", () => {
    const tight = createMeasure(font.font, -0.2)
    const width = 30
    const settings: Settings = {
      ...withAtlas({ width, wrap: "letter" }),
      text: { ...testSettings.text, letterSpacing: -0.2 },
    }
    const pieces = splitText(tight, settings, "ABCDEFGHIJ", 10)
    expect(pieces.join("")).toBe("ABCDEFGHIJ")
    for (const piece of pieces) {
      expect(textBox(tight, piece, 10).w).toBeLessThanOrEqual(width)
    }
  })

  it("warns about a text whose box is wider than the atlas", () => {
    const tight = createMeasure(font.font, -0.2)
    const box = textBox(tight, "ABC", 10).w
    // the advance fits, the box doesn't
    const width = box - 0.5
    expect(tight.width("ABC", 10)).toBeLessThan(width)
    const settings: Settings = {
      ...withAtlas({ width, wrap: "none" }),
      text: { ...testSettings.text, texts: ["ABC"], letterSpacing: -0.2 },
      motion: { ...testSettings.motion, maxSize: 10 },
    }
    expect(textWarnings(settings, font)).toHaveLength(1)
  })

  it("draws with the spacing it measured with", () => {
    const ctx = new TestContext()
    createAtlas(ctx, spaced, font).step([{ text: "ABC", fontSize: 20 }])
    expect(ctx.letterSpacing).toBe("2px")
  })
})

describe("padding", () => {
  const padded = (padding: number, atlas: Partial<AtlasSettings> = {}) =>
    withAtlas({ padding, ...atlas })

  it("keeps the padding around and between entries", () => {
    const atlas = createAtlas(new TestContext(), padded(3), font)
    atlas.step([
      { text: "AB", fontSize: 10 },
      { text: "CD", fontSize: 10 },
    ])
    const ab = atlas.pieces("AB")![0].entry!
    const cd = atlas.pieces("CD")![0].entry!
    expect([ab.x, ab.y]).toEqual([3, 3])
    // side by side on the shelf, 2 × 3px apart
    expect(cd.x).toBe(ab.x + ab.w + 6)
  })

  it("clears the padding with the entry", () => {
    const ctx = new TestContext()
    createAtlas(ctx, padded(3), font).step([{ text: "AB", fontSize: 10 }])
    const entry = { w: Math.ceil(measure.width("AB", 10)) }
    expect(ctx.cleared[0].slice(0, 3)).toEqual([0, 0, entry.w + 6])
  })

  it("wraps to the width inside the padding", () => {
    // room for "AB CD" only without the padding
    const width = measure.width("AB CD", 10) + 1
    expect(splitText(measure, padded(0, { width }), "AB CD", 10)).toEqual([
      "AB CD",
    ])
    expect(
      splitText(measure, padded(4, { width }), "AB CD", 10).length,
    ).toBeGreaterThan(1)
  })

  it("pads the edges too with padEdges: as far from them as from each other", () => {
    const atlas = createAtlas(
      new TestContext(),
      padded(3, { padEdges: true }),
      font,
    )
    atlas.step([
      { text: "AB", fontSize: 10 },
      { text: "CD", fontSize: 10 },
    ])
    const ab = atlas.pieces("AB")![0].entry!
    const cd = atlas.pieces("CD")![0].entry!
    expect([ab.x, ab.y]).toEqual([6, 6])
    expect(cd.x - (ab.x + ab.w)).toBe(6)
  })

  it("wraps to the width inside the edge padding too", () => {
    // room for "AB CD" with 2px padding, but not with the edges padded too
    const width = measure.width("AB CD", 10) + 4 + 1
    expect(splitText(measure, padded(2, { width }), "AB CD", 10)).toEqual([
      "AB CD",
    ])
    expect(
      splitText(measure, padded(2, { width, padEdges: true }), "AB CD", 10)
        .length,
    ).toBeGreaterThan(1)
  })

  it("packs the same as before with no padding", () => {
    const a = createAtlas(new TestContext(), padded(0), font)
    const b = createAtlas(new TestContext(), testSettings, font)
    for (const atlas of [a, b]) atlas.step([{ text: "ABC", fontSize: 10 }])
    expect(a.pieces("ABC")![0].entry).toEqual(b.pieces("ABC")![0].entry)
  })
})

describe("reuse", () => {
  const noReuse = (atlas: Partial<AtlasSettings> = {}) =>
    withAtlas({ reuse: false, ...atlas })

  it("packs a text again when it comes back at a size it had", () => {
    const atlas = createAtlas(new TestContext(), noReuse(), font)
    atlas.step([{ text: "ABC", fontSize: 10 }])
    atlas.step([{ text: "ABC", fontSize: 12 }])
    atlas.step([{ text: "ABC", fontSize: 10 }])
    expect(atlas.stats()).toMatchObject({ packed: 3, cached: 3 })
  })

  it("keeps a text that stays at its size", () => {
    const atlas = createAtlas(new TestContext(), noReuse(), font)
    atlas.step([{ text: "ABC", fontSize: 10 }])
    atlas.step([{ text: "ABC", fontSize: 10 }])
    expect(atlas.stats().packed).toBe(1)
  })

  it("packs a fresh appearance again even at the same size", () => {
    const atlas = createAtlas(new TestContext(), noReuse(), font)
    atlas.step([{ text: "ABC", fontSize: 10, fresh: true }])
    atlas.step([{ text: "ABC", fontSize: 10, fresh: true }])
    expect(atlas.stats().packed).toBe(2)
  })

  it("doesn't share words between texts", () => {
    const atlas = createAtlas(
      new TestContext(),
      noReuse({ unit: "word" }),
      font,
    )
    atlas.step([
      { text: "AB CD", fontSize: 10 },
      { text: "CD EF", fontSize: 10 },
    ])
    expect(atlas.stats().packed).toBe(4)
  })
})

describe("evicted", () => {
  // Two rows, each with room for "AB" and "CD" (plus a pixel)
  const box = (text: string) => Math.ceil(measure.width(text, 10))
  const rowHeight = () => Math.ceil(measure.ascent(10) + measure.descent(10))
  const twoRows = (evicted: Evicted) =>
    withAtlas({
      width: box("AB") + box("CD") + 1,
      height: 2 * rowHeight(),
      evicted,
    })
  const slot = (atlas: ReturnType<typeof createAtlas>, text: string) => {
    const { x, y, w, h } = atlas.pieces(text)![0].entry!
    return [x, y, w, h]
  }

  // One row: "AB", "CD", then "A" evicts "AB" and takes its slot. The
  // slots cleared, in order, the letters erased, and AB's slot
  const evictAB = (evicted: Evicted) => {
    const ctx = new TestContext()
    const atlas = createAtlas(
      ctx,
      withAtlas({
        width: box("AB") + box("CD") + 1,
        height: rowHeight(),
        evicted,
      }),
      font,
    )
    atlas.step([{ text: "AB", fontSize: 10 }])
    atlas.step([{ text: "CD", fontSize: 10 }])
    const ab = slot(atlas, "AB")
    ctx.cleared = []
    withPath2D(() => atlas.step([{ text: "A", fontSize: 10 }]))
    return { cleared: ctx.cleared, erased: ctx.erased, ab, a: slot(atlas, "A") }
  }

  it("keeps an evicted entry's pixels with keep", () => {
    const { cleared, erased, a } = evictAB("keep")
    expect(cleared).toEqual([a])
    expect(erased).toBe(0)
  })

  it("clears an evicted entry whole as it's evicted with evict", () => {
    const { cleared, erased, ab, a } = evictAB("evict")
    expect(cleared).toEqual([ab, a])
    expect(erased).toBe(0)
  })

  it("erases the letters a new entry touches, each by its shape, with letters", () => {
    const { cleared, erased, a } = evictAB("letters")
    // "A" takes AB's slot: A's old letter goes, and B if A's slot reaches
    // its ink box; then A's slot is cleared as usual
    expect(cleared).toEqual([a])
    expect(erased).toBeGreaterThan(0)
    expect(erased).toBeLessThanOrEqual(2)
  })

  it("leaves old letters a new entry doesn't touch, with letters", () => {
    const ctx = new TestContext()
    const atlas = createAtlas(ctx, twoRows("letters"), font)
    for (const text of ["AB", "CD", "EF"]) {
      atlas.step([{ text, fontSize: 10 }])
    }
    withPath2D(() => {
      // Starts over: ABCD on the first row, over AB and CD: A, B, C, D
      // erased; EF stays
      ctx.cleared = []
      atlas.step([{ text: "ABCD", fontSize: 10 }])
      expect(ctx.erased).toBe(4)
      expect(ctx.cleared).toEqual([slot(atlas, "ABCD")])
      // A small one at the start of the second row: E goes, not F
      atlas.step([{ text: "i", fontSize: 10 }])
      expect(ctx.erased).toBe(5)
    })
  })

  // One row: "AB CD", then "A" evicts it and lands at its start. The
  // letters erased
  const overABCD = (evicted: Evicted) => {
    const ctx = new TestContext()
    const atlas = createAtlas(
      ctx,
      withAtlas({ width: box("AB CD") + 1, height: rowHeight(), evicted }),
      font,
    )
    atlas.step([{ text: "AB CD", fontSize: 10 }])
    withPath2D(() => atlas.step([{ text: "A", fontSize: 10 }]))
    expect(atlas.stats().evicted).toBe(1)
    return ctx.erased
  }

  it("erases the touched words whole with words", () => {
    // "A" lands on the word "AB": A and B go, "CD" stays
    expect(overABCD("words")).toBe(2)
  })

  it("erases only the touched letters with letters", () => {
    // A, and B if A's slot reaches its box; not C or D
    const erased = overABCD("letters")
    expect(erased).toBeGreaterThanOrEqual(1)
    expect(erased).toBeLessThanOrEqual(2)
  })

  it("after a reset, clears old entries whole once a new one is packed over them", () => {
    const ctx = new TestContext()
    const atlas = createAtlas(ctx, twoRows("evict"), font)
    atlas.step([{ text: "AB", fontSize: 10 }])
    atlas.step([{ text: "CD", fontSize: 10 }])
    atlas.step([{ text: "EF", fontSize: 10 }])
    const [ab, cd, ef] = ["AB", "CD", "EF"].map((t) => slot(atlas, t))
    expect(ef[1]).toBe(rowHeight()) // on the second row

    // Wider than any slot: starts over, packed on the first row
    ctx.cleared = []
    atlas.step([{ text: "ABCD", fontSize: 10 }])
    expect(atlas.stats().resets).toBe(1)
    // AB and CD (under it) go, then its own; EF stays
    expect(ctx.cleared).toEqual([ab, cd, slot(atlas, "ABCD")])

    // On the second row, over EF: EF goes now
    ctx.cleared = []
    atlas.step([{ text: "G", fontSize: 10 }])
    expect(ctx.cleared).toEqual([ef, slot(atlas, "G")])
  })

  it("leaves old pixels after a reset with keep", () => {
    const ctx = new TestContext()
    const atlas = createAtlas(ctx, twoRows("keep"), font)
    for (const text of ["AB", "CD", "EF"]) {
      atlas.step([{ text, fontSize: 10 }])
    }
    ctx.cleared = []
    atlas.step([{ text: "ABCD", fontSize: 10 }])
    expect(ctx.cleared).toEqual([slot(atlas, "ABCD")])
  })
})

describe("textWarnings", () => {
  const settings = (atlas: Partial<AtlasSettings>, texts: string[]) => ({
    ...withAtlas(atlas),
    text: { ...testSettings.text, texts },
    motion: { ...testSettings.motion, maxSize: 10 },
  })

  it("is empty when everything fits", () => {
    expect(textWarnings(settings({ width: 600 }, ["ABC"]), font)).toEqual([])
  })

  it("says from which size a text is too wide", () => {
    const w = measure.width("ABCDEFGHIJ", 10)
    const limit = Math.floor((10 * 30) / w)
    expect(textWarnings(settings({ width: 30 }, ["ABCDEFGHIJ"]), font)).toEqual(
      [
        `"ABCDEFGHIJ" is wider than the atlas above about ${limit}px and will wrap into pieces`,
      ],
    )
  })

  it("checks the widest word with unit word, and nothing with unit letter", () => {
    const width = measure.width("AB", 10) + 1
    expect(
      textWarnings(settings({ width, unit: "word" }, ["AB AB AB"]), font),
    ).toEqual([])
    expect(
      textWarnings(settings({ width, unit: "letter" }, ["ABCDEFGHIJ"]), font),
    ).toEqual([])
  })

  it("names letters the font has no shape for", () => {
    expect(textWarnings(settings({}, ["Aあ"]), font)).toEqual([
      '"Aあ": Montserrat has no "あ"',
    ])
  })
})
