import type { Font } from "text-shape"
import type { AtlasFont } from "./font"
import type { Settings } from "./settings"
import type { TextContext } from "./text"

/**
 * A stand-in for a canvas in tests (Node has none): drawing does nothing but
 * count what's drawn. Measuring isn't the canvas's job (text-shape does it),
 * so tests use real fonts.
 */
export class TestContext implements TextContext {
  font = "10px sans-serif"
  textBaseline: CanvasTextBaseline = "alphabetic"
  textRendering: CanvasTextRendering = "auto"
  fontKerning: CanvasFontKerning = "auto"
  letterSpacing = "0px"
  fillStyle: string | CanvasGradient | CanvasPattern = "black"
  /** The texts drawn with fillText (the browser renderer) */
  drawn: string[] = []
  /** Glyph outlines filled (the text-shape renderer) */
  filled = 0

  /** The boxes cleared, [x, y, w, h] */
  cleared: number[][] = []

  clearRect(x: number, y: number, w: number, h: number) {
    this.cleared.push([x, y, w, h])
  }
  fillText(text: string) {
    this.drawn.push(text)
  }
  fill() {
    this.filled++
  }
  save() {}
  restore() {}
  translate() {}
  scale() {}
  getTransform() {
    return { a: 1 } as DOMMatrix
  }
}

/** A text-shape font as the atlas takes it, for tests */
export function testFont(font: Font, name = "Test"): AtlasFont {
  return { font, family: name, name }
}

/** Runs `fn` with a do-nothing Path2D (Node has none; text-shape builds one) */
export function withPath2D(fn: () => void) {
  const g = globalThis as { Path2D?: unknown }
  const original = g.Path2D
  g.Path2D = class {
    moveTo() {}
    lineTo() {}
    quadraticCurveTo() {}
    bezierCurveTo() {}
    closePath() {}
  }
  try {
    fn()
  } finally {
    g.Path2D = original
  }
}

/**
 * Settings for tests, fixed: the app's defaults (defaultSettings) can change
 * without changing what the tests check, the stats snapshot included.
 */
export const testSettings: Settings = {
  text: {
    texts: ["ABC", "DE", "FGHHHH"],
    font: "montserrat",
    render: "browser",
    letterSpacing: 0,
  },
  motion: {
    mode: "zoom",
    minSize: 6,
    maxSize: 36,
    zoomTexts: "all",
    zoomSizes: "different",
    pattern: "random",
    gestures: 30,
    easing: "linear",
    perFrame: 5,
    count: 1000,
  },
  timing: {
    durationMode: "ratio",
    duration: 500,
    minDuration: 0,
    jitter: 0.2,
    pause: 150,
    fps: 60,
    loop: true,
  },
  atlas: {
    width: 600,
    height: 600,
    strategy: "every-frame",
    sizeStep: 1,
    unit: "string",
    wrap: "word",
    padding: 0,
    padEdges: false,
    reuse: true,
  },
  seed: 1,
}
