import { parseTimingFunction } from "@/lib/atlas/easing"
import { defaultSettings, type Settings } from "@/lib/atlas/settings"
import type { VideoCodec, VideoSize } from "@/lib/export/video"

/** The colours (hex, #rrggbb) */
export interface Appearance {
  /** Behind the text */
  background: string
  /** No background: the text on transparent, as a texture is */
  transparent: boolean
  /** The text's colour */
  color: string
}

/** How the atlas is saved as an image */
export interface ExportOptions {
  /**
   * PNG (pixels), SVG (the glyphs as outlines, only what's visible), or a
   * video of the animation
   */
  format: "png" | "svg" | "video"
  /** PNG px per atlas px: 1 (the atlas's own size) or 2 */
  scale: number
  /**
   * The Background colour behind the text; off, transparent. Always
   * transparent with Appearance's Transparent.
   */
  background: boolean
  /** H.264 (MP4, no transparency) or VP9 (WebM) */
  videoCodec: VideoCodec
  /** The atlas's own size, or scaled to fit (see videoSize) */
  videoSize: VideoSize
  /** One pass from an empty atlas, or `videoSeconds` */
  videoLength: "pass" | "seconds"
  videoSeconds: number
}

/**
 * The document: every setting, as saved in a .json file. The engine's
 * settings, how the atlas looks, and how it's exported. The engine draws the text as a black
 * mask; the colours are applied when it's shown, so changing them doesn't
 * start the animation over.
 */
export interface Doc extends Settings {
  appearance: Appearance
  export: ExportOptions
}

/** The colours the atlas is shown in (background null when transparent) */
export function appearanceColors(appearance: Appearance) {
  return {
    color: appearance.color,
    background: appearance.transparent ? null : appearance.background,
  }
}

export const defaultDoc: Doc = {
  ...defaultSettings,
  appearance: { background: "#f2f2f2", transparent: false, color: "#1a1a1a" },
  export: {
    format: "png",
    scale: 1,
    background: true,
    videoCodec: "h264",
    videoSize: "atlas2",
    videoLength: "pass",
    videoSeconds: 10,
  },
}

/**
 * The settings the engine runs with, from the document as typed: empty
 * lines in the texts left out, and an easing that isn't valid CSS replaced
 * by "linear" (with the reason, for the panel to show). Loop is always off
 * for now (each pass starts over, empty): the atlas doesn't loop yet, only
 * the zoom path, so it isn't in the panel until a video can loop
 * seamlessly (TODO.md, Video).
 */
export function engineSettings(doc: Doc): {
  settings: Settings
  easingError: string | null
} {
  let easing = doc.motion.easing
  let easingError: string | null = null
  try {
    parseTimingFunction(easing)
  } catch {
    easingError = "Not a CSS timing function: playing with linear"
    easing = "linear"
  }
  return {
    settings: {
      timing: { ...doc.timing, loop: false },
      atlas: doc.atlas,
      seed: doc.seed,
      text: {
        ...doc.text,
        texts: doc.text.texts.filter((text) => text.trim()),
      },
      motion: { ...doc.motion, easing },
    },
    easingError,
  }
}
