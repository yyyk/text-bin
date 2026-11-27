import ShelfPack from "@mapbox/shelf-pack"
import { Typography, type PositionedGlyph, type TextLayout } from "text-shape"
import {
  createMeasure,
  missingLetters,
  textBox,
  type AtlasFont,
  type Measure,
} from "./font"
import type { Settings } from "./settings"
import { overlaps, rectArgs, union, type Rect } from "./rect"
import { breakLetters, graphemes, type TextContext } from "./text"

/** A piece of text packed into the atlas, at one font size */
export interface AtlasEntry {
  id: ShelfPack.ID
  text: string
  fontSize: number
  /** Where it is in the atlas, in px */
  x: number
  y: number
  w: number
  h: number
  /**
   * The size of its slot in the packer: a freed slot can only be reused by
   * text that fits inside it (shelf-pack never merges free slots)
   */
  slotW: number
  slotH: number
  /**
   * From the left of the box to where the text starts: more than 0 when its
   * ink starts left of it
   */
  textXOffset: number
  /** From the top of the box to the baseline (the font's ascent) */
  textYOffset: number
  /** The step it was packed in */
  packedAt: number
  /** The step it was last packed or used in */
  lastUsed: number
}

/**
 * A piece of a text as the camera views draw it: an atlas entry, or nothing
 * for a space between words or letters. `advance` is how far the next piece
 * starts, at `fontSize`.
 */
export interface Piece {
  entry: AtlasEntry | null
  advance: number
  fontSize: number
}

/** A text at the size it should be packed at */
export interface Visible {
  text: string
  fontSize: number
  /**
   * A new appearance, even at the size it already has (a scattered text):
   * without reuse, packed again
   */
  fresh?: boolean
}

export interface AtlasStats {
  /** Entries packed so far */
  packed: number
  /** Entries evicted to make room */
  evicted: number
  /** Times the atlas was full and started over */
  resets: number
  /** Entries in the atlas now */
  cached: number
}

/** shelf-pack's bins have the slot size too, but its types leave it out */
type Slot = ShelfPack.Bin & { maxw: number; maxh: number }

/**
 * An atlas: packs texts with shelf-pack and draws them into `ctx`, in px (the
 * caller scales the context for the pixel ratio), in black: a mask, coloured
 * when shown. Text is measured with text-shape and drawn by the browser or
 * text-shape (settings.text.render). When it's full, the least recently used
 * entries that free a big enough slot are evicted; when that isn't enough,
 * it starts over. Evicted pixels are left in place, like in a real texture:
 * only a new entry's own box is cleared; or evicted entries are cleared
 * whole (settings.atlas.evicted).
 */
