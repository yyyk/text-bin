import type { Font, Variations } from "text-shape"
import type { AtlasFont } from "@/lib/atlas/font"
import { intersect, subtract, type Rect } from "@/lib/atlas/rect"
import type { Settings } from "@/lib/atlas/settings"
import type { TextContext } from "@/lib/atlas/text"
import type { Colors } from "@/lib/preview/draw"
import { createPlayer } from "@/lib/preview/player"

/** A glyph drawn into the atlas, as recorded: what of it is still visible */
interface RecordedGlyph {
  id: number
  variations: Variations
  /** Its transform: font units to atlas px (scale and offset; y down) */
  scale: number
  x: number
  y: number
  /** Its outline's box in the atlas */
  box: Rect
  /** What of the box hasn't been cleared since: [box] until something is */
  visible: Rect[]
}

/**
 * A TextContext that records glyphs rather than drawing them, keeping only
 * what's still visible: a clearRect cuts what it covers from the glyphs
 * under it (dropping those with nothing left), and a glyph erased by its
 * shape (destination-out, the Letters and Words eviction) goes. Only
 * glyphs: the atlas has to draw with text-shape (render "text-shape").
 */
export function createRecorder(font: Font) {
  // The transform: a scale and an offset (the atlas only translates and
  // scales)
  let t = { a: 1, d: 1, e: 0, f: 0 }
  const stack: (typeof t & { op: GlobalCompositeOperation })[] = []
  let op: GlobalCompositeOperation = "source-over"
  let glyphs: RecordedGlyph[] = []
  const boxes = new Map<string, Rect | null>()

  // A glyph's outline box in font units (y down), or null when it's empty
  const outlineBox = (id: number, variations: Variations) => {
    const key = `${id}|${JSON.stringify(variations)}`
    if (!boxes.has(key)) {
      boxes.set(key, pointsBox(font.outline(id, variations, { flipY: true })))
    }
    return boxes.get(key)!
  }

  const context: TextContext = {
    font: "",
    textBaseline: "alphabetic",
    textRendering: "auto",
    fontKerning: "auto",
    letterSpacing: "0px",
    fillStyle: "black",
    lineWidth: 1,
    get globalCompositeOperation() {
      return op
    },
    set globalCompositeOperation(value) {
      op = value
    },
    save() {
      stack.push({ ...t, op })
    },
    restore() {
      const saved = stack.pop()
      if (saved) ({ op, ...t } = saved)
    },
    translate(x: number, y: number) {
      t = { ...t, e: t.e + t.a * x, f: t.f + t.d * y }
    },
    scale(x: number, y: number) {
      t = { ...t, a: t.a * x, d: t.d * y }
    },
    getTransform() {
      return { a: t.a } as DOMMatrix
    },
    clearRect(x: number, y: number, w: number, h: number) {
      const cut = { x: t.e + t.a * x, y: t.f + t.d * y, w: t.a * w, h: t.d * h }
      glyphs = glyphs.filter((glyph) => {
        if (!intersect(glyph.box, cut)) return true
        glyph.visible = glyph.visible.flatMap((r) => subtract(r, cut))
        return glyph.visible.length > 0
      })
    },
    fillGlyph(id: number, variations: Variations) {
      const scale = t.a
      const [x, y] = [t.e, t.f]
      if (op === "destination-out") {
        // erased by its shape: the same glyph at the same place
        glyphs = glyphs.filter(
          (g) => !(g.id === id && same(g.x, x) && same(g.y, y)),
        )
        return
      }
      const box = outlineBox(id, variations)
      if (!box) return
      const atlasBox = {
        x: x + box.x * scale,
        y: y + box.y * scale,
        w: box.w * scale,
        h: box.h * scale,
      }
      glyphs.push({
        id,
        variations,
        scale,
        x,
        y,
        box: atlasBox,
        visible: [atlasBox],
      })
    },
    fillText() {
      throw new Error("The SVG export records glyph outlines only")
    },
    fill() {
      throw new Error("The SVG export records glyph outlines only")
    },
    stroke() {},
  }
  return { context, glyphs: (): readonly RecordedGlyph[] => glyphs }
}

/**
 * The atlas at frame `position` (counted from the start over all cycles) as
 * an SVG of its size, in `colors`: replayed from frame 0 into a recorder
 * (createRecorder), so it has only what's visible. Glyphs as outlines, so
 * it's drawn with text-shape whatever the Render setting (packing is the
 * same). A glyph partly cleared (Keep) is cut to what's left of it
 * (vector-path-tools' booleanOp, loaded only then), so every glyph is a
 * plain path; clipped instead, if cutting one fails.
 */
