import { parseTimingFunction } from "./easing"
import type { AtlasFont } from "./font"
import { createAtlas, textWarnings, type AtlasStats } from "./pack"
import { createRng, deriveSeed, RandomStream } from "./random"
import type { Settings } from "./settings"
import type { TextContext } from "./text"
import {
  cycleFrames,
  lerpSize,
  planGestures,
  snapFontSize,
  type Gesture,
} from "./timeline"

/**
 * One way the sizes move, frame by frame. `advance()` moves one frame and
 * says whether the cycle ended; `restart()` starts the next cycle the same
 * way (so a loop repeats exactly).
 */
interface MotionPlayer {
  frames: number
  advance(): boolean
  restart(): void
}

/**
 * The simulation: the sizes moved by the settings' motion (zooming in
 * gestures, or scattering texts at random sizes), one frame (1 / fps seconds) per
 * `advanceFrame()`, packing into an atlas drawn into `ctx`. The same settings
 * always give the same frames, so the live preview and a video render step
 * it the same way. `font` is the settings' font, loaded.
 */
export function createEngine(
  ctx: TextContext,
  settings: Settings,
  font: AtlasFont,
) {
  const { texts } = settings.text
  const atlas = createAtlas(ctx, settings, font)
  const all = texts.map((_, i) => i)

  // The font size of each text (animated, or the last it was packed at),
  // and the texts the current frame packs
  const sizes = texts.map(() => settings.motion.minSize)
  let active: readonly number[] = all

  const pack = (indexes: readonly number[]) =>
    atlas.step(
      indexes.map((i) => ({
        text: texts[i],
        fontSize: snapFontSize(settings, sizes[i]),
      })),
    )

  const motion =
    settings.motion.mode === "scatter"
      ? scatterMotion(settings, (placements) => {
          active = placements.map((p) => p.index)
          for (const p of placements) sizes[p.index] = p.size
          // each at its own size: a text picked twice in a frame is packed
          // at both
          atlas.step(
            placements.map((p) => ({
              text: texts[p.index],
              fontSize: snapFontSize(settings, p.size),
              // every scattered text is an appearance of its own
              fresh: true,
            })),
          )
        })
      : zoomMotion(settings, sizes, (indexes, packNow) => {
          active = indexes
          if (packNow) pack(indexes)
        })

  /** The frame within the current cycle */
  let frame = 0
  let cycle = 1
  let done = texts.length === 0 || motion.frames === 0
  // The stats when the last cycle ended
  let lastCycle: AtlasStats | null = null

  // Zooming starts with every text at the smallest size, so every view shows
  // something; scattering starts empty
  if (settings.motion.mode === "zoom") pack(all)

  /** Moves forward by exactly one frame */
  function advanceFrame() {
    if (done) return
    frame++
    if (!motion.advance()) return

    lastCycle = atlas.stats()
    if (settings.timing.loop) {
      motion.restart()
      frame = 0
      cycle++
    } else {
      done = true
    }
  }

  return {
    advanceFrame,
    /** A text's pieces in the atlas, for the camera views */
    pieces: atlas.pieces,
    stats: atlas.stats,
    entries: atlas.entries,
    lastStep: atlas.lastStep,
    /** The stats when the last cycle ended, once one has */
    lastCycle: () => lastCycle,
    /** Each text's font size: animated, or the last it was packed at */
    sizes: (): readonly number[] => sizes,
    /** Indexes of the texts the current frame zooms or packs */
    active: (): readonly number[] => active,
    frame: () => frame,
    cycle: () => cycle,
    /** Without loop, once a cycle has played */
    done: () => done,
    /** Frames in one cycle */
    cycleFrames: motion.frames,
    /** What's wrong with the texts (missing letters, too big), as messages */
    warnings: textWarnings(settings, font),
  }
}

export type Engine = ReturnType<typeof createEngine>

/**
 * Zooming: the gestures planned from the settings and seed, played frame by
 * frame. `onFrame` gets the texts the gesture zooms, and whether to pack them
 * now (with "end-only", only when a gesture ends).
 */
function zoomMotion(
  settings: Settings,
  sizes: number[],
  onFrame: (indexes: readonly number[], packNow: boolean) => void,
): MotionPlayer {
  const ease = parseTimingFunction(settings.motion.easing)
  const gestures: Gesture[] = planGestures(
    settings,
    createRng(deriveSeed(settings.seed, RandomStream.path)),
    createRng(deriveSeed(settings.seed, RandomStream.jitter)),
  )
  let gestureIndex = 0
  let gestureFrame = 0

  return {
    frames: cycleFrames(gestures),
    advance() {
      const gesture = gestures[gestureIndex]
      if (gestureFrame < gesture.frames) {
        const p = (gestureFrame + 1) / gesture.frames
        for (const i of gesture.active) {
          sizes[i] = lerpSize(gesture.from[i], gesture.to[i], ease(p))
        }
        onFrame(
          gesture.active,
          settings.atlas.strategy !== "end-only" || p === 1,
        )
      }
      gestureFrame++
      if (gestureFrame < gesture.frames + gesture.pauseFrames) return false
      gestureFrame = 0
      gestureIndex++
      return gestureIndex === gestures.length
    },
    restart() {
      gestureIndex = 0
      gestureFrame = 0
    },
  }
}

/**
 * Scatter, as in v0: every frame, `perFrame` texts picked at random from
 * the list, each at a random size between min and max, until `count` have
 * been packed in the cycle. The same seed picks the same every cycle.
 */
function scatterMotion(
  settings: Settings,
  onFrame: (placements: { index: number; size: number }[]) => void,
): MotionPlayer {
  const { texts } = settings.text
  const { minSize, maxSize, perFrame, count } = settings.motion
  const perStep = Math.max(1, Math.round(perFrame))
  const total = Math.max(0, Math.round(count))
  const newRng = () =>
    createRng(deriveSeed(settings.seed, RandomStream.placements))
  let rng = newRng()
  let placed = 0

  return {
    frames: Math.ceil(total / perStep),
    advance() {
      const placements: { index: number; size: number }[] = []
      for (let k = 0; k < perStep && placed < total; k++, placed++) {
        const index = Math.floor(rng() * texts.length)
        placements.push({ index, size: minSize + rng() * (maxSize - minSize) })
      }
      onFrame(placements)
      return placed >= total
    },
    restart() {
      rng = newRng()
      placed = 0
    },
  }
}
