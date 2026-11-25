import { useEffect, useState } from "react"

/**
 * The device pixel ratio, followed as it changes: when the window moves to
 * another screen, or with the browser's zoom. As in type-shards: a media
 * query on the current ratio says when, and a resize too (browser zoom).
 */
export function usePixelRatio() {
  const [ratio, setRatio] = useState(() => window.devicePixelRatio || 1)
  useEffect(() => {
    const query = window.matchMedia(`(resolution: ${ratio}dppx)`)
    const onChange = () => setRatio(window.devicePixelRatio || 1)
    query.addEventListener("change", onChange)
    window.addEventListener("resize", onChange)
    return () => {
      query.removeEventListener("change", onChange)
      window.removeEventListener("resize", onChange)
    }
  }, [ratio])
  return ratio
}
