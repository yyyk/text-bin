/** An easing curve: progress in [0, 1] → eased progress (can overshoot) */
export type Easing = (x: number) => number

/** The CSS keywords, as the functions they stand for */
const KEYWORDS: Record<string, string> = {
  linear: "cubic-bezier(0, 0, 1, 1)",
  ease: "cubic-bezier(0.25, 0.1, 0.25, 1)",
  "ease-in": "cubic-bezier(0.42, 0, 1, 1)",
  "ease-out": "cubic-bezier(0, 0, 0.58, 1)",
  "ease-in-out": "cubic-bezier(0.42, 0, 0.58, 1)",
  "step-start": "steps(1, jump-start)",
  "step-end": "steps(1, jump-end)",
}

/** The keywords, for a list of presets */
export const EASING_KEYWORDS = Object.keys(KEYWORDS)

/** A keyword written as the function it stands for; anything else as it is */
export function expandKeyword(value: string): string {
  return KEYWORDS[value.trim()] ?? value.trim()
}

/** Same curve as CSS cubic-bezier(x1, y1, x2, y2) */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const bez = (t: number, a: number, b: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3
  return (x) => {
    // The curve runs from (0, 0) to (1, 1): exact at the ends, which the
    // bisection would only get close to
    if (x <= 0) return 0
    if (x >= 1) return 1
    // Solve bez(t) = x for t by bisection, then return y at t
    let lo = 0
    let hi = 1
    let t = x
    for (let i = 0; i < 20; i++) {
      t = (lo + hi) / 2
      if (bez(t, x1, x2) < x) lo = t
      else hi = t
    }
    return bez(t, y1, y2)
  }
}

/** Same as CSS steps(n, jumpTerm) */
function steps(n: number, jumpTerm: string): Easing {
  const jumps =
    jumpTerm === "jump-both" ? n + 1 : jumpTerm === "jump-none" ? n - 1 : n
  const jumpAtStart =
    jumpTerm === "jump-start" ||
    jumpTerm === "start" ||
    jumpTerm === "jump-both"
  return (x) => {
    let step = Math.floor(x * n)
    if (jumpAtStart) step++
    return Math.min(jumps, Math.max(0, step)) / jumps
  }
}

/** Same as CSS linear(…): stops like "0, 0.25 75%, 1" or "0.5 25% 75%" */
function linearStops(args: string): Easing {
  const points: { y: number; x?: number }[] = []
  for (const stop of args.split(",")) {
    const [y, ...xs] = stop.trim().split(/\s+/)
    if (xs.length === 0) points.push({ y: Number(y) })
    for (const x of xs) points.push({ y: Number(y), x: parseFloat(x) / 100 })
  }
  // First and last stops default to 0% and 100%; positions never go back
  points[0].x ??= 0
  points[points.length - 1].x ??= 1
  let maxX = 0
  for (const point of points) {
    if (point.x !== undefined) {
      point.x = Math.max(point.x, maxX)
      maxX = point.x
    }
  }
  // Stops without a position are spread evenly between their neighbours
  for (let i = 1; i < points.length - 1; i++) {
    if (points[i].x !== undefined) continue
    let j = i
    while (points[j].x === undefined) j++
    const x0 = points[i - 1].x!
    const dx = (points[j].x! - x0) / (j - i + 1)
    for (let k = i; k < j; k++) points[k].x = x0 + dx * (k - i + 1)
  }

  return (x) => {
    let i = 1
    // At a jump (stops sharing a position) the later stop wins, like CSS
    while (i < points.length - 1 && x >= points[i].x!) i++
    const a = points[i - 1]
    const b = points[i]
    if (b.x === a.x) return x < a.x! ? a.y : b.y
    return a.y + ((b.y - a.y) * (x - a.x!)) / (b.x! - a.x!)
  }
}

/**
 * Any CSS animation-timing-function value as a curve: "linear", "ease",
 * "ease-in", "ease-out", "ease-in-out", "cubic-bezier(x1, y1, x2, y2)",
 * "steps(n, jump-start | jump-end | jump-none | jump-both | start | end)",
 * "step-start", "step-end", "linear(0, 0.25 75%, 1)". Throws for anything
 * else.
 */
export function parseTimingFunction(value: string): Easing {
  const css = expandKeyword(value)
  const match = css.match(/^([a-z-]+)\((.*)\)$/)
  const name = match?.[1]
  const args = match?.[2] ?? ""

  if (name === "cubic-bezier") {
    const [x1, y1, x2, y2] = args.split(",").map(Number)
    return cubicBezier(x1, y1, x2, y2)
  }
  if (name === "steps") {
    const [n, jumpTerm = "jump-end"] = args.split(",").map((s) => s.trim())
    return steps(Number(n), jumpTerm)
  }
  if (name === "linear") {
    return linearStops(args)
  }
  throw new Error(`Unsupported timing function: ${value}`)
}
