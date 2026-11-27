import type { AtlasFont } from "@/lib/atlas/font"
import type { Settings } from "@/lib/atlas/settings"
import { drawAtlas, type Colors } from "@/lib/preview/draw"
import { createPlayer } from "@/lib/preview/player"

/** The video's codec, and with it the file: H.264 in MP4, VP9 in WebM */
export type VideoCodec = "h264" | "vp9"

/** The file's extension for a codec */
export function videoExtension(codec: VideoCodec) {
  return codec === "h264" ? "mp4" : "webm"
}

/**
 * The atlas's own size (1×), twice it (2×, as sharp as the preview on a
 * high-density screen), or scaled to fit, keeping the atlas's proportions
 */
export type VideoSize = "atlas" | "atlas2" | "1080" | "1920" | "4k"

const FIT: Record<Exclude<VideoSize, "atlas" | "atlas2">, [number, number]> = {
  "1080": [1080, 1080],
  "1920": [1920, 1080],
  "4k": [3840, 2160],
}

/**
 * The video's size in px for an atlas of `width` × `height`: its own size,
 * twice it, or scaled to fit `size` (up or down), keeping its proportions. Both sides
 * even, as H.264 needs (4:2:0 halves the colour's resolution).
 */
export function videoSize(
  width: number,
  height: number,
  size: VideoSize,
): { width: number; height: number } {
  const scale =
    size === "atlas"
      ? 1
      : size === "atlas2"
        ? 2
        : Math.min(FIT[size][0] / width, FIT[size][1] / height)
  const even = (v: number) => Math.max(2, 2 * Math.round(v / 2))
  return { width: even(width * scale), height: even(height * scale) }
}

/**
 * Frames in one pass, as the preview plays it: from an empty atlas
 * (position 0) to the end of the zoom path or the scatter (done), both
 * included
 */
export function passFrames(cycleFrames: number) {
  return cycleFrames + 1
}

/**
 * Renders `frames` frames of the atlas as a video, from frame `from`
 * (counted from the start over all cycles), offline: each frame is stepped
 * and drawn exactly once, however long that takes, at `settings`' frame
 * rate. In `colors` (drawAtlas, as the preview), at `size`; the mask is
 * drawn at that scale, so the text is crisp at it. VP9 (WebM) keeps a
 * transparent background; H.264 (MP4) has no alpha, so it's always on
 * `background`. `onProgress` gets the frames done so far; `signal` cancels
 * (the promise then rejects with its reason).
 */
export async function renderVideo({
  settings,
  font,
  colors,
  background,
  codec,
  size,
  from,
  frames,
  onProgress,
  signal,
}: {
  settings: Settings
  font: AtlasFont
  colors: Colors
  /** The background for H.264 when `colors` has none */
  background: string
  codec: VideoCodec
  size: VideoSize
  from: number
  frames: number
  onProgress?: (done: number) => void
  signal?: AbortSignal
}): Promise<Blob> {
  const {
    Output,
    BufferTarget,
    CanvasSource,
    Mp4OutputFormat,
    WebMOutputFormat,
    Quality,
    canEncodeVideo,
  } = await import("mediabunny")

  const { width, height } = videoSize(
    settings.atlas.width,
    settings.atlas.height,
    size,
  )
  const transparent = codec === "vp9" && colors.background === null
  const h264 = codec === "h264"
  const alpha = transparent ? "keep" : "discard"
  const { fps } = settings.timing
  // Constant quality where the browser can (a quantizer: frames that change
  // a lot get the bits they need), else a bitrate to match. Text is all
  // edges: anything less blurs it while it moves
  const quality = new Quality("very-high")
  if (
    !(await canEncodeVideo(h264 ? "avc" : "vp9", {
      width,
      height,
      frameRate: fps,
      quality,
      alpha,
    }))
  ) {
    throw new Error(
      `This browser can't encode ${h264 ? "H.264" : "VP9"} video at ${width} × ${height}.`,
    )
  }

  // The engine's mask, black on transparent, at the video's scale (as the
  // preview's, at the screen's), and the frame coloured from it
  const scale = width / settings.atlas.width
  const mask = document.createElement("canvas")
  const canvas = document.createElement("canvas")
  mask.width = canvas.width = width
  mask.height = canvas.height = height
  const maskCtx = mask.getContext("2d")
  // with alpha even for an opaque video: drawAtlas colours the mask by
  // its transparency (the background, behind it, makes it opaque)
  const ctx = canvas.getContext("2d")
  if (!maskCtx || !ctx) throw new Error("Couldn't draw the video.")
  const frameColors = transparent
    ? colors
    : { ...colors, background: colors.background ?? background }

  const player = createPlayer(
    () => {
      maskCtx.setTransform(1, 0, 0, 1, 0, 0)
      maskCtx.clearRect(0, 0, mask.width, mask.height)
      maskCtx.scale(scale, scale)
      return maskCtx
    },
    settings,
    font,
  )
  player.seek(from)

  const target = new BufferTarget()
  const output = new Output({
    format: h264
      ? new Mp4OutputFormat({ fastStart: "in-memory" })
      : new WebMOutputFormat(),
    target,
  })
  const source = new CanvasSource(canvas, {
    codec: h264 ? "avc" : "vp9",
    quality,
    alpha,
  })
  output.addVideoTrack(source, { frameRate: fps })
  await output.start()
  try {
    for (let i = 0; i < frames; i++) {
      signal?.throwIfAborted()
      if (i > 0) player.advance()
      drawAtlas(ctx, mask, frameColors)
      // waits for the encoder when it's behind
      await source.add(i / fps, 1 / fps)
      onProgress?.(i + 1)
    }
    signal?.throwIfAborted()
    await output.finalize()
  } catch (e) {
    await output.cancel()
    throw e
  }
  if (!target.buffer) throw new Error("Couldn't make the video.")
  return new Blob([target.buffer], {
    type: h264 ? "video/mp4" : "video/webm",
  })
}
