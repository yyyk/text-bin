import { useId } from "react"
import { DisabledReason } from "@/components/DisabledReason"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * A labelled choice from a few options, laid out like NumberInput. An
 * option's `hint` (what it does) shows under it in the list, so the panel
 * itself stays the same height whatever is chosen. With `disabledReason` the
 * field is disabled, the reason shown as a tooltip.
 */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabledReason,
}: {
  label: string
  value: T
  options: readonly { value: T; label: string; hint?: string }[]
  onChange: (value: T) => void
  disabledReason?: string
}) {
  const id = useId()
  const disabled = disabledReason !== undefined
  return (
    <DisabledReason reason={disabledReason}>
      <div
        className="flex items-center justify-between gap-2 data-disabled:opacity-50"
        data-disabled={disabled || undefined}
      >
        <Label htmlFor={id}>{label}</Label>
        <Select
          items={options}
          value={value}
          disabled={disabled}
          onValueChange={(v) => v !== null && onChange(v as T)}
        >
          {/* named by aria-label: a label's htmlFor doesn't name this trigger */}
          <SelectTrigger id={id} aria-label={label} size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            // room for the hints
            className={options.some((o) => o.hint) ? "min-w-64" : undefined}
          >
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                description={option.hint}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </DisabledReason>
  )
}
