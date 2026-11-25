import { useState } from "react"
import type { FontEntry } from "@/lib/fonts"

/**
 * The fonts there are: the built-in ones (loaded at the start), then the
 * ones uploaded this session. `fontId` is the document's font.
 */
export function useFonts(builtIn: FontEntry[], fontId: string) {
  const [fonts, setFonts] = useState(builtIn)
  return {
    fonts,
    /** The document's font, or the default if it isn't here */
    font: fonts.find((f) => f.id === fontId) ?? fonts[0],
    addFont: (entry: FontEntry) => setFonts((f) => [...f, entry]),
    /** Whether a font id can be used: built in, or uploaded this session */
    isKnown: (id: string) => fonts.some((f) => f.id === id),
  }
}
