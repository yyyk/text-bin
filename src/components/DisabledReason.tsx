import type { ReactElement } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * Why a field is disabled, as a tooltip on its whole row (a disabled control
 * gets no pointer events, so the row takes them). Without a reason, the row
 * as it is.
 */
export function DisabledReason({
  reason,
  children,
}: {
  reason?: string
  children: ReactElement
}) {
  if (!reason) return children
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="left">{reason}</TooltipContent>
    </Tooltip>
  )
}
