import { useId, useState } from "react"
import { TriangleAlert } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * The texts, one per line. What's typed applies when the field is left (or
 * with ⌘↩ / Ctrl+Enter), not at every key: each change starts the engine
 * over. Escape drops the edit. Empty lines are kept (so a new line can be
 * started) and left out when the engine runs. The line under the field is
 * always there, so nothing moves: a hint, or the warnings, all of them in a
 * tooltip.
 */
export function TextsField({
  texts,
  onChange,
  warnings,
}: {
  texts: string[]
  onChange: (texts: string[]) => void
  warnings: readonly string[]
}) {
  const id = useId()
  const value = texts.join("\n")
  // What's being typed, until it applies; null when not editing
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft !== null && draft !== value) onChange(draft.split("\n"))
    setDraft(null)
  }
  const editing = draft !== null && draft !== value

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Texts</Label>
      <Textarea
        id={id}
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            commit()
          } else if (e.key === "Escape") {
            setDraft(null)
          }
        }}
        spellCheck={false}
        aria-describedby={`${id}-line`}
      />
      {editing ? (
        <p id={`${id}-line`} className="text-xs text-muted-foreground">
          Applies when you leave the field (or ⌘↩)
        </p>
      ) : warnings.length === 0 ? (
        <p id={`${id}-line`} className="text-xs text-muted-foreground">
          One text per line
        </p>
      ) : (
        <Tooltip>
          <TooltipTrigger
            render={
              <p
                id={`${id}-line`}
                className="flex items-center gap-1 text-xs text-amber-700"
              />
            }
          >
            <TriangleAlert className="size-3.5 shrink-0" />
            <span className="truncate">
              {warnings.length === 1
                ? warnings[0]
                : `${warnings.length} problems with the texts`}
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-72">
            <ul className="space-y-1">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
