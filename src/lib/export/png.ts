import type { AtlasFont } from "@/lib/atlas/font"
import type { Settings } from "@/lib/atlas/settings"
import { drawAtlas, type Colors } from "@/lib/preview/draw"
import { createPlayer } from "@/lib/preview/player"

/**
 * px: the largest side a PNG gets. Browsers refuse bigger canvases (Safari
 * at about 16384 px, and less for the total area), and the image comes out
 * empty without an error.
 */
export const MAX_PNG_SIDE = 16384

/**
 * The PNG's size in px for an atlas of `width` × `height` at `scale` (1×,
 * 2×): rounded as the preview's canvas is. Throws when it's too big to draw.
 */
export function pngSize(
  width: number,
  height: number,
  scale: number,
): { width: number; height: number } {
  const size = {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
  if (size.width > MAX_PNG_SIDE || size.height > MAX_PNG_SIDE) {
    throw new Error(
      `${size.width} × ${size.height} px is too big for a PNG (at most ${MAX_PNG_SIDE} px a side). Try 1×, or a smaller atlas.`,
    )
  }
  return size
}

/**
 * The atlas at frame `position` (counted from the start over all cycles) as
 * a PNG at `scale` px per atlas px, in `colors` (drawAtlas, as the preview).
 * Replayed from frame 0 at that scale, so the text is drawn crisp at it,
 * not enlarged from the preview's canvas (which is at the screen's scale).
 */
export async function atlasToPng({
  settings,
  font,
  position,
  colors,
  scale,
}: {
  settings: Settings
  font: AtlasFont
  position: number
  colors: Colors
  scale: number
}): Promise<Blob> {
  const size = pngSize(settings.atlas.width, settings.atlas.height, scale)
  // The engine's mask, black on transparent, as the preview's
  const mask = document.createElement("canvas")
  mask.width = size.width
  mask.height = size.height
  const maskCtx = mask.getContext("2d")
  const canvas = document.createElement("canvas")
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext("2d")
  if (!maskCtx || !ctx) {
    throw new Error("Couldn't draw the PNG.")
  }
  const player = createPlayer(
    () => {
      maskCtx.setTransform(1, 0, 0, 1, 0, 0)
      maskCtx.clearRect(0, 0, mask.width, mask.height)
      maskCtx.scale(scale, scale)
      return maskCtx
    },
    settings,
    font,
  )
  player.seek(position)
  drawAtlas(ctx, mask, colors)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  )
  if (!blob) {
    throw new Error("Couldn't make the PNG.")
  }
  return blob
}
