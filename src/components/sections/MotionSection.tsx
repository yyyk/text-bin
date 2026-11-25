import { EasingField } from "@/components/EasingField"
import { NumberInput } from "@/components/NumberInput"
import { PanelSection } from "@/components/PanelSection"
import { SectionWarning } from "@/components/SectionWarning"
import { SelectField } from "@/components/SelectField"
import type { Update } from "@/hooks/useDocument"
import type {
  MotionMode,
  ZoomPattern,
  ZoomSizes,
  ZoomTexts,
} from "@/lib/atlas/settings"
import type { Option } from "@/lib/options"
import type { Doc } from "@/state/document"

const PATTERNS = [
  {
    value: "random",
    label: "Random",
    hint: "To a random size anywhere between min and max",
  },
  { value: "alternate", label: "Alternate", hint: "Min → max → min → …" },
] as const satisfies readonly Option<ZoomPattern>[]

const MOTIONS = [
  {
    value: "zoom",
    label: "Zoom",
    hint: "The texts zoom in and out, in gestures",
  },
  {
    value: "scatter",
    label: "Scatter",
    hint: "No zooming: every frame packs texts at random sizes (as v0)",
  },
] as const satisfies readonly Option<MotionMode>[]

const ZOOM_TEXTS = [
  {
    value: "single",
    label: "One at a time",
    hint: "Each gesture zooms the next text; the others keep their size",
  },
  { value: "all", label: "All", hint: "Every gesture zooms all texts at once" },
] as const satisfies readonly Option<ZoomTexts>[]

const ZOOM_SIZES = [
  { value: "same", label: "Same", hint: "All texts zoom to one size" },
  {
    value: "different",
    label: "Different",
    hint: "Each text zooms to its own size",
  },
] as const satisfies readonly Option<ZoomSizes>[]

/**
 * How the sizes move: zooming (the path and the easing) or scattering texts
 * at random sizes (how many a frame, and in a cycle), between the min and
 * max size.
 */
export function MotionSection({
  doc,
  update,
  easingError,
}: {
  doc: Doc
  update: Update
  /** Why the typed easing isn't used */
  easingError: string | null
}) {
  const { minSize, maxSize, mode } = doc.motion
  const zoomOnly = mode === "zoom" ? undefined : ONLY_ZOOM
  const scatterOnly = mode === "scatter" ? undefined : ONLY_SCATTER
  return (
    <PanelSection
      title="Motion"
      actions={easingError && <SectionWarning message={easingError} />}
    >
      <SelectField
        label="Motion"
        value={mode}
        options={MOTIONS}
        onChange={(mode) => update("motion", { mode }, false)}
      />
      <NumberInput
        label="Min Size"
        value={minSize}
        min={1}
        max={maxSize - 1}
        unit="px"
        onChange={(v) => update("motion", { minSize: v })}
      />
      <NumberInput
        label="Max Size"
        value={maxSize}
        min={minSize + 1}
        max={500}
        unit="px"
        onChange={(v) => update("motion", { maxSize: v })}
      />
      <SelectField
        label="Zoom Texts"
        value={doc.motion.zoomTexts}
        options={ZOOM_TEXTS}
        onChange={(zoomTexts) => update("motion", { zoomTexts }, false)}
        disabledReason={zoomOnly}
      />
      <SelectField
        label="Zoom Sizes"
        value={doc.motion.zoomSizes}
        options={ZOOM_SIZES}
        onChange={(zoomSizes) => update("motion", { zoomSizes }, false)}
        disabledReason={
          zoomOnly ??
          (doc.motion.zoomTexts === "single"
            ? "Only with Zoom Texts: All"
            : doc.motion.pattern === "alternate"
              ? "With Alternate every text goes min ↔ max, so sizes can't differ"
              : undefined)
        }
      />
      <SelectField
        label="Pattern"
        value={doc.motion.pattern}
        options={PATTERNS}
        onChange={(pattern) => update("motion", { pattern }, false)}
        disabledReason={zoomOnly}
      />
      <NumberInput
        label="Gestures"
        value={doc.motion.gestures}
        min={0}
        max={500}
        onChange={(v) => update("motion", { gestures: v })}
        disabledReason={zoomOnly}
      />
      <EasingField
        value={doc.motion.easing}
        onChange={(easing) => update("motion", { easing })}
        error={easingError}
        disabledReason={zoomOnly}
      />
      <NumberInput
        label="Per Frame"
        value={doc.motion.perFrame}
        min={1}
        max={100}
        onChange={(v) => update("motion", { perFrame: v })}
        disabledReason={scatterOnly}
      />
      <NumberInput
        label="Count"
        value={doc.motion.count}
        min={1}
        max={100000}
        step={10}
        onChange={(v) => update("motion", { count: v })}
        disabledReason={scatterOnly}
      />
    </PanelSection>
  )
}

/** Why a field is disabled with the other motion */
export const ONLY_ZOOM = "Only with Motion: Zoom"
const ONLY_SCATTER = "Only with Motion: Scatter"
