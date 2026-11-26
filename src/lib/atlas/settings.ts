/**
 * How the size moves from one zoom gesture to the next:
 * - "random": to a random size anywhere between min and max
 * - "alternate": min → max → min → max …, like CSS animation-direction
 */
export type ZoomPattern = "random" | "alternate"

/**
 * Which texts a zoom gesture zooms:
 * - "single": the next text, in order; the others keep their size
 * - "all": all texts at once
 */
export type ZoomTexts = "single" | "all"

/**
 * With "all": whether the texts zoom to one shared size, or each to its own
 * (with "alternate" they all go min ↔ max, so it makes no difference)
 */
export type ZoomSizes = "same" | "different"

/**
 * How long one zoom animation takes:
 * - "fixed": always `duration`
 * - "linear": `duration` for min ↔ max, scaled by the size difference
 * - "ratio": `duration` for min ↔ max, scaled by the zoom ratio, so
 *   6 → 12px takes as long as 24 → 48px (like map apps)
 */
export type DurationMode = "fixed" | "linear" | "ratio"

/**
 * When text is packed into the atlas during a zoom animation:
 * - "every-frame": at the exact size of every frame (fractional px)
 * - "size-step": only when the size crosses a multiple of `sizeStep` px
 * - "end-only": only at the end; the app would scale the previous texture
 *   while animating
 */
export type PackStrategy = "every-frame" | "size-step" | "end-only"

/**
 * What gets packed into the atlas:
 * - "string": each text as a whole, once per size
 * - "word": each word (split at spaces) once per size, shared by all texts
 * - "letter": each letter once per size, shared by all texts (put back
 *   together without kerning)
 */
export type PackUnit = "string" | "word" | "letter"

/**
 * With "string" or "word", how a text (or word) wider than the atlas wraps
 * into pieces. The camera views put the pieces back together on one line.
 * - "none": it doesn't wrap: it isn't packed, and its view shows nothing
 * - "word": it wraps at spaces (and between letters when one word alone is
 *   too wide)
 * - "letter": it wraps between letters anywhere, so each piece is as wide as
 *   the atlas allows. With "word" packing it's the same as "word", since only
 *   single words are ever wrapped there
 */
export type Wrap = "none" | "word" | "letter"

/**
 * How text is drawn into the atlas (it's always measured with text-shape,
 * so packing is the same either way):
 * - "browser": the browser's own text drawing (canvas fillText), crisper at
 *   small sizes; may differ a little between browsers
 * - "text-shape": text-shape's glyph outlines, filled: the same in every
 *   browser, a little lighter at small sizes
 */
export type Renderer = "browser" | "text-shape"

export interface TextSettings {
  /** The texts that are zoomed in and out on */
  texts: string[]
  /** A font id: built in or uploaded (the app loads it, see src/lib/fonts.ts) */
  font: string
  render: Renderer
  /**
   * Space added after every letter, in em (× the font size), so it grows
   * and shrinks with the zoom; negative tightens. As in CSS, it also follows
   * the last letter, and turns optional ligatures off
   */
  letterSpacing: number
}

/**
 * How the sizes move:
 * - "zoom": the texts zoom in and out, in gestures (pattern, easing, timing)
 * - "scatter": no zooming; every frame packs texts from the list, each at a
 *   random size between min and max, as the first experiment (v0) did
 */
export type MotionMode = "zoom" | "scatter"

export interface MotionSettings {
  mode: MotionMode
  /** px; the font size zooms (or is picked) within these bounds */
  minSize: number
  maxSize: number
  /** With "zoom" */
  zoomTexts: ZoomTexts
  /** With "zoom" and zoomTexts "all" */
  zoomSizes: ZoomSizes
  pattern: ZoomPattern
  /** Zoom gestures after the start; with "random" the initial zoom-in isn't counted */
  gestures: number
  /** Any CSS animation-timing-function value (see easing.ts) */
  easing: string
  /** With "scatter": texts packed each frame */
  perFrame: number
  /** With "scatter": texts packed in one cycle */
  count: number
}

export interface TimingSettings {
  durationMode: DurationMode
  /** ms */
  duration: number
  /** ms; the shortest animation, after jitter */
  minDuration: number
  /** Random variation of each duration, as a fraction (0.2 = ±20%) */
  jitter: number
  /** ms between zoom animations */
  pause: number
  /** Frames per second: one engine step is 1 / fps seconds */
  fps: number
  /**
   * The zoom path returns to where it started and repeats: the camera views
   * loop seamlessly, the atlas keeps changing from cycle to cycle. Without
   * it the path plays once and the engine stops (the preview then starts
   * over, from an empty atlas)
   */
  loop: boolean
}

export interface AtlasSettings {
  /** px */
  width: number
  height: number
  strategy: PackStrategy
  /** px; with "size-step" */
  sizeStep: number
  unit: PackUnit
  wrap: Wrap
  /**
   * px of empty space kept around each entry (the slot is cleared with it),
   * so a scaled copy doesn't pick up the pixels of the entry next to it. 0
   * keeps the bleed, which is part of the look
   */
  padding: number
  /**
   * The same padding around the atlas's edges, so entries are as far from
   * the edges as from each other (2 × padding); without it, 1 × padding
   */
  padEdges: boolean
  /**
   * A text (or word, or letter) already in the atlas at the same size is
   * used again. Without it there's no cache: each new appearance is packed
   * again (a zooming text when its size changes, every scattered one), and
   * texts don't share pieces
   */
  reuse: boolean
}

export interface Settings {
  text: TextSettings
  motion: MotionSettings
  timing: TimingSettings
  atlas: AtlasSettings
  /** The same seed and settings always give the same result */
  seed: number
}

export const defaultSettings: Settings = {
  text: {
    texts: ["Text Bin"],
    font: "montserrat",
    render: "text-shape",
    letterSpacing: -0.1,
  },
  motion: {
    mode: "zoom",
    minSize: 12,
    maxSize: 60,
    zoomTexts: "all",
    zoomSizes: "different",
    pattern: "random",
    gestures: 4,
    easing: "linear",
    perFrame: 1,
    count: 500,
  },
  timing: {
    durationMode: "fixed",
    duration: 500,
    minDuration: 0,
    jitter: 0.2,
    pause: 150,
    fps: 60,
    loop: false,
  },
  atlas: {
    width: 600,
    height: 600,
    strategy: "every-frame",
    sizeStep: 1,
    unit: "string",
    wrap: "word",
    padding: 4,
    padEdges: false,
    reuse: true,
  },
  seed: 1,
}