export function createAtlas(
  ctx: TextContext,
  settings: Settings,
  font: AtlasFont,
) {
  const { width, height, unit, padding, reuse, evicted } = settings.atlas
  const margin = edgeMargin(settings)
  const { letterSpacing } = settings.text
  const measure = createMeasure(font.font, letterSpacing)
  const shaper = new Typography().textFont(font.font, 16)

  // Packed inside the margin; entries are moved in by it
  const packer = new ShelfPack(
    Math.max(0, width - 2 * margin),
    Math.max(0, height - 2 * margin),
  )
  // Keyed by `${fontSize}|${text}`
  const entries = new Map<string, AtlasEntry>()
  // The most recently placed or used pieces of each text; the views draw
  // from these
  const latest = new Map<string, Piece[]>()
  const stats = { packed: 0, evicted: 0, resets: 0 }
  let tick = 0
  // Without reuse, entries of the same text and size are kept apart
  let copies = 0
  // Unless evicted is "keep": old entries (evicted, or dropped by a reset)
  // still drawn, with the parts of them not cleared yet: each letter or
  // word (by parts), or the whole slot with "evict". A new entry clears the
  // parts its slot touches, each whole, before it's drawn. `bounds` is
  // around all of an entry's parts
  let stale: { bounds: Rect; parts: OldPart[] }[] = []
  // Old text cleared letter by letter or word by word, not by slot
  const byParts = evicted !== "keep" && evicted !== "evict"
  // With byParts: each entry's parts as drawn, for when it's old
  const parts = new Map<AtlasEntry, OldPart[]>()

  // The least recently used entry not visible in this step, whose slot is
  // big enough for a w × h request
  function findVictim(w: number, h: number) {
    let victim: [string, AtlasEntry] | null = null
    for (const [key, entry] of entries) {
      if (entry.lastUsed === tick) continue
      if (entry.slotW < w || entry.slotH < h) continue
      if (!victim || entry.lastUsed < victim[1].lastUsed) {
        victim = [key, entry]
      }
    }
    return victim
  }

  function evict(key: string, entry: AtlasEntry) {
    const bin = packer.getBin(entry.id)
    if (bin) packer.unref(bin)
    entries.delete(key)
    if (evicted === "evict") ctx.clearRect(...rectArgs(slotOf(entry)))
    if (byParts) retire(entry)
    parts.delete(entry)
    for (const [text, pieces] of latest) {
      if (pieces.some((piece) => piece.entry === entry)) latest.delete(text)
    }
    stats.evicted++
  }

  // An entry's slot: its box and the padding around it
  function slotOf(entry: AtlasEntry): Rect {
    return {
      x: entry.x - padding,
      y: entry.y - padding,
      w: entry.w + 2 * padding,
      h: entry.h + 2 * padding,
    }
  }

  // An entry becomes old (see stale)
  function retire(entry: AtlasEntry) {
    const slot = slotOf(entry)
    const old = byParts
      ? (parts.get(entry) ?? [])
      : [{ box: slot, clear: () => ctx.clearRect(...rectArgs(slot)) }]
    if (old.length === 0) return
    stale.push({ bounds: old.map((p) => p.box).reduce(union), parts: old })
  }

  // An entry's parts, as evicted says, from its text-shape layout: each
  // letter or each word, with the box that decides whether a new entry
  // touches it: the letters' ink, out to whole device pixels at
  // `pixelRatio` and one more (antialiasing reaches into the next pixel),
  // and the whole line's height (the entry's box), so short letters (e, x)
  // go with tall ones (T, t) under new text rather than being left alone. Each part is cleared by its
  // letters' own shapes, so the letters around it stay whole (their boxes
  // overlap: kerning, letter spacing)
  function oldParts(
    entry: AtlasEntry,
    layout: TextLayout,
    pixelRatio: number,
  ): OldPart[] {
    const out = (v: number, dir: -1 | 1) =>
      (dir < 0
        ? Math.floor(v * pixelRatio) - 1
        : Math.ceil(v * pixelRatio) + 1) / pixelRatio
    const { scale, variations } = layout
    const word = wordIndexes(entry.text)
    const groups = new Map<number, { box: Rect; glyphs: PositionedGlyph[] }>()
    let letter = 0
    layout.lines.forEach((line) =>
      line.glyphs.forEach((glyph) => {
        if (!glyph.bbox) return // spaces
        // font units, y up, from the pen position on the baseline
        const { x_min, y_min, x_max, y_max } = glyph.bbox
        let top = out(glyph.y - y_max * scale, -1)
        let bottom = out(glyph.y - y_min * scale, 1)
        // the line exactly: grown, it would touch the row above or below
        top = Math.min(top, entry.y)
        bottom = Math.max(bottom, entry.y + entry.h)
        const x = out(glyph.x + x_min * scale, -1)
        const box = {
          x,
          y: top,
          w: out(glyph.x + x_max * scale, 1) - x,
          h: bottom - top,
        }
        const key = evicted === "words" ? (word[glyph.cluster] ?? 0) : letter++
        const group = groups.get(key)
        if (group) {
          group.box = union(group.box, box)
          group.glyphs.push(glyph)
        } else {
          groups.set(key, { box, glyphs: [glyph] })
        }
      }),
    )
    return [...groups.values()].map(({ box, glyphs }) => ({
      box,
      clear: () => {
        for (const glyph of glyphs) {
          ctx.save()
          ctx.globalCompositeOperation = "destination-out"
          ctx.translate(glyph.x, glyph.y)
          ctx.scale(scale, scale)
          if (ctx.fillGlyph) {
            ctx.fillGlyph(glyph.id, variations)
          } else {
            const path = font.font.path(glyph.id, variations)
            ctx.fill(path)
            // and its antialiased edge: a device pixel around it
            ctx.lineWidth = 2 / (pixelRatio * scale)
            ctx.stroke(path)
          }
          ctx.restore()
        }
      },
    }))
  }

  // Clears the old parts `slot` touches, each whole. Only before an entry
  // is drawn there, so nothing newer is cleared with them: an old part that
  // touches a newer entry went when that one was drawn
  function clearUnder(slot: Rect) {
    stale = stale.filter((old) => {
      if (!overlaps(old.bounds, slot)) return true
      old.parts = old.parts.filter((part) => {
        if (!overlaps(part.box, slot)) return true
        part.clear()
        return false
      })
      return old.parts.length > 0
    })
  }

  function drawEntry(entry: AtlasEntry) {
    const slot = slotOf(entry)
    clearUnder(slot)
    // the padding too, so the space around the entry is empty
    ctx.clearRect(...rectArgs(slot))
    ctx.fillStyle = "black"
    // The baseline on a whole device pixel, so the text's horizontal edges
    // (baseline, x-height, cap height) are as crisp as they can be
    const pixelRatio = ctx.getTransform().a || 1
    const baseline =
      Math.round((entry.y + entry.textYOffset) * pixelRatio) / pixelRatio
    const start = entry.x + entry.textXOffset
    const layout = () =>
      shaper
        .textSize(entry.fontSize)
        .textProperty("letterSpacing", letterSpacing * entry.fontSize)
        .layout(entry.text, start, baseline)
    if (byParts) parts.set(entry, oldParts(entry, layout(), pixelRatio))

    if (settings.text.render === "browser") {
      ctx.textBaseline = "alphabetic"
      ctx.textRendering = "optimizeLegibility"
      ctx.fontKerning = "normal"
      ctx.font = `${entry.fontSize}px "${font.family}"`
      // the same spacing text-shape measured with
      ctx.letterSpacing = `${letterSpacing * entry.fontSize}px`
      ctx.fillText(entry.text, start, baseline)
      return
    }
    const shaped = layout()
    for (const line of shaped.lines) {
      for (const glyph of line.glyphs) {
        if (!glyph.bbox) continue // spaces
        ctx.save()
        ctx.translate(glyph.x, glyph.y)
        ctx.scale(shaped.scale, shaped.scale)
        if (ctx.fillGlyph) ctx.fillGlyph(glyph.id, shaped.variations)
        else ctx.fill(font.font.path(glyph.id, shaped.variations))
        ctx.restore()
      }
    }
  }

  // Packs one piece of text, or with reuse finds it already packed; null
  // when the atlas is full and nothing can be evicted
  function placeEntry(text: string, fontSize: number) {
    const key = reuse
      ? `${fontSize}|${text}`
      : `${fontSize}|${text}|${copies++}`
    const cached = entries.get(key)
    if (cached) {
      cached.lastUsed = tick
      return cached
    }

    const { w, left } = textBox(measure, text, fontSize)
    const h = Math.ceil(measure.ascent(fontSize) + measure.descent(fontSize))
    // the slot has the padding around the box
    const slotW = w + 2 * padding
    const slotH = h + 2 * padding

    let rect = packer.packOne(slotW, slotH)
    while (!rect) {
      const victim = findVictim(slotW, slotH)
      if (!victim) return null
      evict(...victim)
      rect = packer.packOne(slotW, slotH)
    }

    const slot = rect as Slot
    const entry: AtlasEntry = {
      id: rect.id,
      text,
      fontSize,
      x: margin + rect.x + padding,
      y: margin + rect.y + padding,
      w,
      h,
      slotW: slot.maxw,
      slotH: slot.maxh,
      textXOffset: -left,
      textYOffset: measure.ascent(fontSize),
      packedAt: tick,
      lastUsed: tick,
    }
    entries.set(key, entry)
    stats.packed++
    drawEntry(entry)
    return entry
  }

  // Places all pieces of a text; false when one of them doesn't fit
  function placeText(text: string, fontSize: number, fresh = false) {
    // Without reuse, a text still showing at this size keeps its pieces;
    // anything else is a new appearance, packed again
    const current = latest.get(text)
    if (!reuse && !fresh && current?.[0]?.fontSize === fontSize) {
      for (const piece of current) if (piece.entry) piece.entry.lastUsed = tick
      return true
    }
    const pieces: Piece[] = []
    for (const piece of splitText(measure, settings, text, fontSize)) {
      const advance = measure.width(piece, fontSize)
      // Spaces between words or letters have nothing to draw, so they
      // aren't packed
      if (unit !== "string" && !piece.trim()) {
        pieces.push({ entry: null, advance, fontSize })
        continue
      }
      const entry = placeEntry(piece, fontSize)
      if (!entry) return false
      pieces.push({ entry, advance, fontSize })
    }
    latest.set(text, pieces)
    return true
  }

  // Whether all pieces of a text would fit into an empty atlas
  function fitsAtlas(text: string, fontSize: number) {
    const lineHeight = measure.ascent(fontSize) + measure.descent(fontSize)
    const room = innerWidth(settings)
    return (
      lineHeight + 2 * padding + 2 * margin <= height &&
      splitText(measure, settings, text, fontSize).every(
        (piece) => textBox(measure, piece, fontSize).w <= room,
      )
    )
  }

  /** Makes sure every visible text is in the atlas at its size */
  function step(visible: Visible[]) {
    tick++

    for (const { text, fontSize, fresh } of visible) {
      // Too big even for an empty atlas (see textWarnings): skip it
      // rather than start over for nothing
      if (!fitsAtlas(text, fontSize)) {
        latest.delete(text)
        continue
      }
      if (placeText(text, fontSize, fresh)) continue

      // Full: start over on top of the old pixels and place what's visible
      // again
      stats.resets++
      if (evicted !== "keep") entries.forEach(retire)
      parts.clear()
      packer.clear()
      entries.clear()
      latest.clear()
      for (const { text, fontSize, fresh } of visible) {
        if (fitsAtlas(text, fontSize)) placeText(text, fontSize, fresh)
      }
      break
    }
  }

  return {
    step,
    /** A text's pieces as last packed or used, if it's in the atlas */
    pieces: (text: string) => latest.get(text),
    stats: (): AtlasStats => ({ ...stats, cached: entries.size }),
    /** The entries in the atlas now (for debug outlines) */
    entries: (): Iterable<AtlasEntry> => entries.values(),
    /** The number of the last step: entries packed in it have it as packedAt */
    lastStep: () => tick,
  }
}

