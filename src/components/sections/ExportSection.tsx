import { Copy, Download } from "lucide-react"
import { PanelSection } from "@/components/PanelSection"
import { SwitchField } from "@/components/SwitchField"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Update } from "@/hooks/useDocument"
import type { Notice } from "@/hooks/useNotice"
import type { Doc } from "@/state/document"

const SCALES = [
  { value: "1", label: "1×" },
  { value: "2", label: "2×" },
] as const

/**
 * The current frame as a PNG, as type-shards' Export: its scale, then Copy
 * (to paste, e.g. into Figma) or Download. The colours are Appearance's;
 * the background can be left out (and always is with Transparent).
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
  return (
    <PanelSection title="Export">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <Label>Scale</Label>
          <span className="text-xs text-muted-foreground">
            {width * s} × {height * s} px
          </span>
        </div>
        <ToggleGroup
          aria-label="Scale"
          variant="outline"
          size="sm"
          spacing={0}
          value={[scale]}
          // [] when the pressed one is clicked again: keep it pressed
          onValueChange={([v]) =>
            v && update("export", { scale: Number(v) }, false)
          }
        >
          {SCALES.map((option) => (
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
