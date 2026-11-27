import { Copy, Download, X } from "lucide-react"
import { DisabledReason } from "@/components/DisabledReason"
import { NumberInput } from "@/components/NumberInput"
import { PanelSection } from "@/components/PanelSection"
import { SelectField } from "@/components/SelectField"
import { SwitchField } from "@/components/SwitchField"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Update } from "@/hooks/useDocument"
import type { Notice } from "@/hooks/useNotice"
import type { VideoProgress } from "@/hooks/useVideo"
import { videoSize, type VideoSize } from "@/lib/export/video"
import type { Doc } from "@/state/document"

const FORMATS = [
  { value: "png", label: "PNG" },
  { value: "svg", label: "SVG" },
  { value: "video", label: "Video" },
] as const

const SCALES = [
  { value: "1", label: "1×" },
  { value: "2", label: "2×" },
] as const

const CODECS = [
  { value: "h264", label: "H.264" },
  { value: "vp9", label: "VP9" },
] as const

const SIZES: readonly { value: VideoSize; label: string; hint: string }[] = [
  { value: "atlas", label: "Atlas 1×", hint: "Its own size" },
  {
    value: "atlas2",
    label: "Atlas 2×",
    hint: "Twice its size: sharp on a high-density screen",
  },
  { value: "1080", label: "1080 × 1080", hint: "Scaled to fit" },
  { value: "1920", label: "1920 × 1080", hint: "Scaled to fit" },
  { value: "4k", label: "4K", hint: "Scaled to fit 3840 × 2160" },
]

const LENGTHS = [
  { value: "pass", label: "One pass", hint: "From an empty atlas to the end" },
  {
    value: "seconds",
    label: "Seconds",
    hint: "Starting over after each pass, as the preview",
  },
] as const

/**
 * Two or three choices side by side, labelled, with a hint under the label
 * if any, as type-shards' Export rows
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
  hint?: string
  value: T
  options: readonly { value: T; label: string }[]
  disabled?: boolean
  onChange: (value: T) => void
}) {
  return (
    <div
      className="flex items-center justify-between gap-2 data-disabled:opacity-50"
      data-disabled={disabled || undefined}
    >
      <div className="flex flex-col gap-1">
        <Label>{label}</Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
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
 * Export, as type-shards': the format (this frame as PNG or SVG, or the
 * animation as a video), each format's settings (all shown, the ones that
 * don't apply disabled, so nothing moves), then Copy and Download. For a
 * video, Download renders it (Cancel while it does, with the progress under
 * it) and saves it; it can't be copied. The colours are Appearance's; the
 * background can be left out (and always is with Transparent; H.264 has no
 * transparency). `notice` is a short message about the last export.
 */
export function ExportSection({
  doc,
  update,
  onCopy,
  onDownload,
  video,
  disabled,
  notice,
}: {
  doc: Doc
  update: Update
  onCopy: () => void
  onDownload: () => void
  video: {
    progress: VideoProgress
    cancel: () => void
    download: () => void
  }
  /** Before the preview has started */
  disabled: boolean
  notice: Notice | null
}) {
  const options = doc.export
  const { format } = options
  const scale = options.scale === 1 ? "1" : "2"
  const { width, height } = doc.atlas
  const s = Number(scale)
  const { transparent } = doc.appearance
  const isVideo = format === "video"
  const notVideo = isVideo ? undefined : "For video"
  const out = videoSize(width, height, options.videoSize)
  // Transparent asked for (H.264 can't have it)
  const wantsAlpha = transparent || !options.background
  const h264 = options.videoCodec === "h264"
  const { progress } = video

  return (
    <PanelSection title="Export">
      <Choice
        label="Format"
        value={format}
        options={FORMATS}
        onChange={(format) => update("export", { format }, false)}
      />
      <Choice
        label="Scale"
        hint={
          format === "png"
            ? `${width * s} × ${height * s} px`
            : `${width} × ${height}, for PNG only`
        }
        value={scale}
        options={SCALES}
        disabled={format !== "png"}
        onChange={(v) => update("export", { scale: Number(v) }, false)}
      />
      <Choice
        label="Codec"
        hint={
          h264
            ? wantsAlpha
              ? "MP4: no transparency, on the Background colour"
              : "MP4, plays everywhere"
            : "WebM, keeps transparency"
        }
        value={options.videoCodec}
        options={CODECS}
        disabled={!isVideo}
        onChange={(videoCodec) => update("export", { videoCodec }, false)}
      />
      <SelectField
        label={`Size (${out.width} × ${out.height})`}
        value={options.videoSize}
        options={SIZES}
        onChange={(videoSize) => update("export", { videoSize }, false)}
        disabledReason={notVideo}
      />
      <SelectField
        label="Length"
        value={options.videoLength}
        options={LENGTHS}
        onChange={(videoLength) => update("export", { videoLength }, false)}
        disabledReason={notVideo}
      />
      <NumberInput
        label="Seconds"
        value={options.videoSeconds}
        min={1}
        max={600}
        unit="s"
        onChange={(videoSeconds) => update("export", { videoSeconds })}
        disabledReason={
          notVideo ??
          (options.videoLength === "seconds"
            ? undefined
            : "With Length Seconds")
        }
      />
      <SwitchField
        label="Background"
        checked={options.background && !transparent}
        disabled={transparent}
        hint={
          transparent
            ? "Off with Transparent (Appearance)"
            : options.background
              ? "The Background colour"
              : "Transparent"
        }
        onChange={(background) => update("export", { background }, false)}
      />
      <div className="grid grid-cols-2 gap-2">
        <DisabledReason
          reason={isVideo ? "A video can't be copied" : undefined}
        >
          {/* a disabled button gets no pointer events: this shows the reason */}
          <span className="grid">
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || isVideo}
              onClick={onCopy}
            >
              <Copy />
              Copy
            </Button>
          </span>
        </DisabledReason>
        {progress ? (
          <Button variant="outline" size="sm" onClick={video.cancel}>
            <X />
            Cancel
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={disabled}
            onClick={isVideo ? video.download : onDownload}
          >
            <Download />
            Download
          </Button>
        )}
      </div>
      {progress && (
        <div className="space-y-1">
          <div
            role="progressbar"
            aria-label="Rendering"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full bg-primary"
              style={{ width: `${(100 * progress.done) / progress.total}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            Rendering: frame {progress.done} / {progress.total}
          </p>
        </div>
      )}
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
