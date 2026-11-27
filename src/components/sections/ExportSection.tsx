import { Copy, Download } from "lucide-react"
import { PanelSection } from "@/components/PanelSection"
import { SwitchField } from "@/components/SwitchField"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Update } from "@/hooks/useDocument"
import type { Notice } from "@/hooks/useNotice"
import type { Doc } from "@/state/document"

const FORMATS = [
  { value: "png", label: "PNG" },
  { value: "svg", label: "SVG" },
] as const

const SCALES = [
  { value: "1", label: "1×" },
  { value: "2", label: "2×" },
] as const

/**
 * Two choices side by side, labelled, with a hint under the label, as
 * type-shards' Export rows
 */
function Choice<T extends string>({
  label,
  hint,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string
  hint: string
  value: T
  options: readonly { value: T; label: string }[]
  disabled?: boolean
  onChange: (value: T) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-col gap-1">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <ToggleGroup
        aria-label={label}
        variant="outline"
        size="sm"
        spacing={0}
        value={[value]}
        disabled={disabled}
        // [] when the pressed one is clicked again: keep it pressed
        onValueChange={([v]) => v && onChange(v as T)}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="px-2.5 text-xs"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

/**
 * The current frame as a PNG or SVG, as type-shards' Export: the format,
 * the PNG's scale (disabled for SVG, so nothing moves), then Copy (to
 * paste, e.g. into Figma) or Download. The colours are Appearance's; the
 * background can be left out (and always is with Transparent).
 * `notice` is a short message about the last copy or download.
 */
export function ExportSection({
  doc,
  update,
  onCopy,
  onDownload,
  disabled,
  notice,
}: {
  doc: Doc
  update: Update
  onCopy: () => void
  onDownload: () => void
  /** Before the preview has started */
  disabled: boolean
  notice: Notice | null
}) {
  const scale = doc.export.scale === 1 ? "1" : "2"
  const { width, height } = doc.atlas
  const s = Number(scale)
  const { transparent } = doc.appearance
  const isSvg = doc.export.format === "svg"
  return (
    <PanelSection title="Export">
      <Choice
        label="Format"
        hint={
          isSvg ? "Outlines, only what's visible" : "Pixels, as the preview"
        }
        value={doc.export.format}
        options={FORMATS}
        onChange={(format) => update("export", { format }, false)}
      />
      <Choice
        label="Scale"
        hint={
          isSvg
            ? `${width} × ${height}, for PNG only`
            : `${width * s} × ${height * s} px`
        }
        value={scale}
        options={SCALES}
        disabled={isSvg}
        onChange={(v) => update("export", { scale: Number(v) }, false)}
      />
      <SwitchField
        label="Background"
        checked={doc.export.background && !transparent}
        disabled={transparent}
        hint={
          transparent
            ? "Off with Transparent (Appearance)"
            : doc.export.background
              ? "The Background colour"
              : "Transparent"
        }
        onChange={(background) => update("export", { background }, false)}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onCopy}
        >
          <Copy />
          Copy
        </Button>
        <Button size="sm" disabled={disabled} onClick={onDownload}>
          <Download />
          Download
        </Button>
      </div>
      {/* last in the tab, so nothing moves when it comes and goes */}
      {notice && (
        <p
          role="status"
          className={
            notice.error
              ? "text-xs text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          {notice.text}
        </p>
      )}
    </PanelSection>
  )
}
