import type { Engine } from "@/lib/atlas/engine"
import type { Measure } from "@/lib/atlas/font"
import type { Piece } from "@/lib/atlas/pack"
import type { Settings } from "@/lib/atlas/settings"
import { tint, type Colors } from "./draw"

/**
 * The camera views (a debug mode): each text drawn at its animated size
 * from what the atlas has for it, to see what a strategy does to the text.
 */

/** A view's size in px: its text at the largest size */
export function viewSize(measure: Measure, settings: Settings, text: string) {
  const size = settings.motion.maxSize
  return {
    width: Math.ceil(measure.width(text, size)),
    height: Math.ceil(measure.ascent(size) + measure.descent(size)),
  }
}

/**
 * Draws a text's pieces at `size`, centred, into a view of `width` × `height`
 * px, copied from `atlas` (the engine's black mask, whose pixels are
 * `pixelRatio` × px) and shown in `colors` (no background when it's null:
 * transparent). Pieces packed at another size are scaled; without pieces the
 * view shows only the background.
 */
export function drawView(
  ctx: CanvasRenderingContext2D,
  { width, height }: { width: number; height: number },
  pieces: readonly Piece[] | undefined,
  size: number,
  atlas: CanvasImageSource,
  pixelRatio: number,
  colors: Colors,
) {
  ctx.clearRect(0, 0, width, height)
  if (pieces?.length)
    drawPieces(ctx, width, height, pieces, size, atlas, pixelRatio)
  tint(ctx, width, height, colors)
}

/**
 * The views of all texts, drawn from `mask` at `scale` device pixels per px
 * into the canvases `canvasAt` gives (null while one isn't shown). Each draw
 * redraws only the texts being zoomed, unless the colours changed or
 * `redrawAll()` was called (the views were just shown, or the engine started
 * over): then all of them.
 */
export function createViews({
  texts,
  sizes,
  mask,
  scale,
  canvasAt,
}: {
  texts: readonly string[]
  sizes: readonly { width: number; height: number }[]
  mask: CanvasImageSource
  scale: number
  canvasAt: (index: number) => HTMLCanvasElement | null
}) {
  let all = true
  let lastColors = ""
  return {
    redrawAll() {
      all = true
    },
    draw(engine: Engine, colors: Colors) {
      const key = `${colors.background} ${colors.color}`
      if (key !== lastColors) all = true
      lastColors = key
      const indexes = all ? texts.map((_, i) => i) : engine.active()
      all = false
      for (const i of indexes) {
        const ctx = canvasAt(i)?.getContext("2d")
        if (!ctx) continue
        ctx.setTransform(scale, 0, 0, scale, 0, 0)
        drawView(
          ctx,
          sizes[i],
          engine.pieces(texts[i]),
          engine.sizes()[i],
          mask,
          scale,
          colors,
        )
      }
    },
  }
}

function drawPieces(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pieces: readonly Piece[],
  size: number,
  atlas: CanvasImageSource,
  pixelRatio: number,
) {
  const scale = size / pieces[0].fontSize
  const totalWidth = pieces.reduce((sum, p) => sum + p.advance * scale, 0)
  // Pieces side by side, the whole line centred
  let x = (width - totalWidth) / 2
  for (const { entry, advance } of pieces) {
    if (entry) {
      const w = entry.w * scale
      const h = entry.h * scale
      ctx.drawImage(
        atlas,
        entry.x * pixelRatio,
        entry.y * pixelRatio,
        entry.w * pixelRatio,
        entry.h * pixelRatio,
        x,
        (height - h) / 2,
        w,
        h,
      )
    }
    x += advance * scale
  }
}
