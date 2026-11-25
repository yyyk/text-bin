import { useId } from "react"
import { SelectField } from "@/components/SelectField"
import { Input } from "@/components/ui/input"
import {
  EASING_KEYWORDS,
  expandKeyword,
  parseTimingFunction,
} from "@/lib/atlas/easing"

const CUSTOM = "custom"
const OPTIONS = [
  ...EASING_KEYWORDS.map((keyword) => ({ value: keyword, label: keyword })),
  { value: CUSTOM, label: "Custom" },
]

/**
 * The zoom's easing: a preset (a CSS keyword), and under it the value as the
 * CSS function it stands for, to edit: any CSS timing function
 * (cubic-bezier(), steps(), linear()). Editing it makes it Custom. The curve
 * is drawn under it. The line under the value is always there, so nothing
 * moves: a hint, or `error` (why the typed value isn't used).
 */
export function EasingField({
  value,
  onChange,
  error,
  disabledReason,
}: {
  value: string
  onChange: (value: string) => void
  error: string | null
  /** Disables the field, the reason shown as a tooltip */
  disabledReason?: string
}) {
  const disabled = disabledReason !== undefined
  const id = useId()
  const preset = EASING_KEYWORDS.includes(value.trim()) ? value.trim() : CUSTOM
  return (
    <div className="space-y-1.5">
      <SelectField
        label="Easing"
        value={preset}
        options={OPTIONS}
        // Custom keeps the curve there is, to edit below
        onChange={(v) => v !== CUSTOM && onChange(v)}
        disabledReason={disabledReason}
      />
      <Input
        id={id}
        aria-label="Easing as CSS"
        value={expandKeyword(value)}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        disabled={disabled}
        aria-invalid={error !== null}
        aria-describedby={`${id}-line`}
        className="h-7 font-mono text-xs"
      />
      {/* the select and the input dim themselves when disabled */}
      <div className={`space-y-1.5 ${disabled ? "opacity-50" : ""}`}>
        <p
          id={`${id}-line`}
          className={`truncate text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}
          title={error ?? undefined}
        >
          {error ?? "Any CSS timing function"}
        </p>
        <EasingCurve value={error ? "linear" : value} />
      </div>
    </div>
  )
}

/** The curve, progress left to right, eased value bottom to top */
function EasingCurve({ value }: { value: string }) {
  const ease = parseTimingFunction(value)
  const W = 200
  const H = 48
  // Room for curves that overshoot (below 0, above 1)
  const pad = 12
  const points = Array.from({ length: 101 }, (_, i) => {
    const x = i / 100
    return `${x * W},${pad + (1 - ease(x)) * (H - 2 * pad)}`
  }).join(" ")
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-12 w-full rounded-md border bg-muted/40"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