export type Atlas = ReturnType<typeof createAtlas>

/**
 * The pieces to pack for a text:
 * - "letter": its letters
 * - "word": its words and the spaces between them; when wrapping, words too
 *   wide for the atlas are broken between letters
 * - "string": the whole text when it fits the atlas width (inside the
 *   padding); otherwise with
 *   wrap "letter" pieces as wide as possible broken between letters, and with
 *   wrap "word" as few pieces as possible broken at spaces and, for words
 *   that are too wide on their own, between letters
 */
export function splitText(
  measure: Measure,
  settings: Settings,
  text: string,
  fontSize: number,
): string[] {
  const { unit, wrap } = settings.atlas
  const width = innerWidth(settings)
  if (unit === "letter") return graphemes(text)
  const fits = (piece: string) => textBox(measure, piece, fontSize).w <= width
  const tokens = text.split(/(\s+)/).filter(Boolean)
  if (unit === "word") {
    return tokens.flatMap((token) =>
      !token.trim() || wrap === "none" || fits(token)
        ? [token]
        : breakLetters(measure, token, fontSize, width),
    )
  }
  if (wrap === "none" || fits(text)) return [text]
  if (wrap === "letter") return breakLetters(measure, text, fontSize, width)

  const pieces: string[] = []
  let current = ""
  // Spaces stay in the pieces, so the widths add up to the whole text
  for (const token of tokens) {
    if (fits(current + token)) {
      current += token
      continue
    }
    if (current) pieces.push(current)
    current = ""
    if (fits(token)) {
      current = token
    } else {
      const letters = breakLetters(measure, token, fontSize, width)
      current = letters.pop() ?? ""
      pieces.push(...letters)
    }
  }
  if (current) pieces.push(current)
  return pieces
}

