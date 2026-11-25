import type { Engine } from "@/lib/atlas/engine"

/** What the mask is shown in: the text colour, over a background or none */
export interface Colors {
  color: string
  /** null: transparent */
  background: string | null
}

/**
 * Colours what's drawn on `ctx` (black on transparent, as the engine's mask
 * is): the text in `colors.color`, then the background behind it, unless it's
 * transparent. Over the whole `width` × `height` area, in `ctx`'s units.
 */
export function tint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: Colors,
) {
  ctx.globalCompositeOperation = "source-in"
  ctx.fillStyle = colors.color
  ctx.fillRect(0, 0, width, height)
  if (colors.background !== null) {
    ctx.globalCompositeOperation = "destination-over"
    ctx.fillStyle = colors.background
    ctx.fillRect(0, 0, width, height)
  }
  ctx.globalCompositeOperation = "source-over"
}

/**
 * The atlas as shown: the engine's mask copied onto `ctx`'s canvas (of the
 * same size, in device pixels), coloured. For the preview, and for anything
 * that saves a frame.
 */
export function drawAtlas(
  ctx: CanvasRenderingContext2D,
  mask: CanvasImageSource,
  colors: Colors,
) {
  const { width, height } = ctx.canvas
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = "copy"
  ctx.drawImage(mask, 0, 0)
  tint(ctx, width, height, colors)
}

/**
 * The debug outlines, onto an overlay of the atlas's size at `scale` device
 * pixels per px: each entry's box, solid, filled when it was packed in the
 * last step; with padding, the padded slot around it (what's cleared when
 * the entry is drawn), dashed. With `show` false, only cleared.
 */
export function drawOutlines(
  ctx: CanvasRenderingContext2D,
  engine: Engine,
  {
    scale,
    width,
    height,
    padding,
    show,
  }: {
    scale: number
    width: number
    height: number
    padding: number
    show: boolean
  },
) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.clearRect(0, 0, width, height)
  if (!show) return
  const lastStep = engine.lastStep()
  ctx.lineWidth = 1 / scale
  for (const entry of engine.entries()) {
    if (entry.packedAt === lastStep) {
      ctx.fillStyle = "rgb(249 115 22 / 0.35)"
      ctx.fillRect(entry.x, entry.y, entry.w, entry.h)
    }
    if (padding > 0) {
      ctx.setLineDash([3 / scale, 3 / scale])
      ctx.strokeStyle = "rgb(59 130 246 / 0.35)"
      ctx.strokeRect(
        entry.x - padding,
        entry.y - padding,
        entry.w + 2 * padding,
        entry.h + 2 * padding,
      )
      ctx.setLineDash([])
    }
    ctx.strokeStyle = "rgb(59 130 246 / 0.6)"
    ctx.strokeRect(entry.x, entry.y, entry.w, entry.h)
  }
}