export async function atlasToSvg({
  settings,
  font,
  position,
  colors,
}: {
  settings: Settings
  font: AtlasFont
  position: number
  colors: Colors
}): Promise<string> {
  let recorder = createRecorder(font.font)
  const player = createPlayer(
    () => {
      recorder = createRecorder(font.font)
      return recorder.context
    },
    { ...settings, text: { ...settings.text, render: "text-shape" } },
    font,
  )
  player.seek(position)

  const glyphs = recorder.glyphs().map((glyph) => ({
    ...glyph,
    commands: placed(
      font.font.outline(glyph.id, glyph.variations, { flipY: true }),
      glyph,
    ),
    whole: glyph.visible.length === 1 && glyph.visible[0] === glyph.box,
  }))
  const tools = glyphs.every((glyph) => glyph.whole)
    ? null
    : await import("vector-path-tools")

  const { width, height } = settings.atlas
  const clips: string[] = []
  const paths: string[] = []
  for (const glyph of glyphs) {
    if (glyph.whole || !tools) {
      paths.push(`<path d="${pathData(glyph.commands)}"/>`)
      continue
    }
    try {
      const cut = tools.booleanOp(
        glyph.commands,
        glyph.visible.flatMap(rectCommands),
        "intersection",
      )
      // nothing of its ink where it's still visible
      if (cut.length > 0) paths.push(`<path d="${pathData(cut)}"/>`)
    } catch (e) {
      if (!(e instanceof tools.BooleanOpError)) throw e
      const id = `c${clips.length}`
      clips.push(
        `<clipPath id="${id}">${glyph.visible
          .map(
            (r) =>
              `<rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}"/>`,
          )
          .join("")}</clipPath>`,
      )
      paths.push(
        `<path d="${pathData(glyph.commands)}" clip-path="url(#${id})"/>`,
      )
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    colors.background !== null &&
      `<rect width="${width}" height="${height}" fill="${colors.background}"/>`,
    clips.length > 0 && `<defs>${clips.join("")}</defs>`,
    `<g fill="${colors.color}">`,
    ...paths,
    `</g>`,
    `</svg>`,
    "",
  ]
    .filter((line) => line !== false)
    .join("\n")
}

type Commands = ReturnType<Font["outline"]>

/** A glyph outline (font units, y down) moved into the atlas, in px */
function placed(
  commands: Commands,
  { scale, x, y }: { scale: number; x: number; y: number },
): Commands {
  const px = (v: number) => x + v * scale
  const py = (v: number) => y + v * scale
  return commands.map((c) => {
    switch (c.type) {
      case "moveTo":
      case "lineTo":
        return { type: c.type, x: px(c.x), y: py(c.y) }
      case "quadTo":
        return {
          type: c.type,
          cx: px(c.cx),
          cy: py(c.cy),
          x: px(c.x),
          y: py(c.y),
        }
      case "cubicTo":
        return {
          type: c.type,
          c1x: px(c.c1x),
          c1y: py(c.c1y),
          c2x: px(c.c2x),
          c2y: py(c.c2y),
          x: px(c.x),
          y: py(c.y),
        }
      case "close":
        return c
    }
  })
}

/** A rectangle as a closed path, clockwise on screen */
function rectCommands(r: Rect): Commands {
  return [
    { type: "moveTo", x: r.x, y: r.y },
    { type: "lineTo", x: r.x + r.w, y: r.y },
    { type: "lineTo", x: r.x + r.w, y: r.y + r.h },
    { type: "lineTo", x: r.x, y: r.y + r.h },
    { type: "close" },
  ]
}

/** Path commands as SVG path data */
function pathData(commands: Commands) {
  return commands
    .map((c) => {
      switch (c.type) {
        case "moveTo":
          return `M${n(c.x)} ${n(c.y)}`
        case "lineTo":
          return `L${n(c.x)} ${n(c.y)}`
        case "quadTo":
          return `Q${n(c.cx)} ${n(c.cy)} ${n(c.x)} ${n(c.y)}`
        case "cubicTo":
          return `C${n(c.c1x)} ${n(c.c1y)} ${n(c.c2x)} ${n(c.c2y)} ${n(c.x)} ${n(c.y)}`
        case "close":
          return "Z"
      }
    })
    .join("")
}

/** The box around an outline's points (control points too), or null */
function pointsBox(commands: Commands): Rect | null {
  const xs: number[] = []
  const ys: number[] = []
  for (const c of commands) {
    if (c.type === "close") continue
    xs.push(c.x)
    ys.push(c.y)
    if (c.type === "quadTo") {
      xs.push(c.cx)
      ys.push(c.cy)
    } else if (c.type === "cubicTo") {
      xs.push(c.c1x, c.c2x)
      ys.push(c.c1y, c.c2y)
    }
  }
  if (xs.length === 0) return null
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

/** A number for the SVG: at most two decimals, no trailing zeros */
function n(v: number) {
  return String(Math.round(v * 100) / 100)
}

function same(a: number, b: number) {
  return Math.abs(a - b) < 1e-6
}
