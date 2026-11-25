import { useSyncExternalStore } from "react"
import type { Player } from "@/lib/preview/player"

// Checks every screen frame; React re-renders only when the value changed
const everyFrame = (onChange: () => void) => {
  let request = requestAnimationFrame(function loop() {
    onChange()
    request = requestAnimationFrame(loop)
  })
  return () => cancelAnimationFrame(request)
}

/**
 * The player's position (frames since the start), followed as it plays,
 * steps, seeks or restarts: the engine changes outside React.
 */
export function usePlayerPosition(player: Player | undefined) {
  return useSyncExternalStore(everyFrame, () => player?.position() ?? 0)
}
