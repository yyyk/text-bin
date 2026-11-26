import type { AtlasFont } from "@/lib/atlas/font"
import type { Settings } from "@/lib/atlas/settings"
import { download } from "@/lib/export/download"
import { atlasToPng } from "@/lib/export/png"
import type { Player } from "@/lib/preview/player"
import { appearanceColors, type Doc } from "@/state/document"
import type { Notify } from "./useNotice"

/**
 * The current frame as a PNG, copied or downloaded: the atlas in the
 * document's colours, transparent with Transparent or without the export's
 * Background, at the export's scale, replayed up to the frame the preview
 * is at. `player` is the preview's (null before it starts).
 */
export function useExport(
  doc: Doc,
  settings: Settings,
  font: AtlasFont,
  player: Player | null,
  notify: Notify,
) {
  const { scale, background } = doc.export
  const colors = appearanceColors({
    ...doc.appearance,
    transparent: doc.appearance.transparent || !background,
  })
  // After the click's own code (a microtask), so the copy below starts
  // straight from the click, before the replay
  const png = (position: number) =>
    Promise.resolve().then(() =>
      atlasToPng({
        settings,
        font,
        position,
        colors,
        scale,
      }),
    )

  const copy = async () => {
    if (!player) return
    try {
      // the PNG as a promise, as Safari needs: the copy has to start
      // straight from the click, before the PNG is made
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": png(player.position()) }),
      ])
      notify("export", "Copied as PNG.")
    } catch (e) {
      notify("export", `Couldn't copy: ${(e as Error).message}`, true)
    }
  }

  const save = async () => {
    if (!player) return
    const name = `text-bin@${scale}x.png`
    try {
      download(name, await png(player.position()))
      notify("export", `Saved ${name}.`)
    } catch (e) {
      notify("export", `Couldn't make the PNG: ${(e as Error).message}`, true)
    }
  }

  return { copy, download: save }
}
