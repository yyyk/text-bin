import { createEngine, type Engine } from "@/lib/atlas/engine"
import type { AtlasFont } from "@/lib/atlas/font"
import type { Settings } from "@/lib/atlas/settings"
import type { TextContext } from "@/lib/atlas/text"

/**
 * Plays an engine frame by frame and moves to any frame: forward by
 * stepping, back by starting over and stepping up to it (the atlas depends
 * on every frame before, so there's no other way back). `prepare` gives a
 * fresh, empty canvas context for each start; `font` is the settings' font.
 */
export function createPlayer(
  prepare: () => TextContext,
  settings: Settings,
  font: AtlasFont,
) {
  let engine: Engine = createEngine(prepare(), settings, font)
  // Frames since the start, over all cycles
  let position = 0

  function restart() {
    engine = createEngine(prepare(), settings, font)
    position = 0
  }

  function step() {
    if (engine.done()) return
    engine.advanceFrame()
    position++
  }

  /** Moves to frame `target`, counted from the start over all cycles */
  function seek(target: number) {
    if (target < position) restart()
    while (position < target && !engine.done()) step()
  }

  return {
    engine: () => engine,
    position: () => position,
    step,
    seek,
    restart,
  }
}

export type Player = ReturnType<typeof createPlayer>
