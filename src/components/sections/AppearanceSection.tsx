import { ColorField } from "@/components/ColorField"
import { PanelSection } from "@/components/PanelSection"
import { SwitchField } from "@/components/SwitchField"
import type { Update } from "@/hooks/useDocument"
import type { Doc } from "@/state/document"

/** The atlas's colours: changing them doesn't start the animation over. */
export function AppearanceSection({
  doc,
  update,
}: {
  doc: Doc
  update: Update
}) {
  return (
    <PanelSection title="Appearance">
      <ColorField
        label="Background"
        value={doc.appearance.background}
        onChange={(background) => update("appearance", { background })}
        disabledReason={
          doc.appearance.transparent ? "Off with Transparent" : undefined
        }
      />
      <SwitchField
        label="Transparent"
        checked={doc.appearance.transparent}
        hint="No background: the text on transparent, as in a texture"
        onChange={(transparent) => update("appearance", { transparent }, false)}
      />
      <ColorField
        label="Text"
        value={doc.appearance.color}
        onChange={(color) => update("appearance", { color })}
      />
    </PanelSection>
  )
}
