import { NumberInput } from "@/components/NumberInput"
import { PanelSection } from "@/components/PanelSection"
import { SelectField } from "@/components/SelectField"
import type { Update } from "@/hooks/useDocument"
import type { DurationMode } from "@/lib/atlas/settings"
import type { Option } from "@/lib/options"
import type { Doc } from "@/state/document"
import { ONLY_ZOOM } from "./MotionSection"

const MODES = [
  { value: "fixed", label: "Fixed", hint: "Every gesture takes Duration" },
  {
    value: "linear",
    label: "Linear",
    hint: "Duration for min ↔ max, less for smaller changes",
  },
  {
    value: "ratio",
    label: "Ratio",
    hint: "By zoom ratio: 6 → 12px takes as long as 24 → 48px",
  },
] as const satisfies readonly Option<DurationMode>[]

const FRAME_RATES = [
  { value: "24", label: "24 fps" },
  { value: "30", label: "30 fps" },
  { value: "60", label: "60 fps" },
] as const

/** How long the gestures take, and the frame rate. */
export function TimingSection({ doc, update }: { doc: Doc; update: Update }) {
  const { timing } = doc
  const zoomOnly = doc.motion.mode === "zoom" ? undefined : ONLY_ZOOM
  return (
    <PanelSection title="Timing">
      <SelectField
        label="Duration By"
        value={timing.durationMode}
        options={MODES}
        onChange={(durationMode) => update("timing", { durationMode }, false)}
        disabledReason={zoomOnly}
      />
      <NumberInput
        label="Duration"
        value={timing.duration}
        min={0}
        max={10000}
        step={10}
        unit="ms"
        onChange={(v) => update("timing", { duration: v })}
        disabledReason={zoomOnly}
      />
      <NumberInput
        label="Min Duration"
        value={timing.minDuration}
        min={0}
        max={10000}
        step={10}
        unit="ms"
        onChange={(v) => update("timing", { minDuration: v })}
        disabledReason={zoomOnly}
      />
      <NumberInput
        label="Jitter"
        value={Math.round(timing.jitter * 100)}
        min={0}
        max={100}
        unit="%"
        onChange={(v) => update("timing", { jitter: v / 100 })}
        disabledReason={zoomOnly}
      />
      <NumberInput
        label="Pause"
        value={timing.pause}
        min={0}
        max={10000}
        step={10}
        unit="ms"
        onChange={(v) => update("timing", { pause: v })}
        disabledReason={zoomOnly}
      />
      <SelectField
        label="Frame Rate"
        value={String(timing.fps)}
        options={FRAME_RATES}
        onChange={(v) => update("timing", { fps: Number(v) }, false)}
      />
    </PanelSection>
  )
}
