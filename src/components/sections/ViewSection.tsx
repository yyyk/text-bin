import { PanelSection } from "@/components/PanelSection"
import { SwitchField } from "@/components/SwitchField"
import type { ViewOptions } from "@/state/view"

/** How the preview shows the atlas: not saved with the document. */
export function ViewSection({
  view,
  onChange,
}: {
  view: ViewOptions
  onChange: (patch: Partial<ViewOptions>) => void
}) {
  return (
    <PanelSection title="View">
      <SwitchField
        label="Debug"
        checked={view.debug}
        hint="Camera views beside the atlas, and the engine's stats"
        onChange={(debug) => onChange({ debug })}
      />
      <SwitchField
        label="Outlines"
        checked={view.outlines}
        disabled={!view.debug}
        hint="In debug mode: each entry outlined (its padding dashed), the ones just packed filled"
        onChange={(outlines) => onChange({ outlines })}
      />
    </PanelSection>
  )
}
