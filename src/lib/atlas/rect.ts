/** A rectangle in the atlas, in px */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function rectArgs(r: Rect): [number, number, number, number] {
  return [r.x, r.y, r.w, r.h]
}

export function overlaps(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  )
}

/** The smallest rectangle around `a` and `b` */
export function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  }
}

/** Where `a` and `b` overlap, or null */
export function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const w = Math.min(a.x + a.w, b.x + b.w) - x
  const h = Math.min(a.y + a.h, b.y + b.h) - y
  return w > 0 && h > 0 ? { x, y, w, h } : null
}

/**
 * `r` without `cut`: up to four rectangles, above, below, left and right of
 * it (none when `cut` covers `r`)
 */
export function subtract(r: Rect, cut: Rect): Rect[] {
  const i = intersect(r, cut)
  if (!i) return [r]
  const rest: Rect[] = [
    { x: r.x, y: r.y, w: r.w, h: i.y - r.y },
    { x: r.x, y: i.y + i.h, w: r.w, h: r.y + r.h - (i.y + i.h) },
    { x: r.x, y: i.y, w: i.x - r.x, h: i.h },
    { x: i.x + i.w, y: i.y, w: r.x + r.w - (i.x + i.w), h: i.h },
  ]
  return rest.filter((part) => part.w > EPSILON && part.h > EPSILON)
}

/** px: slivers thinner than this are nothing */
const EPSILON = 1e-6
