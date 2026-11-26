import { parseTimingFunction } from "@/lib/atlas/easing"
import { defaultSettings, type Settings } from "@/lib/atlas/settings"

/** The colours (hex, #rrggbb) */
export interface Appearance {
  /** Behind the text */
  background: string
  /** No background: the text on transparent, as a texture is */
  transparent: boolean
  /** The text's colour */
  color: string
}

/**
 * The document: every setting, as saved in a .json file. The engine's
 * settings, and how the atlas looks. The engine draws the text as a black
 * mask; the colours are applied when it's shown, so changing them doesn't
 * start the animation over.
 */
export interface Doc extends Settings {
  appearance: Appearance
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
}

/**
 * The settings the engine runs with, from the document as typed: empty
 * lines in the texts left out, and an easing that isn't valid CSS replaced
 * by "linear" (with the reason, for the panel to show).
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
      timing: doc.timing,
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
