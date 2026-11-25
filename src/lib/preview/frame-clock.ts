/** Most frames caught up at once, after a slow screen frame */
const MAX_CATCH_UP = 4

/**
 * Exactly `fps` frames a second, whatever the screen's refresh rate: each
 * screen frame, `due(now)` says how many frames to step (0 on a fast screen
 * now and then, 2 on a slow one). After a long stall it catches up a few
 * frames at most and drops the rest, rather than racing to catch up.
 * `pause()` keeps time from piling up while nothing plays.
 */
export function createFrameClock(fps: number, start: number) {
  const frameTime = 1000 / fps
  let last = start
  let pending = 0
  return {
    due(now: number) {
      pending += now - last
      last = now
      let n = 0
      while (pending >= frameTime && n < MAX_CATCH_UP) {
        pending -= frameTime
        n++
      }
      if (n === MAX_CATCH_UP) pending = 0
      return n
    },
    pause(now: number) {
      pending = 0
      last = now
    },
  }
}
