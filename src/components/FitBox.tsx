import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

/** Space kept around the content when it's fitted, in px */
const MARGIN = 24

/**
 * Its content scaled to fit the box (up or down) with `fit`, or at 100%,
 * centred, scrolling when it's bigger than the box. `onScale` gets the scale
 * as it changes, so the content can draw at the size it's shown at.
 */
export function FitBox({
  fit,
  onScale,
  children,
}: {
  fit: boolean
  onScale?: (scale: number) => void
  children: ReactNode
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => onScale?.(scale), [scale, onScale])

  useLayoutEffect(() => {
    const outer = outerRef.current!
    const inner = innerRef.current!
    const measure = () => {
      if (!fit || !inner.offsetWidth || !inner.offsetHeight) {
        setScale(1)
        return
      }
      setScale(
        Math.min(
          (outer.clientWidth - 2 * MARGIN) / inner.offsetWidth,
          (outer.clientHeight - 2 * MARGIN) / inner.offsetHeight,
        ),
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(outer)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [fit])

  return (
    <div
      ref={outerRef}
      className={`relative flex min-h-0 flex-1 ${fit ? "overflow-hidden" : "overflow-auto p-6"}`}
    >
      <div
        ref={innerRef}
        // Fitted: centred on the box's middle whatever its size (m-auto can't
        // centre content wider than the box). At 100%: m-auto, centred when
        // smaller, scrollable when bigger
        className={fit ? "absolute top-1/2 left-1/2 w-max" : "m-auto shrink-0"}
        style={{
          transform: fit ? `translate(-50%, -50%) scale(${scale})` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  )
}
