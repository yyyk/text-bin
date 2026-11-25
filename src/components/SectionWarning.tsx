import { TriangleAlert } from "lucide-react"
import { Hint } from "@/components/Hint"

/**
 * A ⚠ for a section's header (PanelSection's actions), so a problem shows
 * even when the section is collapsed; the message as a tooltip.
 */
export function SectionWarning({ message }: { message: string }) {
  return (
    <Hint label={message} side="left">
      <span
        role="img"
        aria-label={message}
        className="flex size-7 items-center justify-center text-amber-700"
      >
        <TriangleAlert className="size-3.5" />
      </span>
    </Hint>
  )
}