/**
 * What's wrong with the texts, one message each, for the panel to show:
 * letters the font has no shape for, and texts wider (or taller) than the
 * atlas at the largest size, with the size from which on.
 */
export function textWarnings(settings: Settings, font: AtlasFont): string[] {
  const measure = createMeasure(font.font, settings.text.letterSpacing)
  const { maxSize } = settings.motion
  const { height, unit, wrap, padding } = settings.atlas
  const margin = edgeMargin(settings)
  const width = innerWidth(settings)
  const warnings: string[] = []
  for (const text of settings.text.texts) {
    const missing = missingLetters(font.font, text)
    if (missing.length > 0) {
      warnings.push(
        `"${text}": ${font.name} has no ${missing.map((l) => `"${l}"`).join(", ")}`,
      )
    }
    // With "word" the widest word counts
    const w =
      unit === "word"
        ? Math.max(
            ...text
              .split(/\s+/)
              .map((word) => textBox(measure, word, maxSize).w),
          )
        : textBox(measure, text, maxSize).w
    const lineHeight = measure.ascent(maxSize) + measure.descent(maxSize)
    if (lineHeight + 2 * padding + 2 * margin > height) {
      warnings.push(
        `"${text}" is taller than the atlas at ${maxSize}px and won't be shown at that size`,
      )
    }
    if (unit === "letter" || w <= width) continue
    // The width grows with the font size
    const limit = Math.floor((maxSize * width) / w)
    warnings.push(
      wrap !== "none"
        ? `"${text}" is wider than the atlas above about ${limit}px and will wrap into pieces`
        : `"${text}" is wider than the atlas above about ${limit}px and won't be shown at those sizes`,
    )
  }
  return warnings
}

/**
 * For each UTF-16 offset in `text`, which word it's in (counted from 0;
 * spaces belong to the word before them)
 */
function wordIndexes(text: string): number[] {
  const indexes: number[] = []
  let word = 0
  let inSpace = false
  for (const char of text.split("")) {
    const space = /\s/.test(char)
    if (inSpace && !space) word++
    inSpace = space
    indexes.push(word)
  }
  return indexes
}

/** A part of an old entry, still drawn: where it is, and how to clear it */
interface OldPart {
  box: Rect
  clear: () => void
}

/** The widest a piece can be: the atlas's width, less the padding (and margin) */
function innerWidth(settings: Settings) {
  const { width, padding } = settings.atlas
  return width - 2 * padding - 2 * edgeMargin(settings)
}

/** Space kept along the atlas's edges: the padding, with padEdges */
function edgeMargin(settings: Settings) {
  return settings.atlas.padEdges ? settings.atlas.padding : 0
}
