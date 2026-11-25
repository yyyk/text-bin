import { defaultDoc, type Doc } from "./document"

/** Identifies the app's files; the version is for changes that need a migration. */
const FORMAT = "text-bin"
const VERSION = 1

/** The document as the text of a .json file. */
export function serializeDoc(doc: Doc): string {
  return (
    JSON.stringify({ format: FORMAT, version: VERSION, doc }, null, 2) + "\n"
  )
}

/**
 * The document in a .json file's text. Settings it doesn't have (an older
 * file) are the defaults; values of the wrong type are ignored, as are colours
 * that aren't hex (#rrggbb). Settings since renamed or moved are read from
 * their old place (see renamed). Throws for text that isn't one of the app's
 * files.
 */
export function parseDoc(text: string): Doc {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("This file isn't valid JSON.")
  }
  if (!isRecord(data) || data.format !== FORMAT || !isRecord(data.doc)) {
    throw new Error("This file isn't a text-bin document.")
  }
  if (typeof data.version !== "number" || data.version > VERSION) {
    throw new Error("This document is from a newer version of the app.")
  }
  return merge(defaultDoc, renamed(data.doc))
}

/**
 * A document from before settings were renamed or moved, with them where
 * they are now: the `zoom` section became `motion`, its `motion` became
 * `mode`, and the text section's `zoom` and `sizes` moved to the motion
 * section as `zoomTexts` and `zoomSizes`. What's already in its new place
 * stays.
 */
function renamed(doc: Record<string, unknown>): Record<string, unknown> {
  const { zoom, ...rest } = doc
  const motion: Record<string, unknown> = {
    ...(isRecord(zoom) ? zoom : {}),
    ...(isRecord(doc.motion) ? doc.motion : {}),
  }
  if ("motion" in motion && !("mode" in motion)) motion.mode = motion.motion
  delete motion.motion
  if (isRecord(doc.text)) {
    const { zoom: zoomTexts, sizes: zoomSizes } = doc.text
    if (zoomTexts !== undefined && !("zoomTexts" in motion)) {
      motion.zoomTexts = zoomTexts
    }
    if (zoomSizes !== undefined && !("zoomSizes" in motion)) {
      motion.zoomSizes = zoomSizes
    }
  }
  return { ...rest, motion }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const HEX = /^#[0-9a-f]{6}$/i

/** Settings that are one of a few values: anything else is ignored. */
const CHOICES: Record<string, readonly string[]> = {
  mode: ["zoom", "scatter"],
  zoomTexts: ["single", "all"],
  zoomSizes: ["same", "different"],
  pattern: ["random", "alternate"],
  durationMode: ["fixed", "linear", "ratio"],
  render: ["browser", "text-shape"],
  strategy: ["every-frame", "size-step", "end-only"],
  unit: ["string", "word", "letter"],
  wrap: ["none", "word", "letter"],
}

/**
 * `defaults` with what `value` has of the same shape: section by section,
 * keeping only values of the default's type. The texts keep their strings.
 */
function merge<T>(defaults: T, value: unknown, key = ""): T {
  if (Array.isArray(defaults)) {
    return Array.isArray(value)
      ? (value.filter((v) => typeof v === "string") as T)
      : defaults
  }
  if (!isRecord(defaults) || !isRecord(value)) {
    return sameType(defaults, value, key) ? (value as T) : defaults
  }
  const result: Record<string, unknown> = { ...defaults }
  for (const k of Object.keys(defaults)) {
    if (k in value) {
      result[k] = merge(defaults[k], value[k], k)
    }
  }
  return result as T
}

function sameType(defaults: unknown, value: unknown, key: string): boolean {
  if (typeof value !== typeof defaults) return false
  if (typeof value === "number") return Number.isFinite(value)
  // the colours go into the colour picker, which takes hex
  if (key === "background" || key === "color") return HEX.test(value as string)
  return !(key in CHOICES) || CHOICES[key].includes(value as string)
}
