import { useEffect, useRef, useState } from "react"
import type { AtlasFont } from "@/lib/atlas/font"
import type { Settings } from "@/lib/atlas/settings"
import { download } from "@/lib/export/download"
import { passFrames, renderVideo, videoExtension } from "@/lib/export/video"
import type { Player } from "@/lib/preview/player"
import { appearanceColors, type Doc } from "@/state/document"
import type { Notify } from "./useNotice"

/** Frames rendered so far, while rendering */
export type VideoProgress = { done: number; total: number } | null

/**
 * The video export: Download renders the video (with progress, and cancel)
 * and saves it. From an empty atlas: one pass, or the export's number of
 * seconds (starting over after each pass, as the preview). A change to
 * anything it's made from cancels a render still going. `player` is the
 * preview's, for the frames in a pass (null before it starts).
 */
export function useVideo(
  doc: Doc,
  settings: Settings,
  font: AtlasFont,
  player: Player | null,
  notify: Notify,
) {
  const [progress, setProgress] = useState<VideoProgress>(null)
  const abort = useRef<AbortController | null>(null)
  const { background, videoCodec, videoSize, videoLength, videoSeconds } =
    doc.export
  const { appearance } = doc

  useEffect(
    () => () => abort.current?.abort(),
    [
      settings,
      font,
      appearance,
      background,
      videoCodec,
      videoSize,
      videoLength,
      videoSeconds,
    ],
  )

  const save = async () => {
    if (!player || abort.current) return
    const { fps } = settings.timing
    const total =
      videoLength === "pass"
        ? passFrames(player.engine().cycleFrames)
        : Math.max(1, Math.round(videoSeconds * fps))
    const controller = new AbortController()
    abort.current = controller
    setProgress({ done: 0, total })
    let shown = 0
    try {
      const blob = await renderVideo({
        settings,
        font,
        colors: appearanceColors({
          ...appearance,
          transparent: appearance.transparent || !background,
        }),
        background: appearance.background,
        codec: videoCodec,
        size: videoSize,
        from: 0,
        frames: total,
        signal: controller.signal,
        onProgress: (done) => {
          // a few times a second is enough for the bar
          const now = performance.now()
          if (done < total && now - shown < 100) return
          shown = now
          setProgress({ done, total })
        },
      })
      const name = `text-bin.${videoExtension(videoCodec)}`
      download(name, blob)
      notify(
        "export",
        `Saved ${name}: ${(total / fps).toFixed(1)} s, ${(blob.size / 1e6).toFixed(1)} MB.`,
      )
    } catch (e) {
      if (!controller.signal.aborted) {
        notify(
          "export",
          `Couldn't make the video: ${(e as Error).message}`,
          true,
        )
      }
    } finally {
      abort.current = null
      setProgress(null)
    }
  }

  const cancel = () => {
    abort.current?.abort()
    notify("export", "Cancelled.")
  }

  return { progress, download: save, cancel }
}
