import { Typography, type Font } from "text-shape"
import { graphemes } from "./text"

/**
 * A font as the atlas uses it: text-shape's, which measures (and draws, with
 * the text-shape renderer), and a CSS family registered from the same file,
 * for the browser renderer.
 */
export interface AtlasFont {
  font: Font
  /** The CSS font-family the same file is registered under */
  family: string
  /** For messages */
  name: string
}

/**
 * Text measured with text-shape: the same numbers in every browser and in
 * Node, so a seed packs the same everywhere.
 */
export interface Measure {
  /**
   * How far `text` advances at `size` px (shaped: kerning, ligatures), letter
   * spacing included
   */
  width(text: string, size: number): number
  /**
   * Where the ink of `text` at `size` px is, from its left edge (x) to its
   * right (x + w), the origin at 0: it can stick out of the advance, e.g. the
   * last letter with negative letter spacing
   */
  ink(text: string, size: number): { x: number; w: number }
  /** The font's ascent at `size` px: from the top of a line to its baseline */
  ascent(size: number): number
  /** The font's descent at `size` px: from the baseline down */
  descent(size: number): number
}

/** Measuring with `font`, `letterSpacing` em after every letter */
export function createMeasure(font: Font, letterSpacing = 0): Measure {
  const t = new Typography().textFont(font, 16)
  const at = (size: number) =>
    t.textSize(size).textProperty("letterSpacing", letterSpacing * size)
  return {
    width: (text, size) => at(size).fontWidth(text),
    ink: (text, size) => {
      const { x, w } = at(size).textBounds(text, 0, 0)
      return { x, w }
    },
    ascent: (size) => t.textSize(size).fontAscent(),
    descent: (size) => t.textSize(size).fontDescent(),
  }
}

/**
 * The width of a text's box, and where it starts from the text's origin: the
 * advance and the ink, which can stick out of it (with negative letter
 * spacing the advance ends before the last letter does)
 */
export function textBox(measure: Measure, text: string, fontSize: number) {
  const ink = measure.ink(text, fontSize)
  const left = Math.min(0, Math.floor(ink.x))
  const right = Math.max(measure.width(text, fontSize), ink.x + ink.w)
  return { w: Math.ceil(right - left), left }
}

/**
 * The letters of `text` the font has no shape for, each once: missing from
 * the font, or there but empty while taking up room (a font may have empty
 * placeholders). Spaces don't count, nor zero-width characters (a zero-width
 * space is empty on purpose).
 */
export function missingLetters(font: Font, text: string): string[] {
  const measure = createMeasure(font)
  const missing = new Set<string>()
  for (const letter of graphemes(text)) {
    if (!letter.trim()) continue
    for (const char of letter) {
      const id = font.glyphId(char)
      if (
        id === undefined ||
        (font.outline(id).length === 0 && measure.width(char, 16) > 0)
      ) {
        missing.add(letter)
        break
      }
    }
  }
  return [...missing]
}
