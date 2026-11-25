import type { Rng } from "./random"
import type { Settings } from "./settings"

/**
 * One zoom gesture: the sizes of the `active` texts animate from `from` to
 * `to` (one size per text) over `frames`, then hold for `pauseFrames`.
 */
export interface Gesture {
  /** Indexes into the texts */
  active: number[]
  from: number[]
  to: number[]
  frames: number
  pauseFrames: number
}

/**
 * The whole zoom path, planned up front so it can repeat. All texts start at
 * the smallest size. `path` draws the target sizes, `jitter` the duration
 * jitter: separate streams, so changing one never changes the other.
 */
export function planGestures(
  settings: Settings,
  path: Rng,
  jitter: Rng,
): Gesture[] {
  const { texts } = settings.text
  const {
    minSize,
    maxSize,
    zoomTexts,
    zoomSizes,
    pattern,
    gestures: count,
  } = settings.motion
  const { fps, pause, loop } = settings.timing
  if (texts.length === 0) return []

  const all = texts.map((_, i) => i)
  const start = texts.map(() => minSize)
  const gestures: Gesture[] = []
  let sizes = start

  const randomSize = (min = minSize) => min + path() * (maxSize - min)
  const nextActive = () =>
    zoomTexts === "all" ? all : [gestures.length % texts.length]

  // The next gesture: zooms the active texts to `target(their size)`
  const add = (target: (size: number) => number, active = nextActive()) => {
    const to = [...sizes]
    if (zoomTexts === "all" && zoomSizes === "same") {
      const shared = target(sizes[active[0]])
      for (const i of active) to[i] = shared
    } else {
      for (const i of active) to[i] = target(sizes[i])
    }
    const duration = zoomDuration(
      settings,
      active.map((i) => [sizes[i], to[i]]),
      jitter,
    )
    gestures.push({
      active,
      from: sizes,
      to,
      frames: Math.max(1, Math.round((duration / 1000) * fps)),
      pauseFrames: Math.round((pause / 1000) * fps),
    })
    sizes = to
  }

  // It starts with a zoom-in: random sizes that only get bigger, filling the
  // atlas small to big, top to bottom. With "alternate" the first gesture
  // (min → max) already is the zoom-in
  while (pattern === "random" && sizes.some((size) => size < maxSize)) {
    add((size) => {
      const next = randomSize(size)
      return maxSize - next < 1 ? maxSize : next
    })
  }

  // Then zooming in and out according to the pattern
  for (let i = 0; i < count; i++) {
    add((size) =>
      pattern === "alternate"
        ? size === maxSize
          ? minSize
          : maxSize
        : randomSize(),
    )
  }

  // Back to the start, so the path can repeat; with "single" one text at a
  // time
  if (loop) {
    if (zoomTexts === "all") {
      add(() => start[0], all)
    } else {
      for (const i of all) {
        if (sizes[i] !== start[i]) add(() => start[i], [i])
      }
    }
  }
  return gestures
}

/**
 * A gesture's duration in ms. With several texts changing size, the largest
 * change decides; then the jitter, then the minimum.
 */
function zoomDuration(
  settings: Settings,
  changes: [from: number, to: number][],
  jitter: Rng,
) {
  const base = Math.max(
    ...changes.map(([from, to]) => baseDuration(settings, from, to)),
  )
  const factor = 1 + (jitter() * 2 - 1) * settings.timing.jitter
  return Math.max(settings.timing.minDuration, base * factor)
}

function baseDuration(settings: Settings, from: number, to: number) {
  const { durationMode, duration } = settings.timing
  const { minSize, maxSize } = settings.motion
  // The share of a full min ↔ max zoom this change is
  let amount: number
  switch (durationMode) {
    case "fixed":
      return duration
    case "linear":
      amount = Math.abs(to - from) / (maxSize - minSize)
      break
    case "ratio":
      amount = Math.abs(Math.log(to / from)) / Math.log(maxSize / minSize)
      break
  }
  return duration * amount
}

/** Frames in one pass through the gestures (one loop cycle) */
export function cycleFrames(gestures: Gesture[]) {
  return gestures.reduce((sum, g) => sum + g.frames + g.pauseFrames, 0)
}

/** A size between `from` and `to`; never below 1px */
export function lerpSize(from: number, to: number, t: number) {
  // Overshooting curves like cubic-bezier(0.5, -1, 0.5, 2) can go below 0
  return Math.max(1, from + (to - from) * t)
}

/** The font size actually packed for an animated size, per strategy */
export function snapFontSize(settings: Settings, animatedSize: number) {
  const size = Math.max(1, animatedSize)
  const { strategy, sizeStep } = settings.atlas
  switch (strategy) {
    case "every-frame":
      return Math.round(size * 100) / 100
    case "size-step":
    case "end-only":
      return Math.round(size / sizeStep) * sizeStep
  }
}
