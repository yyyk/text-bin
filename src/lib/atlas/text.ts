import { textBox, type Measure } from "./font"

/**
 * What the atlas needs from a canvas to draw text, with either renderer. A
 * CanvasRenderingContext2D has all of it; tests pass a stand-in.
 */
export type TextContext = Pick<
  CanvasRenderingContext2D,
  | "font"
  | "textBaseline"
  | "textRendering"
  | "fontKerning"
  | "letterSpacing"
  | "fillStyle"
  | "clearRect"
  | "fillText"
  | "fill"
  | "stroke"
  | "lineWidth"
  | "globalCompositeOperation"
  | "save"
  | "restore"
  | "translate"
  | "scale"
  | "getTransform"
>

/** The text's letters (graphemes, so "é" or an emoji stays one letter) */
export function graphemes(text: string): string[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })
  return [...segmenter.segment(text)].map((s) => s.segment)
}

/** `text` broken between letters into pieces no wider than `maxWidth` */
export function breakLetters(
  measure: Measure,
  text: string,
  size: number,
  maxWidth: number,
): string[] {
  const pieces: string[] = []
  let current = ""
  for (const letter of graphemes(text)) {
    if (textBox(measure, current + letter, size).w <= maxWidth) {
      current += letter
    } else {
      if (current) pieces.push(current)
      current = letter
    }
  }
  if (current) pieces.push(current)
  return pieces
}
