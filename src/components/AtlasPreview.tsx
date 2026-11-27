import { useEffect, useMemo, useRef } from "react"
import { createMeasure, type AtlasFont } from "@/lib/atlas/font"
import type { Settings } from "@/lib/atlas/settings"
import { drawAtlas, drawOutlines } from "@/lib/preview/draw"
import { createFrameClock } from "@/lib/preview/frame-clock"
import { createPlayer, type Player } from "@/lib/preview/player"
import { createViews, viewSize } from "@/lib/preview/views"
import { appearanceColors, type Appearance } from "@/state/document"

/** The usual checkerboard behind transparent pixels */
const CHECKERBOARD = {
  backgroundImage:
    "conic-gradient(#e5e5e5 25%, #ffffff 0 50%, #e5e5e5 0 75%, #ffffff 0)",
  backgroundSize: "16px 16px",
}

/**
 * What the transport can ask of the preview. Requests are carried out on
 * the next screen frame; a seek replaces one that's still waiting, so
 * scrubbing only replays to where the slider is now.
 */
export interface PreviewControls {
  player: Player
  /** Moves to a frame, counted from the start over all cycles */
  seek: (position: number) => void
  step: () => void
  restart: () => void
}

/**
 * The atlas, playing: a new player (and engine) for every new `settings`,
 * stepped at exactly `fps` frames per second while `playing` (see
 * frame-clock.ts). The engine draws a black mask offscreen; it's shown in
 * `appearance`'s colours, so they change without starting over. With
 * `debug`, the camera views beside it, and with `outlines` the entries
 * outlined on it. `onControls` gets the controls of each new player.
 *
 * Everything is drawn at `scale` device pixels per px: the pixel ratio times
 * the size it's shown at, so it's sharp when fitted. A new scale replays the
 * same settings up to the same frame (the mask is drawn frame by frame).
 *
 * The drawing itself is in src/lib/preview (draw.ts, views.ts); this sets up
 * the canvases and the player, and runs the loop.
 */
export function AtlasPreview({
  settings,
  font,
  scale,
  appearance,
  playing,
  debug,
  outlines,
  onControls,
}: {
  settings: Settings
  /** The settings' font, loaded */
  font: AtlasFont
  /** Device pixels per px to draw at */
  scale: number
  appearance: Appearance
  playing: boolean
  debug: boolean
  outlines: boolean
  onControls?: (controls: PreviewControls) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const viewRefs = useRef<(HTMLCanvasElement | null)[]>([])
  // Read by the running loop, so they change without starting over
  const latest = useRef({ appearance, playing, debug, outlines, onControls })
  useEffect(() => {
    latest.current = { appearance, playing, debug, outlines, onControls }
  })
  // Where the last player was, to carry on there when only the scale changes
  const resume = useRef<{
    settings: Settings
    font: AtlasFont
    position: number
  } | null>(null)

  const { texts } = settings.text
  const { width, height } = settings.atlas
  // Each view fits its text at the largest size
  const viewSizes = useMemo(() => {
    const measure = createMeasure(font.font, settings.text.letterSpacing)
    return texts.map((text) => viewSize(measure, settings, text))
  }, [texts, settings, font])

  useEffect(() => {
    const display = canvasRef.current!
    const overlay = overlayRef.current!
    // The engine's atlas: black text on transparent, never shown as it is
    const mask = document.createElement("canvas")
    mask.width = display.width = overlay.width = Math.round(width * scale)
    mask.height = display.height = overlay.height = Math.round(height * scale)
    const ctx = mask.getContext("2d")!
    const displayCtx = display.getContext("2d")!
    const overlayCtx = overlay.getContext("2d")!

    // A fresh canvas for each start: old pixels would otherwise stay, as
    // evicted ones do
    const prepare = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, mask.width, mask.height)
      ctx.scale(scale, scale)
      return ctx
    }
    const player = createPlayer(prepare, settings, font)
    const previous = resume.current
    if (previous && previous.settings === settings && previous.font === font) {
      player.seek(previous.position)
    }
    const requests: { seek?: number; step?: boolean; restart?: boolean } = {}
    latest.current.onControls?.({
      player,
      seek: (position) => (requests.seek = position),
      step: () => (requests.step = true),
      restart: () => (requests.restart = true),
    })

    const views = createViews({
      texts,
      sizes: viewSizes,
      mask,
      scale,
      canvasAt: (i) => viewRefs.current[i] ?? null,
    })

    // A frame forward, starting over after a pass (see player.advance), so
    // it keeps playing
    const advance = () => {
      if (player.advance()) views.redrawAll()
    }

    const clock = createFrameClock(settings.timing.fps, performance.now())
    let request = requestAnimationFrame(function loop(now) {
      if (requests.restart || requests.seek !== undefined) views.redrawAll()
      if (requests.restart) player.restart()
      if (requests.seek !== undefined) player.seek(requests.seek)
      if (requests.step) advance()
      delete requests.restart
      delete requests.seek
      delete requests.step

      const { playing, debug, outlines, appearance } = latest.current
      if (playing) {
        for (let n = clock.due(now); n > 0; n--) advance()
      } else {
        clock.pause(now)
      }

      const engine = player.engine()
      const colors = appearanceColors(appearance)
      drawAtlas(displayCtx, mask, colors)
      // all views again the next time they're shown
      if (debug) views.draw(engine, colors)
      else views.redrawAll()
      drawOutlines(overlayCtx, engine, {
        scale,
        width,
        height,
        padding: settings.atlas.padding,
        show: debug && outlines,
      })
      request = requestAnimationFrame(loop)
    })
    return () => {
      cancelAnimationFrame(request)
      resume.current = { settings, font, position: player.position() }
    }
  }, [settings, font, texts, viewSizes, width, height, scale])

  return (
    <div className="flex items-center gap-6">
      {/* a checkerboard behind a transparent atlas, as image editors show it */}
      <div
        className="relative shadow-sm"
        style={{
          width,
          height,
          ...(appearance.transparent ? CHECKERBOARD : undefined),
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ width, height }}
        />
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0"
          style={{ width, height }}
        />
      </div>
      {debug && (
        <div className="flex flex-col items-center gap-3">
          {viewSizes.map((size, i) => (
            <canvas
              key={`${i}-${texts[i]}`}
              ref={(el) => {
                viewRefs.current[i] = el
              }}
              width={Math.round(size.width * scale)}
              height={Math.round(size.height * scale)}
              style={{
                width: size.width,
                height: size.height,
                ...(appearance.transparent ? CHECKERBOARD : undefined),
              }}
              className="shadow-sm"
            />
          ))}
        </div>
      )}
    </div>
  )
}
