import { useEffect, useRef } from "react"
import { isTyping } from "@/lib/keyboard"

/**
 * The preview's shortcuts: Space plays and pauses, → steps a frame, Shift+1
 * fits the atlas to the window and Shift+0 shows it at 100% (as in Figma).
 * Not while typing, and Space not on a focused button (which it presses).
 */
export function usePreviewKeys(actions: {
  togglePlaying: () => void
  step: () => void
  setFit: (fit: boolean) => void
}) {
  const latest = useRef(actions)
  useEffect(() => {
    latest.current = actions
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      const { togglePlaying, step, setFit } = latest.current
      if (e.code === "Space" && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        togglePlaying()
      } else if (e.code === "ArrowRight" && !e.shiftKey) {
        e.preventDefault()
        step()
      } else if (e.shiftKey && e.code === "Digit1") {
        e.preventDefault()
        setFit(true)
      } else if (e.shiftKey && e.code === "Digit0") {
        e.preventDefault()
        setFit(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
