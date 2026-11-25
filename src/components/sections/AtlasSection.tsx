import { NumberInput } from "@/components/NumberInput"
import { PanelSection } from "@/components/PanelSection"
import { SelectField } from "@/components/SelectField"
import { SwitchField } from "@/components/SwitchField"
import type { Update } from "@/hooks/useDocument"
import type { PackStrategy, PackUnit, Wrap } from "@/lib/atlas/settings"
import type { Option } from "@/lib/options"
import type { Doc } from "@/state/document"

const STRATEGIES = [
  {
    value: "every-frame",
    label: "Every frame",
    hint: "Packs at the exact size of every frame",
  },
  {
    value: "size-step",
    label: "Size step",
    hint: "Packs when the size crosses a multiple of Size Step",
  },
  {
    value: "end-only",
    label: "End only",
    hint: "Packs only when a gesture ends",
  },
] as const satisfies readonly Option<PackStrategy>[]

const UNITS = [
  { value: "string", label: "String", hint: "Each text as a whole" },
  { value: "word", label: "Word", hint: "Each word, shared between texts" },
  {
    value: "letter",
    label: "Letter",
    hint: "Each letter, shared between texts",
  },
] as const satisfies readonly Option<PackUnit>[]

const WRAPS = [
  {
    value: "none",
    label: "None",
    hint: "Text wider than the atlas isn't packed",
  },
  {
    value: "word",
    label: "Word",
    hint: "Text wider than the atlas wraps at spaces",
  },
  {
    value: "letter",
    label: "Letter",
    hint: "Text wider than the atlas wraps between letters",
  },
] as const satisfies readonly Option<Wrap>[]

/** The atlas's size, and how text is packed into it. */
export function AtlasSection({ doc, update }: { doc: Doc; update: Update }) {
  const { atlas } = doc
  return (
    <PanelSection title="Atlas">
      <NumberInput
        label="Width"
        value={atlas.width}
        min={50}
        max={4096}
        unit="px"
        onChange={(v) => update("atlas", { width: v })}
      />
      <NumberInput
        label="Height"
        value={atlas.height}
        min={50}
        max={4096}
        unit="px"
        onChange={(v) => update("atlas", { height: v })}
      />
      <NumberInput
        label="Padding"
        value={atlas.padding}
        min={0}
        max={32}
        unit="px"
        onChange={(v) => update("atlas", { padding: v })}
      />
      <SwitchField
        label="Edge Padding"
        checked={atlas.padEdges}
        disabled={atlas.padding === 0}
        hint="The edges padded too, so entries are as far from them as from each other"
        onChange={(padEdges) => update("atlas", { padEdges }, false)}
      />
      <SelectField
        label="Strategy"
        value={atlas.strategy}
        options={STRATEGIES}
        onChange={(strategy) => update("atlas", { strategy }, false)}
      />
      <NumberInput
        label="Size Step"
        value={atlas.sizeStep}
        min={0.5}
        max={20}
        step={0.5}
        unit="px"
        onChange={(v) => update("atlas", { sizeStep: v })}
        disabledReason={
          atlas.strategy === "size-step"
            ? undefined
            : "Only with the Size step strategy"
        }
      />
      <SelectField
        label="Pack"
        value={atlas.unit}
        options={UNITS}
        onChange={(unit) => update("atlas", { unit }, false)}
      />
      <SelectField
        label="Wrap"
        value={atlas.wrap}
        options={WRAPS}
        onChange={(wrap) => update("atlas", { wrap }, false)}
        disabledReason={
          atlas.unit === "letter"
            ? "Packing by letter never wraps: a letter always fits"
            : undefined
        }
      />
      <SwitchField
        label="Reuse"
        checked={atlas.reuse}
        hint="On: a text already in the atlas at that size is used again. Off: no cache, each new appearance is packed again"
        onChange={(reuse) => update("atlas", { reuse }, false)}
      />
    </PanelSection>
  )
}
