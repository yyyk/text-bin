import { useEffect, useState } from "react"

/**
 * `value`, once it has stopped changing for `ms`: for work too slow to redo
 * at every step of a window resize. The first value is there at once.
 */
export function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return settled
}
