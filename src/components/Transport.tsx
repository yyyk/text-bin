import { Pause, Play, RotateCcw, StepForward } from "lucide-react"
import { Hint } from "@/components/Hint"
import type { PreviewControls } from "@/components/AtlasPreview"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { usePlayerPosition } from "@/hooks/usePlayerPosition"

/**
 * The bar under the preview: restart, play / pause, a frame forward, the
 * position in the current cycle (drag to move), and fit / 100%.
 */
export function Transport({
  controls,
  playing,
  onPlayingChange,
  fit,
  onFitChange,
}: {
  controls: PreviewControls | null
  playing: boolean
  onPlayingChange: (playing: boolean) => void
  fit: boolean
  onFitChange: (fit: boolean) => void
}) {
  usePlayerPosition(controls?.player)
  const engine = controls?.player.engine()
  const cycleFrames = engine?.cycleFrames ?? 0
  const frame = engine?.frame() ?? 0
  const cycle = engine?.cycle() ?? 1

  return (
    <div className="flex h-11 shrink-0 items-center gap-3 border-t bg-background px-3">
      <div className="flex">
        <Hint label="Restart">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Restart"
            onClick={() => controls?.restart()}
          >
            <RotateCcw />
          </Button>
        </Hint>
        <Hint label={playing ? "Pause (Space)" : "Play (Space)"}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => onPlayingChange(!playing)}
          >
            {playing ? <Pause /> : <Play />}
          </Button>
        </Hint>
        <Hint label="Next frame (→)">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next frame"
            onClick={() => {
              onPlayingChange(false)
              controls?.step()
            }}
          >
            <StepForward />
          </Button>
        </Hint>
      </div>
      <Slider
        aria-label="Frame"
        className="min-w-24 flex-1"
        min={0}
        max={Math.max(1, cycleFrames - 1)}
        value={[Math.min(frame, cycleFrames - 1)]}
        onValueChange={(value) => {
          const target = Array.isArray(value) ? value[0] : value
          onPlayingChange(false)
          controls?.seek((cycle - 1) * cycleFrames + target)
        }}
      />
      <span className="w-36 shrink-0 text-xs text-muted-foreground tabular-nums">
        Cycle {cycle} · {frame} / {cycleFrames}
      </span>
      <ToggleGroup
        aria-label="Scale"
        variant="outline"
        size="sm"
        spacing={0}
        value={[fit ? "fit" : "100"]}
        // [] when the pressed one is clicked again: keep it pressed
        onValueChange={([value]) => value && onFitChange(value === "fit")}
      >
        <Hint label="Fit (⇧1)">
          <ToggleGroupItem value="fit" aria-label="Fit">
            Fit
          </ToggleGroupItem>
        </Hint>
        <Hint label="100% (⇧0)">
          <ToggleGroupItem value="100" aria-label="100%">
            100%
          </ToggleGroupItem>
        </Hint>
      </ToggleGroup>
    </div>
  )
}
