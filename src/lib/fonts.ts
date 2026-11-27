import { Font, initText } from "text-shape"
import wasmUrl from "text-shape/text_shape_bg.wasm?url"
import type { AtlasFont } from "@/lib/atlas/font"

/** A font the app can use: built in, or uploaded (until a reload) */
export interface FontEntry extends AtlasFont {
  id: string
}

/**
 * The fonts in public/fonts, under the site's base path (BASE_URL, /<repo>/
 * on GitHub Pages). The first is the default.
 */
export const BUILTIN_FONTS = [
  { id: "montserrat", name: "Montserrat", file: "Montserrat-Regular.ttf" },
  { id: "roboto", name: "Roboto", file: "Roboto-Regular.ttf" },
  { id: "fraunces", name: "Fraunces", file: "Fraunces.ttf" },
  {
    id: "playfair-display",
    name: "Playfair Display",
    file: "PlayfairDisplay.ttf",
  },
  {
    id: "bricolage-grotesque",
    name: "Bricolage Grotesque",
    file: "BricolageGrotesque.ttf",
  },
  { id: "oswald", name: "Oswald", file: "Oswald.ttf" },
  {
    id: "zen-kaku-gothic-new",
    name: "Zen Kaku Gothic New",
    file: "ZenKakuGothicNew-Regular.ttf",
  },
  { id: "pacifico", name: "Pacifico", file: "Pacifico-Regular.ttf" },
  { id: "jost", name: "Jost", file: "Jost.ttf" },
  { id: "outfit", name: "Outfit", file: "Outfit.ttf" },
  { id: "noto-sans", name: "Noto Sans", file: "NotoSans.ttf" },
] as const

/**
 * A font from a file's bytes, ready for both renderers: text-shape reads it
 * (and measures with it), and the browser gets it as a FontFace of its own
 * family name, for fillText.
 */
export async function fontFromBytes(
  id: string,
  name: string,
  bytes: Uint8Array,
  font = Font.fromBytes(bytes),
): Promise<FontEntry> {
  const family = `text-bin-${id}`
  const face = await new FontFace(family, bytes.slice().buffer).load()
  document.fonts.add(face)
  return { id, name, family, font }
}

/**
 * An uploaded font, named after the font (unique among `taken` names), with
 * an id of its own. Throws for a file that isn't a font.
 */
export async function fontFromFile(
  file: File,
  taken: readonly string[],
): Promise<FontEntry> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const font = Font.fromBytes(bytes)
  const name = uniqueFontName(fontName(font, file.name), file.name, taken)
  return fontFromBytes(`upload-${crypto.randomUUID()}`, name, bytes, font)
}

/** text-shape's WASM, then the built-in fonts, loaded once at the start */
export const builtInFonts: Promise<FontEntry[]> = initText(wasmUrl).then(() =>
  Promise.all(
    BUILTIN_FONTS.map(async ({ id, name, file }) => {
      const response = await fetch(`${import.meta.env.BASE_URL}fonts/${file}`)
      if (!response.ok) throw new Error(`Couldn't load ${file}`)
      return fontFromBytes(
        id,
        name,
        new Uint8Array(await response.arrayBuffer()),
      )
    }),
  ),
)

/** The font's family (and style, unless Regular) name, or `fallback`. */
export function fontName(font: Font, fallback: string): string {
  const { family_name, subfamily_name } = font.info()
  if (!family_name) return fallback
  return subfamily_name && subfamily_name !== "Regular"
    ? `${family_name} ${subfamily_name}`
    : family_name
}

/**
 * `name`, made unique among `taken` names: as it is if free, else with the
 * file name, else numbered as well ("Roboto (Roboto.ttf) 2").
 */
export function uniqueFontName(
  name: string,
  fileName: string,
  taken: readonly string[],
): string {
  const isFree = (candidate: string) => !taken.includes(candidate)
  if (isFree(name)) return name
  const withFile = name === fileName ? name : `${name} (${fileName})`
  if (isFree(withFile)) return withFile
  let n = 2
  while (!isFree(`${withFile} ${n}`)) n++
  return `${withFile} ${n}`
}
