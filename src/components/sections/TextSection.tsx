import { FontField } from "@/components/FontField"
import { NumberInput } from "@/components/NumberInput"
import { PanelSection } from "@/components/PanelSection"
import { SectionWarning } from "@/components/SectionWarning"
import { SelectField } from "@/components/SelectField"
import { TextsField } from "@/components/TextsField"
import type { Update } from "@/hooks/useDocument"
import type { Renderer } from "@/lib/atlas/settings"
import type { FontEntry } from "@/lib/fonts"
import type { Option } from "@/lib/options"
import type { Doc } from "@/state/document"

const RENDERERS = [
  {
    value: "browser",
    label: "Browser",
    hint: "The browser's own text drawing: crisper at small sizes, may differ a little between browsers",
  },
  {
    value: "text-shape",
    label: "text-shape",
    hint: "Glyph outlines, filled: the same in every browser, a little lighter at small sizes",
  },
] as const satisfies readonly Option<Renderer>[]

/** The texts, their font, and how they're drawn. */
export function TextSection({
  doc,
  update,
  warnings,
  fonts,
  onUploadFont,
}: {
  doc: Doc
  update: Update
  /** What's wrong with the texts (missing letters, too big for the atlas) */
  warnings: readonly string[]
  fonts: readonly FontEntry[]
  onUploadFont: (file: File) => void
}) {
  return (
    <PanelSection
      title="Text"
      actions={
        warnings.length > 0 && (
          <SectionWarning
            message={
              warnings.length === 1
                ? warnings[0]
                : `${warnings.length} problems with the texts`
            }
          />
        )
      }
    >
      <TextsField
        texts={doc.text.texts}
        onChange={(texts) => update("text", { texts })}
        warnings={warnings}
      />
      <FontField
        value={doc.text.font}
        fonts={fonts}
        onChange={(font) => update("text", { font }, false)}
        onUpload={onUploadFont}
      />
      <NumberInput
        label="Letter Spacing"
        value={doc.text.letterSpacing}
        min={-0.5}
        max={2}
        step={0.01}
        unit="em"
        onChange={(v) => update("text", { letterSpacing: v })}
      />
      <SelectField
        label="Render"
        value={doc.text.render}
        options={RENDERERS}
        onChange={(render) => update("text", { render }, false)}
      />
    </PanelSection>
  )
}
