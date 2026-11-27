import { readFileSync } from "node:fs"
import { beforeAll, describe, expect, it } from "vitest"
import { Font, initText } from "text-shape"
import { createEngine } from "@/lib/atlas/engine"
import type { AtlasFont } from "@/lib/atlas/font"
import type { Evicted, Settings } from "@/lib/atlas/settings"
import { testFont, testSettings } from "@/lib/atlas/test-context"
import { atlasToSvg, createRecorder } from "./svg"

let font: AtlasFont
// "A" in Montserrat
let glyphA: number
beforeAll(async () => {
  await initText()
  font = testFont(
    Font.fromBytes(readFileSync("public/fonts/Montserrat-Regular.ttf")),
  )
  glyphA = font.font.layout("A").lines[0].glyphs[0].id
})

/** One "A" recorded at 10px (font units scaled), its box */
function recordA() {
  const recorder = createRecorder(font.font)
  const ctx = recorder.context
  ctx.save()
  ctx.translate(20, 30)
  ctx.scale(0.01, 0.01)
  ctx.fillGlyph!(glyphA, {})
  ctx.restore()
  return { recorder, ctx, box: recorder.glyphs()[0].box }
}

describe("createRecorder", () => {
  it("records a glyph where it's drawn", () => {
    const { recorder, box } = recordA()
    expect(recorder.glyphs()).toHaveLength(1)
    expect(box.x).toBeGreaterThanOrEqual(20)
    expect(box.y + box.h).toBeCloseTo(30, 0) // on the baseline
  })

  it("drops a glyph cleared all over", () => {
    const { recorder, ctx, box } = recordA()
    ctx.clearRect(box.x - 1, box.y - 1, box.w + 2, box.h + 2)
    expect(recorder.glyphs()).toHaveLength(0)
  })

  it("keeps what's left of a glyph partly cleared", () => {
    const { recorder, ctx, box } = recordA()
    ctx.clearRect(box.x, box.y, box.w / 2, box.h)
    const [glyph] = recorder.glyphs()
    expect(glyph.visible).toHaveLength(1)
    expect(glyph.visible[0].x).toBeCloseTo(box.x + box.w / 2)
  })

  it("doesn't clip what's drawn after a clear", () => {
    const recorder = createRecorder(font.font)
    const ctx = recorder.context
    ctx.clearRect(0, 0, 100, 100)
    ctx.save()
    ctx.translate(20, 30)
    ctx.scale(0.01, 0.01)
    ctx.fillGlyph!(glyphA, {})
    ctx.restore()
    expect(recorder.glyphs()[0].visible).toEqual([recorder.glyphs()[0].box])
  })

  it("drops a glyph erased by its shape", () => {
    const { recorder, ctx } = recordA()
    ctx.save()
    ctx.globalCompositeOperation = "destination-out"
    ctx.translate(20, 30)
    ctx.scale(0.01, 0.01)
    ctx.fillGlyph!(glyphA, {})
    ctx.restore()
    expect(recorder.glyphs()).toHaveLength(0)
    expect(ctx.globalCompositeOperation).toBe("source-over")
  })
})

describe("atlasToSvg", () => {
  const settings = (evicted: Evicted): Settings => ({
    ...testSettings,
    atlas: { ...testSettings.atlas, evicted },
  })
  const colors = { color: "#1a1a1a", background: "#f2f2f2" }
  const paths = (svg: string) => svg.match(/<path /g)?.length ?? 0

  // Played up to `position`: the glyphs drawn, cleared or not, and the
  // letters of the entries in the atlas then
  function played(s: Settings, position: number) {
    let drawn = 0
    const recorder = createRecorder(font.font)
    const fillGlyph = recorder.context.fillGlyph!
    recorder.context.fillGlyph = (id, variations) => {
      if (recorder.context.globalCompositeOperation === "source-over") drawn++
      fillGlyph(id, variations)
    }
    const engine = createEngine(
      recorder.context,
      { ...s, text: { ...s.text, render: "text-shape" } },
      font,
    )
    for (let i = 0; i < position; i++) engine.advanceFrame()
    let letters = 0
    for (const entry of engine.entries()) {
      letters += [...entry.text].filter((c) => c.trim()).length
    }
    return { drawn, letters }
  }

  it("has the atlas's size, its background and the text's colour", async () => {
    const svg = await atlasToSvg({
      settings: settings("keep"),
      font,
      position: 10,
      colors,
    })
    expect(svg).toMatch(/^<svg [^>]*width="600" height="600"/)
    expect(svg).toContain('<rect width="600" height="600" fill="#f2f2f2"/>')
    expect(svg).toContain('<g fill="#1a1a1a">')
    expect(paths(svg)).toBeGreaterThan(0)
  })

  it("leaves the background out when transparent", async () => {
    const svg = await atlasToSvg({
      settings: settings("keep"),
      font,
      position: 10,
      colors: { ...colors, background: null },
    })
    expect(svg).not.toContain("<rect width")
  })

  it("has only what's still visible, as plain paths", async () => {
    const svg = (evicted: Evicted) =>
      atlasToSvg({ settings: settings(evicted), font, position: 300, colors })
    const [keep, letters, words, evict] = await Promise.all(
      (["keep", "letters", "words", "evict"] as const).map(svg),
    )
    const played300 = played(settings("keep"), 300)
    // Clear leaves the entries in the atlas, whole: their letters
    expect(paths(evict)).toBe(played300.letters)
    // Words and Letters leave old words or letters too, Keep pieces of them
    expect(paths(words)).toBeGreaterThanOrEqual(played300.letters)
    expect(paths(letters)).toBeGreaterThanOrEqual(played300.letters)
    expect(paths(keep)).toBeGreaterThan(paths(letters))
    // and far fewer than everything drawn
    expect(paths(keep)).toBeLessThan(played300.drawn / 1.5)
    // Keep's pieces are cut, not clipped
    for (const text of [keep, letters, words, evict]) {
      expect(text).not.toContain("<clipPath")
      expect(text).not.toContain("clip-path")
    }
  })
})
